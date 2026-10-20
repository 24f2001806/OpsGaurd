import type { Endpoint, HistoryItem } from './api';

export function isDownish(state: string) {
  return state === 'DOWN' || state === 'SUSPECTED_DOWN';
}

// Label + colours for the status badge of one website.
export function stateInfo(state: string, enabled = true) {
  if (!enabled) {
    return { label: 'PAUSED', badge: 'bg-[#64748B]/10 text-[#94A3B8] border border-[#64748B]/30' };
  }
  switch (state) {
    case 'HEALTHY':
      return { label: 'HEALTHY', badge: 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30' };
    case 'DOWN':
      return { label: 'DOWN', badge: 'bg-[#FF0055]/10 text-[#FF0055] border border-[#FF0055]/40 animate-pulse' };
    case 'SUSPECTED_DOWN':
      return { label: 'SUSPECTED DOWN', badge: 'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/40' };
    default:
      return { label: 'PENDING', badge: 'bg-[#64748B]/10 text-[#94A3B8] border border-[#64748B]/30' };
  }
}

// "60s" normally, "10s FAST" while the website is failing.
export function modeLabel(ep: Endpoint) {
  return isDownish(ep.current_state) ? `${ep.fast_check_interval}s FAST` : `${ep.check_interval}s`;
}

export function formatMs(value: number | null | undefined) {
  return value == null ? '—' : `${Math.round(value)}ms`;
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
}

export function formatClock(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// Share of successful checks, as a percentage. null when there are no checks yet.
export function uptimePercent(items: HistoryItem[]): number | null {
  if (items.length === 0) return null;
  const ok = items.filter((i) => i.is_success).length;
  return Math.round((ok / items.length) * 10000) / 100;
}

export function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}
