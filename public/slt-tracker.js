(function () {
  'use strict';

  var SCRIPT_TAG =
    document.currentScript ||
    document.querySelector('script[data-site-id][data-host]');
  var SITE_ID = SCRIPT_TAG ? SCRIPT_TAG.getAttribute('data-site-id') : null;
  var API_HOST = SCRIPT_TAG ? SCRIPT_TAG.getAttribute('data-host') || '' : '';
  var STORAGE_KEY = 'slt_vid';
  var SESSION_KEY = 'slt_sid';
  var LANDING_KEY = 'slt_landing';
  var HONEYPOT_FIELD = 'hp';
  var UTM_KEYS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
  ];

  if (!SITE_ID) {
    console.warn('[SLT Tracker] Atributo data-site-id faltante.');
    return;
  }

  // Descartar bots conocidos en el cliente
  function isBot() {
    try {
      if (navigator.webdriver) return true;
      var ua = (navigator.userAgent || '').toLowerCase();
      if (/bot|crawl|spider|slurp|mediapartners|facebookexternalhit|headless|phantom|selenium|puppeteer/i.test(ua)) {
        return true;
      }
      // Señales típicas de automatización
      if (window.callPhantom || window._phantom || window.__nightmare) return true;
    } catch (e) {}
    return false;
  }

  if (isBot()) {
    // No registrar tráfico de bots
    return;
  }

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getVisitorId() {
    var vid = null;
    try {
      vid = localStorage.getItem(STORAGE_KEY);
      if (!vid) {
        vid = generateUUID();
        localStorage.setItem(STORAGE_KEY, vid);
      }
    } catch (e) {
      vid = generateUUID();
    }
    return vid;
  }

  function getSessionId() {
    try {
      var sid = sessionStorage.getItem(SESSION_KEY);
      if (!sid) {
        sid = generateUUID();
        sessionStorage.setItem(SESSION_KEY, sid);
      }
      return sid;
    } catch (e) {
      return generateUUID();
    }
  }

  function getLandingUrl() {
    try {
      var landing = sessionStorage.getItem(LANDING_KEY);
      if (!landing) {
        landing = window.location.href;
        sessionStorage.setItem(LANDING_KEY, landing);
      }
      return landing;
    } catch (e) {
      return window.location.href;
    }
  }

  function getUtm() {
    var out = {};
    try {
      var params = new URLSearchParams(window.location.search);
      for (var i = 0; i < UTM_KEYS.length; i++) {
        var value = params.get(UTM_KEYS[i]);
        if (value) out[UTM_KEYS[i]] = value.slice(0, 200);
      }
    } catch (e) {}
    return out;
  }

  // ------------------------------------------------------------------
  // Fingerprint: hash estable de señales técnicas. Debe coincidir con
  // lib/fingerprint.ts para unir visitas y envíos del mismo dispositivo.
  // ------------------------------------------------------------------
  function hashString(input) {
    var hash = 2166136261;
    for (var i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }

  function canvasSignal() {
    try {
      var canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 40;
      var ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 100, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('SLT-fp-ñ-λ-😀', 2, 2);
      return canvas.toDataURL().slice(-80);
    } catch (e) {
      return '';
    }
  }

  var cachedFingerprint = null;

  function getFingerprint() {
    if (cachedFingerprint) return cachedFingerprint;
    try {
      var nav = navigator;
      var languages = Array.isArray(nav.languages) ? nav.languages.join(',') : '';
      var timezone = '';
      try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      } catch (e) {}

      var signals = [
        nav.userAgent || '',
        nav.language || '',
        languages,
        nav.platform || '',
        nav.hardwareConcurrency || '',
        nav.deviceMemory || '',
        screen.width || '',
        screen.height || '',
        screen.colorDepth || '',
        window.devicePixelRatio || '',
        new Date().getTimezoneOffset(),
        timezone,
        canvasSignal(),
      ].join('|');

      cachedFingerprint = 'fp_' + hashString(signals) + hashString('slt|' + signals);
      return cachedFingerprint;
    } catch (e) {
      return '';
    }
  }

  function getContext() {
    var utm = getUtm();
    return {
      visitorId: getVisitorId(),
      siteId: SITE_ID,
      fingerprint: getFingerprint(),
      pageUrl: window.location.href,
      pageTitle: document.title || '',
      referrer: document.referrer || '',
      landingUrl: getLandingUrl(),
      utm: utm,
    };
  }

  function sendEvent(eventType, customData) {
    var visitorId = getVisitorId();
    var utm = getUtm();
    var payload = {
      site_id: SITE_ID,
      visitor_id: visitorId,
      event_type: eventType || 'pageview',
      url: window.location.href,
      contact_id: (customData && customData.contact_id) || null,
      referrer: document.referrer || null,
      landing_url: getLandingUrl(),
      utm_source: utm.utm_source || null,
      utm_medium: utm.utm_medium || null,
      utm_campaign: utm.utm_campaign || null,
      utm_term: utm.utm_term || null,
      utm_content: utm.utm_content || null,
      fingerprint: getFingerprint() || null,
      metadata: {
        session_id: getSessionId(),
        page_title: document.title || '',
        screen: (screen.width || 0) + 'x' + (screen.height || 0),
        viewport: (window.innerWidth || 0) + 'x' + (window.innerHeight || 0),
      },
      // Honey pot: debe viajar vacío. Los bots que llamen directo al API sin este campo o con valor serán descartados.
      hp: (customData && customData.hp) || '',
    };

    var endpoint = (API_HOST ? API_HOST.replace(/\/$/, '') : '') + '/api/track';
    var dataStr = JSON.stringify(payload);

    // Usamos text/plain para evitar el preflight CORS (petición simple).
    // El API lee el body como texto y lo parsea como JSON.
    if (navigator.sendBeacon) {
      var blob = new Blob([dataStr], { type: 'text/plain;charset=UTF-8' });
      navigator.sendBeacon(endpoint, blob);
    } else {
      fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: dataStr,
        keepalive: true,
      }).catch(function (err) {
        console.error('[SLT Tracker] Error:', err);
      });
    }
  }

  window.slt = window.slt || {
    track: function (eventType, data) {
      sendEvent(eventType, data);
    },
    getVisitorId: getVisitorId,
    getSessionId: getSessionId,
    getFingerprint: getFingerprint,
    getContext: getContext,
    siteId: SITE_ID,
  };

  if (document.readyState === 'complete') {
    sendEvent('pageview');
  } else {
    window.addEventListener('load', function () {
      sendEvent('pageview');
    });
  }
})();
