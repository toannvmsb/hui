import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { handler, AppError } from '../lib/http.js';
import { authRequired } from '../middleware/auth.js';
import { createTransferRequest, decideTransfer, payAndCompleteTransfer } from '../services/transfer.js';
import { requireEkyc } from '../lib/guard.js';

export const slotsRouter = Router();
slotsRouter.use(authRequired);

// suất tôi đang sở hữu
slotsRouter.get('/me/owned', handler(async (req: any, res) => {
  const slots = await prisma.huiSlot.findMany({
    where: { currentOwnerId: req.userId },
    include: { group: true },
    orderBy: { acquiredAt: 'desc' },
  });
  res.json(slots.map((s) => ({
    id: s.id, slotCode: s.slotCode, status: s.status, hasDrawn: s.hasDrawn, drawnCycleNo: s.drawnCycleNo,
    guaranteeStatus: s.guaranteeStatus, lockedReason: s.lockedReason, transferredCount: s.transferredCount,
    groupId: s.groupId, groupName: s.group.name, amountPerSlot: s.group.amountPerSlot,
    huiType: s.group.huiType, mode: s.group.mode, totalCycles: s.group.totalCycles,
  })));
}));

// chi tiết 1 suất + lịch sử sở hữu
slotsRouter.get('/:id', handler(async (req: any, res) => {
  const s = await prisma.huiSlot.findUnique({
    where: { id: req.params.id },
    include: {
      group: true, currentOwner: true, initialOwner: true,
      ownershipHistory: { orderBy: { effectiveAt: 'asc' } },
      contributions: { include: { cycle: true }, orderBy: { cycle: { cycleNo: 'asc' } } },
      transferRequests: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!s) throw new AppError('Suất không tồn tại', 404);
  const remainingObligations = s.contributions.filter((c) => c.status === 'PENDING' || c.status === 'OVERDUE').length;
  res.json({
    id: s.id, slotCode: s.slotCode, status: s.status, hasDrawn: s.hasDrawn, drawnCycleNo: s.drawnCycleNo,
    guaranteeStatus: s.guaranteeStatus, lockedReason: s.lockedReason, transferredCount: s.transferredCount,
    isMine: s.currentOwnerId === req.userId,
    group: { id: s.group.id, name: s.group.name, amountPerSlot: s.group.amountPerSlot, mode: s.group.mode, allowTransferAfterDrawn: s.group.allowTransferAfterDrawn, totalCycles: s.group.totalCycles },
    currentOwner: s.currentOwner ? { id: s.currentOwner.id, fullName: s.currentOwner.fullName } : null,
    initialOwner: s.initialOwner ? { fullName: s.initialOwner.fullName } : null,
    remainingObligations,
    ownershipHistory: s.ownershipHistory.map((h) => ({ from: h.fromUserId, to: h.toUserId, type: h.transferType, price: h.transferPrice, at: h.effectiveAt })),
    contributions: s.contributions.map((c) => ({ cycleNo: c.cycle.cycleNo, amount: c.amount, status: c.status })),
    transferRequests: s.transferRequests.map((t) => ({ id: t.id, askingPrice: t.askingPrice, approvalStatus: t.approvalStatus, paymentStatus: t.paymentStatus, buyerType: t.buyerType })),
  });
}));

// tạo đề nghị chuyển nhượng
slotsRouter.post('/:id/transfer-request', handler(async (req: any, res) => {
  const { buyerPhone, buyerType, askingPrice, note } = req.body;
  let buyerUserId: string | undefined;
  if (buyerPhone) {
    const buyer = await prisma.user.findUnique({ where: { phone: buyerPhone } });
    if (!buyer) throw new AppError('Không tìm thấy người mua với SĐT này (người mua cần có tài khoản & eKYC)');
    buyerUserId = buyer.id;
  }
  const reqRow = await prisma.$transaction((tx) => createTransferRequest(tx, {
    slotId: req.params.id, sellerUserId: req.userId, buyerUserId,
    buyerType: buyerType || (buyerUserId ? 'INTERNAL' : 'OPEN_LISTING'),
    askingPrice: Math.round(Number(askingPrice)) || 0, note,
  }));
  res.json({ ok: true, request: reqRow });
}));

// đề nghị chuyển nhượng liên quan tới tôi (mua/bán)
slotsRouter.get('/me/transfers', handler(async (req: any, res) => {
  const rows = await prisma.slotTransferRequest.findMany({
    where: { OR: [{ sellerUserId: req.userId }, { buyerUserId: req.userId }] },
    include: { slot: { include: { group: true } }, seller: true, buyer: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(rows.map((t) => ({
    id: t.id, slotCode: t.slot.slotCode, groupName: t.slot.group.name, askingPrice: t.askingPrice, feeAmount: t.feeAmount,
    approvalStatus: t.approvalStatus, paymentStatus: t.paymentStatus, buyerType: t.buyerType,
    role: t.sellerUserId === req.userId ? 'SELLER' : 'BUYER',
    sellerName: t.seller.fullName, buyerName: t.buyer?.fullName || 'Chưa có',
    createdAt: t.createdAt,
  })));
}));

slotsRouter.post('/transfers/:reqId/approve', handler(async (req: any, res) => {
  // chủ hụi hoặc admin duyệt
  const t = await prisma.slotTransferRequest.findUnique({ where: { id: req.params.reqId }, include: { slot: { include: { group: true } } } });
  if (!t) throw new AppError('Đề nghị không tồn tại', 404);
  if (t.slot.group.organizerId !== req.userId && req.role !== 'ADMIN') throw new AppError('Chỉ chủ hụi/admin được duyệt', 403);
  const r = await prisma.$transaction((tx) => decideTransfer(tx, req.params.reqId, true, req.userId));
  res.json({ ok: true, ...r });
}));

slotsRouter.post('/transfers/:reqId/reject', handler(async (req: any, res) => {
  const t = await prisma.slotTransferRequest.findUnique({ where: { id: req.params.reqId }, include: { slot: { include: { group: true } } } });
  if (!t) throw new AppError('Đề nghị không tồn tại', 404);
  if (t.slot.group.organizerId !== req.userId && req.role !== 'ADMIN') throw new AppError('Chỉ chủ hụi/admin được từ chối', 403);
  const r = await prisma.$transaction((tx) => decideTransfer(tx, req.params.reqId, false, req.userId));
  res.json({ ok: true, ...r });
}));

slotsRouter.post('/transfers/:reqId/pay', handler(async (req: any, res) => {
  await requireEkyc(req.userId);
  const r = await prisma.$transaction((tx) => payAndCompleteTransfer(tx, req.params.reqId, req.userId));
  res.json({ ok: true, ...r });
}));
