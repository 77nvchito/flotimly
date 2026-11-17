import type { DB, Quote, Tariff, Trip, Vehicle, Driver } from '../store/types';
import { addDays, daysBetween, inRange, monthKey, monthLabel, addMonths, startOfMonth, today, type Range } from './format';
import { roundTo } from './format';

/* ------------------------- Cotizaciones ------------------------- */

export interface QuoteBreakdown {
  km: number;
  liters: number;
  fuel: number;
  tolls: number;
  driver: number;
  maintenance: number;
  other: number;
  cost: number;
  marginPrice: number;
  tariffPrice: number | null;
  net: number;
  iva: number;
  total: number;
  profit: number;
  realMargin: number;
  costPerKm: number;
}

export function tariffPrice(t: Tariff | undefined, km: number, weightKg: number, days: number) {
  if (!t) return null;
  switch (t.unit) {
    case 'km':
      return km * t.value;
    case 'kg':
      return weightKg * t.value;
    case 'día':
      return Math.max(1, days) * t.value;
    default:
      return t.value;
  }
}

/** Total de peajes: suma de plazas por pasada (×2 si es ida y vuelta) o, en cotizaciones antiguas, el total escrito. */
export function quoteTolls(q: Quote) {
  if (q.tollItems?.length) return q.tollItems.reduce((s, t) => s + (t.amount || 0), 0) * (q.roundTrip ? 2 : 1);
  return q.tolls || 0;
}

/** Jornadas equivalentes del conductor (en modo horas: horas / horas de la jornada). */
export function driverWorkdays(q: Quote, workdayHours: number) {
  if (q.driverMode === 'horas') return (q.driverHours || 0) / Math.max(1, workdayHours || 9);
  return q.driverDays || 0;
}

/**
 * Tiempo estimado del conductor para un flete: kilómetros a la velocidad promedio + carga y descarga.
 * Si cabe en una jornada se sugiere cobrar por horas; si no, por jornadas completas (incluye descanso y pernoctación).
 */
export function estimateDriverTime(km: number, p: { workdayHours: number; avgSpeedKmh: number; handlingHours: number }) {
  const hours = Math.round((km / Math.max(1, p.avgSpeedKmh) + p.handlingHours) * 2) / 2; // en medias horas
  const fitsInDay = hours <= p.workdayHours;
  return { hours, mode: (fitsInDay ? 'horas' : 'jornada') as 'horas' | 'jornada', days: fitsInDay ? 1 : Math.ceil(hours / p.workdayHours) };
}

export function calcQuote(q: Quote, tariffs: Tariff[], ivaPct: number, workdayHours = 9): QuoteBreakdown {
  const km = (q.distanceKm || 0) * (q.roundTrip ? 2 : 1);
  const liters = q.fuelEfficiency > 0 ? km / q.fuelEfficiency : 0;
  const fuel = liters * (q.fuelPrice || 0);
  const tolls = quoteTolls(q);
  const workdays = driverWorkdays(q, workdayHours);
  const driver = Math.round(workdays * (q.driverRate || 0));
  const maintenance = km * (q.maintenancePerKm || 0);
  const other = q.otherCosts || 0;
  const cost = fuel + tolls + driver + maintenance + other;
  const m = Math.min(Math.max(q.marginPct || 0, 0), 95) / 100;
  const marginPrice = roundTo(cost / (1 - m), 1000);
  const tp = tariffPrice(tariffs.find((t) => t.id === q.tariffId), km, q.weightKg, workdays);
  let net = marginPrice;
  if (q.pricingMode === 'tarifa' && tp != null) net = Math.round(tp);
  if (q.pricingMode === 'manual') net = Math.round(q.manualPrice || 0);
  const iva = Math.round((net * ivaPct) / 100);
  const profit = net - cost;
  return {
    km,
    liters,
    fuel,
    tolls,
    driver,
    maintenance,
    other,
    cost,
    marginPrice,
    tariffPrice: tp,
    net,
    iva,
    total: net + iva,
    profit,
    realMargin: net > 0 ? profit / net : 0,
    costPerKm: km > 0 ? cost / km : 0,
  };
}

/* ------------------------- Rentabilidad ------------------------- */

export interface ProfitRow {
  id: string;
  label: string;
  sub?: string;
  trips: number;
  km: number;
  income: number;
  expense: number;
  profit: number;
  margin: number;
  costPerKm: number;
}

const row = (id: string, label: string, sub?: string): ProfitRow => ({
  id,
  label,
  sub,
  trips: 0,
  km: 0,
  income: 0,
  expense: 0,
  profit: 0,
  margin: 0,
  costPerKm: 0,
});

const finish = (r: ProfitRow) => {
  r.profit = r.income - r.expense;
  r.margin = r.income > 0 ? r.profit / r.income : 0;
  r.costPerKm = r.km > 0 ? r.expense / r.km : 0;
  return r;
};

export const isIncome = (t: Trip) => t.status === 'Completado';

export function tripExpenseMap(db: DB) {
  const m = new Map<string, number>();
  for (const e of db.expenses) if (e.tripId) m.set(e.tripId, (m.get(e.tripId) || 0) + e.amount);
  return m;
}

export function profitByVehicle(db: DB, r: Range): ProfitRow[] {
  const map = new Map<string, ProfitRow>();
  for (const v of db.vehicles) map.set(v.id, row(v.id, v.plate, `${v.brand} ${v.model}`));
  for (const t of db.trips) {
    if (!isIncome(t) || !inRange(t.date, r)) continue;
    const x = map.get(t.vehicleId);
    if (!x) continue;
    x.trips++;
    x.km += t.distanceKm * 2;
    x.income += t.price;
  }
  for (const e of db.expenses) {
    if (!e.vehicleId || !inRange(e.date, r)) continue;
    const x = map.get(e.vehicleId);
    if (x) x.expense += e.amount;
  }
  return [...map.values()].map(finish).sort((a, b) => b.profit - a.profit);
}

export function profitByTrip(db: DB, r: Range): ProfitRow[] {
  const exp = tripExpenseMap(db);
  const clients = new Map(db.clients.map((c) => [c.id, c.name]));
  return db.trips
    .filter((t) => isIncome(t) && inRange(t.date, r))
    .map((t) => {
      const x = row(t.id, t.code, `${t.origin} → ${t.destination} · ${clients.get(t.clientId) ?? ''}`);
      x.trips = 1;
      x.km = t.distanceKm * 2;
      x.income = t.price;
      x.expense = exp.get(t.id) || 0;
      return finish(x);
    })
    .sort((a, b) => b.profit - a.profit);
}

export function profitByClient(db: DB, r: Range): ProfitRow[] {
  const exp = tripExpenseMap(db);
  const map = new Map<string, ProfitRow>();
  for (const c of db.clients) map.set(c.id, row(c.id, c.name, c.rut));
  for (const t of db.trips) {
    if (!isIncome(t) || !inRange(t.date, r)) continue;
    const x = map.get(t.clientId);
    if (!x) continue;
    x.trips++;
    x.km += t.distanceKm * 2;
    x.income += t.price;
    x.expense += exp.get(t.id) || 0;
  }
  return [...map.values()].map(finish).sort((a, b) => b.income - a.income);
}

export function totals(db: DB, r: Range) {
  let income = 0;
  let trips = 0;
  let km = 0;
  for (const t of db.trips)
    if (isIncome(t) && inRange(t.date, r)) {
      income += t.price;
      trips++;
      km += t.distanceKm * 2;
    }
  let expense = 0;
  for (const e of db.expenses) if (inRange(e.date, r)) expense += e.amount;
  const profit = income - expense;
  return { income, expense, profit, margin: income > 0 ? profit / income : 0, trips, km };
}

export function monthlySeries(db: DB, months = 6) {
  const start = addMonths(startOfMonth(today()), -(months - 1));
  const keys: string[] = [];
  for (let i = 0; i < months; i++) keys.push(monthKey(addMonths(start, i)));
  const data = new Map(keys.map((k) => [k, { key: k, label: monthLabel(k), ingresos: 0, gastos: 0, utilidad: 0 }]));
  for (const t of db.trips) {
    if (!isIncome(t)) continue;
    const d = data.get(monthKey(t.date));
    if (d) d.ingresos += t.price;
  }
  for (const e of db.expenses) {
    const d = data.get(monthKey(e.date));
    if (d) d.gastos += e.amount;
  }
  return [...data.values()].map((d) => ({ ...d, utilidad: d.ingresos - d.gastos }));
}

export function expensesByCategory(db: DB, r: Range) {
  const m = new Map<string, number>();
  for (const e of db.expenses) if (inRange(e.date, r)) m.set(e.category, (m.get(e.category) || 0) + e.amount);
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

/* ------------------------- Alertas ------------------------- */

export interface Alert {
  id: string;
  title: string;
  subject: string;
  date: string;
  days: number;
  severity: 'vencido' | 'pronto';
  link: string;
}

export function documentAlerts(vehicles: Vehicle[], drivers: Driver[], alertDays: number): Alert[] {
  const t = today();
  const out: Alert[] = [];
  const check = (id: string, title: string, subject: string, date: string | undefined, link: string) => {
    if (!date) return;
    const days = daysBetween(t, date);
    if (days <= alertDays) out.push({ id, title, subject, date, days, severity: days < 0 ? 'vencido' : 'pronto', link });
  };
  for (const v of vehicles) {
    if (v.status === 'Inactivo') continue;
    const s = `${v.plate} · ${v.brand} ${v.model}`;
    check(`${v.id}-rt`, 'Revisión técnica', s, v.techReviewDue, '/flota');
    check(`${v.id}-seg`, 'Seguro', s, v.insuranceDue, '/flota');
    check(`${v.id}-pc`, 'Permiso de circulación', s, v.permitDue, '/flota');
  }
  for (const d of drivers) {
    if (d.status === 'Inactivo') continue;
    check(`${d.id}-lic`, `Licencia clase ${d.licenseClass}`, d.name, d.licenseDue, '/flota?tab=conductores');
  }
  return out.sort((a, b) => a.days - b.days);
}

/* ------------------------- Facturación ------------------------- */

export type InvoiceState = 'por_facturar' | 'pendiente' | 'vencida' | 'pagada';

export function invoiceState(t: Trip): InvoiceState {
  if (!t.invoice?.number) return 'por_facturar';
  if (t.invoice.paid) return 'pagada';
  if (t.invoice.dueDate && t.invoice.dueDate < today()) return 'vencida';
  return 'pendiente';
}

export const dueInDays = (client: { paymentTermsDays: number } | undefined, issue: string) =>
  addDays(issue, client?.paymentTermsDays ?? 30);
