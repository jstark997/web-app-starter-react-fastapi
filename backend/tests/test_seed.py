import pytest
from sqlalchemy import select

from app.core.config import settings
from app.core.security import verify_password
from app.models import User, UserRole
from app.services.seed import seed_admin_user

SEED_EMAIL = "admin@example.com"
SEED_PASSWORD = "supersecretpassword123"
SEED_FIRST = "Admin"
SEED_LAST = "User"


def _configure_admin_settings(monkeypatch):
    monkeypatch.setattr(settings, "admin_email", SEED_EMAIL)
    monkeypatch.setattr(settings, "admin_password", SEED_PASSWORD)
    monkeypatch.setattr(settings, "admin_first_name", SEED_FIRST)
    monkeypatch.setattr(settings, "admin_last_name", SEED_LAST)


@pytest.mark.asyncio
async def test_seed_creates_admin(async_session, monkeypatch):
    _configure_admin_settings(monkeypatch)

    await seed_admin_user(async_session)

    result = await async_session.execute(
        select(User).where(User.email == SEED_EMAIL)
    )
    user = result.scalar_one()

    assert user.role == UserRole.ADMIN
    assert user.is_active is True
    assert user.email_verified is True
    assert user.first_name == SEED_FIRST
    assert user.last_name == SEED_LAST
    assert verify_password(SEED_PASSWORD, user.password_hash)


@pytest.mark.asyncio
async def test_seed_is_idempotent(async_session, monkeypatch):
    _configure_admin_settings(monkeypatch)

    # Seed twice
    await seed_admin_user(async_session)
    await seed_admin_user(async_session)

    result = await async_session.execute(
        select(User).where(User.email == SEED_EMAIL)
    )
    users = result.scalars().all()
    assert len(users) == 1


@pytest.mark.asyncio
async def test_seed_skips_when_env_vars_missing(async_session, monkeypatch):
    # Only set email, leave the rest as None
    monkeypatch.setattr(settings, "admin_email", SEED_EMAIL)
    monkeypatch.setattr(settings, "admin_password", None)
    monkeypatch.setattr(settings, "admin_first_name", None)
    monkeypatch.setattr(settings, "admin_last_name", None)

    await seed_admin_user(async_session)

    result = await async_session.execute(select(User))
    assert result.scalars().all() == []
