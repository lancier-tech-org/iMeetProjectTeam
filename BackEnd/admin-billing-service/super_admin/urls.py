from django.urls import path
from super_admin.super_admin import (
    Register_Super_Admin, Login_Super_Admin, Logout_Super_Admin,
    Forgot_Password_Super_Admin, Reset_Password_Super_Admin,
    Add_Super_Admin, List_All_Super_Admins, Get_Super_Admin,
    Update_Super_Admin, Delete_Super_Admin, Validate_Super_Admin_Data
)

urlpatterns = [
    path('api/auth/super_admin/register', Register_Super_Admin),
    path('api/auth/super_admin/login', Login_Super_Admin),
    path('api/super_admin/logout', Logout_Super_Admin),
    path('api/auth/super_admin/forgot-password', Forgot_Password_Super_Admin),
    path('api/auth/super_admin/reset-password', Reset_Password_Super_Admin),
    path('api/super_admin/add', Add_Super_Admin),
    path('api/super_admin/lists', List_All_Super_Admins),
    path('api/super_admin/list/<int:id>', Get_Super_Admin),
    path('api/super_admin/update/<int:id>', Update_Super_Admin),
    path('api/super_admin/remove/<int:id>', Delete_Super_Admin),
    path('api/super_admin/validate', Validate_Super_Admin_Data),
]