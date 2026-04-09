# core/scheduler/tasks.py
from celery import shared_task
import logging
from scheduler.recurring_scheduler import update_recurring_meetings, cleanup_old_meetings
from scheduler.email_scheduler import send_daily_invitation_emails, send_daily_meeting_reminders

@shared_task
def update_recurring_meetings_task():
    """Celery task to update recurring meetings"""
    try:
        logging.info("Starting Celery task: update_recurring_meetings")
        result = update_recurring_meetings()
        logging.info(f"Celery task completed: {result}")
        return result
    except Exception as e:
        logging.error(f"Celery task failed: {e}")
        return {'success': False, 'error': str(e)}

@shared_task
def send_daily_invitations_task():
    """Celery task to send daily invitations"""
    try:
        logging.info("Starting Celery task: send_daily_invitations")
        result = send_daily_invitation_emails()
        logging.info(f"Daily invitations sent: {result}")
        return {'invitations_sent': result}
    except Exception as e:
        logging.error(f"Daily invitations task failed: {e}")
        return {'invitations_sent': 0, 'error': str(e)}

@shared_task
def send_meeting_reminders_task():
    """Celery task to send meeting reminders"""
    try:
        logging.info("Starting Celery task: send_meeting_reminders")
        result = send_daily_meeting_reminders()
        logging.info(f"Meeting reminders sent: {result}")
        return {'reminders_sent': result}
    except Exception as e:
        logging.error(f"Meeting reminders task failed: {e}")
        return {'reminders_sent': 0, 'error': str(e)}

@shared_task
def cleanup_old_meetings_task():
    """Celery task to cleanup old meetings"""
    try:
        logging.info("Starting Celery task: cleanup_old_meetings")
        result = cleanup_old_meetings()
        logging.info(f"Old meetings cleaned up: {result}")
        return {'archived_count': result}
    except Exception as e:
        logging.error(f"Cleanup task failed: {e}")
        return {'archived_count': 0, 'error': str(e)}

@shared_task
def process_all_recurring_meetings():
    """Combined task to process all recurring meeting operations"""
    try:
        logging.info("Starting combined recurring meetings processing")
        
        # Update meetings
        update_result = update_recurring_meetings()
        
        # Send notifications
        invitations_result = send_daily_invitation_emails()
        reminders_result = send_daily_meeting_reminders()
        
        # Cleanup (only on weekends)
        from utils.date_utils import get_current_ist_datetime
        current_time = get_current_ist_datetime()
        cleanup_result = 0
        if current_time.weekday() == 6:  # Sunday
            cleanup_result = cleanup_old_meetings()
        
        combined_result = {
            'update_result': update_result,
            'invitations_sent': invitations_result,
            'reminders_sent': reminders_result,
            'archived_count': cleanup_result,
            'processed_at': current_time.isoformat()
        }
        
        logging.info(f"Combined processing completed: {combined_result}")
        return combined_result
        
    except Exception as e:
        logging.error(f"Combined processing failed: {e}")
        return {'success': False, 'error': str(e)}

# # ==========================================================
# # 🎬 GPU Video Processing Task (NEW)
# # ==========================================================
# from core.UserDashBoard.recordings import process_video_sync
# from celery import shared_task

# @shared_task(name="process_video_task")
# def process_video_task(video_path, meeting_id, user_id):
#     """
#     Background Celery task for GPU-accelerated video processing.
#     """
#     import logging
#     logging.warning(f"🚀 [CELERY] Background video task received for meeting={meeting_id}")
#     try:
#         return process_video_sync(video_path, meeting_id, user_id)
#     except Exception as e:
#         logging.error(f"❌ [CELERY] Video processing failed for {meeting_id}: {e}")
#         raise


# ==========================================================
# 🕐 Close Stale Sessions Task
# ==========================================================
@shared_task
def close_stale_sessions_task():
    """
    Runs every 5 minutes via Celery Beat.
    
    Finds meetings where:
    - Host has left (Is_Currently_Active = FALSE, Role = 'host')
    - Host's last leave time is 15+ minutes ago
    - End_Meeting_Time is still NULL for that occurrence
    
    Then:
    - Sets End_Meeting_Time = host's last leave time for ALL participants
    - Marks any still-active participants as left (with leave time = host's last leave)
    - Calculates Total_Duration_Minutes, attendance percentages for ALL participants
    """
    import json
    import pytz
    from datetime import datetime, timedelta
    from django.db import connection, transaction
    from participants.participants import calculate_duration_from_arrays, calculate_overlap_duration

    logging.info("🕐 [STALE-SESSION] Starting stale session check...")

    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist)
    cutoff = now - timedelta(minutes=15)

    sessions_closed = 0

    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT p.ID, p.Meeting_ID, p.User_ID, p.Leave_Times, 
                       p.occurrence_number, p.Join_Times
                FROM tbl_Participants p
                WHERE p.Role = 'host'
                  AND p.Is_Currently_Active = FALSE
                  AND p.End_Meeting_Time IS NULL
                  AND p.Leave_Times IS NOT NULL
                  AND p.Leave_Times != '[]'
            """)

            host_rows = cursor.fetchall()
            logging.info(f"[STALE-SESSION] Found {len(host_rows)} host records with no End_Meeting_Time")

            for host_id, meeting_id, host_user_id, host_leave_json, occurrence_number, host_join_json in host_rows:
                try:
                    try:
                        host_leave_times = json.loads(host_leave_json) if isinstance(host_leave_json, str) else (host_leave_json or [])
                        host_join_times = json.loads(host_join_json) if isinstance(host_join_json, str) else (host_join_json or [])
                    except:
                        continue

                    if not host_leave_times:
                        continue

                    host_last_leave_str = host_leave_times[-1]

                    try:
                        host_last_leave = datetime.strptime(host_last_leave_str, '%Y-%m-%d %H:%M:%S')
                        host_last_leave = ist.localize(host_last_leave)
                    except:
                        continue

                    if host_last_leave > cutoff:
                        continue

                    logging.info(
                        f"[STALE-SESSION] Meeting {meeting_id} occ#{occurrence_number}: "
                        f"Host left at {host_last_leave_str} (>15 min ago) — closing session"
                    )

                    with transaction.atomic():
                        # ===== Step 1: Mark active participants as left =====
                        cursor.execute("""
                            SELECT ID, User_ID, Leave_Times
                            FROM tbl_Participants
                            WHERE Meeting_ID = %s
                              AND occurrence_number = %s
                              AND Is_Currently_Active = TRUE
                        """, [meeting_id, occurrence_number])

                        active_participants = cursor.fetchall()

                        for ap_id, ap_user_id, ap_leave_json in active_participants:
                            try:
                                ap_leave_times = json.loads(ap_leave_json) if isinstance(ap_leave_json, str) else (ap_leave_json or [])
                            except:
                                ap_leave_times = []

                            if host_last_leave_str not in ap_leave_times:
                                ap_leave_times.append(host_last_leave_str)

                            cursor.execute("""
                                UPDATE tbl_Participants
                                SET Is_Currently_Active = FALSE,
                                    Leave_Times = %s
                                WHERE ID = %s
                            """, [json.dumps(ap_leave_times), ap_id])

                            logging.info(f"[STALE-SESSION] Marked participant {ap_user_id} as left (capped at host leave time)")

                        # ===== Step 2: Set End_Meeting_Time for ALL participants =====
                        cursor.execute("""
                            UPDATE tbl_Participants
                            SET End_Meeting_Time = %s
                            WHERE Meeting_ID = %s
                              AND occurrence_number = %s
                              AND End_Meeting_Time IS NULL
                        """, [host_last_leave_str, meeting_id, occurrence_number])

                        updated_count = cursor.rowcount
                        logging.info(f"[STALE-SESSION] Set End_Meeting_Time for {updated_count} participants")

                        # ===== Step 3: Calculate host duration =====
                        host_duration = calculate_duration_from_arrays(host_join_times, host_leave_times)
                        if host_duration is None:
                            host_duration = 0.0
                        logging.info(f"[STALE-SESSION] Host duration: {host_duration:.2f} min")

                        # ===== Step 4: Calculate duration & attendance for ALL participants =====
                        cursor.execute("""
                            SELECT ID, User_ID, Role, Join_Times, Leave_Times
                            FROM tbl_Participants
                            WHERE Meeting_ID = %s AND occurrence_number = %s
                        """, [meeting_id, occurrence_number])

                        all_participants = cursor.fetchall()

                        for p_id, p_user_id, p_role, p_join_json, p_leave_json in all_participants:
                            try:
                                p_join_times = json.loads(p_join_json) if isinstance(p_join_json, str) else (p_join_json or [])
                                p_leave_times = json.loads(p_leave_json) if isinstance(p_leave_json, str) else (p_leave_json or [])
                            except:
                                p_join_times, p_leave_times = [], []

                            # Calculate duration
                            if p_role.lower() == 'host':
                                total_duration = host_duration
                            else:
                                total_duration = calculate_overlap_duration(
                                    host_join_times, host_leave_times,
                                    p_join_times, p_leave_times
                                )
                            if total_duration is None:
                                total_duration = 0.0

                            completed_sessions = len(p_leave_times)

                            # Calculate host-based attendance
                            if p_role.lower() == 'host':
                                attendance_host = 100.00
                            elif host_duration > 0:
                                attendance_host = round((total_duration / host_duration) * 100, 2)
                                attendance_host = min(attendance_host, 100.00)
                            else:
                                attendance_host = 0.0

                            # Update duration and attendance
                            cursor.execute("""
                                UPDATE tbl_Participants
                                SET Total_Duration_Minutes = %s,
                                    Total_Sessions = %s,
                                    Attendance_Percentagebasedon_host = %s
                                WHERE ID = %s
                            """, [total_duration, completed_sessions, attendance_host, p_id])

                            logging.info(
                                f"[STALE-SESSION] User {p_user_id} ({p_role}): "
                                f"Duration={total_duration:.2f}min, Attendance={attendance_host}%"
                            )

                            # Calculate Participant_Attendance for non-host
                            if p_role.lower() != 'host':
                                cursor.execute("""
                                    SELECT COALESCE(attendance_percentage, 0)
                                    FROM tbl_Attendance_Sessions
                                    WHERE meeting_id = %s AND user_id = %s
                                """, [meeting_id, p_user_id])

                                ai_row = cursor.fetchone()
                                ai_based = float(ai_row[0]) if ai_row else 0.0
                                ai_based = min(ai_based, 100.00)

                                per_meeting_avg = (attendance_host + ai_based) / 2
                                per_meeting_avg = min(per_meeting_avg, 100.00)

                                cursor.execute("""
                                    UPDATE tbl_Participants
                                    SET Participant_Attendance = %s
                                    WHERE ID = %s
                                """, [round(per_meeting_avg, 2), p_id])

                                logging.info(
                                    f"[STALE-SESSION] User {p_user_id}: "
                                    f"Host-based={attendance_host}%, AI={ai_based}%, "
                                    f"Participant_Attendance={per_meeting_avg:.2f}%"
                                )

                                # Overall attendance
                                cursor.execute("""
                                    SELECT sm.is_recurring
                                    FROM tbl_ScheduledMeetings sm
                                    WHERE sm.id = %s AND sm.is_recurring = 1
                                """, [meeting_id])

                                is_recurring = bool(cursor.fetchone())

                                if is_recurring:
                                    cursor.execute("""
                                        SELECT AVG(Participant_Attendance)
                                        FROM tbl_Participants
                                        WHERE User_ID = %s AND Meeting_ID = %s
                                          AND Participant_Attendance IS NOT NULL
                                          AND LOWER(Role) != 'host'
                                    """, [p_user_id, meeting_id])
                                else:
                                    cursor.execute("""
                                        SELECT AVG(Participant_Attendance)
                                        FROM tbl_Participants
                                        WHERE User_ID = %s
                                          AND Participant_Attendance IS NOT NULL
                                          AND LOWER(Role) != 'host'
                                    """, [p_user_id])

                                overall_row = cursor.fetchone()
                                overall = float(overall_row[0]) if overall_row and overall_row[0] else per_meeting_avg
                                overall = min(overall, 100.00)

                                cursor.execute("""
                                    UPDATE tbl_Participants
                                    SET Overall_Attendance = %s
                                    WHERE Meeting_ID = %s AND User_ID = %s AND LOWER(Role) != 'host'
                                """, [round(overall, 2), meeting_id, p_user_id])

                                logging.info(f"[STALE-SESSION] User {p_user_id}: Overall_Attendance={overall:.2f}%")

                        # ===== Step 5: Update tbl_Meetings.Ended_At =====
                        cursor.execute("""
                            UPDATE tbl_Meetings
                            SET Ended_At = %s
                            WHERE ID = %s AND Ended_At IS NULL
                        """, [host_last_leave_str, meeting_id])

                    sessions_closed += 1

                except Exception as row_err:
                    logging.error(f"[STALE-SESSION] Error processing meeting {meeting_id}: {row_err}")
                    import traceback
                    logging.error(traceback.format_exc())
                    continue

    except Exception as e:
        logging.error(f"❌ [STALE-SESSION] Critical error: {e}")
        import traceback
        logging.error(traceback.format_exc())

    logging.info(f"✅ [STALE-SESSION] Completed — {sessions_closed} sessions closed")
    return {'sessions_closed': sessions_closed}