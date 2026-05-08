import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('recording_service')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks(['tasks'], related_name='video_tasks')

# Auto-recovery: explicitly load retry task (different filename)
import tasks.retry_pending_task  # noqa: F401  # registers @shared_task