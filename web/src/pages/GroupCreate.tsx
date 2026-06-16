import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Button, Icon, Input, Field } from '../components/ui';
import { vnd, vndShort } from '../lib/format';
import { useToast } from '../store/toast';
import { useAuth } from '../store/auth';
import { useEkycPrompt } from '../store/ekyc';

export default function GroupCreate() {
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();
  const me = useAuth((s) => s.me);
  const showEkyc = useEkycPrompt((s) => s.show);
  // Bảo vệ deep-link: chưa eKYC thì quay lại + mở nhắc định danh
  useEffect(() => {
    if (me && me.ekycStatus !== 'VERIFIED') { navigate('/', { replace: true }); showEkyc('/groups/new'); }
  }, [me]);
  const [f, setF] = useState({
    name: '', huiType: 'LIVE', mode: 'SELF', totalSlots: '10', amountPerSlot: '5000000',
    cycleUnit: 'MONTH', closingDay: '15', bidRule: 'OPEN', mySlots: '1',
    allowExternalTransfer: false, allowTransferAfterDrawn: false,
  });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const create = useMutation({
    mutationFn: () => api.post('/groups', {
      ...f, totalSlots: Number(f.totalSlots), amountPerSlot: Number(f.amountPerSlot),
      totalCycles: Number(f.totalSlots), closingDay: Number(f.closingDay), mySlots: Number(f.mySlots),
    }),
    onSuccess: (r) => { toast('Đã tạo dây hụi! Mời thành viên để kích hoạt.'); qc.invalidateQueries({ queryKey: ['groups'] }); navigate(`/groups/${r.data.id}`, { replace: true }); },
    onError: (e) => toast(apiError(e), 'red'),
  });

  const fee = f.mode === 'SECURED' ? 79000 : 29000;
  const perCycle = Number(f.totalSlots) * Number(f.amountPerSlot);

  return (
    <Screen nav={false}>
      <SubHeader title="Tạo dây hụi mới" />
      <div className="px-safe-margin pt-3 space-y-4">
        <Field label="Tên dây hụi"><Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="VD: Dây hụi Kim Cương" /></Field>

        <div>
          <p className="text-label-md font-semibold text-on-surface-variant mb-1.5">Loại hụi</p>
          <div className="grid grid-cols-2 gap-2">
            <Pick active={f.huiType === 'LIVE'} onClick={() => set('huiType', 'LIVE')} icon="gavel" title="Hụi sống" desc="Đấu giật hụi" />
            <Pick active={f.huiType === 'DEAD'} onClick={() => set('huiType', 'DEAD')} icon="format_list_numbered" title="Hụi chết" desc="Hốt theo thứ tự" />
          </div>
        </div>

        <div>
          <p className="text-label-md font-semibold text-on-surface-variant mb-1.5">Chế độ</p>
          <div className="grid grid-cols-2 gap-2">
            <Pick active={f.mode === 'SELF'} onClick={() => set('mode', 'SELF')} icon="groups" title="Tự quản" desc="Phí 29.000đ" />
            <Pick active={f.mode === 'SECURED'} onClick={() => set('mode', 'SECURED')} icon="shield" title="Có bảo đảm" desc="Phí 79.000đ" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Số suất"><Input type="number" value={f.totalSlots} onChange={(e) => set('totalSlots', e.target.value)} /></Field>
          <Field label="Tôi giữ (suất)"><Input type="number" value={f.mySlots} onChange={(e) => set('mySlots', e.target.value)} /></Field>
        </div>

        <Field label="Giá trị mỗi suất / kỳ" hint={`= ${vndShort(Number(f.amountPerSlot))}`}>
          <Input type="number" value={f.amountPerSlot} onChange={(e) => set('amountPerSlot', e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-label-md font-semibold text-on-surface-variant mb-1.5">Chu kỳ</p>
            <div className="flex gap-1 bg-surface-container rounded-xl p-1">
              {[['DAY', 'Ngày'], ['WEEK', 'Tuần'], ['MONTH', 'Tháng']].map(([k, l]) => (
                <button key={k} onClick={() => set('cycleUnit', k)} className={`flex-1 py-2 rounded-lg text-label-md font-semibold ${f.cycleUnit === k ? 'bg-white text-secondary shadow-sm' : 'text-on-surface-variant'}`}>{l}</button>
              ))}
            </div>
          </div>
          <Field label="Ngày chốt"><Input type="number" value={f.closingDay} onChange={(e) => set('closingDay', e.target.value)} /></Field>
        </div>

        {f.huiType === 'LIVE' && (
          <div>
            <p className="text-label-md font-semibold text-on-surface-variant mb-1.5">Hình thức đấu</p>
            <div className="grid grid-cols-2 gap-2">
              <Pick active={f.bidRule === 'OPEN'} onClick={() => set('bidRule', 'OPEN')} icon="visibility" title="Đấu công khai" desc="Thấy giá người khác" />
              <Pick active={f.bidRule === 'SEALED'} onClick={() => set('bidRule', 'SEALED')} icon="visibility_off" title="Đấu kín" desc="Giá được giấu" />
            </div>
          </div>
        )}

        <Card className="p-4 space-y-3">
          <Toggle label="Cho phép người ngoài mua suất" checked={f.allowExternalTransfer} onChange={(v) => set('allowExternalTransfer', v)} />
          <Toggle label="Cho chuyển nhượng cả suất đã hốt" checked={f.allowTransferAfterDrawn} onChange={(v) => set('allowTransferAfterDrawn', v)} />
        </Card>

        <Card className="p-4 bg-secondary/5 border-secondary/20">
          <div className="flex justify-between text-body-sm mb-1"><span className="text-on-surface-variant">Mỗi kỳ thu về quỹ</span><span className="font-semibold text-on-surface tabular-nums">{vnd(perCycle)}</span></div>
          <div className="flex justify-between text-body-sm mb-1"><span className="text-on-surface-variant">Tổng giá trị dây</span><span className="font-semibold text-on-surface tabular-nums">{vnd(perCycle * Number(f.totalSlots))}</span></div>
          <div className="flex justify-between text-body-sm"><span className="text-on-surface-variant">Phí tạo dây (thu khi kích hoạt)</span><span className="font-semibold text-secondary tabular-nums">{vnd(fee)}</span></div>
        </Card>
      </div>
      <div className="px-safe-margin py-4">
        <Button full loading={create.isPending} onClick={() => create.mutate()} className="py-4">Tạo dây hụi</Button>
      </div>
    </Screen>
  );
}

function Pick({ active, onClick, icon, title, desc }: any) {
  return (
    <button onClick={onClick} className={`p-3 rounded-xl border-2 text-left transition-all ${active ? 'border-secondary bg-secondary/5' : 'border-outline-variant/30 bg-white'}`}>
      <Icon name={icon} className={active ? 'text-secondary' : 'text-on-surface-variant'} size={24} />
      <p className={`font-semibold text-body-sm mt-1 ${active ? 'text-secondary' : 'text-on-surface'}`}>{title}</p>
      <p className="text-label-md text-on-surface-variant">{desc}</p>
    </button>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center justify-between w-full">
      <span className="text-body-sm text-on-surface text-left">{label}</span>
      <span className={`w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0 ${checked ? 'bg-secondary' : 'bg-surface-variant'}`}>
        <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );
}
