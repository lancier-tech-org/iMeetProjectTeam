"""
Attendance Session Manager - Redis Backend
============================================
Replaces in-memory attendance_sessions dict with Redis storage.
Uses your EXISTING Redis server at 192.168.48.201:6379, DB 2.

DB allocation on your server:
  DB 0 = Celery broker
  DB 2 = Attendance sessions (NEW)
  DB 3 = Chat cache
  DB 4 = Hand raise cache
  DB 5 = Reactions cache

Location: core/session_manager.py

Usage in attendance.py:
    from core.session_manager import SessionManager

    # Create session
    SessionManager.create_session(meeting_id, user_id, session_data)

    # Get session
    session = SessionManager.get_session(meeting_id, user_id)

    # Save after modifications
    SessionManager.save_session(meeting_id, user_id, session)

    # Delete session
    SessionManager.delete_session(meeting_id, user_id)

    # Check existence
    if SessionManager.session_exists(meeting_id, user_id):
        ...
"""

import os
import json
import time
import logging
import redis
from redis import ConnectionPool
from datetime import datetime, timedelta

logger = logging.getLogger("attendance_session_manager")

# =============================================================================
# REDIS CONFIGURATION - Uses your existing Redis server
# =============================================================================

ATTENDANCE_REDIS_CONFIG = {
    "host": os.getenv("REDIS_HOST", "192.168.48.201"),
    "port": int(os.getenv("REDIS_PORT", 6379)),
    "db": int(os.getenv("ATTENDANCE_REDIS_DB", 2)),  # DB 2 for attendance
}

# Session TTL: 2 hours (auto-expire if not touched)
SESSION_TTL = int(os.getenv("ATTENDANCE_SESSION_TTL", 7200))

# Key prefix for all attendance sessions
KEY_PREFIX = "attendance:session:"

# =============================================================================
# CONNECTION POOL - Reuses connections efficiently
# =============================================================================

_pool = None


def _get_pool():
    """Get or create the Redis connection pool (lazy init)."""
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            host=ATTENDANCE_REDIS_CONFIG["host"],
            port=ATTENDANCE_REDIS_CONFIG["port"],
            db=ATTENDANCE_REDIS_CONFIG["db"],
            decode_responses=True,
            max_connections=50,         # Supports 50+ concurrent users
            socket_timeout=5,
            socket_connect_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30,
        )
        logger.info(
            f"✅ Attendance Redis pool created: "
            f"{ATTENDANCE_REDIS_CONFIG['host']}:{ATTENDANCE_REDIS_CONFIG['port']}"
            f"/DB{ATTENDANCE_REDIS_CONFIG['db']}"
        )
    return _pool


def _get_client():
    """Get a Redis client from the pool."""
    return redis.Redis(connection_pool=_get_pool())


# =============================================================================
# CUSTOM JSON ENCODER - Handles datetime, sets, etc.
# =============================================================================

class AttendanceJSONEncoder(json.JSONEncoder):
    """JSON encoder that handles types found in attendance session data."""

    def default(self, obj):
        if isinstance(obj, datetime):
            return {"__datetime__": True, "value": obj.isoformat()}
        if isinstance(obj, set):
            return {"__set__": True, "value": list(obj)}
        if isinstance(obj, timedelta):
            return {"__timedelta__": True, "value": obj.total_seconds()}
        return super().default(obj)


def _json_decoder_hook(dct):
    """Restore datetime, set, timedelta from JSON."""
    if "__datetime__" in dct:
        return datetime.fromisoformat(dct["value"])
    if "__set__" in dct:
        return set(dct["value"])
    if "__timedelta__" in dct:
        return timedelta(seconds=dct["value"])
    return dct


def _serialize(session_data):
    """Serialize session dict to JSON string."""
    return json.dumps(session_data, cls=AttendanceJSONEncoder)


def _deserialize(json_str):
    """Deserialize JSON string to session dict."""
    if json_str is None:
        return None
    return json.loads(json_str, object_hook=_json_decoder_hook)


# =============================================================================
# SESSION KEY HELPERS
# =============================================================================

def _make_key(meeting_id, user_id):
    """Build Redis key: attendance:session:<meeting_id>:<user_id>"""
    return f"{KEY_PREFIX}{meeting_id}:{user_id}"


def _parse_key(redis_key):
    """Extract (meeting_id, user_id) from a Redis key."""
    # key format: attendance:session:<meeting_id>:<user_id>
    parts = redis_key.replace(KEY_PREFIX, "").split(":", 1)
    if len(parts) == 2:
        return parts[0], parts[1]
    return None, None


# =============================================================================
# SESSION MANAGER - Main API
# =============================================================================

class SessionManager:
    """
    Thread-safe attendance session manager backed by Redis.

    Drop-in replacement for:
        attendance_sessions[session_key] = {...}
        session = attendance_sessions[session_key]
        del attendance_sessions[session_key]

    Now:
        SessionManager.create_session(mid, uid, data)
        session = SessionManager.get_session(mid, uid)
        SessionManager.save_session(mid, uid, session)
        SessionManager.delete_session(mid, uid)
    """

    # ----- Core CRUD -----

    @staticmethod
    def create_session(meeting_id, user_id, session_data):
        """
        Create a new attendance session in Redis.

        Args:
            meeting_id: Meeting identifier
            user_id: User identifier
            session_data: Dict with all session fields (same as old dict)

        Returns:
            bool: True on success
        """
        try:
            client = _get_client()
            key = _make_key(meeting_id, user_id)

            # Add tracking metadata
            session_data["_created_at"] = time.time()
            session_data["_updated_at"] = time.time()

            client.set(key, _serialize(session_data), ex=SESSION_TTL)

            # Track this session in the meeting's participant set
            meeting_set_key = f"attendance:meeting:{meeting_id}:participants"
            client.sadd(meeting_set_key, str(user_id))
            client.expire(meeting_set_key, SESSION_TTL)

            logger.info(f"✅ Session created: {meeting_id}_{user_id}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to create session {meeting_id}_{user_id}: {e}")
            return False

    @staticmethod
    def get_session(meeting_id, user_id):
        """
        Get a session from Redis.

        Args:
            meeting_id: Meeting identifier
            user_id: User identifier

        Returns:
            dict or None: Session data, or None if not found
        """
        try:
            client = _get_client()
            key = _make_key(meeting_id, user_id)
            data = client.get(key)

            if data is None:
                return None

            return _deserialize(data)

        except Exception as e:
            logger.error(f"❌ Failed to get session {meeting_id}_{user_id}: {e}")
            return None

    @staticmethod
    def save_session(meeting_id, user_id, session_data):
        """
        Save (update) a session back to Redis.
        MUST be called after modifying session fields.

        Args:
            meeting_id: Meeting identifier
            user_id: User identifier
            session_data: Modified session dict

        Returns:
            bool: True on success
        """
        try:
            client = _get_client()
            key = _make_key(meeting_id, user_id)

            session_data["_updated_at"] = time.time()

            # Refresh TTL on every save
            client.set(key, _serialize(session_data), ex=SESSION_TTL)
            return True

        except Exception as e:
            logger.error(f"❌ Failed to save session {meeting_id}_{user_id}: {e}")
            return False

    @staticmethod
    def delete_session(meeting_id, user_id):
        """
        Delete a session from Redis.

        Args:
            meeting_id: Meeting identifier
            user_id: User identifier

        Returns:
            bool: True on success
        """
        try:
            client = _get_client()
            key = _make_key(meeting_id, user_id)
            client.delete(key)

            # Remove from meeting participant set
            meeting_set_key = f"attendance:meeting:{meeting_id}:participants"
            client.srem(meeting_set_key, str(user_id))

            logger.info(f"🗑️ Session deleted: {meeting_id}_{user_id}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to delete session {meeting_id}_{user_id}: {e}")
            return False

    @staticmethod
    def session_exists(meeting_id, user_id):
        """
        Check if a session exists in Redis.

        Args:
            meeting_id: Meeting identifier
            user_id: User identifier

        Returns:
            bool: True if session exists
        """
        try:
            client = _get_client()
            key = _make_key(meeting_id, user_id)
            return client.exists(key) > 0
        except Exception as e:
            logger.error(f"❌ Failed to check session {meeting_id}_{user_id}: {e}")
            return False

    # ----- Bulk Operations (for periodic_saver and admin) -----

    @staticmethod
    def get_all_sessions():
        """
        Get ALL active sessions across all meetings.
        Used by periodic_saver to batch-write to DB.

        Returns:
            list of dict: All session data dicts
        """
        try:
            client = _get_client()
            keys = list(client.scan_iter(match=f"{KEY_PREFIX}*", count=100))
            if not keys:
                return []

            # Use pipeline for batch retrieval
            pipe = client.pipeline()
            for key in keys:
                pipe.get(key)
            values = pipe.execute()

            sessions = []
            for val in values:
                if val is not None:
                    session = _deserialize(val)
                    if session:
                        sessions.append(session)

            return sessions

        except Exception as e:
            logger.error(f"❌ Failed to get all sessions: {e}")
            return []

    @staticmethod
    def get_meeting_sessions(meeting_id):
        """
        Get all sessions for a specific meeting.

        Args:
            meeting_id: Meeting identifier

        Returns:
            list of dict: Session data for all participants in this meeting
        """
        try:
            client = _get_client()
            pattern = f"{KEY_PREFIX}{meeting_id}:*"
            keys = list(client.scan_iter(match=pattern, count=100))

            if not keys:
                return []

            pipe = client.pipeline()
            for key in keys:
                pipe.get(key)
            values = pipe.execute()

            sessions = []
            for val in values:
                if val is not None:
                    session = _deserialize(val)
                    if session:
                        sessions.append(session)

            return sessions

        except Exception as e:
            logger.error(f"❌ Failed to get meeting sessions {meeting_id}: {e}")
            return []

    @staticmethod
    def get_meeting_participant_count(meeting_id):
        """
        Get number of active participants in a meeting.

        Args:
            meeting_id: Meeting identifier

        Returns:
            int: Number of active participants
        """
        try:
            client = _get_client()
            meeting_set_key = f"attendance:meeting:{meeting_id}:participants"
            return client.scard(meeting_set_key)
        except Exception as e:
            logger.error(f"❌ Failed to count participants for {meeting_id}: {e}")
            return 0

    @staticmethod
    def get_all_session_keys():
        """
        Get all session keys (for iteration).

        Returns:
            list of str: Session keys in format "meeting_id_user_id"
        """
        try:
            client = _get_client()
            keys = list(client.scan_iter(match=f"{KEY_PREFIX}*", count=100))
            result = []
            for key in keys:
                mid, uid = _parse_key(key)
                if mid and uid:
                    result.append(f"{mid}_{uid}")
            return result
        except Exception as e:
            logger.error(f"❌ Failed to get session keys: {e}")
            return []

    # ----- Health & Monitoring -----

    @staticmethod
    def health_check():
        """
        Check Redis connection health.

        Returns:
            dict: Health status info
        """
        try:
            client = _get_client()
            start = time.time()
            client.ping()
            latency = (time.time() - start) * 1000  # ms

            session_count = len(
                list(client.scan_iter(match=f"{KEY_PREFIX}*", count=100))
            )
            info = client.info("memory")

            return {
                "status": "healthy",
                "latency_ms": round(latency, 2),
                "active_sessions": session_count,
                "redis_host": ATTENDANCE_REDIS_CONFIG["host"],
                "redis_port": ATTENDANCE_REDIS_CONFIG["port"],
                "redis_db": ATTENDANCE_REDIS_CONFIG["db"],
                "used_memory": info.get("used_memory_human", "unknown"),
            }

        except Exception as e:
            logger.error(f"❌ Redis health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "redis_host": ATTENDANCE_REDIS_CONFIG["host"],
                "redis_port": ATTENDANCE_REDIS_CONFIG["port"],
                "redis_db": ATTENDANCE_REDIS_CONFIG["db"],
            }

    @staticmethod
    def cleanup_expired():
        """
        Manual cleanup of any leftover sessions.
        Normally Redis TTL handles this, but this can be called for safety.

        Returns:
            int: Number of sessions cleaned
        """
        try:
            client = _get_client()
            keys = list(client.scan_iter(match=f"{KEY_PREFIX}*", count=200))
            cleaned = 0

            for key in keys:
                ttl = client.ttl(key)
                if ttl == -1:
                    # Key exists but has no TTL - set one
                    client.expire(key, SESSION_TTL)
                    cleaned += 1

            if cleaned > 0:
                logger.info(f"🧹 Set TTL on {cleaned} sessions missing expiry")
            return cleaned

        except Exception as e:
            logger.error(f"❌ Cleanup failed: {e}")
            return 0


# =============================================================================
# INITIALIZATION - Verify Redis is reachable on import
# =============================================================================

try:
    _client = _get_client()
    _client.ping()
    logger.info(
        f"✅ Attendance SessionManager ready: "
        f"{ATTENDANCE_REDIS_CONFIG['host']}:{ATTENDANCE_REDIS_CONFIG['port']}"
        f"/DB{ATTENDANCE_REDIS_CONFIG['db']}"
    )
except Exception as _e:
    logger.error(
        f"❌ Attendance Redis NOT reachable: {_e}. "
        f"Tried {ATTENDANCE_REDIS_CONFIG['host']}:{ATTENDANCE_REDIS_CONFIG['port']}"
        f"/DB{ATTENDANCE_REDIS_CONFIG['db']}"
    )