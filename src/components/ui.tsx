import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { clp } from '../lib/format';

export function Logo({ size, light }: { size?: 'lg' | 'sm'; light?: boolean }) {
  return (
    <div className={`logo ${size ?? ''} ${light ? 'light' : ''}`}>
      <span className="word">
        Flot<span className="dot">i</span>mly
      </span>
      <span className="by">By Immtechnology</span>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={width ? { maxWidth: width } : undefined} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${className ?? ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  ...rest
}: { value: string | undefined; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return <input className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

/** Input numérico con prefijo/sufijo opcional. Muestra separadores de miles al perder foco. */
export function NumInput({
  value,
  onChange,
  prefix,
  suffix,
  step,
  min,
  placeholder,
  readOnly,
}: {
  value: number | undefined;
  onChange?: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const [focus, setFocus] = useState(false);
  const [text, setText] = useState('');
  const display = focus
    ? text
    : value == null || Number.isNaN(value)
      ? ''
      : new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(value);
  return (
    <div className={`input-affix ${prefix ? '' : 'no-pre'} ${suffix ? 'has-post' : ''}`}>
      {prefix && <span className="pre">{prefix}</span>}
      <input
        className="input tnum"
        inputMode="decimal"
        value={display}
        placeholder={placeholder}
        readOnly={readOnly}
        step={step}
        min={min}
        onFocus={() => {
          setFocus(true);
          setText(value == null ? '' : String(value).replace('.', ','));
        }}
        onBlur={() => setFocus(false)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d,.-]/g, '');
          setText(raw);
          const n = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
          onChange?.(Number.isFinite(n) ? n : 0);
        }}
      />
      {suffix && <span className="post">{suffix}</span>}
    </div>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: T | undefined;
  onChange: (v: T) => void;
  options: { value: T; label: string }[] | T[];
  placeholder?: string;
}) {
  const opts = (options as (T | { value: T; label: string })[]).map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  );
  return (
    <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value as T)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button type="button" className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on} />;
}

export type Tone = 'blue' | 'green' | 'red' | 'amber' | 'orange' | 'purple' | 'gray';

const STATUS_TONE: Record<string, Tone> = {
  Activo: 'green',
  'En mantención': 'amber',
  Inactivo: 'gray',
  'Licencia médica': 'amber',
  Vacaciones: 'blue',
  Planificado: 'blue',
  'En curso': 'orange',
  Completado: 'green',
  Cancelado: 'gray',
  Borrador: 'gray',
  Enviada: 'blue',
  Aceptada: 'green',
  Rechazada: 'red',
  Conforme: 'green',
  'Con observaciones': 'amber',
  Rechazado: 'red',
  por_facturar: 'purple',
  pendiente: 'blue',
  vencida: 'red',
  pagada: 'green',
};

export function Badge({ tone = 'gray', children, plain }: { tone?: Tone; children: ReactNode; plain?: boolean }) {
  return <span className={`badge ${tone} ${plain ? 'plain' : ''}`}>{children}</span>;
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={STATUS_TONE[status] ?? 'gray'}>{label ?? status}</Badge>;
}

export function Stat({
  label,
  value,
  sub,
  icon,
  tone,
  delta,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: 'orange' | 'green' | 'red' | 'purple';
  delta?: number | null;
}) {
  return (
    <div className="card stat">
      <div className="label">
        {icon && <span className={`ico ${tone ?? ''}`}>{icon}</span>}
        {label}
      </div>
      <div className="value">{value}</div>
      {(sub || delta != null) && (
        <div className="sub row" style={{ gap: 6 }}>
          {delta != null && Number.isFinite(delta) && (
            <span className={`delta ${delta >= 0 ? 'up' : 'down'}`}>
              {delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(delta * 100).toFixed(0)}%
            </span>
          )}
          {sub}
        </div>
      )}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="ico">{icon}</div>
      <h3>{title}</h3>
      {text && <p style={{ margin: '0 0 16px' }}>{text}</p>}
      {action}
    </div>
  );
}

export function Card({ title, extra, children, pad = true, className }: { title?: ReactNode; extra?: ReactNode; children: ReactNode; pad?: boolean; className?: string }) {
  return (
    <div className={`card ${className ?? ''}`}>
      {(title || extra) && (
        <div className="card-head">
          {typeof title === 'string' ? <h3>{title}</h3> : title}
          {extra}
        </div>
      )}
      {pad ? <div className="card-body">{children}</div> : children}
    </div>
  );
}

/** Tooltip para Recharts con formato CLP. */
export function MoneyTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string; payload?: { fill?: string } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tt">
      {label && <b>{label}</b>}
      {payload.map((p) => (
        <div className="r" key={p.name}>
          <span>
            <i className="sw" style={{ background: p.color || p.payload?.fill }} />
            {p.name}
          </span>
          <span className="tnum strong">{clp(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function useForm<T extends object>(initial: T) {
  const [f, setF] = useState<T>(initial);
  const set = <K extends keyof T>(k: K) => (v: T[K]) => setF((p) => ({ ...p, [k]: v }));
  return { f, set, setF };
}

// Paleta validada (CVD / contraste) con scripts de dataviz. Ingresos = azul marca, gastos = naranjo.
export const SERIES = { income: '#0b4f9c', expense: '#eb6834', profit: '#1baf7a' };
export const CHART_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'];

export function confirmDelete(what: string) {
  return window.confirm(`¿Eliminar ${what}? Esta acción no se puede deshacer.`);
}
