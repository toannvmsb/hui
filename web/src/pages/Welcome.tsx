import { useNavigate } from 'react-router-dom';
import { Button, Icon } from '../components/ui';

const FEATURES = [
  { icon: 'visibility', title: 'Minh bạch tuyệt đối', desc: 'Mọi kỳ đóng, giật, lĩnh hụi đều có sổ cái & biên nhận điện tử.' },
  { icon: 'verified_user', title: 'An toàn, chống bể hụi', desc: 'Định danh eKYC, chế độ có bảo đảm trả thay khi chậm đóng.' },
  { icon: 'swap_horiz', title: 'Linh hoạt suất hụi', desc: 'Giữ nhiều suất, chuyển nhượng có hợp đồng điện tử.' },
];

export default function Welcome() {
  const navigate = useNavigate();
  return (
    <div className="absolute inset-0 flex flex-col bg-primary-container text-white overflow-y-auto no-scrollbar">
      <div className="absolute -right-20 -top-10 w-64 h-64 bg-secondary/30 rounded-full blur-3xl" />
      <div className="absolute -left-16 top-1/3 w-48 h-48 bg-tertiary/20 rounded-full blur-3xl" />

      <div className="relative flex-1 flex flex-col px-7 pt-16 pb-8">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
            <Icon name="diversity_3" fill size={28} className="text-white" />
          </div>
          <span className="font-headline-sm text-headline-sm">Hụi Thông Minh</span>
        </div>

        <h1 className="font-display-lg text-display-lg leading-tight mb-3">
          Chơi hụi<br />
          <span className="text-secondary-fixed">minh bạch & an toàn</span>
        </h1>
        <p className="text-body-md text-white/70 mb-10 max-w-xs">
          Nền tảng quản lý hụi/họ hiện đại — số hóa toàn bộ dây hụi, kết nối tài chính cộng đồng.
        </p>

        <div className="flex flex-col gap-4 mb-auto">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex items-start gap-4 bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="w-11 h-11 rounded-xl bg-secondary/20 flex items-center justify-center flex-shrink-0">
                <Icon name={f.icon} className="text-secondary-fixed" />
              </div>
              <div>
                <h3 className="font-semibold text-body-md">{f.title}</h3>
                <p className="text-body-sm text-white/60">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-3">
          <Button full variant="primary" className="py-4" onClick={() => navigate('/login')}>
            Bắt đầu ngay
            <Icon name="arrow_forward" size={20} />
          </Button>
          <p className="text-center text-body-sm text-white/50">
            Bằng việc tiếp tục, bạn đồng ý với Điều khoản & Chính sách của nền tảng.
          </p>
        </div>
      </div>
    </div>
  );
}
