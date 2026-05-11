# react-starter — Frontend Specification

## 1. Overview

`react-starter` is a production-ready frontend starter application built with TypeScript, React, and Tailwind CSS. It provides a complete, reusable foundation for authentication and user administration that can be cloned as the starting point for any new web application project.

The application communicates with a companion backend (`fastapi-starter`) via a REST API, using HTTP-only cookie-based sessions for authentication. The frontend owns no authentication state beyond what is reflected from the server — all source-of-truth decisions (session validity, user roles, whitelist status) are made by the backend.

---

## 2. Technology Stack

| Concern | Choice |
|---|---|
| Language | TypeScript |
| Framework | React |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| Routing | React Router v7 |
| Form Handling | React Hook Form |
| Validation | Zod |
| HTTP Client | Native `fetch` |
| Notifications | Sonner (toast library) |
| State Management | React Context + `useReducer` (no external state library) |

---

## 3. Architecture

### 3.1 Project Structure

```
react-starter/
├── public/
├── src/
│   ├── api/               # All fetch calls to the backend, organized by domain
│   │   ├── auth.ts
│   │   ├── profile.ts
│   │   ├── users.ts
│   │   └── whitelist.ts
│   ├── components/        # Shared, reusable UI components
│   │   ├── ui/            # Primitive components (Button, Input, Badge, etc.)
│   │   └── layout/        # Layout components (AuthLayout, AppLayout, etc.)
│   ├── context/           # React Context providers
│   │   └── AuthContext.tsx
│   ├── hooks/             # Custom React hooks
│   ├── pages/             # Page-level components, organized by feature
│   │   ├── auth/
│   │   ├── profile/
│   │   └── admin/
│   ├── routes/            # Route definitions and route guards
│   ├── types/             # Shared TypeScript types and interfaces
│   ├── utils/             # Helper functions
│   ├── App.tsx
│   └── main.tsx
├── .env.example
├── index.html
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

### 3.2 Layouts

The application uses two distinct top-level layouts:

- **AuthLayout** — A minimal, centered layout used for all authentication pages (login, register, forgot password, reset password, verify email). No navigation. No sidebar.
- **AppLayout** — The main application shell used for all authenticated pages. Includes a top navigation bar and/or sidebar. Contains role-aware navigation links.

### 3.3 API Communication

All backend communication uses the native `fetch` API wrapped in a thin client module (`src/api/`). Key conventions:

- All requests include `credentials: 'include'` to send HTTP-only session cookies.
- A global response interceptor checks for `401 Unauthorized` responses and redirects the user to the login page, clearing local auth state.
- A global response interceptor checks for `429 Too Many Requests` responses and displays an appropriate toast notification.
- API base URL is configured via environment variable (`VITE_API_BASE_URL`).

### 3.4 Authentication State

A top-level `AuthContext` provides authentication state to the entire application:

```typescript
interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'admin' | 'user';
  isActive: boolean;
  emailVerified: boolean;
}
```

On application load, the context performs a `/api/auth/me` call to hydrate the user from the active session. This is the single source of truth for the current user throughout the app.

---

## 4. Routing & Access Control

### 4.1 Route Guards

Three route guard components control access:

- **`<PublicRoute>`** — Accessible only to unauthenticated users. Redirects authenticated users to the application home page (e.g. `/dashboard`). Used for login, register, forgot password, and reset password pages.
- **`<ProtectedRoute>`** — Accessible only to authenticated users. Redirects unauthenticated users to `/login`.
- **`<AdminRoute>`** — Accessible only to authenticated users with the `admin` role. Redirects non-admin users to the application home page.

### 4.2 Route Map

| Path | Guard | Page |
|---|---|---|
| `/login` | PublicRoute | Login |
| `/register` | PublicRoute | Register |
| `/forgot-password` | PublicRoute | Forgot Password |
| `/reset-password` | PublicRoute | Reset Password |
| `/verify-email` | PublicRoute | Email Verification |
| `/dashboard` | ProtectedRoute | Dashboard (placeholder) |
| `/profile` | ProtectedRoute | My Profile |
| `/profile/change-password` | ProtectedRoute | Change Password |
| `/admin/users` | AdminRoute | User List |
| `/admin/users/:id` | AdminRoute | User Detail |
| `/admin/users/new` | AdminRoute | Create User |
| `/admin/whitelist` | AdminRoute | Whitelist Management |

---

## 5. Feature Specifications

### 5.1 Authentication

#### 5.1.1 Login

- **Page:** `/login`
- **Fields:** Email address, Password, Remember Me (checkbox)
- **Behaviour:**
  - On success, redirect to `/dashboard` (or the originally requested route if the user was redirected from a protected route).
  - On failure, display a non-specific error message: "Invalid email or password."
  - The "Remember Me" option is sent to the backend, which determines session duration.
- **Links:** "Forgot your password?" → `/forgot-password`, "Create an account" → `/register`

#### 5.1.2 Register

- **Page:** `/register`
- **Fields:** First name, Last name, Email address, Password, Confirm password
- **Behaviour:**
  - On success, display a confirmation message instructing the user to check their email. Do not auto-login.
  - If the whitelist feature is enabled and the email is not on the whitelist, display: "Registration is not available for this email address."
  - Client-side validation: password minimum length (8 characters), password confirmation match, valid email format.
- **Links:** "Already have an account? Sign in" → `/login`

#### 5.1.3 Email Verification

- **Page:** `/verify-email`
- **Behaviour:**
  - The page is reached via a tokenized link in the verification email (e.g. `/verify-email?token=...`).
  - On load, the token is automatically extracted from the URL and submitted to the backend.
  - Display a loading state while verification is in progress.
  - On success, display a success message and a link to `/login`.
  - On failure (invalid or expired token), display an error message with an option to request a new verification email.

#### 5.1.4 Forgot Password

- **Page:** `/forgot-password`
- **Fields:** Email address
- **Behaviour:**
  - On submission, always display the same success message regardless of whether the email exists: "If an account with that email exists, a password reset link has been sent."
  - This prevents email enumeration.

#### 5.1.5 Reset Password

- **Page:** `/reset-password`
- **Behaviour:**
  - The page is reached via a tokenized link in the reset email (e.g. `/reset-password?token=...`).
  - **Fields:** New password, Confirm new password.
  - On load, validate that a token is present in the URL. If absent, redirect to `/forgot-password`.
  - On success, display a success message and redirect to `/login` after a short delay.
  - On failure (invalid or expired token), display an error and link to `/forgot-password`.

#### 5.1.6 Logout

- A "Sign Out" action is available in the main application navigation for all authenticated users.
- On click, call the backend logout endpoint, clear local auth state, and redirect to `/login`.

#### 5.1.7 Session Expiration

- All authenticated API calls check for a `401 Unauthorized` response.
- On receiving a `401`, the application clears auth state and redirects to `/login`.
- A toast notification is displayed: "Your session has expired. Please sign in again."

---

### 5.2 User Profile

#### 5.2.1 View & Edit Profile

- **Page:** `/profile`
- **Displays:** Avatar, first name, last name, display name, email address, account role, account status, member since date.
- **Editable fields:** First name, Last name, Display name (optional), Avatar (upload only — JPEG, PNG, WebP, GIF, or SVG; max 2 MB; stored inline as a `data:` URI). Remote-URL avatars are not supported.
- Display name is optional. When not set, the UI falls back to `firstName + ' ' + lastName`.
- Email address changes are handled separately (see 5.2.2).
- On save, display a success toast notification.

#### 5.2.2 Change Email Address

- Initiated from the profile page via a dedicated "Change Email" action.
- **Fields:** New email address, Current password (for verification).
- Uses the profile change-email endpoint (`POST /api/profile/change-email`), not the auth endpoints.
- On submission, the backend sends a verification email to the new address.
- The email address does not change until the new address is verified.
- Display a confirmation message to check the new email inbox.

#### 5.2.3 Change Password

- **Page:** `/profile/change-password`
- **Fields:** Current password, New password, Confirm new password.
- On success, display a success toast and redirect to `/profile`.

---

### 5.3 User Administration (Admin Only)

#### 5.3.1 User List

- **Page:** `/admin/users`
- Displays a paginated, searchable, and sortable table of all users.
- **Columns:** Avatar, Name, Email, Role, Status (Active / Inactive), Member Since, Actions.
- **Search:** Filter by name or email (debounced input, queries backend).
- **Sort:** Sortable by Name, Email, Role, Status, Member Since.
- **Pagination:** Server-side pagination with configurable page size.
- **Actions per row:** View, Edit, Deactivate/Reactivate, Delete, Force Password Reset.
- A "Create New User" button links to `/admin/users/new`.

#### 5.3.2 User Detail

- **Page:** `/admin/users/:id`
- Read-only view of all user fields.
- Includes quick-action buttons: Edit, Deactivate/Reactivate, Force Password Reset, Delete.

#### 5.3.3 Create User

- **Page:** `/admin/users/new`
- **Fields:** First name, Last name, Email address, Role, Send invitation email (checkbox).
- If "Send invitation email" is checked, the backend sends an email prompting the user to set their password.
- On success, redirect to the new user's detail page.

#### 5.3.4 Edit User

- Accessible via the user list or user detail page.
- Implemented as a modal or a dedicated edit page (`/admin/users/:id/edit`).
- **Editable fields:** First name, Last name, Display name (optional), Email address, Role, Active status.
- On save, display a success toast.

#### 5.3.5 Deactivate / Reactivate User

- Deactivation and reactivation use dedicated API endpoints (`POST /api/users/:id/deactivate` and `POST /api/users/:id/reactivate`), not the general user update endpoint.
- A confirmation dialog is shown before deactivating or reactivating a user.
- Deactivated users cannot log in. Any active sessions are invalidated by the backend.
- The current logged-in admin cannot deactivate their own account.

#### 5.3.6 Delete User

- A confirmation dialog is shown before deleting a user, requiring the admin to type the user's email address to confirm.
- The current logged-in admin cannot delete their own account.
- On success, redirect to `/admin/users`.

#### 5.3.7 Force Password Reset

- An admin action available on the user list and user detail pages.
- Sends a password reset email to the user.
- A confirmation toast is shown on success.

---

### 5.4 Email Whitelist Management (Admin Only)

#### 5.4.1 Whitelist Toggle

- **Page:** `/admin/whitelist`
- A prominent toggle control at the top of the page enables or disables the whitelist feature globally.
- The current state of the toggle is fetched from the backend on page load.
- When the toggle is switched, the change is immediately persisted to the backend.
- Visual indication of current state: e.g. "Whitelist Enabled — only whitelisted emails may register" or "Whitelist Disabled — anyone may register."

#### 5.4.2 Whitelist Entry Management

- Displays a searchable list of all whitelisted email addresses.
- **Add to whitelist:** An input field and "Add" button to add a single email address. Client-side validation for email format before submission.
- **Remove from whitelist:** Each entry has a "Remove" button.
  - A confirmation dialog is shown before removal.
  - The dialog notes that if the whitelist is currently enabled, removing this email will immediately invalidate any active sessions for that user.
- The whitelist management UI is fully visible regardless of whether the feature toggle is on or off, so admins can maintain the list proactively.

---

## 6. UI / UX Conventions

### 6.1 Form Validation

- Client-side validation is performed using Zod schemas via React Hook Form.
- Validation errors are displayed inline beneath each field.
- Server-side validation errors are mapped to the appropriate field where possible; otherwise displayed as a form-level error message.
- Forms are disabled (inputs and submit button) while a submission is in progress.

### 6.2 Loading States

- All async operations (page loads, form submissions, table fetches) display an appropriate loading indicator.
- Buttons show a spinner and are disabled during submission to prevent double-submission.
- Page-level data fetching displays a skeleton loader rather than a blank page.

### 6.3 Notifications

- A toast notification system (Sonner) provides feedback for all user actions.
- **Success toasts:** Green, auto-dismiss after 4 seconds.
- **Error toasts:** Red, auto-dismiss after 6 seconds.
- **Info toasts:** Neutral, auto-dismiss after 4 seconds.
- Toasts are positioned in the bottom-right corner of the screen.

### 6.4 Confirmation Dialogs

- Destructive actions (delete, deactivate, remove from whitelist) always require confirmation via a modal dialog.
- Highly destructive actions (user deletion) require the user to type a confirmation string.

### 6.5 Responsive Design

- The application is fully responsive and usable on mobile, tablet, and desktop viewports.
- The admin user table collapses gracefully on smaller screens (e.g. fewer columns visible, horizontal scroll).
- Navigation collapses to a hamburger menu on mobile.

### 6.6 Password Visibility Toggle

- All password input fields include an eye icon button (show/hide) at the right edge of the input.
- Clicking the icon toggles the input type between `password` (hidden) and `text` (visible).
- The icon changes to reflect the current state (e.g. eye / eye-off).
- The toggle button has an accessible `aria-label` that updates accordingly: "Show password" / "Hide password".
- This applies to every password field in the application: Login, Register (password and confirm), Change Password (all three fields), Reset Password (both fields), and Change Email (current password).

### 6.7 Accessibility

- All interactive elements are keyboard navigable.
- Form inputs have associated `<label>` elements.
- ARIA attributes are used where appropriate (dialogs, toasts, loading states).
- Colour contrast meets WCAG AA standards.

---

## 7. Role-Based UI

The navigation and available actions are rendered conditionally based on the authenticated user's role:

| UI Element | `user` role | `admin` role |
|---|---|---|
| Dashboard link | ✅ | ✅ |
| Profile link | ✅ | ✅ |
| Admin menu | ❌ | ✅ |
| User list page | ❌ | ✅ |
| Whitelist page | ❌ | ✅ |
| Edit/Delete actions on users | ❌ | ✅ |

Role checks on the frontend are for UI rendering only. All authorisation enforcement is performed by the backend.

---

## 8. Security Considerations

- **No sensitive data in browser storage.** Auth state is held in React Context (memory only). No tokens, user IDs, or session identifiers are written to `localStorage` or `sessionStorage`.
- **HTTP-only cookies.** Session cookies are set by the backend with `HttpOnly` and `SameSite=Lax` flags. The frontend cannot read them directly.
- **CSRF.** Since the application uses `SameSite=Lax` cookies and all API calls are same-origin (proxied via Caddy), no explicit CSRF token handling is required.
- **401 interception.** All `fetch` calls are wrapped such that a `401` response triggers automatic logout and redirect to `/login`.
- **429 handling.** Rate limit responses display a user-friendly message and do not crash the application.
- **Role enforcement.** Frontend role checks guard routes and UI elements for usability only. The backend is the sole authority for access control.

---

## 9. Environment Configuration

The application requires the following environment variables:

| Variable | Description | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the FastAPI backend | `http://localhost:8000` |

A `.env.example` file is included in the repository with all required variables documented.

---

## 10. Testing

The test suite covers unit and integration levels. The goal is confidence in core logic and user-facing behaviour at a moderate level of coverage.

**Tools:** Vitest and React Testing Library.

**Coverage target:** ~70% across lines, functions, branches, and statements. Coverage is enforced as part of the CI test run.

### 10.1 What to Test

**Authentication flows**
- Login: valid credentials, invalid credentials, session expiration redirect.
- Register: successful submission, whitelist rejection, validation errors, password mismatch.
- Forgot password / reset password: form submission, token-absent redirect, expired token error.
- Email verification: auto-submission on load, success state, failure state.
- Logout: clears auth state, redirects to `/login`.

**Route guards**
- `<PublicRoute>` redirects authenticated users to `/dashboard`.
- `<ProtectedRoute>` redirects unauthenticated users to `/login`.
- `<AdminRoute>` redirects non-admin authenticated users to `/dashboard`.

**AuthContext**
- Hydrates user state from `/api/auth/me` on load.
- Clears state correctly on logout.
- Handles failed `/api/auth/me` gracefully (unauthenticated state, no crash).

**Form validation**
- Zod schemas: all validation rules are unit tested independently of UI components.
- Inline error messages appear for invalid input.
- Submit button is disabled while submission is in progress.

**UI components**
- Password visibility toggle: toggles input type and aria-label correctly.
- Confirmation dialogs: render, confirm, and cancel correctly.
- Toast notifications: correct variant (success / error / info) triggered by action.
- Role-based rendering: admin-only elements hidden for `user` role, visible for `admin` role.

**Admin features**
- User list: renders paginated data, search input triggers debounced fetch, sort columns update request params.
- Whitelist page: toggle state reflects backend response, add/remove actions call correct endpoints.

### 10.2 What Not to Test

- Third-party library internals (React Hook Form, Sonner, React Router).
- Pure styling and layout (Tailwind class application).
- End-to-end user journeys — these are left to a future E2E suite (e.g. Playwright) added by the consuming application.

### 10.3 Mocking Strategy

- All `fetch` calls are mocked using `vitest`'s `vi.fn()` or `msw` (Mock Service Worker) for integration-level tests.
- `AuthContext` is wrapped in a test helper (`renderWithAuth`) that accepts a pre-set user state, avoiding the need to simulate a full login flow in every test.
- React Router is wrapped using `MemoryRouter` in component tests to control the current route.

### 10.4 Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage report
pnpm test:coverage

# Run in watch mode during development
pnpm test:watch
```

---

## 11. Out of Scope

The following concerns are explicitly out of scope for `react-starter` and are left to the consuming application:

- OAuth / social login (Google, GitHub, etc.)
- Multi-factor authentication (MFA / TOTP)
- Audit logging UI
- Application-specific business logic, pages, or features
- Internationalisation (i18n)
- Dark mode
