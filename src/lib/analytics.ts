/**
 * Medición de la portada y de la app con PostHog.
 *
 * - Se activa solo si existe VITE_POSTHOG_KEY (llave pública del proyecto; no es un secreto).
 * - Sin consentimiento, PostHog funciona en "modo sin cookies": no guarda nada en el navegador y no graba sesiones.
 * - Si la persona acepta, se usan cookies/almacenamiento para reconocer visitas repetidas y se graban sesiones
 *   (con todos los campos de formularios ocultos).
 * - Nunca se envían correos, nombres, RUT ni montos: solo el tipo de acción y datos generales (plan, rol, módulo).
 *
 * Los eventos están todos definidos en `AnalyticsEvent`, para que el panel de PostHog sea fácil de leer.
 */
import type { PostHog } from 'posthog-js';

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://eu.i.posthog.com';
const CONSENT_KEY = 'flotimly.consent';

export const analyticsEnabled = !!KEY && import.meta.env.PROD;

export type AnalyticsEvent =
  // Portada
  | 'demo_started' // { source: 'hero' | 'nav' | 'cta' }
  | 'whatsapp_clicked' // { location, plan? }
  | 'pricing_viewed' // la sección de planes entra en pantalla
  // App
  | 'login_succeeded' // { role, demo }
  | 'login_failed' // { reason }
  | 'record_created' // { type: 'trips' | 'quotes' | … }
  | 'record_deleted' // { type }
  | 'quote_pdf_opened'
  | 'data_exported' // { format: 'xlsx' | 'zip' | 'json' }
  | 'data_imported' // { created, updated }
  | 'upgrade_gate_viewed' // { feature }
  | 'plan_changed' // { from, to }
  | 'action_denied'; // { reason }

export type Consent = 'granted' | 'denied' | 'pending';

export function getConsent(): Consent {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : 'pending';
  } catch {
    return 'pending';
  }
}

let ph: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;
const queue: [AnalyticsEvent, Record<string, unknown> | undefined][] = [];

function load(): Promise<PostHog | null> {
  if (!analyticsEnabled) return Promise.resolve(null);
  loading ??= import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(KEY!, {
        api_host: HOST,
        defaults: '2026-08-30',
        // Sin consentimiento: sin cookies ni almacenamiento. Requiere activar "Cookieless" en el proyecto de PostHog.
        cookieless_mode: 'on_reject',
        opt_out_capturing_by_default: true,
        person_profiles: 'identified_only',
        capture_pageview: 'history_change',
        capture_pageleave: true,
        autocapture: true,
        // No envía el texto de botones ni enlaces de la app (puede contener datos de clientes)
        mask_all_text: true,
        disable_surveys: true,
        disable_session_recording: true,
        session_recording: { maskAllInputs: true, maskTextSelector: '.main' },
        // Quita de las direcciones cualquier parámetro que pueda traer datos personales
        before_send: (e) => {
          if (e?.properties?.$current_url) e.properties.$current_url = String(e.properties.$current_url).split('?')[0];
          return e;
        },
      });
      if (getConsent() === 'granted') {
        posthog.opt_in_capturing();
        posthog.startSessionRecording();
      }
      ph = posthog;
      for (const [ev, props] of queue.splice(0)) posthog.capture(ev, props);
      return posthog;
    })
    .catch(() => null);
  return loading;
}

/** Inicia la medición (se llama una vez al cargar la app). */
export const initAnalytics = () => void load();

export function track(event: AnalyticsEvent, props?: Record<string, unknown>) {
  if (!analyticsEnabled) return;
  if (ph) ph.capture(event, props);
  else {
    queue.push([event, props]);
    void load();
  }
}

export function setConsent(c: 'granted' | 'denied') {
  try {
    localStorage.setItem(CONSENT_KEY, c);
  } catch {
    /* sin almacenamiento: se vuelve a preguntar en la próxima visita */
  }
  window.dispatchEvent(new Event('flotimly:consent'));
  void load().then((p) => {
    if (!p) return;
    if (c === 'granted') {
      p.opt_in_capturing();
      p.startSessionRecording();
    } else {
      p.stopSessionRecording();
      p.opt_out_capturing();
    }
  });
}

/**
 * Contexto de la sesión en la app: solo datos generales, nunca datos personales.
 * Con consentimiento se identifica al usuario por su id interno, para contar usuarios activos por empresa.
 */
export function setAnalyticsContext(ctx: { userId: string; role: string; plan: string; demo: boolean } | null) {
  if (!analyticsEnabled) return;
  void load().then((p) => {
    if (!p) return;
    if (!ctx) {
      p.unregister('role');
      p.unregister('plan');
      p.unregister('demo');
      return;
    }
    p.register({ role: ctx.role, plan: ctx.plan, demo: ctx.demo });
    if (getConsent() === 'granted' && !ctx.demo) p.identify(ctx.userId);
  });
}
