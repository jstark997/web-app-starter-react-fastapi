import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models.session import Session
from app.models.whitelist import WhitelistEntry, WhitelistSettings

pytestmark = pytest.mark.asyncio


# --- GET /api/whitelist/settings ---


async def test_get_settings_creates_row_on_first_call(admin_client, async_session):
    resp = await admin_client.get("/api/whitelist/settings")
    assert resp.status_code == 200
    assert resp.json() == {"enabled": False}

    result = await async_session.execute(
        select(WhitelistSettings).where(WhitelistSettings.id == 1)
    )
    assert result.scalar_one_or_none() is not None


async def test_get_settings_returns_persisted_value(admin_client, async_session):
    async_session.add(WhitelistSettings(id=1, enabled=True))
    await async_session.commit()

    resp = await admin_client.get("/api/whitelist/settings")
    assert resp.status_code == 200
    assert resp.json() == {"enabled": True}


async def test_get_settings_non_admin_returns_403(auth_client):
    resp = await auth_client.get("/api/whitelist/settings")
    assert resp.status_code == 403


async def test_get_settings_unauthenticated_returns_401(test_client):
    resp = await test_client.get("/api/whitelist/settings")
    assert resp.status_code == 401


# --- PATCH /api/whitelist/settings ---


async def test_patch_settings_enables_whitelist(admin_client, async_session):
    resp = await admin_client.patch("/api/whitelist/settings", json={"enabled": True})
    assert resp.status_code == 200
    assert resp.json() == {"enabled": True}

    result = await async_session.execute(
        select(WhitelistSettings).where(WhitelistSettings.id == 1)
    )
    row = result.scalar_one()
    assert row.enabled is True


async def test_patch_settings_no_op_when_unchanged(admin_client):
    await admin_client.patch("/api/whitelist/settings", json={"enabled": True})
    resp = await admin_client.patch("/api/whitelist/settings", json={"enabled": True})
    assert resp.status_code == 200
    assert resp.json() == {"enabled": True}


async def test_patch_settings_non_admin_returns_403(auth_client):
    resp = await auth_client.patch("/api/whitelist/settings", json={"enabled": True})
    assert resp.status_code == 403


# --- GET /api/whitelist ---


async def test_list_entries_empty(admin_client):
    resp = await admin_client.get("/api/whitelist")
    assert resp.status_code == 200
    assert resp.json() == {"items": [], "total": 0}


async def test_list_entries_returns_seeded(admin_client, async_session, test_admin):
    async_session.add(WhitelistEntry(email="a@test.com", created_by_id=test_admin.id))
    async_session.add(WhitelistEntry(email="b@test.com", created_by_id=test_admin.id))
    await async_session.commit()

    resp = await admin_client.get("/api/whitelist")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    emails = sorted(item["email"] for item in data["items"])
    assert emails == ["a@test.com", "b@test.com"]


async def test_list_entries_non_admin_returns_403(auth_client):
    resp = await auth_client.get("/api/whitelist")
    assert resp.status_code == 403


# --- POST /api/whitelist ---


async def test_create_entry_success(admin_client, test_admin):
    resp = await admin_client.post("/api/whitelist", json={"email": "new@test.com"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "new@test.com"
    assert data["createdById"] == str(test_admin.id)
    assert "id" in data
    assert "createdAt" in data


async def test_create_entry_lowercases_email(admin_client):
    resp = await admin_client.post("/api/whitelist", json={"email": "MixedCase@Test.com"})
    assert resp.status_code == 201
    assert resp.json()["email"] == "mixedcase@test.com"


async def test_create_entry_duplicate_returns_409(admin_client, async_session, test_admin):
    async_session.add(WhitelistEntry(email="dup@test.com", created_by_id=test_admin.id))
    await async_session.commit()

    resp = await admin_client.post("/api/whitelist", json={"email": "dup@test.com"})
    assert resp.status_code == 409


async def test_create_entry_invalid_email_returns_422(admin_client):
    resp = await admin_client.post("/api/whitelist", json={"email": "not-an-email"})
    assert resp.status_code == 422


async def test_create_entry_non_admin_returns_403(auth_client):
    resp = await auth_client.post("/api/whitelist", json={"email": "x@test.com"})
    assert resp.status_code == 403


# --- DELETE /api/whitelist/{entry_id} ---


async def test_delete_entry_success(admin_client, async_session, test_admin):
    entry = WhitelistEntry(email="del@test.com", created_by_id=test_admin.id)
    async_session.add(entry)
    await async_session.commit()
    await async_session.refresh(entry)

    resp = await admin_client.delete(f"/api/whitelist/{entry.id}")
    assert resp.status_code == 204

    result = await async_session.execute(
        select(WhitelistEntry).where(WhitelistEntry.id == entry.id)
    )
    assert result.scalar_one_or_none() is None


async def test_delete_entry_not_found_returns_404(admin_client):
    resp = await admin_client.delete(f"/api/whitelist/{uuid.uuid4()}")
    assert resp.status_code == 404


async def test_delete_entry_invalidates_user_sessions_when_enabled(
    admin_client, async_session, test_admin, test_user
):
    async_session.add(WhitelistSettings(id=1, enabled=True))
    entry = WhitelistEntry(email=test_user.email, created_by_id=test_admin.id)
    async_session.add(entry)
    user_session = Session(
        user_id=test_user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    async_session.add(user_session)
    await async_session.commit()
    await async_session.refresh(entry)
    user_session_id = user_session.id

    resp = await admin_client.delete(f"/api/whitelist/{entry.id}")
    assert resp.status_code == 204

    result = await async_session.execute(
        select(Session).where(Session.id == user_session_id)
    )
    assert result.scalar_one_or_none() is None


async def test_delete_entry_does_not_invalidate_sessions_when_disabled(
    admin_client, async_session, test_admin, test_user
):
    async_session.add(WhitelistSettings(id=1, enabled=False))
    entry = WhitelistEntry(email=test_user.email, created_by_id=test_admin.id)
    async_session.add(entry)
    user_session = Session(
        user_id=test_user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    async_session.add(user_session)
    await async_session.commit()
    await async_session.refresh(entry)
    user_session_id = user_session.id

    resp = await admin_client.delete(f"/api/whitelist/{entry.id}")
    assert resp.status_code == 204

    result = await async_session.execute(
        select(Session).where(Session.id == user_session_id)
    )
    assert result.scalar_one_or_none() is not None


async def test_delete_entry_non_admin_returns_403(auth_client, async_session, test_admin):
    entry = WhitelistEntry(email="x@test.com", created_by_id=test_admin.id)
    async_session.add(entry)
    await async_session.commit()
    await async_session.refresh(entry)

    resp = await auth_client.delete(f"/api/whitelist/{entry.id}")
    assert resp.status_code == 403


# --- Registration integration ---


async def test_registration_blocked_when_whitelist_enabled_and_email_not_listed(
    admin_client, test_client
):
    await admin_client.patch("/api/whitelist/settings", json={"enabled": True})

    resp = await test_client.post(
        "/api/auth/register",
        json={
            "email": "blocked-via-svc@test.com",
            "password": "password123",
            "firstName": "Blocked",
            "lastName": "User",
        },
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["whitelistRestricted"] is True


async def test_registration_allowed_when_whitelist_enabled_and_email_listed(
    admin_client, test_client, mock_email_provider
):
    await admin_client.patch("/api/whitelist/settings", json={"enabled": True})
    await admin_client.post("/api/whitelist", json={"email": "allowed-via-svc@test.com"})

    resp = await test_client.post(
        "/api/auth/register",
        json={
            "email": "allowed-via-svc@test.com",
            "password": "password123",
            "firstName": "Allowed",
            "lastName": "User",
        },
    )
    assert resp.status_code == 201
    assert any(
        sent["to"] == "allowed-via-svc@test.com" for sent in mock_email_provider.sent
    )
