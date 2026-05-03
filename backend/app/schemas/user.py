from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic.alias_generators import to_camel


class ProfileResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        alias_generator=to_camel,
    )

    id: UUID
    email: str
    first_name: str
    last_name: str
    display_name: str | None
    avatar_url: str | None
    role: str
    is_active: bool
    email_verified: bool
    created_at: datetime

    @field_validator("role", mode="before")
    @classmethod
    def serialize_role(cls, v):
        if hasattr(v, "value"):
            return v.value
        return v


# --- Admin schemas ---


class AdminUserResponse(ProfileResponse):
    updated_at: datetime


class UserListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    items: list[AdminUserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class CreateUserRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    email: EmailStr
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    role: str
    send_invitation: bool = False

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v not in ("user", "admin"):
            raise ValueError("role must be 'user' or 'admin'")
        return v


class UpdateUserRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    first_name: str | None = Field(default=None, min_length=1)
    last_name: str | None = Field(default=None, min_length=1)
    display_name: str | None = None
    email: EmailStr | None = None
    role: str | None = None
    is_active: bool | None = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v is not None and v not in ("user", "admin"):
            raise ValueError("role must be 'user' or 'admin'")
        return v


class UpdateProfileRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    first_name: str | None = Field(default=None, min_length=1)
    last_name: str | None = Field(default=None, min_length=1)
    display_name: str | None = None
    avatar_url: str | None = None


class ChangeEmailRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    new_email: EmailStr
    current_password: str


class ChangePasswordRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    current_password: str
    new_password: str = Field(min_length=8)
