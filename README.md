# Flotimly — By Immtechnology

Software de gestión para empresas de transporte de carga (camiones y camionetas).

## Cómo abrirlo en tu Mac

- **Opción fácil:** doble clic en `Iniciar Flotimly.command` (la primera vez macOS puede pedir permiso: clic derecho → Abrir).
- **Desde la terminal:** `npm install` (sólo la primera vez) y luego `npm run dev`.

Se abre en http://localhost:5173 · Usuario demo: `admin@flotimly.cl` · Contraseña: `demo`

## Planes

| Módulo | Emprendedor | Pyme | Flota Plus |
|---|:-:|:-:|:-:|
| **Precio (+ IVA / mes)** | $24.990 | $49.990 | $99.990 |
| **Vehículos** | hasta 3 | hasta 20 | hasta 50 |
| **Usuarios** | ilimitados | ilimitados | ilimitados |
| Inicio (dashboard + resumen ejecutivo) | ✓ | ✓ | ✓ |
| Flota (vehículos, conductores, vencimientos) | ✓ | ✓ | ✓ |
| Operaciones (viajes, historial por camión, clientes) | ✓ | ✓ | ✓ |
| Cotizaciones (costos, precio, PDF con tu marca y datos bancarios, convertir en viaje) | ✓ | ✓ | ✓ |
| Gastos (combustible, peajes, mantenciones…) | ✓ | ✓ | ✓ |
| Rentabilidad (por camión, viaje y cliente) | ✓ | ✓ | ✓ |
| Configuración (empresa, parámetros, tarifas, usuarios, respaldos) | ✓ | ✓ | ✓ |
| Planificación (calendario, arrastrar y soltar) | | ✓ | ✓ |
| Facturas pendientes (por facturar, cobranza, antigüedad de deuda) | | ✓ | ✓ |
| Comprobantes de entrega (firma digital, fotos, PDF) | | ✓ | ✓ |
| Carga inicial de datos, capacitación, soporte prioritario y acceso anticipado | | | ✓ |

Los planes, límites y textos se definen en un solo lugar: `src/lib/plans.ts`.
Los límites de vehículos son informativos (no bloquean). Pyme se destaca como "La opción más inteligente" (`RECOMMENDED`).

El plan se cambia en **Configuración → Plan** (en la versión local es libre, para probar).

## Datos y portabilidad

Versión local: los datos viven en el navegador (localStorage). En **Configuración → Datos**:

- **Exportar Excel (.xlsx):** una hoja por módulo + "Léeme" + "Diccionario" de columnas.
- **Paquete completo (.zip):** un CSV por módulo (UTF-8, `;`, fechas AAAA-MM-DD), firmas y fotos
  de comprobantes, logo y copia exacta en JSON.
- **Importar desde Excel:** plantilla descargable; vista previa con errores por fila antes de aplicar;
  reconoce registros existentes por ID, RUT, patente o N° de viaje (no duplica); se puede deshacer.
- **Respaldo técnico (JSON):** copia exacta para restaurar.

El formato de las hojas está definido una sola vez en `src/lib/portability.ts` (exportar, plantilla
y validación de importación usan la misma definición).

## Estructura

```
src/
  store/types.ts     Modelo de datos
  store/store.tsx    Persistencia (reemplazar por API al pasar a la nube)
  store/seed.ts      Datos de demostración
  lib/calc.ts        Cálculo de cotizaciones, rentabilidad, alertas, facturación
  components/        UI compartida (layout, modales, formularios)
  pages/             Una página por módulo
```

## Próximo paso: publicar en internet

Backend con base de datos (p. ej. PostgreSQL), autenticación real, separación de datos
por empresa (multi-tenant), cobro de suscripciones por plan y almacenamiento de fotos en la nube.

## Medición (analítica)

Dos capas, ambas gratuitas:

1. **Cloudflare Web Analytics**: visitas, páginas, países, dispositivos y de dónde llegan. Sin cookies y sin código:
   se activa en Cloudflare → Workers & Pages → flotimly → Métricas → Web Analytics.
2. **PostHog** (`src/lib/analytics.ts`): embudos y uso de funciones. Se activa con la variable `VITE_POSTHOG_KEY`
   en Cloudflare Pages (proyecto → Configuración → Variables y secretos). Sin esa variable no se carga nada.
   - Sin consentimiento mide en modo sin cookies (hay que activar la opción de modo sin cookies (*cookieless*) en la configuración del proyecto de PostHog).
   - Con consentimiento ("Aceptar" en el aviso) usa un identificador y graba sesiones con formularios y contenido de la app ocultos.
   - Nunca envía nombres, correos, RUT ni montos.

| Evento | Cuándo | Propiedades |
|---|---|---|
| `$pageview` | Cada página (portada y app) | URL sin parámetros |
| `pricing_viewed` | La sección de planes aparece en pantalla | — |
| `demo_started` | Clic en "Probar la demo" | `source`: hero, nav, cta, plan_… |
| `whatsapp_clicked` | Clic en un botón de WhatsApp | `location`, `plan` |
| `login_succeeded` / `login_failed` | Ingreso | `role`, `demo` / `reason` |
| `record_created` / `record_deleted` | Se crea o elimina un registro | `type`: trips, quotes, expenses… |
| `quote_pdf_opened` | Se abre el PDF de una cotización | — |
| `data_exported` / `data_imported` | Exportación o importación | `format` / `created`, `updated` |
| `upgrade_gate_viewed` | Se abre una función de un plan superior | `feature` |
| `plan_changed` | Cambio de plan | `from`, `to` |
| `action_denied` | Una acción bloqueada por permisos | `reason` |

Todos los eventos de la app llevan `role`, `plan` y `demo` (true para los usuarios de ejemplo).

**Modo interno:** abre cualquier página con `?interno` (por ejemplo `flotimly.cl/?interno`) y ese navegador deja de
enviar datos a PostHog, para que tus propias visitas no se mezclen con las de clientes. `?interno=no` lo desactiva.
Hay que hacerlo una vez en cada navegador y dispositivo. Cloudflare Web Analytics sí sigue contando esas visitas.
