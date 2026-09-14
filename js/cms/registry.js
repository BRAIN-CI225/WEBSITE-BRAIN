/* =========================================================
   BRAIN CMS — Registry des blocs (partagé admin + frontend)
   Définit : les types de sections, leurs schémas de
   configuration (validation), les champs de l'éditeur et
   les fonctions de rendu réutilisant le design BRAIN.
   ========================================================= */
(function () {
  'use strict';

  var ICONS = [
    'fa-lightbulb','fa-microchip','fa-video','fa-handshake','fa-palette','fa-laptop-code',
    'fa-hashtag','fa-pen-ruler','fa-clapperboard','fa-gears','fa-rocket','fa-heart',
    'fa-headset','fa-layer-group','fa-star','fa-bolt','fa-users','fa-envelope',
    'fa-phone','fa-globe','fa-bullseye','fa-chart-line','fa-mobile-screen','fa-camera',
    'fa-tv','fa-image','fa-chess-king','fa-compass','fa-filter','fa-magnet'
  ];

  function esc(value){
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escAttr(value){ return esc(value); }

  function pad(n){ return String(n).padStart(2, '0'); }

  /* Classe CSS personnalisée : uniquement des identifiants sûrs */
  function validCssClass(value){
    if (!value) return true;
    return /^[A-Za-z0-9_-]+( [A-Za-z0-9_-]+)*$/.test(String(value));
  }
  function cssClasses(cfg){
    var cls = cfg.custom_class;
    return cls && validCssClass(cls) ? String(cls).trim() : '';
  }

  /* Colonnes responsive (bureau / tablette / mobile) */
  function colsCfg(cfg, d, t, m){
    return {
      d: parseInt(cfg.columns_desktop, 10) || d,
      t: parseInt(cfg.columns_tablet, 10) || t,
      m: parseInt(cfg.columns_mobile, 10) || m
    };
  }
  function gridStyle(cfg, d, t, m){
    var cols = colsCfg(cfg, d, t, m);
    return 'style="--c-d:' + cols.d + ';--c-t:' + cols.t + ';--c-m:' + cols.m + '"';
  }

  /* Dates courtes fr-FR pour les articles */
  function fmtDate(iso){
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /* ---------- Sanitisation HTML stricte (CUSTOM HTML) ---------- */
  var SAFE_TAGS = /^(h[1-6]|p|strong|em|u|s|b|i|small|ul|ol|li|a|img|br|hr|blockquote|figure|figcaption|div|span|table|thead|tbody|tfoot|tr|th|td|iframe)$/i;
  var SAFE_ATTRS = ['href','src','alt','title','width','height','cols','rows','span','colspan','rowspan','rel','target','cite','frameborder','allow','allowfullscreen','loading','controls','played'];
  function sanitizeHtml(html){
    html = String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/javascript:/gi, '');
    if (!document || !document.createElement) return html;
    var box = document.createElement('div');
    box.innerHTML = html;
    if (!box.childNodes || !box.querySelectorAll) return html;
    function clean(node){
      if (node.nodeType !== 1) return node;
      var el = node;
      var tag = el.tagName ? el.tagName.toLowerCase() : '';
      if (tag === 'script' || tag === 'style') { el.remove(); return null; }
      if (!SAFE_TAGS.test(tag)) {
        var txt = document.createTextNode(el.textContent || '');
        el.replaceWith(txt);
        return null;
      }
      [].slice.call(el.attributes).forEach(function (a) {
        var n = a.name.toLowerCase();
        if (n.indexOf('on') === 0) { el.removeAttribute(a.name); return; }
        if (n.indexOf('data-') === 0) { el.removeAttribute(a.name); return; }
        if (SAFE_ATTRS.indexOf(n) === -1) { el.removeAttribute(a.name); }
      });
      if (tag === 'a') {
        var href = (el.getAttribute('href') || '').trim();
        if (!href || /^(javascript:|vbscript:|data:)/i.test(href)) el.removeAttribute('href');
      }
      if (tag === 'img') {
        var src = (el.getAttribute('src') || '').trim();
        if (!src || /^(javascript:|data:)/i.test(src)) el.removeAttribute('src');
      }
      if (tag === 'iframe' && !embeddedAllowed(el.src || '')) { el.remove(); return null; }
      [].slice.call(el.childNodes).forEach(function (c) {
        var r = clean(c);
        if (r === null && c === el) return;
      });
      return el;
    }
    [].slice.call(box.childNodes).forEach(function (n) { clean(n); });
    return box.innerHTML;
  }

  /* Sécurité : seuls ces hôtes sont autorisés pour un EMBED */
  var EMBED_ALLOWLIST = [
    'youtube.com','youtube-nocookie.com','youtu.be','player.vimeo.com',
    'www.google.com','maps.google.com','open.spotify.com','audius.co',
    'w.soundcloud.com','player.twitch.tv' ,'codepen.io','codesandbox.io'
  ];

  function embeddedAllowed(url){
    try {
      var u = new URL(url);
      var host = u.hostname.replace(/^www\./, '');
      return EMBED_ALLOWLIST.indexOf(host) !== -1;
    } catch (e) { return false; }
  }

  /* ---------- Champs réutilisables ---------- */
  var F = {
    title:      { name: 'title',      label: 'Titre',            type: 'text',      placeholder: 'Titre de la section' },
    subtitle:   { name: 'subtitle',   label: 'Sous-titre',       type: 'text',      placeholder: 'Sous-titre de la section' },
    content:    { name: 'content',    label: 'Contenu',          type: 'textarea',  placeholder: 'Contenu texte (une ligne par paragraphe)' },
    image:      { name: 'image',      label: 'Image',            type: 'image' },
    imageAlt:   { name: 'image_alt',  label: 'Texte alternatif', type: 'text' },
    background: { name: 'background', label: 'Fond / halo',      type: 'select',
                  options: [['none','Aucun'],['blue-orb','Halo bleu'],['orange-orb','Halo orange'],['orange-blue-orbs','Halo orange + bleu']] },
    backgroundImage:{ name: 'background_image', label: 'Image de fond', type: 'image',
                  help: 'Image pleine largeur derrière la section (assombrie automatiquement)' },
    tag:        { name: 'tag',        label: 'Étiquette',        type: 'text',      placeholder: 'ex : Nos expertises' },
    align:      { name: 'align',      label: 'Alignement',       type: 'select',
                  options: [['center','Centré'],['left','Gauche']] },
    animation:  { name: 'animation',  label: 'Animation (AOS)',  type: 'select',
                  options: [['fade-up','Fade up'],['fade-left','Fade gauche'],['fade-right','Fade droite'],['zoom-in','Zoom in'],['none','Aucune']] },
    paddingTop: { name: 'padding_top', label: 'Espace haut (px)', type: 'number', default: 90 },
    paddingBottom:{ name: 'padding_bottom', label: 'Espace bas (px)', type: 'number', default: 90 },
    marginTop:  { name: 'margin_top',  label: 'Marge haut (px)',  type: 'number', default: 0 },
    marginBottom:{ name: 'margin_bottom', label: 'Marge bas (px)', type: 'number', default: 0 },
    radius:     { name: 'radius',      label: 'Rayon des coins (px)', type: 'number', default: 0 },
    containerWidth:{ name: 'container_width', label: 'Largeur du conteneur', type: 'select',
                  options: [['normal','Normale'],['full','Pleine largeur'],['narrow','Étroite (760px)']] },
    customClass:{ name: 'custom_class', label: 'Classe CSS (sécurisée)', type: 'text',
                  placeholder: 'classes séparées par des espaces (a-z, chiffres, - _)' }
  };

  var COMMON_SETTINGS = [F.backgroundImage, F.marginTop, F.marginBottom, F.radius, F.containerWidth, F.customClass];
  var BASE_FIELDS = [F.tag, F.title, F.subtitle, F.content, F.align].concat(COMMON_SETTINGS).concat([F.background, F.animation, F.paddingTop, F.paddingBottom]);
  var HERO_FIELDS = [F.background];
  var SPACER_FIELDS = [];

  /* ---------- Registre ---------- */
  var BLOCK_TYPES = [];

  function register(def){
    def.defaults = def.defaults || {};
    BLOCK_TYPES.push(def);
  }

  /* =========================================================
     1. HERO SLIDER
     ========================================================= */
  register({
    type: 'hero', label: 'Hero / Slideshow', icon: 'fa-house',
    description: 'Grande bannière plein écran avec 7 slides d\'expertises.',
    fields: HERO_FIELDS.concat([
      { name: 'interval', label: 'Durée par slide (ms)', type: 'number', default: 6000 },
      { name: 'autoplay', label: 'Lecture automatique', type: 'checkbox', default: true },
      { name: 'loop',     label: 'Boucle infinie',      type: 'checkbox', default: true },
      { name: 'slides',   label: 'Slides',              type: 'repeater',
        fields: [
          { name: 'label', label: 'Étiquette', type: 'text' },
          { name: 'image', label: 'Image de fond', type: 'image' },
          { name: 'title', label: 'Grand titre (HTML autorisé pour <span>)', type: 'text' },
          { name: 'subtitle', label: 'Sous-titre', type: 'text' },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'cta', label: 'Texte du bouton', type: 'text' },
          { name: 'href', label: 'Lien du bouton', type: 'text' },
          { name: 'icon', label: 'Icône', type: 'select', options: ICONS.map(function(i){ return [i, i]; }) }
        ] }
    ]),
    validate: function (cfg) {
      var errs = [];
      if (!Array.isArray(cfg.slides) || cfg.slides.length === 0) errs.push('Au moins une slide est requise.');
      cfg.slides.forEach(function (s, i) {
        if (!s.image) errs.push('Slide ' + (i + 1) + ' : image manquante.');
        if (!s.title) errs.push('Slide ' + (i + 1) + ' : titre manquant.');
        if (!s.href) errs.push('Slide ' + (i + 1) + ' : lien manquant.');
      });
      return errs;
    },
    render: function (s, ctx) {
      var cfg = s.configuration || {};
      var slides = cfg.slides || [];
      var articles = slides.map(function (sl, i) {
        var active = i === 0 ? ' is-active' : '';
        return '<article class="hero-slide' + active + '" aria-hidden="' + (i === 0 ? 'false' : 'true') + '">' +
          '<img class="hero-slide-media" src="' + escAttr(sl.image) + '" alt="' + escAttr(sl.label || '') + '" loading="' + (i === 0 ? 'eager' : 'lazy') + '">' +
          '<div class="hero-slide-content">' +
            '<div class="hero-badge"><span class="dot"></span>' + esc(sl.label) + ' — Abidjan</div>' +
            '<h1>' + sl.title + '</h1>' +
            '<p class="hero-subtitle">' + esc(sl.subtitle) + '</p>' +
            '<p class="hero-text">' + esc(sl.description) + '</p>' +
            '<div class="hero-cta">' +
              '<a class="btn btn-primary" href="' + escAttr(sl.href) + '">' + esc(sl.cta) + ' <i class="fa-solid fa-arrow-right"></i></a>' +
              '<a class="btn btn-outline" href="portfolio.html">Voir nos réalisations</a>' +
            '</div>' +
            '<div class="hero-proof"><span><i class="fa-solid ' + escAttr(sl.icon || 'fa-bolt') + '"></i> Expertise BRAIN</span><span><i class="fa-solid fa-location-dot"></i> Abidjan, Côte d\'Ivoire</span></div>' +
          '</div></article>';
      }).join('');
      var dots = slides.map(function (sl, i) {
        return '<button class="hero-dot' + (i === 0 ? ' is-active' : '') + '" type="button" aria-label="Afficher la slide ' + (i + 1) + ': ' + escAttr(sl.label) + '" aria-current="' + (i === 0 ? 'true' : 'false') + '"></button>';
      }).join('');
      var wrapper = '<section class="cms-section cms-hero" data-cms-type="hero" data-cms-id="' + s.id + '">' +
        '<div class="hero-slider cms-hero-slider" data-cms-hero="' + s.id + '" aria-live="polite">' + articles + '</div>' +
        '<div class="hero-controls">' +
          '<button class="hero-arrow" type="button" data-cms-hero-prev="' + s.id + '" aria-label="Slide précédent"><i class="fa-solid fa-arrow-left"></i></button>' +
          '<div class="hero-dots" data-cms-hero-dots="' + s.id + '">' + dots + '</div>' +
          '<button class="hero-arrow" type="button" data-cms-hero-next="' + s.id + '" aria-label="Slide suivant"><i class="fa-solid fa-arrow-right"></i></button>' +
        '</div>' +
        '<div class="hero-progress"><span id="cms-hero-progress-' + s.id + '"></span></div>' +
        '</section>';
      if (ctx && ctx.afterRender) ctx.afterRender.push({ type: 'hero', id: s.id, cfg: cfg });
      return wrapper;
    }
  });

  /* =========================================================
     2. SERVICES GRID
     ========================================================= */
  register({
    type: 'services', label: 'Services', icon: 'fa-layer-group',
    description: 'Grille des services BRAIN issus de la base de données.',
    fields: BASE_FIELDS.concat([
      { name: 'limit', label: 'Nombre de services', type: 'number', default: 7 },
      { name: 'columns_desktop', label: 'Colonnes (bureau)', type: 'number', default: 3 },
      { name: 'columns_tablet', label: 'Colonnes (tablette)', type: 'number', default: 2 },
      { name: 'columns_mobile', label: 'Colonnes (mobile)', type: 'number', default: 1 },
      { name: 'order_by', label: 'Tri', type: 'select',
        options: [['display_order','Ordre défini'],['title_asc','Alphabétique A→Z'],['title_desc','Alphabétique Z→A']] },
      { name: 'show_image', label: 'Afficher l\'image', type: 'checkbox', default: true },
      { name: 'show_icon', label: 'Afficher l\'icône', type: 'checkbox', default: true },
      { name: 'show_description', label: 'Afficher la description', type: 'checkbox', default: true },
      { name: 'show_cta', label: 'Afficher le lien', type: 'checkbox', default: true }
    ]),
    validate: function (cfg) {
      var errs = [];
      var n = parseInt(cfg.limit, 10) || 0;
      if (n < 1) errs.push('Nombre de services invalide.');
      return errs;
    },
    render: function (s, ctx) {
      var cfg = s.configuration || {};
      var services = (ctx && ctx.refs && ctx.refs.services || []).slice();
      var order = cfg.order_by || 'display_order';
      if (order === 'title_asc') services.sort(function (a, b) { return String(a.title).localeCompare(String(b.title)); });
      else if (order === 'title_desc') services.sort(function (a, b) { return String(b.title).localeCompare(String(a.title)); });
      var limit = parseInt(cfg.limit, 10) || services.length || 3;
      var list = services.slice(0, limit);
      var cols = colsCfg(cfg, 3, 2, 1);
      var cards = list.map(function (sv, i) {
        var cls = 'service-card' + (i === 0 && cols.d > 1 && list.length % cols.d === 1 ? ' big' : '');
        return '<a href="' + escAttr(sv.url || 'services.html') + '" class="' + cls + '">' +
          (cfg.show_image && sv.image ? '<img src="' + escAttr(sv.image) + '" alt="' + escAttr(sv.title) + '" loading="lazy">' : '') +
          (cfg.show_icon !== false && sv.icon ? '<span class="sc-icon"><i class="fa-solid ' + escAttr(sv.icon) + '"></i></span>' : '') +
          '<div class="sc-content">' +
            '<span class="sc-num">SERVICE ' + pad(i + 1) + '</span>' +
            '<h3>' + esc(sv.title) + '</h3>' +
            (sv.tagline ? '<p class="sc-tagline">' + esc(sv.tagline) + '</p>' : '') +
            (cfg.show_description && sv.description ? '<p>' + esc(sv.description) + '</p>' : '') +
            (cfg.show_cta ? '<span class="sc-link">Découvrir le service <i class="fa-solid fa-arrow-right"></i></span>' : '') +
          '</div></a>';
      }).join('');
      return ctx.sectionWrap(s, ctx, '<div class="services-grid cms-cols" ' + gridStyle(cfg, 3, 2, 1) + '>' + cards + '</div>', 'services');
    }
  });

  /* =========================================================
     3. PROJECTS / PORTFOLIO
     ========================================================= */
  register({
    type: 'portfolio', label: 'Portfolio / Projets', icon: 'fa-images',
    description: 'Grille de projets issus de la base de données.',
    fields: BASE_FIELDS.concat([
      { name: 'limit', label: 'Nombre de projets', type: 'number', default: 3 },
      { name: 'columns_desktop', label: 'Colonnes (bureau)', type: 'number', default: 3 },
      { name: 'columns_tablet', label: 'Colonnes (tablette)', type: 'number', default: 2 },
      { name: 'columns_mobile', label: 'Colonnes (mobile)', type: 'number', default: 1 },
      { name: 'category', label: 'Filtrer par catégorie', type: 'text', placeholder: 'ex : branding — laisser vide pour tout afficher' },
      { name: 'show_category', label: 'Afficher la catégorie', type: 'checkbox', default: true },
      { name: 'show_description', label: 'Afficher la description', type: 'checkbox', default: true },
      { name: 'show_cta', label: 'Afficher « Voir tout le portfolio »', type: 'checkbox', default: true },
      { name: 'cta_text', label: 'Texte du lien global', type: 'text', default: 'Voir tout le portfolio' }
    ]),
    validate: function (cfg) {
      var n = parseInt(cfg.limit, 10) || 0;
      return n < 1 ? ['Nombre de projets invalide.'] : [];
    },
    render: function (s, ctx) {
      var cfg = s.configuration || {};
      var projects = (ctx && ctx.refs && ctx.refs.projects || []).slice();
      if (cfg.category) {
        var cat = String(cfg.category).toLowerCase();
        projects = projects.filter(function (p) { return (p.category || '').toLowerCase().indexOf(cat) !== -1; });
      }
      var list = projects.slice(0, parseInt(cfg.limit, 10) || projects.length || 3);
      var items = list.map(function (p) {
        return '<div class="portfolio-item">' +
          (p.image ? '<img src="' + escAttr(p.image) + '" alt="' + escAttr(p.title) + '" loading="lazy">' : '') +
          '<div class="pf-overlay">' +
            (cfg.show_category && p.category ? '<span class="pf-cat">' + esc(p.category) + '</span>' : '') +
            '<h4>' + esc(p.title) + '</h4>' +
            (cfg.show_description && p.description ? '<p>' + esc(p.description) + '</p>' : '') +
            '<a href="' + escAttr(p.url || 'portfolio.html') + '" class="pf-btn">Voir le projet</a>' +
          '</div></div>';
      }).join('');
      var tail = '';
      if (cfg.show_cta !== false) {
        tail = '<div class="center" style="margin-top:50px;"><a href="portfolio.html" class="btn btn-outline">' + esc(cfg.cta_text || 'Voir tout le portfolio') + '</a></div>';
      }
      return ctx.sectionWrap(s, ctx, '<div class="portfolio-grid cms-grid" ' + gridStyle(cfg, 3, 2, 1) + '>' + items + '</div>' + tail, 'portfolio');
    }
  });

  /* =========================================================
     4. BLOG GRID
     ========================================================= */
  register({
    type: 'blog', label: 'Articles / Blog', icon: 'fa-newspaper',
    description: 'Derniers articles publiés.',
    fields: BASE_FIELDS.concat([
      { name: 'limit', label: 'Nombre d\'articles', type: 'number', default: 3 },
      { name: 'columns_desktop', label: 'Colonnes (bureau)', type: 'number', default: 3 },
      { name: 'columns_tablet', label: 'Colonnes (tablette)', type: 'number', default: 2 },
      { name: 'columns_mobile', label: 'Colonnes (mobile)', type: 'number', default: 1 },
      { name: 'category', label: 'Filtrer par catégorie', type: 'text', placeholder: 'laisser vide pour tout afficher' },
      { name: 'featured_only', label: 'Uniquement les articles mis en avant', type: 'checkbox', default: false },
      { name: 'show_excerpt', label: 'Afficher le résumé', type: 'checkbox', default: true },
      { name: 'show_date', label: 'Afficher la date', type: 'checkbox', default: true },
      { name: 'show_author', label: 'Afficher l\'auteur', type: 'checkbox', default: true }
    ]),
    validate: function (cfg) {
      var n = parseInt(cfg.limit, 10) || 0;
      return n < 1 ? ['Nombre d\'articles invalide.'] : [];
    },
    render: function (s, ctx) {
      var cfg = s.configuration || {};
      var posts = (ctx && ctx.refs && ctx.refs.blog || []).slice();
      if (cfg.featured_only) posts = posts.filter(function (p) { return p.is_featured === true; });
      if (cfg.category) posts = posts.filter(function (p) { return (p.category || '').toLowerCase() === String(cfg.category).toLowerCase(); });
      var list = posts.slice(0, parseInt(cfg.limit, 10) || 3);
      var items = list.map(function (p) {
        var meta = '';
        if (cfg.show_date !== false || cfg.show_author !== false) {
          var bits = [];
          if (cfg.show_date !== false && p.published_at) bits.push('<time datetime="' + escAttr(p.published_at) + '">' + fmtDate(p.published_at) + '</time>');
          if (cfg.show_author !== false && p.author) bits.push('<span><i class="fa-solid fa-user"></i> ' + esc(p.author) + '</span>');
          meta = '<div class="cms-post-meta">' + bits.join('') + '</div>';
        }
        return '<article class="cms-post">' +
          (p.image ? '<a href="' + escAttr(p.url || '#') + '" class="cms-post-img"><img src="' + escAttr(p.image) + '" alt="' + escAttr(p.title) + '" loading="lazy"></a>' : '') +
          '<div class="cms-post-body">' +
            (p.category ? '<span class="cms-post-cat">' + esc(p.category) + '</span>' : '') +
            '<h3 class="cms-post-title"><a href="' + escAttr(p.url || '#') + '">' + esc(p.title) + '</a></h3>' +
            (cfg.show_excerpt && p.excerpt ? '<p class="cms-post-excerpt">' + esc(p.excerpt) + '</p>' : '') +
            meta +
          '</div></article>';
      }).join('');
      var html = '<div class="cms-post-grid cms-grid" ' + gridStyle(cfg, 3, 2, 1) + '>' + items + '</div>';
      return ctx.sectionWrap(s, ctx, html, 'blog');
    }
  });

  /* =========================================================
     5. TESTIMONIALS
     ========================================================= */
  register({
    type: 'testimonials', label: 'Témoignages', icon: 'fa-quote-left',
    description: 'Avis clients issus de la base de données.',
    fields: BASE_FIELDS.concat([
      { name: 'limit', label: 'Nombre de témoignages', type: 'number', default: 3 },
      { name: 'columns_desktop', label: 'Colonnes (bureau)', type: 'number', default: 3 },
      { name: 'columns_tablet', label: 'Colonnes (tablette)', type: 'number', default: 2 },
      { name: 'columns_mobile', label: 'Colonnes (mobile)', type: 'number', default: 1 },
      { name: 'show_rating', label: 'Afficher les étoiles', type: 'checkbox', default: true }
    ]),
    validate: function (cfg) {
      var n = parseInt(cfg.limit, 10) || 0;
      return n < 1 ? ['Nombre de témoignages invalide.'] : [];
    },
    render: function (s, ctx) {
      var cfg = s.configuration || {};
      var testis = (ctx && ctx.refs && ctx.refs.testimonials) || [];
      var list = testis.slice(0, parseInt(cfg.limit, 10) || 3);
      var items = list.map(function (t) {
        var stars = '';
        if (cfg.show_rating !== false) {
          for (var i = 0; i < (t.rating || 5); i++) stars += '★';
        }
        var initial = esc((t.client_name || 'C').charAt(0).toUpperCase());
        var avatar = t.photo ? '<img class="testi-avatar cms-avatar-img" src="' + escAttr(t.photo) + '" alt="' + escAttr(t.client_name) + '">' : '<div class="testi-avatar">' + initial + '</div>';
        return '<div class="testi-card">' +
          '<div class="quote-icon"><i class="fa-solid fa-quote-left"></i></div>' +
          (stars ? '<div class="testi-stars">' + stars + '</div>' : '') +
          '<p class="testi-text">« ' + esc(t.testimonial) + ' »</p>' +
          '<div class="testi-author">' + avatar +
            '<div><div class="t-name">' + esc(t.client_name) + '</div><div class="t-role">' + esc(t.company || t.position || '') + '</div></div>' +
          '</div></div>';
      }).join('');
      var html = '<div class="testi-grid cms-grid" ' + gridStyle(cfg, 3, 2, 1) + '>' + items + '</div>';
      return ctx.sectionWrap(s, ctx, html, 'testimonials');
    }
  });

  /* =========================================================
     6. STATISTICS
     ========================================================= */
  register({
    type: 'statistics', label: 'Statistiques', icon: 'fa-chart-line',
    description: 'Chiffres clés (compteurs) issus de la base de données.',
    fields: BASE_FIELDS.concat([
      { name: 'limit', label: 'Nombre de chiffres', type: 'number', default: 4 },
      { name: 'columns_desktop', label: 'Colonnes (bureau)', type: 'number', default: 4 },
      { name: 'columns_tablet', label: 'Colonnes (tablette)', type: 'number', default: 2 },
      { name: 'columns_mobile', label: 'Colonnes (mobile)', type: 'number', default: 2 }
    ]),
    validate: function (cfg) {
      var n = parseInt(cfg.limit, 10) || 0;
      return n < 1 ? ['Nombre de statistiques invalide.'] : [];
    },
    render: function (s, ctx) {
      var cfg = s.configuration || {};
      var stats = (ctx && ctx.refs && ctx.refs.statistics) || [];
      var list = stats.slice(0, parseInt(cfg.limit, 10) || 4);
      var items = list.map(function (st) {
        var cap = esc(st.number);
        var m = String(st.number || '').trim().match(/^(\d+)(.*)$/);
        var numEl = m
          ? '<div class="cb-num"><span class="cms-count" data-base="' + escAttr(m[1]) + '" data-suffix="' + escAttr(m[2]) + '">' + m[1] + esc(m[2]) + '</span></div>'
          : '<div class="cb-num">' + cap + '</div>';
        return '<div class="counter-box">' +
          (st.icon ? '<div class="cb-icon"><i class="fa-solid ' + escAttr(st.icon) + '"></i></div>' : '') +
          numEl +
          '<div class="cb-label">' + esc(st.label) + '</div>' +
        '</div>';
      }).join('');
      var html = '<div class="counters-row cms-grid" ' + gridStyle(cfg, 4, 2, 2) + '>' + items + '</div>';
      return ctx.sectionWrap(s, ctx, html, 'statistics');
    }
  });

  /* =========================================================
     7. CTA
     ========================================================= */
  register({
    type: 'cta', label: 'Appel à l\'action (CTA)', icon: 'fa-bullseye',
    description: 'Bandeau d\'appel à l\'action avec boutons.',
    fields: BASE_FIELDS.concat([
      { name: 'buttons', label: 'Boutons', type: 'repeater',
        fields: [
          { name: 'text', label: 'Texte', type: 'text' },
          { name: 'href', label: 'Lien', type: 'text' },
          { name: 'style', label: 'Style', type: 'select', options: [['primary','Primaire'],['outline','Contour']] }
        ] }
    ]),
    validate: function (cfg) {
      var errs = [];
      if (!Array.isArray(cfg.buttons) || !cfg.buttons.length) errs.push('Au moins un bouton est requis.');
      return errs;
    },
    render: function (s, ctx) {
      var cfg = s.configuration || {};
      var btns = (cfg.buttons || []).map(function (b) {
        return '<a href="' + escAttr(b.href || '#') + '" class="btn btn-' + escAttr(b.style || 'primary') + '">' + esc(b.text) + '</a>';
      }).join('');
      var html = '<div class="cta-section">' +
        '<h2>' + esc(s.title) + '</h2>' +
        (s.subtitle ? '<p>' + esc(s.subtitle) + '</p>' : '') +
        '<div class="cta-btns">' + btns + '</div></div>';
      return ctx.sectionWrap(s, ctx, html, 'cta');
    }
  });

  /* =========================================================
     8. CONTACT FORM
     ========================================================= */
  register({
    type: 'contact_form', label: 'Contact', icon: 'fa-envelope',
    description: 'Les coordonnées et le bouton de devis.',
    fields: BASE_FIELDS.concat([
      { name: 'phone', label: 'Téléphone (lien tel:)', type: 'text', default: '+2250711356324' },
      { name: 'phone_display', label: 'Téléphone (affiché)', type: 'text', default: '07 11 35 63 24' },
      { name: 'whatsapp', label: 'WhatsApp (numéro)', type: 'text', default: '2250711356324' },
      { name: 'email', label: 'Email', type: 'text', default: 'braincobusiness@gmail.com' },
      { name: 'website', label: 'Site web (affiché)', type: 'text', default: 'www.braincobusiness.com' },
      { name: 'form_action', label: 'URL du formulaire (FormSubmit)', type: 'text', default: 'https://formsubmit.co/braincobusiness@gmail.com' }
    ]),
    validate: function (cfg) {
      return (!cfg.email || cfg.email.indexOf('@') === -1) ? ['Email invalide.'] : [];
    },
    render: function (s, ctx) {
      var cfg = s.configuration || {};
      var band = '<div class="contact-band">' +
        '<a href="tel:' + escAttr(cfg.phone || '') + '" class="contact-tile">' +
          '<i class="fa-solid fa-phone"></i><span class="ct-label">Téléphone</span><span class="ct-value">' + esc(cfg.phone_display || '') + '</span></a>' +
        '<a href="https://wa.me/' + escAttr(cfg.whatsapp || '') + '" target="_blank" rel="noopener" class="contact-tile">' +
          '<i class="fa-brands fa-whatsapp"></i><span class="ct-label">WhatsApp</span><span class="ct-value">Écrivez-nous</span></a>' +
        '<a href="mailto:' + escAttr(cfg.email || '') + '" class="contact-tile">' +
          '<i class="fa-solid fa-envelope"></i><span class="ct-label">Email</span><span class="ct-value">' + esc(cfg.email || '') + '</span></a>' +
        '<a href="services.html" class="contact-tile">' +
          '<i class="fa-solid fa-globe"></i><span class="ct-label">Site web</span><span class="ct-value">' + esc(cfg.website || '') + '</span></a>' +
      '</div>';
      var btn = '<div class="center btn-cta-wrap"><a href="contact.html" class="btn btn-primary">Demander un devis <i class="fa-solid fa-arrow-right"></i></a></div>';
      return ctx.sectionWrap(s, ctx, band + btn, 'contact_form');
    }
  });

  /* =========================================================
     9. IMAGE GALLERY
     ========================================================= */
  register({
    type: 'gallery', label: 'Galerie d\'images', icon: 'fa-image',
    description: 'Grille d\'images avec zoom au clic.',
    fields: BASE_FIELDS.concat([
      { name: 'images', label: 'Images', type: 'repeater',
        fields: [
          { name: 'src', label: 'Image', type: 'image' },
          { name: 'alt', label: 'Légende', type: 'text' }
        ] },
      { name: 'columns_desktop', label: 'Colonnes (bureau)', type: 'number', default: 3 },
      { name: 'columns_tablet', label: 'Colonnes (tablette)', type: 'number', default: 2 },
      { name: 'columns_mobile', label: 'Colonnes (mobile)', type: 'number', default: 1 },
      { name: 'gap', label: 'Écart entre images (px)', type: 'number', default: 16 }
    ]),
    validate: function (cfg) {
      if (!Array.isArray(cfg.images) || !cfg.images.length) return ['Ajoutez au moins une image.'];
      var miss = cfg.images.filter(function (im) { return !im.src; }).length;
      return miss ? [miss + ' image(s) sans source.'] : [];
    },
    render: function (s, ctx) {
      var cfg = s.configuration || {};
      var imgs = (cfg.images || []).map(function (im, i) {
        return '<a class="cms-gallery-item" href="' + escAttr(im.src) + '" data-cms-lightbox target="_blank" rel="noopener">' +
          '<img src="' + escAttr(im.src) + '" alt="' + escAttr(im.alt || '') + '" loading="lazy"></a>';
      }).join('');
      var gap = parseInt(cfg.gap, 10) || 16;
      var html = '<div class="cms-gallery cms-grid" ' + gridStyle(cfg, 3, 2, 1) + ' style="gap:' + gap + 'px">' + imgs + '</div>';
      return ctx.sectionWrap(s, ctx, html, 'gallery');
    }
  });

  /* =========================================================
     10. VIDEO
     ========================================================= */
  register({
    type: 'video', label: 'Vidéo', icon: 'fa-clapperboard',
    description: 'Lecteur vidéo YouTube (iframe).',
    fields: BASE_FIELDS.concat([
      { name: 'video_url', label: 'URL ou ID YouTube', type: 'text', placeholder: 'ex : 6NziLBrldFo ou https://youtu.be/6NziLBrldFo' },
      { name: 'provider', label: 'Fournisseur', type: 'select', options: [['youtube','YouTube']] },
      { name: 'autoplay', label: 'Lecture auto (muet)', type: 'checkbox', default: true },
      { name: 'loop', label: 'Boucle', type: 'checkbox', default: true },
      { name: 'controls', label: 'Afficher les contrôles', type: 'checkbox', default: true }
    ]),
    validate: function (cfg) {
      if (!cfg.video_url) return ['URL vidéo requise.'];
      return [];
    },
    render: function (s, ctx) {
      var cfg = s.configuration || {};
      var id = (cfg.video_url || '').match(/(?:youtu\.be\/|v=|\/embed\/|^)([\w-]{6,20})/);
      var vid = id ? id[1] : '';
      var opts = '?rel=0&playsinline=1';
      if (cfg.autoplay) opts += '&autoplay=1&mute=1';
      if (cfg.loop !== false) opts += '&loop=1&playlist=' + vid;
      if (cfg.controls === false) opts += '&controls=0';
      var html = '<div class="cms-video-wrap"><iframe class="cms-video-frame" src="https://www.youtube-nocookie.com/embed/' +
        escAttr(vid) + opts + '" title="' + escAttr(s.title || 'Vidéo BRAIN') + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>';
      return ctx.sectionWrap(s, ctx, html, 'video');
    }
  });

  /* =========================================================
     11. LOGOS / PARTENAIRES
     ========================================================= */
  register({
    type: 'logos', label: 'Logos clients / partenaires', icon: 'fa-handshake',
    description: 'Bandeau de logos clients.',
    fields: BASE_FIELDS.concat([
      { name: 'items', label: 'Logos', type: 'repeater',
        fields: [
          { name: 'src', label: 'Logo', type: 'image' },
          { name: 'alt', label: 'Nom', type: 'text' }
        ] },
      { name: 'animation', label: 'Animation', type: 'select', options: [['static','Aucune'],['marquee','Défilement continu']] },
      { name: 'columns_mobile', label: 'Colonnes (mobile)', type: 'number', default: 2 }
    ]),
    validate: function (cfg) {
      if (!Array.isArray(cfg.items) || !cfg.items.length) return ['Ajoutez au moins un logo.'];
      return [];
    },
    render: function (s, ctx) {
      var cfg = s.configuration || {};
      var logos = (cfg.items || []).map(function (im) {
        return '<div class="client-logo" title="' + escAttr(im.alt || '') + '"><img src="' + escAttr(im.src) + '" alt="' + escAttr(im.alt || '') + '" loading="lazy"></div>';
      }).join('');
      var html = '<div class="clients-strip' + (cfg.animation === 'marquee' ? ' cms-marquee' : '') + '">' + logos + '</div>';
      return ctx.sectionWrap(s, ctx, html, 'logos');
    }
  });

  /* =========================================================
     12. FEATURES GRID (Pourquoi BRAIN ?)
     ========================================================= */
  register({
    type: 'features', label: 'Atouts (Pourquoi BRAIN ?)', icon: 'fa-star',
    description: 'Grille de cartes d\'atouts avec icônes.',
    fields: BASE_FIELDS.concat([
      { name: 'items', label: 'Atouts', type: 'repeater',
        fields: [
          { name: 'icon', label: 'Icône', type: 'select', options: ICONS.map(function(i){ return [i, i]; }) },
          { name: 'title', label: 'Titre', type: 'text' },
          { name: 'text', label: 'Description', type: 'textarea' }
        ] },
      { name: 'columns_desktop', label: 'Colonnes (bureau)', type: 'number', default: 4 },
      { name: 'columns_tablet', label: 'Colonnes (tablette)', type: 'number', default: 2 },
      { name: 'columns_mobile', label: 'Colonnes (mobile)', type: 'number', default: 1 }
    ]),
    validate: function (cfg) {
      if (!Array.isArray(cfg.items) || !cfg.items.length) return ['Ajoutez au moins un atout.'];
      return [];
    },
    render: function (s, ctx) {
      var cfg = s.configuration || {};
      var items = (cfg.items || []).map(function (it, i) {
        return '<div class="why-card">' +
          '<span class="wc-icon"><i class="fa-solid ' + escAttr(it.icon || 'fa-star') + '"></i></span>' +
          '<span class="wc-num">' + pad(i + 1) + '</span>' +
          '<h3>' + esc(it.title) + '</h3>' +
          '<p>' + esc(it.text) + '</p></div>';
      }).join('');
      var html = '<div class="why-grid cms-grid" ' + gridStyle(cfg, 4, 2, 1) + '>' + items + '</div>';
      return ctx.sectionWrap(s, ctx, html, 'features');
    }
  });

  /* =========================================================
     13. PRICING
     ========================================================= */
  register({
    type: 'pricing', label: 'Pricing / Offres', icon: 'fa-tags',
    description: 'Grille de formules (Starter, Growth, Premium, Entreprise).',
    fields: BASE_FIELDS.concat([
      { name: 'cta_text', label: 'Texte du bouton', type: 'text', default: 'Demander un devis' },
      { name: 'cta_url', label: 'Lien du bouton', type: 'text', default: 'contact.html' },
      { name: 'columns_desktop', label: 'Colonnes (bureau)', type: 'number', default: 4 },
      { name: 'columns_tablet', label: 'Colonnes (tablette)', type: 'number', default: 2 },
      { name: 'columns_mobile', label: 'Colonnes (mobile)', type: 'number', default: 1 },
      { name: 'plans', label: 'Formules', type: 'repeater',
        fields: [
          { name: 'name', label: 'Nom', type: 'text' },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'featured', label: 'Mise en avant', type: 'checkbox', default: false },
          { name: 'features', label: 'Prestations (une par ligne)', type: 'textarea' }
        ] }
    ]),
    validate: function (cfg) {
      if (!Array.isArray(cfg.plans) || !cfg.plans.length) return ['Ajoutez au moins une formule.'];
      return [];
    },
    render: function (s, ctx) {
      var cfg = s.configuration || {};
      var cards = (cfg.plans || []).map(function (p) {
        var feats = String(p.features || '').split('\n').map(function (f) { return f.trim(); }).filter(Boolean);
        var lis = feats.map(function (f) { return '<li><i class="fa-solid fa-check"></i> ' + esc(f) + '</li>'; }).join('');
        var cls = 'price-card' + (p.featured ? ' featured' : '');
        var btn = 'btn ' + (p.featured ? 'btn-primary' : 'btn-outline') + ' btn-block';
        return '<div class="' + cls + '">' +
          '<h3>' + esc(p.name) + '</h3>' +
          '<p class="p-desc">' + esc(p.description) + '</p>' +
          '<ul>' + lis + '</ul>' +
          '<a href="' + escAttr(cfg.cta_url || 'contact.html') + '" class="' + btn + '">' + esc(cfg.cta_text || 'Demander un devis') + '</a></div>';
      }).join('');
      var html = '<div class="pricing-grid cms-grid" ' + gridStyle(cfg, 4, 2, 1) + '>' + cards + '</div>';
      return ctx.sectionWrap(s, ctx, html, 'pricing');
    }
  });

  /* =========================================================
     14. FAQ
     ========================================================= */
  register({
    type: 'faq', label: 'FAQ', icon: 'fa-circle-question',
    description: 'Questions fréquentes (accordéon).',
    fields: BASE_FIELDS.concat([
      { name: 'limit', label: 'Nombre de questions', type: 'number', default: 4 }
    ]),
    validate: function (cfg) {
      var n = parseInt(cfg.limit, 10) || 0;
      return n < 1 ? ['Nombre de questions invalide.'] : [];
    },
    render: function (s, ctx) {
      var cfg = s.configuration || {};
      var faqs = (ctx && ctx.refs && ctx.refs.faqs) || [];
      var list = faqs.slice(0, parseInt(cfg.limit, 10) || 4);
      var items = list.map(function (f) {
        return '<details class="cms-faq-item"><summary><i class="fa-solid fa-circle-question"></i> ' +
          esc(f.question) + '<span class="cms-faq-icon"><i class="fa-solid fa-chevron-down"></i></span></summary>' +
          '<p>' + esc(f.answer) + '</p></details>';
      }).join('');
      var html = '<div class="cms-faq">' + items + (ctx.adminMode ? '' : '') + '</div>';
      return ctx.sectionWrap(s, ctx, html, 'faq');
    }
  });

  /* =========================================================
     15. TEXTE SEUL
     ========================================================= */
  register({
    type: 'text', label: 'Texte', icon: 'fa-align-left',
    description: 'Paragraphes, liste à puces ou timeline en 5 étapes.',
    fields: BASE_FIELDS.concat([
      { name: 'layout', label: 'Disposition', type: 'select',
        options: [['paragraphs','Paragraphes'],['list','Liste à puces'],['timeline','Timeline étapes'],['cards','Cartes (Titre | Texte)']] },
      { name: 'max_width', label: 'Largeur maximale (px)', type: 'number', default: 0 }
    ]),
    validate: function (cfg) {
      return (!s.content || !String(s.content).trim()) ? ['Un contenu texte est requis.'] : [];
    },
    render: function (s, ctx) {
      var cfg = s.configuration || {};
      var layout = cfg.layout || 'paragraphs';
      var raw = String(s.content || '');
      var html = '';
      if (layout === 'list') {
        var lis = raw.split('\n').filter(function (l) { return l.trim(); })
          .map(function (l) { return '<li><i class="fa-solid fa-check"></i> ' + esc(l) + '</li>'; }).join('');
        html = '<ul class="cms-list">' + lis + '</ul>';
      } else if (layout === 'timeline') {
        var steps = raw.split('\n').filter(function (l) { return l.trim(); }).map(function (l, i) {
          var parts = l.split('|');
          var t = parts[0] || 'Étape ' + (i + 1);
          var d = parts[1] || '';
          return '<div class="timeline-step"><div class="ts-circle">' + pad(i + 1) + '</div><h4>' + esc(t.trim()) + '</h4><p>' + esc(d.trim()) + '</p></div>';
        }).join('');
        html = '<div class="timeline-grid">' + steps + '</div>';
      } else if (layout === 'cards') {
        var cards = raw.split('\n').filter(function (l) { return l.trim(); }).map(function (l) {
          var parts = l.split('|');
          var t = parts[0] || '';
          var d = parts[1] || '';
          return '<div class="why-card"><span class="wc-icon"><i class="fa-solid fa-lightbulb"></i></span><h3>' + esc(t.trim()) + '</h3><p>' + esc(d.trim()) + '</p></div>';
        }).join('');
        html = '<div class="why-grid" style="grid-template-columns:repeat(2,1fr)">' + cards + '</div>';
      } else {
        html = raw.split('\n').filter(function (l) { return l.trim(); })
          .map(function (l) { return '<p class="cms-paragraph">' + esc(l) + '</p>'; }).join('');
      }
      var maxW = parseInt(cfg.max_width, 10) || 0;
      if (maxW > 0) html = '<div class="cms-text-content" style="max-width:' + maxW + 'px;margin-left:auto;margin-right:auto">' + html + '</div>';
      return ctx.sectionWrap(s, ctx, html, 'text');
    }
  });

  /* =========================================================
     16. TEXTE + IMAGE
     ========================================================= */
  register({
    type: 'text_image', label: 'Texte + Image', icon: 'fa-file-image',
    description: 'Bloc de texte avec image à gauche ou à droite.',
    fields: [
      F.title, F.subtitle, F.image, F.imageAlt,
      { name: 'content', label: 'Contenu texte', type: 'textarea' },
      { name: 'cta_text', label: 'Texte du bouton', type: 'text' },
      { name: 'cta_url', label: 'Lien du bouton', type: 'text' },
      { name: 'image_position', label: 'Position de l\'image', type: 'select', options: [['right','À droite'],['left','À gauche']] },
      { name: 'image_ratio', label: 'Format d\'image', type: 'select', options: [['auto','Original'],['16/9','16/9'],['4/3','4/3'],['1/1','Carré']] },
      { name: 'max_width', label: 'Largeur max du texte (px)', type: 'number', default: 0 }
    ].concat(COMMON_SETTINGS).concat([F.background, F.animation, F.paddingTop, F.paddingBottom]),
    validate: function (cfg) {
      return (!s.image) ? ['Une image est requise.'] : [];
    },
    render: function (s, ctx) {
      var cfg = s.configuration || {};
      var pos = cfg.image_position === 'left' ? 'cms-ti-left' : 'cms-ti-right';
      var ratio = cfg.image_ratio && cfg.image_ratio !== 'auto' ? ' style="aspect-ratio:' + escAttr(cfg.image_ratio) + '"' : '';
      var body = (s.content || '').split('\n').filter(function (l) { return l.trim(); })
        .map(function (l) { return '<p class="cms-paragraph">' + esc(l) + '</p>'; }).join('');
      var cta = '';
      if (cfg.cta_text && cfg.cta_url) {
        cta = '<div class="cms-ti-cta"><a class="btn btn-primary" href="' + escAttr(cfg.cta_url) + '">' + esc(cfg.cta_text) + ' <i class="fa-solid fa-arrow-right"></i></a></div>';
      }
      var maxW = parseInt(cfg.max_width, 10) || 0;
      var bodyStyle = maxW > 0 ? ' style="max-width:' + maxW + 'px"' : '';
      var html = '<div class="cms-text-image ' + pos + '">' +
        '<div class="cms-ti-media"><img src="' + escAttr(s.image) + '" alt="' + escAttr((cfg && cfg.image_alt) || s.image_alt || '') + '" loading="lazy"' + ratio + '></div>' +
        '<div class="cms-ti-body"' + bodyStyle + '>' + body + cta + '</div></div>';
      return ctx.sectionWrap(s, ctx, html, 'text_image');
    }
  });

  /* =========================================================
     17. CUSTOM HTML (SANITISÉ — contenu restreint)
     ========================================================= */
  register({
    type: 'custom_html', label: 'HTML personnalisé (restreint)', icon: 'fa-code',
    description: 'Contenu HTML avec balises contrôlées (aucun script).',
    fields: BASE_FIELDS.concat([
      { name: 'html', label: 'Balises autorisées', type: 'textarea',
        help: 'h1-h6, p, strong, em, ul, ol, li, a, img, br, blockquote, div, span, table, iframe (YouTube/Vimeo/Maps uniquement)' }
    ]),
    validate: function (cfg) {
      var html = cfg.html || '';
      if (!html.trim()) return ['Le contenu HTML est vide.'];
      if (/<script|javascript:|on\w+=/i.test(html)) return ['Le contenu HTML contient du code interdit.'];
      return [];
    },
    render: function (s, ctx) {
      var cfg = s.configuration || {};
      return ctx.sectionWrap(s, ctx, sanitizeHtml(cfg.html), 'custom_html');
    }
  });

  /* =========================================================
     18. SPACER / DIVIDER
     ========================================================= */
  register({
    type: 'spacer', label: 'Espaceur / Séparateur', icon: 'fa-arrows-up-down',
    description: 'Espace vertical ou ligne de séparation.',
    fields: [
      { name: 'mode', label: 'Type', type: 'select', options: [['space','Espace'],['line','Ligne de séparation']] },
      { name: 'height', label: 'Hauteur (px)', type: 'number', default: 60 },
      F.paddingTop, F.paddingBottom
    ],
    validate: function () { return []; },
    render: function (s, ctx) {
      var cfg = s.configuration || {};
      var h = parseInt(cfg.height, 10) || 60;
      if (cfg.mode === 'line') {
        return '<div class="cms-divider" style="height:' + h + 'px;display:flex;align-items:center;justify-content:center"><span style="height:1px;width:min(760px,80%);background:linear-gradient(90deg,transparent,rgba(246,139,31,.55),transparent)"></span></div>';
      }
      return '<div class="cms-spacer" style="height:' + h + 'px" aria-hidden="true"></div>';
    }
  });

  /* =========================================================
     19. EMBED (iframe externe contrôlée)
     ========================================================= */
  register({
    type: 'embed', label: 'Embed (iframe)', icon: 'fa-window-maximize',
    description: 'Carte, playlist, intégration YouTube/Vimeo (hôtes autorisés uniquement).',
    fields: BASE_FIELDS.concat([
      { name: 'embed_url', label: 'URL de l\'iframe', type: 'text', placeholder: 'https://www.youtube.com/embed/...' },
      { name: 'height', label: 'Hauteur (px)', type: 'number', default: 480 },
      { name: 'scrolling', label: 'Barre de défilement', type: 'checkbox', default: false }
    ]),
    validate: function (cfg) {
      if (!cfg.embed_url) return ['URL requise.'];
      return embeddedAllowed(cfg.embed_url) ? [] : ['Cet hôte n\'est pas autorisé pour les intégrations.'];
    },
    render: function (s, ctx) {
      var cfg = s.configuration || {};
      var h = parseInt(cfg.height, 10) || 480;
      var html = '<div class="cms-embed"><iframe src="' + escAttr(cfg.embed_url) + '" height="' + h + '" loading="lazy" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
        (cfg.scrolling ? '' : 'scrolling="no"') + ' allowfullscreen></iframe></div>';
      return ctx.sectionWrap(s, ctx, html, 'embed');
    }
  });

  /* ---------- API publique ---------- */
  var BRAINCMS = {
    ICONS: ICONS,
    esc: esc,
    escAttr: escAttr,
    pad: pad,
    embeddedAllowed: embeddedAllowed,
    sanitizeHtml: sanitizeHtml,
    validCssClass: validCssClass,
    gridStyle: gridStyle,
    BLOCK_TYPES: BLOCK_TYPES,
    baseFields: BASE_FIELDS.slice(),
    getType: function (type) {
      for (var i = 0; i < BLOCK_TYPES.length; i++) {
        if (BLOCK_TYPES[i].type === type) return BLOCK_TYPES[i];
      }
      return null;
    },
    /* Section commune : enveloppe <section> avec bandeau titre/sous-titre */
    sectionWrap: function (s, ctx, inner, type) {
      var cfg = s.configuration || {};
      var alignClass = cfg.align === 'left' ? 'left' : 'center';
      var orbs = '';
      var bg = cfg.background || s.background || 'none';
      if (bg === 'blue-orb') {
        orbs = '<div class="glow-orb glow-blue" style="width:420px;height:420px;top:8%;left:-160px;"></div>';
      } else if (bg === 'orange-orb') {
        orbs = '<div class="glow-orb glow-orange" style="width:450px;height:450px;bottom:0;right:-150px;"></div>';
      } else if (bg === 'orange-blue-orbs') {
        orbs = '<div class="glow-orb glow-orange" style="width:480px;height:480px;top:18%;left:-180px;"></div>' +
               '<div class="glow-orb glow-blue" style="width:420px;height:420px;bottom:10%;right:-160px;"></div>';
      }
      var padT = parseInt(cfg.padding_top, 10); if (isNaN(padT)) padT = 90;
      var padB = parseInt(cfg.padding_bottom, 10); if (isNaN(padB)) padB = 90;
      var marT = parseInt(cfg.margin_top, 10); if (isNaN(marT)) marT = 0;
      var marB = parseInt(cfg.margin_bottom, 10); if (isNaN(marB)) marB = 0;
      var radius = parseInt(cfg.radius, 10); if (isNaN(radius)) radius = 0;
      var aos = cfg.animation && cfg.animation !== 'none' ? ' data-aos="' + escAttr(cfg.animation) + '"' : '';
      var head = '';
      var style = 'padding-top:' + padT + 'px;padding-bottom:' + padB + 'px;margin-top:' + marT + 'px;margin-bottom:' + marB + 'px';
      if (radius > 0) style += ';border-radius:' + radius + 'px;overflow:hidden';
      var bgImg = cfg.background_image || s.background_image || '';
      if (bgImg) style += ';background-image:url("' + escAttr(bgImg) + '");background-size:cover;background-position:center';
      var custom = cssClasses(cfg);
      var containerClass = 'container';
      if (cfg.container_width === 'full') containerClass += ' cms-container-full';
      else if (cfg.container_width === 'narrow') containerClass += ' cms-container-narrow';
      if (cfg.tag || s.title || s.subtitle) {
        head += '<div class="section-tag' + (alignClass === 'center' ? ' center' : '') + '">' + esc(cfg.tag || '') + '</div>';
        if (s.title) {
          var titleHtml = String(s.title).replace(/\*\*(.+?)\*\*/g, '<span class="accent">$1</span>');
          head += '<h2 class="section-title' + (alignClass === 'center' ? ' center' : '') + '"' + aos + '>' + titleHtml + '</h2>';
        }
        if (s.subtitle) head += '<p class="section-sub' + (alignClass === 'center' ? ' center' : '') + '"' + aos + '>' + scape(s.subtitle) + '</p>';
      }
      return '<section class="cms-section cms-' + escAttr(type) + (custom ? ' ' + escAttr(custom) : '') + '" data-cms-type="' + escAttr(type) + '" data-cms-id="' + escAttr(s.id) + '" style="' + style + '">' +
        (bgImg ? '<span class="cms-bg-shade" aria-hidden="true"></span>' : '') +
        orbs +
        '<div class="' + containerClass + '">' + head + inner + '</div>' +
        '</section>';
    },
    /* Fabrique le contexte de rendu (références + helpers) */
    makeContext: function (options) {
      var refs = options && options.refs || {};
      var ctx = {
        adminMode: !!(options && options.adminMode),
        refs: refs,
        afterRender: [],
        sectionWrap: BRAINCMS.sectionWrap
      };
      return ctx;
    },
    renderSection: function (section, ctx) {
      var type = BRAINCMS.getType(section.section_type);
      if (!type) return '<section class="cms-section" data-cms-unknown="' + escAttr(section.section_type) + '"><div class="container"><p>Type de bloc inconnu : ' + escAttr(section.section_type) + '</p></div></section>';
      try {
        return type.render(section, ctx);
      } catch (e) {
        return '<section class="cms-section" data-cms-error="1"><div class="container"><p class="cms-error">Erreur de rendu : ' + esc(e.message) + '</p></div></section>';
      }
    },
    validateSection: function (section) {
      var type = BRAINCMS.getType(section.section_type);
      if (!type) return ['Type de bloc inconnu : ' + section.section_type];
      return (type.validate || function () { return []; })(section.configuration || {}, section);
    }
  };

  function scape(value){
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.BRAINCMS = BRAINCMS;
  if (typeof window.CMS_READY_CALLBACKS !== 'undefined') {
    window.CMS_READY_CALLBACKS.forEach(function (cb) { try { cb(BRAINCMS); } catch (e) {} });
    window.CMS_READY_CALLBACKS = [];
  }
})();