from django.urls import path
from .Attendance import (
    start_attendance_tracking_api, stop_attendance_tracking_api,
    detect_violations, take_break, get_attendance_status,
    pause_resume_attendance, verify_camera_resumed
)

urlpatterns = [
    path('api/attendance/start/', start_attendance_tracking_api, name='attendance_start'),
    path('api/attendance/stop/', stop_attendance_tracking_api, name='attendance_stop'),
    path('api/attendance/detect/', detect_violations, name='attendance_detect_violations'),
    path('api/attendance/break/', take_break, name='attendance_take_break'),
    path('api/attendance/status/', get_attendance_status, name='attendance_get_status'),
    path('api/attendance/pause-resume/', pause_resume_attendance, name='attendance_pause_resume'),
    path('api/attendance/verify-camera/', verify_camera_resumed, name='attendance_verify_camera'),
]