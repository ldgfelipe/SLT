-- =====================================================================
-- GROWTH HUB - CRON ALTERNATIVO (planes gratuitos)
-- =====================================================================
-- El plan Hobby de Vercel solo permite 2 tareas programadas y todas
-- deben ser DIARIAS. Las frecuencias que pedimos (*/5, 0 * * * *) no
-- pueden configurarse en Vercel con el plan gratuito.
--
-- Solución: delegamos en los propios proyectos de Supabase usando la
-- extensión `pg_cron` + `pg_net`:
--
--   /api/publish/cron        -> cada 5  minutos
--   /api/campaigns/sync      -> cada hora
--   /api/auth/refresh-tokens -> diaria a las 06:00
--
-- Por qué una tabla en vez de ALTER DATABASE ... SET:
--   Supabase no permite setear parámetros globales `app.*` desde el
--   SQL editor (permission denied to set parameter). En su lugar la
--   configuración se guarda en `growth_hub_settings` (una sola fila).
--
-- PASOS:
--   1. Crear extensión pg_cron y pg_net (SQL editor o dashboard).
--   2. Ejecutar este archivo.
--   3. Configurar el secreto (reemplaza TU_CRON_SECRET por el mismo
--      valor de la variable CRON_SECRET de Vercel):
--        select public.growth_hub_configure('TU_CRON_SECRET');
--      (opcional, si el app está en otro dominio:)
--        select public.growth_hub_configure('TU_CRON_SECRET', 'https://slt-xi.vercel.app');
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------
-- Configuración interna (una sola fila)
-- ---------------------------------------------------------------------
create table if not exists growth_hub_settings (
  id boolean primary key default true,
  base_url text not null default 'https://slt-xi.vercel.app',
  cron_secret text,
  updated_at timestamptz not null default now(),
  constraint growth_hub_settings_single_row check (id)
);

alter table growth_hub_settings enable row level security;
-- Sin policies: ningún rol de la API puede leer ni escribir la tabla.
-- Las funciones del cron la leen por ser SECURITY DEFINER (dueño postgres).
revoke all on table growth_hub_settings from anon, authenticated;

-- ---------------------------------------------------------------------
-- Configurar/actualizar el secreto
-- ---------------------------------------------------------------------
create or replace function public.growth_hub_configure(
  p_cron_secret text,
  p_base_url text default 'https://slt-xi.vercel.app'
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_cron_secret is null or btrim(p_cron_secret) = '' then
    raise exception 'El CRON_SECRET no puede estar vacío.';
  end if;

  insert into growth_hub_settings (id, base_url, cron_secret, updated_at)
  values (true, rtrim(p_base_url, '/'), btrim(p_cron_secret), now())
  on conflict (id) do update
    set base_url = excluded.base_url,
        cron_secret = excluded.cron_secret,
        updated_at = now();
end;
$$;

revoke all on function public.growth_hub_configure(text, text) from public, anon, authenticated;
grant execute on function public.growth_hub_configure(text, text) to service_role;

-- ---------------------------------------------------------------------
-- Helper HTTP interno hacia el Growth Hub
-- ---------------------------------------------------------------------
create or replace function public.growth_hub_http_post(path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_url text;
  v_secret text;
begin
  select base_url, cron_secret
    into v_base_url, v_secret
    from growth_hub_settings
   where id;

  if v_secret is null or btrim(v_secret) = '' then
    raise notice 'growth_hub: falta ejecutar growth_hub_configure()';
    return;
  end if;

  perform net.http_post(
    uri := rtrim(v_base_url, '/') || path,
    method := 'POST',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || btrim(v_secret)
    ),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function public.growth_hub_http_post(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Wrappers públicos (usados por pg_cron)
-- ---------------------------------------------------------------------
create or replace function public.growth_hub_trigger_publish_due()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.growth_hub_http_post('/api/publish/cron');
end;
$$;

create or replace function public.growth_hub_trigger_campaigns_sync()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.growth_hub_http_post('/api/campaigns/sync');
end;
$$;

create or replace function public.growth_hub_trigger_token_refresh()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.growth_hub_http_post('/api/auth/refresh-tokens');
end;
$$;

revoke all on function public.growth_hub_trigger_publish_due() from public, anon, authenticated;
revoke all on function public.growth_hub_trigger_campaigns_sync() from public, anon, authenticated;
revoke all on function public.growth_hub_trigger_token_refresh() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Programar los jobs (idempotente: desagenda si ya existen)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'growth_hub_publish_due') then
    perform cron.unschedule('growth_hub_publish_due');
  end if;
  if exists (select 1 from cron.job where jobname = 'growth_hub_campaigns_sync') then
    perform cron.unschedule('growth_hub_campaigns_sync');
  end if;
  if exists (select 1 from cron.job where jobname = 'growth_hub_token_refresh') then
    perform cron.unschedule('growth_hub_token_refresh');
  end if;
end $$;

select cron.schedule('growth_hub_publish_due', '*/5 * * * *', 'select public.growth_hub_trigger_publish_due()');
select cron.schedule('growth_hub_campaigns_sync', '0 * * * *', 'select public.growth_hub_trigger_campaigns_sync()');
select cron.schedule('growth_hub_token_refresh', '0 6 * * *', 'select public.growth_hub_trigger_token_refresh()');

-- ---------------------------------------------------------------------
-- Verificación manual (opcional):
--   select public.growth_hub_trigger_publish_due();
--   select jobname, schedule, active from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
-- ---------------------------------------------------------------------
