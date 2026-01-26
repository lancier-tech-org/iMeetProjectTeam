from django.db import connection, transaction
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.urls import path
import json
import logging
from reportlab.platypus import Preformatted
from reportlab.platypus import KeepTogether, Paragraph
from django.http import HttpResponse, JsonResponse
from datetime import datetime, timedelta
import pytz
from django.utils import timezone
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.platypus.frames import Frame
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from io import BytesIO
import os
import traceback
from textwrap import fill
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import HRFlowable

# Configure logging
logging.basicConfig(filename='analytics_debug.log', level=logging.DEBUG, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

# Global status codes
SUCCESS_STATUS = 200
BAD_REQUEST_STATUS = 400
UNAUTHORIZED_STATUS = 401
FORBIDDEN_STATUS = 403
NOT_FOUND_STATUS = 404
SERVER_ERROR_STATUS = 500


class ReportGenerator:
    """Helper class for generating PDF reports"""
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self.custom_styles = self._create_custom_styles()
    
    def _create_custom_styles(self):
        """Create custom styles for the reports"""
        styles = {}
        
        styles['ReportTitle'] = ParagraphStyle(
            'ReportTitle',
            parent=self.styles['Title'],
            fontSize=18,
            spaceAfter=20,
            alignment=TA_CENTER,
            textColor=colors.darkblue
        )
        
        styles['SectionHeader'] = ParagraphStyle(
            'SectionHeader',
            parent=self.styles['Heading1'],
            fontSize=14,
            spaceAfter=12,
            textColor=colors.darkblue,
            borderWidth=1,
            borderColor=colors.darkblue,
            borderPadding=5
        )
        
        styles['SubHeader'] = ParagraphStyle(
            'SubHeader',
            parent=self.styles['Heading2'],
            fontSize=12,
            spaceAfter=8,
            textColor=colors.black
        )
        
        styles['Summary'] = ParagraphStyle(
            'Summary',
            parent=self.styles['Normal'],
            fontSize=10,
            spaceAfter=6,
            backColor=colors.lightgrey,
            borderWidth=1,
            borderColor=colors.grey,
            borderPadding=5
        )
        
        styles['MeetingDetail'] = ParagraphStyle(
            'MeetingDetail',
            parent=self.styles['Normal'],
            fontSize=9,
            spaceAfter=4
        )
        
        return styles

    def create_header_footer(self, canvas, doc, title):
        """Properly aligned header and footer for all pages"""
        canvas.saveState()
        width, height = letter

        canvas.setFont('Helvetica-Bold', 14)
        canvas.drawString(55, height - 50, title)

        canvas.setFont('Helvetica', 9)
        canvas.drawRightString(width - 55, height - 50, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")

        canvas.setLineWidth(0.5)
        canvas.line(50, height - 60, width - 50, height - 60)

        canvas.setFont('Helvetica', 8)
        canvas.drawString(55, 55, "Meeting Analytics System")
        canvas.drawRightString(width - 55, 55, f"Page {doc.page}")

        canvas.line(50, 65, width - 50, 65)
        canvas.restoreState()


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def safe_json_parse(value):
    """Safely parse JSON data"""
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except:
            return None
    return None


def format_timestamp(ts):
    """Format timestamp to readable string"""
    if ts is None or ts == 0 or ts == '':
        return None
    try:
        if isinstance(ts, str):
            ts = float(ts)
        dt = datetime.fromtimestamp(ts)
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return str(ts) if ts else None


def is_valid_value(value):
    """Check if value is meaningful (not null, 0, false, empty)"""
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip() != '' and value.lower() not in ['null', 'none', 'n/a']
    if isinstance(value, (list, dict)):
        return len(value) > 0
    return True


def filter_valid_data(data_dict):
    """Filter out null, 0, false values from dictionary"""
    if not isinstance(data_dict, dict):
        return data_dict
    return {k: v for k, v in data_dict.items() if is_valid_value(v)}


def calculate_active_duration(join_times_raw, current_time):
    """
    Calculate duration for active meetings from Join_Times to current time
    Join_Times format: ["2025-12-17 11:07:36"]
    """
    if not join_times_raw:
        return 0.0
    
    try:
        join_times = safe_json_parse(join_times_raw)
        
        if not join_times or not isinstance(join_times, list) or len(join_times) == 0:
            return 0.0
        
        first_join = join_times[0]
        
        if not isinstance(first_join, str):
            return 0.0
        
        join_datetime = None
        for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S.%f']:
            try:
                join_datetime = datetime.strptime(first_join, fmt)
                break
            except ValueError:
                continue
        
        if not join_datetime:
            return 0.0
        
        duration_delta = current_time - join_datetime
        duration_minutes = duration_delta.total_seconds() / 60.0
        
        return max(0.0, duration_minutes)
        
    except Exception as e:
        logger.error(f"Error calculating active duration: {e}")
        return 0.0


@require_http_methods(["GET"])
@csrf_exempt
def Get_Host_Meetings(request, user_id):
    """
    Get all meetings where the specified user is the HOST
    FIXED: Uses p.session_start_time for date filtering and Join_Times for actual time
    """
    try:
        if not user_id:
            return JsonResponse({"success": False, "error": "user_id is required"}, status=BAD_REQUEST_STATUS)
        
        start_date_str = request.GET.get('start_date')
        end_date_str = request.GET.get('end_date')
        
        start_date_only = None
        end_date_only = None
        
        if start_date_str:
            start_date_only = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        
        if end_date_str:
            end_date_only = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        elif start_date_only:
            end_date_only = start_date_only
        
        with connection.cursor() as cursor:
            cursor.execute("SELECT ID, full_name FROM tbl_Users WHERE ID = %s AND Status = 1", [user_id])
            user = cursor.fetchone()
            
            if not user:
                return JsonResponse({"success": False, "error": "User not found or inactive"}, status=NOT_FOUND_STATUS)
            
            user_name = user[1]
            
            query = """
                SELECT 
                    m.ID AS meeting_id,
                    m.Meeting_Type AS meeting_type,
                    CASE 
                        WHEN m.Meeting_Type = 'ScheduleMeeting' THEN COALESCE(sm.title, m.Meeting_Name)
                        WHEN m.Meeting_Type = 'CalendarMeeting' THEN COALESCE(cm.title, m.Meeting_Name)
                        ELSE m.Meeting_Name
                    END AS meeting_name,
                    (SELECT COUNT(*) FROM tbl_Participants p2 
                     WHERE p2.Meeting_ID = m.ID 
                     AND p2.Role = 'participant'
                     AND (m.Meeting_Type != 'ScheduleMeeting' OR p2.occurrence_number = p.occurrence_number)
                    ) AS total_participants,
                    p.Total_Duration_Minutes AS total_duration,
                    p.Is_Currently_Active,
                    p.Join_Times,
                    m.Status AS meeting_status,
                    p.occurrence_number,
                    CASE 
                        WHEN m.Meeting_Type = 'ScheduleMeeting' THEN sm.recurrence_type
                        ELSE NULL
                    END AS recurrence_type,
                    CASE 
                        WHEN m.Meeting_Type = 'ScheduleMeeting' THEN sm.duration_minutes
                        WHEN m.Meeting_Type = 'CalendarMeeting' THEN cm.duration
                        ELSE NULL
                    END AS scheduled_duration,
                    p.session_start_time,
                    p.End_Meeting_Time,
                    p.Leave_Times
                FROM tbl_Meetings m
                LEFT JOIN tbl_ScheduledMeetings sm ON m.ID = sm.id AND m.Meeting_Type = 'ScheduleMeeting'
                LEFT JOIN tbl_CalendarMeetings cm ON m.ID = cm.ID AND m.Meeting_Type = 'CalendarMeeting'
                INNER JOIN tbl_Participants p ON m.ID = p.Meeting_ID AND p.Role = 'host'
                WHERE p.User_ID = %s
            """
            params = [user_id]
            
            # FIXED: Use p.session_start_time for date filtering with >= and <=
            if start_date_only and end_date_only:
                query += " AND p.session_start_time >= %s AND p.session_start_time <= %s"
                params.extend([start_date_only, end_date_only])
            elif start_date_only:
                query += " AND p.session_start_time >= %s"
                params.append(start_date_only)
            
            query += " ORDER BY p.session_start_time DESC, p.occurrence_number DESC"
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            logger.info(f"📊 Get_Host_Meetings: Found {len(rows)} rows for user {user_id}, dates {start_date_only} to {end_date_only}")
            
            meetings = []
            current_time = datetime.now()
            
            for row in rows:
                meeting_id = row[0]
                meeting_type = row[1]
                meeting_name = row[2]
                total_participants = row[3] or 0
                stored_duration = float(row[4]) if row[4] is not None else 0.0
                is_currently_active = bool(row[5]) if row[5] is not None else False
                join_times_raw = row[6]
                meeting_status = row[7]
                occurrence_number = row[8]
                recurrence_type = row[9]
                scheduled_duration = row[10]
                session_start_date = row[11]
                end_meeting_time = row[12]
                leave_times_raw = row[13]
                
                # Calculate duration for active meetings
                if is_currently_active and stored_duration == 0 and join_times_raw:
                    total_duration = calculate_active_duration(join_times_raw, current_time)
                else:
                    total_duration = stored_duration
                
                # FIXED: Extract actual start time from Join_Times
                start_datetime = None
                if join_times_raw:
                    join_times = safe_json_parse(join_times_raw)
                    if join_times and isinstance(join_times, list) and len(join_times) > 0:
                        first_join = join_times[0]
                        if isinstance(first_join, str):
                            for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S.%f']:
                                try:
                                    start_datetime = datetime.strptime(first_join, fmt)
                                    break
                                except ValueError:
                                    continue
                
                # Skip if no Join_Times (no actual participation)
                if not start_datetime:
                    continue
                
                # Get end time from End_Meeting_Time or Leave_Times
                end_datetime = None
                if end_meeting_time:
                    end_datetime = end_meeting_time
                elif leave_times_raw:
                    leave_times = safe_json_parse(leave_times_raw)
                    if leave_times and isinstance(leave_times, list) and len(leave_times) > 0:
                        last_leave = leave_times[-1]
                        if isinstance(last_leave, str):
                            for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S.%f']:
                                try:
                                    end_datetime = datetime.strptime(last_leave, fmt)
                                    break
                                except ValueError:
                                    continue
                
                formatted_start = start_datetime.strftime('%Y-%m-%d %H:%M:%S')
                formatted_end = end_datetime.strftime('%Y-%m-%d %H:%M:%S') if end_datetime and hasattr(end_datetime, 'strftime') else None
                
                meeting_entry = {
                    'meeting_id': meeting_id,
                    'meeting_type': meeting_type,
                    'meeting_name': meeting_name,
                    'start_date': formatted_start,
                    'end_date': formatted_end,
                    'total_participants': total_participants,
                    'total_duration_minutes': round(total_duration, 2),
                    'scheduled_duration_minutes': scheduled_duration,
                    'is_active': is_currently_active,
                    'status': meeting_status,
                    'occurrence_number': occurrence_number
                }
                
                # Add recurrence details for ScheduleMeeting
                if meeting_type == 'ScheduleMeeting':
                    meeting_entry['recurrence_type'] = recurrence_type
                    meeting_entry['is_recurring'] = recurrence_type and recurrence_type != 'none'
                
                meetings.append(meeting_entry)
            
            logger.info(f"✅ Get_Host_Meetings: Returning {len(meetings)} meetings")
            
            return JsonResponse({
                "success": True,
                "user_id": user_id,
                "user_name": user_name,
                "count": len(meetings),
                "filters_applied": {"start_date": start_date_str, "end_date": end_date_str},
                "data": meetings
            }, status=SUCCESS_STATUS)
            
    except Exception as e:
        logger.error(f"Error fetching host meetings: {e}")
        logger.error(traceback.format_exc())
        return JsonResponse({"success": False, "error": str(e)}, status=SERVER_ERROR_STATUS)

@require_http_methods(["GET"])
@csrf_exempt
def Get_Participant_Meetings(request, user_id):
    """
    Get all meetings where the specified user is a PARTICIPANT (not host)
    With time filters support
    FIXED: Uses Join_Times for actual meeting time instead of session_start_time (DATE only)
    FIXED: Removed duplicate rows caused by host JOIN
    
    GET /api/meetings/participant/<user_id>/?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
    """
    try:
        if not user_id:
            return JsonResponse({
                "success": False,
                "error": "user_id is required"
            }, status=BAD_REQUEST_STATUS)
        
        start_date_str = request.GET.get('start_date')
        end_date_str = request.GET.get('end_date')
        
        start_date_only = None
        end_date_only = None
        
        if start_date_str:
            start_date_only = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        
        if end_date_str:
            end_date_only = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        elif start_date_only:
            end_date_only = start_date_only
        
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT ID, full_name FROM tbl_Users WHERE ID = %s AND Status = 1",
                [user_id]
            )
            user = cursor.fetchone()
            
            if not user:
                return JsonResponse({
                    "success": False,
                    "error": "User not found or inactive"
                }, status=NOT_FOUND_STATUS)
            
            user_name = user[1]
            
            # FIXED QUERY: 
            # 1. Uses p.session_start_time for date filtering
            # 2. host_p JOIN uses occurrence_number for ALL meeting types to avoid duplicates
            query = """
                SELECT 
                    m.ID AS meeting_id,
                    m.Meeting_Type AS meeting_type,
                    CASE 
                        WHEN m.Meeting_Type = 'ScheduleMeeting' THEN COALESCE(sm.title, m.Meeting_Name)
                        WHEN m.Meeting_Type = 'CalendarMeeting' THEN COALESCE(cm.title, m.Meeting_Name)
                        ELSE m.Meeting_Name
                    END AS meeting_name,
                    CASE 
                        WHEN m.Meeting_Type = 'ScheduleMeeting' THEN COALESCE(m.Started_At, sm.start_time, m.Created_At)
                        WHEN m.Meeting_Type = 'CalendarMeeting' THEN COALESCE(cm.startTime, m.Started_At, m.Created_At)
                        ELSE COALESCE(m.Started_At, m.Created_At)
                    END AS start_date,
                    COALESCE(host_p.Full_Name, 'Unknown Host') AS host_name,
                    p.Total_Duration_Minutes AS total_duration,
                    p.Participant_Attendance AS participant_attendance,
                    p.occurrence_number,
                    CASE 
                        WHEN m.Meeting_Type = 'ScheduleMeeting' THEN sm.recurrence_type
                        ELSE NULL
                    END AS recurrence_type,
                    CASE 
                        WHEN m.Meeting_Type = 'ScheduleMeeting' THEN sm.duration_minutes
                        WHEN m.Meeting_Type = 'CalendarMeeting' THEN cm.duration
                        ELSE NULL
                    END AS scheduled_duration,
                    CASE 
                        WHEN m.Meeting_Type = 'CalendarMeeting' THEN cm.endTime
                        WHEN m.Meeting_Type = 'ScheduleMeeting' THEN sm.end_time
                        ELSE m.Ended_At
                    END AS end_time,
                    p.Overall_Attendance,
                    p.Is_Currently_Active,
                    p.Join_Times,
                    p.session_start_time
                FROM tbl_Participants p
                JOIN tbl_Meetings m ON p.Meeting_ID = m.ID
                LEFT JOIN tbl_ScheduledMeetings sm ON m.ID = sm.id AND m.Meeting_Type = 'ScheduleMeeting'
                LEFT JOIN tbl_CalendarMeetings cm ON m.ID = cm.ID AND m.Meeting_Type = 'CalendarMeeting'
                LEFT JOIN tbl_Participants host_p ON m.ID = host_p.Meeting_ID 
                    AND host_p.Role = 'host'
                    AND host_p.occurrence_number = p.occurrence_number
                WHERE p.User_ID = %s 
                    AND p.Role = 'participant'
            """
            params = [user_id]
            
            # FIXED: Use p.session_start_time for date filtering
            if start_date_only and end_date_only:
                query += " AND p.session_start_time >= %s AND p.session_start_time <= %s"
                params.extend([start_date_only, end_date_only])
            elif start_date_only:
                query += " AND p.session_start_time >= %s"
                params.append(start_date_only)
            
            query += " ORDER BY p.session_start_time DESC, p.occurrence_number DESC"
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            meetings = []
            for row in rows:
                meeting_type = row[1]
                start_date_value = row[3]
                join_times_raw = row[13]
                session_start_date = row[14]  # This is DATE only
                
                # FIXED: Extract actual time from Join_Times for ALL meeting types
                if join_times_raw:
                    join_times_parsed = safe_json_parse(join_times_raw)
                    if join_times_parsed and isinstance(join_times_parsed, list) and len(join_times_parsed) > 0:
                        first_join = join_times_parsed[0]
                        if isinstance(first_join, str):
                            for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S.%f']:
                                try:
                                    start_date_value = datetime.strptime(first_join, fmt)
                                    break
                                except ValueError:
                                    continue
                
                # If start_date_value is still showing midnight (00:00), try Join_Times
                if start_date_value and hasattr(start_date_value, 'hour'):
                    if start_date_value.hour == 0 and start_date_value.minute == 0 and join_times_raw:
                        join_times_parsed = safe_json_parse(join_times_raw)
                        if join_times_parsed and isinstance(join_times_parsed, list) and len(join_times_parsed) > 0:
                            first_join = join_times_parsed[0]
                            if isinstance(first_join, str):
                                for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S.%f']:
                                    try:
                                        start_date_value = datetime.strptime(first_join, fmt)
                                        break
                                    except ValueError:
                                        continue
                
                # Format start_date properly
                if start_date_value:
                    if hasattr(start_date_value, 'strftime'):
                        formatted_start = start_date_value.strftime('%Y-%m-%d %H:%M:%S')
                    else:
                        formatted_start = str(start_date_value)
                else:
                    formatted_start = None
                
                end_time = row[10]
                formatted_end = end_time.strftime('%Y-%m-%d %H:%M:%S') if end_time and hasattr(end_time, 'strftime') else str(end_time) if end_time else None
                
                total_duration = float(row[5]) if row[5] is not None else 0.0
                participant_attendance = float(row[6]) if row[6] is not None else 0.0
                occurrence_number = row[7]
                recurrence_type = row[8]
                scheduled_duration = row[9]
                overall_attendance = float(row[11]) if row[11] is not None else 0.0
                is_active = bool(row[12]) if row[12] is not None else False
                
                meeting_entry = {
                    'meeting_id': row[0],
                    'host_name': row[4],
                    'meeting_type': meeting_type,
                    'meeting_name': row[2],
                    'start_date': formatted_start,
                    'end_date': formatted_end,
                    'total_duration_minutes': round(total_duration, 2),
                    'scheduled_duration_minutes': scheduled_duration,
                    'participant_attendance': round(participant_attendance, 2),
                    'overall_attendance': round(overall_attendance, 2),
                    'is_active': is_active
                }
                
                # Add occurrence details for ScheduleMeeting
                if meeting_type == 'ScheduleMeeting':
                    meeting_entry['occurrence_number'] = occurrence_number
                    meeting_entry['recurrence_type'] = recurrence_type
                    meeting_entry['is_recurring'] = recurrence_type and recurrence_type != 'none'
                
                meetings.append(meeting_entry)
            
            logger.info(f"✅ Retrieved {len(meetings)} meetings for participant user_id={user_id}")
            
            return JsonResponse({
                "success": True,
                "user_id": user_id,
                "user_name": user_name,
                "count": len(meetings),
                "filters_applied": {
                    "start_date": start_date_str,
                    "end_date": end_date_str
                },
                "data": meetings
            }, status=SUCCESS_STATUS)
            
    except Exception as e:
        logger.error(f"Error fetching participant meetings for user {user_id}: {e}")
        logger.error(traceback.format_exc())
        return JsonResponse({
            "success": False,
            "error": f"Failed to fetch meeting data: {str(e)}"
        }, status=SERVER_ERROR_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def Get_Meeting_Participants(request, meeting_id):
    """
    Get all participants for a specific meeting
    
    For ScheduleMeeting:
    - If occurrence_number provided: Returns participants for that specific occurrence
    - If occurrence_number NOT provided: Returns ALL participants from ALL occurrences
    
    GET /api/meetings/<meeting_id>/participants/?occurrence_number=1
    """
    try:
        if not meeting_id:
            return JsonResponse({
                "success": False,
                "error": "meeting_id is required"
            }, status=BAD_REQUEST_STATUS)
        
        occurrence_number_param = request.GET.get('occurrence_number')
        
        logger.info(f"📊 Get_Meeting_Participants - meeting_id: {meeting_id}, occurrence_number: {occurrence_number_param}")
        
        with connection.cursor() as cursor:
            # Get meeting details
            cursor.execute("""
                SELECT 
                    m.ID, 
                    CASE 
                        WHEN m.Meeting_Type = 'ScheduleMeeting' THEN COALESCE(sm.title, m.Meeting_Name)
                        WHEN m.Meeting_Type = 'CalendarMeeting' THEN COALESCE(cm.title, m.Meeting_Name)
                        ELSE m.Meeting_Name
                    END AS meeting_name,
                    m.Meeting_Type,
                    CASE 
                        WHEN m.Meeting_Type = 'ScheduleMeeting' THEN sm.recurrence_type
                        ELSE NULL
                    END AS recurrence_type,
                    CASE 
                        WHEN m.Meeting_Type = 'ScheduleMeeting' THEN sm.is_recurring
                        ELSE 0
                    END AS is_recurring
                FROM tbl_Meetings m
                LEFT JOIN tbl_ScheduledMeetings sm ON m.ID = sm.id AND m.Meeting_Type = 'ScheduleMeeting'
                LEFT JOIN tbl_CalendarMeetings cm ON m.ID = cm.ID AND m.Meeting_Type = 'CalendarMeeting'
                WHERE m.ID = %s
            """, [meeting_id])
            meeting = cursor.fetchone()
            
            if not meeting:
                return JsonResponse({
                    "success": False,
                    "error": "Meeting not found"
                }, status=NOT_FOUND_STATUS)
            
            meeting_name = meeting[1]
            meeting_type = meeting[2]
            recurrence_type = meeting[3]
            is_recurring = bool(meeting[4]) and recurrence_type and recurrence_type != 'none'
            
            # Get available occurrences for ScheduleMeeting
            available_occurrences = []
            if meeting_type == 'ScheduleMeeting':
                cursor.execute("""
                    SELECT 
                        occurrence_number,
                        session_start_time,
                        COUNT(DISTINCT CASE WHEN Role = 'participant' THEN User_ID END) as participant_count
                    FROM tbl_Participants
                    WHERE Meeting_ID = %s AND occurrence_number IS NOT NULL
                    GROUP BY occurrence_number, session_start_time
                    ORDER BY occurrence_number ASC
                """, [meeting_id])
                
                for occ in cursor.fetchall():
                    available_occurrences.append({
                        'occurrence_number': occ[0],
                        'session_date': occ[1].strftime('%Y-%m-%d') if occ[1] and hasattr(occ[1], 'strftime') else str(occ[1]) if occ[1] else None,
                        'participant_count': occ[2] or 0
                    })
            
            # Build query - ALWAYS return participants
            query = """
                SELECT 
                    p.User_ID,
                    p.Full_Name,
                    p.Participant_Attendance,
                    p.occurrence_number,
                    p.session_start_time,
                    p.Total_Duration_Minutes,
                    p.Overall_Attendance,
                    p.Is_Currently_Active,
                    p.Join_Times
                FROM tbl_Participants p
                WHERE p.Meeting_ID = %s
                    AND p.Role = 'participant'
            """
            params = [meeting_id]
            
            # FIXED: Only filter by occurrence if explicitly provided
            selected_occurrence = None
            if occurrence_number_param:
                selected_occurrence = int(occurrence_number_param)
                logger.info(f"📊 Using provided occurrence_number: {selected_occurrence}")
                query += " AND p.occurrence_number = %s"
                params.append(selected_occurrence)
            else:
                # FIXED: Don't default to any occurrence - return all participants
                # Each participant row has occurrence_number for frontend to use
                logger.info(f"📊 No occurrence specified, returning all participants")
            
            query += " ORDER BY p.occurrence_number ASC, p.Full_Name ASC"
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            logger.info(f"📊 Found {len(rows)} participants")
            
            participants = []
            for row in rows:
                participant_attendance = float(row[2]) if row[2] is not None else 0.0
                total_duration = float(row[5]) if row[5] is not None else 0.0
                overall_attendance = float(row[6]) if row[6] is not None else 0.0
                session_start = row[4]
                join_times_raw = row[8]
                
                actual_join_time = None
                if join_times_raw:
                    join_times_parsed = safe_json_parse(join_times_raw)
                    if join_times_parsed and isinstance(join_times_parsed, list) and len(join_times_parsed) > 0:
                        actual_join_time = join_times_parsed[0]
                
                participant_entry = {
                    'user_id': row[0],
                    'participant_name': row[1],
                    'participant_attendance': round(participant_attendance, 2),
                    'total_duration_minutes': round(total_duration, 2),
                    'overall_attendance': round(overall_attendance, 2),
                    'is_active': bool(row[7]) if row[7] is not None else False
                }
                
                # FIXED: Always include occurrence_number for ALL meeting types
                participant_entry['occurrence_number'] = row[3]
                participant_entry['session_start_time'] = session_start.strftime('%Y-%m-%d') if session_start and hasattr(session_start, 'strftime') else str(session_start) if session_start else None
                participant_entry['actual_join_time'] = actual_join_time
                
                participants.append(participant_entry)
            
            logger.info(f"✅ Returning {len(participants)} participants")
            
            response_data = {
                "success": True,
                "meeting_id": meeting_id,
                "meeting_name": meeting_name,
                "meeting_type": meeting_type,
                "count": len(participants),
                "data": participants
            }
            
            if meeting_type == 'ScheduleMeeting':
                response_data['is_recurring'] = is_recurring
                response_data['recurrence_type'] = recurrence_type
                response_data['available_occurrences'] = available_occurrences
                response_data['current_occurrence'] = selected_occurrence
            
            return JsonResponse(response_data, status=SUCCESS_STATUS)
            
    except Exception as e:
        logger.error(f"Error fetching participants for meeting {meeting_id}: {e}")
        logger.error(traceback.format_exc())
        return JsonResponse({
            "success": False,
            "error": f"Failed to fetch participants: {str(e)}"
        }, status=SERVER_ERROR_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def get_available_meeting_times(request):
    """
    Get available meeting times for dropdown selection
    FIXED: Uses p.session_start_time for date filtering and Join_Times for actual time
    """
    try:
        user_id = request.GET.get("user_id") or request.GET.get("userId")
        start_date = request.GET.get("start_date")
        end_date = request.GET.get("end_date")
        role_type = request.GET.get("role_type", "participant")

        if not user_id:
            return JsonResponse({
                "error": "user_id is required",
                "success": False
            }, status=400)
        
        if not start_date:
            return JsonResponse({
                "error": "start_date is required",
                "success": False
            }, status=400)

        try:
            start_date_only = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date_only = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else start_date_only
        except ValueError as e:
            return JsonResponse({
                "error": f"Invalid date format. Use YYYY-MM-DD. Error: {str(e)}",
                "success": False
            }, status=400)

        if role_type not in ["participant", "host"]:
            role_type = "participant"

        logging.info(f"📊 get_available_meeting_times: user={user_id}, role={role_type}, dates={start_date_only} to {end_date_only}")

        meeting_times = []
        date_meeting_counts = {}
        seen_entries = set()

        with connection.cursor() as cursor:
            
            if role_type == "participant":
                # FIXED: Use >= and <= for inclusive date filtering
                cursor.execute("""
                    SELECT 
                        m.ID AS meeting_id, 
                        CASE 
                            WHEN m.Meeting_Type = 'ScheduleMeeting' THEN COALESCE(sm.title, m.Meeting_Name)
                            WHEN m.Meeting_Type = 'CalendarMeeting' THEN COALESCE(cm.title, m.Meeting_Name)
                            ELSE m.Meeting_Name
                        END AS meeting_name,
                        m.Meeting_Type,
                        p.Total_Duration_Minutes AS total_duration,
                        p.session_start_time AS meeting_date,
                        p.occurrence_number,
                        CASE 
                            WHEN m.Meeting_Type = 'ScheduleMeeting' THEN sm.recurrence_type
                            ELSE NULL
                        END AS recurrence_type,
                        p.Join_Times
                    FROM tbl_Participants p
                    JOIN tbl_Meetings m ON p.Meeting_ID = m.ID
                    LEFT JOIN tbl_ScheduledMeetings sm ON m.ID = sm.id AND m.Meeting_Type = 'ScheduleMeeting'
                    LEFT JOIN tbl_CalendarMeetings cm ON m.ID = cm.ID AND m.Meeting_Type = 'CalendarMeeting'
                    WHERE p.User_ID = %s 
                      AND p.Role = 'participant'
                      AND p.session_start_time >= %s 
                      AND p.session_start_time <= %s
                    ORDER BY p.session_start_time DESC, p.occurrence_number DESC
                """, [user_id, start_date_only, end_date_only])
                
            else:
                # HOST query - FIXED
                cursor.execute("""
                    SELECT 
                        m.ID AS meeting_id, 
                        CASE 
                            WHEN m.Meeting_Type = 'ScheduleMeeting' THEN COALESCE(sm.title, m.Meeting_Name)
                            WHEN m.Meeting_Type = 'CalendarMeeting' THEN COALESCE(cm.title, m.Meeting_Name)
                            ELSE m.Meeting_Name
                        END AS meeting_name,
                        m.Meeting_Type,
                        (SELECT COUNT(*) FROM tbl_Participants p2 
                         WHERE p2.Meeting_ID = m.ID AND p2.Role = 'participant'
                         AND (m.Meeting_Type != 'ScheduleMeeting' OR p2.occurrence_number = p.occurrence_number)
                        ) AS participant_count,
                        p.session_start_time AS meeting_date,
                        p.occurrence_number,
                        CASE 
                            WHEN m.Meeting_Type = 'ScheduleMeeting' THEN sm.recurrence_type
                            ELSE NULL
                        END AS recurrence_type,
                        p.Join_Times
                    FROM tbl_Meetings m
                    LEFT JOIN tbl_ScheduledMeetings sm ON m.ID = sm.id AND m.Meeting_Type = 'ScheduleMeeting'
                    LEFT JOIN tbl_CalendarMeetings cm ON m.ID = cm.ID AND m.Meeting_Type = 'CalendarMeeting'
                    INNER JOIN tbl_Participants p ON m.ID = p.Meeting_ID AND p.Role = 'host'
                    WHERE p.User_ID = %s
                      AND p.session_start_time >= %s 
                      AND p.session_start_time <= %s
                    ORDER BY p.session_start_time DESC, p.occurrence_number DESC
                """, [user_id, start_date_only, end_date_only])

            rows = cursor.fetchall()
            logging.info(f"📊 Query returned {len(rows)} rows for user {user_id}, dates {start_date_only} to {end_date_only}")

            # Count meetings per date
            for row in rows:
                meeting_date = row[4]
                if meeting_date:
                    date_str = meeting_date.strftime('%Y-%m-%d') if hasattr(meeting_date, 'strftime') else str(meeting_date)
                    date_meeting_counts[date_str] = date_meeting_counts.get(date_str, 0) + 1

            # Process each row
            for row in rows:
                meeting_id = row[0]
                meeting_name = row[1]
                meeting_type = row[2]
                duration_or_count = row[3]
                meeting_date = row[4]
                occurrence_number = row[5]
                recurrence_type = row[6]
                join_times_raw = row[7]
                
                # Create unique key for deduplication
                unique_key = f"{meeting_id}_{occurrence_number if occurrence_number else 'null'}"
                if unique_key in seen_entries:
                    continue
                seen_entries.add(unique_key)
                
                # FIXED: Extract actual time from Join_Times for ALL meeting types
                meeting_start_time = None
                if join_times_raw:
                    join_times = safe_json_parse(join_times_raw)
                    if join_times and isinstance(join_times, list) and len(join_times) > 0:
                        first_join = join_times[0]
                        if isinstance(first_join, str):
                            for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S.%f']:
                                try:
                                    meeting_start_time = datetime.strptime(first_join, fmt)
                                    break
                                except ValueError:
                                    continue
                
                # Skip if no Join_Times
                if not meeting_start_time:
                    logging.warning(f"📊 Skipping {meeting_type} {meeting_id} occ {occurrence_number} - no Join_Times")
                    continue
                
                date_str = meeting_date.strftime('%Y-%m-%d') if hasattr(meeting_date, 'strftime') else str(meeting_date)
                
                type_display = {
                    "InstantMeeting": "Instant", 
                    "ScheduleMeeting": "Scheduled", 
                    "CalendarMeeting": "Calendar"
                }.get(meeting_type, meeting_type)
                
                date_display = meeting_start_time.strftime("%b %d")
                time_display = meeting_start_time.strftime("%I:%M %p")
                date_count = date_meeting_counts.get(date_str, 1)

                # Build label with occurrence info
                occurrence_label = ""
                if occurrence_number and occurrence_number > 1:
                    occurrence_label = f" [Session #{occurrence_number}]"
                elif meeting_type == 'ScheduleMeeting' and recurrence_type and recurrence_type != 'none':
                    occurrence_label = f" [Occ #{occurrence_number}]"
                
                if role_type == "participant":
                    duration = f"{int(duration_or_count)}m" if duration_or_count else "0m"
                    label = f"{date_display} | {time_display} - {meeting_name} ({type_display}){occurrence_label} - {duration}"
                else:
                    participant_count = int(duration_or_count) if duration_or_count else 0
                    participant_text = "participant" if participant_count == 1 else "participants"
                    label = f"{date_display} | {time_display} - {meeting_name} ({type_display}){occurrence_label} - {participant_count} {participant_text}"

                meeting_obj = {
                    "meeting_id": meeting_id,
                    "meeting_name": meeting_name,
                    "meeting_type": meeting_type,
                    "date": date_str,
                    "date_display": date_display,
                    "time": meeting_start_time.strftime("%H:%M"),
                    "display_time": time_display,
                    "datetime_for_filter": meeting_start_time.strftime("%Y-%m-%d %H:%M"),
                    "full_datetime": meeting_start_time.isoformat(),
                    "meetings_on_date": date_count,
                    "label": label,
                    "role": role_type,
                    "started_at": meeting_start_time.isoformat(),
                    "occurrence_number": occurrence_number
                }
                
                # Add recurrence details for ScheduleMeeting
                if meeting_type == 'ScheduleMeeting':
                    meeting_obj['recurrence_type'] = recurrence_type
                    meeting_obj['is_recurring'] = recurrence_type and recurrence_type != 'none'
                
                meeting_times.append(meeting_obj)

        # Build date summary
        date_summary = []
        for date_str, count in sorted(date_meeting_counts.items(), reverse=True):
            try:
                date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                date_summary.append({
                    "date": date_str,
                    "date_display": date_obj.strftime("%b %d, %Y"),
                    "day_of_week": date_obj.strftime("%A"),
                    "meeting_count": count
                })
            except ValueError:
                pass

        logging.info(f"✅ Returning {len(meeting_times)} meetings for user {user_id} (role={role_type})")
        
        return JsonResponse({
            "success": True,
            "data": meeting_times,
            "count": len(meeting_times),
            "date_summary": date_summary,
            "date_range": {
                "start": start_date_only.isoformat(), 
                "end": end_date_only.isoformat()
            }
        })

    except Exception as e:
        error_message = str(e)
        logging.error(f"❌ Error in get_available_meeting_times: {error_message}")
        logging.error(traceback.format_exc())
        
        return JsonResponse({
            "error": error_message,
            "success": False
        }, status=500)

@require_http_methods(["GET"])
@csrf_exempt
def Generate_Participant_Report_PDF_For_Meeting(request, meeting_id, user_id):
    """
    Generate PDF report for a specific participant in a specific meeting
    
    GET /api/meetings/<meeting_id>/participants/<user_id>/report/pdf/?occurrence_number=1
    
    FIXED: 
    - Handles ScheduleMeeting with occurrence_number
    - Uses Join_Times for actual meeting time (not session_start_time which is DATE only)
    - Shows Overall Attendance for recurring ScheduleMeeting
    - Removed occurrence display from header
    - FIXED: SQL parameter order bug
    """
    try:
        if not meeting_id or not user_id:
            return JsonResponse({"success": False, "error": "meeting_id and user_id are required"}, status=BAD_REQUEST_STATUS)
        
        # Get occurrence_number from query params (for ScheduleMeeting)
        occurrence_number_param = request.GET.get('occurrence_number')
        
        # ✅ DEBUG LOG
        logger.info(f"📊 PDF Report requested - meeting_id: {meeting_id}, user_id: {user_id}, occurrence_number_param: {occurrence_number_param}")
        
        with connection.cursor() as cursor:
            # Get meeting details with proper joins for all meeting types
            cursor.execute("""
                SELECT 
                    m.ID, 
                    CASE 
                        WHEN m.Meeting_Type = 'ScheduleMeeting' THEN COALESCE(sm.title, m.Meeting_Name)
                        WHEN m.Meeting_Type = 'CalendarMeeting' THEN COALESCE(cm.title, m.Meeting_Name)
                        ELSE m.Meeting_Name
                    END AS meeting_name,
                    m.Meeting_Type, 
                    m.Started_At, 
                    m.Created_At,
                    sm.recurrence_type,
                    sm.is_recurring,
                    sm.start_time AS scheduled_start_time,
                    sm.recurrence_end_date,
                    sm.recurrence_occurrences,
                    cm.startTime AS calendar_start_time
                FROM tbl_Meetings m
                LEFT JOIN tbl_ScheduledMeetings sm ON m.ID = sm.id AND m.Meeting_Type = 'ScheduleMeeting'
                LEFT JOIN tbl_CalendarMeetings cm ON m.ID = cm.ID AND m.Meeting_Type = 'CalendarMeeting'
                WHERE m.ID = %s
            """, [meeting_id])
            meeting = cursor.fetchone()
            
            if not meeting:
                return JsonResponse({"error": "Meeting not found"}, status=NOT_FOUND_STATUS)
            
            meeting_name = meeting[1]
            meeting_type = meeting[2]
            meeting_started_at = meeting[3]
            meeting_created_at = meeting[4]
            recurrence_type = meeting[5]
            is_recurring = bool(meeting[6]) and recurrence_type and recurrence_type != 'none'
            scheduled_start_time = meeting[7]
            recurrence_end_date = meeting[8]
            recurrence_occurrences = meeting[9]
            calendar_start_time = meeting[10]
            
            # For ScheduleMeeting, determine which occurrence to use
            selected_occurrence = None
            
            if meeting_type == 'ScheduleMeeting':
                # Use occurrence_number from query param if provided
                if occurrence_number_param:
                    selected_occurrence = int(occurrence_number_param)
                    logger.info(f"📊 Using occurrence_number from param: {selected_occurrence}")
                else:
                    # Default to occurrence 1 if not specified
                    cursor.execute("""
                        SELECT MIN(occurrence_number)
                        FROM tbl_Participants 
                        WHERE Meeting_ID = %s AND User_ID = %s AND Role = 'participant' AND occurrence_number IS NOT NULL
                    """, [meeting_id, user_id])
                    min_occ = cursor.fetchone()
                    selected_occurrence = int(min_occ[0]) if min_occ and min_occ[0] else 1
                    logger.info(f"📊 Using default occurrence_number: {selected_occurrence}")
            
            # ✅ FIXED: Build participant query based on meeting type
            if meeting_type == 'ScheduleMeeting' and selected_occurrence:
                logger.info(f"📊 Querying ScheduleMeeting with occurrence_number: {selected_occurrence}")
                
                cursor.execute("""
                    SELECT p.User_ID, p.Full_Name, p.Participant_Attendance, p.Join_Times, p.Leave_Times,
                        p.Total_Duration_Minutes, p.Total_Sessions, p.Overall_Attendance, p.Attendance_Percentagebasedon_host,
                        ats.detection_counts, ats.popup_count, ats.attendance_penalty, ats.break_used, ats.violations,
                        ats.engagement_score, ats.attendance_percentage, ats.break_count, ats.break_sessions,
                        ats.total_break_time_used, ats.identity_warning_count, ats.identity_warnings,
                        ats.identity_removal_count, ats.identity_total_warnings_issued, ats.behavior_removal_count,
                        ats.continuous_violation_removal_count,
                        p.occurrence_number,
                        p.session_start_time
                    FROM tbl_Participants p
                    LEFT JOIN tbl_Attendance_Sessions ats 
                        ON p.Meeting_ID = ats.Meeting_ID 
                        AND p.User_ID = ats.User_ID
                    WHERE p.Meeting_ID = %s 
                        AND p.User_ID = %s 
                        AND p.Role = 'participant'
                        AND p.occurrence_number = %s
                """, [meeting_id, user_id, selected_occurrence])
            else:
                # Standard query for InstantMeeting and CalendarMeeting
                logger.info(f"📊 Querying {meeting_type} (no occurrence filter)")
                
                cursor.execute("""
                    SELECT p.User_ID, p.Full_Name, p.Participant_Attendance, p.Join_Times, p.Leave_Times,
                        p.Total_Duration_Minutes, p.Total_Sessions, p.Overall_Attendance, p.Attendance_Percentagebasedon_host,
                        ats.detection_counts, ats.popup_count, ats.attendance_penalty, ats.break_used, ats.violations,
                        ats.engagement_score, ats.attendance_percentage, ats.break_count, ats.break_sessions,
                        ats.total_break_time_used, ats.identity_warning_count, ats.identity_warnings,
                        ats.identity_removal_count, ats.identity_total_warnings_issued, ats.behavior_removal_count,
                        ats.continuous_violation_removal_count,
                        p.occurrence_number,
                        p.session_start_time
                    FROM tbl_Participants p
                    LEFT JOIN tbl_Attendance_Sessions ats 
                        ON p.Meeting_ID = ats.Meeting_ID 
                        AND p.User_ID = ats.User_ID
                    WHERE p.Meeting_ID = %s 
                        AND p.User_ID = %s 
                        AND p.Role = 'participant'
                """, [meeting_id, user_id])
            
            row = cursor.fetchone()
            
            if not row:
                logger.warning(f"📊 Participant not found - meeting_id: {meeting_id}, user_id: {user_id}, occurrence: {selected_occurrence}")
                return JsonResponse({"error": "Participant not found in this meeting"}, status=NOT_FOUND_STATUS)
            
            # ✅ DEBUG: Log what we got from DB
            logger.info(f"📊 Found participant data - Duration: {row[5]}, Attendance: {row[2]}, occurrence_from_db: {row[25] if len(row) > 25 else 'N/A'}")
            
            full_name = row[1]
            participant_attendance = float(row[2]) if row[2] is not None else 0.0
            join_times_raw = row[3]
            overall_attendance = float(row[7]) if row[7] is not None else 0.0
            occurrence_number_from_db = row[25] if len(row) > 25 else None
            session_start_date = row[26] if len(row) > 26 else None
            
            # Determine meeting date - extract from Join_Times for actual datetime
            meeting_date = None
            
            # First try to get from Join_Times (has actual time)
            if join_times_raw:
                join_times_parsed = safe_json_parse(join_times_raw)
                if join_times_parsed and isinstance(join_times_parsed, list) and len(join_times_parsed) > 0:
                    first_join = join_times_parsed[0]
                    if isinstance(first_join, str):
                        for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S.%f']:
                            try:
                                meeting_date = datetime.strptime(first_join, fmt)
                                break
                            except ValueError:
                                continue
            
            # Fallback to other sources if Join_Times didn't work
            if not meeting_date:
                if meeting_type == 'CalendarMeeting' and calendar_start_time:
                    meeting_date = calendar_start_time
                elif meeting_type == 'ScheduleMeeting' and scheduled_start_time:
                    meeting_date = scheduled_start_time
                elif meeting_started_at:
                    meeting_date = meeting_started_at
                elif meeting_created_at:
                    meeting_date = meeting_created_at
        
        # =====================================================================
        # PDF GENERATION STARTS HERE
        # =====================================================================
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, leftMargin=40, rightMargin=40, topMargin=70, bottomMargin=70)
        
        report_gen = ReportGenerator()
        story = []
        
        main_section_style = ParagraphStyle(name='MainSectionHeader', fontName='Helvetica-Bold', fontSize=14,
            textColor=colors.HexColor('#2C3E50'), spaceBefore=15, spaceAfter=10)
        
        cell_style = ParagraphStyle(name='CellStyle', fontName='Helvetica', fontSize=7, leading=9, wordWrap='CJK')
        header_cell_style = ParagraphStyle(name='HeaderCellStyle', fontName='Helvetica-Bold', fontSize=7, leading=9, textColor=colors.white, wordWrap='CJK')
        section_title_style = ParagraphStyle(name="SectionTitle", fontName="Helvetica-Bold", fontSize=11, textColor=colors.HexColor('#2C3E50'), spaceBefore=15, spaceAfter=8)
        table_sub_section_style = ParagraphStyle(name="TableSubSection", fontName="Helvetica-Bold", fontSize=9, textColor=colors.HexColor('#7F8C8D'), spaceBefore=10, spaceAfter=5)
        
        def P(text, style=cell_style):
            return Paragraph(str(text) if text else '', style)
        
        def PH(text):
            return Paragraph(str(text) if text else '', header_cell_style)
        
        # Title
        title = Paragraph("Participant Attendance Report", report_gen.custom_styles['ReportTitle'])
        story.append(title)
        story.append(Spacer(1, 10))
        
        # Meeting Info Header - NO occurrence display
        meeting_type_display = {
            'InstantMeeting': 'Instant Meeting',
            'ScheduleMeeting': 'Scheduled Meeting',
            'CalendarMeeting': 'Calendar Meeting'
        }.get(meeting_type, meeting_type)
        
        meeting_info_text = f"<b>Meeting:</b> {meeting_name} | <b>Type:</b> {meeting_type_display}"
        
        if meeting_date:
            meeting_info_text += f" | <b>Date:</b> {meeting_date.strftime('%Y-%m-%d %H:%M') if hasattr(meeting_date, 'strftime') else str(meeting_date)}"
        
        # Add recurrence type for recurring meetings (but NOT occurrence number)
        if is_recurring and recurrence_type:
            recurrence_display = recurrence_type.replace('_', ' ').title()
            meeting_info_text += f" | <b>Recurrence:</b> {recurrence_display}"
        
        story.append(Paragraph(meeting_info_text, ParagraphStyle('MeetingInfo', fontSize=10, spaceAfter=5)))
        story.append(Paragraph(f"<b>Participant:</b> {full_name}", ParagraphStyle('ParticipantInfo', fontSize=10, spaceAfter=15)))
        story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#2C3E50'), spaceBefore=0, spaceAfter=15))
        
        # =====================================================================
        # PARTICIPATION DETAILS
        # =====================================================================
        part_elements = []
        part_elements.append(Paragraph("Participation Details", main_section_style))
        part_elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#3498DB'), spaceBefore=0, spaceAfter=10))
        
        participation_data = [['Metric', 'Value']]
        
        duration = float(row[5]) if row[5] is not None else 0.0
        if is_valid_value(duration):
            participation_data.append(['Duration', f"{round(duration, 2)} minutes"])
        
        join_times = safe_json_parse(row[3])
        if is_valid_value(join_times):
            if isinstance(join_times, list):
                join_times_str = '<br/>'.join([format_timestamp(t) or str(t) for t in join_times])
            else:
                join_times_str = str(join_times)
            participation_data.append(['Join Times', Paragraph(join_times_str, cell_style)])

        leave_times = safe_json_parse(row[4])
        if is_valid_value(leave_times):
            if isinstance(leave_times, list):
                leave_times_str = '<br/>'.join([format_timestamp(t) or str(t) for t in leave_times])
            else:
                leave_times_str = str(leave_times)
            participation_data.append(['Leave Times', Paragraph(leave_times_str, cell_style)])

        if is_valid_value(participant_attendance):
            participation_data.append(['Participant Attendance', f"{round(participant_attendance, 2)}%"])
        
        # Add Overall Attendance for recurring ScheduleMeeting only
        if is_recurring and meeting_type == 'ScheduleMeeting' and is_valid_value(overall_attendance):
            participation_data.append(['Overall Attendance (All Occurrences)', f"{round(overall_attendance, 2)}%"])
        
        if len(participation_data) > 1:
            participation_table = Table(participation_data, colWidths=[3*inch, 3.5*inch])
            participation_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498DB')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#EBF5FB')]),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            part_elements.append(participation_table)
        else:
            part_elements.append(Paragraph("No participation data available.", report_gen.styles['Normal']))
        
        part_elements.append(Spacer(1, 15))
        story.append(KeepTogether(part_elements))
        
        # =====================================================================
        # ATTENDANCE MONITORING & BEHAVIOR
        # =====================================================================
        monitoring_data = [['Metric', 'Value']]
        
        popup_count = int(row[10]) if row[10] is not None else 0
        if is_valid_value(popup_count): monitoring_data.append(['Popup Count', str(popup_count)])
        
        attendance_penalty = float(row[11]) if row[11] is not None else 0.0
        if is_valid_value(attendance_penalty): monitoring_data.append(['Attendance Penalty', f"{round(attendance_penalty, 2)}%"])
        
        break_used = bool(row[12]) if row[12] is not None else False
        if break_used: monitoring_data.append(['Break Used', 'Yes'])
        
        engagement_score = int(row[14]) if row[14] is not None else 0
        if is_valid_value(engagement_score): monitoring_data.append(['Engagement Score', f"{engagement_score} / 100"])
        
        attendance_percentage = float(row[15]) if row[15] is not None else 0.0
        if is_valid_value(attendance_percentage): monitoring_data.append(['Attendance Percentage', f"{round(attendance_percentage, 2)}%"])
        
        break_count = int(row[16]) if row[16] is not None else 0
        if is_valid_value(break_count): monitoring_data.append(['Break Count', str(break_count)])
        
        total_break_time = int(row[18]) if row[18] is not None else 0
        if is_valid_value(total_break_time): monitoring_data.append(['Total Break Time Used', f"{total_break_time} seconds"])
        
        identity_warning_count = int(row[19]) if row[19] is not None else 0
        if is_valid_value(identity_warning_count): monitoring_data.append(['Identity Warning Count', str(identity_warning_count)])
        
        identity_removal_count = int(row[21]) if row[21] is not None else 0
        if is_valid_value(identity_removal_count): monitoring_data.append(['Identity Removal Count', str(identity_removal_count)])
        
        identity_total_warnings = int(row[22]) if row[22] is not None else 0
        if is_valid_value(identity_total_warnings): monitoring_data.append(['Identity Total Warnings Issued', str(identity_total_warnings)])
        
        behavior_removal_count = int(row[23]) if row[23] is not None else 0
        if is_valid_value(behavior_removal_count): monitoring_data.append(['Behavior Removal Count', str(behavior_removal_count)])
        
        continuous_violation_removal = int(row[24]) if row[24] is not None else 0
        if is_valid_value(continuous_violation_removal): monitoring_data.append(['Continuous Violation Removal Count', str(continuous_violation_removal)])
        
        if len(monitoring_data) > 1:
            monitoring_elements = []
            monitoring_elements.append(Paragraph("Attendance Monitoring & Behavior", main_section_style))
            monitoring_elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#E74C3C'), spaceBefore=0, spaceAfter=10))
            
            monitoring_table = Table(monitoring_data, colWidths=[3*inch, 3.5*inch])
            monitoring_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E74C3C')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#FADBD8')]),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            monitoring_elements.append(monitoring_table)
            monitoring_elements.append(Spacer(1, 15))
            story.append(KeepTogether(monitoring_elements))
        
        # =====================================================================
        # DETECTION COUNTS
        # =====================================================================
        detection_counts_data = safe_json_parse(row[9])
        if detection_counts_data and isinstance(detection_counts_data, dict):
            filtered_detection = {}
            for key, value in detection_counts_data.items():
                if key in ['last_detection_time', 'camera_verified_at'] and value:
                    formatted_time = format_timestamp(value)
                    if formatted_time: filtered_detection[key] = formatted_time
                elif is_valid_value(value):
                    filtered_detection[key] = value
            
            if filtered_detection:
                dc_elements = []
                dc_elements.append(Paragraph("Detection Counts", section_title_style))
                
                dc_rows = [[PH('Field'), PH('Value')]]
                for key, value in filtered_detection.items():
                    dc_rows.append([P(str(key)), P(str(value))])
                
                dc_table = Table(dc_rows, colWidths=[3*inch, 3.5*inch], repeatRows=1)
                dc_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34495E')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#EAECEE')]),
                    ('LEFTPADDING', (0, 0), (-1, -1), 6),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                    ('TOPPADDING', (0, 0), (-1, -1), 5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ]))
                dc_elements.append(dc_table)
                dc_elements.append(Spacer(1, 15))
                story.append(KeepTogether(dc_elements))
        
        # =====================================================================
        # VIOLATIONS DATA
        # =====================================================================
        violations_data = safe_json_parse(row[13])
        if violations_data and isinstance(violations_data, dict):
            warnings = violations_data.get('warnings', [])
            detections = violations_data.get('detections', []) or violations_data.get('detection_events', [])
            removals = violations_data.get('continuous_removals', []) or violations_data.get('removals', [])
            
            has_warnings = warnings and len(warnings) > 0
            has_detections = detections and len(detections) > 0
            has_removals = removals and len(removals) > 0
            
            if has_warnings or has_detections or has_removals:
                if has_warnings:
                    warn_elements = []
                    warn_elements.append(Paragraph("Violations Data", section_title_style))
                    warn_elements.append(Spacer(1, 8))
                    warn_elements.append(Paragraph("Warnings Table", table_sub_section_style))
                    
                    warn_rows = [[PH('#'), PH('Timestamp'), PH('Violation Type'), PH('Duration'), PH('Time Range'), PH('Message')]]
                    for i, w in enumerate(warnings, 1):
                        if isinstance(w, dict):
                            warn_rows.append([
                                P(str(i)),
                                P(format_timestamp(w.get('timestamp', '')) or 'N/A'),
                                P(str(w.get('violation_type', 'N/A'))),
                                P(f"{round(float(w.get('duration', 0)), 2)}s"),
                                P(str(w.get('time_range', 'N/A'))),
                                P(str(w.get('message', 'N/A'))[:40])
                            ])
                    
                    warn_table = Table(warn_rows, colWidths=[0.4*inch, 1.2*inch, 1.1*inch, 0.7*inch, 0.7*inch, 2.4*inch], repeatRows=1)
                    warn_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F39C12')),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#FEF9E7')]),
                        ('LEFTPADDING', (0, 0), (-1, -1), 4),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                        ('TOPPADDING', (0, 0), (-1, -1), 5),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                    ]))
                    warn_elements.append(warn_table)
                    warn_elements.append(Spacer(1, 12))
                    story.append(KeepTogether(warn_elements))
                elif has_detections or has_removals:
                    story.append(Paragraph("Violations Data", section_title_style))
                    story.append(Spacer(1, 8))
                
                if has_detections:
                    det_elements = []
                    det_elements.append(Paragraph("Detection Events Table", table_sub_section_style))
                    
                    det_rows = [[PH('#'), PH('Timestamp'), PH('Violation Type'), PH('Duration'), PH('Penalty'), PH('Message')]]
                    for i, d in enumerate(detections, 1):
                        if isinstance(d, dict):
                            det_rows.append([
                                P(str(i)),
                                P(format_timestamp(d.get('timestamp', '')) or 'N/A'),
                                P(str(d.get('violation_type', 'N/A'))),
                                P(f"{round(float(d.get('duration', 0)), 2)}s"),
                                P(f"{round(float(d.get('penalty_applied', 0)), 2)}%"),
                                P(str(d.get('message', 'N/A'))[:40])
                            ])
                    
                    det_table = Table(det_rows, colWidths=[0.4*inch, 1.2*inch, 1.1*inch, 0.7*inch, 0.7*inch, 2.4*inch], repeatRows=1)
                    det_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498DB')),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#EBF5FB')]),
                        ('LEFTPADDING', (0, 0), (-1, -1), 4),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                        ('TOPPADDING', (0, 0), (-1, -1), 5),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                    ]))
                    det_elements.append(det_table)
                    det_elements.append(Spacer(1, 12))
                    story.append(KeepTogether(det_elements))
                
                if has_removals:
                    rem_elements = []
                    rem_elements.append(Paragraph("Continuous Removals Table", table_sub_section_style))
                    
                    rem_rows = [[PH('#'), PH('Timestamp'), PH('Violation Type'), PH('Duration'), PH('Penalty'), PH('Message')]]
                    for i, r in enumerate(removals, 1):
                        if isinstance(r, dict):
                            rem_rows.append([
                                P(str(i)),
                                P(format_timestamp(r.get('timestamp', '')) or 'N/A'),
                                P(str(r.get('violation_type', 'N/A'))),
                                P(f"{round(float(r.get('duration', 0)), 2)}s"),
                                P(str(round(float(r.get('penalty', 0)), 2))),
                                P(str(r.get('message', 'N/A'))[:40])
                            ])
                    
                    rem_table = Table(rem_rows, colWidths=[0.4*inch, 1.2*inch, 1.1*inch, 0.7*inch, 0.7*inch, 2.4*inch], repeatRows=1)
                    rem_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E74C3C')),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#FADBD8')]),
                        ('LEFTPADDING', (0, 0), (-1, -1), 4),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                        ('TOPPADDING', (0, 0), (-1, -1), 5),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                    ]))
                    rem_elements.append(rem_table)
                    rem_elements.append(Spacer(1, 12))
                    story.append(KeepTogether(rem_elements))
        
        # =====================================================================
        # BREAK SESSIONS
        # =====================================================================
        break_sessions_data = safe_json_parse(row[17])
        if break_sessions_data and isinstance(break_sessions_data, list) and len(break_sessions_data) > 0:
            bs_elements = []
            bs_elements.append(Paragraph("Break Sessions", section_title_style))
            
            bs_rows = [[PH('Break #'), PH('Start Time'), PH('End Time'), PH('Duration (sec)')]]
            for i, bs in enumerate(break_sessions_data, 1):
                if isinstance(bs, dict):
                    start_time = bs.get('start_time', bs.get('start', ''))
                    end_time = bs.get('end_time', bs.get('end', ''))
                    duration_val = bs.get('duration', 0)
                    
                    bs_rows.append([
                        P(str(i)),
                        P(format_timestamp(start_time) if start_time else str(start_time)),
                        P(format_timestamp(end_time) if end_time else str(end_time)),
                        P(str(round(float(duration_val), 2)) if duration_val else '0')
                    ])
            
            bs_table = Table(bs_rows, colWidths=[0.8*inch, 2.2*inch, 2.2*inch, 1.3*inch], repeatRows=1)
            bs_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#27AE60')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#E8F8F5')]),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            bs_elements.append(bs_table)
            bs_elements.append(Spacer(1, 15))
            story.append(KeepTogether(bs_elements))
        
        # =====================================================================
        # IDENTITY WARNINGS
        # =====================================================================
        identity_warnings_data = safe_json_parse(row[20])
        if identity_warnings_data and isinstance(identity_warnings_data, list) and len(identity_warnings_data) > 0:
            iw_elements = []
            iw_elements.append(Paragraph("Identity Warnings", section_title_style))
            
            iw_rows = [[PH('#'), PH('Timestamp'), PH('Cycle #'), PH('Total #'), PH('Consec. Sec'), PH('Similarity'), PH('Unknown Sec'), PH('Cycle'), PH('ID Rem'), PH('Beh Rem')]]
            for i, iw in enumerate(identity_warnings_data, 1):
                if isinstance(iw, dict):
                    iw_rows.append([
                        P(str(i)),
                        P(format_timestamp(iw.get('timestamp', '')) or 'N/A'),
                        P(str(iw.get('cycle_warning', iw.get('cycle_warning_number', 'N/A')))),
                        P(str(iw.get('total_warning', iw.get('total_warning_number', 'N/A')))),
                        P(str(iw.get('consecutive_seconds', 'N/A'))),
                        P(str(round(float(iw.get('similarity_score', 0)), 2)) if iw.get('similarity_score') else 'N/A'),
                        P(str(iw.get('total_unknown_seconds', 'N/A'))),
                        P(str(iw.get('removal_cycle', 'N/A'))),
                        P(str(iw.get('identity_removals', 'N/A'))),
                        P(str(iw.get('behavior_removals', 'N/A')))
                    ])
            
            iw_table = Table(iw_rows, colWidths=[0.35*inch, 1.1*inch, 0.5*inch, 0.5*inch, 0.65*inch, 0.65*inch, 0.7*inch, 0.5*inch, 0.5*inch, 0.55*inch], repeatRows=1)
            iw_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#9B59B6')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5EEF8')]),
                ('LEFTPADDING', (0, 0), (-1, -1), 3),
                ('RIGHTPADDING', (0, 0), (-1, -1), 3),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ]))
            iw_elements.append(iw_table)
            iw_elements.append(Spacer(1, 15))
            story.append(KeepTogether(iw_elements))
        
        # =====================================================================
        # BUILD PDF
        # =====================================================================
        def add_page_number(canvas, doc):
            report_gen.create_header_footer(canvas, doc, "Participant Attendance Report")
        
        doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
        
        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        
        # Filename without occurrence number
        filename = f"participant_report_{full_name.replace(' ', '_')}_{meeting_id[:8]}_{datetime.now().strftime('%Y%m%d')}.pdf"
        
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        logger.info(f"✅ PDF Report generated successfully for {full_name} - occurrence: {selected_occurrence}")
        
        return response
        
    except Exception as e:
        logger.error(f"Error generating participant PDF report: {e}")
        logger.error(traceback.format_exc())
        return JsonResponse({"error": f"Failed to generate report: {str(e)}"}, status=SERVER_ERROR_STATUS)

@require_http_methods(["GET"])
@csrf_exempt
def Get_Participant_Report_For_Meeting(request, meeting_id, user_id):
    """
    Get detailed report data for a specific participant in a specific meeting
    
    GET /api/meetings/<meeting_id>/participants/<user_id>/report/
    GET /api/meetings/<meeting_id>/participants/<user_id>/report/?occurrence_number=1
    
    UPDATED: 
    - Handles ScheduleMeeting with occurrence_number filtering
    - For recurring ScheduleMeeting: filters by occurrence_number and shows Overall Attendance
    - Uses Join_Times for actual meeting time
    - Matches the logic in Generate_Participant_Report_PDF_For_Meeting
    """
    try:
        if not meeting_id or not user_id:
            return JsonResponse({"success": False, "error": "meeting_id and user_id are required"}, status=BAD_REQUEST_STATUS)
        
        # ✅ NEW: Get occurrence_number from query params (for ScheduleMeeting)
        occurrence_number_param = request.GET.get('occurrence_number')
        
        # ✅ DEBUG LOG
        logger.info(f"📊 Report Data requested - meeting_id: {meeting_id}, user_id: {user_id}, occurrence_number_param: {occurrence_number_param}")
        
        with connection.cursor() as cursor:
            # ✅ UPDATED: Get meeting details with proper joins for all meeting types
            cursor.execute("""
                SELECT 
                    m.ID, 
                    CASE 
                        WHEN m.Meeting_Type = 'ScheduleMeeting' THEN COALESCE(sm.title, m.Meeting_Name)
                        WHEN m.Meeting_Type = 'CalendarMeeting' THEN COALESCE(cm.title, m.Meeting_Name)
                        ELSE m.Meeting_Name
                    END AS meeting_name,
                    m.Meeting_Type, 
                    m.Started_At, 
                    m.Created_At,
                    sm.recurrence_type,
                    sm.is_recurring,
                    sm.start_time AS scheduled_start_time,
                    cm.startTime AS calendar_start_time
                FROM tbl_Meetings m
                LEFT JOIN tbl_ScheduledMeetings sm ON m.ID = sm.id AND m.Meeting_Type = 'ScheduleMeeting'
                LEFT JOIN tbl_CalendarMeetings cm ON m.ID = cm.ID AND m.Meeting_Type = 'CalendarMeeting'
                WHERE m.ID = %s
            """, [meeting_id])
            meeting = cursor.fetchone()
            
            if not meeting:
                return JsonResponse({"success": False, "error": "Meeting not found"}, status=NOT_FOUND_STATUS)
            
            meeting_name = meeting[1]
            meeting_type = meeting[2]
            meeting_started_at = meeting[3]
            meeting_created_at = meeting[4]
            recurrence_type = meeting[5]
            is_recurring = bool(meeting[6]) and recurrence_type and recurrence_type != 'none'
            scheduled_start_time = meeting[7]
            calendar_start_time = meeting[8]
            
            # ✅ NEW: For ScheduleMeeting, determine which occurrence to use
            selected_occurrence = None
            
            if meeting_type == 'ScheduleMeeting':
                # Use occurrence_number from query param if provided
                if occurrence_number_param:
                    selected_occurrence = int(occurrence_number_param)
                    logger.info(f"📊 Using occurrence_number from param: {selected_occurrence}")
                else:
                    # Default to first occurrence if not specified
                    cursor.execute("""
                        SELECT MIN(occurrence_number)
                        FROM tbl_Participants 
                        WHERE Meeting_ID = %s AND User_ID = %s AND Role = 'participant' AND occurrence_number IS NOT NULL
                    """, [meeting_id, user_id])
                    min_occ = cursor.fetchone()
                    selected_occurrence = int(min_occ[0]) if min_occ and min_occ[0] else 1
                    logger.info(f"📊 Using default occurrence_number: {selected_occurrence}")
            
            # ✅ UPDATED: Build participant query based on meeting type
            if meeting_type == 'ScheduleMeeting' and selected_occurrence:
                logger.info(f"📊 Querying ScheduleMeeting with occurrence_number: {selected_occurrence}")
                
                cursor.execute("""
                    SELECT p.User_ID, p.Full_Name, p.Participant_Attendance, p.Join_Times, p.Leave_Times,
                        p.Total_Duration_Minutes, p.Total_Sessions, p.Overall_Attendance, p.Attendance_Percentagebasedon_host,
                        ats.detection_counts, ats.popup_count, ats.attendance_penalty, ats.break_used, ats.violations,
                        ats.engagement_score, ats.attendance_percentage, ats.break_count, ats.break_sessions,
                        ats.total_break_time_used, ats.identity_warning_count, ats.identity_warnings,
                        ats.identity_removal_count, ats.identity_total_warnings_issued, ats.behavior_removal_count,
                        ats.continuous_violation_removal_count,
                        p.occurrence_number,
                        p.session_start_time
                    FROM tbl_Participants p
                    LEFT JOIN tbl_Attendance_Sessions ats 
                        ON p.Meeting_ID = ats.Meeting_ID 
                        AND p.User_ID = ats.User_ID
                    WHERE p.Meeting_ID = %s 
                        AND p.User_ID = %s 
                        AND p.Role = 'participant'
                        AND p.occurrence_number = %s
                """, [meeting_id, user_id, selected_occurrence])
            else:
                # Standard query for InstantMeeting and CalendarMeeting
                logger.info(f"📊 Querying {meeting_type} (no occurrence filter)")
                
                cursor.execute("""
                    SELECT p.User_ID, p.Full_Name, p.Participant_Attendance, p.Join_Times, p.Leave_Times,
                        p.Total_Duration_Minutes, p.Total_Sessions, p.Overall_Attendance, p.Attendance_Percentagebasedon_host,
                        ats.detection_counts, ats.popup_count, ats.attendance_penalty, ats.break_used, ats.violations,
                        ats.engagement_score, ats.attendance_percentage, ats.break_count, ats.break_sessions,
                        ats.total_break_time_used, ats.identity_warning_count, ats.identity_warnings,
                        ats.identity_removal_count, ats.identity_total_warnings_issued, ats.behavior_removal_count,
                        ats.continuous_violation_removal_count,
                        NULL as occurrence_number,
                        NULL as session_start_time
                    FROM tbl_Participants p
                    LEFT JOIN tbl_Attendance_Sessions ats 
                        ON p.Meeting_ID = ats.Meeting_ID 
                        AND p.User_ID = ats.User_ID
                    WHERE p.Meeting_ID = %s 
                        AND p.User_ID = %s 
                        AND p.Role = 'participant'
                """, [meeting_id, user_id])
            
            row = cursor.fetchone()
            
            if not row:
                logger.warning(f"📊 Participant not found - meeting_id: {meeting_id}, user_id: {user_id}, occurrence: {selected_occurrence}")
                return JsonResponse({"success": False, "error": "Participant not found in this meeting"}, status=NOT_FOUND_STATUS)
            
            # ✅ DEBUG: Log what we got from DB
            logger.info(f"📊 Found participant data - Duration: {row[5]}, Attendance: {row[2]}, occurrence_from_db: {row[25] if len(row) > 25 else 'N/A'}")
            
            full_name = row[1]
            participant_attendance = float(row[2]) if row[2] is not None else 0.0
            overall_attendance = float(row[7]) if row[7] is not None else 0.0
            
            # ✅ NEW: Determine meeting date from Join_Times for actual datetime
            meeting_date = None
            join_times_raw = row[3]
            
            if join_times_raw:
                join_times_parsed = safe_json_parse(join_times_raw)
                if join_times_parsed and isinstance(join_times_parsed, list) and len(join_times_parsed) > 0:
                    first_join = join_times_parsed[0]
                    if isinstance(first_join, str):
                        for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S.%f']:
                            try:
                                meeting_date = datetime.strptime(first_join, fmt)
                                break
                            except ValueError:
                                continue
            
            # Fallback to other sources
            if not meeting_date:
                if meeting_type == 'CalendarMeeting' and calendar_start_time:
                    meeting_date = calendar_start_time
                elif meeting_type == 'ScheduleMeeting' and scheduled_start_time:
                    meeting_date = scheduled_start_time
                elif meeting_started_at:
                    meeting_date = meeting_started_at
                elif meeting_created_at:
                    meeting_date = meeting_created_at
            
            # =====================================================================
            # BUILD PARTICIPATION DETAILS
            # =====================================================================
            participation_details = {}
            
            duration = float(row[5]) if row[5] is not None else 0.0
            if is_valid_value(duration):
                participation_details['duration_minutes'] = round(duration, 2)
                participation_details['total_duration'] = f"{round(duration, 2)} minutes"
            
            join_times = safe_json_parse(row[3])
            if is_valid_value(join_times): 
                participation_details['join_times'] = join_times
            
            leave_times = safe_json_parse(row[4])
            if is_valid_value(leave_times): 
                participation_details['leave_times'] = leave_times
            
            if is_valid_value(participant_attendance):
                participation_details['participant_attendance'] = f"{round(participant_attendance, 2)}%"
            
            # ✅ UPDATED: Add Overall Attendance for recurring ScheduleMeeting only
            if is_recurring and meeting_type == 'ScheduleMeeting' and is_valid_value(overall_attendance):
                participation_details['overall_attendance'] = f"{round(overall_attendance, 2)}%"
            
            # =====================================================================
            # BUILD ATTENDANCE MONITORING
            # =====================================================================
            attendance_monitoring = {}
            
            if is_valid_value(int(row[10] or 0)): 
                attendance_monitoring['popup_count'] = int(row[10])
            if is_valid_value(float(row[11] or 0)): 
                attendance_monitoring['attendance_penalty'] = f"{round(float(row[11]), 2)}%"
            if row[12]: 
                attendance_monitoring['break_used'] = 'Yes'
            if is_valid_value(int(row[14] or 0)): 
                attendance_monitoring['engagement_score'] = f"{int(row[14])} / 100"
            if is_valid_value(float(row[15] or 0)): 
                attendance_monitoring['attendance_percentage'] = f"{round(float(row[15]), 2)}%"
            if is_valid_value(int(row[16] or 0)): 
                attendance_monitoring['break_count'] = int(row[16])
            if is_valid_value(int(row[18] or 0)): 
                attendance_monitoring['total_break_time_used'] = f"{int(row[18])} seconds"
            if is_valid_value(int(row[19] or 0)): 
                attendance_monitoring['identity_warning_count'] = int(row[19])
            if is_valid_value(int(row[21] or 0)): 
                attendance_monitoring['identity_removal_count'] = int(row[21])
            if is_valid_value(int(row[22] or 0)): 
                attendance_monitoring['identity_total_warnings_issued'] = int(row[22])
            if is_valid_value(int(row[23] or 0)): 
                attendance_monitoring['behavior_removal_count'] = int(row[23])
            if is_valid_value(int(row[24] or 0)): 
                attendance_monitoring['continuous_violation_removal_count'] = int(row[24])
            
            # =====================================================================
            # BUILD DETECTION COUNTS
            # =====================================================================
            detection_counts = {}
            detection_counts_raw = safe_json_parse(row[9])
            if detection_counts_raw and isinstance(detection_counts_raw, dict):
                for key, value in detection_counts_raw.items():
                    if key in ['last_detection_time', 'camera_verified_at'] and value:
                        formatted_time = format_timestamp(value)
                        if formatted_time: 
                            detection_counts[key] = formatted_time
                    elif is_valid_value(value):
                        detection_counts[key] = value
            
            # =====================================================================
            # BUILD VIOLATIONS DATA
            # =====================================================================
            violations_data = {}
            violations_raw = safe_json_parse(row[13])
            if violations_raw and isinstance(violations_raw, dict):
                warnings = violations_raw.get('warnings', [])
                detections = violations_raw.get('detections', []) or violations_raw.get('detection_events', [])
                removals = violations_raw.get('continuous_removals', []) or violations_raw.get('removals', [])
                
                if warnings and len(warnings) > 0: 
                    violations_data['warnings'] = warnings
                if detections and len(detections) > 0: 
                    violations_data['detections'] = detections
                if removals and len(removals) > 0: 
                    violations_data['continuous_removals'] = removals
            
            # =====================================================================
            # BUILD BREAK SESSIONS
            # =====================================================================
            break_sessions = safe_json_parse(row[17])
            if not (break_sessions and len(break_sessions) > 0): 
                break_sessions = None
            
            # =====================================================================
            # BUILD IDENTITY WARNINGS
            # =====================================================================
            identity_warnings = safe_json_parse(row[20])
            if not (identity_warnings and len(identity_warnings) > 0): 
                identity_warnings = None
            
            # =====================================================================
            # BUILD FINAL REPORT DATA
            # =====================================================================
            report_data = {}
            if participation_details: 
                report_data['participation_details'] = participation_details
            if attendance_monitoring: 
                report_data['attendance_monitoring'] = attendance_monitoring
            if detection_counts: 
                report_data['detection_counts'] = detection_counts
            if violations_data: 
                report_data['violations_data'] = violations_data
            if break_sessions: 
                report_data['break_sessions'] = break_sessions
            if identity_warnings: 
                report_data['identity_warnings'] = identity_warnings
            
            # =====================================================================
            # BUILD RESPONSE
            # =====================================================================
            response_data = {
                "success": True,
                "meeting_id": meeting_id,
                "meeting_name": meeting_name,
                "meeting_type": meeting_type,
                "is_recurring": is_recurring,
                "user_id": user_id,
                "participant_name": full_name,
                "participant_attendance": round(participant_attendance, 2),
                "report_data": report_data
            }
            
            # ✅ NEW: Add occurrence-specific info for ScheduleMeeting
            if meeting_type == 'ScheduleMeeting':
                response_data['occurrence_number'] = selected_occurrence
                response_data['current_occurrence'] = selected_occurrence
                
                if is_recurring and is_valid_value(overall_attendance):
                    response_data['overall_attendance'] = round(overall_attendance, 2)
            
            # ✅ NEW: Add recurrence info
            if is_recurring and recurrence_type:
                response_data['recurrence_type'] = recurrence_type
            
            # ✅ NEW: Add meeting date
            if meeting_date:
                if hasattr(meeting_date, 'strftime'):
                    response_data['meeting_date'] = meeting_date.strftime('%Y-%m-%d %H:%M:%S')
                else:
                    response_data['meeting_date'] = str(meeting_date)
            
            logger.info(f"✅ Report data generated successfully for {full_name} - occurrence: {selected_occurrence}")
            
            return JsonResponse(response_data, status=SUCCESS_STATUS)
            
    except Exception as e:
        logger.error(f"Error fetching participant report: {e}")
        logger.error(traceback.format_exc())
        return JsonResponse({"success": False, "error": str(e)}, status=SERVER_ERROR_STATUS)

@require_http_methods(["GET"])
@csrf_exempt
def get_participant_started_at_times(request):
    """
    Get only Started_At times for a specific participant in a specific meeting
    
    Returns first join_time (which is Started_At from tbl_Meetings)
    """
    try:
        meeting_id = request.GET.get("meeting_id")
        user_id = request.GET.get("user_id")

        if not meeting_id or not user_id:
            return JsonResponse({
                "error": "meeting_id and user_id are required",
                "success": False
            }, status=400)

        with connection.cursor() as cursor:
            # Get meeting Started_At and participant info
            cursor.execute("""
                SELECT 
                    m.ID,
                    m.Meeting_Name,
                    m.Started_At,
                    m.Ended_At,
                    p.Join_Times,
                    p.Total_Duration_Minutes
                FROM tbl_Meetings m
                LEFT JOIN tbl_Participants p ON m.ID = p.Meeting_ID AND p.User_ID = %s
                WHERE m.ID = %s
            """, [user_id, meeting_id])

            row = cursor.fetchone()

            if not row:
                return JsonResponse({
                    "error": "Meeting or participant not found",
                    "success": False
                }, status=404)

            meeting_id = row[0]
            meeting_name = row[1]
            started_at = row[2]
            ended_at = row[3]
            join_times_raw = row[4]
            total_duration = row[5]

            # Extract first join time from Join_Times JSON array
            first_join_time = None
            if join_times_raw:
                try:
                    import json
                    if isinstance(join_times_raw, str):
                        join_times = json.loads(join_times_raw)
                    else:
                        join_times = join_times_raw
                    
                    if isinstance(join_times, list) and len(join_times) > 0:
                        first_join_time = join_times[0]
                except:
                    pass

            return JsonResponse({
                "success": True,
                "data": {
                    "meeting_id": meeting_id,
                    "meeting_name": meeting_name,
                    "started_at": started_at.isoformat() if started_at else None,
                    "ended_at": ended_at.isoformat() if ended_at else None,
                    "first_join_time": first_join_time,  # First element from Join_Times array
                    "total_duration_minutes": float(total_duration) if total_duration else 0
                }
            })

    except Exception as e:
        logger.error(f"❌ Error: {e}")
        return JsonResponse({
            "error": str(e),
            "success": False
        }, status=500)

@require_http_methods(["GET"])
@csrf_exempt
def get_host_dashboard_overview(request):
    """Enhanced host dashboard overview"""
    try:
        user_id = request.GET.get('user_id') or request.GET.get('userId') or request.GET.get('host_id')
        timeframe = request.GET.get('timeframe', '7days')
        meeting_type = request.GET.get('meetingType') or request.GET.get('meeting_type', 'all')

        if not user_id:
            return JsonResponse({"error": "user_id is required"}, status=BAD_REQUEST_STATUS)

        ist_timezone = pytz.timezone('Asia/Kolkata')
        end_date = timezone.now().astimezone(ist_timezone)
        
        if timeframe == '7days': start_date = end_date - timedelta(days=7)
        elif timeframe == '30days': start_date = end_date - timedelta(days=30)
        elif timeframe == '90days': start_date = end_date - timedelta(days=90)
        elif timeframe == '1year': start_date = end_date - timedelta(days=365)
        else: return JsonResponse({"error": "Invalid timeframe"}, status=BAD_REQUEST_STATUS)

        with connection.cursor() as cursor:
            query = """
                SELECT 
                    COUNT(DISTINCT m.ID) as total_meetings,
                    COUNT(DISTINCT p.User_ID) as total_participants,
                    AVG(p.Total_Duration_Minutes) as avg_duration_minutes,
                    AVG(p.Participant_Attendance) as avg_participant_attendance,
                    AVG(p.Overall_Attendance) as avg_overall_attendance,
                    AVG(ats.popup_count) as avg_popup_count,
                    AVG(ats.total_detections) as avg_detections,
                    AVG(ats.attendance_penalty) as avg_penalty,
                    AVG(ats.total_break_time_used) as avg_break_time,
                    AVG(ats.engagement_score) as avg_engagement_score,
                    SUM(CASE WHEN ats.break_used = 1 THEN 1 ELSE 0 END) as total_breaks_used,
                    COUNT(CASE WHEN m.Status = 'active' THEN 1 END) as active_meetings,
                    COUNT(CASE WHEN m.Status = 'ended' THEN 1 END) as ended_meetings,
                    COUNT(CASE WHEN m.Status = 'scheduled' THEN 1 END) as scheduled_meetings
                FROM tbl_Meetings m
                LEFT JOIN tbl_Participants p ON m.ID = p.Meeting_ID
                LEFT JOIN tbl_Attendance_Sessions ats ON m.ID = ats.Meeting_ID
                WHERE m.Host_ID = %s AND m.Created_At BETWEEN %s AND %s
            """
            
            params = [user_id, start_date, end_date]
            if meeting_type != 'all':
                query += " AND m.Meeting_Type = %s"
                params.append(meeting_type)

            cursor.execute(query, params)
            result = cursor.fetchone()

        data = {
            "total_meetings": int(result[0] or 0),
            "total_participants": int(result[1] or 0),
            "average_duration_minutes": round(float(result[2] or 0), 2),
            "avg_participant_attendance": round(float(result[3] or 0), 2),
            "avg_overall_attendance": round(float(result[4] or 0), 2),
            "attendance_monitoring": {
                "avg_popup_count": round(float(result[5] or 0), 2),
                "avg_detections": round(float(result[6] or 0), 2),
                "avg_penalty": round(float(result[7] or 0), 2),
                "avg_break_time_minutes": round(float(result[8] or 0), 2),
                "avg_engagement_score": round(float(result[9] or 0), 2),
                "total_breaks_used": int(result[10] or 0)
            },
            "meeting_status_breakdown": {
                "active_meetings": int(result[11] or 0),
                "ended_meetings": int(result[12] or 0),
                "scheduled_meetings": int(result[13] or 0)
            }
        }
        
        return JsonResponse({"data": data}, status=SUCCESS_STATUS)
    except Exception as e:
        logging.error(f"Error fetching enhanced host overview: {e}")
        return JsonResponse({"error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

@require_http_methods(["GET"])
@csrf_exempt
def get_comprehensive_meeting_analytics(request):
    """
    FIXED: Comprehensive analytics that properly filters by user_id
    - Returns ONLY meetings where the specific user participated (not ALL meetings)
    - Properly calculates user-specific stats
    """
    try:
        # Accept multiple parameter names for flexibility
        user_id = request.GET.get('user_id') or request.GET.get('userId')
        meeting_id = request.GET.get('meeting_id') or request.GET.get('meetingId')
        timeframe = request.GET.get('timeframe', '30days')
        meeting_type = request.GET.get('meetingType') or request.GET.get('meeting_type', 'all')
        analytics_type = request.GET.get('analytics_type', 'all')
        page = int(request.GET.get('page', 1))
        limit = int(request.GET.get('limit', 100))
        
        # Handle date range parameters
        date_range_start = (request.GET.get('dateRange[start]') or 
                           request.GET.get('start_date') or
                           request.GET.get('startDate'))
        date_range_end = (request.GET.get('dateRange[end]') or 
                         request.GET.get('end_date') or
                         request.GET.get('endDate'))

        logging.debug(f"Comprehensive analytics request - user_id: {user_id}, meeting_id: {meeting_id}, analytics_type: {analytics_type}")

        # Calculate date range with FIXED inclusive boundaries
        ist_timezone = pytz.timezone('Asia/Kolkata')
        
        if not date_range_end:
            end_date = timezone.now().astimezone(ist_timezone)
        else:
            end_date = datetime.strptime(date_range_end, '%Y-%m-%d').replace(tzinfo=ist_timezone)
            end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            
        if not date_range_start:
            if timeframe == '7days':
                start_date = end_date - timedelta(days=7)
            elif timeframe == '30days':
                start_date = end_date - timedelta(days=30)
            elif timeframe == '90days':
                start_date = end_date - timedelta(days=90)
            elif timeframe == '1year':
                start_date = end_date - timedelta(days=365)
            else:
                start_date = end_date - timedelta(days=30)
        else:
            start_date = datetime.strptime(date_range_start, '%Y-%m-%d').replace(tzinfo=ist_timezone)
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)

        offset = (page - 1) * limit

        with connection.cursor() as cursor:
            
            # Initialize response containers
            participant_data = []
            participant_summary_data = []
            host_data = []
            meeting_data = []
            available_meeting_times = []
            
            # ==================== GET AVAILABLE MEETING TIMES ====================
            if analytics_type in ['all', 'participant'] and user_id:
                logging.info(f"📅 Fetching participant meetings for user {user_id} (Role='participant')")
                
                cursor.execute("""
                    SELECT DISTINCT
                        m.ID as meeting_id,
                        m.Meeting_Name,
                        m.Meeting_Type,
                        COALESCE(
                            m.Started_At,
                            sm.start_time,
                            cm.startTime,
                            m.Created_At
                        ) as meeting_time,
                        p.Total_Duration_Minutes,
                        DATE(COALESCE(
                            m.Started_At,
                            sm.start_time,
                            cm.startTime,
                            m.Created_At
                        )) as meeting_date
                    FROM tbl_Participants p
                    JOIN tbl_Meetings m ON p.Meeting_ID = m.ID
                    LEFT JOIN tbl_ScheduledMeetings sm ON m.ID = sm.id AND m.Meeting_Type = 'ScheduleMeeting'
                    LEFT JOIN tbl_CalendarMeetings cm ON m.ID = cm.ID AND m.Meeting_Type = 'CalendarMeeting'
                    WHERE p.User_ID = %s
                    AND p.Role = 'participant'
                    AND COALESCE(
                        m.Started_At,
                        sm.start_time,
                        cm.startTime,
                        m.Created_At
                    ) BETWEEN %s AND %s
                    ORDER BY meeting_time DESC
                """, [user_id, start_date, end_date])
                
                participant_times = cursor.fetchall()
                logging.info(f"✅ Found {len(participant_times)} participant meetings (Role='participant')")
                
                for row in participant_times:
                    meeting_time = row[3]
                    if meeting_time:
                        type_display = {
                            'InstantMeeting': 'Instant',
                            'ScheduleMeeting': 'Scheduled',
                            'CalendarMeeting': 'Calendar'
                        }.get(row[2], row[2])
                        duration = f"{int(row[4])}m" if row[4] else "N/A"
                        
                        available_meeting_times.append({
                            'meeting_id': row[0],
                            'meeting_name': row[1],
                            'meeting_type': row[2],
                            'date': row[5].isoformat(),
                            'time': meeting_time.strftime('%H:%M'),
                            'display_time': meeting_time.strftime('%I:%M %p'),
                            'datetime_for_filter': meeting_time.strftime('%Y-%m-%d %H:%M'),
                            'label': f"{meeting_time.strftime('%I:%M %p')} - {row[1]} ({type_display}) - {duration}",
                            'role': 'participant'
                        })
            
            elif analytics_type in ['all', 'host'] and user_id:
                logging.info(f"📅 Fetching host meetings for user {user_id} (Host_ID={user_id})")
                
                cursor.execute("""
                    SELECT DISTINCT
                        m.ID as meeting_id,
                        m.Meeting_Name,
                        m.Meeting_Type,
                        COALESCE(
                            m.Started_At,
                            sm.start_time,
                            cm.startTime,
                            m.Created_At
                        ) as meeting_time,
                        COUNT(DISTINCT p.User_ID) as participant_count,
                        DATE(COALESCE(
                            m.Started_At,
                            sm.start_time,
                            cm.startTime,
                            m.Created_At
                        )) as meeting_date
                    FROM tbl_Meetings m
                    LEFT JOIN tbl_ScheduledMeetings sm ON m.ID = sm.id AND m.Meeting_Type = 'ScheduleMeeting'
                    LEFT JOIN tbl_CalendarMeetings cm ON m.ID = cm.ID AND m.Meeting_Type = 'CalendarMeeting'
                    LEFT JOIN tbl_Participants p ON m.ID = p.Meeting_ID
                    WHERE m.Host_ID = %s
                    AND m.Started_At IS NOT NULL
                    AND COALESCE(
                        m.Started_At,
                        sm.start_time,
                        cm.startTime,
                        m.Created_At
                    ) BETWEEN %s AND %s
                    GROUP BY m.ID, m.Meeting_Name, m.Meeting_Type, meeting_time, meeting_date
                    ORDER BY meeting_time DESC
                """, [user_id, start_date, end_date])
                
                host_times = cursor.fetchall()
                logging.info(f"✅ Found {len(host_times)} host meetings (Host_ID={user_id})")
                
                for row in host_times:
                    meeting_time = row[3]
                    if meeting_time:
                        type_display = {
                            'InstantMeeting': 'Instant',
                            'ScheduleMeeting': 'Scheduled',
                            'CalendarMeeting': 'Calendar'
                        }.get(row[2], row[2])
                        
                        available_meeting_times.append({
                            'meeting_id': row[0],
                            'meeting_name': row[1],
                            'meeting_type': row[2],
                            'date': row[5].isoformat(),
                            'time': meeting_time.strftime('%H:%M'),
                            'display_time': meeting_time.strftime('%I:%M %p'),
                            'datetime_for_filter': meeting_time.strftime('%Y-%m-%d %H:%M'),
                            'label': f"{meeting_time.strftime('%I:%M %p')} - {row[1]} ({type_display}) - {row[4]} participants",
                            'role': 'host'
                        })
            
            # ==================== 1. PARTICIPANT DURATION AND ATTENDANCE ANALYTICS ====================
            if analytics_type in ['all', 'participant']:
                participant_analytics_query = """
                    SELECT 
                        p.ID as participant_id,
                        p.Meeting_ID,
                        p.User_ID,
                        p.Full_Name,
                        p.Role,
                        p.Meeting_Type,
                        p.Join_Times,
                        p.Leave_Times,
                        p.Total_Duration_Minutes,
                        p.Total_Sessions,
                        p.End_Meeting_Time,
                        p.Is_Currently_Active,
                        p.Attendance_Percentagebasedon_host,
                        p.Participant_Attendance,
                        p.Overall_Attendance,
                        ats.popup_count,
                        ats.detection_counts,
                        ats.violation_start_times as violation_start_time,
                        ats.total_detections,
                        ats.attendance_penalty,
                        ats.break_used,
                        ats.total_break_time_used,
                        ats.engagement_score,
                        ats.attendance_percentage as session_attendance_percentage,
                        ats.session_active,
                        ats.break_count,
                        ats.focus_score,
                        ats.violation_severity_score,
                        ats.active_participation_time,
                        ats.total_session_time,
                        m.Meeting_Name,
                        m.Status as meeting_status,
                        m.Created_At as meeting_created_at,
                        m.Started_At,
                        m.Ended_At,
                        m.Host_ID,
                        m.Meeting_Link,
                        m.Is_Recording_Enabled,
                        m.Waiting_Room_Enabled
                    FROM tbl_Participants p
                    LEFT JOIN tbl_Attendance_Sessions ats ON p.Meeting_ID = ats.Meeting_ID AND p.User_ID = ats.User_ID
                    LEFT JOIN tbl_Meetings m ON p.Meeting_ID = m.ID
                    LEFT JOIN tbl_ScheduledMeetings sm ON m.ID = sm.id AND m.Meeting_Type = 'ScheduleMeeting'
                    LEFT JOIN tbl_CalendarMeetings cm ON m.ID = cm.ID AND m.Meeting_Type = 'CalendarMeeting'
                    WHERE p.Role = 'participant'
                """
                
                params = []
                if user_id:
                    participant_analytics_query += " AND p.User_ID = %s"
                    params.append(user_id)
                if meeting_id:
                    participant_analytics_query += " AND p.Meeting_ID = %s"
                    params.append(meeting_id)
                if meeting_type != 'all':
                    participant_analytics_query += " AND p.Meeting_Type = %s"
                    params.append(meeting_type)
                
                participant_analytics_query += """ AND COALESCE(
                    m.Started_At,
                    sm.start_time,
                    cm.startTime,
                    m.Created_At
                ) BETWEEN %s AND %s"""
                params.extend([start_date, end_date])
                
                participant_analytics_query += " ORDER BY m.Created_At DESC LIMIT %s OFFSET %s"
                params.extend([limit, offset])
                
                cursor.execute(participant_analytics_query, params)
                for row in cursor.fetchall():
                    participant_data.append({
                        "participant_id": row[0],
                        "meeting_id": row[1],
                        "user_id": row[2],
                        "full_name": row[3],
                        "role": row[4],
                        "meeting_type": row[5],
                        "duration_analysis": {
                            "join_times": json.loads(row[6]) if row[6] else [],
                            "leave_times": json.loads(row[7]) if row[7] else [],
                            "total_duration_minutes": float(row[8] or 0),
                            "total_sessions": int(row[9] or 0),
                            "end_meeting_time": row[10].isoformat() if row[10] else None,
                            "is_currently_active": bool(row[11])
                        },
                        "participant_attendance_data": {
                            "attendance_percentage_based_on_host": float(row[12] or 0),
                            "participant_attendance": float(row[13] or 0),
                            "overall_attendance": float(row[14] or 0)
                        },
                        "attendance_session": {
                            "popup_count": int(row[15] or 0),
                            "detection_counts": row[16],
                            "violation_start_time": row[17],
                            "total_detections": int(row[18] or 0),
                            "attendance_penalty": float(row[19] or 0),
                            "break_used": bool(row[20]),
                            "total_break_time_used": int(row[21] or 0),
                            "engagement_score": int(row[22] or 0),
                            "attendance_percentage": float(row[23] or 0),
                            "session_active": bool(row[24]),
                            "break_count": int(row[25] or 0),
                            "focus_score": float(row[26] or 0),
                            "violation_severity_score": float(row[27] or 0),
                            "active_participation_time": int(row[28] or 0),
                            "total_session_time": int(row[29] or 0)
                        },
                        "meeting_info": {
                            "meeting_name": row[30],
                            "status": row[31],
                            "created_at": row[32].isoformat() if row[32] else None,
                            "started_at": row[33].isoformat() if row[33] else None,
                            "ended_at": row[34].isoformat() if row[34] else None,
                            "host_id": row[35],
                            "meeting_link": row[36],
                            "is_recording_enabled": bool(row[37]),
                            "waiting_room_enabled": bool(row[38])
                        }
                    })

            # ==================== 2. HOST ANALYTICS ====================
            if analytics_type in ['all', 'host']:
                host_analytics_query = """
                    SELECT 
                        m.Host_ID,
                        m.Meeting_Type,
                        COUNT(DISTINCT m.ID) as total_meetings_hosted,
                        COUNT(DISTINCT CASE WHEN m.Status = 'active' THEN m.ID END) as active_meetings,
                        COUNT(DISTINCT CASE WHEN m.Status = 'ended' THEN m.ID END) as ended_meetings,
                        COUNT(DISTINCT CASE WHEN m.Status = 'scheduled' THEN m.ID END) as scheduled_meetings,
                        COUNT(DISTINCT p.User_ID) as total_unique_participants,
                        AVG(p.Total_Duration_Minutes) as avg_meeting_duration_minutes,
                        AVG(p.Participant_Attendance) as avg_participant_attendance,
                        AVG(p.Overall_Attendance) as avg_overall_attendance,
                        SUM(p.Total_Duration_Minutes) as total_hosting_time_minutes,
                        MIN(m.Created_At) as first_meeting_created,
                        MAX(m.Created_At) as last_meeting_created,
                        AVG(ats.popup_count) as avg_popup_count,
                        AVG(ats.total_detections) as avg_total_detections,
                        AVG(ats.attendance_penalty) as avg_attendance_penalty,
                        AVG(ats.engagement_score) as avg_engagement_score,
                        COUNT(CASE WHEN ats.break_used = 1 THEN 1 END) as total_breaks_used
                    FROM tbl_Meetings m
                    LEFT JOIN tbl_ScheduledMeetings sm ON m.ID = sm.id AND m.Meeting_Type = 'ScheduleMeeting'
                    LEFT JOIN tbl_CalendarMeetings cm ON m.ID = cm.ID AND m.Meeting_Type = 'CalendarMeeting'
                    LEFT JOIN tbl_Participants p ON m.ID = p.Meeting_ID
                    LEFT JOIN tbl_Attendance_Sessions ats ON m.ID = ats.Meeting_ID
                    WHERE 1=1
                """
                
                params = []
                if user_id:
                    host_analytics_query += " AND m.Host_ID = %s"
                    params.append(user_id)
                if meeting_type != 'all':
                    host_analytics_query += " AND m.Meeting_Type = %s"
                    params.append(meeting_type)
                
                host_analytics_query += """ AND COALESCE(
                    m.Started_At,
                    sm.start_time,
                    cm.startTime,
                    m.Created_At
                ) BETWEEN %s AND %s"""
                params.extend([start_date, end_date])
                
                host_analytics_query += " GROUP BY m.Host_ID, m.Meeting_Type ORDER BY total_meetings_hosted DESC"
                
                cursor.execute(host_analytics_query, params)
                for row in cursor.fetchall():
                    host_data.append({
                        "host_id": row[0],
                        "meeting_type": row[1],
                        "meeting_counts": {
                            "total_meetings_hosted": int(row[2] or 0),
                            "active_meetings": int(row[3] or 0),
                            "ended_meetings": int(row[4] or 0),
                            "scheduled_meetings": int(row[5] or 0),
                            "completion_rate": round((int(row[4] or 0) / int(row[2] or 1) * 100), 2)
                        },
                        "participant_analytics": {
                            "total_unique_participants": int(row[6] or 0),
                            "avg_meeting_duration_minutes": round(float(row[7] or 0), 2),
                            "avg_participant_attendance": round(float(row[8] or 0), 2),
                            "avg_overall_attendance": round(float(row[9] or 0), 2),
                            "total_hosting_time_minutes": round(float(row[10] or 0), 2)
                        },
                        "activity_period": {
                            "first_meeting_created": row[11].isoformat() if row[11] else None,
                            "last_meeting_created": row[12].isoformat() if row[12] else None
                        },
                        "attendance_monitoring": {
                            "avg_popup_count": round(float(row[13] or 0), 2),
                            "avg_total_detections": round(float(row[14] or 0), 2),
                            "avg_attendance_penalty": round(float(row[15] or 0), 2),
                            "avg_engagement_score": round(float(row[16] or 0), 2),
                            "total_breaks_used": int(row[17] or 0)
                        }
                    })

            # ==================== 3. PARTICIPANT SUMMARY ANALYTICS ====================
            # FIXED: This query now ONLY counts meetings where the user participated as 'participant'
            if analytics_type in ['all', 'participant']:
                participant_summary_query = """
                    SELECT 
                        p.User_ID,
                        p.Full_Name,
                        COUNT(DISTINCT p.Meeting_ID) as total_meetings_attended,
                        SUM(p.Total_Duration_Minutes) as total_participation_time_minutes,
                        AVG(p.Total_Duration_Minutes) as avg_meeting_duration_minutes,
                        AVG(p.Participant_Attendance) as avg_participant_attendance,
                        AVG(p.Overall_Attendance) as avg_overall_attendance,
                        COUNT(DISTINCT CASE WHEN p.Is_Currently_Active = 1 THEN p.Meeting_ID END) as active_meetings,
                        AVG(p.Total_Sessions) as avg_sessions_per_meeting,
                        p.Meeting_Type,
                        MIN(m.Created_At) as first_meeting_joined,
                        MAX(m.Created_At) as last_meeting_joined,
                        AVG(ats.popup_count) as avg_popup_count,
                        AVG(ats.total_detections) as avg_total_detections,
                        AVG(ats.attendance_penalty) as avg_attendance_penalty,
                        AVG(ats.total_break_time_used) as avg_break_time_used,
                        AVG(ats.engagement_score) as avg_engagement_score,
                        AVG(ats.focus_score) as avg_focus_score,
                        COUNT(CASE WHEN ats.break_used = 1 THEN 1 END) as total_breaks_taken
                    FROM tbl_Participants p
                    LEFT JOIN tbl_Attendance_Sessions ats ON p.Meeting_ID = ats.Meeting_ID AND p.User_ID = ats.User_ID
                    LEFT JOIN tbl_Meetings m ON p.Meeting_ID = m.ID
                    LEFT JOIN tbl_ScheduledMeetings sm ON m.ID = sm.id AND m.Meeting_Type = 'ScheduleMeeting'
                    LEFT JOIN tbl_CalendarMeetings cm ON m.ID = cm.ID AND m.Meeting_Type = 'CalendarMeeting'
                    WHERE p.Role = 'participant'
                """
                
                params = []
                # CRITICAL FIX: Always filter by user_id when provided
                if user_id:
                    participant_summary_query += " AND p.User_ID = %s"
                    params.append(user_id)
                if meeting_type != 'all':
                    participant_summary_query += " AND p.Meeting_Type = %s"
                    params.append(meeting_type)
                
                participant_summary_query += """ AND COALESCE(
                    m.Started_At,
                    sm.start_time,
                    cm.startTime,
                    m.Created_At
                ) BETWEEN %s AND %s"""
                params.extend([start_date, end_date])
                
                participant_summary_query += " GROUP BY p.User_ID, p.Full_Name, p.Meeting_Type ORDER BY total_meetings_attended DESC"
                
                cursor.execute(participant_summary_query, params)
                for row in cursor.fetchall():
                    participant_summary_data.append({
                        "user_id": row[0],
                        "full_name": row[1],
                        "meeting_participation": {
                            "total_meetings_attended": int(row[2] or 0),
                            "total_participation_time_minutes": round(float(row[3] or 0), 2),
                            "avg_meeting_duration_minutes": round(float(row[4] or 0), 2),
                            "avg_participant_attendance": round(float(row[5] or 0), 2),
                            "avg_overall_attendance": round(float(row[6] or 0), 2),
                            "active_meetings": int(row[7] or 0),
                            "avg_sessions_per_meeting": round(float(row[8] or 0), 2)
                        },
                        "meeting_type": row[9],
                        "activity_period": {
                            "first_meeting_joined": row[10].isoformat() if row[10] else None,
                            "last_meeting_joined": row[11].isoformat() if row[11] else None
                        },
                        "attendance_analytics": {
                            "avg_popup_count": round(float(row[12] or 0), 2),
                            "avg_total_detections": round(float(row[13] or 0), 2),
                            "avg_attendance_penalty": round(float(row[14] or 0), 2),
                            "avg_break_time_used": round(float(row[15] or 0), 2),
                            "avg_engagement_score": round(float(row[16] or 0), 2),
                            "avg_focus_score": round(float(row[17] or 0), 2),
                            "total_breaks_taken": int(row[18] or 0)
                        }
                    })

            # ==================== 4. MEETING ANALYTICS ====================
            if analytics_type in ['all', 'meeting']:
                meeting_analytics_query = """
                    SELECT 
                        m.ID as meeting_id,
                        m.Meeting_Name,
                        m.Meeting_Type,
                        m.Host_ID,
                        m.Status,
                        m.Created_At,
                        m.Started_At,
                        m.Ended_At,
                        m.Meeting_Link,
                        m.Is_Recording_Enabled,
                        m.Waiting_Room_Enabled,
                        COUNT(DISTINCT p.User_ID) as total_participants,
                        COUNT(DISTINCT CASE WHEN p.Is_Currently_Active = 1 THEN p.User_ID END) as currently_active_participants,
                        AVG(p.Total_Duration_Minutes) as avg_participant_duration_minutes,
                        AVG(p.Participant_Attendance) as avg_participant_attendance,
                        SUM(p.Total_Duration_Minutes) as total_meeting_duration_minutes,
                        MAX(p.Total_Duration_Minutes) as longest_participant_duration,
                        MIN(p.Total_Duration_Minutes) as shortest_participant_duration,
                        AVG(ats.popup_count) as avg_popup_count,
                        AVG(ats.total_detections) as avg_total_detections,
                        AVG(ats.attendance_penalty) as avg_attendance_penalty,
                        AVG(ats.engagement_score) as avg_engagement_score,
                        COUNT(CASE WHEN ats.break_used = 1 THEN 1 END) as total_breaks_in_meeting
                    FROM tbl_Meetings m
                    LEFT JOIN tbl_ScheduledMeetings sm ON m.ID = sm.id AND m.Meeting_Type = 'ScheduleMeeting'
                    LEFT JOIN tbl_CalendarMeetings cm ON m.ID = cm.ID AND m.Meeting_Type = 'CalendarMeeting'
                    LEFT JOIN tbl_Participants p ON m.ID = p.Meeting_ID
                    LEFT JOIN tbl_Attendance_Sessions ats ON m.ID = ats.Meeting_ID
                    WHERE 1=1
                """
                
                params = []
                if meeting_id:
                    meeting_analytics_query += " AND m.ID = %s"
                    params.append(meeting_id)
                if user_id:
                    meeting_analytics_query += " AND m.Host_ID = %s"
                    params.append(user_id)
                if meeting_type != 'all':
                    meeting_analytics_query += " AND m.Meeting_Type = %s"
                    params.append(meeting_type)
                
                meeting_analytics_query += """ AND COALESCE(
                    m.Started_At,
                    sm.start_time,
                    cm.startTime,
                    m.Created_At
                ) BETWEEN %s AND %s"""
                params.extend([start_date, end_date])
                
                meeting_analytics_query += " GROUP BY m.ID ORDER BY m.Created_At DESC"
                
                cursor.execute(meeting_analytics_query, params)
                for row in cursor.fetchall():
                    meeting_data.append({
                        "meeting_id": row[0],
                        "meeting_name": row[1],
                        "meeting_type": row[2],
                        "host_id": row[3],
                        "status": row[4],
                        "created_at": row[5].isoformat() if row[5] else None,
                        "started_at": row[6].isoformat() if row[6] else None,
                        "ended_at": row[7].isoformat() if row[7] else None,
                        "meeting_link": row[8],
                        "is_recording_enabled": bool(row[9]),
                        "waiting_room_enabled": bool(row[10]),
                        "participant_analytics": {
                            "total_participants": int(row[11] or 0),
                            "currently_active_participants": int(row[12] or 0),
                            "avg_participant_duration_minutes": round(float(row[13] or 0), 2),
                            "avg_participant_attendance": round(float(row[14] or 0), 2),
                            "total_meeting_duration_minutes": round(float(row[15] or 0), 2),
                            "longest_participant_duration_minutes": round(float(row[16] or 0), 2),
                            "shortest_participant_duration_minutes": round(float(row[17] or 0), 2)
                        },
                        "attendance_analytics": {
                            "avg_popup_count": round(float(row[18] or 0), 2),
                            "avg_total_detections": round(float(row[19] or 0), 2),
                            "avg_attendance_penalty": round(float(row[20] or 0), 2),
                            "avg_engagement_score": round(float(row[21] or 0), 2),
                            "total_breaks_in_meeting": int(row[22] or 0)
                        }
                    })

            # ==================== 5. USER-SPECIFIC OVERALL SUMMARY STATISTICS ====================
            # FIXED: This now calculates stats ONLY for the specified user
            if user_id:
                # Get user-specific participant stats
                cursor.execute("""
                    SELECT 
                        COUNT(DISTINCT p.Meeting_ID) as total_meetings_attended,
                        SUM(p.Total_Duration_Minutes) as total_duration_minutes,
                        AVG(p.Participant_Attendance) as avg_participant_attendance,
                        AVG(p.Overall_Attendance) as avg_overall_attendance,
                        AVG(ats.engagement_score) as avg_engagement_score,
                        AVG(ats.attendance_penalty) as avg_penalty
                    FROM tbl_Participants p
                    LEFT JOIN tbl_Attendance_Sessions ats ON p.Meeting_ID = ats.Meeting_ID AND p.User_ID = ats.User_ID
                    JOIN tbl_Meetings m ON p.Meeting_ID = m.ID
                    LEFT JOIN tbl_ScheduledMeetings sm ON m.ID = sm.id AND m.Meeting_Type = 'ScheduleMeeting'
                    LEFT JOIN tbl_CalendarMeetings cm ON m.ID = cm.ID AND m.Meeting_Type = 'CalendarMeeting'
                    WHERE p.User_ID = %s
                    AND p.Role = 'participant'
                    AND COALESCE(
                        m.Started_At,
                        sm.start_time,
                        cm.startTime,
                        m.Created_At
                    ) BETWEEN %s AND %s
                """, [user_id, start_date, end_date])
                
                participant_summary_row = cursor.fetchone()
                
                # Get user-specific host stats
                cursor.execute("""
                    SELECT 
                        COUNT(DISTINCT m.ID) as total_meetings_hosted,
                        COUNT(DISTINCT p.User_ID) as total_participants_in_hosted
                    FROM tbl_Meetings m
                    LEFT JOIN tbl_Participants p ON m.ID = p.Meeting_ID
                    LEFT JOIN tbl_ScheduledMeetings sm ON m.ID = sm.id AND m.Meeting_Type = 'ScheduleMeeting'
                    LEFT JOIN tbl_CalendarMeetings cm ON m.ID = cm.ID AND m.Meeting_Type = 'CalendarMeeting'
                    WHERE m.Host_ID = %s
                    AND COALESCE(
                        m.Started_At,
                        sm.start_time,
                        cm.startTime,
                        m.Created_At
                    ) BETWEEN %s AND %s
                """, [user_id, start_date, end_date])
                
                host_summary_row = cursor.fetchone()
                
                overall_summary = {
                    "total_meetings": int(participant_summary_row[0] or 0),
                    "total_hosted_meetings": int(host_summary_row[0] or 0),
                    "total_participants": int(host_summary_row[1] or 0),
                    "total_duration_minutes": round(float(participant_summary_row[1] or 0), 2),
                    "total_duration_hours": round(float(participant_summary_row[1] or 0) / 60, 2),
                    "avg_participant_attendance": round(float(participant_summary_row[2] or 0), 2),
                    "avg_overall_attendance": round(float(participant_summary_row[3] or 0), 2),
                    "avg_engagement_score": round(float(participant_summary_row[4] or 0), 2),
                    "avg_penalty": round(float(participant_summary_row[5] or 0), 2),
                    "date_range": {
                        "start": start_date.isoformat(),
                        "end": end_date.isoformat()
                    }
                }
            else:
                # Global stats (admin view)
                cursor.execute("""
                    SELECT 
                        COUNT(DISTINCT m.ID) as total_meetings,
                        COUNT(DISTINCT m.Host_ID) as total_hosts,
                        COUNT(DISTINCT p.User_ID) as total_participants,
                        AVG(p.Total_Duration_Minutes) as avg_duration_minutes,
                        AVG(p.Participant_Attendance) as avg_participant_attendance,
                        AVG(p.Overall_Attendance) as avg_overall_attendance,
                        SUM(p.Total_Duration_Minutes) as total_duration_minutes
                    FROM tbl_Meetings m
                    LEFT JOIN tbl_ScheduledMeetings sm ON m.ID = sm.id AND m.Meeting_Type = 'ScheduleMeeting'
                    LEFT JOIN tbl_CalendarMeetings cm ON m.ID = cm.ID AND m.Meeting_Type = 'CalendarMeeting'
                    LEFT JOIN tbl_Participants p ON m.ID = p.Meeting_ID
                    WHERE COALESCE(
                        m.Started_At,
                        sm.start_time,
                        cm.startTime,
                        m.Created_At
                    ) BETWEEN %s AND %s
                """, [start_date, end_date])
                
                summary_row = cursor.fetchone()
                overall_summary = {
                    "total_meetings": int(summary_row[0] or 0),
                    "total_hosts": int(summary_row[1] or 0),
                    "total_participants": int(summary_row[2] or 0),
                    "avg_duration_minutes": round(float(summary_row[3] or 0), 2),
                    "avg_participant_attendance": round(float(summary_row[4] or 0), 2),
                    "avg_overall_attendance": round(float(summary_row[5] or 0), 2),
                    "total_duration_hours": round(float(summary_row[6] or 0) / 60, 2),
                    "date_range": {
                        "start": start_date.isoformat(),
                        "end": end_date.isoformat()
                    }
                }

        # ==================== PREPARE RESPONSE DATA ====================
        response_data = {
            "overall_summary": overall_summary,
            "available_meeting_times": available_meeting_times,
            "filters_applied": {
                "user_id": user_id,
                "meeting_id": meeting_id,
                "analytics_type": analytics_type,
                "meeting_type": meeting_type,
                "timeframe": timeframe,
                "date_range": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                }
            }
        }

        if analytics_type in ['all', 'participant']:
            response_data["participant_details"] = participant_data
            response_data["participant_summary"] = participant_summary_data

        if analytics_type in ['all', 'host']:
            response_data["host_analytics"] = host_data

        if analytics_type in ['all', 'meeting']:
            response_data["meeting_analytics"] = meeting_data

        logging.debug(f"✅ Comprehensive analytics fetched - analytics_type: {analytics_type}, available_times: {len(available_meeting_times)}")
        return JsonResponse({"data": response_data}, status=SUCCESS_STATUS)

    except Exception as e:
        logging.error(f"❌ Error fetching comprehensive analytics: {e}")
        logging.error(f"Traceback: {traceback.format_exc()}")
        return JsonResponse({"error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

@require_http_methods(["GET"])
@csrf_exempt
def get_participant_dashboard_overview(request):
    """Get participant dashboard overview statistics"""
    try:
        user_id = request.GET.get('user_id') or request.GET.get('userId')
        timeframe = request.GET.get('timeframe', '7days')
        meeting_type = request.GET.get('meetingType') or request.GET.get('meeting_type', 'all')

        if not user_id:
            return JsonResponse({"error": "user_id is required"}, status=BAD_REQUEST_STATUS)

        ist_timezone = pytz.timezone('Asia/Kolkata')
        end_date = timezone.now().astimezone(ist_timezone)
        
        if timeframe == '7days': start_date = end_date - timedelta(days=7)
        elif timeframe == '30days': start_date = end_date - timedelta(days=30)
        elif timeframe == '90days': start_date = end_date - timedelta(days=90)
        elif timeframe == '1year': start_date = end_date - timedelta(days=365)
        else: return JsonResponse({"error": "Invalid timeframe"}, status=BAD_REQUEST_STATUS)

        with connection.cursor() as cursor:
            query = """
                SELECT 
                    COUNT(DISTINCT p.Meeting_ID) as total_meetings_attended,
                    AVG(p.Participant_Attendance) as avg_participant_attendance,
                    AVG(p.Overall_Attendance) as avg_overall_attendance,
                    SUM(p.Total_Duration_Minutes) as total_duration,
                    AVG(ats.engagement_score) as avg_engagement_score,
                    AVG(ats.attendance_penalty) as avg_penalty,
                    SUM(ats.popup_count) as total_popups,
                    SUM(CASE WHEN ats.break_used = 1 THEN 1 ELSE 0 END) as total_breaks_used
                FROM tbl_Participants p
                LEFT JOIN tbl_Meetings m ON p.Meeting_ID = m.ID
                LEFT JOIN tbl_Attendance_Sessions ats ON p.Meeting_ID = ats.Meeting_ID AND p.User_ID = ats.User_ID
                WHERE p.User_ID = %s AND p.Role = 'participant' AND m.Created_At BETWEEN %s AND %s
            """
            
            params = [user_id, start_date, end_date]
            if meeting_type != 'all':
                query += " AND m.Meeting_Type = %s"
                params.append(meeting_type)

            cursor.execute(query, params)
            result = cursor.fetchone()

        data = {
            "total_meetings_attended": int(result[0] or 0),
            "avg_participant_attendance": round(float(result[1] or 0), 2),
            "avg_overall_attendance": round(float(result[2] or 0), 2),
            "total_duration_minutes": round(float(result[3] or 0), 2),
            "total_duration_hours": round(float(result[3] or 0) / 60, 2),
            "attendance_monitoring": {
                "avg_engagement_score": round(float(result[4] or 0), 2),
                "avg_penalty": round(float(result[5] or 0), 2),
                "total_popups": int(result[6] or 0),
                "total_breaks_used": int(result[7] or 0)
            }
        }
        
        return JsonResponse({"data": data}, status=SUCCESS_STATUS)
    except Exception as e:
        logging.error(f"Error fetching participant overview: {e}")
        return JsonResponse({"error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

urlpatterns = [
    # NEW Host Analytics APIs (4 APIs)
    path('api/meetings/host/<int:user_id>/', Get_Host_Meetings, name='get_host_meetings'),
    path('api/meetings/<str:meeting_id>/participants/', Get_Meeting_Participants, name='get_meeting_participants'),
    path('api/meetings/participant/<int:user_id>/', Get_Participant_Meetings, name='get_participant_meetings'),
    # path('api/meetings/<str:meeting_id>/participants/<int:user_id>/report/', Get_Participant_Report_For_Meeting, name='get_participant_report_for_meeting'),
    path('api/meetings/<str:meeting_id>/participants/<int:user_id>/report/pdf/', Generate_Participant_Report_PDF_For_Meeting, name='generate_participant_report_pdf_for_meeting'),
    path('api/meetings/<str:meeting_id>/participants/<int:user_id>/report/', Get_Participant_Report_For_Meeting, name='get_participant_report_for_meeting'),

    # Existing Analytics Endpoints
    path('api/analytics/host/overview', get_host_dashboard_overview, name='get_host_dashboard_overview'),
    path('api/analytics/participant/overview', get_participant_dashboard_overview, name='get_participant_dashboard_overview'),
    path('api/analytics/meeting-times', get_available_meeting_times, name='get_available_meeting_times'),
    path('api/analytics/comprehensive', get_comprehensive_meeting_analytics, name='get_comprehensive_meeting_analytics'),
]