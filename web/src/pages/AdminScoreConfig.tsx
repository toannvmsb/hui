import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Button, Icon, Spinner, Avatar } from '../components/ui';
import { useToast } from '../store/toast';

interface Cfg { baseScore: number; onTimePoints: number; latePenalty: number; groupJoinPoints: number; harvestPoints: number; transferPenalty: number; minScore: number; maxScore: number; }

function calc(r: any, c: Cfg) {
  const raw = c.baseScore + r.paidCount * c.onTimePoints - r.overdueCount * c.latePenalty + r.groupsJoined * c.groupJoinPoints + r.harvestCount * c.harvestPoints - r.transferCount * c.transferPenalty;
  return Math.max(c.minScore, Math.min(c.maxScore, Math.round(raw)));
}

const PARAMS: { key: keyof Cfg; label: string; desc: string; min: number; max: number; sign: '+' | '-' | '' }[] = [
  { key: 'onTimePoints', label: 'Đóng đúng hạn', desc: 'Cộng điểm cho mỗi kỳ đóng đúng hạn', min: 0, max: 10, sign: '+' },
  { key: 'latePenalty', label: 'Đóng quá hạn', desc: 'Trừ điểm cho mỗi kỳ quá hạn', min: 0, max: 50, sign: '-' },
  { key: 'groupJoinPoints', label: 'Tham gia dây', desc: 'Cộng điểm cho mỗi dây tham gia', min: 0, max: 20, sign: '+' },
  { key: 'harvestPoints', label: 'Hốt hụi hoàn tất', desc: 'Cộng điểm cho mỗi lần hốt', min: 0, max: 20, sign: '+' },
  { key: 'transferPenalty', label: 'Sang nhượng suất', desc: 'Trừ điểm cho mỗi lần nhận sang nhượng', min: 0, max: 20, sign: '-' },
];

export default function AdminScoreConfig() {
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<Cfg | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['score-config'], queryFn: async () => (await api.get('/admin/score-config')).data });
  useEffect(() => { if (data?.config && !cfg) setCfg({ ...data.config }); }, [data]);

  const save = useMutation({
    mutationFn: () => api.post('/admin/score-config', cfg),
    onSuccess: () => { toast('Đã gửi yêu cầu đổi tham số — chờ duyệt 4 mắt'); qc.invalidateQueries({ queryKey: ['admin-approvals'] }); qc.invalidateQueries({ queryKey: ['approvals-count'] }); },
    onError: (e) => toast(apiError(e), 'red'),
  });

  const rows = data?.preview || [];
  const projected = useMemo(() => {
    if (!cfg) return [];
    return rows.map((r: any) => ({ ...r, projected: calc(r, cfg) })).sort((a: any, b: any) => b.projected - a.projected);
  }, [rows, cfg]);

  const avg = projected.length ? Math.round(projected.reduce((s: number, r: any) => s + r.projected, 0) / projected.length) : 0;
  const improved = projected.filter((r: any) => r.projected > r.current).length;
  const declined = projected.filter((r: any) => r.projected < r.current).length;
  const set = (k: keyof Cfg, v: number) => setCfg((p) => p ? { ...p, [k]: v } : p);

  if (isLoading || !cfg) return <Screen nav={false}><SubHeader title="Tham số điểm uy tín" /><Spinner /></Screen>;

  return (
    <Screen nav={false}>
      <SubHeader title="Tham số điểm uy tín" />
      <div className="px-safe-margin pt-3">
        {/* preview summary */}
        <div className="bg-primary-container text-white rounded-3xl p-5 mb-4 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-secondary/20 rounded-full blur-2xl" />
          <p className="text-label-md text-white/60">Điểm trung bình (xem trước)</p>
          <p className="font-display-lg text-display-lg tabular-nums">{avg}</p>
          <div className="flex gap-4 mt-2 text-body-sm">
            <span className="text-secondary-fixed flex items-center gap-1"><Icon name="trending_up" size={16} />{improved} tăng</span>
            <span className="text-warning flex items-center gap-1"><Icon name="trending_down" size={16} />{declined} giảm</span>
          </div>
        </div>

        {/* base / clamp */}
        <Card className="p-4 mb-3">
          <p className="font-title-lg text-title-lg text-on-surface mb-3">Khung điểm</p>
          <div className="grid grid-cols-3 gap-2">
            <NumBox label="Điểm gốc" value={cfg.baseScore} onChange={(v) => set('baseScore', v)} />
            <NumBox label="Tối thiểu" value={cfg.minScore} onChange={(v) => set('minScore', v)} />
            <NumBox label="Tối đa" value={cfg.maxScore} onChange={(v) => set('maxScore', v)} />
          </div>
        </Card>

        {/* point params */}
        <Card className="p-4 mb-3">
          <p className="font-title-lg text-title-lg text-on-surface mb-1">Trọng số hành vi</p>
          <p className="text-label-md text-on-surface-variant mb-3">Kéo để điều chỉnh — xem trước cập nhật ngay</p>
          <div className="space-y-4">
            {PARAMS.map((p) => (
              <div key={p.key}>
                <div className="flex justify-between items-center mb-1">
                  <div><p className="text-body-md font-medium text-on-surface">{p.label}</p><p className="text-label-md text-on-surface-variant">{p.desc}</p></div>
                  <span className={`font-bold text-title-lg tabular-nums ${p.sign === '-' ? 'text-error' : 'text-secondary'}`}>{p.sign}{cfg[p.key]}</span>
                </div>
                <input type="range" min={p.min} max={p.max} value={cfg[p.key]} onChange={(e) => set(p.key, Number(e.target.value))} className="w-full accent-secondary" />
              </div>
            ))}
          </div>
        </Card>

        {/* preview list */}
        <Card className="p-4 mb-4">
          <p className="font-title-lg text-title-lg text-on-surface mb-3">Tác động lên người chơi</p>
          <div className="space-y-2">
            {projected.slice(0, 12).map((r: any) => {
              const delta = r.projected - r.current;
              return (
                <div key={r.id} className="flex items-center gap-2.5">
                  <Avatar name={r.fullName} color={r.avatarColor} size={30} />
                  <span className="flex-1 text-body-sm text-on-surface truncate">{r.fullName}</span>
                  <span className="text-body-sm text-on-surface-variant tabular-nums">{r.current}</span>
                  <Icon name="arrow_forward" size={14} className="text-on-surface-variant" />
                  <span className="font-semibold text-body-sm text-on-surface tabular-nums w-9 text-right">{r.projected}</span>
                  <span className={`text-label-md font-semibold tabular-nums w-9 text-right ${delta > 0 ? 'text-secondary' : delta < 0 ? 'text-error' : 'text-on-surface-variant'}`}>{delta > 0 ? '+' : ''}{delta}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="px-safe-margin py-4">
        <Button full icon="save" loading={save.isPending} onClick={() => save.mutate()} className="py-4">Lưu tham số (cần duyệt 4 mắt)</Button>
        <p className="text-center text-label-md text-on-surface-variant mt-2">Khi được duyệt, hệ thống tính lại điểm cho toàn bộ người chơi</p>
      </div>
    </Screen>
  );
}

function NumBox({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="bg-surface-container-low rounded-xl p-2.5 text-center">
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full bg-transparent text-center font-bold text-title-lg text-on-surface outline-none tabular-nums" />
      <p className="text-label-md text-on-surface-variant">{label}</p>
    </div>
  );
}
