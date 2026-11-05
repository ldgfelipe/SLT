import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { canAccessClient } from '@/lib/growth/access';
import { runPostPublish } from '@/lib/growth/run-publish';

export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = getSupabaseAdmin();

  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !post) {
    return NextResponse.json(
      { error: 'Publicación no encontrada.' },
      { status: 404 }
    );
  }

  if (!canAccessClient(user, post.client_id)) {
    return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 });
  }

  if (post.status === 'publishing') {
    return NextResponse.json(
      { error: 'La publicación ya se está procesando.' },
      { status: 409 }
    );
  }

  await supabase
    .from('posts')
    .update({
      status: 'publishing',
      error_log: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  try {
    const result = await runPostPublish({
      ...post,
      status: 'publishing',
    } as any);

    return NextResponse.json({ ok: result.status === 'published', result });
  } catch (publishError: any) {
    console.error('[api/posts/publish]', publishError);

    await supabase
      .from('posts')
      .update({
        status: 'failed',
        error_log: publishError?.message || 'Error al publicar.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json(
      { error: publishError?.message || 'Error al publicar.' },
      { status: 500 }
    );
  }
}
