# fastapi-starter — Backend API Specification

## 1. Overview

`fastapi-starter` is a production-ready backend API starter application built with Python and FastAPI. It provides a complete, reusable foundation for authentication and user administration that can be cloned as the starting point for any new web application project.

It is the backend half of a two-project starter system. The companion frontend is `react-starter` (TypeScript, React, Tailwind CSS).

The API is consumed exclusively by `react-starter` via HTTP. Authentication is session-based using HTTP-only cookies. The backend is the sole authority for all access control decisions — the frontend enforces nothing on its own.

---

## 2. Technology Stack

| Concern | Choice |
|---|---|
| Language | Python 3.12+ |
| Framework | FastAPI |
| Server | Uvicorn |
| ORM | SQLAlchemy 2.x (async) |
| Migrations | Alembic |
| Database (dev) | SQLite |
| Database (prod) | PostgreSQL |
| Password Hashing | bcrypt |
| Email | Provider-agnostic (see Section 7) |
| Session Management | Server-side sessions (database-backed) |
| Validation | Pydantic v2 |
| Testing | Pytest + HTTPX |
| Reverse Proxy | Caddy (handles HTTPS and proxies to Uvicorn) |

---

## 3. Architecture

### 3.1 Project Structure

```
fastapi-starter/
├── app/
│   ├── api/                  # Route handlers, organized by domain
│   │   ├── auth.py           # Authentication endpoints
│   │   ├── users.py          # User admin endpoints
│   │   ├── profile.py        # User profile endpoints
│   │   └── whitelist.py      # Whitelist endpoints
│   ├── core/                 # App-wide configuration and utilities
│   │   ├── config.py         # Settings loaded from environment variables
│   │   ├── database.py       # SQLAlchemy engine, session factory
│   │   ├── security.py       # Password hashing, token generation
│   │   └── email.py          # Email sending utilities
│   ├── dependencies/         # FastAPI dependency injection
│   │   ├── auth.py           # get_current_user, require_admin dependencies
│   │   └── session.py        # Session resolution dependency
│   ├── models/               # SQLAlchemy ORM models
│   │   ├── user.py
│   │   ├── session.py
│   │   ├── token.py          # Email verification and password reset tokens
│   │   └── whitelist.py
│   ├── schemas/              # Pydantic request/response schemas
│   │   ├── auth.py
│   │   ├── user.py
│   │   └── whitelist.py
│   ├── services/             # Business logic layer
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── session.py
│   │   ├── seed.py           # Admin seed on first startup
│   │   └── whitelist.py
│   └── main.py               # FastAPI app instantiation, lifespan, router registration, CORS
├── alembic/                  # Database migrations
│   ├── versions/
│   └── env.py
├── tests/
│   ├── conftest.py           # Shared fixtures (test client, test DB, seeded users)
│   ├── test_auth.py
│   ├── test_users.py
│   ├── test_profile.py
│   ├── test_seed.py
│   └── test_whitelist.py
├── .env.example
├── alembic.ini
├── pyproject.toml
└── requirements.txt
```

### 3.2 Request / Response Pattern

All API responses follow a consistent JSON structure.

**Success response** — the response body is the resource itself or a wrapper where noted:
```json
{ "id": "...", "email": "...", ... }
```

**Paginated list response:**
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "pageSize": 20,
  "totalPages": 5
}
```

**Error response** — all errors use this structure:
```json
{
  "detail": "Human-readable error message"
}
```

**Validation error response** (422 Unprocessable Entity — Pydantic):
```json
{
  "detail": [
    { "loc": ["body", "email"], "msg": "value is not a valid email address", "type": "value_error.email" }
  ]
}
```

### 3.3 Session Management

Sessions are stored server-side in the database. A session ID is issued to the client as an HTTP-only cookie on login.

- **Cookie name:** `session_id`
- **Cookie flags:** `HttpOnly`, `SameSite=Lax`, `Secure` (production only)
- **Default session duration:** 24 hours
- **Extended session duration (Remember Me):** 30 days
- On every authenticated request, the session record is looked up by the cookie value. If absent, expired, or invalidated, the request is rejected with `401`.
- Sessions are stored in the `sessions` table. Each session record references a `user_id`.
- Multiple concurrent sessions per user are supported (e.g. different devices).
- Logout invalidates only the current session. Force-logout (deactivation, whitelist removal) invalidates all sessions for that user.

### 3.4 Database Models

#### User
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | String | Unique, indexed, lowercase-normalised |
| `password_hash` | String | bcrypt hash |
| `first_name` | String | |
| `last_name` | String | |
| `display_name` | String | Defaults to `first_name + last_name` |
| `avatar_url` | String | Nullable |
| `role` | Enum | `admin` or `user` |
| `is_active` | Boolean | Default `true` |
| `email_verified` | Boolean | Default `false` |
| `created_at` | TIMESTAMPTZ | UTC |
| `updated_at` | TIMESTAMPTZ | UTC, auto-updated |

#### Session
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key, used as cookie value |
| `user_id` | UUID | Foreign key → User |
| `expires_at` | TIMESTAMPTZ | UTC |
| `created_at` | TIMESTAMPTZ | UTC |

#### Token
Used for email verification and password reset. One table, distinguished by `token_type`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key → User |
| `token` | String | Cryptographically random, unique, indexed |
| `token_type` | Enum | `email_verification` or `password_reset` |
| `expires_at` | TIMESTAMPTZ | UTC |
| `used_at` | TIMESTAMPTZ | Nullable — set when consumed |
| `created_at` | TIMESTAMPTZ | UTC |

#### WhitelistSettings
A single-row configuration table for the whitelist feature toggle.

| Column | Type | Notes |
|---|---|---|
| `id` | Integer | Always `1` — enforced at application level |
| `enabled` | Boolean | Default `false` |
| `updated_at` | TIMESTAMPTZ | UTC |

#### WhitelistEntry
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | String | Unique, indexed, lowercase-normalised |
| `created_at` | TIMESTAMPTZ | UTC |
| `created_by_id` | UUID | Foreign key → User (the admin who added it) |

### 3.5 Admin Seeding

On first startup, the application can automatically create a default admin user so there is always at least one admin account available. This is configured entirely via environment variables and runs as part of the application lifespan.

**Environment variables** (all four must be set for seeding to occur):

| Variable | Description | Example |
|---|---|---|
| `ADMIN_EMAIL` | Email address for the seed admin | `admin@example.com` |
| `ADMIN_PASSWORD` | Password for the seed admin | `change-me-immediately` |
| `ADMIN_FIRST_NAME` | First name | `Admin` |
| `ADMIN_LAST_NAME` | Last name | `User` |

**Behaviour:**
- If any of the four variables is unset, seeding is skipped silently.
- If a user with the configured email already exists, seeding is skipped (idempotent).
- The seeded user is created with `role = admin`, `is_active = true`, and `email_verified = true`.
- The password is hashed with bcrypt before storage. The plaintext password is never logged.
- If multiple workers start simultaneously and race to create the same user, the database unique constraint on `email` prevents duplicates — the losing worker catches the `IntegrityError` and continues normally.

**Implementation:**
- The seed logic lives in `app/services/seed.py` (`seed_admin_user()`), following the project's strict layer separation.
- It is called from the FastAPI lifespan context manager in `app/main.py` during startup.
- Email is normalised to lowercase before storage.

### 3.6 CORS Configuration

The API allows cross-origin requests from the frontend origin only.

- **Allowed origins:** configured via `ALLOWED_ORIGINS` environment variable (e.g. `http://localhost:5173` in development)
- **Allowed methods:** `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`
- **Allowed headers:** `Content-Type`, `Authorization`
- **Allow credentials:** `true` (required for cookie-based auth)

---

## 4. Authentication & Authorisation

### 4.1 Dependency Injection

Two FastAPI dependencies enforce access control on every protected endpoint:

- **`get_current_user`** — Reads the `session_id` cookie, looks up the session, validates it has not expired, and returns the associated `User`. Returns `401` if the session is missing, expired, or invalid.
- **`require_admin`** — Calls `get_current_user` and additionally checks `user.role == "admin"`. Returns `403` if the user is not an admin.

All protected endpoints declare one of these as a dependency. Endpoints that do not declare either are public.

### 4.2 Password Security

- Passwords are hashed using the `bcrypt` library directly.
- Minimum password length: 8 characters (enforced by Pydantic schema).
- Plaintext passwords are never logged or stored.
- Password comparison uses `bcrypt.checkpw()`, which performs a constant-time comparison to prevent timing attacks.

### 4.3 Token Security

- Email verification and password reset tokens are generated using `secrets.token_urlsafe(32)`.
- Tokens expire after 24 hours.
- Tokens are single-use — once consumed, `used_at` is set and the token is rejected on any subsequent use.
- Expired or used tokens return a `400 Bad Request` with an appropriate message.

---

## 5. API Endpoint Specifications

All endpoints are prefixed with `/api`. The full base path is `/api/<domain>/<resource>`.

---

### 5.1 Authentication Endpoints

#### `POST /api/auth/login`

Authenticates a user and creates a session.

**Auth required:** No

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "secret123",
  "rememberMe": false
}
```

**Success response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "displayName": "Jane Doe",
  "avatarUrl": null,
  "role": "user",
  "isActive": true,
  "emailVerified": true
}
```
Sets `session_id` cookie on the response.

**Behaviour:**
- Unknown email, wrong password, **and** deactivated accounts all return the same generic 401. This prevents an unauthenticated attacker from using login responses to confirm valid `email:password` pairs or to enumerate deactivated accounts.
- An unverified account **can** log in (session is issued and 200 returned). The frontend route guard redirects unverified users to `/verify-pending` until they verify their address, so `emailVerified` is surfaced post-login rather than via a differentiated error response.

**Error responses:**
- `401 Unauthorized` — invalid credentials (covers unknown email, wrong password, and deactivated account; identical message in all cases)
- `429 Too Many Requests` — rate limit exceeded

---

#### `POST /api/auth/logout`

Invalidates the current session.

**Auth required:** Yes (`get_current_user`)

**Request body:** None

**Success response:** `204 No Content`

Clears the `session_id` cookie on the response.

---

#### `GET /api/auth/me`

Returns the currently authenticated user.

**Auth required:** Yes (`get_current_user`)

**Success response:** `200 OK` — same shape as login response

**Error responses:**
- `401 Unauthorized` — no valid session

---

#### `POST /api/auth/register`

Creates a new user account and sends a verification email.

**Auth required:** No

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "secret123",
  "firstName": "Jane",
  "lastName": "Doe"
}
```

**Behaviour:**
- Always returns the same generic `201` response regardless of whether the email is new or already registered. This prevents an unauthenticated attacker from using registration responses to enumerate existing accounts.
- If the email is brand new: create the user (unverified), generate an email verification token, send the verification email.
- If the email is already registered: do **not** create a duplicate user. Send a notification email to the existing address pointing to the sign-in and forgot-password flows.
- If the whitelist feature is enabled and the email is not on the whitelist, return `403` with `"whitelistRestricted": true`. This is a deliberate UX trade-off (see §6.5) and the only non-201 response from this endpoint.
- Do not auto-login. The user must verify their email before they can use the app.

**Success response:** `201 Created`
```json
{ "detail": "Registration successful. Please check your email to verify your account." }
```

**Error responses:**
- `403 Forbidden` — email not on whitelist (`"whitelistRestricted": true` in detail)
- `422 Unprocessable Entity` — validation error (invalid email, password too short)
- `429 Too Many Requests` — rate limit exceeded

---

#### `POST /api/auth/verify-email`

Verifies a user's email address using a token from the verification email.

**Auth required:** No

**Request body:**
```json
{ "token": "abc123..." }
```

**Behaviour:**
- Look up the token. If valid and unused, mark the user's `email_verified = true` and mark the token as used.

**Success response:** `200 OK`
```json
{ "detail": "Email verified successfully." }
```

**Error responses:**
- `400 Bad Request` — token invalid, expired, or already used

---

#### `POST /api/auth/resend-verification`

Resends the email verification link.

**Auth required:** No

**Request body:**
```json
{ "email": "user@example.com" }
```

**Behaviour:**
- Always return `200` regardless of whether the email exists or is already verified, to prevent email enumeration.
- If the user exists and is not verified, invalidate any existing unused verification tokens and issue a new one.

**Success response:** `200 OK`
```json
{ "detail": "If an unverified account with that email exists, a new verification link has been sent." }
```

---

#### `POST /api/auth/forgot-password`

Initiates the password reset flow.

**Auth required:** No

**Request body:**
```json
{ "email": "user@example.com" }
```

**Behaviour:**
- Always return `200` regardless of whether the email exists, to prevent email enumeration.
- If the user exists and is active, invalidate any existing unused reset tokens and issue a new one, then send the reset email.

**Success response:** `200 OK`
```json
{ "detail": "If an account with that email exists, a password reset link has been sent." }
```

---

#### `POST /api/auth/reset-password`

Resets a user's password using a token from the reset email.

**Auth required:** No

**Request body:**
```json
{
  "token": "abc123...",
  "password": "newSecret123"
}
```

**Behaviour:**
- Validate the token. If valid, hash the new password, update the user record, mark the token as used, and invalidate all existing sessions for that user.

**Success response:** `200 OK`
```json
{ "detail": "Password reset successfully." }
```

**Error responses:**
- `400 Bad Request` — token invalid, expired, or already used
- `422 Unprocessable Entity` — password too short

---

### 5.2 Profile Endpoints

#### `GET /api/profile`

Returns the current user's full profile.

**Auth required:** Yes (`get_current_user`)

**Success response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "displayName": "Jane Doe",
  "avatarUrl": null,
  "role": "user",
  "isActive": true,
  "emailVerified": true,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

---

#### `PATCH /api/profile`

Updates the current user's profile fields.

**Auth required:** Yes (`get_current_user`)

**Request body** (all fields optional):
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "displayName": "Janie",
  "avatarUrl": "https://example.com/avatar.png"
}
```

**Success response:** `200 OK` — updated profile (same shape as `GET /api/profile`)

---

#### `POST /api/profile/change-email`

Initiates an email address change. Sends a verification email to the new address.

**Auth required:** Yes (`get_current_user`)

**Request body:**
```json
{
  "newEmail": "newemail@example.com",
  "currentPassword": "secret123"
}
```

**Behaviour:**
- Verify `currentPassword` against the user's stored hash.
- If the new email is already in use by another account, return `409`.
- Generate an email verification token tied to the new email address and send a verification email to it.
- The user's email does not change until the token is consumed via `POST /api/auth/verify-email`.

**Success response:** `200 OK`
```json
{ "detail": "A verification link has been sent to your new email address." }
```

**Error responses:**
- `400 Bad Request` — current password incorrect
- `409 Conflict` — new email already in use

---

#### `POST /api/auth/change-password`

Changes the current user's password.

**Auth required:** Yes (`get_current_user`)

**Request body:**
```json
{
  "currentPassword": "oldSecret123",
  "newPassword": "newSecret456"
}
```

**Behaviour:**
- Verify `currentPassword` against the stored hash.
- Hash and store the new password.
- Invalidate all other active sessions (keep the current session active).

**Success response:** `200 OK`
```json
{ "detail": "Password changed successfully." }
```

**Error responses:**
- `400 Bad Request` — current password incorrect
- `422 Unprocessable Entity` — new password too short

---

### 5.3 User Administration Endpoints

All endpoints in this group require the `require_admin` dependency.

#### `GET /api/users`

Returns a paginated, searchable, sortable list of all users.

**Auth required:** Yes (`require_admin`)

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number |
| `pageSize` | integer | `20` | Items per page (max 100) |
| `search` | string | — | Filter by name or email (case-insensitive, partial match) |
| `sortBy` | string | `createdAt` | Field to sort by: `firstName`, `lastName`, `email`, `role`, `isActive`, `createdAt` |
| `sortOrder` | string | `desc` | `asc` or `desc` |

**Success response:** `200 OK`
```json
{
  "items": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "displayName": "Jane Doe",
      "avatarUrl": null,
      "role": "user",
      "isActive": true,
      "emailVerified": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20,
  "totalPages": 3
}
```

---

#### `GET /api/users/{user_id}`

Returns a single user by ID.

**Auth required:** Yes (`require_admin`)

**Success response:** `200 OK` — single user object (same shape as items in list)

**Error responses:**
- `404 Not Found` — user does not exist

---

#### `POST /api/users`

Creates a new user account (admin-initiated).

**Auth required:** Yes (`require_admin`)

**Request body:**
```json
{
  "email": "newuser@example.com",
  "firstName": "John",
  "lastName": "Smith",
  "role": "user",
  "sendInvitation": true
}
```

**Behaviour:**
- Creates the user with a random temporary password and `email_verified = false`.
- If `sendInvitation` is `true`, sends an invitation email containing a password reset link so the user can set their own password.
- The user cannot log in until they have set their password via the reset link.

**Success response:** `201 Created` — the newly created user object

**Error responses:**
- `409 Conflict` — email already registered

---

#### `PATCH /api/users/{user_id}`

Updates a user's fields.

**Auth required:** Yes (`require_admin`)

**Request body** (all fields optional):
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "displayName": "Johnny",
  "email": "newemail@example.com",
  "role": "admin",
  "isActive": false
}
```

**Behaviour:**
- Any field omitted from the request body is left unchanged.
- If `isActive` is set to `false`, all active sessions for that user are immediately invalidated.
- An admin cannot change their own `role` or `isActive` status.

**Success response:** `200 OK` — updated user object

**Error responses:**
- `400 Bad Request` — admin attempting to modify their own role or active status
- `404 Not Found` — user does not exist
- `409 Conflict` — new email already in use

---

#### `DELETE /api/users/{user_id}`

Permanently deletes a user account.

**Auth required:** Yes (`require_admin`)

**Behaviour:**
- Invalidates all sessions for the user before deletion.
- Cascades to delete all associated sessions, tokens, and whitelist entries created by that user.
- An admin cannot delete their own account.

**Success response:** `204 No Content`

**Error responses:**
- `400 Bad Request` — admin attempting to delete their own account
- `404 Not Found` — user does not exist

---

#### `POST /api/users/{user_id}/deactivate`

Deactivates a user account.

**Auth required:** Yes (`require_admin`)

**Behaviour:**
- Sets `is_active = false`.
- Immediately invalidates all active sessions for that user.
- An admin cannot deactivate their own account.

**Success response:** `200 OK` — updated user object

**Error responses:**
- `400 Bad Request` — admin attempting to deactivate their own account
- `404 Not Found` — user does not exist
- `409 Conflict` — user is already inactive

---

#### `POST /api/users/{user_id}/reactivate`

Reactivates a deactivated user account.

**Auth required:** Yes (`require_admin`)

**Behaviour:**
- Sets `is_active = true`. Does not create a new session — the user must log in again.

**Success response:** `200 OK` — updated user object

**Error responses:**
- `404 Not Found` — user does not exist
- `409 Conflict` — user is already active

---

#### `POST /api/users/{user_id}/force-password-reset`

Sends a password reset email to the specified user.

**Auth required:** Yes (`require_admin`)

**Request body:** None

**Behaviour:**
- Invalidates any existing unused password reset tokens for that user.
- Generates a new password reset token and sends the reset email.

**Success response:** `200 OK`
```json
{ "detail": "Password reset email sent." }
```

**Error responses:**
- `404 Not Found` — user does not exist

---

### 5.4 Whitelist Endpoints

All endpoints in this group require the `require_admin` dependency.

#### `GET /api/whitelist/settings`

Returns the current whitelist feature toggle state.

**Auth required:** Yes (`require_admin`)

**Success response:** `200 OK`
```json
{ "enabled": false }
```

---

#### `PATCH /api/whitelist/settings`

Enables or disables the whitelist feature.

**Auth required:** Yes (`require_admin`)

**Request body:**
```json
{ "enabled": true }
```

**Success response:** `200 OK`
```json
{ "enabled": true }
```

---

#### `GET /api/whitelist`

Returns all whitelisted email addresses.

**Auth required:** Yes (`require_admin`)

**Success response:** `200 OK`
```json
{
  "items": [
    {
      "id": "uuid",
      "email": "allowed@example.com",
      "createdAt": "2024-01-01T00:00:00Z",
      "createdById": "uuid"
    }
  ],
  "total": 5
}
```

---

#### `POST /api/whitelist`

Adds an email address to the whitelist.

**Auth required:** Yes (`require_admin`)

**Request body:**
```json
{ "email": "newuser@example.com" }
```

**Success response:** `201 Created`
```json
{
  "id": "uuid",
  "email": "newuser@example.com",
  "createdAt": "2024-01-01T00:00:00Z",
  "createdById": "uuid"
}
```

**Error responses:**
- `409 Conflict` — email is already on the whitelist
- `422 Unprocessable Entity` — invalid email format

---

#### `DELETE /api/whitelist/{entry_id}`

Removes an email address from the whitelist.

**Auth required:** Yes (`require_admin`)

**Behaviour:**
- Removes the whitelist entry.
- If the whitelist feature is currently **enabled**, immediately invalidates all active sessions for any user whose email matches the removed entry.

**Success response:** `204 No Content`

**Error responses:**
- `404 Not Found` — entry does not exist

---

## 6. Security

### 6.1 Rate Limiting

Rate limiting is applied to sensitive endpoints to mitigate brute-force and abuse:

| Endpoint | Limit |
|---|---|
| `POST /api/auth/login` | 10 requests / minute per IP |
| `POST /api/auth/register` | 5 requests / minute per IP |
| `POST /api/auth/forgot-password` | 5 requests / minute per IP |
| `POST /api/auth/resend-verification` | 5 requests / minute per IP |
| All other endpoints | 120 requests / minute per IP |

Exceeded limits return `429 Too Many Requests`.

**Operational note — scaling to multiple instances:** `slowapi` uses in-memory storage by default, so each backend process tracks its own counters. When deploying multiple application instances behind a load balancer, configure shared storage so the limit is enforced globally across instances:

```python
Limiter(key_func=get_client_ip, storage_uri="redis://host:6379/0", ...)
```

Until then, per-IP limits are effectively `N × <limit>` where `N` is the number of instances.

### 6.2 Input Validation

All request bodies are validated by Pydantic schemas before reaching route handlers. Invalid input returns `422 Unprocessable Entity` with field-level error detail.

Field-level rules:
- `email` — valid email format, normalised to lowercase
- `password` — minimum 8 characters
- `role` — must be `admin` or `user`
- `sortBy` — must be one of the allowed field names
- `pageSize` — maximum 100

### 6.3 Authorisation Enforcement

- Every protected endpoint declares `get_current_user` or `require_admin` as a FastAPI dependency.
- Role checks are never bypassed by the frontend — the backend enforces them independently on every request.
- Admin endpoints return `403 Forbidden` (not `404`) when a non-admin user attempts access, so the existence of admin routes is not concealed.

### 6.4 Cookie Security

- `session_id` cookie is set with `HttpOnly=True` and `SameSite=Lax`.
- In production, `Secure=True` is set so the cookie is only transmitted over HTTPS.
- HTTPS termination is handled by Caddy. The FastAPI application itself may run over HTTP internally, but Caddy enforces HTTPS externally.

### 6.5 Email Enumeration Prevention

The following endpoints always return the same response regardless of whether the provided email exists or is already registered:
- `POST /api/auth/forgot-password`
- `POST /api/auth/resend-verification`
- `POST /api/auth/register` — duplicate emails receive the same generic 201 as new emails. The existing user is notified by email (sent in the background) rather than via a distinguishable HTTP response.

The login endpoint returns the same generic `401 "Invalid email or password"` for unknown email, wrong password, **and** deactivated accounts. Unverified accounts log in successfully (200) and are gated post-login by the frontend, so the login response itself does not leak verification status.

**Deliberate trade-off — `whitelistRestricted`.** When whitelist mode is enabled, `POST /api/auth/register` returns a `403` with `"whitelistRestricted": true` for emails that are not on the whitelist. This leaks whitelist membership for the specific email submitted and is kept intentionally because the frontend renders a different message for that case. Whitelist mode is typically used in private deployments where the membership oracle is acceptable; if it is not, switch the response to a generic 201 and rely on the absence of the verification email as the signal.

### 6.6 Security Event Logging

The application emits a structured event on every security-relevant action. Events are written to the dedicated `app.security` logger and rendered as one JSON object per line by default, so they can be filtered in any log explorer (e.g. Railway's) by the `event` field.

Implementation:
- Logger configuration: `app/core/logging_config.py` (`configure_logging()` + `JsonFormatter`). Output format is selected by the `LOG_FORMAT` env var — `json` (default) or `plain`.
- Event helpers: `app/core/security_log.py`. Each helper wraps `logger.info(<event>, extra={...})` so the payload is structured rather than positional.
- Plaintext passwords and token strings are never logged. Emails and user IDs are.

Every JSON event line includes these base fields:

| Field | Description |
|---|---|
| `timestamp` | ISO-8601 UTC timestamp |
| `level` | Always `INFO` for security events |
| `logger` | Always `app.security` for events in this table |
| `message` | Same value as `event` (kept for compatibility with simple log readers) |
| `event` | Stable event name — use this to filter |

#### Events

| Event | Fired when | Additional fields |
|---|---|---|
| `auth.login.success` | Credentials accepted for a verified, active user; session issued | `user_id`, `ip` |
| `auth.login.unverified` | Credentials accepted for an active user whose email is not yet verified; session issued | `user_id`, `ip` |
| `auth.login.failure` | Login rejected | `email`, `ip`, `reason` (`invalid_credentials` \| `account_deactivated`) |
| `auth.register` | New account created via public registration | `user_id`, `email`, `ip` |
| `auth.register.duplicate_attempt` | Registration attempted for an email that is already registered; existing user notified, no new account created | `email`, `ip` |
| `auth.email_verified` | Email verification token consumed | `user_id` |
| `auth.password_reset.requested` | `forgot-password` request matched a real, active user | `user_id`, `ip` |
| `auth.password_reset.completed` | Password reset token consumed and password updated | `user_id` |
| `auth.password_change` | Authenticated user changed their own password | `user_id` |
| `auth.email_change.requested` | Authenticated user requested an email change | `user_id`, `old_email`, `new_email` |
| `auth.email_change.completed` | Email-change verification token consumed and address swapped | `user_id`, `old_email`, `new_email` |
| `admin.user.created` | Admin created a new user | `actor_id`, `target_id` |
| `admin.user.updated` | Admin patched a user record | `actor_id`, `target_id`, `fields` (sorted list of changed field names) |
| `admin.user.deleted` | Admin deleted a user | `actor_id`, `target_id` |
| `admin.user.deactivated` | Admin set `is_active=false` on a user | `actor_id`, `target_id` |
| `admin.user.reactivated` | Admin set `is_active=true` on a user | `actor_id`, `target_id` |
| `admin.user.force_password_reset` | Admin issued a forced password-reset email | `actor_id`, `target_id` |
| `whitelist.toggled` | Admin enabled or disabled the whitelist | `actor_id`, `enabled` |
| `whitelist.added` | Admin added an email to the whitelist | `actor_id`, `email` |
| `whitelist.deleted` | Admin removed an email from the whitelist | `actor_id`, `email` |
| `session.invalidated` | Sessions deleted (logout, password change, password reset, admin action, whitelist removal) | `user_id`, `reason`, `count` |

`session.invalidated` `reason` values: `logout`, `password_change`, `password_reset`, `admin_deactivated`, `admin_deleted`, `whitelist_removed`. `count` is the number of session rows actually deleted.

#### Sample line

```json
{"timestamp":"2026-05-10T04:46:18.515924+00:00","level":"INFO","logger":"app.security","message":"auth.login.failure","event":"auth.login.failure","email":"attacker@example.com","ip":"203.0.113.42","reason":"invalid_credentials"}
```

#### Adding new events

When adding a security-relevant action (e.g. MFA enrolment, API token issuance), add a corresponding `log_*()` helper to `app/core/security_log.py` with a stable `<domain>.<action>` event name and call it from the service layer after the action commits — never from a route handler. Test with `caplog` using the patterns in `tests/test_security_log.py`.

---

## 7. Email Notifications

### 7.1 Email Events

The backend sends transactional emails for the following events:

| Event | Recipient | Content |
|---|---|---|
| Registration | New user | Email verification link |
| Email change | New email address | Verification link for new address |
| Forgot password | User | Password reset link |
| Admin: force password reset | User | Password reset link |
| Admin: create user with invitation | New user | Invitation with password set link |

All links point to the frontend URL (configured via `FRONTEND_URL` environment variable) with the token as a query parameter. Token links expire after 24 hours. Emails include this expiry information.

---

### 7.2 Provider-Agnostic Architecture

`fastapi-starter` does not couple email delivery to any specific provider or protocol. Different consuming applications may use different providers — Resend, SendGrid, Mailgun, AWS SES, SMTP, or others. The email system is therefore built around an abstract interface that any provider can implement.

#### Abstract Interface

A base class in `app/core/email.py` defines the contract that all email providers must satisfy:

```python
from abc import ABC, abstractmethod

class EmailProvider(ABC):

    @abstractmethod
    async def send(
        self,
        to: str,
        subject: str,
        html_body: str,
        text_body: str,
    ) -> None:
        """Send a transactional email. Raises EmailDeliveryError on failure."""
        ...
```

All application code that sends email calls only this interface — never a provider SDK directly.

#### Concrete Implementations

Each supported provider is a concrete subclass of `EmailProvider`, living in `app/core/email_providers/`:

```
app/core/
├── email.py                        # EmailProvider ABC + send_* helper functions
└── email_providers/
    ├── __init__.py
    ├── smtp.py                     # SMTPEmailProvider — included as the default
    └── resend.py                   # ResendEmailProvider — example implementation
```

The starter ships with `SMTPEmailProvider` as the default implementation, since SMTP works with any provider (including Resend, SendGrid, and Mailgun via their SMTP relay) and requires no provider-specific SDK. This keeps the starter free of third-party email dependencies out of the box.

#### Provider Selection

The active provider is selected at startup via the `EMAIL_PROVIDER` environment variable. The application factory in `app/main.py` reads this variable and injects the appropriate concrete implementation wherever `EmailProvider` is required:

```python
def get_email_provider() -> EmailProvider:
    provider = settings.EMAIL_PROVIDER
    if provider == "smtp":
        return SMTPEmailProvider(settings)
    if provider == "resend":
        return ResendEmailProvider(settings)
    raise ValueError(f"Unknown email provider: {provider}")
```

#### Adding a New Provider

To integrate a new email provider in a consuming application:

1. Create `app/core/email_providers/<provider>.py`.
2. Subclass `EmailProvider` and implement the `send()` method using the provider's SDK or HTTP API.
3. Add the provider's required environment variables to `config.py` and `.env.example`.
4. Register the new provider name in `get_email_provider()`.

No other application code needs to change.

---

### 7.3 Email Templates

Email content is rendered from plain Python string templates. Templates are kept minimal — plain text with an optional simple HTML version. They are not tied to any templating engine (e.g. Jinja2) so the consuming application can adopt whichever approach it prefers.

Each email type has a corresponding helper function in `app/core/email.py` that constructs the subject, text body, and HTML body, then calls `provider.send()`:

```python
async def send_verification_email(
    provider: EmailProvider,
    to_email: str,
    verification_url: str,
) -> None: ...

async def send_password_reset_email(
    provider: EmailProvider,
    to_email: str,
    reset_url: str,
) -> None: ...

async def send_invitation_email(
    provider: EmailProvider,
    to_email: str,
    setup_url: str,
) -> None: ...
```

These functions are the only email-sending entry points called by route handlers and services. They are easily mockable in tests.

---

### 7.4 Testing Email

In the test environment, email delivery is disabled entirely by setting `EMAIL_PROVIDER=mock`. The `MockEmailProvider` implementation captures sent messages in memory rather than delivering them, allowing tests to assert that the correct email was sent without any real network calls or provider credentials:

```python
class MockEmailProvider(EmailProvider):
    def __init__(self):
        self.sent: list[dict] = []

    async def send(self, to, subject, html_body, text_body):
        self.sent.append({"to": to, "subject": subject})
```

The `MockEmailProvider` instance is available as a test fixture so tests can inspect `provider.sent` after triggering an action that sends email.

---

## 8. Testing

The test suite covers unit and integration levels, using a dedicated in-memory SQLite test database that is created and torn down per test session.

**Tools:** Pytest, HTTPX (async test client via `httpx.AsyncClient`).

**Coverage target:** ~80% across lines, functions, and branches. Coverage is enforced as part of the CI test run.

### 8.1 What to Test

**Authentication flows**
- Login: valid credentials, wrong password, non-existent user, deactivated account, unverified email, remember-me session duration.
- Register: success, whitelist rejection, duplicate email, invalid password.
- Email verification: valid token, expired token, already-used token.
- Forgot password / reset password: success, invalid token, expired token, all sessions invalidated after reset.
- Logout: session deleted, cookie cleared.
- `GET /api/auth/me`: valid session, missing session, expired session.

**Profile**
- `PATCH /api/profile`: fields updated, partial update leaves others unchanged.
- `POST /api/profile/change-email`: correct password, wrong password, new email in use.
- `POST /api/auth/change-password`: correct password, wrong password, other sessions invalidated.

**User administration**
- `GET /api/users`: pagination, search filtering, sort order, non-admin returns `403`.
- `POST /api/users`: creates user, sends invitation email, duplicate email returns `409`.
- `PATCH /api/users/{id}`: updates fields, deactivation invalidates sessions, admin cannot modify self.
- `DELETE /api/users/{id}`: deletes user and cascades, admin cannot delete self.
- `POST /api/users/{id}/deactivate`: sets `is_active = false`, invalidates sessions.
- `POST /api/users/{id}/reactivate`: sets `is_active = true`.
- `POST /api/users/{id}/force-password-reset`: sends email, invalidates prior tokens.

**Whitelist**
- Toggle on/off persists correctly.
- Add entry: success, duplicate returns `409`, invalid email returns `422`.
- Remove entry: success, sessions invalidated when whitelist is enabled.
- Registration blocked when whitelist enabled and email not on list.
- Registration allowed when whitelist enabled and email is on list.

### 8.2 Test Fixtures

- `test_client` — an `httpx.AsyncClient` pointed at the test app with a clean test database.
- `test_user` — a seeded, verified, active user with the `user` role.
- `test_admin` — a seeded, verified, active user with the `admin` role.
- `auth_client` — a test client with an active session cookie for `test_user`.
- `admin_client` — a test client with an active session cookie for `test_admin`.

### 8.3 Running Tests

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

---

## 9. Environment Configuration

| Variable | Description | Example |
|---|---|---|
| `ENVIRONMENT` | Deployment environment: `development`, `production`, or `test`. When `production`, the app refuses to boot unless `DATABASE_URL` is a `postgresql://` URL **and** `FRONTEND_URL` is an `https://` URL that doesn't contain `localhost` or `127.0.0.1`. | `development` |
| `DATABASE_URL` | SQLAlchemy database URL | `sqlite+aiosqlite:///./dev.db` |
| `FRONTEND_URL` | Base URL of the frontend (used in email links). **Required in production** — must be a real `https://` URL or the app will refuse to boot. | `http://localhost:5173` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | `http://localhost:5173` |
| `EMAIL_PROVIDER` | Email provider to use: `smtp`, `resend`, `mock` | `smtp` |
| `EMAIL_FROM_ADDRESS` | Sender email address | `noreply@example.com` |
| `EMAIL_FROM_NAME` | Display name for outgoing emails | `My App` |
| `SMTP_HOST` | SMTP server hostname (`smtp` provider only) | `smtp.mailgun.org` |
| `SMTP_PORT` | SMTP server port (`smtp` provider only) | `587` |
| `SMTP_USER` | SMTP username (`smtp` provider only) | `noreply@example.com` |
| `SMTP_PASSWORD` | SMTP password (`smtp` provider only) | `smtp-password` |
| `RESEND_API_KEY` | Resend API key (`resend` provider only) | `re_...` |
| `SESSION_COOKIE_SECURE` | Set cookie `Secure` flag (`true` in production) | `false` |
| `RATE_LIMIT_ENABLED` | Enable/disable rate limiting (disable in tests) | `true` |
| `LOG_FORMAT` | Log output format: `json` (one JSON object per line, recommended for any deployed environment so log explorers can filter by the `event` field) or `plain` (human-readable, easier to scan during local development) | `json` |
| `ADMIN_EMAIL` | Seed admin email (optional — set all four `ADMIN_*` vars to seed) | `admin@example.com` |
| `ADMIN_PASSWORD` | Seed admin password | `change-me-immediately` |
| `ADMIN_FIRST_NAME` | Seed admin first name | `Admin` |
| `ADMIN_LAST_NAME` | Seed admin last name | `User` |

A `.env.example` file is included in the repository with all variables documented.

---

## 10. Out of Scope

The following concerns are explicitly out of scope for `fastapi-starter` and are left to the consuming application:

- OAuth / social login (Google, GitHub, etc.)
- Multi-factor authentication (MFA / TOTP)
- Audit logging beyond the structured security event log described in section 6.6 (e.g. tamper-evident append-only audit trails, durable storage, retention policies)
- File uploads (avatar images are accepted as URLs only)
- WebSockets or real-time features
- Background task queues (e.g. Celery, ARQ)
- Application-specific business logic or endpoints
- API versioning
