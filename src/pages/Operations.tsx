import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, Fuel, History, MapPin, Pencil, Plus, Route, Search, Wrench } from 'lucide-react';
import { Card, Empty, PageHeader, Segmented, Select, Stat, StatusBadge } from '../components/ui';
import { TripModal, blankTrip } from '../components/TripModal';
import { ClientModal, blankClient } from '../components/ClientModal';
import { useLookups, useStore } from '../store/store';
import { TRIP_STATUSES, type Client, type Trip } from '../store/types';
import { clp, fmtDate, num, pct } from '../lib/format';
import { tripExpenseMap } from '../lib/calc';

type Tab = 'viajes' | 'historial' | 'clientes';

export default function Operations() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'viajes';
  const { db } = useStore();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    if (params.get('nuevo')) {
      setTrip(blankTrip());
      params.delete('nuevo');
      setParams(params, { replace: true });
    }
    const id = params.get('viaje');
    if (id) {
      const t = db.trips.find((x) => x.id === id);
      if (t) setTrip(t);
      params.delete('viaje');
      setParams(params, { replace: true });
    }
  }, [params, setParams, db.trips]);

  return (
    <>
      <PageHeader
        title="Operaciones"
        subtitle="Centro de operaciones: viajes, historial de cada vehículo y clientes"
        actions={
          tab === 'clientes' ? (
            <button className="btn primary" onClick={() => setClient(blankClient())}>
              <Plus size={16} /> Nuevo cliente
            </button>
          ) : (
            <button className="btn primary" onClick={() => setTrip(blankTrip())}>
              <Plus size={16} /> Nuevo viaje
            </button>
          )
        }
      />
      <Segmented
        value={tab}
        onChange={(v) => setParams({ tab: v })}
        options={[
          { value: 'viajes', label: <><Route size={14} /> Viajes</> },
          { value: 'historial', label: <><History size={14} /> Historial por camión</> },
          { value: 'clientes', label: <><Building2 size={14} /> Clientes</> },
        ]}
      />
      <div className="mt">
        {tab === 'viajes' && <Trips onOpen={setTrip} />}
        {tab === 'historial' && <VehicleHistory onOpen={setTrip} />}
        {tab === 'clientes' && <Clients onEdit={setClient} />}
      </div>
      <TripModal trip={trip} onClose={() => setTrip(null)} />
      <ClientModal client={client} onClose={() => setClient(null)} />
    </>
  );
}

/* ----------------------------- Viajes ----------------------------- */

function Trips({ onOpen }: { onOpen: (t: Trip) => void }) {
  const { db, upsert } = useStore();
  const L = useLookups();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [limit, setLimit] = useState(50);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of db.trips) c[t.status] = (c[t.status] || 0) + 1;
    return c;
  }, [db.trips]);

  const list = useMemo(() => {
    const s = q.toLowerCase();
    return db.trips
      .filter((t) => (!status || t.status === status) && (!vehicle || t.vehicleId === vehicle))
      .filter((t) => {
        if (!s) return true;
        const c = L.client.get(t.clientId)?.name ?? '';
        return `${t.code} ${t.origin} ${t.destination} ${c} ${t.cargo}`.toLowerCase().includes(s);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [db.trips, q, status, vehicle, L]);

  return (
    <>
      <div className="grid k4" style={{ marginBottom: 16 }}>
        <Stat label="En curso" value={counts['En curso'] ?? 0} icon={<Route size={15} />} tone="orange" />
        <Stat label="Planificados" value={counts['Planificado'] ?? 0} icon={<MapPin size={15} />} />
        <Stat label="Completados" value={counts['Completado'] ?? 0} icon={<Route size={15} />} tone="green" />
        <Stat label="Cancelados" value={counts['Cancelado'] ?? 0} icon={<Route size={15} />} tone="red" />
      </div>
      <div className="card">
        <div className="toolbar">
          <div className="search">
            <Search size={15} />
            <input className="input" placeholder="Buscar código, ruta, cliente…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div style={{ width: 170 }}>
            <Select value={status} onChange={setStatus} placeholder="Todos los estados" options={TRIP_STATUSES} />
          </div>
          <div style={{ width: 200 }}>
            <Select value={vehicle} onChange={setVehicle} placeholder="Todos los vehículos" options={db.vehicles.map((v) => ({ value: v.id, label: `${v.plate} · ${v.brand}` }))} />
          </div>
          <span className="spacer" />
          <span className="small faint">{list.length} viajes</span>
        </div>
        {list.length === 0 ? (
          <Empty icon={<Route size={26} />} title="Sin viajes" text="Crea un viaje o ajusta los filtros." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Viaje</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Ruta</th>
                  <th>Vehículo / conductor</th>
                  <th className="right">Tarifa neta</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {list.slice(0, limit).map((t) => (
                  <tr key={t.id} className="click" onClick={() => onOpen(t)}>
                    <td className="cell-title">{t.code}</td>
                    <td className="nowrap">{fmtDate(t.date)}</td>
                    <td>{L.client.get(t.clientId)?.name ?? '—'}</td>
                    <td>
                      <div className="cell-title" style={{ fontWeight: 500 }}>
                        {t.origin} → {t.destination}
                      </div>
                      <div className="cell-sub">
                        {num(t.distanceKm)} km · {t.cargo}
                      </div>
                    </td>
                    <td>
                      <div>{L.vehicle.get(t.vehicleId)?.plate ?? '—'}</div>
                      <div className="cell-sub">{L.driver.get(t.driverId)?.name}</div>
                    </td>
                    <td className="right tnum strong">{clp(t.price)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        className="input"
                        style={{ height: 28, width: 132, fontSize: 12.5 }}
                        value={t.status}
                        onChange={(e) => upsert('trips', { ...t, status: e.target.value as Trip['status'] })}
                      >
                        {TRIP_STATUSES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length > limit && (
              <div style={{ padding: 14, textAlign: 'center' }}>
                <button className="btn sm" onClick={() => setLimit((l) => l + 50)}>
                  Mostrar más ({list.length - limit} restantes)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ----------------------------- Historial por camión ----------------------------- */

function VehicleHistory({ onOpen }: { onOpen: (t: Trip) => void }) {
  const { db } = useStore();
  const L = useLookups();
  const [params, setParams] = useSearchParams();
  const vehicleId = params.get('vehiculo') || db.vehicles[0]?.id || '';
  const v = L.vehicle.get(vehicleId);
  const expMap = useMemo(() => tripExpenseMap(db), [db]);

  const data = useMemo(() => {
    const trips = db.trips.filter((t) => t.vehicleId === vehicleId).sort((a, b) => b.date.localeCompare(a.date));
    const expenses = db.expenses.filter((e) => e.vehicleId === vehicleId && !e.tripId);
    const done = trips.filter((t) => t.status === 'Completado');
    const income = done.reduce((s, t) => s + t.price, 0);
    const expense = db.expenses.filter((e) => e.vehicleId === vehicleId).reduce((s, e) => s + e.amount, 0);
    const km = done.reduce((s, t) => s + t.distanceKm * 2, 0);
    const fuel = db.expenses.filter((e) => e.vehicleId === vehicleId && e.category === 'Combustible');
    const liters = fuel.reduce((s, e) => s + (e.liters || 0), 0);
    type Ev = { kind: 'trip'; date: string; trip: Trip } | { kind: 'exp'; date: string; id: string; title: string; sub: string; amount: number; cat: string };
    const events: Ev[] = [
      ...trips.map((t) => ({ kind: 'trip' as const, date: t.date, trip: t })),
      ...expenses.map((e) => ({ kind: 'exp' as const, date: e.date, id: e.id, title: e.category, sub: e.description || e.provider || '', amount: e.amount, cat: e.category })),
    ].sort((a, b) => b.date.localeCompare(a.date));
    return { trips, done, income, expense, km, liters, events };
  }, [db, vehicleId]);

  const [limit, setLimit] = useState(40);

  if (!v) return <Card><Empty icon={<History size={26} />} title="Sin vehículos" text="Agrega vehículos en Flota." /></Card>;

  return (
    <div className="grid side-main">
      <div className="stack">
        <Card title="Vehículo">
          <Select value={vehicleId} onChange={(id) => setParams({ tab: 'historial', vehiculo: id })} options={db.vehicles.map((x) => ({ value: x.id, label: `${x.plate} · ${x.brand} ${x.model}` }))} />
          <div className="mt row" style={{ alignItems: 'flex-start' }}>
            <span className="plate">{v.plate}</span>
            <div>
              <div className="strong">
                {v.brand} {v.model} ({v.year})
              </div>
              <div className="small muted">
                {v.type} · {L.driver.get(v.driverId ?? '')?.name ?? 'Sin conductor'}
              </div>
            </div>
          </div>
        </Card>
        <div className="grid k2">
          <Stat label="Viajes completados" value={data.done.length} />
          <Stat label="Km recorridos" value={num(data.km)} />
          <Stat label="Ventas" value={clp(data.income)} />
          <Stat label="Gastos" value={clp(data.expense)} />
          <Stat label="Utilidad" value={<span className={data.income - data.expense < 0 ? 'neg' : 'pos'}>{clp(data.income - data.expense)}</span>} sub={`Margen ${pct(data.income ? (data.income - data.expense) / data.income : 0)}`} />
          <Stat label="Rendimiento real" value={data.liters ? `${num(data.km / data.liters, 1)} km/L` : '—'} sub={`Ficha: ${num(v.fuelEfficiency, 1)} km/L`} />
        </div>
      </div>
      <Card title="Historial" extra={<span className="small faint">{data.events.length} registros</span>}>
        <div className="timeline">
          {data.events.slice(0, limit).map((e) =>
            e.kind === 'trip' ? (
              <div className="tl-item" key={e.trip.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(e.trip)}>
                <div className="grow">
                  <div className="row" style={{ gap: 8 }}>
                    <b>
                      {e.trip.origin} → {e.trip.destination}
                    </b>
                    <StatusBadge status={e.trip.status} />
                  </div>
                  <div className="small faint">
                    {fmtDate(e.date)} · {e.trip.code} · {L.client.get(e.trip.clientId)?.name} · {L.driver.get(e.trip.driverId)?.name}
                  </div>
                </div>
                <div className="right">
                  <div className="strong tnum">{clp(e.trip.price)}</div>
                  {expMap.get(e.trip.id) ? <div className="small faint tnum">Costos directos {clp(expMap.get(e.trip.id)!)}</div> : null}
                </div>
              </div>
            ) : (
              <div className="tl-item exp" key={e.id}>
                <div className="grow">
                  <div className="row" style={{ gap: 8 }}>
                    {e.cat === 'Combustible' ? <Fuel size={14} /> : <Wrench size={14} />}
                    <b>{e.title}</b>
                  </div>
                  <div className="small faint">
                    {fmtDate(e.date)} · {e.sub}
                  </div>
                </div>
                <div className="strong tnum neg">−{clp(e.amount)}</div>
              </div>
            ),
          )}
        </div>
        {data.events.length > limit && (
          <div style={{ textAlign: 'center' }}>
            <button className="btn sm" onClick={() => setLimit((l) => l + 40)}>
              Ver más
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ----------------------------- Clientes ----------------------------- */

function Clients({ onEdit }: { onEdit: (c: Client) => void }) {
  const { db } = useStore();
  const stats = useMemo(() => {
    const m = new Map<string, { trips: number; income: number; last?: string }>();
    for (const t of db.trips) {
      if (t.status !== 'Completado') continue;
      const s = m.get(t.clientId) ?? { trips: 0, income: 0 };
      s.trips++;
      s.income += t.price;
      if (!s.last || t.date > s.last) s.last = t.date;
      m.set(t.clientId, s);
    }
    return m;
  }, [db.trips]);

  if (!db.clients.length) return <Card><Empty icon={<Building2 size={26} />} title="Sin clientes" text="Registra a tus clientes para asociarlos a viajes y cotizaciones." /></Card>;

  return (
    <div className="card table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Contacto</th>
            <th>Plazo pago</th>
            <th className="right">Viajes</th>
            <th className="right">Ventas históricas</th>
            <th>Último viaje</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {db.clients.map((c) => {
            const s = stats.get(c.id);
            return (
              <tr key={c.id} className="click" onClick={() => onEdit(c)}>
                <td>
                  <div className="cell-title">{c.name}</div>
                  <div className="cell-sub">{c.rut}</div>
                </td>
                <td>
                  <div>{c.contact}</div>
                  <div className="cell-sub">
                    {c.email} · {c.phone}
                  </div>
                </td>
                <td>{c.paymentTermsDays} días</td>
                <td className="right tnum">{s?.trips ?? 0}</td>
                <td className="right tnum strong">{clp(s?.income ?? 0)}</td>
                <td>{fmtDate(s?.last)}</td>
                <td>
                  <div className="table-actions">
                    <button className="icon-btn">
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
