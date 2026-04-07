"""
HTTP client to call Face Auth Service for identity verification.
Replaces direct imports of unified_face_service/face_model_shared.
"""
import os
import logging
import base64
import requests
import numpy as np
import cv2

logger = logging.getLogger(__name__)

FACE_AUTH_SERVICE_URL = os.getenv("FACE_AUTH_SERVICE_URL", "http://localhost:8232")


def verify_face_identity(frame, user_id, threshold=0.6):
    """
    Verify face identity by calling Face Auth Service API.
    
    Args:
        frame: numpy array (BGR) or base64 string
        user_id: user ID to verify against
        threshold: similarity threshold
    
    Returns:
        Tuple[bool, float]: (is_verified, similarity_score)
    """
    try:
        # Convert frame to JPEG bytes for upload
        if isinstance(frame, np.ndarray):
            _, img_encoded = cv2.imencode('.jpg', frame)
            img_bytes = img_encoded.tobytes()
        elif isinstance(frame, str):
            # base64 string
            if 'base64,' in frame:
                frame = frame.split('base64,')[1]
            img_bytes = base64.b64decode(frame)
        elif isinstance(frame, bytes):
            img_bytes = frame
        else:
            logger.warning(f"Unsupported frame type: {type(frame)}")
            return (True, 1.0)

        # Call Face Auth Service
        response = requests.post(
            f"{FACE_AUTH_SERVICE_URL}/api/face/verify",
            files={"image": ("frame.jpg", img_bytes, "image/jpeg")},
            data={"user_id": str(user_id)},
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            is_verified = data.get("allowed", False)
            confidence = data.get("confidence", 0)
            # Convert confidence (0-100) to similarity (0-1)
            similarity = confidence / 100.0
            return (is_verified, similarity)
        else:
            logger.error(f"Face Auth Service returned {response.status_code}: {response.text}")
            return (True, 1.0)  # Don't penalize on service errors

    except requests.exceptions.ConnectionError:
        logger.error("Cannot connect to Face Auth Service")
        return (True, 1.0)
    except requests.exceptions.Timeout:
        logger.error("Face Auth Service timeout")
        return (True, 1.0)
    except Exception as e:
        logger.error(f"Face auth client error: {e}")
        return (True, 1.0)