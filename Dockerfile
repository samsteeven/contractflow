# syntax=docker/dockerfile:1

# Image de production : l'application compilée, ses seules dépendances d'exécution, un
# utilisateur sans droits. Quatre étapes pour que l'image finale ne contienne ni les sources,
# ni les outils de build, ni les dépendances de développement.

FROM node:24-slim AS base
WORKDIR /app

# Toutes les dépendances : nécessaires pour compiler (TypeScript, Vite).
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Compilation du serveur et des pages (dossier build/).
FROM deps AS build
COPY . .
RUN node ace build

# Dépendances d'exécution seulement.
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Autorité de certification d'Amazon RDS : la connexion à la base est chiffrée ET vérifiée.
FROM base AS rds-ca
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /rds-global-bundle.pem

FROM base AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3333 \
    LOG_LEVEL=info \
    NODE_EXTRA_CA_CERTS=/etc/ssl/rds-global-bundle.pem

COPY --from=rds-ca /rds-global-bundle.pem /etc/ssl/rds-global-bundle.pem
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/build ./

USER node
EXPOSE 3333

# Même sonde que le répartiteur de charge : le serveur répond et la base aussi.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3333)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# Le serveur web par défaut ; le worker lance `node ace queue:work`, les migrations `node ace migration:run --force`.
CMD ["node", "bin/server.js"]
