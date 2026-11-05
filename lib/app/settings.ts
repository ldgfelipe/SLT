import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { encryptToken, decryptToken } from '@/lib/growth/crypto';

/**
 * Acceso centralizado a configuración sensible del Growth Hub.
 *
 * Orden de búsqueda por clave:
 *   1. Variable de entorno (Vercel / .env / sistema)
 *   2. Tabla interna `app_settings` (cifrada con clave derivada de
 *      SUPABASE_SERVICE_ROLE_KEY), accesible solo con service_role.
 *
 * Esto permite configurar las claves directamente desde el sitio sin
 * tocar el panel de Vercel.
 */

const CACHE_TTL_MS = 10_000;

interface CacheEntry {
  value: string | null;
  expires: number;
}

const cache = new Map<string, CacheEntry>();

export function invalidateSettingsCache(): void {
  cache.clear();
}

function fromEnv(key: string): string | null {
  const value = process.env[key];
  return value && value.trim() ? value : null;
}

/** Devuelve el valor en crudo (env o DB). */
export async function getSetting(key: string): Promise<string | null> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expires > now) return cached.value;

  const envValue = fromEnv(key);
  if (envValue) {
    cache.set(key, { value: envValue, expires: now + CACHE_TTL_MS });
    return envValue;
  }

  let value: string | null = null;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (!error && data?.value) {
      const decrypted = decryptToken(data.value);
      value = decrypted && decrypted.trim() ? decrypted : null;
    }
  } catch (error) {
    console.warn(`[app/settings] No se pudo leer '${key}':`, error);
  }

  cache.set(key, { value, expires: now + CACHE_TTL_MS });
  return value;
}

/** Busca la primera clave que tenga valor. */
export async function findSetting(keys: string[]): Promise<string | null> {
  for (const key of keys) {
    const value = await getSetting(key);
    if (value) return value;
  }
  return null;
}

/** Lee varias claves de una sola vez. */
export async function getSettings(keys: string[]): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  await Promise.all(
    keys.map(async (key) => {
      result[key] = await getSetting(key);
    })
  );
  return result;
}

/** Cifra y guarda valores en `app_settings`. */
export async function setSettings(entries: Record<string, string>): Promise<void> {
  const now = new Date().toISOString();
  const rows = Object.entries(entries)
    .filter(([, value]) => value && value.trim())
    .map(([key, value]) => ({
      key,
      value: encryptToken(value.trim()),
      is_secret: true,
      updated_at: now,
    }));

  if (rows.length === 0) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('app_settings').upsert(rows, {
    onConflict: 'key',
  });

  if (error) throw new Error(error.message);
  invalidateSettingsCache();
}

/** Elimina una clave de `app_settings` (env sigue teniendo prioridad). */
export async function deleteSetting(key: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('app_settings').delete().eq('key', key);
  if (error) throw new Error(error.message);
  invalidateSettingsCache();
}

export type SettingSource = 'vercel' | 'db' | 'missing';

export interface SettingStatus {
  key: string;
  source: SettingSource;
  updated_at: string | null;
}

/** Estado de cada clave: en Vercel, en DB o faltante. */
export async function getSettingStatuses(
  keys: string[]
): Promise<SettingStatus[]> {
  const dbUpdated = new Map<string, string>();
  const dbPresent = new Set<string>();

  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('app_settings')
      .select('key, updated_at')
      .in('key', keys);

    for (const row of data || []) {
      dbPresent.add(row.key);
      dbUpdated.set(row.key, row.updated_at);
    }
  } catch (error) {
    console.warn('[app/settings] No se pudo leer el estado:', error);
  }

  return keys.map((key) => ({
    key,
    source: fromEnv(key) ? 'vercel' : dbPresent.has(key) ? 'db' : 'missing',
    updated_at: dbUpdated.get(key) || null,
  }));
}
