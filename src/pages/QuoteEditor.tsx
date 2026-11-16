import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, FileText, Plus, RotateCcw, Route, Save, Trash2 } from 'lucide-react';
import { Card, Field, NumInput, PageHeader, Segmented, Select, StatusBadge, TextInput, Toggle, CHART_COLORS, confirmDelete, useForm } from '../components/ui';
import { useStore } from '../store/store';
import { ClientModal, blankClient } from '../components/ClientModal';
import type { Client, Quote, Trip, VehicleType } from '../store/types';
import { calcQuote } from '../lib/calc';
import { addDays, clp, nextCode, num, pct, today, uid } from '../lib/format';

const WEAR_BY_TYPE: Record<VehicleType, number> = { 'Tracto camión': 180, Camión: 120, Camioneta: 70, Furgón: 75 };

export default function QuoteEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const { db, upsert, remove } = useStore();
  const p = db.settings.params;
  const existing = db.quotes.find((q) => q.id === id);
  const [newClient, setNewClient] = useState<Client | null>(null);

  const initial: Quote = existing ? { ...existing, conditions: existing.conditions ?? db.settings.quoteConditions } : {
    id: '',
    code: '',
    clientId: '',
    date: today(),
    validUntil: addDays(today(), p.quoteValidityDays),
    origin: 'Santiago',
    destination: '',
    distanceKm: 0,
    roundTrip: true,
    cargo: '',
    weightKg: 0,
    fuelPrice: p.fuelPrice,
    fuelEfficiency: 4,
    tolls: 0,
    driverDays: 1,
    driverRate: p.defaultDriverRate,
    maintenancePerKm: p.maintenancePerKm,
    otherCosts: 0,
    marginPct: p.defaultMarginPct,
    pricingMode: 'margen',
    status: 'Borrador',
    conditions: db.settings.quoteConditions,
  };
  const { f, set, setF } = useForm<Quote>(initial);
  const c = useMemo(() => calcQuote(f, db.tariffs, p.ivaPct), [f, db.tariffs, p.ivaPct]);
  const vehicle = db.vehicles.find((v) => v.id === f.vehicleId);
  const tariffs = db.tariffs.filter((t) => !vehicle || !t.vehicleType || t.vehicleType === vehicle.type);

  if (id !== 'nueva' && !existing)
    return (
      <div className="card card-pad">
        Cotización no encontrada. <Link to="/cotizaciones">Volver</Link>
      </div>
    );

  const valid = !!f.clientId && !!f.destination;

  const save = (patch?: Partial<Quote>) => {
    const item: Quote = { ...f, ...patch, id: f.id || uid(), code: f.code || nextCode('C', db.quotes) };
    upsert('quotes', item);
    setF(item);
    if (!f.id) nav(`/cotizaciones/${item.id}`, { replace: true });
    return item;
  };

  const toTrip = () => {
    const q = save({ status: 'Aceptada' });
    if (q.tripId && db.trips.some((t) => t.id === q.tripId)) return nav(`/operaciones?viaje=${q.tripId}`);
    const trip: Trip = {
      id: uid(),
      code: nextCode('V', db.trips),
      clientId: q.clientId,
      vehicleId: q.vehicleId ?? '',
      driverId: vehicle?.driverId ?? '',
      origin: q.origin,
      destination: q.destination,
      distanceKm: q.distanceKm,
      date: today() > q.date ? today() : q.date,
      cargo: q.cargo,
      weightKg: q.weightKg,
      price: c.net,
      status: 'Planificado',
      invoice: { paid: false },
      quoteId: q.id,
      notes: `Generado desde cotización ${q.code}`,
    };
    upsert('trips', trip);
    upsert('quotes', { ...q, tripId: trip.id });
    nav(`/operaciones?viaje=${trip.id}`);
  };

  const parts = [
    { label: 'Combustible', value: c.fuel },
    { label: 'Peajes', value: c.tolls },
    { label: 'Conductor', value: c.driver },
    { label: 'Desgaste / mantención', value: c.maintenance },
    { label: 'Otros', value: c.other },
  ];

  return (
    <>
      <PageHeader
        title={f.code ? `Cotización ${f.code}` : 'Nueva cotización'}
        subtitle={
          <Link to="/cotizaciones" className="row" style={{ gap: 4, display: 'inline-flex' }}>
            <ArrowLeft size={14} /> Todas las cotizaciones
          </Link>
        }
        actions={
          <>
            {f.id && (
              <>
                <button
                  className="btn danger"
                  onClick={() => {
                    if (confirmDelete(`la cotización ${f.code}`)) {
                      remove('quotes', f.id);
                      nav('/cotizaciones');
                    }
                  }}
                >
                  <Trash2 size={15} />
                </button>
                <button
                  className="btn"
                  title="Duplicar"
                  onClick={() => {
                    const copy: Quote = { ...f, id: uid(), code: nextCode('C', db.quotes), status: 'Borrador', date: today(), validUntil: addDays(today(), p.quoteValidityDays), tripId: undefined };
                    upsert('quotes', copy);
                    setF(copy);
                    nav(`/cotizaciones/${copy.id}`);
                  }}
                >
                  <Copy size={15} /> Duplicar
                </button>
              </>
            )}
            <button
              className="btn"
              disabled={!valid}
              onClick={() => {
                const q = save();
                window.open(`/pdf/cotizacion/${q.id}`, '_blank');
              }}
            >
              <FileText size={15} /> Ver PDF
            </button>
            <button className="btn" disabled={!valid} onClick={toTrip}>
              <Route size={15} /> {f.tripId ? 'Ver viaje' : 'Convertir en viaje'}
            </button>
            <button className="btn primary" disabled={!valid} onClick={() => save()}>
              <Save size={15} /> Guardar
            </button>
          </>
        }
      />

      <div className="grid main-side">
        <div className="stack">
          <Card title="Cliente y ruta">
            <div className="form-grid c3">
              <div className="field span2">
                <span>Cliente *</span>
                <div className="row" style={{ gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Select value={f.clientId} onChange={set('clientId')} placeholder="Selecciona un cliente" options={db.clients.map((x) => ({ value: x.id, label: x.name }))} />
                  </div>
                  <button type="button" className="btn" style={{ height: 36 }} onClick={() => setNewClient(blankClient())} title="Crear un cliente nuevo sin salir de la cotización">
                    <Plus size={15} /> Nuevo cliente
                  </button>
                </div>
              </div>
              <Field label="Estado">
                <Select value={f.status} onChange={set('status')} options={['Borrador', 'Enviada', 'Aceptada', 'Rechazada']} />
              </Field>
              <Field label="Origen">
                <TextInput value={f.origin} onChange={set('origin')} />
              </Field>
              <Field label="Destino *">
                <TextInput value={f.destination} onChange={set('destination')} />
              </Field>
              <Field label="Distancia (solo ida)">
                <NumInput value={f.distanceKm} onChange={set('distanceKm')} suffix="km" />
              </Field>
              <Field label="Fecha">
                <input className="input" type="date" value={f.date} onChange={(e) => set('date')(e.target.value)} />
              </Field>
              <Field label="Válida hasta">
                <input className="input" type="date" value={f.validUntil} onChange={(e) => set('validUntil')(e.target.value)} />
              </Field>
              <div className="field">
                <span>Ida y vuelta</span>
                <div className="row" style={{ height: 36 }}>
                  <Toggle on={f.roundTrip} onChange={set('roundTrip')} />
                  <span className="small muted">{f.roundTrip ? `${num(c.km)} km totales` : 'Solo ida'}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Vehículo y carga">
            <div className="form-grid c3">
              <Field label="Vehículo" className="span2">
                <Select
                  value={f.vehicleId ?? ''}
                  placeholder="Sin vehículo específico"
                  onChange={(vid) => {
                    const v = db.vehicles.find((x) => x.id === vid);
                    const d = db.drivers.find((x) => x.id === v?.driverId);
                    setF((prev) => ({
                      ...prev,
                      vehicleId: vid || undefined,
                      fuelEfficiency: v?.fuelEfficiency ?? prev.fuelEfficiency,
                      driverRate: d?.dailyRate ?? prev.driverRate,
                      maintenancePerKm: v ? WEAR_BY_TYPE[v.type] : prev.maintenancePerKm,
                    }));
                  }}
                  options={db.vehicles.filter((v) => v.status !== 'Inactivo').map((v) => ({ value: v.id, label: `${v.plate} · ${v.type} · ${v.brand} ${v.model}` }))}
                />
              </Field>
              <Field label="Peso" hint={vehicle ? `Capacidad ${num(vehicle.capacityKg)} kg` : undefined}>
                <NumInput value={f.weightKg} onChange={set('weightKg')} suffix="kg" />
              </Field>
              <Field label="Descripción de la carga" className="full">
                <TextInput value={f.cargo} onChange={set('cargo')} placeholder="Ej: 22 pallets de bebidas" />
              </Field>
            </div>
          </Card>

          <Card title="Costos del servicio" extra={<span className="small faint">Valores sugeridos desde Configuración y la ficha del vehículo</span>}>
            <div className="form-grid c3">
              <Field label="Precio diésel">
                <NumInput value={f.fuelPrice} onChange={set('fuelPrice')} prefix="$" suffix="/L" />
              </Field>
              <Field label="Rendimiento">
                <NumInput value={f.fuelEfficiency} onChange={set('fuelEfficiency')} suffix="km/L" />
              </Field>
              <Field label="Peajes (total)">
                <NumInput value={f.tolls} onChange={set('tolls')} prefix="$" />
              </Field>
              <Field label="Días conductor">
                <NumInput value={f.driverDays} onChange={set('driverDays')} suffix="días" />
              </Field>
              <Field label="Costo diario conductor">
                <NumInput value={f.driverRate} onChange={set('driverRate')} prefix="$" />
              </Field>
              <Field label="Desgaste / mantención" hint="Neumáticos, aceite, repuestos">
                <NumInput value={f.maintenancePerKm} onChange={set('maintenancePerKm')} prefix="$" suffix="/km" />
              </Field>
              <Field label="Otros costos" hint="Estiba, permisos, seguro de carga…" className="full">
                <NumInput value={f.otherCosts} onChange={set('otherCosts')} prefix="$" />
              </Field>
            </div>
          </Card>

          <Card title="Precio de venta">
            <Segmented
              value={f.pricingMode}
              onChange={set('pricingMode')}
              options={[
                { value: 'margen', label: 'Costo + margen' },
                { value: 'tarifa', label: 'Según tarifa' },
                { value: 'manual', label: 'Precio manual' },
              ]}
            />
            <div className="form-grid mt">
              {f.pricingMode === 'margen' && (
                <Field label="Margen objetivo sobre el precio" hint={`Precio sugerido: ${clp(c.marginPrice)}`}>
                  <NumInput value={f.marginPct} onChange={set('marginPct')} suffix="%" />
                </Field>
              )}
              {f.pricingMode === 'tarifa' && (
                <Field label="Tarifa" hint={c.tariffPrice != null ? `Resultado: ${clp(c.tariffPrice)}` : 'Configura tarifas en Configuración'}>
                  <Select value={f.tariffId ?? ''} onChange={(v) => set('tariffId')(v || undefined)} placeholder="Selecciona tarifa" options={tariffs.map((t) => ({ value: t.id, label: `${t.name} (${clp(t.value)}/${t.unit})` }))} />
                </Field>
              )}
              {f.pricingMode === 'manual' && (
                <Field label="Precio neto" hint={`Precio con margen ${f.marginPct}%: ${clp(c.marginPrice)}`}>
                  <NumInput value={f.manualPrice} onChange={set('manualPrice')} prefix="$" />
                </Field>
              )}
            </div>
          </Card>

          <Card
            title="Condiciones comerciales"
            extra={
              <button type="button" className="btn sm ghost" onClick={() => set('conditions')(db.settings.quoteConditions)} title="Volver a las condiciones definidas en Configuración">
                <RotateCcw size={13} /> Usar condiciones por defecto
              </button>
            }
          >
            <div className="form-grid">
              <Field label="Condiciones de esta cotización" hint="Una condición por línea. Las condiciones por defecto se definen en Configuración → Cotizaciones." className="full">
                <textarea className="input" style={{ minHeight: 120 }} value={f.conditions ?? ''} onChange={(e) => set('conditions')(e.target.value)} />
              </Field>
              <Field label="Observaciones para el cliente" className="full">
                <textarea className="input" value={f.notes ?? ''} onChange={(e) => set('notes')(e.target.value)} placeholder="Horarios, contacto en destino, detalles del servicio…" />
              </Field>
            </div>
          </Card>
        </div>

        <div>
          <div className="card card-pad sticky">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 16 }}>Resumen</h3>
              <StatusBadge status={f.status} />
            </div>
            <div className="price-hero">
              <div className="l">Precio neto</div>
              <div className="v">{clp(c.net)}</div>
              <div className="s">
                + IVA {p.ivaPct}% {clp(c.iva)} = <b>{clp(c.total)}</b>
              </div>
            </div>
            <div className="meter" style={{ marginBottom: 6 }}>
              {parts.map((x, i) =>
                x.value > 0 ? <div key={x.label} title={`${x.label}: ${clp(x.value)}`} style={{ width: `${(x.value / Math.max(c.cost, 1)) * 100}%`, background: CHART_COLORS[i], borderRight: '2px solid #fff' }} /> : null,
              )}
            </div>
            <div className="breakdown">
              {parts.map((x, i) => (
                <div className="bd-row" key={x.label}>
                  <span className="row" style={{ gap: 7 }}>
                    <i style={{ width: 8, height: 8, borderRadius: 2, background: CHART_COLORS[i], display: 'inline-block' }} />
                    {x.label}
                    {x.label === 'Combustible' && c.liters > 0 && <span className="faint small">({num(c.liters)} L)</span>}
                  </span>
                  <span>{clp(x.value)}</span>
                </div>
              ))}
              <div className="bd-row total">
                <span>Costo total</span>
                <span>{clp(c.cost)}</span>
              </div>
              <div className="bd-row">
                <span>Costo por km</span>
                <span>{clp(c.costPerKm)}</span>
              </div>
              <div className="bd-row">
                <span>Utilidad estimada</span>
                <span className={c.profit < 0 ? 'neg strong' : 'pos strong'}>{clp(c.profit)}</span>
              </div>
              <div className="bd-row" style={{ borderBottom: 'none' }}>
                <span>Margen real</span>
                <span className={c.realMargin < 0.1 ? 'neg strong' : 'strong'}>{pct(c.realMargin)}</span>
              </div>
            </div>
            {c.realMargin < 0.1 && c.net > 0 && (
              <div className="small mt" style={{ background: 'var(--red-soft)', color: 'var(--red)', padding: '10px 12px', borderRadius: 10 }}>
                Atención: el margen es menor a 10%. Revisa el precio o los costos.
              </div>
            )}
          </div>
        </div>
      </div>
      <ClientModal client={newClient} onClose={() => setNewClient(null)} onSaved={(c) => set('clientId')(c.id)} />
    </>
  );
}
