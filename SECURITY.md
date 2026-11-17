# Seguridad de Flotimly

Este documento resume qué protege hoy la aplicación, qué falta y qué se hace en la versión en la nube.

> **Contexto importante.** La versión actual es una demo que guarda los datos en el navegador (`localStorage`).
> Las medidas del navegador protegen contra errores, usuarios con un rol limitado y robo casual del almacenamiento,
> pero **no contra quien controla el propio navegador**: esa persona puede modificar el código o los datos locales.
> La protección real de datos de clientes llega con el servidor (etapa B, Supabase), donde cada regla de abajo
> se repite en la base de datos.

## Lo que ya está implementado

| Área | Qué se hizo | Dónde |
|---|---|---|
| Contraseñas | Hash PBKDF2-SHA256 con 600.000 iteraciones y sal aleatoria. La contraseña nunca se guarda. Comparación en tiempo constante. Contraseñas antiguas en texto plano se convierten solas. | `src/lib/security.ts` |
| Política de contraseñas | Mínimo 8 caracteres, letras y números, sin palabras obvias ni el correo. | `passwordProblem` |
| Sesión | Token aleatorio, cierre por 8 h sin uso y a los 7 días. Cambiar contraseña, rol o desactivar a alguien cierra sus sesiones (versión de credenciales). Cerrar sesión en una pestaña la cierra en todas. | `src/lib/security.ts`, `src/store/store.tsx` |
| Límite de intentos | 5 intentos fallidos por correo, luego bloqueo de 1 min que se duplica hasta 1 h. Mismo tiempo de respuesta exista o no el usuario. | `registerLoginFailure` |
| Permisos por rol | Administrador, Operaciones, Finanzas y Conductor. Se aplican en el menú, en las rutas (URL directa) y en la capa de datos, que rechaza cualquier escritura no permitida. | `src/lib/permissions.ts` |
| Manipulación de campos | Reglas por campo (el conductor solo puede cambiar el estado de un viaje). Plan, usuarios y configuración solo los cambia un administrador. Restaurar un respaldo nunca cambia usuarios ni plan. Siempre queda al menos un administrador activo. | `writeProblem`, `store.tsx` |
| Validación de datos | RUT con dígito verificador, correo, teléfono, patente, sitio web (solo http/https), colores. Todo lo que se guarda pasa por `sanitizeRecord`: textos acotados, números finitos, sin claves peligrosas (`__proto__`), imágenes solo PNG/JPEG/WebP en base64. | `src/lib/validate.ts` |
| Archivos subidos | Límite de tamaño y tipo (imágenes 15 MB, Excel 10 MB, respaldo 60 MB). Las imágenes se vuelven a dibujar, lo que elimina contenido oculto. SVG bloqueado. | `imageProblem`, `MAX_UPLOAD` |
| Exportaciones | Protección contra inyección de fórmulas en CSV (`=`, `+`, `-`, `@`). | `csvCell` en `src/lib/portability.ts` |
| Headers HTTP | CSP estricta (solo código propio, sin `eval`, sin incrustarse en otros sitios), HSTS, `nosniff`, `X-Frame-Options`, COOP/CORP, Permissions-Policy. `npm run preview` usa los mismos headers. | `public/_headers`, `vite.config.ts` |
| Secretos | Escáner de secretos antes de cada compilación. La compilación falla si una variable secreta se expone con prefijo `VITE_`. `.env*` ignorado por Git. Historial de Git revisado: sin secretos. | `scripts/check-secrets.mjs`, `vite.config.ts`, `.env.example` |
| Dependencias | Vulnerabilidades altas corregidas (react-router 6.30.6, uuid 11.1.1). Dependabot revisa cada semana. | `package.json`, `.github/dependabot.yml` |

### Vulnerabilidades conocidas aceptadas

- `react-router` 6.x (2 moderadas): una afecta solo al renderizado en servidor (no se usa) y otra a navegar
  hacia direcciones escritas por el usuario (no se hace). Se resuelve al migrar a la versión 7.

## Pendiente en Cloudflare y GitHub (configuración, sin código)

1. **GitHub → Settings → Password and authentication**: activar verificación en dos pasos (2FA).
2. **Repositorio → Settings → Code security**: activar *Dependabot alerts* y *Secret scanning* si está disponible.
3. **Cloudflare → flotimly.cl → Seguridad → Bots**: activar *Bot Fight Mode* (gratis).
4. **Cloudflare → SSL/TLS**: modo *Full (strict)* y *Always Use HTTPS*.
5. **Cloudflare → Cuenta**: activar 2FA.

## Etapa B (Supabase): cómo se traslada cada medida al servidor

| Medida | En la nube |
|---|---|
| Contraseñas | Supabase Auth (bcrypt en el servidor). Se elimina el hash local. Recuperación de contraseña por correo. |
| Sesión | JWT de 1 hora con renovación rotativa. Cierre de sesión revoca el token en el servidor. Si se requieren cookies `HttpOnly`, se agrega una función de Cloudflare como intermediaria. |
| Límite de intentos | Límite nativo de Supabase Auth + regla de *Rate limiting* de Cloudflare en el ingreso. |
| Bots | Cloudflare Turnstile en ingreso y registro (Supabase Auth lo verifica de forma nativa). |
| Permisos y registros | Row Level Security en todas las tablas: cada empresa solo ve sus filas (`company_id`) y cada rol solo lo que le corresponde. Ejemplo abajo. |
| Manipulación de campos | Políticas RLS + triggers que impiden cambiar `company_id`, `plan`, `role` o montos desde el cliente. El plan solo lo cambia el sistema de pagos. |
| Validación | Restricciones en la base de datos (`check`, `not null`, largo máximo) y validación de RUT en una función SQL. |
| Datos sensibles | Cifrado en reposo (AES-256, incluido en Supabase) y en tránsito (TLS). Cuenta bancaria y RUT de conductores cifrados por columna con Supabase Vault si un cliente lo exige. No se guardan datos de tarjetas: los pagos van por un procesador externo. |
| Archivos | Supabase Storage con políticas por empresa y URLs firmadas que expiran. |
| Llaves de API | En el navegador solo la *anon key* (pública por diseño, protegida por RLS). La *service_role key* vive solo en funciones del servidor. |
| Auditoría | Tabla de registro de cambios (quién, qué, cuándo) y respaldos diarios. |

### Ejemplo de política RLS

```sql
-- Cada usuario pertenece a una empresa y tiene un rol
create table memberships (
  user_id uuid references auth.users primary key,
  company_id uuid not null references companies,
  role text not null check (role in ('Administrador','Operaciones','Finanzas','Conductor'))
);

alter table trips enable row level security;

-- Ver: solo viajes de la propia empresa
create policy "ver viajes de mi empresa" on trips for select
  using (company_id = (select company_id from memberships where user_id = auth.uid()));

-- Modificar: solo roles con permiso, y sin poder moverlo a otra empresa
create policy "editar viajes" on trips for update
  using (company_id = (select company_id from memberships where user_id = auth.uid())
         and (select role from memberships where user_id = auth.uid()) in ('Administrador','Operaciones','Finanzas'))
  with check (company_id = (select company_id from memberships where user_id = auth.uid()));
```

## Reportar un problema de seguridad

Escríbenos por WhatsApp al +56 9 5639 4348. No publiques detalles del problema hasta que esté corregido.
