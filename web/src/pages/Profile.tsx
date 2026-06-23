import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Screen, TopBar } from '../components/Layout';
import { Card, Icon, Spinner, Avatar, Badge } from '../components/ui';
import { useAuth } from '../store/auth';

function scoreTone(s: number) { return s >= 750 ? 'green' : s >= 650 ? 'blue' : s >= 550 ? 'amber' : 'red'; }
function scoreLabel(s: number) { return s >= 750 ? 'Xuất sắc' : s >= 650 ? 'Tốt' : s >= 550 ? 'Khá' : 'Cần cải thiện'; }

const MENU = [
  { icon: 'shield', label: 'Hạn mức bảo đảm', to: '/guarantee' },
  { icon: 'account_balance', label: 'Liên kết ngân hàng', to: '/banks' },
  { icon: 'swap_horiz', label: 'Chuyển nhượng suất', to: '/transfers' },
  { icon: 'warning', label: 'Cảnh báo rủi ro', to: '/alerts' },
  { icon: 'gavel', label: 'Khiếu nại / tranh chấp', to: '/disputes' },
  { icon: 'support_agent', label: 'Trung tâm hỗ trợ', to: '/support' },
  { icon: 'admin_panel_settings', label: 'Khu vực quản trị', to: '/admin', adminOnly: true },
];

export default function Profile() {
  const navigate = useNavigate();
  const logout = useAuth((s) => s.logout);
  const me = useAuth((s) => s.me);
  // Stats từ /me/profile chỉ là phần làm giàu — KHÔNG chặn cả trang chờ nó.
  const { data } = useQuery({ queryKey: ['profile'], queryFn: async () => (await api.get('/me/profile')).data, retry: 1 });

  // Luôn dựng hồ sơ từ dữ liệu đăng nhập (me) sẵn có; nâng cấp khi /me/profile về.
  const p = data || (me ? {
    fullName: me.fullName, phone: me.phone, ekycStatus: me.ekycStatus, role: me.role,
    creditScore: me.creditScore, trustRating: me.trustRating, avatarColor: me.avatarColor,
    address: null, cccd: null,
    stats: { groupsJoined: me.stats?.groupsJoined ?? 0, ownedSlots: me.stats?.ownedSlots ?? 0, harvests: 0, onTimeRate: 100, paidOnTime: 0, transfers: 0, overdue: 0 },
  } : null);

  // Chỉ hiện spinner nếu CHƯA có cả me lẫn dữ liệu (gần như không xảy ra do đã qua Protected).
  if (!p) return <Screen><TopBar title="Cá nhân" showNotif={false} /><Spinner /></Screen>;

  const verified = p.ekycStatus === 'VERIFIED';
  const pct = Math.round(((p.creditScore - 300) / 550) * 100);

  return (
    <Screen>
      <TopBar title="Cá nhân" showNotif={false} />
      <div className="px-safe-margin pt-2">
        <Card className="p-5 mb-4">
          <div className="flex items-center gap-4">
            <Avatar name={p.fullName} color={p.avatarColor} size={64} />
            <div className="flex-1 min-w-0">
              <h2 className="font-headline-sm text-headline-sm text-on-surface truncate">{p.fullName}</h2>
              <p className="text-body-sm text-on-surface-variant tabular-nums">+84 {p.phone?.slice(1)}</p>
              {p.ekycStatus === 'VERIFIED' ? <Badge tone="green" icon="verified">Đã định danh</Badge>
                : p.ekycStatus === 'REVIEWING' ? <Badge tone="blue" icon="hourglass_top">Đang chờ duyệt</Badge>
                : p.ekycStatus === 'REJECTED' ? <Badge tone="red" icon="cancel">eKYC bị từ chối</Badge>
                : <Badge tone="amber" icon="error">Chưa định danh</Badge>}
            </div>
          </div>
        </Card>

        {/* eKYC CTA theo trạng thái */}
        {p.ekycStatus === 'REVIEWING' ? (
          <Card className="p-4 mb-4 border-tertiary/40 bg-tertiary/5 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-tertiary/15 flex items-center justify-center flex-shrink-0"><Icon name="hourglass_top" className="text-tertiary" /></div>
            <div className="flex-1"><p className="font-semibold text-body-md text-on-surface">Hồ sơ eKYC đang chờ duyệt</p><p className="text-body-sm text-on-surface-variant">Bộ phận kiểm duyệt đang xác minh, thường trong vài giờ</p></div>
          </Card>
        ) : !verified && (
          <Card className={`p-4 mb-4 flex items-center gap-3 ${p.ekycStatus === 'REJECTED' ? 'border-error/40 bg-error/5' : 'border-warning/40 bg-warning/5'}`} onClick={() => navigate('/ekyc')}>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${p.ekycStatus === 'REJECTED' ? 'bg-error/15' : 'bg-warning/15'}`}><Icon name="fingerprint" className={p.ekycStatus === 'REJECTED' ? 'text-error' : 'text-warning'} /></div>
            <div className="flex-1">
              <p className="font-semibold text-body-md text-on-surface">{p.ekycStatus === 'REJECTED' ? 'eKYC bị từ chối — nộp lại' : 'Hoàn tất định danh eKYC'}</p>
              <p className="text-body-sm text-on-surface-variant">{p.ekycStatus === 'REJECTED' ? 'Chụp lại ảnh rõ nét và nộp hồ sơ mới' : 'Định danh để tạo & tham gia dây hụi, nâng độ tin cậy'}</p>
            </div>
            <Icon name="chevron_right" className="text-on-surface-variant" />
          </Card>
        )}

        {/* Credit score */}
        <Card className="p-5 mb-4">
          <div className="flex justify-between items-center mb-2">
            <p className="font-title-lg text-title-lg text-on-surface">Điểm uy tín</p>
            <Badge tone={scoreTone(p.creditScore) as any}>{scoreLabel(p.creditScore)}</Badge>
          </div>
          <div className="flex items-end gap-2 mb-3">
            <span className="font-display-lg text-display-lg text-secondary tabular-nums">{p.creditScore}</span>
            <span className="text-body-sm text-on-surface-variant mb-2">/ 850</span>
          </div>
          <div className="w-full bg-surface-variant h-2.5 rounded-full overflow-hidden mb-1">
            <div className="h-full bg-gradient-to-r from-error via-warning to-secondary rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-label-md text-on-surface-variant">Tính từ lịch sử đóng hụi đúng hạn, số dây tham gia & hành vi giao dịch.</p>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <Stat icon="group" value={p.stats.groupsJoined} label="Dây tham gia" />
          <Stat icon="confirmation_number" value={p.stats.ownedSlots} label="Suất đang giữ" />
          <Stat icon="emoji_events" value={p.stats.harvests} label="Lần đã hốt" />
          <Stat icon="check_circle" value={`${p.stats.onTimeRate}%`} label="Đóng đúng hạn" />
          <Stat icon="payments" value={p.stats.paidOnTime} label="Kỳ đã đóng" />
          <Stat icon="swap_horiz" value={p.stats.transfers} label="Suất đã nhận" />
        </div>

        {/* Menu */}
        <Card className="overflow-hidden mb-4">
          {MENU.filter((m) => !m.adminOnly || me?.role === 'ADMIN').map((m, i, arr) => (
            <button key={m.to} onClick={() => navigate(m.to)} className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-container active:bg-surface-container-high ${i < arr.length - 1 ? 'border-b border-outline-variant/15' : ''}`}>
              <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center"><Icon name={m.icon} className="text-secondary" size={20} /></div>
              <span className="flex-1 text-left text-body-md text-on-surface">{m.label}</span>
              <Icon name="chevron_right" className="text-on-surface-variant" />
            </button>
          ))}
        </Card>

        <button onClick={logout} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-error/5 text-error font-semibold text-body-md active:scale-[0.98]">
          <Icon name="logout" size={20} />Đăng xuất
        </button>
        <p className="text-center text-label-md text-on-surface-variant mt-4">Hụi Thông Minh v1.0 • Nền tảng quản lý hụi/họ</p>
      </div>
    </Screen>
  );
}

function Stat({ icon, value, label }: { icon: string; value: any; label: string }) {
  return (
    <Card className="p-3 flex flex-col items-center text-center">
      <Icon name={icon} className="text-secondary mb-1" size={22} />
      <p className="font-bold text-title-lg text-on-surface tabular-nums">{value}</p>
      <p className="text-label-md text-on-surface-variant leading-tight">{label}</p>
    </Card>
  );
}
