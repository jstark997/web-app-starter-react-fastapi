import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_defaults_allow_sqlite_in_development():
    settings = Settings(_env_file=None)

    assert settings.environment == "development"
    assert settings.database_url.startswith("sqlite+aiosqlite://")


def test_production_rejects_sqlite_database_url():
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            _env_file=None,
            environment="production",
            database_url="sqlite+aiosqlite:///./dev.db",
        )

    assert "ENVIRONMENT=production" in str(exc_info.value)


def test_production_accepts_legacy_postgres_scheme_after_normalization():
    settings = Settings(
        _env_file=None,
        environment="production",
        database_url="postgres://u:p@h/db",
    )

    assert settings.database_url == "postgresql+asyncpg://u:p@h/db"
