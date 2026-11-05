import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { canAccessClient } from '@/lib/growth/access';

const ACCOUNT_PUBLIC_FIELDS =
  'id, client_id, provider, account_name, page_id, ig_user_id, token_expires_at, status, metadata, created_at, updated_at';

const ALLOWED_STATUS = new Set(['active', 'expired', 'disabled']);

async function loadAccount(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('social_accounts')
    .select(ACCOUNT_PUBLIC_FIELDS)
    .eq('id', id)
    .maybeSingle();

  return { supabase, account: data, error };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const { id } = await context.params;
  const { supabase, account, error } = await loadAccount(id);

  if (error || !account) {
    return NextResponse.json(
      { error: 'Cuenta no encontrada.' },
      { status: 404 }
    );
  }

  if (!canAccessClient(user, account.client_id)) {
    return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body?.account_name === 'string' && body.account_name.trim()) {
    update.account_name = body.account_name.trim().slice(0, 120);
  }

  if (typeof body?.status === 'string' && ALLOWED_STATUS.has(body.status)) {
    update.status = body.status;
  }

  if (body?.metadata && typeof body.metadata === 'object') {
    update.metadata = body.metadata;
  }

  const { data, error: updateError } = await supabase
    .from('social_accounts')
    .update(update)
    .eq('id', id)
    .select(ACCOUNT_PUBLIC_FIELDS)
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ account: data });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const { id } = await context.params;
  const { supabase, account, error } = await loadAccount(id);

  if (error || !account) {
    return NextResponse.json(
      { error: 'Cuenta no encontrada.' },
      { status: 404 }
    );
  }

  if (!canAccessClient(user, account.client_id)) {
    return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from('social_accounts')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
