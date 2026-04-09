# import os
# from celery import Celery

# os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# app = Celery('meeting_core')
# app.config_from_object('django.conf:settings', namespace='CELERY')
# app.autodiscover_tasks(['scheduler'])

import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('meeting_core')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks(['scheduler'])

# ===== CELERY BEAT SCHEDULE =====
app.conf.beat_schedule = {
    'close-stale-sessions-every-5-min': {
        'task': 'scheduler.tasks.close_stale_sessions_task',
        'schedule': 300.0,  # 5 minutes
    },
}