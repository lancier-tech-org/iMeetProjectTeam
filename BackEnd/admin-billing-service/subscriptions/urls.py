from django.urls import path
from subscriptions.subscription_apis import (
    Get_User_Active_Subscription, Get_User_Subscription_History,
    Get_Subscription_By_ID, Get_Subscription_By_Transaction_ID,
    List_All_Subscriptions, List_Expiring_Subscriptions,
    Cancel_Subscription, Get_Subscription_Stats
)

urlpatterns = [
    path('api/subscription/user/<int:user_id>/active', Get_User_Active_Subscription),
    path('api/subscription/user/<int:user_id>/history', Get_User_Subscription_History),
    path('api/subscription/<int:subscription_id>', Get_Subscription_By_ID),
    path('api/subscription/transaction/<int:transaction_id>', Get_Subscription_By_Transaction_ID),
    path('api/subscription/all', List_All_Subscriptions),
    path('api/subscription/expiring', List_Expiring_Subscriptions),
    path('api/subscription/<int:subscription_id>/cancel', Cancel_Subscription),
    path('api/subscription/stats', Get_Subscription_Stats),
]