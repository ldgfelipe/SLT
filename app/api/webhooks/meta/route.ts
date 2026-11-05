import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getSetting } from '@/lib/app/settings';

async function verifySignature(
  raw: string,
  signature: string | null
): Promise<boolean> {
  const secret = await getSetting('META_APP_SECRET');
  if (!secret) return false;
  if (!signature || !signature.startsWith('sha256=')) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(raw, 'utf8')
    .digest('hex');

  const provided = signature.slice('sha256='.length);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function looksRevoked(value: unknown): boolean {
  try {
    const text = JSON.stringify(value).toLowerCase();
    return (
      text.includes('revok') ||
      text.includes('expired') ||
      text.includes('declined') ||
      text.includes('invalid')
    );
  } catch {
    return false;
  }
}

/** Verificación del webhook de Meta. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  const expected = await getSetting('META_WEBHOOK_VERIFY_TOKEN');

  if (mode === 'subscribe' && expected && token === expected) {
    return new NextResponse(challenge || '', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({ error: 'Verificación inválida.' }, { status: 403 });
}

/** Notificaciones de Meta (permisos revocados, tokens expirados, etc.). */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  // Si hay App Secret configurado, exigimos firma válida.
  if (
    (await getSetting('META_APP_SECRET')) &&
    !(await verifySignature(raw, signature))
  ) {
    return NextResponse.json({ error: 'Firma inválida.' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const entries: any[] = Array.isArray(payload?.entry) ? payload.entry : [];

  for (const entry of entries) {
    const identifier = entry?.id ? String(entry.id) : '';
    if (!identifier) continue;

    const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
    const revoked = changes.some(
      (change) =>
        String(change?.field || '').match(/permission|token|access/i) &&
        looksRevoked(change?.value)
    );

    if (!revoked) continue;

    const { error } = await supabase
      .from('social_accounts')
      .update({
        status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .or(`page_id.eq.${identifier},ig_user_id.eq.${identifier}`);

    if (error) {
      console.warn('[webhooks/meta] update:', error.message);
    }
  }

  return NextResponse.json({ received: true });
}
