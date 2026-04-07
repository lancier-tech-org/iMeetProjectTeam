from feedback.feedback import (
    Create_Feedback, List_All_Feedback, Get_Feedback, Update_Feedback,
    Delete_Feedback, Validate_Feedback_Data, Get_Feedback_By_User,
    Get_Feedback_By_Meeting, Get_Feedback_Stats, Get_Timezones
)
from django.urls import path

urlpatterns = [
    path('api/feedback/create', Create_Feedback, name='Create_Feedback'),
    path('api/feedback/feedbacks', List_All_Feedback, name='List_All_Feedback'),
    path('api/feedback/feedback/<int:id>', Get_Feedback, name='Get_Feedback'),
    path('api/feedback/update/<int:id>', Update_Feedback, name='Update_Feedback'),
    path('api/feedback/delete/<int:id>', Delete_Feedback, name='Delete_Feedback'),
    path('api/feedback/validate', Validate_Feedback_Data, name='Validate_Feedback_Data'),
    path('api/feedback/user/<int:user_id>', Get_Feedback_By_User, name='Get_Feedback_By_User'),
    path('api/feedback/meeting/<str:meeting_id>', Get_Feedback_By_Meeting, name='Get_Feedback_By_Meeting'),
    path('api/feedback/stats', Get_Feedback_Stats, name='Get_Feedback_Stats'),
    path('api/feedback/timezones', Get_Timezones, name='Get_Timezones'),
]