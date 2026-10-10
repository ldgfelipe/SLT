-- 1. EXTENSIÓN UUID
create extension if not exists "uuid-ossp";

-- 2. PIPELINES
create table if not exists pipelines (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. STAGES
create table if not exists stages (
  id uuid primary key default uuid_generate_v4(),
  pipeline_id uuid references pipelines(id) on delete cascade not null,
  name text not null,
  "order" integer default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. CONTACTS
create table if not exists contacts (
  id uuid primary key default uuid_generate_v4(),
  first_name text not null,
  last_name text,
  email text not null unique,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. DEALS
create table if not exists deals (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  value numeric(12, 2) default 0.00 not null,
  stage_id uuid references stages(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete set null,
  status text default 'open' check (status in ('open', 'won', 'lost')) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. FORMS
create table if not exists forms (
  id uuid primary key default uuid_generate_v4(),
  pipeline_id uuid references pipelines(id) on delete cascade not null,
  stage_id uuid references stages(id) on delete cascade not null,
  name text not null,
  fields_config jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. TRACKING SITES
create table if not exists tracking_sites (
  id uuid primary key default uuid_generate_v4(),
  domain text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. TRACKING EVENTS
create table if not exists tracking_events (
  id uuid primary key default uuid_generate_v4(),
  tracking_site_id uuid references tracking_sites(id) on delete cascade not null,
  visitor_id uuid not null,
  contact_id uuid references contacts(id) on delete set null,
  event_type text not null check (event_type in ('pageview', 'conversion')),
  url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ÍNDICES
create index if not exists idx_stages_pipeline_order on stages(pipeline_id, "order");
create index if not exists idx_deals_stage on deals(stage_id);
create index if not exists idx_contacts_email on contacts(email);
create index if not exists idx_events_site_visitor on tracking_events(tracking_site_id, visitor_id);

-- ROW LEVEL SECURITY (RLS)
alter table pipelines enable row level security;
alter table stages enable row level security;
alter table contacts enable row level security;
alter table deals enable row level security;
alter table forms enable row level security;
alter table tracking_sites enable row level security;
alter table tracking_events enable row level security;

-- POLÍTICAS
create policy "Authenticated access to pipelines" on pipelines for all to authenticated using (true);
create policy "Authenticated access to stages" on stages for all to authenticated using (true);
create policy "Authenticated access to contacts" on contacts for all to authenticated using (true);
create policy "Authenticated access to deals" on deals for all to authenticated using (true);
create policy "Authenticated access to forms" on forms for all to authenticated using (true);
create policy "Authenticated access to tracking_sites" on tracking_sites for all to authenticated using (true);
create policy "Authenticated access to tracking_events" on tracking_events for all to authenticated using (true);

create policy "Allow public tracking events inserts" on tracking_events for insert to anon with check (true);
create policy "Allow public tracking site verification" on tracking_sites for select to anon using (true);

-- DATOS DE PRUEBA INICIALES (Semilla para Pipeline inicial)
insert into pipelines (id, name) 
values ('11111111-1111-1111-1111-111111111111', 'Pipeline Principal')
on conflict (id) do nothing;

insert into stages (id, pipeline_id, name, "order")
values 
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Lead Entrante', 1),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Contacto Realizado', 2),
  ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', 'Propuesta Enviada', 3),
  ('22222222-2222-2222-2222-222222222224', '11111111-1111-1111-1111-111111111111', 'Cerrado Ganado', 4)
on conflict (id) do nothing;
