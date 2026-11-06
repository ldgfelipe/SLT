import { decryptToken, encryptToken } from '@/lib/growth/crypto';

export type MailConnectionConfig = Record<string, string>;

/** Cifra la configuración (API keys, SMTP) en reposo. */
export function encryptMailConfig(config: MailConnectionConfig): string {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(config)) {
    const trimmed = String(value ?? '').trim();
    if (trimmed) clean[key] = trimmed;
  }
  return encryptToken(JSON.stringify(clean));
}

/** Descifra la configuración. NUNCA se expone al navegador. */
export function decryptMailConfig(payload: string): MailConnectionConfig {
  const raw = decryptToken(payload);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as MailConnectionConfig;
    }
    return {};
  } catch {
    return {};
  }
}

/** Quita campos sensibles para mostrar estado (nunca valores en crudo). */
export function maskMailConfig(config: MailConnectionConfig): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(config)) {
    const sensitive = /key|pass|secret|token|password/i.test(key);
    masked[key] = sensitive ? '••••••••' : value;
  }
  return masked;
}
