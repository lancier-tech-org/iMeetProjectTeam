from django.urls import path
from payments.payment_orders import (
    Create_Payment_Order, Get_Payment_Order, Get_Payment_Order_By_Razorpay_ID,
    List_User_Payment_Orders, List_All_Payment_Orders, Update_Payment_Order_Status
)
from payments.payment_transactions import (
    Verify_Payment_Transaction, Record_Failed_Payment, Get_Payment_Transaction,
    Get_Payment_Transaction_By_Razorpay_ID, List_Order_Transactions,
    List_User_Transactions, List_All_Transactions
)
from payments.payment_events import (
    Razorpay_Webhook_Handler, Get_Payment_Event, Get_Payment_Event_By_Razorpay_ID,
    List_Events_By_Payment_ID, List_Events_By_Order_ID, List_All_Events,
    List_Unprocessed_Events, Mark_Event_Processed
)

urlpatterns = [
    path('api/payment/order/create', Create_Payment_Order),
    path('api/payment/order/<int:order_id>', Get_Payment_Order),
    path('api/payment/order/razorpay/<str:razorpay_order_id>', Get_Payment_Order_By_Razorpay_ID),
    path('api/payment/orders/user/<int:user_id>', List_User_Payment_Orders),
    path('api/payment/orders/all', List_All_Payment_Orders),
    path('api/payment/order/update/<int:order_id>', Update_Payment_Order_Status),
    path('api/payment/transaction/verify', Verify_Payment_Transaction),
    path('api/payment/transaction/failed', Record_Failed_Payment),
    path('api/payment/transaction/<int:transaction_id>', Get_Payment_Transaction),
    path('api/payment/transaction/razorpay/<str:razorpay_payment_id>', Get_Payment_Transaction_By_Razorpay_ID),
    path('api/payment/transactions/order/<int:order_id>', List_Order_Transactions),
    path('api/payment/transactions/user/<int:user_id>', List_User_Transactions),
    path('api/payment/transactions/all', List_All_Transactions),
    path('api/payment/webhook', Razorpay_Webhook_Handler),
    path('api/payment/event/<int:event_id>', Get_Payment_Event),
    path('api/payment/event/razorpay/<str:razorpay_event_id>', Get_Payment_Event_By_Razorpay_ID),
    path('api/payment/events/payment/<str:razorpay_payment_id>', List_Events_By_Payment_ID),
    path('api/payment/events/order/<str:razorpay_order_id>', List_Events_By_Order_ID),
    path('api/payment/events/all', List_All_Events),
    path('api/payment/events/unprocessed', List_Unprocessed_Events),
    path('api/payment/event/process/<int:event_id>', Mark_Event_Processed),
]