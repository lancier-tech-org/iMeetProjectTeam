"""
HTTP client for Attendance Service.
Provides same function signatures as Attendance.py's start/stop functions.
"""
import os
import logging
import requests

logger = logging.getLogger(__name__)

ATTENDANCE_SERVICE_URL = os.getenv("ATTENDANCE_SERVICE_URL", "http://localhost:8233")


def start_attendance_tracking(meeting_id, user_id):
    """Start attendance tracking via Attendance Service"""
    try:
        response = requests.post(
            f"{ATTENDANCE_SERVICE_URL}/api/attendance/start/",
            json={"meeting_id": str(meeting_id), "user_id": str(user_id)},
            timeout=10
        )
        if response.status_code == 200:
            return True
        logger.warning(f"Attendance start returned {response.status_code}")
        return False
    except requests.exceptions.ConnectionError:
        logger.error("Cannot connect to Attendance Service")
        return False
    except Exception as e:
        logger.error(f"Attendance start error: {e}")
        return False


def stop_attendance_tracking(meeting_id, user_id):
    """Stop attendance tracking via Attendance Service"""
    try:
        response = requests.post(
            f"{ATTENDANCE_SERVICE_URL}/api/attendance/stop/",
            json={"meeting_id": str(meeting_id), "user_id": str(user_id)},
            timeout=10
        )
        if response.status_code == 200:
            return True
        logger.warning(f"Attendance stop returned {response.status_code}")
        return False
    except requests.exceptions.ConnectionError:
        logger.error("Cannot connect to Attendance Service")
        return False
    except Exception as e:
        logger.error(f"Attendance stop error: {e}")
        return False