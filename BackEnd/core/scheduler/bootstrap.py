# core/scheduler/bootstrap.py
import logging
import os
import time
import redis
from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)

_scheduler = None


def acquire_scheduler_lock():
    """
    GLOBAL Redis lock
    Ensures only ONE scheduler runs across all Gunicorn workers
    """
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        logger.warning("⚠️ REDIS_URL not set — scheduler lock disabled")
        return True  # allow scheduler in single-instance setups

    try:
        r = redis.Redis.from_url(redis_url, socket_timeout=2)
        return r.set("core:scheduler:lock", "1", nx=True, ex=300)
    except Exception as e:
        logger.warning(f"⚠️ Redis lock failed: {e}")
        return True


def start_scheduler_safely():
    global _scheduler

    # ✅ CRITICAL FIX: Don't start scheduler in celery-worker pods
    if os.getenv("CELERY_WORKER_TYPE") == "worker":
        logger.info("⏭️ Skipping scheduler startup - running in celery-worker")
        return
    
    # ✅ CRITICAL FIX: Don't start scheduler if this is a Celery process
    if "celery" in os.getenv("CELERY_BIN", "").lower() or os.getenv("CELERY_LOADER"):
        logger.info("⏭️ Skipping scheduler startup - Celery process detected")
        return

    # Small delay so Gunicorn can finish startup
    time.sleep(5)

    if _scheduler and _scheduler.running:
        logger.info("⏭️ Scheduler already running")
        return

    if not acquire_scheduler_lock():
        logger.info("⏭️ Another worker owns the scheduler lock")
        return

    logger.info("🚀 Starting APScheduler (safe mode)")

    scheduler = BackgroundScheduler()

    # -------------------------------
    # JOB 1: Participant Polling
    # -------------------------------
    try:
        from core.scheduler.participant_polling import sync_participants_polling

        scheduler.add_job(
            func=sync_participants_polling,
            trigger="interval",
            seconds=10,
            id="sync_participants_polling",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )

        logger.info("✅ Participant polling scheduled (every 10s)")
    except Exception as e:
        logger.error(f"❌ Failed to add participant polling job: {e}")

    # -------------------------------
    # JOB 2: Cleanup Empty Rooms
    # -------------------------------
    try:
        from core.WebSocketConnection.meetings import livekit_service

        scheduler.add_job(
            func=livekit_service.cleanup_empty_rooms,
            trigger="interval",
            minutes=5,
            id="cleanup_empty_rooms",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )

        logger.info("✅ Empty room cleanup scheduled (every 5 min)")
    except Exception as e:
        logger.error(f"❌ Failed to add cleanup job: {e}")

    scheduler.start()
    _scheduler = scheduler

    logger.info("🎉 APScheduler started successfully")
