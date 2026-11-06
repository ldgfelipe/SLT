import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { renderTemplate, type ContactForVars } from './variables';
import { trackEmailHtml } from './tracking';
import {
  sendCampaignEmail,
  type MailConnectionRecord,
  type MailMessage,
} from './senders';
import { getAppUrl } from '@/lib/growth/providers';

const DEFAULT_ENV_LIMIT = 300;
const BATCH_SIZE = 200;
const SELECT_DELIVERABLE_STATES = new Set([
  'activo',
  'suscrito',
  'pausado',
  'no_interesado',
]);

interface SupabaseLike {
  from: (table: string) => any;
}

export interface BatchResult {
  ok: boolean;
  started?: boolean;
  done?: boolean;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  remaining: number;
  error?: string;
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                           */
/* ------------------------------------------------------------------ */

export async function isSuppressed(
  supabase: SupabaseLike,
  clientId: string,
  email: string
): Promise<boolean> {
  const clean = email.trim().toLowerCase();
  if (!clean) return true;

  const { data, error } = await supabase
    .from('ses_bajas')
    .select('email')
    .eq('client_id', clientId)
    .ilike('email', clean)
    .limit(1);

  if (error) {
    console.warn('[mail/batch] suppression check error:', error.message);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

export async function todayUsage(
  supabase: SupabaseLike,
  clientId: string
): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('mail_campaign_sends')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('estado', 'enviado')
    .gte('sent_at', startOfDay.toISOString());

  return count ?? 0;
}

async function envLimit(supabase: SupabaseLike, clientId: string): Promise<number> {
  const { data } = await supabase
    .from('mail_settings')
    .select('limite_diario')
    .eq('client_id', clientId)
    .maybeSingle();

  return data?.limite_diario && data.limite_diario > 0
    ? Number(data.limite_diario)
    : DEFAULT_ENV_LIMIT;
}

/** Destinatarios de una campaña (conteo aproximado para la UI). */
export async function estimateRecipients(
  supabase: SupabaseLike,
  clientId: string,
  listaId: string | null
): Promise<number> {
  try {
    if (!listaId) return 0;

    const { count } = await supabase
      .from('mail_list_contacts')
      .select('contacto_id, contacts!inner(id, mail_state, email)', {
        count: 'exact',
        head: true,
      })
      .eq('lista_id', listaId)
      .eq('contacts.client_id', clientId)
      .not('contacts.email', 'is', null)
      .in('contacts.mail_state', Array.from(SELECT_DELIVERABLE_STATES));

    return count ?? 0;
  } catch {
    // Respaldo: total de la lista sin filtro de estado
    const { count } = await supabase
      .from('mail_list_contacts')
      .select('contacto_id', { count: 'exact', head: true })
      .eq('lista_id', listaId);
    return count ?? 0;
  }
}

/** Crea los envíos pendientes de la campaña (idempotente). */
export async function prepareCampaignRecipients(
  supabase: SupabaseLike,
  campaign: any
): Promise<number> {
  if (campaign.total_destinatarios > 0) return campaign.total_destinatarios;
  if (!campaign.lista_id) {
    throw new Error('La campaña no tiene una lista asignada.');
  }

  const { data: rows, error } = await supabase
    .from('mail_list_contacts')
    .select('contacto_id, contacts!inner(id, email, mail_state, first_name, last_name, phone, data, client_id)')
    .eq('lista_id', campaign.lista_id)
    .eq('contacts.client_id', campaign.client_id)
    .limit(50_000);

  if (error) throw error;

  const contacts = (rows || [])
    .map((row: any) => (Array.isArray(row.contacts) ? row.contacts[0] : row.contacts))
    .filter(
      (contact: any) =>
        contact &&
        contact.email &&
        SELECT_DELIVERABLE_STATES.has(contact.mail_state)
    );

  if (contacts.length === 0) return 0;

  // Excluir los que ya están dados de baja
  const { data: bajas } = await supabase
    .from('ses_bajas')
    .select('email')
    .eq('client_id', campaign.client_id);

  const suppressed = new Set((bajas || []).map((row: any) => String(row.email).toLowerCase()));

  const seen = new Set<string>();
  const inserts: any[] = [];

  for (const contact of contacts) {
    const email = String(contact.email).trim().toLowerCase();
    if (!email || suppressed.has(email) || seen.has(email)) continue;
    seen.add(email);
    inserts.push({
      campana_id: campaign.id,
      client_id: campaign.client_id,
      contacto_id: contact.id,
      email,
      estado: 'pendiente',
    });
  }

  if (inserts.length === 0) return 0;

  // Insertar en bloques de 500
  for (let i = 0; i < inserts.length; i += 500) {
    const { error: insertError } = await supabase
      .from('mail_campaign_sends')
      .insert(inserts.slice(i, i + 500));
    if (insertError) throw insertError;
  }

  await supabase
    .from('mail_campaigns')
    .update({
      total_destinatarios: inserts.length,
      invalidos: Math.max(0, contacts.length - inserts.length),
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaign.id);

  return inserts.length;
}

/* ------------------------------------------------------------------ */
/* Procesamiento de lote                                                */
/* ------------------------------------------------------------------ */

export async function sendCampaignBatch(
  campaignId: string,
  options: { batchSize?: number; start?: boolean } = {}
): Promise<BatchResult> {
  const supabase = getSupabaseAdmin();
  const batchSize = Math.min(options.batchSize ?? BATCH_SIZE, 500);

  try {
    const { data: campaign, error } = await supabase
      .from('mail_campaigns')
      .select('*')
      .eq('id', campaignId)
      .maybeSingle();

    if (error || !campaign) {
      return { ok: false, processed: 0, sent: 0, failed: 0, skipped: 0, remaining: 0, error: 'Campaña no encontrada.' };
    }

    if (campaign.estado === 'enviada' || campaign.estado === 'cancelada' || campaign.estado === 'error') {
      return { ok: false, processed: 0, sent: 0, failed: 0, skipped: 0, remaining: 0, error: `La campaña está en estado ${campaign.estado}.` };
    }

    // Arrancar si corresponde
    if (campaign.estado === 'programada') {
      const due = !campaign.scheduled_at || new Date(campaign.scheduled_at).getTime() <= Date.now();
      if (!due && !options.start) {
        return { ok: false, processed: 0, sent: 0, failed: 0, skipped: 0, remaining: 0, error: 'La campaña aún no está programada para enviar.' };
      }
      await prepareCampaignRecipients(supabase, campaign);
      await supabase
        .from('mail_campaigns')
        .update({ estado: 'enviando', started_at: new Date().toISOString(), error_log: null, updated_at: new Date().toISOString() })
        .eq('id', campaignId);
      campaign.estado = 'enviando';
    }

    if (campaign.estado !== 'enviando' && campaign.estado !== 'pausada') {
      return { ok: false, processed: 0, sent: 0, failed: 0, skipped: 0, remaining: 0, error: `La campaña está en estado ${campaign.estado}.` };
    }

    if (campaign.estado === 'pausada') {
      return { ok: false, processed: 0, sent: 0, failed: 0, skipped: 0, remaining: 0, error: 'La campaña está pausada. Reanúdala primero.' };
    }

    /* ---------------- Límite del ambiente (no aplica a SES) ---------------- */
    const { data: connectionRow } = await supabase
      .from('mail_connections')
      .select('id, client_id, nombre, proveedor, config, activo')
      .eq('id', campaign.canal_id || '')
      .maybeSingle();

    const connection = connectionRow as MailConnectionRecord | null;
    if (!connection) {
      await supabase
        .from('mail_campaigns')
        .update({ estado: 'error', error_log: 'No hay una conexión de envío asignada.', updated_at: new Date().toISOString() })
        .eq('id', campaignId);
      return { ok: false, processed: 0, sent: 0, failed: 0, skipped: 0, remaining: 0, error: 'No hay una conexión de envío asignada.' };
    }
    if (!connection.activo) {
      return { ok: false, processed: 0, sent: 0, failed: 0, skipped: 0, remaining: 0, error: 'La conexión está desactivada.' };
    }

    const isSes = connection.proveedor === 'ses';

    if (!isSes) {
      const limit = await envLimit(supabase, campaign.client_id);
      const used = await todayUsage(supabase, campaign.client_id);
      if (used >= limit) {
        await supabase
          .from('mail_campaigns')
          .update({
            estado: 'pausada',
            error_log: `Límite diario del ambiente alcanzado (${used}/${limit}). Se reanudará cuando vuelva a haber cupo.`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', campaignId);
        return { ok: false, processed: 0, sent: 0, failed: 0, skipped: 0, remaining: 0, error: 'Límite diario del ambiente alcanzado.' };
      }
    }

    /* ---------------- Lote de pendientes ---------------- */
    const { data: pending, error: pendingError } = await supabase
      .from('mail_campaign_sends')
      .select('id, email, contacto_id, estado')
      .eq('campana_id', campaignId)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (pendingError) throw pendingError;

    if (!pending || pending.length === 0) {
      await supabase
        .from('mail_campaigns')
        .update({ estado: 'enviada', finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      return { ok: true, done: true, processed: 0, sent: 0, failed: 0, skipped: 0, remaining: 0 };
    }

    // Marcar el lote como "enviando"
    const pendingIds = pending.map((row: any) => row.id);
    await supabase
      .from('mail_campaign_sends')
      .update({ estado: 'enviando' })
      .in('id', pendingIds)
      .eq('estado', 'pendiente');

    // Cargar contactos del lote
    const contactIds = pending.map((row: any) => row.contacto_id).filter(Boolean);
    const { data: contactRows } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, data, client_id, mail_state')
      .in('id', contactIds.length ? contactIds : ['00000000-0000-0000-0000-000000000000']);

    const contactsById = new Map((contactRows || []).map((row: any) => [row.id, row]));

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const sleepForSes = isSes;
    let sinceLastSleep = 0;

    for (const row of pending) {
      // ¿Dado de baja?
      if (await isSuppressed(supabase, campaign.client_id, row.email)) {
        await supabase
          .from('mail_campaign_sends')
          .update({ estado: 'no_suscrito', detalle: 'Email en la base de bajas', sent_at: new Date().toISOString() })
          .eq('id', row.id);
        await supabase.rpc('increment_mail_counter', { p_campana_id: campaignId, p_column: 'invalidos' });
        // Marcar contacto como no suscrito
        if (row.contacto_id) {
          await supabase
            .from('contacts')
            .update({ mail_state: 'no_suscrito' })
            .eq('id', row.contacto_id)
            .eq('client_id', campaign.client_id);
        }
        skipped += 1;
        continue;
      }

      const contact = row.contacto_id ? (contactsById.get(row.contacto_id) as any) : null;

      const varsContact: ContactForVars = contact || {
        first_name: '',
        email: row.email,
      };

      const renderedHtml = renderTemplate(campaign.html || '', varsContact);
      const subject = renderTemplate(campaign.subject || '', varsContact);
      const fromName = renderTemplate(campaign.sender_name || 'Inventser', varsContact);
      const fromEmail = (campaign.sender_email || '').trim();

      const tracked = await trackEmailHtml(renderedHtml, {
        campaignId,
        email: row.email,
        correoBajas: null,
        senderEmail: fromEmail,
        baseUrl: getAppUrl(),
      });

      const message: MailMessage = {
        to: row.email,
        toName: contact ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : undefined,
        fromName,
        fromEmail,
        subject,
        html: tracked.html,
        listUnsubscribe: tracked.listUnsubscribe,
        listUnsubscribeOneClick: true,
      };

      const result = await sendCampaignEmail(connection, message, campaign.canal_tipo === 'smtp' ? 'smtp' : 'auto');

      if (result.ok) {
        sent += 1;
        await supabase
          .from('mail_campaign_sends')
          .update({
            estado: 'enviado',
            detalle:
              result.provider === 'ses' && result.messageId
                ? `ses:${result.messageId}`
                : null,
            sent_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        await supabase.rpc('increment_mail_counter', { p_campana_id: campaignId, p_column: 'enviados' });
      } else {
        failed += 1;
        await supabase
          .from('mail_campaign_sends')
          .update({ estado: 'error', detalle: (result.error || 'Error de envío').slice(0, 500), sent_at: new Date().toISOString() })
          .eq('id', row.id);
        await supabase.rpc('increment_mail_counter', { p_campana_id: campaignId, p_column: 'rebotados' });
      }

      if (sleepForSes) {
        sinceLastSleep += 1;
        if (sinceLastSleep >= 14) {
          await new Promise((resolve) => setTimeout(resolve, 1050));
          sinceLastSleep = 0;
        }
      }
    }

    // ¿Quedan pendientes?
    const { count: remaining } = await supabase
      .from('mail_campaign_sends')
      .select('id', { count: 'exact', head: true })
      .eq('campana_id', campaignId)
      .eq('estado', 'pendiente');

    if ((remaining ?? 0) === 0) {
      await supabase
        .from('mail_campaigns')
        .update({ estado: 'enviada', finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', campaignId);
    }

    return {
      ok: true,
      processed: pending.length,
      sent,
      failed,
      skipped,
      remaining: remaining ?? 0,
    };
  } catch (error: any) {
    console.error('[mail/batch] error:', error);
    return {
      ok: false,
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      remaining: 0,
      error: error?.message || 'Error procesando el lote.',
    };
  }
}

/** Marca la campaña como enviando y prepara sus destinatarios. */
export async function startCampaignNow(
  supabase: SupabaseLike,
  campaign: any
): Promise<{ ok: boolean; error?: string }> {
  try {
    const created = await prepareCampaignRecipients(supabase, campaign);
    await supabase
      .from('mail_campaigns')
      .update({
        estado: 'enviando',
        started_at: new Date().toISOString(),
        error_log: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaign.id);

    if (created === 0) {
      return { ok: true };
    }
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'Error al preparar la campaña.' };
  }
}
