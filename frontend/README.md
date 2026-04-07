# iMeetPro - Video Conferencing Platform

A professional, enterprise-grade video conferencing application built with React 18, Material-UI, LiveKit WebRTC, and AI-powered attendance tracking. Supports 500+ concurrent participants with real-time collaboration features.

## 🚀 Features

### 📱 Core Meeting Features
- **Multiple Meeting Types**: Instant, Scheduled, and Calendar-integrated meetings
- **HD Video/Audio**: Professional quality video conferencing with adaptive bitrate streaming via LiveKit
- **Screen Sharing**: Full screen, window, or tab sharing with system audio capture
- **Real-time Chat**: Text messaging, private messaging, file sharing, and emoji integration
- **Interactive Reactions**: Emoji reactions with floating animations and sound effects
- **Collaborative Whiteboard**: Real-time drawing with shapes, text, pen, eraser, and undo/redo
- **AI-Powered Attendance**: Continuous face verification using TensorFlow.js and face-api.js
- **Recording & Transcription**: Meeting recording with A/V sync and OpenAI Whisper-powered transcription
- **Waiting Room**: Pre-meeting lobby with device testing and camera preview
- **Calendar Integration**: Google Calendar, Outlook, and Apple Calendar sync
- **Live Captions**: Real-time speech-to-text powered by OpenAI Whisper
- **Noise Suppression**: RNNoise WASM AudioWorklet-based noise cancellation
- **Polls & Q&A**: In-meeting interactive polls and question-answer sessions
- **Hand Raise**: Queue-based hand raise system with host acknowledgement

### 🎛️ Meeting Controls
- **Host Controls**: Mute all, remove participant, lock meeting, manage waiting room, end meeting for all, force stop screen share
- **Participant Controls**: Self mute/unmute, camera on/off, chat, reactions, raise hand, screen share request
- **Advanced Permissions**: Role-based access control (Host, Co-Host, Participant) with dynamic permission management

### 💳 Billing & Payments
- **Subscription Plans**: Tiered pricing with plan comparison
- **Indian Payment Methods**: UPI, RuPay, credit/debit cards via Razorpay
- **Payment History**: Transaction logs with invoice downloads
- **Order Management**: Subscription lifecycle and renewal handling

### 📊 Analytics & Reports
- **Engagement Metrics**: Participant activity tracking, speaking time, reaction counts
- **Focus Score**: AI-calculated attention scoring per participant
- **Attendance Reports**: Face-verification-based attendance logs with timestamps
- **Meeting Reports**: Duration, participant count, chat activity, recording availability
- **Exportable Dashboards**: Recharts-powered visualizations with PDF/CSV export

### 🔧 Technical Features
- **Responsive Design**: Mobile-first approach with cross-device compatibility
- **Real-time Communication**: LiveKit WebRTC for media + data channels
- **WebSocket Integration**: Django Channels for real-time state updates and notifications
- **Progressive Web App**: Service worker with offline support
- **Selective Subscription**: Bandwidth optimization for 500+ participant meetings
- **Virtual Backgrounds**: TensorFlow.js body segmentation for blur and custom backgrounds

## 🛠️ Technology Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Frontend Framework** | React 18.2 + Vite | Component-based UI with fast HMR |
| **UI Library** | Material-UI (MUI) v5 | Pre-built accessible components and theming |
| **Routing** | React Router v6 | Client-side routing with protected routes |
| **State Management** | React Context API | 8 context providers for global state |
| **WebRTC** | LiveKit Client SDK v2.15 | Real-time audio/video/data communication |
| **Face Detection** | TensorFlow.js + face-api.js | AI face verification for attendance |
| **Noise Suppression** | RNNoise WASM | AudioWorklet-based noise cancellation |
| **Whiteboard** | Konva + React-Konva | Canvas-based collaborative drawing |
| **Charts** | Recharts | Data visualization for analytics |
| **Forms** | React Hook Form + Yup | Form state management and validation |
| **HTTP Client** | Axios | API communication with JWT interceptors |
| **Animations** | Framer Motion | Smooth UI transitions and reaction effects |
| **Date Handling** | date-fns | Lightweight date formatting |
| **Payments** | Razorpay SDK | UPI, RuPay, card payment processing |
| **Excel Parsing** | xlsx + PapaParse | Bulk invite via spreadsheet upload |
| **Styling** | Emotion + CSS-in-JS | Scoped component styling |

### Backend Stack (Separate Repository)
- **Framework**: Django + Django Channels
- **Databases**: MySQL (structured data), MongoDB (binary/document storage)
- **Caching**: Redis
- **Media Server**: LiveKit Server (WebRTC signaling and media relay)
- **Storage**: AWS S3 (recordings, files, avatars)
- **Transcription**: OpenAI Whisper API
- **Face Recognition**: InsightFace / MediaPipe
- **Recording**: FFmpeg (single-process A/V sync architecture)

## 📋 Prerequisites

- Node.js (v16.0.0 or higher)
- npm (v8.0.0 or higher) or yarn
- Modern web browser with WebRTC support
- SSL certificates for local development (required for getUserMedia)

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/imeetpro-frontend.git
cd imeetpro-frontend
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
```

### 3. Generate SSL Certificates
```bash
# Required for WebRTC APIs (getUserMedia needs HTTPS)
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -config openssl.cnf
```

### 4. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your configuration
nano .env
```

### 5. Start Development Server
```bash
npm run dev
# or
yarn dev
```

The application will be available at `https://localhost:5173` (HTTPS required)

## 🏗️ Project Structure

```
src/
├── components/              # 150+ reusable UI components
│   ├── auth/               # Login, Register, ForgotPassword, CameraCapture, EmailVerification
│   ├── meeting/            # MeetingRoom, CreateMeeting, JoinMeeting, WaitingRoom, MeetingSettings
│   ├── video/              # VideoGrid, VideoPlayer, ScreenShare, VideoQuality, VideoEffects
│   ├── controls/           # MeetingControlBar, HostControls, AudioControls, VideoControls
│   ├── chat/               # ChatPanel, MessageInput, MessageList, FileUpload, ChatSearch
│   ├── participants/       # ParticipantGrid, ParticipantCard, ParticipantsList, ParticipantControls
│   ├── attendance/         # AttendanceTracker, AttendancePopup, AttendanceStatus
│   ├── whiteboard/         # Whiteboard, WhiteboardCanvas, WhiteboardToolbar, WhiteboardShapes
│   ├── recording/          # RecordingControls, RecordingPlayer, RecordingsList, TranscriptViewer
│   ├── reactions/          # ReactionsPanel, ReactionOverlay, FloatingReactionsOverlay, ReactionsManager
│   ├── analytics/          # AIAnalytics, FocusScoreDisplay, EngagementMetrics, MeetingReports
│   ├── scheduling/         # DateTimePicker, RecurringMeeting, AvailabilitySlots, TimeZoneSelector
│   ├── calendar/           # CalendarView, CalendarSettings, MonthWeekDayView, EventDetails
│   ├── invitations/        # InviteParticipants, ExcelUpload, BulkInvite, EmailPreview, RSVPStatus
│   ├── interactions/       # RaiseHand, PollSystem, HandRaisedList, QnASection
│   ├── dashboard/          # Dashboard, QuickActions, MeetingHistory, UserProfile
│   ├── dialogs/            # EndMeetingDialog, LeaveMeetingDialog, ScreenShareDialogs
│   ├── overlays/           # ConnectionQueue, ScreenShareWaiting, AttendanceTracker, MeetingEnded
│   ├── panels/             # ChatPanelWrapper, ParticipantsPanelWrapper, HandRaisePanelWrapper
│   ├── tabs/               # BrowserTabsHeader, MeetingTab, WhiteboardTab, AttendanceTab
│   ├── status/             # NotificationManager, RecordingIndicator, UploadProgressBar
│   ├── Feedback/           # FeedbackDialog, FeedbackForm, FeedbackHistory
│   └── common/             # Header, Sidebar, Footer, LoadingSpinner, ErrorBoundary, ConfirmDialog
├── pages/                  # 11 page-level components
│   ├── DashboardPage.jsx
│   ├── MeetingPage.jsx
│   ├── SchedulePage.jsx
│   ├── CalendarPage.jsx
│   ├── RecordingsPage.jsx
│   ├── AnalyticsPage.jsx
│   ├── ProfilePage.jsx
│   ├── SettingsPage.jsx
│   ├── BillingTab.jsx
│   ├── MeetingDetailsPage.jsx
│   └── AuthPage.jsx
├── hooks/                  # 28 custom React hooks (40,192 total lines)
│   ├── useLiveKit.js       # LiveKit media lifecycle (6,368 lines)
│   ├── useMeeting.js       # Meeting lifecycle orchestration (1,999 lines)
│   ├── useAttendance.js    # AI face attendance logic (1,103 lines)
│   ├── useRecording.js     # Recording management (1,038 lines)
│   ├── useWhiteboard.js    # Collaborative whiteboard state (912 lines)
│   ├── useWebRTC.js        # Legacy WebRTC connections (1,004 lines)
│   ├── useCalendar.js      # Calendar event management (877 lines)
│   ├── useAnalytics.js     # Engagement metrics (868 lines)
│   ├── useNotifications.js # Push/in-app notifications (778 lines)
│   ├── useReactions.js     # Emoji reactions via data channels (640 lines)
│   ├── useMeetingControls.js # Control bar state (583 lines)
│   ├── useHandRaise.js     # Hand raise queue (501 lines)
│   ├── useScheduling.js    # Schedule meeting logic (490 lines)
│   ├── useRazorpayPayment.js # Payment integration (221 lines)
│   └── ... (14 more hooks)
├── services/               # 21 API service files (16,415 total lines)
│   ├── api.js              # Master REST API service (5,078 lines)
│   ├── scheduling.js       # Scheduling API (2,352 lines)
│   ├── recording.js        # Recording API (1,011 lines)
│   ├── attendanceAPI.js    # Face verification API (962 lines)
│   ├── livekit.js          # LiveKit token/room service (412 lines)
│   ├── whiteboard.js       # Whiteboard sync service (800 lines)
│   ├── noiseSuppression.js # RNNoise AudioWorklet setup
│   ├── paymentService.js   # Razorpay integration
│   └── ... (13 more services)
├── context/                # 8 React Context providers
│   ├── AuthContext.jsx     # JWT authentication state (724 lines)
│   ├── MeetingContext.jsx  # Active meeting state (908 lines)
│   ├── LiveKitContext.jsx  # LiveKit room connection (697 lines)
│   ├── SchedulingContext.jsx # Scheduling state (1,057 lines)
│   ├── NotificationContext.jsx
│   ├── ReactionsContext.jsx
│   ├── CalendarContext.jsx
│   └── ThemeContext.jsx
├── utils/                  # 17 utility modules
│   ├── constants.js        # App-wide constants (38,901 lines)
│   ├── attendanceUtils.js  # Face detection helpers
│   ├── performanceConfig.js # Selective subscription config
│   ├── axiosConfig.js      # Axios instance with JWT interceptors
│   └── ... (13 more utils)
├── theme/                  # MUI theme configuration
│   ├── theme.js            # Master theme composition
│   ├── palette.js          # Brand colors (#3B5998, #2D7DD2, #1E6BB8)
│   ├── typography.js       # Font stack and sizing
│   ├── components.js       # MUI component overrides
│   ├── shadows.js          # Custom elevations
│   └── breakpoints.js      # Responsive breakpoints
├── layouts/                # Layout components
│   ├── MainLayout.jsx      # Dashboard layout (Header 90px + Sidebar 280px)
│   ├── AuthLayout.jsx      # Centered auth card layout
│   ├── MeetingLayout.jsx   # Full-viewport meeting layout
│   └── DashboardLayout.jsx
├── assets/                 # Static assets
│   ├── images/             # Logo (IMeetPro.png), placeholders
│   ├── sounds/             # Notification and reaction sounds
│   └── icons/              # Custom SVG icons
├── App.jsx                 # Root component with provider hierarchy and routing
├── main.jsx                # Entry point
└── index.css               # Global styles
```

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start HTTPS dev server on port 5173
npm run build            # Build for production (dist/)
npm run preview          # Preview production build locally

# Testing
npm run test             # Run Jest tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Auto-fix ESLint issues
```

## 🌐 Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# API Configuration
VITE_API_BASE_URL=https://192.168.48.201/api
VITE_WS_BASE_URL=wss://192.168.48.201/ws/meeting/

# LiveKit Configuration
VITE_LIVEKIT_URL=wss://your-livekit-server.com

# WebRTC Configuration
VITE_STUN_SERVERS=stun:stun.l.google.com:19302
VITE_TURN_SERVERS=turn:your-turn-server.com:3478

# Calendar Integration
VITE_GOOGLE_CALENDAR_CLIENT_ID=your-google-client-id
VITE_MICROSOFT_CALENDAR_CLIENT_ID=your-microsoft-client-id

# App Configuration
VITE_APP_NAME=iMeetPro
VITE_MAX_PARTICIPANTS=500
VITE_MAX_MEETING_DURATION=180
```

## 🏛️ Application Architecture

### Provider Hierarchy
```
BrowserRouter
  └── CustomThemeProvider + MUI ThemeProvider
        └── AuthProvider (JWT tokens, user profile)
              └── NotificationProvider (toasts, dropdown alerts)
                    └── MeetingProvider (meeting state, participants)
                          └── LiveKitProvider (room connection, tracks)
                                └── LiveKitReactionsProvider (emoji reactions)
                                      └── ErrorBoundary
                                            └── AppRoutes
```

### Routing Structure

| Route | Layout | Component | Access |
|-------|--------|-----------|--------|
| `/auth/*` | AuthLayout | Login / Register / ForgotPassword | Public |
| `/dashboard` | MainLayout | DashboardPage | Protected |
| `/instant-meeting` | MeetingLayout | MeetingPage (auto-create) | Protected |
| `/meeting/:meetingId` | MeetingLayout | MeetingPage (join) | Protected |
| `/join-meeting` | MeetingLayout | MeetingPage (via link) | Protected |
| `/schedule-meeting` | MainLayout | SchedulePage | Protected |
| `/meeting/schedule/new` | MainLayout | ScheduleMeeting | Protected |
| `/meeting/schedule/edit/:id` | MainLayout | ScheduleMeeting | Protected |
| `/meeting/calendar` | MainLayout | CalendarPage | Protected |
| `/recordings` | MainLayout | RecordingsPage | Protected |
| `/calendar` | MainLayout | CalendarPage | Protected |
| `/profile` | MainLayout | ProfilePage | Protected |
| `/settings` | MainLayout | SettingsPage | Protected |
| `/analytics` | MainLayout | AnalyticsPage | Protected |
| `/analytics/meeting/:meetingId` | MainLayout | AnalyticsPage | Protected |
| `/*` | - | Redirect to `/auth` | - |

### Layout System

- **MainLayout**: Fixed AppBar header (`HEADER_HEIGHT = 90px`) with iMeetPro logo and gradient navigation (`#3B5998 → #2D7DD2 → #1E6BB8`), collapsible sidebar (`SIDEBAR_WIDTH = 280px`), and scrollable content area
- **AuthLayout**: Centered card-based layout for login/register with no sidebar
- **MeetingLayout**: Full-viewport immersive layout optimized for video with minimal chrome

## 📱 Component Architecture

### Authentication Flow
- `Login.jsx` - Email/password login with validation and remember-me
- `Register.jsx` - Multi-step registration with face enrollment via camera capture
- `CameraCapture.jsx` - Webcam face photo capture for AI attendance enrollment
- `ForgotPassword.jsx` - Email-based password reset
- `EmailVerification.jsx` - OTP/link verification after registration

### Meeting Lifecycle
- `CreateMeeting.jsx` - Meeting creation (instant / scheduled / calendar)
- `WaitingRoom.jsx` - Pre-meeting lobby with device testing and live video preview
- `JoinMeeting.jsx` - Join-by-link validation and routing
- `MeetingRoom.jsx` - Main meeting interface (5,172 lines) with tabbed layout (Meeting / Whiteboard / Attendance)
- `MeetingSettings.jsx` - In-meeting device and preference settings

### Video System
- `VideoGrid.jsx` - Responsive grid with gallery, speaker, and presentation views; selective subscription for 500+ participants
- `VideoPlayer.jsx` - Individual video tile with name overlay, mute indicators, and connection quality badge
- `ScreenShare.jsx` - Tab/window/full-screen sharing with system audio capture
- `VideoQuality.jsx` - Manual resolution and bitrate override
- `VideoEffects.jsx` - Virtual backgrounds using TensorFlow.js body segmentation

### AI Attendance System
- `AttendanceTracker.jsx` - Continuous face verification with three-phase violation enforcement (Warning → Second Warning → Removal)
- `AttendancePopup.jsx` - Face positioning modal with camera preview and alignment guide
- `AttendanceStatus.jsx` - Real-time verification status indicator
- Break management with camera auto-resume and grace period after resumption

### Whiteboard
- `Whiteboard.jsx` - React-Konva canvas with real-time stroke sync via LiveKit data channels
- `WhiteboardToolbar.jsx` - Tool selection (pen, highlighter, shapes, text, eraser, selection, move)
- `WhiteboardCanvas.jsx` - DPR-aware canvas with coordinate alignment
- `WhiteboardShapes.jsx` - Shape primitives (rectangle, circle, line, arrow, polygon)
- `WhiteboardControls.jsx` - Undo/redo (per-stroke granularity), clear, export PNG/PDF

### Communication
- `ChatPanel.jsx` - Side panel with real-time and private messaging, file sharing
- `MessageInput.jsx` - Rich input with emoji picker and file attachment
- `MessageList.jsx` - Virtualized message list with auto-scroll and read receipts
- `ReactionsPanel.jsx` - Emoji picker with floating animation overlay

### Recording & Transcription
- `RecordingControls.jsx` - Start/stop/pause with recording timer
- `RecordingPlayer.jsx` - Playback with seek and speed control
- `RecordingsList.jsx` - Recording library with search and download
- `TranscriptViewer.jsx` - Speaker-labeled transcript with timestamps

## 🔌 API Integration

### Authentication Endpoints
```
POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/verify-email
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/refresh-token
```

### Meeting Endpoints
```
POST   /api/meetings/create
GET    /api/meetings/:id
POST   /api/meetings/:id/join
PUT    /api/meetings/:id/update
DELETE /api/meetings/:id
POST   /api/meetings/:id/end
```

### Attendance Endpoints
```
POST   /api/attendance/verify-face
GET    /api/attendance/:meetingId/report
POST   /api/attendance/enroll-face
```

### Recording Endpoints
```
POST   /api/recordings/start
POST   /api/recordings/stop
GET    /api/recordings/:meetingId
GET    /api/recordings/:id/download
GET    /api/recordings/:id/transcript
```

### Scheduling Endpoints
```
POST   /api/schedule/create
GET    /api/schedule/list
PUT    /api/schedule/:id/update
DELETE /api/schedule/:id
POST   /api/schedule/:id/invite
```

### Billing Endpoints
```
POST   /api/billing/create-order
POST   /api/billing/verify-payment
GET    /api/billing/history
GET    /api/billing/subscription
```

### Real-time Events (LiveKit Data Channels + Django Channels WebSocket)
```
# LiveKit Data Channels
reaction-sent / reaction-received
whiteboard-stroke / whiteboard-clear
hand-raised / hand-lowered

# Django Channels WebSocket
user-joined / user-left
message-sent / message-received
screen-share-started / screen-share-stopped
participant-muted / participant-removed
recording-started / recording-stopped
meeting-ended
attendance-verified / attendance-violation
```

## 🎨 Theme & Design System

The app uses a custom Material-UI theme (light mode only; dark mode explicitly removed):

```javascript
// Brand Color Palette
Primary:    #3B5998 (Deep Blue)
Secondary:  #2D7DD2 (Blue)
Accent:     #1E6BB8 (Blue endpoint)
Teal:       #1A8A8A (Accent where used)

// Layout Constants
HEADER_HEIGHT: 90px
SIDEBAR_WIDTH: 280px

// Header Gradient
linear-gradient(135deg, #3B5998 → #2D7DD2 → #1E6BB8)

// Typography
Font Family: Roboto, Arial, sans-serif
```

## ⚡ Key Technical Patterns

### Mute-Before-Publish
Audio/video tracks must be muted at both the LiveKit track level AND `MediaStreamTrack.enabled` before publishing to prevent privacy leaks:
```
1. Create track
2. track.mute()
3. mediaStreamTrack.enabled = false
4. room.localParticipant.publishTrack(track)
```

### Refs as Source of Truth
`audioMutedRef` / `videoMutedRef` are updated before React state. React state is async and causes race conditions during rapid mute/unmute. Refs are always consulted for current state; React state drives UI only.

### No Participant Spreading
```javascript
// ❌ WRONG - strips prototype methods
const p = { ...participant };
p.getTrackPublication(); // TypeError!

// ✅ CORRECT - pass by reference
const p = participant;
p.getTrackPublication(); // works
```

### Multi-Key Stream Mapping
Participants indexed by SID, identity, user ID, and role-based keys for reliable lookup across different LiveKit events.

### Canvas DPR Handling
DPR scaling applied once via `context.scale(dpr, dpr)`. Never double-apply to coordinates. Use direct CSS pixel coordinates after initial scaling.

### AudioWorklet for RNNoise
ScriptProcessorNode causes buffer misalignment at 48kHz. RNNoise requires AudioWorklet in a separate thread, loaded from `/public/rnnoise/rnnoise.wasm`.

### Device Hot-Swap
LiveKit reuses Track SIDs on republish. Reliable mic switching requires:
```javascript
const newTrack = await createLocalAudioTrack({ deviceId: { exact: newDeviceId } });
await room.localParticipant.publishTrack(newTrack);
// Clean up old track
```

### JSON-Only Backend
Django must never return HTML error pages. All endpoints wrapped in try/catch returning JSON to prevent Axios parsing failures.

## 📊 Codebase Statistics

| Metric | Value |
|--------|-------|
| Total files | 261 |
| JS/JSX source files | 248 |
| Components | 150+ |
| Custom hooks | 28 |
| Service files | 21 |
| Context providers | 8 |
| Pages | 11 |
| Layouts | 4 |
| Utility modules | 17 |
| Theme files | 5 |
| Largest hook (useLiveKit.js) | 6,368 lines |
| Largest component (MeetingRoom.jsx) | 5,172 lines |
| Largest service (api.js) | 5,078 lines |
| Total hook lines | 40,192 |
| Total service lines | 16,415 |
| Total page lines | 15,839 |

## 🔧 Build Configuration

Vite config highlights:
- **HTTPS**: Self-signed certificates for local dev (required for WebRTC)
- **Path Aliases**: `@components`, `@hooks`, `@services`, `@utils`, `@context`, `@theme`, `@layouts`, `@assets`
- **Proxy**: `/api` → Django backend, `/wss` → WebSocket server
- **Code Splitting**: Manual chunks for vendor (React), mui (Material-UI), router, webrtc (simple-peer), socket (socket.io-client)
- **Source Maps**: Enabled for debugging
- **Chunk Size Limit**: 1000KB warning threshold

## 🔒 Security Features

- **JWT Authentication**: Access + refresh tokens with automatic refresh via Axios interceptors
- **HTTPS Everywhere**: Required for all API, WebSocket, and WebRTC connections
- **Input Validation**: Client-side Yup schemas + independent backend validation
- **XSS Protection**: React JSX escaping + explicit chat content sanitization
- **CORS**: Strict origin allowlisting on Django backend
- **Role-Based Access**: Host / Co-Host / Participant with granular permissions
- **Face Verification**: AI-powered identity verification prevents unauthorized access
- **Meeting Lock**: Host can prevent new participants from joining
- **Waiting Room**: All participants require host admission

## 🎯 Performance Optimization

- **Selective Video Subscription**: Only visible tiles subscribe to video tracks (critical for 500+ participants)
- **Code Splitting**: Rollup manual chunks for vendor libraries
- **Virtual Scrolling**: react-window and react-virtualized-auto-sizer for large lists
- **Memoization**: useMemo/useCallback for expensive computations
- **Bandwidth Estimation**: Adaptive quality presets based on connection speed
- **Service Worker**: Browser and SW caching for static assets
- **Image Compression**: Client-side image optimization before upload

## 📊 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🗺️ Roadmap

- [ ] Flutter mobile client (WebSocket/Django Channels + LiveKit Mobile SDK)
- [ ] 500+ participant load testing and optimization
- [ ] Breakout rooms for small group discussions
- [ ] Cloud-side recording via LiveKit Egress
- [ ] Expanded virtual background effects library
- [ ] Multi-language support (i18n)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ by the iMeetPro Development Team