"""
Custom Django migration to create all database tables using raw SQL.
This ensures the exact schema (columns, indexes, constraints, ENUMs,
GENERATED columns, CHECK constraints, COMMENTs, collations) is replicated
from the original SampleDB_S database.

Usage:
    1. Place this file at: your_app/migrations/0001_initial.py
    2. Run: python manage.py migrate
"""

from django.db import migrations


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [

        # ──────────────────────────────────────────────
        # 1. tbl_Users (no FK dependencies)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS tbl_Users (
                    ID INT AUTO_INCREMENT PRIMARY KEY,
                    full_name VARCHAR(100) NOT NULL,
                    email VARCHAR(100) NOT NULL UNIQUE,
                    password VARCHAR(255) NOT NULL,
                    phone_number VARCHAR(20) DEFAULT NULL,
                    address VARCHAR(255) DEFAULT NULL,
                    country VARCHAR(50) DEFAULT NULL,
                    Status TINYINT(1) DEFAULT 1,
                    status_Code CHAR(1) DEFAULT 'u',
                    country_code VARCHAR(10) DEFAULT NULL,
                    languages VARCHAR(100) DEFAULT NULL,
                    agreeToTerms TINYINT(1) DEFAULT 0,
                    Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
                    Updated_At DATETIME DEFAULT NULL,
                    profile_photo_id VARCHAR(50) DEFAULT NULL,
                    face_embedding_id VARCHAR(100) DEFAULT NULL,
                    liveness_photos_id VARCHAR(100) DEFAULT NULL,
                    edited_photo_id VARCHAR(100) DEFAULT NULL,
                    photo_code TINYINT DEFAULT 0
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_Users;",
        ),

        # ──────────────────────────────────────────────
        # 2. tbl_Super_Admin (no FK dependencies)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS tbl_Super_Admin (
                    ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    Full_Name VARCHAR(100) DEFAULT NULL,
                    Mobile_Number VARCHAR(15) DEFAULT NULL,
                    Email VARCHAR(100) DEFAULT NULL UNIQUE,
                    Password VARCHAR(50) DEFAULT NULL,
                    Address VARCHAR(150) DEFAULT NULL,
                    Country VARCHAR(50) DEFAULT NULL,
                    status_code CHAR(1) DEFAULT 's',
                    status TINYINT(1) DEFAULT 1,
                    Photo_upload VARCHAR(500) DEFAULT NULL,
                    Country_Code VARCHAR(10) DEFAULT '+91',
                    Timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
                    Languages VARCHAR(50) DEFAULT 'English'
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_Super_Admin;",
        ),

        # ──────────────────────────────────────────────
        # 3. tbl_Plans (no FK dependencies)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_Plans;",
        ),

        # ──────────────────────────────────────────────
        # 4. tbl_company_details (no FK dependencies)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS tbl_company_details (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    company_legal_name VARCHAR(200) NOT NULL COMMENT 'Legal registered name of company',
                    company_trade_name VARCHAR(200) NOT NULL COMMENT 'Trade name for invoices',
                    gstin VARCHAR(15) NOT NULL UNIQUE COMMENT 'GST Identification Number',
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
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    KEY idx_company_state (state),
                    KEY idx_company_active (is_active)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Company details for invoice generation';
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_company_details;",
        ),

        # ──────────────────────────────────────────────
        # 5. tbl_OTP_Reset (no FK dependencies)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS tbl_OTP_Reset (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    email VARCHAR(100) NOT NULL,
                    otp VARCHAR(6) NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME NOT NULL,
                    used TINYINT(1) DEFAULT 0
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_OTP_Reset;",
        ),

        # ──────────────────────────────────────────────
        # 6. tbl_Meetings (depends on tbl_Users)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS tbl_Meetings (
                    ID VARCHAR(20) NOT NULL PRIMARY KEY,
                    Host_ID INT DEFAULT NULL,
                    Meeting_Name VARCHAR(200) DEFAULT NULL,
                    Meeting_Type VARCHAR(50) DEFAULT NULL,
                    Meeting_Link VARCHAR(500) DEFAULT NULL,
                    Status VARCHAR(50) DEFAULT 'active',
                    Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
                    Started_At DATETIME DEFAULT NULL,
                    Ended_At DATETIME DEFAULT NULL,
                    Is_Recording_Enabled TINYINT(1) DEFAULT 0,
                    Waiting_Room_Enabled TINYINT(1) DEFAULT 0,
                    LiveKit_Room_Name VARCHAR(100) DEFAULT NULL,
                    LiveKit_Room_SID VARCHAR(100) DEFAULT NULL,
                    Recording_Status VARCHAR(50) DEFAULT 'inactive',
                    current_participant_count INT DEFAULT 0,
                    Is_Deleted TINYINT(1) DEFAULT 0,
                    Deleted_At DATETIME DEFAULT NULL,
                    KEY FK_Meetings_Users (Host_ID),
                    KEY idx_meetings_livekit (ID, LiveKit_Room_Name, Status),
                    CONSTRAINT FK_Meetings_Users FOREIGN KEY (Host_ID) REFERENCES tbl_Users (ID) ON DELETE RESTRICT ON UPDATE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_Meetings;",
        ),

        # ──────────────────────────────────────────────
        # 7. tbl_User_Login_History (depends on tbl_Users)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_User_Login_History;",
        ),

        # ──────────────────────────────────────────────
        # 8. tbl_payment_orders (depends on tbl_Users)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_payment_orders;",
        ),

        # ──────────────────────────────────────────────
        # 9. tbl_CalendarMeetings (depends on tbl_Meetings, tbl_Users)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS tbl_CalendarMeetings (
                    ID VARCHAR(20) NOT NULL PRIMARY KEY,
                    Host_ID INT DEFAULT NULL,
                    title VARCHAR(255) DEFAULT NULL,
                    startTime DATETIME DEFAULT NULL,
                    endTime DATETIME DEFAULT NULL,
                    duration INT DEFAULT NULL,
                    email TEXT,
                    guestEmails TEXT,
                    provider VARCHAR(50) DEFAULT NULL,
                    meetingUrl VARCHAR(512) DEFAULT NULL,
                    location VARCHAR(255) DEFAULT NULL,
                    attendees TEXT,
                    reminderMinutes TEXT,
                    Settings_CreateCalendarEvent TINYINT(1) DEFAULT 0,
                    Settings_SendInvitations TINYINT(1) DEFAULT 0,
                    Settings_SetReminders TINYINT(1) DEFAULT 0,
                    Settings_AddMeetingLink TINYINT(1) DEFAULT 0,
                    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    Settings_AddToHostCalendar TINYINT(1) DEFAULT 1,
                    Settings_AddToParticipantCalendars TINYINT(1) DEFAULT 1,
                    Is_Deleted TINYINT(1) DEFAULT 0,
                    Deleted_At DATETIME DEFAULT NULL,
                    KEY FK_CalendarMeetings_Users (Host_ID),
                    CONSTRAINT FK_CalendarMeetings_Meetings FOREIGN KEY (ID) REFERENCES tbl_Meetings (ID) ON DELETE CASCADE ON UPDATE RESTRICT,
                    CONSTRAINT FK_CalendarMeetings_Users FOREIGN KEY (Host_ID) REFERENCES tbl_Users (ID) ON DELETE RESTRICT ON UPDATE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_CalendarMeetings;",
        ),

        # ──────────────────────────────────────────────
        # 10. tbl_ScheduledMeetings (depends on tbl_Meetings, tbl_Users)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS tbl_ScheduledMeetings (
                    id VARCHAR(20) NOT NULL PRIMARY KEY,
                    host_id INT DEFAULT NULL,
                    title VARCHAR(200) DEFAULT NULL,
                    description VARCHAR(1000) DEFAULT NULL,
                    location VARCHAR(255) DEFAULT NULL,
                    start_time DATETIME DEFAULT NULL,
                    end_time DATETIME DEFAULT NULL,
                    start_date DATETIME DEFAULT NULL,
                    end_date DATETIME DEFAULT NULL,
                    timezone VARCHAR(100) DEFAULT NULL,
                    duration_minutes INT DEFAULT NULL,
                    is_recurring TINYINT(1) DEFAULT 0,
                    recurrence_type VARCHAR(50) DEFAULT NULL,
                    recurrence_interval INT DEFAULT NULL,
                    recurrence_occurrences INT DEFAULT NULL,
                    recurrence_end_date DATETIME DEFAULT NULL,
                    settings_waiting_room TINYINT(1) DEFAULT 0,
                    settings_recording TINYINT(1) DEFAULT 0,
                    settings_allow_chat TINYINT(1) DEFAULT 1,
                    settings_allow_screen_share TINYINT(1) DEFAULT 1,
                    settings_mute_participants TINYINT(1) DEFAULT 0,
                    settings_require_password TINYINT(1) DEFAULT 0,
                    settings_password VARCHAR(100) DEFAULT NULL,
                    reminders_email TINYINT(1) DEFAULT 1,
                    reminders_browser TINYINT(1) DEFAULT 1,
                    reminders_times VARCHAR(500) DEFAULT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    email TEXT,
                    selected_days TEXT,
                    selected_month_dates TEXT,
                    monthly_pattern VARCHAR(50) DEFAULT 'same-date',
                    Is_Deleted TINYINT(1) DEFAULT 0,
                    Deleted_At DATETIME DEFAULT NULL,
                    KEY FK_tbl_ScheduledMeetings_Users (host_id),
                    CONSTRAINT FK_Sched_Meeting_MeetingID FOREIGN KEY (id) REFERENCES tbl_Meetings (ID) ON DELETE CASCADE,
                    CONSTRAINT FK_tbl_ScheduledMeetings_Users FOREIGN KEY (host_id) REFERENCES tbl_Users (ID) ON DELETE RESTRICT ON UPDATE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_ScheduledMeetings;",
        ),

        # ──────────────────────────────────────────────
        # 11. tbl_Participants (depends on tbl_Meetings, tbl_Users)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS tbl_Participants (
                    ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    Meeting_ID VARCHAR(20) NOT NULL,
                    User_ID INT NOT NULL,
                    Full_Name VARCHAR(100) DEFAULT NULL,
                    Role VARCHAR(50) DEFAULT 'participant',
                    Meeting_Type VARCHAR(50) DEFAULT NULL,
                    Join_Times JSON NOT NULL COMMENT 'Array of all join times: ["2024-10-16 12:00:00", "2024-10-16 12:30:00"]',
                    Leave_Times JSON NOT NULL DEFAULT (JSON_ARRAY()) COMMENT 'Array of all leave times: ["2024-10-16 12:10:00"]',
                    Total_Duration_Minutes DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Sum of all session durations in minutes',
                    Total_Sessions INT DEFAULT 0 COMMENT 'Count of completed sessions',
                    End_Meeting_Time DATETIME DEFAULT NULL,
                    Is_Currently_Active TINYINT(1) DEFAULT 1 COMMENT 'Is user currently in meeting',
                    Attendance_Percentagebasedon_host DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Attendance percentage based on host total duration',
                    Participant_Attendance DECIMAL(5,2) DEFAULT NULL COMMENT 'Per-meeting average: (attendance_percentage + Attendance_Percentagebasedon_host) / 2',
                    Overall_Attendance DECIMAL(5,2) DEFAULT NULL COMMENT 'Overall attendance: AVG(Participant_Attendance) across all meetings for same user',
                    occurrence_number INT NOT NULL DEFAULT 1,
                    session_start_time DATE NOT NULL,
                    UNIQUE KEY idx_unique_participant (Meeting_ID, User_ID, occurrence_number),
                    KEY idx_active_users (Meeting_ID, Is_Currently_Active),
                    KEY idx_participants_overall_attendance (User_ID, Overall_Attendance),
                    KEY idx_user_part_attend (User_ID, Participant_Attendance),
                    KEY idx_user_overall_attend (User_ID, Overall_Attendance),
                    KEY idx_attend_summary (User_ID, Participant_Attendance, Overall_Attendance),
                    CONSTRAINT FK_Participants_Meeting FOREIGN KEY (Meeting_ID) REFERENCES tbl_Meetings (ID) ON DELETE CASCADE ON UPDATE CASCADE,
                    CONSTRAINT FK_Participants_User FOREIGN KEY (User_ID) REFERENCES tbl_Users (ID) ON DELETE CASCADE ON UPDATE CASCADE,
                    CONSTRAINT chk_meeting_type CHECK (Meeting_Type IN ('InstantMeeting','ScheduleMeeting','CalendarMeeting')),
                    CONSTRAINT chk_role CHECK (Role IN ('host','co-host','participant'))
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Stores participant data with session arrays';
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_Participants;",
        ),

        # ──────────────────────────────────────────────
        # 12. tbl_Attendance_Sessions (no FK, uses varchar Meeting_ID/User_ID)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS tbl_Attendance_Sessions (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    Meeting_ID VARCHAR(20) NOT NULL,
                    User_ID VARCHAR(100) NOT NULL,
                    popup_count INT DEFAULT 0,
                    detection_counts TEXT,
                    violation_start_times TEXT,
                    total_detections INT DEFAULT 0,
                    attendance_penalty FLOAT DEFAULT 0,
                    session_active TINYINT(1) DEFAULT 0,
                    break_used TINYINT(1) DEFAULT 0,
                    violations TEXT,
                    session_start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
                    frame_processing_count INT DEFAULT 0,
                    engagement_score INT DEFAULT 0,
                    attendance_percentage DECIMAL(5,2) DEFAULT 100.00,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    break_count INT DEFAULT 0,
                    break_sessions LONGTEXT NOT NULL DEFAULT (_utf8mb4'[]'),
                    current_break_start_time DOUBLE DEFAULT NULL,
                    is_currently_on_break TINYINT(1) DEFAULT 0,
                    last_break_calculation DOUBLE DEFAULT 0,
                    max_break_time_allowed INT DEFAULT 300,
                    total_break_time_used INT DEFAULT 0,
                    last_face_movement_time DOUBLE DEFAULT 0,
                    inactivity_popup_shown TINYINT(1) DEFAULT 0,
                    last_popup_time DOUBLE DEFAULT 0,
                    total_session_time INT DEFAULT 0,
                    active_participation_time INT DEFAULT 0,
                    violation_severity_score DOUBLE DEFAULT 0,
                    last_violation_type VARCHAR(50) DEFAULT '',
                    continuous_violation_time INT DEFAULT 0,
                    focus_score DECIMAL(5,2) DEFAULT 100.00,
                    identity_warning_count INT DEFAULT 0 COMMENT 'Number of identity verification warnings (0-3)',
                    identity_consecutive_unknown_seconds INT DEFAULT 0 COMMENT 'Consecutive seconds of unknown person detection',
                    identity_total_unknown_seconds INT DEFAULT 0 COMMENT 'Total seconds of unknown person detection in session',
                    identity_is_removed TINYINT(1) DEFAULT 0 COMMENT 'Whether user was removed due to identity verification failure',
                    identity_removal_time DATETIME DEFAULT NULL COMMENT 'Timestamp when user was removed due to identity failure',
                    identity_can_rejoin TINYINT(1) DEFAULT 1 COMMENT 'Whether user can rejoin after identity removal',
                    identity_warnings TEXT COMMENT 'JSON array of identity warning events with timestamps',
                    identity_last_check_time DOUBLE DEFAULT 0 COMMENT 'Unix timestamp of last identity verification check',
                    identity_removal_count INT NOT NULL DEFAULT 0 COMMENT 'Number of times removed from meeting due to identity verification failure',
                    identity_total_warnings_issued INT NOT NULL DEFAULT 0 COMMENT 'Total identity warnings issued across all sessions (cumulative: 1,2,3,4,5...)',
                    identity_current_cycle_warnings INT NOT NULL DEFAULT 0 COMMENT 'Identity warnings in current cycle (resets to 0 after removal, shows as 0-3)',
                    behavior_removal_count INT NOT NULL DEFAULT 0 COMMENT 'Number of times removed from meeting due to 2-minute continuous behavior violations',
                    continuous_violation_removal_count INT NOT NULL DEFAULT 0,
                    KEY idx_meeting_id (Meeting_ID),
                    KEY idx_user_id (User_ID),
                    KEY idx_session_active (session_active),
                    KEY idx_created_at (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_Attendance_Sessions;",
        ),

        # ──────────────────────────────────────────────
        # 13. tbl_Feedback (depends on tbl_Meetings, tbl_Users)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS tbl_Feedback (
                    ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_Feedback;",
        ),

        # ──────────────────────────────────────────────
        # 14. tbl_Notifications (depends on tbl_Meetings)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS tbl_Notifications (
                    id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
                    recipient_email VARCHAR(255) NOT NULL,
                    meeting_id VARCHAR(20) DEFAULT NULL,
                    notification_type VARCHAR(50) NOT NULL,
                    title VARCHAR(255) DEFAULT NULL,
                    message TEXT,
                    meeting_title VARCHAR(255) DEFAULT NULL,
                    start_time DATETIME DEFAULT NULL,
                    meeting_url VARCHAR(500) DEFAULT NULL,
                    is_read TINYINT(1) DEFAULT 0,
                    priority VARCHAR(20) DEFAULT 'normal',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    KEY idx_recipient_email (recipient_email),
                    KEY idx_meeting_id (meeting_id),
                    KEY idx_created_at (created_at),
                    KEY idx_is_read (is_read),
                    CONSTRAINT FK_Notifications_Meetings FOREIGN KEY (meeting_id) REFERENCES tbl_Meetings (ID) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_Notifications;",
        ),

        # ──────────────────────────────────────────────
        # 15. tbl_ScheduledReminders (depends on tbl_Meetings)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS tbl_ScheduledReminders (
                    id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
                    meeting_id VARCHAR(20) NOT NULL,
                    recipient_email VARCHAR(255) NOT NULL,
                    reminder_time DATETIME NOT NULL,
                    notification_data TEXT,
                    is_sent TINYINT(1) DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    KEY idx_reminder_time (reminder_time),
                    KEY idx_meeting_id (meeting_id),
                    KEY idx_is_sent (is_sent),
                    CONSTRAINT FK_Reminders_Meetings FOREIGN KEY (meeting_id) REFERENCES tbl_Meetings (ID) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_ScheduledReminders;",
        ),

        # ──────────────────────────────────────────────
        # 16. recording_metadata (no FK)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS recording_metadata (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    meeting_id CHAR(36) NOT NULL,
                    filename VARCHAR(255) NOT NULL,
                    file_path VARCHAR(500) NOT NULL,
                    file_size BIGINT DEFAULT 0,
                    duration INT DEFAULT 0,
                    recording_type VARCHAR(50) DEFAULT 'livekit',
                    status VARCHAR(50) DEFAULT 'processing',
                    egress_id VARCHAR(100) DEFAULT NULL,
                    start_time DATETIME DEFAULT NULL,
                    end_time DATETIME DEFAULT NULL,
                    upload_time DATETIME DEFAULT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    KEY idx_meeting_id (meeting_id),
                    KEY idx_status (status),
                    KEY idx_recording_type (recording_type)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            """,
            reverse_sql="DROP TABLE IF EXISTS recording_metadata;",
        ),

        # ──────────────────────────────────────────────
        # 17. tbl_livekit_chat_messages (depends on tbl_Meetings, tbl_Users)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS tbl_livekit_chat_messages (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    message_id CHAR(36) DEFAULT NULL UNIQUE,
                    meeting_id VARCHAR(20) NOT NULL,
                    user_id INT NOT NULL,
                    user_name VARCHAR(255) NOT NULL,
                    message TEXT NOT NULL,
                    message_type ENUM('public','private') DEFAULT 'public',
                    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    KEY idx_meeting_timestamp (meeting_id, timestamp),
                    KEY idx_user_id (user_id),
                    CONSTRAINT fk_chat_meeting FOREIGN KEY (meeting_id) REFERENCES tbl_Meetings (ID) ON DELETE CASCADE,
                    CONSTRAINT fk_chat_user FOREIGN KEY (user_id) REFERENCES tbl_Users (ID) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_livekit_chat_messages;",
        ),

        # ──────────────────────────────────────────────
        # 18. tbl_livekit_typing_indicators (depends on tbl_Meetings, tbl_Users)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS tbl_livekit_typing_indicators (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    meeting_id VARCHAR(20) NOT NULL,
                    user_id INT NOT NULL,
                    user_name VARCHAR(255) NOT NULL,
                    is_typing TINYINT(1) DEFAULT 0,
                    last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_user_meeting (meeting_id, user_id),
                    KEY idx_meeting_typing (meeting_id, is_typing),
                    KEY fk_typing_user (user_id),
                    CONSTRAINT fk_typing_meeting FOREIGN KEY (meeting_id) REFERENCES tbl_Meetings (ID) ON DELETE CASCADE,
                    CONSTRAINT fk_typing_user FOREIGN KEY (user_id) REFERENCES tbl_Users (ID) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_livekit_typing_indicators;",
        ),

        # ──────────────────────────────────────────────
        # 19. whiteboard_custom_templates (depends on tbl_Users)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS whiteboard_custom_templates (
                    id VARCHAR(100) NOT NULL PRIMARY KEY,
                    user_id INT NOT NULL,
                    name VARCHAR(200) NOT NULL,
                    description TEXT,
                    category VARCHAR(50) NOT NULL DEFAULT 'custom',
                    thumbnail VARCHAR(100) NOT NULL DEFAULT 'custom',
                    tags JSON DEFAULT NULL,
                    canvas_width INT NOT NULL DEFAULT 1000,
                    canvas_height INT NOT NULL DEFAULT 600,
                    elements JSON DEFAULT NULL,
                    is_public TINYINT(1) NOT NULL DEFAULT 0,
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    use_count INT NOT NULL DEFAULT 0,
                    original_template_id VARCHAR(100) DEFAULT NULL,
                    is_cloned TINYINT(1) NOT NULL DEFAULT 0,
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    KEY idx_user_id (user_id),
                    KEY idx_category (category),
                    KEY idx_is_public (is_public),
                    KEY idx_is_active (is_active),
                    KEY idx_created_at (created_at),
                    KEY idx_use_count (use_count),
                    CONSTRAINT fk_whiteboard_templates_user FOREIGN KEY (user_id) REFERENCES tbl_Users (ID) ON DELETE CASCADE ON UPDATE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """,
            reverse_sql="DROP TABLE IF EXISTS whiteboard_custom_templates;",
        ),

        # ──────────────────────────────────────────────
        # 20. tbl_payment_transactions (depends on tbl_payment_orders, tbl_Users)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_payment_transactions;",
        ),

        # ──────────────────────────────────────────────
        # 21. tbl_payment_events (no FK)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS tbl_payment_events (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    razorpay_event_id VARCHAR(50) NOT NULL UNIQUE COMMENT 'event_xxx from Razorpay',
                    event_type VARCHAR(100) NOT NULL COMMENT 'payment.captured/payment.failed/refund.processed',
                    razorpay_payment_id VARCHAR(50) DEFAULT NULL,
                    razorpay_order_id VARCHAR(50) DEFAULT NULL,
                    payload JSON NOT NULL COMMENT 'Complete webhook payload for debugging',
                    processed TINYINT(1) DEFAULT 0 COMMENT 'Has this event been processed',
                    processed_at DATETIME DEFAULT NULL,
                    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    KEY idx_event_type (event_type),
                    KEY idx_processed (processed),
                    KEY idx_payment_id (razorpay_payment_id),
                    KEY idx_order_id (razorpay_order_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_payment_events;",
        ),

        # ──────────────────────────────────────────────
        # 22. tbl_invoices (depends on tbl_payment_transactions, tbl_Users)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS tbl_invoices (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    invoice_number VARCHAR(100) NOT NULL UNIQUE COMMENT 'Unique invoice number (e.g., iMeetPro-INV-2026-01-0007)',
                    transaction_id INT NOT NULL COMMENT 'Foreign key to tbl_payment_transactions',
                    user_id INT NOT NULL COMMENT 'Foreign key to tbl_Users',
                    customer_name VARCHAR(100) NOT NULL,
                    customer_email VARCHAR(100) NOT NULL,
                    customer_state VARCHAR(100) NOT NULL COMMENT 'Customer billing state for GST',
                    plan_name VARCHAR(50) NOT NULL,
                    plan_type ENUM('basic','pro','pro_max') NOT NULL,
                    billing_period ENUM('monthly','yearly') NOT NULL,
                    base_price DECIMAL(10,2) NOT NULL COMMENT 'Price before GST',
                    gst_rate DECIMAL(5,2) NOT NULL COMMENT 'GST percentage applied',
                    gst_amount DECIMAL(10,2) NOT NULL COMMENT 'GST amount',
                    total_price DECIMAL(10,2) NOT NULL COMMENT 'Total with GST',
                    currency VARCHAR(3) DEFAULT 'INR',
                    gst_type ENUM('INTRASTATE','INTERSTATE') NOT NULL COMMENT 'Type of GST applied',
                    cgst DECIMAL(10,2) DEFAULT 0.00 COMMENT 'CGST amount (intrastate only)',
                    sgst DECIMAL(10,2) DEFAULT 0.00 COMMENT 'SGST amount (intrastate only)',
                    igst DECIMAL(10,2) DEFAULT 0.00 COMMENT 'IGST amount (interstate only)',
                    invoice_s3_url VARCHAR(500) NOT NULL COMMENT 'S3 path to PDF file',
                    invoice_mongodb_id VARCHAR(50) NOT NULL COMMENT 'MongoDB ObjectId for full invoice data',
                    invoice_status ENUM('GENERATED','EMAILED','FAILED') DEFAULT 'GENERATED',
                    email_sent TINYINT(1) DEFAULT 0 COMMENT '1 if email sent successfully',
                    email_sent_at DATETIME DEFAULT NULL COMMENT 'When email was sent',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    KEY idx_transaction_id (transaction_id),
                    KEY idx_user_id (user_id),
                    KEY idx_invoice_number (invoice_number),
                    KEY idx_invoice_status (invoice_status),
                    KEY idx_created_at (created_at),
                    KEY idx_customer_email (customer_email),
                    CONSTRAINT tbl_invoices_ibfk_1 FOREIGN KEY (transaction_id) REFERENCES tbl_payment_transactions (id) ON DELETE CASCADE,
                    CONSTRAINT tbl_invoices_ibfk_2 FOREIGN KEY (user_id) REFERENCES tbl_Users (ID) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores invoice metadata and references to S3/MongoDB';
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_invoices;",
        ),

        # ──────────────────────────────────────────────
        # 23. tbl_user_subscriptions (depends on tbl_Users, tbl_payment_transactions, tbl_payment_orders, tbl_invoices, tbl_Plans)
        # ──────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS tbl_user_subscriptions (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    transaction_id INT NOT NULL,
                    order_id INT NOT NULL,
                    invoice_id INT DEFAULT NULL,
                    plan_id INT NOT NULL,
                    plan_name VARCHAR(50) NOT NULL,
                    plan_type ENUM('basic','pro','pro_max') NOT NULL,
                    billing_period ENUM('monthly','yearly') NOT NULL,
                    subscription_start_date DATE NOT NULL COMMENT 'When subscription starts',
                    subscription_end_date DATE NOT NULL COMMENT 'When subscription expires',
                    duration_days INT NOT NULL COMMENT 'Total subscription duration (30 or 365 days)',
                    subscription_status ENUM('ACTIVE','EXPIRED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
                    base_price DECIMAL(10,2) NOT NULL COMMENT 'Base price before GST',
                    gst_amount DECIMAL(10,2) NOT NULL COMMENT 'GST amount',
                    total_price DECIMAL(10,2) NOT NULL COMMENT 'Total amount paid',
                    currency VARCHAR(3) DEFAULT 'INR',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    KEY idx_user_id (user_id),
                    KEY idx_transaction_id (transaction_id),
                    KEY idx_subscription_status (subscription_status),
                    KEY idx_subscription_end_date (subscription_end_date),
                    KEY idx_user_status (user_id, subscription_status) COMMENT 'Find user active subscription fast',
                    KEY order_id (order_id),
                    KEY invoice_id (invoice_id),
                    KEY plan_id (plan_id),
                    CONSTRAINT tbl_user_subscriptions_ibfk_1 FOREIGN KEY (user_id) REFERENCES tbl_Users (ID) ON DELETE CASCADE,
                    CONSTRAINT tbl_user_subscriptions_ibfk_2 FOREIGN KEY (transaction_id) REFERENCES tbl_payment_transactions (id) ON DELETE CASCADE,
                    CONSTRAINT tbl_user_subscriptions_ibfk_3 FOREIGN KEY (order_id) REFERENCES tbl_payment_orders (id) ON DELETE CASCADE,
                    CONSTRAINT tbl_user_subscriptions_ibfk_4 FOREIGN KEY (invoice_id) REFERENCES tbl_invoices (id) ON DELETE SET NULL,
                    CONSTRAINT tbl_user_subscriptions_ibfk_5 FOREIGN KEY (plan_id) REFERENCES tbl_Plans (id) ON DELETE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='User subscription tracking with auto-expiry management';
            """,
            reverse_sql="DROP TABLE IF EXISTS tbl_user_subscriptions;",
        ),

    ]