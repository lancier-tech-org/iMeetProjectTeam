# =============================================================================
# Redis-Based Attendance Session Storage
# =============================================================================
# File: Add this to your Django attendance app (e.g., attendance/session_store.py)
# =============================================================================
#
# This replaces the in-memory attendance_sessions dictionary with Redis storage.
# Sessions now persist across pod restarts and are shared across all pods.
#
# USAGE:
#   from attendance.session_store import AttendanceSessionStore
#   
#   store = AttendanceSessionStore()
#   store.create_session(session_key, session_data)
#   session = store.get_session(session_key)
#   store.update_session(session_key, updates)
#   store.delete_session(session_key)
# =============================================================================

import json
import logging
import os
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

import redis

logger = logging.getLogger(__name__)


class AttendanceSessionStore:
    """
    Redis-backed session store for attendance tracking.
    
    Replaces in-memory dictionary to ensure:
    - Sessions persist across pod restarts
    - Sessions are shared across all backend pods
    - Automatic expiration of stale sessions
    """
    
    # Session TTL: 24 hours (in seconds)
    SESSION_TTL = 86400
    
    # Redis key prefix
    KEY_PREFIX = "attendance:session:"
    
    def __init__(self):
        """Initialize Redis connection."""
        self.redis_host = os.environ.get('REDIS_HOST', 'redis.databases.svc.cluster.local')
        self.redis_port = int(os.environ.get('REDIS_PORT', 6379))
        self.redis_db = int(os.environ.get('ATTENDANCE_REDIS_DB', 2))
        
        self._redis = None
        self._connect()
    
    def _connect(self):
        """Establish Redis connection with retry."""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                self._redis = redis.Redis(
                    host=self.redis_host,
                    port=self.redis_port,
                    db=self.redis_db,
                    decode_responses=True,
                    socket_timeout=10,
                    socket_connect_timeout=10,
                    retry_on_timeout=True
                )
                # Test connection
                self._redis.ping()
                logger.info(f"Connected to Redis at {self.redis_host}:{self.redis_port} db={self.redis_db}")
                return
            except redis.ConnectionError as e:
                logger.warning(f"Redis connection attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(1)
                else:
                    raise
    
    def _get_key(self, session_key: str) -> str:
        """Get the full Redis key for a session."""
        return f"{self.KEY_PREFIX}{session_key}"
    
    def _serialize(self, data: Dict[str, Any]) -> str:
        """Serialize session data to JSON."""
        # Convert datetime objects to ISO strings
        serialized = {}
        for key, value in data.items():
            if isinstance(value, datetime):
                serialized[key] = value.isoformat()
            elif isinstance(value, timedelta):
                serialized[key] = value.total_seconds()
            else:
                serialized[key] = value
        return json.dumps(serialized)
    
    def _deserialize(self, data: str) -> Dict[str, Any]:
        """Deserialize session data from JSON."""
        parsed = json.loads(data)
        
        # Convert ISO strings back to datetime where needed
        datetime_fields = ['start_time', 'last_check', 'pause_time', 'break_start_time', 'last_violation_time']
        for field in datetime_fields:
            if field in parsed and parsed[field]:
                try:
                    parsed[field] = datetime.fromisoformat(parsed[field])
                except (ValueError, TypeError):
                    pass
        
        # Convert timedelta fields
        timedelta_fields = ['total_pause_duration', 'break_time_remaining']
        for field in timedelta_fields:
            if field in parsed and parsed[field] is not None:
                parsed[field] = timedelta(seconds=parsed[field])
        
        return parsed
    
    def create_session(self, session_key: str, session_data: Dict[str, Any]) -> bool:
        """
        Create a new attendance session.
        
        Args:
            session_key: Unique session identifier (meeting_id:user_id)
            session_data: Session data dictionary
            
        Returns:
            True if created, False if already exists
        """
        try:
            key = self._get_key(session_key)
            
            # Add metadata
            session_data['created_at'] = datetime.now().isoformat()
            session_data['pod_name'] = os.environ.get('POD_NAME', 'unknown')
            
            # Use NX (not exists) to prevent overwriting
            result = self._redis.set(
                key,
                self._serialize(session_data),
                ex=self.SESSION_TTL,
                nx=True
            )
            
            if result:
                logger.info(f"Created attendance session: {session_key}")
                return True
            else:
                logger.warning(f"Session already exists: {session_key}")
                return False
                
        except redis.RedisError as e:
            logger.error(f"Failed to create session {session_key}: {e}")
            raise
    
    def get_session(self, session_key: str) -> Optional[Dict[str, Any]]:
        """
        Get an attendance session.
        
        Args:
            session_key: Unique session identifier
            
        Returns:
            Session data dict or None if not found
        """
        try:
            key = self._get_key(session_key)
            data = self._redis.get(key)
            
            if data:
                return self._deserialize(data)
            return None
            
        except redis.RedisError as e:
            logger.error(f"Failed to get session {session_key}: {e}")
            raise
    
    def update_session(self, session_key: str, updates: Dict[str, Any]) -> bool:
        """
        Update an existing attendance session.
        
        Args:
            session_key: Unique session identifier
            updates: Dictionary of fields to update
            
        Returns:
            True if updated, False if session not found
        """
        try:
            key = self._get_key(session_key)
            
            # Get existing session
            existing = self._redis.get(key)
            if not existing:
                logger.warning(f"Session not found for update: {session_key}")
                return False
            
            # Merge updates
            session_data = self._deserialize(existing)
            session_data.update(updates)
            session_data['updated_at'] = datetime.now().isoformat()
            
            # Save with refreshed TTL
            self._redis.set(key, self._serialize(session_data), ex=self.SESSION_TTL)
            
            logger.debug(f"Updated session {session_key}: {list(updates.keys())}")
            return True
            
        except redis.RedisError as e:
            logger.error(f"Failed to update session {session_key}: {e}")
            raise
    
    def delete_session(self, session_key: str) -> bool:
        """
        Delete an attendance session.
        
        Args:
            session_key: Unique session identifier
            
        Returns:
            True if deleted, False if not found
        """
        try:
            key = self._get_key(session_key)
            result = self._redis.delete(key)
            
            if result:
                logger.info(f"Deleted attendance session: {session_key}")
                return True
            return False
            
        except redis.RedisError as e:
            logger.error(f"Failed to delete session {session_key}: {e}")
            raise
    
    def session_exists(self, session_key: str) -> bool:
        """Check if a session exists."""
        try:
            key = self._get_key(session_key)
            return self._redis.exists(key) > 0
        except redis.RedisError as e:
            logger.error(f"Failed to check session {session_key}: {e}")
            raise
    
    def get_or_create_session(self, session_key: str, default_data: Dict[str, Any]) -> tuple:
        """
        Get existing session or create new one.
        
        Args:
            session_key: Unique session identifier
            default_data: Data to use if creating new session
            
        Returns:
            Tuple of (session_data, created_bool)
        """
        existing = self.get_session(session_key)
        if existing:
            return existing, False
        
        self.create_session(session_key, default_data)
        return default_data, True
    
    def refresh_ttl(self, session_key: str) -> bool:
        """Refresh the TTL of a session."""
        try:
            key = self._get_key(session_key)
            return self._redis.expire(key, self.SESSION_TTL)
        except redis.RedisError as e:
            logger.error(f"Failed to refresh TTL for {session_key}: {e}")
            return False
    
    def get_all_sessions(self, pattern: str = "*") -> Dict[str, Dict[str, Any]]:
        """
        Get all sessions matching a pattern.
        
        Args:
            pattern: Pattern to match (e.g., "meeting123:*" for all users in a meeting)
            
        Returns:
            Dictionary of session_key -> session_data
        """
        try:
            full_pattern = f"{self.KEY_PREFIX}{pattern}"
            sessions = {}
            
            for key in self._redis.scan_iter(match=full_pattern):
                session_key = key.replace(self.KEY_PREFIX, "")
                data = self._redis.get(key)
                if data:
                    sessions[session_key] = self._deserialize(data)
            
            return sessions
            
        except redis.RedisError as e:
            logger.error(f"Failed to get sessions with pattern {pattern}: {e}")
            raise
    
    def cleanup_expired(self) -> int:
        """
        Cleanup expired sessions (Redis does this automatically, but this can force it).
        
        Returns:
            Number of sessions cleaned up
        """
        # Redis TTL handles this automatically
        # This method is here for manual cleanup if needed
        return 0


# =============================================================================
# Global instance for easy import
# =============================================================================
_session_store = None


def get_session_store() -> AttendanceSessionStore:
    """Get the global session store instance."""
    global _session_store
    if _session_store is None:
        _session_store = AttendanceSessionStore()
    return _session_store


# =============================================================================
# Migration helper: Replace in-memory dict usage
# =============================================================================
# 
# OLD CODE:
#   attendance_sessions = {}
#   attendance_sessions[session_key] = {...}
#   session = attendance_sessions.get(session_key)
#   if session_key in attendance_sessions:
#   del attendance_sessions[session_key]
#
# NEW CODE:
#   from attendance.session_store import get_session_store
#   store = get_session_store()
#   store.create_session(session_key, {...})
#   session = store.get_session(session_key)
#   if store.session_exists(session_key):
#   store.delete_session(session_key)
# =============================================================================
