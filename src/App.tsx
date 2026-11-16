import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from './store/store';
import { Layout } from './components/Layout';
import { PymeGate } from './components/PymeGate';
import Login from './pages/Login';
import Landing from './pages/Landing';
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

const QuotePdfView = lazy(() => import('./pages/QuotePdfView'));

export default function App() {
  const { user } = useStore();
  if (!user)
    return (
      <Routes>
        <Route index element={<Landing />} />
        <Route path="ingresar" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  return (
    <Routes>
      <Route path="/pdf/cotizacion/:id" element={<Suspense fallback={null}><QuotePdfView /></Suspense>} />
      <Route path="/imprimir/comprobante/:id" element={<PrintProof />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="flota" element={<Fleet />} />
        <Route path="operaciones" element={<Operations />} />
        <Route path="cotizaciones" element={<Quotes />} />
        <Route path="cotizaciones/:id" element={<QuoteEditor />} />
        <Route path="gastos" element={<Expenses />} />
        <Route path="rentabilidad" element={<Profitability />} />
        <Route path="configuracion" element={<SettingsPage />} />
        <Route path="planificacion" element={<PymeGate feature="planificacion"><Planning /></PymeGate>} />
        <Route path="facturas" element={<PymeGate feature="facturas"><Invoices /></PymeGate>} />
        <Route path="comprobantes" element={<PymeGate feature="comprobantes"><Proofs /></PymeGate>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
