# Regionales Mis Nietas

Tienda online de productos regionales artesanales de San Rafael, Mendoza (dulce de
leche, mermeladas, vinos caseros, aceite de oliva, conservas). Catálogo público,
pedidos por WhatsApp y panel de administración.

Emiliano guía el trabajo paso a paso: no adelantarse a features ni scaffoldear cosas
que no pidió. Español rioplatense en textos de UI y en docs.

## Stack

Vite en modo MPA (`appType: 'mpa'`), **sin framework**: HTML por página y JS vanilla
en módulos. Nada de React ni de un router de cliente. Supabase para Postgres, Auth,
Realtime y Storage. Leaflet + OpenStreetMap para las zonas de delivery. Deploy en
Vercel.

Las páginas se declaran una por una en `rollupOptions.input` de `vite.config.js`:
**si agregás un HTML nuevo, hay que sumarlo ahí o no entra al build.**

| Carpeta | Qué es |
|---|---|
| `u/` | Sitio público: catálogo, pedido, orden |
| `dashboard/` | Panel admin (requiere sesión) |
| `login/` | Login con Supabase Auth |
| `services/` | Capa de acceso a datos; todo pasa por acá |
| `src/pages/` | Un módulo por página, enganchado desde el HTML |
| `shared/` | `auth-guard.js` y el shell del dashboard |
| `supabase/migrations/` | Esquema, en orden cronológico |

## Infra

- **Supabase**: proyecto `imasrtapvgxnltashuao` (`https://imasrtapvgxnltashuao.supabase.co`),
  plan free. Multi-tenant por `slug`; acá el negocio es `misnietas`.
- **Vercel**: team `juanibarbadillos-projects`, proyecto `mis-nietas`
  (`prj_KaPT77ZiUtLnBD0VKKkRK2SvwAlG`). Buildea `main` automáticamente.
- **GitHub**: `juanibarbadillo/mis_nietas`. Emiliano pushea como `emisorato1`
  (tiene push, no admin: no puede crear repo secrets ni tocar settings).
- **Dominios**: `regionalesmisnietas.vercel.app` es el bueno.
  `mis-nietas-kappa.vercel.app` queda como alias por los links que ya circulan
  en WhatsApp. `mis-nietas.vercel.app` y `misnietas.vercel.app` están tomados por
  deployments ajenos: no se pueden reclamar.

### Credenciales

Están todas en **`.env.local` en la raíz, gitignoreado**: URL y claves de Supabase
(publishable y secreta), `CRON_SECRET` y el token de Vercel con sus IDs.

Decisión de Emiliano: Claude Code las usa directo desde ahí, sin preguntar.
**Nunca copiarlas a un archivo versionado** — GitHub tiene secret scanning con
Supabase de partner, así que un `sb_secret_…` commiteado dispara la revocación
automática de la clave y deja el proyecto sin backend.

## Cron keepalive (no tocar)

El plan free de Supabase pausa el proyecto tras 7 días sin requests. **El 12/10/2026
pasó**: el host quedó sin registro DNS (NXDOMAIN), hubo que restaurarlo a mano desde
el dashboard y tardó ~3 minutos en levantar. Mientras estuvo caído, el panel no podía
loguear porque toda llamada a Supabase moría antes de salir a la red. El catálogo
público disimulaba el problema pintando desde la caché de `localStorage` de
`menu-store.js`, así que parecía que solo fallaba el admin.

Lo evita un cron diario de Vercel (9:00 UTC) definido en `vercel.json`, que pega a
`/api/keepalive` y ejecuta el RPC `registrar_keepalive()`. El `UPDATE` cuenta como
actividad real y deja rastro en `keepalive_pings` (`ultimo_ping`, `corridas`), que se
puede chequear con un select sin depender de logs.

`api/keepalive.js` es una función serverless de Vercel en CommonJS. Reusa
`VITE_SUPABASE_URL` (ya estaba cargada para el build) y la service role key, que es
server-only. Está guardada con `CRON_SECRET`. **Vercel levanta la carpeta `/api`
aunque el proyecto tenga `framework: null`** — verificado en producción, no hace falta
Next.js.

## RLS: cómo leer `negocios`

Hay una trampa que ya hizo perder tiempo una vez. La tabla `negocios` **no** es
legible por anónimos: desde `20260515180000_sheets_integration_schema.sql` la única
policy de SELECT es `negocios_owner_select`, que exige `owner_id = auth.uid()`.

- El **sitio público** lee la vista `negocios_public` (solo negocios activos, sin
  `owner_id`), que tiene `grant select` a `anon`.
- El **dashboard** lee la tabla cruda, y funciona porque hay sesión.

Si consultás `negocios` con la publishable key y te devuelve `[]`, **eso es lo
correcto**, no un síntoma de que algo se rompió.

Otras policies, de `20260515150000_rls_lockdown.sql`: `productos` y `zonas_delivery`
son de lectura pública y escritura solo del owner; `pedidos` tiene SELECT e INSERT
públicos (el link de WhatsApp `/u/orden.html?id=<uuid>` necesita leer sin sesión; la
protección es que los UUID son inadivinables) y UPDATE solo del owner.

## Migraciones

Son idempotentes (`if not exists` / `drop policy if exists`) y se aplican a mano desde
el SQL Editor de Supabase, en orden cronológico — ver `SETUP.md`. No hay CLI de
Supabase instalado en esta Mac.
