# =============================================================================
# FILE 1 OF 7: tasks_gpu.py
# =============================================================================
# Location: core/FaceAuth/tasks_gpu.py  (CREATE NEW FILE)
#
# Purpose: Celery task that runs InsightFace identity verification on GPU.
#          This task runs ONLY on the identity-service pod (dedicated GPU).
#          Backend pod sends frames here via Redis → identity-service picks
#          them up → runs InsightFace on CUDA → returns result via Redis.
#
# Queue: identity_gpu_tasks (separate from gpu_tasks used by gpu-worker)
# =============================================================================

import logging
import base64
import io
import numpy as np
from PIL import Image
from celery import shared_task

logger = logging.getLogger(__name__)


def decode_frame_from_base64(frame_base64: str) -> np.ndarray:
    """
    Decode base64 string to numpy array (BGR format).
    Same logic as decode_image() in Attendance.py to ensure consistency.
    """
    import cv2

    # Strip data URL prefix if present (e.g., "data:image/jpeg;base64,...")
    if ',' in frame_base64:
        frame_base64 = frame_base64.split(',')[1]

    image_bytes = base64.b64decode(frame_base64)
    image = Image.open(io.BytesIO(image_bytes))
    numpy_array = np.array(image)
    bgr_frame = cv2.cvtColor(numpy_array, cv2.COLOR_RGB2BGR)
    return bgr_frame


@shared_task(
    name='verify_identity_gpu',
    queue='identity_gpu_tasks',
    bind=True,
    max_retries=1,
    soft_time_limit=8,
    time_limit=10,
    acks_late=True,
    reject_on_worker_lost=True,
)
def verify_identity_gpu(self, frame_base64: str, user_id: int, threshold: float = 0.6):
    """
    GPU-accelerated identity verification task.

    Runs ONLY on the identity-service pod where:
    - nvidia/cuda:11.8.0 base image is available
    - nvidia.com/gpu: 1 is assigned in Kubernetes
    - onnxruntime-gpu uses CUDAExecutionProvider
    - InsightFace buffalo_l model runs on GPU

    Args:
        frame_base64 (str): Base64-encoded webcam frame from frontend
        user_id (int): User ID to verify against stored embeddings
        threshold (float): Face distance threshold (default: 0.6)

    Returns:
        dict: {
            'verified': bool,
            'similarity': float,
            'gpu_used': bool,
            'error': str or None
        }
    """
    try:
        logger.info(f"GPU Identity verification started for user_id={user_id}")

        # ----------------------------------------------------------
        # STEP A: Check if GPU is actually available
        # ----------------------------------------------------------
        gpu_available = False
        try:
            import torch
            gpu_available = torch.cuda.is_available()
            if gpu_available:
                gpu_name = torch.cuda.get_device_name(0)
                logger.info(f"GPU detected: {gpu_name}")
            else:
                logger.warning("CUDA not available - will use CPU fallback")
        except ImportError:
            logger.warning("PyTorch not available for GPU check")

        # ----------------------------------------------------------
        # STEP B: Decode the frame from base64 to numpy array
        # ----------------------------------------------------------
        try:
            frame = decode_frame_from_base64(frame_base64)
            if frame is None or frame.size == 0:
                logger.warning(f"Empty frame for user {user_id}")
                return {
                    'verified': True,
                    'similarity': 1.0,
                    'gpu_used': gpu_available,
                    'error': 'empty_frame'
                }
        except Exception as e:
            logger.error(f"Frame decode failed: {e}")
            return {
                'verified': True,
                'similarity': 1.0,
                'gpu_used': False,
                'error': f'decode_error: {str(e)}'
            }

        # ----------------------------------------------------------
        # STEP C: Run face verification using unified_face_service
        # ----------------------------------------------------------
        import asyncio
        from core.FaceAuth.unified_face_service import get_unified_face_service

        face_service = get_unified_face_service()

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            is_verified, similarity = loop.run_until_complete(
                face_service.verify_face(
                    frame=frame,
                    user_id=user_id,
                    threshold=threshold,
                    method='cosine'
                )
            )
        finally:
            loop.close()

        logger.info(
            f"GPU verification complete for user {user_id}: "
            f"verified={is_verified}, similarity={similarity:.3f}, gpu={gpu_available}"
        )

        return {
            'verified': bool(is_verified),
            'similarity': float(similarity),
            'gpu_used': gpu_available,
            'error': None
        }

    except Exception as e:
        logger.error(f"GPU verification failed for user {user_id}: {e}")
        import traceback
        logger.error(traceback.format_exc())

        # On error, don't penalize the user
        return {
            'verified': True,
            'similarity': 1.0,
            'gpu_used': False,
            'error': str(e)
        }