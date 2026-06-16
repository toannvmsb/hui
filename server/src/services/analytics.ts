import type { PrismaClient } from '@prisma/client';

export interface UserStat {
  id: string; fullName: string; phone: string; avatarColor: string;
  ekycStatus: string; locked: boolean; role: string; creditScore: number; trustRating: number;
  groupsJoined: number; slotsHeld: number; totalContributed: number; totalHarvested: number;
  overdueAmount: number; overdueCount: number; paidCount: number; harvestCount: number; transferCount: number;
  throughput: number; riskScore: number;
}

/** Tổng hợp chỉ số cho từng người chơi (phục vụ bảng xếp hạng & quản lý người dùng). */
export async function buildUserStats(prisma: PrismaClient): Promise<UserStat[]> {
  const [users, memAgg, slotAgg, paidAgg, overdueAgg, harvestAgg, transferAgg] = await Promise.all([
    prisma.user.findMany({ where: { role: { not: 'ADMIN' } }, orderBy: { createdAt: 'asc' } }),
    prisma.membership.groupBy({ by: ['userId'], where: { status: 'APPROVED' }, _count: { _all: true } }),
    prisma.huiSlot.groupBy({ by: ['currentOwnerId'], _count: { _all: true } }),
    prisma.huiContribution.groupBy({ by: ['ownerUserIdAtDueTime'], where: { status: { in: ['PAID', 'GUARANTEED_PAID'] } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.huiContribution.groupBy({ by: ['ownerUserIdAtDueTime'], where: { status: 'OVERDUE' }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.payout.groupBy({ by: ['userId'], _sum: { netAmount: true }, _count: { _all: true } }),
    prisma.slotOwnershipHistory.groupBy({ by: ['toUserId'], where: { transferType: { not: 'INITIAL' } }, _count: { _all: true } }),
  ]);

  const mem = Object.fromEntries(memAgg.map((m) => [m.userId, m._count._all]));
  const slot = Object.fromEntries(slotAgg.filter((s) => s.currentOwnerId).map((s) => [s.currentOwnerId!, s._count._all]));
  const paid = Object.fromEntries(paidAgg.map((p) => [p.ownerUserIdAtDueTime, p._sum.amount || 0]));
  const paidCnt = Object.fromEntries(paidAgg.map((p) => [p.ownerUserIdAtDueTime, p._count._all]));
  const overdueAmt = Object.fromEntries(overdueAgg.map((p) => [p.ownerUserIdAtDueTime, p._sum.amount || 0]));
  const overdueCnt = Object.fromEntries(overdueAgg.map((p) => [p.ownerUserIdAtDueTime, p._count._all]));
  const harvestAmt = Object.fromEntries(harvestAgg.map((p) => [p.userId, p._sum.netAmount || 0]));
  const harvestCnt = Object.fromEntries(harvestAgg.map((p) => [p.userId, p._count._all]));
  const transferCnt = Object.fromEntries(transferAgg.map((p) => [p.toUserId, p._count._all]));

  return users.map((u) => {
    const totalContributed = paid[u.id] || 0;
    const totalHarvested = harvestAmt[u.id] || 0;
    const overdueCount = overdueCnt[u.id] || 0;
    const riskScore = Math.min(100, Math.round(overdueCount * 30 + Math.max(0, 680 - u.creditScore) / 4 + (u.locked ? 20 : 0)));
    return {
      id: u.id, fullName: u.fullName, phone: u.phone, avatarColor: u.avatarColor,
      ekycStatus: u.ekycStatus, locked: u.locked, role: u.role, creditScore: u.creditScore, trustRating: u.trustRating,
      groupsJoined: mem[u.id] || 0, slotsHeld: slot[u.id] || 0,
      totalContributed, totalHarvested, overdueAmount: overdueAmt[u.id] || 0, overdueCount,
      paidCount: paidCnt[u.id] || 0, harvestCount: harvestCnt[u.id] || 0, transferCount: transferCnt[u.id] || 0,
      throughput: totalContributed + totalHarvested, riskScore,
    };
  });
}

export interface GroupStat {
  id: string; name: string; code: string; status: string; mode: string; huiType: string; organizerName: string;
  totalSlots: number; amountPerSlot: number; totalCycles: number; value: number; collected: number; outstanding: number;
  members: number; openSlots: number; paidCycles: number; overdueCount: number; fillRate: number; riskScore: number;
}

/** Tổng hợp chỉ số cho từng dây hụi (phục vụ bảng xếp hạng & quản lý dây). */
export async function buildGroupStats(prisma: PrismaClient): Promise<GroupStat[]> {
  const groups = await prisma.huiGroup.findMany({
    include: { slots: true, cycles: { include: { contributions: true } }, memberships: true, organizer: true },
    orderBy: { createdAt: 'desc' },
  });
  return groups.map((g) => {
    const contribs = g.cycles.flatMap((c) => c.contributions);
    const collected = contribs.filter((c) => c.status === 'PAID' || c.status === 'GUARANTEED_PAID').reduce((s, c) => s + c.amount, 0);
    const overdueCount = contribs.filter((c) => c.status === 'OVERDUE').length;
    const outstanding = contribs.filter((c) => c.status === 'PENDING' || c.status === 'OVERDUE').reduce((s, c) => s + c.amount, 0);
    const settled = contribs.filter((c) => c.status === 'PAID' || c.status === 'GUARANTEED_PAID' || c.status === 'OVERDUE').length;
    const lateRate = settled > 0 ? overdueCount / settled : 0;
    const assigned = g.slots.filter((s) => s.currentOwnerId).length;
    const fillRate = g.totalSlots > 0 ? assigned / g.totalSlots : 1;
    const riskScore = Math.round(Math.min(100, lateRate * 55 + (1 - fillRate) * 30 + (g.mode === 'SELF' ? 8 : 0) + (overdueCount > 0 ? 7 : 0)));
    return {
      id: g.id, name: g.name, code: g.code, status: g.status, mode: g.mode, huiType: g.huiType, organizerName: g.organizer.fullName,
      totalSlots: g.totalSlots, amountPerSlot: g.amountPerSlot, totalCycles: g.totalCycles,
      value: g.totalSlots * g.amountPerSlot * g.totalCycles, collected, outstanding,
      members: g.memberships.filter((m) => m.status === 'APPROVED').length,
      openSlots: g.slots.filter((s) => s.status === 'OPEN').length,
      paidCycles: g.cycles.filter((c) => c.status === 'PAID').length, overdueCount, fillRate, riskScore,
    };
  });
}

export function topN<T>(arr: T[], key: (x: T) => number, n = 5, desc = true): T[] {
  return [...arr].sort((a, b) => (desc ? key(b) - key(a) : key(a) - key(b))).slice(0, n);
}
