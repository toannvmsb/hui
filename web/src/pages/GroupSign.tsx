import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Button, Icon, Spinner } from '../components/ui';
import { useToast } from '../store/toast';

export default function GroupSign() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();
  const [agreed, setAgreed] = useState(false);
  const { data: g, isLoading } = useQuery({ queryKey: ['group', id], queryFn: async () => (await api.get(`/groups/${id}`)).data });

  const sign = useMutation({
    mutationFn: () => api.post(`/groups/${id}/sign`),
    onSuccess: () => { toast('Đã ký quy ước điện tử ✓'); qc.invalidateQueries({ queryKey: ['group', id] }); navigate(-1); },
    onError: (e) => toast(apiError(e), 'red'),
  });

  if (isLoading || !g) return <Screen nav={false}><SubHeader title="Ký quy ước" /><Spinner /></Screen>;

  return (
    <Screen nav={false}>
      <SubHeader title="Thỏa thuận điện tử" />
      <div className="px-safe-margin pt-3">
        <Card className="p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="gavel" className="text-secondary" />
            <h4 className="font-title-lg text-title-lg text-on-surface">{g.name}</h4>
          </div>
          <pre className="whitespace-pre-wrap text-body-sm text-on-surface-variant font-sans leading-relaxed">{g.agreementText}</pre>
        </Card>

        <Card className="p-4 bg-tertiary/5 border-tertiary/20 mb-4">
          <p className="text-body-sm text-on-surface-variant flex gap-2">
            <Icon name="lock" size={18} className="text-tertiary flex-shrink-0" />
            Chữ ký điện tử của bạn sẽ được mã hóa & lưu vết (hash) cùng thời điểm ký, có giá trị đối soát pháp lý khi xảy ra tranh chấp.
          </p>
        </Card>

        <button onClick={() => setAgreed(!agreed)} className="flex items-start gap-3 w-full text-left mb-4">
          <span className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${agreed ? 'bg-secondary border-secondary' : 'border-outline-variant'}`}>
            {agreed && <Icon name="check" size={18} className="text-white" />}
          </span>
          <span className="text-body-sm text-on-surface">Tôi đã đọc, hiểu rõ và đồng ý với toàn bộ quy ước của dây hụi này, cam kết thực hiện đầy đủ nghĩa vụ đóng hụi.</span>
        </button>
      </div>
      <div className="px-safe-margin py-4">
        <Button full disabled={!agreed} loading={sign.isPending} onClick={() => sign.mutate()} icon="draw" className="py-4">Ký quy ước điện tử</Button>
      </div>
    </Screen>
  );
}
