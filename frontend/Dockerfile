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

# Enable Corepack so the `pnpm` version pinned in package.json (or the
# default Corepack version, if none is pinned) is the one we use.
RUN corepack enable

WORKDIR /app

# Install dependencies first for better Docker layer caching.
COPY package.json pnpm-lock.yaml ./
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
