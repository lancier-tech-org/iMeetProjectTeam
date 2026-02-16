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
from core.super_adminDashboard.plans import Plan
from core.super_adminDashboard.super_admin import SuperAdmin
from core.super_adminDashboard.login_history import UserLoginHistory
from core.super_adminDashboard.company_details import CompanyDetails
from core.super_adminDashboard.payment_events import PaymentEvent
from core.super_adminDashboard.invoice_generator import Invoice
from core.super_adminDashboard.payment_orders import PaymentOrder
from core.super_adminDashboard.payment_transactions import PaymentTransaction
from core.super_adminDashboard.subscription_apis import UserSubscription