import type { CollectionKey, Role } from '../store/types';

/**
 * Permisos por rol. Es la única fuente de verdad: la usan el menú, las rutas y la capa de datos
 * (que rechaza cualquier escritura no permitida aunque alguien fuerce la interfaz).
 * En la versión en la nube, estas mismas reglas se replican como políticas RLS en la base de datos.
 */

export type Module =
  | 'inicio'
  | 'flota'
  | 'operaciones'
  | 'cotizaciones'
  | 'gastos'
  | 'rentabilidad'
  | 'planificacion'
  | 'facturas'
  | 'comprobantes'
  | 'configuracion';

/** Qué módulos puede abrir cada rol. */
const MODULES: Record<Role, Module[]> = {
  Administrador: ['inicio', 'flota', 'operaciones', 'cotizaciones', 'gastos', 'rentabilidad', 'planificacion', 'facturas', 'comprobantes', 'configuracion'],
  Operaciones: ['inicio', 'flota', 'operaciones', 'cotizaciones', 'gastos', 'planificacion', 'comprobantes'],
  Finanzas: ['inicio', 'flota', 'operaciones', 'cotizaciones', 'gastos', 'rentabilidad', 'planificacion', 'facturas', 'comprobantes'],
  Conductor: ['operaciones', 'planificacion', 'comprobantes'],
};

/** Qué colecciones puede crear, modificar o eliminar cada rol. */
const WRITES: Record<Role, CollectionKey[] | 'all'> = {
  Administrador: 'all',
  Operaciones: ['vehicles', 'drivers', 'clients', 'trips', 'quotes', 'expenses', 'proofs'],
  Finanzas: ['clients', 'trips', 'quotes', 'expenses'],
  Conductor: ['trips', 'proofs'],
};

/**
 * Campos que un rol puede cambiar en registros existentes, cuando no puede cambiarlos todos.
 * El conductor solo puede marcar el estado de un viaje (por ejemplo, "Completado" al registrar la entrega).
 */
const FIELD_LIMITS: Partial<Record<Role, Partial<Record<CollectionKey, { fields: string[]; canCreate: boolean; canDelete: boolean }>>>> = {
  Conductor: {
    trips: { fields: ['status'], canCreate: false, canDelete: false },
    proofs: { fields: [], canCreate: true, canDelete: false },
  },
};

export const ROLES: Role[] = ['Administrador', 'Operaciones', 'Finanzas', 'Conductor'];

export const ROLE_INFO: Record<Role, string> = {
  Administrador: 'Acceso total, incluidos usuarios, plan y datos de la empresa.',
  Operaciones: 'Flota, viajes, cotizaciones, gastos y comprobantes. Sin rentabilidad, facturas ni configuración.',
  Finanzas: 'Cotizaciones, gastos, rentabilidad y facturas. Flota y viajes en modo consulta.',
  Conductor: 'Solo ve los viajes y registra comprobantes de entrega.',
};

export const canView = (role: Role | undefined, m: Module) => !!role && MODULES[role].includes(m);

export const canWrite = (role: Role | undefined, key: CollectionKey) => {
  if (!role) return false;
  const w = WRITES[role];
  return w === 'all' || w.includes(key);
};

/** Configuración de la empresa, plan, parámetros y respaldos: solo administradores. */
export const canAdmin = (role: Role | undefined) => role === 'Administrador';

/** Primera página que puede ver un rol (para redirigir al ingresar). */
export const homePath = (role: Role | undefined) => {
  const first = role ? MODULES[role][0] : 'inicio';
  return first === 'inicio' ? '/' : `/${first}`;
};

/**
 * Revisa una escritura campo por campo. Devuelve null si está permitida, o el motivo del rechazo.
 * `before` es el registro actual (undefined si es nuevo) y `after` el que se quiere guardar (undefined si se elimina).
 */
export function writeProblem(role: Role | undefined, key: CollectionKey, before: object | undefined, after: object | undefined): string | null {
  if (!canWrite(role, key)) return 'Tu rol no permite modificar esta información.';
  const lim = role ? FIELD_LIMITS[role]?.[key] : undefined;
  if (!lim) return null;
  if (!after) return lim.canDelete ? null : 'Tu rol no permite eliminar este registro.';
  if (!before) return lim.canCreate ? null : 'Tu rol no permite crear este registro.';
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const changed = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  const blocked = changed.filter((k) => !lim.fields.includes(k));
  return blocked.length ? 'Tu rol no permite cambiar estos datos.' : null;
}
