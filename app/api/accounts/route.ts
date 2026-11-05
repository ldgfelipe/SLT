import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/app/actions/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { canAccessClient } from '@/lib/growth/access';
import type { PendingSocialAccount } from '@/types/database';

/** Nunca exponer tokens al frontend. */
const ACCOUNT_PUBLIC_FIELDS =
  'id, client_id, provider, account_name, page_id, ig_user_id, token_expires_at, status, metadata, created_at, updated_at';

interface EncryptedPendingAccount extends PendingSocialAccount {
  access_token_encrypted: string;
  refresh_token_encrypted?: string | null;
}

async function resolveClientId(request: NextRequest): Promise<string> {
  const fromQuery = request.nextUrl.searchParams.get('client_id');
  if (fromQuery) return fromQuery;

  const cookieStore = await cookies();
  return cookieStore.get('slt_active_client_id')?.value || '';
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const clientId = await resolveClientId(request);
  if (!clientId) {
    return NextResponse.json(
      { error: 'Falta el cliente.' },
      { status: 400 }
    );
  }

  if (!canAccessClient(user, clientId)) {
    return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('social_accounts')
    .select(ACCOUNT_PUBLIC_FIELDS)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ accounts: data || [] });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const sessionId = String(body?.session_id || '');
  const accountIndex = Number.isInteger(body?.account_index)
    ? Number(body.account_index)
    : 0;

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Falta session_id.' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: session, error: sessionError } = await supabase
    .from('social_oauth_sessions')
    .select('id, client_id, provider, accounts, expires_at')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return NextResponse.json(
      { error: 'La sesión OAuth no existe o expiró.' },
      { status: 404 }
    );
  }

  if (!canAccessClient(user, session.client_id)) {
    return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 });
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      { error: 'La sesión OAuth expiró. Vuelve a autorizar la cuenta.' },
      { status: 410 }
    );
  }

  const accounts = Array.isArray(session.accounts)
    ? (session.accounts as EncryptedPendingAccount[])
    : [];
  const selected = accounts[accountIndex];

  if (!selected?.access_token_encrypted) {
    return NextResponse.json(
      { error: 'La cuenta seleccionada no es válida.' },
      { status: 400 }
    );
  }

  const accountName =
    typeof body?.account_name === 'string' && body.account_name.trim()
      ? body.account_name.trim().slice(0, 120)
      : selected.account_name;

  const { data, error } = await supabase
    .from('social_accounts')
    .upsert(
      {
        client_id: session.client_id,
        provider: session.provider,
        account_name: accountName,
        page_id: selected.page_id || null,
        ig_user_id: selected.ig_user_id || null,
        access_token_encrypted: selected.access_token_encrypted,
        refresh_token: selected.refresh_token_encrypted || null,
        token_expires_at: selected.token_expires_at || null,
        status: 'active',
        metadata: selected.metadata || {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id,provider,account_name' }
    )
    .select(ACCOUNT_PUBLIC_FIELDS)
    .single();

  if (error) {
    console.error('[api/accounts] upsert:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ account: data });
}
