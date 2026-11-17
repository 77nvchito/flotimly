import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { analyticsEnabled, getConsent, setConsent } from '../lib/analytics';

export const OPEN_CONSENT_EVENT = 'flotimly:open-consent';
export const openConsent = () => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));

/**
 * Aviso de medición. Mientras la persona no elige, la medición funciona sin cookies (anónima y sin grabar sesiones).
 * Solo aparece si la medición está activada (VITE_POSTHOG_KEY).
 */
export function ConsentBanner() {
  const [open, setOpen] = useState(() => analyticsEnabled && getConsent() === 'pending');
  const { pathname } = useLocation();

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_CONSENT_EVENT, show);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, show);
  }, []);

  if (!analyticsEnabled || !open || /^\/(pdf|imprimir)\//.test(pathname)) return null;

  const choose = (c: 'granted' | 'denied') => {
    setConsent(c);
    setOpen(false);
  };

  return (
    <div className="consent" role="dialog" aria-live="polite" aria-label="Preferencias de medición">
      <p>
        Usamos herramientas de medición para entender cómo se usa Flotimly y mejorarlo. Si aceptas, guardamos un
        identificador en tu navegador. Si no, medimos de forma anónima y sin cookies.{' '}
        <Link to="/legal/cookies">Más información</Link>
      </p>
      <div className="consent-actions">
        <button className="btn" onClick={() => choose('denied')}>
          Solo lo necesario
        </button>
        <button className="btn primary" onClick={() => choose('granted')}>
          Aceptar
        </button>
      </div>
    </div>
  );
}
