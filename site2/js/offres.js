document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('offres-grid');
  const empty = document.getElementById('offres-empty');
  if (!grid) return;

  const isExpired = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d)) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  };
  const formatDateFr = (dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  fetch('data/offres.json')
    .then(res => res.json())
    .then(data => {
      const items = ((data && data.items) || []).filter(offre => !isExpired(offre.dateLimite));
      if (!items.length) {
        empty.style.display = '';
        return;
      }

      grid.style.display = '';
      items.forEach(offre => {
        const sector = offre.sector && typeof SECTORS !== 'undefined' ? SECTORS[offre.sector] : null;
        const mailSubject = encodeURIComponent(`Candidature : ${offre.title}`);
        const mailBody = encodeURIComponent(`Bonjour,\n\nJe souhaite postuler à l'offre "${offre.title}".\n\nCordialement.`);
        const card = document.createElement('div');
        card.className = 'offre-card';
        if (sector) card.style.setProperty('--accent', sector.color);
        card.innerHTML = `
          ${offre.photo
            ? `<img class="offre-card-photo" src="${offre.photo}" alt="${offre.title}">`
            : `<div class="offre-card-cover"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16v13H4z"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/><path d="M4 12h16"/></svg></div>`}
          <div class="offre-card-body">
            <div class="offre-card-head">
              <span class="offre-card-type">${offre.type}</span>
              ${sector ? `<span class="offre-card-tag">${sector.name}</span>` : ''}
            </div>
            <h3>${offre.title}</h3>
            ${offre.location ? `<p class="offre-card-location">${offre.location}</p>` : ''}
            ${offre.description ? `<p>${offre.description}</p>` : ''}
            ${offre.dateLimite ? `<p class="offre-card-deadline">Candidatures jusqu'au ${formatDateFr(offre.dateLimite)}</p>` : ''}
            <a class="btn btn-primary" href="mailto:latermitiere2021@gmail.com?subject=${mailSubject}&body=${mailBody}">Postuler</a>
          </div>`;
        grid.appendChild(card);
      });
    })
    .catch(() => { empty.style.display = ''; });
});
