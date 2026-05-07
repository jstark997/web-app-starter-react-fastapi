# CLAUDE.md — fastapi-starter

This file is read automatically by Claude Code at the start of every session. Read it fully before writing any code.

## What This Project Is

`fastapi-starter` is a production-ready backend API starter application. It provides a complete, reusable foundation for authentication and user administration that can be cloned as the starting point for any new web application project.

## Key Documents

- **`API-SPEC.md`** — The authoritative API specification. Read this to understand every endpoint, its request/response shape, error codes, and behavioural rules. When in doubt about how something should work, the spec is the source of truth.
- **`API-DEV-PLAN.md`** — The phased development plan. Each phase has a goal, a list of files to produce, key decisions, and a completion checklist.

Always read `API-SPEC.md` before implementing any endpoint or service function.

---

## Third-Party Libraries and APIs

Whenever working with any third-party library, API, or tool used in this project (including but not limited to FastAPI, SQLAlchemy, Alembic, Pydantic, bcrypt, slowapi, and pytest-asyncio), you **must** look up the official documentation before writing code that depends on it. Do not rely on training data — library APIs change between versions and outdated usage causes subtle bugs.

Use the **DocsExplorer** subagent for efficient documentation lookup.

This rule applies to:
- Any library listed in the Technology Stack below
- Any library found in `requirements.txt`
- Any API, service, or tool not part of the Python standard library

---

## Project Structure

The full directory tree is documented in `API-SPEC.md` section 3.1. The purpose of each directory is as follows:

| Directory / File | Purpose |
|---|---|
| `app/api/` | Route handlers only — no business logic |
| `app/core/` | App-wide infrastructure: settings, database, security, email |
| `app/core/email_providers/` | Concrete `EmailProvider` implementations (`smtp`, `mock`, etc.) |
| `app/dependencies/` | FastAPI dependency injection (`get_current_user`, `require_admin`) |
| `app/models/` | SQLAlchemy ORM models — database tables only, no business methods |
| `app/schemas/` | Pydantic request/response schemas |
| `app/services/` | All business logic — the only place decisions and side effects happen |
| `app/main.py` | App factory, router registration, CORS config, startup events |
| `alembic/` | Database migrations |
| `tests/` | Pytest test suite and shared fixtures in `conftest.py` |

---

## Coding Conventions

### Architecture — Strict Layer Separation

The project uses a three-layer architecture. This separation is non-negotiable:

- **`app/api/`** — Route handlers. Responsible for: receiving a request, calling a service function, and returning a response. Route handlers must contain no business logic.
- **`app/services/`** — Business logic. All decisions, validations beyond schema-level, database queries, and side effects (email sending, session invalidation) happen here.
- **`app/models/`** — ORM models. Represent database tables only. No methods beyond simple properties.

```python
# Correct — thin route handler
@router.post("/register", status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db), email_provider: EmailProvider = Depends(get_email_provider)):
    return await auth_service.register(db, email_provider, body)

# Wrong — business logic in route handler
@router.post("/register", status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar():
        raise HTTPException(409, "Email already registered")
    ...
```

### Email Sending

- All email sending goes through the injected `EmailProvider` instance — never import or instantiate a concrete provider (`SMTPEmailProvider`, `ResendEmailProvider`, etc.) directly in a route handler or service.
- Call only the `send_*` helper functions defined in `app/core/email.py`.
- The active provider is selected at startup via `settings.EMAIL_PROVIDER` and injected via FastAPI's dependency system.

```python
# Correct
await send_verification_email(email_provider, user.email, verification_url)

# Wrong
from app.core.email_providers.smtp import SMTPEmailProvider
provider = SMTPEmailProvider(settings)
await provider.send(...)
```

### Database & DateTime

- All `DateTime` values are stored and compared in UTC. Never use naive datetimes. Always use `datetime.now(timezone.utc)` (not `datetime.utcnow()`, which returns a naive value).
- All datetime columns must be declared as `DateTime(timezone=True)` (`TIMESTAMPTZ` in Postgres). Plain `DateTime` will work against SQLite locally but break against Postgres + asyncpg, which rejects tz-aware datetimes when bound to a `TIMESTAMP WITHOUT TIME ZONE` column.
- All database queries use the async SQLAlchemy session (`AsyncSession`). Never use synchronous session methods.
- The `get_db` dependency yields an `AsyncSession` — always use it via `Depends(get_db)`, never instantiate sessions manually in route handlers or services.

### Email Normalisation

- All email addresses must be normalised to lowercase before storage or lookup. Do this at the service layer, not in the route handler or model.

```python
# Correct — in service function
email = body.email.lower()
user = await get_user_by_email(db, email)

# Wrong — relying on database case-insensitivity
user = await get_user_by_email(db, body.email)
```

### Security

- **Never log or store plaintext passwords or tokens.** Only the bcrypt hash is ever persisted. Only the token string is sent to the user — never the raw value after it has been hashed (tokens are not hashed in this project, but they must never appear in logs).
- Use `verify_password` from `app/core/security.py` for all password comparisons — never compare plaintext strings directly.
- `sortBy` query parameters must be validated against an explicit allowlist of field names before being passed to SQLAlchemy. Never interpolate user-supplied strings into queries.

```python
# Correct
ALLOWED_SORT_FIELDS = {"firstName", "lastName", "email", "role", "isActive", "createdAt"}
if sort_by not in ALLOWED_SORT_FIELDS:
    raise HTTPException(400, f"Invalid sortBy value: {sort_by}")

# Wrong
order_col = getattr(User, sort_by)  # user input directly to getattr
```

### Partial Updates

- Use Pydantic's `model_fields_set` to determine which fields were explicitly provided in a `PATCH` request body. Only update those fields — never overwrite fields that were omitted.

```python
# Correct
update_data = body.model_dump(include=body.model_fields_set)
for field, value in update_data.items():
    setattr(user, field, value)

# Wrong
user.first_name = body.first_name  # overwrites with None if field was omitted
```

### Pydantic Schemas

- Request and response schemas use camelCase field names to match the frontend convention. Configure this with `model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)` or explicit `Field(alias=...)`.
- Response schemas must never expose `password_hash` or any internal token values.
- All schemas live in `app/schemas/` — never define inline schemas in route handlers.

### Error Responses

- Use `HTTPException` with the status codes and messages specified in `API-SPEC.md`.
- The `detail` field must be a human-readable string unless the spec specifies additional structured fields (e.g. `whitelistRestricted: true` on registration rejection).
- Do not expose internal error details (stack traces, SQL errors) in responses.

### Admin Self-Protection

Two rules must be enforced at the service layer on every admin action:
- An admin cannot deactivate, delete, or change the role of their own account.
- An admin cannot delete their own account.

Check `current_user.id != target_user_id` before any such operation and raise `HTTPException(400)` if they match.

---

## Authentication & Session Management

Session behaviour, cookie flags, and expiry rules are fully documented in `API-SPEC.md` sections 3.3 and 4.

**Critical implementation notes:**
- The `session_id` cookie must be set with `httponly=True`, `samesite="lax"`, and `secure=settings.SESSION_COOKIE_SECURE`.
- `get_current_user` raises `HTTPException(401)` for a missing, expired, or invalid session — never `403`.
- `require_admin` raises `HTTPException(403)` for an authenticated non-admin — never `401`.
- `invalidate_session(db, session_id)` invalidates one session. `invalidate_all_sessions(db, user_id)` invalidates all sessions for a user. Know which to call — see `API-SPEC.md` for which endpoints require each.

---

## Token Handling

Token security rules are documented in `API-SPEC.md` section 4.3.

**Critical implementation notes:**
- On consumption, set `token.used_at = datetime.now(timezone.utc)` — never delete the token record.
- Before issuing a new token of a given type for a user, invalidate any existing unused tokens of that type first. This prevents accumulation of orphaned tokens.
- Check both conditions: `token.used_at is None` **and** `token.expires_at > datetime.now(timezone.utc)`. A token that passes only one check is still invalid.

---

## Testing

**Tools:** Pytest, HTTPX (`httpx.AsyncClient`), pytest-asyncio.

**Coverage target:** 80% across lines, functions, and branches. Enforced via `pyproject.toml` — `pytest --cov` will fail below this threshold.

**Rules:**
- Write tests alongside every new endpoint or service function — not after the fact.
- All tests use the fixtures defined in `tests/conftest.py`. Never create ad-hoc database sessions or users inside individual test files.
- Email delivery is always mocked in tests via `MockEmailProvider`. Assert on `mock_email_provider.sent` to verify emails were triggered — never assert on real SMTP behaviour.
- Never make real HTTP requests or database connections to external services in tests.
- The test database is an in-memory SQLite instance created fresh for each test session.
- Use `admin_client` for admin-protected endpoints and `auth_client` for user-protected endpoints — never manually set cookies in tests.

**Key fixtures in `conftest.py`** are documented in `API-SPEC.md` section 8.2. Always use them — never create ad-hoc database sessions or users inside individual test files.

---

## Commands

```bash
# Activate virtual environment
source .venv/bin/activate

# Start development server
uvicorn app.main:app --reload

# Run all tests
pytest

# Run tests with coverage report
pytest --cov=app --cov-report=term-missing

# Run a specific test file
pytest tests/test_auth.py

# Run in verbose mode
pytest -v

# Apply all pending migrations
alembic upgrade head

# Generate a new migration after model changes
alembic revision --autogenerate -m "description of change"

# Rollback one migration
alembic downgrade -1
```

---

## Environment Variables

All environment variables are documented in `API-SPEC.md` section 9. Copy `.env.example` to `.env` for local development. Never commit `.env`.

---

## Definition of Done

A phase or feature is complete when:

1. All files listed in the phase plan are produced.
2. All items on the phase completion checklist are checked off.
3. `pytest` passes with zero failures.
4. `pytest --cov=app --cov-report=term-missing` meets the 80% coverage threshold.
5. `uvicorn app.main:app --reload` starts with no errors.
6. There are no bare `except` clauses, no `print()` debug statements, and no `TODO` comments left in production code.
