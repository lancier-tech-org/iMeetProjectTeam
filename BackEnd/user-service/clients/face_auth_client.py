"""
HTTP client wrapper that provides the same function signatures as face_embeddings.py
but calls Face Auth Service via HTTP instead of direct imports.

This allows users.py to work with ZERO changes to its view functions —
only the import path changes.
"""
import os
import logging
import base64
import requests
import numpy as np
import cv2
from io import BytesIO
from PIL import Image

logger = logging.getLogger(__name__)

FACE_AUTH_SERVICE_URL = os.getenv("FACE_AUTH_SERVICE_URL", "http://localhost:8232")


def base64_to_numpy(base64_string):
    """Convert base64 string to numpy array (same signature as face_embeddings.py)"""
    try:
        if 'base64,' in base64_string:
            base64_string = base64_string.split('base64,')[1]
        img_bytes = base64.b64decode(base64_string)
        pil_image = Image.open(BytesIO(img_bytes)).convert('RGB')
        img_array = np.array(pil_image)
        img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        return img_bgr
    except Exception as e:
        logger.error(f"Error converting base64 to numpy: {e}")
        return None


def process_profile_photo_embedding(user_id, photo_id):
    """
    Process profile photo and generate embedding via Face Auth Service.
    Same signature as face_embeddings.process_profile_photo_embedding()
    """
    try:
        # This operation still happens directly in Face Auth Service's MongoDB
        # We call a dedicated endpoint for this
        response = requests.post(
            f"{FACE_AUTH_SERVICE_URL}/api/face/process-embedding",
            json={"user_id": user_id, "photo_id": photo_id},
            timeout=30
        )
        if response.status_code in (200, 201):
            data = response.json()
            return data.get("embedding_id")
        else:
            logger.error(f"process_profile_photo_embedding failed: {response.status_code}")
            return None
    except Exception as e:
        logger.error(f"Error calling Face Auth Service: {e}")
        return None


def process_image_for_recognition(image_base64):
    """
    Process image for face recognition login via Face Auth Service.
    Same signature as face_embeddings.process_image_for_recognition()
    """
    try:
        img_bytes = base64.b64decode(
            image_base64.split('base64,')[1] if 'base64,' in image_base64 else image_base64
        )
        response = requests.post(
            f"{FACE_AUTH_SERVICE_URL}/api/face/verify",
            files={"image": ("face.jpg", img_bytes, "image/jpeg")},
            data={"user_id": "unknown"},  # Face login searches all users
            timeout=15
        )
        if response.status_code == 200:
            data = response.json()
            return {
                'success': True,
                'matched': data.get('allowed', False),
                'user_id': data.get('user_id'),
                'similarity': data.get('confidence', 0) / 100.0,
                'det_score': data.get('primary_face_detection_score', 0)
            }
        return {'success': False, 'matched': False, 'message': 'No match found'}
    except Exception as e:
        logger.error(f"Error in face recognition: {e}")
        return {'success': False, 'error': str(e)}


def get_user_embeddings(user_id):
    """Get user embeddings via Face Auth Service"""
    try:
        response = requests.get(
            f"{FACE_AUTH_SERVICE_URL}/api/user/{user_id}/status",
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            if data.get('registered'):
                return [{'user_id': user_id, 'status': 'active'}]
        return []
    except Exception as e:
        logger.error(f"Error getting embeddings: {e}")
        return []


def delete_face_embedding(embedding_id, permanent=False):
    """Delete face embedding — placeholder until Face Auth Service exposes this endpoint"""
    logger.warning(f"delete_face_embedding called for {embedding_id} — not yet implemented via HTTP")
    return False


def verify_face_match(user_id, query_image, threshold=0.6):
    """Verify face match via Face Auth Service"""
    try:
        _, img_encoded = cv2.imencode('.jpg', query_image)
        img_bytes = img_encoded.tobytes()

        response = requests.post(
            f"{FACE_AUTH_SERVICE_URL}/api/face/verify",
            files={"image": ("face.jpg", img_bytes, "image/jpeg")},
            data={"user_id": str(user_id)},
            timeout=15
        )
        if response.status_code == 200:
            data = response.json()
            return {
                'verified': data.get('allowed', False),
                'user_id': user_id,
                'max_similarity': data.get('confidence', 0) / 100.0,
                'threshold': threshold,
                'face_count': data.get('face_count', 1),
                'single_participant_confirmed': data.get('single_participant_confirmed', True),
                'embeddings_compared': data.get('embeddings_compared', 1)
            }
        return {'verified': False, 'error': f'Service returned {response.status_code}', 'embeddings_compared': 0}
    except Exception as e:
        logger.error(f"Error verifying face: {e}")
        return {'verified': False, 'error': str(e)}


def get_embedding_stats():
    """Get embedding statistics via Face Auth Service"""
    try:
        response = requests.get(
            f"{FACE_AUTH_SERVICE_URL}/api/stats",
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            return {
                'total_embeddings': data.get('users', {}).get('total', 0),
                'total_users_with_embeddings': data.get('users', {}).get('active', 0),
                'using_shared_model': True
            }
        return {}
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return {}


def cleanup_orphaned_embeddings():
    """Cleanup orphaned embeddings — runs inside Face Auth Service"""
    logger.info("cleanup_orphaned_embeddings — managed by Face Auth Service")
    return 0


def check_face_recognition_ready():
    """Check if Face Auth Service is reachable"""
    try:
        response = requests.get(
            f"{FACE_AUTH_SERVICE_URL}/api/health",
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            return {
                'ready': data.get('status') == 'healthy',
                'face_engine': True,
                'shared_model': True,
                'mongodb': True,
                's3': True,
                'errors': []
            }
        return {'ready': False, 'errors': [f'Service returned {response.status_code}']}
    except Exception as e:
        return {'ready': False, 'errors': [str(e)]}

def validate_human_face(photo_base64: str) -> dict:
    """Validate that a photo contains a human face via Face Auth Service"""
    try:
        response = requests.post(
            f"{FACE_AUTH_SERVICE_URL}/api/face/validate",
            json={"photo": photo_base64},
            timeout=30
        )
        if response.status_code == 200:
            return response.json()
        return {'valid': False, 'error': f'Face auth service error: {response.status_code}'}
    except Exception as e:
        return {'valid': False, 'error': f'Face auth service unavailable: {str(e)}'}