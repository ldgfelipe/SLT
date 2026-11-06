-- =====================================================================
-- MAIL CENTER (Fase 1)
-- =====================================================================
-- Listas, contactos importados, integraciones de envío (SMTP/API),
-- campañas, bajas (supresión), eventos SES y límite diario del ambiente.
--
-- El aislamiento por cliente es central: todas las tablas llevan
-- cliente_id y no se permite acceso desde la API (service_role inyecta).
-- Los contactos viven en `contacts` (tabla compartida con el CRM) con el
-- campo `mail_state` agregado para su estado de lista.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Estados de lista personalizados por cliente
-- ---------------------------------------------------------------------
create table if not exists mail_list_states (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  estado text not null,
  etiqueta text not null,
  color text not null default 'slate',
  orden integer not null default 0,
  unique (client_id, estado)
);

alter table mail_list_states enable row level security;
revoke all on table mail_list_states from anon, authenticated;

-- Seed de estados por defecto para clientes existentes
do $$
declare c record;
begin
  for c in select id from clients loop
    insert into mail_list_states (client_id, estado, etiqueta, color, orden) values
      (c.id, 'activo',        'Activo',        'green',  1),
      (c.id, 'suscrito',      'Suscrito',      'blue',   2),
      (c.id, 'pausado',       'Pausado',       'yellow', 3),
      (c.id, 'no_interesado', 'No interesado', 'gray',   4),
      (c.id, 'no_suscrito',   'No suscrito',   'gray',   5),
      (c.id, 'rebotado',      'Rebotado',      'red',    6),
      (c.id, 'bloqueado',     'Bloqueado',     'red',    7)
    on conflict (client_id, estado) do nothing;
  end loop;
end $$;

-- Trigger: clientes nuevos reciben sus estados por defecto
create or replace function public.seed_mail_states_for_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into mail_list_states (client_id, estado, etiqueta, color, orden) values
    (new.id, 'activo',        'Activo',        'green',  1),
    (new.id, 'suscrito',      'Suscrito',      'blue',   2),
    (new.id, 'pausado',       'Pausado',       'yellow', 3),
    (new.id, 'no_interesado', 'No interesado', 'gray',   4),
    (new.id, 'no_suscrito',   'No suscrito',   'gray',   5),
    (new.id, 'rebotado',      'Rebotado',      'red',    6),
    (new.id, 'bloqueado',     'Bloqueado',     'red',    7)
  on conflict (client_id, estado) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_mail_states_new_client on clients;
create trigger trg_mail_states_new_client
  after insert on clients
  for each row execute function public.seed_mail_states_for_client();

-- Estado de mailing por contacto (columna directa para consultas rápidas)
alter table contacts
  add column if not exists mail_state text not null default 'activo';

create index if not exists idx_contacts_mail_state
  on contacts (client_id, mail_state);

-- ---------------------------------------------------------------------
-- 2. Listas y membresía
-- ---------------------------------------------------------------------
create table if not exists mail_lists (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mail_lists_client
  on mail_lists (client_id, created_at desc);

alter table mail_lists enable row level security;
revoke all on table mail_lists from anon, authenticated;

create table if not exists mail_list_contacts (
  lista_id uuid not null references mail_lists(id) on delete cascade,
  contacto_id uuid not null references contacts(id) on delete cascade,
  added_at timestamptz not null default now(),
  unique (lista_id, contacto_id)
);

create index if not exists idx_mail_list_contacts_lista
  on mail_list_contacts (lista_id, contacto_id);

create index if not exists idx_mail_list_contacts_contacto
  on mail_list_contacts (contacto_id, lista_id);

alter table mail_list_contacts enable row level security;
revoke all on table mail_list_contacts from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Conexiones de envío (SMTP / API). Config cifrada en reposo.
-- ---------------------------------------------------------------------
create table if not exists mail_connections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  nombre text not null,
  proveedor text not null check (
    proveedor in (
      'brevo', 'sendgrid', 'mailgun', 'mailrelay', 'mailerlite',
      'mandrill', 'resend', 'ses', 'smtp2go', 'zoho', 'http'
    )
  ),
  config text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mail_connections_client
  on mail_connections (client_id, created_at desc);

alter table mail_connections enable row level security;
revoke all on table mail_connections from anon, authenticated;

-- Config de Amazon SES por conexión (cuota y tracking)
create table if not exists ses_config (
  conexion_id uuid primary key references mail_connections(id) on delete cascade,
  limite_diario integer not null default 50000 check (limite_diario > 0),
  max_por_minuto integer,
  max_por_segundo integer not null default 14 check (max_por_segundo > 0),
  usar_tracking boolean not null default true,
  dominio_tracking text,
  correo_bajas text,
  updated_at timestamptz not null default now()
);

alter table ses_config enable row level security;
revoke all on table ses_config from anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Bajas (supresión) — un correo dado de baja nunca vuelve a recibir
-- ---------------------------------------------------------------------
create table if not exists ses_bajas (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  email text not null,
  motivo text not null default 'baja voluntaria',
  origen text not null default 'app',
  campana_id uuid,
  detalle text,
  created_at timestamptz not null default now(),
  unique (client_id, email)
);

create index if not exists idx_ses_bajas_client_email
  on ses_bajas (client_id, email);

alter table ses_bajas enable row level security;
revoke all on table ses_bajas from anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Eventos de SES (Delivery/Bounce/Complaint) y tracking
-- ---------------------------------------------------------------------
create table if not exists ses_eventos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  evento text not null,
  email text,
  motivo text,
  message_id text,
  campana_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_ses_eventos_client
  on ses_eventos (client_id, created_at desc);

alter table ses_eventos enable row level security;
revoke all on table ses_eventos from anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Campañas de email y bitácora de envíos
-- ---------------------------------------------------------------------
create table if not exists mail_campaigns (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  subject text not null,
  html text,
  lista_id uuid references mail_lists(id) on delete set null,
  canal_tipo text not null default 'api' check (canal_tipo in ('smtp', 'api')),
  canal_id uuid references mail_connections(id) on delete set null,
  sender_name text,
  sender_email text,
  estado text not null default 'borrador' check (
    estado in ('borrador', 'programada', 'enviando', 'pausada', 'enviada', 'cancelada', 'error')
  ),
  total_destinatarios integer not null default 0,
  enviados integer not null default 0,
  abiertos integer not null default 0,
  clics integer not null default 0,
  rebotados integer not null default 0,
  invalidos integer not null default 0,
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error_log text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mail_campaigns_client
  on mail_campaigns (client_id, created_at desc);

create index if not exists idx_mail_campaigns_due
  on mail_campaigns (estado, scheduled_at)
  where estado in ('programada', 'enviando', 'pausada');

alter table mail_campaigns enable row level security;
revoke all on table mail_campaigns from anon, authenticated;

create table if not exists mail_campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campana_id uuid not null references mail_campaigns(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  contacto_id uuid references contacts(id) on delete set null,
  email text not null,
  estado text not null default 'pendiente' check (
    estado in ('pendiente', 'enviando', 'enviado', 'error', 'no_suscrito')
  ),
  detalle text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_mail_campaign_sends_campana
  on mail_campaign_sends (campana_id, estado);

create index if not exists idx_mail_campaign_sends_client
  on mail_campaign_sends (client_id, created_at desc);

alter table mail_campaign_sends enable row level security;
revoke all on table mail_campaign_sends from anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Límite diario del ambiente (300 por defecto; NO aplica a SES)
-- ---------------------------------------------------------------------
create table if not exists mail_settings (
  client_id uuid primary key references clients(id) on delete cascade,
  limite_diario integer not null default 300 check (limite_diario > 0),
  updated_at timestamptz not null default now()
);

alter table mail_settings enable row level security;
revoke all on table mail_settings from anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. Contadores atómicos (abiertos, clics, enviados, rebotados, inválidos)
-- ---------------------------------------------------------------------
create or replace function public.increment_mail_counter(
  p_campana_id uuid,
  p_column text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_column not in ('abiertos', 'clics', 'enviados', 'rebotados', 'invalidos') then
    return;
  end if;

  execute format(
    'update mail_campaigns set %I = coalesce(%I, 0) + 1, updated_at = now() where id = $1',
    p_column, p_column
  ) using p_campana_id;
end;
$$;
