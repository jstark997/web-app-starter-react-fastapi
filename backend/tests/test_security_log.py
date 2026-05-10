import json
import logging
import uuid

from sqlalchemy import select

from app.core.logging_config import JsonFormatter
from app.core import security_log


def _make_record(level: int, name: str, msg: str, **extra) -> logging.LogRecord:
    record = logging.LogRecord(
        name=name,
        level=level,
        pathname=__file__,
        lineno=1,
        msg=msg,
        args=(),
        exc_info=None,
    )
    for key, value in extra.items():
        setattr(record, key, value)
    return record


def test_json_formatter_emits_required_keys():
    formatter = JsonFormatter()
    record = _make_record(logging.INFO, "app.security", "auth.login.success")
    payload = json.loads(formatter.format(record))

    assert payload["level"] == "INFO"
    assert payload["logger"] == "app.security"
    assert payload["message"] == "auth.login.success"
    assert "timestamp" in payload


def test_json_formatter_includes_extras():
    formatter = JsonFormatter()
    record = _make_record(
        logging.INFO,
        "app.security",
        "auth.login.failure",
        event="auth.login.failure",
        email="user@example.com",
        ip="1.2.3.4",
        reason="invalid_credentials",
    )
    payload = json.loads(formatter.format(record))

    assert payload["event"] == "auth.login.failure"
    assert payload["email"] == "user@example.com"
    assert payload["ip"] == "1.2.3.4"
    assert payload["reason"] == "invalid_credentials"


def test_json_formatter_serializes_uuid():
    formatter = JsonFormatter()
    user_id = uuid.uuid4()
    record = _make_record(
        logging.INFO,
        "app.security",
        "auth.login.success",
        user_id=user_id,
    )
    payload = json.loads(formatter.format(record))

    assert payload["user_id"] == str(user_id)


def test_log_login_success_emits_event(caplog):
    user_id = uuid.uuid4()
    with caplog.at_level(logging.INFO, logger="app.security"):
        security_log.log_login_success(user_id, "1.2.3.4")

    records = [r for r in caplog.records if r.name == "app.security"]
    assert len(records) == 1
    assert records[0].message == "auth.login.success"
    assert records[0].event == "auth.login.success"
    assert records[0].user_id == str(user_id)
    assert records[0].ip == "1.2.3.4"


def test_log_login_failure_emits_reason(caplog):
    with caplog.at_level(logging.INFO, logger="app.security"):
        security_log.log_login_failure(
            "user@example.com", "1.2.3.4", "invalid_credentials"
        )

    records = [r for r in caplog.records if r.name == "app.security"]
    assert len(records) == 1
    assert records[0].event == "auth.login.failure"
    assert records[0].email == "user@example.com"
    assert records[0].reason == "invalid_credentials"


def test_log_login_unverified_emits_event(caplog):
    user_id = uuid.uuid4()
    with caplog.at_level(logging.INFO, logger="app.security"):
        security_log.log_login_unverified(user_id, "1.2.3.4")

    records = [r for r in caplog.records if r.name == "app.security"]
    assert len(records) == 1
    assert records[0].event == "auth.login.unverified"
    assert records[0].user_id == str(user_id)
    assert records[0].ip == "1.2.3.4"


def test_log_register_duplicate_attempt_emits_event(caplog):
    with caplog.at_level(logging.INFO, logger="app.security"):
        security_log.log_register_duplicate_attempt(
            "user@example.com", "1.2.3.4"
        )

    records = [r for r in caplog.records if r.name == "app.security"]
    assert len(records) == 1
    assert records[0].event == "auth.register.duplicate_attempt"
    assert records[0].email == "user@example.com"
    assert records[0].ip == "1.2.3.4"


def test_log_admin_user_updated_sorts_fields(caplog):
    actor_id = uuid.uuid4()
    target_id = uuid.uuid4()
    with caplog.at_level(logging.INFO, logger="app.security"):
        security_log.log_admin_user_updated(actor_id, target_id, ["role", "email"])

    record = next(r for r in caplog.records if r.name == "app.security")
    assert record.fields == ["email", "role"]
    assert record.actor_id == str(actor_id)
    assert record.target_id == str(target_id)


def test_log_session_invalidated_includes_count(caplog):
    user_id = uuid.uuid4()
    with caplog.at_level(logging.INFO, logger="app.security"):
        security_log.log_session_invalidated(user_id, "logout", 3)

    record = next(r for r in caplog.records if r.name == "app.security")
    assert record.event == "session.invalidated"
    assert record.reason == "logout"
    assert record.count == 3


# --- Integration tests: assert events fire end-to-end via HTTP ---


def _security_events(caplog) -> list[logging.LogRecord]:
    return [r for r in caplog.records if r.name == "app.security"]


async def test_login_success_emits_event(test_client, test_user, caplog):
    from tests.conftest import TEST_PASSWORD

    with caplog.at_level(logging.INFO, logger="app.security"):
        response = await test_client.post(
            "/api/auth/login",
            json={"email": "user@test.com", "password": TEST_PASSWORD, "rememberMe": False},
        )

    assert response.status_code == 200
    events = [r for r in _security_events(caplog) if r.event == "auth.login.success"]
    assert len(events) == 1
    assert events[0].user_id == str(test_user.id)
    assert events[0].ip


async def test_login_wrong_password_emits_failure_event(test_client, test_user, caplog):
    with caplog.at_level(logging.INFO, logger="app.security"):
        response = await test_client.post(
            "/api/auth/login",
            json={"email": "user@test.com", "password": "wrong", "rememberMe": False},
        )

    assert response.status_code == 401
    events = [r for r in _security_events(caplog) if r.event == "auth.login.failure"]
    assert len(events) == 1
    assert events[0].email == "user@test.com"
    assert events[0].reason == "invalid_credentials"


async def test_register_emits_event(test_client, mock_email_provider, caplog):
    with caplog.at_level(logging.INFO, logger="app.security"):
        response = await test_client.post(
            "/api/auth/register",
            json={
                "email": "new@test.com",
                "password": "newpassword123",
                "firstName": "New",
                "lastName": "User",
            },
        )

    assert response.status_code == 201
    events = [r for r in _security_events(caplog) if r.event == "auth.register"]
    assert len(events) == 1
    assert events[0].email == "new@test.com"


async def test_login_unverified_emits_event(test_client, async_session, caplog):
    from app.core.security import hash_password
    from app.models.user import User, UserRole

    from tests.conftest import TEST_PASSWORD

    user = User(
        email="unverified-log@test.com",
        password_hash=hash_password(TEST_PASSWORD),
        first_name="Unverified",
        last_name="User",
        role=UserRole.USER,
        is_active=True,
        email_verified=False,
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)

    with caplog.at_level(logging.INFO, logger="app.security"):
        response = await test_client.post(
            "/api/auth/login",
            json={
                "email": "unverified-log@test.com",
                "password": TEST_PASSWORD,
                "rememberMe": False,
            },
        )

    assert response.status_code == 200
    events = [
        r for r in _security_events(caplog) if r.event == "auth.login.unverified"
    ]
    assert len(events) == 1
    assert events[0].user_id == str(user.id)
    # No login.success event fires for unverified users (only login.unverified).
    success = [r for r in _security_events(caplog) if r.event == "auth.login.success"]
    assert len(success) == 0


async def test_register_duplicate_emits_event(test_client, test_user, mock_email_provider, caplog):
    with caplog.at_level(logging.INFO, logger="app.security"):
        response = await test_client.post(
            "/api/auth/register",
            json={
                "email": "user@test.com",
                "password": "password123",
                "firstName": "Dup",
                "lastName": "User",
            },
        )

    assert response.status_code == 201
    events = [
        r
        for r in _security_events(caplog)
        if r.event == "auth.register.duplicate_attempt"
    ]
    assert len(events) == 1
    assert events[0].email == "user@test.com"
    # No auth.register event fires when the email was already registered.
    new_registers = [
        r for r in _security_events(caplog) if r.event == "auth.register"
    ]
    assert len(new_registers) == 0


async def test_logout_emits_session_invalidated(auth_client, caplog):
    with caplog.at_level(logging.INFO, logger="app.security"):
        response = await auth_client.post("/api/auth/logout")

    assert response.status_code == 204
    events = [
        r
        for r in _security_events(caplog)
        if r.event == "session.invalidated" and r.reason == "logout"
    ]
    assert len(events) == 1
    assert events[0].count == 1


async def test_admin_delete_user_emits_events(
    admin_client, test_user, test_admin, caplog
):
    with caplog.at_level(logging.INFO, logger="app.security"):
        response = await admin_client.delete(f"/api/users/{test_user.id}")

    assert response.status_code == 204
    deleted = [r for r in _security_events(caplog) if r.event == "admin.user.deleted"]
    assert len(deleted) == 1
    assert deleted[0].actor_id == str(test_admin.id)
    assert deleted[0].target_id == str(test_user.id)

    invalidated = [
        r
        for r in _security_events(caplog)
        if r.event == "session.invalidated" and r.reason == "admin_deleted"
    ]
    assert len(invalidated) == 1


async def test_password_reset_flow_emits_events(
    test_client, test_user, async_session, mock_email_provider, caplog
):
    from app.models.token import Token, TokenType

    with caplog.at_level(logging.INFO, logger="app.security"):
        # Request a reset
        response = await test_client.post(
            "/api/auth/forgot-password",
            json={"email": "user@test.com"},
        )
        assert response.status_code == 200

        # Look up the token that was just created
        result = await async_session.execute(
            select(Token).where(
                Token.user_id == test_user.id,
                Token.token_type == TokenType.PASSWORD_RESET,
            )
        )
        token = result.scalar_one()

        # Complete the reset
        response = await test_client.post(
            "/api/auth/reset-password",
            json={"token": token.token, "password": "newpassword123"},
        )
        assert response.status_code == 200

    requested = [
        r for r in _security_events(caplog) if r.event == "auth.password_reset.requested"
    ]
    completed = [
        r for r in _security_events(caplog) if r.event == "auth.password_reset.completed"
    ]
    assert len(requested) == 1
    assert requested[0].user_id == str(test_user.id)
    assert len(completed) == 1
    assert completed[0].user_id == str(test_user.id)
