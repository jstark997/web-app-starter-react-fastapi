from app.core.config import settings
from app.core.email import EmailProvider
from app.core.email_providers.mock import MockEmailProvider
from app.core.email_providers.resend import ResendEmailProvider
from app.core.email_providers.smtp import SMTPEmailProvider


def get_email_provider() -> EmailProvider:
    provider = settings.email_provider
    if provider == "smtp":
        return SMTPEmailProvider(settings)
    if provider == "resend":
        return ResendEmailProvider(settings)
    if provider == "mock":
        return MockEmailProvider()
    raise ValueError(f"Unknown email provider: {provider}")
