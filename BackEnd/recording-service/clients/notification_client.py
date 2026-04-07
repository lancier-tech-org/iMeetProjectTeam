"""
Provides notification-related functions that recordings.py needs.
These query the DB directly since they're read-only lookups.
If Meeting Core Service exposes these as API endpoints later, switch to HTTP calls.
"""
import logging
import uuid
from django.db import connection

logger = logging.getLogger(__name__)


def short_id():
    """Generate a short unique ID"""
    return str(uuid.uuid4())[:8]


def ensure_notification_tables():
    """Ensure notification tables exist — managed by Meeting Core Service"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tbl_Notifications (
                    ID VARCHAR(50) PRIMARY KEY,
                    User_Email VARCHAR(255) NOT NULL,
                    Type VARCHAR(50) NOT NULL,
                    Title VARCHAR(500),
                    Message TEXT,
                    Meeting_ID VARCHAR(20),
                    Meeting_Title VARCHAR(255),
                    Is_Read BOOLEAN DEFAULT FALSE,
                    Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
                    Updated_At DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            """)
    except Exception as e:
        logger.warning(f"Could not ensure notification tables: {e}")


def _get_recording_meeting_info(meeting_id):
    """Get meeting info for recording notifications"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT m.ID, m.Meeting_Name, sm.title, sm.host_id, u.full_name, u.email
                FROM tbl_Meetings m
                LEFT JOIN tbl_ScheduledMeetings sm ON m.ID = sm.id
                LEFT JOIN tbl_Users u ON sm.host_id = u.ID
                WHERE m.ID = %s
            """, [meeting_id])
            row = cursor.fetchone()
            if row:
                return {
                    'meeting_id': row[0],
                    'meeting_name': row[1],
                    'title': row[2],
                    'host_id': row[3],
                    'host_name': row[4],
                    'host_email': row[5],
                }
            return None
    except Exception as e:
        logger.error(f"Error getting recording meeting info: {e}")
        return None


def _get_recording_participants(meeting_id):
    """Get participants for recording notifications"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT DISTINCT p.User_ID, u.full_name, u.email
                FROM tbl_Participants p
                LEFT JOIN tbl_Users u ON p.User_ID = u.ID
                WHERE p.Meeting_ID = %s
            """, [meeting_id])
            participants = []
            for row in cursor.fetchall():
                participants.append({
                    'user_id': row[0],
                    'name': row[1],
                    'email': row[2],
                })
            return participants
    except Exception as e:
        logger.error(f"Error getting recording participants: {e}")
        return []