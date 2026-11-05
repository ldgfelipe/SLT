-- =====================================================================
-- NOTAS DE LEAD / EXCLUSIONES DE IP
-- =====================================================================
-- 1. Notas y acciones vinculadas a un deal (Kanban) o a un contacto.
-- 2. Reglas de exclusión de IP para no rastrear tus propias pruebas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. NOTAS Y ACCIONES DE LEAD
-- ---------------------------------------------------------------------
create table if not exists lead_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  deal_id uuid references deals(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  author_id uuid references users(id) on delete set null,
  kind text not null default 'note',
  body text not null,
  due_at timestamptz,
  done boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_notes_target check (
    deal_id is not null or contact_id is not null
  ),
  constraint lead_notes_kind check (
    kind in ('note', 'action', 'call', 'email', 'whatsapp', 'meeting')
  )
);

create index if not exists idx_lead_notes_client on lead_notes (client_id, created_at desc);
create index if not exists idx_lead_notes_deal on lead_notes (deal_id, created_at desc);
create index if not exists idx_lead_notes_contact on lead_notes (contact_id, created_at desc);

alter table lead_notes enable row level security;

drop policy if exists "Service role manages lead notes" on lead_notes;
create policy "Service role manages lead notes"
  on lead_notes for all to service_role
  using (true) with check (true);

drop policy if exists "Client users read lead notes" on lead_notes;
create policy "Client users read lead notes"
  on lead_notes for select to authenticated
  using (
    client_id in (
      select u.client_id from users u where u.id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 2. EXCLUSIONES DE IP PARA EL PIXEL
-- pattern: IP exacta o prefijo (ej. '192.168.1.' para todo el rango).
-- ---------------------------------------------------------------------
create table if not exists tracking_ip_exclusions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  pattern text not null
    check (length(btrim(pattern)) >= 2 and length(pattern) <= 64),
  label text,
  created_at timestamptz not null default now(),
  created_by uuid references users(id) on delete set null,
  unique (client_id, pattern)
);

create index if not exists idx_track_exclusions_client on tracking_ip_exclusions (client_id);

alter table tracking_ip_exclusions enable row level security;

drop policy if exists "Service role manages ip exclusions" on tracking_ip_exclusions;
create policy "Service role manages ip exclusions"
  on tracking_ip_exclusions for all to service_role
  using (true) with check (true);

drop policy if exists "Client users read ip exclusions" on tracking_ip_exclusions;
create policy "Client users read ip exclusions"
  on tracking_ip_exclusions for select to authenticated
  using (
    client_id in (
      select u.client_id from users u where u.id = auth.uid()
    )
  );
