import { graphVersion, type ProviderCredentials } from './providers';
import type { SocialProvider } from '@/types/database';

export interface DiscoveredAccount {
  account_name: string;
  page_id?: string | null;
  ig_user_id?: string | null;
  access_token: string;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  metadata?: Record<string, unknown>;
}

export interface TokenSet {
  access_token: string;
  refresh_token?: string | null;
  expires_in?: number | null;
  extra?: Record<string, unknown>;
}

export class OAuthError extends Error {
  details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'OAuthError';
    this.details = details;
  }
}

async function fetchJson(
  url: string,
  init?: RequestInit,
  timeoutMs = 15000
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
    });

    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const message =
        data?.error?.message ||
        data?.error_description ||
        data?.message ||
        `HTTP ${response.status}`;
      throw new OAuthError(message, data);
    }

    return data;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new OAuthError('La red social tardó demasiado en responder.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function buildAuthorizeUrl(input: {
  provider: SocialProvider;
  credentials: ProviderCredentials;
  redirectUri: string;
  state: string;
  scopes: string[];
  pkceChallenge?: string;
}): string {
  const { provider, credentials, redirectUri, state, scopes, pkceChallenge } = input;
  const version = graphVersion();

  switch (provider) {
    case 'facebook':
    case 'instagram': {
      const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`);
      url.searchParams.set('client_id', credentials.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('state', state);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', scopes.join(','));
      return url.toString();
    }

    case 'tiktok': {
      const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
      url.searchParams.set('client_key', credentials.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('state', state);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', scopes.join(','));
      return url.toString();
    }

    case 'linkedin': {
      const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', credentials.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('state', state);
      url.searchParams.set('scope', scopes.join(' '));
      return url.toString();
    }

    case 'x': {
      const url = new URL('https://twitter.com/i/oauth2/authorize');
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', credentials.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('scope', [...scopes, 'offline.access'].join(' '));
      url.searchParams.set('state', state);
      url.searchParams.set('code_challenge', pkceChallenge || '');
      url.searchParams.set('code_challenge_method', 'S256');
      return url.toString();
    }

    case 'threads': {
      const url = new URL('https://threads.net/oauth/authorize');
      url.searchParams.set('client_id', credentials.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('state', state);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', scopes.join(','));
      return url.toString();
    }

    case 'youtube': {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('client_id', credentials.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', scopes.join(' '));
      url.searchParams.set('state', state);
      url.searchParams.set('access_type', 'offline');
      url.searchParams.set('prompt', 'consent');
      return url.toString();
    }

    default:
      throw new OAuthError(`Proveedor no soportado: ${provider}`);
  }
}

function isoFromSeconds(seconds?: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/* ------------------------------------------------------------------ */
/* Meta (Facebook / Instagram)                                         */
/* ------------------------------------------------------------------ */

async function exchangeMetaCode(input: {
  credentials: ProviderCredentials;
  code: string;
  redirectUri: string;
}): Promise<TokenSet> {
  const version = graphVersion();
  const url = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
  url.searchParams.set('client_id', input.credentials.clientId);
  url.searchParams.set('client_secret', input.credentials.clientSecret);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('code', input.code);

  const shortLived = await fetchJson(url.toString());

  // Intercambio por token de larga duración (≈60 días).
  try {
    const longUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
    longUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longUrl.searchParams.set('client_id', input.credentials.clientId);
    longUrl.searchParams.set('client_secret', input.credentials.clientSecret);
    longUrl.searchParams.set('fb_exchange_token', shortLived.access_token);

    const longLived = await fetchJson(longUrl.toString());
    return {
      access_token: longLived.access_token || shortLived.access_token,
      expires_in: longLived.expires_in ?? shortLived.expires_in ?? null,
    };
  } catch (error) {
    console.warn('[growth/oauth] No se pudo extender el token de Meta:', error);
    return {
      access_token: shortLived.access_token,
      expires_in: shortLived.expires_in ?? null,
    };
  }
}

async function discoverMetaAccounts(input: {
  provider: 'facebook' | 'instagram';
  accessToken: string;
}): Promise<DiscoveredAccount[]> {
  const version = graphVersion();
  const url = new URL(`https://graph.facebook.com/${version}/me/accounts`);
  url.searchParams.set(
    'fields',
    'id,name,access_token,instagram_business_account{id,username}'
  );
  url.searchParams.set('limit', '100');
  url.searchParams.set('access_token', input.accessToken);

  const data = await fetchJson(url.toString());
  const pages: any[] = Array.isArray(data?.data) ? data.data : [];

  const accounts: DiscoveredAccount[] = [];

  for (const page of pages) {
    if (!page?.id || !page?.access_token) continue;
    const ig = page.instagram_business_account;

    if (input.provider === 'instagram') {
      if (!ig?.id) continue;
      accounts.push({
        account_name: ig.username ? `@${ig.username}` : page.name || 'Instagram',
        page_id: String(page.id),
        ig_user_id: String(ig.id),
        access_token: String(page.access_token),
        token_expires_at: null,
        metadata: {
          page_name: page.name || null,
          instagram_username: ig.username || null,
        },
      });
      continue;
    }

    accounts.push({
      account_name: page.name || 'Facebook Page',
      page_id: String(page.id),
      access_token: String(page.access_token),
      token_expires_at: null,
      metadata: {
        instagram_business_account: ig?.id || null,
        instagram_username: ig?.username || null,
      },
    });
  }

  return accounts;
}

/* ------------------------------------------------------------------ */
/* TikTok                                                              */
/* ------------------------------------------------------------------ */

async function exchangeTikTokCode(input: {
  credentials: ProviderCredentials;
  code: string;
  redirectUri: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    client_key: input.credentials.clientId,
    client_secret: input.credentials.clientSecret,
    code: input.code,
    grant_type: 'authorization_code',
    redirect_uri: input.redirectUri,
  });

  const data = await fetchJson('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!data?.access_token) {
    throw new OAuthError(data?.error_description || 'TikTok no devolvió un token.', data);
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || null,
    expires_in: data.expires_in ?? null,
    extra: { open_id: data.open_id, scope: data.scope },
  };
}

async function discoverTikTokAccount(token: TokenSet): Promise<DiscoveredAccount[]> {
  let profile: any = null;
  try {
    profile = await fetchJson(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,display_name,username,avatar_url',
      { headers: { Authorization: `Bearer ${token.access_token}` } }
    );
  } catch (error) {
    console.warn('[growth/oauth] TikTok user info:', error);
  }

  const user = profile?.data?.user || {};
  return [
    {
      account_name: user.display_name || user.username || 'TikTok Business',
      page_id: user.open_id || (token.extra?.open_id as string) || null,
      access_token: token.access_token,
      refresh_token: token.refresh_token || null,
      token_expires_at: isoFromSeconds(token.expires_in),
      metadata: {
        username: user.username || null,
        avatar_url: user.avatar_url || null,
        open_id: user.open_id || null,
      },
    },
  ];
}

/* ------------------------------------------------------------------ */
/* LinkedIn                                                            */
/* ------------------------------------------------------------------ */

async function exchangeLinkedInCode(input: {
  credentials: ProviderCredentials;
  code: string;
  redirectUri: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    client_id: input.credentials.clientId,
    client_secret: input.credentials.clientSecret,
    redirect_uri: input.redirectUri,
  });

  const data = await fetchJson('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || null,
    expires_in: data.expires_in ?? null,
  };
}

async function discoverLinkedInAccounts(token: TokenSet): Promise<DiscoveredAccount[]> {
  const headers = {
    Authorization: `Bearer ${token.access_token}`,
    'X-Restli-Protocol-Version': '2.0.0',
    'LinkedIn-Version': process.env.LINKEDIN_API_VERSION || '202410',
  };

  let profile: any = {};
  try {
    profile = await fetchJson('https://api.linkedin.com/v2/userinfo', { headers });
  } catch (error) {
    console.warn('[growth/oauth] LinkedIn userinfo:', error);
  }

  const accounts: DiscoveredAccount[] = [];

  try {
    const acls = await fetchJson(
      'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR',
      { headers }
    );

    for (const element of acls?.elements || []) {
      const org = element?.organization;
      const urn: string = org || '';
      const organizationId = urn.split(':').pop();
      if (!organizationId) continue;

      accounts.push({
        account_name: `Organización ${organizationId}`,
        page_id: organizationId,
        access_token: token.access_token,
        refresh_token: token.refresh_token || null,
        token_expires_at: isoFromSeconds(token.expires_in),
        metadata: { urn, kind: 'organization', sub: profile?.sub || null },
      });
    }
  } catch (error) {
    console.warn('[growth/oauth] LinkedIn organizations:', error);
  }

  if (accounts.length === 0 && profile?.sub) {
    accounts.push({
      account_name: profile.name || 'LinkedIn',
      page_id: null,
      access_token: token.access_token,
      refresh_token: token.refresh_token || null,
      token_expires_at: isoFromSeconds(token.expires_in),
      metadata: { sub: profile.sub, kind: 'person' },
    });
  }

  return accounts;
}

/* ------------------------------------------------------------------ */
/* X (Twitter)                                                         */
/* ------------------------------------------------------------------ */

async function exchangeXCode(input: {
  credentials: ProviderCredentials;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    code: input.code,
    grant_type: 'authorization_code',
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
  });

  const basic = Buffer.from(
    `${input.credentials.clientId}:${input.credentials.clientSecret}`,
    'utf8'
  ).toString('base64');

  const data = await fetchJson('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body,
  });

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || null,
    expires_in: data.expires_in ?? null,
  };
}

async function discoverXAccount(token: TokenSet): Promise<DiscoveredAccount[]> {
  const data = await fetchJson('https://api.twitter.com/2/users/me', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });

  const user = data?.data || {};
  return [
    {
      account_name: user.username ? `@${user.username}` : user.name || 'X',
      page_id: user.id || null,
      access_token: token.access_token,
      refresh_token: token.refresh_token || null,
      token_expires_at: isoFromSeconds(token.expires_in),
      metadata: { username: user.username || null, name: user.name || null },
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Threads                                                             */
/* ------------------------------------------------------------------ */

async function exchangeThreadsCode(input: {
  credentials: ProviderCredentials;
  code: string;
  redirectUri: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    client_id: input.credentials.clientId,
    client_secret: input.credentials.clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: input.redirectUri,
    code: input.code,
  });

  const data = await fetchJson('https://graph.threads.net/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!data?.access_token) {
    throw new OAuthError(data?.error_message || 'Threads no devolvió un token.', data);
  }

  return {
    access_token: data.access_token,
    expires_in: data.expires_in ?? null,
    extra: { user_id: data.user_id },
  };
}

async function discoverThreadsAccount(token: TokenSet): Promise<DiscoveredAccount[]> {
  const version = graphVersion();
  const url = new URL(`https://graph.threads.net/${version}/me`);
  url.searchParams.set('fields', 'id,username,threads_profile_picture_url');
  url.searchParams.set('access_token', token.access_token);

  let profile: any = {};
  try {
    profile = await fetchJson(url.toString());
  } catch (error) {
    console.warn('[growth/oauth] Threads profile:', error);
  }

  const userId = profile?.id || (token.extra?.user_id as string) || null;
  return [
    {
      account_name: profile?.username ? `@${profile.username}` : 'Threads',
      page_id: userId,
      access_token: token.access_token,
      token_expires_at: isoFromSeconds(token.expires_in),
      metadata: {
        username: profile?.username || null,
        avatar_url: profile?.threads_profile_picture_url || null,
      },
    },
  ];
}

/* ------------------------------------------------------------------ */
/* YouTube                                                             */
/* ------------------------------------------------------------------ */

async function exchangeYouTubeCode(input: {
  credentials: ProviderCredentials;
  code: string;
  redirectUri: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.credentials.clientId,
    client_secret: input.credentials.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: 'authorization_code',
  });

  const data = await fetchJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || null,
    expires_in: data.expires_in ?? null,
  };
}

async function discoverYouTubeAccount(token: TokenSet): Promise<DiscoveredAccount[]> {
  const data = await fetchJson(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    { headers: { Authorization: `Bearer ${token.access_token}` } }
  );

  const channel = data?.items?.[0];
  if (!channel?.id) {
    throw new OAuthError('La cuenta de Google no tiene un canal de YouTube.');
  }

  return [
    {
      account_name: channel.snippet?.title || 'YouTube',
      page_id: channel.id,
      access_token: token.access_token,
      refresh_token: token.refresh_token || null,
      token_expires_at: isoFromSeconds(token.expires_in),
      metadata: {
        thumbnail: channel.snippet?.thumbnails?.default?.url || null,
      },
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Entrada única                                                       */
/* ------------------------------------------------------------------ */

export async function exchangeCodeForToken(input: {
  provider: SocialProvider;
  credentials: ProviderCredentials;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}): Promise<TokenSet> {
  switch (input.provider) {
    case 'facebook':
    case 'instagram':
      return exchangeMetaCode(input);
    case 'tiktok':
      return exchangeTikTokCode(input);
    case 'linkedin':
      return exchangeLinkedInCode(input);
    case 'x':
      return exchangeXCode({
        ...input,
        codeVerifier: input.codeVerifier || '',
      });
    case 'threads':
      return exchangeThreadsCode(input);
    case 'youtube':
      return exchangeYouTubeCode(input);
    default:
      throw new OAuthError(`Proveedor no soportado: ${input.provider}`);
  }
}

export async function discoverAccounts(input: {
  provider: SocialProvider;
  token: TokenSet;
}): Promise<DiscoveredAccount[]> {
  switch (input.provider) {
    case 'facebook':
    case 'instagram':
      return discoverMetaAccounts({
        provider: input.provider,
        accessToken: input.token.access_token,
      });
    case 'tiktok':
      return discoverTikTokAccount(input.token);
    case 'linkedin':
      return discoverLinkedInAccounts(input.token);
    case 'x':
      return discoverXAccount(input.token);
    case 'threads':
      return discoverThreadsAccount(input.token);
    case 'youtube':
      return discoverYouTubeAccount(input.token);
    default:
      throw new OAuthError(`Proveedor no soportado: ${input.provider}`);
  }
}
