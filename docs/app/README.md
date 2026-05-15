# App docs

This directory holds specs, plans, and design notes for the **product** built on top of this starter. The starter's own specs stay where they are, co-located with the code they describe, and are prefixed with `STARTER-` so ownership is obvious:

- `backend/STARTER-API-SPEC.md` / `backend/STARTER-API-DEV-PLAN.md` — the starter's auth, admin, profile, and whitelist API.
- `frontend/STARTER-SPEC.md` / `frontend/STARTER-DEV-PLAN.md` — the starter's auth UI, admin UI, and design-system primitives.
- `backend/CLAUDE.md` / `frontend/CLAUDE.md` — coding conventions for each stack.

Anything specific to the product being built — new endpoints, new pages, domain models, business rules, threat models, decisions — lives in this directory. Suggested files:

- `SPEC.md` — product spec (endpoints, pages, flows layered on the starter baseline).
- `DEV-PLAN.md` — phased plan for the product (optional).
- `decisions/` — ADRs or design notes as the product grows.

If a change generalises and would be useful to every consumer of the starter, it belongs in the relevant `STARTER-*` doc, not here. If it only makes sense for this specific product, it belongs here.
