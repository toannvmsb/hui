import type { Prisma, PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';
import { AppError, genCode } from '../lib/http.js';
import { postJournal, getUserWalletAccount, getGroupWalletAccount, platformFeeAccount } from './ledger.js';
import { recordHistory, syncWallet } from './wallet.js';
import { FEES, CYCLE_STATUS, CONTRIB_STATUS, HUI_TYPE, HUI_MODE } from '../lib/constants.js';
import { notify } from './notify.js';

type Tx = Prisma.TransactionClient | PrismaClient;

function addCycle(base: dayjs.Dayjs, unit: string, n: number) {
  const map: Record<string, dayjs.ManipulateType> = { DAY: 'day', WEEK: 'week', MONTH: 'month' };
  return base.add(n, map[unit] || 'month');
}

/** Tạo toàn bộ lịch kỳ hụi khi dây active. Mở kỳ 1 luôn. */
export async function generateSchedule(tx: Tx, groupId: string) {
  const group = await tx.huiGroup.findUnique({ where: { id: groupId } });
  if (!group) throw new AppError('Dây hụi không tồn tại', 404);
  const start = group.startDate ? dayjs(group.startDate) : dayjs();
  for (let i = 1; i <= group.totalCycles; i++) {
    const due = addCycle(start, group.cycleUnit, i - 1).date(group.closingDay);
    await tx.huiCycle.create({
      data: {
        groupId,
        cycleNo: i,
        status: CYCLE_STATUS.PENDING,
        openAt: addCycle(start, group.cycleUnit, i - 1).startOf('day').toISOString(),
        dueDate: due.toISOString(),
      },
    });
  }
  await openCycle(tx, groupId, 1);
}

/** Mở một kỳ: tạo nghĩa vụ đóng cho mọi suất (trừ suất hốt nếu là hụi chết). */
export async function openCycle(tx: Tx, groupId: string, cycleNo: number) {
  const group = await tx.huiGroup.findUnique({ where: { id: groupId } });
  if (!group) throw new AppError('Dây hụi không tồn tại', 404);
  const cycle = await tx.huiCycle.findUnique({ where: { groupId_cycleNo: { groupId, cycleNo } } });
  if (!cycle) throw new AppError('Kỳ hụi không tồn tại', 404);

  const slots = await tx.huiSlot.findMany({ where: { groupId }, orderBy: { slotCode: 'asc' } });

  // Hụi chết: thứ tự hốt cố định theo slotCode → xác định người hốt kỳ này luôn.
  let winnerSlotId: string | null = null;
  if (group.huiType === HUI_TYPE.DEAD) {
    const winner = slots[cycleNo - 1];
    if (winner) winnerSlotId = winner.id;
  }

  for (const slot of slots) {
    // Suất hốt kỳ này được miễn đóng kỳ được hốt.
    if (slot.id === winnerSlotId) continue;
    await tx.huiContribution.create({
      data: {
        cycleId: cycle.id,
        slotId: slot.id,
        ownerUserIdAtDueTime: slot.currentOwnerId!,
        amount: group.amountPerSlot,
        status: CONTRIB_STATUS.PENDING,
      },
    });
  }

  await tx.huiCycle.update({
    where: { id: cycle.id },
    data: { status: group.huiType === HUI_TYPE.DEAD ? CYCLE_STATUS.COLLECTING : CYCLE_STATUS.COLLECTING, winnerSlotId },
  });

  // Nhắc đóng cho thành viên
  const owners = [...new Set(slots.filter((s) => s.id !== winnerSlotId).map((s) => s.currentOwnerId!))];
  for (const uid of owners) {
    await notify(tx, uid, 'PAYMENT_DUE', `Đến kỳ đóng hụi — ${group.name}`,
      `Kỳ ${cycleNo}: vui lòng đóng ${group.amountPerSlot.toLocaleString('vi-VN')}đ/suất trước ngày ${dayjs(cycle.dueDate!).format('DD/MM')}.`,
      `/groups/${groupId}`);
  }
  return cycle;
}

/** Đóng hụi cho một nghĩa vụ (contribution). payerUserId có thể khác chủ suất. */
export async function payContribution(tx: Tx, contributionId: string, payerUserId: string) {
  const contribution = await tx.huiContribution.findUnique({
    where: { id: contributionId },
    include: { cycle: { include: { group: true } }, slot: true },
  });
  if (!contribution) throw new AppError('Nghĩa vụ đóng không tồn tại', 404);
  if (contribution.status === CONTRIB_STATUS.PAID || contribution.status === CONTRIB_STATUS.GUARANTEED_PAID)
    throw new AppError('Kỳ này đã được đóng');

  const wallet = await tx.wallet.findUnique({ where: { userId: payerUserId } });
  if (!wallet) throw new AppError('Ví không tồn tại', 404);
  if (wallet.available < contribution.amount)
    throw new AppError(`Số dư không đủ. Cần ${contribution.amount.toLocaleString('vi-VN')}đ, vui lòng nạp thêm.`);

  const payerAcc = await getUserWalletAccount(tx, payerUserId);
  const groupAcc = await getGroupWalletAccount(tx, contribution.cycle.groupId);
  await postJournal(tx, {
    kind: 'CONTRIBUTION',
    memo: `Đóng hụi kỳ ${contribution.cycle.cycleNo} — ${contribution.cycle.group.name}`,
    groupId: contribution.cycle.groupId,
    cycleId: contribution.cycleId,
    legs: [
      { accountId: payerAcc.id, direction: 'DEBIT', amount: contribution.amount },
      { accountId: groupAcc.id, direction: 'CREDIT', amount: contribution.amount },
    ],
  });
  await syncWallet(tx, payerUserId, payerAcc.balance - contribution.amount);
  await recordHistory(tx, payerUserId, {
    type: 'CONTRIBUTION', direction: 'OUT', amount: contribution.amount,
    note: `Đóng hụi kỳ ${contribution.cycle.cycleNo} — ${contribution.cycle.group.name}`,
    groupId: contribution.cycle.groupId,
  });

  const receipt = genCode('BN', 8);
  await tx.huiContribution.update({
    where: { id: contributionId },
    data: { status: CONTRIB_STATUS.PAID, paidByUserId: payerUserId, paidAt: new Date(), receiptCode: receipt },
  });
  await tx.huiCycle.update({
    where: { id: contribution.cycleId },
    data: { potAmount: { increment: contribution.amount } },
  });

  // Cải thiện điểm uy tín khi đóng đúng hạn
  const onTime = dayjs().isBefore(dayjs(contribution.cycle.dueDate));
  if (onTime) {
    await tx.user.update({
      where: { id: contribution.ownerUserIdAtDueTime },
      data: { creditScore: { increment: 1 } },
    }).catch(() => {});
  }
  return { receipt };
}

/**
 * Chốt kỳ & chi trả cho người hốt.
 * winnerSlotId: với hụi sống truyền vào từ kết quả đấu; hụi chết tự lấy theo lịch.
 * bidAmount: tiền giật (hụi sống). Phân phối lại cho chủ hụi + thành viên còn lại.
 */
export async function harvestCycle(
  tx: Tx,
  cycleId: string,
  opts: { winnerSlotId?: string; bidAmount?: number } = {}
) {
  const cycle = await tx.huiCycle.findUnique({
    where: { id: cycleId },
    include: { group: true, contributions: { include: { slot: true } } },
  });
  if (!cycle) throw new AppError('Kỳ hụi không tồn tại', 404);
  if (cycle.status === CYCLE_STATUS.PAID || cycle.status === CYCLE_STATUS.CLOSED)
    throw new AppError('Kỳ này đã chi trả');

  const winnerSlotId = opts.winnerSlotId || cycle.winnerSlotId;
  if (!winnerSlotId) throw new AppError('Chưa xác định được người hốt kỳ này');
  const winnerSlot = await tx.huiSlot.findUnique({ where: { id: winnerSlotId } });
  if (!winnerSlot?.currentOwnerId) throw new AppError('Suất hốt không hợp lệ');

  // Đảm bảo tất cả nghĩa vụ đã đóng (hoặc bảo đảm trả thay)
  const unpaid = cycle.contributions.filter(
    (c) => c.status !== CONTRIB_STATUS.PAID && c.status !== CONTRIB_STATUS.GUARANTEED_PAID
  );
  if (unpaid.length > 0)
    throw new AppError(`Còn ${unpaid.length} suất chưa đóng, chưa thể chi trả kỳ này`);

  const collectedPot = cycle.contributions.reduce((s, c) => s + c.amount, 0);
  const bidAmount = opts.bidAmount ?? cycle.bidAmount ?? 0;
  const secured = cycle.group.mode === HUI_MODE.SECURED;
  const harvestFee = secured ? FEES.BID_SECURED : FEES.BID_SELF;

  const payout = collectedPot - bidAmount - harvestFee;
  if (payout < 0) throw new AppError('Cấu hình phí/giật không hợp lệ (tiền nhận âm)');

  // Phân phối tiền giật: chủ hụi + thành viên còn lại
  const nonWinnerSlots = cycle.contributions.map((c) => c.slot).filter((s) => s.id !== winnerSlotId);
  const totalPct = cycle.group.organizerSharePct + cycle.group.membersSharePct;
  let organizerCut = 0;
  let rebateEach = 0;
  if (bidAmount > 0 && totalPct > 0) {
    organizerCut = Math.round((bidAmount * cycle.group.organizerSharePct) / totalPct);
    const membersPool = bidAmount - organizerCut;
    rebateEach = nonWinnerSlots.length > 0 ? Math.floor(membersPool / nonWinnerSlots.length) : 0;
    // phần lẻ dồn cho chủ hụi
    organizerCut += membersPool - rebateEach * nonWinnerSlots.length;
  }

  const groupAcc = await getGroupWalletAccount(tx, cycle.groupId);
  const winnerAcc = await getUserWalletAccount(tx, winnerSlot.currentOwnerId);
  const feeAcc = await platformFeeAccount(tx);
  const organizerAcc = await getUserWalletAccount(tx, cycle.group.organizerId);

  const legs: any[] = [
    { accountId: groupAcc.id, direction: 'DEBIT', amount: collectedPot },
    { accountId: winnerAcc.id, direction: 'CREDIT', amount: payout },
    { accountId: feeAcc.id, direction: 'CREDIT', amount: harvestFee },
  ];
  if (organizerCut > 0) legs.push({ accountId: organizerAcc.id, direction: 'CREDIT', amount: organizerCut });
  // gom rebate theo từng chủ suất
  const rebateByUser: Record<string, number> = {};
  if (rebateEach > 0) {
    for (const s of nonWinnerSlots) {
      if (s.currentOwnerId === cycle.group.organizerId) {
        // chủ hụi cũng giữ suất: cộng vào organizerCut (đã có acc), nhưng để rõ ràng vẫn gom riêng
      }
      rebateByUser[s.currentOwnerId!] = (rebateByUser[s.currentOwnerId!] || 0) + rebateEach;
    }
    for (const [uid, amt] of Object.entries(rebateByUser)) {
      const acc = await getUserWalletAccount(tx, uid);
      legs.push({ accountId: acc.id, direction: 'CREDIT', amount: amt });
    }
  }

  await postJournal(tx, {
    kind: 'PAYOUT',
    memo: `Chi trả hốt hụi kỳ ${cycle.cycleNo} — ${cycle.group.name}`,
    groupId: cycle.groupId,
    cycleId,
    legs,
  });

  // Đồng bộ số dư ví
  await syncWallet(tx, winnerSlot.currentOwnerId, winnerAcc.balance + payout);
  await recordHistory(tx, winnerSlot.currentOwnerId, {
    type: 'PAYOUT', direction: 'IN', amount: payout,
    note: `Hốt hụi kỳ ${cycle.cycleNo} — ${cycle.group.name}`, groupId: cycle.groupId,
  });
  if (organizerCut > 0) {
    const orgAccNow = await getUserWalletAccount(tx, cycle.group.organizerId);
    await syncWallet(tx, cycle.group.organizerId, orgAccNow.balance);
    await recordHistory(tx, cycle.group.organizerId, {
      type: 'TRANSFER_IN', direction: 'IN', amount: organizerCut,
      note: `Hoa hồng chủ hụi — kỳ ${cycle.cycleNo}`, groupId: cycle.groupId,
    });
  }
  for (const [uid, amt] of Object.entries(rebateByUser)) {
    const accNow = await getUserWalletAccount(tx, uid);
    await syncWallet(tx, uid, accNow.balance);
    if (uid !== winnerSlot.currentOwnerId) {
      await recordHistory(tx, uid, {
        type: 'TRANSFER_IN', direction: 'IN', amount: amt,
        note: `Hoàn lãi đấu hụi — kỳ ${cycle.cycleNo}`, groupId: cycle.groupId,
      });
    }
  }

  const receipt = genCode('LH', 8);
  await tx.payout.create({
    data: {
      cycleId, slotId: winnerSlotId, userId: winnerSlot.currentOwnerId,
      grossAmount: collectedPot, feeAmount: harvestFee, netAmount: payout, receiptCode: receipt,
    },
  });
  await tx.huiCycle.update({
    where: { id: cycleId },
    data: { status: CYCLE_STATUS.PAID, bidAmount, payoutAmount: payout, winnerSlotId, paidAt: new Date() },
  });
  await tx.huiSlot.update({
    where: { id: winnerSlotId },
    data: { hasDrawn: true, drawnCycleNo: cycle.cycleNo },
  });
  await notify(tx, winnerSlot.currentOwnerId, 'PAYOUT', `Bạn đã hốt hụi kỳ ${cycle.cycleNo}! 🎉`,
    `Nhận ${payout.toLocaleString('vi-VN')}đ từ dây ${cycle.group.name}. Biên nhận ${receipt}.`, `/groups/${cycle.groupId}`);

  // Mở kỳ tiếp theo nếu còn
  if (cycle.cycleNo < cycle.group.totalCycles) {
    await openCycle(tx, cycle.groupId, cycle.cycleNo + 1);
  } else {
    await tx.huiGroup.update({ where: { id: cycle.groupId }, data: { status: 'COMPLETED' } });
  }

  return { receipt, payout, collectedPot, bidAmount, harvestFee };
}
