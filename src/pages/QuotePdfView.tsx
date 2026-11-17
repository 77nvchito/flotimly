import { useEffect, useState } from 'react';
import { track } from '../lib/analytics';
import { useParams } from 'react-router-dom';
import { pdf } from '@react-pdf/renderer';
import { Download, Loader2 } from 'lucide-react';
import { useLookups, useStore } from '../store/store';
import { calcQuote } from '../lib/calc';
import { QuotePdf, quoteNumber } from '../pdf/QuotePdf';

/** Muestra la cotización como PDF real (sin abrir el diálogo de impresión). */
export default function QuotePdfView() {
  const { id } = useParams();
  const { db } = useStore();
  const L = useLookups();
  const q = db.quotes.find((x) => x.id === id);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  const client = q ? L.client.get(q.clientId) : undefined;
  const fileName = q ? `Cotizacion-${quoteNumber(q.code)}${client ? '-' + client.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/-+$/, '') : ''}.pdf` : 'cotizacion.pdf';

  useEffect(() => {
    if (!q) return;
    let revoked = false;
    let objectUrl = '';
    document.title = fileName.replace(/\.pdf$/, '').replace(/-/g, ' ');
    const st = db.settings;
    pdf(
      <QuotePdf
        quote={q}
        calc={calcQuote(q, db.tariffs, st.params.ivaPct)}
        company={st.company}
        bank={st.bank}
        client={client}
        vehicle={q.vehicleId ? L.vehicle.get(q.vehicleId) : undefined}
        ivaPct={st.params.ivaPct}
        conditions={q.conditions ?? st.quoteConditions}
      />,
    )
      .toBlob()
      .then((blob) => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        track('quote_pdf_opened');
      })
      .catch((e) => setError(String(e?.message ?? e)));
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.id]);

  if (!q) return <div style={{ padding: 40 }}>Cotización no encontrada.</div>;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#525659' }}>
      <div className="row" style={{ justifyContent: 'space-between', padding: '8px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <span className="small strong">{fileName}</span>
        {url && (
          <a className="btn sm primary" href={url} download={fileName}>
            <Download size={14} /> Descargar PDF
          </a>
        )}
      </div>
      {error ? (
        <div style={{ padding: 40, color: '#fff' }}>No se pudo generar el PDF: {error}</div>
      ) : url ? (
        <iframe src={url} title={fileName} style={{ flex: 1, border: 'none', width: '100%' }} />
      ) : (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: '#fff' }}>
          <div className="row">
            <Loader2 size={18} className="spin" /> Generando PDF…
          </div>
        </div>
      )}
    </div>
  );
}
