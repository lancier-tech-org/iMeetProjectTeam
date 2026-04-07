from analytics.Analytics import (
    Get_Host_Meetings, Get_Participant_Meetings, Get_Meeting_Participants,
    Download_Meeting_Participants_PDF, Generate_Participant_Report_PDF_For_Meeting,
    Get_Participant_Report_For_Meeting, get_available_meeting_times,
    get_dashboard_quick_stats, get_host_dashboard_overview,
    get_participant_dashboard_overview, get_comprehensive_meeting_analytics
)
from django.urls import path

urlpatterns = [
    path('api/meetings/host/<int:user_id>/', Get_Host_Meetings, name='get_host_meetings'),
    path('api/meetings/<str:meeting_id>/participants/', Get_Meeting_Participants, name='get_meeting_participants'),
    path('api/meetings/participant/<int:user_id>/', Get_Participant_Meetings, name='get_participant_meetings'),
    path('api/meetings/<str:meeting_id>/participants/download-pdf/', Download_Meeting_Participants_PDF, name='download_meeting_participants_pdf'),
    path('api/meetings/<str:meeting_id>/participants/<int:user_id>/report/pdf/', Generate_Participant_Report_PDF_For_Meeting, name='generate_participant_report_pdf_for_meeting'),
    path('api/meetings/<str:meeting_id>/participants/<int:user_id>/report/', Get_Participant_Report_For_Meeting, name='get_participant_report_for_meeting'),
    path('api/analytics/meeting-times', get_available_meeting_times, name='get_available_meeting_times'),
    path('api/dashboard/quick-stats/', get_dashboard_quick_stats, name='dashboard_quick_stats'),
    path('api/analytics/host/overview', get_host_dashboard_overview, name='get_host_dashboard_overview'),
    path('api/analytics/participant/overview', get_participant_dashboard_overview, name='get_participant_dashboard_overview'),
    path('api/analytics/comprehensive', get_comprehensive_meeting_analytics, name='get_comprehensive_meeting_analytics'),
]