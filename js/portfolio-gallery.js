/* =========================================================
   BRAIN — Portfolio : galerie / slider premium
   Catalogue : window.BRAIN_REALISATIONS (js/realisations-data.js)
   Fonctions : stage grand format, miniatures, prev/next, lecture
   automatique en boucle (play/pause + barre de progression), clavier,
   balayage tactile, préchargement, visionneuse plein écran.
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

  function pad(n) { return String(n).padStart(2, '0'); }

  function buildPicture(item, cls, imgCls, sizes) {
    var pic = document.createElement('picture');
    if (cls) pic.className = cls;
    if (item.avif) {
      var sAvif = document.createElement('source');
      sAvif.type = 'image/avif';
      sAvif.srcset = item.avif;
      if (sizes) sAvif.sizes = sizes;
      pic.appendChild(sAvif);
    }
    if (item.src) {
      var sWebp = document.createElement('source');
      sWebp.type = 'image/webp';
      sWebp.srcset = item.src;
      if (sizes) sWebp.sizes = sizes;
      pic.appendChild(sWebp);
    }
    var img = document.createElement('img');
    if (imgCls) img.className = imgCls;
    img.src = item.src || item.thumb || item.full;
    img.alt = item.alt || item.title || '';
    if (item.width && item.height) { img.width = item.width; img.height = item.height; }
    img.decoding = 'async';
    pic.appendChild(img);
    return pic;
  }

  onReady(function () {
    var root = document.querySelector('[data-brain-gallery]');
    if (!root) return;

    var data = window.BRAIN_REALISATIONS;
    var items = data && Array.isArray(data.items) ? data.items : [];
    if (!items.length) { root.style.display = 'none'; return; }

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var idx = 0;
    var inView = false;

    /* ---------- Structure : stage ---------- */
    var stage = document.createElement('div');
    stage.className = 'bg-stage';
    stage.setAttribute('aria-roledescription', 'carrousel');
    stage.setAttribute('aria-label', 'Galerie des réalisations');
    stage.innerHTML =
      '<button class="bg-arrow bg-arrow--prev" type="button" data-bg-prev aria-label="Visuel précédent"><i class="fa-solid fa-arrow-left"></i></button>' +
      '<figure class="bg-frame">' +
        '<picture class="bg-picture"></picture>' +
        '<figcaption class="bg-caption">' +
          '<span class="bg-cap-cat"></span>' +
          '<span class="bg-cap-title" aria-live="polite"></span>' +
        '</figcaption>' +
      '</figure>' +
      '<button class="bg-arrow bg-arrow--next" type="button" data-bg-next aria-label="Visuel suivant"><i class="fa-solid fa-arrow-right"></i></button>' +
      '<button class="bg-zoom" type="button" data-bg-zoom aria-label="Agrandir le visuel"><i class="fa-solid fa-expand"></i></button>' +
      '<button class="bg-play" type="button" data-bg-play aria-label="Mettre en pause le diaporama" aria-pressed="false"><i class="fa-solid fa-play"></i></button>' +
      '<div class="bg-counter" aria-hidden="true"><span data-bg-current>01</span><span class="bg-sep">/</span><span data-bg-total>' + pad(items.length) + '</span></div>' +
      '<div class="bg-progress" aria-hidden="true"><span data-bg-progress></span></div>';

    /* ---------- Structure : miniatures ---------- */
    var thumbs = document.createElement('div');
    thumbs.className = 'bg-thumbs';
    thumbs.setAttribute('role', 'tablist');
    thumbs.setAttribute('aria-label', 'Miniatures de la galerie');

    items.forEach(function (item, i) {
      var btn = document.createElement('button');
      btn.className = 'bg-thumb';
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      btn.setAttribute('aria-label', 'Afficher ' + (item.title || ('visuel ' + (i + 1))));
      btn.dataset.index = String(i);
      var pic = buildPicture(item, 'bg-thumb-pic', 'bg-thumb-img', '(max-width: 700px) 22vw, 120px');
      var img = pic.querySelector('img');
      if (img) { img.loading = 'lazy'; img.removeAttribute('width'); img.removeAttribute('height'); }
      var num = document.createElement('span');
      num.className = 'bg-thumb-num';
      num.textContent = item.page != null ? pad(item.page) : pad(i + 1);
      btn.appendChild(pic);
      btn.appendChild(num);
      thumbs.appendChild(btn);
    });

    var shell = document.createElement('div');
    shell.className = 'bg-shell';
    shell.appendChild(stage);
    shell.appendChild(thumbs);
    root.appendChild(shell);

    /* ---------- Structure : visionneuse plein écran ---------- */
    var lb = document.createElement('div');
    lb.className = 'bg-lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Visionneuse plein écran');
    lb.setAttribute('aria-hidden', 'true');
    lb.innerHTML =
      '<div class="bg-lb-backdrop" data-bg-close></div>' +
      '<button class="bg-lb-close" type="button" data-bg-close aria-label="Fermer la visionneuse"><i class="fa-solid fa-xmark"></i></button>' +
      '<button class="bg-lb-arrow bg-lb-prev" type="button" data-bg-prev aria-label="Visuel précédent"><i class="fa-solid fa-arrow-left"></i></button>' +
      '<figure class="bg-lb-figure"><img class="bg-lb-img" decoding="async" alt=""></figure>' +
      '<button class="bg-lb-arrow bg-lb-next" type="button" data-bg-next aria-label="Visuel suivant"><i class="fa-solid fa-arrow-right"></i></button>' +
      '<div class="bg-lb-meta"><span class="bg-lb-caption"></span> <a class="bg-lb-open" data-bg-open target="_blank" rel="noopener">Voir l\'original</a></div>';
    document.body.appendChild(lb);

    /* ---------- Références ---------- */
    var stagePic = stage.querySelector('.bg-picture');
    var capCat = stage.querySelector('.bg-cap-cat');
    var capTitle = stage.querySelector('.bg-cap-title');
    var curEl = stage.querySelector('[data-bg-current]');
    var prevBtns = document.querySelectorAll('[data-bg-prev]');
    var nextBtns = document.querySelectorAll('[data-bg-next]');
    var zoomBtn = stage.querySelector('[data-bg-zoom]');
    var playBtn = stage.querySelector('[data-bg-play]');
    var progressEl = stage.querySelector('[data-bg-progress]');
    var lbImg = lb.querySelector('.bg-lb-img');
    var lbCap = lb.querySelector('.bg-lb-caption');
    var lbOpen = lb.querySelector('[data-bg-open]');
    var closeBtns = lb.querySelectorAll('[data-bg-close]');
    var thumbBtns = Array.prototype.slice.call(thumbs.querySelectorAll('.bg-thumb'));
    var lastFocus = null;

    /* ---------- Lecture automatique en boucle ---------- */
    var AUTOPLAY_MS = 5000;
    var playing = !reduceMotion;
    var hovering = false;
    var focusWithin = false;
    var elapsed = 0;
    var startTs = 0;
    var rafId = null;

    function lightboxOpen() { return lb.classList.contains('is-open'); }
    function canPlay() { return playing && inView && !hovering && !focusWithin && !lightboxOpen() && !document.hidden; }

    function tick(now) {
      if (!canPlay()) { rafId = null; return; }
      var e = elapsed + (now - startTs);
      var pct = e / AUTOPLAY_MS;
      if (pct >= 1) { rafId = null; if (progressEl) progressEl.style.width = '100%'; goTo(idx + 1); return; }
      if (progressEl) progressEl.style.width = (pct * 100) + '%';
      rafId = requestAnimationFrame(tick);
    }
    function resumeTimer() { if (rafId) return; startTs = performance.now(); rafId = requestAnimationFrame(tick); }
    function pauseTimer() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (startTs) { elapsed += performance.now() - startTs; startTs = 0; }
    }
    function resetTimer() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      elapsed = 0; startTs = 0;
      if (progressEl) progressEl.style.width = '0%';
    }
    function updatePlayback() { if (canPlay()) { resumeTimer(); } else { pauseTimer(); } }

    function setPlaying(on) {
      playing = on;
      if (playBtn) {
        playBtn.classList.toggle('is-playing', on);
        playBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        playBtn.setAttribute('aria-label', on ? 'Mettre en pause le diaporama' : 'Lire le diaporama');
        playBtn.innerHTML = '<i class="fa-solid ' + (on ? 'fa-pause' : 'fa-play') + '"></i>';
      }
      if (on) { resetTimer(); updatePlayback(); } else { pauseTimer(); }
    }

    function preload(i) {
      var item = items[(i % items.length + items.length) % items.length];
      if (!item) return;
      var im = new Image();
      im.decoding = 'async';
      im.src = item.src || item.thumb;
    }

    function goTo(target, opts) {
      opts = opts || {};
      var count = items.length;
      idx = ((target % count) + count) % count;
      var item = items[idx];

      var pic = stagePic;
      pic.innerHTML = '';
      if (item.avif) { var sa = document.createElement('source'); sa.type = 'image/avif'; sa.srcset = item.avif; pic.appendChild(sa); }
      if (item.src) { var sw = document.createElement('source'); sw.type = 'image/webp'; sw.srcset = item.src; pic.appendChild(sw); }
      var img = document.createElement('img');
      img.className = 'bg-img';
      img.decoding = 'async';
      img.alt = item.alt || item.title || '';
      img.onload = function () { img.classList.add('is-loaded'); };
      img.onerror = function () { if (item.full) { img.src = item.full; } };
      img.src = item.src || item.thumb || item.full;
      pic.appendChild(img);

      capCat.textContent = item.category || (data && data.category) || '';
      capTitle.textContent = item.title || '';
      curEl.textContent = pad(idx + 1);

      thumbBtns.forEach(function (btn, i) {
        var on = i === idx;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      if (opts.scroll !== false && thumbBtns[idx]) {
        thumbBtns[idx].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
      }

      if (lbOpen) { lbOpen.href = item.full || item.src || '#'; }
      if (lb.classList.contains('is-open')) {
        lbImg.src = item.src || item.thumb || '';
        lbImg.alt = item.alt || item.title || '';
        lbCap.textContent = item.title || '';
      }

      preload(idx + 1);
      preload(idx - 1);

      resetTimer();
      if (canPlay()) { resumeTimer(); }
    }

    /* ---------- Navigation ---------- */
    prevBtns.forEach(function (b) { b.addEventListener('click', function () { goTo(idx - 1); }); });
    nextBtns.forEach(function (b) { b.addEventListener('click', function () { goTo(idx + 1); }); });
    thumbBtns.forEach(function (btn) {
      btn.addEventListener('click', function () { goTo(parseInt(btn.dataset.index, 10) || 0); });
    });

    /* ---------- Play / pause ---------- */
    if (playBtn) playBtn.addEventListener('click', function () { setPlaying(!playing); });
    stage.addEventListener('mouseenter', function () { hovering = true; updatePlayback(); });
    stage.addEventListener('mouseleave', function () { hovering = false; updatePlayback(); });
    shell.addEventListener('focusin', function () { focusWithin = true; updatePlayback(); });
    shell.addEventListener('focusout', function () {
      window.setTimeout(function () { focusWithin = shell.contains(document.activeElement); updatePlayback(); }, 0);
    });
    document.addEventListener('visibilitychange', updatePlayback);

    /* ---------- Visionneuse plein écran ---------- */
    function openLightbox() {
      lastFocus = document.activeElement;
      lb.classList.add('is-open');
      lb.setAttribute('aria-hidden', 'false');
      document.body.classList.add('bg-lightbox-open');
      goTo(idx, { scroll: false });
      lb.querySelector('.bg-lb-close').focus();
      updatePlayback();
    }
    function closeLightbox() {
      lb.classList.remove('is-open');
      lb.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('bg-lightbox-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      updatePlayback();
    }
    if (zoomBtn) zoomBtn.addEventListener('click', openLightbox);
    closeBtns.forEach(function (b) { b.addEventListener('click', closeLightbox); });

    /* ---------- Clavier ---------- */
    document.addEventListener('keydown', function (e) {
      var lbOpen = lb.classList.contains('is-open');
      if (!lbOpen && !inView) return;
      var tag = (e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '');
      if (!lbOpen && (tag === 'input' || tag === 'textarea' || tag === 'select')) return;
      if (e.key === 'ArrowLeft') { goTo(idx - 1); if (lbOpen) e.preventDefault(); }
      else if (e.key === 'ArrowRight') { goTo(idx + 1); if (lbOpen) e.preventDefault(); }
      else if (e.key === 'Home') { goTo(0); }
      else if (e.key === 'End') { goTo(items.length - 1); }
      else if (e.key === 'Escape' && lbOpen) { closeLightbox(); }
    });

    /* ---------- Balayage tactile ---------- */
    function addSwipe(el) {
      if (!el) return;
      var x0 = 0, y0 = 0, tracking = false;
      el.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; tracking = true;
      }, { passive: true });
      el.addEventListener('touchend', function (e) {
        if (!tracking) return;
        tracking = false;
        var t = e.changedTouches[0];
        var dx = t.clientX - x0, dy = t.clientY - y0;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { goTo(idx + (dx < 0 ? 1 : -1)); }
      }, { passive: true });
    }
    addSwipe(stage);
    addSwipe(lb);

    /* ---------- Visibilité (clavier seulement si la galerie est à l'écran) ---------- */
    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { inView = en.isIntersecting; });
        updatePlayback();
      }, { threshold: 0.25 });
      obs.observe(shell);
    } else {
      inView = true;
    }

    /* ---------- Filtres (Tout / Pressbook / Audiovisuel) ---------- */
    var filterBtns = document.querySelectorAll('.filter-btn');
    var videoBlock = document.querySelector('[data-video-block]');
    if (filterBtns.length) {
      filterBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var f = btn.getAttribute('data-filter');
          var block = document.querySelector('[data-gallery-block]');
          if (block) block.hidden = (f === 'audiovisuel');
          if (videoBlock) videoBlock.hidden = (f === 'pressbook' || f === 'branding' || f === 'web' || f === 'social' || f === 'design' || f === 'evenementiel' || f === 'digital');
        });
      });
    }

    goTo(0, { scroll: false });
    setPlaying(!reduceMotion);
  });
})();
