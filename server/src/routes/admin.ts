import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { handler, AppError } from '../lib/http.js';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { analyzeGroupRisk } from '../services/risk.js';
import { buildUserStats, buildGroupStats, topN } from '../services/analytics.js';
import { requestApproval, approveAndExecute, rejectApproval, getScoreConfig, computeScore } from '../services/approval.js';
import { buildReport, toExcel, REPORT_TYPES } from '../services/report.js';

export const adminRouter = Router();
adminRouter.use(authRequired, adminRequired);

async function adminName(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
  return u?.fullName || 'Admin';
}

// Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu
function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd');
}

adminRouter.get('/dashboard', handler(async (_req, res) => {
  const [users, groups, activeGroups, contributions, payouts, feeAcc] = await Promise.all([
    prisma.user.count(),
    prisma.huiGroup.count(),
    prisma.huiGroup.count({ where: { status: 'ACTIVE' } }),
    prisma.huiContribution.aggregate({ _sum: { amount: true }, where: { status: { in: ['PAID', 'GUARANTEED_PAID'] } } }),
    prisma.payout.aggregate({ _sum: { netAmount: true } }),
    prisma.ledgerAccount.findFirst({ where: { code: 'PLATFORM_FEE' } }),
  ]);
  const gmv = (contributions._sum.amount || 0);
  const riskGroups = await prisma.riskAlert.findMany({ where: { resolved: false, level: 'HIGH' }, take: 10, orderBy: { createdAt: 'desc' } });
  const openDisputes = await prisma.dispute.count({ where: { status: { in: ['OPEN', 'REVIEWING'] } } });

  res.json({
    gmv, totalUsers: users, totalGroups: groups, activeGroups,
    feeRevenue: feeAcc?.balance || 0, totalPaidOut: payouts._sum.netAmount || 0,
    openDisputes, highRiskCount: riskGroups.length,
  });
}));

// Đối soát ví & sổ cái — tổng số dư phải = 0 (double-entry cân)
adminRouter.get('/reconciliation', handler(async (_req, res) => {
  const accounts = await prisma.ledgerAccount.findMany();
  const byType: Record<string, number> = {};
  let total = 0;
  for (const a of accounts) {
    byType[a.type] = (byType[a.type] || 0) + a.balance;
    total += a.balance;
  }
  const walletSum = await prisma.wallet.aggregate({ _sum: { available: true } });
  const userWalletLedger = byType['USER_WALLET'] || 0;
  res.json({
    balanced: total === 0,
    totalLedger: total,
    byType,
    walletAvailableSum: walletSum._sum.available || 0,
    userWalletLedgerSum: userWalletLedger,
    walletReconciled: (walletSum._sum.available || 0) === userWalletLedger,
    accountCount: accounts.length,
  });
}));

adminRouter.get('/risk-alerts', handler(async (_req, res) => {
  const alerts = await prisma.riskAlert.findMany({ include: { group: true, user: true }, orderBy: [{ resolved: 'asc' }, { createdAt: 'desc' }], take: 50 });
  res.json(alerts.map((a) => ({ id: a.id, level: a.level, type: a.type, title: a.title, message: a.message, resolved: a.resolved, groupName: a.group?.name, userName: a.user?.fullName, createdAt: a.createdAt })));
}));
adminRouter.post('/risk-alerts/:id/resolve', handler(async (req, res) => {
  await prisma.riskAlert.update({ where: { id: req.params.id }, data: { resolved: true } });
  res.json({ ok: true });
}));

// Phân tích rủi ro đa chiều cho cảnh báo (theo dây hụi liên quan)
adminRouter.get('/risk-alerts/:id/analysis', handler(async (req, res) => {
  const alert = await prisma.riskAlert.findUnique({ where: { id: req.params.id } });
  if (!alert) throw new AppError('Cảnh báo không tồn tại', 404);
  let groupId = alert.groupId;
  // nếu cảnh báo chỉ gắn user, tìm dây đang hoạt động có rủi ro nhất của user đó
  if (!groupId && alert.userId) {
    const slot = await prisma.huiSlot.findFirst({ where: { currentOwnerId: alert.userId }, include: { group: true } });
    groupId = slot?.groupId || null;
  }
  if (!groupId) throw new AppError('Cảnh báo không gắn với dây hụi nào để phân tích', 400);
  const analysis = await analyzeGroupRisk(prisma, groupId);
  res.json({ alert: { id: alert.id, level: alert.level, type: alert.type, title: alert.title, message: alert.message, resolved: alert.resolved, createdAt: alert.createdAt }, ...analysis });
}));

adminRouter.get('/disputes', handler(async (_req, res) => {
  const items = await prisma.dispute.findMany({ include: { raiser: true, group: true }, orderBy: { createdAt: 'desc' } });
  res.json(items.map((d) => ({ id: d.id, code: d.code, category: d.category, subject: d.subject, detail: d.detail, status: d.status, resolution: d.resolution, raiserName: d.raiser.fullName, groupName: d.group?.name, createdAt: d.createdAt })));
}));
adminRouter.post('/disputes/:id/resolve', handler(async (req: any, res) => {
  const { status, resolution } = req.body;
  if (!['RESOLVED', 'REJECTED', 'REVIEWING'].includes(status)) throw new AppError('Trạng thái không hợp lệ');
  const d = await prisma.dispute.update({ where: { id: req.params.id }, data: { status, resolution } });
  await prisma.notification.create({ data: { userId: d.raiserId, type: 'SYSTEM', title: `Khiếu nại ${d.code} đã được xử lý`, body: resolution || `Trạng thái: ${status}` } });
  res.json({ ok: true });
}));

// Danh sách dây hụi có sắp xếp + tìm kiếm (quản lý)
adminRouter.get('/groups', handler(async (req: any, res) => {
  let rows = await buildGroupStats(prisma);
  const grandTotal = rows.length;

  const q = ((req.query.q as string) || '').trim();
  if (q) {
    const nq = norm(q);
    rows = rows.filter((g) => norm(g.name).includes(nq) || norm(g.code).includes(nq) || norm(g.organizerName).includes(nq));
  }

  const sort = req.query.sort as string;
  const sorters: Record<string, (a: any, b: any) => number> = {
    value: (a, b) => b.value - a.value,
    'value-asc': (a, b) => a.value - b.value,
    members: (a, b) => b.members - a.members,
    risk: (a, b) => b.riskScore - a.riskScore,
    collected: (a, b) => b.collected - a.collected,
  };
  if (sorters[sort]) rows.sort(sorters[sort]);

  const matched = rows.length;
  const limit = q ? 50 : Math.max(1, Math.min(100, Number(req.query.limit) || 10));
  res.json({ items: rows.slice(0, limit), matched, grandTotal, searching: !!q });
}));

// Danh sách người dùng có sắp xếp + tìm kiếm (quản lý)
adminRouter.get('/users', handler(async (req: any, res) => {
  let rows = await buildUserStats(prisma);
  const grandTotal = rows.length;

  const q = ((req.query.q as string) || '').trim();
  if (q) {
    const nq = norm(q);
    const digits = q.replace(/\D/g, '');
    rows = rows.filter((u) => norm(u.fullName).includes(nq) || (digits.length >= 3 && u.phone.includes(digits)));
  }

  const sort = req.query.sort as string;
  const sorters: Record<string, (a: any, b: any) => number> = {
    credit: (a, b) => b.creditScore - a.creditScore,
    groups: (a, b) => b.groupsJoined - a.groupsJoined,
    money: (a, b) => b.throughput - a.throughput,
    risk: (a, b) => b.riskScore - a.riskScore,
    slots: (a, b) => b.slotsHeld - a.slotsHeld,
  };
  if (sorters[sort]) rows.sort(sorters[sort]);

  const matched = rows.length;
  const limit = q ? 50 : Math.max(1, Math.min(100, Number(req.query.limit) || 10));
  res.json({ items: rows.slice(0, limit), matched, grandTotal, searching: !!q });
}));

// Chi tiết một người dùng (hồ sơ 360°)
adminRouter.get('/users/:id', handler(async (req: any, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.params.id }, include: { wallet: true } });
  if (!u) throw new AppError('Người dùng không tồn tại', 404);

  const [memberships, slots, contribs, payouts, walletTx, alerts, ownership] = await Promise.all([
    prisma.membership.findMany({ where: { userId: u.id }, include: { group: true } }),
    prisma.huiSlot.findMany({ where: { currentOwnerId: u.id }, include: { group: true } }),
    prisma.huiContribution.findMany({ where: { ownerUserIdAtDueTime: u.id }, include: { cycle: { include: { group: true } } } }),
    prisma.payout.findMany({ where: { userId: u.id }, include: { cycle: { include: { group: true } } }, orderBy: { createdAt: 'desc' } }),
    u.wallet ? prisma.walletTransaction.findMany({ where: { walletId: u.wallet.id }, orderBy: { createdAt: 'desc' }, take: 15 }) : Promise.resolve([]),
    prisma.riskAlert.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' } }),
    prisma.slotOwnershipHistory.findMany({ where: { OR: [{ toUserId: u.id }, { fromUserId: u.id }] }, include: { slot: { include: { group: true } } }, orderBy: { effectiveAt: 'desc' } }),
  ]);

  const paid = contribs.filter((c) => c.status === 'PAID' || c.status === 'GUARANTEED_PAID');
  const overdue = contribs.filter((c) => c.status === 'OVERDUE');
  const pending = contribs.filter((c) => c.status === 'PENDING');
  const settled = paid.length + overdue.length;
  const totalContributed = paid.reduce((s, c) => s + c.amount, 0);
  const totalHarvested = payouts.reduce((s, p) => s + p.netAmount, 0);
  const overdueAmount = overdue.reduce((s, c) => s + c.amount, 0);
  const riskScore = Math.min(100, Math.round(overdue.length * 30 + Math.max(0, 680 - u.creditScore) / 4 + (u.locked ? 20 : 0)));

  res.json({
    profile: {
      id: u.id, fullName: u.fullName, phone: u.phone, cccd: u.cccd, address: u.address, dob: u.dob,
      ekycStatus: u.ekycStatus, locked: u.locked, role: u.role, creditScore: u.creditScore, trustRating: u.trustRating,
      avatarColor: u.avatarColor, createdAt: u.createdAt,
      wallet: u.wallet ? { available: u.wallet.available, blocked: u.wallet.blocked, accountNumber: u.wallet.accountNumber } : null,
    },
    stats: {
      groupsJoined: memberships.filter((m) => m.status === 'APPROVED').length,
      slotsHeld: slots.length,
      totalContributed, totalHarvested, overdueAmount,
      paidCount: paid.length, overdueCount: overdue.length, pendingCount: pending.length,
      harvestCount: payouts.length, onTimeRate: settled > 0 ? Math.round((paid.length / settled) * 100) : 100,
      transferCount: ownership.filter((o) => o.transferType !== 'INITIAL').length, riskScore,
    },
    groups: memberships.map((m) => ({
      groupId: m.groupId, name: m.group.name, status: m.status, role: m.role,
      huiType: m.group.huiType, mode: m.group.mode, groupStatus: m.group.status,
      slotCount: slots.filter((s) => s.groupId === m.groupId).length,
    })),
    slots: slots.map((s) => ({ id: s.id, slotCode: s.slotCode, groupName: s.group.name, hasDrawn: s.hasDrawn, status: s.status, amountPerSlot: s.group.amountPerSlot })),
    payments: contribs
      .sort((a, b) => b.cycle.cycleNo - a.cycle.cycleNo)
      .slice(0, 20)
      .map((c) => ({ groupName: c.cycle.group.name, cycleNo: c.cycle.cycleNo, amount: c.amount, status: c.status, paidAt: c.paidAt })),
    walletTx: walletTx.map((t) => ({ type: t.type, direction: t.direction, amount: t.amount, note: t.note, createdAt: t.createdAt })),
    alerts: alerts.map((a) => ({ level: a.level, type: a.type, title: a.title, message: a.message, resolved: a.resolved, createdAt: a.createdAt })),
    transfers: ownership.filter((o) => o.transferType !== 'INITIAL').map((o) => ({
      slotCode: o.slot.slotCode, groupName: o.slot.group.name, type: o.transferType, price: o.transferPrice,
      direction: o.toUserId === u.id ? 'IN' : 'OUT', at: o.effectiveAt,
    })),
  });
}));

// Khóa / mở khóa tài khoản — qua cơ chế 4 mắt
adminRouter.post('/users/:id/lock', handler(async (req: any, res) => {
  const locked = !!req.body.locked;
  const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { fullName: true } });
  if (!target) throw new AppError('Người dùng không tồn tại', 404);
  await requestApproval(prisma, {
    action: locked ? 'LOCK_USER' : 'UNLOCK_USER',
    payload: { userId: req.params.id },
    targetLabel: target.fullName,
    summary: `${locked ? 'Khóa' : 'Mở khóa'} tài khoản "${target.fullName}"`,
    makerId: req.userId, makerName: await adminName(req.userId),
  });
  res.json({ ok: true, pendingApproval: true });
}));

// ---- Cơ chế 4 mắt: hàng đợi phê duyệt ----
adminRouter.get('/approvals', handler(async (req: any, res) => {
  const items = await prisma.adminApproval.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 50 });
  res.json(items.map((a) => ({
    id: a.id, action: a.action, targetLabel: a.targetLabel, summary: a.summary, status: a.status,
    makerId: a.makerId, makerName: a.makerName, checkerName: a.checkerName, reason: a.reason,
    createdAt: a.createdAt, decidedAt: a.decidedAt, isMine: a.makerId === req.userId,
    payload: JSON.parse(a.payload),
  })));
}));
adminRouter.get('/approvals/pending-count', handler(async (req: any, res) => {
  const count = await prisma.adminApproval.count({ where: { status: 'PENDING', makerId: { not: req.userId } } });
  res.json({ count });
}));
adminRouter.post('/approvals/:id/approve', handler(async (req: any, res) => {
  await approveAndExecute(prisma, req.params.id, req.userId, await adminName(req.userId));
  res.json({ ok: true });
}));
adminRouter.post('/approvals/:id/reject', handler(async (req: any, res) => {
  await rejectApproval(prisma, req.params.id, req.userId, await adminName(req.userId), req.body.reason);
  res.json({ ok: true });
}));

// ---- Trung tâm báo cáo ----
adminRouter.get('/reports', handler(async (_req, res) => {
  res.json(REPORT_TYPES);
}));

// dữ liệu báo cáo (cho xem trước & in PDF)
adminRouter.get('/reports/:type/data', handler(async (req: any, res) => {
  const report = await buildReport(prisma, req.params.type);
  res.json(report);
}));

// tải Excel (.xlsx)
adminRouter.get('/reports/:type/excel', handler(async (req: any, res) => {
  const report = await buildReport(prisma, req.params.type);
  const buf = await toExcel(report);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="bao-cao-${req.params.type}.xlsx"`);
  res.send(buf);
}));

// ---- Bộ tham số tính điểm uy tín ----
adminRouter.get('/score-config', handler(async (_req, res) => {
  const cfg = await getScoreConfig(prisma);
  // xem trước phân bố điểm nếu áp dụng config hiện tại
  const stats = await buildUserStats(prisma);
  const preview = stats.map((s) => ({ id: s.id, fullName: s.fullName, avatarColor: s.avatarColor, current: s.creditScore, computed: computeScore(s, cfg), paidCount: s.paidCount, overdueCount: s.overdueCount, groupsJoined: s.groupsJoined, harvestCount: s.harvestCount, transferCount: s.transferCount }));
  res.json({ config: cfg, preview });
}));

// Tính thử với tham số tùy chỉnh (không lưu) — phục vụ xem trước
adminRouter.post('/score-config/preview', handler(async (req: any, res) => {
  const c = req.body;
  const stats = await buildUserStats(prisma);
  const preview = stats.map((s) => ({ id: s.id, fullName: s.fullName, avatarColor: s.avatarColor, current: s.creditScore, computed: computeScore(s, c), paidCount: s.paidCount, overdueCount: s.overdueCount, groupsJoined: s.groupsJoined, harvestCount: s.harvestCount, transferCount: s.transferCount }));
  res.json({ preview });
}));

// Lưu tham số — qua 4 mắt (kèm tính lại toàn bộ điểm khi duyệt)
adminRouter.post('/score-config', handler(async (req: any, res) => {
  const b = req.body;
  const cfg = {
    baseScore: Number(b.baseScore), onTimePoints: Number(b.onTimePoints), latePenalty: Number(b.latePenalty),
    groupJoinPoints: Number(b.groupJoinPoints), harvestPoints: Number(b.harvestPoints), transferPenalty: Number(b.transferPenalty),
    minScore: Number(b.minScore), maxScore: Number(b.maxScore),
  };
  if (cfg.minScore >= cfg.maxScore) throw new AppError('Điểm tối thiểu phải nhỏ hơn tối đa');
  await requestApproval(prisma, {
    action: 'UPDATE_SCORE_CONFIG', payload: cfg, targetLabel: 'Bộ tham số điểm uy tín',
    summary: `Cập nhật tham số tính điểm uy tín (gốc ${cfg.baseScore}, đúng hạn +${cfg.onTimePoints}, quá hạn −${cfg.latePenalty})`,
    makerId: req.userId, makerName: await adminName(req.userId),
  });
  res.json({ ok: true, pendingApproval: true });
}));

// Tổng hợp phân tích & bảng xếp hạng người dùng + dây hụi
adminRouter.get('/analytics', handler(async (_req, res) => {
  const [users, groups] = await Promise.all([buildUserStats(prisma), buildGroupStats(prisma)]);
  const feeAcc = await prisma.ledgerAccount.findFirst({ where: { code: 'PLATFORM_FEE' } });
  const gmv = groups.reduce((s, g) => s + g.collected, 0);
  res.json({
    overview: {
      totalUsers: users.length,
      verifiedUsers: users.filter((u) => u.ekycStatus === 'VERIFIED').length,
      lockedUsers: users.filter((u) => u.locked).length,
      activeUsers: users.filter((u) => u.groupsJoined > 0).length,
      totalGroups: groups.length,
      activeGroups: groups.filter((g) => g.status === 'ACTIVE').length,
      atRiskGroups: groups.filter((g) => g.riskScore >= 35).length,
      gmv, feeRevenue: feeAcc?.balance || 0,
    },
    users: {
      topCredit: topN(users, (u) => u.creditScore),
      topGroups: topN(users.filter((u) => u.groupsJoined > 0), (u) => u.groupsJoined),
      topMoney: topN(users, (u) => u.throughput),
      topRisk: topN(users.filter((u) => u.riskScore > 0), (u) => u.riskScore),
    },
    groups: {
      richest: topN(groups, (g) => g.value, 3),
      poorest: topN(groups, (g) => g.value, 3, false),
      mostMembers: topN(groups, (g) => g.members, 3),
      riskiest: topN(groups.filter((g) => g.riskScore > 0), (g) => g.riskScore, 3),
    },
  });
}));
