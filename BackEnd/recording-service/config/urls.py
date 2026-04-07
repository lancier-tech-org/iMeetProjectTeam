from django.urls import path, include
from django.http import JsonResponse

def service_health(request):
    return JsonResponse({"status": "healthy", "service": "recording-service"})

urlpatterns = [
    path('service-health', service_health, name='service_health'),
    path('', include('stream_recording.urls')),
    path('', include('video_processing.urls')),
]