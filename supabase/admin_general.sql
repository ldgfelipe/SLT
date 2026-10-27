-- ============================================================
-- SQL: Crear/Resetear Administrador General (role = 'root')
-- Proyecto: SLT-v2
-- Email:    ldgframe@gmail.com
-- Pass:     Sofia22077#  (SHA-256: ad608b001f9d30300858309eba50a43e56d49adcd75b0af0c297381bc0281a16)
-- Ejecutar en: Supabase -> SQL Editor
-- ============================================================

-- 1. Extension UUID
create extension if not exists "uuid-ossp";

-- 2. Tabla CLIENTS (multitenancy) - mínima y segura
create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insertar clientes base (opcional, no falla si ya existen)
insert into clients (id, name, slug)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Agencia Alpha', 'alpha'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Tech Solutions Corp', 'tech-corp')
on conflict (id) do nothing;

-- RLS + política pública para clients
alter table clients enable row level security;
drop policy if exists "Public access to clients" on clients;
create policy "Public access to clients" on clients for all using (true) with check (true);

-- 3. Tabla USERS
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text unique not null,
  password_hash text not null,
  role text default 'client_admin' check (role in ('root', 'client_admin')) not null,
  client_id uuid references clients(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Row Level Security + política pública (consistente con schema.sql)
alter table users enable row level security;
drop policy if exists "Public access to users" on users;
create policy "Public access to users" on users for all using (true) with check (true);

-- 5. Upsert del Administrador General (root)
insert into users (name, email, password_hash, role, client_id)
values (
  'SuperAdmin Root',
  'ldgframe@gmail.com',
  'ad608b001f9d30300858309eba50a43e56d49adcd75b0af0c297381bc0281a16',
  'root',
  null
)
on conflict (email) do update
set
  name = excluded.name,
  password_hash = excluded.password_hash,
  role = excluded.role,
  client_id = excluded.client_id;

-- 6. (Opcional) Verificación final
select id, name, email, role, client_id, created_at
from users
where email = 'ldgframe@gmail.com';
