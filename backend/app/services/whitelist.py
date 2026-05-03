import uuid

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.whitelist import WhitelistEntry, WhitelistSettings
from app.services.session import invalidate_all_sessions


async def get_or_create_settings(db: AsyncSession) -> WhitelistSettings:
    result = await db.execute(select(WhitelistSettings).where(WhitelistSettings.id == 1))
    settings_row = result.scalar_one_or_none()
    if settings_row is None:
        settings_row = WhitelistSettings(id=1, enabled=False)
        db.add(settings_row)
        await db.commit()
        await db.refresh(settings_row)
    return settings_row


async def update_settings(db: AsyncSession, enabled: bool) -> WhitelistSettings:
    settings_row = await get_or_create_settings(db)
    if settings_row.enabled == enabled:
        return settings_row
    settings_row.enabled = enabled
    await db.commit()
    await db.refresh(settings_row)
    return settings_row


async def list_entries(db: AsyncSession) -> dict:
    result = await db.execute(
        select(WhitelistEntry).order_by(WhitelistEntry.created_at.desc())
    )
    items = list(result.scalars().all())

    count_result = await db.execute(select(func.count()).select_from(WhitelistEntry))
    total = count_result.scalar_one()

    return {"items": items, "total": total}


async def add_entry(
    db: AsyncSession, email: str, created_by_id: uuid.UUID
) -> WhitelistEntry:
    email = email.lower()

    existing = await db.execute(select(WhitelistEntry).where(WhitelistEntry.email == email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Email is already on the whitelist")

    entry = WhitelistEntry(email=email, created_by_id=created_by_id)
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def delete_entry(db: AsyncSession, entry_id: uuid.UUID) -> None:
    result = await db.execute(select(WhitelistEntry).where(WhitelistEntry.id == entry_id))
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Whitelist entry not found")

    removed_email = entry.email

    await db.execute(delete(WhitelistEntry).where(WhitelistEntry.id == entry_id))
    await db.commit()

    settings_row = await get_or_create_settings(db)
    if settings_row.enabled:
        user_result = await db.execute(select(User).where(User.email == removed_email))
        user = user_result.scalar_one_or_none()
        if user is not None:
            await invalidate_all_sessions(db, user.id)


async def assert_email_allowed(db: AsyncSession, email: str) -> None:
    settings_row = await get_or_create_settings(db)
    if not settings_row.enabled:
        return

    email = email.lower()
    result = await db.execute(select(WhitelistEntry).where(WhitelistEntry.email == email))
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=403,
            detail={
                "detail": "Registration restricted",
                "whitelistRestricted": True,
            },
        )
