from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.email import EmailProvider
from app.dependencies.auth import get_current_user
from app.dependencies.providers import get_email_provider
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.user import (
    ChangeEmailRequest,
    ProfileResponse,
    UpdateProfileRequest,
)
from app.services import user as user_service

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("", response_model=ProfileResponse)
async def get_profile(user: User = Depends(get_current_user)):
    return ProfileResponse.model_validate(user)


@router.patch("", response_model=ProfileResponse)
async def update_profile(
    body: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    update_data = body.model_dump(include=body.model_fields_set, by_alias=False)
    updated = await user_service.update_profile(db, user, update_data)
    return ProfileResponse.model_validate(updated)


@router.post("/change-email", response_model=MessageResponse)
async def change_email(
    body: ChangeEmailRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    email_provider: EmailProvider = Depends(get_email_provider),
):
    await user_service.change_email(
        db, email_provider, user, body.new_email, body.current_password
    )
    return MessageResponse(
        detail="A verification link has been sent to your new email address."
    )
