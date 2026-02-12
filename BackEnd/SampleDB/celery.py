# =============================================================================
# FILE 6 OF 7: celery.py (UPDATED)
# =============================================================================
# Location: SampleDB/celery.py  (REPLACE EXISTING FILE)
#
# WHAT CHANGED:
#   - Added task routing: verify_identity_gpu → identity_gpu_tasks queue
#   - Added queue definitions for identity_gpu_tasks and gpu_tasks
#   - Added result expiry (30 seconds — identity results are short-lived)
#   - Added serialization config (JSON for cross-pod transport)
# =============================================================================

import os
from celery import Celery
from kombu import Queue

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'SampleDB.settings')

app = Celery('SampleDB')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# =============================================================================
# QUEUE DEFINITIONS
# =============================================================================
# default            → regular Celery workers (celery-worker pod)
# gpu_tasks          → GPU worker pod (existing, for non-identity GPU work)
# identity_gpu_tasks → Identity Service pod (NEW, dedicated GPU for identity)
# =============================================================================
app.conf.task_queues = (
    Queue('default'),
    Queue('gpu_tasks'),
    Queue('identity_gpu_tasks'),
)
app.conf.task_default_queue = 'default'

# =============================================================================
# TASK ROUTING
# =============================================================================
# This ensures verify_identity_gpu tasks ALWAYS go to the identity-service pod
# and NEVER to the gpu-worker pod or regular celery workers.
# =============================================================================
app.conf.task_routes = {
    'verify_identity_gpu': {'queue': 'identity_gpu_tasks'},
}

# =============================================================================
# SERIALIZATION & RESULTS
# =============================================================================
app.conf.task_serializer = 'json'
app.conf.result_serializer = 'json'
app.conf.accept_content = ['json']
app.conf.result_expires = 30  # Identity results expire after 30 seconds

# Load task modules from all registered Django apps.
app.autodiscover_tasks()


@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')