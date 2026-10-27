// scripts/reset-admin.mjs
// Uso:
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=yyy node scripts/reset-admin.mjs
// o crea .env.local con esas variables y ejecuta: node scripts/reset-admin.mjs

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const password = 'Sofia22077#';
const hash = crypto.createHash('sha256').update(password).digest('hex');

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await supabase
  .from('users')
  .upsert(
    {
      name: 'SuperAdmin Root',
      email: 'ldgframe@gmail.com',
      password_hash: hash,
      role: 'root',
      client_id: null,
    },
    { onConflict: 'email' }
  )
  .select('id, name, email, role, created_at')
  .single();

if (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

console.log('Usuario root listo:', data);
