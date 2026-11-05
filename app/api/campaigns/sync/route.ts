import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/app/actions/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { canAccessClient } from '@/lib/growth/access';
import { isAuthorizedCron } from '@/lib/growth/cron';
import { syncMetaCampaigns } from '@/lib/growth/meta-sync';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const requestedClientId = request.nextUrl.searchParams.get('client_id');

  let clientIds: string[] = [];

  if (isAuthorizedCron(request)) {
    if (requestedClientId) {
      clientIds = [requestedClientId];
    } else {
      const { data } = await supabase
        .from('social_accounts')
        .select('client_id')
        .eq('provider', 'facebook')
        .eq('status', 'active');

      clientIds = Array.from(
        new Set((data || []).map((row) => row.client_id as string))
      );
    }
  } else {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }

    let clientId = requestedClientId;
    if (!clientId) {
      const cookieStore = await cookies();
      clientId =
        cookieStore.get('slt_active_client_id')?.value || '';
    }

    if (!clientId) {
      return NextResponse.json(
        { error: 'Falta el cliente.' },
        { status: 400 }
      );
    }

    if (!canAccessClient(user, clientId)) {
      return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 });
    }

    clientIds = [clientId];
  }

  if (clientIds.length === 0) {
    return NextResponse.json({
      ok: true,
      results: [],
      message: 'No hay cuentas de Facebook activas para sincronizar.',
    });
  }

  const results = [];
  for (const clientId of clientIds) {
    results.push(await syncMetaCampaigns(clientId));
  }

  return NextResponse.json({
    ok: results.every((result) => !result.error),
    results,
  });
}

export const POST = GET;
