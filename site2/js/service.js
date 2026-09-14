/* =========================================================
   LA TERMITIÈRE — rendu dynamique de service.html
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof SECTORS === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const s = SECTORS[id];

  const layout = document.getElementById('sector-layout');
  if (!s) {
    document.getElementById('page-title').textContent = 'Secteur introuvable — La Termitière';
    layout.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:40px 0;">
        <h2>Secteur introuvable</h2>
        <p style="color:var(--text-muted);">Ce secteur n'existe pas ou n'est plus disponible.</p>
        <a href="index.html#secteurs" class="btn btn-primary" style="margin-top:16px;">Voir tous les secteurs</a>
      </div>`;
    return;
  }

  /* ---------- Couleurs dynamiques ---------- */
  document.documentElement.style.setProperty('--accent', s.color);
  document.documentElement.style.setProperty('--accent-dark', s.colorDark);

  /* ---------- En-tête ---------- */
  document.getElementById('page-title').textContent = `${s.name} — La Termitière`;
  document.getElementById('sector-tag').textContent = s.tagline;
  document.getElementById('sector-title').textContent = s.name;
  document.getElementById('sector-breadcrumb-name').textContent = s.name;

  if (!s.heroSkip) {
    const heroImgs = Array.isArray(s.heroPhotos) && s.heroPhotos.length
      ? s.heroPhotos
      : (s.heroPhoto ? [s.heroPhoto]
        : (s.photos && s.photos.length ? [s.photosDir + s.photos[0]] : []));
    const heroEl = document.getElementById('sector-hero');
    heroImgs.forEach((src, i) => {
      const slide = document.createElement('div');
      slide.className = 'sector-hero-photo' + (i === 0 ? ' active' : '');
      slide.style.backgroundImage = `url('${src}')`;
      if (s.heroPosition) slide.style.backgroundPosition = s.heroPosition;
      heroEl.appendChild(slide);
    });
    if (heroImgs.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const slides = heroEl.querySelectorAll('.sector-hero-photo');
      let cur = 0;
      setInterval(() => {
        slides[cur].classList.remove('active');
        cur = (cur + 1) % slides.length;
        slides[cur].classList.add('active');
      }, 5000);
    }
  }


  /* ---------- Icônes ---------- */
  const ICONS = {
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".5" fill="currentColor"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="M21 15l-5-5-9 9"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82a4.28 4.28 0 01-3.14-3.4h-3.03v13.6c0 1.5-1.22 2.72-2.72 2.72a2.72 2.72 0 010-5.44c.25 0 .5.03.72.1V10.3a5.95 5.95 0 00-.72-.04A5.94 5.94 0 000 16.2a5.94 5.94 0 0011.87 0V9.1a7.3 7.3 0 004.24 1.35V7.3c-.02 0-.03 0-.05 0a4.28 4.28 0 01-3.46-1.48z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h4l2 5-2.5 1.5a12 12 0 006 6L15 14l5 2v4a2 2 0 01-2 2C9.5 22 2 14.5 2 6a2 2 0 012-2z"/></svg>',
  };

  // Formate un numéro togolais brut ("22897056547") en "+228 97 05 65 47" pour l'affichage.
  function formatPhone(raw) {
    const digits = (raw || '').replace(/\D/g, '');
    if (digits.length !== 11 || !digits.startsWith('228')) return raw;
    const local = digits.slice(3);
    return `+228 ${local.slice(0, 2)} ${local.slice(2, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)}`;
  }

  /* ---------- Contenu "bientôt disponible" ---------- */
  if (s.comingSoon) {
    layout.innerHTML = `
      <div style="grid-column:1/-1;">
        <div class="soon-panel">
          <span class="soon-badge">Bientôt disponible</span>
          <h2>${s.name}</h2>
          <p>${s.mission}</p>
          ${renderCtaButtons(s)}
        </div>
        ${renderOtherSectors(s.id, true)}
      </div>`;
    return;
  }

  /* ---------- Colonne principale ---------- */
  let mainHtml = '';
  if (s.logo) {
    mainHtml += `<img class="sector-brand-logo" src="${s.logo}" alt="Logo ${s.name}">`;
  }
  mainHtml += `<p class="sector-mission-text">${s.mission}</p>`;
  mainHtml += renderCtaButtons(s);

  // Médias
  const hasPhotos = s.photos && s.photos.length > 0;
  if (hasPhotos || s.hideMediaPlaceholder) {
    mainHtml += `<div class="media-placeholder" style="display:none;"></div>`; // no-op safeguard
  } else {
    mainHtml += `
      <div class="media-placeholder">
        ${ICONS.photo}
        <span>Photos à venir pour ${s.name}</span>
      </div>`;
  }

  if (s.services && s.services.length) {
    mainHtml += `<h2 class="sector-section-title">Services</h2><div class="service-cards">`;
    s.services.forEach(sv => {
      mainHtml += `<div class="service-card"><h4>${sv.title}</h4><p>${sv.text}</p></div>`;
    });
    mainHtml += `</div>`;
  }

  if (s.highlights && s.highlights.length) {
    mainHtml += `<h2 class="sector-section-title">Ce qui nous différencie</h2><div class="service-cards">`;
    s.highlights.forEach(h => {
      mainHtml += `<div class="service-card"><h4>${h.title}</h4><p>${h.text}</p></div>`;
    });
    mainHtml += `</div>`;
  }

  // Module "Comment ça marche" masqué temporairement : l'inscription en ligne n'est pas encore
  // disponible au lancement du site. Décommenter le bloc ci-dessous une fois le module prêt.
  /*
  if (s.procedure && s.procedure.length) {
    mainHtml += `<h2 class="sector-section-title">Comment ça marche</h2><div class="timeline-wrap">`;
    if (s.processPhoto) mainHtml += `<div class="timeline-watermark" style="background-image:url('${s.processPhoto}');" aria-hidden="true"></div>`;
    mainHtml += `<div class="timeline">`;
    s.procedure.forEach((step, i) => {
      mainHtml += `
        <div class="timeline-item">
          <div class="timeline-dot">${i + 1}</div>
          <div class="timeline-content"><h4>${step.title}</h4><p>${step.desc}</p></div>
        </div>`;
    });
    mainHtml += `</div></div>`;
  }
  */

  if (s.tables && s.tables.length) {
    mainHtml += `<h2 class="sector-section-title">Tarifs</h2>`;
    s.tables.forEach(t => {
      if (s.tables.length > 1) mainHtml += `<div class="price-table-title">${t.title}</div>`;
      mainHtml += `<table class="price-table"><tr>${t.columns.map(c => `<th>${c}</th>`).join('')}</tr>`;
      t.rows.forEach(row => {
        mainHtml += `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
      });
      mainHtml += `</table>`;
    });
    if (s.note) mainHtml += `<p class="table-note">${s.note}</p>`;
  }

  if (hasPhotos) {
    mainHtml += `<h2 class="sector-section-title">Galerie photos</h2><div class="carousel-viewport"><div class="gallery-strip carousel-track">`;
    const photoSet = [...s.photos, ...s.photos];
    photoSet.forEach((p, i) => {
      const src = s.photosDir + p;
      mainHtml += `<button class="g-thumb" data-lightbox="img" data-src="${src}"><img src="${src}" alt="${s.name} — photo ${(i % s.photos.length) + 1}" loading="lazy"></button>`;
    });
    mainHtml += `</div></div>`;
  }

  if (s.videos && s.videos.length) {
    mainHtml += `<h2 class="sector-section-title">Vidéos</h2><div class="carousel-viewport"><div class="video-strip carousel-track">`;
    const videoSet = [...s.videos, ...s.videos];
    videoSet.forEach((v, i) => {
      const src = s.videosDir + v;
      const poster = s.videosDir + v.replace('.mp4', '-poster.jpg');
      mainHtml += `
        <button class="v-thumb" data-lightbox="video" data-src="${src}">
          <img src="${poster}" alt="Aperçu vidéo ${s.name} ${(i % s.videos.length) + 1}" loading="lazy">
          <span class="play-badge">${ICONS.play}</span>
        </button>`;
    });
    mainHtml += `</div></div>`;
  }

  if (s.faq && s.faq.length) {
    mainHtml += `<h2 class="sector-section-title">Questions fréquentes</h2><div class="faq-accordion">`;
    s.faq.forEach(item => {
      mainHtml += `
        <div class="faq-item">
          <button class="faq-question" aria-expanded="false">
            <span>${item.q}</span>
            <svg class="faq-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div class="faq-answer"><p>${item.a}</p></div>
        </div>`;
    });
    mainHtml += `</div>`;
  }

  /* ---------- Colonne latérale ---------- */
  let sideHtml = '';
  if (s.cible) {
    sideHtml += `<div class="info-card"><div class="lbl">${ICONS.target} Cible</div><p>${s.cible}</p></div>`;
  }
  if (s.horaires) {
    sideHtml += `<div class="info-card"><div class="lbl">${ICONS.clock} Horaires</div><p>${s.horaires}</p></div>`;
  }
  if (s.localisation) {
    sideHtml += `<div class="info-card"><div class="lbl">${ICONS.pin} Localisation</div><p>${s.localisation}</p></div>`;
  }
  const contactList = Array.isArray(s.contacts) && s.contacts.length
    ? s.contacts
    : ((s.phone || s.whatsapp) ? [{ label: '', phone: s.phone || s.whatsapp }] : []);
  contactList.forEach(c => {
    const num = c.phone || c.whatsapp;
    if (!num) return;
    const lbl = c.label ? ` — ${c.label}` : '';
    sideHtml += `<div class="info-card"><div class="lbl">${ICONS.phone} Téléphone${lbl}</div><p><a href="tel:+${num}">${formatPhone(num)}</a></p></div>`;
  });
  if (s.tiktok) {
    sideHtml += `<div class="info-card"><div class="lbl">${ICONS.tiktok} TikTok</div><p><a href="${s.tiktok}" target="_blank" rel="noopener noreferrer">${s.tiktokLabel || 'Voir sur TikTok'}</a></p></div>`;
  }
  sideHtml += `
    <div class="info-card cta">
      <p>Une question sur ce secteur ?</p>
      <a href="contact.html?secteur=${encodeURIComponent(s.name)}" class="btn">Nous contacter</a>
    </div>`;
  sideHtml += renderOtherSectors(s.id, false);

  layout.innerHTML = `
    <div class="sector-main">${mainHtml}</div>
    <aside class="sector-sidebar">${sideHtml}</aside>`;

  /* ---------- Accordéon FAQ (rendu après main.js, donc câblé ici) ---------- */
  layout.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const wasOpen = item.classList.contains('open');
      layout.querySelectorAll('.faq-item.open').forEach(openItem => {
        openItem.classList.remove('open');
        openItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ---------- Autres secteurs ---------- */
  function renderOtherSectors(currentId, block) {
    const others = SECTOR_ORDER.filter(oid => oid !== currentId);
    let html = `<div class="other-sectors"><div class="other-sectors-title">Autres secteurs</div>`;
    others.forEach(oid => {
      const o = SECTORS[oid];
      html += `<a href="service.html?id=${o.id}" class="other-sector-link"><span class="dot" style="background:${o.color};"></span>${o.name}</a>`;
    });
    html += `</div>`;
    if (block) html = `<div style="max-width:420px;margin:36px auto 0;">${html}</div>`;
    return html;
  }

  function renderCtaButtons(sector) {
    const waContacts = (Array.isArray(sector.contacts) && sector.contacts.length
      ? sector.contacts
      : (sector.whatsapp ? [{ label: '', whatsapp: sector.whatsapp }] : [])
    ).filter(c => c.whatsapp);
    if (!waContacts.length && !sector.email) return '';
    const waInscMsg = encodeURIComponent(`Bonjour, je souhaite m'inscrire / bénéficier du service ${sector.name}.`);
    const waInfoMsg = encodeURIComponent(`Bonjour, je souhaite obtenir des informations complémentaires concernant ${sector.name}.`);

    const waIcon = '<svg viewBox="0 0 16 16" fill="currentColor" width="17" height="17"><path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592z"/></svg>';
    const mailIcon = '<svg viewBox="0 0 16 16" fill="currentColor" width="17" height="17"><path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2zm13 2.383-4.758 2.855L15 11.114V5.383zm-.03 5.672-5.48-3.29-1.49 1.18a1 1 0 0 1-1.2 0L5.51 7.765 1.03 11.055a1 1 0 0 0 .97.945h12a1 1 0 0 0 .97-.945zM1.03 5.383v5.73l4.758-2.855L1.03 5.383z"/></svg>';

    // Bouton "S'inscrire / en bénéficier" masqué temporairement (inscription en ligne pas encore
    // disponible au lancement). Décommenter une fois le module prêt (voir waInscMsg).
    void waInscMsg;
    const waButtons = waContacts.map(c => {
      const waNum = String(c.whatsapp).replace(/\D/g, '');
      const lbl = c.label ? ` ${c.label}` : '';
      return `<a class="btn btn-whatsapp" href="https://wa.me/${waNum}?text=${waInfoMsg}" target="_blank" rel="noopener noreferrer">${waIcon} WhatsApp${lbl}</a>`;
    }).join('');
    return `
      <div class="cta-buttons">
        ${waButtons}
        <a class="btn btn-secondary" href="contact.html?secteur=${encodeURIComponent(sector.name)}">${mailIcon} Nous contacter</a>
      </div>`;
  }
});
