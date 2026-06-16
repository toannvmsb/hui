import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { handler, AppError, genCode } from '../lib/http.js';
import { authRequired } from '../middleware/auth.js';
import { chargeFee } from '../services/wallet.js';
import { generateSchedule, payContribution, harvestCycle, openCycle } from '../services/hui.js';
import { placeBid, closeAuction } from '../services/auction.js';
import { FEES, HUI_MODE, GROUP_STATUS, HUI_TYPE } from '../lib/constants.js';
import { notify } from '../services/notify.js';
import { requireEkyc } from '../lib/guard.js';

export const groupsRouter = Router();
groupsRouter.use(authRequired);

// ---- Tạo dây hụi ----
groupsRouter.post('/', handler(async (req: any, res) => {
  await requireEkyc(req.userId);
  const b = req.body;
  const totalSlots = Number(b.totalSlots);
  const amountPerSlot = Number(b.amountPerSlot);
  const totalCycles = Number(b.totalCycles) || totalSlots;
  if (!b.name?.trim()) throw new AppError('Vui lòng nhập tên dây hụi');
  if (totalSlots < 2 || totalSlots > 100) throw new AppError('Số suất phải từ 2 đến 100');
  if (amountPerSlot < 100_000) throw new AppError('Giá trị mỗi suất tối thiểu 100.000đ');

  const mode = b.mode === HUI_MODE.SECURED ? HUI_MODE.SECURED : HUI_MODE.SELF;
  const mySlots = Math.min(Math.max(Number(b.mySlots) || 1, 1), totalSlots);

  const group = await prisma.$transaction(async (tx) => {
    const g = await tx.huiGroup.create({
      data: {
        name: b.name.trim(),
        code: genCode('H', 6),
        organizerId: req.userId,
        huiType: b.huiType === HUI_TYPE.LIVE ? HUI_TYPE.LIVE : HUI_TYPE.DEAD,
        mode,
        totalSlots,
        amountPerSlot,
        cycleUnit: ['DAY', 'WEEK', 'MONTH'].includes(b.cycleUnit) ? b.cycleUnit : 'MONTH',
        totalCycles,
        closingDay: Number(b.closingDay) || 10,
        bidRule: b.bidRule === 'OPEN' ? 'OPEN' : 'SEALED',
        allowExternalTransfer: !!b.allowExternalTransfer,
        allowMultiSlot: b.allowMultiSlot !== false,
        allowTransferAfterDrawn: !!b.allowTransferAfterDrawn,
        organizerSharePct: Number(b.organizerSharePct) || 1.0,
        membersSharePct: Number(b.membersSharePct) || 2.0,
        creationFee: mode === HUI_MODE.SECURED ? FEES.CREATE_SECURED : FEES.CREATE_SELF,
        status: GROUP_STATUS.PENDING_MEMBERS,
        startDate: b.startDate || null,
        agreementText: buildAgreement(b.name.trim(), totalSlots, amountPerSlot, totalCycles, b.cycleUnit, mode),
      },
    });
    await tx.ledgerAccount.create({ data: { code: `HW-${g.id}`, type: 'HUI_WALLET', name: `Ví dây ${g.name}`, groupId: g.id } });
    await tx.membership.create({ data: { groupId: g.id, userId: req.userId, status: 'APPROVED', role: 'ORGANIZER' } });
    for (let i = 1; i <= totalSlots; i++) {
      const isMine = i <= mySlots;
      await tx.huiSlot.create({
        data: {
          groupId: g.id,
          slotCode: 'S' + String(i).padStart(2, '0'),
          initialOwnerId: isMine ? req.userId : null,
          currentOwnerId: isMine ? req.userId : null,
          status: isMine ? 'ACTIVE' : 'OPEN',
        },
      });
    }
    // chủ hụi ký quy ước luôn
    await tx.agreementSignature.create({ data: { groupId: g.id, userId: req.userId, signHash: genCode('SIG', 10) } });
    return g;
  });
  res.json(group);
}));

function buildAgreement(name: string, slots: number, perSlot: number, cycles: number, unit: string, mode: string) {
  const unitTxt = unit === 'DAY' ? 'ngày' : unit === 'WEEK' ? 'tuần' : 'tháng';
  return [
    `QUY ƯỚC DÂY HỤI "${name}"`,
    `1. Dây gồm ${slots} suất, mỗi suất đóng ${perSlot.toLocaleString('vi-VN')}đ mỗi ${unitTxt}, tổng ${cycles} kỳ.`,
    `2. Thành viên cam kết đóng hụi đúng hạn theo lịch đã thống nhất.`,
    `3. Người hốt hụi sớm có nghĩa vụ tiếp tục đóng đủ các kỳ còn lại.`,
    mode === 'SECURED'
      ? `4. Đây là dây CÓ BẢO ĐẢM: trước khi hốt sớm phải có hạn mức bảo đảm; nếu chậm đóng, đối tác bảo đảm trả thay.`
      : `4. Đây là dây TỰ QUẢN: nền tảng ghi nhận & nhắc lịch, không bảo lãnh nghĩa vụ đóng.`,
    `5. Mọi giao dịch được ghi nhận minh bạch trên nền tảng và có giá trị đối soát khi tranh chấp.`,
  ].join('\n');
}

// ---- Danh sách dây của tôi ----
groupsRouter.get('/', handler(async (req: any, res) => {
  const memberships = await prisma.membership.findMany({
    where: { userId: req.userId, status: 'APPROVED' },
    include: { group: { include: { cycles: true, slots: true } } },
  });
  const cards = await Promise.all(memberships.map(async (m) => buildCard(m.group, req.userId)));
  res.json(cards.sort((a, b) => (a.statusOrder - b.statusOrder)));
}));

async function buildCard(group: any, userId: string) {
  const mySlots = group.slots.filter((s: any) => s.currentOwnerId === userId);
  const currentCycle = group.cycles.find((c: any) => c.status === 'COLLECTING' || c.status === 'BIDDING') || null;
  let myDue = 0;
  if (currentCycle) {
    const myUnpaid = await prisma.huiContribution.count({
      where: { cycleId: currentCycle.id, slotId: { in: mySlots.map((s: any) => s.id) }, status: { in: ['PENDING', 'OVERDUE'] } },
    });
    myDue = myUnpaid * group.amountPerSlot;
  }
  const paidCycles = group.cycles.filter((c: any) => c.status === 'PAID').length;
  const statusOrder = myDue > 0 ? 0 : group.status === 'ACTIVE' ? 1 : 2;
  return {
    id: group.id, name: group.name, code: group.code, huiType: group.huiType, mode: group.mode,
    status: group.status, amountPerSlot: group.amountPerSlot, totalSlots: group.totalSlots,
    totalCycles: group.totalCycles, closingDay: group.closingDay, cycleUnit: group.cycleUnit,
    currentCycleNo: currentCycle?.cycleNo || paidCycles, paidCycles, mySlotCount: mySlots.length,
    myDue, progress: Math.round((paidCycles / group.totalCycles) * 100), statusOrder,
    isOrganizer: group.organizerId === userId,
  };
}

// ---- Khám phá: dây đang mở nhận thành viên ----
groupsRouter.get('/discover', handler(async (req: any, res) => {
  const groups = await prisma.huiGroup.findMany({
    where: { status: GROUP_STATUS.PENDING_MEMBERS },
    include: { slots: true, organizer: true, cycles: true },
    orderBy: { createdAt: 'desc' }, take: 30,
  });
  res.json(groups.map((g) => ({
    id: g.id, name: g.name, code: g.code, huiType: g.huiType, mode: g.mode,
    amountPerSlot: g.amountPerSlot, totalSlots: g.totalSlots, totalCycles: g.totalCycles,
    openSlots: g.slots.filter((s) => s.status === 'OPEN').length,
    organizerName: g.organizer.fullName,
  })));
}));

// ---- Tra cứu dây theo mã (cho luồng mời qua link/QR) ----
groupsRouter.get('/by-code/:code', handler(async (req: any, res) => {
  const g = await prisma.huiGroup.findUnique({
    where: { code: req.params.code.toUpperCase() },
    include: { slots: true, organizer: true, memberships: true },
  });
  if (!g) throw new AppError('Không tìm thấy dây hụi với mã này', 404);
  const myMembership = g.memberships.find((m) => m.userId === req.userId);
  res.json({
    id: g.id, name: g.name, code: g.code, huiType: g.huiType, mode: g.mode, status: g.status,
    amountPerSlot: g.amountPerSlot, totalSlots: g.totalSlots, totalCycles: g.totalCycles, cycleUnit: g.cycleUnit,
    openSlots: g.slots.filter((s) => s.status === 'OPEN').length,
    organizerName: g.organizer.fullName,
    isOrganizer: g.organizerId === req.userId,
    myMembershipStatus: myMembership?.status || null,
  });
}));

// ---- Chi tiết dây ----
groupsRouter.get('/:id', handler(async (req: any, res) => {
  const g = await prisma.huiGroup.findUnique({
    where: { id: req.params.id },
    include: {
      organizer: true,
      slots: { include: { currentOwner: true }, orderBy: { slotCode: 'asc' } },
      cycles: { include: { contributions: true, winnerSlot: true }, orderBy: { cycleNo: 'asc' } },
      memberships: { include: { user: true } },
      agreementSigns: true,
    },
  });
  if (!g) throw new AppError('Dây hụi không tồn tại', 404);

  const cycles = g.cycles.map((c) => ({
    id: c.id, cycleNo: c.cycleNo, status: c.status, dueDate: c.dueDate, openAt: c.openAt,
    potAmount: c.potAmount, bidAmount: c.bidAmount, payoutAmount: c.payoutAmount,
    paidCount: c.contributions.filter((x) => x.status === 'PAID' || x.status === 'GUARANTEED_PAID').length,
    totalCount: c.contributions.length,
    winnerSlotCode: c.winnerSlot?.slotCode || null,
  }));
  const signedIds = new Set(g.agreementSigns.map((s) => s.userId));
  const members = g.memberships.map((m) => ({
    userId: m.userId, fullName: m.user.fullName, status: m.status, role: m.role,
    avatarColor: m.user.avatarColor, signed: signedIds.has(m.userId),
    slotCount: g.slots.filter((s) => s.currentOwnerId === m.userId).length,
    creditScore: m.user.creditScore,
  }));
  const mySlots = g.slots.filter((s) => s.currentOwnerId === req.userId);
  const myMembership = g.memberships.find((m) => m.userId === req.userId);
  const currentCycle = cycles.find((c) => c.status === 'COLLECTING' || c.status === 'BIDDING') || null;

  // nghĩa vụ của tôi trong kỳ hiện tại
  let myContributions: any[] = [];
  if (currentCycle) {
    myContributions = await prisma.huiContribution.findMany({
      where: { cycleId: currentCycle.id, slotId: { in: mySlots.map((s) => s.id) } },
      include: { slot: true },
    });
  }

  res.json({
    id: g.id, name: g.name, code: g.code, huiType: g.huiType, mode: g.mode, status: g.status,
    amountPerSlot: g.amountPerSlot, totalSlots: g.totalSlots, totalCycles: g.totalCycles,
    cycleUnit: g.cycleUnit, closingDay: g.closingDay, bidRule: g.bidRule, startDate: g.startDate,
    organizerSharePct: g.organizerSharePct, membersSharePct: g.membersSharePct,
    allowExternalTransfer: g.allowExternalTransfer, allowTransferAfterDrawn: g.allowTransferAfterDrawn,
    creationFee: g.creationFee, agreementText: g.agreementText,
    organizer: { id: g.organizer.id, fullName: g.organizer.fullName, avatarColor: g.organizer.avatarColor },
    isOrganizer: g.organizerId === req.userId,
    slots: g.slots.map((s) => ({
      id: s.id, slotCode: s.slotCode, status: s.status, hasDrawn: s.hasDrawn, drawnCycleNo: s.drawnCycleNo,
      guaranteeStatus: s.guaranteeStatus, lockedReason: s.lockedReason, transferredCount: s.transferredCount,
      ownerName: s.currentOwner?.fullName || null, ownerId: s.currentOwnerId,
      ownerColor: s.currentOwner?.avatarColor || '#c6c6cd', isMine: s.currentOwnerId === req.userId,
    })),
    cycles, members,
    myMembership: myMembership ? { status: myMembership.status, role: myMembership.role, signed: signedIds.has(req.userId) } : null,
    currentCycle,
    myContributions: myContributions.map((c) => ({ id: c.id, slotCode: c.slot.slotCode, amount: c.amount, status: c.status, receiptCode: c.receiptCode })),
    allSigned: members.filter((m) => m.status === 'APPROVED').every((m) => m.signed),
    allSlotsAssigned: g.slots.every((s) => s.currentOwnerId),
  });
}));

// ---- Mời / tham gia thành viên ----
groupsRouter.post('/:id/join', handler(async (req: any, res) => {
  await requireEkyc(req.userId);
  const g = await prisma.huiGroup.findUnique({ where: { id: req.params.id } });
  if (!g) throw new AppError('Dây hụi không tồn tại', 404);
  if (g.status !== GROUP_STATUS.PENDING_MEMBERS && g.status !== GROUP_STATUS.ACTIVE)
    throw new AppError('Dây hụi này không còn nhận thành viên');
  const existing = await prisma.membership.findUnique({ where: { groupId_userId: { groupId: g.id, userId: req.userId } } });
  if (existing) throw new AppError('Bạn đã tham gia hoặc đang chờ duyệt');
  await prisma.membership.create({ data: { groupId: g.id, userId: req.userId, status: 'PENDING' } });
  await notify(prisma, g.organizerId, 'SYSTEM', 'Có người xin tham gia dây hụi', `Một thành viên muốn tham gia "${g.name}". Vào duyệt nhé.`, `/organizer/groups/${g.id}`);
  res.json({ ok: true });
}));

// chủ hụi duyệt + gán suất
groupsRouter.post('/:id/members/:userId/approve', handler(async (req: any, res) => {
  const g = await prisma.huiGroup.findUnique({ where: { id: req.params.id } });
  if (!g || g.organizerId !== req.userId) throw new AppError('Chỉ chủ hụi được duyệt', 403);
  const slotCount = Math.max(Number(req.body.slotCount) || 1, 1);
  await prisma.$transaction(async (tx) => {
    const openSlots = await tx.huiSlot.findMany({ where: { groupId: g.id, status: 'OPEN' }, orderBy: { slotCode: 'asc' }, take: slotCount });
    if (openSlots.length < slotCount) throw new AppError('Không còn đủ suất trống để gán');
    for (const s of openSlots) {
      await tx.huiSlot.update({ where: { id: s.id }, data: { currentOwnerId: req.params.userId, initialOwnerId: req.params.userId, status: 'ACTIVE' } });
      await tx.slotOwnershipHistory.create({ data: { slotId: s.id, toUserId: req.params.userId, transferType: 'INITIAL' } });
    }
    await tx.membership.update({ where: { groupId_userId: { groupId: g.id, userId: req.params.userId } }, data: { status: 'APPROVED' } });
    await notify(tx, req.params.userId, 'SYSTEM', 'Bạn đã được duyệt vào dây hụi', `Bạn giữ ${slotCount} suất trong "${g.name}". Vui lòng ký quy ước.`, `/groups/${g.id}`);
  });
  res.json({ ok: true });
}));

groupsRouter.post('/:id/members/:userId/reject', handler(async (req: any, res) => {
  const g = await prisma.huiGroup.findUnique({ where: { id: req.params.id } });
  if (!g || g.organizerId !== req.userId) throw new AppError('Chỉ chủ hụi được từ chối', 403);
  await prisma.membership.update({ where: { groupId_userId: { groupId: g.id, userId: req.params.userId } }, data: { status: 'REJECTED' } });
  res.json({ ok: true });
}));

// ---- Ký quy ước điện tử ----
groupsRouter.post('/:id/sign', handler(async (req: any, res) => {
  const g = await prisma.huiGroup.findUnique({ where: { id: req.params.id } });
  if (!g) throw new AppError('Dây hụi không tồn tại', 404);
  const m = await prisma.membership.findUnique({ where: { groupId_userId: { groupId: g.id, userId: req.userId } } });
  if (!m || m.status !== 'APPROVED') throw new AppError('Bạn chưa được duyệt vào dây này', 403);
  await prisma.agreementSignature.upsert({
    where: { groupId_userId: { groupId: g.id, userId: req.userId } },
    create: { groupId: g.id, userId: req.userId, signHash: genCode('SIG', 10) },
    update: {},
  });
  res.json({ ok: true });
}));

// ---- Kích hoạt dây (chủ hụi) ----
groupsRouter.post('/:id/activate', handler(async (req: any, res) => {
  const g = await prisma.huiGroup.findUnique({ where: { id: req.params.id }, include: { slots: true, memberships: true, agreementSigns: true } });
  if (!g) throw new AppError('Dây hụi không tồn tại', 404);
  if (g.organizerId !== req.userId) throw new AppError('Chỉ chủ hụi được kích hoạt', 403);
  if (g.status === GROUP_STATUS.ACTIVE) throw new AppError('Dây đã hoạt động');
  if (!g.slots.every((s) => s.currentOwnerId)) throw new AppError('Vẫn còn suất trống chưa gán cho thành viên');
  const approved = g.memberships.filter((m) => m.status === 'APPROVED');
  const signedIds = new Set(g.agreementSigns.map((s) => s.userId));
  if (!approved.every((m) => signedIds.has(m.userId))) throw new AppError('Chưa đủ thành viên ký quy ước');

  await prisma.$transaction(async (tx) => {
    await chargeFee(tx, req.userId, g.creationFee, `Phí tạo dây "${g.name}"`, g.id);
    await tx.huiGroup.update({ where: { id: g.id }, data: { status: GROUP_STATUS.ACTIVE, agreementHash: genCode('HASH', 16), startDate: g.startDate || new Date().toISOString() } });
    await generateSchedule(tx, g.id);
  });
  res.json({ ok: true });
}));

// ---- Đóng hụi ----
groupsRouter.post('/contributions/:id/pay', handler(async (req: any, res) => {
  const result = await prisma.$transaction((tx) => payContribution(tx, req.params.id, req.userId));
  res.json({ ok: true, ...result });
}));

// đóng tất cả nghĩa vụ của tôi trong kỳ
groupsRouter.post('/cycles/:cycleId/pay-mine', handler(async (req: any, res) => {
  const mine = await prisma.huiContribution.findMany({
    where: { cycleId: req.params.cycleId, ownerUserIdAtDueTime: req.userId, status: { in: ['PENDING', 'OVERDUE'] } },
  });
  if (mine.length === 0) throw new AppError('Bạn không có nghĩa vụ nào cần đóng trong kỳ này');
  const receipts: string[] = [];
  await prisma.$transaction(async (tx) => {
    for (const c of mine) {
      const r = await payContribution(tx, c.id, req.userId);
      receipts.push(r.receipt);
    }
  });
  res.json({ ok: true, count: receipts.length, receipts });
}));

// ---- Đấu / giật hụi ----
groupsRouter.post('/cycles/:cycleId/bid', handler(async (req: any, res) => {
  const { slotId, bidAmount } = req.body;
  const slot = await prisma.huiSlot.findUnique({ where: { id: slotId } });
  if (!slot || slot.currentOwnerId !== req.userId) throw new AppError('Bạn chỉ được giật bằng suất của mình', 403);
  const bid = await prisma.$transaction((tx) => placeBid(tx, req.params.cycleId, slotId, Math.round(Number(bidAmount))));
  res.json({ ok: true, bid });
}));

groupsRouter.get('/cycles/:cycleId/bids', handler(async (req: any, res) => {
  const cycle = await prisma.huiCycle.findUnique({ where: { id: req.params.cycleId }, include: { group: true } });
  if (!cycle) throw new AppError('Kỳ không tồn tại', 404);
  const bids = await prisma.huiBid.findMany({ where: { cycleId: req.params.cycleId }, include: { slot: { include: { currentOwner: true } } }, orderBy: { bidAmount: 'desc' } });
  const sealed = cycle.group.bidRule === 'SEALED' && cycle.status === 'BIDDING';
  res.json(bids.map((b) => ({
    id: b.id, slotCode: b.slot.slotCode, bidAmount: b.bidAmount, isWinner: b.isWinner,
    ownerName: sealed && b.slotOwnerUserId !== req.userId ? 'Đã giấu (đấu kín)' : b.slot.currentOwner?.fullName,
    isMine: b.slotOwnerUserId === req.userId,
  })));
}));

groupsRouter.post('/cycles/:cycleId/close-auction', handler(async (req: any, res) => {
  const cycle = await prisma.huiCycle.findUnique({ where: { id: req.params.cycleId }, include: { group: true } });
  if (!cycle) throw new AppError('Kỳ không tồn tại', 404);
  if (cycle.group.organizerId !== req.userId) throw new AppError('Chỉ chủ hụi được chốt đấu', 403);
  const result = await prisma.$transaction((tx) => closeAuction(tx, req.params.cycleId));
  res.json({ ok: true, ...result });
}));

// ---- Chốt & chi trả ----
groupsRouter.post('/cycles/:cycleId/harvest', handler(async (req: any, res) => {
  const cycle = await prisma.huiCycle.findUnique({ where: { id: req.params.cycleId }, include: { group: true } });
  if (!cycle) throw new AppError('Kỳ không tồn tại', 404);
  if (cycle.group.organizerId !== req.userId) throw new AppError('Chỉ chủ hụi được chi trả', 403);
  const result = await prisma.$transaction((tx) => harvestCycle(tx, req.params.cycleId, {}));
  res.json({ ok: true, ...result });
}));
