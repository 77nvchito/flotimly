import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { Building2, Info, PiggyBank, Route, Truck } from 'lucide-react';
import { Card, MoneyTooltip, PageHeader, SERIES, Segmented, Stat } from '../components/ui';
import { useStore } from '../store/store';
import { profitByClient, profitByTrip, profitByVehicle, totals, type ProfitRow } from '../lib/calc';
import { PERIODS, clp, compactClp, num, pct, periodRange, type PeriodKey } from '../lib/format';

type View = 'vehiculos' | 'viajes' | 'clientes';

export default function Profitability() {
  const { db } = useStore();
  const [period, setPeriod] = useState<PeriodKey>('3m');
  const [view, setView] = useState<View>('vehiculos');
  const range = periodRange(period);

  const { rows, t } = useMemo(() => {
    const r = periodRange(period);
    const rows = view === 'vehiculos' ? profitByVehicle(db, r) : view === 'viajes' ? profitByTrip(db, r) : profitByClient(db, r);
    return { rows: rows.filter((x) => x.income > 0 || x.expense > 0), t: totals(db, r) };
  }, [db, period, view]);

  const chartRows = (view === 'viajes' ? rows.slice(0, 15) : rows).map((r) => ({ name: r.label, utilidad: Math.round(r.profit) }));
  const sum = rows.reduce(
    (a, r) => ({ income: a.income + r.income, expense: a.expense + r.expense, trips: a.trips + r.trips, km: a.km + r.km }),
    { income: 0, expense: 0, trips: 0, km: 0 },
  );
  const unassigned = view === 'vehiculos' ? db.expenses.filter((e) => !e.vehicleId && e.date >= range.from && e.date <= range.to).reduce((s, e) => s + e.amount, 0) : 0;

  return (
    <>
      <PageHeader title="Rentabilidad" subtitle="Analiza qué camiones, viajes y clientes generan más utilidad" />
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'vehiculos', label: <><Truck size={14} /> Por camión</> },
            { value: 'viajes', label: <><Route size={14} /> Por viaje</> },
            { value: 'clientes', label: <><Building2 size={14} /> Por cliente</> },
          ]}
        />
        <Segmented value={period} onChange={setPeriod} options={PERIODS} />
      </div>

      <div className="grid k4 mt">
        <Stat label="Ventas" value={clp(t.income)} sub={`${t.trips} viajes completados`} />
        <Stat label="Gastos totales" value={clp(t.expense)} tone="orange" />
        <Stat label="Utilidad operacional" value={<span className={t.profit < 0 ? 'neg' : ''}>{clp(t.profit)}</span>} tone="green" icon={<PiggyBank size={15} />} />
        <Stat label="Margen operacional" value={pct(t.margin)} tone="purple" sub={t.km ? `${clp(t.expense / t.km)} costo/km` : undefined} />
      </div>

      {view !== 'vehiculos' && (
        <div className="small muted row mt" style={{ gap: 6 }}>
          <Info size={14} /> Por {view === 'viajes' ? 'viaje' : 'cliente'} se muestra el <b>margen de contribución</b>: ventas menos costos directos asociados a cada viaje (combustible, peajes, viáticos).
        </div>
      )}

      <Card title={view === 'viajes' ? 'Utilidad — 15 viajes más rentables' : 'Utilidad por ' + (view === 'vehiculos' ? 'camión' : 'cliente')} className="mt">
        <div style={{ height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={chartRows} margin={{ top: 10, right: 4, left: 4, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} tickFormatter={(v: string) => (v.length > 16 ? v.slice(0, 15) + '…' : v)} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={compactClp} width={58} />
              <ReferenceLine y={0} stroke="rgba(0,0,0,0.25)" />
              <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(11,79,156,0.06)' }} />
              <Bar dataKey="utilidad" name="Utilidad" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={44}>
                {chartRows.map((r) => (
                  <Cell key={r.name} fill={r.utilidad >= 0 ? SERIES.income : SERIES.expense} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="card mt table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{view === 'vehiculos' ? 'Vehículo' : view === 'viajes' ? 'Viaje' : 'Cliente'}</th>
              {view !== 'viajes' && <th className="right">Viajes</th>}
              <th className="right">Km</th>
              <th className="right">Ventas</th>
              <th className="right">{view === 'vehiculos' ? 'Gastos' : 'Costos directos'}</th>
              <th className="right">Utilidad</th>
              <th className="right">Margen</th>
              {view === 'vehiculos' && <th className="right">Costo/km</th>}
              <th style={{ width: 140 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <ProfitTr key={r.id} r={r} view={view} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="muted" style={{ textAlign: 'center', padding: 30 }}>
                  Sin datos en el período seleccionado.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td>Total</td>
                {view !== 'viajes' && <td className="right tnum">{sum.trips}</td>}
                <td className="right tnum">{num(sum.km)}</td>
                <td className="right tnum">{clp(sum.income)}</td>
                <td className="right tnum">{clp(sum.expense)}</td>
                <td className="right tnum">{clp(sum.income - sum.expense)}</td>
                <td className="right tnum">{pct(sum.income ? (sum.income - sum.expense) / sum.income : 0)}</td>
                {view === 'vehiculos' && <td className="right tnum">{sum.km ? clp(sum.expense / sum.km) : '—'}</td>}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
        {unassigned > 0 && (
          <div className="small muted" style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
            Gastos generales no asignados a un vehículo en el período: <b>{clp(unassigned)}</b> (incluidos en la utilidad operacional total).
          </div>
        )}
      </div>
    </>
  );
}

function ProfitTr({ r, view }: { r: ProfitRow; view: View }) {
  const m = Math.max(-1, Math.min(1, r.margin));
  return (
    <tr>
      <td>
        <div className="cell-title">{r.label}</div>
        <div className="cell-sub">{r.sub}</div>
      </td>
      {view !== 'viajes' && <td className="right tnum">{r.trips}</td>}
      <td className="right tnum">{num(r.km)}</td>
      <td className="right tnum">{clp(r.income)}</td>
      <td className="right tnum">{clp(r.expense)}</td>
      <td className={`right tnum strong ${r.profit < 0 ? 'neg' : ''}`}>{clp(r.profit)}</td>
      <td className={`right tnum ${r.margin < 0 ? 'neg' : ''}`}>{pct(r.margin)}</td>
      {view === 'vehiculos' && <td className="right tnum">{r.km ? clp(r.costPerKm) : '—'}</td>}
      <td>
        <div className="meter" title={pct(r.margin)}>
          <div style={{ width: `${Math.abs(m) * 100}%`, background: m >= 0 ? SERIES.income : SERIES.expense, borderRadius: 999 }} />
        </div>
      </td>
    </tr>
  );
}
