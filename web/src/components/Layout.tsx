import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon, Toast } from './ui';
import { api } from '../lib/api';
import { useToast } from '../store/toast';
import { useAuth } from '../store/auth';

/** Centers the mobile UI inside a phone frame on desktop, full-bleed on mobile. */
export function PhoneFrame({ children }: { children: ReactNode }) {
  const { msg, tone } = useToast();
  return (
    <div className="min-h-[100dvh] flex items-center justify-center sm:py-6 bg-[#e8eaf2]">
      <div className="relative w-full max-w-[430px] min-h-[100dvh] sm:min-h-[880px] sm:max-h-[920px] bg-background sm:rounded-[40px] sm:shadow-2xl overflow-hidden sm:border-8 sm:border-black">
        {msg && <Toast msg={msg} tone={tone} />}
        {children}
      </div>
    </div>
  );
}

const NAV = [
  { to: '/', icon: 'home', label: 'Trang chủ', end: true },
  { to: '/groups', icon: 'group', label: 'Dây hụi' },
  { to: '/slots', icon: 'confirmation_number', label: 'Suất hụi' },
  { to: '/wallet', icon: 'account_balance_wallet', label: 'Ví' },
  { to: '/profile', icon: 'person', label: 'Cá nhân' },
];

export function BottomNav() {
  return (
    <nav className="absolute bottom-0 left-0 w-full z-50 bg-surface/90 backdrop-blur-xl border-t border-outline-variant/30 flex justify-around items-center px-2 pb-5 pt-2 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center rounded-xl px-3 py-1 transition-all active:scale-90 ${
              isActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon name={n.icon} fill={isActive} size={24} />
              <span className="text-label-md mt-0.5">{n.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function TopBar({ title, showNotif = true }: { title?: string; showNotif?: boolean }) {
  const navigate = useNavigate();
  const me = useAuth((s) => s.me);
  const { data } = useQuery({
    queryKey: ['unread'],
    queryFn: async () => (await api.get('/me/notifications/unread-count')).data.count as number,
    refetchInterval: 15000,
  });
  return (
    <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl flex justify-between items-center px-safe-margin py-md border-b border-outline-variant/10">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
          <Icon name="diversity_3" className="text-white" fill size={22} />
        </div>
        <h1 className="font-headline-sm text-headline-sm text-secondary">{title || 'Hụi Thông Minh'}</h1>
      </div>
      {showNotif && (
        <button onClick={() => navigate('/notifications')} className="relative w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container active:scale-95">
          <Icon name="notifications" className="text-on-surface" />
          {!!data && data > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center">{data > 9 ? '9+' : data}</span>
          )}
        </button>
      )}
    </header>
  );
}

/** Secondary screen header with back button */
export function SubHeader({ title, right, onBack }: { title: string; right?: ReactNode; onBack?: () => void }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-xl flex items-center gap-2 px-3 py-3 border-b border-outline-variant/10">
      <button onClick={() => (onBack ? onBack() : navigate(-1))} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container active:scale-95">
        <Icon name="arrow_back" className="text-on-surface" />
      </button>
      <h1 className="font-title-lg text-title-lg text-on-surface flex-1 truncate">{title}</h1>
      {right}
    </header>
  );
}

export function Screen({ children, nav = true, fab, className = '' }: { children: ReactNode; nav?: boolean; fab?: ReactNode; className?: string }) {
  // The scrolling area and the pinned overlays (FAB, bottom nav) are SIBLINGS, both
  // positioned against the non-scrolling phone frame — so the nav/FAB stay fixed at the
  // bottom of the viewport instead of scrolling with the content.
  return (
    <>
      <main className={`absolute inset-0 overflow-y-auto no-scrollbar ${nav ? 'pb-28' : 'pb-8'} ${className}`}>
        {children}
      </main>
      {fab}
      {nav && <BottomNav />}
    </>
  );
}
