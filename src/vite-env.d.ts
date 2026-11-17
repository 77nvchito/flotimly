/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Llave pública del proyecto de PostHog (phc_…). Vacía = sin medición. */
  readonly VITE_POSTHOG_KEY?: string;
  /** Servidor de PostHog: https://eu.i.posthog.com (Europa, por defecto) o https://us.i.posthog.com */
  readonly VITE_POSTHOG_HOST?: string;
}
