import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: formId } = await params;
    const body = await req.json();

    const { first_name, last_name, email, phone, title, value, hp, website, visitor_id, site_id } = body;

    // Honey pot: si el campo oculto viene con valor, se asume bot y se descarta silenciosamente
    if ((typeof hp === 'string' && hp.trim() !== '') || (typeof website === 'string' && website.trim() !== '')) {
      return NextResponse.json({ success: true }, { status: 201, headers: corsHeaders });
    }

    const supabaseAdmin = getSupabaseAdmin();

    if (!email || !first_name) {
      return NextResponse.json(
        { error: 'first_name y email son requeridos' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Obtener la configuración del formulario
    const { data: form, error: formError } = await supabaseAdmin
      .from('forms')
      .select('id, client_id, pipeline_id, stage_id, name')
      .eq('id', formId)
      .single();

    if (formError || !form) {
      return NextResponse.json(
        { error: 'Formulario no encontrado' },
        { status: 404, headers: corsHeaders }
      );
    }

    // 2. Buscar o crear el contacto aislado por cliente
    let { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('client_id', form.client_id)
      .eq('email', email)
      .maybeSingle();

    if (!contact) {
      const { data: newContact, error: createContactError } = await supabaseAdmin
        .from('contacts')
        .insert({
          client_id: form.client_id,
          first_name,
          last_name: last_name || null,
          email,
          phone: phone || null,
        })
        .select()
        .single();

      if (createContactError) {
        return NextResponse.json(
          { error: createContactError.message },
          { status: 500, headers: corsHeaders }
        );
      }
      contact = newContact;
    }

    // 3. Crear el deal asignado a la etapa y cliente configurados
    const dealTitle = title || `Nuevo Lead: ${first_name} ${last_name || ''}`.trim();
    const dealValue = typeof value === 'number' ? value : 0;

    const { data: deal, error: dealError } = await supabaseAdmin
      .from('deals')
      .insert({
        client_id: form.client_id,
        title: dealTitle,
        value: dealValue,
        stage_id: form.stage_id,
        contact_id: contact?.id,
        status: 'open',
      })
      .select()
      .single();

    if (dealError) {
      return NextResponse.json(
        { error: dealError.message },
        { status: 500, headers: corsHeaders }
      );
    }

    // Registrar conversión de tracking para usuarios reales que envían el formulario
    if (visitor_id) {
      try {
        let trackingSiteId = site_id || null;
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
            visitor_id,
            contact_id: contact?.id || null,
            event_type: 'conversion',
            url: req.headers.get('referer') || '',
          });
        }
      } catch (trackErr) {
        console.warn('[forms submit] tracking conversion error:', trackErr);
      }
    }

    return NextResponse.json(
      { success: true, deal_id: deal.id, contact_id: contact?.id },
      { status: 201, headers: corsHeaders }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al procesar el formulario' },
      { status: 500, headers: corsHeaders }
    );
  }
}
