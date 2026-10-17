document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('promotions-grid');
  const empty = document.getElementById('promotions-empty');
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

  fetch('data/promotions.json')
    .then(res => res.json())
    .then(data => {
      const items = ((data && data.items) || []).filter(promo => !isExpired(promo.validUntil));
      if (!items.length) {
        empty.style.display = '';
        return;
      }

      grid.style.display = '';
      items.forEach(promo => {
        const sector = promo.sector && typeof SECTORS !== 'undefined' ? SECTORS[promo.sector] : null;
        const card = document.createElement('div');
        card.className = 'promo-card';
        if (sector) card.style.setProperty('--accent', sector.color);
        card.innerHTML = `
          ${promo.photo
            ? `<img class="promo-card-photo" src="${promo.photo}" alt="${promo.title}">`
            : `<div class="promo-card-cover"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 12v9H4v-9"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg></div>`}
          <div class="promo-card-body">
            ${sector ? `<span class="promo-card-tag">${sector.name}</span>` : ''}
            <h3>${promo.title}</h3>
            ${promo.description ? `<p>${promo.description}</p>` : ''}
            ${promo.validUntil ? `<p class="promo-card-valid">Valable jusqu'au ${formatDateFr(promo.validUntil)}</p>` : ''}
            <a href="contact.html" class="btn btn-primary">En profiter</a>
          </div>`;
        grid.appendChild(card);
      });
    })
    .catch(() => { empty.style.display = ''; });
});
