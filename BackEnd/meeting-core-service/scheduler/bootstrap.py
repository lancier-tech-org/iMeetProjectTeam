# core/WebSocketConnection/polls.py
# Cache-based Poll/MCQ system - follows reactions.py pattern exactly

import redis
import json
import os
import time
import logging
import uuid
from datetime import datetime
from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.urls import path
from django.db import connection

logger = logging.getLogger('polls')

# ─── Redis config (same host as reactions) ──────────────────────────────────
POLL_REDIS_CONFIG = {
    'host': os.getenv("CACHE_REACTIONS_HOST", "localhost"),
    'port': int(os.getenv("CACHE_REACTIONS_PORT", 6379)),
    'db': int(os.getenv("POLL_REDIS_DB", 6)),          # separate DB from reactions (DB 5)
    'decode_responses': True,
    'socket_timeout': 5,
    'socket_connect_timeout': 5,
    'retry_on_timeout': True,
}

try:
    poll_redis = redis.Redis(**POLL_REDIS_CONFIG)
    poll_redis.ping()
    logger.info("✅ Poll Redis connected")
except Exception as e:
    logger.warning(f"⚠ Poll Redis not available: {e}")
    poll_redis = None

# ─── Constants ───────────────────────────────────────────────────────────────
POLL_TYPES = ['single', 'multiple', 'quiz']   # single-choice, multi-choice, scored quiz
MAX_OPTIONS = 6
MAX_QUESTION_LEN = 300
MAX_OPTION_LEN = 150
POLL_TTL_SECONDS = 86400   # 24 h — polls live as long as meeting cache exists


# ─── Redis key helpers ───────────────────────────────────────────────────────
def _poll_key(meeting_id, poll_id):
    return f"poll:{meeting_id}:{poll_id}"

def _polls_list_key(meeting_id):
    return f"polls_list:{meeting_id}"

def _votes_key(meeting_id, poll_id):
    return f"poll_votes:{meeting_id}:{poll_id}"

def _user_vote_key(meeting_id, poll_id, user_id):
    return f"poll_uservote:{meeting_id}:{poll_id}:{user_id}"

def _voters_detail_key(meeting_id, poll_id):
    """Hash: user_id -> json({name, options, voted_at})"""
    return f"poll_votersdetail:{meeting_id}:{poll_id}"


# ─── Helpers ─────────────────────────────────────────────────────────────────
def _check_redis():
    """Returns True if poll_redis is available."""
    if not poll_redis:
        return False
    try:
        poll_redis.ping()
        return True
    except Exception:
        return False


def _verify_host(meeting_id, user_id):
    """Check whether user_id is the host of meeting_id. Returns True/False."""
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT Host_ID FROM tbl_Meetings WHERE ID = %s", [meeting_id]
            )
            row = cursor.fetchone()
            return row and str(row[0]) == str(user_id)
    except Exception as e:
        logger.warning(f"Host check DB error: {e}")
        return False


def _build_results(poll_data, votes_raw):
    """
    Build live results dict from poll definition + raw Redis vote hash.
    votes_raw = {option_index_str: count_str, ...}
    """
    options = poll_data.get('options', [])
    poll_type = poll_data.get('poll_type', 'single')
    total_voters = poll_data.get('total_voters', 0)

    results = []
    for i, opt in enumerate(options):
        count = int(votes_raw.get(str(i), 0))
        pct = round((count / total_voters * 100), 1) if total_voters > 0 else 0.0
        result = {
            'index': i,
            'text': opt,
            'votes': count,
            'percentage': pct,
        }
        stored_corrects = poll_data.get('correct_options')
        if stored_corrects is not None:
            result['is_correct'] = (i in stored_corrects)
        results.append(result)

    return results


# ════════════════════════════════════════════════════════════════════════════
#  VIEWS
# ════════════════════════════════════════════════════════════════════════════

@require_http_methods(["POST"])
@csrf_exempt
def create_poll(request):
    """
    HOST creates a poll.

    Body:
    {
      "meeting_id": "xxxx-xxxx-xxx",
      "host_user_id": 5,
      "question": "Which feature do you prefer?",
      "options": ["Option A", "Option B", "Option C"],
      "poll_type": "single",          // single | multiple | quiz
      "correct_option": 1,            // optional for single/multiple, required for quiz (0-based index)
      "timer_seconds": 60,            // 0 = no timer
      "show_results_live": true       // participants see live results
    }
    """
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    meeting_id     = data.get('meeting_id')
    host_user_id   = data.get('host_user_id')
    question       = (data.get('question') or '').strip()
    options        = data.get('options', [])
    poll_type      = data.get('poll_type', 'single')
    correct_option = data.get('correct_option')       # int or None
    timer_seconds  = int(data.get('timer_seconds', 0))
    show_live      = bool(data.get('show_results_live', True))

    # ── Validation ──────────────────────────────────────────────────────────
    if not meeting_id or not host_user_id:
        return JsonResponse({'error': 'meeting_id and host_user_id are required'}, status=400)

    if not question or len(question) > MAX_QUESTION_LEN:
        return JsonResponse(
            {'error': f'question is required and must be ≤ {MAX_QUESTION_LEN} chars'}, status=400
        )

    if not isinstance(options, list) or len(options) < 2 or len(options) > MAX_OPTIONS:
        return JsonResponse(
            {'error': f'Provide 2–{MAX_OPTIONS} options'}, status=400
        )

    options = [str(o).strip()[:MAX_OPTION_LEN] for o in options]
    if any(o == '' for o in options):
        return JsonResponse({'error': 'Option text cannot be empty'}, status=400)

    if poll_type not in POLL_TYPES:
        return JsonResponse({'error': f'poll_type must be one of {POLL_TYPES}'}, status=400)

    # Normalise correct_option → correct_options list
    # Accepts: None | int | [int,...] | tuple | JSON-string from frontend
    correct_options = None
    if correct_option is not None:
        # Unwrap JSON string e.g. "[0,2]"
        if isinstance(correct_option, str):
            try:
                import json as _json
                correct_option = _json.loads(correct_option)
            except Exception:
                pass

        # Now handle list / tuple
        if isinstance(correct_option, (list, tuple)):
            try:
                correct_options = [int(x) for x in correct_option]
                if any(not (0 <= x < len(options)) for x in correct_options):
                    return JsonResponse({'error': 'correct_option index out of range'}, status=400)
            except (TypeError, ValueError):
                return JsonResponse({'error': 'correct_options must be integer indices'}, status=400)
        else:
            # Single integer
            try:
                idx = int(correct_option)
                if not (0 <= idx < len(options)):
                    return JsonResponse({'error': 'correct_option index out of range'}, status=400)
                correct_options = [idx]
            except (TypeError, ValueError):
                return JsonResponse({'error': 'correct_option must be an integer or list of integers'}, status=400)
    elif poll_type == 'quiz':
        return JsonResponse({'error': 'correct_option is required for quiz type'}, status=400)

    # ── Host permission ──────────────────────────────────────────────────────
    if not _verify_host(meeting_id, host_user_id):
        return JsonResponse({'error': 'Only the host can create polls'}, status=403)

    # ── Redis check ──────────────────────────────────────────────────────────
    if not _check_redis():
        return JsonResponse({'error': 'Cache service unavailable'}, status=503)

    # ── Build poll object ────────────────────────────────────────────────────
    poll_id = str(uuid.uuid4())[:8]          # short unique ID e.g. "a3f2b1c9"
    now_iso = timezone.now().isoformat()

    poll_data = {
        'poll_id':         poll_id,
        'meeting_id':      meeting_id,
        'host_user_id':    str(host_user_id),
        'question':        question,
        'options':         options,
        'poll_type':       poll_type,
        'correct_options': correct_options,   # list or None
        'timer_seconds':   timer_seconds,
        'show_results_live': show_live,
        'status':          'active',          # active | closed
        'created_at':      now_iso,
        'closed_at':       None,
        'total_voters':    0,
    }

    pk = _poll_key(meeting_id, poll_id)
    lk = _polls_list_key(meeting_id)

    poll_redis.set(pk, json.dumps(poll_data), ex=POLL_TTL_SECONDS)
    poll_redis.lpush(lk, poll_id)
    poll_redis.expire(lk, POLL_TTL_SECONDS)

    # Initialise vote counters to 0 for every option
    vk = _votes_key(meeting_id, poll_id)
    for i in range(len(options)):
        poll_redis.hset(vk, str(i), 0)
    poll_redis.expire(vk, POLL_TTL_SECONDS)

    logger.info(f"📊 Poll created: {poll_id} in meeting {meeting_id}")

    return JsonResponse({
        'success':   True,
        'poll_id':   poll_id,
        'poll':      poll_data,
        'broadcast_data': {                  # send this via LiveKit DataChannel
            'type':     'poll_created',
            'poll':     poll_data,
            'timestamp': now_iso,
        },
    }, status=201)


# ─────────────────────────────────────────────────────────────────────────────

@require_http_methods(["POST"])
@csrf_exempt
def submit_vote(request):
    """
    Participant submits a vote.

    Body:
    {
      "meeting_id": "xxxx-xxxx-xxx",
      "poll_id": "a3f2b1c9",
      "user_id": 12,
      "user_name": "Akhil",
      "selected_options": [1]          // list of option indices; single→ 1 item
    }
    """
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    meeting_id       = data.get('meeting_id')
    poll_id          = data.get('poll_id')
    user_id          = str(data.get('user_id', ''))
    user_name        = str(data.get('user_name', f'User_{user_id}'))
    selected_options = data.get('selected_options', [])

    if not all([meeting_id, poll_id, user_id]):
        return JsonResponse(
            {'error': 'meeting_id, poll_id and user_id are required'}, status=400
        )

    if not isinstance(selected_options, list) or len(selected_options) == 0:
        return JsonResponse({'error': 'selected_options must be a non-empty list'}, status=400)

    if not _check_redis():
        return JsonResponse({'error': 'Cache service unavailable'}, status=503)

    # ── Load poll ────────────────────────────────────────────────────────────
    pk = _poll_key(meeting_id, poll_id)
    raw = poll_redis.get(pk)
    if not raw:
        return JsonResponse({'error': 'Poll not found'}, status=404)

    poll_data = json.loads(raw)

    if poll_data['status'] != 'active':
        return JsonResponse({'error': 'Poll is closed'}, status=400)

    n_opts = len(poll_data['options'])
    poll_type = poll_data['poll_type']

    # Validate option indices
    for idx in selected_options:
        if not isinstance(idx, int) or not (0 <= idx < n_opts):
            return JsonResponse(
                {'error': f'Invalid option index: {idx}. Must be 0–{n_opts - 1}'}, status=400
            )

    if poll_type == 'single' and len(selected_options) > 1:
        return JsonResponse(
            {'error': 'single-choice poll allows only one selection'}, status=400
        )

    # ── Duplicate vote check ─────────────────────────────────────────────────
    uvk = _user_vote_key(meeting_id, poll_id, user_id)
    if poll_redis.exists(uvk):
        return JsonResponse({'error': 'You have already voted in this poll'}, status=400)

    # ── Record vote ──────────────────────────────────────────────────────────
    vk = _votes_key(meeting_id, poll_id)
    for idx in selected_options:
        poll_redis.hincrby(vk, str(idx), 1)

    # Mark user as voted (store their selection)
    poll_redis.set(uvk, json.dumps(selected_options), ex=POLL_TTL_SECONDS)

    # Store voter name + selection for host attendance view
    vdk = _voters_detail_key(meeting_id, poll_id)
    voter_detail = json.dumps({
        'name':      user_name,
        'options':   selected_options,
        'voted_at':  timezone.now().isoformat(),
    })
    poll_redis.hset(vdk, user_id, voter_detail)
    poll_redis.expire(vdk, POLL_TTL_SECONDS)

    # Increment voter count on poll object
    poll_data['total_voters'] = poll_data.get('total_voters', 0) + 1
    poll_redis.set(pk, json.dumps(poll_data), ex=POLL_TTL_SECONDS)

    # ── Build results snapshot ───────────────────────────────────────────────
    votes_raw = poll_redis.hgetall(vk)
    results   = _build_results(poll_data, votes_raw)

    # Quiz: check correctness
    is_correct = None
    stored_corrects = poll_data.get('correct_options')
    if stored_corrects is not None:
        # Fully correct = selected exactly the correct set
        is_correct = (set(selected_options) == set(stored_corrects))
        # Partial = selected some correct but not all (or extra wrong)
        selected_set = set(selected_options)
        correct_set  = set(stored_corrects)
        partial_correct = selected_set & correct_set  # intersection

    now_iso = timezone.now().isoformat()

    logger.info(f"🗳  User {user_id} voted in poll {poll_id} (meeting {meeting_id})")

    broadcast_data = {
        'type':          'poll_vote_update',
        'poll_id':       poll_id,
        'total_voters':  poll_data['total_voters'],
        'results':       results,
        'timestamp':     now_iso,
    }

    response = {
        'success':          True,
        'message':          'Vote recorded',
        'poll_id':          poll_id,
        'selected_options': selected_options,
        'total_voters':     poll_data['total_voters'],
        'broadcast_data':   broadcast_data,   # send via LiveKit DataChannel
    }

    if poll_data['show_results_live']:
        response['live_results'] = results

    stored_corrects = poll_data.get('correct_options')
    if stored_corrects is not None:
        response['is_correct']      = is_correct
        response['correct_options'] = stored_corrects  # list for frontend

    return JsonResponse(response, status=200)


# ─────────────────────────────────────────────────────────────────────────────

@require_http_methods(["GET"])
@csrf_exempt
def get_poll_results(request, meeting_id, poll_id):
    """
    GET live results for a specific poll.
    Query param: user_id (optional – returns whether that user already voted)
    """
    if not _check_redis():
        return JsonResponse({'error': 'Cache service unavailable'}, status=503)

    pk = _poll_key(meeting_id, poll_id)
    raw = poll_redis.get(pk)
    if not raw:
        return JsonResponse({'error': 'Poll not found'}, status=404)

    poll_data = json.loads(raw)
    vk        = _votes_key(meeting_id, poll_id)
    votes_raw = poll_redis.hgetall(vk)
    results   = _build_results(poll_data, votes_raw)

    user_id   = request.GET.get('user_id')
    user_voted = False
    user_selection = None
    if user_id:
        uvk = _user_vote_key(meeting_id, poll_id, user_id)
        uv  = poll_redis.get(uvk)
        if uv:
            user_voted     = True
            user_selection = json.loads(uv)

    # Build voter details list for host view
    vdk = _voters_detail_key(meeting_id, poll_id)
    raw_voters = poll_redis.hgetall(vdk)
    voters_detail = []
    for uid, vdata_raw in raw_voters.items():
        try:
            vdata = json.loads(vdata_raw)
            voters_detail.append({
                'user_id': uid,
                'name':    vdata.get('name', f'User {uid}'),
                'options': vdata.get('options', []),
                'voted_at': vdata.get('voted_at'),
            })
        except Exception:
            continue

    return JsonResponse({
        'success':        True,
        'poll_id':        poll_id,
        'question':       poll_data['question'],
        'options':        poll_data['options'],
        'poll_type':      poll_data['poll_type'],
        'status':         poll_data['status'],
        'total_voters':   poll_data['total_voters'],
        'results':        results,
        'voters_detail':  voters_detail,
        'user_voted':     user_voted,
        'user_selection': user_selection,
        'created_at':     poll_data['created_at'],
        'closed_at':      poll_data.get('closed_at'),
        'host_user_id':   poll_data.get('host_user_id', ''),
        'correct_options': poll_data.get('correct_options'),   # list or None – for color feedback
    }, status=200)


# ─────────────────────────────────────────────────────────────────────────────

@require_http_methods(["GET"])
@csrf_exempt
def list_polls(request, meeting_id):
    """
    GET all polls for a meeting (host view or participant view).
    Query param: user_id (optional – attaches has_voted per poll)
    """
    if not _check_redis():
        return JsonResponse({'error': 'Cache service unavailable'}, status=503)

    lk       = _polls_list_key(meeting_id)
    poll_ids = poll_redis.lrange(lk, 0, -1)  # newest first (lpush)
    user_id  = request.GET.get('user_id')

    polls = []
    for pid in poll_ids:
        pk  = _poll_key(meeting_id, pid)
        raw = poll_redis.get(pk)
        if not raw:
            continue

        poll_data = json.loads(raw)
        vk        = _votes_key(meeting_id, pid)
        votes_raw = poll_redis.hgetall(vk)
        results   = _build_results(poll_data, votes_raw)

        entry = {
            'poll_id':           pid,
            'question':          poll_data['question'],
            'options':           poll_data['options'],
            'poll_type':         poll_data['poll_type'],
            'status':            poll_data['status'],
            'total_voters':      poll_data['total_voters'],
            'results':           results,
            'created_at':        poll_data['created_at'],
            'closed_at':         poll_data.get('closed_at'),
            'timer_seconds':     poll_data.get('timer_seconds', 0),
            'show_results_live': poll_data.get('show_results_live', True),
            'correct_options':   poll_data.get('correct_options'),   # list or None
            'host_user_id':      poll_data.get('host_user_id', ''),
        }

        if user_id:
            uvk = _user_vote_key(meeting_id, pid, user_id)
            uv  = poll_redis.get(uvk)
            entry['has_voted']      = bool(uv)
            entry['user_selection'] = json.loads(uv) if uv else None

        # Always include voter details (host needs this)
        vdk = _voters_detail_key(meeting_id, pid)
        raw_voters = poll_redis.hgetall(vdk)
        voters_detail = []
        for uid, vdata_raw in raw_voters.items():
            try:
                vdata = json.loads(vdata_raw)
                voters_detail.append({
                    'user_id': uid,
                    'name':    vdata.get('name', f'User {uid}'),
                    'options': vdata.get('options', []),
                    'voted_at': vdata.get('voted_at'),
                })
            except Exception:
                continue
        entry['voters_detail'] = voters_detail
        entry['host_user_id']  = poll_data.get('host_user_id', '')

        polls.append(entry)

    return JsonResponse({
        'success':     True,
        'meeting_id':  meeting_id,
        'total_polls': len(polls),
        'polls':       polls,
    }, status=200)


# ─────────────────────────────────────────────────────────────────────────────

@require_http_methods(["POST"])
@csrf_exempt
def close_poll(request):
    """
    HOST closes an active poll.

    Body: { "meeting_id": "...", "poll_id": "...", "host_user_id": 5 }
    """
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    meeting_id   = data.get('meeting_id')
    poll_id      = data.get('poll_id')
    host_user_id = data.get('host_user_id')

    if not all([meeting_id, poll_id, host_user_id]):
        return JsonResponse(
            {'error': 'meeting_id, poll_id and host_user_id are required'}, status=400
        )

    if not _verify_host(meeting_id, host_user_id):
        return JsonResponse({'error': 'Only the host can close polls'}, status=403)

    if not _check_redis():
        return JsonResponse({'error': 'Cache service unavailable'}, status=503)

    pk  = _poll_key(meeting_id, poll_id)
    raw = poll_redis.get(pk)
    if not raw:
        return JsonResponse({'error': 'Poll not found'}, status=404)

    poll_data = json.loads(raw)
    if poll_data['status'] == 'closed':
        return JsonResponse({'error': 'Poll is already closed'}, status=400)

    now_iso = timezone.now().isoformat()
    poll_data['status']    = 'closed'
    poll_data['closed_at'] = now_iso
    poll_redis.set(pk, json.dumps(poll_data), ex=POLL_TTL_SECONDS)

    # Final results
    vk        = _votes_key(meeting_id, poll_id)
    votes_raw = poll_redis.hgetall(vk)
    results   = _build_results(poll_data, votes_raw)

    logger.info(f"🔒 Poll {poll_id} closed in meeting {meeting_id}")

    return JsonResponse({
        'success':       True,
        'poll_id':       poll_id,
        'status':        'closed',
        'closed_at':     now_iso,
        'total_voters':  poll_data['total_voters'],
        'final_results': results,
        'broadcast_data': {               # send via LiveKit DataChannel
            'type':          'poll_closed',
            'poll_id':       poll_id,
            'final_results': results,
            'total_voters':  poll_data['total_voters'],
            'timestamp':     now_iso,
        },
    }, status=200)


# ─────────────────────────────────────────────────────────────────────────────

@require_http_methods(["POST"])
@csrf_exempt
def delete_poll(request):
    """
    HOST deletes a poll (removes from Redis entirely).

    Body: { "meeting_id": "...", "poll_id": "...", "host_user_id": 5 }
    """
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    meeting_id   = data.get('meeting_id')
    poll_id      = data.get('poll_id')
    host_user_id = data.get('host_user_id')

    if not all([meeting_id, poll_id, host_user_id]):
        return JsonResponse(
            {'error': 'meeting_id, poll_id and host_user_id are required'}, status=400
        )

    if not _verify_host(meeting_id, host_user_id):
        return JsonResponse({'error': 'Only the host can delete polls'}, status=403)

    if not _check_redis():
        return JsonResponse({'error': 'Cache service unavailable'}, status=503)

    pk  = _poll_key(meeting_id, poll_id)
    vk  = _votes_key(meeting_id, poll_id)
    lk  = _polls_list_key(meeting_id)

    if not poll_redis.exists(pk):
        return JsonResponse({'error': 'Poll not found'}, status=404)

    vdk = _voters_detail_key(meeting_id, poll_id)
    poll_redis.delete(pk, vk, vdk)
    poll_redis.lrem(lk, 0, poll_id)  # remove from list

    logger.info(f"🗑 Poll {poll_id} deleted from meeting {meeting_id}")

    return JsonResponse({
        'success':   True,
        'message':   f'Poll {poll_id} deleted',
        'broadcast_data': {
            'type':    'poll_deleted',
            'poll_id': poll_id,
            'timestamp': timezone.now().isoformat(),
        },
    }, status=200)


# ─────────────────────────────────────────────────────────────────────────────

@require_http_methods(["POST"])
@csrf_exempt
def end_meeting_polls(request):
    """
    Called when meeting ends — wipes ALL poll data for that meeting.
    Same pattern as end_meeting_reactions().

    Body: { "meeting_id": "..." }
    """
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    meeting_id = data.get('meeting_id')
    if not meeting_id:
        return JsonResponse({'error': 'meeting_id is required'}, status=400)

    if not _check_redis():
        return JsonResponse({'success': True, 'message': 'Redis unavailable — nothing to delete'})

    lk       = _polls_list_key(meeting_id)
    poll_ids = poll_redis.lrange(lk, 0, -1)

    keys_to_delete = [lk]
    for pid in poll_ids:
        keys_to_delete.append(_poll_key(meeting_id, pid))
        keys_to_delete.append(_votes_key(meeting_id, pid))
        keys_to_delete.append(_voters_detail_key(meeting_id, pid))
        # user vote keys follow pattern poll_uservote:{mid}:{pid}:* — scan them
        pattern = f"poll_uservote:{meeting_id}:{pid}:*"
        for k in poll_redis.scan_iter(pattern):
            keys_to_delete.append(k)

    deleted = poll_redis.delete(*keys_to_delete) if keys_to_delete else 0
    logger.info(f"🗑 Deleted {deleted} poll keys for meeting {meeting_id}")

    return JsonResponse({
        'success':       True,
        'meeting_id':    meeting_id,
        'polls_deleted': len(poll_ids),
        'keys_deleted':  deleted,
    }, status=200)
