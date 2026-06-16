import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { handler, AppError } from '../lib/http.js';
import { authRequired } from '../middleware/auth.js';

export const organizerRouter = Router();
organizerRouter.use(authRequired);

// Danh sách dây tôi làm chủ
organizerRouter.get('/groups', handler(async (req: any, res) => {
  const groups = await prisma.huiGroup.findMany({
    where: { organizerId: req.userId },
    include: { slots: true, cycles: true, memberships: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(groups.map((g) => ({
    id: g.id, name: g.name, code: g.code, status: g.status, mode: g.mode, huiType: g.huiType,
    totalSlots: g.totalSlots, amountPerSlot: g.amountPerSlot, totalCycles: g.totalCycles,
    members: g.memberships.filter((m) => m.status === 'APPROVED').length,
    pendingMembers: g.memberships.filter((m) => m.status === 'PENDING').length,
    paidCycles: g.cycles.filter((c) => c.status === 'PAID').length,
    openSlots: g.slots.filter((s) => s.status === 'OPEN').length,
  })));
}));

// Dashboard công nợ / thu chi 1 dây
organizerRouter.get('/groups/:id/dashboard', handler(async (req: any, res) => {
  const g = await prisma.huiGroup.findUnique({
    where: { id: req.params.id },
    include: {
      slots: { include: { currentOwner: true } },
      cycles: { include: { contributions: { include: { slot: { include: { currentOwner: true } } } }, payouts: true }, orderBy: { cycleNo: 'asc' } },
      memberships: { include: { user: true } },
    },
  });
  if (!g) throw new AppError('Dây không tồn tại', 404);
  if (g.organizerId !== req.userId && req.role !== 'ADMIN') throw new AppError('Không có quyền', 403);

  const allContribs = g.cycles.flatMap((c) => c.contributions);
  const collected = allContribs.filter((c) => c.status === 'PAID' || c.status === 'GUARANTEED_PAID').reduce((s, c) => s + c.amount, 0);
  const outstanding = allContribs.filter((c) => c.status === 'PENDING' || c.status === 'OVERDUE').reduce((s, c) => s + c.amount, 0);
  const paidOut = g.cycles.flatMap((c) => c.payouts).reduce((s, p) => s + p.netAmount, 0);
  const groupAcc = await prisma.ledgerAccount.findFirst({ where: { type: 'HUI_WALLET', groupId: g.id } });

  // công nợ theo thành viên
  const debtByUser: Record<string, { name: string; color: string; overdue: number; pending: number }> = {};
  for (const c of allContribs) {
    if (c.status === 'PENDING' || c.status === 'OVERDUE') {
      const owner = c.slot.currentOwner;
      if (!owner) continue;
      if (!debtByUser[owner.id]) debtByUser[owner.id] = { name: owner.fullName, color: owner.avatarColor, overdue: 0, pending: 0 };
      if (c.status === 'OVERDUE') debtByUser[owner.id].overdue += c.amount;
      else debtByUser[owner.id].pending += c.amount;
    }
  }

  res.json({
    id: g.id, name: g.name, status: g.status,
    walletBalance: groupAcc?.balance || 0,
    summary: { collected, outstanding, paidOut, totalValue: g.totalSlots * g.amountPerSlot * g.totalCycles },
    pendingMembers: g.memberships.filter((m) => m.status === 'PENDING').map((m) => ({ userId: m.userId, name: m.user.fullName, color: m.user.avatarColor, creditScore: m.user.creditScore })),
    debts: Object.entries(debtByUser).map(([id, d]) => ({ userId: id, ...d })).sort((a, b) => b.overdue - a.overdue),
    cycles: g.cycles.map((c) => ({ cycleNo: c.cycleNo, status: c.status, paid: c.contributions.filter((x) => x.status === 'PAID' || x.status === 'GUARANTEED_PAID').length, total: c.contributions.length, payout: c.payoutAmount })),
  });
}));
