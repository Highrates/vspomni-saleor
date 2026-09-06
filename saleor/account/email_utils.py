import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def is_site_email_configured() -> bool:
    backend = (getattr(settings, "EMAIL_BACKEND", "") or "").strip()
    if not backend:
        return False
    if backend.endswith("console.EmailBackend"):
        return False
    if "smtp" in backend.lower():
        return bool((getattr(settings, "EMAIL_HOST", "") or "").strip())
    return True


def get_site_email_config_error() -> str | None:
    if is_site_email_configured():
        return None
    backend = getattr(settings, "EMAIL_BACKEND", "") or "(empty)"
    host = getattr(settings, "EMAIL_HOST", "") or "(empty)"
    return (
        "Почта не настроена на сервере. Задайте EMAIL_URL (SMTP) и DEFAULT_FROM_EMAIL "
        f"в .env API. Текущий backend={backend}, host={host}"
    )


def send_site_email(
    *,
    subject: str,
    message: str,
    recipient: str,
    html_message: str | None = None,
) -> int:
    from django.core.mail import get_connection, send_mail

    config_error = get_site_email_config_error()
    if config_error:
        logger.error("Site email blocked: %s", config_error)
        raise RuntimeError(config_error)

    connection = get_connection(timeout=15)
    sent = send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [recipient],
        fail_silently=False,
        connection=connection,
        html_message=html_message,
    )
    logger.info(
        "Site email sent to %s subject=%r from=%s sent=%s",
        recipient,
        subject,
        settings.DEFAULT_FROM_EMAIL,
        sent,
    )
    return sent
