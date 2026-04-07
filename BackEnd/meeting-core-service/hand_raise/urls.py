from django.urls import path
from .cache_only_hand_raise import (
    start_meeting_hand_raise, raise_hand, acknowledge_hand,
    clear_all_hands, get_raised_hands, sync_hand_raise_state,
    end_meeting_hand_raise, get_meeting_hand_raise_stats,
    check_hand_status,
)

urlpatterns = [
    path('api/cache-hand-raise/start/', start_meeting_hand_raise, name='start_meeting_hand_raise'),
    path('api/cache-hand-raise/raise/', raise_hand, name='raise_hand'),
    path('api/cache-hand-raise/acknowledge/', acknowledge_hand, name='acknowledge_hand'),
    path('api/cache-hand-raise/clear-all/', clear_all_hands, name='clear_all_hands'),
    path('api/cache-hand-raise/hands/<str:meeting_id>/', get_raised_hands, name='get_raised_hands'),
    path('api/cache-hand-raise/sync/', sync_hand_raise_state, name='sync_hand_raise_state'),
    path('api/cache-hand-raise/end/', end_meeting_hand_raise, name='end_meeting_hand_raise'),
    path('api/cache-hand-raise/stats/<str:meeting_id>/', get_meeting_hand_raise_stats, name='get_meeting_hand_raise_stats'),
    path('api/cache-hand-raise/check/<str:meeting_id>/<str:user_id>/', check_hand_status, name='check_hand_status'),
]