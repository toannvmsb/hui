import { ReactNode, ButtonHTMLAttributes, useEffect } from 'react';
import { initials } from '../lib/format';

export function Icon({ name, className = '', fill = false, size }: { name: string; className?: string; fill?: boolean; size?: number }) {
  return (
    <span
      className={`material-symbols-outlined ${fill ? 'ms-fill' : ''} ${className}`}
      style={size ? { fontSize: size } : undefined}
    >
      {name}
    </span>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
  full?: boolean;
  loading?: boolean;
  icon?: string;
};
export function Button({ variant = 'primary', full, loading, icon, children, className = '', disabled, ...rest }: BtnProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl px-5 py-3 text-body-sm transition-all active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100';
  const variants: Record<string, string> = {
    primary: 'bg-secondary text-white shadow-sm hover:shadow-lg',
    secondary: 'border border-secondary text-secondary hover:bg-secondary/5 bg-white',
    ghost: 'text-on-surface-variant hover:bg-surface-container',
    danger: 'bg-error text-white hover:shadow-lg',
    dark: 'bg-primary-container text-white hover:shadow-lg',
  };
  return (
    <button className={`${base} ${variants[variant]} ${full ? 'w-full' : ''} ${className}`} disabled={disabled || loading} {...rest}>
      {loading ? <Icon name="progress_activity" className="animate-spin" size={20} /> : icon ? <Icon name={icon} size={20} /> : null}
      {children}
    </button>
  );
}

export function Card({ children, className = '', onClick, glass }: { children: ReactNode; className?: string; onClick?: () => void; glass?: boolean }) {
  return (
    <div
      onClick={onClick}
      className={`${glass ? 'glass-card' : 'bg-white'} rounded-2xl border border-outline-variant/20 shadow-sm ${onClick ? 'active:scale-[0.98] transition-transform cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

const BADGE: Record<string, string> = {
  green: 'bg-secondary/10 text-secondary',
  amber: 'bg-warning/10 text-warning',
  purple: 'bg-harvest/10 text-harvest',
  blue: 'bg-tertiary/10 text-tertiary',
  red: 'bg-error/10 text-error',
  gray: 'bg-surface-container-high text-on-surface-variant',
};
export function Badge({ tone = 'gray', children, icon }: { tone?: keyof typeof BADGE; children: ReactNode; icon?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-label-md font-semibold ${BADGE[tone]}`}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

export function Avatar({ name, color = '#006c49', size = 40, src }: { name: string; color?: string; size?: number; src?: string }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden"
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}
    >
      {src ? <img src={src} className="w-full h-full object-cover" /> : initials(name)}
    </div>
  );
}

export function ProgressBar({ value, gradient = 'from-secondary to-secondary-fixed', className = '' }: { value: number; gradient?: string; className?: string }) {
  return (
    <div className={`w-full bg-surface-variant h-2 rounded-full overflow-hidden ${className}`}>
      <div className={`bg-gradient-to-r ${gradient} h-full rounded-full transition-all`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant gap-3">
      <Icon name="progress_activity" className="animate-spin text-secondary" size={36} />
      {label && <p className="text-body-sm">{label}</p>}
    </div>
  );
}

export function EmptyState({ icon, title, desc, action }: { icon: string; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-2">
      <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-2">
        <Icon name={icon} size={32} className="text-on-surface-variant" />
      </div>
      <h3 className="font-semibold text-title-lg text-on-surface">{title}</h3>
      {desc && <p className="text-body-sm text-on-surface-variant max-w-xs">{desc}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-label-md font-semibold text-on-surface-variant mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="text-label-md text-on-surface-variant/70 mt-1 block">{hint}</span>}
    </label>
  );
}

export function Input({ className = '', ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-4 py-3 text-body-md text-on-surface outline-none focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 transition-all ${className}`}
      {...rest}
    />
  );
}

/** Bottom sheet modal */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 animate-fade-in" />
      <div className="relative w-full max-w-md bg-surface rounded-t-3xl p-6 pb-8 animate-slide-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-4" />
        {title && <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

export function Toast({ msg, tone = 'green' }: { msg: string; tone?: 'green' | 'red' }) {
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-xl shadow-xl text-white text-body-sm font-medium animate-fade-in ${tone === 'green' ? 'bg-secondary' : 'bg-error'}`}>
      {msg}
    </div>
  );
}
