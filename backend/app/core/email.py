from abc import ABC, abstractmethod


class EmailDeliveryError(Exception):
    pass


class EmailProvider(ABC):

    @abstractmethod
    async def send(
        self,
        to: str,
        subject: str,
        html_body: str,
        text_body: str,
    ) -> None:
        """Send a transactional email. Raises EmailDeliveryError on failure."""
        ...


async def send_verification_email(
    provider: EmailProvider,
    to_email: str,
    verification_url: str,
) -> None:
    subject = "Verify your email address"
    text_body = (
        "Please verify your email address by visiting the following link:\n\n"
        f"{verification_url}\n\n"
        "This link will expire in 24 hours."
    )
    html_body = (
        "<p>Please verify your email address by clicking the link below:</p>"
        f'<p><a href="{verification_url}">Verify Email Address</a></p>'
        "<p>This link will expire in 24 hours.</p>"
    )
    await provider.send(to_email, subject, html_body, text_body)


async def send_password_reset_email(
    provider: EmailProvider,
    to_email: str,
    reset_url: str,
) -> None:
    subject = "Reset your password"
    text_body = (
        "You requested a password reset. Visit the following link to set a new password:\n\n"
        f"{reset_url}\n\n"
        "This link will expire in 24 hours.\n\n"
        "If you did not request this, you can safely ignore this email."
    )
    html_body = (
        "<p>You requested a password reset. Click the link below to set a new password:</p>"
        f'<p><a href="{reset_url}">Reset Password</a></p>'
        "<p>This link will expire in 24 hours.</p>"
        "<p>If you did not request this, you can safely ignore this email.</p>"
    )
    await provider.send(to_email, subject, html_body, text_body)


async def send_invitation_email(
    provider: EmailProvider,
    to_email: str,
    setup_url: str,
) -> None:
    subject = "You've been invited to join"
    text_body = (
        "You have been invited to create an account. "
        "Visit the following link to set your password and get started:\n\n"
        f"{setup_url}\n\n"
        "This link will expire in 24 hours."
    )
    html_body = (
        "<p>You have been invited to create an account. "
        "Click the link below to set your password and get started:</p>"
        f'<p><a href="{setup_url}">Set Up Your Account</a></p>'
        "<p>This link will expire in 24 hours.</p>"
    )
    await provider.send(to_email, subject, html_body, text_body)


async def send_duplicate_registration_attempt_email(
    provider: EmailProvider,
    to_email: str,
    login_url: str,
    forgot_password_url: str,
) -> None:
    subject = "Someone tried to create an account with your email"
    text_body = (
        "Someone just tried to create a new account using your email address. "
        "You already have an account with us, so no new account was created.\n\n"
        "If this was you, you can sign in here:\n"
        f"{login_url}\n\n"
        "If you've forgotten your password, you can reset it here:\n"
        f"{forgot_password_url}\n\n"
        "If this wasn't you, you can safely ignore this email. No action is required."
    )
    html_body = (
        "<p>Someone just tried to create a new account using your email address. "
        "You already have an account with us, so no new account was created.</p>"
        "<p>If this was you, you can sign in here:</p>"
        f'<p><a href="{login_url}">Sign in</a></p>'
        "<p>If you've forgotten your password, you can reset it here:</p>"
        f'<p><a href="{forgot_password_url}">Reset password</a></p>'
        "<p>If this wasn't you, you can safely ignore this email. No action is required.</p>"
    )
    await provider.send(to_email, subject, html_body, text_body)


async def send_email_change_verification_email(
    provider: EmailProvider,
    to_email: str,
    verification_url: str,
) -> None:
    subject = "Verify your new email address"
    text_body = (
        "You requested to change your email address. "
        "Please verify your new email address by visiting the following link:\n\n"
        f"{verification_url}\n\n"
        "This link will expire in 24 hours.\n\n"
        "If you did not request this change, you can safely ignore this email."
    )
    html_body = (
        "<p>You requested to change your email address. "
        "Please verify your new email address by clicking the link below:</p>"
        f'<p><a href="{verification_url}">Verify New Email Address</a></p>'
        "<p>This link will expire in 24 hours.</p>"
        "<p>If you did not request this change, you can safely ignore this email.</p>"
    )
    await provider.send(to_email, subject, html_body, text_body)
