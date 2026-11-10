import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const clientId = request.nextUrl.searchParams.get('client_id');
  if (!clientId) {
    return NextResponse.json({ accounts: [] });
  }

  const supabase = getSupabaseAdmin();
  const { data: accounts } = await supabase
    .from('social_accounts')
    .select('provider, status, access_token_encrypted')
    .eq('client_id', clientId)
    .in('status', ['active', 'disconnected']);

  return NextResponse.json({ accounts: accounts || [] });
}