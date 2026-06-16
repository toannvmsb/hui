import { api } from './api';

/** Tải file Excel báo cáo (giữ token qua axios + blob). */
export async function downloadExcel(type: string, filename: string) {
  const res = await api.get(`/admin/reports/${type}/excel`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const esc = (v: any) => String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

function fmtCell(v: any, isMoney: boolean) {
  if (isMoney && typeof v === 'number') return v.toLocaleString('vi-VN') + 'đ';
  if (typeof v === 'number') return v.toLocaleString('vi-VN');
  return esc(v);
}

/** Mở cửa sổ in báo cáo (người dùng chọn "Lưu thành PDF"). Tiếng Việt hiển thị chuẩn nhờ font trình duyệt. */
export function printReport(report: any) {
  const kpis = report.kpis.map((k: any) => `<div class="kpi"><div class="kpi-v">${esc(k.value)}</div><div class="kpi-l">${esc(k.label)}</div></div>`).join('');
  const sections = report.sections.map((sec: any) => {
    const money = new Set(sec.money || []);
    const head = sec.columns.map((c: string, i: number) => `<th class="${money.has(i) ? 'r' : ''}">${esc(c)}</th>`).join('');
    const rows = sec.rows.map((row: any[]) => `<tr>${row.map((cell, i) => `<td class="${money.has(i) ? 'r' : ''}">${fmtCell(cell, money.has(i))}</td>`).join('')}</tr>`).join('');
    const total = sec.total ? `<tr class="total">${sec.total.map((cell: any, i: number) => `<td class="${money.has(i) ? 'r' : ''}">${fmtCell(cell, money.has(i))}</td>`).join('')}</tr>` : '';
    return `<h2>${esc(sec.heading)}</h2><table><thead><tr>${head}</tr></thead><tbody>${rows}${total}</tbody></table>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${esc(report.title)}</title>
<style>
  * { font-family: 'Be Vietnam Pro', Arial, sans-serif; box-sizing: border-box; }
  body { margin: 32px; color: #0b1c30; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #006c49; padding-bottom:12px; margin-bottom:18px; }
  .brand { display:flex; align-items:center; gap:10px; }
  .logo { width:40px; height:40px; border-radius:10px; background:#006c49; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:20px; }
  h1 { font-size:20px; margin:0; color:#131b2e; }
  .sub { color:#45464d; font-size:13px; margin-top:2px; }
  .meta { text-align:right; font-size:12px; color:#76777d; }
  .kpis { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:20px; }
  .kpi { border:1px solid #c6c6cd; border-radius:10px; padding:10px 16px; min-width:150px; }
  .kpi-v { font-size:18px; font-weight:700; color:#006c49; }
  .kpi-l { font-size:11px; color:#45464d; text-transform:uppercase; letter-spacing:.04em; }
  h2 { font-size:15px; margin:22px 0 8px; color:#131b2e; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th { background:#131b2e; color:#fff; text-align:left; padding:7px 9px; }
  td { padding:6px 9px; border-bottom:1px solid #e5eeff; }
  tr:nth-child(even) td { background:#f8f9ff; }
  .r { text-align:right; }
  .total td { font-weight:700; background:#e5eeff !important; border-top:2px solid #131b2e; }
  .foot { margin-top:24px; font-size:11px; color:#76777d; border-top:1px solid #c6c6cd; padding-top:8px; }
  @media print { body { margin:12px; } @page { margin: 14mm; } }
</style></head><body>
  <div class="head">
    <div class="brand"><div class="logo">H</div><div><h1>${esc(report.title)}</h1><div class="sub">${esc(report.subtitle)}</div></div></div>
    <div class="meta">Hụi Thông Minh<br>Xuất lúc: ${esc(report.generatedAt)}</div>
  </div>
  <div class="kpis">${kpis}</div>
  ${sections}
  <div class="foot">Báo cáo được tạo tự động từ nền tảng Hụi Thông Minh — dữ liệu có giá trị đối soát nội bộ.</div>
  <script>window.onload = () => { window.print(); }</script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
