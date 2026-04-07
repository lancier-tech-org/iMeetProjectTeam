from django.urls import path
from .users import (
    validate_email, Register_User, Login_User, Logout_User,
    Forgot_Password, Reset_Password, Verify_Password, Change_Password,
    Add_User, List_All_Users, Get_User, Update_User, Delete_User,
    Validate_User_Data, Get_Profile_Photo, Get_User_Profile_Photo,
    Update_Profile_Photo, Delete_Profile_Photo, Get_Active_Profile_Photo,
    Face_Recognition_Login, Verify_User_Face, Get_User_Embeddings,
    Regenerate_User_Embedding, Get_Embedding_Statistics, Get_User_Full_Profile
)

urlpatterns = [
    path('api/auth/validate-email/', validate_email, name='validate_email'),
    path('api/auth/register', Register_User, name='Register_User'),
    path('api/auth/login', Login_User, name='Login_User'),
    path('api/auth/logout', Logout_User, name='Logout_User'),
    path('api/auth/forgot-password', Forgot_Password, name='Forgot_Password'),
    path('api/auth/reset-password', Reset_Password, name='Reset_Password'),
    path('api/auth/verify-password/', Verify_Password, name='verify_password'),
    path('api/auth/change-password/', Change_Password, name='change_password'),
    path('api/user/add', Add_User, name='Add_User'),
    path('api/user/lists', List_All_Users, name='List_All_Users'),
    path('api/user/list/<int:id>', Get_User, name='Get_User'),
    path('api/auth/update-profile/<int:id>/', Update_User, name='update-profile'),
    path('api/user/remove/<int:id>', Delete_User, name='Delete_User'),
    path('api/user/validate', Validate_User_Data, name='Validate_User_Data'),
    path('api/profile-photo/<str:photo_id>/', Get_Profile_Photo, name='get_profile_photo'),
    path('api/user-photo/<int:user_id>/', Get_User_Profile_Photo, name='get_user_profile_photo'),
    path('api/update-photo/<int:user_id>/', Update_Profile_Photo, name='update_profile_photo'),
    path('api/delete-photo/<int:user_id>/', Delete_Profile_Photo, name='delete_profile_photo'),
    path('api/user-active-photo/<int:user_id>/', Get_Active_Profile_Photo, name='get_active_profile_photo'),
    path('api/auth/face-login/', Face_Recognition_Login, name='face_recognition_login'),
    path('api/user/verify-face/<int:user_id>/', Verify_User_Face, name='verify_user_face'),
    path('api/user/embeddings/<int:user_id>/', Get_User_Embeddings, name='get_user_embeddings'),
    path('api/user/regenerate-embedding/<int:user_id>/', Regenerate_User_Embedding, name='regenerate_embedding'),
    path('api/admin/embedding-stats/', Get_Embedding_Statistics, name='embedding_stats'),
    path('api/user/profile/<int:user_id>/', Get_User_Full_Profile, name='get_user_full_profile'),
]