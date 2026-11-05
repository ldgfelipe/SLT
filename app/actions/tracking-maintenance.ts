'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/app/actions/auth';
import { revalidatePath } from 'next/cache';
import { canAccessClient } from '@/lib/growth/access';

const DEFAULT_MAX_EVENTS = 10_000;
const MIN_LIMIT = 100;
const MAX_LIMIT = 5_000_000;
const EXPORT_LIMIT = 50_000;

export type TrackingAlert = 'ok' | 'warning' | 'exceeded';

export interface TrackingStats {
  total: number;
  maxEvents: number;
  percent: number;
  alert: TrackingAlert;
  oldest: string | null;
  newest: string | null;
}

function clampLimit(value: unknown): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return DEFAULT_MAX_EVENTS;
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.round(numberValue)));
}

async function getSiteIds(supabase: any, clientId: string): Promise<string[]> {
  const { data } = await supabase
    .from('tracking_sites')
    .select('id')
    .eq('client_id', clientId);

  return (data || []).map((site: any) => site.id);
}

export async function getTrackingStats(
  clientId: string
): Promise<{ success: true; stats: TrackingStats } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  try {
    if (!canAccessClient(user, clientId)) {
      return { success: false, error: 'Sin acceso a este cliente.' };
    }

    const supabase = getSupabaseAdmin();
    const siteIds = await getSiteIds(supabase, clientId);

    if (siteIds.length === 0) {
      return {
        success: true,
        stats: {
          total: 0,
          maxEvents: DEFAULT_MAX_EVENTS,
          percent: 0,
          alert: 'ok',
          oldest: null,
          newest: null,
        },
      };
    }

    const [{ count }, { data: settings }, oldestRes, newestRes] = await Promise.all([
      supabase
        .from('tracking_events')
        .select('id', { count: 'exact', head: true })
        .in('tracking_site_id', siteIds),
      supabase
        .from('tracking_settings')
        .select('max_events')
        .eq('client_id', clientId)
        .maybeSingle(),
      supabase
        .from('tracking_events')
        .select('created_at')
        .in('tracking_site_id', siteIds)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('tracking_events')
        .select('created_at')
        .in('tracking_site_id', siteIds)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const total = count ?? 0;
    const maxEvents =
      settings?.max_events && settings.max_events >= MIN_LIMIT
        ? Number(settings.max_events)
        : DEFAULT_MAX_EVENTS;

    const percent = maxEvents > 0 ? total / maxEvents : 0;
    const alert: TrackingAlert =
      percent >= 1 ? 'exceeded' : percent >= 0.8 ? 'warning' : 'ok';

    return {
      success: true,
      stats: {
        total,
        maxEvents,
        percent,
        alert,
        oldest: oldestRes.data?.created_at ?? null,
        newest: newestRes.data?.created_at ?? null,
      },
    };
  } catch (error: any) {
    console.warn('[tracking-maintenance] stats:', error);
    return {
      success: false,
      error: error?.message || 'No se pudieron cargar las estadísticas.',
    };
  }
}

export async function updateTrackingLimit(
  clientId: string,
  maxEvents: number
): Promise<{ success: true; maxEvents: number } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  try {
    if (!canAccessClient(user, clientId)) {
      return { success: false, error: 'Sin acceso a este cliente.' };
    }

    const clamped = clampLimit(maxEvents);
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from('tracking_settings').upsert(
      { client_id: clientId, max_events: clamped, updated_at: new Date().toISOString() },
      { onConflict: 'client_id' }
    );

    if (error) {
      console.warn('[tracking-maintenance] settings:', error.message);
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/tracking');
    return { success: true, maxEvents: clamped };
  } catch (error: any) {
    return { success: false, error: error?.message || 'No se pudo guardar.' };
  }
}

/** Purga los eventos más antiguos conservando `maxEvents` registros. */
export async function purgeTrackingEvents(
  clientId: string
): Promise<{ success: true; purged: number } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  try {
    if (!canAccessClient(user, clientId)) {
      return { success: false, error: 'Sin acceso a este cliente.' };
    }

    const supabase = getSupabaseAdmin();
    const siteIds = await getSiteIds(supabase, clientId);
    if (siteIds.length === 0) {
      return { success: true, purged: 0 };
    }

    const { data: settings } = await supabase
      .from('tracking_settings')
      .select('max_events')
      .eq('client_id', clientId)
      .maybeSingle();

    const keep = clampLimit(settings?.max_events ?? DEFAULT_MAX_EVENTS);

    const { count } = await supabase
      .from('tracking_events')
      .select('id', { count: 'exact', head: true })
      .in('tracking_site_id', siteIds);

    const total = count ?? 0;
    if (total <= keep) {
      return { success: true, purged: 0 };
    }

    const excess = total - keep;
    let purged = 0;

    while (purged < excess) {
      const batchSize = Math.min(1000, excess - purged);
      const { data: oldest, error: selectError } = await supabase
        .from('tracking_events')
        .select('id')
        .in('tracking_site_id', siteIds)
        .order('created_at', { ascending: true })
        .limit(batchSize);

      if (selectError || !oldest || oldest.length === 0) break;

      const ids = oldest.map((row: any) => row.id);
      const { error: deleteError } = await supabase
        .from('tracking_events')
        .delete()
        .in('id', ids);

      if (deleteError) {
        console.warn('[tracking-maintenance] purge:', deleteError.message);
        return { success: false, error: deleteError.message };
      }

      purged += ids.length;
    }

    revalidatePath('/dashboard/tracking');
    return { success: true, purged };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Error al purgar.' };
  }
}

/** Borra TODOS los eventos del cliente. Requiere confirmación exacta. */
export async function clearTrackingEvents(
  clientId: string,
  confirm: string
): Promise<{ success: true; deleted: number } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  try {
    if (!canAccessClient(user, clientId)) {
      return { success: false, error: 'Sin acceso a este cliente.' };
    }

    if (confirm !== 'BORRAR') {
      return {
        success: false,
        error: 'Escribe BORRAR para confirmar el borrado total.',
      };
    }

    const supabase = getSupabaseAdmin();
    const siteIds = await getSiteIds(supabase, clientId);
    if (siteIds.length === 0) {
      return { success: true, deleted: 0 };
    }

    const { count } = await supabase
      .from('tracking_events')
      .select('id', { count: 'exact', head: true })
      .in('tracking_site_id', siteIds);

    const deleted = count ?? 0;

    // Borrado en lotes para no bloquear la base.
    let deletedTotal = 0;
    while (deletedTotal < deleted) {
      const { data: batch, error: selectError } = await supabase
        .from('tracking_events')
        .select('id')
        .in('tracking_site_id', siteIds)
        .limit(1000);

      if (selectError || !batch || batch.length === 0) break;

      const ids = batch.map((row: any) => row.id);
      const { error: deleteError } = await supabase
        .from('tracking_events')
        .delete()
        .in('id', ids);

      if (deleteError) {
        console.warn('[tracking-maintenance] clear:', deleteError.message);
        return { success: false, error: deleteError.message };
      }

      deletedTotal += ids.length;
    }

    revalidatePath('/dashboard/tracking');
    return { success: true, deleted: deletedTotal };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Error al borrar.' };
  }
}

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function exportTrackingCsv(
  clientId: string,
  options: {
    siteId?: string | null;
    from?: string | null;
    to?: string | null;
    limit?: number;
  } = {}
): Promise<
  | { success: true; csv: string; filename: string; count: number }
  | { success: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  try {
    if (!canAccessClient(user, clientId)) {
      return { success: false, error: 'Sin acceso a este cliente.' };
    }

    const supabase = getSupabaseAdmin();
    const sites = await getSiteIds(supabase, clientId);

    let siteIds = sites;
    if (options.siteId) {
      if (!sites.includes(options.siteId)) {
        return { success: false, error: 'El sitio no pertenece a este cliente.' };
      }
      siteIds = [options.siteId];
    }

    if (siteIds.length === 0) {
      return { success: false, error: 'No hay sitios para exportar.' };
    }

    const limit = Math.min(
      EXPORT_LIMIT,
      Math.max(1, Number(options.limit) || 10_000)
    );

    let query = supabase
      .from('tracking_events')
      .select(
        'id, tracking_site_id, visitor_id, contact_id, event_type, url, referrer, landing_url, utm_source, utm_medium, utm_campaign, utm_term, utm_content, fingerprint, created_at'
      )
      .in('tracking_site_id', siteIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (options.from) query = query.gte('created_at', options.from);
    if (options.to) query = query.lte('created_at', options.to);

    const { data: events, error } = await query;
    if (error) return { success: false, error: error.message };

    // Mapa dominio por sitio para la columna "site"
    const { data: domains } = await supabase
      .from('tracking_sites')
      .select('id, domain')
      .in('id', siteIds);
    const domainBySite = new Map(
      (domains || []).map((site: any) => [site.id, site.domain])
    );

    const header = [
      'id',
      'created_at',
      'site',
      'event_type',
      'url',
      'referrer',
      'landing_url',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'visitor_id',
      'contact_id',
      'fingerprint',
    ];

    const lines = [header.join(',')];
    for (const event of events || []) {
      lines.push(
        [
          event.id,
          event.created_at,
          domainBySite.get(event.tracking_site_id) || '',
          event.event_type,
          event.url,
          event.referrer,
          event.landing_url,
          event.utm_source,
          event.utm_medium,
          event.utm_campaign,
          event.utm_term,
          event.utm_content,
          event.visitor_id,
          event.contact_id,
          event.fingerprint,
        ]
          .map(csvEscape)
          .join(',')
      );
    }

    const stamp = new Date().toISOString().slice(0, 10);
    return {
      success: true,
      csv: '\uFEFF' + lines.join('\r\n'),
      filename: `tracking-${stamp}.csv`,
      count: (events || []).length,
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Error al exportar.' };
  }
}
