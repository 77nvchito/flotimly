import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Lee los headers de `/*` en public/_headers, para que `npm run preview` se comporte igual que Cloudflare Pages. */
function pagesHeaders(): Record<string, string> {
  const out: Record<string, string> = {};
  let inRoot = false;
  for (const line of readFileSync('public/_headers', 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      inRoot = line.trim() === '/*';
      continue;
    }
    const i = line.indexOf(':');
    if (inRoot && i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  // HSTS y upgrade-insecure-requests no aplican en http://localhost
  delete out['Strict-Transport-Security'];
  if (out['Content-Security-Policy']) out['Content-Security-Policy'] = out['Content-Security-Policy'].replace(/;\s*upgrade-insecure-requests/, '');
  return out;
}

/**
 * Todo lo que empieza con VITE_ queda PÚBLICO dentro del JavaScript que descarga el navegador.
 * Este control detiene la compilación si una variable secreta se expone por error.
 */
function noSecretsInBundle(mode: string): Plugin {
  return {
    name: 'flotimly:no-secrets-in-bundle',
    config() {
      const env = loadEnv(mode, process.cwd(), 'VITE_');
      const bad = Object.entries(env).filter(
        ([k, v]) => /SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|TOKEN/i.test(k) || /^sk_(live|test)_/.test(v) || v.includes('"role":"service_role"') || isServiceRoleJwt(v),
      );
      if (bad.length) {
        throw new Error(
          `Variables secretas expuestas al navegador: ${bad.map(([k]) => k).join(', ')}. ` +
            'Quita el prefijo VITE_ y úsalas solo en el servidor (Supabase Edge Functions o Cloudflare Functions).',
        );
      }
    },
  };
}

function isServiceRoleJwt(v: string) {
  const part = v.split('.')[1];
  if (!part) return false;
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')).role === 'service_role';
  } catch {
    return false;
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), noSecretsInBundle(mode)],
  server: { port: 5173 },
  preview: { headers: pagesHeaders() },
  build: { sourcemap: false },
}));
