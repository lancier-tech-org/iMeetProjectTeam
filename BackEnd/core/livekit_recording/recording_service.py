# Now safe to do other imports
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
import struct
from collections import deque
import math

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
        """Stop monitoring, upload final chunk, and complete multipart upload"""
        self.is_uploading = False
        
        if self.upload_thread and self.upload_thread.is_alive():
            logger.info("⏳ Waiting for chunk upload thread to finish...")
            self.upload_thread.join(timeout=60)
        
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


# ====== 🎬 AGGRESSIVE FRAME INTERPOLATOR ======
class AggressiveFrameProcessor:
    """Creates truly SMOOTH video with aggressive temporal interpolation"""
     
    def __init__(self, stream_recorder, target_fps=20):
        self.stream_recorder = stream_recorder
        self.target_fps = target_fps
        self.frame_interval = 1.0 / target_fps
        self.raw_frame_queue = deque()
        self.is_processing = False
        self.processor_thread = None
        self.frames_processed = 0
        self.frames_queued = 0
        self.last_frame = None
        self.last_frame_time = 0
        
        logger.info(f"✅ AGGRESSIVE Frame Interpolator initialized - Target: {target_fps} FPS")
    
    def queue_raw_frame(self, livekit_frame, timestamp, source_type):
        """Queue RAW LiveKit frame for processing"""
        self.raw_frame_queue.append({
            'livekit_frame': livekit_frame,
            'timestamp': timestamp,
            'source_type': source_type
        })
        self.frames_queued += 1
    
    def start(self):
        """Start the fast processing thread"""
        self.is_processing = True
        self.processor_thread = threading.Thread(
            target=self._fast_processing_loop,
            daemon=False,
            name="FastFrameProcessor"
        )
        self.processor_thread.start()
        logger.info(f"🚀 AGGRESSIVE frame processing started - Target: {self.target_fps} FPS")
    
    def stop(self):
        """Stop the processing thread"""
        self.is_processing = False
        if self.processor_thread and self.processor_thread.is_alive():
            self.processor_thread.join(timeout=10)
        logger.info(f"✅ AGGRESSIVE frame interpolator stopped. Processed: {self.frames_processed}")
     
    def _fast_processing_loop(self):
        """Background thread with STRICT pause handling."""
        logger.info("🎬 Frame processing started")
        
        output_interval = 1.0 / self.target_fps
        next_output_time = 0
        last_real_frame = None
        last_real_timestamp = 0
        paused_frame_count = 0
        
        while self.is_processing or len(self.raw_frame_queue) > 0:
            try:
                # ✅ CHECK: Recording paused?
                if not self.stream_recorder.is_recording or self.stream_recorder.is_paused:
                    # Clear queue and reset timing
                    self.raw_frame_queue.clear()
                    next_output_time = 0
                    last_real_timestamp = 0
                    paused_frame_count += 1
                    time.sleep(0.05)
                    continue
                
                # ✅ CHECK: Cutoff active?
                if self.stream_recorder.video_cutoff_timestamp is not None:
                    self.raw_frame_queue.clear()
                    time.sleep(0.05)
                    continue
                
                # Re-initialize timing after resume
                if next_output_time == 0:
                    next_output_time = time.perf_counter() - self.stream_recorder.start_perf_counter
                    logger.info(f"🔄 Frame processor resumed at timestamp {next_output_time:.3f}s")
                
                current_time = time.perf_counter() - self.stream_recorder.start_perf_counter
                
                # Process incoming frames
                while len(self.raw_frame_queue) > 0:
                    # Double-check before each frame
                    if not self.stream_recorder.is_recording or self.stream_recorder.is_paused:
                        self.raw_frame_queue.clear()
                        break
                    
                    if self.stream_recorder.video_cutoff_timestamp is not None:
                        self.raw_frame_queue.clear()
                        break
                    
                    frame_data = self.raw_frame_queue.popleft()
                    opencv_frame = self._convert_livekit_to_opencv(frame_data['livekit_frame'])
                    
                    if opencv_frame is not None:
                        last_real_frame = opencv_frame.copy()
                        last_real_timestamp = frame_data['timestamp']
                        
                        self.stream_recorder.add_video_frame(
                            opencv_frame,
                            source_type=frame_data['source_type'],
                            timestamp_override=frame_data['timestamp']
                        )
                        self.frames_processed += 1
                
                # Check again before interpolation
                if not self.stream_recorder.is_recording or self.stream_recorder.is_paused:
                    continue
                
                if self.stream_recorder.video_cutoff_timestamp is not None:
                    continue
                
                # Interpolation
                if last_real_frame is not None and current_time >= next_output_time:
                    time_since_last_real = current_time - last_real_timestamp
                    
                    if time_since_last_real < 2.0:
                        interpolated_frame = self._create_smooth_frame(
                            last_real_frame, 
                            current_time, 
                            last_real_timestamp
                        )
                        
                        self.stream_recorder.add_video_frame(
                            interpolated_frame,
                            source_type="smooth_interpolated",
                            timestamp_override=current_time
                        )
                        self.frames_processed += 1
                    
                    next_output_time += output_interval
                
                sleep_time = max(0.001, (next_output_time - current_time) / 2)
                time.sleep(min(sleep_time, 0.01))
                    
            except Exception as e:
                logger.warning(f"⚠️ Frame processing error: {e}")
                time.sleep(0.01)
                continue
        
        logger.info(f"✅ Frame processing finished. Processed: {self.frames_processed}, Paused cycles: {paused_frame_count}")

    def _create_smooth_frame(self, base_frame, current_time, base_timestamp):
        """Create smooth interpolated frame with subtle motion blur"""
        try:
            # Calculate age of base frame
            frame_age = current_time - base_timestamp
            
            # Add subtle motion blur based on age for smoothness
            if frame_age > 0.2:  # Older than 200ms
                # Apply slight blur to suggest motion/staleness
                blurred = cv2.GaussianBlur(base_frame, (3, 3), 0.5)
                # Blend with original (more blur = more age)
                blur_factor = min(0.3, frame_age * 0.1)
                smooth_frame = cv2.addWeighted(base_frame, 1 - blur_factor, blurred, blur_factor, 0)
            else:
                smooth_frame = base_frame.copy()
            
            # Add tiny timestamp overlay for debugging (optional)
            if hasattr(self, 'debug_mode') and self.debug_mode:
                cv2.putText(smooth_frame, f"{frame_age:.1f}s", 
                           (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 1)
            
            return smooth_frame
            
        except Exception:
            return base_frame.copy()  # Fallback to original
            
    def _convert_livekit_to_opencv(self, frame):
        """Optimized frame conversion with I420/YUV support using get_plane()"""
        try:
            # Handle numpy arrays (placeholder frames) directly
            if isinstance(frame, np.ndarray):
                if len(frame.shape) == 3 and frame.shape[2] == 3:
                    return frame  # Already BGR format
                return None

            if not frame or not hasattr(frame, 'width'):
                return None

            width, height = frame.width, frame.height

            # Check native frame type first
            native_type = frame.type if hasattr(frame, 'type') else None

            # Method 1: Handle I420 directly using get_plane() (most common from LiveKit)
            if native_type == rtc.VideoBufferType.I420 or native_type == 5:
                try:
                    # I420 has 3 planes - Y, U, V stored separately
                    y_plane = frame.get_plane(0)
                    u_plane = frame.get_plane(1)
                    v_plane = frame.get_plane(2)
                    
                    if y_plane is not None and u_plane is not None and v_plane is not None:
                        y_data = bytes(y_plane)
                        u_data = bytes(u_plane)
                        v_data = bytes(v_plane)
                        
                        # Combine planes into single I420 buffer (Y + U + V)
                        i420_data = y_data + u_data + v_data
                        expected_size = int(height * width * 1.5)
                        
                        if len(i420_data) >= expected_size:
                            yuv_array = np.frombuffer(i420_data, dtype=np.uint8)[:expected_size]
                            yuv_array = yuv_array.reshape((int(height * 1.5), width))
                            bgr_frame = cv2.cvtColor(yuv_array, cv2.COLOR_YUV2BGR_I420)
                            return bgr_frame
                    
                    # Fallback: try frame.data directly (might work for some LiveKit versions)
                    i420_data = frame.data
                    if i420_data is not None:
                        i420_bytes = bytes(i420_data) if isinstance(i420_data, memoryview) else i420_data
                        expected_size = int(height * width * 1.5)
                        if len(i420_bytes) >= expected_size:
                            yuv_array = np.frombuffer(i420_bytes, dtype=np.uint8)[:expected_size]
                            yuv_array = yuv_array.reshape((int(height * 1.5), width))
                            bgr_frame = cv2.cvtColor(yuv_array, cv2.COLOR_YUV2BGR_I420)
                            return bgr_frame
                            
                except Exception as e:
                    logger.info(f"I420 direct conversion failed: {e}")

            # Method 2: Try ARGB conversion
            try:
                argb_frame = frame.convert(rtc.VideoBufferType.ARGB)
                if argb_frame and argb_frame.data:
                    argb_data = bytes(argb_frame.data) if isinstance(argb_frame.data, memoryview) else argb_frame.data
                    expected_size = height * width * 4
                    if len(argb_data) >= expected_size:
                        argb_array = np.frombuffer(argb_data, dtype=np.uint8)[:expected_size]
                        argb_array = argb_array.reshape((height, width, 4))
                        return cv2.cvtColor(argb_array, cv2.COLOR_BGRA2BGR)
            except Exception as e:
                logger.debug(f"ARGB conversion failed: {e}")

            # Method 3: Try RGBA conversion
            try:
                rgba_frame = frame.convert(rtc.VideoBufferType.RGBA)
                if rgba_frame and rgba_frame.data:
                    rgba_data = bytes(rgba_frame.data) if isinstance(rgba_frame.data, memoryview) else rgba_frame.data
                    expected_size = height * width * 4
                    if len(rgba_data) >= expected_size:
                        rgba_array = np.frombuffer(rgba_data, dtype=np.uint8)[:expected_size]
                        rgba_array = rgba_array.reshape((height, width, 4))
                        return cv2.cvtColor(rgba_array, cv2.COLOR_RGBA2BGR)
            except Exception as e:
                logger.debug(f"RGBA conversion failed: {e}")

            # Method 4: Try RGB24 conversion
            try:
                rgb_frame = frame.convert(rtc.VideoBufferType.RGB24)
                if rgb_frame and rgb_frame.data:
                    rgb_data = bytes(rgb_frame.data) if isinstance(rgb_frame.data, memoryview) else rgb_frame.data
                    expected_size = height * width * 3
                    if len(rgb_data) >= expected_size:
                        rgb_array = np.frombuffer(rgb_data, dtype=np.uint8)[:expected_size]
                        rgb_array = rgb_array.reshape((height, width, 3))
                        return cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)
            except Exception as e:
                logger.debug(f"RGB24 conversion failed: {e}")

            # Method 5: Convert to I420 then use get_plane()
            try:
                i420_frame = frame.convert(rtc.VideoBufferType.I420)
                if i420_frame:
                    y_plane = i420_frame.get_plane(0)
                    u_plane = i420_frame.get_plane(1)
                    v_plane = i420_frame.get_plane(2)
                    
                    if y_plane is not None and u_plane is not None and v_plane is not None:
                        y_data = bytes(y_plane)
                        u_data = bytes(u_plane)
                        v_data = bytes(v_plane)
                        i420_data = y_data + u_data + v_data
                        expected_size = int(height * width * 1.5)
                        
                        if len(i420_data) >= expected_size:
                            yuv_array = np.frombuffer(i420_data, dtype=np.uint8)[:expected_size]
                            yuv_array = yuv_array.reshape((int(height * 1.5), width))
                            bgr_frame = cv2.cvtColor(yuv_array, cv2.COLOR_YUV2BGR_I420)
                            return bgr_frame
            except Exception as e:
                logger.debug(f"I420 convert+plane failed: {e}")

            # All methods failed
            logger.warning(f"All frame conversion methods failed for {width}x{height} frame, type={native_type}")
            return None

        except Exception as e:
            logger.debug(f"Frame conversion error: {e}")
            return None
    
class StreamingRecordingWithChunks:
    """Recording with streaming chunk uploads to S3 and FAST VIDEO"""
    def __init__(self, meeting_id: str, target_fps: int = 20):
        self.meeting_id = meeting_id
        self.target_fps = target_fps
        self.s3_prefix = f"{S3_FOLDERS['recordings_temp']}/{meeting_id}"
        
        self.temp_video_fd, self.temp_video_path = tempfile.mkstemp(
            suffix='.avi',
            prefix=f'recording_{meeting_id}_'
        )
        os.close(self.temp_video_fd)
        
        self.s3_video_key = f"{self.s3_prefix}/raw_video_{meeting_id}.avi"
        self.chunk_uploader = None
        
        self.frame_processor = AggressiveFrameProcessor(self, target_fps)
        
        self.video_frames = []
        self.raw_audio_data = []
        self.start_time = None
        self.start_perf_counter = None
        self.is_recording = False
        self.frame_lock = threading.Lock()
        self.audio_lock = threading.Lock()
        
        self.active_audio_tracks = {}
        self.participant_audio_buffers = {}
        self.processing_tracks = set()
        
        self.AUDIO_BUFFER_SIZE = 4800
        self.frame_lookup = None
        self.frame_lookup_built = False
        
        # ✅ NEW: Pause tracking - THIS IS THE KEY
        self.pause_events = []
        self.total_pause_duration = 0.0
        self.is_paused = False
        
        # ✅ NEW: Capture cutoff timestamp - samples after this are REJECTED
        self.audio_cutoff_timestamp = None  # Set when pause starts
        self.video_cutoff_timestamp = None  # Set when pause starts
        self.has_real_screen_share = False
        
        # ✅ NEW: Track the "real" elapsed time at pause (before adjustment)
        self.pause_real_timestamp = None
        
        logger.info(f"✅ FAST Streaming Recorder - Target: {target_fps} FPS")
        logger.info(f"📝 Temp file: {self.temp_video_path}")

    def apply_pause_offset(self, timestamp):
        """Apply total pause offset to unify timestamps after resume"""
        return timestamp - self.total_pause_duration

    
    def start_recording(self):
        """Start recording and chunk uploader"""
        self.start_time = time.time()
        self.start_perf_counter = time.perf_counter()
        self.is_recording = True
        self.video_frames = []
        self.raw_audio_data = []
        self.frame_lookup = None
        self.frame_lookup_built = False

        # 🎬 Start fast frame processor
        self.frame_processor.start()

        self.chunk_uploader = S3ChunkUploader(
            bucket=AWS_S3_BUCKET,
            s3_key=self.s3_video_key,
            chunk_size_mb=5
        )
        self.chunk_uploader.start_chunk_monitor(self.temp_video_path)
        # 🔥 FIX: Start FFmpeg process for real-time encoding
        ffmpeg_cmd = [
            'ffmpeg', '-y',
            '-f', 'rawvideo',
            '-vcodec', 'rawvideo',
            '-pix_fmt', 'bgr24',
            '-s', '1280x720',
            '-r', str(self.target_fps),
            '-i', '-',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-f', 'avi',
            self.temp_video_path
        ]
        self.ffmpeg_process = subprocess.Popen(
            ffmpeg_cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=10485760
        )
        self.frames_written = 0
        logger.info(f"🎬 Recording started with {self.target_fps} FPS FAST processing + real-time encoding") 

    def stop_recording(self):
        """Stop recording and finalize uploads"""
        self.is_recording = False

        # 🎬 Stop fast frame processor
        self.frame_processor.stop()

        # 🔥 FIX: Close FFmpeg process properly
        if hasattr(self, 'ffmpeg_process') and self.ffmpeg_process:
            try:
                logger.info(f"🔚 Closing FFmpeg stdin... Frames written: {getattr(self, 'frames_written', 0)}")
                self.ffmpeg_process.stdin.close()
                return_code = self.ffmpeg_process.wait(timeout=120)
                if return_code == 0:
                    logger.info(f"✅ FFmpeg encoding completed successfully")
                else:
                    stderr = self.ffmpeg_process.stderr.read().decode('utf-8', errors='ignore')
                    logger.error(f"❌ FFmpeg exited with code {return_code}: {stderr[-500:]}")
            except Exception as e:
                logger.warning(f"FFmpeg close error: {e}")
                if self.ffmpeg_process.poll() is None:
                    self.ffmpeg_process.kill()
                    self.ffmpeg_process.wait()

        with self.audio_lock:
            if hasattr(self, 'participant_audio_buffers'):
                for participant_id, participant_buffer in self.participant_audio_buffers.items():
                    if len(participant_buffer['buffer']) > 0:
                        buffer_data = participant_buffer['buffer'].copy()
                        self.raw_audio_data.append({
                            'timestamp': participant_buffer['buffer_start_time'],
                            'samples': buffer_data,
                            'participant': participant_id
                        })

                self.participant_audio_buffers = {}
                self.active_audio_tracks = {}

        logger.info("⏹️ Recording stopped")

        # ======================================================
        # 🎬 Trigger post-recording processing pipeline
        # ======================================================
        try:
            from core.livekit_recording.recording_service import stream_recording_service
            logger.info("🎬 Triggering post-recording processing pipeline...")

            # Safely extract required fields if available
            meeting_id = getattr(self, "meeting_id", None)
            user_id = getattr(self, "user_id", None)
            recording_doc_id = getattr(self, "recording_doc_id", None)
            final_video_path = getattr(self, "final_video_path", None)

            if meeting_id and user_id and final_video_path:
                stream_recording_service._trigger_processing_pipeline(
                    video_file_path=final_video_path,
                    meeting_id=meeting_id,
                    host_user_id=user_id,
                    recording_doc_id=recording_doc_id or ""
                )
                logger.info(f"✅ Processing pipeline dispatched for meeting={meeting_id}")
            else:
                logger.warning("⚠️ Missing metadata: skipping processing trigger")

        except Exception as e:
            logger.error(f"❌ Failed to trigger post-recording processing: {e}")

    def add_video_frame(self, frame, source_type="video", timestamp_override=None):
        """Add video frame with STRICT timestamp-based filtering."""
        
        # ✅ IMMEDIATE GATE
        if not self.is_recording:
            return
        
        # ✅ STRICT PAUSE CHECK
        if self.is_paused:
            return
        
        # ✅ CUTOFF CHECK
        if self.video_cutoff_timestamp is not None:
            return
        
        if frame is None:
            return
        
        if timestamp_override is not None:
            timestamp = timestamp_override
        else:
            timestamp = time.perf_counter() - self.start_perf_counter
        
        with self.frame_lock:
            # 🔥 FIX: Write directly to FFmpeg instead of storing in memory
            if hasattr(self, 'ffmpeg_process') and self.ffmpeg_process and self.ffmpeg_process.poll() is None:
                try:
                    write_frame = frame
                    if frame.shape[:2] != (720, 1280):
                        write_frame = cv2.resize(frame, (1280, 720))
                    self.ffmpeg_process.stdin.write(write_frame.tobytes())
                    self.frames_written = getattr(self, 'frames_written', 0) + 1
                    # Log progress every 100 frames
                    if self.frames_written % 100 == 0:
                        logger.info(f"📹 Frames written to FFmpeg: {self.frames_written}")
                except Exception as e:
                    logger.warning(f"FFmpeg write error: {e}")
            
            # ✅ ADD THIS - Track frame count for later
            if not hasattr(self, 'total_frames_recorded'):
                self.total_frames_recorded = 0
            self.total_frames_recorded += 1
            
            # Store current frame reference for screen share display (not the data)
            if source_type in ["video", "screen_share"] and frame is not None:
                self.current_screen_frame = frame.copy()
            
            # Store only timestamp for audio sync (no frame data!)
            self.last_frame_timestamp = timestamp
            
    def add_audio_samples(self, samples, participant_id="unknown", track_id=None, track_source=None):
        """
        Add audio samples with STRICT timestamp-based filtering.
        
        KEY FIX: Reject samples based on their CAPTURE timestamp, not arrival time.
        This prevents buffered LiveKit samples from leaking through.
        """
        # ✅ IMMEDIATE GATE - Check recording state
        if not self.is_recording:
            return
        
        if not samples:
            return
        
        # ✅ STRICT PAUSE CHECK
        if self.is_paused:
            return
        
        # ✅ CUTOFF CHECK - Reject samples captured after cutoff
        if self.audio_cutoff_timestamp is not None:
            return
        
        with self.audio_lock:
            # Calculate current timestamp
            current_perf = time.perf_counter()
            timestamp = current_perf - self.start_perf_counter
            
            # ✅ CRITICAL: Check if this timestamp would be AFTER pause point
            # This catches buffered samples that arrive late
            if self.pause_real_timestamp is not None:
                # These samples were captured during/after pause - reject them
                # The pause_real_timestamp is set BEFORE start_perf_counter adjustment
                # So we need to compare against raw perf_counter
                raw_capture_time = current_perf - (self.start_perf_counter - self.total_pause_duration)
                if raw_capture_time >= self.pause_real_timestamp:
                    return
            
            # Track source handling
            if track_source:
                track_key = f"{participant_id}_{track_source}"
            else:
                track_key = f"{participant_id}_microphone"
            
            if track_id:
                if track_key in self.active_audio_tracks:
                    if self.active_audio_tracks[track_key] != track_id:
                        return
                else:
                    self.active_audio_tracks[track_key] = track_id
                    source_name = track_source or "microphone"
                    logger.info(f"✅ Using {source_name} audio track {track_id} for {participant_id}")
            
            # Buffer management
            if track_key not in self.participant_audio_buffers:
                self.participant_audio_buffers[track_key] = {
                    'buffer': [],
                    'buffer_start_time': timestamp,
                    'participant': participant_id,
                    'source': track_source or 'microphone'
                }
            
            participant_buffer = self.participant_audio_buffers[track_key]
            
            if isinstance(samples, list):
                participant_buffer['buffer'].extend(samples)
            else:
                participant_buffer['buffer'].extend(samples.tolist() if hasattr(samples, 'tolist') else list(samples))
            
            buffer_size = len(participant_buffer['buffer'])
            
            if buffer_size >= self.AUDIO_BUFFER_SIZE:
                chunk_to_flush = participant_buffer['buffer'][:self.AUDIO_BUFFER_SIZE]
                
                self.raw_audio_data.append({
                    'timestamp': participant_buffer['buffer_start_time'],
                    'samples': chunk_to_flush,
                    'participant': participant_id,
                    'source': track_source or 'microphone'
                })
                
                participant_buffer['buffer'] = participant_buffer['buffer'][self.AUDIO_BUFFER_SIZE:]
                
                chunk_duration = self.AUDIO_BUFFER_SIZE / (48000 * 2)
                participant_buffer['buffer_start_time'] += chunk_duration

    def get_current_screen_frame(self):
        """Get current screen frame for placeholder generation"""
        with self.frame_lock:
            if hasattr(self, 'current_screen_frame'):
                return self.current_screen_frame.copy() if self.current_screen_frame is not None else None
            return None
    

    def create_placeholder_frame(self, frame_number, timestamp):
        """Create frame - always show placeholder text"""
        frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        frame[:] = [20, 20, 20]
        
        cv2.putText(frame, "Waiting for screen share...", 
                    (320, 340), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)
        
        cv2.putText(frame, f"Recording: {timestamp:.1f}s", 
                    (480, 400), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (180, 180, 180), 2)
        
        if int(timestamp * 2) % 2 == 0:
            cv2.circle(frame, (440, 395), 10, (0, 0, 255), -1)
        
        return frame

    def generate_synchronized_video(self):
        """Generate video with FIXED TARGET FPS for fast smooth playback"""
        
        if not self.video_frames and not self.raw_audio_data:
            logger.error("❌ No frames or audio recorded")
            return None, None
        
        # Calculate recording duration
        max_video_time = max([f.timestamp for f in self.video_frames]) if self.video_frames else 0
        max_audio_time = max([d['timestamp'] for d in self.raw_audio_data]) if self.raw_audio_data else 0
        recording_duration = max(max_video_time, max_audio_time, 1.0)
        
        # ============================================================
        # FIX: Calculate adjusted duration for consistent video/audio
        # ============================================================
        adjusted_duration = recording_duration
        
        logger.info(f"📊 Duration calculation:")
        logger.info(f"   - Raw duration: {recording_duration:.2f}s")
        logger.info(f"   - Pause duration: {self.total_pause_duration:.2f}s")
        logger.info(f"   - Adjusted duration: {adjusted_duration:.2f}s")
        
        # Use fixed target FPS for fast smooth playback
        output_fps = self.target_fps
        
        logger.info(f"🎬 Generating FAST smooth video: {adjusted_duration:.1f}s")
        logger.info(f"📊 Total captured frames: {len(self.video_frames)}")
        logger.info(f"📊 TARGET OUTPUT FPS: {output_fps} (FIXED for fast smooth playback)")
        logger.info(f"📊 Total audio chunks: {len(self.raw_audio_data)}")
        
        frame_interval = 1.0 / output_fps
        # Use ADJUSTED duration for frame count
        total_frames = int(adjusted_duration * output_fps)
        
        audio_s3_key = f"{self.s3_prefix}/raw_audio_{self.meeting_id}.wav"
        
        return self._generate_video_with_fast_encoding(
            total_frames, frame_interval, audio_s3_key, recording_duration, output_fps
        )

    def _generate_video_with_fast_encoding(self, total_frames, frame_interval, 
                                 audio_s3_key, recording_duration, output_fps):
        """Generate video with FAST ENCODING and FIXED FPS"""
        try:
            if not self.frame_lookup_built:
                self._build_optimized_frame_lookup()
            
            # Check GPU availability
            nvenc_available = False
            try:
                # Actually TEST GPU encoding, not just check if FFmpeg knows about it
                test_cmd = [
                    'ffmpeg', '-y', '-f', 'lavfi', '-i', 'color=black:s=64x64:d=0.1',
                    '-c:v', 'h264_nvenc', '-f', 'null', '-'
                ]
                result = subprocess.run(test_cmd, capture_output=True, text=True, timeout=10)
                nvenc_available = (result.returncode == 0)
                if nvenc_available:
                    logger.info("🚀 GPU h264_nvenc encoding verified and available")
            except Exception as e:
                logger.info(f"⚙️ GPU not available, using CPU encoding: {e}")
                nvenc_available = False
            base_ffmpeg_cmd = [
                'ffmpeg', '-y',
                '-f', 'rawvideo',
                '-vcodec', 'rawvideo',
                '-pix_fmt', 'bgr24',
                '-s', '1280x720',
                '-r', str(output_fps),  # FIXED target FPS input
                '-i', '-'
            ]

            if nvenc_available:
                logger.info(f"🚀 GPU FAST ENCODING @ {output_fps} FPS (FIXED)")
                base_ffmpeg_cmd += [
                    '-c:v', 'h264_nvenc',
                    '-preset', 'p2',  # FASTEST preset for speed
                    '-tune', 'hq',
                    '-rc', 'vbr',
                    '-cq', '23',      # Balanced quality for speed
                    '-b:v', '4M',     # Reasonable bitrate
                    '-maxrate', '6M',
                    '-bufsize', '12M',
                    '-pix_fmt', 'yuv420p',
                    '-r', str(output_fps),  # FIXED output FPS
                    '-g', str(int(output_fps)),  # 1 second GOP for fast seeking
                    '-bf', '2',       # Fewer B-frames for speed
                    '-refs', '2',     # Fewer reference frames for speed
                    '-profile:v', 'high',
                    '-level', '4.1',
                    '-f', 'avi',
                    self.temp_video_path
                ]
            else:
                logger.info(f"⚙️ CPU FAST ENCODING @ {output_fps} FPS (FIXED)")
                base_ffmpeg_cmd += [
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast',  # FASTEST CPU preset
                    '-crf', '25',           # Balanced quality for speed
                    '-pix_fmt', 'yuv420p',
                    '-r', str(output_fps),  # FIXED output FPS
                    '-g', str(int(output_fps)),  # 1 second GOP
                    '-bf', '0',             # No B-frames for speed
                    '-refs', '1',           # Minimal reference frames
                    '-tune', 'zerolatency', # Fast encoding tune
                    '-profile:v', 'high',
                    '-level', '4.1',
                    '-f', 'avi',
                    self.temp_video_path
                ]
            
            ffmpeg_env = os.environ.copy()
            ffmpeg_env['CUDA_VISIBLE_DEVICES'] = '0'
            ffmpeg_env['CUDA_DEVICE_ORDER'] = 'PCI_BUS_ID'
            ffmpeg_env.pop('NVIDIA_DISABLE', None)
            
            logger.info(f"🎯 Starting FAST FFmpeg encoding: {self.temp_video_path}")
            logger.info(f"📊 Expected frames: {total_frames} @ {output_fps} FPS")
            
            process = subprocess.Popen(
                base_ffmpeg_cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=ffmpeg_env,
                bufsize=10485760
            )
            
            logger.info(f"🎞️ FFmpeg started (PID: {process.pid})")
            
            start_time = time.time()
            total_frames_written = 0
            last_log_time = start_time
            
            last_written_frame = None
            frame_duplicates = 0
            exact_matches = 0
            
            for frame_num in range(total_frames):
                target_timestamp = frame_num * frame_interval
                best_frame = self._find_best_frame_fast(target_timestamp, frame_interval)
                
                if best_frame is None:
                    if last_written_frame is not None:
                        # Use the last valid frame
                        best_frame = last_written_frame.copy()
                        frame_duplicates += 1
                        
                        # Add subtle aging effect for very old frames
                        if frame_duplicates > output_fps * 3:  # More than 3 seconds old
                            best_frame = cv2.addWeighted(
                                best_frame, 0.95,
                                cv2.GaussianBlur(best_frame, (3, 3), 0.5), 0.05, 0
                            )
                    else:
                        # Create placeholder
                        best_frame = self.create_placeholder_frame(frame_num, target_timestamp)
                else:
                    # Found a real frame - reset duplicate counter
                    exact_matches += 1
                    frame_duplicates = 0
                
                # Ensure proper frame size
                if best_frame.shape[:2] != (720, 1280):
                    best_frame = cv2.resize(best_frame, (1280, 720))
                
                try:
                    process.stdin.write(best_frame.tobytes())
                    total_frames_written += 1
                    last_written_frame = best_frame
                    
                    # Flush more frequently for stability
                    if frame_num % 30 == 0:  # Every 1.5 seconds at 20fps
                        try:
                            process.stdin.flush()
                        except Exception:
                            pass
                    
                    # Enhanced progress logging
                    now = time.time()
                    if now - last_log_time >= 2:
                        elapsed = now - start_time
                        fps = total_frames_written / elapsed if elapsed > 0 else 0
                        progress = (frame_num / total_frames) * 100
                        eta = (total_frames - frame_num) / fps / 60 if fps > 0 else 0
                        
                        logger.info(
                            f"🎬 SMOOTH Progress: {progress:.1f}% | Speed: {fps:.0f} fps | "
                            f"ETA: {eta:.1f} min | Real: {exact_matches} | Dupe: {frame_duplicates} | "
                            f"S3: {self.chunk_uploader.total_uploaded / (1024*1024):.1f}MB"
                        )
                        last_log_time = now
                
                except (BrokenPipeError, IOError) as e:
                    logger.error(f"❌ Pipe error at frame {frame_num}: {e}")
                    break
            
            logger.info(f"✅ AGGRESSIVE interpolation: {total_frames_written} frames @ {output_fps} FPS")
            logger.info("🔚 Closing FFmpeg stdin...")
            
            try:
                process.stdin.close()
                logger.info("⏳ Waiting for FFmpeg to finish fast encoding...")
                return_code = process.wait(timeout=60)  # Shorter timeout for fast encoding
                
                if return_code != 0:
                    stderr_output = process.stderr.read().decode('utf-8', errors='ignore')
                    logger.error(f"❌ FFmpeg exited with code {return_code}")
                    logger.error(f"FFmpeg stderr: {stderr_output[-1000:]}")
                else:
                    logger.info("✅ FFmpeg FAST encoding completed successfully")
                    
            except subprocess.TimeoutExpired:
                logger.warning("⚠️ FFmpeg timeout - killing process")
                process.kill()
                process.wait()
            except Exception as e:
                logger.warning(f"FFmpeg close warning: {e}")
            
            # Verify local file
            if not os.path.exists(self.temp_video_path):
                logger.error(f"❌ Local video file not created: {self.temp_video_path}")
                return None, None
            
            local_file_size = os.path.getsize(self.temp_video_path)
            if local_file_size == 0:
                logger.error(f"❌ Local video file is empty")
                return None, None
            
            logger.info(f"✅ FAST video file: {local_file_size:,} bytes @ {output_fps} FPS")
            
            logger.info("⏳ Finalizing S3 uploads...")
            self.chunk_uploader.stop_and_upload_final(self.temp_video_path)
            
            # Verify S3 upload
            try:
                response = s3_client.head_object(Bucket=AWS_S3_BUCKET, Key=self.s3_video_key)
                video_size = response['ContentLength']
                logger.info(f"✅ FAST Video in S3: {video_size:,} bytes @ {output_fps} FPS")
            except Exception as e:
                logger.error(f"❌ S3 verification failed: {e}")
                return None, None
            
            # Clean up local temp file
            try:
                os.remove(self.temp_video_path)
                logger.info(f"🧹 Temp file deleted: {self.temp_video_path}")
            except Exception as e:
                logger.warning(f"⚠️ Could not delete temp file: {e}")
            
            # Generate audio
            self._generate_smooth_audio_to_s3(audio_s3_key, recording_duration)
            
            return self.s3_video_key, audio_s3_key
        
        except Exception as e:
            logger.error(f"❌ FAST video generation failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            
            try:
                if 'process' in locals() and process.poll() is None:
                    process.kill()
                    stderr_output = process.stderr.read().decode('utf-8', errors='ignore')
                    logger.error(f"FFmpeg stderr: {stderr_output[-1000:]}")
            except Exception:
                pass
            
            return None, None
            
    def _build_optimized_frame_lookup(self):
        """Build frame lookup with proper indexing"""
        logger.info("🔨 Building frame lookup for FAST playback...")
        start_build = time.time()
        
        sorted_frames = sorted(self.video_frames, key=lambda f: f.timestamp)
        
        if len(sorted_frames) == 0:
            logger.warning("⚠️ WARNING: No video frames found!")
            self.frame_lookup = {}
            self.frame_lookup_built = True
            return
        
        self.frame_lookup = {}
        self.sorted_frame_list = []
        
        for frame_obj in sorted_frames:
            if frame_obj.source_type in ["video", "screen_share", "fast_duplicate", "placeholder", "smooth_interpolated"]:
                # Use high-precision indexing for fast lookup
                frame_key = int(frame_obj.timestamp * 1000)  # 0.001s precision
                
                # Keep the latest frame at each timestamp
                self.frame_lookup[frame_key] = frame_obj.frame
                
                self.sorted_frame_list.append({
                    'timestamp': frame_obj.timestamp,
                    'frame': frame_obj.frame,
                    'frame_key': frame_key,
                    'source_type': frame_obj.source_type
                })
        
        build_time = time.time() - start_build
        total_duration = sorted_frames[-1].timestamp if sorted_frames else 0
        
        logger.info(f"✅ FAST frame index: {len(self.frame_lookup)} frames in {build_time:.2f}s")
        logger.info(f"📊 Total duration: {total_duration:.1f}s")
        
        self.frame_lookup_built = True
 
    def _find_best_frame_fast(self, target_timestamp, frame_interval):
        """Frame finding - only return frames within reasonable time window"""
        if not self.frame_lookup_built or len(self.sorted_frame_list) == 0:
            return None
        
        # High-precision key matching first
        frame_key = int(target_timestamp * 1000)
        
        # Direct match
        if frame_key in self.frame_lookup:
            return self.frame_lookup[frame_key]
        
        # Search within reasonable tolerance (2x frame interval)
        search_range = int(frame_interval * 1000 * 2)
        for offset in range(1, search_range):
            if frame_key - offset in self.frame_lookup:
                return self.frame_lookup[frame_key - offset]
            if frame_key + offset in self.frame_lookup:
                return self.frame_lookup[frame_key + offset]
        
        # No frame found within reasonable time - return None to use placeholder
        return None
        
    def _generate_smooth_audio_to_s3(self, audio_s3_key, duration):
        """
        Generate audio and upload to S3.
        
        KEY FIX: NO pause-aware timestamp adjustment in the mixer.
        Pause gaps are already removed via start_perf_counter adjustment at capture time.
        This function simply processes the already-correct timestamps.
        """
        try:
            sample_rate = 48000
            
            if not self.raw_audio_data or len(self.raw_audio_data) == 0:
                logger.warning("No audio data available, creating silent audio in S3")
                # NO pause adjustment - use duration as-is
                adjusted_duration = duration
                self._create_silent_audio_s3(audio_s3_key, adjusted_duration)
                return
            
            # ============================================================
            # NO pause adjustment - timestamps already compressed via start_perf_counter
            # ============================================================
            adjusted_duration = duration
            
            logger.info(f"📊 Audio duration calculation:")
            logger.info(f"   - Duration: {duration:.2f}s")
            logger.info(f"   - Pause handling: Already applied at capture time")
            
            # Size the audio array based on duration (which is already compressed)
            total_samples = int(adjusted_duration * sample_rate * 2)
            
            final_audio = np.zeros(total_samples, dtype=np.float64)
            sample_count = np.zeros(total_samples, dtype=np.int32)
            
            logger.info(f"Processing {len(self.raw_audio_data)} audio chunks")
            logger.info(f"📊 Audio array sized for {adjusted_duration:.2f}s ({total_samples} samples)")
            
            sorted_audio = sorted(self.raw_audio_data, key=lambda x: x['timestamp'])
            
            successful_chunks = 0
            skipped_chunks = 0
            participants_detected = set()
            audio_sources = {'microphone': 0, 'screen_share_audio': 0}
            
            for audio_chunk in sorted_audio:
                original_timestamp = audio_chunk['timestamp']
                samples = audio_chunk['samples']
                participant = audio_chunk.get('participant', 'unknown')
                source = audio_chunk.get('source', 'microphone')
                
                participants_detected.add(participant)
                audio_sources[source] = audio_sources.get(source, 0) + 1
                
                if not samples or len(samples) == 0:
                    skipped_chunks += 1
                    continue
                
                # NO pause adjustment - timestamps already compressed via start_perf_counter
                adjusted_timestamp = original_timestamp
                
                # Validate adjusted timestamp
                if adjusted_timestamp < 0:
                    skipped_chunks += 1
                    continue
                
                # Skip chunks that exceed the adjusted duration
                if adjusted_timestamp >= adjusted_duration:
                    skipped_chunks += 1
                    continue
                
                try:
                    if isinstance(samples, list):
                        audio_data = np.array(samples, dtype=np.float64)
                    else:
                        audio_data = samples.astype(np.float64)
                    
                    if len(audio_data) == 0:
                        skipped_chunks += 1
                        continue
                    
                    if len(audio_data) % 2 != 0:
                        audio_data = np.append(audio_data, 0)
                    
                    # Use timestamp for sample position (already correct)
                    start_sample_float = adjusted_timestamp * sample_rate * 2
                    start_sample = int(start_sample_float)
                    sub_sample_offset = start_sample_float - start_sample
                    
                    if start_sample >= total_samples:
                        skipped_chunks += 1
                        continue
                    
                    if start_sample < 0:
                        skipped_chunks += 1
                        continue
                    
                    end_sample = min(start_sample + len(audio_data), total_samples)
                    audio_length = end_sample - start_sample
                    
                    if audio_length > 0:
                        if sub_sample_offset > 0.01:
                            interpolated = audio_data[:audio_length].copy()
                            if audio_length > 1:
                                interpolated[1:] = (1 - sub_sample_offset) * audio_data[:audio_length-1] + \
                                                sub_sample_offset * audio_data[1:audio_length]
                            final_audio[start_sample:end_sample] += interpolated
                        else:
                            final_audio[start_sample:end_sample] += audio_data[:audio_length]
                        
                        sample_count[start_sample:end_sample] += 1
                        successful_chunks += 1
                    else:
                        skipped_chunks += 1
                        
                except Exception as chunk_error:
                    logger.debug(f"Skipping audio chunk: {chunk_error}")
                    skipped_chunks += 1
                    continue
            
            # Enhanced logging (no pause-specific metrics)
            logger.info(f"Audio: {successful_chunks} chunks processed, {skipped_chunks} skipped")
            logger.info(f"👥 Participants: {len(participants_detected)}")
            logger.info(f"🎤 Sources: {audio_sources['microphone']} mic, {audio_sources.get('screen_share_audio', 0)} screen")
            logger.info(f"📊 Final audio duration: {adjusted_duration:.2f}s (should match video)")
            
            # ============================================================
            # AGC, mixing, WAV creation, S3 upload
            # ============================================================
            
            max_amplitude_before = np.max(np.abs(final_audio))
            if max_amplitude_before == 0:
                logger.warning("No audio signal detected after processing")
                self._create_silent_audio_s3(audio_s3_key, adjusted_duration)
                return
            
            overlap_mask = sample_count > 1
            if np.any(overlap_mask):
                final_audio[overlap_mask] = final_audio[overlap_mask] / np.sqrt(sample_count[overlap_mask])
                max_overlap = np.max(sample_count)
                overlap_percentage = (np.sum(overlap_mask) / len(final_audio)) * 100
                logger.info(f"🎵 Audio mixing: {max_overlap} max speakers, {overlap_percentage:.1f}% overlap")
            
            max_amplitude_after = np.max(np.abs(final_audio))
            target_amplitude = 18000.0
            
            if max_amplitude_after > 28000:
                threshold = 20000.0
                ratio = 0.7
                mask_above = np.abs(final_audio) > threshold
                final_audio[mask_above] = np.sign(final_audio[mask_above]) * (
                    threshold + (np.abs(final_audio[mask_above]) - threshold) * ratio
                )
                logger.info(f"🔊 AGC: Soft-knee compression applied")
            elif max_amplitude_after < 8000:
                boost_ratio = target_amplitude / max_amplitude_after
                final_audio = final_audio * boost_ratio
                logger.info(f"🔊 AGC: Boosted {max_amplitude_after:.0f} → {target_amplitude:.0f}")
            elif max_amplitude_after > 20000:
                compression_ratio = 18000.0 / max_amplitude_after
                final_audio = final_audio * compression_ratio
                logger.info(f"🔊 AGC: Gentle compression")
            else:
                logger.info(f"🔊 AGC: Optimal range ({max_amplitude_after:.0f})")
            
            final_audio_int16 = np.clip(final_audio, -32768, 32767).astype(np.int16)
            
            clipped_samples = np.sum((final_audio < -32768) | (final_audio > 32767))
            if clipped_samples > 0:
                clipped_percentage = (clipped_samples / len(final_audio)) * 100
                if clipped_percentage > 0.1:
                    logger.warning(f"⚠️ Audio clipping: {clipped_percentage:.3f}%")
                else:
                    logger.info(f"✅ Minimal clipping: {clipped_percentage:.3f}%")
            else:
                logger.info(f"✅ Perfect audio - no clipping")
            
            wav_buffer = io.BytesIO()
            with wave.open(wav_buffer, 'wb') as wav_file:
                wav_file.setnchannels(2)
                wav_file.setsampwidth(2)
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(final_audio_int16.tobytes())
            
            wav_buffer.seek(0)
            audio_bytes = wav_buffer.read()
            
            s3_client.put_object(
                Bucket=AWS_S3_BUCKET,
                Key=audio_s3_key,
                Body=audio_bytes,
                ContentType='audio/wav'
            )
            
            audio_duration = len(final_audio_int16) / (sample_rate * 2)
            file_size = len(audio_bytes)
            final_max = np.max(np.abs(final_audio_int16))
            logger.info(f"✅ Audio uploaded to S3: {audio_duration:.1f}s, {file_size:,} bytes, amplitude: {final_max:.0f}")
            
        except Exception as e:
            logger.error(f"Error generating audio: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            # Use duration as-is for fallback silent audio (no pause adjustment)
            adjusted_duration = duration
            self._create_silent_audio_s3(audio_s3_key, adjusted_duration)

    def _create_silent_audio_s3(self, audio_s3_key, duration):
        try:
            sample_rate = 48000
            total_samples = int(duration * sample_rate)
            
            silent_audio = np.zeros(total_samples * 2, dtype=np.int16)
            
            wav_buffer = io.BytesIO()
            with wave.open(wav_buffer, 'wb') as wav_file:
                wav_file.setnchannels(2)
                wav_file.setsampwidth(2)
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(silent_audio.tobytes())
            
            wav_buffer.seek(0)
            audio_bytes = wav_buffer.read()
            
            s3_client.put_object(
                Bucket=AWS_S3_BUCKET,
                Key=audio_s3_key,
                Body=audio_bytes,
                ContentType='audio/wav'
            )
            
            logger.info(f"Created silent audio in S3: {duration:.1f}s - {audio_s3_key}")
            
        except Exception as e:
            logger.error(f"Error creating silent audio: {e}")

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
                 result_queue: queue.Queue, stop_event: threading.Event, target_fps: int = 20):
        
        self.room_url = room_url
        self.token = token
        self.room_name = room_name
        self.meeting_id = meeting_id
        self.result_queue = result_queue
        self.stop_event = stop_event
        self.target_fps = target_fps
        
        self.room = None
        self.is_connected = False
        
        # 🎬 FAST recording with target FPS
        self.stream_recorder = StreamingRecordingWithChunks(meeting_id, target_fps)
        
        self.active_video_streams = {}
        self.active_audio_streams = {}

        self.track_references = {}  # Map track.sid -> track object for unsubscribe
        self.is_paused = False
        self.pause_lock = threading.Lock()
  
        logger.info(f"✅ FAST Recording Bot - Target: {target_fps} FPS for meeting: {meeting_id}")

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
            
            await self._start_fast_recording()
            
        except Exception as e:
            logger.error(f"❌ Recording error: {e}")
            try:
                self.result_queue.put_nowait((False, str(e)))
            except:
                pass
        finally:
            await self._finalize()

    async def _start_fast_recording(self):
        """Start FAST continuous recording"""
        logger.info(f"🎬 Starting FAST recording @ {self.target_fps} FPS")
        
        self.stream_recorder.start_recording()
        
        # Start placeholder generation for fast video
        asyncio.create_task(self._fast_placeholder_loop())
        
        while not self.stop_event.is_set():
            await asyncio.sleep(0.1)
        
        self.stream_recorder.stop_recording()
        
        logger.info("FAST recording completed - generating output")

    async def _fast_placeholder_loop(self):
        """Generate placeholders - but NOT during pause"""
        PLACEHOLDER_INTERVAL = 1.0 / self.target_fps
        
        next_frame_time = time.perf_counter()
        placeholder_count = 0
        
        logger.info(f"🎬 Placeholder loop started")
        
        while not self.stop_event.is_set():
            # SKIP EVERYTHING DURING PAUSE
            if not self.stream_recorder.is_recording:
                await asyncio.sleep(0.5)  # Sleep longer during pause
                next_frame_time = time.perf_counter()  # Reset timing
                continue
            
            current_time = time.perf_counter()
            
            if current_time >= next_frame_time:
                timestamp = current_time - self.stream_recorder.start_perf_counter
                
                # SKIP placeholder if real screen share has started
                if self.stream_recorder.has_real_screen_share:
                    next_frame_time = current_time + PLACEHOLDER_INTERVAL
                    await asyncio.sleep(PLACEHOLDER_INTERVAL / 4)
                    continue
                
                placeholder = self.stream_recorder.create_placeholder_frame(placeholder_count, timestamp)
                
                self.stream_recorder.add_video_frame(
                    placeholder, "placeholder", timestamp_override=timestamp
                )
                # FIX: Also queue to frame processor for FFmpeg writing
                self.stream_recorder.frame_processor.queue_raw_frame(placeholder, timestamp, "placeholder")
                placeholder_count += 1
                next_frame_time = current_time + PLACEHOLDER_INTERVAL
            
            await asyncio.sleep(PLACEHOLDER_INTERVAL / 4)
        
        logger.info(f"✅ Placeholder loop stopped. Generated: {placeholder_count} placeholders")

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
                
                task = asyncio.create_task(self._capture_video_stream_fast(track, participant))
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
                        break
                    
            elif track.kind == rtc.TrackKind.KIND_AUDIO:
                for key in list(self.active_audio_streams.keys()):
                    if track.sid in key:
                        self.active_audio_streams[key].cancel()
                        del self.active_audio_streams[key]
                        logger.info(f"Stopped audio capture from {participant.identity}")
                        break
                    
        except Exception as e:
            logger.error(f"Track unsubscription error: {e}")

    async def _capture_video_stream_fast(self, track, participant):
        """Capture video with STRICT pause filtering."""
        try:
            stream = rtc.VideoStream(track, capacity=240)
            
            frame_count = 0
            rejected_count = 0
            start_time = time.perf_counter()
            last_log_time = start_time

            logger.info(f"📺 Starting FAST video capture from {participant.identity}")

            async for frame_event in stream:
                # CHECK 1: Stop event
                if self.stop_event.is_set():
                    logger.info(f"📺 Stop event - ending video capture")
                    break

                # CHECK 2: Recording state
                if not self.stream_recorder.is_recording:
                    rejected_count += 1
                    await asyncio.sleep(0.01)
                    continue

                # CHECK 3: Pause state
                if self.stream_recorder.is_paused:
                    rejected_count += 1
                    await asyncio.sleep(0.01)
                    continue
                
                # CHECK 4: Cutoff timestamp
                if self.stream_recorder.video_cutoff_timestamp is not None:
                    rejected_count += 1
                    await asyncio.sleep(0.01)
                    continue

                lf = frame_event.frame if hasattr(frame_event, "frame") else frame_event
                
                if lf is None:
                    continue

                try:
                    timestamp = frame_event.timestamp / 1e9
                except:
                    timestamp = time.perf_counter() - self.stream_recorder.start_perf_counter

                # Mark that real screen share has started
                if not self.stream_recorder.has_real_screen_share:
                    self.stream_recorder.has_real_screen_share = True
                    logger.info("✅ Real screen share frames started - stopping placeholders")
                
                self.stream_recorder.frame_processor.queue_raw_frame(
                    livekit_frame=lf,
                    timestamp=timestamp,
                    source_type="screen_share"
                )
                frame_count += 1

                # Periodic logging
                if time.perf_counter() - last_log_time >= 5.0:
                    elapsed = time.perf_counter() - start_time
                    actual_fps = frame_count / elapsed if elapsed > 0 else 0
                    queue_size = len(self.stream_recorder.frame_processor.raw_frame_queue)
                    
                    logger.info(
                        f"📺 Video: {frame_count} frames ({actual_fps:.1f} FPS), "
                        f"Queue: {queue_size}, Rejected: {rejected_count}"
                    )
                    last_log_time = time.perf_counter()

            logger.info(f"✅ Video capture ended - Frames: {frame_count}, Rejected: {rejected_count}")

        except asyncio.CancelledError:
            logger.info(f"📺 Video capture cancelled")
        except Exception as e:
            logger.error(f"❌ Video capture error: {e}")

    async def _capture_audio_stream(self, track, participant, track_source="microphone"):
        """Capture audio stream with STRICT pause filtering."""
        try:
            stream = rtc.AudioStream(track)
            sample_count = 0
            rejected_count = 0
            
            logger.info(f"🎤 Starting {track_source} capture from {participant.identity}")
            
            async for frame_event in stream:
                # CHECK 1: Stop event
                if self.stop_event.is_set():
                    logger.info(f"🎤 Stop event - ending audio capture for {participant.identity}")
                    break
                
                # CHECK 2: Recording state
                if not self.stream_recorder.is_recording:
                    rejected_count += 1
                    await asyncio.sleep(0.01)
                    continue
                
                # CHECK 3: Pause state
                if self.stream_recorder.is_paused:
                    rejected_count += 1
                    await asyncio.sleep(0.01)
                    continue
                
                # CHECK 4: Cutoff timestamp
                if self.stream_recorder.audio_cutoff_timestamp is not None:
                    rejected_count += 1
                    await asyncio.sleep(0.01)
                    continue
                
                frame = frame_event.frame if hasattr(frame_event, 'frame') else frame_event
                
                if frame:
                    samples = self._convert_frame_to_audio_simple(frame)
                    
                    if samples:
                        self.stream_recorder.add_audio_samples(
                            samples, 
                            participant.identity,
                            track.sid,
                            track_source
                        )
                        sample_count += len(samples)
            
            logger.info(f"✅ Audio capture ended for {participant.identity}")
            logger.info(f"   - Processed: {sample_count} samples")
            logger.info(f"   - Rejected (pause): {rejected_count} frames")
            self.stream_recorder.processing_tracks.discard(track.sid)
            
        except asyncio.CancelledError:
            logger.info(f"🎤 Audio capture cancelled for {participant.identity}")
        except Exception as e:
            logger.error(f"❌ Audio capture error for {participant.identity}: {e}")
            self.stream_recorder.processing_tracks.discard(track.sid)

    def _convert_frame_to_audio_simple(self, frame):
        """Convert LiveKit audio frame to samples with proper format detection"""
        try:
            if not frame or not hasattr(frame, 'data') or not frame.data:
                return None
            
            sample_rate = getattr(frame, 'sample_rate', 48000)
            num_channels = getattr(frame, 'num_channels', 1)
            samples_per_channel = getattr(frame, 'samples_per_channel', 0)
            
            if not hasattr(self, '_logged_audio_format'):
                logger.info(f"🎵 Audio: {sample_rate}Hz, {num_channels}ch, {samples_per_channel} samples/ch")
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

    def _on_connected(self):
        """Handle room connection"""
        logger.info("✅ Connected to room")
        self.is_connected = True

    def _on_disconnected(self, reason):
        """Handle room disconnection"""
        logger.warning(f"⚠️ Room disconnected: {reason}")

async def _finalize(self):
    """Finalize recording and generate FAST output"""
    try:
        logger.info("Finalizing FAST recording...")
        
        for task in list(self.active_video_streams.values()):
            task.cancel()
        for task in list(self.active_audio_streams.values()):
            task.cancel()
        
        await asyncio.sleep(1.0)
        
        # ✅ FIX: Stop recording (closes FFmpeg) - video is already created
        self.stream_recorder.stop_recording()
        
        # ✅ FIX: Set paths from stream_recorder (video already exists)
        self.final_video_path = self.stream_recorder.temp_video_path
        self.final_audio_path = None  # Audio handled in finalization
        
        if self.room and self.is_connected:
            try:
                await asyncio.wait_for(self.room.disconnect(), timeout=30.0)
            except:
                pass
        
        logger.info("FAST recording finalized successfully")
        
    except Exception as e:
        logger.error(f"Finalization error: {e}")

class FixedGoogleMeetRecorder:
    """Fixed Google Meet style recorder with FAST PLAYBACK"""
    
    def __init__(self):
        # CORRECTED: Use HTTPS URL for API calls, WSS for WebSocket
        self.livekit_url = os.getenv("LIVEKIT_URL", "wss://imeetpro-eqbe3stz.livekit.cloud")
        self.livekit_wss_url = os.getenv("LIVEKIT_WSS_URL", "wss://imeetpro-eqbe3stz.livekit.cloud")
        
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
        
        mongo_uri = os.getenv("MONGO_URI", "mongodb://mongodb.databases.svc.cluster.local:27017/imeetpro")
        self.mongo_client = MongoClient(mongo_uri)
        self.db = self.mongo_client[os.getenv("MONGO_DB", "imeetpro")]  
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

    def _redis_key(self, meeting_id: str) -> str:
        """Generate Redis key for recording state"""
        return f"recording:active:{meeting_id}"
    
    def _save_recording_to_redis(self, meeting_id: str, recording_data: dict) -> bool:
        """Save recording state to Redis"""
        try:
            if not REDIS_AVAILABLE or not redis_client:
                logger.warning("Redis not available, using in-memory only")
                return False
            
            # Convert non-serializable objects to strings
            redis_data = {
                "meeting_id": meeting_id,
                "room_name": recording_data.get("room_name", ""),
                "recording_doc_id": recording_data.get("recording_doc_id", ""),
                "recorder_identity": recording_data.get("recorder_identity", ""),
                "host_user_id": recording_data.get("host_user_id", ""),
                "target_fps": recording_data.get("target_fps", 20),
                "is_paused": recording_data.get("is_paused", False),
                "start_time": recording_data.get("start_time").isoformat() if recording_data.get("start_time") else "",
                "status": "active"
            }
            
            # Store with 6 hour TTL (recordings shouldn't last longer)
            redis_client.setex(
                self._redis_key(meeting_id),
                21600,  # 6 hours
                json.dumps(redis_data)
            )
            logger.info(f"✅ Recording state saved to Redis: {meeting_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to save recording to Redis: {e}")
            return False
    
    def _get_recording_from_redis(self, meeting_id: str) -> Optional[dict]:
        """Get recording state from Redis"""
        try:
            if not REDIS_AVAILABLE or not redis_client:
                return None
            
            data = redis_client.get(self._redis_key(meeting_id))
            if data:
                return json.loads(data)
            return None
            
        except Exception as e:
            logger.error(f"❌ Failed to get recording from Redis: {e}")
            return None
    
    def _delete_recording_from_redis(self, meeting_id: str) -> bool:
        """Delete recording state from Redis"""
        try:
            if not REDIS_AVAILABLE or not redis_client:
                return False
            
            redis_client.delete(self._redis_key(meeting_id))
            logger.info(f"✅ Recording state deleted from Redis: {meeting_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to delete recording from Redis: {e}")
            return False
    
    def _update_recording_in_redis(self, meeting_id: str, updates: dict) -> bool:
        """Update recording state in Redis"""
        try:
            if not REDIS_AVAILABLE or not redis_client:
                return False
            
            existing = self._get_recording_from_redis(meeting_id)
            if existing:
                existing.update(updates)
                redis_client.setex(
                    self._redis_key(meeting_id),
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
        """Check if any recordings need to be stopped (requested from other pods)"""
        try:
            if not REDIS_AVAILABLE:
                return
            
            with self._global_lock:
                for meeting_id in list(self.active_recordings.keys()):
                    redis_data = self._get_recording_from_redis(meeting_id)
                    if redis_data and redis_data.get("status") == "stop_requested":
                        logger.info(f"🛑 Stop request detected from Redis for {meeting_id}")
                        self.stop_stream_recording(meeting_id)
                        
        except Exception as e:
            logger.error(f"Error checking Redis stop requests: {e}")
            
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
            recording_metadata = {
                "meeting_id": meeting_id,
                "host_user_id": host_user_id,
                "room_name": room_name,
                "recording_status": "starting",
                "recording_type": "fast_google_meet",
                "target_fps": self.target_fps,
                "start_time": datetime.now(),
                "created_at": datetime.now()
            }
            
            result = self.collection.insert_one(recording_metadata)
            recording_doc_id = str(result.inserted_id)
            
            recorder_identity = f"fast_recorder_{meeting_id}_{timestamp}"
            
            success, error_msg, bot_instance = self._start_fast_recording(
                room_name, meeting_id, host_user_id, recording_doc_id, recorder_identity
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
                           recording_doc_id: str, recorder_identity: str) -> Tuple[bool, Optional[str], Optional[object]]:
        """Start FAST recording process with proper bot instance storage"""
        try:
            recorder_token = self.generate_recorder_token(room_name, recorder_identity)
            
            result_queue = queue.Queue()
            stop_event = threading.Event()
            
            # ✅ CRITICAL: Use a holder dict to pass bot instance back from thread
            bot_instance_holder = {}  # Will be filled by the thread with 'bot' key
            
            future = self.thread_pool.submit(
                self._run_fast_recording_task_with_bot_return,
                self.livekit_wss_url, recorder_token, room_name, meeting_id,
                result_queue, stop_event, self.target_fps, bot_instance_holder
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
                                               bot_instance_holder: dict):
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
                target_fps=target_fps
            )
            
            # ✅ CRITICAL: Store bot in holder BEFORE running so pause can access it
            bot_instance_holder['bot'] = bot
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

    def stop_stream_recording(self, meeting_id: str) -> Dict:
        """Stop recording with Redis state lookup for cross-pod support"""
        
        # First check local in-memory (same pod that started)
        with self._global_lock:
            local_recording = self.active_recordings.get(meeting_id)
        
        # If not found locally, check Redis (different pod scenario)
        redis_recording = self._get_recording_from_redis(meeting_id)
        
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
            # Different pod - we have Redis info but no bot instance
            recording_info = redis_recording
            has_bot = False
            logger.warning(f"⚠️ Recording found in Redis but not locally - different pod scenario")
        
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
                    
                    # Clean up local and Redis
                    with self._global_lock:
                        if meeting_id in self.active_recordings:
                            del self.active_recordings[meeting_id]
                    self._delete_recording_from_redis(meeting_id)

                    return {
                        "status": "success",
                        "message": "FAST recording stopped. Processing will continue in background.",
                        "meeting_id": meeting_id
                    }
            else:
                # Different pod - mark as stopped in Redis, actual pod will clean up
                self._update_recording_in_redis(meeting_id, {"status": "stop_requested"})
                logger.info(f"⚠️ Stop requested via Redis for {meeting_id} - recording pod will handle cleanup")
                
                return {
                    "status": "success",
                    "message": "Stop signal sent. Recording will be stopped by the recording pod.",
                    "meeting_id": meeting_id,
                    "note": "Cross-pod stop - finalization will be handled by original pod"
                }
            
            # Cleanup
            with self._global_lock:
                if meeting_id in self.active_recordings:
                    del self.active_recordings[meeting_id]
            self._delete_recording_from_redis(meeting_id)

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

    def pause_stream_recording(self, meeting_id: str) -> Dict:
        """
        Pause recording with STRICT cutoff enforcement.
        
        KEY: Set cutoff timestamps BEFORE any other action to ensure
        no samples from this point forward are accepted.
        """
        with self._global_lock:
            if meeting_id not in self.active_recordings:
                return {
                    "status": "no_recording",
                    "message": "No active recording found",
                    "meeting_id": meeting_id
                }
            
            recording_info = self.active_recordings[meeting_id]
            
            if recording_info.get("is_paused"):
                return {
                    "status": "already_paused",
                    "message": "Recording is already paused",
                    "meeting_id": meeting_id
                }
            
            bot = recording_info.get("bot_instance")
            if not bot:
                logger.warning(f"⚠️ No bot for {meeting_id}")
                return {
                    "status": "error",
                    "message": "Bot not available",
                    "meeting_id": meeting_id
                }
            
            try:
                recorder = bot.stream_recorder
                
                # ✅ STEP 1: IMMEDIATELY SET CUTOFF - This is the FIRST thing to do
                # This ensures ANY sample arriving after this point is rejected
                current_perf = time.perf_counter()
                pause_timestamp = current_perf - recorder.start_perf_counter
                
                # Store the RAW perf_counter time for comparison against late-arriving samples
                recorder.pause_real_timestamp = current_perf
                recorder.audio_cutoff_timestamp = pause_timestamp
                recorder.video_cutoff_timestamp = pause_timestamp
                
                logger.info(f"🔒 CUTOFF SET at {pause_timestamp:.3f}s (perf: {current_perf:.3f})")
                
                # ✅ STEP 2: Set pause flags
                recorder.is_paused = True
                recorder.is_recording = False
                
                # ✅ STEP 3: Wait for in-flight operations to see the flags
                time.sleep(0.15)  # 150ms grace period
                
                # ✅ STEP 4: Clear queues
                recorder.frame_processor.raw_frame_queue.clear()
                
                # ✅ STEP 5: Flush valid audio (captured BEFORE pause) and discard rest
                with recorder.audio_lock:
                    for track_key, participant_buffer in recorder.participant_audio_buffers.items():
                        buffer_data = participant_buffer['buffer']
                        buffer_start = participant_buffer['buffer_start_time']
                        
                        if len(buffer_data) > 0 and buffer_start < pause_timestamp:
                            # Calculate how much of this buffer is valid (before pause)
                            buffer_duration = len(buffer_data) / (48000 * 2)
                            buffer_end = buffer_start + buffer_duration
                            
                            if buffer_end <= pause_timestamp:
                                # Entire buffer is valid
                                recorder.raw_audio_data.append({
                                    'timestamp': buffer_start,
                                    'samples': buffer_data.copy(),
                                    'participant': participant_buffer['participant'],
                                    'source': participant_buffer.get('source', 'microphone')
                                })
                                logger.info(f"✅ Flushed complete buffer for {track_key}: {len(buffer_data)} samples")
                            else:
                                # Only part of buffer is valid - truncate
                                valid_duration = pause_timestamp - buffer_start
                                valid_samples = int(valid_duration * 48000 * 2)
                                if valid_samples > 0:
                                    recorder.raw_audio_data.append({
                                        'timestamp': buffer_start,
                                        'samples': buffer_data[:valid_samples],
                                        'participant': participant_buffer['participant'],
                                        'source': participant_buffer.get('source', 'microphone')
                                    })
                                    logger.info(f"✅ Flushed truncated buffer for {track_key}: {valid_samples}/{len(buffer_data)} samples")
                    
                    # Clear all buffers and track registrations
                    recorder.participant_audio_buffers.clear()
                    recorder.active_audio_tracks.clear()
                
                # ✅ STEP 6: Record pause event
                recorder.pause_events.append({
                    'pause_start': pause_timestamp,
                    'pause_real_perf': current_perf,
                    'pause_end': None,
                    'duration': None
                })
                
                # ✅ STEP 7: Update recording info
                recording_info["is_paused"] = True
                recording_info["pause_start_time"] = datetime.now()
                recording_info["pause_timestamp"] = pause_timestamp
                recording_info["pause_real_perf"] = current_perf
                
                if "total_pause_duration" not in recording_info:
                    recording_info["total_pause_duration"] = 0.0
                if "pause_events" not in recording_info:
                    recording_info["pause_events"] = []
                
                logger.info(f"⏸️  Recording PAUSED for {meeting_id}")
                logger.info(f"   - Pause timestamp: {pause_timestamp:.3f}s")
                logger.info(f"   - Cutoffs active: audio={recorder.audio_cutoff_timestamp}, video={recorder.video_cutoff_timestamp}")
                logger.info(f"   - All capture BLOCKED")
                
                return {
                    "status": "paused",
                    "message": "Recording paused - all capture blocked with cutoff",
                    "meeting_id": meeting_id,
                    "paused_at": recording_info["pause_start_time"].isoformat(),
                    "paused_at_timestamp": pause_timestamp
                }
                
            except Exception as e:
                logger.error(f"❌ Error pausing recording: {e}")
                import traceback
                logger.error(traceback.format_exc())
                
                return {
                    "status": "error",
                    "message": f"Pause failed: {str(e)}",
                    "meeting_id": meeting_id
                }
    def resume_stream_recording(self, meeting_id: str) -> Dict:
        """
        Resume recording with proper timeline adjustment.
        
        KEY: Clear cutoffs AFTER adjusting start_perf_counter so new
        samples get correct timestamps.
        """
        with self._global_lock:
            if meeting_id not in self.active_recordings:
                return {
                    "status": "no_recording",
                    "message": "No active recording found",
                    "meeting_id": meeting_id
                }
            
            recording_info = self.active_recordings[meeting_id]
            
            if not recording_info.get("is_paused"):
                return {
                    "status": "not_paused",
                    "message": "Recording is not paused",
                    "meeting_id": meeting_id
                }
            
            try:
                bot = recording_info.get("bot_instance")
                if not bot:
                    return {
                        "status": "error", 
                        "message": "Bot not available",
                        "meeting_id": meeting_id
                    }
                
                recorder = bot.stream_recorder
                
                # ✅ STEP 1: Calculate pause duration
                pause_start_time = recording_info.get("pause_start_time")
                pause_duration = (datetime.now() - pause_start_time).total_seconds()
                
                pause_start_perf = recording_info.get("pause_real_perf")
                current_perf = time.perf_counter()
                actual_pause_duration = current_perf - pause_start_perf
                
                logger.info(f"📊 Pause duration: {pause_duration:.2f}s (actual perf: {actual_pause_duration:.2f}s)")
                
                # ✅ STEP 2: Complete pause event record
                if recorder.pause_events:
                    last_pause = recorder.pause_events[-1]
                    if last_pause.get('pause_end') is None:
                        last_pause['pause_end'] = last_pause['pause_start'] + pause_duration
                        last_pause['duration'] = pause_duration
                        recorder.total_pause_duration += pause_duration
                
                # ✅ STEP 3: Update recording info
                recording_info["pause_events"].append({
                    "paused_at": pause_start_time.isoformat(),
                    "resumed_at": datetime.now().isoformat(),
                    "duration_seconds": pause_duration
                })
                recording_info["total_pause_duration"] = recording_info.get("total_pause_duration", 0) + pause_duration
                
                # ✅ STEP 4: Clear all audio/video state BEFORE enabling
                with recorder.audio_lock:
                    recorder.participant_audio_buffers.clear()
                    recorder.active_audio_tracks.clear()
                
                recorder.frame_processor.raw_frame_queue.clear()
                
                # ✅ STEP 5: Adjust start_perf_counter to compress timeline
                # This makes new timestamps continuous with pre-pause timestamps
                recorder.start_perf_counter += actual_pause_duration
                logger.info(f"⏱️ Timeline adjusted: start_perf_counter += {actual_pause_duration:.3f}s")
                
                # ✅ STEP 6: Clear the cutoff timestamps and pause markers
                recorder.audio_cutoff_timestamp = None
                recorder.video_cutoff_timestamp = None
                recorder.pause_real_timestamp = None
                
                # ✅ STEP 7: Clear pause flags
                recorder.is_paused = False
                
                # ✅ STEP 8: Small delay to ensure state is consistent
                time.sleep(0.05)
                
                # ✅ STEP 9: Enable recording LAST
                recorder.is_recording = True
                
                # ✅ STEP 10: Update recording info
                recording_info["is_paused"] = False
                
                # Calculate what the new timestamp will be
                new_timestamp = time.perf_counter() - recorder.start_perf_counter
                
                logger.info(f"▶️  Recording RESUMED for {meeting_id}")
                logger.info(f"   - Paused for {pause_duration:.2f}s")
                logger.info(f"   - Total pause time: {recording_info['total_pause_duration']:.2f}s")
                logger.info(f"   - New timestamp baseline: {new_timestamp:.3f}s")
                logger.info(f"   - Cutoffs cleared, capture re-enabled")
                
                return {
                    "status": "resumed",
                    "message": "Recording resumed - timestamps adjusted for continuous output",
                    "meeting_id": meeting_id,
                    "paused_duration_seconds": pause_duration,
                    "total_pause_duration": recording_info["total_pause_duration"],
                    "resumed_at": datetime.now().isoformat(),
                    "new_timestamp": new_timestamp
                }
                
            except Exception as e:
                logger.error(f"❌ Error resuming recording: {e}")
                import traceback
                logger.error(traceback.format_exc())
                
                return {
                    "status": "error",
                    "message": f"Resume failed: {str(e)}",
                    "meeting_id": meeting_id
                }

    def _async_finalize_fast_recording(self, meeting_id: str, recording_info: dict):
        """Run full S3/FFmpeg finalization - FIXED VERSION with Audio"""
        try:
            import os
            import subprocess
            import tempfile
            
            recording_future = recording_info.get("recording_future")
            bot_instance = recording_info.get("bot_instance")
            
            if recording_future:
                logger.info(f"🎬 FAST background finalization started for {meeting_id}")
                try:
                    recording_future.result(timeout=120)
                except Exception as e:
                    logger.warning(f"⚠️ Recording future error: {e}")
                logger.info(f"✅ FAST background finalization done for {meeting_id}")
            
            # ✅ STEP 1: Get temp video file from bot
            temp_video_path = None
            stream_recorder = None
            
            if bot_instance and hasattr(bot_instance, 'stream_recorder'):
                stream_recorder = bot_instance.stream_recorder
                temp_video_path = stream_recorder.temp_video_path
                logger.info(f"📁 Temp video path: {temp_video_path}")
            
            if not temp_video_path or not os.path.exists(temp_video_path):
                logger.error(f"❌ Temp video file not found")
                self._cleanup_recording(meeting_id)
                return
            
            video_size = os.path.getsize(temp_video_path)
            if video_size == 0:
                logger.error(f"❌ Temp video file is empty")
                self._cleanup_recording(meeting_id)
                return
            
            logger.info(f"📊 Video file: {video_size:,} bytes")
            
            # ✅ STEP 2: Generate audio file from captured data
            temp_audio_path = None
            has_audio = False
            
            if stream_recorder and stream_recorder.raw_audio_data:
                logger.info(f"🎵 Processing {len(stream_recorder.raw_audio_data)} audio chunks...")
                
                try:
                    import wave
                    import numpy as np
                    
                    temp_audio_fd, temp_audio_path = tempfile.mkstemp(suffix='.wav', prefix=f'audio_{meeting_id}_')
                    os.close(temp_audio_fd)
                    
                    sample_rate = 48000
                    frames_written = getattr(stream_recorder, 'frames_written', 0)
                    duration = max(frames_written / 20.0, 5.0)
                    
                    total_samples = int(duration * sample_rate * 2)
                    final_audio = np.zeros(total_samples, dtype=np.float64)
                    
                    for audio_chunk in stream_recorder.raw_audio_data:
                        timestamp = audio_chunk.get('timestamp', 0)
                        samples = audio_chunk.get('samples', [])
                        
                        if not samples:
                            continue
                        
                        start_sample = int(timestamp * sample_rate * 2)
                        if start_sample < 0 or start_sample >= total_samples:
                            continue
                        
                        audio_data = np.array(samples, dtype=np.float64)
                        end_sample = min(start_sample + len(audio_data), total_samples)
                        audio_length = end_sample - start_sample
                        
                        if audio_length > 0:
                            final_audio[start_sample:end_sample] += audio_data[:audio_length]
                    
                    max_val = np.max(np.abs(final_audio))
                    if max_val > 0:
                        final_audio = final_audio * (32000.0 / max_val)
                    
                    final_audio_int16 = np.clip(final_audio, -32768, 32767).astype(np.int16)
                    
                    with wave.open(temp_audio_path, 'wb') as wav_file:
                        wav_file.setnchannels(2)
                        wav_file.setsampwidth(2)
                        wav_file.setframerate(sample_rate)
                        wav_file.writeframes(final_audio_int16.tobytes())
                    
                    audio_size = os.path.getsize(temp_audio_path)
                    logger.info(f"✅ Audio file created: {audio_size:,} bytes")
                    has_audio = audio_size > 1000
                    
                except Exception as audio_err:
                    logger.error(f"❌ Audio generation failed: {audio_err}")
                    has_audio = False
            else:
                logger.warning(f"⚠️ No audio data captured")
            
            # ✅ STEP 3: Merge video + audio into MP4
            temp_final_fd, temp_final_path = tempfile.mkstemp(suffix='.mp4', prefix=f'final_{meeting_id}_')
            os.close(temp_final_fd)
            
            try:
                if has_audio and temp_audio_path:
                    logger.info(f"🎬 Merging video + audio into MP4...")
                    merge_cmd = [
                        'ffmpeg', '-y',
                        '-i', temp_video_path,
                        '-i', temp_audio_path,
                        '-c:v', 'libx264',
                        '-preset', 'fast',
                        '-crf', '23',
                        '-c:a', 'aac',
                        '-b:a', '192k',
                        '-ar', '48000',
                        '-ac', '2',
                        '-movflags', '+faststart',
                        '-shortest',
                        temp_final_path
                    ]
                else:
                    logger.info(f"🎬 Converting video to MP4 (no audio)...")
                    merge_cmd = [
                        'ffmpeg', '-y',
                        '-i', temp_video_path,
                        '-c:v', 'libx264',
                        '-preset', 'fast',
                        '-crf', '23',
                        '-movflags', '+faststart',
                        temp_final_path
                    ]
                
                result = subprocess.run(merge_cmd, capture_output=True, text=True, timeout=600)
                
                if result.returncode != 0:
                    logger.error(f"❌ FFmpeg merge failed: {result.stderr[-500:]}")
                    temp_final_path = temp_video_path
                else:
                    logger.info(f"✅ MP4 created successfully")
                    
            except subprocess.TimeoutExpired:
                logger.error(f"❌ FFmpeg merge timeout")
                temp_final_path = temp_video_path
            except Exception as merge_err:
                logger.error(f"❌ Merge error: {merge_err}")
                temp_final_path = temp_video_path
            
            # ✅ STEP 4: Upload to S3
            final_size = os.path.getsize(temp_final_path)
            if final_size == 0:
                logger.error(f"❌ Final file is empty")
                self._cleanup_recording(meeting_id)
                return
            
            file_ext = '.mp4' if temp_final_path.endswith('.mp4') else '.avi'
            final_s3_key = f"videos/{meeting_id}_recording{file_ext}"
            
            logger.info(f"📤 Uploading to S3: {final_s3_key} ({final_size:,} bytes)")
            
            try:
                s3_client.upload_file(temp_final_path, AWS_S3_BUCKET, final_s3_key)
                logger.info(f"✅ Uploaded to S3: s3://{AWS_S3_BUCKET}/{final_s3_key}")
            except Exception as upload_err:
                logger.error(f"❌ S3 upload failed: {upload_err}")
                self._cleanup_recording(meeting_id)
                return
            
            # ✅ STEP 5: Cleanup temp files
            for temp_file in [temp_video_path, temp_audio_path]:
                try:
                    if temp_file and os.path.exists(temp_file):
                        os.remove(temp_file)
                        logger.info(f"🧹 Deleted: {temp_file}")
                except:
                    pass
            
            if temp_final_path != temp_video_path:
                try:
                    if os.path.exists(temp_final_path):
                        os.remove(temp_final_path)
                except:
                    pass
            
            # ✅ STEP 6: Update database
            try:
                self.collection.update_one(
                    {"meeting_id": meeting_id},
                    {"$set": {
                        "recording_status": "completed",
                        "completed_at": datetime.now(),
                        "file_path": final_s3_key,
                        "file_size": final_size,
                        "has_audio": has_audio,
                        "s3_bucket": AWS_S3_BUCKET,
                        "s3_url": f"s3://{AWS_S3_BUCKET}/{final_s3_key}"
                    }}
                )
                logger.info(f"✅ Database updated for {meeting_id}")
            except Exception as db_err:
                logger.warning(f"⚠️ DB update failed: {db_err}")

            # ✅ STEP 6.1: Insert into 'test' collection for video listing API
            try:
                from pymongo import MongoClient
                from django.db import connection
                
                # Get MongoDB test collection
                mongo_client = MongoClient(os.getenv('MONGO_URI', 'mongodb://mongodb.databases.svc.cluster.local:27017/connectlydb'))
                test_collection = mongo_client['connectlydb']['test']
                
                # Check if already exists
                existing = test_collection.find_one({'meeting_id': meeting_id, 'is_final_video': True})
                if not existing:
                    # Get host info from MySQL
                    host_user_id = recording_info.get("host_user_id", 8)
                    cursor = connection.cursor()
                    
                    # Get host details
                    cursor.execute('''
                        SELECT p.User_ID, u.email, u.full_name
                        FROM tbl_Participants p
                        LEFT JOIN tbl_Users u ON p.User_ID = u.ID
                        WHERE p.Meeting_ID = %s AND p.Role = 'host'
                        LIMIT 1
                    ''', [meeting_id])
                    host_row = cursor.fetchone()
                    
                    host_email = host_row[1] if host_row else ''
                    host_name = host_row[2] if host_row else 'Host'
                    
                    # Get all participant emails
                    cursor.execute('''
                        SELECT DISTINCT u.email 
                        FROM tbl_Participants p
                        JOIN tbl_Users u ON p.User_ID = u.ID
                        WHERE p.Meeting_ID = %s AND u.email IS NOT NULL
                    ''', [meeting_id])
                    participant_emails = [row[0] for row in cursor.fetchall()] or [host_email]
                    
                    # Generate S3 URL
                    s3_url = f"https://{AWS_S3_BUCKET}.s3.ap-south-1.amazonaws.com/{final_s3_key}"
                    filename = final_s3_key.split('/')[-1]
                    
                    # Insert into test collection
                    video_doc = {
                        'meeting_id': meeting_id,
                        'filename': filename,
                        'video_url': s3_url,
                        's3_key': final_s3_key,
                        'file_size': final_size,
                        'is_final_video': True,
                        'status': 'completed',
                        'timestamp': datetime.now(),
                        'created_at': datetime.now(),
                        'user_id': host_user_id,
                        'visible_to': participant_emails,
                        'meeting_type': recording_info.get('meeting_type', 'InstantMeeting'),
                        'host_name': host_name,
                        'display_name': f'Recording - {meeting_id}',
                        'has_audio': has_audio
                    }
                    
                    test_collection.insert_one(video_doc)
                    logger.info(f"✅ Video inserted into 'test' collection for API listing: {meeting_id}")
                else:
                    logger.info(f"ℹ️ Video already exists in 'test' collection: {meeting_id}")
                    
            except Exception as test_db_err:
                logger.warning(f"⚠️ Failed to insert into test collection: {test_db_err}")
            
            # ✅ STEP 7: Trigger processing pipeline
            try:
                self._trigger_processing_pipeline(
                    final_s3_key, meeting_id,
                    recording_info.get("host_user_id"),
                    recording_info.get("recording_doc_id")
                )
            except Exception as e:
                logger.warning(f"⚠️ Processing pipeline failed: {e}")
            
            # ✅ STEP 8: Final cleanup
            self._cleanup_recording(meeting_id)
            
            logger.info(f"🎉 Recording COMPLETE for {meeting_id}")
            logger.info(f"   📹 Video: {video_size:,} bytes")
            logger.info(f"   🎵 Audio: {'Yes' if has_audio else 'No'}")
            logger.info(f"   📦 Final: {final_size:,} bytes")
            logger.info(f"   ☁️  S3: {final_s3_key}")
            
        except Exception as e:
            logger.error(f"❌ Finalization failed for {meeting_id}: {e}")
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
            import tempfile
            import os
            
            logger.info(f"🎬 Processing pipeline triggered for FAST video: {meeting_id}")
            
            if video_file_path.startswith('s3://'):
                s3_key = video_file_path.replace('s3://' + AWS_S3_BUCKET + '/', '')
            elif video_file_path.startswith('recordings_temp/'):
                s3_key = video_file_path
            else:
                s3_key = video_file_path
            
            logger.info(f"📍 S3 Key: {s3_key}")
            
            # Download from S3
            temp_fd, temp_video_path = tempfile.mkstemp(
                suffix='.mp4',
                prefix=f'process_fast_video_{meeting_id}_'
            )
            os.close(temp_fd)
            
            try:
                s3_client.download_file(
                    Bucket=AWS_S3_BUCKET,
                    Key=s3_key,
                    Filename=temp_video_path
                )
                
                file_size = os.path.getsize(temp_video_path)
                logger.info(f"✅ Downloaded FAST video: {file_size:,} bytes from S3")
                
                if file_size == 0:
                    raise Exception("Downloaded video file is empty")
                
            except Exception as download_error:
                logger.error(f"❌ Failed to download video from S3: {download_error}")
                raise Exception(f"S3 download failed: {str(download_error)}")
            
            from core.UserDashBoard.recordings import process_video_sync
            
            from core.scheduler.tasks import process_video_task

            logger.info(f"🚀 Dispatching Celery background task for meeting={meeting_id}")
            process_video_task.delay(temp_video_path, meeting_id, host_user_id)
            logger.info(f"✅ Celery task dispatched successfully for meeting={meeting_id}")
            result = {"status": "success", "message": "Background task dispatched"}
            
            # Clean up temp file after processing
            try:
                if os.path.exists(temp_video_path):
                    os.remove(temp_video_path)
                    logger.info(f"🧹 Deleted temp video file: {temp_video_path}")
            except Exception as cleanup_error:
                logger.warning(f"⚠️ Could not delete temp file: {cleanup_error}")
            
            # Process result
            if result.get("status") == "success":
                processing_data = {
                    "recording_status": "completed",
                    "processing_completed": True,
                    "video_url": result.get("video_url"),
                    "transcript_url": result.get("transcript_url"),
                    "summary_url": result.get("summary_url"),
                    "image_url": result.get("summary_image_url"),
                    "subtitles": result.get("subtitle_urls", {}),
                    "file_size": result.get("file_size", 0),
                    "processing_end_time": datetime.now(),
                    "encoder_used": result.get("encoder_used"),
                    "gpu_accelerated": result.get("gpu_accelerated"),
                    "video_type": "fast_smooth_duplicated"
                }
                
                try:
                    from bson import ObjectId
                    if len(recording_doc_id) == 24:
                        self.collection.update_one(
                            {"_id": ObjectId(recording_doc_id)},
                            {"$set": processing_data}
                        )
                        logger.info(f"✅ Updated MongoDB with FAST processing results")
                except Exception as db_error:
                    logger.warning(f"Database update error: {db_error}")
                
                # ========== SEND RECORDING COMPLETION NOTIFICATIONS ==========
                try:
                    from core.UserDashBoard.recordings import send_recording_completion_notifications
                    
                    logger.info(f"📧 Sending recording completion notifications for {meeting_id}...")
                    
                    notification_count = send_recording_completion_notifications(
                        meeting_id=meeting_id,
                        video_url=result.get("video_url"),
                        transcript_url=result.get("transcript_url"),
                        summary_url=result.get("summary_url")
                    )
                    
                    logger.info(f"✅ Sent {notification_count} recording notifications for FAST video")
                    
                except Exception as notif_error:
                    logger.error(f"⚠️ Recording notifications failed: {notif_error}")
                    import traceback
                    logger.error(traceback.format_exc())
                # ========== END NOTIFICATIONS ==========
                
                return {
                    "status": "success",
                    "processing_completed": True,
                    "video_url": result.get("video_url"),
                    "transcript_url": result.get("transcript_url"),
                    "summary_url": result.get("summary_url"),
                    "video_type": "fast_smooth_duplicated"
                }
            else:
                error_msg = result.get("error", "Unknown processing error")
                logger.error(f"❌ Processing failed: {error_msg}")
                return {
                    "status": "error",
                    "error": error_msg
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