import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Button, Icon, Spinner, Badge } from '../components/ui';
import { vnd } from '../lib/format';
import { useToast } from '../store/toast';

export default function Contribute() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();
  const [done, setDone] = useState<{ count: number } | null>(null);

  const { data: g, isLoading } = useQuery({ queryKey: ['group', id], queryFn: async () => (await api.get(`/groups/${id}`)).data });
  const { data: wallet } = useQuery({ queryKey: ['wallet'], queryFn: async () => (await api.get('/wallet')).data });

  const unpaid = (g?.myContributions || []).filter((c: any) => c.status !== 'PAID');
  const total = unpaid.reduce((s: number, c: any) => s + c.amount, 0);
  const enough = (wallet?.available || 0) >= total;

  const pay = useMutation({
    mutationFn: () => api.post(`/groups/cycles/${g.currentCycle.id}/pay-mine`),
    onSuccess: (r) => { setDone({ count: r.data.count }); qc.invalidateQueries({ queryKey: ['group', id] }); qc.invalidateQueries({ queryKey: ['groups'] }); qc.invalidateQueries({ queryKey: ['wallet'] }); },
    onError: (e) => toast(apiError(e), 'red'),
  });

  if (isLoading || !g) return <Screen nav={false}><SubHeader title="Đóng hụi" /><Spinner /></Screen>;

  if (done) return (
    <Screen nav={false}>
      <SubHeader title="Đã đóng hụi" />
      <div className="flex flex-col items-center justify-center pt-16 px-8 text-center">
        <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-6 animate-pop shadow-xl">
          <Icon name="check" size={56} className="text-white" />
        </div>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Đóng hụi thành công!</h2>
        <p className="text-body-md text-on-surface-variant mb-1">Bạn đã đóng {done.count} suất cho kỳ {g.currentCycle?.cycleNo}</p>
        <p className="text-body-sm text-on-surface-variant mb-8">Biên nhận điện tử đã được lưu vào lịch sử giao dịch.</p>
        <div className="w-full space-y-2">
          <Button full onClick={() => navigate(`/groups/${id}`)}>Về chi tiết dây hụi</Button>
          <Button full variant="ghost" onClick={() => navigate('/history')}>Xem biên nhận</Button>
        </div>
      </div>
    </Screen>
  );

  return (
    <Screen nav={false}>
      <SubHeader title="Đóng hụi" />
      <div className="px-safe-margin pt-3">
        <Card className="p-5 mb-4">
          <p className="text-body-sm text-on-surface-variant">{g.name}</p>
          <p className="font-headline-sm text-headline-sm text-on-surface mb-4">Kỳ {g.currentCycle?.cycleNo} / {g.totalCycles}</p>
          {unpaid.length === 0 ? (
            <div className="text-center py-4">
              <Icon name="task_alt" size={48} className="text-secondary mb-2" />
              <p className="text-body-md text-on-surface">Bạn đã đóng đủ kỳ này rồi!</p>
            </div>
          ) : (
            <>
              {unpaid.map((c: any) => (
                <div key={c.id} className="flex justify-between items-center py-2 border-b border-outline-variant/15 last:border-0">
                  <span className="text-body-md text-on-surface flex items-center gap-2"><Icon name="confirmation_number" size={18} className="text-on-surface-variant" />Suất {c.slotCode}</span>
                  <span className="text-body-md font-semibold text-on-surface tabular-nums">{vnd(c.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-3 mt-1">
                <span className="font-semibold text-title-lg text-on-surface">Tổng cộng</span>
                <span className="font-bold text-title-lg text-secondary tabular-nums">{vnd(total)}</span>
              </div>
            </>
          )}
        </Card>

        {unpaid.length > 0 && (
          <Card className="p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon name="account_balance_wallet" className="text-secondary" />
              <div><p className="text-label-md text-on-surface-variant">Số dư ví</p><p className="font-semibold text-on-surface tabular-nums">{vnd(wallet?.available)}</p></div>
            </div>
            {!enough && <Badge tone="red">Không đủ</Badge>}
          </Card>
        )}

        {!enough && unpaid.length > 0 && (
          <Card className="p-4 mb-4 bg-warning/5 border-warning/30 flex items-center justify-between">
            <p className="text-body-sm text-on-surface-variant">Cần nạp thêm {vnd(total - (wallet?.available || 0))}</p>
            <Button className="py-2 px-4" onClick={() => navigate('/wallet/topup')}>Nạp tiền</Button>
          </Card>
        )}
      </div>

      {unpaid.length > 0 && (
        <div className="px-safe-margin py-4">
          <Button full disabled={!enough} loading={pay.isPending} onClick={() => pay.mutate()} icon="lock" className="py-4">
            Xác nhận đóng {vnd(total)}
          </Button>
          <p className="text-center text-label-md text-on-surface-variant mt-2">Tiền chuyển từ ví của bạn vào ví ảo dây hụi</p>
        </div>
      )}
    </Screen>
  );
}
