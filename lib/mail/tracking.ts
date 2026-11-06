import { getAppUrl } from '@/lib/growth/providers';
import { b64urlEncode, signPayload } from './signature';

export interface TrackedEmailOptions {
  campaignId: string;
  email: string;
  correoBajas?: string | null;
  senderEmail?: string | null;
  /** URL base pública (para los enlaces). Por defecto NEXT_PUBLIC_APP_URL. */
  baseUrl?: string;
  /** Dominio de redirección propio para el tracking de clics (opcional). */
  dominioTracking?: string | null;
}

function baseUrl(options: TrackedEmailOptions): string {
  if (options.dominioTracking) {
    return `https://${options.dominioTracking.replace(/^https?:\/\//, '')}`;
  }
  return options.baseUrl || getAppUrl();
}

async function openPixelUrl(o: TrackedEmailOptions): Promise<string> {
  const message = `open|${o.campaignId}|${o.email.toLowerCase()}`;
  const signature = await signPayload(message);
  return `${baseUrl(o)}/api/mail/open?c=${encodeURIComponent(o.campaignId)}&e=${b64urlEncode(o.email.toLowerCase())}&s=${signature}`;
}

async function clickUrl(target: string, o: TrackedEmailOptions): Promise<string> {
  const message = `click|${o.campaignId}|${target}`;
  const signature = await signPayload(message);
  return `${baseUrl(o)}/api/mail/click?u=${b64urlEncode(target)}&c=${encodeURIComponent(o.campaignId)}&s=${signature}`;
}

export async function unsubscribeUrl(o: TrackedEmailOptions): Promise<string> {
  const message = `baja|${o.campaignId}|${o.email.toLowerCase()}`;
  const signature = await signPayload(message);
  return `${baseUrl(o)}/api/mail/unsubscribe?e=${b64urlEncode(o.email.toLowerCase())}&c=${encodeURIComponent(o.campaignId)}&s=${signature}`;
}

/** Encabezado List-Unsubscribe para los proveedores que lo soporten. */
export async function buildListUnsubscribe(
  o: TrackedEmailOptions
): Promise<{ header: string; oneClick: boolean }> {
  const url = await unsubscribeUrl(o);
  const from = o.correoBajas || o.senderEmail;
  const header = from ? `<mailto:${from}>, <${url}>` : `<${url}>`;
  return { header, oneClick: true };
}

/**
 * Inyecta en el HTML:
 *   - reescritura de enlaces <a href> a través del redireccionador propio
 *   - píxel de apertura invisible
 *   - enlace de baja al pie si no existe
 */
export async function trackEmailHtml(
  html: string,
  options: TrackedEmailOptions
): Promise<{ html: string; listUnsubscribe: string; unsubscribeUrl: string }> {
  let out = html || '';

  // 1. Reescribir enlaces http/https
  const linkPattern = /href=(["'])(https?:\/\/[^"'\s>]+)\1/gi;
  const matches = [...out.matchAll(linkPattern)];

  for (const match of matches) {
    const quote = match[1];
    const target = match[2];
    // No reescribir enlaces ya apuntando a nuestro dominio de tracking
    if (target.includes('/api/mail/click')) continue;
    const tracked = await clickUrl(target, options);
    out = out.split(match[0]).join(`href=${quote}${tracked}${quote}`);
  }

  // 2. Píxel de apertura
  const pixel = `<img src="${await openPixelUrl(options)}" width="1" height="1" alt="" style="display:none;max-height:0;overflow:hidden" />`;

  // 3. Pie de baja (si el HTML no menciona "baja" / "unsubscribe")
  const baja = await unsubscribeUrl(options);
  const hasBaja = /unsubscribe|baja|desuscri|darse de baja/i.test(out);

  const footer = hasBaja
    ? ''
    : `<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;font-family:system-ui,sans-serif">Recibes este correo porque te registraste en nuestro sitio. <a href="${baja}" style="color:#64748b;text-decoration:underline">Darse de baja</a></div>`;

  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${pixel}${footer}</body>`);
  } else {
    out = `${out}${pixel}${footer}`;
  }

  const { header } = await buildListUnsubscribe(options);

  return { html: out, listUnsubscribe: header, unsubscribeUrl: baja };
}
