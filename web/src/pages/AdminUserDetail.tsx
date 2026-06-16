import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Badge, Button, Icon, Spinner, Avatar } from '../components/ui';
import { vnd, vndShort, fmtDate, fromNow, HUI_TYPE_LABEL } from '../lib/format';
import { useToast } from '../store/toast';

const TABS = ['Tổng quan', 'Dây hụi', 'Lịch sử đóng', 'Giao dịch', 'Cảnh báo'];
const PST: Record<string, { tone: any; label: string }> = {
  PAID: { tone: 'green', label: 'Đã đóng' }, OVERDUE: { tone: 'red', label: 'Quá hạn' },
  PENDING: { tone: 'amber', label: 'Chờ đóng' }, GUARANTEED_PAID: { tone: 'purple', label: 'BĐ trả thay' },
};
function creditTone(s: number) { return s >= 720 ? 'green' : s >= 640 ? 'blue' : s >= 560 ? 'amber' : 'red'; }

export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);

  const { data: d, isLoading } = useQuery({ queryKey: ['admin-user', id], queryFn: async () => (await api.get(`/admin/users/${id}`)).data });
  const lock = useMutation({
    mutationFn: (locked: boolean) => api.post(`/admin/users/${id}/lock`, { locked }),
    onSuccess: (r) => { toast(r.data.pendingApproval ? 'Đã gửi yêu cầu, chờ admin thứ 2 duyệt (4 mắt)' : 'Đã cập nhật'); qc.invalidateQueries({ queryKey: ['admin-user', id] }); qc.invalidateQueries({ queryKey: ['admin-approvals'] }); },
    onError: (e) => toast(apiError(e), 'red'),
  });

  if (isLoading || !d) return <Screen nav={false}><SubHeader title="Hồ sơ người dùng" /><Spinner /></Screen>;
  const p = d.profile, s = d.stats;

  return (
    <Screen nav={false}>
      <SubHeader title="Hồ sơ người dùng" />
      <div className="px-safe-margin pt-3">
        {/* identity */}
        <Card className="p-5 mb-4">
          <div className="flex items-center gap-4 mb-3">
            <Avatar name={p.fullName} color={p.avatarColor} size={60} />
            <div className="flex-1 min-w-0">
              <h2 className="font-headline-sm text-headline-sm text-on-surface truncate">{p.fullName}</h2>
              <p className="text-body-sm text-on-surface-variant tabular-nums">+84 {p.phone?.slice(1)}</p>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {p.locked ? <Badge tone="red" icon="lock">Đã khóa</Badge> : p.ekycStatus === 'VERIFIED' ? <Badge tone="green" icon="verified">Đã eKYC</Badge> : <Badge tone="amber">Chưa eKYC</Badge>}
                <Badge tone="gray">Tham gia {fmtDate(p.createdAt, 'DD/MM/YYYY')}</Badge>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-outline-variant/15">
            <CreditCell score={p.creditScore} />
            <Mini label="Điểm rủi ro" value={`${s.riskScore}`} tone={s.riskScore >= 50 ? 'error' : undefined} />
            <Mini label="Đóng đúng hạn" value={`${s.onTimeRate}%`} />
          </div>
        </Card>

        {/* tabs */}
        <div className="flex gap-1 bg-surface-container rounded-xl p-1 overflow-x-auto no-scrollbar mb-4">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} className={`flex-1 whitespace-nowrap px-3 py-2 rounded-lg text-label-md font-semibold ${tab === i ? 'bg-white text-secondary shadow-sm' : 'text-on-surface-variant'}`}>{t}</button>
          ))}
        </div>

        {tab === 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <Stat icon="diversity_3" label="Dây tham gia" value={s.groupsJoined} />
              <Stat icon="confirmation_number" label="Suất đang giữ" value={s.slotsHeld} />
              <Stat icon="savings" label="Tổng đã đóng" value={vndShort(s.totalContributed)} />
              <Stat icon="emoji_events" label="Tổng đã hốt" value={vndShort(s.totalHarvested)} />
              <Stat icon="error" label="Nợ quá hạn" value={vnd(s.overdueAmount)} tone={s.overdueAmount > 0 ? 'error' : undefined} />
              <Stat icon="swap_horiz" label="Lần sang suất" value={s.transferCount} />
            </div>
            {p.wallet && (
              <Card className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center"><Icon name="account_balance_wallet" className="text-on-secondary-container" /></div>
                  <div><p className="text-label-md text-on-surface-variant">Số dư ví • {p.wallet.accountNumber}</p><p className="font-semibold text-on-surface tabular-nums">{vnd(p.wallet.available)}</p></div>
                </div>
              </Card>
            )}
            {p.cccd && <InfoRow icon="badge" label="CCCD" value={p.cccd} />}
            {p.address && <InfoRow icon="home" label="Địa chỉ" value={p.address} />}
          </div>
        )}

        {tab === 1 && (
          <div className="space-y-2">
            {d.groups.length === 0 ? <Empty text="Chưa tham gia dây nào" /> : d.groups.map((g: any) => (
              <Card key={g.groupId} className="p-3.5 flex items-center gap-3" onClick={() => navigate(`/organizer/groups/${g.groupId}`)}>
                <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center"><Icon name="diversity_3" className="text-secondary" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-body-md text-on-surface truncate">{g.name}</p>
                  <p className="text-label-md text-on-surface-variant">{HUI_TYPE_LABEL[g.huiType]} • {g.slotCount} suất {g.role === 'ORGANIZER' && '• Chủ hụi'}</p>
                </div>
                <Badge tone={g.status === 'APPROVED' ? 'green' : g.status === 'PENDING' ? 'amber' : 'gray'}>{g.status === 'APPROVED' ? 'Thành viên' : g.status === 'PENDING' ? 'Chờ duyệt' : 'Từ chối'}</Badge>
              </Card>
            ))}
          </div>
        )}

        {tab === 2 && (
          <div className="space-y-2">
            {d.payments.length === 0 ? <Empty text="Chưa có lịch sử đóng" /> : d.payments.map((c: any, i: number) => (
              <Card key={i} className="p-3 flex items-center justify-between">
                <div><p className="text-body-md text-on-surface">{c.groupName}</p><p className="text-label-md text-on-surface-variant">Kỳ {c.cycleNo}{c.paidAt ? ` • ${fmtDate(c.paidAt, 'DD/MM/YYYY')}` : ''}</p></div>
                <div className="text-right"><p className="font-semibold text-body-md text-on-surface tabular-nums">{vnd(c.amount)}</p><Badge tone={PST[c.status]?.tone}>{PST[c.status]?.label}</Badge></div>
              </Card>
            ))}
          </div>
        )}

        {tab === 3 && (
          <div className="space-y-2">
            {d.walletTx.length === 0 ? <Empty text="Chưa có giao dịch" /> : d.walletTx.map((t: any, i: number) => (
              <Card key={i} className="p-3 flex items-center justify-between">
                <div className="min-w-0"><p className="text-body-md text-on-surface truncate">{t.note}</p><p className="text-label-md text-on-surface-variant">{fmtDate(t.createdAt, 'DD/MM HH:mm')}</p></div>
                <p className={`font-semibold text-body-md tabular-nums ${t.direction === 'IN' ? 'text-secondary' : 'text-on-surface'}`}>{t.direction === 'IN' ? '+' : '-'}{vnd(t.amount)}</p>
              </Card>
            ))}
          </div>
        )}

        {tab === 4 && (
          <div className="space-y-2">
            {d.alerts.length === 0 ? <Empty text="Không có cảnh báo nào" /> : d.alerts.map((a: any, i: number) => (
              <Card key={i} className={`p-3.5 ${!a.resolved ? `border-${a.level === 'HIGH' ? 'error' : 'warning'}/30` : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="warning" fill size={18} className={a.level === 'HIGH' ? 'text-error' : 'text-warning'} />
                  <p className="font-semibold text-body-md text-on-surface flex-1">{a.title}</p>
                  {a.resolved && <Badge tone="green">Đã xử lý</Badge>}
                </div>
                <p className="text-body-sm text-on-surface-variant">{a.message}</p>
                <p className="text-label-md text-on-surface-variant/70 mt-1">{fromNow(a.createdAt)}</p>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="px-safe-margin py-4">
        {p.locked
          ? <Button full variant="secondary" icon="lock_open" loading={lock.isPending} onClick={() => lock.mutate(false)}>Yêu cầu mở khóa tài khoản</Button>
          : <Button full variant="danger" icon="lock" loading={lock.isPending} onClick={() => lock.mutate(true)}>Yêu cầu khóa tài khoản</Button>}
        <p className="text-center text-label-md text-on-surface-variant mt-2">Thao tác khóa/mở cần admin thứ 2 phê duyệt (cơ chế 4 mắt)</p>
      </div>
    </Screen>
  );
}

function CreditCell({ score }: { score: number }) {
  return (
    <div className="bg-surface-container-low rounded-xl p-2.5 text-center">
      <p className={`font-bold text-body-md tabular-nums text-${creditTone(score)}`}>{score}</p>
      <p className="text-label-md text-on-surface-variant leading-tight">Điểm uy tín</p>
    </div>
  );
}
function Mini({ label, value, tone }: { label: string; value: any; tone?: string }) {
  return <div className="bg-surface-container-low rounded-xl p-2.5 text-center"><p className={`font-bold text-body-md tabular-nums ${tone ? `text-${tone}` : 'text-on-surface'}`}>{value}</p><p className="text-label-md text-on-surface-variant leading-tight">{label}</p></div>;
}
function Stat({ icon, label, value, tone }: any) {
  return <Card className="p-3"><Icon name={icon} className={`mb-1 text-${tone || 'secondary'}`} size={22} /><p className="font-bold text-title-lg text-on-surface tabular-nums">{value}</p><p className="text-label-md text-on-surface-variant">{label}</p></Card>;
}
function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <Card className="p-3.5 flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center"><Icon name={icon} className="text-secondary" size={20} /></div><div className="flex-1"><p className="text-label-md text-on-surface-variant">{label}</p><p className="text-body-md font-medium text-on-surface">{value}</p></div></Card>;
}
function Empty({ text }: { text: string }) {
  return <p className="text-center text-body-sm text-on-surface-variant py-10">{text}</p>;
}
