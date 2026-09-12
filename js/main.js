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
        contactForm.reset();
        if(successMsg){
          successMsg.classList.add('show');
          successMsg.scrollIntoView({behavior:'smooth', block:'center'});
          setTimeout(function(){ successMsg.classList.remove('show'); }, 6000);
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
