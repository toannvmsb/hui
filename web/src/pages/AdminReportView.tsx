import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Icon, Spinner, Button } from '../components/ui';
import { downloadExcel, printReport } from '../lib/download';
import { useToast } from '../store/toast';

function fmt(v: any, money: boolean) {
  if (money && typeof v === 'number') return v.toLocaleString('vi-VN') + 'đ';
  if (typeof v === 'number') return v.toLocaleString('vi-VN');
  return v;
}

export default function AdminReportView() {
  const { type } = useParams();
  const toast = useToast((s) => s.show);
  const [busy, setBusy] = useState(false);
  const { data: report, isLoading } = useQuery({ queryKey: ['report', type], queryFn: async () => (await api.get(`/admin/reports/${type}/data`)).data });

  async function excel() {
    setBusy(true);
    try { await downloadExcel(type!, `bao-cao-${type}.xlsx`); toast('Đã tải file Excel'); }
    catch (e) { toast(apiError(e), 'red'); }
    finally { setBusy(false); }
  }
  function pdf() {
    const ok = printReport(report);
    if (!ok) toast('Trình duyệt chặn cửa sổ in. Hãy cho phép pop-up.', 'red');
  }

  if (isLoading || !report) return <Screen nav={false}><SubHeader title="Báo cáo" /><Spinner /></Screen>;

  return (
    <Screen nav={false}>
      <SubHeader title="Xem báo cáo" />
      <div className="px-safe-margin pt-3 pb-4">
        <div className="bg-primary-container text-white rounded-3xl p-5 mb-4 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-secondary/20 rounded-full blur-2xl" />
          <p className="font-headline-sm text-headline-sm">{report.title}</p>
          <p className="text-body-sm text-white/70">{report.subtitle}</p>
          <p className="text-label-md text-white/50 mt-2">Xuất lúc {report.generatedAt}</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {report.kpis.map((k: any, i: number) => (
            <Card key={i} className="p-3.5">
              <p className="font-bold text-title-lg text-secondary tabular-nums">{k.value}</p>
              <p className="text-label-md text-on-surface-variant">{k.label}</p>
            </Card>
          ))}
        </div>

        {/* tables */}
        {report.sections.map((sec: any, si: number) => {
          const money = new Set(sec.money || []);
          return (
            <div key={si} className="mb-4">
              <h3 className="font-title-lg text-title-lg text-on-surface mb-2">{sec.heading}</h3>
              <Card className="overflow-x-auto no-scrollbar">
                <table className="w-full text-body-sm" style={{ minWidth: sec.columns.length > 6 ? 640 : undefined }}>
                  <thead>
                    <tr className="bg-primary-container text-white">
                      {sec.columns.map((c: string, i: number) => <th key={i} className={`px-2.5 py-2 font-semibold whitespace-nowrap ${money.has(i) ? 'text-right' : 'text-left'}`}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {sec.rows.map((row: any[], ri: number) => (
                      <tr key={ri} className={ri % 2 ? 'bg-surface-container-low' : ''}>
                        {row.map((cell, ci) => <td key={ci} className={`px-2.5 py-2 whitespace-nowrap text-on-surface ${money.has(ci) ? 'text-right tabular-nums' : ''}`}>{fmt(cell, money.has(ci))}</td>)}
                      </tr>
                    ))}
                    {sec.total && (
                      <tr className="bg-surface-container font-bold border-t-2 border-primary-container">
                        {sec.total.map((cell: any, ci: number) => <td key={ci} className={`px-2.5 py-2 whitespace-nowrap text-on-surface ${money.has(ci) ? 'text-right tabular-nums' : ''}`}>{fmt(cell, money.has(ci))}</td>)}
                      </tr>
                    )}
                  </tbody>
                </table>
              </Card>
            </div>
          );
        })}
      </div>

      <div className="px-safe-margin py-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" icon="print" onClick={pdf}>Xem & In PDF</Button>
        <Button icon="download" loading={busy} onClick={excel}>Tải Excel</Button>
      </div>
    </Screen>
  );
}
