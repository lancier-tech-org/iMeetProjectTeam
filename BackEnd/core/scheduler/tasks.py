# core/scheduler/tasks.py
from celery import shared_task
import logging
from .recurring_scheduler import update_recurring_meetings, cleanup_old_meetings
from .email_scheduler import send_daily_invitation_emails, send_daily_meeting_reminders

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
        from core.utils.date_utils import get_current_ist_datetime
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

# ==========================================================
# 🎬 GPU Video Processing Task (NEW)
# ==========================================================
from core.UserDashBoard.recordings import process_video_sync
from celery import shared_task

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

@shared_task(name="process_video_task")
def process_video_task(s3_key_or_path, meeting_id, user_id):
    """
    Background Celery task for video processing.
    Accepts either a local file path (dev) or S3 key (production).
    """
    import tempfile
    import os
    import boto3

    logging.warning(f"🚀 [CELERY] Background video task received for meeting={meeting_id}")
    logging.info(f"📍 Input path/key: {s3_key_or_path}")

    video_path = None
    is_temp_file = False

    try:
        # Check if it's a local file path (starts with / and exists on disk)
        if s3_key_or_path.startswith('/') and os.path.exists(s3_key_or_path):
            # Local file - use directly (dev/local server mode)
            video_path = s3_key_or_path
            is_temp_file = False
            logging.info(f"📂 Using local file: {video_path}")
        else:
            # S3 key - download first (production mode)
            logging.info(f"☁️ Downloading from S3: {s3_key_or_path}")

            s3_client = boto3.client(
                "s3",
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                region_name=os.getenv("AWS_REGION", "ap-south-1")
            )
            bucket = os.getenv("AWS_S3_BUCKET", "imeetpro-prod-recordings")

            # Create temp file to download into
            temp_fd, video_path = tempfile.mkstemp(
                suffix='.mp4',
                prefix=f'celery_{meeting_id}_'
            )
            os.close(temp_fd)
            is_temp_file = True

            # Download from S3
            s3_client.download_file(bucket, s3_key_or_path, video_path)

            file_size = os.path.getsize(video_path)
            logging.info(f"✅ Downloaded from S3: {file_size:,} bytes")

            if file_size == 0:
                raise Exception("Downloaded file is empty")

        # Process the video
        result = process_video_sync(video_path, meeting_id, user_id)
        logging.info(f"✅ [CELERY] Video processing completed for meeting={meeting_id}")
        return result

    except Exception as e:
        logging.error(f"❌ [CELERY] Video processing failed for {meeting_id}: {e}")
        import traceback
        logging.error(traceback.format_exc())
        raise

    finally:
        # Clean up temp file if we downloaded from S3
        if is_temp_file and video_path and os.path.exists(video_path):
            try:
                os.remove(video_path)
                logging.info(f"🧹 Cleaned up temp file: {video_path}")
            except Exception as e:
                logging.warning(f"⚠️ Temp cleanup failed: {e}")

