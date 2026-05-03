from app.core.email import EmailProvider


class MockEmailProvider(EmailProvider):

    def __init__(self):
        self.sent: list[dict] = []

    async def send(
        self,
        to: str,
        subject: str,
        html_body: str,
        text_body: str,
    ) -> None:
        self.sent.append({
            "to": to,
            "subject": subject,
            "html_body": html_body,
            "text_body": text_body,
        })
