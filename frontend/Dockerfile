# =============================================================================
# Frontend image: Vite build → Caddy static server + reverse proxy.
#
# Stage 1 builds the React app with pnpm. Stage 2 is a Caddy image that
# serves dist/ and proxies /api/* to the backend service over Railway's
# private network. See ./Caddyfile for routing rules.
# =============================================================================

# ---- Build stage ------------------------------------------------------------
FROM node:lts-alpine AS build

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

# Enable Corepack so the pnpm version pinned in package.json's
# `packageManager` field is the one we use.
RUN corepack enable

WORKDIR /app

# Install dependencies first for better Docker layer caching.
# pnpm-workspace.yaml carries the `allowBuilds` config (pnpm 11) — it
# must be present at install time so pnpm knows which package build
# scripts are approved or denied.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build. VITE_API_BASE_URL is intentionally not passed
# as a build arg — at runtime the frontend calls /api/* relative paths
# (see src/api/client.ts) and Caddy proxies them to the backend.
COPY . .
RUN pnpm build

# ---- Runtime stage ----------------------------------------------------------
FROM caddy:alpine

WORKDIR /app

COPY Caddyfile ./
RUN caddy fmt Caddyfile --overwrite

COPY --from=build /app/dist ./dist

# Caddy reads $PORT (set by Railway) to know which port to listen on.
CMD ["caddy", "run", "--config", "Caddyfile", "--adapter", "caddyfile"]
