# core/super_adminDashboard/payment_orders.py

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
import razorpay
import os
import re

# Global Variables - Razorpay Configuration
RAZORPAY_KEY_ID = os.getenv('RAZORPAY_KEY_ID')
RAZORPAY_KEY_SECRET = os.getenv('RAZORPAY_KEY_SECRET')

# Initialize Razorpay Client
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# Table Names
TBL_PAYMENT_ORDERS = 'tbl_payment_orders'
TBL_PLANS = 'tbl_Plans'

# Valid Indian States and Union Territories
VALID_INDIAN_STATES = [
    # States
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    # Union Territories
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
]

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
    filename='payment_orders_debug.log',
    level=logging.DEBUG,
    format='%(asctime)s %(levelname)s %(message)s'
)

class PaymentOrder(models.Model):
    id = models.AutoField(primary_key=True)
    razorpay_order_id = models.CharField(max_length=50, unique=True)
    user_id = models.ForeignKey(
        'core.User', on_delete=models.RESTRICT, db_column='user_id',
        related_name='payment_orders'
    )
    name = models.CharField(max_length=100)
    email = models.CharField(max_length=100)
    mobile_number = models.CharField(max_length=15)
    purpose = models.CharField(max_length=100)
    reference_id = models.CharField(max_length=50, blank=True, null=True)
    amount = models.IntegerField()
    currency = models.CharField(max_length=10, default='INR')
    receipt = models.CharField(max_length=100, blank=True, null=True)
    order_status = models.CharField(max_length=10, default='CREATED')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    address_line1 = models.CharField(max_length=200, blank=True, null=True)
    address_line2 = models.CharField(max_length=200, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    pincode = models.CharField(max_length=10, blank=True, null=True)
    country = models.CharField(max_length=50, default='India')

    class Meta:
        db_table = 'tbl_payment_orders'
        app_label = 'core'


def create_payment_orders_table():
    """Create tbl_payment_orders table with all required columns and indexes"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tbl_payment_orders (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    razorpay_order_id VARCHAR(50) NOT NULL UNIQUE COMMENT 'order_xxx from Razorpay',
                    user_id INT NOT NULL COMMENT 'Who is paying',
                    name VARCHAR(100) NOT NULL,
                    email VARCHAR(100) NOT NULL,
                    mobile_number VARCHAR(15) NOT NULL,
                    purpose VARCHAR(100) NOT NULL COMMENT 'meeting/subscription/test/interview',
                    reference_id VARCHAR(50) DEFAULT NULL COMMENT 'meeting_id/plan_id/test_id',
                    amount INT NOT NULL COMMENT 'Amount in paise (₹100 = 10000 paise)',
                    currency VARCHAR(10) DEFAULT 'INR',
                    receipt VARCHAR(100) DEFAULT NULL COMMENT 'Your internal reference',
                    order_status ENUM('CREATED','PAID','EXPIRED','CANCELLED') DEFAULT 'CREATED',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    address_line1 VARCHAR(200) DEFAULT NULL COMMENT 'Customer address line 1',
                    address_line2 VARCHAR(200) DEFAULT NULL COMMENT 'Customer address line 2 (optional)',
                    city VARCHAR(100) DEFAULT NULL COMMENT 'Customer city',
                    state VARCHAR(100) DEFAULT NULL COMMENT 'Customer state - used for GST calculation',
                    pincode VARCHAR(10) DEFAULT NULL COMMENT 'Customer pincode',
                    country VARCHAR(50) DEFAULT 'India' COMMENT 'Customer country',
                    KEY idx_user_id (user_id),
                    KEY idx_order_status (order_status),
                    KEY idx_reference (purpose, reference_id),
                    KEY idx_payment_orders_state (state),
                    CONSTRAINT FK_PaymentOrders_Users FOREIGN KEY (user_id) REFERENCES tbl_Users (ID) ON DELETE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """)
            logging.debug("tbl_payment_orders table created successfully")
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Failed to create tbl_payment_orders table: {e}")
 
# ==================== HELPER FUNCTIONS ====================

def validate_email(email):
    """Validate email format"""
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(email_pattern, email) is not None


def validate_mobile_number(mobile):
    """Validate mobile number (10 digits for India)"""
    mobile_pattern = r'^[6-9]\d{9}$'
    return re.match(mobile_pattern, mobile) is not None


def validate_pincode(pincode):
    """Validate Indian pincode (6 digits)"""
    pincode_pattern = r'^\d{6}$'
    return re.match(pincode_pattern, pincode) is not None


def validate_state(state):
    """Validate if state is a valid Indian state/UT"""
    return state in VALID_INDIAN_STATES


# ==================== PAYMENT ORDERS APIs ====================

@require_http_methods(["POST"])
@csrf_exempt
def Create_Payment_Order(request):
    """
    Step 1: Create payment order in Razorpay and store in database
    User selects a plan and clicks "Pay Now" → This API is called
    
    Expected JSON:
    {
        "user_id": 123,
        "name": "John Doe",
        "email": "john@example.com",
        "mobile_number": "9876543210",
        "plan_id": 5,
        "purpose": "subscription",
        "currency": "INR",
        
        // NEW: Address fields
        "address_line1": "123 MG Road",
        "address_line2": "Near City Mall",  // Optional
        "city": "Bangalore",
        "state": "Karnataka",
        "pincode": "560001",
        "country": "India"  // Optional, defaults to India
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
            logging.error("Expected single order object, got list")
            return JsonResponse(
                {"Error": "Expected a single order object, not a list"},
                status=BAD_REQUEST_STATUS
            )
    except json.JSONDecodeError as e:
        logging.error(f"Invalid JSON: {e}")
        return JsonResponse({"Error": "Invalid JSON format"}, status=BAD_REQUEST_STATUS)

    # Validate required fields (including new address fields)
    required_fields = [
        'user_id', 'name', 'email', 'mobile_number', 'plan_id', 'purpose',
        'address_line1', 'city', 'state', 'pincode'  # NEW required fields
    ]
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

    # Extract and validate field values
    user_id = data['user_id']
    name = data['name'].strip()
    email = data['email'].strip()
    mobile_number = data['mobile_number'].strip()
    plan_id = data['plan_id']
    purpose = data['purpose']
    currency = data.get('currency', 'INR')
    
    # NEW: Extract address fields
    address_line1 = data['address_line1'].strip()
    address_line2 = data.get('address_line2', '').strip() if data.get('address_line2') else None
    city = data['city'].strip()
    state = data['state'].strip()
    pincode = data['pincode'].strip()
    country = data.get('country', 'India').strip()

    # Validate user_id exists
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM tbl_Users WHERE ID = %s AND Status = 1", [user_id])
            if cursor.fetchone()[0] == 0:
                logging.error(f"User ID {user_id} not found or inactive")
                return JsonResponse(
                    {"Error": "User not found or inactive"},
                    status=NOT_FOUND_STATUS
                )
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    # Validate name length
    if len(name) > 100:
        logging.error(f"Name too long: {name}")
        return JsonResponse({"Error": "Name must be max 100 characters"}, status=BAD_REQUEST_STATUS)

    # Validate email format
    if not validate_email(email):
        logging.error(f"Invalid email format: {email}")
        return JsonResponse({"Error": "Invalid email format"}, status=BAD_REQUEST_STATUS)

    # Validate email length
    if len(email) > 100:
        logging.error(f"Email too long: {email}")
        return JsonResponse({"Error": "Email must be max 100 characters"}, status=BAD_REQUEST_STATUS)

    # Validate mobile number format
    if not validate_mobile_number(mobile_number):
        logging.error(f"Invalid mobile number: {mobile_number}")
        return JsonResponse({"Error": "Invalid mobile number. Must be 10 digits starting with 6-9"}, status=BAD_REQUEST_STATUS)

    # Validate purpose length
    if len(purpose) > 100:
        logging.error(f"Purpose too long: {purpose}")
        return JsonResponse({"Error": "Purpose must be max 100 characters"}, status=BAD_REQUEST_STATUS)

    # NEW: Validate address fields
    if len(address_line1) > 200:
        logging.error(f"Address line 1 too long: {address_line1}")
        return JsonResponse({"Error": "Address line 1 must be max 200 characters"}, status=BAD_REQUEST_STATUS)
    
    if address_line2 and len(address_line2) > 200:
        logging.error(f"Address line 2 too long: {address_line2}")
        return JsonResponse({"Error": "Address line 2 must be max 200 characters"}, status=BAD_REQUEST_STATUS)
    
    if len(city) > 100:
        logging.error(f"City too long: {city}")
        return JsonResponse({"Error": "City must be max 100 characters"}, status=BAD_REQUEST_STATUS)
    
    # Validate state against list of Indian states
    if not validate_state(state):
        logging.error(f"Invalid state: {state}")
        return JsonResponse({
            "Error": f"Invalid state. Must be a valid Indian state or UT. You provided: '{state}'",
            "Valid_States": VALID_INDIAN_STATES
        }, status=BAD_REQUEST_STATUS)
    
    # Validate pincode format (6 digits)
    if not validate_pincode(pincode):
        logging.error(f"Invalid pincode: {pincode}")
        return JsonResponse({"Error": "Invalid pincode. Must be 6 digits"}, status=BAD_REQUEST_STATUS)
    
    if len(country) > 50:
        logging.error(f"Country too long: {country}")
        return JsonResponse({"Error": "Country must be max 50 characters"}, status=BAD_REQUEST_STATUS)

    # **FETCH PLAN DETAILS FROM DATABASE**
    try:
        with connection.cursor() as cursor:
            select_plan_query = f"""
            SELECT id, plan_name, plan_type, billing_period, total_price, currency
            FROM {TBL_PLANS}
            WHERE id = %s AND is_active = 1
            """
            cursor.execute(select_plan_query, [plan_id])
            plan_row = cursor.fetchone()
            
            if not plan_row:
                logging.error(f"Plan ID {plan_id} not found or inactive")
                return JsonResponse(
                    {"Error": "Selected plan not found or inactive"},
                    status=NOT_FOUND_STATUS
                )
            
            # Extract plan details - use total_price (includes GST)
            plan_data = dict(zip(['id', 'plan_name', 'plan_type', 'billing_period', 'total_price', 'plan_currency'], plan_row))
            amount_rupees = float(plan_data['total_price'])  # Total price including GST
            plan_name = plan_data['plan_name']
            plan_type = plan_data['plan_type']
            billing_period = plan_data['billing_period']
            
            logging.debug(f"Fetched plan: {plan_data}")
            
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error while fetching plan: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    # Validate amount (should never be 0 or negative from database, but safety check)
    if amount_rupees <= 0:
        logging.error(f"Invalid plan price: {amount_rupees}")
        return JsonResponse({"Error": "Invalid plan price. Please contact support."}, status=SERVER_ERROR_STATUS)

    # Convert Rupees to Paise (Razorpay works in paise)
    amount_paise = int(amount_rupees * 100)

    # Generate receipt ID
    receipt_id = f"REC_{user_id}_{timezone.now().strftime('%Y%m%d%H%M%S')}"

    # Create reference_id with plan information
    reference_id = f"{plan_type}_{billing_period}".upper()

    try:
        # Step 1: Create order in Razorpay with prefill data
        razorpay_order_data = {
            "amount": amount_paise,
            "currency": currency,
            "receipt": receipt_id,
            "notes": {
                "user_id": user_id,
                "name": name,
                "email": email,
                "mobile_number": mobile_number,
                "purpose": purpose,
                "plan_id": plan_id,
                "plan_name": plan_name,
                "plan_type": plan_type,
                "billing_period": billing_period,
                "reference_id": reference_id,
                "city": city,
                "state": state
            }
        }
        
        logging.debug(f"Creating Razorpay order: {razorpay_order_data}")
        razorpay_order = razorpay_client.order.create(data=razorpay_order_data)
        logging.debug(f"Razorpay order created: {razorpay_order}")

        razorpay_order_id = razorpay_order['id']

        # Step 2: Store order in database with address
        with transaction.atomic():
            with connection.cursor() as cursor:
                insert_query = f"""
                INSERT INTO {TBL_PAYMENT_ORDERS} (
                    razorpay_order_id, user_id, name, email, mobile_number,
                    purpose, reference_id, amount, currency, receipt, order_status,
                    address_line1, address_line2, city, state, pincode, country
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                values = [
                    razorpay_order_id,
                    user_id,
                    name,
                    email,
                    mobile_number,
                    purpose,
                    reference_id,
                    amount_paise,
                    currency,
                    receipt_id,
                    'CREATED',
                    address_line1,
                    address_line2,
                    city,
                    state,
                    pincode,
                    country
                ]
                cursor.execute(insert_query, values)
                cursor.execute("SELECT LAST_INSERT_ID()")
                order_id = cursor.fetchone()[0]

        logging.info(f"Payment order created successfully: Order ID {order_id}, Plan: {plan_name}, Amount: ₹{amount_rupees}, State: {state}")
        
        return JsonResponse({
            "Message": "Payment order created successfully",
            "Order_ID": order_id,
            "Razorpay_Order_ID": razorpay_order_id,
            "Plan_Details": {
                "Plan_ID": plan_id,
                "Plan_Name": plan_name,
                "Plan_Type": plan_type,
                "Billing_Period": billing_period
            },
            "Amount": amount_rupees,
            "Amount_Paise": amount_paise,
            "Currency": currency,
            "Receipt": receipt_id,
            "Address": {
                "Address_Line1": address_line1,
                "Address_Line2": address_line2,
                "City": city,
                "State": state,
                "Pincode": pincode,
                "Country": country
            },
            "Razorpay_Key_ID": RAZORPAY_KEY_ID,
            "Prefill_Data": {
                "name": name,
                "email": email,
                "contact": mobile_number
            }
        }, status=CREATED_STATUS)

    except razorpay.errors.BadRequestError as e:
        logging.error(f"Razorpay error: {e}")
        return JsonResponse(
            {"Error": f"Razorpay error: {str(e)}"},
            status=BAD_REQUEST_STATUS
        )
    except Exception as e:
        logging.error(f"Error creating payment order: {e}")
        return JsonResponse(
            {"Error": f"Failed to create payment order: {str(e)}"},
            status=SERVER_ERROR_STATUS
        )


@require_http_methods(["GET"])
@csrf_exempt
def Get_Payment_Order(request, order_id):
    """Get payment order details by internal order ID"""
    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT id, razorpay_order_id, user_id, name, email, mobile_number,
                   purpose, reference_id, amount, currency, receipt, order_status,
                   address_line1, address_line2, city, state, pincode, country,
                   created_at, updated_at
            FROM {TBL_PAYMENT_ORDERS}
            WHERE id = %s
            """
            cursor.execute(select_query, [order_id])
            row = cursor.fetchone()
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    if row:
        order = dict(zip([
            'Order_ID', 'Razorpay_Order_ID', 'User_ID', 'Name', 'Email', 'Mobile_Number',
            'Purpose', 'Reference_ID', 'Amount_Paise', 'Currency', 'Receipt', 'Order_Status',
            'Address_Line1', 'Address_Line2', 'City', 'State', 'Pincode', 'Country',
            'Created_At', 'Updated_At'
        ], row))
        
        # Convert paise to rupees for display
        order['Amount_Rupees'] = order['Amount_Paise'] / 100
        
        return JsonResponse(order, status=SUCCESS_STATUS)
    
    logging.error(f"Payment order ID {order_id} not found")
    return JsonResponse({"Error": "Payment order not found"}, status=NOT_FOUND_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def Get_Payment_Order_By_Razorpay_ID(request, razorpay_order_id):
    """Get payment order details by Razorpay order ID"""
    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT id, razorpay_order_id, user_id, name, email, mobile_number,
                   purpose, reference_id, amount, currency, receipt, order_status,
                   address_line1, address_line2, city, state, pincode, country,
                   created_at, updated_at
            FROM {TBL_PAYMENT_ORDERS}
            WHERE razorpay_order_id = %s
            """
            cursor.execute(select_query, [razorpay_order_id])
            row = cursor.fetchone()
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    if row:
        order = dict(zip([
            'Order_ID', 'Razorpay_Order_ID', 'User_ID', 'Name', 'Email', 'Mobile_Number',
            'Purpose', 'Reference_ID', 'Amount_Paise', 'Currency', 'Receipt', 'Order_Status',
            'Address_Line1', 'Address_Line2', 'City', 'State', 'Pincode', 'Country',
            'Created_At', 'Updated_At'
        ], row))
        
        # Convert paise to rupees for display
        order['Amount_Rupees'] = order['Amount_Paise'] / 100
        
        return JsonResponse(order, status=SUCCESS_STATUS)
    
    logging.error(f"Razorpay order ID {razorpay_order_id} not found")
    return JsonResponse({"Error": "Payment order not found"}, status=NOT_FOUND_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def List_User_Payment_Orders(request, user_id):
    """List all payment orders for a specific user"""
    try:
        with connection.cursor() as cursor:
            # First verify user exists
            cursor.execute("SELECT COUNT(*) FROM tbl_Users WHERE ID = %s", [user_id])
            if cursor.fetchone()[0] == 0:
                logging.error(f"User ID {user_id} not found")
                return JsonResponse({"Error": "User not found"}, status=NOT_FOUND_STATUS)

            select_query = f"""
            SELECT id, razorpay_order_id, user_id, name, email, mobile_number,
                   purpose, reference_id, amount, currency, receipt, order_status,
                   address_line1, address_line2, city, state, pincode, country,
                   created_at, updated_at
            FROM {TBL_PAYMENT_ORDERS}
            WHERE user_id = %s
            ORDER BY created_at DESC
            """
            cursor.execute(select_query, [user_id])
            rows = cursor.fetchall()
            
            orders = []
            for row in rows:
                order = dict(zip([
                    'Order_ID', 'Razorpay_Order_ID', 'User_ID', 'Name', 'Email', 'Mobile_Number',
                    'Purpose', 'Reference_ID', 'Amount_Paise', 'Currency', 'Receipt', 'Order_Status',
                    'Address_Line1', 'Address_Line2', 'City', 'State', 'Pincode', 'Country',
                    'Created_At', 'Updated_At'
                ], row))
                
                # Convert paise to rupees for display
                order['Amount_Rupees'] = order['Amount_Paise'] / 100
                orders.append(order)
                
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse(orders, safe=False, status=SUCCESS_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def List_All_Payment_Orders(request):
    """List all payment orders (Admin use)"""
    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT id, razorpay_order_id, user_id, name, email, mobile_number,
                   purpose, reference_id, amount, currency, receipt, order_status,
                   address_line1, address_line2, city, state, pincode, country,
                   created_at, updated_at
            FROM {TBL_PAYMENT_ORDERS}
            ORDER BY created_at DESC
            """
            cursor.execute(select_query)
            rows = cursor.fetchall()
            
            orders = []
            for row in rows:
                order = dict(zip([
                    'Order_ID', 'Razorpay_Order_ID', 'User_ID', 'Name', 'Email', 'Mobile_Number',
                    'Purpose', 'Reference_ID', 'Amount_Paise', 'Currency', 'Receipt', 'Order_Status',
                    'Address_Line1', 'Address_Line2', 'City', 'State', 'Pincode', 'Country',
                    'Created_At', 'Updated_At'
                ], row))
                
                # Convert paise to rupees for display
                order['Amount_Rupees'] = order['Amount_Paise'] / 100
                orders.append(order)
                
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse(orders, safe=False, status=SUCCESS_STATUS)


@require_http_methods(["PUT"])
@csrf_exempt
def Update_Payment_Order_Status(request, order_id):
    """
    Update payment order status
    Usually called internally after payment success/failure
    
    Expected JSON:
    {
        "order_status": "PAID" // PAID, EXPIRED, CANCELLED
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
            logging.error("Expected single status object, got list")
            return JsonResponse(
                {"Error": "Expected a single status object, not a list"},
                status=BAD_REQUEST_STATUS
            )
    except json.JSONDecodeError as e:
        logging.error(f"Invalid JSON: {e}")
        return JsonResponse({"Error": "Invalid JSON format"}, status=BAD_REQUEST_STATUS)

    # Validate required field
    if 'order_status' not in data or not data['order_status']:
        logging.error("Order status is required")
        return JsonResponse({"Error": "Order status is required"}, status=BAD_REQUEST_STATUS)

    order_status = data['order_status']
    
    # Validate order status value
    valid_statuses = ['CREATED', 'PAID', 'EXPIRED', 'CANCELLED']
    if order_status not in valid_statuses:
        logging.error(f"Invalid order status: {order_status}")
        return JsonResponse(
            {"Error": f"Invalid order status. Must be one of: {', '.join(valid_statuses)}"},
            status=BAD_REQUEST_STATUS
        )

    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                update_query = f"""
                UPDATE {TBL_PAYMENT_ORDERS}
                SET order_status = %s
                WHERE id = %s
                """
                cursor.execute(update_query, [order_status, order_id])
                
                if cursor.rowcount == 0:
                    logging.error(f"Payment order ID {order_id} not found")
                    return JsonResponse(
                        {"Error": "Payment order not found"},
                        status=NOT_FOUND_STATUS
                    )

    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse({
        "Message": "Payment order status updated successfully",
        "Order_ID": order_id,
        "New_Status": order_status
    }, status=SUCCESS_STATUS)


# ==================== URL PATTERNS ====================

urlpatterns = [
    path('api/payment/order/create', Create_Payment_Order, name='Create_Payment_Order'),
    path('api/payment/order/<int:order_id>', Get_Payment_Order, name='Get_Payment_Order'),
    path('api/payment/order/razorpay/<str:razorpay_order_id>', Get_Payment_Order_By_Razorpay_ID, name='Get_Payment_Order_By_Razorpay_ID'),
    path('api/payment/orders/user/<int:user_id>', List_User_Payment_Orders, name='List_User_Payment_Orders'),
    path('api/payment/orders/all', List_All_Payment_Orders, name='List_All_Payment_Orders'),
    path('api/payment/order/update/<int:order_id>', Update_Payment_Order_Status, name='Update_Payment_Order_Status'),
]