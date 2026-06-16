import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Icon, Spinner, EmptyState } from '../components/ui';
import { vnd, fmtDate } from '../lib/format';

const TX_META: Record<string, { icon: string; color: string; label: string }> = {
  TOPUP: { icon: 'add', color: 'secondary', label: 'Nạp tiền' },
  WITHDRAW: { icon: 'arrow_outward', color: 'on-surface-variant', label: 'Rút tiền' },
  CONTRIBUTION: { icon: 'savings', color: 'warning', label: 'Đóng hụi' },
  PAYOUT: { icon: 'emoji_events', color: 'harvest', label: 'Hốt hụi' },
  FEE: { icon: 'receipt', color: 'on-surface-variant', label: 'Phí dịch vụ' },
  TRANSFER_IN: { icon: 'south_west', color: 'secondary', label: 'Nhận tiền' },
  TRANSFER_OUT: { icon: 'north_east', color: 'on-surface-variant', label: 'Chuyển tiền' },
  GUARANTEE: { icon: 'shield', color: 'tertiary', label: 'Bảo đảm' },
};
const FILTERS = [['all', 'Tất cả'], ['IN', 'Tiền vào'], ['OUT', 'Tiền ra']];

export default function History() {
  const [filter, setFilter] = useState('all');
  const { data: txs, isLoading } = useQuery({ queryKey: ['wallet-tx'], queryFn: async () => (await api.get('/wallet/transactions')).data as any[] });
  const items = (txs || []).filter((t) => filter === 'all' || t.direction === filter);

  // group by date
  const groups: Record<string, any[]> = {};
  for (const t of items) { const k = fmtDate(t.createdAt); (groups[k] ||= []).push(t); }

  return (
    <Screen nav={false}>
      <SubHeader title="Lịch sử giao dịch" />
      <div className="px-safe-margin pt-3">
        <div className="flex gap-2 mb-4">
          {FILTERS.map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`px-4 py-2 rounded-full text-label-md font-semibold ${filter === k ? 'bg-secondary text-white' : 'bg-surface-container-high text-on-surface-variant'}`}>{l}</button>
          ))}
        </div>
        {isLoading ? <Spinner /> : items.length === 0 ? <EmptyState icon="receipt_long" title="Chưa có giao dịch" /> : (
          Object.entries(groups).map(([date, list]) => (
            <div key={date} className="mb-4">
              <p className="text-label-md font-semibold text-on-surface-variant mb-2">{date}</p>
              <div className="space-y-2">
                {list.map((t) => {
                  const m = TX_META[t.type] || TX_META.FEE;
                  return (
                    <Card key={t.id} className="p-3 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-${m.color}/10`}>
                        <Icon name={m.icon} size={20} className={`text-${m.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-body-md text-on-surface truncate">{t.note}</p>
                        <p className="text-label-md text-on-surface-variant">{m.label} • {fmtDate(t.createdAt, 'HH:mm')}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold text-body-md tabular-nums ${t.direction === 'IN' ? 'text-secondary' : 'text-on-surface'}`}>{t.direction === 'IN' ? '+' : '-'}{vnd(t.amount)}</p>
                        <p className="text-label-md text-on-surface-variant tabular-nums">SD {vnd(t.balanceAfter)}</p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </Screen>
  );
}
