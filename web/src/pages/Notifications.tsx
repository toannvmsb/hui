import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Screen, SubHeader } from '../components/Layout';
import { Card, Icon, Spinner, EmptyState } from '../components/ui';
import { fromNow } from '../lib/format';

const META: Record<string, { icon: string; color: string }> = {
  PAYMENT_DUE: { icon: 'savings', color: 'warning' },
  BID_OPEN: { icon: 'gavel', color: 'tertiary' },
  PAYOUT: { icon: 'emoji_events', color: 'harvest' },
  TRANSFER: { icon: 'swap_horiz', color: 'secondary' },
  RISK: { icon: 'warning', color: 'error' },
  SYSTEM: { icon: 'notifications', color: 'secondary' },
};

export default function Notifications() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['notifications'], queryFn: async () => (await api.get('/me/notifications')).data as any[] });

  useEffect(() => {
    api.post('/me/notifications/read-all').then(() => { qc.invalidateQueries({ queryKey: ['unread'] }); });
  }, []);

  return (
    <Screen nav={false}>
      <SubHeader title="Thông báo" />
      <div className="px-safe-margin pt-3">
        {isLoading ? <Spinner /> : !data?.length ? <EmptyState icon="notifications_off" title="Chưa có thông báo" /> : (
          <div className="space-y-2">
            {data.map((n) => {
              const m = META[n.type] || META.SYSTEM;
              return (
                <Card key={n.id} className={`p-4 flex gap-3 ${!n.read ? 'border-secondary/30 bg-secondary/[0.03]' : ''}`} onClick={() => n.link && navigate(n.link)}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-${m.color}/10 flex-shrink-0`}>
                    <Icon name={m.icon} size={20} className={`text-${m.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-body-md text-on-surface">{n.title}</p>
                    <p className="text-body-sm text-on-surface-variant">{n.body}</p>
                    <p className="text-label-md text-on-surface-variant/70 mt-1">{fromNow(n.createdAt)}</p>
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
