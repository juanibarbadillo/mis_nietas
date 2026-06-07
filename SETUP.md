# Setup — Regionales Mis Nietas

Guía paso a paso para dejar la web andando con **Supabase** (base de datos) y **Vercel** (hosting). Seguila en orden. Tiempo estimado: ~20-30 min.

Resumen de lo que vas a hacer:

1. Crear proyecto en Supabase y aplicar las migraciones (crea las tablas).
2. Crear tu usuario admin y el "negocio" con slug `misnietas`.
3. Copiar las 2 claves de Supabase.
4. Subir el código a GitHub.
5. Importar el repo en Vercel y pegar las 2 claves.
6. Cargar productos y zonas desde el panel admin.

---

## 1. Crear el proyecto en Supabase

1. Entrá a <https://supabase.com> → **New project**.
2. Nombre: `regionales-mis-nietas` (o el que quieras). Región: **South America (São Paulo)** (la más cercana).
3. Anotá la **Database password** que te genera (la vas a necesitar si usás el CLI).
4. Esperá ~2 min a que el proyecto quede listo.

## 2. Aplicar las migraciones (crear las tablas)

Tenés dos caminos. **El más simple es el manual (B).**

### Opción B — Manual (Studio, recomendado si no querés instalar nada)

1. En Supabase, abrí **SQL Editor → New query**.
2. Abrí los archivos de la carpeta `supabase/migrations/` **en este orden** y, uno por uno, copiá su contenido, pegalo en el editor y dale **Run**:

   1. `20260514120000_init.sql`
   2. `20260515120000_multi_tenant_schema.sql`
   3. `20260515150000_rls_lockdown.sql`
   4. `20260515160000_drop_legacy_public_policies.sql`
   5. `20260515170000_enable_realtime_pedidos.sql`
   6. `20260515180000_sheets_integration_schema.sql`

   Son idempotentes: si una la corrés dos veces no rompe nada.

### Opción A — Supabase CLI (si ya lo tenés o trabajás desde varias PCs)

```bash
supabase login
supabase link --project-ref <TU-PROJECT-REF>   # Settings → General → Reference ID
supabase db push                                 # aplica todas las migraciones
```

## 3. Crear tu usuario admin

1. Supabase → **Authentication → Users → Add user**.
2. Email + password (los que vas a usar para entrar a `/login`).
3. Marcá **Auto Confirm User** (para no tener que verificar el mail).
4. Copiá el **UUID** del usuario recién creado.

## 4. Crear el negocio (slug `misnietas`)

En **SQL Editor → New query**, pegá esto reemplazando los `<...>`:

```sql
-- <UUID-DEL-USER>: el UUID del paso 3
-- <TU-WHATSAPP>: número internacional, sin + ni espacios. Ej: 5492604123456
insert into negocios (slug, nombre_negocio, telefono_negocio, owner_id)
values ('misnietas', 'Regionales Mis Nietas', '<TU-WHATSAPP>', '<UUID-DEL-USER>');
```

> ⚠️ El slug **tiene que ser exactamente `misnietas`**: es el que la web usa para encontrar el negocio. El `nombre_negocio` y el `telefono_negocio` son los que aparecen en la página y en el botón de WhatsApp (los podés editar después desde el panel admin → Configuración).

Verificá que se creó:

```sql
select slug, nombre_negocio, telefono_negocio from negocios;
```

## 5. Copiar las claves de Supabase

Supabase → **Project Settings → API**. Copiá:

- **Project URL** → es tu `VITE_SUPABASE_URL`
- **anon public** key → es tu `VITE_SUPABASE_ANON_KEY`

(La key `anon` es pública por diseño; la seguridad la da el RLS que aplicaste en el paso 2. **Nunca** uses la `service_role` en el front.)

### (Opcional) Probar local

```bash
npm install
cp .env.example .env     # pegá las 2 claves en .env
npm run dev              # abrí http://localhost:5173/u/index.html
```

## 6. Subir el código a GitHub

El repo es **https://github.com/juanibarbadillo/mis_nietas**. (En esta máquina ya está commiteado y con el remote configurado; si hace falta, el comando es `git push -u origin main`.)

## 7. Importar en Vercel

1. Entrá a <https://vercel.com> → **Add New → Project** → importá `juanibarbadillo/mis_nietas`.
2. Vercel detecta el `vercel.json` (build `npm run build`, output `dist/`). No cambies nada.
3. En **Environment Variables**, agregá las dos (para Production, Preview y Development):

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | tu Project URL |
   | `VITE_SUPABASE_ANON_KEY` | tu anon public key |

4. **Deploy**. Cuando termine, abrí la URL que te da Vercel.

> Si agregás las env vars **después** del primer deploy, andá a **Deployments → … → Redeploy** para que tomen efecto.

## 8. Verificación final

- `https://tu-sitio.vercel.app/` → muestra el catálogo (vacío al principio, es normal).
- `https://tu-sitio.vercel.app/login` → entrás con el usuario del paso 3.
- En el panel: **Catálogo** (cargar productos), **Zonas** (dibujar zonas de delivery en el mapa), **Pedidos** (llegan en tiempo real), **Configuración** (nombre y WhatsApp).

## 9. Cargar el catálogo

Entrá a `/dashboard/menu.html` (botón **Catálogo**) → **+ Agregar producto**. Las categorías disponibles son: *Dulces y Mermeladas, Dulce de Leche, Conservas, Aceite de Oliva, Vinos, Cerveza Artesanal, Frutos Secos*.

> Para **agregar/quitar categorías** hay que tocar dos lugares en el código: el `<select id="prod-categoria">` en `dashboard/menu.html` y la lista `UMASUSHI_MENU_CATEGORIAS` en `menu-store.js` (tienen que coincidir).

---

## Detalles que conviene ajustar más adelante

- **Logo / favicon**: ahora hay un wordmark de texto ("Regionales Mis Nietas" con la tipografía Fraunces) y un favicon provisorio (`favicon.svg`, un frasco). Cuando tengas el logo real, reemplazá `favicon.svg` y, si querés, agregá una imagen de logo en el header.
- **Horarios**: están como placeholder en `u/index.html` ("Lunes a sábado de 9 a 13 y de 17 a 21 hs"). Editalos con los reales.
- **og:image** (vista previa al compartir en WhatsApp): en `u/orden.html` apunta a `/favicon.svg`. Cuando tengas dominio propio podés poner la URL absoluta de una imagen linda.
- **Ubicación del mapa**: el mapa de delivery centra por defecto en Atuel Norte, San Rafael (`-34.7493, -68.0575`).
- **Google Sheets** (opcional): integración para volcar pedidos a una planilla. Ver `docs/SHEETS_SETUP.md`.
