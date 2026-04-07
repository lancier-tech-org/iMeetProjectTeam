"""
Periodic Session Saver - Background DB Writer
===============================================
Background daemon thread that saves Redis session data to the
Django database every 30 seconds.

This replaces the per-frame DB writes in detect_violations(),
reducing DB operations from ~250/sec to ~2/sec (125x reduction).

Location: core/periodic_saver.py

Starts automatically via core/apps.py on Django startup.
Can also be started manually:
    from core.periodic_saver import start_periodic_saver
    start_periodic_saver(interval=30)
"""

import threading
import time
import logging
from datetime import datetime

logger = logging.getLogger("periodic_saver")

# =============================================================================
# SINGLETON STATE
# =============================================================================

_saver_thread = None
_saver_running = False
_saver_lock = threading.Lock()

# Statistics
_stats = {
    "cycles": 0,
    "total_saves": 0,
    "total_failures": 0,
    "last_cycle_time": None,
    "last_cycle_duration": 0,
    "last_error": None,
}


# =============================================================================
# CORE SAVE FUNCTION
# =============================================================================


def _save_all_sessions():
    """
    Read all active sessions from Redis and save to Django DB.
    This runs inside the background thread.
    """
    try:
        # Import here to avoid circular imports
        from attendance.session_manager import SessionManager

        # Late import of Django model - only works after Django is set up
        # Your model is in core/AI_Attendance/models.py
        try:
            from core.AI_Attendance.models import AttendanceSession
        except ImportError:
            try:
                from core.models import AttendanceSession
            except ImportError:
                logger.warning("⚠️ AttendanceSession model not found - skipping DB save")
                return 0

        sessions = SessionManager.get_all_sessions()
        if not sessions:
            return 0

        saved = 0
        failed = 0

        for session in sessions:
            try:
                meeting_id = session.get("meeting_id")
                user_id = session.get("user_id")

                if not meeting_id or not user_id:
                    continue

                # Try to update existing DB record
                try:
                    db_session = AttendanceSession.objects.get(
                        meeting_id=meeting_id, user_id=user_id
                    )
                except AttendanceSession.DoesNotExist:
                    # Session exists in Redis but not in DB - skip
                    # (It will be created when start_attendance_tracking writes it)
                    continue

                # Update fields from Redis session data
                # Only update fields that change during monitoring
                db_session.attendance_percentage = max(
                    0, 100 - session.get("attendance_penalty", 0)
                )
                db_session.popup_count = session.get("popup_count", 0)
                db_session.detection_count = session.get("detection_count", 0)

                # Save detection counts JSON
                detection_counts = session.get("detection_counts", {})
                if detection_counts:
                    db_session.detection_counts = detection_counts

                # Save violations JSON
                violations = session.get("violations", {})
                if violations:
                    db_session.violations = violations

                # Break info
                db_session.total_break_time_seconds = session.get(
                    "total_break_time_seconds", 0
                )
                db_session.break_count = session.get("break_count", 0)

                # Identity verification
                db_session.identity_verified = session.get(
                    "identity_verified", True
                )
                db_session.identity_warnings = session.get(
                    "identity_warnings", 0
                )

                db_session.save()
                saved += 1

            except Exception as e:
                failed += 1
                logger.error(
                    f"❌ Failed to save session "
                    f"{session.get('meeting_id')}_{session.get('user_id')}: {e}"
                )

        return saved

    except Exception as e:
        logger.error(f"❌ Error in _save_all_sessions: {e}")
        _stats["last_error"] = str(e)
        return 0


# =============================================================================
# BACKGROUND THREAD
# =============================================================================


def _saver_loop(interval):
    """
    Background loop that runs every `interval` seconds.
    """
    global _saver_running, _stats

    logger.info(f"🟢 Periodic saver started (interval: {interval}s)")

    while _saver_running:
        try:
            time.sleep(interval)

            if not _saver_running:
                break

            start_time = time.time()
            saved = _save_all_sessions()
            duration = time.time() - start_time

            _stats["cycles"] += 1
            _stats["total_saves"] += saved
            _stats["last_cycle_time"] = datetime.now().isoformat()
            _stats["last_cycle_duration"] = round(duration, 3)

            if saved > 0:
                logger.info(
                    f"💾 Periodic save: {saved} sessions saved in {duration:.3f}s"
                )

        except Exception as e:
            _stats["total_failures"] += 1
            _stats["last_error"] = str(e)
            logger.error(f"❌ Periodic saver error: {e}")

    logger.info("🛑 Periodic saver stopped")


# =============================================================================
# PUBLIC API
# =============================================================================


def start_periodic_saver(interval=30):
    """
    Start the periodic saver background thread.

    Args:
        interval: Seconds between save cycles (default: 30)

    Returns:
        bool: True if started, False if already running
    """
    global _saver_thread, _saver_running

    with _saver_lock:
        if _saver_running and _saver_thread and _saver_thread.is_alive():
            logger.info("⚠️ Periodic saver already running")
            return False

        _saver_running = True
        _saver_thread = threading.Thread(
            target=_saver_loop,
            args=(interval,),
            name="attendance-periodic-saver",
            daemon=True,  # Dies with main process
        )
        _saver_thread.start()

        logger.info(f"✅ Periodic saver started (every {interval}s)")
        return True


def stop_periodic_saver():
    """
    Stop the periodic saver.
    Does a final save before stopping.

    Returns:
        bool: True if stopped
    """
    global _saver_running

    with _saver_lock:
        if not _saver_running:
            logger.info("⚠️ Periodic saver not running")
            return False

        logger.info("🛑 Stopping periodic saver (final save)...")

        # Final save
        saved = _save_all_sessions()
        if saved > 0:
            logger.info(f"💾 Final save: {saved} sessions")

        _saver_running = False
        return True


def get_saver_stats():
    """
    Get periodic saver statistics.

    Returns:
        dict: Saver statistics
    """
    return {
        "running": _saver_running,
        "thread_alive": (
            _saver_thread.is_alive() if _saver_thread else False
        ),
        **_stats,
    }


def force_save_now():
    """
    Force an immediate save cycle (doesn't wait for interval).
    Can be called from any thread.

    Returns:
        int: Number of sessions saved
    """
    logger.info("⚡ Force save triggered")
    return _save_all_sessions()