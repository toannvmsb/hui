import { useNavigate } from 'react-router-dom';
import { Sheet, Button, Icon } from './ui';
import { useEkycPrompt } from '../store/ekyc';
import { useAuth } from '../store/auth';

/** Hook: chạy hành động nếu đã eKYC, ngược lại mở màn nhắc định danh. */
export function useRequireEkyc() {
  const me = useAuth((s) => s.me);
  const show = useEkycPrompt((s) => s.show);
  return (action: () => void, next?: string) => {
    if (me?.ekycStatus === 'VERIFIED') action();
    else show(next);
  };
}

/** Sheet nhắc định danh, render 1 lần ở App. */
export function EkycPromptSheet() {
  const navigate = useNavigate();
  const { open, next, hide } = useEkycPrompt();
  return (
    <Sheet open={open} onClose={hide} title="Cần định danh eKYC">
      <div className="flex flex-col items-center text-center mb-5">
        <div className="w-20 h-20 rounded-3xl bg-secondary-container flex items-center justify-center mb-4">
          <Icon name="fingerprint" size={44} className="text-on-secondary-container" />
        </div>
        <p className="text-body-md text-on-surface mb-1 font-medium">Xác thực danh tính để tham gia</p>
        <p className="text-body-sm text-on-surface-variant max-w-xs">
          Bạn có thể khám phá ứng dụng tự do. Nhưng để <b>tạo dây hụi, tham gia dây hoặc mua suất</b>, cần hoàn tất định danh eKYC (chụp CCCD + selfie) — đảm bảo an toàn cho cả cộng đồng.
        </p>
      </div>
      <div className="space-y-2">
        <Button full icon="verified_user" onClick={() => { hide(); navigate('/ekyc', { state: { next } }); }} className="py-4">Định danh ngay (2 phút)</Button>
        <Button full variant="ghost" onClick={hide}>Để sau</Button>
      </div>
    </Sheet>
  );
}
