import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { BASIC_CONTACT_FIELDS, normalizeFormConfig } from '@/types/forms';

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
]);

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

    // 2. Normalizar valores enviados
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
    if (existingContact?.id) {
      const baseUpdate = {
        first_name: basics.first_name,
        last_name: basics.last_name,
        phone: basics.phone,
      };

      if (hasDataColumn) {
        const mergedData = {
          ...((existingContact.data as Record<string, unknown> | null) ?? {}),
          ...extras,
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
      const insertPayload = hasDataColumn ? { ...basics, data: extras } : basics;
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

    // 7. Registrar conversión de tracking (nunca bloquea el submit)
    if (submitted.visitor_id) {
      try {
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
          await supabaseAdmin.from('tracking_events').insert({
            tracking_site_id: trackingSiteId,
            visitor_id: submitted.visitor_id,
            contact_id: contactId,
            event_type: 'conversion',
            url: req.headers.get('referer') || '',
          });
        }
      } catch (trackErr) {
        console.warn('[forms submit] tracking conversion error:', trackErr);
      }
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
