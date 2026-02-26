"""
Push Notification URL Patterns
================================
Location: core/WebSocketConnection/push_urls.py

Add to your main urls.py:
    from core.WebSocketConnection import push_urls
    urlpatterns += [path('api/push/', include(push_urls.urlpatterns))]
"""

from django.urls import path
from . import push_device_tokens

urlpatterns = [
    # Device token management
    path('api/push/register-device/',    push_device_tokens.register_device_token,    name='push_register_device'),
    path('api/push/deactivate-device/',  push_device_tokens.deactivate_device_token,  name='push_deactivate_device'),
    path('api/push/heartbeat/',          push_device_tokens.heartbeat_device_token,   name='push_heartbeat'),
    path('api/push/active-devices/',     push_device_tokens.get_active_devices,       name='push_active_devices'),
]