import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { Post, SocialAccount } from '@/types/database';

export interface PublishOutcome {
  provider: string;
  ok: boolean;
  response: any;
  error?: string;
  warning?: string;
  external_id?: string;
}

/**
 * Publica un post en una cuenta social.
 * Soporta publicación inmediata y programación via scheduled_at.
 * Para Meta/Facebook usa scheduled_publish_time en el payload de Graph API.
 */
export async function publishToAccount(post: Post, account: SocialAccount): Promise<PublishOutcome> {
  // Usamos casts necesarios para acceder a propiedades internas
  const postAny = post as any;
  const accountAny = account as any;

  // Detectar si es programación (tiene scheduled_at)
  const isScheduled = Boolean(postAny.scheduled_at);
  const publishTime = isScheduled && postAny.scheduled_at ? new Date(String(postAny.scheduled_at)).toISOString() : undefined;

  // Construir payload para Meta Graph API
  const payload: Record<string, any> = {
    message: postAny.descripcion || postAny.titulo || '',
    access_token: accountAny.access_token_encrypted || accountAny.access_token,
  };

  // Agregar scheduled_publish_time solo si hay programación
  if (isScheduled && publishTime) {
    payload.scheduled_publish_time = publishTime;
    // Meta Graph API usa este parámetro para programar la publicación
    // El formato debe ser RFC 3339 / ISO 8601
  }

  // Determinar el ID del post social a publicar
  // Preferir id_social (externo de Meta), luego el ID interno de Supabase
  const postIdForPublish = postAny.id_social || postAny.id || accountAny.id;

  // URL del endpoint de Graph API dependiendo de la plataforma
  const isMetaPlatform = account.provider === 'facebook' || account.provider === 'instagram';
  const graphVersion = postAny.graph_version || 'v20.0';
  const url = `https://graph.${isMetaPlatform ? 'facebook' : account.provider}.com/${graphVersion}/${postIdForPublish}/feed`;

  let response: any;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(payload as Record<string, string>),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data?.error?.message || `Error ${response.status}`;
      return {
        provider: account.provider,
        ok: false,
        response: data,
        error: errorMessage,
      };
    }

    return {
      provider: account.provider,
      ok: true,
      response: data,
      external_id: data?.id || data?.post_id || undefined,
      warning: isScheduled && publishTime
        ? `Publicación programada para ${new Date(publishTime).toLocaleString()}`
        : undefined,
    };
  } catch (error: any) {
    return {
      provider: account.provider,
      ok: false,
      response: {},
      error: error?.message || 'Error de red al publicar.',
    };
  }
}