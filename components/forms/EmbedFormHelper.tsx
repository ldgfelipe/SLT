const DEFAULT_HOST = 'https://slt-xi.vercel.app';

/** Lee los atributos del script del píxel (si existe en la página) para reutilizar host y site_id. */
export function detectServerHostAndSite(): { url: string; siteId: string | null } {
  try {
    const script = document.querySelector('script[data-site-id][data-host]');
    if (script) {
      return {
        url: (script.getAttribute('data-host') || '').replace(/\/$/, ''),
        siteId: script.getAttribute('data-site-id'),
      };
    }
  } catch {
    // entorno sin DOM
  }
  return { url: '', siteId: null };
}

/** Host del servidor donde corre la app (útil para el dashboard). */
export function resolveServerUrl(explicit?: string): string {
  const fromScript = detectServerHostAndSite().url;
  const fromWindow =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';
  return (explicit || fromScript || fromWindow || DEFAULT_HOST).replace(/\/$/, '');
}

/** URL pública del formulario hospedado por SLT. */
export function buildFormUrl(formId: string, serverUrl?: string): string {
  return `${resolveServerUrl(serverUrl)}/f/${formId}`;
}

/**
 * Snippet de una sola línea. El script inserta un iframe con el formulario
 * hospedado y se actualiza solo cuando editas el formulario en SLT.
 */
export function buildEmbedSnippet(formId: string, serverUrl?: string): string {
  const base = resolveServerUrl(serverUrl);
  return `<script src="${base}/slt-form.js" data-form-id="${formId}" async></script>`;
}

/** Alternativa sin JavaScript: iframe de una sola línea. */
export function buildIframeSnippet(formId: string, serverUrl?: string): string {
  const base = resolveServerUrl(serverUrl);
  return `<iframe src="${base}/f/${formId}?embed=1" title="Formulario" loading="lazy" style="width:100%;border:0;min-height:520px"></iframe>`;
}
