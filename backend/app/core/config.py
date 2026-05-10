from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Literal["development", "production", "test"] = "development"
    database_url: str = "sqlite+aiosqlite:///./dev.db"
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

    @model_validator(mode="after")
    def _require_postgres_in_production(self) -> "Settings":
        # Guard against a production deploy that forgets to inject DATABASE_URL
        # and silently falls back to the ephemeral SQLite default. Migrations
        # would succeed, the app would boot, and the first write would vanish
        # on the next deploy.
        if self.environment == "production" and not self.database_url.startswith("postgresql"):
            raise ValueError(
                "ENVIRONMENT=production requires DATABASE_URL to be a postgresql:// URL; "
                f"got {self.database_url!r}, which would silently use an ephemeral SQLite file."
            )
        return self

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()
