import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CollectionKey, DB, Item, Plan, Settings, User } from './types';
import { createSeed, DB_VERSION, DEFAULT_BANK, DEFAULT_CONDITIONS, emptyDB } from './seed';

/*
 * Capa de persistencia local (localStorage).
 * Para la versión en la nube se reemplaza este archivo por llamadas a una API
 * manteniendo la misma interfaz (upsert / remove / setSettings).
 */

const KEY = 'flotimly.db.v1';
const SESSION_KEY = 'flotimly.session';

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as DB;
      if (db.version === DB_VERSION) return migrate(db);
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
    },
  };
}

interface StoreCtx {
  db: DB;
  plan: Plan;
  isPyme: boolean;
  user: User | null;
  upsert: <K extends CollectionKey>(key: K, item: Item<K>) => void;
  upsertMany: <K extends CollectionKey>(key: K, items: Item<K>[]) => void;
  remove: <K extends CollectionKey>(key: K, id: string) => void;
  setSettings: (fn: (s: Settings) => Settings) => void;
  replaceDB: (db: DB) => void;
  resetDemo: () => void;
  clearData: () => void;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDB] = useState<DB>(load);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  });
  const warned = useRef(false);

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

  const upsert = useCallback(<K extends CollectionKey>(key: K, item: Item<K>) => {
    setDB((prev) => {
      const list = prev[key] as Item<K>[];
      const idx = list.findIndex((x) => x.id === item.id);
      const next = idx >= 0 ? list.map((x, i) => (i === idx ? item : x)) : [item, ...list];
      return { ...prev, [key]: next };
    });
  }, []);

  const upsertMany = useCallback(<K extends CollectionKey>(key: K, items: Item<K>[]) => {
    setDB((prev) => {
      const byId = new Map(items.map((i) => [i.id, i]));
      const list = (prev[key] as Item<K>[]).map((x) => byId.get(x.id) ?? x);
      const existing = new Set(list.map((x) => x.id));
      const added = items.filter((i) => !existing.has(i.id));
      return { ...prev, [key]: [...added, ...list] };
    });
  }, []);

  const remove = useCallback(<K extends CollectionKey>(key: K, id: string) => {
    setDB((prev) => ({ ...prev, [key]: (prev[key] as Item<K>[]).filter((x) => x.id !== id) }));
  }, []);

  const setSettings = useCallback((fn: (s: Settings) => Settings) => {
    setDB((prev) => ({ ...prev, settings: fn(prev.settings) }));
  }, []);

  const user = useMemo(() => db.users.find((u) => u.id === sessionId && u.active) ?? null, [db.users, sessionId]);

  const value: StoreCtx = {
    db,
    plan: db.settings.plan,
    isPyme: db.settings.plan === 'pyme',
    user,
    upsert,
    upsertMany,
    remove,
    setSettings,
    replaceDB: (next) => setDB(migrate({ ...next, version: DB_VERSION })),
    resetDemo: () => {
      const seed = createSeed();
      // Conserva plan y usuarios actuales
      setDB((prev) => ({ ...seed, settings: { ...seed.settings, plan: prev.settings.plan }, users: prev.users }));
    },
    clearData: () => setDB((prev) => emptyDB(prev)),
    login: (email, password) => {
      const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.active);
      if (!u || u.password !== password) return false;
      localStorage.setItem(SESSION_KEY, u.id);
      setSessionId(u.id);
      return true;
    },
    logout: () => {
      localStorage.removeItem(SESSION_KEY);
      setSessionId(null);
    },
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
