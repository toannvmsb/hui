import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Icon } from '../components/ui';

export default function VerifySuccess() {
  const navigate = useNavigate();
  const { state } = useLocation() as any;
  const next = state?.next || '/';
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-primary-container text-white px-8 text-center overflow-hidden">
      <div className="absolute -right-20 top-10 w-64 h-64 bg-secondary/30 rounded-full blur-3xl" />
      <div className="relative animate-pop">
        <div className="w-28 h-28 rounded-full bg-secondary flex items-center justify-center mb-8 mx-auto shadow-2xl">
          <Icon name="verified" fill size={64} className="text-white" />
        </div>
      </div>
      <h1 className="font-headline-md text-headline-md mb-2 relative">Xác thực thành công!</h1>
      <p className="text-body-md text-white/70 mb-10 max-w-xs relative">
        Tài khoản của bạn đã được định danh. Giờ bạn có thể tạo dây hụi, tham gia và giao dịch an toàn.
      </p>
      <div className="w-full max-w-xs relative">
        <Button full variant="primary" className="py-4" onClick={() => navigate(next, { replace: true })}>
          {next === '/' ? 'Vào trang chủ' : 'Tiếp tục'}
          <Icon name="arrow_forward" size={20} />
        </Button>
      </div>
    </div>
  );
}
