import type { PrismaClient } from '@prisma/client';
import { AppError } from '../lib/http.js';
import { buildUserStats, type UserStat } from './analytics.js';
import { notify } from './notify.js';

export interface ScoreParams {
  baseScore: number; onTimePoints: number; latePenalty: number;
  groupJoinPoints: number; harvestPoints: number; transferPenalty: number;
  minScore: number; maxScore: number;
}

/** Công thức tính điểm uy tín từ hành vi + bộ tham số. Dùng chung server & xem trước. */
export function computeScore(stat: { paidCount: number; overdueCount: number; groupsJoined: number; harvestCount: number; transferCount: number }, c: ScoreParams): number {
  const raw = c.baseScore
    + stat.paidCount * c.onTimePoints
    - stat.overdueCount * c.latePenalty
    + stat.groupsJoined * c.groupJoinPoints
    + stat.harvestCount * c.harvestPoints
    - stat.transferCount * c.transferPenalty;
  return Math.max(c.minScore, Math.min(c.maxScore, Math.round(raw)));
}

export async function getScoreConfig(prisma: PrismaClient) {
  let cfg = await prisma.scoreConfig.findUnique({ where: { id: 'default' } });
  if (!cfg) cfg = await prisma.scoreConfig.create({ data: { id: 'default' } });
  return cfg;
}

/** Tính lại điểm uy tín cho toàn bộ người chơi theo tham số hiện hành. */
export async function recomputeAllScores(prisma: PrismaClient, cfg: ScoreParams) {
  const stats = await buildUserStats(prisma);
  let updated = 0;
  for (const s of stats) {
    const score = computeScore(s, cfg);
    await prisma.user.update({ where: { id: s.id }, data: { creditScore: score } });
    updated++;
  }
  return updated;
}

const HIGH_RISK_ACTIONS = ['LOCK_USER', 'UNLOCK_USER', 'UPDATE_SCORE_CONFIG'];

/** Tạo yêu cầu chờ duyệt (maker). Notify các admin khác. */
export async function requestApproval(
  prisma: PrismaClient,
  opts: { action: string; payload: any; targetLabel: string; summary: string; makerId: string; makerName: string }
) {
  if (!HIGH_RISK_ACTIONS.includes(opts.action)) throw new AppError('Hành động không hợp lệ', 400);
  const ap = await prisma.adminApproval.create({
    data: {
      action: opts.action, payload: JSON.stringify(opts.payload), targetLabel: opts.targetLabel,
      summary: opts.summary, makerId: opts.makerId, makerName: opts.makerName,
    },
  });
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', id: { not: opts.makerId } } });
  for (const a of admins) {
    await notify(prisma, a.id, 'SYSTEM', 'Yêu cầu phê duyệt (4 mắt)', `${opts.makerName} đề nghị: ${opts.summary}. Cần bạn phê duyệt.`, '/admin/approvals');
  }
  return ap;
}

/** Checker phê duyệt → thực thi. Bắt buộc khác người tạo (4 mắt). */
export async function approveAndExecute(prisma: PrismaClient, approvalId: string, checkerId: string, checkerName: string) {
  const ap = await prisma.adminApproval.findUnique({ where: { id: approvalId } });
  if (!ap) throw new AppError('Yêu cầu không tồn tại', 404);
  if (ap.status !== 'PENDING') throw new AppError('Yêu cầu đã được xử lý');
  if (ap.makerId === checkerId) throw new AppError('Người tạo yêu cầu không thể tự phê duyệt (cơ chế 4 mắt)', 403);

  const payload = JSON.parse(ap.payload);
  if (ap.action === 'LOCK_USER' || ap.action === 'UNLOCK_USER') {
    const locked = ap.action === 'LOCK_USER';
    await prisma.user.update({ where: { id: payload.userId }, data: { locked } });
    if (locked) await notify(prisma, payload.userId, 'SYSTEM', 'Tài khoản bị tạm khóa', 'Tài khoản của bạn đã bị quản trị viên tạm khóa. Vui lòng liên hệ hỗ trợ.');
  } else if (ap.action === 'UPDATE_SCORE_CONFIG') {
    await prisma.scoreConfig.update({ where: { id: 'default' }, data: { ...payload, updatedBy: checkerName } });
    await recomputeAllScores(prisma, payload);
  }

  await prisma.adminApproval.update({ where: { id: approvalId }, data: { status: 'APPROVED', checkerId, checkerName, decidedAt: new Date() } });
  await notify(prisma, ap.makerId, 'SYSTEM', 'Yêu cầu được phê duyệt', `${checkerName} đã duyệt: ${ap.summary}.`);
  return ap;
}

export async function rejectApproval(prisma: PrismaClient, approvalId: string, checkerId: string, checkerName: string, reason?: string) {
  const ap = await prisma.adminApproval.findUnique({ where: { id: approvalId } });
  if (!ap) throw new AppError('Yêu cầu không tồn tại', 404);
  if (ap.status !== 'PENDING') throw new AppError('Yêu cầu đã được xử lý');
  if (ap.makerId === checkerId) throw new AppError('Người tạo yêu cầu không thể tự xử lý (cơ chế 4 mắt)', 403);
  await prisma.adminApproval.update({ where: { id: approvalId }, data: { status: 'REJECTED', checkerId, checkerName, reason, decidedAt: new Date() } });
  await notify(prisma, ap.makerId, 'SYSTEM', 'Yêu cầu bị từ chối', `${checkerName} đã từ chối: ${ap.summary}.${reason ? ' Lý do: ' + reason : ''}`);
  return ap;
}

export type { UserStat };
