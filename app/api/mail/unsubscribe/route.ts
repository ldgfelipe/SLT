import { NextRequest, NextResponse } from 'next/server';
import { trackUnsubscribe } from '@/lib/mail/track-handlers';

const PAGE = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Baja confirmada — Inventser</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0a1931; color: #f8fafc; display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; }
      .card { background: #0c1f3d; border: 1px solid rgba(0,212,255,.25); border-radius: 16px; padding: 32px; max-width: 420px; text-align: center; }
      h1 { color: #00d4ff; font-size: 20px; margin: 0 0 12px; }
      p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
    </style>
  </head>
  <body><div class="card"><h1>Baja confirmada</h1><p>Tu correo ha sido dado de baja de nuestros envíos. No recibirás más mensajes de nuestra parte.</p></div></body>
</html>`;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const campaignId = params.get('c');
  const email = params.get('e');
  const signature = params.get('s');

  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  };

  if (!campaignId || !email || !signature) {
    return new NextResponse(PAGE, { status: 200, headers });
  }

  const result = await trackUnsubscribe(campaignId, email, signature);

  if (!result.ok) {
    return new NextResponse(PAGE, { status: 200, headers });
  }

  return new NextResponse(PAGE, { status: 200, headers });
}

/** One-Click List-Unsubscribe (RFC 8058): POST sin parámetros. */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const campaignId = params.get('c');
  const email = params.get('e');
  const signature = params.get('s');

  if (campaignId && email && signature) {
    await trackUnsubscribe(campaignId, email, signature);
  }

  return new NextResponse(null, { status: 200 });
}
