import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ClipboardCheck, Eraser, Plus, Printer, Search, Trash2, X } from 'lucide-react';
import { Empty, Field, Modal, PageHeader, Select, Stat, StatusBadge, TextInput, confirmDelete } from '../components/ui';
import { useLookups, useStore } from '../store/store';
import type { DeliveryProof, ProofCondition } from '../store/types';
import { addDays, fmtDate, nextCode, today, uid } from '../lib/format';
import { imageProblem } from '../lib/validate';

export default function Proofs() {
  const { db } = useStore();
  const L = useLookups();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<DeliveryProof | null>(null);

  const list = useMemo(
    () =>
      db.proofs
        .filter((p) => {
          const t = L.trip.get(p.tripId);
          return `${p.code} ${p.receiverName} ${t?.code ?? ''} ${t?.destination ?? ''} ${L.client.get(t?.clientId ?? '')?.name ?? ''}`.toLowerCase().includes(q.toLowerCase());
        })
        .sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code)),
    [db.proofs, q, L],
  );

  const proofTrips = new Set(db.proofs.map((p) => p.tripId));
  const pendingProof = db.trips.filter((t) => (t.status === 'Completado' || t.status === 'En curso') && !proofTrips.has(t.id) && t.date >= addDays(today(), -14)).length;

  return (
    <>
      <PageHeader
        title="Comprobantes de entrega"
        subtitle="Registra la recepción de cada carga con firma, fotos y observaciones"
        actions={
          <button className="btn primary" onClick={() => setEdit(blankProof())}>
            <Plus size={16} /> Nuevo comprobante
          </button>
        }
      />
      <div className="grid k3">
        <Stat label="Comprobantes emitidos" value={db.proofs.length} icon={<ClipboardCheck size={15} />} tone="green" />
        <Stat label="Con observaciones / rechazos" value={db.proofs.filter((p) => p.condition !== 'Conforme').length} tone="orange" icon={<ClipboardCheck size={15} />} />
        <Stat label="Viajes recientes sin comprobante" value={pendingProof} sub="Últimos 14 días" tone="red" icon={<ClipboardCheck size={15} />} />
      </div>
      <div className="card mt">
        <div className="toolbar">
          <div className="search">
            <Search size={15} />
            <input className="input" placeholder="Buscar comprobante, receptor, cliente" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {list.length === 0 ? (
          <Empty icon={<ClipboardCheck size={26} />} title="Sin comprobantes" text="Crea un comprobante al entregar la carga al cliente." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Comprobante</th>
                  <th>Fecha</th>
                  <th>Viaje</th>
                  <th>Cliente</th>
                  <th>Recibido por</th>
                  <th>Estado carga</th>
                  <th>Firma</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const t = L.trip.get(p.tripId);
                  return (
                    <tr key={p.id} className="click" onClick={() => setEdit(p)}>
                      <td className="cell-title">{p.code}</td>
                      <td className="nowrap">
                        {fmtDate(p.date)} <span className="faint small">{p.time}</span>
                      </td>
                      <td>
                        {t?.code ?? '—'}
                        <div className="cell-sub">{t && `${t.origin} → ${t.destination}`}</div>
                      </td>
                      <td>{L.client.get(t?.clientId ?? '')?.name}</td>
                      <td>
                        {p.receiverName}
                        <div className="cell-sub">{p.receiverRut}</div>
                      </td>
                      <td>
                        <StatusBadge status={p.condition} />
                      </td>
                      <td>{p.signature ? <img src={p.signature} alt="Firma" style={{ height: 28 }} /> : <span className="faint small">Sin firma</span>}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button className="icon-btn" title="Imprimir" onClick={() => window.open(`/imprimir/comprobante/${p.id}`, '_blank')}>
                          <Printer size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ProofModal proof={edit} onClose={() => setEdit(null)} />
    </>
  );
}

const blankProof = (): DeliveryProof => ({
  id: '',
  code: '',
  tripId: '',
  date: today(),
  time: new Date().toTimeString().slice(0, 5),
  receiverName: '',
  receiverRut: '',
  condition: 'Conforme',
  photos: [],
});

function ProofModal({ proof, onClose }: { proof: DeliveryProof | null; onClose: () => void }) {
  const { db, upsert, remove } = useStore();
  const L = useLookups();
  const [f, setF] = useState<DeliveryProof>(blankProof());
  const [markDone, setMarkDone] = useState(true);
  useEffect(() => {
    if (proof) setF(proof);
  }, [proof]);
  const set = <K extends keyof DeliveryProof>(k: K) => (v: DeliveryProof[K]) => setF((p) => ({ ...p, [k]: v }));
  const isNew = !proof?.id;

  const trips = useMemo(
    () => db.trips.filter((t) => (t.status !== 'Cancelado' && t.status !== 'Planificado') || t.id === f.tripId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100),
    [db.trips, f.tripId],
  );
  const trip = L.trip.get(f.tripId);
  const valid = f.tripId && f.receiverName.trim();

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const out: string[] = [];
    const skipped: string[] = [];
    for (const file of Array.from(files).slice(0, 6 - f.photos.length)) {
      const problem = imageProblem(file, { anyPhoto: true });
      if (problem) {
        skipped.push(`${file.name}: ${problem}`);
        continue;
      }
      try {
        out.push(await compressImage(file));
      } catch {
        skipped.push(`${file.name}: no se pudo abrir.`);
      }
    }
    if (skipped.length) alert(`Algunas fotos no se agregaron:\n${skipped.join('\n')}`);
    setF((p) => ({ ...p, photos: [...p.photos, ...out] }));
  };

  return (
    <Modal
      open={!!proof}
      onClose={onClose}
      title={isNew ? 'Nuevo comprobante de entrega' : `Comprobante ${f.code}`}
      width={720}
      footer={
        <>
          {!isNew && (
            <>
              <button
                className="btn danger left"
                onClick={() => {
                  if (confirmDelete(`el comprobante ${f.code}`)) {
                    remove('proofs', f.id);
                    onClose();
                  }
                }}
              >
                <Trash2 size={15} />
              </button>
              <button className="btn" onClick={() => window.open(`/imprimir/comprobante/${f.id}`, '_blank')}>
                <Printer size={15} /> Imprimir
              </button>
            </>
          )}
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn primary"
            disabled={!valid}
            onClick={() => {
              const item = { ...f, id: f.id || uid(), code: f.code || nextCode('CE', db.proofs) };
              upsert('proofs', item);
              if (isNew && markDone && trip && trip.status !== 'Completado') upsert('trips', { ...trip, status: 'Completado' });
              onClose();
            }}
          >
            Guardar comprobante
          </button>
        </>
      }
    >
      <div className="form-grid c3">
        <Field label="Viaje *" className="full">
          <Select
            value={f.tripId}
            onChange={set('tripId')}
            placeholder="Selecciona el viaje entregado"
            options={trips.map((t) => ({ value: t.id, label: `${t.code} · ${fmtDate(t.date)} · ${t.origin} → ${t.destination} · ${L.client.get(t.clientId)?.name ?? ''} (${t.status})` }))}
          />
        </Field>
        {trip && (
          <div className="full small muted" style={{ marginTop: -6 }}>
            Carga: {trip.cargo || '—'} · {trip.weightKg.toLocaleString('es-CL')} kg · Vehículo {L.vehicle.get(trip.vehicleId)?.plate} · Conductor {L.driver.get(trip.driverId)?.name}
          </div>
        )}
        <Field label="Fecha">
          <input className="input" type="date" value={f.date} onChange={(e) => set('date')(e.target.value)} />
        </Field>
        <Field label="Hora">
          <input className="input" type="time" value={f.time} onChange={(e) => set('time')(e.target.value)} />
        </Field>
        <Field label="Estado de la carga">
          <Select value={f.condition} onChange={(v) => set('condition')(v as ProofCondition)} options={['Conforme', 'Con observaciones', 'Rechazado']} />
        </Field>
        <Field label="Nombre de quien recibe *" className="span2">
          <TextInput value={f.receiverName} onChange={set('receiverName')} />
        </Field>
        <Field label="RUT receptor">
          <TextInput value={f.receiverRut} onChange={set('receiverRut')} />
        </Field>
        <Field label="Observaciones" className="full">
          <textarea className="input" value={f.observations ?? ''} onChange={(e) => set('observations')(e.target.value)} placeholder="Daños, faltantes, comentarios del receptor…" />
        </Field>
        <div className="field full">
          <span>Firma del receptor</span>
          <SignaturePad value={f.signature} onChange={set('signature')} />
        </div>
        <div className="field full">
          <span>Fotos de la entrega ({f.photos.length}/6)</span>
          <div className="photos">
            {f.photos.map((p, i) => (
              <div className="photo" key={i}>
                <img src={p} alt={`Foto ${i + 1}`} />
                <button type="button" onClick={() => setF((x) => ({ ...x, photos: x.photos.filter((_, j) => j !== i) }))}>
                  <X size={12} />
                </button>
              </div>
            ))}
            {f.photos.length < 6 && (
              <label className="photo-add">
                <div>
                  <Camera size={20} />
                  <div>Agregar</div>
                </div>
                <input type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
              </label>
            )}
          </div>
        </div>
        {isNew && trip && trip.status !== 'Completado' && (
          <label className="check full">
            <input type="checkbox" checked={markDone} onChange={(e) => setMarkDone(e.target.checked)} /> Marcar el viaje {trip.code} como Completado
          </label>
        )}
      </div>
    </Modal>
  );
}

function SignaturePad({ value, onChange }: { value?: string; onChange: (v?: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(!!value);

  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1d2b4f';
    if (value) {
      const img = new Image();
      img.onload = () => {
        const w = c.offsetWidth;
        const h = c.offsetHeight;
        const s = Math.min(w / img.width, h / img.height);
        ctx.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
      };
      img.src = value;
    }
    setHasInk(!!value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div className="sigpad">
      <canvas
        ref={ref}
        onPointerDown={(e) => {
          drawing.current = true;
          last.current = pos(e);
          ref.current!.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current || !last.current) return;
          const ctx = ref.current!.getContext('2d')!;
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(last.current.x, last.current.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          last.current = p;
          if (!hasInk) setHasInk(true);
        }}
        onPointerUp={() => {
          drawing.current = false;
          last.current = null;
          onChange(ref.current!.toDataURL('image/png'));
        }}
      />
      {!hasInk && <div className="ph">Firme aquí con el mouse o el dedo</div>}
      {hasInk && (
        <button
          type="button"
          className="btn sm clear"
          onClick={() => {
            const c = ref.current!;
            c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
            setHasInk(false);
            onChange(undefined);
          }}
        >
          <Eraser size={13} /> Borrar
        </button>
      )}
    </div>
  );
}

/** Reduce la imagen a máx. 1000px y JPEG 70% para no saturar el almacenamiento local. */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const max = 1000;
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.7));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
