import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Screen, TopBar } from '../components/Layout';
import { Spinner, Button, Icon, EmptyState } from '../components/ui';
import { GroupCard } from './Home';
import { useRequireEkyc } from '../components/EkycGate';

const FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'due', label: 'Cần đóng' },
  { key: 'organizer', label: 'Tôi làm chủ' },
  { key: 'live', label: 'Hụi sống' },
];

export default function GroupList() {
  const navigate = useNavigate();
  const requireEkyc = useRequireEkyc();
  const createGroup = () => requireEkyc(() => navigate('/groups/new'), '/groups/new');
  const [filter, setFilter] = useState('all');
  const { data, isLoading } = useQuery({ queryKey: ['groups'], queryFn: async () => (await api.get('/groups')).data as any[] });

  const groups = (data || []).filter((g) => {
    if (filter === 'due') return g.myDue > 0;
    if (filter === 'organizer') return g.isOrganizer;
    if (filter === 'live') return g.huiType === 'LIVE';
    return true;
  });

  return (
    <Screen fab={
      <button onClick={createGroup} className="absolute bottom-24 right-5 w-14 h-14 bg-secondary text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 z-40">
        <Icon name="add" size={28} />
      </button>
    }>
      <TopBar title="Dây hụi của tôi" />
      <div className="px-safe-margin pt-3">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-2">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} className={`flex-shrink-0 px-4 py-2 rounded-full text-label-md font-semibold transition-colors ${filter === f.key ? 'bg-secondary text-white' : 'bg-surface-container-high text-on-surface-variant'}`}>{f.label}</button>
          ))}
        </div>
        {isLoading ? <Spinner /> : groups.length === 0 ? (
          <EmptyState icon="group_off" title="Không có dây hụi" desc="Tham gia hoặc tạo dây hụi mới để bắt đầu." action={<Button icon="add" onClick={createGroup}>Tạo dây hụi</Button>} />
        ) : (
          <div className="flex flex-col gap-gutter">
            {groups.map((g) => <GroupCard key={g.id} g={g} onClick={() => navigate(`/groups/${g.id}`)} onPay={() => navigate(`/groups/${g.id}/contribute`)} />)}
          </div>
        )}
      </div>
    </Screen>
  );
}
