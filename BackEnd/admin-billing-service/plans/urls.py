from django.urls import path
from plans.plans import (
    Create_Plan, List_All_Plans, Get_Plan,
    Update_Plan, Delete_Plan, Filter_Plans_By_Billing_Period
)

urlpatterns = [
    path('api/plan/create', Create_Plan),
    path('api/plan/lists', List_All_Plans),
    path('api/plan/list/<int:id>', Get_Plan),
    path('api/plan/update/<int:id>', Update_Plan),
    path('api/plan/remove/<int:id>', Delete_Plan),
    path('api/plan/filter', Filter_Plans_By_Billing_Period),
]