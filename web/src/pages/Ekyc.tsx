import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, apiError } from '../lib/api';
import { Button, Icon, Input, Field } from '../components/ui';
import { SubHeader } from '../components/Layout';
import { useToast } from '../store/toast';
import { useAuth } from '../store/auth';

const STEPS = ['CCCD mặt trước', 'CCCD mặt sau', 'Selfie đối soát', 'Thông tin'];

export default function Ekyc() {
  const navigate = useNavigate();
  const { state } = useLocation() as any;
  const toast = useToast((s) => s.show);
  const fetchMe = useAuth((s) => s.fetchMe);
  const [step, setStep] = useState(0);
  const [captured, setCaptured] = useState([false, false, false]);
  const [cccd, setCccd] = useState('');
  const [address, setAddress] = useState('');
  const [dob, setDob] = useState('');
  const [loading, setLoading] = useState(false);

  function capture() {
    const next = [...captured];
    next[step] = true;
    setCaptured(next);
    setTimeout(() => setStep((s) => s + 1), 500);
  }

  async function finish() {
    if (cccd.length < 9) return toast('Vui lòng nhập số CCCD', 'red');
    setLoading(true);
    try {
      await api.post('/auth/ekyc', { cccd, address, dob });
      await fetchMe();
      navigate('/verify-success', { replace: true, state: { next: state?.next } });
    } catch (e) {
      toast(apiError(e), 'red');
    } finally {
      setLoading(false);
    }
  }

  const captureIcons = ['id_card', 'id_card', 'face'];
  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <SubHeader title="Định danh điện tử (eKYC)" />
      <div className="flex-1 px-safe-margin pt-4 flex flex-col overflow-y-auto no-scrollbar pb-6">
        {/* Stepper */}
        <div className="flex items-center gap-1 mb-6">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? 'bg-secondary' : 'bg-surface-variant'}`} />
              <span className={`text-[10px] mt-1 block ${i === step ? 'text-secondary font-semibold' : 'text-on-surface-variant'}`}>{s}</span>
            </div>
          ))}
        </div>

        {step < 3 ? (
          <div className="flex-1 flex flex-col">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-1">{STEPS[step]}</h2>
            <p className="text-body-md text-on-surface-variant mb-6">
              {step === 2 ? 'Đưa khuôn mặt vào khung và giữ yên để hệ thống đối soát.' : 'Đặt CCCD trong khung hình, đảm bảo rõ nét, đủ sáng.'}
            </p>
            <div className={`relative aspect-[1.4] ${step === 2 ? 'aspect-square rounded-full max-w-[280px] mx-auto' : 'rounded-3xl'} bg-primary-container/95 flex items-center justify-center overflow-hidden border-4 ${captured[step] ? 'border-secondary' : 'border-dashed border-white/30'}`}>
              {captured[step] ? (
                <div className="text-center text-white animate-pop">
                  <Icon name="check_circle" fill size={64} className="text-secondary-fixed" />
                  <p className="mt-2 font-semibold">Đã chụp thành công</p>
                </div>
              ) : (
                <div className="text-center text-white/50">
                  <Icon name={captureIcons[step]} size={72} />
                  <p className="mt-2 text-body-sm">Khung {step === 2 ? 'khuôn mặt' : 'CCCD'}</p>
                </div>
              )}
              <div className="absolute inset-3 border-2 border-white/40 rounded-2xl pointer-events-none" style={step === 2 ? { borderRadius: '9999px' } : undefined} />
            </div>
            <div className="mt-auto pt-8">
              <Button full icon={captured[step] ? 'check' : 'photo_camera'} onClick={capture} disabled={captured[step]} className="py-4">
                {captured[step] ? 'Đang xử lý...' : 'Chụp ảnh'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-1">Xác nhận thông tin</h2>
            <p className="text-body-md text-on-surface-variant mb-6">Thông tin được trích xuất từ CCCD (mô phỏng). Vui lòng kiểm tra & bổ sung.</p>
            <div className="space-y-4">
              <Field label="Số CCCD"><Input value={cccd} onChange={(e) => setCccd(e.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="0xx xxx xxx xxx" inputMode="numeric" /></Field>
              <Field label="Ngày sinh"><Input value={dob} onChange={(e) => setDob(e.target.value)} placeholder="01/01/1990" /></Field>
              <Field label="Địa chỉ thường trú"><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Quận 1, TP. Hồ Chí Minh" /></Field>
            </div>
            <div className="mt-auto pt-8">
              <Button full loading={loading} onClick={finish} className="py-4">Hoàn tất định danh</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
