import { useRef, useState, useEffect } from 'react';
import { Icon, Button } from './ui';

/** Nén ảnh về tối đa `max` px, JPEG chất lượng `q` → data URL gọn (~50–120KB). */
function downscale(dataUrl: string, max = 800, q = 0.6): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Ảnh demo (vẽ canvas) để thử luồng khi không có camera — chữ rõ để OCR đọc được. */
function demoImage(kind: 'front' | 'back' | 'selfie'): string {
  const W = 660, H = 416;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  if (kind === 'selfie') {
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#cbdbf5'); g.addColorStop(1, '#eff4ff');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = '#94a3b8'; x.beginPath(); x.arc(W / 2, 175, 85, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(W / 2, 400, 130, Math.PI, 0); x.fill();
    x.fillStyle = '#475569'; x.font = '22px sans-serif'; x.textAlign = 'center'; x.fillText('Ảnh selfie (demo)', W / 2, 36);
    return c.toDataURL('image/jpeg', 0.7);
  }
  // Thẻ CCCD nền sáng, chữ đen rõ → Tesseract đọc tốt
  x.fillStyle = '#eef4ee'; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#9fbfa8'; x.lineWidth = 3; x.strokeRect(8, 8, W - 16, H - 16);
  x.textAlign = 'left';
  x.fillStyle = '#9a1b1b'; x.font = 'bold 15px Arial'; x.fillText('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 150, 38);
  x.font = 'italic 13px Arial'; x.fillText('Độc lập - Tự do - Hạnh phúc', 250, 58);
  x.fillStyle = '#0a4ea3'; x.font = 'bold 24px Arial'; x.textAlign = 'center';
  x.fillText(kind === 'front' ? 'CĂN CƯỚC CÔNG DÂN' : 'CĂN CƯỚC CÔNG DÂN (mặt sau)', W / 2, 92);
  x.textAlign = 'left';
  x.fillStyle = '#111';
  if (kind === 'front') {
    // ảnh chân dung
    x.fillStyle = '#cdd6cf'; x.fillRect(28, 110, 150, 190); x.fillStyle = '#8a978d'; x.beginPath(); x.arc(103, 175, 38, 0, Math.PI * 2); x.fill(); x.beginPath(); x.arc(103, 285, 60, Math.PI, 0); x.fill();
    const lines: [string, string][] = [
      ['Số / No.:', '034090012345'],
      ['Họ và tên / Full name:', ''],
      ['', 'NGUYỄN VĂN DEMO'],
      ['Ngày sinh / Date of birth:', '15/08/1990'],
      ['Giới tính / Sex: Nam', 'Quốc tịch: Việt Nam'],
      ['Quê quán / Place of origin:', ''],
      ['', 'Hải Phòng'],
      ['Nơi thường trú / Residence:', ''],
      ['', '123 Lê Lợi, Quận 1, TP. HCM'],
    ];
    let yy = 128; x.font = '17px Arial';
    for (const [lab, val] of lines) {
      x.fillStyle = '#1f3a5f'; x.font = '14px Arial'; if (lab) x.fillText(lab, 200, yy);
      x.fillStyle = '#111'; x.font = 'bold 18px Arial'; if (val) x.fillText(val, lab ? 360 : 200, yy);
      yy += lab && val ? 30 : 26;
    }
  } else {
    x.font = '15px Arial'; x.fillStyle = '#111';
    x.fillText('Đặc điểm nhận dạng: sẹo chấm cách 1cm trên trán', 40, 140);
    x.fillText('Ngày cấp / Date of issue: 20/03/2022', 40, 175);
    x.fillText('Nơi cấp: Cục Cảnh sát QLHC về TTXH', 40, 210);
    x.font = '15px monospace'; x.fillText('IDVNM0340900123454<<<<<<<<<<<<<<<', 40, 300);
    x.fillText('9008152M3203205VNM<<<<<<<<<<<8', 40, 322);
    x.fillText('NGUYEN<<VAN<DEMO<<<<<<<<<<<<<<<', 40, 344);
  }
  return c.toDataURL('image/jpeg', 0.85);
}

interface Props {
  shape?: 'card' | 'circle';
  facing?: 'environment' | 'user';
  demoKind?: 'front' | 'back' | 'selfie';
  hint: string;
  value: string | null;
  onCapture: (dataUrl: string) => void;
}

export function CameraCapture({ shape = 'card', facing = 'environment', demoKind = 'front', hint, value, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [err, setErr] = useState('');
  const streamRef = useRef<MediaStream | null>(null);

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }
  useEffect(() => () => stop(), []);

  async function openCamera() {
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
      streamRef.current = stream;
      setStreaming(true);
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); } }, 50);
    } catch {
      setErr('Không mở được camera. Hãy tải ảnh lên hoặc dùng ảnh demo.');
    }
  }

  async function snap() {
    const v = videoRef.current; if (!v) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    const data = await downscale(c.toDataURL('image/jpeg', 0.8));
    stop();
    onCapture(data);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => onCapture(await downscale(reader.result as string));
    reader.readAsDataURL(f);
  }

  const rounded = shape === 'circle' ? 'rounded-full aspect-square max-w-[280px] mx-auto' : 'rounded-3xl aspect-[1.5]';

  return (
    <div>
      <div className={`relative ${rounded} bg-primary-container overflow-hidden border-4 ${value ? 'border-secondary' : streaming ? 'border-tertiary' : 'border-dashed border-white/30'} flex items-center justify-center`}>
        {value ? (
          <img src={value} className="w-full h-full object-cover animate-fade-in" />
        ) : streaming ? (
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
        ) : (
          <div className="text-center text-white/50 px-4">
            <Icon name={shape === 'circle' ? 'face' : 'id_card'} size={64} />
            <p className="mt-2 text-body-sm">{hint}</p>
          </div>
        )}
        {value && <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-secondary flex items-center justify-center"><Icon name="check" size={18} className="text-white" /></div>}
        <div className="absolute inset-3 border-2 border-white/40 pointer-events-none" style={{ borderRadius: shape === 'circle' ? '9999px' : '1rem' }} />
      </div>

      {err && <p className="text-body-sm text-error mt-2 text-center">{err}</p>}

      <input ref={fileRef} type="file" accept="image/*" capture={facing === 'user' ? 'user' : 'environment'} onChange={onFile} className="hidden" />

      <div className="mt-3 space-y-2">
        {streaming ? (
          <Button full icon="photo_camera" onClick={snap} className="py-3.5">Chụp</Button>
        ) : value ? (
          <Button full variant="secondary" icon="refresh" onClick={() => onCapture('')}>Chụp lại</Button>
        ) : (
          <Button full icon="photo_camera" onClick={openCamera} className="py-3.5">Mở camera</Button>
        )}
        {!value && !streaming && (
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()} className="flex-1 py-2.5 rounded-xl border border-outline-variant/40 text-body-sm font-semibold text-on-surface flex items-center justify-center gap-1.5 active:scale-95"><Icon name="upload" size={18} />Tải ảnh lên</button>
            <button onClick={() => onCapture(demoImage(demoKind))} className="flex-1 py-2.5 rounded-xl border border-outline-variant/40 text-body-sm font-semibold text-on-surface-variant flex items-center justify-center gap-1.5 active:scale-95"><Icon name="image" size={18} />Ảnh demo</button>
          </div>
        )}
        {streaming && <button onClick={stop} className="w-full py-2 text-body-sm text-on-surface-variant">Hủy</button>}
      </div>
    </div>
  );
}

export { demoImage };
