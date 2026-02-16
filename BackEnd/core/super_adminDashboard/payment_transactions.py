# core/super_adminDashboard/payment_transaction.py

from django.db import connection, transaction
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.urls import path
from django.db.utils import ProgrammingError, OperationalError
from django.utils import timezone
from django.db import models
import json
import logging
import hmac
import hashlib
import razorpay
import os
import uuid

# Global Variables - Razorpay Configuration
RAZORPAY_KEY_ID = os.getenv('RAZORPAY_KEY_ID')
RAZORPAY_KEY_SECRET = os.getenv('RAZORPAY_KEY_SECRET')

# Initialize Razorpay Client
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# Table Names
TBL_PAYMENT_ORDERS = 'tbl_payment_orders'
TBL_PAYMENT_TRANSACTIONS = 'tbl_payment_transactions'

# Status Codes
SUCCESS_STATUS = 200
CREATED_STATUS = 201
BAD_REQUEST_STATUS = 400
UNAUTHORIZED_STATUS = 401
FORBIDDEN_STATUS = 403
NOT_FOUND_STATUS = 404
SERVER_ERROR_STATUS = 500

# Configure Logging
logging.basicConfig(
    filename='payment_transactions_debug.log',
    level=logging.DEBUG,
    format='%(asctime)s %(levelname)s %(message)s'
)

class PaymentTransaction(models.Model):
    id = models.AutoField(primary_key=True)
    razorpay_payment_id = models.CharField(max_length=50, unique=True)
    order_id = models.ForeignKey(
        'core.PaymentOrder', on_delete=models.RESTRICT, db_column='order_id',
        related_name='transactions'
    )
    razorpay_order_id = models.CharField(max_length=50)
    user_id = models.ForeignKey(
        'core.User', on_delete=models.RESTRICT, db_column='user_id',
        related_name='payment_transactions'
    )
    amount = models.IntegerField()
    currency = models.CharField(max_length=10, default='INR')
    payment_method = models.CharField(max_length=50, blank=True, null=True)
    bank = models.CharField(max_length=100, blank=True, null=True)
    vpa = models.CharField(max_length=100, blank=True, null=True)
    payment_status = models.CharField(max_length=10, default='CREATED')
    razorpay_signature = models.CharField(max_length=255, blank=True, null=True)
    verified = models.BooleanField(default=False)
    error_code = models.CharField(max_length=50, blank=True, null=True)
    error_reason = models.CharField(max_length=255, blank=True, null=True)
    error_description = models.TextField(blank=True, null=True)
    invoice_pdf_path = models.CharField(max_length=255, blank=True, null=True)
    invoice_number = models.CharField(max_length=100, blank=True, null=True)
    invoice_s3_url = models.CharField(max_length=500, blank=True, null=True)
    invoice_mongodb_id = models.CharField(max_length=50, blank=True, null=True)
    invoice_generated_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_payment_transactions'
        app_label = 'core'


def create_payment_transactions_table():
    """Create tbl_payment_transactions table with all required columns and indexes"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tbl_payment_transactions (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    razorpay_payment_id VARCHAR(50) NOT NULL UNIQUE COMMENT 'pay_xxx from Razorpay',
                    order_id INT NOT NULL COMMENT 'FK to tbl_payment_orders',
                    razorpay_order_id VARCHAR(50) NOT NULL COMMENT 'order_xxx for quick lookup',
                    user_id INT NOT NULL,
                    amount INT NOT NULL COMMENT 'Amount in paise',
                    currency VARCHAR(10) DEFAULT 'INR',
                    payment_method VARCHAR(50) DEFAULT NULL COMMENT 'card/upi/netbanking/wallet',
                    bank VARCHAR(100) DEFAULT NULL COMMENT 'Bank name if applicable',
                    vpa VARCHAR(100) DEFAULT NULL COMMENT 'UPI ID if UPI payment',
                    payment_status ENUM('CREATED','AUTHORIZED','CAPTURED','FAILED','REFUNDED') DEFAULT 'CREATED',
                    razorpay_signature VARCHAR(255) DEFAULT NULL COMMENT 'Signature for verification',
                    verified TINYINT(1) DEFAULT 0 COMMENT 'Backend verification status',
                    error_code VARCHAR(50) DEFAULT NULL,
                    error_reason VARCHAR(255) DEFAULT NULL,
                    error_description TEXT,
                    invoice_pdf_path VARCHAR(255) DEFAULT NULL,
                    invoice_number VARCHAR(100) DEFAULT NULL COMMENT 'Invoice number reference',
                    invoice_s3_url VARCHAR(500) DEFAULT NULL COMMENT 'S3 path to invoice PDF',
                    invoice_mongodb_id VARCHAR(50) DEFAULT NULL COMMENT 'MongoDB ObjectId reference',
                    invoice_generated_at DATETIME DEFAULT NULL COMMENT 'When invoice was generated',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    KEY idx_order_id (order_id),
                    KEY idx_user_id (user_id),
                    KEY idx_payment_status (payment_status),
                    KEY idx_verified (verified),
                    KEY idx_invoice_number (invoice_number),
                    KEY idx_invoice_generated_at (invoice_generated_at),
                    CONSTRAINT FK_PaymentTxn_Orders FOREIGN KEY (order_id) REFERENCES tbl_payment_orders (id) ON DELETE RESTRICT,
                    CONSTRAINT FK_PaymentTxn_Users FOREIGN KEY (user_id) REFERENCES tbl_Users (ID) ON DELETE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """)
            logging.debug("tbl_payment_transactions table created successfully")
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Failed to create tbl_payment_transactions table: {e}")
   
# ==================== HELPER FUNCTIONS ====================

def verify_razorpay_signature(razorpay_order_id, razorpay_payment_id, razorpay_signature):
    """Verify Razorpay payment signature for security"""
    try:
        # Create signature string: order_id|payment_id
        message = f"{razorpay_order_id}|{razorpay_payment_id}"
        
        # Generate HMAC SHA256 signature
        generated_signature = hmac.new(
            RAZORPAY_KEY_SECRET.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        # Compare signatures
        is_valid = hmac.compare_digest(generated_signature, razorpay_signature)
        logging.debug(f"Signature verification for payment {razorpay_payment_id}: {is_valid}")
        return is_valid
    except Exception as e:
        logging.error(f"Signature verification error: {e}")
        return False


# ==================== PAYMENT TRANSACTIONS APIs ====================

@require_http_methods(["POST"])
@csrf_exempt
def Verify_Payment_Transaction(request):
    """
    Step 2: Verify and store payment transaction after user completes payment
    This is called by frontend after Razorpay payment popup closes
    
    Expected JSON:
    {
        "razorpay_order_id": "order_NXR7KhP2J8fFJz",
        "razorpay_payment_id": "pay_NXR8abc123",
        "razorpay_signature": "abc123def456..."
    }
    """
    try:
        logging.debug(f"Raw request body: {request.body}")
        data = json.loads(request.body)
        logging.debug(f"Parsed JSON: {json.dumps(data, indent=2)}")
        
        if isinstance(data, list) and len(data) == 1:
            data = data[0]
            logging.debug(f"Unwrapped list to: {json.dumps(data, indent=2)}")
        elif isinstance(data, list):
            logging.error("Expected single payment object, got list")
            return JsonResponse(
                {"Error": "Expected a single payment object, not a list"},
                status=BAD_REQUEST_STATUS
            )
    except json.JSONDecodeError as e:
        logging.error(f"Invalid JSON: {e}")
        return JsonResponse({"Error": "Invalid JSON format"}, status=BAD_REQUEST_STATUS)

    # Validate required fields
    required_fields = ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature']
    missing_fields = [
        field for field in required_fields 
        if field not in data or data[field] is None or 
        (isinstance(data[field], str) and data[field].strip() == "")
    ]
    if missing_fields:
        logging.error(f"Missing or empty fields: {', '.join(missing_fields)}")
        return JsonResponse(
            {"Error": f"Missing or empty required fields: {', '.join(missing_fields)}"},
            status=BAD_REQUEST_STATUS
        )

    razorpay_order_id = data['razorpay_order_id']
    razorpay_payment_id = data['razorpay_payment_id']
    razorpay_signature = data['razorpay_signature']

    try:
        # Step 1: Verify signature
        is_signature_valid = verify_razorpay_signature(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        )

        if not is_signature_valid:
            logging.error(f"Invalid signature for payment {razorpay_payment_id}")
            return JsonResponse(
                {"Error": "Invalid payment signature. Payment verification failed."},
                status=UNAUTHORIZED_STATUS
            )

        # Step 2: Fetch order details from database
        with connection.cursor() as cursor:
            cursor.execute(f"""
                SELECT id, user_id, purpose, reference_id, amount, currency, order_status
                FROM {TBL_PAYMENT_ORDERS}
                WHERE razorpay_order_id = %s
            """, [razorpay_order_id])
            order_row = cursor.fetchone()

        if not order_row:
            logging.error(f"Order not found: {razorpay_order_id}")
            return JsonResponse(
                {"Error": "Order not found"},
                status=NOT_FOUND_STATUS
            )

        order_id, user_id, purpose, reference_id, amount, currency, order_status = order_row

        # Step 3: Fetch payment details from Razorpay
        try:
            payment_details = razorpay_client.payment.fetch(razorpay_payment_id)
            logging.debug(f"Payment details from Razorpay: {payment_details}")
        except razorpay.errors.BadRequestError as e:
            logging.error(f"Razorpay error fetching payment: {e}")
            return JsonResponse(
                {"Error": f"Failed to fetch payment details from Razorpay: {str(e)}"},
                status=BAD_REQUEST_STATUS
            )

        # Extract payment information
        payment_method = payment_details.get('method', None)
        payment_status = payment_details.get('status', 'created')  # created/authorized/captured/failed
        payment_amount = payment_details.get('amount', 0)
        payment_currency = payment_details.get('currency', 'INR')
        
        # Extract bank/VPA info
        bank = payment_details.get('bank', None)
        vpa = payment_details.get('vpa', None)
        
        # Map Razorpay status to our enum
        status_mapping = {
            'created': 'CREATED',
            'authorized': 'AUTHORIZED',
            'captured': 'CAPTURED',
            'failed': 'FAILED',
            'refunded': 'REFUNDED'
        }
        mapped_status = status_mapping.get(payment_status.lower(), 'CREATED')

        # Step 4: Check for errors in payment
        error_code = payment_details.get('error_code', None)
        error_reason = payment_details.get('error_reason', None)
        error_description = payment_details.get('error_description', None)

        # Step 5: Store transaction in database
        with transaction.atomic():
            with connection.cursor() as cursor:
                # Check if transaction already exists (prevent duplicate)
                cursor.execute(f"""
                    SELECT id FROM {TBL_PAYMENT_TRANSACTIONS}
                    WHERE razorpay_payment_id = %s
                """, [razorpay_payment_id])
                
                existing_txn = cursor.fetchone()
                if existing_txn:
                    logging.warning(f"Transaction already exists: {razorpay_payment_id}")
                    return JsonResponse(
                        {"Error": "Transaction already processed"},
                        status=BAD_REQUEST_STATUS
                    )

                # Generate UUID transaction reference (23 chars)
                transaction_uuid = str(uuid.uuid4()).replace('-', '')[:23].upper()
                
                insert_query = f"""
                INSERT INTO {TBL_PAYMENT_TRANSACTIONS} (
                    razorpay_payment_id, order_id, razorpay_order_id, user_id,
                    amount, currency, payment_method, bank, vpa,
                    payment_status, razorpay_signature, verified,
                    error_code, error_reason, error_description
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                values = [
                    razorpay_payment_id,
                    order_id,
                    razorpay_order_id,
                    user_id,
                    payment_amount,
                    payment_currency,
                    payment_method,
                    bank,
                    vpa,
                    mapped_status,
                    razorpay_signature,
                    1,  # verified = true (signature is valid)
                    error_code,
                    error_reason,
                    error_description
                ]
                cursor.execute(insert_query, values)
                cursor.execute("SELECT LAST_INSERT_ID()")
                transaction_id = cursor.fetchone()[0]

                # Update order status to PAID if payment captured
                if mapped_status == 'CAPTURED':
                    cursor.execute(f"""
                        UPDATE {TBL_PAYMENT_ORDERS}
                        SET order_status = 'PAID'
                        WHERE id = %s
                    """, [order_id])
                    logging.info(f"Order {order_id} marked as PAID")
                    
                    # ==================== INVOICE GENERATION ====================
                    invoice_id = None
                    try:
                        from .invoice_service import generate_and_send_invoice
                        
                        logging.info(f"Triggering invoice generation for transaction_id: {transaction_id}")
                        invoice_result = generate_and_send_invoice(transaction_id)
                        
                        if invoice_result['success']:
                            logging.info(f"Invoice generated successfully: {invoice_result['invoice_number']}")
                            invoice_id = invoice_result.get('invoice_id')
                        else:
                            logging.error(f"Invoice generation failed: {invoice_result.get('error')}")
                            
                    except Exception as invoice_error:
                        logging.error(f"Error in invoice generation: {invoice_error}", exc_info=True)
                    # ==================== END INVOICE GENERATION ====================
                    
                    # ==================== SUBSCRIPTION CREATION ====================
                    try:
                        from .subscription_service import create_user_subscription
                        
                        logging.info(f"Triggering subscription creation for transaction_id: {transaction_id}")
                        subscription_result = create_user_subscription(transaction_id, invoice_id)
                        
                        if subscription_result['success']:
                            logging.info(f"Subscription created successfully: Subscription ID {subscription_result['subscription_id']}")
                        else:
                            logging.error(f"Subscription creation failed: {subscription_result.get('error')}")
                            
                    except Exception as subscription_error:
                        logging.error(f"Error in subscription creation: {subscription_error}", exc_info=True)
                    # ==================== END SUBSCRIPTION CREATION ====================
                    
        logging.info(f"Payment transaction created successfully: Transaction ID {transaction_id}")
        
        return JsonResponse({
            "Message": "Payment verified and recorded successfully",
            "Transaction_ID": transaction_id,
            "Transaction_UUID": transaction_uuid,
            "Order_ID": order_id,
            "Payment_Status": mapped_status,
            "Amount": payment_amount / 100,  # Convert paise to rupees
            "Payment_Method": payment_method,
            "Verified": True
        }, status=CREATED_STATUS)

    except Exception as e:
        logging.error(f"Error verifying payment: {e}")
        return JsonResponse(
            {"Error": f"Failed to verify payment: {str(e)}"},
            status=SERVER_ERROR_STATUS
        )

@require_http_methods(["POST"])
@csrf_exempt
def Record_Failed_Payment(request):
    """
    Record a failed payment attempt
    Called when payment fails on Razorpay side
    
    Expected JSON:
    {
        "razorpay_order_id": "order_NXR7KhP2J8fFJz",
        "razorpay_payment_id": "pay_NXR9failed",
        "error_code": "BAD_REQUEST_ERROR",
        "error_reason": "payment_failed",
        "error_description": "Payment failed due to insufficient funds"
    }
    """
    try:
        logging.debug(f"Raw request body: {request.body}")
        data = json.loads(request.body)
        logging.debug(f"Parsed JSON: {json.dumps(data, indent=2)}")
        
        if isinstance(data, list) and len(data) == 1:
            data = data[0]
            logging.debug(f"Unwrapped list to: {json.dumps(data, indent=2)}")
        elif isinstance(data, list):
            logging.error("Expected single payment object, got list")
            return JsonResponse(
                {"Error": "Expected a single payment object, not a list"},
                status=BAD_REQUEST_STATUS
            )
    except json.JSONDecodeError as e:
        logging.error(f"Invalid JSON: {e}")
        return JsonResponse({"Error": "Invalid JSON format"}, status=BAD_REQUEST_STATUS)

    # Validate required fields
    required_fields = ['razorpay_order_id', 'razorpay_payment_id']
    missing_fields = [
        field for field in required_fields 
        if field not in data or data[field] is None or 
        (isinstance(data[field], str) and data[field].strip() == "")
    ]
    if missing_fields:
        logging.error(f"Missing or empty fields: {', '.join(missing_fields)}")
        return JsonResponse(
            {"Error": f"Missing or empty required fields: {', '.join(missing_fields)}"},
            status=BAD_REQUEST_STATUS
        )

    razorpay_order_id = data['razorpay_order_id']
    razorpay_payment_id = data['razorpay_payment_id']
    error_code = data.get('error_code', None)
    error_reason = data.get('error_reason', None)
    error_description = data.get('error_description', None)

    try:
        # Fetch order details
        with connection.cursor() as cursor:
            cursor.execute(f"""
                SELECT id, user_id, amount, currency
                FROM {TBL_PAYMENT_ORDERS}
                WHERE razorpay_order_id = %s
            """, [razorpay_order_id])
            order_row = cursor.fetchone()

        if not order_row:
            logging.error(f"Order not found: {razorpay_order_id}")
            return JsonResponse(
                {"Error": "Order not found"},
                status=NOT_FOUND_STATUS
            )

        order_id, user_id, amount, currency = order_row

        # Try to fetch payment details from Razorpay (might fail if payment never created)
        payment_method = None
        bank = None
        try:
            payment_details = razorpay_client.payment.fetch(razorpay_payment_id)
            payment_method = payment_details.get('method', None)
            bank = payment_details.get('bank', None)
            
            # Extract error details from Razorpay if not provided
            if not error_code:
                error_code = payment_details.get('error_code', None)
            if not error_reason:
                error_reason = payment_details.get('error_reason', None)
            if not error_description:
                error_description = payment_details.get('error_description', None)
        except:
            logging.warning(f"Could not fetch payment details from Razorpay: {razorpay_payment_id}")

        # Store failed transaction
        with transaction.atomic():
            with connection.cursor() as cursor:
                # Check if transaction already exists
                cursor.execute(f"""
                    SELECT id FROM {TBL_PAYMENT_TRANSACTIONS}
                    WHERE razorpay_payment_id = %s
                """, [razorpay_payment_id])
                
                existing_txn = cursor.fetchone()
                if existing_txn:
                    logging.warning(f"Failed transaction already exists: {razorpay_payment_id}")
                    return JsonResponse(
                        {"Error": "Transaction already processed"},
                        status=BAD_REQUEST_STATUS
                    )

                insert_query = f"""
                INSERT INTO {TBL_PAYMENT_TRANSACTIONS} (
                    razorpay_payment_id, order_id, razorpay_order_id, user_id,
                    amount, currency, payment_method, bank,
                    payment_status, verified,
                    error_code, error_reason, error_description
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                values = [
                    razorpay_payment_id,
                    order_id,
                    razorpay_order_id,
                    user_id,
                    amount,
                    currency,
                    payment_method,
                    bank,
                    'FAILED',
                    0,  # verified = false for failed payments
                    error_code,
                    error_reason,
                    error_description
                ]
                cursor.execute(insert_query, values)
                cursor.execute("SELECT LAST_INSERT_ID()")
                transaction_id = cursor.fetchone()[0]

        logging.info(f"Failed payment recorded: Transaction ID {transaction_id}")
        
        return JsonResponse({
            "Message": "Failed payment recorded successfully",
            "Transaction_ID": transaction_id,
            "Order_ID": order_id,
            "Payment_Status": "FAILED",
            "Error_Code": error_code,
            "Error_Reason": error_reason,
            "Error_Description": error_description
        }, status=CREATED_STATUS)

    except Exception as e:
        logging.error(f"Error recording failed payment: {e}")
        return JsonResponse(
            {"Error": f"Failed to record failed payment: {str(e)}"},
            status=SERVER_ERROR_STATUS
        )


@require_http_methods(["GET"])
@csrf_exempt
def Get_Payment_Transaction(request, transaction_id):
    """Get payment transaction details by internal transaction ID"""
    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT id, razorpay_payment_id, order_id, razorpay_order_id, user_id,
                   amount, currency, payment_method, bank, vpa, payment_status,
                   razorpay_signature, verified, error_code, error_reason,
                   error_description, created_at, updated_at
            FROM {TBL_PAYMENT_TRANSACTIONS}
            WHERE id = %s
            """
            cursor.execute(select_query, [transaction_id])
            row = cursor.fetchone()
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    if row:
        txn = dict(zip([
            'Transaction_ID', 'Razorpay_Payment_ID', 'Order_ID', 'Razorpay_Order_ID', 'User_ID',
            'Amount_Paise', 'Currency', 'Payment_Method', 'Bank', 'VPA', 'Payment_Status',
            'Razorpay_Signature', 'Verified', 'Error_Code', 'Error_Reason',
            'Error_Description', 'Created_At', 'Updated_At'
        ], row))
        
        # Convert paise to rupees
        txn['Amount_Rupees'] = txn['Amount_Paise'] / 100
        
        return JsonResponse(txn, status=SUCCESS_STATUS)
    
    logging.error(f"Transaction ID {transaction_id} not found")
    return JsonResponse({"Error": "Transaction not found"}, status=NOT_FOUND_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def Get_Payment_Transaction_By_Razorpay_ID(request, razorpay_payment_id):
    """Get payment transaction details by Razorpay payment ID"""
    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT id, razorpay_payment_id, order_id, razorpay_order_id, user_id,
                   amount, currency, payment_method, bank, vpa, payment_status,
                   razorpay_signature, verified, error_code, error_reason,
                   error_description, created_at, updated_at
            FROM {TBL_PAYMENT_TRANSACTIONS}
            WHERE razorpay_payment_id = %s
            """
            cursor.execute(select_query, [razorpay_payment_id])
            row = cursor.fetchone()
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    if row:
        txn = dict(zip([
            'Transaction_ID', 'Razorpay_Payment_ID', 'Order_ID', 'Razorpay_Order_ID', 'User_ID',
            'Amount_Paise', 'Currency', 'Payment_Method', 'Bank', 'VPA', 'Payment_Status',
            'Razorpay_Signature', 'Verified', 'Error_Code', 'Error_Reason',
            'Error_Description', 'Created_At', 'Updated_At'
        ], row))
        
        # Convert paise to rupees
        txn['Amount_Rupees'] = txn['Amount_Paise'] / 100
        
        return JsonResponse(txn, status=SUCCESS_STATUS)
    
    logging.error(f"Razorpay payment ID {razorpay_payment_id} not found")
    return JsonResponse({"Error": "Transaction not found"}, status=NOT_FOUND_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def List_Order_Transactions(request, order_id):
    """List all payment transactions for a specific order"""
    try:
        with connection.cursor() as cursor:
            # Verify order exists
            cursor.execute(f"SELECT COUNT(*) FROM {TBL_PAYMENT_ORDERS} WHERE id = %s", [order_id])
            if cursor.fetchone()[0] == 0:
                logging.error(f"Order ID {order_id} not found")
                return JsonResponse({"Error": "Order not found"}, status=NOT_FOUND_STATUS)

            select_query = f"""
            SELECT id, razorpay_payment_id, order_id, razorpay_order_id, user_id,
                   amount, currency, payment_method, bank, vpa, payment_status,
                   razorpay_signature, verified, error_code, error_reason,
                   error_description, created_at, updated_at
            FROM {TBL_PAYMENT_TRANSACTIONS}
            WHERE order_id = %s
            ORDER BY created_at DESC
            """
            cursor.execute(select_query, [order_id])
            rows = cursor.fetchall()
            
            transactions = []
            for row in rows:
                txn = dict(zip([
                    'Transaction_ID', 'Razorpay_Payment_ID', 'Order_ID', 'Razorpay_Order_ID', 'User_ID',
                    'Amount_Paise', 'Currency', 'Payment_Method', 'Bank', 'VPA', 'Payment_Status',
                    'Razorpay_Signature', 'Verified', 'Error_Code', 'Error_Reason',
                    'Error_Description', 'Created_At', 'Updated_At'
                ], row))
                
                # Convert paise to rupees
                txn['Amount_Rupees'] = txn['Amount_Paise'] / 100
                transactions.append(txn)
                
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse(transactions, safe=False, status=SUCCESS_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def List_User_Transactions(request, user_id):
    """List all payment transactions for a specific user"""
    try:
        with connection.cursor() as cursor:
            # Verify user exists
            cursor.execute("SELECT COUNT(*) FROM tbl_Users WHERE ID = %s", [user_id])
            if cursor.fetchone()[0] == 0:
                logging.error(f"User ID {user_id} not found")
                return JsonResponse({"Error": "User not found"}, status=NOT_FOUND_STATUS)

            select_query = f"""
            SELECT id, razorpay_payment_id, order_id, razorpay_order_id, user_id,
                   amount, currency, payment_method, bank, vpa, payment_status,
                   razorpay_signature, verified, error_code, error_reason,
                   error_description, created_at, updated_at
            FROM {TBL_PAYMENT_TRANSACTIONS}
            WHERE user_id = %s
            ORDER BY created_at DESC
            """
            cursor.execute(select_query, [user_id])
            rows = cursor.fetchall()
            
            transactions = []
            for row in rows:
                txn = dict(zip([
                    'Transaction_ID', 'Razorpay_Payment_ID', 'Order_ID', 'Razorpay_Order_ID', 'User_ID',
                    'Amount_Paise', 'Currency', 'Payment_Method', 'Bank', 'VPA', 'Payment_Status',
                    'Razorpay_Signature', 'Verified', 'Error_Code', 'Error_Reason',
                    'Error_Description', 'Created_At', 'Updated_At'
                ], row))
                
                # Convert paise to rupees
                txn['Amount_Rupees'] = txn['Amount_Paise'] / 100
                transactions.append(txn)
                
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse(transactions, safe=False, status=SUCCESS_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def List_All_Transactions(request):
    """List all payment transactions (Admin use)"""
    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT id, razorpay_payment_id, order_id, razorpay_order_id, user_id,
                   amount, currency, payment_method, bank, vpa, payment_status,
                   razorpay_signature, verified, error_code, error_reason,
                   error_description, created_at, updated_at
            FROM {TBL_PAYMENT_TRANSACTIONS}
            ORDER BY created_at DESC
            """
            cursor.execute(select_query)
            rows = cursor.fetchall()
            
            transactions = []
            for row in rows:
                txn = dict(zip([
                    'Transaction_ID', 'Razorpay_Payment_ID', 'Order_ID', 'Razorpay_Order_ID', 'User_ID',
                    'Amount_Paise', 'Currency', 'Payment_Method', 'Bank', 'VPA', 'Payment_Status',
                    'Razorpay_Signature', 'Verified', 'Error_Code', 'Error_Reason',
                    'Error_Description', 'Created_At', 'Updated_At'
                ], row))
                
                # Convert paise to rupees
                txn['Amount_Rupees'] = txn['Amount_Paise'] / 100
                transactions.append(txn)
                
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse(transactions, safe=False, status=SUCCESS_STATUS)


# ==================== URL PATTERNS ====================

urlpatterns = [
    path('api/payment/transaction/verify', Verify_Payment_Transaction, name='Verify_Payment_Transaction'),
    path('api/payment/transaction/failed', Record_Failed_Payment, name='Record_Failed_Payment'),
    path('api/payment/transaction/<int:transaction_id>', Get_Payment_Transaction, name='Get_Payment_Transaction'),
    path('api/payment/transaction/razorpay/<str:razorpay_payment_id>', Get_Payment_Transaction_By_Razorpay_ID, name='Get_Payment_Transaction_By_Razorpay_ID'),
    path('api/payment/transactions/order/<int:order_id>', List_Order_Transactions, name='List_Order_Transactions'),
    path('api/payment/transactions/user/<int:user_id>', List_User_Transactions, name='List_User_Transactions'),
    path('api/payment/transactions/all', List_All_Transactions, name='List_All_Transactions'),
]