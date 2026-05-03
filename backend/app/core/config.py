from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./dev.db"
    secret_key: str = "change-me-to-a-random-secret-at-least-32-chars"
    frontend_url: str = "http://localhost:5173"
    allowed_origins: str = "http://localhost:5173"

    email_provider: str = "smtp"
    email_from_address: str = "noreply@example.com"
    email_from_name: str = "My App"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""

    resend_api_key: str = ""

    session_cookie_secure: bool = False
    session_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    rate_limit_enabled: bool = True

    # Admin seed (optional — set all four to create a default admin on first startup)
    admin_email: str | None = None
    admin_password: str | None = None
    admin_first_name: str | None = None
    admin_last_name: str | None = None

    @field_validator("database_url", mode="after")
    @classmethod
    def _normalize_database_url(cls, value: str) -> str:
        # Railway's Postgres plugin injects DATABASE_URL with the
        # `postgresql://` (or legacy `postgres://`) scheme, but async
        # SQLAlchemy needs the explicit `+asyncpg` driver suffix. Rewrite
        # so the same URL works locally, in CI, and on Railway.
        if value.startswith("postgres://"):
            return "postgresql+asyncpg://" + value[len("postgres://") :]
        if value.startswith("postgresql://"):
            return "postgresql+asyncpg://" + value[len("postgresql://") :]
        return value

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()
