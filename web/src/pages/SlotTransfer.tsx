import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Button, Icon, Input, Field } from '../components/ui';
import { vnd } from '../lib/format';
import { useToast } from '../store/toast';

export default function SlotTransfer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();
  const [buyerType, setBuyerType] = useState('INTERNAL');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [askingPrice, setAskingPrice] = useState('');
  const [note, setNote] = useState('');

  const { data: s } = useQuery({ queryKey: ['slot', id], queryFn: async () => (await api.get(`/slots/${id}`)).data });

  const create = useMutation({
    mutationFn: () => api.post(`/slots/${id}/transfer-request`, { buyerType, buyerPhone: buyerType === 'OPEN_LISTING' ? undefined : buyerPhone, askingPrice: Number(askingPrice), note }),
    onSuccess: () => { toast('Đã tạo đề nghị chuyển nhượng. Chờ chủ hụi duyệt.'); qc.invalidateQueries({ queryKey: ['slot', id] }); qc.invalidateQueries({ queryKey: ['my-transfers'] }); navigate('/transfers'); },
    onError: (e) => toast(apiError(e), 'red'),
  });

  const fee = s?.group.mode === 'SECURED' ? 29000 : 9000;

  return (
    <Screen nav={false}>
      <SubHeader title="Chuyển nhượng suất" />
      <div className="px-safe-margin pt-3 space-y-4">
        {s && (
          <Card className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-secondary-container flex items-center justify-center"><Icon name="confirmation_number" className="text-on-secondary-container" /></div>
            <div><p className="font-semibold text-on-surface">Suất {s.slotCode} • {s.group.name}</p><p className="text-body-sm text-on-surface-variant">Còn {s.remainingObligations} kỳ nghĩa vụ • {vnd(s.group.amountPerSlot)}/kỳ</p></div>
          </Card>
        )}

        <div>
          <p className="text-label-md font-semibold text-on-surface-variant mb-1.5">Hình thức bán</p>
          <div className="grid grid-cols-3 gap-2">
            {[['INTERNAL', 'Trong dây', 'group'], ['EXTERNAL', 'Người ngoài', 'person_add'], ['OPEN_LISTING', 'Đăng bán', 'storefront']].map(([k, l, ic]) => (
              <button key={k} onClick={() => setBuyerType(k)} className={`p-3 rounded-xl border-2 ${buyerType === k ? 'border-secondary bg-secondary/5' : 'border-outline-variant/30'}`}>
                <Icon name={ic} className={buyerType === k ? 'text-secondary' : 'text-on-surface-variant'} size={22} />
                <p className={`text-label-md mt-1 ${buyerType === k ? 'text-secondary font-semibold' : 'text-on-surface'}`}>{l}</p>
              </button>
            ))}
          </div>
        </div>

        {buyerType !== 'OPEN_LISTING' && (
          <Field label="SĐT người mua" hint="Người mua cần có tài khoản & đã eKYC">
            <Input value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="0900000002" inputMode="numeric" />
          </Field>
        )}

        <Field label="Giá bán suất (đồng)">
          <Input type="number" value={askingPrice} onChange={(e) => setAskingPrice(e.target.value)} placeholder="VD: 4000000" />
        </Field>

        <Field label="Ghi chú (tùy chọn)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Lý do chuyển nhượng..." />
        </Field>

        <Card className="p-4 bg-tertiary/5 border-tertiary/20">
          <p className="text-body-sm text-on-surface-variant flex gap-2"><Icon name="info" size={18} className="text-tertiary flex-shrink-0" />Phí chuyển nhượng {vnd(fee)} (người mua chịu). Người mua nhận toàn bộ quyền & nghĩa vụ đóng còn lại của suất. Hợp đồng điện tử được lưu vết.</p>
        </Card>
      </div>
      <div className="px-safe-margin py-4">
        <Button full loading={create.isPending} disabled={!askingPrice || (buyerType !== 'OPEN_LISTING' && !buyerPhone)} onClick={() => create.mutate()}>Tạo đề nghị chuyển nhượng</Button>
      </div>
    </Screen>
  );
}
