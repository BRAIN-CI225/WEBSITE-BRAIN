/* ============================================================
   BRAIN — Notifications Web Push (frontend)
   - Affiche une cloche 🔔 d'invitation après un délai.
   - Gère consentement RGPD → inscription VAPID → endpoint
     serveur (push-subscribe) + désinscription.
   - Recharge les préférences depuis localStorage.
   Depuis : /·/   Ne stocke JAMAIS de clé privée.
   ============================================================ */

(function () {
  if (typeof window === 'undefined') return;
  if (window.__brainNotificationsLoaded) return;
  window.__brainNotificationsLoaded = true;

  var cfg = window.BRAIN_CONFIG || {};
  var api = cfg.api || {};
  var pushUI = cfg.pushUI || {};
  var consent = window.BRAIN_CONSENT || {};

  var SUB_ENDPOINT = api.subscribeEndpoint || '/.netlify/functions/push-subscribe';
  var UNSUB_ENDPOINT = '/.netlify/functions/push-unsubscribe';
  var DELAY_MS = pushUI.delayMs || 6000;
  var LATER_DAYS = pushUI.laterDays || 7;
  var DISMISSED_DAYS = pushUI.dismissedDays || 365;

  var schedulerKey = 'brain_push_later_ts';     // moment où ré-afficher après "Plus tard"
  var dismissedKey = 'brain_push_dismissed_ts'; // moment où ré-afficher après fermeture
  var VAPID = api.vapidPublicKey || '';

  var supported = typeof window !== 'undefined' && 'serviceWorker' in navigator &&
    'PushManager' in window && 'Notification' in window;

  /* ---------- État ---------- */
  function allowPush() {
    return consent.isAllowed ? consent.isAllowed('push') : false;
  }
  function storePush(ok) {
    if (consent.setPush) consent.setPush(ok);
  }

  function isSubscribed() {
    try {
      return localStorage.getItem('brain_push_sub') === '1';
    } catch (e) { return false; }
  }
  function setSubscribed(v) {
    try { localStorage.setItem('brain_push_sub', v ? '1' : '0'); } catch (e) {}
  }

  function nowTs() { return Date.now(); }

  /* ---------- Consentement explicite ----------
     Si l'utilisateur a déjà accepté (RGPD), on notifie
     "Notifications activées". Sinon on demande. */
  function ensureConsent() {
    if (!consent.hasChosen || consent.hasChosen()) return Promise.resolve(true);
    return new Promise(function (resolve) {
      showDialog(resolve);
    });
  }

  /* ---------- Inscription ---------- */
  async function subscribe() {
    if (!supported) return { ok: false, error: 'Navigateur non compatible.' };
    try {
      if (Notification.permission === 'denied') {
        storePush(false);
        return { ok: false, error: 'Notifications refusées dans les réglages du navigateur.' };
      }

      const sw = await navigator.serviceWorker.register('/sw.js');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        storePush(false);
        return { ok: false, error: 'Autorisation de notification refusée.' };
      }

      let sub = await sw.pushManager.getSubscription();

      if (!sub && VAPID) {
        sub = await sw.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID)
        });
      }

      if (!sub) return { ok: false, error: "Impossible de s'abonner." };

      const payload = {
        endpoint: sub.endpoint,
        keys: { p256dh: bufToBase64(sub.getKey('p256dh')), auth: bufToBase64(sub.getKey('auth')) }
      };

      const res = await fetch(SUB_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(function () { return {}; });

      if (!res.ok) return { ok: false, error: (data && data.error) || 'Enregistrement serveur échoué.' };

      storePush(true);
      setSubscribed(true);
      saveScheduler('active');
      return { ok: true };
    } catch (err) {
      storePush(false);
      return { ok: false, error: err && err.message ? err.message : 'Erreur d’inscription.' };
    }
  }

  /* ---------- Désinscription ---------- */
  async function unsubscribe() {
    if (!supported) return { ok: false };
    try {
      const sw = await navigator.serviceWorker.ready;
      const sub = await sw.pushManager.getSubscription();
      let endpoint = '';
      if (sub) {
        endpoint = sub.endpoint;
        await sub.unsubscribe();
      }
      if (endpoint) {
        try {
          await fetch(UNSUB_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: endpoint })
          });
        } catch (e) { /* non bloquant */ }
      }
      storePush(false);
      setSubscribed(false);
      return { ok: true };
    } catch (err) {
      return { ok: false };
    }
  }

  /* ---------- Persistance du prochain rappel ---------- */
  function saveScheduler(what) {
    try {
      if (what === 'later') {
        localStorage.setItem(schedulerKey, String(nowTs() + LATER_DAYS * 24 * 3600 * 1000));
        localStorage.removeItem(dismissedKey);
      } else if (what === 'dismiss') {
        localStorage.setItem(dismissedKey, String(nowTs() + DISMISSED_DAYS * 24 * 3600 * 1000));
        localStorage.removeItem(schedulerKey);
      } else {
        localStorage.removeItem(schedulerKey);
        localStorage.removeItem(dismissedKey);
      }
    } catch (e) {}
  }

  function shouldShowPrompt() {
    if (!supported) return false;
    if (allowPush() && isSubscribed()) return false;   // déjà ok
    if (consent.hasRefused && consent.hasRefused()) return false; // refus explicite
    if (Notification.permission === 'denied') return false;
    try {
      const later = parseInt(localStorage.getItem(schedulerKey) || '0', 10);
      if (later && nowTs() < later) return false;
      const dismissed = parseInt(localStorage.getItem(dismissedKey) || '0', 10);
      if (dismissed && nowTs() < dismissed) return false;
    } catch (e) {}
    return true;
  }

  /* ---------- UI : vignette cloche ---------- */
  function createBell() {
    const existing = document.getElementById('brain-push-bell');
    if (existing) return existing;

    const bell = document.createElement('button');
    bell.id = 'brain-push-bell';
    bell.type = 'button';
    bell.setAttribute('aria-label', 'Notifications BRAIN');
    bell.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.7 21a2 2 0 0 1-3.4 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span class="brain-push-bell-badge">1</span>';
    bell.classList.add('brain-push-bell');
    if (allowPush() && isSubscribed()) bell.classList.add('is-enabled');

    bell.addEventListener('click', function (ev) {
      ev.stopPropagation();
      togglePrefs();
    });
    document.body.appendChild(bell);
    return bell;
  }

  /* ---------- UI : la petite carte d'invitation ---------- */
  function showDialog(done) {
    const box = document.createElement('div');
    box.id = 'brain-push-dialog';
    box.className = 'brain-push-dialog';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-live', 'polite');
    box.innerHTML =
      '<div class="brain-push-dialog-card">' +
      '  <button class="brain-push-x" aria-label="Fermer">✕</button>' +
      '  <div class="brain-push-icon">🔔</div>' +
      '  <h4>Abonnez-vous à nos actualités</h4>' +
      '  <p>Recevez nos nouveautés BRAIN : publications, produits et offres. Sans spam.</p>' +
      '  <div class="brain-push-actions">' +
      '    <button class="brain-push-primary">Activer les notifications</button>' +
      '    <button class="brain-push-secondary">Pas maintenant</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(box);

    function isDialogOpen() { return document.getElementById('brain-push-dialog'); }

    function close(result) {
      const d = document.getElementById('brain-push-dialog');
      if (d) d.remove();
      if (done) done(result);
    }

    box.querySelector('.brain-push-x').addEventListener('click', function () {
      saveScheduler('dismiss');
      close(false);
    });
    box.querySelector('.brain-push-secondary').addEventListener('click', function () {
      saveScheduler('later');
      close(false);
    });
    box.querySelector('.brain-push-primary').addEventListener('click', async function (ev) {
      ev.stopPropagation();
      const btn = ev.currentTarget;
      btn.disabled = true;
      btn.textContent = 'Activation…';
      /* Consentement RGPD : l'action d'Activer vaut accord explicite. */
      if (consent.hasChosen && !consent.hasChosen() && consent.acceptAll) consent.acceptAll();
      const answer = await subscribe();
      close(answer.ok);
    });
  }

  /* ---------- UI : panneau de préférences ---------- */
  function togglePrefs() {
    const existing = document.getElementById('brain-push-prefs');
    if (existing) { existing.remove(); return; }

    const prefs = document.createElement('div');
    prefs.id = 'brain-push-prefs';
    prefs.className = 'brain-push-prefs';
    const on = allowPush() && isSubscribed();
    const analOn = consent.isAllowed ? consent.isAllowed('analytics') : false;
    prefs.innerHTML =
      '<div class="brain-push-prefs-card">' +
      '  <strong>Préférences</strong>' +
      '  <div class="brain-push-prefs-row">' +
      '    <label class="brain-push-switch"><input type="checkbox" id="brain-push-toggle" ' + (on ? 'checked' : '') + '><span class="brain-push-track"></span></label>' +
      '    <span>Notifications (🔔)</span>' +
      '  </div>' +
      '  <div class="brain-push-prefs-row">' +
      '    <label class="brain-push-switch"><input type="checkbox" id="brain-analytics-toggle" ' + (analOn ? 'checked' : '') + '><span class="brain-push-track"></span></label>' +
      '    <span>Statistiques de visite</span>' +
      '  </div>' +
      '  <small class="brain-push-prefs-note">Aucune donnée personnelle, aucune IP.<br><a href="/confidentialite.html">Politique de confidentialité</a></small>' +
      '</div>';
    document.body.appendChild(prefs);
    document.addEventListener('click', function (e) {
      const p = document.getElementById('brain-push-prefs');
      if (p && !p.contains(e.target) && !bell.contains(e.target)) p.remove();
    }, { once: true });

    const toggle = prefs.querySelector('#brain-push-toggle');
    toggle.addEventListener('change', async function () {
      if (toggle.checked) {
        const r = await subscribe();
        if (!r.ok) { toggle.checked = false; }
      } else {
        await unsubscribe();
        toggle.checked = false;
      }
    });

    const analToggle = prefs.querySelector('#brain-analytics-toggle');
    analToggle.addEventListener('change', function () {
      if (consent.setAnalytics) consent.setAnalytics(analToggle.checked);
    });
  }

  /* ---------- Init ---------- */
  function init() {
    if (!supported) return;
    createBell();
    window.setTimeout(function () {
      if (shouldShowPrompt()) showDialog(function () {
        const b = document.getElementById('brain-push-bell');
        if (b && allowPush() && isSubscribed()) b.classList.add('is-enabled');
      });
    }, DELAY_MS);
  }

  /* Helpers */
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
  function bufToBase64(buf) {
    let binary = '';
    const bytes = new Uint8Array(buf);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) { binary += String.fromCharCode(bytes[i]); }
    return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  window.BRAIN_NOTIFICATIONS = {
    supported: supported,
    subscribe: subscribe,
    unsubscribe: unsubscribe,
    togglePrefs: togglePrefs
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})();