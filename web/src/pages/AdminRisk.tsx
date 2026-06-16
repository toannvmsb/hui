import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Badge, Button, Icon, Spinner, EmptyState } from '../components/ui';
import { fromNow } from '../lib/format';
import { useToast } from '../store/toast';

const LEVEL: Record<string, { tone: any; color: string }> = {
  HIGH: { tone: 'red', color: 'error' }, MEDIUM: { tone: 'amber', color: 'warning' }, LOW: { tone: 'blue', color: 'tertiary' },
};
const TYPE_LABEL: Record<string, string> = {
  LATE_PAYMENT: 'Chậm đóng', BREAK_RISK: 'Nguy cơ vỡ hụi', FRAUD: 'Gian lận', TRANSFER_ANOMALY: 'Chuyển nhượng bất thường',
};

export default function AdminRisk() {
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-risk'], queryFn: async () => (await api.get('/admin/risk-alerts')).data as any[] });
  const resolve = useMutation({
    mutationFn: (id: string) => api.post(`/admin/risk-alerts/${id}/resolve`),
    onSuccess: () => { toast('Đã đánh dấu xử lý'); qc.invalidateQueries({ queryKey: ['admin-risk'] }); },
    onError: (e) => toast(apiError(e), 'red'),
  });

  return (
    <Screen nav={false}>
      <SubHeader title="Cảnh báo rủi ro hệ thống" />
      <div className="px-safe-margin pt-3">
        {isLoading ? <Spinner /> : !data?.length ? <EmptyState icon="verified_user" title="Không có cảnh báo" /> : (
          <div className="space-y-3">
            {data.map((a) => {
              const lv = LEVEL[a.level] || LEVEL.LOW;
              return (
                <Card key={a.id} className={`p-4 ${a.resolved ? 'opacity-60' : `border-${lv.color}/30`}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-${lv.color}/10 flex-shrink-0`}><Icon name="warning" fill size={20} className={`text-${lv.color}`} /></div>
                    <div className="flex-1">
                      <p className="font-semibold text-body-md text-on-surface">{a.title}</p>
                      <p className="text-body-sm text-on-surface-variant mb-2">{a.message}</p>
                      <div className="flex gap-2 items-center flex-wrap">
                        <Badge tone={lv.tone}>{TYPE_LABEL[a.type] || a.type}</Badge>
                        {a.groupName && <Badge tone="gray">{a.groupName}</Badge>}
                        {a.userName && <Badge tone="gray">{a.userName}</Badge>}
                        <span className="text-label-md text-on-surface-variant">{fromNow(a.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <Button variant="secondary" className="py-2" icon="analytics" onClick={() => navigate(`/admin/risk/${a.id}`)}>Chi tiết</Button>
                    {!a.resolved
                      ? <Button className="py-2" loading={resolve.isPending} onClick={() => resolve.mutate(a.id)}>Đã xử lý</Button>
                      : <Button className="py-2" disabled icon="check">Đã xử lý</Button>}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Screen>
  );
}
