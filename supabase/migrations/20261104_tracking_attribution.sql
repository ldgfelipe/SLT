-- Atribución de origen y fingerprint para el journey de leads.
-- Ejecuta este archivo en Supabase (SQL Editor) si no usas migraciones automáticas.

alter table tracking_events
  add column if not exists referrer text,
  add column if not exists landing_url text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_term text,
  add column if not exists utm_content text,
  add column if not exists fingerprint text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- El journey de un lead se consulta por contacto, visitante o fingerprint.
create index if not exists idx_events_contact_created
  on tracking_events (contact_id, created_at);

create index if not exists idx_events_visitor_created
  on tracking_events (visitor_id, created_at);

create index if not exists idx_events_fingerprint_created
  on tracking_events (fingerprint, created_at);

notify pgrst, 'reload schema';
