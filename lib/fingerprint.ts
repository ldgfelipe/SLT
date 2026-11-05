// Debe mantenerse en sincronía con public/slt-tracker.js
// (mismos signals y mismo hash para que el journey una visitas y envíos).

function hashString(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function canvasSignal(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 100, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('SLT-fp-ñ-λ-😀', 2, 2);
    return canvas.toDataURL().slice(-80);
  } catch {
    return '';
  }
}

/**
 * Huella técnica del navegador (hash, no datos crudos). Sirve para reconocer
 * al mismo dispositivo aunque borre localStorage o cambie de pestaña.
 */
export function getFingerprint(): string {
  if (typeof window === 'undefined') return '';
  try {
    const nav = window.navigator as Navigator & { deviceMemory?: number };
    const languages = Array.isArray(nav.languages) ? nav.languages.join(',') : '';
    let timezone = '';
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {
      // sin Intl
    }

    const signals = [
      nav.userAgent || '',
      nav.language || '',
      languages,
      nav.platform || '',
      nav.hardwareConcurrency || '',
      nav.deviceMemory || '',
      window.screen?.width || '',
      window.screen?.height || '',
      window.screen?.colorDepth || '',
      window.devicePixelRatio || '',
      new Date().getTimezoneOffset(),
      timezone,
      canvasSignal(),
    ].join('|');

    return `fp_${hashString(signals)}${hashString('slt|' + signals)}`;
  } catch {
    return '';
  }
}
