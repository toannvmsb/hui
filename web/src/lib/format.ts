import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('vi');

export function vnd(n: number | undefined | null, withSymbol = true): string {
  const v = Math.round(Number(n || 0)).toLocaleString('vi-VN');
  return withSymbol ? `${v}đ` : v;
}

/** Rút gọn: 5.000.000 → 5tr, 1.500.000.000 → 1,5 tỷ */
export function vndShort(n: number | undefined | null): string {
  const v = Number(n || 0);
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(v % 1_000_000_000 === 0 ? 0 : 1).replace('.', ',')} tỷ`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1).replace('.', ',')}tr`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return v.toLocaleString('vi-VN');
}

export function fmtDate(d?: string | Date | null, f = 'DD/MM/YYYY'): string {
  if (!d) return '—';
  return dayjs(d).format(f);
}

export function fromNow(d?: string | Date | null): string {
  if (!d) return '';
  return dayjs(d).fromNow();
}

export function daysUntil(d?: string | null): number {
  if (!d) return 0;
  return dayjs(d).startOf('day').diff(dayjs().startOf('day'), 'day');
}

export const HUI_TYPE_LABEL: Record<string, string> = { DEAD: 'Hụi chết', LIVE: 'Hụi sống' };
export const MODE_LABEL: Record<string, string> = { SELF: 'Tự quản', SECURED: 'Có bảo đảm' };
export const CYCLE_UNIT_LABEL: Record<string, string> = { DAY: 'ngày', WEEK: 'tuần', MONTH: 'tháng' };

export function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
