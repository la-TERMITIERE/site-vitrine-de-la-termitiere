# Contexte de build : racine du depot (docker build -f chat-proxy/Dockerfile .)
# pour embarquer les donnees du site (secteurs, promotions, offres) dans l'assistant.
FROM node:20-alpine

WORKDIR /app

COPY chat-proxy/package.json chat-proxy/package-lock.json ./
RUN npm ci --omit=dev

COPY chat-proxy/server.js chat-proxy/prompt.js chat-proxy/knowledge.js chat-proxy/infos-entreprise.md ./
COPY site2/js/sector-data.js ./site/js/sector-data.js
COPY site2/data/ ./site/data/

ENV PORT=8083
EXPOSE 8083

CMD ["node", "server.js"]
