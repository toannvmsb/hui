import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Screen, TopBar } from '../components/Layout';
import { Icon, Card, Badge, ProgressBar, Avatar, Spinner, Button } from '../components/ui';
import { vnd, vndShort, HUI_TYPE_LABEL, MODE_LABEL } from '../lib/format';
import { useAuth } from '../store/auth';
import { useRequireEkyc } from '../components/EkycGate';

export default function Home() {
  const navigate = useNavigate();
  const me = useAuth((s) => s.me);
  const requireEkyc = useRequireEkyc();
  const createGroup = () => requireEkyc(() => navigate('/groups/new'), '/groups/new');
  const { data: groups, isLoading } = useQuery({ queryKey: ['groups'], queryFn: async () => (await api.get('/groups')).data as any[] });
  const { data: wallet } = useQuery({ queryKey: ['wallet'], queryFn: async () => (await api.get('/wallet')).data });

  const totalPlaying = (groups || []).reduce((s, g) => s + g.amountPerSlot * g.mySlotCount * (g.totalCycles - g.paidCycles), 0);
  const totalDue = (groups || []).reduce((s, g) => s + g.myDue, 0);
  const expectedReceive = (groups || []).reduce((s, g) => s + g.amountPerSlot * (g.totalSlots - 1) * g.mySlotCount, 0);
  const dueGroups = (groups || []).filter((g) => g.myDue > 0);
  const activeCount = (groups || []).filter((g) => g.status === 'ACTIVE').length;

  return (
    <Screen fab={
      <button onClick={createGroup} className="absolute bottom-24 right-5 w-14 h-14 bg-secondary text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform z-40">
        <Icon name="add" size={28} />
      </button>
    }>
      <TopBar />
      <div className="px-safe-margin pt-2">
        {/* eKYC banner */}
        {me && me.ekycStatus !== 'VERIFIED' && (
          <Card className="mt-2 p-4 border-warning/40 bg-warning/5 flex items-center gap-3" onClick={() => navigate('/ekyc')}>
            <div className="w-11 h-11 rounded-xl bg-warning/15 flex items-center justify-center flex-shrink-0"><Icon name="fingerprint" className="text-warning" /></div>
            <div className="flex-1">
              <p className="font-semibold text-body-md text-on-surface">Hoàn tất định danh eKYC</p>
              <p className="text-body-sm text-on-surface-variant">Định danh để tạo & tham gia dây hụi</p>
            </div>
            <Icon name="chevron_right" className="text-on-surface-variant" />
          </Card>
        )}
        {/* Hero */}
        <section className="mt-2">
          <div className="relative overflow-hidden bg-primary-container text-white rounded-3xl p-6 shadow-xl">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-secondary/20 rounded-full blur-3xl" />
            <div className="flex items-center justify-between mb-1">
              <p className="text-label-md text-on-primary-container">Tổng tiền đang chơi</p>
              <Avatar name={me?.fullName || ''} color={me?.avatarColor} size={32} />
            </div>
            <div className="flex items-baseline gap-2 mb-5">
              <h2 className="font-display-lg text-display-lg text-white tabular-nums">{vnd(totalPlaying, false)}</h2>
              <span className="text-title-lg text-white/60">đ</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => dueGroups[0] && navigate(`/groups/${dueGroups[0].id}/contribute`)} className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl text-left active:scale-95 transition-transform">
                <p className="text-label-md text-white/60 mb-1 flex items-center gap-1"><Icon name="arrow_downward" size={14} />Cần đóng</p>
                <p className="text-title-lg font-semibold text-warning tabular-nums">{vnd(totalDue)}</p>
              </button>
              <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl">
                <p className="text-label-md text-white/60 mb-1 flex items-center gap-1"><Icon name="arrow_upward" size={14} />Dự kiến nhận</p>
                <p className="text-title-lg font-semibold text-secondary-fixed tabular-nums">{vndShort(expectedReceive)}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Wallet quick row */}
        <Card className="mt-4 p-4 flex items-center justify-between" onClick={() => navigate('/wallet')}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center">
              <Icon name="account_balance_wallet" className="text-on-secondary-container" />
            </div>
            <div>
              <p className="text-label-md text-on-surface-variant">Số dư ví</p>
              <p className="font-title-lg text-title-lg text-on-surface tabular-nums">{vnd(wallet?.available)}</p>
            </div>
          </div>
          <Button variant="secondary" className="py-2 px-4" onClick={(e) => { e.stopPropagation(); navigate('/wallet/topup'); }}>Nạp tiền</Button>
        </Card>

        {/* Status chips */}
        <section className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <Chip color="bg-secondary" label={`${activeCount} dây đang hoạt động`} />
          {dueGroups.length > 0 && <Chip color="bg-warning" label={`${dueGroups.length} dây tới hạn`} />}
          <Chip color="bg-tertiary" label={`${me?.stats.ownedSlots || 0} suất đang giữ`} />
        </section>

        {/* Quick actions */}
        <section className="mt-5 grid grid-cols-4 gap-2">
          <QuickAction icon="add_circle" label="Tạo dây" onClick={createGroup} />
          <QuickAction icon="travel_explore" label="Khám phá" onClick={() => navigate('/discover')} />
          <QuickAction icon="swap_horiz" label="Sang suất" onClick={() => navigate('/transfers')} />
          <QuickAction icon="shield" label="Bảo đảm" onClick={() => navigate('/guarantee')} />
        </section>

        {/* Due groups */}
        <section className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Dây hụi sắp tới hạn</h3>
            <button className="text-secondary text-label-md font-semibold" onClick={() => navigate('/groups')}>Xem tất cả</button>
          </div>
          {isLoading ? <Spinner /> : (
            <div className="flex flex-col gap-gutter">
              {(groups || []).slice(0, 4).map((g) => <GroupCard key={g.id} g={g} onClick={() => navigate(`/groups/${g.id}`)} onPay={() => navigate(`/groups/${g.id}/contribute`)} />)}
              {groups?.length === 0 && (
                <Card className="p-6 text-center">
                  <p className="text-body-md text-on-surface-variant mb-3">Bạn chưa tham gia dây hụi nào.</p>
                  <Button onClick={() => navigate('/discover')} icon="travel_explore">Khám phá dây hụi</Button>
                </Card>
              )}
            </div>
          )}
        </section>

        {/* Role shortcuts */}
        <section className="mt-6 grid grid-cols-2 gap-3">
          <Card className="p-4" onClick={() => navigate('/organizer')}>
            <Icon name="store" className="text-secondary mb-2" size={28} />
            <p className="font-semibold text-body-md text-on-surface">Quản lý chủ hụi</p>
            <p className="text-body-sm text-on-surface-variant">Dây bạn tổ chức</p>
          </Card>
          <Card className="p-4" onClick={() => navigate('/support')}>
            <Icon name="support_agent" className="text-tertiary mb-2" size={28} />
            <p className="font-semibold text-body-md text-on-surface">Hỗ trợ 24/7</p>
            <p className="text-body-sm text-on-surface-variant">Tổng đài & chat</p>
          </Card>
        </section>
      </div>

    </Screen>
  );
}

function Chip({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex-shrink-0 bg-surface-container-high px-4 py-2.5 rounded-full flex items-center gap-2 border border-outline-variant/30">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-label-md text-on-surface whitespace-nowrap">{label}</span>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
      <div className="w-14 h-14 rounded-2xl bg-white border border-outline-variant/20 shadow-sm flex items-center justify-center">
        <Icon name={icon} className="text-secondary" size={26} />
      </div>
      <span className="text-label-md text-on-surface-variant text-center leading-tight">{label}</span>
    </button>
  );
}

export function GroupCard({ g, onClick, onPay }: { g: any; onClick: () => void; onPay?: () => void }) {
  const tone = g.myDue > 0 ? 'amber' : g.huiType === 'LIVE' ? 'green' : 'blue';
  return (
    <Card glass className="p-4" onClick={onClick}>
      <div className="flex justify-between items-start mb-2.5">
        <div className="min-w-0">
          <h4 className="font-title-lg text-title-lg text-on-surface truncate">{g.name}</h4>
          <p className="text-body-sm text-on-surface-variant">Kỳ {g.currentCycleNo}/{g.totalCycles} • {HUI_TYPE_LABEL[g.huiType]} • {MODE_LABEL[g.mode]}</p>
        </div>
        <Badge tone={tone as any}>{vndShort(g.amountPerSlot)}/suất</Badge>
      </div>
      <ProgressBar value={g.progress} gradient={g.myDue > 0 ? 'from-warning to-amber-200' : 'from-secondary to-secondary-fixed'} className="mb-3" />
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5 text-on-surface-variant">
          <Icon name="confirmation_number" size={16} />
          <span className="text-body-sm">{g.mySlotCount} suất • {g.isOrganizer ? 'Chủ hụi' : 'Thành viên'}</span>
        </div>
        {g.myDue > 0 && onPay ? (
          <button onClick={(e) => { e.stopPropagation(); onPay(); }} className="bg-secondary text-white px-4 py-2 rounded-xl text-label-md font-semibold active:scale-95">
            Đóng {vndShort(g.myDue)}
          </button>
        ) : (
          <span className="text-secondary text-label-md font-semibold flex items-center gap-1"><Icon name="check_circle" size={16} fill />Đã đóng kỳ này</span>
        )}
      </div>
    </Card>
  );
}
