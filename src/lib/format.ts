const DAY = 86_400_000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Days from today until a yyyy-mm-dd date (negative = past). */
export function daysUntil(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.round((startOfDay(new Date(y, m - 1, d)) - startOfDay(new Date())) / DAY);
}

export function dueLabel(isoDate: string): { text: string; tone: 'overdue' | 'soon' | 'normal' } {
  const n = daysUntil(isoDate);
  if (n < 0) return { text: `Atrasada ${-n}d`, tone: 'overdue' };
  if (n === 0) return { text: 'Hoje', tone: 'soon' };
  if (n === 1) return { text: 'Amanhã', tone: 'soon' };
  if (n <= 3) return { text: `Em ${n} dias`, tone: 'soon' };
  const [y, m, d] = isoDate.split('-').map(Number);
  return {
    text: new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', ''),
    tone: 'normal',
  };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

export function pluralize(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}
