from app.core.rate_limit import limiter
from tests.conftest import TEST_PASSWORD


async def test_login_rate_limit_enforced(test_client, test_user):
    limiter.enabled = True
    limiter.reset()

    payload = {
        "email": "user@test.com",
        "password": TEST_PASSWORD,
        "rememberMe": False,
    }

    for _ in range(10):
        response = await test_client.post("/api/auth/login", json=payload)
        assert response.status_code == 200

    response = await test_client.post("/api/auth/login", json=payload)
    assert response.status_code == 429


async def test_login_rate_limit_disabled_when_setting_off(test_client, test_user):
    payload = {
        "email": "user@test.com",
        "password": TEST_PASSWORD,
        "rememberMe": False,
    }
    for _ in range(15):
        response = await test_client.post("/api/auth/login", json=payload)
        assert response.status_code == 200
