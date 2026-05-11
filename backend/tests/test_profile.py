from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.security import hash_password, verify_password
from app.models import Session, User, UserRole
from app.models.token import Token, TokenType
from tests.conftest import TEST_PASSWORD


# --- GET /api/profile ---


async def test_get_profile_returns_full_profile(auth_client, test_user):
    response = await auth_client.get("/api/profile")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(test_user.id)
    assert data["email"] == test_user.email
    assert data["firstName"] == test_user.first_name
    assert data["lastName"] == test_user.last_name
    assert data["role"] == "user"
    assert data["isActive"] is True
    assert data["emailVerified"] is True
    assert "createdAt" in data


async def test_get_profile_unauthenticated(test_client):
    response = await test_client.get("/api/profile")
    assert response.status_code == 401


# --- PATCH /api/profile ---


async def test_patch_profile_updates_fields(auth_client, async_session, test_user):
    response = await auth_client.patch(
        "/api/profile",
        json={"firstName": "Updated", "lastName": "Name"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["firstName"] == "Updated"
    assert data["lastName"] == "Name"

    await async_session.refresh(test_user)
    assert test_user.first_name == "Updated"
    assert test_user.last_name == "Name"


async def test_patch_profile_partial_update_leaves_other_fields_unchanged(
    auth_client, async_session, test_user
):
    original_last_name = test_user.last_name
    response = await auth_client.patch(
        "/api/profile",
        json={"firstName": "OnlyFirst"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["firstName"] == "OnlyFirst"
    assert data["lastName"] == original_last_name

    await async_session.refresh(test_user)
    assert test_user.first_name == "OnlyFirst"
    assert test_user.last_name == original_last_name


async def test_patch_profile_can_set_display_name_and_avatar(auth_client, async_session, test_user):
    data_uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="
    response = await auth_client.patch(
        "/api/profile",
        json={"displayName": "Janie", "avatarUrl": data_uri},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["displayName"] == "Janie"
    assert data["avatarUrl"] == data_uri


async def test_patch_profile_rejects_remote_avatar_url(auth_client):
    response = await auth_client.patch(
        "/api/profile",
        json={"avatarUrl": "https://example.com/a.png"},
    )
    assert response.status_code == 422


async def test_patch_profile_rejects_non_image_data_uri(auth_client):
    response = await auth_client.patch(
        "/api/profile",
        json={"avatarUrl": "data:text/html;base64,PHNjcmlwdD4="},
    )
    assert response.status_code == 422


async def test_patch_profile_accepts_null_avatar(auth_client):
    response = await auth_client.patch(
        "/api/profile",
        json={"avatarUrl": None},
    )
    assert response.status_code == 200


async def test_patch_profile_unauthenticated(test_client):
    response = await test_client.patch("/api/profile", json={"firstName": "X"})
    assert response.status_code == 401


# --- POST /api/profile/change-email ---


async def test_change_email_success_sends_verification_to_new_address(
    auth_client, async_session, test_user, mock_email_provider
):
    response = await auth_client.post(
        "/api/profile/change-email",
        json={"newEmail": "new@test.com", "currentPassword": TEST_PASSWORD},
    )
    assert response.status_code == 200

    # User's email has NOT changed yet
    await async_session.refresh(test_user)
    assert test_user.email == "user@test.com"

    # Verification email was sent to the NEW address
    assert len(mock_email_provider.sent) == 1
    assert mock_email_provider.sent[0]["to"] == "new@test.com"

    # A token tied to the new email exists
    result = await async_session.execute(
        select(Token).where(
            Token.user_id == test_user.id,
            Token.token_type == TokenType.EMAIL_VERIFICATION,
            Token.used_at.is_(None),
        )
    )
    token = result.scalar_one()
    assert token.new_email == "new@test.com"


async def test_change_email_wrong_password_returns_400(
    auth_client, async_session, test_user, mock_email_provider
):
    response = await auth_client.post(
        "/api/profile/change-email",
        json={"newEmail": "new@test.com", "currentPassword": "wrong-password"},
    )
    assert response.status_code == 400
    assert mock_email_provider.sent == []

    await async_session.refresh(test_user)
    assert test_user.email == "user@test.com"


async def test_change_email_duplicate_email_returns_409(
    auth_client, async_session, test_user
):
    other = User(
        email="taken@test.com",
        password_hash=hash_password("anything"),
        first_name="Other",
        last_name="User",
        role=UserRole.USER,
        is_active=True,
        email_verified=True,
    )
    async_session.add(other)
    await async_session.commit()

    response = await auth_client.post(
        "/api/profile/change-email",
        json={"newEmail": "taken@test.com", "currentPassword": TEST_PASSWORD},
    )
    assert response.status_code == 409


async def test_change_email_normalises_to_lowercase(
    auth_client, async_session, test_user, mock_email_provider
):
    response = await auth_client.post(
        "/api/profile/change-email",
        json={"newEmail": "MixedCase@Test.com", "currentPassword": TEST_PASSWORD},
    )
    assert response.status_code == 200
    assert mock_email_provider.sent[0]["to"] == "mixedcase@test.com"


async def test_change_email_unauthenticated(test_client):
    response = await test_client.post(
        "/api/profile/change-email",
        json={"newEmail": "new@test.com", "currentPassword": TEST_PASSWORD},
    )
    assert response.status_code == 401


async def test_verify_email_after_change_swaps_user_email(
    auth_client, test_client, async_session, test_user
):
    # Initiate change-email
    await auth_client.post(
        "/api/profile/change-email",
        json={"newEmail": "swapped@test.com", "currentPassword": TEST_PASSWORD},
    )
    result = await async_session.execute(
        select(Token).where(Token.user_id == test_user.id, Token.used_at.is_(None))
    )
    token = result.scalar_one()

    # Consume the token through the verify-email endpoint
    response = await test_client.post(
        "/api/auth/verify-email", json={"token": token.token}
    )
    assert response.status_code == 200

    await async_session.refresh(test_user)
    assert test_user.email == "swapped@test.com"


# --- POST /api/auth/change-password ---


async def test_change_password_success_updates_hash(
    auth_client, async_session, test_user
):
    response = await auth_client.post(
        "/api/auth/change-password",
        json={"currentPassword": TEST_PASSWORD, "newPassword": "newpassword123"},
    )
    assert response.status_code == 200

    await async_session.refresh(test_user)
    assert verify_password("newpassword123", test_user.password_hash)
    assert not verify_password(TEST_PASSWORD, test_user.password_hash)


async def test_change_password_wrong_password_returns_400(
    auth_client, async_session, test_user
):
    response = await auth_client.post(
        "/api/auth/change-password",
        json={"currentPassword": "wrong", "newPassword": "newpassword123"},
    )
    assert response.status_code == 400

    await async_session.refresh(test_user)
    assert verify_password(TEST_PASSWORD, test_user.password_hash)


async def test_change_password_invalidates_other_sessions_keeps_current(
    auth_client, async_session, test_user
):
    # Add a second session for the same user
    other_session = Session(
        user_id=test_user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    async_session.add(other_session)
    await async_session.commit()
    other_session_id = other_session.id

    # Confirm two sessions exist
    result = await async_session.execute(
        select(Session).where(Session.user_id == test_user.id)
    )
    assert len(result.scalars().all()) == 2

    response = await auth_client.post(
        "/api/auth/change-password",
        json={"currentPassword": TEST_PASSWORD, "newPassword": "newpassword123"},
    )
    assert response.status_code == 200

    # Other session is gone, current session still works
    result = await async_session.execute(
        select(Session).where(Session.user_id == test_user.id)
    )
    remaining = result.scalars().all()
    assert len(remaining) == 1
    assert remaining[0].id != other_session_id

    me_response = await auth_client.get("/api/profile")
    assert me_response.status_code == 200


async def test_change_password_short_password_returns_422(auth_client):
    response = await auth_client.post(
        "/api/auth/change-password",
        json={"currentPassword": TEST_PASSWORD, "newPassword": "short"},
    )
    assert response.status_code == 422


async def test_change_password_unauthenticated(test_client):
    response = await test_client.post(
        "/api/auth/change-password",
        json={"currentPassword": TEST_PASSWORD, "newPassword": "newpassword123"},
    )
    assert response.status_code == 401
