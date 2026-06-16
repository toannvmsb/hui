import type { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import dayjs from 'dayjs';
import { AppError } from '../lib/http.js';
import { buildUserStats, buildGroupStats } from './analytics.js';

export interface ReportSection {
  heading: string;
  columns: string[];
  rows: (string | number)[][];
  money?: number[]; // chỉ số cột là tiền (VND)
  total?: (string | number)[];
}
export interface Report {
  type: string;
  title: string;
  subtitle: string;
  generatedAt: string;
  kpis: { label: string; value: string }[];
  sections: ReportSection[];
}

const HUI_TYPE: Record<string, string> = { DEAD: 'Hụi chết', LIVE: 'Hụi sống' };
const MODE: Record<string, string> = { SELF: 'Tự quản', SECURED: 'Có bảo đảm' };
const GSTATUS: Record<string, string> = { DRAFT: 'Nháp', PENDING_MEMBERS: 'Đang tuyển', PENDING_SIGN: 'Chờ ký', ACTIVE: 'Hoạt động', COMPLETED: 'Hoàn thành', BROKEN: 'Vỡ hụi' };

export const REPORT_TYPES = [
  { type: 'overview', title: 'Báo cáo vận hành tổng thể', subtitle: 'Tổng quan người dùng, dây hụi, dòng tiền & doanh thu', icon: 'summarize' },
  { type: 'users', title: 'Báo cáo người dùng', subtitle: 'Danh sách người chơi kèm chỉ số uy tín, công nợ, rủi ro', icon: 'group' },
  { type: 'groups', title: 'Báo cáo dây hụi', subtitle: 'Danh sách dây hụi kèm giá trị, thu chi, mức rủi ro', icon: 'diversity_3' },
  { type: 'fees', title: 'Báo cáo doanh thu phí', subtitle: 'Cơ cấu phí dịch vụ nền tảng đã thu', icon: 'payments' },
  { type: 'legal', title: 'Báo cáo pháp lý (UBND)', subtitle: 'Danh sách dây hụi dân sự & quy mô để báo cáo cơ quan quản lý', icon: 'gavel' },
];

export async function buildReport(prisma: PrismaClient, type: string): Promise<Report> {
  const generatedAt = dayjs().format('HH:mm DD/MM/YYYY');
  const base = { type, generatedAt };

  if (type === 'users') {
    const users = await buildUserStats(prisma);
    return {
      ...base, title: 'Báo cáo người dùng', subtitle: `Tổng ${users.length} người chơi`,
      kpis: [
        { label: 'Tổng người chơi', value: String(users.length) },
        { label: 'Đã eKYC', value: String(users.filter((u) => u.ekycStatus === 'VERIFIED').length) },
        { label: 'Bị khóa', value: String(users.filter((u) => u.locked).length) },
        { label: 'Có nợ quá hạn', value: String(users.filter((u) => u.overdueAmount > 0).length) },
      ],
      sections: [{
        heading: 'Danh sách người chơi',
        columns: ['STT', 'Họ tên', 'SĐT', 'eKYC', 'Điểm uy tín', 'Dây', 'Suất', 'Đã đóng', 'Đã hốt', 'Nợ quá hạn', 'Rủi ro', 'Trạng thái'],
        money: [7, 8, 9],
        rows: users.map((u, i) => [i + 1, u.fullName, u.phone, u.ekycStatus === 'VERIFIED' ? 'Đã eKYC' : 'Chưa', u.creditScore, u.groupsJoined, u.slotsHeld, u.totalContributed, u.totalHarvested, u.overdueAmount, u.riskScore, u.locked ? 'Đã khóa' : 'Hoạt động']),
      }],
    };
  }

  if (type === 'groups') {
    const groups = await buildGroupStats(prisma);
    return {
      ...base, title: 'Báo cáo dây hụi', subtitle: `Tổng ${groups.length} dây hụi`,
      kpis: [
        { label: 'Tổng dây hụi', value: String(groups.length) },
        { label: 'Đang hoạt động', value: String(groups.filter((g) => g.status === 'ACTIVE').length) },
        { label: 'Tổng giá trị', value: groups.reduce((s, g) => s + g.value, 0).toLocaleString('vi-VN') + 'đ' },
        { label: 'Dây rủi ro ≥35', value: String(groups.filter((g) => g.riskScore >= 35).length) },
      ],
      sections: [{
        heading: 'Danh sách dây hụi',
        columns: ['STT', 'Tên dây', 'Mã', 'Loại', 'Chế độ', 'Chủ hụi', 'Suất', 'Giá trị', 'Đã thu', 'Còn phải thu', 'Thành viên', 'Kỳ chốt', 'Rủi ro', 'Trạng thái'],
        money: [7, 8, 9],
        rows: groups.map((g, i) => [i + 1, g.name, g.code, HUI_TYPE[g.huiType], MODE[g.mode], g.organizerName, g.totalSlots, g.value, g.collected, g.outstanding, g.members, `${g.paidCycles}/${g.totalCycles}`, g.riskScore, GSTATUS[g.status] || g.status]),
      }],
    };
  }

  if (type === 'fees') {
    const feeAcc = await prisma.ledgerAccount.findFirst({ where: { code: 'PLATFORM_FEE' } });
    const postings = feeAcc ? await prisma.ledgerPosting.findMany({ where: { accountId: feeAcc.id, direction: 'CREDIT' }, include: { entry: true } }) : [];
    const byKind: Record<string, { count: number; sum: number }> = {};
    for (const p of postings) {
      const k = p.entry.kind;
      byKind[k] ||= { count: 0, sum: 0 };
      byKind[k].count++; byKind[k].sum += p.amount;
    }
    const KIND_LABEL: Record<string, string> = { FEE: 'Phí tạo dây & chuyển nhượng', WITHDRAW: 'Phí rút tiền', PAYOUT: 'Phí giật/hốt hụi', SLOT_TRANSFER: 'Phí chuyển nhượng suất' };
    const total = feeAcc?.balance || 0;
    return {
      ...base, title: 'Báo cáo doanh thu phí', subtitle: `Tổng phí đã thu: ${total.toLocaleString('vi-VN')}đ`,
      kpis: [
        { label: 'Tổng doanh thu phí', value: total.toLocaleString('vi-VN') + 'đ' },
        { label: 'Số giao dịch thu phí', value: String(postings.length) },
      ],
      sections: [{
        heading: 'Cơ cấu phí theo loại',
        columns: ['Loại phí', 'Số lần', 'Tổng tiền', 'Tỷ trọng'],
        money: [2],
        rows: Object.entries(byKind).map(([k, v]) => [KIND_LABEL[k] || k, v.count, v.sum, total ? Math.round((v.sum / total) * 100) + '%' : '0%']),
        total: ['Tổng cộng', postings.length, total, '100%'],
      }],
    };
  }

  if (type === 'legal') {
    const groups = await buildGroupStats(prisma);
    const detail = await prisma.huiGroup.findMany({ include: { organizer: true }, orderBy: { createdAt: 'asc' } });
    const orgMap = Object.fromEntries(detail.map((g) => [g.id, g.organizer.phone]));
    const startMap = Object.fromEntries(detail.map((g) => [g.id, g.startDate]));
    const totalValue = groups.reduce((s, g) => s + g.value, 0);
    return {
      ...base, title: 'Báo cáo pháp lý — Hoạt động hụi/họ dân sự', subtitle: 'Phục vụ báo cáo cơ quan quản lý (UBND) theo Nghị định 19/2019/NĐ-CP',
      kpis: [
        { label: 'Tổng số dây hụi', value: String(groups.length) },
        { label: 'Đang hoạt động', value: String(groups.filter((g) => g.status === 'ACTIVE').length) },
        { label: 'Tổng giá trị huy động', value: totalValue.toLocaleString('vi-VN') + 'đ' },
      ],
      sections: [{
        heading: 'Danh sách dây hụi & quy mô',
        columns: ['STT', 'Tên dây hụi', 'Mã', 'Chủ hụi', 'SĐT chủ hụi', 'Thành viên', 'Số suất', 'Giá trị/kỳ', 'Tổng giá trị', 'Ngày bắt đầu', 'Trạng thái'],
        money: [7, 8],
        rows: groups.map((g, i) => [i + 1, g.name, g.code, g.organizerName, orgMap[g.id] || '', g.members, g.totalSlots, g.amountPerSlot, g.value, startMap[g.id] ? dayjs(startMap[g.id]).format('DD/MM/YYYY') : '—', GSTATUS[g.status] || g.status]),
      }],
    };
  }

  // overview (default)
  const [users, groups] = await Promise.all([buildUserStats(prisma), buildGroupStats(prisma)]);
  const feeAcc = await prisma.ledgerAccount.findFirst({ where: { code: 'PLATFORM_FEE' } });
  const gmv = groups.reduce((s, g) => s + g.collected, 0);
  const totalValue = groups.reduce((s, g) => s + g.value, 0);
  const topCredit = [...users].sort((a, b) => b.creditScore - a.creditScore).slice(0, 5);
  const richest = [...groups].sort((a, b) => b.value - a.value).slice(0, 5);
  return {
    ...base, title: 'Báo cáo vận hành tổng thể', subtitle: 'Bức tranh toàn cảnh nền tảng Hụi Thông Minh',
    kpis: [
      { label: 'Người chơi', value: String(users.length) },
      { label: 'Dây hụi', value: String(groups.length) },
      { label: 'GMV (đã luân chuyển)', value: gmv.toLocaleString('vi-VN') + 'đ' },
      { label: 'Doanh thu phí', value: (feeAcc?.balance || 0).toLocaleString('vi-VN') + 'đ' },
      { label: 'Tổng giá trị các dây', value: totalValue.toLocaleString('vi-VN') + 'đ' },
      { label: 'Đã eKYC', value: `${users.filter((u) => u.ekycStatus === 'VERIFIED').length}/${users.length}` },
    ],
    sections: [
      {
        heading: 'Top người chơi uy tín',
        columns: ['STT', 'Họ tên', 'Điểm uy tín', 'Dây tham gia', 'Đã đóng'],
        money: [4],
        rows: topCredit.map((u, i) => [i + 1, u.fullName, u.creditScore, u.groupsJoined, u.totalContributed]),
      },
      {
        heading: 'Top dây hụi giá trị cao',
        columns: ['STT', 'Tên dây', 'Giá trị', 'Thành viên', 'Đã thu', 'Rủi ro'],
        money: [2, 4],
        rows: richest.map((g, i) => [i + 1, g.name, g.value, g.members, g.collected, g.riskScore]),
      },
    ],
  };
}

export async function toExcel(report: Report): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Hụi Thông Minh';
  wb.created = new Date();

  // Sheet tổng quan (KPIs)
  const intro = wb.addWorksheet('Tổng quan');
  intro.mergeCells('A1:D1');
  intro.getCell('A1').value = report.title;
  intro.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF006C49' } };
  intro.getCell('A3').value = report.subtitle;
  intro.getCell('A4').value = `Xuất lúc: ${report.generatedAt}`;
  intro.getCell('A4').font = { italic: true, color: { argb: 'FF76777D' } };
  let r = 6;
  for (const k of report.kpis) {
    intro.getCell(`A${r}`).value = k.label;
    intro.getCell(`A${r}`).font = { bold: true };
    intro.getCell(`B${r}`).value = k.value;
    r++;
  }
  intro.getColumn(1).width = 28; intro.getColumn(2).width = 28;

  for (const sec of report.sections) {
    const ws = wb.addWorksheet(sec.heading.slice(0, 30));
    const header = ws.addRow(sec.columns);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF131B2E' } }; c.alignment = { vertical: 'middle' }; });
    const moneySet = new Set(sec.money || []);
    for (const row of sec.rows) {
      const added = ws.addRow(row);
      added.eachCell((c, col) => { if (moneySet.has(col - 1) && typeof c.value === 'number') c.numFmt = '#,##0"đ"'; });
    }
    if (sec.total) {
      const tr = ws.addRow(sec.total);
      tr.font = { bold: true };
      tr.eachCell((c, col) => { if (moneySet.has(col - 1) && typeof c.value === 'number') c.numFmt = '#,##0"đ"'; });
    }
    sec.columns.forEach((c, i) => {
      const maxLen = Math.max(c.length, ...sec.rows.map((row) => String(row[i] ?? '').length));
      ws.getColumn(i + 1).width = Math.min(40, Math.max(10, maxLen + 2));
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }

  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}
