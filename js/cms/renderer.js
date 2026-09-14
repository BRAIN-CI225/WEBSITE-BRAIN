/* =========================================================
   BRAIN CMS — Renderer Frontend (lecture seule)
   Injecte les sections publiées dans le conteneur
   [data-cms-page="slug"]. Garde le contenu statique en
   secours si le CMS est vide. Mode aperçu admin : ?preview=
   ========================================================= */
(function () {
  'use strict';

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  /* Tables de référence dont certains blocs ont besoin */
  var REF_TABLES = {
    services:     'services',
    portfolio:    'projects',
    blog:         'blog_posts',
    testimonials: 'testimonials',
    statistics:   'statistics',
    faq:          'faqs'
  };
  var TYPES_NEEDING_REFS = Object.keys(REF_TABLES);

  function currentSlug() {
    var s = document.body.getAttribute('data-page');
    if (s) return s;
    var name = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var map = {
      '': 'home', 'index.html': 'home',
      'services.html': 'services', 'portfolio.html': 'portfolio',
      'a-propos.html': 'about', 'contact.html': 'contact'
    };
    return map[name] || name.replace('.html', '');
  }

  function readyPromise(client) {
    return new Promise(function (resolve) {
      if (window.brainSupabase && window.brainSupabase.ready) { resolve(client); return; }
      resolve(client);
    });
  }

  function whenReady(cb) {
    onReady(function () {
      var tries = 0;
      (function check() {
        if (window.brainSupabase && window.brainSupabase.ready && window.brainSupabase.client) { cb(window.brainSupabase.client); return; }
        if (window.brainSupabase && window.brainSupabase.error) { return; }
        if (++tries > 50) return;
        window.setTimeout(check, 200);
      })();
    });
  }

  whenReady(function (client) {

    var slug = currentSlug();
    var container = document.querySelector('[data-cms-page="' + slug + '"]');
    if (!container) return;

    var urlParams = new URLSearchParams(location.search);
    var wantsPreview = urlParams.has('preview') && urlParams.get('preview') === slug;

    (async function run() {
      try {
        /* Aperçu : uniquement si une session super admin existe (partagée avec /admin/) */
        var preview = false;
        if (wantsPreview) {
          var sess = await client.auth.getSession();
          if (sess && sess.data && sess.data.session) {
            var user = sess.data.session.user;
            var adm = await client.from('admins').select('role').eq('user_id', user.id).maybeSingle();
            if (adm && adm.data) preview = true;
          }
        }

        var page = await client.from('pages').select('id,title,slug').eq('slug', slug).maybeSingle();
        if (!page.data || !page.data.id) return;

        var query = client.from('page_sections')
          .select('*')
          .eq('page_id', page.data.id)
          .order('display_order', { ascending: true });
        if (!preview) query = query.eq('status', 'published').eq('visibility', 'visible');
        var res = await query;
        if (res.error) throw res.error;

        var sections = res.data || [];

        /* Références => tables liées */
        var refs = {};
        var needed = {};
        sections.forEach(function (sec) {
          if (TYPES_NEEDING_REFS.indexOf(sec.section_type) !== -1) needed[sec.section_type] = true;
        });
        await Promise.all(Object.keys(needed).map(function (type) {
          var table = REF_TABLES[type];
          return client.from(table).select('*').order('display_order', { ascending: true })
            .then(function (r) {
              if (r.data) {
                refs[type] = r.data.filter(function (row) {
                  return preview ? true : row.is_visible !== false;
                });
              }
            });
        }));

        var engine = window.BRAINCMS;
        if (!engine) return;

        var ctx = engine.makeContext({ refs: refs });
        var out = sections.map(function (sec) { return engine.renderSection(sec, ctx); }).join('\n');
        if (!out) return;

        container.innerHTML = out;

        /* Après-rendu : hero slideshow */
        (ctx.afterRender || []).forEach(function (task) {
          if (task.type === 'hero') initHero(task.id, task.cfg);
        });

        /* On masque le contenu statique de secours */
        var statics = document.querySelectorAll('.cms-static');
        for (var i = 0; i < statics.length; i++) statics[i].style.display = 'none';

        /* Barre d'aperçu admin */
        if (preview) {
          var bar = document.createElement('div');
          bar.className = 'cms-preview-bar';
          bar.innerHTML = '<span><i class="fa-solid fa-eye"></i> Aperçu CMS — «' + esc(page.data.title) + '»</span>' +
            '<a href="admin/#/pages/' + page.data.slug + '">Administrer</a> ' +
            '<a href="' + escAttr((location.pathname.split('/').pop() || 'index.html')) + '">Quitter l\'aperçu</a>';
          document.body.appendChild(bar);
        }

        /* Animations de révélation inline (même logique AOS-lite que le site) */
        try {
          var aosEls = container.querySelectorAll('[data-aos]');
          if ('IntersectionObserver' in window && aosEls.length) {
            var aosObs = new IntersectionObserver(function (entries) {
              entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                  var delay = parseInt(entry.target.getAttribute('data-aos-delay') || '0', 10) || 0;
                  window.setTimeout(function () { entry.target.classList.add('aos-animate'); }, delay);
                  aosObs.unobserve(entry.target);
                }
              });
            }, { threshold: 0.15 });
            aosEls.forEach(function (n) { aosObs.observe(n); });
          } else {
            for (var ai = 0; ai < aosEls.length; ai++) aosEls[ai].classList.add('aos-animate');
          }
        } catch (e) {}

        /* Compteurs animés (bloc statistiques) */
        try { initCounters(container); } catch (e) {}
      } catch (err) {
        if (window.console) console.error('BRAINCMS renderer:', err);
      }
    })();
  });

  /* ---------- Compteurs animés ---------- */
  function initCounters(scope) {
    var nums = scope.querySelectorAll('.cms-count');
    if (!nums.length) return;
    function run(el) {
      var base = parseInt(el.getAttribute('data-base'), 10) || 0;
      var suffix = el.getAttribute('data-suffix') || '';
      var start = performance.now();
      var duration = 1400;
      var out = el;
      function tick(now) {
        var p = Math.min((now - start) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        out.textContent = Math.floor(eased * base) + suffix;
        if (p < 1) { requestAnimationFrame(tick); }
        else { out.textContent = base + suffix; }
      }
      requestAnimationFrame(tick);
    }
    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { run(entry.target); obs.unobserve(entry.target); }
        });
      }, { threshold: 0.3 });
      nums.forEach(function (n) { obs.observe(n); });
    } else {
      nums.forEach(function (n) { run(n); });
    }
  }

  /* ---------- Mini slideshow héro (règles propres au rendu CMS) ---------- */
  function initHero(id, cfg) {
    var root = document.querySelector('[data-cms-hero="' + id + '"]');
    if (!root) return;
    var slides = root.querySelectorAll('.hero-slide');
    var dots = root.parentElement.querySelectorAll('[data-cms-hero-dots="' + id + '"] .hero-dot');
    if (!slides.length) return;
    var progress = document.getElementById('cms-hero-progress-' + id);
    var idx = 0;
    var timer = null;
    var interval = Math.max(2500, parseInt((cfg && cfg.interval) || 6000, 10) || 6000);

    if (progress) {
      progress.classList.add('is-running');
      progress.style.animationDuration = (interval / 1000) + 's';
    }

    function goTo(n) {
      idx = (n + slides.length) % slides.length;
      slides.forEach(function (sl, i) {
        sl.classList.toggle('is-active', i === idx);
        sl.setAttribute('aria-hidden', i === idx ? 'false' : 'true');
      });
      dots.forEach(function (d, i) {
        d.classList.toggle('is-active', i === idx);
        d.setAttribute('aria-current', i === idx ? 'true' : 'false');
      });
      if (progress) {
        progress.classList.remove('is-running');
        void progress.offsetWidth;
        progress.classList.add('is-running');
        progress.style.animationDuration = (interval / 1000) + 's';
      }
    }

    function schedule() {
      if (timer) window.clearTimeout(timer);
      if (cfg && cfg.autoplay === false) return;
      timer = window.setTimeout(function () { goTo(idx + 1); schedule(); }, interval);
    }

    dots.forEach(function (d, i) { d.addEventListener('click', function () { goTo(i); schedule(); }); });
    var prev = document.querySelector('[data-cms-hero-prev="' + id + '"]');
    var next = document.querySelector('[data-cms-hero-next="' + id + '"]');
    if (prev) prev.addEventListener('click', function () { goTo(idx - 1); schedule(); });
    if (next) next.addEventListener('click', function () { goTo(idx + 1); schedule(); });

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if ((!cfg || cfg.autoplay !== false) && !reduceMotion) schedule();
  }

  function esc(value) { return window.BRAINCMS ? window.BRAINCMS.esc(value) : String(value); }
  function escAttr(value) { return window.BRAINCMS ? window.BRAINCMS.escAttr(value) : String(value); }
})();