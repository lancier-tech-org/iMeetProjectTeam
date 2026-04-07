from django.urls import path
from .reactions import (
    start_meeting_reactions, add_reaction, clear_all_reactions,
    get_active_reactions, get_reaction_counts,
    end_meeting_reactions, get_meeting_reactions_stats,
    get_allowed_reactions,
)

urlpatterns = [
    path('api/cache-reactions/start/', start_meeting_reactions, name='start_meeting_reactions'),
    path('api/cache-reactions/add/', add_reaction, name='add_reaction'),
    path('api/cache-reactions/clear-all/', clear_all_reactions, name='clear_all_reactions'),
    path('api/cache-reactions/active/<str:meeting_id>/', get_active_reactions, name='get_active_reactions'),
    path('api/cache-reactions/counts/<str:meeting_id>/', get_reaction_counts, name='get_reaction_counts'),
    path('api/cache-reactions/end/', end_meeting_reactions, name='end_meeting_reactions'),
    path('api/cache-reactions/stats/<str:meeting_id>/', get_meeting_reactions_stats, name='get_meeting_reactions_stats'),
    path('api/cache-reactions/allowed/', get_allowed_reactions, name='get_allowed_reactions'),
]