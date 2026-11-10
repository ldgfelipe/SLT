/**
 * Catálogo de claves configurables desde el sitio.
 * Las variables `NEXT_PUBLIC_*` y el bootstrap de Supabase NO van aquí.
 */
export interface SecretKeyDef {
  key: string;
  label: string;
  hint?: string;
  group: string;
  placeholder?: string;
}

export const SECRET_KEY_GROUPS: Array<{ id: string; label: string }> = [
  { id: 'security', label: 'Seguridad' },
  { id: 'meta', label: 'Meta / Facebook / Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'x', label: 'X (Twitter)' },
  { id: 'threads', label: 'Threads' },
  { id: 'youtube', label: 'YouTube' },
];

export const SECRET_KEYS: SecretKeyDef[] = [
  // Seguridad
  { key: 'CRON_SECRET', label: 'CRON_SECRET', group: 'security',
    hint: 'Debe coincidir con la que usan los crons (Supabase o Vercel).' },
  { key: 'TOKEN_ENCRYPTION_KEY', label: 'TOKEN_ENCRYPTION_KEY', group: 'security',
    hint: 'Clave maestra para cifrar tokens. Si no existe, se usa SUPABASE_SERVICE_ROLE_KEY.' },
  { key: 'OAUTH_STATE_SECRET', label: 'OAUTH_STATE_SECRET', group: 'security',
    hint: 'Firma del estado OAuth. Si se omite, se usa TOKEN_ENCRYPTION_KEY.' },

  // Meta
  { key: 'META_APP_ID', label: 'META_APP_ID', group: 'meta',
    hint: 'ID de la app de Facebook para OAuth de FB / IG / Threads.' },
  { key: 'META_APP_SECRET', label: 'META_APP_SECRET', group: 'meta',
    hint: 'Secreto de la app de Facebook.' },
  { key: 'META_GRAPH_VERSION', label: 'META_GRAPH_VERSION', group: 'meta',
    placeholder: 'v20.0', hint: 'Opcional. Por defecto v20.0.' },
  { key: 'META_AD_ACCOUNT_ID', label: 'META_AD_ACCOUNT_ID', group: 'meta',
    placeholder: '1121420584106874', hint: 'Sin el prefijo act_.' },
  { key: 'META_PAGE_ID', label: 'META_PAGE_ID', group: 'meta',
    placeholder: '1320047334532792' },
  { key: 'IG_USER_ID', label: 'IG_USER_ID', group: 'meta',
    placeholder: '17841414535979831' },
  { key: 'META_WEBHOOK_VERIFY_TOKEN', label: 'META_WEBHOOK_VERIFY_TOKEN', group: 'meta',
    hint: 'Token de verificación del webhook de Meta.' },

  // TikTok
  { key: 'TIKTOK_CLIENT_KEY', label: 'TIKTOK_CLIENT_KEY', group: 'tiktok' },
  { key: 'TIKTOK_CLIENT_SECRET', label: 'TIKTOK_CLIENT_SECRET', group: 'tiktok' },
  { key: 'TIKTOK_SANDBOX_TARGET', label: 'TIKTOK_SANDBOX_TARGET', group: 'tiktok',
    placeholder: 'User ID de prueba', hint: 'Solo para sandbox/testing. Dejar vacío para producción.' },

  // LinkedIn
  { key: 'LINKEDIN_CLIENT_ID', label: 'LINKEDIN_CLIENT_ID', group: 'linkedin' },
  { key: 'LINKEDIN_CLIENT_SECRET', label: 'LINKEDIN_CLIENT_SECRET', group: 'linkedin' },
  { key: 'LINKEDIN_API_VERSION', label: 'LINKEDIN_API_VERSION', group: 'linkedin',
    placeholder: '202410', hint: 'Opcional. Por defecto 202410.' },

  // X
  { key: 'X_CLIENT_ID', label: 'X_CLIENT_ID', group: 'x' },
  { key: 'X_CLIENT_SECRET', label: 'X_CLIENT_SECRET', group: 'x' },

  // Threads
  { key: 'THREADS_APP_ID', label: 'THREADS_APP_ID', group: 'threads' },
  { key: 'THREADS_APP_SECRET', label: 'THREADS_APP_SECRET', group: 'threads' },

  // YouTube
  { key: 'GOOGLE_CLIENT_ID', label: 'GOOGLE_CLIENT_ID', group: 'youtube' },
  { key: 'GOOGLE_CLIENT_SECRET', label: 'GOOGLE_CLIENT_SECRET', group: 'youtube' },
];

export const SECRET_KEYS_BY_KEY: Record<string, SecretKeyDef> =
  Object.fromEntries(SECRET_KEYS.map((item) => [item.key, item]));

export const SECRET_KEY_KEYS = SECRET_KEYS.map((item) => item.key);
