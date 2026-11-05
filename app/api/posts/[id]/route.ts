import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { canAccessClient } from '@/lib/growth/access';
import {
  normalizePlatforms,
  POST_STATUSES,
} from '@/lib/growth/platforms';
import type { PostStatus } from '@/types/database';

const POST_SELECT =
  '*, social_account:social_accounts(id,account_name,provider), campaign:campaigns(id,name)';

async function loadPost(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('posts')
    .select('id, client_id, status, scheduled_at, attempts')
    .eq('id', id)
    .maybeSingle();

  return { supabase, post: data, error };
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
  const { supabase, post, error } = await loadPost(id);

  if (error || !post) {
    return NextResponse.json(
      { error: 'Publicación no encontrada.' },
      { status: 404 }
    );
  }

  if (!canAccessClient(user, post.client_id)) {
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

  if (typeof body?.titulo === 'string' && body.titulo.trim()) {
    update.titulo = body.titulo.trim().slice(0, 200);
  }

  if (typeof body?.descripcion === 'string') {
    update.descripcion = body.descripcion.slice(0, 5000);
  }

  if (typeof body?.imagen_url === 'string') {
    update.imagen_url = body.imagen_url.trim() || null;
  }

  if (body?.plataformas !== undefined) {
    update.plataformas = normalizePlatforms(body.plataformas);
  }

  let nextScheduledAt: string | null = post.scheduled_at;

  if (body?.scheduled_at !== undefined) {
    if (body.scheduled_at === null || body.scheduled_at === '') {
      nextScheduledAt = null;
      update.scheduled_at = null;
    } else {
      const parsed = new Date(String(body.scheduled_at));
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: 'La fecha programada no es válida.' },
          { status: 400 }
        );
      }
      nextScheduledAt = parsed.toISOString();
      update.scheduled_at = nextScheduledAt;
    }
  }

  if (body?.social_account_id !== undefined) {
    if (body.social_account_id) {
      const { data: account } = await supabase
        .from('social_accounts')
        .select('id')
        .eq('id', body.social_account_id)
        .eq('client_id', post.client_id)
        .maybeSingle();

      if (!account) {
        return NextResponse.json(
          { error: 'La cuenta social no pertenece al cliente.' },
          { status: 400 }
        );
      }
    }
    update.social_account_id = body.social_account_id || null;
  }

  if (body?.campaign_id !== undefined) {
    update.campaign_id = body.campaign_id || null;
  }

  if (typeof body?.status === 'string') {
    if (!POST_STATUSES.includes(body.status as PostStatus)) {
      return NextResponse.json(
        { error: 'Estado de publicación inválido.' },
        { status: 400 }
      );
    }

    if (body.status === 'queued' && !nextScheduledAt) {
      return NextResponse.json(
        { error: 'Programa una fecha antes de encolar la publicación.' },
        { status: 400 }
      );
    }

    update.status = body.status;
  }

  const { data, error: updateError } = await supabase
    .from('posts')
    .update(update)
    .eq('id', id)
    .select(POST_SELECT)
    .single();

  if (updateError) {
    console.error('[api/posts/:id] update:', updateError);
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ post: data });
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
  const { supabase, post, error } = await loadPost(id);

  if (error || !post) {
    return NextResponse.json(
      { error: 'Publicación no encontrada.' },
      { status: 404 }
    );
  }

  if (!canAccessClient(user, post.client_id)) {
    return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from('posts')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
