import math
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.email import (
    EmailProvider,
    send_invitation_email,
    send_password_reset_email,
)
from app.core.security import generate_token, hash_password
from app.models.token import Token, TokenType
from app.models.user import User, UserRole
from app.services.session import invalidate_all_sessions

ALLOWED_SORT_FIELDS = {
    "firstName": "first_name",
    "lastName": "last_name",
    "email": "email",
    "role": "role",
    "isActive": "is_active",
    "createdAt": "created_at",
}


async def list_users(
    db: AsyncSession,
    page: int,
    page_size: int,
    search: str | None,
    sort_by: str,
    sort_order: str,
) -> dict:
    if sort_by not in ALLOWED_SORT_FIELDS:
        raise HTTPException(400, f"Invalid sortBy value: {sort_by}")

    if sort_order not in ("asc", "desc"):
        raise HTTPException(400, f"Invalid sortOrder value: {sort_order}")

    model_field = ALLOWED_SORT_FIELDS[sort_by]
    order_col = getattr(User, model_field)

    query = select(User)
    count_query = select(func.count()).select_from(User)

    if search:
        pattern = f"%{search.lower()}%"
        search_filter = or_(
            func.lower(User.email).like(pattern),
            func.lower(User.first_name).like(pattern),
            func.lower(User.last_name).like(pattern),
            func.lower(func.coalesce(User.display_name, "")).like(pattern),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    if sort_order == "desc":
        query = query.order_by(order_col.desc())
    else:
        query = query.order_by(order_col.asc())

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    users = result.scalars().all()

    total_pages = math.ceil(total / page_size) if page_size > 0 else 0

    return {
        "items": users,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


async def get_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(404, "User not found")
    return user


async def create_user(
    db: AsyncSession,
    email_provider: EmailProvider,
    email: str,
    first_name: str,
    last_name: str,
    role: str,
    send_invitation: bool,
) -> User:
    email = email.lower()

    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(409, "Email already registered")

    role_enum = UserRole.ADMIN if role == "admin" else UserRole.USER

    user = User(
        email=email,
        password_hash=hash_password(generate_token()),
        first_name=first_name,
        last_name=last_name,
        role=role_enum,
        is_active=True,
        email_verified=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    if send_invitation:
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

        setup_url = f"{settings.frontend_url}/reset-password?token={token_value}"
        await send_invitation_email(email_provider, user.email, setup_url)

    return user


async def update_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    current_user: User,
    update_data: dict,
    fields_set: set,
) -> User:
    user = await get_user(db, user_id)

    if current_user.id == user_id:
        if "role" in fields_set or "is_active" in fields_set:
            raise HTTPException(400, "Cannot modify your own role or active status")

    if "email" in fields_set and update_data.get("email") is not None:
        new_email = update_data["email"].lower()
        existing = await db.execute(
            select(User).where(User.email == new_email, User.id != user_id)
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(409, "Email already in use")
        update_data["email"] = new_email

    if "role" in fields_set and update_data.get("role") is not None:
        update_data["role"] = (
            UserRole.ADMIN if update_data["role"] == "admin" else UserRole.USER
        )

    deactivating = (
        "is_active" in fields_set
        and update_data.get("is_active") is False
        and user.is_active
    )

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)

    if deactivating:
        await invalidate_all_sessions(db, user.id)

    return user


async def delete_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    current_user: User,
) -> None:
    if current_user.id == user_id:
        raise HTTPException(400, "Cannot delete your own account")

    user = await get_user(db, user_id)

    await invalidate_all_sessions(db, user.id)
    await db.delete(user)
    await db.commit()


async def deactivate_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    current_user: User,
) -> User:
    if current_user.id == user_id:
        raise HTTPException(400, "Cannot deactivate your own account")

    user = await get_user(db, user_id)

    if not user.is_active:
        raise HTTPException(409, "User is already inactive")

    user.is_active = False
    await db.commit()
    await db.refresh(user)

    await invalidate_all_sessions(db, user.id)

    return user


async def reactivate_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    current_user: User,
) -> User:
    user = await get_user(db, user_id)

    if user.is_active:
        raise HTTPException(409, "User is already active")

    user.is_active = True
    await db.commit()
    await db.refresh(user)

    return user


async def force_password_reset(
    db: AsyncSession,
    email_provider: EmailProvider,
    user_id: uuid.UUID,
) -> None:
    user = await get_user(db, user_id)

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


async def _invalidate_unused_tokens(
    db: AsyncSession, user_id: uuid.UUID, token_type: TokenType
) -> None:
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
