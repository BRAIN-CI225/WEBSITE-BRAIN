/* =========================================================
   BRAIN — main.js
   Interactions, animations, navigation, formulaires
   ========================================================= */

document.addEventListener('DOMContentLoaded', function () {

  /* ---------- HEADER SCROLL ---------- */
  const header = document.getElementById('site-header');
  function handleHeaderScroll(){
    if(!header) return;
    if(window.scrollY > 40){ header.classList.add('scrolled'); }
    else{ header.classList.remove('scrolled'); }
  }
  handleHeaderScroll();
  window.addEventListener('scroll', handleHeaderScroll);

  /* ---------- HOMEPAGE HERO SLIDER ---------- */
  const heroSlider = document.getElementById('hero-slider');
  if(heroSlider){
    const heroSlides = [
      {label:'Identité visuelle & Branding', image:'ASSET/SLIDES/branding.jpg', title:'Identité visuelle<br><span>& Branding</span>', subtitle:'Une image qui vous ressemble.', description:'Créons une identité forte, cohérente et mémorable pour votre marque.', cta:'Découvrir le branding', href:'service-branding.html', icon:'fa-palette'},
      {label:'Création Web & E-commerce', image:'ASSET/SLIDES/web.jpg', title:'Création Web<br><span>& E-commerce</span>', subtitle:'Votre présence digitale commence ici.', description:'Des sites modernes, rapides et conçus pour transformer vos visiteurs en clients.', cta:'Créer mon site', href:'service-web.html', icon:'fa-laptop-code'},
      {label:'Réseaux sociaux', image:'ASSET/SLIDES/social.jpg', title:'Réseaux sociaux<br><span>& Community Management</span>', subtitle:'Faites vivre votre marque au quotidien.', description:'Stratégie, contenus, animation et publicité pour développer votre communauté.', cta:'Développer ma marque', href:'service-social.html', icon:'fa-hashtag'},
      {label:'Design graphique', image:'ASSET/SLIDES/design.jpg', title:'Design graphique<br><span>& Contenus</span>', subtitle:'Vos idées méritent de belles images.', description:'Affiches, brochures, contenus digitaux et supports de communication qui marquent.', cta:'Découvrir nos créations', href:'service-design.html', icon:'fa-pen-ruler'},
      {label:'Films publicitaires', image:'ASSET/SLIDES/films.jpg', title:'Films publicitaires<br><span>& Institutionnels</span>', subtitle:'Racontez votre histoire autrement.', description:'De la conception au tournage et à la post-production, nous donnons vie à vos projets.', cta:'Produire mon film', href:'service-films.html', icon:'fa-clapperboard'},
      {label:'Captation & Live', image:'ASSET/SLIDES/live.jpg', title:'Captation vidéo<br><span>& Live</span>', subtitle:'Ne laissez aucun moment important disparaître.', description:'Événements, conférences, cérémonies, reportages et streaming professionnel.', cta:'Couvrir mon événement', href:'service-live.html', icon:'fa-video'},
      {label:'Digitalisation', image:'ASSET/SLIDES/digitalisation.jpg', title:'Digitalisation<br><span>des entreprises</span>', subtitle:'Transformez votre façon de travailler.', description:'Automatisation, applications, outils de gestion et solutions digitales sur mesure.', cta:'Digitaliser mon entreprise', href:'service-digital.html', icon:'fa-gears'}
    ];
    const dots = document.getElementById('hero-dots');
    const progressBar = document.getElementById('hero-progress-bar');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let activeHero = 0;
    let heroTimer;
    let heroPaused = false;
    let touchStartX = 0;

    function createHeroMedia(slide, index){
      if(slide.video){
        const video = document.createElement('video');
        video.className = 'hero-slide-media';
        video.autoplay = true; video.muted = true; video.loop = true; video.playsInline = true;
        video.preload = index === 0 ? 'auto' : 'none';
        video.poster = slide.image;
        video.src = slide.video;
        video.addEventListener('error', function(){
          const fallback = document.createElement('img');
          fallback.className = 'hero-slide-media'; fallback.src = slide.image; fallback.alt = slide.label;
          video.replaceWith(fallback);
        });
        return video;
      }
      const image = document.createElement('img');
      image.className = 'hero-slide-media'; image.src = slide.image; image.alt = slide.label;
      image.loading = index === 0 ? 'eager' : 'lazy';
      return image;
    }

    function renderHero(){
      heroSlider.innerHTML = '';
      heroSlides.forEach(function(slide, index){
        const article = document.createElement('article');
        article.className = 'hero-slide' + (index === 0 ? ' is-active' : '');
        article.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');
        article.appendChild(createHeroMedia(slide, index));
        article.insertAdjacentHTML('beforeend', '<div class="hero-slide-content"><div class="hero-badge"><span class="dot"></span>' + slide.label + ' — Abidjan</div><h1>' + slide.title + '</h1><p class="hero-subtitle">' + slide.subtitle + '</p><p class="hero-text">' + slide.description + '</p><div class="hero-cta"><a class="btn btn-primary" href="' + slide.href + '">' + slide.cta + ' <i class="fa-solid fa-arrow-right"></i></a><a class="btn btn-outline" href="portfolio.html">Voir nos réalisations</a></div><div class="hero-proof"><span><i class="fa-solid ' + slide.icon + '"></i> Expertise BRAIN</span><span><i class="fa-solid fa-location-dot"></i> Abidjan, Côte d\'Ivoire</span></div></div>');
        heroSlider.appendChild(article);
        const dot = document.createElement('button');
        dot.className = 'hero-dot' + (index === 0 ? ' is-active' : ''); dot.type = 'button'; dot.setAttribute('aria-label', 'Afficher la slide ' + (index + 1) + ': ' + slide.label); dot.setAttribute('aria-current', index === 0 ? 'true' : 'false');
        dot.addEventListener('click', function(){ goToHero(index); });
        dots.appendChild(dot);
      });
    }

    function resetHeroProgress(){
      if(!progressBar) return;
      progressBar.classList.remove('is-running');
      void progressBar.offsetWidth;
      progressBar.classList.add('is-running');
    }
    function goToHero(index){
      const slides = heroSlider.querySelectorAll('.hero-slide');
      const heroDots = dots.querySelectorAll('.hero-dot');
      activeHero = (index + heroSlides.length) % heroSlides.length;
      slides.forEach(function(slide, slideIndex){ slide.classList.toggle('is-active', slideIndex === activeHero); slide.setAttribute('aria-hidden', slideIndex === activeHero ? 'false' : 'true'); });
      heroDots.forEach(function(dot, dotIndex){ dot.classList.toggle('is-active', dotIndex === activeHero); dot.setAttribute('aria-current', dotIndex === activeHero ? 'true' : 'false'); });
      resetHeroProgress();
    }
    function scheduleHero(){
      window.clearTimeout(heroTimer);
      if(!heroPaused){ heroTimer = window.setTimeout(function(){ goToHero(activeHero + 1); scheduleHero(); }, 6000); }
    }
    function pauseHero(){ heroPaused = true; window.clearTimeout(heroTimer); }
    function resumeHero(){ heroPaused = false; scheduleHero(); }

    renderHero();
    document.querySelector('[data-hero-prev]').addEventListener('click', function(){ goToHero(activeHero - 1); scheduleHero(); });
    document.querySelector('[data-hero-next]').addEventListener('click', function(){ goToHero(activeHero + 1); scheduleHero(); });
    heroSlider.addEventListener('mouseenter', pauseHero); heroSlider.addEventListener('mouseleave', resumeHero);
    heroSlider.addEventListener('touchstart', function(event){ touchStartX = event.changedTouches[0].screenX; }, {passive:true});
    heroSlider.addEventListener('touchend', function(event){ const distance = event.changedTouches[0].screenX - touchStartX; if(Math.abs(distance) > 50){ goToHero(activeHero + (distance < 0 ? 1 : -1)); scheduleHero(); } }, {passive:true});
    document.addEventListener('keydown', function(event){ if(event.key === 'ArrowLeft') goToHero(activeHero - 1); if(event.key === 'ArrowRight') goToHero(activeHero + 1); });
    document.addEventListener('visibilitychange', function(){ if(document.hidden) pauseHero(); else if(!reduceMotion) resumeHero(); });
    resetHeroProgress();
    scheduleHero();
  }

  /* ---------- MOBILE NAV ---------- */
  const burger = document.getElementById('burger');
  const mobileNav = document.getElementById('mobile-nav');
  const navOverlay = document.getElementById('nav-overlay');

  function toggleMobileNav(){
    burger.classList.toggle('open');
    mobileNav.classList.toggle('open');
    navOverlay.classList.toggle('open');
    document.body.style.overflow = mobileNav.classList.contains('open') ? 'hidden' : '';
  }
  if(burger){
    burger.addEventListener('click', toggleMobileNav);
    navOverlay.addEventListener('click', toggleMobileNav);
    mobileNav.querySelectorAll('a').forEach(function(link){
      link.addEventListener('click', function(){
        if(mobileNav.classList.contains('open')) toggleMobileNav();
      });
    });
  }

  /* ---------- BACK TO TOP ---------- */
  const backToTop = document.getElementById('back-to-top');
  if(backToTop){
    window.addEventListener('scroll', function(){
      if(window.scrollY > 500){ backToTop.classList.add('show'); }
      else{ backToTop.classList.remove('show'); }
    });
    backToTop.addEventListener('click', function(){
      window.scrollTo({top:0, behavior:'smooth'});
    });
  }

  /* ---------- SCROLL REVEAL ANIMATIONS (AOS-lite) ---------- */
  const revealEls = document.querySelectorAll('[data-aos]');
  if('IntersectionObserver' in window){
    const observer = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          const delay = entry.target.getAttribute('data-aos-delay') || 0;
          setTimeout(function(){
            entry.target.classList.add('aos-animate');
          }, parseInt(delay));
          observer.unobserve(entry.target);
        }
      });
    }, {threshold:0.15});
    revealEls.forEach(function(el){ observer.observe(el); });
  } else {
    revealEls.forEach(function(el){ el.classList.add('aos-animate'); });
  }

  /* ---------- ANIMATED COUNTERS ---------- */
  const counters = document.querySelectorAll('[data-counter]');
  if(counters.length && 'IntersectionObserver' in window){
    const counterObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, {threshold:0.4});
    counters.forEach(function(el){ counterObserver.observe(el); });
  }
  function animateCounter(el){
    const target = parseInt(el.getAttribute('data-counter'), 10);
    const suffix = el.getAttribute('data-suffix') || '';
    const duration = 1600;
    const start = performance.now();
    function tick(now){
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target) + suffix;
      if(progress < 1){ requestAnimationFrame(tick); }
      else{ el.textContent = target + suffix; }
    }
    requestAnimationFrame(tick);
  }

  /* ---------- PORTFOLIO FILTER ---------- */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const portfolioItems = document.querySelectorAll('.portfolio-item');
  if(filterBtns.length){
    filterBtns.forEach(function(btn){
      btn.addEventListener('click', function(){
        filterBtns.forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        const filter = btn.getAttribute('data-filter');
        portfolioItems.forEach(function(item){
          const cats = item.getAttribute('data-cat') || '';
          if(filter === 'tout' || cats.indexOf(filter) !== -1){
            item.classList.remove('hide');
          } else {
            item.classList.add('hide');
          }
        });
      });
    });
  }

  /* ---------- VIDEO PLAYER ---------- */
  const videoModal = document.getElementById('video-modal');
  const videoFrame = document.getElementById('video-frame');
  const videoTitle = document.getElementById('video-modal-title');
  const videoTriggers = document.querySelectorAll('.video-trigger');
  const videoCloseButtons = document.querySelectorAll('[data-video-close]');
  let lastVideoTrigger = null;

  function youtubeEmbedUrl(url){
    try{
      const parsed = new URL(url);
      let videoId = parsed.searchParams.get('v');
      if(!videoId && parsed.hostname === 'youtu.be'){ videoId = parsed.pathname.slice(1); }
      return videoId ? 'https://www.youtube.com/embed/' + encodeURIComponent(videoId) + '?rel=0' : null;
    }catch(error){ return null; }
  }

  function openVideo(url, title, trigger){
    if(!videoModal || !videoFrame) return;
    const embedUrl = youtubeEmbedUrl(url);
    videoTitle.textContent = title || 'Lecture vidéo';
    lastVideoTrigger = trigger || null;
    if(embedUrl){
      videoFrame.innerHTML = '<iframe src="' + embedUrl + '" title="' + (title || 'Vidéo') + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
    }else if(/\.mp4(?:$|\?)/i.test(url)){
      videoFrame.innerHTML = '<video controls playsinline preload="metadata"><source src="' + url + '" type="video/mp4">Votre navigateur ne peut pas lire cette vidéo.</video>';
    }else{
      videoFrame.innerHTML = '<iframe src="' + url + '" title="' + (title || 'Vidéo') + '" allowfullscreen></iframe>';
    }
    videoModal.classList.add('is-open');
    videoModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('video-modal-open');
    videoCloseButtons[0]?.focus();
  }

  function closeVideo(){
    if(!videoModal || !videoFrame) return;
    videoFrame.innerHTML = '';
    videoModal.classList.remove('is-open');
    videoModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('video-modal-open');
    lastVideoTrigger?.focus();
  }

  videoTriggers.forEach(function(trigger){
    trigger.addEventListener('click', function(){
      openVideo(trigger.getAttribute('data-video-url'), trigger.getAttribute('data-video-title'), trigger);
    });
  });
  videoCloseButtons.forEach(function(button){ button.addEventListener('click', closeVideo); });
  document.addEventListener('keydown', function(event){ if(event.key === 'Escape' && videoModal?.classList.contains('is-open')) closeVideo(); });

  /* ---------- SHOWREEL : lecteur vidéo sur mesure ---------- */
  (function(){
    const shell = document.querySelector('[data-video-player]');
    const playerHost = shell ? shell.querySelector('.yt-player') : null;
    if(!shell || !playerHost) return;
    const videoId = shell.getAttribute('data-video-id');
    if(!videoId) return;

    const bigPlay = shell.querySelector('[data-vp-big-play]');
    const playBtn = shell.querySelector('[data-vp-play]');
    const muteBtn = shell.querySelector('[data-vp-mute]');
    const volumeSlider = shell.querySelector('[data-vp-volume]');
    const loading = shell.querySelector('[data-vp-loading]');
    const playIcon = playBtn ? playBtn.querySelector('i') : null;
    const muteIcon = muteBtn ? muteBtn.querySelector('i') : null;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const autoStart = !reduceMotion;

    let player = null;
    let muted = true;
    let volume = 100;
    let apiReady = false;
    const pending = [];

    function setPlayUI(playing){
      if(!playIcon || !playBtn) return;
      playIcon.className = playing ? 'fa-solid fa-pause' : 'fa-solid fa-play';
      playBtn.setAttribute('aria-label', playing ? 'Mettre en pause' : 'Lire');
      shell.classList.toggle('is-paused', !playing);
    }
    function setMuteUI(){
      if(!muteIcon || !muteBtn || !volumeSlider) return;
      const level = muted ? 0 : volume;
      muteIcon.className = level === 0 ? 'fa-solid fa-volume-xmark' : (level < 50 ? 'fa-solid fa-volume-low' : 'fa-solid fa-volume-high');
      muteBtn.setAttribute('aria-label', muted ? 'Activer le son' : 'Couper le son');
      volumeSlider.value = level;
      volumeSlider.setAttribute('aria-valuetext', 'Volume ' + level + ' pour cent');
    }
    function flushPending(){
      const callbacks = pending.splice(0);
      callbacks.forEach(function(cb){ cb(); });
    }
    window.onYouTubeIframeAPIReady = function(){
      apiReady = true;
      flushPending();
    };
    function whenApiReady(cb){
      if(apiReady) cb(); else pending.push(cb);
    }
    function loadApi(){
      if(window.YT && window.YT.Player){
        apiReady = true;
        flushPending();
        return;
      }
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);
    }
    function buildPlayer(){
      player = new YT.Player(playerHost, {
        videoId: videoId,
        width:'100%',
        height:'100%',
        playerVars:{
          autoplay: autoStart ? 1 : 0,
          mute:1,
          controls:0,
          modestbranding:1,
          rel:0,
          playsinline:1,
          loop:1,
          playlist:videoId,
          iv_load_policy:3,
          fs:0
        },
        events:{
          onReady: function(){
            if(loading){ loading.classList.add('is-hidden'); }
            try{ player.mute(); }catch(error){}
            player.setVolume(volume);
            muted = true;
            setMuteUI();
            if(autoStart){
              player.playVideo();
              setPlayUI(true);
            }else{
              player.pauseVideo();
              setPlayUI(false);
            }
          },
          onStateChange: function(event){
            if(event.data === 1){ setPlayUI(true); }
            else if(event.data === 2){ setPlayUI(false); }
          }
        }
      });
    }
    function togglePlay(){
      if(!player) return;
      const state = player.getPlayerState();
      if(state === 1){ player.pauseVideo(); }
      else{ player.playVideo(); }
    }
    function toggleMute(){
      if(!player) return;
      muted = !muted;
      if(muted){
        player.mute();
      }else{
        if(volume === 0){ player.setVolume(100); volume = 100; }
        player.unMute();
      }
      setMuteUI();
    }
    function setVolume(value){
      if(!player) return;
      volume = value;
      if(volume > 0 && muted){ muted = false; player.unMute(); }
      player.setVolume(volume);
      if(volume === 0){ muted = true; player.mute(); }
      setMuteUI();
    }

    if(playBtn) playBtn.addEventListener('click', togglePlay);
    if(bigPlay) bigPlay.addEventListener('click', togglePlay);
    if(muteBtn) muteBtn.addEventListener('click', toggleMute);
    if(volumeSlider) volumeSlider.addEventListener('input', function(){ setVolume(parseInt(this.value, 10) || 0); });

    if('IntersectionObserver' in window){
      const observer = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting){
            loadApi();
            whenApiReady(buildPlayer);
            observer.disconnect();
          }
        });
      }, {rootMargin:'600px'});
      observer.observe(shell);
    }else{
      loadApi();
      whenApiReady(buildPlayer);
    }
  })();

  /* ---------- SERVICE DETAIL SMOOTH NAV ---------- */
  const sdnItems = document.querySelectorAll('.sdn-item');
  if(sdnItems.length){
    sdnItems.forEach(function(item){
      item.addEventListener('click', function(e){
        e.preventDefault();
        const targetId = item.getAttribute('href');
        const targetEl = document.querySelector(targetId);
        if(targetEl){
          const offset = 110;
          const top = targetEl.getBoundingClientRect().top + window.pageYOffset - offset;
          window.scrollTo({top: top, behavior:'smooth'});
        }
      });
    });
  }

  /* ---------- CONTACT FORM VALIDATION ---------- */
  const contactForm = document.getElementById('contact-form');
  if(contactForm){
    contactForm.addEventListener('submit', function(e){
      e.preventDefault();
      let valid = true;
      const fields = contactForm.querySelectorAll('[required]');
      fields.forEach(function(field){
        const group = field.closest('.form-group');
        if(!field.value.trim()){
          group.classList.add('error');
          valid = false;
        } else {
          group.classList.remove('error');
          if(field.type === 'email'){
            const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if(!emailRe.test(field.value)){
              group.classList.add('error');
              valid = false;
            }
          }
        }
      });

      const successMsg = document.getElementById('form-success');
      if(valid){
        const submitBtn = contactForm.querySelector('[type="submit"]');
        if(submitBtn){
          submitBtn.disabled = true;
          submitBtn.textContent = 'Envoi en cours…';
        }
        const endpoint = (contactForm.getAttribute('action') || '').replace('formsubmit.co/', 'formsubmit.co/ajax/');
        if(endpoint && 'fetch' in window){
          fetch(endpoint, {
            method:'POST',
            headers:{'Accept':'application/json'},
            body:new FormData(contactForm)
          })
          .then(function(response){ return response.json(); })
          .then(function(data){
            if(data && (data.success === 'true' || data.success === true)){
              contactForm.reset();
              if(successMsg){
                successMsg.classList.add('show');
                successMsg.scrollIntoView({behavior:'smooth', block:'center'});
                setTimeout(function(){ successMsg.classList.remove('show'); }, 6000);
              }
            }
          })
          .catch(function(){})
          .finally(function(){
            if(submitBtn){
              submitBtn.disabled = false;
              submitBtn.textContent = 'Envoyer ma demande';
            }
          });
        }else{
          contactForm.submit();
        }
      }
    });

    contactForm.querySelectorAll('input, select, textarea').forEach(function(field){
      field.addEventListener('input', function(){
        field.closest('.form-group').classList.remove('error');
      });
    });
  }

  /* ---------- ACTIVE NAV LINK ---------- */
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.main-nav a, .mobile-nav a').forEach(function(link){
    const href = link.getAttribute('href');
    if(href === currentPage || (currentPage === '' && href === 'index.html')){
      link.classList.add('active');
    }
  });

});
