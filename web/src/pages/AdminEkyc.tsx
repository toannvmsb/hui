import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Icon, Spinner, Avatar, Badge, EmptyState } from '../components/ui';
import { fromNow } from '../lib/format';

const FILTERS = [['PENDING_REVIEW', 'Chờ duyệt'], ['VERIFIED', 'Đã duyệt'], ['REJECTED', 'Từ chối'], ['', 'Tất cả']];
const ST: Record<string, { tone: any; label: string }> = {
  PENDING_REVIEW: { tone: 'amber', label: 'Chờ duyệt' }, VERIFIED: { tone: 'green', label: 'Đã duyệt' }, REJECTED: { tone: 'red', label: 'Từ chối' },
};
function matchTone(s: number) { return s >= 90 ? 'green' : s >= 80 ? 'blue' : 'amber'; }

export default function AdminEkyc() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('PENDING_REVIEW');
  const { data, isLoading } = useQuery({ queryKey: ['admin-ekyc', filter], queryFn: async () => (await api.get('/admin/ekyc', { params: { status: filter } })).data as any[] });

  return (
    <Screen nav={false}>
      <SubHeader title="Duyệt định danh eKYC" />
      <div className="px-safe-margin pt-3">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-3">
          {FILTERS.map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`flex-shrink-0 px-4 py-2 rounded-full text-label-md font-semibold ${filter === k ? 'bg-secondary text-white' : 'bg-surface-container-high text-on-surface-variant'}`}>{l}</button>
          ))}
        </div>
        {isLoading ? <Spinner /> : !data?.length ? (
          <EmptyState icon="badge" title="Không có hồ sơ" desc={filter === 'PENDING_REVIEW' ? 'Không có hồ sơ eKYC nào đang chờ duyệt.' : 'Trống.'} />
        ) : (
          <div className="space-y-2">
            {data.map((s) => (
              <Card key={s.id} className="p-3.5 flex items-center gap-3" onClick={() => navigate(`/admin/ekyc/${s.id}`)}>
                <Avatar name={s.userName} color={s.avatarColor} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-body-md text-on-surface truncate">{s.fullName || s.userName}</p>
                  <p className="text-label-md text-on-surface-variant">CCCD {s.cccd} • {fromNow(s.createdAt)}</p>
                </div>
                <div className="text-right">
                  <Badge tone={ST[s.status].tone}>{ST[s.status].label}</Badge>
                  <p className={`text-label-md mt-1 tabular-nums text-${matchTone(s.faceMatchScore)}`}>Khớp {s.faceMatchScore}%</p>
                </div>
                <Icon name="chevron_right" className="text-on-surface-variant" />
              </Card>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}
