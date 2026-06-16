import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Badge, Icon, Spinner, EmptyState } from '../components/ui';
import { fromNow } from '../lib/format';

const LEVEL: Record<string, { tone: any; label: string; color: string }> = {
  HIGH: { tone: 'red', label: 'Cao', color: 'error' },
  MEDIUM: { tone: 'amber', label: 'Trung bình', color: 'warning' },
  LOW: { tone: 'blue', label: 'Thấp', color: 'tertiary' },
};
const TYPE_LABEL: Record<string, string> = {
  LATE_PAYMENT: 'Chậm đóng', BREAK_RISK: 'Nguy cơ vỡ hụi', FRAUD: 'Gian lận', TRANSFER_ANOMALY: 'Chuyển nhượng bất thường',
};

export default function Alerts() {
  const { data, isLoading } = useQuery({ queryKey: ['risk-alerts'], queryFn: async () => (await api.get('/me/risk-alerts')).data as any[] });

  return (
    <Screen nav={false}>
      <SubHeader title="Cảnh báo rủi ro" />
      <div className="px-safe-margin pt-3">
        {isLoading ? <Spinner /> : !data?.length ? (
          <EmptyState icon="verified_user" title="Không có cảnh báo" desc="Các dây hụi của bạn đang an toàn." />
        ) : (
          <div className="space-y-3">
            {data.map((a) => {
              const lv = LEVEL[a.level] || LEVEL.LOW;
              return (
                <Card key={a.id} className={`p-4 border-${lv.color}/30`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-${lv.color}/10 flex-shrink-0`}>
                      <Icon name="warning" fill size={20} className={`text-${lv.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-body-md text-on-surface">{a.title}</p>
                      </div>
                      <p className="text-body-sm text-on-surface-variant mb-2">{a.message}</p>
                      <div className="flex gap-2 items-center">
                        <Badge tone={lv.tone}>{TYPE_LABEL[a.type] || a.type}</Badge>
                        <span className="text-label-md text-on-surface-variant">{fromNow(a.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Screen>
  );
}
