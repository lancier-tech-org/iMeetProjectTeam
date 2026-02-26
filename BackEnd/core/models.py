# core/models.py
from django.db import models

# Create your models here.
from core.UserDashBoard.users import User 
from core.UserDashBoard.users import OTPReset
from core.UserDashBoard.feedback import Feedback
from core.AI_Attendance.Attendance import AttendanceSession
from core.WebSocketConnection.meetings import Meetings
from core.WebSocketConnection.meetings import ScheduledMeetings
from core.WebSocketConnection.meetings import CalendarMeetings
from core.WebSocketConnection.participants import Participants
from core.WebSocketConnection.notifications import Notification
from core.WebSocketConnection.notifications import ScheduledReminder
from core.super_adminDashboard.plans import Plan
from core.super_adminDashboard.super_admin import SuperAdmin
from core.super_adminDashboard.login_history import UserLoginHistory 
from core.super_adminDashboard.company_details import CompanyDetails
from core.super_adminDashboard.payment_events import PaymentEvent
from core.super_adminDashboard.invoice_generator import Invoice
from core.super_adminDashboard.payment_orders import PaymentOrder
from core.super_adminDashboard.payment_transactions import PaymentTransaction
from core.super_adminDashboard.subscription_apis import UserSubscription

# ============================================================
# 📌 STEP 1: ADD THIS AT THE BOTTOM OF YOUR EXISTING FILE
# 📁 FILE: /lanciere/devstorage/jyothi/SampleDB_W/core/models.py
#
# ⚠️ DO NOT REPLACE THE FILE — just paste at the bottom
# ============================================================

class AppConfig(models.Model):
    """
    Stores the entire app configuration as a single JSON object.
    Only ONE row exists in this table — the latest config.
    Edit via Django Admin: http://192.168.48.201:8111/admin/core/appconfig/
    Flutter fetches via: GET http://192.168.48.201:8111/api/app-config/
    """
    name = models.CharField(
        max_length=50,
        unique=True,
        default='app_config',
        help_text='Keep this as "app_config". Do not change.'
    )
    config_json = models.TextField(
        help_text='Paste your full JSON configuration here. Flutter reads this directly.'
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_App_Config'
        verbose_name = 'App Configuration'
        verbose_name_plural = 'App Configuration'

    def __str__(self):
        return f"App Config (updated: {self.updated_at})"
