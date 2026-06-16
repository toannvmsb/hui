import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Button, Icon, Spinner, Badge, Input, Field, Avatar } from '../components/ui';
import { vnd, vndShort } from '../lib/format';
import { useToast } from '../store/toast';

export default function Auction() {
  const { cycleId } = useParams();
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();
  const [bid, setBid] = useState('');

  const { data: bids, isLoading } = useQuery({
    queryKey: ['bids', cycleId],
    queryFn: async () => (await api.get(`/groups/cycles/${cycleId}/bids`)).data as any[],
    refetchInterval: 5000,
  });
  // find my groups to locate this cycle + my slot
  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: async () => (await api.get('/groups')).data });

  const place = useMutation({
    mutationFn: async () => {
      // need my slot in this cycle's group — fetch via group detail by scanning bids' group is hard; use a dedicated approach:
      const me = await api.get('/slots/me/owned');
      // we need the groupId of this cycle. Get it from any existing group detail that has this cycle.
      const gid = await resolveGroupId();
      const mySlot = me.data.find((s: any) => s.groupId === gid && !s.hasDrawn);
      if (!mySlot) throw new Error('Bạn không có suất hợp lệ để giật trong dây này');
      return api.post(`/groups/cycles/${cycleId}/bid`, { slotId: mySlot.id, bidAmount: Number(bid) });
    },
    onSuccess: () => { toast('Đã đặt giá giật!'); setBid(''); qc.invalidateQueries({ queryKey: ['bids', cycleId] }); },
    onError: (e) => toast(apiError(e), 'red'),
  });

  async function resolveGroupId(): Promise<string> {
    for (const g of groups || []) {
      const detail = (await api.get(`/groups/${g.id}`)).data;
      if (detail.currentCycle?.id === cycleId || detail.cycles.some((c: any) => c.id === cycleId)) return g.id;
    }
    throw new Error('Không tìm thấy dây hụi của kỳ này');
  }

  const winner = bids?.find((b) => b.isWinner);
  const topBid = bids && bids.length > 0 ? bids[0] : null;

  return (
    <Screen nav={false}>
      <SubHeader title="Phiên đấu hụi" />
      <div className="px-safe-margin pt-3">
        {/* status */}
        <div className="bg-primary-container text-white rounded-3xl p-5 mb-4 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-tertiary/30 rounded-full blur-2xl" />
          <div className="flex items-center gap-2 mb-2">
            <Icon name="gavel" fill className="text-secondary-fixed" />
            <span className="font-title-lg text-title-lg">{winner ? 'Đã có kết quả' : 'Đang đấu giật hụi'}</span>
          </div>
          {winner ? (
            <div className="animate-pop">
              <p className="text-label-md text-white/60 mb-1">Người thắng quyền hốt</p>
              <p className="font-headline-md text-headline-md text-secondary-fixed">Suất {winner.slotCode}</p>
              <p className="text-body-sm text-white/70 mt-1">Giá giật: {vnd(winner.bidAmount)}</p>
            </div>
          ) : (
            <>
              <p className="text-label-md text-white/60 mb-1">Giá giật cao nhất hiện tại</p>
              <p className="font-headline-md text-headline-md text-white tabular-nums">{topBid ? vnd(topBid.bidAmount) : 'Chưa có'}</p>
              <p className="text-body-sm text-white/70 mt-1">Người bỏ giá cao nhất thắng quyền hốt (nhường lãi nhiều nhất)</p>
            </>
          )}
        </div>

        {/* place bid */}
        {!winner && (
          <Card className="p-4 mb-4">
            <Field label="Đặt giá giật của bạn" hint="Số tiền lãi bạn chấp nhận nhường cho các thành viên khác">
              <Input type="number" value={bid} onChange={(e) => setBid(e.target.value)} placeholder="VD: 2000000" />
            </Field>
            <div className="flex gap-2 mt-2">
              {[1000000, 2000000, 3000000].map((v) => (
                <button key={v} onClick={() => setBid(String(v))} className="flex-1 py-2 rounded-lg bg-surface-container text-label-md font-semibold text-on-surface-variant active:scale-95">{vndShort(v)}</button>
              ))}
            </div>
            <Button full className="mt-3" loading={place.isPending} disabled={!bid} onClick={() => place.mutate()} icon="gavel">Đặt giá giật</Button>
          </Card>
        )}

        {/* bids list */}
        <h3 className="font-title-lg text-title-lg text-on-surface mb-2">Danh sách bỏ giá</h3>
        {isLoading ? <Spinner /> : !bids?.length ? (
          <Card className="p-6 text-center text-body-sm text-on-surface-variant">Chưa có ai bỏ giá. Hãy là người đầu tiên!</Card>
        ) : (
          <div className="space-y-2">
            {bids.map((b, i) => (
              <Card key={b.id} className={`p-3.5 flex items-center gap-3 ${b.isWinner ? 'border-secondary bg-secondary/5' : b.isMine ? 'border-tertiary/40' : ''}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-body-sm ${i === 0 ? 'bg-secondary text-white' : 'bg-surface-container text-on-surface-variant'}`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-body-md text-on-surface truncate">Suất {b.slotCode} {b.isMine && <span className="text-tertiary text-label-md">• Bạn</span>}</p>
                  <p className="text-body-sm text-on-surface-variant truncate">{b.ownerName}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-body-md text-on-surface tabular-nums">{vnd(b.bidAmount)}</p>
                  {b.isWinner && <Badge tone="green" icon="emoji_events">Thắng</Badge>}
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card className="p-3 mt-4 bg-tertiary/5 border-tertiary/20 flex gap-2">
          <Icon name="info" size={18} className="text-tertiary flex-shrink-0" />
          <p className="text-body-sm text-on-surface-variant">Chủ hụi sẽ chốt kết quả khi hết thời gian. Sau đó tiền giật được chia lại cho chủ hụi & các thành viên còn lại.</p>
        </Card>
      </div>
    </Screen>
  );
}
