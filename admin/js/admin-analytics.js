/* =========================================================
   BRAIN CMS — Module Analytics & Notifications (admin)
   Deux pages déléguées (routes #/analytics et #/notifications).
   - Statistiques visiteurs (privacy-first, aucune IP stockée).
   - Gestion des notifications Web Push (création, envoi,
     programmation, suivi des clics).
   Exposé via window.BRAIN_ADMIN_ANA.
   ========================================================= */
(function () {
  'use strict';

  var BRAIN = window.BRAIN_ADMIN_API;
  if (!BRAIN || typeof BRAIN.getClient !== 'function') return;

  var $ = BRAIN.$, $$ = BRAIN.$$, el = BRAIN.el,
      esc = BRAIN.esc, escAttr = BRAIN.escAttr,
      toast = BRAIN.toast, fmtDate = BRAIN.fmtDate,
      loading = BRAIN.loading, logActivity = BRAIN.logActivity,
      closeDialog = BRAIN.closeDialog, pushDialog = BRAIN.pushDialog,
      setActiveNav = BRAIN.setActiveNav;

  var COLLECTION = 'notifications';
  var STATUSES = { draft: 'Brouillon', scheduled: 'Programmée', sending: 'Envoi', sent: 'Envoyée', failed: 'Échec' };

  function getClient() { return BRAIN.getClient(); }

  function parseId(r) {
    return r && r.data && r.data[0] ? r.data[0].id : null;
  }

  /* =========================================================
     PAGE ANALYTICS
     ========================================================= */
  function renderAnalytics(main) {
    setActiveNav('analytics');
    main = main || $('#ad-main');
    var topbar = $('#ad-topbar'); if (topbar) topbar.hidden = false;
    main.innerHTML = '';

    var head = el('div', { class: 'ad-page-head' }, [
      el('div', {}, [
        el('h1', { class: 'ad-page-title', text: 'Analytics' }),
        el('p', { class: 'ad-page-sub', html: 'Statistiques de visite du site. <b>Respect RGPD</b> : aucune adresse IP n\'est enregistrée, géolocalisation approximative uniquement (pays / ville depuis Netlify), visiteurs anonymes.' })
      ]),
      el('div', { class: 'ad-inline' }, [
        el('button', { class: 'ad-btn ad-ghost', html: '<i class="fa-solid fa-rotate"></i> Actualiser', onclick: function () { loadAnalytics(); } })
      ])
    ]);
    main.appendChild(head);

    var stats = el('div', { class: 'ad-stats', id: 'ana-stats' });
    main.appendChild(stats);
    var today = el('div', { class: 'ad-card', id: 'ana-today' });
    main.appendChild(today);
    var card = el('div', { class: 'ad-card', id: 'ana-box' });
    main.appendChild(card);

    loadAnalytics();
  }

  function loadAnalytics() {
    var stats = $('#ana-stats'); var box = $('#ana-box'); var today = $('#ana-today');
    if (!stats || !box) return;
    var c = getClient(); if (!c) return;
    box.appendChild(loading('Chargement des statistiques…'));
    if (today) today.appendChild(loading('Chargement du récap du jour…'));

    var sinceBoundary = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    var liveFrom = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    var dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    var todayStart = dayStart.toISOString();

    Promise.all([
      c.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', sinceBoundary),
      c.from('visitor_sessions').select('anonymous_id', { count: 'exact', head: true }).gte('started_at', sinceBoundary),
      c.from('visitor_sessions').select('session_id', { count: 'exact', head: true }).gte('last_activity_at', liveFrom),
      c.from('visitor_sessions').select('anonymous_id', { count: 'exact', head: true }).gte('started_at', sinceBoundary).not('country_code', 'is', null),
      c.from('page_views').select('page_url,count()').gte('created_at', sinceBoundary).order('count', { ascending: false }).limit(8),
      c.from('page_views').select('referrer,count()').gte('created_at', sinceBoundary).order('count', { ascending: false }).limit(6),
      c.from('visitor_sessions').select('country,count()').gte('started_at', sinceBoundary).not('country', 'is', null).order('count', { ascending: false }).limit(8),
      c.from('visitor_sessions').select('device_type,count()').gte('started_at', sinceBoundary).order('count', { ascending: false }),
      c.from('visitor_sessions').select('browser,count()').gte('started_at', sinceBoundary).not('browser', 'is', null).order('count', { ascending: false }),
      /* --- Aujourd'hui --- */
      c.from('visitor_sessions').select('session_id', { count: 'exact', head: true }).gte('started_at', todayStart),
      c.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
      c.from('visitor_sessions').select('country,count()').gte('started_at', todayStart).not('country', 'is', null).order('count', { ascending: false }),
      c.from('page_views').select('page_url,count()').gte('created_at', todayStart).order('count', { ascending: false }).limit(8)
    ]).then(function (r) {
      var views = (r[0] || {}).count || 0;
      var uniques = (r[1] || {}).count || 0;
      var live = (r[2] || {}).count || 0;
      var countries = (r[3] || {}).count || 0;
      var topPages = (r[4] || {}).data || [];
      var referrers = (r[5] || {}).data || [];
      var geoList = (r[6] || {}).data || [];
      var devices = (r[7] || {}).data || [];
      var browsers = (r[8] || {}).data || [];
      var tVisitors = (r[9] || {}).count || 0;
      var tViews = (r[10] || {}).count || 0;
      var tGeo = (r[11] || {}).data || [];
      var tPages = (r[12] || {}).data || [];

      stats.innerHTML = '';
      stats.appendChild(el('div', { class: 'ad-stat', children: [el('b', { text: fmtNum(live) }), el('span', { text: 'En direct (15 min)' })] }));
      stats.appendChild(el('div', { class: 'ad-stat', children: [el('b', { text: fmtNum(tVisitors) }), el('span', { text: 'Visiteurs aujourd\'hui' })] }));
      stats.appendChild(el('div', { class: 'ad-stat', children: [el('b', { text: fmtNum(views) }), el('span', { text: 'Pages vues (30 j)' })] }));
      stats.appendChild(el('div', { class: 'ad-stat', children: [el('b', { text: fmtNum(uniques) }), el('span', { text: 'Visiteurs uniques' })] }));
      stats.appendChild(el('div', { class: 'ad-stat', children: [el('b', { text: fmtNum(countries) }), el('span', { text: 'Pays visités' })] }));

      if (today) renderTodayCard(today, tVisitors, tViews, tGeo, tPages);

      box.innerHTML = '';
      var g1 = analyticsGrid('Pages les plus vues (30 j)', barRows(topPages, 'page_url', 'count'));
      var g2 = analyticsGrid('Répartition des visiteurs', null, deviceRows(devices, browsers));
      var g3 = analyticsGrid('Géographie (30 j) — approx.', geoRows(geoList));
      var g4 = analyticsGrid('Origine du trafic', sourceRows(referrers));
      box.appendChild(el('div', { class: 'ana-grid' }, [g1, g2, g3, g4]));
    }).catch(function (e) {
      box.innerHTML = '';
      box.appendChild(el('div', { class: 'ad-empty', html: '<i class="fa-solid fa-circle-exclamation"></i>Erreur : ' + esc((e && e.message) || e) }));
    });
  }

  /* ---------- Récap « Aujourd'hui » avec la phrase géographique ---------- */
  function renderTodayCard(today, visitors, views, geo, pages) {
    today.innerHTML = '';
    if (!visitors) {
      today.appendChild(el('div', { class: 'ad-empty', html: '<i class="fa-solid fa-mug-hot"></i><div>Aucune visite aujourd\'hui pour le moment.</div>' }));
      return;
    }
    var total = geo.reduce(function (m, x) { return m + (Number(x.count) || 0); }, 0);
    var sentence;
    if (total) {
      var parts = geo.slice(0, 3).map(function (x) {
        return fmtPct(x.count, total) + ' ' + (x.country || '—');
      });
      if (geo.length > 3) parts.push('…');
      sentence = fmtNum(visitors) + ' visiteurs aujourd\'hui — ' + parts.join(' — ');
    } else {
      sentence = fmtNum(visitors) + ' visiteurs aujourd\'hui (' + fmtNum(views) + ' pages vues)';
    }

    var lead = el('div', { class: 'ana-today' }, [
      el('div', { class: 'ana-today-sentence', html: '<i class="fa-solid fa-earth-africa"></i> ' + esc(sentence) })
    ]);
    /* Pages du jour */
    var inner = el('div', { class: 'ana-today-body' });
    if (pages.length) {
      var list = el('ol', { class: 'ana-today-pages' });
      pages.forEach(function (x) {
        var lab = x.page_url || '/';
        list.appendChild(el('li', {}, [
          el('span', { class: 'ana-today-url', text: lab }),
          el('b', { text: fmtNum(x.count) + (x.count > 1 ? ' vues' : ' vue') })
        ]));
      });
      inner.appendChild(el('div', { class: 'ana-today-col', children: [el('b', { class: 'ana-today-h', text: 'Pages les plus vues aujourd\'hui' }), list] }));
    }
    if (geo.length) {
      inner.appendChild(el('div', { class: 'ana-today-col', children: [el('b', { class: 'ana-today-h', text: 'Origine (aujourd\'hui)' }), geoRows(geo)] }));
    }
    today.appendChild(lead);
    if (inner.childNodes.length) today.appendChild(inner);
  }

  function fmtNum(n) {
    n = Number(n) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.', ',') + ' M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace('.', ',') + ' k';
    return String(n);
  }
  function fmtPct(part, total) {
    if (!total) return '0 %';
    return Math.round((part / total) * 100) + ' %';
  }

  function analyticsGrid(title, barsHtml, deviceHtml) {
    var content = barsHtml || deviceHtml;
    return el('div', { class: 'ana-card' }, [
      el('h3', { class: 'ana-card-title', text: title }),
      content
    ]);
  }

  function barRows(list, labelKey, valueKey) {
    var total = list.reduce(function (m, x) { return m + (Number(x[valueKey]) || 0); }, 0);
    if (!list.length) return el('div', { class: 'ad-empty', html: '<div>Aucune donnée.</div>' });
    var wrap = el('div', { class: 'ana-bars' });
    list.forEach(function (x) {
      var v = Number(x[valueKey]) || 0;
      var lab = x[labelKey] || '—';
      var pct = total ? Math.round((v / total) * 100) : 0;
      wrap.appendChild(el('div', { class: 'ana-bar-row' }, [
        el('span', { class: 'ana-bar-label', text: lab }),
        el('div', { class: 'ana-bar-track' }, [
          el('div', { class: 'ana-bar-fill', style: 'width:' + pct + '%' })
        ]),
        el('span', { class: 'ana-bar-val', text: fmtNum(v) })
      ]));
    });
    return wrap;
  }

  function deviceRows(devices, browsers) {
    var sections = [];
    var dTotal = devices.reduce(function (m, x) { return m + (Number(x.count) || 0); }, 0);
    var bTotal = browsers.reduce(function (m, x) { return m + (Number(x.count) || 0); }, 0);
    var dWrap = el('div', { class: 'ana-bars' });
    devices.forEach(function (x) {
      var v = Number(x.count) || 0;
      var lab = x.device_type || 'Autre';
      var pct = dTotal ? Math.round((v / dTotal) * 100) : 0;
      dWrap.appendChild(el('div', { class: 'ana-bar-row' }, [
        el('span', { class: 'ana-bar-label', text: lab }),
        el('div', { class: 'ana-bar-track' }, [el('div', { class: 'ana-bar-fill', style: 'width:' + pct + '%' })]),
        el('span', { class: 'ana-bar-val', text: fmtNum(v) })
      ]));
    });
    sections.push(el('div', { class: 'ana-sub', children: [el('b', { text: 'Appareils' }), dWrap] }));

    var bWrap = el('div', { class: 'ana-bars' });
    browsers.forEach(function (x) {
      var v = Number(x.count) || 0;
      var lab = x.browser || 'Autre';
      var pct = bTotal ? Math.round((v / bTotal) * 100) : 0;
      bWrap.appendChild(el('div', { class: 'ana-bar-row' }, [
        el('span', { class: 'ana-bar-label', text: lab }),
        el('div', { class: 'ana-bar-track' }, [el('div', { class: 'ana-bar-fill', style: 'width:' + pct + '%' })]),
        el('span', { class: 'ana-bar-val', text: fmtNum(v) })
      ]));
    });
    sections.push(el('div', { class: 'ana-sub', children: [el('b', { text: 'Navigateurs' }), bWrap] }));
    return el('div', {}, sections);
  }

  function geoRows(list) {
    var total = list.reduce(function (m, x) { return m + (Number(x.count) || 0); }, 0);
    if (!list.length) return el('div', { class: 'ad-empty', html: '<div>Aucune donnée.</div>' });
    var wrap = el('div', { class: 'ana-bars' });
    list.forEach(function (x) {
      var v = Number(x.count) || 0;
      var pct = total ? Math.round((v / total) * 100) : 0;
      wrap.appendChild(el('div', { class: 'ana-bar-row' }, [
        el('span', { class: 'ana-bar-label', text: x.country || '—' }),
        el('div', { class: 'ana-bar-track' }, [el('div', { class: 'ana-bar-fill', style: 'width:' + pct + '%' })]),
        el('span', { class: 'ana-bar-val', text: fmtPct(v, total) })
      ]));
    });
    return wrap;
  }

  function sourceRows(list) {
    if (!list.length) return el('div', { class: 'ad-empty', html: '<div>Aucun trafic externe.</div>' });
    var wrap = el('div', { class: 'ana-list' });
    list.forEach(function (x) {
      var lab = x.referrer ? String(x.referrer).replace(/^https?:\/\//, '').split('/')[0] : 'Direct';
      if (!lab) lab = 'Direct';
      wrap.appendChild(el('div', { class: 'ana-list-row' }, [
        el('span', { text: esc(lab) }),
        el('b', { text: fmtNum(x.count) })
      ]));
    });
    return wrap;
  }

  /* =========================================================
     PAGE NOTIFICATIONS
     ========================================================= */
  function renderNotifications(main) {
    setActiveNav('notifications');
    main = main || $('#ad-main');
    var topbar = $('#ad-topbar'); if (topbar) topbar.hidden = false;
    main.innerHTML = '';

    var head = el('div', { class: 'ad-page-head' }, [
      el('div', {}, [
        el('h1', { class: 'ad-page-title', text: 'Notifications push' }),
        el('p', { class: 'ad-page-sub', html: 'Campagnes Web Push envoyées aux visiteurs abonnés (cloche 🔔 sur le site). Vous pouvez créer, programmer ou envoyer immédiatement.' })
      ]),
      el('div', { class: 'ad-inline' }, [
        el('button', { class: 'ad-btn ad-primary', html: '<i class="fa-solid fa-bell"></i> Nouvelle notification', onclick: function () { openNotifEditor(null); } })
      ])
    ]);
    main.appendChild(head);

    var stats = el('div', { class: 'ad-stats', id: 'notif-stats' });
    main.appendChild(stats);
    var card = el('div', { class: 'ad-card' });
    var box = el('div', { id: 'notif-box' });
    card.appendChild(box);
    main.appendChild(card);
    loadNotifications();
  }

  function loadNotifications() {
    var box = $('#notif-box'); if (!box) return;
    var c = getClient(); if (!c) return;
    box.innerHTML = '';
    box.appendChild(loading('Chargement des notifications…'));

    Promise.all([
      c.from(COLLECTION).select('*').order('created_at', { ascending: false }).limit(100),
      c.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('is_active', true)
    ]).then(function (r) {
      var notifs = (r[0] && r[0].data) || [];
      var subs = (r[1] && r[1].count) || 0;

      var stats = $('#notif-stats');
      if (stats) {
        stats.innerHTML = '';
        var sent = notifs.filter(function (n) { return n.status === 'sent'; }).length;
        stats.appendChild(el('div', { class: 'ad-stat', children: [el('b', { text: fmtNum(subs) }), el('span', { text: 'Abonnés actifs' })] }));
        stats.appendChild(el('div', { class: 'ad-stat', children: [el('b', { text: notifs.length }), el('span', { text: 'Notifications' })] }));
        stats.appendChild(el('div', { class: 'ad-stat', children: [el('b', { text: sent }), el('span', { text: 'Envoyées' })] }));
      }

      renderNotifTable(box, notifs);
    }).catch(function (e) {
      box.innerHTML = '';
      box.appendChild(el('div', { class: 'ad-empty', html: '<i class="fa-solid fa-circle-exclamation"></i>Erreur : ' + esc((e && e.message) || e) }));
    });
  }

  function notifStatusBadge(n) {
    var map = { draft: 'ad-b-draft', scheduled: 'ad-b-draft', sending: 'ad-b-draft', sent: 'ad-b-published', failed: 'ad-b-error' };
    return '<span class="ad-badge ' + (map[n.status] || 'ad-b-draft') + '">' + esc(STATUSES[n.status] || n.status) + '</span>';
  }

  function renderNotifTable(box, list) {
    box.innerHTML = '';
    if (!list.length) {
      box.appendChild(el('div', { class: 'ad-empty', html: '<i class="fa-solid fa-bell-slash"></i><div>Aucune notification pour le moment. Créez-en une pour alerter vos abonnés.</div>' }));
      return;
    }
    var table = el('table', { class: 'ad-table' });
    table.innerHTML = '<thead><tr><th>Notification</th><th>Type</th><th>Statut</th><th>Envoi</th><th>Clics</th><th style="text-align:right">Actions</th></tr></thead>';
    var tb = el('tbody');
    list.forEach(function (n) {
      var tr = el('tr');
      tr.appendChild(el('td', {}, [
        el('div', { class: 'ad-row-title', text: n.title || '—' }),
        n.message ? el('div', { class: 'ad-row-sub', text: (n.message || '').slice(0, 80) }) : el('div', { class: 'ad-row-sub', text: 'Pas de message' })
      ]));
      tr.appendChild(el('td', { html: '<span class="ad-badge">' + esc(n.type || 'announcement') + '</span>' }));
      tr.appendChild(el('td', { html: notifStatusBadge(n) }));
      tr.appendChild(el('td', { text: n.sent_at ? fmtDate(n.sent_at) : (n.scheduled_for ? 'Prévu : ' + fmtDate(n.scheduled_for) : '—') }));
      tr.appendChild(el('td', { text: n.click_count ? String(n.click_count) : '—' }));
      tr.appendChild(el('td', {}, [notifActions(n, list, box)]));
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    box.appendChild(table);
  }

  function notifActions(n, list, box) {
    var canSend = n.status === 'draft' || n.status === 'scheduled' || (n.status === 'failed');
    return el('div', { class: 'ad-row-actions' }, [
      el('button', { class: 'ad-btn ad-sm ad-ghost', title: 'Modifier', html: '<i class="fa-solid fa-pen"></i>', onclick: function () { openNotifEditor(n); } }),
      el('button', { class: 'ad-btn ad-sm ' + (canSend ? 'ad-primary' : 'ad-ghost'), title: 'Envoyer maintenant', html: '<i class="fa-solid fa-paper-plane"></i>', disabled: !canSend, onclick: function () { sendNow(n); } }),
      el('button', { class: 'ad-btn ad-sm ad-ghost', title: 'Dupliquer', html: '<i class="fa-solid fa-copy"></i>', onclick: function () { duplicateNotif(n); } }),
      el('button', { class: 'ad-btn ad-sm ad-danger', title: 'Supprimer', html: '<i class="fa-solid fa-trash"></i>', onclick: function () { deleteNotif(n); } })
    ]);
  }

  function openNotifEditor(n) {
    var isEdit = !!n;
    var types = ['blog', 'product', 'service', 'update', 'announcement'];

    var m = el('div', { class: 'ad-overlay' });
    m.innerHTML = '<div class="ad-modal ad-modal-form ad-modal-wide">' +
      '<div class="ad-modal-head"><h3 class="ad-modal-title">' + (isEdit ? 'Modifier la notification' : 'Nouvelle notification push') + '</h3>' +
        '<button type="button" class="ad-btn ad-ghost ad-icon ad-close-x"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="ad-modal-body"><form id="nf-form">' +
        '<div class="ad-grid ad-grid-2">' +
          '<div class="ad-field"><label>Titre <span class="ad-req">*</span></label><input class="ad-input" data-f="title" value="' + escAttr((n && n.title) || '') + '" placeholder="Ex : Nouvel article publié !"></div>' +
          '<div class="ad-field"><label>Type</label><select class="ad-select" data-f="type">' + types.map(function (t) {
            return '<option value="' + t + '"' + (n && n.type === t ? ' selected' : '') + '>' + esc(t) + '</option>';
          }).join('') + '</select></div>' +
        '</div>' +
        '<div class="ad-field"><label>Message</label><textarea class="ad-textarea" data-f="message" rows="2">' + esc((n && n.message) || '') + '</textarea></div>' +
        '<div class="ad-grid ad-grid-2">' +
          '<div class="ad-field"><label>Lien (URL de destination)</label><input class="ad-input" data-f="url" value="' + escAttr((n && n.url) || '/') + '" placeholder="/blog/mon-article"></div>' +
          '<div class="ad-field"><label>Image (optionnel, URL)</label><input class="ad-input" data-f="image_url" value="' + escAttr((n && n.image_url) || '') + '" placeholder="https://…"></div>' +
        '</div>' +
        '<div class="ad-grid ad-grid-2">' +
          '<div class="ad-field"><label>Programmer pour (optionnel)</label><input class="ad-input" type="datetime-local" data-f="scheduled_for" value="' + escAttr((n && n.scheduled_for ? toLocalInput(n.scheduled_for) : '')) + '"></div>' +
          '<div class="ad-field"><label>Statut</label><select class="ad-select" data-f="status">' +
            '<option value="draft"' + ((!n || n.status === 'draft') ? ' selected' : '') + '>Brouillon</option>' +
            '<option value="scheduled"' + (n && n.status === 'scheduled' ? ' selected' : '') + '>Programmée</option>' +
          '</select></div>' +
        '</div>' +
      '</form></div>' +
      '<div class="ad-modal-foot"><div class="ad-left">' +
        (isEdit ? '<button type="button" class="ad-btn ad-danger ad-nf-del"><i class="fa-solid fa-trash"></i> Supprimer</button>' : '') +
      '</div><div class="ad-right">' +
        '<button type="button" class="ad-btn ad-ghost ad-cancel">Annuler</button>' +
        '<button type="button" class="ad-btn ad-primary ad-nf-save"><i class="fa-solid fa-save"></i> Enregistrer</button>' +
        '<button type="button" class="ad-btn ad-primary ad-nf-send"><i class="fa-solid fa-paper-plane"></i> Enregistrer et envoyer</button>' +
      '</div></div></div>';
    pushDialog(m);

    var scheduledIn = $('[data-f="scheduled_for"]', m);

    /* Si la date de programmation est renseignée, on bascule en 'scheduled' */
    scheduledIn.addEventListener('change', function () {
      if (scheduledIn.value) $('[data-f="status"]', m).value = 'scheduled';
    });

    function close() { closeDialog(); m.remove(); }
    $('.ad-close-x', m).addEventListener('click', close);
    $('.ad-cancel', m).addEventListener('click', close);

    var delBtn = $('.ad-nf-del', m);
    if (delBtn) delBtn.addEventListener('click', function () {
      if (!confirm('Supprimer cette notification ?')) return;
      deleteNotif(n);
      close();
    });

    var saveBtn = $('.ad-nf-save', m);
    var sendBtn = $('.ad-nf-send', m);

    saveBtn.addEventListener('click', function () { saveNotif(m, n).then(function (id) { toast(isEdit ? 'Notification modifiée' : 'Notification créée', 'ok'); close(); loadNotifications(); }).catch(function (e) { toast((e && e.message) || 'Erreur', 'err'); }); });
    sendBtn.addEventListener('click', function () {
      saveNotif(m, n).then(function (id) {
        close();
        loadNotifications();
        sendNow({ id: id });
      }).catch(function (e) { toast((e && e.message) || 'Erreur', 'err'); });
    });
  }

  function toLocalInput(iso) {
    var d = new Date(iso);
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function saveNotif(m, n) {
    var c = getClient(); if (!c) return Promise.reject({ message: 'Client indisponible.' });
    var title = String($('[data-f="title"]', m).value || '').trim();
    if (!title) return Promise.reject({ message: 'Le titre est obligatoire.' });

    var scheduledFor = $('[data-f="scheduled_for"]', m).value;
    var status = scheduledFor ? 'scheduled' : ($('[data-f="status"]', m).value || 'draft');
    var payload = {
      title: title,
      message: String($('[data-f="message"]', m).value || '').trim(),
      url: String($('[data-f="url"]', m).value || '/').trim(),
      image_url: String($('[data-f="image_url"]', m).value || '').trim() || null,
      type: $('[data-f="type"]', m).value || 'announcement',
      status: status,
      scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null
    };

    var chain = n && n.id
      ? c.from(COLLECTION).update(payload).eq('id', n.id)
      : c.from(COLLECTION).insert(payload);
    return chain.then(function (r) {
      if (r.error) throw new Error(r.error.message);
      return parseId(r);
    });
  }

  function duplicateNotif(n) {
    var c = getClient(); if (!c) return;
    var copy = {
      title: (n.title || 'Notification') + ' (copie)',
      message: n.message || '',
      url: n.url || '/',
      image_url: n.image_url || null,
      type: n.type || 'announcement',
      status: 'draft',
      scheduled_for: null
    };
    c.from(COLLECTION).insert(copy).then(function (r) {
      if (r.error) { toast(r.error.message, 'err'); return; }
      toast('Notification dupliquée (brouillon)', 'ok');
      logActivity('create', COLLECTION, parseId(r));
      loadNotifications();
    });
  }

  function deleteNotif(n) {
    if (!confirm('Supprimer définitivement cette notification ?')) return;
    var c = getClient(); if (!c) return;
    c.from(COLLECTION).delete().eq('id', n.id).then(function (r) {
      if (r.error) { toast(r.error.message, 'err'); return; }
      toast('Notification supprimée', 'ok');
      logActivity('delete', COLLECTION, n.id);
      loadNotifications();
    });
  }

  /* ---------- Envoi immédiat ---------- */
  function sendNow(n) {
    if (!n || !n.id) return;
    if (!confirm('Envoyer maintenant cette notification à tous les abonnés ?')) return;

    var token = '';
    var c = getClient();
    c.auth.getSession().then(function (s) {
      token = s && s.data && s.data.session ? s.data.session.access_token : '';

      return fetch('/.netlify/functions/push-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ notification_id: n.id })
      });
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (b) { throw new Error((b && b.error) || ('Erreur ' + res.status)); });
      }
      return res.json();
    }).then(function (b) {
      toast('Envoi terminé : ' + b.sent + ' envoyée(s), ' + b.failed + ' échec(s)', b.failed > 0 ? 'err' : 'ok');
      loadNotifications();
    }).catch(function (e) {
      toast((e && e.message) || 'Erreur réseau', 'err');
    });
  }

  /* ---------- Raccourci : notifier à propos d'un article/produit ---------- */
  function notifyAbout(item, kind) {
    var type = kind === 'product' ? 'product' : 'blog';
    var isArticle = type === 'blog';
    var title = (item.title || item.name || '').trim();
    var slug = String(item.slug || item.external_slug || '').trim();
    var url = slug ? (isArticle ? '/blog/' + slug : '/produits/' + slug) : '/';
    var pre = { title: title ? ('Nouveauté : ' + title) : '', url: url, type: type };

    // Pré-rempli via l'éditeur
    var m = el('div', { class: 'ad-overlay' });
    m.innerHTML = '<div class="ad-modal ad-modal-form ad-modal-wide">' +
      '<div class="ad-modal-head"><h3 class="ad-modal-title">Notifier les abonnés — ' + esc(title || '') + '</h3>' +
        '<button type="button" class="ad-btn ad-ghost ad-icon ad-close-x"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="ad-modal-body"><form>' +
        '<div class="ad-field"><label>Type de contenu</label><select class="ad-select" id="nf-kind"><option value="blog"' + (isArticle ? ' selected' : '') + '>Article de blog</option><option value="product"' + (!isArticle ? ' selected' : '') + '>Produit</option></select></div>' +
        '<div class="ad-field"><label>Lien (URL)</label><input class="ad-input" id="nf-url" value="' + escAttr(url) + '"></div>' +
        '<div class="ad-field"><label>Titre de la notification <span class="ad-req">*</span></label><input class="ad-input" id="nf-title" value="' + escAttr(pre.title) + '"></div>' +
        '<div class="ad-field"><label>Message</label><textarea class="ad-textarea" id="nf-msg" rows="2" placeholder="Résumé court de 1 ligne"></textarea></div>' +
      '</form></div>' +
      '<div class="ad-modal-foot"><div class="ad-right">' +
        '<button type="button" class="ad-btn ad-ghost ad-cancel">Annuler</button>' +
        '<button type="button" class="ad-btn ad-primary ad-nf-go"><i class="fa-solid fa-paper-plane"></i> Envoyer maintenant</button>' +
      '</div></div></div>';
    pushDialog(m);
    $('.ad-close-x', m).addEventListener('click', function () { closeDialog(); m.remove(); });
    $('.ad-cancel', m).addEventListener('click', function () { closeDialog(); m.remove(); });
    $('.ad-nf-go', m).addEventListener('click', function () {
      var title2 = String($('#nf-title', m).value || '').trim();
      if (!title2) { toast('Titre obligatoire', 'err'); return; }
      var url2 = String($('#nf-url', m).value || '/').trim();
      var msg = String($('#nf-msg', m).value || '').trim();
      var kind2 = $('#nf-kind', m).value;
      var c = getClient();
      c.from(COLLECTION).insert({
        title: title2, message: msg, url: url2, type: kind2 === 'product' ? 'product' : 'blog',
        status: 'draft'
      }).then(function (r) {
        if (r.error) throw new Error(r.error.message);
        var id = parseId(r);
        closeDialog(); m.remove();
        sendNow({ id: id });
      }).catch(function (e) { toast((e && e.message) || 'Erreur', 'err'); });
    });
  }

  window.BRAIN_ADMIN_ANA = {
    renderAnalytics: renderAnalytics,
    renderNotifications: renderNotifications,
    notifyAbout: notifyAbout
  };
})();