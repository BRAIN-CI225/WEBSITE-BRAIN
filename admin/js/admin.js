/* =========================================================
   BRAIN CMS — Admin SPA
   Gestion : pages, sections (page builder), médias,
   réglages du site, journal d'activité.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- Helpers ---------- */
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function escAttr(v) { return esc(v); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (k === 'style' && typeof attrs[k] === 'object') Object.assign(node.style, attrs[k]);
      else node.setAttribute(k, attrs[k]);
    });
    if (children) { (Array.isArray(children) ? children : [children]).forEach(function (c) { if (c != null) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); }
    return node;
  }
  function toast(msg, kind) {
    var t = $('#ad-toast'); if (!t) return;
    t.innerHTML = '<i class="fa-solid ' + (kind === 'err' ? 'fa-circle-exclamation ad-err' : kind === 'ok' ? 'fa-circle-check ad-ok' : 'fa-info') + '"></i> ' + esc(msg);
    t.hidden = false;
    t.className = 'ad-toast' + (kind === 'err' ? ' ad-err' : kind === 'ok' ? ' ad-ok' : '');
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(function () { t.hidden = true; }, 3400);
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function slugify(s) {
    return String(s).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'page';
  }
  function loading(label) {
    return el('div', { class: 'ad-empty', html: '<i class="fa-solid fa-spinner fa-spin"></i>' + esc(label || 'Chargement…') });
  }

  /* ---------- État ---------- */
  var client = null;
  var user = null;
  var CURRENT = { page: null, sections: [] };
  var DIALOGS = [];

  function closeDialog() { var d = DIALOGS.pop(); if (d && d.remove) d.remove(); }
  function pushDialog(node) { DIALOGS.push(node); document.body.appendChild(node); if (node._open) node._open(); }
  function isOpen(name, body) { return true; }

  var COLUMNS = { title: 1, subtitle: 1, content: 1, image: 1 };

  /* ---------- Supabase ---------- */
  function waitSupabase(done) {
    if (window.brainSupabase && window.brainSupabase.client && window.brainSupabase.ready) return done(window.brainSupabase.client);
    var tries = 0;
    var t = window.setInterval(function () {
      tries++;
      if (window.brainSupabase && window.brainSupabase.ready && window.brainSupabase.client) {
        window.clearInterval(t); done(window.brainSupabase.client);
      } else if (tries > 40) {
        window.clearInterval(t);
        toast('Impossible de charger Supabase : ' + (window.brainSupabase && window.brainSupabase.error || 'erreur réseau'), 'err');
      }
    }, 250);
  }

  function logActivity(action, entityType, entityId, details) {
    if (!client || !user) return;
    client.from('admin_activity_logs').insert({
      admin_id: user.id, action: action, entity_type: entityType,
      entity_id: entityId || null, details: details || null
    }).then(function () {}, function () {});
  }

  /* ---------- Références (services, projets…) ---------- */
  var REF_TABLES = { services: 'services', portfolio: 'projects', blog: 'blog_posts', testimonials: 'testimonials', statistics: 'statistics', faq: 'faqs' };
  function fetchRefs(sectionTypes) {
    if (!client) return Promise.resolve({});
    var needed = {};
    (sectionTypes || []).forEach(function (t) { if (REF_TABLES[t]) needed[t] = true; });
    var tasks = Object.keys(needed).map(function (type) {
      var table = REF_TABLES[type];
      return client.from(table).select('*').order('display_order', { ascending: true })
        .then(function (r) { return r.data || []; }).catch(function () { return []; });
    });
    return Promise.all(tasks).then(function (lists) {
      var map = {};
      Object.keys(needed).forEach(function (type, i) { map[type] = lists[i]; });
      return map;
    });
  }

  /* =========================================================
     AUTH
     ========================================================= */
  function renderLogin() {
    var main = $('#ad-main');
    main.innerHTML = '';
    var wrap = el('div', { class: 'ad-login-wrap' });
    var box = el('div', { class: 'ad-login' }, [
      el('div', { class: 'ad-login-logo', html: '<i class="fa-solid fa-layer-group"></i>' }),
      el('h1', { text: 'BRAIN CMS' }),
      el('p', { text: 'Connectez-vous pour administrer le site.' }),
      el('div', { class: 'ad-field' }, [
        el('label', { text: 'Email' }),
        el('input', { class: 'ad-input', type: 'email', id: 'ad-email', placeholder: 'vous@braincobusiness.com', autocomplete: 'username' })
      ]),
      el('div', { class: 'ad-field' }, [
        el('label', { text: 'Mot de passe' }),
        el('input', { class: 'ad-input', type: 'password', id: 'ad-pass', placeholder: '••••••••', autocomplete: 'current-password' })
      ]),
      el('button', { class: 'ad-btn ad-primary', id: 'ad-login-btn', style: { width: '100%' }, text: 'Se connecter' }),
      el('p', { class: 'ad-note', html: 'Le premier utilisateur créé dans Supabase devient administrateur.<br>Créez le compte depuis <b>Supabase &gt; Authentication &gt; Users</b> puis revenez ici.' })
    ]);
    wrap.appendChild(box);
    main.appendChild(wrap);

    function doLogin() {
      var email = $('#ad-email').value.trim();
      var pass = $('#ad-pass').value;
      if (!email || !pass) { toast('Renseignez email et mot de passe', 'err'); return; }
      $('#ad-login-btn').disabled = true; $('#ad-login-btn').textContent = 'Connexion…';
      client.auth.signInWithPassword({ email: email, password: pass }).then(function (res) {
        if (res.error) { toast(res.error.message || 'Connexion refusée', 'err'); $('#ad-login-btn').disabled = false; $('#ad-login-btn').textContent = 'Se connecter'; return; }
        toast('Bienvenue ' + email, 'ok');
        location.hash = '#/pages';
      });
    }
    $('#ad-login-btn').addEventListener('click', doLogin);
    $('#ad-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
  }

  /* =========================================================
     ROUTER
     ========================================================= */
  function parseRoute() {
    var h = location.hash.replace(/^#\/?/, '') || 'pages';
    var parts = h.split('/');
    return { name: parts[0], slug: parts[1] || null };
  }
  function route() {
    var r = parseRoute();
    var main = $('#ad-main');
    var needsAuth = ['pages', 'media', 'settings', 'logs', 'products', 'blog', 'videos'];
    if (r.name === 'login' || (needsAuth.indexOf(r.name) === -1)) {
      if (!user) { renderLogin(); syncTopbar(); return; }
    }
    if (!user) { renderLogin(); syncTopbar(); return; }

    if (r.name === 'pages') { if (r.slug) return renderBuilder(r.slug); return renderPages(); }
    if (r.name === 'media') return renderMedia();
    if (r.name === 'settings') return renderSettings();
    if (r.name === 'logs') return renderLogs();
    if (r.name === 'products') return renderProducts();
    if (r.name === 'blog') return renderBlogPosts();
    if (r.name === 'videos') return renderAudiovisual();
    renderPages();
  }
  function syncTopbar() {
    var tb = $('#ad-topbar');
    if (user) {
      tb.hidden = false;
      $('#ad-user-name').textContent = user.email || '';
    } else {
      tb.hidden = true;
    }
  }
  function setActiveNav(name) {
    $$('#ad-nav a[data-nav]').forEach(function (a) {
      a.classList.toggle('ad-active', a.getAttribute('data-nav') === name);
    });
  }

  /* =========================================================
     PAGES LIST
     ========================================================= */
  function renderPages() {
    setActiveNav('pages');
    var main = $('#ad-main');
    $('#ad-topbar').hidden = false;
    main.innerHTML = '';
    main.appendChild(loading('Chargement des pages…'));

    var statsEl = el('div', { class: 'ad-stats' });

    Promise.all([
      client.from('pages').select('*').order('updated_at', { ascending: false }),
      client.from('pages').select('id,title,status'),
      (function () {
        var q = client.from('page_sections').select('page_id,count', { count: 'exact', head: true });
        return q;
      })()
    ]).then(function (results) {
      var pages = results[0].data || [];
      var published = (results[1].data || []).filter(function (p) { return p.status === 'published'; }).length;
      var sections = results[2].count || 0;

      statsEl.innerHTML = '';
      statsEl.appendChild(el('div', { class: 'ad-stat', children: [el('b', { text: pages.length }), el('span', { text: 'Pages' })] }));
      statsEl.appendChild(el('div', { class: 'ad-stat', children: [el('b', { text: published }), el('span', { text: 'Pages publiées' })] }));
      statsEl.appendChild(el('div', { class: 'ad-stat', children: [el('b', { text: sections }), el('span', { text: 'Sections' })] }));
      main.appendChild(statsEl);

      var card = el('div', { class: 'ad-card' });
      main.appendChild(card);

      if (!pages.length) {
        card.appendChild(el('div', { class: 'ad-empty', html: '<i class="fa-solid fa-folder-open"></i><div>Aucune page — créez la première.</div>' }));
        return initPageActions(card, []);
      }

      var table = el('table', { class: 'ad-table' });
      table.innerHTML = '<thead><tr><th>Page</th><th>Slug</th><th>Statut</th><th>Modifiée</th><th style="text-align:right">Actions</th></tr></thead>';
      var tbody = el('tbody');
      pages.forEach(function (p) {
        var statusBadge = {
          published: '<span class="ad-badge ad-b-published"><i class="fa-solid fa-circle-check"></i> Publiée</span>',
          draft: '<span class="ad-badge ad-b-draft"><i class="fa-solid fa-pen-to-square"></i> Brouillon</span>',
          hidden: '<span class="ad-badge ad-b-hidden"><i class="fa-solid fa-eye-slash"></i> Masquée</span>'
        }[p.status] || '<span class="ad-badge">' + esc(p.status) + '</span>';

        var tr = el('tr', {}, [
          el('td', {}, [el('div', { class: 'ad-row-title', text: p.title }),
            el('div', { class: 'ad-row-sub', text: p.seo_title || '' })]),
          el('td', { html: '<code>#' + esc(p.slug) + '</code>' }),
          el('td', { html: statusBadge }),
          el('td', { class: 'ad-row-sub', text: fmtDate(p.updated_at) }),
          el('td', {}, el('div', { class: 'ad-row-actions' }, [
            el('button', { class: 'ad-btn ad-btn ad-sm', onclick: function () { location.hash = '#/pages/' + encodeURIComponent(p.slug); }, html: '<i class="fa-solid fa-layer-group"></i> Blocs' }),
            el('button', { class: 'ad-btn ad-btn ad-sm', title: 'Ouvrir sur le site', onclick: function () { openPage(p.slug, true); }, html: '<i class="fa-solid fa-arrow-up-right-from-square"></i>' }),
            el('button', { class: 'ad-btn ad-btn ad-sm', title: 'Dupliquer', onclick: function () { duplicatePage(p); }, html: '<i class="fa-solid fa-copy"></i>' }),
            el('button', { class: 'ad-btn ad-btn ad-sm ad-danger', title: 'Supprimer', onclick: function () { deletePage(p); }, html: '<i class="fa-solid fa-trash"></i>' })
          ]))
        ]);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      card.appendChild(table);
      initPageActions(card, pages);
    }).catch(function (e) {
      main.innerHTML = '';
      main.appendChild(el('div', { class: 'ad-card' }, [el('div', { class: 'ad-error-box', text: 'Erreur : ' + e.message }) ]));
    });

    function initPageActions(card, pages) {
      var head = el('div', { class: 'ad-page-head' }, [
        el('div', {}, [
          el('h1', { class: 'ad-page-title', text: 'Pages du site' }),
          el('p', { class: 'ad-page-sub', text: 'Créez et administrez les pages construites avec le CMS.' })
        ]),
        el('button', { class: 'ad-btn ad-primary', onclick: showNewPage, html: '<i class="fa-solid fa-plus"></i> Nouvelle page' })
      ]);
      main.insertBefore(head, main.firstChild);
    }
  }

  function openPage(slug, published) {
    var map = { home: 'index.html', services: 'services.html', portfolio: 'portfolio.html', about: 'a-propos.html', contact: 'contact.html' };
    var file = map[slug] || slug + '.html';
    var url = '../' + file + (published ? '' : '?preview=' + slug);
    window.open(url, '_blank', 'noopener');
  }

  function showNewPage() {
    var m = el('div', { class: 'ad-overlay' });
    m.innerHTML = '<div class="ad-modal">' +
      '<div class="ad-modal-head"><h3 class="ad-modal-title">Nouvelle page</h3><button class="ad-btn ad-ghost ad-icon ad-close-x" type="button"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="ad-modal-body">' +
        '<div class="ad-field"><label>Titre <span class="ad-req">*</span></label><input class="ad-input" data-f="title" placeholder="Titre de la page"></div>' +
        '<div class="ad-field"><label>Slug <span class="ad-req">*</span></label><input class="ad-input" data-f="slug" placeholder="mon-nouveau-projet"></div>' +
        '<div class="ad-grid ad-grid-2">' +
          '<div class="ad-field"><label>Template</label><select class="ad-select" data-f="template"><option value="default">Défaut</option></select></div>' +
          '<div class="ad-field"><label>Statut</label><select class="ad-select" data-f="status"><option value="draft">Brouillon</option><option value="published">Publiée</option><option value="hidden">Masquée</option></select></div>' +
        '</div>' +
        '<div class="ad-field"><label>Balise title (SEO)</label><input class="ad-input" data-f="seo_title"></div>' +
        '<div class="ad-field"><label>Meta description (SEO)</label><textarea class="ad-textarea" data-f="seo_description"></textarea></div>' +
      '</div>' +
      '<div class="ad-modal-foot"><button class="ad-btn ad-ghost ad-cancel" type="button">Annuler</button><button class="ad-btn ad-primary ad-save" type="button"><i class="fa-solid fa-plus"></i> Créer</button></div>' +
    '</div>';
    pushDialog(m);

    var titleInput = $('[data-f="title"]', m);
    var slugInput = $('[data-f="slug"]', m);
    var slugEdited = false;
    titleInput.addEventListener('input', function () {
      if (!slugEdited) slugInput.value = slugify(titleInput.value);
    });
    slugInput.addEventListener('input', function () { slugEdited = true; });

    m.addEventListener('click', function (e) {
      if ($('.ad-save', m) === e.target) {
        var body = {
          title: $('[data-f="title"]', m).value.trim(),
          slug: $('[data-f="slug"]', m).value.trim() || slugify($('[data-f="title"]', m).value),
          template: $('[data-f="template"]', m).value,
          status: $('[data-f="status"]', m).value,
          seo_title: $('[data-f="seo_title"]', m).value.trim(),
          seo_description: $('[data-f="seo_description"]', m).value.trim()
        };
        if (!body.title) { toast('Le titre est requis', 'err'); return; }
        client.from('pages').insert(body).select().then(function (res) {
          if (res.error) { toast(res.error.message || 'Erreur création', 'err'); return; }
          toast('Page créée', 'ok');
          logActivity('create', 'page', res.data[0].id, { slug: body.slug });
          closeDialog();
          m.remove();
          location.hash = '#/pages/' + encodeURIComponent(body.slug);
        });
      }
      if (e.target === m || $('.ad-close-x', m) === e.target || $('.ad-cancel', m) === e.target) { closeDialog(); m.remove(); }
    });
  }

  function duplicatePage(page) {
    client.from('pages').select('*').eq('id', page.id).single().then(function (r) {
      var p = r.data;
      var copy = {
        title: p.title + ' (copie)', slug: slugify(p.slug + '-copie'), template: p.template,
        status: 'draft', seo_title: p.seo_title, seo_description: p.seo_description
      };
      return client.from('pages').insert(copy).select().single();
    }).then(function (res) {
      if (res.error) throw res.error;
      var newPage = res.data;
      return client.from('page_sections').select('*').eq('page_id', page.id).order('display_order').then(function (secs) {
        var rows = (secs.data || []).map(function (s) {
          return { page_id: newPage.id, section_type: s.section_type, title: s.title, subtitle: s.subtitle, content: s.content, image: s.image, background: s.background, configuration: s.configuration, visibility: 'hidden', display_order: s.display_order, status: 'draft' };
        });
        return Promise.all(rows.map(function (r) { return client.from('page_sections').insert(r); }));
      });
    }).then(function () {
      toast('Page dupliquée', 'ok');
      logActivity('duplicate', 'page', page.id);
      location.hash = '#/pages';
    }).catch(function (e) { toast('Erreur : ' + e.message, 'err'); });
  }

  function deletePage(page) {
    if (!confirm('Supprimer définitivement la page « ' + page.title + ' » et toutes ses sections ?')) return;
    client.from('pages').delete().eq('id', page.id).then(function (res) {
      if (res.error) { toast(res.error.message || 'Erreur', 'err'); return; }
      toast('Page supprimée', 'ok');
      logActivity('delete', 'page', page.id);
      location.hash = '#/pages';
    });
  }

  /* =========================================================
     BUILDER (page builder)
     ========================================================= */
  function renderBuilder(slugRaw) {
    setActiveNav('pages');
    var slug = decodeURIComponent(slugRaw);
    var main = $('#ad-main');
    main.innerHTML = '';
    main.appendChild(loading('Chargement…'));

    client.from('pages').select('*').eq('slug', slug).single().then(function (pageRes) {
      if (pageRes.error || !pageRes.data) { renderPages(); return; }
      var page = pageRes.data;
      return client.from('page_sections').select('*').eq('page_id', page.id).order('display_order', { ascending: true }).then(function (secRes) {
        CURRENT.page = page;
        CURRENT.sections = secRes.data || [];
        renderBuilderUI(main, page);
      });
    }).catch(function (e) { toast('Erreur : ' + e.message, 'err'); });
  }

  function renderBuilderUI(main, page) {
    main.innerHTML = '';

    var statusBadge = page.status === 'published'
      ? '<span class="ad-badge ad-b-published"><i class="fa-solid fa-circle-check"></i> Publiée</span>'
      : page.status === 'hidden'
        ? '<span class="ad-badge ad-b-hidden"><i class="fa-solid fa-eye-slash"></i> Masquée</span>'
        : '<span class="ad-badge ad-b-draft"><i class="fa-solid fa-pen-to-square"></i> Brouillon</span>';

    var head = el('div', { class: 'ad-page-head' }, [
      el('div', {}, [
        el('h1', { class: 'ad-page-title', html: esc(page.title) + ' ' + statusBadge }),
        el('p', { class: 'ad-page-sub', html: 'Slug : <code>#' + esc(page.slug) + '</code> · ' + CURRENT.sections.length + ' section(s) · Modifiée le ' + fmtDate(page.updated_at) })
      ]),
      el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } }, [
        el('button', {
          class: 'ad-btn ad-btn ad-ghost', onclick: function () { openPage(page.slug, false); },
          html: '<i class="fa-solid fa-eye"></i> Aperçu'
        }),
        el('button', {
          class: 'ad-btn ad-btn ad-ghost', onclick: function () { openPage(page.slug, true); },
          html: '<i class="fa-solid fa-arrow-up-right-from-square"></i> Voir en ligne'
        }),
        el('button', {
          class: 'ad-btn ad-btn ad-ghost', onclick: function () { previewModal(); },
          html: '<i class="fa-solid fa-display"></i> Aperçu intégré'
        }),
        el('button', {
          class: 'ad-btn ad-btn ad-primary', onclick: publishPage,
          html: '<i class="fa-solid fa-rocket"></i> Publier la page'
        })
      ])
    ]);
    main.appendChild(head);

    var sectionList = el('div', { class: 'ad-builder-list', id: 'ad-section-list' });
    var emptyHint = el('div', { class: 'ad-empty', id: 'ad-empty-hint', html: '<i class="fa-solid fa-layer-group"></i><div>Aucune section — ajoutez votre premier bloc.</div>' });
    main.appendChild(emptyHint);
    main.appendChild(sectionList);

    var addbar = el('div', { style: { marginTop: '18px' } }, [
      el('button', { class: 'ad-btn ad-primary', onclick: showAddBlock, html: '<i class="fa-solid fa-plus"></i> Ajouter un bloc' })
    ]);
    main.appendChild(addbar);

    var dragSrc = null;
    function drawSections() {
      sectionList.innerHTML = '';
      if (CURRENT.sections.length) emptyHint.style.display = 'none';
      else emptyHint.style.display = '';

      CURRENT.sections.forEach(function (sec, i) {
        var t = window.BRAINCMS.getType(sec.section_type);
        var row = el('div', {
          class: 'ad-section-row', draggable: 'true',
          id: 'sec-' + sec.id
        }, [
          el('span', { class: 'ad-drag-handle', html: '<i class="fa-solid fa-grip-vertical"></i>' }),
          el('div', { class: 'ad-section-ic', html: '<i class="fa-solid ' + (t ? escAttr(t.icon) : 'fa-puzzle-piece') + '"></i>' }),
          el('div', { class: 'ad-section-main' }, [
            el('div', { class: 'ad-section-title', text: sec.title || (t ? t.label : sec.section_type) }),
            el('div', { class: 'ad-section-meta' }, [
              el('span', { class: 'ad-badge ' + (sec.status === 'published' ? 'ad-b-published' : 'ad-b-draft'),
                html: sec.status === 'published' ? '<i class="fa-solid fa-circle-check"></i> Publié' : '<i class="fa-solid fa-pen-to-square"></i> Brouillon' }),
              sec.visibility === 'hidden'
                ? el('span', { class: 'ad-badge ad-b-hidden', html: '<i class="fa-solid fa-eye-slash"></i> Masqué' })
                : el('span', { class: 'ad-badge', html: '<i class="fa-solid fa-eye"></i> Visible' }),
              (t ? el('span', { class: 'ad-step', text: t.label }) : el('span', { class: 'ad-step', text: sec.section_type })),
              el('span', { class: 'ad-step', text: '#' + (i + 1) })
            ])
          ]),
          el('div', { class: 'ad-section-tools' }, [
            el('button', { class: 'ad-btn ad-sm ad-icon', title: 'Remonter', onclick: function () { moveSection(sec, i, -1); }, html: '<i class="fa-solid fa-chevron-up"></i>' }),
            el('button', { class: 'ad-btn ad-sm ad-icon', title: 'Descendre', onclick: function () { moveSection(sec, i, 1); }, html: '<i class="fa-solid fa-chevron-down"></i>' }),
            el('button', { class: 'ad-btn ad-sm ad-icon', title: 'Masquer / afficher', onclick: function () { toggleVisibility(sec); }, html: '<i class="fa-solid fa-eye' + (sec.visibility === 'hidden' ? '-slash' : '') + '"></i>' }),
            el('button', { class: 'ad-btn ad-sm ad-icon', title: 'Dupliquer', onclick: function () { duplicateSection(sec); }, html: '<i class="fa-solid fa-copy"></i>' }),
            el('button', { class: 'ad-btn ad-sm ad-icon', title: 'Modifier', onclick: function () { openEditor(sec); }, html: '<i class="fa-solid fa-pen"></i>' }),
            el('button', { class: 'ad-btn ad-sm ad-icon ad-danger', title: 'Supprimer', onclick: function () { deleteSection(sec); }, html: '<i class="fa-solid fa-trash"></i>' })
          ])
        ]);

        /* Drag & drop */
        row.addEventListener('dragstart', function (e) {
          dragSrc = { id: sec.id, index: i };
          row.classList.add('ad-dragging');
          e.dataTransfer.effectAllowed = 'move';
          try { e.dataTransfer.setData('text/plain', sec.id); } catch (e2) {}
        });
        row.addEventListener('dragend', function () { row.classList.remove('ad-dragging'); dragSrc = null; });
        row.addEventListener('dragover', function (e) { e.preventDefault(); row.classList.add('ad-drag-over'); });
        row.addEventListener('dragleave', function () { row.classList.remove('ad-drag-over'); });
        row.addEventListener('drop', function (e) {
          e.preventDefault();
          row.classList.remove('ad-drag-over');
          if (!dragSrc || dragSrc.id === sec.id) return;
          applyDrop(dragSrc.id, sec.id);
        });

        sectionList.appendChild(row);
      });
    }
    drawSections();

    function applyDrop(fromId, toId) {
      var arr = CURRENT.sections.slice();
      var fromIdx = arr.findIndex(function (s) { return s.id === fromId; });
      var toIdx = arr.findIndex(function (s) { return s.id === toId; });
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
      var moved = arr.splice(fromIdx, 1)[0];
      arr.splice(toIdx, 0, moved);
      persistOrder(arr);
    }
    function moveSection(sec, index, dir) {
      var arr = CURRENT.sections.slice();
      var target = index + dir;
      if (target < 0 || target >= arr.length) return;
      arr.splice(index, 1);
      arr.splice(target, 0, sec);
      persistOrder(arr);
    }
    function persistOrder(arr) {
      var updates = arr.map(function (s, i) {
        return client.from('page_sections').update({ display_order: i + 1 }).eq('id', s.id).then(function (r) { if (r.error) throw r.error; });
      });
      Promise.all(updates).then(function () {
        CURRENT.sections = arr;
        drawSections();
        toast('Ordre enregistré', 'ok');
        logActivity('reorder', 'page', page.id);
      }).catch(function (e) { toast('Erreur réordonnancement : ' + e.message, 'err'); renderBuilder(slug); });
    }

    /* -------- Actions CRUD -------- */
    function toggleVisibility(sec) {
      var next = sec.visibility === 'hidden' ? 'visible' : 'hidden';
      client.from('page_sections').update({ visibility: next }).eq('id', sec.id).then(function (r) {
        if (r.error) { toast(r.error.message, 'err'); return; }
        sec.visibility = next;
        toast(next === 'visible' ? 'Section affichée' : 'Section masquée', 'ok');
        drawSections();
      });
    }
    function duplicateSection(sec) {
      client.from('page_sections').insert({
        page_id: page.id, section_type: sec.section_type, title: sec.title, subtitle: sec.subtitle,
        content: sec.content, image: sec.image, background: sec.background,
        configuration: sec.configuration || {}, visibility: 'hidden',
        display_order: (sec.display_order || CURRENT.sections.length) + 1, status: 'draft'
      }).select().single().then(function (r) {
        if (r.error) throw r.error;
        toast('Bloc dupliqué (brouillon, masqué)', 'ok');
        logActivity('duplicate', 'page_section', sec.id);
        renderBuilder(slug);
      }).catch(function (e) { toast('Erreur : ' + e.message, 'err'); });
    }
    function deleteSection(sec) {
      if (!confirm('Supprimer ce bloc ?')) return;
      client.from('page_sections').delete().eq('id', sec.id).then(function (r) {
        if (r.error) { toast(r.error.message, 'err'); return; }
        toast('Bloc supprimé', 'ok');
        logActivity('delete', 'page_section', sec.id);
        renderBuilder(slug);
      });
    }
    function publishPage() {
      client.from('pages').update({ status: 'published' }).eq('id', page.id).then(function (r) {
        if (r.error) { toast(r.error.message, 'err'); return; }
        toast('Page publiée — le site est en ligne', 'ok');
        logActivity('publish', 'page', page.id, { slug: page.slug });
        renderBuilder(slug);
      });
    }
  }

  /* -------- Ajouter un bloc -------- */
  function showAddBlock() {
    var m = el('div', { class: 'ad-overlay' });
    m.innerHTML = '<div class="ad-modal">' +
      '<div class="ad-modal-head"><h3 class="ad-modal-title">Ajouter un bloc</h3><button class="ad-btn ad-ghost ad-icon ad-close-x"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="ad-modal-body"><div class="ad-blocks" id="ad-blocks-grid"></div></div>' +
      '<div class="ad-modal-foot"><button class="ad-btn ad-ghost ad-cancel">Annuler</button></div>' +
    '</div>';
    pushDialog(m);

    var grid = $('#ad-blocks-grid', m);
    window.BRAINCMS.BLOCK_TYPES.forEach(function (t) {
      grid.appendChild(el('div', {
        class: 'ad-block-item',
        onclick: function () { m.remove(); addNewSection(t.type); }
      }, [
        el('div', { class: 'ad-bi-icon', html: '<i class="fa-solid ' + escAttr(t.icon) + '"></i>' }),
        el('div', { class: 'ad-bi-label', text: t.label }),
        el('div', { class: 'ad-bi-desc', text: t.description || '' })
      ]));
    });

    m.addEventListener('click', function (e) {
      if (e.target === m || $('.ad-close-x', m) === e.target || $('.ad-cancel', m) === e.target) { closeDialog(); m.remove(); }
    });
  }

  function addNewSection(type) {
    var def = window.BRAINCMS.getType(type);
    if (!def) return;
    var configuration = {};
    var fields = editorFields(def);
    fields.forEach(function (f) {
      if (COLUMNS[f.name]) return;
      if (f.default !== undefined) configuration[f.name] = f.default;
    });
    configuration.tag = def.type === 'services' ? 'Nos expertises' : '';

    var maxOrder = CURRENT.sections.reduce(function (m, s) { return Math.max(m, s.display_order || 0); }, 0);

    client.from('page_sections').insert({
      page_id: CURRENT.page.id, section_type: type,
      title: '', subtitle: '', content: '', image: null, background: configuration.background || null,
      configuration: configuration, visibility: 'visible', display_order: maxOrder + 1, status: 'draft'
    }).select().single().then(function (r) {
      if (r.error) throw r.error;
      toast('Bloc « ' + def.label + ' » ajouté (brouillon)', 'ok');
      logActivity('create', 'page_section', r.data.id, { type: type });
      renderBuilder(CURRENT.page.slug);
      openEditor(r.data);
    }).catch(function (e) { toast('Erreur : ' + e.message, 'err'); });
  }

  /* -------- Champs d'édition (base + spécifiques, dédupliqués) -------- */
  function editorFields(def) {
    var list = [];
    function push(f) {
      if (!f || !f.name) return;
      if (list.some(function (x) { return x.name === f.name; })) return;
      list.push(f);
    }
    window.BRAINCMS.baseFields.forEach(push);
    (def.fields || []).forEach(push);
    return list;
  }

  /* -------- Éditeur de section (tiroir) -------- */
  function openEditor(sec) {
    var def = window.BRAINCMS.getType(sec.section_type);
    if (!def) return;
    var fields = editorFields(def);
    var values = mergeValues(sec, fields);

    var drawer = el('div', { class: 'ad-drawer' });
    drawer.innerHTML =
      '<div class="ad-drawer-panel">' +
        '<div class="ad-drawer-head">' +
          '<div class="ad-section-ic"><i class="fa-solid ' + escAttr(def.icon) + '"></i></div>' +
          '<h3 class="ad-modal-title">' + esc(def.label) + '</h3>' +
          '<span class="ad-badge ' + (sec.status === 'published' ? 'ad-b-published' : 'ad-b-draft') + '" id="ad-sec-status">' + (sec.status === 'published' ? 'Publié' : 'Brouillon') + '</span>' +
          '<button class="ad-btn ad-ghost ad-icon ad-close-x"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '<div class="ad-drawer-body"><div id="ad-sec-errors"></div><form id="ad-sec-form"></form></div>' +
        '<div class="ad-drawer-foot">' +
          '<button class="ad-btn ad-danger ad-del-sec"><i class="fa-solid fa-trash"></i> Supprimer</button>' +
          '<div class="ad-right">' +
            '<button class="ad-btn ad-ghost ad-cancel">Annuler</button>' +
            '<button class="ad-btn ad-save-draft"><i class="fa-solid fa-save"></i> Enregistrer le brouillon</button>' +
            '<button class="ad-btn ad-primary ad-save-pub"><i class="fa-solid fa-circle-check"></i> Enregistrer & publier</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    pushDialog(drawer);

    var form = $('#ad-sec-form', drawer);
    fields.forEach(function (f) {
      form.appendChild(buildField(f, values[f.name], drawer));
    });

    function collect() {
      var data = {};
      $$('[data-field]', form).forEach(function (input) {
        var name = input.getAttribute('data-field');
        if (!name || !input.closest) return;
        if (input.closest('[data-repeater]')) return;
        if (input.type === 'checkbox') { data[name] = input.checked; return; }
        if (input.type === 'number') { data[name] = input.value === '' ? null : parseFloat(input.value); return; }
        data[name] = input.getAttribute('type') === 'hidden' ? (input.value || null) : input.value;
      });
      $$('[data-repeater]', form).forEach(function (holder) {
        var name = holder.getAttribute('data-name');
        if (name && holder.__rep) data[name] = holder.__rep();
      });
      return { data: data, errors: [] };
    }

    function showErrors(errors) {
      var box = $('#ad-sec-errors', drawer);
      if (!errors.length) { box.innerHTML = ''; return; }
      box.innerHTML = '<div class="ad-error-box"><strong>Corrigez :</strong><ul>' + errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>';
    }

    function persist(status) {
      var c = collect();
      var secData = { status: status };
      var config = {};
      Object.keys(c.data).forEach(function (k) {
        if (COLUMNS[k]) secData[k] = (k === 'content' || k === 'subtitle' || k === 'title') ? (c.data[k] == null ? '' : String(c.data[k])) : c.data[k];
        else config[k] = c.data[k];
      });

      secData.background = config.background || null;

      var errors = [];
      if (status === 'published') {
        errors = window.BRAINCMS.validateSection({ section_type: sec.section_type, configuration: config, title: secData.title, content: secData.content, image: secData.image });
      }
      if (errors.length) {
        showErrors(errors);
        toast('Le bloc contient des erreurs (voir la liste)', 'err');
        return;
      }
      showErrors([]);

      var payload = { status: status, configuration: config, title: secData.title || null, subtitle: secData.subtitle || null, content: secData.content || null, image: secData.image || null, background: config.background || null };
      client.from('page_sections').update(payload).eq('id', sec.id)
        .then(function (r) {
          if (r.error) { toast(r.error.message || 'Erreur', 'err'); return; }
          toast(status === 'published' ? 'Bloc publié' : 'Brouillon enregistré', 'ok');
          logActivity('update', 'page_section', sec.id, { status: status, type: sec.section_type });
          drawer.remove();
          renderBuilder(CURRENT.page.slug);
        });
    }

    $('.ad-save-draft', drawer).addEventListener('click', function () { persist('draft'); });
    $('.ad-save-pub', drawer).addEventListener('click', function () { persist('published'); });
    $('.ad-cancel', drawer).addEventListener('click', function () { closeDialog(); drawer.remove(); });
    $('.ad-close-x', drawer).addEventListener('click', function () { closeDialog(); drawer.remove(); });
    $('.ad-del-sec', drawer).addEventListener('click', function () {
      if (!confirm('Supprimer ce bloc ?')) return;
      client.from('page_sections').delete().eq('id', sec.id).then(function (r) {
        if (r.error) { toast(r.error.message, 'err'); return; }
        logActivity('delete', 'page_section', sec.id);
        drawer.remove();
        toast('Bloc supprimé', 'ok');
        renderBuilder(CURRENT.page.slug);
      });
    });
  }

  function mergeValues(sec, fields) {
    var values = {};
    fields.forEach(function (f) {
      if (COLUMNS[f.name]) values[f.name] = sec[f.name];
      else if (sec.configuration && f.name in sec.configuration) values[f.name] = sec.configuration[f.name];
    });
    return values;
  }

  /* -------- Construction de champ -------- */
  function buildField(f, value, root) {
    value = value === undefined ? (f.default !== undefined ? f.default : '') : value;
    var wrap = el('div', { class: 'ad-field' });
    var label = el('label', { text: f.label + (f.label ? '' : '') });
    if (f.placeholder && (f.type === 'text' || f.type === 'textarea')) label.appendChild(el('span', { class: 'ad-req', text: ' • ' + f.placeholder }));
    wrap.appendChild(label);

    if (f.type === 'text' || f.type === 'url') {
      if (f.name === 'title') label.innerHTML = 'Titre';
      wrap.appendChild(el('input', { class: 'ad-input', type: 'text', 'data-field': f.name, value: value == null ? '' : value, placeholder: f.placeholder || '' }));
    } else if (f.type === 'textarea') {
      wrap.appendChild(el('textarea', { class: 'ad-textarea', 'data-field': f.name, html: esc(value), placeholder: f.placeholder || '' }));
    } else if (f.type === 'number') {
      wrap.appendChild(el('input', { class: 'ad-input', type: 'number', 'data-field': f.name, value: value == null ? '' : value }));
    } else if (f.type === 'checkbox') {
      var ck = el('input', { class: 'ad-input', type: 'checkbox', 'data-field': f.name, checked: !!value });
      ck.style.width = 'auto';
      wrap.appendChild(el('label', { class: 'ad-check', html: '' }));
      wrap.innerHTML = '<label>' + esc(f.label) + '</label><label class="ad-check"><input type="checkbox" data-field="' + escAttr(f.name) + '"' + (value ? ' checked' : '') + '><span>Activé</span></label>';
    } else if (f.type === 'select') {
      var opts = (f.options || []).map(function (o) {
        return '<option value="' + escAttr(o[0]) + '"' + (String(value) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('');
      wrap.innerHTML = '<label>' + esc(f.label) + '</label><select class="ad-select" data-field="' + escAttr(f.name) + '">' + opts + '</select>';
    } else if (f.type === 'icon') {
      var iconOpts = (f.options || window.BRAINCMS.ICONS).map(function (i) {
        return '<option value="' + escAttr(i) + '"' + (String(value) === String(i) ? ' selected' : '') + '>' + esc(i) + '</option>';
      }).join('');
      wrap.innerHTML = '<label>' + esc(f.label) + '</label><select class="ad-select" data-field="' + escAttr(f.name) + '">' + iconOpts + '</select>';
    } else if (f.type === 'image') {
      var imgPreview = value
        ? '<img src="' + escAttr(value) + '" alt="">'
        : '<span class="ad-img-empty"><i class="fa-solid fa-image"></i> Aucune image</span>';
      wrap.innerHTML = '<label>' + esc(f.label) + '</label><div class="ad-img-field"><div class="ad-img-preview" id="ad-img-pv" data-pv="' + escAttr(f.name) + '">' + imgPreview + '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button type="button" class="ad-btn ad-sm ad-pick-img" data-name="' + escAttr(f.name) + '"><i class="fa-solid fa-folder-open"></i> Choisir</button>' +
          '<button type="button" class="ad-btn ad-sm ad-clear-img" data-name="' + escAttr(f.name) + '"><i class="fa-solid fa-trash"></i></button>' +
        '</div></div>';
      wrap.addEventListener('click', function (e) {
        var t = e.target.closest('[data-name]');
        if (!t) return;
        var name = t.getAttribute('data-name');
        if (t.classList.contains('ad-pick-img')) {
          openMediaModal(function (src) {
            wrap.querySelector('[data-pv="' + name + '"]').innerHTML = '<img src="' + escAttr(src) + '" alt="">';
            setIdFor(wrap, name, src);
          });
        } else if (t.classList.contains('ad-clear-img')) {
          wrap.querySelector('[data-pv="' + name + '"]').innerHTML = '<span class="ad-img-empty"><i class="fa-solid fa-image"></i> Aucune image</span>';
          setIdFor(wrap, name, null);
        }
      });
      wrap.appendChild(el('input', { type: 'hidden', 'data-field': f.name, value: value || '' }));
    } else if (f.type === 'repeater') {
      wrap.remove();
      wrap = buildRepeater(f, value, root);
      return wrap;
    }

    if (f.help) wrap.appendChild(el('div', { class: 'ad-hint', text: f.help }));

    return wrap;
  }

  function setIdFor(wrap, name, src) {
    var hidden = wrap.querySelector('input[type=hidden][data-field="' + name + '"]');
    if (hidden) hidden.value = src || '';
  }

  /* -------- Repeater -------- */
  function buildRepeater(f, value, root) {
    var rows = Array.isArray(value) ? value.slice() : [];
    var wrap = el('div', { class: 'ad-field' });
    wrap.appendChild(el('label', { text: f.label }));
    var holder = el('div', { class: 'ad-repeater', 'data-repeater': '1', 'data-name': f.name });
    wrap.appendChild(holder);

    function rowTitle(row, i) {
      var first = f.fields[0];
      var v = row && first ? row[first.name] : '';
      return (i + 1) + '. ' + (v ? String(v) : 'Élément');
    }
    function drawRow(row, i) {
      var r = el('div', { class: 'ad-rep-row' });
      var head = el('div', { class: 'ad-rep-head' });
      head.innerHTML = '<span class="ad-rep-index">' + (i + 1) + '</span>' +
        '<span class="ad-rep-title">' + esc(rowTitle(row, i)) + '</span>' +
        '<span class="ad-rep-chev"><i class="fa-solid fa-chevron-down"></i></span>';
      var tools = el('div', { class: 'ad-rep-tools' }, [
        el('button', { type: 'button', class: 'ad-rep-move', title: 'Monter', html: '<i class="fa-solid fa-arrow-up"></i>', onclick: function () { move(i, -1); } }),
        el('button', { type: 'button', class: 'ad-rep-move', title: 'Descendre', html: '<i class="fa-solid fa-arrow-down"></i>', onclick: function () { move(i, 1); } }),
        el('button', { type: 'button', class: 'ad-btn ad-sm ad-danger', title: 'Supprimer', html: '<i class="fa-solid fa-trash"></i>', onclick: function () { removeRow(i); } })
      ]);
      head.appendChild(tools);
      var body = el('div', { class: 'ad-rep-body' });
      f.fields.forEach(function (sf) {
        body.appendChild(buildField(sf, row[sf.name], root));
      });
      r.appendChild(head); r.appendChild(body);
      head.addEventListener('click', function () { r.classList.toggle('ad-open'); body.classList.toggle('ad-open'); });
      return r;
    }
    function redraw() {
      holder.innerHTML = '';
      rows.forEach(function (row, i) { holder.appendChild(drawRow(row, i)); });
    }
    function collectRow(r) {
      var obj = {};
      $$('[data-field]', r).forEach(function (input) {
        var name = input.getAttribute('data-field');
        if (!name) return;
        if (input.type === 'checkbox') obj[name] = input.checked;
        else if (input.type === 'number') obj[name] = input.value === '' ? null : parseFloat(input.value);
        else obj[name] = input.getAttribute('type') === 'hidden' ? (input.value || null) : input.value;
      });
      return obj;
    }
    function move(i, dir) {
      var t = i + dir;
      if (t < 0 || t >= rows.length) return;
      var x = rows.splice(i, 1)[0];
      rows.splice(t, 0, x);
      redraw();
    }
    function removeRow(i) { rows.splice(i, 1); redraw(); }
    function addRow() {
      var empty = {};
      f.fields.forEach(function (sf) { empty[sf.name] = sf.default !== undefined ? sf.default : (sf.type === 'checkbox' ? false : ''); });
      rows.push(empty);
      redraw();
    }

    holder.__rep = function () { return rows.slice(); };
    redraw();
    wrap.appendChild(el('button', { type: 'button', class: 'ad-add-rep', onclick: addRow, html: '<i class="fa-solid fa-plus"></i> ' + (f.addLabel || 'Ajouter une entrée') }));
    return wrap;
  }

  /* -------- Médias -------- */
  function openMediaModal(onSelect, current) {
    var m = el('div', { class: 'ad-overlay' });
    m.innerHTML = '<div class="ad-modal">' +
      '<div class="ad-modal-head"><h3 class="ad-modal-title">Médiathèque</h3><button class="ad-btn ad-ghost ad-icon ad-close-x"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="ad-modal-body">' +
        '<div class="ad-upload-zone" id="ad-upload-zone">' +
          '<i class="fa-solid fa-cloud-arrow-up"></i>' +
          '<div><b>Cliquez</b> ou glissez une image ici pour l\'envoyer</div>' +
        '</div>' +
        '<input type="file" id="ad-file" accept="image/*" style="display:none" multiple>' +
        '<div style="margin:14px 0 8px"><b>Images disponibles</b></div>' +
        '<div class="ad-media-grid" id="ad-media-grid">' + '<div class="ad-empty" style="padding:24px"><i class="fa-solid fa-spinner fa-spin"></i></div>' + '</div>' +
      '</div>' +
      '<div class="ad-modal-foot"><button class="ad-btn ad-ghost ad-cancel">Fermer</button></div>' +
    '</div>';
    pushDialog(m);

    var grid = $('#ad-media-grid', m);
    var files = $('#ad-file', m);
    var dz = $('#ad-upload-zone', m);

    function loadMedia() {
      grid.innerHTML = '<div class="ad-empty" style="padding:24px"><i class="fa-solid fa-spinner fa-spin"></i></div>';
      client.from('media').select('*').order('created_at', { ascending: false }).then(function (r) {
        grid.innerHTML = '';
        var list = r.data || [];
        if (!list.length) { grid.innerHTML = '<div class="ad-empty" style="grid-column:1/-1;padding:24px"><i class="fa-solid fa-image"></i><div>Aucun média — envoyez une image ci-dessus.</div></div>'; return; }
        list.forEach(function (md) {
          var item = el('div', { class: 'ad-media-item' + (current === md.url ? ' ad-selected' : ''), onclick: function () { onSelect(md.url); closeDialog(); m.remove(); } }, [
            md.type && md.type.indexOf('video') === 0 ? el('div', { class: 'cms-media-video' }) : el('img', { src: md.url, alt: md.name, loading: 'lazy' }),
            el('div', { class: 'ad-media-name', text: md.name })
          ]);
          grid.appendChild(item);
        });
      });
    }

    dz.addEventListener('click', function () { files.click(); });
    dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('ad-over'); });
    dz.addEventListener('dragleave', function () { dz.classList.remove('ad-over'); });
    dz.addEventListener('drop', function (e) {
      e.preventDefault(); dz.classList.remove('ad-over');
      uploadFiles(e.dataTransfer.files);
    });
    files.addEventListener('change', function () { if (files.files.length) uploadFiles(files.files); files.value = ''; });

    function uploadFiles(fileList) {
      var list = Array.prototype.slice.call(fileList).filter(function (f) { return f && f.type.indexOf('image/') === 0 && f.type.indexOf('svg') === -1; });
      if (!list.length) { toast('Seules les images (JPG, PNG, WEBP) sont acceptées', 'err'); return; }
      var total = list.length;
      var done = 0;
      list.forEach(function (file) {
        var extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
        var ext = extMap[file.type] || 'jpg';
        var name = Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '.' + ext;
        client.storage.from('media').upload(name, file, { cacheControl: '3600', upsert: false }).then(function (up) {
          if (up.error) throw new Error(up.error.message || 'Upload échoué');
          var { data } = client.storage.from('media').getPublicUrl(name);
          var url = data.publicUrl;
          return client.from('media').insert({ name: file.name, url: url, type: file.type, size: file.size }).select().single();
        }).then(function () {
          done++;
          if (done === total) { loadMedia(); toast(total + ' image(s) importée(s)', 'ok'); }
        }).catch(function (e) { done++; toast('Erreur : ' + e.message, 'err'); });
      });
    }

    m.addEventListener('click', function (e) {
      if (e.target === m || $('.ad-close-x', m) === e.target || $('.ad-cancel', m) === e.target) { closeDialog(); m.remove(); }
    });
    loadMedia();
  }

  /* =========================================================
     MÉDIAS (page)
     ========================================================= */
  function renderMedia() {
    setActiveNav('media');
    var main = $('#ad-main');
    main.innerHTML = '';
    main.appendChild(el('div', { class: 'ad-page-head' }, [
      el('div', {}, [el('h1', { class: 'ad-page-title', text: 'Médiathèque' }), el('p', { class: 'ad-page-sub', text: 'Images uploadées dans le stockage Supabase.' })]),
      el('button', { class: 'ad-btn ad-btn ad-danger', onclick: ensureBucketThen(renderMedia), html: '<i class="fa-solid fa-rotate"></i> Actualiser' })
    ]));

    var dz = el('div', { class: 'ad-upload-zone', id: 'ad-up-page' });
    dz.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i><div><b>Cliquez</b> ou glissez des images pour les envoyer dans la médiathèque</div>';
    main.appendChild(dz);
    var fileIn = el('input', { type: 'file', accept: 'image/*', style: 'display:none', multiple: true });
    main.appendChild(fileIn);
    dz.addEventListener('click', function () { fileIn.click(); });
    dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('ad-over'); });
    dz.addEventListener('dragleave', function () { dz.classList.remove('ad-over'); });
    dz.addEventListener('drop', function (e) { e.preventDefault(); dz.classList.remove('ad-over'); uploadHere(e.dataTransfer.files, refresh); });

    var gridWrap = el('div');
    main.appendChild(gridWrap);
    var grid = el('div', { class: 'ad-media-grid' });
    gridWrap.appendChild(grid);

    function refresh() {
      grid.innerHTML = '<div class="ad-empty" style="grid-column:1/-1"><i class="fa-solid fa-spinner fa-spin"></i></div>';
      client.from('media').select('*').order('created_at', { ascending: false }).then(function (r) {
        grid.innerHTML = '';
        var list = r.data || [];
        if (!list.length) { grid.innerHTML = '<div class="ad-empty" style="grid-column:1/-1"><i class="fa-solid fa-images"></i><div>Aucun média.</div></div>'; return; }
        list.forEach(function (md) {
          var item = el('div', { class: 'ad-media-item', title: md.name }, [
            el('img', { src: md.url, alt: md.name, loading: 'lazy' }),
            el('div', { class: 'ad-media-name', text: md.name }),
            el('button', { class: 'ad-btn ad-sm ad-icon ad-danger', title: 'Copier l\'URL', onclick: (function (u) { return function (e) { e.stopPropagation(); copyUrl(u); }; })(md.url), html: '<i class="fa-solid fa-link"></i>' })
          ]);
          grid.appendChild(item);
        });
      });
    }

    function uploadHere(fileList, after) {
      var list = Array.prototype.slice.call(fileList).filter(function (f) { return f && f.type.indexOf('image/') === 0 && f.type.indexOf('svg') === -1; });
      if (!list.length) { toast('Images JPG/PNG/WEBP uniquement', 'err'); return; }
      var total = list.length, done = 0;
      list.forEach(function (file) {
        var ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type] || 'jpg';
        var name = Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '.' + ext;
        client.storage.from('media').upload(name, file, { cacheControl: '3600' }).then(function (up) {
          if (up.error) throw new Error(up.error.message || 'Echec');
          var url = client.storage.from('media').getPublicUrl(name).data.publicUrl;
          return client.from('media').insert({ name: file.name, url: url, type: file.type, size: file.size });
        }).then(function () {
          done++; if (done === total) { toast(total + ' image(s) importée(s)', 'ok'); logActivity('upload', 'media'); after(); }
        }).catch(function (e) { done++; toast('Erreur : ' + e.message, 'err'); });
      });
    }

    function copyUrl(u) {
      if (navigator.clipboard) navigator.clipboard.writeText(u).then(function () { toast('URL copiée', 'ok'); });
      else prompt('Copiez cette URL :', u);
    }

    refresh();
  }

  function ensureBucketThen(cb) { ensureMediaBucket().then(cb, cb); }

  /* =========================================================
     RÉGLAGES
     ========================================================= */
  function renderSettings() {
    setActiveNav('settings');
    var main = $('#ad-main');
    main.innerHTML = '';
    main.appendChild(el('div', { class: 'ad-page-head' }, [
      el('div', {}, [el('h1', { class: 'ad-page-title', text: 'Réglages du site' }), el('p', { class: 'ad-page-sub', text: 'Clés/valeurs JSON réservées au développeur.' })]),
      el('button', { class: 'ad-btn ad-btn ad-primary', onclick: function () { renderSettings(); }, html: '<i class="fa-solid fa-rotate"></i> Actualiser' })
    ]));

    var card = el('div', { class: 'ad-card' });
    main.appendChild(card);

    function load() {
      card.innerHTML = '';
      client.from('site_settings').select('*').order('key').then(function (r) {
        if (r.error) { card.innerHTML = ''; card.appendChild(el('div', { class: 'ad-error-box', text: r.error.message })); return; }
        var list = r.data || [];
        if (!list.length) card.appendChild(el('div', { class: 'ad-empty', html: '<i class="fa-solid fa-sliders"></i><div>Aucun réglage.</div>' }));
        list.forEach(function (set) {
          var row = el('div', { style: { borderBottom: '1px solid var(--ad-border)', paddingBottom: '14px', marginBottom: '14px' } }, [
            el('label', { text: set.key }),
            el('textarea', { class: 'ad-textarea', 'data-set-key': set.key, html: esc(JSON.stringify(set.value, null, 2)) }),
            el('div', { style: { textAlign: 'right', marginTop: '6px' } }, [
              el('button', { class: 'ad-btn ad-btn ad-sm', onclick: function () { saveRow(set.key, row); }, html: '<i class="fa-solid fa-save"></i> Enregistrer' })
            ])
          ]);
          card.appendChild(row);
        });
      });
    }
    function saveRow(key, row) {
      var raw = $('[data-set-key="' + key + '"]', row).value;
      var val;
      try { val = JSON.parse(raw); } catch (e) { toast('JSON invalide : ' + e.message, 'err'); return; }
      client.from('site_settings').upsert({ key: key, value: val }).then(function (r) {
        if (r.error) { toast(r.error.message || 'Erreur', 'err'); return; }
        toast('Réglage « ' + key + ' » enregistré', 'ok');
      });
    }
    load();
  }

  /* =========================================================
     JOURNAL D'ACTIVITÉ
     ========================================================= */
  function renderLogs() {
    setActiveNav('logs');
    var main = $('#ad-main');
    main.innerHTML = '';
    main.appendChild(el('div', { class: 'ad-page-head' }, [
      el('div', {}, [el('h1', { class: 'ad-page-title', text: 'Journal d\'activité' }), el('p', { class: 'ad-page-sub', text: 'Actions des administrateurs.' })])
    ]));
    var card = el('div', { class: 'ad-card' });
    main.appendChild(card);
    card.appendChild(loading());

    client.from('admin_activity_logs').select('*, admins(user_id)').order('created_at', { ascending: false }).limit(120).then(function (r) {
      if (r.error || !r.data || !r.data.length) {
        card.innerHTML = '';
        card.appendChild(el('div', { class: 'ad-empty', html: '<i class="fa-solid fa-clock-rotate-left"></i><div>Aucune activité enregistrée.</div>' }));
        return;
      }
      var table = el('table', { class: 'ad-table' });
      table.innerHTML = '<thead><tr><th>Date</th><th>Action</th><th>Type</th><th>Détails</th></tr></thead>';
      var tbody = el('tbody');
      r.data.forEach(function (l) {
        tbody.appendChild(el('tr', {}, [
          el('td', { class: 'ad-row-sub', text: fmtDate(l.created_at) }),
          el('td', { html: '<span class="ad-badge">' + esc(l.action) + '</span>' }),
          el('td', { text: l.entity_type || '—' }),
          el('td', { class: 'ad-row-sub', html: l.details ? '<code>' + esc(JSON.stringify(l.details)) + '</code>' : '' })
        ]));
      });
      table.appendChild(tbody);
      card.innerHTML = '';
      card.appendChild(table);
    });
  }

  /* =========================================================
     APERÇU INTÉGRÉ
     ========================================================= */
  function previewModal() {
    var sectionTypes = CURRENT.sections.map(function (s) { return s.section_type; });
    fetchRefs(sectionTypes).then(function (refs) {
      var ctx = window.BRAINCMS.makeContext({ refs: refs, adminMode: true });
      var html = CURRENT.sections.map(function (s) { return window.BRAINCMS.renderSection(s, ctx); }).join('\n');
      var targetFile = { home: 'index.html', services: 'services.html', portfolio: 'portfolio.html', about: 'a-propos.html', contact: 'contact.html' }[CURRENT.page.slug] || (CURRENT.page.slug + '.html');

      var scrim = el('div', { class: 'ad-preview-scrim' });
      scrim.innerHTML = '<div class="ad-preview-toolbar">' +
        '<span class="ad-preview-meta"><b>' + esc(CURRENT.page.title) + '</b> — aperçu des ' + CURRENT.sections.length + ' section(s)</span>' +
        '<button class="ad-btn ad-sm ad-open-live"><i class="fa-solid fa-arrow-up-right-from-square"></i> Ouvrir sur le site</button>' +
        '<button class="ad-btn ad-sm ad-close-preview"><i class="fa-solid fa-xmark"></i></button>' +
      '</div><iframe class="ad-preview-frame" sandbox="allow-same-origin" loading="lazy"></iframe>';
      pushDialog(scrim);

      var doc = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><base href="../">' +
        '<link rel="stylesheet" href="css/style.css">' +
        '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">' +
        '<style>body{background:#020611;color:#edf2fb;font-family:Inter,sans-serif}img{max-width:100%}</style>' +
        '</head><body>' + html + '</body></html>';
      $('.ad-preview-frame', scrim).srcdoc = doc;

      $('.ad-close-preview', scrim).addEventListener('click', function () { scrim.remove(); });
      $('.ad-open-live', scrim).addEventListener('click', function () { window.open('../' + targetFile + '?preview=' + CURRENT.page.slug, '_blank', 'noopener'); });
    }).catch(function (e) { toast('Erreur aperçu : ' + e.message, 'err'); });
  }

  /* =========================================================
     PRODUITS & BLOG — gestion (admin)
     ========================================================= */
  var PRODUCT_STATUS = [['draft', 'Brouillon'], ['published', 'Publié'], ['archived', 'Archivé']];
  var BLOG_STATUS = PRODUCT_STATUS;

  function statusBadge(status) {
    var map = { published: 'Publié', archived: 'Archivé', draft: 'Brouillon' };
    var cls = status === 'published' ? 'ad-b-published' : status === 'archived' ? 'ad-b-hidden' : 'ad-b-draft';
    return '<span class="ad-badge ' + cls + '">' + esc(map[status] || status || '—') + '</span>';
  }

  /* -------- Champs de formulaire (types étendus) -------- */
  function crudField(f, value) {
    if (f.type === 'datetime' || f.type === 'code') {
      var wrap = el('div', { class: 'ad-field' });
      if (f.type === 'datetime') {
        var v = value ? new Date(value).toISOString().slice(0, 16) : '';
        wrap.innerHTML = '<label>' + esc(f.label) + '</label>' +
          '<input type="datetime-local" class="ad-input" data-field="' + escAttr(f.name) + '" value="' + escAttr(v) + '">';
      } else {
        wrap.innerHTML = '<label>' + esc(f.label) + '</label>' +
          '<textarea class="ad-textarea ad-code" data-field="' + escAttr(f.name) + '" placeholder="' + escAttr(f.placeholder || '') + '">' + esc(value == null ? '' : value) + '</textarea>';
      }
      if (f.help) wrap.appendChild(el('div', { class: 'ad-hint', text: f.help }));
      return wrap;
    }
    return buildField(f, value, null);
  }

  function collectCrud(form) {
    var data = {};
    $$('[data-field]', form).forEach(function (input) {
      var name = input.getAttribute('data-field');
      if (!name || !input.closest) return;
      if (input.closest('[data-repeater]')) return;
      if (input.type === 'checkbox') { data[name] = input.checked; return; }
      if (input.type === 'number') { data[name] = input.value === '' ? null : parseFloat(input.value); return; }
      data[name] = input.getAttribute('type') === 'hidden' ? (input.value || null) : input.value;
    });
    $$('[data-repeater]', form).forEach(function (holder) {
      var name = holder.getAttribute('data-name');
      if (name && holder.__rep) data[name] = holder.__rep();
    });
    return data;
  }

  function openCrudModal(opts) {
    var overlay = el('div', { class: 'ad-overlay' });
    overlay.innerHTML = '<div class="ad-modal ad-modal-form">' +
      '<div class="ad-modal-head"><h3 class="ad-modal-title">' + esc(opts.title) + '</h3>' +
        '<button class="ad-btn ad-ghost ad-icon ad-close-x"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="ad-modal-body"><form id="ad-crud-form"></form></div>' +
      '<div class="ad-modal-foot"><div class="ad-right">' +
        '<button class="ad-btn ad-ghost ad-cancel">Annuler</button>' +
        '<button class="ad-btn ad-primary ad-crud-save"><i class="fa-solid fa-save"></i> Enregistrer</button>' +
      '</div></div></div>';
    pushDialog(overlay);

    var form = $('#ad-crud-form', overlay);
    (opts.fields || []).forEach(function (f) {
      var val = opts.values ? (opts.values[f.name] !== undefined && opts.values[f.name] !== null ? opts.values[f.name] : (f.default !== undefined ? f.default : '')) : (f.default !== undefined ? f.default : '');
      form.appendChild(crudField(f, val));
    });

    function close() { closeDialog(); overlay.remove(); }
    $('.ad-close-x', overlay).addEventListener('click', close);
    $('.ad-cancel', overlay).addEventListener('click', close);

    $('.ad-crud-save', overlay).addEventListener('click', function () {
      var btn = $('.ad-crud-save', overlay);
      btn.disabled = true;
      Promise.resolve(opts.onSave(collectCrud(form)))
        .then(function () { close(); })
        .catch(function (e) { toast((e && e.message) || 'Erreur', 'err'); btn.disabled = false; });
    });
  }

  /* -------- Produits -------- */
  var PRODUCT_FIELDS = [
    { name: 'name', label: 'Nom du produit', type: 'text', placeholder: 'Ex : BRAIN CARE' },
    { name: 'slug', label: 'Slug (URL)', type: 'text', help: 'URL publique : /produits/<slug>' },
    { name: 'category', label: 'Catégorie', type: 'text', placeholder: 'Ex : Digitalisation' },
    { name: 'slogan', label: 'Slogan', type: 'text', placeholder: 'Ex : Gérez votre entreprise où que vous soyez' },
    { name: 'short_description', label: 'Description courte (carte)', type: 'textarea' },
    { name: 'full_description', label: 'Présentation complète', type: 'textarea' },
    { name: 'problem_solved', label: 'Problème résolu', type: 'textarea', help: 'Rédigé sous forme de paragraphe.' },
    { name: 'presentation', label: 'Présentation', type: 'textarea' },
    { name: 'logo', label: 'Logo (fichier)', type: 'image' },
    { name: 'image', label: 'Image principale', type: 'image' },
    { name: 'image_alt', label: 'Texte ALT SEO de l’image principale', type: 'text', placeholder: 'Description précise et descriptive pour le SEO…' },
    { name: 'gallery', label: 'Galerie (images)', type: 'repeater', addLabel: 'Ajouter une image',
      fields: [ { name: 'image', label: 'Image', type: 'image' } ] },
    { name: 'video', label: 'Vidéo (URL YouTube / Vimeo)', type: 'text' },
    { name: 'external_url', label: 'URL externe (démo, téléchargement…)', type: 'text' },
    { name: 'cta_text', label: 'Texte du bouton CTA', type: 'text', default: 'Découvrir' },
    { name: 'sector', label: 'Secteur d’activité (listé)', type: 'text' },
    { name: 'target_audience', label: 'Public cible', type: 'text' },
    { name: 'features', label: 'Fonctionnalités', type: 'repeater', addLabel: 'Ajouter une fonctionnalité',
      fields: [ { name: 'title', label: 'Intitulé', type: 'text' }, { name: 'description', label: 'Description', type: 'text' } ] },
    { name: 'benefits', label: 'Avantages', type: 'repeater', addLabel: 'Ajouter un avantage',
      fields: [ { name: 'title', label: 'Intitulé', type: 'text' }, { name: 'description', label: 'Description', type: 'text' } ] },
    { name: 'display_order', label: 'Ordre d’affichage', type: 'number' },
    { name: 'status', label: 'Statut', type: 'select', options: PRODUCT_STATUS },
    { name: 'seo_title', label: 'SEO — Titre (balise title)', type: 'text' },
    { name: 'seo_description', label: 'SEO — Méta description', type: 'textarea' },
    { name: 'canonical_url', label: 'SEO — URL canonique (optionnel)', type: 'text' },
    { name: 'og_title', label: 'SEO — Titre Open Graph', type: 'text' },
    { name: 'og_description', label: 'SEO — Description Open Graph', type: 'textarea' },
    { name: 'og_image', label: 'SEO — Image Open Graph', type: 'image' },
    { name: 'indexing', label: 'Indexation', type: 'select', options: [['index', 'Indexer la page'], ['noindex', 'Ne pas indexer']], default: 'index' },
    { name: 'schema_json', label: 'SEO — JSON-LD personnalisé (optionnel)', type: 'code', help: 'JSON valide. Laissé vide = schéma Product généré automatiquement.' }
  ];
  var PROD_CACHE = [];
  var PRODUCT_BOX = null;

  function renderProducts() {
    setActiveNav('products');
    var main = $('#ad-main');
    $('#ad-topbar').hidden = false;
    main.innerHTML = '';
    var head = el('div', { class: 'ad-page-head' }, [
      el('div', {}, [
        el('h1', { class: 'ad-page-title', text: 'Produits' }),
        el('p', { class: 'ad-page-sub', html: 'Solutions & produits numériques publiés sur <code>/produits</code>. Statuts : brouillon, publié, archivé.' })
      ]),
      el('div', { class: 'ad-inline' }, [
        el('input', { class: 'ad-input ad-sm-inp', id: 'ad-pf-search', type: 'search', placeholder: 'Rechercher…' }),
        el('select', { class: 'ad-select', id: 'ad-pf-status', html: '<option value="">Tous les statuts</option><option value="published">Publié</option><option value="draft">Brouillon</option><option value="archived">Archivé</option>' }),
        el('button', { class: 'ad-btn ad-primary', html: '<i class="fa-solid fa-plus"></i> Nouveau produit', onclick: function () { openProductEditor(null); } })
      ])
    ]);
    main.appendChild(head);
    var card = el('div', { class: 'ad-card' });
    PRODUCT_BOX = el('div', {});
    card.appendChild(PRODUCT_BOX);
    main.appendChild(card);
    $('#ad-pf-search').addEventListener('input', function () { renderProductTable(PRODUCT_BOX); });
    $('#ad-pf-status').addEventListener('change', function () { renderProductTable(PRODUCT_BOX); });
    loadProducts();
  }

  function loadProducts() {
    if (!PRODUCT_BOX) return;
    PRODUCT_BOX.innerHTML = '';
    PRODUCT_BOX.appendChild(loading('Chargement des produits…'));
    client.from('products').select('*').order('display_order', { ascending: true, nullsFirst: false })
      .then(function (r) {
        if (r.error) { PRODUCT_BOX.innerHTML = ''; PRODUCT_BOX.appendChild(el('div', { class: 'ad-empty', html: '<i class="fa-solid fa-circle-exclamation"></i>Erreur : ' + esc(r.error.message) })); return; }
        PROD_CACHE = r.data || [];
        renderProductTable(PRODUCT_BOX);
      });
  }

  function productFilter() {
    var q = $('#ad-pf-search') ? $('#ad-pf-search').value.toLowerCase() : '';
    var st = $('#ad-pf-status') ? $('#ad-pf-status').value : '';
    return PROD_CACHE.filter(function (p) {
      if (st && (p.status || 'draft') !== st) return false;
      if (q) {
        var hay = ((p.name || '') + ' ' + (p.slug || '') + ' ' + (p.category || '') + ' ' + (p.sector || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderProductTable(box) {
    box.innerHTML = '';
    var list = productFilter();
    if (!list.length) { box.appendChild(el('div', { class: 'ad-empty', html: '<i class="fa-solid fa-box-open"></i><div>Aucun produit trouvé.</div>' })); return; }
    var table = el('table', { class: 'ad-table' });
    table.innerHTML = '<thead><tr><th>Produit</th><th>Catégorie</th><th>Statut</th><th>Ordre</th><th style="text-align:right">Actions</th></tr></thead>';
    var tb = el('tbody');
    list.forEach(function (p, i) {
      var tr = el('tr');
      tr.appendChild(el('td', {}, [
        el('div', { class: 'ad-row-title', text: p.name || '—' }),
        p.slug ? el('div', { class: 'ad-row-sub', html: '/produits/' + esc(p.slug) }) : el('div', { class: 'ad-row-sub', text: 'Slug manquant' })
      ]));
      tr.appendChild(el('td', { text: p.category || '—' }));
      tr.appendChild(el('td', { html: statusBadge(p.status) }));
      tr.appendChild(el('td', { text: p.display_order == null ? '—' : p.display_order }));
      tr.appendChild(el('td', {}, [ prodActions(p, i, list, box) ]));
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    box.appendChild(table);
  }

  function prodActions(p, i, list, box) {
    return el('div', { class: 'ad-row-actions' }, [
      el('button', { class: 'ad-btn ad-sm ad-ghost', title: 'Monter', html: '<i class="fa-solid fa-arrow-up"></i>', disabled: i === 0, onclick: function () { moveProd(p, list[i - 1], box); } }),
      el('button', { class: 'ad-btn ad-sm ad-ghost', title: 'Descendre', html: '<i class="fa-solid fa-arrow-down"></i>', disabled: i === list.length - 1, onclick: function () { moveProd(p, list[i + 1], box); } }),
      el('button', { class: 'ad-btn ad-sm ad-ghost', title: 'Voir sur le site', html: '<i class="fa-solid fa-arrow-up-right-from-square"></i>', onclick: function () { window.open('../produits.html?p=' + encodeURIComponent(p.slug || ''), '_blank'); } }),
      el('button', { class: 'ad-btn ad-sm ad-ghost', title: 'Modifier', html: '<i class="fa-solid fa-pen"></i>', onclick: function () { openProductEditor(p.id); } }),
      el('button', { class: 'ad-btn ad-sm ad-ghost', title: 'Dupliquer', html: '<i class="fa-solid fa-copy"></i>', onclick: function () { duplicateProduct(p); } }),
      el('button', { class: 'ad-btn ad-sm ' + (p.status === 'published' ? 'ad-warn' : 'ad-primary'), title: p.status === 'published' ? 'Dépublier' : 'Publier', html: p.status === 'published' ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>', onclick: function () { setProductStatus(p, p.status === 'published' ? 'draft' : 'published'); } }),
      el('button', { class: 'ad-btn ad-sm ad-ghost', title: p.status === 'archived' ? 'Restaurer (brouillon)' : 'Archiver', html: p.status === 'archived' ? '<i class="fa-solid fa-box-open"></i>' : '<i class="fa-solid fa-box-archive"></i>', onclick: function () { setProductStatus(p, p.status === 'archived' ? 'draft' : 'archived'); } }),
      el('button', { class: 'ad-btn ad-sm ad-danger', title: 'Supprimer', html: '<i class="fa-solid fa-trash"></i>', onclick: function () { deleteProduct(p); } })
    ]);
  }

  function setProductStatus(p, st) {
    client.from('products').update({ status: st }).eq('id', p.id).then(function (r) {
      if (r.error) { toast(r.error.message, 'err'); return; }
      toast(st === 'published' ? 'Produit publié' : st === 'archived' ? 'Produit archivé' : 'Produit dépublié', 'ok');
      logActivity('update', 'products', p.id, { status: st });
      loadProducts();
    });
  }
  function moveProd(a, b, box) {
    if (!b) return;
    var oa = a.display_order == null ? 999 : a.display_order;
    var ob = b.display_order == null ? 999 : b.display_order;
    Promise.all([
      client.from('products').update({ display_order: ob }).eq('id', a.id),
      client.from('products').update({ display_order: oa }).eq('id', b.id)
    ]).then(function (r) {
      if (r[0] && (r[0].error || r[1].error)) { toast('Erreur lors du réordonnancement', 'err'); return; }
      toast('Ordre mis à jour', 'ok');
      loadProducts();
    });
  }
  function duplicateProduct(p) {
    var copy = Object.assign({}, p);
    delete copy.id; delete copy.created_at; delete copy.updated_at;
    copy.name = (p.name || 'Produit') + ' (copie)';
    copy.slug = slugify((p.slug || p.name || 'produit') + '-copie') + '-' + Date.now().toString().slice(-4);
    copy.status = 'draft';
    copy.display_order = (p.display_order == null ? 0 : p.display_order) + 1;
    client.from('products').insert(copy).then(function (r) {
      if (r.error) { toast(r.error.message, 'err'); return; }
      toast('Produit dupliqué', 'ok');
      logActivity('create', 'products', r.data && r.data[0] && r.data[0].id);
      loadProducts();
    });
  }
  function deleteProduct(p) {
    if (!confirm('Supprimer définitivement le produit « ' + (p.name || '') + ' » ?')) return;
    client.from('products').delete().eq('id', p.id).then(function (r) {
      if (r.error) { toast(r.error.message, 'err'); return; }
      toast('Produit supprimé', 'ok');
      logActivity('delete', 'products', p.id);
      loadProducts();
    });
  }
  function openProductEditor(id) {
    var found = id ? PROD_CACHE.filter(function (p) { return p.id === id; })[0] : null;
    if (id && !found) {
      client.from('products').select('*').eq('id', id).single().then(function (r) { if (r.data) openProductEditorForm(r.data); });
      return;
    }
    openProductEditorForm(found);
  }
  function openProductEditorForm(p) {
    openCrudModal({
      title: p ? ('Modifier : ' + p.name) : 'Nouveau produit',
      fields: PRODUCT_FIELDS,
      values: p || { status: 'draft', indexing: 'index', cta_text: 'Découvrir' },
      onSave: function (data) {
        var payload = {};
        PRODUCT_FIELDS.forEach(function (f) { payload[f.name] = data[f.name] !== undefined ? data[f.name] : null; });
['gallery', 'features', 'benefits'].forEach(function (k) {
          if (Array.isArray(payload[k]) && !payload[k].length) payload[k] = null;
        });
        payload.gallery = (payload.gallery || []).map(function (g) { return typeof g === 'string' ? g : (g && g.image) || ''; }).filter(Boolean);
        if (!payload.gallery.length) payload.gallery = null;
        if (!payload.slug || !String(payload.slug).trim()) payload.slug = slugify(payload.name || 'produit');
        if (payload.schema_json && String(payload.schema_json).trim()) {
          try { JSON.parse(payload.schema_json); }
          catch (e) { toast('JSON-LD invalide : ' + e.message, 'err'); throw { message: 'JSON-LD invalide' }; }
        } else { payload.schema_json = null; }
        var rec = p ? { id: p.id } : {};
        return client.from('products').upsert(Object.assign(rec, payload)).then(function (r) {
          if (r.error) { toast(r.error.message || 'Erreur', 'err'); throw { message: r.error.message }; }
          toast(p ? 'Produit enregistré' : 'Produit créé', 'ok');
          logActivity(p ? 'update' : 'create', 'products', p ? p.id : (r.data && r.data[0] && r.data[0].id));
          loadProducts();
        });
      }
    });
  }

  /* -------- Blog -------- */
  var BLOG_FIELDS = [
    { name: 'title', label: 'Titre de l’article', type: 'text' },
    { name: 'slug', label: 'Slug (URL)', type: 'text', help: 'URL publique : /blog/<slug>' },
    { name: 'excerpt', label: 'Extrait (résumé)', type: 'textarea' },
    { name: 'content', label: 'Contenu (HTML riche)', type: 'code', placeholder: '<p>Votre contenu…</p><h2>Section</h2>' },
    { name: 'image', label: 'Image principale', type: 'image' },
    { name: 'author', label: 'Auteur', type: 'text', placeholder: 'Ex : BRAIN' },
    { name: 'category', label: 'Catégorie', type: 'text', placeholder: 'Ex : Création web' },
    { name: 'tags', label: 'Tags (séparés par des virgules)', type: 'text' },
    { name: 'published_at', label: 'Date de publication', type: 'datetime' },
    { name: 'status', label: 'Statut', type: 'select', options: BLOG_STATUS },
    { name: 'is_featured', label: 'Article mis en avant (à la une)', type: 'checkbox' },
    { name: 'seo_title', label: 'SEO — Titre (balise title)', type: 'text' },
    { name: 'seo_description', label: 'SEO — Méta description', type: 'textarea' },
    { name: 'canonical_url', label: 'SEO — URL canonique (optionnel)', type: 'text' },
    { name: 'og_title', label: 'SEO — Titre Open Graph', type: 'text' },
    { name: 'og_description', label: 'SEO — Description Open Graph', type: 'textarea' },
    { name: 'og_image', label: 'SEO — Image Open Graph', type: 'image' },
    { name: 'indexing', label: 'Indexation', type: 'select', options: [['index', 'Indexer la page'], ['noindex', 'Ne pas indexer']], default: 'index' }
  ];
  var BLOG_CACHE = [];
  var BLOG_BOX = null;

  function renderBlogPosts() {
    setActiveNav('blog');
    var main = $('#ad-main');
    $('#ad-topbar').hidden = false;
    main.innerHTML = '';
    var head = el('div', { class: 'ad-page-head' }, [
      el('div', {}, [
        el('h1', { class: 'ad-page-title', text: 'Blog' }),
        el('p', { class: 'ad-page-sub', html: 'Articles publiés sur <code>/blog</code>. Statuts : brouillon, publié, archivé — l\'étoile met un article en avant (à la une).' })
      ]),
      el('div', { class: 'ad-inline' }, [
        el('input', { class: 'ad-input ad-sm-inp', id: 'ad-bl-search', type: 'search', placeholder: 'Rechercher…' }),
        el('select', { class: 'ad-select', id: 'ad-bl-status', html: '<option value="">Tous les statuts</option><option value="published">Publié</option><option value="draft">Brouillon</option><option value="archived">Archivé</option>' }),
        el('button', { class: 'ad-btn ad-primary', html: '<i class="fa-solid fa-plus"></i> Nouvel article', onclick: function () { openBlogEditor(null); } })
      ])
    ]);
    main.appendChild(head);
    var card = el('div', { class: 'ad-card' });
    BLOG_BOX = el('div', {});
    card.appendChild(BLOG_BOX);
    main.appendChild(card);
    $('#ad-bl-search').addEventListener('input', function () { renderBlogTable(BLOG_BOX); });
    $('#ad-bl-status').addEventListener('change', function () { renderBlogTable(BLOG_BOX); });
    loadBlogs();
  }

  function loadBlogs() {
    if (!BLOG_BOX) return;
    BLOG_BOX.innerHTML = '';
    BLOG_BOX.appendChild(loading('Chargement des articles…'));
    client.from('blog_posts').select('*').order('published_at', { ascending: false, nullsFirst: false })
      .then(function (r) {
        if (r.error) { BLOG_BOX.innerHTML = ''; BLOG_BOX.appendChild(el('div', { class: 'ad-empty', html: '<i class="fa-solid fa-circle-exclamation"></i>Erreur : ' + esc(r.error.message) })); return; }
        BLOG_CACHE = r.data || [];
        renderBlogTable(BLOG_BOX);
      });
  }

  function blogFilter() {
    var q = $('#ad-bl-search') ? $('#ad-bl-search').value.toLowerCase() : '';
    var st = $('#ad-bl-status') ? $('#ad-bl-status').value : '';
    return BLOG_CACHE.filter(function (p) {
      if (st && (p.status || 'draft') !== st) return false;
      if (q) {
        var hay = ((p.title || '') + ' ' + (p.slug || '') + ' ' + (p.category || '') + ' ' + (p.excerpt || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderBlogTable(box) {
    box.innerHTML = '';
    var list = blogFilter();
    if (!list.length) { box.appendChild(el('div', { class: 'ad-empty', html: '<i class="fa-solid fa-newspaper"></i><div>Aucun article trouvé.</div>' })); return; }
    var table = el('table', { class: 'ad-table' });
    table.innerHTML = '<thead><tr><th>Article</th><th>Catégorie</th><th>Date</th><th>Une</th><th>Statut</th><th style="text-align:right">Actions</th></tr></thead>';
    var tb = el('tbody');
    list.forEach(function (p) {
      var tr = el('tr');
      tr.appendChild(el('td', {}, [
        el('div', { class: 'ad-row-title', text: p.title || '—' }),
        p.slug ? el('div', { class: 'ad-row-sub', html: '/blog/' + esc(p.slug) }) : el('div', { class: 'ad-row-sub', text: 'Slug manquant' })
      ]));
      tr.appendChild(el('td', { text: p.category || '—' }));
      tr.appendChild(el('td', { text: p.published_at ? fmtDate(p.published_at) : '—' }));
      tr.appendChild(el('td', { html: '<i class="fa-solid ' + (p.is_featured ? 'fa-star ad-starf' : 'fa-star ad-staroff') + '"></i>' }));
      tr.appendChild(el('td', { html: statusBadge(p.status) }));
      tr.appendChild(el('td', {}, [ blogActions(p, box) ]));
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    box.appendChild(table);
  }

  function blogActions(p, box) {
    return el('div', { class: 'ad-row-actions' }, [
      el('button', { class: 'ad-btn ad-sm ad-ghost', title: 'Voir sur le site', html: '<i class="fa-solid fa-arrow-up-right-from-square"></i>', onclick: function () { window.open('../blog.html?p=' + encodeURIComponent(p.slug || ''), '_blank'); } }),
      el('button', { class: 'ad-btn ad-sm ad-ghost', title: 'Modifier', html: '<i class="fa-solid fa-pen"></i>', onclick: function () { openBlogEditor(p.id); } }),
      el('button', { class: 'ad-btn ad-sm ' + (p.status === 'published' ? 'ad-warn' : 'ad-primary'), title: p.status === 'published' ? 'Dépublier' : 'Publier', html: p.status === 'published' ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>', onclick: function () { setBlogStatus(p, p.status === 'published' ? 'draft' : 'published'); } }),
      el('button', { class: 'ad-btn ad-sm ad-ghost', title: p.status === 'archived' ? 'Restaurer (brouillon)' : 'Archiver', html: p.status === 'archived' ? '<i class="fa-solid fa-box-open"></i>' : '<i class="fa-solid fa-box-archive"></i>', onclick: function () { setBlogStatus(p, p.status === 'archived' ? 'draft' : 'archived'); } }),
      el('button', { class: 'ad-btn ad-sm ad-ghost', title: p.is_featured ? 'Retirer de la une' : 'Mettre à la une', html: '<i class="fa-solid fa-star"></i>', onclick: function () { toggleFeatured(p); } }),
      el('button', { class: 'ad-btn ad-sm ad-danger', title: 'Supprimer', html: '<i class="fa-solid fa-trash"></i>', onclick: function () { deleteBlogPost(p); } })
    ]);
  }

  function setBlogStatus(p, st) {
    client.from('blog_posts').update({ status: st, is_visible: st === 'published' }).eq('id', p.id).then(function (r) {
      if (r.error) { toast(r.error.message, 'err'); return; }
      toast(st === 'published' ? 'Article publié' : st === 'archived' ? 'Article archivé' : 'Article dépublié', 'ok');
      logActivity('update', 'blog_posts', p.id, { status: st });
      loadBlogs();
    });
  }
  function toggleFeatured(p) {
    client.from('blog_posts').update({ is_featured: !p.is_featured }).eq('id', p.id).then(function (r) {
      if (r.error) { toast(r.error.message, 'err'); return; }
      toast(p.is_featured ? 'Retiré de la une' : 'Mis en avant', 'ok');
      logActivity('update', 'blog_posts', p.id, { is_featured: !p.is_featured });
      loadBlogs();
    });
  }
  function deleteBlogPost(p) {
    if (!confirm('Supprimer définitivement l\'article « ' + (p.title || '') + ' » ?')) return;
    client.from('blog_posts').delete().eq('id', p.id).then(function (r) {
      if (r.error) { toast(r.error.message, 'err'); return; }
      toast('Article supprimé', 'ok');
      logActivity('delete', 'blog_posts', p.id);
      loadBlogs();
    });
  }
  function openBlogEditor(id) {
    var found = id ? BLOG_CACHE.filter(function (p) { return p.id === id; })[0] : null;
    if (id && !found) {
      client.from('blog_posts').select('*').eq('id', id).single().then(function (r) { if (r.data) openBlogEditorForm(r.data); });
      return;
    }
    openBlogEditorForm(found);
  }
  function openBlogEditorForm(p) {
    openCrudModal({
      title: p ? ('Modifier : ' + p.title) : 'Nouvel article',
      fields: BLOG_FIELDS,
      values: p || { status: 'draft', is_featured: false, indexing: 'index' },
      onSave: function (data) {
        if (!data.title || !String(data.title).trim()) { toast('Le titre est obligatoire', 'err'); throw { message: 'Titre requis' }; }
        var status = data.status || 'draft';
        var payload = {
          title: data.title.trim(),
          slug: (data.slug && String(data.slug).trim()) ? data.slug.trim() : slugify(data.title),
          excerpt: data.excerpt || null,
          content: data.content || null,
          image: data.image || null,
          author: data.author || null,
          category: data.category || null,
          tags: data.tags ? String(data.tags).trim() : null,
          published_at: data.published_at ? new Date(data.published_at).toISOString() : null,
          status: status,
          is_featured: !!data.is_featured,
          is_visible: status === 'published',
          seo_title: data.seo_title || null,
          seo_description: data.seo_description || null,
          canonical_url: data.canonical_url || null,
          og_title: data.og_title || null,
          og_description: data.og_description || null,
          og_image: data.og_image || null,
          indexing: data.indexing || 'index'
        };
        var rec = p ? { id: p.id } : {};
        return client.from('blog_posts').upsert(Object.assign(rec, payload)).then(function (r) {
          if (r.error) { toast(r.error.message || 'Erreur', 'err'); throw { message: r.error.message }; }
          toast(p ? 'Article enregistré' : 'Article créé', 'ok');
          logActivity(p ? 'update' : 'create', 'blog_posts', p ? p.id : (r.data && r.data[0] && r.data[0].id));
          loadBlogs();
        });
      }
    });
  }

  /* =========================================================
     AUDIOVISUEL — délégation au module admin-audiovisual.js
     ========================================================= */
  function renderAudiovisual() {
    setActiveNav('videos');
    var main = $('#ad-main');
    main.innerHTML = '';
    if (window.BRAIN_ADMIN_AV && typeof window.BRAIN_ADMIN_AV.render === 'function') {
      return window.BRAIN_ADMIN_AV.render(main);
    }
    main.appendChild(el('div', { class: 'ad-card' }, [
      el('div', { class: 'ad-empty', html: '<i class="fa-solid fa-video"></i><div>Module Audiovisuel non chargé.<br>Vérifiez que <code>admin/js/admin-audiovisual.js</code> est bien inclus.</div>' })
    ]));
  }

  /* API publique partagée avec les modules d'extension (ex : audiovisuel) */
  window.BRAIN_ADMIN_API = {
    getClient: function () { return client; },
    getUser: function () { return user; },
    esc: esc,
    escAttr: escAttr,
    $: $,
    $$: $$,
    el: el,
    toast: toast,
    fmtDate: fmtDate,
    slugify: slugify,
    loading: loading,
    logActivity: logActivity,
    statusBadge: statusBadge,
    closeDialog: closeDialog,
    pushDialog: pushDialog,
    openMediaModal: openMediaModal,
    openCrudModal: openCrudModal,
    crudField: crudField,
    collectCrud: collectCrud,
    setActiveNav: setActiveNav
  };

  /* =========================================================
     INIT
     ========================================================= */
  function ensureMediaBucket() {
    return client.storage.getBucket('media').then(function (res) {
      if (res.error) {
        return client.storage.createBucket('media', { public: true }).catch(function (e2) { return e2; });
      }
      return res;
    });
  }

  function boot() {
    ensureMediaBucket().catch(function () {});

    $('#ad-logout').addEventListener('click', function () {
      client.auth.signOut().then(function () {
        toast('Déconnecté', 'ok');
        user = null;
        location.hash = '#/login';
        route();
      });
    });

    $('#ad-burger').addEventListener('click', function () { $('#ad-nav').classList.toggle('ad-open'); });
    $$('#ad-nav a[data-nav]').forEach(function (a) {
      a.addEventListener('click', function () { $('#ad-nav').classList.remove('ad-open'); });
    });

    window.addEventListener('hashchange', function () {
      if (user) syncAuth();
      route();
    });

    client.auth.onAuthStateChange(function (event, session) {
      user = session ? session.user : null;
      syncTopbar();
      if (!user) { location.hash = '#/login'; route(); }
    });

    client.auth.getSession().then(function (s) {
      user = s.data && s.data.session ? s.data.session.user : null;
      route();
    });

    function syncAuth() {
      client.auth.getSession().then(function (s) {
        user = s.data && s.data.session ? s.data.session.user : null;
        route();
      });
    }
  }

  waitSupabase(function (sb) {
    client = sb;
    if (!window.BRAINCMS) {
      toast('Registry CMS manquant', 'err');
      return;
    }
    boot();
  });
})();