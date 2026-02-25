import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Card,
  CardContent,
  LinearProgress,
  Tooltip,
  Button,
  Alert,
  CircularProgress,
  Snackbar,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  Coffee,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  Videocam,
  VideocamOff,
  Stop,
  SupervisorAccount,
  AdminPanelSettings,
  PersonOff,
  Close,
  VideocamOutlined,
  FiberManualRecord,
  Shield,
  Face,
} from "@mui/icons-material";
import { styled, keyframes } from "@mui/material/styles";

import AttendancePopup from "./AttendancePopup";

// ==================== ANIMATIONS ====================
const livePulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;

const breakPulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

// ==================== STYLED COMPONENTS (INLINE / HORIZONTAL MODE) ====================

const InlineContainer = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
  height: 32,
  padding: "0 10px",
  borderRadius: 8,
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.07)",
  transition: "all 0.2s ease",
  flexShrink: 0,
  overflow: "hidden",
  maxWidth: "100%",
}));

const InlineStatusDot = styled(FiberManualRecord, {
  shouldForwardProp: (prop) => prop !== "status",
})(({ status }) => ({
  fontSize: 7,
  flexShrink: 0,
  color:
    status === "active" ? "#4caf50" :
    status === "warning" ? "#ff9800" :
    status === "violation" ? "#f44336" :
    status === "break" ? "#2196f3" :
    status === "terminated" ? "#f44336" :
    status === "unauthorized" ? "#9c27b0" :
    "rgba(255,255,255,0.3)",
  animation:
    status === "active" ? `${livePulse} 2s ease-in-out infinite` :
    status === "break" ? `${breakPulse} 1.5s ease-in-out infinite` :
    "none",
}));

const InlineDivider = styled(Box)(() => ({
  width: 1,
  height: 16,
  background: "rgba(255, 255, 255, 0.1)",
  flexShrink: 0,
}));

const InlineLabel = styled(Typography)(() => ({
  fontSize: "11px",
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: "nowrap",
  letterSpacing: "0.02em",
  fontVariantNumeric: "tabular-nums",
}));

const InlineProgressBar = styled(Box)(() => ({
  width: 48,
  height: 3,
  borderRadius: 2,
  background: "rgba(255, 255, 255, 0.08)",
  overflow: "hidden",
  flexShrink: 0,
}));

const InlineProgressFill = styled(Box, {
  shouldForwardProp: (prop) => prop !== "value" && prop !== "barColor",
})(({ value = 0, barColor = "#4caf50" }) => ({
  height: "100%",
  width: `${Math.min(100, Math.max(0, value))}%`,
  background: barColor,
  borderRadius: 2,
  transition: "width 0.4s ease",
}));

const InlineBreakTimer = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "2px 8px",
  borderRadius: 6,
  background: "rgba(33, 150, 243, 0.15)",
  border: "1px solid rgba(33, 150, 243, 0.3)",
  cursor: "pointer",
  transition: "all 0.15s ease",
  "&:hover": {
    background: "rgba(33, 150, 243, 0.25)",
    border: "1px solid rgba(33, 150, 243, 0.5)",
  },
}));

const InlineActionButton = styled(IconButton)(() => ({
  width: 22,
  height: 22,
  padding: 0,
  color: "rgba(255, 255, 255, 0.5)",
  transition: "all 0.15s ease",
  "&:hover": {
    color: "rgba(255, 255, 255, 0.9)",
    background: "rgba(255, 255, 255, 0.08)",
  },
  "& .MuiSvgIcon-root": { fontSize: 14 },
}));

const WarningBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== "severity",
})(({ severity = "warning" }) => ({
  display: "flex",
  alignItems: "center",
  gap: 3,
  padding: "1px 6px",
  borderRadius: 4,
  fontSize: "10px",
  fontWeight: 700,
  lineHeight: 1,
  background:
    severity === "error" ? "rgba(244, 67, 54, 0.15)" :
    severity === "warning" ? "rgba(255, 152, 0, 0.12)" :
    severity === "info" ? "rgba(33, 150, 243, 0.12)" :
    "rgba(255, 255, 255, 0.06)",
  color:
    severity === "error" ? "#ef5350" :
    severity === "warning" ? "#ffb74d" :
    severity === "info" ? "#64b5f6" :
    "rgba(255, 255, 255, 0.5)",
  border: `1px solid ${
    severity === "error" ? "rgba(244, 67, 54, 0.2)" :
    severity === "warning" ? "rgba(255, 152, 0, 0.15)" :
    severity === "info" ? "rgba(33, 150, 243, 0.15)" :
    "rgba(255, 255, 255, 0.06)"
  }`,
}));

const violationSlide = keyframes`
  0% { opacity: 0; transform: translateX(8px); }
  100% { opacity: 1; transform: translateX(0); }
`;

const violationPulse = keyframes`
  0%, 100% { border-color: rgba(244, 67, 54, 0.35); }
  50% { border-color: rgba(244, 67, 54, 0.7); }
`;

const InlineViolationStrip = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "2px 8px 2px 6px",
  borderRadius: 6,
  background: "rgba(244, 67, 54, 0.10)",
  border: "1px solid rgba(244, 67, 54, 0.35)",
  maxWidth: 220,
  overflow: "hidden",
  flexShrink: 1,
  minWidth: 0,
  animation: `${violationSlide} 0.25s ease-out, ${violationPulse} 2.5s ease-in-out infinite`,
}));

const ViolationText = styled(Typography)(() => ({
  fontSize: "10px",
  fontWeight: 600,
  color: "#ef5350",
  lineHeight: 1.2,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  letterSpacing: "0.01em",
}));

const ViolationCount = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 15,
  height: 15,
  borderRadius: "50%",
  backgroundColor: "#f44336",
  fontSize: "9px",
  fontWeight: 800,
  color: "#fff",
  flexShrink: 0,
  lineHeight: 1,
}));

// ==================== STYLED COMPONENTS (CARD / FLOATING MODE) ====================
const AttendanceContainer = styled(Box)(({ theme }) => ({
  position: "fixed",
  top: theme.spacing(0.5),
  right: theme.spacing(5),
  zIndex: 1000,
}));

const AttendanceIndicator = styled(Card)(({ theme }) => ({
  backgroundColor: "rgba(0,0,0,0.9)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "white",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
}));

const StatusChip = styled(Chip)(({ status }) => ({
  height: 22,
  fontSize: "0.7rem",
  fontWeight: 600,
  color: "white",
  backgroundColor:
    status === "active"
      ? "rgba(76,175,80,0.8)"
      : status === "warning"
        ? "rgba(255,152,0,0.8)"
        : status === "violation"
          ? "rgba(244,67,54,0.8)"
          : status === "break"
            ? "rgba(33,150,243,0.8)"
            : status === "excluded"
              ? "rgba(158,158,158,0.8)"
              : status === "host_tracking"
                ? "rgba(76,175,80,0.6)"
                : status === "terminated"
                  ? "rgba(244,67,54,0.9)"
                  : status === "initializing"
                    ? "rgba(255,193,7,0.8)"
                    : status === "unauthorized"
                      ? "rgba(156,39,176,0.8)"
                      : "rgba(158,158,158,0.8)",
}));

const CameraPromptDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    backgroundColor: '#FFFFFF',
    border: '3px solid #FF9800',
    borderRadius: theme.spacing(2),
    minWidth: 420,
    maxWidth: 550,
    boxShadow: '0 8px 32px rgba(255, 152, 0, 0.3)',
  }
}));

// ==================== CONFIGURATION ====================
const AttendanceConfig = {
  MAX_WARNING_MESSAGES: 4,
  IDENTITY_MAX_WARNINGS: 3,
  VIOLATION_AUTO_REMOVAL_TIME: 120,
  BREAK_DURATION: 300,
  MAX_TOTAL_BREAK_TIME: 300,
  DETECTION_INTERVAL: 3000,
  GRACE_PERIOD_DURATION: 2,
  CAMERA_VERIFICATION_TIMEOUT: 5,
  CAMERA_PROMPT_DELAY: 3000,
  SYNC_INTERVAL_NORMAL: 10000,
  SYNC_INTERVAL_BREAK: 5000,
  API_TIMEOUT: 8000, // ✅ NEW: 8-second timeout for API calls
};

// ==================== API CONFIGURATION ====================
const API_BASE = 'https://192.168.48.201:8220';

// ==================== MAIN COMPONENT ====================
const AttendanceTracker = ({
  meetingId,
  userId,
  userName,
  isActive = true,
  cameraEnabled: propCameraEnabled = false,
  onViolation,
  onStatusChange,
  minimized = false,
  onToggleMinimized,
  onCameraToggle,
  onSessionTerminated,
  isHost = false,
  isCoHost = false,
  effectiveRole = "participant",
  inline = false,
}) => {

  // ==================== REFS ====================
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const streamRef = useRef(null);
  const mountedRef = useRef(true);
  const breakTimerRef = useRef(null);
  const roleHistoryRef = useRef([]);
  const breakProcessingRef = useRef(false);
  const autoResumeInProgressRef = useRef(false);
  const startTrackingInProgressRef = useRef(false);
  const cameraVerificationTokenRef = useRef(null);
  const cameraWasEnabledBeforeBreakRef = useRef(false);
  const gracePeriodRef = useRef({ active: false, until: 0 });
  const cameraPromptTimerRef = useRef(null);
  const syncIntervalRef = useRef(null);

  const isOnBreakRef = useRef(false);
  const isTrackingRef = useRef(false);
  const isSessionActiveRef = useRef(false);
  const isSessionTerminatedRef = useRef(false);
  const currentTrackingModeRef = useRef("participant");
  const cameraEnabledRef = useRef(propCameraEnabled);

  const handleEndBreakRef = useRef(null);
  const captureAndAnalyzeRef = useRef(null);

  // ==================== FACE AUTHENTICATION REFS ====================
  const lastAuthCheckTimeRef = useRef(0);
  const authCheckIntervalRef = useRef(null);
  const isAuthBlockedRef = useRef(false);

  // ==================== SESSION STATE ====================
  const [isSessionTerminated, setIsSessionTerminated] = useState(false);
  const [isSessionPermanentlyEnded, setIsSessionPermanentlyEnded] = useState(false);
  const [terminationReason, setTerminationReason] = useState("");
  const [terminationCountdown, setTerminationCountdown] = useState(null);
  const [isTerminating, setIsTerminating] = useState(false);

  // ==================== ROLE TRACKING STATE ====================
  const [currentTrackingMode, setCurrentTrackingMode] = useState("participant");
  const [roleTransitionInProgress, setRoleTransitionInProgress] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(Date.now());

  // ==================== TRACKING STATE ====================
  const [isTracking, setIsTracking] = useState(false);
  const [attendanceData, setAttendanceData] = useState({
    attendancePercentage: 100,
    engagementScore: 100,
    popupCount: 0,
    maxPopups: 4,
    breakUsed: false,
    violations: [],
    currentViolations: [],
    frameCount: 0,
    lastDetectionTime: null,
    totalPresenceTime: 0,
    roleHistory: [],
  });

  // ==================== VIOLATION STATE ====================
  const [currentViolations, setCurrentViolations] = useState([]);

  // ==================== MODAL STATE ====================
  const [showTerminationPopup, setShowTerminationPopup] = useState(false);
  const [terminationMessage, setTerminationMessage] = useState("");

  // ==================== CAMERA ENABLE PROMPT STATE ====================
  const [showCameraEnablePrompt, setShowCameraEnablePrompt] = useState(false);
  const [cameraPromptDismissed, setCameraPromptDismissed] = useState(false);

  // ==================== TOAST STATE ====================
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastSeverity, setToastSeverity] = useState("info");
  const [toastVariant, setToastVariant] = useState("standard");

  const [sessionActive, setSessionActive] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [processingFrame, setProcessingFrame] = useState(false);
  const [gracePeriodActive, setGracePeriodActive] = useState(false);

  // ==================== WARNING SYSTEM STATE ====================
  const [warningCount, setWarningCount] = useState(0);
  const [warningsExhausted, setWarningsExhausted] = useState(false);

  // ==================== IDENTITY STATES ====================
  const [authWarningCount, setAuthWarningCount] = useState(0);
  const [isAuthBlocked, setIsAuthBlocked] = useState(false);

  // ==================== BREAK MANAGEMENT STATE ====================
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakTimeLeft, setBreakTimeLeft] = useState(0);
  const breakTimeLeftRef = useRef(0);
  const [totalBreakTimeUsed, setTotalBreakTimeUsed] = useState(0);
  const [breakTimeRemaining, setBreakTimeRemaining] = useState(300);
  const [showSuccessPopup, setShowSuccessPopup] = useState(true);
  const [breakStartedAt, setBreakStartedAt] = useState(null);
  const [breakCount, setBreakCount] = useState(0);
  const [isProcessingBreak, setIsProcessingBreak] = useState(false);

  // ==================== CAMERA STATE ====================
  const [cameraEnabled, setCameraEnabled] = useState(propCameraEnabled);
  const [cameraInitStatus, setCameraInitStatus] = useState("idle");
  const [cameraInitError, setCameraInitError] = useState("");

  // ==================== FACE AUTHENTICATION STATE ====================
  const [faceAuthStatus, setFaceAuthStatus] = useState("verified");

  // ==================== SYNC REFS WITH STATE ====================
  useEffect(() => { isOnBreakRef.current = isOnBreak; }, [isOnBreak]);
  useEffect(() => { isTrackingRef.current = isTracking; }, [isTracking]);
  useEffect(() => { isSessionActiveRef.current = sessionActive; }, [sessionActive]);
  useEffect(() => { isSessionTerminatedRef.current = isSessionTerminated; }, [isSessionTerminated]);
  useEffect(() => { currentTrackingModeRef.current = currentTrackingMode; }, [currentTrackingMode]);
  useEffect(() => { cameraEnabledRef.current = cameraEnabled; }, [cameraEnabled]);
  useEffect(() => { breakTimeLeftRef.current = breakTimeLeft; }, [breakTimeLeft]);

  // ====================================================================
  // CENTRALIZED BREAK GUARD
  // ====================================================================
  const canEnableCamera = useCallback(() => {
    if (isOnBreakRef.current) {
      console.log("[BREAK GUARD] Camera enable BLOCKED - participant is on break");
      return false;
    }
    if (isSessionTerminatedRef.current) {
      console.log("[BREAK GUARD] Camera enable BLOCKED - session terminated");
      return false;
    }
    if (breakProcessingRef.current) {
      console.log("[BREAK GUARD] Camera enable BLOCKED - break processing in progress");
      return false;
    }
    return true;
  }, []);

  const safeCameraEnable = useCallback((source = "unknown") => {
    if (!canEnableCamera()) {
      console.log(`[SAFE CAMERA] Blocked camera enable from source: ${source}`);
      return false;
    }
    console.log(`[SAFE CAMERA] Allowing camera enable from source: ${source}`);
    return true;
  }, [canEnableCamera]);

  const forceDisableCameraDuringBreak = useCallback(() => {
    if (!isOnBreakRef.current) return;
    console.log("[BREAK GUARD] Force-disabling camera during break");
    setCameraEnabled(false);
    cameraEnabledRef.current = false;
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsTracking(false);
    isTrackingRef.current = false;
    if (onCameraToggle) {
      try { onCameraToggle(false); } catch (e) { console.warn("[BREAK GUARD] Failed to notify parent:", e); }
    }
  }, [onCameraToggle]);

  // ==================== ROLE-BASED TRACKING MODE ====================
  const determineTrackingMode = useCallback(() => {
    if (isHost || effectiveRole === "host") return "host";
    if (isCoHost || effectiveRole === "co-host" || effectiveRole === "cohost") return "cohost";
    return "participant";
  }, [isHost, isCoHost, effectiveRole]);

  const shouldDetectViolations = useMemo(() => {
    return currentTrackingMode === "participant" && sessionActive && !isSessionTerminated && !isOnBreak;
  }, [currentTrackingMode, sessionActive, isSessionTerminated, isOnBreak]);

  const canTakeBreak = useMemo(() => {
    return (
      currentTrackingMode === "participant" &&
      breakTimeRemaining >= 5 &&
      sessionActive &&
      !isOnBreak &&
      !isSessionTerminated &&
      !isProcessingBreak &&
      totalBreakTimeUsed < 300 &&
      !isAuthBlocked
    );
  }, [currentTrackingMode, breakTimeRemaining, sessionActive, isOnBreak, isSessionTerminated, isProcessingBreak, totalBreakTimeUsed, isAuthBlocked]);

  // ==================== TOAST HELPER ====================
  const triggerToast = useCallback((message, severity = "info") => {
    if (!message || !mountedRef.current) return;
    setToastMessage(message);
    setToastSeverity(severity);
    setToastVariant(severity === 'error' || severity === 'warning' ? 'filled' : 'standard');
    setToastOpen(true);
  }, []);

  const handleToastClose = useCallback((event, reason) => {
    if (reason === 'clickaway') return;
    setToastOpen(false);
  }, []);

  // ==================== API CALL HELPER ====================
  // ✅ UPDATED: Added AbortController with 8-second timeout
  // Prevents hung requests from permanently blocking frame processing
  const apiCall = useCallback(async (endpoint, method = "GET", data = null) => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_BASE}/api/attendance${cleanEndpoint}`.replace(/([^:]\/)\/+/g, "$1");
    const httpMethod = method.toUpperCase();
    console.log(`[API CALL] ${httpMethod} ${url}`);

    // ✅ NEW: AbortController with timeout to prevent hung requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AttendanceConfig.API_TIMEOUT);

    const options = {
      method: httpMethod,
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: 'include',
      signal: controller.signal, // ✅ NEW: Attach abort signal
    };
    if (data && ["POST", "PUT", "PATCH"].includes(httpMethod)) {
      options.body = JSON.stringify({
        ...data,
        current_tracking_mode: currentTrackingModeRef.current,
        role_history: roleHistoryRef.current,
        session_start_time: sessionStartTime,
      });
    }
    try {
      const response = await fetch(url, options);
      clearTimeout(timeoutId); // ✅ NEW: Clear timeout on successful response
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new Error('Server returned HTML instead of JSON - check nginx config');
      }
      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
        try { error.data = JSON.parse(errorText); } catch { error.data = { error: errorText }; }
        throw error;
      }
      try { return await response.json(); } catch (parseError) { throw new Error('Invalid JSON response from server'); }
    } catch (error) {
      clearTimeout(timeoutId); // ✅ NEW: Clear timeout on error too
      // ✅ NEW: Handle abort (timeout) specifically
      if (error.name === 'AbortError') {
        console.error(`[API TIMEOUT] ${httpMethod} ${url}: Request timed out after ${AttendanceConfig.API_TIMEOUT / 1000}s`);
        throw new Error('Request timed out - server may be slow');
      }
      console.error(`[API ERROR] ${httpMethod} ${url}:`, error.message);
      throw error;
    }
  }, [sessionStartTime]);

  // ==================== DISPLAY NOTIFICATION SYSTEM ====================
  const showViolationPopup = useCallback((message, type = "warning", force = false) => {
    if (!mountedRef.current) return;
    if (currentTrackingModeRef.current !== "participant" && type !== "info" && type !== "success") return;
    const isTermination = type === "error" && (message.toLowerCase().includes("terminated") || message.toLowerCase().includes("blocked") || message.toLowerCase().includes("removed"));
    if (isTermination) {
      setTerminationMessage(message);
      setShowTerminationPopup(true);
    } else {
      if (type === "success" && !force) {
        if (!showSuccessPopup) return;
        setShowSuccessPopup(false);
      }
      let toastType = type;
      if (type === "violation") toastType = "warning";
      triggerToast(message, toastType);
    }
    if (onViolation) onViolation({ message, type, timestamp: Date.now() });
  }, [onViolation, showSuccessPopup, triggerToast]);

  // ==================== SESSION TERMINATION HANDLER ====================
  const handleSessionTermination = useCallback(async (reason = "violations", message = "Session ended due to violations") => {
    if (currentTrackingModeRef.current !== "participant") return;
    if (isSessionTerminatedRef.current) return;
    console.log("[TERMINATION] Starting termination process:", reason);
    setIsSessionTerminated(true);
    setIsSessionPermanentlyEnded(true);
    setTerminationReason(reason);
    setSessionActive(false);
    setIsTracking(false);
    setIsTerminating(true);
    setShowCameraEnablePrompt(false);
    isSessionTerminatedRef.current = true;
    isSessionActiveRef.current = false;
    isTrackingRef.current = false;
    try {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      if (breakTimerRef.current) { clearInterval(breakTimerRef.current); breakTimerRef.current = null; }
      if (authCheckIntervalRef.current) { clearInterval(authCheckIntervalRef.current); authCheckIntervalRef.current = null; }
      if (cameraPromptTimerRef.current) { clearTimeout(cameraPromptTimerRef.current); cameraPromptTimerRef.current = null; }
      if (syncIntervalRef.current) { clearInterval(syncIntervalRef.current); syncIntervalRef.current = null; }
      if (streamRef.current) { streamRef.current.getTracks().forEach((track) => track.stop()); streamRef.current = null; }
      if (videoRef.current) videoRef.current.srcObject = null;
      setVideoReady(false);
      if (meetingId && userId) {
        try {
          await apiCall("/stop/", "POST", { meeting_id: meetingId, user_id: userId, reason: "session_terminated", termination_reason: reason });
        } catch (backendError) { console.warn("[TERMINATION] Failed to notify backend:", backendError.message); }
      }
    } catch (cleanupError) { console.error("[TERMINATION] Cleanup error:", cleanupError); }
    showViolationPopup(message, "error");
    setTerminationCountdown(3);
    const countdownInterval = setInterval(() => {
      setTerminationCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          if (onSessionTerminated) {
            onSessionTerminated({ userId, userName, reason, message, timestamp: Date.now(), participantSpecific: true, permanent: true });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [meetingId, userId, userName, onSessionTerminated, showViolationPopup, apiCall]);

  // ==================== CAMERA INITIALIZATION ====================
  const initializeCamera = useCallback(async () => {
    if (isSessionTerminatedRef.current) return false;
    if (isOnBreakRef.current) { console.log("[CAMERA] Init blocked - participant is on break"); return false; }
    try {
      setCameraError(null);
      setCameraInitStatus("initializing");
      setCameraInitError("");
      const constraints = [
        { video: { width: 640, height: 480, frameRate: 15 }, audio: false },
        { video: { width: 320, height: 240 }, audio: false },
        { video: true, audio: false },
      ];
      let stream = null;
      for (let i = 0; i < constraints.length; i++) {
        try { stream = await navigator.mediaDevices.getUserMedia(constraints[i]); break; } catch (err) { if (i === constraints.length - 1) throw err; }
      }
      if (!stream) throw new Error("Failed to get camera stream");
      if (isOnBreakRef.current) { console.log("[CAMERA] Break started during camera init - stopping stream"); stream.getTracks().forEach((track) => track.stop()); return false; }
      streamRef.current = stream;
      if (videoRef.current && mountedRef.current && !isSessionTerminatedRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve, reject) => {
          const video = videoRef.current;
          if (!video) { reject(new Error("Video ref lost")); return; }
          const timeout = setTimeout(() => reject(new Error("Video setup timeout")), 10000);
          const handleLoad = () => { clearTimeout(timeout); video.removeEventListener("loadedmetadata", handleLoad); video.removeEventListener("error", handleError); resolve(); };
          const handleError = (err) => { clearTimeout(timeout); video.removeEventListener("loadedmetadata", handleLoad); video.removeEventListener("error", handleError); reject(err); };
          video.addEventListener("loadedmetadata", handleLoad);
          video.addEventListener("error", handleError);
          video.play().catch(reject);
        });
      }
      if (isOnBreakRef.current) {
        console.log("[CAMERA] Break started during video setup - cleaning up");
        if (streamRef.current) { streamRef.current.getTracks().forEach((track) => track.stop()); streamRef.current = null; }
        if (videoRef.current) videoRef.current.srcObject = null;
        setVideoReady(false);
        return false;
      }
      if (mountedRef.current && !isSessionTerminatedRef.current) {
        setVideoReady(true);
        setCameraInitStatus("ready");
        setCameraEnabled(true);
        cameraEnabledRef.current = true;
      }
      return true;
    } catch (error) {
      console.error("[CAMERA] Init failed:", error);
      setCameraError(error.message);
      setCameraInitError(error.message);
      setVideoReady(false);
      setCameraInitStatus("failed");
      return false;
    }
  }, []);

  // ==================== VERIFY CAMERA HARDWARE IS READY ====================
  const verifyCameraReady = useCallback(async (maxRetries = 5, retryDelay = 500) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (!mountedRef.current || isSessionTerminatedRef.current) return false;
      if (isOnBreakRef.current) { console.log("[VERIFY CAMERA] Aborted - participant went on break"); return false; }
      if (!videoRef.current || !streamRef.current) { if (attempt < maxRetries) { await new Promise((r) => setTimeout(r, retryDelay)); continue; } return false; }
      const videoTracks = streamRef.current.getVideoTracks();
      if (videoTracks.length === 0) { if (attempt < maxRetries) { await new Promise((r) => setTimeout(r, retryDelay)); continue; } return false; }
      const track = videoTracks[0];
      if (!track.enabled) { track.enabled = true; await new Promise((r) => setTimeout(r, 500)); continue; }
      if (track.readyState !== "live") { if (attempt < maxRetries) { await new Promise((r) => setTimeout(r, retryDelay)); continue; } return false; }
      if (videoRef.current.paused || videoRef.current.ended) {
        try { await videoRef.current.play(); await new Promise((r) => setTimeout(r, 500)); } catch (playError) { if (attempt < maxRetries) { await new Promise((r) => setTimeout(r, retryDelay)); continue; } }
      }
      if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) { if (attempt < maxRetries) { await new Promise((r) => setTimeout(r, retryDelay)); continue; } return false; }
      return true;
    }
    return false;
  }, []);

  // ==================== VERIFY WITH BACKEND ====================
  const verifyWithBackend = useCallback(async (confirmationToken) => {
    if (!confirmationToken) { console.log("[VERIFY CAMERA] No confirmation token, skipping"); return true; }
    if (!isSessionActiveRef.current || isSessionTerminatedRef.current) { console.log("[VERIFY CAMERA] Session not active, skipping"); return true; }
    try {
      setCameraInitStatus("verifying");
      console.log("[VERIFY CAMERA] Sending verification request...");
      const response = await apiCall("/verify-camera/", "POST", { meeting_id: meetingId, user_id: userId, confirmation_token: confirmationToken, camera_active: true });
      if (response.success) { console.log("[VERIFY CAMERA] Verification successful"); return true; }
      const errorMsg = response.error || "";
      if (errorMsg.includes("No camera verification expected") || errorMsg.includes("no session") || errorMsg.includes("session not found")) {
        console.log("[VERIFY CAMERA] Backend doesn't expect verification - OK"); return true;
      }
      console.warn("[VERIFY CAMERA] Verification failed:", response.error);
      return false;
    } catch (error) {
      const errorMsg = error.message || "";
      if (errorMsg.includes("400") || errorMsg.includes("No camera verification expected") || errorMsg.includes("session not found") || errorMsg.includes("no active session")) {
        console.log("[VERIFY CAMERA] No active session expecting verification - OK"); return true;
      }
      console.error("[VERIFY CAMERA] Error:", error.message);
      return true;
    }
  }, [meetingId, userId, apiCall]);

  // ==================== HANDLE ANALYSIS RESPONSE ====================
  const handleAnalysisResponse = useCallback((response) => {
    if (!response || !mountedRef.current) return;
    if (isSessionTerminatedRef.current) return;
    if (isOnBreakRef.current) { console.log("[ANALYSIS] Ignoring analysis response - participant is on break"); return; }

    // 1. IDENTITY VERIFICATION
    if (response.identity_warning_count !== undefined) {
      setAuthWarningCount(response.identity_warning_count);
      if (response.identity_warning_count > 0) setFaceAuthStatus("unauthorized");
      else if (response.identity_verified) setFaceAuthStatus("verified");
    }
    if (response.identity_popup && response.identity_popup.trim() !== "") triggerToast(response.identity_popup, "error");
    if (response.identity_is_removed === true || (response.status === "removed_from_meeting" && response.removal_type === "identity_verification")) {
      setIsAuthBlocked(true); isAuthBlockedRef.current = true;
      handleSessionTermination("identity_verification_failure", response.message || "Session terminated: Identity verification failed 3 times.");
      return;
    }

    // 2. BEHAVIORAL ANALYSIS
    if (response.popup && response.popup.trim() !== "") {
      let popupType = "warning";
      if (response.popup.includes("Detection")) popupType = "error";
      else if (response.popup.includes("Warning")) popupType = "warning";
      else if (response.popup.includes("Inactivity")) popupType = "info";
      triggerToast(response.popup, popupType);
    }
    if (response.status === "participant_removed" || response.removal_type === "continuous_violations") {
      handleSessionTermination("continuous_violations", response.message || "Session terminated: Continuous violations for 2 minutes.");
      return;
    }
    if (response.grace_period_active) {
      const gracePeriodTimeRemaining = (response.grace_period_expires_in || 0) * 1000;
      setGracePeriodActive(true); gracePeriodRef.current.active = true; gracePeriodRef.current.until = Date.now() + gracePeriodTimeRemaining;
      if (response.message) triggerToast(response.message, "info");
      return;
    } else if (gracePeriodRef.current.active && Date.now() >= gracePeriodRef.current.until) {
      setGracePeriodActive(false); gracePeriodRef.current.active = false; gracePeriodRef.current.until = 0;
    }
    if (response.attendance_percentage !== undefined) {
      setAttendanceData((prev) => ({ ...prev, attendancePercentage: response.attendance_percentage, engagementScore: response.engagement_score || response.attendance_percentage, popupCount: response.popup_count || 0 }));
    }
    if (response.violations && Array.isArray(response.violations)) setCurrentViolations(response.violations);
    if (response.warning_count !== undefined) setWarningCount(response.warning_count);
    if (response.warning_phase_complete !== undefined) setWarningsExhausted(response.warning_phase_complete);
    if (onStatusChange) {
      onStatusChange({ status: response.status, attendancePercentage: response.attendance_percentage, violations: response.violations || [], warningCount: response.warning_count || 0, detectionCount: response.detection_counts || 0 });
    }
  }, [handleSessionTermination, triggerToast, onStatusChange]);

  // ==================== FRAME CAPTURE AND ANALYSIS ====================
  // ✅ UPDATED: Added throttle response handling for backend frame throttle
  const captureAndAnalyze = useCallback(async () => {
    if (!mountedRef.current || isSessionTerminatedRef.current || !cameraEnabledRef.current) return;
    if (isOnBreakRef.current) { console.log("[CAPTURE] Skipping - participant is on break"); return; }
    if (!isSessionActiveRef.current || !videoReady || !isTrackingRef.current) return;
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0 || video.paused || video.ended) return;
    if (!streamRef.current || streamRef.current.getTracks().length === 0) return;
    const videoTracks = streamRef.current.getVideoTracks();
    if (videoTracks.length === 0 || !videoTracks[0].enabled) return;
    if (processingFrame) return;
    try {
      setProcessingFrame(true);
      if (isOnBreakRef.current) { console.log("[CAPTURE] Break started during frame prep - aborting"); return; }
      const context = canvas.getContext("2d");
      const maxWidth = 640; const maxHeight = 480;
      let { videoWidth: width, videoHeight: height } = video;
      if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
      if (height > maxHeight) { width = (width * maxHeight) / height; height = maxHeight; }
      canvas.width = width; canvas.height = height;
      context.drawImage(video, 0, 0, width, height);
      const frameData = canvas.toDataURL("image/jpeg", 0.8);
      const analysisState = {
        meeting_id: meetingId, user_id: userId, frame: frameData, user_role: effectiveRole,
        current_tracking_mode: currentTrackingModeRef.current, is_host: isHost, is_cohost: isCoHost,
        is_on_break: isOnBreakRef.current, should_detect_violations: shouldDetectViolations,
        role_history: roleHistoryRef.current, session_start_time: sessionStartTime,
      };
      const response = await apiCall("/detect/", "POST", analysisState);
      if (mountedRef.current && !isSessionTerminatedRef.current) {
        // ✅ NEW: Handle backend frame throttle response
        if (response.status === "throttled") {
          console.log(`[CAPTURE] Frame throttled by backend - retry after ${response.retry_after}s`);
          // Still update attendance percentage if provided
          if (response.attendance_percentage !== undefined) {
            setAttendanceData((prev) => ({
              ...prev,
              attendancePercentage: response.attendance_percentage,
            }));
          }
        } else {
          handleAnalysisResponse(response);
        }
      }
    } catch (error) {
      console.error("[CAPTURE] Frame analysis error:", error);
      if (error.message.includes("session_closed") || error.message.includes("session_terminated")) {
        if (currentTrackingModeRef.current === "participant") handleSessionTermination("session_violations_error", "Session ended");
        return;
      }
    } finally { if (mountedRef.current) setProcessingFrame(false); }
  }, [videoReady, meetingId, userId, processingFrame, effectiveRole, isHost, isCoHost, shouldDetectViolations, sessionStartTime, apiCall, handleAnalysisResponse, handleSessionTermination]);

  useEffect(() => { captureAndAnalyzeRef.current = captureAndAnalyze; }, [captureAndAnalyze]);

  // ==================== END BREAK HANDLER ====================
  const handleEndBreak = useCallback(async (isAutoExpire = false) => {
    if (currentTrackingModeRef.current !== "participant") return;
    if (breakProcessingRef.current) { console.log("[END BREAK] Already processing, skipping..."); return; }
    if (!isAutoExpire && autoResumeInProgressRef.current) { console.log("[END BREAK] Auto-resume already in progress, skipping..."); return; }
    const cameraWasEnabled = cameraWasEnabledBeforeBreakRef.current;
    breakProcessingRef.current = true;
    if (!isAutoExpire) autoResumeInProgressRef.current = true;
    setIsProcessingBreak(true);
    console.log("[END BREAK] Starting end break process...", { isAutoExpire, cameraWasEnabled });
    let backendResponse = null;
    try {
      if (breakTimerRef.current) { clearInterval(breakTimerRef.current); breakTimerRef.current = null; console.log("[END BREAK] Break timer cleared"); }

      // Check backend status FIRST
      let skipResumeApi = false;
      try {
        const statusResponse = await apiCall(`/status/?meeting_id=${meetingId}&user_id=${userId}`, "GET");
        console.log("[END BREAK] Backend status:", { is_on_break: statusResponse.is_on_break, break_time_remaining: statusResponse.break_time_remaining });
        if (!statusResponse.is_on_break) {
          console.log("[END BREAK] Backend says not on break - syncing state only");
          skipResumeApi = true;
          setIsOnBreak(false); isOnBreakRef.current = false; setBreakTimeLeft(0); setBreakStartedAt(null);
          setTotalBreakTimeUsed(statusResponse.total_break_time_used || 0);
          setBreakTimeRemaining(statusResponse.break_time_remaining || 0);
          backendResponse = { success: true, is_on_break: false, camera_verification_required: false };
        }
      } catch (statusError) { console.warn("[END BREAK] Status check failed:", statusError.message); }

      // Call resume API only if needed
      if (!skipResumeApi) {
        try {
          backendResponse = await apiCall("/pause-resume/", "POST", { meeting_id: meetingId, user_id: userId, action: "resume" });
          console.log("[END BREAK] Resume API response:", backendResponse);
          if (backendResponse.success !== false) {
            setIsOnBreak(false); isOnBreakRef.current = false; setBreakStartedAt(null); setCurrentViolations([]);
            setTotalBreakTimeUsed(backendResponse.total_break_time_used || 0);
            setBreakTimeRemaining(backendResponse.break_time_remaining || 0);
            setBreakCount(backendResponse.break_count || 0); setBreakTimeLeft(0);
            if (backendResponse.camera_confirmation_token) cameraVerificationTokenRef.current = backendResponse.camera_confirmation_token;
          }
        } catch (resumeError) {
          const errorMessage = resumeError.message || "";
          const errorData = resumeError.data || {};
          console.log("[END BREAK] Resume error:", errorMessage);
          if (errorMessage.includes("400") || errorMessage.includes("Not currently on break") || errorMessage.includes("not on break") || errorMessage.includes("Not on break") || errorData.error?.includes("Not currently on break")) {
            console.log("[END BREAK] Backend says not on break - syncing state");
            setIsOnBreak(false); isOnBreakRef.current = false; setBreakTimeLeft(0); setBreakStartedAt(null);
            if (errorData.break_time_remaining !== undefined) setBreakTimeRemaining(errorData.break_time_remaining);
            if (errorData.total_break_time_used !== undefined) setTotalBreakTimeUsed(errorData.total_break_time_used);
            backendResponse = { success: true, is_on_break: false, camera_verification_required: false };
            if (!isAutoExpire) showViolationPopup("Break already ended - resuming tracking", "info");
          } else { console.error("[END BREAK] Resume API error:", resumeError); showViolationPopup(`Failed to end break: ${errorMessage}`, "error"); return; }
        }
      }
      if (isSessionTerminatedRef.current) return;
      if (isOnBreakRef.current) { console.log("[END BREAK] Break ref still true after resume - forcing false"); setIsOnBreak(false); isOnBreakRef.current = false; }

      // Re-enable camera if it was enabled before
      if (cameraWasEnabled) {
        console.log("[END BREAK] Re-enabling camera...");
        if (!onCameraToggle) { showViolationPopup("Cannot control camera - please enable manually", "warning"); }
        else {
          if (isAutoExpire) { setCameraEnabled(true); cameraEnabledRef.current = true; await new Promise((r) => setTimeout(r, 250)); }
          showViolationPopup("Enabling camera...", "info");
          setCameraInitStatus("initializing"); setCameraEnabled(true); cameraEnabledRef.current = true;
          await new Promise((r) => setTimeout(r, 150));
          try { onCameraToggle(true); console.log("[END BREAK] Camera toggle called"); } catch (toggleError) { console.error("[END BREAK] Camera toggle error:", toggleError); showViolationPopup("Failed to enable camera - please enable manually", "warning"); }
          const waitTime = isAutoExpire ? 4000 : 2000;
          await new Promise((r) => setTimeout(r, waitTime));
          const cameraReady = await verifyCameraReady(isAutoExpire ? 20 : 5, isAutoExpire ? 1500 : 500);
          if (cameraReady) { setCameraInitStatus("ready"); console.log("[END BREAK] Camera ready"); }
          else { setCameraInitStatus("failed"); showViolationPopup("Camera may not be ready - check manually", "warning"); }
          if (backendResponse?.camera_verification_required && cameraVerificationTokenRef.current && !isAutoExpire) {
            try { await verifyWithBackend(cameraVerificationTokenRef.current); } catch (e) { console.warn("[END BREAK] Camera verification failed (non-blocking)"); }
          }
        }
      }

      // Resume tracking
      if (mountedRef.current && isSessionActiveRef.current && !isSessionTerminatedRef.current) {
        console.log("[END BREAK] Resuming tracking...");
        setIsTracking(true); isTrackingRef.current = true;
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        intervalRef.current = setInterval(() => {
          if (mountedRef.current && !isSessionTerminatedRef.current && !isOnBreakRef.current && captureAndAnalyzeRef.current) captureAndAnalyzeRef.current();
        }, AttendanceConfig.DETECTION_INTERVAL);
        setTimeout(() => { if (mountedRef.current && !isSessionTerminatedRef.current && !isOnBreakRef.current && captureAndAnalyzeRef.current) captureAndAnalyzeRef.current(); }, 1000);
      }
      const endType = isAutoExpire ? "Auto-completed" : "Manually ended";
      showViolationPopup(`Break ${endType} - Tracking resumed!`, "success");
      console.log("[END BREAK] Complete!");
    } catch (error) {
      console.error("[END BREAK] Unexpected error:", error);
      showViolationPopup(`Error: ${error.message}`, "error");
      setIsOnBreak(false); isOnBreakRef.current = false; setBreakTimeLeft(0);
    } finally { breakProcessingRef.current = false; autoResumeInProgressRef.current = false; setIsProcessingBreak(false); }
  }, [meetingId, userId, onCameraToggle, showViolationPopup, apiCall, verifyCameraReady, verifyWithBackend]);

  useEffect(() => { handleEndBreakRef.current = handleEndBreak; }, [handleEndBreak]);

  // ==================== BREAK TIMER ====================
  const startBreakTimer = useCallback((duration) => {
    if (breakTimerRef.current) { clearInterval(breakTimerRef.current); breakTimerRef.current = null; }
    setBreakStartedAt(Date.now());
    setBreakTimeLeft(duration);
    console.log(`[BREAK TIMER] Starting timer for ${duration} seconds`);
    breakTimerRef.current = setInterval(() => {
      setBreakTimeLeft((prevTime) => {
        const newTime = prevTime - 1;
        if (newTime > 0 && newTime % 30 === 0) console.log(`[BREAK TIMER] ${newTime} seconds remaining`);
        if (newTime === 60) showViolationPopup("1 minute remaining on your break", "warning");
        if (newTime === 30) showViolationPopup("30 seconds remaining on your break", "warning");
        if (newTime === 10) showViolationPopup("10 seconds remaining! Break will end soon.", "warning");
        if (newTime >= 1 && newTime <= 5) showViolationPopup(`${newTime}...`, "warning");
        if (newTime <= 0) {
          console.log("[BREAK TIMER] Timer expired! Auto-ending break...");
          if (breakTimerRef.current) { clearInterval(breakTimerRef.current); breakTimerRef.current = null; }
          if (mountedRef.current && !isSessionTerminatedRef.current && !breakProcessingRef.current && !autoResumeInProgressRef.current) {
            autoResumeInProgressRef.current = true;
            showViolationPopup("Break time expired! Resuming tracking...", "info");
            setTimeout(() => { if (handleEndBreakRef.current) handleEndBreakRef.current(true).finally(() => { autoResumeInProgressRef.current = false; }); }, 100);
          }
          return 0;
        }
        return newTime;
      });
    }, 1000);
  }, [showViolationPopup]);

  // ==================== BACKEND SYNC ====================
  const syncWithBackend = useCallback(async () => {
    if (!meetingId || !userId || isSessionTerminatedRef.current) return;
    try {
      const response = await apiCall(`/status/?meeting_id=${meetingId}&user_id=${userId}`, "GET");
      const backendOnBreak = response.is_on_break || false;
      const backendBreakTimeRemaining = response.break_time_remaining || 0;
      const backendTotalUsed = response.total_break_time_used || 0;
      const backendBreakCount = response.break_count || 0;
      if (backendBreakCount !== breakCount) setBreakCount(backendBreakCount);
      if (Math.abs(breakTimeRemaining - backendBreakTimeRemaining) > 5) setBreakTimeRemaining(backendBreakTimeRemaining);
      if (Math.abs(totalBreakTimeUsed - backendTotalUsed) > 2) setTotalBreakTimeUsed(backendTotalUsed);

      if (isOnBreakRef.current !== backendOnBreak) {
        if (breakProcessingRef.current || autoResumeInProgressRef.current) { console.log("[SYNC] Break processing in progress - skipping"); return; }
        if (!backendOnBreak && isOnBreakRef.current) {
          console.log("[SYNC] Backend says break ended - syncing state");
          const currentBreakTimeLeft = breakTimeLeftRef.current;
          if (currentBreakTimeLeft > 5) { console.log(`[SYNC] Break timer still has ${currentBreakTimeLeft}s - ignoring desync`); return; }
          setIsOnBreak(false); isOnBreakRef.current = false;
          if (breakTimerRef.current) { clearInterval(breakTimerRef.current); breakTimerRef.current = null; }
          setBreakTimeLeft(0); setBreakStartedAt(null);
          breakProcessingRef.current = false; autoResumeInProgressRef.current = false; setIsProcessingBreak(false);
          if (cameraWasEnabledBeforeBreakRef.current && onCameraToggle) { console.log("[SYNC] Re-enabling camera after confirmed break end"); onCameraToggle(true); setCameraEnabled(true); cameraEnabledRef.current = true; }
        } else if (backendOnBreak && !isOnBreakRef.current) {
          console.log("[SYNC] Backend says on break - forcing break state");
          setIsOnBreak(true); isOnBreakRef.current = true;
          forceDisableCameraDuringBreak();
          if (!breakTimerRef.current && !breakProcessingRef.current) {
            const remainingTime = Math.max(0, backendBreakTimeRemaining);
            if (remainingTime > 0) { setBreakTimeLeft(remainingTime); startBreakTimer(remainingTime); }
          }
        }
      }
      if (isOnBreakRef.current && (cameraEnabledRef.current || isTrackingRef.current)) {
        console.log("[SYNC] Break active but camera/tracking still on - forcing disable");
        forceDisableCameraDuringBreak();
      }
    } catch (error) { console.warn("[SYNC] Backend sync failed:", error.message); }
  }, [meetingId, userId, breakTimeRemaining, totalBreakTimeUsed, breakCount, onCameraToggle, startBreakTimer, apiCall, forceDisableCameraDuringBreak]);

  // ==================== TAKE BREAK ====================
  const handleTakeBreak = useCallback(async () => {
    if (currentTrackingModeRef.current !== "participant") { showViolationPopup("Break only available for participants", "warning"); return; }
    if (breakProcessingRef.current || isSessionTerminatedRef.current || isOnBreakRef.current || !canTakeBreak) { console.log("[START BREAK] Cannot start break - invalid state"); return; }
    breakProcessingRef.current = true; setIsProcessingBreak(true);
    console.log("[START BREAK] Starting break process...");
    console.log("[START BREAK] Break time remaining:", breakTimeRemaining);
    try {
      cameraWasEnabledBeforeBreakRef.current = cameraEnabledRef.current;
      console.log("[START BREAK] Camera was enabled before break:", cameraWasEnabledBeforeBreakRef.current);
      if (cameraEnabledRef.current && onCameraToggle) {
        try { console.log("[START BREAK] Immediately disabling camera before API call"); onCameraToggle(false); setCameraEnabled(false); cameraEnabledRef.current = false; } catch (cameraError) { console.error("[START BREAK] Failed to disable camera:", cameraError); }
      }
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      setIsTracking(false); isTrackingRef.current = false;
      setIsOnBreak(true); isOnBreakRef.current = true;
      setShowCameraEnablePrompt(false); setCameraPromptDismissed(false);
      if (cameraPromptTimerRef.current) { clearTimeout(cameraPromptTimerRef.current); cameraPromptTimerRef.current = null; }

      const response = await apiCall("/pause-resume/", "POST", { meeting_id: meetingId, user_id: userId, action: "pause" });
      console.log("[START BREAK] Backend response:", response);
      if (response.success) {
        setCurrentViolations([]);
        setTotalBreakTimeUsed(response.total_break_time_used || 0);
        setBreakTimeRemaining(response.break_time_remaining || 0);
        setBreakCount(response.break_count || 0);
        const breakDuration = response.break_duration || response.break_time_remaining || 300;
        setBreakTimeLeft(breakDuration);
        startBreakTimer(breakDuration);
        const displayMinutes = Math.floor(breakDuration / 60);
        const displaySeconds = breakDuration % 60;
        console.log(`[START BREAK] Break started. Duration: ${breakDuration}s`);
        showViolationPopup(`Break #${response.break_count} started - camera disabled. ${displayMinutes}:${displaySeconds.toString().padStart(2, "0")} available.`, "success");
      } else {
        if (response.error === "Already on break") {
          console.log("[START BREAK] Already on break according to backend");
          startBreakTimer(response.break_time_remaining || breakTimeRemaining);
          showViolationPopup("Break is already active", "info");
        } else if (response.break_time_exhausted || (response.error && response.error.includes("exceeded"))) {
          setIsOnBreak(false); isOnBreakRef.current = false; setBreakTimeRemaining(0);
          showViolationPopup("No break time remaining", "error");
          if (cameraWasEnabledBeforeBreakRef.current && onCameraToggle) { onCameraToggle(true); setCameraEnabled(true); cameraEnabledRef.current = true; }
        } else {
          setIsOnBreak(false); isOnBreakRef.current = false;
          if (cameraWasEnabledBeforeBreakRef.current && onCameraToggle) { onCameraToggle(true); setCameraEnabled(true); cameraEnabledRef.current = true; }
          throw new Error(response.error || "Failed to start break");
        }
      }
    } catch (error) {
      console.error("[START BREAK] Error:", error);
      showViolationPopup(`Break failed: ${error.message}`, "error");
      setIsOnBreak(false); isOnBreakRef.current = false;
      if (cameraWasEnabledBeforeBreakRef.current && onCameraToggle) { onCameraToggle(true); setCameraEnabled(true); cameraEnabledRef.current = true; }
    } finally { breakProcessingRef.current = false; setIsProcessingBreak(false); }
  }, [canTakeBreak, onCameraToggle, meetingId, userId, breakTimeRemaining, showViolationPopup, apiCall, startBreakTimer]);

  // ==================== RETRY CAMERA ====================
  const handleRetryCamera = useCallback(async () => {
    if (!onCameraToggle) { showViolationPopup("Camera control not available", "error"); return; }
    if (!safeCameraEnable("handleRetryCamera")) { showViolationPopup("Cannot enable camera during break", "warning"); return; }
    setCameraInitStatus("initializing"); showViolationPopup("Retrying camera initialization...", "info");
    try {
      onCameraToggle(true); setCameraEnabled(true); cameraEnabledRef.current = true;
      await new Promise((r) => setTimeout(r, 2000));
      if (isOnBreakRef.current) { console.log("[RETRY CAMERA] Break started during retry - aborting"); forceDisableCameraDuringBreak(); return; }
      const cameraReady = await verifyCameraReady(5, 500);
      if (!cameraReady) throw new Error("Camera verification failed after retry");
      setCameraInitStatus("ready"); showViolationPopup("Camera enabled successfully", "success");
      if (!isTrackingRef.current && isSessionActiveRef.current && !isSessionTerminatedRef.current && !isOnBreakRef.current) {
        setIsTracking(true); isTrackingRef.current = true;
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => { if (mountedRef.current && !isSessionTerminatedRef.current && !isOnBreakRef.current && captureAndAnalyzeRef.current) captureAndAnalyzeRef.current(); }, AttendanceConfig.DETECTION_INTERVAL);
        setTimeout(() => { if (mountedRef.current && !isSessionTerminatedRef.current && !isOnBreakRef.current && captureAndAnalyzeRef.current) captureAndAnalyzeRef.current(); }, 1000);
      }
    } catch (error) { setCameraInitStatus("failed"); setCameraInitError(error.message); showViolationPopup(`Camera retry failed: ${error.message}`, "error"); }
  }, [onCameraToggle, showViolationPopup, verifyCameraReady, safeCameraEnable, forceDisableCameraDuringBreak]);

  // ==================== HANDLE ENABLE CAMERA FROM PROMPT ====================
  const handleEnableCameraFromPrompt = useCallback(async () => {
    if (!onCameraToggle) { triggerToast("Camera control not available", "error"); setShowCameraEnablePrompt(false); return; }
    if (!safeCameraEnable("handleEnableCameraFromPrompt")) { triggerToast("Cannot enable camera during break", "warning"); setShowCameraEnablePrompt(false); return; }
    try {
      setShowCameraEnablePrompt(false); setCameraPromptDismissed(false);
      triggerToast("Enabling camera...", "info");
      onCameraToggle(true); setCameraEnabled(true); cameraEnabledRef.current = true;
      await new Promise((r) => setTimeout(r, 2000));
      if (isOnBreakRef.current) { console.log("[CAMERA PROMPT] Break started during enable - aborting"); forceDisableCameraDuringBreak(); return; }
      const cameraReady = await verifyCameraReady(5, 500);
      if (!cameraReady) throw new Error("Camera verification failed");
      setCameraInitStatus("ready"); triggerToast("Camera enabled - tracking resumed", "success");
      if (!isTrackingRef.current && isSessionActiveRef.current && !isSessionTerminatedRef.current && !isOnBreakRef.current) {
        setIsTracking(true); isTrackingRef.current = true;
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => { if (mountedRef.current && !isSessionTerminatedRef.current && !isOnBreakRef.current && captureAndAnalyzeRef.current) captureAndAnalyzeRef.current(); }, AttendanceConfig.DETECTION_INTERVAL);
        setTimeout(() => { if (mountedRef.current && !isSessionTerminatedRef.current && !isOnBreakRef.current && captureAndAnalyzeRef.current) captureAndAnalyzeRef.current(); }, 1000);
      }
    } catch (error) { setCameraInitStatus("failed"); setCameraInitError(error.message); triggerToast(`Failed to enable camera: ${error.message}`, "error"); }
  }, [onCameraToggle, triggerToast, verifyCameraReady, safeCameraEnable, forceDisableCameraDuringBreak]);

  // ==================== ROLE TRANSITION ====================
  const handleRoleTransition = useCallback((newMode) => {
    if (newMode === currentTrackingMode) return;
    setRoleTransitionInProgress(true);
    const roleChange = { fromRole: currentTrackingMode, toRole: newMode, timestamp: Date.now(), attendanceAtTransition: attendanceData.attendancePercentage };
    roleHistoryRef.current.push(roleChange);
    setAttendanceData((prev) => ({ ...prev, roleHistory: [...roleHistoryRef.current] }));
    if (newMode !== "participant") { setCurrentViolations([]); setWarningsExhausted(false); }
    setCurrentTrackingMode(newMode); currentTrackingModeRef.current = newMode; setRoleTransitionInProgress(false);
  }, [currentTrackingMode, attendanceData.attendancePercentage]);

  // ==================== START TRACKING ====================
  const startTracking = useCallback(async () => {
    if (!meetingId || !userId || !mountedRef.current) { console.warn("[START TRACKING] Missing meetingId or userId"); return false; }
    if (isSessionTerminatedRef.current) { console.warn("[START TRACKING] Session already terminated"); return false; }
    if (startTrackingInProgressRef.current) { console.warn("[START TRACKING] Already in progress, skipping"); return false; }
    if (isTrackingRef.current && isSessionActiveRef.current) { console.warn("[START TRACKING] Already tracking, skipping"); return true; }
    startTrackingInProgressRef.current = true;
    console.log(`[START TRACKING] Starting for meeting: ${meetingId}, user: ${userId}`);
    try {
      if (!videoReady && !isOnBreakRef.current) {
        console.log("[START TRACKING] Initializing camera...");
        if (isOnBreakRef.current) { console.log("[START TRACKING] Break detected before camera init - skipping"); }
        else {
          const cameraReady = await initializeCamera();
          if (!cameraReady || !mountedRef.current || isSessionTerminatedRef.current) { if (!isOnBreakRef.current) showViolationPopup("Camera initialization failed", "error"); return false; }
          console.log("[START TRACKING] Camera initialized successfully");
        }
      } else if (isOnBreakRef.current) { console.log("[START TRACKING] On break - skipping camera initialization"); }
      const requestData = { meeting_id: meetingId, user_id: userId, user_name: userName, user_role: effectiveRole, current_tracking_mode: currentTrackingModeRef.current, is_host: isHost, is_cohost: isCoHost, should_detect_violations: shouldDetectViolations };
      console.log("[START TRACKING] Sending POST request to /start/");
      const response = await apiCall("/start/", "POST", requestData);
      console.log("[START TRACKING] Response received:", response);
      if (!mountedRef.current || isSessionTerminatedRef.current) return false;
      setSessionActive(true); isSessionActiveRef.current = true;
      if (!isOnBreakRef.current) {
        setIsTracking(true); isTrackingRef.current = true;
        if (currentTrackingModeRef.current === "participant") { setWarningCount(0); setWarningsExhausted(false); setFaceAuthStatus("verified"); setIsAuthBlocked(false); isAuthBlockedRef.current = false; }
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        intervalRef.current = setInterval(() => { if (mountedRef.current && !isSessionTerminatedRef.current && !isOnBreakRef.current && captureAndAnalyzeRef.current) captureAndAnalyzeRef.current(); }, AttendanceConfig.DETECTION_INTERVAL);
        setTimeout(() => { if (mountedRef.current && !isOnBreakRef.current && !isSessionTerminatedRef.current && captureAndAnalyzeRef.current) captureAndAnalyzeRef.current(); }, 500);
      } else { console.log("[START TRACKING] On break - not starting detection interval"); }
      if (showSuccessPopup && !isOnBreakRef.current) {
        const message = currentTrackingModeRef.current === "participant" ? "AI attendance monitoring started" : `Presence tracking started for ${currentTrackingModeRef.current}`;
        showViolationPopup(message, "success");
      }
      return true;
    } catch (error) {
      console.error("[START TRACKING] Failed:", error);
      let errorMessage = error.message;
      if (error.message.includes("405")) errorMessage = "Server configuration error (HTTP 405). Check nginx config.";
      else if (error.message.includes("404")) errorMessage = "API endpoint not found (HTTP 404).";
      else if (error.message.includes("500")) errorMessage = "Server error (HTTP 500). Please try again later.";
      else if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) errorMessage = "Network error. Please check your connection.";
      showViolationPopup(`Failed to start: ${errorMessage}`, "error");
      return false;
    } finally { startTrackingInProgressRef.current = false; }
  }, [meetingId, userId, userName, videoReady, initializeCamera, showViolationPopup, showSuccessPopup, effectiveRole, isHost, isCoHost, shouldDetectViolations, apiCall]);

  // ==================== STOP TRACKING ====================
  const stopTracking = useCallback(async () => {
    try {
      setIsTracking(false); isTrackingRef.current = false;
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      if (breakTimerRef.current) { clearInterval(breakTimerRef.current); breakTimerRef.current = null; }
      if (cameraPromptTimerRef.current) { clearTimeout(cameraPromptTimerRef.current); cameraPromptTimerRef.current = null; }
      if (syncIntervalRef.current) { clearInterval(syncIntervalRef.current); syncIntervalRef.current = null; }
      if (meetingId && userId && !isSessionTerminatedRef.current) await apiCall("/stop/", "POST", { meeting_id: meetingId, user_id: userId, reason: "manual_stop" });
      if (streamRef.current) { streamRef.current.getTracks().forEach((track) => track.stop()); setVideoReady(false); }
    } catch (error) { console.error("[STOP TRACKING] Failed:", error); }
  }, [meetingId, userId, apiCall]);

  // ==================== ALL EFFECTS ====================
  useEffect(() => { const newMode = determineTrackingMode(); if (newMode !== currentTrackingMode) handleRoleTransition(newMode); }, [determineTrackingMode, currentTrackingMode, handleRoleTransition]);

  useEffect(() => {
    if (cameraPromptTimerRef.current) { clearTimeout(cameraPromptTimerRef.current); cameraPromptTimerRef.current = null; }
    if (isOnBreak || isSessionTerminated || isSessionPermanentlyEnded || currentTrackingMode !== "participant" || !sessionActive || propCameraEnabled) { setShowCameraEnablePrompt(false); setCameraPromptDismissed(false); return; }
    if (!propCameraEnabled && currentTrackingMode === "participant" && sessionActive && !isSessionTerminated && !isSessionPermanentlyEnded && !isOnBreak && !cameraPromptDismissed) {
      cameraPromptTimerRef.current = setTimeout(() => { if (mountedRef.current && !propCameraEnabled && !isOnBreakRef.current && !isSessionTerminatedRef.current && !cameraPromptDismissed) setShowCameraEnablePrompt(true); }, AttendanceConfig.CAMERA_PROMPT_DELAY);
    }
    return () => { if (cameraPromptTimerRef.current) { clearTimeout(cameraPromptTimerRef.current); cameraPromptTimerRef.current = null; } };
  }, [propCameraEnabled, isOnBreak, isSessionTerminated, isSessionPermanentlyEnded, currentTrackingMode, sessionActive, cameraPromptDismissed]);

  // Camera state sync effect - CRITICAL FIX for production
  useEffect(() => {
    const prevEnabled = cameraEnabledRef.current;
    if (isOnBreakRef.current) {
      if (propCameraEnabled) {
        console.log("[CAMERA SYNC] BLOCKED: Parent pushed propCameraEnabled=true during break - IGNORING");
        setCameraEnabled(false); cameraEnabledRef.current = false;
        if (onCameraToggle) { try { onCameraToggle(false); } catch (e) { console.warn("[CAMERA SYNC] Failed to push back camera disable:", e); } }
        if (isTrackingRef.current) { setIsTracking(false); isTrackingRef.current = false; if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } }
        return;
      } else { setCameraEnabled(false); cameraEnabledRef.current = false; return; }
    }
    if (breakProcessingRef.current && propCameraEnabled) { console.log("[CAMERA SYNC] BLOCKED: Break processing in progress"); return; }
    setCameraEnabled(propCameraEnabled); cameraEnabledRef.current = propCameraEnabled;
    if (prevEnabled !== propCameraEnabled) {
      if (!propCameraEnabled) {
        setCurrentViolations([]);
        if (isTrackingRef.current && !isOnBreakRef.current && currentTrackingModeRef.current === "participant") {
          setIsTracking(false); isTrackingRef.current = false;
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
          showViolationPopup("Tracking paused - camera disabled", "warning");
        }
      } else {
        setShowCameraEnablePrompt(false); setCameraPromptDismissed(false);
        if (!isTrackingRef.current && !isOnBreakRef.current && isSessionActiveRef.current && !isSessionTerminatedRef.current) {
          const message = currentTrackingModeRef.current === "participant" ? "Camera enabled - resuming detection" : "Camera enabled - presence tracking active";
          showViolationPopup(message, "info");
          setIsTracking(true); isTrackingRef.current = true;
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
          intervalRef.current = setInterval(() => { if (mountedRef.current && !isSessionTerminatedRef.current && !isOnBreakRef.current && captureAndAnalyzeRef.current) captureAndAnalyzeRef.current(); }, AttendanceConfig.DETECTION_INTERVAL);
          setTimeout(() => { if (mountedRef.current && !isSessionTerminatedRef.current && !isOnBreakRef.current && captureAndAnalyzeRef.current) captureAndAnalyzeRef.current(); }, 1000);
        }
      }
    }
  }, [propCameraEnabled, showViolationPopup, currentTrackingMode, onCameraToggle]);

  // Break state enforcement watchdog
  useEffect(() => {
    if (isOnBreak) {
      console.log("[BREAK WATCHDOG] Break is active - enforcing camera off");
      if (cameraEnabledRef.current || cameraEnabled) {
        setCameraEnabled(false); cameraEnabledRef.current = false;
        if (onCameraToggle) { try { onCameraToggle(false); } catch (e) { console.warn("[BREAK WATCHDOG] Failed to disable camera:", e); } }
      }
      if (isTrackingRef.current) { setIsTracking(false); isTrackingRef.current = false; if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } }
      setShowCameraEnablePrompt(false);
    }
  }, [isOnBreak, cameraEnabled, onCameraToggle]);

  // Backend sync interval effect
  useEffect(() => {
    if (!meetingId || !userId || isSessionTerminated) return;
    if (syncIntervalRef.current) { clearInterval(syncIntervalRef.current); syncIntervalRef.current = null; }
    const syncInterval = isOnBreak ? AttendanceConfig.SYNC_INTERVAL_BREAK : AttendanceConfig.SYNC_INTERVAL_NORMAL;
    syncIntervalRef.current = setInterval(syncWithBackend, syncInterval);
    return () => { if (syncIntervalRef.current) { clearInterval(syncIntervalRef.current); syncIntervalRef.current = null; } };
  }, [meetingId, userId, isSessionTerminated, isOnBreak, syncWithBackend]);

  // Initialization effect
  useEffect(() => {
    mountedRef.current = true;
    if (isSessionTerminated || isSessionPermanentlyEnded) return;
    let initTimeoutId = null;
    if (meetingId && userId) {
      const initialize = async () => {
        if (!mountedRef.current || isSessionTerminatedRef.current) return;
        try {
          await syncWithBackend();
          if (!mountedRef.current || isSessionTerminatedRef.current) return;
          if (isOnBreakRef.current) {
            console.log("[INIT] On break after sync - starting session but skipping camera/tracking");
            setSessionActive(true); isSessionActiveRef.current = true;
            try { await apiCall("/start/", "POST", { meeting_id: meetingId, user_id: userId, user_name: userName, user_role: effectiveRole, current_tracking_mode: currentTrackingModeRef.current, is_host: isHost, is_cohost: isCoHost, should_detect_violations: false }); } catch (e) { console.warn("[INIT] Start API during break failed:", e.message); }
            return;
          }
          await startTracking();
        } catch (error) { console.error("[INIT] Error:", error); }
      };
      initTimeoutId = setTimeout(initialize, 500);
    }
    return () => { if (initTimeoutId) clearTimeout(initTimeoutId); if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [meetingId, userId, isSessionTerminated, isSessionPermanentlyEnded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      if (breakTimerRef.current) { clearInterval(breakTimerRef.current); breakTimerRef.current = null; }
      if (cameraPromptTimerRef.current) { clearTimeout(cameraPromptTimerRef.current); cameraPromptTimerRef.current = null; }
      if (syncIntervalRef.current) { clearInterval(syncIntervalRef.current); syncIntervalRef.current = null; }
      if (streamRef.current) { streamRef.current.getTracks().forEach((track) => track.stop()); streamRef.current = null; }
    };
  }, []);

  // ==================== STATUS HELPERS ====================
  const getStatus = useCallback(() => {
    if (isAuthBlocked) return "unauthorized";
    if (isSessionTerminated) return "terminated";
    if (!sessionActive) return "ended";
    if (isOnBreak) return "break";
    if (authWarningCount > 0 && faceAuthStatus === "unauthorized") return "unauthorized";
    if (currentViolations.length > 0) return "violation";
    if (attendanceData.attendancePercentage < 80) return "warning";
    return "active";
  }, [isAuthBlocked, isSessionTerminated, sessionActive, isOnBreak, authWarningCount, faceAuthStatus, currentViolations, attendanceData.attendancePercentage]);

  const getStatusIcon = useCallback(() => {
    const status = getStatus();
    const iconProps = { sx: { fontSize: 16 } };
    switch (status) {
      case "active": return <CheckCircle {...iconProps} sx={{ ...iconProps.sx, color: "#4caf50" }} />;
      case "warning": return <Warning {...iconProps} sx={{ ...iconProps.sx, color: "#ff9800" }} />;
      case "violation": return <ErrorIcon {...iconProps} sx={{ ...iconProps.sx, color: "#f44336" }} />;
      case "break": return <Coffee {...iconProps} sx={{ ...iconProps.sx, color: "#2196f3" }} />;
      case "initializing": return <CircularProgress size={16} sx={{ color: "#ffc107" }} />;
      case "host_tracking": return <CheckCircle {...iconProps} sx={{ ...iconProps.sx, color: "#4caf50" }} />;
      case "ended": return <ErrorIcon {...iconProps} sx={{ ...iconProps.sx, color: "#666" }} />;
      case "terminated": return <ErrorIcon {...iconProps} sx={{ ...iconProps.sx, color: "#f44336" }} />;
      case "unauthorized": return <PersonOff {...iconProps} sx={{ ...iconProps.sx, color: "#9c27b0" }} />;
      default: return <CheckCircle {...iconProps} sx={{ ...iconProps.sx, color: "#4caf50" }} />;
    }
  }, [getStatus]);

  const formatBreakTime = useCallback((seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  // ==================== RENDER ====================
  if (!meetingId || !userId) return null;

  const status = getStatus();
  const percentage = Math.round(attendanceData.attendancePercentage);
  const percentColor = percentage >= 80 ? "#4caf50" : percentage >= 50 ? "#ff9800" : "#f44336";

  // ============================================================
  // SHARED UI ELEMENTS
  // ============================================================
  const renderHiddenVideoElements = () => (
    !isSessionTerminated && (
      <>
        <video ref={videoRef} autoPlay muted playsInline style={{ display: "none" }} />
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </>
    )
  );

const renderToastNotifications = () => (
    <Snackbar
      open={toastOpen}
      autoHideDuration={5000}
      onClose={handleToastClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{
        zIndex: 9999,
        top: '80px !important',
        '& .MuiSnackbarContent-root': {
          minWidth: 'auto',
        },
      }}
    >
      <Alert
        onClose={handleToastClose}
        severity={toastSeverity === "violation" ? "warning" : toastSeverity}
        variant="filled"
        sx={{
          width: '100%',
          minWidth: 320,
          maxWidth: 500,
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          fontWeight: 600,
          fontSize: '0.85rem',
          borderRadius: '10px',
          '& .MuiAlert-icon': {
            fontSize: '22px',
          },
          '& .MuiAlert-action': {
            paddingTop: 0,
          },
        }}
        icon={
          toastMessage.includes("Identity") ? <PersonOff /> :
          toastSeverity === "error" ? <ErrorIcon /> :
          toastSeverity === "warning" ? <Warning /> :
          undefined
        }
      >
        {toastMessage}
      </Alert>
    </Snackbar>
  );

  const renderCameraPromptDialog = () => (
    <CameraPromptDialog open={showCameraEnablePrompt} disableEscapeKeyDown={false} onClose={() => { setShowCameraEnablePrompt(false); setCameraPromptDismissed(true); }}>
      <DialogTitle sx={{ textAlign: 'center', pb: 1, pt: 3 }} component="div">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
          <IconButton aria-label="close" onClick={() => { setShowCameraEnablePrompt(false); setCameraPromptDismissed(true); }} sx={{ position: 'absolute', right: 8, top: 8, color: '#888', '&:hover': { color: '#555' } }}>
            <Close />
          </IconButton>
          <Box sx={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: 'rgba(255, 152, 0, 0.1)', border: '2px solid #FF9800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <VideocamOutlined sx={{ fontSize: 36, color: '#FF9800' }} />
          </Box>
        </Box>
        <Typography variant="h6" component="span" sx={{ fontWeight: 700, color: '#FF9800' }}>Camera Disabled</Typography>
      </DialogTitle>
      <DialogContent sx={{ textAlign: 'center', px: 4, pb: 2 }}>
        <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>Attendance tracking is paused because your camera is disabled.</Alert>
        <Typography variant="body2" sx={{ color: '#555', mb: 2 }}>To resume AI-powered attendance monitoring and tracking, please enable your camera.</Typography>
        <Typography variant="caption" sx={{ color: '#999', display: 'block' }}>Your attendance percentage: <strong>{percentage}%</strong></Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', pb: 3, px: 3, gap: 1 }}>
        <Button variant="contained" onClick={handleEnableCameraFromPrompt} startIcon={<Videocam />} sx={{ backgroundColor: '#FF9800', color: 'white', fontWeight: 600, '&:hover': { backgroundColor: '#F57C00' } }}>Enable Camera</Button>
      </DialogActions>
    </CameraPromptDialog>
  );

  const renderTerminationPopup = () => (
    <AttendancePopup open={showTerminationPopup} message={terminationMessage} type="error" onClose={() => {}} hideCloseButton={true} attendanceData={attendanceData} faceAuthStatus={faceAuthStatus} />
  );

  // ============================================================
  // INLINE HORIZONTAL RENDER (for BrowserTabsHeader)
  // ============================================================
  if (inline) {
    return (
      <>
        <InlineContainer>
          <InlineStatusDot status={status} />
          {(currentTrackingMode === "host" || currentTrackingMode === "cohost") ? (
            <>
              {currentTrackingMode === "host" ? (
                <AdminPanelSettings sx={{ fontSize: 13, color: "#ff9800", flexShrink: 0 }} />
              ) : (
                <SupervisorAccount sx={{ fontSize: 13, color: "#ff5722", flexShrink: 0 }} />
              )}
              <InlineLabel sx={{ color: "rgba(255,255,255,0.7)" }}>
                {currentTrackingMode === "host" ? "Host" : "Co-Host"}
              </InlineLabel>
              <InlineDivider />
              <InlineLabel sx={{ color: "rgba(255,255,255,0.4)", fontSize: "10px" }}>Presence Active</InlineLabel>
            </>
          ) : isSessionTerminated ? (
            <>
              <ErrorIcon sx={{ fontSize: 13, color: "#f44336", flexShrink: 0 }} />
              <InlineLabel sx={{ color: "#f44336" }}>Terminated</InlineLabel>
            </>
          ) : isOnBreak ? (
            <>
              <Coffee sx={{ fontSize: 13, color: "#2196f3", flexShrink: 0 }} />
              <InlineLabel sx={{ color: "#64b5f6" }}>Break</InlineLabel>
              <InlineDivider />
              <Tooltip title="Click to end break" arrow placement="bottom">
                <InlineBreakTimer onClick={() => handleEndBreak(false)}>
                  <Stop sx={{ fontSize: 11, color: "#f44336" }} />
                  <InlineLabel sx={{ color: "#64b5f6", fontSize: "10px" }}>{formatBreakTime(breakTimeLeft)}</InlineLabel>
                </InlineBreakTimer>
              </Tooltip>
              <InlineDivider />
              <Tooltip title="Camera disabled during break" arrow placement="bottom">
                <VideocamOff sx={{ fontSize: 13, color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
              </Tooltip>
            </>
          ) : (
            <>
              <InlineLabel sx={{ color: percentColor, fontWeight: 700, fontSize: "12px", minWidth: 28, textAlign: "center" }}>{percentage}%</InlineLabel>
              <InlineProgressBar><InlineProgressFill value={percentage} barColor={percentColor} /></InlineProgressBar>
              <InlineDivider />
              <Tooltip title={`Behavioral warnings: ${warningCount}/${AttendanceConfig.MAX_WARNING_MESSAGES}`} arrow placement="bottom">
                <WarningBadge severity={warningCount >= 3 ? "error" : warningCount >= 1 ? "warning" : "info"}>
                  <Shield sx={{ fontSize: 9 }} /><span>{warningCount}/{AttendanceConfig.MAX_WARNING_MESSAGES}</span>
                </WarningBadge>
              </Tooltip>
              <Tooltip title={`Identity warnings: ${authWarningCount}/3`} arrow placement="bottom">
                <WarningBadge severity={authWarningCount >= 2 ? "error" : authWarningCount >= 1 ? "warning" : "info"}>
                  <Face sx={{ fontSize: 9 }} /><span>{authWarningCount}/3</span>
                </WarningBadge>
              </Tooltip>
              <InlineDivider />
              {canTakeBreak && (
                <Tooltip title={`Take break (${Math.floor(breakTimeRemaining)}s available)`} arrow placement="bottom">
                  <InlineActionButton onClick={handleTakeBreak} disabled={isProcessingBreak} sx={{ color: "#64b5f6", "&:hover": { color: "#2196f3", background: "rgba(33, 150, 243, 0.12)" } }}>
                    <Coffee sx={{ fontSize: 14 }} />
                  </InlineActionButton>
                </Tooltip>
              )}
              <Tooltip title={cameraEnabled ? "Camera active" : "Camera disabled"} arrow placement="bottom">
                {cameraEnabled ? <Videocam sx={{ fontSize: 13, color: "#4caf50", flexShrink: 0 }} /> : <VideocamOff sx={{ fontSize: 13, color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />}
              </Tooltip>
              {currentViolations.length > 0 && (
                <>
                  <InlineDivider />
                  <InlineViolationStrip>
                    <ViolationCount>{currentViolations.length}</ViolationCount>
                    <ViolationText>{currentViolations[0]}</ViolationText>
                  </InlineViolationStrip>
                </>
              )}
            </>
          )}
        </InlineContainer>
        {renderHiddenVideoElements()}
        {renderToastNotifications()}
        {renderCameraPromptDialog()}
        {renderTerminationPopup()}
      </>
    );
  }

  // ============================================================
  // ORIGINAL CARD RENDER (floating mode)
  // ============================================================
  return (
    <>
      <AttendanceContainer>
        <AttendanceIndicator>
          <CardContent sx={{ p: 2 }}>
            {!minimized ? (
              <>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {currentTrackingMode === "host" ? <AdminPanelSettings sx={{ fontSize: 16, color: "#ff9800" }} /> : currentTrackingMode === "cohost" ? <SupervisorAccount sx={{ fontSize: 16, color: "#ff5722" }} /> : getStatusIcon()}
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: "0.85rem" }}>
                      {currentTrackingMode === "host" ? "Meeting Host" : currentTrackingMode === "cohost" ? "Meeting Co-Host" : "AI Monitor"}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    {!isSessionTerminated && (cameraEnabled ? <Tooltip title="Camera Active"><Videocam sx={{ fontSize: 16, color: "#4caf50" }} /></Tooltip> : <Tooltip title="Camera Disabled"><VideocamOff sx={{ fontSize: 16, color: "#f44336" }} /></Tooltip>)}
                    {onToggleMinimized && <IconButton size="small" onClick={onToggleMinimized} sx={{ color: "white" }}><VisibilityOff sx={{ fontSize: 16 }} /></IconButton>}
                  </Box>
                </Box>
                {currentTrackingMode === "host" || currentTrackingMode === "cohost" ? (
                  <>
                    <StatusChip label={currentTrackingMode === "host" ? "HOST PRIVILEGES" : "CO-HOST PRIVILEGES"} status="excluded" size="small" sx={{ mb: 1.5 }} />
                    <Alert severity="info" sx={{ mb: 1.5, fontSize: "0.75rem" }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, display: "block", color: "#2196f3" }}>{currentTrackingMode === "host" ? "HOST PRIVILEGES:" : "CO-HOST PRIVILEGES:"}</Typography>
                      <Typography variant="caption" sx={{ fontSize: "0.7rem", color: "#90caf9", display: "block" }}>Presence tracking active</Typography>
                    </Alert>
                  </>
                ) : (
                  <>
                    <StatusChip label={isOnBreak ? "ON BREAK" : isSessionTerminated ? "TERMINATED" : isAuthBlocked ? "BLOCKED" : authWarningCount > 0 ? `AUTH WARN ${authWarningCount}/3` : `Active \u2022 ${percentage}%`} status={getStatus()} size="small" sx={{ mb: 1.5 }} />
                    {!isSessionTerminated && currentTrackingMode === "participant" && (
                      <>
                        <Box sx={{ mb: 1 }}>
                          <Typography variant="caption" sx={{ color: "#ff9800", fontSize: "0.7rem" }}>Behavioral: {warningCount}/{AttendanceConfig.MAX_WARNING_MESSAGES}</Typography>
                          <LinearProgress variant="determinate" value={(warningCount / AttendanceConfig.MAX_WARNING_MESSAGES) * 100} color="warning" sx={{ height: 4 }} />
                        </Box>
                        <Box sx={{ mb: 1 }}>
                          <Typography variant="caption" sx={{ color: "#9c27b0", fontSize: "0.7rem" }}>Identity: {authWarningCount}/3</Typography>
                          <LinearProgress variant="determinate" value={(authWarningCount / 3) * 100} color="secondary" sx={{ height: 4 }} />
                        </Box>
                      </>
                    )}
                    {currentViolations.length > 0 && <Alert severity="warning" sx={{ mt: 1, py: 0, fontSize: '0.75rem' }}>{currentViolations[0]}</Alert>}
                    <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center", mt: 1 }}>
                      {!isOnBreak && canTakeBreak && (
                        <Tooltip title={`Take break (${Math.floor(breakTimeRemaining)}s available)`}>
                          <span><IconButton size="small" onClick={handleTakeBreak} disabled={isProcessingBreak} sx={{ color: "#2196f3", backgroundColor: "rgba(33,150,243,0.1)", "&:hover": { backgroundColor: "rgba(33,150,243,0.2)" }, "&:disabled": { color: "#666", backgroundColor: "rgba(0,0,0,0.1)" } }}>
                            <Coffee sx={{ fontSize: 27 }} />
                          </IconButton></span>
                        </Tooltip>
                      )}
                      {isOnBreak && (
                        <Button size="small" variant="outlined" onClick={() => handleEndBreak(false)} disabled={isProcessingBreak || autoResumeInProgressRef.current} startIcon={<Stop />} sx={{ fontSize: "0.65rem", color: "#f44336", borderColor: "#f44336", "&:hover": { backgroundColor: "rgba(244,67,54,0.1)" } }}>
                          End Break ({formatBreakTime(breakTimeLeft)})
                        </Button>
                      )}
                    </Box>
                  </>
                )}
              </>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {getStatusIcon()}
                {onToggleMinimized && <IconButton size="small" onClick={onToggleMinimized} sx={{ color: "white" }}><Visibility sx={{ fontSize: 16 }} /></IconButton>}
              </Box>
            )}
          </CardContent>
        </AttendanceIndicator>
      </AttendanceContainer>
      {renderHiddenVideoElements()}
      {renderToastNotifications()}
      {renderCameraPromptDialog()}
      {renderTerminationPopup()}
    </>
  );
};

export default AttendanceTracker;