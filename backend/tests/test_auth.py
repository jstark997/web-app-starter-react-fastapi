from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.security import hash_password, verify_password
from app.models.token import Token, TokenType
from app.models.user import User, UserRole
from app.models.whitelist import WhitelistEntry, WhitelistSettings
from app.models.session import Session

from tests.conftest import TEST_PASSWORD


# --- Login ---


async def test_login_success(test_client, test_user):
    response = await test_client.post(
        "/api/auth/login",
        json={"email": "user@test.com", "password": TEST_PASSWORD, "rememberMe": False},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "user@test.com"
    assert data["firstName"] == "Test"
    assert data["lastName"] == "User"
    assert data["role"] == "user"
    assert data["isActive"] is True
    assert data["emailVerified"] is True
    assert "session_id" in response.cookies


async def test_login_sets_cookie(test_client, test_user):
    response = await test_client.post(
        "/api/auth/login",
        json={"email": "user@test.com", "password": TEST_PASSWORD, "rememberMe": False},
    )
    assert "session_id" in response.cookies


async def test_login_remember_me(test_client, test_user, async_session):
    response = await test_client.post(
        "/api/auth/login",
        json={"email": "user@test.com", "password": TEST_PASSWORD, "rememberMe": True},
    )
    assert response.status_code == 200
    # Check the session has ~30 day expiry
    result = await async_session.execute(
        select(Session).where(Session.user_id == test_user.id)
    )
    sessions = result.scalars().all()
    # Find the one with longest expiry (the remember_me one)
    max_session = max(sessions, key=lambda s: s.expires_at)
    expected = datetime.now(timezone.utc) + timedelta(days=30)
    delta = abs((max_session.expires_at.replace(tzinfo=timezone.utc) - expected).total_seconds())
    assert delta < 5


async def test_login_wrong_password(test_client, test_user):
    response = await test_client.post(
        "/api/auth/login",
        json={"email": "user@test.com", "password": "wrongpassword", "rememberMe": False},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


async def test_login_nonexistent_email(test_client):
    response = await test_client.post(
        "/api/auth/login",
        json={"email": "nobody@test.com", "password": "whatever123", "rememberMe": False},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


async def test_login_deactivated_account(test_client, async_session):
    user = User(
        email="inactive@test.com",
        password_hash=hash_password(TEST_PASSWORD),
        first_name="Inactive",
        last_name="User",
        role=UserRole.USER,
        is_active=False,
        email_verified=True,
    )
    async_session.add(user)
    await async_session.commit()

    response = await test_client.post(
        "/api/auth/login",
        json={"email": "inactive@test.com", "password": TEST_PASSWORD, "rememberMe": False},
    )
    # Deactivated accounts return the same generic 401 as wrong credentials
    # so that an attacker cannot use login responses to confirm valid pairs.
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


async def test_login_unverified_email(test_client, async_session):
    user = User(
        email="unverified@test.com",
        password_hash=hash_password(TEST_PASSWORD),
        first_name="Unverified",
        last_name="User",
        role=UserRole.USER,
        is_active=True,
        email_verified=False,
    )
    async_session.add(user)
    await async_session.commit()

    response = await test_client.post(
        "/api/auth/login",
        json={"email": "unverified@test.com", "password": TEST_PASSWORD, "rememberMe": False},
    )
    # Unverified users log in successfully; the frontend gate handles the rest.
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "unverified@test.com"
    assert data["emailVerified"] is False
    assert "session_id" in response.cookies


async def test_login_email_case_insensitive(test_client, test_user):
    response = await test_client.post(
        "/api/auth/login",
        json={"email": "USER@TEST.COM", "password": TEST_PASSWORD, "rememberMe": False},
    )
    assert response.status_code == 200


# --- Login lockout (per-account brute-force defence) ---


async def _post_login(client, email: str, password: str):
    return await client.post(
        "/api/auth/login",
        json={"email": email, "password": password, "rememberMe": False},
    )


async def test_login_lockout_after_threshold_failures(test_client, test_user, async_session):
    for _ in range(5):
        response = await _post_login(test_client, "user@test.com", "wrongpassword")
        assert response.status_code == 401

    await async_session.refresh(test_user)
    assert test_user.failed_login_count == 5
    assert test_user.locked_until is not None
    locked_until = test_user.locked_until.replace(tzinfo=timezone.utc)
    assert locked_until > datetime.now(timezone.utc)


async def test_login_locked_account_rejects_correct_password(test_client, test_user, async_session):
    test_user.failed_login_count = 5
    test_user.locked_until = datetime.now(timezone.utc) + timedelta(seconds=60)
    await async_session.commit()

    response = await _post_login(test_client, "user@test.com", TEST_PASSWORD)
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"

    await async_session.refresh(test_user)
    assert test_user.failed_login_count == 5  # not incremented while locked


async def test_login_lockout_window_expires(test_client, test_user, async_session):
    test_user.failed_login_count = 5
    test_user.locked_until = datetime.now(timezone.utc) - timedelta(seconds=1)
    await async_session.commit()

    response = await _post_login(test_client, "user@test.com", TEST_PASSWORD)
    assert response.status_code == 200

    await async_session.refresh(test_user)
    assert test_user.failed_login_count == 0
    assert test_user.locked_until is None


async def test_login_success_resets_failed_count(test_client, test_user, async_session):
    for _ in range(3):
        response = await _post_login(test_client, "user@test.com", "wrongpassword")
        assert response.status_code == 401

    await async_session.refresh(test_user)
    assert test_user.failed_login_count == 3
    assert test_user.locked_until is None

    response = await _post_login(test_client, "user@test.com", TEST_PASSWORD)
    assert response.status_code == 200

    await async_session.refresh(test_user)
    assert test_user.failed_login_count == 0
    assert test_user.locked_until is None


async def test_login_exponential_backoff(test_client, test_user, async_session):
    for _ in range(5):
        await _post_login(test_client, "user@test.com", "wrongpassword")

    await async_session.refresh(test_user)
    first_lock = test_user.locked_until.replace(tzinfo=timezone.utc)
    first_lock_seconds = (first_lock - datetime.now(timezone.utc)).total_seconds()

    # Force-expire the first lock so the 6th attempt is allowed through to
    # the credential check (and thus triggers another increment + re-lock).
    test_user.locked_until = datetime.now(timezone.utc) - timedelta(seconds=1)
    await async_session.commit()

    await _post_login(test_client, "user@test.com", "wrongpassword")

    await async_session.refresh(test_user)
    assert test_user.failed_login_count == 6
    second_lock = test_user.locked_until.replace(tzinfo=timezone.utc)
    second_lock_seconds = (second_lock - datetime.now(timezone.utc)).total_seconds()
    # Second window should be roughly 2x the first (60s -> 120s); allow some
    # slack for the test runtime.
    assert second_lock_seconds > first_lock_seconds * 1.5


async def test_password_reset_clears_lockout(test_client, test_user, async_session, mock_email_provider):
    from app.models.token import Token, TokenType

    test_user.failed_login_count = 5
    test_user.locked_until = datetime.now(timezone.utc) + timedelta(seconds=300)
    token_value = "reset-token-for-locked-user"
    token = Token(
        user_id=test_user.id,
        token=token_value,
        token_type=TokenType.PASSWORD_RESET,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    async_session.add(token)
    await async_session.commit()

    response = await test_client.post(
        "/api/auth/reset-password",
        json={"token": token_value, "password": "newpassword123"},
    )
    assert response.status_code == 200

    await async_session.refresh(test_user)
    assert test_user.failed_login_count == 0
    assert test_user.locked_until is None

    response = await _post_login(test_client, "user@test.com", "newpassword123")
    assert response.status_code == 200


async def test_login_lockout_no_row_for_unknown_email(test_client, test_user, async_session):
    for _ in range(5):
        response = await _post_login(test_client, "nobody@test.com", "wrongpassword")
        assert response.status_code == 401

    # The known user is untouched — no per-account state was created for the unknown email.
    await async_session.refresh(test_user)
    assert test_user.failed_login_count == 0
    assert test_user.locked_until is None


async def test_lockout_email_sent_once_per_campaign(test_client, test_user, async_session, mock_email_provider):
    for _ in range(5):
        await _post_login(test_client, "user@test.com", "wrongpassword")

    lock_emails = [m for m in mock_email_provider.sent if m["to"] == "user@test.com"]
    assert len(lock_emails) == 1
    assert "temporarily locked" in lock_emails[0]["text_body"]

    # Force-expire the first lock and submit a 6th wrong attempt — this
    # re-locks the account but must NOT send another email.
    await async_session.refresh(test_user)
    test_user.locked_until = datetime.now(timezone.utc) - timedelta(seconds=1)
    await async_session.commit()

    await _post_login(test_client, "user@test.com", "wrongpassword")
    lock_emails = [m for m in mock_email_provider.sent if m["to"] == "user@test.com"]
    assert len(lock_emails) == 1  # still only one

    # A successful login resets the counter; a fresh campaign then earns a fresh email.
    await async_session.refresh(test_user)
    test_user.locked_until = datetime.now(timezone.utc) - timedelta(seconds=1)
    await async_session.commit()
    response = await _post_login(test_client, "user@test.com", TEST_PASSWORD)
    assert response.status_code == 200

    for _ in range(5):
        await _post_login(test_client, "user@test.com", "wrongpassword")
    lock_emails = [m for m in mock_email_provider.sent if m["to"] == "user@test.com"]
    assert len(lock_emails) == 2


async def test_lockout_email_not_sent_for_unknown_email(test_client, mock_email_provider):
    for _ in range(5):
        await _post_login(test_client, "nobody@test.com", "wrongpassword")
    assert mock_email_provider.sent == []


# --- Register ---


async def test_register_success(test_client, mock_email_provider):
    response = await test_client.post(
        "/api/auth/register",
        json={
            "email": "newuser@test.com",
            "password": "password123",
            "firstName": "New",
            "lastName": "User",
        },
    )
    assert response.status_code == 201
    assert "verification" in response.json()["detail"].lower() or "check your email" in response.json()["detail"].lower()
    assert len(mock_email_provider.sent) == 1
    assert mock_email_provider.sent[0]["to"] == "newuser@test.com"


async def test_register_duplicate_email(test_client, test_user, async_session, mock_email_provider):
    # Snapshot the user count so we can assert no new row is created.
    before = await async_session.execute(select(User))
    user_count_before = len(before.scalars().all())

    response = await test_client.post(
        "/api/auth/register",
        json={
            "email": "user@test.com",
            "password": "password123",
            "firstName": "Dup",
            "lastName": "User",
        },
    )

    # Always returns the same generic 201 as a brand-new registration.
    assert response.status_code == 201

    # No duplicate user row was created.
    after = await async_session.execute(select(User))
    assert len(after.scalars().all()) == user_count_before

    # The existing user received a duplicate-attempt notification.
    assert len(mock_email_provider.sent) == 1
    msg = mock_email_provider.sent[0]
    assert msg["to"] == "user@test.com"
    assert "already have an account" in msg["text_body"]


async def test_register_duplicate_email_case_insensitive(test_client, test_user, mock_email_provider):
    response = await test_client.post(
        "/api/auth/register",
        json={
            "email": "USER@TEST.COM",
            "password": "password123",
            "firstName": "Dup",
            "lastName": "User",
        },
    )
    assert response.status_code == 201
    assert len(mock_email_provider.sent) == 1
    assert mock_email_provider.sent[0]["to"] == "user@test.com"


async def test_register_whitelist_rejection(test_client, async_session, test_admin):
    ws = WhitelistSettings(id=1, enabled=True)
    async_session.add(ws)
    await async_session.commit()

    response = await test_client.post(
        "/api/auth/register",
        json={
            "email": "blocked@test.com",
            "password": "password123",
            "firstName": "Blocked",
            "lastName": "User",
        },
    )
    assert response.status_code == 403
    data = response.json()
    assert data["detail"]["whitelistRestricted"] is True


async def test_register_whitelist_allowed(test_client, async_session, test_admin, mock_email_provider):
    ws = WhitelistSettings(id=1, enabled=True)
    async_session.add(ws)
    entry = WhitelistEntry(email="allowed@test.com", created_by_id=test_admin.id)
    async_session.add(entry)
    await async_session.commit()

    response = await test_client.post(
        "/api/auth/register",
        json={
            "email": "allowed@test.com",
            "password": "password123",
            "firstName": "Allowed",
            "lastName": "User",
        },
    )
    assert response.status_code == 201
    assert len(mock_email_provider.sent) == 1


async def test_register_short_password(test_client):
    response = await test_client.post(
        "/api/auth/register",
        json={
            "email": "short@test.com",
            "password": "short",
            "firstName": "Short",
            "lastName": "Pass",
        },
    )
    assert response.status_code == 422


async def test_register_long_password_returns_422(test_client):
    response = await test_client.post(
        "/api/auth/register",
        json={
            "email": "long@test.com",
            "password": "a" * 73,
            "firstName": "Long",
            "lastName": "Pass",
        },
    )
    assert response.status_code == 422


async def test_register_multibyte_password_over_byte_limit_returns_422(test_client):
    # 36 emoji = 72 characters but 144 UTF-8 bytes, exceeding bcrypt's 72-byte limit
    response = await test_client.post(
        "/api/auth/register",
        json={
            "email": "emoji@test.com",
            "password": "🔒" * 36,
            "firstName": "Emoji",
            "lastName": "Pass",
        },
    )
    assert response.status_code == 422


# --- Verify Email ---


async def test_verify_email_success(test_client, async_session, test_user):
    # Create unverified user with token
    user = User(
        email="toverify@test.com",
        password_hash=hash_password(TEST_PASSWORD),
        first_name="To",
        last_name="Verify",
        role=UserRole.USER,
        is_active=True,
        email_verified=False,
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)

    token = Token(
        user_id=user.id,
        token="valid-verification-token",
        token_type=TokenType.EMAIL_VERIFICATION,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    async_session.add(token)
    await async_session.commit()

    response = await test_client.post(
        "/api/auth/verify-email",
        json={"token": "valid-verification-token"},
    )
    assert response.status_code == 200

    await async_session.refresh(user)
    assert user.email_verified is True

    await async_session.refresh(token)
    assert token.used_at is not None


async def test_verify_email_expired_token(test_client, async_session, test_user):
    token = Token(
        user_id=test_user.id,
        token="expired-verification-token",
        token_type=TokenType.EMAIL_VERIFICATION,
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    async_session.add(token)
    await async_session.commit()

    response = await test_client.post(
        "/api/auth/verify-email",
        json={"token": "expired-verification-token"},
    )
    assert response.status_code == 400


async def test_verify_email_used_token(test_client, async_session, test_user):
    token = Token(
        user_id=test_user.id,
        token="used-verification-token",
        token_type=TokenType.EMAIL_VERIFICATION,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        used_at=datetime.now(timezone.utc),
    )
    async_session.add(token)
    await async_session.commit()

    response = await test_client.post(
        "/api/auth/verify-email",
        json={"token": "used-verification-token"},
    )
    assert response.status_code == 400


# --- Resend Verification ---


async def test_resend_verification_success(test_client, async_session, mock_email_provider):
    user = User(
        email="resend@test.com",
        password_hash=hash_password(TEST_PASSWORD),
        first_name="Resend",
        last_name="User",
        role=UserRole.USER,
        is_active=True,
        email_verified=False,
    )
    async_session.add(user)
    await async_session.commit()

    response = await test_client.post(
        "/api/auth/resend-verification",
        json={"email": "resend@test.com"},
    )
    assert response.status_code == 200
    assert len(mock_email_provider.sent) == 1


async def test_resend_verification_nonexistent_email(test_client, mock_email_provider):
    response = await test_client.post(
        "/api/auth/resend-verification",
        json={"email": "nobody@test.com"},
    )
    assert response.status_code == 200
    assert len(mock_email_provider.sent) == 0


async def test_resend_verification_already_verified(test_client, test_user, mock_email_provider):
    response = await test_client.post(
        "/api/auth/resend-verification",
        json={"email": "user@test.com"},
    )
    assert response.status_code == 200
    assert len(mock_email_provider.sent) == 0


# --- Forgot Password ---


async def test_forgot_password_existing_user(test_client, test_user, mock_email_provider):
    response = await test_client.post(
        "/api/auth/forgot-password",
        json={"email": "user@test.com"},
    )
    assert response.status_code == 200
    assert len(mock_email_provider.sent) == 1


async def test_forgot_password_nonexistent_email(test_client, mock_email_provider):
    response = await test_client.post(
        "/api/auth/forgot-password",
        json={"email": "nobody@test.com"},
    )
    assert response.status_code == 200
    assert len(mock_email_provider.sent) == 0


# --- Reset Password ---


async def test_reset_password_success(test_client, async_session, test_user):
    token = Token(
        user_id=test_user.id,
        token="valid-reset-token",
        token_type=TokenType.PASSWORD_RESET,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    async_session.add(token)
    # Also create a session to verify it gets invalidated
    session = Session(
        user_id=test_user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    async_session.add(session)
    await async_session.commit()

    response = await test_client.post(
        "/api/auth/reset-password",
        json={"token": "valid-reset-token", "password": "newpassword123"},
    )
    assert response.status_code == 200

    # Verify password was changed
    await async_session.refresh(test_user)
    assert verify_password("newpassword123", test_user.password_hash)

    # Verify token is marked used
    await async_session.refresh(token)
    assert token.used_at is not None

    # Verify all sessions invalidated
    result = await async_session.execute(
        select(Session).where(Session.user_id == test_user.id)
    )
    assert result.scalars().all() == []


async def test_reset_password_invalid_token(test_client):
    response = await test_client.post(
        "/api/auth/reset-password",
        json={"token": "nonexistent-token", "password": "newpassword123"},
    )
    assert response.status_code == 400


async def test_reset_password_long_password_returns_422(test_client):
    response = await test_client.post(
        "/api/auth/reset-password",
        json={"token": "any-token", "password": "a" * 73},
    )
    assert response.status_code == 422


# --- Logout ---


async def test_logout_success(auth_client):
    response = await auth_client.post("/api/auth/logout")
    assert response.status_code == 204


async def test_logout_clears_cookie(auth_client):
    response = await auth_client.post("/api/auth/logout")
    assert response.status_code == 204
    # Cookie should be cleared (set to empty or max_age=0)
    assert "session_id" in response.headers.get("set-cookie", "")


async def test_logout_unauthenticated(test_client):
    response = await test_client.post("/api/auth/logout")
    assert response.status_code == 401


# --- Me ---


async def test_me_authenticated(auth_client, test_user):
    response = await auth_client.get("/api/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "user@test.com"
    assert data["role"] == "user"


async def test_me_unauthenticated(test_client):
    response = await test_client.get("/api/auth/me")
    assert response.status_code == 401
