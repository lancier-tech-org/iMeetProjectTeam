from django.urls import path, include
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({"status": "healthy", "service": "admin-billing-service"})

urlpatterns = [
    path('service-health', health_check, name='health'),
    path('', include('super_admin.urls')),
    path('', include('plans.urls')),
    path('', include('payments.urls')),
    path('', include('subscriptions.urls')),
    path('', include('invoices.urls')),
    path('', include('company.urls')),
    path('', include('login_history.urls')),
]