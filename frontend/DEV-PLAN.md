# react-starter — Development Plan

## Overview

This plan breaks the implementation of `react-starter` into discrete phases, each scoped to work well within a single Claude Code session. Each phase has a clear goal, a defined set of files to produce, and a completion checklist. Phases build on each other — complete them in order.

The authoritative feature reference is `SPEC.md`. When starting a Claude Code session for any phase, instruct Claude Code to read both `CLAUDE.md` and `SPEC.md` before writing any code.

---

## Phase 1 — TypeScript Types & API Client Foundation

**Goal:** Establish the shared type definitions and the core HTTP client that every other phase depends on. No UI. No React. Pure TypeScript.

**Files to produce:**

```
src/types/auth.ts          # AuthUser, AuthState interfaces
src/types/user.ts          # User, UserRole, UserStatus types (admin views)
src/types/whitelist.ts     # WhitelistEntry, WhitelistSettings types
src/types/api.ts           # ApiError, PaginatedResponse, ApiResponse types
src/api/client.ts          # Base fetch wrapper with 401/429 interception
src/api/auth.ts            # Auth API calls (login, logout, register, me, change-password, verify-email, resend-verification, forgot-password, reset-password)
src/api/profile.ts         # Profile API calls (update profile via PATCH /api/profile, change email via POST /api/profile/change-email)
src/api/users.ts           # User admin API calls (list, get, create, update, delete, deactivate, reactivate, force-password-reset) — all under /api/users
src/api/whitelist.ts       # Whitelist API calls (get settings, toggle, add, remove)
```

**Key decisions for Claude Code:**

- `client.ts` must include `credentials: 'include'` on every request.
- `client.ts` must handle `401` by dispatching a custom `auth:expired` window event (AuthContext will listen for this — do not import AuthContext here to avoid circular dependencies).
- `client.ts` must handle `429` by throwing a typed `RateLimitError`.
- `client.ts` must normalise the FastAPI backend's error envelopes into a typed `ApiError`. The four shapes seen in practice are: `{ message, errors? }` (legacy/backwards-compat), `{ detail: "msg" }` (`HTTPException(detail="msg")`), `{ detail: { detail|message: "...", ...rest } }` (`HTTPException(detail={...})`), and `{ detail: [{ loc, msg, type }, ...] }` (Pydantic validation). `ApiError` carries `message`, `fieldErrors`, and a `details: Record<string, unknown>` field — the latter holds non-message extras from dict-detail responses (e.g. a `whitelistRestricted: true` flag) so consumers can branch on backend-provided structured signals instead of substring-matching the message.
- List endpoints may return either a bare array or a wrapped `{ items, total, ... }` shape depending on the backend handler. Each `src/api/*.ts` function should normalise its return type to what the calling page actually wants (typically the array), rather than leaking the wrapper.
- All API functions return typed responses or throw typed errors — no `any`.

**Completion checklist:**

- [ ] All types are exported from `src/types/index.ts`
- [ ] `client.ts` 401 and 429 handling is unit tested
- [ ] All API functions are typed end-to-end with no `any`
- [ ] `pnpm build` passes with no TypeScript errors

**Commit:** `feat: add TypeScript types and API client foundation`

---

## Phase 2 — Authentication Context & Route Guards

**Goal:** Build the global auth state management and the three route guard components. This is the backbone that all pages depend on.

**Files to produce:**

```
src/context/AuthContext.tsx         # AuthProvider, useAuth hook
src/routes/PublicRoute.tsx          # Redirects authenticated users to /dashboard
src/routes/ProtectedRoute.tsx       # Redirects unauthenticated users to /login
src/routes/AdminRoute.tsx           # Redirects non-admin users to /dashboard
src/routes/index.tsx                # Full route tree wiring all guards and pages
src/App.tsx                         # Updated to wrap with AuthProvider and RouterProvider
src/test/helpers/renderWithAuth.tsx # Test helper for rendering with preset auth state
```

**Key decisions for Claude Code:**

- `AuthContext` calls `/api/auth/me` on mount to hydrate state. While loading, render a full-page loading spinner — never flash an unauthenticated state.
- `AuthContext` listens for the `auth:expired` window event dispatched by `client.ts` and clears state + redirects to `/login` with a toast.
- `ProtectedRoute` saves the originally requested path to redirect back after login (using React Router's `location.state`).
- Route definitions in `src/routes/index.tsx` should use React Router v7's `createBrowserRouter`.
- Pages referenced in the route tree don't need to exist yet — use placeholder components.

**Completion checklist:**

- [ ] `AuthContext` hydrates correctly on load
- [ ] `AuthContext` clears state and redirects on `auth:expired` event
- [ ] All three route guards redirect correctly (tested with `renderWithAuth`)
- [ ] `ProtectedRoute` preserves and restores the originally requested path
- [ ] `pnpm test` passes

**Commit:** `feat: add AuthContext and route guards`

---

## Phase 3 — Primitive UI Components

**Goal:** Build the shared, reusable low-level UI components that all pages will use. These are not page-specific — they are the building blocks.

**Files to produce:**

```
src/components/ui/Button.tsx          # Variants: primary, secondary, danger, ghost. Sizes: sm, md, lg.
src/components/ui/Input.tsx           # Text input with label, error message, helper text
src/components/ui/PasswordInput.tsx   # Input with show/hide toggle (eye icon)
src/components/ui/Badge.tsx           # Role and status badges (admin, user, active, inactive)
src/components/ui/Spinner.tsx         # Loading spinner, multiple sizes
src/components/ui/Dialog.tsx          # Modal dialog with confirm/cancel actions
src/components/ui/ConfirmDialog.tsx   # Specialised dialog for destructive confirmations
src/components/ui/Skeleton.tsx        # Skeleton loader blocks for page-level loading states
src/components/ui/Toggle.tsx          # On/off toggle switch (used for whitelist feature flag)
src/components/ui/index.ts            # Barrel export for all UI components
```

**Key decisions for Claude Code:**

- All components must be fully typed with explicit props interfaces.
- `PasswordInput` manages its own `show/hide` state internally. It accepts all standard `input` props plus `label` and `error`.
- `PasswordInput` toggle button must have `aria-label` that updates between "Show password" and "Hide password".
- `Dialog` must trap focus and be closeable via the Escape key.
- `ConfirmDialog` accepts an optional `confirmationText` prop — when provided, renders a text input that must match before the confirm button is enabled (used for user deletion).
- `Button` renders a `Spinner` and is disabled when an `isLoading` prop is true.
- All components must meet WCAG AA colour contrast.

**Completion checklist:**

- [ ] `PasswordInput` toggle is tested (type switches, aria-label updates)
- [ ] `Dialog` focus trap and Escape key are tested
- [ ] `ConfirmDialog` confirmation text requirement is tested
- [ ] `Button` loading state disables the button and shows spinner
- [ ] All components render without TypeScript errors
- [ ] `pnpm test` passes

**Commit:** `feat: add primitive UI components`

---

## Phase 4 — Layouts & Navigation

**Goal:** Build the two application layouts and the role-aware navigation. All subsequent pages will be rendered inside one of these layouts.

**Files to produce:**

```
src/components/layout/AuthLayout.tsx    # Minimal centered layout for auth pages
src/components/layout/AppLayout.tsx     # Main app shell with navigation
src/components/layout/Navbar.tsx        # Top navigation bar with role-aware links
src/components/layout/MobileMenu.tsx    # Hamburger menu for mobile viewports
src/components/layout/index.ts          # Barrel export
```

**Key decisions for Claude Code:**

- `AuthLayout` is a simple centered card — no navigation, no sidebar. Should look clean and professional.
- `AppLayout` includes `Navbar` and a `<main>` content area. Renders `<Outlet />` from React Router for child pages.
- `Navbar` uses `useAuth()` to get the current user and conditionally renders the Admin menu only for `admin` role users.
- `Navbar` includes the user's display name or email and a "Sign Out" button that calls the logout API function and clears auth state.
- `MobileMenu` is hidden on `md` and above breakpoints; hamburger icon visible on smaller screens.
- Navigation links use React Router's `<NavLink>` for active state styling.
- `Sonner`'s `<Toaster />` component is mounted once inside `AppLayout` (and also inside `AuthLayout` so toasts work on auth pages too).

**Completion checklist:**

- [ ] `AuthLayout` renders correctly with no navigation elements
- [ ] `AppLayout` renders admin nav items only for admin users (tested with `renderWithAuth`)
- [ ] Sign Out calls logout API and redirects to `/login`
- [ ] Mobile menu opens and closes correctly
- [ ] `pnpm test` passes

**Commit:** `feat: add AuthLayout, AppLayout, and navigation`

---

## Phase 5 — Authentication Pages

**Goal:** Implement all five authentication pages. These are the first user-facing pages and use `AuthLayout`.

**Files to produce:**

```
src/pages/auth/LoginPage.tsx              # /login
src/pages/auth/RegisterPage.tsx           # /register
src/pages/auth/ForgotPasswordPage.tsx     # /forgot-password
src/pages/auth/ResetPasswordPage.tsx      # /reset-password
src/pages/auth/VerifyEmailPage.tsx        # /verify-email
src/utils/validation.ts                   # Shared Zod schemas for auth forms
```

**Key decisions for Claude Code:**

- All forms use React Hook Form with Zod via `@hookform/resolvers/zod`.
- All password fields use the `PasswordInput` component from Phase 3.
- `LoginPage`: on success, redirect to `location.state?.from` (the saved path from `ProtectedRoute`) or `/dashboard`. On failure show "Invalid email or password." error.
- `RegisterPage`: on success, replace the form with a success message ("Check your email to verify your account"). Do not auto-login.
- `ForgotPasswordPage`: always show the same success message after submission regardless of whether the email exists.
- `ResetPasswordPage`: on load, if no `token` query param is present redirect immediately to `/forgot-password`. On success redirect to `/login` after a 2 second delay.
- `VerifyEmailPage`: auto-submit the token on mount. Show a spinner while in progress. On failure show an error with a "Resend verification email" button.
- Zod schemas in `validation.ts` are unit tested independently.

**Completion checklist:**

- [ ] All Zod schemas are unit tested
- [ ] Login redirects to saved path after success
- [ ] Login shows generic error on failure
- [ ] Register shows success message (does not auto-login)
- [ ] Forgot password always shows success message
- [ ] Reset password redirects to `/forgot-password` when token is absent
- [ ] Verify email auto-submits on mount
- [ ] All password fields have working show/hide toggle
- [ ] `pnpm test` passes

**Commit:** `feat: add authentication pages`

---

## Phase 6 — User Profile Pages

**Goal:** Implement the profile viewing/editing pages for all authenticated users.

**Files to produce:**

```
src/pages/profile/ProfilePage.tsx            # /profile — view and edit profile
src/pages/profile/ChangePasswordPage.tsx     # /profile/change-password
src/utils/validation.ts                      # Extended with profile and password Zod schemas
```

**Key decisions for Claude Code:**

- `ProfilePage` displays all user fields (avatar, name, display name, email, role, status, member since) and allows editing of first name, last name, display name, and avatar.
- Email change is initiated via a "Change Email" button that opens a `Dialog` containing the new email and current password fields. On submission a success message is shown inside the dialog.
- After a successful profile save, call `/api/auth/me` and update `AuthContext` so the navbar reflects the new name immediately.
- `ChangePasswordPage` uses three `PasswordInput` fields: current password, new password, confirm new password. On success show a success toast and redirect to `/profile`.
- Avatar field supports file upload only. The selected file is read via `FileReader.readAsDataURL` and stored as a `data:` URI on the user record; max 2 MB. Remote-URL avatars are not accepted (the backend rejects anything other than `null`/empty or a `data:image/...;base64,` value).

**Completion checklist:**

- [ ] Profile edits update AuthContext on save
- [ ] Email change dialog opens, submits, and shows success message
- [ ] Change password success redirects to `/profile`
- [ ] All password fields have working show/hide toggle
- [ ] `pnpm test` passes

**Commit:** `feat: add user profile pages`

---

## Phase 7 — Admin: User List & User Detail

**Goal:** Implement the admin user list and read-only user detail pages.

**Files to produce:**

```
src/pages/admin/UserListPage.tsx      # /admin/users
src/pages/admin/UserDetailPage.tsx    # /admin/users/:id
src/components/ui/Table.tsx           # Reusable sortable table component
src/components/ui/Pagination.tsx      # Pagination controls component
src/hooks/useDebounce.ts              # Debounce hook for search input
```

**Key decisions for Claude Code:**

- `UserListPage` fetches users from the backend with query params for `page`, `pageSize`, `search`, `sortBy`, and `sortOrder`.
- Search input is debounced (300ms) using `useDebounce` before triggering a fetch.
- Sorting is handled by clicking column headers — active sort column shows an arrow indicator.
- Pagination controls show current page, total pages, and prev/next buttons.
- Each row has an Actions column with: View, Edit (opens modal — wired up in Phase 8), Deactivate/Reactivate, Force Password Reset, Delete.
- Deactivate/Reactivate uses dedicated API endpoints (`deactivateUser` / `reactivateUser` from `src/api/users.ts`), not the general `updateUser` function.
- Deactivate/Reactivate and Delete actions show a `ConfirmDialog` before proceeding.
- Delete requires the admin to type the user's email address to confirm.
- The logged-in admin's own row must disable the Deactivate and Delete actions.
- `UserDetailPage` is a read-only display of all user fields with the same quick-action buttons.
- On smaller screens the table scrolls horizontally and non-essential columns are hidden.

**Completion checklist:**

- [ ] Search debounce triggers fetch with correct query params
- [ ] Sort column click updates request and shows sort indicator
- [ ] Pagination controls navigate between pages
- [ ] Delete confirm dialog requires email address input
- [ ] Admin cannot deactivate or delete their own account (buttons disabled)
- [ ] `UserDetailPage` renders all user fields
- [ ] `pnpm test` passes

**Commit:** `feat: add admin user list and user detail pages`

---

## Phase 8 — Admin: Create & Edit User

**Goal:** Implement user creation and editing flows.

**Files to produce:**

```
src/pages/admin/CreateUserPage.tsx    # /admin/users/new
src/pages/admin/EditUserModal.tsx     # Modal opened from user list and user detail
```

**Key decisions for Claude Code:**

- `CreateUserPage` is a standalone page at `/admin/users/new`. Fields: first name, last name, email, role (select: `admin` / `user`), send invitation email (checkbox). On success redirect to `/admin/users/:id` for the newly created user.
- `EditUserModal` is a modal (not a page) opened by the Edit action in the user list and user detail pages. Fields: first name, last name, display name, email, role, active status. On save close the modal and refresh the user data in the parent page.
- Both forms use React Hook Form with Zod validation.
- Server-side validation errors are mapped to the appropriate field.

**Completion checklist:**

- [ ] Create user redirects to new user detail on success
- [ ] Edit modal closes and refreshes parent data on save
- [ ] Server errors are mapped to form fields
- [ ] `pnpm test` passes

**Commit:** `feat: add admin create and edit user flows`

---

## Phase 9 — Admin: Whitelist Management

**Goal:** Implement the email whitelist management page.

**Files to produce:**

```
src/pages/admin/WhitelistPage.tsx    # /admin/whitelist
```

**Key decisions for Claude Code:**

- Page fetches both whitelist settings (enabled/disabled toggle state) and the list of whitelisted emails on load.
- The toggle at the top of the page calls the backend immediately when switched. Show a loading state on the toggle during the API call.
- The toggle's label updates to reflect the current state: "Whitelist Enabled — only whitelisted emails may register" or "Whitelist Disabled — anyone may register."
- Add email input validates email format client-side before submitting.
- Remove button shows a `ConfirmDialog`. When the whitelist is currently enabled, the dialog body includes the note: "Removing this email will immediately sign out this user if they have an active session."
- The whitelist list is searchable (client-side filter, not a backend search, since the list is expected to be small).
- The full whitelist UI is visible regardless of whether the toggle is on or off.

**Completion checklist:**

- [ ] Toggle state is fetched and reflected correctly on load
- [ ] Toggle update calls backend immediately and shows loading state
- [ ] Add email validates format before submit
- [ ] Remove confirm dialog shows session warning when whitelist is enabled
- [ ] Client-side search filters the list
- [ ] `pnpm test` passes

**Commit:** `feat: add admin whitelist management page`

---

## Phase 10 — Dashboard Placeholder & Final Wiring

**Goal:** Add the placeholder dashboard page, wire up all routes fully, and perform a final integration pass to ensure everything works end to end.

**Files to produce:**

```
src/pages/DashboardPage.tsx    # /dashboard — placeholder for consuming apps
```

**Tasks for Claude Code:**

- Implement `DashboardPage` as a simple placeholder that displays the authenticated user's name and a welcome message. It should be clearly marked (via a comment and on-screen text) as a placeholder to be replaced by the consuming application.
- Confirm all routes in `src/routes/index.tsx` are fully wired to their real page components (no more placeholder components from Phase 2).
- Confirm `Sonner`'s `<Toaster />` is mounted correctly in both layouts.
- Confirm the `auth:expired` session expiration flow works end to end: a mocked 401 response should clear auth state, show a toast, and redirect to `/login`.
- Run a full TypeScript build and confirm zero errors.
- Run the full test suite and confirm coverage meets the 70% threshold.

**Completion checklist:**

- [ ] All routes resolve to their correct page components
- [ ] Session expiration flow works end to end
- [ ] `pnpm build` succeeds with zero TypeScript errors
- [ ] `pnpm test:coverage` meets 70% threshold across all metrics
- [ ] App runs correctly with `pnpm dev`

**Commit:** `feat: add dashboard placeholder and complete route wiring`

---

## Phase 11 — README & Final Documentation

**Goal:** Write the `README.md` now that the project is fully built and all conventions, setup steps, and environment details are proven and stable. This is intentionally the last phase — accurate documentation can only be written once the project is complete.

**Note:** `CLAUDE.md` is not part of this phase. It must be written by the developer before Phase 1 begins, as it provides Claude Code with the instructions and conventions it needs from the very first session.

**Files to produce:**

```
README.md    # Human-readable project overview and setup guide
```

**`README.md` must include:**

- Project description and purpose
- Relationship to `fastapi-starter` (this is the frontend half of a two-project starter system)
- Prerequisites (Node.js version, pnpm)
- Setup instructions (clone, install, configure env vars, run dev server)
- How to run tests and check coverage
- How to build for production
- Environment variable reference (mirroring `.env.example`)
- How to use as a starter (clone, remove placeholder dashboard, build your app)
- Link to `SPEC.md` for full feature documentation

**Completion checklist:**

- [ ] Setup instructions are accurate and tested from a clean clone
- [ ] All environment variables are documented
- [ ] A new developer can follow the README from scratch with no prior context

**Commit:** `docs: add README`

---

## Phase Summary

| Phase | Focus                         | Commit Message                                              |
| ----- | ----------------------------- | ----------------------------------------------------------- |
| 1     | TypeScript types & API client | `feat: add TypeScript types and API client foundation`      |
| 2     | AuthContext & route guards    | `feat: add AuthContext and route guards`                    |
| 3     | Primitive UI components       | `feat: add primitive UI components`                         |
| 4     | Layouts & navigation          | `feat: add AuthLayout, AppLayout, and navigation`           |
| 5     | Authentication pages          | `feat: add authentication pages`                            |
| 6     | User profile pages            | `feat: add user profile pages`                              |
| 7     | Admin user list & detail      | `feat: add admin user list and user detail pages`           |
| 8     | Admin create & edit user      | `feat: add admin create and edit user flows`                |
| 9     | Admin whitelist management    | `feat: add admin whitelist management page`                 |
| 10    | Dashboard & final wiring      | `feat: add dashboard placeholder and complete route wiring` |
| 11    | README & final documentation  | `docs: add README`                                          |

---

## Working with Claude Code

**Starting a session:** Always begin with:

> "Please read CLAUDE.md and SPEC.md before starting."

**Scope per session:** Hand Claude Code one phase at a time. If a phase feels too large for a single session, split it at a natural boundary (e.g. Phase 5 could be split into Login + Register in one session, and the remaining three pages in another).

**After each phase:** Run `pnpm test` and `pnpm build` before committing. Never carry failing tests or TypeScript errors into the next phase.

**When resuming:** If continuing a phase across sessions, show Claude Code the files already produced and the remaining checklist items before asking it to continue.
