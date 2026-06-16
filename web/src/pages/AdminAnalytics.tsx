import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Icon, Spinner, Avatar, Badge, Button } from '../components/ui';
import { vnd, vndShort } from '../lib/format';

const medal = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const { data: d, isLoading } = useQuery({ queryKey: ['admin-analytics'], queryFn: async () => (await api.get('/admin/analytics')).data });

  if (isLoading || !d) return <Screen nav={false}><SubHeader title="Phân tích tổng quan" /><Spinner label="Đang tổng hợp số liệu..." /></Screen>;
  const o = d.overview;

  return (
    <Screen nav={false}>
      <SubHeader title="Phân tích & xếp hạng" />
      <div className="px-safe-margin pt-3">
        {/* overview */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <Stat icon="group" label="Người chơi" value={o.totalUsers} sub={`${o.verifiedUsers} đã eKYC`} />
          <Stat icon="diversity_3" label="Dây hụi" value={`${o.activeGroups}/${o.totalGroups}`} sub="đang hoạt động" />
          <Stat icon="trending_up" label="GMV" value={vndShort(o.gmv)} sub="tiền đã luân chuyển" tone="secondary" />
          <Stat icon="warning" label="Dây rủi ro" value={o.atRiskGroups} sub={`${o.lockedUsers} tài khoản bị khóa`} tone="error" />
        </div>

        {/* user leaderboards */}
        <SectionHeader title="Xếp hạng người chơi" action="Tất cả" onAction={() => navigate('/admin/users')} />
        <Board title="Uy tín cao nhất" icon="workspace_premium" rows={d.users.topCredit} metric={(u: any) => `${u.creditScore} điểm`} onRow={(u:any)=>navigate('/admin/users')} />
        <Board title="Tham gia nhiều dây nhất" icon="diversity_3" rows={d.users.topGroups} metric={(u: any) => `${u.groupsJoined} dây`} onRow={(u:any)=>navigate('/admin/users')} />
        <Board title="Giao dịch nhiều tiền nhất" icon="payments" rows={d.users.topMoney} metric={(u: any) => vndShort(u.throughput)} onRow={(u:any)=>navigate('/admin/users')} />
        <Board title="Rủi ro cao nhất" icon="gpp_maybe" rows={d.users.topRisk} metric={(u: any) => `${u.riskScore}/100`} tone="error" onRow={(u:any)=>navigate('/admin/users')} />

        {/* group leaderboards */}
        <SectionHeader title="Xếp hạng dây hụi" action="Tất cả" onAction={() => navigate('/admin/groups')} />
        <GroupBoard title="Giá trị cao nhất" icon="paid" rows={d.groups.richest} metric={(g: any) => vndShort(g.value)} />
        <GroupBoard title="Giá trị thấp nhất" icon="savings" rows={d.groups.poorest} metric={(g: any) => vndShort(g.value)} />
        <GroupBoard title="Đông người chơi nhất" icon="groups" rows={d.groups.mostMembers} metric={(g: any) => `${g.members} người`} />
        <GroupBoard title="Rủi ro cao nhất" icon="crisis_alert" rows={d.groups.riskiest} metric={(g: any) => `${g.riskScore}/100`} tone="error" />

        <div className="grid grid-cols-2 gap-2 mb-4">
          <Button variant="secondary" icon="group" onClick={() => navigate('/admin/users')}>Quản lý người dùng</Button>
          <Button variant="secondary" icon="diversity_3" onClick={() => navigate('/admin/groups')}>Quản lý dây hụi</Button>
        </div>
      </div>
    </Screen>
  );
}

function Stat({ icon, label, value, sub, tone }: any) {
  return (
    <Card className="p-4">
      <Icon name={icon} className={`mb-1 text-${tone || 'secondary'}`} size={24} />
      <p className={`font-bold text-headline-sm text-on-surface tabular-nums`}>{value}</p>
      <p className="text-label-md text-on-surface-variant">{label}</p>
      {sub && <p className="text-label-md text-on-surface-variant/70">{sub}</p>}
    </Card>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return (
    <div className="flex justify-between items-center mb-2 mt-5">
      <h3 className="font-headline-sm text-headline-sm text-on-surface">{title}</h3>
      <button onClick={onAction} className="text-secondary text-label-md font-semibold">{action}</button>
    </div>
  );
}

function Board({ title, icon, rows, metric, tone, onRow }: any) {
  if (!rows?.length) return null;
  return (
    <Card className="p-3 mb-2.5">
      <div className="flex items-center gap-2 mb-2"><Icon name={icon} size={18} className={`text-${tone || 'secondary'}`} /><p className="font-semibold text-body-md text-on-surface">{title}</p></div>
      <div className="space-y-1.5">
        {rows.map((u: any, i: number) => (
          <div key={u.id} className="flex items-center gap-2.5" onClick={() => onRow?.(u)}>
            <span className="w-5 text-center font-bold text-body-sm tabular-nums" style={{ color: medal[i] || '#76777d' }}>{i + 1}</span>
            <Avatar name={u.fullName} color={u.avatarColor} size={30} />
            <span className="flex-1 text-body-sm text-on-surface truncate">{u.fullName}{u.locked && <Icon name="lock" size={13} className="text-error ml-1" />}</span>
            <span className={`font-semibold text-body-sm tabular-nums text-${tone || 'on-surface'}`}>{metric(u)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function GroupBoard({ title, icon, rows, metric, tone }: any) {
  const navigate = useNavigate();
  if (!rows?.length) return null;
  return (
    <Card className="p-3 mb-2.5">
      <div className="flex items-center gap-2 mb-2"><Icon name={icon} size={18} className={`text-${tone || 'secondary'}`} /><p className="font-semibold text-body-md text-on-surface">{title}</p></div>
      <div className="space-y-1.5">
        {rows.map((g: any, i: number) => (
          <div key={g.id} className="flex items-center gap-2.5" onClick={() => navigate('/admin/groups')}>
            <span className="w-5 text-center font-bold text-body-sm tabular-nums" style={{ color: medal[i] || '#76777d' }}>{i + 1}</span>
            <div className="flex-1 min-w-0"><p className="text-body-sm text-on-surface truncate">{g.name}</p><p className="text-label-md text-on-surface-variant">{g.members} người • {g.totalSlots} suất</p></div>
            <span className={`font-semibold text-body-sm tabular-nums text-${tone || 'on-surface'}`}>{metric(g)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
