import type { FormField } from '@/types/forms';

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inputTypeFor(field: FormField): string {
  switch (field.type) {
    case 'email':
    case 'tel':
    case 'number':
    case 'date':
      return field.type;
    default:
      return 'text';
  }
}

function renderField(field: FormField, formId: string): string {
  const key = escapeHtml(field.key);
  const inputId = escapeHtml(`slt_${formId}_${field.key}`);
  const label = escapeHtml(field.label || field.key);
  const placeholder = escapeHtml(field.placeholder || '');
  const required = field.required ? ' required' : '';
  const requiredMark = field.required
    ? '<span class="slt-required" aria-hidden="true">*</span>'
    : '';
  const full = field.type === 'textarea' || field.type === 'checkbox' ? ' slt-full' : '';

  if (field.type === 'textarea') {
    return `<div class="slt-field${full}"><label class="slt-label" for="${inputId}">${label}${requiredMark}</label><textarea id="${inputId}" name="${key}" placeholder="${placeholder}" rows="3"${required}></textarea></div>`;
  }

  if (field.type === 'select') {
    const options = (field.options || [])
      .map(
        (option) =>
          `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`
      )
      .join('');
    return `<div class="slt-field${full}"><label class="slt-label" for="${inputId}">${label}${requiredMark}</label><select id="${inputId}" name="${key}"${required}><option value="">Selecciona una opción</option>${options}</select></div>`;
  }

  if (field.type === 'checkbox') {
    return `<div class="slt-field${full}"><label class="slt-check"><input type="checkbox" name="${key}" value="Sí"${required} /><span>${label}${requiredMark}</span></label></div>`;
  }

  return `<div class="slt-field${full}"><label class="slt-label" for="${inputId}">${label}${requiredMark}</label><input id="${inputId}" type="${inputTypeFor(field)}" name="${key}" placeholder="${placeholder}"${required} /></div>`;
}

function scopedStyles(formId: string): string {
  const scope = `#slt_f_${formId}`;
  return [
    `${scope}{--slt-primary:#4f46e5;--slt-border:#cbd5e1;--slt-text:#0f172a;font-family:inherit;max-width:640px;margin:0 auto;color:var(--slt-text)}`,
    `${scope} *{box-sizing:border-box}`,
    `${scope} .slt-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}`,
    `${scope} .slt-field{display:flex;flex-direction:column;gap:6px}`,
    `${scope} .slt-full{grid-column:1 / -1}`,
    `${scope} .slt-label{font-size:13px;font-weight:600;color:#334155;line-height:1.3}`,
    `${scope} .slt-required{color:#e11d48;margin-left:2px}`,
    `${scope} input:not([type="checkbox"]),${scope} select,${scope} textarea{width:100%;padding:10px 12px;border:1px solid var(--slt-border);border-radius:10px;background:#fff;color:var(--slt-text);font-size:14px;font-family:inherit;line-height:1.4;outline:none;transition:border-color .15s ease,box-shadow .15s ease}`,
    `${scope} input::placeholder,${scope} textarea::placeholder{color:#94a3b8}`,
    `${scope} input:focus,${scope} select:focus,${scope} textarea:focus{border-color:var(--slt-primary);box-shadow:0 0 0 3px rgba(79,70,229,.16)}`,
    `${scope} textarea{min-height:90px;resize:vertical}`,
    `${scope} .slt-check{display:flex;align-items:center;gap:9px;font-size:13px;color:#334155;cursor:pointer}`,
    `${scope} .slt-check input{width:16px;height:16px;accent-color:var(--slt-primary)}`,
    `${scope} .slt-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}`,
    `${scope} button[type="submit"]{width:100%;margin-top:18px;padding:12px 20px;border:0;border-radius:10px;background:var(--slt-primary);color:#fff;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s ease,transform .1s ease}`,
    `${scope} button[type="submit"]:hover{background:#4338ca}`,
    `${scope} button[type="submit"]:active{transform:translateY(1px)}`,
    `${scope} button[type="submit"]:disabled{opacity:.65;cursor:not-allowed}`,
    `${scope} .slt-feedback{margin:12px 0 0;padding:11px 14px;border-radius:10px;font-size:13.5px;line-height:1.45;border:1px solid transparent}`,
    `${scope} .slt-feedback:empty{display:none}`,
    `${scope} .slt-feedback.slt-ok{background:#ecfdf5;border-color:#a7f3d0;color:#047857}`,
    `${scope} .slt-feedback.slt-error{background:#fff1f2;border-color:#fecdd3;color:#be123c}`,
    `@media (max-width:560px){${scope} .slt-fields{grid-template-columns:1fr;gap:12px}${scope} button[type="submit"]{padding:12px 16px}}`,
    `@media (prefers-color-scheme:dark){${scope}{--slt-border:#475569;--slt-text:#e2e8f0}${scope} input:not([type="checkbox"]),${scope} select,${scope} textarea{background:#1e293b;color:#e2e8f0}${scope} .slt-label,${scope} .slt-check{color:#cbd5e1}}`,
  ].join('\n');
}

/** Genera un snippet HTML autocontenido, accesible y responsive para un formulario. */
export function buildFormHtml(options: {
  formId: string;
  fields: FormField[];
  serverUrl?: string;
}): string {
  const formId = options.formId;
  const base = resolveServerUrl(options.serverUrl);
  const endpoint = `${base}/api/forms/${formId}/submit`;
  const fields = options.fields.length ? options.fields : [];
  const fieldsHtml = fields.map((field) => renderField(field, formId)).join('\n      ');

  const markup = `<div class="slt-form-container">
    <form id="slt_f_${escapeHtml(formId)}" method="POST" action="${escapeHtml(endpoint)}">
      <div class="slt-fields">
      ${fieldsHtml}
      </div>
      <div class="slt-hp" aria-hidden="true">
        <label>No completar este campo<input type="text" name="hp" tabindex="-1" autocomplete="off" /></label>
      </div>
      <button type="submit">Enviar</button>
      <p class="slt-feedback" role="status" aria-live="polite"></p>
    </form>
  </div>`;

  const script = `<script>
(function () {
  var form = document.getElementById('slt_f_${formId}');
  if (!form) return;
  var feedback = form.querySelector('.slt-feedback');
  var button = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    feedback.textContent = '';
    feedback.className = 'slt-feedback';

    var data = new FormData(form);
    try {
      if (window.slt && window.slt.getVisitorId && !data.get('visitor_id')) {
        data.set('visitor_id', window.slt.getVisitorId());
      }
      if (window.slt && window.slt.siteId && !data.get('site_id')) {
        data.set('site_id', window.slt.siteId);
      }
    } catch (e) {}

    var originalText = button ? button.textContent : '';
    if (button) { button.disabled = true; button.textContent = 'Enviando…'; }

    fetch(${JSON.stringify(endpoint)}, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams(data)
    })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (json) {
          return { ok: response.ok, json: json };
        });
      })
      .then(function (result) {
        var json = result.json || {};
        if (!result.ok || json.success === false) {
          throw new Error(json.error || 'No se pudo enviar el formulario.');
        }
        if (json.redirect_url) { window.location.href = json.redirect_url; return; }
        form.reset();
        feedback.className = 'slt-feedback slt-ok';
        feedback.textContent = json.message || '¡Gracias! Hemos recibido tus datos.';
      })
      .catch(function (error) {
        feedback.className = 'slt-feedback slt-error';
        feedback.textContent = (error && error.message) || 'Ocurrió un error. Intenta de nuevo.';
      })
      .finally(function () {
        if (button) { button.disabled = false; button.textContent = originalText; }
      });
  });
})();
</script>`;

  return `<!-- SLT Form: ${escapeHtml(formId)} -->
<style>
${scopedStyles(formId)}
</style>
${markup}
${script}`;
}
