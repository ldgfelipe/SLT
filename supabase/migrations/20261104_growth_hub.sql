-- =====================================================================
-- INVENTSER GROWTH HUB
-- Cuentas sociales, calendario de publicación automática, campañas Ads
-- y atribución de tráfico por UTM.
--
-- Idempotente: se puede ejecutar varias veces en el SQL Editor.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'provider_type') then
    create type provider_type as enum (
      'facebook',
      'instagram',
      'tiktok',
      'linkedin',
      'x',
      'threads',
      'youtube'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'post_status') then
    create type post_status as enum (
      'draft',
      'queued',
      'publishing',
      'published',
      'failed'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. CUENTAS SOCIALES
-- Los tokens se guardan SIEMPRE cifrados (AES-256-GCM) por la app.
-- ---------------------------------------------------------------------
create table if not exists social_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  provider provider_type not null,
  account_name text not null,
  page_id text,
  ig_user_id text,
  access_token_encrypted text not null,
  refresh_token text,
  token_expires_at timestamptz,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_social_accounts_client
  on social_accounts (client_id, provider);

create unique index if not exists idx_social_accounts_unique
  on social_accounts (client_id, provider, account_name);

-- ---------------------------------------------------------------------
-- 3. CAMPAÑAS ADS
-- ---------------------------------------------------------------------
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  objective text,
  provider text not null default 'meta',
  external_campaign_id text,
  budget numeric(14, 2) not null default 0,
  spend numeric(14, 2) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  leads integer not null default 0,
  conversions integer not null default 0,
  revenue numeric(14, 2) not null default 0,
  visits integer not null default 0,
  status text not null default 'active',
  starts_at timestamptz,
  ends_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_campaigns_client
  on campaigns (client_id, created_at desc);

create unique index if not exists idx_campaigns_external
  on campaigns (client_id, provider, external_campaign_id)
  where external_campaign_id is not null;

-- ---------------------------------------------------------------------
-- 4. PUBLICACIONES
-- ---------------------------------------------------------------------
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  social_account_id uuid references social_accounts(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete set null,
  titulo text not null,
  descripcion text,
  imagen_url text,
  plataformas text[] not null default '{}',
  scheduled_at timestamptz,
  status post_status not null default 'draft',
  external_post_ids jsonb not null default '{}'::jsonb,
  error_log text,
  attempts integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_posts_client_scheduled
  on posts (client_id, scheduled_at);

create index if not exists idx_posts_due
  on posts (scheduled_at)
  where status = 'queued';

-- ---------------------------------------------------------------------
-- 5. LOGS DE PUBLICACIÓN
-- ---------------------------------------------------------------------
create table if not exists publish_logs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  provider text,
  attempt integer not null default 1,
  status text,
  response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_publish_logs_post
  on publish_logs (post_id, created_at desc);

-- ---------------------------------------------------------------------
-- 6. SESIONES OAUTH (picker de páginas/cuentas tras el callback)
-- Los tokens de esta tabla también van cifrados.
-- ---------------------------------------------------------------------
create table if not exists social_oauth_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  provider provider_type not null,
  accounts jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null default now() + interval '30 minutes',
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_oauth_sessions_expires
  on social_oauth_sessions (expires_at);

-- ---------------------------------------------------------------------
-- 7. ATRIBUCIÓN DE TRÁFICO A CAMPAÑAS
-- tracking_events es la tabla real de tráfico en este proyecto.
-- ---------------------------------------------------------------------
alter table tracking_events
  add column if not exists utm_campaign text;

alter table tracking_events
  add column if not exists campaign_id uuid references campaigns(id) on delete set null;

create index if not exists idx_events_campaign_created
  on tracking_events (campaign_id, created_at desc);

create or replace function link_traffic_to_campaign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  site_client_id uuid;
  matched_campaign_id uuid;
begin
  -- Si la app ya asignó la campaña, se respeta.
  if new.campaign_id is not null then
    return new;
  end if;

  if new.utm_campaign is null or btrim(new.utm_campaign) = '' then
    return new;
  end if;

  select client_id into site_client_id
  from tracking_sites
  where id = new.tracking_site_id;

  if site_client_id is null then
    return new;
  end if;

  select id into matched_campaign_id
  from campaigns
  where client_id = site_client_id
    and provider = 'meta'
    and (
      lower(name) = lower(btrim(new.utm_campaign))
      or external_campaign_id = btrim(new.utm_campaign)
    )
  order by created_at desc
  limit 1;

  if matched_campaign_id is not null then
    new.campaign_id := matched_campaign_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_link_traffic_to_campaign on tracking_events;
create trigger trg_link_traffic_to_campaign
  before insert or update of utm_campaign on tracking_events
  for each row execute function link_traffic_to_campaign();

-- ---------------------------------------------------------------------
-- 8. RLS
-- La app usa service_role en el servidor. Las policies de authenticated
-- son defensa en profundidad para el cliente Supabase.
-- Nota: la autenticación de SLT es propia (tabla users), no Supabase Auth.
-- ---------------------------------------------------------------------
alter table social_accounts enable row level security;
alter table campaigns enable row level security;
alter table posts enable row level security;
alter table publish_logs enable row level security;
alter table social_oauth_sessions enable row level security;

drop policy if exists "Service role manages social accounts" on social_accounts;
create policy "Service role manages social accounts"
  on social_accounts for all to service_role
  using (true) with check (true);

drop policy if exists "Client users read social accounts" on social_accounts;
create policy "Client users read social accounts"
  on social_accounts for select to authenticated
  using (
    client_id in (
      select u.client_id from users u where u.id = auth.uid()
    )
  );

drop policy if exists "Service role manages campaigns" on campaigns;
create policy "Service role manages campaigns"
  on campaigns for all to service_role
  using (true) with check (true);

drop policy if exists "Client users read campaigns" on campaigns;
create policy "Client users read campaigns"
  on campaigns for select to authenticated
  using (
    client_id in (
      select u.client_id from users u where u.id = auth.uid()
    )
  );

drop policy if exists "Service role manages posts" on posts;
create policy "Service role manages posts"
  on posts for all to service_role
  using (true) with check (true);

drop policy if exists "Client users read posts" on posts;
create policy "Client users read posts"
  on posts for select to authenticated
  using (
    client_id in (
      select u.client_id from users u where u.id = auth.uid()
    )
  );

drop policy if exists "Service role manages publish logs" on publish_logs;
create policy "Service role manages publish logs"
  on publish_logs for all to service_role
  using (true) with check (true);

drop policy if exists "Client users read publish logs" on publish_logs;
create policy "Client users read publish logs"
  on publish_logs for select to authenticated
  using (
    exists (
      select 1 from posts p
      where p.id = publish_logs.post_id
        and p.client_id in (
          select u.client_id from users u where u.id = auth.uid()
        )
    )
  );

drop policy if exists "Service role manages oauth sessions" on social_oauth_sessions;
create policy "Service role manages oauth sessions"
  on social_oauth_sessions for all to service_role
  using (true) with check (true);

-- ---------------------------------------------------------------------
-- 9. STORAGE: bucket público inventser-images
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('inventser-images', 'inventser-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read inventser images" on storage.objects;
create policy "Public read inventser images"
  on storage.objects for select to public
  using (bucket_id = 'inventser-images');

drop policy if exists "Service role writes inventser images" on storage.objects;
create policy "Service role writes inventser images"
  on storage.objects for all to service_role
  using (bucket_id = 'inventser-images')
  with check (bucket_id = 'inventser-images');

-- ---------------------------------------------------------------------
-- 10. SEED: calendario 29/10/2026 - 12/11/2026, 10:00 America/Mexico_City
-- Se inserta para el primer cliente que parezca Inventser (o el primero).
-- ---------------------------------------------------------------------
do $$
declare
  target_client uuid;
  target_account uuid;
begin
  select id into target_client
  from clients
  where slug ilike '%inventser%' or name ilike '%inventser%'
  order by created_at
  limit 1;

  if target_client is null then
    select id into target_client from clients order by created_at limit 1;
  end if;

  if target_client is null then
    return;
  end if;

  select id into target_account
  from social_accounts
  where client_id = target_client
  order by created_at
  limit 1;

  insert into posts (
    client_id,
    social_account_id,
    titulo,
    descripcion,
    imagen_url,
    plataformas,
    scheduled_at,
    status
  )
  select
    target_client,
    target_account,
    v.titulo,
    v.descripcion,
    'inventser_transparent.png',
    array['facebook', 'instagram'],
    v.scheduled_at,
    case
      when v.scheduled_at < now() then 'published'::post_status
      else 'queued'::post_status
    end
  from (
    values
      (
        'Alta de producto en 15 segundos',
        'Carga tus productos al inventario en segundos y empieza a vender más rápido.',
        timestamptz '2026-10-29 10:00:00-06'
      ),
      (
        'Excel vs Inventser',
        'Deja las hojas de cálculo y centraliza inventario, ventas y clientes en un solo lugar.',
        timestamptz '2026-10-31 10:00:00-06'
      ),
      (
        'Prueba Gratis 14 días',
        'Prueba Inventser gratis durante 14 días, sin tarjeta de crédito.',
        timestamptz '2026-11-02 10:00:00-06'
      ),
      (
        'Caso abarrotes',
        'Cómo una tienda de abarrotes ordenó su inventario y aumentó sus ventas.',
        timestamptz '2026-11-04 10:00:00-06'
      ),
      (
        '3 errores que te cuestan ventas',
        'Los tres errores de inventario que más te cuestan ventas y cómo evitarlos.',
        timestamptz '2026-11-06 10:00:00-06'
      ),
      (
        'Sync multi-dispositivo',
        'Sincroniza tu operación en computadora, tablet y celular en tiempo real.',
        timestamptz '2026-11-08 10:00:00-06'
      ),
      (
        'Caso de éxito',
        'Un caso real de crecimiento con Inventser.',
        timestamptz '2026-11-11 10:00:00-06'
      ),
      (
        'Todo bajo control',
        'Inventario, ventas y clientes en un solo lugar.',
        timestamptz '2026-11-12 10:00:00-06'
      )
  ) as v(titulo, descripcion, scheduled_at)
  where not exists (
    select 1 from posts p
    where p.client_id = target_client
      and p.titulo = v.titulo
  );
end $$;

notify pgrst, 'reload schema';
