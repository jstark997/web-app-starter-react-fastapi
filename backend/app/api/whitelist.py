from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_admin
from app.models.user import User
from app.schemas.whitelist import (
    CreateWhitelistEntryRequest,
    UpdateWhitelistSettingsRequest,
    WhitelistEntryResponse,
    WhitelistListResponse,
    WhitelistSettingsResponse,
)
from app.services import whitelist as whitelist_service

router = APIRouter(prefix="/api/whitelist", tags=["whitelist"])


@router.get("/settings", response_model=WhitelistSettingsResponse)
async def get_whitelist_settings(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    settings_row = await whitelist_service.get_or_create_settings(db)
    return WhitelistSettingsResponse.model_validate(settings_row)


@router.patch("/settings", response_model=WhitelistSettingsResponse)
async def update_whitelist_settings(
    body: UpdateWhitelistSettingsRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    settings_row = await whitelist_service.update_settings(db, body.enabled, admin.id)
    return WhitelistSettingsResponse.model_validate(settings_row)


@router.get("", response_model=WhitelistListResponse)
async def list_whitelist_entries(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await whitelist_service.list_entries(db)
    return WhitelistListResponse(
        items=[WhitelistEntryResponse.model_validate(e) for e in result["items"]],
        total=result["total"],
    )


@router.post("", response_model=WhitelistEntryResponse, status_code=201)
async def create_whitelist_entry(
    body: CreateWhitelistEntryRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    entry = await whitelist_service.add_entry(db, body.email, admin.id)
    return WhitelistEntryResponse.model_validate(entry)


@router.delete("/{entry_id}", status_code=204)
async def delete_whitelist_entry(
    entry_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await whitelist_service.delete_entry(db, entry_id, admin.id)
