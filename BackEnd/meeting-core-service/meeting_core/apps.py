from django.apps import AppConfig
import logging
import os
import sys
import threading

logger = logging.getLogger(__name__)


class MeetingCoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "meeting_core"
    _triggered = False

    def ready(self):
        if any(cmd in sys.argv for cmd in (
            "migrate", "makemigrations", "collectstatic", "shell"
        )):
            return

        if os.getenv("DISABLE_SCHEDULER", "false").lower() == "true":
            logger.info("Scheduler disabled via env")
            return

        if MeetingCoreConfig._triggered:
            return
        MeetingCoreConfig._triggered = True

        threading.Thread(
            target=self._bootstrap_scheduler,
            daemon=True
        ).start()

        logger.info("✅ Meeting Core ready — scheduler bootstrap triggered")

    def _bootstrap_scheduler(self):
        from scheduler.bootstrap import start_scheduler_safely
        start_scheduler_safely()