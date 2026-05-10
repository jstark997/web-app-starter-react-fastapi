import logging
import uuid

logger = logging.getLogger("app.security")


def _emit(event: str, **fields) -> None:
    logger.info(event, extra={"event": event, **fields})


def log_login_success(user_id: uuid.UUID, ip: str) -> None:
    _emit("auth.login.success", user_id=str(user_id), ip=ip)


def log_login_failure(email: str, ip: str, reason: str) -> None:
    _emit("auth.login.failure", email=email, ip=ip, reason=reason)


def log_register(user_id: uuid.UUID, email: str, ip: str) -> None:
    _emit("auth.register", user_id=str(user_id), email=email, ip=ip)


def log_email_verified(user_id: uuid.UUID) -> None:
    _emit("auth.email_verified", user_id=str(user_id))


def log_password_reset_requested(user_id: uuid.UUID, ip: str) -> None:
    _emit("auth.password_reset.requested", user_id=str(user_id), ip=ip)


def log_password_reset_completed(user_id: uuid.UUID) -> None:
    _emit("auth.password_reset.completed", user_id=str(user_id))


def log_password_change(user_id: uuid.UUID) -> None:
    _emit("auth.password_change", user_id=str(user_id))


def log_email_change_requested(
    user_id: uuid.UUID, old_email: str, new_email: str
) -> None:
    _emit(
        "auth.email_change.requested",
        user_id=str(user_id),
        old_email=old_email,
        new_email=new_email,
    )


def log_email_change_completed(
    user_id: uuid.UUID, old_email: str, new_email: str
) -> None:
    _emit(
        "auth.email_change.completed",
        user_id=str(user_id),
        old_email=old_email,
        new_email=new_email,
    )


def log_admin_user_created(actor_id: uuid.UUID, target_id: uuid.UUID) -> None:
    _emit("admin.user.created", actor_id=str(actor_id), target_id=str(target_id))


def log_admin_user_updated(
    actor_id: uuid.UUID, target_id: uuid.UUID, fields: list[str]
) -> None:
    _emit(
        "admin.user.updated",
        actor_id=str(actor_id),
        target_id=str(target_id),
        fields=sorted(fields),
    )


def log_admin_user_deleted(actor_id: uuid.UUID, target_id: uuid.UUID) -> None:
    _emit("admin.user.deleted", actor_id=str(actor_id), target_id=str(target_id))


def log_admin_user_deactivated(actor_id: uuid.UUID, target_id: uuid.UUID) -> None:
    _emit("admin.user.deactivated", actor_id=str(actor_id), target_id=str(target_id))


def log_admin_user_reactivated(actor_id: uuid.UUID, target_id: uuid.UUID) -> None:
    _emit("admin.user.reactivated", actor_id=str(actor_id), target_id=str(target_id))


def log_admin_force_password_reset(
    actor_id: uuid.UUID, target_id: uuid.UUID
) -> None:
    _emit(
        "admin.user.force_password_reset",
        actor_id=str(actor_id),
        target_id=str(target_id),
    )


def log_whitelist_toggled(actor_id: uuid.UUID, enabled: bool) -> None:
    _emit("whitelist.toggled", actor_id=str(actor_id), enabled=enabled)


def log_whitelist_added(actor_id: uuid.UUID, email: str) -> None:
    _emit("whitelist.added", actor_id=str(actor_id), email=email)


def log_whitelist_deleted(actor_id: uuid.UUID, email: str) -> None:
    _emit("whitelist.deleted", actor_id=str(actor_id), email=email)


def log_session_invalidated(
    user_id: uuid.UUID, reason: str, count: int
) -> None:
    _emit(
        "session.invalidated",
        user_id=str(user_id),
        reason=reason,
        count=count,
    )
