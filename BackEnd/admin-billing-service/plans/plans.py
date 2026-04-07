from django.db import connection, transaction
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.db.utils import ProgrammingError, OperationalError
from decimal import Decimal, ROUND_HALF_UP
from django.db import models
import json
import logging

# Global Variables
TBL_PLANS = 'tbl_Plans'
DEFAULT_GST_RATE = 18.00  # Default GST rate

SUCCESS_STATUS = 200
CREATED_STATUS = 201
BAD_REQUEST_STATUS = 400
NOT_FOUND_STATUS = 404
SERVER_ERROR_STATUS = 500

logging.basicConfig(filename='plans_debug.log', level=logging.DEBUG, format='%(asctime)s %(levelname)s %(message)s')

class Plan(models.Model):
    id = models.AutoField(primary_key=True)
    plan_name = models.CharField(max_length=50)
    plan_type = models.CharField(max_length=10)
    billing_period = models.CharField(max_length=10)
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=18.00)
    # gst_amount and total_price are GENERATED columns – managed via raw SQL
    gst_amount = models.DecimalField(max_digits=10, decimal_places=2, editable=False, default=0)
    total_price = models.DecimalField(max_digits=10, decimal_places=2, editable=False, default=0)
    currency = models.CharField(max_length=3, default='INR')
    features = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_Plans'
        app_label = 'core'
        unique_together = [('plan_type', 'billing_period')]


def create_plans_table():
    """Create tbl_Plans table with generated columns for GST calculation"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tbl_Plans (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    plan_name VARCHAR(50) NOT NULL,
                    plan_type ENUM('basic','pro','pro_max') NOT NULL,
                    billing_period ENUM('monthly','yearly') NOT NULL,
                    base_price DECIMAL(10,2) NOT NULL COMMENT 'Price before GST',
                    gst_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00 COMMENT 'GST percentage',
                    gst_amount DECIMAL(10,2) GENERATED ALWAYS AS (ROUND(base_price * (gst_rate / 100), 2)) STORED COMMENT 'Auto-calculated GST amount',
                    total_price DECIMAL(10,2) GENERATED ALWAYS AS (ROUND(base_price + (base_price * (gst_rate / 100)), 2)) STORED COMMENT 'Auto-calculated total with GST',
                    currency VARCHAR(3) DEFAULT 'INR',
                    features TEXT,
                    is_active TINYINT(1) DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_plan (plan_type, billing_period)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """)
            logging.debug("tbl_Plans table created successfully")
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Failed to create tbl_Plans table: {e}")

def calculate_gst_components(base_price, gst_rate):
    """
    Calculate GST amount and total price from base price
    Returns: (gst_amount, total_price) as Decimal values rounded to 2 decimal places
    """
    base = Decimal(str(base_price))
    rate = Decimal(str(gst_rate))
    
    gst_amount = (base * (rate / Decimal('100'))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    total_price = (base + gst_amount).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    return gst_amount, total_price


@require_http_methods(["POST"])
@csrf_exempt
def Create_Plan(request):
    create_plans_table()
    
    try:
        logging.debug(f"Raw request body: {request.body}")
        data = json.loads(request.body)
        logging.debug(f"Parsed JSON: {json.dumps(data, indent=2)}")
        if isinstance(data, list) and len(data) == 1:
            data = data[0]
            logging.debug(f"Unwrapped list to: {json.dumps(data, indent=2)}")
        elif isinstance(data, list):
            logging.error("Expected single plan object, got list")
            return JsonResponse({"Error": "Expected a single plan object, not a list"}, status=BAD_REQUEST_STATUS)
    except json.JSONDecodeError as e:
        logging.error(f"Invalid JSON: {e}")
        return JsonResponse({"Error": "Invalid JSON format"}, status=BAD_REQUEST_STATUS)

    # Required fields validation
    required_fields = ['plan_name', 'plan_type', 'billing_period', 'base_price']
    missing_fields = [field for field in required_fields if field not in data or data[field] is None or (isinstance(data[field], str) and data[field].strip() == "")]
    if missing_fields:
        logging.error(f"Missing or empty fields: {', '.join(missing_fields)}")
        return JsonResponse({"Error": f"Missing or empty required fields: {', '.join(missing_fields)}"}, status=BAD_REQUEST_STATUS)

    # Validate column lengths and formats
    if len(data['plan_name']) > 50:
        logging.error(f"plan_name too long: {data['plan_name']}")
        return JsonResponse({"Error": "plan_name must be max 50 characters"}, status=BAD_REQUEST_STATUS)
    
    if data['plan_type'] not in ['basic', 'pro', 'pro_max']:
        logging.error(f"Invalid plan_type: {data['plan_type']}")
        return JsonResponse({"Error": "plan_type must be one of: basic, pro, pro_max"}, status=BAD_REQUEST_STATUS)
    
    if data['billing_period'] not in ['monthly', 'yearly']:
        logging.error(f"Invalid billing_period: {data['billing_period']}")
        return JsonResponse({"Error": "billing_period must be one of: monthly, yearly"}, status=BAD_REQUEST_STATUS)
    
    # Validate base_price
    try:
        base_price = float(data['base_price'])
        if base_price <= 0:
            logging.error(f"Invalid base_price: {base_price}")
            return JsonResponse({"Error": "base_price must be a positive number"}, status=BAD_REQUEST_STATUS)
    except (ValueError, TypeError):
        logging.error(f"Invalid base_price format: {data['base_price']}")
        return JsonResponse({"Error": "base_price must be a valid number"}, status=BAD_REQUEST_STATUS)
    
    # Handle gst_rate - use default if not provided
    gst_rate = data.get('gst_rate')
    if gst_rate is None:
        gst_rate = DEFAULT_GST_RATE
        logging.debug(f"gst_rate not provided, using default: {DEFAULT_GST_RATE}%")
    else:
        # Validate gst_rate if provided
        try:
            gst_rate = float(gst_rate)
            if gst_rate < 0 or gst_rate > 100:
                logging.error(f"Invalid gst_rate: {gst_rate}")
                return JsonResponse({"Error": "gst_rate must be between 0 and 100"}, status=BAD_REQUEST_STATUS)
            logging.debug(f"gst_rate provided: {gst_rate}%")
        except (ValueError, TypeError):
            logging.error(f"Invalid gst_rate format: {gst_rate}")
            return JsonResponse({"Error": "gst_rate must be a valid number"}, status=BAD_REQUEST_STATUS)
    
    # Validate optional fields
    if data.get('currency') and len(data['currency']) > 3:
        logging.error(f"currency too long: {data['currency']}")
        return JsonResponse({"Error": "currency must be max 3 characters"}, status=BAD_REQUEST_STATUS)

    # Set default values for optional fields
    optional_fields = {
        'currency': 'INR',
        'features': None,
        'is_active': 1
    }
    for field in optional_fields:
        data[field] = data.get(field, optional_fields[field])

    # Calculate GST components for response (database will auto-calculate via GENERATED columns)
    gst_amount, total_price = calculate_gst_components(base_price, gst_rate)

    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                # Check for duplicate plan_type and billing_period combination
                cursor.execute(f"SELECT COUNT(*) FROM {TBL_PLANS} WHERE plan_type = %s AND billing_period = %s", [data['plan_type'], data['billing_period']])
                if cursor.fetchone()[0] > 0:
                    logging.error(f"Plan with plan_type {data['plan_type']} and billing_period {data['billing_period']} already exists")
                    return JsonResponse({"Error": f"Plan with plan_type '{data['plan_type']}' and billing_period '{data['billing_period']}' already exists"}, status=BAD_REQUEST_STATUS)

                # Note: gst_amount and total_price are auto-calculated by database, so we don't insert them
                insert_query = f"""
                INSERT INTO {TBL_PLANS} (
                    plan_name, plan_type, billing_period, base_price, gst_rate, currency, features, is_active
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """
                values = [
                    data['plan_name'],
                    data['plan_type'],
                    data['billing_period'],
                    data['base_price'],
                    gst_rate,
                    data['currency'],
                    data['features'],
                    data['is_active']
                ]
                cursor.execute(insert_query, values)
                cursor.execute("SELECT LAST_INSERT_ID()")
                plan_id = cursor.fetchone()[0]

    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    logging.info(f"Plan created successfully: ID {plan_id}, Base: ₹{base_price}, GST: {gst_rate}% (₹{gst_amount}), Total: ₹{total_price}")

    return JsonResponse({
        "Message": "Plan created successfully",
        "Plan_Id": plan_id,
        "Plan_Details": {
            "Plan_Name": data['plan_name'],
            "Plan_Type": data['plan_type'],
            "Billing_Period": data['billing_period'],
            "Base_Price": float(base_price),
            "GST_Rate": f"{gst_rate}%",
            "GST_Amount": float(gst_amount),
            "Total_Price": float(total_price),
            "Currency": data['currency']
        }
    }, status=CREATED_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def List_All_Plans(request):
    create_plans_table()

    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT id, plan_name, plan_type, billing_period, base_price, gst_rate, gst_amount, total_price, 
                   currency, features, is_active, created_at, updated_at
            FROM {TBL_PLANS}
            """
            cursor.execute(select_query)
            rows = cursor.fetchall()
            plans = [
                dict(zip([
                    'id', 'plan_name', 'plan_type', 'billing_period', 'base_price', 'gst_rate', 'gst_amount', 
                    'total_price', 'currency', 'features', 'is_active', 'created_at', 'updated_at'
                ], row))
                for row in rows
            ]
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse(plans, safe=False, status=SUCCESS_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def Get_Plan(request, id):
    create_plans_table()

    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT id, plan_name, plan_type, billing_period, base_price, gst_rate, gst_amount, total_price,
                   currency, features, is_active, created_at, updated_at
            FROM {TBL_PLANS}
            WHERE id = %s
            """
            cursor.execute(select_query, [id])
            row = cursor.fetchone()
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    if row:
        plan = dict(zip([
            'id', 'plan_name', 'plan_type', 'billing_period', 'base_price', 'gst_rate', 'gst_amount',
            'total_price', 'currency', 'features', 'is_active', 'created_at', 'updated_at'
        ], row))
        return JsonResponse(plan, status=SUCCESS_STATUS)
    logging.error(f"Plan ID {id} not found")
    return JsonResponse({"Error": "Plan not found"}, status=NOT_FOUND_STATUS)


@require_http_methods(["PUT"])
@csrf_exempt
def Update_Plan(request, id):
    create_plans_table()

    try:
        logging.debug(f"Raw request body: {request.body}")
        data = json.loads(request.body)
        logging.debug(f"Parsed JSON: {json.dumps(data, indent=2)}")
        if isinstance(data, list) and len(data) == 1:
            data = data[0]
            logging.debug(f"Unwrapped data to: {json.dumps(data, indent=2)}")
        elif isinstance(data, list):
            logging.error("Expected single plan object, got list")
            return JsonResponse({"Error": "Expected a single plan object, not a list"}, status=BAD_REQUEST_STATUS)
    except json.JSONDecodeError as e:
        logging.error(f"Invalid JSON: {e}")
        return JsonResponse({"Error": "Invalid JSON format"}, status=BAD_REQUEST_STATUS)

    # Required fields validation
    required_fields = ['plan_name', 'plan_type', 'billing_period', 'base_price']
    missing_fields = [field for field in required_fields if field not in data or data[field] is None or (isinstance(data[field], str) and data[field].strip() == "")]
    if missing_fields:
        logging.error(f"Missing or empty fields: {', '.join(missing_fields)}")
        return JsonResponse({"Error": f"Missing or empty required fields: {', '.join(missing_fields)}"}, status=BAD_REQUEST_STATUS)

    # Validate column lengths and formats
    if len(data['plan_name']) > 50:
        logging.error(f"plan_name too long: {data['plan_name']}")
        return JsonResponse({"Error": "plan_name must be max 50 characters"}, status=BAD_REQUEST_STATUS)
    
    if data['plan_type'] not in ['basic', 'pro', 'pro_max']:
        logging.error(f"Invalid plan_type: {data['plan_type']}")
        return JsonResponse({"Error": "plan_type must be one of: basic, pro, pro_max"}, status=BAD_REQUEST_STATUS)
    
    if data['billing_period'] not in ['monthly', 'yearly']:
        logging.error(f"Invalid billing_period: {data['billing_period']}")
        return JsonResponse({"Error": "billing_period must be one of: monthly, yearly"}, status=BAD_REQUEST_STATUS)
    
    # Validate base_price
    try:
        base_price = float(data['base_price'])
        if base_price <= 0:
            logging.error(f"Invalid base_price: {base_price}")
            return JsonResponse({"Error": "base_price must be a positive number"}, status=BAD_REQUEST_STATUS)
    except (ValueError, TypeError):
        logging.error(f"Invalid base_price format: {data['base_price']}")
        return JsonResponse({"Error": "base_price must be a valid number"}, status=BAD_REQUEST_STATUS)
    
    # Handle gst_rate - use default if not provided
    gst_rate = data.get('gst_rate')
    if gst_rate is None:
        gst_rate = DEFAULT_GST_RATE
        logging.debug(f"gst_rate not provided, using default: {DEFAULT_GST_RATE}%")
    else:
        # Validate gst_rate if provided
        try:
            gst_rate = float(gst_rate)
            if gst_rate < 0 or gst_rate > 100:
                logging.error(f"Invalid gst_rate: {gst_rate}")
                return JsonResponse({"Error": "gst_rate must be between 0 and 100"}, status=BAD_REQUEST_STATUS)
            logging.debug(f"gst_rate provided: {gst_rate}%")
        except (ValueError, TypeError):
            logging.error(f"Invalid gst_rate format: {gst_rate}")
            return JsonResponse({"Error": "gst_rate must be a valid number"}, status=BAD_REQUEST_STATUS)
    
    # Validate optional fields
    if data.get('currency') and len(data['currency']) > 3:
        logging.error(f"currency too long: {data['currency']}")
        return JsonResponse({"Error": "currency must be max 3 characters"}, status=BAD_REQUEST_STATUS)

    # Set default values for optional fields
    optional_fields = {
        'currency': 'INR',
        'features': None,
        'is_active': 1
    }
    for field in optional_fields:
        data[field] = data.get(field, optional_fields[field])

    # Calculate GST components for response
    gst_amount, total_price = calculate_gst_components(base_price, gst_rate)

    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                # Check for duplicate plan_type and billing_period combination (excluding current plan)
                cursor.execute(f"SELECT COUNT(*) FROM {TBL_PLANS} WHERE plan_type = %s AND billing_period = %s AND id != %s", 
                             [data['plan_type'], data['billing_period'], id])
                if cursor.fetchone()[0] > 0:
                    logging.error(f"Plan with plan_type {data['plan_type']} and billing_period {data['billing_period']} already exists")
                    return JsonResponse({"Error": f"Plan with plan_type '{data['plan_type']}' and billing_period '{data['billing_period']}' already exists"}, status=BAD_REQUEST_STATUS)
                
                # Note: gst_amount and total_price are auto-calculated by database
                update_query = f"""
                UPDATE {TBL_PLANS}
                SET plan_name = %s,
                    plan_type = %s,
                    billing_period = %s,
                    base_price = %s,
                    gst_rate = %s,
                    currency = %s,
                    features = %s,
                    is_active = %s
                WHERE id = %s
                """
                values = [
                    data['plan_name'],
                    data['plan_type'],
                    data['billing_period'],
                    data['base_price'],
                    gst_rate,
                    data['currency'],
                    data['features'],
                    data['is_active'],
                    id
                ]
                cursor.execute(update_query, values)
                if cursor.rowcount == 0:
                    logging.error(f"Plan ID {id} not found")
                    return JsonResponse({"Error": "Plan not found"}, status=NOT_FOUND_STATUS)

    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    logging.info(f"Plan updated successfully: ID {id}, Base: ₹{base_price}, GST: {gst_rate}% (₹{gst_amount}), Total: ₹{total_price}")

    return JsonResponse({
        "Message": "Plan updated successfully",
        "Plan_Id": id,
        "Updated_Details": {
            "Base_Price": float(base_price),
            "GST_Rate": f"{gst_rate}%",
            "GST_Amount": float(gst_amount),
            "Total_Price": float(total_price)
        }
    }, status=SUCCESS_STATUS)


@require_http_methods(["DELETE"])
@csrf_exempt
def Delete_Plan(request, id):
    create_plans_table()

    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                select_query = f"SELECT plan_name FROM {TBL_PLANS} WHERE id = %s AND is_active = 1"
                cursor.execute(select_query, [id])
                row = cursor.fetchone()
                if not row:
                    logging.error(f"Plan ID {id} not found or inactive")
                    return JsonResponse({"Error": "Plan not found or inactive"}, status=NOT_FOUND_STATUS)

                delete_action = f"UPDATE {TBL_PLANS} SET is_active = 0 WHERE id = %s AND is_active = 1"
                cursor.execute(delete_action, [id])
                if cursor.rowcount == 0:
                    logging.error(f"Plan ID {id} not found or inactive")
                    return JsonResponse({"Error": "Plan not found or inactive"}, status=NOT_FOUND_STATUS)

    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse({"Message": f"Plan ID {id} deleted successfully"}, status=SUCCESS_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def Filter_Plans_By_Billing_Period(request):
    create_plans_table()
    
    # Get billing_period from query parameter
    billing_period = request.GET.get('billing_period', None)
    
    # Validate billing_period parameter
    if not billing_period:
        logging.error("billing_period parameter is required")
        return JsonResponse({"Error": "billing_period parameter is required. Use: ?billing_period=monthly or ?billing_period=yearly"}, status=BAD_REQUEST_STATUS)
    
    if billing_period not in ['monthly', 'yearly']:
        logging.error(f"Invalid billing_period: {billing_period}")
        return JsonResponse({"Error": "billing_period must be either 'monthly' or 'yearly'"}, status=BAD_REQUEST_STATUS)
    
    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT id, plan_name, plan_type, billing_period, base_price, gst_rate, gst_amount, total_price,
                   currency, features, is_active, created_at, updated_at
            FROM {TBL_PLANS}
            WHERE billing_period = %s AND is_active = 1
            ORDER BY 
                CASE plan_type 
                    WHEN 'basic' THEN 1 
                    WHEN 'pro' THEN 2 
                    WHEN 'pro_max' THEN 3 
                END
            """
            cursor.execute(select_query, [billing_period])
            rows = cursor.fetchall()
            
            if not rows:
                logging.info(f"No active plans found for billing_period: {billing_period}")
                return JsonResponse([], safe=False, status=SUCCESS_STATUS)
            
            plans = [
                dict(zip([
                    'id', 'plan_name', 'plan_type', 'billing_period', 'base_price', 'gst_rate', 'gst_amount',
                    'total_price', 'currency', 'features', 'is_active', 'created_at', 'updated_at'
                ], row))
                for row in rows
            ]
            
            logging.debug(f"Found {len(plans)} plans for billing_period: {billing_period}")
            
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)
    
    return JsonResponse(plans, safe=False, status=SUCCESS_STATUS)
