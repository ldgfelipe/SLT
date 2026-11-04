(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var formId = script.getAttribute('data-form-id');
  if (!formId) {
    console.warn('[SLT Form] Falta el atributo data-form-id.');
    return;
  }

  // Evita duplicados si el script se carga dos veces.
  if (document.querySelector('iframe[data-slt-form-id="' + formId + '"]')) return;

  var base = script.getAttribute('data-host');
  if (!base) {
    var parts = (script.src || '').split('/');
    base = parts.slice(0, 3).join('/');
  }
  base = (base || '').replace(/\/$/, '');
  if (!base) {
    console.warn('[SLT Form] No se pudo determinar el servidor. Usa data-host.');
    return;
  }

  var origin;
  try {
    origin = new URL(base).origin;
  } catch (e) {
    console.warn('[SLT Form] data-host inválido:', base);
    return;
  }

  var minHeight = parseInt(script.getAttribute('data-min-height') || '', 10);
  if (!minHeight || minHeight < 160) minHeight = 420;

  var iframe = document.createElement('iframe');
  iframe.src = base + '/f/' + encodeURIComponent(formId) + '?embed=1';
  iframe.title = script.getAttribute('data-title') || 'Formulario';
  iframe.loading = 'lazy';
  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('data-slt-form-id', formId);
  iframe.style.cssText =
    'width:100%;max-width:100%;border:0;display:block;overflow:hidden;min-height:' +
    minHeight +
    'px;background:transparent;';

  function mount(node) {
    if (!node) return false;
    node.appendChild(iframe);
    return true;
  }

  var targetSelector = script.getAttribute('data-target');
  var target = targetSelector ? document.querySelector(targetSelector) : null;

  if (target) {
    mount(target);
  } else if (script.parentNode && script.parentNode.nodeName !== 'HEAD') {
    script.parentNode.insertBefore(iframe, script.nextSibling);
  } else if (document.body) {
    mount(document.body);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      mount(document.body);
    });
  }

  function postVisitor() {
    try {
      var slt = window.slt;
      if (slt && slt.getVisitorId && iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          {
            type: 'slt-visitor',
            visitorId: slt.getVisitorId(),
            siteId: slt.siteId || null,
          },
          origin
        );
      }
    } catch (e) {
      // sin píxel o sin permiso
    }
  }

  iframe.addEventListener('load', function () {
    postVisitor();
    setTimeout(postVisitor, 600);
    setTimeout(postVisitor, 2000);
  });

  window.addEventListener('load', postVisitor);

  window.addEventListener('message', function (event) {
    if (event.origin !== origin) return;
    var data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'slt-form-height') {
      var height = parseInt(data.height, 10);
      if (height > 0) iframe.style.height = height + 'px';
      return;
    }

    if (data.type === 'slt-form-redirect' && typeof data.url === 'string') {
      if (/^https?:\/\//i.test(data.url)) {
        window.location.href = data.url;
      }
    }
  });
})();
