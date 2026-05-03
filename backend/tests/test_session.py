from datetime import datetime, timedelta, timezone

from fastapi import Depends

from app.dependencies.auth import get_current_user, require_admin
from app.models.session import Session
from app.models.user import User, UserRole
from app.services.session import (
    create_session,
    get_session,
    invalidate_all_sessions,
    invalidate_session,
)


async def test_create_session_default_expiry(async_session, test_user):
    session = await create_session(async_session, test_user.id)
    expected = datetime.now(timezone.utc) + timedelta(hours=24)
    delta = abs((session.expires_at.replace(tzinfo=timezone.utc) - expected).total_seconds())
    assert delta < 5


async def test_create_session_remember_me_expiry(async_session, test_user):
    session = await create_session(async_session, test_user.id, remember_me=True)
    expected = datetime.now(timezone.utc) + timedelta(days=30)
    delta = abs((session.expires_at.replace(tzinfo=timezone.utc) - expected).total_seconds())
    assert delta < 5


async def test_get_session_returns_valid_session(async_session, test_user):
    session = await create_session(async_session, test_user.id)
    result = await get_session(async_session, session.id)
    assert result is not None
    assert result.id == session.id
    assert result.user.id == test_user.id


async def test_get_session_returns_none_for_expired(async_session, test_user):
    session = Session(
        user_id=test_user.id,
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    async_session.add(session)
    await async_session.commit()
    await async_session.refresh(session)

    result = await get_session(async_session, session.id)
    assert result is None


async def test_invalidate_session(async_session, test_user):
    session = await create_session(async_session, test_user.id)
    await invalidate_session(async_session, session.id)
    result = await get_session(async_session, session.id)
    assert result is None


async def test_invalidate_all_sessions(async_session, test_user):
    await create_session(async_session, test_user.id)
    await create_session(async_session, test_user.id)
    await invalidate_all_sessions(async_session, test_user.id)
    # Verify both are gone by trying to create and check a new one
    s = await create_session(async_session, test_user.id)
    await invalidate_session(async_session, s.id)
    # Direct check: no sessions remain
    from sqlalchemy import select
    result = await async_session.execute(
        select(Session).where(Session.user_id == test_user.id)
    )
    assert result.scalars().all() == []


async def test_get_current_user_missing_cookie(test_app, test_client):
    @test_app.get("/test-auth")
    async def _test_auth(user: User = Depends(get_current_user)):
        return {"id": str(user.id)}

    response = await test_client.get("/test-auth")
    assert response.status_code == 401


async def test_get_current_user_expired_cookie(test_app, test_client, async_session, test_user):
    @test_app.get("/test-auth-expired")
    async def _test_auth_expired(user: User = Depends(get_current_user)):
        return {"id": str(user.id)}

    session = Session(
        user_id=test_user.id,
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    async_session.add(session)
    await async_session.commit()
    await async_session.refresh(session)

    test_client.cookies.set("session_id", str(session.id))
    response = await test_client.get("/test-auth-expired")
    assert response.status_code == 401


async def test_require_admin_with_user_role(test_app, auth_client):
    @test_app.get("/test-admin")
    async def _test_admin(user: User = Depends(require_admin)):
        return {"id": str(user.id)}

    response = await auth_client.get("/test-admin")
    assert response.status_code == 403


async def test_fixtures_load(test_client, test_user, test_admin, auth_client, admin_client, mock_email_provider):
    assert test_user.email == "user@test.com"
    assert test_user.role == UserRole.USER
    assert test_admin.email == "admin@test.com"
    assert test_admin.role == UserRole.ADMIN
    assert mock_email_provider.sent == []
