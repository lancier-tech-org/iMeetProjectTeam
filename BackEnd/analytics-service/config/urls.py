from django.urls import path, include
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({"status": "healthy", "service": "analytics-service"})

urlpatterns = [
    path('health', health_check, name='health'),
    path('', include('analytics.urls')),
    path('', include('feedback.urls')),
]