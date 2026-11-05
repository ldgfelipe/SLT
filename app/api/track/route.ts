import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Max-Age': '86400',
};

const BOT_UA_REGEX = /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|headless|phantom|selenium|puppeteer|wget|curl|python-requests|scrapy/i;

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

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function sanitizeMetadata(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};

  const source = raw as Record<string, unknown>;
  const metadata: Record<string, string> = {};
  for (const key of ['session_id', 'page_title', 'screen', 'viewport']) {
    const value = source[key];
    if (typeof value === 'string' && value.trim() !== '') {
      metadata[key] = value.trim().slice(0, 200);
    }
  }
  return metadata;
}

function isMissingAttributionColumn(message: string | undefined): boolean {
  const text = (message || '').toLowerCase();
  if (!text) return false;
  const looksMissing =
    text.includes('does not exist') ||
    text.includes('could not find') ||
    text.includes('schema cache') ||
    text.includes('undefined column');
  return looksMissing && ATTRIBUTION_COLUMNS.some((column) => text.includes(column));
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    // Leemos como texto para aceptar text/plain (sin preflight CORS)
    const raw = await req.text();
    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: 'JSON inválido' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { site_id, visitor_id, url, event_type, contact_id, hp } = body || {};

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

    const safeEventType =
      event_type === 'conversion' || event_type === 'pageview' ? event_type : 'pageview';

    const baseInsert = {
      tracking_site_id: site_id,
      visitor_id,
      contact_id: contact_id || null,
      event_type: safeEventType,
      url: cleanString(url, 4096) || '',
    };

    const fullInsert = {
      ...baseInsert,
      referrer: cleanString(body.referrer, 2048),
      landing_url: cleanString(body.landing_url, 4096),
      utm_source: cleanString(body.utm_source, 200),
      utm_medium: cleanString(body.utm_medium, 200),
      utm_campaign: cleanString(body.utm_campaign, 200),
      utm_term: cleanString(body.utm_term, 200),
      utm_content: cleanString(body.utm_content, 200),
      fingerprint: cleanString(body.fingerprint, 64),
      metadata: sanitizeMetadata(body.metadata),
    };

    const supabaseAdmin = getSupabaseAdmin();

    let { error } = await supabaseAdmin.from('tracking_events').insert(fullInsert);

    // Si la migración de atribución aún no se aplicó, guardamos lo básico.
    if (error && isMissingAttributionColumn(error.message)) {
      console.warn(
        '[api/track] Columnas de atribución pendientes. Ejecuta supabase/migrations/20261104_tracking_attribution.sql'
      );
      const retry = await supabaseAdmin.from('tracking_events').insert(baseInsert);
      error = retry.error;
    }

    if (error) {
      console.error('[api/track] insert error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders });
  } catch (error: any) {
    console.error('[api/track] error:', error);
    return NextResponse.json(
      { error: error.message || 'Error registrando evento' },
      { status: 500, headers: corsHeaders }
    );
  }
}
