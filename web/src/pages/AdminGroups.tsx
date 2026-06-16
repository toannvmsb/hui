import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Icon, Spinner, Badge, ProgressBar, EmptyState } from '../components/ui';
import { vndShort, HUI_TYPE_LABEL, MODE_LABEL } from '../lib/format';

const SORTS = [['value', 'Giá trị cao'], ['value-asc', 'Giá trị thấp'], ['members', 'Đông người'], ['risk', 'Rủi ro'], ['collected', 'Đã thu']];
const STATUS: Record<string, { tone: any; label: string }> = {
  DRAFT: { tone: 'gray', label: 'Nháp' }, PENDING_MEMBERS: { tone: 'amber', label: 'Đang tuyển' },
  PENDING_SIGN: { tone: 'amber', label: 'Chờ ký' }, ACTIVE: { tone: 'green', label: 'Hoạt động' },
  COMPLETED: { tone: 'blue', label: 'Hoàn thành' }, BROKEN: { tone: 'red', label: 'Vỡ hụi' },
};
function riskTone(s: number) { return s >= 60 ? 'red' : s >= 35 ? 'amber' : 'green'; }

export default function AdminGroups() {
  const navigate = useNavigate();
  const [sort, setSort] = useState('value');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-groups', sort, dq],
    queryFn: async () => (await api.get('/admin/groups', { params: { sort, q: dq } })).data as { items: any[]; matched: number; grandTotal: number; searching: boolean },
    placeholderData: keepPreviousData,
  });
  const items = data?.items || [];
  const capped = data && !data.searching && data.grandTotal > items.length;

  return (
    <Screen nav={false}>
      <SubHeader title="Quản lý dây hụi" />
      <div className="px-safe-margin pt-3">
        <div className="relative mb-3">
          <Icon name="search" size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên dây, mã hoặc chủ hụi..." className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl pl-11 pr-10 py-3 text-body-md text-on-surface outline-none focus:border-tertiary focus:ring-2 focus:ring-tertiary/20" />
          {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-surface-container flex items-center justify-center"><Icon name="close" size={18} className="text-on-surface-variant" /></button>}
          {isFetching && q && <Icon name="progress_activity" size={18} className="animate-spin text-secondary absolute right-10 top-1/2 -translate-y-1/2" />}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-2">
          {SORTS.map(([k, l]) => (
            <button key={k} onClick={() => setSort(k)} className={`flex-shrink-0 px-4 py-2 rounded-full text-label-md font-semibold ${sort === k ? 'bg-secondary text-white' : 'bg-surface-container-high text-on-surface-variant'}`}>{l}</button>
          ))}
        </div>

        {data && (
          <p className="text-label-md text-on-surface-variant mb-2 px-1">
            {data.searching ? `Tìm thấy ${data.matched} dây hụi${data.matched > items.length ? ` (hiển thị ${items.length})` : ''}`
              : capped ? `Hiển thị ${items.length} / ${data.grandTotal} dây — tìm kiếm để xem dây cụ thể` : `${data.grandTotal} dây hụi`}
          </p>
        )}

        {isLoading ? <Spinner /> : items.length === 0 ? (
          <EmptyState icon="search_off" title="Không tìm thấy" desc={`Không có dây hụi nào khớp "${dq}".`} />
        ) : (
          <div className="space-y-2.5">
            {items.map((g, i) => (
              <Card key={g.id} className="p-4" onClick={() => navigate(`/organizer/groups/${g.id}`)}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-2 min-w-0">
                    {!data?.searching && <span className="w-5 text-center font-bold text-body-sm text-on-surface-variant tabular-nums flex-shrink-0">{i + 1}</span>}
                    <div className="min-w-0">
                      <p className="font-title-lg text-title-lg text-on-surface truncate">{g.name}</p>
                      <p className="text-label-md text-on-surface-variant">#{g.code} • {HUI_TYPE_LABEL[g.huiType]} • {MODE_LABEL[g.mode]}</p>
                    </div>
                  </div>
                  <Badge tone={STATUS[g.status]?.tone}>{STATUS[g.status]?.label}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <Mini label="Giá trị" value={vndShort(g.value)} />
                  <Mini label="Đã thu" value={vndShort(g.collected)} />
                  <Mini label="Người chơi" value={`${g.members}`} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-label-md text-on-surface-variant">Rủi ro</span>
                  <div className="flex-1"><ProgressBar value={g.riskScore} gradient={g.riskScore >= 60 ? 'from-error to-red-400' : g.riskScore >= 35 ? 'from-warning to-amber-300' : 'from-secondary to-secondary-fixed'} /></div>
                  <Badge tone={riskTone(g.riskScore)}>{g.riskScore}/100</Badge>
                </div>
                {g.openSlots > 0 && <p className="text-label-md text-warning mt-2 flex items-center gap-1"><Icon name="confirmation_number" size={13} />{g.openSlots} suất trống</p>}
              </Card>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}

function Mini({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-surface-container-low rounded-xl p-2 text-center">
      <p className="font-bold text-body-md text-on-surface tabular-nums">{value}</p>
      <p className="text-label-md text-on-surface-variant leading-tight">{label}</p>
    </div>
  );
}
