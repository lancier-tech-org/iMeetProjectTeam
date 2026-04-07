from django.urls import path
from login_history.login_history import (
    Get_All_Login_History, Get_Active_Sessions, Get_Login_Statistics,
    Force_Logout_Session, Force_Logout_User_All_Sessions,
    Clear_Login_History, Get_User_Login_History
)

urlpatterns = [
    path('api/admin/login-history/', Get_All_Login_History),
    path('api/admin/active-sessions/', Get_Active_Sessions),
    path('api/admin/login-stats/', Get_Login_Statistics),
    path('api/admin/force-logout/<int:login_id>/', Force_Logout_Session),
    path('api/admin/force-logout-user/<int:user_id>/', Force_Logout_User_All_Sessions),
    path('api/admin/clear-login-history/', Clear_Login_History),
    path('api/user/login-history/<int:user_id>/', Get_User_Login_History),
]
