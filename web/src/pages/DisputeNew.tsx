import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Button, Icon, Input, Field, Card } from '../components/ui';
import { useToast } from '../store/toast';

const CATS = [
  ['OWNERSHIP', 'Quyền sở hữu suất'], ['PRICE', 'Giá bán suất'], ['OBLIGATION', 'Nghĩa vụ sau chuyển nhượng'],
  ['BID_RESULT', 'Kết quả giật hụi'], ['OTHER', 'Khác'],
];

export default function DisputeNew() {
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();
  const [category, setCategory] = useState('BID_RESULT');
  const [groupId, setGroupId] = useState('');
  const [subject, setSubject] = useState('');
  const [detail, setDetail] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);

  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: async () => (await api.get('/groups')).data as any[] });

  const create = useMutation({
    mutationFn: () => api.post('/me/disputes', { category, groupId: groupId || undefined, subject, detail, evidenceUrls: evidence }),
    onSuccess: () => { toast('Đã gửi khiếu nại. Admin sẽ xử lý sớm.'); qc.invalidateQueries({ queryKey: ['disputes'] }); navigate('/disputes'); },
    onError: (e) => toast(apiError(e), 'red'),
  });

  return (
    <Screen nav={false}>
      <SubHeader title="Gửi khiếu nại" />
      <div className="px-safe-margin pt-3 space-y-4">
        <div>
          <p className="text-label-md font-semibold text-on-surface-variant mb-1.5">Loại tranh chấp</p>
          <div className="flex flex-wrap gap-2">
            {CATS.map(([k, l]) => (
              <button key={k} onClick={() => setCategory(k)} className={`px-3 py-2 rounded-full text-label-md font-semibold ${category === k ? 'bg-secondary text-white' : 'bg-surface-container-high text-on-surface-variant'}`}>{l}</button>
            ))}
          </div>
        </div>

        <Field label="Dây hụi liên quan (tùy chọn)">
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-4 py-3 text-body-md outline-none focus:border-tertiary">
            <option value="">— Không chọn —</option>
            {(groups || []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>

        <Field label="Tiêu đề"><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Tóm tắt vấn đề" /></Field>

        <Field label="Nội dung chi tiết">
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={5} placeholder="Mô tả chi tiết sự việc, thời gian, số tiền liên quan..." className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-4 py-3 text-body-md outline-none focus:border-tertiary resize-none" />
        </Field>

        <button onClick={() => setEvidence([...evidence, `evidence-${evidence.length + 1}.jpg`])} className="w-full border-2 border-dashed border-outline-variant/40 rounded-xl p-4 flex items-center justify-center gap-2 text-on-surface-variant active:scale-[0.98]">
          <Icon name="add_photo_alternate" /> Đính kèm bằng chứng ({evidence.length})
        </button>
        {evidence.length > 0 && (
          <Card className="p-3 flex gap-2 flex-wrap">
            {evidence.map((e, i) => <div key={i} className="px-3 py-1.5 bg-surface-container rounded-lg text-label-md text-on-surface-variant flex items-center gap-1"><Icon name="image" size={14} />{e}</div>)}
          </Card>
        )}
      </div>
      <div className="px-safe-margin py-4">
        <Button full loading={create.isPending} disabled={!subject || !detail} onClick={() => create.mutate()}>Gửi khiếu nại</Button>
      </div>
    </Screen>
  );
}
