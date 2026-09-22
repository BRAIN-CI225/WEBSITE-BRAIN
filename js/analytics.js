/* ============================================================
   BRAIN — Analytics visiteurs (privacy-first)
   - anonymous_id aléatoire persisté en localStorage (≠ IP).
   - session_id en sessionStorage (30 min de timeout).
   - Envoi best-effort (fetch keepalive), jamais bloquant.
   - Désactivable par le visiteur via BRAIN_CONFIG.analytics.
   ============================================================ */

(function () {
  if (typeof window === 'undefined') return;
  if (window.__brainAnalyticsLoaded) return;
  window.__brainAnalyticsLoaded = true;

  var cfg = window.BRAIN_CONFIG || {};
  var analyticsParam = cfg.analyticsParams || {};
  var trackUrl = (cfg.api && cfg.api.trackEndpoint) || '/.netlify/functions/analytics-track';
  var consent = window.BRAIN_CONSENT || {};

  /* ---------- Consentement visiteur ---------- */
  function analyticsAllowed() {
    if (typeof consent.isAllowed === 'function') {
      return consent.isAllowed('analytics');
    }
    return false;
  }

  /* ---------- Identifiants ---------- */
  var ANON_KEY = cfg.keyNames ? (cfg.keyNames.anonymousId || 'brain_anon_id') : 'brain_anon_id';
  var SESSION_KEY = cfg.keyNames ? (cfg.keyNames.sessionId || 'brain_session_id') : 'brain_session_id';
  var SESSION_TIMEOUT = (analyticsParam.sessionTimeoutMs || cfg.session && cfg.session.timeoutMs || 30 * 60 * 1000);

  try {
    var anonId = localStorage.getItem(ANON_KEY);
    if (!anonId) {
      anonId = 'a_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(ANON_KEY, anonId);
    }
  } catch (e) { anonId = 'a_' + Math.random().toString(36).slice(2); }

  var sessionId = null;
  var now = Date.now();
  try {
    sessionId = sessionStorage.getItem(SESSION_KEY);
    var sessionStart = parseInt(sessionStorage.getItem(SESSION_KEY + '_t') || '0', 10) || now;
    if (!sessionId || (now - sessionStart > SESSION_TIMEOUT)) {
      sessionId = 's_' + Math.random().toString(36).slice(2) + now.toString(36);
      sessionStorage.setItem(SESSION_KEY, sessionId);
      sessionStorage.setItem(SESSION_KEY + '_t', String(now));
    }
  } catch (e) {
    sessionId = 's_' + Math.random().toString(36).slice(2);
  }

  /* ---------- Détection appareil ---------- */
  var ua = navigator.userAgent || '';
  var deviceType = 'desktop';
  if (/iPhone|iPad|iPod|Android.*Mobile|Mobi/.test(ua)) deviceType = 'mobile';
  else if (/Tablet|iPad|PlayBook/.test(ua)) deviceType = 'tablet';

  function browserName() {
    var m;
    if ((m = ua.match(/Edg\/([\d.]+)/))) return 'Edge';
    if ((m = ua.match(/OPR\/([\d.]+)/))) return 'Opera';
    if ((m = ua.match(/Firefox\/([\d.]+)/))) return 'Firefox';
    if ((m = ua.match(/Chrome\/([\d.]+)/))) return 'Chrome';
    if ((m = ua.match(/Safari\/([\d.]+)/))) return 'Safari';
    return 'Autre';
  }
  function osName() {
    if (/Windows NT/.test(ua)) return 'Windows';
    if (/Android/.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
    if (/Mac OS X/.test(ua)) return 'macOS';
    if (/Linux/.test(ua)) return 'Linux';
    return 'Autre';
  }

  /* ---------- Batterie en direct (60 s) ---------- */
  function heartbeat() {
    if (!analyticsAllowed()) return;
    if ('sendBeacon' in navigator) {
      try {
        navigator.sendBeacon(trackUrl, JSON.stringify({
          anonymous_id: anonId,
          session_id: sessionId,
          page_url: location.pathname + location.search,
          heartbeat: true
        }));
      } catch (e) { /* non bloquant */ }
    }
  }

  /* ---------- Envoi d'une page vue ---------- */
  function trackPage() {
    if (!analyticsAllowed()) return;
    var referrer = '';
    try { referrer = document.referrer || ''; } catch (e) {}

    var params = new URLSearchParams(location.search);
    var payload = {
      anonymous_id: anonId,
      session_id: sessionId,
      page_url: location.pathname + location.search,
      page_title: (document.title || '').slice(0, 300),
      referrer: referrer.slice(0, 512),
      utm_source: (params.get('utm_source') || '').slice(0, 120),
      utm_medium: (params.get('utm_medium') || '').slice(0, 120),
      utm_campaign: (params.get('utm_campaign') || '').slice(0, 160),
      device_type: deviceType,
      browser: browserName(),
      os: osName(),
      language: (navigator.language || '').slice(0, 20)
    };

    try {
      if ('sendBeacon' in navigator) {
        navigator.sendBeacon(trackUrl, new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      } else {
        fetch(trackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) { /* jamais bloquant */ }
  }

  /* ---------- Exposition publique ---------- */
  window.BRAIN_ANALYTICS = {
    anonId: anonId,
    sessionId: sessionId,
    deviceType: deviceType,
    browser: browserName(),
    os: osName(),
    trackPage: trackPage,
    heartbeat: heartbeat
  };

  /* ---------- Démarrage : page vue + heartbeat + SPA ---------- */
  document.addEventListener('DOMContentLoaded', function () { trackPage(); });
  setInterval(heartbeat, (analyticsParam.heartbeatMs || cfg.session && cfg.session.heartbeatMs || 60 * 1000));

  var lastUrl = location.pathname + location.search;
  window.addEventListener('popstate', function () {
    var url = location.pathname + location.search;
    if (url !== lastUrl) { lastUrl = url; trackPage(); }
  });

  /* Re-tracking quand le visiteur accepte les statistiques (ex. modal RGPD) */
  if (typeof consent.onChange === 'function') {
    consent.onChange(function () { if (analyticsAllowed()) trackPage(); });
  }
})();