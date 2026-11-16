import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bus, Car, History, Plus, Search, Trash2, Truck, UserRound, Pencil } from 'lucide-react';
import {
  Badge,
  Empty,
  Field,
  Modal,
  NumInput,
  PageHeader,
  Segmented,
  Select,
  StatusBadge,
  TextInput,
  confirmDelete,
  useForm,
  type Tone,
} from '../components/ui';
import { useLookups, useStore } from '../store/store';
import { VEHICLE_TYPES, type Driver, type Vehicle } from '../store/types';
import { daysBetween, fmtDate, num, today, uid } from '../lib/format';

type Tab = 'vehiculos' | 'conductores';

export default function Fleet() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'vehiculos';
  const { db } = useStore();
  const [editV, setEditV] = useState<Vehicle | null>(null);
  const [editD, setEditD] = useState<Driver | null>(null);

  return (
    <>
      <PageHeader
        title="Flota"
        subtitle={`${db.vehicles.length} vehículos · ${db.drivers.length} conductores`}
        actions={
          tab === 'vehiculos' ? (
            <button className="btn primary" onClick={() => setEditV(blankVehicle())}>
              <Plus size={16} /> Agregar vehículo
            </button>
          ) : (
            <button className="btn primary" onClick={() => setEditD(blankDriver(db.settings.params.defaultDriverRate))}>
              <Plus size={16} /> Agregar conductor
            </button>
          )
        }
      />
      <Segmented
        value={tab}
        onChange={(v) => setParams({ tab: v })}
        options={[
          { value: 'vehiculos', label: <><Truck size={14} /> Vehículos</> },
          { value: 'conductores', label: <><UserRound size={14} /> Conductores</> },
        ]}
      />
      <div className="mt">{tab === 'vehiculos' ? <Vehicles onEdit={setEditV} /> : <Drivers onEdit={setEditD} />}</div>
      <VehicleModal vehicle={editV} onClose={() => setEditV(null)} />
      <DriverModal driver={editD} onClose={() => setEditD(null)} />
    </>
  );
}

/* ----------------------------- Vehículos ----------------------------- */

const blankVehicle = (): Vehicle => ({
  id: '',
  plate: '',
  brand: '',
  model: '',
  year: new Date().getFullYear(),
  type: 'Camión',
  capacityKg: 5000,
  fuelEfficiency: 5,
  odometer: 0,
  status: 'Activo',
});

export function docTone(date?: string): { tone: Tone; text: string } {
  if (!date) return { tone: 'gray', text: 'Sin fecha' };
  const d = daysBetween(today(), date);
  if (d < 0) return { tone: 'red', text: 'Vencido' };
  if (d <= 30) return { tone: 'amber', text: `${d} d` };
  return { tone: 'green', text: 'Al día' };
}

function VehicleIcon({ type }: { type: Vehicle['type'] }) {
  if (type === 'Camioneta') return <Car size={22} />;
  if (type === 'Furgón') return <Bus size={22} />;
  return <Truck size={22} />;
}

function Vehicles({ onEdit }: { onEdit: (v: Vehicle) => void }) {
  const { db } = useStore();
  const L = useLookups();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');

  const stats = useMemo(() => {
    const m = new Map<string, { trips: number; km: number }>();
    for (const t of db.trips) {
      if (t.status !== 'Completado') continue;
      const s = m.get(t.vehicleId) ?? { trips: 0, km: 0 };
      s.trips++;
      s.km += t.distanceKm * 2;
      m.set(t.vehicleId, s);
    }
    return m;
  }, [db.trips]);

  const list = db.vehicles.filter(
    (v) =>
      (!type || v.type === type) &&
      `${v.plate} ${v.brand} ${v.model}`.toLowerCase().includes(q.toLowerCase()),
  );

  if (db.vehicles.length === 0)
    return (
      <div className="card">
        <Empty icon={<Truck size={26} />} title="Agrega tu primer vehículo" text="Registra camiones, tractos, camionetas o furgones para empezar a operar." />
      </div>
    );

  return (
    <>
      <div className="row wrap" style={{ marginBottom: 16 }}>
        <div className="search">
          <Search size={15} />
          <input className="input" placeholder="Buscar patente, marca o modelo" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div style={{ width: 200 }}>
          <Select value={type} onChange={setType} placeholder="Todos los tipos" options={VEHICLE_TYPES} />
        </div>
      </div>
      <div className="grid k3">
        {list.map((v) => {
          const s = stats.get(v.id);
          const driver = v.driverId ? L.driver.get(v.driverId) : undefined;
          const docs = [
            ['Rev. técnica', v.techReviewDue],
            ['Seguro', v.insuranceDue],
            ['Permiso', v.permitDue],
          ] as const;
          return (
            <div className="card vcard" key={v.id} onClick={() => onEdit(v)}>
              <div className="top">
                <div className="truck">
                  <VehicleIcon type={v.type} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="plate">{v.plate}</span>
                    <StatusBadge status={v.status} />
                  </div>
                  <div className="strong" style={{ marginTop: 8 }}>
                    {v.brand} {v.model} <span className="faint" style={{ fontWeight: 400 }}>· {v.year}</span>
                  </div>
                  <div className="small muted">
                    {v.type} · {driver ? driver.name : 'Sin conductor asignado'}
                  </div>
                </div>
              </div>
              <div className="meta">
                <div>
                  <b>{num(v.capacityKg / 1000, 1)} t</b>
                  <span>Capacidad</span>
                </div>
                <div>
                  <b>{num(v.odometer)}</b>
                  <span>Kilometraje</span>
                </div>
                <div>
                  <b>{s?.trips ?? 0}</b>
                  <span>Viajes</span>
                </div>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="docs">
                  {docs.map(([label, d]) => {
                    const t = docTone(d);
                    return (
                      <span key={label} title={`${label}: ${fmtDate(d)}`}>
                        <Badge tone={t.tone}>{label}</Badge>
                      </span>
                    );
                  })}
                </div>
                <button
                  className="icon-btn"
                  title="Ver historial"
                  onClick={(e) => {
                    e.stopPropagation();
                    nav(`/operaciones?tab=historial&vehiculo=${v.id}`);
                  }}
                >
                  <History size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function VehicleModal({ vehicle, onClose }: { vehicle: Vehicle | null; onClose: () => void }) {
  const { db, upsert, remove } = useStore();
  const { f, set, setF } = useForm<Vehicle>(blankVehicle());
  useEffect(() => {
    if (vehicle) setF(vehicle);
  }, [vehicle, setF]);
  const isNew = !vehicle?.id;
  const valid = f.plate.trim() && f.brand.trim();
  const usedTrips = vehicle?.id ? db.trips.filter((t) => t.vehicleId === vehicle.id).length : 0;

  return (
    <Modal
      open={!!vehicle}
      onClose={onClose}
      title={isNew ? 'Nuevo vehículo' : `${f.plate} · ${f.brand} ${f.model}`}
      width={700}
      footer={
        <>
          {!isNew && (
            <button
              className="btn danger left"
              onClick={() => {
                if (usedTrips && !window.confirm(`Este vehículo tiene ${usedTrips} viajes asociados. ¿Prefieres marcarlo como Inactivo? Presiona Cancelar para volver.`)) return;
                if (confirmDelete(`el vehículo ${f.plate}`)) {
                  remove('vehicles', f.id);
                  onClose();
                }
              }}
            >
              <Trash2 size={15} /> Eliminar
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn primary"
            disabled={!valid}
            onClick={() => {
              upsert('vehicles', { ...f, id: f.id || uid(), plate: f.plate.toUpperCase().trim() });
              onClose();
            }}
          >
            Guardar
          </button>
        </>
      }
    >
      <div className="form-grid c3">
        <Field label="Patente *">
          <TextInput value={f.plate} onChange={set('plate')} placeholder="ABCD-12" />
        </Field>
        <Field label="Tipo">
          <Select value={f.type} onChange={set('type')} options={VEHICLE_TYPES} />
        </Field>
        <Field label="Estado">
          <Select value={f.status} onChange={set('status')} options={['Activo', 'En mantención', 'Inactivo']} />
        </Field>
        <Field label="Marca *">
          <TextInput value={f.brand} onChange={set('brand')} />
        </Field>
        <Field label="Modelo">
          <TextInput value={f.model} onChange={set('model')} />
        </Field>
        <Field label="Año">
          <NumInput value={f.year} onChange={set('year')} />
        </Field>
        <Field label="Capacidad de carga">
          <NumInput value={f.capacityKg} onChange={set('capacityKg')} suffix="kg" />
        </Field>
        <Field label="Rendimiento" hint="Promedio con carga">
          <NumInput value={f.fuelEfficiency} onChange={set('fuelEfficiency')} suffix="km/L" />
        </Field>
        <Field label="Kilometraje actual">
          <NumInput value={f.odometer} onChange={set('odometer')} suffix="km" />
        </Field>
        <Field label="Conductor asignado" className="full">
          <Select
            value={f.driverId ?? ''}
            onChange={(v) => set('driverId')(v || undefined)}
            placeholder="Sin asignar"
            options={db.drivers.map((d) => ({ value: d.id, label: d.name }))}
          />
        </Field>
        <Field label="Revisión técnica vence">
          <input className="input" type="date" value={f.techReviewDue ?? ''} onChange={(e) => set('techReviewDue')(e.target.value || undefined)} />
        </Field>
        <Field label="Seguro vence">
          <input className="input" type="date" value={f.insuranceDue ?? ''} onChange={(e) => set('insuranceDue')(e.target.value || undefined)} />
        </Field>
        <Field label="Permiso de circulación vence">
          <input className="input" type="date" value={f.permitDue ?? ''} onChange={(e) => set('permitDue')(e.target.value || undefined)} />
        </Field>
        <Field label="Notas" className="full">
          <textarea className="input" value={f.notes ?? ''} onChange={(e) => set('notes')(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/* ----------------------------- Conductores ----------------------------- */

const blankDriver = (rate: number): Driver => ({
  id: '',
  name: '',
  rut: '',
  phone: '',
  licenseClass: 'A4',
  status: 'Activo',
  dailyRate: rate,
});

function Drivers({ onEdit }: { onEdit: (d: Driver) => void }) {
  const { db } = useStore();
  const vehicleOf = useMemo(() => new Map(db.vehicles.filter((v) => v.driverId).map((v) => [v.driverId!, v])), [db.vehicles]);
  const tripsOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of db.trips) if (t.status === 'Completado') m.set(t.driverId, (m.get(t.driverId) || 0) + 1);
    return m;
  }, [db.trips]);

  if (db.drivers.length === 0)
    return (
      <div className="card">
        <Empty icon={<UserRound size={26} />} title="Sin conductores" text="Agrega a los conductores de tu flota y asígnalos a un vehículo." />
      </div>
    );

  return (
    <div className="card table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Conductor</th>
            <th>RUT</th>
            <th>Teléfono</th>
            <th>Licencia</th>
            <th>Vehículo</th>
            <th className="right">Viajes</th>
            <th>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {db.drivers.map((d) => {
            const lic = docTone(d.licenseDue);
            const v = vehicleOf.get(d.id);
            return (
              <tr key={d.id} className="click" onClick={() => onEdit(d)}>
                <td>
                  <div className="row">
                    <div className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>
                      {d.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <div className="cell-title">{d.name}</div>
                      <div className="cell-sub">{d.email}</div>
                    </div>
                  </div>
                </td>
                <td className="tnum">{d.rut}</td>
                <td className="nowrap">{d.phone}</td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <b>{d.licenseClass}</b>
                    <span title={`Vence ${fmtDate(d.licenseDue)}`}>
                      <Badge tone={lic.tone}>{lic.tone === 'green' ? fmtDate(d.licenseDue) : lic.text}</Badge>
                    </span>
                  </div>
                </td>
                <td>{v ? <span className="plate" style={{ height: 22, fontSize: 12 }}>{v.plate}</span> : <span className="faint">—</span>}</td>
                <td className="right tnum">{tripsOf.get(d.id) ?? 0}</td>
                <td>
                  <StatusBadge status={d.status} />
                </td>
                <td>
                  <div className="table-actions">
                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onEdit(d); }}>
                      <Pencil size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DriverModal({ driver, onClose }: { driver: Driver | null; onClose: () => void }) {
  const { upsert, remove } = useStore();
  const { f, set, setF } = useForm<Driver>(blankDriver(0));
  useEffect(() => {
    if (driver) setF(driver);
  }, [driver, setF]);
  const isNew = !driver?.id;
  return (
    <Modal
      open={!!driver}
      onClose={onClose}
      title={isNew ? 'Nuevo conductor' : f.name}
      footer={
        <>
          {!isNew && (
            <button
              className="btn danger left"
              onClick={() => {
                if (confirmDelete(`a ${f.name}`)) {
                  remove('drivers', f.id);
                  onClose();
                }
              }}
            >
              <Trash2 size={15} /> Eliminar
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn primary"
            disabled={!f.name.trim()}
            onClick={() => {
              upsert('drivers', { ...f, id: f.id || uid() });
              onClose();
            }}
          >
            Guardar
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Nombre completo *" className="full">
          <TextInput value={f.name} onChange={set('name')} />
        </Field>
        <Field label="RUT">
          <TextInput value={f.rut} onChange={set('rut')} placeholder="12.345.678-9" />
        </Field>
        <Field label="Teléfono">
          <TextInput value={f.phone} onChange={set('phone')} placeholder="+56 9 ..." />
        </Field>
        <Field label="Correo" className="full">
          <TextInput value={f.email} onChange={set('email')} type="email" />
        </Field>
        <Field label="Clase de licencia">
          <Select value={f.licenseClass} onChange={set('licenseClass')} options={['A1', 'A2', 'A3', 'A4', 'A5', 'B', 'C', 'D']} />
        </Field>
        <Field label="Licencia vence">
          <input className="input" type="date" value={f.licenseDue ?? ''} onChange={(e) => set('licenseDue')(e.target.value || undefined)} />
        </Field>
        <Field label="Estado">
          <Select value={f.status} onChange={set('status')} options={['Activo', 'Licencia médica', 'Vacaciones', 'Inactivo']} />
        </Field>
        <Field label="Costo diario (viático/jornada)" hint="Se usa en cotizaciones">
          <NumInput value={f.dailyRate} onChange={set('dailyRate')} prefix="$" />
        </Field>
      </div>
    </Modal>
  );
}
