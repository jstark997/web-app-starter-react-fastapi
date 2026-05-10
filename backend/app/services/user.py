import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.email import EmailProvider, send_email_change_verification_email
from app.core.security import generate_token, hash_password, verify_password
from app.core.security_log import log_email_change_requested, log_password_change
from app.models.token import Token, TokenType
from app.models.user import User
from app.services.session import invalidate_all_sessions


async def update_profile(
    db: AsyncSession,
    user: User,
    update_data: dict,
) -> User:
    for field, value in update_data.items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


async def change_email(
    db: AsyncSession,
    email_provider: EmailProvider,
    user: User,
    new_email: str,
    current_password: str,
) -> None:
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    new_email = new_email.lower()

    # Check that the new email isn't already used by another account.
    existing = await db.execute(
        select(User).where(User.email == new_email, User.id != user.id)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Email already in use")

    # Invalidate any prior unused email-verification tokens for this user so we
    # don't accumulate orphaned change-email requests.
    await db.execute(
        update(Token)
        .where(
            Token.user_id == user.id,
            Token.token_type == TokenType.EMAIL_VERIFICATION,
            Token.used_at.is_(None),
        )
        .values(used_at=datetime.now(timezone.utc))
    )

    token_value = generate_token()
    token = Token(
        user_id=user.id,
        token=token_value,
        token_type=TokenType.EMAIL_VERIFICATION,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        new_email=new_email,
    )
    db.add(token)
    await db.commit()

    log_email_change_requested(user.id, user.email, new_email)

    verification_url = f"{settings.frontend_url}/verify-email?token={token_value}"
    await send_email_change_verification_email(email_provider, new_email, verification_url)


async def change_password(
    db: AsyncSession,
    user: User,
    current_password: str,
    new_password: str,
    current_session_id: uuid.UUID,
) -> None:
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.password_hash = hash_password(new_password)
    await db.commit()

    await invalidate_all_sessions(
        db,
        user.id,
        reason="password_change",
        except_session_id=current_session_id,
    )
    log_password_change(user.id)
