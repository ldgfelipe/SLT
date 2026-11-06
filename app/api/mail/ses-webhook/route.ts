import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getSetting } from '@/lib/app/settings';

export const maxDuration = 30;

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const secret = await getSetting('CRON_SECRET');
  if (!secret) return false;

  const provided =
    request.headers.get('x-ses-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    new URL(request.url).searchParams.get('secret') ||
    '';

  return provided === secret;
}

interface SnsMessage {
  Type?: string;
  SubscribeURL?: string;
  Message?: string;
  TopicArn?: string;
}

interface SesEvent {
  notificationType?: string;
  mail?: {
    messageId?: string;
    source?: string;
    destination?: string[];
  };
  bounce?: {
    bounceType?: string;
    bounceSubType?: string;
    bouncedRecipients?: Array<{ emailAddress?: string }>;
    feedbackId?: string;
  };
  complaint?: {
    complaintFeedbackType?: string;
    complainedRecipients?: Array<{ emailAddress?: string }>;
    feedbackId?: string;
  };
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  let sns: SnsMessage;
  try {
    const raw = await request.text();
    sns = raw ? JSON.parse(raw) : {};
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  /* Confirmación de suscripción SNS: AWS requiere GET al SubscribeURL */
  if (sns?.Type === 'SubscriptionConfirmation' && sns?.SubscribeURL) {
    try {
      const response = await fetch(sns.SubscribeURL, { method: 'GET' });
      return NextResponse.json({ ok: response.ok, confirmed: true });
    } catch (error: any) {
      return NextResponse.json(
        { ok: false, error: error?.message || 'No se pudo confirmar SNS.' },
        { status: 502 }
      );
    }
  }

  if (!sns?.Message) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  let event: SesEvent;
  try {
    event = JSON.parse(sns.Message);
  } catch {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const supabase = getSupabaseAdmin();
  const type = event?.notificationType || 'Unknown';
  const messageId = event?.mail?.messageId || '';
  const recipients = new Set<string>();

  if (type === 'Bounce') {
    for (const recipient of event?.bounce?.bouncedRecipients || []) {
      if (recipient.emailAddress) recipients.add(recipient.emailAddress.toLowerCase());
    }
  } else if (type === 'Complaint') {
    for (const recipient of event?.complaint?.complainedRecipients || []) {
      if (recipient.emailAddress) recipients.add(recipient.emailAddress.toLowerCase());
    }
  } else {
    for (const dest of event?.mail?.destination || []) {
      recipients.add(dest.toLowerCase());
    }
  }

  /* Localizar el cliente/campaña a partir del messageId registrado */
  let clientId: string | null = null;
  let campanaId: string | null = null;

  if (messageId) {
    const safeMessageId = messageId.replace(/[%_\\]/g, (match) => `\\${match}`);
    const { data: sends } = await supabase
      .from('mail_campaign_sends')
      .select('id, client_id, campana_id, contacto_id')
      .ilike('detalle', `ses:${safeMessageId}`)
      .limit(5);

    if (sends && sends.length > 0) {
      clientId = sends[0].client_id;
      campanaId = sends[0].campana_id;

      if (type === 'Bounce' || type === 'Complaint') {
        await supabase
          .from('mail_campaign_sends')
          .update({
            estado: 'error',
            detalle: `ses:${type.toLowerCase()}:${messageId}`,
            sent_at: new Date().toISOString(),
          })
          .in('id', sends.map((s) => s.id));
      }
    }
  }

  /* Si no hay messageId, intentar por correo del destinatario */
  if (!clientId && recipients.size > 0) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('client_id')
      .in('email', Array.from(recipients))
      .limit(1);

    if (contacts && contacts.length > 0) {
      clientId = contacts[0].client_id;
    }
  }

  if (!clientId) {
    // No podemos atribuirlo; registramos igual para depuración.
    await supabase.from('ses_eventos').insert({
      client_id: '00000000-0000-0000-0000-000000000000',
      evento: type,
      email: Array.from(recipients)[0] || null,
      motivo: 'sin cliente atribuido',
      message_id: messageId || null,
      campana_id: null,
    } as any);

    return NextResponse.json({ ok: true, attributed: false });
  }

  const isPermanentBounce =
    type === 'Bounce' && event?.bounce?.bounceType === 'Permanent';
  const isComplaint = type === 'Complaint';

  for (const email of recipients) {
    await supabase.from('ses_eventos').insert({
      client_id: clientId,
      evento: type,
      email,
      motivo:
        type === 'Bounce'
          ? event?.bounce?.bounceType || 'bounce'
          : event?.complaint?.complaintFeedbackType || 'complaint',
      message_id: messageId || null,
      campana_id: campanaId,
    });

    if (isPermanentBounce || isComplaint) {
      await supabase.from('ses_bajas').upsert(
        {
          client_id: clientId,
          email,
          motivo: isComplaint ? 'marcado como spam' : 'rebote duro',
          origen: 'ses',
          campana_id: campanaId,
          detalle: event?.bounce?.bounceSubType || event?.complaint?.complaintFeedbackType || null,
        },
        { onConflict: 'client_id,email', ignoreDuplicates: true }
      );

      await supabase
        .from('contacts')
        .update({ mail_state: isComplaint ? 'no_suscrito' : 'rebotado' })
        .eq('client_id', clientId)
        .eq('email', email);
    }
  }

  if (campanaId && (isPermanentBounce || isComplaint)) {
    await supabase.rpc('increment_mail_counter', {
      p_campana_id: campanaId,
      p_column: 'rebotados',
    });
  }

  return NextResponse.json({
    ok: true,
    processed: recipients.size,
    type,
    attributed: true,
  });
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    ok: true,
    message: 'Endpoint SNS de Amazon SES. POST con firma X-Ses-Secret.',
  });
}
