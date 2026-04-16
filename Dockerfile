# ============================================================
# STAGE 1: Dependencias + Build completo
# ============================================================
FROM node:22-alpine AS builder

# pnpm via corepack
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copiar manifiestos primero (mejor cache de capas)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json         ./apps/api/package.json
COPY apps/web/package.json         ./apps/web/package.json

# Instalar TODAS las dependencias (dev incluidas para el build)
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Copiar el código fuente
COPY packages/shared ./packages/shared
COPY apps/api        ./apps/api
COPY apps/web        ./apps/web

# Build 1: shared (lo necesitan los otros dos)
RUN pnpm --filter @menu-bar/shared build

# Build 2: web (Vite → dist estático)
RUN pnpm --filter web build

# Build 3: API (tsc → JS)
RUN pnpm --filter api build

# ============================================================
# STAGE 2: Despliegue standalone de la API con pnpm deploy
# ============================================================
FROM node:22-alpine AS deployer

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copiar todo el workspace para que pnpm deploy pueda leer el grafo
COPY --from=builder /app ./

# pnpm deploy crea /deploy/api con sólo las deps de producción de la API
# y el contenido del paquete (incluyendo workspace deps inlineadas)
RUN pnpm --filter api deploy --prod /deploy/api

# ============================================================
# STAGE 3: Runtime — imagen final mínima
# ============================================================
FROM node:22-alpine AS runtime

ENV NODE_ENV=production
# Las tres variables de entorno de paths — coinciden con la estructura Docker
ENV STORAGE_DIR=/app/storage
ENV WEB_DIST_DIR=/app/web-dist
ENV ASSETS_DIR=/app/assets

WORKDIR /app

# API: deps de producción + código compilado (de pnpm deploy)
COPY --from=deployer /deploy/api/node_modules ./node_modules
COPY --from=deployer /deploy/api/dist          ./dist

# Frontend estático servido por Fastify en producción
COPY --from=builder /app/apps/web/dist ./web-dist

# Assets de fondo (imágenes estáticas)
COPY assets ./assets

# Storage vacío — se monta como volumen en Coolify
RUN mkdir -p storage/temp storage/public_pages storage/fonts/cache

EXPOSE 3001

# Coolify usa este endpoint para el health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/server.js"]
