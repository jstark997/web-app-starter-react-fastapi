import uuid

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User, UserRole
from app.services.session import get_session


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    session_id_str = request.cookies.get("session_id")
    if session_id_str is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        session_id = uuid.UUID(session_id_str)
    except ValueError:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if not session.user.is_active:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return session.user


async def require_admin(
    user: User = Depends(get_current_user),
) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
