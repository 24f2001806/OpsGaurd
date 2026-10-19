import logging
import smtplib
from email.message import EmailMessage

import httpx
import psycopg
from psycopg.rows import dict_row

from app.config import settings

logger = logging.getLogger("opsguard.alerts")


def get_alert_config(endpoint_id: int) -> dict | None:
    """Read the notification preferences for an endpoint."""
    query = """
        SELECT email_enabled, slack_enabled,
               email_address, slack_webhook
        FROM alert_configurations
        WHERE endpoint_id = %s
    """

    with psycopg.connect(settings.database_url) as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(query, (endpoint_id,))
            return cursor.fetchone()


def send_email(
    recipient: str,
    subject: str,
    body: str,
) -> None:
    """Send an email using configured Gmail account with TLS on Port 587."""
    if not settings.sender_email or not settings.sender_password:
        logger.error("Email alert skipped: sender credentials are missing")
        return

    message = EmailMessage()
    message["From"] = settings.sender_email
    message["To"] = recipient or settings.sender_email
    message["Subject"] = subject
    message.set_content(body)

    try:
        # Use Port 587 with STARTTLS to prevent connection resets on Port 465
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as smtp:
            smtp.starttls()
            smtp.login(
                settings.sender_email,
                settings.sender_password.replace(" ", ""),
            )
            smtp.send_message(message)
        logger.info("Email alert sent successfully to %s", recipient or settings.sender_email)
    except Exception:
        logger.exception("Failed to send email via SMTP")


def send_slack(webhook: str, message: str) -> None:
    """Send a message to the endpoint's configured Slack webhook."""
    response = httpx.post(
        webhook,
        json={"text": message},
        timeout=15,
    )
    response.raise_for_status()
    logger.info("Slack alert sent successfully")


def notify_endpoint(
    endpoint_id: int,
    url: str,
    event: str,
) -> None:
    """Send notifications for DOWN or RECOVERED transitions with .env fallbacks."""
    try:
        config = get_alert_config(endpoint_id) or {}

        if event == "DOWN":
            subject = f"[OpsGuard] Endpoint DOWN: {url}"
            message = (
                f"🚨 OpsGuard Alert\n\n"
                f"Endpoint: {url}\n"
                f"Endpoint ID: {endpoint_id}\n"
                f"Status: DOWN\n"
                f"Action: Investigate the endpoint."
            )
        elif event == "RECOVERED":
            subject = f"[OpsGuard] Endpoint recovered: {url}"
            message = (
                f"✅ OpsGuard Recovery\n\n"
                f"Endpoint: {url}\n"
                f"Endpoint ID: {endpoint_id}\n"
                f"Status: HEALTHY\n"
                f"The endpoint has recovered."
            )
        else:
            logger.warning("Unknown alert event: %s", event)
            return

        # Fall back to .env Slack Webhook if database record is empty
        slack_webhook = config.get("slack_webhook") or settings.slack_webhook_url
        slack_enabled = config.get("slack_enabled", True)

        if slack_enabled and slack_webhook:
            try:
                send_slack(slack_webhook, message)
            except Exception:
                logger.exception("Slack notification failed for endpoint %s", endpoint_id)

        # Fall back to SENDER_EMAIL if database email_address is empty
        email_address = config.get("email_address") or settings.sender_email
        email_enabled = config.get("email_enabled", True)

        if email_enabled and email_address:
            try:
                send_email(email_address, subject, message)
            except Exception:
                logger.exception("Email notification failed for endpoint %s", endpoint_id)

    except Exception:
        logger.exception("Could not process alerts for endpoint %s", endpoint_id)