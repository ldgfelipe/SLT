'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/app/actions/auth';
import { canAccessClient } from '@/lib/growth/access';
import { revalidatePath } from 'next/cache';
import {
  estimateRecipients,
  sendCampaignBatch,
  startCampaignNow,
  todayUsage,
} from '@/lib/mail/batch';
import type { MailCampaign } from '@/types/database';

const DEFAULT_ENV_LIMIT = 300;

export async function getCampaignStats(clientId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };
  if (!canAccessClient(user, clientId)) {
    return { success: false as const, error: 'Sin acceso a este cliente.' };
  }

  try {
    const supabase = getSupabaseAdmin();

    const [hoy, { data: settings }, estadoCounts, { count: totalContactos }] =
      await Promise.all([
        todayUsage(supabase, clientId),
        supabase
          .from('mail_settings')
          .select('limite_diario')
          .eq('client_id', clientId)
          .maybeSingle(),
        supabase
          .from('mail_campaigns')
          .select('estado')
          .eq('client_id', clientId)
          .in('estado', ['enviando', 'programada', 'pausada', 'error']),
        supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId),
      ]);

    const limite =
      settings?.limite_diario && settings.limite_diario > 0
        ? Number(settings.limite_diario)
        : DEFAULT_ENV_LIMIT;

    const rows = estadoCounts?.data || [];
    const count = (estado: string) =>
      rows.filter((row) => row.estado === estado).length;

    return {
      success: true as const,
      stats: {
        hoy,
        limite,
        cupoRestante: Math.max(0, limite - hoy),
        activas: count('enviando'),
        programadas: count('programada'),
        pausadas: count('pausada'),
        conError: count('error'),
        totalContactos: totalContactos ?? 0,
      },
    };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al cargar.' };
  }
}

export async function listMailCampaigns(
  clientId: string,
  options: { estado?: string | null; search?: string | null } = {}
) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };
  if (!canAccessClient(user, clientId)) {
    return { success: false as const, error: 'Sin acceso a este cliente.' };
  }

  try {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('mail_campaigns')
      .select(
        '*, lista:mail_lists(id, name), conexion:mail_connections(id, nombre, proveedor)'
      )
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (options.estado) query = query.eq('estado', options.estado);
    const q = (options.search || '').trim();
    if (q.length >= 2) {
      const clean = q.replace(/[%(),]/g, ' ');
      query = query.or(`name.ilike.%${clean}%,subject.ilike.%${clean}%`);
    }

    const { data, error } = await query;
    if (error) return { success: false as const, error: error.message };

    return { success: true as const, campaigns: (data || []) as MailCampaign[] };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al cargar campañas.' };
  }
}

export async function getMailCampaign(campaignId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('mail_campaigns')
      .select(
        '*, lista:mail_lists(id, name), conexion:mail_connections(id, nombre, proveedor)'
      )
      .eq('id', campaignId)
      .maybeSingle();

    if (error || !data) {
      return { success: false as const, error: 'Campaña no encontrada.' };
    }
    if (!canAccessClient(user, data.client_id)) {
      return { success: false as const, error: 'Sin acceso.' };
    }

    return { success: true as const, campaign: data as MailCampaign };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al cargar.' };
  }
}

export interface SaveCampaignInput {
  id?: string | null;
  nombre: string;
  asunto: string;
  html?: string;
  listaId?: string | null;
  canalTipo: 'api' | 'smtp';
  canalId?: string | null;
  senderName?: string;
  senderEmail?: string;
  scheduledAt?: string | null;
  sendNow?: boolean;
  saveAsDraft?: boolean;
}

export async function saveMailCampaign(
  clientId: string,
  input: SaveCampaignInput
) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };
  if (!canAccessClient(user, clientId)) {
    return { success: false as const, error: 'Sin acceso a este cliente.' };
  }

  const nombre = input.nombre.trim().slice(0, 160);
  const asunto = input.asunto.trim().slice(0, 300);

  if (!nombre || !asunto) {
    return { success: false as const, error: 'Nombre y asunto son obligatorios.' };
  }

  if (!input.listaId) {
    return { success: false as const, error: 'Selecciona una lista.' };
  }

  try {
    const supabase = getSupabaseAdmin();

    if (input.canalId) {
      const { data: connection } = await supabase
        .from('mail_connections')
        .select('id')
        .eq('id', input.canalId)
        .eq('client_id', clientId)
        .maybeSingle();

      if (!connection) {
        return { success: false as const, error: 'La conexión no pertenece a este cliente.' };
      }
    }

    const estado = input.saveAsDraft
      ? 'borrador'
      : input.sendNow
        ? 'enviando'
        : input.scheduledAt
          ? 'programada'
          : 'borrador';

    const payload = {
      client_id: clientId,
      name: nombre,
      subject: asunto,
      html: input.html || '',
      lista_id: input.listaId,
      canal_tipo: input.canalTipo,
      canal_id: input.canalId || null,
      sender_name: input.senderName?.trim().slice(0, 160) || null,
      sender_email: input.senderEmail?.trim().slice(0, 254) || null,
      estado,
      scheduled_at: input.scheduledAt || null,
      updated_at: new Date().toISOString(),
    };

    let campaignId = input.id || null;

    if (campaignId) {
      const { data: existing } = await supabase
        .from('mail_campaigns')
        .select('id, estado')
        .eq('id', campaignId)
        .eq('client_id', clientId)
        .maybeSingle();

      if (!existing) {
        return { success: false as const, error: 'Campaña no encontrada.' };
      }

      const { error } = await supabase
        .from('mail_campaigns')
        .update(payload)
        .eq('id', campaignId);

      if (error) return { success: false as const, error: error.message };
    } else {
      const { data, error } = await supabase
        .from('mail_campaigns')
        .insert(payload)
        .select('id')
        .single();

      if (error || !data) {
        return { success: false as const, error: error?.message || 'Error al crear.' };
      }
      campaignId = data.id;
    }

    revalidatePath('/dashboard/mail-center/campanas');
    return { success: true as const, campaignId: campaignId! };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al guardar.' };
  }
}

export async function duplicateMailCampaign(campaignId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data: original } = await supabase
      .from('mail_campaigns')
      .select('*')
      .eq('id', campaignId)
      .maybeSingle();

    if (!original) return { success: false as const, error: 'Campaña no encontrada.' };
    if (!canAccessClient(user, original.client_id)) {
      return { success: false as const, error: 'Sin acceso.' };
    }

    const { data, error } = await supabase
      .from('mail_campaigns')
      .insert({
        client_id: original.client_id,
        name: `${original.name} (copia)`,
        subject: original.subject,
        html: original.html,
        lista_id: original.lista_id,
        canal_tipo: original.canal_tipo,
        canal_id: original.canal_id,
        sender_name: original.sender_name,
        sender_email: original.sender_email,
        estado: 'borrador',
        scheduled_at: null,
        total_destinatarios: 0,
        enviados: 0,
        abiertos: 0,
        clics: 0,
        rebotados: 0,
        invalidos: 0,
        error_log: null,
      })
      .select('id')
      .single();

    if (error || !data) {
      return { success: false as const, error: error?.message || 'Error al duplicar.' };
    }

    revalidatePath('/dashboard/mail-center/campanas');
    return { success: true as const, campaignId: data.id };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al duplicar.' };
  }
}

export async function deleteMailCampaign(campaignId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data: campaign } = await supabase
      .from('mail_campaigns')
      .select('id, client_id')
      .eq('id', campaignId)
      .maybeSingle();

    if (!campaign) return { success: false as const, error: 'Campaña no encontrada.' };
    if (!canAccessClient(user, campaign.client_id)) {
      return { success: false as const, error: 'Sin acceso.' };
    }

    const { error } = await supabase
      .from('mail_campaigns')
      .delete()
      .eq('id', campaignId);

    if (error) return { success: false as const, error: error.message };
    revalidatePath('/dashboard/mail-center/campanas');
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al eliminar.' };
  }
}

export async function pauseMailCampaign(campaignId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data: campaign } = await supabase
      .from('mail_campaigns')
      .select('id, client_id')
      .eq('id', campaignId)
      .maybeSingle();

    if (!campaign) return { success: false as const, error: 'Campaña no encontrada.' };
    if (!canAccessClient(user, campaign.client_id)) {
      return { success: false as const, error: 'Sin acceso.' };
    }

    const { error } = await supabase
      .from('mail_campaigns')
      .update({ estado: 'pausada', updated_at: new Date().toISOString() })
      .eq('id', campaignId)
      .in('estado', ['enviando', 'programada']);

    if (error) return { success: false as const, error: error.message };
    revalidatePath('/dashboard/mail-center/campanas');
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al pausar.' };
  }
}

export async function resumeMailCampaign(campaignId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data: campaign } = await supabase
      .from('mail_campaigns')
      .select('id, client_id')
      .eq('id', campaignId)
      .maybeSingle();

    if (!campaign) return { success: false as const, error: 'Campaña no encontrada.' };
    if (!canAccessClient(user, campaign.client_id)) {
      return { success: false as const, error: 'Sin acceso.' };
    }

    const { error } = await supabase
      .from('mail_campaigns')
      .update({
        estado: 'enviando',
        error_log: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId)
      .eq('estado', 'pausada');

    if (error) return { success: false as const, error: error.message };
    revalidatePath('/dashboard/mail-center/campanas');
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al reanudar.' };
  }
}

export async function cancelMailCampaign(campaignId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data: campaign } = await supabase
      .from('mail_campaigns')
      .select('id, client_id')
      .eq('id', campaignId)
      .maybeSingle();

    if (!campaign) return { success: false as const, error: 'Campaña no encontrada.' };
    if (!canAccessClient(user, campaign.client_id)) {
      return { success: false as const, error: 'Sin acceso.' };
    }

    const { error } = await supabase
      .from('mail_campaigns')
      .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
      .eq('id', campaignId)
      .in('estado', ['borrador', 'programada', 'enviando', 'pausada', 'error']);

    if (error) return { success: false as const, error: error.message };

    await supabase
      .from('mail_campaign_sends')
      .update({ estado: 'error', detalle: 'Campaña cancelada por el usuario' })
      .eq('campana_id', campaignId)
      .in('estado', ['pendiente', 'enviando']);

    revalidatePath('/dashboard/mail-center/campanas');
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al cancelar.' };
  }
}

export async function estimateMailCampaignRecipients(
  clientId: string,
  listaId: string | null
) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };
  if (!canAccessClient(user, clientId)) {
    return { success: false as const, error: 'Sin acceso a este cliente.' };
  }

  try {
    const supabase = getSupabaseAdmin();
    const total = await estimateRecipients(supabase, clientId, listaId);
    return { success: true as const, total };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al estimar.' };
  }
}

export async function startMailCampaign(campaignId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data: campaign, error } = await supabase
      .from('mail_campaigns')
      .select('*')
      .eq('id', campaignId)
      .maybeSingle();

    if (error || !campaign) {
      return { success: false as const, error: 'Campaña no encontrada.' };
    }
    if (!canAccessClient(user, campaign.client_id)) {
      return { success: false as const, error: 'Sin acceso.' };
    }

    // Arrancar ahora y procesar el primer lote
    const started = await startCampaignNow(supabase, campaign);
    if (started.error) {
      return { success: false as const, error: started.error };
    }

    const result = await sendCampaignBatch(campaignId, { batchSize: 200, start: true });

    revalidatePath('/dashboard/mail-center/campanas');
    return {
      success: true as const,
      batch: {
        processed: result.processed,
        sent: result.sent,
        failed: result.failed,
        skipped: result.skipped,
        remaining: result.remaining,
      },
    };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al enviar.' };
  }
}

export async function continueMailCampaign(campaignId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data: campaign } = await supabase
      .from('mail_campaigns')
      .select('id, client_id')
      .eq('id', campaignId)
      .maybeSingle();

    if (!campaign) return { success: false as const, error: 'Campaña no encontrada.' };
    if (!canAccessClient(user, campaign.client_id)) {
      return { success: false as const, error: 'Sin acceso.' };
    }

    const result = await sendCampaignBatch(campaignId, { batchSize: 200 });
    revalidatePath('/dashboard/mail-center/campanas');
    return {
      success: true as const,
      batch: {
        processed: result.processed,
        sent: result.sent,
        failed: result.failed,
        skipped: result.skipped,
        remaining: result.remaining,
        error: result.error,
      },
    };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al procesar.' };
  }
}

/** Arranca automáticamente las campañas programadas vencidas (cron y al abrir la página). */
export async function tickDueMailCampaigns(clientId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };
  if (!canAccessClient(user, clientId)) {
    return { success: false as const, error: 'Sin acceso a este cliente.' };
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: due } = await supabase
      .from('mail_campaigns')
      .select('id')
      .eq('client_id', clientId)
      .eq('estado', 'programada')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(5);

    for (const row of due || []) {
      const { data: campaign } = await supabase
        .from('mail_campaigns')
        .select('*')
        .eq('id', row.id)
        .maybeSingle();
      if (!campaign) continue;
      await startCampaignNow(supabase, campaign);
      await sendCampaignBatch(campaign.id, { batchSize: 200, start: true });
    }

    // Continuar envíos en curso (un lote)
    const { data: running } = await supabase
      .from('mail_campaigns')
      .select('id')
      .eq('client_id', clientId)
      .eq('estado', 'enviando')
      .order('started_at', { ascending: true })
      .limit(3);

    for (const row of running || []) {
      await sendCampaignBatch(row.id, { batchSize: 200 });
    }

    return { success: true as const };
  } catch (err: any) {
    console.warn('[mail] tick error:', err);
    return { success: false as const, error: err?.message || 'Error al procesar.' };
  }
}

export async function listMailCampaignSends(campaignId: string, limit = 100) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data: campaign } = await supabase
      .from('mail_campaigns')
      .select('id, client_id')
      .eq('id', campaignId)
      .maybeSingle();

    if (!campaign) return { success: false as const, error: 'Campaña no encontrada.' };
    if (!canAccessClient(user, campaign.client_id)) {
      return { success: false as const, error: 'Sin acceso.' };
    }

    const { data, error } = await supabase
      .from('mail_campaign_sends')
      .select('id, email, estado, detalle, sent_at, created_at')
      .eq('campana_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(Math.min(500, Math.max(10, limit)));

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, sends: data || [] };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al cargar bitácora.' };
  }
}
