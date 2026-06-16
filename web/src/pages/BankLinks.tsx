import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Button, Icon, Input, Field, Sheet, EmptyState } from '../components/ui';
import { useToast } from '../store/toast';

const BANKS = ['Vietcombank', 'Techcombank', 'MB Bank', 'BIDV', 'VietinBank', 'ACB', 'VPBank', 'Sacombank', 'TPBank', 'MoMo', 'ZaloPay'];

export default function BankLinks() {
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ bankName: 'Vietcombank', accountNo: '', accountName: '' });

  const { data: banks } = useQuery({ queryKey: ['banks'], queryFn: async () => (await api.get('/wallet/banks')).data as any[] });
  const add = useMutation({
    mutationFn: () => api.post('/wallet/banks', form),
    onSuccess: () => { toast('Đã liên kết tài khoản'); setOpen(false); setForm({ bankName: 'Vietcombank', accountNo: '', accountName: '' }); qc.invalidateQueries({ queryKey: ['banks'] }); },
    onError: (e) => toast(apiError(e), 'red'),
  });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/wallet/banks/${id}`), onSuccess: () => { toast('Đã xóa'); qc.invalidateQueries({ queryKey: ['banks'] }); } });

  return (
    <Screen nav={false}>
      <SubHeader title="Liên kết ngân hàng / ví" right={<button onClick={() => setOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container"><Icon name="add" className="text-secondary" /></button>} />
      <div className="px-safe-margin pt-3">
        {!banks?.length ? (
          <EmptyState icon="account_balance" title="Chưa liên kết tài khoản" desc="Liên kết ngân hàng hoặc ví để nạp/rút tiền." action={<Button icon="add" onClick={() => setOpen(true)}>Thêm liên kết</Button>} />
        ) : (
          <div className="space-y-2">
            {banks.map((b) => (
              <Card key={b.id} className="p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-secondary-container flex items-center justify-center"><Icon name="account_balance" className="text-on-secondary-container" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-body-md text-on-surface">{b.bankName} {b.isDefault && <span className="text-label-md text-secondary">• Mặc định</span>}</p>
                  <p className="text-body-sm text-on-surface-variant tabular-nums">{b.accountNo}</p>
                  {b.accountName && <p className="text-label-md text-on-surface-variant uppercase">{b.accountName}</p>}
                </div>
                <button onClick={() => del.mutate(b.id)} className="w-9 h-9 rounded-full hover:bg-error/10 flex items-center justify-center"><Icon name="delete" size={20} className="text-error" /></button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Thêm liên kết">
        <div className="space-y-4">
          <Field label="Ngân hàng / Ví">
            <select value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-4 py-3 text-body-md outline-none focus:border-tertiary">
              {BANKS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="Số tài khoản"><Input value={form.accountNo} onChange={(e) => setForm({ ...form, accountNo: e.target.value })} inputMode="numeric" placeholder="0123456789" /></Field>
          <Field label="Tên chủ tài khoản"><Input value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value.toUpperCase() })} placeholder="NGUYEN VAN A" /></Field>
          <Button full loading={add.isPending} disabled={!form.accountNo} onClick={() => add.mutate()}>Liên kết</Button>
        </div>
      </Sheet>
    </Screen>
  );
}
