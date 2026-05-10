import uuid

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.email import EmailProvider
from app.core.rate_limit import get_client_ip, limiter
from app.dependencies.auth import get_current_user
from app.dependencies.providers import get_email_provider
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    UserResponse,
    VerifyEmailRequest,
)
from app.schemas.user import ChangePasswordRequest
from app.services import auth as auth_service
from app.services import user as user_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=UserResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user, session = await auth_service.login(
        db, body.email, body.password, body.remember_me, get_client_ip(request)
    )

    max_age = int((session.expires_at - session.created_at).total_seconds())
    response.set_cookie(
        key="session_id",
        value=str(session.id),
        max_age=max_age,
        httponly=True,
        samesite=settings.session_cookie_samesite,
        secure=settings.session_cookie_secure,
    )

    return UserResponse.model_validate(user)


@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import uuid
    session_id = uuid.UUID(request.cookies.get("session_id"))
    await auth_service.logout(db, session_id, user.id)
    response.delete_cookie(
        key="session_id",
        httponly=True,
        samesite=settings.session_cookie_samesite,
        secure=settings.session_cookie_secure,
    )


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)


@router.post("/register", status_code=201, response_model=MessageResponse)
@limiter.limit("5/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    email_provider: EmailProvider = Depends(get_email_provider),
):
    await auth_service.register(
        db,
        email_provider,
        body.email,
        body.password,
        body.first_name,
        body.last_name,
        get_client_ip(request),
    )
    return MessageResponse(
        detail="Registration successful. Please check your email to verify your account."
    )


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(
    body: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
):
    await auth_service.verify_email(db, body.token)
    return MessageResponse(detail="Email verified successfully.")


@router.post("/resend-verification", response_model=MessageResponse)
@limiter.limit("5/minute")
async def resend_verification(
    request: Request,
    body: ResendVerificationRequest,
    db: AsyncSession = Depends(get_db),
    email_provider: EmailProvider = Depends(get_email_provider),
):
    await auth_service.resend_verification(db, email_provider, body.email)
    return MessageResponse(
        detail="If an unverified account with that email exists, a new verification link has been sent."
    )


@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
    email_provider: EmailProvider = Depends(get_email_provider),
):
    await auth_service.forgot_password(
        db, email_provider, body.email, get_client_ip(request)
    )
    return MessageResponse(
        detail="If an account with that email exists, a password reset link has been sent."
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    await auth_service.reset_password(db, body.token, body.password)
    return MessageResponse(detail="Password reset successfully.")


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    body: ChangePasswordRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_session_id = uuid.UUID(request.cookies.get("session_id"))
    await user_service.change_password(
        db, user, body.current_password, body.new_password, current_session_id
    )
    return MessageResponse(detail="Password changed successfully.")
