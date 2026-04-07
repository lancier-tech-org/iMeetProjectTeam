"""
Celery task for GPU video processing.
Previously in core/scheduler/tasks.py — moved here since it belongs to recording service.
"""
from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task(name="process_video_task")
def process_video_task(video_path, meeting_id, user_id):
    """
    Background Celery task for GPU-accelerated video processing.
    """
    logger.warning(f"🚀 [CELERY] Background video task received for meeting={meeting_id}")
    try:
        from video_processing.recordings import process_video_sync
        return process_video_sync(video_path, meeting_id, user_id)
    except Exception as e:
        logger.error(f"❌ [CELERY] Video processing failed for {meeting_id}: {e}")
        raise