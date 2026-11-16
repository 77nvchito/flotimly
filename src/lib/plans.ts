import type { Plan } from '../store/types';

/**
 * Definición única de los planes: la usan la portada, Configuración → Plan, la barra lateral y los límites.
 * "Flota Plus" es el plan premium: lo que agrega por sobre Pyme es capacidad y servicio (no funciones nuevas).
 */
export type PlanInfo = {
  key: Plan;
  name: string;
  tagline: string;
  maxVehicles: number;
  /** Infinity = usuarios ilimitados */
  maxUsers: number;
  /** Lo que agrega respecto del plan anterior (en Pyme y Flota Plus se muestra después de "Todo lo del plan …") */
  items: string[];
  includesPrevious?: string;
};

export const PLAN_LIST: PlanInfo[] = [
  {
    key: 'emprendedor',
    name: 'Emprendedor',
    tagline: 'Para transportistas independientes y flotas pequeñas.',
    maxVehicles: 3,
    maxUsers: 2,
    items: [
      'Inicio con panel y resumen ejecutivo',
      'Flota: vehículos y conductores',
      'Operaciones e historial por camión',
      'Cotizaciones con cálculo de costos y PDF con tu logo',
      'Gastos: combustible, peajes y mantenciones',
      'Rentabilidad por camión, viaje y cliente',
      'Parámetros, usuarios y tarifas',
    ],
  },
  {
    key: 'pyme',
    name: 'Pyme',
    tagline: 'Para empresas de transporte que planifican, facturan y cobran.',
    maxVehicles: 15,
    maxUsers: 10,
    includesPrevious: 'Emprendedor',
    items: ['Planificación con calendario de fletes', 'Facturas pendientes y cobranza', 'Comprobantes de entrega con firma y fotos'],
  },
  {
    key: 'flota_plus',
    name: 'Flota Plus',
    tagline: 'Para flotas grandes que quieren acompañamiento y prioridad.',
    maxVehicles: 30,
    maxUsers: Infinity,
    includesPrevious: 'Pyme',
    items: [
      'Carga inicial de tus datos hecha por nuestro equipo',
      'Capacitación para tu equipo por videollamada',
      'Soporte prioritario por WhatsApp',
      'Acceso anticipado a nuevas funciones',
    ],
  },
];

export const PLANS = Object.fromEntries(PLAN_LIST.map((p) => [p.key, p])) as Record<Plan, PlanInfo>;

export const planInfo = (plan: Plan | undefined): PlanInfo => PLANS[plan ?? 'pyme'] ?? PLANS.pyme;

export const vehiclesLabel = (p: PlanInfo) => `Hasta ${p.maxVehicles} vehículos`;
export const usersLabel = (p: PlanInfo) => (Number.isFinite(p.maxUsers) ? `Hasta ${p.maxUsers} usuarios` : 'Usuarios ilimitados');
