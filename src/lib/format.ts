const clpFmt = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export const clp = (n: number) => clpFmt.format(Math.round(n || 0));

export const num = (n: number, digits = 0) =>
  new Intl.NumberFormat('es-CL', { maximumFractionDigits: digits }).format(n || 0);

export const pct = (ratio: number, digits = 1) => `${num((ratio || 0) * 100, digits)}%`;

export const compactClp = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${num(n / 1_000_000, 1)}M`;
  if (a >= 1_000) return `$${num(n / 1_000, 0)}K`;
  return clp(n);
};

/* ---------- Fechas (siempre en formato ISO local YYYY-MM-DD) ---------- */

const pad = (n: number) => String(n).padStart(2, '0');

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const today = () => toISO(new Date());

export const addDays = (s: string, n: number) => {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

export const addMonths = (s: string, n: number) => {
  const d = parseISO(s);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toISO(d);
};

export const daysBetween = (a: string, b: string) =>
  Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);

export const fmtDate = (s?: string) =>
  s
    ? parseISO(s).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

export const fmtDateShort = (s?: string) =>
  s ? parseISO(s).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '—';

export const fmtDateLong = (s: string) => {
  const t = parseISO(s).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const monthKey = (s: string) => s.slice(0, 7);

export const monthLabel = (key: string, long = false) => {
  const d = parseISO(`${key}-01`);
  const label = d.toLocaleDateString('es-CL', { month: long ? 'long' : 'short', year: long ? 'numeric' : undefined });
  return label.charAt(0).toUpperCase() + label.slice(1).replace('.', '');
};

export const startOfMonth = (s: string) => `${s.slice(0, 7)}-01`;

export const endOfMonth = (s: string) => addDays(addMonths(startOfMonth(s), 1), -1);

export type PeriodKey = 'mes' | 'mes_anterior' | '3m' | '6m' | 'anio' | 'todo';

export const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: 'mes', label: 'Este mes' },
  { value: 'mes_anterior', label: 'Mes anterior' },
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
  { value: 'anio', label: 'Este año' },
  { value: 'todo', label: 'Todo' },
];

export interface Range {
  from: string;
  to: string;
}

/** Mismo tramo de días del mes anterior (p. ej. 1–15 oct si hoy es 15 nov), para comparar de forma justa. */
export const prevMonthToDate = (): Range => {
  const t = today();
  const from = addMonths(startOfMonth(t), -1);
  const day = Number(t.slice(8));
  const to = addDays(from, Math.min(day, Number(endOfMonth(from).slice(8))) - 1);
  return { from, to };
};

export const periodRange = (p: PeriodKey): Range => {
  const t = today();
  switch (p) {
    case 'mes':
      return { from: startOfMonth(t), to: endOfMonth(t) };
    case 'mes_anterior': {
      const s = addMonths(startOfMonth(t), -1);
      return { from: s, to: endOfMonth(s) };
    }
    case '3m':
      return { from: addMonths(startOfMonth(t), -2), to: endOfMonth(t) };
    case '6m':
      return { from: addMonths(startOfMonth(t), -5), to: endOfMonth(t) };
    case 'anio':
      return { from: `${t.slice(0, 4)}-01-01`, to: `${t.slice(0, 4)}-12-31` };
    default:
      return { from: '1900-01-01', to: '2999-12-31' };
  }
};

export const inRange = (d: string, r: Range) => d >= r.from && d <= r.to;

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const nextCode = (prefix: string, items: { code: string }[]) => {
  const max = items.reduce((m, i) => {
    const n = parseInt(i.code.replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
};

export const roundTo = (n: number, step: number) => Math.ceil(n / step) * step;
