import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

logging.basicConfig(level=logging.INFO)
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.profile import router as profile_router
from app.api.users import router as users_router
from app.api.whitelist import router as whitelist_router
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.rate_limit import register_rate_limiter
from app.dependencies.providers import get_email_provider
from app.services import whitelist as whitelist_service
from app.services.seed import seed_admin_user


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncSessionLocal() as session:
        await seed_admin_user(session)
        await whitelist_service.get_or_create_settings(session)
    yield


app = FastAPI(lifespan=lifespan)

register_rate_limiter(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(users_router)
app.include_router(whitelist_router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
