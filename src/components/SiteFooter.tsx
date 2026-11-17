import { Link } from 'react-router-dom';
import { Logo } from './ui';
import { CONTACT, LEGAL, phoneDisplay, whatsappLink } from '../config';
import { LEGAL_DOCS } from '../legal/documents';
import { analyticsEnabled } from '../lib/analytics';
import { openConsent } from './ConsentBanner';

/** Pie de página de las páginas públicas (portada y documentos legales). */
export function SiteFooter() {
  const wa = whatsappLink('Hola, tengo una consulta sobre Flotimly.');
  const holder = [LEGAL.owner, LEGAL.rut && `RUT ${LEGAL.rut}`].filter(Boolean).join(' · ');
  return (
    <footer className="lp-foot">
      <div className="lp-wrap">
        <div className="lp-foot-top">
          <Logo size="sm" />
          <div className="lp-foot-contact">
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer">
                WhatsApp {phoneDisplay(CONTACT.whatsapp)}
              </a>
            )}
            {CONTACT.email && <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>}
          </div>
        </div>
        <nav className="lp-foot-legal" aria-label="Documentos legales">
          {LEGAL_DOCS.map((d) => (
            <Link key={d.slug} to={`/legal/${d.slug}`}>
              {d.title}
            </Link>
          ))}
          {analyticsEnabled && (
            <button type="button" className="lp-foot-link" onClick={openConsent}>
              Preferencias de cookies
            </button>
          )}
        </nav>
        <div className="lp-foot-copy">
          © {new Date().getFullYear()} {holder}. Todos los derechos reservados.
          {LEGAL.address && <> {LEGAL.address}.</>}
        </div>
      </div>
    </footer>
  );
}
