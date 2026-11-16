import { useParams } from 'react-router-dom';
import { Printer, X } from 'lucide-react';
import { useLookups, useStore } from '../store/store';
import { fmtDate, num } from '../lib/format';

function Bar() {
  return (
    <div className="print-bar">
      <button className="btn primary" onClick={() => window.print()}>
        <Printer size={15} /> Imprimir / Guardar PDF
      </button>
      <button className="btn" onClick={() => window.close()}>
        <X size={15} /> Cerrar
      </button>
    </div>
  );
}

function CompanyHead({ title, code }: { title: string; code: string }) {
  const { db } = useStore();
  const c = db.settings.company;
  const brand = c.brandColor || 'var(--navy)';
  return (
    <div className="doc-head" style={{ borderBottomColor: brand }}>
      <div>
        {c.logo ? (
          <img src={c.logo} alt={c.name} style={{ maxHeight: 58, maxWidth: 200, objectFit: 'contain' }} />
        ) : (
          <div style={{ fontSize: 22, fontWeight: 700, color: brand }}>{c.name}</div>
        )}
        <div style={{ marginTop: 14 }}>
          <b>{c.name}</b>
          <div className="small muted">RUT {c.rut} · {c.giro}</div>
          <div className="small muted">{c.address}</div>
          <div className="small muted">
            {c.phone} · {c.email}
          </div>
        </div>
      </div>
      <div className="doc-title">
        <h1 style={{ color: brand }}>{title}</h1>
        <div className="code">{code}</div>
      </div>
    </div>
  );
}

export function PrintProof() {
  const { id } = useParams();
  const { db } = useStore();
  const L = useLookups();
  const p = db.proofs.find((x) => x.id === id);
  if (!p) return <div className="doc-page">Comprobante no encontrado.</div>;
  const t = L.trip.get(p.tripId);
  const client = t ? L.client.get(t.clientId) : undefined;
  const v = t ? L.vehicle.get(t.vehicleId) : undefined;
  const d = t ? L.driver.get(t.driverId) : undefined;
  return (
    <>
      <Bar />
      <div className="doc-page">
        <CompanyHead title="Comprobante de entrega" code={p.code} />
        <div className="doc-cols">
          <div className="doc-box">
            <h4>Cliente</h4>
            <p><b>{client?.name}</b></p>
            <p>RUT {client?.rut}</p>
            <p>{client?.address}</p>
          </div>
          <div className="doc-box">
            <h4>Entrega</h4>
            <p>Fecha: <b>{fmtDate(p.date)}</b> · {p.time} hrs</p>
            <p>Viaje: {t?.code}</p>
            <p>Estado: <b>{p.condition}</b></p>
          </div>
        </div>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Origen</th>
              <th>Destino</th>
              <th>Carga</th>
              <th className="right">Peso</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{t?.origin}</td>
              <td>{t?.destination}</td>
              <td>{t?.cargo}</td>
              <td className="right">{num(t?.weightKg ?? 0)} kg</td>
            </tr>
          </tbody>
        </table>
        <div className="doc-cols">
          <div className="doc-box">
            <h4>Transporte</h4>
            <p>Vehículo: {v?.plate} · {v?.brand} {v?.model}</p>
            <p>Conductor: {d?.name} · RUT {d?.rut}</p>
          </div>
          <div className="doc-box">
            <h4>Observaciones</h4>
            <p>{p.observations || 'Sin observaciones.'}</p>
          </div>
        </div>
        {p.photos.length > 0 && (
          <div className="doc-box">
            <h4>Registro fotográfico</h4>
            <div className="doc-photos">
              {p.photos.map((ph, i) => (
                <img key={i} src={ph} alt={`Foto ${i + 1}`} />
              ))}
            </div>
          </div>
        )}
        <div className="doc-sign">
          <div>
            <div style={{ height: 90 }} />
            <div className="line">
              {d?.name}
              <div className="small muted">Conductor</div>
            </div>
          </div>
          <div>
            {p.signature ? <img src={p.signature} alt="Firma receptor" /> : <div style={{ height: 90 }} />}
            <div className="line">
              {p.receiverName} · RUT {p.receiverRut}
              <div className="small muted">Recibí conforme</div>
            </div>
          </div>
        </div>
        <div className="doc-foot">
          <span>{db.settings.company.name}</span>
          <span>{[db.settings.company.phone, db.settings.company.email].filter(Boolean).join(' · ')}</span>
        </div>
      </div>
    </>
  );
}
