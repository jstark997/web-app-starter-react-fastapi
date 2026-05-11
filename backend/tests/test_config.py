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
        frontend_url="https://app.example.com",
    )

    assert settings.database_url == "postgresql+asyncpg://u:p@h/db"


def test_production_rejects_localhost_frontend_url():
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            _env_file=None,
            environment="production",
            database_url="postgresql+asyncpg://u:p@h/db",
            frontend_url="http://localhost:5173",
        )

    assert "FRONTEND_URL" in str(exc_info.value)


def test_production_rejects_loopback_ip_frontend_url():
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            _env_file=None,
            environment="production",
            database_url="postgresql+asyncpg://u:p@h/db",
            frontend_url="https://127.0.0.1",
        )

    assert "FRONTEND_URL" in str(exc_info.value)


def test_production_rejects_plain_http_frontend_url():
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            _env_file=None,
            environment="production",
            database_url="postgresql+asyncpg://u:p@h/db",
            frontend_url="http://app.example.com",
        )

    assert "FRONTEND_URL" in str(exc_info.value)


def test_production_accepts_real_https_frontend_url():
    settings = Settings(
        _env_file=None,
        environment="production",
        database_url="postgresql+asyncpg://u:p@h/db",
        frontend_url="https://app.example.com",
    )

    assert settings.frontend_url == "https://app.example.com"


def test_development_allows_localhost_frontend_url():
    settings = Settings(
        _env_file=None,
        environment="development",
        frontend_url="http://localhost:5173",
    )

    assert settings.frontend_url == "http://localhost:5173"
