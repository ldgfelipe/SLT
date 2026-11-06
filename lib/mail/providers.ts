/**
 * Catálogo de proveedores de envío soportados por el Mail Center.
 * Los campos de configuración se renderizan dinámicamente en el formulario de
 * conexión. Nada sensible llega al navegador: todo se cifra en BD (app_settings)
 * o en `mail_connections.config` (AES-256-GCM).
 */

export type ProviderId =
  | 'brevo'
  | 'sendgrid'
  | 'mailgun'
  | 'mailrelay'
  | 'mailerlite'
  | 'mandrill'
  | 'resend'
  | 'ses'
  | 'smtp2go'
  | 'zoho'
  | 'http';

export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'password' | 'email' | 'select';
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  hint?: string;
}

export interface ProviderDef {
  id: ProviderId;
  label: string;
  short: string;
  color: string;
  viaSmtp: boolean;
  viaApi: boolean;
  apiFields: FieldDef[];
  smtpFields: FieldDef[];
  note?: string;
}

const SMTP_COMMON: FieldDef[] = [
  { name: 'smtp_host', label: 'Servidor SMTP', placeholder: 'smtp.proveedor.com', required: true },
  { name: 'smtp_port', label: 'Puerto', placeholder: '587', required: true },
  {
    name: 'smtp_secure',
    label: 'Cifrado',
    type: 'select',
    options: [
      { value: 'starttls', label: 'STARTTLS (587)' },
      { value: 'ssl', label: 'SSL/TLS (465)' },
      { value: 'none', label: 'Sin cifrado (25)' },
    ],
  },
  { name: 'smtp_user', label: 'Usuario SMTP', required: true },
  { name: 'smtp_pass', label: 'Contraseña SMTP', type: 'password', required: true },
];

const API_KEY_FIELD = (label = 'API Key'): FieldDef => ({
  name: 'api_key',
  label,
  type: 'password',
  required: true,
});

export const MAIL_PROVIDERS: ProviderDef[] = [
  {
    id: 'brevo',
    label: 'Brevo',
    short: 'B',
    color: '#0b996e',
    viaSmtp: true,
    viaApi: true,
    apiFields: [API_KEY_FIELD('API Key v3')],
    smtpFields: [
      { name: 'smtp_user', label: 'Login (correo Brevo)', required: true },
      { name: 'smtp_pass', label: 'SMTP Key', type: 'password', required: true },
    ],
  },
  {
    id: 'sendgrid',
    label: 'SendGrid',
    short: 'SG',
    color: '#1a82e2',
    viaSmtp: true,
    viaApi: true,
    apiFields: [API_KEY_FIELD('API Key (SG.…)')],
    smtpFields: [
      { name: 'smtp_user', label: 'Usuario (apikey)', placeholder: 'apikey', required: true },
      { name: 'smtp_pass', label: 'API Key (SG.…)', type: 'password', required: true },
    ],
  },
  {
    id: 'mailgun',
    label: 'Mailgun',
    short: 'M',
    color: '#f0622b',
    viaSmtp: true,
    viaApi: true,
    apiFields: [
      API_KEY_FIELD('API Key (priv-…)'),
      { name: 'domain', label: 'Dominio de envío', placeholder: 'mg.tudominio.com', required: true },
      {
        name: 'region',
        label: 'Región',
        type: 'select',
        options: [
          { value: 'us', label: 'US (api.mailgun.net)' },
          { value: 'eu', label: 'EU (api.eu.mailgun.net)' },
        ],
      },
    ],
    smtpFields: SMTP_COMMON,
  },
  {
    id: 'mailrelay',
    label: 'MailRelay',
    short: 'MR',
    color: '#e11d48',
    viaSmtp: true,
    viaApi: false,
    apiFields: [],
    smtpFields: SMTP_COMMON,
    note: 'MailRelay opera por SMTP. Las credenciales SMTP las ves en tu panel → SMTP.',
  },
  {
    id: 'mailerlite',
    label: 'MailerLite',
    short: 'ML',
    color: '#09c269',
    viaSmtp: true,
    viaApi: false,
    apiFields: [],
    smtpFields: SMTP_COMMON,
    note: 'MailerLite por SMTP (requiere plan con SMTP habilitado).',
  },
  {
    id: 'mandrill',
    label: 'Mailchimp (Mandrill)',
    short: 'MC',
    color: '#c7a338',
    viaSmtp: false,
    viaApi: true,
    apiFields: [API_KEY_FIELD('API Key de Mandrill')],
    smtpFields: [],
  },
  {
    id: 'resend',
    label: 'Resend',
    short: 'R',
    color: '#111111',
    viaSmtp: false,
    viaApi: true,
    apiFields: [API_KEY_FIELD('API Key (re_…)')],
    smtpFields: [],
  },
  {
    id: 'ses',
    label: 'Amazon SES (AWS)',
    short: 'AWS',
    color: '#232f3e',
    viaSmtp: true,
    viaApi: true,
    apiFields: [
      { name: 'aws_access_key_id', label: 'AWS Access Key ID', required: true },
      { name: 'aws_secret_access_key', label: 'AWS Secret Access Key', type: 'password', required: true },
      { name: 'aws_region', label: 'Región', placeholder: 'us-east-1', required: true },
    ],
    smtpFields: SMTP_COMMON,
    note: 'La cuota real de AWS (50,000/día y 14/seg) manda. Los límites por conexión los ajustas abajo.',
  },
  {
    id: 'smtp2go',
    label: 'SMTP2GO',
    short: 'S2G',
    color: '#0e7490',
    viaSmtp: true,
    viaApi: true,
    apiFields: [API_KEY_FIELD('API Key')],
    smtpFields: SMTP_COMMON,
  },
  {
    id: 'zoho',
    label: 'Zoho Mail',
    short: 'Z',
    color: '#c2410c',
    viaSmtp: true,
    viaApi: false,
    apiFields: [],
    smtpFields: SMTP_COMMON,
    note: 'Zoho opera por SMTP (smtp.zoho.com:465 o 587).',
  },
  {
    id: 'http',
    label: 'Genérica (HTTP propio)',
    short: 'HTTP',
    color: '#475569',
    viaSmtp: false,
    viaApi: true,
    apiFields: [
      { name: 'endpoint', label: 'Endpoint', placeholder: 'https://tu-api.com/send', required: true },
      {
        name: 'method',
        label: 'Método',
        type: 'select',
        options: [
          { value: 'post', label: 'POST' },
          { value: 'put', label: 'PUT' },
        ],
      },
      {
        name: 'headers_json',
        label: 'Headers (JSON, opcional)',
        placeholder: '{"Authorization": "Bearer xxx"}',
      },
      {
        name: 'body_template',
        label: 'Body JSON (plantilla)',
        placeholder:
          '{"from":"{{from_email}}","to":["{{to_email}}"],"subject":"{{subject}}","html":"{{html}}"}',
        required: true,
      },
    ],
    smtpFields: [],
    note:
      'Variables disponibles: {{from_email}} {{from_name}} {{to_email}} {{to_name}} {{subject}} {{html}} {{list_unsubscribe}}',
  },
];

export const MAIL_PROVIDER_MAP: Record<string, ProviderDef> = Object.fromEntries(
  MAIL_PROVIDERS.map((p) => [p.id, p])
);

export function providerLabel(id: string): string {
  return MAIL_PROVIDER_MAP[id]?.label || id;
}

export function providerShort(id: string): string {
  return MAIL_PROVIDER_MAP[id]?.short || id.slice(0, 2).toUpperCase();
}

/** Campos exportables al formulario React. */
export function providerFields(id: string, via: 'api' | 'smtp'): FieldDef[] {
  const def = MAIL_PROVIDER_MAP[id];
  if (!def) return [];
  return via === 'smtp' ? def.smtpFields : def.apiFields;
}
