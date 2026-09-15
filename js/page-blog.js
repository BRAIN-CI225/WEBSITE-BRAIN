/* =========================================================
   BRAIN — Page Blog (dynamique, pilotée par Supabase)
   - /blog.html        => liste (mis en avant + derniers articles,
                          catégories, recherche, pagination)
   - /blog/<slug>      => article (contenu depuis la table blog_posts)
   Les articles proviennent UNIQUEMENT de Supabase : rien n'est
   codé en dur dans le HTML.
   ========================================================= */
(function () {
  'use strict';

  var SITE = 'https://www.braincobusiness.com';
  var PER_PAGE = 6;

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function whenSupabase(cb) {
    onReady(function () {
      var tries = 0;
      var t = setInterval(function () {
        tries++;
        if (window.brainSupabase && window.brainSupabase.ready && window.brainSupabase.client) { clearInterval(t); cb(window.brainSupabase.client); }
        else if (tries > 40) { clearInterval(t); }
      }, 200);
    });
  }

  function esc(value) { return window.BRAINCMS ? window.BRAINCMS.esc(value) : String(value == null ? '' : value); }
  function escAttr(value) { return esc(value); }
  function sanitize(html) { return window.BRAINCMS ? window.BRAINCMS.sanitizeHtml(html) : String(html || ''); }

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

  function readingTime(post) {
    var text = ((post.content || '') + ' ' + (post.excerpt || '')).replace(/<[^>]*>/g, ' ');
    var words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }

  function route() {
    var path = location.pathname.replace(/\.html$/, '');
    var parts = path.split('/').filter(Boolean);
    var qp = new URLSearchParams(location.search).get('p');
    if (parts[0] === 'blog') return { slug: parts[1] || null };
    if (qp) return { slug: qp };
    return { slug: null };
  }

  /* ---------- MÉTADONNÉES DYNAMIQUES (SEO) ---------- */
  function upsertMeta(attr, nameOrProp, content) {
    if (!content) return;
    var tag = document.querySelector('meta[' + attr + '="' + nameOrProp + '"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(attr, nameOrProp);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
  }
  function upsertLink(rel, href) {
    var tag = document.querySelector('link[rel="' + rel + '"][data-dyn="1"]');
    if (!tag) {
      tag = document.createElement('link');
      tag.setAttribute('rel', rel);
      tag.setAttribute('data-dyn', '1');
      document.head.appendChild(tag);
    }
    tag.setAttribute('href', href);
  }
  function upsertJsonLd(schema) {
    var old = document.getElementById('seo-dynamic');
    if (old) old.remove();
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = 'seo-dynamic';
    s.textContent = JSON.stringify(schema);
    document.head.appendChild(s);
  }
  function clearDynamicSeo() {
    var old = document.getElementById('seo-dynamic');
    if (old) old.remove();
    var dyn = document.querySelectorAll('link[data-dyn="1"]');
    for (var i = 0; i < dyn.length; i++) dyn[i].remove();
  }

  function applyArticleSeo(p) {
    var url = p.canonical_url || (SITE + '/blog/' + p.slug);
    var title = p.seo_title || (p.title + ' | BRAIN');
    var desc = p.seo_description || p.excerpt || '';
    var image = p.og_image || p.image || '';
    var indexable = (p.indexing || 'index') !== 'noindex';

    document.title = title;
    upsertMeta('name', 'description', desc);
    upsertMeta('name', 'robots', indexable ? 'index, follow, max-image-preview:large' : 'noindex, follow');
    upsertMeta('property', 'og:type', 'article');
    upsertMeta('property', 'og:title', p.og_title || title);
    upsertMeta('property', 'og:description', p.og_description || desc);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'article:published_time', p.published_at || '');
    upsertMeta('property', 'article:section', p.category || '');
    if (image) upsertMeta('property', 'og:image', absSrc(image));
    upsertMeta('name', 'twitter:title', p.og_title || title);
    upsertMeta('name', 'twitter:description', p.og_description || desc);
    if (image) upsertMeta('name', 'twitter:image', absSrc(image));

    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', url);
    upsertLink('alternate', url);

    upsertJsonLd({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      'headline': p.title,
      'description': desc,
      'datePublished': p.published_at || p.created_at,
      'dateModified': p.updated_at || p.published_at || p.created_at,
      'author': { '@type': 'Person', 'name': p.author || 'BRAIN' },
      'publisher': { '@id': SITE + '/#organization' },
      'mainEntityOfPage': { '@id': url },
      'image': image ? absSrc(image) : undefined,
      'url': url
    });
  }

  /* ---------- LISTE ---------- */
  var state = { posts: [], categories: [], category: '', query: '', page: 1 };

  function postCard(p, featured) {
    var meta = '';
    var bits = [];
    if (p.published_at) bits.push('<time datetime="' + escAttr(p.published_at) + '"><i class="fa-solid fa-calendar"></i> ' + fmtDate(p.published_at) + '</time>');
    if (p.author) bits.push('<span><i class="fa-solid fa-user"></i> ' + esc(p.author) + '</span>');
    bits.push('<span><i class="fa-solid fa-clock"></i> ' + readingTime(p) + ' min</span>');
    meta = '<div class="article-meta">' + bits.join('') + '</div>';

    return '<article class="article-card' + (featured ? ' article-featured' : '') + '">' +
      '<a href="/blog/' + escAttr(p.slug) + '" aria-label="Lire : ' + escAttr(p.title) + '">' +
        (p.image ? '<img src="' + escAttr(absSrc(p.image)) + '" alt="' + escAttr(p.title) + '" loading="lazy">' : '') +
      '</a>' +
      '<div class="article-body">' +
        '<div class="article-kicker-row">' +
          (p.category ? '<span class="acat">' + esc(p.category) + '</span>' : '') +
          (p.tags && String(p.tags).trim() ? '<span class="article-tags">' + esc(String(p.tags).split(',').slice(0, 2).join(' · ').trim()) + '</span>' : '') +
        '</div>' +
        '<h3><a href="/blog/' + escAttr(p.slug) + '">' + esc(p.title) + '</a></h3>' +
        (p.excerpt ? '<p class="article-excerpt">' + esc(p.excerpt) + '</p>' : '') +
        meta +
        '<a href="/blog/' + escAttr(p.slug) + '" class="article-link">Lire l\'article <i class="fa-solid fa-arrow-right"></i></a>' +
      '</div></article>';
  }

  function featuredCard(p) {
    var block = el('div', { class: 'article-featured-wrap' });
    block.innerHTML =
      '<article class="article-featured">' +
        '<a class="article-featured-media" href="/blog/' + escAttr(p.slug) + '">' +
          (p.image ? '<img src="' + escAttr(absSrc(p.image)) + '" alt="' + escAttr(p.title) + '" loading="lazy">' : '') +
          '<span class="article-featured-badge"><i class="fa-solid fa-star"></i> À la une</span>' +
        '</a>' +
        '<div class="article-featured-body">' +
          (p.category ? '<span class="acat">' + esc(p.category) + '</span>' : '') +
          '<h2><a href="/blog/' + escAttr(p.slug) + '">' + esc(p.title) + '</a></h2>' +
          (p.excerpt ? '<p class="article-excerpt">' + esc(p.excerpt) + '</p>' : '') +
          '<div class="article-meta">' +
            (p.published_at ? '<time datetime="' + escAttr(p.published_at) + '"><i class="fa-solid fa-calendar"></i> ' + fmtDate(p.published_at) + '</time>' : '') +
            (p.author ? '<span><i class="fa-solid fa-user"></i> ' + esc(p.author) + '</span>' : '') +
            '<span><i class="fa-solid fa-clock"></i> ' + readingTime(p) + ' min</span>' +
          '</div>' +
          '<a href="/blog/' + escAttr(p.slug) + '" class="article-link">Lire l\'article <i class="fa-solid fa-arrow-right"></i></a>' +
        '</div>' +
      '</article>';
    return block;
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    if (children) { (Array.isArray(children) ? children : [children]).forEach(function (c) { if (c != null) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); }
    return node;
  }

  function renderListing() {
    var featuredHost = document.getElementById('blog-featured');
    var grid = document.getElementById('blog-grid');
    var cats = document.getElementById('blog-cats');
    var pageNav = document.getElementById('blog-pagination');
    var empty = document.getElementById('blog-empty');

    var posts = state.posts.slice();
    if (state.category) posts = posts.filter(function (p) { return (p.category || '').toLowerCase() === state.category; });
    if (state.query) {
      var q = state.query.toLowerCase();
      posts = posts.filter(function (p) {
        return (p.title || '').toLowerCase().indexOf(q) !== -1 ||
               (p.excerpt || '').toLowerCase().indexOf(q) !== -1 ||
               (p.category || '').toLowerCase().indexOf(q) !== -1 ||
               (p.tags || '').toLowerCase().indexOf(q) !== -1;
      });
    }

    /* Catégories (chips) */
    if (cats) {
      cats.innerHTML = '';
      cats.appendChild(el('button', { class: 'blog-cat' + (state.category === '' ? ' is-active' : ''), type: 'button', html: 'Tous' }));
      state.categories.forEach(function (c) {
        cats.appendChild(el('button', { class: 'blog-cat' + (state.category === c ? ' is-active' : ''), type: 'button', html: esc(c) }));
      });
      Array.prototype.forEach.call(cats.querySelectorAll('.blog-cat'), function (btn, i) {
        btn.addEventListener('click', function () {
          state.category = i === 0 ? '' : state.categories[i - 1];
          state.page = 1;
          renderListing();
        });
      });
    }

    /* Mis en avant : sur la page 1, catégorie « Tous », sans recherche */
    if (featuredHost) {
      featuredHost.innerHTML = '';
      if (state.page === 1 && state.category === '' && !state.query) {
        var feat = state.posts.filter(function (p) { return p.is_featured === true; })[0] || state.posts[0];
        if (feat) featuredHost.appendChild(featuredCard(feat));
      }
    }

    /* Pagination */
    var totalPages = Math.max(1, Math.ceil(posts.length / PER_PAGE));
    if (state.page > totalPages) state.page = totalPages;
    var start = (state.page - 1) * PER_PAGE;
    var pageSlice = posts.slice(start, start + PER_PAGE);

    if (grid) {
      grid.innerHTML = pageSlice.map(function (p) { return postCard(p); }).join('');
    }
    if (empty) empty.style.display = posts.length ? 'none' : '';

    if (pageNav) {
      pageNav.innerHTML = '';
      if (totalPages > 1) {
        pageNav.appendChild(el('button', { class: 'blog-page' + (state.page === 1 ? ' is-disabled' : ''), type: 'button', html: '<i class="fa-solid fa-arrow-left"></i> Précédent' }));
        pageNav.appendChild(el('span', { class: 'blog-page-info', text: 'Page ' + state.page + ' / ' + totalPages }));
        pageNav.appendChild(el('button', { class: 'blog-page' + (state.page === totalPages ? ' is-disabled' : ''), type: 'button', html: 'Suivant <i class="fa-solid fa-arrow-right"></i>' }));
        var btns = pageNav.querySelectorAll('.blog-page');
        btns[0].addEventListener('click', function () { if (state.page > 1) { state.page--; renderListing(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
        btns[1].addEventListener('click', function () { if (state.page < totalPages) { state.page++; renderListing(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
      }
    }
  }

  function loadListing(client) {
    var search = document.getElementById('blog-search');
    if (search) {
      search.addEventListener('input', function () {
        state.query = search.value.trim();
        state.page = 1;
        renderListing();
      });
    }

    client.from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .eq('is_visible', true)
      .order('published_at', { ascending: false })
      .then(function (res) {
        var posts = res.data || [];
        state.posts = posts;
        var map = {};
        posts.forEach(function (p) { if (p.category) map[p.category] = true; });
        state.categories = Object.keys(map).sort(function (a, b) { return a.localeCompare(b); });
        state.onlyFeatured = false;
        renderListing();
      });
  }

  /* ---------- ARTICLE ---------- */
  function relatedPosts(posts, current) {
    var same = posts.filter(function (q) { return q.id !== current.id && (q.category || '').toLowerCase() === String(current.category || '').toLowerCase(); });
    var others = posts.filter(function (q) { return q.id !== current.id && (q.category || '').toLowerCase() !== String(current.category || '').toLowerCase(); });
    return same.concat(others).slice(0, 3);
  }

  function shareBar(url, title) {
    var enc = encodeURIComponent(url);
    var t = encodeURIComponent(title);
    return '<div class="article-share">' +
      '<span>Partager</span>' +
      '<a href="https://www.facebook.com/sharer/sharer.php?u=' + enc + '" target="_blank" rel="noopener" aria-label="Partager sur Facebook"><i class="fa-brands fa-facebook-f"></i></a>' +
      '<a href="https://x.com/intent/tweet?url=' + enc + '&text=' + t + '" target="_blank" rel="noopener" aria-label="Partager sur X"><i class="fa-brands fa-x-twitter"></i></a>' +
      '<a href="https://www.linkedin.com/sharing/share-offsite/?url=' + enc + '" target="_blank" rel="noopener" aria-label="Partager sur LinkedIn"><i class="fa-brands fa-linkedin-in"></i></a>' +
      '<a href="https://wa.me/?text=' + t + '%20' + enc + '" target="_blank" rel="noopener" aria-label="Partager sur WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>' +
      '<button type="button" class="article-share-copy" data-copy="' + escAttr(url) + '" aria-label="Copier le lien"><i class="fa-solid fa-link"></i></button>' +
    '</div>';
  }

  function renderArticle(p, posts) {
    var root = document.getElementById('blog-detail-root');
    if (!root) return;

    var url = p.canonical_url || (SITE + '/blog/' + p.slug);
    var related = relatedPosts(posts, p);
    var relCards = related.map(function (q) {
      return '<article class="article-card">' +
        '<a href="/blog/' + escAttr(q.slug) + '"><img src="' + escAttr(absSrc(q.image)) + '" alt="' + escAttr(q.title) + '" loading="lazy"></a>' +
        '<div class="article-body">' +
          (q.category ? '<span class="acat">' + esc(q.category) + '</span>' : '') +
          '<h3><a href="/blog/' + escAttr(q.slug) + '">' + esc(q.title) + '</a></h3>' +
          '<p class="article-excerpt">' + esc(q.excerpt) + '</p>' +
          '<a href="/blog/' + escAttr(q.slug) + '" class="article-link">Lire l\'article <i class="fa-solid fa-arrow-right"></i></a>' +
        '</div></article>';
    }).join('');

    root.innerHTML =
      '<nav class="breadcrumb" aria-label="Fil d\'Ariane"><a href="/">Accueil</a> <span class="bc-sep">/</span> <a href="/blog">Blog</a> <span class="bc-sep">/</span> <span class="bc-cur">' + esc(p.title) + '</span></nav>' +
      '<article class="article-detail">' +
        '<header class="article-detail-head">' +
          '<div class="article-detail-cat">' + esc(p.category || '') + '</div>' +
          '<h1>' + esc(p.title) + '</h1>' +
          '<div class="article-meta">' +
            (p.published_at ? '<time datetime="' + escAttr(p.published_at) + '"><i class="fa-solid fa-calendar"></i> ' + fmtDate(p.published_at) + '</time>' : '') +
            (p.author ? '<span><i class="fa-solid fa-user"></i> ' + esc(p.author) + '</span>' : '') +
            '<span><i class="fa-solid fa-clock"></i> Lecture : ' + readingTime(p) + ' min</span>' +
          '</div>' +
        '</header>' +
        (p.image ? '<img class="article-detail-cover" src="' + escAttr(absSrc(p.image)) + '" alt="' + escAttr(p.title) + '" loading="eager">' : '') +
        '<div class="article-prose">' +
          (p.excerpt ? '<p class="article-lead">' + esc(p.excerpt) + '</p>' : '') +
          sanitize(p.content) +
        '</div>' +
        shareBar(url, p.title) +
      '</article>' +

      (related.length ? '<div class="article-related"><h2 class="section-title center">À lire aussi</h2><div class="articles-grid">' + relCards + '</div></div>' : '') +

      '<div class="cta-section" data-aos="zoom-in">' +
        '<h2>Envie de passer à l\'action ?</h2>' +
        '<p>Discutons de votre projet de digitalisation, de site web ou de communication avec l\'équipe BRAIN.</p>' +
        '<div class="cta-btns">' +
          '<a href="/contact" class="btn btn-primary">Demander un devis gratuit</a>' +
          '<a href="/services" class="btn btn-outline">Découvrir nos services</a>' +
        '</div>' +
      '</div>';

    var copyBtn = root.querySelector('.article-share-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        if (navigator.clipboard) navigator.clipboard.writeText(copyBtn.getAttribute('data-copy')).then(function () { toastHint('Lien copié'); });
        else window.prompt('Copiez ce lien :', url);
      });
    }

    applyArticleSeo(p);
  }

  function toastHint(msg) {
    var t = document.getElementById('toast-hint');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast-hint';
      t.className = 'toast-hint';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('is-visible');
    setTimeout(function () { t.classList.remove('is-visible'); }, 2200);
  }

  /* ---------- BOOT ---------- */
  function render(client) {
    var r = route();
    if (r.slug) {
      var list = document.getElementById('blog-liste');
      var detail = document.getElementById('blog-detail');
      if (list) list.style.display = 'none';
      var none = document.getElementById('blog-detail-none');
      if (detail) detail.style.display = '';

      client.from('blog_posts')
        .select('*')
        .eq('status', 'published')
        .eq('is_visible', true)
        .order('published_at', { ascending: false })
        .then(function (all) {
          var posts = all.data || [];
          var p = posts.filter(function (q) { return q.slug === r.slug; })[0] || null;
          if (p) {
            renderArticle(p, posts);
          } else {
            if (none) none.style.display = '';
            var root = document.getElementById('blog-detail-root');
            if (root) root.innerHTML = '';
            clearDynamicSeo();
          }
        });
      return;
    }

    clearDynamicSeo();
    loadListing(client);
  }

  whenSupabase(render);
})();