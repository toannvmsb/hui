import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Badge, Button, Icon, Spinner, EmptyState } from '../components/ui';
import { vnd, fmtDate } from '../lib/format';
import { useToast } from '../store/toast';
import { useRequireEkyc } from '../components/EkycGate';

const APPROVAL: Record<string, { label: string; tone: any }> = {
  PENDING: { label: 'Chờ duyệt', tone: 'amber' },
  APPROVED: { label: 'Đã duyệt', tone: 'green' },
  REJECTED: { label: 'Từ chối', tone: 'red' },
};

export default function Transfers() {
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();
  const requireEkyc = useRequireEkyc();
  const { data, isLoading } = useQuery({ queryKey: ['my-transfers'], queryFn: async () => (await api.get('/slots/me/transfers')).data as any[] });

  const pay = useMutation({
    mutationFn: (rid: string) => api.post(`/slots/transfers/${rid}/pay`),
    onSuccess: () => { toast('Thanh toán & nhận suất thành công! 🎉'); qc.invalidateQueries({ queryKey: ['my-transfers'] }); qc.invalidateQueries({ queryKey: ['my-slots'] }); qc.invalidateQueries({ queryKey: ['wallet'] }); },
    onError: (e) => toast(apiError(e), 'red'),
  });
  const approve = useMutation({
    mutationFn: ({ rid, ok }: { rid: string; ok: boolean }) => api.post(`/slots/transfers/${rid}/${ok ? 'approve' : 'reject'}`),
    onSuccess: () => { toast('Đã cập nhật'); qc.invalidateQueries({ queryKey: ['my-transfers'] }); },
    onError: (e) => toast(apiError(e), 'red'),
  });

  return (
    <Screen nav={false}>
      <SubHeader title="Chuyển nhượng suất" />
      <div className="px-safe-margin pt-3">
        {isLoading ? <Spinner /> : !data?.length ? (
          <EmptyState icon="swap_horiz" title="Chưa có giao dịch chuyển nhượng" desc="Các đề nghị mua/bán suất sẽ hiển thị tại đây." />
        ) : (
          <div className="space-y-3">
            {data.map((t) => (
              <Card key={t.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-body-md text-on-surface">Suất {t.slotCode} • {t.groupName}</p>
                    <p className="text-body-sm text-on-surface-variant">{t.role === 'SELLER' ? `Bán cho ${t.buyerName}` : `Mua từ ${t.sellerName}`} • {fmtDate(t.createdAt)}</p>
                  </div>
                  <Badge tone={t.role === 'SELLER' ? 'blue' : 'green'}>{t.role === 'SELLER' ? 'Bán' : 'Mua'}</Badge>
                </div>
                <div className="flex items-center justify-between bg-surface-container-low rounded-xl p-3 mb-3">
                  <span className="text-body-sm text-on-surface-variant">Giá chuyển nhượng</span>
                  <span className="font-bold text-title-lg text-secondary tabular-nums">{vnd(t.askingPrice)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Badge tone={APPROVAL[t.approvalStatus].tone}>{APPROVAL[t.approvalStatus].label}</Badge>
                    {t.paymentStatus === 'PAID' && <Badge tone="green" icon="check">Hoàn tất</Badge>}
                  </div>
                  {/* buyer can pay once approved */}
                  {t.role === 'BUYER' && t.approvalStatus === 'APPROVED' && t.paymentStatus !== 'PAID' && (
                    <Button className="py-2 px-4" loading={pay.isPending} onClick={() => requireEkyc(() => pay.mutate(t.id))}>Thanh toán {vnd(t.askingPrice + t.feeAmount)}</Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}
