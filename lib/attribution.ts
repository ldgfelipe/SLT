import type { Contact, LeadAttribution } from '@/types/database';

/** Claves internas de `contacts.data` que no son campos del formulario. */
export const INTERNAL_CONTACT_DATA_KEYS = [
  '_attribution',
  '_first_touch',
  '_visitor_id',
  '_visitor_ids',
  '_fingerprint',
  '_fingerprints',
] as const;

const INTERNAL_CONTACT_DATA = new Set<string>(INTERNAL_CONTACT_DATA_KEYS);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FINGERPRINT_REGEX = /^fp_[0-9a-f]{8,32}$/i;

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function isFingerprint(value: string): boolean {
  return FINGERPRINT_REGEX.test(value);
}

export function getAttribution(contact?: Contact | null): LeadAttribution | null {
  const raw = contact?.data?._attribution;
  if (!raw || typeof raw !== 'object') return null;
  return raw as LeadAttribution;
}

export function getFirstTouch(contact?: Contact | null): LeadAttribution | null {
  const raw = contact?.data?._first_touch;
  if (!raw || typeof raw !== 'object') return getAttribution(contact);
  return raw as LeadAttribution;
}

export function getVisitorIds(contact?: Contact | null): string[] {
  const data = contact?.data || {};
  const ids = new Set<string>();

  if (typeof data._visitor_id === 'string') ids.add(data._visitor_id);
  if (Array.isArray(data._visitor_ids)) {
    for (const value of data._visitor_ids) {
      if (typeof value === 'string') ids.add(value);
    }
  }

  return Array.from(ids).filter(isUuid);
}

export function getFingerprints(contact?: Contact | null): string[] {
  const data = contact?.data || {};
  const values = new Set<string>();

  if (typeof data._fingerprint === 'string') values.add(data._fingerprint);
  if (Array.isArray(data._fingerprints)) {
    for (const value of data._fingerprints) {
      if (typeof value === 'string') values.add(value);
    }
  }

  return Array.from(values).filter(isFingerprint);
}

/** Datos extra visibles (excluye las claves internas de atribución). */
export function getExternalContactData(contact?: Contact | null): Array<[string, string]> {
  if (!contact?.data) return [];

  return Object.entries(contact.data)
    .filter(([key]) => !INTERNAL_CONTACT_DATA.has(key))
    .map(([key, value]): [string, string] => {
      if (value === null || value === undefined) return [key, ''];
      if (typeof value === 'object') return [key, JSON.stringify(value)];
      return [key, String(value)];
    })
    .filter(([, value]) => value.trim() !== '');
}

export function referrerHost(referrer?: string | null): string {
  if (!referrer) return '';
  try {
    return new URL(referrer).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

const SEARCH_HOSTS =
  /(^|\.)(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia|ask|aol)\./i;

export type AttributionKind = 'paid' | 'organic' | 'referral' | 'direct' | 'form';

export interface AttributionSummary {
  label: string;
  kind: AttributionKind;
  detail?: string;
  host?: string;
}

/** Resume el origen del lead para mostrarlo en tarjetas y fichas. */
export function describeAttribution(
  attribution?: LeadAttribution | null
): AttributionSummary {
  if (!attribution) {
    return { label: 'Sin origen', kind: 'form' };
  }

  const medium = (attribution.utm_medium || '').toLowerCase();
  if (attribution.utm_source) {
    return {
      label: attribution.utm_medium
        ? `${attribution.utm_source} · ${attribution.utm_medium}`
        : attribution.utm_source,
      kind: /cpc|ppc|paid|display|social|email/.test(medium) ? 'paid' : 'organic',
      detail: attribution.utm_campaign || attribution.placement || undefined,
    };
  }

  const host = referrerHost(attribution.referrer);
  if (host) {
    return {
      label: host,
      kind: SEARCH_HOSTS.test(host) ? 'organic' : 'referral',
      detail: attribution.placement || attribution.utm_campaign || undefined,
      host,
    };
  }

  return {
    label: attribution.placement ? `Directo · ${attribution.placement}` : 'Directo',
    kind: 'direct',
  };
}
