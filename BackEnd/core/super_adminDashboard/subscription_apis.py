# core/super_adminDashboard/subscription_apis.py

from django.db import connection
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.urls import path
from django.db.utils import ProgrammingError, OperationalError
import json
import logging
from django.db import models

# Table Names
TBL_USER_SUBSCRIPTIONS = 'tbl_user_subscriptions'

# Status Codes
SUCCESS_STATUS = 200
CREATED_STATUS = 201
BAD_REQUEST_STATUS = 400
NOT_FOUND_STATUS = 404
SERVER_ERROR_STATUS = 500

# Configure Logging
logging.basicConfig(
    filename='subscription_apis_debug.log',
    level=logging.DEBUG,
    format='%(asctime)s %(levelname)s %(message)s'
)

class UserSubscription(models.Model):
    PLAN_TYPE_CHOICES = [
        ('basic', 'basic'),
        ('pro', 'pro'),
        ('pro_max', 'pro_max'),
    ]
    BILLING_PERIOD_CHOICES = [
        ('monthly', 'monthly'),
        ('yearly', 'yearly'),
    ]
    SUBSCRIPTION_STATUS_CHOICES = [
        ('ACTIVE', 'ACTIVE'),
        ('EXPIRED', 'EXPIRED'),
        ('CANCELLED', 'CANCELLED'),
    ]

    id = models.AutoField(primary_key=True)
    user_id = models.ForeignKey('User', on_delete=models.CASCADE, db_column='user_id', related_name='subscriptions')
    transaction_id = models.ForeignKey('PaymentTransaction', on_delete=models.CASCADE, db_column='transaction_id', related_name='subscriptions')
    order_id = models.ForeignKey('PaymentOrder', on_delete=models.CASCADE, db_column='order_id', related_name='subscriptions')
    invoice_id = models.ForeignKey('Invoice', on_delete=models.SET_NULL, db_column='invoice_id', related_name='subscriptions', blank=True, null=True)
    plan_id = models.ForeignKey('Plan', on_delete=models.RESTRICT, db_column='plan_id', related_name='subscriptions')
    plan_name = models.CharField(max_length=50)
    plan_type = models.CharField(max_length=7, choices=PLAN_TYPE_CHOICES)
    billing_period = models.CharField(max_length=7, choices=BILLING_PERIOD_CHOICES)
    subscription_start_date = models.DateField()
    subscription_end_date = models.DateField()
    duration_days = models.IntegerField()
    subscription_status = models.CharField(max_length=9, choices=SUBSCRIPTION_STATUS_CHOICES, default='ACTIVE')
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    gst_amount = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='INR')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_user_subscriptions'
        app_label = 'core'
        indexes = [
            models.Index(fields=['user_id'], name='idx_sub_user_id'),
            models.Index(fields=['transaction_id'], name='idx_sub_transaction_id'),
            models.Index(fields=['subscription_status'], name='idx_sub_status'),
            models.Index(fields=['subscription_end_date'], name='idx_sub_end_date'),
            models.Index(fields=['user_id', 'subscription_status'], name='idx_sub_user_status'),
        ]


def create_user_subscriptions_table():
    """Create tbl_user_subscriptions table - user subscription tracking with auto-expiry management"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tbl_user_subscriptions (
                    id INT NOT NULL AUTO_INCREMENT,
                    user_id INT NOT NULL,
                    transaction_id INT NOT NULL,
                    order_id INT NOT NULL,
                    invoice_id INT DEFAULT NULL,
                    plan_id INT NOT NULL,
                    plan_name VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
                    plan_type ENUM('basic','pro','pro_max') COLLATE utf8mb4_unicode_ci NOT NULL,
                    billing_period ENUM('monthly','yearly') COLLATE utf8mb4_unicode_ci NOT NULL,
                    subscription_start_date DATE NOT NULL COMMENT 'When subscription starts',
                    subscription_end_date DATE NOT NULL COMMENT 'When subscription expires',
                    duration_days INT NOT NULL COMMENT 'Total subscription duration (30 or 365 days)',
                    subscription_status ENUM('ACTIVE','EXPIRED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
                    base_price DECIMAL(10,2) NOT NULL COMMENT 'Base price before GST',
                    gst_amount DECIMAL(10,2) NOT NULL COMMENT 'GST amount',
                    total_price DECIMAL(10,2) NOT NULL COMMENT 'Total amount paid',
                    currency VARCHAR(3) COLLATE utf8mb4_unicode_ci DEFAULT 'INR',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    INDEX idx_user_id (user_id),
                    INDEX idx_transaction_id (transaction_id),
                    INDEX idx_subscription_status (subscription_status),
                    INDEX idx_subscription_end_date (subscription_end_date),
                    INDEX idx_user_status (user_id, subscription_status) COMMENT 'Find user active subscription fast',
                    INDEX order_id (order_id),
                    INDEX invoice_id (invoice_id),
                    INDEX plan_id (plan_id),
                    CONSTRAINT tbl_user_subscriptions_ibfk_1 FOREIGN KEY (user_id) REFERENCES tbl_Users(ID) ON DELETE CASCADE,
                    CONSTRAINT tbl_user_subscriptions_ibfk_2 FOREIGN KEY (transaction_id) REFERENCES tbl_payment_transactions(id) ON DELETE CASCADE,
                    CONSTRAINT tbl_user_subscriptions_ibfk_3 FOREIGN KEY (order_id) REFERENCES tbl_payment_orders(id) ON DELETE CASCADE,
                    CONSTRAINT tbl_user_subscriptions_ibfk_4 FOREIGN KEY (invoice_id) REFERENCES tbl_invoices(id) ON DELETE SET NULL,
                    CONSTRAINT tbl_user_subscriptions_ibfk_5 FOREIGN KEY (plan_id) REFERENCES tbl_Plans(id) ON DELETE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='User subscription tracking with auto-expiry management'
            """)
            logger.info("✓ tbl_user_subscriptions table ready")
            return True
    except Exception as e:
        logger.error(f"✗ Error creating user subscriptions table: {e}")
        return False
   
# ==================== SUBSCRIPTION APIs ====================

@require_http_methods(["GET"])
@csrf_exempt
def Get_User_Active_Subscription(request, user_id):
    """
    Get user's current active subscription with real-time days_remaining
    
    Endpoint: GET /api/subscription/user/<user_id>/active
    
    Example: GET /api/subscription/user/123/active
    """
    try:
        with connection.cursor() as cursor:
            # Verify user exists
            cursor.execute("SELECT COUNT(*) FROM tbl_Users WHERE ID = %s", [user_id])
            if cursor.fetchone()[0] == 0:
                logging.error(f"User ID {user_id} not found")
                return JsonResponse({"Error": "User not found"}, status=NOT_FOUND_STATUS)

            # Query with real-time calculations
            select_query = f"""
            SELECT 
                id, user_id, transaction_id, order_id, invoice_id, plan_id,
                plan_name, plan_type, billing_period,
                subscription_start_date, subscription_end_date, duration_days,
                DATEDIFF(subscription_end_date, CURDATE()) AS days_remaining,
                CASE 
                    WHEN subscription_end_date < CURDATE() THEN 'EXPIRED'
                    WHEN subscription_status = 'CANCELLED' THEN 'CANCELLED'
                    ELSE 'ACTIVE'
                END AS current_status,
                subscription_status AS original_status,
                base_price, gst_amount, total_price, currency,
                created_at, updated_at
            FROM {TBL_USER_SUBSCRIPTIONS}
            WHERE user_id = %s 
            AND subscription_status IN ('ACTIVE', 'EXPIRED')
            AND subscription_end_date >= CURDATE()
            ORDER BY subscription_end_date DESC
            LIMIT 1
            """
            cursor.execute(select_query, [user_id])
            row = cursor.fetchone()
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    if row:
        subscription = dict(zip([
            'Subscription_ID', 'User_ID', 'Transaction_ID', 'Order_ID', 'Invoice_ID', 'Plan_ID',
            'Plan_Name', 'Plan_Type', 'Billing_Period',
            'Subscription_Start_Date', 'Subscription_End_Date', 'Duration_Days',
            'Days_Remaining', 'Current_Status', 'Original_Status',
            'Base_Price', 'GST_Amount', 'Total_Price', 'Currency',
            'Created_At', 'Updated_At'
        ], row))
        
        return JsonResponse(subscription, status=SUCCESS_STATUS)
    
    logging.info(f"No active subscription found for user {user_id}")
    return JsonResponse({
        "Message": "No active subscription found",
        "User_ID": user_id
    }, status=NOT_FOUND_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def Get_User_Subscription_History(request, user_id):
    """
    Get all subscriptions for a user (active, expired, cancelled)
    
    Endpoint: GET /api/subscription/user/<user_id>/history
    
    Example: GET /api/subscription/user/123/history
    """
    try:
        with connection.cursor() as cursor:
            # Verify user exists
            cursor.execute("SELECT COUNT(*) FROM tbl_Users WHERE ID = %s", [user_id])
            if cursor.fetchone()[0] == 0:
                logging.error(f"User ID {user_id} not found")
                return JsonResponse({"Error": "User not found"}, status=NOT_FOUND_STATUS)

            # Query all subscriptions with real-time calculations
            select_query = f"""
            SELECT 
                id, user_id, transaction_id, order_id, invoice_id, plan_id,
                plan_name, plan_type, billing_period,
                subscription_start_date, subscription_end_date, duration_days,
                DATEDIFF(subscription_end_date, CURDATE()) AS days_remaining,
                CASE 
                    WHEN subscription_end_date < CURDATE() THEN 'EXPIRED'
                    WHEN subscription_status = 'CANCELLED' THEN 'CANCELLED'
                    ELSE 'ACTIVE'
                END AS current_status,
                subscription_status AS original_status,
                base_price, gst_amount, total_price, currency,
                created_at, updated_at
            FROM {TBL_USER_SUBSCRIPTIONS}
            WHERE user_id = %s
            ORDER BY created_at DESC
            """
            cursor.execute(select_query, [user_id])
            rows = cursor.fetchall()
            
            subscriptions = []
            for row in rows:
                subscription = dict(zip([
                    'Subscription_ID', 'User_ID', 'Transaction_ID', 'Order_ID', 'Invoice_ID', 'Plan_ID',
                    'Plan_Name', 'Plan_Type', 'Billing_Period',
                    'Subscription_Start_Date', 'Subscription_End_Date', 'Duration_Days',
                    'Days_Remaining', 'Current_Status', 'Original_Status',
                    'Base_Price', 'GST_Amount', 'Total_Price', 'Currency',
                    'Created_At', 'Updated_At'
                ], row))
                subscriptions.append(subscription)
                
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse(subscriptions, safe=False, status=SUCCESS_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def Get_Subscription_By_ID(request, subscription_id):
    """
    Get subscription details by subscription ID
    
    Endpoint: GET /api/subscription/<subscription_id>
    
    Example: GET /api/subscription/45
    """
    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT 
                id, user_id, transaction_id, order_id, invoice_id, plan_id,
                plan_name, plan_type, billing_period,
                subscription_start_date, subscription_end_date, duration_days,
                DATEDIFF(subscription_end_date, CURDATE()) AS days_remaining,
                CASE 
                    WHEN subscription_end_date < CURDATE() THEN 'EXPIRED'
                    WHEN subscription_status = 'CANCELLED' THEN 'CANCELLED'
                    ELSE 'ACTIVE'
                END AS current_status,
                subscription_status AS original_status,
                base_price, gst_amount, total_price, currency,
                created_at, updated_at
            FROM {TBL_USER_SUBSCRIPTIONS}
            WHERE id = %s
            """
            cursor.execute(select_query, [subscription_id])
            row = cursor.fetchone()
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    if row:
        subscription = dict(zip([
            'Subscription_ID', 'User_ID', 'Transaction_ID', 'Order_ID', 'Invoice_ID', 'Plan_ID',
            'Plan_Name', 'Plan_Type', 'Billing_Period',
            'Subscription_Start_Date', 'Subscription_End_Date', 'Duration_Days',
            'Days_Remaining', 'Current_Status', 'Original_Status',
            'Base_Price', 'GST_Amount', 'Total_Price', 'Currency',
            'Created_At', 'Updated_At'
        ], row))
        
        return JsonResponse(subscription, status=SUCCESS_STATUS)
    
    logging.error(f"Subscription ID {subscription_id} not found")
    return JsonResponse({"Error": "Subscription not found"}, status=NOT_FOUND_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def Get_Subscription_By_Transaction_ID(request, transaction_id):
    """
    Get subscription by transaction ID
    
    Endpoint: GET /api/subscription/transaction/<transaction_id>
    
    Example: GET /api/subscription/transaction/789
    """
    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT 
                id, user_id, transaction_id, order_id, invoice_id, plan_id,
                plan_name, plan_type, billing_period,
                subscription_start_date, subscription_end_date, duration_days,
                DATEDIFF(subscription_end_date, CURDATE()) AS days_remaining,
                CASE 
                    WHEN subscription_end_date < CURDATE() THEN 'EXPIRED'
                    WHEN subscription_status = 'CANCELLED' THEN 'CANCELLED'
                    ELSE 'ACTIVE'
                END AS current_status,
                subscription_status AS original_status,
                base_price, gst_amount, total_price, currency,
                created_at, updated_at
            FROM {TBL_USER_SUBSCRIPTIONS}
            WHERE transaction_id = %s
            """
            cursor.execute(select_query, [transaction_id])
            row = cursor.fetchone()
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    if row:
        subscription = dict(zip([
            'Subscription_ID', 'User_ID', 'Transaction_ID', 'Order_ID', 'Invoice_ID', 'Plan_ID',
            'Plan_Name', 'Plan_Type', 'Billing_Period',
            'Subscription_Start_Date', 'Subscription_End_Date', 'Duration_Days',
            'Days_Remaining', 'Current_Status', 'Original_Status',
            'Base_Price', 'GST_Amount', 'Total_Price', 'Currency',
            'Created_At', 'Updated_At'
        ], row))
        
        return JsonResponse(subscription, status=SUCCESS_STATUS)
    
    logging.error(f"No subscription found for transaction ID {transaction_id}")
    return JsonResponse({"Error": "Subscription not found"}, status=NOT_FOUND_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def List_All_Subscriptions(request):
    """
    List all subscriptions (Admin use)
    
    Endpoint: GET /api/subscription/all
    
    Optional query params:
    - status: Filter by status (active, expired, cancelled)
    - plan_type: Filter by plan type (basic, pro, pro_max)
    
    Example: GET /api/subscription/all?status=active
    Example: GET /api/subscription/all?plan_type=pro
    """
    try:
        # Get query parameters
        status_filter = request.GET.get('status', None)
        plan_type_filter = request.GET.get('plan_type', None)
        
        with connection.cursor() as cursor:
            # Build query with optional filters
            where_clauses = []
            params = []
            
            if status_filter:
                if status_filter.upper() not in ['ACTIVE', 'EXPIRED', 'CANCELLED']:
                    return JsonResponse(
                        {"Error": "Invalid status. Must be: active, expired, or cancelled"},
                        status=BAD_REQUEST_STATUS
                    )
                where_clauses.append("subscription_status = %s")
                params.append(status_filter.upper())
            
            if plan_type_filter:
                if plan_type_filter.lower() not in ['basic', 'pro', 'pro_max']:
                    return JsonResponse(
                        {"Error": "Invalid plan_type. Must be: basic, pro, or pro_max"},
                        status=BAD_REQUEST_STATUS
                    )
                where_clauses.append("plan_type = %s")
                params.append(plan_type_filter.lower())
            
            where_sql = ""
            if where_clauses:
                where_sql = "WHERE " + " AND ".join(where_clauses)
            
            select_query = f"""
            SELECT 
                id, user_id, transaction_id, order_id, invoice_id, plan_id,
                plan_name, plan_type, billing_period,
                subscription_start_date, subscription_end_date, duration_days,
                DATEDIFF(subscription_end_date, CURDATE()) AS days_remaining,
                CASE 
                    WHEN subscription_end_date < CURDATE() THEN 'EXPIRED'
                    WHEN subscription_status = 'CANCELLED' THEN 'CANCELLED'
                    ELSE 'ACTIVE'
                END AS current_status,
                subscription_status AS original_status,
                base_price, gst_amount, total_price, currency,
                created_at, updated_at
            FROM {TBL_USER_SUBSCRIPTIONS}
            {where_sql}
            ORDER BY created_at DESC
            """
            cursor.execute(select_query, params)
            rows = cursor.fetchall()
            
            subscriptions = []
            for row in rows:
                subscription = dict(zip([
                    'Subscription_ID', 'User_ID', 'Transaction_ID', 'Order_ID', 'Invoice_ID', 'Plan_ID',
                    'Plan_Name', 'Plan_Type', 'Billing_Period',
                    'Subscription_Start_Date', 'Subscription_End_Date', 'Duration_Days',
                    'Days_Remaining', 'Current_Status', 'Original_Status',
                    'Base_Price', 'GST_Amount', 'Total_Price', 'Currency',
                    'Created_At', 'Updated_At'
                ], row))
                subscriptions.append(subscription)
                
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse(subscriptions, safe=False, status=SUCCESS_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def List_Expiring_Subscriptions(request):
    """
    List subscriptions expiring within X days
    
    Endpoint: GET /api/subscription/expiring?days=7
    
    Query param:
    - days: Number of days (default: 7)
    
    Example: GET /api/subscription/expiring?days=3
    """
    try:
        # Get days parameter (default 7)
        days = int(request.GET.get('days', 7))
        
        if days < 0 or days > 365:
            return JsonResponse(
                {"Error": "Days must be between 0 and 365"},
                status=BAD_REQUEST_STATUS
            )
        
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT 
                id, user_id, transaction_id, order_id, invoice_id, plan_id,
                plan_name, plan_type, billing_period,
                subscription_start_date, subscription_end_date, duration_days,
                DATEDIFF(subscription_end_date, CURDATE()) AS days_remaining,
                CASE 
                    WHEN subscription_end_date < CURDATE() THEN 'EXPIRED'
                    WHEN subscription_status = 'CANCELLED' THEN 'CANCELLED'
                    ELSE 'ACTIVE'
                END AS current_status,
                subscription_status AS original_status,
                base_price, gst_amount, total_price, currency,
                created_at, updated_at
            FROM {TBL_USER_SUBSCRIPTIONS}
            WHERE subscription_status = 'ACTIVE'
            AND subscription_end_date >= CURDATE()
            AND subscription_end_date <= DATE_ADD(CURDATE(), INTERVAL %s DAY)
            ORDER BY subscription_end_date ASC
            """
            cursor.execute(select_query, [days])
            rows = cursor.fetchall()
            
            subscriptions = []
            for row in rows:
                subscription = dict(zip([
                    'Subscription_ID', 'User_ID', 'Transaction_ID', 'Order_ID', 'Invoice_ID', 'Plan_ID',
                    'Plan_Name', 'Plan_Type', 'Billing_Period',
                    'Subscription_Start_Date', 'Subscription_End_Date', 'Duration_Days',
                    'Days_Remaining', 'Current_Status', 'Original_Status',
                    'Base_Price', 'GST_Amount', 'Total_Price', 'Currency',
                    'Created_At', 'Updated_At'
                ], row))
                subscriptions.append(subscription)
                
    except ValueError:
        return JsonResponse({"Error": "Invalid days parameter"}, status=BAD_REQUEST_STATUS)
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse({
        "Days_Range": days,
        "Total_Count": len(subscriptions),
        "Subscriptions": subscriptions
    }, safe=False, status=SUCCESS_STATUS)


@require_http_methods(["PUT"])
@csrf_exempt
def Cancel_Subscription(request, subscription_id):
    """
    Cancel a subscription (mark as CANCELLED)
    
    Endpoint: PUT /api/subscription/<subscription_id>/cancel
    
    Example: PUT /api/subscription/45/cancel
    """
    try:
        with connection.cursor() as cursor:
            # Check if subscription exists and is active
            cursor.execute(f"""
                SELECT id, user_id, subscription_status 
                FROM {TBL_USER_SUBSCRIPTIONS}
                WHERE id = %s
            """, [subscription_id])
            
            row = cursor.fetchone()
            if not row:
                logging.error(f"Subscription ID {subscription_id} not found")
                return JsonResponse(
                    {"Error": "Subscription not found"},
                    status=NOT_FOUND_STATUS
                )
            
            sub_id, user_id, current_status = row
            
            if current_status == 'CANCELLED':
                return JsonResponse(
                    {"Message": "Subscription already cancelled"},
                    status=SUCCESS_STATUS
                )
            
            if current_status == 'EXPIRED':
                return JsonResponse(
                    {"Error": "Cannot cancel an expired subscription"},
                    status=BAD_REQUEST_STATUS
                )
            
            # Update to CANCELLED
            cursor.execute(f"""
                UPDATE {TBL_USER_SUBSCRIPTIONS}
                SET subscription_status = 'CANCELLED'
                WHERE id = %s
            """, [subscription_id])
            
            logging.info(f"Subscription {subscription_id} cancelled for user {user_id}")
            
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse({
        "Message": "Subscription cancelled successfully",
        "Subscription_ID": subscription_id,
        "User_ID": user_id,
        "New_Status": "CANCELLED"
    }, status=SUCCESS_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def Get_Subscription_Stats(request):
    """
    Get subscription statistics (Admin use)
    
    Endpoint: GET /api/subscription/stats
    
    Returns counts by status and plan type
    """
    try:
        with connection.cursor() as cursor:
            # Count by status
            cursor.execute(f"""
                SELECT 
                    subscription_status,
                    COUNT(*) as count
                FROM {TBL_USER_SUBSCRIPTIONS}
                GROUP BY subscription_status
            """)
            status_counts = {row[0]: row[1] for row in cursor.fetchall()}
            
            # Count by plan type
            cursor.execute(f"""
                SELECT 
                    plan_type,
                    COUNT(*) as count
                FROM {TBL_USER_SUBSCRIPTIONS}
                GROUP BY plan_type
            """)
            plan_counts = {row[0]: row[1] for row in cursor.fetchall()}
            
            # Total revenue
            cursor.execute(f"""
                SELECT 
                    SUM(total_price) as total_revenue,
                    COUNT(*) as total_subscriptions
                FROM {TBL_USER_SUBSCRIPTIONS}
            """)
            revenue_row = cursor.fetchone()
            
            # Active subscriptions expiring soon (7 days)
            cursor.execute(f"""
                SELECT COUNT(*) 
                FROM {TBL_USER_SUBSCRIPTIONS}
                WHERE subscription_status = 'ACTIVE'
                AND subscription_end_date >= CURDATE()
                AND subscription_end_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
            """)
            expiring_soon = cursor.fetchone()[0]
            
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse({
        "Status_Counts": status_counts,
        "Plan_Type_Counts": plan_counts,
        "Total_Revenue": float(revenue_row[0]) if revenue_row[0] else 0,
        "Total_Subscriptions": revenue_row[1],
        "Expiring_Within_7_Days": expiring_soon
    }, status=SUCCESS_STATUS)


# ==================== URL PATTERNS ====================

urlpatterns = [
    # User-specific endpoints
    path('api/subscription/user/<int:user_id>/active', Get_User_Active_Subscription, name='Get_User_Active_Subscription'),
    path('api/subscription/user/<int:user_id>/history', Get_User_Subscription_History, name='Get_User_Subscription_History'),
    
    # Subscription details
    path('api/subscription/<int:subscription_id>', Get_Subscription_By_ID, name='Get_Subscription_By_ID'),
    path('api/subscription/transaction/<int:transaction_id>', Get_Subscription_By_Transaction_ID, name='Get_Subscription_By_Transaction_ID'),
    
    # List endpoints
    path('api/subscription/all', List_All_Subscriptions, name='List_All_Subscriptions'),
    path('api/subscription/expiring', List_Expiring_Subscriptions, name='List_Expiring_Subscriptions'),
    
    # Actions
    path('api/subscription/<int:subscription_id>/cancel', Cancel_Subscription, name='Cancel_Subscription'),
    
    # Stats
    path('api/subscription/stats', Get_Subscription_Stats, name='Get_Subscription_Stats'),
]