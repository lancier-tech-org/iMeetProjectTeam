from django.urls import path
from .chat_messages import (
    start_meeting_chat, send_cache_chat_message,
    upload_chat_file, download_chat_file, get_meeting_files,
    delete_chat_file, get_cache_chat_history,
    update_typing_indicator, get_typing_users,
    end_meeting_chat, get_meeting_chat_stats,
    get_supported_file_types, cleanup_expired_meetings,
    health_check,
)

urlpatterns = [
    path('api/cache-chat/start/', start_meeting_chat, name='start_meeting_chat'),
    path('api/cache-chat/send/', send_cache_chat_message, name='send_cache_chat_message'),
    path('api/cache-chat/upload/', upload_chat_file, name='upload_chat_file'),
    path('api/cache-chat/files/<str:file_id>/', download_chat_file, name='download_chat_file'),
    path('api/cache-chat/meeting-files/<str:meeting_id>/', get_meeting_files, name='get_meeting_files'),
    path('api/cache-chat/delete-file/<str:meeting_id>/<str:file_id>/', delete_chat_file, name='delete_chat_file'),
    path('api/cache-chat/history/<str:meeting_id>/', get_cache_chat_history, name='get_cache_chat_history'),
    path('api/cache-chat/typing/', update_typing_indicator, name='update_typing_indicator'),
    path('api/cache-chat/typing-users/<str:meeting_id>/', get_typing_users, name='get_typing_users'),
    path('api/cache-chat/end/', end_meeting_chat, name='end_meeting_chat'),
    path('api/cache-chat/stats/<str:meeting_id>/', get_meeting_chat_stats, name='get_meeting_chat_stats'),
    path('api/cache-chat/supported-types/', get_supported_file_types, name='get_supported_file_types'),
    path('api/cache-chat/cleanup/', cleanup_expired_meetings, name='cleanup_expired_meetings'),
    path('api/cache-chat/health/', health_check, name='chat_health_check'),
]