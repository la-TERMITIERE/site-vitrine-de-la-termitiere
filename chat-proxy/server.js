/* =========================================================
   Assistant IA du site (« Termi ») : FAQ, sante/sport, jeux
   Relaie la conversation du visiteur vers l'API Gemini (Google, offre gratuite)
   et renvoie la reponse en flux (NDJSON : une ligne JSON par morceau).

   Variables d'environnement requises :
     GEMINI_API_KEY (cle gratuite sur https://aistudio.google.com/apikey)
   Optionnelles :
     PORT (defaut 8083)
     CHAT_MODEL (defaut gemini-3.8-flash ; gemini-3.5-flash-lite = plus leger)
     RATE_LIMIT_PER_IP (defaut 30 messages / 10 min par visiteur)
     DAILY_LIMIT (defaut 1000 messages / jour au total, pour rester sous le quota gratuit)
     TRUST_PROXY (defaut 2 : reverse proxy de la plateforme + nginx du site)
     STATIC_DIR (developpement local uniquement : sert aussi le site)
     CHAT_MOCK=1 (developpement local : reponses factices, sans cle API)
   ========================================================= */
const express = require('express');
const { GoogleGenAI, ApiError, ThinkingLevel } = require('@google/genai');
const { ASSISTANT_INSTRUCTIONS } = require('./prompt');
const { buildStaticKnowledge, buildDynamicKnowledge } = require('./knowledge');

const {
  GEMINI_API_KEY,
  PORT = 8083,
  CHAT_MODEL = 'gemini-3.8-flash',
  RATE_LIMIT_PER_IP = '30',
  DAILY_LIMIT = '1000',
  TRUST_PROXY = '2',
  STATIC_DIR,
  CHAT_MOCK,
} = process.env;

const MOCK = CHAT_MOCK === '1';
if (!GEMINI_API_KEY && !MOCK) {
  console.error('GEMINI_API_KEY est obligatoire.');
  process.exit(1);
}

const ai = MOCK ? null : new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Consignes + connaissances stables (identiques a chaque requete)
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
    const reply = `(Mode test) Vous avez écrit : « ${last} ». En production, **Termi** répondra ici grâce à Gemini.`;
    for (const word of reply.split(/(?<= )/)) {
      send({ t: word });
      await new Promise((r) => setTimeout(r, 25));
    }
    send({ done: true });
    res.end();
    return;
  }

  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });

  let sentText = false;
  let finishReason = null;
  try {
    const stream = await ai.models.generateContentStream({
      model: CHAT_MODEL,
      // Gemini nomme le role de l'assistant « model »
      contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      config: {
        systemInstruction: `${STATIC_SYSTEM}\n\n${buildDynamicKnowledge()}`,
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, // reponses rapides pour un chat
        abortSignal: controller.signal,
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        sentText = true;
        send({ t: text });
      }
      const reason = chunk.candidates && chunk.candidates[0] && chunk.candidates[0].finishReason;
      if (reason) finishReason = reason;
    }

    if (!sentText) {
      if (finishReason) console.warn('Reponse vide, finishReason =', finishReason);
      send({ t: "Désolé, je ne peux pas répondre à cette demande. Je peux vous renseigner sur La Termitière, vous donner des conseils santé et sport, ou lancer un petit jeu !" });
    }
    send({ done: true });
  } catch (err) {
    if (controller.signal.aborted) return; // le visiteur a ferme la fenetre
    if (err instanceof ApiError) {
      // 429 = quota gratuit depasse (par minute ou par jour)
      console.error('Erreur API Gemini:', err.status, err.message);
      send({
        error: err.status === 429
          ? "L'assistant est très sollicité en ce moment. Réessayez dans une minute, ou contactez-nous au 96 09 49 49."
          : "L'assistant est momentanément indisponible. Réessayez dans un instant, ou contactez-nous au 96 09 49 49.",
      });
    } else {
      console.error(err);
      send({ error: "L'assistant est momentanément indisponible. Réessayez dans un instant, ou contactez-nous au 96 09 49 49." });
    }
  }
  res.end();
});

// Developpement local uniquement : sert le site pour tester le widget de bout en bout
if (STATIC_DIR) app.use(express.static(STATIC_DIR));

app.listen(PORT, () => {
  console.log(`Assistant IA demarre sur le port ${PORT}${MOCK ? ' (mode test)' : ''} — modele ${CHAT_MODEL}`);
});
