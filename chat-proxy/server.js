/* =========================================================
   Assistant IA du site (« Termi ») : FAQ, sante/sport, jeux
   Relaie la conversation du visiteur vers l'API Claude (Anthropic)
   et renvoie la reponse en flux (NDJSON : une ligne JSON par morceau).

   Variables d'environnement requises :
     ANTHROPIC_API_KEY
   Optionnelles :
     PORT (defaut 8083)
     CHAT_MODEL (defaut claude-opus-5-5)
     CHAT_EFFORT (defaut low : reponses rapides et economiques)
     RATE_LIMIT_PER_IP (defaut 30 messages / 10 min par visiteur)
     DAILY_LIMIT (defaut 3000 messages / jour au total, garde-fou sur la facture)
     TRUST_PROXY (defaut 2 : reverse proxy de la plateforme + nginx du site)
     STATIC_DIR (developpement local uniquement : sert aussi le site)
     CHAT_MOCK=1 (developpement local : reponses factices, sans cle API)
   ========================================================= */
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { ASSISTANT_INSTRUCTIONS } = require('./prompt');
const { buildStaticKnowledge, buildDynamicKnowledge } = require('./knowledge');

const {
  ANTHROPIC_API_KEY,
  PORT = 8083,
  CHAT_MODEL = 'claude-opus-5-5',
  CHAT_EFFORT = 'low',
  RATE_LIMIT_PER_IP = '30',
  DAILY_LIMIT = '3000',
  TRUST_PROXY = '2',
  STATIC_DIR,
  CHAT_MOCK,
} = process.env;

const MOCK = CHAT_MOCK === '1';
if (!ANTHROPIC_API_KEY && !MOCK) {
  console.error('ANTHROPIC_API_KEY est obligatoire.');
  process.exit(1);
}

const client = MOCK ? null : new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// Consignes + connaissances stables : identiques a chaque requete -> mises en cache par l'API.
const STATIC_SYSTEM = `${ASSISTANT_INSTRUCTIONS}\n\n<base_de_connaissances>\n${buildStaticKnowledge()}\n</base_de_connaissances>`;

const MAX_MESSAGES = 30;          // historique conserve (les plus anciens sont ecartes)
const MAX_CHARS_PER_MESSAGE = 1500;
const WINDOW_MS = 10 * 60 * 1000;

/* ---------- Limitation de debit (en memoire, suffisant pour un seul conteneur) ---------- */
const hitsByIp = new Map();
let dailyCount = 0;
let dailyDate = new Date().toISOString().slice(0, 10);

function rateLimited(ip) {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailyDate) { dailyDate = today; dailyCount = 0; }
  if (dailyCount >= Number(DAILY_LIMIT)) return 'daily';

  const hits = (hitsByIp.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= Number(RATE_LIMIT_PER_IP)) { hitsByIp.set(ip, hits); return 'ip'; }
  hits.push(now);
  hitsByIp.set(ip, hits);
  dailyCount += 1;
  return null;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, hits] of hitsByIp) {
    if (!hits.some((t) => now - t < WINDOW_MS)) hitsByIp.delete(ip);
  }
}, WINDOW_MS).unref();

/* ---------- Validation de l'historique envoye par le navigateur ---------- */
function sanitizeMessages(input) {
  if (!Array.isArray(input)) return null;
  const msgs = input
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_CHARS_PER_MESSAGE) }))
    .filter((m) => m.content);

  // Roles strictement alternes, en commencant et finissant par le visiteur
  const clean = [];
  for (const m of msgs) {
    const prev = clean[clean.length - 1];
    if (prev && prev.role === m.role) prev.content = `${prev.content}\n\n${m.content}`.slice(-MAX_CHARS_PER_MESSAGE);
    else clean.push(m);
  }
  let trimmed = clean.slice(-MAX_MESSAGES);
  while (trimmed.length && trimmed[0].role !== 'user') trimmed = trimmed.slice(1);
  if (!trimmed.length || trimmed[trimmed.length - 1].role !== 'user') return null;
  return trimmed;
}

const app = express();
app.set('trust proxy', Number(TRUST_PROXY));
app.use(express.json({ limit: '64kb' }));

app.get('/health', (req, res) => res.send('ok'));

app.post('/api/chat', async (req, res) => {
  const messages = sanitizeMessages(req.body && req.body.messages);
  if (!messages) {
    res.status(400).json({ ok: false, error: 'Conversation invalide.' });
    return;
  }

  const limited = rateLimited(req.ip);
  if (limited) {
    res.status(429).json({
      ok: false,
      error: limited === 'daily'
        ? "L'assistant a atteint sa limite du jour. Revenez demain, ou contactez-nous au 96 09 49 49."
        : 'Vous envoyez beaucoup de messages : patientez quelques minutes avant de réessayer.',
    });
    return;
  }

  res.status(200);
  res.set({
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Accel-Buffering': 'no', // pas de mise en tampon par nginx : le texte s'affiche au fil de l'eau
  });
  const send = (obj) => res.write(`${JSON.stringify(obj)}\n`);

  if (MOCK) {
    const last = messages[messages.length - 1].content;
    const reply = `(Mode test) Vous avez écrit : « ${last} ». En production, **Termi** répondra ici grâce à Claude.`;
    for (const word of reply.split(/(?<= )/)) {
      send({ t: word });
      await new Promise((r) => setTimeout(r, 25));
    }
    send({ done: true });
    res.end();
    return;
  }

  let sentText = false;
  const stream = client.beta.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 4096,
    output_config: { effort: CHAT_EFFORT },
    // En cas de refus par les filtres de securite, l'API relance automatiquement sur le modele de repli recommande
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [
      { type: 'text', text: STATIC_SYSTEM, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: buildDynamicKnowledge() },
    ],
    messages,
  });

  res.on('close', () => { if (!res.writableEnded) stream.abort(); });

  stream.on('text', (delta) => {
    sentText = true;
    send({ t: delta });
  });

  try {
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal' && !sentText) {
      send({ t: "Désolé, je ne peux pas répondre à cette demande. Je peux vous renseigner sur La Termitière, vous donner des conseils santé et sport, ou lancer un petit jeu !" });
    }
    send({ done: true });
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError) return; // le visiteur a ferme la fenetre
    if (err instanceof Anthropic.RateLimitError) {
      console.error('Limite de debit API Anthropic atteinte');
    } else if (err instanceof Anthropic.APIError) {
      console.error('Erreur API Anthropic:', err.status, err.message);
    } else {
      console.error(err);
    }
    send({ error: "L'assistant est momentanément indisponible. Réessayez dans un instant, ou contactez-nous au 96 09 49 49." });
  }
  res.end();
});

// Developpement local uniquement : sert le site pour tester le widget de bout en bout
if (STATIC_DIR) app.use(express.static(STATIC_DIR));

app.listen(PORT, () => {
  console.log(`Assistant IA demarre sur le port ${PORT}${MOCK ? ' (mode test)' : ''} — modele ${CHAT_MODEL}`);
});
