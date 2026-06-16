import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Icon, Spinner, Button } from '../components/ui';
import { downloadExcel } from '../lib/download';
import { useToast } from '../store/toast';

export default function AdminReports() {
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const [busy, setBusy] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['report-types'], queryFn: async () => (await api.get('/admin/reports')).data as any[] });

  async function excel(type: string) {
    setBusy(type);
    try { await downloadExcel(type, `bao-cao-${type}.xlsx`); toast('Đã tải file Excel'); }
    catch (e) { toast(apiError(e), 'red'); }
    finally { setBusy(null); }
  }

  return (
    <Screen nav={false}>
      <SubHeader title="Trung tâm báo cáo" />
      <div className="px-safe-margin pt-3">
        <Card className="p-4 mb-4 bg-tertiary/5 border-tertiary/20 flex gap-2">
          <Icon name="lightbulb" size={18} className="text-tertiary flex-shrink-0" />
          <p className="text-body-sm text-on-surface-variant">Xuất báo cáo dạng <b>Excel (.xlsx)</b> để xử lý số liệu, hoặc <b>Xem & In PDF</b> để lưu/báo cáo. Hỗ trợ tiếng Việt đầy đủ.</p>
        </Card>

        {isLoading ? <Spinner /> : (
          <div className="space-y-3">
            {(data || []).map((r) => (
              <Card key={r.type} className="p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-secondary-container flex items-center justify-center flex-shrink-0"><Icon name={r.icon} className="text-on-secondary-container" /></div>
                  <div className="flex-1">
                    <p className="font-semibold text-body-md text-on-surface">{r.title}</p>
                    <p className="text-body-sm text-on-surface-variant">{r.subtitle}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" icon="visibility" className="py-2" onClick={() => navigate(`/admin/reports/${r.type}`)}>Xem & In</Button>
                  <Button icon="download" className="py-2" loading={busy === r.type} onClick={() => excel(r.type)}>Tải Excel</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}
