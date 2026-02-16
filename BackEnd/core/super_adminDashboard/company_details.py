# core/super_adminDashboard/company_details.py

from django.db import connection, transaction
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.urls import path
from django.db import models
from django.db.utils import ProgrammingError, OperationalError
import json
import logging
import re

# Global Variables
TBL_COMPANY_DETAILS = 'tbl_company_details'

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
NOT_FOUND_STATUS = 404
SERVER_ERROR_STATUS = 500

# Configure Logging
logging.basicConfig(
    filename='company_details_debug.log',
    level=logging.DEBUG,
    format='%(asctime)s %(levelname)s %(message)s'
)

class CompanyDetails(models.Model):
    id = models.AutoField(primary_key=True)
    company_legal_name = models.CharField(max_length=200)
    company_trade_name = models.CharField(max_length=200)
    gstin = models.CharField(max_length=15, unique=True)
    address_line1 = models.CharField(max_length=200)
    address_line2 = models.CharField(max_length=200, blank=True, null=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    pincode = models.CharField(max_length=10)
    country = models.CharField(max_length=50, default='India')
    email = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    website = models.CharField(max_length=100, blank=True, null=True)
    bank_name = models.CharField(max_length=100, blank=True, null=True)
    account_number = models.CharField(max_length=50, blank=True, null=True)
    ifsc_code = models.CharField(max_length=15, blank=True, null=True)
    account_holder_name = models.CharField(max_length=200, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_company_details'
        app_label = 'core'
        indexes = [
            models.Index(fields=['state'], name='idx_cd_state'),
            models.Index(fields=['is_active'], name='idx_cd_active'),
        ]


def create_company_details_table():
    """Create tbl_company_details table for invoice generation"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tbl_company_details (
                    id INT NOT NULL AUTO_INCREMENT,
                    company_legal_name VARCHAR(200) NOT NULL COMMENT 'Legal registered name of company',
                    company_trade_name VARCHAR(200) NOT NULL COMMENT 'Trade name for invoices',
                    gstin VARCHAR(15) NOT NULL COMMENT 'GST Identification Number',
                    address_line1 VARCHAR(200) NOT NULL COMMENT 'Company address line 1',
                    address_line2 VARCHAR(200) DEFAULT NULL COMMENT 'Company address line 2 (optional)',
                    city VARCHAR(100) NOT NULL COMMENT 'Company city',
                    state VARCHAR(100) NOT NULL COMMENT 'Company registered state - CRITICAL for GST',
                    pincode VARCHAR(10) NOT NULL COMMENT 'Company pincode',
                    country VARCHAR(50) NOT NULL DEFAULT 'India' COMMENT 'Company country',
                    email VARCHAR(100) NOT NULL COMMENT 'Company contact email',
                    phone VARCHAR(20) NOT NULL COMMENT 'Company contact phone',
                    website VARCHAR(100) DEFAULT NULL COMMENT 'Company website (optional)',
                    bank_name VARCHAR(100) DEFAULT NULL COMMENT 'Bank name for payment reference',
                    account_number VARCHAR(50) DEFAULT NULL COMMENT 'Bank account number',
                    ifsc_code VARCHAR(15) DEFAULT NULL COMMENT 'Bank IFSC code',
                    account_holder_name VARCHAR(200) DEFAULT NULL COMMENT 'Account holder name',
                    is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Is this company profile active',
                    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    UNIQUE KEY gstin (gstin),
                    INDEX idx_company_state (state),
                    INDEX idx_company_active (is_active)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Company details for invoice generation'
            """)
            logger.info("✓ tbl_company_details table ready")
            return True
    except Exception as e:
        logger.error(f"✗ Error creating company details table: {e}")
        return False
   
# ==================== HELPER FUNCTIONS ====================

def validate_email(email):
    """Validate email format"""
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(email_pattern, email) is not None


def validate_gstin(gstin):
    """
    Validate GSTIN format: 99AAAAA9999A9Z9
    - First 2 digits: State code
    - Next 10 chars: PAN number
    - 13th char: Entity number (1-9, A-Z)
    - 14th char: Z (default)
    - 15th char: Checksum
    """
    gstin_pattern = r'^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
    return re.match(gstin_pattern, gstin) is not None


def validate_pincode(pincode):
    """Validate Indian pincode (6 digits)"""
    pincode_pattern = r'^\d{6}$'
    return re.match(pincode_pattern, pincode) is not None


def validate_phone(phone):
    """Validate phone number"""
    # Allow formats: +91-80-12345678, +91 80 12345678, 080-12345678, 08012345678
    phone_pattern = r'^[\+]?[0-9\-\s]{10,15}$'
    return re.match(phone_pattern, phone) is not None


def validate_ifsc(ifsc):
    """Validate IFSC code format: ABCD0123456"""
    ifsc_pattern = r'^[A-Z]{4}0[A-Z0-9]{6}$'
    return re.match(ifsc_pattern, ifsc) is not None


def validate_state(state):
    """Validate if state is a valid Indian state/UT"""
    return state in VALID_INDIAN_STATES


# ==================== COMPANY DETAILS APIs ====================

@require_http_methods(["POST"])
@csrf_exempt
def Create_Company_Details(request):
    """
    Create company details (typically done once during setup)
    
    Expected JSON:
    {
        "company_legal_name": "Lanciere Technologies Private Limited",
        "company_trade_name": "Lanciere Technologies",
        "gstin": "29AABCL1234C1Z5",
        "address_line1": "123 MG Road",
        "address_line2": "Koramangala",  // Optional
        "city": "Bangalore",
        "state": "Karnataka",
        "pincode": "560034",
        "country": "India",  // Optional, defaults to India
        "email": "billing@lancieretech.com",
        "phone": "+91-80-12345678",
        "website": "https://www.lancieretech.com",  // Optional
        "bank_name": "HDFC Bank",  // Optional
        "account_number": "50100123456789",  // Optional
        "ifsc_code": "HDFC0001234",  // Optional
        "account_holder_name": "Lanciere Technologies Pvt Ltd",  // Optional
        "is_active": 1  // Optional, defaults to 1
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
            logging.error("Expected single company object, got list")
            return JsonResponse(
                {"Error": "Expected a single company object, not a list"},
                status=BAD_REQUEST_STATUS
            )
    except json.JSONDecodeError as e:
        logging.error(f"Invalid JSON: {e}")
        return JsonResponse({"Error": "Invalid JSON format"}, status=BAD_REQUEST_STATUS)

    # Validate required fields
    required_fields = [
        'company_legal_name', 'company_trade_name', 'gstin',
        'address_line1', 'city', 'state', 'pincode',
        'email', 'phone'
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
    company_legal_name = data['company_legal_name'].strip()
    company_trade_name = data['company_trade_name'].strip()
    gstin = data['gstin'].strip().upper()
    address_line1 = data['address_line1'].strip()
    address_line2 = data.get('address_line2', '').strip() if data.get('address_line2') else None
    city = data['city'].strip()
    state = data['state'].strip()
    pincode = data['pincode'].strip()
    country = data.get('country', 'India').strip()
    email = data['email'].strip()
    phone = data['phone'].strip()
    website = data.get('website', '').strip() if data.get('website') else None
    bank_name = data.get('bank_name', '').strip() if data.get('bank_name') else None
    account_number = data.get('account_number', '').strip() if data.get('account_number') else None
    ifsc_code = data.get('ifsc_code', '').strip().upper() if data.get('ifsc_code') else None
    account_holder_name = data.get('account_holder_name', '').strip() if data.get('account_holder_name') else None
    is_active = data.get('is_active', 1)

    # Validate field lengths
    if len(company_legal_name) > 200:
        return JsonResponse({"Error": "Company legal name must be max 200 characters"}, status=BAD_REQUEST_STATUS)
    
    if len(company_trade_name) > 200:
        return JsonResponse({"Error": "Company trade name must be max 200 characters"}, status=BAD_REQUEST_STATUS)
    
    # Validate GSTIN format
    if not validate_gstin(gstin):
        return JsonResponse({
            "Error": "Invalid GSTIN format. Must be 15 characters (e.g., 29AABCL1234C1Z5)"
        }, status=BAD_REQUEST_STATUS)
    
    # Validate address fields
    if len(address_line1) > 200:
        return JsonResponse({"Error": "Address line 1 must be max 200 characters"}, status=BAD_REQUEST_STATUS)
    
    if address_line2 and len(address_line2) > 200:
        return JsonResponse({"Error": "Address line 2 must be max 200 characters"}, status=BAD_REQUEST_STATUS)
    
    if len(city) > 100:
        return JsonResponse({"Error": "City must be max 100 characters"}, status=BAD_REQUEST_STATUS)
    
    # Validate state
    if not validate_state(state):
        return JsonResponse({
            "Error": f"Invalid state. Must be a valid Indian state or UT. You provided: '{state}'",
            "Valid_States": VALID_INDIAN_STATES
        }, status=BAD_REQUEST_STATUS)
    
    # Validate pincode
    if not validate_pincode(pincode):
        return JsonResponse({"Error": "Invalid pincode. Must be 6 digits"}, status=BAD_REQUEST_STATUS)
    
    if len(country) > 50:
        return JsonResponse({"Error": "Country must be max 50 characters"}, status=BAD_REQUEST_STATUS)
    
    # Validate email
    if not validate_email(email):
        return JsonResponse({"Error": "Invalid email format"}, status=BAD_REQUEST_STATUS)
    
    if len(email) > 100:
        return JsonResponse({"Error": "Email must be max 100 characters"}, status=BAD_REQUEST_STATUS)
    
    # Validate phone
    if not validate_phone(phone):
        return JsonResponse({"Error": "Invalid phone format"}, status=BAD_REQUEST_STATUS)
    
    if len(phone) > 20:
        return JsonResponse({"Error": "Phone must be max 20 characters"}, status=BAD_REQUEST_STATUS)
    
    # Validate optional fields
    if website and len(website) > 100:
        return JsonResponse({"Error": "Website must be max 100 characters"}, status=BAD_REQUEST_STATUS)
    
    if bank_name and len(bank_name) > 100:
        return JsonResponse({"Error": "Bank name must be max 100 characters"}, status=BAD_REQUEST_STATUS)
    
    if account_number and len(account_number) > 50:
        return JsonResponse({"Error": "Account number must be max 50 characters"}, status=BAD_REQUEST_STATUS)
    
    if ifsc_code:
        if not validate_ifsc(ifsc_code):
            return JsonResponse({"Error": "Invalid IFSC code format (e.g., HDFC0001234)"}, status=BAD_REQUEST_STATUS)
        if len(ifsc_code) > 15:
            return JsonResponse({"Error": "IFSC code must be max 15 characters"}, status=BAD_REQUEST_STATUS)
    
    if account_holder_name and len(account_holder_name) > 200:
        return JsonResponse({"Error": "Account holder name must be max 200 characters"}, status=BAD_REQUEST_STATUS)

    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                # Check if GSTIN already exists
                cursor.execute(f"SELECT COUNT(*) FROM {TBL_COMPANY_DETAILS} WHERE gstin = %s", [gstin])
                if cursor.fetchone()[0] > 0:
                    logging.error(f"Company with GSTIN {gstin} already exists")
                    return JsonResponse(
                        {"Error": f"Company with GSTIN '{gstin}' already exists"},
                        status=BAD_REQUEST_STATUS
                    )

                # Insert company details
                insert_query = f"""
                INSERT INTO {TBL_COMPANY_DETAILS} (
                    company_legal_name, company_trade_name, gstin,
                    address_line1, address_line2, city, state, pincode, country,
                    email, phone, website,
                    bank_name, account_number, ifsc_code, account_holder_name,
                    is_active
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                values = [
                    company_legal_name, company_trade_name, gstin,
                    address_line1, address_line2, city, state, pincode, country,
                    email, phone, website,
                    bank_name, account_number, ifsc_code, account_holder_name,
                    is_active
                ]
                cursor.execute(insert_query, values)
                cursor.execute("SELECT LAST_INSERT_ID()")
                company_id = cursor.fetchone()[0]

        logging.info(f"Company details created successfully: ID {company_id}, GSTIN: {gstin}")
        
        return JsonResponse({
            "Message": "Company details created successfully",
            "Company_ID": company_id,
            "Company_Details": {
                "Company_Legal_Name": company_legal_name,
                "Company_Trade_Name": company_trade_name,
                "GSTIN": gstin,
                "State": state,
                "Email": email,
                "Phone": phone
            }
        }, status=CREATED_STATUS)

    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def Get_Active_Company_Details(request):
    """Get active company details (for invoice generation)"""
    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT id, company_legal_name, company_trade_name, gstin,
                   address_line1, address_line2, city, state, pincode, country,
                   email, phone, website,
                   bank_name, account_number, ifsc_code, account_holder_name,
                   is_active, created_at, updated_at
            FROM {TBL_COMPANY_DETAILS}
            WHERE is_active = 1
            LIMIT 1
            """
            cursor.execute(select_query)
            row = cursor.fetchone()
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    if row:
        company = dict(zip([
            'Company_ID', 'Company_Legal_Name', 'Company_Trade_Name', 'GSTIN',
            'Address_Line1', 'Address_Line2', 'City', 'State', 'Pincode', 'Country',
            'Email', 'Phone', 'Website',
            'Bank_Name', 'Account_Number', 'IFSC_Code', 'Account_Holder_Name',
            'Is_Active', 'Created_At', 'Updated_At'
        ], row))
        
        return JsonResponse(company, status=SUCCESS_STATUS)
    
    logging.error("No active company details found")
    return JsonResponse({
        "Error": "No active company details found. Please create company details first."
    }, status=NOT_FOUND_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def Get_Company_Details_By_ID(request, company_id):
    """Get company details by ID"""
    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT id, company_legal_name, company_trade_name, gstin,
                   address_line1, address_line2, city, state, pincode, country,
                   email, phone, website,
                   bank_name, account_number, ifsc_code, account_holder_name,
                   is_active, created_at, updated_at
            FROM {TBL_COMPANY_DETAILS}
            WHERE id = %s
            """
            cursor.execute(select_query, [company_id])
            row = cursor.fetchone()
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    if row:
        company = dict(zip([
            'Company_ID', 'Company_Legal_Name', 'Company_Trade_Name', 'GSTIN',
            'Address_Line1', 'Address_Line2', 'City', 'State', 'Pincode', 'Country',
            'Email', 'Phone', 'Website',
            'Bank_Name', 'Account_Number', 'IFSC_Code', 'Account_Holder_Name',
            'Is_Active', 'Created_At', 'Updated_At'
        ], row))
        
        return JsonResponse(company, status=SUCCESS_STATUS)
    
    logging.error(f"Company ID {company_id} not found")
    return JsonResponse({"Error": "Company not found"}, status=NOT_FOUND_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def List_All_Company_Details(request):
    """List all company details (Admin use)"""
    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT id, company_legal_name, company_trade_name, gstin,
                   address_line1, address_line2, city, state, pincode, country,
                   email, phone, website,
                   bank_name, account_number, ifsc_code, account_holder_name,
                   is_active, created_at, updated_at
            FROM {TBL_COMPANY_DETAILS}
            ORDER BY is_active DESC, created_at DESC
            """
            cursor.execute(select_query)
            rows = cursor.fetchall()
            
            companies = []
            for row in rows:
                company = dict(zip([
                    'Company_ID', 'Company_Legal_Name', 'Company_Trade_Name', 'GSTIN',
                    'Address_Line1', 'Address_Line2', 'City', 'State', 'Pincode', 'Country',
                    'Email', 'Phone', 'Website',
                    'Bank_Name', 'Account_Number', 'IFSC_Code', 'Account_Holder_Name',
                    'Is_Active', 'Created_At', 'Updated_At'
                ], row))
                companies.append(company)
                
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse(companies, safe=False, status=SUCCESS_STATUS)


@require_http_methods(["PUT"])
@csrf_exempt
def Update_Company_Details(request, company_id):
    """
    Update company details
    
    Expected JSON: Same as Create (all fields optional, only provided fields will be updated)
    """
    try:
        logging.debug(f"Raw request body: {request.body}")
        data = json.loads(request.body)
        logging.debug(f"Parsed JSON: {json.dumps(data, indent=2)}")
        
        if isinstance(data, list) and len(data) == 1:
            data = data[0]
            logging.debug(f"Unwrapped list to: {json.dumps(data, indent=2)}")
        elif isinstance(data, list):
            logging.error("Expected single company object, got list")
            return JsonResponse(
                {"Error": "Expected a single company object, not a list"},
                status=BAD_REQUEST_STATUS
            )
    except json.JSONDecodeError as e:
        logging.error(f"Invalid JSON: {e}")
        return JsonResponse({"Error": "Invalid JSON format"}, status=BAD_REQUEST_STATUS)

    # Build update query dynamically based on provided fields
    update_fields = []
    values = []
    
    # Validate and add each field if provided
    if 'company_legal_name' in data and data['company_legal_name']:
        company_legal_name = data['company_legal_name'].strip()
        if len(company_legal_name) > 200:
            return JsonResponse({"Error": "Company legal name must be max 200 characters"}, status=BAD_REQUEST_STATUS)
        update_fields.append("company_legal_name = %s")
        values.append(company_legal_name)
    
    if 'company_trade_name' in data and data['company_trade_name']:
        company_trade_name = data['company_trade_name'].strip()
        if len(company_trade_name) > 200:
            return JsonResponse({"Error": "Company trade name must be max 200 characters"}, status=BAD_REQUEST_STATUS)
        update_fields.append("company_trade_name = %s")
        values.append(company_trade_name)
    
    if 'gstin' in data and data['gstin']:
        gstin = data['gstin'].strip().upper()
        if not validate_gstin(gstin):
            return JsonResponse({"Error": "Invalid GSTIN format"}, status=BAD_REQUEST_STATUS)
        update_fields.append("gstin = %s")
        values.append(gstin)
    
    if 'address_line1' in data and data['address_line1']:
        address_line1 = data['address_line1'].strip()
        if len(address_line1) > 200:
            return JsonResponse({"Error": "Address line 1 must be max 200 characters"}, status=BAD_REQUEST_STATUS)
        update_fields.append("address_line1 = %s")
        values.append(address_line1)
    
    if 'address_line2' in data:
        address_line2 = data['address_line2'].strip() if data['address_line2'] else None
        if address_line2 and len(address_line2) > 200:
            return JsonResponse({"Error": "Address line 2 must be max 200 characters"}, status=BAD_REQUEST_STATUS)
        update_fields.append("address_line2 = %s")
        values.append(address_line2)
    
    if 'city' in data and data['city']:
        city = data['city'].strip()
        if len(city) > 100:
            return JsonResponse({"Error": "City must be max 100 characters"}, status=BAD_REQUEST_STATUS)
        update_fields.append("city = %s")
        values.append(city)
    
    if 'state' in data and data['state']:
        state = data['state'].strip()
        if not validate_state(state):
            return JsonResponse({
                "Error": f"Invalid state. You provided: '{state}'",
                "Valid_States": VALID_INDIAN_STATES
            }, status=BAD_REQUEST_STATUS)
        update_fields.append("state = %s")
        values.append(state)
    
    if 'pincode' in data and data['pincode']:
        pincode = data['pincode'].strip()
        if not validate_pincode(pincode):
            return JsonResponse({"Error": "Invalid pincode. Must be 6 digits"}, status=BAD_REQUEST_STATUS)
        update_fields.append("pincode = %s")
        values.append(pincode)
    
    if 'country' in data and data['country']:
        country = data['country'].strip()
        if len(country) > 50:
            return JsonResponse({"Error": "Country must be max 50 characters"}, status=BAD_REQUEST_STATUS)
        update_fields.append("country = %s")
        values.append(country)
    
    if 'email' in data and data['email']:
        email = data['email'].strip()
        if not validate_email(email):
            return JsonResponse({"Error": "Invalid email format"}, status=BAD_REQUEST_STATUS)
        if len(email) > 100:
            return JsonResponse({"Error": "Email must be max 100 characters"}, status=BAD_REQUEST_STATUS)
        update_fields.append("email = %s")
        values.append(email)
    
    if 'phone' in data and data['phone']:
        phone = data['phone'].strip()
        if not validate_phone(phone):
            return JsonResponse({"Error": "Invalid phone format"}, status=BAD_REQUEST_STATUS)
        if len(phone) > 20:
            return JsonResponse({"Error": "Phone must be max 20 characters"}, status=BAD_REQUEST_STATUS)
        update_fields.append("phone = %s")
        values.append(phone)
    
    if 'website' in data:
        website = data['website'].strip() if data['website'] else None
        if website and len(website) > 100:
            return JsonResponse({"Error": "Website must be max 100 characters"}, status=BAD_REQUEST_STATUS)
        update_fields.append("website = %s")
        values.append(website)
    
    if 'bank_name' in data:
        bank_name = data['bank_name'].strip() if data['bank_name'] else None
        if bank_name and len(bank_name) > 100:
            return JsonResponse({"Error": "Bank name must be max 100 characters"}, status=BAD_REQUEST_STATUS)
        update_fields.append("bank_name = %s")
        values.append(bank_name)
    
    if 'account_number' in data:
        account_number = data['account_number'].strip() if data['account_number'] else None
        if account_number and len(account_number) > 50:
            return JsonResponse({"Error": "Account number must be max 50 characters"}, status=BAD_REQUEST_STATUS)
        update_fields.append("account_number = %s")
        values.append(account_number)
    
    if 'ifsc_code' in data:
        ifsc_code = data['ifsc_code'].strip().upper() if data['ifsc_code'] else None
        if ifsc_code:
            if not validate_ifsc(ifsc_code):
                return JsonResponse({"Error": "Invalid IFSC code format"}, status=BAD_REQUEST_STATUS)
            if len(ifsc_code) > 15:
                return JsonResponse({"Error": "IFSC code must be max 15 characters"}, status=BAD_REQUEST_STATUS)
        update_fields.append("ifsc_code = %s")
        values.append(ifsc_code)
    
    if 'account_holder_name' in data:
        account_holder_name = data['account_holder_name'].strip() if data['account_holder_name'] else None
        if account_holder_name and len(account_holder_name) > 200:
            return JsonResponse({"Error": "Account holder name must be max 200 characters"}, status=BAD_REQUEST_STATUS)
        update_fields.append("account_holder_name = %s")
        values.append(account_holder_name)
    
    if 'is_active' in data:
        is_active = data['is_active']
        update_fields.append("is_active = %s")
        values.append(is_active)
    
    # Check if any fields to update
    if not update_fields:
        logging.error("No fields provided for update")
        return JsonResponse({"Error": "No fields provided for update"}, status=BAD_REQUEST_STATUS)

    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                # Build and execute update query
                update_query = f"""
                UPDATE {TBL_COMPANY_DETAILS}
                SET {', '.join(update_fields)}
                WHERE id = %s
                """
                values.append(company_id)
                cursor.execute(update_query, values)
                
                if cursor.rowcount == 0:
                    logging.error(f"Company ID {company_id} not found")
                    return JsonResponse(
                        {"Error": "Company not found"},
                        status=NOT_FOUND_STATUS
                    )

        logging.info(f"Company details updated successfully: ID {company_id}")
        
        return JsonResponse({
            "Message": "Company details updated successfully",
            "Company_ID": company_id
        }, status=SUCCESS_STATUS)

    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)


@require_http_methods(["DELETE"])
@csrf_exempt
def Delete_Company_Details(request, company_id):
    """Soft delete company details (set is_active = 0)"""
    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                # Check if company exists
                cursor.execute(f"SELECT company_trade_name FROM {TBL_COMPANY_DETAILS} WHERE id = %s AND is_active = 1", [company_id])
                row = cursor.fetchone()
                if not row:
                    logging.error(f"Company ID {company_id} not found or inactive")
                    return JsonResponse(
                        {"Error": "Company not found or inactive"},
                        status=NOT_FOUND_STATUS
                    )

                # Soft delete (set is_active = 0)
                delete_action = f"UPDATE {TBL_COMPANY_DETAILS} SET is_active = 0 WHERE id = %s AND is_active = 1"
                cursor.execute(delete_action, [company_id])
                
                if cursor.rowcount == 0:
                    logging.error(f"Company ID {company_id} not found or inactive")
                    return JsonResponse(
                        {"Error": "Company not found or inactive"},
                        status=NOT_FOUND_STATUS
                    )

    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse({
        "Message": f"Company ID {company_id} deactivated successfully"
    }, status=SUCCESS_STATUS)


# ==================== URL PATTERNS ====================

urlpatterns = [
    path('api/company/create', Create_Company_Details, name='Create_Company_Details'),
    path('api/company/active', Get_Active_Company_Details, name='Get_Active_Company_Details'),
    path('api/company/<int:company_id>', Get_Company_Details_By_ID, name='Get_Company_Details_By_ID'),
    path('api/company/list', List_All_Company_Details, name='List_All_Company_Details'),
    path('api/company/update/<int:company_id>', Update_Company_Details, name='Update_Company_Details'),
    path('api/company/delete/<int:company_id>', Delete_Company_Details, name='Delete_Company_Details'),
]