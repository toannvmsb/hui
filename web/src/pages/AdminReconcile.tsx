import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Icon, Spinner, Badge } from '../components/ui';
import { vnd } from '../lib/format';

const TYPE_LABEL: Record<string, string> = {
  USER_WALLET: 'Ví người dùng', HUI_WALLET: 'Ví ảo dây hụi', PLATFORM_FEE: 'Doanh thu phí',
  BANK_CLEARING: 'Đối soát ngân hàng', GUARANTEE: 'Quỹ bảo đảm', ESCROW: 'Ký quỹ chuyển nhượng',
};

export default function AdminReconcile() {
  const { data: d, isLoading } = useQuery({ queryKey: ['admin-reconcile'], queryFn: async () => (await api.get('/admin/reconciliation')).data });

  if (isLoading || !d) return <Screen nav={false}><SubHeader title="Đối soát" /><Spinner /></Screen>;

  return (
    <Screen nav={false}>
      <SubHeader title="Đối soát ví & sổ cái" />
      <div className="px-safe-margin pt-3">
        <Card className={`p-5 mb-4 ${d.balanced ? 'bg-secondary/5 border-secondary/30' : 'bg-error/5 border-error/30'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${d.balanced ? 'bg-secondary' : 'bg-error'}`}>
              <Icon name={d.balanced ? 'check' : 'priority_high'} className="text-white" size={28} />
            </div>
            <div>
              <p className="font-title-lg text-title-lg text-on-surface">{d.balanced ? 'Sổ cái cân bằng' : 'Sổ cái lệch!'}</p>
              <p className="text-body-sm text-on-surface-variant">Tổng số dư toàn hệ thống: {vnd(d.totalLedger)} (phải = 0)</p>
            </div>
          </div>
        </Card>

        <h3 className="font-title-lg text-title-lg text-on-surface mb-2">Số dư theo loại tài khoản</h3>
        <Card className="divide-y divide-outline-variant/15 mb-4">
          {Object.entries(d.byType).map(([type, bal]: any) => (
            <div key={type} className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2"><Icon name="account_balance_wallet" size={18} className="text-on-surface-variant" /><span className="text-body-md text-on-surface">{TYPE_LABEL[type] || type}</span></div>
              <span className={`font-semibold text-body-md tabular-nums ${bal < 0 ? 'text-error' : 'text-on-surface'}`}>{vnd(bal)}</span>
            </div>
          ))}
        </Card>

        <h3 className="font-title-lg text-title-lg text-on-surface mb-2">Đối soát ví người dùng</h3>
        <Card className="p-4 space-y-2">
          <Row label="Tổng số dư ví (bảng Wallet)" value={vnd(d.walletAvailableSum)} />
          <Row label="Tổng số dư ví (sổ cái)" value={vnd(d.userWalletLedgerSum)} />
          <div className="pt-2 border-t border-outline-variant/15 flex items-center justify-between">
            <span className="text-body-md font-semibold text-on-surface">Khớp đối soát</span>
            {d.walletReconciled ? <Badge tone="green" icon="check">Khớp</Badge> : <Badge tone="red">Lệch</Badge>}
          </div>
        </Card>

        <p className="text-center text-label-md text-on-surface-variant mt-4">{d.accountCount} tài khoản sổ cái • Cập nhật theo thời gian thực</p>
      </div>
    </Screen>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-body-md"><span className="text-on-surface-variant">{label}</span><span className="font-medium text-on-surface tabular-nums">{value}</span></div>;
}
