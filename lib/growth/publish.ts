import { decryptToken } from './crypto';
import { graphVersion, linkedinApiVersion } from './providers';
import { resolveMediaUrl } from './media';
import type { Post, SocialAccount } from '@/types/database';

export interface PublishOutcome {
  provider: string;
  ok: boolean;
  external_id?: string;
  response: Record<string, any>;
  error?: string;
  /** Aviso cuando la red no permite publicar el formato actual. */
  warning?: string;
}

async function readResponse(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function errorMessage(data: any, fallback: string): string {
  return (
    data?.error?.message ||
    data?.error?.error_user_msg ||
    data?.error_description ||
    data?.detail ||
    data?.title ||
    data?.message ||
    fallback
  );
}

async function graphPost(url: string, body: URLSearchParams): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });

  const data = await readResponse(response);
  if (!response.ok) {
    throw new Error(errorMessage(data, `Meta respondió ${response.status}`));
  }
  return data;
}

async function jsonRequest(
  url: string,
  init: RequestInit,
  fallback: string
): Promise<any> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  const data = await readResponse(response);
  if (!response.ok) {
    throw new Error(errorMessage(data, fallback));
  }
  return data;
}

function caption(post: Post): string {
  return [post.titulo, post.descripcion].filter(Boolean).join('\n\n').trim();
}

/* ------------------------------------------------------------------ */
/* Facebook                                                            */
/* ------------------------------------------------------------------ */
async function publishFacebook(
  post: Post,
  account: SocialAccount,
  token: string
): Promise<PublishOutcome> {
  if (!account.page_id) {
    throw new Error('La cuenta de Facebook no tiene page_id.');
  }

  const version = await graphVersion();
  const mediaUrl = resolveMediaUrl(post.imagen_url);

  if (mediaUrl) {
    const data = await graphPost(
      `https://graph.facebook.com/${version}/${account.page_id}/photos`,
      new URLSearchParams({
        message: caption(post),
        url: mediaUrl,
        access_token: token,
      })
    );

    return {
      provider: 'facebook',
      ok: true,
      external_id: String(data.id || data.post_id || ''),
      response: data,
    };
  }

  const data = await graphPost(
    `https://graph.facebook.com/${version}/${account.page_id}/feed`,
    new URLSearchParams({
      message: caption(post),
      access_token: token,
    })
  );

  return {
    provider: 'facebook',
    ok: true,
    external_id: String(data.id || ''),
    response: data,
  };
}

/* ------------------------------------------------------------------ */
/* Instagram                                                           */
/* ------------------------------------------------------------------ */
async function publishInstagram(
  post: Post,
  account: SocialAccount,
  token: string
): Promise<PublishOutcome> {
  if (!account.ig_user_id) {
    throw new Error('La cuenta de Instagram no tiene ig_user_id.');
  }

  const mediaUrl = resolveMediaUrl(post.imagen_url);
  if (!mediaUrl) {
    throw new Error('Instagram exige una imagen pública para publicar.');
  }

  const version = await graphVersion();
  const create = await graphPost(
    `https://graph.facebook.com/${version}/${account.ig_user_id}/media`,
    new URLSearchParams({
      image_url: mediaUrl,
      caption: caption(post),
      access_token: token,
    })
  );

  if (!create?.id) {
    throw new Error('Instagram no devolvió el creation_id.');
  }

  const published = await graphPost(
    `https://graph.facebook.com/${version}/${account.ig_user_id}/media_publish`,
    new URLSearchParams({
      creation_id: String(create.id),
      access_token: token,
    })
  );

  return {
    provider: 'instagram',
    ok: true,
    external_id: String(published.id || create.id),
    response: { create, published },
  };
}

/* ------------------------------------------------------------------ */
/* Threads                                                             */
/* ------------------------------------------------------------------ */
async function publishThreads(
  post: Post,
  account: SocialAccount,
  token: string
): Promise<PublishOutcome> {
  if (!account.page_id) {
    throw new Error('La cuenta de Threads no tiene user_id.');
  }

  const version = await graphVersion();
  const mediaUrl = resolveMediaUrl(post.imagen_url);
  const body = new URLSearchParams({
    text: caption(post).slice(0, 500),
    access_token: token,
  });

  if (mediaUrl) {
    body.set('media_type', 'IMAGE');
    body.set('image_url', mediaUrl);
  } else {
    body.set('media_type', 'TEXT');
  }

  const create = await graphPost(
    `https://graph.threads.net/${version}/${account.page_id}/threads`,
    body
  );

  if (!create?.id) {
    throw new Error('Threads no devolvió el creation_id.');
  }

  const published = await graphPost(
    `https://graph.threads.net/${version}/${account.page_id}/threads_publish`,
    new URLSearchParams({
      creation_id: String(create.id),
      access_token: token,
    })
  );

  return {
    provider: 'threads',
    ok: true,
    external_id: String(published.id || create.id),
    response: { create, published },
  };
}

/* ------------------------------------------------------------------ */
/* LinkedIn                                                            */
/* ------------------------------------------------------------------ */
async function publishLinkedIn(
  post: Post,
  account: SocialAccount,
  token: string
): Promise<PublishOutcome> {
  const sub = account.metadata?.sub ? String(account.metadata.sub) : '';
  const author = account.page_id
    ? `urn:li:organization:${account.page_id}`
    : sub
      ? `urn:li:person:${sub}`
      : '';

  if (!author) {
    throw new Error('No se pudo determinar el autor de LinkedIn.');
  }

  const data = await jsonRequest(
    'https://api.linkedin.com/v2/ugcPosts',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': await linkedinApiVersion(),
      },
      body: JSON.stringify({
        author,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: caption(post).slice(0, 3000) },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      }),
    },
    'LinkedIn rechazó la publicación'
  );

  return {
    provider: 'linkedin',
    ok: true,
    external_id: String(data.id || ''),
    response: data,
    warning: post.imagen_url
      ? 'LinkedIn publicó solo texto: la subida de imágenes requiere el flujo de assets.'
      : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* X                                                                   */
/* ------------------------------------------------------------------ */
async function publishX(
  post: Post,
  token: string
): Promise<PublishOutcome> {
  const text = caption(post).slice(0, 280);
  if (!text) throw new Error('El post está vacío.');

  const data = await jsonRequest(
    'https://api.twitter.com/2/tweets',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    },
    'X rechazó la publicación'
  );

  return {
    provider: 'x',
    ok: true,
    external_id: String(data?.data?.id || ''),
    response: data,
    warning: post.imagen_url
      ? 'X publicó solo texto: la subida de imágenes usa la API v1.1.'
      : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Entrada única                                                       */
/* ------------------------------------------------------------------ */
export async function publishToAccount(
  post: Post,
  account: SocialAccount
): Promise<PublishOutcome> {
  const token = decryptToken(
    (account as SocialAccount & { access_token_encrypted?: string })
      .access_token_encrypted
  );

  if (!token) {
    throw new Error(
      'No se pudo descifrar el token. Revisa TOKEN_ENCRYPTION_KEY o vuelve a conectar la cuenta.'
    );
  }

  switch (account.provider) {
    case 'facebook':
      return publishFacebook(post, account, token);
    case 'instagram':
      return publishInstagram(post, account, token);
    case 'threads':
      return publishThreads(post, account, token);
    case 'linkedin':
      return publishLinkedIn(post, account, token);
    case 'x':
      return publishX(post, token);
    case 'tiktok':
      throw new Error(
        'TikTok requiere subir el archivo de video por chunks. La publicación automática de video aún no está habilitada.'
      );
    case 'youtube':
      throw new Error(
        'YouTube requiere subida resumible del archivo de video. La publicación automática de video aún no está habilitada.'
      );
    default:
      throw new Error(`Proveedor no soportado: ${account.provider}`);
  }
}
