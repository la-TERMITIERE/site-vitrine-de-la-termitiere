/* =========================================================
   Base de connaissances de l'assistant
   Construite a partir des memes donnees que le site :
     - site2/js/sector-data.js   (secteurs, tarifs, horaires, FAQ...)
     - site2/data/promotions.json (promotions publiees via /admin)
     - site2/data/offres.json     (offres d'emploi publiees via /admin)
   Rien n'est a recopier a la main : modifier le site met a jour l'assistant
   au prochain deploiement.
   ========================================================= */
const fs = require('fs');
const path = require('path');

// En local : ../site2 ; dans l'image Docker : ./site (voir Dockerfile)
const SITE_DIR = process.env.SITE_DIR
  || (fs.existsSync(path.join(__dirname, 'site')) ? path.join(__dirname, 'site') : path.join(__dirname, '..', 'site2'));

const { SECTORS, SECTOR_ORDER } = require(path.join(SITE_DIR, 'js', 'sector-data.js'));

function readItems(file) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(SITE_DIR, 'data', file), 'utf8'));
    return Array.isArray(raw.items) ? raw.items : [];
  } catch (err) {
    console.warn(`Impossible de lire data/${file} :`, err.message);
    return [];
  }
}

function formatPhone(num) {
  // "22896094949" -> "+228 96 09 49 49"
  const local = String(num).replace(/^228/, '');
  return `+228 ${local.replace(/(\d{2})(?=\d)/g, '$1 ')}`;
}

function sectorToText(s) {
  const lines = [`## ${s.name} — ${s.tagline} (page : /service.html?id=${s.id})`];
  if (s.manager && s.manager.name) lines.push(`Responsable : ${s.manager.name.trim()} (${s.manager.title})`);
  if (s.mission) lines.push(`Mission : ${s.mission}`);
  if (s.services && s.services.length) {
    lines.push('Services :');
    s.services.forEach((x) => lines.push(`- ${x.title} : ${x.text}`));
  }
  if (s.highlights && s.highlights.length) {
    lines.push('Points forts :');
    s.highlights.forEach((x) => lines.push(`- ${x.title} : ${x.text}`));
  }
  (s.tables || []).forEach((t) => {
    lines.push(`Tableau « ${t.title} » (${t.columns.join(' | ')}) :`);
    t.rows.forEach((r) => lines.push(`- ${r.join(' | ')}`));
  });
  if (s.note) lines.push(`Note tarifaire : ${s.note}`);
  if (s.cible) lines.push(`Public visé : ${s.cible}`);
  lines.push(`Horaires : ${s.horaires || 'non communiqués sur le site'}`);
  lines.push(`Localisation : ${s.localisation || 'non communiquée sur le site'}`);
  if (s.whatsapp) lines.push(`WhatsApp du secteur : ${formatPhone(s.whatsapp)} (lien : https://wa.me/${s.whatsapp})`);
  if (s.email) lines.push(`Email : ${s.email}`);
  if (s.tiktok) lines.push(`TikTok : ${s.tiktokLabel || s.tiktok}`);
  if (s.procedure && s.procedure.length) {
    lines.push('Démarche :');
    s.procedure.forEach((p, i) => lines.push(`${i + 1}. ${p.title} — ${p.desc}`));
  }
  if (s.faq && s.faq.length) {
    lines.push('Questions fréquentes :');
    s.faq.forEach((f) => lines.push(`- Q : ${f.q}\n  R : ${f.a}`));
  }
  return lines.join('\n');
}

const COMPANY_TEXT = `# La Termitière — informations générales
Groupe multisectoriel togolais (La Termitière SARL U), site : https://latermitiere.com. Slogan : « La Termitière, toujours dans l'action ! »
Vision : « Mobiliser les richesses stockées dans le pays pour créer de la valeur ajoutée, entretenir les flammes de l'espoir de la jeunesse africaine et donner la fierté à la race noire d'ici 2050. »
Histoire : née d'une conviction simple, les richesses de demain se construisent ici, au Togo, maintenant. Un seul secteur au départ, puis plusieurs pôles (sport et santé, construction, formation et éducation, agro-élevage, bâtiment...), avec la même exigence de qualité et le même ancrage local. Derrière chaque secteur, une équipe de terrain formée et engagée.
Chiffres : 8 secteurs actifs, 3 villes couvertes (Lomé, Kara, Sokodé), site vitrine lancé en 2026, horizon 2050, 100 % ancrage local.
Siège : Lomé, Agoè-Daliko (immeuble du siège de La Termitière).
Contacts généraux : téléphone 96 09 49 49 (Lomé) et 96 06 09 09 (Kara), email latermitiere2021@gmail.com, formulaire de contact en bas de la page d'accueil (/index.html#contact).
Réseaux : Facebook « La Termitière », YouTube @la_termitiere, TikTok @la_termitiere.
Pages du site : Accueil (/index.html), Équipe (/equipe.html), Galerie photos et vidéos (/galerie.html), Promotions (/promotions.html), Carrières et offres d'emploi (/carrieres.html), FAQ (/index.html#faq).
Paiement : Mobile Money (T-Money, Flooz) ou espèces, selon le secteur.`;

// Partie stable du savoir : mise en cache cote API (identique d'une requete a l'autre).
function buildStaticKnowledge() {
  const sectors = SECTOR_ORDER.map((id) => SECTORS[id]).filter(Boolean).map(sectorToText).join('\n\n');
  return `${COMPANY_TEXT}\n\n# Les secteurs d'activité\n\n${sectors}`;
}

// Partie variable : promotions et offres encore valides aujourd'hui.
function buildDynamicKnowledge(today = new Date()) {
  const day = today.toISOString().slice(0, 10);
  const sectorName = (id) => (SECTORS[id] ? SECTORS[id].name : id || 'La Termitière');

  const promos = readItems('promotions.json').filter((p) => !p.validUntil || p.validUntil >= day);
  const offres = readItems('offres.json').filter((o) => !o.dateLimite || o.dateLimite >= day);

  const lines = [`# Actualités (date du jour : ${day})`];
  lines.push('## Promotions en cours (/promotions.html)');
  if (promos.length) {
    promos.forEach((p) => lines.push(`- ${p.title} — ${sectorName(p.sector)}${p.description ? ` : ${p.description}` : ''}${p.validUntil ? ` (jusqu'au ${p.validUntil})` : ''}`));
  } else {
    lines.push('Aucune promotion en cours actuellement.');
  }
  lines.push('## Offres d\'emploi ouvertes (/carrieres.html)');
  if (offres.length) {
    offres.forEach((o) => {
      const desc = String(o.description || '').replace(/\s+/g, ' ').trim().slice(0, 600);
      lines.push(`- ${String(o.title).trim()} — ${o.type || ''}, ${o.location || ''}, ${sectorName(o.sector)}${o.dateLimite ? ` (date limite : ${o.dateLimite})` : ''}${desc ? ` : ${desc}` : ''}`);
    });
  } else {
    lines.push('Aucune offre d\'emploi ouverte actuellement.');
  }
  return lines.join('\n');
}

module.exports = { buildStaticKnowledge, buildDynamicKnowledge };
