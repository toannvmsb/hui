import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Icon, Spinner, Badge, Button, Sheet, Field } from '../components/ui';
import { fmtDate } from '../lib/format';
import { useToast } from '../store/toast';

const ST: Record<string, { tone: any; label: string }> = {
  PENDING_REVIEW: { tone: 'amber', label: 'Chờ duyệt' }, VERIFIED: { tone: 'green', label: 'Đã duyệt' }, REJECTED: { tone: 'red', label: 'Từ chối' },
};

export default function AdminEkycDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();
  const [zoom, setZoom] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const { data: s, isLoading } = useQuery({ queryKey: ['ekyc', id], queryFn: async () => (await api.get(`/admin/ekyc/${id}`)).data });

  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-ekyc'] }); qc.invalidateQueries({ queryKey: ['ekyc', id] }); qc.invalidateQueries({ queryKey: ['ekyc-count'] }); };
  const approve = useMutation({ mutationFn: () => api.post(`/admin/ekyc/${id}/approve`), onSuccess: () => { toast('Đã duyệt hồ sơ eKYC ✓'); refresh(); navigate(-1); }, onError: (e) => toast(apiError(e), 'red') });
  const reject = useMutation({ mutationFn: () => api.post(`/admin/ekyc/${id}/reject`, { reason }), onSuccess: () => { toast('Đã từ chối hồ sơ'); setRejectOpen(false); refresh(); navigate(-1); }, onError: (e) => toast(apiError(e), 'red') });

  if (isLoading || !s) return <Screen nav={false}><SubHeader title="Hồ sơ eKYC" /><Spinner /></Screen>;
  const pending = s.status === 'PENDING_REVIEW';

  return (
    <Screen nav={false}>
      <SubHeader title="Hồ sơ eKYC" />
      <div className="px-safe-margin pt-3">
        <div className="flex items-center justify-between mb-3">
          <div><p className="font-headline-sm text-headline-sm text-on-surface">{s.fullName}</p><p className="text-body-sm text-on-surface-variant">+84 {s.userPhone?.slice(1)} • {fmtDate(s.createdAt, 'DD/MM/YYYY HH:mm')}</p></div>
          <Badge tone={ST[s.status].tone}>{ST[s.status].label}</Badge>
        </div>

        {/* images */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <ImgCard label="CCCD mặt trước" src={s.frontImage} onZoom={setZoom} />
          <ImgCard label="CCCD mặt sau" src={s.backImage} onZoom={setZoom} />
          <ImgCard label="Selfie" src={s.selfieImage} onZoom={setZoom} />
          <Card className="p-3 flex flex-col justify-center gap-2">
            <Score label="Khớp khuôn mặt" v={s.faceMatchScore} />
            <Score label="Liveness" v={s.livenessScore} />
            <Score label="Độ chính xác OCR" v={s.ocrConfidence} />
            {s.livenessMethod === 'active-challenge' && <p className="text-label-md text-secondary flex items-center gap-1"><Icon name="verified_user" size={13} fill />Liveness chủ động</p>}
          </Card>
        </div>

        {/* extracted info */}
        <Card className="p-4 mb-4">
          <p className="font-title-lg text-title-lg text-on-surface mb-2">Thông tin trích xuất</p>
          <Row k="Số CCCD" v={s.cccd} />
          <Row k="Họ tên" v={s.fullName} />
          <Row k="Ngày sinh" v={s.dob} />
          <Row k="Giới tính" v={s.gender} />
          <Row k="Quê quán" v={s.hometown} />
          <Row k="Thường trú" v={s.address} />
          <Row k="Ngày cấp" v={s.issueDate} />
          <Row k="Nơi cấp" v={s.issuePlace} />
        </Card>

        {s.rejectReason && <Card className="p-3 mb-4 bg-error/5 border-error/30"><p className="text-body-sm text-on-surface"><b>Lý do từ chối:</b> {s.rejectReason}</p></Card>}
      </div>

      {pending && (
        <div className="px-safe-margin py-4 grid grid-cols-2 gap-2">
          <Button variant="danger" icon="close" onClick={() => { setReason(''); setRejectOpen(true); }}>Từ chối</Button>
          <Button icon="check" loading={approve.isPending} onClick={() => approve.mutate()}>Duyệt</Button>
        </div>
      )}

      {zoom && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4 animate-fade-in" onClick={() => setZoom(null)}>
          <img src={zoom} className="max-w-full max-h-full rounded-xl" />
        </div>
      )}

      <Sheet open={rejectOpen} onClose={() => setRejectOpen(false)} title="Từ chối hồ sơ eKYC">
        <Field label="Lý do từ chối">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-4 py-3 text-body-md outline-none focus:border-tertiary resize-none" placeholder="VD: Ảnh CCCD mờ, khuôn mặt không khớp..." />
        </Field>
        <div className="flex gap-2 flex-wrap mt-2 mb-3">
          {['Ảnh CCCD mờ/lóa', 'Khuôn mặt không khớp', 'Thông tin sai lệch'].map((r) => (
            <button key={r} onClick={() => setReason(r)} className="px-3 py-1.5 rounded-full bg-surface-container text-label-md text-on-surface-variant">{r}</button>
          ))}
        </div>
        <Button full variant="danger" loading={reject.isPending} onClick={() => reject.mutate()}>Xác nhận từ chối</Button>
      </Sheet>
    </Screen>
  );
}

function ImgCard({ label, src, onZoom }: { label: string; src: string; onZoom: (s: string) => void }) {
  return (
    <Card className="p-2" onClick={() => src && onZoom(src)}>
      {src ? <img src={src} className="w-full h-28 object-cover rounded-lg" /> : <div className="w-full h-28 bg-surface-container rounded-lg flex items-center justify-center"><Icon name="image_not_supported" className="text-on-surface-variant" /></div>}
      <p className="text-label-md text-on-surface-variant text-center mt-1">{label}</p>
    </Card>
  );
}
function Score({ label, v }: { label: string; v: number }) {
  const tone = v >= 90 ? 'secondary' : v >= 80 ? 'tertiary' : 'warning';
  return <div className="flex items-center justify-between"><span className="text-label-md text-on-surface-variant">{label}</span><span className={`font-bold text-body-sm tabular-nums text-${tone}`}>{v}%</span></div>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between py-1.5 border-b border-outline-variant/10 last:border-0"><span className="text-body-sm text-on-surface-variant">{k}</span><span className="text-body-sm font-medium text-on-surface text-right">{v || '—'}</span></div>;
}
