import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Screen, TopBar } from '../components/Layout';
import { Card, Badge, Icon, Spinner, EmptyState, Button } from '../components/ui';
import { vnd, vndShort, HUI_TYPE_LABEL, MODE_LABEL } from '../lib/format';

export default function Slots() {
  const navigate = useNavigate();
  const { data: slots, isLoading } = useQuery({ queryKey: ['my-slots'], queryFn: async () => (await api.get('/slots/me/owned')).data as any[] });

  // group by group
  const byGroup: Record<string, any[]> = {};
  for (const s of slots || []) (byGroup[s.groupName] ||= []).push(s);

  return (
    <Screen>
      <TopBar title="Suất hụi của tôi" />
      <div className="px-safe-margin pt-3">
        <Card className="p-4 mb-4 bg-primary-container text-white flex items-center justify-between">
          <div>
            <p className="text-label-md text-white/60">Tổng số suất đang giữ</p>
            <p className="font-headline-md text-headline-md">{slots?.length || 0} suất</p>
          </div>
          <Button variant="primary" className="py-2 px-4" icon="swap_horiz" onClick={() => navigate('/transfers')}>Chuyển nhượng</Button>
        </Card>

        {isLoading ? <Spinner /> : !slots?.length ? (
          <EmptyState icon="confirmation_number" title="Chưa có suất nào" desc="Tham gia dây hụi để sở hữu suất." action={<Button onClick={() => navigate('/discover')} icon="travel_explore">Khám phá</Button>} />
        ) : (
          Object.entries(byGroup).map(([name, list]) => (
            <div key={name} className="mb-5">
              <p className="font-title-lg text-title-lg text-on-surface mb-2">{name}</p>
              <div className="grid grid-cols-2 gap-2.5">
                {list.map((s) => (
                  <Card key={s.id} className="p-3.5" onClick={() => navigate(`/slots/${s.id}`)}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-title-lg text-on-surface">{s.slotCode}</span>
                      {s.hasDrawn ? <Badge tone="purple">Đã hốt</Badge> : s.lockedReason ? <Badge tone="amber" icon="lock">Khóa</Badge> : <Badge tone="green">Hoạt động</Badge>}
                    </div>
                    <p className="text-body-sm text-on-surface-variant mb-1">{vnd(s.amountPerSlot)}/kỳ</p>
                    <div className="flex gap-1 flex-wrap">
                      <span className="text-label-md text-on-surface-variant">{HUI_TYPE_LABEL[s.huiType]}</span>
                      {s.guaranteeStatus !== 'NONE' && <Icon name="shield" size={14} className="text-harvest" />}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </Screen>
  );
}
