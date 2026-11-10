-- =====================================================================
-- AI CONTENT AGENT
-- Agente de IA para análisis de negocio, planes de publicación y
-- generación de imágenes para redes sociales.
--
-- Idempotente: se puede ejecutar varias veces en el SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ANÁLISIS DE NEGOCIO (IA)
-- ---------------------------------------------------------------------
create table if not exists business_analyses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  business_name text not null,
  category text,
  description text,
  target_audience text,
  competitors text[],
  brand_colors text[],
  tone text,
  key_messages text[],
  analysis_data jsonb not default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_business_analyses_client
  on business_analyses (client_id, created_at desc);

-- ---------------------------------------------------------------------
-- 2. PLANES DE CONTENIDO (IA)
-- ---------------------------------------------------------------------
create table if not exists content_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  analysis_id uuid references business_analyses(id) on delete set null,
  name text not null,
  duration_weeks integer not null default 1,
  platforms text[] not null default '{}',
  posts_per_week integer not null default 3,
  plan_data jsonb not default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_content_plans_client
  on content_plans (client_id, created_at desc);

-- ---------------------------------------------------------------------
-- 3. IMÁGENES GENERADAS (IA)
-- ---------------------------------------------------------------------
create table if not exists generated_images (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  plan_id uuid references content_plans(id) on delete set null,
  prompt text not null,
  image_url text,
  storage_path text,
  type text not null default 'image', -- image, carousel, video
  platform text,
  status text not null default 'pending', -- pending, generating, completed, failed
  error text,
  metadata jsonb not default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_generated_images_client
  on generated_images (client_id, created_at desc);

create index if not exists idx_generated_images_plan
  on generated_images (plan_id, created_at desc);

-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------
alter table business_analyses enable row level security;
alter table content_plans enable row level security;
alter table generated_images enable row level security;

drop policy if exists "Service role manages business analyses" on business_analyses;
create policy "Service role manages business analyses"
  on business_analyses for all to service_role
  using (true) with check (true);

drop policy if exists "Client users read business analyses" on business_analyses;
create policy "Client users read business analyses"
  on business_analyses for select to authenticated
  using (
    client_id in (
      select u.client_id from users u where u.id = auth.uid()
    )
  );

drop policy if exists "Service role manages content plans" on content_plans;
create policy "Service role manages content plans"
  on content_plans for all to service_role
  using (true) with check (true);

drop policy if exists "Client users read content plans" on content_plans;
create policy "Client users read content plans"
  on content_plans for select to authenticated
  using (
    client_id in (
      select u.client_id from users u where u.id = auth.uid()
    )
  );

drop policy if exists "Service role manages generated images" on generated_images;
create policy "Service role manages generated images"
  on generated_images for all to service_role
  using (true) with check (true);

drop policy if exists "Client users read generated images" on generated_images;
create policy "Client users read generated images"
  on generated_images for select to authenticated
  using (
    client_id in (
      select u.client_id from users u where u.id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 5. STORAGE BUCKET PARA IMÁGENES GENERADAS
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('ai-generated-images', 'ai-generated-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read ai generated images" on storage.objects;
create policy "Public read ai generated images"
  on storage.objects for select to public
  using (bucket_id = 'ai-generated-images');

drop policy if exists "Service role writes ai generated images" on storage.objects;
create policy "Service role writes ai generated images"
  on storage.objects for all to service_role
  using (bucket_id = 'ai-generated-images')
  with check (bucket_id = 'ai-generated-images');

notify pgrst, 'reload schema';