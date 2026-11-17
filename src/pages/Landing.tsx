import { useEffect, type ReactNode } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  Calculator,
  FileSpreadsheet,
  Fuel,
  HandCoins,
  Headphones,
  MessageCircle,
  ReceiptText,
  Rocket,
  Route,
  ShieldCheck,
  Smartphone,
  Gift,
  Sparkles,
  Crown,
  TrendingUp,
  TriangleAlert,
  Unlock,
  Users,
  Truck,
} from 'lucide-react';
import { Logo } from '../components/ui';
import { SiteFooter } from '../components/SiteFooter';
import { useStore } from '../store/store';
import { whatsappLink } from '../config';
import { track } from '../lib/analytics';
import { PLAN_LIST, PROMO, RECOMMENDED, perDay, perVehicle, promoPrice, savingVsEntry, usersLabel, vehiclesLabel } from '../lib/plans';
import { clp } from '../lib/format';

const ENTRY = PLAN_LIST[0];

/** Problemas típicos de una empresa de transporte chica, y cómo los resuelve Flotimly. */
const PAINS = [
  {
    pain: 'Cotizas "al ojo" y después descubres que el viaje no dejó plata.',
    fix: 'El cotizador calcula diésel, peajes, conductor y desgaste con tus costos reales antes de dar el precio.',
  },
  {
    pain: 'Facturas que se olvidan y clientes que pagan cuando quieren.',
    fix: 'Ves qué falta por facturar, qué vence esta semana y quién está atrasado, en una sola pantalla.',
  },
  {
    pain: 'Una revisión técnica o un seguro vencido te deja un camión parado.',
    fix: 'Te avisa antes de que venzan la revisión técnica, el seguro, el permiso y las licencias.',
  },
  {
    pain: 'Trabajas todo el mes y no sabes qué camión o cliente te conviene.',
    fix: 'Rentabilidad por camión, por viaje y por cliente, para decidir con números y no por intuición.',
  },
];

/** Los tres beneficios principales para crecer. */
const PILLARS = [
  {
    icon: <Calculator size={22} />,
    title: 'Vende más',
    lead: 'Responde antes y con imagen de empresa grande.',
    items: [
      'Cotizaciones en 2 minutos, con tu logo y en PDF',
      'Precios calculados con tus costos reales',
      'Comprobantes de entrega con firma y fotos que dan confianza a clientes grandes',
    ],
  },
  {
    icon: <TrendingUp size={22} />,
    title: 'Gana más',
    lead: 'Saca tus números sin una planilla.',
    items: [
      'Utilidad y margen de cada camión, viaje y cliente',
      'Combustible, peajes y mantenciones ordenados por camión',
      'Resumen del mes comparado con el anterior',
    ],
  },
  {
    icon: <HandCoins size={22} />,
    title: 'Cobra a tiempo',
    lead: 'La plata que trabajaste, en tu cuenta.',
    items: [
      'Viajes por facturar y facturas por vencer',
      'Quién te debe, cuánto y desde cuándo',
      'Datos de transferencia en cada cotización',
    ],
  },
];

const FEATURES = [
  { icon: <BarChart3 size={20} />, title: 'Cuánto gana cada camión', text: 'Rentabilidad por camión, por viaje y por cliente. Sabe qué rutas y clientes te dejan plata y cuáles no.' },
  { icon: <Calculator size={20} />, title: 'Cotiza en 2 minutos', text: 'Calcula combustible, peajes, conductor y desgaste con tus costos reales, y envía una cotización con tu logo en PDF.' },
  { icon: <Fuel size={20} />, title: 'Gastos bajo control', text: 'Combustible, peajes, mantenciones, seguros y viáticos ordenados por camión y por mes, para saber en qué se va la plata.' },
  { icon: <BellRing size={20} />, title: 'Alertas de vencimientos', text: 'Revisión técnica, seguros, permisos y licencias de conducir: te avisa antes de que algo venza.' },
  { icon: <Route size={20} />, title: 'Historial de cada viaje', text: 'Cliente, ruta, conductor, carga y precio de cada flete, con el historial completo de cada vehículo.' },
  { icon: <CalendarDays size={20} />, title: 'Planificación semanal', text: 'Calendario de viajes por camión: arrastra y suelta para reprogramar y evita choques de agenda.', pyme: true },
  { icon: <ReceiptText size={20} />, title: 'Facturas por cobrar', text: 'Qué está por facturar, qué vence pronto y qué ya está atrasado. Nunca más una factura olvidada.', pyme: true },
  { icon: <ClipboardCheck size={20} />, title: 'Comprobantes de entrega', text: 'Firma y fotos de la entrega asociadas a cada viaje, listas para enviar a tu cliente.', pyme: true },
];

const TRUST = [
  { icon: <Smartphone size={16} />, text: 'En el celular y el computador' },
  { icon: <Users size={16} />, text: 'Usuarios ilimitados' },
  { icon: <Unlock size={16} />, text: 'Sin contrato de permanencia' },
  { icon: <Headphones size={16} />, text: 'Soporte por WhatsApp con personas' },
  { icon: <ShieldCheck size={16} />, text: 'Tus datos son tuyos' },
];

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: '¿Me sirve si tengo un solo camión?',
    a: `Sí. El plan ${ENTRY.name} está pensado para transportistas con 1 a ${ENTRY.maxVehicles} vehículos. Cuando tu flota crezca, te cambias de plan y no pierdes nada.`,
  },
  {
    q: '¿Tengo que instalar algo?',
    a: 'No. Flotimly funciona en el navegador del celular y del computador. Entras con tu correo y listo.',
  },
  {
    q: '¿Cuánto me demoro en empezar?',
    a: 'Puedes cargar tus camiones, conductores y clientes en una tarde, a mano o desde una planilla Excel. Si te complicas, te ayudamos por WhatsApp.',
  },
  {
    q: '¿Mis conductores también lo pueden usar?',
    a: 'Sí, y sin pagar más: todos los planes incluyen usuarios ilimitados. Cada persona tiene su rol: por ejemplo, el conductor ve los viajes y registra los comprobantes de entrega, sin acceso a la rentabilidad ni a las facturas.',
  },
  {
    q: '¿Emite facturas electrónicas?',
    a: 'No. Las facturas las sigues emitiendo en el SII o en tu sistema de siempre. En Flotimly registras cuáles emitiste y controlas cuáles te pagaron, cuáles vencen y cuáles están atrasadas.',
  },
  {
    q: '¿Hay contrato o permanencia mínima?',
    a: 'No. Pagas mes a mes y puedes cancelar cuando quieras. La cancelación rige al final del mes ya pagado.',
  },
  {
    q: '¿Qué pasa con mi información si me voy?',
    a: 'Es tuya. La descargas completa cuando quieras en Excel, incluidas firmas y fotos, y la puedes llevar a cualquier otro sistema.',
  },
];

export default function Landing() {
  const { login, user } = useStore();
  const nav = useNavigate();
  const { hash } = useLocation();

  // Al llegar desde la demo: ir a la sección pedida (por ejemplo #planes) o al inicio de la página.
  useEffect(() => {
    const target = hash ? document.getElementById(hash.slice(1)) : null;
    if (target) requestAnimationFrame(() => target.scrollIntoView());
    else window.scrollTo(0, 0);
  }, [hash]);
  const wa = whatsappLink('Hola, quiero agendar una demo de Flotimly para mi empresa de transporte.');

  // La sección de planes entra en pantalla (una vez por visita)
  useEffect(() => {
    const el = document.getElementById('planes');
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          track('pricing_viewed');
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const tryDemo = async (source: string) => {
    // Ya está dentro de la demo (vino desde ella a ver la portada): solo vuelve
    if (user) return nav('/');
    track('demo_started', { source });
    const r = await login('admin@flotimly.cl', 'demo');
    nav(r.ok ? '/' : '/ingresar');
  };

  const DemoBtn = ({ light, source }: { light?: boolean; source: string }) => (
    <button className={`btn lg ${light ? 'accent' : 'primary'}`} onClick={() => tryDemo(source)}>
      Probar la demo gratis <ArrowRight size={17} />
    </button>
  );
  const WaBtn = ({ light, location }: { light?: boolean; location: string }) =>
    wa ? (
      <a className={`btn lg ${light ? 'lp-ghost-light' : ''}`} href={wa} target="_blank" rel="noreferrer" onClick={() => track('whatsapp_clicked', { location })}>
        <MessageCircle size={17} /> Hablar por WhatsApp
      </a>
    ) : null;

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap row">
          <Logo />
          <nav className="lp-links">
            <a href="#beneficios">Beneficios</a>
            <a href="#funciones">Funciones</a>
            <a href="#planes">Planes</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <div className="grow" />
          {user ? (
            <Link className="btn ghost" to="/">
              Volver a la demo
            </Link>
          ) : (
            <Link className="btn ghost" to="/ingresar">
              Ingresar
            </Link>
          )}
          <button className="btn primary lp-hide-sm" onClick={() => tryDemo('nav')}>
            Probar la demo
          </button>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-wrap">
          <div className="lp-hero-text">
            <span className="lp-kicker">
              <Truck size={14} /> Para transportistas y pymes de transporte de carga en Chile
            </span>
            <h1>Haz crecer tu empresa de transporte con números claros</h1>
            <p>
              Cotiza en minutos, sabe cuánto te deja cada camión y cobra a tiempo. Deja el Excel, el cuaderno y los
              mensajes sueltos: todo tu negocio en un solo lugar, también desde el celular.
            </p>
            <div className="lp-ctas">
              <DemoBtn light source="hero" />
              <WaBtn light location="hero" />
            </div>
            <a className="lp-offer" href="#planes">
              <Gift size={15} /> <b>{PROMO.trialDays} días gratis</b> y luego <b>{PROMO.discount * 100}% de descuento por {PROMO.months} meses</b> · {PROMO.spots}
            </a>
            <small>
              Desde {clp(ENTRY.price)} + IVA al mes · sin tarjeta de crédito · sin instalar nada
            </small>
          </div>
          <div className="lp-shot">
            <img src="/landing/inicio.jpg" alt="Panel de inicio de Flotimly con ventas, gastos, utilidad y cuentas por cobrar del mes" width={1920} height={1200} />
          </div>
        </div>
      </section>

      <div className="lp-trust">
        <div className="lp-wrap">
          {TRUST.map((t) => (
            <span key={t.text}>
              {t.icon} {t.text}
            </span>
          ))}
        </div>
      </div>

      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>¿Te suena alguno de estos problemas?</h2>
            <p>Son los que más le cuestan plata a una empresa de transporte chica. Flotimly los resuelve desde el primer día.</p>
          </div>
          <div className="lp-pains">
            {PAINS.map((p) => (
              <div className="lp-pain" key={p.pain}>
                <div className="lp-pain-q">
                  <TriangleAlert size={18} /> {p.pain}
                </div>
                <div className="lp-pain-a">
                  <BadgeCheck size={18} /> {p.fix}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section alt" id="beneficios">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>Todo lo que necesitas para crecer, sin contratar a nadie más</h2>
            <p>Flotimly hace el trabajo de oficina que hoy te quita las tardes, para que te dediques a conseguir más clientes.</p>
          </div>
          <div className="lp-pillars">
            {PILLARS.map((p) => (
              <div className="lp-pillar" key={p.title}>
                <div className="lp-ico lg">{p.icon}</div>
                <h3>{p.title}</h3>
                <p className="lp-pillar-lead">{p.lead}</p>
                <ul>
                  {p.items.map((i) => (
                    <li key={i}>
                      <Check size={16} /> {i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" id="funciones">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>Hecho para el transporte en Chile</h2>
            <p>Pesos chilenos, IVA, RUT, patentes y rutas reales. Sin adaptar un sistema genérico.</p>
          </div>
          <div className="lp-grid">
            {FEATURES.map((f) => (
              <div className="lp-card" key={f.title}>
                <div className="lp-ico">{f.icon}</div>
                <h3>
                  {f.title} {f.pyme && <span className="badge blue plain">Plan Pyme</span>}
                </h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section alt">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>Empieza hoy, en 3 pasos</h2>
          </div>
          <ol className="lp-steps">
            <li>
              <span>1</span>
              <h3>Prueba la demo</h3>
              <p>Recorre una empresa de ejemplo con camiones, viajes y números reales. Sin registrarte.</p>
            </li>
            <li>
              <span>2</span>
              <h3>Carga tu empresa</h3>
              <p>Agrega tus camiones, conductores y clientes, o súbelos desde Excel. Te ayudamos por WhatsApp si lo necesitas.</p>
            </li>
            <li>
              <span>3</span>
              <h3>Cotiza y controla</h3>
              <p>Desde el primer día cotizas con tus costos reales y ves cuánto te deja cada viaje.</p>
            </li>
          </ol>
          <div className="lp-ctas center">
            <DemoBtn source="steps" />
          </div>
        </div>
      </section>

      <section className="lp-section" id="planes">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>Un plan que crece con tu flota</h2>
            <p>
              Empieza con un camión y súbete de plan cuando crezcas, sin perder nada. Todos los planes incluyen{' '}
              <b>usuarios ilimitados</b>: suma a tu equipo sin pagar más.
            </p>
          </div>
          <div className="lp-promo">
            <Sparkles size={18} />
            <div>
              <b>Oferta de lanzamiento:</b> prueba gratis por {PROMO.trialDays} días y luego paga solo el {100 - PROMO.discount * 100}% durante los primeros {PROMO.months} meses.
            </div>
            <span className="lp-spots">{PROMO.spots}</span>
          </div>
          <div className="lp-plans">
            {PLAN_LIST.map((p) => {
              const featured = p.key === RECOMMENDED;
              const premium = p.key === 'flota_plus';
              return (
                <div className={`lp-plan ${featured ? 'featured' : ''} ${premium ? 'premium' : ''}`} key={p.key}>
                  <div className="row" style={{ justifyContent: 'space-between', minHeight: 26 }}>
                    <h3>{p.name}</h3>
                    {featured && <span className="badge orange">La opción más inteligente</span>}
                    {premium && (
                      <span className="badge lp-premium-badge">
                        <Crown size={12} /> Premium
                      </span>
                    )}
                  </div>
                  <p className="muted">{p.tagline}</p>
                  <div className="lp-price">
                    {clp(p.price)} <small>+ IVA / mes</small>
                  </div>
                  <div className="lp-promo-price">
                    Primeros {PROMO.months} meses: <b>{clp(promoPrice(p))}</b> + IVA
                  </div>
                  <div className={`lp-per-vehicle ${featured ? 'best' : ''}`}>
                    {clp(perVehicle(p))} por vehículo al mes
                    {featured && <span>{Math.round(savingVsEntry(p) * 100)}% menos por vehículo que {ENTRY.name}</span>}
                  </div>
                  <div className="lp-limits">
                    <span>
                      <Truck size={16} /> <b>{vehiclesLabel(p)}</b>
                    </span>
                    <span>
                      <Users size={16} /> {usersLabel(p)}
                    </span>
                  </div>
                  <ul>
                    {p.includesPrevious && (
                      <li className="strong">
                        <Check size={16} /> Todo lo del plan {p.includesPrevious}
                      </li>
                    )}
                    {p.items.map((i) => (
                      <li key={i}>
                        <Check size={16} /> {i}
                      </li>
                    ))}
                  </ul>
                  {wa ? (
                    <a
                      className={`btn ${featured ? 'primary' : premium ? 'lp-ghost-light' : ''}`}
                      href={whatsappLink(`Hola, quiero empezar la prueba gratis de ${PROMO.trialDays} días del plan ${p.name} de Flotimly.`)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => track('whatsapp_clicked', { location: 'plan', plan: p.key })}
                    >
                      Empezar prueba gratis
                    </a>
                  ) : (
                    <button className={`btn ${featured ? 'primary' : ''}`} onClick={() => tryDemo(`plan_${p.key}`)}>
                      Probar la demo
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="lp-fine">
            Precios en pesos chilenos, más IVA, con factura. La prueba gratuita de {PROMO.trialDays} días no requiere tarjeta de crédito. El descuento
            de {PROMO.discount * 100}% aplica a los primeros {PROMO.months} meses pagados y está disponible por tiempo limitado. Costo por vehículo calculado con
            la capacidad máxima de cada plan. Sin contrato de permanencia.
          </p>
        </div>
      </section>

      <section className="lp-section alt">
        <div className="lp-wrap lp-split">
          <div>
            <h2>Se paga solo</h2>
            <p className="muted">
              Basta con no cobrar de menos un solo flete al mes, o evitar una multa por un documento vencido, para que
              Flotimly ya te haya ahorrado más de lo que cuesta.
            </p>
          </div>
          <div className="lp-roi">
            <div>
              <b>{clp(perDay(promoPrice(ENTRY)))}</b>
              <span>al día durante la oferta de lanzamiento</span>
            </div>
            <div>
              <b>{clp(perDay(ENTRY.price))}</b>
              <span>al día después, con el plan {ENTRY.name}</span>
            </div>
            <div>
              <b>0</b>
              <span>pesos por usuario adicional</span>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section" id="datos">
        <div className="lp-wrap lp-split">
          <div>
            <h2>Tus datos son tuyos</h2>
            <p className="muted">
              Carga tu información desde Excel cuando empiezas y descárgala completa cuando quieras, en formatos abiertos.
              Sin amarras: si algún día te vas, te llevas todo.
            </p>
          </div>
          <ul className="lp-checks">
            <li>
              <FileSpreadsheet size={18} /> Importa clientes, camiones, conductores, viajes y gastos desde una planilla.
            </li>
            <li>
              <FileSpreadsheet size={18} /> Exporta todo a Excel o a un paquete completo con firmas y fotos.
            </li>
            <li>
              <ShieldCheck size={18} /> Cada empresa ve solo su información, y cada usuario solo lo que su rol le permite.
            </li>
          </ul>
        </div>
      </section>

      <section className="lp-section alt" id="preguntas">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>Preguntas frecuentes</h2>
          </div>
          <div className="lp-faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q} <ChevronDown size={18} />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-cta">
        <div className="lp-wrap">
          <Rocket size={30} className="lp-cta-ico" />
          <h2>Tu próximo camión empieza con números claros</h2>
          <p>
            Prueba la demo ahora o empieza tu prueba gratis de {PROMO.trialDays} días con {PROMO.discount * 100}% de descuento los primeros{' '}
            {PROMO.months} meses. {PROMO.spots}.
          </p>
          <div className="lp-ctas center">
            <DemoBtn light source="cta" />
            <WaBtn light location="cta" />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
