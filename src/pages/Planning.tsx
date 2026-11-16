import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Truck } from 'lucide-react';
import { Card, PageHeader, Segmented, StatusBadge } from '../components/ui';
import { TripModal, blankTrip } from '../components/TripModal';
import { useLookups, useStore } from '../store/store';
import type { Trip } from '../store/types';
import { addDays, addMonths, clp, daysBetween, fmtDateLong, monthLabel, parseISO, startOfMonth, today } from '../lib/format';

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function Planning() {
  const { db, upsert } = useStore();
  const L = useLookups();
  const [month, setMonth] = useState(startOfMonth(today()));
  const [sel, setSel] = useState(today());
  const [trip, setTrip] = useState<Trip | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [filter, setFilter] = useState<'activos' | 'todos'>('activos');

  const days = useMemo(() => {
    const first = parseISO(month);
    const offset = (first.getDay() + 6) % 7; // lunes = 0
    const start = addDays(month, -offset);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);

  const byDay = useMemo(() => {
    const m = new Map<string, Trip[]>();
    const from = days[0];
    const to = days[days.length - 1];
    for (const t of db.trips) {
      if (filter === 'activos' && t.status === 'Cancelado') continue;
      const end = t.endDate || t.date;
      if (end < from || t.date > to) continue;
      for (let d = t.date; d <= end; d = addDays(d, 1)) {
        if (!m.has(d)) m.set(d, []);
        m.get(d)!.push(t);
      }
    }
    return m;
  }, [db.trips, days, filter]);

  const selTrips = byDay.get(sel) ?? [];
  const busy = new Set(selTrips.filter((t) => t.status !== 'Cancelado').map((t) => t.vehicleId));
  const available = db.vehicles.filter((v) => v.status === 'Activo' && !busy.has(v.id));
  const monthTrips = db.trips.filter((t) => t.date.startsWith(month.slice(0, 7)) && t.status !== 'Cancelado');
  const monthPlanned = monthTrips.filter((t) => t.status === 'Planificado' || t.status === 'En curso');

  const drop = (day: string) => {
    const t = db.trips.find((x) => x.id === dragId);
    setDragId(null);
    setOver(null);
    if (!t || t.date === day) return;
    const len = t.endDate ? daysBetween(t.date, t.endDate) : 0;
    upsert('trips', { ...t, date: day, endDate: len ? addDays(day, len) : undefined });
  };

  return (
    <>
      <PageHeader
        title="Planificación"
        subtitle="Calendario de fletes y viajes programados. Arrastra un viaje para reprogramarlo."
        actions={
          <button className="btn primary" onClick={() => setTrip(blankTrip({ date: sel }))}>
            <Plus size={16} /> Programar viaje
          </button>
        }
      />
      <div className="grid main-side" style={{ gridTemplateColumns: 'minmax(0, 3fr) minmax(280px, 1fr)' }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="toolbar">
            <h3 style={{ fontSize: 19, minWidth: 170 }}>{monthLabel(month.slice(0, 7), true)}</h3>
            <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mes anterior">
              <ChevronLeft size={18} />
            </button>
            <button className="btn sm" onClick={() => { setMonth(startOfMonth(today())); setSel(today()); }}>
              Hoy
            </button>
            <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mes siguiente">
              <ChevronRight size={18} />
            </button>
            <span className="spacer" />
            <span className="small muted">
              {monthTrips.length} viajes · {monthPlanned.length} por realizar
            </span>
            <Segmented value={filter} onChange={setFilter} options={[{ value: 'activos', label: 'Activos' }, { value: 'todos', label: 'Todos' }]} />
          </div>
          <div className="cal">
            {DOW.map((d) => (
              <div className="cal-dow" key={d}>
                {d}
              </div>
            ))}
            {days.map((d) => {
              const list = byDay.get(d) ?? [];
              const out = d.slice(0, 7) !== month.slice(0, 7);
              return (
                <div
                  key={d}
                  className={`cal-day ${out ? 'out' : ''} ${d === today() ? 'today' : ''} ${d === sel ? 'sel' : ''} ${over === d ? 'drop' : ''}`}
                  onClick={() => setSel(d)}
                  onDoubleClick={() => setTrip(blankTrip({ date: d }))}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOver(d);
                  }}
                  onDragLeave={() => setOver((o) => (o === d ? null : o))}
                  onDrop={() => drop(d)}
                >
                  <span className="num">{parseISO(d).getDate()}</span>
                  {list.slice(0, 3).map((t) => (
                    <div
                      key={t.id}
                      className={`chip st-${t.status}`}
                      draggable={t.date === d && t.status !== 'Completado'}
                      onDragStart={() => setDragId(t.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTrip(t);
                      }}
                      title={`${t.code} · ${t.origin} → ${t.destination} · ${L.vehicle.get(t.vehicleId)?.plate ?? ''}`}
                    >
                      {L.vehicle.get(t.vehicleId)?.plate} <span>{t.destination}</span>
                    </div>
                  ))}
                  {list.length > 3 && <div className="more">+{list.length - 3} más</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="stack">
          <Card title={<h3 style={{ fontSize: 15 }}>{fmtDateLong(sel)}</h3>}>
            {selTrips.length === 0 && <p className="muted small">Sin viajes este día. Haz doble clic en el calendario para programar uno.</p>}
            <div className="list">
              {selTrips.map((t) => (
                <div className="list-item" key={t.id} style={{ cursor: 'pointer', alignItems: 'flex-start' }} onClick={() => setTrip(t)}>
                  <div className="grow">
                    <div className="t">
                      {t.origin} → {t.destination}
                    </div>
                    <div className="s">
                      {t.code} · {L.vehicle.get(t.vehicleId)?.plate} · {L.driver.get(t.driverId)?.name}
                    </div>
                    <div className="s">
                      {L.client.get(t.clientId)?.name} · {clp(t.price)}
                    </div>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
            <button className="btn sm mt" onClick={() => setTrip(blankTrip({ date: sel }))}>
              <Plus size={14} /> Programar este día
            </button>
          </Card>
          <Card title="Vehículos disponibles" extra={<span className="badge green plain">{available.length}</span>}>
            <div className="list">
              {available.map((v) => (
                <div className="list-item" key={v.id}>
                  <div className="dot-ico green">
                    <Truck size={15} />
                  </div>
                  <div className="grow">
                    <div className="t">{v.plate}</div>
                    <div className="s">
                      {v.type} · {L.driver.get(v.driverId ?? '')?.name ?? 'Sin conductor'}
                    </div>
                  </div>
                  <button className="btn sm ghost" onClick={() => setTrip(blankTrip({ date: sel, vehicleId: v.id, driverId: v.driverId ?? '' }))}>
                    Asignar
                  </button>
                </div>
              ))}
              {available.length === 0 && <p className="muted small">Toda la flota activa está ocupada.</p>}
            </div>
          </Card>
          <div className="legend" style={{ padding: '0 4px' }}>
            <span><i style={{ background: 'var(--brand)' }} /> Planificado</span>
            <span><i style={{ background: 'var(--accent)' }} /> En curso</span>
            <span><i style={{ background: 'var(--green)' }} /> Completado</span>
          </div>
        </div>
      </div>
      <TripModal trip={trip} onClose={() => setTrip(null)} />
    </>
  );
}

