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

/** Ảnh demo (vẽ canvas) để thử luồng khi không có camera. */
function demoImage(kind: 'front' | 'back' | 'selfie'): string {
  const c = document.createElement('canvas');
  c.width = 520; c.height = 330;
  const x = c.getContext('2d')!;
  if (kind === 'selfie') {
    const g = x.createLinearGradient(0, 0, 0, 330); g.addColorStop(0, '#cbdbf5'); g.addColorStop(1, '#eff4ff');
    x.fillStyle = g; x.fillRect(0, 0, 520, 330);
    x.fillStyle = '#94a3b8'; x.beginPath(); x.arc(260, 140, 70, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(260, 320, 110, Math.PI, 0); x.fill();
    x.fillStyle = '#475569'; x.font = '20px sans-serif'; x.textAlign = 'center'; x.fillText('Ảnh selfie (demo)', 260, 30);
  } else {
    const g = x.createLinearGradient(0, 0, 520, 330);
    g.addColorStop(0, kind === 'front' ? '#006c49' : '#131b2e'); g.addColorStop(1, '#3980f4');
    x.fillStyle = g; x.fillRect(0, 0, 520, 330);
    x.fillStyle = 'rgba(255,255,255,0.95)'; x.font = 'bold 17px sans-serif'; x.textAlign = 'left';
    x.fillText('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 24, 34);
    x.font = 'bold 22px sans-serif'; x.fillStyle = '#ffe08a';
    x.fillText(kind === 'front' ? 'CĂN CƯỚC CÔNG DÂN' : 'MẶT SAU CCCD', 24, 70);
    x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(24, 96, 120, 150);
    x.fillStyle = 'rgba(255,255,255,0.85)'; x.font = '14px sans-serif';
    for (let i = 0; i < 5; i++) x.fillRect(170, 110 + i * 28, 300 - i * 30, 10);
    x.fillText('Ảnh CCCD demo', 170, 300);
  }
  return c.toDataURL('image/jpeg', 0.6);
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
