-- =====================================================================
-- AI TABLES ENSURE - Verificar y corregir tablas AI
-- =====================================================================

-- 1. Business Analyses
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
  analysis_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Si la tabla ya existe pero tiene el error, corregir la columna
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_name = 'business_analyses' 
    and column_name = 'analysis_data'
    and column_default is not null
  ) then
    -- Verificar si tiene el error de sintaxis y corregir
    if (select column_default from information_schema.columns where table_name = 'business_analyses' and column_name = 'analysis_data') like '%not default%' then
      alter table business_analyses alter column analysis_data drop default;
      alter table business_analyses alter column analysis_data set default '{}'::jsonb;
    end if;
  end if;
end $$;

create index if not exists idx_business_analyses_client
  on business_analyses (client_id, created_at desc);

-- 2. Content Plans
create table if not exists content_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  analysis_id uuid references business_analyses(id) on delete set null,
  name text not null,
  duration_weeks integer not null default 1,
  platforms text[] not null default '{}',
  posts_per_week integer not null default 3,
  plan_data jsonb default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_content_plans_client
  on content_plans (client_id, created_at desc);

-- 3. Generated Images
create table if not exists generated_images (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  plan_id uuid references content_plans(id) on delete set null,
  prompt text not null,
  image_url text,
  storage_path text,
  type text not null default 'image',
  platform text,
  status text not null default 'pending',
  error text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_generated_images_client
  on generated_images (client_id, created_at desc);

create index if not exists idx_generated_images_plan
  on generated_images (plan_id, created_at desc);

-- 4. RLS Policies
alter table business_analyses enable row level security;
alter table content_plans enable row level security;
alter table generated_images enable row level security;

-- Policies for business_analyses
drop policy if exists "Service role manages business analyses" on business_analyses;
create policy "Service role manages business analyses"
  on business_analyses for all to service_role using (true) with check (true);

drop policy if exists "Client users read business analyses" on business_analyses;
create policy "Client users read business analyses"
  on business_analyses for select to authenticated
  using (client_id in (select u.client_id from users u where u.id = auth.uid()));

-- Policies for content_plans
drop policy if exists "Service role manages content plans" on content_plans;
create policy "Service role manages content plans"
  on content_plans for all to service_role using (true) with check (true);

drop policy if exists "Client users read content plans" on content_plans;
create policy "Client users read content plans"
  on content_plans for select to authenticated
  using (client_id in (select u.client_id from users u where u.id = auth.uid()));

-- Policies for generated_images
drop policy if exists "Service role manages generated images" on generated_images;
create policy "Service role manages generated images"
  on generated_images for all to service_role using (true) with check (true);

drop policy if exists "Client users read generated images" on generated_images;
create policy "Client users read generated images"
  on generated_images for select to authenticated
  using (client_id in (select u.client_id from users u where u.id = auth.uid()));

-- 5. Storage Bucket
insert into storage.buckets (id, name, public)
values ('ai-generated-images', 'ai-generated-images', true)
on conflict (id) do update set public = true;

-- 6. Notify
notify pgrst, 'reload schema';