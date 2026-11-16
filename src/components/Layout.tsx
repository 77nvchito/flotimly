import { NavLink, Outlet } from 'react-router-dom';
import {
  CalendarDays,
  ClipboardCheck,
  FileSpreadsheet,
  Home,
  Lock,
  LogOut,
  ReceiptText,
  Route,
  Settings,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import { Logo } from './ui';
import { useStore } from '../store/store';

const NAV = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/flota', label: 'Flota', icon: Truck },
  { to: '/operaciones', label: 'Operaciones', icon: Route },
  { to: '/cotizaciones', label: 'Cotizaciones', icon: FileSpreadsheet },
  { to: '/gastos', label: 'Gastos', icon: Wallet },
  { to: '/rentabilidad', label: 'Rentabilidad', icon: TrendingUp },
];

const PYME_NAV = [
  { to: '/planificacion', label: 'Planificación', icon: CalendarDays },
  { to: '/facturas', label: 'Facturas pendientes', icon: ReceiptText },
  { to: '/comprobantes', label: 'Comprobantes', icon: ClipboardCheck },
];

export function Layout() {
  const { isPyme, user, logout, db } = useStore();
  const initials = (user?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const company = db.settings.company;
  const brand = company.brandColor || 'var(--navy)';
  const companyInitials = company.name
    .replace(/\b(SpA|S\.A\.|Ltda\.?|EIRL)\b/gi, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="app">
      <aside className="sidebar">
        <NavLink to="/" end className="company-brand" title={company.name}>
          {company.logo ? (
            <img src={company.logo} alt={company.name} />
          ) : (
            <>
              <span className="company-mark" style={{ background: brand }}>
                {companyInitials}
              </span>
              <span className="company-name" style={{ color: brand }}>
                {company.name}
              </span>
            </>
          )}
        </NavLink>
        <nav className="nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} title={label}>
              <Icon size={18} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
          <div className="nav-section">
            Plan Pyme {!isPyme && <span className="plan-badge">Upgrade</span>}
          </div>
          {PYME_NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} title={label} className={({ isActive }) => `${isActive ? 'active' : ''} ${isPyme ? '' : 'locked'}`}>
              <Icon size={18} strokeWidth={2} />
              <span>{label}</span>
              {!isPyme && <Lock size={13} className="lock" />}
            </NavLink>
          ))}
          <div className="nav-section">Sistema</div>
          <NavLink to="/configuracion" title="Configuración">
            <Settings size={18} strokeWidth={2} />
            <span>Configuración</span>
          </NavLink>
        </nav>
        <div className="powered" title="Flotimly · By Immtechnology">
          <Logo size="sm" />
        </div>
        <div className="sidebar-foot">
          <div className="avatar">{initials}</div>
          <div className="who">
            <b>{user?.name}</b>
            <span>{db.settings.company.name}</span>
            <div style={{ marginTop: 3 }}>
              <span className="plan-badge">Plan {isPyme ? 'Pyme' : 'Emprendedor'}</span>
            </div>
          </div>
          <button className="icon-btn" onClick={logout} title="Cerrar sesión">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="content">
          <div className="demo-banner">
            <b>Versión demo.</b> Los datos se guardan sólo en este navegador: no ingreses información real de tu empresa.
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
