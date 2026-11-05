-- =====================================================================
-- TRACKING: LÍMITE DE REGISTROS POR CLIENTE
-- =====================================================================
-- Cada cliente puede definir cuántos eventos de tracking se conservan
-- (default 10,000). El endpoint de tracking purga automáticamente los
-- eventos más antiguos cuando se supera el límite (con caché de 60 s).
-- =====================================================================

create table if not exists tracking_settings (
  client_id uuid primary key references clients(id) on delete cascade,
  max_events integer not null default 10000
    check (max_events between 100 and 5000000),
  updated_at timestamptz not null default now()
);

alter table tracking_settings enable row level security;

revoke all on table tracking_settings from anon, authenticated;
