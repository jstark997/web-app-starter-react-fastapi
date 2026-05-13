import secrets

import bcrypt

# bcrypt silently truncates inputs longer than 72 bytes. Reject at the boundary
# instead of letting the user think the trailing bytes are protecting them.
MAX_PASSWORD_BYTES = 72


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def validate_password_bytes(v: str) -> str:
    if len(v.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(
            f"Password must be at most {MAX_PASSWORD_BYTES} bytes when UTF-8 encoded"
        )
    return v


def generate_token() -> str:
    return secrets.token_urlsafe(32)
