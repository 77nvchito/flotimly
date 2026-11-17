#!/usr/bin/env node
/**
 * Busca secretos (llaves de API, tokens, claves privadas) en los archivos del repositorio.
 * Corre automáticamente antes de cada compilación (`npm run build`) y también a mano: `npm run check:secrets`.
 * Si encuentra algo, la compilación se detiene y el secreto no llega a publicarse.
 */
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PATTERNS = [
  ['Clave privada', /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
  ['Llave de AWS', /\bAKIA[0-9A-Z]{16}\b/],
  ['Token de GitHub', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['Llave secreta de Stripe', /\b[sr]k_live_[A-Za-z0-9]{20,}\b/],
  ['Llave de Google', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Token de Slack', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['Llave de OpenAI / Anthropic', /\bsk-(proj-|ant-)?[A-Za-z0-9_-]{32,}\b/],
  ['Token de Cloudflare', /\bCLOUDFLARE_API_TOKEN\s*[=:]\s*['"]?[A-Za-z0-9_-]{30,}/],
  ['Conexión a base de datos con contraseña', /\b(postgres(ql)?|mysql|mongodb(\+srv)?):\/\/[^:\s'"]+:[^@\s'"]+@/],
  ['Llave service_role de Supabase', /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/],
  ['Variable secreta asignada', /\b[A-Z0-9_]*(SECRET|PRIVATE_KEY|SERVICE_ROLE)[A-Z0-9_]*\s*[=:]\s*['"]?[A-Za-z0-9_\-/+=.]{16,}/],
];

const SKIP = /(^|\/)(node_modules|dist|marketing|\.git)(\/|$)|package-lock\.json$|\.(png|jpe?g|webp|gif|ico|mp4|pdf|woff2?|zip|xlsx)$|scripts\/check-secrets\.mjs$/;

function files() {
  try {
    return execSync('git ls-files -co --exclude-standard', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean);
  } catch {
    const out = [];
    const walk = (d) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (SKIP.test(p)) continue;
        statSync(p).isDirectory() ? walk(p) : out.push(p);
      }
    };
    walk('.');
    return out;
  }
}

const hits = [];
for (const f of files()) {
  if (SKIP.test(f) || f.startsWith('.env') && f !== '.env.example') continue;
  let text;
  try {
    text = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  text.split('\n').forEach((line, i) => {
    for (const [name, re] of PATTERNS) if (re.test(line)) hits.push(`  ${f}:${i + 1}  ${name}`);
  });
}

if (hits.length) {
  console.error(`\n✖ Se encontraron posibles secretos en el código:\n${hits.join('\n')}\n`);
  console.error('Muévelos a variables de entorno del servidor (nunca con prefijo VITE_) y cámbialos (rótalos) si ya se subieron a GitHub.\n');
  process.exit(1);
}
console.log('✓ Sin secretos en el código');
