import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../lib/http.js';
import { CYCLE_STATUS, HUI_TYPE } from '../lib/constants.js';
import { notify } from './notify.js';

type Tx = Prisma.TransactionClient | PrismaClient;

/** Đặt giá giật cho một suất trong kỳ đang đấu (hụi sống). */
export async function placeBid(tx: Tx, cycleId: string, slotId: string, bidAmount: number) {
  const cycle = await tx.huiCycle.findUnique({ where: { id: cycleId }, include: { group: true } });
  if (!cycle) throw new AppError('Kỳ hụi không tồn tại', 404);
  if (cycle.group.huiType !== HUI_TYPE.LIVE) throw new AppError('Dây hụi chết không có đấu giật hụi');
  if (cycle.status === CYCLE_STATUS.PAID || cycle.status === CYCLE_STATUS.CLOSED)
    throw new AppError('Kỳ này đã chốt');

  const slot = await tx.huiSlot.findUnique({ where: { id: slotId } });
  if (!slot || slot.groupId !== cycle.groupId) throw new AppError('Suất không hợp lệ', 400);
  if (slot.hasDrawn) throw new AppError('Suất này đã hốt, không được giật tiếp');
  if (slot.lockedReason) throw new AppError(`Suất đang bị khóa: ${slot.lockedReason}`);

  const maxPot = (cycle.group.totalSlots - 1) * cycle.group.amountPerSlot;
  if (bidAmount <= 0 || bidAmount >= maxPot)
    throw new AppError(`Giá giật phải trong khoảng 1đ … ${(maxPot - 1).toLocaleString('vi-VN')}đ`);

  // Mỗi suất chỉ giữ giá mới nhất trong kỳ
  await tx.huiBid.deleteMany({ where: { cycleId, slotId } });
  const bid = await tx.huiBid.create({
    data: { cycleId, slotId, slotOwnerUserId: slot.currentOwnerId!, bidAmount },
  });
  await tx.huiCycle.update({ where: { id: cycleId }, data: { status: CYCLE_STATUS.BIDDING } });
  return bid;
}

/** Chốt đấu: người bỏ giá CAO nhất thắng quyền hốt (nhường lãi nhiều nhất). */
export async function closeAuction(tx: Tx, cycleId: string) {
  const cycle = await tx.huiCycle.findUnique({ where: { id: cycleId }, include: { group: true } });
  if (!cycle) throw new AppError('Kỳ hụi không tồn tại', 404);
  const bids = await tx.huiBid.findMany({ where: { cycleId }, orderBy: [{ bidAmount: 'desc' }, { createdAt: 'asc' }] });
  if (bids.length === 0) throw new AppError('Chưa có ai đặt giá giật');

  const winner = bids[0];
  await tx.huiBid.updateMany({ where: { cycleId }, data: { isWinner: false } });
  await tx.huiBid.update({ where: { id: winner.id }, data: { isWinner: true } });

  // Miễn nghĩa vụ đóng kỳ được hốt cho suất thắng
  await tx.huiContribution.deleteMany({ where: { cycleId, slotId: winner.slotId } });

  await tx.huiCycle.update({
    where: { id: cycleId },
    data: { winnerSlotId: winner.slotId, bidAmount: winner.bidAmount, status: CYCLE_STATUS.COLLECTING },
  });

  await notify(tx, winner.slotOwnerUserId, 'BID_OPEN', `Bạn thắng quyền hốt kỳ ${cycle.cycleNo}! 🎯`,
    `Giá giật ${winner.bidAmount.toLocaleString('vi-VN')}đ. Khi tất cả thành viên đóng đủ, tiền sẽ được chuyển cho bạn.`,
    `/groups/${cycle.groupId}`);

  return { winnerSlotId: winner.slotId, bidAmount: winner.bidAmount, totalBids: bids.length };
}
