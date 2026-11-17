/*
 * Portabilidad de datos: exportar e importar en formatos abiertos.
 *
 *  - Excel (.xlsx): una hoja por módulo + "Léeme" + "Diccionario". Sirve también como plantilla de importación.
 *  - Paquete ZIP: un CSV por módulo + firmas y fotos de comprobantes + JSON completo.
 *  - JSON: copia técnica exacta (Configuración → Datos → Respaldo).
 *
 * Una sola definición de columnas (SHEETS) se usa para exportar, generar la plantilla y validar la importación,
 * así el archivo exportado siempre se puede volver a importar.
 */
import type { CollectionKey, DB, Item, Trip, Vehicle } from '../store/types';
import { EXPENSE_CATEGORIES, TRIP_STATUSES, VEHICLE_TYPES } from '../store/types';
import { calcQuote } from './calc';
import { nextCode, today, uid } from './format';

export const FORMAT_VERSION = 'Flotimly-Datos v1';

/* ------------------------------------------------------------------ */
/*  Utilidades de normalización                                        */
/* ------------------------------------------------------------------ */

const norm = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\*/g, '')
    .trim()
    .toLowerCase();

const rutKey = (s?: string) => (s ?? '').replace(/[.\s-]/g, '').toUpperCase();

type Cell = unknown;

/** Valor de celda de ExcelJS (texto enriquecido, fórmula, hipervínculo…) → valor plano. */
function plain(v: Cell): unknown {
  if (v == null) return null;
  if (v instanceof Date || typeof v !== 'object') return v;
  const o = v as Record<string, unknown>;
  if ('result' in o) return plain(o.result);
  if ('richText' in o && Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((r) => r.text).join('');
  if ('text' in o) return plain(o.text);
  return String(v);
}

const toStr = (v: Cell) => {
  const p = plain(v);
  if (p == null) return '';
  if (p instanceof Date) return dateFromAny(p) ?? '';
  return String(p).trim();
};

function toNum(v: Cell): number | null {
  const p = plain(v);
  if (p == null || p === '') return null;
  if (typeof p === 'number') return p;
  let s = String(p).replace(/[^\d,.-]/g, '');
  if (!s) return null;
  // "1.234.567" o "1.234,5" (formato chileno) → 1234567 / 1234.5
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Date, número de serie de Excel o texto (AAAA-MM-DD, DD-MM-AAAA, DD/MM/AAAA) → "AAAA-MM-DD". */
function dateFromAny(v: Cell): string | null {
  const p = plain(v);
  if (p == null || p === '') return null;
  if (p instanceof Date) return `${p.getUTCFullYear()}-${pad(p.getUTCMonth() + 1)}-${pad(p.getUTCDate())}`;
  if (typeof p === 'number' && p > 20000 && p < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(p) * 86_400_000);
    return dateFromAny(d);
  }
  const s = String(p).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return null;
}

const toBool = (v: Cell) => ['si', 'yes', 'true', '1', 'x', 'pagada', 'pagado'].includes(norm(toStr(v)));

function toEnum<T extends string>(v: Cell, options: readonly T[]): T | null {
  const n = norm(toStr(v));
  if (!n) return null;
  return options.find((o) => norm(o) === n) ?? null;
}

const isoToExcelDate = (s?: string) => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/* ------------------------------------------------------------------ */
/*  Definición de hojas                                                */
/* ------------------------------------------------------------------ */

type Kind = 'text' | 'number' | 'money' | 'date' | 'bool';

interface Lookups {
  vehicle: Map<string, Vehicle>;
  driver: Map<string, DB['drivers'][number]>;
  client: Map<string, DB['clients'][number]>;
  trip: Map<string, Trip>;
}

interface Col<T> {
  header: string;
  desc: string;
  kind?: Kind;
  width?: number;
  required?: boolean; // obligatoria al importar
  get: (r: T, L: Lookups, db: DB) => unknown;
}

interface SheetDef<T> {
  name: string;
  desc: string;
  importable: boolean;
  rows: (db: DB) => T[];
  cols: Col<T>[];
}

const YES = (b?: boolean) => (b ? 'Sí' : 'No');

const S_CLIENTES: SheetDef<DB['clients'][number]> = {
  name: 'Clientes',
  desc: 'Clientes de la empresa de transporte.',
  importable: true,
  rows: (db) => db.clients,
  cols: [
    { header: 'ID', desc: 'Identificador interno. Déjalo vacío para registros nuevos.', width: 38, get: (r) => r.id },
    { header: 'Razón social', desc: 'Nombre o razón social del cliente.', required: true, width: 34, get: (r) => r.name },
    { header: 'RUT', desc: 'RUT del cliente (ej. 76.123.456-7).', width: 15, get: (r) => r.rut },
    { header: 'Contacto', desc: 'Persona de contacto.', width: 22, get: (r) => r.contact },
    { header: 'Correo', desc: 'Correo electrónico.', width: 28, get: (r) => r.email },
    { header: 'Teléfono', desc: 'Teléfono.', width: 16, get: (r) => r.phone },
    { header: 'Dirección', desc: 'Dirección comercial.', width: 36, get: (r) => r.address },
    { header: 'Plazo de pago (días)', desc: 'Días de crédito para calcular el vencimiento de facturas.', kind: 'number', width: 12, get: (r) => r.paymentTermsDays },
  ],
};

const S_CONDUCTORES: SheetDef<DB['drivers'][number]> = {
  name: 'Conductores',
  desc: 'Conductores de la flota.',
  importable: true,
  rows: (db) => db.drivers,
  cols: [
    { header: 'ID', desc: 'Identificador interno. Déjalo vacío para registros nuevos.', width: 38, get: (r) => r.id },
    { header: 'Nombre', desc: 'Nombre completo.', required: true, width: 28, get: (r) => r.name },
    { header: 'RUT', desc: 'RUT del conductor.', width: 15, get: (r) => r.rut },
    { header: 'Teléfono', desc: 'Teléfono.', width: 16, get: (r) => r.phone },
    { header: 'Correo', desc: 'Correo electrónico.', width: 26, get: (r) => r.email },
    { header: 'Clase licencia', desc: 'A1, A2, A3, A4, A5, B, C o D.', width: 10, get: (r) => r.licenseClass },
    { header: 'Vencimiento licencia', desc: 'Fecha de vencimiento de la licencia.', kind: 'date', width: 14, get: (r) => r.licenseDue },
    { header: 'Estado', desc: 'Activo, Licencia médica, Vacaciones o Inactivo.', width: 14, get: (r) => r.status },
    { header: 'Costo diario', desc: 'Costo por jornada/viático usado en cotizaciones (CLP).', kind: 'money', width: 14, get: (r) => r.dailyRate },
  ],
};

const S_VEHICULOS: SheetDef<Vehicle> = {
  name: 'Vehículos',
  desc: 'Camiones, tractos, camionetas y furgones.',
  importable: true,
  rows: (db) => db.vehicles,
  cols: [
    { header: 'ID', desc: 'Identificador interno. Déjalo vacío para registros nuevos.', width: 38, get: (r) => r.id },
    { header: 'Patente', desc: 'Patente del vehículo (ej. ABCD-12).', required: true, width: 12, get: (r) => r.plate },
    { header: 'Tipo', desc: VEHICLE_TYPES.join(', ') + '.', width: 15, get: (r) => r.type },
    { header: 'Marca', desc: 'Marca.', width: 16, get: (r) => r.brand },
    { header: 'Modelo', desc: 'Modelo.', width: 16, get: (r) => r.model },
    { header: 'Año', desc: 'Año de fabricación.', kind: 'number', width: 8, get: (r) => r.year },
    { header: 'Capacidad (kg)', desc: 'Capacidad de carga en kilos.', kind: 'number', width: 12, get: (r) => r.capacityKg },
    { header: 'Rendimiento (km/L)', desc: 'Rendimiento promedio con carga.', kind: 'number', width: 12, get: (r) => r.fuelEfficiency },
    { header: 'Kilometraje', desc: 'Odómetro actual.', kind: 'number', width: 12, get: (r) => r.odometer },
    { header: 'Estado', desc: 'Activo, En mantención o Inactivo.', width: 14, get: (r) => r.status },
    { header: 'RUT conductor asignado', desc: 'RUT del conductor habitual (debe existir en Conductores).', width: 16, get: (r, L) => (r.driverId ? L.driver.get(r.driverId)?.rut : '') },
    { header: 'Conductor asignado', desc: 'Nombre del conductor habitual (se usa si no hay RUT).', width: 24, get: (r, L) => (r.driverId ? L.driver.get(r.driverId)?.name : '') },
    { header: 'Vence revisión técnica', desc: 'Fecha.', kind: 'date', width: 14, get: (r) => r.techReviewDue },
    { header: 'Vence seguro', desc: 'Fecha.', kind: 'date', width: 14, get: (r) => r.insuranceDue },
    { header: 'Vence permiso de circulación', desc: 'Fecha.', kind: 'date', width: 14, get: (r) => r.permitDue },
    { header: 'Notas', desc: 'Observaciones.', width: 30, get: (r) => r.notes },
  ],
};

const S_TARIFAS: SheetDef<DB['tariffs'][number]> = {
  name: 'Tarifas',
  desc: 'Tarifario usado en cotizaciones.',
  importable: true,
  rows: (db) => db.tariffs,
  cols: [
    { header: 'ID', desc: 'Identificador interno. Déjalo vacío para registros nuevos.', width: 38, get: (r) => r.id },
    { header: 'Nombre', desc: 'Nombre de la tarifa.', required: true, width: 34, get: (r) => r.name },
    { header: 'Unidad', desc: 'km, viaje, kg o día.', width: 10, get: (r) => r.unit },
    { header: 'Valor', desc: 'Valor neto por unidad (CLP).', kind: 'money', width: 14, get: (r) => r.value },
    { header: 'Tipo de vehículo', desc: 'Opcional. ' + VEHICLE_TYPES.join(', ') + '.', width: 16, get: (r) => r.vehicleType },
    { header: 'Descripción', desc: 'Detalle.', width: 34, get: (r) => r.description },
  ],
};

const S_VIAJES: SheetDef<Trip> = {
  name: 'Viajes',
  desc: 'Viajes/fletes con su facturación y estado de pago.',
  importable: true,
  rows: (db) => [...db.trips].sort((a, b) => a.date.localeCompare(b.date)),
  cols: [
    { header: 'ID', desc: 'Identificador interno. Déjalo vacío para registros nuevos.', width: 38, get: (r) => r.id },
    { header: 'N° viaje', desc: 'Código del viaje (ej. V-0001). Si está vacío se asigna automáticamente.', width: 10, get: (r) => r.code },
    { header: 'Fecha salida', desc: 'Fecha de inicio del viaje.', required: true, kind: 'date', width: 13, get: (r) => r.date },
    { header: 'Fecha término', desc: 'Opcional, para viajes de varios días.', kind: 'date', width: 13, get: (r) => r.endDate },
    { header: 'Cliente', desc: 'Razón social del cliente (debe existir en Clientes).', required: true, width: 30, get: (r, L) => L.client.get(r.clientId)?.name },
    { header: 'RUT cliente', desc: 'RUT del cliente (tiene prioridad sobre el nombre).', width: 15, get: (r, L) => L.client.get(r.clientId)?.rut },
    { header: 'Patente', desc: 'Patente del vehículo (debe existir en Vehículos).', required: true, width: 11, get: (r, L) => L.vehicle.get(r.vehicleId)?.plate },
    { header: 'Conductor', desc: 'Nombre del conductor. Si está vacío se usa el asignado al vehículo.', width: 24, get: (r, L) => L.driver.get(r.driverId)?.name },
    { header: 'RUT conductor', desc: 'RUT del conductor (tiene prioridad sobre el nombre).', width: 15, get: (r, L) => L.driver.get(r.driverId)?.rut },
    { header: 'Origen', desc: 'Ciudad o dirección de origen.', width: 16, get: (r) => r.origin },
    { header: 'Destino', desc: 'Ciudad o dirección de destino.', required: true, width: 16, get: (r) => r.destination },
    { header: 'Distancia km (solo ida)', desc: 'Kilómetros de ida.', kind: 'number', width: 11, get: (r) => r.distanceKm },
    { header: 'Carga', desc: 'Descripción de la carga.', width: 26, get: (r) => r.cargo },
    { header: 'Peso (kg)', desc: 'Peso de la carga.', kind: 'number', width: 11, get: (r) => r.weightKg },
    { header: 'Tarifa neta', desc: 'Valor del flete sin IVA (CLP).', required: true, kind: 'money', width: 14, get: (r) => r.price },
    { header: 'Estado', desc: TRIP_STATUSES.join(', ') + '. Si está vacío: Completado (fechas pasadas) o Planificado.', width: 12, get: (r) => r.status },
    { header: 'N° factura', desc: 'Número de la factura emitida, si existe.', width: 10, get: (r) => r.invoice?.number },
    { header: 'Fecha emisión factura', desc: 'Fecha de emisión.', kind: 'date', width: 13, get: (r) => r.invoice?.issueDate },
    { header: 'Fecha vencimiento factura', desc: 'Fecha de vencimiento.', kind: 'date', width: 13, get: (r) => r.invoice?.dueDate },
    { header: 'Pagada', desc: 'Sí o No.', kind: 'bool', width: 8, get: (r) => YES(r.invoice?.paid) },
    { header: 'Fecha pago', desc: 'Fecha en que se recibió el pago.', kind: 'date', width: 13, get: (r) => r.invoice?.paidDate },
    { header: 'Notas', desc: 'Observaciones.', width: 30, get: (r) => r.notes },
  ],
};

const S_GASTOS: SheetDef<DB['expenses'][number]> = {
  name: 'Gastos',
  desc: 'Combustible, peajes, mantenciones y demás costos.',
  importable: true,
  rows: (db) => [...db.expenses].sort((a, b) => a.date.localeCompare(b.date)),
  cols: [
    { header: 'ID', desc: 'Identificador interno. Déjalo vacío para registros nuevos.', width: 38, get: (r) => r.id },
    { header: 'Fecha', desc: 'Fecha del gasto.', required: true, kind: 'date', width: 13, get: (r) => r.date },
    { header: 'Categoría', desc: EXPENSE_CATEGORIES.join(', ') + '.', required: true, width: 15, get: (r) => r.category },
    { header: 'Monto', desc: 'Monto total (CLP).', required: true, kind: 'money', width: 14, get: (r) => r.amount },
    { header: 'Litros', desc: 'Sólo combustible.', kind: 'number', width: 9, get: (r) => r.liters },
    { header: 'Patente', desc: 'Vehículo asociado (opcional).', width: 11, get: (r, L) => (r.vehicleId ? L.vehicle.get(r.vehicleId)?.plate : '') },
    { header: 'N° viaje', desc: 'Viaje asociado (opcional, ej. V-0001).', width: 10, get: (r, L) => (r.tripId ? L.trip.get(r.tripId)?.code : '') },
    { header: 'Proveedor', desc: 'Proveedor.', width: 22, get: (r) => r.provider },
    { header: 'N° documento', desc: 'Boleta o factura.', width: 12, get: (r) => r.docNumber },
    { header: 'Descripción', desc: 'Detalle.', width: 36, get: (r) => r.description },
  ],
};

const S_COTIZACIONES: SheetDef<DB['quotes'][number]> = {
  name: 'Cotizaciones',
  desc: 'Cotizaciones emitidas con su costo y precio (sólo exportación).',
  importable: false,
  rows: (db) => [...db.quotes].sort((a, b) => a.date.localeCompare(b.date)),
  cols: [
    { header: 'ID', desc: 'Identificador interno.', width: 38, get: (r) => r.id },
    { header: 'N° cotización', desc: 'Código.', width: 11, get: (r) => r.code },
    { header: 'Fecha', desc: 'Fecha de emisión.', kind: 'date', width: 13, get: (r) => r.date },
    { header: 'Válida hasta', desc: 'Fecha de validez.', kind: 'date', width: 13, get: (r) => r.validUntil },
    { header: 'Cliente', desc: 'Razón social.', width: 30, get: (r, L) => L.client.get(r.clientId)?.name },
    { header: 'RUT cliente', desc: 'RUT.', width: 15, get: (r, L) => L.client.get(r.clientId)?.rut },
    { header: 'Origen', desc: 'Origen.', width: 16, get: (r) => r.origin },
    { header: 'Destino', desc: 'Destino.', width: 16, get: (r) => r.destination },
    { header: 'Distancia km (solo ida)', desc: 'Kilómetros.', kind: 'number', width: 11, get: (r) => r.distanceKm },
    { header: 'Ida y vuelta', desc: 'Sí o No.', kind: 'bool', width: 8, get: (r) => YES(r.roundTrip) },
    { header: 'Patente', desc: 'Vehículo considerado.', width: 11, get: (r, L) => (r.vehicleId ? L.vehicle.get(r.vehicleId)?.plate : '') },
    { header: 'Carga', desc: 'Carga.', width: 24, get: (r) => r.cargo },
    { header: 'Costo total', desc: 'Costo estimado del servicio.', kind: 'money', width: 14, get: (r, _L, db) => Math.round(calcQuote(r, db.tariffs, db.settings.params.ivaPct, db.settings.params.workdayHours).cost) },
    { header: 'Precio neto', desc: 'Precio sin IVA.', kind: 'money', width: 14, get: (r, _L, db) => calcQuote(r, db.tariffs, db.settings.params.ivaPct, db.settings.params.workdayHours).net },
    { header: 'IVA', desc: 'IVA.', kind: 'money', width: 12, get: (r, _L, db) => calcQuote(r, db.tariffs, db.settings.params.ivaPct, db.settings.params.workdayHours).iva },
    { header: 'Total', desc: 'Precio con IVA.', kind: 'money', width: 14, get: (r, _L, db) => calcQuote(r, db.tariffs, db.settings.params.ivaPct, db.settings.params.workdayHours).total },
    { header: 'Estado', desc: 'Borrador, Enviada, Aceptada o Rechazada.', width: 11, get: (r) => r.status },
    { header: 'Condiciones', desc: 'Condiciones comerciales.', width: 50, get: (r, _L, db) => r.conditions ?? db.settings.quoteConditions },
    { header: 'Observaciones', desc: 'Observaciones para el cliente.', width: 30, get: (r) => r.notes },
    { header: 'N° viaje generado', desc: 'Viaje creado desde la cotización.', width: 10, get: (r, L) => (r.tripId ? L.trip.get(r.tripId)?.code : '') },
  ],
};

const S_COMPROBANTES: SheetDef<DB['proofs'][number]> = {
  name: 'Comprobantes',
  desc: 'Comprobantes de entrega (sólo exportación; firmas y fotos van en el paquete ZIP).',
  importable: false,
  rows: (db) => [...db.proofs].sort((a, b) => a.date.localeCompare(b.date)),
  cols: [
    { header: 'ID', desc: 'Identificador interno.', width: 38, get: (r) => r.id },
    { header: 'N° comprobante', desc: 'Código.', width: 12, get: (r) => r.code },
    { header: 'N° viaje', desc: 'Viaje entregado.', width: 10, get: (r, L) => L.trip.get(r.tripId)?.code },
    { header: 'Fecha', desc: 'Fecha de entrega.', kind: 'date', width: 13, get: (r) => r.date },
    { header: 'Hora', desc: 'Hora de entrega.', width: 8, get: (r) => r.time },
    { header: 'Recibido por', desc: 'Nombre del receptor.', width: 24, get: (r) => r.receiverName },
    { header: 'RUT receptor', desc: 'RUT del receptor.', width: 15, get: (r) => r.receiverRut },
    { header: 'Estado carga', desc: 'Conforme, Con observaciones o Rechazado.', width: 16, get: (r) => r.condition },
    { header: 'Observaciones', desc: 'Observaciones.', width: 36, get: (r) => r.observations },
    { header: 'Con firma', desc: 'Sí o No.', kind: 'bool', width: 9, get: (r) => YES(!!r.signature) },
    { header: 'N° fotos', desc: 'Cantidad de fotos.', kind: 'number', width: 8, get: (r) => r.photos.length },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SHEETS: SheetDef<any>[] = [S_CLIENTES, S_CONDUCTORES, S_VEHICULOS, S_TARIFAS, S_VIAJES, S_GASTOS, S_COTIZACIONES, S_COMPROBANTES];

const lookups = (db: DB): Lookups => ({
  vehicle: new Map(db.vehicles.map((v) => [v.id, v])),
  driver: new Map(db.drivers.map((d) => [d.id, d])),
  client: new Map(db.clients.map((c) => [c.id, c])),
  trip: new Map(db.trips.map((t) => [t.id, t])),
});

function companyRows(db: DB): [string, string, unknown][] {
  const c = db.settings.company;
  const b = db.settings.bank;
  const p = db.settings.params;
  return [
    ['Empresa', 'Razón social', c.name],
    ['Empresa', 'RUT', c.rut],
    ['Empresa', 'Giro', c.giro],
    ['Empresa', 'Dirección', c.address],
    ['Empresa', 'Teléfono', c.phone],
    ['Empresa', 'Correo', c.email],
    ['Empresa', 'Sitio web', c.website ?? ''],
    ['Banco', 'Banco', b.bank],
    ['Banco', 'Tipo de cuenta', b.accountType],
    ['Banco', 'N° de cuenta', b.accountNumber],
    ['Banco', 'Titular', b.holder],
    ['Banco', 'RUT titular', b.rut],
    ['Banco', 'Correo', b.email],
    ['Parámetros', 'Precio diésel (CLP/L)', p.fuelPrice],
    ['Parámetros', 'IVA (%)', p.ivaPct],
    ['Parámetros', 'Margen objetivo (%)', p.defaultMarginPct],
    ['Parámetros', 'Desgaste / mantención (CLP/km)', p.maintenancePerKm],
    ['Parámetros', 'Costo diario conductor (CLP)', p.defaultDriverRate],
    ['Parámetros', 'Validez cotizaciones (días)', p.quoteValidityDays],
    ['Cotizaciones', 'Condiciones por defecto', db.settings.quoteConditions],
  ];
}

/* ------------------------------------------------------------------ */
/*  Exportar a Excel                                                   */
/* ------------------------------------------------------------------ */

const NAVY = 'FF0B2A52';

async function loadExcel() {
  const mod = await import('exceljs');
  return (mod as unknown as { default: typeof import('exceljs') }).default ?? mod;
}

/** Excel con todos los datos. Con `template: true` genera la plantilla vacía para importar. */
export async function buildXlsx(db: DB, opts: { template?: boolean } = {}): Promise<Blob> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = db.settings.company.name;
  wb.created = new Date();
  const L = lookups(db);
  const sheets = opts.template ? SHEETS.filter((s) => s.importable) : SHEETS;

  /* Léeme */
  const readme = wb.addWorksheet('Léeme', { properties: { tabColor: { argb: 'FFFF8A00' } } });
  readme.getColumn(1).width = 26;
  readme.getColumn(2).width = 100;
  const t = readme.addRow([opts.template ? 'Plantilla de importación de datos' : `Exportación de datos — ${db.settings.company.name}`]);
  t.font = { bold: true, size: 16, color: { argb: NAVY } };
  readme.addRow([opts.template ? 'Completa las hojas y súbelas en Configuración → Datos → Importar.' : `Generado el ${today()} · ${FORMAT_VERSION}`]).font = { color: { argb: 'FF6E6E73' } };
  readme.addRow([]);
  const notes = opts.template
    ? [
        'Cada hoja corresponde a un módulo. La primera fila contiene los encabezados: no los cambies de nombre.',
        'Las columnas marcadas con * son obligatorias. Las demás puedes dejarlas vacías.',
        'Importa en este orden si vienes de otro sistema: Clientes, Conductores y Vehículos primero; luego Viajes y Gastos (que hacen referencia a los anteriores por RUT, nombre o patente).',
        'Fechas: formato fecha de Excel o texto AAAA-MM-DD / DD-MM-AAAA. Montos en pesos chilenos, netos (sin IVA), sin decimales.',
        'Puedes borrar las hojas que no necesites. La columna ID déjala vacía para registros nuevos.',
        'Revisa la hoja "Diccionario" para ver el significado y formato de cada columna.',
      ]
    : [
        'Este archivo contiene toda la información de tu empresa en un formato abierto. Es tuyo: puedes abrirlo en Excel, Google Sheets o LibreOffice y cargarlo en cualquier otro sistema.',
        'Cada hoja corresponde a un módulo. La hoja "Diccionario" describe cada columna.',
        'Las columnas ID son identificadores únicos que mantienen la relación entre hojas (por ejemplo, un gasto con su viaje). Además se incluyen datos legibles (patente, N° de viaje, RUT y nombre del cliente).',
        'Montos en pesos chilenos, netos (sin IVA) salvo que la columna indique lo contrario.',
        'Este mismo archivo puede volver a importarse: las filas con ID existente se actualizan y las nuevas se crean.',
        'Las firmas y fotos de los comprobantes de entrega se incluyen en el "Paquete completo (.zip)".',
      ];
  notes.forEach((n, i) => {
    const r = readme.addRow([i === 0 ? 'Cómo usar este archivo' : '', `• ${n}`]);
    r.getCell(1).font = { bold: true };
    r.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  });
  readme.addRow([]);
  const h = readme.addRow(['Hoja', 'Contenido']);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }));
  for (const s of sheets) readme.addRow([s.name, `${s.desc}${opts.template ? '' : ` (${s.rows(db).length} registros)`}`]);
  if (!opts.template) readme.addRow(['Empresa', 'Datos de la empresa, cuenta bancaria y parámetros.']);

  /* Hojas de datos */
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = s.cols.map((c) => ({
      header: opts.template && c.required ? `${c.header} *` : c.header,
      key: c.header,
      width: c.width ?? 16,
      style:
        c.kind === 'date'
          ? { numFmt: 'dd-mm-yyyy' }
          : c.kind === 'money'
            ? { numFmt: '"$"#,##0' }
            : c.kind === 'number'
              ? { numFmt: '#,##0.##' }
              : {},
    }));
    if (!opts.template) {
      for (const r of s.rows(db)) {
        ws.addRow(
          s.cols.map((c) => {
            const v = c.get(r, L, db);
            if (c.kind === 'date') return isoToExcelDate(v as string | undefined);
            if (v === undefined || v === null) return null;
            return v;
          }),
        );
      }
    }
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.alignment = { vertical: 'middle', wrapText: true };
    head.height = 30;
    head.eachCell((c, i) => {
      const col = s.cols[i - 1];
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col?.required ? 'FFC86A00' : NAVY } };
      c.note = col ? `${col.desc}${col.required ? ' (obligatoria)' : ''}` : '';
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.cols.length } };
  }

  /* Empresa */
  if (!opts.template) {
    const ws = wb.addWorksheet('Empresa');
    ws.columns = [
      { header: 'Sección', key: 's', width: 14 },
      { header: 'Campo', key: 'k', width: 32 },
      { header: 'Valor', key: 'v', width: 80 },
    ];
    companyRows(db).forEach((r) => ws.addRow(r).getCell(3).alignment = { wrapText: true });
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }));
  }

  /* Diccionario */
  const dic = wb.addWorksheet('Diccionario', { views: [{ state: 'frozen', ySplit: 1 }] });
  dic.columns = [
    { header: 'Hoja', key: 'h', width: 14 },
    { header: 'Columna', key: 'c', width: 28 },
    { header: 'Obligatoria al importar', key: 'o', width: 12 },
    { header: 'Formato', key: 'f', width: 12 },
    { header: 'Descripción', key: 'd', width: 80 },
  ];
  const fmt: Record<Kind, string> = { text: 'Texto', number: 'Número', money: 'Pesos (CLP)', date: 'Fecha', bool: 'Sí / No' };
  for (const s of sheets) for (const c of s.cols) dic.addRow([s.name, c.header, s.importable ? (c.required ? 'Sí' : 'No') : '—', fmt[c.kind ?? 'text'], c.desc]);
  dic.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  dic.getRow(1).eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }));

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/* ------------------------------------------------------------------ */
/*  Exportar paquete ZIP (CSV + imágenes + JSON)                       */
/* ------------------------------------------------------------------ */

const csvCell = (v: unknown, kind?: Kind) => {
  if (v === undefined || v === null) return '';
  let s: string;
  if (typeof v === 'number') s = kind === 'money' ? String(Math.round(v)) : String(v).replace('.', ',');
  else {
    s = String(v);
    // Evita la inyección de fórmulas al abrir el CSV en Excel (=, +, -, @, tabulador o retorno al inicio)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  }
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function dataUrlToBytes(url: string): { bytes: Uint8Array; ext: string } | null {
  // data:<tipo>[;parámetros][;base64],<datos>
  const comma = url.indexOf(',');
  if (!url.startsWith('data:') || comma < 0) return null;
  const meta = url.slice(5, comma).split(';');
  const data = url.slice(comma + 1);
  const mime = meta[0] || '';
  const ext = mime.includes('svg') ? 'svg' : mime.includes('png') ? 'png' : 'jpg';
  if (meta.includes('base64')) {
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, ext };
  }
  return { bytes: new TextEncoder().encode(decodeURIComponent(data)), ext };
}

export async function buildZip(db: DB): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const L = lookups(db);
  const BOM = '﻿';
  const files: string[] = [];
  for (const s of SHEETS) {
    const lines = [s.cols.map((c) => csvCell(c.header)).join(';')];
    for (const r of s.rows(db)) lines.push(s.cols.map((c) => csvCell(c.get(r, L, db), c.kind)).join(';'));
    const name = `${s.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.csv`;
    zip.file(name, BOM + lines.join('\r\n'));
    files.push(`${name}  —  ${s.desc} (${s.rows(db).length} registros)`);
  }
  zip.file('empresa.csv', BOM + ['Sección;Campo;Valor', ...companyRows(db).map((r) => r.map((v) => csvCell(v)).join(';'))].join('\r\n'));

  // Firmas y fotos de comprobantes
  let images = 0;
  for (const p of db.proofs) {
    const folder = zip.folder(`comprobantes/${p.code}`)!;
    if (p.signature) {
      const f = dataUrlToBytes(p.signature);
      if (f) (folder.file(`firma.${f.ext}`, f.bytes), images++);
    }
    p.photos.forEach((ph, i) => {
      const f = dataUrlToBytes(ph);
      if (f) (folder.file(`foto-${i + 1}.${f.ext}`, f.bytes), images++);
    });
  }
  if (db.settings.company.logo) {
    const f = dataUrlToBytes(db.settings.company.logo);
    if (f) zip.file(`logo.${f.ext}`, f.bytes);
  }

  // Copia exacta (incluye todo lo anterior en un único archivo)
  zip.file('datos-completos.json', JSON.stringify({ format: FORMAT_VERSION, exportedAt: new Date().toISOString(), ...db }, null, 2));

  zip.file(
    'LEEME.txt',
    [
      `Exportación de datos — ${db.settings.company.name}`,
      `Generado: ${today()} · ${FORMAT_VERSION}`,
      '',
      'Contenido:',
      ...files.map((f) => `  - ${f}`),
      '  - empresa.csv  —  Datos de la empresa, cuenta bancaria y parámetros',
      `  - comprobantes/  —  Firmas y fotos de cada comprobante de entrega (${images} imágenes)`,
      '  - datos-completos.json  —  Copia exacta de toda la información (para migraciones técnicas)',
      '',
      'Formato CSV:',
      '  - Codificación UTF-8, separador punto y coma (;), decimales con coma.',
      '  - Fechas en formato AAAA-MM-DD. Montos en pesos chilenos, netos (sin IVA).',
      '  - Las columnas ID relacionan las tablas entre sí (ej. un gasto con su viaje).',
      '',
      'Estos datos son de tu propiedad y puedes cargarlos en cualquier otro sistema.',
    ].join('\r\n'),
  );
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/* ------------------------------------------------------------------ */
/*  Importar desde Excel                                               */
/* ------------------------------------------------------------------ */

export interface SheetReport {
  sheet: string;
  created: number;
  updated: number;
  unchanged: number;
  errors: { row: number; msg: string }[];
}

export interface ImportPlan {
  reports: SheetReport[];
  changes: Partial<{ [K in CollectionKey]: Item<K>[] }>;
  total: number;
  ignoredSheets: string[];
}

type Row = { n: number; get: (header: string) => Cell; has: (header: string) => boolean };

async function readSheets(file: File) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const out = new Map<string, Row[]>();
  wb.eachSheet((ws) => {
    const headers = new Map<string, number>();
    ws.getRow(1).eachCell((c, col) => headers.set(norm(toStr(c.value)), col));
    const rows: Row[] = [];
    ws.eachRow({ includeEmpty: false }, (r, n) => {
      if (n === 1) return;
      const vals = r.values as unknown as Cell[];
      if (!vals.some((v) => toStr(v) !== '')) return;
      rows.push({
        n,
        get: (h) => {
          const i = headers.get(norm(h));
          return i ? vals[i] : null;
        },
        has: (h) => headers.has(norm(h)),
      });
    });
    out.set(norm(ws.name), rows);
  });
  return out;
}

/** Lee un Excel con el formato de exportación/plantilla y prepara los cambios sin aplicarlos. */
export async function planImport(file: File, db: DB): Promise<ImportPlan> {
  const sheets = await readSheets(file);
  const reports: SheetReport[] = [];
  const changes: ImportPlan['changes'] = {};
  const known = new Set(SHEETS.filter((s) => s.importable).map((s) => norm(s.name)));
  const ignoredSheets = [...sheets.keys()].filter((k) => !known.has(k) && !['leeme', 'diccionario', 'empresa', 'cotizaciones', 'comprobantes'].includes(k));

  // Estado de trabajo (incluye lo que se va importando para resolver referencias)
  const clients = [...db.clients];
  const drivers = [...db.drivers];
  const vehicles = [...db.vehicles];
  const tariffs = [...db.tariffs];
  const trips = [...db.trips];
  const expenses = [...db.expenses];

  const findClient = (rut: string, name: string) =>
    (rut && clients.find((c) => rutKey(c.rut) === rutKey(rut))) || (name && clients.find((c) => norm(c.name) === norm(name))) || undefined;
  const findDriver = (rut: string, name: string) =>
    (rut && drivers.find((d) => rutKey(d.rut) === rutKey(rut))) || (name && drivers.find((d) => norm(d.name) === norm(name))) || undefined;
  const findVehicle = (plate: string) => (plate ? vehicles.find((v) => rutKey(v.plate) === rutKey(plate)) : undefined);

  /**
   * Inserta o actualiza en la lista de trabajo y registra el cambio.
   * `defaults` sólo se usa para registros nuevos; en una actualización sólo se aplican los datos leídos del archivo.
   */
  function put<K extends CollectionKey>(key: K, list: Item<K>[], defaults: Item<K>, data: Partial<Item<K>>, rep: SheetReport, existing?: Item<K>) {
    const bucket = (changes[key] ??= []) as Item<K>[];
    if (existing) {
      const merged = { ...existing, ...data, id: existing.id } as Item<K>;
      const same = (a: object, b: object) => JSON.stringify(a, Object.keys({ ...a, ...b }).sort()) === JSON.stringify(b, Object.keys({ ...a, ...b }).sort());
      if (same(merged, existing)) {
        rep.unchanged++;
        return;
      }
      list[list.indexOf(existing)] = merged;
      const prev = bucket.findIndex((x) => x.id === merged.id);
      if (prev >= 0) bucket[prev] = merged;
      else bucket.push(merged);
      rep.updated++;
    } else {
      const item = { ...defaults, ...data } as Item<K>;
      list.push(item);
      bucket.push(item);
      rep.created++;
    }
  }

  /** Sólo copia los campos cuya columna existe en la hoja (no borra datos por columnas ausentes). */
  const pick = <T extends object>(r: Row, map: [string, keyof T, (v: Cell) => unknown][]) => {
    const o: Partial<T> = {};
    for (const [h, k, conv] of map) if (r.has(h)) o[k] = conv(r.get(h)) as T[keyof T];
    return o;
  };
  const optStr = (v: Cell) => toStr(v) || undefined;
  const optDate = (v: Cell) => dateFromAny(v) ?? undefined;
  const optNum = (v: Cell) => toNum(v) ?? undefined;
  const byId = <T extends { id: string }>(list: T[], r: Row) => {
    const id = toStr(r.get('ID'));
    return id ? list.find((x) => x.id === id) : undefined;
  };

  /* Clientes */
  const cRows = sheets.get(norm('Clientes'));
  if (cRows) {
    const rep: SheetReport = { sheet: 'Clientes', created: 0, updated: 0, unchanged: 0, errors: [] };
    for (const r of cRows) {
      const name = toStr(r.get('Razón social'));
      const rut = toStr(r.get('RUT'));
      if (!name) { rep.errors.push({ row: r.n, msg: 'Falta la razón social.' }); continue; }
      const ex = byId(clients, r) ?? findClient(rut, name);
      const data = pick<DB['clients'][number]>(r, [
        ['RUT', 'rut', toStr], ['Contacto', 'contact', toStr], ['Correo', 'email', toStr], ['Teléfono', 'phone', toStr],
        ['Dirección', 'address', toStr], ['Plazo de pago (días)', 'paymentTermsDays', (v) => toNum(v) ?? 30],
      ]);
      put('clients', clients, { id: uid(), name, rut: '', contact: '', email: '', phone: '', address: '', paymentTermsDays: 30 }, { ...data, name }, rep, ex);
    }
    reports.push(rep);
  }

  /* Conductores */
  const dRows = sheets.get(norm('Conductores'));
  if (dRows) {
    const rep: SheetReport = { sheet: 'Conductores', created: 0, updated: 0, unchanged: 0, errors: [] };
    for (const r of dRows) {
      const name = toStr(r.get('Nombre'));
      const rut = toStr(r.get('RUT'));
      if (!name) { rep.errors.push({ row: r.n, msg: 'Falta el nombre.' }); continue; }
      const status = toEnum(r.get('Estado'), ['Activo', 'Licencia médica', 'Vacaciones', 'Inactivo'] as const);
      if (toStr(r.get('Estado')) && !status) { rep.errors.push({ row: r.n, msg: `Estado "${toStr(r.get('Estado'))}" no válido.` }); continue; }
      const ex = byId(drivers, r) ?? findDriver(rut, name);
      const data = pick<DB['drivers'][number]>(r, [
        ['RUT', 'rut', toStr], ['Teléfono', 'phone', toStr], ['Correo', 'email', optStr], ['Clase licencia', 'licenseClass', (v) => toStr(v).toUpperCase() || 'B'],
        ['Vencimiento licencia', 'licenseDue', optDate], ['Costo diario', 'dailyRate', (v) => toNum(v) ?? db.settings.params.defaultDriverRate],
      ]);
      if (status) data.status = status;
      put('drivers', drivers, { id: uid(), name, rut: '', phone: '', licenseClass: 'B', status: 'Activo', dailyRate: db.settings.params.defaultDriverRate }, { ...data, name }, rep, ex);
    }
    reports.push(rep);
  }

  /* Vehículos */
  const vRows = sheets.get(norm('Vehículos'));
  if (vRows) {
    const rep: SheetReport = { sheet: 'Vehículos', created: 0, updated: 0, unchanged: 0, errors: [] };
    for (const r of vRows) {
      const plate = toStr(r.get('Patente')).toUpperCase();
      if (!plate) { rep.errors.push({ row: r.n, msg: 'Falta la patente.' }); continue; }
      const type = toEnum(r.get('Tipo'), VEHICLE_TYPES);
      if (toStr(r.get('Tipo')) && !type) { rep.errors.push({ row: r.n, msg: `Tipo "${toStr(r.get('Tipo'))}" no válido (${VEHICLE_TYPES.join(', ')}).` }); continue; }
      const status = toEnum(r.get('Estado'), ['Activo', 'En mantención', 'Inactivo'] as const);
      const drvRut = toStr(r.get('RUT conductor asignado'));
      const drvName = toStr(r.get('Conductor asignado'));
      const drv = drvRut || drvName ? findDriver(drvRut, drvName) : undefined;
      if ((drvRut || drvName) && !drv) { rep.errors.push({ row: r.n, msg: `Conductor "${drvRut || drvName}" no existe en Conductores.` }); continue; }
      const ex = byId(vehicles, r) ?? findVehicle(plate);
      const data = pick<Vehicle>(r, [
        ['Marca', 'brand', toStr], ['Modelo', 'model', toStr], ['Año', 'year', (v) => toNum(v) ?? new Date().getFullYear()],
        ['Capacidad (kg)', 'capacityKg', (v) => toNum(v) ?? 0], ['Rendimiento (km/L)', 'fuelEfficiency', (v) => toNum(v) ?? 0],
        ['Kilometraje', 'odometer', (v) => toNum(v) ?? 0], ['Vence revisión técnica', 'techReviewDue', optDate], ['Vence seguro', 'insuranceDue', optDate],
        ['Vence permiso de circulación', 'permitDue', optDate], ['Notas', 'notes', optStr],
      ]);
      if (type) data.type = type;
      if (status) data.status = status;
      if (r.has('RUT conductor asignado') || r.has('Conductor asignado')) data.driverId = drv?.id;
      put('vehicles', vehicles, { id: uid(), plate, brand: '', model: '', year: new Date().getFullYear(), type: 'Camión', capacityKg: 0, fuelEfficiency: 0, odometer: 0, status: 'Activo' }, { ...data, plate }, rep, ex);
    }
    reports.push(rep);
  }

  /* Tarifas */
  const tRows = sheets.get(norm('Tarifas'));
  if (tRows) {
    const rep: SheetReport = { sheet: 'Tarifas', created: 0, updated: 0, unchanged: 0, errors: [] };
    for (const r of tRows) {
      const name = toStr(r.get('Nombre'));
      if (!name) { rep.errors.push({ row: r.n, msg: 'Falta el nombre.' }); continue; }
      const unit = toEnum(r.get('Unidad'), ['km', 'viaje', 'kg', 'día'] as const);
      if (toStr(r.get('Unidad')) && !unit) { rep.errors.push({ row: r.n, msg: `Unidad "${toStr(r.get('Unidad'))}" no válida (km, viaje, kg, día).` }); continue; }
      const ex = byId(tariffs, r) ?? tariffs.find((x) => norm(x.name) === norm(name));
      const data = pick<DB['tariffs'][number]>(r, [
        ['Valor', 'value', (v) => toNum(v) ?? 0], ['Tipo de vehículo', 'vehicleType', (v) => toEnum(v, VEHICLE_TYPES) ?? undefined], ['Descripción', 'description', optStr],
      ]);
      if (unit) data.unit = unit;
      put('tariffs', tariffs, { id: uid(), name, unit: 'km', value: 0 }, { ...data, name }, rep, ex);
    }
    reports.push(rep);
  }

  /* Viajes */
  const trRows = sheets.get(norm('Viajes'));
  if (trRows) {
    const rep: SheetReport = { sheet: 'Viajes', created: 0, updated: 0, unchanged: 0, errors: [] };
    for (const r of trRows) {
      const date = dateFromAny(r.get('Fecha salida'));
      const cRut = toStr(r.get('RUT cliente'));
      const cName = toStr(r.get('Cliente'));
      const plate = toStr(r.get('Patente'));
      const dest = toStr(r.get('Destino'));
      const price = toNum(r.get('Tarifa neta'));
      const errs: string[] = [];
      if (!date) errs.push('fecha de salida vacía o no válida');
      const client = findClient(cRut, cName);
      if (!client) errs.push(cRut || cName ? `cliente "${cName || cRut}" no existe en Clientes` : 'falta el cliente');
      const vehicle = findVehicle(plate);
      if (!vehicle) errs.push(plate ? `patente "${plate}" no existe en Vehículos` : 'falta la patente');
      if (!dest) errs.push('falta el destino');
      if (price == null) errs.push('falta la tarifa neta');
      const dRut = toStr(r.get('RUT conductor'));
      const dName = toStr(r.get('Conductor'));
      const driver = dRut || dName ? findDriver(dRut, dName) : vehicle?.driverId ? drivers.find((d) => d.id === vehicle.driverId) : undefined;
      if ((dRut || dName) && !driver) errs.push(`conductor "${dName || dRut}" no existe en Conductores`);
      if (!driver && !dRut && !dName) errs.push('falta el conductor y el vehículo no tiene uno asignado');
      const stRaw = toStr(r.get('Estado'));
      const status = toEnum(stRaw, TRIP_STATUSES);
      if (stRaw && !status) errs.push(`estado "${stRaw}" no válido`);
      if (errs.length) { rep.errors.push({ row: r.n, msg: errs.join('; ') + '.' }); continue; }

      const code = toStr(r.get('N° viaje'));
      const ex = byId(trips, r) ?? (code ? trips.find((x) => x.code === code) : undefined);
      const data = pick<Trip>(r, [
        ['Fecha término', 'endDate', optDate], ['Origen', 'origin', toStr], ['Distancia km (solo ida)', 'distanceKm', (v) => toNum(v) ?? 0],
        ['Carga', 'cargo', toStr], ['Peso (kg)', 'weightKg', (v) => toNum(v) ?? 0], ['Notas', 'notes', optStr],
      ]);
      const hasInv = ['N° factura', 'Fecha emisión factura', 'Fecha vencimiento factura', 'Pagada', 'Fecha pago'].some((h) => r.has(h));
      const upd: Partial<Trip> = { ...data, date: date!, clientId: client!.id, vehicleId: vehicle!.id, driverId: driver!.id, destination: dest, price: price! };
      if (code) upd.code = code;
      if (status) upd.status = status;
      if (hasInv) {
        const invNo = toStr(r.get('N° factura'));
        const paid = !!invNo && toBool(r.get('Pagada'));
        const issueDate = optDate(r.get('Fecha emisión factura'));
        let dueDate = optDate(r.get('Fecha vencimiento factura'));
        if (invNo && !dueDate && issueDate) {
          const d = new Date(issueDate + 'T12:00');
          d.setDate(d.getDate() + client!.paymentTermsDays);
          dueDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        }
        // Pagada sin fecha de pago: se usa el vencimiento (o la emisión), sin pasar de hoy
        let paidDate = paid ? optDate(r.get('Fecha pago')) ?? dueDate ?? issueDate : undefined;
        if (paidDate && paidDate > today()) paidDate = today();
        if (invNo) upd.invoice = { number: invNo, issueDate, dueDate, paid, paidDate };
        else if (ex?.invoice?.number) upd.invoice = { paid: false }; // se quitó la factura en el archivo
      }
      const base: Trip = {
        id: uid(),
        code: code || nextCode('V', trips),
        clientId: client!.id,
        vehicleId: vehicle!.id,
        driverId: driver!.id,
        origin: '',
        destination: dest,
        distanceKm: 0,
        date: date!,
        cargo: '',
        weightKg: 0,
        price: price!,
        status: status ?? (date! < today() ? 'Completado' : 'Planificado'),
        invoice: { paid: false },
      };
      put('trips', trips, base, upd, rep, ex);
    }
    reports.push(rep);
  }

  /* Gastos */
  const gRows = sheets.get(norm('Gastos'));
  if (gRows) {
    const rep: SheetReport = { sheet: 'Gastos', created: 0, updated: 0, unchanged: 0, errors: [] };
    for (const r of gRows) {
      const date = dateFromAny(r.get('Fecha'));
      const cat = toEnum(r.get('Categoría'), EXPENSE_CATEGORIES);
      const amount = toNum(r.get('Monto'));
      const plate = toStr(r.get('Patente'));
      const tripCode = toStr(r.get('N° viaje'));
      const errs: string[] = [];
      if (!date) errs.push('fecha vacía o no válida');
      if (!cat) errs.push(toStr(r.get('Categoría')) ? `categoría "${toStr(r.get('Categoría'))}" no válida` : 'falta la categoría');
      if (amount == null) errs.push('falta el monto');
      const vehicle = plate ? findVehicle(plate) : undefined;
      if (plate && !vehicle) errs.push(`patente "${plate}" no existe`);
      const trip = tripCode ? trips.find((t) => t.code === tripCode) : undefined;
      if (tripCode && !trip) errs.push(`viaje "${tripCode}" no existe`);
      if (errs.length) { rep.errors.push({ row: r.n, msg: errs.join('; ') + '.' }); continue; }
      const ex = byId(expenses, r);
      const data = pick<DB['expenses'][number]>(r, [
        ['Litros', 'liters', optNum], ['Proveedor', 'provider', optStr], ['N° documento', 'docNumber', optStr], ['Descripción', 'description', optStr],
      ]);
      const upd = { ...data, date: date!, category: cat!, amount: amount! } as Partial<DB['expenses'][number]>;
      if (r.has('Patente') || r.has('N° viaje')) Object.assign(upd, { vehicleId: vehicle?.id ?? trip?.vehicleId, tripId: trip?.id });
      put('expenses', expenses, { id: uid(), date: date!, category: cat!, amount: amount! }, upd, rep, ex);
    }
    reports.push(rep);
  }

  const total = reports.reduce((s, r) => s + r.created + r.updated, 0);
  return { reports, changes, total, ignoredSheets };
}

export { SHEETS };
