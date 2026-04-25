"""
Provider-based transactional email (SMTP, SendGrid).

All sends return EmailSendResult; callers must not assume exceptions for normal failures.
"""

from __future__ import annotations

import logging
import smtplib
from dataclasses import dataclass
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from ssl import create_default_context
from typing import Protocol

import httpx
from sqlalchemy.orm import Session

from app.config.settings import Settings
from app.db.models import EmailSettings
from app.services import email_settings_service

logger = logging.getLogger(__name__)

SENDGRID_API = "https://api.sendgrid.com/v3/mail/send"


@dataclass
class EmailSendResult:
    ok: bool
    message: str


class _EmailTransport(Protocol):
    def send(
        self,
        *,
        to_addresses: list[str],
        subject: str,
        text_body: str,
        html_body: str | None,
    ) -> EmailSendResult: ...


class _SmtpTransport:
    def __init__(
        self,
        *,
        host: str,
        port: int,
        use_tls: bool,
        use_ssl: bool,
        user: str,
        password: str | None,
        from_email: str,
        from_name: str,
    ) -> None:
        self._host = host.strip()
        self._port = int(port)
        self._use_tls = use_tls
        self._use_ssl = use_ssl
        self._user = (user or "").strip()
        self._password = password or ""
        self._from_email = from_email.strip()
        self._from_name = (from_name or "").strip() or "ProjectPilot"

    def send(
        self,
        *,
        to_addresses: list[str],
        subject: str,
        text_body: str,
        html_body: str | None,
    ) -> EmailSendResult:
        recipients = [a.strip() for a in to_addresses if a and a.strip()]
        if not recipients:
            return EmailSendResult(False, "No recipients")

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{self._from_name} <{self._from_email}>"
        msg["To"] = ", ".join(recipients)
        msg.attach(MIMEText(text_body, "plain", "utf-8"))
        if html_body:
            msg.attach(MIMEText(html_body, "html", "utf-8"))

        ctx = create_default_context()
        try:
            if self._use_ssl:
                client = smtplib.SMTP_SSL(self._host, self._port, context=ctx, timeout=30)
            else:
                client = smtplib.SMTP(self._host, self._port, timeout=30)
            try:
                client.ehlo()
                if self._use_tls and not self._use_ssl:
                    client.starttls(context=ctx)
                    client.ehlo()
                if self._user:
                    client.login(self._user, self._password)
                client.sendmail(self._from_email, recipients, msg.as_string())
            finally:
                try:
                    client.quit()
                except Exception:
                    pass
        except OSError as exc:
            logger.warning("SMTP send failed (network): %s", exc)
            return EmailSendResult(False, f"SMTP connection failed: {exc}")
        except smtplib.SMTPException as exc:
            logger.warning("SMTP send failed: %s", exc)
            return EmailSendResult(False, f"SMTP error: {exc}")
        except Exception as exc:
            logger.exception("SMTP send unexpected error")
            return EmailSendResult(False, str(exc))

        return EmailSendResult(True, "Message sent")


class _SendGridTransport:
    def __init__(self, *, api_key: str, from_email: str, from_name: str) -> None:
        self._api_key = api_key.strip()
        self._from_email = from_email.strip()
        self._from_name = (from_name or "").strip() or "ProjectPilot"

    def send(
        self,
        *,
        to_addresses: list[str],
        subject: str,
        text_body: str,
        html_body: str | None,
    ) -> EmailSendResult:
        recipients = [{"email": a.strip()} for a in to_addresses if a and a.strip()]
        if not recipients:
            return EmailSendResult(False, "No recipients")

        content = [{"type": "text/plain", "value": text_body}]
        if html_body:
            content.append({"type": "text/html", "value": html_body})

        payload = {
            "personalizations": [{"to": recipients}],
            "from": {"email": self._from_email, "name": self._from_name},
            "subject": subject,
            "content": content,
        }

        try:
            r = httpx.post(
                SENDGRID_API,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=30.0,
            )
        except OSError as exc:
            logger.warning("SendGrid request failed (network): %s", exc)
            return EmailSendResult(False, f"SendGrid connection failed: {exc}")
        except Exception as exc:
            logger.exception("SendGrid unexpected error")
            return EmailSendResult(False, str(exc))

        if r.status_code >= 400:
            detail = (r.text or "")[:500]
            logger.warning("SendGrid API error %s: %s", r.status_code, detail)
            return EmailSendResult(False, f"SendGrid API error ({r.status_code})")

        return EmailSendResult(True, "Message sent")


class EmailService:
    """Transactional email using DB-backed provider configuration."""

    def __init__(self, settings: Settings, db: Session) -> None:
        self._settings = settings
        self._db = db

    def _build_transport(self, row: EmailSettings) -> _EmailTransport | None:
        prov = (row.provider or "smtp").strip().lower()
        if prov == "sendgrid":
            key = email_settings_service.api_key_plain(self._settings, row)
            if not key:
                return None
            if not (row.from_email or "").strip():
                return None
            return _SendGridTransport(api_key=key, from_email=row.from_email, from_name=row.from_name or "ProjectPilot")

        # smtp (default)
        gap = email_settings_service.describe_ready_gap(row, self._settings)
        if gap:
            logger.debug("SMTP not ready: %s", gap)
            return None
        pw = email_settings_service.smtp_password_plain(self._settings, row)
        if (row.smtp_user or "").strip() and pw is None:
            return None
        return _SmtpTransport(
            host=row.smtp_host,
            port=int(row.smtp_port or 587),
            use_tls=bool(row.use_tls),
            use_ssl=bool(row.use_ssl),
            user=row.smtp_user or "",
            password=pw,
            from_email=row.from_email or "",
            from_name=row.from_name or "ProjectPilot",
        )

    def send_transactional(
        self,
        *,
        to_addresses: list[str],
        subject: str,
        text_body: str,
        html_body: str | None = None,
    ) -> EmailSendResult:
        row = email_settings_service.get_or_create(self._db)
        if not row.enabled:
            return EmailSendResult(False, "Email sending is disabled")
        transport = self._build_transport(row)
        if transport is None:
            msg = email_settings_service.describe_send_failure_reason(row, self._settings)
            return EmailSendResult(False, msg or "Email is not configured")
        try:
            return transport.send(
                to_addresses=to_addresses,
                subject=subject,
                text_body=text_body,
                html_body=html_body,
            )
        except Exception as exc:
            logger.exception("EmailService.send_transactional failed")
            return EmailSendResult(False, str(exc))

    def send_password_reset_email(
        self,
        *,
        to_email: str,
        user_name: str,
        reset_link: str,
        product_name: str = "ProjectPilot",
    ) -> EmailSendResult:
        subject = f"{product_name} — reset your password"
        text_body = (
            f"Hello{(' ' + user_name) if user_name.strip() else ''},\n\n"
            f"We received a request to reset your password for {product_name}.\n"
            f"Open this link to choose a new password (valid for a limited time):\n\n"
            f"{reset_link}\n\n"
            "If you did not request this, you can ignore this email.\n"
        )
        html_body = f"""\
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#222;">
<p>Hello{(" " + user_name) if user_name.strip() else ""},</p>
<p>We received a request to reset your password for <strong>{product_name}</strong>.</p>
<p><a href="{reset_link}">Choose a new password</a></p>
<p style="font-size:0.9em;color:#555;">If the button does not work, copy this URL:<br/>
<code style="word-break:break-all;">{reset_link}</code></p>
<p style="font-size:0.9em;">If you did not request this, you can ignore this email.</p>
</body></html>"""
        return self.send_transactional(
            to_addresses=[to_email],
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        )

    def send_test_email(self, *, to_email: str) -> EmailSendResult:
        subject = "ProjectPilot — email test"
        text_body = (
            "This is a test message from your ProjectPilot email configuration.\n"
            "If you received it, your provider settings are working.\n"
        )
        html_body = (
            "<p>This is a <strong>test message</strong> from your ProjectPilot email configuration.</p>"
            "<p>If you received it, your provider settings are working.</p>"
        )
        return self.send_transactional(
            to_addresses=[to_email],
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        )
