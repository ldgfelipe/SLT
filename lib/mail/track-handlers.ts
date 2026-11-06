import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { b64urlDecode, verifyPayload } from './signature';

/** 1x1 GIF transparente (43 bytes). */
export const PIXEL_GIF = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x0a,
  0x00, 0x01, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

export type TrackError = { ok: false; status: number; error: string };
export type TrackResult = { ok: true } | TrackError;

/** Píxel de apertura: verifica firma, cuenta apertura y devuelve el GIF. */
export async function trackOpen(
  campaignId: string,
  encodedEmail: string,
  signature: string
): Promise<{ ok: true; pixel: Buffer } | TrackError> {
  const email = b64urlDecode(encodedEmail).toLowerCase();
  const message = `open|${campaignId}|${email}`;

  if (!(await verifyPayload(message, signature))) {
    return { ok: false, status: 403, error: 'Firma inválida.' };
  }

  const supabase = getSupabaseAdmin();

  // Contabilizar apertura únicamente la primera vez por destinatario
  const { data: sendRow } = await supabase
    .from('mail_campaign_sends')
    .select('id, detalle')
    .eq('campana_id', campaignId)
    .eq('email', email)
    .eq('estado', 'enviado')
    .maybeSingle();

  if (sendRow && !sendRow.detalle?.includes('opened')) {
    await supabase
      .from('mail_campaign_sends')
      .update({ detalle: `opened:${new Date().toISOString()}` })
      .eq('id', sendRow.id);

    await supabase.rpc('increment_mail_counter', {
      p_campana_id: campaignId,
      p_column: 'abiertos',
    });
  }

  return { ok: true, pixel: PIXEL_GIF };
}

/** Clic: verifica firma, cuenta clic y devuelve la URL destino. */
export async function trackClick(
  campaignId: string,
  encodedUrl: string,
  signature: string
): Promise<{ ok: true; redirect: string } | TrackError> {
  const target = b64urlDecode(encodedUrl);

  if (!/^https?:\/\//i.test(target)) {
    return { ok: false, status: 400, error: 'URL inválida.' };
  }

  const message = `click|${campaignId}|${target}`;

  if (!(await verifyPayload(message, signature))) {
    return { ok: false, status: 403, error: 'Firma inválida.' };
  }

  const supabase = getSupabaseAdmin();
  await supabase.rpc('increment_mail_counter', {
    p_campana_id: campaignId,
    p_column: 'clics',
  });

  return { ok: true, redirect: target };
}

/** Baja: verifica firma, registra en la base de bajas y marca al contacto. */
export async function trackUnsubscribe(
  campaignId: string,
  encodedEmail: string,
  signature: string
): Promise<TrackResult> {
  const email = b64urlDecode(encodedEmail).toLowerCase();
  const message = `baja|${campaignId}|${email}`;

  if (!(await verifyPayload(message, signature))) {
    return { ok: false, status: 403, error: 'Firma inválida.' };
  }

  const supabase = getSupabaseAdmin();

  // Obtener el cliente de la campaña
  const { data: campaign } = await supabase
    .from('mail_campaigns')
    .select('id, client_id')
    .eq('id', campaignId)
    .maybeSingle();

  if (!campaign) {
    return { ok: false, status: 404, error: 'Campaña no encontrada.' };
  }

  const clientId = campaign.client_id;

  await supabase.from('ses_bajas').upsert(
    {
      client_id: clientId,
      email,
      motivo: 'baja voluntaria',
      origen: 'enlace',
      campana_id: campaignId,
      detalle: 'Baja solicitada desde el enlace del correo',
    },
    { onConflict: 'client_id,email', ignoreDuplicates: true }
  );

  await supabase
    .from('contacts')
    .update({ mail_state: 'no_suscrito' })
    .eq('client_id', clientId)
    .eq('email', email);

  return { ok: true };
}
