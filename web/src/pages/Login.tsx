import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiError } from '../lib/api';
import { Button, Icon, Input, Field } from '../components/ui';
import { SubHeader } from '../components/Layout';
import { useToast } from '../store/toast';

export default function Login() {
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [isNew, setIsNew] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!/^0\d{9}$/.test(phone)) return toast('Số điện thoại không hợp lệ', 'red');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/request-otp', { phone });
      if (data.isNewUser && isNew === null) {
        setIsNew(true);
        setLoading(false);
        return; // ask for name first
      }
      navigate('/otp', { state: { phone, fullName, devOtp: data.devOtp } });
    } catch (e) {
      toast(apiError(e), 'red');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <SubHeader title="Đăng nhập / Đăng ký" onBack={() => navigate('/welcome')} />
      <div className="flex-1 px-safe-margin pt-6 flex flex-col">
        <div className="w-16 h-16 rounded-2xl bg-secondary-container flex items-center justify-center mb-5">
          <Icon name="smartphone" className="text-on-secondary-container" size={32} />
        </div>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Nhập số điện thoại</h2>
        <p className="text-body-md text-on-surface-variant mb-7">Chúng tôi sẽ gửi mã OTP để xác thực tài khoản của bạn.</p>

        <div className="space-y-4">
          <Field label="Số điện thoại">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-body-md text-on-surface-variant font-medium">+84</span>
              <Input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="0900 000 001" inputMode="numeric" className="pl-14 text-body-md tracking-wide" />
            </div>
          </Field>
          {isNew && (
            <Field label="Họ và tên" hint="Tài khoản mới — vui lòng cho biết tên của bạn">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyễn Văn A" />
            </Field>
          )}
        </div>

        <div className="mt-auto pb-6 space-y-3">
          <div className="bg-tertiary/5 border border-tertiary/20 rounded-xl p-3 flex gap-2 items-start">
            <Icon name="info" size={18} className="text-tertiary mt-0.5" />
            <p className="text-body-sm text-on-surface-variant">Tài khoản demo: <b>0900000001</b> (người chơi) hoặc <b>0911111111</b> (admin). Mã OTP luôn là <b>123456</b>.</p>
          </div>
          <Button full loading={loading} onClick={submit} className="py-4">Tiếp tục</Button>
        </div>
      </div>
    </div>
  );
}
