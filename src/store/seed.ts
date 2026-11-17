import { estimateDriverTime } from '../lib/calc';
import type {
  Client,
  DB,
  DeliveryProof,
  Driver,
  Expense,
  ExpenseCategory,
  Quote,
  Tariff,
  Trip,
  User,
  Vehicle,
  VehicleType,
} from './types';
import { addDays, addMonths, endOfMonth, startOfMonth, today, uid, roundTo } from '../lib/format';

/** Hash PBKDF2 de la contraseña pública de la demo ("demo"). Se calcula una vez para no demorar la primera carga. */
/** Parámetros para estimar el tiempo del conductor (se completan también en datos guardados antes de existir). */
export const DEFAULT_TIME_PARAMS = { workdayHours: 9, avgSpeedKmh: 60, handlingHours: 1.5 };

export const DEMO_PASSWORD_HASH = 'pbkdf2$600000$B4vqs3ikyOXqtSAmJexVGw==$d7u/CFeIg8Ii2doXtQ7taBzluXSHeRUsHOqWmeTDERw=';

export const DB_VERSION = 1;

export const DEFAULT_CONDITIONS = [
  'Incluye combustible, peajes, conductor profesional y seguro del vehículo.',
  'Tiempos de espera sobre 2 horas en carga o descarga tendrán un cobro adicional.',
  'Carga y descarga a cargo del cliente, salvo que se indique lo contrario.',
  'Valores en pesos chilenos, más IVA.',
].join('\n');

export const DEFAULT_BANK = {
  bank: 'Banco de Chile',
  accountType: 'Cuenta Corriente',
  accountNumber: '00-123-45678-90',
  holder: 'Transportes Demo SpA',
  rut: '76.987.654-5',
  email: 'pagos@transportesdemo.cl',
};

// Generador pseudoaleatorio determinístico para que la demo sea siempre igual.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fakeSignature(seed: number) {
  const r = mulberry32(seed);
  let d = `M 20 ${60 + r() * 20}`;
  let x = 20;
  for (let i = 0; i < 9; i++) {
    x += 22 + r() * 18;
    d += ` Q ${x - 15} ${10 + r() * 90}, ${x} ${40 + r() * 40}`;
  }
  d += ` M 30 ${95 + r() * 5} L ${x - 10} ${88 + r() * 8}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120"><path d="${d}" fill="none" stroke="#1d2b4f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const ROUTES = [
  { o: 'Santiago', d: 'Valparaíso', km: 120, toll: 7800 },
  { o: 'Santiago', d: 'San Antonio', km: 113, toll: 6900 },
  { o: 'Santiago', d: 'Rancagua', km: 87, toll: 3900 },
  { o: 'Santiago', d: 'Talca', km: 255, toll: 10500 },
  { o: 'Santiago', d: 'Concepción', km: 500, toll: 21000 },
  { o: 'Santiago', d: 'La Serena', km: 470, toll: 19800 },
  { o: 'Santiago', d: 'Los Andes', km: 80, toll: 4200 },
  { o: 'Valparaíso', d: 'Rancagua', km: 200, toll: 9000 },
  { o: 'Santiago', d: 'Chillán', km: 400, toll: 17500 },
  { o: 'Quilicura', d: 'Puerto Montt', km: 1030, toll: 38000 },
];

const CARGO = [
  'Pallets de abarrotes',
  'Materiales de construcción',
  'Contenedor 40"',
  'Fruta de exportación',
  'Electrodomésticos',
  'Insumos agrícolas',
  'Carga general',
  'Productos refrigerados',
  'Maquinaria liviana',
  'Despacho retail',
];

const RATE_PER_KM: Record<VehicleType, number> = {
  'Tracto camión': 1750,
  Camión: 1250,
  Camioneta: 800,
  Furgón: 850,
};
const MIN_PRICE: Record<VehicleType, number> = {
  'Tracto camión': 300000,
  Camión: 190000,
  Camioneta: 100000,
  Furgón: 105000,
};
const TOLL_MULT: Record<VehicleType, number> = {
  'Tracto camión': 3,
  Camión: 2,
  Camioneta: 1,
  Furgón: 1,
};
const INSURANCE: Record<VehicleType, number> = {
  'Tracto camión': 145000,
  Camión: 98000,
  Camioneta: 52000,
  Furgón: 58000,
};

/**
 * Datos de demostración. Prueba varias semillas y se queda con la primera que muestra un negocio sano y
 * parejo (crecimiento moderado vs el mismo período del mes anterior y meses completos sin saltos bruscos),
 * para que la demo se vea bien cualquiera sea el día en que se abra.
 */
export function createSeed(): DB {
  const t = today();
  const day = Number(t.slice(8));
  let best: { db: DB; score: number } | null = null;
  for (let i = 0; i < 120; i++) {
    const db = buildSeed(20261115 + i * 7919);
    const score = seedScore(db, day);
    if (!best || score < best.score) best = { db, score };
    if (score < 0.02) break;
  }
  return best!.db;
}

function seedScore(db: DB, day: number) {
  const t = today();
  const income = (from: string, to: string) =>
    db.trips.reduce((s, x) => (x.status === 'Completado' && x.date >= from && x.date <= to ? s + x.price : s), 0);
  const expense = (from: string, to: string) => db.expenses.reduce((s, e) => (e.date >= from && e.date <= to ? s + e.amount : s), 0);
  // Meses completos anteriores: ventas parejas y margen operacional sano (15% a 32%)
  let penalty = 0;
  const months: number[] = [];
  for (let m = 1; m <= 5; m++) {
    const ms = addMonths(startOfMonth(t), -m);
    const inc = income(ms, endOfMonth(ms));
    const margin = inc ? 1 - expense(ms, endOfMonth(ms)) / inc : 0;
    penalty += Math.max(0, 0.15 - margin) + Math.max(0, margin - 0.32);
    months.push(inc);
  }
  const avg = months.reduce((a, b) => a + b, 0) / months.length;
  penalty += Math.max(0, Math.max(...months.map((x) => Math.abs(x / avg - 1))) - 0.1);
  if (day < 5) return penalty;
  // Mes en curso vs mismo período del mes anterior: ventas +4% a +12%, gastos sin crecer más que las ventas
  const pf = addMonths(startOfMonth(t), -1);
  const pt = addDays(pf, Math.min(day, Number(endOfMonth(pf).slice(8))) - 1);
  const ci = income(startOfMonth(t), t), pi = income(pf, pt);
  const ce = expense(startOfMonth(t), t), pe = expense(pf, pt);
  const di = pi ? ci / pi - 1 : 0;
  const de = pe ? ce / pe - 1 : 0;
  penalty += 2 * (di < 0.04 ? 0.04 - di : di > 0.12 ? di - 0.12 : 0);
  penalty += Math.max(0, de - di - 0.03);
  return penalty;
}

function buildSeed(seed: number): DB {
  const rnd = mulberry32(seed);
  const r = (a: number, b: number) => a + rnd() * (b - a);
  const ri = (a: number, b: number) => Math.floor(r(a, b + 1));
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const t = today();
  const fuelPrice = 1050;

  const drivers: Driver[] = [
    { id: uid(), name: 'Juan Pérez Morales', rut: '12.345.678-5', phone: '+56 9 8123 4567', email: 'jperez@correo.cl', licenseClass: 'A5', licenseDue: addDays(t, 220), status: 'Activo', dailyRate: 45000 },
    { id: uid(), name: 'Carlos Muñoz Reyes', rut: '13.456.789-9', phone: '+56 9 7234 5678', email: 'cmunoz@correo.cl', licenseClass: 'A5', licenseDue: addDays(t, 18), status: 'Activo', dailyRate: 45000 },
    { id: uid(), name: 'Pedro Soto Fuentes', rut: '15.678.901-1', phone: '+56 9 6345 6789', licenseClass: 'A4', licenseDue: addDays(t, 410), status: 'Activo', dailyRate: 40000 },
    { id: uid(), name: 'Luis Rojas Castillo', rut: '16.789.012-1', phone: '+56 9 5456 7890', licenseClass: 'A4', licenseDue: addDays(t, 150), status: 'Activo', dailyRate: 40000 },
    { id: uid(), name: 'Andrés Contreras Vega', rut: '18.901.234-9', phone: '+56 9 4567 8901', licenseClass: 'B', licenseDue: addDays(t, 700), status: 'Activo', dailyRate: 32000 },
    { id: uid(), name: 'Miguel Torres Díaz', rut: '17.234.567-0', phone: '+56 9 3678 9012', licenseClass: 'B', licenseDue: addDays(t, 540), status: 'Activo', dailyRate: 32000 },
  ];

  const vehicles: Vehicle[] = [
    { id: uid(), plate: 'LKJR-45', brand: 'Volvo', model: 'FH 460', year: 2020, type: 'Tracto camión', capacityKg: 28000, fuelEfficiency: 2.8, odometer: 412500, status: 'Activo', driverId: drivers[0].id, techReviewDue: addDays(t, 95), insuranceDue: addDays(t, 140), permitDue: '2027-03-31' },
    { id: uid(), plate: 'HFTS-21', brand: 'Mercedes-Benz', model: 'Actros 2645', year: 2018, type: 'Tracto camión', capacityKg: 27000, fuelEfficiency: 2.6, odometer: 615300, status: 'Activo', driverId: drivers[1].id, techReviewDue: addDays(t, 12), insuranceDue: addDays(t, 200), permitDue: '2027-03-31' },
    { id: uid(), plate: 'PRXT-88', brand: 'Hino', model: '500 FC', year: 2021, type: 'Camión', capacityKg: 8000, fuelEfficiency: 4.5, odometer: 188900, status: 'Activo', driverId: drivers[2].id, techReviewDue: addDays(t, 160), insuranceDue: addDays(t, -3), permitDue: '2027-03-31' },
    { id: uid(), plate: 'KDWP-12', brand: 'Isuzu', model: 'NQR 919', year: 2019, type: 'Camión', capacityKg: 5000, fuelEfficiency: 6, odometer: 254100, status: 'Activo', driverId: drivers[3].id, techReviewDue: addDays(t, 60), insuranceDue: addDays(t, 75), permitDue: '2027-03-31' },
    { id: uid(), plate: 'RTZB-67', brand: 'Toyota', model: 'Hilux 2.4', year: 2022, type: 'Camioneta', capacityKg: 1000, fuelEfficiency: 10.5, odometer: 96400, status: 'Activo', driverId: drivers[4].id, techReviewDue: addDays(t, 210), insuranceDue: addDays(t, 25), permitDue: '2027-03-31' },
    { id: uid(), plate: 'SVBL-30', brand: 'Peugeot', model: 'Boxer', year: 2021, type: 'Furgón', capacityKg: 1500, fuelEfficiency: 9, odometer: 132700, status: 'En mantención', driverId: drivers[5].id, techReviewDue: addDays(t, 120), insuranceDue: addDays(t, 300), permitDue: '2027-03-31', notes: 'Cambio de embrague en taller.' },
  ];

  const clients: Client[] = [
    { id: uid(), name: 'Comercial Andes SpA', rut: '76.123.456-0', contact: 'María José Tapia', email: 'mtapia@comercialandes.cl', phone: '+56 2 2345 6789', address: 'Av. Américo Vespucio 1500, Quilicura', paymentTermsDays: 30 },
    { id: uid(), name: 'Distribuidora del Pacífico Ltda.', rut: '77.234.567-4', contact: 'Rodrigo Fuentes', email: 'rfuentes@dpacifico.cl', phone: '+56 32 268 1122', address: 'Av. España 2200, Valparaíso', paymentTermsDays: 45 },
    { id: uid(), name: 'Agrícola Valle Central S.A.', rut: '96.345.678-6', contact: 'Fernanda Lagos', email: 'flagos@vallecentral.cl', phone: '+56 71 222 3344', address: 'Ruta 5 Sur km 255, Talca', paymentTermsDays: 30 },
    { id: uid(), name: 'Constructora Los Robles SpA', rut: '76.456.789-7', contact: 'Felipe Araya', email: 'faraya@losrobles.cl', phone: '+56 2 2987 6543', address: 'Av. Apoquindo 4800, Las Condes', paymentTermsDays: 60 },
    { id: uid(), name: 'Retail Express Chile S.A.', rut: '96.567.890-5', contact: 'Camila Ortiz', email: 'cortiz@retailexpress.cl', phone: '+56 2 2456 7788', address: 'Av. Lo Espejo 01565, San Bernardo', paymentTermsDays: 30 },
  ];

  const tariffs: Tariff[] = [
    { id: uid(), name: 'Tracto — tarifa por km', unit: 'km', value: 1250, vehicleType: 'Tracto camión', description: 'Ida y vuelta, carga completa' },
    { id: uid(), name: 'Camión 3/4 — tarifa por km', unit: 'km', value: 800, vehicleType: 'Camión' },
    { id: uid(), name: 'Camioneta — tarifa por km', unit: 'km', value: 480, vehicleType: 'Camioneta' },
    { id: uid(), name: 'Reparto urbano — día completo', unit: 'día', value: 185000, vehicleType: 'Camión', description: 'Hasta 10 puntos de entrega en RM' },
    { id: uid(), name: 'Carga fraccionada — por kg', unit: 'kg', value: 95, description: 'Mínimo 500 kg' },
    { id: uid(), name: 'Puerto San Antonio — contenedor', unit: 'viaje', value: 420000, vehicleType: 'Tracto camión' },
  ];

  const users: User[] = [
    { id: uid(), name: 'Administrador', email: 'admin@flotimly.cl', role: 'Administrador', active: true, passwordHash: DEMO_PASSWORD_HASH },
    { id: uid(), name: 'Valentina Herrera', email: 'operaciones@flotimly.cl', role: 'Operaciones', active: true, passwordHash: DEMO_PASSWORD_HASH },
    { id: uid(), name: 'Sebastián Díaz', email: 'finanzas@flotimly.cl', role: 'Finanzas', active: true, passwordHash: DEMO_PASSWORD_HASH },
    { id: uid(), name: 'Juan Pérez', email: 'conductor@flotimly.cl', role: 'Conductor', active: true, passwordHash: DEMO_PASSWORD_HASH },
  ];

  /* ---------- Viajes ---------- */
  const trips: Trip[] = [];
  const expenses: Expense[] = [];
  const firstDay = addMonths(startOfMonth(t), -5);
  const activeForFuture = vehicles.filter((v) => v.status === 'Activo');

  const makeTrip = (date: string, v: Vehicle) => {
    let route = pick(ROUTES);
    if (v.type === 'Camioneta' || v.type === 'Furgón') route = pick(ROUTES.filter((x) => x.km <= 260));
    else if (v.type === 'Camión') route = pick(ROUTES.filter((x) => x.km <= 500));
    const price = roundTo(Math.max(MIN_PRICE[v.type], route.km * RATE_PER_KM[v.type]) * r(0.92, 1.15), 5000);
    const days = route.km > 600 ? 3 : route.km > 300 ? 2 : 1;
    const trip: Trip = {
      id: uid(),
      code: '',
      clientId: pick(clients).id,
      vehicleId: v.id,
      driverId: v.driverId ?? pick(drivers).id,
      origin: route.o,
      destination: route.d,
      distanceKm: route.km,
      date,
      endDate: days > 1 ? addDays(date, days - 1) : undefined,
      cargo: pick(CARGO),
      weightKg: roundTo(v.capacityKg * r(0.45, 0.98), 50),
      price,
      status: 'Completado',
    };
    return { trip, route, days };
  };

  // Ritmo de trabajo por vehículo: viaje → descanso de 0 a 2 días → viaje (meses consistentes)
  const GAPS = [0, 1, 1, 1, 2];
  const nextFree = new Map<string, string>();
  const furgon = vehicles.find((v) => v.type === 'Furgón');

  for (let d = firstDay; d < t; d = addDays(d, 1)) {
    const dow = new Date(d + 'T12:00').getDay();
    if (dow === 0) continue;
    for (const v of vehicles) {
      if ((nextFree.get(v.id) ?? '') > d) continue;
      if (v === furgon && d > addDays(t, -12)) continue; // en taller las últimas semanas
      if (dow === 6 && rnd() < 0.6) continue;
      const { trip, route, days } = makeTrip(d, v);
      nextFree.set(v.id, addDays(trip.endDate ?? d, 1 + pick(GAPS)));
      if (rnd() < 0.03) trip.status = 'Cancelado';
      trips.push(trip);
      if (trip.status === 'Cancelado') continue;
      const km = route.km * 2;
      const liters = Math.round((km / v.fuelEfficiency) * r(0.96, 1.06));
      expenses.push({ id: uid(), date: d, category: 'Combustible', amount: Math.round(liters * fuelPrice * r(0.97, 1.03)), liters, vehicleId: v.id, tripId: trip.id, provider: pick(['Copec', 'Shell', 'Aramco', 'Petrobras']), description: `Carga diésel ${route.o} - ${route.d}` });
      expenses.push({ id: uid(), date: d, category: 'Peajes', amount: route.toll * TOLL_MULT[v.type] * 2, vehicleId: v.id, tripId: trip.id, provider: 'Autopistas / TAG', description: `Peajes ${route.o} - ${route.d} (ida y vuelta)` });
      if (days > 1) expenses.push({ id: uid(), date: d, category: 'Viáticos', amount: 22000 * days, vehicleId: v.id, tripId: trip.id, description: `Viático conductor ${days} días` });
    }
  }

  // Viajes en curso (hoy) y planificados (próximas 4 semanas, más densos al inicio)
  const FUTURE_GAPS = [0, 1, 1, 2, 2, 3, 4];
  activeForFuture.slice(0, 3).forEach((v) => {
    const { trip } = makeTrip(t, v);
    trip.status = 'En curso';
    trips.push(trip);
    nextFree.set(v.id, addDays(trip.endDate ?? t, 1 + pick(GAPS)));
  });
  for (const v of activeForFuture.slice(3)) nextFree.set(v.id, addDays(t, 1));
  for (let d = addDays(t, 1); d <= addDays(t, 27); d = addDays(d, 1)) {
    const dow = new Date(d + 'T12:00').getDay();
    if (dow === 0) continue;
    for (const v of activeForFuture) {
      if ((nextFree.get(v.id) ?? '') > d) continue;
      if (dow === 6 && rnd() < 0.6) continue;
      const { trip } = makeTrip(d, v);
      trip.status = 'Planificado';
      trips.push(trip);
      const far = d > addDays(t, 10) ? 2 : 0;
      nextFree.set(v.id, addDays(trip.endDate ?? d, 1 + pick(FUTURE_GAPS) + far));
    }
  }

  trips.sort((a, b) => a.date.localeCompare(b.date));
  trips.forEach((x, i) => (x.code = `V-${String(i + 1).padStart(4, '0')}`));

  /* ---------- Facturación de viajes completados ---------- */
  let invNo = 1001;
  const clientById = new Map(clients.map((c) => [c.id, c]));
  for (const x of trips) {
    if (x.status !== 'Completado') continue;
    const age = (new Date(t).getTime() - new Date(x.date).getTime()) / 86_400_000;
    const p = rnd();
    let state: 'none' | 'inv' | 'paid';
    if (age > 75) state = p < 0.985 ? 'paid' : 'inv';
    else if (age > 60) state = p < 0.9 ? 'paid' : 'inv';
    else if (age > 30) state = p < 0.7 ? 'paid' : p < 0.97 ? 'inv' : 'none';
    else if (age > 7) state = p < 0.2 ? 'paid' : p < 0.75 ? 'inv' : 'none';
    else state = p < 0.3 ? 'inv' : 'none';
    if (state === 'none') {
      x.invoice = { paid: false };
      continue;
    }
    const issueDate = addDays(x.date, ri(1, 4));
    const effIssue = issueDate > t ? t : issueDate;
    const dueDate = addDays(effIssue, clientById.get(x.clientId)?.paymentTermsDays ?? 30);
    let paidDate: string | undefined;
    if (state === 'paid') {
      paidDate = addDays(dueDate, ri(-12, 14));
      if (paidDate > t) paidDate = t;
      if (paidDate < effIssue) paidDate = effIssue;
    }
    x.invoice = { number: String(invNo++), issueDate: effIssue, dueDate, paid: state === 'paid', paidDate };
  }

  /* ---------- Gastos fijos mensuales ---------- */
  for (let m = 0; m < 6; m++) {
    const ms = addMonths(firstDay, m);
    const me = endOfMonth(ms);
    for (const v of vehicles) {
      const insDate = addDays(ms, 4);
      if (insDate <= t) expenses.push({ id: uid(), date: insDate, category: 'Seguros', amount: INSURANCE[v.type], vehicleId: v.id, provider: 'HDI Seguros', description: `Prima mensual póliza ${v.plate}` });
      if (rnd() < 0.5) {
        const md = addDays(ms, ri(3, 26));
        if (md <= t) {
          const base = v.type === 'Tracto camión' ? r(180000, 820000) : v.type === 'Camión' ? r(120000, 480000) : r(60000, 240000);
          expenses.push({ id: uid(), date: md, category: 'Mantención', amount: roundTo(base, 1000), vehicleId: v.id, provider: pick(['Taller Diesel Maipú', 'Kaufmann', 'Salinas y Fabres', 'Lubricentro Ruta 68']), description: pick(['Mantención preventiva', 'Cambio de aceite y filtros', 'Frenos y pastillas', 'Revisión sistema eléctrico', 'Alineación y balanceo']), docNumber: String(ri(10000, 99999)) });
        }
      }
      if (rnd() < 0.1) {
        const nd = addDays(ms, ri(3, 26));
        if (nd <= t) expenses.push({ id: uid(), date: nd, category: 'Neumáticos', amount: v.type === 'Tracto camión' ? 1480000 : v.type === 'Camión' ? 760000 : 380000, vehicleId: v.id, provider: 'Neumáticos Chile', description: 'Recambio de neumáticos' });
      }
      if (v.techReviewDue && rnd() < 0.08) {
        const pd = addDays(ms, ri(3, 26));
        if (pd <= t) expenses.push({ id: uid(), date: pd, category: 'Permisos', amount: v.type === 'Tracto camión' ? 42000 : 28000, vehicleId: v.id, provider: 'Planta de revisión técnica', description: 'Revisión técnica y análisis de gases' });
      }
    }
    for (const d of drivers) {
      const v = vehicles.find((x) => x.driverId === d.id);
      const pay = me > t ? null : me;
      if (pay) expenses.push({ id: uid(), date: pay, category: 'Remuneraciones', amount: d.licenseClass === 'A5' ? 1050000 : d.licenseClass === 'A4' ? 880000 : 690000, vehicleId: v?.id, description: `Sueldo ${d.name.split(' ')[0]} (líquido + leyes sociales)` });
    }
    const od = addDays(ms, 9);
    if (od <= t) expenses.push({ id: uid(), date: od, category: 'Otros', amount: 89000, provider: 'GPS Track Chile', description: 'Servicio GPS flota (mensual)' });
  }

  /* ---------- Cotizaciones ---------- */
  const quotes: Quote[] = [];
  const qStatuses: Quote['status'][] = ['Aceptada', 'Enviada', 'Enviada', 'Rechazada', 'Borrador', 'Aceptada', 'Enviada', 'Borrador'];
  qStatuses.forEach((status, i) => {
    const v = pick(vehicles.slice(0, 5));
    const route = pick(ROUTES.slice(0, 9));
    const date = addDays(t, -ri(0, 25));
    quotes.push({
      id: uid(),
      code: `C-${String(i + 1).padStart(4, '0')}`,
      clientId: pick(clients).id,
      date,
      validUntil: addDays(date, 15),
      origin: route.o,
      destination: route.d,
      distanceKm: route.km,
      roundTrip: true,
      vehicleId: v.id,
      cargo: pick(CARGO),
      weightKg: roundTo(v.capacityKg * r(0.5, 0.95), 50),
      fuelPrice,
      fuelEfficiency: v.fuelEfficiency,
      tolls: route.toll * TOLL_MULT[v.type] * 2,
      tollItems: [{ id: `q${i}-peaje`, name: `Peajes ${route.o} – ${route.d}`, amount: route.toll * TOLL_MULT[v.type] }],
      ...(() => {
        const est = estimateDriverTime(route.km * 2, DEFAULT_TIME_PARAMS);
        return { driverMode: est.mode, driverHours: est.hours, driverDays: est.days };
      })(),
      driverRate: drivers.find((d) => d.id === v.driverId)?.dailyRate ?? 40000,
      maintenancePerKm: v.type === 'Tracto camión' ? 180 : v.type === 'Camión' ? 120 : 70,
      otherCosts: 0,
      marginPct: 28,
      pricingMode: 'margen',
      status,
    });
  });
  quotes.sort((a, b) => a.date.localeCompare(b.date));
  quotes.forEach((q, i) => (q.code = `C-${String(i + 1).padStart(4, '0')}`));

  /* ---------- Comprobantes de entrega ---------- */
  const proofs: DeliveryProof[] = [];
  const recent = trips.filter((x) => x.status === 'Completado').slice(-9);
  const receivers = ['Jorge Valenzuela', 'Paula Navarro', 'Cristián Bravo', 'Daniela Espinoza', 'Mauricio Silva', 'Karina Pizarro', 'Rodrigo Vidal', 'Patricia Álvarez', 'Tomás Riquelme'];
  recent.forEach((x, i) => {
    proofs.push({
      id: uid(),
      code: `CE-${String(i + 1).padStart(4, '0')}`,
      tripId: x.id,
      date: x.endDate ?? x.date,
      time: `${String(ri(8, 18)).padStart(2, '0')}:${String(ri(0, 59)).padStart(2, '0')}`,
      receiverName: receivers[i],
      receiverRut: `${ri(10, 20)}.${ri(100, 999)}.${ri(100, 999)}-${ri(0, 9)}`,
      condition: i === 3 ? 'Con observaciones' : 'Conforme',
      observations: i === 3 ? 'Dos pallets con film dañado, mercadería sin daño aparente.' : undefined,
      signature: fakeSignature(i + 7),
      photos: [],
    });
  });

  return {
    version: DB_VERSION,
    settings: {
      plan: 'pyme',
      company: {
        name: 'Transportes Demo SpA',
        rut: '76.987.654-5',
        giro: 'Transporte de carga por carretera',
        address: 'Av. Los Libertadores 2500, Colina, Región Metropolitana',
        phone: '+56 2 2789 0123',
        email: 'contacto@transportesdemo.cl',
        website: 'www.transportesdemo.cl',
        brandColor: '#0b2a52',
      },
      bank: DEFAULT_BANK,
      quoteConditions: DEFAULT_CONDITIONS,
      params: {
        fuelPrice,
        ivaPct: 19,
        defaultMarginPct: 28,
        maintenancePerKm: 140,
        quoteValidityDays: 15,
        defaultDriverRate: 40000,
        alertDays: 30,
        ...DEFAULT_TIME_PARAMS,
      },
    },
    vehicles,
    drivers,
    clients,
    trips,
    expenses: expenses.sort((a, b) => b.date.localeCompare(a.date)),
    quotes,
    proofs,
    tariffs,
    users,
  };
}

export function emptyDB(base: DB): DB {
  return {
    ...base,
    vehicles: [],
    drivers: [],
    clients: [],
    trips: [],
    expenses: [],
    quotes: [],
    proofs: [],
    tariffs: [],
  };
}

export type { ExpenseCategory };
