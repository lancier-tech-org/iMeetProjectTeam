from django.db import connection, transaction
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.urls import path
from django.db import models
from django.db.utils import ProgrammingError, OperationalError
from django.utils import timezone
import pytz
import json
import logging
import re
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import boto3
from botocore.exceptions import ClientError
import os
from dotenv import load_dotenv
import base64
from pymongo import MongoClient
from urllib.parse import quote_plus
import uuid
import certifi
import ssl

# Set SSL certificate path globally
os.environ['SSL_CERT_FILE'] = certifi.where()
os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()

# Global Variables
TBL_SUPER_ADMIN = 'tbl_Super_Admin'

SUCCESS_STATUS = 200
CREATED_STATUS = 201
BAD_REQUEST_STATUS = 400
UNAUTHORIZED_STATUS = 401
FORBIDDEN_STATUS = 403
NOT_FOUND_STATUS = 404
SERVER_ERROR_STATUS = 500

# Email configuration from .env
SMTP_SERVER = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.getenv('EMAIL_PORT', 587))
SMTP_USERNAME = os.getenv('EMAIL_HOST_USER')
SMTP_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD')
FROM_EMAIL = os.getenv('EMAIL_HOST_USER')


# Load .env file - adjust path if needed
load_dotenv()  # This loads from .env in current directory
# OR specify path: load_dotenv('/path/to/your/.env')

# Now get the values
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
AWS_S3_BUCKET = os.getenv('AWS_S3_BUCKET', 'connectly-storage')
S3_FOLDER_PROFILE_PHOTOS = os.getenv('S3_FOLDER_PROFILE_PHOTOS', 'profile_photos')

# Debug: Print to verify credentials are loaded (remove after testing)
print(f"🔧 AWS_ACCESS_KEY_ID loaded: {'Yes' if AWS_ACCESS_KEY_ID else 'NO - MISSING!'}")
print(f"🔧 AWS_SECRET_ACCESS_KEY loaded: {'Yes' if AWS_SECRET_ACCESS_KEY else 'NO - MISSING!'}")
print(f"🔧 AWS_S3_BUCKET: {AWS_S3_BUCKET}")
print(f"🔧 AWS_REGION: {AWS_REGION}")

# ✅ MongoDB Configuration
MONGO_USER = os.getenv('MONGO_USER', 'connectly')
MONGO_PASSWORD = os.getenv('MONGO_PASSWORD', 'LT@connect25')
MONGO_HOST = os.getenv('MONGO_HOST', 'mongodb.databases.svc.cluster.local')
MONGO_PORT = os.getenv('MONGO_PORT', '27017')
MONGO_DB = os.getenv('MONGO_DB', 'connectlydb')

logging.basicConfig(filename='super_admin_debug.log', level=logging.DEBUG, format='%(asctime)s %(levelname)s %(message)s')


# ✅ MongoDB Connection Helper
def get_mongo_client():
    """Get MongoDB client connection"""
    try:
        # URL encode the password to handle special characters like @
        encoded_password = quote_plus(MONGO_PASSWORD)
        mongo_uri = f"mongodb://{MONGO_USER}:{encoded_password}@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB}?authSource=admin"
        
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        # Test connection
        client.admin.command('ping')
        logging.debug("✅ MongoDB connection successful")
        return client
    except Exception as e:
        logging.error(f"❌ MongoDB connection failed: {e}")
        return None

# ============================================
# FUNCTION 1: get_mongo_db() - FIXED
# ============================================
def get_mongo_db():
    """Get MongoDB database instance"""
    client = get_mongo_client()
    if client is not None:  # ✅ FIXED: Use "is not None" instead of just "if client"
        return client[MONGO_DB]
    return None

# ============================================
# FUNCTION 2: store_photo_reference_mongodb() - FIXED
# ============================================
def store_photo_reference_mongodb(user_id, user_type, photo_url, original_filename=None):
    """
    Store photo reference in MongoDB
    
    Args:
        user_id: The user's ID from MySQL
        user_type: 'super_admin' or 'user'
        photo_url: The S3 URL of the uploaded photo
        original_filename: Original filename if available
    
    Returns:
        MongoDB document ID or None
    """
    try:
        db = get_mongo_db()
        if db is None:  # ✅ FIXED: Use "is None" instead of "not db"
            logging.error("❌ Could not connect to MongoDB")
            return None
        
        collection = db['profile_photos']
        
        # Create document
        photo_doc = {
            'user_id': user_id,
            'user_type': user_type,
            'photo_url': photo_url,
            'original_filename': original_filename,
            'created_at': timezone.now(),
            'updated_at': timezone.now(),
            'is_active': True
        }
        
        # Check if user already has a photo record
        existing = collection.find_one({
            'user_id': user_id,
            'user_type': user_type,
            'is_active': True
        })
        
        if existing is not None:  # ✅ FIXED
            # Update existing record
            result = collection.update_one(
                {'_id': existing['_id']},
                {
                    '$set': {
                        'photo_url': photo_url,
                        'original_filename': original_filename,
                        'updated_at': timezone.now()
                    }
                }
            )
            logging.debug(f"✅ Updated photo reference in MongoDB for user {user_id}")
            return str(existing['_id'])
        else:
            # Insert new record
            result = collection.insert_one(photo_doc)
            logging.debug(f"✅ Stored new photo reference in MongoDB: {result.inserted_id}")
            return str(result.inserted_id)
            
    except Exception as e:
        logging.error(f"❌ Failed to store photo reference in MongoDB: {e}")
        return None

# ============================================
# FUNCTION 3: get_photo_url_from_mongodb() - FIXED
# ============================================
def get_photo_url_from_mongodb(user_id, user_type):
    """
    Get photo URL from MongoDB for a user
    
    Args:
        user_id: The user's ID from MySQL
        user_type: 'super_admin' or 'user'
    
    Returns:
        Photo URL string or None
    """
    try:
        db = get_mongo_db()
        if db is None:  # ✅ FIXED: Use "is None" instead of "not db"
            logging.error("❌ Could not connect to MongoDB")
            return None
        
        collection = db['profile_photos']
        
        # Find active photo for user
        photo_doc = collection.find_one({
            'user_id': user_id,
            'user_type': user_type,
            'is_active': True
        })
        
        if photo_doc is not None:  # ✅ FIXED
            logging.debug(f"✅ Found photo URL in MongoDB for user {user_id}: {photo_doc['photo_url']}")
            return photo_doc['photo_url']
        
        logging.debug(f"⚠️ No photo found in MongoDB for user {user_id}")
        return None
        
    except Exception as e:
        logging.error(f"❌ Failed to get photo from MongoDB: {e}")
        return None

# ============================================
# FUNCTION 4: delete_photo_reference_mongodb() - FIXED
# ============================================
def delete_photo_reference_mongodb(user_id, user_type):
    """Soft delete photo reference in MongoDB"""
    try:
        db = get_mongo_db()
        if db is None:  # ✅ FIXED: Use "is None" instead of "not db"
            return False
        
        collection = db['profile_photos']
        
        result = collection.update_many(
            {'user_id': user_id, 'user_type': user_type},
            {'$set': {'is_active': False, 'deleted_at': timezone.now()}}
        )
        
        logging.debug(f"✅ Soft deleted {result.modified_count} photo references for user {user_id}")
        return True
        
    except Exception as e:
        logging.error(f"❌ Failed to delete photo reference: {e}")
        return False

class SuperAdmin(models.Model):
    ID = models.AutoField(primary_key=True)
    Full_Name = models.CharField(max_length=100)
    Mobile_Number = models.CharField(max_length=15)
    Email = models.EmailField(max_length=100, unique=True)
    Password = models.CharField(max_length=50)
    Address = models.CharField(max_length=150, blank=True, null=True)
    Country = models.CharField(max_length=50, blank=True, null=True)
    Country_Code = models.CharField(max_length=10, blank=True, null=True)
    Timezone = models.CharField(max_length=50, blank=True, null=True)
    Languages = models.CharField(max_length=50, blank=True, null=True)
    status_code = models.CharField(max_length=1, default='s')
    status = models.BooleanField(default=True)
    Photo_upload = models.CharField(max_length=500, blank=True, null=True)  # ✅ Increased size for S3 URLs

    class Meta:
        db_table = 'tbl_Super_Admin'


def validate_password(password):
    """Validate password: 8+ chars, 1 upper, 1 lower, 1 number, 1 special char"""
    if not password:
        return False, "Password cannot be empty"
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain at least one special character"
    return True, ""


def generate_OTP():
    """Generate a 6-digit OTP"""
    return ''.join([str(random.randint(0, 9)) for _ in range(6)])


def send_OTP_email(email, OTP):
    """Send OTP to the provided email address"""
    try:
        msg = MIMEMultipart()
        msg['From'] = FROM_EMAIL
        msg['To'] = email
        msg['Subject'] = 'Your Password Reset OTP'
        
        body = f"Your OTP for password reset is: {OTP}\nThis OTP is valid for 10 minutes."
        msg.attach(MIMEText(body, 'plain'))

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.sendmail(FROM_EMAIL, email, msg.as_string())
        server.quit()
        logging.debug(f"OTP {OTP} sent to {email}")
        return True
    except Exception as e:
        logging.error(f"Failed to send OTP to {email}: {e}")
        return False


# ============================================
# STEP 2: Replace your upload_to_s3 function with this one
# ============================================

def upload_to_s3(file_data, file_name):
    """Upload file to AWS S3 and return the URL"""
    try:
        logging.debug(f"📸 Starting S3 upload for: {file_name}")
        
        # Check if AWS credentials are configured
        if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
            logging.error("❌ AWS credentials not configured!")
            return None
        
        if not AWS_S3_BUCKET:
            logging.error("❌ AWS_S3_BUCKET not configured!")
            return None
        
        # ✅ FIX: Create S3 client with SSL certificate handling
        import certifi
        from botocore.config import Config
        
        # Try with certifi certificates first
        try:
            s3_client = boto3.client(
                's3',
                aws_access_key_id=AWS_ACCESS_KEY_ID,
                aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
                region_name=AWS_REGION,
                verify=certifi.where()  # ✅ Use certifi's CA bundle
            )
        except Exception as cert_error:
            logging.warning(f"⚠️ Certifi not available, trying without custom CA: {cert_error}")
            # Fallback: disable SSL verification (NOT recommended for production)
            s3_client = boto3.client(
                's3',
                aws_access_key_id=AWS_ACCESS_KEY_ID,
                aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
                region_name=AWS_REGION,
                verify=False  # ⚠️ Only use if certifi fails
            )
        
        # Generate unique filename
        unique_id = uuid.uuid4().hex[:8]
        base_name, ext = os.path.splitext(file_name)
        if not ext:
            ext = '.jpg'
        unique_name = f"{base_name}_{unique_id}_{timezone.now().strftime('%Y%m%d%H%M%S')}{ext}"
        
        # Full S3 key with folder path
        s3_key = f"{S3_FOLDER_PROFILE_PHOTOS}/{unique_name}"
        
        # Handle base64 string
        if isinstance(file_data, str):
            logging.debug("📸 Processing base64 data...")
            if ',' in file_data:
                header, file_data = file_data.split(',', 1)
            
            try:
                file_data = base64.b64decode(file_data)
                logging.debug(f"📸 Decoded base64, size: {len(file_data)} bytes")
            except Exception as decode_error:
                logging.error(f"❌ Failed to decode base64: {decode_error}")
                return None
        
        # Determine content type
        content_type = 'image/jpeg'
        if file_name.lower().endswith('.png'):
            content_type = 'image/png'
        elif file_name.lower().endswith('.gif'):
            content_type = 'image/gif'
        elif file_name.lower().endswith('.webp'):
            content_type = 'image/webp'
        
        logging.debug(f"📸 Uploading to S3: bucket={AWS_S3_BUCKET}, key={s3_key}")
        
        # Upload to S3
        s3_client.put_object(
            Bucket=AWS_S3_BUCKET,
            Key=s3_key,
            Body=file_data,
            ContentType=content_type
        )
        
        # Generate public URL
        file_url = f"https://{AWS_S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"
        logging.debug(f"✅ File uploaded to S3: {file_url}")
        print(f"✅ S3 UPLOAD SUCCESS: {file_url}")
        
        return file_url
        
    except ClientError as e:
        logging.error(f"❌ AWS S3 ClientError: {e}")
        return None
    except Exception as e:
        logging.error(f"❌ Failed to upload to S3: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return None

def create_super_admin_table():
    """Create tbl_Super_Admin table if it doesn't exist"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tbl_Super_Admin (
                    ID INT AUTO_INCREMENT PRIMARY KEY,
                    Full_Name VARCHAR(100) NOT NULL,
                    Mobile_Number VARCHAR(15) NOT NULL,
                    Email VARCHAR(100) NOT NULL UNIQUE,
                    Password VARCHAR(50) NOT NULL,
                    Address VARCHAR(150) NULL,
                    Country VARCHAR(50) NULL,
                    Country_Code VARCHAR(10) NULL,
                    Timezone VARCHAR(50) NULL,
                    Languages VARCHAR(50) NULL,
                    status_code CHAR(1) DEFAULT 's',
                    status BOOLEAN DEFAULT 1,
                    Photo_upload VARCHAR(500) NULL
                )
            """)
            logging.debug("tbl_Super_Admin table created or exists")
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Failed to create tbl_Super_Admin table: {e}")


def create_otp_table():
    """Create tbl_OTP_Reset table if it doesn't exist"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tbl_OTP_Reset (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    email VARCHAR(100) NOT NULL,
                    otp VARCHAR(6) NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME NOT NULL,
                    used BOOLEAN DEFAULT 0
                )
            """)
            logging.debug("tbl_OTP_Reset table created or exists")
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Failed to create tbl_OTP_Reset table: {e}")


@require_http_methods(["POST"])
@csrf_exempt
def Register_Super_Admin(request):
    create_super_admin_table()
    
    try:
        logging.debug(f"Raw request body: {request.body}")
        data = json.loads(request.body)
        logging.debug(f"Parsed JSON: {json.dumps(data, indent=2)}")
        if isinstance(data, list) and len(data) == 1:
            data = data[0]
            logging.debug(f"Unwrapped list to: {json.dumps(data, indent=2)}")
        elif isinstance(data, list):
            logging.error("Expected single super admin object, got list")
            return JsonResponse({"Error": "Expected a single super admin object, not a list"}, status=BAD_REQUEST_STATUS)
    except json.JSONDecodeError as e:
        logging.error(f"Invalid JSON: {e}")
        return JsonResponse({"Error": "Invalid JSON format"}, status=BAD_REQUEST_STATUS)

    required_fields = ['Full_Name', 'Mobile_Number', 'Email', 'Password']
    missing_fields = [field for field in required_fields if field not in data or data[field] is None or (isinstance(data[field], str) and data[field].strip() == "")]
    if missing_fields:
        logging.error(f"Missing or empty fields: {', '.join(missing_fields)}")
        return JsonResponse({"Error": f"Missing or empty required fields: {', '.join(missing_fields)}"}, status=BAD_REQUEST_STATUS)

    # Validate column lengths and formats
    if len(data['Full_Name']) > 100:
        return JsonResponse({"Error": "Full_Name must be max 100 characters"}, status=BAD_REQUEST_STATUS)
    
    if len(data['Email']) > 100:
        return JsonResponse({"Error": "Email must be max 100 characters"}, status=BAD_REQUEST_STATUS)
    
    if len(data['Password']) > 50:
        return JsonResponse({"Error": "Password must be max 50 characters"}, status=BAD_REQUEST_STATUS)
    
    if len(data['Mobile_Number']) > 15 or not re.match(r'^\d+$', data['Mobile_Number']):
        return JsonResponse({"Error": "Mobile_Number must be digits only and max 15 characters"}, status=BAD_REQUEST_STATUS)

    # Password validation
    is_valid, error_message = validate_password(data['Password'])
    if not is_valid:
        return JsonResponse({"Error": error_message}, status=BAD_REQUEST_STATUS)

    # Handle photo upload - Upload to S3, store reference in MongoDB
    photo_url = None
    if 'Photo_upload' in data and data['Photo_upload']:
        photo_data = data['Photo_upload']
        if photo_data.startswith('data:image'):
            # Upload to S3
            photo_url = upload_to_s3(photo_data, f"super_admin_{data['Email']}.jpg")
            if not photo_url:
                logging.warning("⚠️ Failed to upload photo to S3, continuing without photo")

    # Set default values for optional fields
    optional_fields = {
        'Address': None,
        'Country': None,
        'Country_Code': '+91',
        'Timezone': 'Asia/Kolkata',
        'Languages': 'English',
        'status_code': 's',
        'status': 1,
        'Photo_upload': photo_url
    }
    for field in optional_fields:
        data[field] = data.get(field, optional_fields[field])

    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute(f"SELECT COUNT(*) FROM {TBL_SUPER_ADMIN} WHERE Email = %s AND status = 1", [data['Email']])
                if cursor.fetchone()[0] > 0:
                    return JsonResponse({"Error": "Email already exists"}, status=BAD_REQUEST_STATUS)

                insert_query = f"""
                INSERT INTO {TBL_SUPER_ADMIN} (
                    Full_Name, Mobile_Number, Email, Password, Address, Country, 
                    Country_Code, Timezone, Languages, status_code, status, Photo_upload
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                values = [
                    data['Full_Name'],
                    data['Mobile_Number'],
                    data['Email'],
                    data['Password'],
                    data['Address'],
                    data['Country'],
                    data['Country_Code'],
                    data['Timezone'],
                    data['Languages'],
                    data['status_code'],
                    data['status'],
                    data['Photo_upload'],
                ]
                cursor.execute(insert_query, values)
                cursor.execute("SELECT LAST_INSERT_ID()")
                super_admin_id = cursor.fetchone()[0]

        # ✅ Store photo reference in MongoDB
        if photo_url:
            store_photo_reference_mongodb(super_admin_id, 'super_admin', photo_url, f"super_admin_{data['Email']}.jpg")

    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse({"Message": "Super Admin registered successfully", "Super_Admin_Id": super_admin_id}, status=CREATED_STATUS)


@require_http_methods(["POST"])
@csrf_exempt
def Login_Super_Admin(request):
    create_super_admin_table()
    
    try:
        logging.debug(f"Raw request body: {request.body}")
        data = json.loads(request.body)
        logging.debug(f"Parsed JSON: {json.dumps(data, indent=2)}")
        if isinstance(data, list) and len(data) == 1:
            data = data[0]
        elif isinstance(data, list):
            return JsonResponse({"Error": "Expected a single login object, not a list"}, status=BAD_REQUEST_STATUS)
    except json.JSONDecodeError as e:
        logging.error(f"Invalid JSON: {e}")
        return JsonResponse({"Error": "Invalid JSON format"}, status=BAD_REQUEST_STATUS)

    required_fields = ['Credential', 'Password']
    missing_fields = [field for field in required_fields if field not in data or data[field] is None or (isinstance(data[field], str) and data[field].strip() == "")]
    if missing_fields:
        return JsonResponse({"Error": f"Missing or empty required fields: {', '.join(missing_fields)}"}, status=BAD_REQUEST_STATUS)

    credential = data['Credential']
    password = data['Password']

    try:
        with connection.cursor() as cursor:
            cursor.execute(f"""
                SELECT ID, Password, Full_Name
                FROM {TBL_SUPER_ADMIN}
                WHERE (Email = %s OR Mobile_Number = %s) AND status_code = 's' AND status = 1
            """, [credential, credential])
            row = cursor.fetchone()
            if row and row[1] == password:
                super_admin_id = row[0]
                full_name = row[2]
                request.session['Super_Admin_Id'] = super_admin_id
                request.session['User_Type'] = 'super_admin'
                request.session.set_expiry(86400)
                return JsonResponse({
                    "Message": "Login successful",
                    "Entity_Type": "super_admin",
                    "Id": super_admin_id,
                    "Name": full_name,
                    "Session_Timeout": 86400
                }, status=SUCCESS_STATUS)
            return JsonResponse({"Error": "Invalid credential or password, or super admin inactive"}, status=UNAUTHORIZED_STATUS)
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)


@require_http_methods(["POST"])
@csrf_exempt
def Logout_Super_Admin(request):
    try:
        request.session.flush()
        return JsonResponse({"Message": "Logout successful"}, status=SUCCESS_STATUS)
    except Exception as e:
        logging.error(f"Logout error: {e}")
        return JsonResponse({"Error": f"Logout error: {str(e)}"}, status=SERVER_ERROR_STATUS)


@require_http_methods(["POST"])
@csrf_exempt
def Forgot_Password_Super_Admin(request):
    create_super_admin_table()
    create_otp_table()
    
    try:
        data = json.loads(request.body)
        email = data.get('Email')
        
        if not email:
            return JsonResponse({"Error": "Email is required"}, status=BAD_REQUEST_STATUS)

        with connection.cursor() as cursor:
            cursor.execute(f"SELECT COUNT(*) FROM {TBL_SUPER_ADMIN} WHERE Email = %s AND status = 1", [email])
            if cursor.fetchone()[0] == 0:
                return JsonResponse({"Error": "Email not found or super admin inactive"}, status=NOT_FOUND_STATUS)

        ist_timezone = pytz.timezone('Asia/Kolkata')
        current_time = timezone.now().astimezone(ist_timezone)
        expires_at = current_time + timezone.timedelta(minutes=10)
        
        OTP = generate_OTP()
        
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM tbl_OTP_Reset WHERE email = %s", [email])
            cursor.execute("""
                INSERT INTO tbl_OTP_Reset (email, otp, expires_at)
                VALUES (%s, %s, %s)
            """, [email, OTP, expires_at])

        if not send_OTP_email(email, OTP):
            return JsonResponse({"Error": "Failed to send OTP to email"}, status=SERVER_ERROR_STATUS)

        return JsonResponse({"Message": "OTP sent to email. Please verify to reset password."}, status=SUCCESS_STATUS)
        
    except Exception as e:
        logging.error(f"Error: {e}")
        return JsonResponse({"Error": str(e)}, status=SERVER_ERROR_STATUS)


@require_http_methods(["POST"])
@csrf_exempt  
def Reset_Password_Super_Admin(request):
    create_super_admin_table()
    create_otp_table()

    try:
        data = json.loads(request.body)
        received_OTP = data.get('OTP') or data.get('otp')
        password = data.get('Password')
        email = data.get('Email')

        if not received_OTP or not email:
            return JsonResponse({"Error": "OTP and Email are required"}, status=BAD_REQUEST_STATUS)

        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT otp, expires_at FROM tbl_OTP_Reset 
                WHERE email = %s AND used = 0 
                ORDER BY created_at DESC
            """, [email])
            
            otp_record = cursor.fetchone()
            
            if not otp_record:
                return JsonResponse({"Error": "No pending OTP found. Please request again."}, status=BAD_REQUEST_STATUS)
            
            stored_otp, expires_at = otp_record
            
            ist_timezone = pytz.timezone('Asia/Kolkata')
            current_time = timezone.now().astimezone(ist_timezone)
            
            if timezone.is_naive(expires_at):
                expires_at = ist_timezone.localize(expires_at)
            elif expires_at.tzinfo != ist_timezone:
                expires_at = expires_at.astimezone(ist_timezone)
            
            if current_time > expires_at:
                cursor.execute("DELETE FROM tbl_OTP_Reset WHERE email = %s", [email])
                return JsonResponse({"Error": "OTP has expired"}, status=BAD_REQUEST_STATUS)
            
            if str(received_OTP).strip() != str(stored_otp).strip():
                return JsonResponse({"Error": "Invalid OTP"}, status=UNAUTHORIZED_STATUS)

        if password:
            is_valid, error_message = validate_password(password)
            if not is_valid:
                return JsonResponse({"Error": error_message}, status=BAD_REQUEST_STATUS)

            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(f"""
                        UPDATE {TBL_SUPER_ADMIN}
                        SET Password = %s
                        WHERE Email = %s AND status = 1
                    """, [password, email])
                    
                    if cursor.rowcount == 0:
                        return JsonResponse({"Error": "Super Admin not found or inactive"}, status=NOT_FOUND_STATUS)
                    
                    cursor.execute("UPDATE tbl_OTP_Reset SET used = 1 WHERE email = %s", [email])

            return JsonResponse({"Message": "Password reset successfully"}, status=SUCCESS_STATUS)
        else:
            return JsonResponse({"Message": "OTP verified successfully"}, status=SUCCESS_STATUS)

    except Exception as e:
        logging.error(f"Error: {e}")
        return JsonResponse({"Error": str(e)}, status=SERVER_ERROR_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def List_All_Super_Admins(request):
    create_super_admin_table()

    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT ID, Full_Name, Mobile_Number, Email, Address, Country, 
                   Country_Code, Timezone, Languages, status_code, status, Photo_upload
            FROM {TBL_SUPER_ADMIN}
            WHERE status = 1
            """
            cursor.execute(select_query)
            rows = cursor.fetchall()
            super_admins = []
            
            for row in rows:
                admin_dict = dict(zip([
                    'ID', 'Full_Name', 'Mobile_Number', 'Email', 'Address', 'Country',
                    'Country_Code', 'Timezone', 'Languages', 'status_code', 'status', 'Photo_upload'
                ], row))
                
                # ✅ Get photo from MongoDB if not in MySQL
                if not admin_dict.get('Photo_upload'):
                    mongo_photo = get_photo_url_from_mongodb(admin_dict['ID'], 'super_admin')
                    if mongo_photo:
                        admin_dict['Photo_upload'] = mongo_photo
                
                super_admins.append(admin_dict)
                
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse(super_admins, safe=False, status=SUCCESS_STATUS)


@require_http_methods(["GET"])
@csrf_exempt
def Get_Super_Admin(request, id):
    """Get single Super Admin by ID - ✅ FIXED to fetch photo from MongoDB"""
    create_super_admin_table()

    try:
        with connection.cursor() as cursor:
            select_query = f"""
            SELECT ID, Full_Name, Mobile_Number, Email, Address, Country,
                   Country_Code, Timezone, Languages, status_code, status, Photo_upload
            FROM {TBL_SUPER_ADMIN}
            WHERE ID = %s AND status = 1
            """
            cursor.execute(select_query, [id])
            row = cursor.fetchone()
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    if row:
        super_admin = dict(zip([
            'ID', 'Full_Name', 'Mobile_Number', 'Email', 'Address', 'Country',
            'Country_Code', 'Timezone', 'Languages', 'status_code', 'status', 'Photo_upload'
        ], row))
        
        # ✅ IMPORTANT: Get photo from MongoDB if not in MySQL
        mysql_photo = super_admin.get('Photo_upload')
        if not mysql_photo or mysql_photo == 'null' or mysql_photo == '':
            mongo_photo = get_photo_url_from_mongodb(id, 'super_admin')
            if mongo_photo:
                super_admin['Photo_upload'] = mongo_photo
                logging.debug(f"✅ Photo retrieved from MongoDB: {mongo_photo}")
        
        logging.debug(f"✅ Returning super admin data with photo: {super_admin.get('Photo_upload')}")
        return JsonResponse(super_admin, status=SUCCESS_STATUS)
    
    return JsonResponse({"Error": "Super Admin not found"}, status=NOT_FOUND_STATUS)

@require_http_methods(["PUT"])
@csrf_exempt
def Update_Super_Admin(request, id):
    """
    ✅ FIXED: Update Super Admin - uploads photo to S3, stores reference in MongoDB
    Works with existing table schema (no new columns needed)
    """
    create_super_admin_table()

    try:
        logging.debug(f"📥 Update request for Super Admin ID: {id}")
        logging.debug(f"📥 Request body length: {len(request.body)} bytes")
        
        data = json.loads(request.body)
        
        if isinstance(data, list) and len(data) == 1:
            data = data[0]
            
    except json.JSONDecodeError as e:
        logging.error(f"Invalid JSON: {e}")
        return JsonResponse({"Error": "Invalid JSON format"}, status=BAD_REQUEST_STATUS)

    # Required fields validation
    required_fields = ['Full_Name', 'Mobile_Number', 'Email']
    missing_fields = [f for f in required_fields if not data.get(f) or (isinstance(data.get(f), str) and not data.get(f).strip())]
    if missing_fields:
        return JsonResponse({"Error": f"Missing required fields: {', '.join(missing_fields)}"}, status=BAD_REQUEST_STATUS)

    # Validate lengths
    if len(data['Full_Name']) > 100:
        return JsonResponse({"Error": "Full_Name must be max 100 characters"}, status=BAD_REQUEST_STATUS)
    if len(data['Email']) > 100:
        return JsonResponse({"Error": "Email must be max 100 characters"}, status=BAD_REQUEST_STATUS)
    if len(data['Mobile_Number']) > 15 or not re.match(r'^\d+$', data['Mobile_Number']):
        return JsonResponse({"Error": "Mobile_Number must be digits only, max 15"}, status=BAD_REQUEST_STATUS)

    # Password validation (optional)
    password = data.get('Password')
    if password:
        is_valid, error_message = validate_password(password)
        if not is_valid:
            return JsonResponse({"Error": error_message}, status=BAD_REQUEST_STATUS)

    # ✅ PHOTO HANDLING - Upload to S3, store reference in MongoDB
    photo_url = None
    s3_upload_attempted = False
    photo_data = data.get('Photo_upload') or data.get('Photo_Upload') or data.get('photo_upload')
    
    if photo_data:
        logging.debug(f"📸 Photo data received, length: {len(str(photo_data))} chars")
        
        if isinstance(photo_data, str) and photo_data.startswith('data:image'):
            # ✅ New base64 photo - upload to S3
            s3_upload_attempted = True
            logging.debug("📸 New base64 image detected, uploading to S3...")
            
            # ✅ Debug: Check AWS credentials before upload
            logging.debug(f"📸 AWS_ACCESS_KEY_ID present: {bool(AWS_ACCESS_KEY_ID)}")
            logging.debug(f"📸 AWS_SECRET_ACCESS_KEY present: {bool(AWS_SECRET_ACCESS_KEY)}")
            logging.debug(f"📸 AWS_S3_BUCKET: {AWS_S3_BUCKET}")
            
            photo_url = upload_to_s3(photo_data, f"super_admin_{id}.jpg")
            
            if photo_url and photo_url.startswith('http'):
                logging.debug(f"✅ S3 upload successful: {photo_url}")
                # ✅ Store reference in MongoDB
                store_photo_reference_mongodb(id, 'super_admin', photo_url, f"super_admin_{id}.jpg")
            else:
                # ✅ FIXED: S3 upload failed - log error, don't save base64
                logging.error("❌ S3 upload failed! Photo will not be saved. Check AWS credentials.")
                photo_url = None  # Reset to None - don't use base64
                
        elif isinstance(photo_data, str) and photo_data.startswith('http'):
            # Existing S3 URL - keep it
            photo_url = photo_data
            logging.debug(f"📸 Keeping existing S3 URL: {photo_url}")

    # Get current photo from database/MongoDB if no new photo was successfully uploaded
    current_photo = None
    try:
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT Photo_upload FROM {TBL_SUPER_ADMIN} WHERE ID = %s", [id])
            row = cursor.fetchone()
            if row and row[0]:
                # ✅ FIXED: Only use if it's an S3 URL, not base64
                if row[0].startswith('http'):
                    current_photo = row[0]
                    logging.debug(f"📸 Found existing S3 URL in MySQL: {current_photo}")
        
        # ✅ Also check MongoDB if no valid photo in MySQL
        if not current_photo:
            mongo_photo = get_photo_url_from_mongodb(id, 'super_admin')
            if mongo_photo and mongo_photo.startswith('http'):
                current_photo = mongo_photo
                logging.debug(f"📸 Found existing S3 URL in MongoDB: {current_photo}")
            
    except Exception as e:
        logging.warning(f"Could not fetch current photo: {e}")

    # ✅ FIXED: Determine final photo URL - only S3 URLs allowed, never base64
    if photo_url and photo_url.startswith('http'):
        # New S3 upload succeeded
        final_photo_url = photo_url
    elif current_photo and current_photo.startswith('http'):
        # Keep existing S3 URL
        final_photo_url = current_photo
    else:
        # No valid photo
        final_photo_url = None
    
    # ✅ Extra safety check: Never save base64 to database
    if final_photo_url and final_photo_url.startswith('data:'):
        logging.warning("⚠️ Blocking base64 from being saved to database")
        final_photo_url = None
    
    logging.debug(f"📸 Final photo URL to save: {final_photo_url}")

    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                # Check email uniqueness
                cursor.execute(f"SELECT COUNT(*) FROM {TBL_SUPER_ADMIN} WHERE Email = %s AND ID != %s AND status = 1", 
                             [data['Email'], id])
                if cursor.fetchone()[0] > 0:
                    return JsonResponse({"Error": "Email already exists"}, status=BAD_REQUEST_STATUS)
                
                # ✅ Update query - only columns that exist in your table
                update_query = f"""
                UPDATE {TBL_SUPER_ADMIN}
                SET Full_Name = %s,
                    Mobile_Number = %s,
                    Email = %s,
                    Password = COALESCE(NULLIF(%s, ''), Password),
                    Address = %s,
                    Country = %s,
                    Photo_upload = %s
                WHERE ID = %s AND status = 1
                """
                values = [
                    data['Full_Name'],
                    data['Mobile_Number'],
                    data['Email'],
                    data.get('Password', ''),
                    data.get('Address'),
                    data.get('Country'),
                    final_photo_url,
                    id
                ]
                
                cursor.execute(update_query, values)
                
                if cursor.rowcount == 0:
                    return JsonResponse({"Error": "Super Admin not found"}, status=NOT_FOUND_STATUS)

                logging.debug(f"✅ Super Admin {id} updated in MySQL")

    except Exception as e:
        logging.error(f"Database error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    # ✅ Build response
    response_data = {
        "Message": "Super Admin updated successfully",
        "Photo_upload": final_photo_url,
        "photo_upload": final_photo_url,
        "ID": id
    }
    
    # ✅ Add warning if S3 upload was attempted but failed
    if s3_upload_attempted and not (photo_url and photo_url.startswith('http')):
        response_data["Warning"] = "Photo upload to S3 failed. Check AWS credentials in .env file."
        logging.warning("⚠️ Returning response with S3 upload failure warning")
    
    logging.debug(f"✅ Update response: {response_data}")
    
    return JsonResponse(response_data, status=SUCCESS_STATUS)

@require_http_methods(["DELETE"])
@csrf_exempt
def Delete_Super_Admin(request, id):
    create_super_admin_table()

    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                select_query = f"SELECT Full_Name FROM {TBL_SUPER_ADMIN} WHERE ID = %s AND status = 1"
                cursor.execute(select_query, [id])
                row = cursor.fetchone()
                if not row:
                    return JsonResponse({"Error": "Super Admin not found or inactive"}, status=NOT_FOUND_STATUS)

                # Soft delete
                delete_action = f"UPDATE {TBL_SUPER_ADMIN} SET status = 0 WHERE ID = %s AND status = 1"
                cursor.execute(delete_action, [id])
                
                if cursor.rowcount == 0:
                    return JsonResponse({"Error": "Super Admin not found or inactive"}, status=NOT_FOUND_STATUS)

        # ✅ Also soft delete photo reference in MongoDB
        delete_photo_reference_mongodb(id, 'super_admin')

    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Database error: {e}")
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse({"Message": f"Super Admin ID {id} deleted successfully"}, status=SUCCESS_STATUS)


@require_http_methods(["POST"])
@csrf_exempt
def Add_Super_Admin(request):
    """Add new Super Admin - same as Register but for admin use"""
    return Register_Super_Admin(request)


@require_http_methods(["POST"])
@csrf_exempt
def Validate_Super_Admin_Data(request):
    create_super_admin_table()

    try:
        data = json.loads(request.body)
        if isinstance(data, list) and len(data) == 1:
            data = data[0]
        elif isinstance(data, list):
            return JsonResponse({"Error": "Expected a single validation object, not a list"}, status=BAD_REQUEST_STATUS)
    except json.JSONDecodeError as e:
        return JsonResponse({"Error": "Invalid JSON format"}, status=BAD_REQUEST_STATUS)

    validation_results = {
        "Email": {"is_valid": True, "message": ""},
        "Password": {"is_valid": True, "message": ""}
    }

    user_exists = False
    if 'Email' in data and data['Email']:
        if len(data['Email']) > 100:
            validation_results["Email"] = {"is_valid": False, "message": "Email must be max 100 characters"}
        else:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(f"SELECT COUNT(*) FROM {TBL_SUPER_ADMIN} WHERE Email = %s AND status = 1", [data['Email']])
                    if cursor.fetchone()[0] > 0:
                        user_exists = True
                        validation_results["Email"] = {"is_valid": False, "message": "Email already exists"}
                    else:
                        validation_results["Email"] = {"is_valid": True, "message": "Email available"}
            except (ProgrammingError, OperationalError) as e:
                return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    if data.get('Password'):
        is_valid_format, format_error_message = validate_password(data['Password'])
        if not is_valid_format:
            validation_results["Password"] = {"is_valid": False, "message": format_error_message}
        elif len(data['Password']) > 50:
            validation_results["Password"] = {"is_valid": False, "message": "Password must be max 50 characters"}
        else:
            if user_exists:
                try:
                    with connection.cursor() as cursor:
                        cursor.execute(f"SELECT Password FROM {TBL_SUPER_ADMIN} WHERE Email = %s AND status = 1", [data['Email']])
                        user_record = cursor.fetchone()
                        if user_record:
                            stored_password = user_record[0]
                            if data['Password'] == stored_password:
                                validation_results["Password"] = {"is_valid": True, "message": "Password matches"}
                            else:
                                validation_results["Password"] = {"is_valid": False, "message": "Password doesn't match"}
                except (ProgrammingError, OperationalError) as e:
                    return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)
            else:
                validation_results["Password"] = {"is_valid": True, "message": "Password format valid"}

    return JsonResponse(validation_results, status=SUCCESS_STATUS)


# URL patterns
urlpatterns = [
    path('api/auth/super_admin/register', Register_Super_Admin, name='Register_Super_Admin'),
    path('api/auth/super_admin/login', Login_Super_Admin, name='Login_Super_Admin'),
    path('api/super_admin/logout', Logout_Super_Admin, name='Logout_Super_Admin'),
    path('api/auth/super_admin/forgot-password', Forgot_Password_Super_Admin, name='Forgot_Password_Super_Admin'),
    path('api/auth/super_admin/reset-password', Reset_Password_Super_Admin, name='Reset_Password_Super_Admin'),
    path('api/super_admin/add', Add_Super_Admin, name='Add_Super_Admin'),
    path('api/super_admin/lists', List_All_Super_Admins, name='List_All_Super_Admins'),
    path('api/super_admin/list/<int:id>', Get_Super_Admin, name='Get_Super_Admin'),
    path('api/super_admin/update/<int:id>', Update_Super_Admin, name='Update_Super_Admin'),
    path('api/super_admin/remove/<int:id>', Delete_Super_Admin, name='Delete_Super_Admin'),
    path('api/super_admin/validate', Validate_Super_Admin_Data, name='Validate_Super_Admin_Data'),
]