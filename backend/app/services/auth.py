from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.email import (
    EmailProvider,
    send_password_reset_email,
    send_verification_email,
)
from app.core.security import generate_token, hash_password, verify_password
from app.models.token import Token, TokenType
from app.models.user import User, UserRole
from app.services import whitelist as whitelist_service
from app.services.session import create_session, invalidate_all_sessions, invalidate_session


async def login(
    db: AsyncSession,
    email: str,
    password: str,
    remember_me: bool,
):
    email = email.lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is deactivated")

    if not user.email_verified:
        raise HTTPException(
            status_code=403,
            detail={
                "detail": "Email not verified",
                "emailNotVerified": True,
            },
        )

    session = await create_session(db, user.id, remember_me)
    return user, session


async def register(
    db: AsyncSession,
    email_provider: EmailProvider,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
):
    email = email.lower()

    await whitelist_service.assert_email_allowed(db, email)

    # Check duplicate email
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Email already registered")

    # Create user
    user = User(
        email=email,
        password_hash=hash_password(password),
        first_name=first_name,
        last_name=last_name,
        role=UserRole.USER,
        is_active=True,
        email_verified=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Generate verification token and send email
    await _create_and_send_verification_token(db, email_provider, user)


async def verify_email(db: AsyncSession, token_str: str):
    token = await _validate_token(db, token_str, TokenType.EMAIL_VERIFICATION)

    token.used_at = datetime.now(timezone.utc)

    # If this token was issued for a change-email flow, swap the user's email.
    # We re-check uniqueness here in case another account claimed the address
    # between when the token was issued and when it was consumed.
    if token.new_email is not None:
        existing = await db.execute(
            select(User).where(User.email == token.new_email, User.id != token.user_id)
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=409, detail="Email already in use")
        token.user.email = token.new_email

    token.user.email_verified = True
    await db.commit()


async def resend_verification(
    db: AsyncSession,
    email_provider: EmailProvider,
    email: str,
):
    email = email.lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None or user.email_verified:
        return  # Always 200 — don't reveal user existence

    # Invalidate existing unused verification tokens
    await _invalidate_unused_tokens(db, user.id, TokenType.EMAIL_VERIFICATION)
    await _create_and_send_verification_token(db, email_provider, user)


async def forgot_password(
    db: AsyncSession,
    email_provider: EmailProvider,
    email: str,
):
    email = email.lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        return  # Always 200 — don't reveal user existence

    # Invalidate existing unused password reset tokens
    await _invalidate_unused_tokens(db, user.id, TokenType.PASSWORD_RESET)

    token_value = generate_token()
    token = Token(
        user_id=user.id,
        token=token_value,
        token_type=TokenType.PASSWORD_RESET,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(token)
    await db.commit()

    reset_url = f"{settings.frontend_url}/reset-password?token={token_value}"
    await send_password_reset_email(email_provider, user.email, reset_url)


async def reset_password(db: AsyncSession, token_str: str, new_password: str):
    token = await _validate_token(db, token_str, TokenType.PASSWORD_RESET)

    token.used_at = datetime.now(timezone.utc)
    token.user.password_hash = hash_password(new_password)
    await db.commit()

    await invalidate_all_sessions(db, token.user_id)


async def logout(db: AsyncSession, session_id):
    await invalidate_session(db, session_id)


# --- Private helpers ---


async def _validate_token(
    db: AsyncSession, token_str: str, expected_type: TokenType
) -> Token:
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(Token)
        .where(
            Token.token == token_str,
            Token.token_type == expected_type,
            Token.used_at.is_(None),
            Token.expires_at > datetime.now(timezone.utc),
        )
        .options(selectinload(Token.user))
    )
    token = result.scalar_one_or_none()
    if token is None:
        detail = (
            "Invalid or expired verification token"
            if expected_type == TokenType.EMAIL_VERIFICATION
            else "Invalid or expired reset token"
        )
        raise HTTPException(status_code=400, detail=detail)
    return token


async def _invalidate_unused_tokens(
    db: AsyncSession, user_id, token_type: TokenType
):
    await db.execute(
        update(Token)
        .where(
            Token.user_id == user_id,
            Token.token_type == token_type,
            Token.used_at.is_(None),
        )
        .values(used_at=datetime.now(timezone.utc))
    )
    await db.flush()


async def _create_and_send_verification_token(
    db: AsyncSession, email_provider: EmailProvider, user: User
):
    token_value = generate_token()
    token = Token(
        user_id=user.id,
        token=token_value,
        token_type=TokenType.EMAIL_VERIFICATION,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(token)
    await db.commit()

    verification_url = f"{settings.frontend_url}/verify-email?token={token_value}"
    await send_verification_email(email_provider, user.email, verification_url)
