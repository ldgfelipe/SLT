-- Migración: datos personalizados de contactos (campos extra de formularios)
-- Ejecutar en Supabase → SQL Editor → Run.

alter table contacts
  add column if not exists data jsonb not null default '{}'::jsonb;

-- Refrescar la caché de esquema de PostgREST para que la API vea la columna al instante.
notify pgrst, 'reload schema';
