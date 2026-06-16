import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Screen, TopBar } from '../components/Layout';
import { Card, Icon, Spinner, Badge } from '../components/ui';
import { vnd, fmtDate } from '../lib/format';

const TX_META: Record<string, { icon: string; tone: any; label: string }> = {
  TOPUP: { icon: 'add', tone: 'green', label: 'Nạp tiền' },
  WITHDRAW: { icon: 'arrow_outward', tone: 'gray', label: 'Rút tiền' },
  CONTRIBUTION: { icon: 'savings', tone: 'amber', label: 'Đóng hụi' },
  PAYOUT: { icon: 'emoji_events', tone: 'purple', label: 'Hốt hụi' },
  FEE: { icon: 'receipt', tone: 'gray', label: 'Phí dịch vụ' },
  TRANSFER_IN: { icon: 'south_west', tone: 'green', label: 'Nhận tiền' },
  TRANSFER_OUT: { icon: 'north_east', tone: 'gray', label: 'Chuyển tiền' },
  GUARANTEE: { icon: 'shield', tone: 'blue', label: 'Bảo đảm' },
};

export default function Wallet() {
  const navigate = useNavigate();
  const { data: wallet, isLoading } = useQuery({ queryKey: ['wallet'], queryFn: async () => (await api.get('/wallet')).data });
  const { data: txs } = useQuery({ queryKey: ['wallet-tx'], queryFn: async () => (await api.get('/wallet/transactions')).data as any[] });

  return (
    <Screen>
      <TopBar title="Ví của tôi" />
      <div className="px-safe-margin pt-2">
        <div className="bg-gradient-to-br from-secondary to-on-secondary-fixed-variant text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="flex justify-between items-start mb-1">
            <p className="text-label-md text-white/70">Số dư khả dụng</p>
            <Icon name="account_balance_wallet" className="text-white/60" />
          </div>
          {isLoading ? <Spinner /> : (
            <>
              <p className="font-display-lg text-display-lg mb-3 tabular-nums">{vnd(wallet?.available, false)}<span className="text-title-lg text-white/60">đ</span></p>
              {wallet?.blocked > 0 && <p className="text-body-sm text-white/70 mb-2">Đang phong tỏa: {vnd(wallet.blocked)}</p>}
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 w-fit">
                <Icon name="tag" size={16} className="text-white/70" />
                <span className="text-body-sm tabular-nums">{wallet?.accountNumber}</span>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2 mt-4">
          <WalletAct icon="add" label="Nạp tiền" onClick={() => navigate('/wallet/topup')} />
          <WalletAct icon="arrow_outward" label="Rút tiền" onClick={() => navigate('/wallet/withdraw')} />
          <WalletAct icon="account_balance" label="Ngân hàng" onClick={() => navigate('/banks')} />
          <WalletAct icon="receipt_long" label="Lịch sử" onClick={() => navigate('/history')} />
        </div>

        <div className="flex justify-between items-center mt-6 mb-2">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Giao dịch gần đây</h3>
          <button onClick={() => navigate('/history')} className="text-secondary text-label-md font-semibold">Tất cả</button>
        </div>
        <div className="space-y-2">
          {(txs || []).slice(0, 8).map((t) => {
            const m = TX_META[t.type] || TX_META.FEE;
            return (
              <Card key={t.id} className="p-3 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-${m.tone === 'green' ? 'secondary' : m.tone === 'purple' ? 'harvest' : m.tone === 'amber' ? 'warning' : m.tone === 'blue' ? 'tertiary' : 'surface-container-high'}/10`}>
                  <Icon name={m.icon} size={20} className={m.tone === 'green' ? 'text-secondary' : m.tone === 'purple' ? 'text-harvest' : m.tone === 'amber' ? 'text-warning' : m.tone === 'blue' ? 'text-tertiary' : 'text-on-surface-variant'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-body-md text-on-surface truncate">{t.note}</p>
                  <p className="text-label-md text-on-surface-variant">{fmtDate(t.createdAt, 'DD/MM/YYYY HH:mm')}</p>
                </div>
                <p className={`font-semibold text-body-md tabular-nums ${t.direction === 'IN' ? 'text-secondary' : 'text-on-surface'}`}>{t.direction === 'IN' ? '+' : '-'}{vnd(t.amount)}</p>
              </Card>
            );
          })}
          {txs?.length === 0 && <Card className="p-6 text-center text-body-sm text-on-surface-variant">Chưa có giao dịch nào</Card>}
        </div>
      </div>
    </Screen>
  );
}

function WalletAct({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
      <div className="w-13 h-13 w-[52px] h-[52px] rounded-2xl bg-white border border-outline-variant/20 shadow-sm flex items-center justify-center">
        <Icon name={icon} className="text-secondary" size={24} />
      </div>
      <span className="text-label-md text-on-surface-variant">{label}</span>
    </button>
  );
}
