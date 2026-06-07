-- ============================================================
-- Panel de Apariencia · columna `tema` (JSON) en negocios
-- ============================================================
-- Guarda toda la personalización visual y de contenido del sitio
-- público en un solo lugar: colores, fuentes, textos, contacto,
-- imágenes y SEO. El front la lee al cargar y la aplica; cualquier
-- campo vacío usa el valor por defecto del código (fallback), así
-- la página nunca se rompe.
-- ============================================================

alter table negocios add column if not exists tema jsonb not null default '{}'::jsonb;

-- Re-exponer la vista pública incluyendo `tema`.
-- Usamos CREATE OR REPLACE (en vez de drop+create) para NO romper la
-- policy de pedidos_public_insert que depende de negocios_public.
-- Solo se permite agregar columnas nuevas al final.
create or replace view negocios_public
with (security_invoker = false) as
select
    id,
    slug,
    nombre_negocio,
    telefono_negocio,
    activo,
    created_at,
    tema
from negocios
where activo = true;

grant select on negocios_public to anon, authenticated;

-- Forzar a PostgREST a recargar el cache de schema.
notify pgrst, 'reload schema';
