-- ============================================================
-- Catálogo · galería de fotos por producto + secciones editables
-- ============================================================
-- 1) productos.imagenes: array (jsonb) de URLs públicas. La foto
--    principal es imagenes[0] y se sigue espejando en `imagen`
--    (compatibilidad con el render actual y los productos viejos).
-- 2) negocios.secciones: array (jsonb) ordenado de nombres de
--    sección/categoría. El dashboard lo administra y el sitio
--    público respeta ese orden. NO va dentro de `tema` a propósito:
--    el panel de Apariencia reescribe `tema` entero y borraría las
--    secciones.
-- ============================================================

alter table productos add column if not exists imagenes jsonb not null default '[]'::jsonb;
alter table negocios  add column if not exists secciones jsonb not null default '[]'::jsonb;

-- Re-exponer la vista pública incluyendo `secciones`.
-- CREATE OR REPLACE (no drop+create) para NO romper la policy
-- pedidos_public_insert que depende de negocios_public. Solo se
-- permite agregar columnas nuevas al final.
create or replace view negocios_public
with (security_invoker = false) as
select
    id,
    slug,
    nombre_negocio,
    telefono_negocio,
    activo,
    created_at,
    tema,
    secciones
from negocios
where activo = true;

grant select on negocios_public to anon, authenticated;

-- Forzar a PostgREST a recargar el cache de schema.
notify pgrst, 'reload schema';
