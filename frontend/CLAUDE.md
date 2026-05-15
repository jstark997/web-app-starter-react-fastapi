# CLAUDE.md — react-starter

This file is read automatically by Claude Code at the start of every session. Read it fully before writing any code.

## What This Project Is

`react-starter` is a production-ready frontend starter application. It provides a complete, reusable foundation for authentication and user administration that can be cloned as the starting point for any new web application project.

It is the frontend half of a two-project starter system. The companion backend is `fastapi-starter` (Python, FastAPI, SQLite/PostgreSQL).

## Key Documents

- **`STARTER-SPEC.md`** — The authoritative feature specification. Read this to understand what to build, how each feature behaves, and what the acceptance criteria are. When in doubt about a feature, the spec is the source of truth.
- **`STARTER-DEV-PLAN.md`** — The phased development plan. Each phase has a goal, a list of files to produce, key decisions, and a completion checklist.

Always read `STARTER-SPEC.md` before implementing any feature.

---

## Third-Party Libraries and APIs

Whenever working with any third-party library, API, or tool used in this project (including but not limited to React, React Router, React Hook Form, Zod, Tailwind CSS, Sonner, Vitest, and React Testing Library), you **must** look up the official documentation before writing code that depends on it. Do not rely on training data — library APIs change between versions and outdated usage causes subtle bugs.

Use the **DocsExplorer** subagent for efficient documentation lookup.

This rule applies to:
- Any library listed in the Technology Stack above
- Any library found in `package.json`
- Any API, service, or tool not part of the TypeScript or React core

---

## Upgrading pnpm

The pnpm version is pinned in `frontend/package.json` via the `packageManager` field (e.g. `"pnpm@10.8.1"`). The same pin is used by:
- Corepack in the local shell (when `corepack enable` has been run)
- Corepack in `frontend/Dockerfile`
- `pnpm/action-setup@v4` in `.github/workflows/ci.yml` (via the `package_json_file` input)

Changing this one field updates CI, Docker, and local dev in lock-step. To upgrade:

```bash
cd frontend
corepack use pnpm@<new-version>   # writes the field; appends a +sha512 suffix
pnpm install --frozen-lockfile    # confirm the lockfile still resolves cleanly
```

**Then remove the `+sha512-...` suffix** that `corepack use` appends, leaving only `"packageManager": "pnpm@<new-version>"`. Commit that one-line change to `package.json`.

We intentionally omit the integrity-hash suffix because at least one build environment (Railpack's Dockerfile builder on Railway) rejects it with "expected a semver version". The supply-chain protection lost is small: pnpm itself is still downloaded over TLS from the npm registry, and every package pnpm installs is content-addressed by `pnpm-lock.yaml`. Re-introduce the suffix if/when all of our build environments support it.

---

## Project Structure

```
src/
├── api/                   # All backend communication — organized by domain
│   ├── client.ts          # Base fetch wrapper (401/429 handling, credentials)
│   ├── auth.ts            # Auth endpoints (login, logout, register, etc.)
│   ├── profile.ts         # Profile endpoints (update profile, change email)
│   ├── users.ts           # User admin endpoints
│   └── whitelist.ts       # Whitelist endpoints
├── components/
│   ├── ui/                # Primitive, reusable UI components
│   └── layout/            # AuthLayout, AppLayout, Navbar, MobileMenu
├── context/
│   ├── AuthContext.tsx    # AuthProvider component — wraps the app with global auth state
│   └── useAuth.ts         # AuthContext object, AuthContextValue type, and useAuth hook
├── hooks/                 # Custom React hooks
├── pages/
│   ├── auth/              # Login, Register, ForgotPassword, ResetPassword, VerifyEmail
│   ├── profile/           # ProfilePage, ChangePasswordPage
│   └── admin/             # UserListPage, UserDetailPage, CreateUserPage, WhitelistPage
├── routes/                # Route definitions and route guard components
├── types/                 # Shared TypeScript interfaces and types
├── utils/                 # Helper functions and Zod validation schemas
└── test/
    ├── setup.ts            # Vitest + jest-dom setup
    └── helpers/            # renderWithAuth and other test utilities
```

---

## Coding Conventions

### Imports
- Always use the `@/` path alias for imports within `src/`. Never use relative paths that traverse more than one level (e.g. `../../components`).
  ```ts
  // Correct
  import { Button } from '@/components/ui'
  import { useAuth } from '@/context/useAuth'

  // Wrong
  import { Button } from '../../components/ui'
  ```

### TypeScript
- No `any`. Every function parameter, return value, and variable must be typed.
- All shared types live in `src/types/`. Import from `@/types` barrel export.
- Component props must have explicit interfaces, not inline types.
  ```ts
  // Correct
  interface ButtonProps {
    label: string
    isLoading?: boolean
  }
  export function Button({ label, isLoading }: ButtonProps) { ... }

  // Wrong
  export function Button({ label, isLoading }: { label: string, isLoading?: boolean }) { ... }
  ```

### Components
- One component per file. File name matches component name (PascalCase).
- Use named exports for components, not default exports — except for page components, which use default exports to support React Router lazy loading.
- Barrel exports (`index.ts`) are used in `src/components/ui/` and `src/components/layout/` to keep imports clean.

### API Calls
- All backend communication must go through `src/api/client.ts`. Never call `fetch` directly in a component or page.
- All API functions live in `src/api/` and are organized by domain (`auth.ts`, `profile.ts`, `users.ts`, `whitelist.ts`).
- Every API function must be fully typed — typed request parameters, typed response, typed errors.

### Forms
- All forms use React Hook Form with Zod via `@hookform/resolvers/zod`.
- Zod schemas live in `src/utils/validation.ts`.
- Validation errors display inline beneath each field.
- Forms must be disabled (all inputs + submit button) while submission is in progress.
- Server-side validation errors must be mapped to the relevant field where possible; otherwise shown as a form-level error.

### Password Fields
- Never use a plain `<input type="password">` directly.
- Always use the `PasswordInput` component from `@/components/ui`.
- This applies everywhere: Login, Register, Change Password, Reset Password, and Change Email.

### Destructive Actions
- Never execute a destructive action (delete, deactivate, remove from whitelist) without first showing a `ConfirmDialog`.
- User deletion specifically requires the admin to type the user's email address into the dialog before the confirm button becomes enabled. Use `ConfirmDialog` with the `confirmationText` prop set to the user's email.

### Security — Non-Negotiable Rules
- **Never write anything to `localStorage` or `sessionStorage`.** Auth state lives in React Context (in memory) only.
- Session cookies are HTTP-only and managed entirely by the backend. The frontend never reads, writes, or manipulates cookies directly.
- All `fetch` calls include `credentials: 'include'`. This is handled by `client.ts` — do not bypass it.

### Notifications
- Use Sonner for all toast notifications. Import from `sonner`.
- Success: `toast.success(...)` — auto-dismiss after 4 seconds.
- Error: `toast.error(...)` — auto-dismiss after 6 seconds.
- Info: `toast(...)` — auto-dismiss after 4 seconds.
- Never use `alert()` or `console.log()` as a substitute for user feedback.

### Styling
- Use Tailwind CSS utility classes exclusively. Do not write custom CSS unless there is no Tailwind equivalent.
- Do not use inline `style` props unless absolutely necessary.
- All components must be responsive. Test at mobile (375px), tablet (768px), and desktop (1280px).
- Colour contrast must meet WCAG AA standards.

### Accessibility
- All form inputs must have an associated `<label>`.
- All interactive elements must be keyboard navigable.
- Use ARIA attributes where appropriate: dialogs (`role="dialog"`, `aria-modal`), loading states (`aria-busy`), toggle buttons (`aria-label`, `aria-pressed`).
- The `PasswordInput` show/hide toggle must have an `aria-label` that updates: "Show password" / "Hide password".

---

## Authentication & Auth State

Auth state behaviour and the `AuthUser` interface are fully documented in `STARTER-SPEC.md` sections 3.3, 3.4, and 5.1.7.

**Critical implementation note — avoid circular dependency:** Never import `AuthContext` from `src/api/client.ts`. This creates a circular dependency. Instead, `client.ts` signals session expiry by dispatching `window.dispatchEvent(new Event('auth:expired'))`, and `AuthContext` listens for that event. Keep these two modules decoupled.

---

## Route Guards

Route guard behaviour and the full route map are documented in `STARTER-SPEC.md` sections 4.1 and 4.2.

Route definitions use React Router v7's `createBrowserRouter` and live in `src/routes/index.tsx`. The three guard components (`PublicRoute`, `ProtectedRoute`, `AdminRoute`) live in `src/routes/`.

---

## Testing

**Tools:** Vitest, React Testing Library, MSW (Mock Service Worker).

**Coverage target:** 70% across lines, functions, branches, and statements. This is enforced — `pnpm test:coverage` will fail if thresholds are not met.

**Rules:**
- Write tests alongside every new component, hook, or utility — not after the fact.
- Use `renderWithAuth` from `src/test/helpers/renderWithAuth.tsx` to render components with a preset auth state. Never simulate a login flow in a test.
- Mock all `fetch` calls. Never make real HTTP requests in tests.
- Wrap components that use routing in `MemoryRouter` or use the router provided by `renderWithAuth`.
- Test behaviour, not implementation. Assert on what the user sees and what functions are called — not on internal state.

**What must be tested:** See `STARTER-SPEC.md` sections 10.1 and 10.2 for the full list of required test cases and what to explicitly exclude.

---

## Commands

```bash
# Start development server
pnpm dev

# Run tests (single pass)
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage

# Type-check without building
pnpm tsc --noEmit

# Build for production
pnpm build

# Preview production build locally
pnpm preview
```

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the FastAPI backend | `http://localhost:8000` |

Copy `.env.example` to `.env.local` for local development. Never commit `.env.local`.

---

## Definition of Done

A phase or feature is complete when:

1. All files listed in the phase plan are produced.
2. All items on the phase completion checklist are checked off.
3. `pnpm tsc --noEmit` passes with zero errors.
4. `pnpm test` passes with zero failures.
5. `pnpm test:coverage` meets the 70% threshold.
6. `pnpm build` succeeds.
7. The feature has been manually verified in the browser with `pnpm dev`.
