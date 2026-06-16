import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Badge, Button, Icon, Spinner, EmptyState } from '../components/ui';
import { vnd, HUI_TYPE_LABEL, MODE_LABEL, CYCLE_UNIT_LABEL } from '../lib/format';
import { useToast } from '../store/toast';
import { useRequireEkyc } from '../components/EkycGate';

const MEM_STATUS: Record<string, string> = { PENDING: 'Đang chờ chủ hụi duyệt', APPROVED: 'Bạn đã là thành viên', REJECTED: 'Yêu cầu đã bị từ chối' };

export default function JoinGroup() {
  const { code } = useParams();
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();
  const requireEkyc = useRequireEkyc();

  const { data: g, isLoading, isError } = useQuery({
    queryKey: ['by-code', code],
    queryFn: async () => (await api.get(`/groups/by-code/${code}`)).data,
    retry: false,
  });

  const join = useMutation({
    mutationFn: () => api.post(`/groups/${g.id}/join`),
    onSuccess: () => { toast('Đã gửi yêu cầu tham gia! Chờ chủ hụi duyệt.'); qc.invalidateQueries({ queryKey: ['by-code', code] }); },
    onError: (e) => toast(apiError(e), 'red'),
  });

  if (isLoading) return <Screen nav={false}><SubHeader title="Tham gia dây hụi" onBack={() => navigate('/')} /><Spinner /></Screen>;
  if (isError || !g) return (
    <Screen nav={false}>
      <SubHeader title="Tham gia dây hụi" onBack={() => navigate('/')} />
      <EmptyState icon="link_off" title="Link không hợp lệ" desc={`Không tìm thấy dây hụi với mã "${code}". Vui lòng kiểm tra lại link mời.`} action={<Button onClick={() => navigate('/discover')}>Khám phá dây khác</Button>} />
    </Screen>
  );

  const alreadyMember = !!g.myMembershipStatus;

  return (
    <Screen nav={false}>
      <SubHeader title="Lời mời tham gia" onBack={() => navigate('/')} />
      <div className="px-safe-margin pt-3">
        <div className="bg-primary-container text-white rounded-3xl p-6 mb-4 relative overflow-hidden text-center">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-secondary/20 rounded-full blur-3xl" />
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3"><Icon name="diversity_3" fill size={32} className="text-white" /></div>
          <p className="text-label-md text-white/60">Bạn được mời tham gia</p>
          <h2 className="font-headline-md text-headline-md mb-2">{g.name}</h2>
          <div className="flex gap-2 justify-center flex-wrap">
            <Badge tone="green">{HUI_TYPE_LABEL[g.huiType]}</Badge>
            <Badge tone={g.mode === 'SECURED' ? 'purple' : 'blue'}>{MODE_LABEL[g.mode]}</Badge>
            <span className="bg-white/10 text-white px-3 py-1 rounded-full text-label-md font-semibold">#{g.code}</span>
          </div>
        </div>

        <Card className="p-4 mb-4 grid grid-cols-2 gap-3">
          <Info label="Giá trị mỗi suất" value={`${vnd(g.amountPerSlot)}/${CYCLE_UNIT_LABEL[g.cycleUnit]}`} />
          <Info label="Quy mô" value={`${g.totalSlots} suất • ${g.totalCycles} kỳ`} />
          <Info label="Chủ hụi" value={g.organizerName} />
          <Info label="Suất còn trống" value={`${g.openSlots} suất`} />
        </Card>

        <Card className="p-4 mb-4 bg-tertiary/5 border-tertiary/20 flex gap-2">
          <Icon name="info" size={18} className="text-tertiary flex-shrink-0" />
          <p className="text-body-sm text-on-surface-variant">Sau khi gửi yêu cầu, chủ hụi sẽ duyệt và gán suất cho bạn. Bạn cần ký quy ước điện tử trước khi dây vận hành.</p>
        </Card>
      </div>

      <div className="px-safe-margin py-4">
        {alreadyMember ? (
          <>
            <Card className="p-3 mb-3 text-center"><Badge tone={g.myMembershipStatus === 'APPROVED' ? 'green' : g.myMembershipStatus === 'PENDING' ? 'amber' : 'red'}>{MEM_STATUS[g.myMembershipStatus]}</Badge></Card>
            <Button full variant="secondary" onClick={() => navigate(`/groups/${g.id}`)}>Xem chi tiết dây hụi</Button>
          </>
        ) : (
          <Button full loading={join.isPending} onClick={() => requireEkyc(() => join.mutate(), `/join/${code}`)} icon="group_add" className="py-4">Gửi yêu cầu tham gia</Button>
        )}
      </div>
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-label-md text-on-surface-variant">{label}</p><p className="font-semibold text-body-md text-on-surface">{value}</p></div>;
}
