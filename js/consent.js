/* ============================================================
   BRAIN — Gestion du consentement (RGPD)
   Un seul mur, stocké en localStorage, pilote TOUT :
   - analytics (statistiques de visite)
   - notification (Web Push)
   Exposé via window.BRAIN_CONSENT.

   Règles :
   - Par défaut : rien n'est activé tant que le visiteur n'a pas
     choisi (pas de tracking avant l'accord explicite).
   - Si l'utilisateur refuse : analytics désactivé, pas de push.
   - Peut revenir dessus via la ligne "Préférences" du footer.
   ============================================================ */

(function () {
  if (typeof window === 'undefined') return;
  if (window.BRAIN_CONSENT) return;

  var STORE_KEY = 'brain_consent_v1';
  var DNT_KEY = 'brain_dnt';
  var LISTENERS = [];
  var REFUSE_KEY = 'brain_push_dismissed';

  /* ---------- Stockage ---------- */
  function read() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (typeof data.analytics !== 'boolean' || typeof data.push !== 'boolean' || typeof data.timestamp !== 'number') return null;
      return data;
    } catch (e) { return null; }
  }
  function write(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  /* ---------- État courant ---------- */
  var state = read();

  function hasChosen() { return !!state; }
  function hasRefused() {
    try { return localStorage.getItem(REFUSE_KEY) === '1'; } catch (e) { return false; }
  }
  function isAllowed(category) {
    if (!state) return false;
    if (category === 'push') return state.push;
    return state.analytics;
  }
  function dnt() {
    try {
      return (navigator.doNotTrack === '1' || navigator.doNotTrack === 1 || navigator.msDoNotTrack === '1' || window.doNotTrack === '1');
    } catch (e) { return false; }
  }

  /* ---------- Actions ---------- */
  function acceptAll() {
    state = { analytics: true, push: true, timestamp: Date.now() };
    write(state);
    clearRefuse();
    notifyListeners();
  }
  function refuseAll() {
    state = { analytics: false, push: false, timestamp: Date.now() };
    write(state);
    setRefused();
    notifyListeners();
  }
  function setPush(enabled) {
    if (!state) state = { analytics: false, push: false, timestamp: Date.now() };
    state.push = !!enabled;
    state.timestamp = Date.now();
    write(state);
    if (!enabled) setRefused();
    notifyListeners();
  }
  function setAnalytics(enabled) {
    if (!state) state = { analytics: false, push: false, timestamp: Date.now() };
    state.analytics = !!enabled;
    state.timestamp = Date.now();
    write(state);
    notifyListeners();
  }

  function setRefused() {
    try { localStorage.setItem(REFUSE_KEY, '1'); } catch (e) {}
  }
  function clearRefuse() {
    try { localStorage.removeItem(REFUSE_KEY); } catch (e) {}
  }

  function onChange(fn) {
    if (typeof fn === 'function') LISTENERS.push(fn);
  }
  function notifyListeners() {
    LISTENERS.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  window.BRAIN_CONSENT = {
    hasChosen: hasChosen,
    hasRefused: hasRefused,
    isAllowed: isAllowed,
    dnt: dnt,
    acceptAll: acceptAll,
    refuseAll: refuseAll,
    setPush: setPush,
    setAnalytics: setAnalytics,
    onChange: onChange
  };
})();