from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.core.email import (
    EmailDeliveryError,
    EmailProvider,
    send_email_change_verification_email,
    send_invitation_email,
    send_password_reset_email,
    send_verification_email,
)
from app.core.email_providers.mock import MockEmailProvider
from app.core.email_providers.resend import ResendEmailProvider


def test_email_provider_cannot_be_instantiated():
    with pytest.raises(TypeError):
        EmailProvider()


def test_email_delivery_error_is_exception():
    assert issubclass(EmailDeliveryError, Exception)
    with pytest.raises(EmailDeliveryError):
        raise EmailDeliveryError("test error")


async def test_mock_provider_send_appends_to_sent():
    provider = MockEmailProvider()
    await provider.send("user@example.com", "Subject", "<p>html</p>", "text")
    assert len(provider.sent) == 1
    assert provider.sent[0]["to"] == "user@example.com"
    assert provider.sent[0]["subject"] == "Subject"
    assert provider.sent[0]["html_body"] == "<p>html</p>"
    assert provider.sent[0]["text_body"] == "text"


async def test_mock_provider_send_multiple():
    provider = MockEmailProvider()
    await provider.send("a@example.com", "First", "<p>1</p>", "1")
    await provider.send("b@example.com", "Second", "<p>2</p>", "2")
    assert len(provider.sent) == 2


async def test_send_verification_email():
    provider = MockEmailProvider()
    url = "https://example.com/verify?token=abc"
    await send_verification_email(provider, "user@example.com", url)
    assert len(provider.sent) == 1
    msg = provider.sent[0]
    assert msg["subject"] == "Verify your email address"
    assert url in msg["text_body"]
    assert url in msg["html_body"]
    assert "24 hours" in msg["text_body"]
    assert "24 hours" in msg["html_body"]


async def test_send_password_reset_email():
    provider = MockEmailProvider()
    url = "https://example.com/reset?token=abc"
    await send_password_reset_email(provider, "user@example.com", url)
    assert len(provider.sent) == 1
    msg = provider.sent[0]
    assert msg["subject"] == "Reset your password"
    assert url in msg["text_body"]
    assert url in msg["html_body"]
    assert "24 hours" in msg["text_body"]


async def test_send_invitation_email():
    provider = MockEmailProvider()
    url = "https://example.com/setup?token=abc"
    await send_invitation_email(provider, "user@example.com", url)
    assert len(provider.sent) == 1
    msg = provider.sent[0]
    assert msg["subject"] == "You've been invited to join"
    assert url in msg["text_body"]
    assert url in msg["html_body"]
    assert "24 hours" in msg["text_body"]


async def test_send_email_change_verification_email():
    provider = MockEmailProvider()
    url = "https://example.com/verify-change?token=abc"
    await send_email_change_verification_email(provider, "user@example.com", url)
    assert len(provider.sent) == 1
    msg = provider.sent[0]
    assert msg["subject"] == "Verify your new email address"
    assert url in msg["text_body"]
    assert url in msg["html_body"]
    assert "24 hours" in msg["text_body"]


# --- Resend provider tests ---


def _make_resend_provider():
    settings = SimpleNamespace(
        resend_api_key="re_test_key",
        email_from_address="noreply@example.com",
        email_from_name="My App",
    )
    return ResendEmailProvider(settings)


@patch("app.core.email_providers.resend.resend.Emails.send_async", new_callable=AsyncMock)
async def test_resend_provider_sends_email(mock_send_async):
    mock_send_async.return_value = {"id": "fake-id"}
    provider = _make_resend_provider()

    await provider.send("user@example.com", "Hello", "<p>hi</p>", "hi")

    mock_send_async.assert_awaited_once()
    params = mock_send_async.call_args[0][0]
    assert params["from"] == "My App <noreply@example.com>"
    assert params["to"] == ["user@example.com"]
    assert params["subject"] == "Hello"
    assert params["html"] == "<p>hi</p>"
    assert params["text"] == "hi"


@patch("app.core.email_providers.resend.resend.Emails.send_async", new_callable=AsyncMock)
async def test_resend_provider_wraps_errors(mock_send_async):
    import resend as resend_mod

    mock_send_async.side_effect = resend_mod.exceptions.ResendError(
        code=500, error_type="server_error", message="API failure", suggested_action="Retry"
    )
    provider = _make_resend_provider()

    with pytest.raises(EmailDeliveryError, match="API failure"):
        await provider.send("user@example.com", "Hello", "<p>hi</p>", "hi")
