/* =========================================================
   BRAIN — Espace Audiovisuel (service-films.html)
   Médiathèque vidéo professionnelle :
   - Lecteur principal 16:9 (YouTube / Vimeo / vidéo uploadée)
   - Playlist latérale (desktop) / horizontale (tablette) / liste (mobile)
   - Filtres par catégorie (sans rechargement)
   - Vidéo à la une sélectionnée par défaut
   - AUTOPLAY = false : l'utilisateur contrôle la lecture
   - Une seule source de lecture active à la fois (lazy loading)
   - Messages d'erreur accessibles + « Voir sur YouTube/Vimeo »
   - Miniature YouTube/Vimeo automatique si disponible
   ========================================================= */
(function () {
  'use strict';

  var SITE_URL = 'https://www.braincobusiness.com';
  var BUCKET = 'audiovisual-videos';

  var CATEGORIES = [
    'Montage vidéo', 'Films publicitaires', 'Films institutionnels',
    'Films d\u2019entreprise', 'Films promotionnels', 'Interviews & documentaires',
    'Reportages', 'Captation événementielle', '\u00c9missions TV',
    'Motion design', 'Post-production', 'Effets spéciaux / VFX'
  ];

  /* Filtres présentés à l'interface, reliés aux catégories possibles */
  var FILTERS = [
    { id: 'toutes',         label: 'Toutes',        match: null },
    { id: 'montage',        label: 'Montage',       match: ['montage', 'post-production'] },
    { id: 'publicite',      label: 'Publicité',     match: ['publicit', 'promotion'] },
    { id: 'institutionnel', label: 'Institutionnel', match: ['institution', 'entreprise'] },
    { id: 'evenement',      label: 'Événement',     match: ['événement', 'event', 'captation', 'reportage', 'émissions'] },
    { id: 'social',         label: 'Social media',  match: ['social', 'réseaux', 'reseaux'] },
    { id: 'motion',         label: 'Motion design', match: ['motion', 'effet', 'vfx'] },
    { id: 'documentaire',   label: 'Documentaire',  match: ['documentaire', 'interview'] }
  ];

  /* ---------- Helpers ---------- */
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escAttr(v) { return esc(v); }
  function $(sel, root) { return (root || document).querySelector(sel); }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function whenSupabase(cb) {
    onReady(function () {
      var tries = 0;
      var timer = window.setInterval(function () {
        tries++;
        if (window.brainSupabase && window.brainSupabase.ready && window.brainSupabase.client) {
          window.clearInterval(timer);
          cb(window.brainSupabase.client);
        } else if (window.brainSupabase && window.brainSupabase.error) {
          window.clearInterval(timer);
          cb(null);
        } else if (tries > 50) {
          window.clearInterval(timer);
          cb(null);
        }
      }, 200);
    });
  }

  /* ---------- Détection de source ----------
     getVideoSource(url) -> { type: 'youtube', id } | { type: 'vimeo', id } | null */
  function getVideoSource(url) {
    var u = String(url || '').trim();
    if (!u) return null;
    try {
      var parsed = new URL(u);
      var host = String(parsed.hostname || '').replace(/^www\./, '').replace(/^m\./, '');

      if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        var v = parsed.searchParams.get('v');
        if (v && /^[\w-]{6,20}$/.test(v)) return { type: 'youtube', id: v };
        if (parsed.pathname.indexOf('/shorts/') === 0) {
          var s = parsed.pathname.split('/')[2];
          if (s && /^[\w-]{6,20}$/.test(s)) return { type: 'youtube', id: s };
        }
        if (parsed.pathname.indexOf('/embed/') === 0) {
          var e = parsed.pathname.split('/')[2];
          if (e && /^[\w-]{6,20}$/.test(e)) return { type: 'youtube', id: e };
        }
      }
      if (host === 'youtu.be') {
        var p = parsed.pathname.replace(/^\//, '').split('/')[0];
        if (p && /^[\w-]{6,20}$/.test(p)) return { type: 'youtube', id: p };
      }
      if (host === 'vimeo.com') {
        var m = parsed.pathname.match(/^\/(\d{6,12})/);
        if (m) return { type: 'vimeo', id: m[1] };
      }
      if (host === 'player.vimeo.com') {
        var mv = parsed.pathname.match(/^\/video\/(\d{6,12})/);
        if (mv) return { type: 'vimeo', id: mv[1] };
      }
    } catch (e) { /* URL invalide */ }
    return null;
  }

  function fmtDuration(sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    if (!sec) return '';
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return m + ':' + String(s).padStart(2, '0');
  }

  function providerWatchUrl(v) {
    var src = getVideoSource(v.external_url || '');
    if (v.source_type === 'youtube' && src && src.type === 'youtube') return 'https://www.youtube.com/watch?v=' + encodeURIComponent(src.id);
    if (v.source_type === 'vimeo' && src && src.type === 'vimeo') return 'https://vimeo.com/' + encodeURIComponent(src.id);
    return '';
  }

  function autoThumb(v) {
    if (v.source_type === 'youtube') {
      var s = getVideoSource(v.external_url || '');
      if (s && s.type === 'youtube') return 'https://i.ytimg.com/vi/' + s.id + '/hqdefault.jpg';
    }
    return '';
  }

  function fetchVimeoThumb(id, cb) {
    window.fetch('https://vimeo.com/api/oembed.json?url=' + encodeURIComponent('https://vimeo.com/' + id))
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.thumbnail_url) cb(d.thumbnail_url); })
      .catch(function () {});
  }

  /* ---------- État ---------- */
  var client = null;
  var all = [];            // toutes les vidéos publiées (triées)
  var filtered = [];       // vidéos affichées après filtre
  var currentFilter = 'toutes';

  var player = {
    video: null,    // enregistrement courant
    kind: null,     // 'youtube' | 'vimeo' | 'upload'
    api: null,      // YT.Player | Vimeo.Player | <video>
    built: false,
    playing: false,
    muted: false,
    volume: 80,
    total: 0
  };

  /* ---------- DOM ---------- */
  var dom = {};
  var tickTimer = null;

  function cacheDom() {
    dom.filters = $('#av-filters');
    dom.playlistBox = $('#av-playlist-list');
    dom.playlistCount = $('#av-playlist-count');
    dom.playlistPrev = $('#av-playlist-prev');
    dom.playlistNext = $('#av-playlist-next');
    dom.poster = $('#av-poster');
    dom.host = $('#av-host');
    dom.loading = $('#av-loading');
    dom.bigPlay = $('#av-big-play');
    dom.error = $('#av-error');
    dom.errorLink = $('#av-error-link');
    dom.playBtn = $('#av-play-btn');
    dom.progressTrack = $('#av-progress-track');
    dom.progressFill = $('#av-progress-fill');
    dom.progressBuffer = $('#av-progress-buffer');
    dom.progressInput = $('#av-progress-input');
    dom.timeCur = $('#av-time-cur');
    dom.timeTotal = $('#av-time-total');
    dom.muteBtn = $('#av-mute-btn');
    dom.volInput = $('#av-vol-input');
    dom.fsBtn = $('#av-fs-btn');
    dom.stage = $('#av-stage');
    dom.metaCat = $('#av-meta-cat');
    dom.metaDur = $('#av-meta-dur');
    dom.metaTitle = $('#av-meta-title');
    dom.metaDesc = $('#av-meta-desc');
    dom.emptyState = $('#av-playlist-empty');
  }

  /* ---------- Lecture : URL publique (bucket public) ---------- */
  function avPublicUrl(path) {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    if (client && client.storage) {
      try {
        return client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl || '';
      } catch (e) { /* ignore */ }
    }
    return '';
  }

  /* ---------- Contrôle d'interface ---------- */
  function showLoading(b) { if (dom.loading) dom.loading.classList.toggle('is-visible', b); }
  function showBigPlay(b) { if (dom.bigPlay) dom.bigPlay.classList.toggle('is-hidden', !b); }
  function showPoster(b) { if (dom.poster) dom.poster.classList.toggle('is-hidden', !b); }
  function showErrorOn(on, link) {
    if (!dom.error) return;
    if (on) {
      dom.error.classList.add('is-visible');
      if (dom.errorLink) {
        if (link) { dom.errorLink.href = link; dom.errorLink.style.display = ''; }
        else { dom.errorLink.style.display = 'none'; }
      }
    } else {
      dom.error.classList.remove('is-visible');
    }
  }

  function fmtTime(cur, total) {
    if (dom.timeCur) dom.timeCur.textContent = fmtDuration(cur);
    if (dom.timeTotal) dom.timeTotal.textContent = fmtDuration(total || 0);
    var pct = total > 0 ? Math.min((cur / total) * 100, 100) : 0;
    if (dom.progressFill) dom.progressFill.style.width = pct + '%';
    if (dom.progressInput) {
      dom.progressInput.disabled = !player.built;
      dom.progressInput.value = pct;
      dom.progressInput.setAttribute('aria-valuetext',
        'Position ' + fmtDuration(cur) + ' sur ' + fmtDuration(total || 0));
    }
  }
  function fmtBuffer(pct) { if (dom.progressBuffer) dom.progressBuffer.style.width = pct + '%'; }

  function setPlayingUI(b) {
    player.playing = b;
    if (dom.playBtn) {
      var ic = dom.playBtn.querySelector('i');
      if (ic) ic.className = 'fa-solid ' + (b ? 'fa-pause' : 'fa-play');
      dom.playBtn.setAttribute('aria-label', b ? 'Mettre en pause' : 'Lire la vidéo');
    }
    showBigPlay(!b);
    if (b) showPoster(false);
    if (dom.stage) dom.stage.setAttribute('aria-busy', 'false');
  }

  function setVolUI() {
    var lvl = player.muted ? 0 : player.volume;
    if (dom.volInput) {
      dom.volInput.value = lvl;
      dom.volInput.setAttribute('aria-valuetext', 'Volume ' + lvl + ' pour cent');
    }
    if (dom.muteBtn) {
      var ic = dom.muteBtn.querySelector('i');
      if (ic) ic.className = lvl === 0 ? 'fa-solid fa-volume-xmark' : (lvl < 50 ? 'fa-solid fa-volume-low' : 'fa-solid fa-volume-high');
      dom.muteBtn.setAttribute('aria-label', player.muted ? 'Activer le son' : 'Couper le son');
    }
  }

  function applyVol() {
    if (!player.api || !player.built) { setVolUI(); return; }
    var v = player.muted ? 0 : player.volume;
    if (player.kind === 'youtube') {
      player.api.setVolume(v);
      if (v === 0) player.api.mute(); else player.api.unMute();
    } else if (player.kind === 'vimeo') {
      player.api.setVolume(player.muted ? 0 : player.volume);
    } else if (player.kind === 'upload') {
      player.api.volume = (player.volume / 100);
      player.api.muted = player.muted;
    }
    setVolUI();
  }

  function startTick() {
    stopTick();
    tickTimer = window.setInterval(function () {
      if (player.kind === 'youtube' && player.api && player.built) {
        try {
          var d = player.api.getDuration();
          if (d && d !== player.total) player.total = d;
          fmtTime(player.api.getCurrentTime(), player.total);
        } catch (e) { /* lecture non active */ }
      }
    }, 500);
  }
  function stopTick() { if (tickTimer) { window.clearInterval(tickTimer); tickTimer = null; } }

  function destroyEngine() {
    stopTick();
    if (player.api) {
      try {
        if (player.kind === 'youtube') player.api.destroy();
        else if (player.kind === 'vimeo') player.api.destroy();
        else if (player.kind === 'upload') {
          player.api.pause();
          player.api.removeAttribute('src');
          if (player.api.load) player.api.load();
        }
      } catch (e) { /* ignore */ }
    }
    if (dom.host) dom.host.innerHTML = '';
    player.api = null;
    player.kind = null;
    player.built = false;
    player.playing = false;
    player.total = 0;
    fmtTime(0, 0);
    fmtBuffer(0);
    setPlayingUI(false);
  }

  /* ---------- Construction des lecteurs ---------- */
  var YT_READY = false;
  var YT_PROMISE = null;
  function loadYT() {
    if (YT_READY) return Promise.resolve();
    if (YT_PROMISE) return YT_PROMISE;
    YT_PROMISE = new Promise(function (resolve, reject) {
      if (window.YT && window.YT.Player) { YT_READY = true; resolve(); return; }
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        YT_READY = true;
        if (typeof prev === 'function') prev();
        resolve();
      };
      var s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return YT_PROMISE;
  }

  var VIMEO_PROMISE = null;
  function loadVimeo() {
    if (window.Vimeo && window.Vimeo.Player) return Promise.resolve();
    if (VIMEO_PROMISE) return VIMEO_PROMISE;
    VIMEO_PROMISE = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://player.vimeo.com/api/player.js';
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return VIMEO_PROMISE;
  }

  function buildUpload(v) {
    var video = document.createElement('video');
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = avPublicUrl(v.storage_path);
    video.setAttribute('aria-label', escAttr(v.title || 'Vidéo BRAIN'));
    player.kind = 'upload';
    player.api = video;
    player.built = true;
    if (dom.host) dom.host.appendChild(video);

    video.addEventListener('loadedmetadata', function () {
      if (player.video !== v) return;
      player.total = isNaN(video.duration) ? 0 : video.duration;
      showLoading(false);
      applyVol();
      fmtTime(video.currentTime || 0, player.total);
    });
    video.addEventListener('durationchange', function () {
      player.total = isNaN(video.duration) ? 0 : video.duration;
      fmtTime(video.currentTime || 0, player.total);
    });
    video.addEventListener('timeupdate', function () {
      fmtTime(video.currentTime || 0, player.total || video.duration || 0);
    });
    video.addEventListener('progress', function () {
      fmtBuffer(bufferedPct(video));
    });
    video.addEventListener('play', function () { if (player.video === v) setPlayingUI(true); });
    video.addEventListener('pause', function () { if (player.video === v) setPlayingUI(false); });
    video.addEventListener('ended', function () {
      setPlayingUI(false);
      fmtTime(0, player.total || video.duration || 0);
    });
    video.addEventListener('error', function () {
      showLoading(false);
      showErrorOn(true, providerWatchUrl(v));
    });

    applyVol();
    var p = video.play();
    if (p && p.catch) p.catch(function () { setPlayingUI(false); showBigPlay(true); });
  }

  function buildYoutube(v, id) {
    loadYT().then(function () {
      if (!player.video || player.video.id !== v.id) return;
      var opts = {
        videoId: id,
        width: '100%',
        height: '100%',
        playerVars: {
          rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3,
          controls: 0, fs: 0, disablekb: 1, origin: window.location.origin
        },
        events: {
          onReady: function () {
            if (!player.video || player.video.id !== v.id) return;
            player.kind = 'youtube';
            player.built = true;
            showLoading(false);
            applyVol();
            var d = 0;
            try { d = player.api.getDuration(); } catch (e) {}
            if (d) player.total = d;
            fmtTime(0, player.total);
            player.api.playVideo();
          },
          onStateChange: function (e) {
            if (!player.video || player.video.id !== v.id) return;
            if (e.data === 1) {
              setPlayingUI(true);
              try { var d2 = player.api.getDuration(); if (d2) player.total = d2; } catch (err) {}
              startTick();
            } else if (e.data === 2) {
              setPlayingUI(false);
              stopTick();
            } else if (e.data === 0) {
              setPlayingUI(false);
              stopTick();
              fmtTime(0, player.total || 0);
            } else if (e.data === -1) {
              fmtTime(0, player.total || 0);
            }
          },
          onError: function () {
            stopTick();
            showLoading(false);
            showErrorOn(true, providerWatchUrl(v));
          }
        }
      };
      player.api = new YT.Player(dom.host, opts);
    }).catch(function () {
      if (player.video && player.video.id === v.id) {
        showLoading(false);
        showErrorOn(true, providerWatchUrl(v));
      }
    });
  }

  function buildVimeo(v, id) {
    loadVimeo().then(function () {
      if (!player.video || player.video.id !== v.id) return;
      player.api = new Vimeo.Player(dom.host, {
        id: id,
        responsive: true,
        controls: false,
        title: false,
        byline: false,
        portrait: false
      });
      player.kind = 'vimeo';
      player.built = true;
      player.api.on('play', function () { if (player.video && player.video.id === v.id) setPlayingUI(true); });
      player.api.on('pause', function () { if (player.video && player.video.id === v.id) setPlayingUI(false); });
      player.api.on('ended', function () { if (player.video && player.video.id === v.id) { setPlayingUI(false); fmtTime(0, player.total); } });
      player.api.on('loadeddata', function () { if (player.video && player.video.id === v.id) showLoading(false); });
      player.api.on('durationchange', function (d) {
        if (!player.video || player.video.id !== v.id) return;
        if (d && d.duration) player.total = d.duration;
      });
      player.api.on('timeupdate', function (d) {
        if (!player.video || player.video.id !== v.id) return;
        if (d && d.duration && d.duration !== player.total) player.total = d.duration;
        fmtTime(d && d.seconds != null ? d.seconds : 0, player.total);
      });
      player.api.on('error', function () {
        if (!player.video || player.video.id !== v.id) return;
        showLoading(false);
        showErrorOn(true, providerWatchUrl(v));
      });
      applyVol();
      player.api.play().catch(function () { showBigPlay(true); });
    }).catch(function () {
      if (player.video && player.video.id === v.id) {
        showLoading(false);
        showErrorOn(true, providerWatchUrl(v));
      }
    });
  }

  function buildAndPlay(v) {
    destroyEngine();
    player.video = v;
    showErrorOn(false);
    showLoading(true);
    showBigPlay(false);
    showPoster(true);

    var src = getVideoSource(v.external_url || '');
    if (v.source_type === 'upload' && v.storage_path) {
      buildUpload(v);
      return;
    }
    if (v.source_type === 'youtube' && src && src.type === 'youtube') {
      buildYoutube(v, src.id);
      return;
    }
    if (v.source_type === 'vimeo' && src && src.type === 'vimeo') {
      buildVimeo(v, src.id);
      return;
    }
    showLoading(false);
    showBigPlay(true);
    showErrorOn(true, providerWatchUrl(v));
  }

  /* ---------- Actions ---------- */
  function togglePlay() {
    if (!player.video) return;
    if (!player.built || !player.api) { buildAndPlay(player.video); return; }
    if (player.playing) pausePlayer(); else playPlayer();
  }
  function playPlayer() {
    if (!player.api || !player.built) { buildAndPlay(player.video); return; }
    try {
      if (player.kind === 'youtube') player.api.playVideo();
      else if (player.kind === 'vimeo') {
        var p = player.api.play();
        if (p && p.catch) p.catch(function () {});
      } else player.api.play();
    } catch (e) { buildAndPlay(player.video); }
  }
  function pausePlayer() {
    if (!player.api) return;
    try {
      if (player.kind === 'youtube') player.api.pauseVideo();
      else if (player.kind === 'vimeo') player.api.pause();
      else player.api.pause();
    } catch (e) { /* ignore */ }
  }
  function toggleMute() {
    player.muted = !player.muted;
    applyVol();
  }
  function setVolume(v) {
    player.volume = Math.max(0, Math.min(100, Math.round(v)));
    if (player.volume > 0) player.muted = false;
    applyVol();
  }
  function seek(pct) {
    if (!player.api || !player.built) return;
    pct = Math.max(0, Math.min(100, pct));
    var t = player.total * pct / 100;
    try {
      if (player.kind === 'youtube') player.api.seekTo(t, true);
      else if (player.kind === 'vimeo') player.api.setCurrentTime(t);
      else { player.api.currentTime = t; }
    } catch (e) { /* ignore */ }
    fmtTime(t, player.total);
  }
  function seekBy(delta) { seek(((player.total ? (player.api && player.kind === 'upload' ? player.api.currentTime : 0) : 0) + delta) / (player.total || 1) * 100); }
  function toggleFullscreen() {
    var stage = document.fullscreenElement ? null : dom.stage;
    try {
      if (!document.fullscreenElement) {
        var fn = dom.stage.requestFullscreen || dom.stage.webkitRequestFullscreen;
        if (fn) fn.call(dom.stage);
      } else {
        var ex = document.exitFullscreen || document.webkitExitFullscreen;
        if (ex) ex.call(document);
      }
    } catch (e) { /* ignore */ }
  }
  function bufferedPct(video) {
    if (video.buffered && video.buffered.length) {
      var end = video.buffered.end(video.buffered.length - 1);
      var d = video.duration || 0;
      return d ? Math.min((end / d) * 100, 100) : 0;
    }
    return 0;
  }

  /* ---------- Métadonnées + miniature ---------- */
  function posterFallback(v) {
    return '<div class="av-poster-fallback av-thumb-fallback av-thumb-fallback-poster">' +
      '<i class="fa-solid fa-clapperboard" aria-hidden="true"></i>' +
      '<b>BRAIN</b><span>Réalisation audiovisuelle</span></div>';
  }
  function setupPoster(v) {
    var thumb = v.thumbnail_url || autoThumb(v);
    if (dom.poster) {
      dom.poster.innerHTML = thumb
        ? '<img src="' + escAttr(thumb) + '" alt="Miniature : ' + escAttr(v.title) + '" loading="lazy">'
        : posterFallback(v);
      dom.poster.classList.remove('is-hidden');
    }
  }
  function updateMeta(v) {
    if (dom.metaTitle) dom.metaTitle.textContent = v.title;
    if (dom.metaDesc) {
      dom.metaDesc.textContent = v.description || 'Une réalisation signée BRAIN.';
      dom.metaDesc.setAttribute('aria-hidden', v.description ? 'false' : 'true');
    }
    if (dom.metaCat) dom.metaCat.innerHTML = '<i class="fa-solid fa-tag" aria-hidden="true"></i> ' + esc(v.category || 'Audiovisuel');
    if (dom.metaDur) {
      var d = fmtDuration(v.duration);
      dom.metaDur.innerHTML = '<i class="fa-solid fa-clock" aria-hidden="true"></i> ' + esc(d);
      dom.metaDur.style.display = d ? '' : 'none';
    }
  }

  /* ---------- SEO ---------- */
  function injectVideoSeo(v) {
    var old = document.getElementById('av-seo-schema');
    if (old) old.remove();
    if (!v || !v.id) return;
    var src = getVideoSource(v.external_url || '');
    var schema = {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      'name': v.title,
      'description': v.description || '',
      'uploadDate': v.created_at ? new Date(v.created_at).toISOString() : undefined,
      'publisher': { '@type': 'Organization', 'name': 'BRAIN' }
    };
    var thumb = v.thumbnail_url || autoThumb(v);
    if (thumb) schema.thumbnailUrl = [thumb];
    if (v.duration) schema.duration = 'PT' + Math.round(v.duration) + 'S';
    if (v.source_type === 'upload' && v.storage_path) schema.contentUrl = avPublicUrl(v.storage_path);
    if (v.source_type === 'youtube' && src && src.type === 'youtube') {
      schema.embedUrl = 'https://www.youtube.com/embed/' + src.id;
      schema.contentUrl = 'https://www.youtube.com/watch?v=' + src.id;
    }
    if (v.source_type === 'vimeo' && src && src.type === 'vimeo') {
      schema.embedUrl = 'https://player.vimeo.com/video/' + src.id;
      schema.contentUrl = 'https://vimeo.com/' + src.id;
    }
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = 'av-seo-schema';
    s.textContent = JSON.stringify(schema);
    document.head.appendChild(s);
  }

  /* ---------- Playlist ---------- */
  function sortList(list) {
    return list.slice().sort(function (a, b) {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      if ((a.display_order || 0) !== (b.display_order || 0)) return (a.display_order || 0) - (b.display_order || 0);
      return new Date(a.created_at) - new Date(b.created_at);
    });
  }

  function itemMatches(v, f) {
    if (!f.match) return true;
    var cat = String(v.category || '').toLowerCase();
    return f.match.some(function (term) { return cat.indexOf(term) !== -1; });
  }

  function applyFilter() {
    var f = null;
    for (var i = 0; i < FILTERS.length; i++) if (FILTERS[i].id === currentFilter) f = FILTERS[i];
    filtered = f && f.match ? all.filter(function (v) { return itemMatches(v, f); }) : all.slice();
    renderPlaylist();
    renderActiveFilter();
  }

  function renderActiveFilter() {
    if (!dom.filters) return;
    var btns = dom.filters.querySelectorAll('[data-av-filter]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('is-active', btns[i].getAttribute('data-av-filter') === currentFilter);
      btns[i].setAttribute('aria-pressed', btns[i].getAttribute('data-av-filter') === currentFilter ? 'true' : 'false');
    }
  }

  function renderFilters() {
    if (!dom.filters) return;
    dom.filters.innerHTML = '';
    FILTERS.forEach(function (f) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'av-filter-btn';
      b.setAttribute('data-av-filter', f.id);
      b.setAttribute('aria-pressed', f.id === currentFilter ? 'true' : 'false');
      b.textContent = f.label;
      b.addEventListener('click', function () {
        currentFilter = f.id;
        applyFilter();
      });
      dom.filters.appendChild(b);
    });
  }

  function renderPlaylist() {
    if (!dom.playlistBox || !dom.playlistCount) return;
    dom.playlistCount.textContent = filtered.length + ' vid\xe9o' + (filtered.length > 1 ? 's' : '');
    dom.playlistBox.innerHTML = '';

    if (!filtered.length) {
      if (dom.emptyState) dom.emptyState.style.display = '';
      else {
        var e = document.createElement('div');
        e.className = 'av-playlist-empty';
        e.innerHTML = '<i class="fa-solid fa-film" aria-hidden="true"></i>Aucune vid\xe9o dans cette cat\xe9gorie.';
        dom.playlistBox.appendChild(e);
      }
      return;
    }
    if (dom.emptyState) dom.emptyState.style.display = 'none';

    filtered.forEach(function (v) {
      dom.playlistBox.appendChild(playlistItem(v));
    });
  }

  function playlistItem(v) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'av-pl-item';
    b.setAttribute('data-av-id', v.id);
    b.setAttribute('aria-label', 'Lire la vid\xe9o : ' + escAttr(v.title));
    b.setAttribute('aria-current', player.video && player.video.id === v.id ? 'true' : 'false');

    var thumb = v.thumbnail_url || autoThumb(v);
    var thumbHtml = thumb
      ? '<img src="' + escAttr(thumb) + '" alt="Miniature : ' + escAttr(v.title) + '" loading="lazy">'
      : '<div class="av-thumb-fallback av-thumb-fallback-sm" aria-hidden="true"><i class="fa-solid fa-clapperboard"></i></div>';
    var dur = fmtDuration(v.duration);

    b.innerHTML =
      '<span class="av-pl-thumb">' + thumbHtml +
        '<span class="av-pl-play" aria-hidden="true"><i class="fa-solid fa-play"></i></span>' +
        (dur ? '<span class="av-pl-badge">' + esc(dur) + '</span>' : '') +
      '</span>' +
      '<span class="av-pl-body">' +
        '<span class="av-pl-title">' + esc(v.title) + '</span>' +
        (v.category ? '<span class="av-pl-cat">' + esc(v.category) + '</span>' : '') +
        '<span class="av-pl-dur"><i class="fa-solid fa-clapperboard" aria-hidden="true"></i> ' + esc(v.source_type === 'upload' ? 'Vid\xe9o BRAIN' : (v.source_type === 'youtube' ? 'YouTube' : 'Vimeo')) + '</span>' +
      '</span>';

    b.addEventListener('click', function () { selectVideo(v); });
    return b;
  }

  function updatePlaylistActive(id) {
    if (!dom.playlistBox) return;
    var items = dom.playlistBox.querySelectorAll('.av-pl-item');
    for (var i = 0; i < items.length; i++) {
      var on = items[i].getAttribute('data-av-id') === id;
      items[i].classList.toggle('is-active', on);
      items[i].setAttribute('aria-current', on ? 'true' : 'false');
    }
  }

  /* ---------- Sélection ---------- */
  function selectVideo(v) {
    var sameBuilt = player.video && player.video.id === v.id && player.built;
    player.video = v;
    if (!sameBuilt) {
      destroyEngine();
      showLoading(false);
      showBigPlay(true);
      showErrorOn(false);
      setupPoster(v);
    }
    updateMeta(v);
    updatePlaylistActive(v.id);
    injectVideoSeo(v);
  }

  /* ---------- Voisin précédent / suivant ---------- */
  function neighbor(dir) {
    if (!filtered.length || !player.video) return null;
    var idx = -1;
    for (var i = 0; i < filtered.length; i++) if (filtered[i].id === player.video.id) { idx = i; break; }
    if (idx === -1) return filtered[0];
    return filtered[(idx + dir + filtered.length) % filtered.length];
  }
  function goPrev() {
    var n = neighbor(-1);
    if (n) selectVideo(n);
  }
  function goNext() {
    var n = neighbor(1);
    if (n) selectVideo(n);
  }

  /* ---------- Miniatures Vimeo manquantes (chargement différé) ---------- */
  function prefetchMissingThumbs(list) {
    list.forEach(function (v) {
      if (v.thumbnail_url || v.source_type !== 'vimeo') return;
      var s = getVideoSource(v.external_url || '');
      if (!s || s.type !== 'vimeo') return;
      fetchVimeoThumb(s.id, function (url) {
        var img = dom.playlistBox && dom.playlistBox.querySelector('[data-av-id="' + v.id + '"] .av-pl-thumb img');
        if (img) img.src = url;
        if (player.video && player.video.id === v.id) {
          v.thumbnail_url = url;
          setupPoster(v);
        }
      });
    });
  }

  /* ---------- Chargement ---------- */
  function showGlobalEmpty(msg) {
    if (dom.playlistBox) dom.playlistBox.innerHTML = '';
    if (dom.playlistCount) dom.playlistCount.textContent = '0 vid\xe9o';
    if (dom.metaTitle) dom.metaTitle.textContent = 'Aucune r\xe9alisation publi\xe9e pour le moment';
    if (dom.metaDesc) dom.metaDesc.textContent = msg || 'Revenez bient\xf4t : nos r\xe9alisations audiovisuelles arrivent.';
    var e = document.createElement('div');
    e.className = 'av-playlist-empty';
    e.innerHTML = '<i class="fa-solid fa-film" aria-hidden="true"></i>' + esc(msg || 'Aucune vid\xe9o disponible pour le moment.');
    if (dom.playlistBox) dom.playlistBox.appendChild(e);
  }

  function loadVideos() {
    if (!client) { showGlobalEmpty(); return; }
    client.from('audiovisual_videos').select('*').eq('published', true)
      .then(function (res) {
        if (res.error) throw res.error;
        all = sortList(res.data || []);
        renderFilters();
        applyFilter();
        if (!all.length) { showGlobalEmpty(); return; }
        var featured = null;
        for (var i = 0; i < all.length; i++) if (all[i].featured) { featured = all[i]; break; }
        var first = featured || all[0];
        if (first) selectVideo(first);
        prefetchMissingThumbs(all);
      })
      .catch(function () {
        showGlobalEmpty('Impossible de charger les vid\xe9os. R\xe9essayez dans un instant.');
      });
  }

  /* ---------- Raccourcis clavier ---------- */
  function bindKeyboard() {
    var shell = document.querySelector('[data-av-player]');
    if (!shell) return;
    shell.addEventListener('keydown', function (e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); seekBy(5); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); seekBy(-5); }
      else if (e.key === 'm' || e.key === 'M') { toggleMute(); }
      else if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); }
    });
  }

  /* ---------- Événements UI ---------- */
  function bindEvents() {
    if (dom.bigPlay) dom.bigPlay.addEventListener('click', function () { togglePlay(); dom.stage && dom.stage.focus(); });
    if (dom.playBtn) dom.playBtn.addEventListener('click', togglePlay);
    if (dom.muteBtn) dom.muteBtn.addEventListener('click', toggleMute);
    if (dom.volInput) dom.volInput.addEventListener('input', function () { setVolume(parseInt(this.value, 10) || 0); });
    if (dom.progressInput) {
      dom.progressInput.addEventListener('input', function () { if (player.built) seek(parseInt(this.value, 10) || 0); });
      dom.progressInput.disabled = true;
    }
    if (dom.fsBtn) dom.fsBtn.addEventListener('click', toggleFullscreen);
    if (dom.playlistPrev) dom.playlistPrev.addEventListener('click', goPrev);
    if (dom.playlistNext) dom.playlistNext.addEventListener('click', goNext);
    document.addEventListener('fullscreenchange', function () {
      if (!dom.fsBtn) return;
      var on = !!document.fullscreenElement;
      var ic = dom.fsBtn.querySelector('i');
      if (ic) ic.className = on ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
      dom.fsBtn.setAttribute('aria-label', on ? 'Quitter le plein \xe9cran' : 'Plein \xe9cran');
    });
  }

  /* ---------- Boot ---------- */
  whenSupabase(function (sb) {
    client = sb;
    cacheDom();
    if (!dom.filters || !dom.playlistBox || !dom.host) return;
    // Chargement différé : on n'instancie le lecteur que lorsque le conteneur approche de la vue
    var run = function () { bindEvents(); bindKeyboard(); loadVideos(); };
    if ('IntersectionObserver' in window) {
      var target = document.querySelector('.av-layout') || document.body;
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { obs.disconnect(); run(); } });
      }, { rootMargin: '600px' });
      obs.observe(target);
    } else {
      run();
    }
  });
})();