
"""
Login History Module for User Session Tracking
==============================================
File: login_history.py
Description: Tracks user login sessions with device info, IP, location (GPS support added)
"""
from django.db import connection, transaction
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.db import models
from django.utils import timezone
import json
import logging
import re
import os
from datetime import datetime, timedelta

# Try to import user-agents library
try:
    from user_agents import parse as parse_user_agent
    USER_AGENTS_AVAILABLE = True
except ImportError:
    USER_AGENTS_AVAILABLE = False
    logging.warning("⚠ user-agents library not installed. Run: pip install user-agents --break-system-packages")

# Try to import requests for IP geolocation
try:
    import requests as http_requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    logging.warning("⚠ requests library not installed for IP geolocation")

# Logger setup
logger = logging.getLogger("login_history")
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s %(message)s'
)

# ============================================================================
# CONFIGURATION
# ============================================================================

IP_GEOLOCATION_ENABLED = os.getenv("IP_GEOLOCATION_ENABLED", "true").lower() == "true"
IP_API_TIMEOUT = int(os.getenv("IP_API_TIMEOUT", 3))
SESSION_EXPIRY_HOURS = int(os.getenv("SESSION_EXPIRY_HOURS", 24))


class UserLoginHistory(models.Model):
    ID = models.AutoField(primary_key=True)
    User_ID = models.ForeignKey(
        'core.User', on_delete=models.CASCADE, db_column='User_ID',
        related_name='login_history'
    )
    Device_Info = models.CharField(max_length=255)
    Device_Type = models.CharField(max_length=10, default='Desktop')
    Login_Time = models.DateTimeField(default=timezone.now)
    IP_Address = models.CharField(max_length=45)
    MAC_Address = models.CharField(max_length=20, blank=True, null=True)
    Location = models.CharField(max_length=255, blank=True, null=True)
    Latitude = models.DecimalField(max_digits=10, decimal_places=8, blank=True, null=True)
    Longitude = models.DecimalField(max_digits=11, decimal_places=8, blank=True, null=True)
    Location_Accuracy = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    Location_Source = models.CharField(max_length=50, default='unknown')
    Session_ID = models.CharField(max_length=100, blank=True, null=True)
    Login_Method = models.CharField(max_length=20, default='password')
    Status_field = models.CharField(max_length=10, default='active', db_column='Status')
    Logout_Time = models.DateTimeField(blank=True, null=True)
    Created_At = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'tbl_User_Login_History'
        app_label = 'core'


def create_login_history_table():
    """Create tbl_User_Login_History table with all required columns and indexes"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tbl_User_Login_History (
                    ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    User_ID INT NOT NULL,
                    Device_Info VARCHAR(255) NOT NULL,
                    Device_Type ENUM('Desktop','Mobile') NOT NULL DEFAULT 'Desktop',
                    Login_Time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    IP_Address VARCHAR(45) NOT NULL,
                    MAC_Address VARCHAR(20) DEFAULT NULL,
                    Location VARCHAR(255) DEFAULT NULL,
                    Latitude DECIMAL(10,8) DEFAULT NULL,
                    Longitude DECIMAL(11,8) DEFAULT NULL,
                    Location_Accuracy DECIMAL(10,2) DEFAULT NULL,
                    Location_Source VARCHAR(50) DEFAULT 'unknown',
                    Session_ID VARCHAR(100) DEFAULT NULL,
                    Login_Method ENUM('password','face_recognition','token','auto') DEFAULT 'password',
                    Status ENUM('active','logged_out','expired') DEFAULT 'active',
                    Logout_Time DATETIME DEFAULT NULL,
                    Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
                    KEY idx_user_login (User_ID, Login_Time),
                    KEY idx_login_time (Login_Time),
                    KEY idx_status (Status),
                    KEY idx_ip_address (IP_Address),
                    CONSTRAINT FK_LoginHistory_User FOREIGN KEY (User_ID) REFERENCES tbl_Users (ID) ON DELETE CASCADE ON UPDATE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """)
            logging.debug("tbl_User_Login_History table created successfully")
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Failed to create tbl_User_Login_History table: {e}")

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_client_ip(request):
    """Extract real client IP address from request"""
    ip_headers = [
        'HTTP_X_FORWARDED_FOR',
        'HTTP_X_REAL_IP',
        'HTTP_CF_CONNECTING_IP',
        'HTTP_X_CLUSTER_CLIENT_IP',
        'REMOTE_ADDR'
    ]
    
    for header in ip_headers:
        ip = request.META.get(header)
        if ip:
            if ',' in ip:
                ip = ip.split(',')[0].strip()
            return ip
    
    return '0.0.0.0'

def is_private_ip(ip_address):
    """Check if IP is private/local"""
    if not ip_address:
        return True
    
    private_exact = ['127.0.0.1', 'localhost', '0.0.0.0', '::1', '']
    private_prefixes = [
        '192.168.', '10.', 
        '172.16.', '172.17.', '172.18.', '172.19.',
        '172.20.', '172.21.', '172.22.', '172.23.', 
        '172.24.', '172.25.', '172.26.', '172.27.', 
        '172.28.', '172.29.', '172.30.', '172.31.',
        '169.254.',  # Link-local
    ]
    
    if ip_address in private_exact:
        return True
    
    for prefix in private_prefixes:
        if ip_address.startswith(prefix):
            return True
    
    return False


def get_public_ip_from_external_service():
    """Get public IP when on private network - works for both Desktop & Mobile"""
    if not REQUESTS_AVAILABLE:
        logger.warning("📍 requests library not available")
        return None
    
    services = [
        ('https://api.ipify.org?format=json', 'ip'),
        ('https://ipinfo.io/json', 'ip'),
        ('https://api.myip.com', 'ip'),
    ]
    
    for url, key in services:
        try:
            response = http_requests.get(url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                public_ip = data.get(key)
                if public_ip:
                    logger.info(f"✅ Public IP from {url}: {public_ip}")
                    return public_ip
        except Exception as e:
            logger.debug(f"📍 Failed to get IP from {url}: {e}")
            continue
    
    logger.warning("📍 Could not get public IP from any service")
    return None


def parse_device_info(request):
    """Parse User-Agent header to extract device information"""
    user_agent_string = request.META.get('HTTP_USER_AGENT', 'Unknown')
    
    if USER_AGENTS_AVAILABLE:
        try:
            user_agent = parse_user_agent(user_agent_string)
            
            browser = user_agent.browser.family
            browser_version = user_agent.browser.version_string
            if browser_version:
                browser = f"{browser} {browser_version}"
            
            os_info = user_agent.os.family
            os_version = user_agent.os.version_string
            if os_version:
                os_info = f"{os_info} {os_version}"
            
            device_info = f"{browser} on {os_info}"
            
            if user_agent.is_mobile or user_agent.is_tablet:
                device_type = 'Mobile'
            else:
                device_type = 'Desktop'
            
            return device_info.strip()[:255], device_type
            
        except Exception as e:
            logger.warning(f"Error parsing user agent: {e}")
    
    return _manual_parse_user_agent(user_agent_string)

def _manual_parse_user_agent(user_agent_string):
    """
    Fallback manual parsing of User-Agent string
    """
    ua_lower = user_agent_string.lower()
    
    # Detect device type
    mobile_keywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone']
    device_type = 'Mobile' if any(kw in ua_lower for kw in mobile_keywords) else 'Desktop'
    
    # Try to extract browser and OS
    device_info = user_agent_string
    
    # Common browser patterns
    browser_patterns = [
        (r'Chrome/(\d+\.?\d*)', 'Chrome'),
        (r'Firefox/(\d+\.?\d*)', 'Firefox'),
        (r'Safari/(\d+\.?\d*)', 'Safari'),
        (r'Edge/(\d+\.?\d*)', 'Edge'),
        (r'MSIE (\d+\.?\d*)', 'Internet Explorer'),
        (r'Opera/(\d+\.?\d*)', 'Opera'),
    ]
    
    browser = 'Unknown Browser'
    for pattern, name in browser_patterns:
        match = re.search(pattern, user_agent_string)
        if match:
            browser = f"{name} {match.group(1)}"
            break
    
    # Common OS patterns
    os_patterns = [
        (r'Windows NT 10\.0', 'Windows 10'),
        (r'Windows NT 11\.0', 'Windows 11'),
        (r'Windows NT 6\.3', 'Windows 8.1'),
        (r'Windows NT 6\.2', 'Windows 8'),
        (r'Windows NT 6\.1', 'Windows 7'),
        (r'Mac OS X (\d+[._]\d+)', 'macOS'),
        (r'Android (\d+\.?\d*)', 'Android'),
        (r'iPhone OS (\d+[._]\d+)', 'iOS'),
        (r'iPad.*OS (\d+[._]\d+)', 'iPadOS'),
        (r'Linux', 'Linux'),
        (r'Ubuntu', 'Ubuntu'),
    ]
    
    os_name = 'Unknown OS'
    for pattern, name in os_patterns:
        match = re.search(pattern, user_agent_string)
        if match:
            if match.groups():
                version = match.group(1).replace('_', '.')
                os_name = f"{name} {version}"
            else:
                os_name = name
            break
    
    device_info = f"{browser} on {os_name}"
    return device_info[:255], device_type


def get_location_from_ip(ip_address):
    """
    Get location from IP address
    Works for: Desktop, Mobile on WiFi, Mobile on Mobile Data
    
    Flow:
    1. Check if IP is private (192.168.x.x)
    2. If private → get public IP from external service
    3. Geolocate the public IP
    """
    if not IP_GEOLOCATION_ENABLED or not REQUESTS_AVAILABLE:
        logger.info("📍 IP geolocation disabled or requests not available")
        return None
    
    original_ip = ip_address
    
    try:
        # Check if private IP - need to get public IP first
        if is_private_ip(ip_address):
            logger.info(f"📍 Private IP detected: {ip_address}")
            logger.info(f"📍 Fetching public IP from external service...")
            
            public_ip = get_public_ip_from_external_service()
            
            if public_ip and not is_private_ip(public_ip):
                logger.info(f"✅ Using public IP: {public_ip}")
                ip_address = public_ip
            else:
                logger.warning(f"⚠️ Could not get public IP, returning None")
                return None
        
        # Geolocate the IP
        logger.info(f"📍 Geolocating IP: {ip_address}")
        
        response = http_requests.get(
            f"http://ip-api.com/json/{ip_address}",
            params={'fields': 'status,message,city,regionName,country'},
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'success':
                city = data.get('city', '')
                region = data.get('regionName', '')
                country = data.get('country', '')
                
                parts = [p for p in [city, region, country] if p]
                location = ', '.join(parts) if parts else None
                
                if location:
                    logger.info(f"✅ IP Geolocation result: {location}")
                    return location
        
        logger.warning(f"⚠️ IP geolocation failed for: {ip_address}")
        return None
        
    except Exception as e:
        logger.error(f"❌ IP geolocation error: {e}")
        return None

def get_address_from_coordinates(latitude, longitude):
    """
    Reverse geocode: Convert GPS coordinates to exact street-level address
    Works for: Desktop with GPS, Mobile with GPS
    
    Returns: "KPHB Colony, Kukatpally, Hyderabad, Telangana" or None
    """
    if latitude is None or longitude is None:
        logger.warning("📍 No coordinates provided")
        return None
    
    if not REQUESTS_AVAILABLE:
        logger.warning("📍 requests library not available")
        return None
    
    try:
        logger.info(f"📍 Reverse geocoding: ({latitude}, {longitude})")
        
        response = http_requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={
                'lat': latitude,
                'lon': longitude,
                'format': 'json',
                'addressdetails': 1,
                'zoom': 18
            },
            headers={
                'User-Agent': 'ConnectlyApp/1.0 (admin@connectly.com)'
            },
            timeout=10
        )
        
        logger.info(f"📍 Nominatim status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            address = data.get('address', {})
            
            if not address:
                # Use display_name as fallback
                display_name = data.get('display_name', '')
                if display_name:
                    short = display_name[:150]
                    logger.info(f"✅ Using display_name: {short}")
                    return short
                return None
            
            logger.info(f"📍 Address data: {address}")
            
            # Build address from components
            parts = []
            
            # Road
            if address.get('road'):
                parts.append(address['road'])
            
            # Neighbourhood/Area
            for key in ['neighbourhood', 'suburb', 'quarter', 'residential', 'hamlet']:
                if address.get(key) and address[key] not in parts:
                    parts.append(address[key])
                    break
            
            # Locality/Town
            for key in ['village', 'town', 'locality', 'city_district', 'district']:
                if address.get(key) and address[key] not in parts:
                    parts.append(address[key])
                    break
            
            # City
            if address.get('city') and address['city'] not in parts:
                parts.append(address['city'])
            
            # State
            if address.get('state') and address['state'] not in parts:
                parts.append(address['state'])
            
            if parts:
                location = ', '.join(parts)
                logger.info(f"✅ Built address: {location}")
                return location
            
            # Fallback to display_name
            display_name = data.get('display_name', '')
            if display_name:
                short = display_name[:150]
                logger.info(f"✅ Using display_name: {short}")
                return short
        
        logger.warning(f"⚠️ Nominatim returned no data")
        return None
        
    except http_requests.exceptions.Timeout:
        logger.warning("⚠️ Nominatim timeout")
        return None
    except Exception as e:
        logger.error(f"❌ Reverse geocoding error: {e}")
        return None


def record_login_history(user_id, request, login_method='password', mac_address=None,
                         latitude=None, longitude=None, location_address=None,
                         location_accuracy=None, location_source='unknown'):
    """
    Record user login in history table with location data
    
    Works for:
    - Desktop with GPS → Exact address (KPHB Colony, Hyderabad)
    - Desktop without GPS → City from IP (Hyderabad, Telangana, India)
    - Mobile with GPS → Exact address (KPHB Colony, Hyderabad)
    - Mobile without GPS on WiFi → City from public IP
    - Mobile on Mobile Data → City from carrier IP
    """
    logger.info("")
    logger.info("=" * 70)
    logger.info(f"📝 RECORD_LOGIN_HISTORY CALLED for user_id: {user_id}")
    logger.info("=" * 70)
    
    create_login_history_table()
    
    try:
        # =====================================================================
        # STEP 1: Get basic info
        # =====================================================================
        ip_address = get_client_ip(request)
        logger.info(f"📍 Client IP: {ip_address}")
        
        device_info, device_type = parse_device_info(request)
        logger.info(f"📱 Device: {device_info} ({device_type})")
        
        session_id = request.session.session_key if hasattr(request, 'session') else None
        logger.info(f"🔑 Session ID: {session_id}")
        
        # =====================================================================
        # STEP 2: Get IP-based location (fallback for when GPS not available)
        # =====================================================================
        ip_location = None
        try:
            ip_location = get_location_from_ip(ip_address)
            logger.info(f"📍 IP Location result: {ip_location}")
        except Exception as e:
            logger.warning(f"⚠️ IP location lookup failed: {e}")
            ip_location = None
        
        # =====================================================================
        # STEP 3: Process GPS coordinates if provided
        # =====================================================================
        if latitude is not None:
            try:
                latitude = float(latitude)
            except (ValueError, TypeError):
                latitude = None
        
        if longitude is not None:
            try:
                longitude = float(longitude)
            except (ValueError, TypeError):
                longitude = None
        
        if location_accuracy is not None:
            try:
                location_accuracy = float(location_accuracy)
            except (ValueError, TypeError):
                location_accuracy = None
        
        # =====================================================================
        # STEP 4: Determine final location string (Priority Order)
        # =====================================================================
        location = None
        
        # Priority 1: Client provided address directly
        if location_address:
            location = location_address
            logger.info(f"📍 Using client-provided address: {location}")
        
        # Priority 2: GPS coordinates → Reverse geocode to get exact address
        elif latitude is not None and longitude is not None:
            logger.info(f"📍 GPS coordinates received: ({latitude}, {longitude})")
            try:
                location = get_address_from_coordinates(latitude, longitude)
                if location:
                    logger.info(f"✅ Reverse geocoding SUCCESS: {location}")
                else:
                    # Reverse geocoding failed - try IP location
                    logger.warning("⚠️ Reverse geocoding returned None")
                    if ip_location:
                        location = ip_location
                        logger.info(f"📍 Using IP fallback: {location}")
                    else:
                        # Last resort - show GPS coordinates
                        location = f"GPS: {latitude:.6f}, {longitude:.6f}"
                        logger.info(f"📍 Using raw coordinates: {location}")
            except Exception as e:
                logger.error(f"❌ Reverse geocoding exception: {e}")
                # Fallback to IP or coordinates
                if ip_location:
                    location = ip_location
                else:
                    location = f"GPS: {latitude:.6f}, {longitude:.6f}"
        
        # Priority 3: No GPS → Use IP-based location
        else:
            logger.info("📍 No GPS coordinates, using IP-based location")
            if ip_location:
                location = ip_location
                logger.info(f"📍 IP-based location: {location}")
            else:
                location = "Unknown"
                logger.warning("⚠️ No location available")
        
        # =====================================================================
        # STEP 5: Determine location source
        # =====================================================================
        if not location_source or location_source == 'unknown':
            if latitude is not None and longitude is not None:
                location_source = 'browser_gps'
            elif ip_location:
                location_source = 'ip_geolocation'
            else:
                location_source = 'unknown'
        
        # =====================================================================
        # STEP 6: Log final values
        # =====================================================================
        logger.info(f"📍 FINAL VALUES:")
        logger.info(f"   - user_id: {user_id}")
        logger.info(f"   - device_info: {device_info}")
        logger.info(f"   - device_type: {device_type}")
        logger.info(f"   - ip_address: {ip_address}")
        logger.info(f"   - location: {location}")
        logger.info(f"   - latitude: {latitude}")
        logger.info(f"   - longitude: {longitude}")
        logger.info(f"   - location_accuracy: {location_accuracy}")
        logger.info(f"   - location_source: {location_source}")
        
        # =====================================================================
        # STEP 7: Insert into database
        # =====================================================================
        cursor = connection.cursor()
        try:
            cursor.execute("""
                INSERT INTO tbl_User_Login_History 
                (User_ID, Device_Info, Device_Type, Login_Time, IP_Address, 
                 MAC_Address, Location, Latitude, Longitude, Location_Accuracy,
                 Location_Source, Session_ID, Login_Method, Status)
                VALUES (%s, %s, %s, NOW(), %s, %s, %s, %s, %s, %s, %s, %s, %s, 'active')
            """, [
                user_id,
                device_info,
                device_type,
                ip_address,
                mac_address,
                location,
                latitude,
                longitude,
                location_accuracy,
                location_source,
                session_id,
                login_method
            ])
            
            connection.commit()
            logger.info("✅ INSERT COMMITTED!")
            
            cursor.execute("SELECT LAST_INSERT_ID()")
            history_id = cursor.fetchone()[0]
            
            logger.info("")
            logger.info("=" * 70)
            logger.info(f"✅ LOGIN RECORDED SUCCESSFULLY!")
            logger.info(f"   History ID: {history_id}")
            logger.info(f"   User: {user_id} | {device_type} | {ip_address} | {location}")
            logger.info("=" * 70)
            logger.info("")
            
            return history_id
            
        finally:
            cursor.close()
            
    except Exception as e:
        logger.error("")
        logger.error("=" * 70)
        logger.error(f"❌ ERROR recording login history for user {user_id}")
        logger.error(f"   Error: {e}")
        logger.error("=" * 70)
        import traceback
        logger.error(traceback.format_exc())
        
        try:
            connection.rollback()
        except:
            pass
            
        return None


def record_logout(user_id, session_id=None):
    """
    Mark login session as logged out.
    
    THIS IS THE FIXED VERSION that properly:
    1. Finds the active session
    2. Updates Status to 'logged_out'
    3. Commits the transaction
    4. Verifies the update worked
    """
    logger.info("")
    logger.info("=" * 70)
    logger.info("📝 RECORD_LOGOUT FUNCTION CALLED")
    logger.info(f"   User_ID: {user_id}")
    logger.info(f"   Session_ID: {session_id}")
    logger.info("=" * 70)
    
    if not user_id:
        logger.error("❌ record_logout: user_id is None or empty!")
        return False
    
    # Convert to int if string
    try:
        user_id = int(user_id)
    except (ValueError, TypeError) as e:
        logger.error(f"❌ record_logout: Invalid user_id: {user_id}, Error: {e}")
        return False
    
    cursor = None
    try:
        cursor = connection.cursor()
        
        # =====================================================================
        # STEP 1: Check current sessions for this user (for debugging)
        # =====================================================================
        cursor.execute("""
            SELECT ID, Status, Session_ID, Login_Time 
            FROM tbl_User_Login_History 
            WHERE User_ID = %s 
            ORDER BY Login_Time DESC 
            LIMIT 5
        """, [user_id])
        
        sessions = cursor.fetchall()
        logger.info(f"📊 Found {len(sessions)} recent sessions for user {user_id}:")
        for s in sessions:
            logger.info(f"   - ID: {s[0]}, Status: '{s[1]}', Session: {s[2]}, Login: {s[3]}")
        
        # =====================================================================
        # STEP 2: Find the record ID to update
        # =====================================================================
        record_id_to_update = None
        
        # First try: Find by session_id if provided
        if session_id:
            logger.info(f"🔍 Looking for active session with Session_ID: {session_id}")
            cursor.execute("""
                SELECT ID FROM tbl_User_Login_History 
                WHERE User_ID = %s AND Session_ID = %s AND Status = 'active'
                LIMIT 1
            """, [user_id, session_id])
            result = cursor.fetchone()
            if result:
                record_id_to_update = result[0]
                logger.info(f"✓ Found by Session_ID: Record ID {record_id_to_update}")
        
        # Second try: Find most recent active session
        if not record_id_to_update:
            logger.info(f"🔍 Looking for most recent active session for user {user_id}")
            cursor.execute("""
                SELECT ID FROM tbl_User_Login_History 
                WHERE User_ID = %s AND Status = 'active'
                ORDER BY Login_Time DESC 
                LIMIT 1
            """, [user_id])
            result = cursor.fetchone()
            if result:
                record_id_to_update = result[0]
                logger.info(f"✓ Found most recent active: Record ID {record_id_to_update}")
        
        # =====================================================================
        # STEP 3: Update the record
        # =====================================================================
        if record_id_to_update:
            logger.info(f"")
            logger.info(f"🔄 UPDATING Record ID {record_id_to_update}...")
            logger.info(f"   Setting Status = 'logged_out'")
            logger.info(f"   Setting Logout_Time = NOW()")
            
            cursor.execute("""
                UPDATE tbl_User_Login_History 
                SET Status = 'logged_out', Logout_Time = NOW()
                WHERE ID = %s
            """, [record_id_to_update])
            
            rows_affected = cursor.rowcount
            logger.info(f"   Rows affected by UPDATE: {rows_affected}")
            
            # =====================================================================
            # STEP 4: COMMIT THE TRANSACTION - THIS IS CRITICAL!
            # =====================================================================
            connection.commit()
            logger.info(f"✅ TRANSACTION COMMITTED!")
            
            # =====================================================================
            # STEP 5: Verify the update actually worked
            # =====================================================================
            cursor.execute("""
                SELECT ID, Status, Logout_Time 
                FROM tbl_User_Login_History 
                WHERE ID = %s
            """, [record_id_to_update])
            
            updated_record = cursor.fetchone()
            
            if updated_record:
                logger.info(f"")
                logger.info(f"🔍 VERIFICATION:")
                logger.info(f"   Record ID: {updated_record[0]}")
                logger.info(f"   Status: '{updated_record[1]}'")
                logger.info(f"   Logout_Time: {updated_record[2]}")
                
                if updated_record[1] == 'logged_out':
                    logger.info(f"")
                    logger.info("=" * 70)
                    logger.info("✅ SUCCESS! Status is now 'logged_out'")
                    logger.info("=" * 70)
                    logger.info("")
                    return True
                else:
                    logger.error(f"❌ FAILED! Status is still '{updated_record[1]}'")
                    logger.error(f"   The UPDATE did not work properly!")
                    return False
            else:
                logger.error(f"❌ Could not verify - record {record_id_to_update} not found after update!")
                return False
        else:
            # No active session found
            logger.warning(f"")
            logger.warning(f"⚠️ No active session found for user {user_id}")
            
            # Check counts for debugging
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN Status = 'active' THEN 1 ELSE 0 END) as active_count,
                    SUM(CASE WHEN Status = 'logged_out' THEN 1 ELSE 0 END) as logged_out_count,
                    SUM(CASE WHEN Status = 'expired' THEN 1 ELSE 0 END) as expired_count
                FROM tbl_User_Login_History 
                WHERE User_ID = %s
            """, [user_id])
            
            counts = cursor.fetchone()
            logger.info(f"   Total sessions: {counts[0]}")
            logger.info(f"   Active: {counts[1]}")
            logger.info(f"   Logged out: {counts[2]}")
            logger.info(f"   Expired: {counts[3]}")
            
            if counts[0] == 0:
                logger.warning(f"   User {user_id} has NO login history at all!")
            elif counts[1] == 0:
                logger.info(f"   All sessions already logged out - this is OK")
                return True  # Consider this success
            
            return False
                
    except Exception as e:
        logger.error(f"")
        logger.error(f"❌ EXCEPTION in record_logout: {e}")
        import traceback
        logger.error(traceback.format_exc())
        
        # Try to rollback on error
        try:
            connection.rollback()
            logger.info("Rolled back transaction")
        except:
            pass
            
        return False
        
    finally:
        # Always close cursor
        if cursor:
            try:
                cursor.close()
            except:
                pass


def expire_old_sessions(hours=None):
    """Mark sessions older than specified hours as expired"""
    if hours is None:
        hours = SESSION_EXPIRY_HOURS
    
    try:
        cursor = connection.cursor()
        try:
            cursor.execute("""
                UPDATE tbl_User_Login_History 
                SET Status = 'expired', Logout_Time = NOW()
                WHERE Status = 'active' 
                AND Login_Time < DATE_SUB(NOW(), INTERVAL %s HOUR)
            """, [hours])
            
            expired_count = cursor.rowcount
            connection.commit()
            
            if expired_count > 0:
                logger.info(f"✓ Expired {expired_count} old sessions (>{hours} hours)")
            return expired_count
        finally:
            cursor.close()
    except Exception as e:
        logger.error(f"Error expiring old sessions: {e}")
        return 0

# ============================================================================
# API ENDPOINTS
# ============================================================================

@require_http_methods(["GET"])
@csrf_exempt
def Get_All_Login_History(request):
    """Get all login history for admin dashboard with location data"""
    create_login_history_table()
    
    try:
        page = max(1, int(request.GET.get('page', 1)))
        limit = min(100, max(1, int(request.GET.get('limit', 10))))
        user_id_filter = request.GET.get('user_id')
        from_date = request.GET.get('from_date')
        to_date = request.GET.get('to_date')
        device_type = request.GET.get('device_type')
        status_filter = request.GET.get('status')
        search = request.GET.get('search', '').strip()
        
        sort_by = request.GET.get('sort_by', 'login_id').lower()
        sort_order = request.GET.get('sort_order', 'ASC').upper()
        
        valid_sort_columns = {
            'login_id': 'lh.ID',
            'login_time': 'lh.Login_Time',
            'user': 'u.full_name',
            'ip_address': 'lh.IP_Address',
            'status': 'lh.Status',
            'device_type': 'lh.Device_Type',
            'location': 'lh.Location'
        }
        
        sort_column = valid_sort_columns.get(sort_by, 'lh.ID')
        sort_direction = 'ASC' if sort_order == 'ASC' else 'DESC'
        
        offset = (page - 1) * limit
        
        where_clauses = ["1=1"]
        params = []
        
        if user_id_filter:
            where_clauses.append("lh.User_ID = %s")
            params.append(int(user_id_filter))
        
        if from_date:
            where_clauses.append("DATE(lh.Login_Time) >= %s")
            params.append(from_date)
        
        if to_date:
            where_clauses.append("DATE(lh.Login_Time) <= %s")
            params.append(to_date)
        
        if device_type and device_type in ['Desktop', 'Mobile']:
            where_clauses.append("lh.Device_Type = %s")
            params.append(device_type)
        
        if status_filter and status_filter in ['active', 'logged_out', 'expired']:
            where_clauses.append("lh.Status = %s")
            params.append(status_filter)
        
        if search:
            where_clauses.append("""
                (u.full_name LIKE %s OR u.email LIKE %s OR 
                 lh.IP_Address LIKE %s OR lh.Location LIKE %s)
            """)
            search_param = f"%{search}%"
            params.extend([search_param] * 4)
        
        where_sql = " AND ".join(where_clauses)
        
        with connection.cursor() as cursor:
            cursor.execute(f"""
                SELECT COUNT(*) FROM tbl_User_Login_History lh
                JOIN tbl_Users u ON lh.User_ID = u.ID
                WHERE {where_sql}
            """, params)
            total_count = cursor.fetchone()[0]
            
            cursor.execute(f"""
                SELECT 
                    lh.ID,
                    CONCAT('LOG', LPAD(lh.ID, 3, '0')) as Login_ID_Display,
                    CONCAT('USR', LPAD(lh.User_ID, 3, '0')) as User_ID_Display,
                    lh.User_ID,
                    u.full_name,
                    u.email,
                    lh.Device_Info,
                    lh.Device_Type,
                    lh.Login_Time,
                    lh.IP_Address,
                    lh.MAC_Address,
                    lh.Location,
                    lh.Latitude,
                    lh.Longitude,
                    lh.Location_Accuracy,
                    lh.Location_Source,
                    lh.Login_Method,
                    lh.Status,
                    lh.Logout_Time,
                    lh.Session_ID
                FROM tbl_User_Login_History lh
                JOIN tbl_Users u ON lh.User_ID = u.ID
                WHERE {where_sql}
                ORDER BY {sort_column} {sort_direction}
                LIMIT %s OFFSET %s
            """, params + [limit, offset])
            rows = cursor.fetchall()
            
            login_history = []
            for row in rows:
                # Build location object if coordinates exist
                location_data = None
                if row[12] is not None and row[13] is not None:
                    location_data = {
                        'latitude': float(row[12]),
                        'longitude': float(row[13]),
                        'address': row[11],
                        'accuracy': float(row[14]) if row[14] else None,
                        'source': row[15]
                    }
                
                login_history.append({
                    'login_id': row[1],
                    'login_id_raw': row[0],
                    'user_id_display': row[2],
                    'user_id': row[3],
                    'full_name': row[4],
                    'email': row[5],
                    'device_info': row[6],
                    'device_type': row[7],
                    'login_time': row[8].strftime('%m/%d/%Y') if row[8] else None,
                    'login_time_full': row[8].strftime('%m/%d/%Y %I:%M:%S %p') if row[8] else None,
                    'login_time_iso': row[8].isoformat() if row[8] else None,
                    'ip_address': row[9],
                    'mac_address': row[10] if row[10] else None,
                    'location': row[11] if row[11] else 'Unknown',
                    'location_data': location_data,
                    'login_method': row[16],
                    'status': row[17],
                    'logout_time': row[18].strftime('%m/%d/%Y %I:%M:%S %p') if row[18] else None,
                    'session_id': row[19]
                })
        
        total_pages = (total_count + limit - 1) // limit if total_count > 0 else 1
        
        return JsonResponse({
            'success': True,
            'data': login_history,
            'pagination': {
                'current_page': page,
                'total_pages': total_pages,
                'total_records': total_count,
                'records_per_page': limit,
                'has_next': page < total_pages,
                'has_previous': page > 1
            },
            'sort': {
                'sort_by': sort_by,
                'sort_order': sort_direction
            }
        }, status=200)
        
    except ValueError as e:
        logger.error(f"Invalid parameter: {e}")
        return JsonResponse({"Error": "Invalid parameter value"}, status=400)
    except Exception as e:
        logger.error(f"Error getting login history: {e}")
        return JsonResponse({"Error": "Failed to get login history"}, status=500)


@require_http_methods(["GET"])
@csrf_exempt
def Get_User_Login_History(request, user_id):
    """Get login history for a specific user"""
    create_login_history_table()
    
    try:
        page = max(1, int(request.GET.get('page', 1)))
        limit = min(100, max(1, int(request.GET.get('limit', 10))))
        offset = (page - 1) * limit
        
        sort_by = request.GET.get('sort_by', 'login_id').lower()
        sort_order = request.GET.get('sort_order', 'ASC').upper()
        
        valid_sort_columns = {
            'login_id': 'ID',
            'login_time': 'Login_Time',
            'status': 'Status',
            'device_type': 'Device_Type'
        }
        
        sort_column = valid_sort_columns.get(sort_by, 'ID')
        sort_direction = 'ASC' if sort_order == 'ASC' else 'DESC'
        
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT full_name, email FROM tbl_Users 
                WHERE ID = %s AND Status = 1
            """, [user_id])
            user = cursor.fetchone()
            
            if not user:
                return JsonResponse({"Error": "User not found"}, status=404)
            
            full_name, email = user
            
            cursor.execute("""
                SELECT COUNT(*) FROM tbl_User_Login_History WHERE User_ID = %s
            """, [user_id])
            total_count = cursor.fetchone()[0]
            
            cursor.execute(f"""
                SELECT 
                    ID,
                    CONCAT('LOG', LPAD(ID, 3, '0')) as Login_ID_Display,
                    Device_Info,
                    Device_Type,
                    Login_Time,
                    IP_Address,
                    MAC_Address,
                    Location,
                    Latitude,
                    Longitude,
                    Location_Accuracy,
                    Location_Source,
                    Login_Method,
                    Status,
                    Logout_Time
                FROM tbl_User_Login_History
                WHERE User_ID = %s
                ORDER BY {sort_column} {sort_direction}
                LIMIT %s OFFSET %s
            """, [user_id, limit, offset])
            
            rows = cursor.fetchall()
            
            history = []
            for row in rows:
                location_data = None
                if row[8] is not None and row[9] is not None:
                    location_data = {
                        'latitude': float(row[8]),
                        'longitude': float(row[9]),
                        'address': row[7],
                        'accuracy': float(row[10]) if row[10] else None,
                        'source': row[11]
                    }
                
                history.append({
                    'login_id': row[1],
                    'login_id_raw': row[0],
                    'device_info': row[2],
                    'device_type': row[3],
                    'login_time': row[4].strftime('%m/%d/%Y') if row[4] else None,
                    'login_time_full': row[4].strftime('%m/%d/%Y %I:%M:%S %p') if row[4] else None,
                    'login_time_iso': row[4].isoformat() if row[4] else None,
                    'ip_address': row[5],
                    'mac_address': row[6] if row[6] else None,
                    'location': row[7] if row[7] else 'Unknown',
                    'location_data': location_data,
                    'login_method': row[12],
                    'status': row[13],
                    'logout_time': row[14].strftime('%m/%d/%Y %I:%M:%S %p') if row[14] else None
                })
        
        total_pages = (total_count + limit - 1) // limit if total_count > 0 else 1
        
        return JsonResponse({
            'success': True,
            'user_id': user_id,
            'user_id_display': f"USR{str(user_id).zfill(3)}",
            'full_name': full_name,
            'email': email,
            'data': history,
            'pagination': {
                'current_page': page,
                'total_pages': total_pages,
                'total_records': total_count,
                'records_per_page': limit
            },
            'sort': {
                'sort_by': sort_by,
                'sort_order': sort_direction
            }
        }, status=200)
        
    except ValueError:
        return JsonResponse({"Error": "Invalid parameter value"}, status=400)
    except Exception as e:
        logger.error(f"Error getting user login history: {e}")
        return JsonResponse({"Error": "Failed to get login history"}, status=500)


@require_http_methods(["GET"])
@csrf_exempt
def Get_Active_Sessions(request):
    """Get all currently active user sessions"""
    create_login_history_table()
    
    try:
        expire_old_sessions()
        
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    lh.ID,
                    CONCAT('LOG', LPAD(lh.ID, 3, '0')) as Login_ID_Display,
                    CONCAT('USR', LPAD(lh.User_ID, 3, '0')) as User_ID_Display,
                    lh.User_ID,
                    u.full_name,
                    u.email,
                    lh.Device_Info,
                    lh.Device_Type,
                    lh.Login_Time,
                    lh.IP_Address,
                    lh.MAC_Address,
                    lh.Location,
                    lh.Latitude,
                    lh.Longitude,
                    lh.Location_Accuracy,
                    lh.Location_Source,
                    lh.Login_Method,
                    TIMESTAMPDIFF(MINUTE, lh.Login_Time, NOW()) as session_duration_minutes
                FROM tbl_User_Login_History lh
                JOIN tbl_Users u ON lh.User_ID = u.ID
                WHERE lh.Status = 'active'
                ORDER BY lh.ID DESC
            """)
            
            rows = cursor.fetchall()
            
            sessions = []
            for row in rows:
                duration_mins = row[17] or 0
                hours = duration_mins // 60
                mins = duration_mins % 60
                duration_str = f"{hours}h {mins}m" if hours > 0 else f"{mins}m"
                
                location_data = None
                if row[12] is not None and row[13] is not None:
                    location_data = {
                        'latitude': float(row[12]),
                        'longitude': float(row[13]),
                        'address': row[11],
                        'accuracy': float(row[14]) if row[14] else None,
                        'source': row[15]
                    }
                
                sessions.append({
                    'login_id': row[1],
                    'login_id_raw': row[0],
                    'user_id_display': row[2],
                    'user_id': row[3],
                    'full_name': row[4],
                    'email': row[5],
                    'device_info': row[6],
                    'device_type': row[7],
                    'login_time': row[8].strftime('%m/%d/%Y') if row[8] else None,
                    'login_time_full': row[8].strftime('%m/%d/%Y %I:%M:%S %p') if row[8] else None,
                    'ip_address': row[9],
                    'mac_address': row[10] if row[10] else None,
                    'location': row[11] if row[11] else 'Unknown',
                    'location_data': location_data,
                    'login_method': row[16],
                    'session_duration': duration_str,
                    'session_duration_minutes': duration_mins,
                    'status': 'Active'
                })
        
        return JsonResponse({
            'success': True,
            'active_sessions': len(sessions),
            'data': sessions
        }, status=200)
        
    except Exception as e:
        logger.error(f"Error getting active sessions: {e}")
        return JsonResponse({"Error": "Failed to get active sessions"}, status=500)


@require_http_methods(["GET"])
@csrf_exempt
def Get_Login_Statistics(request):
    """Get login statistics for admin dashboard"""
    create_login_history_table()
    
    try:
        days = min(30, max(1, int(request.GET.get('days', 7))))
        
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM tbl_User_Login_History WHERE DATE(Login_Time) = CURDATE()")
            logins_today = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(DISTINCT User_ID) FROM tbl_User_Login_History WHERE DATE(Login_Time) = CURDATE()")
            unique_users_today = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM tbl_User_Login_History WHERE Status = 'active'")
            active_sessions = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM tbl_Users WHERE Status = 1")
            total_users = cursor.fetchone()[0]
            
            cursor.execute("""
                SELECT Device_Type, COUNT(*) FROM tbl_User_Login_History
                WHERE DATE(Login_Time) >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
                GROUP BY Device_Type
            """, [days])
            device_breakdown = {row[0]: row[1] for row in cursor.fetchall()}
            
            cursor.execute("""
                SELECT Login_Method, COUNT(*) FROM tbl_User_Login_History
                WHERE DATE(Login_Time) >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
                GROUP BY Login_Method
            """, [days])
            login_methods = {row[0]: row[1] for row in cursor.fetchall()}
            
            cursor.execute("""
                SELECT Location, COUNT(*) as count FROM tbl_User_Login_History
                WHERE Location IS NOT NULL AND Location != 'Unknown'
                AND DATE(Login_Time) >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
                GROUP BY Location ORDER BY count DESC LIMIT 10
            """, [days])
            top_locations = [{'location': row[0], 'count': row[1]} for row in cursor.fetchall()]
            
            cursor.execute("""
                SELECT DATE(Login_Time), COUNT(*) FROM tbl_User_Login_History
                WHERE DATE(Login_Time) >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
                GROUP BY DATE(Login_Time) ORDER BY DATE(Login_Time) ASC
            """, [days])
            login_trend = [{'date': row[0].strftime('%Y-%m-%d'), 'count': row[1]} for row in cursor.fetchall()]
            
            cursor.execute("""
                SELECT HOUR(Login_Time), COUNT(*) FROM tbl_User_Login_History
                WHERE DATE(Login_Time) = CURDATE()
                GROUP BY HOUR(Login_Time) ORDER BY HOUR(Login_Time)
            """)
            peak_hours = [{'hour': row[0], 'count': row[1]} for row in cursor.fetchall()]
        
        return JsonResponse({
            'success': True,
            'statistics': {
                'logins_today': logins_today,
                'unique_users_today': unique_users_today,
                'active_sessions': active_sessions,
                'total_users': total_users,
                'device_breakdown': {
                    'desktop': device_breakdown.get('Desktop', 0),
                    'mobile': device_breakdown.get('Mobile', 0)
                },
                'login_methods': login_methods,
                'top_locations': top_locations,
                'login_trend': login_trend,
                'peak_hours_today': peak_hours,
                'trend_days': days
            }
        }, status=200)
        
    except ValueError:
        return JsonResponse({"Error": "Invalid parameter value"}, status=400)
    except Exception as e:
        logger.error(f"Error getting login statistics: {e}")
        return JsonResponse({"Error": "Failed to get statistics"}, status=500)


@require_http_methods(["POST"])
@csrf_exempt
def Force_Logout_Session(request, login_id):
    """Force logout a specific session"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT User_ID, Status FROM tbl_User_Login_History WHERE ID = %s", [login_id])
            result = cursor.fetchone()
            
            if not result:
                return JsonResponse({"Error": "Session not found"}, status=404)
            
            user_id, status = result
            
            if status != 'active':
                return JsonResponse({"Error": f"Session already {status}", "status": status}, status=400)
            
            cursor.execute("""
                UPDATE tbl_User_Login_History 
                SET Status = 'logged_out', Logout_Time = NOW()
                WHERE ID = %s
            """, [login_id])
            
            logger.info(f"✓ Force logout: Session {login_id} for user {user_id}")
            
            return JsonResponse({
                'success': True,
                'message': 'Session terminated successfully',
                'login_id': login_id,
                'user_id': user_id
            }, status=200)
            
    except Exception as e:
        logger.error(f"Error force logging out session: {e}")
        return JsonResponse({"Error": "Failed to terminate session"}, status=500)


@require_http_methods(["POST"])
@csrf_exempt
def Force_Logout_User_All_Sessions(request, user_id):
    """Force logout all sessions for a user"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT full_name FROM tbl_Users WHERE ID = %s", [user_id])
            user = cursor.fetchone()
            
            if not user:
                return JsonResponse({"Error": "User not found"}, status=404)
            
            cursor.execute("""
                UPDATE tbl_User_Login_History 
                SET Status = 'logged_out', Logout_Time = NOW()
                WHERE User_ID = %s AND Status = 'active'
            """, [user_id])
            
            sessions_count = cursor.rowcount
            logger.info(f"✓ Force logout all: User {user_id} ({user[0]}), {sessions_count} sessions")
            
            return JsonResponse({
                'success': True,
                'message': 'All sessions terminated successfully',
                'user_id': user_id,
                'full_name': user[0],
                'sessions_terminated': sessions_count
            }, status=200)
            
    except Exception as e:
        logger.error(f"Error force logging out user sessions: {e}")
        return JsonResponse({"Error": "Failed to terminate sessions"}, status=500)


@require_http_methods(["DELETE"])
@csrf_exempt
def Clear_Login_History(request):
    """Clear old login history records"""
    try:
        days = max(7, int(request.GET.get('days', 90)))
        status_filter = request.GET.get('status')
        
        with connection.cursor() as cursor:
            if status_filter and status_filter in ['logged_out', 'expired']:
                cursor.execute("""
                    DELETE FROM tbl_User_Login_History 
                    WHERE Status = %s AND Login_Time < DATE_SUB(NOW(), INTERVAL %s DAY)
                """, [status_filter, days])
            else:
                cursor.execute("""
                    DELETE FROM tbl_User_Login_History 
                    WHERE Status != 'active' AND Login_Time < DATE_SUB(NOW(), INTERVAL %s DAY)
                """, [days])
            
            deleted_count = cursor.rowcount
            logger.info(f"✓ Cleared {deleted_count} old login history records (>{days} days)")
            
            return JsonResponse({
                'success': True,
                'message': f'Cleared {deleted_count} old records',
                'records_deleted': deleted_count,
                'days_kept': days
            }, status=200)
            
    except ValueError:
        return JsonResponse({"Error": "Invalid parameter value"}, status=400)
    except Exception as e:
        logger.error(f"Error clearing login history: {e}")
        return JsonResponse({"Error": "Failed to clear history"}, status=500)
