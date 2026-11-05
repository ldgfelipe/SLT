import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'v1';

function getKey(): Buffer {
  const raw =
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.OAUTH_STATE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Falta TOKEN_ENCRYPTION_KEY. Configúrala en Vercel para cifrar los tokens de las cuentas sociales.'
      );
    }
  }

  // Derivamos una clave de 32 bytes sin importar el formato del secreto.
  return crypto
    .createHash('sha256')
    .update(raw || 'inventser-growth-hub-development-key')
    .digest();
}

/**
 * Cifra un token con AES-256-GCM.
 * Formato: v1:<iv b64url>:<tag b64url>:<ciphertext b64url>
 */
export function encryptToken(value: string): string {
  if (!value) return '';

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

export function decryptToken(payload: string | null | undefined): string {
  if (!payload) return '';

  // Compatibilidad con tokens antiguos en texto plano.
  if (!payload.startsWith(`${PREFIX}:`)) return payload;

  const parts = payload.split(':');
  if (parts.length !== 4) return '';

  const [, ivPart, tagPart, dataPart] = parts;

  try {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getKey(),
      Buffer.from(ivPart, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch (error) {
    console.error('[growth/crypto] No se pudo descifrar el token:', error);
    return '';
  }
}

/** Indica si hay una clave dedicada configurada (recomendado en producción). */
export function isEncryptionConfigured(): boolean {
  return Boolean(process.env.TOKEN_ENCRYPTION_KEY);
}
