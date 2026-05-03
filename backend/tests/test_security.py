from app.core.security import generate_token, hash_password, verify_password


def test_hash_password_returns_bcrypt_hash():
    hashed = hash_password("mypassword")
    assert hashed.startswith("$2b$")
    assert hashed != "mypassword"


def test_verify_password_correct():
    hashed = hash_password("mypassword")
    assert verify_password("mypassword", hashed) is True


def test_verify_password_incorrect():
    hashed = hash_password("mypassword")
    assert verify_password("wrongpassword", hashed) is False


def test_hash_password_different_hashes_for_same_input():
    h1 = hash_password("mypassword")
    h2 = hash_password("mypassword")
    assert h1 != h2


def test_generate_token_returns_string():
    token = generate_token()
    assert isinstance(token, str)


def test_generate_token_expected_length():
    token = generate_token()
    assert len(token) == 43


def test_generate_token_unique():
    t1 = generate_token()
    t2 = generate_token()
    assert t1 != t2
