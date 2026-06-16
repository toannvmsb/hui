import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Badge, Icon, Spinner, Avatar, Button, ProgressBar } from '../components/ui';
import { vnd, vndShort } from '../lib/format';

export default function OrganizerGroup() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: d, isLoading } = useQuery({ queryKey: ['org-dash', id], queryFn: async () => (await api.get(`/organizer/groups/${id}/dashboard`)).data });

  if (isLoading || !d) return <Screen nav={false}><SubHeader title="Công nợ & thu chi" /><Spinner /></Screen>;

  return (
    <Screen nav={false}>
      <SubHeader title={d.name} right={<button onClick={() => navigate(`/groups/${id}`)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container"><Icon name="open_in_new" className="text-on-surface" size={20} /></button>} />
      <div className="px-safe-margin pt-3">
        {/* cashflow */}
        <div className="bg-primary-container text-white rounded-3xl p-5 mb-4 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-secondary/20 rounded-full blur-2xl" />
          <p className="text-label-md text-white/60">Số dư ví ảo dây hụi</p>
          <p className="font-headline-md text-headline-md mb-3 tabular-nums">{vnd(d.walletBalance)}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 rounded-xl p-3"><p className="text-label-md text-white/60">Đã thu</p><p className="font-semibold text-secondary-fixed tabular-nums">{vndShort(d.summary.collected)}</p></div>
            <div className="bg-white/10 rounded-xl p-3"><p className="text-label-md text-white/60">Còn phải thu</p><p className="font-semibold text-warning tabular-nums">{vndShort(d.summary.outstanding)}</p></div>
            <div className="bg-white/10 rounded-xl p-3"><p className="text-label-md text-white/60">Đã chi trả</p><p className="font-semibold tabular-nums">{vndShort(d.summary.paidOut)}</p></div>
            <div className="bg-white/10 rounded-xl p-3"><p className="text-label-md text-white/60">Tổng giá trị</p><p className="font-semibold tabular-nums">{vndShort(d.summary.totalValue)}</p></div>
          </div>
        </div>

        {/* pending members */}
        {d.pendingMembers.length > 0 && (
          <Card className="p-4 mb-4 border-warning/30">
            <p className="font-title-lg text-title-lg text-on-surface mb-2 flex items-center gap-2"><Icon name="person_add" className="text-warning" />Chờ duyệt ({d.pendingMembers.length})</p>
            {d.pendingMembers.map((m: any) => (
              <div key={m.userId} className="flex items-center gap-3 py-2">
                <Avatar name={m.name} color={m.color} size={36} />
                <div className="flex-1"><p className="text-body-md text-on-surface">{m.name}</p><p className="text-label-md text-on-surface-variant">Uy tín {m.creditScore}</p></div>
              </div>
            ))}
            <Button full variant="secondary" className="mt-2" onClick={() => navigate(`/groups/${id}`)}>Duyệt tại chi tiết dây</Button>
          </Card>
        )}

        {/* debts */}
        <h3 className="font-title-lg text-title-lg text-on-surface mb-2">Công nợ thành viên</h3>
        {d.debts.length === 0 ? (
          <Card className="p-6 text-center"><Icon name="task_alt" size={40} className="text-secondary mb-1" /><p className="text-body-md text-on-surface">Không có công nợ — mọi người đã đóng đủ!</p></Card>
        ) : (
          <div className="space-y-2 mb-4">
            {d.debts.map((dt: any) => (
              <Card key={dt.userId} className="p-3 flex items-center gap-3">
                <Avatar name={dt.name} color={dt.color} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-body-md text-on-surface truncate">{dt.name}</p>
                  <div className="flex gap-2 mt-0.5">
                    {dt.overdue > 0 && <Badge tone="red">Quá hạn {vndShort(dt.overdue)}</Badge>}
                    {dt.pending > 0 && <Badge tone="amber">Chờ đóng {vndShort(dt.pending)}</Badge>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* cycles */}
        <h3 className="font-title-lg text-title-lg text-on-surface mb-2">Tiến độ các kỳ</h3>
        <Card className="p-4 space-y-3">
          {d.cycles.map((c: any) => (
            <div key={c.cycleNo}>
              <div className="flex justify-between text-body-sm mb-1">
                <span className="text-on-surface">Kỳ {c.cycleNo} {c.status === 'PAID' && <span className="text-harvest">• đã chi {vndShort(c.payout)}</span>}</span>
                <span className="text-on-surface-variant">{c.paid}/{c.total}</span>
              </div>
              <ProgressBar value={c.total ? (c.paid / c.total) * 100 : 0} gradient={c.status === 'PAID' ? 'from-harvest to-indigo-400' : 'from-secondary to-secondary-fixed'} />
            </div>
          ))}
        </Card>
      </div>
    </Screen>
  );
}
