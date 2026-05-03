from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.core.email_providers.mock import MockEmailProvider
from app.core.rate_limit import limiter
from app.core.security import hash_password
from app.dependencies.providers import get_email_provider
from app.main import app as fastapi_app
from app.models import Session, User, UserRole

TEST_PASSWORD = "testpassword123"


@pytest.fixture(autouse=True)
def disable_rate_limiting():
    previous = limiter.enabled
    limiter.enabled = False
    limiter.reset()
    yield
    limiter.enabled = previous
    limiter.reset()


@pytest.fixture(scope="session")
async def async_engine():
    engine = create_async_engine("sqlite+aiosqlite://", echo=False)
    yield engine
    await engine.dispose()


@pytest.fixture
async def async_session(async_engine):
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
def mock_email_provider():
    return MockEmailProvider()


@pytest.fixture
def test_app(async_session, mock_email_provider):
    async def override_get_db():
        yield async_session

    fastapi_app.dependency_overrides[get_db] = override_get_db
    fastapi_app.dependency_overrides[get_email_provider] = lambda: mock_email_provider
    yield fastapi_app
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
async def test_client(test_app):
    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test",
    ) as client:
        yield client


@pytest.fixture
async def test_user(async_session):
    user = User(
        email="user@test.com",
        password_hash=hash_password(TEST_PASSWORD),
        first_name="Test",
        last_name="User",
        role=UserRole.USER,
        is_active=True,
        email_verified=True,
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest.fixture
async def test_admin(async_session):
    user = User(
        email="admin@test.com",
        password_hash=hash_password(TEST_PASSWORD),
        first_name="Test",
        last_name="Admin",
        role=UserRole.ADMIN,
        is_active=True,
        email_verified=True,
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest.fixture
async def auth_client(test_app, async_session, test_user):
    session = Session(
        user_id=test_user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    async_session.add(session)
    await async_session.commit()
    await async_session.refresh(session)

    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test",
        cookies={"session_id": str(session.id)},
    ) as client:
        yield client


@pytest.fixture
async def admin_client(test_app, async_session, test_admin):
    session = Session(
        user_id=test_admin.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    async_session.add(session)
    await async_session.commit()
    await async_session.refresh(session)

    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test",
        cookies={"session_id": str(session.id)},
    ) as client:
        yield client
