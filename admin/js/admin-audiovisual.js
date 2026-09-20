/* =========================================================
   BRAIN CMS — Module Audiovisuel (admin)
   CRUD + upload drag & drop pour la médiathèque
   audiovisual_videos : sources YouTube / Vimeo / upload.
   - Une seule vidéo peut être « à la une » (index unique partiel)
   - Limite de taille configurable via site_settings
     (clé : audiovisual_max_video_size_mb, défaut 200 Mo)
   - Fichiers uploadés dans le bucket public audiovisual-videos,
     chemin : <video_id>/original.<ext>
   Interfaçage avec le noyau admin via window.BRAIN_ADMIN_API.
   ========================================================= */
(function () {
  'use strict';

  var BRAIN = window.BRAIN_ADMIN_API;
  if (!BRAIN || typeof BRAIN.getClient !== 'function') return;

  var $ = BRAIN.$, $$ = BRAIN.$$, el = BRAIN.el,
      esc = BRAIN.esc, escAttr = BRAIN.escAttr,
      toast = BRAIN.toast, fmtDate = BRAIN.fmtDate,
      slugify = BRAIN.slugify, loading = BRAIN.loading,
      logActivity = BRAIN.logActivity, closeDialog = BRAIN.closeDialog,
      pushDialog = BRAIN.pushDialog, openMediaModal = BRAIN.openMediaModal,
      setActiveNav = BRAIN.setActiveNav;

  var TABLE = 'audiovisual_videos';
  var BUCKET = 'audiovisual-videos';
  var DEFAULT_MAX_MB = 200;
  var OK_EXT = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

  var CATEGORIES = [
    'Montage vidéo', 'Films publicitaires', 'Films institutionnels',
    'Films d\u2019entreprise', 'Films promotionnels', 'Interviews & documentaires',
    'Reportages', 'Captation événementielle', '\u00c9missions TV',
    'Motion design', 'Post-production', 'Effets spéciaux / VFX'
  ];

  var SRC_META = {
    youtube: { icon: 'fa-brands fa-youtube', label: 'YouTube' },
    vimeo: { icon: 'fa-brands fa-vimeo', label: 'Vimeo' },
    upload: { icon: 'fa-solid fa-upload', label: 'Upload' }
  };

  var CACHE = [];
  var BOX = null;
  var MAX_MB = DEFAULT_MAX_MB;

  /* ---------- Utilitaires ---------- */
  function getClient() { return BRAIN.getClient(); }

  function newId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    if (!sec) return '—';
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? h + ':' + pad2(m) + ':' + pad2(s) : m + ':' + pad2(s);
  }

  function parseSource(url) {
    var u = String(url || '').trim();
    if (!u) return null;
    try {
      var p = new URL(u.indexOf('://') === -1 ? 'https://' + u : u);
      var host = String(p.hostname || '').replace(/^www\./, '').replace(/^m\./, '');
      if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        var v = p.searchParams.get('v');
        if (v && /^[\w-]{6,20}$/.test(v)) return { type: 'youtube', id: v };
        var sp = String(p.pathname).split('/');
        if (sp[0] === 'shorts' || sp[0] === 'embed') {
          var sc = sp[1];
          if (sc && /^[\w-]{6,20}$/.test(sc)) return { type: 'youtube', id: sc };
        }
      }
      if (host === 'youtu.be') {
        var yb = String(p.pathname).replace(/^\//, '').split('/')[0];
        if (yb && /^[\w-]{6,20}$/.test(yb)) return { type: 'youtube', id: yb };
      }
      if (host === 'vimeo.com') {
        var m = String(p.pathname).match(/^\/?(\d{6,12})/);
        if (m) return { type: 'vimeo', id: m[1] };
      }
      if (host === 'player.vimeo.com') {
        var mv = String(p.pathname).match(/^\/video\/(\d{6,12})/);
        if (mv) return { type: 'vimeo', id: mv[1] };
      }
    } catch (e) { /* URL invalide */ }
    return null;
  }

  function publicUrl(path) {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    var c = getClient();
    if (c && c.storage) {
      try {
        var d = c.storage.from(BUCKET).getPublicUrl(path).data;
        if (d) return d.publicUrl || '';
      } catch (e) { /* ignore */ }
    }
    return '';
  }

  function sourceBadge(type) {
    var m = SRC_META[type] || { label: type || '—' };
    return '<span class="ad-badge">' + esc(m.label) + '</span>';
  }

  function readLocalDuration(file, cb) {
    if (!file || !window.URL || !URL.createObjectURL) { cb(null); return; }
    try {
      var url = URL.createObjectURL(file);
      var v = document.createElement('video');
      v.preload = 'metadata'; v.muted = true;
      v.onloadedmetadata = function () {
        var d = isNaN(v.duration) ? null : Math.round(v.duration);
        URL.revokeObjectURL(url);
        cb(d);
      };
      v.onerror = function () { URL.revokeObjectURL(url); cb(null); };
      v.src = url;
    } catch (e) { cb(null); }
  }

  /* ---------- Stockage ---------- */
  function ensureBucket() {
    var c = getClient();
    if (!c) return Promise.resolve();
    return c.storage.getBucket(BUCKET).then(function (res) {
      if (res.error) {
        return c.storage.createBucket(BUCKET, { public: true, fileSizeLimit: DEFAULT_MAX_MB * 1024 * 1024 }).catch(function () {});
      }
      if (res.data && res.data.file_size_limit) {
        var mb = Math.round(res.data.file_size_limit / (1024 * 1024));
        if (mb > 0 && mb <= 10240) MAX_MB = mb;
      }
      return res;
    }).catch(function () {});
  }

  function loadSettings() {
    var c = getClient();
    if (!c) return Promise.resolve();
    return c.from('site_settings').select('key,value').eq('key', 'audiovisual_max_video_size_mb')
      .then(function (r) {
        var v = r.data && r.data[0] && r.data[0].value;
        var n = parseInt(v == null ? '' : v, 10);
        if (n && n > 0 && n <= 10240) MAX_MB = n;
      })
      .catch(function () {});
  }

  function deleteObject(path) {
    var c = getClient();
    if (!c || !path) return Promise.resolve();
    return c.storage.from(BUCKET).remove([path]).catch(function () {});
  }

  /* ---------- Création de clé d'upload stable ---------- */
  function recordId(modal, vid) {
    if (vid && vid.id) return vid.id;
    if (!modal.__id) modal.__id = newId();
    return modal.__id;
  }

  function uploadVideo(file, modal, vid, setPct, done, err) {
    var ext = OK_EXT[file.type] || (String(file.name).split('.').pop() || '').toLowerCase();
    if (!/^(mp4|webm|mov)$/i.test(ext)) { err('Format non supporté (MP4, WebM, MOV).'); return; }
    if (!file.size) { err('Fichier vide.'); return; }
    var maxB = MAX_MB * 1024 * 1024;
    if (file.size > maxB) { err('Fichier trop lourd : ' + MAX_MB + ' Mo maximum.'); return; }

    var path = recordId(modal, vid) + '/original.' + ext.toLowerCase();
    var c = getClient();
    if (!c) { err('Client Supabase indisponible.'); return; }

    readLocalDuration(file, function (dur) {
      c.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600', upsert: true, contentType: file.type || 'video/mp4',
        onUploadProgress: function (e) {
          if (setPct && e.total) setPct(Math.min(Math.round((e.loaded / e.total) * 100), 100));
        }
      }).then(function (r) {
        if (r.error) throw new Error(r.error.message || 'Upload échoué');
        done({ path: path, name: file.name, duration: dur });
      }).catch(function (e) {
        err('Erreur upload : ' + e.message);
      });
    });
  }

  /* ---------- Miniature automatique ---------- */
  function autoThumbUrl(payload) {
    var s = parseSource(payload.external_url || '');
    if (payload.source_type === 'youtube' && s && s.type === 'youtube') {
      return Promise.resolve('https://i.ytimg.com/vi/' + s.id + '/hqdefault.jpg');
    }
    if (payload.source_type === 'vimeo' && s && s.type === 'vimeo') {
      return window.fetch('https://vimeo.com/api/oembed.json?url=' + encodeURIComponent('https://vimeo.com/' + s.id))
        .then(function (r) { return r.json(); })
        .then(function (d) { return d && d.thumbnail_url ? d.thumbnail_url : ''; })
        .catch(function () { return ''; });
    }
    return Promise.resolve('');
  }

  /* =========================================================
     PAGE PRINCIPALE
     ========================================================= */
  function render(main) {
    setActiveNav('videos');
    main = main || $('#ad-main');
    var topbar = $('#ad-topbar'); if (topbar) topbar.hidden = false;
    main.innerHTML = '';

    var head = el('div', { class: 'ad-page-head' }, [
      el('div', {}, [
        el('h1', { class: 'ad-page-title', text: 'Audiovisuel' }),
        el('p', { class: 'ad-page-sub', html: 'Réalisations vidéo publiées sur <code>/service-films.html#audiovisuel</code>. Sources : YouTube, Vimeo ou vidéo hébergée (upload), limite <b>' + MAX_MB + ' Mo</b>.' })
      ]),
      el('div', { class: 'ad-inline' }, [
        el('input', { class: 'ad-input ad-sm-inp', id: 'av-search', type: 'search', placeholder: 'Rechercher…' }),
        el('select', { class: 'ad-select', id: 'av-status', html: '<option value="">Tous les statuts</option><option value="published">Publié</option><option value="draft">Brouillon</option>' }),
        el('button', { class: 'ad-btn ad-primary', html: '<i class="fa-solid fa-plus"></i> Nouvelle vidéo', onclick: function () { openEditor(null); } })
      ])
    ]);
    main.appendChild(head);

    var stats = el('div', { class: 'ad-stats' });
    main.appendChild(stats);

    var card = el('div', { class: 'ad-card' });
    BOX = el('div', {});
    card.appendChild(BOX);
    main.appendChild(card);

    $('#av-search').addEventListener('input', function () { renderTable(BOX); });
    $('#av-status').addEventListener('change', function () { renderTable(BOX); });

    Promise.all([ensureBucket(), loadSettings()])
      .then(function () {
        var sub = $('.ad-page-sub', main);
        if (sub) sub.innerHTML = 'Réalisations vidéo publiées sur <code>/service-films.html#audiovisuel</code>. Sources : YouTube, Vimeo ou vidéo hébergée (upload), limite <b>' + MAX_MB + ' Mo</b>.';
        loadVideos(stats);
      });
  }

  function loadVideos(stats) {
    if (!BOX) return;
    BOX.innerHTML = '';
    BOX.appendChild(loading('Chargement des vidéos…'));
    var c = getClient();
    if (!c) { BOX.innerHTML = ''; BOX.appendChild(el('div', { class: 'ad-empty', html: '<i class="fa-solid fa-circle-exclamation"></i>Client indisponible.' })); return; }
    c.from(TABLE).select('*').order('display_order', { ascending: true, nullsFirst: false })
      .then(function (r) {
        if (r.error) { BOX.innerHTML = ''; BOX.appendChild(el('div', { class: 'ad-empty', html: '<i class="fa-solid fa-circle-exclamation"></i>Erreur : ' + esc(r.error.message) })); return; }
        CACHE = r.data || [];
        if (stats) {
          stats.innerHTML = '';
          var pub = CACHE.filter(function (v) { return v.published; }).length;
          var feat = CACHE.filter(function (v) { return v.featured; });
          stats.appendChild(el('div', { class: 'ad-stat', children: [el('b', { text: CACHE.length }), el('span', { text: 'Vidéos' })] }));
          stats.appendChild(el('div', { class: 'ad-stat', children: [el('b', { text: pub }), el('span', { text: 'Publiées' })] }));
          stats.appendChild(el('div', { class: 'ad-stat', children: [el('b', { text: feat.length ? '1' : '0' }), el('span', { text: 'À la une' })] }));
        }
        renderTable(BOX);
      })
      .catch(function (e) {
        BOX.innerHTML = '';
        BOX.appendChild(el('div', { class: 'ad-empty', html: '<i class="fa-solid fa-circle-exclamation"></i>Erreur : ' + esc(e.message) }));
      });
  }

  function filtered() {
    var q = $('#av-search') ? $('#av-search').value.toLowerCase() : '';
    var st = $('#av-status') ? $('#av-status').value : '';
    return CACHE.filter(function (v) {
      if (st) {
        var ok = st === 'published' ? !!v.published : !v.published;
        if (!ok) return false;
      }
      if (q) {
        var hay = ((v.title || '') + ' ' + (v.category || '') + ' ' + (v.source_type || '') + ' ' + (v.description || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderTable(box) {
    box.innerHTML = '';
    var list = filtered();
    if (!list.length) {
      box.appendChild(el('div', { class: 'ad-empty', html: '<i class="fa-solid fa-video"></i><div>Aucune vidéo trouvée.</div>' }));
      return;
    }
    var table = el('table', { class: 'ad-table' });
    table.innerHTML = '<thead><tr><th>Vidéo</th><th>Source</th><th>Catégorie</th><th>Durée</th><th>Une</th><th>Statut</th><th style="text-align:right">Actions</th></tr></thead>';
    var tb = el('tbody');
    list.forEach(function (v, i) {
      var tr = el('tr');
      tr.appendChild(el('td', {}, [
        el('div', { class: 'ad-row-title', html: '<span class="av-tbl-thumb">' + thumbHtml(v) + '</span>' + esc(v.title || '—') }),
        el('div', { class: 'ad-row-sub', html: 'Modifiée le ' + esc(fmtDate(v.updated_at)) })
      ]));
      tr.appendChild(el('td', { html: sourceBadge(v.source_type) }));
      tr.appendChild(el('td', { text: v.category || '—' }));
      tr.appendChild(el('td', { text: fmtTime(v.duration) }));
      tr.appendChild(el('td', { html: '<i class="fa-solid fa-star ' + (v.featured ? 'ad-starf' : 'ad-staroff') + '"></i>' }));
      tr.appendChild(el('td', { html: statusBadge(v.published) }));
      tr.appendChild(el('td', {}, [videoActions(v, i, list, box)]));
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    box.appendChild(table);
  }

  function statusBadge(pub) {
    return pub
      ? '<span class="ad-badge ad-b-published"><i class="fa-solid fa-circle-check"></i> Publiée</span>'
      : '<span class="ad-badge ad-b-draft"><i class="fa-solid fa-pen-to-square"></i> Brouillon</span>';
  }

  function thumbHtml(v) {
    var t = v.thumbnail_url;
    var s = parseSource(v.external_url || '');
    if (!t && v.source_type === 'youtube' && s && s.type === 'youtube') t = 'https://i.ytimg.com/vi/' + s.id + '/hqdefault.jpg';
    var dur = fmtTime(v.duration);
    if (t) {
      return '<span class="av-tbl-thumb-img"><img src="' + escAttr(t) + '" alt="" loading="lazy">' + (dur !== '—' ? '<em>' + esc(dur) + '</em>' : '') + '</span>';
    }
    return '<span class="av-tbl-thumb-img av-tbl-thumb-fallback"><i class="fa-solid fa-clapperboard"></i></span>';
  }

  function videoActions(v, i, list, box) {
    var up = el('button', { class: 'ad-btn ad-sm ad-ghost', title: 'Monter', html: '<i class="fa-solid fa-arrow-up"></i>', onclick: function () { moveVideo(v, list[i - 1], box); } });
    var down = el('button', { class: 'ad-btn ad-sm ad-ghost', title: 'Descendre', html: '<i class="fa-solid fa-arrow-down"></i>', onclick: function () { moveVideo(v, list[i + 1], box); } });
    if (i === 0) up.disabled = true;
    if (i === list.length - 1) down.disabled = true;
    return el('div', { class: 'ad-row-actions' }, [
      up, down,
      el('button', { class: 'ad-btn ad-sm ad-ghost', title: 'Aperçu', html: '<i class="fa-solid fa-eye"></i>', onclick: function () { openPreview(v); } }),
      el('button', { class: 'ad-btn ad-sm ad-ghost', title: 'Ouvrir la page sur le site', html: '<i class="fa-solid fa-arrow-up-right-from-square"></i>', onclick: function () { window.open('../service-films.html#audiovisuel', '_blank'); } }),
      el('button', { class: 'ad-btn ad-sm ad-ghost', title: 'Modifier', html: '<i class="fa-solid fa-pen"></i>', onclick: function () { openEditor(v.id); } }),
      el('button', { class: 'ad-btn ad-sm ad-ghost', title: 'Dupliquer', html: '<i class="fa-solid fa-copy"></i>', onclick: function () { duplicateVideo(v); } }),
      el('button', { class: 'ad-btn ad-sm ' + (v.published ? 'ad-warn' : 'ad-primary'), title: v.published ? 'Dépublier' : 'Publier', html: v.published ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>', onclick: function () { setPublished(v, !v.published); } }),
      el('button', { class: 'ad-btn ad-sm ad-ghost', title: v.featured ? 'Retirer de la une' : 'Mettre à la une', html: '<i class="fa-solid fa-star"></i>', onclick: function () { setFeatured(v, !v.featured); } }),
      el('button', { class: 'ad-btn ad-sm ad-danger', title: 'Supprimer', html: '<i class="fa-solid fa-trash"></i>', onclick: function () { deleteVideo(v); } })
    ]);
  }

  /* ---------- Actions rapides ---------- */
  function setPublished(v, b) {
    var c = getClient(); if (!c) return;
    c.from(TABLE).update({ published: b }).eq('id', v.id).then(function (r) {
      if (r.error) { toast(r.error.message, 'err'); return; }
      toast(b ? 'Vidéo publiée' : 'Vidéo dépubliée', 'ok');
      logActivity('update', TABLE, v.id, { published: b });
      loadVideos();
    });
  }

  function setFeatured(v, b) {
    var c = getClient(); if (!c) return;
    var chain = b
      ? c.from(TABLE).update({ featured: false }).eq('featured', true).neq('id', v.id).then(function (r) { if (r.error) throw r.error; })
      : Promise.resolve();
    chain.then(function () {
      return c.from(TABLE).update({ featured: b }).eq('id', v.id);
    }).then(function (r) {
      if (r.error) throw r.error;
      toast(b ? 'Vidéo mise à la une' : 'Retirée de la une', 'ok');
      logActivity('update', TABLE, v.id, { featured: b });
      loadVideos();
    }).catch(function (e) { toast('Erreur : ' + e.message, 'err'); });
  }

  function moveVideo(a, b, box) {
    if (!b) return;
    var c = getClient(); if (!c) return;
    var oa = a.display_order == null ? 999 : a.display_order;
    var ob = b.display_order == null ? 999 : b.display_order;
    Promise.all([
      c.from(TABLE).update({ display_order: ob }).eq('id', a.id),
      c.from(TABLE).update({ display_order: oa }).eq('id', b.id)
    ]).then(function (r) {
      if (r[0] && (r[0].error || r[1].error)) { toast('Erreur réordonnancement', 'err'); return; }
      toast('Ordre mis à jour', 'ok');
      loadVideos();
    }).catch(function (e) { toast('Erreur : ' + e.message, 'err'); });
  }

  function duplicateVideo(v) {
    var copy = {
      title: (v.title || 'Vidéo') + ' (copie)',
      slug: slugify((v.slug || v.title || 'video') + '-copie') + '-' + Date.now().toString().slice(-4),
      description: v.description || null,
      category: v.category || null,
      source_type: v.source_type || 'youtube',
      external_url: v.external_url || null,
      storage_path: null,
      thumbnail_url: v.thumbnail_url || null,
      duration: v.duration || null,
      featured: false,
      display_order: (v.display_order == null ? 0 : v.display_order) + 1,
      published: false
    };
    var c = getClient(); if (!c) return;
    c.from(TABLE).insert(copy).then(function (r) {
      if (r.error) { toast(r.error.message, 'err'); return; }
      toast('Vidéo dupliquée (brouillon)', 'ok');
      logActivity('create', TABLE, r.data && r.data[0] && r.data[0].id);
      loadVideos();
    });
  }

  function deleteVideo(v) {
    if (!confirm('Supprimer définitivement la vidéo « ' + (v.title || '') + ' » ?' + (v.storage_path ? '\nLe fichier stocké sera aussi supprimé.' : ''))) return;
    var c = getClient(); if (!c) return;
    var chain = v.storage_path ? deleteObject(v.storage_path) : Promise.resolve();
    chain.then(function () {
      return c.from(TABLE).delete().eq('id', v.id);
    }).then(function (r) {
      if (r.error) throw r.error;
      toast('Vidéo supprimée', 'ok');
      logActivity('delete', TABLE, v.id);
      loadVideos();
    }).catch(function (e) { toast('Erreur : ' + e.message, 'err'); });
  }

  /* ---------- Aperçu ---------- */
  function openPreview(v) {
    var s = parseSource(v.external_url || '');
    var player = '';
    if (v.source_type === 'youtube' && s && s.type === 'youtube') {
      player = '<iframe class="av-pv-frame" src="https://www.youtube.com/embed/' + escAttr(s.id) + '?rel=0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
    } else if (v.source_type === 'vimeo' && s && s.type === 'vimeo') {
      player = '<iframe class="av-pv-frame" src="https://player.vimeo.com/video/' + escAttr(s.id) + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
    } else if (v.source_type === 'upload' && v.storage_path) {
      player = '<video class="av-pv-frame av-pv-video" src="' + escAttr(publicUrl(v.storage_path)) + '" controls playsinline preload="metadata"></video>';
    }

    var m = el('div', { class: 'ad-overlay' });
    m.innerHTML = '<div class="ad-modal av-pv-modal">' +
      '<div class="ad-modal-head"><h3 class="ad-modal-title">' + esc(v.title || 'Aperçu') + '</h3>' +
        '<button type="button" class="ad-btn ad-ghost ad-icon ad-close-x"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="ad-modal-body ad-modal-body--pv">' + (player || '<div class="ad-empty"><i class="fa-solid fa-film"></i><div>Aperçu indisponible pour cette vidéo.</div></div>') + '</div>' +
      '<div class="ad-modal-foot"><button type="button" class="ad-btn ad-ghost ad-cancel">Fermer</button>' +
        '<button type="button" class="ad-btn ad-primary ad-av-open-page"><i class="fa-solid fa-arrow-up-right-from-square"></i> Voir sur le site</button></div></div>';
    pushDialog(m);

    m.addEventListener('click', function (e) {
      if (e.target === m || e.target.classList.contains('ad-close-x') || e.target.classList.contains('ad-cancel')) { closeDialog(); m.remove(); return; }
      if (e.target.closest('.ad-av-open-page')) { window.open('../service-films.html#audiovisuel', '_blank'); }
    });
  }

  /* =========================================================
     ÉDITEUR (créer / modifier)
     ========================================================= */
  function openEditor(id) {
    var v = null;
    if (id) {
      var found = CACHE.filter(function (x) { return x.id === id; })[0];
      if (found) v = found;
      else {
        var c = getClient();
        c.from(TABLE).select('*').eq('id', id).single().then(function (r) { if (r.data) openEditorForm(r.data); });
        return;
      }
    }
    openEditorForm(v);
  }

  function openEditorForm(v) {
    var isEdit = !!v;
    var initialSource = v ? (v.source_type || 'youtube') : 'youtube';
    var maxOrder = CACHE.reduce(function (m, x) { return Math.max(m, x.display_order || 0); }, 0);

    var catOpts = '<option value="">— Choisir —</option>' + CATEGORIES.map(function (cat) {
      return '<option value="' + escAttr(cat) + '"' + (v && v.category === cat ? ' selected' : '') + '>' + esc(cat) + '</option>';
    }).join('');

    var thumbVal = v && v.thumbnail_url ? v.thumbnail_url : '';
    var thumbPv = thumbVal
      ? '<img src="' + escAttr(thumbVal) + '" alt="">'
      : '<span class="ad-img-empty"><i class="fa-solid fa-image"></i> Aucune miniature</span>';

    var statusOpt = '<select class="ad-select" data-f="status"><option value="draft"' + (!v || !v.published ? ' selected' : '') + '>Brouillon</option><option value="published"' + (v && v.published ? ' selected' : '') + '>Publiée</option></select>';

    var durVal = v && v.duration ? v.duration : '';
    var ordVal = v && v.display_order != null ? v.display_order : (maxOrder + 1);

    var m = el('div', { class: 'ad-overlay' });
    m.innerHTML = '<div class="ad-modal ad-modal-form ad-modal-wide">' +
      '<div class="ad-modal-head"><h3 class="ad-modal-title">' + (isEdit ? esc(v.title || 'Modifier') : 'Nouvelle vidéo') + '</h3>' +
        '<button type="button" class="ad-btn ad-ghost ad-icon ad-close-x"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="ad-modal-body"><form id="av-form">' +
        '<div class="ad-grid ad-grid-2">' +
          '<div class="ad-field"><label>Titre <span class="ad-req">*</span></label><input class="ad-input" data-f="title" value="' + escAttr((v && v.title) || '') + '"></div>' +
          '<div class="ad-field"><label>Slug (URL)</label><input class="ad-input" data-f="slug" value="' + escAttr((v && v.slug) || '') + '" placeholder="généré automatiquement"></div>' +
        '</div>' +
        '<div class="ad-grid ad-grid-2">' +
          '<div class="ad-field"><label>Catégorie</label><select class="ad-select" data-f="category">' + catOpts + '</select></div>' +
          '<div class="ad-field"><label>Durée (secondes)</label><input class="ad-input" type="number" min="0" step="1" data-f="duration" value="' + escAttr(durVal) + '"></div>' +
        '</div>' +
        '<div class="ad-field"><label>Source <span class="ad-req">*</span></label>' +
          '<div class="av-src" id="av-src">' +
            '<label class="av-src-opt"><input type="radio" name="av-src" value="youtube"' + (initialSource === 'youtube' ? ' checked' : '') + '><span><i class="fa-brands fa-youtube"></i> YouTube</span></label>' +
            '<label class="av-src-opt"><input type="radio" name="av-src" value="vimeo"' + (initialSource === 'vimeo' ? ' checked' : '') + '><span><i class="fa-brands fa-vimeo"></i> Vimeo</span></label>' +
            '<label class="av-src-opt"><input type="radio" name="av-src" value="upload"' + (initialSource === 'upload' ? ' checked' : '') + '><span><i class="fa-solid fa-upload"></i> Upload</span></label>' +
          '</div></div>' +
        '<div class="ad-field" data-src="youtube vimeo"><label>Lien de la vidéo <span class="ad-req">*</span></label>' +
          '<input class="ad-input" data-f="external_url" value="' + escAttr((v && v.external_url) || '') + '" placeholder="https://www.youtube.com/watch?v=…  ou  https://vimeo.com/…">' +
          '<div class="ad-hint">Résolution auto pour les vidéos YouTube / Vimeo. L\'autoplay reste désactivé côté site public.</div></div>' +
        '<div class="ad-field" data-src="upload">' +
          '<div class="av-up-drop" id="av-up-drop">' +
            '<i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>' +
            '<div><b>Cliquez</b> ou glissez votre fichier vidéo ici</div>' +
            '<div class="ad-hint">MP4, WebM, MOV · maximum <b id="av-max">' + MAX_MB + ' Mo</b></div>' +
          '</div>' +
          '<input type="file" id="av-file" accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime" style="display:none">' +
          '<div class="av-upbar" id="av-upbar" hidden>' +
            '<div class="av-up-head"><b id="av-upname"></b><span id="av-uppct">0 %</span></div>' +
            '<div class="av-up-track"><div class="av-up-fill" id="av-upfill"></div></div>' +
          '</div>' +
          '<div class="av-updone" id="av-updone" hidden></div></div>' +
        '<div class="ad-field"><label>Miniature (image d\'aperçu)</label>' +
          '<div class="ad-img-field">' +
            '<div class="ad-img-preview av-thumb-preview" id="av-thumb-pv">' + thumbPv + '</div>' +
            '<div class="av-thumb-actions">' +
              '<button type="button" class="ad-btn ad-sm" data-act="pick"><i class="fa-solid fa-folder-open"></i> Choisir</button>' +
              '<button type="button" class="ad-btn ad-sm" data-act="auto"><i class="fa-solid fa-wand-magic-sparkles"></i> Récupérer auto</button>' +
              '<button type="button" class="ad-btn ad-sm ad-danger" data-act="clear"><i class="fa-solid fa-trash"></i></button>' +
            '</div></div>' +
          '<input type="hidden" data-f="thumbnail_url" value="' + escAttr(thumbVal) + '"></div>' +
        '<div class="ad-field"><label>Description</label><textarea class="ad-textarea" data-f="description" rows="3">' + esc((v && v.description) || '') + '</textarea></div>' +
        '<div class="ad-grid ad-grid-2">' +
          '<div class="ad-field"><label>Statut</label>' + statusOpt + '</div>' +
          '<div class="ad-field"><label>Ordre d\'affichage</label><input class="ad-input" type="number" min="0" step="1" data-f="display_order" value="' + escAttr(ordVal) + '"></div>' +
        '</div>' +
        '<label class="ad-check av-feat"><input type="checkbox" data-f="featured"' + (v && v.featured ? ' checked' : '') + '><span><i class="fa-solid fa-star"></i> Mettre à la une (une seule vidéo mise en avant)</span></label>' +
      '</form></div>' +
      '<div class="ad-modal-foot"><div class="ad-left">' +
        (isEdit ? '<button type="button" class="ad-btn ad-danger ad-av-del"><i class="fa-solid fa-trash"></i> Supprimer</button>' : '') +
      '</div><div class="ad-right">' +
        '<button type="button" class="ad-btn ad-ghost ad-cancel">Annuler</button>' +
        '<button type="button" class="ad-btn ad-primary ad-av-save"><i class="fa-solid fa-save"></i> Enregistrer</button>' +
      '</div></div></div>';
    pushDialog(m);

    function currentSource(modal) {
      var r = $('input[name="av-src"]:checked', modal);
      return r ? r.value : 'youtube';
    }
    function setSource(modal, val) {
      $$('[data-src]', modal).forEach(function (b) {
        b.style.display = (b.getAttribute('data-src') || '').split(' ').indexOf(val) === -1 ? 'none' : '';
      });
    }
    function setThumb(modal, url) {
      $('[data-f="thumbnail_url"]', modal).value = url || '';
      $('#av-thumb-pv', modal).innerHTML = url
        ? '<img src="' + escAttr(url) + '" alt="">'
        : '<span class="ad-img-empty"><i class="fa-solid fa-image"></i> Aucune miniature</span>';
    }

    var slugEdited = false;
    var titleIn = $('[data-f="title"]', m);
    var slugIn = $('[data-f="slug"]', m);
    titleIn.addEventListener('input', function () {
      if (!slugEdited && !slugIn.value) slugIn.value = slugify(titleIn.value);
    });
    slugIn.addEventListener('input', function () { slugEdited = true; });

    $$('input[name="av-src"]', m).forEach(function (r) {
      r.addEventListener('change', function () {
        if (!r.checked) return;
        setSource(m, r.value);
        var hint = $('.ad-hint', $('[data-src="youtube vimeo"]', m));
        if (hint) hint.style.display = '';
      });
    });

    $$('[data-act]', m).forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-act');
        var extIn = $('[data-f="external_url"]', m);
        var s = parseSource(extIn.value);
        if (act === 'pick') {
          openMediaModal(function (src) { setThumb(m, src); });
        } else if (act === 'clear') {
          setThumb(m, '');
        } else if (act === 'auto') {
          var st = currentSource(m);
          if (st === 'youtube' && s && s.type === 'youtube') {
            setThumb(m, 'https://i.ytimg.com/vi/' + s.id + '/hqdefault.jpg');
          } else if (st === 'vimeo' && s && s.type === 'vimeo') {
            window.fetch('https://vimeo.com/api/oembed.json?url=' + encodeURIComponent('https://vimeo.com/' + s.id))
              .then(function (r) { return r.json(); })
              .then(function (d) { if (d && d.thumbnail_url) setThumb(m, d.thumbnail_url); else toast('Miniature Vimeo introuvable', 'err'); })
              .catch(function () { toast('Miniature Vimeo introuvable', 'err'); });
          } else {
            toast('Renseignez d\u2019abord un lien YouTube ou Vimeo valide', 'err');
          }
        }
      });
    });

    // Upload
    var upPath = isEdit && v.storage_path ? v.storage_path : null;
    var upDone = $('#av-updone', m);
    var upBar = $('#av-upbar', m);
    var upFill = $('#av-upfill', m);
    var upPct = $('#av-uppct', m);
    var upName = $('#av-upname', m);
    var upDrop = $('#av-up-drop', m);
    var upFile = $('#av-file', m);

    function showCurrentUpload() {
      if (!upPath) return;
      if (upBar) upBar.hidden = true;
      if (upDone) { upDone.hidden = false; upDone.innerHTML = '<i class="fa-solid fa-circle-check"></i> Vidéo actuelle : <code>' + esc(upPath) + '</code> — déposez un fichier pour la remplacer.'; }
    }
    function startUploadBar(file) {
      if (upBar) { upBar.hidden = false; upName.textContent = file.name; upFill.style.width = '0%'; upPct.textContent = '0 %'; }
      if (upDone) upDone.hidden = true;
    }
    function uploadDone(res) {
      upPath = res.path;
      m.__storagePath = res.path;
      if (upBar) upBar.hidden = true;
      if (upDone) { upDone.hidden = false; upDone.innerHTML = '<i class="fa-solid fa-circle-check"></i> Fichier prêt : <code>' + esc(res.name) + '</code>'; }
      var durIn = $('[data-f="duration"]', m);
      if (res.duration && durIn && !durIn.value) durIn.value = res.duration;
    }
    function uploadErr(msg) {
      toast(msg, 'err');
      showCurrentUpload();
    }

    m.__oldStorage = isEdit && v.storage_path ? v.storage_path : null;

    if (isEdit && !upPath) showCurrentUpload();

    if (upDrop && upFile) {
      upDrop.addEventListener('click', function () { upFile.click(); });
      upDrop.addEventListener('dragover', function (e) { e.preventDefault(); upDrop.classList.add('ad-over'); });
      upDrop.addEventListener('dragleave', function () { upDrop.classList.remove('ad-over'); });
      upDrop.addEventListener('drop', function (e) {
        e.preventDefault();
        upDrop.classList.remove('ad-over');
        var f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (!f) return;
        startUploadBar(f);
        uploadVideo(f, m, v, function (p) { upFill.style.width = p + '%'; upPct.textContent = p + ' %'; }, uploadDone, uploadErr);
      });
      upFile.addEventListener('change', function () {
        var f = upFile.files && upFile.files[0];
        if (!f) return;
        startUploadBar(f);
        uploadVideo(f, m, v, function (p) { upFill.style.width = p + '%'; upPct.textContent = p + ' %'; }, uploadDone, uploadErr);
        upFile.value = '';
      });
    }

    setSource(m, currentSource(m));

    /* -------- Fermeture -------- */
    function close() { closeDialog(); m.remove(); }
    $('.ad-close-x', m).addEventListener('click', close);
    $('.ad-cancel', m).addEventListener('click', close);
    var delBtn = $('.ad-av-del', m);
    if (delBtn) delBtn.addEventListener('click', function () {
      if (!confirm('Supprimer définitivement cette vidéo ?' + (m.__oldStorage ? '\nLe fichier stocké sera aussi supprimé.' : ''))) return;
      var c = getClient(); if (!c) return;
      var chain = m.__oldStorage ? deleteObject(m.__oldStorage) : Promise.resolve();
      chain.then(function () { return c.from(TABLE).delete().eq('id', v.id); }).then(function (r) {
        if (r.error) throw r.error;
        toast('Vidéo supprimée', 'ok');
        logActivity('delete', TABLE, v.id);
        close();
        loadVideos();
      }).catch(function (e) { toast('Erreur : ' + e.message, 'err'); });
    });

    /* -------- Enregistrer -------- */
    $('.ad-av-save', m).addEventListener('click', function () {
      var btn = $('.ad-av-save', m);
      btn.disabled = true;
      saveVideo(m, v)
        .then(function () { close(); loadVideos(); })
        .catch(function (e) {
          toast((e && e.message) || 'Erreur', 'err');
          btn.disabled = false;
        });
    });
  }

  function saveVideo(m, v) {
    var c = getClient();
    if (!c) return Promise.reject({ message: 'Client Supabase indisponible.' });

    var title = String($('[data-f="title"]', m).value || '').trim();
    var slug = String($('[data-f="slug"]', m).value || '').trim();
    var category = $('[data-f="category"]', m).value;
    var sourceType = (function () { var r = $('input[name="av-src"]:checked', m); return r ? r.value : 'youtube'; })();
    var externalUrl = String($('[data-f="external_url"]', m).value || '').trim();
    var thumbnail = String($('[data-f="thumbnail_url"]', m).value || '').trim();
    var description = String($('[data-f="description"]', m).value || '').trim();
    var status = $('[data-f="status"]', m).value;
    var featured = !!$('[data-f="featured"]', m).checked;
    var duration = parseInt($('[data-f="duration"]', m).value, 10);
    var order = parseInt($('[data-f="display_order"]', m).value, 10);
    var storagePath = m.__storagePath || (v && v.storage_path) || null;

    if (!title) { return Promise.reject({ message: 'Le titre est obligatoire.' }); }
    if (!slug) slug = slugify(title);
    if (!category) category = null;

    if (sourceType === 'youtube' || sourceType === 'vimeo') {
      var ps = parseSource(externalUrl);
      if (sourceType === 'youtube' && !(ps && ps.type === 'youtube')) {
        return Promise.reject({ message: 'Lien YouTube invalide.' });
      }
      if (sourceType === 'vimeo' && !(ps && ps.type === 'vimeo')) {
        return Promise.reject({ message: 'Lien Vimeo invalide.' });
      }
    } else if (sourceType === 'upload' && !storagePath) {
      return Promise.reject({ message: 'Ajoutez d\'abord un fichier vidéo (upload).' });
    }

    var id = v && v.id ? v.id : recordId(m, v);
    var payload = {
      id: id,
      title: title,
      slug: slug,
      category: category,
      source_type: sourceType,
      external_url: sourceType === 'upload' ? null : (externalUrl || null),
      storage_path: sourceType === 'upload' ? storagePath : null,
      thumbnail_url: thumbnail || null,
      duration: isNaN(duration) || duration < 0 ? null : duration,
      featured: !!featured,
      display_order: isNaN(order) || order < 0 ? 0 : order,
      published: status === 'published'
    };

    return autoThumbUrl(payload).then(function (auto) {
      if (!payload.thumbnail_url && auto) payload.thumbnail_url = auto;
      var chain = payload.featured
        ? c.from(TABLE).update({ featured: false }).eq('featured', true).neq('id', id).then(function (r) { if (r.error) throw r.error; })
        : Promise.resolve();
      return chain.then(function () { return c.from(TABLE).upsert(payload); });
    }).then(function (r) {
      if (r.error) throw r.error;
      var replacedOld = m.__oldStorage && storagePath && m.__oldStorage !== storagePath;
      if (replacedOld) deleteObject(m.__oldStorage);
      toast(v ? 'Vidéo enregistrée' : 'Vidéo créée', 'ok');
      logActivity(v ? 'update' : 'create', TABLE, id, { source_type: sourceType, published: payload.published });
    });
  }

  /* ---------- Export module ---------- */
  window.BRAIN_ADMIN_AV = {
    render: render
  };
})();