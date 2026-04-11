from django.urls import path, include
from django.http import JsonResponse

def service_health(request):
    return JsonResponse({"status": "healthy", "service": "meeting-core-service"})

urlpatterns = [
    path('service-health', service_health, name='service_health'),
    path('', include('meetings.urls')),
    path('', include('participants.urls')),
    path('', include('notifications.urls')),
    path('', include('chat.urls')),
    path('', include('reactions.urls')),
    path('', include('hand_raise.urls')),
    path('', include('polls.urls')),
]