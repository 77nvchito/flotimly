import type { Plan } from '../store/types';

/**
 * Definición única de los planes: la usan la portada, Configuración → Plan, la barra lateral y los límites.
 * "Flota Plus" es el plan premium: lo que agrega por sobre Pyme es capacidad y servicio (no funciones nuevas).
 */
export type PlanInfo = {
  key: Plan;
  name: string;
  tagline: string;
  /** Precio mensual neto en CLP (se cobra + IVA) */
  price: number;
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
    price: 29990,
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
    price: 69990,
    maxVehicles: 15,
    maxUsers: 10,
    includesPrevious: 'Emprendedor',
    items: ['Planificación con calendario de fletes', 'Facturas pendientes y cobranza', 'Comprobantes de entrega con firma y fotos'],
  },
  {
    key: 'flota_plus',
    name: 'Flota Plus',
    tagline: 'Para flotas grandes que quieren acompañamiento y prioridad.',
    price: 149990,
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

/** Oferta de lanzamiento: prueba gratis y luego descuento por los primeros meses pagados. */
export const PROMO = {
  trialDays: 14,
  discount: 0.5,
  months: 3,
  /** Texto de escasez. Si defines un número real de cupos, ponlo aquí (por ejemplo: 'Solo 20 cupos'). */
  spots: 'Solo 15 cupos',
};

/** Precio con el descuento de lanzamiento (redondeado a peso). */
export const promoPrice = (p: PlanInfo) => Math.round(p.price * (1 - PROMO.discount));
/** Costo mensual por vehículo usando la capacidad completa del plan. */
export const perVehicle = (p: PlanInfo) => Math.round(p.price / p.maxVehicles);
/** El plan con el menor costo por vehículo (hoy: Pyme). */
export const bestValueKey = () => PLAN_LIST.reduce((a, b) => (perVehicle(b) < perVehicle(a) ? b : a)).key;
