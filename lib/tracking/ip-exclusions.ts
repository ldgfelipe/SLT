/**
 * Exclusiones de IP para el Pixel de tracking.
 *
 * Formatos admitidos (por cliente):
 *   - IP exacta:     `201.120.45.9` o `2806:262:...:abcd`
 *   - Prefijo IPv4:  `192.168.1.`  (excluye todo el rango)
 *   - Prefijo IPv4:  `192.168.*`   (equivalente, comodín)
 *   - Prefijo IPv6:  `2607:f8b0:`  (excluye todo el bloque)
 */

export interface IpExclusionRow {
  pattern: string;
}

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  patterns: IpExclusionRow[];
  expires: number;
}

const cache = new Map<string, CacheEntry>();

export function normalizeIp(raw: string | null | undefined): string {
  if (!raw) return '';
  let ip = raw.trim();

  // x-forwarded-for puede traer varias IPs: la primera es la real.
  if (ip.includes(',')) ip = ip.split(',')[0].trim();

  // IPv4-mapped IPv6 (::ffff:201.120.45.9)
  ip = ip.replace(/^::ffff:/i, '');

  // Quitar puerto de IPv4 ("1.2.3.4:8080")
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.split(':')[0];
  }

  return ip.toLowerCase();
}

/** IP del cliente desde los headers del proxy (Vercel / Cloudflare). */
export function extractClientIp(request: Request): string {
  const forwarded =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    '';

  return normalizeIp(forwarded);
}

/** Normaliza un patrón ingresado por el usuario. */
export function normalizePattern(raw: unknown): string | null {
  const pattern = String(raw || '').trim().toLowerCase();

  if (!pattern || pattern.length < 2 || pattern.length > 64) return null;
  if (!/^[0-9a-f.:*]+$/.test(pattern)) return null;

  const mustBePrefix = pattern.endsWith('*');
  let normalized = pattern;
  if (mustBePrefix) normalized = normalized.slice(0, -1);

  // Permitir exactamente una forma: IP completa, prefijo con punto/dos puntos,
  // o comodín final.
  if (mustBePrefix && !normalized.endsWith('.') && !normalized.endsWith(':')) {
    normalized = normalized + '.';
  }

  return normalized;
}

export function isValidExclusionPattern(pattern: string): boolean {
  if (!pattern || pattern.length > 64) return false;
  if (!/^[0-9a-f.:*]+$/.test(pattern)) return false;

  // IPv4 exacto
  const exact = pattern.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (exact) {
    return exact.slice(1).every((octet) => Number(octet) <= 255);
  }

  // Prefijo IPv4 (terminado en punto o comodín)
  if (pattern.includes('*')) {
    if (!pattern.endsWith('*')) return false;
    const core = pattern.slice(0, -1);
    return core
      .replace(/\.$/, '')
      .split('.')
      .every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255);
  }

  if (pattern.endsWith('.')) {
    return pattern
      .slice(0, -1)
      .split('.')
      .every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255);
  }

  // IPv6 exacto o prefijo
  if (pattern.includes(':')) {
    if (!/^[0-9a-f:]+(:|$)/.test(pattern)) return false;
    return true;
  }

  return false;
}

/** ¿El patrón captura a la IP? */
export function matchExclusion(
  ip: string,
  patterns: IpExclusionRow[]
): boolean {
  if (!ip) return false;

  for (const entry of patterns) {
    const pattern = (entry.pattern || '').trim().toLowerCase();
    if (!pattern) continue;

    // Prefijo si termina en '.', ':' o comodín
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      if (ip.startsWith(prefix)) return true;
      continue;
    }

    if (pattern.endsWith('.') || pattern.endsWith(':')) {
      if (ip.startsWith(pattern)) return true;
      continue;
    }

    if (ip === pattern) return true;
  }

  return false;
}

/**
 * ¿Debe descartarse el evento por IP?
 * Consulta las exclusiones del cliente (con caché de 60 s).
 */
export async function isExcludedIp(
  supabase: any,
  clientId: string,
  ip: string
): Promise<boolean> {
  if (!clientId || !ip) return false;

  const now = Date.now();
  const cached = cache.get(clientId);

  if (cached && cached.expires > now) {
    return matchExclusion(ip, cached.patterns);
  }

  const { data, error } = await supabase
    .from('tracking_ip_exclusions')
    .select('pattern')
    .eq('client_id', clientId);

  const patterns: IpExclusionRow[] =
    !error && Array.isArray(data) ? data : [];
  cache.set(clientId, { patterns, expires: now + CACHE_TTL_MS });

  return matchExclusion(ip, patterns);
}
