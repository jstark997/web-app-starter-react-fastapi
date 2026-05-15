# web-app-starter-react-fastapi

A monorepo starter pairing a **React + Vite + Tailwind** frontend with a **FastAPI + async SQLAlchemy** backend. Designed to run locally with one command and to deploy to Railway as two services with **Caddy bundled into the frontend** as a reverse proxy.

The two halves originated as standalone starters (`react-starter`, `fastapi-starter`) and remain documented as such in their subdirectories. This repo wires them together for a single coherent project.

## Layout

```
web-app-starter-react-fastapi/
├── frontend/         # React 19 + Vite 8 + Tailwind 4 + TypeScript (pnpm)
│   ├── Dockerfile    # Vite build → Caddy runtime (used by Railway)
│   ├── Caddyfile     # Serves dist/ + proxies /api/* to backend
│   └── ...
├── backend/          # FastAPI + async SQLAlchemy + Alembic (Python 3.12)
│   ├── railway.json  # Railpack builder + preDeploy alembic + start cmd
│   ├── .python-version
│   └── ...
├── docs/app/         # Product-specific specs (separate from starter specs)
├── Makefile          # Top-level dev targets
├── README.md         # ← you are here
└── .gitignore
```

For stack-specific architecture, conventions, and feature specs, see [`frontend/README.md`](./frontend/README.md), [`frontend/CLAUDE.md`](./frontend/CLAUDE.md), [`frontend/STARTER-SPEC.md`](./frontend/STARTER-SPEC.md), [`backend/README.md`](./backend/README.md), [`backend/CLAUDE.md`](./backend/CLAUDE.md), and [`backend/STARTER-API-SPEC.md`](./backend/STARTER-API-SPEC.md). Product-specific specs for the app you're building on top of this starter live in [`docs/app/`](./docs/app/README.md).

---

## Prerequisites

| Tool       | Version                                  |
|------------|------------------------------------------|
| Python     | 3.12 (pinned in `backend/.python-version`) |
| Node.js    | 20.19+ or 22.12+ (Vite 8 requirement)    |
| pnpm       | 10.8.1 (pinned via `packageManager` in `frontend/package.json` — Corepack installs the right version automatically) |
| make       | any POSIX make (macOS / Linux / WSL)     |

---

## Local development

### One-time setup

```bash
# 1. Backend env
cp backend/.env.example backend/.env
# For local dev you can leave EMAIL_PROVIDER=mock to skip real email config.

# 2. Frontend env
cp frontend/.env.example frontend/.env.local
# Default VITE_API_BASE_URL=http://localhost:8000 works as-is.

# 3. Install both stacks (creates venv, runs migrations, installs node deps)
make install
```

### Run both services

```bash
make dev
```

This starts the backend on `http://localhost:8000` and the frontend on `http://localhost:5173` in the same terminal. Logs interleave on one stream. **Ctrl+C** stops both.

If you'd rather have separate log streams, run them in two terminals:

```bash
# Terminal 1
make dev-backend

# Terminal 2
make dev-frontend
```

### Other targets

```bash
make test           # pytest + vitest
make test-backend   # backend only
make test-frontend  # frontend only
make build          # production build of the frontend (dist/)
make lock-backend   # regenerate backend requirements*.txt (hashed) from .in files
make audit          # pip-audit + pnpm audit (matches CI)
make clean          # remove venv, node_modules, dist, caches
make help           # list targets
```

---

## Security & dependency hygiene

- Backend dependencies are **hash-pinned**. `backend/requirements.txt` and `backend/requirements-dev.txt` are generated from `backend/requirements.in` and `backend/requirements-dev.in` via `pip-compile --generate-hashes`. Every line carries a SHA-256, and `pip install --require-hashes` (used by `make install-backend`) refuses any package that doesn't match. **Never edit the `.txt` files by hand** — use `make lock-backend` instead. See [`backend/README.md`](./backend/README.md#adding-or-upgrading-a-dependency) for the dep-add workflow.
- Frontend dependencies are content-addressed via `pnpm-lock.yaml` and installed with `pnpm install --frozen-lockfile`. The pnpm binary version is pinned via the `packageManager` field in [`frontend/package.json`](./frontend/package.json) so CI, Docker, and local dev resolve to the exact same release. See [`frontend/CLAUDE.md`](./frontend/CLAUDE.md#upgrading-pnpm) for the upgrade procedure.
- CI ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)) runs `pip-audit` and `pnpm audit --audit-level=high --prod` on every PR, every push to `main`, and **every Monday at 12:00 UTC** (weekly cron) so newly-disclosed CVEs against the locked versions are surfaced even when nothing has been pushed.

---

## Deployment to Railway

The deployment topology is **two services in one Railway project**, both pointed at this repo with different root directories:

```
                       ┌────────────────────────────────────────┐
                       │  Railway project                       │
                       │                                        │
   user (HTTPS) ──────►│  ┌───────────────────────────────┐    │
                       │  │ Service: frontend             │    │
                       │  │ Builder: Dockerfile           │    │
                       │  │  ┌────────────┐               │    │
                       │  │  │ Caddy      │               │    │
                       │  │  │   /api/* ──┼──┐            │    │
                       │  │  │   /*    ──►│  │            │    │
                       │  │  │   (dist)   │  │            │    │
                       │  │  └────────────┘  │            │    │
                       │  └──────────────────┼────────────┘    │
                       │                     │ private network  │
                       │  ┌──────────────────▼────────────┐    │
                       │  │ Service: backend              │    │
                       │  │ Builder: Railpack             │    │
                       │  │   uvicorn :8080 (private)     │    │
                       │  └──────────────────┬────────────┘    │
                       │                     │                  │
                       │  ┌──────────────────▼────────────┐    │
                       │  │ Plugin: PostgreSQL            │    │
                       │  └───────────────────────────────┘    │
                       └────────────────────────────────────────┘
```

Why this shape: same public origin → no CORS, no cross-site cookies, no leaked backend URL. The backend is reachable only through Caddy.

### One-time Railway setup

1. **Create a Railway project** and connect it to this Git repo.
2. **Add a PostgreSQL plugin.** Railway will inject `DATABASE_URL` into any service you attach it to.
3. **Create the `backend` service.**
   - Source: this repo, **Root Directory = `backend`**.
   - Builder: Railpack (auto-detected; pinned in `backend/railway.json`).
   - Attach the PostgreSQL plugin.
   - The service must be named **`backend`** so Caddy can reach it at `backend.railway.internal` (or rename it and update `frontend/Caddyfile` to match).
   - Do **not** generate a public domain — the backend stays private.
4. **Create the `frontend` service.**
   - Source: this repo, **Root Directory = `frontend`**.
   - Builder: auto-detected as Dockerfile.
   - Generate a public domain — this is the user-facing URL.

### Backend service env vars

| Variable                  | Value                                                          | Notes                                                                 |
|---------------------------|----------------------------------------------------------------|-----------------------------------------------------------------------|
| `PORT`                    | `8080`                                                         | Must match the port in `frontend/Caddyfile`'s `reverse_proxy` line.   |
| `ENVIRONMENT`             | `production`                                                   | Required. Enables two startup checks: (1) `DATABASE_URL` must be `postgresql://` — guards against silent SQLite fallback; (2) `FRONTEND_URL` must be an `https://` URL that doesn't contain `localhost` or `127.0.0.1` — guards against email links pointing at your laptop. |
| `DATABASE_URL`            | *(auto-injected by Postgres plugin)*                           | App rewrites `postgresql://` → `postgresql+asyncpg://` automatically. |
| `FRONTEND_URL`            | `https://<frontend-service>.up.railway.app`                    | Required. Used in outgoing email verification and password-reset links. App refuses to boot in production if this is missing or localhost. |
| `ALLOWED_ORIGINS`         | `https://<frontend-service>.up.railway.app`                    | Same-origin in this topology, but keep set as a safety net.           |
| `SESSION_COOKIE_SECURE`   | `true`                                                         | Required in prod (HTTPS).                                             |
| `SESSION_COOKIE_SAMESITE` | `lax`                                                          | Same-origin via Caddy means `lax` is correct.                         |
| `EMAIL_PROVIDER`          | `smtp` / `resend` / `mock`                                     | Plus the matching provider creds (see `backend/.env.example`).        |
| `RATE_LIMIT_ENABLED`      | `true`                                                         |                                                                       |
| `LOG_FORMAT`              | `json`                                                         | Emits one structured JSON line per log record so security events (e.g. `event=auth.login.failure`) can be filtered in Railway's log explorer. See [`backend/STARTER-API-SPEC.md` §6.6](./backend/STARTER-API-SPEC.md#66-security-event-logging) for the full event schema. |
| `ADMIN_*` (optional)      | seed an admin on first deploy                                  | See `backend/.env.example`.                                           |

The `backend/railway.json` already wires up:
- **Builder:** Railpack
- **Pre-deploy:** `alembic upgrade head` (runs in a separate container; if it fails, the new version is not deployed)
- **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"` (the proxy flags let uvicorn trust Caddy's `X-Forwarded-*` headers)

### Frontend service env vars

The frontend image bakes the Vite build at Docker build time, but **`VITE_API_BASE_URL` is intentionally left unset** in production: `src/api/client.ts` falls back to `''` so all fetches go to relative `/api/*` paths, which Caddy then proxies to the backend.

So: **no env vars are required on the Railway frontend service** for routing to work. (Set any frontend feature flags here as needed.)

### Deploy order

Deploy the **backend first** (so its private hostname `backend.railway.internal` exists), then the **frontend**. After the first frontend deploy, Railway will rebuild both on subsequent pushes.

### Verifying the deploy

- `https://<frontend>.up.railway.app/health` → `OK` (Caddy's health check).
- `https://<frontend>.up.railway.app/api/health` → `{"status":"ok"}` (proxied to FastAPI).
- Security headers are applied at the Caddy layer (see `frontend/Caddyfile`). To confirm:

  ```bash
  curl -sI https://<frontend>.up.railway.app/ \
    | grep -iE 'content-security-policy|strict-transport|x-content-type|referrer-policy|^server'
  ```

  Expect `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Content-Security-Policy` line, and **no** `Server: Caddy` header. The same headers must appear on `/api/health` and on any static path.
- Open the public URL and try registering a user. If login works, sessions and the proxy chain are all wired correctly.

---

## Project conventions

The frontend and backend each have their own `CLAUDE.md` documenting coding conventions, security rules, and the strict layer separation in the backend (`api/` → `services/` → `models/`). Read those before extending the codebase. The shape of this monorepo deliberately leaves both starters intact and idiomatic — wiring them together is config and proxy, not code.
