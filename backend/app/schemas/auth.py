from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic.alias_generators import to_camel

from app.core.security import MAX_PASSWORD_BYTES, validate_password_bytes


class UserResponse(BaseModel):
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

    @field_validator("role", mode="before")
    @classmethod
    def serialize_role(cls, v):
        if hasattr(v, "value"):
            return v.value
        return v


class LoginRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    email: EmailStr
    password: str = Field(max_length=MAX_PASSWORD_BYTES)
    remember_me: bool = False


class RegisterRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    email: EmailStr
    password: str = Field(min_length=8, max_length=MAX_PASSWORD_BYTES)
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)

    _validate_password_bytes = field_validator("password")(validate_password_bytes)


class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=MAX_PASSWORD_BYTES)

    _validate_password_bytes = field_validator("password")(validate_password_bytes)


class MessageResponse(BaseModel):
    detail: str
