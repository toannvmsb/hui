import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Badge, Button, Spinner, EmptyState, Icon } from '../components/ui';
import { vnd, vndShort, HUI_TYPE_LABEL, MODE_LABEL } from '../lib/format';
import { useToast } from '../store/toast';
import { useRequireEkyc } from '../components/EkycGate';

export default function Discover() {
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();
  const requireEkyc = useRequireEkyc();
  const { data, isLoading } = useQuery({ queryKey: ['discover'], queryFn: async () => (await api.get('/groups/discover')).data as any[] });

  const join = useMutation({
    mutationFn: (id: string) => api.post(`/groups/${id}/join`),
    onSuccess: () => { toast('Đã gửi yêu cầu tham gia, chờ chủ hụi duyệt'); qc.invalidateQueries({ queryKey: ['discover'] }); },
    onError: (e) => toast(apiError(e), 'red'),
  });

  return (
    <Screen nav={false}>
      <SubHeader title="Khám phá dây hụi" />
      <div className="px-safe-margin pt-3">
        <p className="text-body-sm text-on-surface-variant mb-4">Các dây hụi đang mở nhận thành viên. Gửi yêu cầu để chủ hụi duyệt và gán suất cho bạn.</p>
        {isLoading ? <Spinner /> : !data?.length ? (
          <EmptyState icon="travel_explore" title="Chưa có dây hụi mở" desc="Hiện chưa có dây hụi nào đang tuyển thành viên." />
        ) : (
          <div className="flex flex-col gap-gutter">
            {data.map((g) => (
              <Card key={g.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-title-lg text-title-lg text-on-surface">{g.name}</h4>
                    <p className="text-body-sm text-on-surface-variant">Chủ hụi: {g.organizerName}</p>
                  </div>
                  <Badge tone="green">{vndShort(g.amountPerSlot)}/suất</Badge>
                </div>
                <div className="flex gap-2 flex-wrap mb-3">
                  <Badge tone="blue">{HUI_TYPE_LABEL[g.huiType]}</Badge>
                  <Badge tone={g.mode === 'SECURED' ? 'purple' : 'gray'}>{MODE_LABEL[g.mode]}</Badge>
                  <Badge tone="amber" icon="confirmation_number">{g.openSlots} suất trống</Badge>
                </div>
                <div className="flex items-center justify-between border-t border-outline-variant/20 pt-3">
                  <p className="text-body-sm text-on-surface-variant">{g.totalSlots} suất • {g.totalCycles} kỳ • Tổng {vnd(g.totalSlots * g.amountPerSlot)}</p>
                  <Button className="py-2 px-4" loading={join.isPending} onClick={() => requireEkyc(() => join.mutate(g.id))}>Tham gia</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}
