/**
 * Límite de registros de tracking por cliente.
 *
 * El endpoint `/api/track` consulta (con caché de 60 s por cliente):
 *   - el `max_events` configurado en `tracking_settings`
 *   - el total de `tracking_events` de los sitios del cliente
 *
 * Si el total alcanza el límite, purga los eventos más antiguos
 * (excedente + 100 de colchón) antes de insertar el nuevo.
 */

const CACHE_TTL_MS = 60_000;
const DEFAULT_MAX_EVENTS = 10_000;
const BUFFER = 100;

interface CacheEntry {
  maxEvents: number;
  siteIds: string[];
  total: number;
  expires: number;
}

const cache = new Map<string, CacheEntry>();

async function loadEntry(supabase: any, clientId: string): Promise<CacheEntry | null> {
  try {
    const [{ data: sites }, { data: settings }] = await Promise.all([
      supabase.from('tracking_sites').select('id').eq('client_id', clientId),
      supabase
        .from('tracking_settings')
        .select('max_events')
        .eq('client_id', clientId)
        .maybeSingle(),
    ]);

    const siteIds = (sites || []).map((site: any) => site.id);
    if (siteIds.length === 0) return null;

    const maxEvents =
      settings?.max_events && settings.max_events >= 100
        ? Number(settings.max_events)
        : DEFAULT_MAX_EVENTS;

    const { count } = await supabase
      .from('tracking_events')
      .select('id', { count: 'exact', head: true })
      .in('tracking_site_id', siteIds);

    return {
      maxEvents,
      siteIds,
      total: count ?? 0,
      expires: Date.now() + CACHE_TTL_MS,
    };
  } catch (error) {
    console.warn('[tracking-limit] no se pudo leer límite:', error);
    return null;
  }
}

async function purgeOldest(
  supabase: any,
  siteIds: string[],
  excess: number
): Promise<number> {
  if (excess <= 0 || siteIds.length === 0) return 0;

  const { data: oldest, error } = await supabase
    .from('tracking_events')
    .select('id')
    .in('tracking_site_id', siteIds)
    .order('created_at', { ascending: true })
    .limit(excess);

  if (error || !oldest || oldest.length === 0) return 0;

  const ids = oldest.map((row: any) => row.id);
  const { error: deleteError } = await supabase
    .from('tracking_events')
    .delete()
    .in('id', ids);

  if (deleteError) {
    console.warn('[tracking-limit] purge error:', deleteError.message);
    return 0;
  }

  return ids.length;
}

/** Aplica el límite y, si hace falta, purga eventos antiguos. */
export async function enforceTrackingLimit(
  supabase: any,
  clientId: string
): Promise<void> {
  if (!clientId) return;

  const now = Date.now();
  let entry = cache.get(clientId);

  if (!entry || entry.expires <= now) {
    entry = (await loadEntry(supabase, clientId)) || undefined;
    if (!entry) return;
    cache.set(clientId, entry);
  }

  if (entry.total < entry.maxEvents) {
    entry.total += 1;
    return;
  }

  const excess = entry.total - entry.maxEvents + BUFFER;
  const purged = await purgeOldest(supabase, entry.siteIds, excess);

  if (purged > 0) {
    entry = { ...entry, total: Math.max(0, entry.total - purged), expires: now + CACHE_TTL_MS };
  }

  entry.total += 1;
  cache.set(clientId, entry);
}
