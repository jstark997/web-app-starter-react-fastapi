# react-starter

A production-ready frontend starter application built with TypeScript, React, Vite, and Tailwind CSS. It ships a complete, reusable foundation for authentication and user administration so any new web application can begin from a vetted baseline instead of from scratch.

What's included out of the box:

- Email/password authentication with email verification, password reset, and "remember me"
- Session expiration handling with automatic redirect to the sign-in page
- User profile management — view and edit profile, change email, change password
- Admin user management — list, search, sort, paginate, view, create, edit, deactivate, reactivate, force-password-reset, and delete users
- Admin email whitelist management with a feature toggle
- Role-aware navigation, three route guards (public / protected / admin), and two layouts (auth / app)
- Toast notifications via Sonner, mounted globally
- A placeholder `/dashboard` page that consuming applications replace with their own home screen

For the full feature specification — every page, behaviour, validation rule, and acceptance criterion — see [`SPEC.md`](./SPEC.md).

## Relationship to `fastapi-starter`

`react-starter` is the frontend half of a two-project starter system. The backend half is **`fastapi-starter`** (Python, FastAPI, SQLite/PostgreSQL). The two projects are designed to run together:

- The frontend owns no authentication source of truth. Session validity, user roles, and whitelist status are decided by the backend.
- Sessions are HTTP-only cookies managed entirely by the backend — the frontend never reads, writes, or manipulates cookies.
- All API calls go through `src/api/client.ts` with `credentials: 'include'`.

You can run `react-starter` against any backend that implements the API surface described in `SPEC.md`, but `fastapi-starter` is the reference implementation and the one this project has been integration-tested against.

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20.19+ or 22.12+ (LTS recommended) |
| pnpm | 9+ |

This project uses Vite 8, which requires Node 20.19 or newer. Use [`nvm`](https://github.com/nvm-sh/nvm) or [`fnm`](https://github.com/Schniz/fnm) to manage Node versions.

## Setup

```bash
# 1. Clone the repository
git clone <your-repo-url> react-starter
cd react-starter

# 2. Install dependencies
pnpm install

# 3. Configure environment variables
cp .env.example .env.local
# Edit .env.local and point VITE_API_BASE_URL at your running fastapi-starter backend.

# 4. Start the dev server
pnpm dev
```

The dev server runs on `http://localhost:5173` by default. Make sure your backend (e.g. `fastapi-starter` on `http://localhost:8000`) is running and that its CORS configuration permits requests from the Vite origin with credentials.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start the Vite dev server with HMR |
| `pnpm build` | Type-check and produce a production build in `dist/` |
| `pnpm preview` | Preview the production build locally |
| `pnpm lint` | Run ESLint over the project |
| `pnpm test` | Run the Vitest suite once |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm test:coverage` | Run the suite and produce a coverage report |
| `pnpm tsc --noEmit` | Type-check without producing build output |

## Testing

Tests are written with Vitest and React Testing Library, with MSW available for any test that needs to mock network requests. Test helpers live in `src/test/`, including `renderWithAuth` for rendering components with a preset auth state.

```bash
pnpm test            # single run
pnpm test:watch      # interactive watch mode
pnpm test:coverage   # produces coverage report under coverage/
```

Coverage thresholds are enforced at **70% lines / functions / branches / statements** in `vitest.config.ts`. CI and `pnpm test:coverage` will fail if coverage drops below this floor.

## Building for production

```bash
pnpm build
```

This runs `tsc -b` followed by `vite build`. The output is written to `dist/`. To smoke-test the production bundle locally:

```bash
pnpm preview
```

## Environment variables

All environment variables are documented in [`.env.example`](./.env.example). Copy that file to `.env.local` for local development. **Never commit `.env.local`** — it is git-ignored by default.

| Variable | Required | Description | Example |
|---|---|---|---|
| `VITE_API_BASE_URL` | Yes | Base URL of the FastAPI backend. No trailing slash. | `http://localhost:8000` |

Variables prefixed with `VITE_` are exposed to client code by Vite. Do not store secrets in any `VITE_*` variable — they ship to the browser.

## Using `react-starter` as a starter for your own app

The intent is that you fork or clone this repository and build your application on top of the existing scaffold:

1. **Clone the repo** and rename it for your project.
2. **Update `package.json`** — change `name`, set a starting `version`, and update `description` and any repository fields.
3. **Replace the placeholder dashboard** at [`src/pages/DashboardPage.tsx`](./src/pages/DashboardPage.tsx) with your application's real home screen. The route at `/dashboard` is already wired through `ProtectedRoute` → `AppLayout`, so anything you put in this file inherits authentication, navigation, and toast notifications for free.
4. **Add your application's pages** under `src/pages/` and wire them into [`src/routes/index.tsx`](./src/routes/index.tsx). Place your routes alongside `/dashboard` inside the existing `ProtectedRoute` (or `AdminRoute`) group so they inherit the right guard.
5. **Extend the navigation** in [`src/components/layout/Navbar.tsx`](./src/components/layout/Navbar.tsx) and [`MobileMenu.tsx`](./src/components/layout/MobileMenu.tsx) with links to your new pages.
6. **Add your domain types** under `src/types/` and your domain API calls under `src/api/`, following the patterns established by `auth.ts`, `profile.ts`, `users.ts`, and `whitelist.ts`. All requests should go through `src/api/client.ts`.
7. **Keep the project conventions** documented in [`CLAUDE.md`](./CLAUDE.md) — they cover imports, TypeScript style, security rules (no `localStorage`, no direct cookie access), forms, password fields, destructive actions, and accessibility.

What you should generally **not** need to touch unless you intend to redesign authentication itself: `src/context/AuthContext.tsx`, `src/api/client.ts`, the contents of `src/routes/`, the auth pages under `src/pages/auth/`, the profile pages under `src/pages/profile/`, and the admin pages under `src/pages/admin/`.

## Project structure

```
src/
├── api/                  # Backend communication, organized by domain
├── components/
│   ├── ui/               # Primitive, reusable UI components
│   └── layout/           # AuthLayout, AppLayout, Navbar, MobileMenu
├── context/              # AuthContext — global auth state
├── hooks/                # Custom React hooks
├── pages/
│   ├── auth/             # Login, Register, ForgotPassword, ResetPassword, VerifyEmail
│   ├── profile/          # ProfilePage, ChangePasswordPage
│   ├── admin/            # User list/detail/create/edit, Whitelist
│   └── DashboardPage.tsx # Placeholder — replace with your home screen
├── routes/               # Route tree and three route guard components
├── types/                # Shared TypeScript interfaces
├── utils/                # Helpers and Zod validation schemas
└── test/                 # Vitest setup and test helpers
```

## Documentation

- [`SPEC.md`](./SPEC.md) — authoritative feature specification.
- [`CLAUDE.md`](./CLAUDE.md) — coding conventions and rules followed throughout the codebase. Read this if you intend to extend the project (whether by hand or with an AI coding assistant).
- [`DEV-PLAN.md`](./DEV-PLAN.md) — phased plan used to build this project from scratch.
