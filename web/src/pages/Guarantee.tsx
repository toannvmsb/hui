import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Badge, Button, Icon, Spinner, Input, Field, Sheet, Avatar, EmptyState } from '../components/ui';
import { vnd } from '../lib/format';
import { useToast } from '../store/toast';

const STATUS: Record<string, { tone: any; label: string }> = {
  REQUESTED: { tone: 'amber', label: 'Chờ duyệt' },
  APPROVED: { tone: 'green', label: 'Đã cấp' },
  LOCKED: { tone: 'blue', label: 'Đang khóa' },
  RELEASED: { tone: 'gray', label: 'Đã giải phóng' },
  REJECTED: { tone: 'red', label: 'Từ chối' },
};

export default function Guarantee() {
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [providerId, setProviderId] = useState('');
  const [limit, setLimit] = useState('');

  const { data: providers } = useQuery({ queryKey: ['providers'], queryFn: async () => (await api.get('/me/guarantee/providers')).data as any[] });
  const { data: mine, isLoading } = useQuery({ queryKey: ['my-guarantees'], queryFn: async () => (await api.get('/me/guarantee/mine')).data as any[] });

  const request = useMutation({
    mutationFn: () => api.post('/me/guarantee/request', { providerId, limitAmount: Number(limit) }),
    onSuccess: () => { toast('Đã gửi yêu cầu cấp hạn mức'); setOpen(false); setLimit(''); qc.invalidateQueries({ queryKey: ['my-guarantees'] }); },
    onError: (e) => toast(apiError(e), 'red'),
  });

  const totalLimit = (mine || []).reduce((s, g) => s + g.limitAmount, 0);
  const totalLocked = (mine || []).reduce((s, g) => s + g.lockedAmount, 0);

  return (
    <Screen nav={false}>
      <SubHeader title="Hạn mức bảo đảm" right={<button onClick={() => { setProviderId(providers?.[0]?.id || ''); setOpen(true); }} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container"><Icon name="add" className="text-secondary" /></button>} />
      <div className="px-safe-margin pt-3">
        <div className="bg-gradient-to-br from-harvest to-tertiary text-white rounded-3xl p-5 mb-4 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="flex items-center gap-2 mb-3"><Icon name="shield" fill /><span className="font-title-lg text-title-lg">Tổng hạn mức bảo đảm</span></div>
          <p className="font-headline-md text-headline-md tabular-nums mb-3">{vnd(totalLimit)}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 rounded-xl p-3"><p className="text-label-md text-white/60">Đang khóa</p><p className="font-semibold tabular-nums">{vnd(totalLocked)}</p></div>
            <div className="bg-white/10 rounded-xl p-3"><p className="text-label-md text-white/60">Khả dụng</p><p className="font-semibold tabular-nums">{vnd(totalLimit - totalLocked)}</p></div>
          </div>
        </div>

        <Card className="p-4 mb-4 bg-tertiary/5 border-tertiary/20 flex gap-2">
          <Icon name="info" size={18} className="text-tertiary flex-shrink-0" />
          <p className="text-body-sm text-on-surface-variant">Đây là <b>cam kết bảo đảm nghĩa vụ đóng hụi</b>, không phải khoản vay trực tiếp. Hạn mức chỉ kích hoạt khi bạn hốt hụi sớm ở dây có bảo đảm.</p>
        </Card>

        <h3 className="font-title-lg text-title-lg text-on-surface mb-2">Hạn mức của tôi</h3>
        {isLoading ? <Spinner /> : !mine?.length ? (
          <EmptyState icon="shield" title="Chưa có hạn mức" desc="Xin cấp hạn mức từ đối tác bảo đảm để tham gia dây hụi có bảo đảm." action={<Button icon="add" onClick={() => { setProviderId(providers?.[0]?.id || ''); setOpen(true); }}>Xin cấp hạn mức</Button>} />
        ) : (
          <div className="space-y-2">
            {mine.map((g) => (
              <Card key={g.id} className="p-4">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <p className="font-semibold text-body-md text-on-surface">{g.providerName}</p>
                    <p className="text-label-md text-on-surface-variant">{g.providerType === 'PAWN' ? 'Cầm đồ' : 'Tài chính'}{g.slotCode ? ` • Suất ${g.slotCode} (${g.groupName})` : ''}</p>
                  </div>
                  <Badge tone={STATUS[g.status].tone}>{STATUS[g.status].label}</Badge>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-body-sm text-on-surface-variant">Hạn mức</span>
                  <span className="font-bold text-title-lg text-secondary tabular-nums">{vnd(g.limitAmount)}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Xin cấp hạn mức bảo đảm">
        <div className="space-y-4">
          <div>
            <p className="text-label-md font-semibold text-on-surface-variant mb-2">Chọn đối tác</p>
            <div className="space-y-2">
              {(providers || []).map((p) => (
                <button key={p.id} onClick={() => setProviderId(p.id)} className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 ${providerId === p.id ? 'border-secondary bg-secondary/5' : 'border-outline-variant/30'}`}>
                  <Avatar name={p.name} color={p.logoColor} size={36} />
                  <div className="text-left flex-1"><p className="font-semibold text-body-md text-on-surface">{p.name}</p><p className="text-label-md text-on-surface-variant">{p.type === 'PAWN' ? 'Cầm đồ' : 'Tài chính'}</p></div>
                  {providerId === p.id && <Icon name="check_circle" className="text-secondary" fill />}
                </button>
              ))}
            </div>
          </div>
          <Field label="Hạn mức mong muốn (đồng)"><Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="VD: 50000000" /></Field>
          <Button full loading={request.isPending} disabled={!providerId || !limit} onClick={() => request.mutate()}>Gửi yêu cầu</Button>
        </div>
      </Sheet>
    </Screen>
  );
}
