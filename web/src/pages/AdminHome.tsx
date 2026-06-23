import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Icon, Badge } from '../components/ui';
import { vnd, vndShort } from '../lib/format';
import { useAuth } from '../store/auth';

export default function AdminHome() {
  const navigate = useNavigate();
  const logout = useAuth((s) => s.logout);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['admin-dash'], queryFn: async () => (await api.get('/admin/dashboard')).data });
  const { data: approvals } = useQuery({ queryKey: ['approvals-count'], queryFn: async () => (await api.get('/admin/approvals/pending-count')).data.count as number, refetchInterval: 15000 });
  const { data: ekycCount } = useQuery({ queryKey: ['ekyc-count'], queryFn: async () => (await api.get('/admin/ekyc/pending-count')).data.count as number, refetchInterval: 15000 });

  // Không bao giờ chặn toàn trang chờ số liệu — luôn hiện được các mục điều hướng.
  const d = data || { gmv: 0, feeRevenue: 0, totalUsers: 0, totalGroups: 0, activeGroups: 0, totalPaidOut: 0, highRiskCount: 0, openDisputes: 0 };

  return (
    <Screen nav={false}>
      <SubHeader title="Admin Console" onBack={() => navigate('/')} right={<button onClick={logout} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container"><Icon name="logout" className="text-on-surface" size={20} /></button>} />
      <div className="px-safe-margin pt-3">
        {isError && (
          <Card className="p-3 mb-3 bg-error/5 border-error/30 flex items-center gap-2">
            <Icon name="error" className="text-error" size={20} />
            <p className="flex-1 text-body-sm text-on-surface">Không tải được số liệu tổng quan.</p>
            <button onClick={() => refetch()} className="text-error text-label-md font-semibold">Thử lại</button>
          </Card>
        )}
        {/* GMV hero */}
        <div className="bg-primary-container text-white rounded-3xl p-5 mb-4 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-secondary/20 rounded-full blur-2xl" />
          <p className="text-label-md text-white/60">Tổng GMV (tiền hụi đã luân chuyển)</p>
          <p className="font-display-lg text-display-lg tabular-nums mb-1">{isLoading ? '…' : vnd(d.gmv, false)}<span className="text-title-lg text-white/60">đ</span></p>
          <div className="flex gap-2 mt-3">
            <div className="bg-secondary/20 rounded-lg px-3 py-1.5"><span className="text-label-md text-white/70">Doanh thu phí: </span><span className="font-semibold text-secondary-fixed">{vnd(d.feeRevenue)}</span></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <Metric icon="group" label="Người dùng" value={d.totalUsers} />
          <Metric icon="diversity_3" label="Dây hụi" value={`${d.activeGroups}/${d.totalGroups}`} sub="đang hoạt động" />
          <Metric icon="payments" label="Đã chi trả" value={vndShort(d.totalPaidOut)} />
          <Metric icon="account_balance" label="Phí thu" value={vndShort(d.feeRevenue)} />
        </div>

        <h3 className="font-title-lg text-title-lg text-on-surface mb-2">Quản lý & phân tích</h3>
        <div className="space-y-2 mb-4">
          <AdminLink icon="leaderboard" label="Phân tích & xếp hạng" desc="Bảng xếp hạng người chơi & dây hụi" to="/admin/analytics" tone="green" />
          <AdminLink icon="group" label="Quản lý người dùng" desc="Hồ sơ 360°, công nợ, khóa/mở" to="/admin/users" tone="green" />
          <AdminLink icon="diversity_3" label="Quản lý dây hụi" desc="Giá trị, người chơi, mức rủi ro" to="/admin/groups" tone="green" />
          <AdminLink icon="badge" label="Duyệt định danh eKYC" desc="Kiểm tra ảnh CCCD, selfie, điểm khớp" to="/admin/ekyc" tone="amber" badge={ekycCount || 0} />
          <AdminLink icon="verified_user" label="Phê duyệt 4 mắt" desc="Thao tác rủi ro cao chờ duyệt" to="/admin/approvals" tone="amber" badge={approvals || 0} />
          <AdminLink icon="tune" label="Tham số điểm uy tín" desc="Điều chỉnh công thức tính điểm" to="/admin/score-config" tone="green" />
          <AdminLink icon="description" label="Trung tâm báo cáo" desc="Xuất Excel / PDF báo cáo vận hành, pháp lý" to="/admin/reports" tone="green" />
        </div>

        <h3 className="font-title-lg text-title-lg text-on-surface mb-2">Quản trị & rủi ro</h3>
        <div className="space-y-2">
          <AdminLink icon="balance" label="Đối soát ví & sổ cái" desc="Kiểm tra cân đối double-entry" to="/admin/reconcile" tone="green" />
          <AdminLink icon="warning" label="Cảnh báo rủi ro" desc={`${d.highRiskCount} cảnh báo mức cao`} to="/admin/risk" tone="red" badge={d.highRiskCount} />
          <AdminLink icon="gavel" label="Kiểm duyệt tranh chấp" desc={`${d.openDisputes} khiếu nại đang mở`} to="/admin/disputes" tone="amber" badge={d.openDisputes} />
        </div>
      </div>
    </Screen>
  );
}

function Metric({ icon, label, value, sub }: { icon: string; label: string; value: any; sub?: string }) {
  return (
    <Card className="p-4">
      <Icon name={icon} className="text-secondary mb-1" size={24} />
      <p className="font-bold text-headline-sm text-on-surface tabular-nums">{value}</p>
      <p className="text-label-md text-on-surface-variant">{label}{sub ? ` (${sub})` : ''}</p>
    </Card>
  );
}
function AdminLink({ icon, label, desc, to, tone, badge }: any) {
  const navigate = useNavigate();
  return (
    <Card className="p-4 flex items-center gap-3" onClick={() => navigate(to)}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-${tone === 'green' ? 'secondary' : tone === 'red' ? 'error' : 'warning'}/10`}>
        <Icon name={icon} className={`text-${tone === 'green' ? 'secondary' : tone === 'red' ? 'error' : 'warning'}`} />
      </div>
      <div className="flex-1"><p className="font-semibold text-body-md text-on-surface">{label}</p><p className="text-body-sm text-on-surface-variant">{desc}</p></div>
      {badge > 0 && <Badge tone={tone === 'red' ? 'red' : 'amber'}>{badge}</Badge>}
      <Icon name="chevron_right" className="text-on-surface-variant" />
    </Card>
  );
}
