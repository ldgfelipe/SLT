import type { SocialProvider } from '@/types/database';
import { findSetting, getSetting } from '@/lib/app/settings';

export interface ProviderMeta {
  id: SocialProvider;
  label: string;
  description: string;
  scopes: string[];
  color: string;
  /** Si la app puede publicar texto/imagen con la implementación actual. */
  canPublish: boolean;
  publishNote?: string;
}

export const PROVIDERS: Record<SocialProvider, ProviderMeta> = {
  facebook: {
    id: 'facebook',
    label: 'Facebook Page',
    description: 'Publica en la página de Facebook del cliente.',
    scopes: [
      'pages_manage_posts',
      'pages_read_engagement',
      'instagram_basic',
      'instagram_content_publish',
      'business_management',
    ],
    color: '#1877f2',
    canPublish: true,
  },
  instagram: {
    id: 'instagram',
    label: 'Instagram Business',
    description: 'Publica imágenes en una cuenta profesional de Instagram.',
    scopes: [
      'pages_manage_posts',
      'pages_read_engagement',
      'instagram_basic',
      'instagram_content_publish',
      'business_management',
    ],
    color: '#e1306c',
    canPublish: true,
  },
  tiktok: {
    id: 'tiktok',
    label: 'TikTok Business',
    description: 'Sube videos a TikTok mediante la Content Posting API.',
    scopes: ['user.info.basic', 'video.publish', 'video.upload'],
    color: '#00f2ea',
    canPublish: false,
    publishNote:
      'TikTok requiere subir el archivo de video por chunks. Conecta la cuenta y usa la publicación manual desde TikTok mientras habilitamos la subida de video.',
  },
  linkedin: {
    id: 'linkedin',
    label: 'LinkedIn Company',
    description: 'Publica texto en la página de empresa de LinkedIn.',
    scopes: ['w_member_social', 'r_organization_social', 'w_organization_social'],
    color: '#0a66c2',
    canPublish: true,
  },
  x: {
    id: 'x',
    label: 'X (Twitter)',
    description: 'Publica posts de texto en X.',
    scopes: ['tweet.read', 'tweet.write', 'users.read'],
    color: '#e7e9ea',
    canPublish: true,
  },
  threads: {
    id: 'threads',
    label: 'Threads',
    description: 'Publica texto e imágenes en Threads.',
    scopes: [
      'threads_basic',
      'threads_content_publish',
      'threads_manage_insights',
    ],
    color: '#a1a1aa',
    canPublish: true,
  },
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    description: 'Sube videos al canal de YouTube del cliente.',
    scopes: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
    color: '#ff0033',
    canPublish: false,
    publishNote:
      'YouTube requiere subida resumible del archivo de video. La cuenta se puede conectar, pero la subida automática queda pendiente.',
  },
};

export const SOCIAL_PROVIDERS = Object.keys(PROVIDERS) as SocialProvider[];

export function isSocialProvider(value: string): value is SocialProvider {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, value);
}

export function providerLabel(value: string): string {
  return isSocialProvider(value) ? PROVIDERS[value].label : value;
}

export interface ProviderCredentials {
  clientId: string;
  clientSecret: string;
}

/** Credenciales OAuth por red (env o app_settings). Devuelve null si falta. */
export async function getProviderCredentials(
  provider: SocialProvider
): Promise<ProviderCredentials | null> {
  const map: Record<SocialProvider, [string[], string[]]> = {
    facebook: [
      ['META_APP_ID', 'FACEBOOK_APP_ID'],
      ['META_APP_SECRET', 'FACEBOOK_APP_SECRET'],
    ],
    instagram: [
      ['META_APP_ID', 'INSTAGRAM_APP_ID'],
      ['META_APP_SECRET', 'INSTAGRAM_APP_SECRET'],
    ],
    tiktok: [['TIKTOK_CLIENT_KEY'], ['TIKTOK_CLIENT_SECRET']],
    linkedin: [['LINKEDIN_CLIENT_ID'], ['LINKEDIN_CLIENT_SECRET']],
    x: [['X_CLIENT_ID'], ['X_CLIENT_SECRET']],
    threads: [['THREADS_APP_ID'], ['THREADS_APP_SECRET']],
    youtube: [['GOOGLE_CLIENT_ID'], ['GOOGLE_CLIENT_SECRET']],
  };

  const [idKeys, secretKeys] = map[provider];
  const clientId = await findSetting(idKeys);
  const clientSecret = await findSetting(secretKeys);

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** Proveedores que ya tienen credenciales configuradas. */
export async function configuredProviders(): Promise<SocialProvider[]> {
  const checks = await Promise.all(
    SOCIAL_PROVIDERS.map(async (provider) => ({
      provider,
      configured: Boolean(await getProviderCredentials(provider)),
    }))
  );

  return checks.filter((check) => check.configured).map((check) => check.provider);
}

/** URL pública de la app (para redirect_uri de OAuth). */
export function getAppUrl(request?: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  if (request) {
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (host) {
      const proto = forwardedProto || (host.startsWith('localhost') ? 'http' : 'https');
      return `${proto}://${host}`;
    }
  }

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export async function graphVersion(): Promise<string> {
  return (await getSetting('META_GRAPH_VERSION')) || 'v20.0';
}

export async function linkedinApiVersion(): Promise<string> {
  return (await getSetting('LINKEDIN_API_VERSION')) || '202410';
}

export function storageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || 'inventser-images';
}
