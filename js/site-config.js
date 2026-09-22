/* =========================================================
   BRAIN — Configuration publique du site (frontend)
   ⚠️  Contient UNIQUEMENT des données publiques.
   Jamais de clé privée (VAPID privé = env Netlify uniquement).
   ========================================================= */
window.BRAIN_CONFIG = window.BRAIN_CONFIG || {};

(function () {
  var cfg = window.BRAIN_CONFIG;

  /* ---- Notifications Web Push (VAPID) ---- */
  cfg.api = cfg.api || {
    /* Clé publique VAPID — sûre côté client. */
    vapidPublicKey: 'BED2BUGvjAoWuoWGim_Bitjb3EXdOEp5vS4M-nq1oyrLS9iXpMrzluzYo6xzcTFCk_Zd9p8p21x-lpmxGEvdlgQ',
    /* Endpoints Netlify Functions (relatifs) */
    subscribeEndpoint: '/.netlify/functions/push-subscribe',
    trackEndpoint: '/.netlify/functions/analytics-track',
    notifyClickEndpoint: '/.netlify/functions/notify-click'
  };

  /* ---- Service worker ---- */
  cfg.swUrl = cfg.swUrl || '/sw.js';

  /* ---- Analytics : durée de session (ms) ---- */
  cfg.session = cfg.session || {
    timeoutMs: 30 * 60 * 1000,   /* 30 min d'inactivité => nouvelle session */
    heartbeatMs: 60 * 1000,      /* battement de cœur pour "en direct" */
    liveWindowMs: 15 * 60 * 1000 /* fenêtre "visiteurs en direct" (server) */
  };

  /* ---- Notifications UI ---- */
  cfg.pushUI = cfg.pushUI || {
    delayMs: 6000,          /* délai avant affichage de la proposition */
    laterDays: 7,           /* "Plus tard" => rappel après 7 jours */
    dismissedDays: 365      /* "X" => fermeture définitive */
  };

  /* ---- Consentement cookies / RGPD ---- */
  cfg.consent = cfg.consent || {
    storageKey: 'brain_consent_v1',
    refusalKey: 'brain_push_dismissed'
  };

  /* ---- Clés stockage de session -------------------------
     (analytics.js / consent.js s'appuient sur celles-ci)  -- */
  cfg.keyNames = cfg.keyNames || {
    anonymousId: 'brain_anon_id',
    sessionId: 'brain_session_id'
  };
})();