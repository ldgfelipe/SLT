import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  BASIC_CONTACT_FIELDS,
  CAPTCHA_SECRET_ENV,
  CaptchaProvider,
  normalizeFormConfig,
} from '@/types/forms';
import type { LeadAttribution } from '@/types/database';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/** Campos que no deben guardarse como datos extra del contacto. */
const RESERVED_FIELDS = new Set<string>([
  ...BASIC_CONTACT_FIELDS,
  'hp',
  'website',
  'visitor_id',
  'site_id',
  'title',
  'value',
  '_slt_ts',
  '_slt_fingerprint',
  '_slt_page_url',
  '_slt_page_title',
  '_slt_referrer',
  '_slt_landing_url',
  '_slt_placement',
  '_slt_utm_source',
  '_slt_utm_medium',
  '_slt_utm_campaign',
  '_slt_utm_term',
  '_slt_utm_content',
  'g-recaptcha-response',
  'cf-turnstile-response',
]);

const ATTRIBUTION_COLUMNS = [
  'referrer',
  'landing_url',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fingerprint',
  'metadata',
];

/** Detecta columnas de atribución pendientes de migración en tracking_events. */
function isMissingTrackingColumn(message: string | undefined): boolean {
  const text = (message || '').toLowerCase();
  if (!text) return false;
  const looksMissing =
    text.includes('does not exist') ||
    text.includes('could not find') ||
    text.includes('schema cache') ||
    text.includes('undefined column');
  return looksMissing && ATTRIBUTION_COLUMNS.some((column) => text.includes(column));
}

const CAPTCHA_RESPONSE_FIELDS: Record<CaptchaProvider, string> = {
  none: '',
  recaptcha: 'g-recaptcha-response',
  turnstile: 'cf-turnstile-response',
};

const CAPTCHA_VERIFY_URLS: Record<Exclude<CaptchaProvider, 'none'>, string> = {
  recaptcha: 'https://www.google.com/recaptcha/api/siteverify',
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
};

type CaptchaResult =
  | { ok: true }
  | { ok: false; code: 'captcha_failed' | 'captcha_not_configured'; error: string };

async function verifyCaptcha(
  provider: CaptchaProvider,
  token: string,
  remoteIp?: string
): Promise<CaptchaResult> {
  if (provider === 'none') return { ok: true };

  const secret = process.env[CAPTCHA_SECRET_ENV[provider]];
  if (!secret) {
    console.error(
      `[forms submit] Falta la variable de entorno ${CAPTCHA_SECRET_ENV[provider]} para ${provider}.`
    );
    return {
      ok: false,
      code: 'captcha_not_configured',
      error: 'La protección anti-bot no está configurada en el servidor.',
    };
  }

  if (!token) {
    return {
      ok: false,
      code: 'captcha_failed',
      error: 'Completa la verificación anti-bot.',
    };
  }

  const payload = new URLSearchParams({ secret, response: token });
  if (remoteIp) payload.set('remoteip', remoteIp);

  try {
    const response = await fetch(CAPTCHA_VERIFY_URLS[provider], {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload,
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    const result = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      'error-codes'?: string[];
    };

    if (result.success === true) return { ok: true };

    console.warn('[forms submit] captcha rechazado:', provider, result['error-codes']);
    return {
      ok: false,
      code: 'captcha_failed',
      error: 'La verificación anti-bot falló. Inténtalo de nuevo.',
    };
  } catch (err) {
    console.warn('[forms submit] error verificando captcha:', err);
    return {
      ok: false,
      code: 'captcha_failed',
      error: 'No se pudo verificar la protección anti-bot. Inténtalo de nuevo.',
    };
  }
}

async function parseBody(req: NextRequest): Promise<Record<string, any> | null> {
  const contentType = (req.headers.get('content-type') || '').toLowerCase();
  try {
    if (contentType.includes('application/json')) {
      return (await req.json()) as Record<string, any>;
    }

    const text = (await req.text()).trim();
    if (!text) return null;

    // Algunos clientes envían JSON con text/plain (evita preflight CORS)
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      } catch {
        // continúa como form-encoded
      }
    }

    const data: Record<string, string> = {};
    const params = new URLSearchParams(text);
    params.forEach((value, key) => {
      data[key] = value;
    });
    return data;
  } catch {
    return null;
  }
}

function isFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

/** Detecta si PostgREST se queja de una columna inexistente (migración pendiente). */
function isMissingColumnError(message: string | undefined, column: string): boolean {
  const text = (message || '').toLowerCase();
  return (
    text.includes(column.toLowerCase()) &&
    (text.includes('does not exist') ||
      text.includes('could not find') ||
      text.includes('schema cache') ||
      text.includes('undefined column'))
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: formId } = await params;
    const body = await parseBody(req);

    if (!body) {
      return NextResponse.json(
        { error: 'Formato no soportado. Envía JSON o application/x-www-form-urlencoded.' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Honey pot: si un humano no lo ve, un bot suele rellenarlo.
    if (isFilled(body.hp) || isFilled(body.website)) {
      return NextResponse.json({ success: true }, { status: 201, headers: corsHeaders });
    }

    // Trampa de tiempo: un envío humano tarda más de ~1 segundo en completar el formulario.
    const renderedAt = Number(body._slt_ts);
    if (Number.isFinite(renderedAt) && renderedAt > 0) {
      const elapsed = Date.now() - renderedAt;
      if (elapsed >= 0 && elapsed < 1200) {
        return NextResponse.json({ success: true }, { status: 201, headers: corsHeaders });
      }
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Configuración del formulario
    const { data: form, error: formError } = await supabaseAdmin
      .from('forms')
      .select('id, client_id, pipeline_id, stage_id, fields_config, name')
      .eq('id', formId)
      .single();

    if (formError || !form) {
      return NextResponse.json(
        { error: 'Formulario no encontrado' },
        { status: 404, headers: corsHeaders }
      );
    }

    const config = normalizeFormConfig(form.fields_config);
    const { redirect_url: cfgRedirect, message: cfgMessage } = config;

    // 2. Verificación anti-bot (reCAPTCHA o Turnstile) si está configurada
    const captcha = config.captcha;
    if (captcha && captcha.provider !== 'none') {
      if (!captcha.site_key) {
        return NextResponse.json(
          {
            success: false,
            code: 'captcha_not_configured',
            error: 'La protección anti-bot no tiene una site key configurada.',
          },
          { status: 503, headers: corsHeaders }
        );
      }

      const rawToken = body[CAPTCHA_RESPONSE_FIELDS[captcha.provider]];
      const token = typeof rawToken === 'string' ? rawToken.trim() : '';
      const remoteIp =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        undefined;

      const verification = await verifyCaptcha(captcha.provider, token, remoteIp);

      if (!verification.ok) {
        return NextResponse.json(
          {
            success: false,
            code: verification.code,
            error: verification.error,
          },
          {
            status: verification.code === 'captcha_not_configured' ? 503 : 422,
            headers: corsHeaders,
          }
        );
      }
    }

    // 3. Normalizar valores enviados
    const submitted: Record<string, string> = {};
    for (const [key, raw] of Object.entries(body)) {
      if (raw === undefined || raw === null) continue;
      if (Array.isArray(raw)) {
        submitted[key] = raw.map((v) => String(v)).join(', ');
        continue;
      }
      const value = typeof raw === 'string' ? raw.trim() : String(raw);
      if (value !== '') submitted[key] = value;
    }

    // 3. Validar campos requeridos según la configuración
    for (const field of config.fields) {
      if (field.required && !isFilled(submitted[field.key])) {
        return NextResponse.json(
          { error: `El campo "${field.label || field.key}" es obligatorio.` },
          { status: 422, headers: corsHeaders }
        );
      }
    }

    const email = submitted.email ? submitted.email.toLowerCase() : null;
    if (!email) {
      return NextResponse.json(
        { error: 'El email es obligatorio para registrar el contacto.' },
        { status: 422, headers: corsHeaders }
      );
    }

    const firstName =
      submitted.first_name ||
      email.split('@')[0] ||
      'Contacto sin nombre';

    const basics = {
      client_id: form.client_id,
      first_name: firstName,
      last_name: submitted.last_name || null,
      email,
      phone: submitted.phone || null,
    };

    // 4. Datos extra (cualquier campo que no sea básico ni de control)
    const extras: Record<string, string> = {};
    for (const [key, value] of Object.entries(submitted)) {
      if (RESERVED_FIELDS.has(key)) continue;
      extras[key] = value;
    }

    // 4b. Atribución del origen del lead (página, UTM, referrer, fingerprint).
    const visitorId = submitted.visitor_id || undefined;
    const fingerprint = submitted._slt_fingerprint || undefined;

    const rawAttribution: LeadAttribution = {
      form_id: form.id,
      form_name: form.name,
      page_url: submitted._slt_page_url || undefined,
      page_title: submitted._slt_page_title || undefined,
      referrer: submitted._slt_referrer || undefined,
      landing_url: submitted._slt_landing_url || undefined,
      placement: submitted._slt_placement || undefined,
      utm_source: submitted._slt_utm_source || undefined,
      utm_medium: submitted._slt_utm_medium || undefined,
      utm_campaign: submitted._slt_utm_campaign || undefined,
      utm_term: submitted._slt_utm_term || undefined,
      utm_content: submitted._slt_utm_content || undefined,
      visitor_id: visitorId,
      fingerprint,
      captured_at: new Date().toISOString(),
    };

    const attribution = Object.fromEntries(
      Object.entries(rawAttribution).filter(([, value]) => value !== undefined)
    ) as LeadAttribution;

    // 5. Buscar o crear contacto (clave: client_id + email)
    // Si la migración `contacts.data` aún no se aplicó, seguimos guardando el
    // contacto sin datos extra en lugar de romper el formulario.
    let hasDataColumn = true;
    let existingContact: { id: string; data?: unknown } | null = null;

    const lookup = await supabaseAdmin
      .from('contacts')
      .select('id, data')
      .eq('client_id', form.client_id)
      .eq('email', email)
      .maybeSingle();

    if (lookup.error) {
      if (!isMissingColumnError(lookup.error.message, 'data')) {
        return NextResponse.json(
          { error: lookup.error.message },
          { status: 500, headers: corsHeaders }
        );
      }

      hasDataColumn = false;
      console.warn(
        '[forms submit] La columna contacts.data no existe. Ejecuta supabase/migrations/20261104_add_contacts_data.sql'
      );
      const fallbackLookup = await supabaseAdmin
        .from('contacts')
        .select('id')
        .eq('client_id', form.client_id)
        .eq('email', email)
        .maybeSingle();

      if (fallbackLookup.error) {
        return NextResponse.json(
          { error: fallbackLookup.error.message },
          { status: 500, headers: corsHeaders }
        );
      }
      existingContact = fallbackLookup.data;
    } else {
      existingContact = lookup.data;
    }

    let contactId: string;

    const previousData =
      (existingContact?.data as Record<string, unknown> | null) ?? {};

    const mergeList = (current: unknown, value?: string): string[] => {
      const list = Array.isArray(current)
        ? current.filter((item): item is string => typeof item === 'string')
        : [];
      if (value && !list.includes(value)) list.push(value);
      return list;
    };

    const attributionData: Record<string, unknown> = {
      _attribution: attribution,
      _first_touch: previousData._first_touch ?? attribution,
    };

    const visitorIds = mergeList(previousData._visitor_ids, visitorId);
    if (visitorIds.length > 0) attributionData._visitor_ids = visitorIds;

    const fingerprints = mergeList(previousData._fingerprints, fingerprint);
    if (fingerprints.length > 0) attributionData._fingerprints = fingerprints;

    if (visitorId) attributionData._visitor_id = visitorId;
    if (fingerprint) attributionData._fingerprint = fingerprint;

    if (existingContact?.id) {
      const baseUpdate = {
        first_name: basics.first_name,
        last_name: basics.last_name,
        phone: basics.phone,
      };

      if (hasDataColumn) {
        const mergedData = {
          ...previousData,
          ...extras,
          ...attributionData,
        };
        const { error: updateError } = await supabaseAdmin
          .from('contacts')
          .update({ ...baseUpdate, data: mergedData })
          .eq('id', existingContact.id);

        if (updateError && isMissingColumnError(updateError.message, 'data')) {
          hasDataColumn = false;
          const retry = await supabaseAdmin
            .from('contacts')
            .update(baseUpdate)
            .eq('id', existingContact.id);
          if (retry.error) {
            return NextResponse.json(
              { error: retry.error.message },
              { status: 500, headers: corsHeaders }
            );
          }
        } else if (updateError) {
          return NextResponse.json(
            { error: updateError.message },
            { status: 500, headers: corsHeaders }
          );
        }
      } else {
        const { error: updateError } = await supabaseAdmin
          .from('contacts')
          .update(baseUpdate)
          .eq('id', existingContact.id);
        if (updateError) {
          return NextResponse.json(
            { error: updateError.message },
            { status: 500, headers: corsHeaders }
          );
        }
      }

      contactId = existingContact.id;
    } else {
      const insertPayload = hasDataColumn
        ? { ...basics, data: { ...extras, ...attributionData } }
        : basics;
      const { data: newContact, error: createError } = await supabaseAdmin
        .from('contacts')
        .insert(insertPayload)
        .select('id')
        .single();

      if (createError && hasDataColumn && isMissingColumnError(createError.message, 'data')) {
        hasDataColumn = false;
        const retry = await supabaseAdmin
          .from('contacts')
          .insert(basics)
          .select('id')
          .single();
        if (retry.error || !retry.data) {
          return NextResponse.json(
            { error: retry.error?.message || 'No se pudo crear el contacto.' },
            { status: 500, headers: corsHeaders }
          );
        }
        contactId = retry.data.id;
      } else if (createError || !newContact) {
        return NextResponse.json(
          { error: createError?.message || 'No se pudo crear el contacto.' },
          { status: 500, headers: corsHeaders }
        );
      } else {
        contactId = newContact.id;
      }
    }

    // 6. Crear deal en la etapa asignada
    const dealTitle =
      submitted.title ||
      `Nuevo Lead: ${basics.first_name}${basics.last_name ? ` ${basics.last_name}` : ''}`;
    const numericValue = Number.parseFloat(submitted.value || '');
    const dealValue = Number.isFinite(numericValue) ? numericValue : 0;

    const { data: deal, error: dealError } = await supabaseAdmin
      .from('deals')
      .insert({
        client_id: form.client_id,
        title: dealTitle,
        value: dealValue,
        stage_id: form.stage_id,
        contact_id: contactId,
        status: 'open',
      })
      .select('id')
      .single();

    if (dealError) {
      return NextResponse.json(
        { error: dealError.message },
        { status: 500, headers: corsHeaders }
      );
    }

    // 7. Vincular el journey previo y registrar la conversión (nunca bloquea el submit)
    try {
      // 7a. Todo el historial de este visitante/dispositivo pasa a ser del contacto.
      if (visitorId) {
        const { error: visitorLinkError } = await supabaseAdmin
          .from('tracking_events')
          .update({ contact_id: contactId })
          .eq('visitor_id', visitorId)
          .is('contact_id', null);

        if (visitorLinkError && !isMissingTrackingColumn(visitorLinkError.message)) {
          console.warn('[forms submit] visitor link error:', visitorLinkError.message);
        }
      }

      if (fingerprint) {
        const { error: fingerprintLinkError } = await supabaseAdmin
          .from('tracking_events')
          .update({ contact_id: contactId })
          .eq('fingerprint', fingerprint)
          .is('contact_id', null);

        if (
          fingerprintLinkError &&
          !isMissingTrackingColumn(fingerprintLinkError.message)
        ) {
          console.warn(
            '[forms submit] fingerprint link error:',
            fingerprintLinkError.message
          );
        }
      }

      // 7b. Evento de conversión con toda la atribución.
      if (visitorId) {
        let trackingSiteId = submitted.site_id || null;
        if (!trackingSiteId) {
          const { data: site } = await supabaseAdmin
            .from('tracking_sites')
            .select('id')
            .eq('client_id', form.client_id)
            .limit(1)
            .maybeSingle();
          trackingSiteId = site?.id || null;
        }

        if (trackingSiteId) {
          const baseEvent = {
            tracking_site_id: trackingSiteId,
            visitor_id: visitorId,
            contact_id: contactId,
            event_type: 'conversion',
            url: attribution.page_url || req.headers.get('referer') || '',
          };

          const fullEvent = {
            ...baseEvent,
            referrer: attribution.referrer || null,
            landing_url: attribution.landing_url || null,
            utm_source: attribution.utm_source || null,
            utm_medium: attribution.utm_medium || null,
            utm_campaign: attribution.utm_campaign || null,
            utm_term: attribution.utm_term || null,
            utm_content: attribution.utm_content || null,
            fingerprint: fingerprint || null,
            metadata: {
              form_id: form.id,
              form_name: form.name,
              placement: attribution.placement || null,
            },
          };

          let { error: conversionError } = await supabaseAdmin
            .from('tracking_events')
            .insert(fullEvent);

          if (conversionError && isMissingTrackingColumn(conversionError.message)) {
            const retry = await supabaseAdmin
              .from('tracking_events')
              .insert(baseEvent);
            conversionError = retry.error;
          }

          if (conversionError) {
            console.warn(
              '[forms submit] conversion insert error:',
              conversionError.message
            );
          }
        }
      }
    } catch (trackErr) {
      console.warn('[forms submit] tracking conversion error:', trackErr);
    }

    // 8. Respuesta según el comportamiento configurado
    if (cfgRedirect) {
      return NextResponse.json(
        { success: true, redirect_url: cfgRedirect },
        { status: 200, headers: corsHeaders }
      );
    }

    if (cfgMessage) {
      return NextResponse.json(
        { success: true, message: cfgMessage },
        { status: 200, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: '¡Gracias! Hemos recibido tus datos.',
        deal_id: deal?.id,
        contact_id: contactId,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[api/forms/[id]/submit] error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar el formulario' },
      { status: 500, headers: corsHeaders }
    );
  }
}
