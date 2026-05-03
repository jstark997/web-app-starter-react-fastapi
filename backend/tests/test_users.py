import uuid

import pytest
from sqlalchemy import select

from app.core.security import hash_password
from app.models.session import Session
from app.models.token import Token, TokenType
from app.models.user import User, UserRole

pytestmark = pytest.mark.asyncio


# --- GET /api/users ---


async def test_list_users(admin_client, test_user, test_admin):
    resp = await admin_client.get("/api/users")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert data["total"] >= 2
    assert data["page"] == 1
    assert data["pageSize"] == 20
    assert data["totalPages"] >= 1


async def test_list_users_non_admin_returns_403(auth_client):
    resp = await auth_client.get("/api/users")
    assert resp.status_code == 403


async def test_list_users_unauthenticated_returns_401(test_client):
    resp = await test_client.get("/api/users")
    assert resp.status_code == 401


async def test_list_users_search(admin_client, test_user):
    resp = await admin_client.get("/api/users", params={"search": test_user.first_name})
    assert resp.status_code == 200
    data = resp.json()
    emails = [u["email"] for u in data["items"]]
    assert test_user.email in emails


async def test_list_users_search_no_results(admin_client):
    resp = await admin_client.get("/api/users", params={"search": "zzzznonexistent"})
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


async def test_list_users_sort_ascending(admin_client, test_user, test_admin):
    resp = await admin_client.get(
        "/api/users", params={"sortBy": "email", "sortOrder": "asc"}
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    emails = [u["email"] for u in items]
    assert emails == sorted(emails)


async def test_list_users_invalid_sort_by(admin_client):
    resp = await admin_client.get("/api/users", params={"sortBy": "passwordHash"})
    assert resp.status_code == 400


async def test_list_users_pagination(admin_client, test_user, test_admin):
    resp = await admin_client.get("/api/users", params={"pageSize": 1, "page": 1})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    assert data["totalPages"] >= 2


# --- GET /api/users/{user_id} ---


async def test_get_user(admin_client, test_user):
    resp = await admin_client.get(f"/api/users/{test_user.id}")
    assert resp.status_code == 200
    assert resp.json()["email"] == test_user.email


async def test_get_user_not_found(admin_client):
    resp = await admin_client.get(f"/api/users/{uuid.uuid4()}")
    assert resp.status_code == 404


async def test_get_user_non_admin(auth_client, test_user):
    resp = await auth_client.get(f"/api/users/{test_user.id}")
    assert resp.status_code == 403


# --- POST /api/users ---


async def test_create_user(admin_client):
    resp = await admin_client.post(
        "/api/users",
        json={
            "email": "newuser@example.com",
            "firstName": "New",
            "lastName": "User",
            "role": "user",
            "sendInvitation": False,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "newuser@example.com"
    assert data["firstName"] == "New"
    assert data["role"] == "user"
    assert data["emailVerified"] is False


async def test_create_user_duplicate_email(admin_client, test_user):
    resp = await admin_client.post(
        "/api/users",
        json={
            "email": test_user.email,
            "firstName": "Dup",
            "lastName": "User",
            "role": "user",
            "sendInvitation": False,
        },
    )
    assert resp.status_code == 409


async def test_create_user_with_invitation(admin_client, mock_email_provider):
    resp = await admin_client.post(
        "/api/users",
        json={
            "email": "invited@example.com",
            "firstName": "Invited",
            "lastName": "User",
            "role": "user",
            "sendInvitation": True,
        },
    )
    assert resp.status_code == 201
    assert len(mock_email_provider.sent) == 1
    assert mock_email_provider.sent[0]["to"] == "invited@example.com"


async def test_create_user_non_admin(auth_client):
    resp = await auth_client.post(
        "/api/users",
        json={
            "email": "fail@example.com",
            "firstName": "F",
            "lastName": "U",
            "role": "user",
            "sendInvitation": False,
        },
    )
    assert resp.status_code == 403


async def test_create_admin_user(admin_client):
    resp = await admin_client.post(
        "/api/users",
        json={
            "email": "newadmin@example.com",
            "firstName": "New",
            "lastName": "Admin",
            "role": "admin",
            "sendInvitation": False,
        },
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "admin"


# --- PATCH /api/users/{user_id} ---


async def test_update_user(admin_client, test_user):
    resp = await admin_client.patch(
        f"/api/users/{test_user.id}",
        json={"firstName": "Updated"},
    )
    assert resp.status_code == 200
    assert resp.json()["firstName"] == "Updated"


async def test_update_user_not_found(admin_client):
    resp = await admin_client.patch(
        f"/api/users/{uuid.uuid4()}",
        json={"firstName": "X"},
    )
    assert resp.status_code == 404


async def test_admin_cannot_change_own_role(admin_client, test_admin):
    resp = await admin_client.patch(
        f"/api/users/{test_admin.id}",
        json={"role": "user"},
    )
    assert resp.status_code == 400


async def test_admin_cannot_change_own_is_active(admin_client, test_admin):
    resp = await admin_client.patch(
        f"/api/users/{test_admin.id}",
        json={"isActive": False},
    )
    assert resp.status_code == 400


async def test_update_user_deactivation_invalidates_sessions(
    admin_client, test_user, async_session
):
    # Create a session for the target user
    from datetime import datetime, timedelta, timezone

    session = Session(
        user_id=test_user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    async_session.add(session)
    await async_session.commit()

    resp = await admin_client.patch(
        f"/api/users/{test_user.id}",
        json={"isActive": False},
    )
    assert resp.status_code == 200
    assert resp.json()["isActive"] is False

    # Check sessions were invalidated
    result = await async_session.execute(
        select(Session).where(Session.user_id == test_user.id)
    )
    assert result.scalars().all() == []


async def test_update_user_email_duplicate(admin_client, test_user, test_admin):
    resp = await admin_client.patch(
        f"/api/users/{test_user.id}",
        json={"email": test_admin.email},
    )
    assert resp.status_code == 409


# --- DELETE /api/users/{user_id} ---


async def test_delete_user(admin_client, test_user, async_session):
    resp = await admin_client.delete(f"/api/users/{test_user.id}")
    assert resp.status_code == 204

    result = await async_session.execute(select(User).where(User.id == test_user.id))
    assert result.scalar_one_or_none() is None


async def test_delete_user_not_found(admin_client):
    resp = await admin_client.delete(f"/api/users/{uuid.uuid4()}")
    assert resp.status_code == 404


async def test_admin_cannot_delete_self(admin_client, test_admin):
    resp = await admin_client.delete(f"/api/users/{test_admin.id}")
    assert resp.status_code == 400


async def test_delete_user_non_admin(auth_client, test_user):
    resp = await auth_client.delete(f"/api/users/{test_user.id}")
    assert resp.status_code == 403


# --- POST /api/users/{user_id}/deactivate ---


async def test_deactivate_user(admin_client, test_user):
    resp = await admin_client.post(f"/api/users/{test_user.id}/deactivate")
    assert resp.status_code == 200
    assert resp.json()["isActive"] is False


async def test_deactivate_already_inactive(admin_client, test_user, async_session):
    test_user.is_active = False
    await async_session.commit()

    resp = await admin_client.post(f"/api/users/{test_user.id}/deactivate")
    assert resp.status_code == 409


async def test_admin_cannot_deactivate_self(admin_client, test_admin):
    resp = await admin_client.post(f"/api/users/{test_admin.id}/deactivate")
    assert resp.status_code == 400


async def test_deactivate_invalidates_sessions(admin_client, test_user, async_session):
    from datetime import datetime, timedelta, timezone

    session = Session(
        user_id=test_user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    async_session.add(session)
    await async_session.commit()

    resp = await admin_client.post(f"/api/users/{test_user.id}/deactivate")
    assert resp.status_code == 200

    result = await async_session.execute(
        select(Session).where(Session.user_id == test_user.id)
    )
    assert result.scalars().all() == []


async def test_deactivate_not_found(admin_client):
    resp = await admin_client.post(f"/api/users/{uuid.uuid4()}/deactivate")
    assert resp.status_code == 404


# --- POST /api/users/{user_id}/reactivate ---


async def test_reactivate_user(admin_client, test_user, async_session):
    test_user.is_active = False
    await async_session.commit()

    resp = await admin_client.post(f"/api/users/{test_user.id}/reactivate")
    assert resp.status_code == 200
    assert resp.json()["isActive"] is True


async def test_reactivate_already_active(admin_client, test_user):
    resp = await admin_client.post(f"/api/users/{test_user.id}/reactivate")
    assert resp.status_code == 409


async def test_reactivate_not_found(admin_client):
    resp = await admin_client.post(f"/api/users/{uuid.uuid4()}/reactivate")
    assert resp.status_code == 404


# --- POST /api/users/{user_id}/force-password-reset ---


async def test_force_password_reset(admin_client, test_user, mock_email_provider):
    resp = await admin_client.post(f"/api/users/{test_user.id}/force-password-reset")
    assert resp.status_code == 200
    assert resp.json()["detail"] == "Password reset email sent."
    assert len(mock_email_provider.sent) == 1
    assert mock_email_provider.sent[0]["to"] == test_user.email


async def test_force_password_reset_not_found(admin_client):
    resp = await admin_client.post(
        f"/api/users/{uuid.uuid4()}/force-password-reset"
    )
    assert resp.status_code == 404


async def test_force_password_reset_invalidates_prior_tokens(
    admin_client, test_user, async_session, mock_email_provider
):
    from datetime import datetime, timedelta, timezone

    # Create an existing unused password reset token
    old_token = Token(
        user_id=test_user.id,
        token="oldtoken123",
        token_type=TokenType.PASSWORD_RESET,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    async_session.add(old_token)
    await async_session.commit()
    await async_session.refresh(old_token)

    resp = await admin_client.post(f"/api/users/{test_user.id}/force-password-reset")
    assert resp.status_code == 200

    # Verify old token was invalidated
    await async_session.refresh(old_token)
    assert old_token.used_at is not None
