'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  getFingerprints,
  getVisitorIds,
  isFingerprint,
  isUuid,
} from '@/lib/attribution';
import type {
  Contact,
  Deal,
  LeadDetailsPayload,
  LeadJourneyEvent,
} from '@/types/database';

interface GetLeadDetailsInput {
  dealId?: string;
  contactId?: string;
}

type GetLeadDetailsResult =
  | { success: true; data: LeadDetailsPayload }
  | { success: false; error: string };

const DEAL_SELECT =
  'id, client_id, title, value, stage_id, contact_id, status, created_at, contact:contacts(*), stage:stages(id, name)';

const EVENT_SELECT_EXTENDED =
  'id, tracking_site_id, visitor_id, contact_id, event_type, url, referrer, landing_url, utm_source, utm_medium, utm_campaign, utm_term, utm_content, fingerprint, metadata, created_at, tracking_sites(domain)';

const EVENT_SELECT_BASE =
  'id, tracking_site_id, visitor_id, contact_id, event_type, url, created_at, tracking_sites(domain)';

function normalizeEvents(raw: unknown, contactId: string): LeadJourneyEvent[] {
  const rows = Array.isArray(raw) ? raw : [];
  return rows
    .map((row: any) => {
      const site = Array.isArray(row.tracking_sites)
        ? row.tracking_sites[0] ?? null
        : row.tracking_sites ?? null;

      return { ...row, tracking_sites: site } as LeadJourneyEvent;
    })
    // Si un evento ya pertenece a otro contacto (fingerprint compartido),
    // no lo mostramos en este journey.
    .filter((event) => !event.contact_id || event.contact_id === contactId);
}

async function loadJourney(contact: Contact): Promise<LeadJourneyEvent[]> {
  const supabase = getSupabaseAdmin();
  const filters: string[] = [];

  if (isUuid(contact.id)) filters.push(`contact_id.eq.${contact.id}`);
  for (const visitorId of getVisitorIds(contact)) {
    if (isUuid(visitorId)) filters.push(`visitor_id.eq.${visitorId}`);
  }
  for (const fingerprint of getFingerprints(contact)) {
    if (isFingerprint(fingerprint)) filters.push(`fingerprint.eq.${fingerprint}`);
  }

  if (filters.length === 0) return [];

  const extended = await supabase
    .from('tracking_events')
    .select(EVENT_SELECT_EXTENDED)
    .or(filters.join(','))
    .order('created_at', { ascending: true })
    .limit(500);

  if (!extended.error) {
    return normalizeEvents(extended.data, contact.id);
  }

  // Si la migración de atribución aún no se aplicó, consultamos lo básico.
  const baseFilters = filters.filter((filter) => !filter.startsWith('fingerprint.'));
  if (baseFilters.length === 0) return [];

  const retry = await supabase
    .from('tracking_events')
    .select(EVENT_SELECT_BASE)
    .or(baseFilters.join(','))
    .order('created_at', { ascending: true })
    .limit(500);

  if (retry.error) {
    console.warn('[lead] journey error:', retry.error.message);
    return [];
  }

  return normalizeEvents(retry.data, contact.id);
}

export async function getLeadDetails(
  input: GetLeadDetailsInput
): Promise<GetLeadDetailsResult> {
  try {
    const supabase = getSupabaseAdmin();
    let contact: Contact | null = null;
    let deal: Deal | null = null;

    if (input.dealId) {
      const { data, error } = await supabase
        .from('deals')
        .select(DEAL_SELECT)
        .eq('id', input.dealId)
        .maybeSingle();

      if (error) return { success: false, error: error.message };
      if (data) {
        deal = data as unknown as Deal;
        contact = ((data as any).contact as Contact | null) ?? null;
      }
    } else if (input.contactId) {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', input.contactId)
        .maybeSingle();

      if (error) return { success: false, error: error.message };
      contact = (data as Contact | null) ?? null;
    }

    if (!contact) {
      return { success: false, error: 'Lead no encontrado.' };
    }

    // Si venimos desde contactos, buscamos su deal más reciente.
    if (!deal) {
      const { data: dealRow, error: dealError } = await supabase
        .from('deals')
        .select(DEAL_SELECT)
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!dealError && dealRow) {
        const { contact: _ignored, ...rest } = dealRow as any;
        deal = rest as Deal;
      }
    }

    const events = await loadJourney(contact);

    return { success: true, data: { contact, deal, events } };
  } catch (err: any) {
    console.error('[lead] getLeadDetails error:', err);
    return {
      success: false,
      error: err?.message || 'Error al cargar la información del lead.',
    };
  }
}
