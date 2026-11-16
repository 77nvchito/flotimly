import { useEffect, useMemo } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Field, Modal, NumInput, Select, TextInput, confirmDelete, useForm } from './ui';
import { useStore } from '../store/store';
import { TRIP_STATUSES, type Trip } from '../store/types';
import { nextCode, today, uid } from '../lib/format';

export function blankTrip(partial?: Partial<Trip>): Trip {
  return {
    id: '',
    code: '',
    clientId: '',
    vehicleId: '',
    driverId: '',
    origin: 'Santiago',
    destination: '',
    distanceKm: 0,
    date: today(),
    cargo: '',
    weightKg: 0,
    price: 0,
    status: 'Planificado',
    invoice: { paid: false },
    ...partial,
  };
}

export function TripModal({ trip, onClose }: { trip: Trip | null; onClose: () => void }) {
  const { db, upsert, remove } = useStore();
  const { f, set, setF } = useForm<Trip>(trip ?? blankTrip());
  useEffect(() => {
    if (trip) setF(trip);
  }, [trip, setF]);

  const isNew = !trip?.id;
  const vehicle = db.vehicles.find((v) => v.id === f.vehicleId);

  const conflicts = useMemo(
    () =>
      db.trips.filter(
        (t) =>
          t.id !== f.id &&
          t.status !== 'Cancelado' &&
          ((f.vehicleId && t.vehicleId === f.vehicleId) || (f.driverId && t.driverId === f.driverId)) &&
          t.date <= (f.endDate || f.date) &&
          (t.endDate || t.date) >= f.date,
      ),
    [db.trips, f.id, f.vehicleId, f.driverId, f.date, f.endDate],
  );

  const valid = f.clientId && f.vehicleId && f.driverId && f.destination && f.date;

  const save = () => {
    if (!valid) return;
    const item: Trip = {
      ...f,
      id: f.id || uid(),
      code: f.code || nextCode('V', db.trips),
      endDate: f.endDate && f.endDate > f.date ? f.endDate : undefined,
      invoice: f.invoice ?? { paid: false },
    };
    upsert('trips', item);
    onClose();
  };

  return (
    <Modal
      open={!!trip}
      onClose={onClose}
      title={isNew ? 'Nuevo viaje' : `Viaje ${f.code}`}
      width={720}
      footer={
        <>
          {!isNew && (
            <button
              className="btn danger left"
              onClick={() => {
                if (confirmDelete(`el viaje ${f.code}`)) {
                  remove('trips', f.id);
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
          <button className="btn primary" disabled={!valid} onClick={save}>
            {isNew ? 'Crear viaje' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      <div className="form-grid c3">
        <Field label="Cliente *" className="span2">
          <Select
            value={f.clientId}
            onChange={set('clientId')}
            placeholder="Selecciona un cliente"
            options={db.clients.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Field>
        <Field label="Estado">
          <Select value={f.status} onChange={set('status')} options={TRIP_STATUSES} />
        </Field>
        <Field label="Origen">
          <TextInput value={f.origin} onChange={set('origin')} placeholder="Ciudad / dirección" />
        </Field>
        <Field label="Destino *">
          <TextInput value={f.destination} onChange={set('destination')} placeholder="Ciudad / dirección" />
        </Field>
        <Field label="Distancia (solo ida)">
          <NumInput value={f.distanceKm} onChange={set('distanceKm')} suffix="km" />
        </Field>
        <Field label="Fecha salida *">
          <input className="input" type="date" value={f.date} onChange={(e) => set('date')(e.target.value)} />
        </Field>
        <Field label="Fecha término" hint="Opcional, para viajes de varios días">
          <input className="input" type="date" value={f.endDate ?? ''} min={f.date} onChange={(e) => set('endDate')(e.target.value || undefined)} />
        </Field>
        <Field label="Tarifa neta *">
          <NumInput value={f.price} onChange={set('price')} prefix="$" />
        </Field>
        <Field label="Vehículo *">
          <Select
            value={f.vehicleId}
            onChange={(id) => {
              const v = db.vehicles.find((x) => x.id === id);
              setF((p) => ({ ...p, vehicleId: id, driverId: v?.driverId ?? p.driverId }));
            }}
            placeholder="Selecciona"
            options={db.vehicles
              .filter((v) => v.status !== 'Inactivo' || v.id === f.vehicleId)
              .map((v) => ({ value: v.id, label: `${v.plate} · ${v.type}${v.status !== 'Activo' ? ` (${v.status})` : ''}` }))}
          />
        </Field>
        <Field label="Conductor *">
          <Select
            value={f.driverId}
            onChange={set('driverId')}
            placeholder="Selecciona"
            options={db.drivers
              .filter((d) => d.status !== 'Inactivo' || d.id === f.driverId)
              .map((d) => ({ value: d.id, label: d.name }))}
          />
        </Field>
        <Field label="Peso carga" hint={vehicle ? `Capacidad: ${vehicle.capacityKg.toLocaleString('es-CL')} kg` : undefined}>
          <NumInput value={f.weightKg} onChange={set('weightKg')} suffix="kg" />
        </Field>
        <Field label="Tipo de carga" className="full">
          <TextInput value={f.cargo} onChange={set('cargo')} placeholder="Ej: 20 pallets de abarrotes" />
        </Field>
        <Field label="Notas" className="full">
          <textarea className="input" value={f.notes ?? ''} onChange={(e) => set('notes')(e.target.value)} />
        </Field>
      </div>
      {(conflicts.length > 0 || (vehicle && f.weightKg > vehicle.capacityKg) || vehicle?.status === 'En mantención') && (
        <div className="card-pad mt" style={{ background: 'var(--amber-soft)', borderRadius: 12, color: 'var(--amber)' }}>
          {vehicle?.status === 'En mantención' && (
            <div className="row small">
              <AlertTriangle size={15} /> El vehículo {vehicle.plate} está en mantención.
            </div>
          )}
          {vehicle && f.weightKg > vehicle.capacityKg && (
            <div className="row small">
              <AlertTriangle size={15} /> El peso supera la capacidad del vehículo.
            </div>
          )}
          {conflicts.map((c) => (
            <div className="row small" key={c.id}>
              <AlertTriangle size={15} /> Cruce con {c.code} ({c.origin} → {c.destination}) — mismo{' '}
              {c.vehicleId === f.vehicleId ? 'vehículo' : 'conductor'}.
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
