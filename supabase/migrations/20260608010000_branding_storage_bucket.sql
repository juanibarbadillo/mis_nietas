-- ============================================================
-- Panel de Apariencia · bucket de Storage para imágenes de marca
-- ============================================================
-- Hero, Nosotros, logo y favicon se suben a un bucket público
-- `branding` y en `tema.imagenes` se guarda solo la URL pública
-- (no la imagen), así no infla la fila ni el payload del sitio.
-- Cada negocio escribe en su carpeta = negocio_id.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do update set public = true;

-- Lectura pública (el bucket es público; explícito por claridad).
drop policy if exists "branding_public_read" on storage.objects;
create policy "branding_public_read" on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'branding');

-- Escritura: solo el owner, dentro de su carpeta (primer segmento = negocio_id).
drop policy if exists "branding_owner_insert" on storage.objects;
create policy "branding_owner_insert" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'branding'
        and (storage.foldername(name))[1] in (select id::text from negocios where owner_id = auth.uid())
    );

drop policy if exists "branding_owner_update" on storage.objects;
create policy "branding_owner_update" on storage.objects
    for update to authenticated
    using (
        bucket_id = 'branding'
        and (storage.foldername(name))[1] in (select id::text from negocios where owner_id = auth.uid())
    );

drop policy if exists "branding_owner_delete" on storage.objects;
create policy "branding_owner_delete" on storage.objects
    for delete to authenticated
    using (
        bucket_id = 'branding'
        and (storage.foldername(name))[1] in (select id::text from negocios where owner_id = auth.uid())
    );
