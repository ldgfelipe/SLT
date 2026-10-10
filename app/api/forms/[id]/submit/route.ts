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

    const { first_name, last_name, email, phone, title, value } = body;

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
      .select('id, pipeline_id, stage_id, name')
      .eq('id', formId)
      .single();

    if (formError || !form) {
      return NextResponse.json(
        { error: 'Formulario no encontrado' },
        { status: 404, headers: corsHeaders }
      );
    }

    // 2. Buscar o crear el contacto
    let { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (!contact) {
      const { data: newContact, error: createContactError } = await supabaseAdmin
        .from('contacts')
        .insert({
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

    // 3. Crear el deal asignado a la etapa configurada
    const dealTitle = title || `Nuevo Lead: ${first_name} ${last_name || ''}`.trim();
    const dealValue = typeof value === 'number' ? value : 0;

    const { data: deal, error: dealError } = await supabaseAdmin
      .from('deals')
      .insert({
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
