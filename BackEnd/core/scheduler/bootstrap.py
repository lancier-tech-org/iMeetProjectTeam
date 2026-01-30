# core/scheduler/bootstrap.py

import logging
import os
import time
import redis
from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)


def acquire_scheduler_lock():
    """
    GLOBAL lock — ensures only ONE scheduler
    across ALL gunicorn workers.
    Works with REDIS_HOST / REDIS_PORT or REDIS_URL.
    """
    redis_url = os.getenv("REDIS_URL")

    if not redis_url:
        redis_host = os.getenv("REDIS_HOST", "redis.databases.svc.cluster.local")
        redis_port = int(os.getenv("REDIS_PORT", 6379))
        redis_url = f"redis://{redis_host}:{redis_port}/0"

    try:
        r = redis.Redis.from_url(redis_url)
        return r.set("core:scheduler:lock", "1", nx=True, ex=300)
    except Exception as e:
        logger.error(f"❌ Redis unavailable — scheduler will NOT start: {e}")
        return False


def start_scheduler_safely():
    # Give Django & Gunicorn time to serve traffic
    time.sleep(10)

    if not acquire_scheduler_lock():
        logger.info("⏭️ Scheduler already running in another worker")
        return

    logger.info("🚀 Starting APScheduler (single instance)")

    scheduler = BackgroundScheduler()

    # ===== JOB 1: PARTICIPANT POLLING =====
    scheduler.add_job(
        func=_lazy_participant_polling,
        trigger="interval",
        seconds=10,
        id="sync_participants_polling",
        name="Sync participants with LiveKit",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    # ===== JOB 2: CLEANUP EMPTY ROOMS =====
    scheduler.add_job(
        func=_lazy_cleanup_rooms,
        trigger="interval",
        minutes=5,
        id="cleanup_empty_rooms",
        name="Cleanup empty LiveKit rooms",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    scheduler.start()
    logger.info("✅ APScheduler initialized successfully!")


def _lazy_participant_polling():
    """
    IMPORTANT:
    Import happens INSIDE the job,
    not during scheduler startup.
    """
    from core.scheduler.participant_polling import sync_participants_polling
    sync_participants_polling()


def _lazy_cleanup_rooms():
    from core.WebSocketConnection.meetings import livekit_service
    livekit_service.cleanup_empty_rooms()
