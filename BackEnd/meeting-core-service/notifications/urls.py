from django.urls import path
from .notifications import (
    get_user_notifications, get_notification_count,
    mark_notification_as_read, mark_all_notifications_as_read,
    delete_notification, process_reminder_notifications,
)

urlpatterns = [
    path('api/notifications/', get_user_notifications, name='get_notifications'),
    path('api/notifications/count/', get_notification_count, name='get_notification_count'),
    path('api/notifications/mark-read/', mark_notification_as_read, name='mark_notification_read'),
    path('api/notifications/mark-all-read/', mark_all_notifications_as_read, name='mark_all_notifications_read'),
    path('api/notifications/delete/', delete_notification, name='delete_notification'),
    path('api/notifications/process-reminders/', process_reminder_notifications, name='process_reminder_notifications'),
]