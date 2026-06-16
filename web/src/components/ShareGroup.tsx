import { QRCodeSVG } from 'qrcode.react';
import { Sheet, Button, Icon } from './ui';
import { useToast } from '../store/toast';

export function ShareSheet({ open, onClose, code, name }: { open: boolean; onClose: () => void; code: string; name: string }) {
  const toast = useToast((s) => s.show);
  const link = `${window.location.origin}/join/${code}`;

  async function copy() {
    try { await navigator.clipboard.writeText(link); toast('Đã sao chép link mời'); }
    catch { toast('Không sao chép được', 'red'); }
  }
  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: `Mời tham gia dây hụi ${name}`, text: `Tham gia dây hụi "${name}" trên Hụi Thông Minh (mã ${code})`, url: link }); }
      catch { /* user cancelled */ }
    } else copy();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Mời tham gia dây hụi">
      <p className="text-body-sm text-on-surface-variant mb-4">Chia sẻ link hoặc mã QR bên dưới. Người nhận quét/mở để vào thẳng dây "{name}" và gửi yêu cầu tham gia.</p>

      <div className="flex flex-col items-center mb-5">
        <div className="bg-white p-4 rounded-2xl border border-outline-variant/30 shadow-sm">
          <QRCodeSVG value={link} size={188} level="M" fgColor="#131b2e" />
        </div>
        <div className="mt-3 px-4 py-2 bg-secondary/10 rounded-full">
          <span className="text-title-lg font-bold text-secondary tracking-widest">{code}</span>
        </div>
        <p className="text-label-md text-on-surface-variant mt-1">Mã dây hụi</p>
      </div>

      <div className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-3 mb-3">
        <Icon name="link" size={18} className="text-on-surface-variant flex-shrink-0" />
        <span className="text-body-sm text-on-surface truncate flex-1">{link}</span>
        <button onClick={copy} className="text-secondary text-label-md font-semibold flex-shrink-0 active:scale-95">Sao chép</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" icon="content_copy" onClick={copy}>Sao chép link</Button>
        <Button icon="share" onClick={share}>Chia sẻ</Button>
      </div>
    </Sheet>
  );
}
