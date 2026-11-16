import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowDownUp, ArrowUp, CheckCircle2, Clock, FileText, ReceiptText, Search } from 'lucide-react';
import { Empty, Field, Modal, PageHeader, Segmented, Select, Stat, StatusBadge, TextInput } from '../components/ui';
import { useToast } from '../components/Toast';
import { useLookups, useStore } from '../store/store';
import { dueInDays, invoiceState, type InvoiceState } from '../lib/calc';
import { addDays, clp, daysBetween, fmtDate, today } from '../lib/format';
import type { Trip } from '../store/types';

type Tab = 'por_facturar' | 'por_cobrar' | 'pagadas';
type SortKey = 'viaje' | 'cliente' | 'fecha' | 'fecha2' | 'monto';
type Dir = 'asc' | 'desc';

const STATE_LABEL: Record<InvoiceState, string> = {
  por_facturar: 'Por facturar',
  pendiente: 'Pendiente',
  vencida: 'Vencida',
  pagada: 'Pagada',
};

const TAB_LABEL: Record<Tab, string> = {
  por_facturar: 'Por facturar',
  por_cobrar: 'Por cobrar',
  pagadas: 'Pagadas',
};

/** Orden inicial de cada pestaña: lo más urgente primero. */
const DEFAULT_SORT: Record<Tab, { key: SortKey; dir: Dir }> = {
  por_facturar: { key: 'fecha', dir: 'asc' },
  por_cobrar: { key: 'fecha2', dir: 'asc' },
  pagadas: { key: 'fecha2', dir: 'desc' },
};

const tabOf = (s: InvoiceState): Tab => (s === 'por_facturar' ? 'por_facturar' : s === 'pagada' ? 'pagadas' : 'por_cobrar');
const tripNo = (code: string) => parseInt(code.replace(/\D/g, ''), 10) || 0;

export default function Invoices() {
  const { db, upsert } = useStore();
  const L = useLookups();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('por_cobrar');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState(DEFAULT_SORT.por_cobrar);
  const [issue, setIssue] = useState<Trip | null>(null);
  const [pay, setPay] = useState<Trip | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const iva = db.settings.params.ivaPct;
  const gross = (n: number) => Math.round(n * (1 + iva / 100));

  const changeTab = (t: Tab) => {
    setTab(t);
    setSort(DEFAULT_SORT[t]);
  };

  const all = useMemo(() => db.trips.filter((t) => t.status === 'Completado').map((t) => ({ t, s: invoiceState(t) })), [db.trips]);

  const stats = useMemo(() => {
    const r = { toInvoice: 0, toInvoiceN: 0, pending: 0, pendingN: 0, overdue: 0, overdueN: 0, paid30: 0 };
    const from = addDays(today(), -30);
    for (const { t, s } of all) {
      if (s === 'por_facturar') { r.toInvoice += t.price; r.toInvoiceN++; }
      if (s === 'pendiente') { r.pending += gross(t.price); r.pendingN++; }
      if (s === 'vencida') { r.overdue += gross(t.price); r.overdueN++; }
      if (s === 'pagada' && (t.invoice?.paidDate ?? '') >= from) r.paid30 += gross(t.price);
    }
    return r;
  }, [all, iva]); // eslint-disable-line

  const list = useMemo(() => {
    const s = q.toLowerCase();
    const date1 = (t: Trip) => (tab === 'por_facturar' ? t.date : t.invoice?.issueDate ?? '');
    const date2 = (t: Trip) => (tab === 'pagadas' ? t.invoice?.paidDate ?? '' : t.invoice?.dueDate ?? '');
    const clientName = (t: Trip) => L.client.get(t.clientId)?.name ?? '';
    const cmp = (a: Trip, b: Trip) => {
      switch (sort.key) {
        case 'viaje':
          return tripNo(a.code) - tripNo(b.code);
        case 'cliente':
          return clientName(a).localeCompare(clientName(b), 'es');
        case 'fecha':
          return date1(a).localeCompare(date1(b));
        case 'fecha2':
          return date2(a).localeCompare(date2(b));
        case 'monto':
          return a.price - b.price;
      }
    };
    const sign = sort.dir === 'asc' ? 1 : -1;
    return all
      .filter(({ s: st }) => tabOf(st) === tab)
      .filter(({ t }) => `${t.code} ${t.invoice?.number ?? ''} ${clientName(t)} ${t.destination}`.toLowerCase().includes(s))
      .sort((a, b) => sign * cmp(a.t, b.t) || tripNo(a.t.code) - tripNo(b.t.code));
  }, [all, tab, q, L, sort]);

  // Al volver a la fila modificada, la resalta y la lleva a la vista
  useEffect(() => {
    if (!flash) return;
    const el = document.getElementById(`inv-${flash}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const h = setTimeout(() => setFlash(null), 2700);
    return () => clearTimeout(h);
  }, [flash, tab]);

  const goTo = (t: Trip) => {
    setQ('');
    changeTab(tabOf(invoiceState(t)));
    setFlash(t.id);
  };

  /** Guarda el cambio y avisa qué pasó, dónde quedó y permite deshacer. */
  const commit = (prev: Trip, next: Trip, title: string, what: React.ReactNode) => {
    upsert('trips', next);
    const to = tabOf(invoiceState(next));
    const from = tabOf(invoiceState(prev));
    setFlash(next.id);
    toast({
      title,
      description: (
        <>
          {what}
          {to !== from && (
            <>
              {' '}
              Pasó de <em>{TAB_LABEL[from]}</em> a <em>{TAB_LABEL[to]}</em>.
            </>
          )}
        </>
      ),
      actions: [
        { label: `Ver en ${TAB_LABEL[to]}`, kind: 'primary', onClick: () => goTo(next) },
        {
          label: 'Deshacer',
          kind: 'undo',
          onClick: () => {
            upsert('trips', prev);
            toast({
              tone: 'info',
              title: 'Cambio deshecho',
              description: (
                <>
                  {prev.code} volvió a <em>{TAB_LABEL[from]}</em>.
                </>
              ),
              actions: [{ label: `Ver en ${TAB_LABEL[from]}`, kind: 'primary', onClick: () => goTo(prev) }],
            });
          },
        },
      ],
    });
  };

  // Deuda por cliente (antigüedad)
  const aging = useMemo(() => {
    const m = new Map<string, { name: string; current: number; d30: number; d60: number; d60p: number; total: number }>();
    for (const { t, s } of all) {
      if (s !== 'pendiente' && s !== 'vencida') continue;
      const c = L.client.get(t.clientId);
      const row = m.get(t.clientId) ?? { name: c?.name ?? '—', current: 0, d30: 0, d60: 0, d60p: 0, total: 0 };
      const late = daysBetween(t.invoice!.dueDate!, today());
      const v = gross(t.price);
      if (late <= 0) row.current += v;
      else if (late <= 30) row.d30 += v;
      else if (late <= 60) row.d60 += v;
      else row.d60p += v;
      row.total += v;
      m.set(t.clientId, row);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [all, L, iva]); // eslint-disable-line

  const date1Label = tab === 'por_facturar' ? 'Fecha viaje' : 'Emisión';
  const date2Label = tab === 'pagadas' ? 'Fecha pago' : 'Vencimiento';
  const sortOptions: { value: SortKey; label: string }[] = [
    { value: 'viaje', label: 'N° de viaje' },
    { value: 'cliente', label: 'Cliente' },
    { value: 'fecha', label: date1Label },
    ...(tab !== 'por_facturar' ? [{ value: 'fecha2' as SortKey, label: date2Label }] : []),
    { value: 'monto', label: 'Monto' },
  ];
  const dirLabel =
    sort.key === 'cliente'
      ? sort.dir === 'asc' ? 'A → Z' : 'Z → A'
      : sort.key === 'fecha' || sort.key === 'fecha2'
        ? sort.dir === 'asc' ? 'Más antigua primero' : 'Más reciente primero'
        : sort.dir === 'asc' ? 'Menor a mayor' : 'Mayor a menor';

  const SortTh = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => {
    const on = sort.key === k;
    return (
      <th
        className={`th-sort ${on ? 'on' : ''} ${right ? 'right' : ''}`}
        onClick={() => setSort(on ? { key: k, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: k === 'cliente' ? 'asc' : 'desc' })}
        title="Ordenar"
      >
        {children}
        <span className="arrow">{on ? sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ArrowDownUp size={12} />}</span>
      </th>
    );
  };

  return (
    <>
      <PageHeader title="Facturas pendientes" subtitle="Viajes por facturar, cuentas por cobrar y registro de pagos" />
      <div className="grid k4">
        <Stat label="Por facturar (neto)" value={clp(stats.toInvoice)} sub={`${stats.toInvoiceN} viajes completados`} icon={<FileText size={15} />} tone="purple" />
        <Stat label="Por cobrar al día" value={clp(stats.pending)} sub={`${stats.pendingN} facturas · IVA incl.`} icon={<Clock size={15} />} />
        <Stat label="Vencido" value={<span className={stats.overdue ? 'neg' : ''}>{clp(stats.overdue)}</span>} sub={`${stats.overdueN} facturas`} icon={<AlertTriangle size={15} />} tone="red" />
        <Stat label="Cobrado últimos 30 días" value={clp(stats.paid30)} icon={<CheckCircle2 size={15} />} tone="green" />
      </div>

      {aging.length > 0 && (
        <div className="card mt table-wrap">
          <div className="toolbar">
            <b>Antigüedad de deuda por cliente</b>
            <span className="small faint">Montos con IVA</span>
          </div>
          <div className="table-wrap"><table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="right">Al día</th>
                <th className="right">1–30 días</th>
                <th className="right">31–60 días</th>
                <th className="right">+60 días</th>
                <th className="right">Total</th>
              </tr>
            </thead>
            <tbody>
              {aging.map((a) => (
                <tr key={a.name}>
                  <td className="cell-title">{a.name}</td>
                  <td className="right tnum">{a.current ? clp(a.current) : '—'}</td>
                  <td className="right tnum" style={a.d30 ? { color: 'var(--amber)' } : undefined}>{a.d30 ? clp(a.d30) : '—'}</td>
                  <td className={`right tnum ${a.d60 ? 'neg' : ''}`}>{a.d60 ? clp(a.d60) : '—'}</td>
                  <td className={`right tnum ${a.d60p ? 'neg strong' : ''}`}>{a.d60p ? clp(a.d60p) : '—'}</td>
                  <td className="right tnum strong">{clp(a.total)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      <div className="card mt">
        <div className="toolbar">
          <Segmented
            value={tab}
            onChange={changeTab}
            options={[
              { value: 'por_facturar', label: `Por facturar (${stats.toInvoiceN})` },
              { value: 'por_cobrar', label: `Por cobrar (${stats.pendingN + stats.overdueN})` },
              { value: 'pagadas', label: 'Pagadas' },
            ]}
          />
          <span className="spacer" />
          <div className="search">
            <Search size={15} />
            <input className="input" placeholder="Buscar factura, viaje o cliente" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="toolbar" style={{ paddingTop: 10, paddingBottom: 10 }}>
          <span className="small muted">Ordenar por</span>
          <div style={{ width: 170 }}>
            <Select value={sort.key} onChange={(k) => setSort({ key: k, dir: sort.dir })} options={sortOptions} />
          </div>
          <button className="btn sm" onClick={() => setSort({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })} title="Invertir orden">
            {sort.dir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />} {dirLabel}
          </button>
          <span className="spacer" />
          <span className="small faint">{list.length} registros</span>
        </div>
        {list.length === 0 ? (
          <Empty icon={<ReceiptText size={26} />} title="Nada pendiente aquí" text="No hay registros en esta categoría." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <SortTh k="viaje">{tab === 'por_facturar' ? 'Viaje' : 'Factura / viaje'}</SortTh>
                  <SortTh k="cliente">Cliente</SortTh>
                  <SortTh k="fecha">{date1Label}</SortTh>
                  {tab !== 'por_facturar' && <SortTh k="fecha2">{date2Label}</SortTh>}
                  <SortTh k="monto" right>
                    Neto
                  </SortTh>
                  <th className="right">Total c/IVA</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.slice(0, 150).map(({ t, s }) => {
                  const late = t.invoice?.dueDate ? daysBetween(t.invoice.dueDate, today()) : 0;
                  return (
                    <tr key={t.id} id={`inv-${t.id}`} className={flash === t.id ? 'flash' : ''}>
                      <td>
                        <div className="cell-title">{tab === 'por_facturar' ? t.code : `N° ${t.invoice?.number}`}</div>
                        <div className="cell-sub">
                          {tab !== 'por_facturar' && `${t.code} · `}
                          {t.origin} → {t.destination}
                        </div>
                      </td>
                      <td>{L.client.get(t.clientId)?.name}</td>
                      <td className="nowrap">{fmtDate(tab === 'por_facturar' ? t.date : t.invoice?.issueDate)}</td>
                      {tab !== 'por_facturar' && (
                        <td className="nowrap">
                          {fmtDate(tab === 'pagadas' ? t.invoice?.paidDate : t.invoice?.dueDate)}
                          {s === 'vencida' && <div className="cell-sub neg">{late} días de atraso</div>}
                          {s === 'pendiente' && <div className="cell-sub">en {-late} días</div>}
                        </td>
                      )}
                      <td className="right tnum">{clp(t.price)}</td>
                      <td className="right tnum strong">{clp(gross(t.price))}</td>
                      <td>
                        <StatusBadge status={s} label={STATE_LABEL[s]} />
                      </td>
                      <td className="right">
                        {s === 'por_facturar' && (
                          <button className="btn sm primary" onClick={() => setIssue(t)}>
                            Emitir factura
                          </button>
                        )}
                        {(s === 'pendiente' || s === 'vencida') && (
                          <button className="btn sm" onClick={() => setPay(t)}>
                            Registrar pago
                          </button>
                        )}
                        {s === 'pagada' && (
                          <button
                            className="btn sm ghost"
                            onClick={() => {
                              const next = { ...t, invoice: { ...t.invoice!, paid: false, paidDate: undefined } };
                              commit(t, next, `Pago anulado · Factura N° ${t.invoice?.number}`, <>La factura de {L.client.get(t.clientId)?.name} vuelve a estar pendiente de pago.</>);
                            }}
                          >
                            Anular pago
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {list.length > 150 && <div className="small faint" style={{ padding: 14, textAlign: 'center' }}>Mostrando 150 de {list.length}. Usa la búsqueda para encontrar otros registros.</div>}
          </div>
        )}
      </div>
      <IssueModal
        trip={issue}
        onClose={() => setIssue(null)}
        onDone={(prev, next) =>
          commit(prev, next, `Factura N° ${next.invoice?.number} emitida`, (
            <>
              Viaje {next.code} · {L.client.get(next.clientId)?.name} por {clp(gross(next.price))} (IVA incl.). Vence el <em>{fmtDate(next.invoice?.dueDate)}</em>.
            </>
          ))
        }
      />
      <PayModal
        trip={pay}
        onClose={() => setPay(null)}
        onDone={(prev, next) =>
          commit(prev, next, `Pago registrado · Factura N° ${next.invoice?.number}`, (
            <>
              {clp(gross(next.price))} de {L.client.get(next.clientId)?.name}, pagado el <em>{fmtDate(next.invoice?.paidDate)}</em>.
            </>
          ))
        }
      />
    </>
  );
}

function IssueModal({ trip, onClose, onDone }: { trip: Trip | null; onClose: () => void; onDone: (prev: Trip, next: Trip) => void }) {
  const { db } = useStore();
  const L = useLookups();
  const nextNo = String(Math.max(1000, ...db.trips.map((t) => parseInt(t.invoice?.number ?? '0', 10) || 0)) + 1);
  const [num, setNum] = useState('');
  const [date, setDate] = useState(today());
  if (!trip) return null;
  const client = L.client.get(trip.clientId);
  const due = dueInDays(client, date);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Emitir factura · ${trip.code}`}
      width={480}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn primary"
            onClick={() => {
              onDone(trip, { ...trip, invoice: { number: num || nextNo, issueDate: date, dueDate: due, paid: false } });
              setNum('');
              onClose();
            }}
          >
            Registrar factura
          </button>
        </>
      }
    >
      <p className="muted small" style={{ marginTop: 0 }}>
        {client?.name} · {trip.origin} → {trip.destination} · Neto {clp(trip.price)}
      </p>
      <div className="form-grid">
        <Field label="N° de factura" hint={`Sugerido: ${nextNo}`}>
          <TextInput value={num} onChange={setNum} placeholder={nextNo} />
        </Field>
        <Field label="Fecha de emisión" hint={`Vence el ${fmtDate(due)} (${client?.paymentTermsDays ?? 30} días)`}>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function PayModal({ trip, onClose, onDone }: { trip: Trip | null; onClose: () => void; onDone: (prev: Trip, next: Trip) => void }) {
  const [date, setDate] = useState(today());
  if (!trip) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Registrar pago · Factura N° ${trip.invoice?.number}`}
      width={420}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn primary"
            onClick={() => {
              onDone(trip, { ...trip, invoice: { ...trip.invoice!, paid: true, paidDate: date } });
              onClose();
            }}
          >
            Confirmar pago
          </button>
        </>
      }
    >
      <Field label="Fecha de pago">
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
    </Modal>
  );
}
