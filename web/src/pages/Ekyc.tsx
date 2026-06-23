import { useState, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, apiError } from '../lib/api';
import { Button, Icon, Input, Field, Card, Spinner } from '../components/ui';
import { SubHeader } from '../components/Layout';
import { CameraCapture } from '../components/CameraCapture';
import { useToast } from '../store/toast';
import { useAuth } from '../store/auth';

// Tải MediaPipe (nặng) theo nhu cầu — chỉ khi tới bước xác thực khuôn mặt.
const LivenessCheck = lazy(() => import('../components/LivenessCheck').then((m) => ({ default: m.LivenessCheck })));

const STEPS = ['CCCD trước', 'CCCD sau', 'Selfie', 'Xác nhận'];

export default function Ekyc() {
  const navigate = useNavigate();
  const { state } = useLocation() as any;
  const toast = useToast((s) => s.show);
  const fetchMe = useAuth((s) => s.fetchMe);

  const [step, setStep] = useState(0);
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [livenessMode, setLivenessMode] = useState(true);
  const [liveness, setLiveness] = useState<{ score: number | null; method: string; challenges: string[] } | null>(null);
  const [ocr, setOcr] = useState<any>(null);
  const [ocring, setOcring] = useState(false);
  const [form, setForm] = useState<any>({ cccd: '', fullName: '', dob: '', gender: '', hometown: '', address: '', issueDate: '', issuePlace: '' });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Sau khi chụp mặt trước → OCR trích xuất
  async function captureFront(data: string) {
    setFront(data || null);
    if (data && !ocr) {
      setOcring(true);
      try {
        const { data: ex } = await api.post('/auth/ekyc/ocr', { frontImage: data });
        setOcr(ex);
        setForm({ cccd: ex.cccd, fullName: ex.fullName, dob: ex.dob, gender: ex.gender, hometown: ex.hometown, address: ex.address, issueDate: ex.issueDate, issuePlace: ex.issuePlace });
      } catch (e) { toast(apiError(e), 'red'); }
      finally { setOcring(false); }
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/ekyc/submit', {
        ...form, ocrConfidence: ocr?.ocrConfidence, frontImage: front, backImage: back, selfieImage: selfie,
        clientLivenessScore: liveness?.score, livenessMethod: liveness?.method, livenessChallenges: liveness?.challenges,
      });
      setResult(data);
      await fetchMe();
    } catch (e) { toast(apiError(e), 'red'); setSubmitting(false); }
  }

  // Màn kết quả đối chiếu
  if (result) return <ResultScreen result={result} onDone={() => navigate(result.autoVerified ? (state?.next || '/') : '/', { replace: true })} />;

  const canNext = step === 0 ? !!front && !ocring : step === 1 ? !!back : step === 2 ? !!selfie : true;

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <SubHeader title="Định danh điện tử (eKYC)" />
      <div className="flex-1 px-safe-margin pt-4 flex flex-col overflow-y-auto no-scrollbar pb-6">
        {/* Stepper */}
        <div className="flex items-center gap-1 mb-5">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? 'bg-secondary' : 'bg-surface-variant'}`} />
              <span className={`text-[10px] mt-1 block ${i === step ? 'text-secondary font-semibold' : 'text-on-surface-variant'}`}>{s}</span>
            </div>
          ))}
        </div>

        {step === 0 && (
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-1">Chụp CCCD mặt trước</h2>
            <p className="text-body-md text-on-surface-variant mb-5">Đặt CCCD trong khung, rõ nét, đủ sáng, không lóa.</p>
            <CameraCapture shape="card" facing="environment" demoKind="front" hint="Khung CCCD mặt trước" value={front} onCapture={captureFront} />
            {ocring && <Card className="p-3 mt-3 flex items-center gap-2 bg-tertiary/5 border-tertiary/20"><Icon name="document_scanner" className="text-tertiary animate-pulse" /><p className="text-body-sm text-on-surface-variant">Đang đọc thông tin từ CCCD…</p></Card>}
            {ocr && !ocring && <Card className="p-3 mt-3 bg-secondary/5 border-secondary/20 flex items-center gap-2"><Icon name="check_circle" className="text-secondary" fill /><p className="text-body-sm text-on-surface">Đã trích xuất thông tin (độ chính xác {ocr.ocrConfidence}%)</p></Card>}
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-1">Chụp CCCD mặt sau</h2>
            <p className="text-body-md text-on-surface-variant mb-5">Chụp mặt sau có mã & đặc điểm nhận dạng.</p>
            <CameraCapture shape="card" facing="environment" demoKind="back" hint="Khung CCCD mặt sau" value={back} onCapture={(d) => setBack(d || null)} />
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-1">Xác thực khuôn mặt (liveness)</h2>
            <p className="text-body-md text-on-surface-variant mb-5">{livenessMode && !selfie ? 'Làm theo các thử thách để chứng minh bạn là người thật, không phải ảnh chụp.' : 'Đưa khuôn mặt vào khung tròn, đủ sáng.'}</p>
            {selfie ? (
              <div>
                <div className="relative aspect-square max-w-[280px] mx-auto rounded-full overflow-hidden border-4 border-secondary">
                  <img src={selfie} className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-secondary flex items-center justify-center"><Icon name="check" size={18} className="text-white" /></div>
                </div>
                {liveness?.method === 'active-challenge' && (
                  <Card className="p-3 mt-3 bg-secondary/5 border-secondary/20 flex items-center gap-2"><Icon name="verified_user" className="text-secondary" fill /><p className="text-body-sm text-on-surface">Đã vượt {liveness.challenges.length} thử thách liveness ({liveness.score}%)</p></Card>
                )}
                <Button full variant="secondary" icon="refresh" className="mt-3" onClick={() => { setSelfie(null); setLiveness(null); }}>Làm lại</Button>
              </div>
            ) : livenessMode ? (
              <Suspense fallback={<Spinner label="Đang tải xác thực khuôn mặt…" />}>
                <LivenessCheck
                  onComplete={(r) => { setSelfie(r.selfieImage); setLiveness({ score: r.livenessScore, method: 'active-challenge', challenges: r.challenges }); }}
                  onFallback={() => setLivenessMode(false)}
                />
              </Suspense>
            ) : (
              <CameraCapture shape="circle" facing="user" demoKind="selfie" hint="Khung khuôn mặt" value={selfie} onCapture={(d) => { setSelfie(d || null); setLiveness(d ? { score: null, method: 'none', challenges: [] } : null); }} />
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-1">Xác nhận thông tin</h2>
            <p className="text-body-md text-on-surface-variant mb-4">Kiểm tra thông tin đọc từ CCCD, chỉnh sửa nếu sai.</p>
            <div className="flex gap-2 mb-4">
              {[front, back, selfie].map((img, i) => img && <img key={i} src={img} className={`h-16 ${i === 2 ? 'w-16 rounded-full' : 'w-24 rounded-lg'} object-cover border border-outline-variant/30`} />)}
            </div>
            <div className="space-y-3">
              <Field label="Số CCCD"><Input value={form.cccd} onChange={(e) => setForm({ ...form, cccd: e.target.value })} inputMode="numeric" /></Field>
              <Field label="Họ và tên"><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ngày sinh"><Input value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></Field>
                <Field label="Giới tính"><Input value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} /></Field>
              </div>
              <Field label="Quê quán"><Input value={form.hometown} onChange={(e) => setForm({ ...form, hometown: e.target.value })} /></Field>
              <Field label="Nơi thường trú"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            </div>
          </div>
        )}

        <div className="mt-auto pt-6">
          {step < 3 ? (
            <Button full disabled={!canNext} onClick={() => setStep(step + 1)} className="py-4">Tiếp tục</Button>
          ) : (
            <Button full loading={submitting} onClick={submit} icon="verified_user" className="py-4">Hoàn tất & đối chiếu</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultScreen({ result, onDone }: { result: any; onDone: () => void }) {
  const ok = result.autoVerified;
  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center px-8 text-center ${ok ? 'bg-primary-container text-white' : 'bg-background'}`}>
      {ok && <div className="absolute -right-20 top-10 w-64 h-64 bg-secondary/30 rounded-full blur-3xl" />}
      <div className="relative animate-pop">
        <div className={`w-28 h-28 rounded-full flex items-center justify-center mb-6 mx-auto shadow-2xl ${ok ? 'bg-secondary' : 'bg-warning'}`}>
          <Icon name={ok ? 'verified' : 'hourglass_top'} fill size={64} className="text-white" />
        </div>
      </div>
      <h1 className={`font-headline-md text-headline-md mb-2 relative ${ok ? '' : 'text-on-surface'}`}>{ok ? 'Xác thực thành công!' : 'Đã nộp hồ sơ eKYC'}</h1>
      <p className={`text-body-md mb-6 max-w-xs relative ${ok ? 'text-white/70' : 'text-on-surface-variant'}`}>
        {ok ? 'Danh tính của bạn đã được xác minh. Giờ bạn có thể tạo & tham gia dây hụi.' : 'Điểm khớp chưa đạt ngưỡng tự động — hồ sơ chuyển bộ phận duyệt thủ công, thường trong vài giờ.'}
      </p>
      {/* score card */}
      <div className={`relative w-full max-w-xs rounded-2xl p-4 mb-8 ${ok ? 'bg-white/10' : 'bg-white border border-outline-variant/20'}`}>
        <ScoreRow label="Khớp khuôn mặt" value={result.faceMatchScore} threshold={result.faceThreshold} ok={ok} dark={ok} />
        <ScoreRow label="Kiểm tra liveness" value={result.livenessScore} threshold={result.liveThreshold} ok={ok} dark={ok} />
      </div>
      <div className="w-full max-w-xs relative">
        <Button full variant={ok ? 'primary' : 'primary'} className="py-4" onClick={onDone}>
          {ok ? 'Tiếp tục' : 'Về trang chủ'}<Icon name="arrow_forward" size={20} />
        </Button>
      </div>
    </div>
  );
}

function ScoreRow({ label, value, threshold, dark }: { label: string; value: number; threshold: number; ok: boolean; dark: boolean }) {
  const pass = value >= threshold;
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`text-body-sm ${dark ? 'text-white/70' : 'text-on-surface-variant'}`}>{label}</span>
      <span className={`font-bold text-body-md tabular-nums flex items-center gap-1 ${pass ? (dark ? 'text-secondary-fixed' : 'text-secondary') : 'text-warning'}`}>
        <Icon name={pass ? 'check_circle' : 'info'} size={16} />{value}%
      </span>
    </div>
  );
}
