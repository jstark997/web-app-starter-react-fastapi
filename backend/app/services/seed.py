import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.models import User, UserRole

logger = logging.getLogger(__name__)


async def seed_admin_user(db: AsyncSession) -> None:
    if not all([
        settings.admin_email,
        settings.admin_password,
        settings.admin_first_name,
        settings.admin_last_name,
    ]):
        logger.debug("Admin seed env vars not fully configured, skipping")
        return

    email = settings.admin_email.lower()

    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none() is not None:
        logger.info("Admin user already exists, skipping seed")
        return

    user = User(
        email=email,
        password_hash=hash_password(settings.admin_password),
        first_name=settings.admin_first_name,
        last_name=settings.admin_last_name,
        role=UserRole.ADMIN,
        is_active=True,
        email_verified=True,
    )
    db.add(user)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        logger.info("Admin user created by another process, skipping")
        return

    logger.info("Seeded default admin user: %s", email)
