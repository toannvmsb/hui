import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Badge, Icon, Spinner, EmptyState, Button } from '../components/ui';
import { vnd, vndShort, HUI_TYPE_LABEL, MODE_LABEL } from '../lib/format';

const STATUS: Record<string, { tone: any; label: string }> = {
  DRAFT: { tone: 'gray', label: 'Nháp' },
  PENDING_MEMBERS: { tone: 'amber', label: 'Đang tuyển' },
  PENDING_SIGN: { tone: 'amber', label: 'Chờ ký' },
  ACTIVE: { tone: 'green', label: 'Hoạt động' },
  COMPLETED: { tone: 'blue', label: 'Hoàn thành' },
  BROKEN: { tone: 'red', label: 'Vỡ hụi' },
};

export default function OrganizerHome() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['org-groups'], queryFn: async () => (await api.get('/organizer/groups')).data as any[] });

  return (
    <Screen nav={false}>
      <SubHeader title="Quản lý chủ hụi" right={<button onClick={() => navigate('/groups/new')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container"><Icon name="add" className="text-secondary" /></button>} />
      <div className="px-safe-margin pt-3">
        <p className="text-body-sm text-on-surface-variant mb-4">Các dây hụi bạn tổ chức. Duyệt thành viên, theo dõi công nợ, chốt kỳ & chi trả.</p>
        {isLoading ? <Spinner /> : !data?.length ? (
          <EmptyState icon="store" title="Bạn chưa tổ chức dây nào" desc="Tạo dây hụi để bắt đầu làm chủ hụi." action={<Button icon="add" onClick={() => navigate('/groups/new')}>Tạo dây hụi</Button>} />
        ) : (
          <div className="space-y-3">
            {data.map((g) => (
              <Card key={g.id} className="p-4" onClick={() => navigate(`/organizer/groups/${g.id}`)}>
                <div className="flex justify-between items-start mb-2">
                  <div><p className="font-title-lg text-title-lg text-on-surface">{g.name}</p><p className="text-label-md text-on-surface-variant">#{g.code} • {HUI_TYPE_LABEL[g.huiType]} • {MODE_LABEL[g.mode]}</p></div>
                  <Badge tone={STATUS[g.status].tone}>{STATUS[g.status].label}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <Mini label="Thành viên" value={g.members} icon="group" />
                  <Mini label="Kỳ đã chốt" value={`${g.paidCycles}/${g.totalCycles}`} icon="event_available" />
                  <Mini label="Giá trị" value={vndShort(g.totalSlots * g.amountPerSlot * g.totalCycles)} icon="payments" />
                </div>
                {(g.pendingMembers > 0 || g.openSlots > 0) && (
                  <div className="flex gap-2 mt-3">
                    {g.pendingMembers > 0 && <Badge tone="amber" icon="person_add">{g.pendingMembers} chờ duyệt</Badge>}
                    {g.openSlots > 0 && <Badge tone="blue" icon="confirmation_number">{g.openSlots} suất trống</Badge>}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}

function Mini({ label, value, icon }: { label: string; value: any; icon: string }) {
  return (
    <div className="bg-surface-container-low rounded-xl p-2.5 text-center">
      <Icon name={icon} size={18} className="text-secondary" />
      <p className="font-bold text-body-md text-on-surface tabular-nums">{value}</p>
      <p className="text-label-md text-on-surface-variant leading-tight">{label}</p>
    </div>
  );
}
