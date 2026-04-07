# iMeetPro — Microservices Platform

**AI-Powered Enterprise Video Conferencing**

> Version: 10-03-2026 | Python 3.10 | Django 5.0.14 | Docker Compose

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Architecture](#architecture)
3. [Services & Port Map](#services--port-map)
4. [Infrastructure Dependencies](#infrastructure-dependencies)
5. [Service Descriptions](#service-descriptions)
6. [API Reference](#api-reference)
7. [Environment Configuration](#environment-configuration)
8. [Deployment](#deployment)
9. [Health Checks](#health-checks)
10. [Troubleshooting](#troubleshooting)

---

## Platform Overview

iMeetPro is an AI-powered enterprise video conferencing platform built on a microservices architecture. It provides real-time video meetings via LiveKit, AI-based face authentication and attendance monitoring, collaborative whiteboard, in-meeting chat/reactions/hand-raise (all cache-backed via Redis), video recording with subtitle generation (English/Hindi/Telugu), transcript and summary generation, PDF analytics reports, and a comprehensive dashboard.

The system is composed of **8 independently deployable services** behind an Nginx reverse proxy, with a Celery GPU worker handling asynchronous video processing (transcription, subtitles, summaries) and APScheduler managing periodic tasks (participant polling, room cleanup).

---

## Architecture

```
                          ┌──────────────────────┐
                          │   Nginx (443/80)     │
                          │   Reverse Proxy      │
                          │   SSL Termination    │
                          └──────────┬───────────┘
                                     │
         ┌───────────┬───────────┬───┴───┬───────────┬───────────┬───────────┐
         │           │           │       │           │           │           │
    ┌────▼───┐ ┌─────▼──┐ ┌─────▼──┐ ┌──▼──┐ ┌─────▼──┐ ┌─────▼──┐ ┌─────▼──┐
    │  User  │ │Meeting │ │ Face   │ │Attn.│ │Record.│ │Analyt.│ │ White- │
    │ :8234  │ │ Core   │ │ Auth   │ │:8233│ │ :8236 │ │ :8231 │ │ board  │
    │        │ │ :8235  │ │ :8232  │ │     │ │ [GPU] │ │       │ │ :8230  │
    └───┬────┘ └───┬────┘ └───┬────┘ └──┬──┘ └───┬───┘ └───┬───┘ └───┬───┘
        │          │          │         │        │         │         │
        ▼          ▼          ▼         ▼        ▼         ▼         ▼
   ┌─────────┐ ┌──────┐ ┌──────────┐ ┌──────┐ ┌─────┐
   │  MySQL  │ │Redis │ │ MongoDB  │ │  S3  │ │Live │
   │  (RDS)  │ │      │ │          │ │(AWS) │ │Kit  │
   └─────────┘ └──────┘ └──────────┘ └──────┘ └─────┘
```

**Inter-service communication:**

- **user-service → face-auth-service** — face registration, embedding generation, face login
- **attendance-service → face-auth-service** — real-time face verification during meetings
- **meeting-core-service → attendance-service** — start/stop attendance tracking with meetings
- **meeting-core-service → recording-service** — trigger recording start/stop
- **recording-service → meeting-core-service** — notification callbacks on recording completion

---

## Services & Port Map

| # | Service | Container Name | Port | Base Image | GPU |
|---|---------|---------------|------|------------|-----|
| 1 | Whiteboard | `imeetpro-whiteboard` | 8230 | python:3.10-slim | No |
| 2 | Analytics & Feedback | `imeetpro-analytics` | 8231 | python:3.10-slim | No |
| 3 | Face Auth | `imeetpro-face-auth` | 8232 | nvidia/cuda:12.1.1-runtime-ubuntu22.04 | **Yes** |
| 4 | Attendance | `imeetpro-attendance` | 8233 | python:3.10-slim | No |
| 5 | User | `imeetpro-user` | 8234 | python:3.10-slim | No |
| 6 | Meeting Core | `imeetpro-meeting-core` | 8235 | python:3.10-slim | No |
| 6b | Meeting Core Celery Worker | `imeetpro-meeting-core-celery` | — | (same as 6) | No |
| 6c | Meeting Core Celery Beat | `imeetpro-meeting-core-beat` | — | (same as 6) | No |
| 7 | Recording | `imeetpro-recording` | 8236 | nvidia/cuda:12.1.1-runtime-ubuntu22.04 | **Yes** |
| 7b | Recording Celery Worker | `imeetpro-recording-celery` | — | (same as 7) | **Yes** |
| — | Nginx Reverse Proxy | `imeetpro-nginx` | 80, 443 | nginx:alpine | No |

**Total containers: 10** (7 API services + 2 Celery workers + 1 Celery beat + 1 Nginx)

---

## Infrastructure Dependencies

| Component | Purpose | Used By |
|-----------|---------|---------|
| **MySQL (RDS)** | Relational data — users, meetings, participants, recordings, analytics, feedback, whiteboard | All services except face-auth |
| **MongoDB** | Face embeddings, verification sessions, verification logs | face-auth-service, user-service, recording-service |
| **Redis** | Cache-only chat, reactions, hand-raise, attendance sessions, Celery broker/backend, whiteboard state | meeting-core, attendance, whiteboard, recording |
| **AWS S3** | Profile photos, face registration images, video recordings, generated documents | user-service, face-auth, recording-service |
| **LiveKit** | Real-time video/audio infrastructure, WebRTC SFU | meeting-core, recording-service |
| **SMTP** | Email notifications, meeting invitations, password reset | All services |
| **NVIDIA GPU** | InsightFace (ONNX Runtime GPU), video processing, AI subtitle/transcript generation | face-auth, recording |

---

## Service Descriptions

### 1. Whiteboard Service (`:8230`)

Collaborative real-time whiteboard backed by Redis. Supports drawing operations, text annotations, undo/redo with checkpoint-based history navigation, item selection/deletion/movement, and per-meeting session management.

**Key modules:** `whiteboard/whiteboard.py`

### 2. Analytics & Feedback Service (`:8231`)

Meeting analytics, dashboard statistics, participant reports, and PDF report generation (via ReportLab). Also hosts the feedback system (CRUD, per-user, per-meeting, aggregate stats) and timezone utilities.

**Key modules:** `analytics/Analytics.py`, `feedback/feedback.py`

### 3. Face Auth Service (`:8232`) — GPU Required

Core face recognition engine using InsightFace with ONNX Runtime GPU inference. Handles face verification (one-shot and continuous), session management for ongoing verification, enhanced attendance detection with camera state monitoring, face validation, and embedding processing. Stores embeddings and sessions in MongoDB.

**Key modules:** `auth/face_auth.py`, `auth/face_model_shared.py`, `verification/unified_face_service.py`, `verification/meeting_continuous_verification.py`, `embeddings/face_embeddings.py`

### 4. Attendance Service (`:8233`)

Real-time attendance tracking during meetings. Monitors participant presence via periodic frame analysis, detects violations (e.g., phone usage, absence), manages break periods, and handles camera pause/resume verification. Uses MediaPipe for pose detection and communicates with face-auth-service for identity verification. Sessions stored in Redis.

**Key modules:** `attendance/Attendance.py`, `attendance/session_manager.py`, `attendance/mediapipe_pool.py`, `attendance/periodic_saver.py`, `clients/face_auth_client.py`

**Models shipped:** Haar cascades (face, eyes, smile), shape predictor 68 landmarks, YOLOv8l-pose

### 5. User Service (`:8234`)

User lifecycle management — registration, login (email/password + face recognition), password management (forgot/reset/change/verify), profile CRUD, profile photo management (upload, update, delete, active photo selection) with S3 storage, face embedding registration and regeneration, and admin embedding statistics.

**Key modules:** `users/users.py`, `clients/face_auth_client.py`

### 6. Meeting Core Service (`:8235`)

The central orchestrator for all meeting operations:

- **Meetings** — three types: Instant, Scheduled, Calendar. Full CRUD, waiting room, connection queue management.
- **LiveKit integration** — join/leave meetings, generate LiveKit tokens, participant status updates, event recording.
- **Participants** — join/leave tracking, live participant lists, LiveKit sync, co-host assignment, participant removal, meeting history.
- **Chat** — Redis-backed in-meeting chat with file uploads (S3), typing indicators, message history, file management.
- **Reactions** — Redis-backed emoji reactions with counts, active reaction tracking.
- **Hand Raise** — Redis-backed hand raise/acknowledge system with status checks.
- **Notifications** — user notifications, read/unread counts, reminder processing.
- **Invitations** — bulk email invitations for meetings.
- **Scheduling** — recurring meeting processing, email scheduling (APScheduler + Celery Beat), participant polling, trash cleanup.

**Key modules:** `meetings/meetings.py`, `participants/participants.py`, `chat/chat_messages.py`, `reactions/reactions.py`, `hand_raise/cache_only_hand_raise.py`, `notifications/notifications.py`, `scheduler/recurring_scheduler.py`

**Celery workers:** 4 concurrency for async tasks. Beat scheduler for periodic jobs.

### 7. Recording Service (`:8236`) — GPU Required

Video recording and AI-powered post-processing:

- **Stream recording** — custom LiveKit SDK bot (`FixedRecordingBot`) joins the room as a participant via the `livekit.rtc` real-time client, subscribes to audio/video tracks (`rtc.VideoStream`, `rtc.AudioStream`), writes frames to local temp files via ffmpeg subprocess pipes (raw frames → H.264 video, PCM → WAV audio), and simultaneously uploads to S3 using multipart chunked upload (5MB chunks via `S3ChunkUploader`). Supports pause/resume. No file size limit — recordings grow until stopped.
- **Video management** — full CRUD, streaming, trash/restore/permanent delete.
- **AI processing** — transcript generation, summary generation, subtitle generation (English/Hindi/Telugu via deep-translator), mind map generation (Graphviz), document generation (python-docx).
- **Upload** — single file upload, blob upload, multipart recording upload to S3.

Uses LiveKit real-time client SDK (not Egress) for room-level recording, OpenAI and Groq APIs for AI features, Transformers + PyTorch for on-device processing, ffmpeg for audio/video manipulation, and S3 multipart upload for chunked storage.

**Key modules:** `stream_recording/recording_service.py`, `video_processing/recordings.py`, `tasks/video_tasks.py`

**Celery workers:** 2 concurrency on `video_processing` queue with GPU access.

### Admin Billing Service (Not in deployment package)

Listed in the project structure but **not included in this deployment package**. Covers company management, invoices, payments (events, orders, transactions), subscription plans, and super admin operations. Deploy separately when ready.

---

## API Reference

All endpoints are accessed through the Nginx gateway at `https://<host>/api/...`

### User Service — `/api/auth/`, `/api/user/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/face-login/` | Face recognition login |
| POST | `/api/auth/forgot-password` | Trigger password reset email |
| POST | `/api/auth/reset-password` | Reset password with token |
| POST | `/api/auth/verify-password/` | Verify current password |
| POST | `/api/auth/change-password/` | Change password |
| POST | `/api/auth/validate-email/` | Validate email availability |
| PUT | `/api/auth/update-profile/<id>/` | Update user profile |
| POST | `/api/user/add` | Admin add user |
| GET | `/api/user/lists` | List all users |
| GET | `/api/user/list/<id>` | Get user by ID |
| DELETE | `/api/user/remove/<id>` | Delete user |
| POST | `/api/user/validate` | Validate user data |
| GET | `/api/user/profile/<user_id>/` | Get full user profile |
| GET | `/api/profile-photo/<photo_id>/` | Get profile photo by photo ID |
| GET | `/api/user-photo/<user_id>/` | Get user's profile photo |
| PUT | `/api/update-photo/<user_id>/` | Update profile photo |
| DELETE | `/api/delete-photo/<user_id>/` | Delete profile photo |
| GET | `/api/user-active-photo/<user_id>/` | Get active profile photo |
| GET | `/api/user/verify-face/<user_id>/` | Verify user's face |
| GET | `/api/user/embeddings/<user_id>/` | Get user's face embeddings |
| POST | `/api/user/regenerate-embedding/<user_id>/` | Regenerate face embedding |
| GET | `/api/admin/embedding-stats/` | Admin embedding statistics |

### Meeting Core — `/api/meetings/`, `/api/livekit/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/meetings/instant-meeting` | Create instant meeting |
| POST | `/api/meetings/schedule-meeting` | Create scheduled meeting |
| POST | `/api/meetings/calendar-meeting` | Create calendar meeting |
| GET | `/api/meetings/list` | List all meetings |
| GET | `/api/meetings/get/<id>` | Get meeting details |
| PUT | `/api/meetings/update/<id>` | Update meeting |
| DELETE | `/api/meetings/delete/<id>` | Delete meeting |
| GET | `/api/meetings/schedule-meetings` | Get scheduled meetings |
| GET | `/api/meetings/user-schedule-meetings` | Get user's scheduled meetings |
| GET | `/api/meetings/user-calendar-meetings` | Get user's calendar meetings |
| POST | `/api/meetings/<id>/allow-from-waiting-room` | Admit from waiting room |
| POST | `/api/meetings/join-with-queue/` | Join meeting with queue |
| GET | `/api/meetings/check-queue/<meeting_id>/` | Check connection queue |
| POST | `/api/meetings/<meeting_id>/end` | End meeting |
| POST | `/api/livekit/join-meeting/` | Join LiveKit room, get token |
| POST | `/api/livekit/leave-meeting/` | Leave LiveKit room |
| GET | `/api/livekit/participants/<meeting_id>/` | Get meeting participants |
| GET | `/api/livekit/connection-info/<meeting_id>/` | Get LiveKit connection info |
| POST | `/api/livekit/update-status/` | Update participant status |
| POST | `/api/livekit/record-event/` | Record meeting event |

### Participants — `/api/participants/`, `/api/meetings/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/participants/record-join/` | Record participant join |
| POST | `/api/participants/record-leave/` | Record participant leave |
| GET | `/api/participants/live-enhanced/<meeting_id>/` | Get live participants (enhanced) |
| GET | `/api/participants/sync-optimized/<meeting_id>/` | Sync with LiveKit participants |
| GET | `/api/participants/list/<meeting_id>/` | List participants (basic) |
| DELETE | `/api/participants/leave/<participant_id>/` | Leave meeting |
| POST | `/api/meetings/assign-cohost/` | Assign co-host |
| POST | `/api/meetings/remove-cohost/` | Remove co-host |
| GET | `/api/meetings/cohosts/<meeting_id>/` | Get co-hosts |
| GET | `/api/meetings/check-cohost/<meeting_id>/<user_id>/` | Check co-host status |
| GET | `/api/meetings/user-meeting-history` | Get user meeting history |
| GET | `/api/meetings/user-meetings-by-date` | Get meetings by date |
| GET | `/api/meetings/user-today-meetings` | Get today's meetings |
| POST | `/api/meetings/remove-participant/` | Remove participant from meeting |
| POST | `/api/invitations/bulk-send` | Bulk send meeting invitations |

### Chat — `/api/cache-chat/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cache-chat/start/` | Initialize chat for meeting |
| POST | `/api/cache-chat/send/` | Send message |
| POST | `/api/cache-chat/upload/` | Upload file to chat |
| GET | `/api/cache-chat/files/<file_id>/` | Download chat file |
| GET | `/api/cache-chat/meeting-files/<meeting_id>/` | List meeting files |
| DELETE | `/api/cache-chat/delete-file/<meeting_id>/<file_id>/` | Delete chat file |
| GET | `/api/cache-chat/history/<meeting_id>/` | Get chat history |
| POST | `/api/cache-chat/typing/` | Update typing indicator |
| GET | `/api/cache-chat/typing-users/<meeting_id>/` | Get typing users |
| POST | `/api/cache-chat/end/` | End meeting chat |
| GET | `/api/cache-chat/stats/<meeting_id>/` | Get chat stats |
| GET | `/api/cache-chat/supported-types/` | Get supported file types |
| POST | `/api/cache-chat/cleanup/` | Cleanup expired meetings |

### Reactions — `/api/cache-reactions/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cache-reactions/start/` | Initialize reactions for meeting |
| POST | `/api/cache-reactions/add/` | Add reaction |
| POST | `/api/cache-reactions/clear-all/` | Clear all reactions |
| GET | `/api/cache-reactions/active/<meeting_id>/` | Get active reactions |
| GET | `/api/cache-reactions/counts/<meeting_id>/` | Get reaction counts |
| POST | `/api/cache-reactions/end/` | End meeting reactions |
| GET | `/api/cache-reactions/stats/<meeting_id>/` | Get reaction stats |
| GET | `/api/cache-reactions/allowed/` | Get allowed reaction types |

### Hand Raise — `/api/cache-hand-raise/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cache-hand-raise/start/` | Initialize hand raise for meeting |
| POST | `/api/cache-hand-raise/raise/` | Raise hand |
| POST | `/api/cache-hand-raise/acknowledge/` | Acknowledge raised hand |
| POST | `/api/cache-hand-raise/clear-all/` | Clear all hands |
| GET | `/api/cache-hand-raise/hands/<meeting_id>/` | Get raised hands |
| POST | `/api/cache-hand-raise/sync/` | Sync hand raise state |
| POST | `/api/cache-hand-raise/end/` | End hand raise session |
| GET | `/api/cache-hand-raise/stats/<meeting_id>/` | Get hand raise stats |
| GET | `/api/cache-hand-raise/check/<meeting_id>/<user_id>/` | Check user's hand status |

### Notifications — `/api/notifications/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications/` | Get user notifications |
| GET | `/api/notifications/count/` | Get unread count |
| POST | `/api/notifications/mark-read/` | Mark as read |
| POST | `/api/notifications/mark-all-read/` | Mark all as read |
| DELETE | `/api/notifications/delete/` | Delete notification |
| POST | `/api/notifications/process-reminders/` | Process reminder notifications |

### Face Auth — `/api/face/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/face/verify` | One-shot face verification |
| POST | `/api/face/continuous-verify` | Continuous face verification |
| POST | `/api/face/validate` | Validate face image |
| POST | `/api/face/process-embedding` | Process face embedding |
| POST | `/api/face/session/create` | Create verification session |
| POST | `/api/face/session/<session_id>/end` | End verification session |
| GET | `/api/face/session/<session_id>/status` | Get session status |
| POST | `/api/attendance/detect/` | Enhanced attendance detection |
| GET | `/api/user/<user_id>/status` | Get user verification status |
| GET | `/api/stats` | Get face auth statistics |

### Attendance — `/api/attendance/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/attendance/start/` | Start attendance tracking |
| POST | `/api/attendance/stop/` | Stop attendance tracking |
| POST | `/api/attendance/detect/` | Detect violations |
| POST | `/api/attendance/break/` | Take break |
| GET | `/api/attendance/status/` | Get attendance status |
| POST | `/api/attendance/pause-resume/` | Pause/resume attendance |
| POST | `/api/attendance/verify-camera/` | Verify camera resumed |

### Recording — `/api/stream-recording/`, `/api/videos/`, `/api/recordings/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/meetings/<id>/start-recording` | Start recording |
| POST | `/api/meetings/<id>/stop-recording` | Stop recording |
| POST | `/api/stream-recording/start/<meeting_id>` | Start stream recording |
| POST | `/api/stream-recording/stop/<meeting_id>` | Stop stream recording |
| GET | `/api/stream-recording/status/<meeting_id>` | Get recording status |
| GET | `/api/stream-recording/list-active` | List active recordings |
| POST | `/api/stream-recording/pause/<meeting_id>` | Pause recording |
| POST | `/api/stream-recording/resume/<meeting_id>` | Resume recording |
| GET | `/api/videos/lists` | List all videos |
| GET | `/api/videos/list-detailed` | List videos (detailed) |
| GET | `/api/videos/<id>` | Get video by ID |
| PUT | `/api/videos/update/<id>` | Update video metadata |
| DELETE | `/api/videos/remove/<id>` | Delete video |
| GET | `/api/videos/stream/<id>` | Stream video |
| GET | `/api/videos/document/<id>/<doc_type>` | Get generated document |
| GET | `/api/videos/<id>/mindmap` | Get mind map |
| GET | `/api/videos/<id>/subtitles/<lang>` | Get subtitles (en/hi/te) |
| GET | `/api/videos/transcript-content/<id>` | Get transcript |
| GET | `/api/videos/summary-content/<id>` | Get AI summary |
| POST | `/api/videos/upload-recording` | Upload recording |
| POST | `/api/recordings/upload-blob` | Upload recording blob |
| POST | `/api/upload-single/` | Upload single file |
| POST | `/api/recordings/start-with-metadata/<id>` | Start recording with metadata |
| POST | `/api/recordings/stop-and-finalize/<id>` | Stop and finalize recording |
| GET | `/api/recordings/status/<meeting_id>` | Get recording status |
| POST | `/api/recordings/trash/<id>` | Move to trash |
| GET | `/api/videos/trash/list` | List trash videos |
| POST | `/api/videos/restore/<id>` | Restore from trash |
| DELETE | `/api/videos/permanent-delete/<id>` | Permanent delete |
| POST | `/api/recordings/store-custom-name` | Store custom recording name |

### Analytics & Feedback — `/api/analytics/`, `/api/feedback/`, `/api/dashboard/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/meetings/host/<user_id>/` | Get host's meetings |
| GET | `/api/meetings/participant/<user_id>/` | Get participant's meetings |
| GET | `/api/meetings/<meeting_id>/participants/` | Get meeting participants |
| GET | `/api/meetings/<meeting_id>/participants/download-pdf/` | Download participants PDF |
| GET | `/api/meetings/<meeting_id>/participants/<user_id>/report/pdf/` | Participant report PDF |
| GET | `/api/meetings/<meeting_id>/participants/<user_id>/report/` | Participant report JSON |
| GET | `/api/analytics/meeting-times` | Available meeting times |
| GET | `/api/dashboard/quick-stats/` | Dashboard quick stats |
| GET | `/api/analytics/host/overview` | Host dashboard overview |
| GET | `/api/analytics/participant/overview` | Participant dashboard overview |
| GET | `/api/analytics/comprehensive` | Comprehensive analytics |
| POST | `/api/feedback/create` | Create feedback |
| GET | `/api/feedback/feedbacks` | List all feedback |
| GET | `/api/feedback/feedback/<id>` | Get feedback |
| PUT | `/api/feedback/update/<id>` | Update feedback |
| DELETE | `/api/feedback/delete/<id>` | Delete feedback |
| POST | `/api/feedback/validate` | Validate feedback data |
| GET | `/api/feedback/user/<user_id>` | Get feedback by user |
| GET | `/api/feedback/meeting/<meeting_id>` | Get feedback by meeting |
| GET | `/api/feedback/stats` | Get feedback statistics |
| GET | `/api/feedback/timezones` | Get supported timezones |

### Whiteboard — `/api/whiteboard/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/whiteboard/create-session/` | Create whiteboard session |
| GET | `/api/whiteboard/state/<meeting_id>/` | Get whiteboard state |
| PUT | `/api/whiteboard/update-settings/` | Update settings |
| POST | `/api/whiteboard/add-drawing/` | Add drawing |
| POST | `/api/whiteboard/clear/` | Clear whiteboard |
| POST | `/api/whiteboard/undo/` | Undo |
| POST | `/api/whiteboard/redo/` | Redo |
| POST | `/api/whiteboard/create-checkpoint/` | Create checkpoint |
| POST | `/api/whiteboard/navigate-to-state/` | Navigate to state |
| GET | `/api/whiteboard/history/<meeting_id>/` | Get history |
| POST | `/api/whiteboard/add-text/` | Add text |
| PUT | `/api/whiteboard/update-text/` | Update text |
| POST | `/api/whiteboard/select-items/` | Select items |
| DELETE | `/api/whiteboard/delete-selected/` | Delete selected |
| POST | `/api/whiteboard/move-selected/` | Move selected |
| GET | `/api/whiteboard/cache-status/` | Get cache status |

---

## Environment Configuration

Each service requires a `.env` file in its directory. Below is the complete set of environment variables used across the platform.

### Common Variables (all services)

```env
DJANGO_SECRET_KEY=<strong-random-key>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=*

# Database (MySQL)
DB_HOST=<rds-endpoint>
DB_PORT=3306
DB_NAME=<database-name>
DB_USER=<db-user>
DB_PASSWORD=<db-password>

# Email / SMTP
EMAIL_HOST=<smtp-server>
EMAIL_PORT=587
EMAIL_HOST_USER=<smtp-user>
EMAIL_HOST_PASSWORD=<smtp-password>
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=noreply@lancieretech.com
```

### Service-Specific Variables

**face-auth-service/.env**
```env
# MongoDB
MONGO_URI=mongodb://<user>:<pass>@<host>:<port>
MONGO_HOST=<host>
MONGO_PORT=27017
MONGO_USER=<user>
MONGO_PASSWORD=<password>
MONGO_DB=imeetpro_face

# Collections
FACE_EMBEDDINGS_COLLECTION=face_embeddings
VERIFICATION_SESSIONS_COLLECTION=verification_sessions
VERIFICATION_LOGS_COLLECTION=verification_logs

# Face Model Config
FACE_MODEL_NAME=buffalo_l
FACE_DETECTION_SIZE=640
FACE_DISTANCE_THRESHOLD=0.4
MAX_ALLOWED_FACES=1
ALLOW_MULTIPLE_FACES=false

# AWS S3
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_REGION=ap-south-1
```

**attendance-service/.env**
```env
REDIS_HOST=<redis-host>
REDIS_PORT=6379
REDIS_DB=0
FACE_AUTH_SERVICE_URL=http://face-auth-service:8232
ATTENDANCE_REDIS_DB=2
ATTENDANCE_SESSION_TTL=86400
CAMERA_FRAME_GAP_THRESHOLD=30
```

**meeting-core-service/.env**
```env
# Redis (chat, reactions, hand-raise each use separate DBs)
DEFAULT_REDIS_HOST=<redis-host>
DEFAULT_REDIS_PORT=6379
DEFAULT_REDIS_DB=0

CACHE_CHAT_HOST=<redis-host>
CACHE_CHAT_PORT=6379
CACHE_CHAT_DB=1

CACHE_REACTIONS_HOST=<redis-host>
CACHE_REACTIONS_PORT=6379
CACHE_REACTIONS_DB=3

CACHE_HAND_RAISE_HOST=<redis-host>
CACHE_HAND_RAISE_PORT=6379
CACHE_HAND_RAISE_DB=4

# Celery
CELERY_BROKER_URL=redis://<redis-host>:6379/0
CELERY_RESULT_BACKEND=redis://<redis-host>:6379/0
CELERY_TIMEZONE=Asia/Kolkata

# LiveKit
LIVEKIT_URL=https://<livekit-host>
LIVEKIT_WSS_URL=wss://<livekit-host>
LIVEKIT_API_KEY=<key>
LIVEKIT_API_SECRET=<secret>
LIVEKIT_TTL=86400

# Inter-service
ATTENDANCE_SERVICE_URL=http://attendance-service:8233
RECORDING_SERVICE_URL=http://recording-service:8236

# AWS S3 (for chat file uploads)
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_REGION=ap-south-1

# Scheduler
DISABLE_SCHEDULER=false
```

**recording-service/.env**
```env
# Celery
CELERY_BROKER_URL=redis://<redis-host>:6379/0
CELERY_RESULT_BACKEND=redis://<redis-host>:6379/0
CELERY_TIMEZONE=Asia/Kolkata

# Redis
REDIS_HOST=<redis-host>
REDIS_PORT=6379
REDIS_RECORDING_DB=5

# MongoDB (video metadata)
MONGO_URI=mongodb://<user>:<pass>@<host>:<port>
MONGO_DB=imeetpro_recordings

# AWS S3
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_REGION=ap-south-1

# LiveKit
LIVEKIT_URL=https://<livekit-host>
LIVEKIT_API_KEY=<key>
LIVEKIT_API_SECRET=<secret>

# AI APIs
OPENAI_API_KEY=<key>
GROQ_API_KEY=<key>

# SMTP (for notification callbacks)
SMTP_SERVER=<smtp-host>
SMTP_PORT=587
SMTP_USERNAME=<user>
SMTP_PASSWORD=<password>
FROM_EMAIL=noreply@lancieretech.com
```

**whiteboard-service/.env**
```env
REDIS_HOST=<redis-host>
```

### Redis DB Allocation

| DB | Purpose | Service |
|----|---------|---------|
| 0 | Default / Celery broker | meeting-core, recording |
| 1 | Cache Chat | meeting-core |
| 2 | Attendance Sessions | attendance |
| 3 | Cache Reactions | meeting-core |
| 4 | Cache Hand Raise | meeting-core |
| 5 | Recording State | recording |

---

## Deployment

### Prerequisites

- Docker Engine 24+ with Compose V2
- NVIDIA Container Toolkit (for GPU services: face-auth, recording)
- NVIDIA GPU with CUDA 12.1 support
- MySQL 8.0+ (or AWS RDS)
- MongoDB 6.0+
- Redis 7.0+
- LiveKit Server instance
- AWS account with S3 access

### Step 1 — Create `.env` files

Create a `.env` file in each service directory using the variables listed above.

### Step 2 — SSL Certificates

Self-signed certificates are included for development at `nginx/ssl/`. For production, replace with valid certificates:

```bash
cp /path/to/your/cert.pem nginx/ssl/selfsigned.crt
cp /path/to/your/key.pem  nginx/ssl/selfsigned.key
```

Update `nginx/nginx.conf` `server_name` directive to match your domain.

### Step 3 — Build and Start

```bash
# Build all images
docker compose build

# Start all services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f <service-name>
```

### Step 4 — Verify

```bash
# Gateway health
curl -k https://localhost/api/health

# Individual service health
curl -k https://localhost/service-health
curl http://localhost:8230/service-health    # whiteboard
curl http://localhost:8231/health            # analytics
curl http://localhost:8232/service-health    # face-auth
curl http://localhost:8233/health            # attendance
curl http://localhost:8234/health            # user
curl http://localhost:8235/service-health    # meeting-core
curl http://localhost:8236/service-health    # recording
```

### Restart a Single Service

```bash
docker compose restart <service-name>
```

### Rebuild After Code Changes

```bash
docker compose up -d --build <service-name>
```

---

## Health Checks

All services expose health check endpoints. Docker Compose runs these automatically:

| Parameter | Value |
|-----------|-------|
| Interval | 30s |
| Timeout | 10s |
| Retries | 3 |
| Start period | 15–30s (GPU services get 30s) |

Health endpoints return `{"status": "healthy", "service": "<name>"}`.

---

## Troubleshooting

**GPU containers fail to start**
Verify NVIDIA Container Toolkit: `nvidia-smi` and `docker run --gpus all nvidia/smi`. Face-auth and recording services require GPU access.

**Inter-service communication failures**
Services communicate over the `imeetpro-network` Docker bridge using container DNS names (e.g., `http://face-auth-service:8232`). Verify `FACE_AUTH_SERVICE_URL`, `ATTENDANCE_SERVICE_URL`, `RECORDING_SERVICE_URL` env vars.

**Redis connection refused**
Redis is external (not in docker-compose). Verify: `redis-cli -h <REDIS_HOST> -p <REDIS_PORT> ping`.

**MySQL connection errors**
MySQL/RDS is external. Verify `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` in each `.env`.

**Celery workers not processing tasks**
Check `CELERY_BROKER_URL` points to reachable Redis. Logs: `docker compose logs -f meeting-core-celery` or `recording-celery`.

**Recording processing stuck**
Recording Celery runs on `video_processing` queue, concurrency 2. Check GPU memory: `nvidia-smi`.

**Nginx 502 Bad Gateway**
Downstream service isn't running or hasn't passed health check. Check `docker compose ps`. GPU services may need 60s+ to load models.

**File upload size limits**
Nginx `client_max_body_size` is 500MB for manual upload endpoints (`upload_recording`, `upload_recording_blob`, `upload_single_file`), 50MB for face/chat, 20MB for photos. The primary recording path (SDK bot → local file → S3 multipart) bypasses Nginx entirely and has no size limit. Adjust Nginx limits in `nginx/nginx.conf` if needed.

---

## Network & Proxy Configuration

Nginx handles HTTP→HTTPS redirect, SSL termination, CORS, gzip, and routing:

- **Max body size:** 500MB (manual video uploads via Nginx), 50MB (face/chat), 20MB (photos). Primary recording path bypasses Nginx (no limit).
- **Proxy timeouts:** 300s read/send, 60s connect, 600s for recording endpoints
- **Worker connections:** 4096 with multi_accept
- **Keepalive:** 65s

> **Important:** Routing order in `nginx.conf` matters — recording-specific `/api/meetings/<id>/(start|stop)-recording` patterns are matched **before** the general `/api/meetings/` catch-all.

---

*Lanciere Technologies — iMeetPro Microservices Platform*