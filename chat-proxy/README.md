# Assistant IA « Termi »

Bulle de discussion présente sur toutes les pages du site (en bas à droite). Elle :

- répond aux questions sur La Termitière (FAQ, secteurs, tarifs, horaires, adresses, promotions, offres d'emploi) ;
- donne des conseils généraux santé & sport (sans remplacer un avis médical) ;
- anime des jeux : quiz « Connais-tu La Termitière ? », quiz santé & sport, défi forme du jour, devinettes.

Le modèle utilisé est Gemini (Google), via l'offre **gratuite** de l'API Gemini. Il est appelé uniquement depuis ce service : la clé API ne quitte jamais le serveur.

> ⚠️ Offre gratuite : Google peut utiliser les conversations pour améliorer ses produits, et le nombre de requêtes par minute et par jour est limité (quotas visibles dans Google AI Studio). Ne pas y faire transiter de données sensibles. Si le site grossit, activer la facturation sur le projet Google lève ces deux restrictions.

## Où vit le contenu ?

L'assistant n'a **rien à recopier à la main** : sa base de connaissances est construite à partir de
`site2/js/sector-data.js`, `site2/data/promotions.json` et `site2/data/offres.json`, copiés dans l'image au build.
Modifier un tarif dans `sector-data.js` ou publier une promotion via `/admin` déclenche un redéploiement et l'assistant est à jour.

- Personnalité, périmètre, règles des jeux : `prompt.js`
- Infos générales sur l'entreprise (vision, contacts, réseaux) : `COMPANY_TEXT` dans `knowledge.js`
- Interface (bulle, suggestions) : `site2/js/chatbot.js` et `site2/css/chatbot.css`

## 1. Créer une clé API Gemini (gratuite)

1. Se connecter avec un compte Google sur [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. **Create API key** → la noter.
3. Les quotas gratuits du modèle choisi sont visibles dans AI Studio (onglet *Usage / Rate limits*). Adapter `CHAT_DAILY_LIMIT` pour rester en dessous.

## 2. Configurer le serveur

Dans `deploy/.env` sur le VPS, **avant** de pousser (sinon le conteneur s'arrête au démarrage et le déploiement est annulé) :

```
GEMINI_API_KEY=AIza...
CHAT_MODEL=gemini-3.8-flash    # ou gemini-3.5-flash-lite (plus léger, quotas souvent plus larges)
CHAT_RATE_LIMIT_PER_IP=30      # messages max par visiteur toutes les 10 min
CHAT_DAILY_LIMIT=1000          # messages max par jour (rester sous le quota gratuit)
```

Pas de sous-domaine à créer : le nginx du site relaie `https://latermitiere.com/api/chat` vers le conteneur
`termitiere-chat-proxy` sur le réseau Docker `deploy_default`.

## 3. Tester en local

```bash
cd chat-proxy
npm install
# Mode test : réponses factices, sans clé API — ouvrir http://localhost:8083
CHAT_MOCK=1 STATIC_DIR=../site2 node server.js
# Avec la vraie IA
GEMINI_API_KEY=AIza... STATIC_DIR=../site2 node server.js
```

## 4. Vérifier

`GET /health` doit répondre `ok`.
