-- 1. EXTENSIÓN UUID
create extension if not exists "uuid-ossp";

-- 2. CLIENTES / WORKSPACES (Multitenancy)
create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. PIPELINES (pertenece a un cliente)
create table if not exists pipelines (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. STAGES
create table if not exists stages (
  id uuid primary key default uuid_generate_v4(),
  pipeline_id uuid references pipelines(id) on delete cascade not null,
  name text not null,
  "order" integer default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. CONTACTS (pertenece a un cliente)
create table if not exists contacts (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade not null,
  first_name text not null,
  last_name text,
  email text not null,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (client_id, email)
);

-- 6. DEALS
create table if not exists deals (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade not null,
  title text not null,
  value numeric(12, 2) default 0.00 not null,
  stage_id uuid references stages(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete set null,
  status text default 'open' check (status in ('open', 'won', 'lost')) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. FORMS (pertenece a un cliente)
create table if not exists forms (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade not null,
  pipeline_id uuid references pipelines(id) on delete cascade not null,
  stage_id uuid references stages(id) on delete cascade not null,
  name text not null,
  fields_config jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. TRACKING SITES (pertenece a un cliente)
create table if not exists tracking_sites (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade not null,
  domain text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. TRACKING EVENTS
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
create index if not exists idx_pipelines_client on pipelines(client_id);
create index if not exists idx_stages_pipeline_order on stages(pipeline_id, "order");
create index if not exists idx_contacts_client_email on contacts(client_id, email);
create index if not exists idx_deals_client_stage on deals(client_id, stage_id);
create index if not exists idx_events_site_visitor on tracking_events(tracking_site_id, visitor_id);

-- ROW LEVEL SECURITY (RLS)
alter table clients enable row level security;
alter table pipelines enable row level security;
alter table stages enable row level security;
alter table contacts enable row level security;
alter table deals enable row level security;
alter table forms enable row level security;
alter table tracking_sites enable row level security;
alter table tracking_events enable row level security;

-- POLÍTICAS
create policy "Authenticated access to clients" on clients for all to authenticated using (true);
create policy "Authenticated access to pipelines" on pipelines for all to authenticated using (true);
create policy "Authenticated access to stages" on stages for all to authenticated using (true);
create policy "Authenticated access to contacts" on contacts for all to authenticated using (true);
create policy "Authenticated access to deals" on deals for all to authenticated using (true);
create policy "Authenticated access to forms" on forms for all to authenticated using (true);
create policy "Authenticated access to tracking_sites" on tracking_sites for all to authenticated using (true);
create policy "Authenticated access to tracking_events" on tracking_events for all to authenticated using (true);

create policy "Allow public tracking events inserts" on tracking_events for insert to anon with check (true);
create policy "Allow public tracking site verification" on tracking_sites for select to anon using (true);

-- SEED / DATOS DEMO (2 clientes distintos para pruebas)
insert into clients (id, name, slug)
values 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Agencia Alpha', 'alpha'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Tech Solutions Corp', 'tech-corp')
on conflict (id) do nothing;

-- Pipelines y Stages para Agencia Alpha
insert into pipelines (id, client_id, name)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Pipeline Ventas Alpha')
on conflict (id) do nothing;

insert into stages (id, pipeline_id, name, "order")
values 
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Prospectos', 1),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Reunión Agendada', 2),
  ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', 'Presupuesto', 3),
  ('22222222-2222-2222-2222-222222222224', '11111111-1111-1111-1111-111111111111', 'Cerrado', 4)
on conflict (id) do nothing;

-- Pipelines y Stages para Tech Solutions Corp
insert into pipelines (id, client_id, name)
values ('33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Enterprise Deals')
on conflict (id) do nothing;

insert into stages (id, pipeline_id, name, "order")
values 
  ('44444444-4444-4444-4444-444444444441', '33333333-3333-3333-3333-333333333333', 'Demo Solicitada', 1),
  ('44444444-4444-4444-4444-444444444442', '33333333-3333-3333-3333-333333333333', 'Evaluación Técnica', 2),
  ('44444444-4444-4444-4444-444444444443', '33333333-3333-3333-3333-333333333333', 'Negociación Legal', 3),
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Firmado', 4)
on conflict (id) do nothing;
