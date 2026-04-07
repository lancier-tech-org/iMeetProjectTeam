from django.urls import path
from company.company_details import (
    Create_Company_Details, Get_Active_Company_Details, Get_Company_Details_By_ID,
    List_All_Company_Details, Update_Company_Details, Delete_Company_Details
)

urlpatterns = [
    path('api/company/create', Create_Company_Details),
    path('api/company/active', Get_Active_Company_Details),
    path('api/company/<int:company_id>', Get_Company_Details_By_ID),
    path('api/company/list', List_All_Company_Details),
    path('api/company/update/<int:company_id>', Update_Company_Details),
    path('api/company/delete/<int:company_id>', Delete_Company_Details),
]