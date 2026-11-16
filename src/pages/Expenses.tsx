import { useEffect, useMemo, useState } from 'react';
import { Fuel, Plus, Receipt, Search, Trash2, Wallet, Wrench, Milestone } from 'lucide-react';
import { Empty, Field, Modal, NumInput, PageHeader, Segmented, Select, Stat, TextInput, confirmDelete, useForm } from '../components/ui';
import { useLookups, useStore } from '../store/store';
import { EXPENSE_CATEGORIES, type Expense } from '../store/types';
import { PERIODS, clp, fmtDate, inRange, num, periodRange, today, uid, type PeriodKey } from '../lib/format';

const blank = (): Expense => ({ id: '', date: today(), category: 'Combustible', amount: 0 });

export default function Expenses() {
  const { db } = useStore();
  const L = useLookups();
  const [period, setPeriod] = useState<PeriodKey>('mes');
  const [cat, setCat] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Expense | null>(null);
  const [limit, setLimit] = useState(60);

  const range = periodRange(period);
  const inPeriod = useMemo(() => db.expenses.filter((e) => inRange(e.date, range)), [db.expenses, range.from, range.to]); // eslint-disable-line

  const list = useMemo(
    () =>
      inPeriod
        .filter((e) => (!cat || e.category === cat) && (!vehicle || e.vehicleId === vehicle))
        .filter((e) => `${e.description ?? ''} ${e.provider ?? ''} ${e.docNumber ?? ''}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [inPeriod, cat, vehicle, q],
  );

  const sum = (fn: (e: Expense) => boolean) => inPeriod.filter(fn).reduce((s, e) => s + e.amount, 0);
  const total = sum(() => true);
  const fuelList = inPeriod.filter((e) => e.category === 'Combustible');
  const liters = fuelList.reduce((s, e) => s + (e.liters || 0), 0);
  const fuel = fuelList.reduce((s, e) => s + e.amount, 0);
  const filteredTotal = list.reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <PageHeader
        title="Gastos"
        subtitle="Combustible, peajes, mantenciones y todos los costos de tu operación"
        actions={
          <button className="btn primary" onClick={() => setEdit(blank())}>
            <Plus size={16} /> Registrar gasto
          </button>
        }
      />
      <Segmented value={period} onChange={setPeriod} options={PERIODS} />
      <div className="grid k4 mt">
        <Stat label="Total gastos" value={clp(total)} icon={<Wallet size={15} />} tone="orange" sub={`${inPeriod.length} registros`} />
        <Stat label="Combustible" value={clp(fuel)} icon={<Fuel size={15} />} sub={liters ? `${num(liters)} L · ${clp(fuel / liters)}/L prom.` : undefined} />
        <Stat label="Peajes" value={clp(sum((e) => e.category === 'Peajes'))} icon={<Milestone size={15} />} tone="purple" />
        <Stat label="Mantención y neumáticos" value={clp(sum((e) => e.category === 'Mantención' || e.category === 'Neumáticos'))} icon={<Wrench size={15} />} tone="red" />
      </div>

      <div className="card mt">
        <div className="toolbar">
          <div className="search">
            <Search size={15} />
            <input className="input" placeholder="Buscar descripción, proveedor, N° doc." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div style={{ width: 180 }}>
            <Select value={cat} onChange={setCat} placeholder="Todas las categorías" options={EXPENSE_CATEGORIES} />
          </div>
          <div style={{ width: 190 }}>
            <Select value={vehicle} onChange={setVehicle} placeholder="Todos los vehículos" options={db.vehicles.map((v) => ({ value: v.id, label: v.plate }))} />
          </div>
          <span className="spacer" />
          <span className="small muted">
            Total filtrado <b className="tnum">{clp(filteredTotal)}</b>
          </span>
        </div>
        {list.length === 0 ? (
          <Empty icon={<Receipt size={26} />} title="Sin gastos en este período" text="Registra cargas de combustible, peajes, mantenciones y más." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Categoría</th>
                  <th>Detalle</th>
                  <th>Vehículo</th>
                  <th>Viaje</th>
                  <th className="right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {list.slice(0, limit).map((e) => (
                  <tr key={e.id} className="click" onClick={() => setEdit(e)}>
                    <td className="nowrap">{fmtDate(e.date)}</td>
                    <td>
                      <span className="badge plain">{e.category}</span>
                    </td>
                    <td>
                      <div>{e.description || '—'}</div>
                      <div className="cell-sub">
                        {[e.provider, e.docNumber && `Doc. ${e.docNumber}`, e.liters && `${num(e.liters)} L`].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td>{e.vehicleId ? L.vehicle.get(e.vehicleId)?.plate : <span className="faint">General</span>}</td>
                    <td className="small">{e.tripId ? L.trip.get(e.tripId)?.code : <span className="faint">—</span>}</td>
                    <td className="right tnum strong">{clp(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length > limit && (
              <div style={{ padding: 14, textAlign: 'center' }}>
                <button className="btn sm" onClick={() => setLimit((l) => l + 60)}>
                  Mostrar más ({list.length - limit})
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <ExpenseModal expense={edit} onClose={() => setEdit(null)} />
    </>
  );
}

function ExpenseModal({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const { db, upsert, remove } = useStore();
  const { f, set, setF } = useForm<Expense>(blank());
  useEffect(() => {
    if (expense) setF(expense);
  }, [expense, setF]);
  const isNew = !expense?.id;
  const trips = useMemo(
    () =>
      db.trips
        .filter((t) => t.status !== 'Cancelado' && (!f.vehicleId || t.vehicleId === f.vehicleId))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 80),
    [db.trips, f.vehicleId],
  );
  const pricePerL = f.liters ? f.amount / f.liters : 0;

  return (
    <Modal
      open={!!expense}
      onClose={onClose}
      title={isNew ? 'Registrar gasto' : 'Editar gasto'}
      footer={
        <>
          {!isNew && (
            <button
              className="btn danger left"
              onClick={() => {
                if (confirmDelete('este gasto')) {
                  remove('expenses', f.id);
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
            disabled={!f.amount}
            onClick={() => {
              upsert('expenses', { ...f, id: f.id || uid(), liters: f.category === 'Combustible' ? f.liters : undefined });
              onClose();
            }}
          >
            Guardar
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Categoría">
          <Select value={f.category} onChange={set('category')} options={EXPENSE_CATEGORIES} />
        </Field>
        <Field label="Fecha">
          <input className="input" type="date" value={f.date} onChange={(e) => set('date')(e.target.value)} />
        </Field>
        <Field label="Monto total *">
          <NumInput value={f.amount} onChange={set('amount')} prefix="$" />
        </Field>
        {f.category === 'Combustible' ? (
          <Field label="Litros" hint={pricePerL ? `${clp(pricePerL)} por litro` : undefined}>
            <NumInput value={f.liters} onChange={set('liters')} suffix="L" />
          </Field>
        ) : (
          <Field label="N° documento">
            <TextInput value={f.docNumber} onChange={set('docNumber')} placeholder="Boleta / factura" />
          </Field>
        )}
        <Field label="Vehículo">
          <Select value={f.vehicleId ?? ''} onChange={(v) => setF((p) => ({ ...p, vehicleId: v || undefined, tripId: undefined }))} placeholder="Gasto general (sin vehículo)" options={db.vehicles.map((v) => ({ value: v.id, label: `${v.plate} · ${v.brand} ${v.model}` }))} />
        </Field>
        <Field label="Asociar a viaje" hint="Para calcular rentabilidad por viaje y cliente">
          <Select
            value={f.tripId ?? ''}
            onChange={(v) => {
              const t = db.trips.find((x) => x.id === v);
              setF((p) => ({ ...p, tripId: v || undefined, vehicleId: t?.vehicleId ?? p.vehicleId }));
            }}
            placeholder="Sin viaje"
            options={trips.map((t) => ({ value: t.id, label: `${t.code} · ${fmtDate(t.date)} · ${t.destination}` }))}
          />
        </Field>
        <Field label="Proveedor">
          <TextInput value={f.provider} onChange={set('provider')} placeholder="Copec, taller, etc." />
        </Field>
        {f.category === 'Combustible' && (
          <Field label="N° documento">
            <TextInput value={f.docNumber} onChange={set('docNumber')} />
          </Field>
        )}
        <Field label="Descripción" className="full">
          <TextInput value={f.description} onChange={set('description')} />
        </Field>
      </div>
    </Modal>
  );
}
