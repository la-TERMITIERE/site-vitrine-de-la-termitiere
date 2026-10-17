/* =========================================================
   LA TERMITIÈRE — script partagé (index.html + service.html)
   ========================================================= */
/* ---------- Écran de chargement (logo animé, le temps que la page/les images arrivent) ---------- */
(() => {
  const splash = document.getElementById('loading-splash');
  const video = document.getElementById('loading-splash-video');
  if (!splash) return;

  let alreadyShown = false;
  try { alreadyShown = sessionStorage.getItem('termitiere-intro-shown') === '1'; } catch (e) { /* ignore */ }
  if (alreadyShown) { splash.remove(); return; }
  try { sessionStorage.setItem('termitiere-intro-shown', '1'); } catch (e) { /* ignore */ }

  let hidden = false;
  const hide = () => {
    if (hidden) return;
    hidden = true;
    splash.classList.add('loading-hidden');
    setTimeout(() => splash.remove(), 600);
  };

  let pageLoaded = document.readyState === 'complete';
  let videoDone = !video;
  const maybeHide = () => { if (pageLoaded && videoDone) hide(); };

  if (!pageLoaded) window.addEventListener('load', () => { pageLoaded = true; maybeHide(); });

  if (video) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      videoDone = true;
    } else {
      video.playbackRate = 1.8; // video source dure ~7s, on l'accelere pour un ecran de chargement plus court
      video.addEventListener('ended', () => { videoDone = true; maybeHide(); });
      video.play().catch(() => { videoDone = true; maybeHide(); });
    }
  }

  maybeHide();
  setTimeout(hide, 5000); // filet de securite si le chargement traine
})();

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Secteur pré-rempli sur le formulaire de contact ---------- */
  const sectorInput = document.getElementById('f-sector');
  const sectorField = document.getElementById('f-sector-field');
  if (sectorInput && sectorField) {
    const secteur = new URLSearchParams(window.location.search).get('secteur');
    if (secteur) {
      sectorInput.value = secteur;
      sectorField.style.display = '';
    }
  }

  /* ---------- Thème clair / sombre ---------- */
  const themeToggle = document.getElementById('theme-toggle');
  const root = document.documentElement;
  const applyTheme = (theme) => {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('termitiere-theme', theme); } catch (e) { /* ignore */ }
  };
  let savedTheme = 'light';
  try {
    savedTheme = localStorage.getItem('termitiere-theme')
      || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  } catch (e) { /* ignore */ }
  applyTheme(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  /* ---------- Menu mobile ---------- */
  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const isOpen = mainNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Sous-menus deroulants (nav) ---------- */
  const navDropdowns = document.querySelectorAll('.nav-dropdown');
  const closeAllDropdowns = () => {
    navDropdowns.forEach(d => {
      d.classList.remove('open');
      d.querySelector('.nav-dropdown-toggle')?.setAttribute('aria-expanded', 'false');
    });
  };
  navDropdowns.forEach(dropdown => {
    const toggle = dropdown.querySelector('.nav-dropdown-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !dropdown.classList.contains('open');
      closeAllDropdowns();
      if (willOpen) {
        dropdown.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
  });
  document.addEventListener('click', closeAllDropdowns);
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      if (!mainNav.classList.contains('open')) closeAllDropdowns();
    });
  }

  /* ---------- Lien de nav actif au scroll (page d'accueil) ---------- */
  const sections = document.querySelectorAll('main section[id]');
  const navLinks = document.querySelectorAll('.main-nav a[href^="index.html#"], .main-nav a[href^="#"]');
  const highlightNav = () => {
    let currentId = '';
    sections.forEach(sec => {
      const rect = sec.getBoundingClientRect();
      if (rect.top <= 120 && rect.bottom >= 120) currentId = sec.id;
    });
    navLinks.forEach(link => {
      const href = link.getAttribute('href') || '';
      link.classList.toggle('active', href.endsWith('#' + currentId) && currentId !== '');
    });
  };
  if (sections.length) {
    document.addEventListener('scroll', highlightNav, { passive: true });
    highlightNav();
  }

  /* ---------- Révélation au scroll ---------- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          // Une fois l'apparition terminee, on efface la transition (et son delai)
          // pour laisser les regles CSS (ex: effet au survol) reprendre la main.
          entry.target.addEventListener('transitionend', () => {
            entry.target.style.transition = '';
          }, { once: true });
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    revealEls.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(18px)';
      const delay = el.dataset.revealDelay ? `${el.dataset.revealDelay}s` : '0s';
      el.style.transition = `opacity .5s ease ${delay}, transform .5s ease ${delay}`;
      io.observe(el);
    });
  }

  /* ---------- Carrousels photo (hero / vision) ---------- */
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const initCarousel = (containerId, slideClass, intervalMs) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const slides = container.querySelectorAll('.' + slideClass);
    if (slides.length < 2 || prefersReducedMotion) return;
    let current = 0;
    setInterval(() => {
      slides[current].classList.remove('active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('active');
    }, intervalMs);
  };
  /* ---------- Hero plein écran : la termitière puis une diapositive par secteur ---------- */
  const heroBg = document.getElementById('hero-bg');
  const heroCaption = document.getElementById('hero-sector-caption');
  const heroCta = document.getElementById('hero-sector-cta');
  if (heroBg && typeof SECTORS !== 'undefined') {
    const introSlide = document.createElement('div');
    introSlide.className = 'hero-bg-slide active';
    introSlide.style.backgroundImage = "url('images/vision/termitiere-savane.jpg')";
    introSlide.dataset.name = 'La Termitière';
    introSlide.dataset.text = "Une équipe togolaise active sur plusieurs secteurs, une seule conviction.";
    introSlide.dataset.href = '#secteurs';
    introSlide.dataset.cta = 'Découvrir nos secteurs';
    heroBg.appendChild(introSlide);

    SECTOR_ORDER.forEach((id) => {
      const s = SECTORS[id];
      if (s.heroSkip) return;
      const photo = s.homeHeroPhoto || s.heroPhoto || (s.photos && s.photos.length ? s.photosDir + s.photos[0] : null);
      if (!photo) return;
      const slide = document.createElement('div');
      slide.className = 'hero-bg-slide';
      slide.style.backgroundImage = `url('${photo}')`;
      slide.dataset.name = s.name;
      slide.dataset.text = s.cardText || '';
      slide.dataset.href = '#secteurs';
      slide.dataset.cta = 'En savoir plus';
      heroBg.appendChild(slide);
    });

    const heroSlides = heroBg.querySelectorAll('.hero-bg-slide');
    let heroCurrent = 0;
    const setCaption = (slide) => {
      if (heroCaption) heroCaption.innerHTML = `<strong>${slide.dataset.name}</strong><br>${slide.dataset.text}`;
      if (heroCta) {
        heroCta.textContent = slide.dataset.cta;
        heroCta.setAttribute('href', slide.dataset.href);
      }
    };
    if (heroSlides.length) setCaption(heroSlides[0]);
    if (heroSlides.length > 1 && !prefersReducedMotion) {
      setInterval(() => {
        heroSlides[heroCurrent].classList.remove('active');
        heroCurrent = (heroCurrent + 1) % heroSlides.length;
        heroSlides[heroCurrent].classList.add('active');
        if (heroCaption) heroCaption.classList.add('fading');
        if (heroCta) heroCta.classList.add('fading');
        setTimeout(() => {
          setCaption(heroSlides[heroCurrent]);
          if (heroCaption) heroCaption.classList.remove('fading');
          if (heroCta) heroCta.classList.remove('fading');
        }, 400);
      }, 5000);
    }
  }
  initCarousel('vision-bg', 'vision-bg-slide', 4200);

  /* ---------- Cartes secteurs (page d'accueil) ---------- */
  const cardsWrap = document.getElementById('sector-cards');
  if (cardsWrap && typeof SECTORS !== 'undefined') {
    const iconArrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg>';
    SECTOR_ORDER.forEach(id => {
      const s = SECTORS[id];
      const logoBlock = s.logo
        ? `<img src="${s.logo}" alt="Logo ${s.name}">`
        : `<span class="letter-badge">${s.letter}</span>`;
      const cardPhoto = s.homeHeroPhoto || s.heroPhoto || (s.photos && s.photos.length ? s.photosDir + s.photos[0] : null);
      const photoStyle = cardPhoto
        ? `background-image:url('${cardPhoto}');`
        : `background:linear-gradient(135deg, ${s.color}, ${s.colorDark});`;
      const card = document.createElement('a');
      card.href = `service.html?id=${s.id}`;
      card.className = 'sector-card';
      card.style.setProperty('--accent', s.color);
      card.innerHTML = `
        <div class="sector-card-photo" style="${photoStyle}">
          <div class="sector-card-logo-badge">${logoBlock}</div>
        </div>
        <div class="sector-card-body">
          <h3>${s.name}</h3>
          <p>${s.cardText}</p>
          <span class="card-link">Découvrir ${iconArrow}</span>
        </div>`;
      cardsWrap.appendChild(card);
    });
  }

  /* ---------- Accordéon FAQ ---------- */
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(openItem => {
        openItem.classList.remove('open');
        openItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ---------- Formulaire de contact ---------- */
  const form = document.getElementById('contact-form');
  const formFeedback = document.getElementById('form-feedback');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const honeypot = form.querySelector('input[name="bot-field"]');
      if (honeypot && honeypot.value) return;

      const submitBtn = form.querySelector('button[type="submit"]');
      const formData = Object.fromEntries(new FormData(form).entries());

      if (!formData.email && !formData.phone) {
        formFeedback.textContent = 'Merci de renseigner au moins un email ou un numéro de téléphone.';
        formFeedback.style.color = '#BD3C2F';
        return;
      }

      submitBtn.disabled = true;
      formFeedback.textContent = 'Envoi en cours…';
      formFeedback.style.color = '';

      fetch('https://contact.latermitiere.com/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(formData),
      })
        .then((response) => {
          if (!response.ok) throw new Error('Réponse serveur invalide');
          formFeedback.textContent = 'Message envoyé, merci ! Nous revenons vers vous rapidement.';
          formFeedback.style.color = '#2f8f5b';
          form.reset();
        })
        .catch(() => {
          formFeedback.textContent = "L'envoi a échoué. Merci de réessayer, ou de nous contacter directement par téléphone/WhatsApp.";
          formFeedback.style.color = '#BD3C2F';
        })
        .finally(() => { submitBtn.disabled = false; });
    });
  }

  /* ---------- Visionneuse photo / vidéo (lightbox) ---------- */
  const lightbox = document.getElementById('lightbox');
  const lightboxContent = document.getElementById('lightbox-content');
  const lightboxClose = document.getElementById('lightbox-close');

  if (lightbox && lightboxContent && lightboxClose) {
    const openLightbox = (type, src) => {
      lightboxContent.innerHTML = '';
      if (type === 'video') {
        const video = document.createElement('video');
        video.src = src;
        video.controls = true;
        video.controlsList = 'nodownload';
        video.disablePictureInPicture = true;
        video.autoplay = true;
        video.playsInline = true;
        lightboxContent.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.draggable = false;
        lightboxContent.appendChild(img);
      }
      lightbox.classList.add('open');
    };
    const closeLightbox = () => {
      lightbox.classList.remove('open');
      lightboxContent.innerHTML = '';
    };

    document.body.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-lightbox]');
      if (trigger) {
        openLightbox(trigger.getAttribute('data-lightbox'), trigger.getAttribute('data-src'));
      }
    });
    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
  }

  /* ---------- Protection basique des médias (dissuasion, pas un blocage absolu) ---------- */
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('img, video')) e.preventDefault();
  });
  document.addEventListener('dragstart', (e) => {
    if (e.target.closest('img, video')) e.preventDefault();
  });
  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (key === 's' || key === 'u')) e.preventDefault();
  });

});
