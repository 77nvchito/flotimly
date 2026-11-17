import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Info, RotateCcw, ShieldAlert, X } from 'lucide-react';

export interface ToastAction {
  label: string;
  onClick: () => void;
  kind?: 'primary' | 'undo';
}

export interface ToastInput {
  title: string;
  description?: ReactNode;
  tone?: 'success' | 'info' | 'error';
  actions?: ToastAction[];
  duration?: number; // ms
}

interface ToastItem extends ToastInput {
  id: number;
}

const Ctx = createContext<(t: ToastInput) => void>(() => {});

/** Avisos tipo notificación (abajo a la derecha) para confirmar cambios. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((x) => x.id !== id)), []);
  const push = useCallback((t: ToastInput) => {
    const id = ++seq.current;
    setItems((l) => [...l.slice(-2), { ...t, id }]);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      {createPortal(
        <div className="toasts" role="status" aria-live="polite">
          {items.map((t) => (
            <ToastCard key={t.id} t={t} onClose={() => dismiss(t.id)} />
          ))}
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
}

function ToastCard({ t, onClose }: { t: ToastItem; onClose: () => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const h = setTimeout(onClose, t.duration ?? 7000);
    return () => clearTimeout(h);
  }, [paused, onClose, t.duration]);
  return (
    <div className={`toast ${t.tone ?? 'success'}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="toast-ico">{t.tone === 'info' ? <Info size={18} /> : t.tone === 'error' ? <ShieldAlert size={18} /> : <CheckCircle2 size={18} />}</div>
      <div className="toast-body">
        <b>{t.title}</b>
        {t.description && <div className="toast-desc">{t.description}</div>}
        {t.actions && t.actions.length > 0 && (
          <div className="toast-actions">
            {t.actions.map((a) => (
              <button
                key={a.label}
                className={`btn sm ${a.kind === 'primary' ? 'primary' : ''}`}
                onClick={() => {
                  a.onClick();
                  onClose();
                }}
              >
                {a.kind === 'undo' && <RotateCcw size={13} />}
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button className="icon-btn" onClick={onClose} aria-label="Cerrar aviso">
        <X size={15} />
      </button>
    </div>
  );
}

export const useToast = () => useContext(Ctx);
