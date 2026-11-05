import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/growth/cron';
import { refreshExpiringTokens } from '@/lib/growth/refresh';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const summary = await refreshExpiringTokens();
    return NextResponse.json({ ok: true, summary });
  } catch (error: any) {
    console.error('[api/auth/refresh-tokens]', error);
    return NextResponse.json(
      { error: error?.message || 'Error al renovar tokens.' },
      { status: 500 }
    );
  }
}

export const POST = GET;
