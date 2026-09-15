/* =========================================================
   BRAIN — Page Nos Produits (dynamique, pilotée par Supabase)
   - /produits.html            => liste des produits publiés
   - /produits/<slug>          => fiche produit (récupérée en DB)
   Le contenu vient UNIQUEMENT de la table "products".
   Aucun produit n'est codé en dur (pas de données inventées).
   ========================================================= */
(function () {
  'use strict';

  var SITE = 'https://www.braincobusiness.com';

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function whenSupabase(cb) {
    onReady(function () {
      function check() {
        if (window.brainSupabase && window.brainSupabase.ready && window.brainSupabase.client) { cb(window.brainSupabase.client); return; }
        if (window.brainSupabase && window.brainSupabase.error) return;
        setTimeout(check, 200);
      }
      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        if (window.brainSupabase && window.brainSupabase.ready && window.brainSupabase.client) { clearInterval(timer); cb(window.brainSupabase.client); }
        else if (tries > 40) { clearInterval(timer); }
      }, 200);
    });
  }

  function esc(value) { return window.BRAINCMS ? window.BRAINCMS.esc(value) : String(value == null ? '' : value); }
  function escAttr(value) { return esc(value); }
  function sanitize(html) { return window.BRAINCMS ? window.BRAINCMS.sanitizeHtml(html) : ''; }

  /* URL d'image correcte depuis n'importe quelle route (/produits/<slug>) */
  function absSrc(url) {
    if (!url) return '';
    if (/^(https?:|data:|\/)/i.test(String(url))) return String(url);
    return '/' + String(url).replace(/^\/+/, '');
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function route() {
    var path = location.pathname.replace(/\.html$/, '');
    var parts = path.split('/').filter(Boolean);
    var qp = new URLSearchParams(location.search).get('p');
    if (parts[0] === 'produits') return { slug: parts[1] || null };
    if (qp) return { slug: qp };
    return { slug: null };
  }

  /* ---------- MÉTADONNÉES DYNAMIQUES (SEO) ---------- */
  function upsertMeta(attr, nameOrProp, content) {
    var tag = document.querySelector('meta[' + attr + '="' + nameOrProp + '"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(attr, nameOrProp);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
  }

  function applySeo(p) {
    var indexable = (p.indexing || 'index') !== 'noindex';
    var title = p.seo_title || (p.name + (p.category ? ' — ' + p.category : '') + ' | BRAIN');
    var desc = p.seo_description || p.short_description || '';
    var url = p.canonical_url || (SITE + '/produits/' + p.slug);
    var image = p.og_image || p.image || '';

    document.title = title;
    upsertMeta('name', 'description', desc);
    upsertMeta('name', 'robots', indexable ? 'index, follow, max-image-preview:large' : 'noindex, follow');
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:title', p.og_title || title);
    upsertMeta('property', 'og:description', p.og_description || desc);
    upsertMeta('property', 'og:url', url);
    if (image) upsertMeta('property', 'og:image', absSrc(image));
    upsertMeta('name', 'twitter:title', p.og_title || title);
    upsertMeta('name', 'twitter:description', p.og_description || desc);
    if (image) upsertMeta('name', 'twitter:image', absSrc(image));

    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', url);

    /* JSON-LD produit */
    var old = document.getElementById('seo-dynamic');
    if (old) old.remove();
    var schema = null;
    if (p.schema_json && typeof p.schema_json === 'object' && p.schema_json['@type']) {
      schema = p.schema_json;
    } else {
      schema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        'name': p.name,
        'description': p.short_description || p.full_description || '',
        'category': p.category || undefined,
        'url': url,
        'brand': { '@type': 'Brand', 'name': 'BRAINCO BUSINESS' }
      };
      if (p.image) schema.image = absSrc(p.image);
    }
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = 'seo-dynamic';
    s.textContent = JSON.stringify(schema);
    document.head.appendChild(s);
  }

  /* ---------- CARTE PRODUIT (liste) ---------- */
  function card(p) {
    var img = p.image || p.logo;
    var priceLine = '';
    return '<a class="product-card" href="/produits/' + escAttr(p.slug) + '">' +
      (img ? '<div class="product-card-media"><img src="' + escAttr(absSrc(img)) + '" alt="' + escAttr(p.name) + '" loading="lazy"></div>' : '') +
      '<div class="product-card-body">' +
        '<div class="product-card-top">' +
          (p.category ? '<span class="product-chip">' + esc(p.category) + '</span>' : '') +
          '<span class="product-status"><i class="fa-solid fa-circle-check"></i> En ligne</span>' +
        '</div>' +
        '<h3>' + esc(p.name) + '</h3>' +
        (p.slogan ? '<p class="product-card-tagline">' + esc(p.slogan) + '</p>' : '') +
        (p.short_description ? '<p class="product-card-excerpt">' + esc(p.short_description) + '</p>' : '') +
        '<div class="product-card-foot">' +
          (p.sector ? '<span class="product-sector"><i class="fa-solid fa-arrow-trend-up"></i> ' + esc(p.sector) + '</span>' : '') +
          '<span class="product-card-link">Découvrir <i class="fa-solid fa-arrow-right"></i></span>' +
        '</div>' +
      '</div></a>';
  }

  /* ---------- FICHE PRODUIT ---------- */
  function renderDetail(p) {
    var root = document.getElementById('produits-detail-root');
    if (!root) return;

    var img = p.image || p.logo;
    var cta;
    if (p.external_url && /^https?:/i.test(p.external_url)) {
      cta = '<a class="btn btn-primary" href="' + escAttr(p.external_url) + '" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> ' + esc(p.cta_text || 'Découvrir la solution') + '</a>';
    } else {
      cta = '<a class="btn btn-primary" href="/contact"><i class="fa-solid fa-arrow-right"></i> ' + esc(p.cta_text || 'Demander une démo') + '</a>';
    }

    var breadcrumb = '<nav class="breadcrumb" aria-label="Fil d\'Ariane"><a href="/">Accueil</a> <span class="bc-sep">/</span> <a href="/produits">Nos Produits</a> <span class="bc-sep">/</span> <span class="bc-cur">' + esc(p.name) + '</span></nav>';

    var hero = '<header class="product-hero">' + breadcrumb +
      '<div class="product-hero-inner">' +
        (p.logo ? '<div class="product-logo"><img src="' + escAttr(absSrc(p.logo)) + '" alt="' + escAttr(p.name) + '"></div>' : '') +
        '<div class="product-hero-info">' +
          '<div class="product-hero-tags">' +
            (p.category ? '<span class="product-chip">' + esc(p.category) + '</span>' : '') +
            (p.sector ? '<span class="product-chip product-chip-ghost">' + esc(p.sector) + '</span>' : '') +
          '</div>' +
          '<h1>' + esc(p.name) + '</h1>' +
          (p.slogan ? '<p class="product-hero-slogan">' + esc(p.slogan) + '</p>' : '') +
          (p.short_description ? '<p class="product-hero-desc">' + esc(p.short_description) + '</p>' : '') +
          '<div class="product-hero-cta">' + cta +
            '<a class="btn btn-outline" href="/contact">Parlons de votre projet</a>' +
          '</div>' +
        '</div>' +
        (img ? '<div class="product-hero-media"><img src="' + escAttr(absSrc(img)) + '" alt="' + escAttr(p.name) + '"></div>' : '') +
      '</div></header>';

    /* Sections optionnelles (rendues uniquement si renseignées) */
    var sections = '';

    if (p.full_description) {
      sections += '<section class="product-block"><div class="product-title"><i class="fa-solid fa-circle-info"></i> Description</div><div class="product-prose">' + sanitize(p.full_description) + '</div></section>';
    }
    if (p.problem_solved) {
      sections += '<section class="product-block product-block-accent"><div class="product-title"><i class="fa-solid fa-lightbulb"></i> Problème résolu</div><p class="product-prose">' + esc(p.problem_solved) + '</p></section>';
    }
    if (p.presentation) {
      sections += '<section class="product-block"><div class="product-title"><i class="fa-solid fa-book-open"></i> Présentation</div><div class="product-prose">' + sanitize(p.presentation) + '</div></section>';
    }

    if (Array.isArray(p.features) && p.features.length) {
      var feats = p.features.map(function (f) {
        return '<div class="product-feature">' +
          (f.icon ? '<span class="product-feature-icon"><i class="fa-solid ' + escAttr(f.icon) + '"></i></span>' : '<span class="product-feature-icon"><i class="fa-solid fa-cube"></i></span>') +
          '<div><h3>' + esc(f.title) + '</h3>' + (f.description ? '<p>' + esc(f.description) + '</p>' : '') + '</div>' +
        '</div>';
      }).join('');
      sections += '<section class="product-block"><div class="product-title"><i class="fa-solid fa-list-check"></i> Fonctionnalités</div><div class="product-features">' + feats + '</div></section>';
    }

    if (Array.isArray(p.benefits) && p.benefits.length) {
      var bens = p.benefits.map(function (b) {
        return '<li><i class="fa-solid fa-check"></i> <div><strong>' + esc(b.title || '') + '</strong>' + (b.description ? '<p>' + esc(b.description) + '</p>' : '') + '</div></li>';
      }).join('');
      sections += '<section class="product-block"><div class="product-title"><i class="fa-solid fa-gift"></i> Avantages</div><ul class="product-benefits">' + bens + '</ul></section>';
    }

    if (p.sector) {
      sections += '<section class="product-block"><div class="product-title"><i class="fa-solid fa-arrow-trend-up"></i> Secteurs concernés</div><div class="product-chips"><span class="product-chip">' + esc(p.sector) + '</span></div></section>';
    }
    if (p.target_audience) {
      sections += '<section class="product-block"><div class="product-title"><i class="fa-solid fa-users"></i> Public cible</div><p class="product-prose">' + esc(p.target_audience) + '</p></section>';
    }

    if (Array.isArray(p.gallery) && p.gallery.filter(Boolean).length) {
      var shots = p.gallery.filter(Boolean).map(function (src) {
        return '<a class="product-shot" href="' + escAttr(absSrc(src)) + '" target="_blank" rel="noopener"><img src="' + escAttr(absSrc(src)) + '" alt="' + escAttr(p.name) + ' — capture d\'écran" loading="lazy"></a>';
      }).join('');
      sections += '<section class="product-block"><div class="product-title"><i class="fa-solid fa-image"></i> Aperçus</div><div class="product-shots">' + shots + '</div></section>';
    }

    if (p.video) {
      var vid = embedVideo(p.video);
      if (vid) sections += '<section class="product-block"><div class="product-title"><i class="fa-solid fa-circle-play"></i> Vidéo</div><div class="product-video">' + vid + '</div></section>';
    }

    /* Galerie libre (liens/URLs supplémentaires) */
    if (Array.isArray(p.gallery) && p.gallery.filter(Boolean).length) {
      /* déjà couvert par Aperçus ci-dessus */
    }

    var ctaEnd = '<section class="product-block product-cta-final">' +
      '<h2>Intéressé par ' + esc(p.name) + ' ?</h2>' +
      '<p>Contactez l\'équipe BRAIN à Abidjan : démonstration, prise en main et accompagnement au déploiement.</p>' +
      '<div class="cta-btns">' + cta + '<a class="btn btn-outline" href="/contact">Nous contacter</a></div>' +
    '</section>';

    root.innerHTML = hero + sections + ctaEnd;
  }

  function embedVideo(url) {
    try {
      var u = String(url || '').trim();
      if (!u) return '';
      var host = '';
      if (/^https?:/i.test(u)) {
        try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
      }
      if (host === 'youtu.be') {
        u = 'https://www.youtube.com/watch?v=' + u.split('/').pop();
        host = 'youtube.com';
      }
      var id = u.match(/(?:youtube\.com\/embed\/|youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|^)([\w-]{6,20})/);
      if (host === 'youtube.com' || host === 'youtube-nocookie.com' || (!host && id)) {
        var vid = u.match(/^([\w-]{6,20})$/);
        var videoId = id ? id[1] : (vid ? vid[1] : '');
        if (!videoId) return '';
        return '<div class="cms-video-wrap"><iframe class="cms-video-frame" src="https://www.youtube-nocookie.com/embed/' + escAttr(videoId) + '?rel=0&playsinline=1" title="' + escAttr('Vidéo') + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>';
      }
      if (host === 'player.vimeo.com' || host === 'vimeo.com') {
        var vimeoId = u.match(/(?:vimeo\.com\/)(\d+)(?:\/|$)/);
        if (!vimeoId) return '';
        return '<div class="cms-video-wrap"><iframe class="cms-video-frame" src="https://player.vimeo.com/video/' + escAttr(vimeoId[1]) + '" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>';
      }
      return '';
    } catch (e) { return ''; }
  }

  /* ---------- BOOT ---------- */
  function render(client) {
    var r = route();
    if (r.slug) {
      client.from('products').select('*').eq('slug', r.slug).eq('status', 'published').maybeSingle()
        .then(function (res) {
          var p = res.error || !res.data ? null : res.data;
          var list = document.getElementById('produits-liste');
          var detail = document.getElementById('produits-detail');
          if (list) list.style.display = 'none';
          var none = document.getElementById('produits-detail-none');
          if (detail && p) {
            detail.style.display = '';
            renderDetail(p);
            applySeo(p);
          } else {
            if (none) none.style.display = '';
            var listing = document.getElementById('produits-grid');
            if (listing) { listing.innerHTML = ''; }
            var empty = document.getElementById('produits-empty');
            if (empty) empty.style.display = '';
          }
        });
      return;
    }

    /* LISTE */
    client.from('products').select('*').eq('status', 'published')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(function (res) {
        var list = res.data || [];
        var grid = document.getElementById('produits-grid');
        var empty = document.getElementById('produits-empty');
        if (grid) {
          grid.innerHTML = list.map(card).join('');
          if (list.length) {
            if (empty) empty.style.display = 'none';
          } else {
            if (empty) empty.style.display = '';
          }
        }
      });
  }

  whenSupabase(render);
})();