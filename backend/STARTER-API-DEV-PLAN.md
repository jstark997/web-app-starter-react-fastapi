# fastapi-starter — Backend Development Plan

## Overview

This plan breaks the implementation of `fastapi-starter` into discrete phases. Phases marked **[Human]** must be completed by the developer manually — they involve interactive shell commands, environment setup, or decisions that cannot be delegated to Claude Code. All other phases are intended for a single Claude Code session.

Phases build on each other — complete them in order. Do not carry failing tests or broken imports into the next phase.

The authoritative feature and API reference is `STARTER-API-SPEC.md`. When starting a Claude Code session for any phase, instruct Claude Code to read both `CLAUDE.md` and `STARTER-API-SPEC.md` before writing any code.

---

## Phase 0 — Project Initialisation [Human]

**Goal:** Create the project directory, Python virtual environment, and install all dependencies before Claude Code writes a single line of application code.

**Steps:**

```bash
# Create the project directory
mkdir fastapi-starter
cd fastapi-starter

# Create and activate virtual environment
python3.12 -m venv .venv
source .venv/bin/activate   # macOS/Linux
# .venv\Scripts\activate    # Windows

# Install all dependencies upfront
pip install \
  fastapi \
  uvicorn[standard] \
  sqlalchemy[asyncio] \
  aiosqlite \
  asyncpg \
  alembic \
  bcrypt \
  pydantic[email] \
  pydantic-settings \
  python-multipart \
  httpx \
  pytest \
  pytest-asyncio \
  pytest-cov

# Freeze dependencies
pip freeze > requirements.txt
```

**Create `pyproject.toml`:**

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.coverage.run]
source = ["app"]
omit = ["tests/*"]

[tool.coverage.report]
fail_under = 80
```

**Initialise git:**

```bash
git init
```

**Create `.gitignore`:**

```
.venv/
__pycache__/
*.pyc
*.pyo
.env
.env.local
dev.db
.coverage
htmlcov/
dist/
*.egg-info/
```

**Create the folder structure:**

```bash
mkdir -p app/api \
         app/core/email_providers \
         app/dependencies \
         app/models \
         app/schemas \
         app/services \
         alembic/versions \
         tests
touch app/__init__.py \
      app/api/__init__.py \
      app/core/__init__.py \
      app/core/email_providers/__init__.py \
      app/dependencies/__init__.py \
      app/models/__init__.py \
      app/schemas/__init__.py \
      app/services/__init__.py \
      tests/__init__.py
```

**Create `.env.example`** — populate with all variables from `STARTER-API-SPEC.md` section 9.

**Commit:**
```bash
git add .
git commit -m "chore: initialise fastapi-starter project structure"
```

---

## Phase 1 — Configuration & Database Foundation

**Goal:** Establish the application settings, database connection, and all SQLAlchemy models. No routes. No business logic. Pure infrastructure.

**Files to produce:**

```
app/core/config.py         # Pydantic Settings class — all env vars
app/core/database.py       # Async SQLAlchemy engine, session factory, Base
app/models/user.py         # User ORM model
app/models/session.py      # Session ORM model
app/models/token.py        # Token ORM model (email_verification + password_reset)
app/models/whitelist.py    # WhitelistSettings and WhitelistEntry ORM models
app/models/__init__.py     # Import all models so Alembic can discover them
app/main.py                # Minimal FastAPI app — no routes yet, just startup
```

**Key decisions for Claude Code:**
- `config.py` uses `pydantic-settings` `BaseSettings`. All variables from `STARTER-API-SPEC.md` section 9 must be present with appropriate types and defaults.
- `database.py` creates an async engine using `DATABASE_URL`. Provide a `get_db` async generator dependency for use in route handlers.
- All models inherit from a shared `Base = declarative_base()` in `database.py`.
- UUIDs are used as primary keys on all models except `WhitelistSettings` (which uses integer `id = 1`).
- All `DateTime` columns store UTC and use `server_default=func.now()` where appropriate.
- `User.email` and `WhitelistEntry.email` are lowercase-normalised via a `@validates` decorator.
- `User.display_name` defaults to `first_name + " " + last_name` if not explicitly set — handle this in the service layer, not the model.
- `Token.token_type` uses a Python `Enum` mapped to a SQLAlchemy `Enum` column.
- `app/main.py` creates the FastAPI app, configures CORS from settings, and includes a `/api/health` endpoint returning `{"status": "ok"}` — used to verify the app starts correctly.

**Completion checklist:**
- [ ] `python -c "from app.core.config import settings; print(settings)"` runs without error
- [ ] `python -c "from app.models import User, Session, Token, WhitelistSettings, WhitelistEntry"` imports cleanly
- [ ] `uvicorn app.main:app --reload` starts without error
- [ ] `GET /api/health` returns `{"status": "ok"}`

**Commit:** `feat(config): add settings, database, and ORM models`

---

## Phase 2 — Alembic Migrations [Human]

**Goal:** Initialise Alembic and generate the initial migration from the models created in Phase 1. This requires interactive shell commands and human verification of the generated migration file.

**Steps:**

```bash
# Initialise Alembic
alembic init alembic
```

**Edit `alembic/env.py`** to:
- Import `settings` from `app.core.config` and set `config.set_main_option("sqlalchemy.url", settings.database_url)` (note: lowercase attribute name, matching the Pydantic Settings field).
- Import `Base` from `app.core.database` and set `target_metadata = Base.metadata`.
- Import `app.models` so all ORM models are registered on `Base.metadata` before autogenerate runs (`import app.models  # noqa: F401`).
- Configure async support: replace the synchronous `run_migrations_online()` with an async version using `async_engine_from_config`, `connection.run_sync()`, and `asyncio.run()` (required because the database URL uses the `aiosqlite` async driver).

**Edit `alembic.ini`** to remove the hardcoded `sqlalchemy.url` line (it is set programmatically in `env.py`).

**Generate and review the initial migration:**

```bash
alembic revision --autogenerate -m "initial schema"
```

Open `alembic/versions/<hash>_initial_schema.py` and verify all five tables are present: `users`, `sessions`, `tokens`, `whitelist_settings`, `whitelist_entries`.

**Apply the migration:**

```bash
alembic upgrade head
```

Verify the database was created:

```bash
sqlite3 dev.db ".tables"
# Should list: users sessions tokens whitelist_settings whitelist_entries
```

**Commit:**
```bash
git add .
git commit -m "chore(db): initialise alembic and add initial schema migration"
```

---

## Phase 3 — Core Security & Email Foundation

**Goal:** Implement the security utilities (password hashing, token generation) and the provider-agnostic email system defined in `STARTER-API-SPEC.md` section 7.

**Files to produce:**

```
app/core/security.py                      # Password hashing and token generation
app/core/email.py                         # EmailProvider ABC + send_* helper functions
app/core/email_providers/smtp.py          # SMTPEmailProvider (default implementation)
app/core/email_providers/mock.py          # MockEmailProvider (for tests)
```

**Key decisions for Claude Code:**
- `security.py` provides:
  - `hash_password(plain: str) -> str` — `bcrypt.hashpw` with a freshly generated salt
  - `verify_password(plain: str, hashed: str) -> bool` — `bcrypt.checkpw` (constant-time comparison)
  - `generate_token() -> str` — `secrets.token_urlsafe(32)`
- `email.py` defines:
  - `EmailProvider` ABC with a single abstract `async def send(to, subject, html_body, text_body)` method
  - `send_verification_email(provider, to_email, verification_url)`
  - `send_password_reset_email(provider, to_email, reset_url)`
  - `send_invitation_email(provider, to_email, setup_url)`
  - `send_email_change_verification_email(provider, to_email, verification_url)`
- `SMTPEmailProvider` implements `EmailProvider` using Python's `smtplib` and the SMTP settings from `config.py`.
- `MockEmailProvider` stores sent messages in `self.sent: list[dict]` for test assertions. It never raises and never makes network calls.
- `app/main.py` is updated to instantiate the correct `EmailProvider` based on `settings.EMAIL_PROVIDER` and make it available via FastAPI dependency injection.

**Completion checklist:**
- [ ] `hash_password` and `verify_password` round-trip correctly (unit tested)
- [ ] `generate_token` returns a string of expected length (unit tested)
- [ ] `MockEmailProvider.send()` appends to `self.sent` (unit tested)
- [ ] `EmailProvider` cannot be instantiated directly (abstract)
- [ ] `pytest tests/` passes

**Commit:** `feat(core): add security utilities and provider-agnostic email system`

---

## Phase 4 — Authentication Dependencies & Session Management

**Goal:** Implement the FastAPI dependency injection layer for authentication and the session service. These are the gatekeepers used by every protected endpoint.

**Files to produce:**

```
app/services/session.py         # Session CRUD: create, get, invalidate, invalidate_all
app/dependencies/auth.py        # get_current_user and require_admin dependencies
app/schemas/auth.py             # UserResponse Pydantic schema (shared login/me response)
tests/conftest.py               # Test fixtures: test app, test DB, test users, auth clients
```

**Key decisions for Claude Code:**
- `session.py` service functions:
  - `create_session(db, user_id, remember_me) -> Session` — duration 24h or 30d
  - `get_session(db, session_id) -> Session | None` — returns `None` if expired
  - `invalidate_session(db, session_id) -> None`
  - `invalidate_all_sessions(db, user_id) -> None`
- `get_current_user` reads the `session_id` cookie from the request, calls `get_session`, and returns the `User`. Raises `HTTPException(401)` if absent, expired, or invalid.
- `require_admin` calls `get_current_user` and raises `HTTPException(403)` if `user.role != "admin"`.
- `UserResponse` schema is the shared Pydantic model returned by login, logout, and `GET /api/auth/me`. Field names use camelCase via `model_config = ConfigDict(populate_by_name=True)`.
- `conftest.py` must include:
  - `async_engine` / `async_session` fixtures backed by an in-memory SQLite test database
  - `test_client` — `httpx.AsyncClient` pointed at the test app
  - `test_user` — seeded, verified, active user with role `user`
  - `test_admin` — seeded, verified, active user with role `admin`
  - `auth_client` — test client with active session cookie for `test_user`
  - `admin_client` — test client with active session cookie for `test_admin`
  - `mock_email_provider` — a `MockEmailProvider` instance injected into the app

**Completion checklist:**
- [ ] `create_session` sets correct expiry for both `remember_me=True` and `remember_me=False`
- [ ] `get_session` returns `None` for expired sessions
- [ ] `invalidate_all_sessions` removes all sessions for a user
- [ ] `get_current_user` returns `401` for missing or expired cookie
- [ ] `require_admin` returns `403` for a `user` role
- [ ] All conftest fixtures load without error
- [ ] `pytest tests/` passes

**Commit:** `feat(auth): add session service and authentication dependencies`

---

## Phase 5 — Authentication Endpoints

**Goal:** Implement all authentication endpoints: login, logout, me, register, verify-email, resend-verification, forgot-password, and reset-password.

**Files to produce:**

```
app/services/auth.py        # Auth business logic (register, verify, reset, etc.)
app/api/auth.py             # Auth route handlers
app/schemas/auth.py         # Extended with request schemas (LoginRequest, RegisterRequest, etc.)
tests/test_auth.py          # Tests for all auth endpoints
```

**Key decisions for Claude Code:**
- All route handlers are thin — they validate input via Pydantic, call a service function, and return a response. Business logic lives in `app/services/auth.py`.
- `POST /api/auth/login`:
  - Normalise email to lowercase before lookup.
  - Use `verify_password` — never compare plaintext.
  - Return the same `401` message for "user not found" and "wrong password".
  - Set the `session_id` cookie with correct flags from settings (`HttpOnly`, `SameSite=Lax`, `Secure` if `SESSION_COOKIE_SECURE=true`).
- `POST /api/auth/register`:
  - Check whitelist if `WhitelistSettings.enabled` is `True`.
  - Return `403` with `{"detail": "...", "whitelistRestricted": true}` if blocked.
  - Return `409` if email already exists.
  - Do not auto-login. Send verification email via the injected `EmailProvider`.
- `POST /api/auth/forgot-password` and `POST /api/auth/resend-verification`:
  - Always return `200` — never reveal whether the email exists.
- `POST /api/auth/reset-password`:
  - On success, call `invalidate_all_sessions(db, user.id)`.
- Token verification: check `token.used_at is None` and `token.expires_at > utcnow()`.

**Completion checklist:**
- [ ] Login: valid credentials succeed, wrong password returns `401`, deactivated account returns `401`, unverified email returns `403` with `emailNotVerified`
- [ ] Login: `session_id` cookie is set on the response
- [ ] Login: `rememberMe=true` produces a session with 30-day expiry
- [ ] Register: success sends verification email (assert via `mock_email_provider.sent`)
- [ ] Register: whitelist rejection returns `403` with `whitelistRestricted`
- [ ] Register: duplicate email returns `409`
- [ ] Verify email: valid token sets `email_verified=True` and marks token used
- [ ] Verify email: expired/used token returns `400`
- [ ] Forgot password: always returns `200` regardless of email existence
- [ ] Reset password: updates password hash and invalidates all sessions
- [ ] Logout: deletes session and clears cookie
- [ ] `GET /api/auth/me`: returns user for valid session, `401` for missing/expired session
- [ ] `pytest tests/test_auth.py` passes

**Commit:** `feat(auth): add authentication endpoints`

---

## Phase 6 — Profile Endpoints

**Goal:** Implement all user profile endpoints for the currently authenticated user.

**Files to produce:**

```
app/services/user.py        # Shared user CRUD used by both profile and admin services
app/api/profile.py          # Profile route handlers
app/schemas/user.py         # ProfileResponse, UpdateProfileRequest, ChangeEmailRequest, ChangePasswordRequest
tests/test_profile.py       # Tests for all profile endpoints
```

**Key decisions for Claude Code:**
- `GET /api/profile` returns the full profile including `createdAt` — this field is not returned by the login/me endpoint.
- `PATCH /api/profile` is a partial update — only fields present in the request body are updated. Use Pydantic's `model_fields_set` to determine which fields to apply.
- `POST /api/profile/change-email`:
  - Verify `currentPassword` before proceeding.
  - The user's email does not change immediately — generate an `email_verification` token tied to the new email address and send a verification email to the new address.
  - Store the pending new email somewhere accessible (options: a `pending_email` column on `User`, or encode it in the token record). Document the chosen approach clearly in a code comment.
  - Return `409` if the new email is already in use by another account.
- `POST /api/auth/change-password`:
  - Verify `currentPassword` before proceeding.
  - On success, call `invalidate_all_sessions` excluding the current session so the user stays logged in.

**Completion checklist:**
- [ ] `PATCH /api/profile`: partial update — omitted fields are unchanged
- [ ] `POST /api/profile/change-email`: wrong password returns `400`, duplicate email returns `409`, success sends email to new address
- [ ] `POST /api/auth/change-password`: wrong password returns `400`, other sessions invalidated, current session preserved
- [ ] All endpoints return `401` when called without a valid session
- [ ] `pytest tests/test_profile.py` passes

**Commit:** `feat(profile): add user profile endpoints`

---

## Phase 7 — User Administration Endpoints

**Goal:** Implement all admin-only user management endpoints.

**Files to produce:**

```
app/api/users.py            # User admin route handlers
app/schemas/user.py         # Extended with UserListResponse, CreateUserRequest, UpdateUserRequest
tests/test_users.py         # Tests for all user admin endpoints
```

**Key decisions for Claude Code:**
- All endpoints require `require_admin` — a non-admin returns `403` on every route.
- `GET /api/users`:
  - `search` filters across `email`, `first_name`, `last_name`, and `display_name` using a case-insensitive `ILIKE` (PostgreSQL) or `LIKE LOWER()` (SQLite) pattern.
  - `sortBy` is validated against an allowlist of field names before being passed to SQLAlchemy to prevent SQL injection.
  - Pagination returns `items`, `total`, `page`, `pageSize`, `totalPages`.
- `POST /api/users`:
  - Creates user with `email_verified = False` and a random unusable password hash.
  - If `sendInvitation=True`, generates a `password_reset` token and sends an invitation email.
- `PATCH /api/users/{user_id}`:
  - An admin cannot change their own `role` or `isActive` — return `400`.
  - If `isActive` is set to `False`, call `invalidate_all_sessions` for that user.
- `DELETE /api/users/{user_id}`:
  - An admin cannot delete their own account — return `400`.
  - Call `invalidate_all_sessions` before deletion.
- `POST /api/users/{user_id}/deactivate` and `/reactivate`:
  - Deactivate calls `invalidate_all_sessions`.
  - Both check that the target is not already in the requested state and return `409` if so.
- `POST /api/users/{user_id}/force-password-reset`:
  - Invalidate existing unused `password_reset` tokens for the user before generating a new one.

**Completion checklist:**
- [ ] `GET /api/users`: search, sort, and pagination all work correctly
- [ ] `GET /api/users`: non-admin returns `403`
- [ ] `POST /api/users`: duplicate email returns `409`, invitation email sent when `sendInvitation=True`
- [ ] `PATCH /api/users/{id}`: admin cannot modify their own role or active status
- [ ] `PATCH /api/users/{id}`: deactivation invalidates all target user sessions
- [ ] `DELETE /api/users/{id}`: admin cannot delete self, sessions invalidated before deletion
- [ ] `POST /api/users/{id}/deactivate`: returns `409` if already inactive
- [ ] `POST /api/users/{id}/reactivate`: returns `409` if already active
- [ ] `POST /api/users/{id}/force-password-reset`: prior tokens invalidated, email sent
- [ ] `pytest tests/test_users.py` passes

**Commit:** `feat(admin): add user administration endpoints`

---

## Phase 8 — Whitelist Endpoints

**Goal:** Implement all whitelist management endpoints and integrate whitelist enforcement into the registration flow.

**Files to produce:**

```
app/services/whitelist.py       # Whitelist business logic
app/api/whitelist.py            # Whitelist route handlers
app/schemas/whitelist.py        # WhitelistSettingsResponse, WhitelistEntryResponse, etc.
tests/test_whitelist.py         # Tests for all whitelist endpoints and registration integration
```

**Key decisions for Claude Code:**
- `WhitelistSettings` is a single-row table. On first access, if the row does not exist, create it with `enabled=False`. Use a `get_or_create` pattern in the service.
- `PATCH /api/whitelist/settings`: if the toggle state does not change, return `200` without writing to the database.
- `DELETE /api/whitelist/{entry_id}`:
  - After removing the entry, check `WhitelistSettings.enabled`.
  - If `enabled=True`, look up any user whose `email` matches the removed entry and call `invalidate_all_sessions` for them.
- Registration integration: `POST /api/auth/register` was already written in Phase 5 with a whitelist check. Verify here that it integrates correctly with the whitelist service — no duplicate logic, single source of truth in `app/services/whitelist.py`.

**Completion checklist:**
- [ ] `GET /api/whitelist/settings`: returns `{"enabled": false}` on first call (row auto-created)
- [ ] `PATCH /api/whitelist/settings`: toggle persists correctly
- [ ] `POST /api/whitelist`: success, duplicate returns `409`, invalid email returns `422`
- [ ] `DELETE /api/whitelist/{id}`: sessions invalidated for matching user when whitelist is enabled
- [ ] `DELETE /api/whitelist/{id}`: sessions NOT invalidated when whitelist is disabled
- [ ] Registration blocked when whitelist enabled and email not on list
- [ ] Registration allowed when whitelist enabled and email is on list
- [ ] All endpoints return `403` for non-admin callers
- [ ] `pytest tests/test_whitelist.py` passes

**Commit:** `feat(whitelist): add whitelist management endpoints`

---

## Phase 9 — Rate Limiting

**Goal:** Add rate limiting to the sensitive auth endpoints as specified in `STARTER-API-SPEC.md` section 6.1.

**Files to produce:**

```
app/core/rate_limit.py      # Rate limiting middleware or dependency
```

**Key decisions for Claude Code:**
- Use `slowapi` (a popular FastAPI-compatible rate limiting library). Add it to `requirements.txt`.
- Rate limits are applied per IP address using the `X-Forwarded-For` header (since the app sits behind Caddy) with a fallback to `request.client.host`.
- Apply the following limits per `STARTER-API-SPEC.md` section 6.1:
  - `POST /api/auth/login` — 10/minute
  - `POST /api/auth/register` — 5/minute
  - `POST /api/auth/forgot-password` — 5/minute
  - `POST /api/auth/resend-verification` — 5/minute
  - All other endpoints — 120/minute (global default)
- Rate limiting is disabled entirely when `settings.RATE_LIMIT_ENABLED = False` (used in the test environment).
- Exceeded limits return `429 Too Many Requests`.

**Completion checklist:**
- [ ] Rate limit is enforced on login after 10 requests within 1 minute (tested)
- [ ] Rate limiting is disabled when `RATE_LIMIT_ENABLED=false` — existing tests still pass
- [ ] `pytest tests/` passes with no regressions

**Commit:** `feat(security): add rate limiting to auth endpoints`

---

## Phase 10 — Router Registration & Application Assembly

**Goal:** Register all routers in `app/main.py`, verify the full application assembles correctly, and do a final integration pass across all endpoints.

**Files to produce / update:**

```
app/main.py     # Updated with all routers registered and email provider wired up
```

**Tasks for Claude Code:**
- Register all four routers (`auth`, `profile`, `users`, `whitelist`) in `app/main.py` with the `/api` prefix.
- Wire the `EmailProvider` instance into FastAPI's dependency injection system so all route handlers receive it without importing it directly.
- Verify the `WhitelistSettings` seed row is created on startup if it does not exist (run once in a startup event handler).
- Confirm `GET /api/health` still returns `{"status": "ok"}`.
- Run the full test suite and confirm all tests pass.
- Start the server with `uvicorn app.main:app --reload` and manually verify:
  - `GET /api/health` → `200`
  - `POST /api/auth/register` with a valid body → `201`
  - `POST /api/auth/login` with invalid credentials → `401`
  - `GET /api/auth/me` without a cookie → `401`

**Completion checklist:**
- [ ] All four routers are registered and all endpoints are reachable
- [ ] Email provider is injected correctly — no direct imports of `SMTPEmailProvider` in route handlers
- [ ] `WhitelistSettings` row is created on startup
- [ ] `uvicorn app.main:app --reload` starts with no errors
- [ ] `pytest --cov=app --cov-report=term-missing` meets the 80% coverage threshold
- [ ] Manual smoke test of key endpoints passes

**Commit:** `feat: register all routers and assemble application`

---

## Phase 11 — CLAUDE.md & README [Human + Claude Code]

**Goal:** Write `CLAUDE.md` before the first Claude Code session (human task), then write `README.md` at the end of the project once all details are confirmed (Claude Code task).

### Phase 11a — Write CLAUDE.md [Human]

`CLAUDE.md` must be written by the developer before Phase 1 begins, so Claude Code has the instruction set it needs from the very first session.

It should include:
- What the project is — a standalone FastAPI starter providing authentication and user administration via a REST API
- References to `STARTER-API-SPEC.md` and `STARTER-API-DEV-PLAN.md`
- Full technology stack
- Annotated project structure (directory purposes)
- Coding conventions:
  - Service layer owns all business logic — route handlers must not contain business logic
  - All email sending goes through the injected `EmailProvider` — never import a concrete provider directly in a route or service
  - All `DateTime` values stored and compared in UTC
  - Email addresses always normalised to lowercase before storage or lookup
  - Never log plaintext passwords or tokens
  - `sortBy` values must be validated against an allowlist before use in SQLAlchemy queries
  - Use `model_fields_set` for partial updates
- How to run, test, and apply migrations
- Definition of Done (same gates as the checklist at the end of each phase)

**Commit:** `docs: add CLAUDE.md`

### Phase 11b — Write README.md [Claude Code]

Once the project is fully built and all details are stable, Claude Code writes `README.md`.

**Files to produce:**

```
README.md
```

It must include:
- Project description and purpose — a standalone FastAPI starter for authentication and user administration
- Prerequisites (Python 3.12+, pip)
- Setup instructions (clone, virtualenv, install, env vars, migrations, dev server)
- How to run tests and check coverage
- How to switch email providers
- Environment variable reference (mirroring `.env.example`)
- How to use as a starter (clone and adapt)
- Link to `STARTER-API-SPEC.md` for full API documentation

**Completion checklist:**
- [ ] Setup instructions are accurate when followed from a clean clone
- [ ] Email provider switching is clearly documented
- [ ] All environment variables are documented

**Commit:** `docs: add README`

---

## Phase Summary

| Phase | Who | Focus | Commit Message |
|---|---|---|---|
| 0 | Human | Project initialisation, dependencies, folder structure | `chore: initialise fastapi-starter project structure` |
| 1 | Claude Code | Configuration, database, ORM models | `feat(config): add settings, database, and ORM models` |
| 2 | Human | Alembic initialisation and initial migration | `chore(db): initialise alembic and add initial schema migration` |
| 3 | Claude Code | Security utilities and email provider system | `feat(core): add security utilities and provider-agnostic email system` |
| 4 | Claude Code | Auth dependencies, session service, test fixtures | `feat(auth): add session service and authentication dependencies` |
| 5 | Claude Code | Authentication endpoints | `feat(auth): add authentication endpoints` |
| 6 | Claude Code | Profile endpoints | `feat(profile): add user profile endpoints` |
| 7 | Claude Code | User administration endpoints | `feat(admin): add user administration endpoints` |
| 8 | Claude Code | Whitelist endpoints | `feat(whitelist): add whitelist management endpoints` |
| 9 | Claude Code | Rate limiting | `feat(security): add rate limiting to auth endpoints` |
| 10 | Claude Code | Router registration and application assembly | `feat: register all routers and assemble application` |
| 11a | Human | CLAUDE.md | `docs: add CLAUDE.md` |
| 11b | Claude Code | README.md | `docs: add README` |

---

## Working with Claude Code

**Starting a session:** Always begin with:
> "Please read CLAUDE.md and STARTER-API-SPEC.md before starting."

**Scope per session:** Hand Claude Code one phase at a time. If a phase feels too large, split it — for example Phase 5 could be split into `login/logout/me` in one session and `register/verify/forgot/reset` in another.

**After each phase:** Run `pytest` and verify the server starts before committing. Never carry failing tests or broken imports into the next phase.

**When resuming:** Show Claude Code the files already produced and the remaining checklist items before asking it to continue.

**Human phases:** Phases 0, 2, and 11a cannot be delegated to Claude Code. Complete them fully before starting the next Claude Code phase.
