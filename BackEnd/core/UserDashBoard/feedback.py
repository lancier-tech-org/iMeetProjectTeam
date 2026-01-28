# core/UserDashBoard/feedback.py
from django.db import connection, transaction
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.urls import path
from django.db import models
from django.conf import settings
import json
from django.db.utils import ProgrammingError, OperationalError
from django.utils import timezone
import pytz
from core.WebSocketConnection.meetings import Meetings  # Import Meeting model

# Global Variables
TBL_FEEDBACK = 'tbl_Feedback'
TBL_MEETINGS = 'tbl_Meetings'
TBL_USERS = 'tbl_Users'  # Updated to match schema

VALID_LOGIN_TYPES = {'super_admin', 'user'}
VALID_MODIFICATION_TYPES = {'CREATE', 'UPDATE', 'DELETE', 'READ'}
VALID_FEEDBACK_TYPES = {'General', 'Technical', 'Content', 'Other'}  # Example set

SUCCESS_STATUS = 200
CREATED_STATUS = 201
BAD_REQUEST_STATUS = 400
UNAUTHORIZED_STATUS = 401
FORBIDDEN_STATUS = 403
NOT_FOUND_STATUS = 404
SERVER_ERROR_STATUS = 500

# Column length limits as per SQL schema
COLUMN_LIMITS = {
    'Comments': 4000,  # TEXT field
    'Feedback_Type': 50
}

def validate_field_lengths(data):
    """Validate that field lengths do not exceed schema limits"""
    for field, max_length in COLUMN_LIMITS.items():
        if field in data and data[field] is not None and len(str(data[field])) > max_length:
            return False, f"{field} must be max {max_length} characters"
    return True, ""

def validate_rating(rating):
    """Validate that rating is between 1 and 5"""
    try:
        rating = int(rating)
        if rating < 1 or rating > 5:
            return False, "Rating must be between 1 and 5"
        return True, rating
    except (ValueError, TypeError):
        return False, "Rating must be an integer"

def validate_feedback_type(feedback_type):
    """Validate Feedback_Type"""
    if feedback_type not in VALID_FEEDBACK_TYPES:
        return False, f"Feedback_Type must be one of: {', '.join(VALID_FEEDBACK_TYPES)}"
    return True, feedback_type

class Feedback(models.Model):
    id = models.AutoField(primary_key=True, db_column='ID')
    meeting_id = models.CharField(max_length=20, db_column='Meeting_ID')
    user_id = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.DO_NOTHING, db_column='User_ID')
    rating = models.IntegerField()
    comments = models.TextField(blank=True, null=True)
    feedback_type = models.CharField(max_length=50, blank=True, null=True, db_column='Feedback_Type')
    submitted_at = models.DateTimeField(auto_now_add=True, db_column='Submitted_At')

    class Meta:
        db_table = 'tbl_Feedback'
        app_label = 'core'

def create_feedback_table():
    """Create tbl_Feedback table if it doesn't exist - MYSQL VERSION"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS tbl_Feedback (
                ID INT AUTO_INCREMENT PRIMARY KEY,
                Meeting_ID VARCHAR(20) NOT NULL,
                User_ID INT NOT NULL,
                Rating INT NOT NULL,
                Comments TEXT,
                Feedback_Type VARCHAR(50) DEFAULT NULL,
                Submitted_At DATETIME DEFAULT CURRENT_TIMESTAMP,
                KEY FK_Feedback_Meeting (Meeting_ID),
                KEY FK_Feedback_User (User_ID),
                CONSTRAINT FK_Feedback_Meeting FOREIGN KEY (Meeting_ID) REFERENCES tbl_Meetings (ID) ON DELETE RESTRICT ON UPDATE RESTRICT,
                CONSTRAINT FK_Feedback_User FOREIGN KEY (User_ID) REFERENCES tbl_Users (ID) ON DELETE RESTRICT ON UPDATE RESTRICT,
                CONSTRAINT tbl_Feedback_chk_1 CHECK (Rating BETWEEN 1 AND 5)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """)
    except (ProgrammingError, OperationalError) as e:
        return JsonResponse({"Error": f"Failed to create tbl_Feedback table: {str(e)}"}, status=SERVER_ERROR_STATUS)
        
@require_http_methods(["POST"])
@csrf_exempt
def Create_Feedback(request):
    create_feedback_table()

    try:
        data = json.loads(request.body)
        if isinstance(data, list) and len(data) == 1:
            data = data[0]
        elif isinstance(data, list):
            return JsonResponse({"Error": "Expected a single feedback object, not a list"}, status=BAD_REQUEST_STATUS)
    except json.JSONDecodeError as e:
        return JsonResponse({"Error": "Invalid JSON format"}, status=BAD_REQUEST_STATUS)

    required_fields = ['Meeting_ID', 'User_ID', 'Rating', 'Feedback_Type']
    missing_fields = [field for field in required_fields if field not in data or data[field] is None or data[field] == ""]
    if missing_fields:
        return JsonResponse({"Error": f"Missing or empty required fields: {', '.join(missing_fields)}"}, status=BAD_REQUEST_STATUS)

    # Validate field lengths
    is_valid, error_message = validate_field_lengths(data)
    if not is_valid:
        return JsonResponse({"Error": error_message}, status=BAD_REQUEST_STATUS)

    # Validate Rating
    is_valid, result = validate_rating(data['Rating'])
    if not is_valid:
        return JsonResponse({"Error": result}, status=BAD_REQUEST_STATUS)
    rating = result

    # Validate Feedback_Type
    is_valid, result = validate_feedback_type(data['Feedback_Type'])
    if not is_valid:
        return JsonResponse({"Error": result}, status=BAD_REQUEST_STATUS)
    feedback_type = result

    # Validate Meeting_ID as UUID
    try:
        meeting_id = data['Meeting_ID']
    except ValueError:
        return JsonResponse({"Error": "Invalid Meeting_ID format"}, status=BAD_REQUEST_STATUS)

    # Validate Meeting_ID existence
    try:
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT COUNT(*) FROM {TBL_MEETINGS} WHERE ID = %s", [str(meeting_id)])
            if cursor.fetchone()[0] == 0:
                return JsonResponse({"Error": "Meeting_ID not found"}, status=NOT_FOUND_STATUS)
    except (ProgrammingError, OperationalError) as e:
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    # Validate User_ID
    try:
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT COUNT(*) FROM {TBL_USERS} WHERE ID = %s", [data['User_ID']])
            if cursor.fetchone()[0] == 0:
                return JsonResponse({"Error": "User_ID not found"}, status=NOT_FOUND_STATUS)
    except (ProgrammingError, OperationalError) as e:
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    # FIXED: MySQL compatible INSERT with LAST_INSERT_ID()
    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                insert_query = f"""
                INSERT INTO {TBL_FEEDBACK} (
                    Meeting_ID, User_ID, Rating, Comments, Feedback_Type
                )
                VALUES (%s, %s, %s, %s, %s)
                """
                values = [
                    str(meeting_id),
                    data['User_ID'],
                    rating,
                    data.get('Comments'),
                    feedback_type
                ]
                cursor.execute(insert_query, values)
                
                # MYSQL WAY: Get the last inserted ID
                cursor.execute("SELECT LAST_INSERT_ID()")
                inserted_id = cursor.fetchone()[0]
                
    except (ProgrammingError, OperationalError) as e:
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse({
        "Message": "Feedback created successfully",
        "Feedback_ID": inserted_id
    }, status=CREATED_STATUS)

@require_http_methods(["GET"])
@csrf_exempt
def List_All_Feedback(request):
    create_feedback_table()

    # Get filter parameters
    start_date = request.GET.get('start_date')  # Format: YYYY-MM-DD
    end_date = request.GET.get('end_date')      # Format: YYYY-MM-DD
    user_timezone = request.GET.get('timezone', 'UTC')  # Default UTC
    rating_filter = request.GET.get('rating')    # 1-5
    feedback_type = request.GET.get('type')      # General, Technical, etc.

    try:
        # Validate timezone
        try:
            tz = pytz.timezone(user_timezone)
        except pytz.UnknownTimeZoneError:
            return JsonResponse({"Error": f"Invalid timezone: {user_timezone}"}, status=BAD_REQUEST_STATUS)

        with connection.cursor() as cursor:
            # Build dynamic query
            base_query = f"""
            SELECT f.ID, f.Meeting_ID, f.User_ID, f.Rating, f.Comments, 
                   f.Feedback_Type, f.Submitted_At,
                   u.full_name, u.email, u.phone_number, u.country, u.Status
            FROM {TBL_FEEDBACK} f
            LEFT JOIN {TBL_USERS} u ON f.User_ID = u.ID
            WHERE 1=1
            """
            params = []

            # Date filter with timezone conversion
            if start_date:
                # Convert user's local date to UTC for query
                try:
                    local_start = tz.localize(timezone.datetime.strptime(start_date, '%Y-%m-%d'))
                    utc_start = local_start.astimezone(pytz.UTC)
                    base_query += " AND f.Submitted_At >= %s"
                    params.append(utc_start)
                except ValueError:
                    return JsonResponse({"Error": "Invalid start_date format. Use YYYY-MM-DD"}, status=BAD_REQUEST_STATUS)

            if end_date:
                try:
                    # End of the day in user's timezone
                    local_end = tz.localize(timezone.datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59))
                    utc_end = local_end.astimezone(pytz.UTC)
                    base_query += " AND f.Submitted_At <= %s"
                    params.append(utc_end)
                except ValueError:
                    return JsonResponse({"Error": "Invalid end_date format. Use YYYY-MM-DD"}, status=BAD_REQUEST_STATUS)

            # Rating filter
            if rating_filter:
                try:
                    rating_val = int(rating_filter)
                    if 1 <= rating_val <= 5:
                        base_query += " AND f.Rating = %s"
                        params.append(rating_val)
                except ValueError:
                    pass

            # Feedback type filter
            if feedback_type and feedback_type in VALID_FEEDBACK_TYPES:
                base_query += " AND f.Feedback_Type = %s"
                params.append(feedback_type)

            base_query += " ORDER BY f.Submitted_At DESC"
            
            cursor.execute(base_query, params)
            rows = cursor.fetchall()
            
            feedback_list = []
            for row in rows:
                # Convert Submitted_At to user's timezone
                submitted_utc = row[6]
                if submitted_utc:
                    if submitted_utc.tzinfo is None:
                        submitted_utc = pytz.UTC.localize(submitted_utc)
                    submitted_local = submitted_utc.astimezone(tz)
                    submitted_str = submitted_local.strftime('%Y-%m-%d %H:%M:%S %Z')
                else:
                    submitted_str = None

                feedback_list.append({
                    "ID": row[0],
                    "Meeting_ID": str(row[1]),
                    "User_ID": row[2],
                    "Rating": row[3],
                    "Comments": row[4],
                    "Feedback_Type": row[5],
                    "Submitted_At": submitted_str,
                    "Submitted_At_ISO": row[6].isoformat() if row[6] else None,
                    "User_Name": row[7],
                    "User_Email": row[8],
                    "User_Phone": row[9],
                    "User_Country": row[10],
                    "User_Status": row[11]
                })
                
    except (ProgrammingError, OperationalError) as e:
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse({
        "Feedback": feedback_list,
        "Total": len(feedback_list),
        "Filters_Applied": {
            "start_date": start_date,
            "end_date": end_date,
            "timezone": user_timezone,
            "rating": rating_filter,
            "type": feedback_type
        }
    }, status=SUCCESS_STATUS)

@require_http_methods(["GET"])
@csrf_exempt
def Get_Timezones(request):
    """Get list of common timezones"""
    common_timezones = [
        {"value": "UTC", "label": "UTC"},
        {"value": "Asia/Kolkata", "label": "India (IST)"},
        {"value": "America/New_York", "label": "US Eastern"},
        {"value": "America/Los_Angeles", "label": "US Pacific"},
        {"value": "Europe/London", "label": "UK (GMT/BST)"},
        {"value": "Europe/Paris", "label": "Central Europe"},
        {"value": "Asia/Tokyo", "label": "Japan"},
        {"value": "Asia/Singapore", "label": "Singapore"},
        {"value": "Australia/Sydney", "label": "Australia Eastern"},
    ]
    
    # Get all timezones
    all_timezones = [{"value": tz, "label": tz} for tz in pytz.common_timezones]
    
    return JsonResponse({
        "common": common_timezones,
        "all": all_timezones
    }, status=SUCCESS_STATUS)

@require_http_methods(["GET"])
@csrf_exempt
def Get_Feedback(request, id):
    create_feedback_table()

    try:
        feedback_id = int(id)
    except ValueError:
        return JsonResponse({"Error": "Invalid ID format"}, status=BAD_REQUEST_STATUS)

    try:
        with connection.cursor() as cursor:
            # JOIN with tbl_Users to get user name and email
            cursor.execute(f"""
            SELECT f.ID, f.Meeting_ID, f.User_ID, f.Rating, f.Comments, 
                   f.Feedback_Type, f.Submitted_At,
                   u.full_name, u.email, u.phone_number, u.country, u.Status
            FROM {TBL_FEEDBACK} f
            LEFT JOIN {TBL_USERS} u ON f.User_ID = u.ID
            WHERE f.ID = %s
            """, [feedback_id])
            row = cursor.fetchone()
            
            if not row:
                return JsonResponse({"Error": "Feedback not found"}, status=NOT_FOUND_STATUS)
                
            feedback = {
                "ID": row[0],
                "Meeting_ID": str(row[1]),
                "User_ID": row[2],
                "Rating": row[3],
                "Comments": row[4],
                "Feedback_Type": row[5],
                "Submitted_At": row[6].isoformat() if row[6] else None,
                "User_Name": row[7],
                "User_Email": row[8],
                "User_Phone": row[9],
                "User_Country": row[10],
                "User_Status": row[11]
            }
                
    except (ProgrammingError, OperationalError) as e:
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse({"Feedback": feedback}, status=SUCCESS_STATUS)

@require_http_methods(["GET"])
@csrf_exempt
def Get_Feedback_By_User(request, user_id):
    """Get all feedback submitted by a specific user"""
    create_feedback_table()

    try:
        user_id = int(user_id)
    except ValueError:
        return JsonResponse({"Error": "Invalid User ID format"}, status=BAD_REQUEST_STATUS)

    try:
        with connection.cursor() as cursor:
            # Verify user exists
            cursor.execute(f"SELECT full_name, email FROM {TBL_USERS} WHERE ID = %s", [user_id])
            user_row = cursor.fetchone()
            if not user_row:
                return JsonResponse({"Error": "User not found"}, status=NOT_FOUND_STATUS)

            # Get all feedback by this user
            cursor.execute(f"""
            SELECT f.ID, f.Meeting_ID, f.User_ID, f.Rating, f.Comments, 
                   f.Feedback_Type, f.Submitted_At,
                   u.full_name, u.email, u.phone_number, u.country, u.Status
            FROM {TBL_FEEDBACK} f
            LEFT JOIN {TBL_USERS} u ON f.User_ID = u.ID
            WHERE f.User_ID = %s
            ORDER BY f.Submitted_At DESC
            """, [user_id])
            rows = cursor.fetchall()
            
            feedback_list = []
            for row in rows:
                feedback_list.append({
                    "ID": row[0],
                    "Meeting_ID": str(row[1]),
                    "User_ID": row[2],
                    "Rating": row[3],
                    "Comments": row[4],
                    "Feedback_Type": row[5],
                    "Submitted_At": row[6].isoformat() if row[6] else None,
                    "User_Name": row[7],
                    "User_Email": row[8],
                    "User_Phone": row[9],
                    "User_Country": row[10],
                    "User_Status": row[11]
                })
                
    except (ProgrammingError, OperationalError) as e:
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse({
        "User": {
            "ID": user_id,
            "Name": user_row[0],
            "Email": user_row[1]
        },
        "Feedback": feedback_list,
        "Total": len(feedback_list)
    }, status=SUCCESS_STATUS)

@require_http_methods(["GET"])
@csrf_exempt
def Get_Feedback_By_Meeting(request, meeting_id):
    """Get all feedback for a specific meeting"""
    create_feedback_table()

    try:
        with connection.cursor() as cursor:
            # Verify meeting exists
            cursor.execute(f"SELECT COUNT(*) FROM {TBL_MEETINGS} WHERE ID = %s", [meeting_id])
            if cursor.fetchone()[0] == 0:
                return JsonResponse({"Error": "Meeting not found"}, status=NOT_FOUND_STATUS)

            # Get all feedback for this meeting
            cursor.execute(f"""
            SELECT f.ID, f.Meeting_ID, f.User_ID, f.Rating, f.Comments, 
                   f.Feedback_Type, f.Submitted_At,
                   u.full_name, u.email, u.phone_number, u.country, u.Status
            FROM {TBL_FEEDBACK} f
            LEFT JOIN {TBL_USERS} u ON f.User_ID = u.ID
            WHERE f.Meeting_ID = %s
            ORDER BY f.Submitted_At DESC
            """, [meeting_id])
            rows = cursor.fetchall()
            
            feedback_list = []
            total_rating = 0
            for row in rows:
                feedback_list.append({
                    "ID": row[0],
                    "Meeting_ID": str(row[1]),
                    "User_ID": row[2],
                    "Rating": row[3],
                    "Comments": row[4],
                    "Feedback_Type": row[5],
                    "Submitted_At": row[6].isoformat() if row[6] else None,
                    "User_Name": row[7],
                    "User_Email": row[8],
                    "User_Phone": row[9],
                    "User_Country": row[10],
                    "User_Status": row[11]
                })
                total_rating += row[3]
            
            avg_rating = round(total_rating / len(feedback_list), 2) if feedback_list else 0
                
    except (ProgrammingError, OperationalError) as e:
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse({
        "Meeting_ID": meeting_id,
        "Feedback": feedback_list,
        "Total": len(feedback_list),
        "Average_Rating": avg_rating
    }, status=SUCCESS_STATUS)

@require_http_methods(["PUT"])
@csrf_exempt
def Update_Feedback(request, id):
    create_feedback_table()

    try:
        feedback_id = int(id)
    except ValueError:
        return JsonResponse({"Error": "Invalid ID format"}, status=BAD_REQUEST_STATUS)

    try:
        data = json.loads(request.body)
        if isinstance(data, list) and len(data) == 1:
            data = data[0]
        elif isinstance(data, list):
            return JsonResponse({"Error": "Expected a single feedback object, not a list"}, status=BAD_REQUEST_STATUS)
    except json.JSONDecodeError as e:
        return JsonResponse({"Error": "Invalid JSON format"}, status=BAD_REQUEST_STATUS)

    required_fields = ['Meeting_ID', 'User_ID', 'Rating', 'Feedback_Type']
    missing_fields = [field for field in required_fields if field not in data or data[field] is None or data[field] == ""]
    if missing_fields:
        return JsonResponse({"Error": f"Missing or empty required fields: {', '.join(missing_fields)}"}, status=BAD_REQUEST_STATUS)

    # Validate field lengths
    is_valid, error_message = validate_field_lengths(data)
    if not is_valid:
        return JsonResponse({"Error": error_message}, status=BAD_REQUEST_STATUS)

    # Validate Rating
    is_valid, result = validate_rating(data['Rating'])
    if not is_valid:
        return JsonResponse({"Error": result}, status=BAD_REQUEST_STATUS)
    rating = result

    # Validate Feedback_Type
    is_valid, result = validate_feedback_type(data['Feedback_Type'])
    if not is_valid:
        return JsonResponse({"Error": result}, status=BAD_REQUEST_STATUS)
    feedback_type = result

    # Validate Meeting_ID as UUID
    try:
        meeting_id = data['Meeting_ID']
    except ValueError:
        return JsonResponse({"Error": "Invalid Meeting_ID format"}, status=BAD_REQUEST_STATUS)

    # Validate Meeting_ID existence
    try:
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT COUNT(*) FROM {TBL_MEETINGS} WHERE ID = %s", [str(meeting_id)])
            if cursor.fetchone()[0] == 0:
                return JsonResponse({"Error": "Meeting_ID not found"}, status=NOT_FOUND_STATUS)
    except (ProgrammingError, OperationalError) as e:
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    # Validate User_ID
    try:
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT COUNT(*) FROM {TBL_USERS} WHERE ID = %s", [data['User_ID']])
            if cursor.fetchone()[0] == 0:
                return JsonResponse({"Error": "User_ID not found"}, status=NOT_FOUND_STATUS)
    except (ProgrammingError, OperationalError) as e:
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                update_query = f"""
                UPDATE {TBL_FEEDBACK}
                SET Meeting_ID = %s,
                    User_ID = %s,
                    Rating = %s,
                    Comments = %s,
                    Feedback_Type = %s
                WHERE ID = %s
                """
                values = [
                    str(meeting_id),
                    data['User_ID'],
                    rating,
                    data.get('Comments'),
                    feedback_type,
                    feedback_id
                ]
                cursor.execute(update_query, values)
                if cursor.rowcount == 0:
                    return JsonResponse({"Error": "Feedback not found"}, status=NOT_FOUND_STATUS)
    except (ProgrammingError, OperationalError) as e:
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse({"Message": "Feedback updated successfully"}, status=SUCCESS_STATUS)

@require_http_methods(["DELETE"])
@csrf_exempt
def Delete_Feedback(request, id):
    create_feedback_table()

    try:
        feedback_id = int(id)
    except ValueError:
        return JsonResponse({"Error": "Invalid ID format"}, status=BAD_REQUEST_STATUS)

    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                select_query = f"SELECT ID FROM {TBL_FEEDBACK} WHERE ID = %s"
                cursor.execute(select_query, [feedback_id])
                row = cursor.fetchone()
                if not row:
                    return JsonResponse({"Error": "Feedback not found"}, status=NOT_FOUND_STATUS)

                delete_query = f"DELETE FROM {TBL_FEEDBACK} WHERE ID = %s"
                cursor.execute(delete_query, [feedback_id])
    except (ProgrammingError, OperationalError) as e:
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse({"Message": f"Feedback ID {feedback_id} deleted successfully"}, status=SUCCESS_STATUS)

@require_http_methods(["POST"])
@csrf_exempt
def Validate_Feedback_Data(request):
    create_feedback_table()

    try:
        data = json.loads(request.body)
        if isinstance(data, list) and len(data) == 1:
            data = data[0]
        elif isinstance(data, list):
            return JsonResponse({"Error": "Expected a single validation object, not a list"}, status=BAD_REQUEST_STATUS)
    except json.JSONDecodeError as e:
        return JsonResponse({"Error": "Invalid JSON format"}, status=BAD_REQUEST_STATUS)

    # Initialize validation results
    validation_results = {
        "Meeting_ID": {"is_valid": True, "message": ""},
        "User_ID": {"is_valid": True, "message": ""},
        "Rating": {"is_valid": True, "message": ""},
        "Comments": {"is_valid": True, "message": ""},
        "Feedback_Type": {"is_valid": True, "message": ""}
    }

    # Validate Meeting_ID (if provided)
    if data.get('Meeting_ID'):
        try:
            meeting_id = data['Meeting_ID']
            with connection.cursor() as cursor:
                cursor.execute(f"SELECT COUNT(*) FROM {TBL_MEETINGS} WHERE ID = %s", [str(meeting_id)])
                if cursor.fetchone()[0] == 0:
                    validation_results["Meeting_ID"] = {"is_valid": False, "message": "Meeting_ID not found"}
        except ValueError:
            validation_results["Meeting_ID"] = {"is_valid": False, "message": "Invalid Meeting_ID format"}

    # Validate User_ID (if provided)
    if data.get('User_ID'):
        try:
            with connection.cursor() as cursor:
                cursor.execute(f"SELECT COUNT(*) FROM {TBL_USERS} WHERE ID = %s", [data['User_ID']])
                if cursor.fetchone()[0] == 0:
                    validation_results["User_ID"] = {"is_valid": False, "message": "User_ID not found"}
        except (ProgrammingError, OperationalError) as e:
            return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    # Validate Rating (if provided)
    if data.get('Rating'):
        is_valid, error_message = validate_rating(data['Rating'])
        if not is_valid:
            validation_results["Rating"] = {"is_valid": False, "message": error_message}

    # Validate Comments (if provided)
    if data.get('Comments'):
        is_valid, error_message = validate_field_lengths({'Comments': data['Comments']})
        if not is_valid:
            validation_results["Comments"] = {"is_valid": False, "message": error_message}

    # Validate Feedback_Type (if provided)
    if data.get('Feedback_Type'):
        is_valid, error_message = validate_feedback_type(data['Feedback_Type'])
        if not is_valid:
            validation_results["Feedback_Type"] = {"is_valid": False, "message": error_message}

    return JsonResponse(validation_results, status=SUCCESS_STATUS)

@require_http_methods(["GET"])
@csrf_exempt
def Get_Feedback_Stats(request):
    """Get feedback statistics"""
    create_feedback_table()

    try:
        with connection.cursor() as cursor:
            # Total feedback count
            cursor.execute(f"SELECT COUNT(*) FROM {TBL_FEEDBACK}")
            total_count = cursor.fetchone()[0]

            # Average rating
            cursor.execute(f"SELECT AVG(Rating) FROM {TBL_FEEDBACK}")
            avg_rating_result = cursor.fetchone()[0]
            avg_rating = round(float(avg_rating_result), 2) if avg_rating_result else 0

            # Rating distribution
            cursor.execute(f"""
            SELECT Rating, COUNT(*) as count 
            FROM {TBL_FEEDBACK} 
            GROUP BY Rating 
            ORDER BY Rating
            """)
            rating_rows = cursor.fetchall()
            rating_distribution = {row[0]: row[1] for row in rating_rows}

            # Feedback type distribution
            cursor.execute(f"""
            SELECT Feedback_Type, COUNT(*) as count 
            FROM {TBL_FEEDBACK} 
            WHERE Feedback_Type IS NOT NULL
            GROUP BY Feedback_Type
            """)
            type_rows = cursor.fetchall()
            type_distribution = {row[0]: row[1] for row in type_rows}

            # Recent feedback (last 7 days)
            cursor.execute(f"""
            SELECT COUNT(*) 
            FROM {TBL_FEEDBACK} 
            WHERE Submitted_At >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            """)
            recent_count = cursor.fetchone()[0]

    except (ProgrammingError, OperationalError) as e:
        return JsonResponse({"Error": f"Database error: {str(e)}"}, status=SERVER_ERROR_STATUS)

    return JsonResponse({
        "Total_Feedback": total_count,
        "Average_Rating": avg_rating,
        "Rating_Distribution": rating_distribution,
        "Feedback_Type_Distribution": type_distribution,
        "Recent_Feedback_7_Days": recent_count
    }, status=SUCCESS_STATUS)

# Update URLs to include the endpoints
urlpatterns = [
    path('api/feedback/create', Create_Feedback, name='Create_Feedback'),
    path('api/feedback/feedbacks', List_All_Feedback, name='List_All_Feedback'),
    path('api/feedback/feedback/<int:id>', Get_Feedback, name='Get_Feedback'),
    path('api/feedback/update/<int:id>', Update_Feedback, name='Update_Feedback'),
    path('api/feedback/delete/<int:id>', Delete_Feedback, name='Delete_Feedback'),
    path('api/feedback/validate', Validate_Feedback_Data, name='Validate_Feedback_Data'),
    path('api/feedback/user/<int:user_id>', Get_Feedback_By_User, name='Get_Feedback_By_User'),
    path('api/feedback/meeting/<str:meeting_id>', Get_Feedback_By_Meeting, name='Get_Feedback_By_Meeting'),
    path('api/feedback/stats', Get_Feedback_Stats, name='Get_Feedback_Stats'),
    # Add to urlpatterns
    path('api/feedback/timezones', Get_Timezones, name='Get_Timezones'),
]
