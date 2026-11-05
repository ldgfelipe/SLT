import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isAuthorizedCron } from '@/lib/growth/cron';
import { runPostPublish } from '@/lib/growth/run-publish';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: duePosts, error } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'queued')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(25);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const post of duePosts || []) {
    // Claim atómico para evitar que dos ejecuciones publiquen lo mismo.
    const { data: claimed } = await supabase
      .from('posts')
      .update({ status: 'publishing', updated_at: new Date().toISOString() })
      .eq('id', post.id)
      .eq('status', 'queued')
      .select('id')
      .maybeSingle();

    if (!claimed) {
      results.push({ postId: post.id, skipped: true });
      continue;
    }

    try {
      const result = await runPostPublish({ ...post, status: 'publishing' } as any);
      results.push({
        postId: post.id,
        status: result.status,
        providers: result.providers.map((provider) => ({
          provider: provider.provider,
          ok: provider.ok,
          error: provider.error || null,
        })),
      });
    } catch (publishError: any) {
      console.error('[api/publish/cron]', post.id, publishError);

      await supabase
        .from('posts')
        .update({
          status: 'failed',
          error_log: publishError?.message || 'Error al publicar.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id);

      results.push({
        postId: post.id,
        status: 'failed',
        error: publishError?.message || 'Error al publicar.',
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
  });
}

export const POST = GET;
