from django.urls import path
from .face_auth import (
    VerifyFace, ContinuousVerifyFace, EnhancedAttendanceDetection,
    create_session_endpoint, end_session_endpoint,
    get_session_status_endpoint, health_check, get_user_status, get_stats, validate_face_endpoint, process_embedding_endpoint
)

urlpatterns = [
    # Face Verification endpoints
    path("api/face/verify", VerifyFace.as_view(), name="verify_face"),
    path("api/face/continuous-verify", ContinuousVerifyFace.as_view(), name="continuous_verify_face"),

    # Enhanced Attendance Detection with Automatic Camera State Monitoring
    path("api/attendance/detect/", EnhancedAttendanceDetection.as_view(), name="enhanced_attendance_detect"),

    # Session management
    path("api/face/session/create", create_session_endpoint, name="create_verification_session"),
    path("api/face/session/<str:session_id>/end", end_session_endpoint, name="end_verification_session"),
    path("api/face/session/<str:session_id>/status", get_session_status_endpoint, name="get_session_status"),

    # Status & monitoring endpoints
    path("api/health", health_check, name="health_check"),
    path("api/user/<str:user_id>/status", get_user_status, name="user_status"),
    path("api/stats", get_stats, name="stats"),
    path("api/face/validate", validate_face_endpoint, name="validate_face"),
    path("api/face/process-embedding", process_embedding_endpoint, name="process_embedding"),
]
