# from core.WebSocketConnection import enhanced_logging_config
import asyncio
import threading
import time
import logging
import weakref
import os
import redis
from functools import wraps
import json
import tempfile
from datetime import datetime, timedelta
from typing import Dict, Optional, List, Tuple
import subprocess
from pathlib import Path
import signal
import queue
from concurrent.futures import ThreadPoolExecutor, as_completed
import cv2
import numpy as np
from PIL import Image
import ssl
import wave
from bson import ObjectId
import struct
from collections import deque
import math
from core.UserDashBoard.recordings import collection

# ADD THIS AT THE TOP (after imports):
import boto3
import io

# Configure S3
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET", "imeetpro-prod-recordings")

s3_client = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
)

S3_FOLDERS = {
    "videos": os.getenv("S3_FOLDER_VIDEOS", "videos"),
    "recordings_temp": os.getenv("S3_FOLDER_RECORDINGS_TEMP", "recordings_temp")
}

# =============================================================================
# STEP 2: ADD REDIS CONNECTION AFTER S3 CONFIG (around line 50)
# =============================================================================

# Redis connection for shared recording state across pods
REDIS_HOST = os.getenv('REDIS_HOST', 'redis.databases.svc.cluster.local')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
REDIS_RECORDING_DB = int(os.getenv('REDIS_RECORDING_DB', 2))  # Use separate DB for recordings

try:
    redis_client = redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_RECORDING_DB,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5
    )
    # Test connection
    redis_client.ping()
    logging.info(f"✅ Redis connected for recording state: {REDIS_HOST}:{REDIS_PORT} DB:{REDIS_RECORDING_DB}")
    REDIS_AVAILABLE = True
except Exception as e:
    logging.error(f"❌ Redis connection failed: {e}")
    redis_client = None
    REDIS_AVAILABLE = False

# Configure SSL to trust self-signed certificates BEFORE importing LiveKit
def configure_ssl_bypass():
    """Configure SSL to accept self-signed certificates"""
    try:
        import ssl
        import urllib3
        from urllib3.exceptions import InsecureRequestWarning
        
        # Disable SSL warnings
        urllib3.disable_warnings(InsecureRequestWarning)
        
        # Create unverified SSL context
        ssl._create_default_https_context = ssl._create_unverified_context
        
        # Set additional environment variables for Rust/WebRTC
        os.environ.update({
            'LIVEKIT_ACCEPT_INVALID_CERTS': '1',
            'LIVEKIT_SKIP_CERT_VERIFICATION': '1',
            'LIVEKIT_DISABLE_SSL_VERIFICATION': '1',
            'RUSTLS_DANGEROUS_INSECURE_CLIENT': '1',
            'RUST_TLS_DANGEROUS_DISABLE_VERIFICATION': '1',
            'WEBRTC_IGNORE_SSL_ERRORS': '1',
            'WEBSOCKET_SSL_VERIFY': 'false'
        })
        
        logging.info("✅ SSL bypass configured for self-signed certificates")
        return True
        
    except Exception as e:
        logging.error(f"❌ Failed to configure SSL bypass: {e}")
        return False

# Configure SSL BEFORE importing LiveKit
configure_ssl_bypass()

# Force LiveKit to use a more compatible event loop policy
if hasattr(asyncio, 'WindowsSelectorEventLoopPolicy'):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
elif hasattr(asyncio, 'DefaultEventLoopPolicy'):
    asyncio.set_event_loop_policy(asyncio.DefaultEventLoopPolicy())

# Patch asyncio to handle closed loop errors more gracefully
original_put_nowait = getattr(asyncio.Queue, 'put_nowait', None)

def safe_put_nowait(self, item):
    """Safe version of put_nowait that handles closed loops"""
    try:
        if hasattr(asyncio.Queue, '_put_nowait_original'):
            return self._put_nowait_original(item)
        else:
            return self._put_nowait(item)
    except RuntimeError as e:
        if "Event loop is closed" in str(e):
            pass
        else:
            raise

if original_put_nowait and not hasattr(asyncio.Queue, '_put_nowait_original'):
    asyncio.Queue._put_nowait_original = original_put_nowait
    asyncio.Queue.put_nowait = safe_put_nowait

from pymongo import MongoClient
from django.db import connection
from django.conf import settings

try:
    from livekit import api, rtc
    import jwt
    LIVEKIT_SDK_AVAILABLE = True
    logging.info("✅ LiveKit SDK loaded successfully")
except ImportError:
    LIVEKIT_SDK_AVAILABLE = False
    logging.error("❌ LiveKit SDK not available. Install with: pip install livekit")

logger = logging.getLogger('recording_service_module')

def setup_livekit_logging():
    """Set up logging to reduce LiveKit noise"""
    livekit_loggers = [
        'livekit',
        'livekit.rtc',
        'livekit.api',
        'livekit_ffi'
    ]
    
    for logger_name in livekit_loggers:
        lk_logger = logging.getLogger(logger_name)
        lk_logger.setLevel(logging.ERROR)
        
        class EventLoopErrorFilter(logging.Filter):
            def filter(self, record):
                message = record.getMessage()
                return not ("Event loop is closed" in message or 
                          "error putting to queue" in message)
        
        lk_logger.addFilter(EventLoopErrorFilter())

setup_livekit_logging()

class LiveKitEventLoopManager:
    """Manages LiveKit event loops to prevent 'Event loop is closed' errors"""
    
    def __init__(self):
        self._active_loops = weakref.WeakSet()
        self._cleanup_locks = {}
        self._shutdown_event = threading.Event()
        
    def register_loop(self, loop, identifier):
        """Register a loop for management"""
        self._active_loops.add(loop)
        self._cleanup_locks[identifier] = threading.Lock()
        
    def safe_run_until_complete(self, loop, coro, timeout=30, identifier=None):
        """Run coroutine with timeout and proper error handling"""
        if identifier and identifier in self._cleanup_locks:
            with self._cleanup_locks[identifier]:
                return self._run_with_timeout(loop, coro, timeout)
        else:
            return self._run_with_timeout(loop, coro, timeout)
    
    def _run_with_timeout(self, loop, coro, timeout):
        """Internal method to run coroutine with timeout"""
        try:
            if loop.is_closed():
                return None
                
            task = asyncio.ensure_future(coro, loop=loop)
            return loop.run_until_complete(
                asyncio.wait_for(task, timeout=timeout)
            )
            
        except asyncio.TimeoutError:
            logger.warning(f"Operation timed out after {timeout}s")
            return None
        except RuntimeError as e:
            if "Event loop is closed" in str(e):
                logger.debug("Event loop was already closed - this is expected during cleanup")
                return None
            raise
        except Exception as e:
            logger.warning(f"Operation failed: {e}")
            return None
    
    def force_cleanup_loop(self, loop, identifier=None):
        """Force cleanup of a loop with maximum effort"""
        if not loop or loop.is_closed():
            return
            
        try:
            if identifier and identifier in self._cleanup_locks:
                with self._cleanup_locks[identifier]:
                    self._do_force_cleanup(loop)
            else:
                self._do_force_cleanup(loop)
                
        except Exception as e:
            logger.warning(f"Force cleanup error: {e}")
        finally:
            if identifier and identifier in self._cleanup_locks:
                del self._cleanup_locks[identifier]
    
    def cleanup_all_loops(self):
        """Cleanup all managed loops"""
        try:
            logger.info("Cleaning up all event loops...")
            for loop in list(self._active_loops):
                try:
                    if not loop.is_closed():
                        self._do_force_cleanup(loop)
                except:
                    pass
            
            self._active_loops.clear()
            self._cleanup_locks.clear()
            logger.info("All event loops cleaned up")
        except Exception as e:
            logger.warning(f"Error during cleanup_all_loops: {e}")
    
    def _do_force_cleanup(self, loop):
        """Perform the actual force cleanup"""
        try:
            if not loop.is_closed():
                pending = asyncio.all_tasks(loop)
                if pending:
                    for task in pending:
                        if not task.done():
                            task.cancel()
                    
                    try:
                        loop.run_until_complete(
                            asyncio.wait_for(
                                asyncio.gather(*pending, return_exceptions=True),
                                timeout=5.0
                            )
                        )
                    except:
                        pass
            
            time.sleep(2.0)
            
            if not loop.is_closed():
                loop.close()
                
        except Exception:
            try:
                if not loop.is_closed():
                    loop.close()
            except:
                pass

loop_manager = LiveKitEventLoopManager()

# ====== S3 CHUNK UPLOADER (NO CHANGES NEEDED) ======
class S3ChunkUploader:
    """Uploads file chunks to S3 using MULTIPART UPLOAD"""
    
    def __init__(self, bucket: str, s3_key: str, chunk_size_mb: int = 5):
        self.bucket = bucket
        self.s3_key = s3_key
        self.chunk_size = chunk_size_mb * 1024 * 1024
        
        self.last_uploaded_size = 0
        self.total_uploaded = 0
        self.is_uploading = True
        self.upload_thread = None
        self.lock = threading.Lock()
        
        self.multipart_upload_id = None
        self.part_number = 0
        self.uploaded_parts = []
        
        logger.info(f"🚀 S3 Chunk Uploader (Multipart) initialized: {s3_key} ({chunk_size_mb}MB chunks)")
    
    def start_chunk_monitor(self, local_file_path: str):
        """Start background thread to monitor and upload chunks"""
        self.upload_thread = threading.Thread(
            target=self._chunk_upload_loop,
            args=(local_file_path,),
            daemon=False
        )
        self.upload_thread.start()
        logger.info(f"📤 Chunk upload monitor started for: {local_file_path}")
    
    def _chunk_upload_loop(self, local_file_path: str):
        """Continuously monitor local file and upload new chunks to S3 using multipart"""
        try:
            check_interval = 0.5
            last_log_time = time.time()
            
            while self.is_uploading:
                try:
                    if not os.path.exists(local_file_path):
                        time.sleep(check_interval)
                        continue
                    
                    current_size = os.path.getsize(local_file_path)
                    
                    if current_size >= self.last_uploaded_size + self.chunk_size:
                        self.part_number += 1
                        self._upload_chunk_multipart(
                            local_file_path,
                            self.last_uploaded_size,
                            current_size,
                            self.part_number
                        )
                        self.last_uploaded_size = current_size
                    
                    now = time.time()
                    if now - last_log_time >= 5:
                        logger.info(
                            f"📊 Upload progress: {self.total_uploaded / (1024*1024):.1f}MB uploaded, "
                            f"Local file: {current_size / (1024*1024):.1f}MB, "
                            f"Parts: {len(self.uploaded_parts)}"
                        )
                        last_log_time = now
                    
                    time.sleep(check_interval)
                    
                except Exception as e:
                    logger.warning(f"⚠️ Chunk monitor error: {e}")
                    time.sleep(check_interval)
        
        except Exception as e:
            logger.error(f"❌ Chunk upload loop failed: {e}")
        finally:
            logger.info("🛑 Chunk upload monitor stopped")
    
    def _upload_chunk_multipart(self, local_file_path: str, start_byte: int, end_byte: int, part_number: int):
        """Upload a chunk using S3 multipart upload"""
        try:
            if self.multipart_upload_id is None:
                response = s3_client.create_multipart_upload(
                    Bucket=self.bucket,
                    Key=self.s3_key
                )
                self.multipart_upload_id = response['UploadId']
                logger.info(f"✅ Initiated multipart upload: {self.multipart_upload_id}")
            
            with open(local_file_path, 'rb') as f:
                f.seek(start_byte)
                chunk_data = f.read(end_byte - start_byte)
            
            if not chunk_data:
                return
            
            chunk_size_mb = len(chunk_data) / (1024 * 1024)
            
            response = s3_client.upload_part(
                Bucket=self.bucket,
                Key=self.s3_key,
                PartNumber=part_number,
                UploadId=self.multipart_upload_id,
                Body=chunk_data
            )
            
            etag = response['ETag']
            part_info = {
                'ETag': etag,
                'PartNumber': part_number
            }
            self.uploaded_parts.append(part_info)
            
            with self.lock:
                self.total_uploaded += len(chunk_data)
            
            logger.info(
                f"✅ Part {part_number} uploaded: {chunk_size_mb:.1f}MB "
                f"(Total: {self.total_uploaded / (1024*1024):.1f}MB) | ETag: {etag[:20]}..."
            )
        
        except Exception as e:
            logger.error(f"❌ Part {part_number} upload failed: {e}")
    
    def stop_and_upload_final(self, local_file_path: str):
        """Stop monitoring, upload final chunk, and complete multipart upload - FIXED"""
        self.is_uploading = False
        
        if self.upload_thread and self.upload_thread.is_alive():
            logger.info("⏳ Waiting for chunk upload thread to finish...")
            self.upload_thread.join(timeout=60)
            
            if self.upload_thread.is_alive():
                logger.warning("⚠️ Upload thread still running after 60s")
        
        # ✅ CHANGED: Longer wait for production stability
        logger.info("⏳ Waiting for file to be fully written by FFmpeg...")
        logger.info("   Production environment needs more time for I/O sync...")
        time.sleep(15)  # ✅ CHANGED: 5 → 15 seconds for production
        
        # ✅ NEW: Verify file size stabilizes
        if os.path.exists(local_file_path):
            prev_size = os.path.getsize(local_file_path)
            time.sleep(3)
            curr_size = os.path.getsize(local_file_path)
            if curr_size != prev_size:
                logger.warning(f"⚠️ File still growing: {prev_size} → {curr_size} bytes")
                time.sleep(5)  # Extra wait
        
        try:
            if os.path.exists(local_file_path):
                current_size = os.path.getsize(local_file_path)
                
                if current_size > self.last_uploaded_size:
                    logger.info(f"📤 Uploading final chunk: {current_size - self.last_uploaded_size} bytes")
                    self.part_number += 1
                    self._upload_chunk_multipart(
                        local_file_path,
                        self.last_uploaded_size,
                        current_size,
                        self.part_number
                    )
                
                logger.info(f"✅ All chunks uploaded: {self.total_uploaded / (1024*1024):.1f}MB total")
        except Exception as e:
            logger.error(f"❌ Final chunk upload failed: {e}")
        
        try:
            if self.multipart_upload_id and len(self.uploaded_parts) > 0:
                logger.info(f"🔗 Completing multipart upload with {len(self.uploaded_parts)} parts...")
                
                self.uploaded_parts.sort(key=lambda x: x['PartNumber'])
                
                response = s3_client.complete_multipart_upload(
                    Bucket=self.bucket,
                    Key=self.s3_key,
                    UploadId=self.multipart_upload_id,
                    MultipartUpload={
                        'Parts': self.uploaded_parts
                    }
                )
                
                logger.info(f"✅ Multipart upload completed: {response['Key']}")
                logger.info(f"📊 Final file ETag: {response['ETag']}")
            else:
                logger.warning("⚠️ No multipart upload to complete")
        
        except Exception as e:
            logger.error(f"❌ Multipart upload completion failed: {e}")
            try:
                if self.multipart_upload_id:
                    s3_client.abort_multipart_upload(
                        Bucket=self.bucket,
                        Key=self.s3_key,
                        UploadId=self.multipart_upload_id
                    )
                    logger.info(f"🛑 Aborted multipart upload")
            except Exception as abort_error:
                logger.warning(f"⚠️ Could not abort multipart upload: {abort_error}")

# ====== TIMELINE MANAGER (NEW - ADD THIS) ======
class TimelineManager:
    """Single source of truth for recording timeline - handles pause/resume"""
    
    def __init__(self):
        self.timeline_pts = 0.0  # Current position in seconds
        self.is_paused = False
        self.is_active = False
        self.last_update_time = None
        self.lock = threading.Lock()
        self.update_thread = None
        self.stop_event = threading.Event()
        
        logger.info("✅ Timeline Manager initialized")
    
    def start(self):
        """Start the timeline"""
        with self.lock:
            self.is_active = True
            self.is_paused = False
            self.timeline_pts = 0.0
            self.last_update_time = time.perf_counter()
            self.stop_event.clear()
        
        # Start timeline update thread
        self.update_thread = threading.Thread(
            target=self._timeline_update_loop,
            daemon=True,  # ✅ CHANGED: daemon=True for safe shutdown
            name="TimelineManager"
        )
        self.update_thread.start()
        logger.info("🎬 Timeline started at 0.0s")
    
    def pause(self):
        """Pause the timeline - freezes time"""
        with self.lock:
            if not self.is_paused and self.is_active:
                self.is_paused = True
                pause_pts = self.timeline_pts
                logger.info(f"⏸️  Timeline PAUSED at {pause_pts:.3f}s")
                return pause_pts
            return None
    
    def resume(self):
        """Resume the timeline - time continues from where it paused"""
        with self.lock:
            if self.is_paused and self.is_active:
                self.is_paused = False
                self.last_update_time = time.perf_counter()  # Reset reference
                resume_pts = self.timeline_pts
                logger.info(f"▶️  Timeline RESUMED at {resume_pts:.3f}s")
                return resume_pts
            return None
    
    def get_current_pts(self) -> float:
        """Get current timeline position (thread-safe)"""
        with self.lock:
            return self.timeline_pts
    
    def stop(self):
        """Stop the timeline"""
        with self.lock:
            self.is_active = False
            final_pts = self.timeline_pts
        
        self.stop_event.set()
        
        # Only join if thread exists and is alive
        if self.update_thread and self.update_thread.is_alive():
            self.update_thread.join(timeout=2)  # Reduced timeout
            if self.update_thread.is_alive():
                logger.warning("⚠️ Timeline thread didn't stop cleanly (daemon will exit)")
        
        logger.info(f"🛑 Timeline stopped at {final_pts:.3f}s")
        return final_pts
    
    def _timeline_update_loop(self):
        """Background thread that advances timeline when not paused"""
        logger.info("🔄 Timeline update loop started")
        
        while not self.stop_event.is_set():
            try:
                with self.lock:
                    if self.is_active:
                        current_time = time.perf_counter()
                        
                        # Only advance timeline when NOT paused
                        if not self.is_paused and self.last_update_time is not None:
                            delta = current_time - self.last_update_time
                            self.timeline_pts += delta
                        
                        # ALWAYS update last_update_time (even during pause)
                        # This prevents jump when resuming
                        self.last_update_time = current_time
                
                time.sleep(0.01)

            except Exception as e:
                logger.error(f"Timeline update error: {e}")
                time.sleep(0.1)
        
        logger.info("✅ Timeline update loop stopped")
 
class StreamingRecordingWithChunks:
    """Production-ready streaming recorder with constant memory"""
    
    def __init__(self, meeting_id: str, target_fps: int = 20, session_id: str = None):  # ✅ NEW: Accept session_id
        self.meeting_id = meeting_id
        self.target_fps = target_fps
        
        # ✅ FIXED: Use passed session_id or generate new one
        if session_id:
            self.session_id = session_id
            logger.info(f"✅ Using provided session_id: {session_id}")
        else:
            import uuid
            self.session_id = str(uuid.uuid4())[:8]
            logger.warning(f"⚠️ No session_id provided, generated new one: {self.session_id}")
        
        self.s3_prefix = f"{S3_FOLDERS['recordings_temp']}/{meeting_id}/{self.session_id}"

        # Single timeline for entire recording
        self.timeline = TimelineManager()
        
        # Stop event for audio clock thread
        self.stop_event = threading.Event()

        # TWO separate FFmpeg processes
        self.ffmpeg_video_process = None
        self.ffmpeg_audio_process = None
        self.ffmpeg_video_pipe = None
        self.ffmpeg_audio_pipe = None

        # Separate output files
        self.temp_audio_path = None
        self.audio_fifo_path = None
        self.audio_fifo_writer = None

        # Video pacing control
        self.frame_interval = 1.0 / target_fps
        
        # Temp output file - ✅ NOW INCLUDES SESSION ID
        self.temp_video_fd, self.temp_video_path = tempfile.mkstemp(
            suffix='.mp4',
            prefix=f'recording_{meeting_id}_{self.session_id}_'
        )

        os.close(self.temp_video_fd)
        
        # Audio pacing control
        self.audio_sample_rate = 48000  # Hz
        self.audio_channels = 2
        self.samples_per_second = self.audio_sample_rate * self.audio_channels
        self.next_audio_pts = 0.0
        self.audio_buffer = []  # Small bounded buffer for partial samples
        self.max_audio_buffer_samples = 4800  # 50ms max buffer

        # S3 upload - ✅ NOW INCLUDES SESSION ID
        self.s3_video_key = f"{self.s3_prefix}/recording_{meeting_id}_{self.session_id}.mp4"
        self.chunk_uploader = None
        
        # Track guard for LiveKit compatibility (NO buffering, just flags)
        self.processing_tracks = set()

        # Screen share detection - CRITICAL for preventing blinking
        self.has_screen_share = False
        self.last_screen_frame = None  # Store last frame for gap filling
        self.last_screen_frame_time = 0  # When was last frame received
        self.screen_share_lock = threading.Lock()
        
        # ✅ NEW: Ring buffer for timeline-driven video writing
        from collections import deque
        self.frame_ring_buffer = deque(maxlen=10)  # Last 10 frames
        self.frame_buffer_lock = threading.Lock()
        self.video_writer_thread = None
        self.placeholder_frame = None  # Generated once on startup

        # Audio mixer for multiple sources
        self.audio_sources = {}  # {source_id: deque of samples}
        self.audio_mixer_lock = threading.Lock()
        self.max_audio_source_buffer = 9600  # 100ms per source at 48kHz stereo

        # State
        self.is_recording = False
        self.frames_written = 0
        self.audio_samples_written = 0
        
        # NEW: Audio draining state tracking
        self.audio_accepting_new_data = False
        self.audio_buffers_empty = False
        self.audio_drain_complete = False
        self.audio_fifo_closed = False
        
        # Locks
        self.video_lock = threading.Lock()
        self.audio_lock = threading.Lock()
        
        # Audio state
        self.audio_enabled = False  # Set True only when FIFO is ready
        
        logger.info(f"✅ Production Recorder initialized - Target: {target_fps} FPS")
        logger.info(f"📝 Output file: {self.temp_video_path}")

    def _create_placeholder_frame(self):
        """Create a placeholder frame for when no screen share is active"""
        try:
            import cv2
            import numpy as np
            
            # Create 1280x720 dark gray frame
            frame = np.full((720, 1280, 3), 40, dtype=np.uint8)
            
            # Add text: "Waiting for screen share..."
            text = "Waiting for screen share..."
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 1.5
            thickness = 3
            color = (200, 200, 200)
            
            # Get text size for centering
            text_size = cv2.getTextSize(text, font, font_scale, thickness)[0]
            text_x = (1280 - text_size[0]) // 2
            text_y = (720 + text_size[1]) // 2
            
            cv2.putText(frame, text, (text_x, text_y), font, font_scale, color, thickness)
            
            self.placeholder_frame = frame
            logger.info("✅ Placeholder frame created")
            
        except Exception as e:
            logger.error(f"Failed to create placeholder: {e}")
            # Fallback: solid gray frame
            self.placeholder_frame = np.full((720, 1280, 3), 60, dtype=np.uint8)

    def _start_audio_clock_thread(self):
        """Independent master clock that pulls & writes audio at perfect rate"""
        def audio_clock_loop():
            logger.info("⏰ Audio master clock thread started (48kHz stereo)")
            interval = 0.020  # 20 ms chunks
            samples_per_chunk = int(48000 * 2 * interval)  # 1920 samples stereo

            # ✅ FIX: Use timeline as the authoritative clock, not perf_counter
            last_buffer_check = time.perf_counter()
            consecutive_empty_checks = 0
            
            # ✅ FIX: Track when we last wrote samples to avoid writing too fast
            last_write_time = time.perf_counter()

            while True:
                try:
                    if self.timeline.is_paused:
                        time.sleep(0.1)
                        last_write_time = time.perf_counter()  # ✅ Reset on resume
                        continue
                    
                    # Check if we should enter draining mode
                    if not self.is_recording and not self.audio_accepting_new_data:
                        now = time.perf_counter()
                        if now - last_buffer_check >= 0.5:
                            buffers_empty = self._check_all_audio_buffers_empty()
                            last_buffer_check = now
                            
                            if buffers_empty:
                                consecutive_empty_checks += 1
                                if consecutive_empty_checks >= 3:
                                    logger.info("🎵 All audio buffers empty for 1.5s - entering final flush mode")
                                    self.audio_buffers_empty = True
                                    break
                                else:
                                    logger.info(f"🎵 Buffers empty ({consecutive_empty_checks}/3 checks)")
                            else:
                                consecutive_empty_checks = 0
                                non_empty = self._count_non_empty_audio_buffers()
                                logger.info(f"🎵 Still draining audio - {non_empty} source(s) with data")

                    # ✅ FIX: Calculate when we SHOULD write next based on timeline
                    current_timeline_pts = self.timeline.get_current_pts()
                    expected_samples_by_now = int(current_timeline_pts * 48000 * 2)
                    samples_behind = expected_samples_by_now - self.audio_samples_written
                    
                    # ✅ FIX: Only write if we're behind the timeline by at least one chunk
                    if samples_behind >= samples_per_chunk:
                        self._mix_and_write_audio_chunk(target_samples=samples_per_chunk)
                        last_write_time = time.perf_counter()
                    else:
                        # ✅ FIX: Sleep until we expect to be behind by one chunk
                        # Calculate how long until timeline advances enough for next chunk
                        time_per_chunk = interval  # 0.020 seconds
                        now = time.perf_counter()
                        time_since_write = now - last_write_time
                        
                        # Sleep for remaining time in this chunk period
                        sleep_duration = max(0.001, time_per_chunk - time_since_write)
                        time.sleep(sleep_duration)
                        
                except Exception as e:
                    logger.error(f"Audio clock error: {e}")
                    time.sleep(0.1)
          
                except Exception as e:
                    logger.error(f"Audio clock error: {e}")
                    time.sleep(0.1)

            # FINAL FLUSH: Write EXACT deficit to match timeline
            logger.info("🎵 Audio clock: Final flush sequence starting...")
            try:
                with self.audio_lock:
                    if self.audio_enabled and self.audio_fifo_writer:
                        # ✅ CRITICAL FIX: Calculate EXACT audio deficit
                        final_timeline_pts = self.timeline.get_current_pts()
                        expected_total_samples = int(final_timeline_pts * 48000 * 2)
                        samples_deficit = expected_total_samples - self.audio_samples_written
                        
                        logger.info(f"📊 Final audio analysis:")
                        logger.info(f"   Timeline: {final_timeline_pts:.2f}s")
                        logger.info(f"   Expected samples: {expected_total_samples}")
                        logger.info(f"   Actual samples: {self.audio_samples_written}")
                        logger.info(f"   Deficit: {samples_deficit} samples ({samples_deficit / (48000 * 2):.2f}s)")
                        
                        # ✅ FIX: Write EXACT deficit, not fixed 2 seconds
                        if samples_deficit > 0:
                            logger.info(f"📝 Writing {samples_deficit / (48000 * 2):.2f}s of compensating silence...")
                            
                            remaining = samples_deficit
                            while remaining > 0:
                                chunk_size = min(samples_per_chunk, remaining)
                                silence = np.zeros(chunk_size, dtype=np.int16)
                                self.audio_fifo_writer.write(silence.tobytes())
                                self.audio_samples_written += chunk_size
                                remaining -= chunk_size
                            
                            logger.info(f"✅ Wrote {samples_deficit} deficit samples")
                        else:
                            logger.info(f"✅ No deficit - audio matches timeline")
                        
                        # Extended flush
                        for i in range(10):
                            self.audio_fifo_writer.flush()
                            time.sleep(0.5)
                        
                        if hasattr(self.audio_fifo_writer, 'fileno'):
                            try:
                                os.fsync(self.audio_fifo_writer.fileno())
                                time.sleep(1.0)
                            except:
                                pass
                        
                        logger.info(f"✅ Audio FIFO flushed - Final sample count: {self.audio_samples_written}")
                
                self.audio_drain_complete = True
                logger.info("⏰ Audio master clock thread stopped - drain complete")

            except Exception as e:
                logger.error(f"❌ Final flush error: {e}")
                self.audio_drain_complete = True

        self.audio_clock_thread = threading.Thread(
            target=audio_clock_loop,
            name="AudioMasterClock",
            daemon=True
        )
        self.audio_clock_thread.start()
        logger.info("✅ Audio master clock thread launched")
    
    def _check_all_audio_buffers_empty(self) -> bool:
        """Check if all audio source buffers are empty"""
        try:
            with self.audio_mixer_lock:
                if not self.audio_sources:
                    return True
                
                for source_key, buffer in self.audio_sources.items():
                    if len(buffer) > 0:
                        return False
                
                return True
        except:
            return False
    
    def _count_non_empty_audio_buffers(self) -> int:
        """Count how many audio source buffers still have data"""
        try:
            with self.audio_mixer_lock:
                count = 0
                for source_key, buffer in self.audio_sources.items():
                    if len(buffer) > 0:
                        count += 1
                return count
        except:
            return 0
        
    def start_recording(self):
        """Start recording with TWO separate FFmpeg processes"""
        try:
            import tempfile  # ← MOVE THIS TO THE TOP
            
            # Start timeline
            self.timeline.start()
            self.stop_event.clear()  # Reset stop event for new recording
            self.is_recording = False   
            # Create temp audio file - ✅ NOW INCLUDES SESSION ID
            audio_fd, self.temp_audio_path = tempfile.mkstemp(
                suffix='.wav',
                prefix=f'audio_{self.meeting_id}_{self.session_id}_'
            )
            os.close(audio_fd)
            
            # Create audio FIFO - ✅ NOW INCLUDES SESSION ID
            temp_dir = tempfile.gettempdir()
            self.audio_fifo_path = os.path.join(temp_dir, f'audio_{self.meeting_id}_{self.session_id}.fifo')

            if os.path.exists(self.audio_fifo_path):
                os.remove(self.audio_fifo_path)

            os.mkfifo(self.audio_fifo_path)
            logger.info(f"✅ Created audio FIFO: {self.audio_fifo_path}")
            
            # ==================== START VIDEO FFMPEG ====================
            video_cmd = [
                'ffmpeg', '-y',
                '-f', 'rawvideo',
                '-pix_fmt', 'bgr24',
                '-s', '1280x720',
                '-r', str(self.target_fps),
                '-i', 'pipe:0',
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-crf', '23',
                '-pix_fmt', 'yuv420p',
                '-an',  # No audio
                self.temp_video_path
            ]
            
            self.ffmpeg_video_process = subprocess.Popen(
                video_cmd,
                stdin=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdout=subprocess.PIPE
            )
            
            self.ffmpeg_video_pipe = self.ffmpeg_video_process.stdin
            logger.info(f"🎬 Video FFmpeg started - PID: {self.ffmpeg_video_process.pid}")
            
            # Start video stderr drain
            self.video_stderr_thread = threading.Thread(
                target=self._drain_stderr,
                args=(self.ffmpeg_video_process, "Video"),
                daemon=True
            )
            self.video_stderr_thread.start()
            
            # ==================== START AUDIO FFMPEG ====================
            audio_cmd = [
                'ffmpeg', '-y',
                '-f', 's16le',
                '-ar', '48000',
                '-ac', '2',
                '-i', self.audio_fifo_path,
                '-c:a', 'pcm_s16le',  # WAV format
                self.temp_audio_path
            ]
            
            self.ffmpeg_audio_process = subprocess.Popen(
                audio_cmd,
                stderr=subprocess.PIPE,
                stdout=subprocess.PIPE
            )
            
            logger.info(f"🎤 Audio FFmpeg started - PID: {self.ffmpeg_audio_process.pid}")
            
            # Open audio FIFO in background (non-blocking)
            def open_audio_fifo():
                try:
                    logger.info("🔄 Opening audio FIFO for writing...")
                    self.audio_fifo_writer = open(self.audio_fifo_path, 'wb', buffering=0)
                    logger.info("✅ Audio FIFO opened for writing")
                except Exception as e:
                    logger.error(f"❌ Audio FIFO error: {e}")
            
            fifo_thread = threading.Thread(target=open_audio_fifo, daemon=True)
            fifo_thread.start()
            fifo_thread.join(timeout=10)  # Increased timeout
            
            if not self.audio_fifo_writer:
                logger.warning("⚠️ Audio FIFO didn't open in 10s - continuing with video only")
                self.audio_enabled = False
            else:
                self.audio_enabled = True
                logger.info("✅ Audio FIFO ready for writing")
            
            self.ffmpeg_audio_pipe = self.audio_fifo_writer
            
            # Start audio stderr drain
            self.audio_stderr_thread = threading.Thread(
                target=self._drain_stderr,
                args=(self.ffmpeg_audio_process, "Audio"),
                daemon=True
            )
            self.audio_stderr_thread.start()
            
            # CRITICAL: Wait a moment for FFmpeg to be fully ready
            time.sleep(0.5)
            
            # Enable recording ONLY after all pipes are ready
            self.is_recording = True
            self.audio_accepting_new_data = True  # NEW: Start accepting audio
            logger.info("✅ All pipes ready - recording enabled")
            
            self._start_audio_clock_thread()
            
            # ✅ NEW: Start timeline-driven video writer
            self._create_placeholder_frame()
            self._start_video_writer_thread()

            # Start chunk uploader (video only)
            self.chunk_uploader = S3ChunkUploader(
                bucket=AWS_S3_BUCKET,
                s3_key=self.s3_video_key,
                chunk_size_mb=5
            )
            self.chunk_uploader.start_chunk_monitor(self.temp_video_path)
            
            logger.info("✅ Recording started - separate video + audio processes")
            
        except Exception as e:
            logger.error(f"❌ Failed to start recording: {e}")
            import traceback
            logger.error(traceback.format_exc())
            self.is_recording = False
            
            # Kill both processes
            for proc in [self.ffmpeg_video_process, self.ffmpeg_audio_process]:
                if proc:
                    try:
                        if proc.poll() is None:
                            proc.kill()
                    except:
                        pass
            
            self._cleanup_fifos()
            raise

    def _drain_stderr(self, process, label):
        """Drain stderr for a specific FFmpeg process"""
        try:
            logger.info(f"🔄 {label} FFmpeg stderr drain started")
            for line in iter(process.stderr.readline, b''):
                line_str = line.decode('utf-8', errors='ignore').strip()
                if 'error' in line_str.lower() or 'warning' in line_str.lower():
                    logger.warning(f"{label} FFmpeg: {line_str}")
            logger.info(f"✅ {label} FFmpeg stderr drain stopped")
        except Exception as e:
            logger.error(f"{label} stderr drain error: {e}")

    def _cleanup_fifos(self):
        """Clean up audio FIFO and temp files"""
        try:
            # Close audio writer
            if self.audio_fifo_writer:
                try:
                    self.audio_fifo_writer.close()
                except:
                    pass
            
            # Remove audio FIFO
            if hasattr(self, 'audio_fifo_path') and self.audio_fifo_path and os.path.exists(self.audio_fifo_path):
                try:
                    os.remove(self.audio_fifo_path)
                    logger.info(f"🧹 Removed audio FIFO: {self.audio_fifo_path}")
                except Exception as e:
                    logger.warning(f"⚠️ Could not remove FIFO: {e}")
            
            # Clean temp audio file (will be merged, then deleted)
            if hasattr(self, 'temp_audio_path') and self.temp_audio_path:
                logger.info(f"📝 Audio file: {self.temp_audio_path}")
                
        except Exception as e:
            logger.error(f"Cleanup error: {e}")
    
    def add_video_frame(self, frame, source_type="video"):
        """Store video frame in ring buffer with timestamp (capture layer)"""
        if not self.is_recording:
            return
        
        if self.timeline.is_paused:
            return
        
        if frame is None:
            return
        
        try:
            # Only process screen share frames - ignore everything else
            if source_type == "screen_share":
                current_pts = self.timeline.get_current_pts()
                
                # Resize if needed
                if frame.shape[:2] != (720, 1280):
                    frame = cv2.resize(frame, (1280, 720))
                
                # Store in ring buffer with timestamp
                with self.frame_buffer_lock:
                    self.frame_ring_buffer.append({
                        'frame': frame.copy(),
                        'pts': current_pts,
                        'capture_time': time.perf_counter()
                    })
                    
                    # Update screen share state
                    with self.screen_share_lock:
                        self.last_screen_frame = frame.copy()
                        self.last_screen_frame_time = time.perf_counter()
                        self.has_screen_share = True
                    
        except Exception as e:
            logger.warning(f"Frame buffer error: {e}")

    def _start_video_writer_thread(self):
        """Start timeline-driven video writer (proactive, not reactive)"""
        def video_writer_loop():
            logger.info("🎬 Video writer clock thread started (20 FPS)")
            frame_interval = 1.0 / self.target_fps  # 0.05 seconds for 20 FPS
            next_frame_pts = 0.0
            frames_written_local = 0
            last_log_time = time.perf_counter()
            
            while self.is_recording and not self.stop_event.is_set():
                try:
                    # Skip writing when timeline is paused
                    if self.timeline.is_paused:
                        time.sleep(0.1)
                        next_frame_pts = self.timeline.get_current_pts()  # Reset on resume
                        continue
                    
                    current_pts = self.timeline.get_current_pts()
                    
                    # Only write if we've reached the next frame time
                    if current_pts >= next_frame_pts:
                        # Select frame to write
                        frame_to_write = self._get_frame_for_pts(next_frame_pts)
                        
                        if frame_to_write is not None:
                            # Write to FFmpeg
                            with self.video_lock:
                                if self.ffmpeg_video_pipe and self.ffmpeg_video_process.poll() is None:
                                    try:
                                        self.ffmpeg_video_pipe.write(frame_to_write.tobytes())
                                        
                                        # Flush every 10 frames
                                        if frames_written_local % 10 == 0:
                                            self.ffmpeg_video_pipe.flush()
                                        
                                        frames_written_local += 1
                                        self.frames_written = frames_written_local
                                        
                                        # Periodic logging
                                        now = time.perf_counter()
                                        if now - last_log_time >= 5.0:
                                            logger.info(
                                                f"📹 Video Writer: {frames_written_local} frames | "
                                                f"Timeline: {current_pts:.1f}s | "
                                                f"Target PTS: {next_frame_pts:.2f}s"
                                            )
                                            last_log_time = now
                                        
                                    except (BrokenPipeError, IOError) as e:
                                        logger.error(f"❌ Video write error: {e}")
                                        self.is_recording = False
                                        break
                        
                        # Advance to next frame time
                        next_frame_pts += frame_interval
                    
                    # Sleep for a fraction of frame interval
                    time.sleep(frame_interval / 4)  # 12.5ms for 20 FPS
                    
                except Exception as e:
                    logger.error(f"Video writer error: {e}")
                    time.sleep(0.1)
            
            logger.info(f"✅ Video writer clock stopped - {frames_written_local} frames written")
        
        self.video_writer_thread = threading.Thread(
            target=video_writer_loop,
            name="VideoWriterClock",
            daemon=True
        )
        self.video_writer_thread.start()
        logger.info("✅ Video writer clock thread launched")

    def _get_frame_for_pts(self, target_pts):
        """Get the best frame for a given timeline PTS"""
        try:
            with self.frame_buffer_lock:
                # If no frames in buffer yet
                if len(self.frame_ring_buffer) == 0:
                    # Check if we have screen share active
                    with self.screen_share_lock:
                        if self.has_screen_share and self.last_screen_frame is not None:
                            # Use last known screen frame
                            return self.last_screen_frame.copy()
                        else:
                            # Use placeholder
                            if self.placeholder_frame is None:
                                self._create_placeholder_frame()
                            return self.placeholder_frame.copy()
                
                # Find frame closest to target PTS (but not in the future)
                best_frame = None
                best_diff = float('inf')
                
                for frame_data in self.frame_ring_buffer:
                    frame_pts = frame_data['pts']
                    
                    # Only consider frames at or before target PTS
                    if frame_pts <= target_pts:
                        diff = abs(target_pts - frame_pts)
                        if diff < best_diff:
                            best_diff = diff
                            best_frame = frame_data['frame']
                
                # If we found a good frame, return it
                if best_frame is not None:
                    return best_frame.copy()
                
                # Fallback: use most recent frame
                if len(self.frame_ring_buffer) > 0:
                    return self.frame_ring_buffer[-1]['frame'].copy()
                
                # Last resort: placeholder
                with self.screen_share_lock:
                    if self.has_screen_share and self.last_screen_frame is not None:
                        return self.last_screen_frame.copy()
                    else:
                        if self.placeholder_frame is None:
                            self._create_placeholder_frame()
                        return self.placeholder_frame.copy()
                
        except Exception as e:
            logger.error(f"Frame selection error: {e}")
            # Emergency fallback
            if self.placeholder_frame is None:
                self._create_placeholder_frame()
            return self.placeholder_frame.copy()
        
    def add_audio_samples(self, samples, participant_id="unknown", source_type="microphone"):
        """
        Just store incoming audio samples per source — do NOT mix or write here.
        Mixing and writing will be done by the independent clock-driven audio thread.
        """
        # Reject new audio if we're in draining mode or stopped
        if not self.audio_accepting_new_data or not self.is_recording or self.timeline.is_paused or not samples:
            return

        try:
            # Normalize incoming samples to int16 stereo
            if isinstance(samples, list):
                audio_array = np.array(samples, dtype=np.int16).flatten()
            elif isinstance(samples, np.ndarray):
                audio_array = samples.astype(np.int16).flatten()
            else:
                return

            # Audio is already stereo from _convert_frame_to_audio_simple()
            # Just ensure even length for safety
            if len(audio_array) % 2 != 0:
                audio_array = np.append(audio_array, 0)
            source_key = f"{participant_id}_{source_type}"

            with self.audio_mixer_lock:
                if source_key not in self.audio_sources:
                    self.audio_sources[source_key] = deque(maxlen=self.max_audio_source_buffer * 4)  # larger tolerance
                self.audio_sources[source_key].extend(audio_array.tolist())

        except Exception as e:
            logger.warning(f"Audio enqueue error ({source_type}): {e}")

    def _mix_and_write_audio_chunk(self, target_samples: int = 960):  # 10 ms @ 48 kHz stereo
        """Mix whatever is available and ALWAYS write a full chunk — CRITICAL: writes silence when no sources active"""
        try:
            # ✅ FIX: Calculate how many samples we SHOULD have written by now
            current_pts = self.timeline.get_current_pts()
            expected_samples_total = int(current_pts * 48000 * 2)  # Timeline-based expectation
            samples_behind = expected_samples_total - self.audio_samples_written
            
            # ✅ FIX: If we're falling behind timeline, log warning
            if samples_behind > 48000:  # More than 0.5 seconds behind
                logger.warning(f"⚠️ Audio falling behind timeline by {samples_behind / (48000 * 2):.2f}s")
            
            with self.audio_mixer_lock:
                mixed = np.zeros(target_samples, dtype=np.float32)
                active_count = 0
                has_any_data = False

                for source_key, buffer in list(self.audio_sources.items()):
                    avail = len(buffer)
                    if avail > 0:
                        has_any_data = True
                        if avail >= target_samples:
                            source_samples = np.array(
                                [buffer.popleft() for _ in range(target_samples)],
                                dtype=np.float32
                            )
                        else:
                            source_samples = np.array(
                                [buffer.popleft() for _ in range(avail)],
                                dtype=np.float32
                            )
                            source_samples = np.pad(
                                source_samples, 
                                (0, target_samples - len(source_samples)),
                                mode='constant',
                                constant_values=0
                            )
                        
                        assert len(source_samples) == target_samples, \
                            f"Expected {target_samples} samples, got {len(source_samples)}"
                        
                        mixed += source_samples
                        active_count += 1

                # ✅ FIX: ALWAYS write samples, even if no data (silence maintains timeline sync)
                if active_count > 1:
                    mixed /= active_count
                
                mixed = np.clip(mixed, -32768, 32767).astype(np.int16)

            # ✅ FIX: ALWAYS write, regardless of has_any_data
            with self.audio_lock:
                if self.audio_enabled and self.audio_fifo_writer and self.ffmpeg_audio_process.poll() is None:
                    try:
                        self.audio_fifo_writer.write(mixed.tobytes())
                        self.audio_fifo_writer.flush()
                        self.audio_samples_written += len(mixed)
                        
                        if self.audio_samples_written % (48000 * 2 * 5) == 0:
                            logger.info(
                                f"🎵 Audio: {self.audio_samples_written} samples | "
                                f"Timeline: {current_pts:.1f}s | "
                                f"Sources active: {active_count} | "
                                f"Behind: {samples_behind / (48000 * 2):.2f}s"
                            )
                    except (BrokenPipeError, IOError) as e:
                        logger.error(f"❌ Audio write error: {e}")
                        self.is_recording = False

        except Exception as e:
            logger.warning(f"Audio mix/write error: {e}")

    def _drain_ffmpeg_stderr(self):
        """Drain FFmpeg stderr to prevent buffer blocking"""
        try:
            logger.info("🔄 FFmpeg stderr drain thread started")
            
            for line in iter(self.ffmpeg_process.stderr.readline, b''):
                # Decode and optionally log errors/warnings
                try:
                    line_str = line.decode('utf-8', errors='ignore').strip()
                    
                    # Log only important messages
                    if 'error' in line_str.lower() or 'warning' in line_str.lower():
                        logger.warning(f"FFmpeg: {line_str}")
                        
                except:
                    pass
            
            logger.info("✅ FFmpeg stderr drain thread stopped")
            
        except Exception as e:
            logger.error(f"stderr drain error: {e}")
                 
    def pause_recording(self):
        """Pause recording - timeline freezes, drop incoming frames"""
        pause_pts = self.timeline.pause()
        if pause_pts is not None:
            # Clear audio buffer to prevent stale audio after resume
            with self.audio_lock:
                self.audio_buffer.clear()
            
            logger.info(f"⏸️  Recording paused at {pause_pts:.3f}s")
            logger.info(f"   - FFmpeg continues running")
            logger.info(f"   - Audio buffer cleared")
            return pause_pts
        return None
    
    def resume_recording(self):
        """Resume recording - timeline continues, accept frames again"""
        resume_pts = self.timeline.resume()
        if resume_pts is not None:
            # Reset video pacing reference
            with self.video_lock:
                self.next_video_pts = resume_pts
            
            logger.info(f"▶️  Recording resumed at {resume_pts:.3f}s")
            logger.info(f"   - Timeline continuous (no gap in output)")
            return resume_pts
        return None
    
    def stop_recording(self):
        """Stop both FFmpeg processes with complete buffer draining"""
        logger.info("🛑 Stopping recording - Phase 1: Stop new data ingestion")
        
        # Phase 1: Stop accepting new data
        self.audio_accepting_new_data = False
        
        # ✅ NEW: Wait for video writer to catch up before stopping recording
        logger.info("⏳ Waiting for video writer to catch up with timeline...")
        current_pts = self.timeline.get_current_pts()
        expected_frames = int(current_pts * self.target_fps)
        
        # Wait up to 30 seconds for video writer to catch up
        wait_start = time.perf_counter()
        while time.perf_counter() - wait_start < 30.0:
            if self.frames_written >= expected_frames * 0.98:  # 98% threshold
                logger.info(f"✅ Video writer caught up: {self.frames_written}/{expected_frames} frames")
                break
            time.sleep(0.5)
        else:
            logger.warning(f"⚠️ Video writer timeout: {self.frames_written}/{expected_frames} frames")
        
        self.is_recording = False
        self.stop_event.set()
        
        # Stop timeline
        final_pts = self.timeline.stop()

        expected_frames = int(final_pts * self.target_fps)
        frame_match_pct = (self.frames_written / expected_frames * 100) if expected_frames > 0 else 0
        
        logger.info(f"🛑 Recording stats - Final duration: {final_pts:.1f}s")
        logger.info(f"   - Expected frames: {expected_frames} ({self.target_fps} FPS)")
        logger.info(f"   - Actual frames: {self.frames_written} ({frame_match_pct:.1f}% match)")
        logger.info(f"   - Audio samples: {self.audio_samples_written}")
        
        if frame_match_pct < 95:
            logger.warning(f"⚠️ Frame count low - video writer may have issues")
        else:
            logger.info(f"✅ Frame count acceptable")

        # Phase 2: Wait for audio buffers to drain completely
        logger.info("🛑 Phase 2: Waiting for audio buffers to drain...")
        logger.info("   (This may take 10-60 seconds depending on buffer size)")
        
        last_log_time = time.perf_counter()
        start_drain_time = time.perf_counter()
        
        while self.audio_clock_thread and self.audio_clock_thread.is_alive():
            # Check if thread has confirmed drain complete
            if self.audio_drain_complete:
                logger.info("✅ Audio drain confirmed complete by thread")
                break
            
            # Periodic status logging
            now = time.perf_counter()
            if now - last_log_time >= 5.0:
                elapsed = now - start_drain_time
                non_empty = self._count_non_empty_audio_buffers()
                logger.info(f"⏳ Still draining audio... ({elapsed:.1f}s elapsed, {non_empty} source(s) with data)")
                last_log_time = now
            
            time.sleep(0.1)
        
        drain_duration = time.perf_counter() - start_drain_time
        logger.info(f"✅ Audio drain completed in {drain_duration:.1f}s")

        # ✅ NEW: Phase 2.5 - Wait additional time for FIFO to fully drain to FFmpeg
        logger.info("🛑 Phase 2.5: Waiting for FIFO to drain to FFmpeg...")
        additional_wait = 10.0  # ✅ NEW: 10 seconds for production safety
        logger.info(f"   Waiting {additional_wait}s to ensure FFmpeg consumes all FIFO data...")
        time.sleep(additional_wait)
        logger.info("✅ FIFO drain wait complete")

        # Phase 3: Close audio FIFO after confirmed drain
        logger.info("🛑 Phase 3: Closing audio FIFO...")
        if self.audio_fifo_writer:
            try:
                # ✅ NEW: Final flush before close
                self.audio_fifo_writer.flush()
                time.sleep(2.0)  # ✅ NEW: Extra safety delay
                self.audio_fifo_writer.close()
                self.audio_fifo_closed = True
                logger.info("✅ Audio FIFO closed")
            except Exception as e:
                logger.warning(f"Audio FIFO close warning: {e}")

        # Phase 4: Close video stdin
        logger.info("🛑 Phase 4: Closing video stdin...")
        if self.ffmpeg_video_pipe:
            try:
                self.ffmpeg_video_pipe.flush()
                time.sleep(0.5)
                self.ffmpeg_video_pipe.close()
                logger.info("✅ Video stdin closed")
            except Exception as e:
                logger.warning(f"Video close: {e}")
        
        # Phase 5: Wait for FFmpeg processes with generous timeout
        logger.info("🛑 Phase 5: Waiting for FFmpeg processes to complete...")
        
        # Wait for VIDEO FFmpeg
        if self.ffmpeg_video_process:
            logger.info("⏳ Waiting for video FFmpeg (120s timeout for production)...")
            try:
                ret = self.ffmpeg_video_process.wait(timeout=120)  # ✅ NEW: 2 minute timeout
                logger.info(f"✅ Video FFmpeg exited: {ret}")
            except subprocess.TimeoutExpired:
                logger.error("❌ Video FFmpeg timeout - forcing termination")
                self.ffmpeg_video_process.kill()
                self.ffmpeg_video_process.wait()
            except Exception as e:
                logger.error(f"❌ Video FFmpeg error: {e}")
                self.ffmpeg_video_process.kill()
        
        # Wait for AUDIO FFmpeg
        if self.ffmpeg_audio_process:
            logger.info("⏳ Waiting for audio FFmpeg (120s timeout for production)...")
            try:
                ret = self.ffmpeg_audio_process.wait(timeout=120)  # ✅ NEW: 2 minute timeout
                logger.info(f"✅ Audio FFmpeg exited: {ret}")
            except subprocess.TimeoutExpired:
                logger.error("❌ Audio FFmpeg timeout - forcing termination")
                self.ffmpeg_audio_process.kill()
                self.ffmpeg_audio_process.wait()
            except Exception as e:
                logger.error(f"❌ Audio FFmpeg error: {e}")
                self.ffmpeg_audio_process.kill()

        # Phase 6: Verify file stability
        logger.info("🛑 Phase 6: Verifying file stability...")
        time.sleep(2.0)  # Let files settle
        
        # Cleanup FIFOs
        self._cleanup_fifos()
        
        # Check final file sizes
        video_size = os.path.getsize(self.temp_video_path) if os.path.exists(self.temp_video_path) else 0
        audio_size = os.path.getsize(self.temp_audio_path) if os.path.exists(self.temp_audio_path) else 0
        
        logger.info(f"📊 Final file sizes:")
        logger.info(f"   Video: {video_size:,} bytes ({video_size/(1024*1024):.2f} MB)")
        logger.info(f"   Audio: {audio_size:,} bytes ({audio_size/(1024*1024):.2f} MB)")
        
        # Phase 7: Upload to S3
        if self.chunk_uploader:
            logger.info("🛑 Phase 7: Uploading to S3...")
            self.chunk_uploader.stop_and_upload_final(self.temp_video_path)
        
        logger.info("✅ Recording stopped - ready for merge")

    def get_output_file(self):
        """Get the output file path"""
        return self.temp_video_path
    
    def get_s3_key(self):
        """Get the S3 key"""
        return self.s3_video_key
    
class TimestampedFrame:
    """Frame with HIGH-PRECISION timestamp for proper synchronization"""
    def __init__(self, frame, timestamp, source_type="placeholder"):
        self.frame = frame
        self.timestamp = timestamp
        self.source_type = source_type
        self.capture_time = time.perf_counter()
     
class FixedRecordingBot:
    """Fixed recording bot with FAST FRAME DUPLICATION"""
    
    def __init__(self, room_url: str, token: str, room_name: str, meeting_id: str,
         result_queue: queue.Queue, stop_event: threading.Event, target_fps: int = 20,
         session_id: str = None, recording_doc_id: str = None):  # ✅ NEW: Accept session_id and recording_doc_id

        self.room_url = room_url
        self.token = token
        self.room_name = room_name
        self.meeting_id = meeting_id
        self.result_queue = result_queue
        self.stop_event = stop_event
        self.target_fps = target_fps
        self.session_id = session_id  # ✅ NEW: Store session_id
        self.recording_doc_id = recording_doc_id  # ✅ NEW: Store recording_doc_id
        self.room = None
        self.is_connected = False
        
        # NEW: Production recorder with timeline
        self.stream_recorder = StreamingRecordingWithChunks(meeting_id, target_fps, session_id=self.session_id)  # ✅ FIXED: Pass session_id
        logger.info(f"✅ StreamingRecordingWithChunks initialized with session_id: {self.session_id}")
        
        self.active_video_streams = {}
        self.active_audio_streams = {}
        self.track_references = {}
        
        logger.info(f"✅ Recording Bot initialized - Target: {target_fps} FPS for {meeting_id}")

    async def run_recording(self):
        """Main recording method with FAST playback support"""
        try:
            self.room = rtc.Room()
            self.room.on("track_subscribed", lambda track, pub, participant: asyncio.create_task(self._on_track_subscribed(track, pub, participant)))
            self.room.on("track_unsubscribed", lambda track, pub, participant: asyncio.create_task(self._on_track_unsubscribed(track, pub, participant)))
            self.room.on("connected", self._on_connected)
            self.room.on("disconnected", self._on_disconnected)
            
            logger.info(f"🔗 Attempting WSS connection to: {self.room_url}")
            
            try:
                await asyncio.wait_for(
                    self.room.connect(self.room_url, self.token),
                    timeout=60.0
                )
                logger.info("✅ Connected via WSS successfully")
                
            except Exception as e:
                logger.error(f"❌ WSS connection failed: {e}")
                logger.info("🔄 Trying direct HTTP fallback...")
                
                http_url = self.livekit_wss_url.replace("wss://", "ws://").replace("https://", "http://")
                try:
                    await asyncio.wait_for(
                        self.room.connect(http_url, self.token),
                        timeout=30.0
                    )
                    logger.info("✅ Connected via HTTP fallback successfully")
                except Exception as fallback_error:
                    logger.error(f"❌ HTTP fallback also failed: {fallback_error}")
                    raise Exception("Both WSS and HTTP connections failed")
            
            logger.info("✅ Room connection established")
            self.result_queue.put_nowait((True, None))
            
            await self._start_recording()
            
        except Exception as e:
            logger.error(f"❌ Recording error: {e}")
            try:
                self.result_queue.put_nowait((False, str(e)))
            except:
                pass
        finally:
            await self._finalize()

    async def _start_recording(self):
        """Start production recording"""
        logger.info(f"🎬 Starting production recording @ {self.target_fps} FPS")
        
        self.stream_recorder.start_recording()
        
        # Start placeholder generation (only if no screen share)
        
        while not self.stop_event.is_set():
            await asyncio.sleep(0.1)
        
        # DON'T stop recording here - let _finalize() do it after cancelling tasks
        logger.info("✅ Stop event received - exiting recording loop")

    def _create_aged_screen_frame(self, screen_frame, age_seconds):
        """Create screen frame with aging effect to show staleness"""
        try:
            if age_seconds < 1.0:
                return screen_frame.copy()
            
            # Apply aging effects
            aged_frame = screen_frame.copy()
            
            # Slight darkening for older frames
            if age_seconds > 2.0:
                darken_factor = min(0.15, age_seconds * 0.02)
                aged_frame = cv2.convertScaleAbs(aged_frame, alpha=(1 - darken_factor), beta=0)
            
            # Add subtle blur for very old frames
            if age_seconds > 5.0:
                blur_amount = min(3, int(age_seconds / 3))
                if blur_amount > 0:
                    aged_frame = cv2.GaussianBlur(aged_frame, (blur_amount * 2 + 1, blur_amount * 2 + 1), 0)
            
            # Optional: Add age indicator
            if age_seconds > 3.0:
                cv2.putText(aged_frame, f"Screen: {age_seconds:.1f}s ago", 
                           (10, aged_frame.shape[0] - 20), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (100, 100, 100), 2)
            
            return aged_frame
        except:
            return screen_frame.copy()

    async def _on_track_subscribed(self, track, publication, participant):
        """Handle new track subscription with track reference storage"""
        try:
            if track.sid in self.stream_recorder.processing_tracks:
                logger.debug(f"⏩ Already processing track {track.sid}, skipping")
                return
            
            # ✅ STORE TRACK REFERENCE FOR PAUSE/RESUME
            self.track_references[track.sid] = {
                'track': track,
                'publication': publication,
                'participant': participant,
                'kind': track.kind,
                'name': getattr(track, 'name', 'unknown')
            }
            logger.info(f"📍 Stored track reference: {track.sid}")
            
            self.stream_recorder.processing_tracks.add(track.sid)
            
            if track.kind == rtc.TrackKind.KIND_VIDEO:
                is_screen_share = False
                
                if hasattr(track, 'name'):
                    track_name_lower = track.name.lower()
                    if any(keyword in track_name_lower for keyword in ['screen', 'display', 'desktop', 'share']):
                        is_screen_share = True
                        logger.info(f"✅ Detected screen share via name: {track.name}")
                
                if not is_screen_share and hasattr(publication, 'name'):
                    pub_name_lower = publication.name.lower()
                    if any(keyword in pub_name_lower for keyword in ['screen', 'display', 'desktop', 'share']):
                        is_screen_share = True
                        logger.info(f"✅ Detected screen share via publication name: {publication.name}")
                
                if not is_screen_share:
                    try:
                       if hasattr(publication, 'source'):
                           if publication.source == 3:  # SOURCE_SCREENSHARE = 3
                               is_screen_share = True
                               logger.info(f"✅ Detected screen share - source enum: {publication.source}")
                    except Exception as e:
                        logger.debug(f"Source check failed: {e}")

                if not is_screen_share:
                    logger.warning(f"⛔ REJECTING camera/unknown video from {participant.identity}")
                    self.stream_recorder.processing_tracks.discard(track.sid)
                    del self.track_references[track.sid]
                    return
                
                existing_screen_count = sum(
                    1 for k in self.active_video_streams.keys() 
                    if participant.identity in k
                )
                
                if existing_screen_count >= 1:
                    logger.debug(f"⏩ Participant {participant.identity} already has screen share track")
                    self.stream_recorder.processing_tracks.discard(track.sid)
                    del self.track_references[track.sid]
                    return
                
                task = asyncio.create_task(self._capture_video_stream(track, participant))
                self.active_video_streams[f"screen_{participant.identity}_{track.sid}"] = task
                logger.info(f"✅ Started FAST SCREEN capture from {participant.identity} (track: {track.sid})")
                
            elif track.kind == rtc.TrackKind.KIND_AUDIO:
                track_source = "microphone"
                
                try:
                    if hasattr(track, 'name'):
                        track_name_lower = track.name.lower()
                        if any(keyword in track_name_lower for keyword in ['screen', 'desktop', 'system', 'share']):
                            track_source = "screen_share_audio"
                    
                    if track_source == "microphone" and hasattr(track, 'source'):
                        source_str = str(track.source).lower()
                        if any(keyword in source_str for keyword in ['screen', 'desktop', 'system']):
                            track_source = "screen_share_audio"
                except Exception as e:
                    logger.debug(f"Audio source detection warning: {e}")
                
                track_type_prefix = f"audio_{participant.identity}_{track_source}_"
                existing_audio_count = sum(
                    1 for k in self.active_audio_streams.keys() 
                    if k.startswith(track_type_prefix)
                )
                
                if existing_audio_count >= 1:
                    logger.debug(f"⏩ Participant {participant.identity} already has {track_source} track")
                    self.stream_recorder.processing_tracks.discard(track.sid)
                    del self.track_references[track.sid]
                    return
                
                task = asyncio.create_task(
                    self._capture_audio_stream(track, participant, track_source)
                )
                self.active_audio_streams[f"audio_{participant.identity}_{track_source}_{track.sid}"] = task
                logger.info(f"✅ Started {track_source} capture from {participant.identity} (track: {track.sid})")
                
        except Exception as e:
            logger.error(f"❌ Track subscription error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            self.stream_recorder.processing_tracks.discard(track.sid)
            if track.sid in self.track_references:
                del self.track_references[track.sid]

    async def _on_track_unsubscribed(self, track, publication, participant):
        """Handle track unsubscription with cleanup"""
        try:
            self.stream_recorder.processing_tracks.discard(track.sid)
            
            # ✅ REMOVE TRACK REFERENCE
            if track.sid in self.track_references:
                del self.track_references[track.sid]
                logger.info(f"🗑️ Removed track reference: {track.sid}")
            
            if track.kind == rtc.TrackKind.KIND_VIDEO:
                for key in list(self.active_video_streams.keys()):
                    if track.sid in key:
                        self.active_video_streams[key].cancel()
                        del self.active_video_streams[key]
                        logger.info(f"Stopped video capture from {participant.identity}")
                        
                        # CRITICAL: Check if this was the screen share
                        if "screen" in key.lower():
                            with self.stream_recorder.screen_share_lock:
                                # Check if any other screen shares are still active
                                remaining_screens = [k for k in self.active_video_streams.keys() if "screen" in k.lower()]
                                if not remaining_screens:
                                    self.stream_recorder.has_screen_share = False
                                    logger.info(f"📺 Screen share ended - placeholder will resume")
                        break
                    
            elif track.kind == rtc.TrackKind.KIND_AUDIO:
                for key in list(self.active_audio_streams.keys()):
                    if track.sid in key:
                        self.active_audio_streams[key].cancel()
                        del self.active_audio_streams[key]
                        logger.info(f"Stopped audio capture from {participant.identity}")
                        
                        # Clean up audio source buffer
                        source_key_prefix = f"{participant.identity}_"
                        with self.stream_recorder.audio_mixer_lock:
                            keys_to_remove = [k for k in self.stream_recorder.audio_sources.keys() if k.startswith(source_key_prefix)]
                            for k in keys_to_remove:
                                del self.stream_recorder.audio_sources[k]
                                logger.info(f"🎤 Removed audio source buffer: {k}")
                        break
                    
        except Exception as e:
            logger.error(f"Track unsubscription error: {e}")

    async def _capture_video_stream(self, track, participant):
        """Capture video and write directly to FFmpeg"""
        try:
            stream = rtc.VideoStream(track, capacity=240)
            frame_count = 0
            last_log_time = time.perf_counter()
            
            logger.info(f"📺 Starting video capture from {participant.identity}")
            
            async for frame_event in stream:
                if self.stop_event.is_set():
                    break
                
                if not self.stream_recorder.is_recording:
                    await asyncio.sleep(0.01)
                    continue
                
                # Don't check pause here - add_video_frame handles it
                
                lf = frame_event.frame if hasattr(frame_event, "frame") else frame_event
                if lf is None:
                    continue
                
                # Convert LiveKit frame to OpenCV
                opencv_frame = self._convert_livekit_to_opencv(lf)
                if opencv_frame is not None:
                    # Write DIRECTLY to FFmpeg (no storage)
                    self.stream_recorder.add_video_frame(opencv_frame, "screen_share")
                    frame_count += 1
                    
                    # Periodic logging
                    if time.perf_counter() - last_log_time >= 5.0:
                        current_pts = self.stream_recorder.timeline.get_current_pts()
                        logger.info(f"📺 Video: {frame_count} frames | Timeline: {current_pts:.1f}s")
                        last_log_time = time.perf_counter()
            
            logger.info(f"✅ Video capture ended - Frames: {frame_count}")
            
        except asyncio.CancelledError:
            logger.info("📺 Video capture cancelled")
        except Exception as e:
            logger.error(f"❌ Video capture error: {e}")
            
    async def _capture_audio_stream(self, track, participant, track_source="microphone"):
        """Capture audio and send to mixer for combining with other sources"""
        try:
            stream = rtc.AudioStream(track)
            sample_count = 0
            
            logger.info(f"🎤 Starting {track_source} capture from {participant.identity}")
            
            async for frame_event in stream:
                if self.stop_event.is_set():
                    break
                
                if not self.stream_recorder.is_recording:
                    await asyncio.sleep(0.01)
                    continue
                
                # Don't check pause here - add_audio_samples handles it
                
                frame = frame_event.frame if hasattr(frame_event, 'frame') else frame_event
                if frame:
                    samples = self._convert_frame_to_audio_simple(frame)
                    if samples:
                        # Send to audio mixer with source identification
                        self.stream_recorder.add_audio_samples(
                            samples, 
                            participant.identity,
                            source_type=track_source  # CRITICAL: Pass source type for mixing
                        )
                        sample_count += len(samples)
            
            logger.info(f"✅ Audio capture ended ({track_source}) - Samples: {sample_count}")
            
        except asyncio.CancelledError:
            logger.info(f"🎤 Audio capture cancelled for {participant.identity} ({track_source})")
        except Exception as e:
            logger.error(f"❌ Audio capture error ({track_source}): {e}")

    def _convert_frame_to_audio_simple(self, frame):
        """Convert LiveKit audio frame to samples with proper format detection"""
        try:
            if not frame or not hasattr(frame, 'data') or not frame.data:
                return None
            
            sample_rate = getattr(frame, 'sample_rate', 48000)
            num_channels = getattr(frame, 'num_channels', 1)
            samples_per_channel = getattr(frame, 'samples_per_channel', 0)
            
            if not hasattr(self, '_logged_audio_format'):
                # logger.info(f"🎵 Audio: {sample_rate}Hz, {num_channels}ch, {samples_per_channel} samples/ch")
                self._logged_audio_format = True
            
            try:
                audio_array = np.frombuffer(frame.data, dtype=np.int16)
                
                if len(audio_array) == 0:
                    return None
                
                if num_channels == 1:
                    stereo_audio = np.repeat(audio_array, 2)
                    return stereo_audio.tolist()
                elif num_channels == 2:
                    return audio_array.tolist()
                else:
                    reshaped = audio_array.reshape(-1, num_channels)
                    stereo_audio = reshaped[:, :2].flatten()
                    return stereo_audio.tolist()
                
            except:
                try:
                    audio_array = np.frombuffer(frame.data, dtype=np.float32)
                    audio_array = np.clip(audio_array, -1.0, 1.0)
                    audio_array = (audio_array * 32767.0).astype(np.int16)
                    
                    if len(audio_array) == 0:
                        return None
                    
                    if num_channels == 1:
                        stereo_audio = np.repeat(audio_array, 2)
                        return stereo_audio.tolist()
                    elif num_channels == 2:
                        return audio_array.tolist()
                    else:
                        reshaped = audio_array.reshape(-1, num_channels)
                        stereo_audio = reshaped[:, :2].flatten()
                        return stereo_audio.tolist()
                    
                except:
                    return None
            
        except Exception as e:
            logger.debug(f"Audio conversion error: {e}")
            return None

    def _convert_livekit_to_opencv(self, frame):
        """Convert LiveKit frame to OpenCV BGR format"""
        try:
            if isinstance(frame, np.ndarray):
                return frame
            
            if not frame or not hasattr(frame, 'width'):
                return None
            
            width, height = frame.width, frame.height
            
            # Try ARGB first
            try:
                argb_frame = frame.convert(rtc.VideoBufferType.ARGB)
                if argb_frame and argb_frame.data:
                    argb_data = bytes(argb_frame.data)
                    expected_size = height * width * 4
                    if len(argb_data) >= expected_size:
                        argb_array = np.frombuffer(argb_data, dtype=np.uint8)[:expected_size]
                        argb_array = argb_array.reshape((height, width, 4))
                        # ARGB format = [Alpha, Red, Green, Blue]
                        # Extract BGR channels in correct order (skip alpha)
                        bgr_frame = argb_array[:, :, [3, 2, 1]]  # B=index 3, G=index 2, R=index 1
                        return bgr_frame
            except:
                pass
            
            # Try I420
            try:
                i420_frame = frame.convert(rtc.VideoBufferType.I420)
                if i420_frame and i420_frame.data:
                    i420_data = bytes(i420_frame.data)
                    expected_size = int(height * width * 1.5)
                    if len(i420_data) >= expected_size:
                        yuv_array = np.frombuffer(i420_data, dtype=np.uint8)[:expected_size]
                        yuv_array = yuv_array.reshape((int(height * 1.5), width))
                        return cv2.cvtColor(yuv_array, cv2.COLOR_YUV2BGR_I420)
            except:
                pass
            
            return None
            
        except Exception as e:
            logger.debug(f"Frame conversion error: {e}")
            return None
    
    def _on_connected(self):
        """Handle room connection"""
        logger.info("✅ Connected to room")
        self.is_connected = True

    def _on_disconnected(self, reason):
        """Handle room disconnection"""
        logger.warning(f"⚠️ Room disconnected: {reason}")

    async def _finalize(self):
        """Finalize recording and generate FAST output - FIXED VERSION"""
        try:
            logger.info("🔄 Starting finalization process...")
            
            # NEW: Cancel tasks and wait for them to finish
            logger.info("⏸️ Cancelling active capture tasks...")
            
            all_tasks = []
            for task in list(self.active_video_streams.values()):
                task.cancel()
                all_tasks.append(task)
            for task in list(self.active_audio_streams.values()):
                task.cancel()
                all_tasks.append(task)
            
            # NEW: Actually wait for cancellation to complete
            if all_tasks:
                logger.info(f"⏳ Waiting for {len(all_tasks)} tasks to finish...")
                try:
                    await asyncio.wait(all_tasks, timeout=10.0)
                    logger.info("✅ All capture tasks cancelled")
                except Exception as e:
                    logger.warning(f"⚠️ Task cancellation warning: {e}")
            
            # NEW: Extra delay to ensure no pending writes
            await asyncio.sleep(2.0)
            
            # Now safe to stop recording (FFmpeg)
            logger.info("🛑 Stopping FFmpeg recorder...")
            self.stream_recorder.stop_recording()
            
            # Set paths from stream_recorder
            self.final_video_path = self.stream_recorder.temp_video_path
            self.final_audio_path = None
            
            # Disconnect from room
            if self.room and self.is_connected:
                try:
                    logger.info("🔌 Disconnecting from LiveKit room...")
                    await asyncio.wait_for(self.room.disconnect(), timeout=30.0)
                    logger.info("✅ Room disconnected")
                except Exception as e:
                    logger.warning(f"⚠️ Room disconnect warning: {e}")
            
            logger.info("✅ FAST recording finalized successfully")
            
        except Exception as e:
            logger.error(f"❌ Finalization error: {e}")
            import traceback
            logger.error(traceback.format_exc())

class FixedGoogleMeetRecorder:
    """Fixed Google Meet style recorder with FAST PLAYBACK"""
    
    def __init__(self):
        # CORRECTED: Use HTTPS URL for API calls, WSS for WebSocket
        self.livekit_url = os.getenv("LIVEKIT_URL", "wss://imeetpro-zquw3j0i.livekit.cloud")
        self.livekit_wss_url = os.getenv("LIVEKIT_WSS_URL", "wss://imeetpro-zquw3j0i.livekit.cloud")

        # Get API credentials from environment
        self.api_key = os.getenv("LIVEKIT_API_KEY", "")
        self.api_secret = os.getenv("LIVEKIT_API_SECRET", "")

        # 🎬 FAST VIDEO SETTINGS
        self.target_fps = int(os.getenv("FAST_VIDEO_FPS", "20"))  # Configurable target FPS
        
        # 🎥 ADVANCED SMOOTHING (optional - slower but smoother)
        # Set USE_ADVANCED_SMOOTHING=true for better interpolation at cost of longer processing time
        # Default: false (uses fast fps conversion)
        # Advanced: true (uses minterpolate with blend mode for smoother motion)
        
        logger.info(f"🌐 LiveKit HTTPS URL: {self.livekit_url}")
        logger.info(f"🔌 LiveKit WSS URL: {self.livekit_wss_url}")
        logger.info(f"🎬 FAST Video Target FPS: {self.target_fps}")
        logger.info(f"🔑 API Key: {self.api_key}")
        
        mongo_uri = os.getenv("MONGO_URI", "mongodb://mongodb.databases.svc.cluster.local:27017/connectlydb")
        self.mongo_client = MongoClient(mongo_uri)
        self.db = self.mongo_client[os.getenv("MONGO_DB", "connectlydb")]  
        self.collection = self.db["test"]
        
        self.s3_recordings_prefix = S3_FOLDERS['recordings_temp']
        
        self.active_recordings = {}
        self._global_lock = threading.RLock()
        
        self.thread_pool = ThreadPoolExecutor(max_workers=10, thread_name_prefix="FastRecorder")
        # ✅ START REDIS MONITOR FOR CROSS-POD STOP REQUESTS
        if REDIS_AVAILABLE:
            self._start_redis_monitor()
        logger.info(f"✅ FAST Google Meet Style Recorder initialized")
    
    # =============================================================================
    # STEP 3: ADD THESE HELPER METHODS TO FixedGoogleMeetRecorder CLASS
    #         (Add after __init__ method, around line 2020)
    # =============================================================================

    def _redis_key(self, meeting_id: str, session_id: str = None) -> str:
        """Generate Redis key for recording state - session-aware"""
        if session_id:
            return f"recording:session:{meeting_id}:{session_id}"
        else:
            # Fallback for legacy recordings without session
            return f"recording:active:{meeting_id}"

    def _meeting_sessions_key(self, meeting_id: str) -> str:
        """Redis key for tracking all active sessions in a meeting"""
        return f"recording:meeting:{meeting_id}:sessions"
    
    def _get_pod_name(self) -> str:
        """Get current Kubernetes pod name"""
        return os.getenv('HOSTNAME', f'unknown-{os.getpid()}')
    
    def _save_recording_to_redis(self, meeting_id: str, recording_data: dict) -> bool:
        """Save recording state to Redis - session-aware"""
        try:
            if not REDIS_AVAILABLE or not redis_client:
                logger.warning("Redis not available, using in-memory only")
                return False
            
            # ✅ FIXED: Get session_id from bot instance - ensure it exists
            bot_instance = recording_data.get("bot_instance")
            session_id = None
            if bot_instance:
                if hasattr(bot_instance, 'stream_recorder') and bot_instance.stream_recorder:
                    session_id = getattr(bot_instance.stream_recorder, 'session_id', None)
            
            if not session_id:
                logger.error(f"❌ CRITICAL: No session_id found for {meeting_id} - this will cause issues!")
                # Don't save to Redis without session_id
                return False
                        
            # Convert non-serializable objects to strings
            redis_data = {
                "meeting_id": meeting_id,
                "session_id": session_id,  # ✅ NEW
                "room_name": recording_data.get("room_name", ""),
                "recording_doc_id": recording_data.get("recording_doc_id", ""),
                "recorder_identity": recording_data.get("recorder_identity", ""),
                "host_user_id": recording_data.get("host_user_id", ""),
                "target_fps": recording_data.get("target_fps", 20),
                "is_paused": recording_data.get("is_paused", False),
                "start_time": recording_data.get("start_time").isoformat() if recording_data.get("start_time") else "",
                "status": "active",
                "pod_name": self._get_pod_name(),
                "worker_pid": os.getpid()
            }
            
            # ✅ CRITICAL: Use session-aware Redis key
            redis_key = self._redis_key(meeting_id, session_id)
            
            # Store with 6 hour TTL
            redis_client.setex(
                redis_key,
                21600,  # 6 hours
                json.dumps(redis_data)
            )
            
            # ✅ NEW: Track this session in the meeting's session set
            if session_id:
                sessions_key = self._meeting_sessions_key(meeting_id)
                redis_client.sadd(sessions_key, session_id)
                redis_client.expire(sessions_key, 21600)  # Same TTL
                logger.info(f"✅ Recording state saved to Redis: {meeting_id} (session: {session_id})")
            else:
                logger.info(f"✅ Recording state saved to Redis: {meeting_id} (legacy)")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to save recording to Redis: {e}")
            return False
    
    def _get_recording_from_redis(self, meeting_id: str, session_id: str = None) -> Optional[dict]:
        """Get recording state from Redis - session-aware"""
        try:
            if not REDIS_AVAILABLE or not redis_client:
                return None
            
            # ✅ NEW: Try session-specific key first if session_id provided
            if session_id:
                redis_key = self._redis_key(meeting_id, session_id)
                data = redis_client.get(redis_key)
                if data:
                    return json.loads(data)
            
            # ✅ FALLBACK: Try legacy key (for backwards compatibility)
            legacy_key = self._redis_key(meeting_id, None)
            data = redis_client.get(legacy_key)
            if data:
                return json.loads(data)
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Failed to get recording from Redis: {e}")
            return None

    def _get_all_sessions_for_meeting(self, meeting_id: str) -> List[str]:
        """Get all active session IDs for a meeting"""
        try:
            if not REDIS_AVAILABLE or not redis_client:
                return []
            
            sessions_key = self._meeting_sessions_key(meeting_id)
            sessions = redis_client.smembers(sessions_key)
            return list(sessions) if sessions else []
            
        except Exception as e:
            logger.error(f"❌ Failed to get sessions: {e}")
            return []
    
    def _delete_recording_from_redis(self, meeting_id: str, session_id: str = None) -> bool:
        """Delete recording state from Redis - session-aware"""
        try:
            if not REDIS_AVAILABLE or not redis_client:
                return False
            
            deleted_keys = []
            
            # ✅ NEW: Delete session-specific key if session_id provided
            if session_id:
                session_key = self._redis_key(meeting_id, session_id)
                if redis_client.delete(session_key):
                    deleted_keys.append(session_key)
                
                # ✅ NEW: Remove from meeting's session set
                sessions_key = self._meeting_sessions_key(meeting_id)
                redis_client.srem(sessions_key, session_id)
                
                # ✅ NEW: If no more sessions, delete the set
                if redis_client.scard(sessions_key) == 0:
                    redis_client.delete(sessions_key)
                
                logger.info(f"✅ Recording state deleted from Redis: {meeting_id} (session: {session_id})")
            else:
                # ✅ FALLBACK: Delete legacy key
                legacy_key = self._redis_key(meeting_id, None)
                if redis_client.delete(legacy_key):
                    deleted_keys.append(legacy_key)
                logger.info(f"✅ Recording state deleted from Redis: {meeting_id} (legacy)")
            
            return len(deleted_keys) > 0
            
        except Exception as e:
            logger.error(f"❌ Failed to delete recording from Redis: {e}")
            return False
    
    def _update_recording_in_redis(self, meeting_id: str, updates: dict, session_id: str = None) -> bool:
        """Update recording state in Redis - session-aware"""
        try:
            if not REDIS_AVAILABLE or not redis_client:
                return False
            
            # ✅ NEW: Get existing data with session awareness
            existing = self._get_recording_from_redis(meeting_id, session_id)
            if existing:
                existing.update(updates)
                
                # ✅ NEW: Use session-aware key
                redis_key = self._redis_key(meeting_id, session_id or existing.get('session_id'))
                
                redis_client.setex(
                    redis_key,
                    21600,
                    json.dumps(existing)
                )
                return True
            return False
            
        except Exception as e:
            logger.error(f"❌ Failed to update recording in Redis: {e}")
            return False
    
    # =============================================================================
    # STEP 8: ADD PERIODIC CHECK FOR STOP REQUESTS (Optional but recommended)
    #         This allows the recording pod to check if stop was requested from another pod
    # =============================================================================

    def _check_redis_stop_requests(self):
        """Check if any recordings need to be stopped/paused/resumed (requested from other pods) - session-aware"""
        try:
            if not REDIS_AVAILABLE:
                return
            
            with self._global_lock:
                for meeting_id in list(self.active_recordings.keys()):
                    # ✅ NEW: Get session_id from active recording
                    recording_info = self.active_recordings.get(meeting_id)
                    session_id = None
                    if recording_info:
                        bot = recording_info.get("bot_instance")
                        if bot and hasattr(bot, 'stream_recorder'):
                            session_id = getattr(bot.stream_recorder, 'session_id', None)
                    
                    # ✅ NEW: Check Redis with session awareness
                    redis_data = self._get_recording_from_redis(meeting_id, session_id)
                    
                    if not redis_data:
                        continue
                    
                    status = redis_data.get("status")
                    
                    if status == "stop_requested":
                        logger.info(f"🛑 Stop request detected from Redis for {meeting_id}")
                        self.stop_stream_recording(meeting_id)
                    
                    elif status == "pause_requested":
                        logger.info(f"⏸️ Pause request detected from Redis for {meeting_id}")
                        recording_info = self.active_recordings.get(meeting_id)
                        if recording_info:
                            bot = recording_info.get("bot_instance")
                            if bot:
                                try:
                                    pause_pts = bot.stream_recorder.pause_recording()
                                    if pause_pts is not None:
                                        recording_info["is_paused"] = True
                                        recording_info["pause_timestamp"] = pause_pts
                                        recording_info["pause_time"] = datetime.now()
                                        self._update_recording_in_redis(meeting_id, {
                                            "status": "paused",
                                            "pause_timestamp": pause_pts
                                        })
                                        logger.info(f"✅ Pause executed via Redis for {meeting_id} at {pause_pts:.3f}s")
                                    else:
                                        self._update_recording_in_redis(meeting_id, {"status": "paused"}, session_id)
                                        logger.info(f"⏸️ Already paused for {meeting_id}")
                                except Exception as e:
                                    logger.error(f"❌ Redis pause execution error: {e}")
                                    self._update_recording_in_redis(meeting_id, {"status": "active"})
                    
                    elif status == "resume_requested":
                        logger.info(f"▶️ Resume request detected from Redis for {meeting_id}")
                        recording_info = self.active_recordings.get(meeting_id)
                        if recording_info:
                            bot = recording_info.get("bot_instance")
                            if bot:
                                try:
                                    resume_pts = bot.stream_recorder.resume_recording()
                                    if resume_pts is not None:
                                        recording_info["is_paused"] = False
                                        recording_info["resume_time"] = datetime.now()
                                        self._update_recording_in_redis(meeting_id, {
                                            "status": "active"
                                        })
                                        logger.info(f"✅ Resume executed via Redis for {meeting_id} at {resume_pts:.3f}s")
                                    else:
                                        self._update_recording_in_redis(meeting_id, {"status": "active"})
                                        logger.info(f"▶️ Already running for {meeting_id}")
                                except Exception as e:
                                    logger.error(f"❌ Redis resume execution error: {e}")
                                    self._update_recording_in_redis(meeting_id, {"status": "paused"}, session_id)
                        
        except Exception as e:
            logger.error(f"Error checking Redis requests: {e}")

    def _start_redis_monitor(self):
        """Start background thread to monitor Redis for stop requests from other pods"""
        def monitor_loop():
            logger.info("🔄 Redis stop monitor thread running...")
            while True:
                try:
                    self._check_redis_stop_requests()
                except Exception as e:
                    logger.error(f"Redis monitor error: {e}")
                time.sleep(3)
                
        monitor_thread = threading.Thread(target=monitor_loop, daemon=True, name="RedisStopMonitor")
        monitor_thread.start()
        logger.info("✅ Redis stop monitor started for cross-pod requests")

    def store_custom_recording_name(self, meeting_id: str, session_id: str, custom_name: str) -> bool:
        """Store custom recording name in the recording document itself"""
        try:
            # Update the incomplete recording document with custom name
            result = self.collection.update_one(
                {
                    "meeting_id": meeting_id,
                    "session_id": session_id,
                    "is_final_video": False
                },
                {"$set": {"custom_recording_name": custom_name}}
            )
            
            if result.modified_count > 0:
                logger.info(f"✅ Stored custom name '{custom_name}' for session {session_id}")
                return True
            else:
                logger.warning(f"⚠️ Could not find document to update custom name for session {session_id}")
                return False
            
        except Exception as e:
            logger.error(f"❌ Failed to store custom name: {e}")
            return False
        
    def generate_recorder_token(self, room_name: str, recorder_identity: str) -> str:
        """Generate JWT token for recording bot - ONLY screen share and microphone"""
        try:
            now = int(time.time())
            payload = {
                'iss': self.api_key,
                'sub': recorder_identity,
                'iat': now,
                'nbf': now,
                'exp': now + 172800,
                'video': {
                    'room': room_name,
                    'roomJoin': True,
                    'roomList': True,
                    'roomAdmin': True,
                    'roomCreate': False,
                    'roomRecord': True,
                    'canPublish': False,
                    'canSubscribe': True,
                    'canPublishData': False,
                    'canUpdateOwnMetadata': True,
                    'canPublishSources': [],
                    'canSubscribeSources': ['microphone', 'screen_share', 'screen_share_audio'],
                    'hidden': True,
                    'recorder': True
                }
            }
            
            token = jwt.encode(payload, self.api_secret, algorithm='HS256')
            logger.info(f"✅ Generated recorder token (FAST mode) for room: {room_name}")
            return token
            
        except Exception as e:
            logger.error(f"❌ Token generation failed: {e}")
            raise
            
    # =============================================================================
    # STEP 4: MODIFY start_stream_recording METHOD (around line 2058)
    #         Replace the existing method with this:
    # =============================================================================

    def start_stream_recording(self, meeting_id: str, host_user_id: str, room_name: str = None) -> Dict:
        """Start FAST Google Meet style recording with Redis state storage"""
        if not room_name:
            room_name = f"meeting_{meeting_id}"
        
        # Check Redis first for existing recording
        redis_recording = self._get_recording_from_redis(meeting_id)
        if redis_recording and redis_recording.get("status") == "active":
            return {
                "status": "already_active",
                "message": "Recording already in progress (from Redis)",
                "meeting_id": meeting_id
            }
        
        with self._global_lock:
            if meeting_id in self.active_recordings:
                return {
                    "status": "already_active",
                    "message": "Recording already in progress",
                    "meeting_id": meeting_id
                }
        
        try:
            timestamp = int(time.time())
            
            # ✅ FIXED: Generate session_id BEFORE creating document
            import uuid
            session_id = str(uuid.uuid4())[:8]  # Generate unique session ID
            
            recording_metadata = {
                "meeting_id": meeting_id,
                "session_id": session_id,  # ✅ NEW: Add session_id immediately
                "recording_sequence": timestamp,  # ✅ NEW: Add recording sequence
                "host_user_id": host_user_id,
                "room_name": room_name,
                "recording_status": "starting",
                "recording_type": "fast_google_meet",
                "target_fps": self.target_fps,
                "start_time": datetime.now(),
                "created_at": datetime.now(),
                "is_final_video": False,  # ✅ NEW: Mark as incomplete initially
                "processing_status": "pending"  # ✅ NEW: Mark as pending
            }
            
            result = self.collection.insert_one(recording_metadata)
            recording_doc_id = str(result.inserted_id)
            
            logger.info(f"✅ Created initial recording document with session_id: {session_id}, doc_id: {recording_doc_id}")
            recorder_identity = f"fast_recorder_{meeting_id}_{timestamp}"

            # ✅ NEW: Pass session_id to recording bot
            success, error_msg, bot_instance = self._start_fast_recording(
                room_name, meeting_id, host_user_id, recording_doc_id, recorder_identity, session_id
            )

            if success:
                self.collection.update_one(
                    {"_id": result.inserted_id},
                    {"$set": {"recording_status": "active", "recorder_identity": recorder_identity}}
                )
                
                # Store bot instance for pause/resume
                with self._global_lock:
                    if meeting_id in self.active_recordings:
                        self.active_recordings[meeting_id]["bot_instance"] = bot_instance
                        self.active_recordings[meeting_id]["is_paused"] = False
                        
                        # ✅ SAVE TO REDIS for cross-pod access
                        self._save_recording_to_redis(meeting_id, self.active_recordings[meeting_id])
                
                return {
                    "status": "success",
                    "message": f"FAST recording started @ {self.target_fps} FPS",
                    "meeting_id": meeting_id,
                    "recording_id": recording_doc_id,
                    "recorder_identity": recorder_identity,
                    "target_fps": self.target_fps
                }
            else:
                self.collection.update_one(
                    {"_id": result.inserted_id},
                    {"$set": {"recording_status": "failed", "error": error_msg}}
                )
                return {
                    "status": "error",
                    "message": error_msg,
                    "meeting_id": meeting_id
                }
                
        except Exception as e:
            logger.error(f"❌ Error starting FAST recording: {e}")
            return {
                "status": "error",
                "message": f"FAST recording start failed: {str(e)}",
                "meeting_id": meeting_id
            }

    def _start_fast_recording(self, room_name: str, meeting_id: str, host_user_id: str,
                       recording_doc_id: str, recorder_identity: str, session_id: str) -> Tuple[bool, Optional[str], Optional[object]]:
        """Start FAST recording process with proper bot instance storage"""
        try:
            recorder_token = self.generate_recorder_token(room_name, recorder_identity)

            result_queue = queue.Queue()
            stop_event = threading.Event()

            # ✅ CRITICAL: Use a holder dict to pass bot instance back from thread
            bot_instance_holder = {}  # Will be filled by the thread with 'bot' key

            # ✅ NEW: Pass session_id to recording thread
            future = self.thread_pool.submit(
                self._run_fast_recording_task_with_bot_return,
                self.livekit_wss_url, recorder_token, room_name, meeting_id,
                result_queue, stop_event, self.target_fps, bot_instance_holder, session_id, recording_doc_id
            )
            
            try:
                success, error_msg = result_queue.get(timeout=60)
                
                if success:
                    # ✅ Get bot instance from holder (filled by thread)
                    bot_instance = bot_instance_holder.get('bot')
                    
                    if bot_instance is None:
                        logger.error("❌ Bot instance not returned from recording thread!")
                        return False, "Bot instance creation failed", None
                    
                    logger.info(f"✅ Bot instance retrieved for pause/resume")
                    
                    with self._global_lock:
                        self.active_recordings[meeting_id] = {
                            "room_name": room_name,
                            "recording_doc_id": recording_doc_id,
                            "recorder_identity": recorder_identity,
                            "start_time": datetime.now(),
                            "host_user_id": host_user_id,
                            "stop_event": stop_event,
                            "recording_future": future,
                            "target_fps": self.target_fps,
                            "bot_instance": bot_instance,  # ✅ PROPERLY STORED NOW
                            "is_paused": False
                        }
                    # ADD THIS LINE:
                    self._save_recording_to_redis(meeting_id, self.active_recordings[meeting_id])
                    return True, None, bot_instance
                    
                else:
                    stop_event.set()
                    logger.error(f"Recording startup failed: {error_msg}")
                    return False, error_msg, None
                    
            except queue.Empty:
                stop_event.set()
                logger.error("Recording connection timeout")
                return False, "FAST recording connection timeout", None
                    
        except Exception as e:
            logger.error(f"❌ Error starting FAST recording: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False, str(e), None

    def _run_fast_recording_task(self, room_url: str, token: str, room_name: str,
                              meeting_id: str, result_queue: queue.Queue, 
                              stop_event: threading.Event, target_fps: int):
        """Run FAST recording task"""
        identifier = f"fast_recording_{meeting_id}"
        loop = None
        bot = None  # ✅ ADD THIS
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop_manager.register_loop(loop, identifier)
            
            bot = FixedRecordingBot(
                room_url=room_url,
                token=token,
                room_name=room_name,
                meeting_id=meeting_id,
                result_queue=result_queue,
                stop_event=stop_event,
                target_fps=target_fps
            )
            
            result = loop_manager.safe_run_until_complete(
                loop, 
                bot.run_recording(),
                timeout=None,
                identifier=identifier
            )
            
            return result
            
        except Exception as e:
            logger.error(f"❌ FAST recording task error: {e}")
            try:
                result_queue.put_nowait((False, str(e)))
            except:
                pass
        finally:
            if loop:
                loop_manager.force_cleanup_loop(loop, identifier)

    def _run_fast_recording_task_with_bot_return(self, room_url: str, token: str, room_name: str,
                                           meeting_id: str, result_queue: queue.Queue, 
                                           stop_event: threading.Event, target_fps: int,
                                           bot_instance_holder: dict, session_id: str, recording_doc_id: str):
        """Run FAST recording task and return bot instance via holder dict"""
        identifier = f"fast_recording_{meeting_id}"
        loop = None
        bot = None
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop_manager.register_loop(loop, identifier)
            
            bot = FixedRecordingBot(
                room_url=room_url,
                token=token,
                room_name=room_name,
                meeting_id=meeting_id,
                result_queue=result_queue,
                stop_event=stop_event,
                target_fps=target_fps,
                session_id=session_id,  # ✅ NEW: Pass session_id
                recording_doc_id=recording_doc_id  # ✅ NEW: Pass recording_doc_id
            )

            # ✅ CRITICAL: Store bot in holder BEFORE running so pause can access it
            bot_instance_holder['bot'] = bot
            logger.info(f"✅ Bot instance created with session_id: {session_id}, doc_id: {recording_doc_id}")

            logger.info(f"✅ Bot instance stored in holder for {meeting_id}")
            
            result = loop_manager.safe_run_until_complete(
                loop, 
                bot.run_recording(),
                timeout=None,
                identifier=identifier
            )
            
            logger.info(f"✅ Recording task completed for {meeting_id}")
            
            return result
                
        except Exception as e:
            logger.error(f"❌ FAST recording task error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            try:
                result_queue.put_nowait((False, str(e)))
            except:
                pass
        finally:
            if loop:
                loop_manager.force_cleanup_loop(loop, identifier)
            
            logger.info(f"✅ Cleanup complete for recording task {meeting_id}")

    # =============================================================================
    # STEP 5: MODIFY stop_stream_recording METHOD (around line 2290)
    #         Replace the existing method with this:
    # =============================================================================

    def stop_stream_recording(self, meeting_id: str, session_id: str = None) -> Dict:
        """Stop recording with Redis state lookup for cross-pod support - session-aware"""
        
        # ✅ NEW: First check local in-memory (same pod that started)
        with self._global_lock:
            local_recording = self.active_recordings.get(meeting_id)
        
        # ✅ NEW: Extract session_id from local recording if not provided
        if not session_id and local_recording:
            bot = local_recording.get("bot_instance")
            if bot and hasattr(bot, 'stream_recorder'):
                session_id = getattr(bot.stream_recorder, 'session_id', None)
        
        # ✅ NEW: If not found locally, check Redis with session awareness
        redis_recording = None
        if not local_recording:
            if session_id:
                # Try specific session first
                redis_recording = self._get_recording_from_redis(meeting_id, session_id)
            else:
                # Try to find ANY active session for this meeting
                active_sessions = self._get_all_sessions_for_meeting(meeting_id)
                if len(active_sessions) == 1:
                    # Only one active session - safe to stop it
                    redis_recording = self._get_recording_from_redis(meeting_id, active_sessions[0])
                    session_id = active_sessions[0]
                elif len(active_sessions) > 1:
                    # Multiple active recordings - need session_id to disambiguate
                    return {
                        "status": "error",
                        "message": f"Multiple active recordings found ({len(active_sessions)}). Please provide session_id.",
                        "active_sessions": active_sessions,
                        "meeting_id": meeting_id
                    }
                else:
                    # Try legacy key as last resort
                    redis_recording = self._get_recording_from_redis(meeting_id, None)
                    
        if not local_recording and not redis_recording:
            return {
                "status": "error",
                "message": "No active recording found",
                "meeting_id": meeting_id
            }

        # If we have local recording, use it (best case - same pod)
        if local_recording:
            recording_info = local_recording.copy()
            has_bot = True
        else:
            # ✅ NEW: Check if it's actually a different pod
            current_pod = self._get_pod_name()
            redis_pod = redis_recording.get("pod_name", "unknown")
            
            if current_pod == redis_pod:
                # Same pod, different worker - signal via Redis for correct worker to stop
                logger.warning(f"⚠️ Recording found in Redis on SAME POD but not in local memory")
                logger.warning(f"   This is a different worker scenario - will signal via Redis")
                logger.warning(f"   Pod: {current_pod}, Worker PID: {os.getpid()}")
                logger.warning(f"   Correct worker will pick up stop signal within 3 seconds")
                
                recording_info = redis_recording
                has_bot = False
            else:
                # Actually different pod - we have Redis info but no bot instance
                recording_info = redis_recording
                has_bot = False
                logger.warning(f"⚠️ Recording found on DIFFERENT POD")
                logger.warning(f"   Current pod: {current_pod}, Recording pod: {redis_pod}")
        try:
            logger.info(f"🛑 Stopping FAST recording for meeting {meeting_id}")
            
            if has_bot:
                # Same pod - can properly stop
                stop_event = recording_info.get("stop_event")
                if stop_event:
                    stop_event.set()
                
                recording_future = recording_info.get("recording_future")
                
                if recording_future:
                    logger.info("✅ FAST stop signal sent. Finalization will continue in background...")

                    threading.Thread(
                        target=self._async_finalize_fast_recording,
                        args=(meeting_id, recording_info),
                        daemon=True
                    ).start()
                    
                    # ✅ NEW: Clean up local and Redis with session awareness
                    with self._global_lock:
                        if meeting_id in self.active_recordings:
                            del self.active_recordings[meeting_id]
                    self._delete_recording_from_redis(meeting_id, session_id)

                    return {
                        "status": "success",
                        "message": "FAST recording stopped. Processing will continue in background.",
                        "meeting_id": meeting_id
                    }
            else:
                # ✅ NEW: Different pod - mark as stopped in Redis with session awareness
                if session_id:
                    self._update_recording_in_redis(meeting_id, {"status": "stop_requested"}, session_id)
                else:
                    # Legacy fallback
                    self._update_recording_in_redis(meeting_id, {"status": "stop_requested"})
                logger.info(f"⚠️ Stop requested via Redis for {meeting_id} - recording pod will handle cleanup")
                
                return {
                    "status": "success",
                    "message": "Stop signal sent. Recording will be stopped by the recording pod.",
                    "meeting_id": meeting_id,
                    "note": "Cross-pod stop - finalization will be handled by original pod"
                }
            
            # ✅ NEW: Cleanup with session awareness
            with self._global_lock:
                if meeting_id in self.active_recordings:
                    del self.active_recordings[meeting_id]
            self._delete_recording_from_redis(meeting_id, session_id)

            return {
                "status": "success",
                "message": "FAST recording stopped.",
                "meeting_id": meeting_id
            }

        except Exception as e:
            logger.error(f"❌ Error stopping FAST recording: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {
                "status": "error",
                "message": f"Failed to stop FAST recording: {str(e)}",
                "meeting_id": meeting_id
            }

    def pause_stream_recording(self, meeting_id: str, session_id: str = None) -> Dict:
        """Pause recording - timeline freezes (with cross-pod Redis support) - session-aware"""
        
        # ✅ NEW: First check local in-memory (same pod that started)
        with self._global_lock:
            local_recording = self.active_recordings.get(meeting_id)
        
        # ✅ NEW: Extract session_id if not provided
        if not session_id and local_recording:
            bot = local_recording.get("bot_instance")
            if bot and hasattr(bot, 'stream_recorder'):
                session_id = getattr(bot.stream_recorder, 'session_id', None)
        
        # If found locally, execute pause directly
        if local_recording:
            bot = local_recording.get("bot_instance")
            
            if not bot:
                return {
                    "status": "error",
                    "message": "Bot instance not available",
                    "meeting_id": meeting_id
                }
            
            try:
                pause_pts = bot.stream_recorder.pause_recording()
                
                if pause_pts is not None:
                    with self._global_lock:
                        local_recording["is_paused"] = True
                        local_recording["pause_timestamp"] = pause_pts
                        local_recording["pause_time"] = datetime.now()
                    
                    # ✅ NEW: Update with session awareness
                    self._update_recording_in_redis(meeting_id, {
                        "status": "paused",
                        "pause_timestamp": pause_pts
                    }, session_id)
                    
                    logger.info(f"⏸️  Recording paused for {meeting_id} at {pause_pts:.3f}s")
                    
                    return {
                        "status": "paused",
                        "message": "Recording paused - timeline frozen",
                        "meeting_id": meeting_id,
                        "paused_at": pause_pts
                    }
                else:
                    return {
                        "status": "already_paused",
                        "message": "Recording is already paused",
                        "meeting_id": meeting_id
                    }
                    
            except Exception as e:
                logger.error(f"❌ Pause error: {e}")
                return {
                    "status": "error",
                    "message": str(e),
                    "meeting_id": meeting_id
                }
        
        # ✅ NEW: Not found locally - check Redis with session awareness
        redis_recording = self._get_recording_from_redis(meeting_id, session_id)
        
        if not redis_recording:
            return {
                "status": "no_recording",
                "message": "No active recording found",
                "meeting_id": meeting_id
            }
        
        # Found in Redis on another pod - signal via Redis
        current_pod = self._get_pod_name()
        recording_pod = redis_recording.get("pod_name", "unknown")
        logger.info(f"⏸️ Pause request for {meeting_id} - recording on pod {recording_pod}, request on {current_pod}")
        
        # ✅ NEW: Update with session awareness
        self._update_recording_in_redis(meeting_id, {"status": "pause_requested"}, session_id)
        
        # Wait briefly for the owning pod to execute the pause (up to 5 seconds)
        import time
        for i in range(10):
            time.sleep(0.5)
            updated = self._get_recording_from_redis(meeting_id)
            if updated and updated.get("status") == "paused":
                pause_pts = updated.get("pause_timestamp", 0)
                logger.info(f"✅ Cross-pod pause confirmed for {meeting_id}")
                return {
                    "status": "paused",
                    "message": "Recording paused - timeline frozen",
                    "meeting_id": meeting_id,
                    "paused_at": pause_pts,
                    "note": "Cross-pod pause executed"
                }
        
        # If we get here, the owning pod hasn't responded yet but signal is sent
        logger.warning(f"⚠️ Cross-pod pause signal sent but not yet confirmed for {meeting_id}")
        return {
            "status": "paused",
            "message": "Pause signal sent to recording pod",
            "meeting_id": meeting_id,
            "note": "Cross-pod pause - may take a few seconds to take effect"
        }
        
    def resume_stream_recording(self, meeting_id: str, session_id: str = None) -> Dict:
        """Resume recording - timeline continues (with cross-pod Redis support) - session-aware"""
        
        # ✅ NEW: Extract session_id from local recording if not provided
        with self._global_lock:
            local_recording = self.active_recordings.get(meeting_id)
        
        if not session_id and local_recording:
            bot = local_recording.get("bot_instance")
            if bot and hasattr(bot, 'stream_recorder'):
                session_id = getattr(bot.stream_recorder, 'session_id', None)
        
        # First check local in-memory (same pod that started)
        with self._global_lock:
            local_recording = self.active_recordings.get(meeting_id)
        
        # If found locally, execute resume directly
        if local_recording:
            bot = local_recording.get("bot_instance")
            
            if not bot:
                return {
                    "status": "error",
                    "message": "Bot instance not available",
                    "meeting_id": meeting_id
                }
            
            try:
                resume_pts = bot.stream_recorder.resume_recording()
                
                if resume_pts is not None:
                    with self._global_lock:
                        pause_start = local_recording.get("pause_time")
                        pause_duration = (datetime.now() - pause_start).total_seconds() if pause_start else 0
                        
                        local_recording["is_paused"] = False
                        local_recording["resume_time"] = datetime.now()
                        
                        if "pause_events" not in local_recording:
                            local_recording["pause_events"] = []
                        
                        local_recording["pause_events"].append({
                            "paused_at": local_recording.get("pause_time").isoformat() if pause_start else None,
                            "resumed_at": datetime.now().isoformat(),
                            "duration": pause_duration
                        })
                    
                    self._update_recording_in_redis(meeting_id, {
                        "status": "active"
                    }, session_id)
                    
                    logger.info(f"▶️  Recording resumed for {meeting_id} at {resume_pts:.3f}s")
                    logger.info(f"   - Paused for {pause_duration:.1f}s")
                    logger.info(f"   - Timeline continuous (no gap in output)")
                    
                    return {
                        "status": "resumed",
                        "message": "Recording resumed - timeline continuous",
                        "meeting_id": meeting_id,
                        "resumed_at": resume_pts,
                        "pause_duration": pause_duration
                    }
                else:
                    return {
                        "status": "not_paused",
                        "message": "Recording is not paused",
                        "meeting_id": meeting_id
                    }
                    
            except Exception as e:
                logger.error(f"❌ Resume error: {e}")
                return {
                    "status": "error",
                    "message": str(e),
                    "meeting_id": meeting_id
                }
        
        # Not found locally - check Redis (different pod scenario)
        redis_recording = self._get_recording_from_redis(meeting_id)
        
        if not redis_recording:
            return {
                "status": "no_recording",
                "message": "No active recording found",
                "meeting_id": meeting_id
            }
        
        # Found in Redis on another pod - signal via Redis
        current_pod = self._get_pod_name()
        recording_pod = redis_recording.get("pod_name", "unknown")
        logger.info(f"▶️ Resume request for {meeting_id} - recording on pod {recording_pod}, request on {current_pod}")
        
        self._update_recording_in_redis(meeting_id, {"status": "resume_requested"}, session_id)
        
        # Wait briefly for the owning pod to execute the resume (up to 5 seconds)
        import time
        for i in range(10):
            time.sleep(0.5)
            updated = self._get_recording_from_redis(meeting_id)
            if updated and updated.get("status") == "active":
                logger.info(f"✅ Cross-pod resume confirmed for {meeting_id}")
                return {
                    "status": "resumed",
                    "message": "Recording resumed - timeline continuous",
                    "meeting_id": meeting_id,
                    "note": "Cross-pod resume executed"
                }
        
        # If we get here, the owning pod hasn't responded yet but signal is sent
        logger.warning(f"⚠️ Cross-pod resume signal sent but not yet confirmed for {meeting_id}")
        return {
            "status": "resumed",
            "message": "Resume signal sent to recording pod",
            "meeting_id": meeting_id,
            "note": "Cross-pod resume - may take a few seconds to take effect"
        }
     
    def _async_finalize_fast_recording(self, meeting_id: str, recording_info: dict):
        """Finalize recording and upload to S3 with complete metadata"""
        try:
            logger.info(f"🎬 Finalizing recording for {meeting_id}")
            
            # Get target FPS from recording info
            self.target_fps = recording_info.get("target_fps", 20)
            
            # Wait for recording thread to finish (NO TIMEOUT)
            recording_future = recording_info.get("recording_future")
            if recording_future:
                try:
                    logger.info("⏳ Waiting for recording thread to complete (no timeout)...")
                    recording_future.result()  # NO TIMEOUT - wait forever if needed
                    logger.info("✅ Recording thread completed")
                except Exception as e:
                    logger.warning(f"⚠️ Recording future error: {e}")
                    
            # Get output files
            bot_instance = recording_info.get("bot_instance")
            if not bot_instance:
                logger.error("❌ No bot instance found")
                self._cleanup_recording(meeting_id)
                return

            video_file = bot_instance.stream_recorder.temp_video_path
            audio_file = bot_instance.stream_recorder.temp_audio_path

            # ==================== VERIFY AUDIO SAMPLE COUNT ====================
            try:
                timeline_duration = bot_instance.stream_recorder.timeline.timeline_pts
                audio_samples_written = bot_instance.stream_recorder.audio_samples_written
                
                # Expected samples = timeline_duration * sample_rate * channels
                expected_audio_samples = int(timeline_duration * 48000 * 2)
                
                logger.info(f"📊 Audio sample verification:")
                logger.info(f"   Timeline duration: {timeline_duration:.2f}s")
                logger.info(f"   Expected samples: {expected_audio_samples}")
                logger.info(f"   Actual samples written: {audio_samples_written}")
                
                if audio_samples_written < expected_audio_samples * 0.95:
                    logger.error(f"❌ CRITICAL: Audio samples short by {expected_audio_samples - audio_samples_written}")
                    logger.error(f"   This means audio stopped writing early!")
                    logger.error(f"   Audio will be {(expected_audio_samples - audio_samples_written) / (48000 * 2):.2f}s too short")
                else:
                    logger.info(f"✅ Audio sample count acceptable")
            except Exception as e:
                logger.warning(f"⚠️ Audio verification error: {e}")

            # ==================== MERGE VIDEO + AUDIO ====================
            logger.info(f"🔀 Merging video + audio...")

            merged_fd, merged_file = tempfile.mkstemp(
                suffix='.mp4',
                prefix=f'merged_{meeting_id}_'
            )
            os.close(merged_fd)

            try:
                # Check if both files exist
                video_exists = os.path.exists(video_file) and os.path.getsize(video_file) > 0
                audio_exists = os.path.exists(audio_file) and os.path.getsize(audio_file) > 0
                
                if not video_exists:
                    raise Exception("No video file generated")
                
                # Step 1: Detect actual video and audio durations
                logger.info("📊 Analyzing video and audio durations...")
                
                # Get video duration
                video_duration = 0
                try:
                    probe_cmd = [
                        'ffprobe', '-v', 'error', '-show_entries',
                        'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1',
                        video_file
                    ]
                    result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=30)
                    video_duration = float(result.stdout.strip())
                    logger.info(f"📹 Video duration: {video_duration:.2f}s")
                except Exception as e:
                    logger.warning(f"⚠️ Video duration detection failed: {e}")
                
                # Get audio duration
                audio_duration = 0
                if audio_exists:
                    try:
                        probe_cmd = [
                            'ffprobe', '-v', 'error', '-show_entries',
                            'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1',
                            audio_file
                        ]
                        result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=30)
                        audio_duration = float(result.stdout.strip())
                        logger.info(f"🎵 Audio duration: {audio_duration:.2f}s")
                    except Exception as e:
                        logger.warning(f"⚠️ Audio duration detection failed: {e}")
                
                # No normalization needed - timeline-driven writing ensures sync
                normalized_video_file = video_file
                logger.info("✅ Using timeline-synced video (no normalization needed)")

                # Step 2: Merge video with audio (no normalization needed)
                if audio_exists:
                    merge_cmd = [
                        'ffmpeg', '-y',
                        '-i', normalized_video_file,  # Already correct from timeline-driven writer
                        '-i', audio_file,
                        '-c:v', 'copy',  # Copy video stream (no re-encode)
                        '-c:a', 'aac',
                        '-b:a', '192k',
                        '-shortest',  # Safety: use shortest stream
                        merged_file
                    ]
                    logger.info("🔀 Merging video + audio (timeline-synced)...")
                else:
                    merge_cmd = [
                        'ffmpeg', '-y',
                        '-i', normalized_video_file,
                        '-f', 'lavfi',
                        '-i', 'anullsrc=r=48000:cl=stereo',
                        '-c:v', 'copy',
                        '-c:a', 'aac',
                        '-b:a', '192k',
                        '-shortest',
                        merged_file
                    ]
                    logger.warning("⚠️ Video only - adding silent audio")
                
                result = subprocess.run(
                    merge_cmd,
                    capture_output=True,
                    timeout=300
                )
                
                if result.returncode != 0:
                    stderr = result.stderr.decode('utf-8', errors='ignore')
                    raise Exception(f"Merge failed: {stderr[-1000:]}")
                
                merged_size = os.path.getsize(merged_file)
                logger.info(f"✅ Merge complete: {merged_size:,} bytes ({merged_size/(1024*1024):.2f} MB)")
                
                # Cleanup normalized video if it was created
                if normalized_video_file != video_file and os.path.exists(normalized_video_file):
                    try:
                        os.remove(normalized_video_file)
                        logger.info("🧹 Cleaned up normalized video temp file")
                    except:
                        pass
                
                output_file = merged_file

            except Exception as merge_error:
                logger.error(f"❌ Merge failed: {merge_error}")
                if os.path.exists(video_file):
                    output_file = video_file
                else:
                    self._cleanup_recording(meeting_id)
                    return

            # ==================== EXTRACT DURATION ====================
            import json
            duration = 0
            try:
                probe_cmd = [
                    'ffprobe', '-v', 'quiet', '-print_format', 'json',
                    '-show_format', output_file
                ]
                probe_result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=30)
                probe_data = json.loads(probe_result.stdout)
                duration = float(probe_data.get('format', {}).get('duration', 0))
                logger.info(f"📊 Video duration: {duration:.2f}s")
            except Exception as e:
                logger.warning(f"⚠️ Duration extraction failed: {e}")
                duration = 0

            # ==================== VALIDATE FRAME COUNT ====================
            try:
                actual_frames_written = recording_info.get("bot_instance").stream_recorder.frames_written
                timeline_duration = recording_info.get("bot_instance").stream_recorder.timeline.timeline_pts
                expected_frames = int(timeline_duration * self.target_fps)
                
                logger.info(f"📊 Frame count validation:")
                logger.info(f"   Timeline duration: {timeline_duration:.2f}s")
                logger.info(f"   Video file duration: {duration:.2f}s")
                logger.info(f"   Expected frames: {expected_frames} ({self.target_fps} FPS)")
                logger.info(f"   Actual frames written: {actual_frames_written}")
                
                if expected_frames > 0:
                    frame_diff_pct = abs(expected_frames - actual_frames_written) / expected_frames * 100
                    
                    if frame_diff_pct > 5:
                        logger.warning(f"⚠️ Frame count mismatch: {frame_diff_pct:.1f}% difference")
                        logger.warning(f"   This indicates video writer timing issues")
                    else:
                        logger.info(f"✅ Frame count acceptable: {frame_diff_pct:.1f}% difference")
                
            except Exception as e:
                logger.warning(f"⚠️ Frame validation error: {e}")

            # Verify file exists with retry logic
            logger.info(f"🔍 Checking output file: {output_file}")
            max_retries = 5
            for attempt in range(max_retries):
                if os.path.exists(output_file):
                    file_size = os.path.getsize(output_file)
                    logger.info(f"📊 Attempt {attempt+1}/{max_retries}: File size = {file_size:,} bytes")
                    
                    if file_size > 0:
                        break
                    
                logger.info(f"⏳ Waiting for file to be written (attempt {attempt+1}/{max_retries})...")
                time.sleep(3)
            else:
                if not os.path.exists(output_file):
                    logger.error(f"❌ Output file not found after {max_retries} attempts")
                    self._cleanup_recording(meeting_id)
                    return
                
                file_size = os.path.getsize(output_file)
                if file_size == 0:
                    logger.error(f"❌ Output file is empty after {max_retries} attempts")
                    self._cleanup_recording(meeting_id)
                    return

            logger.info(f"✅ Recording file ready: {file_size:,} bytes ({file_size/(1024*1024):.2f} MB)")
            
            # ==================== UPLOAD TO S3 ====================
            # ✅ CRITICAL FIX: Use session-based S3 path for proper session extraction in process_video_sync
            session_id = recording_info.get("bot_instance").stream_recorder.session_id if recording_info.get("bot_instance") else "unknown"
            timestamp = int(time.time())
            final_s3_key = f"videos/{meeting_id}/{session_id}/recording_{meeting_id}_{session_id}_{timestamp}.mp4"

            try:
                logger.info(f"📤 Uploading merged file to S3: {final_s3_key}")
                
                # with open(output_file, 'rb') as f:
                #     s3_client.upload_fileobj(f, AWS_S3_BUCKET, final_s3_key)

                with open(output_file, 'rb') as f:
                    s3_client.upload_fileobj(
                        f, AWS_S3_BUCKET, final_s3_key,
                        ExtraArgs={'ContentType': 'video/mp4'}
                    )
                
                # Generate presigned URL so browser can play the video
                video_url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': AWS_S3_BUCKET, 'Key': final_s3_key},
                    ExpiresIn=604800  # 7 days
                )
                
                logger.info(f"✅ Uploaded to S3: {final_s3_key}")
                
                # Build video URL
                # video_url = f"https://{AWS_S3_BUCKET}.s3.amazonaws.com/{final_s3_key}"
                logger.info(f"🔗 Video URL: {video_url}")
                
                # Clean up temp files
                try:
                    if os.path.exists(video_file):
                        os.remove(video_file)
                    if os.path.exists(audio_file):
                        os.remove(audio_file)
                    if os.path.exists(output_file):
                        os.remove(output_file)
                    logger.info("🧹 Cleaned up temp files")
                except Exception as cleanup_err:
                    logger.warning(f"⚠️ Temp file cleanup: {cleanup_err}")
                        
            except Exception as s3_error:
                logger.error(f"❌ S3 operations failed: {s3_error}")
                self._cleanup_recording(meeting_id)
                return
            
            # ==================== GET USER & MEETING METADATA ====================
            try:
                from core.UserDashBoard.recordings import (
                    get_user_details, 
                    get_meeting_participants_emails, 
                    get_meeting_type,
                    send_recording_completion_notifications
                )
                
                host_user_id = recording_info.get("host_user_id")
                
                # Get user details
                user_details = get_user_details(host_user_id)
                user_name = user_details.get("user_name", f"User {host_user_id}")
                user_email = user_details.get("user_email", "")
                logger.info(f"👤 User: {user_name} ({user_email})")
                
                # Get meeting participants
                visible_to_emails = get_meeting_participants_emails(meeting_id)
                logger.info(f"✅ Recording visible to {len(visible_to_emails)} users")
                
                # Get meeting type
                meeting_type = get_meeting_type(meeting_id)
                logger.info(f"📋 Meeting type: {meeting_type}")
                
            except Exception as metadata_error:
                logger.error(f"❌ Failed to get metadata: {metadata_error}")
                # Use defaults
                host_user_id = recording_info.get("host_user_id", "unknown")
                user_name = f"User {host_user_id}"
                user_email = ""
                visible_to_emails = []
                meeting_type = "InstantMeeting"
            
            # ==================== GENERATE FILENAME ====================
            # ✅ CRITICAL FIX: Include date only (no time) to differentiate multiple recordings
            timestamp_str = datetime.now().strftime("%d-%m-%Y")
            custom_recording_name = None
            try:
                # ✅ SIMPLIFIED: Query main collection for incomplete document with custom name
                custom_name_doc = self.collection.find_one({
                    "meeting_id": meeting_id,
                    "session_id": session_id,
                    "is_final_video": False
                })
                
                if custom_name_doc and custom_name_doc.get("custom_recording_name"):
                    custom_recording_name = custom_name_doc.get("custom_recording_name")
                    logger.info(f"✅ Found custom name for session {session_id}: {custom_recording_name}")
                else:
                    logger.info(f"ℹ️ No custom name found for session {session_id}")
                    
            except Exception as e:
                logger.warning(f"⚠️ Custom name check failed: {e}")
                custom_recording_name = None
            if custom_recording_name:
                filename = f"{custom_recording_name}_{timestamp_str}.mp4"
            else:
                filename = f"Recording_{timestamp_str}.mp4"  # Removed meeting_id from default name
            # ==================== CREATE COMPLETE MONGODB DOCUMENT ====================
            # ✅ CRITICAL FIX: Add session_id to track multiple recordings
            video_document = {
                "meeting_id": meeting_id,
                "session_id": session_id,  # ✅ NEW: Unique session identifier
                "recording_sequence": int(time.time()),  # ✅ NEW: Helps sort multiple recordings
                "user_id": host_user_id,
                "user_name": user_name,
                "user_email": user_email,
                "meeting_type": meeting_type,
                "filename": filename,
                "original_filename": filename,
                "custom_recording_name": custom_recording_name,
                "video_url": video_url,
                "timestamp": datetime.now(),
                "visible_to": visible_to_emails,
                "file_size": file_size,
                "duration": duration,
                "recording_status": "completed",
                "processing_status": "processing",
                "processing_completed": False,
                "transcription_available": False,
                "summary_available": False,
                "is_final_video": True,
                "completed_at": datetime.now(),
                "file_path": final_s3_key,
                "s3_bucket": AWS_S3_BUCKET,
                "s3_url": f"s3://{AWS_S3_BUCKET}/{final_s3_key}",
                "video_type": "fast_smooth_duplicated",
                "file_type": "video/mp4",
                "smooth_playback": True,
                "embedded_subtitles": False
            }
            
            # ✅ FIXED: ALWAYS UPDATE, never create new document
            from bson import ObjectId
            recording_doc_id = recording_info.get("recording_doc_id")
            session_id = video_document.get("session_id")

            try:
                updated = False
                
                # Strategy 1: Try to update by recording_doc_id (most reliable)
                if recording_doc_id and len(str(recording_doc_id)) == 24:
                    result = self.collection.update_one(
                        {"_id": ObjectId(recording_doc_id)},
                        {"$set": video_document}
                    )
                    if result.modified_count > 0 or result.matched_count > 0:
                        logger.info(f"✅ Updated MongoDB document by recording_doc_id: {recording_doc_id}")
                        updated = True
                
                # Strategy 2: Try to update by session_id (fallback)
                if not updated and session_id:
                    result = self.collection.update_one(
                        {"meeting_id": meeting_id, "session_id": session_id},
                        {"$set": video_document}
                    )
                    if result.modified_count > 0 or result.matched_count > 0:
                        logger.info(f"✅ Updated MongoDB document by session_id: {session_id}")
                        updated = True
                
                # Strategy 3: CRITICAL ERROR - should never happen
                if not updated:
                    logger.error(f"❌ CRITICAL: Could not find document to update!")
                    logger.error(f"   recording_doc_id: {recording_doc_id}")
                    logger.error(f"   session_id: {session_id}")
                    logger.error(f"   This indicates a serious bug - creating new document as emergency fallback")
                    
                    result = self.collection.insert_one(video_document)
                    recording_doc_id = result.inserted_id
                    logger.error(f"⚠️ EMERGENCY: Created new MongoDB document: {recording_doc_id}")
                    
            except Exception as db_error:
                logger.error(f"❌ MongoDB operation failed: {db_error}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                
            # ==================== SEND NOTIFICATION ====================
            try:
                logger.info(f"📧 Sending notification for {meeting_id}...")
                notification_count = send_recording_completion_notifications(
                    meeting_id=meeting_id,
                    video_url=video_url
                )
                logger.info(f"✅ Sent {notification_count} notifications")
            except Exception as notif_error:
                logger.warning(f"⚠️ Notification failed: {notif_error}")
            
            # ==================== TRIGGER PROCESSING PIPELINE ====================
            try:
                self._trigger_processing_pipeline(
                    final_s3_key, 
                    meeting_id,
                    host_user_id,
                    str(recording_doc_id)
                )
                logger.info(f"✅ Processing pipeline triggered")
            except Exception as e:
                logger.warning(f"⚠️ Processing pipeline failed: {e}")
            
            # Final cleanup
            self._cleanup_recording(meeting_id)
            
            logger.info(f"🎉 Recording finalized successfully for {meeting_id}")
            
        except Exception as e:
            logger.error(f"❌ Finalization failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            self._cleanup_recording(meeting_id)

    def _cleanup_recording(self, meeting_id: str):
        """Helper to cleanup recording state"""
        try:
            self._delete_recording_from_redis(meeting_id)
            with self._global_lock:
                if meeting_id in self.active_recordings:
                    del self.active_recordings[meeting_id]
        except:
            pass
            
    def _detect_video_fps(self, video_file_path: str) -> float:
        """Detect FPS from video file using ffprobe"""
        try:
            result = subprocess.run(
                [
                    'ffprobe', '-v', 'error',
                    '-select_streams', 'v:0',
                    '-show_entries', 'stream=r_frame_rate',
                    '-of', 'default=noprint_wrappers=1:nokey=1',
                    video_file_path
                ],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0 and result.stdout.strip():
                fps_str = result.stdout.strip()
                if '/' in fps_str:
                    num, den = fps_str.split('/')
                    detected_fps = float(num) / float(den)
                else:
                    detected_fps = float(fps_str)
                
                logger.info(f"📊 Detected input FPS: {detected_fps:.2f}")
                return detected_fps
            else:
                logger.warning("⚠️ Could not detect FPS, using 20 FPS default")
                return 20.0
                
        except Exception as e:
            logger.warning(f"⚠️ FPS detection failed: {e}, using 20 FPS default")
            return 20.0
    
    def _delete_s3_folder(self, prefix: str):
        try:
            paginator = s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=AWS_S3_BUCKET, Prefix=prefix)
            
            for page in pages:
                if 'Contents' in page:
                    for obj in page['Contents']:
                        s3_client.delete_object(Bucket=AWS_S3_BUCKET, Key=obj['Key'])
                        logger.info(f"✅ Deleted: {obj['Key']}")
            
            logger.info(f"✅ Deleted S3 folder: {prefix}")
        except Exception as e:
            logger.error(f"Error deleting S3 folder: {e}")
            
    def _trigger_processing_pipeline(self, video_file_path: str, meeting_id: str,
                   host_user_id: str, recording_doc_id: str) -> Dict:
        """Trigger the video processing pipeline"""
        try:
            logger.info(f"🎬 Processing pipeline triggered for FAST video: {meeting_id}")
            
            # Extract S3 key from video_file_path
            if video_file_path.startswith('s3://'):
                s3_key = video_file_path.replace('s3://' + AWS_S3_BUCKET + '/', '')
            elif video_file_path.startswith('recordings_temp/'):
                s3_key = video_file_path
            else:
                s3_key = video_file_path
            
            logger.info(f"📍 S3 Key: {s3_key}")
            
            # Import Celery task
            from core.scheduler.tasks import process_video_task

            # ✅ CRITICAL FIX: Pass S3 key, not local temp file path
            # Celery worker will download from S3 using this key
            logger.info(f"🚀 Dispatching Celery background task to GPU worker for meeting={meeting_id}")
            process_video_task.apply_async(
                args=[s3_key, meeting_id, host_user_id],
                queue='gpu_tasks'
            )
            logger.info(f"✅ Celery task dispatched to GPU queue successfully for meeting={meeting_id}")
            return {
                "status": "success",
                "message": "Background task dispatched",
                "processing_completed": False
            }
                
        except Exception as e:
            logger.error(f"❌ Processing pipeline error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                "status": "error",
                "error": str(e)
            }
        
    def get_recording_status(self, meeting_id: str) -> Dict:
        """Get current recording status"""
        with self._global_lock:
            if meeting_id in self.active_recordings:
                recording_info = self.active_recordings[meeting_id]
                return {
                    "meeting_id": meeting_id,
                    "status": "active",
                    "start_time": recording_info["start_time"].isoformat(),
                    "room_name": recording_info["room_name"],
                    "is_active": True,
                    "target_fps": recording_info.get("target_fps", 20),
                    "recording_type": "fast"
                }
        
        return {
            "meeting_id": meeting_id,
            "status": "no_recording",
            "is_active": False
        }

    def list_active_recordings(self) -> List[Dict]:
        """List all active recordings"""
        with self._global_lock:
            return [
                {
                    "meeting_id": meeting_id,
                    "recording_id": info.get("recording_doc_id"),
                    "start_time": info.get("start_time").isoformat() if info.get("start_time") else None,
                    "room_name": info.get("room_name"),
                    "host_user_id": info.get("host_user_id"),
                    "target_fps": info.get("target_fps", 20),
                    "recording_type": "fast"
                }
                for meeting_id, info in self.active_recordings.items()
            ]

# Initialize the FAST service
fixed_google_meet_recorder = FixedGoogleMeetRecorder()
stream_recording_service = fixed_google_meet_recorder

# Cleanup handler
import atexit

def cleanup_recording_service():
    """Cleanup function to properly shut down recordings on exit"""
    try:
        logger.info("🛑 Shutting down FAST recording service...")
        with fixed_google_meet_recorder._global_lock:
            for meeting_id in list(fixed_google_meet_recorder.active_recordings.keys()):
                try:
                    fixed_google_meet_recorder.stop_stream_recording(meeting_id)
                except Exception as e:
                    logger.error(f"Error stopping recording {meeting_id}: {e}")
        
        fixed_google_meet_recorder.thread_pool.shutdown(wait=False)
        loop_manager.cleanup_all_loops()
        logger.info("✅ FAST recording service shutdown completed")
        
    except Exception as e:
        logger.error(f"Error during recording service shutdown: {e}")

atexit.register(cleanup_recording_service)