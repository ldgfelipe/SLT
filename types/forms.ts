export type FormFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'number'
  | 'textarea'
  | 'date'
  | 'select'
  | 'checkbox';

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormField {
  key: string;
  label: string;
  type: FormFieldType;
  placeholder?: string;
  required?: boolean;
  options?: FormFieldOption[];
}

export type SubmitBehavior = 'none' | 'redirect' | 'message';

export type CaptchaProvider = 'none' | 'recaptcha' | 'turnstile';

export interface CaptchaConfig {
  provider: CaptchaProvider;
  /** Clave pública del widget. La clave secreta vive solo en variables de entorno. */
  site_key?: string;
}

export interface FormConfig {
  fields: FormField[];
  submit_mode?: SubmitBehavior;
  redirect_url?: string;
  message?: string;
  /** Protección anti-bot opcional. El honeypot y la trampa de tiempo siempre están activos. */
  captcha?: CaptchaConfig;
}

export const CAPTCHA_LABELS: Record<CaptchaProvider, string> = {
  none: 'Sin captcha',
  recaptcha: 'Google reCAPTCHA',
  turnstile: 'Cloudflare Turnstile',
};

export const CAPTCHA_SECRET_ENV: Record<CaptchaProvider, string> = {
  none: '',
  recaptcha: 'RECAPTCHA_SECRET_KEY',
  turnstile: 'TURNSTILE_SECRET_KEY',
};

function normalizeCaptcha(raw: unknown): CaptchaConfig {
  if (!raw || typeof raw !== 'object') return { provider: 'none' };
  const value = raw as Partial<CaptchaConfig>;
  const provider: CaptchaProvider =
    value.provider === 'recaptcha' || value.provider === 'turnstile'
      ? value.provider
      : 'none';

  if (provider === 'none') return { provider: 'none' };

  return {
    provider,
    site_key: typeof value.site_key === 'string' ? value.site_key.trim() : '',
  };
}

/** Campos base que se mapean directo a columnas de la tabla contacts. */
export const BASIC_CONTACT_FIELDS = ['first_name', 'last_name', 'email', 'phone'] as const;

/** Configuración por defecto al crear un formulario. */
export const DEFAULT_FORM_FIELDS: FormField[] = [
  { key: 'first_name', label: 'Nombre', type: 'text', placeholder: 'Tu nombre', required: true },
  { key: 'last_name', label: 'Apellido', type: 'text', placeholder: 'Tu apellido', required: false },
  { key: 'email', label: 'Email', type: 'email', placeholder: 'tu@email.com', required: true },
  { key: 'phone', label: 'Teléfono', type: 'tel', placeholder: '+52 000 000 0000', required: false },
];

type LegacyField = Partial<FormField> & { name?: string };

function normalizeField(raw: LegacyField, index: number): FormField {
  const type = (raw.type || 'text') as FormFieldType;
  const key = (raw.key || raw.name || `campo_${index + 1}`).trim();
  return {
    key,
    label: raw.label || key,
    type,
    placeholder: raw.placeholder,
    required: !!raw.required,
    options: Array.isArray(raw.options) ? raw.options : undefined,
  };
}

/** Normaliza fields_config (versiones antiguas guardaban un array plano y usaban `name`). */
export function normalizeFormConfig(raw: unknown): FormConfig {
  if (Array.isArray(raw)) {
    return {
      fields: (raw as LegacyField[]).map(normalizeField),
      submit_mode: 'none',
      captcha: { provider: 'none' },
    };
  }
  if (raw && typeof raw === 'object') {
    const config = raw as Partial<FormConfig> & { fields?: LegacyField[] };
    const fields = Array.isArray(config.fields) ? config.fields.map(normalizeField) : [];
    return {
      fields,
      submit_mode:
        config.submit_mode ??
        (config.redirect_url ? 'redirect' : config.message ? 'message' : 'none'),
      redirect_url: config.redirect_url,
      message: config.message,
      captcha: normalizeCaptcha(config.captcha),
    };
  }
  return { fields: [], submit_mode: 'none', captcha: { provider: 'none' } };
}
