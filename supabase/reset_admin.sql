-- Reset / crear usuario administrador (root)
-- Ejecutar en Supabase: SQL Editor
-- Email: ldgframe@gmail.com
-- Password: Sofia22077#

-- Tabla clients (mínima, por si no existe)
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabla users
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password_hash text not null,
  role text default 'client_admin' check (role in ('root', 'client_admin')) not null,
  client_id uuid references clients(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Upsert del usuario root
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
