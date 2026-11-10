import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { canAccessClient } from '@/lib/growth/access';
import type { Campaign } from '@/types/database';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const {
    client_id,
    analysis_id,
    name,
    objective,
    budget,
    start_date,
    end_date,
    cycle,
  } = await request.json();

  // Validaciones
  if (!client_id) {
    return NextResponse.json({ error: 'client_id es requerido.' }, { status: 400 });
  }

  if (!canAccessClient(user, client_id)) {
    return NextResponse.json({ error: 'Sin acceso al cliente.' }, { status: 403 });
  }

  if (!name?.trim()) {
    return NextResponse.json({ error: 'El nombre de la campaña es requerido.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  try {
    // Si hay un análisis, usar sus insights como base
    let analysis: any = null;
    if (analysis_id) {
      const { data: analysisData } = await supabase
        .from('business_analyses')
        .select('*')
        .eq('id', analysis_id)
        .eq('client_id', client_id)
        .single();
      
      if (analysisData) {
        analysis = analysisData;
      }
    }

    // Calcular presupuesto por día basado en ciclo
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    const campaignData: Omit<Campaign, 'id' | 'created_at'> = {
      client_id,
      name: name.trim(),
      objective: objective || 'REACH',
      provider: 'meta',
      external_campaign_id: null,
      budget: parseFloat(budget) || 1000,
      spend: 0,
      impressions: 0,
      clicks: 0,
      leads: 0,
      conversions: 0,
      revenue: 0,
      visits: 0,
      status: 'active',
      starts_at: startDate.toISOString(),
      ends_at: endDate.toISOString(),
      last_synced_at: new Date().toISOString(),
    };

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert(campaignData)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    // Si hay un análisis, guardamos referencia en metadata
    if (analysis) {
      await supabase
        .from('campaigns')
        .update({
          metadata: {
            source_analysis_id: analysis.id,
            key_insights: analysis.key_messages?.slice(0, 3),
          },
        })
        .eq('id', campaign.id);
    }

    return NextResponse.json({
      success: true,
      message: `Campaña "${campaign.name}" creada exitosamente.`,
      campaign,
    }, { status: 201 });

  } catch (error: any) {
    console.error('[campaigns/generate] error:', error);
    return NextResponse.json({ 
      error: error?.message || 'Error creando campaña.' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const clientId = request.nextUrl.searchParams.get('client_id');
  if (!clientId) {
    return NextResponse.json({ error: 'client_id es requerido.' }, { status: 400 });
  }

  if (!canAccessClient(user, clientId)) {
    return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  return NextResponse.json({ campaigns });
}