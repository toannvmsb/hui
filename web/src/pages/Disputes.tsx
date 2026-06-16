import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Badge, Button, Icon, Spinner, EmptyState } from '../components/ui';
import { fmtDate } from '../lib/format';

const STATUS: Record<string, { tone: any; label: string }> = {
  OPEN: { tone: 'amber', label: 'Đang chờ' },
  REVIEWING: { tone: 'blue', label: 'Đang xử lý' },
  RESOLVED: { tone: 'green', label: 'Đã giải quyết' },
  REJECTED: { tone: 'red', label: 'Từ chối' },
};
const CAT: Record<string, string> = {
  OWNERSHIP: 'Quyền sở hữu suất', PRICE: 'Giá bán suất', OBLIGATION: 'Nghĩa vụ sau chuyển nhượng', BID_RESULT: 'Kết quả giật hụi', OTHER: 'Khác',
};

export default function Disputes() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['disputes'], queryFn: async () => (await api.get('/me/disputes')).data as any[] });

  return (
    <Screen nav={false}>
      <SubHeader title="Khiếu nại / Tranh chấp" right={<button onClick={() => navigate('/disputes/new')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container"><Icon name="add" className="text-secondary" /></button>} />
      <div className="px-safe-margin pt-3">
        {isLoading ? <Spinner /> : !data?.length ? (
          <EmptyState icon="gavel" title="Chưa có khiếu nại" desc="Gửi khiếu nại nếu có tranh chấp về suất, giá, nghĩa vụ hay kết quả giật hụi." action={<Button icon="add" onClick={() => navigate('/disputes/new')}>Gửi khiếu nại</Button>} />
        ) : (
          <div className="space-y-3">
            {data.map((d) => (
              <Card key={d.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-body-md text-on-surface">{d.subject}</p>
                    <p className="text-label-md text-on-surface-variant tabular-nums">#{d.code} • {fmtDate(d.createdAt)}</p>
                  </div>
                  <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge>
                </div>
                <Badge tone="gray">{CAT[d.category]}</Badge>
                <p className="text-body-sm text-on-surface-variant mt-2">{d.detail}</p>
                {d.resolution && <div className="mt-2 p-3 bg-secondary/5 rounded-xl"><p className="text-label-md font-semibold text-secondary mb-0.5">Phản hồi xử lý</p><p className="text-body-sm text-on-surface">{d.resolution}</p></div>}
              </Card>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}
