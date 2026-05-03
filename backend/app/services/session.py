import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.session import Session


async def create_session(
    db: AsyncSession,
    user_id: uuid.UUID,
    remember_me: bool = False,
) -> Session:
    duration = timedelta(days=30) if remember_me else timedelta(hours=24)
    expires_at = datetime.now(timezone.utc) + duration
    session = Session(user_id=user_id, expires_at=expires_at)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def get_session(
    db: AsyncSession,
    session_id: uuid.UUID,
) -> Session | None:
    result = await db.execute(
        select(Session)
        .where(Session.id == session_id, Session.expires_at > datetime.now(timezone.utc))
        .options(selectinload(Session.user))
    )
    return result.scalar_one_or_none()


async def invalidate_session(db: AsyncSession, session_id: uuid.UUID) -> None:
    await db.execute(delete(Session).where(Session.id == session_id))
    await db.commit()


async def invalidate_all_sessions(
    db: AsyncSession,
    user_id: uuid.UUID,
    except_session_id: uuid.UUID | None = None,
) -> None:
    stmt = delete(Session).where(Session.user_id == user_id)
    if except_session_id is not None:
        stmt = stmt.where(Session.id != except_session_id)
    await db.execute(stmt)
    await db.commit()
