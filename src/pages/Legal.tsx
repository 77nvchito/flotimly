import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../components/ui';
import { SiteFooter } from '../components/SiteFooter';
import { LEGAL } from '../config';
import { LEGAL_DOCS, legalDoc } from '../legal/documents';
import { useStore } from '../store/store';

/** /legal/:slug — Términos, Privacidad, Tratamiento de datos y Cookies. Accesible con o sin sesión. */
export default function Legal() {
  const { slug } = useParams();
  const { user } = useStore();
  const doc = legalDoc(slug);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (doc) document.title = `${doc.title} · Flotimly`;
    return () => {
      document.title = 'Flotimly';
    };
  }, [doc]);

  if (!doc) return <Navigate to="/legal/terminos" replace />;

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap row">
          <Link to="/" aria-label="Ir a la portada">
            <Logo />
          </Link>
          <div className="grow" />
          <Link className="btn ghost" to="/">
            <ArrowLeft size={16} /> {user ? 'Volver a la app' : 'Volver a la portada'}
          </Link>
        </div>
      </header>

      <div className="lp-wrap legal">
        <nav className="legal-nav" aria-label="Documentos legales">
          {LEGAL_DOCS.map((d) => (
            <Link key={d.slug} to={`/legal/${d.slug}`} className={d.slug === doc.slug ? 'active' : ''}>
              {d.title}
            </Link>
          ))}
        </nav>

        <article className="legal-doc">
          <h1>{doc.title}</h1>
          <p className="legal-summary">{doc.summary}</p>
          <p className="legal-date">Última actualización: {LEGAL.updated}</p>
          {doc.sections.map((s) => (
            <section key={s.h}>
              <h2>{s.h}</h2>
              {s.body.map((b, i) =>
                typeof b === 'string' ? (
                  <p key={i}>{b}</p>
                ) : (
                  <ul key={i}>
                    {b.list.map((li) => (
                      <li key={li}>{li}</li>
                    ))}
                  </ul>
                ),
              )}
            </section>
          ))}
        </article>
      </div>

      <SiteFooter />
    </div>
  );
}
