# Flotimly — By Immtechnology

Software de gestión para empresas de transporte de carga (camiones y camionetas).

## Cómo abrirlo en tu Mac

- **Opción fácil:** doble clic en `Iniciar Flotimly.command` (la primera vez macOS puede pedir permiso: clic derecho → Abrir).
- **Desde la terminal:** `npm install` (sólo la primera vez) y luego `npm run dev`.

Se abre en http://localhost:5173 · Usuario demo: `admin@flotimly.cl` · Contraseña: `demo`

## Planes

| Módulo | Emprendedor | Pyme |
|---|:-:|:-:|
| Inicio (dashboard + resumen ejecutivo) | ✓ | ✓ |
| Flota (vehículos, conductores, vencimientos) | ✓ | ✓ |
| Operaciones (viajes, historial por camión, clientes) | ✓ | ✓ |
| Cotizaciones (costos, precio, PDF con tu marca y datos bancarios, convertir en viaje) | ✓ | ✓ |
| Gastos (combustible, peajes, mantenciones…) | ✓ | ✓ |
| Rentabilidad (por camión, viaje y cliente) | ✓ | ✓ |
| Configuración (empresa, parámetros, tarifas, usuarios, respaldos) | ✓ | ✓ |
| Planificación (calendario, arrastrar y soltar) | | ✓ |
| Facturas pendientes (por facturar, cobranza, antigüedad de deuda) | | ✓ |
| Comprobantes de entrega (firma digital, fotos, PDF) | | ✓ |

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
