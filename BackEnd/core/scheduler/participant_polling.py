"""
core/scheduler/participant_polling.py - SIMPLIFIED VERSION (CORRECTED IMPORT)

This polling task:
1. Detects disconnected participants (compares LiveKit vs Database)
2. Stores leave time in Leave_Times JSON array
3. Marks Is_Currently_Active = FALSE
4. That's it - duration calculation handled by your API functions

CRITICAL FIX: Import livekit_service from the correct location
"""

import logging
import json
import pytz
from datetime import datetime
from django.db import connection
from django.utils import timezone

# ✅ FIXED: Import from correct location - core.WebSocketConnection.meetings
from core.WebSocketConnection.meetings import livekit_service

logger = logging.getLogger(__name__)


def sync_participants_polling():
    """
    ✅ POLLING TASK: Runs every 10 seconds
    
    What it does:
    1. Gets all active meetings
    2. For each meeting: compares LiveKit participants with database
    3. Marks missing participants as left (stores leave time only)
    4. Your API functions will handle duration calculation
    """
    try:
        # logger.info("🔄 [POLLING-10s] Starting participant sync cycle...")
        
        sync_results = {
            'meetings_checked': 0,
            'participants_checked': 0,
            'participants_marked_left': 0,
            'errors': [],
            'timestamp': timezone.now().isoformat()
        }
        
        with connection.cursor() as cursor:
            # ===== STEP 1: GET ALL ACTIVE MEETINGS =====
            cursor.execute("""
                SELECT ID, LiveKit_Room_Name, Status
                FROM tbl_Meetings 
                WHERE Status IN ('active', 'scheduled')
                AND LiveKit_Room_Name IS NOT NULL
                LIMIT 100
            """)
            
            active_meetings = cursor.fetchall()
            sync_results['meetings_checked'] = len(active_meetings)
            
            # logger.info(f"[POLLING] Found {len(active_meetings)} active meetings to check")
            
            # ===== STEP 2: FOR EACH MEETING, CHECK PARTICIPANTS =====
            for meeting_id, room_name, meeting_status in active_meetings:
                try:
                    # ===== A: Get actual participants from LiveKit =====
                    try:
                        livekit_participants = livekit_service.list_participants(room_name)
                        livekit_identities = {p['identity'] for p in livekit_participants}
                        
                        # logger.info(f"[POLLING] Meeting {meeting_id}: LiveKit has {len(livekit_identities)} participants")
                    except Exception as lk_error:
                        logger.warning(f"[POLLING] Could not fetch from LiveKit for meeting {meeting_id}: {lk_error}")
                        continue
                    
                    # ===== B: GET DATABASE ACTIVE PARTICIPANTS =====
                    cursor.execute("""
                        SELECT ID, User_ID, occurrence_number, Role, Leave_Times, Is_Currently_Active
                        FROM tbl_Participants 
                        WHERE Meeting_ID = %s AND Is_Currently_Active = TRUE
                    """, [meeting_id])
                    
                    db_participants = cursor.fetchall()
                    sync_results['participants_checked'] += len(db_participants)
                    
                    # logger.info(f"[POLLING] Meeting {meeting_id}: DB has {len(db_participants)} active participants")
                    
                    # ===== C: FIND WHO IS MISSING FROM LIVEKIT =====
                    for participant_row in db_participants:
                        (participant_id, user_id, occurrence_number, role, 
                         leave_times_json, is_active) = participant_row
                        
                        # Check if this user is still in LiveKit
                        is_still_in_livekit = False
                        
                        for livekit_identity in livekit_identities:
                            # Extract user_id from identity: "user_456_1234567890_1234"
                            try:
                                parts = livekit_identity.split('_')
                                if parts[0] == 'user' and parts[1] == str(user_id):
                                    is_still_in_livekit = True
                                    break
                            except:
                                continue
                        
                        if not is_still_in_livekit:
                            # ===== THIS USER DISCONNECTED =====
                            # logger.info(f"[POLLING] ❌ User {user_id} in DB but NOT in LiveKit - marking as left")
                            
                            try:
                                _mark_participant_as_left(
                                    cursor=cursor,
                                    participant_id=participant_id,
                                    user_id=user_id,
                                    leave_times_json=leave_times_json
                                )
                                sync_results['participants_marked_left'] += 1
                                
                            except Exception as process_error:
                                logger.error(f"[POLLING] Error marking user {user_id} as left: {process_error}")
                                sync_results['errors'].append(f"User {user_id}: {str(process_error)}")
                
                except Exception as meeting_error:
                    logger.error(f"[POLLING] Error processing meeting {meeting_id}: {meeting_error}")
                    sync_results['errors'].append(f"Meeting {meeting_id}: {str(meeting_error)}")
                    continue
        
#         logger.info(f"""
# ✅ [POLLING] Sync cycle completed:
#    - Meetings checked: {sync_results['meetings_checked']}
#    - Participants checked: {sync_results['participants_checked']}
#    - Marked as left: {sync_results['participants_marked_left']}
#    - Errors: {len(sync_results['errors'])}
#         """)
        
        return sync_results
        
    except Exception as e:
        logger.error(f"❌ [POLLING] Critical error: {e}")
        import traceback
        logger.error(f"[POLLING] Traceback: {traceback.format_exc()}")
        return {
            'error': str(e),
            'timestamp': timezone.now().isoformat()
        }


# ==================== HELPER FUNCTION ====================

def _mark_participant_as_left(cursor, participant_id, user_id, leave_times_json):
    """
    Mark a participant as left
    
    ONLY STORES:
    - Leave_Times (adds current timestamp)
    - Is_Currently_Active = FALSE
    
    Duration calculation will be handled by your API functions
    """
    
    leave_time = timezone.now()
    ist_timezone = pytz.timezone("Asia/Kolkata")
    leave_time_ist = leave_time.astimezone(ist_timezone)
    leave_time_str = leave_time_ist.strftime('%Y-%m-%d %H:%M:%S')
    
    # Parse existing leave times
    try:
        leave_times = json.loads(leave_times_json) if isinstance(leave_times_json, str) else (leave_times_json or [])
    except:
        leave_times = []
    
    # ===== DO NOT ADD DUPLICATE LEAVE TIMES =====
    if leave_time_str not in leave_times:
        leave_times.append(leave_time_str)
        
        # ===== UPDATE DATABASE: ONLY STORE LEAVE TIME =====
        cursor.execute("""
            UPDATE tbl_Participants
            SET Is_Currently_Active = FALSE,
                Leave_Times = %s
            WHERE ID = %s
        """, [
            json.dumps(leave_times),
            participant_id
        ])
        
        # logger.info(f"✅ [POLLING] User {user_id} marked as left - Leave_Times stored in database")
        # logger.info(f"   Leave time: {leave_time_str}")
    
    else:
        logger.info(f"[POLLING] Leave time already recorded for user {user_id}")
