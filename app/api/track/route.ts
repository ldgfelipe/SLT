import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const BOT_UA_REGEX = /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|headless|phantom|selenium|puppeteer|wget|curl|python-requests|scrapy/i;

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { site_id, visitor_id, url, event_type, contact_id, hp } = body;

    if (!site_id || !visitor_id || !url || !event_type) {
      return NextResponse.json(
        { error: 'Parámetros incompletos: site_id, visitor_id, url y event_type son requeridos' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Honey pot: si el campo viene con valor, se asume bot y se descarta silenciosamente
    if (typeof hp === 'string' && hp.trim() !== '') {
      return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders });
    }

    // Filtrar bots por User-Agent
    const userAgent = req.headers.get('user-agent') || '';
    if (BOT_UA_REGEX.test(userAgent)) {
      return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { error } = await supabaseAdmin.from('tracking_events').insert({
      tracking_site_id: site_id,
      visitor_id,
      contact_id: contact_id || null,
      event_type,
      url,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error registrando evento' },
      { status: 500, headers: corsHeaders }
    );
  }
}