/**
 * Seguridad del lado del navegador: contraseñas, sesión y límite de intentos de ingreso.
 *
 * En la demo local todo vive en el navegador, así que estas medidas protegen frente a errores,
 * curiosos y robo casual del almacenamiento, pero NO frente a quien controla el propio navegador.
 * En la versión en la nube (Supabase) estas mismas reglas se aplican además en el servidor: ver SECURITY.md.
 */

/* ------------------------------------------------------------------ */
/*  Contraseñas: PBKDF2-SHA256 con sal aleatoria (WebCrypto)            */
/* ------------------------------------------------------------------ */

/** Iteraciones recomendadas por OWASP para PBKDF2-HMAC-SHA256. */
const PBKDF2_ITERATIONS = 600_000;
export const MIN_PASSWORD = 8;

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

/** Devuelve "pbkdf2$<iteraciones>$<sal>$<hash>". La contraseña original nunca se guarda. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

/** Comparación en tiempo constante, para no filtrar información por el tiempo de respuesta. */
function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  const [alg, iter, salt, hash] = (stored ?? '').split('$');
  if (alg !== 'pbkdf2' || !iter || !salt || !hash) {
    // Sin hash válido igual se calcula uno, para que el tiempo de respuesta no revele si el usuario existe.
    await pbkdf2(password, new Uint8Array(16), PBKDF2_ITERATIONS);
    return false;
  }
  return sameBytes(await pbkdf2(password, unb64(salt), Number(iter)), unb64(hash));
}

/** Reglas mínimas para contraseñas nuevas. Devuelve el problema o null si está bien. */
export function passwordProblem(pw: string, email = ''): string | null {
  if (pw.length < MIN_PASSWORD) return `Usa al menos ${MIN_PASSWORD} caracteres.`;
  if (pw.length > 128) return 'Usa como máximo 128 caracteres.';
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(pw) || !/\d/.test(pw)) return 'Combina letras y números.';
  const low = pw.toLowerCase();
  if (['password', 'contraseña', '12345678', 'qwerty12', 'flotimly'].some((w) => low.includes(w))) return 'Es demasiado fácil de adivinar.';
  const local = email.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && low.includes(local)) return 'No uses tu correo dentro de la contraseña.';
  return null;
}

/* ------------------------------------------------------------------ */
/*  Sesión con vencimiento                                              */
/* ------------------------------------------------------------------ */

const SESSION_KEY = 'flotimly.session';
/** Se cierra la sesión tras 8 horas sin uso… */
export const IDLE_MS = 8 * 60 * 60 * 1000;
/** …y siempre a los 7 días, aunque se use. */
export const ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;

export type Session = {
  userId: string;
  /** Identificador aleatorio de esta sesión. */
  token: string;
  /** Versión de credenciales del usuario al ingresar: si cambia (nueva contraseña, desactivación), la sesión deja de valer. */
  epoch: number;
  createdAt: number;
  lastSeen: number;
};

const randomToken = () => b64(crypto.getRandomValues(new Uint8Array(24))).replace(/[+/=]/g, '');

export function newSession(userId: string, epoch: number): Session {
  const now = Date.now();
  return { userId, token: randomToken(), epoch, createdAt: now, lastSeen: now };
}

export function sessionExpired(s: Session, now = Date.now()) {
  return now - s.lastSeen > IDLE_MS || now - s.createdAt > ABSOLUTE_MS;
}

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Session>;
    if (typeof s.userId !== 'string' || typeof s.token !== 'string' || typeof s.createdAt !== 'number' || typeof s.lastSeen !== 'number') return null;
    const session = { epoch: 0, ...s } as Session;
    return sessionExpired(session) ? null : session;
  } catch {
    return null; // incluye el formato antiguo (solo el id), que obliga a ingresar de nuevo
  }
}

export function writeSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* almacenamiento bloqueado: la sesión dura solo esta pestaña */
  }
}

export const SESSION_STORAGE_KEY = SESSION_KEY;

/* ------------------------------------------------------------------ */
/*  Límite de intentos de ingreso                                       */
/* ------------------------------------------------------------------ */

const THROTTLE_KEY = 'flotimly.login-attempts';
/** Intentos fallidos permitidos antes de bloquear. */
const FREE_ATTEMPTS = 5;
/** Bloqueo inicial; se duplica en cada bloqueo siguiente, hasta 1 hora. */
const BASE_LOCK_MS = 60 * 1000;
const MAX_LOCK_MS = 60 * 60 * 1000;

type Attempts = Record<string, { fails: number; lockedUntil: number; locks: number; last: number }>;

function readAttempts(): Attempts {
  try {
    const a = JSON.parse(localStorage.getItem(THROTTLE_KEY) ?? '{}') as Attempts;
    // Olvida los registros de más de 24 horas
    const now = Date.now();
    for (const k of Object.keys(a)) if (now - a[k].last > 24 * 60 * 60 * 1000) delete a[k];
    return a;
  } catch {
    return {};
  }
}
const writeAttempts = (a: Attempts) => {
  try {
    localStorage.setItem(THROTTLE_KEY, JSON.stringify(a));
  } catch {
    /* sin almacenamiento: no hay límite persistente */
  }
};
const attemptKey = (email: string) => email.trim().toLowerCase() || '(vacío)';

/** Milisegundos que faltan para poder intentar de nuevo con ese correo (0 = puede intentar). */
export function loginLockedFor(email: string) {
  const r = readAttempts()[attemptKey(email)];
  return r ? Math.max(0, r.lockedUntil - Date.now()) : 0;
}

export function registerLoginFailure(email: string) {
  const a = readAttempts();
  const k = attemptKey(email);
  const r = (a[k] ??= { fails: 0, lockedUntil: 0, locks: 0, last: 0 });
  r.fails++;
  r.last = Date.now();
  if (r.fails >= FREE_ATTEMPTS) {
    r.lockedUntil = Date.now() + Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** r.locks);
    r.locks++;
    r.fails = 0;
  }
  writeAttempts(a);
}

export function clearLoginFailures(email: string) {
  const a = readAttempts();
  delete a[attemptKey(email)];
  writeAttempts(a);
}
