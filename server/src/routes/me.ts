import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { handler, AppError, genCode } from '../lib/http.js';
import { authRequired } from '../middleware/auth.js';

export const meRouter = Router();
meRouter.use(authRequired);

// ---- Hồ sơ & điểm uy tín ----
meRouter.get('/profile', handler(async (req: any, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) throw new AppError('Không tìm thấy', 404);
  const groupsJoined = await prisma.membership.count({ where: { userId: user.id, status: 'APPROVED' } });
  const ownedSlots = await prisma.huiSlot.count({ where: { currentOwnerId: user.id } });
  const paidOnTime = await prisma.huiContribution.count({ where: { ownerUserIdAtDueTime: user.id, status: 'PAID' } });
  const overdue = await prisma.huiContribution.count({ where: { ownerUserIdAtDueTime: user.id, status: 'OVERDUE' } });
  const harvests = await prisma.payout.count({ where: { userId: user.id } });
  const transfers = await prisma.slotOwnershipHistory.count({ where: { toUserId: user.id, transferType: { not: 'INITIAL' } } });
  const totalDue = paidOnTime + overdue;
  const onTimeRate = totalDue > 0 ? Math.round((paidOnTime / totalDue) * 100) : 100;
  res.json({
    id: user.id, fullName: user.fullName, phone: user.phone, address: user.address, cccd: user.cccd,
    ekycStatus: user.ekycStatus, creditScore: user.creditScore, trustRating: user.trustRating, avatarColor: user.avatarColor, role: user.role,
    stats: { groupsJoined, ownedSlots, paidOnTime, overdue, harvests, transfers, onTimeRate },
  });
}));

// ---- Thông báo ----
meRouter.get('/notifications', handler(async (req: any, res) => {
  const items = await prisma.notification.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json(items);
}));
meRouter.get('/notifications/unread-count', handler(async (req: any, res) => {
  const count = await prisma.notification.count({ where: { userId: req.userId, read: false } });
  res.json({ count });
}));
meRouter.post('/notifications/read-all', handler(async (req: any, res) => {
  await prisma.notification.updateMany({ where: { userId: req.userId }, data: { read: true } });
  res.json({ ok: true });
}));

// ---- Cảnh báo rủi ro liên quan tới tôi ----
meRouter.get('/risk-alerts', handler(async (req: any, res) => {
  const myGroups = await prisma.membership.findMany({ where: { userId: req.userId, status: 'APPROVED' }, select: { groupId: true } });
  const ids = myGroups.map((g) => g.groupId);
  const alerts = await prisma.riskAlert.findMany({
    where: { OR: [{ userId: req.userId }, { groupId: { in: ids } }], resolved: false },
    orderBy: { createdAt: 'desc' }, take: 30,
  });
  res.json(alerts);
}));

// ---- Tranh chấp / khiếu nại ----
meRouter.get('/disputes', handler(async (req: any, res) => {
  const items = await prisma.dispute.findMany({ where: { raiserId: req.userId }, orderBy: { createdAt: 'desc' } });
  res.json(items);
}));
meRouter.post('/disputes', handler(async (req: any, res) => {
  const { groupId, category, subject, detail, evidenceUrls } = req.body;
  if (!subject?.trim() || !detail?.trim()) throw new AppError('Vui lòng nhập tiêu đề và nội dung khiếu nại');
  const d = await prisma.dispute.create({
    data: {
      code: genCode('KN', 7), raiserId: req.userId, groupId: groupId || null,
      category: category || 'OTHER', subject, detail,
      evidenceUrls: evidenceUrls ? JSON.stringify(evidenceUrls) : null,
    },
  });
  res.json({ ok: true, dispute: d });
}));

// ---- Bằng chứng / log (tải dữ liệu) ----
meRouter.get('/groups/:id/evidence', handler(async (req: any, res) => {
  const g = await prisma.huiGroup.findUnique({
    where: { id: req.params.id },
    include: {
      cycles: { include: { contributions: { include: { slot: true } }, bids: { include: { slot: true } }, payouts: true }, orderBy: { cycleNo: 'asc' } },
    },
  });
  if (!g) throw new AppError('Dây không tồn tại', 404);
  const contributions = g.cycles.flatMap((c) => c.contributions.map((x) => ({ cycleNo: c.cycleNo, slot: x.slot.slotCode, amount: x.amount, status: x.status, receipt: x.receiptCode, paidAt: x.paidAt })));
  const bids = g.cycles.flatMap((c) => c.bids.map((b) => ({ cycleNo: c.cycleNo, slot: b.slot.slotCode, bidAmount: b.bidAmount, isWinner: b.isWinner })));
  const payouts = g.cycles.flatMap((c) => c.payouts.map((p) => ({ cycleNo: c.cycleNo, gross: p.grossAmount, fee: p.feeAmount, net: p.netAmount, receipt: p.receiptCode })));
  res.json({ groupName: g.name, code: g.code, agreementHash: g.agreementHash, contributions, bids, payouts });
}));

// ---- Đối tác bảo đảm & hạn mức ----
meRouter.get('/guarantee/providers', handler(async (_req, res) => {
  const providers = await prisma.guaranteeProvider.findMany({ where: { isActive: true } });
  res.json(providers);
}));
meRouter.get('/guarantee/mine', handler(async (req: any, res) => {
  const items = await prisma.guarantee.findMany({ where: { userId: req.userId }, include: { provider: true, slot: { include: { group: true } } }, orderBy: { createdAt: 'desc' } });
  res.json(items.map((g) => ({ id: g.id, providerName: g.provider.name, providerType: g.provider.type, limitAmount: g.limitAmount, lockedAmount: g.lockedAmount, status: g.status, slotCode: g.slot?.slotCode, groupName: g.slot?.group.name })));
}));
meRouter.post('/guarantee/request', handler(async (req: any, res) => {
  const { providerId, limitAmount, slotId } = req.body;
  const provider = await prisma.guaranteeProvider.findUnique({ where: { id: providerId } });
  if (!provider) throw new AppError('Đối tác bảo đảm không tồn tại', 404);
  // mock: tự động duyệt hạn mức
  const g = await prisma.guarantee.create({
    data: { userId: req.userId, providerId, slotId: slotId || null, limitAmount: Math.round(Number(limitAmount)) || 0, status: 'APPROVED' },
  });
  res.json({ ok: true, guarantee: g });
}));
