import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Icon, Button, Input } from '../components/ui';

const FAQS = [
  { q: 'Hụi sống và hụi chết khác nhau thế nào?', a: 'Hụi chết lĩnh theo thứ tự định sẵn, không đấu giá. Hụi sống cho phép đấu (giật hụi) — ai bỏ giá cao nhất (nhường lãi nhiều nhất) sẽ được hốt kỳ đó.' },
  { q: 'Chế độ "có bảo đảm" hoạt động ra sao?', a: 'Trước khi hốt sớm, hệ thống kiểm tra hạn mức bảo đảm tại đối tác tài chính/cầm đồ. Nếu bạn chậm đóng các kỳ sau, đối tác bảo đảm sẽ trả thay cho dây hụi.' },
  { q: 'Phí dịch vụ gồm những gì?', a: 'Phí cố định: tạo dây (29k/79k), giật hụi (9k/29k), chuyển nhượng suất (9k/29k), rút tiền (10k). Nền tảng KHÔNG thu lãi hay % trên tiền hụi.' },
  { q: 'Tôi có thể chuyển nhượng suất không?', a: 'Có, nếu quy ước dây cho phép. Bạn tạo đề nghị, chủ hụi duyệt, người mua thanh toán — toàn bộ có hợp đồng điện tử lưu vết.' },
  { q: 'Tiền của tôi có an toàn không?', a: 'Mọi giao dịch dùng sổ cái kép (double-entry), có biên nhận điện tử. Tiền đóng hụi nằm ở ví ảo của dây cho tới khi chi trả cho người hốt.' },
];

export default function Support() {
  const navigate = useNavigate();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Screen nav={false}>
      <SubHeader title="Trung tâm hỗ trợ 24/7" />
      <div className="px-safe-margin pt-3">
        <div className="bg-primary-container text-white rounded-3xl p-5 mb-4 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-28 h-28 bg-secondary/30 rounded-full blur-2xl" />
          <Icon name="support_agent" size={36} className="text-secondary-fixed mb-2" />
          <h2 className="font-title-lg text-title-lg mb-1">Chúng tôi luôn sẵn sàng hỗ trợ</h2>
          <p className="text-body-sm text-white/70">Đội ngũ hỗ trợ trực tuyến mọi lúc, mọi nơi.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <Card className="p-4 flex flex-col items-center text-center" onClick={() => {}}>
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-2"><Icon name="chat" className="text-secondary" /></div>
            <p className="font-semibold text-body-md text-on-surface">Chat trực tuyến</p>
            <p className="text-label-md text-on-surface-variant">Phản hồi trong 5 phút</p>
          </Card>
          <a href="tel:1900000000" className="block">
            <Card className="p-4 flex flex-col items-center text-center h-full">
              <div className="w-12 h-12 rounded-full bg-tertiary/10 flex items-center justify-center mb-2"><Icon name="call" className="text-tertiary" /></div>
              <p className="font-semibold text-body-md text-on-surface">Hotline</p>
              <p className="text-label-md text-on-surface-variant">1900 0000</p>
            </Card>
          </a>
        </div>

        <h3 className="font-title-lg text-title-lg text-on-surface mb-2">Câu hỏi thường gặp</h3>
        <div className="space-y-2 mb-5">
          {FAQS.map((f, i) => (
            <Card key={i} className="overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center gap-2 p-4 text-left">
                <Icon name="help" className="text-secondary flex-shrink-0" size={20} />
                <span className="flex-1 font-medium text-body-md text-on-surface">{f.q}</span>
                <Icon name={open === i ? 'expand_less' : 'expand_more'} className="text-on-surface-variant" />
              </button>
              {open === i && <p className="px-4 pb-4 text-body-sm text-on-surface-variant -mt-1">{f.a}</p>}
            </Card>
          ))}
        </div>

        <Card className="p-4 flex items-center gap-3" onClick={() => navigate('/disputes/new')}>
          <Icon name="gavel" className="text-warning" />
          <div className="flex-1"><p className="font-semibold text-body-md text-on-surface">Gửi khiếu nại / tranh chấp</p><p className="text-body-sm text-on-surface-variant">Khi cần xử lý chính thức có lưu vết</p></div>
          <Icon name="chevron_right" className="text-on-surface-variant" />
        </Card>
      </div>
    </Screen>
  );
}
