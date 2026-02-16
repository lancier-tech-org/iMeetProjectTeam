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