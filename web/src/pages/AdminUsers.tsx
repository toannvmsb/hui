import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Icon, Spinner, Avatar, Badge, EmptyState } from '../components/ui';
import { vndShort } from '../lib/format';

const SORTS = [['credit', 'Uy tín'], ['groups', 'Nhiều dây'], ['money', 'Nhiều tiền'], ['slots', 'Nhiều suất'], ['risk', 'Rủi ro']];
function creditTone(s: number) { return s >= 720 ? 'green' : s >= 640 ? 'blue' : s >= 560 ? 'amber' : 'red'; }

export default function AdminUsers() {
  const navigate = useNavigate();
  const [sort, setSort] = useState('credit');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');

  // debounce input -> dq
  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-users', sort, dq],
    queryFn: async () => (await api.get(`/admin/users`, { params: { sort, q: dq } })).data as { items: any[]; matched: number; grandTotal: number; searching: boolean },
    placeholderData: keepPreviousData,
  });

  const items = data?.items || [];
  const capped = data && !data.searching && data.grandTotal > items.length;

  return (
    <Screen nav={false}>
      <SubHeader title="Quản lý người dùng" />
      <div className="px-safe-margin pt-3">
        {/* search */}
        <div className="relative mb-3">
          <Icon name="search" size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên hoặc số điện thoại..."
            className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl pl-11 pr-10 py-3 text-body-md text-on-surface outline-none focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-surface-container flex items-center justify-center">
              <Icon name="close" size={18} className="text-on-surface-variant" />
            </button>
          )}
          {isFetching && q && <Icon name="progress_activity" size={18} className="animate-spin text-secondary absolute right-10 top-1/2 -translate-y-1/2" />}
        </div>

        {/* sort tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-2">
          {SORTS.map(([k, l]) => (
            <button key={k} onClick={() => setSort(k)} className={`flex-shrink-0 px-4 py-2 rounded-full text-label-md font-semibold ${sort === k ? 'bg-secondary text-white' : 'bg-surface-container-high text-on-surface-variant'}`}>{l}</button>
          ))}
        </div>

        {/* count hint */}
        {data && (
          <p className="text-label-md text-on-surface-variant mb-2 px-1">
            {data.searching
              ? `Tìm thấy ${data.matched} người dùng${data.matched > items.length ? ` (hiển thị ${items.length})` : ''}`
              : capped ? `Hiển thị ${items.length} / ${data.grandTotal} người dùng — tìm kiếm để xem người cụ thể` : `${data.grandTotal} người dùng`}
          </p>
        )}

        {isLoading ? <Spinner /> : items.length === 0 ? (
          <EmptyState icon="person_search" title="Không tìm thấy" desc={`Không có người dùng nào khớp "${dq}". Thử từ khóa hoặc số điện thoại khác.`} />
        ) : (
          <div className="space-y-2">
            {items.map((u, i) => (
              <Card key={u.id} className={`p-3 flex items-center gap-3 ${u.locked ? 'opacity-60' : ''}`} onClick={() => navigate(`/admin/users/${u.id}`)}>
                {!data?.searching && <span className="w-5 text-center font-bold text-body-sm text-on-surface-variant tabular-nums">{i + 1}</span>}
                <Avatar name={u.fullName} color={u.avatarColor} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-body-md text-on-surface truncate flex items-center gap-1">{u.fullName}{u.locked && <Icon name="lock" size={14} className="text-error" />}</p>
                  <div className="flex gap-1.5 items-center mt-0.5">
                    <Badge tone={creditTone(u.creditScore) as any}>{u.creditScore}</Badge>
                    {data?.searching && <span className="text-label-md text-on-surface-variant tabular-nums">{u.phone}</span>}
                    {u.ekycStatus === 'VERIFIED' ? <Icon name="verified" size={15} className="text-secondary" /> : <Badge tone="gray">Chưa eKYC</Badge>}
                  </div>
                </div>
                <div className="text-right">
                  {sort === 'money' ? <p className="font-semibold text-body-sm text-on-surface tabular-nums">{vndShort(u.throughput)}</p>
                    : sort === 'groups' ? <p className="font-semibold text-body-sm text-on-surface">{u.groupsJoined} dây</p>
                    : sort === 'slots' ? <p className="font-semibold text-body-sm text-on-surface">{u.slotsHeld} suất</p>
                    : sort === 'risk' ? <p className="font-semibold text-body-sm text-error tabular-nums">{u.riskScore}/100</p>
                    : <p className="font-semibold text-body-sm text-on-surface">{u.groupsJoined} dây • {u.slotsHeld} suất</p>}
                  {u.overdueAmount > 0 && <p className="text-label-md text-error tabular-nums">Nợ {vndShort(u.overdueAmount)}</p>}
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
