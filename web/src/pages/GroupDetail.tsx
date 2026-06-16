import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Badge, Button, Spinner, Icon, Avatar, ProgressBar, Sheet, Input, Field } from '../components/ui';
import { vnd, vndShort, fmtDate, HUI_TYPE_LABEL, MODE_LABEL, CYCLE_UNIT_LABEL } from '../lib/format';
import { useToast } from '../store/toast';
import { ShareSheet } from '../components/ShareGroup';

const TABS = ['Tổng quan', 'Kỳ hụi', 'Suất', 'Thành viên', 'Quy ước'];

const CYCLE_STATUS: Record<string, { label: string; tone: any }> = {
  PENDING: { label: 'Chờ', tone: 'gray' },
  COLLECTING: { label: 'Đang đóng', tone: 'amber' },
  BIDDING: { label: 'Đang đấu', tone: 'blue' },
  PAID: { label: 'Đã hốt', tone: 'purple' },
  CLOSED: { label: 'Đã đóng', tone: 'green' },
};

export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [approveUser, setApproveUser] = useState<any>(null);
  const [slotCount, setSlotCount] = useState('1');
  const [shareOpen, setShareOpen] = useState(false);

  const { data: g, isLoading } = useQuery({ queryKey: ['group', id], queryFn: async () => (await api.get(`/groups/${id}`)).data });

  function mutate(fn: () => Promise<any>, ok: string) {
    return async () => {
      try { const r = await fn(); toast(ok); qc.invalidateQueries({ queryKey: ['group', id] }); qc.invalidateQueries({ queryKey: ['groups'] }); return r; }
      catch (e) { toast(apiError(e), 'red'); }
    };
  }

  const sign = useMutation({ mutationFn: () => api.post(`/groups/${id}/sign`), onSuccess: mutate(async () => {}, 'Đã ký quy ước') });
  const activate = useMutation({ mutationFn: () => api.post(`/groups/${id}/activate`), onSuccess: () => { toast('Dây hụi đã kích hoạt! 🎉'); qc.invalidateQueries({ queryKey: ['group', id] }); }, onError: (e) => toast(apiError(e), 'red') });
  const approve = useMutation({ mutationFn: (p: { uid: string; n: number }) => api.post(`/groups/${id}/members/${p.uid}/approve`, { slotCount: p.n }), onSuccess: () => { toast('Đã duyệt thành viên'); setApproveUser(null); qc.invalidateQueries({ queryKey: ['group', id] }); }, onError: (e) => toast(apiError(e), 'red') });
  const reject = useMutation({ mutationFn: (uid: string) => api.post(`/groups/${id}/members/${uid}/reject`), onSuccess: () => { toast('Đã từ chối'); qc.invalidateQueries({ queryKey: ['group', id] }); } });
  const closeAuction = useMutation({ mutationFn: (cid: string) => api.post(`/groups/cycles/${cid}/close-auction`), onSuccess: () => { toast('Đã chốt kết quả đấu'); qc.invalidateQueries({ queryKey: ['group', id] }); }, onError: (e) => toast(apiError(e), 'red') });
  const harvest = useMutation({ mutationFn: (cid: string) => api.post(`/groups/cycles/${cid}/harvest`), onSuccess: (r) => { toast(`Đã chi trả ${vnd(r.data.payout)}!`); qc.invalidateQueries({ queryKey: ['group', id] }); }, onError: (e) => toast(apiError(e), 'red') });

  if (isLoading || !g) return <Screen nav={false}><SubHeader title="Chi tiết dây hụi" /><Spinner /></Screen>;

  const paidCycles = g.cycles.filter((c: any) => c.status === 'PAID').length;
  const totalValue = g.totalSlots * g.amountPerSlot * g.totalCycles;
  const pendingMembers = g.members.filter((m: any) => m.status === 'PENDING');

  return (
    <Screen nav={false}>
      <SubHeader title={g.name} right={
        <div className="flex">
          <button onClick={() => setShareOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container"><Icon name="person_add" className="text-secondary" /></button>
          <button onClick={() => navigate(`/evidence/${id}`)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container"><Icon name="download" className="text-on-surface" /></button>
        </div>
      } />

      {/* Hero summary */}
      <div className="px-safe-margin pt-2">
        <div className="bg-primary-container text-white rounded-3xl p-5 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-secondary/20 rounded-full blur-2xl" />
          <div className="flex gap-2 flex-wrap mb-3">
            <Badge tone="green">{HUI_TYPE_LABEL[g.huiType]}</Badge>
            <Badge tone={g.mode === 'SECURED' ? 'purple' : 'blue'}>{MODE_LABEL[g.mode]}</Badge>
            <span className="bg-white/10 text-white px-3 py-1 rounded-full text-label-md font-semibold">#{g.code}</span>
          </div>
          <p className="text-label-md text-on-primary-container">Tổng giá trị dây</p>
          <p className="font-headline-md text-headline-md text-white mb-3 tabular-nums">{vnd(totalValue)}</p>
          <div className="flex justify-between text-body-sm">
            <span className="text-white/70">{g.amountPerSlot.toLocaleString('vi-VN')}đ/suất/{CYCLE_UNIT_LABEL[g.cycleUnit]}</span>
            <span className="text-white/70">{g.totalSlots} suất • {g.totalCycles} kỳ</span>
          </div>
          <ProgressBar value={(paidCycles / g.totalCycles) * 100} className="mt-3 bg-white/20" />
          <p className="text-label-md text-white/60 mt-1.5">Đã hoàn thành {paidCycles}/{g.totalCycles} kỳ</p>
        </div>
      </div>

      {/* Organizer activation banner */}
      {g.isOrganizer && g.status !== 'ACTIVE' && g.status !== 'COMPLETED' && (
        <div className="px-safe-margin mt-3">
          <Card className="p-4 border-secondary/40 bg-secondary/5">
            <p className="font-semibold text-body-md text-on-surface mb-1">Kích hoạt dây hụi</p>
            <p className="text-body-sm text-on-surface-variant mb-3">
              {!g.allSlotsAssigned ? '• Còn suất trống chưa gán cho thành viên' : '✓ Đã gán đủ suất'}<br />
              {!g.allSigned ? '• Chưa đủ thành viên ký quy ước' : '✓ Tất cả đã ký quy ước'}
            </p>
            <Button full disabled={!g.allSlotsAssigned || !g.allSigned} loading={activate.isPending} onClick={() => activate.mutate()}>
              Kích hoạt (phí {vnd(g.creationFee)})
            </Button>
          </Card>
        </div>
      )}

      {/* Member sign banner */}
      {g.myMembership && !g.myMembership.signed && g.status !== 'COMPLETED' && (
        <div className="px-safe-margin mt-3">
          <Card className="p-4 border-warning/40 bg-warning/5 flex items-center gap-3">
            <Icon name="draw" className="text-warning" size={28} />
            <div className="flex-1">
              <p className="font-semibold text-body-md text-on-surface">Bạn chưa ký quy ước</p>
              <p className="text-body-sm text-on-surface-variant">Ký để dây hụi có thể hoạt động</p>
            </div>
            <Button className="py-2 px-4" onClick={() => navigate(`/groups/${id}/sign`)}>Ký ngay</Button>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="px-safe-margin mt-4 sticky top-[60px] z-30 bg-background/80 backdrop-blur-sm">
        <div className="flex gap-1 bg-surface-container rounded-xl p-1 overflow-x-auto no-scrollbar">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} className={`flex-1 whitespace-nowrap px-3 py-2 rounded-lg text-label-md font-semibold transition-colors ${tab === i ? 'bg-white text-secondary shadow-sm' : 'text-on-surface-variant'}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="px-safe-margin mt-4 pb-8">
        {/* TỔNG QUAN */}
        {tab === 0 && (
          <div className="space-y-3">
            {g.currentCycle && g.myContributions?.length > 0 && (
              <Card className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-title-lg text-title-lg text-on-surface">Nghĩa vụ kỳ {g.currentCycle.cycleNo}</h4>
                  <Badge tone={CYCLE_STATUS[g.currentCycle.status]?.tone}>{CYCLE_STATUS[g.currentCycle.status]?.label}</Badge>
                </div>
                {g.myContributions.map((c: any) => (
                  <div key={c.id} className="flex justify-between items-center py-1.5">
                    <span className="text-body-md text-on-surface">Suất {c.slotCode}</span>
                    {c.status === 'PAID' ? <Badge tone="green" icon="check">Đã đóng</Badge> :
                      <span className="text-body-md font-semibold text-warning tabular-nums">{vnd(c.amount)}</span>}
                  </div>
                ))}
                {g.myContributions.some((c: any) => c.status !== 'PAID') && (
                  <Button full className="mt-3" onClick={() => navigate(`/groups/${id}/contribute`)}>Đóng hụi kỳ này</Button>
                )}
                {g.huiType === 'LIVE' && g.currentCycle.status !== 'PAID' && (
                  <Button full variant="secondary" className="mt-2" icon="gavel" onClick={() => navigate(`/cycles/${g.currentCycle.id}/auction`)}>Vào phiên đấu hụi</Button>
                )}
              </Card>
            )}
            <InfoRow icon="person" label="Chủ hụi" value={g.organizer.fullName} />
            <InfoRow icon="event" label="Ngày chốt mỗi kỳ" value={`Ngày ${g.closingDay} hàng ${CYCLE_UNIT_LABEL[g.cycleUnit]}`} />
            <InfoRow icon="gavel" label="Hình thức" value={g.huiType === 'LIVE' ? `Đấu giật (${g.bidRule === 'SEALED' ? 'đấu kín' : 'công khai'})` : 'Hốt theo thứ tự'} />
            {g.mode === 'SECURED' && <InfoRow icon="shield" label="Bảo đảm" value="Có đối tác bảo đảm trả thay" />}
            <InfoRow icon="swap_horiz" label="Chuyển nhượng" value={g.allowExternalTransfer ? 'Cho phép cả người ngoài' : 'Chỉ trong dây'} />
          </div>
        )}

        {/* KỲ HỤI (timeline) */}
        {tab === 1 && (
          <div className="relative pl-6">
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-outline-variant/40" />
            {g.cycles.map((c: any) => (
              <div key={c.id} className="relative mb-4">
                <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white ${c.status === 'PAID' ? 'bg-harvest' : c.status === 'COLLECTING' || c.status === 'BIDDING' ? 'bg-warning' : 'bg-surface-variant'}`} />
                <Card className="p-3.5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-body-md text-on-surface">Kỳ {c.cycleNo}</span>
                    <Badge tone={CYCLE_STATUS[c.status]?.tone}>{CYCLE_STATUS[c.status]?.label}</Badge>
                  </div>
                  <p className="text-body-sm text-on-surface-variant">Chốt: {fmtDate(c.dueDate)}</p>
                  {c.status !== 'PENDING' && (
                    <div className="mt-2">
                      <ProgressBar value={c.totalCount ? (c.paidCount / c.totalCount) * 100 : 0} />
                      <p className="text-label-md text-on-surface-variant mt-1">{c.paidCount}/{c.totalCount} suất đã đóng • Quỹ {vndShort(c.potAmount)}</p>
                    </div>
                  )}
                  {c.status === 'PAID' && (
                    <p className="text-body-sm text-harvest font-semibold mt-1.5 flex items-center gap-1"><Icon name="emoji_events" size={16} fill />Suất {c.winnerSlotCode} hốt {vnd(c.payoutAmount)}{c.bidAmount > 0 ? ` (giật ${vndShort(c.bidAmount)})` : ''}</p>
                  )}
                  {/* organizer controls */}
                  {g.isOrganizer && (c.status === 'BIDDING') && (
                    <Button full className="mt-2 py-2" loading={closeAuction.isPending} onClick={() => closeAuction.mutate(c.id)}>Chốt kết quả đấu</Button>
                  )}
                  {g.isOrganizer && (c.status === 'COLLECTING') && c.paidCount === c.totalCount && c.totalCount > 0 && (g.huiType === 'DEAD' || c.winnerSlotCode) && (
                    <Button full className="mt-2 py-2" loading={harvest.isPending} onClick={() => harvest.mutate(c.id)}>Chốt & chi trả người hốt</Button>
                  )}
                </Card>
              </div>
            ))}
            {g.cycles.length === 0 && <p className="text-body-sm text-on-surface-variant text-center py-8">Dây chưa kích hoạt — lịch kỳ sẽ tạo khi active.</p>}
          </div>
        )}

        {/* SUẤT */}
        {tab === 2 && (
          <div className="grid grid-cols-2 gap-2.5">
            {g.slots.map((s: any) => (
              <Card key={s.id} className={`p-3 ${s.isMine ? 'border-secondary/50 bg-secondary/5' : ''}`} onClick={() => navigate(`/slots/${s.id}`)}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-body-md text-on-surface">{s.slotCode}</span>
                  {s.hasDrawn ? <Badge tone="purple">Đã hốt</Badge> : s.lockedReason ? <Badge tone="amber">Khóa</Badge> : <Badge tone="green">Hoạt động</Badge>}
                </div>
                {s.ownerName ? (
                  <div className="flex items-center gap-2">
                    <Avatar name={s.ownerName} color={s.ownerColor} size={24} />
                    <span className="text-body-sm text-on-surface truncate">{s.isMine ? 'Bạn' : s.ownerName}</span>
                  </div>
                ) : <span className="text-body-sm text-on-surface-variant italic">Suất trống</span>}
                {s.guaranteeStatus !== 'NONE' && <p className="text-label-md text-harvest mt-1 flex items-center gap-1"><Icon name="shield" size={12} />Có bảo đảm</p>}
              </Card>
            ))}
          </div>
        )}

        {/* THÀNH VIÊN */}
        {tab === 3 && (
          <div className="space-y-2">
            <button onClick={() => setShareOpen(true)} className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 border-dashed border-secondary/40 bg-secondary/5 active:scale-[0.98] transition-transform mb-1">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center"><Icon name="qr_code_2" className="text-white" /></div>
              <div className="text-left flex-1"><p className="font-semibold text-body-md text-secondary">Mời thành viên qua link / QR</p><p className="text-label-md text-on-surface-variant">Chia sẻ để người khác vào thẳng dây này</p></div>
              <Icon name="chevron_right" className="text-secondary" />
            </button>
            {g.isOrganizer && pendingMembers.length > 0 && (
              <p className="text-label-md font-semibold text-warning uppercase tracking-wide">Chờ duyệt ({pendingMembers.length})</p>
            )}
            {pendingMembers.map((m: any) => (
              <Card key={m.userId} className="p-3 flex items-center gap-3 border-warning/30">
                <Avatar name={m.fullName} color={m.avatarColor} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-body-md text-on-surface truncate">{m.fullName}</p>
                  <p className="text-body-sm text-on-surface-variant">Điểm uy tín: {m.creditScore}</p>
                </div>
                {g.isOrganizer && (
                  <div className="flex gap-1.5">
                    <button onClick={() => { setApproveUser(m); setSlotCount('1'); }} className="w-9 h-9 rounded-full bg-secondary text-white flex items-center justify-center active:scale-90"><Icon name="check" size={20} /></button>
                    <button onClick={() => reject.mutate(m.userId)} className="w-9 h-9 rounded-full bg-error/10 text-error flex items-center justify-center active:scale-90"><Icon name="close" size={20} /></button>
                  </div>
                )}
              </Card>
            ))}
            {g.members.filter((m: any) => m.status === 'APPROVED').map((m: any) => (
              <Card key={m.userId} className="p-3 flex items-center gap-3">
                <Avatar name={m.fullName} color={m.avatarColor} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-body-md text-on-surface truncate">{m.fullName} {m.role === 'ORGANIZER' && <span className="text-label-md text-secondary">• Chủ hụi</span>}</p>
                  <p className="text-body-sm text-on-surface-variant">{m.slotCount} suất • Uy tín {m.creditScore}</p>
                </div>
                {m.signed ? <Icon name="verified" className="text-secondary" fill /> : <Badge tone="amber">Chưa ký</Badge>}
              </Card>
            ))}
          </div>
        )}

        {/* QUY ƯỚC */}
        {tab === 4 && (
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="gavel" className="text-secondary" />
              <h4 className="font-title-lg text-title-lg text-on-surface">Quy ước dây hụi</h4>
            </div>
            <pre className="whitespace-pre-wrap text-body-sm text-on-surface-variant font-sans leading-relaxed">{g.agreementText}</pre>
            <div className="mt-4 pt-4 border-t border-outline-variant/20">
              <p className="text-label-md text-on-surface-variant">Bản quy ước được lưu vết & có giá trị đối soát khi tranh chấp.</p>
              {g.myMembership && !g.myMembership.signed && (
                <Button full className="mt-3" onClick={() => navigate(`/groups/${id}/sign`)}>Ký quy ước điện tử</Button>
              )}
            </div>
          </Card>
        )}
      </div>

      <Sheet open={!!approveUser} onClose={() => setApproveUser(null)} title="Duyệt & gán suất">
        {approveUser && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <Avatar name={approveUser.fullName} color={approveUser.avatarColor} />
              <div><p className="font-semibold text-on-surface">{approveUser.fullName}</p><p className="text-body-sm text-on-surface-variant">Uy tín {approveUser.creditScore}</p></div>
            </div>
            <Field label="Số suất gán cho thành viên này">
              <Input type="number" min="1" value={slotCount} onChange={(e) => setSlotCount(e.target.value)} />
            </Field>
            <Button full className="mt-4" loading={approve.isPending} onClick={() => approve.mutate({ uid: approveUser.userId, n: Number(slotCount) })}>Xác nhận duyệt</Button>
          </>
        )}
      </Sheet>

      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} code={g.code} name={g.name} />
    </Screen>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <Card className="p-3.5 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center"><Icon name={icon} className="text-secondary" size={20} /></div>
      <div className="flex-1"><p className="text-label-md text-on-surface-variant">{label}</p><p className="text-body-md font-medium text-on-surface">{value}</p></div>
    </Card>
  );
}
