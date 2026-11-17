import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Logo } from '../components/ui';
import { useStore } from '../store/store';

export default function Login() {
  const { login } = useStore();
  const [email, setEmail] = useState('admin@flotimly.cl');
  const [password, setPassword] = useState('demo');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="login">
      <div className="login-hero">
        <Logo size="lg" light />
        <div>
          <h2>Tu flota bajo control. Cada viaje, cada peso.</h2>
          <p>
            Gestiona camiones, conductores, viajes, gastos y rentabilidad desde un solo lugar. Diseñado para empresas
            de transporte que quieren crecer con números claros.
          </p>
        </div>
        <div className="road" />
        <div className="small" style={{ opacity: 0.6 }}>
          © {new Date().getFullYear()} Immtechnology
        </div>
      </div>
      <div className="login-form">
        <Link className="login-back" to="/">
          ← Volver a la portada
        </Link>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError('');
            const r = await login(email, password);
            setBusy(false);
            if (!r.ok) setError(r.error);
          }}
        >
          <div>
            <h1>Iniciar sesión</h1>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              Ingresa a tu cuenta de Flotimly
            </p>
          </div>
          <label className="field">
            <span>Correo electrónico</span>
            <input className="input" style={{ height: 42 }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="username" maxLength={254} required />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input className="input" style={{ height: 42 }} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" maxLength={128} required />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="btn primary lg" type="submit" disabled={busy}>
            {busy ? 'Verificando…' : 'Entrar'} <ArrowRight size={17} />
          </button>
          <div className="demo-hint">
            <b>Modo demo local.</b> Usuario <code>admin@flotimly.cl</code> · contraseña <code>demo</code>. También puedes probar los
            roles con <code>operaciones@</code>, <code>finanzas@</code> o <code>conductor@flotimly.cl</code>. Los datos se
            guardan sólo en este navegador.
          </div>
          <p className="login-legal">
            Al ingresar aceptas los <Link to="/legal/terminos">Términos y Condiciones</Link> y la{' '}
            <Link to="/legal/privacidad">Política de Privacidad</Link>.
          </p>
        </form>
      </div>
    </div>
  );
}
