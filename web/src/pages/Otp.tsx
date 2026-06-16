import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, apiError } from '../lib/api';
import { Button, Icon } from '../components/ui';
import { SubHeader } from '../components/Layout';
import { useAuth } from '../store/auth';
import { useToast } from '../store/toast';

export default function Otp() {
  const navigate = useNavigate();
  const { state } = useLocation() as any;
  const toast = useToast((s) => s.show);
  const { setToken, fetchMe } = useAuth();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(30);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const phone = state?.phone;

  useEffect(() => {
    if (!phone) navigate('/login');
    refs.current[0]?.focus();
  }, []);
  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  function setDigit(i: number, v: string) {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
    if (next.every((x) => x)) submit(next.join(''));
  }

  async function submit(code: string) {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { phone, otp: code, fullName: state?.fullName });
      setToken(data.token);
      await fetchMe();
      // Đăng ký/đăng nhập đơn giản: cho vào khám phá ngay, eKYC chỉ bắt buộc khi tạo/tham gia dây.
      if (data.user.role === 'ADMIN') navigate('/admin', { replace: true });
      else navigate('/', { replace: true });
    } catch (e) {
      toast(apiError(e), 'red');
      setDigits(['', '', '', '', '', '']);
      refs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <SubHeader title="Xác thực OTP" />
      <div className="flex-1 px-safe-margin pt-6 flex flex-col">
        <div className="w-16 h-16 rounded-2xl bg-secondary-container flex items-center justify-center mb-5">
          <Icon name="sms" className="text-on-secondary-container" size={32} />
        </div>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Nhập mã xác thực</h2>
        <p className="text-body-md text-on-surface-variant mb-2">Mã OTP đã gửi tới <b className="text-on-surface">+84 {phone?.slice(1)}</b></p>
        {state?.devOtp && <p className="text-body-sm text-secondary mb-6">Mã demo: <b>{state.devOtp}</b></p>}

        <div className="flex gap-2 justify-between mb-8 mt-4">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (refs.current[i] = el)}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus(); }}
              inputMode="numeric"
              maxLength={1}
              className="w-12 h-14 text-center text-headline-md font-bold bg-surface-container-low border-2 border-outline-variant/40 rounded-xl outline-none focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 text-on-surface"
            />
          ))}
        </div>

        <div className="text-center">
          {seconds > 0 ? (
            <p className="text-body-sm text-on-surface-variant">Gửi lại mã sau <b className="text-secondary">{seconds}s</b></p>
          ) : (
            <button className="text-body-sm text-secondary font-semibold" onClick={() => { setSeconds(30); toast('Đã gửi lại mã OTP'); }}>Gửi lại mã OTP</button>
          )}
        </div>

        <div className="mt-auto pb-6">
          <Button full loading={loading} onClick={() => submit(digits.join(''))} disabled={digits.some((d) => !d)} className="py-4">Xác thực</Button>
        </div>
      </div>
    </div>
  );
}
