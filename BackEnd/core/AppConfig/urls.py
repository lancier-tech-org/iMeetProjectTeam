# ============================================================
# 📌 STEP 5: CREATE THIS NEW FILE
# 📁 FILE: /lanciere/devstorage/jyothi/SampleDB_W/core/AppConfig/urls.py
# ============================================================

from django.urls import path
from . import views

urlpatterns = [
    # GET http://192.168.48.201:8111/api/app-config/
    path('api/app-config/', views.get_app_config, name='get_app_config'),
]