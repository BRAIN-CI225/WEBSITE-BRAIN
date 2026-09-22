/* =========================================================
   BRAIN — Service Worker
   - Reçoit les notifications Web Push
   - Affiche les notifications (Push API / Notification API)
   - Gère le clic => ouvre l'URL de l'article/produit
   - Compte les clics (battement vers notify-click) sans
     bloquer la navigation (fetch keepalive best-effort)
   - Ne modifie PAS le cache existant du site (aucun pré-cache
     ajouté ici : on reste transparent pour le SEO/CWV)
   ========================================================= */

var BRAIN_SW_VERSION = '1.0.0';
var NOTIFY_CLICK_ENDPOINT = '/.netlify/functions/notify-click';

self.addEventListener('install', function (event) {
  // Activation immédiate : le nouveau SW prend la main sans attendre.
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

/* ---------- Affichage d'une notification entrante ---------- */
self.addEventListener('push', function (event) {
  var payload = {};
  try {
    if (event.data) payload = event.data.json();
  } catch (e) {
    try { payload.message = event.data ? event.data.text() : ''; }
    catch (e2) { payload.message = 'Nouvelle publication BRAINCO BUSINESS'; }
  }

  var title = payload.title || 'BRAINCO BUSINESS — Nouvelle publication';
  var msg = payload.message || 'Découvrez la nouvelle publication BRAINCO BUSINESS.';
  var url = payload.url || '/';
  var image = payload.image_url || '';
  var nid = payload.notification_id || null;

  var options = {
    body: msg,
    icon: '/ASSET/favicon.png',
    badge: '/ASSET/favicon.png',
    data: { url: url, notification_id: nid },
    tag: payload.tag || ('brain-' + Math.floor(Date.now() / 1000)),
    renotify: true,
    requireInteraction: false
  };
  if (image) options.image = image;

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ---------- Clic sur la notification ---------- */
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  var data = event.notification.data || {};
  var url = data.url || '/';
  var nid = data.notification_id || null;

  // Comptage des clics (best-effort, ne bloque pas la navigation).
  if (nid) {
    event.waitUntil(
      fetch(NOTIFY_CLICK_ENDPOINT, {
        method: 'POST',
        credentials: 'omit',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: nid })
      }).catch(function () {})
    );
  }

  // Ouvre la page cible (article / produit) dans un onglet existant si possible.
  var target = url;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          client.focus();
          try { client.navigate(target); } catch (e) { return; }
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

/* ---------- Notification fermée (le visiteur a choisi de fermer) ---------- */
self.addEventListener('notificationclose', function (event) {
  // Aucune donnée sensible traitée ici. On ne retrace rien.
});