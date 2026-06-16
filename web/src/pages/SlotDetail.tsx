import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Badge, Button, Icon, Spinner } from '../components/ui';
import { vnd, fmtDate } from '../lib/format';

export default function SlotDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: s, isLoading } = useQuery({ queryKey: ['slot', id], queryFn: async () => (await api.get(`/slots/${id}`)).data });

  if (isLoading || !s) return <Screen nav={false}><SubHeader title="Chi tiết suất" /><Spinner /></Screen>;

  const canTransfer = s.isMine && !s.lockedReason && (!s.hasDrawn || s.group.allowTransferAfterDrawn);

  return (
    <Screen nav={false}>
      <SubHeader title={`Suất ${s.slotCode}`} />
      <div className="px-safe-margin pt-3">
        <div className="bg-primary-container text-white rounded-3xl p-5 mb-4 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-secondary/20 rounded-full blur-2xl" />
          <p className="text-label-md text-white/60">{s.group.name}</p>
          <div className="flex items-baseline gap-2 mt-1 mb-3">
            <h2 className="font-headline-md text-headline-md">Suất {s.slotCode}</h2>
            {s.hasDrawn ? <Badge tone="purple">Đã hốt kỳ {s.drawnCycleNo}</Badge> : <Badge tone="green">Chưa hốt</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 rounded-xl p-3"><p className="text-label-md text-white/60">Đóng mỗi kỳ</p><p className="font-semibold tabular-nums">{vnd(s.group.amountPerSlot)}</p></div>
            <div className="bg-white/10 rounded-xl p-3"><p className="text-label-md text-white/60">Nghĩa vụ còn lại</p><p className="font-semibold">{s.remainingObligations} kỳ</p></div>
          </div>
        </div>

        {s.lockedReason && <Card className="p-3 mb-3 bg-warning/5 border-warning/30 flex gap-2"><Icon name="lock" className="text-warning" size={20} /><p className="text-body-sm text-on-surface">{s.lockedReason}</p></Card>}
        {s.guaranteeStatus !== 'NONE' && <Card className="p-3 mb-3 bg-harvest/5 border-harvest/30 flex gap-2"><Icon name="shield" className="text-harvest" size={20} /><p className="text-body-sm text-on-surface">Suất có bảo đảm — trạng thái: {s.guaranteeStatus}</p></Card>}

        {/* ownership history */}
        <h3 className="font-title-lg text-title-lg text-on-surface mb-2">Lịch sử sở hữu</h3>
        <Card className="p-4 mb-4">
          <div className="relative pl-5">
            <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-outline-variant/40" />
            {s.ownershipHistory.map((h: any, i: number) => (
              <div key={i} className="relative mb-3 last:mb-0">
                <div className="absolute -left-5 top-1 w-3 h-3 rounded-full bg-secondary border-2 border-white" />
                <p className="text-body-sm font-medium text-on-surface">{h.type === 'INITIAL' ? 'Sở hữu ban đầu' : h.type === 'INTERNAL' ? 'Chuyển nhượng nội bộ' : 'Chuyển nhượng ngoài'}</p>
                <p className="text-label-md text-on-surface-variant">{fmtDate(h.at, 'DD/MM/YYYY HH:mm')}{h.price > 0 ? ` • Giá ${vnd(h.price)}` : ''}</p>
              </div>
            ))}
            {s.ownershipHistory.length === 0 && <p className="text-body-sm text-on-surface-variant">Chưa có lịch sử</p>}
          </div>
        </Card>

        {/* obligations */}
        <h3 className="font-title-lg text-title-lg text-on-surface mb-2">Nghĩa vụ đóng theo kỳ</h3>
        <Card className="p-4 mb-4">
          <div className="grid grid-cols-5 gap-2">
            {s.contributions.map((c: any) => (
              <div key={c.cycleNo} className={`aspect-square rounded-lg flex flex-col items-center justify-center text-label-md font-semibold ${c.status === 'PAID' ? 'bg-secondary/15 text-secondary' : c.status === 'OVERDUE' ? 'bg-error/15 text-error' : c.status === 'GUARANTEED_PAID' ? 'bg-harvest/15 text-harvest' : 'bg-surface-container text-on-surface-variant'}`}>
                <span>{c.cycleNo}</span>
                <Icon name={c.status === 'PAID' ? 'check' : c.status === 'OVERDUE' ? 'priority_high' : c.status === 'GUARANTEED_PAID' ? 'shield' : 'schedule'} size={14} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {canTransfer && (
        <div className="px-safe-margin py-4">
          <Button full icon="swap_horiz" onClick={() => navigate(`/slots/${id}/transfer`)}>Tạo đề nghị chuyển nhượng</Button>
        </div>
      )}
    </Screen>
  );
}
