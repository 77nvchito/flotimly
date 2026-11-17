/**
 * Validación de datos de entrada.
 * - Validadores para formularios (correo, RUT, patente, teléfono, sitio web).
 * - `sanitizeRecord`: limpieza que aplica la capa de datos a TODO lo que se guarda, venga de un formulario,
 *   de una importación de Excel o de un respaldo. Así un dato malformado o manipulado no llega a guardarse.
 */

export const isEmail = (s: string) => /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}$/.test(s.trim());

/** Limpia un RUT a "12345678-9". */
export const cleanRut = (s: string) => s.replace(/[^0-9kK]/g, '').toUpperCase();

/** Valida el dígito verificador (módulo 11). */
export function isRut(s: string) {
  const r = cleanRut(s);
  if (r.length < 2 || r.length > 9) return false;
  const body = r.slice(0, -1);
  const dv = r.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  const expected = res === 11 ? '0' : res === 10 ? 'K' : String(res);
  return dv === expected;
}

/** Da formato 12.345.678-9 a un RUT válido; si no es válido lo deja como está. */
export function formatRut(s: string) {
  if (!isRut(s)) return s.trim();
  const r = cleanRut(s);
  const body = r.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${body}-${r.slice(-1)}`;
}

/** Patentes chilenas: BBBB12 (actual), BB1234 (antigua), BBB12 (motos), con o sin guion. */
export const isPlate = (s: string) => /^([A-Z]{4}\d{2}|[A-Z]{2}\d{4}|[A-Z]{3}\d{2})$/.test(s.replace(/[\s.-]/g, '').toUpperCase());

/** Teléfono: 8 a 12 dígitos, con +56 opcional. */
export const isPhone = (s: string) => {
  const d = s.replace(/[\s().-]/g, '');
  return /^\+?\d{8,12}$/.test(d);
};

/** Solo http/https (bloquea javascript:, data:, etc.). Acepta "www.empresa.cl" sin protocolo. */
export function isWebsite(s: string) {
  try {
    const u = new URL(/^[a-z]+:/i.test(s) ? s : `https://${s}`);
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.');
  } catch {
    return false;
  }
}

/** Mensaje de error de un campo opcional: vacío es válido. */
export const optional = (value: string | undefined, ok: (s: string) => boolean, message: string) =>
  value && value.trim() && !ok(value) ? message : undefined;

/* ------------------------------------------------------------------ */
/*  Limpieza de registros                                               */
/* ------------------------------------------------------------------ */

/** Largo máximo de un texto (notas, condiciones, direcciones…). */
const MAX_TEXT = 5000;
/** Largo máximo de una imagen guardada como data URL (~7,5 MB). */
const MAX_IMAGE = 10_000_000;
/** Campos que contienen imágenes en formato data URL. */
const IMAGE_FIELDS = new Set(['logo', 'signature', 'photos']);
/** Claves que nunca se aceptan (contaminación de prototipos). */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const SAFE_IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

/** Solo imágenes PNG, JPEG o WebP en base64: bloquea SVG (puede llevar scripts) y cualquier otro esquema. */
export const isSafeImage = (s: unknown): s is string => typeof s === 'string' && s.length <= MAX_IMAGE && SAFE_IMAGE.test(s);

// Caracteres de control salvo tabulador y saltos de línea
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function clean(v: unknown, key: string, depth: number): unknown {
  if (depth > 8) return undefined;
  if (typeof v === 'string') {
    if (IMAGE_FIELDS.has(key)) return isSafeImage(v) ? v : undefined;
    return v.replace(CONTROL, '').slice(0, MAX_TEXT);
  }
  if (typeof v === 'number') return Number.isFinite(v) ? Math.max(-1e12, Math.min(1e12, v)) : 0;
  if (typeof v === 'boolean' || v === null || v === undefined) return v;
  if (Array.isArray(v)) {
    const arr = v.slice(0, 10_000).map((x) => clean(x, key, depth + 1));
    return IMAGE_FIELDS.has(key) ? arr.filter((x) => x !== undefined) : arr;
  }
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(k)) continue;
      const c = clean(x, k, depth + 1);
      if (c !== undefined) out[k] = c;
    }
    return out;
  }
  return undefined; // funciones, símbolos, etc.
}

/** Devuelve una copia limpia del registro: textos acotados, números finitos, imágenes seguras y sin claves peligrosas. */
export function sanitizeRecord<T>(item: T): T {
  return clean(item, '', 0) as T;
}

/* ------------------------------------------------------------------ */
/*  Archivos subidos                                                    */
/* ------------------------------------------------------------------ */

export const MAX_UPLOAD = {
  image: 15 * 1024 * 1024,
  excel: 10 * 1024 * 1024,
  json: 60 * 1024 * 1024,
};

/**
 * Comprueba tipo y tamaño de una imagen antes de leerla.
 * Con `anyPhoto`, acepta cualquier foto que el navegador pueda abrir (por ejemplo HEIC del iPhone), salvo SVG;
 * igual se vuelve a dibujar y se guarda como JPEG, lo que elimina cualquier contenido oculto.
 */
export function imageProblem(file: File, opts: { anyPhoto?: boolean } = {}): string | null {
  const ok = opts.anyPhoto ? file.type.startsWith('image/') && !file.type.includes('svg') : ['image/png', 'image/jpeg', 'image/webp'].includes(file.type);
  if (!ok) return opts.anyPhoto ? 'El archivo no es una foto.' : 'Solo se aceptan imágenes PNG, JPG o WebP.';
  if (file.size > MAX_UPLOAD.image) return 'La imagen pesa más de 15 MB.';
  return null;
}
