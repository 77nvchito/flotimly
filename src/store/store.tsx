import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CollectionKey, DB, Item, Plan, Settings, User } from './types';
import {
  SESSION_STORAGE_KEY,
  clearLoginFailures,
  hashPassword,
  loginLockedFor,
  newSession,
  readSession,
  registerLoginFailure,
  sessionExpired,
  verifyPassword,
  writeSession,
  type Session,
} from '../lib/security';
import { canAdmin, writeProblem } from '../lib/permissions';
import { isEmail, sanitizeRecord } from '../lib/validate';
import { planInfo } from '../lib/plans';
import { track } from '../lib/analytics';
import { createSeed, DB_VERSION, DEFAULT_BANK, DEFAULT_CONDITIONS, DEFAULT_TIME_PARAMS, emptyDB } from './seed';

/*
 * Capa de persistencia local (localStorage).
 * Para la versión en la nube se reemplaza este archivo por llamadas a una API
 * manteniendo la misma interfaz (upsert / remove / setSettings).
 */

const KEY = 'flotimly.db.v1';

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as DB;
      if (db.version === DB_VERSION) return migrate(sanitizeRecord(db));
    }
  } catch {
    /* datos corruptos: se regeneran */
  }
  return createSeed();
}

/** Completa campos agregados en versiones posteriores sin perder los datos guardados. */
function migrate(db: DB): DB {
  const st = db.settings;
  return {
    ...db,
    settings: {
      ...st,
      company: { brandColor: '#0b2a52', ...st.company },
      bank: st.bank ?? { ...DEFAULT_BANK, holder: st.company.name, rut: st.company.rut },
      quoteConditions: st.quoteConditions ?? DEFAULT_CONDITIONS,
      params: { ...DEFAULT_TIME_PARAMS, ...st.params },
    },
  };
}

/** Avisa a la interfaz que una acción fue rechazada (Layout lo muestra como aviso). */
export const DENIED_EVENT = 'flotimly:denied';
function deny(message: string) {
  track('action_denied', { reason: message });
  window.dispatchEvent(new CustomEvent(DENIED_EVENT, { detail: message }));
  return false;
}

/** Usuarios de ejemplo de la demo pública. */
export const isDemoUser = (u: User) => u.email.toLowerCase().endsWith('@flotimly.cl');

const activeAdmins = (users: User[]) => users.filter((u) => u.role === 'Administrador' && u.active).length;

/** Reglas especiales de la colección de usuarios. */
function userChangeProblem(users: User[], plan: Plan, before: User | undefined, after: User | undefined): string | null {
  const next = after ? users.map((u) => (u.id === after.id ? after : u)).concat(before ? [] : [after]) : users.filter((u) => u.id !== before?.id);
  if (activeAdmins(next) === 0) return 'Debe quedar al menos un administrador activo.';
  if (after) {
    if (!after.name.trim() || !isEmail(after.email)) return 'El usuario necesita nombre y un correo válido.';
    const dup = users.find((u) => u.id !== after.id && u.email.trim().toLowerCase() === after.email.trim().toLowerCase());
    if (dup) return 'Ya existe un usuario con ese correo.';
    if (!after.passwordHash?.startsWith('pbkdf2$')) return 'La contraseña no se guardó de forma segura.';
    if (!before && users.length >= planInfo(plan).maxUsers) return 'Alcanzaste el máximo de usuarios de tu plan.';
  }
  return null;
}

export type LoginResult = { ok: true } | { ok: false; error: string };

interface StoreCtx {
  db: DB;
  plan: Plan;
  isPyme: boolean;
  user: User | null;
  /** Devuelven false si la acción no está permitida (y avisan en pantalla). */
  upsert: <K extends CollectionKey>(key: K, item: Item<K>) => boolean;
  upsertMany: <K extends CollectionKey>(key: K, items: Item<K>[]) => boolean;
  remove: <K extends CollectionKey>(key: K, id: string) => boolean;
  setSettings: (fn: (s: Settings) => Settings) => boolean;
  replaceDB: (db: DB) => boolean;
  resetDemo: () => boolean;
  clearData: () => boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDB] = useState<DB>(load);
  const [session, setSession] = useState<Session | null>(readSession);
  const warned = useRef(false);
  const dbRef = useRef(db);
  dbRef.current = db;

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      warned.current = false;
    } catch {
      if (!warned.current) {
        warned.current = true;
        alert('No se pudo guardar: el almacenamiento local está lleno. Elimina fotos de comprobantes antiguos o exporta un respaldo.');
      }
    }
  }, [db]);

  // Datos de versiones anteriores: convierte contraseñas en texto plano a hash y las elimina.
  useEffect(() => {
    const legacy = db.users.filter((u) => u.password !== undefined);
    if (!legacy.length) return;
    let cancelled = false;
    (async () => {
      const hashed = new Map<string, string>();
      for (const u of legacy) hashed.set(u.id, u.passwordHash ?? (await hashPassword(u.password ?? '')));
      if (cancelled) return;
      setDB((prev) => ({
        ...prev,
        users: prev.users.map(({ password: _drop, ...u }) => (hashed.has(u.id) ? { ...u, passwordHash: hashed.get(u.id) } : u)),
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, [db.users]);

  const user = useMemo(() => {
    if (!session) return null;
    const u = db.users.find((x) => x.id === session.userId && x.active);
    return u && (u.epoch ?? 0) === session.epoch ? u : null;
  }, [db.users, session]);
  const role = user?.role;
  const roleRef = useRef(role);
  roleRef.current = role;

  const endSession = useCallback(() => {
    writeSession(null);
    setSession(null);
  }, []);

  // Si la sesión ya no corresponde a un usuario válido (desactivado, contraseña cambiada), se cierra.
  useEffect(() => {
    if (session && !user && !db.users.some((u) => u.password !== undefined)) endSession();
  }, [session, user, db.users, endSession]);

  // Vencimiento por inactividad, actividad del usuario y cierre de sesión en otras pestañas.
  useEffect(() => {
    if (!session) return;
    let last = session.lastSeen;
    const check = () => {
      if (sessionExpired({ ...session, lastSeen: last })) endSession();
    };
    const touch = () => {
      const now = Date.now();
      if (now - last < 60_000) return; // como máximo una escritura por minuto
      if (sessionExpired({ ...session, lastSeen: last }, now)) return endSession();
      last = now;
      writeSession({ ...session, lastSeen: now });
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SESSION_STORAGE_KEY) return;
      const s = readSession();
      if (!s || s.token !== session.token) setSession(s);
      else last = s.lastSeen;
    };
    const timer = window.setInterval(check, 60_000);
    const events = ['pointerdown', 'keydown', 'scroll', 'visibilitychange'] as const;
    events.forEach((ev) => window.addEventListener(ev, touch, { passive: true }));
    window.addEventListener('focus', check);
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(timer);
      events.forEach((ev) => window.removeEventListener(ev, touch));
      window.removeEventListener('focus', check);
      window.removeEventListener('storage', onStorage);
    };
  }, [session, endSession]);

  /** Prepara un usuario para guardarse: sube su versión de credenciales si cambió algo sensible. */
  const prepareUser = (before: User | undefined, after: User): User => {
    const { password: _drop, ...u } = after;
    const sensitive = before && (before.passwordHash !== u.passwordHash || before.role !== u.role || before.active !== u.active);
    return sensitive ? { ...u, epoch: (before.epoch ?? 0) + 1 } : { ...u, epoch: before?.epoch ?? 0 };
  };

  const upsert = useCallback(<K extends CollectionKey>(key: K, raw: Item<K>) => {
    let item = sanitizeRecord(raw);
    const list = dbRef.current[key] as Item<K>[];
    const before = list.find((x) => x.id === item.id);
    const problem = writeProblem(roleRef.current, key, before, item);
    if (problem) return deny(problem);
    if (key === 'users') {
      const u = prepareUser(before as User | undefined, item as User);
      const p = userChangeProblem(dbRef.current.users, dbRef.current.settings.plan, before as User | undefined, u);
      if (p) return deny(p);
      item = u as Item<K>;
      // Si el usuario se edita a sí mismo (por ejemplo, su contraseña), su sesión sigue abierta con la nueva versión.
      if (session && u.id === session.userId && u.epoch !== session.epoch) {
        const s = { ...session, epoch: u.epoch ?? 0 };
        writeSession(s);
        setSession(s);
      }
    }
    if (!before) track('record_created', { type: key });
    setDB((prev) => {
      const cur = prev[key] as Item<K>[];
      const idx = cur.findIndex((x) => x.id === item.id);
      const next = idx >= 0 ? cur.map((x, i) => (i === idx ? item : x)) : [item, ...cur];
      return { ...prev, [key]: next };
    });
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const upsertMany = useCallback(<K extends CollectionKey>(key: K, raw: Item<K>[]) => {
    if (key === 'users') return deny('Los usuarios se crean de a uno desde Configuración.');
    const items = raw.map((i) => sanitizeRecord(i));
    const cur = dbRef.current[key] as Item<K>[];
    for (const it of items) {
      const problem = writeProblem(roleRef.current, key, cur.find((x) => x.id === it.id), it);
      if (problem) return deny(problem);
    }
    setDB((prev) => {
      const byId = new Map(items.map((i) => [i.id, i]));
      const list = (prev[key] as Item<K>[]).map((x) => byId.get(x.id) ?? x);
      const existing = new Set(list.map((x) => x.id));
      const added = items.filter((i) => !existing.has(i.id));
      return { ...prev, [key]: [...added, ...list] };
    });
    return true;
  }, []);

  const remove = useCallback(<K extends CollectionKey>(key: K, id: string) => {
    const before = (dbRef.current[key] as Item<K>[]).find((x) => x.id === id);
    if (!before) return true;
    const problem = writeProblem(roleRef.current, key, before, undefined);
    if (problem) return deny(problem);
    if (key === 'users') {
      if (session && id === session.userId) return deny('No puedes eliminar tu propio usuario.');
      const p = userChangeProblem(dbRef.current.users, dbRef.current.settings.plan, before as User, undefined);
      if (p) return deny(p);
    }
    track('record_deleted', { type: key });
    setDB((prev) => ({ ...prev, [key]: (prev[key] as Item<K>[]).filter((x) => x.id !== id) }));
    return true;
  }, [session]);

  const adminOnly = (fn: () => void) => {
    if (!canAdmin(roleRef.current)) return deny('Solo un administrador puede hacer esto.');
    fn();
    return true;
  };

  const setSettings = useCallback(
    (fn: (s: Settings) => Settings) =>
      adminOnly(() => {
        const from = dbRef.current.settings.plan;
        const to = fn(dbRef.current.settings).plan;
        if (from !== to) track('plan_changed', { from, to });
        setDB((prev) => ({ ...prev, settings: sanitizeRecord(fn(prev.settings)) }));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const value: StoreCtx = {
    db,
    plan: db.settings.plan,
    isPyme: db.settings.plan === 'pyme' || db.settings.plan === 'flota_plus',
    user,
    upsert,
    upsertMany,
    remove,
    setSettings,
    // Restaurar un respaldo o deshacer una importación nunca cambia los usuarios ni el plan contratado.
    replaceDB: (next) =>
      adminOnly(() =>
        setDB((prev) => {
          const clean = migrate({ ...sanitizeRecord(next), version: DB_VERSION });
          return { ...clean, users: prev.users, settings: { ...clean.settings, plan: prev.settings.plan } };
        }),
      ),
    resetDemo: () =>
      adminOnly(() => {
        const seed = createSeed();
        // Conserva plan y usuarios actuales
        setDB((prev) => ({ ...seed, settings: { ...seed.settings, plan: prev.settings.plan }, users: prev.users }));
      }),
    clearData: () => adminOnly(() => setDB((prev) => emptyDB(prev))),
    login: async (email, password) => {
      const wait = loginLockedFor(email);
      if (wait) track('login_failed', { reason: 'locked' });
      if (wait) return { ok: false, error: `Demasiados intentos. Espera ${Math.ceil(wait / 60000)} min antes de volver a intentar.` };
      const u = dbRef.current.users.find((x) => x.email.trim().toLowerCase() === email.trim().toLowerCase() && x.active);
      // Usuarios de versiones anteriores que aún no se convierten a hash
      const ok = u?.passwordHash ? await verifyPassword(password, u.passwordHash) : (await verifyPassword(password, undefined), !!u?.password && u.password === password);
      if (!u || !ok) {
        track('login_failed', { reason: 'credentials' });
        registerLoginFailure(email);
        const left = loginLockedFor(email);
        return { ok: false, error: left ? `Demasiados intentos. Espera ${Math.ceil(left / 60000)} min antes de volver a intentar.` : 'Correo o contraseña incorrectos.' };
      }
      clearLoginFailures(email);
      track('login_succeeded', { role: u.role, demo: isDemoUser(u) });
      const s = newSession(u.id, u.epoch ?? 0);
      writeSession(s);
      setSession(s);
      return { ok: true };
    },
    logout: endSession,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore fuera de StoreProvider');
  return c;
}

/** Mapas id → entidad para mostrar nombres rápidamente. */
export function useLookups() {
  const { db } = useStore();
  return useMemo(
    () => ({
      vehicle: new Map(db.vehicles.map((v) => [v.id, v])),
      driver: new Map(db.drivers.map((d) => [d.id, d])),
      client: new Map(db.clients.map((c) => [c.id, c])),
      trip: new Map(db.trips.map((t) => [t.id, t])),
      tariff: new Map(db.tariffs.map((t) => [t.id, t])),
    }),
    [db.vehicles, db.drivers, db.clients, db.trips, db.tariffs],
  );
}
