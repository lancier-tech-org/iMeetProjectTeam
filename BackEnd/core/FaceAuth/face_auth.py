
# # face_auth.py

# """
# Complete Face Verification Backend - HTTPS with Continuous Automatic Verification
# -----------------------------------------------------------------------------------
# Verifies face on initial join and automatically when camera is re-enabled.
# NO FRONTEND CHANGES REQUIRED - Backend automatically detects camera state changes.

# Features:
# - Initial face verification on meeting join
# - AUTOMATIC continuous verification when camera toggles on (detected by backend)
# - Session-based violation tracking with camera state monitoring
# - Progressive warning system (3 strikes)
# - Auto-kick after 3 violations
# - Automatic camera state detection (no frontend changes needed)

# Endpoints:
#   POST /api/face/verify - Initial verification
#   POST /api/face/continuous-verify - Manual continuous verification
#   POST /api/attendance/detect/ - ENHANCED: Auto-detects camera state & verifies
#   POST /api/face/session/create - Create verification session
#   POST /api/face/session/<id>/end - End verification session
#   GET /api/face/session/<id>/status - Get session status
# """

# import os

# # =============================================================================
# # GPU CONFIGURATION — Service 2 uses GPU for continuous identity verification
# # =============================================================================
# os.environ.update({
#     "CUDA_VISIBLE_DEVICES": "0",
#     "CUDA_MODULE_LOADING": "LAZY",
#     "ORT_CUDA_UNAVAILABLE_FAIL": "0",
#     "ORT_TENSORRT_UNAVAILABLE_FAIL": "0",
#     "OMP_NUM_THREADS": "4",
# })

# import numpy as np
# import json
# from io import BytesIO
# from dotenv import load_dotenv
# from django.conf import settings
# from django.core.asgi import get_asgi_application
# from django.urls import path
# from django.http import JsonResponse
# from rest_framework.views import APIView
# from rest_framework.parsers import MultiPartParser, FormParser
# from rest_framework.decorators import api_view
# from channels.routing import ProtocolTypeRouter
# from pymongo import MongoClient
# from bson import ObjectId
# from PIL import Image
# from insightface.app import FaceAnalysis
# import logging
# from datetime import datetime, timedelta
# import base64

# # Configure logging
# logging.basicConfig(
#     level=logging.INFO,
#     format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
# )
# logger = logging.getLogger(__name__)

# # ---------------------------------------------------------------------
# # Load Environment Variables
# # ---------------------------------------------------------------------
# BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# load_dotenv(os.path.join(BASE_DIR, ".env"))

# # ---------------------------------------------------------------------
# # Django Configuration
# # ---------------------------------------------------------------------
# DJANGO_SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "django-insecure-v_&dc%&is!h)z)v*1q(s_8nf)l24p4q_a7$n=f7$9u0xik6j@q")
# DJANGO_DEBUG = os.getenv("DJANGO_DEBUG", "True").lower() in ['true', '1', 't']
# DJANGO_ALLOWED_HOSTS = [host.strip() for host in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,www.lancieretech.com,*").split(",")]

# if not settings.configured:
#     settings.configure(
#         DEBUG=DJANGO_DEBUG,
#         SECRET_KEY=DJANGO_SECRET_KEY,
#         ROOT_URLCONF=__name__,
#         ALLOWED_HOSTS=DJANGO_ALLOWED_HOSTS,
#         INSTALLED_APPS=[
#             "django.contrib.contenttypes",
#             "django.contrib.staticfiles",
#             "rest_framework",
#             "channels",
#             "corsheaders",
#         ],
#         MIDDLEWARE=[
#             "corsheaders.middleware.CorsMiddleware",
#             "django.middleware.security.SecurityMiddleware",
#             "django.middleware.common.CommonMiddleware",
#         ],
#         CORS_ALLOW_ALL_ORIGINS=True,
#         CORS_ALLOW_CREDENTIALS=True,
#         CORS_ALLOWED_ORIGINS=[
#             "https://localhost",
#             "https://127.0.0.1",
#             "https://www.lancieretech.com",
#         ],
#         SECURE_SSL_REDIRECT=False,
#         SESSION_COOKIE_SECURE=True,
#         CSRF_COOKIE_SECURE=True,
#         SECURE_BROWSER_XSS_FILTER=True,
#         SECURE_CONTENT_TYPE_NOSNIFF=True,
#         ASGI_APPLICATION=__name__ + ".application",
#         REST_FRAMEWORK={
#             'DEFAULT_RENDERER_CLASSES': [
#                 'rest_framework.renderers.JSONRenderer',
#             ],
#             'DEFAULT_PARSER_CLASSES': [
#                 'rest_framework.parsers.JSONParser',
#                 'rest_framework.parsers.MultiPartParser',
#                 'rest_framework.parsers.FormParser',
#             ],
#             'EXCEPTION_HANDLER': 'rest_framework.views.exception_handler',
#         },
#         USE_TZ=True,
#         TIME_ZONE=os.getenv("CELERY_TIMEZONE", "Asia/Kolkata"),
#         LANGUAGE_CODE='en-us',
#     )

#     import django
#     django.setup()

# # ---------------------------------------------------------------------
# # MongoDB Configuration
# # ---------------------------------------------------------------------
# MONGO_USER = os.getenv("MONGO_USER", "connectly")
# MONGO_PASSWORD = os.getenv("MONGO_PASSWORD", "")
# MONGO_HOST = os.getenv("MONGO_HOST", "mongodb.databases.svc.cluster.local")
# MONGO_PORT = os.getenv("MONGO_PORT", "27017")
# MONGO_DB = os.getenv("MONGO_DB", "connectlydb")
# MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongodb.databases.svc.cluster.local:27017/imeetpro")

# logger.info(f"ðŸ”— Connecting to MongoDB: {MONGO_HOST}:{MONGO_PORT}/{MONGO_DB}")

# try:
#     client = MongoClient(
#         MONGO_URI,
#         maxPoolSize=50,
#         minPoolSize=10,
#         serverSelectionTimeoutMS=5000,
#         connectTimeoutMS=10000,
#         socketTimeoutMS=20000,
#     )
#     client.server_info()
#     db = client[MONGO_DB]
#     logger.info(f"âœ… MongoDB connected successfully to '{MONGO_DB}' database")
# except Exception as e:
#     logger.error(f"âŒ MongoDB connection failed: {e}")
#     raise

# # MongoDB Collections
# FACE_EMBEDDINGS_COLLECTION = os.getenv("FACE_EMBEDDINGS_COLLECTION", "face_embeddings")
# VERIFICATION_LOGS_COLLECTION = os.getenv("VERIFICATION_LOGS_COLLECTION", "face_verification_logs")
# VERIFICATION_SESSIONS_COLLECTION = os.getenv("VERIFICATION_SESSIONS_COLLECTION", "face_verification_sessions")

# # Face Recognition Configuration
# FACE_DISTANCE_THRESHOLD = float(os.getenv("FACE_DISTANCE_THRESHOLD", "0.6"))
# FACE_MODEL_NAME = os.getenv("FACE_MODEL_NAME", "buffalo_l")
# FACE_DETECTION_SIZE = tuple(map(int, os.getenv("FACE_DETECTION_SIZE", "640,640").split(",")))

# # Camera State Detection Configuration
# CAMERA_FRAME_GAP_THRESHOLD = float(os.getenv("CAMERA_FRAME_GAP_THRESHOLD", "3.0"))  # seconds

# # Server Configuration
# SERVER_HOST = os.getenv("HOST", "0.0.0.0")
# SERVER_PORT = os.getenv("PORT", "8220")
# SERVER_PROTOCOL = "https"

# logger.info(f"ðŸ”’ Protocol: HTTPS")
# logger.info(f"ðŸ“Œ Port: {SERVER_PORT}")
# logger.info(f"âš™ï¸ Face Distance Threshold: {FACE_DISTANCE_THRESHOLD}")
# logger.info(f"âš™ï¸ Camera Gap Threshold: {CAMERA_FRAME_GAP_THRESHOLD}s")
# logger.info(f"âš™ï¸ Face Model: {FACE_MODEL_NAME}")
# logger.info(f"âš™ï¸ Detection Size: {FACE_DETECTION_SIZE}")

# # ============================================================================
# # NEW: SINGLE PARTICIPANT ENFORCEMENT CONFIGURATION
# # ============================================================================
# ALLOW_MULTIPLE_FACES = os.getenv("ALLOW_MULTIPLE_FACES", "False").lower() in ['false', '0', 'f']
# MAX_ALLOWED_FACES = int(os.getenv("MAX_ALLOWED_FACES", "1"))
# MULTI_FACE_ERROR_MESSAGE = os.getenv(
#     "MULTI_FACE_ERROR_MESSAGE",
#     "Multiple people detected! Only the registered participant is allowed to join the meeting. Please ensure you are alone in front of the camera."
# )

# logger.info(f"ðŸ›¡ï¸ SINGLE PARTICIPANT ENFORCEMENT: {'ENABLED' if not ALLOW_MULTIPLE_FACES else 'DISABLED'}")
# logger.info(f"âš™ï¸ Max Allowed Faces: {MAX_ALLOWED_FACES}")

# # ============================================================================
# # IDENTITY TRACKING CONFIGURATION (moved from Attendance.py)
# # ============================================================================
# IDENTITY_CHECK_INTERVAL = float(os.getenv("IDENTITY_CHECK_INTERVAL", "1.0"))    # Check every 1 second
# IDENTITY_UNKNOWN_THRESHOLD = int(os.getenv("IDENTITY_UNKNOWN_THRESHOLD", "5"))   # 5 consecutive sec = 1 warning
# IDENTITY_MAX_WARNINGS = int(os.getenv("IDENTITY_MAX_WARNINGS", "3"))             # 3 warnings = removal
# IDENTITY_REMOVAL_PENALTY = float(os.getenv("IDENTITY_REMOVAL_PENALTY", "1.0"))   # -1% per removal

# logger.info(f"Identity Check Interval: {IDENTITY_CHECK_INTERVAL}s")
# logger.info(f"Identity Unknown Threshold: {IDENTITY_UNKNOWN_THRESHOLD}s")
# logger.info(f"Identity Max Warnings: {IDENTITY_MAX_WARNINGS}")
# logger.info(f"Identity Removal Penalty: {IDENTITY_REMOVAL_PENALTY}%")

# # ============================================================================
# # IN-MEMORY IDENTITY TRACKING STATE (per user per meeting)
# # ============================================================================
# # Key: "meeting_id:user_id" -> tracking dict
# identity_tracking = {}

# import time as time_module

# def get_identity_state(meeting_id, user_id):
#     """Get or create identity tracking state for a user in a meeting"""
#     key = f"{meeting_id}:{user_id}"
#     if key not in identity_tracking:
#         identity_tracking[key] = {
#             "consecutive_unknown_seconds": 0,
#             "total_unknown_seconds": 0,
#             "current_cycle_warnings": 0,       # 0-3, resets after removal
#             "total_warnings_issued": 0,         # cumulative: 1,2,3,4,5,6...
#             "removal_count": 0,
#             "is_removed": False,
#             "can_rejoin": True,
#             "last_check_time": 0.0,
#             "attendance_penalty": 0.0,
#             "warnings": [],                     # warning history
#         }
#     return identity_tracking[key]

# def reset_identity_state(meeting_id, user_id):
#     """Reset identity state when user rejoins after removal"""
#     state = get_identity_state(meeting_id, user_id)
#     state["consecutive_unknown_seconds"] = 0
#     state["current_cycle_warnings"] = 0
#     state["is_removed"] = False
#     state["can_rejoin"] = True
#     return state

# def check_identity_with_tracking(meeting_id, user_id, is_verified, similarity):
#     """
#     Full identity tracking logic (moved from Attendance.py check_identity_verification).
    
#     Handles:
#     - 5-second consecutive unknown counter
#     - Warning system (1/3, 2/3, 3/3)
#     - -1% penalty on removal
#     - Cycle reset after removal
    
#     Returns:
#         dict: Complete identity result with popup, warnings, removal status
#     """
#     current_time = time_module.time()
#     state = get_identity_state(meeting_id, user_id)
    
#     # Check interval (1 second between checks)
#     time_since_last = current_time - state["last_check_time"]
#     if time_since_last < IDENTITY_CHECK_INTERVAL:
#         return None  # Too soon, skip
    
#     state["last_check_time"] = current_time
    
#     # ================================================================
#     # CASE A: VERIFIED (face matches)
#     # ================================================================
#     if is_verified:
#         if state["consecutive_unknown_seconds"] > 0:
#             logger.info(f"Identity VERIFIED for {user_id} - resetting consecutive counter from {state['consecutive_unknown_seconds']}s to 0")
#         state["consecutive_unknown_seconds"] = 0
        
#         return {
#             "identity_verified": True,
#             "identity_similarity": round(similarity, 4),
#             "identity_warning_count": state["current_cycle_warnings"],
#             "identity_consecutive_unknown": 0,
#             "identity_popup": None,
#             "identity_action": None,
#             "identity_is_removed": False,
#             "identity_removal_count": state["removal_count"],
#             "identity_attendance_penalty": state["attendance_penalty"],
#             "identity_total_warnings": state["total_warnings_issued"],
#         }
    
#     # ================================================================
#     # CASE B: NOT VERIFIED (unknown person)
#     # ================================================================
#     state["consecutive_unknown_seconds"] += 1
#     state["total_unknown_seconds"] += 1
#     consecutive = state["consecutive_unknown_seconds"]
    
#     logger.warning(
#         f"UNKNOWN person detected | User: {user_id} | "
#         f"Consecutive: {consecutive}/{IDENTITY_UNKNOWN_THRESHOLD}s | "
#         f"Cycle warnings: {state['current_cycle_warnings']}/{IDENTITY_MAX_WARNINGS}"
#     )
    
#     # ================================================================
#     # Check if threshold reached (5 seconds unknown = 1 warning)
#     # ================================================================
#     if consecutive >= IDENTITY_UNKNOWN_THRESHOLD:
#         # Reset consecutive counter
#         state["consecutive_unknown_seconds"] = 0
        
#         # Increment warnings
#         state["current_cycle_warnings"] += 1
#         state["total_warnings_issued"] += 1
#         cycle_warning = state["current_cycle_warnings"]
#         total_warning = state["total_warnings_issued"]
        
#         # Add to warning history
#         state["warnings"].append({
#             "warning_number": cycle_warning,
#             "total_number": total_warning,
#             "timestamp": current_time,
#             "similarity": similarity,
#         })
        
#         # Determine popup and action
#         popup_message = None
#         action = None
        
#         if cycle_warning == 1:
#             popup_message = (
#                 f"Warning 1/{IDENTITY_MAX_WARNINGS}: Unknown person detected for "
#                 f"{IDENTITY_UNKNOWN_THRESHOLD} seconds. Please ensure the registered "
#                 f"participant is visible."
#             )
#             action = "identity_warning_1"
#             logger.warning(f"IDENTITY WARNING 1/{IDENTITY_MAX_WARNINGS} for {user_id} (Total: #{total_warning})")
            
#         elif cycle_warning == 2:
#             popup_message = (
#                 f"Warning 2/{IDENTITY_MAX_WARNINGS}: Identity verification failed again. "
#                 f"ONE MORE failure will remove you from the meeting!"
#             )
#             action = "identity_warning_2"
#             logger.error(f"IDENTITY WARNING 2/{IDENTITY_MAX_WARNINGS} for {user_id} (Total: #{total_warning}) - CRITICAL")
            
#         elif cycle_warning >= IDENTITY_MAX_WARNINGS:
#             # REMOVAL
#             state["removal_count"] += 1
#             state["is_removed"] = True
#             state["can_rejoin"] = True
#             state["current_cycle_warnings"] = 0  # Reset for next cycle
#             state["attendance_penalty"] += IDENTITY_REMOVAL_PENALTY
            
#             popup_message = (
#                 f"You have been removed from the meeting due to identity "
#                 f"verification failure ({IDENTITY_MAX_WARNINGS} warnings). "
#                 f"You can rejoin after correcting the issue. "
#                 f"Penalty: -{IDENTITY_REMOVAL_PENALTY}%"
#             )
#             action = "identity_removal"
            
#             logger.critical(
#                 f"USER REMOVED - Identity Verification Failed | "
#                 f"User: {user_id} | Removal #{state['removal_count']} | "
#                 f"Penalty: {state['attendance_penalty']}%"
#             )
        
#         return {
#             "identity_verified": False,
#             "identity_similarity": round(similarity, 4),
#             "identity_warning_count": cycle_warning,
#             "identity_consecutive_unknown": 0,
#             "identity_popup": popup_message,
#             "identity_action": action,
#             "identity_is_removed": state["is_removed"],
#             "identity_removal_count": state["removal_count"],
#             "identity_attendance_penalty": state["attendance_penalty"],
#             "identity_total_warnings": total_warning,
#             "identity_can_rejoin": state["can_rejoin"],
#         }
    
#     else:
#         # Threshold not reached yet - still accumulating
#         remaining = IDENTITY_UNKNOWN_THRESHOLD - consecutive
        
#         return {
#             "identity_verified": False,
#             "identity_similarity": round(similarity, 4),
#             "identity_warning_count": state["current_cycle_warnings"],
#             "identity_consecutive_unknown": consecutive,
#             "identity_popup": None,  # No popup until threshold
#             "identity_action": None,
#             "identity_is_removed": state["is_removed"],
#             "identity_removal_count": state["removal_count"],
#             "identity_attendance_penalty": state["attendance_penalty"],
#             "identity_total_warnings": state["total_warnings_issued"],
#         }



# # ---------------------------------------------------------------------
# # Face Model - Singleton Pattern
# # ---------------------------------------------------------------------
# # ---------------------------------------------------------------------
# # Face Model - Singleton Pattern
# # ---------------------------------------------------------------------
# class FaceModel:
#     """Singleton class for InsightFace model management"""
#     _instance = None
#     _initialized = False

#     def __new__(cls):
#         if cls._instance is None:
#             cls._instance = super(FaceModel, cls).__new__(cls)
#         return cls._instance

#     def __init__(self):
#         if not self._initialized:
#             logger.info(f"ðŸ”¹ Initializing InsightFace model: {FACE_MODEL_NAME}...")
#             try:
#                 # Get INSIGHTFACE_HOME from environment
#                 insightface_root = os.environ.get('INSIGHTFACE_HOME', '/tmp/.insightface')
#                 logger.info(f"ðŸ”¹ Using InsightFace root directory: {insightface_root}")
                
#                 self.app = FaceAnalysis(
#                     name=FACE_MODEL_NAME,
#                     root=insightface_root,  # â† ADD THIS
#                     providers=['CUDAExecutionProvider', 'CPUExecutionProvider']  # GPU first, CPU fallback
#                 )
#                 self.app.prepare(ctx_id=0, det_size=FACE_DETECTION_SIZE)  # ctx_id=0 for GPU
#                 self._initialized = True
#                 logger.info("âœ… InsightFace model loaded successfully")
#             except Exception as e:
#                 logger.error(f"âŒ Failed to initialize InsightFace model: {e}")
#                 raise

#     def extract_embedding(self, image_data, return_all_faces=False):
#         """
#         Extract face embedding from image data
        
#         NEW: Enhanced with multi-face detection for single participant enforcement
        
#         Args:
#             image_data: Image data (bytes, file, numpy array, base64)
#             return_all_faces: If True, return ALL faces detected (for multi-face check)
        
#         Returns:
#             If return_all_faces=False (default):
#                 - list: Single embedding (largest face only)
            
#             If return_all_faces=True:
#                 - dict: {
#                     'face_count': int,
#                     'faces': [list of face dicts],
#                     'primary_embedding': list,
#                     'primary_face': dict
#                 }
#         """
#         try:
#             if hasattr(image_data, 'read'):
#                 image_data = image_data.read()
            
#             if isinstance(image_data, bytes):
#                 img = Image.open(BytesIO(image_data)).convert("RGB")
#                 np_img = np.array(img)
#             elif isinstance(image_data, np.ndarray):
#                 np_img = image_data
#             elif isinstance(image_data, str):
#                 # Handle base64 encoded images
#                 if image_data.startswith('data:image'):
#                     image_data = image_data.split(',')[1]
#                 img_bytes = base64.b64decode(image_data)
#                 img = Image.open(BytesIO(img_bytes)).convert("RGB")
#                 np_img = np.array(img)
#             else:
#                 raise ValueError("Invalid image data type")
            
#             # Detect all faces in image
#             faces = self.app.get(np_img)
            
#             if not faces:
#                 raise ValueError("No face detected in the image. Please ensure your face is clearly visible and well-lit.")
            
#             face_count = len(faces)
            
#             # ================================================================
#             # NEW: Return ALL faces information if requested
#             # ================================================================
#             if return_all_faces:
#                 face_list = []
                
#                 for idx, face in enumerate(faces):
#                     bbox = face.bbox.tolist()
#                     bbox_area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
                    
#                     face_info = {
#                         'index': idx,
#                         'embedding': face.embedding.tolist(),
#                         'bbox': bbox,
#                         'bbox_area': bbox_area,
#                         'det_score': float(face.det_score),
#                         'age': int(face.age) if hasattr(face, 'age') else None,
#                         'gender': 'male' if hasattr(face, 'gender') and face.gender == 1 else 'female' if hasattr(face, 'gender') and face.gender == 0 else None
#                     }
#                     face_list.append(face_info)
                
#                 # Sort by bbox area (largest first)
#                 face_list.sort(key=lambda x: x['bbox_area'], reverse=True)
                
#                 logger.info(f"âœ… Detected {face_count} face(s) in image")
                
#                 return {
#                     'face_count': face_count,
#                     'faces': face_list,
#                     'primary_embedding': face_list[0]['embedding'],
#                     'primary_face': face_list[0]
#                 }
            
#             # ================================================================
#             # ORIGINAL: Return largest face embedding only
#             # ================================================================
#             if face_count > 1:
#                 logger.warning(f"âš ï¸ Multiple faces detected ({face_count}). Using the largest face.")
            
#             # Use largest face (by bounding box area)
#             largest_face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
#             embedding = largest_face.embedding.tolist()
            
#             logger.debug(f"âœ… Embedding extracted (dimension: {len(embedding)})")
            
#             return embedding
            
#         except ValueError as ve:
#             raise ve
#         except Exception as e:
#             logger.error(f"âŒ Error extracting embedding: {e}")
#             raise ValueError(f"Failed to process image: {str(e)}")


# face_model = FaceModel()     
# # ---------------------------------------------------------------------
# # Utility Functions
# # ---------------------------------------------------------------------
# def cosine_distance(vec1, vec2):
#     """Calculate cosine distance between two vectors"""
#     try:
#         v1 = np.array(vec1, dtype=np.float32)
#         v2 = np.array(vec2, dtype=np.float32)
        
#         if len(v1) != len(v2):
#             raise ValueError(f"Embedding dimension mismatch: {len(v1)} vs {len(v2)}")
        
#         norm1 = np.linalg.norm(v1)
#         norm2 = np.linalg.norm(v2)
        
#         if norm1 == 0 or norm2 == 0:
#             raise ValueError("Zero vector detected in embedding")
        
#         cosine_sim = np.dot(v1, v2) / (norm1 * norm2)
#         distance = 1 - cosine_sim
        
#         return float(distance)
        
#     except Exception as e:
#         logger.error(f"âŒ Error calculating cosine distance: {e}")
#         raise

# # ---------------------------------------------------------------------
# # Database Helper Functions
# # ---------------------------------------------------------------------
# def get_user_embedding(user_id):
#     """Fetch stored face embedding from MongoDB"""
#     try:
#         record = db[FACE_EMBEDDINGS_COLLECTION].find_one({"user_id": str(user_id)})
        
#         if not record:
#             try:
#                 record = db[FACE_EMBEDDINGS_COLLECTION].find_one({"user_id": int(user_id)})
#             except (ValueError, TypeError):
#                 pass
        
#         if not record:
#             logger.warning(f"âš ï¸ No embedding found for user_id: {user_id}")
#             return None
        
#         if "embedding" not in record or not record["embedding"]:
#             logger.error(f"âŒ Record found but no valid 'embedding' field for user_id: {user_id}")
#             return None
        
#         if not isinstance(record["embedding"], list) or len(record["embedding"]) == 0:
#             logger.error(f"âŒ Invalid embedding format for user_id: {user_id}")
#             return None
        
#         logger.debug(f"âœ… Retrieved embedding for user_id: {user_id} (dimension: {len(record['embedding'])})")
#         return record
        
#     except Exception as e:
#         logger.error(f"âŒ Error fetching embedding for user_id {user_id}: {e}")
#         return None

# def log_verification_attempt(user_id, distance, allowed, confidence, error=None, metadata=None):
#     """Log verification attempt to MongoDB"""
#     try:
#         log_entry = {
#             "user_id": str(user_id),
#             "distance": float(distance) if distance is not None else None,
#             "threshold": FACE_DISTANCE_THRESHOLD,
#             "allowed": allowed,
#             "confidence": float(confidence) if confidence is not None else None,
#             "error": error,
#             "metadata": metadata or {},
#             "timestamp": datetime.utcnow(),
#             "server_info": {
#                 "host": MONGO_HOST,
#                 "model": FACE_MODEL_NAME,
#                 "protocol": SERVER_PROTOCOL,
#                 "port": SERVER_PORT,
#             }
#         }
#         db[VERIFICATION_LOGS_COLLECTION].insert_one(log_entry)
#         logger.debug(f"ðŸ“ Logged verification attempt for user_id: {user_id}")
#     except Exception as e:
#         logger.error(f"âŒ Failed to log verification attempt: {e}")

# # ---------------------------------------------------------------------
# # Camera State Detection Functions (NEW)
# # ---------------------------------------------------------------------
# def detect_camera_state_change(session_doc, current_frame_data):
#     """
#     Automatically detect when camera is disabled/enabled based on frame data.
    
#     Logic:
#     - If frames stop coming for >3 seconds â†’ Camera disabled
#     - If frames resume after gap â†’ Camera re-enabled â†’ Trigger verification
    
#     Args:
#         session_doc: Current session document
#         current_frame_data: Current frame (None if camera disabled)
    
#     Returns:
#         dict: {
#             "state_changed": bool,
#             "new_state": "enabled" | "disabled",
#             "should_reverify": bool
#         }
#     """
#     now = datetime.utcnow()
    
#     # Get last frame timestamp
#     last_frame_time = session_doc.get("last_frame_timestamp")
#     previous_state = session_doc.get("camera_state", "unknown")
    
#     # Determine current state based on frame data
#     if current_frame_data is None or not current_frame_data:
#         current_state = "disabled"
#     else:
#         current_state = "enabled"
    
#     # Check for frame gap (camera was disabled)
#     if last_frame_time:
#         time_since_last_frame = (now - last_frame_time).total_seconds()
#         frame_gap_detected = time_since_last_frame > CAMERA_FRAME_GAP_THRESHOLD
#     else:
#         frame_gap_detected = False
    
#     # Detect state change
#     state_changed = previous_state != current_state
    
#     # Determine if re-verification needed
#     should_reverify = False
    
#     if state_changed:
#         # Camera state changed
#         if previous_state == "disabled" and current_state == "enabled":
#             # Camera was OFF, now ON â†’ TRIGGER RE-VERIFICATION
#             logger.info(f"ðŸŽ¥ Camera re-enabled detected for session {session_doc['_id']}")
#             should_reverify = True
#         elif previous_state == "enabled" and current_state == "disabled":
#             # Camera was ON, now OFF
#             logger.info(f"ðŸ“´ Camera disabled detected for session {session_doc['_id']}")
    
#     elif frame_gap_detected and current_state == "enabled":
#         # No explicit state change but gap detected and now enabled
#         # This means camera was temporarily off
#         logger.info(f"ðŸ”„ Frame gap detected - camera likely toggled for session {session_doc['_id']}")
#         should_reverify = True
    
#     return {
#         "state_changed": state_changed,
#         "new_state": current_state,
#         "previous_state": previous_state,
#         "should_reverify": should_reverify,
#         "frame_gap_detected": frame_gap_detected,
#         "time_since_last_frame": (now - last_frame_time).total_seconds() if last_frame_time else None
#     }


# def update_camera_state_in_session(session_id, state_info, frame_data):
#     """
#     Update camera state tracking in session document.
    
#     Args:
#         session_id: Session ID
#         state_info: State change info from detect_camera_state_change()
#         frame_data: Current frame data
#     """
#     now = datetime.utcnow()
    
#     update_data = {
#         "camera_state": state_info["new_state"],
#         "last_frame_timestamp": now if frame_data else None,
#         "frame_gap_detected": state_info["frame_gap_detected"],
#         "pending_reverification": state_info["should_reverify"]
#     }
    
#     if state_info["new_state"] == "enabled":
#         update_data["last_camera_enabled_time"] = now
#     elif state_info["new_state"] == "disabled":
#         update_data["last_camera_disabled_time"] = now
    
#     # Add to state history
#     db[VERIFICATION_SESSIONS_COLLECTION].update_one(
#         {"_id": ObjectId(session_id)},
#         {
#             "$set": update_data,
#             "$push": {
#                 "camera_state_history": {
#                     "$each": [{
#                         "state": state_info["new_state"],
#                         "timestamp": now,
#                         "frame_received": frame_data is not None,
#                         "time_since_last_frame": state_info.get("time_since_last_frame")
#                     }],
#                     "$slice": -50  # Keep last 50 state changes
#                 }
#             }
#         }
#     )
    
#     logger.debug(f"Updated camera state to '{state_info['new_state']}' for session {session_id}")


# # ---------------------------------------------------------------------
# # Verification Session Management
# # ---------------------------------------------------------------------
# def create_verification_session(user_id, room_name, initial_verification=True):
#     """Create a new verification session with camera state tracking"""
#     try:
#         session_doc = {
#             "user_id": str(user_id),
#             "room_name": room_name,
#             "session_start": datetime.utcnow(),
#             "last_verification": datetime.utcnow(),
#             "verification_count": 1 if initial_verification else 0,
#             "violations": [],
#             "status": "active",
#             "created_at": datetime.utcnow(),
            
#             # Camera state tracking fields
#             "camera_state": "enabled",
#             "last_camera_enabled_time": datetime.utcnow(),
#             "last_camera_disabled_time": None,
#             "camera_state_history": [{
#                 "state": "enabled",
#                 "timestamp": datetime.utcnow(),
#                 "frame_received": True,
#                 "time_since_last_frame": 0
#             }],
#             "pending_reverification": False,
#             "last_frame_timestamp": datetime.utcnow(),
#             "frame_gap_detected": False
#         }
        
#         result = db[VERIFICATION_SESSIONS_COLLECTION].insert_one(session_doc)
#         session_id = str(result.inserted_id)
        
#         logger.info(f"ðŸ“ Created verification session {session_id} for user {user_id} in room {room_name}")
#         return session_id
        
#     except Exception as e:
#         logger.error(f"âŒ Failed to create verification session: {e}")
#         return None

# def update_verification_session(session_id, verification_result, violation=None):
#     """Update verification session with new verification attempt"""
#     try:
#         update_data = {
#             "last_verification": datetime.utcnow(),
#         }
        
#         # Increment verification count
#         db[VERIFICATION_SESSIONS_COLLECTION].update_one(
#             {"_id": ObjectId(session_id)},
#             {"$inc": {"verification_count": 1}}
#         )
        
#         if violation:
#             violation_entry = {
#                 "timestamp": datetime.utcnow(),
#                 "reason": violation.get("reason"),
#                 "distance": violation.get("distance"),
#                 "confidence": violation.get("confidence"),
#                 "action_taken": violation.get("action", "warning"),
#                 "type": violation.get("type", "verification_failed")
#             }
            
#             # Add violation to array
#             db[VERIFICATION_SESSIONS_COLLECTION].update_one(
#                 {"_id": ObjectId(session_id)},
#                 {"$push": {"violations": violation_entry}}
#             )
            
#             # Check violation count
#             session = db[VERIFICATION_SESSIONS_COLLECTION].find_one({"_id": ObjectId(session_id)})
#             if len(session.get("violations", [])) >= 3:
#                 update_data["status"] = "suspended"
        
#         db[VERIFICATION_SESSIONS_COLLECTION].update_one(
#             {"_id": ObjectId(session_id)},
#             {"$set": update_data}
#         )
        
#         logger.info(f"âœ… Updated verification session {session_id}")
        
#     except Exception as e:
#         logger.error(f"âŒ Error updating verification session: {e}")

# def end_verification_session(session_id):
#     """End verification session"""
#     try:
#         db[VERIFICATION_SESSIONS_COLLECTION].update_one(
#             {"_id": ObjectId(session_id)},
#             {
#                 "$set": {
#                     "session_end": datetime.utcnow(),
#                     "status": "completed"
#                 }
#             }
#         )
#         logger.info(f"âœ… Ended verification session {session_id}")
#         return True
        
#     except Exception as e:
#         logger.error(f"âŒ Error ending verification session: {e}")
#         return False

# def get_session_status(session_id):
#     """Get session status"""
#     try:
#         session = db[VERIFICATION_SESSIONS_COLLECTION].find_one({"_id": ObjectId(session_id)})
        
#         if not session:
#             return None
        
#         return {
#             "session_id": str(session["_id"]),
#             "user_id": session["user_id"],
#             "room_name": session["room_name"],
#             "status": session["status"],
#             "verification_count": session.get("verification_count", 0),
#             "violations": len(session.get("violations", [])),
#             "camera_state": session.get("camera_state", "unknown"),
#             "last_verification": session.get("last_verification"),
#             "session_start": session.get("session_start"),
#             "pending_reverification": session.get("pending_reverification", False)
#         }
        
#     except Exception as e:
#         logger.error(f"âŒ Error getting session status: {e}")
#         return None

# # ---------------------------------------------------------------------
# # API Views
# # ---------------------------------------------------------------------
# # ---------------------------------------------------------------------
# # API Views
# # ---------------------------------------------------------------------
# class VerifyFace(APIView):
#     """Initial face verification endpoint with SINGLE PARTICIPANT ENFORCEMENT"""
#     parser_classes = [MultiPartParser, FormParser]

#     def post(self, request):
#         user_id = None
#         start_time = datetime.utcnow()
        
#         try:
#             user_id = request.data.get("user_id")
#             image_file = request.FILES.get("image")
            
#             logger.info(f"{'='*80}")
#             logger.info(f"ðŸ” WAITING ROOM VERIFICATION - User ID: {user_id} | Port: {SERVER_PORT}")
#             logger.info(f"{'='*80}")
            
#             if not user_id:
#                 return JsonResponse({
#                     "allowed": False,
#                     "error": "user_id is required",
#                     "error_code": "MISSING_USER_ID",
#                     "protocol": SERVER_PROTOCOL,
#                     "port": int(SERVER_PORT)
#                 }, status=400)
            
#             if not image_file:
#                 return JsonResponse({
#                     "allowed": False,
#                     "error": "image file is required",
#                     "error_code": "MISSING_IMAGE",
#                     "protocol": SERVER_PROTOCOL,
#                     "port": int(SERVER_PORT)
#                 }, status=400)
            
#             # Validate image type
#             allowed_types = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
#             if image_file.content_type not in allowed_types:
#                 error_msg = f"Invalid image type '{image_file.content_type}'. Allowed: JPEG, PNG, WEBP"
#                 return JsonResponse({
#                     "allowed": False,
#                     "error": error_msg,
#                     "error_code": "INVALID_IMAGE_TYPE",
#                     "protocol": SERVER_PROTOCOL,
#                     "port": int(SERVER_PORT)
#                 }, status=400)
            
#             # Validate image size
#             max_size = 10 * 1024 * 1024
#             if image_file.size > max_size:
#                 error_msg = f"Image size ({image_file.size / 1024 / 1024:.2f}MB) exceeds 10MB limit"
#                 return JsonResponse({
#                     "allowed": False,
#                     "error": error_msg,
#                     "error_code": "IMAGE_TOO_LARGE",
#                     "protocol": SERVER_PROTOCOL,
#                     "port": int(SERVER_PORT)
#                 }, status=400)
            
#             # Get stored embedding
#             user_record = get_user_embedding(user_id)
            
#             if user_record is None:
#                 error_msg = f"User '{user_id}' not found. Please register first."
#                 return JsonResponse({
#                     "allowed": False,
#                     "error": error_msg,
#                     "error_code": "USER_NOT_FOUND",
#                     "protocol": SERVER_PROTOCOL,
#                     "port": int(SERVER_PORT)
#                 }, status=404)
            
#             stored_embedding = user_record["embedding"]
            
#             if not user_record.get("is_active", True):
#                 error_msg = f"User '{user_id}' is deactivated"
#                 return JsonResponse({
#                     "allowed": False,
#                     "error": error_msg,
#                     "error_code": "USER_DEACTIVATED",
#                     "protocol": SERVER_PROTOCOL,
#                     "port": int(SERVER_PORT)
#                 }, status=403)
            
#             # ================================================================
#             # NEW: MULTI-FACE DETECTION - SINGLE PARTICIPANT ENFORCEMENT
#             # ================================================================
#             try:
#                 logger.info("ðŸ” Detecting faces in frame...")
                
#                 # Extract ALL faces from image
#                 face_detection_result = face_model.extract_embedding(
#                     image_file, 
#                     return_all_faces=True
#                 )
                
#                 face_count = face_detection_result['face_count']
#                 primary_face = face_detection_result['primary_face']
#                 live_embedding = face_detection_result['primary_embedding']
                
#                 logger.info(f"ðŸ“Š Face Detection Results:")
#                 logger.info(f"   Detected Faces: {face_count}")
#                 logger.info(f"   Primary Face Score: {primary_face['det_score']:.3f}")
                
#                 # ============================================================
#                 # NEW: CHECK FOR MULTIPLE PEOPLE - ENFORCE SINGLE PARTICIPANT
#                 # ============================================================
#                 if not ALLOW_MULTIPLE_FACES and face_count > MAX_ALLOWED_FACES:
#                     logger.error(
#                         f"\n{'='*80}\n"
#                         f"ðŸš« MULTIPLE PEOPLE DETECTED - ACCESS DENIED\n"
#                         f"{'='*80}\n"
#                         f"User ID: {user_id}\n"
#                         f"Detected Faces: {face_count}\n"
#                         f"Maximum Allowed: {MAX_ALLOWED_FACES}\n"
#                         f"Status: VERIFICATION REJECTED\n"
#                         f"Reason: Single participant policy violation\n"
#                         f"{'='*80}\n"
#                     )
                    
#                     # Log the multi-face rejection
#                     log_verification_attempt(
#                         user_id,
#                         None,
#                         False,
#                         None,
#                         error=f"Multiple people detected: {face_count} faces",
#                         metadata={
#                             "verification_type": "waiting_room",
#                             "rejection_reason": "multiple_faces",
#                             "face_count": face_count,
#                             "max_allowed": MAX_ALLOWED_FACES,
#                             "detected_faces": [
#                                 {
#                                     'index': f['index'],
#                                     'det_score': f['det_score'],
#                                     'bbox_area': f['bbox_area']
#                                 }
#                                 for f in face_detection_result['faces']
#                             ],
#                             "image_size": image_file.size,
#                             "image_type": image_file.content_type
#                         }
#                     )
                    
#                     # ========================================================
#                     # RETURN: Multi-Face Rejection Response with Popup Data
#                     # ========================================================
#                     return JsonResponse({
#                         "allowed": False,
#                         "error": MULTI_FACE_ERROR_MESSAGE,
#                         "error_code": "MULTIPLE_FACES_DETECTED",
#                         "face_count": face_count,
#                         "max_allowed_faces": MAX_ALLOWED_FACES,
                        
#                         # Detailed information
#                         "details": {
#                             "detected_faces": face_count,
#                             "allowed_faces": MAX_ALLOWED_FACES,
#                             "message": "Only the registered participant should be visible in the camera frame.",
#                             "action_required": "Please ensure you are alone in front of the camera and try again.",
#                             "policy": "Single participant policy enforced"
#                         },
                        
#                         # Frontend popup configuration
#                         "show_popup": True,
#                         "popup_title": "Multiple People Detected",
#                         "popup_message": MULTI_FACE_ERROR_MESSAGE,
#                         "popup_type": "error",
#                         "popup_icon": "ðŸš«",
#                         "popup_action": "retry",
#                         "popup_instructions": [
#                             "Ensure only you are visible in the camera",
#                             "Remove other people from the frame",
#                             "Position yourself in good lighting",
#                             "Look directly at the camera",
#                             "Try again when alone"
#                         ],
                        
#                         # Status and metadata
#                         "status": "REJECTED",
#                         "reason": "multiple_people_policy_violation",
#                         "timestamp": datetime.utcnow().isoformat(),
#                         "protocol": SERVER_PROTOCOL,
#                         "port": int(SERVER_PORT)
#                     }, status=403)
                
#                 # ============================================================
#                 # STEP: Single Face Detected - Proceed with Verification
#                 # ============================================================
#                 logger.info(f"âœ… Single face detected - proceeding with face matching")
                
#             except ValueError as ve:
#                 # No face detected or other extraction error
#                 error_msg = str(ve)
#                 log_verification_attempt(user_id, None, False, None, error=error_msg)
#                 return JsonResponse({
#                     "allowed": False,
#                     "error": error_msg,
#                     "error_code": "NO_FACE_DETECTED",
#                     "protocol": SERVER_PROTOCOL,
#                     "port": int(SERVER_PORT)
#                 }, status=400)
            
#             # ================================================================
#             # ORIGINAL: Face Matching with Stored Embedding
#             # ================================================================
#             try:
#                 distance = cosine_distance(stored_embedding, live_embedding)
#                 allowed = distance < FACE_DISTANCE_THRESHOLD
#                 confidence = max(0, min(100, (1 - distance) * 100))
#                 processing_time = (datetime.utcnow() - start_time).total_seconds()
                
#                 if distance < 0.3:
#                     match_quality = "EXCELLENT"
#                 elif distance < 0.5:
#                     match_quality = "GOOD"
#                 elif distance < FACE_DISTANCE_THRESHOLD:
#                     match_quality = "ACCEPTABLE"
#                 else:
#                     match_quality = "POOR"
                
#                 logger.info(f"{'='*80}")
#                 logger.info(f"ðŸ“Š VERIFICATION RESULTS:")
#                 logger.info(f"   User ID: {user_id}")
#                 logger.info(f"   Face Count: {face_count} (âœ… Single Participant)")
#                 logger.info(f"   Distance: {distance:.4f}")
#                 logger.info(f"   Threshold: {FACE_DISTANCE_THRESHOLD}")
#                 logger.info(f"   Match: {'âœ… YES' if allowed else 'âŒ NO'}")
#                 logger.info(f"   Confidence: {confidence:.2f}%")
#                 logger.info(f"   Match Quality: {match_quality}")
#                 logger.info(f"   Processing Time: {processing_time:.3f}s")
#                 logger.info(f"{'='*80}")
                
#                 # Log verification attempt
#                 log_verification_attempt(
#                     user_id,
#                     distance,
#                     allowed,
#                     confidence,
#                     metadata={
#                         "processing_time": processing_time,
#                         "image_size": image_file.size,
#                         "image_type": image_file.content_type,
#                         "image_name": image_file.name,
#                         "match_quality": match_quality,
#                         "verification_type": "waiting_room",
#                         "face_count": face_count,
#                         "multi_face_check": "passed",
#                         "single_participant_enforcement": True,
#                         "primary_face_score": primary_face['det_score'],
#                         "protocol": SERVER_PROTOCOL,
#                         "port": SERVER_PORT,
#                     }
#                 )
                
#                 # Prepare response
#                 response_data = {
#                     "allowed": allowed,
#                     "user_id": str(user_id),
#                     "distance": round(float(distance), 4),
#                     "threshold": FACE_DISTANCE_THRESHOLD,
#                     "confidence": round(confidence, 2),
#                     "match_quality": match_quality,
#                     "processing_time": round(processing_time, 3),
#                     "timestamp": datetime.utcnow().isoformat(),
#                     "verification_type": "waiting_room",
#                     "protocol": SERVER_PROTOCOL,
#                     "port": int(SERVER_PORT),
                    
#                     # NEW: Multi-face check results
#                     "face_count": face_count,
#                     "multi_face_check": "passed",
#                     "single_participant_confirmed": True,
#                     "primary_face_detection_score": round(primary_face['det_score'], 3)
#                 }
                
#                 if allowed:
#                     response_data["message"] = "âœ… Face verified successfully - Single participant confirmed"
#                     response_data["status"] = "VERIFIED"
#                 else:
#                     response_data["message"] = "âŒ Face verification failed - No match found"
#                     response_data["status"] = "NOT_VERIFIED"
                
#                 return JsonResponse(response_data, status=200)
                
#             except Exception as e:
#                 error_msg = "Failed to compare face embeddings"
#                 logger.error(f"âŒ {error_msg}: {e}")
#                 return JsonResponse({
#                     "allowed": False,
#                     "error": error_msg,
#                     "error_code": "COMPARISON_FAILED",
#                     "protocol": SERVER_PROTOCOL,
#                     "port": int(SERVER_PORT)
#                 }, status=500)
            
#         except Exception as e:
#             error_msg = "Internal server error during verification"
#             logger.error(f"âŒ Unexpected error: {e}", exc_info=True)
#             return JsonResponse({
#                 "allowed": False,
#                 "error": error_msg,
#                 "error_code": "INTERNAL_SERVER_ERROR",
#                 "protocol": SERVER_PROTOCOL,
#                 "port": int(SERVER_PORT)
#             }, status=500)


# class ContinuousVerifyFace(APIView):
#     """Manual continuous face verification endpoint"""
#     parser_classes = [MultiPartParser, FormParser]

#     def post(self, request):
#         user_id = None
#         session_id = None
#         start_time = datetime.utcnow()
        
#         try:
#             user_id = request.data.get("user_id")
#             session_id = request.data.get("session_id")
#             room_name = request.data.get("room_name")
#             image_file = request.FILES.get("image")
            
#             logger.info(f"{'='*80}")
#             logger.info(f"ðŸ”„ MANUAL CONTINUOUS VERIFICATION - User: {user_id} | Session: {session_id}")
#             logger.info(f"{'='*80}")
            
#             if not user_id or not session_id or not room_name:
#                 return JsonResponse({
#                     "allowed": False,
#                     "error": "user_id, session_id, and room_name are required",
#                     "error_code": "MISSING_PARAMETERS",
#                     "action": "kick"
#                 }, status=400)
            
#             if not image_file:
#                 violation = {
#                     "reason": "No image provided for verification",
#                     "action": "kick",
#                     "type": "missing_image"
#                 }
#                 update_verification_session(session_id, None, violation)
                
#                 return JsonResponse({
#                     "allowed": False,
#                     "error": "image file is required",
#                     "error_code": "MISSING_IMAGE",
#                     "action": "kick"
#                 }, status=400)
            
#             session_doc = db[VERIFICATION_SESSIONS_COLLECTION].find_one({
#                 "_id": ObjectId(session_id),
#                 "user_id": str(user_id),
#                 "status": "active"
#             })
            
#             if not session_doc:
#                 logger.error(f"âŒ Invalid or inactive session {session_id}")
#                 return JsonResponse({
#                     "allowed": False,
#                     "error": "Invalid or inactive verification session",
#                     "error_code": "INVALID_SESSION",
#                     "action": "kick"
#                 }, status=403)
            
#             violations_count = len(session_doc.get("violations", []))
#             if violations_count >= 3:
#                 logger.warning(f"âš ï¸ Session {session_id} has {violations_count} violations - auto-kick")
#                 return JsonResponse({
#                     "allowed": False,
#                     "error": "Too many verification violations",
#                     "error_code": "TOO_MANY_VIOLATIONS",
#                     "action": "kick",
#                     "violations": violations_count
#                 }, status=403)
            
#             user_record = get_user_embedding(user_id)
            
#             if user_record is None:
#                 violation = {
#                     "reason": "User not registered",
#                     "action": "kick",
#                     "type": "user_not_found"
#                 }
#                 update_verification_session(session_id, None, violation)
                
#                 return JsonResponse({
#                     "allowed": False,
#                     "error": f"User '{user_id}' not found. Please register first.",
#                     "error_code": "USER_NOT_FOUND",
#                     "action": "kick"
#                 }, status=404)
            
#             stored_embedding = user_record["embedding"]
            
#             try:
#                 logger.info(f"ðŸ“¸ Extracting face embedding for manual continuous verification...")
#                 live_embedding = face_model.extract_embedding(image_file)
#                 logger.info(f"âœ… Live embedding extracted successfully")
                
#             except ValueError as ve:
#                 violation = {
#                     "reason": str(ve),
#                     "action": "warn" if violations_count < 2 else "kick",
#                     "type": "no_face_detected"
#                 }
#                 update_verification_session(session_id, None, violation)
                
#                 return JsonResponse({
#                     "allowed": False,
#                     "error": str(ve),
#                     "error_code": "NO_FACE_DETECTED",
#                     "action": violation["action"],
#                     "violations": violations_count + 1
#                 }, status=400)
                
#             try:
#                 distance = cosine_distance(stored_embedding, live_embedding)
#                 allowed = distance < FACE_DISTANCE_THRESHOLD
#                 confidence = max(0, min(100, (1 - distance) * 100))
#                 processing_time = (datetime.utcnow() - start_time).total_seconds()
                
#                 if allowed:
#                     action = "allow"
#                     message = "âœ… Continuous verification successful"
#                 else:
#                     violations_count += 1
#                     if violations_count >= 3:
#                         action = "kick"
#                         message = "âŒ Face verification failed - User will be removed"
#                     elif violations_count >= 2:
#                         action = "warn"
#                         message = "âš ï¸ Face verification failed - Final warning"
#                     else:
#                         action = "warn"
#                         message = "âš ï¸ Face verification failed - Warning"
                    
#                     violation = {
#                         "reason": "Face mismatch",
#                         "distance": distance,
#                         "confidence": confidence,
#                         "threshold": FACE_DISTANCE_THRESHOLD,
#                         "action": action,
#                         "type": "face_mismatch"
#                     }
#                     update_verification_session(session_id, {"allowed": False, "distance": distance}, violation)
                
#                 if allowed:
#                     update_verification_session(session_id, {"allowed": True, "distance": distance})
                
#                 logger.info(f"ðŸ“Š Manual Continuous Verification: {'âœ… PASS' if allowed else 'âŒ FAIL'}")
#                 logger.info(f"   Distance: {distance:.4f} | Confidence: {confidence:.2f}%")
#                 logger.info(f"   Action: {action.upper()} | Violations: {violations_count}")
                
#                 log_verification_attempt(
#                     user_id,
#                     distance,
#                     allowed,
#                     confidence,
#                     metadata={
#                         "verification_type": "continuous_manual",
#                         "session_id": session_id,
#                         "room_name": room_name,
#                         "processing_time": processing_time,
#                         "violations_count": violations_count,
#                         "action_taken": action
#                     }
#                 )
                
#                 response_data = {
#                     "allowed": allowed,
#                     "user_id": str(user_id),
#                     "session_id": session_id,
#                     "distance": round(float(distance), 4),
#                     "threshold": FACE_DISTANCE_THRESHOLD,
#                     "confidence": round(confidence, 2),
#                     "verification_count": session_doc.get("verification_count", 0) + 1,
#                     "violations": violations_count,
#                     "action": action,
#                     "message": message,
#                     "processing_time": round(processing_time, 3),
#                     "timestamp": datetime.utcnow().isoformat()
#                 }
                
#                 return JsonResponse(response_data, status=200)
                
#             except Exception as e:
#                 logger.error(f"âŒ Comparison error: {e}")
#                 return JsonResponse({
#                     "allowed": False,
#                     "error": "Failed to compare face embeddings",
#                     "error_code": "COMPARISON_FAILED",
#                     "action": "kick"
#                 }, status=500)
            
#         except Exception as e:
#             logger.error(f"âŒ Unexpected error: {e}", exc_info=True)
#             return JsonResponse({
#                 "allowed": False,
#                 "error": "Internal server error during continuous verification",
#                 "error_code": "INTERNAL_SERVER_ERROR",
#                 "action": "kick"
#             }, status=500)


# # ---------------------------------------------------------------------
# # NEW: Enhanced Attendance Detection with Automatic Camera State Monitoring
# # ---------------------------------------------------------------------
# class EnhancedAttendanceDetection(APIView):
#     """
#     Enhanced attendance detection with AUTOMATIC camera state tracking.
#     Automatically triggers face verification when camera is re-enabled.
#     NO FRONTEND CHANGES REQUIRED!
#     """
#     parser_classes = [MultiPartParser, FormParser]

#     def post(self, request):
#         user_id = None
#         start_time = datetime.utcnow()
        
#         try:
#             # Get request data
#             user_id = request.data.get("user_id")
#             meeting_id = request.data.get("meeting_id")
#             frame_data = request.data.get("frame")
#             camera_enabled = request.data.get("camera_enabled", True)
#             is_on_break = request.data.get("is_on_break", False)
#             is_break_paused = request.data.get("is_break_paused", False)
            
#             logger.info(f"{'='*80}")
#             logger.info(f"ðŸ” ATTENDANCE DETECTION - User: {user_id} | Camera: {camera_enabled}")
#             logger.info(f"{'='*80}")
            
#             # Validate inputs
#             if not user_id or not meeting_id:
#                 return JsonResponse({
#                     "allowed": False,
#                     "error": "user_id and meeting_id required"
#                 }, status=400)
            
#             # Get or create session
#             session = db[VERIFICATION_SESSIONS_COLLECTION].find_one({
#                 "user_id": str(user_id),
#                 "room_name": meeting_id,
#                 "status": "active"
#             })
            
#             if not session:
#                 # Create new session
#                 session_id = create_verification_session(user_id, meeting_id, initial_verification=False)
#                 session = db[VERIFICATION_SESSIONS_COLLECTION].find_one({"_id": ObjectId(session_id)})
#                 logger.info(f"ðŸ“ Created new session {session_id} for user {user_id}")
            
#             # ================================================================
#             # AUTOMATIC CAMERA STATE DETECTION
#             # ================================================================
            
#             state_info = detect_camera_state_change(session, frame_data)
            
#             # Update camera state in session
#             update_camera_state_in_session(
#                 str(session["_id"]),
#                 state_info,
#                 frame_data
#             )
            
#             logger.info(f"ðŸ“¹ Camera State: {state_info['previous_state']} â†’ {state_info['new_state']}")
#             if state_info.get("time_since_last_frame"):
#                 logger.info(f"   Time since last frame: {state_info['time_since_last_frame']:.2f}s")
            
#             # ================================================================
#             # AUTOMATIC CONTINUOUS FACE VERIFICATION ON CAMERA RE-ENABLE
#             # ================================================================
            
#             if state_info["should_reverify"]:
#                 logger.info(f"ðŸ”’ CAMERA RE-ENABLED - Triggering AUTOMATIC face verification!")
                
#                 # Check if we have frame data
#                 if not frame_data or not camera_enabled:
#                     logger.warning("âš ï¸ Camera re-enabled but no frame data available yet - waiting...")
#                     return JsonResponse({
#                         "status": "waiting_for_frame",
#                         "message": "Camera re-enabled - waiting for video frame",
#                         "attendance_percentage": 100,
#                         "engagement_score": 100,
#                         "violations": [],
#                         "session_active": True,
#                         "camera_state": state_info["new_state"]
#                     })
                
#                 # Perform automatic face verification
#                 try:
#                     logger.info("ðŸ“¸ Extracting face embedding from frame...")
                    
#                     # Extract face embedding
#                     live_embedding = face_model.extract_embedding(frame_data)
                    
#                     # Get stored embedding
#                     user_record = get_user_embedding(user_id)
#                     if not user_record:
#                         raise ValueError("User not registered")
                    
#                     stored_embedding = user_record["embedding"]
                    
#                     # Calculate distance
#                     distance = cosine_distance(stored_embedding, live_embedding)
#                     allowed = distance < FACE_DISTANCE_THRESHOLD
#                     confidence = max(0, min(100, (1 - distance) * 100))
                    
#                     logger.info(f"{'='*80}")
#                     logger.info(f"ðŸ“Š AUTOMATIC FACE VERIFICATION RESULT:")
#                     logger.info(f"   Distance: {distance:.4f}")
#                     logger.info(f"   Threshold: {FACE_DISTANCE_THRESHOLD}")
#                     logger.info(f"   Result: {'âœ… PASS' if allowed else 'âŒ FAIL'}")
#                     logger.info(f"   Confidence: {confidence:.2f}%")
#                     logger.info(f"{'='*80}")
                    
#                     if allowed:
#                         # âœ… VERIFICATION PASSED
#                         logger.info("âœ… Automatic continuous verification PASSED")
                        
#                         # Clear pending reverification
#                         db[VERIFICATION_SESSIONS_COLLECTION].update_one(
#                             {"_id": session["_id"]},
#                             {"$set": {"pending_reverification": False}}
#                         )
                        
#                         # Log successful verification
#                         log_verification_attempt(
#                             user_id,
#                             distance,
#                             True,
#                             confidence,
#                             metadata={
#                                 "verification_type": "continuous_automatic",
#                                 "trigger": "camera_re_enable",
#                                 "session_id": str(session["_id"]),
#                                 "meeting_id": meeting_id
#                             }
#                         )
                        
#                         return JsonResponse({
#                             "status": "reverification_success",
#                             "message": "âœ… Face verified successfully after camera re-enable",
#                             "allowed": True,
#                             "distance": round(distance, 4),
#                             "confidence": round(confidence, 2),
#                             "attendance_percentage": 100,
#                             "engagement_score": 100,
#                             "violations": len(session.get("violations", [])),
#                             "session_active": True,
#                             "verification_type": "continuous_automatic",
#                             "camera_state": state_info["new_state"]
#                         })
                    
#                     else:
#                         # âŒ VERIFICATION FAILED
#                         logger.error("âŒ Automatic continuous verification FAILED")
                        
#                         # Add violation
#                         violation_entry = {
#                             "reason": "Face mismatch after camera re-enable (automatic)",
#                             "distance": distance,
#                             "confidence": confidence,
#                             "action": "warning",
#                             "type": "continuous_verification_failed_auto"
#                         }
                        
#                         # Update violations
#                         db[VERIFICATION_SESSIONS_COLLECTION].update_one(
#                             {"_id": session["_id"]},
#                             {
#                                 "$push": {"violations": violation_entry},
#                                 "$set": {"pending_reverification": False}
#                             }
#                         )
                        
#                         # Get updated violation count
#                         updated_session = db[VERIFICATION_SESSIONS_COLLECTION].find_one(
#                             {"_id": session["_id"]}
#                         )
#                         violation_count = len(updated_session.get("violations", []))
                        
#                         logger.warning(f"âš ï¸ Violation count: {violation_count}/3")
                        
#                         # Log failed verification
#                         log_verification_attempt(
#                             user_id,
#                             distance,
#                             False,
#                             confidence,
#                             error="Face mismatch",
#                             metadata={
#                                 "verification_type": "continuous_automatic",
#                                 "trigger": "camera_re_enable",
#                                 "violation_count": violation_count,
#                                 "session_id": str(session["_id"]),
#                                 "meeting_id": meeting_id
#                             }
#                         )
                        
#                         # Determine action
#                         if violation_count >= 3:
#                             # ðŸš« KICK USER
#                             logger.error(f"ðŸš« Maximum violations ({violation_count}/3) reached - KICKING USER")
                            
#                             # Update session status
#                             db[VERIFICATION_SESSIONS_COLLECTION].update_one(
#                                 {"_id": session["_id"]},
#                                 {"$set": {"status": "suspended"}}
#                             )
                            
#                             return JsonResponse({
#                                 "status": "session_closed",
#                                 "message": "âŒ Face verification failed. Maximum violations (3/3) reached. You will be removed from the meeting.",
#                                 "allowed": False,
#                                 "action": "kick",
#                                 "violations": violation_count,
#                                 "reason": "Face verification failed after camera re-enable",
#                                 "attendance_percentage": 0,
#                                 "session_active": False,
#                                 "camera_state": state_info["new_state"]
#                             }, status=403)
                        
#                         else:
#                             # âš ï¸ WARNING
#                             warnings_remaining = 3 - violation_count
                            
#                             return JsonResponse({
#                                 "status": "reverification_failed",
#                                 "message": f"âš ï¸ Face verification failed after camera re-enable. Warning {violation_count}/3",
#                                 "allowed": False,
#                                 "action": "warn",
#                                 "violations": violation_count,
#                                 "warnings_remaining": warnings_remaining,
#                                 "distance": round(distance, 4),
#                                 "confidence": round(confidence, 2),
#                                 "attendance_percentage": 100,
#                                 "engagement_score": 100,
#                                 "session_active": True,
#                                 "popup": f"âš ï¸ Face verification failed after camera re-enable. {warnings_remaining} attempts remaining before removal.",
#                                 "camera_state": state_info["new_state"]
#                             })
                
#                 except Exception as e:
#                     logger.error(f"âŒ Automatic verification error: {e}", exc_info=True)
                    
#                     # Add violation for error
#                     violation_entry = {
#                         "reason": f"Verification error: {str(e)}",
#                         "action": "warning",
#                         "type": "verification_error"
#                     }
                    
#                     db[VERIFICATION_SESSIONS_COLLECTION].update_one(
#                         {"_id": session["_id"]},
#                         {"$push": {"violations": violation_entry}}
#                     )
                    
#                     return JsonResponse({
#                         "status": "verification_error",
#                         "message": f"Verification error: {str(e)}",
#                         "allowed": False,
#                         "action": "warn",
#                         "attendance_percentage": 100,
#                         "session_active": True,
#                         "camera_state": state_info["new_state"]
#                     })
            
#             # ================================================================
#             # NORMAL MONITORING (No camera state change)
#             # ================================================================
            
#             # Skip detection if on break and not paused
#             if is_on_break and not is_break_paused:
#                 return JsonResponse({
#                     "status": "on_break",
#                     "message": "Detection paused during break",
#                     "attendance_percentage": 100,
#                     "violations": [],
#                     "session_active": True,
#                     "camera_state": state_info["new_state"]
#                 })
            
#             # Skip if no frame data
#             if not frame_data or not camera_enabled:
#                 return JsonResponse({
#                     "status": "camera_disabled",
#                     "message": "Camera disabled - no detection",
#                     "attendance_percentage": 100,
#                     "violations": [],
#                     "session_active": True,
#                     "camera_state": state_info["new_state"]
#                 })
            
#             # Normal monitoring response
#             return JsonResponse({
#                 "status": "monitoring",
#                 "message": "Active monitoring with automatic camera state detection",
#                 "attendance_percentage": 100,
#                 "engagement_score": 100,
#                 "violations": len(session.get("violations", [])),
#                 "session_active": True,
#                 "camera_state": state_info["new_state"],
#                 "pending_reverification": state_info.get("pending_reverification", False)
#             })
            
#         except Exception as e:
#             logger.error(f"âŒ Unexpected error in attendance detection: {e}", exc_info=True)
#             return JsonResponse({
#                 "status": "error",
#                 "error": str(e),
#                 "session_active": True
#             }, status=500)


# # ---------------------------------------------------------------------
# # Session Management Endpoints
# # ---------------------------------------------------------------------
# @api_view(['POST'])
# def create_session_endpoint(request):
#     """Create verification session"""
#     try:
#         data = json.loads(request.body)
#         user_id = data.get('user_id')
#         room_name = data.get('room_name')
        
#         if not user_id or not room_name:
#             return JsonResponse({
#                 "error": "user_id and room_name are required"
#             }, status=400)
        
#         session_id = create_verification_session(user_id, room_name, initial_verification=True)
        
#         if session_id:
#             return JsonResponse({
#                 "session_id": session_id,
#                 "user_id": user_id,
#                 "room_name": room_name,
#                 "status": "active",
#                 "message": "Verification session created successfully with camera state tracking"
#             }, status=201)
#         else:
#             return JsonResponse({
#                 "error": "Failed to create session"
#             }, status=500)
            
#     except Exception as e:
#         logger.error(f"Error creating session: {e}")
#         return JsonResponse({"error": str(e)}, status=500)


# @api_view(['POST'])
# def end_session_endpoint(request, session_id):
#     """End verification session"""
#     try:
#         success = end_verification_session(session_id)
        
#         if success:
#             return JsonResponse({
#                 "message": "Session ended successfully",
#                 "session_id": session_id
#             }, status=200)
#         else:
#             return JsonResponse({
#                 "error": "Failed to end session"
#             }, status=500)
        
#     except Exception as e:
#         logger.error(f"Error ending session: {e}")
#         return JsonResponse({"error": str(e)}, status=500)


# @api_view(['GET'])
# def get_session_status_endpoint(request, session_id):
#     """Get session status"""
#     try:
#         status = get_session_status(session_id)
        
#         if status:
#             return JsonResponse(status, status=200)
#         else:
#             return JsonResponse({
#                 "error": "Session not found"
#             }, status=404)
        
#     except Exception as e:
#         logger.error(f"Error getting session status: {e}")
#         return JsonResponse({"error": str(e)}, status=500)


# # ---------------------------------------------------------------------
# # Health Check & Stats Endpoints
# # ---------------------------------------------------------------------
# @api_view(['GET'])
# def health_check(request):
#     """Health check endpoint"""
#     try:
#         client.server_info()
#         mongo_status = "connected"
        
#         user_count = db[FACE_EMBEDDINGS_COLLECTION].count_documents({})
#         log_count = db[VERIFICATION_LOGS_COLLECTION].count_documents({})
#         session_count = db[VERIFICATION_SESSIONS_COLLECTION].count_documents({"status": "active"})
        
#         recent_logs = list(db[VERIFICATION_LOGS_COLLECTION].find(
#             {},
#             {"_id": 0, "user_id": 1, "allowed": 1, "timestamp": 1, "distance": 1, "confidence": 1}
#         ).sort("timestamp", -1).limit(5))
        
#     except Exception as e:
#         mongo_status = f"disconnected: {str(e)}"
#         user_count = 0
#         log_count = 0
#         session_count = 0
#         recent_logs = []
    
#     return JsonResponse({
#         "status": "healthy" if mongo_status == "connected" else "unhealthy",
#         "service": "Face Verification Service - HTTPS with AUTOMATIC Continuous Verification",
#         "version": "3.0.0",
#         "timestamp": datetime.utcnow().isoformat(),
#         "protocol": SERVER_PROTOCOL,
#         "port": int(SERVER_PORT),
#         "mongodb": {
#             "status": mongo_status,
#             "database": MONGO_DB,
#             "host": MONGO_HOST,
#             "port": MONGO_PORT,
#             "collections": {
#                 "embeddings": FACE_EMBEDDINGS_COLLECTION,
#                 "logs": VERIFICATION_LOGS_COLLECTION,
#                 "sessions": VERIFICATION_SESSIONS_COLLECTION,
#             },
#             "registered_users": user_count,
#             "verification_logs": log_count,
#             "active_sessions": session_count,
#         },
#         "model": {
#             "name": FACE_MODEL_NAME,
#             "threshold": FACE_DISTANCE_THRESHOLD,
#             "detection_size": list(FACE_DETECTION_SIZE),
#             "embedding_dimension": 512,
#         },
#         "features": {
#             "initial_verification": True,
#             "continuous_verification": True,
#             "automatic_camera_detection": True,
#             "session_management": True,
#             "violation_tracking": True,
#             "auto_kick": True,
#             "max_violations": 3,
#             "camera_gap_threshold": CAMERA_FRAME_GAP_THRESHOLD
#         },
#         "recent_verifications": recent_logs,
#     })


# @api_view(['GET'])
# def get_user_status(request, user_id):
#     """Check user registration status"""
#     try:
#         user_record = get_user_embedding(user_id)
        
#         if user_record:
#             user_info = {
#                 "registered": True,
#                 "user_id": str(user_id),
#                 "registered_at": user_record.get("registered_at", "Unknown"),
#                 "updated_at": user_record.get("updated_at", "Unknown"),
#                 "is_active": user_record.get("is_active", True),
#                 "version": user_record.get("version", 1),
#                 "embedding_dimension": len(user_record.get("embedding", [])),
#                 "metadata": user_record.get("metadata", {}),
#                 "protocol": SERVER_PROTOCOL,
#                 "port": int(SERVER_PORT),
#             }
            
#             verification_count = db[VERIFICATION_LOGS_COLLECTION].count_documents({"user_id": str(user_id)})
#             successful_count = db[VERIFICATION_LOGS_COLLECTION].count_documents({"user_id": str(user_id), "allowed": True})
            
#             active_sessions = db[VERIFICATION_SESSIONS_COLLECTION].count_documents({
#                 "user_id": str(user_id),
#                 "status": "active"
#             })
            
#             total_violations = 0
#             all_sessions = db[VERIFICATION_SESSIONS_COLLECTION].find({"user_id": str(user_id)})
#             for session in all_sessions:
#                 total_violations += len(session.get("violations", []))
            
#             user_info["verification_stats"] = {
#                 "total_attempts": verification_count,
#                 "successful": successful_count,
#                 "failed": verification_count - successful_count,
#                 "success_rate": round((successful_count / verification_count * 100), 2) if verification_count > 0 else 0,
#             }
            
#             user_info["session_stats"] = {
#                 "active_sessions": active_sessions,
#                 "total_violations": total_violations
#             }
            
#             return JsonResponse(user_info)
#         else:
#             return JsonResponse({
#                 "registered": False,
#                 "user_id": str(user_id),
#                 "message": "User not found in the system",
#                 "protocol": SERVER_PROTOCOL,
#                 "port": int(SERVER_PORT)
#             }, status=404)
            
#     except Exception as e:
#         logger.error(f"âŒ Error checking user status: {e}")
#         return JsonResponse({
#             "error": str(e),
#             "error_code": "STATUS_CHECK_FAILED",
#             "protocol": SERVER_PROTOCOL,
#             "port": int(SERVER_PORT)
#         }, status=500)


# @api_view(['GET'])
# def get_stats(request):
#     """Get system statistics"""
#     try:
#         total_users = db[FACE_EMBEDDINGS_COLLECTION].count_documents({})
#         active_users = db[FACE_EMBEDDINGS_COLLECTION].count_documents({"is_active": True})
        
#         total_verifications = db[VERIFICATION_LOGS_COLLECTION].count_documents({})
#         successful_verifications = db[VERIFICATION_LOGS_COLLECTION].count_documents({"allowed": True})
        
#         active_sessions = db[VERIFICATION_SESSIONS_COLLECTION].count_documents({"status": "active"})
#         total_sessions = db[VERIFICATION_SESSIONS_COLLECTION].count_documents({})
        
#         yesterday = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
#         recent_verifications = db[VERIFICATION_LOGS_COLLECTION].count_documents({
#             "timestamp": {"$gte": yesterday}
#         })
#         recent_successful = db[VERIFICATION_LOGS_COLLECTION].count_documents({
#             "timestamp": {"$gte": yesterday},
#             "allowed": True
#         })
        
#         # Count automatic verifications
#         auto_verifications = db[VERIFICATION_LOGS_COLLECTION].count_documents({
#             "metadata.verification_type": "continuous_automatic"
#         })
        
#         pipeline = [
#             {"$match": {"allowed": True, "confidence": {"$ne": None}}},
#             {"$group": {"_id": None, "avg_confidence": {"$avg": "$confidence"}, "avg_distance": {"$avg": "$distance"}}}
#         ]
#         avg_result = list(db[VERIFICATION_LOGS_COLLECTION].aggregate(pipeline))
#         avg_confidence = round(avg_result[0]["avg_confidence"], 2) if avg_result else 0
#         avg_distance = round(avg_result[0]["avg_distance"], 4) if avg_result else 0
        
#         violation_pipeline = [
#             {"$match": {"status": {"$in": ["active", "completed", "suspended"]}}},
#             {"$project": {"violation_count": {"$size": "$violations"}}},
#             {"$group": {"_id": None, "total_violations": {"$sum": "$violation_count"}}}
#         ]
#         violation_result = list(db[VERIFICATION_SESSIONS_COLLECTION].aggregate(violation_pipeline))
#         total_violations = violation_result[0]["total_violations"] if violation_result else 0
        
#         return JsonResponse({
#             "users": {
#                 "total": total_users,
#                 "active": active_users,
#                 "inactive": total_users - active_users,
#             },
#             "verifications": {
#                 "total": total_verifications,
#                 "successful": successful_verifications,
#                 "failed": total_verifications - successful_verifications,
#                 "automatic": auto_verifications,
#                 "success_rate": round((successful_verifications / total_verifications * 100), 2) if total_verifications > 0 else 0,
#                 "avg_confidence": avg_confidence,
#                 "avg_distance": avg_distance,
#             },
#             "sessions": {
#                 "total": total_sessions,
#                 "active": active_sessions,
#                 "total_violations": total_violations
#             },
#             "last_24_hours": {
#                 "total_verifications": recent_verifications,
#                 "successful": recent_successful,
#                 "failed": recent_verifications - recent_successful,
#                 "success_rate": round((recent_successful / recent_verifications * 100), 2) if recent_verifications > 0 else 0,
#             },
#             "timestamp": datetime.utcnow().isoformat(),
#             "protocol": SERVER_PROTOCOL,
#             "port": int(SERVER_PORT),
#         })
        
#     except Exception as e:
#         logger.error(f"âŒ Error getting stats: {e}")
#         return JsonResponse({
#             "error": str(e),
#             "error_code": "STATS_FETCH_FAILED",
#             "protocol": SERVER_PROTOCOL,
#             "port": int(SERVER_PORT)
#         }, status=500)


# # ---------------------------------------------------------------------
# # URL Patterns
# # ---------------------------------------------------------------------
# # ============================================================================
# # NEW: Continuous Identity Check Endpoint (called by frontend every 1-5 sec)
# # ============================================================================
# @api_view(['POST'])
# def continuous_identity_check(request):
#     """
#     NEW ENDPOINT: Frontend sends frame here every 1-5 seconds during meeting.
    
#     This endpoint:
#     1. Extracts face from frame (GPU)
#     2. Compares with stored embedding (GPU)  
#     3. Tracks consecutive unknown seconds (0-5)
#     4. Issues warnings (1/3, 2/3, 3/3)
#     5. Applies -1% penalty and removes on 3rd warning
#     6. Returns complete identity status
    
#     Request body (JSON):
#         { "user_id": "123", "meeting_id": "meeting456", "frame": "<base64>" }
    
#     Response:
#         { "identity_verified": true/false, "identity_popup": "...", 
#           "identity_warning_count": 0-3, "identity_is_removed": false, ... }
#     """
#     try:
#         data = json.loads(request.body)
#         user_id = data.get("user_id")
#         meeting_id = data.get("meeting_id")
#         frame_data = data.get("frame")
        
#         if not user_id or not meeting_id:
#             return JsonResponse({"error": "user_id and meeting_id required"}, status=400)
        
#         if not frame_data:
#             return JsonResponse({"error": "frame data required"}, status=400)
        
#         # Check if user is already removed
#         state = get_identity_state(meeting_id, user_id)
#         if state["is_removed"]:
#             return JsonResponse({
#                 "status": "removed",
#                 "identity_verified": False,
#                 "identity_is_removed": True,
#                 "identity_removal_count": state["removal_count"],
#                 "identity_attendance_penalty": state["attendance_penalty"],
#                 "identity_popup": "You are removed due to identity verification failure. Please rejoin.",
#                 "identity_can_rejoin": state["can_rejoin"],
#             })
        
#         # Get stored embedding from MongoDB
#         user_record = get_user_embedding(user_id)
#         if not user_record:
#             return JsonResponse({
#                 "error": f"User {user_id} not registered",
#                 "identity_verified": False,
#             }, status=404)
        
#         stored_embedding = user_record["embedding"]
        
#         # Extract live face embedding from frame (GPU)
#         try:
#             live_embedding = face_model.extract_embedding(frame_data)
#         except ValueError as ve:
#             # No face detected in frame - treat as unknown
#             result = check_identity_with_tracking(meeting_id, user_id, False, 1.0)
#             if result:
#                 result["face_detected"] = False
#                 return JsonResponse(result)
#             return JsonResponse({"identity_verified": True, "face_detected": False, "identity_popup": None})
        
#         # Compare embeddings
#         distance = cosine_distance(stored_embedding, live_embedding)
#         is_verified = distance < FACE_DISTANCE_THRESHOLD
#         similarity = max(0, min(1, 1 - distance))
        
#         # Run identity tracking logic (warnings, penalties, removal)
#         result = check_identity_with_tracking(meeting_id, user_id, is_verified, similarity)
        
#         if result:
#             result["face_detected"] = True
#             result["distance"] = round(distance, 4)
#             return JsonResponse(result)
        
#         # Skipped (too soon since last check)
#         return JsonResponse({
#             "status": "skipped",
#             "identity_verified": True,
#             "identity_popup": None,
#             "message": "Check skipped (within interval)",
#         })
        
#     except Exception as e:
#         logger.error(f"Error in continuous_identity_check: {e}", exc_info=True)
#         return JsonResponse({
#             "error": str(e),
#             "identity_verified": True,  # Fail-safe: don't falsely remove
#             "identity_popup": None,
#         }, status=500)


# @api_view(['POST'])
# def rejoin_after_identity_removal(request):
#     """
#     Called when a user who was removed for identity failure tries to rejoin.
#     Resets the identity cycle warnings so they get fresh 1/3, 2/3, 3/3.
#     """
#     try:
#         data = json.loads(request.body)
#         user_id = data.get("user_id")
#         meeting_id = data.get("meeting_id")
        
#         if not user_id or not meeting_id:
#             return JsonResponse({"error": "user_id and meeting_id required"}, status=400)
        
#         state = reset_identity_state(meeting_id, user_id)
        
#         logger.info(f"User {user_id} rejoined meeting {meeting_id} after identity removal #{state['removal_count']}")
        
#         return JsonResponse({
#             "status": "rejoined",
#             "message": "Identity tracking reset. You have 3 fresh warnings.",
#             "identity_removal_count": state["removal_count"],
#             "identity_attendance_penalty": state["attendance_penalty"],
#         })
        
#     except Exception as e:
#         logger.error(f"Error in rejoin: {e}")
#         return JsonResponse({"error": str(e)}, status=500)


# urlpatterns = [
#     # Face Verification endpoints
#     path("api/face/verify", VerifyFace.as_view(), name="verify_face"),
#     path("api/face/continuous-verify", ContinuousVerifyFace.as_view(), name="continuous_verify_face"),
    
#     # NEW: Continuous identity check with tracking (frontend calls this every 1-5 sec)
#     path("api/face/identity-check", continuous_identity_check, name="continuous_identity_check"),
    
#     # NEW: Rejoin after identity removal
#     path("api/face/rejoin", rejoin_after_identity_removal, name="rejoin_after_identity_removal"),
    
#     # NEW: Enhanced Attendance Detection with Automatic Camera State Monitoring
#     path("api/attendance/detect/", EnhancedAttendanceDetection.as_view(), name="enhanced_attendance_detect"),
    
#     # Session management
#     path("api/face/session/create", create_session_endpoint, name="create_verification_session"),
#     path("api/face/session/<str:session_id>/end", end_session_endpoint, name="end_verification_session"),
#     path("api/face/session/<str:session_id>/status", get_session_status_endpoint, name="get_session_status"),
    
#     # Status & monitoring endpoints
#     path("api/health", health_check, name="health_check"),
#     path("api/user/<str:user_id>/status", get_user_status, name="user_status"),
#     path("api/stats", get_stats, name="stats"),
# ]

# # ---------------------------------------------------------------------
# # ASGI Application
# # ---------------------------------------------------------------------
# application = ProtocolTypeRouter({
#     "http": get_asgi_application(),
# })

# # ---------------------------------------------------------------------
# # Development Server Runner
# # ---------------------------------------------------------------------
# if __name__ == "__main__":
#     from django.core.management import execute_from_command_line
#     import sys
    
#     logger.info("=" * 80)
#     logger.info("ðŸš€ Starting Face Verification Service - AUTOMATIC Continuous Verification")
#     logger.info("=" * 80)
#     logger.info(f"")
#     logger.info(f"ðŸ“‹ AUTOMATIC VERIFICATION PROCESS:")
#     logger.info(f"   1. Initial verification when user joins meeting")
#     logger.info(f"   2. Create verification session with camera state tracking")
#     logger.info(f"   3. âœ¨ AUTOMATICALLY monitor camera state changes")
#     logger.info(f"   4. âœ¨ AUTOMATICALLY detect when camera is re-enabled")
#     logger.info(f"   5. âœ¨ AUTOMATICALLY verify face on camera re-enable")
#     logger.info(f"   6. Track violations (3-strike system)")
#     logger.info(f"   7. Auto-kick after 3 violations")
#     logger.info(f"")
#     logger.info(f"ðŸŽ¯ KEY FEATURES:")
#     logger.info(f"   âœ… NO FRONTEND CHANGES REQUIRED!")
#     logger.info(f"   âœ… Automatic camera state detection")
#     logger.info(f"   âœ… Automatic face verification on camera re-enable")
#     logger.info(f"   âœ… Frame gap detection ({CAMERA_FRAME_GAP_THRESHOLD}s threshold)")
#     logger.info(f"   âœ… Smart violation tracking")
#     logger.info(f"   âœ… Progressive warning system")
#     logger.info(f"")
#     logger.info(f"ðŸ”’ Protocol: HTTPS (Secure)")
#     logger.info(f"ðŸ“Œ Port: {SERVER_PORT}")
#     logger.info(f"ðŸŒ Server: https://{SERVER_HOST}:{SERVER_PORT}")
#     logger.info(f"ðŸ—„ï¸ MongoDB: {MONGO_HOST}:{MONGO_PORT}/{MONGO_DB}")
#     logger.info(f"ðŸ“¦ Embeddings Collection: {FACE_EMBEDDINGS_COLLECTION}")
#     logger.info(f"ðŸ“ Logs Collection: {VERIFICATION_LOGS_COLLECTION}")
#     logger.info(f"ðŸ” Sessions Collection: {VERIFICATION_SESSIONS_COLLECTION}")
#     logger.info(f"ðŸ¤– Model: {FACE_MODEL_NAME}")
#     logger.info(f"ðŸ“Š Face Threshold: {FACE_DISTANCE_THRESHOLD} (lower = stricter matching)")
#     logger.info(f"â±ï¸ Camera Gap Threshold: {CAMERA_FRAME_GAP_THRESHOLD}s")
#     logger.info(f"ðŸ” Detection Size: {FACE_DETECTION_SIZE}")
#     logger.info("=" * 80)
#     logger.info("ðŸ“¡ Available HTTPS Endpoints:")
#     logger.info(f"   POST   https://{SERVER_HOST}:{SERVER_PORT}/api/face/verify")
#     logger.info(f"   POST   https://{SERVER_HOST}:{SERVER_PORT}/api/face/continuous-verify")
#     logger.info(f"   POST   https://{SERVER_HOST}:{SERVER_PORT}/api/attendance/detect/  âœ¨ ENHANCED")
#     logger.info(f"   POST   https://{SERVER_HOST}:{SERVER_PORT}/api/face/session/create")
#     logger.info(f"   POST   https://{SERVER_HOST}:{SERVER_PORT}/api/face/session/<id>/end")
#     logger.info(f"   GET    https://{SERVER_HOST}:{SERVER_PORT}/api/face/session/<id>/status")
#     logger.info(f"   GET    https://{SERVER_HOST}:{SERVER_PORT}/api/user/<user_id>/status")
#     logger.info(f"   GET    https://{SERVER_HOST}:{SERVER_PORT}/api/health")
#     logger.info(f"   GET    https://{SERVER_HOST}:{SERVER_PORT}/api/stats")
#     logger.info("=" * 80)
#     logger.info("âš ï¸ IMPORTANT NOTES:")
#     logger.info("   â€¢ User face embeddings must be registered in MongoDB first!")
#     logger.info("   â€¢ Frontend continues to work WITHOUT any changes!")
#     logger.info("   â€¢ Backend automatically detects camera state from frame data!")
#     logger.info("   â€¢ Verification triggers automatically when camera re-enabled!")
#     logger.info("   â€¢ Frame gap > 3s = camera disabled, frames resume = camera enabled!")
#     logger.info("=" * 80)
#     logger.info("")
#     logger.info("ðŸŽ‰ READY! Backend will automatically handle continuous verification!")
#     logger.info("")
    
#     sys.argv = ["manage.py", "runserver", f"{SERVER_HOST}:{SERVER_PORT}"]
#     execute_from_command_line(sys.argv)



# face_auth.py

"""
Complete Face Verification Backend - HTTPS with Continuous Automatic Verification
-----------------------------------------------------------------------------------
Verifies face on initial join and automatically when camera is re-enabled.
NO FRONTEND CHANGES REQUIRED - Backend automatically detects camera state changes.

Features:
- Initial face verification on meeting join
- AUTOMATIC continuous verification when camera toggles on (detected by backend)
- Session-based violation tracking with camera state monitoring
- Progressive warning system (3 strikes)
- Auto-kick after 3 violations
- Automatic camera state detection (no frontend changes needed)

Endpoints:
  POST /api/face/verify - Initial verification
  POST /api/face/continuous-verify - Manual continuous verification
  POST /api/attendance/detect/ - ENHANCED: Auto-detects camera state & verifies
  POST /api/face/session/create - Create verification session
  POST /api/face/session/<id>/end - End verification session
  GET /api/face/session/<id>/status - Get session status
"""

import os

# =============================================================================
# GPU CONFIGURATION — Service 2 uses GPU for continuous identity verification
# =============================================================================
os.environ.update({
    "CUDA_VISIBLE_DEVICES": "0",
    "CUDA_MODULE_LOADING": "LAZY",
    "ORT_CUDA_UNAVAILABLE_FAIL": "0",
    "ORT_TENSORRT_UNAVAILABLE_FAIL": "0",
    "OMP_NUM_THREADS": "4",
})

import numpy as np
import json
from io import BytesIO
from dotenv import load_dotenv
from django.conf import settings
from django.core.asgi import get_asgi_application
from django.urls import path
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.decorators import api_view
from channels.routing import ProtocolTypeRouter
from pymongo import MongoClient
from bson import ObjectId
from PIL import Image
from insightface.app import FaceAnalysis
import logging
from datetime import datetime, timedelta
import base64

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------
# Load Environment Variables
# ---------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

# ---------------------------------------------------------------------
# Django Configuration
# ---------------------------------------------------------------------
DJANGO_SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "django-insecure-v_&dc%&is!h)z)v*1q(s_8nf)l24p4q_a7$n=f7$9u0xik6j@q")
DJANGO_DEBUG = os.getenv("DJANGO_DEBUG", "True").lower() in ['true', '1', 't']
DJANGO_ALLOWED_HOSTS = [host.strip() for host in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,www.lancieretech.com,*").split(",")]

if not settings.configured:
    settings.configure(
        DEBUG=DJANGO_DEBUG,
        SECRET_KEY=DJANGO_SECRET_KEY,
        ROOT_URLCONF=__name__,
        ALLOWED_HOSTS=DJANGO_ALLOWED_HOSTS,
        INSTALLED_APPS=[
            "django.contrib.contenttypes",
            "django.contrib.staticfiles",
            "rest_framework",
            "channels",
            "corsheaders",
        ],
        MIDDLEWARE=[
            "corsheaders.middleware.CorsMiddleware",
            "django.middleware.security.SecurityMiddleware",
            "django.middleware.common.CommonMiddleware",
        ],
        CORS_ALLOW_ALL_ORIGINS=True,
        CORS_ALLOW_CREDENTIALS=True,
        CORS_ALLOWED_ORIGINS=[
            "https://localhost",
            "https://127.0.0.1",
            "https://www.lancieretech.com",
        ],
        SECURE_SSL_REDIRECT=False,
        SESSION_COOKIE_SECURE=True,
        CSRF_COOKIE_SECURE=True,
        SECURE_BROWSER_XSS_FILTER=True,
        SECURE_CONTENT_TYPE_NOSNIFF=True,
        ASGI_APPLICATION=__name__ + ".application",
        REST_FRAMEWORK={
            'DEFAULT_RENDERER_CLASSES': [
                'rest_framework.renderers.JSONRenderer',
            ],
            'DEFAULT_PARSER_CLASSES': [
                'rest_framework.parsers.JSONParser',
                'rest_framework.parsers.MultiPartParser',
                'rest_framework.parsers.FormParser',
            ],
            'EXCEPTION_HANDLER': 'rest_framework.views.exception_handler',
        },
        USE_TZ=True,
        TIME_ZONE=os.getenv("CELERY_TIMEZONE", "Asia/Kolkata"),
        LANGUAGE_CODE='en-us',
    )

    import django
    django.setup()

# ---------------------------------------------------------------------
# MongoDB Configuration
# ---------------------------------------------------------------------
MONGO_USER = os.getenv("MONGO_USER", "connectly")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD", "")
MONGO_HOST = os.getenv("MONGO_HOST", "mongodb.databases.svc.cluster.local")
MONGO_PORT = os.getenv("MONGO_PORT", "27017")
MONGO_DB = os.getenv("MONGO_DB", "connectlydb")
MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongodb.databases.svc.cluster.local:27017/imeetpro")

logger.info(f"ðŸ”— Connecting to MongoDB: {MONGO_HOST}:{MONGO_PORT}/{MONGO_DB}")

try:
    client = MongoClient(
        MONGO_URI,
        maxPoolSize=50,
        minPoolSize=10,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=10000,
        socketTimeoutMS=20000,
    )
    client.server_info()
    db = client[MONGO_DB]
    logger.info(f"âœ… MongoDB connected successfully to '{MONGO_DB}' database")
except Exception as e:
    logger.error(f"âŒ MongoDB connection failed: {e}")
    raise

# MongoDB Collections
FACE_EMBEDDINGS_COLLECTION = os.getenv("FACE_EMBEDDINGS_COLLECTION", "face_embeddings")
VERIFICATION_LOGS_COLLECTION = os.getenv("VERIFICATION_LOGS_COLLECTION", "face_verification_logs")
VERIFICATION_SESSIONS_COLLECTION = os.getenv("VERIFICATION_SESSIONS_COLLECTION", "face_verification_sessions")

# Face Recognition Configuration
FACE_DISTANCE_THRESHOLD = float(os.getenv("FACE_DISTANCE_THRESHOLD", "0.6"))
FACE_MODEL_NAME = os.getenv("FACE_MODEL_NAME", "buffalo_l")
FACE_DETECTION_SIZE = tuple(map(int, os.getenv("FACE_DETECTION_SIZE", "640,640").split(",")))

# Camera State Detection Configuration
CAMERA_FRAME_GAP_THRESHOLD = float(os.getenv("CAMERA_FRAME_GAP_THRESHOLD", "3.0"))  # seconds

# Server Configuration
SERVER_HOST = os.getenv("HOST", "0.0.0.0")
SERVER_PORT = os.getenv("PORT", "8220")
SERVER_PROTOCOL = "https"

logger.info(f"ðŸ”’ Protocol: HTTPS")
logger.info(f"ðŸ“Œ Port: {SERVER_PORT}")
logger.info(f"âš™ï¸ Face Distance Threshold: {FACE_DISTANCE_THRESHOLD}")
logger.info(f"âš™ï¸ Camera Gap Threshold: {CAMERA_FRAME_GAP_THRESHOLD}s")
logger.info(f"âš™ï¸ Face Model: {FACE_MODEL_NAME}")
logger.info(f"âš™ï¸ Detection Size: {FACE_DETECTION_SIZE}")

# ============================================================================
# NEW: SINGLE PARTICIPANT ENFORCEMENT CONFIGURATION
# ============================================================================
ALLOW_MULTIPLE_FACES = os.getenv("ALLOW_MULTIPLE_FACES", "False").lower() in ['false', '0', 'f']
MAX_ALLOWED_FACES = int(os.getenv("MAX_ALLOWED_FACES", "1"))
MULTI_FACE_ERROR_MESSAGE = os.getenv(
    "MULTI_FACE_ERROR_MESSAGE",
    "Multiple people detected! Only the registered participant is allowed to join the meeting. Please ensure you are alone in front of the camera."
)

logger.info(f"ðŸ›¡ï¸ SINGLE PARTICIPANT ENFORCEMENT: {'ENABLED' if not ALLOW_MULTIPLE_FACES else 'DISABLED'}")
logger.info(f"âš™ï¸ Max Allowed Faces: {MAX_ALLOWED_FACES}")

# ============================================================================
# IDENTITY TRACKING CONFIGURATION (moved from Attendance.py)
# ============================================================================
IDENTITY_CHECK_INTERVAL = float(os.getenv("IDENTITY_CHECK_INTERVAL", "3.0"))    # Check every 3 seconds (matches frontend frame interval)
IDENTITY_UNKNOWN_THRESHOLD = int(os.getenv("IDENTITY_UNKNOWN_THRESHOLD", "5"))   # 5 consecutive sec = 1 warning
IDENTITY_MAX_WARNINGS = int(os.getenv("IDENTITY_MAX_WARNINGS", "3"))             # 3 warnings = removal
IDENTITY_REMOVAL_PENALTY = float(os.getenv("IDENTITY_REMOVAL_PENALTY", "1.0"))   # -1% per removal

logger.info(f"Identity Check Interval: {IDENTITY_CHECK_INTERVAL}s")
logger.info(f"Identity Unknown Threshold: {IDENTITY_UNKNOWN_THRESHOLD}s")
logger.info(f"Identity Max Warnings: {IDENTITY_MAX_WARNINGS}")
logger.info(f"Identity Removal Penalty: {IDENTITY_REMOVAL_PENALTY}%")

# ============================================================================
# IN-MEMORY IDENTITY TRACKING STATE (per user per meeting)
# ============================================================================
# Key: "meeting_id:user_id" -> tracking dict
identity_tracking = {}

import time as time_module

def get_identity_state(meeting_id, user_id):
    """Get or create identity tracking state for a user in a meeting"""
    key = f"{meeting_id}:{user_id}"
    if key not in identity_tracking:
        identity_tracking[key] = {
            "consecutive_unknown_seconds": 0,
            "total_unknown_seconds": 0,
            "current_cycle_warnings": 0,       # 0-3, resets after removal
            "total_warnings_issued": 0,         # cumulative: 1,2,3,4,5,6...
            "removal_count": 0,
            "is_removed": False,
            "can_rejoin": True,
            "last_check_time": 0.0,
            "attendance_penalty": 0.0,
            "warnings": [],                     # warning history
        }
    return identity_tracking[key]

def reset_identity_state(meeting_id, user_id):
    """Reset identity state when user rejoins after removal"""
    state = get_identity_state(meeting_id, user_id)
    state["consecutive_unknown_seconds"] = 0
    state["current_cycle_warnings"] = 0
    state["is_removed"] = False
    state["can_rejoin"] = True
    return state

def check_identity_with_tracking(meeting_id, user_id, is_verified, similarity):
    """
    Full identity tracking logic (moved from Attendance.py check_identity_verification).
    
    Handles:
    - 5-second consecutive unknown counter
    - Warning system (1/3, 2/3, 3/3)
    - -1% penalty on removal
    - Cycle reset after removal
    
    Returns:
        dict: Complete identity result with popup, warnings, removal status
    """
    current_time = time_module.time()
    state = get_identity_state(meeting_id, user_id)
    
    # Check interval (1 second between checks)
    time_since_last = current_time - state["last_check_time"]
    if time_since_last < IDENTITY_CHECK_INTERVAL:
        return None  # Too soon, skip
    
    state["last_check_time"] = current_time
    
    # ================================================================
    # CASE A: VERIFIED (face matches)
    # ================================================================
    if is_verified:
        if state["consecutive_unknown_seconds"] > 0:
            logger.info(f"Identity VERIFIED for {user_id} - resetting consecutive counter from {state['consecutive_unknown_seconds']}s to 0")
        state["consecutive_unknown_seconds"] = 0
        
        return {
            "identity_verified": True,
            "identity_similarity": round(similarity, 4),
            "identity_warning_count": state["current_cycle_warnings"],
            "identity_consecutive_unknown": 0,
            "identity_popup": None,
            "identity_action": None,
            "identity_is_removed": False,
            "identity_removal_count": state["removal_count"],
            "identity_attendance_penalty": state["attendance_penalty"],
            "identity_total_warnings": state["total_warnings_issued"],
        }
    
    # ================================================================
    # CASE B: NOT VERIFIED (unknown person)
    # ================================================================
    state["consecutive_unknown_seconds"] += 1
    state["total_unknown_seconds"] += 1
    consecutive = state["consecutive_unknown_seconds"]
    
    logger.warning(
        f"UNKNOWN person detected | User: {user_id} | "
        f"Consecutive: {consecutive}/{IDENTITY_UNKNOWN_THRESHOLD}s | "
        f"Cycle warnings: {state['current_cycle_warnings']}/{IDENTITY_MAX_WARNINGS}"
    )
    
    # ================================================================
    # Check if threshold reached (5 seconds unknown = 1 warning)
    # ================================================================
    if consecutive >= IDENTITY_UNKNOWN_THRESHOLD:
        # Reset consecutive counter
        state["consecutive_unknown_seconds"] = 0
        
        # Increment warnings
        state["current_cycle_warnings"] += 1
        state["total_warnings_issued"] += 1
        cycle_warning = state["current_cycle_warnings"]
        total_warning = state["total_warnings_issued"]
        
        # Add to warning history
        state["warnings"].append({
            "warning_number": cycle_warning,
            "total_number": total_warning,
            "timestamp": current_time,
            "similarity": similarity,
        })
        
        # Determine popup and action
        popup_message = None
        action = None
        
        if cycle_warning == 1:
            popup_message = (
                f"Warning 1/{IDENTITY_MAX_WARNINGS}: Unknown person detected for "
                f"{IDENTITY_UNKNOWN_THRESHOLD} seconds. Please ensure the registered "
                f"participant is visible."
            )
            action = "identity_warning_1"
            logger.warning(f"IDENTITY WARNING 1/{IDENTITY_MAX_WARNINGS} for {user_id} (Total: #{total_warning})")
            
        elif cycle_warning == 2:
            popup_message = (
                f"Warning 2/{IDENTITY_MAX_WARNINGS}: Identity verification failed again. "
                f"ONE MORE failure will remove you from the meeting!"
            )
            action = "identity_warning_2"
            logger.error(f"IDENTITY WARNING 2/{IDENTITY_MAX_WARNINGS} for {user_id} (Total: #{total_warning}) - CRITICAL")
            
        elif cycle_warning >= IDENTITY_MAX_WARNINGS:
            # REMOVAL
            state["removal_count"] += 1
            state["is_removed"] = True
            state["can_rejoin"] = True
            state["current_cycle_warnings"] = 0  # Reset for next cycle
            state["attendance_penalty"] += IDENTITY_REMOVAL_PENALTY
            
            popup_message = (
                f"You have been removed from the meeting due to identity "
                f"verification failure ({IDENTITY_MAX_WARNINGS} warnings). "
                f"You can rejoin after correcting the issue. "
                f"Penalty: -{IDENTITY_REMOVAL_PENALTY}%"
            )
            action = "identity_removal"
            
            logger.critical(
                f"USER REMOVED - Identity Verification Failed | "
                f"User: {user_id} | Removal #{state['removal_count']} | "
                f"Penalty: {state['attendance_penalty']}%"
            )
        
        return {
            "identity_verified": False,
            "identity_similarity": round(similarity, 4),
            "identity_warning_count": cycle_warning,
            "identity_consecutive_unknown": 0,
            "identity_popup": popup_message,
            "identity_action": action,
            "identity_is_removed": state["is_removed"],
            "identity_removal_count": state["removal_count"],
            "identity_attendance_penalty": state["attendance_penalty"],
            "identity_total_warnings": total_warning,
            "identity_can_rejoin": state["can_rejoin"],
        }
    
    else:
        # Threshold not reached yet - still accumulating
        remaining = IDENTITY_UNKNOWN_THRESHOLD - consecutive
        
        return {
            "identity_verified": False,
            "identity_similarity": round(similarity, 4),
            "identity_warning_count": state["current_cycle_warnings"],
            "identity_consecutive_unknown": consecutive,
            "identity_popup": None,  # No popup until threshold
            "identity_action": None,
            "identity_is_removed": state["is_removed"],
            "identity_removal_count": state["removal_count"],
            "identity_attendance_penalty": state["attendance_penalty"],
            "identity_total_warnings": state["total_warnings_issued"],
        }



# ---------------------------------------------------------------------
# Face Model - Singleton Pattern
# ---------------------------------------------------------------------
# ---------------------------------------------------------------------
# Face Model - Singleton Pattern
# ---------------------------------------------------------------------
class FaceModel:
    """Singleton class for InsightFace model management"""
    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FaceModel, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not self._initialized:
            logger.info(f"ðŸ”¹ Initializing InsightFace model: {FACE_MODEL_NAME}...")
            try:
                # Get INSIGHTFACE_HOME from environment
                insightface_root = os.environ.get('INSIGHTFACE_HOME', '/tmp/.insightface')
                logger.info(f"ðŸ”¹ Using InsightFace root directory: {insightface_root}")
                
                self.app = FaceAnalysis(
                    name=FACE_MODEL_NAME,
                    root=insightface_root,  # â† ADD THIS
                    providers=['CUDAExecutionProvider', 'CPUExecutionProvider']  # GPU first, CPU fallback
                )
                self.app.prepare(ctx_id=0, det_size=FACE_DETECTION_SIZE)  # ctx_id=0 for GPU
                self._initialized = True
                logger.info("âœ… InsightFace model loaded successfully")
            except Exception as e:
                logger.error(f"âŒ Failed to initialize InsightFace model: {e}")
                raise

    def extract_embedding(self, image_data, return_all_faces=False):
        """
        Extract face embedding from image data
        
        NEW: Enhanced with multi-face detection for single participant enforcement
        
        Args:
            image_data: Image data (bytes, file, numpy array, base64)
            return_all_faces: If True, return ALL faces detected (for multi-face check)
        
        Returns:
            If return_all_faces=False (default):
                - list: Single embedding (largest face only)
            
            If return_all_faces=True:
                - dict: {
                    'face_count': int,
                    'faces': [list of face dicts],
                    'primary_embedding': list,
                    'primary_face': dict
                }
        """
        try:
            if hasattr(image_data, 'read'):
                image_data = image_data.read()
            
            if isinstance(image_data, bytes):
                img = Image.open(BytesIO(image_data)).convert("RGB")
                np_img = np.array(img)
            elif isinstance(image_data, np.ndarray):
                np_img = image_data
            elif isinstance(image_data, str):
                # Handle base64 encoded images
                if image_data.startswith('data:image'):
                    image_data = image_data.split(',')[1]
                img_bytes = base64.b64decode(image_data)
                img = Image.open(BytesIO(img_bytes)).convert("RGB")
                np_img = np.array(img)
            else:
                raise ValueError("Invalid image data type")
            
            # Detect all faces in image
            faces = self.app.get(np_img)
            
            if not faces:
                raise ValueError("No face detected in the image. Please ensure your face is clearly visible and well-lit.")
            
            face_count = len(faces)
            
            # ================================================================
            # NEW: Return ALL faces information if requested
            # ================================================================
            if return_all_faces:
                face_list = []
                
                for idx, face in enumerate(faces):
                    bbox = face.bbox.tolist()
                    bbox_area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
                    
                    face_info = {
                        'index': idx,
                        'embedding': face.embedding.tolist(),
                        'bbox': bbox,
                        'bbox_area': bbox_area,
                        'det_score': float(face.det_score),
                        'age': int(face.age) if hasattr(face, 'age') else None,
                        'gender': 'male' if hasattr(face, 'gender') and face.gender == 1 else 'female' if hasattr(face, 'gender') and face.gender == 0 else None
                    }
                    face_list.append(face_info)
                
                # Sort by bbox area (largest first)
                face_list.sort(key=lambda x: x['bbox_area'], reverse=True)
                
                logger.info(f"âœ… Detected {face_count} face(s) in image")
                
                return {
                    'face_count': face_count,
                    'faces': face_list,
                    'primary_embedding': face_list[0]['embedding'],
                    'primary_face': face_list[0]
                }
            
            # ================================================================
            # ORIGINAL: Return largest face embedding only
            # ================================================================
            if face_count > 1:
                logger.warning(f"âš ï¸ Multiple faces detected ({face_count}). Using the largest face.")
            
            # Use largest face (by bounding box area)
            largest_face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
            embedding = largest_face.embedding.tolist()
            
            logger.debug(f"âœ… Embedding extracted (dimension: {len(embedding)})")
            
            return embedding
            
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"âŒ Error extracting embedding: {e}")
            raise ValueError(f"Failed to process image: {str(e)}")


face_model = FaceModel()     
# ---------------------------------------------------------------------
# Utility Functions
# ---------------------------------------------------------------------
def cosine_distance(vec1, vec2):
    """Calculate cosine distance between two vectors"""
    try:
        v1 = np.array(vec1, dtype=np.float32)
        v2 = np.array(vec2, dtype=np.float32)
        
        if len(v1) != len(v2):
            raise ValueError(f"Embedding dimension mismatch: {len(v1)} vs {len(v2)}")
        
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        
        if norm1 == 0 or norm2 == 0:
            raise ValueError("Zero vector detected in embedding")
        
        cosine_sim = np.dot(v1, v2) / (norm1 * norm2)
        distance = 1 - cosine_sim
        
        return float(distance)
        
    except Exception as e:
        logger.error(f"âŒ Error calculating cosine distance: {e}")
        raise

# ---------------------------------------------------------------------
# Database Helper Functions
# ---------------------------------------------------------------------
def get_user_embedding(user_id):
    """Fetch stored face embedding from MongoDB"""
    try:
        record = db[FACE_EMBEDDINGS_COLLECTION].find_one({"user_id": str(user_id)})
        
        if not record:
            try:
                record = db[FACE_EMBEDDINGS_COLLECTION].find_one({"user_id": int(user_id)})
            except (ValueError, TypeError):
                pass
        
        if not record:
            logger.warning(f"âš ï¸ No embedding found for user_id: {user_id}")
            return None
        
        if "embedding" not in record or not record["embedding"]:
            logger.error(f"âŒ Record found but no valid 'embedding' field for user_id: {user_id}")
            return None
        
        if not isinstance(record["embedding"], list) or len(record["embedding"]) == 0:
            logger.error(f"âŒ Invalid embedding format for user_id: {user_id}")
            return None
        
        logger.debug(f"âœ… Retrieved embedding for user_id: {user_id} (dimension: {len(record['embedding'])})")
        return record
        
    except Exception as e:
        logger.error(f"âŒ Error fetching embedding for user_id {user_id}: {e}")
        return None

def log_verification_attempt(user_id, distance, allowed, confidence, error=None, metadata=None):
    """Log verification attempt to MongoDB"""
    try:
        log_entry = {
            "user_id": str(user_id),
            "distance": float(distance) if distance is not None else None,
            "threshold": FACE_DISTANCE_THRESHOLD,
            "allowed": allowed,
            "confidence": float(confidence) if confidence is not None else None,
            "error": error,
            "metadata": metadata or {},
            "timestamp": datetime.utcnow(),
            "server_info": {
                "host": MONGO_HOST,
                "model": FACE_MODEL_NAME,
                "protocol": SERVER_PROTOCOL,
                "port": SERVER_PORT,
            }
        }
        db[VERIFICATION_LOGS_COLLECTION].insert_one(log_entry)
        logger.debug(f"ðŸ“ Logged verification attempt for user_id: {user_id}")
    except Exception as e:
        logger.error(f"âŒ Failed to log verification attempt: {e}")

# ---------------------------------------------------------------------
# Camera State Detection Functions (NEW)
# ---------------------------------------------------------------------
def detect_camera_state_change(session_doc, current_frame_data):
    """
    Automatically detect when camera is disabled/enabled based on frame data.
    
    Logic:
    - If frames stop coming for >3 seconds â†’ Camera disabled
    - If frames resume after gap â†’ Camera re-enabled â†’ Trigger verification
    
    Args:
        session_doc: Current session document
        current_frame_data: Current frame (None if camera disabled)
    
    Returns:
        dict: {
            "state_changed": bool,
            "new_state": "enabled" | "disabled",
            "should_reverify": bool
        }
    """
    now = datetime.utcnow()
    
    # Get last frame timestamp
    last_frame_time = session_doc.get("last_frame_timestamp")
    previous_state = session_doc.get("camera_state", "unknown")
    
    # Determine current state based on frame data
    if current_frame_data is None or not current_frame_data:
        current_state = "disabled"
    else:
        current_state = "enabled"
    
    # Check for frame gap (camera was disabled)
    if last_frame_time:
        time_since_last_frame = (now - last_frame_time).total_seconds()
        frame_gap_detected = time_since_last_frame > CAMERA_FRAME_GAP_THRESHOLD
    else:
        frame_gap_detected = False
    
    # Detect state change
    state_changed = previous_state != current_state
    
    # Determine if re-verification needed
    should_reverify = False
    
    if state_changed:
        # Camera state changed
        if previous_state == "disabled" and current_state == "enabled":
            # Camera was OFF, now ON â†’ TRIGGER RE-VERIFICATION
            logger.info(f"ðŸŽ¥ Camera re-enabled detected for session {session_doc['_id']}")
            should_reverify = True
        elif previous_state == "enabled" and current_state == "disabled":
            # Camera was ON, now OFF
            logger.info(f"ðŸ“´ Camera disabled detected for session {session_doc['_id']}")
    
    elif frame_gap_detected and current_state == "enabled":
        # No explicit state change but gap detected and now enabled
        # This means camera was temporarily off
        logger.info(f"ðŸ”„ Frame gap detected - camera likely toggled for session {session_doc['_id']}")
        should_reverify = True
    
    return {
        "state_changed": state_changed,
        "new_state": current_state,
        "previous_state": previous_state,
        "should_reverify": should_reverify,
        "frame_gap_detected": frame_gap_detected,
        "time_since_last_frame": (now - last_frame_time).total_seconds() if last_frame_time else None
    }


def update_camera_state_in_session(session_id, state_info, frame_data):
    """
    Update camera state tracking in session document.
    
    Args:
        session_id: Session ID
        state_info: State change info from detect_camera_state_change()
        frame_data: Current frame data
    """
    now = datetime.utcnow()
    
    update_data = {
        "camera_state": state_info["new_state"],
        "last_frame_timestamp": now if frame_data else None,
        "frame_gap_detected": state_info["frame_gap_detected"],
        "pending_reverification": state_info["should_reverify"]
    }
    
    if state_info["new_state"] == "enabled":
        update_data["last_camera_enabled_time"] = now
    elif state_info["new_state"] == "disabled":
        update_data["last_camera_disabled_time"] = now
    
    # Add to state history
    db[VERIFICATION_SESSIONS_COLLECTION].update_one(
        {"_id": ObjectId(session_id)},
        {
            "$set": update_data,
            "$push": {
                "camera_state_history": {
                    "$each": [{
                        "state": state_info["new_state"],
                        "timestamp": now,
                        "frame_received": frame_data is not None,
                        "time_since_last_frame": state_info.get("time_since_last_frame")
                    }],
                    "$slice": -50  # Keep last 50 state changes
                }
            }
        }
    )
    
    logger.debug(f"Updated camera state to '{state_info['new_state']}' for session {session_id}")


# ---------------------------------------------------------------------
# Verification Session Management
# ---------------------------------------------------------------------
def create_verification_session(user_id, room_name, initial_verification=True):
    """Create a new verification session with camera state tracking"""
    try:
        session_doc = {
            "user_id": str(user_id),
            "room_name": room_name,
            "session_start": datetime.utcnow(),
            "last_verification": datetime.utcnow(),
            "verification_count": 1 if initial_verification else 0,
            "violations": [],
            "status": "active",
            "created_at": datetime.utcnow(),
            
            # Camera state tracking fields
            "camera_state": "enabled",
            "last_camera_enabled_time": datetime.utcnow(),
            "last_camera_disabled_time": None,
            "camera_state_history": [{
                "state": "enabled",
                "timestamp": datetime.utcnow(),
                "frame_received": True,
                "time_since_last_frame": 0
            }],
            "pending_reverification": False,
            "last_frame_timestamp": datetime.utcnow(),
            "frame_gap_detected": False
        }
        
        result = db[VERIFICATION_SESSIONS_COLLECTION].insert_one(session_doc)
        session_id = str(result.inserted_id)
        
        logger.info(f"ðŸ“ Created verification session {session_id} for user {user_id} in room {room_name}")
        return session_id
        
    except Exception as e:
        logger.error(f"âŒ Failed to create verification session: {e}")
        return None

def update_verification_session(session_id, verification_result, violation=None):
    """Update verification session with new verification attempt"""
    try:
        update_data = {
            "last_verification": datetime.utcnow(),
        }
        
        # Increment verification count
        db[VERIFICATION_SESSIONS_COLLECTION].update_one(
            {"_id": ObjectId(session_id)},
            {"$inc": {"verification_count": 1}}
        )
        
        if violation:
            violation_entry = {
                "timestamp": datetime.utcnow(),
                "reason": violation.get("reason"),
                "distance": violation.get("distance"),
                "confidence": violation.get("confidence"),
                "action_taken": violation.get("action", "warning"),
                "type": violation.get("type", "verification_failed")
            }
            
            # Add violation to array
            db[VERIFICATION_SESSIONS_COLLECTION].update_one(
                {"_id": ObjectId(session_id)},
                {"$push": {"violations": violation_entry}}
            )
            
            # Check violation count
            session = db[VERIFICATION_SESSIONS_COLLECTION].find_one({"_id": ObjectId(session_id)})
            if len(session.get("violations", [])) >= 3:
                update_data["status"] = "suspended"
        
        db[VERIFICATION_SESSIONS_COLLECTION].update_one(
            {"_id": ObjectId(session_id)},
            {"$set": update_data}
        )
        
        logger.info(f"âœ… Updated verification session {session_id}")
        
    except Exception as e:
        logger.error(f"âŒ Error updating verification session: {e}")

def end_verification_session(session_id):
    """End verification session"""
    try:
        db[VERIFICATION_SESSIONS_COLLECTION].update_one(
            {"_id": ObjectId(session_id)},
            {
                "$set": {
                    "session_end": datetime.utcnow(),
                    "status": "completed"
                }
            }
        )
        logger.info(f"âœ… Ended verification session {session_id}")
        return True
        
    except Exception as e:
        logger.error(f"âŒ Error ending verification session: {e}")
        return False

def get_session_status(session_id):
    """Get session status"""
    try:
        session = db[VERIFICATION_SESSIONS_COLLECTION].find_one({"_id": ObjectId(session_id)})
        
        if not session:
            return None
        
        return {
            "session_id": str(session["_id"]),
            "user_id": session["user_id"],
            "room_name": session["room_name"],
            "status": session["status"],
            "verification_count": session.get("verification_count", 0),
            "violations": len(session.get("violations", [])),
            "camera_state": session.get("camera_state", "unknown"),
            "last_verification": session.get("last_verification"),
            "session_start": session.get("session_start"),
            "pending_reverification": session.get("pending_reverification", False)
        }
        
    except Exception as e:
        logger.error(f"âŒ Error getting session status: {e}")
        return None

# ---------------------------------------------------------------------
# API Views
# ---------------------------------------------------------------------
# ---------------------------------------------------------------------
# API Views
# ---------------------------------------------------------------------
class VerifyFace(APIView):
    """Initial face verification endpoint with SINGLE PARTICIPANT ENFORCEMENT"""
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        user_id = None
        start_time = datetime.utcnow()
        
        try:
            user_id = request.data.get("user_id")
            image_file = request.FILES.get("image")
            
            logger.info(f"{'='*80}")
            logger.info(f"ðŸ” WAITING ROOM VERIFICATION - User ID: {user_id} | Port: {SERVER_PORT}")
            logger.info(f"{'='*80}")
            
            if not user_id:
                return JsonResponse({
                    "allowed": False,
                    "error": "user_id is required",
                    "error_code": "MISSING_USER_ID",
                    "protocol": SERVER_PROTOCOL,
                    "port": int(SERVER_PORT)
                }, status=400)
            
            if not image_file:
                return JsonResponse({
                    "allowed": False,
                    "error": "image file is required",
                    "error_code": "MISSING_IMAGE",
                    "protocol": SERVER_PROTOCOL,
                    "port": int(SERVER_PORT)
                }, status=400)
            
            # Validate image type
            allowed_types = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
            if image_file.content_type not in allowed_types:
                error_msg = f"Invalid image type '{image_file.content_type}'. Allowed: JPEG, PNG, WEBP"
                return JsonResponse({
                    "allowed": False,
                    "error": error_msg,
                    "error_code": "INVALID_IMAGE_TYPE",
                    "protocol": SERVER_PROTOCOL,
                    "port": int(SERVER_PORT)
                }, status=400)
            
            # Validate image size
            max_size = 10 * 1024 * 1024
            if image_file.size > max_size:
                error_msg = f"Image size ({image_file.size / 1024 / 1024:.2f}MB) exceeds 10MB limit"
                return JsonResponse({
                    "allowed": False,
                    "error": error_msg,
                    "error_code": "IMAGE_TOO_LARGE",
                    "protocol": SERVER_PROTOCOL,
                    "port": int(SERVER_PORT)
                }, status=400)
            
            # Get stored embedding
            user_record = get_user_embedding(user_id)
            
            if user_record is None:
                error_msg = f"User '{user_id}' not found. Please register first."
                return JsonResponse({
                    "allowed": False,
                    "error": error_msg,
                    "error_code": "USER_NOT_FOUND",
                    "protocol": SERVER_PROTOCOL,
                    "port": int(SERVER_PORT)
                }, status=404)
            
            stored_embedding = user_record["embedding"]
            
            if not user_record.get("is_active", True):
                error_msg = f"User '{user_id}' is deactivated"
                return JsonResponse({
                    "allowed": False,
                    "error": error_msg,
                    "error_code": "USER_DEACTIVATED",
                    "protocol": SERVER_PROTOCOL,
                    "port": int(SERVER_PORT)
                }, status=403)
            
            # ================================================================
            # NEW: MULTI-FACE DETECTION - SINGLE PARTICIPANT ENFORCEMENT
            # ================================================================
            try:
                logger.info("ðŸ” Detecting faces in frame...")
                
                # Extract ALL faces from image
                face_detection_result = face_model.extract_embedding(
                    image_file, 
                    return_all_faces=True
                )
                
                face_count = face_detection_result['face_count']
                primary_face = face_detection_result['primary_face']
                live_embedding = face_detection_result['primary_embedding']
                
                logger.info(f"ðŸ“Š Face Detection Results:")
                logger.info(f"   Detected Faces: {face_count}")
                logger.info(f"   Primary Face Score: {primary_face['det_score']:.3f}")
                
                # ============================================================
                # NEW: CHECK FOR MULTIPLE PEOPLE - ENFORCE SINGLE PARTICIPANT
                # ============================================================
                if not ALLOW_MULTIPLE_FACES and face_count > MAX_ALLOWED_FACES:
                    logger.error(
                        f"\n{'='*80}\n"
                        f"ðŸš« MULTIPLE PEOPLE DETECTED - ACCESS DENIED\n"
                        f"{'='*80}\n"
                        f"User ID: {user_id}\n"
                        f"Detected Faces: {face_count}\n"
                        f"Maximum Allowed: {MAX_ALLOWED_FACES}\n"
                        f"Status: VERIFICATION REJECTED\n"
                        f"Reason: Single participant policy violation\n"
                        f"{'='*80}\n"
                    )
                    
                    # Log the multi-face rejection
                    log_verification_attempt(
                        user_id,
                        None,
                        False,
                        None,
                        error=f"Multiple people detected: {face_count} faces",
                        metadata={
                            "verification_type": "waiting_room",
                            "rejection_reason": "multiple_faces",
                            "face_count": face_count,
                            "max_allowed": MAX_ALLOWED_FACES,
                            "detected_faces": [
                                {
                                    'index': f['index'],
                                    'det_score': f['det_score'],
                                    'bbox_area': f['bbox_area']
                                }
                                for f in face_detection_result['faces']
                            ],
                            "image_size": image_file.size,
                            "image_type": image_file.content_type
                        }
                    )
                    
                    # ========================================================
                    # RETURN: Multi-Face Rejection Response with Popup Data
                    # ========================================================
                    return JsonResponse({
                        "allowed": False,
                        "error": MULTI_FACE_ERROR_MESSAGE,
                        "error_code": "MULTIPLE_FACES_DETECTED",
                        "face_count": face_count,
                        "max_allowed_faces": MAX_ALLOWED_FACES,
                        
                        # Detailed information
                        "details": {
                            "detected_faces": face_count,
                            "allowed_faces": MAX_ALLOWED_FACES,
                            "message": "Only the registered participant should be visible in the camera frame.",
                            "action_required": "Please ensure you are alone in front of the camera and try again.",
                            "policy": "Single participant policy enforced"
                        },
                        
                        # Frontend popup configuration
                        "show_popup": True,
                        "popup_title": "Multiple People Detected",
                        "popup_message": MULTI_FACE_ERROR_MESSAGE,
                        "popup_type": "error",
                        "popup_icon": "ðŸš«",
                        "popup_action": "retry",
                        "popup_instructions": [
                            "Ensure only you are visible in the camera",
                            "Remove other people from the frame",
                            "Position yourself in good lighting",
                            "Look directly at the camera",
                            "Try again when alone"
                        ],
                        
                        # Status and metadata
                        "status": "REJECTED",
                        "reason": "multiple_people_policy_violation",
                        "timestamp": datetime.utcnow().isoformat(),
                        "protocol": SERVER_PROTOCOL,
                        "port": int(SERVER_PORT)
                    }, status=403)
                
                # ============================================================
                # STEP: Single Face Detected - Proceed with Verification
                # ============================================================
                logger.info(f"âœ… Single face detected - proceeding with face matching")
                
            except ValueError as ve:
                # No face detected or other extraction error
                error_msg = str(ve)
                log_verification_attempt(user_id, None, False, None, error=error_msg)
                return JsonResponse({
                    "allowed": False,
                    "error": error_msg,
                    "error_code": "NO_FACE_DETECTED",
                    "protocol": SERVER_PROTOCOL,
                    "port": int(SERVER_PORT)
                }, status=400)
            
            # ================================================================
            # ORIGINAL: Face Matching with Stored Embedding
            # ================================================================
            try:
                distance = cosine_distance(stored_embedding, live_embedding)
                allowed = distance < FACE_DISTANCE_THRESHOLD
                confidence = max(0, min(100, (1 - distance) * 100))
                processing_time = (datetime.utcnow() - start_time).total_seconds()
                
                if distance < 0.3:
                    match_quality = "EXCELLENT"
                elif distance < 0.5:
                    match_quality = "GOOD"
                elif distance < FACE_DISTANCE_THRESHOLD:
                    match_quality = "ACCEPTABLE"
                else:
                    match_quality = "POOR"
                
                logger.info(f"{'='*80}")
                logger.info(f"ðŸ“Š VERIFICATION RESULTS:")
                logger.info(f"   User ID: {user_id}")
                logger.info(f"   Face Count: {face_count} (âœ… Single Participant)")
                logger.info(f"   Distance: {distance:.4f}")
                logger.info(f"   Threshold: {FACE_DISTANCE_THRESHOLD}")
                logger.info(f"   Match: {'âœ… YES' if allowed else 'âŒ NO'}")
                logger.info(f"   Confidence: {confidence:.2f}%")
                logger.info(f"   Match Quality: {match_quality}")
                logger.info(f"   Processing Time: {processing_time:.3f}s")
                logger.info(f"{'='*80}")
                
                # Log verification attempt
                log_verification_attempt(
                    user_id,
                    distance,
                    allowed,
                    confidence,
                    metadata={
                        "processing_time": processing_time,
                        "image_size": image_file.size,
                        "image_type": image_file.content_type,
                        "image_name": image_file.name,
                        "match_quality": match_quality,
                        "verification_type": "waiting_room",
                        "face_count": face_count,
                        "multi_face_check": "passed",
                        "single_participant_enforcement": True,
                        "primary_face_score": primary_face['det_score'],
                        "protocol": SERVER_PROTOCOL,
                        "port": SERVER_PORT,
                    }
                )
                
                # Prepare response
                response_data = {
                    "allowed": allowed,
                    "user_id": str(user_id),
                    "distance": round(float(distance), 4),
                    "threshold": FACE_DISTANCE_THRESHOLD,
                    "confidence": round(confidence, 2),
                    "match_quality": match_quality,
                    "processing_time": round(processing_time, 3),
                    "timestamp": datetime.utcnow().isoformat(),
                    "verification_type": "waiting_room",
                    "protocol": SERVER_PROTOCOL,
                    "port": int(SERVER_PORT),
                    
                    # NEW: Multi-face check results
                    "face_count": face_count,
                    "multi_face_check": "passed",
                    "single_participant_confirmed": True,
                    "primary_face_detection_score": round(primary_face['det_score'], 3)
                }
                
                if allowed:
                    response_data["message"] = "âœ… Face verified successfully - Single participant confirmed"
                    response_data["status"] = "VERIFIED"
                else:
                    response_data["message"] = "âŒ Face verification failed - No match found"
                    response_data["status"] = "NOT_VERIFIED"
                
                return JsonResponse(response_data, status=200)
                
            except Exception as e:
                error_msg = "Failed to compare face embeddings"
                logger.error(f"âŒ {error_msg}: {e}")
                return JsonResponse({
                    "allowed": False,
                    "error": error_msg,
                    "error_code": "COMPARISON_FAILED",
                    "protocol": SERVER_PROTOCOL,
                    "port": int(SERVER_PORT)
                }, status=500)
            
        except Exception as e:
            error_msg = "Internal server error during verification"
            logger.error(f"âŒ Unexpected error: {e}", exc_info=True)
            return JsonResponse({
                "allowed": False,
                "error": error_msg,
                "error_code": "INTERNAL_SERVER_ERROR",
                "protocol": SERVER_PROTOCOL,
                "port": int(SERVER_PORT)
            }, status=500)


class ContinuousVerifyFace(APIView):
    """Manual continuous face verification endpoint"""
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        user_id = None
        session_id = None
        start_time = datetime.utcnow()
        
        try:
            user_id = request.data.get("user_id")
            session_id = request.data.get("session_id")
            room_name = request.data.get("room_name")
            image_file = request.FILES.get("image")
            
            logger.info(f"{'='*80}")
            logger.info(f"ðŸ”„ MANUAL CONTINUOUS VERIFICATION - User: {user_id} | Session: {session_id}")
            logger.info(f"{'='*80}")
            
            if not user_id or not session_id or not room_name:
                return JsonResponse({
                    "allowed": False,
                    "error": "user_id, session_id, and room_name are required",
                    "error_code": "MISSING_PARAMETERS",
                    "action": "kick"
                }, status=400)
            
            if not image_file:
                violation = {
                    "reason": "No image provided for verification",
                    "action": "kick",
                    "type": "missing_image"
                }
                update_verification_session(session_id, None, violation)
                
                return JsonResponse({
                    "allowed": False,
                    "error": "image file is required",
                    "error_code": "MISSING_IMAGE",
                    "action": "kick"
                }, status=400)
            
            session_doc = db[VERIFICATION_SESSIONS_COLLECTION].find_one({
                "_id": ObjectId(session_id),
                "user_id": str(user_id),
                "status": "active"
            })
            
            if not session_doc:
                logger.error(f"âŒ Invalid or inactive session {session_id}")
                return JsonResponse({
                    "allowed": False,
                    "error": "Invalid or inactive verification session",
                    "error_code": "INVALID_SESSION",
                    "action": "kick"
                }, status=403)
            
            violations_count = len(session_doc.get("violations", []))
            if violations_count >= 3:
                logger.warning(f"âš ï¸ Session {session_id} has {violations_count} violations - auto-kick")
                return JsonResponse({
                    "allowed": False,
                    "error": "Too many verification violations",
                    "error_code": "TOO_MANY_VIOLATIONS",
                    "action": "kick",
                    "violations": violations_count
                }, status=403)
            
            user_record = get_user_embedding(user_id)
            
            if user_record is None:
                violation = {
                    "reason": "User not registered",
                    "action": "kick",
                    "type": "user_not_found"
                }
                update_verification_session(session_id, None, violation)
                
                return JsonResponse({
                    "allowed": False,
                    "error": f"User '{user_id}' not found. Please register first.",
                    "error_code": "USER_NOT_FOUND",
                    "action": "kick"
                }, status=404)
            
            stored_embedding = user_record["embedding"]
            
            try:
                logger.info(f"ðŸ“¸ Extracting face embedding for manual continuous verification...")
                live_embedding = face_model.extract_embedding(image_file)
                logger.info(f"âœ… Live embedding extracted successfully")
                
            except ValueError as ve:
                violation = {
                    "reason": str(ve),
                    "action": "warn" if violations_count < 2 else "kick",
                    "type": "no_face_detected"
                }
                update_verification_session(session_id, None, violation)
                
                return JsonResponse({
                    "allowed": False,
                    "error": str(ve),
                    "error_code": "NO_FACE_DETECTED",
                    "action": violation["action"],
                    "violations": violations_count + 1
                }, status=400)
                
            try:
                distance = cosine_distance(stored_embedding, live_embedding)
                allowed = distance < FACE_DISTANCE_THRESHOLD
                confidence = max(0, min(100, (1 - distance) * 100))
                processing_time = (datetime.utcnow() - start_time).total_seconds()
                
                if allowed:
                    action = "allow"
                    message = "âœ… Continuous verification successful"
                else:
                    violations_count += 1
                    if violations_count >= 3:
                        action = "kick"
                        message = "âŒ Face verification failed - User will be removed"
                    elif violations_count >= 2:
                        action = "warn"
                        message = "âš ï¸ Face verification failed - Final warning"
                    else:
                        action = "warn"
                        message = "âš ï¸ Face verification failed - Warning"
                    
                    violation = {
                        "reason": "Face mismatch",
                        "distance": distance,
                        "confidence": confidence,
                        "threshold": FACE_DISTANCE_THRESHOLD,
                        "action": action,
                        "type": "face_mismatch"
                    }
                    update_verification_session(session_id, {"allowed": False, "distance": distance}, violation)
                
                if allowed:
                    update_verification_session(session_id, {"allowed": True, "distance": distance})
                
                logger.info(f"ðŸ“Š Manual Continuous Verification: {'âœ… PASS' if allowed else 'âŒ FAIL'}")
                logger.info(f"   Distance: {distance:.4f} | Confidence: {confidence:.2f}%")
                logger.info(f"   Action: {action.upper()} | Violations: {violations_count}")
                
                log_verification_attempt(
                    user_id,
                    distance,
                    allowed,
                    confidence,
                    metadata={
                        "verification_type": "continuous_manual",
                        "session_id": session_id,
                        "room_name": room_name,
                        "processing_time": processing_time,
                        "violations_count": violations_count,
                        "action_taken": action
                    }
                )
                
                response_data = {
                    "allowed": allowed,
                    "user_id": str(user_id),
                    "session_id": session_id,
                    "distance": round(float(distance), 4),
                    "threshold": FACE_DISTANCE_THRESHOLD,
                    "confidence": round(confidence, 2),
                    "verification_count": session_doc.get("verification_count", 0) + 1,
                    "violations": violations_count,
                    "action": action,
                    "message": message,
                    "processing_time": round(processing_time, 3),
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                return JsonResponse(response_data, status=200)
                
            except Exception as e:
                logger.error(f"âŒ Comparison error: {e}")
                return JsonResponse({
                    "allowed": False,
                    "error": "Failed to compare face embeddings",
                    "error_code": "COMPARISON_FAILED",
                    "action": "kick"
                }, status=500)
            
        except Exception as e:
            logger.error(f"âŒ Unexpected error: {e}", exc_info=True)
            return JsonResponse({
                "allowed": False,
                "error": "Internal server error during continuous verification",
                "error_code": "INTERNAL_SERVER_ERROR",
                "action": "kick"
            }, status=500)


# ---------------------------------------------------------------------
# NEW: Enhanced Attendance Detection with Automatic Camera State Monitoring
# ---------------------------------------------------------------------
class EnhancedAttendanceDetection(APIView):
    """
    Enhanced attendance detection with AUTOMATIC camera state tracking.
    Automatically triggers face verification when camera is re-enabled.
    NO FRONTEND CHANGES REQUIRED!
    """
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        user_id = None
        start_time = datetime.utcnow()
        
        try:
            # Get request data
            user_id = request.data.get("user_id")
            meeting_id = request.data.get("meeting_id")
            frame_data = request.data.get("frame")
            camera_enabled = request.data.get("camera_enabled", True)
            is_on_break = request.data.get("is_on_break", False)
            is_break_paused = request.data.get("is_break_paused", False)
            
            logger.info(f"{'='*80}")
            logger.info(f"ðŸ” ATTENDANCE DETECTION - User: {user_id} | Camera: {camera_enabled}")
            logger.info(f"{'='*80}")
            
            # Validate inputs
            if not user_id or not meeting_id:
                return JsonResponse({
                    "allowed": False,
                    "error": "user_id and meeting_id required"
                }, status=400)
            
            # Get or create session
            session = db[VERIFICATION_SESSIONS_COLLECTION].find_one({
                "user_id": str(user_id),
                "room_name": meeting_id,
                "status": "active"
            })
            
            if not session:
                # Create new session
                session_id = create_verification_session(user_id, meeting_id, initial_verification=False)
                session = db[VERIFICATION_SESSIONS_COLLECTION].find_one({"_id": ObjectId(session_id)})
                logger.info(f"ðŸ“ Created new session {session_id} for user {user_id}")
            
            # ================================================================
            # AUTOMATIC CAMERA STATE DETECTION
            # ================================================================
            
            state_info = detect_camera_state_change(session, frame_data)
            
            # Update camera state in session
            update_camera_state_in_session(
                str(session["_id"]),
                state_info,
                frame_data
            )
            
            logger.info(f"ðŸ“¹ Camera State: {state_info['previous_state']} â†’ {state_info['new_state']}")
            if state_info.get("time_since_last_frame"):
                logger.info(f"   Time since last frame: {state_info['time_since_last_frame']:.2f}s")
            
            # ================================================================
            # AUTOMATIC CONTINUOUS FACE VERIFICATION ON CAMERA RE-ENABLE
            # ================================================================
            
            if state_info["should_reverify"]:
                logger.info(f"ðŸ”’ CAMERA RE-ENABLED - Triggering AUTOMATIC face verification!")
                
                # Check if we have frame data
                if not frame_data or not camera_enabled:
                    logger.warning("âš ï¸ Camera re-enabled but no frame data available yet - waiting...")
                    return JsonResponse({
                        "status": "waiting_for_frame",
                        "message": "Camera re-enabled - waiting for video frame",
                        "attendance_percentage": 100,
                        "engagement_score": 100,
                        "violations": [],
                        "session_active": True,
                        "camera_state": state_info["new_state"]
                    })
                
                # Perform automatic face verification
                try:
                    logger.info("ðŸ“¸ Extracting face embedding from frame...")
                    
                    # Extract face embedding
                    live_embedding = face_model.extract_embedding(frame_data)
                    
                    # Get stored embedding
                    user_record = get_user_embedding(user_id)
                    if not user_record:
                        raise ValueError("User not registered")
                    
                    stored_embedding = user_record["embedding"]
                    
                    # Calculate distance
                    distance = cosine_distance(stored_embedding, live_embedding)
                    allowed = distance < FACE_DISTANCE_THRESHOLD
                    confidence = max(0, min(100, (1 - distance) * 100))
                    
                    logger.info(f"{'='*80}")
                    logger.info(f"ðŸ“Š AUTOMATIC FACE VERIFICATION RESULT:")
                    logger.info(f"   Distance: {distance:.4f}")
                    logger.info(f"   Threshold: {FACE_DISTANCE_THRESHOLD}")
                    logger.info(f"   Result: {'âœ… PASS' if allowed else 'âŒ FAIL'}")
                    logger.info(f"   Confidence: {confidence:.2f}%")
                    logger.info(f"{'='*80}")
                    
                    if allowed:
                        # âœ… VERIFICATION PASSED
                        logger.info("âœ… Automatic continuous verification PASSED")
                        
                        # Clear pending reverification
                        db[VERIFICATION_SESSIONS_COLLECTION].update_one(
                            {"_id": session["_id"]},
                            {"$set": {"pending_reverification": False}}
                        )
                        
                        # Log successful verification
                        log_verification_attempt(
                            user_id,
                            distance,
                            True,
                            confidence,
                            metadata={
                                "verification_type": "continuous_automatic",
                                "trigger": "camera_re_enable",
                                "session_id": str(session["_id"]),
                                "meeting_id": meeting_id
                            }
                        )
                        
                        return JsonResponse({
                            "status": "reverification_success",
                            "message": "âœ… Face verified successfully after camera re-enable",
                            "allowed": True,
                            "distance": round(distance, 4),
                            "confidence": round(confidence, 2),
                            "attendance_percentage": 100,
                            "engagement_score": 100,
                            "violations": len(session.get("violations", [])),
                            "session_active": True,
                            "verification_type": "continuous_automatic",
                            "camera_state": state_info["new_state"]
                        })
                    
                    else:
                        # âŒ VERIFICATION FAILED
                        logger.error("âŒ Automatic continuous verification FAILED")
                        
                        # Add violation
                        violation_entry = {
                            "reason": "Face mismatch after camera re-enable (automatic)",
                            "distance": distance,
                            "confidence": confidence,
                            "action": "warning",
                            "type": "continuous_verification_failed_auto"
                        }
                        
                        # Update violations
                        db[VERIFICATION_SESSIONS_COLLECTION].update_one(
                            {"_id": session["_id"]},
                            {
                                "$push": {"violations": violation_entry},
                                "$set": {"pending_reverification": False}
                            }
                        )
                        
                        # Get updated violation count
                        updated_session = db[VERIFICATION_SESSIONS_COLLECTION].find_one(
                            {"_id": session["_id"]}
                        )
                        violation_count = len(updated_session.get("violations", []))
                        
                        logger.warning(f"âš ï¸ Violation count: {violation_count}/3")
                        
                        # Log failed verification
                        log_verification_attempt(
                            user_id,
                            distance,
                            False,
                            confidence,
                            error="Face mismatch",
                            metadata={
                                "verification_type": "continuous_automatic",
                                "trigger": "camera_re_enable",
                                "violation_count": violation_count,
                                "session_id": str(session["_id"]),
                                "meeting_id": meeting_id
                            }
                        )
                        
                        # Determine action
                        if violation_count >= 3:
                            # ðŸš« KICK USER
                            logger.error(f"ðŸš« Maximum violations ({violation_count}/3) reached - KICKING USER")
                            
                            # Update session status
                            db[VERIFICATION_SESSIONS_COLLECTION].update_one(
                                {"_id": session["_id"]},
                                {"$set": {"status": "suspended"}}
                            )
                            
                            return JsonResponse({
                                "status": "session_closed",
                                "message": "âŒ Face verification failed. Maximum violations (3/3) reached. You will be removed from the meeting.",
                                "allowed": False,
                                "action": "kick",
                                "violations": violation_count,
                                "reason": "Face verification failed after camera re-enable",
                                "attendance_percentage": 0,
                                "session_active": False,
                                "camera_state": state_info["new_state"]
                            }, status=403)
                        
                        else:
                            # âš ï¸ WARNING
                            warnings_remaining = 3 - violation_count
                            
                            return JsonResponse({
                                "status": "reverification_failed",
                                "message": f"âš ï¸ Face verification failed after camera re-enable. Warning {violation_count}/3",
                                "allowed": False,
                                "action": "warn",
                                "violations": violation_count,
                                "warnings_remaining": warnings_remaining,
                                "distance": round(distance, 4),
                                "confidence": round(confidence, 2),
                                "attendance_percentage": 100,
                                "engagement_score": 100,
                                "session_active": True,
                                "popup": f"âš ï¸ Face verification failed after camera re-enable. {warnings_remaining} attempts remaining before removal.",
                                "camera_state": state_info["new_state"]
                            })
                
                except Exception as e:
                    logger.error(f"âŒ Automatic verification error: {e}", exc_info=True)
                    
                    # Add violation for error
                    violation_entry = {
                        "reason": f"Verification error: {str(e)}",
                        "action": "warning",
                        "type": "verification_error"
                    }
                    
                    db[VERIFICATION_SESSIONS_COLLECTION].update_one(
                        {"_id": session["_id"]},
                        {"$push": {"violations": violation_entry}}
                    )
                    
                    return JsonResponse({
                        "status": "verification_error",
                        "message": f"Verification error: {str(e)}",
                        "allowed": False,
                        "action": "warn",
                        "attendance_percentage": 100,
                        "session_active": True,
                        "camera_state": state_info["new_state"]
                    })
            
            # ================================================================
            # NORMAL MONITORING (No camera state change)
            # ================================================================
            
            # Skip detection if on break and not paused
            if is_on_break and not is_break_paused:
                return JsonResponse({
                    "status": "on_break",
                    "message": "Detection paused during break",
                    "attendance_percentage": 100,
                    "violations": [],
                    "session_active": True,
                    "camera_state": state_info["new_state"]
                })
            
            # Skip if no frame data
            if not frame_data or not camera_enabled:
                return JsonResponse({
                    "status": "camera_disabled",
                    "message": "Camera disabled - no detection",
                    "attendance_percentage": 100,
                    "violations": [],
                    "session_active": True,
                    "camera_state": state_info["new_state"]
                })
            
            # Normal monitoring response
            return JsonResponse({
                "status": "monitoring",
                "message": "Active monitoring with automatic camera state detection",
                "attendance_percentage": 100,
                "engagement_score": 100,
                "violations": len(session.get("violations", [])),
                "session_active": True,
                "camera_state": state_info["new_state"],
                "pending_reverification": state_info.get("pending_reverification", False)
            })
            
        except Exception as e:
            logger.error(f"âŒ Unexpected error in attendance detection: {e}", exc_info=True)
            return JsonResponse({
                "status": "error",
                "error": str(e),
                "session_active": True
            }, status=500)


# ---------------------------------------------------------------------
# Session Management Endpoints
# ---------------------------------------------------------------------
@api_view(['POST'])
def create_session_endpoint(request):
    """Create verification session"""
    try:
        data = json.loads(request.body)
        user_id = data.get('user_id')
        room_name = data.get('room_name')
        
        if not user_id or not room_name:
            return JsonResponse({
                "error": "user_id and room_name are required"
            }, status=400)
        
        session_id = create_verification_session(user_id, room_name, initial_verification=True)
        
        if session_id:
            return JsonResponse({
                "session_id": session_id,
                "user_id": user_id,
                "room_name": room_name,
                "status": "active",
                "message": "Verification session created successfully with camera state tracking"
            }, status=201)
        else:
            return JsonResponse({
                "error": "Failed to create session"
            }, status=500)
            
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        return JsonResponse({"error": str(e)}, status=500)


@api_view(['POST'])
def end_session_endpoint(request, session_id):
    """End verification session"""
    try:
        success = end_verification_session(session_id)
        
        if success:
            return JsonResponse({
                "message": "Session ended successfully",
                "session_id": session_id
            }, status=200)
        else:
            return JsonResponse({
                "error": "Failed to end session"
            }, status=500)
        
    except Exception as e:
        logger.error(f"Error ending session: {e}")
        return JsonResponse({"error": str(e)}, status=500)


@api_view(['GET'])
def get_session_status_endpoint(request, session_id):
    """Get session status"""
    try:
        status = get_session_status(session_id)
        
        if status:
            return JsonResponse(status, status=200)
        else:
            return JsonResponse({
                "error": "Session not found"
            }, status=404)
        
    except Exception as e:
        logger.error(f"Error getting session status: {e}")
        return JsonResponse({"error": str(e)}, status=500)


# ---------------------------------------------------------------------
# Health Check & Stats Endpoints
# ---------------------------------------------------------------------
@api_view(['GET'])
def health_check(request):
    """Health check endpoint"""
    try:
        client.server_info()
        mongo_status = "connected"
        
        user_count = db[FACE_EMBEDDINGS_COLLECTION].count_documents({})
        log_count = db[VERIFICATION_LOGS_COLLECTION].count_documents({})
        session_count = db[VERIFICATION_SESSIONS_COLLECTION].count_documents({"status": "active"})
        
        recent_logs = list(db[VERIFICATION_LOGS_COLLECTION].find(
            {},
            {"_id": 0, "user_id": 1, "allowed": 1, "timestamp": 1, "distance": 1, "confidence": 1}
        ).sort("timestamp", -1).limit(5))
        
    except Exception as e:
        mongo_status = f"disconnected: {str(e)}"
        user_count = 0
        log_count = 0
        session_count = 0
        recent_logs = []
    
    return JsonResponse({
        "status": "healthy" if mongo_status == "connected" else "unhealthy",
        "service": "Face Verification Service - HTTPS with AUTOMATIC Continuous Verification",
        "version": "3.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "protocol": SERVER_PROTOCOL,
        "port": int(SERVER_PORT),
        "mongodb": {
            "status": mongo_status,
            "database": MONGO_DB,
            "host": MONGO_HOST,
            "port": MONGO_PORT,
            "collections": {
                "embeddings": FACE_EMBEDDINGS_COLLECTION,
                "logs": VERIFICATION_LOGS_COLLECTION,
                "sessions": VERIFICATION_SESSIONS_COLLECTION,
            },
            "registered_users": user_count,
            "verification_logs": log_count,
            "active_sessions": session_count,
        },
        "model": {
            "name": FACE_MODEL_NAME,
            "threshold": FACE_DISTANCE_THRESHOLD,
            "detection_size": list(FACE_DETECTION_SIZE),
            "embedding_dimension": 512,
        },
        "features": {
            "initial_verification": True,
            "continuous_verification": True,
            "automatic_camera_detection": True,
            "session_management": True,
            "violation_tracking": True,
            "auto_kick": True,
            "max_violations": 3,
            "camera_gap_threshold": CAMERA_FRAME_GAP_THRESHOLD
        },
        "recent_verifications": recent_logs,
    })


@api_view(['GET'])
def get_user_status(request, user_id):
    """Check user registration status"""
    try:
        user_record = get_user_embedding(user_id)
        
        if user_record:
            user_info = {
                "registered": True,
                "user_id": str(user_id),
                "registered_at": user_record.get("registered_at", "Unknown"),
                "updated_at": user_record.get("updated_at", "Unknown"),
                "is_active": user_record.get("is_active", True),
                "version": user_record.get("version", 1),
                "embedding_dimension": len(user_record.get("embedding", [])),
                "metadata": user_record.get("metadata", {}),
                "protocol": SERVER_PROTOCOL,
                "port": int(SERVER_PORT),
            }
            
            verification_count = db[VERIFICATION_LOGS_COLLECTION].count_documents({"user_id": str(user_id)})
            successful_count = db[VERIFICATION_LOGS_COLLECTION].count_documents({"user_id": str(user_id), "allowed": True})
            
            active_sessions = db[VERIFICATION_SESSIONS_COLLECTION].count_documents({
                "user_id": str(user_id),
                "status": "active"
            })
            
            total_violations = 0
            all_sessions = db[VERIFICATION_SESSIONS_COLLECTION].find({"user_id": str(user_id)})
            for session in all_sessions:
                total_violations += len(session.get("violations", []))
            
            user_info["verification_stats"] = {
                "total_attempts": verification_count,
                "successful": successful_count,
                "failed": verification_count - successful_count,
                "success_rate": round((successful_count / verification_count * 100), 2) if verification_count > 0 else 0,
            }
            
            user_info["session_stats"] = {
                "active_sessions": active_sessions,
                "total_violations": total_violations
            }
            
            return JsonResponse(user_info)
        else:
            return JsonResponse({
                "registered": False,
                "user_id": str(user_id),
                "message": "User not found in the system",
                "protocol": SERVER_PROTOCOL,
                "port": int(SERVER_PORT)
            }, status=404)
            
    except Exception as e:
        logger.error(f"âŒ Error checking user status: {e}")
        return JsonResponse({
            "error": str(e),
            "error_code": "STATUS_CHECK_FAILED",
            "protocol": SERVER_PROTOCOL,
            "port": int(SERVER_PORT)
        }, status=500)


@api_view(['GET'])
def get_stats(request):
    """Get system statistics"""
    try:
        total_users = db[FACE_EMBEDDINGS_COLLECTION].count_documents({})
        active_users = db[FACE_EMBEDDINGS_COLLECTION].count_documents({"is_active": True})
        
        total_verifications = db[VERIFICATION_LOGS_COLLECTION].count_documents({})
        successful_verifications = db[VERIFICATION_LOGS_COLLECTION].count_documents({"allowed": True})
        
        active_sessions = db[VERIFICATION_SESSIONS_COLLECTION].count_documents({"status": "active"})
        total_sessions = db[VERIFICATION_SESSIONS_COLLECTION].count_documents({})
        
        yesterday = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        recent_verifications = db[VERIFICATION_LOGS_COLLECTION].count_documents({
            "timestamp": {"$gte": yesterday}
        })
        recent_successful = db[VERIFICATION_LOGS_COLLECTION].count_documents({
            "timestamp": {"$gte": yesterday},
            "allowed": True
        })
        
        # Count automatic verifications
        auto_verifications = db[VERIFICATION_LOGS_COLLECTION].count_documents({
            "metadata.verification_type": "continuous_automatic"
        })
        
        pipeline = [
            {"$match": {"allowed": True, "confidence": {"$ne": None}}},
            {"$group": {"_id": None, "avg_confidence": {"$avg": "$confidence"}, "avg_distance": {"$avg": "$distance"}}}
        ]
        avg_result = list(db[VERIFICATION_LOGS_COLLECTION].aggregate(pipeline))
        avg_confidence = round(avg_result[0]["avg_confidence"], 2) if avg_result else 0
        avg_distance = round(avg_result[0]["avg_distance"], 4) if avg_result else 0
        
        violation_pipeline = [
            {"$match": {"status": {"$in": ["active", "completed", "suspended"]}}},
            {"$project": {"violation_count": {"$size": "$violations"}}},
            {"$group": {"_id": None, "total_violations": {"$sum": "$violation_count"}}}
        ]
        violation_result = list(db[VERIFICATION_SESSIONS_COLLECTION].aggregate(violation_pipeline))
        total_violations = violation_result[0]["total_violations"] if violation_result else 0
        
        return JsonResponse({
            "users": {
                "total": total_users,
                "active": active_users,
                "inactive": total_users - active_users,
            },
            "verifications": {
                "total": total_verifications,
                "successful": successful_verifications,
                "failed": total_verifications - successful_verifications,
                "automatic": auto_verifications,
                "success_rate": round((successful_verifications / total_verifications * 100), 2) if total_verifications > 0 else 0,
                "avg_confidence": avg_confidence,
                "avg_distance": avg_distance,
            },
            "sessions": {
                "total": total_sessions,
                "active": active_sessions,
                "total_violations": total_violations
            },
            "last_24_hours": {
                "total_verifications": recent_verifications,
                "successful": recent_successful,
                "failed": recent_verifications - recent_successful,
                "success_rate": round((recent_successful / recent_verifications * 100), 2) if recent_verifications > 0 else 0,
            },
            "timestamp": datetime.utcnow().isoformat(),
            "protocol": SERVER_PROTOCOL,
            "port": int(SERVER_PORT),
        })
        
    except Exception as e:
        logger.error(f"âŒ Error getting stats: {e}")
        return JsonResponse({
            "error": str(e),
            "error_code": "STATS_FETCH_FAILED",
            "protocol": SERVER_PROTOCOL,
            "port": int(SERVER_PORT)
        }, status=500)


# ---------------------------------------------------------------------
# URL Patterns
# ---------------------------------------------------------------------
# ============================================================================
# NEW: Continuous Identity Check Endpoint (called by frontend every 1-5 sec)
# ============================================================================
@api_view(['POST'])
def continuous_identity_check(request):
    """
    NEW ENDPOINT: Frontend sends frame here every 1-5 seconds during meeting.
    
    This endpoint:
    1. Extracts face from frame (GPU)
    2. Compares with stored embedding (GPU)  
    3. Tracks consecutive unknown seconds (0-5)
    4. Issues warnings (1/3, 2/3, 3/3)
    5. Applies -1% penalty and removes on 3rd warning
    6. Returns complete identity status
    
    Request body (JSON):
        { "user_id": "123", "meeting_id": "meeting456", "frame": "<base64>" }
    
    Response:
        { "identity_verified": true/false, "identity_popup": "...", 
          "identity_warning_count": 0-3, "identity_is_removed": false, ... }
    """
    try:
        data = json.loads(request.body)
        user_id = data.get("user_id")
        meeting_id = data.get("meeting_id")
        frame_data = data.get("frame")
        
        if not user_id or not meeting_id:
            return JsonResponse({"error": "user_id and meeting_id required"}, status=400)
        
        if not frame_data:
            return JsonResponse({"error": "frame data required"}, status=400)
        
        # Check if user is already removed
        state = get_identity_state(meeting_id, user_id)
        if state["is_removed"]:
            return JsonResponse({
                "status": "removed",
                "identity_verified": False,
                "identity_is_removed": True,
                "identity_removal_count": state["removal_count"],
                "identity_attendance_penalty": state["attendance_penalty"],
                "identity_popup": "You are removed due to identity verification failure. Please rejoin.",
                "identity_can_rejoin": state["can_rejoin"],
            })
        
        # Get stored embedding from MongoDB
        user_record = get_user_embedding(user_id)
        if not user_record:
            return JsonResponse({
                "error": f"User {user_id} not registered",
                "identity_verified": False,
            }, status=404)
        
        stored_embedding = user_record["embedding"]
        
        # Extract live face embedding from frame (GPU)
        try:
            live_embedding = face_model.extract_embedding(frame_data)
        except ValueError as ve:
            # No face detected in frame — this is NOT an identity failure
            # The person may have looked away, stepped out, or face is obscured
            # Service 3 (Behavioral) handles "Face not visible" violation separately
            # Identity check should only trigger when a DIFFERENT face is detected
            logger.debug(f"No face detected for {user_id} — skipping identity check (not a violation)")
            return JsonResponse({
                "status": "no_face",
                "identity_verified": True,     # Neutral — no face ≠ wrong person
                "face_detected": False,
                "identity_popup": None,
                "identity_action": None,
                "identity_warning_count": get_identity_state(meeting_id, user_id)["current_cycle_warnings"],
                "identity_is_removed": False,
                "identity_consecutive_unknown": get_identity_state(meeting_id, user_id)["consecutive_unknown_seconds"],
            })
        
        # Compare embeddings
        distance = cosine_distance(stored_embedding, live_embedding)
        is_verified = distance < FACE_DISTANCE_THRESHOLD
        similarity = max(0, min(1, 1 - distance))
        
        # Run identity tracking logic (warnings, penalties, removal)
        result = check_identity_with_tracking(meeting_id, user_id, is_verified, similarity)
        
        if result:
            result["face_detected"] = True
            result["distance"] = round(distance, 4)
            return JsonResponse(result)
        
        # Skipped (too soon since last check)
        return JsonResponse({
            "status": "skipped",
            "identity_verified": True,
            "identity_popup": None,
            "message": "Check skipped (within interval)",
        })
        
    except Exception as e:
        logger.error(f"Error in continuous_identity_check: {e}", exc_info=True)
        return JsonResponse({
            "error": str(e),
            "identity_verified": True,  # Fail-safe: don't falsely remove
            "identity_popup": None,
        }, status=500)


@api_view(['POST'])
def rejoin_after_identity_removal(request):
    """
    Called when a user who was removed for identity failure tries to rejoin.
    Resets the identity cycle warnings so they get fresh 1/3, 2/3, 3/3.
    """
    try:
        data = json.loads(request.body)
        user_id = data.get("user_id")
        meeting_id = data.get("meeting_id")
        
        if not user_id or not meeting_id:
            return JsonResponse({"error": "user_id and meeting_id required"}, status=400)
        
        state = reset_identity_state(meeting_id, user_id)
        
        logger.info(f"User {user_id} rejoined meeting {meeting_id} after identity removal #{state['removal_count']}")
        
        return JsonResponse({
            "status": "rejoined",
            "message": "Identity tracking reset. You have 3 fresh warnings.",
            "identity_removal_count": state["removal_count"],
            "identity_attendance_penalty": state["attendance_penalty"],
        })
        
    except Exception as e:
        logger.error(f"Error in rejoin: {e}")
        return JsonResponse({"error": str(e)}, status=500)


urlpatterns = [
    # Face Verification endpoints
    path("api/face/verify", VerifyFace.as_view(), name="verify_face"),
    path("api/face/continuous-verify", ContinuousVerifyFace.as_view(), name="continuous_verify_face"),
    
    # NEW: Continuous identity check with tracking (frontend calls this every 1-5 sec)
    path("api/face/identity-check", continuous_identity_check, name="continuous_identity_check"),
    
    # NEW: Rejoin after identity removal
    path("api/face/rejoin", rejoin_after_identity_removal, name="rejoin_after_identity_removal"),
    
    # NEW: Enhanced Attendance Detection with Automatic Camera State Monitoring
    path("api/attendance/detect/", EnhancedAttendanceDetection.as_view(), name="enhanced_attendance_detect"),
    
    # Session management
    path("api/face/session/create", create_session_endpoint, name="create_verification_session"),
    path("api/face/session/<str:session_id>/end", end_session_endpoint, name="end_verification_session"),
    path("api/face/session/<str:session_id>/status", get_session_status_endpoint, name="get_session_status"),
    
    # Status & monitoring endpoints
    path("api/health", health_check, name="health_check"),
    path("api/user/<str:user_id>/status", get_user_status, name="user_status"),
    path("api/stats", get_stats, name="stats"),
]

# ---------------------------------------------------------------------
# ASGI Application
# ---------------------------------------------------------------------
application = ProtocolTypeRouter({
    "http": get_asgi_application(),
})

# ---------------------------------------------------------------------
# Development Server Runner
# ---------------------------------------------------------------------
if __name__ == "__main__":
    from django.core.management import execute_from_command_line
    import sys
    
    logger.info("=" * 80)
    logger.info("ðŸš€ Starting Face Verification Service - AUTOMATIC Continuous Verification")
    logger.info("=" * 80)
    logger.info(f"")
    logger.info(f"ðŸ“‹ AUTOMATIC VERIFICATION PROCESS:")
    logger.info(f"   1. Initial verification when user joins meeting")
    logger.info(f"   2. Create verification session with camera state tracking")
    logger.info(f"   3. âœ¨ AUTOMATICALLY monitor camera state changes")
    logger.info(f"   4. âœ¨ AUTOMATICALLY detect when camera is re-enabled")
    logger.info(f"   5. âœ¨ AUTOMATICALLY verify face on camera re-enable")
    logger.info(f"   6. Track violations (3-strike system)")
    logger.info(f"   7. Auto-kick after 3 violations")
    logger.info(f"")
    logger.info(f"ðŸŽ¯ KEY FEATURES:")
    logger.info(f"   âœ… NO FRONTEND CHANGES REQUIRED!")
    logger.info(f"   âœ… Automatic camera state detection")
    logger.info(f"   âœ… Automatic face verification on camera re-enable")
    logger.info(f"   âœ… Frame gap detection ({CAMERA_FRAME_GAP_THRESHOLD}s threshold)")
    logger.info(f"   âœ… Smart violation tracking")
    logger.info(f"   âœ… Progressive warning system")
    logger.info(f"")
    logger.info(f"ðŸ”’ Protocol: HTTPS (Secure)")
    logger.info(f"ðŸ“Œ Port: {SERVER_PORT}")
    logger.info(f"ðŸŒ Server: https://{SERVER_HOST}:{SERVER_PORT}")
    logger.info(f"ðŸ—„ï¸ MongoDB: {MONGO_HOST}:{MONGO_PORT}/{MONGO_DB}")
    logger.info(f"ðŸ“¦ Embeddings Collection: {FACE_EMBEDDINGS_COLLECTION}")
    logger.info(f"ðŸ“ Logs Collection: {VERIFICATION_LOGS_COLLECTION}")
    logger.info(f"ðŸ” Sessions Collection: {VERIFICATION_SESSIONS_COLLECTION}")
    logger.info(f"ðŸ¤– Model: {FACE_MODEL_NAME}")
    logger.info(f"ðŸ“Š Face Threshold: {FACE_DISTANCE_THRESHOLD} (lower = stricter matching)")
    logger.info(f"â±ï¸ Camera Gap Threshold: {CAMERA_FRAME_GAP_THRESHOLD}s")
    logger.info(f"ðŸ” Detection Size: {FACE_DETECTION_SIZE}")
    logger.info("=" * 80)
    logger.info("ðŸ“¡ Available HTTPS Endpoints:")
    logger.info(f"   POST   https://{SERVER_HOST}:{SERVER_PORT}/api/face/verify")
    logger.info(f"   POST   https://{SERVER_HOST}:{SERVER_PORT}/api/face/continuous-verify")
    logger.info(f"   POST   https://{SERVER_HOST}:{SERVER_PORT}/api/attendance/detect/  âœ¨ ENHANCED")
    logger.info(f"   POST   https://{SERVER_HOST}:{SERVER_PORT}/api/face/session/create")
    logger.info(f"   POST   https://{SERVER_HOST}:{SERVER_PORT}/api/face/session/<id>/end")
    logger.info(f"   GET    https://{SERVER_HOST}:{SERVER_PORT}/api/face/session/<id>/status")
    logger.info(f"   GET    https://{SERVER_HOST}:{SERVER_PORT}/api/user/<user_id>/status")
    logger.info(f"   GET    https://{SERVER_HOST}:{SERVER_PORT}/api/health")
    logger.info(f"   GET    https://{SERVER_HOST}:{SERVER_PORT}/api/stats")
    logger.info("=" * 80)
    logger.info("âš ï¸ IMPORTANT NOTES:")
    logger.info("   â€¢ User face embeddings must be registered in MongoDB first!")
    logger.info("   â€¢ Frontend continues to work WITHOUT any changes!")
    logger.info("   â€¢ Backend automatically detects camera state from frame data!")
    logger.info("   â€¢ Verification triggers automatically when camera re-enabled!")
    logger.info("   â€¢ Frame gap > 3s = camera disabled, frames resume = camera enabled!")
    logger.info("=" * 80)
    logger.info("")
    logger.info("ðŸŽ‰ READY! Backend will automatically handle continuous verification!")
    logger.info("")
    
    sys.argv = ["manage.py", "runserver", f"{SERVER_HOST}:{SERVER_PORT}"]
    execute_from_command_line(sys.argv)

    