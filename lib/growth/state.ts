import crypto from 'crypto';
import type { SocialProvider } from '@/types/database';

const STATE_TTL_SECONDS = 60 * 10; // 10 minutos

export interface OAuthStatePayload {
  clientId: string;
  userId: string;
  provider: SocialProvider;
  nonce: string;
  exp: number;
}

function secret(): string {
  return (
    process.env.OAUTH_STATE_SECRET ||
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'inventser-oauth-state-development-key'
  );
}

function signature(body: string): string {
  return crypto.createHmac('sha256', secret()).update(body).digest('base64url');
}

/** Estado OAuth firmado (HMAC-SHA256) para evitar CSRF y client_id manipulados. */
export function signOAuthState(input: {
  clientId: string;
  userId: string;
  provider: SocialProvider;
}): string {
  const payload: OAuthStatePayload = {
    ...input,
    nonce: crypto.randomBytes(16).toString('hex'),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  };

  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${signature(body)}`;
}

export function verifyOAuthState(raw: string | null): OAuthStatePayload | null {
  if (!raw) return null;

  const [body, provided] = raw.split('.');
  if (!body || !provided) return null;

  const expected = signature(body);
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as OAuthStatePayload;

    if (!payload.clientId || !payload.userId || !payload.provider) return null;
    if (payload.exp * 1000 < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

export interface PkcePair {
  verifier: string;
  challenge: string;
}

/** PKCE S256 (obligatorio en X/Twitter OAuth 2.0). */
export function createPkcePair(): PkcePair {
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');

  return { verifier, challenge };
}
