// src/components/meeting/MeetingRoom.jsx - COMPLETE REFACTORED VERSION
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";
import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";
import { throttle } from "lodash";
import { Track, DataPacket_Kind, RoomEvent } from "livekit-client";
// ============================================================================
// MATERIAL-UI ICONS
// ============================================================================
import {
  RadioButtonChecked,
  Fullscreen,
  FullscreenExit,
  Share,
  MeetingRoom as MeetingRoomIcon,
  Gesture as WhiteboardIcon,
  Pause,        // ADD THIS
  PlayArrow,    // ADD THIS
} from "@mui/icons-material";

// / ─────────────────────────────────────────────────────────────────────────────
// NEW IMPORTS — add these alongside your existing imports
// ─────────────────────────────────────────────────────────────────────────────
import { Typography, useMediaQuery, useTheme, Fade, Slide, Grow } from "@mui/material";
import { keyframes } from "@mui/system";

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATIONS
// ─────────────────────────────────────────────────────────────────────────────
const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 8px rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.8), 0 0 40px rgba(239, 68, 68, 0.3); }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const floatIn = keyframes`
  0% { opacity: 0; transform: translateY(12px) scale(0.97); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
`;

const subtlePulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

const slideUp = keyframes`
  0% { opacity: 0; transform: translateY(24px); }
  100% { opacity: 1; transform: translateY(0); }
`;

// ─────────────────────────────────────────────────────────────────────────────
// STYLED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const MeetingContainer = styled(Box)(() => ({
  height: "100vh",
  width: "100vw",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  background: `
    radial-gradient(ellipse 80% 60% at 50% -10%, rgba(30, 58, 95, 0.5) 0%, transparent 60%),
    radial-gradient(ellipse 60% 50% at 80% 100%, rgba(30, 64, 80, 0.3) 0%, transparent 50%),
    linear-gradient(180deg, #0a0e17 0%, #101820 40%, #0d1218 100%)
  `,
  color: "#e8ecf1",
  overflow: "hidden",
  position: "relative",
  fontFamily: "'DM Sans', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    backgroundImage: `
      radial-gradient(circle at 20% 30%, rgba(56, 189, 248, 0.03) 0%, transparent 40%),
      radial-gradient(circle at 80% 70%, rgba(168, 85, 247, 0.02) 0%, transparent 40%)
    `,
    pointerEvents: "none",
    zIndex: 0,
  },
}));

const ContentShell = styled(Box)(() => ({
  position: "relative",
  zIndex: 1,
  flex: 1,
  display: "flex",
  flexDirection: "column",
  height: "100vh",
  overflow: "hidden",
}));

// ── The full-height row that holds VideoColumn + Panels side-by-side ────────
const MainStage = styled(Box)(({ theme }) => ({
  flex: 1,
  display: "flex",
  flexDirection: "row",
  position: "relative",
  overflow: "hidden",
  minHeight: 0,
  gap: 0,  // ✅ No gap
  padding: 0,
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
  },
}));

// ── Column that wraps VideoArea + ControlBar
const VideoColumn = styled(Box)(({ theme }) => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  minHeight: 0,
  overflow: "hidden",
  position: "relative",
  // ✅ GPU-accelerated smooth width transition
  transition: "flex 0.35s cubic-bezier(0.4, 0, 0.2, 1), margin 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
  willChange: "flex",
}));

// ============================================================
// REPLACE these styled components in MeetingRoom.jsx
// ============================================================

// ── VideoArea — NO margins, borders, or border-radius so video fills the tab ──
const VideoArea = styled(Box)(({ theme }) => ({
  flex: 1,
  position: "relative",
  overflow: "hidden",
  // ✅ REMOVED: borderRadius, margin, background, border, backdropFilter, animation
  // Video should fill the entire available space with ZERO gaps
  borderRadius: 0,
  margin: 0,
  padding: 0,
  background: "transparent",
  border: "none",
  minHeight: 0,           // allow shrink in flex column
}));

// ── ControlBar now sits inside VideoColumn, inheriting its width ────────────
const ControlBarWrapper = styled(Box)(({ theme }) => ({
  position: "relative",
  zIndex: 50,
  flexShrink: 0,          // never collapse
  padding: "6px 8px 10px 8px",
  animation: `${slideUp} 0.4s ease-out 0.2s both`,
  // smooth width sync with parent column
  transition: "padding 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  [theme.breakpoints.down("md")]: {
    padding: "4px 6px 8px 6px",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "2px 4px 6px 4px",
  },
}));



const HandRaiseBadgeContainer = styled(Box)(() => ({
  position: "fixed",
  top: 80,
  right: 24,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  zIndex: 999,
  animation: `${slideUp} 0.35s ease-out`,
  "@media (max-width: 960px)": {
    top: 64,
    right: 16,
  },
  "@media (max-width: 600px)": {
    top: 52,
    right: 8,
  },
}));

// ── Side panels: inline on desktop, overlay on mobile ───────────────────────
const PanelSlot = styled(Box, {
  shouldForwardProp: (prop) => prop !== "isOpen" && prop !== "side",
})(({ theme, isOpen, side = "right" }) => ({
  position: "relative",
  // ✅ Use width + transform for smooth GPU-accelerated animation
  width: isOpen ? 380 : 0,
  minWidth: isOpen ? 380 : 0,
  maxWidth: isOpen ? 380 : 0,
  opacity: isOpen ? 1 : 0,
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  // ✅ Smooth multi-property transition
  transition: `
    width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    min-width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    max-width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1) ${isOpen ? '0.1s' : '0s'},
    transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)
  `,
  willChange: "width, min-width, max-width, opacity, transform",
  // ✅ Slide content in from the right
  transform: isOpen ? "translateX(0)" : "translateX(20px)",
  // ✅ No border/margin gap
  margin: 0,
  padding: 0,
  borderLeft: isOpen ? "1px solid rgba(255,255,255,0.06)" : "none",

  [theme.breakpoints.down("lg")]: {
    width: isOpen ? 320 : 0,
    minWidth: isOpen ? 320 : 0,
    maxWidth: isOpen ? 320 : 0,
  },
  // On tablet / mobile: absolute overlay so VideoColumn stays full width
  [theme.breakpoints.down("md")]: {
    position: "absolute",
    top: 0,
    [side === "right" ? "right" : "left"]: 0,
    bottom: 0,
    width: isOpen ? "100%" : 0,
    minWidth: isOpen ? "100%" : 0,
    maxWidth: isOpen ? 420 : 0,
    zIndex: 100,
    background: "rgba(10, 14, 23, 0.97)",
    backdropFilter: "blur(20px)",
    borderLeft: isOpen ? "1px solid rgba(255,255,255,0.06)" : "none",
    // ✅ Slide from right on mobile
    transform: isOpen ? "translateX(0)" : "translateX(100%)",
    opacity: 1, // always opaque on mobile, let transform handle it
    // ✅ Override width to not be 0 so transform works
    ...(isOpen ? {} : {
      width: 420,
      minWidth: 420,
      maxWidth: 420,
    }),
  },
  [theme.breakpoints.down("sm")]: {
    maxWidth: isOpen ? "100%" : 0,
    ...(isOpen ? {} : {
      width: "100%",
      minWidth: "100%",
      maxWidth: "100%",
    }),
  },
}));

const ThankYouOverlay = styled(Box)(() => ({
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(6, 10, 18, 0.97)",
  backdropFilter: "blur(24px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 20001,
  flexDirection: "column",
  gap: 16,
  animation: `${floatIn} 0.6s ease-out`,
}));

const GlassCard = styled(Box)(() => ({
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  padding: "40px 48px",
  textAlign: "center",
  maxWidth: 480,
  width: "90%",
}));

const ProgressDot = styled(Box, {
  shouldForwardProp: (p) => p !== "delay",
})(({ delay = 0 }) => ({
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "#38bdf8",
  animation: `${subtlePulse} 1.2s ease-in-out ${delay}s infinite`,
}));
// ============================================================================
// HOOKS
// ============================================================================
import { useLiveKit } from "../../hooks/useLiveKit";
import { useHandRaise } from "../../hooks/useHandRaise";
import { useRecording } from "../../hooks/useRecording";
import { useMeetingControls } from "../../hooks/useMeetingControls";
import { useMeetingPanels } from "../../hooks/useMeetingPanels";
import { useMeetingDialogs } from "../../hooks/useMeetingDialogs";
import { useMeetingNotifications } from "../../hooks/useMeetingNotifications";
import { useParticipantActions } from "../../hooks/useParticipantActions";
import { useMeetingTabs } from "../../hooks/useMeetingTabs";

// ============================================================================
// COMPONENTS - DIALOGS
// ============================================================================
import LeaveMeetingDialog from "../dialogs/LeaveMeetingDialog";
import EndMeetingDialog from "../dialogs/EndMeetingDialog";
import ScreenShareRequestDialog from "../dialogs/ScreenShareRequestDialog";
import MeetingLinkPopup from "../dialogs/MeetingLinkPopup";
import ScreenShareStoppedDialog from "../dialogs/ScreenShareStoppedDialog";
import RecordingNameDialog from "../dialogs/RecordingNameDialog";
import ForceStopScreenShareDialog from "../dialogs/ForceStopScreenShareDialog";

// ============================================================================
// COMPONENTS - CONTROLS
// ============================================================================
import MeetingControlBar from "../controls/MeetingControlBar";
import MeetingActionsMenu from "../controls/MeetingActionsMenu";

// ============================================================================
// COMPONENTS - PANELS
// ============================================================================
import ChatPanelWrapper from "../panels/ChatPanelWrapper";
import ParticipantsPanelWrapper from "../panels/ParticipantsPanelWrapper";
import HandRaisePanelWrapper from "../panels/HandRaisePanelWrapper";

// ============================================================================
// COMPONENTS - OVERLAYS
// ============================================================================
import AttendanceTrackerOverlay from "../overlays/AttendanceTrackerOverlay";
import MeetingEndedOverlay from "../overlays/MeetingEndedOverlay";
import ScreenShareWaitingOverlay from "../overlays/ScreenShareWaitingOverlay";
import ConnectionQueueOverlay from "../overlays/ConnectionQueueOverlay";

// ============================================================================
// COMPONENTS - STATUS
// ============================================================================
import RecordingIndicator from "../status/RecordingIndicator";
import NotificationManager from "../status/NotificationManager";
import UploadProgressBar from "../status/UploadProgressBar";
import HandRaiseNotification from "../status/HandRaiseNotification";

// ============================================================================
// COMPONENTS - TABS
// ============================================================================
import BrowserTabsHeader from "../tabs/BrowserTabsHeader";
import MeetingTabContent from "../tabs/MeetingTabContent";
import WhiteboardTabContent from "../tabs/WhiteboardTabContent";

// Add this import with other dialog imports
import FeedbackDialog from "../Feedback/FeedbackDialog";

// ============================================================================
// OTHER COMPONENTS
// ============================================================================
import ReactionsManager from "../reactions/ReactionsManager";

// ============================================================================
// SERVICES & UTILS
// ============================================================================
import { API_BASE_URL } from "../../utils/constants";
import { participantsAPI, meetingsAPI } from "../../services/api";
import {
  createRecordingStream,
  createMediaRecorder,
  processRecordingChunks,
  validateRecordingBlob,
  cleanupRecordingResources,
  createRecordingMetadata,
} from "../../utils/clientRecording";
import { handRaiseService } from "../../services/handRaiseAPI";

// ============================================================================
// CONFIGURATION
// ============================================================================
const PERFORMANCE_CONFIG = {
  MAX_VIDEO_PARTICIPANTS: 50,
  THROTTLE_DELAY: 200,
  DEBOUNCE_DELAY: 100,
  PARTICIPANT_SYNC_INTERVAL: 10000,
  CONNECTION_RETRY_DELAY: 2000,
  MAX_RETRIES: 3,
  STREAM_CACHE_SIZE: 50,
  MAX_MESSAGES: 100,
  MAX_REACTIONS: 10,
  VIDEO_QUALITY: "medium",
  FRAME_RATE: 15,
  QUEUE_POLL_INTERVAL: 2000,
  MAX_QUEUE_WAIT_TIME: 300000,
  INITIAL_MEDIA_DELAY: 100,
  COHOST_SYNC_INTERVAL: 15000,
  ATTENDANCE_SYNC_INTERVAL: 30000,
};



// ============================================================================
// MAIN COMPONENT
// ============================================================================
const MeetingRoom = memo(function MeetingRoom({
  meetingData,
  participants = [],
  currentUser,
  localStream,
  remoteStreams = new Map(),
  screenShareStream,
  screenSharer,
  onLeaveMeeting,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onSendReaction,
  onToggleRecording,
  isConnected: propIsConnected = false,
  isVideoEnabled: propVideoEnabled = false,
  isAudioEnabled: propAudioEnabled = false,
  isScreenSharing: propScreenSharing = false,
  isRecording: propRecording = false,
  connectionQuality = "good",
  webrtcErrors = [],
  isHost = false,
  realMeetingId = null,
  participantId = null,
}) {
  // ==========================================================================
  // LIVEKIT HOOKS
  // ==========================================================================
  const {
    connectToRoom,
    disconnectFromRoom,
    sendReaction,
    sendChatMessage,
    isConnected: livekitConnected,
    connected,
    participantCount,
    remoteParticipants,
    localParticipant,
    room,
    localTracks,
    isAudioEnabled: livekitAudioEnabled,
    isVideoEnabled: livekitVideoEnabled,
    isScreenSharing: livekitScreenSharing,
    toggleAudio: livekitToggleAudio,
    toggleVideo: livekitToggleVideo,
    startScreenShare: livekitStartScreenShare,
    stopScreenShare: livekitStopScreenShare,
    forceStopParticipantScreenShare, // ✅ ADD THIS LINE
    error: livekitError,
    connectionState,
    isConnecting,
    screenSharingParticipant: livekitScreenSharingParticipant,
    localIsScreenSharing: livekitLocalIsScreenSharing,
    getScreenShareStream,
    queueStatus,
    checkConnectionQueue,
    joinMeetingWithQueue,
    waitForQueueTurn,
    maxParticipants,
    performanceMode,
    startRecording: livekitStartRecording,
    stopRecording: livekitStopRecording,
    enableAudio,
    enableVideo,
    endMeetingForEveryone,
    meetingEnded,
    screenSharePermissions,
    screenShareRequests,
    currentScreenShareRequest,
    requestScreenSharePermission,
    approveScreenShareRequest,
    denyScreenShareRequest,
  getRemoteVideoStream,
    updateCoHostStatus,
  } = useLiveKit();

 
  // ==========================================================================
  // RECORDING HOOK
  // ==========================================================================
  const {
    startRecording: startHybridRecording,
    stopRecording: stopHybridRecording,
    checkRecordingSupport,
    uploadProgress: hookUploadProgress,
    recordingMethod: hookRecordingMethod,
    clientRecording: hookClientRecording,
    loading: recordingLoading,
    error: recordingError,
    startMeetingRecording,
    stopMeetingRecording,
    uploadRecording,
    fetchAllRecordings,
  } = useRecording();

  // ==========================================================================
  // CUSTOM HOOKS - NOTIFICATIONS
  // ==========================================================================
  const {
    notification,
    showNotification,
    showNotificationMessage,
    hideNotification,
  } = useMeetingNotifications();

  // ==========================================================================
  // STATE - PARTICIPANTS & CO-HOSTS
  // ==========================================================================
  const [liveParticipants, setLiveParticipants] = useState([]);
  const [participantStats, setParticipantStats] = useState({
    total: 0,
    active: 0,
    livekit: 0,
  });
  const [coHosts, setCoHosts] = useState([]);
  const [isCoHost, setIsCoHost] = useState(false);
  const [coHostLoading, setCoHostLoading] = useState(false);
  const [coHostPrivilegesActive, setCoHostPrivilegesActive] = useState(false);

  // ==========================================================================
  // STATE - ATTENDANCE
  // ==========================================================================
  const [attendanceEnabled, setAttendanceEnabled] = useState(true);
  const [attendanceMinimized, setAttendanceMinimized] = useState(false);
  const [currentAttendanceData, setCurrentAttendanceData] = useState({
    attendancePercentage: 100,
    engagementScore: 100,
    violations: [],
    breakUsed: false,
    sessionActive: true,
  });

  // ==========================================================================
  // STATE - FEEDBACK
  // ==========================================================================
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // ==========================================================================
  // STATE - CHAT
  // ==========================================================================
  const [chatStats, setChatStats] = useState({
    unread: 0,
    total: 0,
    hasNewMessages: false,
  });
  const [totalMessages, setTotalMessages] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // ==========================================================================
  // STATE - MEETING SETTINGS
  // ==========================================================================
  const [meetingSettings, setMeetingSettings] = useState({
    waitingRoom: true,
    recording: true,
    autoRecord: false,
    transcription: false,
    muteOnEntry: true,
    videoOnEntry: false,
    chatEnabled: true,
    screenShareEnabled: true,
    screenShareRequiresApproval: true,
    reactionsEnabled: true,
    handRaiseEnabled: true,
    maxParticipants: 50,
    meetingPassword: "",
    recordingQuality: "hd",
    audioQuality: "high",
    autoEndMeeting: 120,
    allowGuestAccess: false,
    hostOnlyScreenShare: false,
    hostOnlyMute: false,
    coHostManagement: true,
    attendanceTracking: true,
    attendanceMinimized: false,
    whiteboardEnabled: true,
    whiteboardHostOnly: false,
  });

  // ==========================================================================
  // STATE - UI
  // ==========================================================================
  const [viewMode, setViewMode] = useState("grid");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [performanceWarning, setPerformanceWarning] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [meetingLink, setMeetingLink] = useState("");

  // ==========================================================================
  // STATE - QUEUE
  // ==========================================================================
  const [showQueueOverlay, setShowQueueOverlay] = useState(false);
  const [queuePosition, setQueuePosition] = useState(0);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState(0);
  const [connectionProgress, setConnectionProgress] = useState(0);

  // ==========================================================================
  // STATE - RECORDING
  // ==========================================================================
  const [recordingState, setRecordingState] = useState({
    isRecording: false,
    isPaused: false,
    method: null,
    startTime: null,
    duration: 0,
    pausedDuration: 0,
    error: null,
    uploading: false,
    uploadProgress: 0,
  });
  const [showRecordingNameDialog, setShowRecordingNameDialog] = useState(false);
  const [pendingRecordingData, setPendingRecordingData] = useState(null);
  const [clientMediaRecorder, setClientMediaRecorder] = useState(null);
  const [clientRecordedChunks, setClientRecordedChunks] = useState([]);
  const [clientRecordingStream, setClientRecordingStream] = useState(null);
  const [recordingMetadata, setRecordingMetadata] = useState(null);

  // ==========================================================================
  // STATE - WHITEBOARD
  // ==========================================================================
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [whiteboardError, setWhiteboardError] = useState(null);

  // ==========================================================================
  // REFS
  // ==========================================================================
  const connectionAttemptRef = useRef(false);
  const hasInitialConnectionRef = useRef(false);
  const connectionRetryCountRef = useRef(0);
  const streamCacheRef = useRef(new Map());
  const participantUpdateTimerRef = useRef(null);
  const performanceMonitorRef = useRef(null);
  const queueCheckIntervalRef = useRef(null);
  const audioInitializedRef = useRef(false);
  const videoInitializedRef = useRef(false);
  const coHostSyncTimerRef = useRef(null);
  const meetingContainerRef = useRef(null);
  const roomRef = useRef(null);
  // ==========================================================================
// STATE FOR REMOTE VIDEO STREAMS
// ==========================================================================
const [remoteVideoStreams, setRemoteVideoStreams] = useState(new Map());
const remoteVideoStreamsRef = useRef(new Map());

  // ==========================================================================
  // CUSTOM HOOKS - TABS
  // ==========================================================================
  const {
    activeTab,
    availableTabs,
    setActiveTab,
    setAvailableTabs,
    handleCloseTab,
    addTab,
  } = useMeetingTabs({ showNotificationMessage });


// Add state for forcing re-renders
const [participantsVersion, setParticipantsVersion] = useState(0);
  

  // ==========================================================================
  // CUSTOM HOOKS - PANELS
  // ==========================================================================
  const {
    chatOpen,
    participantsOpen,
    reactionsOpen,
    handRaiseOpen,
    showToggleMenu,
    setChatOpen,
    setParticipantsOpen,
    setHandRaiseOpen,
    setShowToggleMenu,
    handleToggleChat,
    handleParticipantsButtonClick,
    handleToggleReactions,
    handleToggleHandRaise: panelToggleHandRaise,
    handleToggleMenu,
    closeAllPanels,
    setReactionsOpen,
  } = useMeetingPanels();

  // ==========================================================================
  // CUSTOM HOOKS - DIALOGS
  // ==========================================================================
// Around line 220-240 in MeetingRoom.jsx - Update the hook import and add new dialog states

const {
  showLeaveDialog,
  showEndMeetingDialog,
  showScreenShareRequest,
  showMeetingLinkPopup,
  meetingLinkMinimized,
  showScreenShareStopped,
  screenShareStoppedBy,
  setShowLeaveDialog,
  setShowEndMeetingDialog,
  setShowScreenShareRequest,
  setShowMeetingLinkPopup,
  setMeetingLinkMinimized,
  setShowScreenShareStopped,
  setScreenShareStoppedBy,
} = useMeetingDialogs();

// ✅ ADD THESE NEW STATE VARIABLES AFTER useMeetingDialogs
const [showForceStopDialog, setShowForceStopDialog] = useState(false);
const [forceStopTargetParticipant, setForceStopTargetParticipant] = useState(null);

  // ==========================================================================
  // ENHANCED STREAM MAPPING
  // ==========================================================================
  const createEnhancedStreamMapping = useMemo(() => {
    const streamMap = new Map();

    if (
      streamCacheRef.current.size > 0 &&
      streamCacheRef.current._timestamp &&
      Date.now() - streamCacheRef.current._timestamp < 100
    ) {
      return streamCacheRef.current;
    }

    try {
      if (localParticipant && room) {
        if (typeof localParticipant.getTrackPublication === "function") {
          const localVideoTrack = localParticipant.getTrackPublication(
            Track.Source.Camera
          );
          const localAudioTrack = localParticipant.getTrackPublication(
            Track.Source.Microphone
          );
          const localScreenTrack = localParticipant.getTrackPublication(
            Track.Source.ScreenShare
          );

          if (
            localVideoTrack?.track?.mediaStreamTrack ||
            localAudioTrack?.track?.mediaStreamTrack
          ) {
            const stream = new MediaStream();

            if (localVideoTrack?.track?.mediaStreamTrack) {
              stream.addTrack(localVideoTrack.track.mediaStreamTrack);
            }

            if (localAudioTrack?.track?.mediaStreamTrack) {
              stream.addTrack(localAudioTrack.track.mediaStreamTrack);
            }

            const userId = currentUser?.id || "local";
            streamMap.set(userId.toString(), stream);
          }

          if (localScreenTrack?.track?.mediaStreamTrack) {
            const screenStream = new MediaStream([
              localScreenTrack.track.mediaStreamTrack,
            ]);
            const screenKey = `${currentUser?.id || "local"}_screen`;
            streamMap.set(screenKey, screenStream);
          }
        }
      }

      if (remoteParticipants?.size > 0) {
        remoteParticipants.forEach((participant, participantSid) => {
          try {
            if (typeof participant.getTrackPublication !== "function") {
              return;
            }

            const videoTrack = participant.getTrackPublication(
              Track.Source.Camera
            );
            const audioTrack = participant.getTrackPublication(
              Track.Source.Microphone
            );
            const screenTrack = participant.getTrackPublication(
              Track.Source.ScreenShare
            );

            let userId = participant.identity;
            if (participant.identity?.includes("user_")) {
              userId = participant.identity.split("_")[1];
            }

            if (userId === currentUser?.id?.toString()) return;

            if (
              videoTrack?.track?.mediaStreamTrack ||
              audioTrack?.track?.mediaStreamTrack
            ) {
              const stream = new MediaStream();

              if (videoTrack?.track?.mediaStreamTrack) {
                stream.addTrack(videoTrack.track.mediaStreamTrack);
              }

              if (audioTrack?.track?.mediaStreamTrack) {
                stream.addTrack(audioTrack.track.mediaStreamTrack);
              }

              streamMap.set(userId.toString(), stream);
              streamMap.set(participantSid, stream);
            }

            if (screenTrack?.track?.mediaStreamTrack) {
              const screenStream = new MediaStream([
                screenTrack.track.mediaStreamTrack,
              ]);
              streamMap.set(`${userId}_screen`, screenStream);
            }
          } catch (error) {
            console.error("Error processing participant stream:", error);
          }
        });
      }

      const livekitScreenStream = getScreenShareStream?.();
      if (livekitScreenStream) {
        streamMap.set("screen_share_active", livekitScreenStream);
      }

      if (streamMap.size > PERFORMANCE_CONFIG.STREAM_CACHE_SIZE) {
        const entries = Array.from(streamMap.entries());
        const newMap = new Map(
          entries.slice(-PERFORMANCE_CONFIG.STREAM_CACHE_SIZE)
        );
        streamMap.clear();
        newMap.forEach((value, key) => streamMap.set(key, value));
      }

      streamCacheRef.current = streamMap;
      streamCacheRef.current._timestamp = Date.now();
    } catch (error) {
      console.error("Stream mapping error:", error);
    }

    return streamMap;
  }, [
    localParticipant,
    remoteParticipants,
    room,
    currentUser,
    localTracks,
    getScreenShareStream,
  ]);

  // ==========================================================================
  // ENHANCED SCREEN SHARE DATA
  // ==========================================================================
  const enhancedScreenShareData = useMemo(() => {
    if (livekitScreenSharingParticipant || livekitLocalIsScreenSharing) {
      const screenStream =
        getScreenShareStream?.() ||
        createEnhancedStreamMapping.get("screen_share_active");

      if (screenStream) {
        return {
          stream: screenStream,
          sharer: livekitScreenSharingParticipant || {
            name: currentUser?.name || currentUser?.full_name || "You",
            user_id: currentUser?.id,
            connection_id: currentUser?.id,
            participant_id: `local_${currentUser?.id}`,
            isLocal: true,
          },
        };
      }
    }

    if (remoteParticipants?.size > 0) {
      for (const [participantSid, participant] of remoteParticipants) {
        if (typeof participant.getTrackPublication === "function") {
          const screenSharePub = participant.getTrackPublication(
            Track.Source.ScreenShare
          );
          if (screenSharePub?.track?.mediaStreamTrack) {
            const screenStream = new MediaStream([
              screenSharePub.track.mediaStreamTrack,
            ]);
            let userId = participant.identity;
            if (participant.identity?.includes("user_")) {
              userId = participant.identity.split("_")[1];
            }

            return {
              stream: screenStream,
              sharer: {
                name: participant.name || participant.identity || "Remote User",
                user_id: userId,
                connection_id: participantSid,
                participant_id: participantSid,
                isLocal: false,
              },
            };
          }
        }
      }
    }

    if (screenShareStream) {
      return {
        stream: screenShareStream,
        sharer: screenSharer || { name: "Unknown", user_id: "unknown" },
      };
    }

    return { stream: null, sharer: null };
  }, [
    livekitScreenSharingParticipant,
    livekitLocalIsScreenSharing,
    getScreenShareStream,
    createEnhancedStreamMapping,
    screenShareStream,
    screenSharer,
    currentUser,
    localParticipant,
    remoteParticipants,
  ]);

  // ==========================================================================
  // CUSTOM HOOKS - MEETING CONTROLS
  // ==========================================================================
  const {
    audioEnabled,
    videoEnabled,
    screenSharing,
    showScreenShareWaiting,
    setAudioEnabled,
    setVideoEnabled,
    setScreenSharing,
    setShowScreenShareWaiting,
    audioInitializedRef: controlsAudioInitRef,
    videoInitializedRef: controlsVideoInitRef,
    handleToggleAudio,
    handleToggleVideo,
    handleCameraToggle,
  } = useMeetingControls({
    livekitToggleAudio,
    livekitToggleVideo,
    livekitStartScreenShare,
    livekitStopScreenShare,
    livekitLocalIsScreenSharing,
    enableAudio,
    enableVideo,
    isConnectionReady: livekitConnected && room && localParticipant,
    onToggleAudio,
    onToggleVideo,
    showNotificationMessage,
    canShareScreenDirectly: isHost || isCoHost || coHostPrivilegesActive,
    hasHostPrivileges: isHost || isCoHost || coHostPrivilegesActive,
    meetingSettings,
    screenSharePermissions,
    room,
    forceStopParticipantScreenShare, // ✅ ADD THIS LINE
    isHost, // ✅ ADD THIS LINE
    isCoHost, // ✅ ADD THIS LINE
    coHostPrivilegesActive, // ✅ ADD THIS LINE
    currentUser, // ✅ ADD THIS LINE
    enhancedScreenShareData, // ✅ ADD THIS LINE
  });


  // ==========================================================================
  // CAMERA SYNC HANDLER FOR ATTENDANCE TRACKER
  // ==========================================================================
  const handleCameraToggleForAttendance = useCallback(async (enable) => {
    if (typeof enable !== 'boolean') return;

    const currentlyEnabled = livekitVideoEnabled ?? videoEnabled ?? false;

    // No change needed — already in desired state
    if (enable === currentlyEnabled) return;

    try {
      if (enable) {
        // Enable video — prefer enableVideo (publishes track), fallback to toggle
        if (enableVideo && typeof enableVideo === 'function') {
          await enableVideo();
        } else if (livekitToggleVideo && typeof livekitToggleVideo === 'function') {
          await livekitToggleVideo();
        }
        setVideoEnabled(true);
      } else {
        // Disable video
        if (livekitToggleVideo && typeof livekitToggleVideo === 'function') {
          await livekitToggleVideo();
        }
        setVideoEnabled(false);
      }
    } catch (error) {
      console.error('Camera toggle for attendance sync failed:', error);
    }
  }, [livekitVideoEnabled, videoEnabled, enableVideo, livekitToggleVideo, setVideoEnabled]);
  // ==========================================================================
  // COMPUTED VALUES
  // ==========================================================================
  const actualIsConnected = livekitConnected || connected || false;
  const isConnectionReady = actualIsConnected && room && localParticipant;
  const currentPerformanceMode = performanceMode || "standard";
  const currentMaxParticipants = maxParticipants || 50;

  const effectiveRole = useMemo(() => {
    if (isHost) return "host";
    if (isCoHost || coHostPrivilegesActive) return "co-host";
    return "student";
  }, [isHost, isCoHost, coHostPrivilegesActive]);

  const hasHostPrivileges = useMemo(() => {
    return isHost || isCoHost || coHostPrivilegesActive;
  }, [isHost, isCoHost, coHostPrivilegesActive]);

  const canMakeCoHost = useMemo(() => {
    return isHost;
  }, [isHost]);

  const canRemoveCoHost = useMemo(() => {
    return isHost;
  }, [isHost]);

  const canShareScreenDirectly = useMemo(() => {
    return isHost || isCoHost || coHostPrivilegesActive;
  }, [isHost, isCoHost, coHostPrivilegesActive]);


  
   // ==========================================================================
  // HAND RAISE HOOK
  // ==========================================================================
 const {
  raisedHands,
  isHandRaised,
  handRaiseStats,
  isLoading: handRaiseLoading,
  error: handRaiseError,
  toggleHandRaise,
  acknowledgeHand,
  clearAllHands,
  loadRaisedHands,
  pendingHandsCount,
  totalHandsCount,
  isInitialized: handRaiseInitialized,
} = useHandRaise(realMeetingId, currentUser, isHost, room, hasHostPrivileges);


  // ==========================================================================
  // HELPER FUNCTIONS
  // ==========================================================================
  const getParticipantDisplayName = useCallback((participant) => {
    if (!participant) return "Unknown User";
    return (
      participant.full_name ||
      participant.Full_Name ||
      participant.name ||
      participant.displayName ||
      participant.username ||
      participant.user_name ||
      "Unknown User"
    );
  }, []);

  // ==========================================================================
  // PARTICIPANT LOADING
  // ==========================================================================
  const loadLiveParticipants = useCallback(
    throttle(async (forceRefresh = false) => {
      if (!realMeetingId) return;

      try {
        const response = await participantsAPI.getLiveParticipantsEnhanced(
          realMeetingId
        );

        // ✅ DEBUG: Log raw API response
        console.log("🔍 RAW API participants:", response.participants?.length, response.participants);

        if (response.success) {
          const processedParticipants = response.participants.map(
            (participant) => ({
              ...participant,
              id: participant.User_ID || participant.ID,
              user_id: participant.User_ID || participant.user_id,
              name:
                participant.Full_Name ||
                participant.name ||
                `User ${participant.User_ID}`,
              full_name:
                participant.Full_Name ||
                participant.name ||
                `User ${participant.User_ID}`,
              displayName:
                participant.Full_Name ||
                participant.name ||
                `User ${participant.User_ID}`,
              isOnline:
                participant.Status === "live" ||
                participant.Status === "connecting",
              isLive: participant.Status === "live",
              LiveKit_Connected: participant.LiveKit_Connected || false,
              Has_Stream: participant.Has_Stream || false,
              audio_enabled: participant.LiveKit_Data?.has_audio_track || false,
              video_enabled: participant.LiveKit_Data?.has_video_track || false,
              isAudioEnabled:
                participant.LiveKit_Data?.has_audio_track || false,
              isVideoEnabled:
                participant.LiveKit_Data?.has_video_track || false,
              connection_quality: "good",
              speaking: false,
              isHost: participant.Role === "host",
              role: participant.Role || "participant",
              isCoHost: false,
              effectiveRole: participant.Role || "participant",
              stream: null,
              // ✅ IMPORTANT: Preserve these fields from API
              Is_Currently_Active: participant.Is_Currently_Active,
              Leave_Time: participant.Leave_Time,
            })
          );

          // ✅ FIXED: Filter logic - prioritize Is_Currently_Active over Leave_Time
          const activeParticipants = processedParticipants.filter((p) => {
            // ✅ If participant is currently active (including rejoined), keep them
            if (p.Is_Currently_Active === true || p.is_currently_active === true) {
              return true;
            }
            
            // ✅ If local user, always keep
            if (p.User_ID == currentUser?.id || p.user_id == currentUser?.id) {
              return true;
            }
            
            // ✅ Only filter out if they have Leave_Time AND are NOT currently active
            if (p.Leave_Time && !p.Is_Currently_Active) {
              return false;
            }
            
            return true;
          });

          // ✅ DEBUG: Log filter results
          console.log("🔍 loadLiveParticipants filter result:", {
            beforeFilter: processedParticipants.length,
            afterFilter: activeParticipants.length,
            participants: activeParticipants.map(p => ({
              name: p.Full_Name || p.name,
              userId: p.User_ID,
              isActive: p.Is_Currently_Active,
              leaveTime: p.Leave_Time
            }))
          });

          setLiveParticipants(activeParticipants);
          setParticipantStats({
            total: response.summary?.total_participants || 0,
            active: activeParticipants.length,
            livekit: response.summary?.livekit_participants || 0,
          });

          window.dispatchEvent(
            new CustomEvent("participantListChanged", {
              detail: {
                participants: activeParticipants,
                timestamp: Date.now(),
                source: "meeting_room_refresh",
                forceRefresh: forceRefresh,
                filteredOut:
                  processedParticipants.length - activeParticipants.length,
              },
            })
          );

          window.dispatchEvent(
            new CustomEvent("refreshParticipantNames", {
              detail: {
                participants: activeParticipants,
                timestamp: Date.now(),
                source: "load_participants_success",
              },
            })
          );
        }
      } catch (error) {
        console.error("❌ Failed to load participants:", error);
      }
    }, PERFORMANCE_CONFIG.THROTTLE_DELAY),
    [realMeetingId, currentUser?.id]
  );

  const handleParticipantsUpdated = useCallback(() => {
    loadLiveParticipants(true);
  }, [loadLiveParticipants]);
 // ADD THIS NEW HANDLER
const handlePauseResumeRecording = useCallback(async () => {
  if (!hasHostPrivileges) {
    showNotificationMessage(
      "Only hosts and co-hosts can control recording",
      "warning"
    );
    return;
  }

  const meetingIdForRecording = realMeetingId || meetingData?.id;
  if (!meetingIdForRecording) {
    showNotificationMessage("No meeting ID available", "error");
    return;
  }

  if (!recordingState.isRecording) {
    showNotificationMessage("No active recording to pause/resume", "warning");
    return;
  }

  try {
    if (recordingState.isPaused) {
      // RESUME
      showNotificationMessage("Resuming recording...", "info");
      
      const response = await meetingsAPI.resumeStreamRecording(meetingIdForRecording);
      
      if (response.success) {
        setRecordingState(prev => ({
          ...prev,
          isPaused: false,
          pausedDuration: prev.pausedDuration + (response.paused_duration_seconds || 0),
        }));
        
        // Broadcast to all participants
        if (room && room.localParticipant) {
          const encoder = new TextEncoder();
          const recordingData = encoder.encode(
            JSON.stringify({
              type: "recording_status",
              action: "resume",
              recording: true,
              isPaused: false,
              resumedBy: currentUser.id,
              resumedByName: getParticipantDisplayName(currentUser),
              timestamp: Date.now(),
            })
          );
          await room.localParticipant.publishData(
            recordingData,
            DataPacket_Kind.RELIABLE
          );
        }
        
        showNotificationMessage("Recording resumed", "success");
      } else {
        throw new Error(response.message || "Failed to resume recording");
      }
    } else {
      // PAUSE
      showNotificationMessage("Pausing recording...", "info");
      
      const response = await meetingsAPI.pauseStreamRecording(meetingIdForRecording);
      
      if (response.success) {
        setRecordingState(prev => ({
          ...prev,
          isPaused: true,
        }));
        
        // Broadcast to all participants
        if (room && room.localParticipant) {
          const encoder = new TextEncoder();
          const recordingData = encoder.encode(
            JSON.stringify({
              type: "recording_status",
              action: "pause",
              recording: true,
              isPaused: true,
              pausedBy: currentUser.id,
              pausedByName: getParticipantDisplayName(currentUser),
              timestamp: Date.now(),
            })
          );
          await room.localParticipant.publishData(
            recordingData,
            DataPacket_Kind.RELIABLE
          );
        }
        
        showNotificationMessage("Recording paused", "success");
      } else {
        throw new Error(response.message || "Failed to pause recording");
      }
    }
  } catch (error) {
    console.error("Pause/Resume recording error:", error);
    showNotificationMessage(`Error: ${error.message}`, "error");
  }
}, [
  hasHostPrivileges,
  realMeetingId,
  meetingData?.id,
  recordingState.isRecording,
  recordingState.isPaused,
  currentUser,
  room,
  getParticipantDisplayName,
  showNotificationMessage,
]);
  // ==========================================================================
  // CO-HOST MANAGEMENT
  // ==========================================================================
  const loadCoHosts = useCallback(async () => {
    if (!realMeetingId) return;

    try {
      setCoHostLoading(true);
      const response = await meetingsAPI.getCoHosts(realMeetingId);

      const cohostList = response.cohosts || [];
      setCoHosts(cohostList);

      const currentUserIsCoHost = cohostList.some((cohost) => {
        const cohostUserId = (cohost.user_id || cohost.User_ID)?.toString();
        const currentUserId = currentUser?.id?.toString();
        return cohostUserId === currentUserId;
      });

      if (currentUserIsCoHost !== isCoHost) {
        setIsCoHost(currentUserIsCoHost);
        setCoHostPrivilegesActive(currentUserIsCoHost);

        if (updateCoHostStatus && typeof updateCoHostStatus === "function") {
          updateCoHostStatus(currentUserIsCoHost);
        }

        if (currentUserIsCoHost) {
          showNotificationMessage("You are now a co-host", "success");
        } else if (isCoHost && !currentUserIsCoHost) {
          showNotificationMessage(
            "Co-host privileges have been removed",
            "info"
          );
          setCoHostPrivilegesActive(false);

          if (updateCoHostStatus && typeof updateCoHostStatus === "function") {
            updateCoHostStatus(false);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load co-hosts:", error);
      setCoHosts([]);
      setIsCoHost(false);
      setCoHostPrivilegesActive(false);

      if (updateCoHostStatus && typeof updateCoHostStatus === "function") {
        updateCoHostStatus(false);
      }
    } finally {
      setCoHostLoading(false);
    }
  }, [
    realMeetingId,
    currentUser?.id,
    isCoHost,
    showNotificationMessage,
    updateCoHostStatus,
  ]);

  const handlePromoteToCoHost = useCallback(
    async (participantData) => {
      if (!canMakeCoHost) {
        showNotificationMessage(
          "Only the host can assign co-host roles",
          "error"
        );
        return { success: false, error: "Only host can assign co-hosts" };
      }

      try {
        const userId =
          participantData.userId ||
          participantData.user_id ||
          participantData.participantId;
        const participant = participantData.participant || participantData;
        const userName =
          participant?.displayName ||
          participant?.name ||
          participant?.full_name ||
          `User ${userId}`;

        const response = await meetingsAPI.assignCoHost(
          realMeetingId,
          userId,
          currentUser.id,
          userName
        );

        showNotificationMessage(
          `${userName} is now a co-host with full privileges!`,
          "success"
        );

        await Promise.all([loadCoHosts(), loadLiveParticipants()]);

        return { success: true, response };
      } catch (error) {
        console.error("❌ Failed to promote to co-host:", error);
        const errorMessage =
          error.response?.data?.error ||
          error.message ||
          "Failed to assign co-host";
        showNotificationMessage(
          `Failed to assign co-host: ${errorMessage}`,
          "error"
        );
        return { success: false, error: errorMessage };
      }
    },
    [
      canMakeCoHost,
      realMeetingId,
      currentUser?.id,
      showNotificationMessage,
      loadCoHosts,
      loadLiveParticipants,
    ]
  );

  const handleRemoveCoHost = useCallback(
    async (userId, userName) => {
      if (!canRemoveCoHost) {
        showNotificationMessage(
          "Only the original host can remove co-host privileges",
          "error"
        );
        return { success: false, error: "Only host can remove co-hosts" };
      }

      try {
        const response = await meetingsAPI.removeCoHost(
          realMeetingId,
          userId,
          currentUser.id
        );

        showNotificationMessage(
          `Removed co-host privileges from ${userName}`,
          "success"
        );

        await Promise.all([loadCoHosts(), loadLiveParticipants()]);

        return { success: true, response };
      } catch (error) {
        console.error("❌ Failed to remove co-host:", error);
        const errorMessage =
          error.response?.data?.error ||
          error.message ||
          "Failed to remove co-host";
        showNotificationMessage(
          `Failed to remove co-host: ${errorMessage}`,
          "error"
        );
        return { success: false, error: errorMessage };
      }
    },
    [
      canRemoveCoHost,
      realMeetingId,
      currentUser?.id,
      showNotificationMessage,
      loadCoHosts,
      loadLiveParticipants,
      isHost,
    ]
  );

  // ==========================================================================
  // CUSTOM HOOKS - PARTICIPANT ACTIONS
  // ==========================================================================
  const {
    handleMuteParticipant,
    handleUnmuteParticipant,
    handleMuteVideo,
    handleUnmuteVideo,
    handleRemoveParticipant,
  } = useParticipantActions({
    room,
    currentUser,
    hasHostPrivileges,
    allParticipants: liveParticipants,
    getParticipantDisplayName,
    showNotificationMessage,
    loadLiveParticipants,
    setLiveParticipants,
    setParticipantStats,
  });

  const combinedStreams = useMemo(() => {
    const combined = new Map();

    console.log("🔄 Building combined streams map");

    // ✅ Add all enhanced streams first
    createEnhancedStreamMapping.forEach((stream, key) => {
      if (stream instanceof MediaStream && stream.getTracks().length > 0) {
        combined.set(key, stream);
        console.log("✅ Added enhanced stream:", key, {
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
        });
      }
    });

    // ✅ Add all remote streams
    remoteStreams.forEach((stream, key) => {
      if (stream instanceof MediaStream && !combined.has(key)) {
        combined.set(key, stream);
        console.log("✅ Added remote stream:", key);
      }
    });

    // ✅ Add local stream with MULTIPLE keys
    if (localStream && currentUser) {
      const localKeys = [
        currentUser.id,
        currentUser.id?.toString(),
        `user_${currentUser.id}`,
        `participant_${currentUser.id}`,
        "local",
      ];

      localKeys.forEach((key) => {
        if (key && !combined.has(key)) {
          combined.set(key, localStream);
          console.log("✅ Added local stream with key:", key);
        }
      });
    }

    console.log("🎥 Combined Streams Final:", {
      totalStreams: combined.size,
      allKeys: Array.from(combined.keys()),
    });

    return combined;
  }, [createEnhancedStreamMapping, remoteStreams, localStream, currentUser]);


  const allParticipants = useMemo(() => {
    const participantMap = new Map();

    // ✅ Combine all stream sources for lookup
    const allStreams = new Map([
      ...combinedStreams,
      ...remoteVideoStreams,
    ]);

    console.log("📹 Processing allParticipants:", {
      liveParticipantsCount: liveParticipants?.length || 0,
      remoteParticipantsCount: remoteParticipants?.size || 0,
      combinedStreamsCount: combinedStreams.size,
      remoteVideoStreamsCount: remoteVideoStreams.size,
      totalStreams: allStreams.size,
      participantsVersion,
      hasLocalParticipant: !!localParticipant,
      hasRoom: !!room,
    });

    // ==========================================================================
    // HELPER: Find stream with multiple key attempts
    // ==========================================================================
    const findStreamForParticipant = (userId, participantSid, participantIdentity) => {
      const streamKeys = [
        participantSid,
        participantIdentity,
        userId?.toString(),
        userId,
        `user_${userId}`,
        `participant_${userId}`,
      ].filter(Boolean);

      for (const key of streamKeys) {
        if (allStreams.has(key)) {
          return { stream: allStreams.get(key), key };
        }
      }
      return { stream: null, key: null };
    };

    // ==========================================================================
    // HELPER: Get LiveKit participant reference
    // ==========================================================================
    const getLocalLiveKitParticipant = () => {
      // Try multiple sources for the local participant
      if (localParticipant) {
        return localParticipant;
      }
      if (room?.localParticipant) {
        return room.localParticipant;
      }
      return null;
    };

    // ==========================================================================
    // PROCESS DATABASE PARTICIPANTS (liveParticipants)
    // ==========================================================================
    liveParticipants.forEach((p) => {
      const key = p.User_ID || p.ID || p.user_id;
      if (!key) return;

      const isParticipantCoHost = coHosts.some(
        (cohost) => cohost.user_id?.toString() === key.toString()
      );

      // Find stream
      const { stream: participantStream, key: foundKey } = findStreamForParticipant(key, null, null);
      
      if (participantStream) {
        console.log(`✅ Found stream for DB participant ${p.Full_Name || p.name} with key: ${foundKey}`);
      }

      participantMap.set(key.toString(), {
        ...p,
        id: key,
        user_id: key,
        participant_id: p.ID || `db_${key}`,
        full_name: getParticipantDisplayName(p),
        name: getParticipantDisplayName(p),
        displayName: getParticipantDisplayName(p),
        role: p.Role || "participant",
        isHost: p.Role === "host",
        isCoHost: isParticipantCoHost,
        effectiveRole:
          p.Role === "host"
            ? "host"
            : isParticipantCoHost
              ? "co-host"
              : "participant",
        isVideoEnabled: p.video_enabled || p.isVideoEnabled || false,
        isAudioEnabled: p.audio_enabled || p.isAudioEnabled || false,
        video_enabled: p.video_enabled || p.isVideoEnabled || false,
        audio_enabled: p.audio_enabled || p.isAudioEnabled || false,
        isCameraEnabled: p.video_enabled || p.isVideoEnabled || false,
        isMicrophoneEnabled: p.audio_enabled || p.isAudioEnabled || false,
        isLocal: p.User_ID == currentUser?.id || p.user_id == currentUser?.id,
        Status: p.Status || "online",
        LiveKit_Connected: p.LiveKit_Connected || false,
        stream: participantStream,
        videoStream: participantStream,
        hasVideoStream: !!participantStream,
        connection_id: p.User_ID || p.ID,
        isScreenSharing: false,
        liveKitParticipant: null,
      });
    });

    // ==========================================================================
    // PROCESS LOCAL USER (CURRENT USER) - CRITICAL FIX FOR LOCAL VIDEO
    // ==========================================================================
    if (currentUser) {
      const localKey = currentUser.id?.toString();
      const displayName = getParticipantDisplayName(currentUser);

      // ✅ CRITICAL: Get the LiveKit participant reference FIRST
      const liveKitLocalParticipant = getLocalLiveKitParticipant();

      // ✅ CRITICAL FIX: Try to get local stream from MULTIPLE sources
      let localStreamFromCombined = null;

      // Method 1: Try from allStreams with multiple keys
      const localStreamKeys = [
        localKey,
        `user_${localKey}`,
        "local",
        "host",
        currentUser.id,
        `participant_${localKey}`,
      ];

      for (const streamKey of localStreamKeys) {
        if (streamKey && allStreams.has(streamKey)) {
          const stream = allStreams.get(streamKey);
          if (stream instanceof MediaStream && stream.getVideoTracks().length > 0) {
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack.readyState === 'live') {
              localStreamFromCombined = stream;
              console.log(`✅ Found LOCAL stream with key: ${streamKey}, tracks: ${stream.getTracks().length}`);
              break;
            }
          }
        }
      }

      // Method 2: Fallback to direct localStream prop
      if (!localStreamFromCombined && localStream && localStream instanceof MediaStream) {
        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
          localStreamFromCombined = localStream;
          console.log("✅ Using direct localStream as fallback");
        }
      }

      // ✅ CRITICAL FIX: Method 3 - Create stream directly from LiveKit localParticipant
      if (!localStreamFromCombined && videoEnabled && liveKitLocalParticipant) {
        try {
          const cameraPublication = liveKitLocalParticipant.getTrackPublication?.(Track.Source.Camera);
          const cameraTrack = cameraPublication?.track;
          
          console.log("📹 Checking LiveKit local camera track:", {
            hasPublication: !!cameraPublication,
            hasTrack: !!cameraTrack,
            hasMediaStreamTrack: !!cameraTrack?.mediaStreamTrack,
            readyState: cameraTrack?.mediaStreamTrack?.readyState,
            isMuted: cameraTrack?.isMuted,
          });

          if (cameraTrack?.mediaStreamTrack) {
            const mediaStreamTrack = cameraTrack.mediaStreamTrack;
            const trackState = mediaStreamTrack.readyState;
            
            if (trackState === 'live') {
              localStreamFromCombined = new MediaStream([mediaStreamTrack]);
              console.log("✅ Created LOCAL stream from LiveKit camera track directly, streamId:", localStreamFromCombined.id);
            } else {
              console.warn(`⚠️ LiveKit camera track not live: state=${trackState}`);
            }
          }
        } catch (error) {
          console.warn("⚠️ Could not create local stream from LiveKit:", error);
        }
      }

      // ✅ Method 4: If video just enabled, wait briefly and retry from LiveKit
      if (!localStreamFromCombined && videoEnabled && liveKitLocalParticipant) {
        // Check if camera is actually enabled on LiveKit side
        const isCameraActuallyEnabled = liveKitLocalParticipant.isCameraEnabled;
        console.log("📹 LiveKit isCameraEnabled:", isCameraActuallyEnabled);
        
        if (isCameraActuallyEnabled) {
          try {
            const cameraPublication = liveKitLocalParticipant.getTrackPublication?.(Track.Source.Camera);
            if (cameraPublication?.track?.mediaStreamTrack) {
              localStreamFromCombined = new MediaStream([cameraPublication.track.mediaStreamTrack]);
              console.log("✅ Created LOCAL stream on retry from LiveKit");
            }
          } catch (e) {
            console.warn("⚠️ Retry failed:", e);
          }
        }
      }

      // Determine screen sharing state
      const isLocalScreenSharing =
        livekitLocalIsScreenSharing ||
        (liveKitLocalParticipant &&
          typeof liveKitLocalParticipant.getTrackPublication === "function" &&
          !!liveKitLocalParticipant.getTrackPublication(Track.Source.ScreenShare)?.track);

      // ✅ Determine actual video state from LiveKit
      const actualVideoEnabled = liveKitLocalParticipant?.isCameraEnabled ?? videoEnabled;
      const actualAudioEnabled = liveKitLocalParticipant?.isMicrophoneEnabled ?? audioEnabled;

      console.log("📹 Local participant final state:", {
        name: displayName,
        videoEnabled,
        actualVideoEnabled,
        audioEnabled,
        actualAudioEnabled,
        hasStream: !!localStreamFromCombined,
        streamId: localStreamFromCombined?.id,
        videoTracks: localStreamFromCombined?.getVideoTracks()?.length || 0,
        hasLiveKitParticipant: !!liveKitLocalParticipant,
        liveKitIdentity: liveKitLocalParticipant?.identity,
      });

      // ✅ CRITICAL: Set local participant with liveKitParticipant reference
      participantMap.set(localKey, {
        id: currentUser.id,
        user_id: currentUser.id,
        participant_id: `local_${currentUser.id}`,
        connection_id: `participant_${currentUser.id}`,
        identity: liveKitLocalParticipant?.identity || `user_${currentUser.id}`,
        sid: liveKitLocalParticipant?.sid || null,
        full_name: displayName,
        name: displayName,
        displayName: displayName,
        email: currentUser.email || "",
        isLocal: true,
        
        // ✅ CRITICAL: Use actual LiveKit state if available
        isVideoEnabled: actualVideoEnabled,
        isAudioEnabled: actualAudioEnabled,
        video_enabled: actualVideoEnabled,
        audio_enabled: actualAudioEnabled,
        isCameraEnabled: actualVideoEnabled,
        isMicrophoneEnabled: actualAudioEnabled,
        
        role: isHost ? "host" : "participant",
        isHost: isHost,
        isCoHost: isCoHost,
        effectiveRole: isHost ? "host" : isCoHost ? "co-host" : "participant",
        
        // ✅ CRITICAL: Include streams
        stream: localStreamFromCombined,
        videoStream: localStreamFromCombined,
        hasVideoStream: !!localStreamFromCombined,
        
        isScreenSharing: isLocalScreenSharing,
        connectionQuality: "good",
        Status: actualIsConnected ? "live" : "connecting",
        LiveKit_Connected: actualIsConnected,
        
        // ✅ CRITICAL FIX: Include LiveKit participant reference for direct track access in VideoGrid
        liveKitParticipant: liveKitLocalParticipant,
      });
    }

    // ==========================================================================
    // PROCESS REMOTE PARTICIPANTS FROM LIVEKIT - CRITICAL FOR VIDEO SYNC
    // ==========================================================================
    if (remoteParticipants?.size > 0) {
      remoteParticipants.forEach((participant) => {
        // Extract user ID from identity
        let userId = participant.identity;
        if (participant.identity?.includes("user_")) {
          userId = participant.identity.split("_")[1];
        }

        const userKey = userId?.toString();
        
        // Skip if this is the current user
        if (userKey === currentUser?.id?.toString()) return;

        // ✅ CRITICAL: Use LiveKit's REAL-TIME track states - THIS IS THE SOURCE OF TRUTH
        const liveAudioEnabled = participant.isMicrophoneEnabled ?? false;
        const liveVideoEnabled = participant.isCameraEnabled ?? false;

        // Check for screen sharing
        const isParticipantScreenSharing =
          typeof participant.getTrackPublication === "function" &&
          !!participant.getTrackPublication(Track.Source.ScreenShare)?.track;

        // Get existing participant data from database
        const existingParticipant = participantMap.get(userKey);

        // ✅ CRITICAL: Get video stream - Try multiple approaches
        let participantStream = null;
        let streamSource = "none";

        // Approach 1: Try from allStreams (combined + remote video streams)
        const { stream: foundStream, key: foundKey } = findStreamForParticipant(
          userId, 
          participant.sid, 
          participant.identity
        );

        if (foundStream && foundStream instanceof MediaStream) {
          const videoTracks = foundStream.getVideoTracks();
          if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
            participantStream = foundStream;
            streamSource = `allStreams[${foundKey}]`;
          }
        }

        // ✅ Approach 2: FALLBACK - Create stream directly from LiveKit track
        if (!participantStream && liveVideoEnabled) {
          try {
            const cameraPublication = participant.getTrackPublication?.(Track.Source.Camera);
            const cameraTrack = cameraPublication?.track;
            
            if (cameraTrack?.mediaStreamTrack) {
              const trackState = cameraTrack.mediaStreamTrack.readyState;
              const trackEnabled = cameraTrack.mediaStreamTrack.enabled;
              
              console.log(`📹 LiveKit track for ${participant.name || userId}:`, {
                trackState,
                trackEnabled,
                isMuted: cameraTrack.isMuted,
              });

              // Create stream if track is live
              if (trackState === 'live') {
                participantStream = new MediaStream([cameraTrack.mediaStreamTrack]);
                streamSource = "LiveKit direct";
                console.log(`✅ Created stream from LiveKit track for ${participant.name || userId}`);
              } else {
                console.warn(`⚠️ Track not live for ${participant.name}: state=${trackState}`);
              }
            } else {
              console.warn(`⚠️ No camera track for ${participant.name || userId} (camera enabled: ${liveVideoEnabled})`);
            }
          } catch (error) {
            console.warn("⚠️ Could not create stream from LiveKit track:", error);
          }
        }

        // ✅ Approach 3: Use getRemoteVideoStream helper if available
        if (!participantStream && liveVideoEnabled && typeof getRemoteVideoStream === 'function') {
          const helperStream = getRemoteVideoStream(userId);
          if (helperStream && helperStream instanceof MediaStream) {
            const videoTracks = helperStream.getVideoTracks();
            if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
              participantStream = helperStream;
              streamSource = "getRemoteVideoStream()";
            }
          }
        }

        // Determine display name
        // ✅ FIXED: Determine display name - search liveParticipants by userId if existingParticipant is missing
let displayName = null;

// Priority 1: Check existingParticipant (from participantMap)
if (existingParticipant) {
  displayName = existingParticipant.Full_Name || 
                existingParticipant.full_name || 
                existingParticipant.name ||
                existingParticipant.displayName;
}

// Priority 2: If no name yet, search liveParticipants array directly by userId
if (!displayName || displayName === `User ${userId}` || displayName?.includes('user_')) {
  const matchingDbParticipant = liveParticipants.find((p) => {
    const pId = (p.User_ID || p.user_id || p.ID)?.toString();
    return pId === userId?.toString();
  });
  
  if (matchingDbParticipant) {
    displayName = matchingDbParticipant.Full_Name || 
                  matchingDbParticipant.full_name || 
                  matchingDbParticipant.name ||
                  matchingDbParticipant.displayName;
    console.log(`✅ Found name from liveParticipants for userId ${userId}: ${displayName}`);
  }
}

// Priority 3: Use LiveKit participant.name if it's a real name (not fallback format)
if (!displayName || displayName === `User ${userId}` || displayName?.includes('user_')) {
  if (participant.name && 
      !participant.name.startsWith('User ') && 
      !participant.name.startsWith('User_') &&
      !participant.name.includes('user_')) {
    displayName = participant.name;
  }
}

// Priority 4: Final fallback
if (!displayName || displayName === `User ${userId}` || displayName?.includes('user_')) {
  displayName = `User ${userId}`;
  console.warn(`⚠️ Using fallback name for userId ${userId} - no name found in DB or LiveKit`);
}

console.log("📹 Remote participant name resolved:", {
  userId,
  identity: participant.identity,
  resolvedName: displayName,
  liveKitName: participant.name,
  hadExistingParticipant: !!existingParticipant,
});

        // Determine role
        const participantRole = existingParticipant?.role || "participant";
        const participantIsHost = existingParticipant?.isHost || participantRole === "host";
        const participantIsCoHost = coHosts.some(
          (cohost) => cohost.user_id?.toString() === userId?.toString()
        );

        console.log("📹 Remote participant processed:", {
          name: displayName,
          identity: participant.identity,
          userId,
          liveVideoEnabled,
          liveAudioEnabled,
          hasStream: !!participantStream,
          streamSource,
          streamId: participantStream?.id,
        });

        // Set in participant map - this OVERWRITES any database entry with LiveKit real-time data
        participantMap.set(userKey, {
          ...existingParticipant,
          id: userId,
          user_id: userId,
          identity: participant.identity,
          sid: participant.sid,
          participant_id: participant.sid,
          connection_id: participant.sid,
          full_name: displayName,
          name: displayName,
          displayName: displayName,
          isLocal: false,
          
          // ✅ CRITICAL: Use LiveKit's real-time states (NOT database states)
          isVideoEnabled: liveVideoEnabled,
          isAudioEnabled: liveAudioEnabled,
          isCameraEnabled: liveVideoEnabled,
          isMicrophoneEnabled: liveAudioEnabled,
          video_enabled: liveVideoEnabled,
          audio_enabled: liveAudioEnabled,
          
          role: participantRole,
          isHost: participantIsHost,
          isCoHost: participantIsCoHost,
          effectiveRole:
            participantRole === "host"
              ? "host"
              : participantIsCoHost
                ? "co-host"
                : "participant",
          Status: "live",
          LiveKit_Connected: true,
          connectionQuality: participant.connectionQuality || "good",
          
          // ✅ CRITICAL: Include video stream
          stream: participantStream,
          videoStream: participantStream,
          hasVideoStream: !!participantStream,
          
          isScreenSharing: isParticipantScreenSharing,
          
          // ✅ CRITICAL: Keep LiveKit participant reference for direct access
          liveKitParticipant: participant,
        });
      });
    }

    // ==========================================================================
    // HANDLE SCREEN SHARING PARTICIPANT
    // ==========================================================================
    if (livekitScreenSharingParticipant) {
      const sharingUserId =
        livekitScreenSharingParticipant.userId ||
        livekitScreenSharingParticipant.sid;

      if (livekitScreenSharingParticipant.isLocal && currentUser) {
        const localKey = currentUser.id?.toString();
        const localParticipantData = participantMap.get(localKey);
        if (localParticipantData) {
          participantMap.set(localKey, {
            ...localParticipantData,
            isScreenSharing: true,
          });
        }
      } else if (sharingUserId) {
        // Try to find the remote participant
        let foundKey = null;
        participantMap.forEach((p, key) => {
          if (
            p.sid === sharingUserId ||
            p.identity === sharingUserId ||
            key === sharingUserId?.toString()
          ) {
            foundKey = key;
          }
        });

        if (foundKey) {
          const remoteParticipantData = participantMap.get(foundKey);
          participantMap.set(foundKey, {
            ...remoteParticipantData,
            isScreenSharing: true,
          });
        }
      }
    }

    // ==========================================================================
    // SORT PARTICIPANTS
    // ==========================================================================
    const processedParticipants = Array.from(participantMap.values());

    processedParticipants.sort((a, b) => {
      // Local user first
      if (a.isLocal && !b.isLocal) return -1;
      if (!a.isLocal && b.isLocal) return 1;
      // Then hosts
      if (a.role === "host" && b.role !== "host") return -1;
      if (a.role !== "host" && b.role === "host") return 1;
      // Then co-hosts
      if (a.isCoHost && !b.isCoHost) return -1;
      if (!a.isCoHost && b.isCoHost) return 1;
      // Then alphabetically
      return (a.displayName || "").localeCompare(b.displayName || "");
    });

    // ✅ Final debug log
    console.log("📹 Final allParticipants:", processedParticipants.map(p => ({
      name: p.displayName,
      isLocal: p.isLocal,
      isHost: p.isHost,
      videoEnabled: p.isVideoEnabled,
      hasStream: !!p.stream,
      streamId: p.stream?.id?.slice(-8),
      hasLiveKitParticipant: !!p.liveKitParticipant,
    })));

    return processedParticipants;
  }, [
    liveParticipants,
    currentUser,
    localStream,
    videoEnabled,
    audioEnabled,
    isHost,
    isCoHost,
    coHosts,
    remoteParticipants,
    actualIsConnected,
    combinedStreams,
    remoteVideoStreams,
    localParticipant,
    room, // ✅ ADDED: room dependency for fallback
    livekitScreenSharingParticipant,
    livekitLocalIsScreenSharing,
    getParticipantDisplayName,
    getRemoteVideoStream,
    participantsVersion,
  ]);

  // ==========================================================================
  // CONNECTION ESTABLISHMENT
  // ==========================================================================
  const establishLiveKitConnection = useCallback(async () => {
    if (connectionAttemptRef.current || actualIsConnected || isConnecting) {
      return;
    }

    if (!realMeetingId || !currentUser) {
      return;
    }

    if (connectionRetryCountRef.current >= PERFORMANCE_CONFIG.MAX_RETRIES) {
      showNotificationMessage(
        "Failed to connect after multiple attempts. Please refresh the page.",
        "error"
      );
      return;
    }

    try {
      connectionAttemptRef.current = true;
      connectionRetryCountRef.current += 1;
      setConnectionProgress(10);

      if (checkConnectionQueue && typeof checkConnectionQueue === "function") {
        try {
          setConnectionProgress(20);
          const queueStatus = await checkConnectionQueue(
            realMeetingId,
            currentUser.id
          );
          handleQueueStatus(queueStatus.queue_status);

          if (queueStatus.queue_status?.status === "queued") {
            return;
          }
        } catch (queueError) {
          console.warn(
            "Queue check failed, proceeding with direct connection:",
            queueError
          );
        }
      }

      setConnectionProgress(40);

      const connectionResult = await connectToRoom(
        realMeetingId,
        currentUser.id,
        getParticipantDisplayName(currentUser),
        {
          isHost: isHost,
          enableAudio: false,
          enableVideo: false,
          skipQueue: false,
        }
      );

      setConnectionProgress(80);

      if (connectionResult?.success) {
        hasInitialConnectionRef.current = true;
        connectionRetryCountRef.current = 0;
        setConnectionProgress(100);

        setAudioEnabled(false);
        setVideoEnabled(false);
        audioInitializedRef.current = false;
        videoInitializedRef.current = false;

        // ✅ REPLACE THE ENTIRE setTimeout BLOCK WITH THIS:
        setTimeout(async () => {
          try {
            console.log("🔍 Verifying tracks are muted after connection...");
            
            if (room && room.localParticipant) {
              const videoTrack = room.localParticipant.getTrackPublication(Track.Source.Camera);
              const audioTrack = room.localParticipant.getTrackPublication(Track.Source.Microphone);

              // ✅ FORCE MUTE - DO NOT ENABLE ANYTHING
              if (audioTrack?.track) {
                await audioTrack.track.mute();
                if (audioTrack.track.mediaStreamTrack) {
                  audioTrack.track.mediaStreamTrack.enabled = false;
                }
                console.log("🔇 Audio track FORCE MUTED");
              }

              if (videoTrack?.track) {
                await videoTrack.track.mute();
                if (videoTrack.track.mediaStreamTrack) {
                  videoTrack.track.mediaStreamTrack.enabled = false;
                }
                console.log("🔇 Video track FORCE MUTED");
              }
            }
            
            // ✅ Ensure UI state matches
            setAudioEnabled(false);
            setVideoEnabled(false);
            audioInitializedRef.current = false;
            videoInitializedRef.current = false;
            
          } catch (mediaError) {
            console.error("❌ Track verification failed:", mediaError);
          }
        }, 1000);

        showNotificationMessage(
          "Connected to meeting - setting up media for recording...", 
          "info"
        );
        setShowQueueOverlay(false);

        if (participantsAPI.recordJoin) {
          await participantsAPI.recordJoin({
            meetingId: realMeetingId,
            userId: currentUser.id,
            userName: getParticipantDisplayName(currentUser),
            isHost: isHost,
            participant_identity: connectionResult.participantIdentity,
          });
        }

        await loadCoHosts();
      }
    } catch (error) {
      console.error("Connection failed:", error);

      if (connectionRetryCountRef.current < PERFORMANCE_CONFIG.MAX_RETRIES) {
        showNotificationMessage(
          `Connection failed. Retrying... (${connectionRetryCountRef.current}/${PERFORMANCE_CONFIG.MAX_RETRIES})`,
          "warning"
        );

        setTimeout(() => {
          connectionAttemptRef.current = false;
          establishLiveKitConnection();
        }, PERFORMANCE_CONFIG.CONNECTION_RETRY_DELAY * connectionRetryCountRef.current);
      } else {
        showNotificationMessage(`Connection failed: ${error.message}`, "error");
        setConnectionProgress(0);
      }
    } finally {
      connectionAttemptRef.current = false;
    }
  }, [
    realMeetingId,
    currentUser,
    actualIsConnected,
    isConnecting,
    connectToRoom,
    isHost,
    showNotificationMessage,
    getParticipantDisplayName,
    checkConnectionQueue,
    loadCoHosts,
    enableVideo,
    enableAudio,
    livekitToggleVideo,
    livekitToggleAudio,
    room,
  ]);

  const handleQueueStatus = useCallback(
    (status) => {
      if (!status) return;

      setQueuePosition(status.position || 0);
      setEstimatedWaitTime(status.estimated_wait || 0);

      if (status.status === "queued" && status.position > 0) {
        setShowQueueOverlay(true);
        showNotificationMessage(
          `You are #${status.position} in the connection queue. Estimated wait: ${status.estimated_wait}s`,
          "info"
        );
      } else if (status.status === "allowed") {
        setShowQueueOverlay(false);
        showNotificationMessage(
          "Connection allowed, joining meeting...",
          "success"
        );
      }
    },
    [showNotificationMessage]
  );

  // ==========================================================================
  // ATTENDANCE HANDLERS
  // ==========================================================================
  const handleAttendanceViolation = useCallback(
    (violation) => {
      showNotificationMessage(
        violation.message,
        violation.type === "error" ? "error" : "warning"
      );

      if (violation.attendanceData) {
        setCurrentAttendanceData((prev) => ({
          ...prev,
          ...violation.attendanceData,
        }));
      }
    },
    [showNotificationMessage]
  );

  const handleAttendanceStatusChange = useCallback(
    (status) => {
      setCurrentAttendanceData((prev) => ({
        ...prev,
        ...status,
      }));

      if (status.sessionActive === false) {
        showNotificationMessage(
          "AI Attendance session ended due to violations",
          "error"
        );
      }
    },
    [showNotificationMessage]
  );

  const handleAttendanceSessionTerminated = useCallback(
    async (terminationData) => {
      if (terminationData.userId?.toString() !== currentUser?.id?.toString()) {
        return;
      }

      // ================================================================
      // IDENTITY REMOVAL — Allow rejoin (not permanent)
      // The participant's face didn't match 3 times. They can rejoin
      // after correcting the issue (lighting, position, etc.)
      // ================================================================
      if (terminationData.reason === "identity_verification_failure") {
        console.log("[IDENTITY REMOVAL] User removed for identity failure — rejoin allowed");
        
        showNotificationMessage(
          terminationData.message || 
          "You have been temporarily removed due to identity verification failure. You can rejoin.",
          "error"
        );

        setAttendanceEnabled(false);
        setVideoEnabled(false);
        setAudioEnabled(false);

        // Record the leave
        if (realMeetingId && currentUser?.id) {
          try {
            await participantsAPI.recordLeave({
              meetingId: realMeetingId,
              userId: currentUser.id,
              participant_id: participantId || `removed_${currentUser.id}`,
              manual_leave: false,
              reason: "identity_verification_failure",
              leave_type: "identity_removal",
              violation_reason: "identity_verification_failure",
            });
          } catch (recordError) {
            console.error("❌ Failed to record identity removal leave:", recordError);
          }
        }

        // Call the identity service rejoin endpoint to reset warnings
        try {
          const IDENTITY_API = import.meta.env.VITE_IDENTITY_API_URL || import.meta.env.VITE_API_URL || 'https://api.lancieretech.com';
          await fetch(`${IDENTITY_API}/api/face/rejoin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              user_id: currentUser.id,
              meeting_id: realMeetingId,
            }),
          });
          console.log("[IDENTITY REMOVAL] Backend identity state reset — user can rejoin");
        } catch (rejoinError) {
          console.warn("[IDENTITY REMOVAL] Failed to reset identity state:", rejoinError);
        }

        // Disconnect and reload — user will auto-rejoin with fresh identity state
        setTimeout(async () => {
          try {
            if (disconnectFromRoom) await disconnectFromRoom();
            if (localStream) localStream.getTracks().forEach((track) => track.stop());
            window.location.reload();
          } catch (error) {
            console.error("❌ Error during identity removal:", error);
            window.location.reload();
          }
        }, 3000);

        return;
      }

      // ================================================================
      // BEHAVIORAL REMOVAL — Permanent (continuous violations / 2-min)
      // ================================================================
      console.log("[BEHAVIORAL REMOVAL] User removed for behavioral violations — permanent");

      showNotificationMessage(
        terminationData.message ||
        "You have been removed from the meeting due to attendance violations",
        "error"
      );

      setAttendanceEnabled(false);
      setVideoEnabled(false);
      setAudioEnabled(false);

      setTimeout(async () => {
        try {
          if (realMeetingId && currentUser?.id) {
            try {
              await participantsAPI.recordLeave({
                meetingId: realMeetingId,
                userId: currentUser.id,
                participant_id: participantId || `removed_${currentUser.id}`,
                manual_leave: false,
                reason: "attendance_violation_removal",
                leave_type: "forced_removal",
                violation_reason:
                  terminationData.reason || "continuous_violations",
              });
            } catch (recordError) {
              console.error("❌ Failed to record forced leave:", recordError);
            }
          }

          if (disconnectFromRoom) {
            await disconnectFromRoom();
          }

          if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
          }

          window.location.reload();
        } catch (error) {
          console.error("❌ Error during forced removal:", error);
          window.location.reload();
        }
      }, 3000);
    },
    [
      currentUser?.id,
      realMeetingId,
      participantId,
      showNotificationMessage,
      disconnectFromRoom,
      localStream,
    ]
  );

  const handleToggleAttendance = useCallback(() => {
    setHandRaiseOpen(false);
    setAttendanceMinimized(!attendanceMinimized);

    if (attendanceMinimized) {
      showNotificationMessage("Attendance tracker expanded", "info");
    } else {
      showNotificationMessage("Attendance tracker minimized", "info");
    }
  }, [attendanceMinimized, showNotificationMessage]);

const handleToggleScreenShare = useMemo(
  () =>
    throttle(async () => {
      if (!isConnectionReady) {
        showNotificationMessage(
          "Not connected to meeting. Please wait for connection to establish.",
          "error"
        );
        return;
      }

      // ✅ CRITICAL FIX: Check if someone else is already sharing
      if (enhancedScreenShareData.stream && enhancedScreenShareData.sharer) {
        const currentUserId = currentUser?.id?.toString();
        const sharerUserId = enhancedScreenShareData.sharer.user_id?.toString();
        const sharerIdentity = enhancedScreenShareData.sharer.connection_id ||
          enhancedScreenShareData.sharer.participant_id ||
          enhancedScreenShareData.sharer.identity;

        // ✅ If someone else is sharing
        if (sharerUserId !== currentUserId) {
          // ✅ PROTECTION: Only hosts/co-hosts can stop other people's screen shares
          if (!hasHostPrivileges) {
            showNotificationMessage(
              `${enhancedScreenShareData.sharer.name || "A participant"} is already sharing their screen. Only hosts/co-hosts can stop their screen share.`,
              "error"
            );
            return;
          }

          // ✅ NEW: Show confirmation dialog before force stopping
          console.log(`🛡️ Host/Co-host initiating force stop for ${enhancedScreenShareData.sharer.name}`);
          
          // Store the participant data for the confirmation dialog
          setForceStopTargetParticipant({
            name: enhancedScreenShareData.sharer.name || "Participant",
            userId: sharerUserId,
            identity: sharerIdentity,
            data: enhancedScreenShareData.sharer,
          });
          
          // Show confirmation dialog
          setShowForceStopDialog(true);
          return; // ✅ STOP HERE - wait for user confirmation
        }

        // ✅ If it's the current user sharing, allow them to stop
        if (sharerUserId === currentUserId) {
          console.log("🛑 User stopping their own screen share");
          if (livekitStopScreenShare) {
            const success = await livekitStopScreenShare();
            if (success) {
              setScreenSharing(false);
              showNotificationMessage("Screen sharing stopped", "success");
            }
          }
          return;
        }
      }

      try {
        if (screenSharing || livekitLocalIsScreenSharing) {
          // Stop screen sharing (own share)
          console.log("Stopping own screen share...");
          if (livekitStopScreenShare) {
            const success = await livekitStopScreenShare();
            if (success) {
              setScreenSharing(false);
              showNotificationMessage("Screen sharing stopped", "success");
            }
          }
        } else {
          // Start screen sharing
          console.log("Starting screen share...", {
            isHost,
            isCoHost,
            coHostPrivilegesActive,
            hasHostPrivileges,
            canShareScreenDirectly,
          });

          // UPDATED: HOSTS AND CO-HOSTS CAN SHARE DIRECTLY WITHOUT APPROVAL
          if (canShareScreenDirectly) {
            const userRole = isHost
              ? "Host"
              : isCoHost || coHostPrivilegesActive
              ? "Co-Host"
              : "Participant";
            console.log(
              `${userRole} starting screen share directly without approval`
            );

            showNotificationMessage(
              'To share audio, select "Chrome Tab" and ensure "Share tab audio" is checked.',
              "info"
            );

            if (livekitStartScreenShare) {
              const result = await livekitStartScreenShare();
              if (result?.success) {
                setScreenSharing(true);

                const roleMessage = isHost ? "Host" : "Co-Host";

                if (result.hasSystemAudio) {
                  showNotificationMessage(
                    `${roleMessage} screen sharing with audio started`,
                    "success"
                  );
                } else {
                  showNotificationMessage(
                    `${roleMessage} screen sharing started.`,
                    "success"
                  );
                }

                console.log(
                  `${roleMessage} screen share started successfully:`,
                  {
                    sharingMode: result.sharingMode,
                    audioStrategy: result.audioStrategy,
                    hasSystemAudio: result.hasSystemAudio,
                  }
                );
              }
            }
            return;
          }

          // UPDATED: Only regular participants (not co-hosts) need approval
          if (
            !hasHostPrivileges &&
            meetingSettings.screenShareRequiresApproval &&
            screenSharePermissions.requiresHostApproval
          ) {
            console.log(
              "Regular participant requesting screen share approval..."
            );

            if (screenSharePermissions.pendingRequest) {
              showNotificationMessage(
                "Screen share request already pending host approval",
                "info"
              );
              setShowScreenShareWaiting(true);
              return;
            }

            if (!screenSharePermissions.hasPermission) {
              showNotificationMessage(
                "Requesting screen share permission from host...",
                "info"
              );
              setShowScreenShareWaiting(true);

              try {
                const result = await livekitStartScreenShare();
                setShowScreenShareWaiting(false);

                if (result?.success) {
                  setScreenSharing(true);
                  showNotificationMessage(
                    "Screen sharing started after approval",
                    "success"
                  );
                }
              } catch (error) {
                setShowScreenShareWaiting(false);
                if (error.message.includes("denied")) {
                  showNotificationMessage(
                    "Screen share request was denied by host",
                    "warning"
                  );
                } else if (error.message.includes("timeout")) {
                  showNotificationMessage(
                    "Screen share request timed out - try again",
                    "warning"
                  );
                } else {
                  showNotificationMessage(
                    `Screen share error: ${error.message}`,
                    "error"
                  );
                }
              }
              return;
            }
          }

          // Fallback for edge cases
          console.log("Fallback screen share start...");
          showNotificationMessage(
            'To share audio, select "Chrome Tab" and ensure "Share tab audio" is checked.',
            "info"
          );

          if (livekitStartScreenShare) {
            const result = await livekitStartScreenShare();
            if (result?.success) {
              setScreenSharing(true);
              showNotificationMessage("Screen sharing started", "success");
            }
          }
        }
      } catch (error) {
        console.error("Screen share error:", error);
        setShowScreenShareWaiting(false);
        showNotificationMessage(
          `Screen share error: ${error.message}`,
          "error"
        );
      }
    }, PERFORMANCE_CONFIG.THROTTLE_DELAY),
  [
    isConnectionReady,
    screenSharing,
    livekitLocalIsScreenSharing,
    livekitStopScreenShare,
    livekitStartScreenShare,
    forceStopParticipantScreenShare,
    showNotificationMessage,
    canShareScreenDirectly,
    hasHostPrivileges,
    meetingSettings.screenShareRequiresApproval,
    screenSharePermissions,
    isHost,
    isCoHost,
    coHostPrivilegesActive,
    currentUser?.id,
    enhancedScreenShareData,
  ]
);

// ✅ NEW: Handle confirmed force stop
const handleConfirmForceStop = useCallback(async () => {
  if (!forceStopTargetParticipant) {
    console.error("No target participant for force stop");
    return;
  }

  try {
    console.log(`🛑 Executing force stop for ${forceStopTargetParticipant.name}`);
    
    showNotificationMessage(
      `Stopping ${forceStopTargetParticipant.name}'s screen share...`,
      "info"
    );

    // Execute the force stop
    if (forceStopParticipantScreenShare) {
      const success = await forceStopParticipantScreenShare(
        forceStopTargetParticipant.identity
      );
      
      if (success) {
        showNotificationMessage(
          `Stopped ${forceStopTargetParticipant.name}'s screen share`,
          "success"
        );

        // Clear local state
        setScreenSharing(false);
      } else {
        showNotificationMessage(
          "Failed to stop screen share. Participant may have disconnected.",
          "error"
        );
      }
    }
  } catch (error) {
    console.error("Force stop error:", error);
    showNotificationMessage(
      `Failed to stop screen share: ${error.message}`,
      "error"
    );
  } finally {
    // Clear the dialog state
    setShowForceStopDialog(false);
    setForceStopTargetParticipant(null);
  }
}, [
  forceStopTargetParticipant,
  forceStopParticipantScreenShare,
  showNotificationMessage,
]);

  const handleScreenShareClick = useCallback(async () => {
    // Show immediate guidance before starting screen share
    if (!screenSharing && !livekitLocalIsScreenSharing) {
    showNotificationMessage(
  "Select 'Chrome Tab' to ensure audio is shared.",
  "info"
);
    }

    await handleToggleScreenShare();
  }, [
    screenSharing,
    livekitLocalIsScreenSharing,
    handleToggleScreenShare,
    showNotificationMessage,
  ]);
  // ==========================================================================
  // RECORDING HANDLERS
  // ==========================================================================
  const handleToggleRecording = useCallback(async () => {
    if (!hasHostPrivileges) {
      showNotificationMessage(
        "Only hosts and co-hosts can control recording",
        "warning"
      );
      return;
    }

    const meetingIdForRecording = realMeetingId || meetingData?.id;
    if (!meetingIdForRecording) {
      showNotificationMessage("No meeting ID available", "error");
      return;
    }

    try {
      if (recordingState.isRecording) {
        // ✅ STOP RECORDING - Show name dialog
        showNotificationMessage("Stopping recording...", "info");

        // Broadcast stop to all participants
        if (room && room.localParticipant) {
          const encoder = new TextEncoder();
          const recordingData = encoder.encode(
            JSON.stringify({
              type: "recording_status",
              action: "stop",
              recording: false,
              stoppedBy: currentUser.id,
              stoppedByName: getParticipantDisplayName(currentUser),
              timestamp: Date.now(),
            })
          );
          await room.localParticipant.publishData(
            recordingData,
            DataPacket_Kind.RELIABLE
          );
        }

        // Stop the recording
        let response;
        if (recordingState.method === "server") {
          response = await stopMeetingRecording(meetingIdForRecording);
        } else if (recordingState.method === "client" && clientMediaRecorder) {
          // Handle client recording stop
          response = { success: true, method: "client" };
        } else {
          throw new Error("No active recording method found");
        }

        if (response && response.success !== false) {
          // ✅ SHOW RECORDING NAME DIALOG instead of immediate notification
          setPendingRecordingData({
            meetingId: meetingIdForRecording,
            recordingMethod: recordingState.method,
            response: response,
          });
          setShowRecordingNameDialog(true);

          // Update recording state
          setRecordingState({
            isRecording: false,
            method: null,
            startTime: null,
            duration: 0,
            error: null,
            uploading: false,
            uploadProgress: 0,
          });
        } else {
          throw new Error(response?.message || "Failed to stop recording");
        }
      } else {
        // ✅ START RECORDING
        showNotificationMessage("Starting recording...", "info");

        try {
          const response = await startMeetingRecording(meetingIdForRecording, {
            user_id: currentUser?.id,
            recording_type: "server",
            quality: "hd",
            include_audio: true,
            include_video: true,
          });

          if (response && response.success !== false) {
            setRecordingState({
              isRecording: true,
              isPaused:false,
              method: "server",
              startTime: Date.now(),
              duration: 0,
              pausedDuration:0,
              error: null,
              uploading: false,
              uploadProgress: 0,
            });

            if (room && room.localParticipant) {
              const encoder = new TextEncoder();
              const recordingData = encoder.encode(
                JSON.stringify({
                  type: "recording_status",
                  action: "start",
                  recording: true,
                  method: "server",
                  startedBy: currentUser.id,
                  startedByName: getParticipantDisplayName(currentUser),
                  timestamp: Date.now(),
                })
              );
              await room.localParticipant.publishData(
                recordingData,
                DataPacket_Kind.RELIABLE
              );
            }

            showNotificationMessage(
              "Server recording started successfully",
              "success"
            );
            return;
          } else {
            throw new Error(response?.message || "Server recording failed");
          }
        } catch (serverError) {
          console.warn(
            "Server recording failed, trying client recording:",
            serverError
          );

          const support = checkRecordingSupport();
          if (support.client) {
            setRecordingState({
              isRecording: true,
              method: "client",
              startTime: Date.now(),
              duration: 0,
              error: null,
              uploading: false,
              uploadProgress: 0,
            });

            if (room && room.localParticipant) {
              const encoder = new TextEncoder();
              const recordingData = encoder.encode(
                JSON.stringify({
                  type: "recording_status",
                  action: "start",
                  recording: true,
                  method: "client",
                  startedBy: currentUser.id,
                  startedByName: getParticipantDisplayName(currentUser),
                  timestamp: Date.now(),
                })
              );
              await room.localParticipant.publishData(
                recordingData,
                DataPacket_Kind.RELIABLE
              );
            }

            showNotificationMessage(
              "Client recording started successfully",
              "success"
            );
          } else {
            throw new Error("No recording method available");
          }
        }
      }
    } catch (error) {
      console.error("Recording error:", error);
      showNotificationMessage(`Recording error: ${error.message}`, "error");

      setRecordingState({
        isRecording: false,
        method: null,
        startTime: null,
        duration: 0,
        error: error.message,
        uploading: false,
        uploadProgress: 0,
      });
    }
  }, [
    hasHostPrivileges,
    realMeetingId,
    meetingData?.id,
    recordingState.isRecording,
    recordingState.method,
    clientMediaRecorder,
    currentUser?.id,
    room,
    getParticipantDisplayName,
    showNotificationMessage,
    startMeetingRecording,
    stopMeetingRecording,
    checkRecordingSupport,
  ]);
  // ✅ NEW: Handle Recording Name Save
  const handleSaveRecordingName = useCallback(
    async (recordingName) => {
      if (!pendingRecordingData) {
        console.error("No pending recording data");
        setShowRecordingNameDialog(false);
        return;
      }

      try {
        console.log("💾 Saving recording with name:", recordingName);

        // Call backend endpoint to store custom name
        const response = await fetch(
          `${API_BASE_URL}/api/recordings/store-custom-name`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
            },
            body: JSON.stringify({
              meeting_id: pendingRecordingData.meetingId,
              custom_name: recordingName,
              user_id: currentUser?.id,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to store recording name");
        }

        const result = await response.json();

        if (result.status === "success") {
          showNotificationMessage(
            `Recording "${recordingName}" saved successfully!`,
            "success"
          );
          console.log("✅ Recording name stored:", result);
        } else {
          throw new Error(result.error || "Failed to store recording name");
        }
      } catch (error) {
        console.error("❌ Failed to save recording name:", error);
        showNotificationMessage(
          `Failed to save recording name: ${error.message}`,
          "error"
        );
      } finally {
        // Close dialog and reset state
        setShowRecordingNameDialog(false);
        setPendingRecordingData(null);
      }
    },
    [pendingRecordingData, currentUser?.id, showNotificationMessage]
  );
  // ==========================================================================
  // MEETING LEAVE/END HANDLERS
  const handleLeaveMeeting = async () => {
    setShowLeaveDialog(false);

    // ✅ CRITICAL: Check if feedback is active - DON'T navigate
    if (meetingEnded && !feedbackSubmitted) {
      console.log("⛔ Cannot leave - feedback dialog is active");
      return;
    }

    try {
      if (realMeetingId && currentUser?.id) {
        await participantsAPI.recordLeave({
          meetingId: realMeetingId,
          userId: currentUser.id,
          participant_id: participantId || `host_${currentUser.id}`,
          manual_leave: true,
          reason: "manual",
          leave_type: "user_action",
        });
      }

      // Disconnect from room
      await disconnectFromRoom();

      // Clear meeting data
      localStorage.removeItem("currentMeetingId");
      localStorage.removeItem("meetingData");
      sessionStorage.removeItem("meetingState");

      // ✅ NAVIGATE WITHOUT REFRESH
      if (onLeaveMeeting) {
        onLeaveMeeting(); // Use the navigation prop
      } else {
        // Fallback: use React Router navigation
        window.history.pushState({}, "", "/dashboard");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    } catch (error) {
      console.error("Manual leave error:", error);

      // Even on error, try to navigate without refresh
      if (onLeaveMeeting) {
        onLeaveMeeting();
      } else {
        window.history.pushState({}, "", "/dashboard");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }
  };
  const handleEndMeeting = async () => {
    setShowEndMeetingDialog(false);

    if (!hasHostPrivileges) {
      showNotificationMessage(
        "Only hosts and co-hosts can end the meeting",
        "error"
      );
      return;
    }

    if (!realMeetingId) {
      showNotificationMessage("No meeting ID available", "error");
      return;
    }

    try {
      showNotificationMessage("Ending meeting for all participants...", "info");

      const result = await endMeetingForEveryone(realMeetingId);

      if (result.success) {
        showNotificationMessage("Meeting ended successfully", "success");

        setTimeout(() => {
          if (onLeaveMeeting) {
            onLeaveMeeting();
          }
        }, 2000);
      }
    } catch (error) {
      console.error("End meeting error:", error);
      showNotificationMessage(
        `Failed to end meeting: ${error.message}`,
        "error"
      );
    }
  };

  // ========================================================================
  // HAND RAISE HANDLERS
  // ==========================================================================
 const handleToggleHandRaiseAction = useCallback(async () => {
  if (!meetingSettings.handRaiseEnabled) {
    showNotificationMessage(
      "Hand raise is disabled in this meeting",
      "warning"
    );
    return;
  }

  if (hasHostPrivileges) {
    if (!handRaiseOpen) {
      // Start the system when host opens panel
      try {
        await handRaiseService.startMeetingHandRaise(realMeetingId);
        await loadRaisedHands();
      } catch (error) {
        console.log('ℹ️ Hand raise system setup:', error.message);
        // Still open the panel
      }
    }
    setHandRaiseOpen(!handRaiseOpen);
    return;
  }

  // For participants - ensure system is started first
  try {
    await handRaiseService.startMeetingHandRaise(realMeetingId);
  } catch (error) {
    console.log('ℹ️ System start check:', error.message);
  }

  try {
    await toggleHandRaise();
    showNotificationMessage(
      isHandRaised ? "Hand lowered" : "Hand raised",
      "success"
    );
  } catch (error) {
    showNotificationMessage(
      `Failed to ${isHandRaised ? "lower" : "raise"} hand: ${error.message}`,
      "error"
    );
  }
}, [
  toggleHandRaise,
  isHandRaised,
  meetingSettings.handRaiseEnabled,
  showNotificationMessage,
  hasHostPrivileges,
  handRaiseOpen,
  loadRaisedHands,
  realMeetingId,
]);

  const handleAcknowledgeHand = useCallback(
    async (handId) => {
      const hand = raisedHands.find((h) => h.id === handId);
      if (!hand) return;

      try {
        await acknowledgeHand(hand.user_id, "acknowledge");
        showNotificationMessage(
          `Acknowledged ${hand.user?.full_name || "participant"}'s hand`,
          "success"
        );
      } catch (error) {
        showNotificationMessage(
          `Failed to acknowledge hand: ${error.message}`,
          "error"
        );
      }
    },
    [acknowledgeHand, raisedHands, showNotificationMessage]
  );

  const handleDenyHand = useCallback(
    async (handId) => {
      const hand = raisedHands.find((h) => h.id === handId);
      if (!hand) return;

      try {
        await acknowledgeHand(hand.user_id, "deny");
        showNotificationMessage(
          `Denied ${hand.user?.full_name || "participant"}'s hand`,
          "info"
        );
      } catch (error) {
        showNotificationMessage(
          `Failed to deny hand: ${error.message}`,
          "error"
        );
      }
    },
    [acknowledgeHand, raisedHands, showNotificationMessage]
  );

  const handleClearAllHands = useCallback(async () => {
    if (!hasHostPrivileges) {
      showNotificationMessage(
        "Only hosts and co-hosts can clear all hands",
        "warning"
      );
      return;
    }

    try {
      await clearAllHands();
      showNotificationMessage("All hands cleared", "success");
    } catch (error) {
      showNotificationMessage(
        `Failed to clear hands: ${error.message}`,
        "error"
      );
    }
  }, [clearAllHands, hasHostPrivileges, showNotificationMessage]);

  // ==========================================================================
  // SCREEN SHARE REQUEST HANDLERS
  // ==========================================================================
  const handleScreenShareRequestReceived = useCallback(() => {
    if (hasHostPrivileges && currentScreenShareRequest) {
      setShowScreenShareRequest(true);
    }
  }, [hasHostPrivileges, currentScreenShareRequest]);

  const handleApproveScreenShare = useCallback(async () => {
    if (!currentScreenShareRequest) return;

    try {
      await approveScreenShareRequest(
        currentScreenShareRequest.request_id,
        currentScreenShareRequest.user_id
      );
      setShowScreenShareRequest(false);
      showNotificationMessage(
        `Approved screen share for ${currentScreenShareRequest.user_name}`,
        "success"
      );
    } catch (error) {
      console.error("Failed to approve screen share:", error);
      showNotificationMessage(
        "Failed to approve screen share request",
        "error"
      );
    }
  }, [
    currentScreenShareRequest,
    approveScreenShareRequest,
    showNotificationMessage,
  ]);

  const handleDenyScreenShare = useCallback(async () => {
    if (!currentScreenShareRequest) return;

    try {
      await denyScreenShareRequest(
        currentScreenShareRequest.request_id,
        currentScreenShareRequest.user_id
      );
      setShowScreenShareRequest(false);
      showNotificationMessage(
        `Denied screen share for ${currentScreenShareRequest.user_name}`,
        "info"
      );
    } catch (error) {
      console.error("Failed to deny screen share:", error);
      showNotificationMessage("Failed to deny screen share request", "error");
    }
  }, [
    currentScreenShareRequest,
    denyScreenShareRequest,
    showNotificationMessage,
  ]);

  // ==========================================================================
  // WHITEBOARD HANDLERS
  // ==========================================================================
  const handleToggleWhiteboard = useCallback(() => {
    if (!hasHostPrivileges) {
      showNotificationMessage(
        "Only hosts and co-hosts can access the whiteboard",
        "warning"
      );
      return;
    }

    if (!meetingSettings.whiteboardEnabled) {
      showNotificationMessage(
        "Whiteboard is disabled in this meeting",
        "warning"
      );
      return;
    }

    if (!availableTabs.includes("whiteboard")) {
      setAvailableTabs((prev) => [...prev, "whiteboard"]);
    }

    setActiveTab("whiteboard");
    setWhiteboardOpen(true);

    showNotificationMessage("Whiteboard opened in new tab", "info");
  }, [
    hasHostPrivileges,
    meetingSettings.whiteboardEnabled,
    availableTabs,
    showNotificationMessage,
    setAvailableTabs,
    setActiveTab,
  ]);

  const handleWhiteboardError = useCallback(
    (error) => {
      console.error("Whiteboard error:", error);
      setWhiteboardError(error.message || "Whiteboard error occurred");
      showNotificationMessage(`Whiteboard error: ${error.message}`, "error");
    },
    [showNotificationMessage]
  );

  const handleWhiteboardSuccess = useCallback(
    (message) => {
      showNotificationMessage(message, "success");
      setWhiteboardError(null);
    },
    [showNotificationMessage]
  );

  // ==========================================================================
  // MEETING LINK HANDLERS
  // ==========================================================================
  const handleCopyMeetingLink = async () => {
    try {
      await navigator.clipboard.writeText(meetingLink);
      showNotificationMessage("Meeting link copied to clipboard!", "success");
    } catch (error) {
      console.error("Failed to copy link:", error);
      showNotificationMessage("Failed to copy link", "error");
    }
  };

  const handleShareMeetingLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: meetingData?.title || "Join Video Meeting",
          text: "Join our video meeting",
          url: meetingLink,
        });
      } catch (error) {
        console.error("Error sharing:", error);
        handleCopyMeetingLink();
      }
    } else {
      handleCopyMeetingLink();
    }
  };

  // ==========================================================================
  // FULLSCREEN HANDLER
  // ==========================================================================
  const handleFullscreen = () => {
    if (!isFullscreen) {
      meetingContainerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  // ==========================================================================
  // CHAT HANDLERS
  // ==========================================================================
  const handleChatUnreadCountChange = useCallback(
    (count) => {
      setUnreadMessages(count);
      setChatStats((prev) => ({
        ...prev,
        unread: chatOpen ? 0 : count,
        hasNewMessages: !chatOpen && count > 0,
      }));
    },
    [chatOpen]
  );

  const handleChatTotalMessagesChange = useCallback((total) => {
    setTotalMessages(total);
    setChatStats((prev) => ({
      ...prev,
      total: total,
    }));
  }, []);

  const handleChatMessageReceived = useCallback(
    (message) => {
      if (!chatOpen) {
        setChatStats((prev) => ({
          ...prev,
          unread: prev.unread + 1,
          total: prev.total + 1,
          hasNewMessages: true,
        }));
        setUnreadMessages((prev) => prev + 1);
      }
    },
    [chatOpen]
  );

  const handleChatOpened = useCallback(() => {
    setChatStats((prev) => ({
      ...prev,
      unread: 0,
      hasNewMessages: false,
    }));
    setUnreadMessages(0);
  }, []);

  // ==========================================================================
  // SETTINGS HANDLER
  // ==========================================================================
  const handleSaveSettings = useCallback(
    (newSettings) => {
      setMeetingSettings({
        ...newSettings,
        whiteboardEnabled:
          newSettings.whiteboardEnabled ?? meetingSettings.whiteboardEnabled,
        whiteboardHostOnly:
          newSettings.whiteboardHostOnly ?? meetingSettings.whiteboardHostOnly,
      });
      showNotificationMessage("Settings updated successfully");
    },
    [showNotificationMessage, meetingSettings]
  );

  // ==========================================================================
  // TOGGLE MENU ITEMS
  // ==========================================================================
  const toggleMenuItems = useMemo(
    () => [
      {
        icon: <RadioButtonChecked />,
        label: recordingState.isRecording
          ? "Stop Recording"
          : "Start Recording",
        action: handleToggleRecording,
        show: hasHostPrivileges,
      },
      {
        icon: <WhiteboardIcon />,
        label: "Open Whiteboard",
        action: handleToggleWhiteboard,
        show: hasHostPrivileges && meetingSettings.whiteboardEnabled,
      },
      {
      icon: recordingState.isPaused ? <PlayArrow /> : <Pause />,
      label: recordingState.isPaused ? "Resume Recording" : "Pause Recording",
      action: handlePauseResumeRecording,
      show: hasHostPrivileges && recordingState.isRecording,
    },
      {
        icon: <Share />,
        label: "Copy Meeting Link",
        action: handleCopyMeetingLink,
        show: true,
      },
      {
        icon: <MeetingRoomIcon />,
        label: "End Meeting",
        action: () => setShowEndMeetingDialog(true),
        show: hasHostPrivileges,
      },
      {
        icon: isFullscreen ? <FullscreenExit /> : <Fullscreen />,
        label: isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen",
        action: handleFullscreen,
        show: true,
      },
    ],
    [
      recordingState.isRecording,
       recordingState.isPaused, 
      handleToggleRecording,
      handlePauseResumeRecording,
      hasHostPrivileges,
      handleToggleWhiteboard,
      meetingSettings.whiteboardEnabled,
      handleCopyMeetingLink,
      isFullscreen,
      handleFullscreen,
    ]
  );

  const handleFeedbackSubmitSuccess = useCallback(async () => {
    console.log("✅ Feedback submitted successfully");
    setFeedbackSubmitted(true);
    setShowFeedbackDialog(false);

    showNotificationMessage("Thank you for your feedback!", "success");

    // ✅ UNBLOCK auto-refresh NOW
    window.blockAutoRefresh = false;
    console.log("🔓 Auto-refresh unblocked after feedback submission");

    // Navigate after showing thank you message
    setTimeout(async () => {
      console.log("🧹 Cleaning up and navigating...");

      try {
        // Disconnect from LiveKit
        if (disconnectFromRoom && typeof disconnectFromRoom === "function") {
          await disconnectFromRoom();
        }

        // Clear session storage
        sessionStorage.removeItem("meetingEndedAt");
        sessionStorage.removeItem("currentMeetingId");
        sessionStorage.removeItem("blockAutoRefresh");

        // Navigate
        console.log("🚀 Navigating to dashboard");
        if (onLeaveMeeting) {
          onLeaveMeeting();
        } else {
          window.location.href = "/dashboard";
        }
      } catch (error) {
        console.error("❌ Cleanup error:", error);
        window.location.href = "/dashboard";
      }
    }, 2000);
  }, [onLeaveMeeting, showNotificationMessage, disconnectFromRoom]);

  const handleFeedbackSkip = useCallback(async () => {
    console.log("⏭️ User skipped feedback");
    setShowFeedbackDialog(false);

    showNotificationMessage("Feedback skipped", "info");

    // ✅ UNBLOCK auto-refresh NOW
    window.blockAutoRefresh = false;
    console.log("🔓 Auto-refresh unblocked after skip");

    // Navigate immediately
    setTimeout(async () => {
      console.log("🧹 Cleaning up and navigating...");

      try {
        // Disconnect from LiveKit
        if (disconnectFromRoom && typeof disconnectFromRoom === "function") {
          await disconnectFromRoom();
        }

        // Clear session storage
        sessionStorage.removeItem("meetingEndedAt");
        sessionStorage.removeItem("currentMeetingId");
        sessionStorage.removeItem("blockAutoRefresh");

        // Navigate
        console.log("🚀 Navigating to dashboard");
        if (onLeaveMeeting) {
          onLeaveMeeting();
        } else {
          window.location.href = "/dashboard";
        }
      } catch (error) {
        console.error("❌ Cleanup error:", error);
        window.location.href = "/dashboard";
      }
    }, 1000);
  }, [onLeaveMeeting, showNotificationMessage, disconnectFromRoom]);

  // ==========================================================================
  // EFFECTS - CONNECTION
  // ==========================================================================
  useEffect(() => {
    if (
      realMeetingId &&
      currentUser &&
      !hasInitialConnectionRef.current &&
      !actualIsConnected &&
      !isConnecting
    ) {
      establishLiveKitConnection();
    }

    return () => {
      connectionAttemptRef.current = false;
      hasInitialConnectionRef.current = false;
      connectionRetryCountRef.current = 0;
      audioInitializedRef.current = false;
      videoInitializedRef.current = false;

      if (queueCheckIntervalRef.current) {
        clearInterval(queueCheckIntervalRef.current);
        queueCheckIntervalRef.current = null;
      }

      if (coHostSyncTimerRef.current) {
        clearInterval(coHostSyncTimerRef.current);
        coHostSyncTimerRef.current = null;
      }
    };
  }, [
    realMeetingId,
    currentUser,
    actualIsConnected,
    isConnecting,
    establishLiveKitConnection,
  ]);

  // ==========================================================================
  // EFFECTS - CO-HOST SYNC
  // ==========================================================================
  useEffect(() => {
    if (realMeetingId && actualIsConnected) {
      loadCoHosts();

      const coHostSyncInterval = setInterval(() => {
        loadCoHosts();
      }, PERFORMANCE_CONFIG.COHOST_SYNC_INTERVAL);

      return () => {
        clearInterval(coHostSyncInterval);
      };
    }
  }, [realMeetingId, actualIsConnected, loadCoHosts]);

  useEffect(() => {
    // Store liveParticipants in window scope for screen share requests
    window.liveParticipants = liveParticipants;
    window.allParticipants = allParticipants;
    window.currentUser = currentUser;

    console.log("✅ Stored participants in window scope:", {
      liveParticipantsCount: liveParticipants.length,
      allParticipantsCount: allParticipants.length,
      currentUser: currentUser?.id,
      currentUserName: currentUser?.full_name || currentUser?.name,
    });

    return () => {
      // Cleanup on unmount
      delete window.liveParticipants;
      delete window.allParticipants;
      delete window.currentUser;
    };
  }, [liveParticipants, allParticipants, currentUser]);

  // ==========================================================================
  // EFFECTS - GLOBAL HANDLERS
  // ==========================================================================
  useEffect(() => {
    window.reloadCoHosts = loadCoHosts;
    window.showNotificationMessage = showNotificationMessage;
    window.handleForcedLeave = handleLeaveMeeting;
    window.reloadLiveParticipants = loadLiveParticipants;

    return () => {
      delete window.reloadCoHosts;
      delete window.showNotificationMessage;
      delete window.handleForcedLeave;
      delete window.reloadLiveParticipants;
    };
  }, [
    loadCoHosts,
    showNotificationMessage,
    handleLeaveMeeting,
    loadLiveParticipants,
  ]);

  // ==========================================================================
  // EFFECTS - PARTICIPANT SYNC
  // ==========================================================================
  useEffect(() => {
    if (realMeetingId && actualIsConnected) {
      loadLiveParticipants();

      return () => {
        if (participantUpdateTimerRef.current) {
          clearInterval(participantUpdateTimerRef.current);
        }
      };
    }
  }, [realMeetingId, actualIsConnected, loadLiveParticipants]);

  // ==========================================================================
  // EFFECTS - GLOBAL EVENTS
  // ==========================================================================
  useEffect(() => {
    const handleGlobalRefreshRequest = (event) => {
      const { reason, immediate } = event.detail || {};
      if (immediate) {
        loadLiveParticipants(true);
      } else {
        loadLiveParticipants();
      }
    };

    const handleParticipantRemovedGlobal = (event) => {
      setTimeout(() => {
        loadLiveParticipants(true);
      }, 1000);
    };

    const handleGlobalNameRefresh = () => {
      setTimeout(() => {
        loadLiveParticipants();
      }, 100);
    };

    window.addEventListener(
      "requestParticipantRefresh",
      handleGlobalRefreshRequest
    );
    window.addEventListener(
      "participantRemoved",
      handleParticipantRemovedGlobal
    );
    window.addEventListener("refreshParticipantNames", handleGlobalNameRefresh);

    return () => {
      window.removeEventListener(
        "requestParticipantRefresh",
        handleGlobalRefreshRequest
      );
      window.removeEventListener(
        "participantRemoved",
        handleParticipantRemovedGlobal
      );
      window.removeEventListener(
        "refreshParticipantNames",
        handleGlobalNameRefresh
      );
    };
  }, [loadLiveParticipants]);

  // ==========================================================================
  // EFFECTS - PARTICIPANT REMOVAL EVENTS
  // ==========================================================================
  useEffect(() => {
    const handleParticipantRemovedEvent = (event) => {
      const { removedUserId } = event.detail;

      setLiveParticipants((prev) => {
        const isAlreadyRemoved = !prev.some((p) => {
          const pUserId = p.User_ID || p.user_id || p.ID;
          return pUserId?.toString() === removedUserId?.toString();
        });

        if (isAlreadyRemoved) {
          return prev;
        }

        const updated = prev.filter((p) => {
          const pUserId = p.User_ID || p.user_id || p.ID;
          return pUserId?.toString() !== removedUserId?.toString();
        });

        return updated;
      });
    };

    window.addEventListener(
      "participantRemoved",
      handleParticipantRemovedEvent
    );

    return () => {
      window.removeEventListener(
        "participantRemoved",
        handleParticipantRemovedEvent
      );
    };
  }, []);

  // ==========================================================================
  // EFFECTS - CHAT EVENTS
  // ==========================================================================
  useEffect(() => {
    const handleNewMessage = (event) => {
      const { messageCount, hasUnread } = event.detail || {};

      if (!chatOpen && hasUnread) {
        setChatStats((prev) => ({
          ...prev,
          unread: prev.unread + 1,
          total: messageCount || prev.total + 1,
          hasNewMessages: true,
        }));
        setUnreadMessages((prev) => prev + 1);
      }

      if (messageCount !== undefined) {
        setTotalMessages(messageCount);
        setChatStats((prev) => ({
          ...prev,
          total: messageCount,
        }));
      }
    };

    const handleChatStatsUpdate = (event) => {
      const { totalMessages: total, unreadMessages: unread } =
        event.detail || {};

      setChatStats((prev) => ({
        ...prev,
        total: total || prev.total,
        unread: chatOpen ? 0 : unread || prev.unread,
        hasNewMessages: !chatOpen && (unread > 0 || prev.hasNewMessages),
      }));

      if (total !== undefined) setTotalMessages(total);
      if (unread !== undefined && !chatOpen) setUnreadMessages(unread);
    };

    window.addEventListener("newChatMessage", handleNewMessage);
    window.addEventListener("chatStatsUpdated", handleChatStatsUpdate);

    return () => {
      window.removeEventListener("newChatMessage", handleNewMessage);
      window.removeEventListener("chatStatsUpdated", handleChatStatsUpdate);
    };
  }, [chatOpen]);

  // ==========================================================================
  // EFFECTS - MEETING LINK
  // ==========================================================================
  useEffect(() => {
    if (realMeetingId && currentUser) {
      const generatedLink = `${window.location.origin}/meeting/${realMeetingId}?token=${currentUser.id}`;
      setMeetingLink(generatedLink);
    }
  }, [realMeetingId, currentUser]);

  // ==========================================================================
  // EFFECTS - SCREEN SHARE REQUESTS
  // ==========================================================================
  useEffect(() => {
    if (currentScreenShareRequest && hasHostPrivileges) {
      handleScreenShareRequestReceived();
    }
  }, [
    currentScreenShareRequest,
    hasHostPrivileges,
    handleScreenShareRequestReceived,
  ]);

  useEffect(() => {
    if (screenSharePermissions.hasPermission && showScreenShareWaiting) {
      setShowScreenShareWaiting(false);
    }

    if (!screenSharePermissions.pendingRequest && showScreenShareWaiting) {
      setShowScreenShareWaiting(false);
    }
  }, [
    screenSharePermissions.hasPermission,
    screenSharePermissions.pendingRequest,
    showScreenShareWaiting,
  ]);

  useEffect(() => {
    if (
      (screenSharing || livekitLocalIsScreenSharing) &&
      showScreenShareWaiting
    ) {
      setShowScreenShareWaiting(false);
    }
  }, [screenSharing, livekitLocalIsScreenSharing, showScreenShareWaiting]);

  // ==========================================================================
  // EFFECTS - HAND RAISE
  // ==========================================================================
  useEffect(() => {
    if (!hasHostPrivileges || !realMeetingId || !handRaiseInitialized) return;

    loadRaisedHands();

    const interval = setInterval(() => {
      loadRaisedHands();
    }, 5000);

    return () => clearInterval(interval);
  }, [hasHostPrivileges, realMeetingId, loadRaisedHands, handRaiseInitialized]);

  // ==========================================================================
  // EFFECTS - RECORDING TIMER
  // ==========================================================================
// Update this existing useEffect (around line 2100)
useEffect(() => {
  let interval;

  if (recordingState.isRecording && recordingState.startTime && !recordingState.isPaused) {
    interval = setInterval(() => {
      try {
        const now = Date.now();
        const duration = Math.floor((now - recordingState.startTime) / 1000);
        // Subtract paused duration from total
        const effectiveDuration = Math.max(0, duration - Math.floor(recordingState.pausedDuration));
        setRecordingState((prev) => ({ ...prev, duration: effectiveDuration }));
      } catch (error) {
        console.error("Recording timer error:", error);
        clearInterval(interval);
      }
    }, 1000);
  }

  return () => {
    if (interval) {
      clearInterval(interval);
    }
  };
}, [recordingState.isRecording, recordingState.startTime, recordingState.isPaused, recordingState.pausedDuration]);
  // ==========================================================================
  // EFFECTS - FULLSCREEN
  // ==========================================================================
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // ==========================================================================
  // EFFECTS - ROOM REF
  // ==========================================================================
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  // ==========================================================================
  // EFFECTS - LIVEKIT STATE SYNC
  // ==========================================================================
  useEffect(() => {
    if (audioInitializedRef.current) {
      setAudioEnabled(
        livekitAudioEnabled !== undefined ? livekitAudioEnabled : false
      );
    }
  }, [livekitAudioEnabled]);

  useEffect(() => {
    if (videoInitializedRef.current) {
      setVideoEnabled(
        livekitVideoEnabled !== undefined ? livekitVideoEnabled : false
      );
    }
  }, [livekitVideoEnabled]);

  useEffect(() => {
    setScreenSharing(
      livekitScreenSharing !== undefined
        ? livekitScreenSharing
        : propScreenSharing
    );
  }, [propScreenSharing, livekitScreenSharing]);

  // ==========================================================================
  // EFFECTS - WHITEBOARD ACCESS
  // ==========================================================================
  useEffect(() => {
    if (!hasHostPrivileges && availableTabs.includes("whiteboard")) {
      handleCloseTab("whiteboard");
      showNotificationMessage(
        "Whiteboard closed - host privileges required",
        "info"
      );
    }
  }, [
    hasHostPrivileges,
    availableTabs,
    handleCloseTab,
    showNotificationMessage,
  ]);

  // ==========================================================================
  // EFFECTS - LIVEKIT TRACK STATE SYNC (REAL-TIME MIC/CAMERA SYNC)
  // ==========================================================================
  useEffect(() => {
    const handleTrackStateChange = (event) => {
      const {
        participantIdentity,
        userId,
        trackKind,
        isMuted,
        isAudioEnabled,
        isVideoEnabled,
      } = event.detail;

      console.log("🎬 Track state changed:", {
        participantIdentity,
        userId,
        trackKind,
        isMuted,
        isAudioEnabled,
        isVideoEnabled,
        trackType: trackKind === "audio" ? "🎤 AUDIO" : "📹 VIDEO",
      });

      // Update liveParticipants immediately with LiveKit's actual states
      setLiveParticipants((prev) => {
        return prev.map((p) => {
          const pId = (p.User_ID || p.user_id || p.ID)?.toString();
          const pIdentity = `user_${pId}`;

          if (pId === userId?.toString() || pIdentity === participantIdentity) {
            const updated = {
              ...p,
              audio_enabled:
                trackKind === "audio"
                  ? !isMuted
                  : isAudioEnabled ?? p.audio_enabled,
              video_enabled:
                trackKind === "video"
                  ? !isMuted
                  : isVideoEnabled ?? p.video_enabled,
              isAudioEnabled:
                trackKind === "audio"
                  ? !isMuted
                  : isAudioEnabled ?? p.isAudioEnabled,
              isVideoEnabled:
                trackKind === "video"
                  ? !isMuted
                  : isVideoEnabled ?? p.isVideoEnabled,
            };

            console.log(
              `✅ Updated participant ${p.displayName || p.Full_Name}:`,
              {
                trackKind,
                before: {
                  audio: p.audio_enabled,
                  video: p.video_enabled,
                },
                after: {
                  audio: updated.audio_enabled,
                  video: updated.video_enabled,
                },
              }
            );

            return updated;
          }
          return p;
        });
      });
    };

    window.addEventListener(
      "participantTrackStateChanged",
      handleTrackStateChange
    );

    return () => {
      window.removeEventListener(
        "participantTrackStateChanged",
        handleTrackStateChange
      );
    };
  }, []);

  // ==========================================================================
  // EFFECTS - KEYBOARD SHORTCUTS
  // ==========================================================================
  useEffect(() => {
    const handleKeyboard = (event) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case "w":
            event.preventDefault();
            if (hasHostPrivileges && meetingSettings.whiteboardEnabled) {
              handleToggleWhiteboard();
            } else if (!hasHostPrivileges) {
              showNotificationMessage(
                "Only hosts and co-hosts can access the whiteboard",
                "warning"
              );
            }
            break;
          case "a":
            event.preventDefault();
            handleToggleAttendance();
            break;
          default:
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyboard);
    return () => document.removeEventListener("keydown", handleKeyboard);
  }, [
    handleToggleWhiteboard,
    handleToggleAttendance,
    hasHostPrivileges,
    meetingSettings.whiteboardEnabled,
    showNotificationMessage,
  ]);

  // ==========================================================================
  // EFFECTS - BLOCK NAVIGATION DURING FEEDBACK
  // ==========================================================================
  useEffect(() => {
    if (meetingEnded && showFeedbackDialog && !feedbackSubmitted) {
      console.log("🔒 BLOCKING all navigation - feedback dialog active");

      // Block browser refresh
      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue =
          "Feedback form is open. Are you sure you want to leave?";
        return e.returnValue;
      };

      // Block browser back button
      const handlePopState = (e) => {
        e.preventDefault();
        window.history.pushState(null, "", window.location.href);
        console.log("⛔ Back button blocked - feedback active");
      };

      window.addEventListener("beforeunload", handleBeforeUnload);
      window.addEventListener("popstate", handlePopState);

      // Push a new state to prevent back button
      window.history.pushState(null, "", window.location.href);

      return () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, [meetingEnded, showFeedbackDialog, feedbackSubmitted]);

  // ==========================================================================
  // EFFECTS - DATA CHANNEL LISTENERS
  // ==========================================================================
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload, participant) => {
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));

        const currentUserId = currentUser?.id?.toString();
        const currentIdentity = room?.localParticipant?.identity;

        // Handle force mute audio
        if (
          data.type === "force_mute_audio" &&
          data.target_user_id?.toString() === currentUserId
        ) {
          if (livekitToggleAudio && audioEnabled) {
            livekitToggleAudio();
          }

          showNotificationMessage(
            `Your microphone was muted by ${data.muted_by_name || "host"}`,
            "warning"
          );
        }
        // Handle recording pause/resume broadcasts
if (data.type === "recording_status") {
  if (data.action === "pause") {
    setRecordingState(prev => ({
      ...prev,
      isPaused: true,
    }));
    
    if (data.pausedBy?.toString() !== currentUser?.id?.toString()) {
      showNotificationMessage(
        `Recording paused by ${data.pausedByName || "host"}`,
        "info"
      );
    }
  } else if (data.action === "resume") {
    setRecordingState(prev => ({
      ...prev,
      isPaused: false,
    }));
    
    if (data.resumedBy?.toString() !== currentUser?.id?.toString()) {
      showNotificationMessage(
        `Recording resumed by ${data.resumedByName || "host"}`,
        "info"
      );
    }
  }
}
        // 🔥 NEW: Handle track_state_update broadcasts
        if (data.type === "track_state_update") {
          console.log("📡 Received track state update via data channel:", {
            userId: data.user_id,
            trackKind: data.track_kind,
            enabled: data.enabled,
            muted: data.muted,
          });

          // Update liveParticipants with broadcasted state
          setLiveParticipants((prev) => {
            return prev.map((p) => {
              const pId = (p.User_ID || p.user_id || p.ID)?.toString();

              if (pId === data.user_id?.toString()) {
                const updated = {
                  ...p,
                };

                if (data.track_kind === "audio") {
                  updated.audio_enabled = data.enabled;
                  updated.isAudioEnabled = data.enabled;
                  console.log(
                    `📡 Updated ${p.displayName || p.Full_Name
                    } audio via broadcast:`,
                    data.enabled
                  );
                } else if (data.track_kind === "video") {
                  updated.video_enabled = data.enabled;
                  updated.isVideoEnabled = data.enabled;
                  console.log(
                    `📡 Updated ${p.displayName || p.Full_Name
                    } video via broadcast:`,
                    data.enabled
                  );
                }

                return updated;
              }
              return p;
            });
          });
        }

        // Handle allow unmute audio
        if (
          data.type === "allow_unmute_audio" &&
          data.target_user_id?.toString() === currentUserId
        ) {
          showNotificationMessage(`You can now unmute your microphone`, "info");
        }

        // Handle force mute video
        if (
          data.type === "force_mute_video" &&
          data.target_user_id?.toString() === currentUserId
        ) {
          if (livekitToggleVideo && videoEnabled) {
            livekitToggleVideo();
          }

          showNotificationMessage(
            `Your camera was turned off by ${data.muted_by_name || "host"}`,
            "warning"
          );
        }

        // Handle allow unmute video
        if (
          data.type === "allow_unmute_video" &&
          data.target_user_id?.toString() === currentUserId
        ) {
          showNotificationMessage(`You can now turn on your camera`, "info");
        }
        if (data.type === "force_stop_screen_share") {
          const currentUserId = currentUser?.id?.toString();
          const currentIdentity = room?.localParticipant?.identity;

          // ✅ VALIDATE: Message must have target information
          if (!data.target_identity && !data.target_user_id) {
            console.warn("⚠️ Force stop message missing target - ignoring");
            return;
          }

          console.log("📺 Received force stop screen share:", {
            targetUserId: data.target_user_id,
            targetIdentity: data.target_identity,
            currentUserId,
            currentIdentity,
          });

          // ✅ CRITICAL: Check if message is for THIS user
          const isForMe =
            (data.target_user_id &&
              data.target_user_id?.toString() === currentUserId) ||
            (data.target_identity && data.target_identity === currentIdentity);

          console.log("📺 Force stop validation:", {
            isForMe,
            targetMatches: {
              userId: data.target_user_id?.toString() === currentUserId,
              identity: data.target_identity === currentIdentity,
            },
          });

          if (isForMe) {
            console.log("🛑 This force stop message is for me - processing");

            // Stop the screen share immediately
            if (livekitStopScreenShare) {
              livekitStopScreenShare();
            }

            // Update UI state
            setScreenSharing(false);
            setShowScreenShareWaiting(false);

            // Show dialog
            setScreenShareStoppedBy({
              name: data.stopped_by_name || "Host",
              full_name: data.stopped_by_name || "Host",
              user_id: data.stopped_by_id,
            });
            setShowScreenShareStopped(true);

            showNotificationMessage(
              `Your screen share was stopped by ${data.stopped_by_name || "host"
              }`,
              "warning"
            );
          } else {
            console.log("ℹ️ Force stop message not for me - ignoring");
          }
        }

        // Handle spotlight
        if (data.type === "spotlight_participant") {
          setLiveParticipants((prev) =>
            prev.map((p) => {
              const pId = (p.id || p.user_id || p.User_ID)?.toString();
              if (pId === data.target_user_id?.toString()) {
                return { ...p, spotlighted: data.spotlight };
              }
              if (data.spotlight && p.spotlighted) {
                return { ...p, spotlighted: false };
              }
              return p;
            })
          );

          if (data.target_user_id?.toString() === currentUserId) {
            showNotificationMessage(
              data.spotlight
                ? `✨ You have been spotlighted by ${data.set_by_name || "host"
                }`
                : `Spotlight removed by ${data.set_by_name || "host"}`,
              "info"
            );
          }
        }

        // Handle pin
        if (data.type === "pin_participant") {
          setLiveParticipants((prev) =>
            prev.map((p) => {
              const pId = (p.id || p.user_id || p.User_ID)?.toString();
              if (pId === data.target_user_id?.toString()) {
                return { ...p, pinned: data.pinned };
              }
              return p;
            })
          );

          if (data.target_user_id?.toString() === currentUserId) {
            showNotificationMessage(
              data.pinned
                ? `📌 Your video has been pinned by ${data.set_by_name || "host"
                }`
                : `Your video has been unpinned by ${data.set_by_name || "host"
                }`,
              "info"
            );
          }
        }

        // Handle volume
        if (
          data.type === "set_volume" &&
          data.target_user_id?.toString() === currentUserId
        ) {
          setLiveParticipants((prev) =>
            prev.map((p) => {
              const pId = (p.id || p.user_id || p.User_ID)?.toString();
              if (pId === data.target_user_id?.toString()) {
                return { ...p, volume: data.volume };
              }
              return p;
            })
          );

          showNotificationMessage(
            `🔊 Volume adjusted to ${data.volume}% by ${data.set_by_name || "host"
            }`,
            "info"
          );
        }
      } catch (error) {
        console.error("Data parse error:", error);
      }
    };

    room.on("dataReceived", handleDataReceived);

    return () => {
      room.off("dataReceived", handleDataReceived);
    };
  }, [
    room,
    currentUser?.id,
    audioEnabled,
    videoEnabled,
    livekitToggleAudio,
    livekitToggleVideo,
    livekitStopScreenShare,
    showNotificationMessage,
    setScreenSharing,
    setShowScreenShareWaiting,
    setShowScreenShareStopped,
    setScreenShareStoppedBy,
    setLiveParticipants,
  ]);

  useEffect(() => {
    window.blockAutoRefresh = false;
    console.log("🔧 Initialized blockAutoRefresh flag");

    return () => {
      // ✅ CRITICAL: Don't clear during active session
      if (meetingEnded) {
        window.blockAutoRefresh = false;
        console.log("🧹 Cleared blockAutoRefresh flag - meeting ended");
      } else {
        console.log("⏸️ Keeping blockAutoRefresh flag - meeting still active");
      }
    };
  }, [meetingEnded]);

  // 🔥 CRITICAL: Listen for instant stream updates
  useEffect(() => {
    const handleLocalStreamUpdate = (event) => {
      const { userId, hasStream } = event.detail;

      console.log("⚡ Local stream updated:", { userId, hasStream });

      // Force re-render of allParticipants
      setLiveParticipants((prev) => [...prev]);
    };

    window.addEventListener("localStreamUpdated", handleLocalStreamUpdate);

    return () => {
      window.removeEventListener("localStreamUpdated", handleLocalStreamUpdate);
    };
  }, []);

// src/components/meeting/MeetingRoom.jsx - REPLACE with this simpler version
useEffect(() => {
  // Only initialize hand raise when user actually opens the panel
  if (handRaiseOpen && realMeetingId && hasHostPrivileges && handRaiseInitialized) {
    console.log('🚀 Loading hands for open panel');
    loadRaisedHands().catch(error => {
      console.log('ℹ️ No hands to load yet:', error.message);
    });
  }
}, [handRaiseOpen, realMeetingId, hasHostPrivileges, handRaiseInitialized, loadRaisedHands]);


useEffect(() => {
  if (room && realMeetingId && currentUser && actualIsConnected) {
    // Wait a moment before starting systems
    const timer = setTimeout(() => {
      fetch(`${API_BASE_URL}/api/cache-reactions/start/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_id: realMeetingId })
      }).then(() => {
        console.log("🔥 Reaction system started");
      }).catch(err => console.log("ℹ️ Reaction system start delayed:", err.message));
    }, 5000);

    return () => clearTimeout(timer);
  }
}, [room, realMeetingId, currentUser, actualIsConnected]);

  // ✅ NEW: Listen for global screen share stop events
useEffect(() => {
  if (!room) return;

  const handleGlobalScreenShareStop = (payload, participant) => {
    try {
      const decoder = new TextDecoder();
      const data = JSON.parse(decoder.decode(payload));

      if (data.type === "screen_share_stopped_global") {
        console.log("🌐 MeetingRoom: Clearing screen share state globally");
        
        // Clear all local screen share state
        setScreenSharing(false);
        setScreenSharingParticipant(null);
        setScreenShareTrack(null);
        
        // Force re-render of video grid
        window.dispatchEvent(new CustomEvent('screenShareStopped', {
          detail: {
            stoppedBy: data.stopped_by_name,
            isForced: data.is_forced,
            timestamp: data.timestamp,
          }
        }));
      }
    } catch (error) {
      console.error("Error handling global screen share stop:", error);
    }
  };

  room.on(RoomEvent.DataReceived, handleGlobalScreenShareStop);

  return () => {
    room.off(RoomEvent.DataReceived, handleGlobalScreenShareStop);
  };
}, [room]);



// ==========================================================================
// EFFECTS - REMOTE TRACK MUTE/UNMUTE SYNC
// ==========================================================================
useEffect(() => {
  const handleRemoteTrackMuted = (event) => {
    const { userId, trackKind, participantName } = event.detail;

    console.log("📡 MeetingRoom: Remote track MUTED", {
      userId,
      trackKind,
      participantName,
    });

    // Update liveParticipants state
    setLiveParticipants((prev) => {
      return prev.map((p) => {
        const pId = (p.User_ID || p.user_id || p.ID)?.toString();

        if (pId === userId?.toString()) {
          return {
            ...p,
            audio_enabled: trackKind === "audio" ? false : p.audio_enabled,
            video_enabled: trackKind === "video" ? false : p.video_enabled,
            isAudioEnabled: trackKind === "audio" ? false : p.isAudioEnabled,
            isVideoEnabled: trackKind === "video" ? false : p.isVideoEnabled,
          };
        }
        return p;
      });
    });
  };

  const handleRemoteTrackUnmuted = (event) => {
    const { userId, trackKind, participantName } = event.detail;

    console.log("📡 MeetingRoom: Remote track UNMUTED", {
      userId,
      trackKind,
      participantName,
    });

    // Update liveParticipants state
    setLiveParticipants((prev) => {
      return prev.map((p) => {
        const pId = (p.User_ID || p.user_id || p.ID)?.toString();

        if (pId === userId?.toString()) {
          return {
            ...p,
            audio_enabled: trackKind === "audio" ? true : p.audio_enabled,
            video_enabled: trackKind === "video" ? true : p.video_enabled,
            isAudioEnabled: trackKind === "audio" ? true : p.isAudioEnabled,
            isVideoEnabled: trackKind === "video" ? true : p.isVideoEnabled,
          };
        }
        return p;
      });
    });
  };

  window.addEventListener("remoteTrackMuted", handleRemoteTrackMuted);
  window.addEventListener("remoteTrackUnmuted", handleRemoteTrackUnmuted);

  return () => {
    window.removeEventListener("remoteTrackMuted", handleRemoteTrackMuted);
    window.removeEventListener("remoteTrackUnmuted", handleRemoteTrackUnmuted);
  };
}, []);


// ==========================================================================
// EFFECTS - REMOTE VIDEO TRACK SYNC
// ==========================================================================
useEffect(() => {
  const handleRemoteVideoAdded = (event) => {
    const { userId, participantName, stream } = event.detail;
    console.log("📹 MeetingRoom: Remote video track ADDED", { userId, participantName });
    
    // Force re-render by updating a state
    setLiveParticipants((prev) => {
      return prev.map((p) => {
        const pId = (p.User_ID || p.user_id || p.ID)?.toString();
        if (pId === userId?.toString()) {
          return {
            ...p,
            video_enabled: true,
            isVideoEnabled: true,
            stream: stream,
          };
        }
        return p;
      });
    });
  };

  const handleRemoteVideoRemoved = (event) => {
    const { userId, participantName } = event.detail;
    console.log("📹 MeetingRoom: Remote video track REMOVED", { userId, participantName });
    
    setLiveParticipants((prev) => {
      return prev.map((p) => {
        const pId = (p.User_ID || p.user_id || p.ID)?.toString();
        if (pId === userId?.toString()) {
          return {
            ...p,
            video_enabled: false,
            isVideoEnabled: false,
            stream: null,
          };
        }
        return p;
      });
    });
  };

  window.addEventListener("remoteVideoTrackAdded", handleRemoteVideoAdded);
  window.addEventListener("remoteVideoTrackRemoved", handleRemoteVideoRemoved);

  return () => {
    window.removeEventListener("remoteVideoTrackAdded", handleRemoteVideoAdded);
    window.removeEventListener("remoteVideoTrackRemoved", handleRemoteVideoRemoved);
  };
}, []);


// ==========================================================================
// EFFECT - CAPTURE REMOTE VIDEO STREAMS FROM LIVEKIT
// ==========================================================================
useEffect(() => {
  if (!remoteParticipants || remoteParticipants.size === 0) return;

  console.log("📹 Processing remote participants for video streams:", remoteParticipants.size);

  const newStreamsMap = new Map(remoteVideoStreamsRef.current);
  let hasChanges = false;

  remoteParticipants.forEach((participant) => {
    // Extract user ID from identity
    let userId = participant.identity;
    if (participant.identity?.includes("user_")) {
      userId = participant.identity.split("_")[1];
    }

    // Check if participant has camera enabled
    const isCameraEnabled = participant.isCameraEnabled;
    
    // Get camera track publication
    const cameraPublication = participant.getTrackPublication?.(Track.Source.Camera);
    const cameraTrack = cameraPublication?.track;

    console.log("📹 Remote participant track check:", {
      name: participant.name || participant.identity,
      userId,
      isCameraEnabled,
      hasPublication: !!cameraPublication,
      hasTrack: !!cameraTrack,
      trackKind: cameraTrack?.kind,
    });

    if (cameraTrack && cameraTrack.mediaStreamTrack && isCameraEnabled) {
      const mediaStreamTrack = cameraTrack.mediaStreamTrack;
      
      // Check if track is live
      if (mediaStreamTrack.readyState === 'live') {
        // Create MediaStream from the track
        const videoStream = new MediaStream([mediaStreamTrack]);

        console.log("✅ Created video stream for remote participant:", {
          name: participant.name,
          userId,
          streamId: videoStream.id,
          trackState: mediaStreamTrack.readyState,
        });

        // Store with multiple keys for lookup
        newStreamsMap.set(participant.sid, videoStream);
        newStreamsMap.set(participant.identity, videoStream);
        newStreamsMap.set(userId, videoStream);
        newStreamsMap.set(`user_${userId}`, videoStream);
        newStreamsMap.set(`participant_${userId}`, videoStream);
        hasChanges = true;
      }
    } else if (!isCameraEnabled) {
      // Camera is disabled - remove streams
      const keysToRemove = [
        participant.sid,
        participant.identity,
        userId,
        `user_${userId}`,
        `participant_${userId}`,
      ];
      
      keysToRemove.forEach((key) => {
        if (newStreamsMap.has(key)) {
          newStreamsMap.delete(key);
          hasChanges = true;
        }
      });
    }
  });

  if (hasChanges) {
    remoteVideoStreamsRef.current = newStreamsMap;
    setRemoteVideoStreams(new Map(newStreamsMap));
    console.log("📹 Updated remote video streams map, total:", newStreamsMap.size);
  }
}, [remoteParticipants]);


// Listen for video state changes
useEffect(() => {
  const handleVideoChange = () => {
    setParticipantsVersion(prev => prev + 1);
  };

  window.addEventListener("remoteParticipantVideoEnabled", handleVideoChange);
  window.addEventListener("remoteParticipantVideoDisabled", handleVideoChange);
  window.addEventListener("remoteParticipantVideoStateChanged", handleVideoChange);
  window.addEventListener("remoteVideoTrackSubscribed", handleVideoChange);
  window.addEventListener("remoteTrackMuted", handleVideoChange);
  window.addEventListener("remoteTrackUnmuted", handleVideoChange);
  window.addEventListener("localVideoStateChanged", handleVideoChange);

  return () => {
    window.removeEventListener("remoteParticipantVideoEnabled", handleVideoChange);
    window.removeEventListener("remoteParticipantVideoDisabled", handleVideoChange);
    window.removeEventListener("remoteParticipantVideoStateChanged", handleVideoChange);
    window.removeEventListener("remoteVideoTrackSubscribed", handleVideoChange);
    window.removeEventListener("remoteTrackMuted", handleVideoChange);
    window.removeEventListener("remoteTrackUnmuted", handleVideoChange);
    window.removeEventListener("localVideoStateChanged", handleVideoChange);
  };
}, []);
  // ==========================================================================
  // RENDER
  // ==========================================================================


return (
  <MeetingContainer ref={meetingContainerRef}>

    {/* ── Meeting Ended Overlay ──────────────────────────────────────── */}
    <MeetingEndedOverlay
      meetingEnded={meetingEnded && !showFeedbackDialog && !feedbackSubmitted}
      onLeaveMeeting={handleLeaveMeeting}
      meetingId={realMeetingId}
      userId={currentUser?.id}
      meetingTitle={meetingData?.title || meetingData?.Title}
      currentUser={currentUser}
    />

    {/* ── Content Shell ──────────────────────────────────────────────── */}
    <ContentShell>

    <BrowserTabsHeader
        availableTabs={availableTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onTabClose={handleCloseTab}
        // ✅ Attendance props — moved from overlay to header
        attendanceEnabled={attendanceEnabled}
        attendanceData={currentAttendanceData}
        meetingId={realMeetingId}
        userId={currentUser?.id}
        userName={getParticipantDisplayName(currentUser)}
        isActive={actualIsConnected}
 cameraEnabled={livekitVideoEnabled ?? videoEnabled}     
    onViolation={handleAttendanceViolation}
        onStatusChange={handleAttendanceStatusChange}
        onSessionTerminated={handleAttendanceSessionTerminated}
        onToggleMinimized={() => setAttendanceMinimized(!attendanceMinimized)}
        isHost={isHost}
        isCoHost={isCoHost || coHostPrivilegesActive}
        effectiveRole={effectiveRole}
 onCameraToggle={handleCameraToggleForAttendance}      />

      {/* ── Body below tabs ────────────────────────────────────────── */}
      <Box
        sx={{
          pt: { xs: "52px", sm: "58px", md: "64px" },
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}
      >

      

        {/* ── Hand Raise Badge (fixed position) ────────────────────── */}
        <Grow in={pendingHandsCount > 0 && hasHostPrivileges} timeout={300}>
          <HandRaiseBadgeContainer>
            <HandRaiseNotification
              hasHostPrivileges={hasHostPrivileges}
              pendingHandsCount={pendingHandsCount}
              handRaiseOpen={handRaiseOpen}
              onClick={() => setHandRaiseOpen(true)}
            />
          </HandRaiseBadgeContainer>
        </Grow>

        {/* ── Screen Share Request Dialog ───────────────────────────── */}
        <ScreenShareRequestDialog
          open={showScreenShareRequest}
          onClose={() => setShowScreenShareRequest(false)}
          onApprove={handleApproveScreenShare}
          onDeny={handleDenyScreenShare}
          currentScreenShareRequest={currentScreenShareRequest}
          hasHostPrivileges={hasHostPrivileges}
        />

        {/* ═════════════════════════════════════════════════════════════
            MAIN STAGE — horizontal row: VideoColumn | PanelSlot(s)
            ═════════════════════════════════════════════════════════ */}
        <MainStage>

          {/* ═══════════════════════════════════════════════════════════
              VIDEO COLUMN — video grid + control bar in one column
              Both shrink together when panels open on desktop.
              ═══════════════════════════════════════════════════════ */}
          <VideoColumn>

            {/* ── Video / Whiteboard Area ──────────────────────────── */}
            <VideoArea>
              {activeTab === "meeting" && (
                <MeetingTabContent
                  actualIsConnected={actualIsConnected}
                  isConnecting={isConnecting}
                  connectionAttemptRef={connectionAttemptRef}
                  allParticipants={allParticipants}
                  localStream={localStream}
                  combinedStreams={combinedStreams}
                  enhancedScreenShareData={enhancedScreenShareData}
                  currentUser={currentUser}
                  hasHostPrivileges={hasHostPrivileges}
                  onRemoveParticipant={handleRemoveParticipant}
                  onPromoteToCoHost={handlePromoteToCoHost}
                  onRemoveCoHost={handleRemoveCoHost}
                  handleParticipantsUpdated={handleParticipantsUpdated}
                  establishLiveKitConnection={establishLiveKitConnection}
                  viewMode={viewMode}
                  currentPerformanceMode={currentPerformanceMode}
                  currentMaxParticipants={currentMaxParticipants}
                  coHosts={coHosts}
                  currentAttendanceData={currentAttendanceData}
                />
              )}

              {activeTab === "whiteboard" && availableTabs.includes("whiteboard") && (
                <WhiteboardTabContent
                  meetingId={realMeetingId}
                  currentUser={currentUser}
                  allParticipants={allParticipants}
                  hasHostPrivileges={hasHostPrivileges}
                  room={room}
                  onClose={() => handleCloseTab("whiteboard")}
                  onError={handleWhiteboardError}
                  onSuccess={handleWhiteboardSuccess}
                />
              )}
            </VideoArea>

            {/* ── CONTROL BAR (inside VideoColumn — moves with grid) ── */}
            <ControlBarWrapper>
              <MeetingControlBar
                audioEnabled={livekitAudioEnabled}
                videoEnabled={livekitVideoEnabled}
                screenSharing={screenSharing}
                isScreenSharing={livekitLocalIsScreenSharing}
                enhancedScreenShareData={enhancedScreenShareData}
                currentUser={currentUser}
                isConnected={actualIsConnected}
                chatOpen={chatOpen}
                participantsOpen={participantsOpen}
                reactionsOpen={reactionsOpen}
                handRaiseOpen={handRaiseOpen}
                showToggleMenu={showToggleMenu}
                attendanceMinimized={attendanceMinimized}
                onToggleAudio={livekitToggleAudio}
                onToggleVideo={livekitToggleVideo}
                onToggleScreenShare={handleScreenShareClick}
                onToggleChat={handleToggleChat}
                onToggleParticipants={handleParticipantsButtonClick}
                onToggleReactions={handleToggleReactions}
                onToggleHandRaise={handleToggleHandRaiseAction}
                onToggleMenu={handleToggleMenu}
                onToggleAttendance={handleToggleAttendance}
                onLeaveMeeting={() => setShowLeaveDialog(true)}
                meetingSettings={meetingSettings}
                participantCount={allParticipants.length}
                chatUnreadCount={chatStats.unread}
                pendingHandsCount={pendingHandsCount}
                isHandRaised={isHandRaised}
                hasHostPrivileges={hasHostPrivileges}
                attendanceEnabled={attendanceEnabled}
                currentAttendanceData={currentAttendanceData}
                meetingId={realMeetingId}
  meetingCode={meetingData?.meeting_code || meetingData?.Meeting_Code || realMeetingId}
  meetingLink={meetingLink}
    recordingState={recordingState}
  onToggleRecording={handleToggleRecording}
  onPauseResumeRecording={handlePauseResumeRecording}
  onToggleWhiteboard={handleToggleWhiteboard}
  onEndMeeting={() => setShowEndMeetingDialog(true)}
  onFullscreen={handleFullscreen}
  isFullscreen={isFullscreen}
              />
            </ControlBarWrapper>

          </VideoColumn>
          {/* ═══ END VideoColumn ═══ */}

{/* ═══ SINGLE PANEL SLOT — eliminates gap from dual empty slots ═══ */}
<PanelSlot isOpen={chatOpen || participantsOpen} side="right">
  {chatOpen && (
    <ChatPanelWrapper
      isOpen={chatOpen}
      onClose={handleToggleChat}
      meetingId={realMeetingId}
      currentUser={currentUser}
      participants={allParticipants}
      hasHostPrivileges={hasHostPrivileges}
      chatPermissions={{
        canSendMessages: meetingSettings.chatEnabled,
        canUploadFiles: true,
      }}
      onUnreadCountChange={handleChatUnreadCountChange}
      onTotalMessagesChange={handleChatTotalMessagesChange}
      onMessageReceived={handleChatMessageReceived}
      onChatOpened={handleChatOpened}
    />
  )}
  {participantsOpen && (
    <ParticipantsPanelWrapper
      isOpen={participantsOpen}
      onClose={() => setParticipantsOpen(false)}
      participants={allParticipants}
      currentUser={currentUser}
      isHost={isHost}
      isCoHost={isCoHost}
      coHosts={coHosts}
      hasHostPrivileges={hasHostPrivileges}
      onMuteParticipant={handleMuteParticipant}
      onUnmuteParticipant={handleUnmuteParticipant}
      onMuteVideo={handleMuteVideo}
      onUnmuteVideo={handleUnmuteVideo}
      onRemoveParticipant={handleRemoveParticipant}
      onPromoteToCoHost={handlePromoteToCoHost}
      onRemoveCoHost={handleRemoveCoHost}
      onParticipantsUpdated={handleParticipantsUpdated}
    />
  )}
</PanelSlot>

        </MainStage>
        {/* ═══ END MainStage ═══ */}

        {/* ── Hand Raise Panel (absolute overlay) ──────────────────── */}
        <HandRaisePanelWrapper
          isOpen={handRaiseOpen}
          onClose={() => setHandRaiseOpen(false)}
          hasHostPrivileges={hasHostPrivileges}
          raisedHands={raisedHands}
          totalHandsCount={totalHandsCount}
          pendingHandsCount={pendingHandsCount}
          handRaiseLoading={handRaiseLoading}
          handRaiseStats={handRaiseStats}
          onAcknowledgeHand={handleAcknowledgeHand}
          onDenyHand={handleDenyHand}
          onClearAllHands={handleClearAllHands}
        />

        {/* ── Reactions ────────────────────────────────────────────── */}
        <ReactionsManager
          meetingId={realMeetingId}
          currentUser={currentUser}
          room={room}
          allParticipants={allParticipants}
          reactionsOpen={reactionsOpen}
          onReactionsToggle={setReactionsOpen}
          reactionsEnabled={meetingSettings.reactionsEnabled}
          isConnected={actualIsConnected}
          isHost={isHost}
          isCoHost={isCoHost}
          onNotification={showNotificationMessage}
          onError={(error) => console.error("Reactions error:", error)}
          showSoundControl
          soundEnabled
          showDebugInfo={false}
          enableReactionHistory
          enableReactionStats
          autoHideReactions
          reactionDisplayDuration={5000}
          maxVisibleReactions={10}
        />

        {/* ── Actions Menu ─────────────────────────────────────────── */}
        <MeetingActionsMenu
          open={showToggleMenu}
          onClose={() => setShowToggleMenu(false)}
          chatOpen={chatOpen}
          participantsOpen={participantsOpen}
          recordingState={recordingState}
          hasHostPrivileges={hasHostPrivileges}
          meetingSettings={meetingSettings}
          attendanceEnabled={attendanceEnabled}
          currentAttendanceData={currentAttendanceData}
          isFullscreen={isFullscreen}
          toggleMenuItems={toggleMenuItems}
          onItemClick={(action) => action()}
        />
      </Box>
    </ContentShell>

    {/* ═══════════════════════════════════════════════════════════════════
        DIALOGS & OVERLAYS — unchanged
        ═══════════════════════════════════════════════════════════════ */}

    <LeaveMeetingDialog
      open={showLeaveDialog}
      onClose={() => setShowLeaveDialog(false)}
      onConfirm={handleLeaveMeeting}
      isHost={isHost}
      isCoHost={isCoHost}
      coHostPrivilegesActive={coHostPrivilegesActive}
      queueStatus={queueStatus}
    />

    <EndMeetingDialog
      open={showEndMeetingDialog}
      onClose={() => setShowEndMeetingDialog(false)}
      onConfirm={handleEndMeeting}
      coHosts={coHosts}
      attendanceEnabled={attendanceEnabled}
    />

    <ScreenShareWaitingOverlay
      showWaiting={showScreenShareWaiting}
      onCancel={() => setShowScreenShareWaiting(false)}
    />

    <ConnectionQueueOverlay
      showQueue={showQueueOverlay}
      queuePosition={queuePosition}
      estimatedWaitTime={estimatedWaitTime}
    />

    <MeetingLinkPopup
      open={showMeetingLinkPopup}
      minimized={meetingLinkMinimized}
      meetingLink={meetingLink}
      currentUser={currentUser}
      onClose={() => setShowMeetingLinkPopup(false)}
      onCopy={handleCopyMeetingLink}
      onMinimize={() => setMeetingLinkMinimized(true)}
      onRestore={() => {
        setMeetingLinkMinimized(false);
        setShowMeetingLinkPopup(true);
      }}
      getParticipantDisplayName={getParticipantDisplayName}
    />

    <FeedbackDialog
      open={showFeedbackDialog}
      onClose={handleFeedbackSkip}
      meetingId={realMeetingId}
      userId={currentUser?.id}
      meetingTitle={meetingData?.title || meetingData?.Title || "Meeting Feedback"}
      onSubmitSuccess={handleFeedbackSubmitSuccess}
      onSkip={handleFeedbackSkip}
    />

    <RecordingNameDialog
      open={showRecordingNameDialog}
      onClose={() => {
        setShowRecordingNameDialog(false);
        setPendingRecordingData(null);
      }}
      onSave={handleSaveRecordingName}
      defaultName={
        pendingRecordingData
          ? `${meetingData?.title || "Meeting"}_${new Date()
              .toLocaleDateString("en-US")
              .replace(/\//g, "-")}`
          : ""
      }
    />

    <ScreenShareStoppedDialog
      open={showScreenShareStopped}
      onClose={() => setShowScreenShareStopped(false)}
      stoppedBy={screenShareStoppedBy}
      stoppedParticipant={null}
      isCurrentUser
      reason="Stopped by host/co-host"
    />

    <ForceStopScreenShareDialog
      open={showForceStopDialog}
      onClose={() => {
        setShowForceStopDialog(false);
        setForceStopTargetParticipant(null);
      }}
      onConfirm={handleConfirmForceStop}
      participantName={forceStopTargetParticipant?.name}
      participantData={forceStopTargetParticipant?.data}
    />

    {/* ── Upload Progress ──────────────────────────────────────────── */}
    <UploadProgressBar
      uploading={recordingState.uploading}
      uploadProgress={recordingState.uploadProgress}
    />

    {/* ── Notifications ────────────────────────────────────────────── */}
    <NotificationManager
      notification={notification}
      showNotification={showNotification}
      onClose={hideNotification}
    />

    {/* ── Thank You Overlay (post-feedback) ────────────────────────── */}
    {feedbackSubmitted && !showFeedbackDialog && (
      <ThankYouOverlay>
        <GlassCard>
          <Typography
            variant="h3"
            sx={{
              color: "#f0f4f8",
              fontWeight: 800,
              mb: 2,
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: "-0.02em",
              fontSize: { xs: "1.75rem", sm: "2.25rem", md: "2.75rem" },
            }}
          >
            🙏 Thank You!
          </Typography>
          <Typography
            variant="h6"
            sx={{
              background: "linear-gradient(135deg, #38bdf8, #a78bfa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontWeight: 600,
              mb: 1.5,
              fontSize: { xs: "0.95rem", sm: "1.1rem", md: "1.25rem" },
            }}
          >
            Your feedback has been recorded
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "rgba(255,255,255,0.5)", mb: 3 }}
          >
            Redirecting to dashboard…
          </Typography>
          <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
            <ProgressDot delay={0} />
            <ProgressDot delay={0.2} />
            <ProgressDot delay={0.4} />
          </Box>
        </GlassCard>
      </ThankYouOverlay>
    )}
  </MeetingContainer>
);
});

export default MeetingRoom;