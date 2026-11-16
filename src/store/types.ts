// Modelo de datos de Flotimly.
// Toda la persistencia pasa por store.tsx; al migrar a un backend sólo cambia esa capa.

export type Plan = 'emprendedor' | 'pyme';

export type VehicleType = 'Tracto camión' | 'Camión' | 'Camioneta' | 'Furgón';
export const VEHICLE_TYPES: VehicleType[] = ['Tracto camión', 'Camión', 'Camioneta', 'Furgón'];

export type VehicleStatus = 'Activo' | 'En mantención' | 'Inactivo';

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  type: VehicleType;
  capacityKg: number;
  fuelEfficiency: number; // km por litro
  odometer: number;
  status: VehicleStatus;
  driverId?: string;
  techReviewDue?: string; // revisión técnica
  insuranceDue?: string; // seguro
  permitDue?: string; // permiso de circulación
  notes?: string;
}

export type DriverStatus = 'Activo' | 'Licencia médica' | 'Vacaciones' | 'Inactivo';

export interface Driver {
  id: string;
  name: string;
  rut: string;
  phone: string;
  email?: string;
  licenseClass: string;
  licenseDue?: string;
  status: DriverStatus;
  dailyRate: number; // costo diario (viático / jornada) usado en cotizaciones
}

export interface Client {
  id: string;
  name: string;
  rut: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  paymentTermsDays: number;
}

export type TripStatus = 'Planificado' | 'En curso' | 'Completado' | 'Cancelado';
export const TRIP_STATUSES: TripStatus[] = ['Planificado', 'En curso', 'Completado', 'Cancelado'];

export interface Invoice {
  number?: string;
  issueDate?: string;
  dueDate?: string;
  paid: boolean;
  paidDate?: string;
}

export interface Trip {
  id: string;
  code: string;
  clientId: string;
  vehicleId: string;
  driverId: string;
  origin: string;
  destination: string;
  distanceKm: number;
  date: string;
  endDate?: string;
  cargo: string;
  weightKg: number;
  price: number; // neto
  status: TripStatus;
  invoice?: Invoice;
  quoteId?: string;
  notes?: string;
}

export type ExpenseCategory =
  | 'Combustible'
  | 'Peajes'
  | 'Mantención'
  | 'Neumáticos'
  | 'Viáticos'
  | 'Remuneraciones'
  | 'Seguros'
  | 'Permisos'
  | 'Otros';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Combustible',
  'Peajes',
  'Mantención',
  'Neumáticos',
  'Viáticos',
  'Remuneraciones',
  'Seguros',
  'Permisos',
  'Otros',
];

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  vehicleId?: string;
  tripId?: string;
  liters?: number;
  provider?: string;
  description?: string;
  docNumber?: string;
}

export type QuoteStatus = 'Borrador' | 'Enviada' | 'Aceptada' | 'Rechazada';
export type PricingMode = 'margen' | 'tarifa' | 'manual';

export interface Quote {
  id: string;
  code: string;
  clientId: string;
  date: string;
  validUntil: string;
  origin: string;
  destination: string;
  distanceKm: number;
  roundTrip: boolean;
  vehicleId?: string;
  cargo: string;
  weightKg: number;
  fuelPrice: number;
  fuelEfficiency: number;
  tolls: number;
  driverDays: number;
  driverRate: number;
  maintenancePerKm: number;
  otherCosts: number;
  marginPct: number;
  pricingMode: PricingMode;
  tariffId?: string;
  manualPrice?: number;
  status: QuoteStatus;
  notes?: string;
  conditions?: string; // condiciones comerciales de esta cotización (editables)
  tripId?: string;
}

export type ProofCondition = 'Conforme' | 'Con observaciones' | 'Rechazado';

export interface DeliveryProof {
  id: string;
  code: string;
  tripId: string;
  date: string;
  time: string;
  receiverName: string;
  receiverRut: string;
  condition: ProofCondition;
  observations?: string;
  signature?: string; // dataURL
  photos: string[]; // dataURL (comprimidas)
}

export type TariffUnit = 'km' | 'viaje' | 'kg' | 'día';

export interface Tariff {
  id: string;
  name: string;
  unit: TariffUnit;
  value: number;
  vehicleType?: VehicleType;
  description?: string;
}

export type Role = 'Administrador' | 'Operaciones' | 'Finanzas' | 'Conductor';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  password: string; // sólo para la demo local; en producción se usa autenticación del servidor
}

export interface Company {
  name: string;
  rut: string;
  giro: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  logo?: string; // dataURL PNG del logo de la empresa (aparece en cotizaciones y comprobantes)
  brandColor?: string; // color principal de los documentos
}

export interface BankAccount {
  bank: string;
  accountType: string;
  accountNumber: string;
  holder: string;
  rut: string;
  email: string;
}

export interface Params {
  fuelPrice: number; // CLP por litro de diésel
  ivaPct: number;
  defaultMarginPct: number;
  maintenancePerKm: number;
  quoteValidityDays: number;
  defaultDriverRate: number;
  alertDays: number;
}

export interface Settings {
  plan: Plan;
  company: Company;
  params: Params;
  bank: BankAccount;
  quoteConditions: string; // condiciones por defecto para nuevas cotizaciones (una por línea)
}

export interface DB {
  version: number;
  settings: Settings;
  vehicles: Vehicle[];
  drivers: Driver[];
  clients: Client[];
  trips: Trip[];
  expenses: Expense[];
  quotes: Quote[];
  proofs: DeliveryProof[];
  tariffs: Tariff[];
  users: User[];
}

export type CollectionKey = Exclude<keyof DB, 'settings' | 'version'>;
export type Item<K extends CollectionKey> = DB[K][number];
