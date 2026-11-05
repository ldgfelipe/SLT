import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { decryptToken, encryptToken } from './crypto';
import { getProviderCredentials, graphVersion } from './providers';
import type { SocialProvider } from '@/types/database';

interface TokenRefreshResult {
  access_token: string;
  refresh_token?: string | null;
  expires_in?: number | null;
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

async function postForm(
  url: string,
  body: URLSearchParams,
  headers: Record<string, string> = {}
): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    body,
    cache: 'no-store',
  });

  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(
      data?.error_description ||
        data?.error?.message ||
        data?.message ||
        `HTTP ${response.status}`
    );
  }
  return data;
}

async function refreshToken(
  provider: SocialProvider,
  accessToken: string,
  refreshTokenValue: string
): Promise<TokenRefreshResult | null> {
  const credentials = await getProviderCredentials(provider);
  if (!credentials) {
    throw new Error(`Faltan credenciales para ${provider}.`);
  }

  const version = await graphVersion();

  switch (provider) {
    case 'facebook':
    case 'instagram': {
      if (!accessToken) return null;
      const url = new URL(
        `https://graph.facebook.com/${version}/oauth/access_token`
      );
      url.searchParams.set('grant_type', 'fb_exchange_token');
      url.searchParams.set('client_id', credentials.clientId);
      url.searchParams.set('client_secret', credentials.clientSecret);
      url.searchParams.set('fb_exchange_token', accessToken);

      const response = await fetch(url.toString(), { cache: 'no-store' });
      const data = await readJson(response);
      if (!response.ok || !data?.access_token) {
        throw new Error(
          data?.error?.message || 'Meta no renovó el token.'
        );
      }

      return {
        access_token: data.access_token,
        expires_in: data.expires_in ?? 60 * 24 * 60 * 60,
      };
    }

    case 'tiktok': {
      if (!refreshTokenValue) return null;
      const data = await postForm(
        'https://open.tiktokapis.com/v2/oauth/token/',
        new URLSearchParams({
          client_key: credentials.clientId,
          client_secret: credentials.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshTokenValue,
        })
      );

      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshTokenValue,
        expires_in: data.expires_in ?? null,
      };
    }

    case 'x': {
      if (!refreshTokenValue) return null;
      const basic = Buffer.from(
        `${credentials.clientId}:${credentials.clientSecret}`,
        'utf8'
      ).toString('base64');

      const data = await postForm(
        'https://api.twitter.com/2/oauth2/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshTokenValue,
          client_id: credentials.clientId,
        }),
        { Authorization: `Basic ${basic}` }
      );

      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshTokenValue,
        expires_in: data.expires_in ?? null,
      };
    }

    case 'youtube': {
      if (!refreshTokenValue) return null;
      const data = await postForm(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshTokenValue,
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
        })
      );

      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshTokenValue,
        expires_in: data.expires_in ?? null,
      };
    }

    case 'linkedin': {
      if (!refreshTokenValue) return null;
      const data = await postForm(
        'https://www.linkedin.com/oauth/v2/accessToken',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshTokenValue,
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
        })
      );

      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshTokenValue,
        expires_in: data.expires_in ?? null,
      };
    }

    case 'threads': {
      if (!accessToken) return null;
      const url = new URL('https://graph.threads.net/refresh_access_token');
      url.searchParams.set('grant_type', 'th_refresh_token');
      url.searchParams.set('access_token', accessToken);

      const response = await fetch(url.toString(), { cache: 'no-store' });
      const data = await readJson(response);
      if (!response.ok || !data?.access_token) {
        throw new Error(
          data?.error?.message || 'Threads no renovó el token.'
        );
      }

      return {
        access_token: data.access_token,
        expires_in: data.expires_in ?? null,
      };
    }

    default:
      return null;
  }
}

export interface RefreshSummary {
  checked: number;
  refreshed: number;
  expired: number;
  errors: Array<{ accountId: string; provider: string; error: string }>;
}

export async function refreshExpiringTokens(limit = 50): Promise<RefreshSummary> {
  const supabase = getSupabaseAdmin();
  const threshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: accounts, error } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('status', 'active')
    .not('token_expires_at', 'is', null)
    .lte('token_expires_at', threshold)
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const summary: RefreshSummary = {
    checked: accounts?.length || 0,
    refreshed: 0,
    expired: 0,
    errors: [],
  };

  for (const account of accounts || []) {
    const accessToken = decryptToken(account.access_token_encrypted);
    const refreshTokenValue = decryptToken(account.refresh_token);

    try {
      const result = await refreshToken(
        account.provider as SocialProvider,
        accessToken,
        refreshTokenValue
      );

      if (!result) {
        if (
          account.token_expires_at &&
          new Date(account.token_expires_at).getTime() < Date.now()
        ) {
          await supabase
            .from('social_accounts')
            .update({ status: 'expired', updated_at: new Date().toISOString() })
            .eq('id', account.id);
          summary.expired += 1;
        }
        continue;
      }

      const expiresAt =
        result.expires_in && result.expires_in > 0
          ? new Date(Date.now() + result.expires_in * 1000).toISOString()
          : null;

      await supabase
        .from('social_accounts')
        .update({
          access_token_encrypted: encryptToken(result.access_token),
          refresh_token: result.refresh_token
            ? encryptToken(result.refresh_token)
            : account.refresh_token,
          token_expires_at: expiresAt,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', account.id);

      summary.refreshed += 1;
    } catch (refreshError: any) {
      console.error('[growth/refresh]', account.id, refreshError);

      summary.errors.push({
        accountId: account.id,
        provider: account.provider,
        error: refreshError?.message || 'Error al renovar el token.',
      });

      if (
        account.token_expires_at &&
        new Date(account.token_expires_at).getTime() < Date.now()
      ) {
        await supabase
          .from('social_accounts')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', account.id);
        summary.expired += 1;
      }
    }
  }

  return summary;
}
