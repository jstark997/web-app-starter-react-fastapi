import resend

from app.core.email import EmailDeliveryError, EmailProvider


class ResendEmailProvider(EmailProvider):

    def __init__(self, settings):
        self.api_key = settings.resend_api_key
        self.from_address = settings.email_from_address
        self.from_name = settings.email_from_name

    async def send(
        self,
        to: str,
        subject: str,
        html_body: str,
        text_body: str,
    ) -> None:
        resend.api_key = self.api_key
        params: resend.Emails.SendParams = {
            "from": f"{self.from_name} <{self.from_address}>",
            "to": [to],
            "subject": subject,
            "html": html_body,
            "text": text_body,
        }
        try:
            await resend.Emails.send_async(params)
        except resend.exceptions.ResendError as exc:
            raise EmailDeliveryError(str(exc)) from exc
