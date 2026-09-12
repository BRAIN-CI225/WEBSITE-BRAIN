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
