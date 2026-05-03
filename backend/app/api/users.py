from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.email import EmailProvider
from app.dependencies.auth import require_admin
from app.dependencies.providers import get_email_provider
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.user import (
    AdminUserResponse,
    CreateUserRequest,
    UpdateUserRequest,
    UserListResponse,
)
from app.services import admin as admin_service

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100, alias="pageSize"),
    search: str | None = None,
    sort_by: str = Query("createdAt", alias="sortBy"),
    sort_order: str = Query("desc", alias="sortOrder"),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await admin_service.list_users(db, page, page_size, search, sort_by, sort_order)
    return UserListResponse(
        items=[AdminUserResponse.model_validate(u) for u in result["items"]],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
        total_pages=result["total_pages"],
    )


@router.get("/{user_id}", response_model=AdminUserResponse)
async def get_user(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await admin_service.get_user(db, user_id)
    return AdminUserResponse.model_validate(user)


@router.post("", response_model=AdminUserResponse, status_code=201)
async def create_user(
    body: CreateUserRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    email_provider: EmailProvider = Depends(get_email_provider),
):
    user = await admin_service.create_user(
        db,
        email_provider,
        body.email,
        body.first_name,
        body.last_name,
        body.role,
        body.send_invitation,
    )
    return AdminUserResponse.model_validate(user)


@router.patch("/{user_id}", response_model=AdminUserResponse)
async def update_user(
    user_id: UUID,
    body: UpdateUserRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    update_data = body.model_dump(include=body.model_fields_set, by_alias=False)
    user = await admin_service.update_user(db, user_id, admin, update_data, body.model_fields_set)
    return AdminUserResponse.model_validate(user)


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await admin_service.delete_user(db, user_id, admin)


@router.post("/{user_id}/deactivate", response_model=AdminUserResponse)
async def deactivate_user(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await admin_service.deactivate_user(db, user_id, admin)
    return AdminUserResponse.model_validate(user)


@router.post("/{user_id}/reactivate", response_model=AdminUserResponse)
async def reactivate_user(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await admin_service.reactivate_user(db, user_id, admin)
    return AdminUserResponse.model_validate(user)


@router.post("/{user_id}/force-password-reset", response_model=MessageResponse)
async def force_password_reset(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    email_provider: EmailProvider = Depends(get_email_provider),
):
    await admin_service.force_password_reset(db, email_provider, user_id)
    return MessageResponse(detail="Password reset email sent.")
