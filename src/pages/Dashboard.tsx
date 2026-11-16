import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  Gauge,
  MapPin,
  PiggyBank,
  ReceiptText,
  Sparkles,
  Truck,
  Wallet,
} from 'lucide-react';
import { Card, MoneyTooltip, PageHeader, SERIES, Stat, StatusBadge } from '../components/ui';
import { useLookups, useStore } from '../store/store';
import {
  documentAlerts,
  expensesByCategory,
  invoiceState,
  monthlySeries,
  profitByClient,
  profitByVehicle,
  totals,
} from '../lib/calc';
import { clp, compactClp, fmtDateLong, fmtDateShort, monthLabel, pct, periodRange, prevMonthToDate, today, num } from '../lib/format';

export default function Dashboard() {
  const { db, isPyme, user } = useStore();
  const L = useLookups();
  const nav = useNavigate();

  const data = useMemo(() => {
    const cur = totals(db, periodRange('mes'));
    const prev = totals(db, prevMonthToDate());
    const series = monthlySeries(db, 6);
    const cats = expensesByCategory(db, periodRange('mes'));
    const vehicles = profitByVehicle(db, periodRange('3m')).filter((v) => v.trips > 0);
    const clients = profitByClient(db, periodRange('3m')).filter((c) => c.trips > 0);
    const alerts = documentAlerts(db.vehicles, db.drivers, db.settings.params.alertDays);
    const t = today();
    const upcoming = db.trips
      .filter((x) => x.date >= t && (x.status === 'Planificado' || x.status === 'En curso'))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6);
    const inProgress = db.trips.filter((x) => x.status === 'En curso').length;
    let receivable = 0;
    let overdue = 0;
    let toInvoice = 0;
    for (const x of db.trips) {
      if (x.status !== 'Completado') continue;
      const s = invoiceState(x);
      if (s === 'pendiente') receivable += x.price;
      if (s === 'vencida') {
        receivable += x.price;
        overdue += x.price;
      }
      if (s === 'por_facturar') toInvoice += x.price;
    }
    const openQuotes = db.quotes.filter((q) => q.status === 'Enviada').length;
    return { cur, prev, series, cats, vehicles, clients, alerts, upcoming, inProgress, receivable, overdue, toInvoice, openQuotes };
  }, [db]);

  const { cur, prev } = data;
  const delta = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : null);
  const activeFleet = db.vehicles.filter((v) => v.status === 'Activo').length;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const bestVehicle = data.vehicles[0];
  const topClient = data.clients[0];
  const catMax = Math.max(1, ...data.cats.map((c) => c.value));
  const fuel = data.cats.find((c) => c.name === 'Combustible')?.value ?? 0;
  const incomeDelta = delta(cur.income, prev.income);

  const lead =
    cur.trips === 0
      ? 'Aún no hay viajes completados este mes. Registra tus operaciones para ver tu resumen ejecutivo.'
      : `${monthLabel(today().slice(0, 7), true)}: ${cur.trips} viajes completados, ${clp(cur.income)} en ventas netas y un margen operacional de ${pct(cur.margin)}${
          incomeDelta != null ? ` (${incomeDelta >= 0 ? '+' : ''}${(incomeDelta * 100).toFixed(0)}% en ventas vs el mismo período del mes anterior)` : ''
        }.`;

  const bullets: string[] = [];
  if (bestVehicle) bullets.push(`Vehículo más rentable (90 días): ${bestVehicle.label} con ${clp(bestVehicle.profit)} de utilidad y margen ${pct(bestVehicle.margin)}.`);
  if (topClient) bullets.push(`Cliente principal (90 días): ${topClient.label}, ${clp(topClient.income)} en ${topClient.trips} viajes.`);
  if (cur.expense > 0) bullets.push(`El combustible representa el ${pct(fuel / cur.expense, 0)} de los gastos del mes.`);
  if (cur.km > 0) bullets.push(`Costo por km recorrido este mes: ${clp(cur.expense / cur.km)} · ${num(cur.km)} km totales.`);
  if (data.alerts.length) bullets.push(`${data.alerts.length} documento(s) vencido(s) o por vencer en ${db.settings.params.alertDays} días.`);
  if (isPyme && data.overdue > 0) bullets.push(`Tienes ${clp(data.overdue)} en facturas vencidas por cobrar.`);
  if (data.openQuotes) bullets.push(`${data.openQuotes} cotización(es) enviada(s) esperando respuesta.`);

  return (
    <>
      <PageHeader
        title={`${greet}, ${user?.name.split(' ')[0]}`}
        subtitle={fmtDateLong(today())}
        actions={
          <>
            <Link className="btn" to="/cotizaciones/nueva">
              Nueva cotización
            </Link>
            <Link className="btn primary" to="/operaciones?nuevo=1">
              Nuevo viaje
            </Link>
          </>
        }
      />

      <div className="card card-pad exec">
        <h3>
          <Sparkles size={16} /> Resumen ejecutivo
        </h3>
        <div className="lead">{lead}</div>
        <ul>
          {bullets.slice(0, 6).map((b) => (
            <li key={b}>
              <ArrowRight size={14} />
              {b}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid k4 mt">
        <Stat label="Ventas del mes" icon={<CircleDollarSign size={15} />} value={clp(cur.income)} delta={incomeDelta} sub="vs mismo período mes ant." />
        <Stat label="Gastos del mes" icon={<Wallet size={15} />} tone="orange" value={clp(cur.expense)} delta={delta(cur.expense, prev.expense)} sub="vs mismo período mes ant." />
        <Stat
          label="Utilidad operacional"
          icon={<PiggyBank size={15} />}
          tone={cur.profit >= 0 ? 'green' : 'red'}
          value={<span className={cur.profit < 0 ? 'neg' : ''}>{clp(cur.profit)}</span>}
          sub={`Margen ${pct(cur.margin)}`}
        />
        {isPyme ? (
          <Stat label="Cuentas por cobrar" icon={<ReceiptText size={15} />} tone="purple" value={clp(data.receivable)} sub={data.overdue ? <span className="neg">{clp(data.overdue)} vencido</span> : 'Sin facturas vencidas'} />
        ) : (
          <Stat label="Flota activa" icon={<Truck size={15} />} tone="purple" value={`${activeFleet} / ${db.vehicles.length}`} sub={`${data.inProgress} viaje(s) en curso hoy`} />
        )}
      </div>

      <div className="grid main-side mt">
        <Card
          title="Ventas vs gastos"
          extra={
            <div className="legend">
              <span>
                <i style={{ background: SERIES.income }} /> Ventas
              </span>
              <span>
                <i style={{ background: SERIES.expense }} /> Gastos
              </span>
            </div>
          }
        >
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={data.series} barGap={2} barCategoryGap="28%" margin={{ top: 10, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={compactClp} width={58} />
                <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(11,79,156,0.06)' }} />
                <Bar dataKey="ingresos" name="Ventas" fill={SERIES.income} radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={28} />
                <Bar dataKey="gastos" name="Gastos" fill={SERIES.expense} radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Gastos del mes por categoría" extra={<Link to="/gastos" className="small">Ver todo</Link>}>
          {data.cats.length === 0 ? (
            <p className="muted">Sin gastos registrados este mes.</p>
          ) : (
            <div className="stack" style={{ gap: 11 }}>
              {data.cats.slice(0, 7).map((c) => (
                <div key={c.name}>
                  <div className="row small" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>{c.name}</span>
                    <span className="tnum strong">{clp(c.value)}</span>
                  </div>
                  <div className="meter" title={`${c.name}: ${clp(c.value)}`}>
                    <div style={{ width: `${(c.value / catMax) * 100}%`, background: SERIES.expense, borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid k3 mt">
        <Card title="Próximos viajes" extra={<Link to={isPyme ? '/planificacion' : '/operaciones'} className="small">Ver agenda</Link>}>
          {data.upcoming.length === 0 && <p className="muted">No hay viajes planificados.</p>}
          <div className="list">
            {data.upcoming.map((t) => (
              <div className="list-item" key={t.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/operaciones?viaje=${t.id}`)}>
                <div className="dot-ico">
                  <MapPin size={16} />
                </div>
                <div className="grow">
                  <div className="t">
                    {t.origin} → {t.destination}
                  </div>
                  <div className="s">
                    {fmtDateShort(t.date)} · {L.vehicle.get(t.vehicleId)?.plate} · {L.client.get(t.clientId)?.name}
                  </div>
                </div>
                <StatusBadge status={t.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Alertas de documentos" extra={<span className="badge red plain">{data.alerts.length}</span>}>
          {data.alerts.length === 0 && <p className="muted">Todo al día. 🎉</p>}
          <div className="list">
            {data.alerts.slice(0, 6).map((a) => (
              <Link className="list-item" key={a.id} to={a.link} style={{ color: 'inherit' }}>
                <div className={`dot-ico ${a.severity === 'vencido' ? 'red' : 'amber'}`}>
                  {a.severity === 'vencido' ? <AlertTriangle size={16} /> : <CalendarClock size={16} />}
                </div>
                <div className="grow">
                  <div className="t">{a.title}</div>
                  <div className="s">{a.subject}</div>
                </div>
                <span className={`small strong nowrap ${a.severity === 'vencido' ? 'neg' : ''}`} style={a.severity === 'pronto' ? { color: 'var(--amber)' } : undefined}>
                  {a.days < 0 ? `Vencido hace ${-a.days} d` : a.days === 0 ? 'Vence hoy' : `En ${a.days} días`}
                </span>
              </Link>
            ))}
          </div>
        </Card>

        <Card title="Rentabilidad por vehículo" extra={<span className="small faint">Últimos 3 meses</span>}>
          <div className="list">
            {data.vehicles.slice(0, 6).map((v) => (
              <Link className="list-item" key={v.id} to="/rentabilidad" style={{ color: 'inherit' }}>
                <div className="dot-ico green">
                  <Gauge size={16} />
                </div>
                <div className="grow">
                  <div className="t">{v.label}</div>
                  <div className="s">
                    {v.trips} viajes · {v.sub}
                  </div>
                </div>
                <div className="right">
                  <div className={`strong tnum small ${v.profit < 0 ? 'neg' : ''}`}>{clp(v.profit)}</div>
                  <div className="s faint small">{pct(v.margin)}</div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {isPyme && (data.toInvoice > 0 || data.receivable > 0) && (
        <div className="card card-pad mt row wrap" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <div className="dot-ico orange">
              <ReceiptText size={16} />
            </div>
            <div>
              <div className="strong">Facturación</div>
              <div className="small muted">
                {clp(data.toInvoice)} en viajes por facturar · {clp(data.receivable)} facturado pendiente de pago
              </div>
            </div>
          </div>
          <Link to="/facturas" className="btn sm">
            Ir a facturas <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </>
  );
}
