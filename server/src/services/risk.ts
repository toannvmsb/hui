import type { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';
import { AppError } from '../lib/http.js';

type Dim = { key: string; label: string; icon: string; value: string; score: number; status: 'good' | 'warn' | 'crit'; detail: string };

function statusOf(score: number): 'good' | 'warn' | 'crit' {
  return score >= 66 ? 'crit' : score >= 33 ? 'warn' : 'good';
}

/**
 * Phân tích rủi ro đa chiều cho một dây hụi.
 * Trả về điểm rủi ro tổng hợp (0-100, càng cao càng rủi ro), các chiều phân tích,
 * danh sách thành viên rủi ro cao và khuyến nghị xử lý cho admin.
 */
export async function analyzeGroupRisk(prisma: PrismaClient, groupId: string) {
  const g = await prisma.huiGroup.findUnique({
    where: { id: groupId },
    include: {
      organizer: true,
      slots: { include: { currentOwner: true } },
      memberships: { include: { user: true } },
      cycles: { include: { contributions: { include: { slot: { include: { currentOwner: true } } } }, payouts: true }, orderBy: { cycleNo: 'asc' } },
    },
  });
  if (!g) throw new AppError('Dây hụi không tồn tại', 404);

  const allContribs = g.cycles.flatMap((c) => c.contributions);
  const paid = allContribs.filter((c) => c.status === 'PAID' || c.status === 'GUARANTEED_PAID').length;
  const overdue = allContribs.filter((c) => c.status === 'OVERDUE').length;
  const pending = allContribs.filter((c) => c.status === 'PENDING').length;
  const settled = paid + overdue;

  const collected = allContribs.filter((c) => c.status === 'PAID' || c.status === 'GUARANTEED_PAID').reduce((s, c) => s + c.amount, 0);
  const outstanding = allContribs.filter((c) => c.status === 'PENDING' || c.status === 'OVERDUE').reduce((s, c) => s + c.amount, 0);
  const overdueAmount = allContribs.filter((c) => c.status === 'OVERDUE').reduce((s, c) => s + c.amount, 0);

  const approvedMembers = g.memberships.filter((m) => m.status === 'APPROVED');
  const lowCredit = approvedMembers.filter((m) => m.user.creditScore < 600);
  const assignedSlots = g.slots.filter((s) => s.currentOwnerId).length;

  // tập trung sở hữu: 1 người giữ bao nhiêu % suất
  const byOwner: Record<string, number> = {};
  for (const s of g.slots) if (s.currentOwnerId) byOwner[s.currentOwnerId] = (byOwner[s.currentOwnerId] || 0) + 1;
  const maxHeld = Math.max(0, ...Object.values(byOwner));
  const concentration = g.totalSlots > 0 ? maxHeld / g.totalSlots : 0;

  const transferTotal = g.slots.reduce((s, x) => s + x.transferredCount, 0);
  const hotTransferSlots = g.slots.filter((s) => s.transferredCount >= 2).length;

  // kỳ trễ lịch: COLLECTING/BIDDING mà đã quá hạn dueDate
  const laggingCycles = g.cycles.filter((c) => (c.status === 'COLLECTING' || c.status === 'BIDDING') && c.dueDate && dayjs(c.dueDate).isBefore(dayjs())).length;

  // ---- chấm điểm từng chiều (0-100, cao = rủi ro) ----
  const lateRate = settled > 0 ? overdue / settled : 0;
  const dims: Dim[] = [];

  dims.push({
    key: 'payment', label: 'Kỷ luật đóng hụi', icon: 'savings',
    value: `${Math.round((1 - lateRate) * 100)}% đúng hạn`,
    score: Math.round(lateRate * 100),
    status: statusOf(Math.round(lateRate * 100)),
    detail: `${paid} kỳ-suất đã đóng, ${overdue} quá hạn, ${pending} chờ đóng.`,
  });

  const outstandingRate = (collected + outstanding) > 0 ? outstanding / (collected + outstanding) : 0;
  dims.push({
    key: 'outstanding', label: 'Công nợ tồn đọng', icon: 'account_balance_wallet',
    value: `${overdueAmount.toLocaleString('vi-VN')}đ quá hạn`,
    score: Math.round(Math.min(1, lateRate * 1.5 + (overdueAmount > 0 ? 0.3 : 0)) * 100),
    status: statusOf(Math.round(Math.min(1, lateRate * 1.5 + (overdueAmount > 0 ? 0.3 : 0)) * 100)),
    detail: `Còn phải thu ${outstanding.toLocaleString('vi-VN')}đ (${Math.round(outstandingRate * 100)}% giá trị kỳ chưa thu).`,
  });

  const creditScoreRisk = approvedMembers.length > 0 ? lowCredit.length / approvedMembers.length : 0;
  dims.push({
    key: 'credit', label: 'Uy tín thành viên', icon: 'workspace_premium',
    value: `${lowCredit.length}/${approvedMembers.length} điểm thấp`,
    score: Math.round(creditScoreRisk * 100),
    status: statusOf(Math.round(creditScoreRisk * 100)),
    detail: lowCredit.length ? `Có thành viên điểm uy tín < 600: ${lowCredit.map((m) => m.user.fullName).join(', ')}.` : 'Tất cả thành viên có uy tín ổn định.',
  });

  const concScore = concentration <= 0.25 ? 0 : Math.round(Math.min(1, (concentration - 0.25) / 0.5) * 100);
  dims.push({
    key: 'concentration', label: 'Tập trung sở hữu suất', icon: 'hub',
    value: `1 người giữ ${Math.round(concentration * 100)}%`,
    score: concScore, status: statusOf(concScore),
    detail: `Suất giữ nhiều nhất bởi 1 người: ${maxHeld}/${g.totalSlots}. Tập trung cao → rủi ro nếu người này vỡ nợ.`,
  });

  const transferScore = Math.round(Math.min(1, hotTransferSlots * 0.4 + transferTotal * 0.08) * 100);
  dims.push({
    key: 'transfer', label: 'Bất thường chuyển nhượng', icon: 'swap_horiz',
    value: `${transferTotal} lượt sang suất`,
    score: transferScore, status: statusOf(transferScore),
    detail: `${hotTransferSlots} suất chuyển chủ ≥ 2 lần. Sang suất dồn dập có thể là dấu hiệu thoát nghĩa vụ xấu.`,
  });

  const fillRate = g.totalSlots > 0 ? assignedSlots / g.totalSlots : 1;
  const fillScore = Math.round((1 - fillRate) * 100);
  dims.push({
    key: 'fill', label: 'Mức lấp đầy suất', icon: 'grid_view',
    value: `${assignedSlots}/${g.totalSlots} suất`,
    score: fillScore, status: statusOf(fillScore),
    detail: fillRate < 1 ? `Còn ${g.totalSlots - assignedSlots} suất trống — dây chưa đủ người, dễ gãy.` : 'Đã lấp đầy toàn bộ suất.',
  });

  const scheduleScore = Math.round(Math.min(1, laggingCycles * 0.5) * 100);
  dims.push({
    key: 'schedule', label: 'Tiến độ theo lịch', icon: 'schedule',
    value: laggingCycles ? `${laggingCycles} kỳ trễ` : 'Đúng lịch',
    score: scheduleScore, status: statusOf(scheduleScore),
    detail: laggingCycles ? `${laggingCycles} kỳ đã quá ngày chốt nhưng chưa thu/chi xong.` : 'Các kỳ đang bám sát lịch.',
  });

  const protectionScore = g.mode === 'SECURED' ? 0 : Math.round((lateRate > 0 ? 0.5 : 0.2) * 100);
  dims.push({
    key: 'protection', label: 'Mức bảo vệ', icon: 'shield',
    value: g.mode === 'SECURED' ? 'Có bảo đảm' : 'Tự quản',
    score: protectionScore, status: statusOf(protectionScore),
    detail: g.mode === 'SECURED' ? 'Dây có đối tác bảo đảm trả thay — giảm thiệt hại khi vỡ.' : 'Dây tự quản, không có bảo lãnh nếu thành viên bỏ đóng.',
  });

  // ---- điểm tổng hợp (trọng số) ----
  const weights: Record<string, number> = { payment: 2.5, outstanding: 2, credit: 1.5, concentration: 1, transfer: 1, fill: 1, schedule: 1.5, protection: 1 };
  let wsum = 0, wtot = 0;
  for (const d of dims) { const w = weights[d.key] || 1; wsum += d.score * w; wtot += w; }
  const composite = Math.round(wsum / wtot);
  const level = composite >= 60 ? 'HIGH' : composite >= 35 ? 'MEDIUM' : 'LOW';

  // ---- thành viên rủi ro cao ----
  const memberRisk: Record<string, { name: string; color: string; creditScore: number; overdueAmount: number; overdueCount: number; slots: number }> = {};
  for (const c of allContribs) {
    const owner = c.slot.currentOwner;
    if (!owner) continue;
    memberRisk[owner.id] ||= { name: owner.fullName, color: owner.avatarColor, creditScore: owner.creditScore, overdueAmount: 0, overdueCount: 0, slots: byOwner[owner.id] || 0 };
    if (c.status === 'OVERDUE') { memberRisk[owner.id].overdueAmount += c.amount; memberRisk[owner.id].overdueCount += 1; }
  }
  const riskyMembers = Object.entries(memberRisk)
    .map(([id, m]) => ({ userId: id, ...m, flag: m.overdueCount > 0 ? 'Quá hạn' : m.creditScore < 600 ? 'Uy tín thấp' : null }))
    .filter((m) => m.flag)
    .sort((a, b) => b.overdueAmount - a.overdueAmount);

  // ---- khuyến nghị xử lý ----
  const recos: { icon: string; text: string }[] = [];
  if (overdue > 0) recos.push({ icon: 'notifications_active', text: `Gửi nhắc nợ khẩn tới ${riskyMembers.filter((m) => m.overdueCount).length} thành viên đang quá hạn (tổng ${overdueAmount.toLocaleString('vi-VN')}đ).` });
  if (g.mode !== 'SECURED' && lateRate > 0.15) recos.push({ icon: 'shield', text: 'Khuyến nghị chuyển dây sang chế độ CÓ BẢO ĐẢM hoặc yêu cầu thành viên rủi ro bổ sung hạn mức bảo đảm.' });
  if (concentration > 0.4) recos.push({ icon: 'hub', text: `Hạn chế để 1 người giữ ${Math.round(concentration * 100)}% số suất — cân nhắc giới hạn số suất tối đa mỗi người.` });
  if (hotTransferSlots > 0) recos.push({ icon: 'swap_horiz', text: 'Rà soát các suất chuyển nhượng nhiều lần, kiểm tra dấu hiệu bán tháo nghĩa vụ xấu.' });
  if (fillRate < 1) recos.push({ icon: 'group_add', text: `Hỗ trợ chủ hụi tuyển đủ ${g.totalSlots - assignedSlots} suất còn trống trước khi dây vận hành tiếp.` });
  if (laggingCycles > 0) recos.push({ icon: 'gavel', text: 'Liên hệ chủ hụi chốt các kỳ đang trễ lịch; cân nhắc tạm khóa quyền giật kỳ mới.' });
  if (recos.length === 0) recos.push({ icon: 'check_circle', text: 'Dây đang trong ngưỡng an toàn — tiếp tục theo dõi định kỳ.' });

  return {
    group: { id: g.id, name: g.name, code: g.code, mode: g.mode, huiType: g.huiType, status: g.status, organizerName: g.organizer.fullName, totalSlots: g.totalSlots, amountPerSlot: g.amountPerSlot, totalCycles: g.totalCycles },
    composite, level,
    summary: { collected, outstanding, overdueAmount, members: approvedMembers.length, paidCycles: g.cycles.filter((c) => c.status === 'PAID').length },
    dimensions: dims.sort((a, b) => b.score - a.score),
    riskyMembers,
    recommendations: recos,
  };
}
