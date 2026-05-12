# fastapi-starter

A production-ready backend API starter built with **Python 3.12** and **FastAPI**. It provides a complete, reusable foundation for **authentication** and **user administration** that can be cloned as the starting point for any new web application project.

It is the backend half of a two-project starter system. The companion frontend is `react-starter` (TypeScript, React, Tailwind CSS).

## Features

- Session-based authentication with HTTP-only cookies
- Email verification, password reset, and invitation flows
- User profile management (update profile, change email, change password)
- Admin user management (list, search, paginate, create, update, deactivate, delete)
- Optional registration whitelist (toggleable at runtime)
- Provider-agnostic email layer with SMTP, Resend, and mock providers built in
- Rate limiting on sensitive auth endpoints
- Per-account brute-force lockout with exponential backoff and user email notification — see [`API-SPEC.md` §6.7](./API-SPEC.md#67-per-account-brute-force-lockout)
- Structured JSON security event logging (login attempts, admin actions, session invalidations) — see [`API-SPEC.md` §6.6](./API-SPEC.md#66-security-event-logging)
- Async SQLAlchemy 2.x with Alembic migrations
- Pytest test suite with ≥ 80% coverage gate

For the full endpoint reference, error codes, and behavioural rules, see [`API-SPEC.md`](./API-SPEC.md).

---

## Prerequisites

- Python **3.12+**
- `pip` (bundled with Python)
- (Production only) PostgreSQL 14+

---

## Setup

### 1. Clone and create a virtual environment

```bash
git clone <your-repo-url> fastapi-starter
cd fastapi-starter

python3.12 -m venv .venv
source .venv/bin/activate          # macOS / Linux
# .venv\Scripts\activate           # Windows
```

### 2. Install dependencies

```bash
pip install --require-hashes -r requirements.txt -r requirements-dev.txt
```

`requirements.txt` and `requirements-dev.txt` are **generated, hash-pinned** lockfiles — `pip install --require-hashes` refuses any package whose SHA-256 doesn't match the committed file. To add or upgrade a package, see [Adding or upgrading a dependency](#adding-or-upgrading-a-dependency) below.

### 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and at a minimum set:

- `DATABASE_URL` — leave the SQLite default for development, or point at PostgreSQL for production
- `EMAIL_PROVIDER` — set to `mock` for local development if you do not want to send real email
- `FRONTEND_URL` and `ALLOWED_ORIGINS` — adjust if your frontend is not on `http://localhost:5173`

See the [Environment variables](#environment-variables) section below for the full reference.

### 4. Apply migrations

```bash
alembic upgrade head
```

This creates all tables in the configured database.

### 5. Run the development server

```bash
uvicorn app.main:app --reload
```

The API is now available at `http://localhost:8000`. Verify with:

```bash
curl http://localhost:8000/api/health
# {"status":"ok"}
```

Interactive OpenAPI docs are available at `http://localhost:8000/docs`.

---

## Tests

```bash
# Run all tests
pytest

# Run with coverage report
pytest --cov=app --cov-report=term-missing

# Run a specific test file
pytest tests/test_auth.py

# Run in verbose mode
pytest -v
```

The coverage threshold (80%) is enforced via `pyproject.toml` — `pytest --cov` fails below it. The test suite uses an in-memory SQLite database that is created fresh for each test session, and `MockEmailProvider` to capture emails without sending them.

---

## Database migrations

```bash
# Apply all pending migrations
alembic upgrade head

# Generate a new migration after editing models in app/models/
alembic revision --autogenerate -m "describe the change"

# Rollback one migration
alembic downgrade -1
```

---

## Adding or upgrading a dependency

`requirements.txt` and `requirements-dev.txt` are generated and hash-pinned. **Never edit them by hand** — CI's lockfile-drift check will fail the PR, and even if it slips through, pip's hash mode is all-or-nothing globally and the deploy install will refuse.

1. Edit `backend/requirements.in` for production deps, or `backend/requirements-dev.in` for dev/test tools. Pin with `==` for reproducibility.
2. From the repo root, run:
   ```bash
   make lock-backend
   ```
   This regenerates both `.txt` lockfiles with `--hash=sha256:...` entries via `pip-compile --generate-hashes`.
3. Re-install in your venv:
   ```bash
   pip install --require-hashes -r requirements.txt -r requirements-dev.txt
   ```
4. Run tests and audit locally:
   ```bash
   make test-backend
   make audit-backend
   ```
5. Commit **both** the `.in` and `.txt` files together. CI will fail the PR if they're out of sync.

**Gotcha:** pip's hash mode is all-or-nothing globally — once any line in a requirements file has a `--hash=` entry, pip refuses to install any package without one. So `pip install some-package` ad-hoc into the dev venv will fail unless `some-package` is already in the hashed lockfile. This is intentional. Add it through step 1 instead.

---

## Auditing dependencies

```bash
# Run the same audit the CI workflow runs against production deps
make audit-backend
```

This runs `pip-audit --requirement requirements.txt --strict` against the locked versions. It exits non-zero on any advisory.

The CI workflow ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) runs the same command on every PR, every push to `main`, and **every Monday at 12:00 UTC** (weekly cron) so newly-disclosed CVEs surface even when no PR has touched the repo.

### Accepting a known finding

If a CVE is fixed in an unreleased version, or the advisory doesn't apply (e.g. the vulnerable code path isn't reachable), document and ignore it explicitly:

```bash
pip-audit --requirement requirements.txt --strict \
  --ignore-vuln GHSA-xxxx-xxxx-xxxx   # short justification next to the flag
```

Add the same `--ignore-vuln` flag (with a comment explaining why) to the `audit-backend` Makefile target and to the `pip-audit` step in `.github/workflows/ci.yml`. Re-evaluate every ignored finding when bumping the relevant package.

---

## Email providers

The application sends transactional email through a provider abstraction defined in `app/core/email.py`. The active provider is chosen at startup via the `EMAIL_PROVIDER` environment variable:

| Value    | Provider                | When to use                                 |
|----------|-------------------------|---------------------------------------------|
| `smtp`   | `SMTPEmailProvider`     | Default. Works with any SMTP relay (Mailgun, SendGrid, Resend SMTP, etc.) |
| `resend` | `ResendEmailProvider`   | If you prefer the Resend HTTP API          |
| `mock`   | `MockEmailProvider`     | Local development and the test suite — captures messages in memory, never sends |

### Switching provider

1. Set `EMAIL_PROVIDER` in `.env` to `smtp`, `resend`, or `mock`.
2. Provide the credentials required by that provider:
   - `smtp` → `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
   - `resend` → `RESEND_API_KEY`
   - `mock` → no additional configuration
3. Restart the server.

`EMAIL_FROM_ADDRESS` and `EMAIL_FROM_NAME` are used by every provider.

### Adding a new provider

1. Create `app/core/email_providers/<your_provider>.py` and subclass `EmailProvider` from `app/core/email.py`.
2. Implement the async `send(to, subject, html_body, text_body)` method.
3. Add any required env vars to `app/core/config.py` and `.env.example`.
4. Register the new provider name in `app/dependencies/providers.py:get_email_provider()`.

No route handler or service code needs to change — the provider is injected via FastAPI's dependency system.

---

## Admin seeding

If you set all four `ADMIN_*` environment variables, the application will create a default admin user on first startup. This is idempotent: if a user with the configured email already exists, seeding is skipped silently. The seeded user is created with `role=admin`, `is_active=true`, and `email_verified=true`.

```dotenv
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-immediately
ADMIN_FIRST_NAME=Admin
ADMIN_LAST_NAME=User
```

---

## Environment variables

| Variable | Description | Example |
|---|---|---|
| `ENVIRONMENT` | Deployment environment: `development`, `production`, or `test`. When `production`, the app refuses to boot unless `DATABASE_URL` is a `postgresql://` URL **and** `FRONTEND_URL` is an `https://` URL that doesn't contain `localhost` or `127.0.0.1`. | `development` |
| `DATABASE_URL` | SQLAlchemy async database URL | `sqlite+aiosqlite:///./dev.db` |
| `FRONTEND_URL` | Base URL of the frontend, used in email links (no trailing slash). **Required in production** — must be a real `https://` URL or the app will refuse to boot. | `http://localhost:5173` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | `http://localhost:5173` |
| `EMAIL_PROVIDER` | Email provider: `smtp`, `resend`, or `mock` | `smtp` |
| `EMAIL_FROM_ADDRESS` | Sender email address | `noreply@example.com` |
| `EMAIL_FROM_NAME` | Display name for outgoing emails | `My App` |
| `SMTP_HOST` | SMTP server hostname (`smtp` only) | `smtp.mailgun.org` |
| `SMTP_PORT` | SMTP server port (`smtp` only) | `587` |
| `SMTP_USER` | SMTP username (`smtp` only) | `noreply@example.com` |
| `SMTP_PASSWORD` | SMTP password (`smtp` only) | `smtp-password` |
| `RESEND_API_KEY` | Resend API key (`resend` only) | `re_...` |
| `SESSION_COOKIE_SECURE` | Set the `Secure` flag on the session cookie (use `true` in production over HTTPS) | `false` |
| `RATE_LIMIT_ENABLED` | Enable rate limiting on auth endpoints (set `false` in tests) | `true` |
| `LOG_FORMAT` | Log output format: `json` (one structured JSON object per line — recommended for any deployed environment) or `plain` (human-readable, easier to scan locally) | `json` |
| `ADMIN_EMAIL` | Seed admin email — set all four `ADMIN_*` vars to seed | `admin@example.com` |
| `ADMIN_PASSWORD` | Seed admin password | `change-me-immediately` |
| `ADMIN_FIRST_NAME` | Seed admin first name | `Admin` |
| `ADMIN_LAST_NAME` | Seed admin last name | `User` |

The canonical reference with inline comments is [`.env.example`](./.env.example).

---

## Using as a starter

`fastapi-starter` is intended to be cloned and adapted, not depended on as a library:

1. Clone this repository and rename it to your project name. Update `pyproject.toml` and any other references.
2. Replace the git remote with your own.
3. Build your application's domain logic alongside the existing `auth`, `profile`, `users`, and `whitelist` modules — add new routers under `app/api/`, services under `app/services/`, and models under `app/models/`.
4. Generate Alembic migrations for any new models with `alembic revision --autogenerate`.
5. Adjust environment variables, the email provider, and the CORS origin list to match your deployment.

The strict layer separation enforced by `CLAUDE.md` (route handlers → services → models) is the spine of the project — keep it intact and the codebase will stay easy to extend.

---

## Further reading

- [`API-SPEC.md`](./API-SPEC.md) — full API specification: every endpoint, request/response shape, error code, and behavioural rule
- [`API-DEV-PLAN.md`](./API-DEV-PLAN.md) — the phased development plan used to build this starter
- [`CLAUDE.md`](./CLAUDE.md) — coding conventions and project rules (read by Claude Code at session start)
