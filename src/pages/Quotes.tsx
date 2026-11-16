import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Plus, Search } from 'lucide-react';
import { Empty, PageHeader, Select, Stat, StatusBadge } from '../components/ui';
import { useLookups, useStore } from '../store/store';
import { calcQuote } from '../lib/calc';
import { clp, fmtDate, pct, today } from '../lib/format';

export default function Quotes() {
  const { db } = useStore();
  const L = useLookups();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const iva = db.settings.params.ivaPct;

  const rows = useMemo(
    () =>
      db.quotes
        .map((x) => ({ q: x, c: calcQuote(x, db.tariffs, iva) }))
        .filter(({ q: x }) => !status || x.status === status)
        .filter(({ q: x }) => `${x.code} ${x.origin} ${x.destination} ${L.client.get(x.clientId)?.name ?? ''}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.q.date.localeCompare(a.q.date)),
    [db.quotes, db.tariffs, iva, q, status, L],
  );

  const stats = useMemo(() => {
    const all = db.quotes.map((x) => ({ q: x, c: calcQuote(x, db.tariffs, iva) }));
    const sent = all.filter((x) => x.q.status === 'Enviada');
    const decided = all.filter((x) => x.q.status === 'Aceptada' || x.q.status === 'Rechazada');
    const won = all.filter((x) => x.q.status === 'Aceptada');
    return {
      pipeline: sent.reduce((s, x) => s + x.c.net, 0),
      sent: sent.length,
      win: decided.length ? won.length / decided.length : 0,
      won: won.reduce((s, x) => s + x.c.net, 0),
      avgMargin: all.length ? all.reduce((s, x) => s + x.c.realMargin, 0) / all.length : 0,
    };
  }, [db.quotes, db.tariffs, iva]);

  return (
    <>
      <PageHeader
        title="Cotizaciones"
        subtitle="Calcula costos, define precios y genera propuestas comerciales"
        actions={
          <Link className="btn primary" to="/cotizaciones/nueva">
            <Plus size={16} /> Nueva cotización
          </Link>
        }
      />
      <div className="grid k4" style={{ marginBottom: 16 }}>
        <Stat label="En negociación" value={clp(stats.pipeline)} sub={`${stats.sent} cotizaciones enviadas`} />
        <Stat label="Ganado" value={clp(stats.won)} tone="green" />
        <Stat label="Tasa de cierre" value={pct(stats.win, 0)} tone="purple" sub="Aceptadas / decididas" />
        <Stat label="Margen promedio" value={pct(stats.avgMargin)} tone="orange" />
      </div>
      <div className="card">
        <div className="toolbar">
          <div className="search">
            <Search size={15} />
            <input className="input" placeholder="Buscar cotización" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div style={{ width: 170 }}>
            <Select value={status} onChange={setStatus} placeholder="Todos los estados" options={['Borrador', 'Enviada', 'Aceptada', 'Rechazada']} />
          </div>
        </div>
        {rows.length === 0 ? (
          <Empty icon={<FileSpreadsheet size={26} />} title="Sin cotizaciones" text="Crea tu primera cotización con cálculo automático de costos." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Cotización</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Ruta</th>
                  <th className="right">Costo</th>
                  <th className="right">Precio neto</th>
                  <th className="right">Margen</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ q: x, c }) => {
                  const expired = x.status === 'Enviada' && x.validUntil < today();
                  return (
                    <tr key={x.id} className="click" onClick={() => nav(`/cotizaciones/${x.id}`)}>
                      <td className="cell-title">{x.code}</td>
                      <td className="nowrap">
                        {fmtDate(x.date)}
                        {expired && <div className="cell-sub neg">Vencida</div>}
                      </td>
                      <td>{L.client.get(x.clientId)?.name ?? '—'}</td>
                      <td>
                        {x.origin} → {x.destination}
                        <div className="cell-sub">{x.roundTrip ? 'Ida y vuelta' : 'Solo ida'} · {c.km} km</div>
                      </td>
                      <td className="right tnum">{clp(c.cost)}</td>
                      <td className="right tnum strong">{clp(c.net)}</td>
                      <td className={`right tnum ${c.realMargin < 0.1 ? 'neg' : ''}`}>{pct(c.realMargin)}</td>
                      <td>
                        <StatusBadge status={x.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
