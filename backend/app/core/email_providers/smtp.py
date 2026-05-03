import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.email import EmailDeliveryError, EmailProvider


class SMTPEmailProvider(EmailProvider):

    def __init__(self, settings):
        self.host = settings.smtp_host
        self.port = settings.smtp_port
        self.user = settings.smtp_user
        self.password = settings.smtp_password
        self.from_address = settings.email_from_address
        self.from_name = settings.email_from_name

    async def send(
        self,
        to: str,
        subject: str,
        html_body: str,
        text_body: str,
    ) -> None:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{self.from_name} <{self.from_address}>"
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        def _send_sync():
            try:
                with smtplib.SMTP(self.host, self.port) as server:
                    server.starttls()
                    server.login(self.user, self.password)
                    server.send_message(msg)
            except (smtplib.SMTPException, OSError) as exc:
                raise EmailDeliveryError(str(exc)) from exc

        await asyncio.to_thread(_send_sync)
