import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Badge, Button, Icon, Spinner, Avatar } from '../components/ui';
import { vnd, vndShort, fromNow, HUI_TYPE_LABEL, MODE_LABEL } from '../lib/format';
import { useToast } from '../store/toast';

const LEVEL: Record<string, { label: string; color: string; ring: string }> = {
  HIGH: { label: 'Rủi ro CAO', color: 'error', ring: '#ba1a1a' },
  MEDIUM: { label: 'Rủi ro TRUNG BÌNH', color: 'warning', ring: '#FF9800' },
  LOW: { label: 'Rủi ro THẤP', color: 'secondary', ring: '#006c49' },
};
const ST: Record<string, { color: string; bar: string; label: string }> = {
  good: { color: 'secondary', bar: 'bg-secondary', label: 'Tốt' },
  warn: { color: 'warning', bar: 'bg-warning', label: 'Cần chú ý' },
  crit: { color: 'error', bar: 'bg-error', label: 'Nghiêm trọng' },
};

export default function AdminRiskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();

  const { data: d, isLoading } = useQuery({ queryKey: ['risk-analysis', id], queryFn: async () => (await api.get(`/admin/risk-alerts/${id}/analysis`)).data });
  const resolve = useMutation({
    mutationFn: () => api.post(`/admin/risk-alerts/${id}/resolve`),
    onSuccess: () => { toast('Đã đánh dấu xử lý'); qc.invalidateQueries({ queryKey: ['admin-risk'] }); navigate(-1); },
    onError: (e) => toast(apiError(e), 'red'),
  });

  if (isLoading || !d) return <Screen nav={false}><SubHeader title="Phân tích rủi ro" /><Spinner label="Đang phân tích đa chiều..." /></Screen>;

  const lv = LEVEL[d.level] || LEVEL.LOW;
  const circ = 2 * Math.PI * 52;

  return (
    <Screen nav={false}>
      <SubHeader title="Phân tích rủi ro dây hụi" />
      <div className="px-safe-margin pt-3">
        {/* alert context */}
        <Card className={`p-4 mb-4 border-${lv.color}/30 bg-${lv.color}/5`}>
          <div className="flex items-start gap-3">
            <Icon name="warning" fill className={`text-${lv.color}`} />
            <div className="flex-1">
              <p className="font-semibold text-body-md text-on-surface">{d.alert.title}</p>
              <p className="text-body-sm text-on-surface-variant">{d.alert.message}</p>
              <p className="text-label-md text-on-surface-variant/70 mt-1">{fromNow(d.alert.createdAt)}</p>
            </div>
          </div>
        </Card>

        {/* group + composite gauge */}
        <Card className="p-5 mb-4">
          <div className="flex items-center gap-4">
            <div className="relative w-32 h-32 flex-shrink-0">
              <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#e5eeff" strokeWidth="12" />
                <circle cx="60" cy="60" r="52" fill="none" stroke={lv.ring} strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={circ} strokeDashoffset={circ * (1 - d.composite / 100)} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display-lg text-display-lg text-on-surface tabular-nums leading-none">{d.composite}</span>
                <span className="text-label-md text-on-surface-variant">/100</span>
              </div>
            </div>
            <div className="flex-1">
              <Badge tone={lv.color === 'error' ? 'red' : lv.color === 'warning' ? 'amber' : 'green'}>{lv.label}</Badge>
              <p className="font-title-lg text-title-lg text-on-surface mt-2">{d.group.name}</p>
              <p className="text-label-md text-on-surface-variant">#{d.group.code} • {HUI_TYPE_LABEL[d.group.huiType]} • {MODE_LABEL[d.group.mode]}</p>
              <p className="text-body-sm text-on-surface-variant mt-1">Chủ hụi: {d.group.organizerName}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-outline-variant/15">
            <Mini label="Đã thu" value={vndShort(d.summary.collected)} />
            <Mini label="Quá hạn" value={vndShort(d.summary.overdueAmount)} tone="error" />
            <Mini label="Còn phải thu" value={vndShort(d.summary.outstanding)} tone="warning" />
          </div>
        </Card>

        {/* dimensions */}
        <h3 className="font-title-lg text-title-lg text-on-surface mb-2">Phân tích đa chiều</h3>
        <div className="space-y-2 mb-4">
          {d.dimensions.map((dim: any) => {
            const s = ST[dim.status];
            return (
              <Card key={dim.key} className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${s.color}/10`}><Icon name={dim.icon} size={20} className={`text-${s.color}`} /></div>
                  <div className="flex-1"><p className="font-semibold text-body-md text-on-surface">{dim.label}</p><p className="text-label-md text-on-surface-variant">{dim.value}</p></div>
                  <Badge tone={dim.status === 'crit' ? 'red' : dim.status === 'warn' ? 'amber' : 'green'}>{s.label}</Badge>
                </div>
                <div className="w-full bg-surface-variant h-2 rounded-full overflow-hidden mb-2">
                  <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${dim.score}%` }} />
                </div>
                <p className="text-body-sm text-on-surface-variant">{dim.detail}</p>
              </Card>
            );
          })}
        </div>

        {/* risky members */}
        {d.riskyMembers.length > 0 && (
          <>
            <h3 className="font-title-lg text-title-lg text-on-surface mb-2">Thành viên cần theo dõi ({d.riskyMembers.length})</h3>
            <div className="space-y-2 mb-4">
              {d.riskyMembers.map((m: any) => (
                <Card key={m.userId} className="p-3 flex items-center gap-3">
                  <Avatar name={m.name} color={m.color} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-body-md text-on-surface truncate">{m.name}</p>
                    <p className="text-label-md text-on-surface-variant">Uy tín {m.creditScore} • {m.slots} suất</p>
                  </div>
                  <div className="text-right">
                    <Badge tone={m.overdueCount ? 'red' : 'amber'}>{m.flag}</Badge>
                    {m.overdueAmount > 0 && <p className="text-label-md text-error mt-1 tabular-nums">{vnd(m.overdueAmount)}</p>}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* recommendations */}
        <h3 className="font-title-lg text-title-lg text-on-surface mb-2">Khuyến nghị xử lý</h3>
        <Card className="p-2 mb-4">
          {d.recommendations.map((r: any, i: number) => (
            <div key={i} className="flex items-start gap-3 p-2.5">
              <div className="w-8 h-8 rounded-lg bg-tertiary/10 flex items-center justify-center flex-shrink-0"><Icon name={r.icon} size={18} className="text-tertiary" /></div>
              <p className="text-body-sm text-on-surface flex-1 pt-1">{r.text}</p>
            </div>
          ))}
        </Card>
      </div>

      <div className="px-safe-margin py-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" icon="open_in_new" onClick={() => navigate(`/organizer/groups/${d.group.id}`)}>Xem công nợ dây</Button>
        {!d.alert.resolved ? <Button loading={resolve.isPending} onClick={() => resolve.mutate()} icon="check">Đã xử lý</Button> : <Button disabled icon="check">Đã xử lý</Button>}
      </div>
    </Screen>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-surface-container-low rounded-xl p-2.5 text-center">
      <p className={`font-bold text-body-md tabular-nums ${tone ? `text-${tone}` : 'text-on-surface'}`}>{value}</p>
      <p className="text-label-md text-on-surface-variant leading-tight">{label}</p>
    </div>
  );
}
