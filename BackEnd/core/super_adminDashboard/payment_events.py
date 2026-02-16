# core/super_adminDashboard/payment_events.py

from django.db import connection, transaction
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.urls import path
from django.db.utils import ProgrammingError, OperationalError
from django.utils import timezone
import json
from django.db import models
import logging
import hmac
import hashlib
import os
from django.core.mail import EmailMessage
from django.conf import settings
# from .invoice_generator import generate_payment_invoice, generate_invoice_filename
import tempfile

# Global Variables
RAZORPAY_WEBHOOK_SECRET = os.getenv('RAZORPAY_WEBHOOK_SECRET', '')

# Table Names
TBL_PAYMENT_EVENTS = 'tbl_payment_events'
TBL_PAYMENT_TRANSACTIONS = 'tbl_payment_transactions'
TBL_PAYMENT_ORDERS = 'tbl_payment_orders'

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
    filename='payment_events_debug.log',
    level=logging.DEBUG,
    format='%(asctime)s %(levelname)s %(message)s'
)

class PaymentEvent(models.Model):
    id = models.AutoField(primary_key=True)
    razorpay_event_id = models.CharField(max_length=50, unique=True)
    event_type = models.CharField(max_length=100)
    razorpay_payment_id = models.CharField(max_length=50, blank=True, null=True)
    razorpay_order_id = models.CharField(max_length=50, blank=True, null=True)
    payload = models.JSONField()
    processed = models.BooleanField(default=False)
    processed_at = models.DateTimeField(blank=True, null=True)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tbl_payment_events'
        app_label = 'core'
        indexes = [
            models.Index(fields=['event_type'], name='idx_pe_event_type'),
            models.Index(fields=['processed'], name='idx_pe_processed'),
            models.Index(fields=['razorpay_payment_id'], name='idx_pe_payment_id'),
            models.Index(fields=['razorpay_order_id'], name='idx_pe_order_id'),
        ]


def create_payment_events_table():
    """Create tbl_payment_events table for Razorpay webhook events"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tbl_payment_events (
                    id INT NOT NULL AUTO_INCREMENT,
                    razorpay_event_id VARCHAR(50) NOT NULL COMMENT 'event_xxx from Razorpay',
                    event_type VARCHAR(100) NOT NULL COMMENT 'payment.captured/payment.failed/refund.processed',
                    razorpay_payment_id VARCHAR(50) DEFAULT NULL,
                    razorpay_order_id VARCHAR(50) DEFAULT NULL,
                    payload JSON NOT NULL COMMENT 'Complete webhook payload for debugging',
                    processed TINYINT(1) DEFAULT 0 COMMENT 'Has this event been processed',
                    processed_at DATETIME DEFAULT NULL,
                    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    UNIQUE KEY razorpay_event_id (razorpay_event_id),
                    INDEX idx_event_type (event_type),
                    INDEX idx_processed (processed),
                    INDEX idx_payment_id (razorpay_payment_id),
                    INDEX idx_order_id (razorpay_order_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """)
            logger.info("✓ tbl_payment_events table ready")
            return True
    except Exception as e:
        logger.error(f"✗ Error creating payment events table: {e}")
        return False

# ==================== HELPER FUNCTIONS ====================

def verify_webhook_signature(payload, signature, secret):
    """Verify Razorpay webhook signature"""
    try:
        # Generate signature from payload
        generated_signature = hmac.new(
            secret.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        # Compare signatures
        is_valid = hmac.compare_digest(generated_signature, signature)
        logging.debug(f"Webhook signature verification: {is_valid}")
        return is_valid
    except Exception as e:
        logging.error(f"Webhook signature verification error: {e}")
        return False


# ==================== PAYMENT EVENTS APIs ====================

@require_http_methods(["POST"])
@csrf_exempt
def Razorpay_Webhook_Handler(request):
    """
    Webhook endpoint for Razorpay
    This is called by Razorpay when payment events occur
    
    Configure this URL in Razorpay Dashboard:
    https://your-domain.com/api/payment/webhook
    
    Events: payment.captured, payment.failed, payment.authorized, refund.processed, etc.
    """
    try:
        # Get raw payload
        payload = request.body.decode('utf-8')
        logging.debug(f"Webhook payload received: {payload}")
        
        # Get signature from headers
        webhook_signature = request.META.get('HTTP_X_RAZORPAY_SIGNATURE', '')
        
        if not webhook_signature:
            logging.error("No webhook signature in headers")
            return JsonResponse(
                {"Error": "Missing webhook signature"},
                status=UNAUTHORIZED_STATUS
            )
        
        # Verify signature (if webhook secret is configured)
        if RAZORPAY_WEBHOOK_SECRET:
            is_valid = verify_webhook_signature(payload, webhook_signature, RAZORPAY_WEBHOOK_SECRET)
            if not is_valid:
                logging.error("Invalid webhook signature")
                return JsonResponse(
                    {"Error": "Invalid webhook signature"},
                    status=UNAUTHORIZED_STATUS
                )
        
        # Parse payload
        data = json.loads(payload)
        logging.debug(f"Parsed webhook data: {json.dumps(data, indent=2)}")
        
        # Extract event details
        event_id = data.get('event', '')
        event_type = data.get('event', '')  # e.g., "payment.captured"
        
        # Extract payment/order IDs from payload
        payload_data = data.get('payload', {})
        payment_entity = payload_data.get('payment', {}).get('entity', {})
        
        razorpay_payment_id = payment_entity.get('id', None)
        razorpay_order_id = payment_entity.get('order_id', None)
        
        # Check if event already exists (prevent duplicate processing)
        with connection.cursor() as cursor:
            cursor.execute(f"""
                SELECT id, processed FROM {TBL_PAYMENT_EVENTS}
                WHERE razorpay_event_id = %s
            """, [event_id])
            existing_event = cursor.fetchone()
            
            if existing_event:
                event_db_id, is_processed = existing_event
                logging.warning(f"Webhook event already exists: {event_id}, processed: {is_processed}")
                return JsonResponse({
                    "Message": "Event already processed",
                    "Event_ID": event_db_id,
                    "Processed": bool(is_processed)
                }, status=SUCCESS_STATUS)
        
        # Store event in database
        with transaction.atomic():
            with connection.cursor() as cursor:
                insert_query = f"""
                INSERT INTO {TBL_PAYMENT_EVENTS} (
                    razorpay_event_id, event_type, razorpay_payment_id,
                    razorpay_order_id, payload, processed
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                """
                values = [
                    event_id,
                    event_type,
                    razorpay_payment_id,
                    razorpay_order_id,
                    json.dumps(data),  # Store full payload as JSON
                    0  # Not processed yet
                ]
                cursor.execute(insert_query, values)
                cursor.execute("SELECT LAST_INSERT_ID()")
                event_db_id = cursor.fetchone()[0]
        
        logging.info(f"Webhook event stored: Event ID {event_db_id}, Type: {event_type}")
        
        # Process event based on type (optional - can be done separately)
        process_webhook_event(event_db_id, event_type, payment_entity)
        
        # Return success to Razorpay
        return JsonResponse({
            "Message": "Webhook received and processed successfully",
            "Event_ID": event_db_id,
            "Event_Type": event_type
        }, status=CREATED_STATUS)
        
    except json.JSONDecodeError as e:
        logging.error(f"Invalid JSON in webhook: {e}")
        return JsonResponse({"Error": "Invalid JSON format"}, status=BAD_REQUEST_STATUS)
    except Exception as e:
        logging.error(f"Error processing webhook: {e}")
        return JsonResponse(
            {"Error": f"Failed to process webhook: {str(e)}"},
            status=SERVER_ERROR_STATUS
        )


def process_webhook_event(event_id, event_type, payment_entity):
    """
    Process webhook event - update transaction/order status
    This runs after storing the event
    """
    try:
        razorpay_payment_id = payment_entity.get('id', None)
        payment_status = payment_entity.get('status', None)
        
        if not razorpay_payment_id:
            logging.warning(f"No payment ID in event {event_id}")
            return
        
        # Map Razorpay status to our enum
        status_mapping = {
            'created': 'CREATED',
            'authorized': 'AUTHORIZED',
            'captured': 'CAPTURED',
            'failed': 'FAILED',
            'refunded': 'REFUNDED'
        }
        mapped_status = status_mapping.get(payment_status, None)
        
        if not mapped_status:
            logging.warning(f"Unknown payment status: {payment_status}")
            return
        
        # Update transaction status in database
        with transaction.atomic():
            with connection.cursor() as cursor:
                # Update transaction
                cursor.execute(f"""
                    UPDATE {TBL_PAYMENT_TRANSACTIONS}
                    SET payment_status = %s
                    WHERE razorpay_payment_id = %s
                """, [mapped_status, razorpay_payment_id])
                
                if cursor.rowcount > 0:
                    logging.info(f"Updated transaction {razorpay_payment_id} to status {mapped_status}")
                    
                    # If payment captured, update order status
                    if mapped_status == 'CAPTURED':
                        cursor.execute(f"""
                            UPDATE {TBL_PAYMENT_ORDERS} o
                            JOIN {TBL_PAYMENT_TRANSACTIONS} t ON o.id = t.order_id
                            SET o.order_status = 'PAID'
                            WHERE t.razorpay_payment_id = %s
                        """, [razorpay_payment_id])
                        logging.info(f"Updated order status to PAID for payment {razorpay_payment_id}")
                    
                    # Send email notification based on payment status
                    if mapped_status in ['CAPTURED', 'FAILED']:
                        send_payment_notification_email(razorpay_payment_id, mapped_status)
                
                # Mark event as processed
                cursor.execute(f"""
                    UPDATE {TBL_PAYMENT_EVENTS}
                    SET processed = 1, processed_at = NOW()
                    WHERE id = %s
                """, [event_id])
        
        logging.info(f"Webhook event {event_id} processed successfully")
        
    except Exception as e:
        logging.error(f"Error processing webhook event {event_id}: {e}")


def send_payment_notification_email(razorpay_payment_id, payment_status):
    """
    Send payment notification email with invoice attachment
    
    Args:
        razorpay_payment_id: Razorpay payment ID
        payment_status: Payment status (CAPTURED or FAILED)
    """
    try:
        # Fetch transaction and order details
        with connection.cursor() as cursor:
            # Get transaction details
            cursor.execute(f"""
                SELECT id, razorpay_payment_id, order_id, razorpay_order_id, user_id,
                       amount, currency, payment_method, bank, vpa, payment_status,
                       error_code, error_reason, error_description, created_at
                FROM {TBL_PAYMENT_TRANSACTIONS}
                WHERE razorpay_payment_id = %s
            """, [razorpay_payment_id])
            
            txn_row = cursor.fetchone()
            if not txn_row:
                logging.error(f"Transaction not found for payment ID: {razorpay_payment_id}")
                return
            
            transaction_data = dict(zip([
                'Transaction_ID', 'Razorpay_Payment_ID', 'Order_ID', 'Razorpay_Order_ID', 'User_ID',
                'Amount_Paise', 'Currency', 'Payment_Method', 'Bank', 'VPA', 'Payment_Status',
                'Error_Code', 'Error_Reason', 'Error_Description', 'Created_At'
            ], txn_row))
            
            # Get order details
            cursor.execute(f"""
                SELECT id, razorpay_order_id, user_id, name, email, mobile_number,
                       purpose, reference_id, amount, currency, receipt, order_status
                FROM {TBL_PAYMENT_ORDERS}
                WHERE id = %s
            """, [transaction_data['Order_ID']])
            
            order_row = cursor.fetchone()
            if not order_row:
                logging.error(f"Order not found for order ID: {transaction_data['Order_ID']}")
                return
            
            order_data = dict(zip([
                'Order_ID', 'Razorpay_Order_ID', 'User_ID', 'Name', 'Email', 'Mobile_Number',
                'Purpose', 'Reference_ID', 'Amount_Paise', 'Currency', 'Receipt', 'Order_Status'
            ], order_row))
        
        # Generate invoice PDF
        invoice_filename = generate_invoice_filename(
            transaction_data['Transaction_ID'],
            transaction_data['User_ID']
        )
        
        # Create temporary directory for invoice if it doesn't exist
        invoice_dir = os.path.join(settings.BASE_DIR, 'media', 'invoices')
        os.makedirs(invoice_dir, exist_ok=True)
        
        invoice_path = os.path.join(invoice_dir, invoice_filename)
        
        # Generate the invoice
        generate_payment_invoice(transaction_data, order_data, invoice_path)
        
        # Prepare email content based on payment status
        if payment_status == 'CAPTURED':
            subject = f"Payment Successful - Invoice #{transaction_data['Transaction_ID']}"
            email_body = f"""
Dear {order_data['Name']},

Thank you for your payment! Your transaction has been successfully completed.

Payment Details:
- Transaction ID: {transaction_data['Transaction_ID']}
- Razorpay Payment ID: {razorpay_payment_id}
- Amount Paid: {transaction_data['Currency']} {transaction_data['Amount_Paise'] / 100:.2f}
- Payment Method: {transaction_data.get('Payment_Method', 'N/A').upper() if transaction_data.get('Payment_Method') else 'N/A'}
- Purpose: {order_data['Purpose']}
- Date: {transaction_data['Created_At'].strftime('%d %B %Y %I:%M %p')}

Please find your invoice attached to this email.

If you have any questions or concerns, please don't hesitate to contact our support team.

Best regards,
Lanciere Technologies Team

---
This is an automated email. Please do not reply to this message.
            """
        else:  # FAILED
            subject = f"Payment Failed - Transaction #{transaction_data['Transaction_ID']}"
            error_desc = transaction_data.get('Error_Description', 'Unknown error occurred')
            email_body = f"""
Dear {order_data['Name']},

We regret to inform you that your payment attempt was unsuccessful.

Payment Details:
- Transaction ID: {transaction_data['Transaction_ID']}
- Razorpay Payment ID: {razorpay_payment_id}
- Amount: {transaction_data['Currency']} {transaction_data['Amount_Paise'] / 100:.2f}
- Purpose: {order_data['Purpose']}
- Date: {transaction_data['Created_At'].strftime('%d %B %Y %I:%M %p')}

Failure Reason: {error_desc}

Please try again or contact our support team for assistance.

Best regards,
Lanciere Technologies Team

---
This is an automated email. Please do not reply to this message.
            """
        
        # Send email with invoice attachment
        email = EmailMessage(
            subject=subject,
            body=email_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[order_data['Email']],
        )
        
        # Attach invoice PDF
        with open(invoice_path, 'rb') as f:
            email.attach(invoice_filename, f.read(), 'application/pdf')
        
        email.send(fail_silently=False)
        
        logging.info(f"Payment notification email sent to {order_data['Email']} for payment {razorpay_payment_id}")
        
        # Update transaction record with invoice path
        with connection.cursor() as cursor:
            cursor.execute(f"""
                UPDATE {TBL_PAYMENT_TRANSACTIONS}
                SET invoice_pdf_path = %s
                WHERE razorpay_payment_id = %s
            """, [invoice_path, razorpay_payment_id])
        
    except Exception as e:
        logging.error(f"Error sending payment notification email: {e}")
        # Don't raise exception - email failure shouldn't break webhook processing

@require_http_methods(["GET"])
@csrf_exempt
def Get_Payment_Event(request, event_id):
    """Get payment event details by internal event ID"""
    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT id, razorpay_event_id, event_type, razorpay_payment_id,
                   razorpay_order_id, payload, processed, processed_at, received_at
            FROM {TBL_PAYMENT_EVENTS}
            WHERE id = %s
            """
            cursor.execute(select_query, [event_id])
            row = cursor.fetchone()
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    if row:
        event = dict(zip([
            'Event_ID', 'Razorpay_Event_ID', 'Event_Type', 'Razorpay_Payment_ID',
            'Razorpay_Order_ID', 'Payload', 'Processed', 'Processed_At', 'Received_At'
        ], row))
        
        # Parse JSON payload
        if event['Payload']:
            try:
                event['Payload'] = json.loads(event['Payload'])
            except:
                pass
        
        return JsonResponse(event, status=SUCCESS_STATUS)
    
    logging.error(f"Event ID {event_id} not found")
    return JsonResponse({"Error": "Event not found"}, status=NOT_FOUND_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def Get_Payment_Event_By_Razorpay_ID(request, razorpay_event_id):
    """Get payment event details by Razorpay event ID"""
    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT id, razorpay_event_id, event_type, razorpay_payment_id,
                   razorpay_order_id, payload, processed, processed_at, received_at
            FROM {TBL_PAYMENT_EVENTS}
            WHERE razorpay_event_id = %s
            """
            cursor.execute(select_query, [razorpay_event_id])
            row = cursor.fetchone()
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    if row:
        event = dict(zip([
            'Event_ID', 'Razorpay_Event_ID', 'Event_Type', 'Razorpay_Payment_ID',
            'Razorpay_Order_ID', 'Payload', 'Processed', 'Processed_At', 'Received_At'
        ], row))
        
        # Parse JSON payload
        if event['Payload']:
            try:
                event['Payload'] = json.loads(event['Payload'])
            except:
                pass
        
        return JsonResponse(event, status=SUCCESS_STATUS)
    
    logging.error(f"Razorpay event ID {razorpay_event_id} not found")
    return JsonResponse({"Error": "Event not found"}, status=NOT_FOUND_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def List_Events_By_Payment_ID(request, razorpay_payment_id):
    """List all events for a specific payment"""
    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT id, razorpay_event_id, event_type, razorpay_payment_id,
                   razorpay_order_id, processed, processed_at, received_at
            FROM {TBL_PAYMENT_EVENTS}
            WHERE razorpay_payment_id = %s
            ORDER BY received_at DESC
            """
            cursor.execute(select_query, [razorpay_payment_id])
            rows = cursor.fetchall()
            
            events = []
            for row in rows:
                event = dict(zip([
                    'Event_ID', 'Razorpay_Event_ID', 'Event_Type', 'Razorpay_Payment_ID',
                    'Razorpay_Order_ID', 'Processed', 'Processed_At', 'Received_At'
                ], row))
                events.append(event)
                
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse(events, safe=False, status=SUCCESS_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def List_Events_By_Order_ID(request, razorpay_order_id):
    """List all events for a specific order"""
    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT id, razorpay_event_id, event_type, razorpay_payment_id,
                   razorpay_order_id, processed, processed_at, received_at
            FROM {TBL_PAYMENT_EVENTS}
            WHERE razorpay_order_id = %s
            ORDER BY received_at DESC
            """
            cursor.execute(select_query, [razorpay_order_id])
            rows = cursor.fetchall()
            
            events = []
            for row in rows:
                event = dict(zip([
                    'Event_ID', 'Razorpay_Event_ID', 'Event_Type', 'Razorpay_Payment_ID',
                    'Razorpay_Order_ID', 'Processed', 'Processed_At', 'Received_At'
                ], row))
                events.append(event)
                
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse(events, safe=False, status=SUCCESS_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def List_All_Events(request):
    """List all payment events (Admin use)"""
    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT id, razorpay_event_id, event_type, razorpay_payment_id,
                   razorpay_order_id, processed, processed_at, received_at
            FROM {TBL_PAYMENT_EVENTS}
            ORDER BY received_at DESC
            """
            cursor.execute(select_query)
            rows = cursor.fetchall()
            
            events = []
            for row in rows:
                event = dict(zip([
                    'Event_ID', 'Razorpay_Event_ID', 'Event_Type', 'Razorpay_Payment_ID',
                    'Razorpay_Order_ID', 'Processed', 'Processed_At', 'Received_At'
                ], row))
                events.append(event)
                
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse(events, safe=False, status=SUCCESS_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def List_Unprocessed_Events(request):
    """List all unprocessed payment events"""
    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT id, razorpay_event_id, event_type, razorpay_payment_id,
                   razorpay_order_id, received_at
            FROM {TBL_PAYMENT_EVENTS}
            WHERE processed = 0
            ORDER BY received_at ASC
            """
            cursor.execute(select_query)
            rows = cursor.fetchall()
            
            events = []
            for row in rows:
                event = dict(zip([
                    'Event_ID', 'Razorpay_Event_ID', 'Event_Type', 'Razorpay_Payment_ID',
                    'Razorpay_Order_ID', 'Received_At'
                ], row))
                events.append(event)
                
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse(events, safe=False, status=SUCCESS_STATUS)


@require_http_methods(["PUT"])
@csrf_exempt
def Mark_Event_Processed(request, event_id):
    """Manually mark an event as processed"""
    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                update_query = f"""
                UPDATE {TBL_PAYMENT_EVENTS}
                SET processed = 1, processed_at = NOW()
                WHERE id = %s
                """
                cursor.execute(update_query, [event_id])
                
                if cursor.rowcount == 0:
                    logging.error(f"Event ID {event_id} not found")
                    return JsonResponse(
                        {"Error": "Event not found"},
                        status=NOT_FOUND_STATUS
                    )

    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse({
        "Message": "Event marked as processed successfully",
        "Event_ID": event_id
    }, status=SUCCESS_STATUS)


# ==================== URL PATTERNS ====================

urlpatterns = [
    path('api/payment/webhook', Razorpay_Webhook_Handler, name='Razorpay_Webhook_Handler'),
    path('api/payment/event/<int:event_id>', Get_Payment_Event, name='Get_Payment_Event'),
    path('api/payment/event/razorpay/<str:razorpay_event_id>', Get_Payment_Event_By_Razorpay_ID, name='Get_Payment_Event_By_Razorpay_ID'),
    path('api/payment/events/payment/<str:razorpay_payment_id>', List_Events_By_Payment_ID, name='List_Events_By_Payment_ID'),
    path('api/payment/events/order/<str:razorpay_order_id>', List_Events_By_Order_ID, name='List_Events_By_Order_ID'),
    path('api/payment/events/all', List_All_Events, name='List_All_Events'),
    path('api/payment/events/unprocessed', List_Unprocessed_Events, name='List_Unprocessed_Events'),
    path('api/payment/event/process/<int:event_id>', Mark_Event_Processed, name='Mark_Event_Processed'),
]