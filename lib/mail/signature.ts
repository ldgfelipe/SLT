import crypto from 'crypto';
import { getSetting } from '@/lib/app/settings';

let cachedSecret: Buffer | null = null;

async function secret(): Promise<Buffer> {
  if (cachedSecret) return cachedSecret;
  const raw =
    (await getSetting('TOKEN_ENCRYPTION_KEY')) ||
    (await getSetting('OAUTH_STATE_SECRET')) ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'inventser-mail-development-key';

  cachedSecret = crypto.createHash('sha256').update(raw + '|mail').digest();
  return cachedSecret;
}

export function b64urlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export function b64urlDecode(value: string): string {
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    return '';
  }
}

/** Firma HMAC-SHA256 para enlaces públicos de tracking. */
export async function signPayload(message: string): Promise<string> {
  const key = await secret();
  return crypto.createHmac('sha256', key).update(message).digest('hex');
}

export async function verifyPayload(
  message: string,
  signature: string
): Promise<boolean> {
  if (!signature) return false;
  const expected = await signPayload(message);
  const provided = Buffer.from(signature, 'utf8');
  const wanted = Buffer.from(expected, 'utf8');
  if (provided.length !== wanted.length) return false;
  return crypto.timingSafeEqual(provided, wanted);
}
