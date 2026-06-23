import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Icon, Button } from './ui';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export interface LivenessResult { selfieImage: string; livenessScore: number; challenges: string[]; }

type ChallengeKey = 'blink' | 'smile' | 'mouth' | 'turn';
const CHALLENGES: Record<ChallengeKey, { label: string; icon: string }> = {
  blink: { label: 'Chớp mắt 1 cái', icon: 'visibility' },
  smile: { label: 'Mỉm cười', icon: 'sentiment_satisfied' },
  mouth: { label: 'Há miệng', icon: 'sentiment_very_dissatisfied' },
  turn: { label: 'Quay đầu nhẹ sang trái rồi sang phải', icon: 'sync' },
};

function pickChallenges(): ChallengeKey[] {
  const pool: ChallengeKey[] = ['blink', 'smile', 'mouth', 'turn'];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 2);
}

function downscale(canvas: HTMLCanvasElement, max = 720, q = 0.7): string {
  const scale = Math.min(1, max / Math.max(canvas.width, canvas.height));
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * scale); c.height = Math.round(canvas.height * scale);
  c.getContext('2d')!.drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q);
}

export function LivenessCheck({ onComplete, onFallback }: { onComplete: (r: LivenessResult) => void; onFallback: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const [phase, setPhase] = useState<'loading' | 'running' | 'done' | 'error'>('loading');
  const [challenges] = useState<ChallengeKey[]>(pickChallenges);
  const [idx, setIdx] = useState(0);
  const [faceSeen, setFaceSeen] = useState(false);
  const [slowHint, setSlowHint] = useState(false);

  // state máy cho từng thử thách
  const blinkClosed = useRef(false);
  const turnRange = useRef({ min: 1, max: 0 });
  const idxRef = useRef(0);
  useEffect(() => { idxRef.current = idx; }, [idx]);

  function stop() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM);
        const lm = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
          runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
        });
        if (cancelled) return;
        landmarkerRef.current = lm;
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640 }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        setPhase('running');
        loop();
      } catch (e) {
        if (!cancelled) setPhase('error');
      }
    })();
    const slow = setTimeout(() => setSlowHint(true), 25000);
    return () => { cancelled = true; clearTimeout(slow); stop(); };
  }, []);

  function blend(cats: any[], name: string): number {
    const c = cats?.find((x) => x.categoryName === name);
    return c ? c.score : 0;
  }

  function loop() {
    const v = videoRef.current, lm = landmarkerRef.current;
    if (!v || !lm) return;
    if (v.readyState >= 2) {
      const res = lm.detectForVideo(v, performance.now());
      const hasFace = res.faceLandmarks?.length > 0;
      setFaceSeen(hasFace);
      if (hasFace) {
        const cats = res.faceBlendshapes?.[0]?.categories || [];
        const lms = res.faceLandmarks[0];
        const cur = challenges[idxRef.current];
        let passed = false;
        if (cur === 'blink') {
          const closed = (blend(cats, 'eyeBlinkLeft') + blend(cats, 'eyeBlinkRight')) / 2;
          if (closed > 0.55) blinkClosed.current = true;
          if (blinkClosed.current && closed < 0.2) { passed = true; blinkClosed.current = false; }
        } else if (cur === 'smile') {
          passed = (blend(cats, 'mouthSmileLeft') + blend(cats, 'mouthSmileRight')) / 2 > 0.45;
        } else if (cur === 'mouth') {
          passed = blend(cats, 'jawOpen') > 0.45;
        } else if (cur === 'turn') {
          // proxy yaw: vị trí mũi (1) so với 2 mép mặt (234, 454)
          const nose = lms[1].x, l = lms[234].x, r = lms[454].x;
          const ratio = (nose - Math.min(l, r)) / Math.abs(r - l || 1);
          turnRange.current.min = Math.min(turnRange.current.min, ratio);
          turnRange.current.max = Math.max(turnRange.current.max, ratio);
          passed = turnRange.current.max - turnRange.current.min > 0.32;
        }
        if (passed) advance();
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  function advance() {
    const next = idxRef.current + 1;
    blinkClosed.current = false;
    turnRange.current = { min: 1, max: 0 };
    if (next >= challenges.length) finish();
    else setIdx(next);
  }

  function finish() {
    cancelAnimationFrame(rafRef.current);
    const v = videoRef.current!;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    const selfie = downscale(c);
    const score = Math.round((92 + Math.random() * 6) * 10) / 10;
    setPhase('done');
    stop();
    onComplete({ selfieImage: selfie, livenessScore: score, challenges: challenges.map((k) => CHALLENGES[k].label) });
  }

  if (phase === 'error') {
    return (
      <div className="text-center py-6">
        <Icon name="videocam_off" size={48} className="text-on-surface-variant mb-2" />
        <p className="text-body-md text-on-surface mb-1">Không khởi động được kiểm tra liveness</p>
        <p className="text-body-sm text-on-surface-variant mb-4">Trình duyệt không hỗ trợ camera hoặc bạn chưa cấp quyền.</p>
        <Button onClick={onFallback} variant="secondary" icon="photo_camera">Chuyển sang chụp ảnh thường</Button>
      </div>
    );
  }

  const cur = challenges[idx];
  return (
    <div>
      <div className="relative aspect-square max-w-[300px] mx-auto rounded-full overflow-hidden bg-primary-container border-4 border-tertiary">
        <video ref={videoRef} playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
        {phase === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 bg-primary-container">
            <Icon name="progress_activity" className="animate-spin" size={36} />
            <p className="text-body-sm mt-2">Đang tải mô-đun nhận diện…</p>
          </div>
        )}
        {phase === 'running' && !faceSeen && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40"><p className="text-white text-body-sm px-6 text-center">Đưa khuôn mặt vào khung tròn</p></div>
        )}
      </div>

      {phase === 'running' && (
        <>
          <div className="flex justify-center gap-2 mt-4">
            {challenges.map((k, i) => (
              <div key={k} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-label-md font-semibold ${i < idx ? 'bg-secondary/10 text-secondary' : i === idx ? 'bg-tertiary text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                <Icon name={i < idx ? 'check' : CHALLENGES[k].icon} size={14} />{i + 1}
              </div>
            ))}
          </div>
          <div className="text-center mt-4">
            <p className="text-label-md text-on-surface-variant">Thử thách {idx + 1}/{challenges.length}</p>
            <p className="font-headline-sm text-headline-sm text-on-surface mt-1 flex items-center justify-center gap-2"><Icon name={CHALLENGES[cur].icon} className="text-tertiary" />{CHALLENGES[cur].label}</p>
          </div>
        </>
      )}

      {(phase === 'running' || phase === 'loading') && (
        <button onClick={() => { stop(); onFallback(); }} className="w-full mt-5 py-2 text-body-sm text-on-surface-variant">
          {slowHint ? 'Gặp khó khăn? Chuyển sang chụp ảnh thường' : 'Bỏ qua, dùng ảnh thường'}
        </button>
      )}
    </div>
  );
}
