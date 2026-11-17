import type { ReactNode } from 'react';
import { Check, Crown } from 'lucide-react';
import { useEffect } from 'react';
import { useStore } from '../store/store';
import { track } from '../lib/analytics';

const FEATURES: Record<string, { title: string; text: string; items: string[] }> = {
  planificacion: {
    title: 'Planificación de fletes',
    text: 'Visualiza en un calendario todos los viajes programados, evita cruces de vehículos y conductores y reprograma arrastrando.',
    items: ['Calendario mensual de viajes', 'Reprogramación con arrastrar y soltar', 'Disponibilidad de flota por día', 'Alertas de cruces de agenda'],
  },
  facturas: {
    title: 'Facturas pendientes',
    text: 'Controla qué viajes faltan por facturar, qué facturas están por vencer y cuánto dinero tienes en la calle.',
    items: ['Viajes por facturar', 'Antigüedad de deuda por cliente', 'Registro de pagos', 'Alertas de facturas vencidas'],
  },
  comprobantes: {
    title: 'Comprobantes de entrega',
    text: 'Registra la recepción de cada carga con firma digital, fotos y observaciones. Descarga o imprime el comprobante.',
    items: ['Firma digital del receptor', 'Fotos de la entrega', 'Estado de la carga recibida', 'Comprobante imprimible / PDF'],
  },
};

export function PymeGate({ feature, children }: { feature: keyof typeof FEATURES; children: ReactNode }) {
  const { isPyme, setSettings } = useStore();
  useEffect(() => {
    if (!isPyme) track('upgrade_gate_viewed', { feature });
  }, [isPyme, feature]);
  if (isPyme) return <>{children}</>;
  const f = FEATURES[feature];
  return (
    <div className="card locked-hero">
      <div className="ico">
        <Crown size={34} />
      </div>
      <span className="plan-badge">Disponible en plan Pyme</span>
      <h2 style={{ marginTop: 12 }}>{f.title}</h2>
      <p className="muted" style={{ fontSize: 15 }}>
        {f.text}
      </p>
      <ul>
        {f.items.map((i) => (
          <li key={i}>
            <Check size={17} /> {i}
          </li>
        ))}
      </ul>
      <div>
        <button className="btn accent lg" onClick={() => setSettings((s) => ({ ...s, plan: 'pyme' }))}>
          <Crown size={17} /> Mejorar a plan Pyme
        </button>
      </div>
    </div>
  );
}
