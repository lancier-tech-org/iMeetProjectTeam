from django.urls import path
from .polls import (
    create_poll, submit_vote, close_poll,
    delete_poll, end_meeting_polls,
    get_poll_results, list_polls,
)

# ════════════════════════════════════════════════════════════════════════════
#  URL PATTERNS  — registered in SampleDB/urls.py the same way as reactions
# ════════════════════════════════════════════════════════════════════════════
urlpatterns = [
    path('api/polls/create/',                          create_poll,         name='create_poll'),
    path('api/polls/vote/',                            submit_vote,         name='poll_submit_vote'),
    path('api/polls/close/',                           close_poll,          name='close_poll'),
    path('api/polls/delete/',                          delete_poll,         name='delete_poll'),
    path('api/polls/end-meeting/',                     end_meeting_polls,   name='end_meeting_polls'),
    path('api/polls/results/<str:meeting_id>/<str:poll_id>/', get_poll_results, name='get_poll_results'),
    path('api/polls/list/<str:meeting_id>/',           list_polls,          name='list_polls'),
]
