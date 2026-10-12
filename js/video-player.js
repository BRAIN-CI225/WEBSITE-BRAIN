/* =========================================================
   BRAIN — Portfolio : lecteur vidéo Wistia avec playlist
   Catalogue : window.BRAIN_WISTIA_VIDEOS (js/wistia-videos.js)
   Fonctions : lecteur principal (officiel Wistia), playlist
   interactive, précédent/suivant, fin de vidéo -> suivante,
   état de chargement, message d'erreur, pause hors écran.
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

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtDuration(sec) {
    if (!sec || sec <= 0) return '-:--';
    var m = Math.floor(sec / 60);
    var s = Math.round(sec % 60);
    if (s === 60) { m += 1; s = 0; }
    return m + ':' + pad(s);
  }

  onReady(function () {
    var root = document.querySelector('[data-video-player]');
    if (!root) return;

    var data = window.BRAIN_WISTIA_VIDEOS;
    var items = data && Array.isArray(data.items) ? data.items : [];
    if (!items.length) { root.style.display = 'none'; return; }

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var prefersAutoplay = !reduceMotion;

    var idx = 0;
    var currentPlayer = null;
    var currentPlaying = false;
    var readyFired = false;
    var loadTimer = null;
    var apiPromise = null;

    var WISTIA_API_SRC = 'https://fast.wistia.net/assets/external/E-v1.js';
    var EMBED_ORIGIN = 'https://fast.wistia.net/embed/iframe/';
    var EMBED_PARAMS = 'seo=true&videoFoam=true&downloadButtonHidden=true&controlsVisibleOnLoad=true&autoPlay=';

    /* ---------- Structure ---------- */
    root.innerHTML =
      '<div class="vp-main">' +
        '<div class="vp-stage"><div class="vp-frame">' +
          '<div class="vp-loading"><i class="fa-solid fa-circle-notch fa-spin"></i><span>Chargement de la vid&eacute;o…</span></div>' +
          '<div class="vp-error"><i class="fa-solid fa-circle-exclamation"></i>' +
            '<h3>Vid&eacute;o indisponible</h3>' +
            '<p data-vp-error-msg></p>' +
            '<button class="vp-retry btn btn-outline btn-sm" type="button" data-vp-retry>R&eacute;essayer</button>' +
          '</div>' +
        '</div></div>' +
        '<div class="vp-meta">' +
          '<div class="vp-title-wrap"><span class="vp-count" data-vp-count>01 / ' + items.length + '</span>' +
          '<h3 class="vp-title" data-vp-title aria-live="polite"></h3></div>' +
          '<div class="vp-controls">' +
            '<button class="vp-nav" type="button" data-vp-prev aria-label="Vid&eacute;o pr&eacute;c&eacute;dente"><i class="fa-solid fa-backward-step"></i></button>' +
            '<button class="vp-nav" type="button" data-vp-next aria-label="Vid&eacute;o suivante"><i class="fa-solid fa-forward-step"></i></button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="vp-playlist" role="region" aria-label="Playlist vid&eacute;os">' +
        '<div class="vp-playlist-head"><h3><i class="fa-solid fa-list-ul"></i>Playlist</h3>' +
        '<span class="vp-playlist-count">' + items.length + ' vid&eacute;os</span></div>' +
        '<ul class="vp-list"></ul>' +
      '</div>';

    var frame = root.querySelector('.vp-frame');
    var loading = root.querySelector('.vp-loading');
    var error = root.querySelector('.vp-error');
    var errorMsg = root.querySelector('[data-vp-error-msg]');
    var retryBtn = root.querySelector('[data-vp-retry]');
    var countEl = root.querySelector('[data-vp-count]');
    var titleEl = root.querySelector('[data-vp-title]');
    var prevBtn = root.querySelector('[data-vp-prev]');
    var nextBtn = root.querySelector('[data-vp-next]');
    var list = root.querySelector('.vp-list');

    /* ---------- Playlist ---------- */
    items.forEach(function (item, i) {
      var thumbStyle = item.thumb ? ' style="background-image:url(&quot;' + esc(item.thumb) + '&quot;)"' : '';
      var li = document.createElement('li');
      li.innerHTML =
        '<button class="vp-item" type="button" data-index="' + i + '" aria-label="Lire : ' +
          esc(item.available && item.title ? item.title : ('Vid&eacute;o ' + pad(i + 1))) + '">' +
          '<span class="vp-thumb' + (item.thumb ? '' : ' vp-thumb-empty') + '"' + thumbStyle + '>' +
            '<span class="vp-badge"><i class="fa-solid fa-play"></i></span>' +
            '<span class="vp-dur">' + fmtDuration(item.duration) + '</span>' +
          '</span>' +
          '<span class="vp-info">' +
            '<span class="vp-name">' + esc(item.available && item.title ? item.title : ('Vid&eacute;o ' + pad(i + 1))) + '</span>' +
            '<span class="vp-sub"><span class="vp-seq">N&deg; ' + pad(i + 1) + '</span>' +
            '<span class="vp-live"><span class="vp-eq" aria-hidden="true"><span></span><span></span><span></span></span> En lecture</span></span>' +
          '</span>' +
        '</button>';
      list.appendChild(li);
    });

    var itemBtns = Array.prototype.slice.call(list.querySelectorAll('.vp-item'));

    /* ---------- API Wistia ---------- */
    function ensureApi() {
      if (window._wq) return Promise.resolve();
      if (apiPromise) return apiPromise;
      apiPromise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = WISTIA_API_SRC;
        s.async = true;
        s.onload = function () { window._wq = window._wq || []; resolve(); };
        s.onerror = function () { reject(new Error('API Wistia introuvable')); };
        document.head.appendChild(s);
      });
      return apiPromise;
    }

    /* ---------- États ---------- */
    function showLoading() { readyFired = false; loading.style.display = 'flex'; error.classList.remove('is-visible'); }
    function hideLoading() { readyFired = true; loading.style.display = 'none'; }
    function showError(message, canRetry) {
      readyFired = false;
      if (loadTimer) { clearTimeout(loadTimer); loadTimer = null; }
      errorMsg.textContent = message;
      retryBtn.style.display = canRetry ? '' : 'none';
      loading.style.display = 'none';
      error.classList.add('is-visible');
    }

    function setMeta(item) {
      var label = (item && item.available && item.title) ? item.title : 'Vidéo ' + pad(idx + 1);
      countEl.textContent = pad(idx + 1) + ' / ' + items.length;
      titleEl.textContent = label;
    }

    function setListState() {
      itemBtns.forEach(function (btn, i) {
        var on = i === idx;
        btn.classList.toggle('is-active', on);
        btn.classList.toggle('is-current', on && currentPlaying);
        if (on) btn.setAttribute('aria-current', 'true'); else btn.removeAttribute('aria-current');
      });
    }

    function setPlayingClass(playing) {
      currentPlaying = !!playing;
      setListState();
    }

    /* ---------- Montage du lecteur ---------- */
    function mountWistia(item, autoplay) {
      if (currentPlayer) {
        try { currentPlayer.remove(); } catch (e) {}
        currentPlayer = null;
      }
      currentPlaying = false;

      frame.innerHTML = '';
      var iframe = document.createElement('iframe');
      iframe.className = 'wistia_embed';
      iframe.id = 'vp-wistia-embed';
      iframe.src = EMBED_ORIGIN + encodeURIComponent(item.id) + '?' +
        EMBED_PARAMS + (autoplay ? '1' : '0');
      iframe.title = (item.available && item.title) ? item.title : ('Vidéo BRAIN ' + pad(idx + 1));
      iframe.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('scrolling', 'no');
      iframe.setAttribute('name', 'wistia_embed');
      iframe.allowtransparency = true;

      iframe.addEventListener('load', function () {
        if (!readyFired) hideLoading();
      });
      frame.appendChild(iframe);
      frame.appendChild(loading);
      frame.appendChild(error);

      showLoading();
      if (loadTimer) { clearTimeout(loadTimer); loadTimer = null; }
      loadTimer = setTimeout(function () {
        if (!readyFired) showError('Le chargement de la vidéo a échoué. Réessayez dans un instant.', true);
      }, 9000);

      ensureApi().then(function () {
        window._wq.push({
          id: item.id,
          onReady: function (video) {
            currentPlayer = video;
            readyFired = true;
            if (loadTimer) { clearTimeout(loadTimer); loadTimer = null; }
            hideLoading();
            if (video && video.bind) {
              try {
                video.bind('play', function () { setPlayingClass(true); });
                video.bind('pause', function () { setPlayingClass(false); });
                video.bind('end', function () {
                  setPlayingClass(false);
                  if (items.length > 1) goTo(idx + 1, { autoplay: true });
                });
              } catch (e) {}
            }
          }
        });
      }).catch(function () {
        showError('Impossible de contacter le lecteur Wistia. Vérifiez votre connexion.', true);
      });
    }

    function goTo(target, opts) {
      opts = opts || {};
      var count = items.length;
      idx = ((target % count) + count) % count;
      var item = items[idx];
      setListState();
      setMeta(item);

      if (item && item.available && item.id) {
        mountWistia(item, opts.autoplay === true && prefersAutoplay);
      } else {
        if (currentPlayer) { try { currentPlayer.remove(); } catch (e) {} currentPlayer = null; }
        if (loadTimer) { clearTimeout(loadTimer); loadTimer = null; }
        frame.innerHTML = '';
        frame.appendChild(loading);
        frame.appendChild(error);
        loading.style.display = 'none';
        errorMsg.textContent = (item && item.available)
          ? 'Un problème est survenu avec cette vidéo.'
          : 'Cette vidéo n\'est pas accessible publiquement depuis ce lecteur.';
        retryBtn.style.display = 'none';
        error.classList.add('is-visible');
      }
    }

    /* ---------- Événements ---------- */
    prevBtn.addEventListener('click', function () { goTo(idx - 1, { autoplay: true }); });
    nextBtn.addEventListener('click', function () { goTo(idx + 1, { autoplay: true }); });
    retryBtn.addEventListener('click', function () { goTo(idx, { autoplay: false }); });
    itemBtns.forEach(function (btn) {
      btn.addEventListener('click', function () { goTo(parseInt(btn.dataset.index, 10) || 0, { autoplay: true }); });
    });

    function handleFocus(direction) {
      var pos = itemBtns.indexOf(document.activeElement);
      if (pos === -1) return;
      var next = (pos + direction + items.length) % items.length;
      itemBtns[next].focus();
    }
    list.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp') { handleFocus(-1); e.preventDefault(); }
      else if (e.key === 'ArrowDown') { handleFocus(1); e.preventDefault(); }
    });

    /* ---------- Pause quand la section est masquée ---------- */
    var block = document.querySelector('[data-video-block]');
    if (block && 'MutationObserver' in window) {
      var obs = new MutationObserver(function () {
        if (block.hasAttribute('hidden') && currentPlayer && typeof currentPlayer.pause === 'function') {
          try { currentPlayer.pause(); } catch (e) {}
        }
      });
      obs.observe(block, { attributes: true, attributeFilter: ['hidden'] });
    }

    /* ---------- Démarrage ---------- */
    goTo(0, { autoplay: false });
  });
})();