import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Badge, Button, Spinner, EmptyState, Sheet, Field } from '../components/ui';
import { fmtDate } from '../lib/format';
import { useToast } from '../store/toast';

const STATUS: Record<string, { tone: any; label: string }> = {
  OPEN: { tone: 'amber', label: 'Đang chờ' }, REVIEWING: { tone: 'blue', label: 'Đang xử lý' },
  RESOLVED: { tone: 'green', label: 'Đã giải quyết' }, REJECTED: { tone: 'red', label: 'Từ chối' },
};

export default function AdminDisputes() {
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();
  const [sel, setSel] = useState<any>(null);
  const [resolution, setResolution] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['admin-disputes'], queryFn: async () => (await api.get('/admin/disputes')).data as any[] });

  const resolve = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.post(`/admin/disputes/${id}/resolve`, { status, resolution }),
    onSuccess: () => { toast('Đã cập nhật khiếu nại'); setSel(null); setResolution(''); qc.invalidateQueries({ queryKey: ['admin-disputes'] }); },
    onError: (e) => toast(apiError(e), 'red'),
  });

  return (
    <Screen nav={false}>
      <SubHeader title="Kiểm duyệt tranh chấp" />
      <div className="px-safe-margin pt-3">
        {isLoading ? <Spinner /> : !data?.length ? <EmptyState icon="gavel" title="Không có khiếu nại" /> : (
          <div className="space-y-3">
            {data.map((d) => (
              <Card key={d.id} className="p-4" onClick={() => { setSel(d); setResolution(d.resolution || ''); }}>
                <div className="flex justify-between items-start mb-1">
                  <div><p className="font-semibold text-body-md text-on-surface">{d.subject}</p><p className="text-label-md text-on-surface-variant">#{d.code} • {d.raiserName} • {fmtDate(d.createdAt)}</p></div>
                  <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge>
                </div>
                {d.groupName && <Badge tone="gray">{d.groupName}</Badge>}
                <p className="text-body-sm text-on-surface-variant mt-2 line-clamp-2">{d.detail}</p>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Sheet open={!!sel} onClose={() => setSel(null)} title="Xử lý khiếu nại">
        {sel && (
          <div className="space-y-3">
            <Card className="p-3 bg-surface-container-low">
              <p className="font-semibold text-on-surface">{sel.subject}</p>
              <p className="text-label-md text-on-surface-variant mb-2">#{sel.code} • {sel.raiserName}</p>
              <p className="text-body-sm text-on-surface-variant">{sel.detail}</p>
            </Card>
            <Field label="Phản hồi / kết luận xử lý">
              <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3} className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-4 py-3 text-body-md outline-none focus:border-tertiary resize-none" placeholder="Nội dung phản hồi cho người khiếu nại..." />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => resolve.mutate({ id: sel.id, status: 'REVIEWING' })}>Đang xử lý</Button>
              <Button variant="danger" onClick={() => resolve.mutate({ id: sel.id, status: 'REJECTED' })}>Từ chối</Button>
            </div>
            <Button full loading={resolve.isPending} onClick={() => resolve.mutate({ id: sel.id, status: 'RESOLVED' })}>Đánh dấu đã giải quyết</Button>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}
