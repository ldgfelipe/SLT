import nodemailer from 'nodemailer';
import {
  SESv2Client,
  SendEmailCommand,
  GetAccountCommand,
} from '@aws-sdk/client-sesv2';
import { decryptMailConfig, type MailConnectionConfig } from './config';

/* ------------------------------------------------------------------ */
/* Tipos compartidos                                                    */
/* ------------------------------------------------------------------ */

export interface MailConnectionRecord {
  id: string;
  client_id: string;
  nombre: string;
  proveedor: string;
  config: string;
  activo: boolean;
}

export interface MailMessage {
  to: string;
  toName?: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  html: string;
  listUnsubscribe?: string;
  listUnsubscribeOneClick?: boolean;
}

export interface SendResult {
  ok: boolean;
  error?: string;
  messageId?: string;
  provider?: string;
}

export interface TestResult {
  ok: boolean;
  detail?: string;
  error?: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function escapeJsonString(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

function httpError(data: any, fallback: string): string {
  return (
    data?.error?.message ||
    data?.message ||
    data?.errors?.[0]?.message ||
    data?.errors?.[0] ||
    `HTTP ${fallback}`
  );
}

async function readJson(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function listUnsubscribeHeaders(message: MailMessage): Record<string, string> | undefined {
  if (!message.listUnsubscribe) return undefined;
  const headers: Record<string, string> = {
    'List-Unsubscribe': message.listUnsubscribe,
  };
  if (message.listUnsubscribeOneClick) {
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }
  return headers;
}

/* ------------------------------------------------------------------ */
/* SMTP (nodemailer)                                                    */
/* ------------------------------------------------------------------ */

function smtpTransport(config: MailConnectionConfig) {
  const port = Number(config.smtp_port || 587);
  const secure = config.smtp_secure === 'ssl';
  const requireTLS = config.smtp_secure === 'starttls';

  return nodemailer.createTransport({
    host: config.smtp_host,
    port,
    secure,
    requireTLS: requireTLS && !secure,
    auth: { user: config.smtp_user, pass: config.smtp_pass },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

async function sendSmtp(
  config: MailConnectionConfig,
  message: MailMessage
): Promise<SendResult> {
  try {
    const transport = smtpTransport(config);
    const info = await transport.sendMail({
      from: `"${message.fromName}" <${message.fromEmail}>`,
      to: message.toName ? `"${message.toName}" <${message.to}>` : message.to,
      subject: message.subject,
      html: message.html,
      headers: listUnsubscribeHeaders(message),
    });
    return { ok: true, messageId: info?.messageId, provider: 'smtp' };
  } catch (error: any) {
    console.error('[mail] smtp send:', error?.message || error);
    return { ok: false, error: error?.message || 'Error SMTP', provider: 'smtp' };
  }
}

async function testSmtp(config: MailConnectionConfig): Promise<TestResult> {
  try {
    const transport = smtpTransport(config);
    await transport.verify();
    return { ok: true, detail: 'Conexión SMTP verificada correctamente.' };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'No se pudo verificar SMTP.' };
  }
}

/* ------------------------------------------------------------------ */
/* Brevo                                                                */
/* ------------------------------------------------------------------ */

async function sendBrevo(
  config: MailConnectionConfig,
  message: MailMessage
): Promise<SendResult> {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.api_key,
    },
    body: JSON.stringify({
      sender: { name: message.fromName, email: message.fromEmail },
      to: [{ email: message.to, name: message.toName || undefined }],
      subject: message.subject,
      htmlContent: message.html,
      headers: listUnsubscribeHeaders(message),
    }),
  });

  const data = await readJson(response);
  if (!response.ok) {
    return { ok: false, error: httpError(data, 'Brevo'), provider: 'brevo' };
  }
  return { ok: true, messageId: data?.messageId, provider: 'brevo' };
}

async function testBrevo(config: MailConnectionConfig): Promise<TestResult> {
  const response = await fetch('https://api.brevo.com/v3/account', {
    headers: { 'api-key': config.api_key },
  });
  const data = await readJson(response);
  if (!response.ok) return { ok: false, error: httpError(data, 'Brevo') };
  return { ok: true, detail: `Cuenta Brevo OK (plan: ${data?.plan?.[0]?.type || 'activo'}).` };
}

/* ------------------------------------------------------------------ */
/* SendGrid                                                             */
/* ------------------------------------------------------------------ */

async function sendSendGrid(
  config: MailConnectionConfig,
  message: MailMessage
): Promise<SendResult> {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.api_key}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: message.to, name: message.toName || undefined }] }],
      from: { email: message.fromEmail, name: message.fromName },
      subject: message.subject,
      content: [{ type: 'text/html', value: message.html }],
      headers: listUnsubscribeHeaders(message),
    }),
  });

  if (response.status === 202 || response.status === 200) {
    return { ok: true, provider: 'sendgrid' };
  }

  const data = await readJson(response);
  return { ok: false, error: httpError(data, 'SendGrid'), provider: 'sendgrid' };
}

async function testSendGrid(config: MailConnectionConfig): Promise<TestResult> {
  const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
    headers: { Authorization: `Bearer ${config.api_key}` },
  });
  const data = await readJson(response);
  if (!response.ok) return { ok: false, error: httpError(data, 'SendGrid') };
  return { ok: true, detail: `Cuenta SendGrid OK (${data?.username || data?.email || 'perfil'}).` };
}

/* ------------------------------------------------------------------ */
/* Mailgun                                                              */
/* ------------------------------------------------------------------ */

function mailgunBase(config: MailConnectionConfig): string {
  return config.region === 'eu'
    ? 'https://api.eu.mailgun.net'
    : 'https://api.mailgun.net';
}

async function sendMailgun(
  config: MailConnectionConfig,
  message: MailMessage
): Promise<SendResult> {
  const body = new URLSearchParams({
    from: `${message.fromName} <${message.fromEmail}>`,
    to: message.to,
    subject: message.subject,
    html: message.html,
  });
  if (message.listUnsubscribe) {
    body.set('h:List-Unsubscribe', message.listUnsubscribe);
  }

  const response = await fetch(`${mailgunBase(config)}/v3/${config.domain}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${config.api_key}`).toString('base64')}`,
    },
    body,
  });

  const data = await readJson(response);
  if (!response.ok) {
    return { ok: false, error: httpError(data, 'Mailgun'), provider: 'mailgun' };
  }
  return { ok: true, messageId: data?.id, provider: 'mailgun' };
}

async function testMailgun(config: MailConnectionConfig): Promise<TestResult> {
  const response = await fetch(`${mailgunBase(config)}/v3/${config.domain}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${config.api_key}`).toString('base64')}`,
    },
  });
  const data = await readJson(response);
  if (!response.ok) return { ok: false, error: httpError(data, 'Mailgun') };
  return { ok: true, detail: `Dominio Mailgun OK (${config.domain}).` };
}

/* ------------------------------------------------------------------ */
/* Resend                                                               */
/* ------------------------------------------------------------------ */

async function sendResend(
  config: MailConnectionConfig,
  message: MailMessage
): Promise<SendResult> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.api_key}`,
    },
    body: JSON.stringify({
      from: `${message.fromName} <${message.fromEmail}>`,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      headers: listUnsubscribeHeaders(message),
    }),
  });

  const data = await readJson(response);
  if (!response.ok) {
    return { ok: false, error: httpError(data, 'Resend'), provider: 'resend' };
  }
  return { ok: true, messageId: data?.id, provider: 'resend' };
}

async function testResend(config: MailConnectionConfig): Promise<TestResult> {
  const response = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${config.api_key}` },
  });
  const data = await readJson(response);
  if (!response.ok) return { ok: false, error: httpError(data, 'Resend') };
  const count = Array.isArray(data?.data) ? data.data.length : 0;
  return { ok: true, detail: `Resend OK (${count} dominio(s) registrados).` };
}

/* ------------------------------------------------------------------ */
/* Mailchimp (Mandrill)                                                 */
/* ------------------------------------------------------------------ */

async function sendMandrill(
  config: MailConnectionConfig,
  message: MailMessage
): Promise<SendResult> {
  const response = await fetch('https://mandrillapp.com/api/1.0/messages/send.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: config.api_key,
      message: {
        from_email: message.fromEmail,
        from_name: message.fromName,
        to: [{ email: message.to, name: message.toName || undefined, type: 'to' }],
        subject: message.subject,
        html: message.html,
        headers: listUnsubscribeHeaders(message),
        track_opens: true,
        track_clicks: true,
      },
    }),
  });

  const data = await readJson(response);
  if (!response.ok) {
    return { ok: false, error: httpError(data, 'Mandrill'), provider: 'mandrill' };
  }
  const item = Array.isArray(data) ? data[0] : data;
  if (item?.status === 'rejected' || item?.status === 'invalid') {
    return { ok: false, error: item?.reject_reason || 'Mandrill rechazó el envío', provider: 'mandrill' };
  }
  return { ok: true, messageId: item?._id, provider: 'mandrill' };
}

async function testMandrill(config: MailConnectionConfig): Promise<TestResult> {
  const response = await fetch('https://mandrillapp.com/api/1.0/users/ping.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: config.api_key }),
  });
  const text = await response.text();
  if (!response.ok || !text.includes('PONG')) {
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    return { ok: false, error: httpError(data, 'Mandrill') };
  }
  return { ok: true, detail: 'Mandrill OK (PONG).' };
}

/* ------------------------------------------------------------------ */
/* SMTP2GO                                                              */
/* ------------------------------------------------------------------ */

async function sendSmtp2Go(
  config: MailConnectionConfig,
  message: MailMessage
): Promise<SendResult> {
  const customHeaders: Array<{ header: string; value: string }> = [];
  if (message.listUnsubscribe) {
    customHeaders.push({ header: 'List-Unsubscribe', value: message.listUnsubscribe });
  }
  if (message.listUnsubscribeOneClick) {
    customHeaders.push({ header: 'List-Unsubscribe-Post', value: 'List-Unsubscribe=One-Click' });
  }

  const response = await fetch('https://api.smtp2go.com/v3/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: config.api_key,
      to: [message.to],
      sender: `${message.fromName} <${message.fromEmail}>`,
      subject: message.subject,
      html_body: message.html,
      custom_headers: customHeaders.length ? customHeaders : undefined,
    }),
  });

  const data = await readJson(response);
  if (!response.ok) {
    return { ok: false, error: httpError(data, 'SMTP2GO'), provider: 'smtp2go' };
  }
  return { ok: true, messageId: data?.data?.email_id, provider: 'smtp2go' };
}

async function testSmtp2Go(config: MailConnectionConfig): Promise<TestResult> {
  if (!config.api_key) return { ok: false, error: 'Falta la API Key.' };
  return { ok: true, detail: 'API Key cargada. SMTP2GO no expone endpoint de prueba; envía una campaña de prueba.' };
}

/* ------------------------------------------------------------------ */
/* Amazon SES (API v2)                                                  */
/* ------------------------------------------------------------------ */

function sesClient(config: MailConnectionConfig): SESv2Client {
  return new SESv2Client({
    region: config.aws_region || 'us-east-1',
    credentials: {
      accessKeyId: config.aws_access_key_id || '',
      secretAccessKey: config.aws_secret_access_key || '',
    },
  });
}

async function sendSes(
  config: MailConnectionConfig,
  message: MailMessage
): Promise<SendResult> {
  try {
    const client = sesClient(config);
    const headers: Array<{ Name: string; Value: string }> = [];
    if (message.listUnsubscribe) {
      headers.push({ Name: 'List-Unsubscribe', Value: message.listUnsubscribe });
    }
    if (message.listUnsubscribeOneClick) {
      headers.push({ Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' });
    }

    const result = await client.send(
      new SendEmailCommand({
        FromEmailAddress: `${message.fromName} <${message.fromEmail}>`,
        Destination: { ToAddresses: [message.to] },
        Content: {
          Simple: {
            Subject: { Data: message.subject, Charset: 'UTF-8' },
            Body: { Html: { Data: message.html, Charset: 'UTF-8' } },
            Headers: headers.length ? headers : undefined,
          },
        },
      })
    );

    return { ok: true, messageId: result.MessageId, provider: 'ses' };
  } catch (error: any) {
    console.error('[mail] ses send:', error?.message || error);
    return { ok: false, error: error?.message || 'Error de Amazon SES', provider: 'ses' };
  }
}

async function testSes(config: MailConnectionConfig): Promise<TestResult> {
  try {
    const client = sesClient(config);
    const account = await client.send(new GetAccountCommand({}));
    const quota = account.SendQuota;
    if (!quota) {
      return { ok: false, error: 'No se pudo leer la cuota de SES para esta cuenta/región.' };
    }
    const max24 = Math.round(quota.Max24HourSend ?? 0);
    const sent24 = Math.round(quota.SentLast24Hours ?? 0);
    const rate = quota.MaxSendRate ?? 0;
    return {
      ok: true,
      detail: `SES OK — cuota 24h: ${max24.toLocaleString('es-MX')}, enviados: ${sent24.toLocaleString('es-MX')}, tasa: ${rate}/s.${account.SendingEnabled === false ? ' OJO: SES tiene el envío DESHABILITADO en esta cuenta/región.' : ''}`,
    };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'No se pudo consultar la cuota de SES.' };
  }
}

/* ------------------------------------------------------------------ */
/* Genérica (HTTP propio)                                               */
/* ------------------------------------------------------------------ */

async function sendHttp(
  config: MailConnectionConfig,
  message: MailMessage
): Promise<SendResult> {
  if (!config.endpoint) return { ok: false, error: 'Falta el endpoint.', provider: 'http' };

  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.headers_json) {
    try {
      const parsed = JSON.parse(config.headers_json);
      if (parsed && typeof parsed === 'object') headers = { ...headers, ...parsed };
    } catch {
      return { ok: false, error: 'headers_json no es un JSON válido.', provider: 'http' };
    }
  }

  const template = config.body_template ||
    '{"from":"{{from_email}}","to":["{{to_email}}"],"subject":"{{subject}}","html":"{{html}}"}';

  const replacements: Record<string, string> = {
    from_email: message.fromEmail,
    from_name: message.fromName,
    to_email: message.to,
    to_name: message.toName || message.to,
    subject: message.subject,
    html: message.html,
    list_unsubscribe: message.listUnsubscribe || '',
  };

  let body = template;
  for (const [key, value] of Object.entries(replacements)) {
    body = body.split(`{{${key}}}`).join(escapeJsonString(value || ''));
  }

  try {
    const response = await fetch(config.endpoint, {
      method: (config.method || 'post').toUpperCase(),
      headers,
      body,
    });

    const data = await readJson(response);
    if (!response.ok) {
      return { ok: false, error: httpError(data, 'HTTP genérico'), provider: 'http' };
    }
    return { ok: true, messageId: data?.id || data?.message_id, provider: 'http' };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'Error en el endpoint.', provider: 'http' };
  }
}

async function testHttp(config: MailConnectionConfig): Promise<TestResult> {
  if (!config.endpoint) return { ok: false, error: 'Falta el endpoint.' };
  try {
    new URL(config.endpoint);
  } catch {
    return { ok: false, error: 'El endpoint no es una URL válida.' };
  }
  return {
    ok: true,
    detail: 'Endpoint configurado. No se hizo ningún envío de prueba (revisa tu API).',
  };
}

/* ------------------------------------------------------------------ */
/* Entrada única                                                        */
/* ------------------------------------------------------------------ */

export async function sendCampaignEmail(
  connection: MailConnectionRecord,
  message: MailMessage,
  channel: 'smtp' | 'api' | 'auto' = 'auto'
): Promise<SendResult> {
  const config = decryptMailConfig(connection.config);
  const provider = connection.proveedor;

  const hasSmtp = Boolean(config.smtp_host && config.smtp_user && config.smtp_pass);
  const wantsSmtp =
    channel === 'smtp' ||
    (channel === 'auto' && provider !== 'http' && ['mailrelay', 'mailerlite', 'zoho'].includes(provider));

  if (wantsSmtp || (!config.api_key && hasSmtp && ['brevo', 'sendgrid', 'mailgun', 'smtp2go', 'ses'].includes(provider) && channel !== 'api')) {
    if (hasSmtp) return sendSmtp(config, message);
  }

  switch (provider) {
    case 'brevo':
      return config.api_key ? sendBrevo(config, message) : sendSmtp(config, message);
    case 'sendgrid':
      return config.api_key ? sendSendGrid(config, message) : sendSmtp(config, message);
    case 'mailgun':
      return config.api_key && config.domain ? sendMailgun(config, message) : sendSmtp(config, message);
    case 'mailrelay':
    case 'mailerlite':
    case 'zoho':
      return sendSmtp(config, message);
    case 'mandrill':
      return sendMandrill(config, message);
    case 'resend':
      return sendResend(config, message);
    case 'smtp2go':
      return config.api_key ? sendSmtp2Go(config, message) : sendSmtp(config, message);
    case 'ses':
      return config.aws_access_key_id && config.aws_secret_access_key
        ? sendSes(config, message)
        : sendSmtp(config, message);
    case 'http':
      return sendHttp(config, message);
    default:
      return { ok: false, error: `Proveedor no soportado: ${provider}`, provider };
  }
}

export async function testConnection(
  connection: MailConnectionRecord
): Promise<TestResult> {
  const config = decryptMailConfig(connection.config);
  const provider = connection.proveedor;

  // SMTP tiene prioridad para los proveedores orientados a SMTP.
  const wantsSmtp = ['mailrelay', 'mailerlite', 'zoho'].includes(provider);
  if (wantsSmtp || (config.smtp_host && !config.api_key && ['brevo', 'sendgrid', 'mailgun', 'smtp2go', 'ses'].includes(provider))) {
    return testSmtp(config);
  }

  switch (provider) {
    case 'brevo':
      return config.api_key ? testBrevo(config) : testSmtp(config);
    case 'sendgrid':
      return config.api_key ? testSendGrid(config) : testSmtp(config);
    case 'mailgun':
      return config.api_key && config.domain ? testMailgun(config) : testSmtp(config);
    case 'mandrill':
      return testMandrill(config);
    case 'resend':
      return testResend(config);
    case 'smtp2go':
      return config.api_key ? testSmtp2Go(config) : testSmtp(config);
    case 'ses':
      return config.aws_access_key_id
        ? testSes(config)
        : config.smtp_host
          ? testSmtp(config)
          : { ok: false, error: 'Configura las credenciales AWS o SMTP de SES.' };
    case 'http':
      return testHttp(config);
    default:
      return { ok: false, error: `Proveedor no soportado: ${provider}` };
  }
}
