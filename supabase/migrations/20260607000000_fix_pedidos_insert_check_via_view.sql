-- Fix: permitir que el público (anon) cree pedidos.
--
-- Causa raíz: la policy `pedidos_public_insert` validaba el negocio contra la
-- tabla `negocios`, pero su SELECT quedó restringido al dueño
-- (`negocios_owner_select`, role authenticated) para proteger las columnas
-- google_*. Por eso el `EXISTS (... FROM negocios ...)` devuelve 0 filas para
-- un visitante anónimo y el INSERT del pedido es rechazado por RLS (42501).
--
-- Solución: validar contra la vista pública `negocios_public` (security definer,
-- con GRANT SELECT a anon y solo columnas no sensibles, incluida `activo`).

drop policy if exists pedidos_public_insert on pedidos;

create policy pedidos_public_insert
on pedidos
for insert
to anon, authenticated
with check (
    exists (
        select 1
        from negocios_public
        where negocios_public.id = pedidos.negocio_id
          and negocios_public.activo = true
    )
);
