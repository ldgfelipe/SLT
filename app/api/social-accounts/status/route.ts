import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  // Si no hay client_id, devolver todas las cuentas del usuario
  let clientId = request.nextUrl.searchParams.get('client_id');
  const supabase = getSupabaseAdmin();

  // Si no hay client_id, usar el cliente actual
  if (!clientId) {
    // Buscar el cliente actual del usuario
    const { data: clientData } = await supabase
      .from('client_user')
      .select('client_id')
      .eq('user_id', user.id)
      .single();
    
    clientId = clientData?.client_id;
  }

  if (!clientId) {
    return NextResponse.json({ accounts: [] });
  }

  const { data: accounts } = await supabase
    .from('social_accounts')
    .select('id, provider, account_name, status, created_at, token_expires_at')
    .eq('client_id', clientId);

  return NextResponse.json({ accounts: (accounts || []).map(a => ({
    id: a.id,
    provider: a.provider,
    account_name: a.account_name,
    status: a.status,
    created_at: a.created_at,
    token_expires_at: a.token_expires_at,
  })) });
}