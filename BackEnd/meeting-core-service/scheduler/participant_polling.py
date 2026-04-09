# """
# core/scheduler/participant_polling.py - SIMPLIFIED VERSION (CORRECTED IMPORT)

# This polling task:
# 1. Detects disconnected participants (compares LiveKit vs Database)
# 2. Stores leave time in Leave_Times JSON array
# 3. Marks Is_Currently_Active = FALSE
# 4. That's it - duration calculation handled by your API functions

# CRITICAL FIX: Import livekit_service from the correct location
# """

# import logging
# import json
# import pytz
# from datetime import datetime
# from django.db import connection
# from django.utils import timezone

# # ✅ FIXED: Import from correct location - core.WebSocketConnection.meetings

# logger = logging.getLogger(__name__)


# def sync_participants_polling():
#     """
#     ✅ POLLING TASK: Runs every 10 seconds
    
#     What it does:
#     1. Gets all active meetings
#     2. For each meeting: compares LiveKit participants with database
#     3. Marks missing participants as left (stores leave time only)
#     4. Your API functions will handle duration calculation
#     """
#     from meetings.meetings import livekit_service

#     try:
#         logger.debug("🔄 [POLLING-10s] Starting participant sync cycle...")
        
#         sync_results = {
#             'meetings_checked': 0,
#             'participants_checked': 0,
#             'participants_marked_left': 0,
#             'errors': [],
#             'timestamp': timezone.now().isoformat()
#         }
        
#         with connection.cursor() as cursor:
#             # ===== STEP 1: GET ALL ACTIVE MEETINGS =====
#             cursor.execute("""
#                 SELECT ID, LiveKit_Room_Name, Status
#                 FROM tbl_Meetings 
#                 WHERE Status IN ('active', 'scheduled')
#                 AND LiveKit_Room_Name IS NOT NULL
#                 LIMIT 100
#             """)
            
#             active_meetings = cursor.fetchall()
#             sync_results['meetings_checked'] = len(active_meetings)
            
#             logger.debug(f"[POLLING] Found {len(active_meetings)} active meetings to check")
            
#             # ===== STEP 2: FOR EACH MEETING, CHECK PARTICIPANTS =====
#             for meeting_id, room_name, meeting_status in active_meetings:
#                 try:
#                     # ===== A: Get actual participants from LiveKit =====
#                     try:
#                         livekit_participants = livekit_service.list_participants(room_name)
#                         livekit_identities = {p['identity'] for p in livekit_participants}
                        
#                         logger.debug(f"[POLLING] Meeting {meeting_id}: LiveKit has {len(livekit_identities)} participants")

#                     except Exception as lk_error:
#                         logger.warning(f"[POLLING] Could not fetch from LiveKit for meeting {meeting_id}: {lk_error}")
#                         continue
                    
#                     # ===== B: GET DATABASE ACTIVE PARTICIPANTS =====
#                     cursor.execute("""
#                         SELECT ID, User_ID, occurrence_number, Role, Leave_Times, Is_Currently_Active
#                         FROM tbl_Participants 
#                         WHERE Meeting_ID = %s AND Is_Currently_Active = TRUE
#                     """, [meeting_id])
                    
#                     db_participants = cursor.fetchall()
#                     sync_results['participants_checked'] += len(db_participants)
                    
#                     logger.debug(f"[POLLING] Meeting {meeting_id}: DB has {len(db_participants)} active participants")
                    
#                     # ===== C: FIND WHO IS MISSING FROM LIVEKIT =====
#                     for participant_row in db_participants:
#                         (participant_id, user_id, occurrence_number, role, 
#                          leave_times_json, is_active) = participant_row
                        
#                         # Check if this user is still in LiveKit
#                         is_still_in_livekit = False
                        
#                         for livekit_identity in livekit_identities:
#                             try:
#                                 prefix, identity_user_id, *_ = livekit_identity.split('_')
#                                 if prefix == 'user' and identity_user_id == str(user_id):
#                                     is_still_in_livekit = True
#                                     break
#                             except ValueError:
#                                 continue

#                         if not is_still_in_livekit:
#                             # ===== THIS USER DISCONNECTED =====
#                             logger.info(f"[POLLING] ❌ User {user_id} in DB but NOT in LiveKit - marking as left")
                            
#                             try:
#                                 _mark_participant_as_left(
#                                     cursor=cursor,
#                                     participant_id=participant_id,
#                                     user_id=user_id,
#                                     leave_times_json=leave_times_json
#                                 )
#                                 sync_results['participants_marked_left'] += 1
                                
#                             except Exception as process_error:
#                                 logger.error(f"[POLLING] Error marking user {user_id} as left: {process_error}")
#                                 sync_results['errors'].append(f"User {user_id}: {str(process_error)}")
                
#                 except Exception as meeting_error:
#                     logger.error(f"[POLLING] Error processing meeting {meeting_id}: {meeting_error}")
#                     sync_results['errors'].append(f"Meeting {meeting_id}: {str(meeting_error)}")
#                     continue
        
#         logger.info(f"""
# ✅ [POLLING] Sync cycle completed:
#    - Meetings checked: {sync_results['meetings_checked']}
#    - Participants checked: {sync_results['participants_checked']}
#    - Marked as left: {sync_results['participants_marked_left']}
#    - Errors: {len(sync_results['errors'])}
#         """)
        
#         return sync_results
        
#     except Exception as e:
#         logger.error(f"❌ [POLLING] Critical error: {e}")
#         import traceback
#         logger.error(f"[POLLING] Traceback: {traceback.format_exc()}")
#         return {
#             'error': str(e),
#             'timestamp': timezone.now().isoformat()
#         }


# # ==================== HELPER FUNCTION ====================

# def _mark_participant_as_left(cursor, participant_id, user_id, leave_times_json):
#     """
#     Mark a participant as left
    
#     ONLY STORES:
#     - Leave_Times (adds current timestamp)
#     - Is_Currently_Active = FALSE
    
#     Duration calculation will be handled by your API functions
#     """
    
#     leave_time = timezone.now()
#     ist_timezone = pytz.timezone("Asia/Kolkata")
#     leave_time_ist = leave_time.astimezone(ist_timezone)
#     leave_time_str = leave_time_ist.strftime('%Y-%m-%d %H:%M:%S')
    
#     # Parse existing leave times
#     try:
#         leave_times = json.loads(leave_times_json) if isinstance(leave_times_json, str) else (leave_times_json or [])
#     except:
#         leave_times = []
    
#     # ===== DO NOT ADD DUPLICATE LEAVE TIMES =====
#     if leave_time_str not in leave_times:
#         leave_times.append(leave_time_str)
        
#         # ===== UPDATE DATABASE: ONLY STORE LEAVE TIME =====
#         cursor.execute("""
#                 UPDATE tbl_Participants
#                 SET Is_Currently_Active = FALSE,
#                     Leave_Times = %s
#                 WHERE ID = %s AND Is_Currently_Active = TRUE
#             """, [
#                 json.dumps(leave_times),
#                 participant_id
#             ])

#         logger.info(f"✅ [POLLING] User {user_id} marked as left - Leave_Times stored in database")
#         logger.info(f"   Leave time: {leave_time_str}")
    
#     else:
#         logger.info(f"[POLLING] Leave time already recorded for user {user_id}")

"""
core/scheduler/participant_polling.py

This polling task:
1. Detects disconnected participants (compares LiveKit vs Database)
2. Uses a 15-second grace period before marking as left (prevents rapid join/leave)
3. Stores leave time in Leave_Times JSON array
4. Marks Is_Currently_Active = FALSE
5. Duration calculation handled by your API functions
"""

import logging
import json
import time
import pytz
from datetime import datetime
from django.db import connection
from django.utils import timezone

logger = logging.getLogger(__name__)

# Grace period tracker: {f"{meeting_id}:{user_id}": first_missing_timestamp}
_missing_since = {}

# How long (seconds) a user must be missing from LiveKit before marking as left
GRACE_PERIOD_SECONDS = 30


def sync_participants_polling():
    """
    POLLING TASK: Runs every 10 seconds
    
    What it does:
    1. Gets all active meetings
    2. For each meeting: compares LiveKit participants with database
    3. If user missing from LiveKit: start grace period timer
    4. If user still missing after 15 seconds: mark as left
    5. If user reappears: cancel grace period
    """
    from meetings.meetings import livekit_service

    try:
        logger.debug("🔄 [POLLING-10s] Starting participant sync cycle...")
        
        sync_results = {
            'meetings_checked': 0,
            'participants_checked': 0,
            'participants_marked_left': 0,
            'errors': [],
            'timestamp': timezone.now().isoformat()
        }
        
        # Track which keys are still relevant this cycle
        active_keys = set()
        
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
            
            logger.debug(f"[POLLING] Found {len(active_meetings)} active meetings to check")
            
            # ===== STEP 2: FOR EACH MEETING, CHECK PARTICIPANTS =====
            for meeting_id, room_name, meeting_status in active_meetings:
                try:
                    # ===== A: Get actual participants from LiveKit =====
                    try:
                        livekit_participants = livekit_service.list_participants(room_name)
                        livekit_identities = {p['identity'] for p in livekit_participants}
                        
                        logger.debug(f"[POLLING] Meeting {meeting_id}: LiveKit has {len(livekit_identities)} participants")

                    except Exception as lk_error:
                        logger.warning(f"[POLLING] Could not fetch from LiveKit for meeting {meeting_id}: {lk_error}")
                        continue
                    
                    # ===== B: GET DATABASE ACTIVE PARTICIPANTS =====
                    cursor.execute("""
                        SELECT ID, User_ID, occurrence_number, Role, Leave_Times, Is_Currently_Active, Join_Times
                        FROM tbl_Participants 
                        WHERE Meeting_ID = %s AND Is_Currently_Active = TRUE
                    """, [meeting_id])
                    
                    db_participants = cursor.fetchall()
                    sync_results['participants_checked'] += len(db_participants)
                    
                    logger.debug(f"[POLLING] Meeting {meeting_id}: DB has {len(db_participants)} active participants")
                    
                    # ===== C: FIND WHO IS MISSING FROM LIVEKIT =====
                    for participant_row in db_participants:
                        (participant_id, user_id, occurrence_number, role, 
                         leave_times_json, is_active, join_times_json) = participant_row
                        
                        grace_key = f"{meeting_id}:{user_id}"
                        active_keys.add(grace_key)
                        
                        # Check if this user is still in LiveKit
                        is_still_in_livekit = False
                        
                        for livekit_identity in livekit_identities:
                            try:
                                prefix, identity_user_id, *_ = livekit_identity.split('_')
                                if prefix == 'user' and identity_user_id == str(user_id):
                                    is_still_in_livekit = True
                                    break
                            except ValueError:
                                continue

                        if is_still_in_livekit:
                            # User is in LiveKit — clear grace period if any
                            if grace_key in _missing_since:
                                logger.debug(f"[POLLING] User {user_id} reappeared in LiveKit — grace period cancelled")
                                del _missing_since[grace_key]
                        else:
                            # User NOT in LiveKit
                            now = time.time()
                            
                            # FIX: Skip users who joined very recently — LiveKit may not have registered them yet
                            skip_freshly_joined = False
                            try:
                                _join_times = json.loads(join_times_json) if isinstance(join_times_json, str) else (join_times_json or [])
                                if _join_times:
                                    _last_join_str = _join_times[-1]
                                    _last_join_dt = datetime.strptime(_last_join_str, '%Y-%m-%d %H:%M:%S')
                                    _ist_tz = pytz.timezone('Asia/Kolkata')
                                    if _last_join_dt.tzinfo is None:
                                        _last_join_dt = _ist_tz.localize(_last_join_dt)
                                    _current_ist = datetime.now(_ist_tz)
                                    _seconds_since_join = (_current_ist - _last_join_dt).total_seconds()
                                    if _seconds_since_join < GRACE_PERIOD_SECONDS:
                                        logger.debug(f"[POLLING] User {user_id} joined only {_seconds_since_join:.0f}s ago — skipping (waiting for LiveKit)")
                                        skip_freshly_joined = True
                            except Exception as _join_check_err:
                                logger.warning(f"[POLLING] Error checking join recency for user {user_id}: {_join_check_err}")
                            
                            if skip_freshly_joined:
                                if grace_key in _missing_since:
                                    del _missing_since[grace_key]
                            elif grace_key not in _missing_since:
                                # First time missing — start grace period
                                _missing_since[grace_key] = now
                                logger.debug(f"[POLLING] User {user_id} missing from LiveKit — grace period started ({GRACE_PERIOD_SECONDS}s)")
                            else:
                                # Already missing — check if grace period expired
                                elapsed = now - _missing_since[grace_key]
                                
                                if elapsed >= GRACE_PERIOD_SECONDS:
                                    # Grace period expired — mark as left
                                    logger.info(f"[POLLING] ❌ User {user_id} missing for {elapsed:.0f}s (>{GRACE_PERIOD_SECONDS}s) — marking as left")
                                    
                                    try:
                                        _mark_participant_as_left(
                                            cursor=cursor,
                                            participant_id=participant_id,
                                            user_id=user_id,
                                            leave_times_json=leave_times_json
                                        )
                                        sync_results['participants_marked_left'] += 1
                                        
                                        # Clean up grace tracker
                                        del _missing_since[grace_key]
                                        
                                    except Exception as process_error:
                                        logger.error(f"[POLLING] Error marking user {user_id} as left: {process_error}")
                                        sync_results['errors'].append(f"User {user_id}: {str(process_error)}")
                                else:
                                    logger.debug(f"[POLLING] User {user_id} missing for {elapsed:.0f}s — still in grace period")
                
                except Exception as meeting_error:
                    logger.error(f"[POLLING] Error processing meeting {meeting_id}: {meeting_error}")
                    sync_results['errors'].append(f"Meeting {meeting_id}: {str(meeting_error)}")
                    continue
        
        # Clean up stale grace period entries for users no longer in any active meeting
        stale_keys = [k for k in _missing_since if k not in active_keys]
        for k in stale_keys:
            del _missing_since[k]
        
        logger.info(f"""
✅ [POLLING] Sync cycle completed:
   - Meetings checked: {sync_results['meetings_checked']}
   - Participants checked: {sync_results['participants_checked']}
   - Marked as left: {sync_results['participants_marked_left']}
   - Errors: {len(sync_results['errors'])}
        """)
        
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
                WHERE ID = %s AND Is_Currently_Active = TRUE
            """, [
                json.dumps(leave_times),
                participant_id
            ])

        logger.info(f"✅ [POLLING] User {user_id} marked as left - Leave_Times stored in database")
        logger.info(f"   Leave time: {leave_time_str}")
    
    else:
        logger.info(f"[POLLING] Leave time already recorded for user {user_id}")