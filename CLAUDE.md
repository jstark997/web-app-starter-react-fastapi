# CLAUDE.md — repo root

This repo is a monorepo starter. The two halves (`frontend/`, `backend/`) carry their own `CLAUDE.md` files with stack-specific conventions — read those when working inside either directory.

## Starter vs. product docs

The starter's own specs are prefixed with `STARTER-` and live next to the code they describe:

- `backend/STARTER-API-SPEC.md`, `backend/STARTER-API-DEV-PLAN.md`
- `frontend/STARTER-SPEC.md`, `frontend/STARTER-DEV-PLAN.md`

Product-specific specs (for whatever app is being built on top of this starter) live in `docs/app/`. See `docs/app/README.md` for the boundary.

When asked to add a spec, plan, or design note, decide first whether it generalises (→ relevant `STARTER-*` doc) or is product-specific (→ `docs/app/`). Default to `docs/app/` when in doubt — pulling something out is easier than disentangling it from the starter's baseline later.
