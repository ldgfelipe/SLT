-- =====================================================================
-- APP SETTINGS / SECRETARIADO DE CLAVES
-- =====================================================================
-- Tabla interna para guardar claves del Growth Hub directamente desde el
-- sitio (Configuración → Configuración del Growth Hub, solo root).
--
-- Las claves se guardan CIFRADAS (AES-256-GCM) con una clave derivada de
-- SUPABASE_SERVICE_ROLE_KEY (ya necesaria para el servidor).
-- =====================================================================

create table if not exists app_settings (
  key text primary key,
  value text not null,
  is_secret boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

-- Sin policies: ninguna conexión de la API (anon/authenticated) puede leer
-- o escribir esta tabla. Solo el servidor (service_role) tiene acceso.
revoke all on table app_settings from anon, authenticated;
