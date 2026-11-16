import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  BarChart3,
  CalendarDays,
  Check,
  ClipboardCheck,
  Calculator,
  FileSpreadsheet,
  Fuel,
  MessageCircle,
  ReceiptText,
  Route,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { Logo } from '../components/ui';
import { useStore } from '../store/store';
import { CONTACT, whatsappLink } from '../config';

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

const PLANS = [
  {
    name: 'Emprendedor',
    for: 'Para transportistas que parten o tienen pocos vehículos.',
    items: ['Panel de inicio y resumen ejecutivo', 'Flota y conductores', 'Operaciones e historial por camión', 'Cotizaciones con cálculo de costos', 'Gastos', 'Rentabilidad por camión, viaje y cliente', 'Usuarios, parámetros y tarifas'],
  },
  {
    name: 'Pyme',
    for: 'Para empresas que coordinan varios camiones y clientes a la vez.',
    featured: true,
    items: ['Todo lo del plan Emprendedor', 'Planificación con calendario', 'Facturas pendientes y cobranza', 'Comprobantes de entrega con firma y fotos'],
  },
];

export default function Landing() {
  const { login } = useStore();
  const nav = useNavigate();
  const wa = whatsappLink('Hola, quiero agendar una demo de Flotimly para mi empresa de transporte.');

  const tryDemo = () => {
    if (login('admin@flotimly.cl', 'demo')) nav('/');
    else nav('/ingresar');
  };

  const DemoBtn = ({ light }: { light?: boolean }) => (
    <button className={`btn lg ${light ? 'accent' : 'primary'}`} onClick={tryDemo}>
      Probar la demo <ArrowRight size={17} />
    </button>
  );
  const WaBtn = ({ light }: { light?: boolean }) =>
    wa ? (
      <a className={`btn lg ${light ? 'lp-ghost-light' : ''}`} href={wa} target="_blank" rel="noreferrer">
        <MessageCircle size={17} /> Agendar una demo
      </a>
    ) : null;

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap row">
          <Logo />
          <nav className="lp-links">
            <a href="#funciones">Funciones</a>
            <a href="#planes">Planes</a>
            <a href="#datos">Tus datos</a>
          </nav>
          <div className="grow" />
          <Link className="btn ghost" to="/ingresar">
            Ingresar
          </Link>
          <button className="btn primary lp-hide-sm" onClick={tryDemo}>
            Probar la demo
          </button>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-wrap">
          <div className="lp-hero-text">
            <span className="lp-kicker">
              <Truck size={14} /> Para empresas de transporte de carga en Chile
            </span>
            <h1>Tu flota bajo control. Cada viaje, cada peso.</h1>
            <p>
              Flotimly reúne tus camiones, conductores, viajes, cotizaciones, gastos y facturas en un solo lugar, y te
              muestra cuánto ganas realmente con cada camión, cada ruta y cada cliente.
            </p>
            <div className="lp-ctas">
              <DemoBtn light />
              <WaBtn light />
            </div>
            <small>Sin instalar nada · funciona en el navegador · datos de ejemplo listos para explorar</small>
          </div>
          <div className="lp-shot">
            <img src="/landing/inicio.jpg" alt="Panel de inicio de Flotimly con ventas, gastos, utilidad y cuentas por cobrar del mes" width={1920} height={1200} />
          </div>
        </div>
      </section>

      <section className="lp-section" id="funciones">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>Todo lo que tu operación necesita, sin planillas sueltas</h2>
            <p>Pensado para el día a día de una empresa de transporte: pesos chilenos, IVA, RUT y rutas reales.</p>
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

      <section className="lp-section alt" id="planes">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>Dos planes, según el tamaño de tu operación</h2>
            <p>Empieza con lo esencial y cámbiate de plan cuando lo necesites, sin perder nada.</p>
          </div>
          <div className="lp-plans">
            {PLANS.map((p) => (
              <div className={`lp-plan ${p.featured ? 'featured' : ''}`} key={p.name}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <h3>Plan {p.name}</h3>
                  {p.featured && <span className="badge orange">Más completo</span>}
                </div>
                <p className="muted">{p.for}</p>
                <div className="lp-price">Consultar precio</div>
                <ul>
                  {p.items.map((i) => (
                    <li key={i}>
                      <Check size={16} /> {i}
                    </li>
                  ))}
                </ul>
                {wa ? (
                  <a className={`btn ${p.featured ? 'primary' : ''}`} href={whatsappLink(`Hola, me interesa el plan ${p.name} de Flotimly.`)} target="_blank" rel="noreferrer">
                    Consultar por el plan {p.name}
                  </a>
                ) : (
                  <button className={`btn ${p.featured ? 'primary' : ''}`} onClick={tryDemo}>
                    Probar la demo
                  </button>
                )}
              </div>
            ))}
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
              <ShieldCheck size={18} /> Cada empresa ve solo su información.
            </li>
          </ul>
        </div>
      </section>

      <section className="lp-cta">
        <div className="lp-wrap">
          <h2>Mira tu operación con números claros</h2>
          <p>Explora la demo con una empresa de ejemplo: 6 vehículos, 6 meses de viajes, gastos y facturas.</p>
          <div className="lp-ctas center">
            <DemoBtn light />
            <WaBtn light />
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-wrap row wrap">
          <Logo size="sm" />
          <div className="grow" />
          {CONTACT.email && <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>}
          <span className="faint">© {new Date().getFullYear()} Immtechnology</span>
        </div>
      </footer>
    </div>
  );
}
