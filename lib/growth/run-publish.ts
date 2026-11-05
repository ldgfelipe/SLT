import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  publishToAccount,
  type PublishOutcome,
} from './publish';
import type { Post, SocialAccount } from '@/types/database';

export interface SocialAccountWithSecret extends SocialAccount {
  access_token_encrypted: string;
  refresh_token?: string | null;
}

export interface PublishRunResult {
  postId: string;
  status: 'published' | 'failed';
  providers: PublishOutcome[];
  externalPostIds: Record<string, string>;
}

async function resolveTargets(post: Post): Promise<SocialAccountWithSecret[]> {
  const supabase = getSupabaseAdmin();
  const targets: SocialAccountWithSecret[] = [];

  if (post.social_account_id) {
    const { data } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('id', post.social_account_id)
      .eq('status', 'active')
      .maybeSingle();

    if (data) targets.push(data as SocialAccountWithSecret);
  }

  if (targets.length > 0) return targets;

  const platforms = Array.isArray(post.plataformas) ? post.plataformas : [];
  for (const provider of platforms) {
    const { data } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('client_id', post.client_id)
      .eq('provider', provider)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data && !targets.some((item) => item.id === data.id)) {
      targets.push(data as SocialAccountWithSecret);
    }
  }

  return targets;
}

/**
 * Publica un post en todas las cuentas disponibles y deja el resultado en
 * `posts` + `publish_logs`. No lanza si una red falla: consolida el resultado.
 */
export async function runPostPublish(post: Post): Promise<PublishRunResult> {
  const supabase = getSupabaseAdmin();
  const targets = await resolveTargets(post);

  if (targets.length === 0) {
    throw new Error(
      'No hay cuentas sociales activas para este post. Conecta una cuenta o revisa la plataforma seleccionada.'
    );
  }

  const attempt = Number(post.attempts || 0) + 1;
  const outcomes: PublishOutcome[] = [];

  for (const account of targets) {
    let outcome: PublishOutcome;

    try {
      outcome = await publishToAccount(post, account);
    } catch (error: any) {
      outcome = {
        provider: account.provider,
        ok: false,
        response: {},
        error: error?.message || 'Error desconocido al publicar.',
      };
    }

    outcomes.push(outcome);

    const { error: logError } = await supabase.from('publish_logs').insert({
      post_id: post.id,
      provider: account.provider,
      attempt,
      status: outcome.ok ? 'success' : 'error',
      response: outcome.ok
        ? outcome.response
        : { error: outcome.error, response: outcome.response },
    });

    if (logError) {
      console.warn('[growth/publish] publish_logs insert:', logError.message);
    }
  }

  const externalPostIds: Record<string, string> = {
    ...(post.external_post_ids || {}),
  };

  for (const outcome of outcomes) {
    if (outcome.ok && outcome.external_id) {
      externalPostIds[outcome.provider] = outcome.external_id;
    }
  }

  const anyOk = outcomes.some((outcome) => outcome.ok);
  const failures = outcomes.filter((outcome) => !outcome.ok);
  const warnings = outcomes
    .map((outcome) => outcome.warning)
    .filter((value): value is string => Boolean(value));

  const errorLog =
    failures.length > 0
      ? failures
          .map((failure) => `${failure.provider}: ${failure.error}`)
          .join(' | ')
      : warnings.join(' | ') || null;

  const status: 'published' | 'failed' = anyOk ? 'published' : 'failed';
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('posts')
    .update({
      status,
      external_post_ids: externalPostIds,
      error_log: errorLog,
      attempts: attempt,
      published_at: anyOk ? now : post.published_at,
      updated_at: now,
    })
    .eq('id', post.id);

  if (error) {
    throw new Error(`No se pudo guardar el resultado: ${error.message}`);
  }

  return {
    postId: post.id,
    status,
    providers: outcomes,
    externalPostIds,
  };
}
