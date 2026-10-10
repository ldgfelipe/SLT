(function () {
  'use strict';

  var SCRIPT_TAG = document.currentScript;
  var SITE_ID = SCRIPT_TAG ? SCRIPT_TAG.getAttribute('data-site-id') : null;
  var API_HOST = SCRIPT_TAG ? SCRIPT_TAG.getAttribute('data-host') || '' : '';
  var STORAGE_KEY = 'slt_vid';

  if (!SITE_ID) {
    console.warn('[SLT Tracker] Atributo data-site-id faltante.');
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

  function sendEvent(eventType, customData) {
    var visitorId = getVisitorId();
    var payload = {
      site_id: SITE_ID,
      visitor_id: visitorId,
      event_type: eventType || 'pageview',
      url: window.location.href,
      contact_id: (customData && customData.contact_id) || null,
    };

    var endpoint = (API_HOST ? API_HOST.replace(/\/$/, '') : '') + '/api/track';
    var dataStr = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      var blob = new Blob([dataStr], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
    } else {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: dataStr,
        keepalive: true,
      }).catch(function (err) {
        console.error('[SLT Tracker] Error:', err);
      });
    }
  }

  if (document.readyState === 'complete') {
    sendEvent('pageview');
  } else {
    window.addEventListener('load', function () {
      sendEvent('pageview');
    });
  }

  window.slt = window.slt || {
    track: function (eventType, data) {
      sendEvent(eventType, data);
    },
    getVisitorId: getVisitorId,
  };
})();
