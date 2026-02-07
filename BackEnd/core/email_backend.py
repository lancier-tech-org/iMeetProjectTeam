"""
File: core/email_backend.py
CREATE THIS NEW FILE at: core/email_backend.py

This backend:
1. Tries AWS SES (noreply@lancieretech.com)
2. If SES fails → automatically sends via Gmail SMTP (prathigudupuj@gmail.com)
3. If both fail → logs full error

Django calls this automatically when you do EmailMessage.send()
because settings.py sets EMAIL_BACKEND = 'core.email_backend.SESWithFallbackBackend'
"""
import logging
import traceback
from django.conf import settings
from django.core.mail.backends.smtp import EmailBackend as SMTPBackend

logger = logging.getLogger('meetings')


class SESWithFallbackBackend:

    def __init__(self, fail_silently=False, **kwargs):
        self.fail_silently = fail_silently

    def open(self):
        return True

    def close(self):
        pass

    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        # Log what we are trying to send
        for msg in email_messages:
            logger.info(f"📧 Sending email: to={msg.to}, from={msg.from_email}, subject={msg.subject}")

        # ==========================================
        # ATTEMPT 1: AWS SES (noreply@lancieretech.com)
        # ==========================================
        try:
            from django_ses import SESBackend
            ses = SESBackend(fail_silently=False)
            logger.info(f"📧 [SES] Trying AWS SES with from={email_messages[0].from_email}...")
            sent = ses.send_messages(email_messages)
            if sent and sent > 0:
                logger.info(f"✅ [SES] Success! Sent {sent} email(s) via AWS SES")
                return sent
            else:
                logger.warning(f"⚠️ [SES] Returned 0 sent — falling back to Gmail SMTP")
        except ImportError:
            logger.warning("⚠️ [SES] django_ses not installed — falling back to Gmail SMTP")
        except Exception as ses_error:
            logger.warning(f"⚠️ [SES] FAILED: {ses_error}")
            logger.warning(f"⚠️ [SES] Traceback: {traceback.format_exc()}")
            logger.info("📧 [SES] Falling back to Gmail SMTP...")

        # ==========================================
        # ATTEMPT 2: Gmail SMTP (prathigudupuj@gmail.com)
        # ==========================================
        fallback = getattr(settings, 'EMAIL_FALLBACK', {})
        smtp_host = fallback.get('HOST', '')
        smtp_port = fallback.get('PORT', 587)
        smtp_user = fallback.get('USER', '')
        smtp_password = fallback.get('PASSWORD', '')
        smtp_use_tls = fallback.get('USE_TLS', True)
        smtp_from_email = fallback.get('FROM_EMAIL', '')

        if not smtp_user or not smtp_password:
            logger.error("❌ [SMTP] Gmail SMTP fallback NOT CONFIGURED!")
            logger.error(f"❌ [SMTP] EMAIL_FALLBACK = HOST={smtp_host}, USER={smtp_user}, PASSWORD={'SET' if smtp_password else 'EMPTY'}")
            logger.error("❌ [SMTP] Check: K8s secret 'backend-secrets' has EMAIL_HOST_USER and EMAIL_HOST_PASSWORD")
            if not self.fail_silently:
                raise RuntimeError("Both SES and SMTP failed: SMTP credentials not configured")
            return 0

        try:
            smtp = SMTPBackend(
                host=smtp_host,
                port=smtp_port,
                username=smtp_user,
                password=smtp_password,
                use_tls=smtp_use_tls,
                fail_silently=False,
            )

            # CRITICAL: Rewrite from_email to Gmail address
            # Gmail will NOT send from noreply@lancieretech.com — it must match the SMTP login
            if smtp_from_email:
                for msg in email_messages:
                    original_from = msg.from_email
                    msg.from_email = smtp_from_email
                    logger.info(f"📧 [SMTP] Rewrote from: {original_from} → {smtp_from_email}")

            logger.info(f"📧 [SMTP] Trying Gmail SMTP: {smtp_user}@{smtp_host}:{smtp_port}...")
            sent = smtp.send_messages(email_messages)
            logger.info(f"✅ [SMTP] Success! Sent {sent} email(s) via Gmail SMTP")
            return sent

        except Exception as smtp_error:
            logger.error(f"❌ [SMTP] Gmail SMTP ALSO FAILED: {smtp_error}")
            logger.error(f"❌ [SMTP] Traceback: {traceback.format_exc()}")
            logger.error(f"❌ [SMTP] Config: HOST={smtp_host}, PORT={smtp_port}, USER={smtp_user}, TLS={smtp_use_tls}")
            if not self.fail_silently:
                raise
            return 0