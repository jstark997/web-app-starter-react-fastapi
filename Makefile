# =============================================================================
# Top-level Makefile for the web-app-starter-react-fastapi monorepo.
#
# Usage:
#   make install      one-time setup: venv + pip install + alembic + pnpm install
#   make dev          start backend (uvicorn) and frontend (vite) concurrently
#   make dev-backend  start backend only
#   make dev-frontend start frontend only
#   make test         run pytest + vitest
#   make build        produce a production build of the frontend
#   make clean        remove venv, node_modules, dist, and caches
#
# POSIX shell required (macOS / Linux / WSL). Not supported on Windows-native.
# =============================================================================

.PHONY: install install-backend install-frontend \
        dev dev-backend dev-frontend \
        test test-backend test-frontend \
        build clean clean-backend clean-frontend help

help:
	@echo "Targets:"
	@echo "  make install         one-time setup for both services"
	@echo "  make dev             run backend + frontend concurrently (Ctrl+C stops both)"
	@echo "  make dev-backend     run only the backend (uvicorn on :8000)"
	@echo "  make dev-frontend    run only the frontend (vite on :5173)"
	@echo "  make test            run pytest + vitest"
	@echo "  make build           produce the frontend production build"
	@echo "  make clean           remove venv, node_modules, dist, caches"
	@echo "  make clean-backend   remove backend venv and Python caches"
	@echo "  make clean-frontend  remove frontend node_modules, dist, coverage"

# ---- Install ----------------------------------------------------------------

install: install-backend install-frontend

install-backend:
	cd backend && python3.12 -m venv .venv \
		&& . .venv/bin/activate \
		&& pip install --upgrade pip \
		&& pip install -r requirements.txt \
		&& alembic upgrade head

install-frontend:
	cd frontend && pnpm install

# ---- Development ------------------------------------------------------------
#
# `make dev` starts both services in the same shell so logs interleave on one
# stream. The trap ensures Ctrl+C kills both child processes (and their
# subprocesses) instead of leaving one orphaned.

dev:
	@echo "Starting backend (:8000) and frontend (:5173). Ctrl+C to stop both."
	@trap 'kill 0' INT TERM; \
		$(MAKE) dev-backend & \
		$(MAKE) dev-frontend & \
		wait

dev-backend:
	cd backend && . .venv/bin/activate && uvicorn app.main:app --reload

dev-frontend:
	cd frontend && pnpm dev

# ---- Tests ------------------------------------------------------------------

test: test-backend test-frontend

test-backend:
	cd backend && . .venv/bin/activate && pytest

test-frontend:
	cd frontend && pnpm test

# ---- Build ------------------------------------------------------------------

build:
	cd frontend && pnpm build

# ---- Clean ------------------------------------------------------------------

clean: clean-backend clean-frontend

clean-backend:
	rm -rf backend/.venv backend/.pytest_cache backend/.coverage backend/htmlcov
	find backend -type d -name __pycache__ -exec rm -rf {} +

clean-frontend:
	rm -rf frontend/node_modules frontend/dist frontend/coverage
