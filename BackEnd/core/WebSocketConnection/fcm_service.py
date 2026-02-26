"""
FCM Push Notification Service for iMeetPro
============================================
Location: core/WebSocketConnection/fcm_service.py

Handles:
- Firebase Admin SDK initialization
- Sending push notifications to devices
- Invalid token cleanup
- Centralized push delivery after tbl_Notifications insert
"""

import logging
import json
import os
import firebase_admin
from firebase_admin import credentials, messaging
from django.db import connection
from django.conf import settings

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# 1. FIREBASE INITIALIZATION
# ──────────────────────────────────────────────

_firebase_app = None


def _get_firebase_app():
    """
    Initialize Firebase Admin SDK (singleton).
    
    The service account JSON must be placed at one of these locations:
      1. Path specified by FIREBASE_CREDENTIALS_PATH in settings.py
      2. Path specified by GOOGLE_APPLICATION_CREDENTIALS env var
      3. Default: /lanciere/devstorage/sreedhar/SampleDB_W/firebase-credentials.json
    """
    global _firebase_app

    if _firebase_app is not None:
        return _firebase_app

    # Already initialized by another module?
    try:
        _firebase_app = firebase_admin.get_app()
        logger.info("✅ Firebase app already initialized")
        return _firebase_app
    except ValueError:
        pass  # Not initialized yet

    # Resolve credentials path
    cred_path = getattr(settings, 'FIREBASE_CREDENTIALS_PATH', None)
    if not cred_path:
        cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    if not cred_path:
        # Default location — adjust to your deployment
        cred_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            'firebase-credentials.json'
        )

    if not os.path.exists(cred_path):
        logger.error(f"❌ Firebase credentials file not found at: {cred_path}")
        logger.error("   Set FIREBASE_CREDENTIALS_PATH in settings.py or GOOGLE_APPLICATION_CREDENTIALS env var")
        return None

    try:
        cred = credentials.Certificate(cred_path)
        _firebase_app = firebase_admin.initialize_app(cred)
        logger.info(f"✅ Firebase Admin SDK initialized from: {cred_path}")
        return _firebase_app
    except Exception as e:
        logger.error(f"❌ Failed to initialize Firebase: {e}", exc_info=True)
        return None


# ──────────────────────────────────────────────
# 2. CORE SEND FUNCTION
# ──────────────────────────────────────────────

def send_fcm_to_token(fcm_token, title, body, data_payload=None):
    """
    Send a single FCM push notification to one device token.
    
    Returns:
        dict: {"success": bool, "message_id": str|None, "error": str|None, "invalid_token": bool}
    """
    app = _get_firebase_app()
    if not app:
        return {"success": False, "error": "Firebase not initialized", "invalid_token": False}

    if not fcm_token or not isinstance(fcm_token, str) or len(fcm_token) < 20:
        return {"success": False, "error": "Invalid FCM token", "invalid_token": True}

    try:
        # Build the message
        notification = messaging.Notification(
            title=title,
            body=body,
        )

        # Data payload (all values must be strings)
        safe_data = {}
        if data_payload and isinstance(data_payload, dict):
            for k, v in data_payload.items():
                safe_data[str(k)] = str(v) if v is not None else ""

        message = messaging.Message(
            notification=notification,
            data=safe_data,
            token=fcm_token,
            # Android-specific config
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    channel_id="imeetpro_notifications",  # Must match Flutter channel ID
                    priority="high",
                    default_sound=True,
                ),
            ),
            # iOS-specific config
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        alert=messaging.ApsAlert(title=title, body=body),
                        sound="default",
                        badge=1,
                    ),
                ),
            ),
        )

        response = messaging.send(message, app=app)
        logger.info(f"✅ FCM sent successfully: {response}")
        return {"success": True, "message_id": response, "error": None, "invalid_token": False}

    except messaging.UnregisteredError:
        logger.warning(f"⚠️ FCM token unregistered: {fcm_token[:20]}...")
        return {"success": False, "error": "Token unregistered", "invalid_token": True}

    except messaging.InvalidArgumentError as e:
        logger.warning(f"⚠️ FCM invalid argument: {e}")
        return {"success": False, "error": str(e), "invalid_token": True}

    except messaging.SenderIdMismatchError:
        logger.error(f"❌ FCM sender ID mismatch for token: {fcm_token[:20]}...")
        return {"success": False, "error": "Sender ID mismatch", "invalid_token": True}

    except Exception as e:
        logger.error(f"❌ FCM send failed: {e}", exc_info=True)
        return {"success": False, "error": str(e), "invalid_token": False}


# ──────────────────────────────────────────────
# 3. SEND PUSH FOR NOTIFICATION (Main Integration Hook)
# ──────────────────────────────────────────────

def send_push_for_notification(
    recipient_email,
    notification_id,
    notification_type,
    title,
    body,
    meeting_id=None,
    meeting_url=None,
    priority="normal",
):
    """
    Send FCM push to ALL active devices for a recipient.
    
    Call this AFTER successfully inserting into tbl_Notifications.
    This function:
      1. Looks up active device tokens for the recipient
      2. Sends push to each device
      3. Deactivates any invalid tokens
    
    Args:
        recipient_email: Email of the notification recipient
        notification_id: ID from tbl_Notifications (for dedup on Flutter side)
        notification_type: e.g. 'meeting_invitation', 'meeting_reminder', 'recording_completed'
        title: Push notification title
        body: Push notification body text
        meeting_id: Optional meeting ID for routing
        meeting_url: Optional meeting URL
        priority: 'high' or 'normal'
    
    Returns:
        dict: {"sent": int, "failed": int, "invalid_tokens_removed": int}
    """
    result = {"sent": 0, "failed": 0, "invalid_tokens_removed": 0}

    if not recipient_email:
        return result

    try:
        # 1. Find active device tokens for this user
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id, fcm_token, platform
                FROM tbl_PushDeviceTokens
                WHERE user_email = %s AND is_active = TRUE
                ORDER BY last_active_at DESC
            """, [recipient_email.strip().lower()])
            devices = cursor.fetchall()

        if not devices:
            logger.debug(f"No active push devices for {recipient_email}")
            return result

        # 2. Build data payload for Flutter routing
        data_payload = {
            "notification_id": str(notification_id),
            "type": str(notification_type),
            "priority": str(priority),
            "click_action": "FLUTTER_NOTIFICATION_CLICK",
        }
        if meeting_id:
            data_payload["meeting_id"] = str(meeting_id)
        if meeting_url:
            data_payload["meeting_url"] = str(meeting_url)

        # 3. Send to each active device
        invalid_device_ids = []

        for device_id, fcm_token, platform in devices:
            send_result = send_fcm_to_token(fcm_token, title, body, data_payload)

            if send_result["success"]:
                result["sent"] += 1
            else:
                result["failed"] += 1
                if send_result.get("invalid_token"):
                    invalid_device_ids.append(device_id)

        # 4. Deactivate invalid tokens
        if invalid_device_ids:
            try:
                with connection.cursor() as cursor:
                    placeholders = ",".join(["%s"] * len(invalid_device_ids))
                    cursor.execute(f"""
                        UPDATE tbl_PushDeviceTokens
                        SET is_active = FALSE, updated_at = NOW()
                        WHERE id IN ({placeholders})
                    """, invalid_device_ids)
                    result["invalid_tokens_removed"] = cursor.rowcount
                    logger.info(f"🧹 Deactivated {cursor.rowcount} invalid FCM tokens")
            except Exception as e:
                logger.error(f"Failed to deactivate invalid tokens: {e}")

        logger.info(
            f"📱 Push for {recipient_email}: "
            f"sent={result['sent']}, failed={result['failed']}, "
            f"invalid_removed={result['invalid_tokens_removed']}"
        )

    except Exception as e:
        logger.error(f"❌ send_push_for_notification failed for {recipient_email}: {e}", exc_info=True)

    return result


# ──────────────────────────────────────────────
# 4. BATCH SEND (for multiple recipients)
# ──────────────────────────────────────────────

def send_push_to_multiple_recipients(
    recipient_emails,
    notification_type,
    title,
    body,
    meeting_id=None,
    meeting_url=None,
    priority="normal",
):
    """
    Convenience function: send push to a list of recipient emails.
    Each recipient's notification_id should ideally come from their tbl_Notifications row,
    but for batch sends we use a generic approach.
    
    Returns:
        dict: {"total_sent": int, "total_failed": int}
    """
    total_sent = 0
    total_failed = 0

    for email in recipient_emails:
        if not email or '@' not in email:
            continue
        result = send_push_for_notification(
            recipient_email=email,
            notification_id="",  # Flutter will fetch from API
            notification_type=notification_type,
            title=title,
            body=body,
            meeting_id=meeting_id,
            meeting_url=meeting_url,
            priority=priority,
        )
        total_sent += result["sent"]
        total_failed += result["failed"]

    return {"total_sent": total_sent, "total_failed": total_failed}