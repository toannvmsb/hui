import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Badge, Button, Icon, Spinner, EmptyState, Sheet, Field } from '../components/ui';
import { fromNow } from '../lib/format';
import { useToast } from '../store/toast';

const ACTION: Record<string, { label: string; icon: string; tone: any }> = {
  LOCK_USER: { label: 'Khóa tài khoản', icon: 'lock', tone: 'red' },
  UNLOCK_USER: { label: 'Mở khóa tài khoản', icon: 'lock_open', tone: 'blue' },
  UPDATE_SCORE_CONFIG: { label: 'Cập nhật tham số điểm', icon: 'tune', tone: 'purple' },
};
const STATUS: Record<string, { tone: any; label: string }> = {
  PENDING: { tone: 'amber', label: 'Chờ duyệt' }, APPROVED: { tone: 'green', label: 'Đã duyệt' }, REJECTED: { tone: 'red', label: 'Từ chối' },
};

export default function AdminApprovals() {
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();
  const [reject, setReject] = useState<any>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['admin-approvals'], queryFn: async () => (await api.get('/admin/approvals')).data as any[] });

  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-approvals'] }); qc.invalidateQueries({ queryKey: ['approvals-count'] }); qc.invalidateQueries({ queryKey: ['admin-users'] }); };
  const approve = useMutation({ mutationFn: (id: string) => api.post(`/admin/approvals/${id}/approve`), onSuccess: () => { toast('Đã phê duyệt & thực thi'); refresh(); }, onError: (e) => toast(apiError(e), 'red') });
  const doReject = useMutation({ mutationFn: () => api.post(`/admin/approvals/${reject.id}/reject`, { reason }), onSuccess: () => { toast('Đã từ chối'); setReject(null); setReason(''); refresh(); }, onError: (e) => toast(apiError(e), 'red') });

  const pending = (data || []).filter((a) => a.status === 'PENDING');
  const history = (data || []).filter((a) => a.status !== 'PENDING');

  return (
    <Screen nav={false}>
      <SubHeader title="Phê duyệt 4 mắt" />
      <div className="px-safe-margin pt-3">
        <Card className="p-4 mb-4 bg-tertiary/5 border-tertiary/20 flex gap-2">
          <Icon name="groups_2" size={18} className="text-tertiary flex-shrink-0" />
          <p className="text-body-sm text-on-surface-variant">Các thao tác rủi ro cao (khóa tài khoản, đổi tham số điểm) cần <b>admin thứ 2</b> phê duyệt. Người tạo yêu cầu không thể tự duyệt.</p>
        </Card>

        {isLoading ? <Spinner /> : (
          <>
            <h3 className="font-title-lg text-title-lg text-on-surface mb-2">Chờ duyệt ({pending.length})</h3>
            {pending.length === 0 ? <EmptyState icon="task_alt" title="Không có yêu cầu chờ" /> : (
              <div className="space-y-2 mb-5">
                {pending.map((a) => {
                  const ac = ACTION[a.action] || ACTION.LOCK_USER;
                  return (
                    <Card key={a.id} className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${ac.tone === 'red' ? 'error' : ac.tone === 'blue' ? 'tertiary' : 'harvest'}/10`}><Icon name={ac.icon} className={`text-${ac.tone === 'red' ? 'error' : ac.tone === 'blue' ? 'tertiary' : 'harvest'}`} /></div>
                        <div className="flex-1">
                          <p className="font-semibold text-body-md text-on-surface">{a.summary}</p>
                          <p className="text-label-md text-on-surface-variant">Đề xuất bởi {a.makerName} • {fromNow(a.createdAt)}</p>
                        </div>
                      </div>
                      {a.isMine ? (
                        <div className="bg-surface-container-low rounded-xl p-2.5 text-center text-body-sm text-on-surface-variant flex items-center justify-center gap-1">
                          <Icon name="hourglass_empty" size={16} /> Bạn là người đề xuất — chờ admin khác duyệt
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="secondary" className="py-2" onClick={() => { setReject(a); setReason(''); }}>Từ chối</Button>
                          <Button className="py-2" loading={approve.isPending} onClick={() => approve.mutate(a.id)}>Phê duyệt</Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}

            {history.length > 0 && (
              <>
                <h3 className="font-title-lg text-title-lg text-on-surface mb-2">Lịch sử</h3>
                <div className="space-y-2">
                  {history.map((a) => {
                    const ac = ACTION[a.action] || ACTION.LOCK_USER;
                    return (
                      <Card key={a.id} className="p-3.5 flex items-center gap-3 opacity-90">
                        <Icon name={ac.icon} className="text-on-surface-variant" />
                        <div className="flex-1 min-w-0">
                          <p className="text-body-md text-on-surface truncate">{a.summary}</p>
                          <p className="text-label-md text-on-surface-variant">{a.makerName} → {a.checkerName} • {fromNow(a.decidedAt)}{a.reason ? ` • ${a.reason}` : ''}</p>
                        </div>
                        <Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <Sheet open={!!reject} onClose={() => setReject(null)} title="Từ chối yêu cầu">
        {reject && (
          <>
            <p className="text-body-sm text-on-surface-variant mb-3">{reject.summary}</p>
            <Field label="Lý do từ chối (tùy chọn)">
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-4 py-3 text-body-md outline-none focus:border-tertiary resize-none" placeholder="Nêu lý do..." />
            </Field>
            <Button full variant="danger" className="mt-3" loading={doReject.isPending} onClick={() => doReject.mutate()}>Xác nhận từ chối</Button>
          </>
        )}
      </Sheet>
    </Screen>
  );
}
