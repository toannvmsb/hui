import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Button, Icon, Input } from '../components/ui';
import { vnd, vndShort } from '../lib/format';
import { useToast } from '../store/toast';

const PRESETS = [500000, 1000000, 2000000, 5000000, 10000000, 20000000];
const WITHDRAW_FEE = 10000;

export default function WalletAction() {
  const { action } = useParams();
  const isTopup = action === 'topup';
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();
  const [amount, setAmount] = useState(0);

  const { data: wallet } = useQuery({ queryKey: ['wallet'], queryFn: async () => (await api.get('/wallet')).data });
  const { data: banks } = useQuery({ queryKey: ['banks'], queryFn: async () => (await api.get('/wallet/banks')).data as any[] });

  const mut = useMutation({
    mutationFn: () => api.post(`/wallet/${isTopup ? 'topup' : 'withdraw'}`, { amount }),
    onSuccess: () => {
      toast(isTopup ? `Đã nạp ${vnd(amount)}` : `Đã rút ${vnd(amount)}`);
      qc.invalidateQueries({ queryKey: ['wallet'] }); qc.invalidateQueries({ queryKey: ['wallet-tx'] });
      navigate('/wallet');
    },
    onError: (e) => toast(apiError(e), 'red'),
  });

  const maxWithdraw = (wallet?.available || 0) - WITHDRAW_FEE;
  const invalid = amount <= 0 || (!isTopup && amount > maxWithdraw);
  const defaultBank = banks?.find((b) => b.isDefault) || banks?.[0];

  return (
    <Screen nav={false}>
      <SubHeader title={isTopup ? 'Nạp tiền vào ví' : 'Rút tiền về ngân hàng'} />
      <div className="px-safe-margin pt-3">
        <Card className="p-5 mb-4 text-center">
          <p className="text-label-md text-on-surface-variant mb-1">Số dư hiện tại</p>
          <p className="font-headline-md text-headline-md text-on-surface tabular-nums">{vnd(wallet?.available)}</p>
        </Card>

        <p className="text-label-md font-semibold text-on-surface-variant mb-2">{isTopup ? 'Số tiền nạp' : 'Số tiền rút'}</p>
        <div className="relative mb-3">
          <Input type="number" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} placeholder="0" className="text-headline-sm font-bold pr-10 text-right" />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-title-lg text-on-surface-variant">đ</span>
        </div>
        {amount > 0 && <p className="text-body-sm text-secondary mb-3 text-right">{vndShort(amount)}</p>}

        <div className="grid grid-cols-3 gap-2 mb-5">
          {PRESETS.map((p) => (
            <button key={p} onClick={() => setAmount(p)} className={`py-2.5 rounded-xl text-label-md font-semibold border transition-colors ${amount === p ? 'bg-secondary text-white border-secondary' : 'bg-white border-outline-variant/30 text-on-surface'}`}>{vndShort(p)}</button>
          ))}
        </div>

        {isTopup ? (
          <Card className="p-4 bg-tertiary/5 border-tertiary/20 flex gap-2">
            <Icon name="info" size={18} className="text-tertiary flex-shrink-0" />
            <p className="text-body-sm text-on-surface-variant">Môi trường demo: tiền được nạp tức thì qua cổng thanh toán mô phỏng (không tính phí nạp).</p>
          </Card>
        ) : (
          <>
            <Card className="p-4 mb-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center"><Icon name="account_balance" className="text-on-secondary-container" /></div>
              <div className="flex-1">
                {defaultBank ? <><p className="font-semibold text-body-md text-on-surface">{defaultBank.bankName}</p><p className="text-body-sm text-on-surface-variant tabular-nums">{defaultBank.accountNo}</p></> : <p className="text-body-sm text-on-surface-variant">Chưa liên kết ngân hàng</p>}
              </div>
              <button onClick={() => navigate('/banks')} className="text-secondary text-label-md font-semibold">Đổi</button>
            </Card>
            <div className="flex justify-between text-body-sm px-1 mb-1"><span className="text-on-surface-variant">Phí rút tiền</span><span className="text-on-surface tabular-nums">{vnd(WITHDRAW_FEE)}</span></div>
            <div className="flex justify-between text-body-sm px-1"><span className="text-on-surface-variant">Thực nhận</span><span className="font-semibold text-secondary tabular-nums">{vnd(Math.max(0, amount))}</span></div>
          </>
        )}
      </div>
      <div className="px-safe-margin py-4">
        <Button full disabled={invalid || (!isTopup && !defaultBank)} loading={mut.isPending} onClick={() => mut.mutate()} className="py-4">
          {isTopup ? `Nạp ${amount ? vnd(amount) : 'tiền'}` : `Rút ${amount ? vnd(amount) : 'tiền'}`}
        </Button>
      </div>
    </Screen>
  );
}
