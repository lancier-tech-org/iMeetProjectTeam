"""
Push Device Token Management for iMeetPro
============================================
Location: core/WebSocketConnection/push_device_tokens.py

Handles:
- tbl_PushDeviceTokens table creation
- Register / upsert device token (with max-2 active device enforcement)
- Deactivate device token (logout)
- Heartbeat / refresh
"""

import json
import logging
from datetime import datetime
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db import connection, transaction
import pytz

logger = logging.getLogger(__name__)

MAX_ACTIVE_DEVICES = 2


# ──────────────────────────────────────────────
# 1. TABLE CREATION
# ──────────────────────────────────────────────

def ensure_push_device_table():
    """
    Create tbl_PushDeviceTokens if it doesn't exist.
    Called lazily on first API hit.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tbl_PushDeviceTokens (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    
                    user_id VARCHAR(50) NULL,
                    user_email VARCHAR(255) NOT NULL,
                    
                    install_id VARCHAR(255) NOT NULL,
                    fcm_token TEXT NOT NULL,
                    platform VARCHAR(20) NOT NULL DEFAULT 'android',
                    
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    
                    app_version VARCHAR(50) NULL,
                    device_name VARCHAR(255) NULL,
                    environment VARCHAR(20) DEFAULT 'prod',
                    notification_permission_granted BOOLEAN DEFAULT TRUE,
                    
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    
                    UNIQUE KEY uq_user_install (user_email, install_id),
                    INDEX idx_user_email (user_email),
                    INDEX idx_user_id (user_id),
                    INDEX idx_is_active (is_active),
                    INDEX idx_last_active (last_active_at),
                    INDEX idx_fcm_token (fcm_token(255))
                    
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """)
            logger.info("✅ tbl_PushDeviceTokens table ensured")
    except Exception as e:
        logger.error(f"❌ Failed to create tbl_PushDeviceTokens: {e}")
        raise


# ──────────────────────────────────────────────
# 2. REGISTER / UPDATE DEVICE TOKEN (with max-2 enforcement)
# ──────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["POST"])
def register_device_token(request):
    """
    Register or update a push device token.
    
    Enforces max-2 active devices per user.
    If a 3rd device registers, the oldest active device is deactivated.
    
    Request body:
    {
        "email": "user@example.com",
        "user_id": "optional-user-id",
        "install_id": "unique-per-app-install",
        "fcm_token": "firebase-cloud-messaging-token",
        "platform": "android" | "ios",
        "app_version": "1.0.0",          (optional)
        "device_name": "Pixel 8",        (optional)
        "environment": "prod" | "dev",    (optional)
        "notification_permission_granted": true  (optional)
    }
    
    Response:
    {
        "success": true,
        "status": "created" | "updated",
        "device_limit": 2,
        "active_device_count": 2,
        "evicted_device_count": 0,
        "evicted_install_ids": [],
        "message": "Device token registered successfully"
    }
    """
    try:
        data = json.loads(request.body.decode("utf-8")) if request.body else {}
        
        # ── Validate required fields ──
        email = (data.get("email") or "").strip().lower()
        install_id = (data.get("install_id") or "").strip()
        fcm_token = (data.get("fcm_token") or "").strip()
        platform = (data.get("platform") or "android").strip().lower()

        if not email or "@" not in email:
            return JsonResponse({"success": False, "error": "Valid email is required"}, status=400)
        if not install_id:
            return JsonResponse({"success": False, "error": "install_id is required"}, status=400)
        if not fcm_token or len(fcm_token) < 20:
            return JsonResponse({"success": False, "error": "Valid fcm_token is required"}, status=400)
        if platform not in ("android", "ios"):
            return JsonResponse({"success": False, "error": "platform must be 'android' or 'ios'"}, status=400)

        # ── Optional fields ──
        user_id = (data.get("user_id") or "").strip() or None
        app_version = (data.get("app_version") or "").strip() or None
        device_name = (data.get("device_name") or "").strip() or None
        environment = (data.get("environment") or "prod").strip()
        permission = data.get("notification_permission_granted", True)

        ensure_push_device_table()
        ist = pytz.timezone("Asia/Kolkata")
        now = datetime.now(ist)

        status = "created"
        evicted_install_ids = []

        with transaction.atomic():
            with connection.cursor() as cursor:

                # ── Step 1: Upsert this device ──
                # Check if row exists for (user_email, install_id)
                cursor.execute("""
                    SELECT id, fcm_token, is_active
                    FROM tbl_PushDeviceTokens
                    WHERE user_email = %s AND install_id = %s
                    LIMIT 1
                """, [email, install_id])
                existing = cursor.fetchone()

                if existing:
                    # UPDATE existing row
                    status = "updated"
                    cursor.execute("""
                        UPDATE tbl_PushDeviceTokens
                        SET fcm_token = %s,
                            platform = %s,
                            is_active = TRUE,
                            last_active_at = %s,
                            updated_at = %s,
                            user_id = COALESCE(%s, user_id),
                            app_version = COALESCE(%s, app_version),
                            device_name = COALESCE(%s, device_name),
                            environment = %s,
                            notification_permission_granted = %s
                        WHERE user_email = %s AND install_id = %s
                    """, [
                        fcm_token, platform, now, now,
                        user_id, app_version, device_name,
                        environment, permission,
                        email, install_id
                    ])
                else:
                    # INSERT new row
                    status = "created"
                    cursor.execute("""
                        INSERT INTO tbl_PushDeviceTokens (
                            user_id, user_email, install_id, fcm_token, platform,
                            is_active, last_active_at, app_version, device_name,
                            environment, notification_permission_granted, created_at, updated_at
                        ) VALUES (%s, %s, %s, %s, %s, TRUE, %s, %s, %s, %s, %s, %s, %s)
                    """, [
                        user_id, email, install_id, fcm_token, platform,
                        now, app_version, device_name, environment, permission, now, now
                    ])

                # ── Step 2: Enforce max-2 active devices ──
                cursor.execute("""
                    SELECT id, install_id, last_active_at
                    FROM tbl_PushDeviceTokens
                    WHERE user_email = %s AND is_active = TRUE
                    ORDER BY last_active_at DESC, created_at DESC, id DESC
                """, [email])
                active_devices = cursor.fetchall()

                if len(active_devices) > MAX_ACTIVE_DEVICES:
                    # Keep first MAX_ACTIVE_DEVICES (most recent), deactivate the rest
                    devices_to_evict = active_devices[MAX_ACTIVE_DEVICES:]

                    evict_ids = [d[0] for d in devices_to_evict]
                    evicted_install_ids = [d[1] for d in devices_to_evict]

                    placeholders = ",".join(["%s"] * len(evict_ids))
                    cursor.execute(f"""
                        UPDATE tbl_PushDeviceTokens
                        SET is_active = FALSE, updated_at = %s
                        WHERE id IN ({placeholders})
                    """, [now] + evict_ids)

                    logger.info(
                        f"🔄 Evicted {len(evict_ids)} device(s) for {email}: "
                        f"install_ids={evicted_install_ids}"
                    )

                # ── Step 3: Get final active count ──
                cursor.execute("""
                    SELECT COUNT(*) FROM tbl_PushDeviceTokens
                    WHERE user_email = %s AND is_active = TRUE
                """, [email])
                active_count = cursor.fetchone()[0]

        logger.info(
            f"✅ Device token {status} for {email} "
            f"(install_id={install_id}, active={active_count})"
        )

        return JsonResponse({
            "success": True,
            "status": status,
            "device_limit": MAX_ACTIVE_DEVICES,
            "active_device_count": active_count,
            "evicted_device_count": len(evicted_install_ids),
            "evicted_install_ids": evicted_install_ids,
            "message": f"Device token {status} successfully"
        }, status=200 if status == "updated" else 201)

    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)
    except Exception as e:
        logger.error(f"❌ register_device_token failed: {e}", exc_info=True)
        return JsonResponse({"success": False, "error": f"Server error: {str(e)}"}, status=500)


# ──────────────────────────────────────────────
# 3. DEACTIVATE DEVICE TOKEN (Logout)
# ──────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["POST"])
def deactivate_device_token(request):
    """
    Deactivate push for current device only (called on logout).
    
    Request body:
    {
        "email": "user@example.com",
        "install_id": "unique-per-app-install"
    }
    
    Fallback: if install_id not available, can pass fcm_token instead.
    """
    try:
        data = json.loads(request.body.decode("utf-8")) if request.body else {}

        email = (data.get("email") or "").strip().lower()
        install_id = (data.get("install_id") or "").strip()
        fcm_token = (data.get("fcm_token") or "").strip()

        if not email or "@" not in email:
            return JsonResponse({"success": False, "error": "Valid email is required"}, status=400)
        if not install_id and not fcm_token:
            return JsonResponse({
                "success": False,
                "error": "Either install_id or fcm_token is required"
            }, status=400)

        ensure_push_device_table()
        ist = pytz.timezone("Asia/Kolkata")
        now = datetime.now(ist)

        with connection.cursor() as cursor:
            if install_id:
                cursor.execute("""
                    UPDATE tbl_PushDeviceTokens
                    SET is_active = FALSE, updated_at = %s
                    WHERE user_email = %s AND install_id = %s
                """, [now, email, install_id])
            else:
                cursor.execute("""
                    UPDATE tbl_PushDeviceTokens
                    SET is_active = FALSE, updated_at = %s
                    WHERE user_email = %s AND fcm_token = %s
                """, [now, email, fcm_token])

            deactivated = cursor.rowcount > 0

        if deactivated:
            logger.info(f"✅ Device deactivated for {email} (install_id={install_id or 'N/A'})")
        else:
            logger.warning(f"⚠️ No device found to deactivate for {email}")

        return JsonResponse({
            "success": True,
            "deactivated": deactivated,
            "message": "Device deactivated" if deactivated else "No matching device found"
        }, status=200)

    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)
    except Exception as e:
        logger.error(f"❌ deactivate_device_token failed: {e}", exc_info=True)
        return JsonResponse({"success": False, "error": f"Server error: {str(e)}"}, status=500)


# ──────────────────────────────────────────────
# 4. HEARTBEAT / REFRESH (Optional but recommended)
# ──────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["POST"])
def heartbeat_device_token(request):
    """
    Update last_active_at and optionally refresh FCM token.
    Called on app resume or periodic refresh.
    
    Request body:
    {
        "email": "user@example.com",
        "install_id": "unique-per-app-install",
        "fcm_token": "new-token-if-refreshed",    (optional)
        "notification_permission_granted": true     (optional)
    }
    """
    try:
        data = json.loads(request.body.decode("utf-8")) if request.body else {}

        email = (data.get("email") or "").strip().lower()
        install_id = (data.get("install_id") or "").strip()
        new_fcm_token = (data.get("fcm_token") or "").strip()
        permission = data.get("notification_permission_granted")

        if not email or "@" not in email:
            return JsonResponse({"success": False, "error": "Valid email is required"}, status=400)
        if not install_id:
            return JsonResponse({"success": False, "error": "install_id is required"}, status=400)

        ensure_push_device_table()
        ist = pytz.timezone("Asia/Kolkata")
        now = datetime.now(ist)

        with connection.cursor() as cursor:
            if new_fcm_token and len(new_fcm_token) >= 20:
                # Update token + timestamp
                sql = """
                    UPDATE tbl_PushDeviceTokens
                    SET fcm_token = %s, last_active_at = %s, updated_at = %s
                """
                params = [new_fcm_token, now, now]
            else:
                # Just update timestamp
                sql = """
                    UPDATE tbl_PushDeviceTokens
                    SET last_active_at = %s, updated_at = %s
                """
                params = [now, now]

            if permission is not None:
                sql += ", notification_permission_granted = %s"
                params.append(permission)

            sql += " WHERE user_email = %s AND install_id = %s AND is_active = TRUE"
            params.extend([email, install_id])

            cursor.execute(sql, params)
            updated = cursor.rowcount > 0

        return JsonResponse({
            "success": True,
            "updated": updated,
            "message": "Heartbeat recorded" if updated else "Device not found or inactive"
        }, status=200)

    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)
    except Exception as e:
        logger.error(f"❌ heartbeat_device_token failed: {e}", exc_info=True)
        return JsonResponse({"success": False, "error": f"Server error: {str(e)}"}, status=500)


# ──────────────────────────────────────────────
# 5. GET ACTIVE DEVICES (Admin/Debug)
# ──────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["GET"])
def get_active_devices(request):
    """
    Get active push devices for a user (debug/admin endpoint).
    
    Query params:
        email: user email
    """
    try:
        email = request.GET.get("email", "").strip().lower()
        if not email or "@" not in email:
            return JsonResponse({"success": False, "error": "Valid email required"}, status=400)

        ensure_push_device_table()

        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id, install_id, platform, is_active,
                       last_active_at, device_name, app_version,
                       environment, created_at
                FROM tbl_PushDeviceTokens
                WHERE user_email = %s
                ORDER BY last_active_at DESC
            """, [email])
            rows = cursor.fetchall()

        devices = []
        for row in rows:
            devices.append({
                "id": row[0],
                "install_id": row[1],
                "platform": row[2],
                "is_active": bool(row[3]),
                "last_active_at": row[4].isoformat() if row[4] else None,
                "device_name": row[5],
                "app_version": row[6],
                "environment": row[7],
                "created_at": row[8].isoformat() if row[8] else None,
            })

        return JsonResponse({
            "success": True,
            "email": email,
            "total_devices": len(devices),
            "active_devices": sum(1 for d in devices if d["is_active"]),
            "device_limit": MAX_ACTIVE_DEVICES,
            "devices": devices
        }, status=200)

    except Exception as e:
        logger.error(f"❌ get_active_devices failed: {e}", exc_info=True)
        return JsonResponse({"success": False, "error": str(e)}, status=500)