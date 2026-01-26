# # core/apps.py
# from django.apps import AppConfig
# import logging

# logger = logging.getLogger(__name__)

# class CoreConfig(AppConfig):
#     default_auto_field = 'django.db.models.BigAutoField'
#     name = 'core'
    
#     def ready(self):
#         """Initialize LiveKit cleanup scheduler on app startup"""
#         try:
#             from apscheduler.schedulers.background import BackgroundScheduler
#             from core.WebSocketConnection.meetings import livekit_service
            
#             scheduler = BackgroundScheduler()
            
#             if not scheduler.running:
#                 # Schedule cleanup every 5 minutes
#                 scheduler.add_job(
#                     func=livekit_service.cleanup_empty_rooms,
#                     trigger="interval",
#                     minutes=5,
#                     id='cleanup_empty_rooms',
#                     name='Cleanup empty LiveKit rooms every 5 minutes',
#                     replace_existing=True,
#                     max_instances=1,
#                     coalesce=True
#                 )
                
#                 scheduler.start()
#                 logger.info("✅ [STARTUP] Room cleanup scheduler initialized")
#                 logger.info("🔄 [SCHEDULER] Cleanup interval: 5 minutes")
#                 logger.info("🧹 [SCHEDULER] Auto-deletes empty rooms after 5 minutes of inactivity")
        
#         except ImportError as e:
#             logger.warning(f"⚠️ [STARTUP] APScheduler not installed: {e}")
#             logger.warning("📦 Install with: pip install apscheduler")
        
#         except Exception as e:
#             logger.error(f"❌ [STARTUP] Failed to initialize cleanup scheduler: {e}")


"""
core/apps.py - Modified with Participant Polling

This combines your existing cleanup scheduler with the new polling task.
Both run in the same BackgroundScheduler instance.

Polling: Every 10 seconds
Cleanup: Every 5 minutes (existing)
"""

from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'
    _scheduler = None  # Store scheduler instance to prevent duplicates
    
    def ready(self):
        """Initialize schedulers on app startup"""
        try:
            from apscheduler.schedulers.background import BackgroundScheduler
            
            # Prevent duplicate scheduler initialization
            if CoreConfig._scheduler is not None and CoreConfig._scheduler.running:
                logger.info("⏭️ [STARTUP] Scheduler already running, skipping initialization")
                return
            
            logger.info("🚀 [STARTUP] Initializing APScheduler with multiple jobs...")
            
            scheduler = BackgroundScheduler()
            
            # ===== JOB 1: PARTICIPANT POLLING (Every 10 seconds) =====
            try:
                from core.scheduler.participant_polling import sync_participants_polling
                
                scheduler.add_job(
                    func=sync_participants_polling,
                    trigger="interval",
                    seconds=10,
                    id='sync_participants_polling',
                    name='Sync participants with LiveKit every 10 seconds',
                    replace_existing=True,
                    max_instances=1,
                    coalesce=True
                )
                logger.info("✅ [STARTUP] Participant polling job added")
                logger.info("   ⏱️  Interval: Every 10 seconds")
                logger.info("   📋 Task: Detect participant disconnects")
                logger.info("   💾 Action: Store leave time in database")
            except ImportError as e:
                logger.warning(f"⚠️ [STARTUP] Could not import participant polling: {e}")
            except Exception as e:
                logger.error(f"❌ [STARTUP] Failed to add polling job: {e}")
            
            # ===== JOB 2: CLEANUP EMPTY ROOMS (Every 5 minutes) - YOUR EXISTING JOB =====
            try:
                from core.WebSocketConnection.meetings import livekit_service
                
                scheduler.add_job(
                    func=livekit_service.cleanup_empty_rooms,
                    trigger="interval",
                    minutes=5,
                    id='cleanup_empty_rooms',
                    name='Cleanup empty LiveKit rooms every 5 minutes',
                    replace_existing=True,
                    max_instances=1,
                    coalesce=True
                )
                logger.info("✅ [STARTUP] Room cleanup job added")
                logger.info("   ⏱️  Interval: Every 5 minutes")
                logger.info("   🧹 Task: Delete empty rooms")
            except ImportError as e:
                logger.warning(f"⚠️ [STARTUP] Could not import cleanup task: {e}")
            except Exception as e:
                logger.error(f"❌ [STARTUP] Failed to add cleanup job: {e}")
            
            # ===== START THE SCHEDULER =====
            if not scheduler.running:
                scheduler.start()
                CoreConfig._scheduler = scheduler
                
                logger.info("")
                logger.info("=" * 70)
                logger.info("✅ [STARTUP] APScheduler initialized successfully!")
                logger.info("=" * 70)
                logger.info("📊 Jobs Running:")
                logger.info("   1️⃣  Participant Polling  → Every 10 seconds")
                logger.info("   2️⃣  Cleanup Empty Rooms  → Every 5 minutes")
                logger.info("=" * 70)
                logger.info("")
        
        except ImportError as e:
            logger.error(f"❌ [STARTUP] APScheduler not installed: {e}")
            logger.error("📦 Install with: pip install apscheduler")
        
        except Exception as e:
            logger.error(f"❌ [STARTUP] Failed to initialize schedulers: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")