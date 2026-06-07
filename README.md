# Regionales Mis Nietas 🫙

Tienda online de **productos regionales artesanales** de San Rafael, Mendoza: dulce de leche y mermeladas de elaboración propia, vinos caseros, aceite de oliva, conservas y frutos secos. Catálogo, pedidos por WhatsApp y panel de administración.

> Instagram: [@regionales.misnietas](https://instagram.com/regionales.misnietas) · Atuel Norte, San Rafael, Mendoza

## ✨ Funcionalidades

- **Catálogo público** — Productos por categoría con etiquetas (veggie, gluten free).
- **Carrito de compras** — Pedido con cálculo de envío y confirmación por **WhatsApp**.
- **Dashboard administrador** — Panel CRUD para gestionar productos, pedidos y zonas de delivery.
- **Mapa interactivo** — Zonas de delivery dibujadas con Leaflet + OpenStreetMap.
- **Tiempo real** — Pedidos entrantes en vivo vía Supabase Realtime.
- **Multi-negocio** — Arquitectura multi-tenant: cada negocio se resuelve por su `slug` (acá: `misnietas`).
- **Autenticación** — Login por email/contraseña con Supabase Auth y RLS.

## 🛠️ Stack

| Tecnología | Propósito |
|---|---|
| [Vite](https://vitejs.dev/) (MPA) | Build tool, múltiples páginas sin framework |
| [Supabase](https://supabase.com/) | PostgreSQL, Auth, Realtime, Storage |
| [Leaflet](https://leafletjs.com/) + OSM | Mapas de zonas de delivery |
| [Vercel](https://vercel.com/) | Despliegue y hosting |

## 🚀 Desarrollo local

```bash
npm install
cp .env.example .env   # completar con tus claves de Supabase
npm run dev            # http://localhost:5173/u/index.html
npm run build          # genera dist/
```

Variables de entorno necesarias (ver `.env.example`):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## ⚙️ Puesta en producción

El paso a paso completo (Supabase + Vercel + crear el negocio) está en **[`SETUP.md`](./SETUP.md)**.
El schema de la base y las migraciones, en **[`MIGRATIONS.md`](./MIGRATIONS.md)**.

## 🗺️ Rutas

| Ruta | Página |
|---|---|
| `/` → `/u/index.html` | Catálogo público |
| `/u/pedido.html` | Carrito / pedido |
| `/login` | Login admin |
| `/dashboard` | Panel de administración |

---

Basado en una plataforma multi-tenant de pedidos. Adaptado y re-marcado para Regionales Mis Nietas.
