import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Icon, Spinner, Button, Badge } from '../components/ui';
import { vnd, fmtDate } from '../lib/format';
import { useToast } from '../store/toast';

export default function Evidence() {
  const { groupId } = useParams();
  const toast = useToast((s) => s.show);
  const { data, isLoading } = useQuery({ queryKey: ['evidence', groupId], queryFn: async () => (await api.get(`/me/groups/${groupId}/evidence`)).data });

  function download() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `so-hui-${data.code}.json`; a.click();
    URL.revokeObjectURL(url);
    toast('Đã tải sổ hụi điện tử');
  }

  if (isLoading || !data) return <Screen nav={false}><SubHeader title="Sổ hụi điện tử" /><Spinner /></Screen>;

  return (
    <Screen nav={false}>
      <SubHeader title="Sổ hụi điện tử" right={<button onClick={download} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container"><Icon name="download" className="text-secondary" /></button>} />
      <div className="px-safe-margin pt-3">
        <Card className="p-4 mb-4 bg-secondary/5 border-secondary/20">
          <div className="flex items-center gap-2 mb-1"><Icon name="verified_user" className="text-secondary" /><p className="font-semibold text-on-surface">{data.groupName}</p></div>
          <p className="text-label-md text-on-surface-variant">Mã dây #{data.code} • Hash quy ước: {data.agreementHash || '—'}</p>
          <p className="text-body-sm text-on-surface-variant mt-2">Toàn bộ log đóng/giật/chi trả có giá trị đối soát & làm bằng chứng khi tranh chấp.</p>
        </Card>

        <Section title="Log đóng hụi" count={data.contributions.length} icon="savings">
          {data.contributions.map((c: any, i: number) => (
            <Row key={i} left={`Kỳ ${c.cycleNo} • Suất ${c.slot}`} right={vnd(c.amount)} sub={c.receipt ? `BN ${c.receipt} • ${fmtDate(c.paidAt, 'DD/MM HH:mm')}` : 'Chưa đóng'} tone={c.status === 'PAID' ? 'green' : c.status === 'OVERDUE' ? 'red' : 'gray'} status={c.status} />
          ))}
        </Section>

        <Section title="Log đấu giật hụi" count={data.bids.length} icon="gavel">
          {data.bids.length === 0 ? <p className="text-body-sm text-on-surface-variant p-3">Không có (hụi chết / chưa đấu)</p> : data.bids.map((b: any, i: number) => (
            <Row key={i} left={`Kỳ ${b.cycleNo} • Suất ${b.slot}`} right={vnd(b.bidAmount)} sub={b.isWinner ? 'Thắng' : 'Tham gia'} tone={b.isWinner ? 'green' : 'gray'} />
          ))}
        </Section>

        <Section title="Log chi trả lĩnh hụi" count={data.payouts.length} icon="emoji_events">
          {data.payouts.map((p: any, i: number) => (
            <Row key={i} left={`Kỳ ${p.cycleNo}`} right={vnd(p.net)} sub={`Quỹ ${vnd(p.gross)} − phí ${vnd(p.fee)} • BN ${p.receipt}`} tone="purple" />
          ))}
        </Section>

        <Button full variant="secondary" icon="download" onClick={download} className="mt-2 mb-4">Tải toàn bộ sổ hụi (JSON)</Button>
      </div>
    </Screen>
  );
}

function Section({ title, count, icon, children }: any) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2"><Icon name={icon} className="text-secondary" size={20} /><h3 className="font-title-lg text-title-lg text-on-surface">{title}</h3><Badge tone="gray">{count}</Badge></div>
      <Card className="divide-y divide-outline-variant/15">{children}</Card>
    </div>
  );
}
function Row({ left, right, sub, tone, status }: any) {
  return (
    <div className="p-3 flex items-center justify-between">
      <div className="min-w-0"><p className="text-body-md text-on-surface">{left}</p><p className="text-label-md text-on-surface-variant truncate">{sub}</p></div>
      <div className="text-right flex-shrink-0 ml-2">
        <p className="font-semibold text-body-md text-on-surface tabular-nums">{right}</p>
        {status && <Badge tone={tone}>{status === 'PAID' ? 'Đã đóng' : status === 'OVERDUE' ? 'Quá hạn' : status === 'GUARANTEED_PAID' ? 'BĐ trả thay' : 'Chờ'}</Badge>}
      </div>
    </div>
  );
}
