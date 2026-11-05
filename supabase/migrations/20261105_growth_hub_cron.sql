-- =====================================================================
-- GROWTH HUB - CRON ALTERNATIVO (planes gratuitos)
-- =====================================================================
-- El plan Hobby de Vercel solo permite 2 tareas programadas y todas
-- deben ser DIARIAS. Las frecuencias que pedimos (*/5, 0 * * * *) no
-- pueden configurarse en Vercel con el plan gratuito.
--
-- Solución: delegamos en los propios proyectos de Supabase usando la
-- extensión `pg_cron` + `pg_net` (ambas disponibles en hosted Supabase):
--
--   /api/publish/cron        -> cada 5  minutos
--   /api/campaigns/sync       -> cada hora
--   /api/auth/refresh-tokens  -> diaria a las 06:00
--
-- Requisitos:
--   1. Habilitar la extensión pg_cron en el proyecto de Supabase.
--   2. Habilitar la extensión pg_net en el proyecto de Supabase.
--   3. Variables de base de datos (o ALTER DATABASE) con:
--        - app.cron_secret = <CRON_SECRET de Vercel>
--        - app.supabase_api_key = <SUPABASE_ANON_KEY o SERVICE_ROLE>
--
-- NOTA: si la extensión pg_net no está disponible en la región, reemplazar
-- la función growth_hub_http_post por una llamada a Edge Function de Supabase.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Endpoint HTTP hacia el Growth Hub (crea un job programado en pg_cron).
create or replace function growth_hub_http_post(
  target_url text,
  payload jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    uri := target_url,
    method := 'POST',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', coalesce(nullif(current_setting('app.supabase_api_key', true), ''), ''),
      'Authorization', 'Bearer ' || coalesce(nullif(current_setting('app.cron_secret', true), ''), '')
    ),
    body := coalesce(payload::text, '{}')
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Publicación automática: cada 5 minutos -> /api/publish/cron
-- ---------------------------------------------------------------------
create or replace function growth_hub_trigger_publish_due()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform growth_hub_http_post(
    target_url := 'https://slt-xi.vercel.app/api/publish/cron',
    payload := '{}'::jsonb
  );
end;
$$;

select cron.schedule('growth_hub_publish_due', '*/5 * * * *', 'select growth_hub_trigger_publish_due()');

-- ---------------------------------------------------------------------
-- 2. Sincronización de campañas Meta Ads: cada hora -> /api/campaigns/sync
-- ---------------------------------------------------------------------
create or replace function growth_hub_trigger_campaigns_sync()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform growth_hub_http_post(
    target_url := 'https://slt-xi.vercel.app/api/campaigns/sync?client_id=' ||
      coalesce((select client_id from public.clients order by created_at limit 1), ''),
    payload := '{}'::jsonb
  );
end;
$$;

select cron.schedule('growth_hub_campaigns_sync', '0 * * * *', 'select growth_hub_trigger_campaigns_sync()');

-- ---------------------------------------------------------------------
-- 3. Refresh de tokens diarios -> /api/auth/refresh-tokens
-- ---------------------------------------------------------------------
create or replace function growth_hub_trigger_token_refresh()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform growth_hub_http_post(
    target_url := 'https://slt-xi.vercel.app/api/auth/refresh-tokens',
    payload := '{}'::jsonb
  );
end;
$$;

select cron.schedule('growth_hub_token_refresh', '0 6 * * *', 'select growth_hub_trigger_token_refresh()');
