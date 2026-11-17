import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from './store/store';
import { Layout } from './components/Layout';
import { PymeGate } from './components/PymeGate';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Legal from './pages/Legal';
import Dashboard from './pages/Dashboard';
import Fleet from './pages/Fleet';
import Operations from './pages/Operations';
import Quotes from './pages/Quotes';
import QuoteEditor from './pages/QuoteEditor';
import Expenses from './pages/Expenses';
import Profitability from './pages/Profitability';
import SettingsPage from './pages/Settings';
import Planning from './pages/Planning';
import Invoices from './pages/Invoices';
import Proofs from './pages/Proofs';
import { PrintProof } from './pages/Print';
import { canView, homePath, type Module } from './lib/permissions';
import type { ReactNode } from 'react';

/** Bloquea por URL los módulos que el rol no puede ver (no basta con ocultarlos del menú). */
function Allow({ module, children }: { module: Module; children: ReactNode }) {
  const { user } = useStore();
  return canView(user?.role, module) ? <>{children}</> : <Navigate to={homePath(user?.role)} replace />;
}

const QuotePdfView = lazy(() => import('./pages/QuotePdfView'));

export default function App() {
  const { user } = useStore();
  if (!user)
    return (
      <Routes>
        <Route index element={<Landing />} />
        <Route path="ingresar" element={<Login />} />
        <Route path="legal/:slug" element={<Legal />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  return (
    <Routes>
      <Route path="/pdf/cotizacion/:id" element={<Allow module="cotizaciones"><Suspense fallback={null}><QuotePdfView /></Suspense></Allow>} />
      <Route path="/imprimir/comprobante/:id" element={<Allow module="comprobantes"><PrintProof /></Allow>} />
      <Route path="/legal/:slug" element={<Legal />} />
      {/* La portada sigue disponible con la sesión abierta, para quien prueba la demo */}
      <Route path="/portada" element={<Landing />} />
      <Route element={<Layout />}>
        <Route index element={<Allow module="inicio"><Dashboard /></Allow>} />
        <Route path="flota" element={<Allow module="flota"><Fleet /></Allow>} />
        <Route path="operaciones" element={<Allow module="operaciones"><Operations /></Allow>} />
        <Route path="cotizaciones" element={<Allow module="cotizaciones"><Quotes /></Allow>} />
        <Route path="cotizaciones/:id" element={<Allow module="cotizaciones"><QuoteEditor /></Allow>} />
        <Route path="gastos" element={<Allow module="gastos"><Expenses /></Allow>} />
        <Route path="rentabilidad" element={<Allow module="rentabilidad"><Profitability /></Allow>} />
        <Route path="configuracion" element={<Allow module="configuracion"><SettingsPage /></Allow>} />
        <Route path="planificacion" element={<Allow module="planificacion"><PymeGate feature="planificacion"><Planning /></PymeGate></Allow>} />
        <Route path="facturas" element={<Allow module="facturas"><PymeGate feature="facturas"><Invoices /></PymeGate></Allow>} />
        <Route path="comprobantes" element={<Allow module="comprobantes"><PymeGate feature="comprobantes"><Proofs /></PymeGate></Allow>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
