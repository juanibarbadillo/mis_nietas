-- ============================================================
-- Keepalive · rastro del cron que evita que Supabase pause
-- ============================================================
-- El plan free pausa el proyecto tras 7 días sin requests (ya nos
-- pasó: el 12/10/2026 hubo que restaurarlo a mano y el panel admin
-- quedó sin poder loguear). Un cron diario de Vercel llama a
-- `registrar_keepalive()` y el UPDATE cuenta como actividad real.
--
-- Una sola fila que se actualiza en cada corrida. Sirve para dos
-- cosas a la vez:
--   1) el UPDATE es escritura real contra la base, así que cuenta
--      como uso y evita la pausa por inactividad;
--   2) deja verificable "cuándo corrió por última vez" con un solo
--      select, sin depender de los logs de Vercel ni de Supabase
--      (los dos con retención corta).
--
-- Idempotente: se puede correr dos veces sin romper nada.
-- ============================================================

create table if not exists public.keepalive_pings (
    id          int primary key default 1,
    ultimo_ping timestamptz not null default now(),
    corridas    bigint not null default 0,
    constraint keepalive_pings_una_sola_fila check (id = 1)
);

insert into public.keepalive_pings (id, ultimo_ping, corridas)
    values (1, now(), 0)
    on conflict (id) do nothing;

-- RLS prendido y sin políticas: con la publishable key (la única que
-- llega al navegador) no se lee ni se escribe nada acá. Solo el cron,
-- que usa la service role key y saltea RLS.
alter table public.keepalive_pings enable row level security;

-- Registra una corrida. Va como función para que el incremento del
-- contador sea atómico (un solo UPDATE), en vez de leer-y-escribir
-- desde la app.
create or replace function public.registrar_keepalive()
returns table (ultimo_ping timestamptz, corridas bigint)
language sql
as $$
    update public.keepalive_pings
       set ultimo_ping = now(),
           corridas    = keepalive_pings.corridas + 1
     where id = 1
    returning keepalive_pings.ultimo_ping, keepalive_pings.corridas;
$$;

-- Postgres otorga EXECUTE a PUBLIC por defecto, y PostgREST expone las
-- funciones de public: sin esto, cualquiera con la publishable key
-- podría invocarla.
revoke all on function public.registrar_keepalive() from public, anon, authenticated;
grant execute on function public.registrar_keepalive() to service_role;
