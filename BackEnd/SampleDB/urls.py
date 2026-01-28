"""
URL configuration for SampleDB project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def root_health_check(request):
    """Root level health check - lightweight, no DB queries"""
    return JsonResponse({"status": "healthy", "service": "imeetpro-backend"})


urlpatterns = [
    path('health', root_health_check, name='root_health'),
    path('admin/', admin.site.urls),
    path('', include('core.WebSocketConnection.meetings')),
    path('', include('core.UserDashBoard.users')),
    path('', include('core.UserDashBoard.Analytics')),
    path('', include('core.WebSocketConnection.participants_urls')),
    path('', include('core.WebSocketConnection.chat_messages')),
    path('', include('core.AI_Attendance.Attendance')),
    # path('', include('core.WebSocketConnection.hand_rise')),
    path('', include('core.WebSocketConnection.reactions')),
    path('', include('core.UserDashBoard.feedback')),
    path('', include('core.UserDashBoard.recordings')),
    path('', include('core.WebSocketConnection.notification_urls')),
    path('', include('core.WebSocketConnection.cache_only_hand_raise')),
    path('', include('core.Whiteboard.whiteboard_urls')),
    path('', include('core.livekit_recording.urls')),
    path('', include('core.livekit_recording.urls')),
    path('', include('core.FaceAuth.face_auth')),
    path('', include('core.super_adminDashboard.super_admin')),
    path('', include('core.super_adminDashboard.plans')),
    # path('', include('core.super_adminDashboard.subscriptions')),
    # path('', include('core.super_adminDashboard.payments')),
    path('', include('core.super_adminDashboard.payment_orders')),
    path('', include('core.super_adminDashboard.payment_transactions')),
    path('', include('core.super_adminDashboard.payment_events')),
    path('', include('core.super_adminDashboard.login_history')),
    path('', include('core.super_adminDashboard.company_details')),
    path('', include('core.super_adminDashboard.subscription_apis')),
]
