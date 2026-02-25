# participants.py - Enhanced with Full LiveKit Integration
# from core.WebSocketConnection import enhanced_logging_config
from django.db import connection, transaction
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from core.AI_Attendance.Attendance import start_attendance_tracking, stop_attendance_tracking
from django.views.decorators.csrf import csrf_exempt
from django.urls import path
from django.db.utils import ProgrammingError, OperationalError
from django.utils import timezone
from datetime import datetime, timedelta
import json
import logging
import re
import os
from django.db import models
from django.contrib.auth.models import User
import uuid
import pytz
import time
import socket
from datetime import timedelta  # Add this import at the top
import redis
from django.conf import settings   

# IST Timezone configuration
IST_TIMEZONE = pytz.timezone('Asia/Kolkata')

def get_ist_now():
    """Get current time in IST timezone"""
    return timezone.now().astimezone(IST_TIMEZONE)

def convert_to_ist(dt):
    """Convert any datetime to IST timezone"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST_TIMEZONE)
    return dt.astimezone(IST_TIMEZONE)


DEFAULT_REDIS_CONFIG = {
    'host': os.getenv("DEFAULT_REDIS_HOST", "localhost"),
    'port': int(os.getenv("DEFAULT_REDIS_PORT", 6379)),
    'db': int(os.getenv("DEFAULT_REDIS_DB", 0)),
    'decode_responses': os.getenv("DEFAULT_REDIS_DECODE_RESPONSES", "True") == "True"
}

REDIS_CONFIG = getattr(settings, 'REDIS_CONFIG', DEFAULT_REDIS_CONFIG)
# Import LiveKit service from meetings.py
redis_client = None

# Replace your existing Redis functions with this single, clean implementation
# Add this to your participants.py file

def get_redis():
    """
    Get Redis connection with auto-configuration detection and fallback
    Returns None if Redis is unavailable (allows database-only operation)
    """
    global redis_client
    
    if redis_client is None:
        # Configurations to try in order
        configs_to_try = [
            # Original configuration
            {
                'host': 'redis.databases.svc.cluster.local',
                'port': 6379,
                'db': 0,
                'decode_responses': True,
                'socket_timeout': 3,
                'socket_connect_timeout': 3,
            },
            # Localhost fallback
            {
                'host': 'localhost', 
                'port': 6379,
                'db': 0,
                'decode_responses': True,
                'socket_timeout': 3,
                'socket_connect_timeout': 3,
            },
            # 127.0.0.1 fallback
            {
                'host': '127.0.0.1',
                'port': 6379, 
                'db': 0,
                'decode_responses': True,
                'socket_timeout': 3,
                'socket_connect_timeout': 3,
            }
        ]
        
        for config in configs_to_try:
            try:
                client = redis.StrictRedis(**config)
                
                # Test connection with ping
                client.ping()
                
                # If we get here, connection works
                redis_client = client
                logging.info(f"Redis connected successfully to {config['host']}:{config['port']}")
                
                # Update global config to working one
                global REDIS_CONFIG
                REDIS_CONFIG = config
                break
                
            except redis.ConnectionError:
                logging.debug(f"Redis connection failed for {config['host']}:{config['port']}")
                continue
            except redis.TimeoutError:
                logging.debug(f"Redis timeout for {config['host']}:{config['port']}")
                continue
            except Exception as e:
                logging.debug(f"Redis error for {config['host']}:{config['port']}: {e}")
                continue
        
        if redis_client is None:
            logging.warning("All Redis configurations failed - co-host features will use database-only mode")
    
    return redis_client

# Remove any get_redis_client() functions - use get_redis() directly
# Initialize on module load
redis_client = None

# Test Redis connection immediately when module loads
try:
    test_redis = get_redis()
    if test_redis:
        logging.info("Redis initialization successful on module load")
    else:
        logging.info("Redis unavailable - database-only mode enabled")
except Exception as e:
    logging.warning(f"Redis initialization error: {e}")
def init_redis_connection():
    """Initialize Redis connection on module load"""
    global redis_client
    try:
        redis_client = get_redis()
        if redis_client:
            logging.info("✅ Redis client initialized successfully for co-host functionality")
        else:
            logging.warning("⚠️ Redis client initialization failed - co-host features disabled")
    except Exception as e:
        logging.error(f"❌ Redis initialization error: {e}")
        redis_client = None

# Call initialization when module loads
init_redis_connection()

# Remove module-level import, add these helper functions instead:

def get_livekit_service():
    """Lazy import to avoid circular dependency"""
    try:
        from .meetings import livekit_service
        return livekit_service
    except ImportError:
        return None

def is_livekit_enabled():
    """Lazy import to avoid circular dependency"""
    try:
        from .meetings import LIVEKIT_ENABLED
        return LIVEKIT_ENABLED
    except ImportError:
        return False

def get_livekit_config():
    """Lazy import to avoid circular dependency"""
    try:
        from .meetings import LIVEKIT_CONFIG
        return LIVEKIT_CONFIG
    except ImportError:
        return {}

# Global Variables (aligned with meetings.py style)
TBL_PARTICIPANTS = 'tbl_Participants'
TBL_MEETINGS = 'tbl_Meetings'
TBL_USERS = 'tbl_Users'

SUCCESS_STATUS = 200
CREATED_STATUS = 201
BAD_REQUEST_STATUS = 400
NOT_FOUND_STATUS = 404
SERVER_ERROR_STATUS = 500

LOG_FILE_PATH = '/tmp/logs/participants_debug.log'
LOG_LEVEL = logging.DEBUG
LOG_FORMAT = '%(asctime)s %(levelname)s %(message)s'

logging.basicConfig(filename=LOG_FILE_PATH, level=LOG_LEVEL, format=LOG_FORMAT)



def calculate_duration_from_arrays(join_times, leave_times):
    """Calculate total duration from join/leave time arrays"""
    if not join_times:
        return 0.0
    
    total_duration = 0.0
    
    try:
        for i, join_time_str in enumerate(join_times):
            try:
                join_dt = datetime.strptime(join_time_str, '%Y-%m-%d %H:%M:%S')
                
                if i < len(leave_times):
                    leave_time_str = leave_times[i]
                    leave_dt = datetime.strptime(leave_time_str, '%Y-%m-%d %H:%M:%S')
                else:
                    leave_dt = datetime.now()
                
                if join_dt.tzinfo is None:
                    join_dt = IST_TIMEZONE.localize(join_dt)
                if leave_dt.tzinfo is None:
                    leave_dt = IST_TIMEZONE.localize(leave_dt)
                
                session_duration = (leave_dt - join_dt).total_seconds() / 60.0
                
                if session_duration > 0:
                    total_duration += session_duration
                    
            except Exception as e:
                logging.error(f"Error processing session {i+1}: {e}")
                continue
        
        return round(total_duration, 2)
        
    except Exception as e:
        logging.error(f"Error in calculate_duration_from_arrays: {e}")
        return 0.0


def get_host_duration_for_meeting(meeting_id):
    """Get HOST's duration (total meeting duration)"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    Total_Duration_Minutes,
                    Join_Times,
                    Leave_Times
                FROM tbl_Participants
                WHERE Meeting_ID = %s 
                AND Role = 'host'
                ORDER BY ID ASC
                LIMIT 1
            """, [meeting_id])
            
            host_data = cursor.fetchone()
            
            if not host_data:
                return 0.0
            
            total_duration, join_times_json, leave_times_json = host_data
            
            if total_duration and total_duration > 0:
                return float(total_duration)
            
            try:
                if isinstance(join_times_json, str):
                    join_times = json.loads(join_times_json)
                else:
                    join_times = join_times_json or []
                
                if isinstance(leave_times_json, str):
                    leave_times = json.loads(leave_times_json)
                else:
                    leave_times = leave_times_json or []
                
                duration = calculate_duration_from_arrays(join_times, leave_times)
                return duration
                
            except Exception as e:
                logging.error(f"Error parsing host times: {e}")
                return 0.0
                
    except Exception as e:
        logging.error(f"Error getting host duration: {e}")
        return 0.0


def get_user_duration_for_meeting(meeting_id, user_id):
    """Get specific USER's duration in meeting"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    Total_Duration_Minutes,
                    Join_Times,
                    Leave_Times
                FROM tbl_Participants
                WHERE Meeting_ID = %s 
                AND User_ID = %s
                ORDER BY ID DESC
                LIMIT 1
            """, [meeting_id, user_id])
            
            user_data = cursor.fetchone()
            
            if not user_data:
                return 0.0
            
            total_duration, join_times_json, leave_times_json = user_data
            
            if total_duration and total_duration > 0:
                return float(total_duration)
            
            try:
                if isinstance(join_times_json, str):
                    join_times = json.loads(join_times_json)
                else:
                    join_times = join_times_json or []
                
                if isinstance(leave_times_json, str):
                    leave_times = json.loads(leave_times_json)
                else:
                    leave_times = leave_times_json or []
                
                duration = calculate_duration_from_arrays(join_times, leave_times)
                return duration
                
            except Exception as e:
                logging.error(f"Error parsing user times: {e}")
                return 0.0
                
    except Exception as e:
        logging.error(f"Error getting user duration: {e}")
        return 0.0


def format_duration_mmss(decimal_minutes):
    """Format decimal minutes to MM:SS"""
    if not decimal_minutes or decimal_minutes <= 0:
        return "00:00"
    
    total_seconds = decimal_minutes * 60
    minutes = int(total_seconds // 60)
    seconds = int(total_seconds % 60)
    
    return f"{minutes:02d}:{seconds:02d}"

def format_duration_auto(decimal_minutes):
    """
    Smart formatting: MM:SS for short, HH:MM:SS for long
    """
    if not decimal_minutes or decimal_minutes <= 0:
        return "00:00"
    
    if decimal_minutes < 60:
        return format_duration_mmss(decimal_minutes)
    else:
        total_seconds = decimal_minutes * 60
        hours = int(total_seconds // 3600)
        remaining = total_seconds % 3600
        minutes = int(remaining // 60)
        seconds = int(remaining % 60)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

class Participants(models.Model):
    ID = models.AutoField(primary_key=True)
    Meeting_ID = models.ForeignKey(
        'core.Meetings', on_delete=models.CASCADE, db_column='Meeting_ID',
        related_name='participants'
    )
    User_ID = models.ForeignKey(
        User, on_delete=models.CASCADE, db_column='User_ID',
        related_name='participations'
    )
    Full_Name = models.CharField(max_length=100, blank=True, null=True)
    Role = models.CharField(max_length=50, default='participant')
    Meeting_Type = models.CharField(max_length=50, blank=True, null=True)
    Join_Times = models.JSONField()
    Leave_Times = models.JSONField(default=list)
    Total_Duration_Minutes = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    Total_Sessions = models.IntegerField(default=0)
    End_Meeting_Time = models.DateTimeField(blank=True, null=True)
    Is_Currently_Active = models.BooleanField(default=True)
    Attendance_Percentagebasedon_host = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    Participant_Attendance = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    Overall_Attendance = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    occurrence_number = models.IntegerField(default=1)
    session_start_time = models.DateField()

    class Meta:
        db_table = 'tbl_Participants'
        app_label = 'core'
        unique_together = [('Meeting_ID', 'User_ID', 'occurrence_number')]


def create_participants_table():
    """Create tbl_Participants table with all required columns, indexes, and constraints"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tbl_Participants (
                    ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    Meeting_ID VARCHAR(20) NOT NULL,
                    User_ID INT NOT NULL,
                    Full_Name VARCHAR(100) DEFAULT NULL,
                    Role VARCHAR(50) DEFAULT 'participant',
                    Meeting_Type VARCHAR(50) DEFAULT NULL,
                    Join_Times JSON NOT NULL COMMENT 'Array of all join times: ["2024-10-16 12:00:00", "2024-10-16 12:30:00"]',
                    Leave_Times JSON NOT NULL DEFAULT (JSON_ARRAY()) COMMENT 'Array of all leave times: ["2024-10-16 12:10:00"]',
                    Total_Duration_Minutes DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Sum of all session durations in minutes',
                    Total_Sessions INT DEFAULT 0 COMMENT 'Count of completed sessions',
                    End_Meeting_Time DATETIME DEFAULT NULL,
                    Is_Currently_Active TINYINT(1) DEFAULT 1 COMMENT 'Is user currently in meeting',
                    Attendance_Percentagebasedon_host DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Attendance percentage based on host total duration',
                    Participant_Attendance DECIMAL(5,2) DEFAULT NULL COMMENT 'Per-meeting average: (attendance_percentage + Attendance_Percentagebasedon_host) / 2',
                    Overall_Attendance DECIMAL(5,2) DEFAULT NULL COMMENT 'Overall attendance: AVG(Participant_Attendance) across all meetings for same user',
                    occurrence_number INT NOT NULL DEFAULT 1,
                    session_start_time DATE NOT NULL,
                    UNIQUE KEY idx_unique_participant (Meeting_ID, User_ID, occurrence_number),
                    KEY idx_active_users (Meeting_ID, Is_Currently_Active),
                    KEY idx_participants_overall_attendance (User_ID, Overall_Attendance),
                    KEY idx_user_part_attend (User_ID, Participant_Attendance),
                    KEY idx_user_overall_attend (User_ID, Overall_Attendance),
                    KEY idx_attend_summary (User_ID, Participant_Attendance, Overall_Attendance),
                    CONSTRAINT FK_Participants_Meeting FOREIGN KEY (Meeting_ID) REFERENCES tbl_Meetings (ID) ON DELETE CASCADE ON UPDATE CASCADE,
                    CONSTRAINT FK_Participants_User FOREIGN KEY (User_ID) REFERENCES tbl_Users (ID) ON DELETE CASCADE ON UPDATE CASCADE,
                    CONSTRAINT chk_meeting_type CHECK (Meeting_Type IN ('InstantMeeting','ScheduleMeeting','CalendarMeeting')),
                    CONSTRAINT chk_role CHECK (Role IN ('host','co-host','participant'))
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Stores participant data with session arrays'
            """)
            logging.debug("tbl_Participants table created successfully")
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Failed to create tbl_Participants table: {e}")
        
def calculate_session_duration(session_start, session_end=None):
    """Calculate duration of a single session in seconds"""
    if not session_start:
        return 0
    
    start_ist = convert_to_ist(session_start)
    end_ist = convert_to_ist(session_end) if session_end else get_ist_now()
    
    duration = int((end_ist - start_ist).total_seconds())
    return max(0, duration)

def format_duration_as_minutes_seconds(total_seconds):
    """
    Format duration as MM.SS (minutes.seconds)
    Examples:
    - 30 seconds -> "00.30"
    - 90 seconds -> "01.30"
    - 630 seconds (10 min 30 sec) -> "10.30"
    - 3661 seconds (61 min 1 sec) -> "61.01"
    
    Args:
        total_seconds: Total duration in seconds (int)
    
    Returns:
        str: Formatted as "MM.SS"
    """
    if not total_seconds or total_seconds < 0:
        return "00.00"
    
    minutes = int(total_seconds // 60)
    seconds = int(total_seconds % 60)
    
    # Format as MM.SS
    return f"{minutes:02d}.{seconds:02d}"

def get_duration_breakdown(total_seconds):
    """
    Get detailed duration breakdown
    
    Returns:
        dict with seconds, minutes, formatted string
    """
    if not total_seconds or total_seconds < 0:
        return {
            'total_seconds': 0,
            'total_minutes': 0.0,
            'display_format': '00.00',
            'minutes': 0,
            'seconds': 0
        }
    
    minutes = int(total_seconds // 60)
    seconds = int(total_seconds % 60)
    total_minutes_decimal = round(total_seconds / 60, 2)
    
    return {
        'total_seconds': int(total_seconds),
        'total_minutes': total_minutes_decimal,
        'display_format': f"{minutes:02d}.{seconds:02d}",
        'minutes': minutes,
        'seconds': seconds
    }

def get_or_create_participant_for_occurrence(meeting_id, user_id):
    """
    ✅ HELPER: Determines which occurrence a user should be in with 15-minute grace period
    
    LOGIC:
    - If user has NO record → Return occurrence_number = 1 (new)
    - If user's LATEST record has End_Meeting_Time = NULL:
        - Get HOST record for this occurrence
        - If HOST is still active (Is_Currently_Active = TRUE) → Rejoin same occurrence
        - If HOST left (Is_Currently_Active = FALSE):
            - Check if 15+ minutes have passed since HOST's last leave_time
            - If YES (15+ min) → AUTO-SET End_Meeting_Time = host's last leave_time
                              → Create new occurrence (host abandoned)
            - If NO (< 15 min) → Rejoin same occurrence (within grace period)
    - If user's LATEST record has End_Meeting_Time != NULL → Return next occurrence (new, explicitly locked)
    
    RETURNS:
    {
        'occurrence_number': int,
        'is_new_occurrence': bool,
        'last_participant_id': int or None
    }
    """
    try:
        with connection.cursor() as cursor:
            # Get MOST RECENT record for this user in this meeting
            cursor.execute("""
                SELECT ID, occurrence_number, End_Meeting_Time
                FROM tbl_Participants
                WHERE Meeting_ID = %s AND User_ID = %s
                ORDER BY occurrence_number DESC
                LIMIT 1
            """, [meeting_id, user_id])
            
            existing = cursor.fetchone()
            
            if not existing:
                # FIRST TIME - No previous record
                logging.info(f"[OCCURRENCE] User {user_id} - First time join (occurrence #1)")
                return {
                    'occurrence_number': 1,
                    'is_new_occurrence': True,
                    'last_participant_id': None
                }
            
            else:
                participant_id, last_occurrence_number, end_meeting_time = existing
                
                if end_meeting_time is not None:
                    # PAST OCCURRENCE IS CLOSED - Create new occurrence
                    next_occurrence = last_occurrence_number + 1
                    logging.info(f"[OCCURRENCE] User {user_id} - Past occurrence #{last_occurrence_number} closed (End_Meeting_Time: {end_meeting_time}). Creating occurrence #{next_occurrence}")
                    return {
                        'occurrence_number': next_occurrence,
                        'is_new_occurrence': True,
                        'last_participant_id': participant_id
                    }
                
                else:
                    # ===== STEP 1: Get HOST record for this occurrence =====
                    cursor.execute("""
                        SELECT ID, Role, Is_Currently_Active, Leave_Times
                        FROM tbl_Participants
                        WHERE Meeting_ID = %s AND occurrence_number = %s AND LOWER(Role) = 'host'
                        LIMIT 1
                    """, [meeting_id, last_occurrence_number])
                    
                    host_record = cursor.fetchone()
                    
                    if not host_record:
                        # NO HOST FOUND - Default to rejoin same occurrence
                        logging.warning(f"[OCCURRENCE] User {user_id} - No host found for occurrence #{last_occurrence_number}. Defaulting to rejoin.")
                        return {
                            'occurrence_number': last_occurrence_number,
                            'is_new_occurrence': False,
                            'last_participant_id': participant_id
                        }
                    
                    host_id, host_role, host_is_active, host_leave_times_json = host_record
                    
                    # ===== STEP 2: Check if HOST is still active =====
                    if host_is_active:
                        # HOST IS STILL IN MEETING - Rejoin same occurrence
                        logging.info(f"[OCCURRENCE] User {user_id} - Host is still active in occurrence #{last_occurrence_number}. Rejoining.")
                        return {
                            'occurrence_number': last_occurrence_number,
                            'is_new_occurrence': False,
                            'last_participant_id': participant_id
                        }
                    
                    # ===== STEP 3: HOST HAS LEFT - Check 15-minute grace period =====
                    else:
                        # Parse HOST's leave_times
                        host_leave_times = []
                        try:
                            if host_leave_times_json:
                                if isinstance(host_leave_times_json, str):
                                    host_leave_times = json.loads(host_leave_times_json)
                                elif isinstance(host_leave_times_json, list):
                                    host_leave_times = host_leave_times_json
                        except Exception as e:
                            logging.error(f"[OCCURRENCE] Error parsing host leave_times: {e}")
                            host_leave_times = []
                        
                        if len(host_leave_times) == 0:
                            # NO LEAVE TIME RECORDED - Default to rejoin (fail open)
                            logging.warning(f"[OCCURRENCE] User {user_id} - Host marked inactive but no leave_time found. Defaulting to rejoin.")
                            return {
                                'occurrence_number': last_occurrence_number,
                                'is_new_occurrence': False,
                                'last_participant_id': participant_id
                            }
                        
                        # Get HOST's LAST leave time
                        host_last_leave_str = host_leave_times[-1]
                        
                        try:
                            # Parse the leave time
                            host_last_leave_dt = datetime.strptime(host_last_leave_str, '%Y-%m-%d %H:%M:%S')
                            
                            # Make timezone aware (IST)
                            ist_timezone = pytz.timezone('Asia/Kolkata')
                            if host_last_leave_dt.tzinfo is None:
                                host_last_leave_dt = ist_timezone.localize(host_last_leave_dt)
                            
                            # Get current time in IST
                            current_time = datetime.now(ist_timezone)
                            
                            # Calculate time elapsed in seconds
                            time_elapsed_seconds = (current_time - host_last_leave_dt).total_seconds()
                            time_elapsed_minutes = time_elapsed_seconds / 60.0
                            
                            logging.info(f"[OCCURRENCE] User {user_id} - Host left at {host_last_leave_str}. Time elapsed: {time_elapsed_minutes:.2f} minutes")
                            
                            # ===== CHECK 15-MINUTE GRACE PERIOD =====
                            if time_elapsed_minutes > 15:
                                # 15+ MINUTES PASSED - Host abandoned occurrence, create new one
                                # ✅ NEW: AUTO-SET End_Meeting_Time to host's last leave time
                                logging.info(f"[OCCURRENCE] Grace period expired ({time_elapsed_minutes:.2f} min > 15 min). Setting End_Meeting_Time for occurrence #{last_occurrence_number}")
                                
                                cursor.execute("""
                                    UPDATE tbl_Participants
                                    SET End_Meeting_Time = %s
                                    WHERE Meeting_ID = %s AND occurrence_number = %s
                                """, [host_last_leave_str, meeting_id, last_occurrence_number])
                                
                                if cursor.rowcount > 0:
                                    logging.info(f"✅ [OCCURRENCE] Set End_Meeting_Time = {host_last_leave_str} for all participants in occurrence #{last_occurrence_number}")
                                else:
                                    logging.warning(f"⚠️ [OCCURRENCE] Failed to update End_Meeting_Time for occurrence #{last_occurrence_number}")
                                
                                # Create new occurrence
                                next_occurrence = last_occurrence_number + 1
                                logging.info(f"[OCCURRENCE] User {user_id} - Creating new occurrence #{next_occurrence}")
                                return {
                                    'occurrence_number': next_occurrence,
                                    'is_new_occurrence': True,
                                    'last_participant_id': participant_id
                                }
                            else:
                                # WITHIN 15-MINUTE GRACE PERIOD - Host might rejoin, keep occurrence open
                                logging.info(f"[OCCURRENCE] User {user_id} - Within grace period ({time_elapsed_minutes:.2f} min ≤ 15 min). Occurrence #{last_occurrence_number} still open for host rejoin.")
                                return {
                                    'occurrence_number': last_occurrence_number,
                                    'is_new_occurrence': False,
                                    'last_participant_id': participant_id
                                }
                        
                        except ValueError as ve:
                            logging.error(f"[OCCURRENCE] Error parsing host leave time '{host_last_leave_str}': {ve}")
                            # On parse error, default to rejoin (fail open)
                            return {
                                'occurrence_number': last_occurrence_number,
                                'is_new_occurrence': False,
                                'last_participant_id': participant_id
                            }
                        
                        except Exception as e:
                            logging.error(f"[OCCURRENCE] Error calculating grace period: {e}")
                            # On any error, default to rejoin (fail open)
                            return {
                                'occurrence_number': last_occurrence_number,
                                'is_new_occurrence': False,
                                'last_participant_id': participant_id
                            }
                    
    except Exception as e:
        logging.error(f"[OCCURRENCE] Error in get_or_create_participant_for_occurrence: {e}")
        import traceback
        logging.error(traceback.format_exc())
        # Default to new occurrence on error
        return {
            'occurrence_number': 1,
            'is_new_occurrence': True,
            'last_participant_id': None
        }
        
@require_http_methods(["POST"])
@csrf_exempt
def record_participant_join(request):
    """
    ✅ FULLY FIXED: Records participant join with proper schema
    """
    try:
        data = json.loads(request.body)
        
        meeting_id = (data.get('meeting_id') or data.get('Meeting_ID') or data.get('meetingId'))
        user_id = (data.get('user_id') or data.get('User_ID') or data.get('userId'))
        is_host = data.get('is_host', False)
        
        logging.info(f"[JOIN] Processing join for user {user_id} in meeting {meeting_id}")
        
        # Validate inputs
        if not meeting_id or not user_id:
            return JsonResponse({
                'success': False,
                'error': 'meeting_id and user_id required'
            }, status=400)
        
        try:
            user_id = int(user_id)
        except (ValueError, TypeError):
            return JsonResponse({
                'success': False,
                'error': 'user_id must be integer'
            }, status=400)
        
        # Get user name from tbl_Users
        # actual_user_name = f"User_{user_id}"

        actual_user_name = f"User_{user_id}"
        with connection.cursor() as cursor:
            cursor.execute("SELECT full_name FROM tbl_Users WHERE ID = %s", [user_id])
            row = cursor.fetchone()
            if row and row[0]:
                actual_user_name = row[0]
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT full_name FROM tbl_Users WHERE ID = %s", [user_id])
                user_row = cursor.fetchone()
                if user_row and user_row[0]:
                    actual_user_name = user_row[0].strip()
                    logging.info(f"[JOIN] Found user name: {actual_user_name}")
        except Exception as e:
            logging.error(f"[JOIN] Error fetching user name: {e}")
        
        # Get meeting info
        host_id = None
        meeting_type = 'InstantMeeting'
        
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT Host_ID, Meeting_Type, Status
                    FROM tbl_Meetings 
                    WHERE ID = %s
                """, [meeting_id])
                meeting_row = cursor.fetchone()
                
                if not meeting_row:
                    logging.error(f"[JOIN] Meeting {meeting_id} not found")
                    return JsonResponse({
                        'success': False,
                        'error': 'Meeting not found'
                    }, status=404)
                
                host_id = meeting_row[0]
                meeting_type = meeting_row[1] or 'InstantMeeting'
                meeting_status = meeting_row[2]
                
                if meeting_status == 'ended':
                    return JsonResponse({
                        'success': False,
                        'error': 'Meeting has ended'
                    }, status=400)
                    
        except Exception as e:
            logging.error(f"[JOIN] Meeting validation error: {e}")
            return JsonResponse({
                'success': False,
                'error': f'Database error: {str(e)}'
            }, status=500)
        
        # ✅ NEW: Get occurrence number
        occurrence_info = get_or_create_participant_for_occurrence(meeting_id, user_id)
        occurrence_number = occurrence_info['occurrence_number']
        is_new_occurrence = occurrence_info['is_new_occurrence']
        logging.info(f"[JOIN] User {user_id}: occurrence_number={occurrence_number}, is_new_occurrence={is_new_occurrence}")

        # Determine role
        role = 'host' if (is_host or (host_id and user_id == host_id)) else 'participant'
        join_time = get_ist_now()
        join_time_str = join_time.strftime('%Y-%m-%d %H:%M:%S')
        current_date_str = join_time.date().strftime('%Y-%m-%d')
        
        try:
            with connection.cursor() as cursor:
                
                # ✅ NEW: Check if this is a new occurrence or rejoin
                if is_new_occurrence:
                    # ===== NEW OCCURRENCE - CREATE NEW ROW =====
                    logging.info(f"[JOIN] User {user_id} - Creating NEW occurrence #{occurrence_number}")
                    
                    cursor.execute("""
                        INSERT INTO tbl_Participants 
                        (Meeting_ID, User_ID, Full_Name, Role, Meeting_Type,
                         Join_Times, Leave_Times, Total_Duration_Minutes, Total_Sessions,
                         Is_Currently_Active, Attendance_Percentagebasedon_host,
                         session_start_time, occurrence_number)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, 0, 0, TRUE, 0.00, %s, %s)
                    """, [
                        meeting_id, 
                        user_id, 
                        actual_user_name, 
                        role, 
                        meeting_type,
                        json.dumps([join_time_str]),
                        json.dumps([]),
                        current_date_str,
                        occurrence_number
                    ])
                    
                    participant_id = cursor.lastrowid
                    action = 'new_occurrence'
                    logging.info(f"✅ [JOIN] Created new occurrence #{occurrence_number} for user {user_id} (participant_id: {participant_id})")
                    
                    if role == 'host':
                        cursor.execute("""
                            UPDATE tbl_Meetings 
                            SET Started_At = %s 
                            WHERE ID = %s AND Started_At IS NULL
                        """, [join_time, meeting_id])
                        if cursor.rowcount > 0:
                            logging.info(f"✅ Set Started_At for meeting {meeting_id} to {join_time_str} (host first join)")
                
                else:
                    # ===== REJOIN CURRENT OCCURRENCE - UPDATE EXISTING ROW =====
                    logging.info(f"[JOIN] User {user_id} - Rejoining existing occurrence #{occurrence_number}")
                    
                    # Get the existing participant record
                    cursor.execute("""
                        SELECT ID, Join_Times, Leave_Times, Is_Currently_Active
                        FROM tbl_Participants 
                        WHERE Meeting_ID = %s AND User_ID = %s AND occurrence_number = %s
                    """, [meeting_id, user_id, occurrence_number])
                    
                    existing = cursor.fetchone()
                    
                    if not existing:
                        logging.error(f"[JOIN] ERROR: Expected to find participant for user {user_id}, occurrence {occurrence_number}")
                        return JsonResponse({
                            'success': False,
                            'error': 'Participant record not found'
                        }, status=400)
                    
                    participant_id, join_times_json, leave_times_json, is_active = existing
                    
                    # Parse arrays
                    try:
                        join_times = json.loads(join_times_json) if isinstance(join_times_json, str) else (join_times_json or [])
                    except:
                        join_times = []
                    
                    try:
                        leave_times = json.loads(leave_times_json) if isinstance(leave_times_json, str) else (leave_times_json or [])
                    except:
                        leave_times = []
                    
                    if is_active:
                        logging.warning(f"[JOIN] User {user_id} already active - treating as duplicate")
                        
                        # ✅ FIX: Always update Full_Name even for already-active users
                        # This corrects any fallback name ("User 47") written by sync
                        cursor.execute("""
                            UPDATE tbl_Participants 
                            SET Full_Name = %s
                            WHERE ID = %s AND (Full_Name IS NULL OR Full_Name LIKE 'User %%' OR Full_Name LIKE 'User\\_%%')
                        """, [actual_user_name, participant_id])
                        if cursor.rowcount > 0:
                            logging.info(f"[JOIN] ✅ Fixed Full_Name for already-active user {user_id}: '{actual_user_name}'")
                        
                        return JsonResponse({
                            'success': True,
                            'message': 'User already in meeting',
                            'participant_id': participant_id,
                            'action': 'already_active'
                        }, status=200)
                    
                    # Append new join time
                    join_times.append(join_time_str)
                    
                    cursor.execute("""
                        UPDATE tbl_Participants 
                        SET Join_Times = %s,
                            Is_Currently_Active = TRUE,
                            Full_Name = %s
                        WHERE ID = %s
                    """, [json.dumps(join_times), actual_user_name, participant_id])
                    
                    action = 'rejoin'
                    logging.info(f"✅ [JOIN] User {user_id} rejoined occurrence #{occurrence_number} (session #{len(join_times)})")
                
                return JsonResponse({
                    'success': True,
                    'message': f'Participant join recorded - {action}',
                    'participant_id': participant_id,
                    'meeting_id': meeting_id,
                    'user_id': user_id,
                    'full_name': actual_user_name,
                    'role': role,
                    'join_time': join_time_str,
                    'action': action,
                    'occurrence_number': occurrence_number
                }, status=201 if action == 'new_occurrence' else 200)

        except Exception as db_error:
            logging.error(f"[JOIN] Database error: {db_error}")
            import traceback
            logging.error(f"Traceback: {traceback.format_exc()}")
            return JsonResponse({
                'success': False,
                'error': 'Failed to record join',
                'details': str(db_error)
            }, status=500)
            
    except json.JSONDecodeError as e:
        logging.error(f"[JOIN] JSON decode error: {e}")
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON format'
        }, status=400)
    except Exception as e:
        logging.error(f"[JOIN] Unexpected error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return JsonResponse({
            'success': False,
            'error': 'Internal server error',
            'details': str(e)
        }, status=500)

@require_http_methods(["POST"])
@csrf_exempt
def record_participant_leave(request):
    """
    ✅ ENHANCED: Records participant leave with proper duration calculation
    
    LOGIC:
    - When any participant leaves: Update their join_times/leave_times, calculate duration, update sessions
    - When HOST or CO-HOST leaves:
        - Calculate total_duration_minutes for ALL participants
        - For INACTIVE participants: Use their actual leave_times
        - For ACTIVE participants: Use host's leave_time as TEMPORARY fallback (NOT stored in DB)
        - Calculate Attendance_Percentagebasedon_host for ALL participants
    - Auto-stops recording when BOTH host AND co-host have left
    - Meeting remains ACTIVE - host/co-host can rejoin using same link
    - Meeting ONLY ends when host clicks "End Meeting" button
    - Tracks Total_Sessions for multiple join/leave cycles
    - Ensures Total_Duration_Minutes is NEVER null
    - NO duplicate leave_times in database
    """
    try:
        data = json.loads(request.body)
        
        meeting_id = (data.get('meeting_id') or data.get('Meeting_ID') or data.get('meetingId'))
        user_id = (data.get('user_id') or data.get('User_ID') or data.get('userId'))
        
        logging.info(f"[LEAVE] Processing leave for user {user_id} in meeting {meeting_id}")
        
        # Validate
        if not meeting_id or not user_id:
            return JsonResponse({
                'success': False,
                'error': 'meeting_id and user_id required'
            }, status=400)
        
        try:
            user_id = int(user_id)
        except (ValueError, TypeError):
            return JsonResponse({
                'success': False,
                'error': 'user_id must be integer'
            }, status=400)
        
        leave_time = get_ist_now()
        leave_time_str = leave_time.strftime('%Y-%m-%d %H:%M:%S')

        # ✅ NEW: Get LATEST occurrence number for this user (highest occurrence_number, most recent join)
        # ✅ NEW: Get LATEST occurrence_number by getting the most recent one with highest ID
        occurrence_number = 1  # Default to 1
        try:
            with connection.cursor() as cursor:
                # Get the latest occurrence by selecting the one with highest ID (most recent insert)
                cursor.execute("""
                    SELECT occurrence_number 
                    FROM tbl_Participants
                    WHERE Meeting_ID = %s AND User_ID = %s
                    ORDER BY ID DESC 
                    LIMIT 1
                """, [meeting_id, user_id])
                occ_result = cursor.fetchone()
                if occ_result and occ_result[0]:
                    occurrence_number = occ_result[0]
                    logging.info(f"[LEAVE] ✅ Detected LATEST occurrence_number: {occurrence_number} (from most recent participant record)")
                else:
                    logging.warning(f"[LEAVE] No participants found, defaulting to occurrence_number = 1")
        except Exception as e:
            logging.warning(f"[LEAVE] Could not detect occurrence_number: {e}")
            logging.info(f"[LEAVE] ⚠️ Defaulting to occurrence_number = 1")
            
        try:
            with connection.cursor() as cursor:
                # Get participant record
                cursor.execute("""
                    SELECT ID, Join_Times, Leave_Times, Full_Name, Role, 
                        Is_Currently_Active, Total_Duration_Minutes, Total_Sessions
                    FROM tbl_Participants 
                    WHERE Meeting_ID = %s AND User_ID = %s AND Is_Currently_Active = TRUE AND occurrence_number = %s
                """, [meeting_id, user_id, occurrence_number])
                        
                row = cursor.fetchone()
                
                if not row:
                    logging.warning(f"[LEAVE] No record found for user {user_id}")
                    
                    return JsonResponse({
                        'success': False,
                        'error': 'No participant record found',
                        'meeting_id': meeting_id,
                        'user_id': user_id
                    }, status=400)
                
                (participant_id, join_times_json, leave_times_json, full_name, 
                 role, is_active, cumulative_minutes, total_sessions) = row
                
                logging.info(f"[LEAVE] Found record - ID: {participant_id}, Role: {role}, Active: {is_active}")
                
                # Parse JSON arrays
                join_times = []
                leave_times = []
                
                try:
                    if join_times_json:
                        if isinstance(join_times_json, str):
                            join_times = json.loads(join_times_json)
                        elif isinstance(join_times_json, list):
                            join_times = join_times_json
                except Exception as e:
                    logging.error(f"[LEAVE] Error parsing join_times: {e}")
                
                try:
                    if leave_times_json:
                        if isinstance(leave_times_json, str):
                            leave_times = json.loads(leave_times_json)
                        elif isinstance(leave_times_json, list):
                            leave_times = leave_times_json
                except Exception as e:
                    logging.error(f"[LEAVE] Error parsing leave_times: {e}")
                
                # Check if user is currently active
                if not is_active:
                    logging.warning(f"[LEAVE] User {user_id} already left")
                    
                    return JsonResponse({
                        'success': False,
                        'error': 'Participant has already left',
                        'participant_id': participant_id,
                        'status': 'already_left'
                    }, status=400)
                
                # Check if we have join times
                if len(join_times) == 0:
                    return JsonResponse({
                        'success': False,
                        'error': 'No join time found for this user'
                    }, status=400)
                
                # ===== NEW: Check if End_Meeting_Time is NULL (host didn't formally end) =====
                cursor.execute("""
                    SELECT End_Meeting_Time FROM tbl_Participants 
                    WHERE Meeting_ID = %s AND occurrence_number = %s LIMIT 1
                """, [meeting_id, occurrence_number])
                occurrence_end_time_row = cursor.fetchone()
                occurrence_end_meeting_time = occurrence_end_time_row[0] if occurrence_end_time_row else None
                
                # ===== NEW: If End_Meeting_Time is NULL, cap at host's last leave time =====
                effective_leave_time_str = leave_time_str  # Default to participant's actual leave time
                
                if occurrence_end_meeting_time is None and role.lower() != 'host':
                    # Host didn't formally end meeting AND this is not the host
                    # Get host's last leave time
                    cursor.execute("""
                        SELECT Leave_Times FROM tbl_Participants 
                        WHERE Meeting_ID = %s AND occurrence_number = %s AND LOWER(Role) = 'host' LIMIT 1
                    """, [meeting_id, occurrence_number])
                    host_leave_row = cursor.fetchone()
                    
                    if host_leave_row:
                        try:
                            host_leave_times_json = host_leave_row[0]
                            host_leave_times = []
                            if host_leave_times_json:
                                if isinstance(host_leave_times_json, str):
                                    host_leave_times = json.loads(host_leave_times_json)
                                elif isinstance(host_leave_times_json, list):
                                    host_leave_times = host_leave_times_json
                            
                            if len(host_leave_times) > 0:
                                host_last_leave_str = host_leave_times[-1]
                                
                                # Parse times and compare
                                participant_leave_dt = datetime.strptime(leave_time_str, '%Y-%m-%d %H:%M:%S')
                                host_leave_dt = datetime.strptime(host_last_leave_str, '%Y-%m-%d %H:%M:%S')
                                
                                # If participant leaves AFTER host, cap at host's leave time
                                if participant_leave_dt > host_leave_dt:
                                    effective_leave_time_str = host_last_leave_str
                                    logging.info(f"[LEAVE] Participant {user_id} left after host ({leave_time_str} > {host_last_leave_str}). Capping duration at host's leave time: {host_last_leave_str}")
                                else:
                                    logging.info(f"[LEAVE] Participant {user_id} left before or at same time as host. Using actual leave time: {leave_time_str}")
                        except Exception as e:
                            logging.error(f"[LEAVE] Error capping participant duration at host leave time: {e}")
                            logging.warning(f"[LEAVE] Falling back to actual leave time: {leave_time_str}")
                
                # Append EFFECTIVE leave time (either actual or capped at host's leave)
                leave_times.append(effective_leave_time_str)
                
                # ===== Calculate total duration from ALL sessions =====
                total_duration_minutes = calculate_duration_from_arrays(join_times, leave_times)
                
                # ===== ENSURE NOT NULL - Fallback to 0 =====
                if total_duration_minutes is None:
                    total_duration_minutes = 0.0
                
                # ===== Total Sessions = count of completed leave_times =====
                completed_sessions = len(leave_times)
                
                logging.info(f"[LEAVE] Calculated duration: {total_duration_minutes:.2f} minutes across {completed_sessions} sessions (using leave time: {effective_leave_time_str})")
                
                # Update participant record with their effective leave time
                cursor.execute("""
                    UPDATE tbl_Participants
                    SET Leave_Times = %s,
                        Total_Duration_Minutes = %s,
                        Total_Sessions = %s,
                        Is_Currently_Active = FALSE
                    WHERE ID = %s
                """, [json.dumps(leave_times), total_duration_minutes, completed_sessions, participant_id])

                if cursor.rowcount == 0:
                    return JsonResponse({
                        'success': False,
                        'error': 'Failed to update leave time'
                    }, status=500)
                
                logging.info(f"✅ [LEAVE SUCCESS] User {user_id}: {total_duration_minutes:.2f} minutes total, Sessions: {completed_sessions}")
                
                # ===== IF HOST OR CO-HOST LEAVES: CALCULATE DURATION & ATTENDANCE FOR ALL =====
                recording_auto_stopped = False
                recording_stop_result = None
                current_role = (role or '').lower()
                is_recording_enabled = False
                attendance_updated = False
                participants_attendance = []
                
                if current_role in ['host', 'co-host', 'cohost', 'co_host']:
                    logging.info(f"[LEAVE] {current_role.upper()} is leaving - Calculating duration & attendance for ALL participants...")
                    
                    try:
                        # ===== STEP 1: Get ALL participants =====
                        cursor.execute("""
                            SELECT ID, User_ID, Role, Join_Times, Leave_Times, Is_Currently_Active, Total_Duration_Minutes, Total_Sessions
                            FROM tbl_Participants
                            WHERE Meeting_ID = %s
                        """, [meeting_id])
                        
                        all_participants = cursor.fetchall()
                        
                        # ===== STEP 2: Calculate duration for each participant =====
                        participant_durations = {}
                        
                        for p_row in all_participants:
                            p_id, p_user_id, p_role, p_join_times_json, p_leave_times_json, p_is_active, p_db_duration, p_db_sessions = p_row
                            
                            # Parse arrays
                            try:
                                p_join_times = json.loads(p_join_times_json) if isinstance(p_join_times_json, str) else p_join_times_json or []
                                p_leave_times = json.loads(p_leave_times_json) if isinstance(p_leave_times_json, str) else p_leave_times_json or []
                            except Exception:
                                p_join_times, p_leave_times = [], []
                            
                            # ===== DURATION CALCULATION LOGIC =====
                            # Case 1: Participant is INACTIVE (already left) - use actual leave_times from DB
                            # Case 2: Participant is ACTIVE (still in meeting) - use host's leave_time as TEMPORARY fallback
                            
                            if p_is_active:
                                # ACTIVE participant - use host's leave_time as temporary fallback (NOT stored in DB)
                                temp_leave_times = p_leave_times.copy()
                                if len(p_join_times) > len(temp_leave_times):
                                    temp_leave_times.append(leave_time_str)  # Host's leave time as fallback
                                    logging.info(f"[LEAVE] Participant {p_user_id} is ACTIVE - using host leave time {leave_time_str} as temporary fallback")
                                
                                p_duration = calculate_duration_from_arrays(p_join_times, temp_leave_times)
                                p_sessions = len(temp_leave_times)  # Temporary session count for calculation
                                
                                # DO NOT update Leave_Times in DB - only update Total_Duration_Minutes for attendance calc
                                # Leave_Times stays unchanged - no duplicate added
                            else:
                                # INACTIVE participant - use actual leave_times from DB
                                p_duration = calculate_duration_from_arrays(p_join_times, p_leave_times)
                                p_sessions = len(p_leave_times)
                            
                            # Ensure not null
                            if p_duration is None:
                                p_duration = 0.0
                            
                            participant_durations[p_user_id] = {
                                'id': p_id,
                                'role': p_role,
                                'duration': p_duration,
                                'sessions': p_sessions,
                                'is_active': p_is_active,
                                'db_sessions': p_db_sessions or 0  # Actual sessions in DB
                            }
                            
                            # Update Total_Duration_Minutes in DB for ALL participants (for attendance reference)
                            # For ACTIVE participants: This is temporary duration, will be recalculated when they actually leave
                            # For INACTIVE participants: This is final duration
                            cursor.execute("""
                                UPDATE tbl_Participants
                                SET Total_Duration_Minutes = %s
                                WHERE ID = %s
                            """, [p_duration, p_id])
                            
                            logging.info(f"[LEAVE] Participant {p_user_id} ({p_role}): Duration={p_duration:.2f} min, Sessions={p_sessions}, Active={p_is_active}")
                        
                        # ===== STEP 3: Get HOST duration for attendance calculation =====
                        host_duration = 0.0
                        for p_user_id, p_data in participant_durations.items():
                            if p_data['role'].lower() == 'host':
                                host_duration = p_data['duration']
                                break
                        
                        logging.info(f"[LEAVE] Host duration for attendance calc: {host_duration:.2f} min")
                        
                        # ===== STEP 3.5: Check if recurring meeting ONCE (BEFORE the loop) =====
                        cursor.execute("""
                            SELECT sm.is_recurring 
                            FROM tbl_ScheduledMeetings sm
                            WHERE sm.id = %s AND sm.is_recurring = 1
                        """, [meeting_id])
                        
                        is_recurring_row = cursor.fetchone()
                        is_recurring_meeting = bool(is_recurring_row and is_recurring_row[0])
                        logging.info(f"[LEAVE] Meeting {meeting_id} is_recurring: {is_recurring_meeting}")
                        
                        # ===== STEP 4: Calculate and update Attendance_Percentagebasedon_host for ALL =====
                        if host_duration > 0:
                            for p_user_id, p_data in participant_durations.items():
                                p_duration = p_data['duration']
                                p_role = p_data['role']
                                p_id = p_data['id']
                                
                                if p_role.lower() == 'host':
                                    attendance_percentage = 100.00
                                else:
                                    attendance_percentage = round((p_duration / host_duration) * 100, 2)
                                    # Cap at 100%
                                    attendance_percentage = min(attendance_percentage, 100.00)
                                
                                # Update attendance in database
                                # Update attendance in database - ONLY if occurrence is still open
                                cursor.execute("""
                                    UPDATE tbl_Participants
                                    SET Attendance_Percentagebasedon_host = %s
                                    WHERE ID = %s AND Is_Currently_Active = TRUE
                                """, [attendance_percentage, p_id])
                                
                                # ===== Calculate Participant_Attendance for non-host participants =====
                                if p_role.lower() != 'host':
                                    # Get AI-based attendance from tbl_Attendance_Sessions
                                    cursor.execute("""
                                        SELECT COALESCE(attendance_percentage, 0) 
                                        FROM tbl_Attendance_Sessions 
                                        WHERE meeting_id = %s AND user_id = %s
                                    """, [meeting_id, p_user_id])
                                    
                                    ai_attendance_row = cursor.fetchone()
                                    ai_based_attendance = float(ai_attendance_row[0]) if ai_attendance_row else 0.0
                                    ai_based_attendance = min(ai_based_attendance, 100.00)  # Cap at 100%
                                    
                                    # FORMULA: Participant_Attendance = (host_based + ai_based) / 2
                                    per_meeting_average = (attendance_percentage + ai_based_attendance) / 2
                                    per_meeting_average = min(per_meeting_average, 100.00)  # Cap at 100%
                                    
                                    # Update Participant_Attendance
                                    # Update Participant_Attendance - ONLY if occurrence is still open
                                    cursor.execute("""
                                        UPDATE tbl_Participants 
                                        SET Participant_Attendance = %s
                                        WHERE ID = %s AND Is_Currently_Active = TRUE
                                    """, [round(per_meeting_average, 2), p_id])                                    
                                    logging.info(f"[LEAVE] User {p_user_id}: Host-based={attendance_percentage}%, AI-based={ai_based_attendance}%, Participant_Attendance={per_meeting_average}%")
                                    
                                    # ===== Overall_Attendance: ONLY for Recurring Scheduled Meetings =====
                                    # NOTE: is_recurring_meeting was checked ONCE in STEP 3.5 (optimized)
                                    if is_recurring_meeting:
                                        # Calculate Overall_Attendance across all occurrences of THIS meeting only
                                        cursor.execute("""
                                            SELECT AVG(p.Participant_Attendance) as overall_avg
                                            FROM tbl_Participants p
                                            WHERE p.User_ID = %s 
                                            AND p.Meeting_ID = %s
                                            AND p.Participant_Attendance IS NOT NULL
                                            AND LOWER(p.Role) != 'host'
                                        """, [p_user_id, meeting_id])

                                        overall_result = cursor.fetchone()
                                        overall_attendance = float(overall_result[0]) if overall_result and overall_result[0] else per_meeting_average
                                        overall_attendance = min(overall_attendance, 100.00)  # Cap at 100%
                                        
                                        cursor.execute("""
                                            UPDATE tbl_Participants 
                                            SET Overall_Attendance = %s
                                            WHERE Meeting_ID = %s AND User_ID = %s
                                        """, [round(overall_attendance, 2), meeting_id, p_user_id])
                                        
                                        logging.info(f"[LEAVE] User {p_user_id}: Overall_Attendance={overall_attendance}% (Recurring Meeting)")
                                    else:
                                        # For InstantMeeting, CalendarMeeting, Non-Recurring ScheduledMeeting - set NULL
                                        cursor.execute("""
                                            UPDATE tbl_Participants 
                                            SET Overall_Attendance = NULL
                                            WHERE ID = %s
                                        """, [p_id])
                                        
                                        logging.info(f"[LEAVE] User {p_user_id}: Overall_Attendance=NULL (Not a recurring meeting)")

                                participants_attendance.append({
                                    'user_id': p_user_id,
                                    'role': p_role,
                                    'duration_minutes': round(p_duration, 2),
                                    'sessions': p_data['sessions'],
                                    'is_active': p_data['is_active'],
                                    'attendance_percentage': attendance_percentage
                                })
                                
                                logging.info(f"[LEAVE] Attendance for {p_user_id} ({p_role}): {attendance_percentage}% (Duration: {p_duration:.2f} / Host: {host_duration:.2f})")
                            
                            attendance_updated = True
                            logging.info(f"[LEAVE] ✅ Attendance updated for {len(participants_attendance)} participants")
                        else:
                            logging.warning(f"[LEAVE] ⚠️ Host duration is 0 - Cannot calculate attendance")
                        
                        # ===== STEP 5: Check if recording should auto-stop =====
                        cursor.execute("""
                            SELECT Is_Recording_Enabled 
                            FROM tbl_Meetings 
                            WHERE ID = %s
                        """, [meeting_id])
                        
                        recording_row = cursor.fetchone()
                        is_recording_enabled = recording_row[0] if recording_row else False
                        
                        if is_recording_enabled:
                            logging.info(f"[LEAVE] Recording is ACTIVE - checking host/co-host status...")
                            
                            # Check if ANY host or co-host is still active
                            cursor.execute("""
                                SELECT COUNT(*) 
                                FROM tbl_Participants 
                                WHERE Meeting_ID = %s 
                                AND LOWER(Role) IN ('host', 'co-host', 'cohost', 'co_host')
                                AND Is_Currently_Active = TRUE
                            """, [meeting_id])
                            
                            active_hosts_count = cursor.fetchone()[0]
                            
                            logging.info(f"[LEAVE] Active hosts/co-hosts remaining: {active_hosts_count}")
                            
                            if active_hosts_count == 0:
                                # BOTH host and co-host have left - auto-stop recording ONLY
                                # Meeting remains ACTIVE - they can rejoin
                                logging.info(f"[LEAVE] 🎬 NO host/co-host remaining - Auto-stopping recording...")
                                logging.info(f"[LEAVE] ℹ️ Meeting remains ACTIVE - host/co-host can rejoin using same link")
                                
                                try:
                                    from core.livekit_recording.recording_service import stream_recording_service
                                    
                                    recording_stop_result = stream_recording_service.stop_stream_recording(meeting_id)
                                    logging.info(f"[LEAVE] Stop recording result: {recording_stop_result}")
                                    
                                    if recording_stop_result:
                                        stop_status = recording_stop_result.get("status", "unknown")
                                        
                                        if stop_status in ["success", "partial_success"]:
                                            recording_auto_stopped = True
                                            logging.info(f"[LEAVE] ✅ Recording auto-stopped successfully!")
                                        elif "No active recording" in str(recording_stop_result.get("message", "")):
                                            logging.info(f"[LEAVE] ℹ️ No active recording found in service")
                                            recording_auto_stopped = True
                                        else:
                                            logging.warning(f"[LEAVE] ⚠️ Recording stop returned: {recording_stop_result}")
                                            recording_auto_stopped = True
                                    else:
                                        logging.warning(f"[LEAVE] ⚠️ stop_stream_recording returned None")
                                    
                                    # Update database to reflect recording stopped
                                    cursor.execute(
                                        "UPDATE tbl_Meetings SET Is_Recording_Enabled = 0 WHERE ID = %s",
                                        [meeting_id]
                                    )
                                    logging.info(f"[LEAVE] ✅ Database updated: Is_Recording_Enabled = 0")
                                    
                                except ImportError as import_err:
                                    logging.error(f"[LEAVE] ❌ Import error: {import_err}")
                                    try:
                                        cursor.execute("UPDATE tbl_Meetings SET Is_Recording_Enabled = 0 WHERE ID = %s", [meeting_id])
                                    except Exception:
                                        pass
                                        
                                except Exception as recording_err:
                                    logging.error(f"[LEAVE] ❌ Error auto-stopping recording: {recording_err}")
                                    import traceback
                                    logging.error(f"[LEAVE] Traceback: {traceback.format_exc()}")
                                    try:
                                        cursor.execute("UPDATE tbl_Meetings SET Is_Recording_Enabled = 0 WHERE ID = %s", [meeting_id])
                                    except Exception:
                                        pass
                            else:
                                logging.info(f"[LEAVE] ℹ️ {active_hosts_count} host/co-host still active - Recording continues")
                        else:
                            logging.info(f"[LEAVE] ℹ️ No active recording for meeting {meeting_id}")
                            
                    except Exception as calc_err:
                        logging.error(f"[LEAVE] Error calculating attendance: {calc_err}")
                        import traceback
                        logging.error(f"[LEAVE] Traceback: {traceback.format_exc()}")
                
                # Format duration for display
                hours = int(total_duration_minutes // 60)
                mins = int(total_duration_minutes % 60)
                duration_display = f"{hours}h {mins}m" if hours > 0 else f"{mins}m"
                
                # Build response
                response_data = {
                    'success': True,
                    'message': 'Participant leave recorded successfully',
                    'participant_id': participant_id,
                    'meeting_id': meeting_id,
                    'user_id': user_id,
                    'full_name': full_name or f'User {user_id}',
                    'role': role,
                    'leave_time': leave_time_str,
                    'total_sessions': completed_sessions,
                    'total_duration_minutes': round(total_duration_minutes, 2),
                    'duration_display': duration_display,
                    'status': 'left_successfully'
                }
                
                # Add host/co-host specific info
                if current_role in ['host', 'co-host', 'cohost', 'co_host']:
                    response_data['recording_info'] = {
                        'was_recording_active': bool(is_recording_enabled),
                        'auto_stopped': recording_auto_stopped,
                        'stop_result': recording_stop_result,
                        'message': "Recording stopped - both host and co-host left" if recording_auto_stopped else "Recording continues - host or co-host still present"
                    }
                    response_data['meeting_status'] = 'active'
                    response_data['can_rejoin'] = True
                    
                    # Add attendance calculation results
                    if attendance_updated:
                        response_data['attendance_calculated'] = True
                        response_data['participants_attendance'] = participants_attendance
                        response_data['message'] = 'Participant leave recorded - Attendance calculated for all participants'
                
                return JsonResponse(response_data, status=200)
                
        except Exception as db_error:
            logging.error(f"[LEAVE] Database error: {db_error}")
            import traceback
            logging.error(f"Traceback: {traceback.format_exc()}")
            return JsonResponse({
                'success': False,
                'error': 'Failed to record leave',
                'details': str(db_error)
            }, status=500)
            
    except json.JSONDecodeError as e:
        logging.error(f"[LEAVE] JSON decode error: {e}")
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON format'
        }, status=400)
    except Exception as e:
        logging.error(f"[LEAVE] Unexpected error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return JsonResponse({
            'success': False,
            'error': 'Internal server error',
            'details': str(e)
        }, status=500)
        
@require_http_methods(["GET"])
@csrf_exempt
def get_participant_complete_session_history(request, meeting_id, user_id):
    """
    NEW: Get complete session history with all duration calculations
    """
    try:
        session_data = get_user_all_sessions_data(meeting_id, user_id)
        
        # Get user name
        user_name = f"User_{user_id}"
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT full_name FROM tbl_Users WHERE ID = %s", [user_id])
                user_row = cursor.fetchone()
                if user_row and user_row[0]:
                    user_name = user_row[0]
        except:
            pass
        
        # Format durations
        def format_duration(seconds):
            if seconds >= 3600:
                hours = seconds // 3600
                minutes = (seconds % 3600) // 60
                secs = seconds % 60
                return f"{hours}h {minutes}m {secs}s"
            elif seconds >= 60:
                minutes = seconds // 60
                secs = seconds % 60
                return f"{minutes}m {secs}s"
            else:
                return f"{seconds}s"
        
        # Prepare detailed session list
        detailed_sessions = []
        for session in session_data['sessions']:
            detailed_sessions.append({
                'session_id': session['session_id'],
                'session_number': session['session_number'],
                'role': session['role'],
                'start_time': session['start'].isoformat() if session['start'] else None,
                'end_time': session['end'].isoformat() if session['end'] else None,
                'duration_seconds': session['duration'],
                'duration_formatted': format_duration(session['duration']),
                'is_active': session['is_active'],
                'status': 'Active' if session['is_active'] else 'Ended'
            })
        
        return JsonResponse({
            'success': True,
            'meeting_id': meeting_id,
            'user_id': user_id,
            'user_name': user_name,
            'summary': {
                'total_duration_seconds': session_data['total_duration'],
                'total_duration_formatted': format_duration(session_data['total_duration']),
                'total_duration_minutes': round(session_data['total_duration'] / 60, 1),
                'session_count': session_data['session_count'],
                'reconnection_count': session_data['reconnection_count'],
                'is_multi_session': session_data['session_count'] > 1
            },
            'sessions': detailed_sessions,
            'current_session': session_data['last_session'],
            'calculation_method': 'cumulative_across_all_sessions'
        })
        
    except Exception as e:
        logging.error(f"Error getting session history: {e}")
        return JsonResponse({
            'error': str(e)
        }, status=500)

# ============================================================================
# UPDATED: get_user_session_details - REPLACE ENTIRE FUNCTION
# This function already exists in your code but needs to use the new helper
# ============================================================================

@require_http_methods(["GET"])
@csrf_exempt
def get_user_session_details(request, meeting_id, user_id):
    """Get user session details with array-based tracking"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT ID, Full_Name, Role, Meeting_Type, Join_Times, Leave_Times,
                       Total_Duration_Minutes, Total_Sessions, Is_Currently_Active,
                       End_Meeting_Time
                FROM tbl_Participants 
                WHERE Meeting_ID = %s AND User_ID = %s
            """, [meeting_id, user_id])
            
            row = cursor.fetchone()
            
            if not row:
                return JsonResponse({
                    'success': False,
                    'error': 'User not found in meeting'
                }, status=404)
            
            (participant_id, full_name, role, meeting_type, join_times_json, leave_times_json,
             total_duration, total_sessions, is_active, end_time) = row
            
            # Parse arrays
            try:
                join_times = json.loads(join_times_json) if isinstance(join_times_json, str) else join_times_json
                leave_times = json.loads(leave_times_json) if isinstance(leave_times_json, str) else leave_times_json
            except:
                join_times = []
                leave_times = []
            
            # Format duration
            hours = int(total_duration // 60)
            mins = int(total_duration % 60)
            duration_display = f"{hours}h {mins}m" if hours > 0 else f"{mins}m"
            
            return JsonResponse({
                'success': True,
                'meeting_id': meeting_id,
                'user_id': user_id,
                'user_name': full_name or f'User {user_id}',
                'participant_id': participant_id,
                'role': role,
                'meeting_type': meeting_type,
                
                # Session arrays
                'join_times': join_times,
                'leave_times': leave_times,
                'total_sessions': total_sessions,
                
                # Duration
                'total_duration_minutes': round(float(total_duration), 2),
                'duration_display': duration_display,
                'total_hours': hours,
                'remaining_minutes': mins,
                
                # Status
                'is_currently_active': is_active,
                'end_meeting_time': end_time.isoformat() if end_time else None,
                'status': 'active' if is_active else 'left'
            })
            
    except Exception as e:
        logging.error(f"Error getting user session details: {e}")
        return JsonResponse({
            'error': str(e)
        }, status=500)

@require_http_methods(["POST"])
@csrf_exempt
def Leave_Meeting(request, participant_id):
    """FIXED: Traditional leave meeting endpoint with new schema"""
    try:
        leave_time = get_ist_now()
        leave_time_str = leave_time.strftime('%Y-%m-%d %H:%M:%S')
        
        with connection.cursor() as cursor:
            # Get participant info
            cursor.execute("""
                SELECT Meeting_ID, User_ID, Join_Times, Leave_Times, Is_Currently_Active
                FROM tbl_Participants
                WHERE ID = %s
            """, [participant_id])
            row = cursor.fetchone()

            if not row:
                logging.warning(f"[LEAVE] Participant ID {participant_id} not found")
                return JsonResponse({"Error": "Participant not found"}, status=404)

            meeting_id, user_id, join_times_json, leave_times_json, is_active = row
            
            if not is_active:
                logging.info(f"[LEAVE] Participant {participant_id} already left")
                return JsonResponse({"Error": "Participant has already left"}, status=400)

            # Parse arrays
            try:
                join_times = json.loads(join_times_json) if isinstance(join_times_json, str) else join_times_json
                leave_times = json.loads(leave_times_json) if isinstance(leave_times_json, str) else leave_times_json
            except:
                join_times = []
                leave_times = []
            
            # Append to leave times
            leave_times.append(leave_time_str)
            
            # Calculate total duration
            total_duration = calculate_duration_from_arrays(join_times, leave_times)
            
            # Update participant
            cursor.execute("""
                UPDATE tbl_Participants
                SET Leave_Times = %s,
                    Is_Currently_Active = FALSE,
                    Total_Duration_Minutes = %s,
                    Total_Sessions = %s
                WHERE ID = %s
            """, [json.dumps(leave_times), total_duration, len(leave_times), participant_id])

            # Format duration
            hours = int(total_duration // 60)
            mins = int(total_duration % 60)
            duration_display = f"{hours}h {mins}m" if hours > 0 else f"{mins}m"
            
            logging.info(f"[LEAVE] Participant {participant_id} left after {duration_display}")
            
    except Exception as e:
        logging.error(f"[LEAVE] DB error for participant {participant_id}: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=500)

    return JsonResponse({
        "Message": "Successfully left meeting",
        "Participant_ID": participant_id,
        "Leave_Time": leave_time_str,
        "Total_Duration_Minutes": round(total_duration, 2),
        "Duration_Display": duration_display,
        "Total_Sessions": len(leave_times)
    }, status=200)


@require_http_methods(["GET"])
@csrf_exempt
def list_participants_basic(request, meeting_id):
    """
    ✅ CORRECTED: List participants with proper error handling
    """
    try:
        # Validate meeting exists
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT ID, Meeting_Name 
                    FROM tbl_Meetings 
                    WHERE ID = %s
                """, [meeting_id])
                meeting_row = cursor.fetchone()
                
                if not meeting_row:
                    return JsonResponse({
                        'success': False,
                        'error': 'Meeting not found',
                        'meeting_id': meeting_id
                    }, status=404)
                
                meeting_name = meeting_row[1]
        except Exception as e:
            logging.error(f"Meeting validation error: {e}")
            return JsonResponse({
                'success': False,
                'error': f'Database error: {str(e)}'
            }, status=500)
        
        # Get all participants
        participants = []
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT ID, Meeting_ID, User_ID, Full_Name, Role, Meeting_Type,
                           Join_Times, Leave_Times, End_Meeting_Time,
                           Total_Duration_Minutes, Total_Sessions, Is_Currently_Active,
                           Participant_Attendance, Overall_Attendance
                    FROM tbl_Participants
                    WHERE Meeting_ID = %s
                    ORDER BY ID DESC
                """, [meeting_id])
                
                rows = cursor.fetchall()
                
                for row in rows:
                    try:
                        # Parse arrays safely
                        join_times = []
                        leave_times = []
                        
                        try:
                            join_times_raw = row[6]
                            if isinstance(join_times_raw, str):
                                join_times = json.loads(join_times_raw)
                            elif isinstance(join_times_raw, list):
                                join_times = join_times_raw
                        except Exception as e:
                            logging.error(f"Error parsing join_times: {e}")
                        
                        try:
                            leave_times_raw = row[7]
                            if isinstance(leave_times_raw, str):
                                leave_times = json.loads(leave_times_raw)
                            elif isinstance(leave_times_raw, list):
                                leave_times = leave_times_raw
                        except Exception as e:
                            logging.error(f"Error parsing leave_times: {e}")
                        
                        # Get first join and last leave
                        first_join = join_times[0] if join_times else None
                        last_leave = leave_times[-1] if leave_times else None
                        
                        # Format duration
                        total_duration = float(row[9]) if row[9] else 0.0
                        hours = int(total_duration // 60)
                        mins = int(total_duration % 60)
                        duration_display = f"{hours}h {mins}m" if hours > 0 else f"{mins}m"
                        
                        participant = {
                            'id': row[0],
                            'meeting_id': row[1],
                            'user_id': row[2],
                            'full_name': row[3] or f"User {row[2]}",
                            'role': row[4],
                            'meeting_type': row[5],
                            
                            # Time data
                            'first_join_time': first_join,
                            'last_leave_time': last_leave,
                            'end_meeting_time': row[8].isoformat() if row[8] else None,
                            
                            # Session data
                            'join_times': join_times,
                            'leave_times': leave_times,
                            'total_sessions': row[10] or 0,
                            
                            # Duration
                            'total_duration_minutes': round(total_duration, 2),
                            'duration_display': duration_display,
                            # Attendance fields (new columns)
                            'participant_attendance': float(row[12]) if row[12] is not None else 0.0,
                            'overall_attendance': float(row[13]) if row[13] is not None else 0.0,
                            # Status
                            'is_currently_active': bool(row[11]),
                            'status': 'active' if row[11] else 'left',
                            'is_online': bool(row[11]),
                        }
                        participants.append(participant)
                    except Exception as row_error:
                        logging.error(f"Error processing participant row: {row_error}")
                        continue
                        
        except Exception as e:
            logging.error(f"Error fetching participants: {e}")
            import traceback
            logging.error(traceback.format_exc())
            return JsonResponse({
                'success': False,
                'error': 'Failed to get participants',
                'details': str(e)
            }, status=500)
        
        # Summary stats
        total_participants = len(participants)
        active_participants = len([p for p in participants if p['status'] == 'active'])
        
        return JsonResponse({
            'success': True,
            'meeting_id': meeting_id,
            'meeting_name': meeting_name,
            'participants': participants,
            'summary': {
                'total_participants': total_participants,
                'active_participants': active_participants,
                'participants_left': total_participants - active_participants
            }
        })
            
    except Exception as e:
        logging.error(f"Error in list_participants_basic: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return JsonResponse({
            'success': False,
            'error': 'Internal server error',
            'details': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def Get_User_Meeting_History(request):
    """
    ✅ FINAL VERSION: Shows appropriate durations
    
    For HOST:
      - duration: Host's time (meeting duration)
      
    For PARTICIPANT:
      - duration: Meeting duration (host's time) 
      - participation_duration: Participant's own time
    """
    try:
        user_id = request.GET.get('user_id', '').strip()
        date_filter = request.GET.get('date_filter', 'all')
        
        if not user_id:
            return JsonResponse({"Error": "user_id is required"}, status=400)
        
        logging.info(f"Getting meeting history for user_id: {user_id}")
        
        meetings_dict = {}
        
        with connection.cursor() as cursor:
            # --- Meetings where user is host ---
            try:
                cursor.execute("""
                    SELECT ID, Meeting_Name, Meeting_Type, Meeting_Link, Status, 
                           Created_At, Started_At, Ended_At, Host_ID, 
                           Is_Recording_Enabled, Waiting_Room_Enabled,
                           livekit_room_name, LiveKit_Room_SID
                    FROM tbl_Meetings 
                    WHERE Host_ID = %s
                    ORDER BY Created_At DESC
                """, [user_id])
                
                for row in cursor.fetchall():
                    meeting_id = str(row[0])
                    meetings_dict[meeting_id] = {
                        'id': meeting_id,
                        'title': row[1] or "Untitled Meeting",
                        'meeting_type': row[2] or "InstantMeeting",
                        'meeting_link': row[3],
                        'status': row[4] or "unknown",
                        'created_at': row[5],
                        'started_at': row[6],
                        'ended_at': row[7],
                        'host_id': row[8],
                        'recording': bool(row[9]),
                        'waiting_room': bool(row[10]),
                        'livekit_room': row[11],
                        'livekit_room_sid': row[12],
                        'is_host': True,
                        'user_participated': True,
                        'user_role': 'host'
                    }
            except Exception as e:
                logging.warning(f"Error getting host meetings: {e}")
            
            # --- Meetings where user participated ---
            try:
                cursor.execute("""
                    SELECT DISTINCT p.Meeting_ID, m.Meeting_Name, m.Meeting_Type, 
                           m.Meeting_Link, m.Status, m.Created_At, m.Started_At, 
                           m.Ended_At, m.Host_ID, m.Is_Recording_Enabled, 
                           m.Waiting_Room_Enabled, m.livekit_room_name, m.LiveKit_Room_SID
                    FROM tbl_Participants p
                    JOIN tbl_Meetings m ON p.Meeting_ID = m.ID
                    WHERE p.User_ID = %s
                    ORDER BY m.Created_At DESC
                """, [user_id])
                
                for row in cursor.fetchall():
                    meeting_id = str(row[0])
                    if meeting_id not in meetings_dict:
                        meetings_dict[meeting_id] = {
                            'id': meeting_id,
                            'title': row[1] or "Untitled Meeting",
                            'meeting_type': row[2] or "InstantMeeting",
                            'meeting_link': row[3],
                            'status': row[4] or "unknown",
                            'created_at': row[5],
                            'started_at': row[6],
                            'ended_at': row[7],
                            'host_id': row[8],
                            'recording': bool(row[9]),
                            'waiting_room': bool(row[10]),
                            'livekit_room': row[11],
                            'livekit_room_sid': row[12],
                            'is_host': False,
                            'user_participated': True,
                            'user_role': 'participant'
                        }
            except Exception as e:
                logging.warning(f"Error getting participant meetings: {e}")
        
        # --- Process meetings ---
        final_meetings = []
        for meeting_id, meeting_data in meetings_dict.items():
            try:
                # Get host name
                try:
                    with connection.cursor() as cursor:
                        cursor.execute("SELECT full_name FROM tbl_Users WHERE ID = %s", [meeting_data['host_id']])
                        host_row = cursor.fetchone()
                        meeting_data['host'] = host_row[0] if host_row else "Unknown Host"
                except:
                    meeting_data['host'] = "Unknown Host"
                
                # ✅ Get BOTH durations
                # 1. Meeting duration (from host)
                meeting_duration_decimal = get_host_duration_for_meeting(meeting_id)
                meeting_duration_display = format_duration_mmss(meeting_duration_decimal)
                
                # 2. User's participation duration
                user_duration_decimal = get_user_duration_for_meeting(meeting_id, user_id)
                user_duration_display = format_duration_mmss(user_duration_decimal)
                
                logging.info(f"Meeting {meeting_id}: Host time={meeting_duration_decimal}, User {user_id} time={user_duration_decimal}")
                
                # Get additional participation details
                user_join_time = None
                user_leave_time = None
                participant_name = None
                
                try:
                    with connection.cursor() as cursor:
                        cursor.execute("""
                            SELECT Join_Times, Leave_Times, Full_Name, Role
                            FROM tbl_Participants 
                            WHERE Meeting_ID = %s AND User_ID = %s
                            ORDER BY ID DESC LIMIT 1
                        """, [meeting_id, user_id])
                        row = cursor.fetchone()
                        if row:
                            join_times = json.loads(row[0]) if isinstance(row[0], str) else row[0] or []
                            leave_times = json.loads(row[1]) if isinstance(row[1], str) else row[1] or []
                            participant_name = row[2]
                            user_role = row[3]
                            user_join_time = join_times[0] if join_times else None
                            user_leave_time = leave_times[-1] if leave_times else None
                            
                            if user_role:
                                meeting_data['user_role'] = user_role
                                meeting_data['is_host'] = (user_role == 'host')
                                
                except Exception as e:
                    logging.error(f"Error getting participation details: {e}")
                
                # Fallback if durations are 0
                if meeting_duration_decimal == 0 and meeting_data['started_at'] and meeting_data['ended_at']:
                    try:
                        start_dt = meeting_data['started_at']
                        end_dt = meeting_data['ended_at']
                        if isinstance(start_dt, str):
                            start_dt = datetime.fromisoformat(start_dt.replace('Z', '+00:00'))
                        if isinstance(end_dt, str):
                            end_dt = datetime.fromisoformat(end_dt.replace('Z', '+00:00'))
                        meeting_duration_decimal = (end_dt - start_dt).total_seconds() / 60.0
                        meeting_duration_display = format_duration_mmss(meeting_duration_decimal)
                    except Exception as e:
                        logging.error(f"Error calculating fallback duration: {e}")
                
                # Time category
                try:
                    meeting_date = meeting_data['started_at'] or meeting_data['created_at']
                    if isinstance(meeting_date, str):
                        meeting_date = datetime.fromisoformat(meeting_date.replace('Z', '+00:00'))
                    today = datetime.now().date()
                    meeting_date_only = meeting_date.date()
                    if meeting_date_only == today:
                        time_category = 'today'
                    elif meeting_date_only > today:
                        time_category = 'upcoming'
                    else:
                        time_category = 'past'
                except:
                    time_category = 'unknown'
                
                # Meeting type display
                mt = meeting_data['meeting_type'].lower()
                if 'schedule' in mt:
                    type_display = 'schedule'
                elif 'calendar' in mt:
                    type_display = 'calendar'
                else:
                    type_display = 'instant'
                
                # Status normalization
                status_raw = (meeting_data['status'] or 'unknown').lower()
                if status_raw in ['ended', 'completed']:
                    frontend_status = 'ended'
                elif time_category == 'upcoming':
                    frontend_status = 'scheduled'
                elif time_category == 'today' and status_raw == 'active':
                    frontend_status = 'active'
                else:
                    frontend_status = status_raw
                
                # Only show ended meetings
                if frontend_status != 'ended':
                    continue
                
                # Get participant count
                try:
                    with connection.cursor() as cursor:
                        cursor.execute("""
                            SELECT COUNT(DISTINCT User_ID) 
                            FROM tbl_Participants 
                            WHERE Meeting_ID = %s
                        """, [meeting_id])
                        participant_count = cursor.fetchone()[0] or 1
                except:
                    participant_count = 1
                
                # ✅ Build meeting object with BOTH durations
                meeting_obj = {
                    "id": meeting_data['id'],
                    "title": meeting_data['title'],
                    "type": type_display,
                    "status": frontend_status,
                    "meeting_link": meeting_data['meeting_link'],
                    "date": meeting_data['started_at'] or meeting_data['created_at'],
                    "created_at": meeting_data['created_at'],
                    "started_at": meeting_data['started_at'],
                    "ended_at": meeting_data['ended_at'],
                    "time_category": time_category,
                    
                    # ✅ MEETING DURATION (host's time = total meeting length)
                    "meeting_duration": meeting_duration_display,  # "08:07"
                    "meeting_duration_decimal": round(meeting_duration_decimal, 2),  # 8.12
                    
                    # ✅ USER'S PARTICIPATION DURATION
                    "participation_duration": user_duration_display,  # "04:15" for participant, "08:07" for host
                    "participation_duration_decimal": round(user_duration_decimal, 2),  # 4.25 for participant, 8.12 for host
                    
                    # ✅ MAIN DURATION FIELD (for backward compatibility)
                    # For HOST: Show their time (same as meeting duration)
                    # For PARTICIPANT: Can show either meeting or participation duration
                    "duration": user_duration_display if meeting_data['is_host'] else meeting_duration_display,
                    "duration_decimal_minutes": round(user_duration_decimal if meeting_data['is_host'] else meeting_duration_decimal, 2),
                    
                    "participants": participant_count,
                    "host": meeting_data['host'],
                    "host_email": None,
                    "is_host": meeting_data['is_host'],
                    "user_role": meeting_data['user_role'],
                    "user_participated": meeting_data['user_participated'],
                    "user_join_time": user_join_time,
                    "user_leave_time": user_leave_time,
                    "recording": meeting_data['recording'],
                    "waiting_room": meeting_data['waiting_room'],
                    "starred": False,
                    "livekit_room": meeting_data['livekit_room'],
                    "livekit_room_sid": meeting_data['livekit_room_sid'],
                    "livekit_enabled": bool(meeting_data['livekit_room']),
                    "description": None,
                    "location": None,
                    "meeting_type": meeting_data['meeting_type'],
                    "involvement_type": "host" if meeting_data['is_host'] else "participant"
                }
                
                final_meetings.append(meeting_obj)
            
            except Exception as e:
                logging.warning(f"Error processing meeting {meeting_id}: {e}")
                import traceback
                logging.error(traceback.format_exc())
                continue
        
        # Sort by created date
        try:
            final_meetings.sort(key=lambda x: x.get('created_at') or datetime.min, reverse=True)
        except:
            pass
        
        # Summary stats
        total_meetings = len(final_meetings)
        hosted_meetings = sum(1 for m in final_meetings if m.get('is_host'))
        participated_meetings = sum(1 for m in final_meetings if m.get('user_participated'))
        ended_meetings = total_meetings
        
        total_meeting_time = 0.0
        total_participation_time = 0.0
        
        try:
            if participated_meetings > 0:
                total_meeting_time = sum(m['meeting_duration_decimal'] for m in final_meetings)
                total_participation_time = sum(m['participation_duration_decimal'] for m in final_meetings)
        except:
            pass
        
        logging.info(f"✅ Returning {len(final_meetings)} meetings with both durations")
        
        return JsonResponse({
            "success": True,
            "meetings": final_meetings,
            "summary": {
                "user_id": user_id,
                "total_meetings": total_meetings,
                "hosted_meetings": hosted_meetings,
                "participated_meetings": participated_meetings,
                "status_breakdown": {
                    "ended": ended_meetings
                },
                "analytics": {
                    "total_meeting_time_minutes": round(total_meeting_time, 2),
                    "total_meeting_time_formatted": format_duration_mmss(total_meeting_time),
                    "total_participation_time_minutes": round(total_participation_time, 2),
                    "total_participation_time_formatted": format_duration_mmss(total_participation_time),
                    "participation_rate": round((participated_meetings / max(total_meetings, 1)) * 100, 2)
                }
            },
            "filter_applied": date_filter,
            "duration_format": "MM:SS"
        }, status=200)
    
    except Exception as e:
        logging.error(f"CRITICAL ERROR in Get_User_Meeting_History: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return JsonResponse({
            "Error": "Failed to fetch meeting history",
            "Details": str(e)
        }, status=500)


@require_http_methods(["GET"])
@csrf_exempt
def Get_User_Meetings_By_Date(request):
    """
    Get user's meetings for a specific date range
    CORRECTED to match actual database schema
    """
    try:
        user_id = request.GET.get('user_id', '').strip()
        start_date = request.GET.get('start_date', '')
        end_date = request.GET.get('end_date', '')
        
        if not user_id:
            return JsonResponse({"Error": "user_id is required"}, status=BAD_REQUEST_STATUS)
        
        # Default to today if no dates provided
        if not start_date:
            start_date = datetime.now().strftime('%Y-%m-%d')
        if not end_date:
            end_date = start_date
            
        logging.info(f"Getting meetings for user {user_id} from {start_date} to {end_date}")
        
        with connection.cursor() as cursor:
            # CORRECTED: Query based on actual database schema
            query = """
            SELECT DISTINCT
                m.ID,
                m.Meeting_Name,
                m.Meeting_Type,
                m.Status,
                m.Started_At,
                m.Ended_At,
                m.Host_ID,
                m.Created_At,
                m.Meeting_Link,
                m.Is_Recording_Enabled,
                m.Waiting_Room_Enabled,
                m.livekit_room_name,
                m.LiveKit_Room_SID,
                
                -- Host information
                COALESCE(host_user.full_name, 'Unknown Host') as host_name,
                host_user.email as host_email,
                
                -- Duration from appropriate table
                CASE 
                    WHEN m.Meeting_Type = 'ScheduleMeeting' THEN COALESCE(sm.duration_minutes, 60)
                    WHEN m.Meeting_Type = 'CalendarMeeting' THEN COALESCE(cm.duration, 60)
                    WHEN m.Started_At IS NOT NULL AND m.Ended_At IS NOT NULL THEN 
                        TIMESTAMPDIFF(MINUTE, m.Started_At, m.Ended_At)
                    ELSE 60
                END as duration_minutes,
                
                -- User's participation info
                p.Role as user_role,
                p.Join_Time,
                p.Leave_Time,
                p.End_Meeting_Time,
                p.Duration as user_participation_duration,
                p.Full_Name as participant_name,
                
                -- Meeting details
                CASE 
                    WHEN m.Meeting_Type = 'ScheduleMeeting' THEN sm.description
                    WHEN m.Meeting_Type = 'CalendarMeeting' THEN cm.location
                    ELSE NULL
                END as meeting_description,
                
                CASE 
                    WHEN m.Meeting_Type = 'ScheduleMeeting' THEN sm.location
                    WHEN m.Meeting_Type = 'CalendarMeeting' THEN cm.location
                    ELSE NULL
                END as meeting_location
                
            FROM tbl_Meetings m
            
            -- Join for host information
            LEFT JOIN tbl_Users host_user ON m.Host_ID = host_user.ID
            
            -- Join for scheduled meeting details
            LEFT JOIN tbl_ScheduledMeetings sm ON m.ID = sm.id AND m.Meeting_Type = 'ScheduleMeeting'
            
            -- Join for calendar meeting details
            LEFT JOIN tbl_CalendarMeetings cm ON m.ID = cm.ID AND m.Meeting_Type = 'CalendarMeeting'
            
            -- Join for user's participation details
            LEFT JOIN tbl_Participants p ON m.ID = p.Meeting_ID AND p.User_ID = %s
            
            WHERE (
                -- User is the host of the meeting
                m.Host_ID = %s 
                OR 
                -- User actually participated in the meeting
                p.User_ID IS NOT NULL
            )
            AND DATE(COALESCE(m.Started_At, m.Created_At)) BETWEEN %s AND %s
            
            ORDER BY COALESCE(m.Started_At, m.Created_At) ASC
            """
            
            # CORRECTED: 4 parameters to match the query
            params = [user_id, user_id, start_date, end_date]
            
            try:
                cursor.execute(query, params)
                rows = cursor.fetchall()
                logging.info(f"Date range query returned {len(rows)} meetings")
            except Exception as db_error:
                logging.error(f"SQL execution error in Get_User_Meetings_By_Date: {db_error}")
                return JsonResponse({"Error": f"Database query failed: {str(db_error)}"}, status=SERVER_ERROR_STATUS)
            
            meetings = []
            for i, row in enumerate(rows):
                try:
                    # CORRECTED: Index positions based on actual SELECT columns
                    meeting_id = str(row[0])
                    meeting_name = row[1]
                    meeting_type = row[2]
                    status = row[3]
                    started_at = row[4]
                    ended_at = row[5]
                    host_id = row[6]
                    created_at = row[7]
                    meeting_link = row[8]
                    is_recording_enabled = row[9]
                    waiting_room_enabled = row[10]
                    livekit_room_name = row[11]
                    livekit_room_sid = row[12]
                    host_name = row[13]
                    host_email = row[14]
                    duration_minutes = row[15]
                    user_role = row[16]
                    user_join_time = row[17]
                    user_leave_time = row[18]
                    user_end_meeting_time = row[19]
                    user_participation_duration = row[20]
                    participant_name = row[23]
                    meeting_description = row[24]
                    meeting_location = row[25]
                    
                    is_host = str(host_id) == str(user_id)
                    user_participated = user_join_time is not None
                    
                    # Format duration
                    duration_mins = duration_minutes or 60
                    duration_str = f"{duration_mins}m"
                    if duration_mins >= 60:
                        hours = duration_mins // 60
                        minutes = duration_mins % 60
                        duration_str = f"{hours}h {minutes}m" if minutes > 0 else f"{hours}h"
                    
                    # Format meeting type
                    type_display = (meeting_type or 'instant').lower().replace('meeting', '')
                    
                    meeting = {
                        # Basic info
                        "id": meeting_id,
                        "title": meeting_name or "Meeting",
                        "type": type_display,
                        "status": status or "unknown",
                        "meeting_link": meeting_link,
                        
                        # Timing
                        "date": started_at or created_at,
                        "started_at": started_at,
                        "ended_at": ended_at,
                        "created_at": created_at,
                        
                        # Duration
                        "duration": duration_str,
                        "duration_minutes": duration_mins,
                        
                        # Host info
                        "host_name": host_name or "Unknown Host",
                        "host_email": host_email,
                        "is_host": is_host,
                        
                        # User participation
                        "user_role": "host" if is_host else (user_role or "participant"),
                        "user_participated": user_participated,
                        "user_join_time": user_join_time,
                        "user_leave_time": user_leave_time,
                        "user_end_meeting_time": user_end_meeting_time,
                        "user_participation_duration": user_participation_duration,
                        
                        # Features
                        "recording": bool(is_recording_enabled),
                        "waiting_room": bool(waiting_room_enabled),
                        
                        # LiveKit
                        "livekit_room": livekit_room_name,
                        "livekit_room_sid": livekit_room_sid,
                        
                        # Additional details
                        "description": meeting_description,
                        "location": meeting_location,
                        "meeting_type": meeting_type  # Original type
                    }
                    meetings.append(meeting)
                    
                except Exception as row_error:
                    logging.warning(f"Error processing row {i} in date range query: {row_error}")
                    continue
            
            return JsonResponse({
                "success": True,
                "meetings": meetings,
                "date_range": {
                    "start_date": start_date,
                    "end_date": end_date
                },
                "count": len(meetings),
                "user_id": user_id
            }, status=SUCCESS_STATUS)
            
    except Exception as e:
        logging.error(f"Error in Get_User_Meetings_By_Date: {e}")
        import traceback
        logging.error(f"Full traceback: {traceback.format_exc()}")
        return JsonResponse({
            "Error": str(e),
            "debug_info": {
                "function": "Get_User_Meetings_By_Date",
                "user_id": user_id,
                "date_range": f"{start_date} to {end_date}"
            }
        }, status=SERVER_ERROR_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def Get_User_Today_Meetings(request):
    """
    Get user's meetings for today specifically
    CORRECTED version with direct implementation
    """
    try:
        user_id = request.GET.get('user_id', '').strip()
        
        if not user_id:
            return JsonResponse({"Error": "user_id is required"}, status=BAD_REQUEST_STATUS)
        
        # Get today's date in the correct format
        today = datetime.now().strftime('%Y-%m-%d')
        
        logging.info(f"Getting today's meetings for user {user_id} on {today}")
        
        with connection.cursor() as cursor:
            # CORRECTED: Direct query for today's meetings
            query = """
            SELECT DISTINCT
                m.ID,
                m.Meeting_Name,
                m.Meeting_Type,
                m.Status,
                m.Started_At,
                m.Ended_At,
                m.Host_ID,
                m.Created_At,
                m.Meeting_Link,
                
                -- Host information
                COALESCE(host_user.full_name, 'Unknown Host') as host_name,
                
                -- Duration
                CASE 
                    WHEN m.Meeting_Type = 'ScheduleMeeting' THEN COALESCE(sm.duration_minutes, 60)
                    WHEN m.Meeting_Type = 'CalendarMeeting' THEN COALESCE(cm.duration, 60)
                    WHEN m.Started_At IS NOT NULL AND m.Ended_At IS NOT NULL THEN 
                        TIMESTAMPDIFF(MINUTE, m.Started_At, m.Ended_At)
                    ELSE 60
                END as duration_minutes,
                
                -- User participation
                p.Role as user_role,
                p.Join_Time,
                p.Leave_Time,
                
                -- Time category for today
                CASE 
                    WHEN m.Started_At IS NULL THEN 'scheduled'
                    WHEN TIME(m.Started_At) <= CURTIME() AND (m.Ended_At IS NULL OR TIME(m.Ended_At) >= CURTIME()) THEN 'active'
                    WHEN TIME(m.Started_At) > CURTIME() THEN 'upcoming'
                    ELSE 'ended'
                END as meeting_status_today
                
            FROM tbl_Meetings m
            
            -- Join for host information
            LEFT JOIN tbl_Users host_user ON m.Host_ID = host_user.ID
            
            -- Join for meeting type details
            LEFT JOIN tbl_ScheduledMeetings sm ON m.ID = sm.id AND m.Meeting_Type = 'ScheduleMeeting'
            LEFT JOIN tbl_CalendarMeetings cm ON m.ID = cm.ID AND m.Meeting_Type = 'CalendarMeeting'
            
            -- Join for user's participation
            LEFT JOIN tbl_Participants p ON m.ID = p.Meeting_ID AND p.User_ID = %s
            
            WHERE (
                m.Host_ID = %s OR p.User_ID IS NOT NULL
            )
            AND DATE(COALESCE(m.Started_At, m.Created_At)) = %s
            
            ORDER BY 
                COALESCE(m.Started_At, m.Created_At) ASC,
                m.Created_At ASC
            """
            
            params = [user_id, user_id, today]
            
            try:
                cursor.execute(query, params)
                rows = cursor.fetchall()
                logging.info(f"Today's meetings query returned {len(rows)} meetings")
            except Exception as db_error:
                logging.error(f"SQL execution error in Get_User_Today_Meetings: {db_error}")
                return JsonResponse({"Error": f"Database query failed: {str(db_error)}"}, status=SERVER_ERROR_STATUS)
            
            meetings = []
            for i, row in enumerate(rows):
                try:
                    meeting_id = str(row[0])
                    meeting_name = row[1]
                    meeting_type = row[2]
                    status = row[3]
                    started_at = row[4]
                    ended_at = row[5]
                    host_id = row[6]
                    created_at = row[7]
                    meeting_link = row[8]
                    host_name = row[9]
                    duration_minutes = row[10]
                    user_role = row[11]
                    user_join_time = row[12]
                    user_leave_time = row[13]
                    meeting_status_today = row[16]
                    
                    is_host = str(host_id) == str(user_id)
                    user_participated = user_join_time is not None
                    
                    # Format duration
                    duration_mins = duration_minutes or 60
                    duration_str = f"{duration_mins}m"
                    if duration_mins >= 60:
                        hours = duration_mins // 60
                        minutes = duration_mins % 60
                        duration_str = f"{hours}h {minutes}m" if minutes > 0 else f"{hours}h"
                    
                    # Format start time for today's view
                    start_time_str = "Not scheduled"
                    if started_at:
                        if hasattr(started_at, 'strftime'):
                            start_time_str = started_at.strftime('%H:%M')
                        else:
                            try:
                                dt = datetime.strptime(str(started_at), '%Y-%m-%d %H:%M:%S')
                                start_time_str = dt.strftime('%H:%M')
                            except:
                                start_time_str = str(started_at)
                    
                    meeting = {
                        "id": meeting_id,
                        "title": meeting_name or "Meeting",
                        "type": (meeting_type or 'instant').lower().replace('meeting', ''),
                        "status": meeting_status_today or status or "unknown",
                        "meeting_link": meeting_link,
                        
                        # Today-specific timing
                        "start_time": start_time_str,
                        "date": today,
                        "started_at": started_at,
                        "ended_at": ended_at,
                        
                        "duration": duration_str,
                        "host_name": host_name or "Unknown Host",
                        "is_host": is_host,
                        
                        # User participation
                        "user_role": "host" if is_host else (user_role or "participant"),
                        "user_participated": user_participated,
                        "user_join_time": user_join_time,
                        "user_leave_time": user_leave_time,
                        
                        # Quick status for today's view
                        "is_upcoming": meeting_status_today == 'upcoming',
                        "is_active": meeting_status_today == 'active',
                        "is_ended": meeting_status_today == 'ended'
                    }
                    meetings.append(meeting)
                    
                except Exception as row_error:
                    logging.warning(f"Error processing row {i} in today's meetings: {row_error}")
                    continue
            
            # Categorize meetings for today's view
            upcoming = [m for m in meetings if m['is_upcoming']]
            active = [m for m in meetings if m['is_active']]
            ended = [m for m in meetings if m['is_ended']]
            
            return JsonResponse({
                "success": True,
                "date": today,
                "meetings": meetings,
                "categorized": {
                    "upcoming": upcoming,
                    "active": active,
                    "ended": ended
                },
                "summary": {
                    "total": len(meetings),
                    "upcoming_count": len(upcoming),
                    "active_count": len(active),
                    "ended_count": len(ended)
                },
                "user_id": user_id
            }, status=SUCCESS_STATUS)
        
    except Exception as e:
        logging.error(f"Error in Get_User_Today_Meetings: {e}")
        import traceback
        logging.error(f"Full traceback: {traceback.format_exc()}")
        return JsonResponse({
            "Error": str(e),
            "debug_info": {
                "function": "Get_User_Today_Meetings",
                "user_id": user_id,
                "date": today if 'today' in locals() else 'undefined'
            }
        }, status=SERVER_ERROR_STATUS)

@require_http_methods(["GET"])
@csrf_exempt
def Get_Live_Participants_Enhanced_No_Status(request, meeting_id):
    """
    ✅ FIXED: Get live participants with proper names from tbl_Users
    Returns participant data with correct schema (Join_Times, Leave_Times arrays)
    ✅ NEW: Added role-based filtering support
    """
    try:
         # ✅ FIX: Import LIVEKIT_ENABLED for use in response
        LIVEKIT_ENABLED = is_livekit_enabled()
        # ✅ Get requesting user's ID for role-based filtering (optional parameter)
        requesting_user_id = request.GET.get('user_id')
        if requesting_user_id:
            requesting_user_id = int(requesting_user_id)
        
        db_participants = []
        
        # ===== STEP 1: Get database participants with CORRECTED SCHEMA =====
        try:
            with connection.cursor() as cursor:
                # ✅ FIXED: Using correct column names from new schema INCLUDING Attendance_Percentagebasedon_host
                cursor.execute("""
                    SELECT 
                        p.ID,                                    -- 0
                        p.Meeting_ID,                            -- 1
                        p.User_ID,                               -- 2
                        p.Full_Name,                             -- 3
                        p.Join_Times,                            -- 4
                        p.Leave_Times,                           -- 5
                        p.End_Meeting_Time,                      -- 6
                        p.Role,                                  -- 7
                        p.Meeting_Type,                          -- 8
                        p.Total_Duration_Minutes,                -- 9
                        p.Is_Currently_Active,                   -- 10
                        p.Attendance_Percentagebasedon_host,     -- 11
                        p.Participant_Attendance,                -- 12
                        p.Overall_Attendance,                    -- 13
                        u.email,                                 -- 14
                        u.full_name as user_table_name           -- 15
                    FROM tbl_Participants p
                    INNER JOIN (
                        SELECT User_ID, MAX(occurrence_number) as max_occ
                        FROM tbl_Participants
                        WHERE Meeting_ID = %s
                        GROUP BY User_ID
                    ) latest ON p.User_ID = latest.User_ID AND p.occurrence_number = latest.max_occ
                    LEFT JOIN tbl_Users u ON p.User_ID = u.ID
                    WHERE p.Meeting_ID = %s
                    ORDER BY p.ID ASC
                """, [meeting_id, meeting_id])
                rows = cursor.fetchall()
                
                for row in rows:
                    # Parse data with CORRECTED INDICES
                    participant_id = row[0]
                    meeting_id_val = row[1]
                    user_id = row[2]
                    participant_name = row[3]  # Name from tbl_Participants
                    join_times_json = row[4]
                    leave_times_json = row[5]
                    end_meeting_time = row[6]
                    role = row[7]
                    meeting_type = row[8]
                    total_duration = row[9]
                    # CORRECT:
                    is_active = row[10]                    # Fixed index
                    attendance_basedon_host = row[11]      # Get the existing column
                    participant_attendance = row[12]        # ✅ new
                    overall_attendance = row[13]            # ✅ new
                    email = row[14]                        # Fixed index
                    user_table_name = row[15]              # Fixed index                    # ✅ FIXED: was row[14] - Name from tbl_Users
                    
                    # ✅ FIX: ALWAYS use tbl_Users.full_name (it is NOT NULL in schema)
                    # tbl_Participants.Full_Name is unreliable due to sync/join race condition
                    if user_table_name and user_table_name.strip():
                        display_name = user_table_name.strip()
                    elif participant_name and participant_name.strip() and not participant_name.startswith('User ') and not participant_name.startswith('User_'):
                        display_name = participant_name.strip()
                    else:
                        # Last resort fallback — query tbl_Users directly
                        try:
                            with connection.cursor() as name_cursor:
                                name_cursor.execute("SELECT full_name FROM tbl_Users WHERE ID = %s", [user_id])
                                name_result = name_cursor.fetchone()
                                if name_result and name_result[0] and name_result[0].strip():
                                    display_name = name_result[0].strip()
                                else:
                                    display_name = f"User {user_id}"
                        except Exception:
                            display_name = f"User {user_id}"
                    
                    # ✅ Add "(You)" label for requesting user
                    if requesting_user_id and user_id == requesting_user_id:
                        if not display_name.endswith('(You)'):
                            display_name = f"{display_name} (You)"
                    
                    # Parse JSON arrays safely
                    join_times = []
                    leave_times = []
                    
                    try:
                        if join_times_json:
                            if isinstance(join_times_json, str):
                                join_times = json.loads(join_times_json)
                            elif isinstance(join_times_json, list):
                                join_times = join_times_json
                    except Exception as e:
                        logging.error(f"Error parsing join_times: {e}")
                    
                    try:
                        if leave_times_json:
                            if isinstance(leave_times_json, str):
                                leave_times = json.loads(leave_times_json)
                            elif isinstance(leave_times_json, list):
                                leave_times = leave_times_json
                    except Exception as e:
                        logging.error(f"Error parsing leave_times: {e}")
                    
                    # Get first join time and last leave time
                    first_join = join_times[0] if join_times else None
                    last_leave = leave_times[-1] if leave_times else None
                    
                    # Build participant object
                    participant = {
                        'ID': participant_id,
                        'Meeting_ID': meeting_id_val,
                        'User_ID': user_id,
                        'Full_Name': display_name,  # ✅ Correct name with "(You)" label
                        'email': email,
                        
                        # Time data with arrays
                        'Join_Time': first_join,  # For backwards compatibility
                        'Leave_Time': last_leave,  # For backwards compatibility
                        'Join_Times': join_times,
                        'Leave_Times': leave_times,
                        'End_Meeting_Time': end_meeting_time.isoformat() if end_meeting_time else None,
                        
                        # Role and type
                        'Role': role,
                        'Meeting_Type': meeting_type,
                        
                        # Duration and metrics
                        'Duration': float(total_duration) if total_duration else 0.0,
                        'Total_Duration_Minutes': float(total_duration) if total_duration else 0.0,
                        'Attendance_Percentagebasedon_host': float(attendance_basedon_host) if attendance_basedon_host else 0.0,
                        'Participant_Attendance': float(participant_attendance) if participant_attendance is not None else 0.0,
                        'Overall_Attendance': float(overall_attendance) if overall_attendance is not None else 0.0,

                        # Status - based on Is_Currently_Active and Leave_Time
                        'Is_Currently_Active': bool(is_active),
                        'Status': 'checking' if is_active else 'offline',
                        
                        # LiveKit status (will be updated below)
                        'LiveKit_Connected': False,
                        'Has_Stream': False,
                        'Debug_Info': {}
                    }
                    
                    db_participants.append(participant)
                    
                # logging.info(f"✅ Retrieved {len(db_participants)} participants from database")
                
        except Exception as e:
            logging.error(f"❌ Database error: {e}")
            import traceback
            logging.error(traceback.format_exc())
            return JsonResponse({
                "success": False,
                "error": "Database error retrieving participants",
                "details": str(e)
            }, status=500)
        
        # ===== STEP 2: Get LiveKit participants =====
        livekit_participants = []
        livekit_user_mapping = {}
        room_name = f"meeting_{meeting_id}"
        
        if is_livekit_enabled() and get_livekit_service():
            try:
                # Get room name from meeting
                with connection.cursor() as cursor:
                    cursor.execute("""
                        SELECT LiveKit_Room_Name FROM tbl_Meetings WHERE ID = %s
                    """, [meeting_id])
                    row = cursor.fetchone()
                    if row and row[0]:
                        room_name = row[0]
                
                livekit_participants = get_livekit_service().list_participants(room_name)
                # logging.info(f"📡 Retrieved {len(livekit_participants)} LiveKit participants")
                
                # Parse LiveKit participants with multiple extraction methods
                for lk_participant in livekit_participants:
                    identity = lk_participant.get('identity', '')
                    name = lk_participant.get('name', '')
                    metadata = lk_participant.get('metadata', {})
                    
                    user_id = None
                    parsing_method = "none"
                    
                    # Method 1: From metadata (most reliable)
                    if isinstance(metadata, dict) and metadata.get('user_id'):
                        user_id = str(metadata['user_id'])
                        parsing_method = "metadata_dict"
                    elif isinstance(metadata, str) and metadata.strip():
                        try:
                            meta_dict = json.loads(metadata)
                            if meta_dict.get('user_id'):
                                user_id = str(meta_dict['user_id'])
                                parsing_method = "metadata_json"
                        except:
                            pass
                    
                    # Method 2: From identity pattern "user_{id}_{timestamp}"
                    if not user_id and 'user_' in identity.lower():
                        try:
                            parts = identity.split('_')
                            if len(parts) >= 2 and parts[1].isdigit():
                                user_id = parts[1]
                                parsing_method = "identity_pattern"
                        except:
                            pass
                    
                    # Method 3: Direct numeric identity
                    if not user_id and identity.isdigit():
                        user_id = identity
                        parsing_method = "identity_numeric"
                    
                    # Method 4: Regex extraction
                    if not user_id:
                        try:
                            import re
                            numbers = re.findall(r'\d+', identity)
                            if numbers:
                                user_id = numbers[0]
                                parsing_method = "regex_identity"
                        except:
                            pass
                    
                    if user_id:
                        livekit_user_mapping[str(user_id)] = {
                            **lk_participant,
                            'has_video_track': any(track.get('type') == 'video' for track in lk_participant.get('tracks', [])),
                            'has_audio_track': any(track.get('type') == 'audio' for track in lk_participant.get('tracks', [])),
                            'total_tracks': len(lk_participant.get('tracks', [])),
                            'parsed_user_id': user_id,
                            'parsing_method': parsing_method
                        }
                        # logging.info(f"✅ Mapped LiveKit: {identity} -> User {user_id}")
                
            except Exception as e:
                logging.warning(f"⚠️ LiveKit error: {e}")
        
        # ===== STEP 3: Update status with LiveKit data =====
        for db_participant in db_participants:
            user_id = str(db_participant['User_ID'])
            
            # Check if user is in LiveKit
            if user_id in livekit_user_mapping:
                lk_data = livekit_user_mapping[user_id]
                
                # User is live in LiveKit
                db_participant['LiveKit_Connected'] = True
                db_participant['Has_Stream'] = lk_data.get('total_tracks', 0) > 0
                db_participant['Status'] = 'live'
                db_participant['LiveKit_Data'] = lk_data
                db_participant['Debug_Info'] = {
                    'parsing_method': lk_data.get('parsing_method'),
                    'tracks_count': lk_data.get('total_tracks', 0)
                }
                
            else:
                # User not in LiveKit
                db_participant['LiveKit_Connected'] = False
                db_participant['Has_Stream'] = False
                
                # Determine status based on Is_Currently_Active and Leave_Time
                if db_participant['Is_Currently_Active']:
                    # User is marked active but not in LiveKit - give grace period
                    join_time = db_participant.get('Join_Time')
                    if join_time:
                        try:
                            join_dt = datetime.fromisoformat(join_time.replace('Z', '+00:00'))
                            now_dt = datetime.now(join_dt.tzinfo if join_dt.tzinfo else None)
                            time_since_join = (now_dt - join_dt).total_seconds()
                            
                            if time_since_join < 120:  # 2 minute grace period
                                db_participant['Status'] = 'connecting'
                            else:
                                db_participant['Status'] = 'connection_lost'
                        except:
                            db_participant['Status'] = 'connecting'
                    else:
                        db_participant['Status'] = 'connecting'
                else:
                    # User has left (Is_Currently_Active = False)
                    db_participant['Status'] = 'offline'
        
        # ===== STEP 4: Apply role-based filtering (if user_id provided) =====
        filtered_participants = db_participants
        requesting_user_role = 'participant'
        
        if requesting_user_id:
            # Find requesting user's role
            requesting_user_participant = next(
                (p for p in db_participants if p['User_ID'] == requesting_user_id), 
                None
            )
            
            if requesting_user_participant:
                requesting_user_role = requesting_user_participant.get('Role', 'participant')
                
                # Apply role-based filtering
                if requesting_user_role != 'host':
                    # PARTICIPANT VIEW: Show only host + themselves
                    filtered_participants = [
                        p for p in db_participants 
                        if p['Role'] == 'host' or p['User_ID'] == requesting_user_id
                    ]
                    logging.info(f"🔑 PARTICIPANT VIEW: User {requesting_user_id} ({requesting_user_role}) sees {len(filtered_participants)} of {len(db_participants)} participants")
                else:
                    # HOST VIEW: Show all participants
                    logging.info(f"🔑 HOST VIEW: User {requesting_user_id} sees all {len(filtered_participants)} participants")
        
        # ===== STEP 5: Build response =====
        total_participants = len(db_participants)
        filtered_count = len(filtered_participants)
        currently_live = len([p for p in filtered_participants if p['Status'] == 'live'])
        currently_connecting = len([p for p in filtered_participants if p['Status'] == 'connecting'])
        
        response_data = {
            'success': True,
            'meeting_id': meeting_id,
            'summary': {
                'total_participants': total_participants,
                'filtered_participants': filtered_count,
                'currently_live': currently_live,
                'currently_connecting': currently_connecting,
                'livekit_participants': len(livekit_participants),
                'database_participants': total_participants
            },
            'participants': filtered_participants,  # ✅ Return filtered participants
            'livekit_raw': livekit_participants,
            'livekit_enabled': LIVEKIT_ENABLED,
            'schema_version': 'array_based_v2',
            'filter_info': {
                'requesting_user_id': requesting_user_id,
                'requesting_user_role': requesting_user_role,
                'role_based_filtering': requesting_user_id is not None
            }
        }
        
#         logging.info(f"""
# ✅ Get_Live_Participants_Enhanced_No_Status SUCCESS:
# - Total participants: {total_participants}
# - Filtered participants: {filtered_count}
# - Currently live: {currently_live}
# - Connecting: {currently_connecting}
# - Requesting user: {requesting_user_id} ({requesting_user_role})
#         """)
        
        return JsonResponse(response_data, status=200)
        
    except Exception as e:
        logging.error(f"❌ Critical error in Get_Live_Participants_Enhanced_No_Status: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return JsonResponse({
            "success": False,
            "error": "Failed to get live participants",
            "details": str(e)
        }, status=500)





@require_http_methods(["POST"])
@csrf_exempt
def Sync_LiveKit_Participants_Fixed(request, meeting_id):
    """
    ✅ FULLY CORRECTED V3: Sync LiveKit participants with phantom join prevention
    
    KEY FIXES:
    1. ✓ Always provide session_start_time in INSERT (fixes error 1364)
    2. ✓ Always provide occurrence_number in INSERT
    3. ✓ Use simple session_start_time = %s comparison (fixes ValueError)
    4. ✓ Proper error handling and logging
    5. ✓ Handle all edge cases with grace periods
    6. ✓ CHECK Ended_At BEFORE ALLOWING REJOIN - PREVENTS PHANTOM JOINS!
    7. ✅ NEW FIX: If status='ended' but LiveKit has participants, reset to 'active'
       instead of refusing to sync. Prevents deadlock from bad Ended_At timestamps.
    """
    
    # First check - LiveKit availability
    if not is_livekit_enabled() or not get_livekit_service():
        return JsonResponse({
            "success": True,  # Don't fail if LiveKit disabled
            "message": "LiveKit service not available - database-only mode",
            "sync_results": {
                "added": 0, 
                "removed": 0, 
                "rejoined": 0, 
                "already_synced": 0,
                "rejected_phantom_joins": 0
            },
            "livekit_enabled": False
        }, status=200)
    
    try:
        logging.info(f"[SYNC-FIXED] Starting sync for meeting {meeting_id}")
        
        current_time = get_ist_now()
        current_time_str = current_time.strftime('%Y-%m-%d %H:%M:%S')
        current_date_str = current_time.date().strftime('%Y-%m-%d')  # ✓ FOR session_start_time
        
        # ===== STEP 1: Get meeting info with validation =====
        room_name = None
        host_id = None
        started_at = None
        meeting_status = None
        ended_at_time = None  # ✅ Get Ended_At
        
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT LiveKit_Room_Name, Host_ID, Started_At, Status, Ended_At
                    FROM tbl_Meetings 
                    WHERE ID = %s
                """, [meeting_id])
                row = cursor.fetchone()
                
                if not row:
                    # logging.error(f"[SYNC-FIXED] Meeting {meeting_id} not found in database")
                    return JsonResponse({
                        "success": False,
                        "error": "Meeting not found"
                    }, status=404)
                
                room_name, host_id, started_at, meeting_status, ended_at_time = row
                
                if not room_name:
                    room_name = f"meeting_{meeting_id}"
                    logging.info(f"[SYNC-FIXED] Using default room name: {room_name}")
                
                # =============================================================
                # ✅ NEW FIX: If status='ended', check LiveKit FIRST before
                # refusing to sync. If LiveKit has active participants, the
                # meeting is NOT actually ended — fix the status.
                #
                # This prevents the deadlock where:
                # 1. Ended_At gets a bad timestamp (UTC vs IST)
                # 2. Status becomes 'ended' even though people are connected
                # 3. Sync refuses to work ("Meeting already ended")
                # 4. Nobody can fix the status
                #
                # Now sync will self-heal by resetting status to 'active'.
                # =============================================================
                if meeting_status == 'ended':
                    try:
                        lk_check_participants = get_livekit_service().list_participants(room_name) if get_livekit_service() else []
                    except Exception:
                        lk_check_participants = []
                    
                    if len(lk_check_participants) > 0:
                        # ✅ LiveKit has participants — status is WRONG, fix it!
                        # logging.warning(
                        #     f"⚠️ [SYNC-FIXED] Meeting {meeting_id} status='ended' but "
                        #     f"{len(lk_check_participants)} LiveKit participants still connected!"
                        # )
                        # logging.warning(f"⚠️ [SYNC-FIXED] Resetting status to 'active' and clearing Ended_At")
                        
                        try:
                            cursor.execute("""
                                UPDATE tbl_Meetings 
                                SET Status = 'active', Ended_At = NULL
                                WHERE ID = %s
                            """, [meeting_id])
                            meeting_status = 'active'
                            ended_at_time = None
                            # logging.info(f"✅ [SYNC-FIXED] Meeting {meeting_id} status reset to 'active' — sync will proceed normally")
                        except Exception as fix_err:
                            logging.error(f"❌ [SYNC-FIXED] Failed to reset meeting status: {fix_err}")
                    else:
                        # No LiveKit participants — meeting really is ended
                        # logging.info(f"[SYNC-FIXED] Meeting {meeting_id} ended and no LiveKit participants - skipping sync")
                        return JsonResponse({
                            "success": True,
                            "message": "Meeting already ended - no sync performed",
                            "sync_results": {
                                "added": 0, 
                                "removed": 0, 
                                "rejoined": 0, 
                                "already_synced": 0,
                                "rejected_phantom_joins": 0
                            }
                        }, status=200)
                
                logging.info(f"[SYNC-FIXED] Meeting status: {meeting_status}, Ended_At: {ended_at_time}")
                    
        except Exception as e:
            logging.error(f"[SYNC-FIXED] Database error getting meeting: {e}")
            import traceback
            logging.error(f"Traceback: {traceback.format_exc()}")
            return JsonResponse({
                "success": False,
                "error": "Database error retrieving meeting",
                "details": str(e)
            }, status=500)
        
        # ===== STEP 2: Get LiveKit participants =====
        livekit_participants = []
        livekit_user_mapping = {}
        
        try:
            livekit_participants = get_livekit_service().list_participants(room_name)
            logging.info(f"[SYNC-FIXED] Retrieved {len(livekit_participants)} LiveKit participants")
            
            # Parse LiveKit participants with multiple extraction methods
            for lk_participant in livekit_participants:
                try:
                    identity = lk_participant.get('identity', '')
                    metadata = lk_participant.get('metadata', {})
                    name = lk_participant.get('name', '')
                    user_id = None
                    parsing_method = "none"
                    
                    # Method 1: From metadata (most reliable)
                    if isinstance(metadata, dict) and metadata.get('user_id'):
                        user_id = str(metadata['user_id'])
                        parsing_method = "metadata_dict"
                    elif isinstance(metadata, str) and metadata.strip():
                        try:
                            meta_dict = json.loads(metadata)
                            if meta_dict.get('user_id'):
                                user_id = str(meta_dict['user_id'])
                                parsing_method = "metadata_json"
                        except json.JSONDecodeError:
                            pass
                    
                    # Method 2: From identity pattern "user_{id}_{timestamp}"
                    if not user_id and 'user_' in identity.lower():
                        try:
                            parts = identity.split('_')
                            if len(parts) >= 2:
                                potential_id = parts[1]
                                if potential_id.isdigit():
                                    user_id = potential_id
                                    parsing_method = "identity_pattern"
                        except Exception:
                            pass
                    
                    # Method 3: Direct numeric identity
                    if not user_id and identity.isdigit():
                        user_id = identity
                        parsing_method = "identity_numeric"
                    
                    # Method 4: Extract from name field
                    if not user_id and name:
                        if name.isdigit():
                            user_id = name
                            parsing_method = "name_numeric"
                        elif 'user_' in name.lower():
                            try:
                                import re
                                match = re.search(r'user_(\d+)', name.lower())
                                if match:
                                    user_id = match.group(1)
                                    parsing_method = "name_pattern"
                            except Exception:
                                pass
                    
                    # Method 5: Regex extraction - find any number
                    if not user_id:
                        try:
                            import re
                            # Try identity first
                            numbers = re.findall(r'\d+', identity)
                            if numbers:
                                user_id = numbers[0]
                                parsing_method = "regex_identity"
                            else:
                                # Try name
                                numbers = re.findall(r'\d+', name)
                                if numbers:
                                    user_id = numbers[0]
                                    parsing_method = "regex_name"
                        except Exception:
                            pass
                    
                    if user_id:
                        livekit_user_mapping[str(user_id)] = {
                            **lk_participant,
                            'parsed_user_id': user_id,
                            'original_identity': identity,
                            'original_name': name,
                            'parsing_method': parsing_method
                        }
                        logging.info(f"[SYNC-FIXED] Mapped: {identity} -> User {user_id} (method: {parsing_method})")
                    else:
                        logging.warning(f"[SYNC-FIXED] Could not extract user_id from identity='{identity}', name='{name}'")
                        
                except Exception as e:
                    logging.error(f"[SYNC-FIXED] Error processing LiveKit participant: {e}")
                    continue
            
            logging.info(f"[SYNC-FIXED] Successfully mapped {len(livekit_user_mapping)} participants")
            
        except Exception as e:
            logging.error(f"[SYNC-FIXED] LiveKit API error: {e}")
            import traceback
            logging.error(f"Traceback: {traceback.format_exc()}")
            # Don't fail completely - continue with database operations
            logging.warning("[SYNC-FIXED] Continuing without LiveKit data")
        
        # ===== STEP 3: Get database participants =====
        active_db_users = {}
        inactive_db_users = {}
        
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT User_ID, Is_Currently_Active, Join_Times, Leave_Times, ID, End_Meeting_Time, occurrence_number
                    FROM tbl_Participants 
                    WHERE Meeting_ID = %s
                    ORDER BY occurrence_number DESC
                """, [meeting_id])
                db_participants = cursor.fetchall()

                for row in db_participants:
                    user_id, is_active, join_times_json, leave_times_json, participant_id, end_meeting_time, occurrence_number = row
                    user_key = str(user_id)
                    
                    # Parse join_times safely - INSIDE THE LOOP
                    join_times = []
                    try:
                        if join_times_json is None:
                            join_times = []
                        elif isinstance(join_times_json, str):
                            join_times = json.loads(join_times_json) if join_times_json.strip() else []
                        elif isinstance(join_times_json, list):
                            join_times = join_times_json
                        else:
                            join_times = []
                    except Exception as e:
                        logging.error(f"[SYNC-FIXED] Error parsing join_times for user {user_id}: {e}")
                        join_times = []
                    
                    participant_info = {
                        'id': participant_id,
                        'join_times': join_times,
                        'end_meeting_time': end_meeting_time,
                        'occurrence_number': occurrence_number
                    }

                    if is_active:
                        if user_key not in active_db_users:
                            active_db_users[user_key] = participant_info
                    else:
                        if user_key not in inactive_db_users:
                            inactive_db_users[user_key] = participant_info
                
                logging.info(f"[SYNC-FIXED] Database state: {len(active_db_users)} active, {len(inactive_db_users)} inactive")
                    
        except Exception as e:
            logging.error(f"[SYNC-FIXED] Database query error: {e}")
            import traceback
            logging.error(f"Traceback: {traceback.format_exc()}")
            return JsonResponse({
                "success": False,
                "error": "Database error retrieving participants",
                "details": str(e)
            }, status=500)      
              
        # ===== STEP 4: Sync logic =====
        sync_results = {
            'added': 0, 
            'removed': 0, 
            'rejoined': 0, 
            'already_synced': 0,
            'rejected_phantom_joins': 0,  # ✅ Track phantom join rejections
            'errors': []
        }
        
        # Mark users as left if not in LiveKit (with grace period)
        for user_id, participant_info in list(active_db_users.items()):
            if user_id not in livekit_user_mapping:
                join_times = participant_info.get('join_times', [])
                
                if join_times and len(join_times) > 0:
                    try:
                        last_join_str = join_times[-1]
                        last_join_dt = datetime.strptime(last_join_str, '%Y-%m-%d %H:%M:%S')
                        
                        # Make timezone aware
                        if last_join_dt.tzinfo is None:
                            last_join_dt = IST_TIMEZONE.localize(last_join_dt)
                        
                        time_since_join = (current_time - last_join_dt).total_seconds()
                        
                        # 15 second grace period before marking as left
                        if time_since_join > 15:
                            try:
                                with connection.cursor() as cursor:
                                    # Get current leave times
                                    cursor.execute("""
                                        SELECT Leave_Times FROM tbl_Participants WHERE ID = %s
                                    """, [participant_info['id']])
                                    leave_times_row = cursor.fetchone()
                                    
                                    if leave_times_row:
                                        leave_times = []
                                        try:
                                            if leave_times_row[0] is None:
                                                leave_times = []
                                            elif isinstance(leave_times_row[0], str):
                                                leave_times = json.loads(leave_times_row[0]) if leave_times_row[0].strip() else []
                                            elif isinstance(leave_times_row[0], list):
                                                leave_times = leave_times_row[0]
                                        except Exception as e:
                                            logging.error(f"[SYNC-FIXED] Error parsing leave_times: {e}")
                                            leave_times = []
                                        
                                        # Append current time to leave times
                                        leave_times.append(current_time_str)
                                        
                                        # Calculate total duration
                                        total_duration = calculate_duration_from_arrays(join_times, leave_times)
                                        
                                        # Update participant
                                        cursor.execute("""
                                            UPDATE tbl_Participants 
                                            SET Leave_Times = %s,
                                                Is_Currently_Active = FALSE,
                                                Total_Duration_Minutes = %s,
                                                Total_Sessions = %s
                                            WHERE ID = %s
                                        """, [
                                            json.dumps(leave_times), 
                                            total_duration, 
                                            len(leave_times), 
                                            participant_info['id']
                                        ])
                                        
                                        if cursor.rowcount > 0:
                                            sync_results['removed'] += 1
                                            logging.info(f"[SYNC-FIXED] User {user_id} marked as left (grace period expired)")
                                            del active_db_users[user_id]
                                            
                            except Exception as e:
                                logging.error(f"[SYNC-FIXED] Error updating user {user_id}: {e}")
                                sync_results['errors'].append(f"Failed to update user {user_id}: {str(e)}")
                                
                    except Exception as e:
                        logging.error(f"[SYNC-FIXED] Error calculating grace period for user {user_id}: {e}")
        
        # Process LiveKit participants
        for user_id in livekit_user_mapping.keys():
            try:
                if user_id in active_db_users:
                    # User already active - no action needed
                    sync_results['already_synced'] += 1
                    
                elif user_id in inactive_db_users:
                    # ✅ CHECK End_Meeting_Time BEFORE ALLOWING REJOIN!
                    
                    participant_id = inactive_db_users[user_id]['id']
                    end_meeting_time = inactive_db_users[user_id].get('end_meeting_time')
                    should_rejoin = True
                    
                    # ✅ Check if this occurrence has already ended
                    if end_meeting_time is not None:
                        logging.warning(f"🔴 [SYNC-FIXED] Rejecting rejoin for user {user_id} - occurrence ended at {end_meeting_time}")
                        sync_results['rejected_phantom_joins'] += 1
                        sync_results['errors'].append(f"User {user_id}: Phantom join rejected (occurrence ended at {end_meeting_time})")
                        should_rejoin = False
                    
                    # Check if meeting has passed Ended_At (fallback for non-recurring meetings)
                    elif ended_at_time:
                        try:
                            ist_timezone = IST_TIMEZONE
                            
                            # Parse Ended_At timestamp
                            if isinstance(ended_at_time, str):
                                ended_at_dt = datetime.strptime(ended_at_time, '%Y-%m-%d %H:%M:%S')
                                ended_at_dt = ist_timezone.localize(ended_at_dt)
                            else:
                                ended_at_dt = ended_at_time.astimezone(ist_timezone) if ended_at_time.tzinfo else ist_timezone.localize(ended_at_time)
                            
                            # Check if current time is AFTER meeting ended
                            if current_time > ended_at_dt:
                                # ❌ REJECT REJOIN - Phantom join attempt!
                                logging.warning(f"🔴 [SYNC-FIXED] Rejecting rejoin for user {user_id} - meeting already ended at {ended_at_dt.strftime('%Y-%m-%d %H:%M:%S')}")
                                logging.warning(f"🔴 [SYNC-FIXED] Current time: {current_time_str}, Meeting ended: {ended_at_dt.strftime('%Y-%m-%d %H:%M:%S')}")
                                
                                sync_results['rejected_phantom_joins'] += 1
                                sync_results['errors'].append(f"User {user_id}: Phantom join rejected (meeting ended)")
                                should_rejoin = False
                            else:
                                logging.info(f"[SYNC-FIXED] User {user_id} rejoin allowed - meeting still active (ends at {ended_at_dt.strftime('%Y-%m-%d %H:%M:%S')})")
                        
                        except Exception as e:
                            logging.error(f"[SYNC-FIXED] Error checking Ended_At for user {user_id}: {e}")
                            # On error, allow rejoin (fail open)
                            should_rejoin = True
                    else:
                        logging.info(f"[SYNC-FIXED] User {user_id} rejoin allowed - no end time set")

                    # ✅ ONLY REJOIN IF ALLOWED
                    if should_rejoin:
                        try:
                            with connection.cursor() as cursor:
                                cursor.execute("""
                                    SELECT Join_Times FROM tbl_Participants WHERE ID = %s
                                """, [participant_id])
                                row = cursor.fetchone()
                                
                                if row:
                                    join_times = []
                                    try:
                                        if row[0] is None:
                                            join_times = []
                                        elif isinstance(row[0], str):
                                            join_times = json.loads(row[0]) if row[0].strip() else []
                                        elif isinstance(row[0], list):
                                            join_times = row[0]
                                    except Exception as e:
                                        logging.error(f"[SYNC-FIXED] Error parsing join_times: {e}")
                                        join_times = []
                                    
                                    # Append new join time
                                    join_times.append(current_time_str)
                                    
                                    # ✅ FIX: Also update Full_Name on rejoin to prevent stale fallback names
                                    rejoin_user_name = f"User {user_id}"
                                    try:
                                        cursor.execute("SELECT full_name FROM tbl_Users WHERE ID = %s", [int(user_id)])
                                        name_row = cursor.fetchone()
                                        if name_row and name_row[0]:
                                            rejoin_user_name = name_row[0].strip()
                                    except Exception as name_err:
                                        logging.warning(f"[SYNC-FIXED] Could not get name for rejoin user {user_id}: {name_err}")
                                    
                                    cursor.execute("""
                                        UPDATE tbl_Participants 
                                        SET Join_Times = %s, Is_Currently_Active = TRUE, Full_Name = %s
                                        WHERE ID = %s
                                    """, [json.dumps(join_times), rejoin_user_name, participant_id])
                                    
                                    sync_results['rejoined'] += 1
                                    logging.info(f"[SYNC-FIXED] User {user_id} rejoined (session #{len(join_times)}) with name '{rejoin_user_name}'")
                        except Exception as e:
                            logging.error(f"[SYNC-FIXED] Error rejoining user {user_id}: {e}")
                            sync_results['errors'].append(f"Failed to rejoin user {user_id}: {str(e)}")
                        
                else:
                    # ===== NEW USER - CREATE RECORD =====
                    # For new users in sync, always create occurrence #1
                    # (Don't use helper function - that's for JOIN requests only)
                    occurrence_number = 1
                    is_new_occurrence = True
                    
                    logging.info(f"[SYNC-FIXED] New user {user_id} detected - creating occurrence #1")
                    
                    role = 'host' if str(user_id) == str(host_id) else 'participant'
                    user_name = f"User {user_id}"
                    
                    # Get actual user name from tbl_Users
                    try:
                        with connection.cursor() as cursor:
                            cursor.execute("SELECT full_name FROM tbl_Users WHERE ID = %s", [user_id])
                            user_row = cursor.fetchone()
                            if user_row and user_row[0]:
                                user_name = user_row[0].strip()
                    except Exception as e:
                        logging.warning(f"[SYNC-FIXED] Could not get user name: {e}")
                    
                    try:
                        with connection.cursor() as cursor:
                            # ✓ FIX: Include session_start_time and occurrence_number
                            cursor.execute("""
                                INSERT INTO tbl_Participants 
                                (Meeting_ID, User_ID, Full_Name, Role, Meeting_Type,
                                 Join_Times, Leave_Times, Total_Duration_Minutes, Total_Sessions,
                                 Is_Currently_Active, Attendance_Percentagebasedon_host,
                                 session_start_time, occurrence_number)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """, [
                                meeting_id,                         # 1. Meeting_ID
                                user_id,                            # 2. User_ID
                                user_name,                          # 3. Full_Name
                                role,                               # 4. Role
                                meeting_type,                       # 5. Meeting_Type
                                json.dumps([current_time_str]),     # 6. Join_Times
                                json.dumps([]),                     # 7. Leave_Times
                                0,                                  # 8. Total_Duration_Minutes
                                0,                                  # 9. Total_Sessions
                                True,                               # 10. Is_Currently_Active
                                0.00,                               # 11. Attendance_Percentagebasedon_host
                                current_date_str,                   # 12. session_start_time ✓ FIXED
                                occurrence_number                   # 13. occurrence_number
                            ])
                            
                            sync_results['added'] += 1
                            logging.info(f"[SYNC-FIXED] Added new user {user_id} ({user_name}) - occurrence #{occurrence_number}")

                    except Exception as e:
                        logging.error(f"[SYNC-FIXED] Error adding user {user_id}: {e}")
                        import traceback
                        logging.error(f"Traceback: {traceback.format_exc()}")
                        sync_results['errors'].append(f"Failed to add user {user_id}: {str(e)}")
                        
            except Exception as e:
                logging.error(f"[SYNC-FIXED] Error processing user {user_id}: {e}")
                sync_results['errors'].append(f"Error processing user {user_id}: {str(e)}")
                continue
        
        # Log final results
        logging.info(f"""
[SYNC-FIXED] Sync complete for meeting {meeting_id}:
- Added: {sync_results['added']}
- Removed: {sync_results['removed']}
- Rejoined: {sync_results['rejoined']}
- Already synced: {sync_results['already_synced']}
- Rejected phantom joins: {sync_results['rejected_phantom_joins']}
- Errors: {len(sync_results['errors'])}
        """)
        
        return JsonResponse({
            'success': True,
            'message': f"Sync completed - {sync_results['rejected_phantom_joins']} phantom joins prevented" if sync_results['rejected_phantom_joins'] > 0 else 'Sync completed successfully',
            'meeting_id': meeting_id,
            'sync_results': sync_results,
            'livekit_participants_count': len(livekit_participants),
            'mapped_participants': len(livekit_user_mapping),
            'database_active_count': len(active_db_users),
            'livekit_enabled': True
        }, status=200)
        
    except Exception as e:
        logging.error(f"[SYNC-FIXED] Critical error in sync: {e}")
        import traceback
        logging.error(f"Traceback: {traceback.format_exc()}")
        return JsonResponse({
            "success": False,
            "error": "Sync failed with critical error",
            "details": str(e),
            "meeting_id": meeting_id
        }, status=500)


def calculate_overlap_duration(host_join_times, host_leave_times, participant_join_times, participant_leave_times):
    """
    Calculate participant's duration ONLY during host's active time periods.
    
    Example:
    - Host active: 10:00-10:15, 10:20-10:30 (25 min total)
    - Participant in meeting: 10:02-10:30 (28 min total)
    - Overlap: 10:02-10:15 (13 min) + 10:20-10:30 (10 min) = 23 min
    - This 23 min is stored in Total_Duration_Minutes
    - Attendance = 23/25 × 100 = 92%
    
    Returns: overlap_duration_minutes (float)
    """
    from datetime import datetime
    
    def parse_datetime(dt_str):
        """Parse datetime string to datetime object"""
        if isinstance(dt_str, datetime):
            return dt_str
        try:
            return datetime.strptime(dt_str, '%Y-%m-%d %H:%M:%S')
        except:
            return None
    
    def get_time_ranges(join_times, leave_times):
        """Convert join/leave arrays to list of (start, end) tuples"""
        ranges = []
        for i in range(min(len(join_times), len(leave_times))):
            start = parse_datetime(join_times[i])
            end = parse_datetime(leave_times[i])
            if start and end and end > start:
                ranges.append((start, end))
        return ranges
    
    def calculate_overlap(range1_start, range1_end, range2_start, range2_end):
        """Calculate overlap between two time ranges in minutes"""
        overlap_start = max(range1_start, range2_start)
        overlap_end = min(range1_end, range2_end)
        
        if overlap_end > overlap_start:
            return (overlap_end - overlap_start).total_seconds() / 60.0
        return 0.0
    
    # Get time ranges for host and participant
    host_ranges = get_time_ranges(host_join_times, host_leave_times)
    participant_ranges = get_time_ranges(participant_join_times, participant_leave_times)
    
    # Calculate total overlap
    total_overlap_minutes = 0.0
    
    for host_start, host_end in host_ranges:
        for part_start, part_end in participant_ranges:
            overlap = calculate_overlap(host_start, host_end, part_start, part_end)
            total_overlap_minutes += overlap
    
    return total_overlap_minutes

@require_http_methods(["POST"])
@csrf_exempt
def end_meeting(request, meeting_id):
    """
    ✅ FIXED: Recurring Meeting Rejoin Logic
    
    REJOIN RULES:
    - Recurring meeting + current_time < recurrence_end_date → status='active', can rejoin
    - Recurring meeting + current_time >= recurrence_end_date → status='ended', NO rejoin
    - Non-recurring meeting → status='ended', NO rejoin
    
    ALL OTHER FUNCTIONALITY PRESERVED:
    - Auto-stop recording
    - Overlap duration calculation
    - Host-based attendance
    - AI-based attendance
    - Per-meeting and overall attendance
    """
    try:
        data = json.loads(request.body or "{}")
        reason = data.get("reason", "host_ended")
        force_end = data.get("force_end", False)
        ended_by_user_id = data.get("ended_by_user_id")

        end_time = get_ist_now()
        end_time_str = end_time.strftime("%Y-%m-%d %H:%M:%S")

        # ===== Validate meeting ===== 
        # FIXED: Fetching recurrence_end_date specifically for recurring logic
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT m.Host_ID, m.Meeting_Name, m.Status, m.Started_At, m.ID,
                        m.Is_Recording_Enabled, m.Meeting_Type,
                        sm.is_recurring, sm.recurrence_end_date
                    FROM tbl_Meetings m
                    LEFT JOIN tbl_ScheduledMeetings sm ON m.ID = sm.id
                    WHERE m.ID = %s
                """, [meeting_id])
                meeting_row = cursor.fetchone()

                if not meeting_row:
                    return JsonResponse({"error": "Meeting not found"}, status=404)

                host_id, meeting_name, current_status, started_at, meeting_id, is_recording_enabled, meeting_type, is_recurring, recurrence_end_date = meeting_row
                
                if current_status == "ended":
                    return JsonResponse({
                        "success": True,
                        "message": "Meeting already ended",
                        "meeting_id": meeting_id
                    })

                if not force_end and ended_by_user_id and str(ended_by_user_id) != str(host_id):
                    return JsonResponse(
                        {"error": "Only the host can end the meeting"}, status=403
                    )
        except Exception as e:
            logging.error(f"[end_meeting] Meeting validation error: {e}")
            return JsonResponse({"error": "Database error", "details": str(e)}, status=500)

        # ===== NEW: Get LATEST occurrence_number that has active participants =====
        occurrence_number = 1  # Default
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT MAX(occurrence_number) 
                    FROM tbl_Participants
                    WHERE Meeting_ID = %s AND Is_Currently_Active = TRUE
                """, [meeting_id])
                occ_result = cursor.fetchone()
                if occ_result and occ_result[0]:
                    occurrence_number = occ_result[0]
                    logging.info(f"[end_meeting] Detected occurrence_number: {occurrence_number}")
                else:
                    # No active participants, get the highest occurrence_number from any participant
                    cursor.execute("""
                        SELECT MAX(occurrence_number) 
                        FROM tbl_Participants
                        WHERE Meeting_ID = %s
                    """, [meeting_id])
                    occ_result = cursor.fetchone()
                    if occ_result and occ_result[0]:
                        occurrence_number = occ_result[0]
                        logging.info(f"[end_meeting] No active participants, using latest occurrence: {occurrence_number}")
        except Exception as e:
            logging.warning(f"[end_meeting] Could not detect occurrence_number: {e}")

        # ===== AUTO-STOP RECORDING IF ACTIVE =====
        recording_auto_stopped = False
        recording_stop_result = None
        
        if is_recording_enabled:
            logging.info(f"[end_meeting] 🎬 Recording is ACTIVE for meeting {meeting_id} - Auto-stopping...")
            
            try:
                from core.livekit_recording.recording_service import stream_recording_service
                
                recording_stop_result = stream_recording_service.stop_stream_recording(meeting_id)
                logging.info(f"[end_meeting] Stop recording result: {recording_stop_result}")
                
                if recording_stop_result:
                    stop_status = recording_stop_result.get("status", "unknown")
                    
                    if stop_status in ["success", "partial_success"]:
                        recording_auto_stopped = True
                        logging.info(f"[end_meeting] ✅ Recording auto-stopped successfully!")
                    elif "No active recording" in str(recording_stop_result.get("message", "")):
                        logging.info(f"[end_meeting] ℹ️ No active recording found in service")
                        recording_auto_stopped = True
                    else:
                        logging.warning(f"[end_meeting] ⚠️ Recording stop returned: {recording_stop_result}")
                        recording_auto_stopped = True
                else:
                    logging.warning(f"[end_meeting] ⚠️ stop_stream_recording returned None")
                    
                with connection.cursor() as cursor:
                    cursor.execute(
                        "UPDATE tbl_Meetings SET Is_Recording_Enabled = 0 WHERE ID = %s",
                        [meeting_id]
                    )
                logging.info(f"[end_meeting] ✅ Database updated: Is_Recording_Enabled = 0")
                    
            except ImportError as import_err:
                logging.error(f"[end_meeting] ❌ Import error: {import_err}")
                try:
                    with connection.cursor() as cursor:
                        cursor.execute("UPDATE tbl_Meetings SET Is_Recording_Enabled = 0 WHERE ID = %s", [meeting_id])
                except Exception:
                    pass
                    
            except Exception as recording_err:
                logging.error(f"[end_meeting] ❌ Error auto-stopping recording: {recording_err}")
                import traceback
                logging.error(f"[end_meeting] Traceback: {traceback.format_exc()}")
                try:
                    with connection.cursor() as cursor:
                        cursor.execute("UPDATE tbl_Meetings SET Is_Recording_Enabled = 0 WHERE ID = %s", [meeting_id])
                except Exception:
                    pass
        else:
            logging.info(f"[end_meeting] ℹ️ No active recording for meeting {meeting_id}")

        participants_processed = 0
        participants_data = []

        # ===== FIXED: RECURRING MEETING REJOIN LOGIC =====
        final_meeting_status = 'ended'  # Default: ended (no rejoin)
        is_recurring_meeting = bool(is_recurring)
        can_rejoin = False
        
        if is_recurring_meeting:
            # RECURRING MEETING - Check recurrence_end_date
            if recurrence_end_date:
                try:
                    recurrence_end_dt = convert_to_ist(recurrence_end_date)
                    
                    if end_time < recurrence_end_dt:
                        # Current time is BEFORE recurrence_end_date → ALLOW REJOIN
                        final_meeting_status = 'active'
                        can_rejoin = True
                        logging.info(f"[end_meeting] ✅ RECURRING: Current time ({end_time_str}) < recurrence_end_date ({recurrence_end_date}) → REJOIN ALLOWED")
                    else:
                        # Current time is AFTER recurrence_end_date → NO REJOIN
                        final_meeting_status = 'ended'
                        can_rejoin = False
                        logging.info(f"[end_meeting] ❌ RECURRING: Current time ({end_time_str}) >= recurrence_end_date ({recurrence_end_date}) → REJOIN NOT ALLOWED")
                        
                except Exception as date_err:
                    logging.error(f"[end_meeting] Error parsing recurrence_end_date: {date_err}")
                    # If date parsing fails, default to ended for safety
                    final_meeting_status = 'ended'
                    can_rejoin = False
            else:
                # Recurring but NO recurrence_end_date set → Keep active indefinitely
                final_meeting_status = 'active'
                can_rejoin = True
                logging.info(f"[end_meeting] ✅ RECURRING: No recurrence_end_date set → REJOIN ALLOWED (indefinitely)")
        else:
            # NON-RECURRING MEETING → Always ended, no rejoin
            final_meeting_status = 'ended'
            can_rejoin = False
            logging.info(f"[end_meeting] ❌ NON-RECURRING: Meeting ended → REJOIN NOT ALLOWED")

        # ===== Update meeting status =====
        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    # FIXED: Only update Status/Ended_At for InstantMeeting and CalendarMeeting
                    # ScheduleMeetings keep Status='scheduled' and Ended_At=NULL
                    if meeting_type in ['InstantMeeting', 'CalendarMeeting']:
                        cursor.execute("""
                            UPDATE tbl_Meetings
                            SET Ended_At = %s ,Status = %s
                            WHERE ID = %s
                        """, [end_time, final_meeting_status, meeting_id])
                        
                        logging.info(f"[end_meeting] Meeting status updated to: {final_meeting_status},Ended_At: {end_time}")
                    
                    elif meeting_type == 'ScheduleMeeting':
                        logging.info(f"[end_meeting] ScheduleMeeting - Status and Ended_At NOT updated (remain 'scheduled' and NULL)")
                    
                    # FIXED: Reset Started_At for recurring meetings so next session works
                    # This is safe for ScheduleMeetings as it allows next recurring instance to have fresh Started_At
                    if is_recurring_meeting and can_rejoin:
                        cursor.execute("""
                            UPDATE tbl_Meetings 
                            SET Started_At = NULL
                            WHERE ID = %s
                        """, [meeting_id])
                        logging.info(f"[end_meeting] ✅ Reset Started_At for next recurring session")
                                    
        except Exception as e:
            logging.error(f"[end_meeting] Failed to mark meeting ended: {e}")
            return JsonResponse({"error": "Failed to update meeting status", "details": str(e)}, status=500)

        # ===== Step 3: Get all participants and finalize leave times first =====
        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("""
                        SELECT ID, User_ID, Full_Name, Role, Meeting_Type,
                               Join_Times, Leave_Times, Is_Currently_Active
                        FROM tbl_Participants
                        WHERE Meeting_ID = %s AND occurrence_number = %s
                    """, [meeting_id, occurrence_number])

                    all_participants = cursor.fetchall()
                    
                    # First pass: Finalize leave times for active participants
                    for row in all_participants:
                        participant_id, user_id, full_name, role, meeting_type, join_times_json, leave_times_json, is_active = row

                        try:
                            join_times = json.loads(join_times_json) if isinstance(join_times_json, str) else join_times_json or []
                            leave_times = json.loads(leave_times_json) if isinstance(leave_times_json, str) else leave_times_json or []
                        except Exception:
                            join_times, leave_times = [], []

                        # If participant is still active, add end_time as their leave time
                        if is_active and len(join_times) > len(leave_times):
                            leave_times.append(end_time_str)
                            
                            # Update leave times in database
                            cursor.execute("""
                                UPDATE tbl_Participants
                                SET Leave_Times = %s,
                                    Is_Currently_Active = FALSE
                                WHERE ID = %s
                            """, [json.dumps(leave_times), participant_id])
                            
        except Exception as e:
            logging.error(f"[end_meeting] Finalize leave times error: {e}")
            return JsonResponse({"error": "Failed to finalize leave times", "details": str(e)}, status=500)

        # ===== Step 4: Get HOST join/leave times for overlap calculation =====
        host_join_times = []
        host_leave_times = []
        host_duration = 0.0
        
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT User_ID, Role, Join_Times, Leave_Times
                    FROM tbl_Participants
                    WHERE Meeting_ID = %s AND LOWER(Role) = 'host' AND occurrence_number = %s
                """, [meeting_id, occurrence_number])

                host_row = cursor.fetchone()
                
                if not host_row:
                    return JsonResponse({"error": "No host found for this meeting"}, status=400)
                
                try:
                    host_join_times = json.loads(host_row[2]) if isinstance(host_row[2], str) else host_row[2] or []
                    host_leave_times = json.loads(host_row[3]) if isinstance(host_row[3], str) else host_row[3] or []
                except Exception:
                    host_join_times, host_leave_times = [], []
                
                # Calculate host's total duration
                host_duration = calculate_duration_from_arrays(host_join_times, host_leave_times)
                if host_duration is None:
                    host_duration = 0.0
                
                logging.info(f"[end_meeting] Host duration: {host_duration:.2f} min, Sessions: {len(host_leave_times)}")
                logging.info(f"[end_meeting] Host join_times: {host_join_times}")
                logging.info(f"[end_meeting] Host leave_times: {host_leave_times}")
                
        except Exception as e:
            logging.error(f"[end_meeting] Get host times error: {e}")
            return JsonResponse({"error": "Failed to get host times", "details": str(e)}, status=500)

        if host_duration <= 0:
            return JsonResponse({"error": "Invalid host duration"}, status=400)

        # ===== Step 5: Calculate OVERLAP duration for each participant =====
        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("""
                        SELECT ID, User_ID, Full_Name, Role, Meeting_Type,
                               Join_Times, Leave_Times
                        FROM tbl_Participants
                        WHERE Meeting_ID = %s AND occurrence_number = %s
                    """, [meeting_id, occurrence_number])

                    all_participants = cursor.fetchall()

                    for row in all_participants:
                        participant_id, user_id, full_name, role, meeting_type, join_times_json, leave_times_json = row

                        try:
                            join_times = json.loads(join_times_json) if isinstance(join_times_json, str) else join_times_json or []
                            leave_times = json.loads(leave_times_json) if isinstance(leave_times_json, str) else leave_times_json or []
                        except Exception:
                            join_times, leave_times = [], []

                        completed_sessions = len(leave_times)
                        
                        if role.lower() == "host":
                            total_duration_minutes = host_duration
                        else:
                            total_duration_minutes = calculate_overlap_duration(
                                host_join_times, 
                                host_leave_times, 
                                join_times, 
                                leave_times
                            )
                            
                            logging.info(f"[end_meeting] User {user_id}: Overlap duration = {total_duration_minutes:.2f} min")
                        
                        if total_duration_minutes is None:
                            total_duration_minutes = 0.0

                        cursor.execute("""
                            UPDATE tbl_Participants
                            SET End_Meeting_Time = %s,
                                Total_Duration_Minutes = %s,
                                Total_Sessions = %s,
                                Is_Currently_Active = FALSE
                            WHERE ID = %s
                        """, [
                            end_time,
                            total_duration_minutes,
                            completed_sessions,
                            participant_id
                        ])

                        participants_processed += 1
                        participants_data.append({
                            "user_id": user_id,
                            "full_name": full_name or f"User {user_id}",
                            "role": role,
                            "meeting_type": meeting_type,
                            "total_sessions": completed_sessions,
                            "total_duration_minutes": round(total_duration_minutes, 2),
                        })
                        
        except Exception as e:
            logging.error(f"[end_meeting] Participant duration update error: {e}")
            import traceback
            logging.error(f"Traceback: {traceback.format_exc()}")
            return JsonResponse({"error": "Failed to finalize participant data", "details": str(e)}, status=500)

        # ===== Step 6: Host-based attendance percentage =====
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT User_ID, Role, Total_Duration_Minutes
                    FROM tbl_Participants
                    WHERE Meeting_ID = %s AND occurrence_number = %s
                """, [meeting_id, occurrence_number])

                rows = cursor.fetchall()
        except Exception as e:
            logging.error(f"[end_meeting] Fetch participants error: {e}")
            return JsonResponse({"error": "Failed to fetch participants", "details": str(e)}, status=500)

        if not rows:
            return JsonResponse({"error": "No participants found for this meeting"}, status=404)

        participants_output = []
        total_participant_percentage = 0.0
        participant_count = 0

        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    for user_id, role, duration in rows:
                        duration = float(duration or 0)
                        
                        if role.lower() == "host":
                            attendance_host = 100.00
                        else:
                            if host_duration > 0:
                                attendance_host = round((duration / host_duration) * 100, 2)
                                attendance_host = min(attendance_host, 100.00)
                            else:
                                attendance_host = 0.0
                            
                            total_participant_percentage += attendance_host
                            participant_count += 1

                        cursor.execute("""
                            UPDATE tbl_Participants
                            SET Attendance_Percentagebasedon_host = %s
                            WHERE Meeting_ID = %s AND User_ID = %s AND occurrence_number = %s
                        """, [attendance_host, meeting_id, user_id, occurrence_number])

                        participants_output.append({
                            "user_id": user_id,
                            "role": role,
                            "attendance_percentagebasedon_host": attendance_host,
                            "duration_minutes": round(duration, 2)
                        })
                        
                        logging.info(f"[end_meeting] User {user_id} ({role}): Attendance={attendance_host}% (Duration: {duration:.2f} / Host: {host_duration:.2f})")
                        
        except Exception as e:
            logging.error(f"[end_meeting] Host-based attendance error: {e}")
            return JsonResponse({"error": "Failed during host-based attendance calc", "details": str(e)}, status=500)

        # ===== Step 7: Enhanced attendance calculation ===== 
        attendance_calculation_results = []
        attendance_calculation_success = False
        
        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("""
                        SELECT p.User_ID, p.Role, p.Attendance_Percentagebasedon_host,
                               COALESCE(att.attendance_percentage, 0) as ai_attendance_percentage
                        FROM tbl_Participants p
                        LEFT JOIN tbl_Attendance_Sessions att 
                        ON p.Meeting_ID = att.meeting_id AND p.User_ID = att.user_id
                        WHERE p.Meeting_ID = %s AND p.occurrence_number = %s
                    """, [meeting_id, occurrence_number])

                    participants_attendance_data = cursor.fetchall()
                    
                    for user_id, role, host_based_attendance, ai_attendance in participants_attendance_data:
                        if role.lower() == 'host':
                            logging.info(f"[ATTENDANCE_CALC] Skipping host {user_id} for per-meeting calculation")
                            continue
                        
                        host_based = float(host_based_attendance or 0)
                        ai_based = float(ai_attendance or 0)
                        
                        ai_based = min(ai_based, 100.00)
                        
                        per_meeting_average = (host_based + ai_based) / 2
                        per_meeting_average = min(per_meeting_average, 100.00)
                        
                        logging.info(f"[ATTENDANCE_CALC] User {user_id}: Host-based={host_based}%, AI-based={ai_based}%, Per-meeting avg={per_meeting_average}%")
                        
                        cursor.execute("""
                            UPDATE tbl_Participants 
                            SET Participant_Attendance = %s
                            WHERE Meeting_ID = %s AND User_ID = %s AND occurrence_number = %s
                        """, [round(per_meeting_average, 2), meeting_id, user_id, occurrence_number])
                        
                        # Overall attendance calculation
                        if is_recurring_meeting:
                            # For recurring meetings, calculate across all occurrences of this meeting
                            cursor.execute("""
                                SELECT AVG(Participant_Attendance) as overall_avg
                                FROM tbl_Participants 
                                WHERE User_ID = %s 
                                AND Meeting_ID = %s
                                AND Participant_Attendance IS NOT NULL
                                AND LOWER(Role) != 'host'
                            """, [user_id, meeting_id])
                        else:
                            # For non-recurring, calculate across all meetings
                            cursor.execute("""
                                SELECT AVG(Participant_Attendance) as overall_avg
                                FROM tbl_Participants 
                                WHERE User_ID = %s 
                                AND Participant_Attendance IS NOT NULL
                                AND Role != 'host'
                            """, [user_id])
                        
                        overall_result = cursor.fetchone()
                        overall_attendance = float(overall_result[0] or 0) if overall_result else 0
                        overall_attendance = min(overall_attendance, 100.00)
                        
                        logging.info(f"[ATTENDANCE_CALC] User {user_id}: Overall attendance={overall_attendance}%")
                        
                        cursor.execute("""
                            UPDATE tbl_Participants 
                            SET Overall_Attendance = %s
                            WHERE Meeting_ID = %s AND User_ID = %s AND Role != 'host'
                        """, [round(overall_attendance, 2), meeting_id, user_id])
                        
                        attendance_calculation_results.append({
                            "user_id": user_id,
                            "role": role,
                            "host_based_attendance": round(host_based, 2),
                            "ai_based_attendance": round(ai_based, 2),
                            "per_meeting_average": round(per_meeting_average, 2),
                            "overall_attendance": round(overall_attendance, 2)
                        })
                    
                    attendance_calculation_success = True
                    logging.info(f"✅ [ATTENDANCE_CALC] Successfully calculated attendance for {len(attendance_calculation_results)} participants")
                        
        except Exception as e:
            logging.error(f"[end_meeting] Enhanced attendance calculation error: {e}")
            import traceback
            logging.error(f"Traceback: {traceback.format_exc()}")
            attendance_calculation_results = []
            attendance_calculation_success = False

        # ===== Step 8: Meeting summary =====
        summary_average = round(total_participant_percentage / participant_count, 2) if participant_count > 0 else 0.0
        meeting_duration_display = "Unknown"
        total_meeting_duration_minutes = None

        if started_at:
            started_dt = convert_to_ist(started_at)
            total_meeting_duration_minutes = (end_time - started_dt).total_seconds() / 60.0
            hours = int(total_meeting_duration_minutes // 60)
            mins = int(total_meeting_duration_minutes % 60)
            meeting_duration_display = f"{hours}h {mins}m" if hours > 0 else f"{mins}m"

        # ===== Step 9: Build response =====
        response_data = {
            "success": True,
            "message": "Meeting session ended successfully and attendance calculated" + (" - Recording is being processed" if recording_auto_stopped else ""),
            "meeting_id": meeting_id,
            "meeting_name": meeting_name,
            "ended_at": end_time_str,
            "participants_processed": participants_processed,
            "host_duration_minutes": round(host_duration, 2),
            "participants": participants_output,
            "summary_average": summary_average,
            "total_meeting_duration_minutes": round(total_meeting_duration_minutes, 2) if total_meeting_duration_minutes else None,
            "meeting_duration_display": meeting_duration_display,
            "calculation_method": "(Participant_Overlap_Duration / Host_Duration) * 100 - Only counts time when BOTH present",
            
            # FIXED: Clear recurring meeting rejoin information
            "is_recurring_meeting": is_recurring_meeting,
            "meeting_status": final_meeting_status,
            "can_rejoin": can_rejoin,
            "recurrence_end_date": str(recurrence_end_date) if recurrence_end_date else None,
            
            # Recording information
            "recording_info": {
                "was_active": bool(is_recording_enabled),
                "auto_stopped": recording_auto_stopped,
                "stop_result": recording_stop_result,
                "message": "Recording stopped and is being processed. It will be available in Recordings section shortly." if recording_auto_stopped else "No active recording"
            }
        }
        
        if attendance_calculation_success and attendance_calculation_results:
            response_data.update({
                "enhanced_attendance_calculations": attendance_calculation_results,
                "enhanced_calculation_method": "Enhanced: (AI_Attendance + Host_Based_Overlap_Attendance) / 2",
                "formulas_applied": {
                    "total_duration_minutes": "Overlap duration - Only time when BOTH host and participant were present",
                    "host_based_attendance": "(Total_Duration_Minutes / Host_Duration) * 100",
                    "per_meeting_average": "(attendance_percentage + Attendance_Percentagebasedon_host) / 2",
                    "overall_attendance": "AVG(Participant_Attendance) across all meetings"
                },
                "attendance_enhancement_status": "success"
            })
        else:
            response_data["attendance_enhancement_status"] = "failed_but_meeting_ended_successfully"
        
        return JsonResponse(response_data, status=200)

    except Exception as e:
        logging.error(f"[end_meeting] Critical error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return JsonResponse({
            "error": "Internal server error",
            "details": str(e)
        }, status=500)

@require_http_methods(["POST"])
@csrf_exempt
def assign_co_host(request):
    """
    ✅ FULLY FIXED: Assign co-host with proper validation
    """
    try:
        data = json.loads(request.body)
        
        meeting_id = data.get('meeting_id')
        user_id = data.get('user_id')
        assigned_by = data.get('assigned_by')
        
        logging.info(f"[COHOST] Assigning co-host: user={user_id}, meeting={meeting_id}, by={assigned_by}")
        
        # Validate required fields
        if not meeting_id:
            return JsonResponse({
                'success': False,
                'error': 'meeting_id is required'
            }, status=400)
        
        if not user_id:
            return JsonResponse({
                'success': False,
                'error': 'user_id is required'
            }, status=400)
        
        if not assigned_by:
            return JsonResponse({
                'success': False,
                'error': 'assigned_by is required'
            }, status=400)
        
        # Convert to proper types
        user_id = str(user_id)
        assigned_by = str(assigned_by)
        
        # Get user name
        user_name = f'User_{user_id}'
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT full_name FROM tbl_Users WHERE ID = %s", [user_id])
                user_row = cursor.fetchone()
                if user_row and user_row[0]:
                    user_name = user_row[0].strip()
        except Exception as e:
            logging.warning(f"[COHOST] Error getting user name: {e}")
        
        # Verify meeting and permissions
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT Host_ID, Meeting_Name, Status 
                    FROM tbl_Meetings 
                    WHERE ID = %s
                """, [meeting_id])
                
                meeting_row = cursor.fetchone()
                if not meeting_row:
                    return JsonResponse({
                        'success': False,
                        'error': 'Meeting not found'
                    }, status=404)
                
                host_id, meeting_name, status = meeting_row
                
                if status == 'ended':
                    return JsonResponse({
                        'success': False,
                        'error': 'Cannot assign co-host to ended meeting'
                    }, status=400)
                
                # Check permissions
                if str(assigned_by) != str(host_id):
                    # Check if assigned_by is co-host
                    cursor.execute("""
                        SELECT Role FROM tbl_Participants 
                        WHERE Meeting_ID = %s AND User_ID = %s AND Is_Currently_Active = TRUE
                    """, [meeting_id, assigned_by])
                    role_row = cursor.fetchone()
                    
                    if not role_row or role_row[0] not in ['host', 'co-host']:
                        return JsonResponse({
                            'success': False,
                            'error': 'Only host or co-hosts can assign co-host roles'
                        }, status=403)
        
        except Exception as e:
            logging.error(f"[COHOST] Validation error: {e}")
            return JsonResponse({
                'success': False,
                'error': 'Database error during validation',
                'details': str(e)
            }, status=500)
        
        # Verify user is in meeting
        participant_id = None
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT ID, Full_Name FROM tbl_Participants 
                    WHERE Meeting_ID = %s AND User_ID = %s AND Is_Currently_Active = TRUE
                """, [meeting_id, user_id])
                
                participant_row = cursor.fetchone()
                if not participant_row:
                    return JsonResponse({
                        'success': False,
                        'error': 'User is not currently in the meeting'
                    }, status=400)
                
                participant_id, db_name = participant_row
                if db_name:
                    user_name = db_name
        
        except Exception as e:
            logging.error(f"[COHOST] Participant check error: {e}")
            return JsonResponse({
                'success': False,
                'error': 'Failed to verify participant',
                'details': str(e)
            }, status=500)
        
        # Update database
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE tbl_Participants 
                    SET Role = 'co-host'
                    WHERE ID = %s
                """, [participant_id])
                
                if cursor.rowcount == 0:
                    return JsonResponse({
                        'success': False,
                        'error': 'Failed to update participant role'
                    }, status=500)
                
                logging.info(f"✅ [COHOST] Updated participant {participant_id} to co-host")
        
        except Exception as e:
            logging.error(f"[COHOST] Database update error: {e}")
            return JsonResponse({
                'success': False,
                'error': 'Database update failed',
                'details': str(e)
            }, status=500)
        
        # Store in Redis (if available)
        redis_success = False
        redis_conn = get_redis()
        if redis_conn:
            try:
                cohost_data = {
                    'user_id': user_id,
                    'user_name': user_name,
                    'meeting_id': meeting_id,
                    'assigned_by': assigned_by,
                    'assigned_at': timezone.now().isoformat(),
                    'role': 'co-host'
                }
                
                cohost_key = f"cohost:{meeting_id}:{user_id}"
                redis_conn.setex(cohost_key, 86400, json.dumps(cohost_data))
                
                meeting_cohosts_key = f"meeting_cohosts:{meeting_id}"
                redis_conn.sadd(meeting_cohosts_key, user_id)
                redis_conn.expire(meeting_cohosts_key, 86400)
                
                redis_success = True
                logging.info(f"✅ [COHOST] Stored in Redis")
                
            except Exception as e:
                logging.warning(f"[COHOST] Redis operation failed: {e}")
        
        return JsonResponse({
            'success': True,
            'message': f'Co-host role assigned to {user_name}',
            'cohost_info': {
                'meeting_id': meeting_id,
                'user_id': user_id,
                'user_name': user_name,
                'assigned_by': assigned_by,
                'role': 'co-host',
                'assigned_at': timezone.now().isoformat()
            },
            'storage_method': 'redis + database' if redis_success else 'database only'
        }, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON format'
        }, status=400)
    except Exception as e:
        logging.error(f"[COHOST] Critical error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return JsonResponse({
            'success': False,
            'error': 'Internal server error',
            'details': str(e)
        }, status=500)

@require_http_methods(["POST"])
@csrf_exempt
def remove_co_host(request):
    """
    ✅ CORRECTED: Remove co-host with proper validation and error handling
    """
    try:
        # Parse request body
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError as e:
            logging.error(f"[REMOVE-COHOST] JSON decode error: {e}")
            return JsonResponse({
                'success': False,
                'error': 'Invalid JSON format'
            }, status=400)
        
        meeting_id = data.get('meeting_id')
        user_id = data.get('user_id')
        removed_by = data.get('removed_by')
        
        logging.info(f"[REMOVE-COHOST] Request: meeting={meeting_id}, user={user_id}, by={removed_by}")
        
        # Validate required fields with detailed error messages
        if not meeting_id:
            logging.warning("[REMOVE-COHOST] Missing meeting_id")
            return JsonResponse({
                'success': False,
                'error': 'meeting_id is required',
                'field': 'meeting_id'
            }, status=400)
        
        if not user_id:
            logging.warning("[REMOVE-COHOST] Missing user_id")
            return JsonResponse({
                'success': False,
                'error': 'user_id is required',
                'field': 'user_id'
            }, status=400)
        
        if not removed_by:
            logging.warning("[REMOVE-COHOST] Missing removed_by")
            return JsonResponse({
                'success': False,
                'error': 'removed_by is required',
                'field': 'removed_by'
            }, status=400)
        
        # Convert to strings for consistency
        user_id = str(user_id)
        removed_by = str(removed_by)
        
        # Verify meeting exists and get permissions
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT Host_ID, Meeting_Name, Status 
                    FROM tbl_Meetings 
                    WHERE ID = %s
                """, [meeting_id])
                
                meeting_row = cursor.fetchone()
                
                if not meeting_row:
                    logging.error(f"[REMOVE-COHOST] Meeting {meeting_id} not found")
                    return JsonResponse({
                        'success': False,
                        'error': 'Meeting not found'
                    }, status=404)
                
                host_id, meeting_name, status = meeting_row
                
                logging.info(f"[REMOVE-COHOST] Meeting found: {meeting_name}, Status: {status}, Host: {host_id}")
                
                # Check if meeting has ended
                if status == 'ended':
                    logging.warning(f"[REMOVE-COHOST] Meeting {meeting_id} has ended")
                    return JsonResponse({
                        'success': False,
                        'error': 'Cannot modify roles in ended meeting'
                    }, status=400)
                
                # Check if removed_by is the host
                if str(removed_by) != str(host_id):
                    logging.warning(f"[REMOVE-COHOST] User {removed_by} is not host (host is {host_id})")
                    return JsonResponse({
                        'success': False,
                        'error': 'Only the host can remove co-host roles',
                        'host_id': str(host_id),
                        'removed_by': str(removed_by)
                    }, status=403)
        
        except Exception as e:
            logging.error(f"[REMOVE-COHOST] Database error during permission check: {e}")
            import traceback
            logging.error(f"Traceback: {traceback.format_exc()}")
            return JsonResponse({
                'success': False,
                'error': 'Database error during permission check',
                'details': str(e)
            }, status=500)
        
        # Get user name
        user_name = f'User_{user_id}'
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT Full_Name, Role 
                    FROM tbl_Participants 
                    WHERE Meeting_ID = %s AND User_ID = %s AND Is_Currently_Active = TRUE
                """, [meeting_id, user_id])
                
                participant_row = cursor.fetchone()
                
                if not participant_row:
                    logging.warning(f"[REMOVE-COHOST] User {user_id} not found or not active in meeting")
                    return JsonResponse({
                        'success': False,
                        'error': 'User not found or not currently in meeting'
                    }, status=400)
                
                db_name, current_role = participant_row
                
                if db_name:
                    user_name = db_name
                
                # Check if user is actually a co-host
                if current_role != 'co-host':
                    logging.warning(f"[REMOVE-COHOST] User {user_id} is not a co-host (role: {current_role})")
                    return JsonResponse({
                        'success': False,
                        'error': f'User is not a co-host (current role: {current_role})',
                        'current_role': current_role
                    }, status=400)
                
                logging.info(f"[REMOVE-COHOST] Found co-host: {user_name}, Role: {current_role}")
                
        except Exception as e:
            logging.error(f"[REMOVE-COHOST] Error checking participant: {e}")
            import traceback
            logging.error(f"Traceback: {traceback.format_exc()}")
            return JsonResponse({
                'success': False,
                'error': 'Error checking participant status',
                'details': str(e)
            }, status=500)
        
        # Update database - change role from co-host to participant
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE tbl_Participants 
                    SET Role = 'participant'
                    WHERE Meeting_ID = %s AND User_ID = %s AND Is_Currently_Active = TRUE
                """, [meeting_id, user_id])
                
                rows_affected = cursor.rowcount
                
                if rows_affected == 0:
                    logging.error(f"[REMOVE-COHOST] Failed to update role - no rows affected")
                    return JsonResponse({
                        'success': False,
                        'error': 'Failed to update participant role'
                    }, status=500)
                
                logging.info(f"✅ [REMOVE-COHOST] Updated role to participant ({rows_affected} row(s))")
        
        except Exception as e:
            logging.error(f"[REMOVE-COHOST] Database update error: {e}")
            import traceback
            logging.error(f"Traceback: {traceback.format_exc()}")
            return JsonResponse({
                'success': False,
                'error': 'Database update failed',
                'details': str(e)
            }, status=500)
        
        # Remove from Redis (if available)
        redis_success = False
        redis_conn = get_redis()
        
        if redis_conn:
            try:
                # Delete co-host key
                cohost_key = f"cohost:{meeting_id}:{user_id}"
                deleted_count = redis_conn.delete(cohost_key)
                
                # Remove from meeting co-hosts set
                meeting_cohosts_key = f"meeting_cohosts:{meeting_id}"
                removed_count = redis_conn.srem(meeting_cohosts_key, user_id)
                
                redis_success = True
                logging.info(f"✅ [REMOVE-COHOST] Redis cleanup: deleted {deleted_count} key(s), removed {removed_count} from set")
                
            except Exception as e:
                logging.warning(f"[REMOVE-COHOST] Redis cleanup error: {e}")
                # Don't fail the request if Redis fails
        else:
            logging.info("[REMOVE-COHOST] Redis not available - skipping Redis cleanup")
        
        logging.info(f"✅ [REMOVE-COHOST] Successfully removed co-host role from {user_name}")
        
        return JsonResponse({
            'success': True,
            'message': f'Co-host role removed from {user_name}',
            'data': {
                'meeting_id': meeting_id,
                'user_id': user_id,
                'user_name': user_name,
                'previous_role': 'co-host',
                'new_role': 'participant',
                'removed_by': removed_by
            },
            'storage_method': 'redis + database' if redis_success else 'database only'
        }, status=200)
        
    except Exception as e:
        logging.error(f"[REMOVE-COHOST] Critical unexpected error: {e}")
        import traceback
        logging.error(f"Traceback: {traceback.format_exc()}")
        return JsonResponse({
            'success': False,
            'error': 'Internal server error',
            'details': str(e)
        }, status=500)

@require_http_methods(["GET"])
@csrf_exempt
def get_co_hosts(request, meeting_id):
    """
    ✅ CORRECTED: Get co-hosts with proper error handling
    """
    try:
        cohosts = []
        method = 'database'  # Default to database
        
        # Try database (most reliable)
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT User_ID, Full_Name, Join_Times, Role 
                    FROM tbl_Participants 
                    WHERE Meeting_ID = %s AND Role = 'co-host' AND Is_Currently_Active = TRUE
                """, [meeting_id])
                
                db_cohosts = cursor.fetchall()
                
                for row in db_cohosts:
                    user_id, full_name, join_times_json, role = row
                    
                    # Parse join times safely
                    first_join = None
                    try:
                        if isinstance(join_times_json, str):
                            join_times = json.loads(join_times_json)
                        elif isinstance(join_times_json, list):
                            join_times = join_times_json
                        else:
                            join_times = []
                        first_join = join_times[0] if join_times else None
                    except Exception as e:
                        logging.error(f"Error parsing join_times: {e}")
                    
                    cohosts.append({
                        'user_id': str(user_id),
                        'user_name': full_name or f'User_{user_id}',
                        'meeting_id': meeting_id,
                        'role': role,
                        'join_time': first_join,
                        'assigned_at': first_join,
                        'source': 'database'
                    })
                
                method = 'database'
                
        except Exception as e:
            logging.error(f"Database error in get_co_hosts: {e}")
            return JsonResponse({
                'success': False,
                'error': 'Failed to get co-hosts',
                'details': str(e)
            }, status=500)
        
        return JsonResponse({
            'success': True,
            'meeting_id': meeting_id,
            'cohosts': cohosts,
            'total_cohosts': len(cohosts),
            'method': method
        })
        
    except Exception as e:
        logging.error(f"Error in get_co_hosts: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return JsonResponse({
            'success': False,
            'error': f'Failed to get co-hosts: {str(e)}'
        }, status=500)
    
@require_http_methods(["GET"])
@csrf_exempt
def check_co_host_status(request, meeting_id, user_id):
    """FIXED: Check co-host status with new schema"""
    try:
        is_cohost = False
        cohost_info = None
        method = 'unknown'
        
        # Try Redis first
        redis_conn = get_redis()
        if redis_conn:
            try:
                cohost_key = f"cohost:{meeting_id}:{user_id}"
                cohost_data_raw = redis_conn.get(cohost_key)
                
                if cohost_data_raw:
                    try:
                        cohost_info = json.loads(cohost_data_raw)
                        is_cohost = True
                        method = 'redis'
                    except:
                        pass
                        
            except Exception as e:
                redis_conn = None
        
        # Fallback to database
        if not redis_conn or not is_cohost:
            try:
                with connection.cursor() as cursor:
                    cursor.execute("""
                        SELECT Role, Full_Name, Join_Times 
                        FROM tbl_Participants 
                        WHERE Meeting_ID = %s AND User_ID = %s AND Is_Currently_Active = TRUE
                    """, [meeting_id, user_id])
                    
                    participant_row = cursor.fetchone()
                    if participant_row:
                        role, full_name, join_times_json = participant_row
                        if role == 'co-host':
                            # Parse join times
                            try:
                                join_times = json.loads(join_times_json) if isinstance(join_times_json, str) else join_times_json
                                first_join = join_times[0] if join_times else None
                            except:
                                first_join = None
                            
                            is_cohost = True
                            cohost_info = {
                                'user_id': user_id,
                                'user_name': full_name or f'User_{user_id}',
                                'meeting_id': meeting_id,
                                'role': role,
                                'join_time': first_join,
                                'source': 'database'
                            }
                            method = 'database'
                        
            except Exception as e:
                return JsonResponse({
                    'is_cohost': False,
                    'error': 'Database error',
                    'details': str(e)
                })
        
        response_data = {
            'is_cohost': is_cohost,
            'method': method
        }
        
        if cohost_info:
            response_data['cohost_info'] = cohost_info
        
        return JsonResponse(response_data)
            
    except Exception as e:
        logging.error(f"Error checking co-host status: {e}")
        return JsonResponse({
            'is_cohost': False,
            'error': str(e)
        })

@require_http_methods(["POST"])
@csrf_exempt
def remove_participant_from_meeting(request):
    """
    ✅ FULLY CORRECTED: Remove participant with comprehensive validation
    """
    try:
        # Parse request body safely
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError as e:
            logging.error(f"[REMOVE-PARTICIPANT] JSON decode error: {e}")
            return JsonResponse({
                'success': False,
                'error': 'Invalid JSON format'
            }, status=400)
        
        meeting_id = data.get('meeting_id')
        user_id_to_remove = data.get('user_id')
        removed_by = data.get('removed_by')
        reason = data.get('reason', 'removed_by_host')
        
        logging.info(f"[REMOVE-PARTICIPANT] Request: meeting={meeting_id}, user={user_id_to_remove}, by={removed_by}, reason={reason}")
        
        # Validate required fields individually
        if not meeting_id:
            logging.warning("[REMOVE-PARTICIPANT] Missing meeting_id")
            return JsonResponse({
                'success': False,
                'error': 'meeting_id is required',
                'field': 'meeting_id'
            }, status=400)
        
        if not user_id_to_remove:
            logging.warning("[REMOVE-PARTICIPANT] Missing user_id")
            return JsonResponse({
                'success': False,
                'error': 'user_id is required',
                'field': 'user_id'
            }, status=400)
        
        if not removed_by:
            logging.warning("[REMOVE-PARTICIPANT] Missing removed_by")
            return JsonResponse({
                'success': False,
                'error': 'removed_by is required',
                'field': 'removed_by'
            }, status=400)
        
        # Convert to strings for consistency
        user_id_to_remove = str(user_id_to_remove)
        removed_by = str(removed_by)
        
        # Verify meeting exists and get permissions
        host_id = None
        meeting_name = None
        room_name = None
        
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT Host_ID, Meeting_Name, LiveKit_Room_Name, Status
                    FROM tbl_Meetings 
                    WHERE ID = %s
                """, [meeting_id])
                
                meeting_row = cursor.fetchone()
                
                if not meeting_row:
                    logging.error(f"[REMOVE-PARTICIPANT] Meeting {meeting_id} not found")
                    return JsonResponse({
                        'success': False,
                        'error': 'Meeting not found'
                    }, status=404)
                
                host_id, meeting_name, room_name, status = meeting_row
                
                logging.info(f"[REMOVE-PARTICIPANT] Meeting: {meeting_name}, Status: {status}, Host: {host_id}")
                
                # Check if meeting has ended
                if status == 'ended':
                    logging.warning(f"[REMOVE-PARTICIPANT] Meeting {meeting_id} has ended")
                    return JsonResponse({
                        'success': False,
                        'error': 'Cannot remove participant from ended meeting'
                    }, status=400)
                
                # Check if trying to remove the host
                if str(user_id_to_remove) == str(host_id):
                    logging.warning(f"[REMOVE-PARTICIPANT] Attempt to remove host {host_id}")
                    return JsonResponse({
                        'success': False,
                        'error': 'Cannot remove the host from the meeting'
                    }, status=400)
                
                # Verify permissions - check if removed_by is host or co-host
                is_host = str(removed_by) == str(host_id)
                is_cohost = False
                
                if not is_host:
                    cursor.execute("""
                        SELECT Role FROM tbl_Participants 
                        WHERE Meeting_ID = %s AND User_ID = %s AND Is_Currently_Active = TRUE
                    """, [meeting_id, removed_by])
                    
                    role_row = cursor.fetchone()
                    is_cohost = role_row and role_row[0] == 'co-host'
                    
                    logging.info(f"[REMOVE-PARTICIPANT] Removed_by role check: is_host={is_host}, is_cohost={is_cohost}")
                
                if not (is_host or is_cohost):
                    logging.warning(f"[REMOVE-PARTICIPANT] User {removed_by} lacks permission")
                    return JsonResponse({
                        'success': False,
                        'error': 'Only host or co-hosts can remove participants',
                        'removed_by': removed_by,
                        'host_id': str(host_id)
                    }, status=403)
        
        except Exception as e:
            logging.error(f"[REMOVE-PARTICIPANT] Database error during permission check: {e}")
            import traceback
            logging.error(f"Traceback: {traceback.format_exc()}")
            return JsonResponse({
                'success': False,
                'error': 'Database error during permission check',
                'details': str(e)
            }, status=500)
        
        # Get participant info
        participant_name = f'User_{user_id_to_remove}'
        participant_id = None
        join_times_json = None
        leave_times_json = None
        
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT ID, Full_Name, Join_Times, Leave_Times, Role
                    FROM tbl_Participants 
                    WHERE Meeting_ID = %s AND User_ID = %s AND Is_Currently_Active = TRUE
                """, [meeting_id, user_id_to_remove])
                
                participant_row = cursor.fetchone()
                
                if not participant_row:
                    logging.warning(f"[REMOVE-PARTICIPANT] User {user_id_to_remove} not found or not active")
                    return JsonResponse({
                        'success': False,
                        'error': 'Participant not found or already left',
                        'user_id': user_id_to_remove
                    }, status=400)
                
                participant_id, db_name, join_times_json, leave_times_json, participant_role = participant_row
                
                if db_name:
                    participant_name = db_name
                
                logging.info(f"[REMOVE-PARTICIPANT] Found participant: ID={participant_id}, Name={participant_name}, Role={participant_role}")
        
        except Exception as e:
            logging.error(f"[REMOVE-PARTICIPANT] Error getting participant info: {e}")
            import traceback
            logging.error(f"Traceback: {traceback.format_exc()}")
            return JsonResponse({
                'success': False,
                'error': 'Error retrieving participant information',
                'details': str(e)
            }, status=500)
        
        # Update participant - mark as removed
        remove_time = get_ist_now()
        remove_time_str = remove_time.strftime('%Y-%m-%d %H:%M:%S')
        
        try:
            with connection.cursor() as cursor:
                # Parse JSON arrays safely
                join_times = []
                leave_times = []
                
                try:
                    if join_times_json:
                        if isinstance(join_times_json, str):
                            join_times = json.loads(join_times_json)
                        elif isinstance(join_times_json, list):
                            join_times = join_times_json
                except Exception as e:
                    logging.error(f"[REMOVE-PARTICIPANT] Error parsing join_times: {e}")
                
                try:
                    if leave_times_json:
                        if isinstance(leave_times_json, str):
                            leave_times = json.loads(leave_times_json)
                        elif isinstance(leave_times_json, list):
                            leave_times = leave_times_json
                except Exception as e:
                    logging.error(f"[REMOVE-PARTICIPANT] Error parsing leave_times: {e}")
                
                # Append current time to leave times
                leave_times.append(remove_time_str)
                
                logging.info(f"[REMOVE-PARTICIPANT] Sessions - Join: {len(join_times)}, Leave: {len(leave_times)}")
                
                # Calculate total duration
                total_duration = 0.0
                try:
                    total_duration = calculate_duration_from_arrays(join_times, leave_times)
                    logging.info(f"[REMOVE-PARTICIPANT] Calculated duration: {total_duration:.2f} minutes")
                except Exception as e:
                    logging.error(f"[REMOVE-PARTICIPANT] Error calculating duration: {e}")
                
                # Update participant record
                cursor.execute("""
                    UPDATE tbl_Participants 
                    SET Leave_Times = %s,
                        Is_Currently_Active = FALSE,
                        Total_Duration_Minutes = %s,
                        Total_Sessions = %s
                    WHERE ID = %s
                """, [json.dumps(leave_times), total_duration, len(leave_times), participant_id])
                
                rows_affected = cursor.rowcount
                
                if rows_affected == 0:
                    logging.error(f"[REMOVE-PARTICIPANT] Update failed - no rows affected")
                    return JsonResponse({
                        'success': False,
                        'error': 'Failed to update participant record'
                    }, status=500)
                
                logging.info(f"✅ [REMOVE-PARTICIPANT] Updated participant record ({rows_affected} row(s))")
        
        except Exception as e:
            logging.error(f"[REMOVE-PARTICIPANT] Database update error: {e}")
            import traceback
            logging.error(f"Traceback: {traceback.format_exc()}")
            return JsonResponse({
                'success': False,
                'error': 'Failed to update participant',
                'details': str(e)
            }, status=500)
        
        # Remove from LiveKit
        removed_from_livekit = False
        if is_livekit_enabled() and get_livekit_service() and room_name:
            try:
                lk_participants = get_livekit_service().list_participants(room_name)
                
                participant_identity = None
                for p in lk_participants:
                    identity = p.get('identity', '')
                    if str(user_id_to_remove) in identity:
                        participant_identity = identity
                        break
                
                if participant_identity:
                    if hasattr(get_livekit_service(), 'remove_participant'):
                        get_livekit_service().remove_participant(room_name, participant_identity)
                        removed_from_livekit = True
                        logging.info(f"✅ [REMOVE-PARTICIPANT] Removed from LiveKit: {participant_identity}")
                    else:
                        logging.warning("[REMOVE-PARTICIPANT] LiveKit service doesn't have remove_participant method")
                else:
                    logging.info(f"[REMOVE-PARTICIPANT] User {user_id_to_remove} not found in LiveKit")
                
            except Exception as e:
                logging.warning(f"[REMOVE-PARTICIPANT] LiveKit removal error: {e}")
                # Don't fail the request if LiveKit removal fails
        else:
            logging.info("[REMOVE-PARTICIPANT] LiveKit not enabled or room_name not available")
        
        # Remove co-host status from Redis (if applicable)
        redis_conn = get_redis()
        if redis_conn:
            try:
                cohost_key = f"cohost:{meeting_id}:{user_id_to_remove}"
                redis_conn.delete(cohost_key)
                
                meeting_cohosts_key = f"meeting_cohosts:{meeting_id}"
                redis_conn.srem(meeting_cohosts_key, user_id_to_remove)
                
                logging.info("[REMOVE-PARTICIPANT] Cleaned up Redis co-host data")
            except Exception as e:
                logging.warning(f"[REMOVE-PARTICIPANT] Redis cleanup error: {e}")
        
        # Format duration for display
        hours = int(total_duration // 60)
        mins = int(total_duration % 60)
        duration_display = f"{hours}h {mins}m" if hours > 0 else f"{mins}m"
        
        logging.info(f"✅ [REMOVE-PARTICIPANT] Successfully removed {participant_name} (ID: {user_id_to_remove})")
        
        return JsonResponse({
            'success': True,
            'message': f'Participant {participant_name} removed from meeting',
            'data': {
                'participant_info': {
                    'user_id': user_id_to_remove,
                    'participant_id': participant_id,
                    'name': participant_name,
                    'leave_time': remove_time_str,
                    'total_sessions': len(leave_times),
                    'total_duration_minutes': round(total_duration, 2),
                    'duration_display': duration_display,
                    'removal_reason': reason,
                    'removed_by': removed_by
                },
                'meeting_id': meeting_id,
                'removed_from_livekit': removed_from_livekit,
                # 'attendance_stopped': ATTENDANCE_INTEGRATION
            }
        }, status=200)
        
    except Exception as e:
        logging.error(f"[REMOVE-PARTICIPANT] Critical unexpected error: {e}")
        import traceback
        logging.error(f"Traceback: {traceback.format_exc()}")
        return JsonResponse({
            'success': False,
            'error': 'Internal server error',
            'details': str(e)
        }, status=500)