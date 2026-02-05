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
} from "@mui/icons-material";
import { styled } from "@mui/material/styles";

import AttendancePopup from "./AttendancePopup";

// ==================== STYLED COMPONENTS ====================
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
};

// ==================== API CONFIGURATION ====================
// Use environment variable or fallback to development URL
const API_BASE =  'https://192.168.48.201:8220';

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
  
  // ✅ FIXED: Refs for state synchronization in async callbacks
  const isOnBreakRef = useRef(false);
  const isTrackingRef = useRef(false);
  const isSessionActiveRef = useRef(false);
  const isSessionTerminatedRef = useRef(false);
  const currentTrackingModeRef = useRef("participant");
  const cameraEnabledRef = useRef(propCameraEnabled);

  // ✅ FIXED: Function refs to avoid stale closures
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
  useEffect(() => {
    isOnBreakRef.current = isOnBreak;
  }, [isOnBreak]);

  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  useEffect(() => {
    isSessionActiveRef.current = sessionActive;
  }, [sessionActive]);

  useEffect(() => {
    isSessionTerminatedRef.current = isSessionTerminated;
  }, [isSessionTerminated]);

  useEffect(() => {
    currentTrackingModeRef.current = currentTrackingMode;
  }, [currentTrackingMode]);

  useEffect(() => {
    cameraEnabledRef.current = cameraEnabled;
  }, [cameraEnabled]);

  // ==================== ROLE-BASED TRACKING MODE ====================
  const determineTrackingMode = useCallback(() => {
    if (isHost || effectiveRole === "host") return "host";
    if (isCoHost || effectiveRole === "co-host" || effectiveRole === "cohost")
      return "cohost";
    return "participant";
  }, [isHost, isCoHost, effectiveRole]);

  // ==================== VIOLATION DETECTION CHECK ====================
  const shouldDetectViolations = useMemo(() => {
    return (
      currentTrackingMode === "participant" &&
      sessionActive &&
      !isSessionTerminated &&
      !isOnBreak
    );
  }, [currentTrackingMode, sessionActive, isSessionTerminated, isOnBreak]);

  // ==================== BREAK AVAILABILITY CHECK ====================
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
  }, [
    currentTrackingMode,
    breakTimeRemaining,
    sessionActive,
    isOnBreak,
    isSessionTerminated,
    isProcessingBreak,
    totalBreakTimeUsed,
    isAuthBlocked,
  ]);

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
  const apiCall = useCallback(
    async (endpoint, method = "GET", data = null) => {
      const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const url = `${API_BASE}/api/attendance${cleanEndpoint}`.replace(/([^:]\/)\/+/g, "$1");
      const httpMethod = method.toUpperCase();
      
      console.log(`[API CALL] ${httpMethod} ${url}`);
      
      const options = {
        method: httpMethod,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        credentials: 'include',
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
        
        // Detect HTML response (nginx misconfiguration)
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error('Server returned HTML instead of JSON - check nginx config');
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
          // ✅ FIXED: Parse error response if it's JSON
          try {
            error.data = JSON.parse(errorText);
          } catch {
            error.data = { error: errorText };
          }
          throw error;
        }
        
        // ✅ FIXED: Wrap JSON parsing in try-catch
        try {
          return await response.json();
        } catch (parseError) {
          throw new Error('Invalid JSON response from server');
        }
      } catch (error) {
        console.error(`[API ERROR] ${httpMethod} ${url}:`, error.message);
        throw error;
      }
    },
    [sessionStartTime]
  );

  // ==================== DISPLAY NOTIFICATION SYSTEM ====================
  const showViolationPopup = useCallback(
    (message, type = "warning", force = false) => {
      if (!mountedRef.current) return;
      
      if (
        currentTrackingModeRef.current !== "participant" &&
        type !== "info" &&
        type !== "success"
      ) {
        return;
      }

      const isTermination = 
        type === "error" && 
        (message.toLowerCase().includes("terminated") || 
         message.toLowerCase().includes("blocked") || 
         message.toLowerCase().includes("removed"));

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

      if (onViolation) {
        onViolation({ message, type, timestamp: Date.now() });
      }
    },
    [onViolation, showSuccessPopup, triggerToast]
  );

  // ==================== SESSION TERMINATION HANDLER ====================
  const handleSessionTermination = useCallback(
    async (reason = "violations", message = "Session ended due to violations") => {
      if (currentTrackingModeRef.current !== "participant") return;
      if (isSessionTerminatedRef.current) return; // Prevent double termination

      console.log("[TERMINATION] Starting termination process:", reason);

      setIsSessionTerminated(true);
      setIsSessionPermanentlyEnded(true);
      setTerminationReason(reason);
      setSessionActive(false);
      setIsTracking(false);
      setIsTerminating(true);
      setShowCameraEnablePrompt(false);

      // Update refs immediately
      isSessionTerminatedRef.current = true;
      isSessionActiveRef.current = false;
      isTrackingRef.current = false;

      try {
        // Clear all intervals and timers
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        if (breakTimerRef.current) {
          clearInterval(breakTimerRef.current);
          breakTimerRef.current = null;
        }

        if (authCheckIntervalRef.current) {
          clearInterval(authCheckIntervalRef.current);
          authCheckIntervalRef.current = null;
        }

        if (cameraPromptTimerRef.current) {
          clearTimeout(cameraPromptTimerRef.current);
          cameraPromptTimerRef.current = null;
        }

        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
          syncIntervalRef.current = null;
        }

        // Stop camera stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => {
            track.stop();
          });
          streamRef.current = null;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }

        setVideoReady(false);

        // Notify backend
        if (meetingId && userId) {
          try {
            await apiCall("/stop/", "POST", {
              meeting_id: meetingId,
              user_id: userId,
              reason: "session_terminated",
              termination_reason: reason,
            });
          } catch (backendError) {
            console.warn("[TERMINATION] Failed to notify backend:", backendError.message);
          }
        }
      } catch (cleanupError) {
        console.error("[TERMINATION] Cleanup error:", cleanupError);
      }

      showViolationPopup(message, "error");

      // Countdown and callback
      setTerminationCountdown(3);
      const countdownInterval = setInterval(() => {
        setTerminationCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);

            if (onSessionTerminated) {
              onSessionTerminated({
                userId,
                userName,
                reason: reason,
                message: message,
                timestamp: Date.now(),
                participantSpecific: true,
                permanent: true,
              });
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [meetingId, userId, userName, onSessionTerminated, showViolationPopup, apiCall]
  );

  // ==================== CAMERA INITIALIZATION ====================
  const initializeCamera = useCallback(async () => {
    if (isSessionTerminatedRef.current) {
      return false;
    }

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
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints[i]);
          break;
        } catch (err) {
          if (i === constraints.length - 1) throw err;
        }
      }

      if (!stream) {
        throw new Error("Failed to get camera stream");
      }

      streamRef.current = stream;

      if (videoRef.current && mountedRef.current && !isSessionTerminatedRef.current) {
        videoRef.current.srcObject = stream;

        await new Promise((resolve, reject) => {
          const video = videoRef.current;
          if (!video) {
            reject(new Error("Video ref lost"));
            return;
          }

          const timeout = setTimeout(() => {
            reject(new Error("Video setup timeout"));
          }, 10000);

          const handleLoad = () => {
            clearTimeout(timeout);
            video.removeEventListener("loadedmetadata", handleLoad);
            video.removeEventListener("error", handleError);
            resolve();
          };

          const handleError = (err) => {
            clearTimeout(timeout);
            video.removeEventListener("loadedmetadata", handleLoad);
            video.removeEventListener("error", handleError);
            reject(err);
          };

          video.addEventListener("loadedmetadata", handleLoad);
          video.addEventListener("error", handleError);

          video.play().catch(reject);
        });
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
  const verifyCameraReady = useCallback(
    async (maxRetries = 5, retryDelay = 500) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (!mountedRef.current || isSessionTerminatedRef.current) return false;

        if (!videoRef.current || !streamRef.current) {
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            continue;
          }
          return false;
        }

        const videoTracks = streamRef.current.getVideoTracks();
        if (videoTracks.length === 0) {
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            continue;
          }
          return false;
        }

        const track = videoTracks[0];

        if (!track.enabled) {
          track.enabled = true;
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        if (track.readyState !== "live") {
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            continue;
          }
          return false;
        }

        if (videoRef.current.paused || videoRef.current.ended) {
          try {
            await videoRef.current.play();
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (playError) {
            if (attempt < maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
              continue;
            }
          }
        }

        if (
          videoRef.current.videoWidth === 0 ||
          videoRef.current.videoHeight === 0
        ) {
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            continue;
          }
          return false;
        }

        return true;
      }
      return false;
    },
    []
  );

  // ==================== VERIFY WITH BACKEND ====================
  const verifyWithBackend = useCallback(
    async (confirmationToken) => {
      if (!confirmationToken) {
        console.log("[VERIFY CAMERA] No confirmation token provided, skipping");
        return true;
      }

      if (!isSessionActiveRef.current || isSessionTerminatedRef.current) {
        console.log("[VERIFY CAMERA] Session not active, skipping verification");
        return true;
      }

      try {
        setCameraInitStatus("verifying");
        console.log("[VERIFY CAMERA] Sending verification request...");

        const response = await apiCall("/verify-camera/", "POST", {
          meeting_id: meetingId,
          user_id: userId,
          confirmation_token: confirmationToken,
          camera_active: true,
        });

        if (response.success) {
          console.log("[VERIFY CAMERA] ✅ Verification successful");
          return true;
        } else {
          const errorMsg = response.error || "";
          if (errorMsg.includes("No camera verification expected") || 
              errorMsg.includes("no session") ||
              errorMsg.includes("session not found")) {
            console.log("[VERIFY CAMERA] Backend doesn't expect verification - OK to continue");
            return true;
          }
          console.warn("[VERIFY CAMERA] Verification failed:", response.error);
          return false;
        }
      } catch (error) {
        const errorMsg = error.message || "";
        
        if (errorMsg.includes("400") ||
            errorMsg.includes("No camera verification expected") ||
            errorMsg.includes("session not found") ||
            errorMsg.includes("no active session")) {
          console.log("[VERIFY CAMERA] No active session expecting verification - OK");
          return true;
        }

        console.error("[VERIFY CAMERA] ❌ Error:", error.message);
        return true; // Non-blocking
      }
    },
    [meetingId, userId, apiCall]
  );

  // ==================== HANDLE ANALYSIS RESPONSE ====================
  const handleAnalysisResponse = useCallback(
    (response) => {
      if (!response || !mountedRef.current) return;
      if (isSessionTerminatedRef.current) return;

      // ============================================================
      // 1. IDENTITY VERIFICATION
      // ============================================================
      
      if (response.identity_warning_count !== undefined) {
        setAuthWarningCount(response.identity_warning_count);
        
        if (response.identity_warning_count > 0) {
           setFaceAuthStatus("unauthorized");
        } else if (response.identity_verified) {
           setFaceAuthStatus("verified");
        }
      }

      if (response.identity_popup && response.identity_popup.trim() !== "") {
         triggerToast(response.identity_popup, "error");
      }

      if (response.identity_is_removed === true || 
          (response.status === "removed_from_meeting" && response.removal_type === "identity_verification")) {
         setIsAuthBlocked(true);
         isAuthBlockedRef.current = true;
         handleSessionTermination(
            "identity_verification_failure",
            response.message || "🚫 Session terminated: Identity verification failed 3 times."
         );
         return;
      }

      // ============================================================
      // 2. BEHAVIORAL ANALYSIS 
      // ============================================================

      if (response.popup && response.popup.trim() !== "") {
        let popupType = "warning";
        
        if (response.popup.includes("Detection")) {
             popupType = "error";
        } else if (response.popup.includes("Warning")) {
             popupType = "warning";
        } else if (response.popup.includes("Inactivity")) {
             popupType = "info";
        }
        
        triggerToast(response.popup, popupType);
      }

      if (response.status === "participant_removed" || response.removal_type === "continuous_violations") {
        handleSessionTermination(
          "continuous_violations",
          response.message || `🚫 Session terminated: Continuous violations for 2 minutes.`
        );
        return;
      }

      if (response.grace_period_active) {
        const gracePeriodTimeRemaining = (response.grace_period_expires_in || 0) * 1000;
        setGracePeriodActive(true);
        gracePeriodRef.current.active = true;
        gracePeriodRef.current.until = Date.now() + gracePeriodTimeRemaining;

        if (response.message) {
          triggerToast(response.message, "info");
        }
        return;
      } else if (
        gracePeriodRef.current.active &&
        Date.now() >= gracePeriodRef.current.until
      ) {
        setGracePeriodActive(false);
        gracePeriodRef.current.active = false;
        gracePeriodRef.current.until = 0;
      }

      if (response.attendance_percentage !== undefined) {
        setAttendanceData((prev) => ({
          ...prev,
          attendancePercentage: response.attendance_percentage,
          engagementScore: response.engagement_score || response.attendance_percentage,
          popupCount: response.popup_count || 0,
        }));
      }

      if (response.violations && Array.isArray(response.violations)) {
        setCurrentViolations(response.violations);
      }

      if (response.warning_count !== undefined) {
        setWarningCount(response.warning_count);
      }

      if (response.warning_phase_complete !== undefined) {
        setWarningsExhausted(response.warning_phase_complete);
      }

      if (onStatusChange) {
        onStatusChange({
          status: response.status,
          attendancePercentage: response.attendance_percentage,
          violations: response.violations || [],
          warningCount: response.warning_count || 0,
          detectionCount: response.detection_counts || 0,
        });
      }
    },
    [handleSessionTermination, triggerToast, onStatusChange]
  );

  // ==================== FRAME CAPTURE AND ANALYSIS ====================
  const captureAndAnalyze = useCallback(async () => {
    if (!mountedRef.current) return;
    if (isSessionTerminatedRef.current) return;
    if (!cameraEnabledRef.current) return;
    if (isOnBreakRef.current) return;
    if (!isSessionActiveRef.current || !videoReady || !isTrackingRef.current) return;
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    if (video.paused || video.ended) return;
    if (!streamRef.current || streamRef.current.getTracks().length === 0) return;

    const videoTracks = streamRef.current.getVideoTracks();
    if (videoTracks.length === 0 || !videoTracks[0].enabled) return;

    if (processingFrame) return;

    try {
      setProcessingFrame(true);

      const context = canvas.getContext("2d");
      const maxWidth = 640;
      const maxHeight = 480;
      let { videoWidth: width, videoHeight: height } = video;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;
      context.drawImage(video, 0, 0, width, height);

      const frameData = canvas.toDataURL("image/jpeg", 0.8);

      const analysisState = {
        meeting_id: meetingId,
        user_id: userId,
        frame: frameData,
        user_role: effectiveRole,
        current_tracking_mode: currentTrackingModeRef.current,
        is_host: isHost,
        is_cohost: isCoHost,
        is_on_break: isOnBreakRef.current,
        should_detect_violations: shouldDetectViolations,
        role_history: roleHistoryRef.current,
        session_start_time: sessionStartTime,
      };

      const response = await apiCall("/detect/", "POST", analysisState);

      if (mountedRef.current && !isSessionTerminatedRef.current) {
        handleAnalysisResponse(response);
      }
    } catch (error) {
      console.error("[CAPTURE] Frame analysis error:", error);

      if (
        error.message.includes("session_closed") ||
        error.message.includes("session_terminated")
      ) {
        if (currentTrackingModeRef.current === "participant") {
          handleSessionTermination("session_violations_error", "Session ended");
        }
        return;
      }
    } finally {
      if (mountedRef.current) {
        setProcessingFrame(false);
      }
    }
  }, [
    videoReady,
    meetingId,
    userId,
    processingFrame,
    effectiveRole,
    isHost,
    isCoHost,
    shouldDetectViolations,
    sessionStartTime,
    apiCall,
    handleAnalysisResponse,
    handleSessionTermination,
  ]);

  // ✅ FIXED: Update the ref whenever captureAndAnalyze changes
  useEffect(() => {
    captureAndAnalyzeRef.current = captureAndAnalyze;
  }, [captureAndAnalyze]);

  // ==================== END BREAK HANDLER ====================
  const handleEndBreak = useCallback(async (isAutoExpire = false) => {
    if (currentTrackingModeRef.current !== "participant") return;

    // Guard against duplicate calls
    if (breakProcessingRef.current) {
      console.log("[END BREAK] Already processing, skipping...");
      return;
    }

    if (!isAutoExpire && autoResumeInProgressRef.current) {
      console.log("[END BREAK] Auto-resume already in progress, skipping...");
      return;
    }

    const cameraWasEnabled = cameraWasEnabledBeforeBreakRef.current;

    breakProcessingRef.current = true;
    if (!isAutoExpire) {
      autoResumeInProgressRef.current = true;
    }
    setIsProcessingBreak(true);

    console.log("[END BREAK] Starting end break process...", { 
      isAutoExpire, 
      cameraWasEnabled 
    });

    let backendResponse = null;

    try {
      // STEP 1: Clear the break timer immediately
      if (breakTimerRef.current) {
        clearInterval(breakTimerRef.current);
        breakTimerRef.current = null;
        console.log("[END BREAK] Break timer cleared");
      }

      // STEP 2: Check backend status FIRST
      let skipResumeApi = false;
      
      try {
        const statusResponse = await apiCall(
          `/status/?meeting_id=${meetingId}&user_id=${userId}`,
          "GET"
        );

        console.log("[END BREAK] Backend status:", {
          is_on_break: statusResponse.is_on_break,
          break_time_remaining: statusResponse.break_time_remaining,
        });

        // If backend says NOT on break, skip the resume API call
        if (!statusResponse.is_on_break) {
          console.log("[END BREAK] Backend says not on break - syncing state only");
          skipResumeApi = true;
          
          setIsOnBreak(false);
          isOnBreakRef.current = false;
          setBreakTimeLeft(0);
          setBreakStartedAt(null);
          setTotalBreakTimeUsed(statusResponse.total_break_time_used || 0);
          setBreakTimeRemaining(statusResponse.break_time_remaining || 0);
          
          backendResponse = {
            success: true,
            is_on_break: false,
            camera_verification_required: false,
          };
        }
      } catch (statusError) {
        console.warn("[END BREAK] Status check failed:", statusError.message);
      }

      // STEP 3: Call resume API only if needed
      if (!skipResumeApi) {
        try {
          backendResponse = await apiCall("/pause-resume/", "POST", {
            meeting_id: meetingId,
            user_id: userId,
            action: "resume",
          });

          console.log("[END BREAK] Resume API response:", backendResponse);

          if (backendResponse.success !== false) {
            setIsOnBreak(false);
            isOnBreakRef.current = false;
            setBreakStartedAt(null);
            setCurrentViolations([]);
            setTotalBreakTimeUsed(backendResponse.total_break_time_used || 0);
            setBreakTimeRemaining(backendResponse.break_time_remaining || 0);
            setBreakCount(backendResponse.break_count || 0);
            setBreakTimeLeft(0);

            if (backendResponse.camera_confirmation_token) {
              cameraVerificationTokenRef.current = backendResponse.camera_confirmation_token;
            }
          }
        } catch (resumeError) {
          const errorMessage = resumeError.message || "";
          const errorData = resumeError.data || {};
          
          console.log("[END BREAK] Resume error:", errorMessage);
          
          // Handle "Not currently on break" gracefully
          if (
            errorMessage.includes("400") ||
            errorMessage.includes("Not currently on break") ||
            errorMessage.includes("not on break") ||
            errorMessage.includes("Not on break") ||
            errorData.error?.includes("Not currently on break")
          ) {
            console.log("[END BREAK] ✅ Backend says not on break - this is OK, syncing state");
            
            setIsOnBreak(false);
            isOnBreakRef.current = false;
            setBreakTimeLeft(0);
            setBreakStartedAt(null);
            
            if (errorData.break_time_remaining !== undefined) {
              setBreakTimeRemaining(errorData.break_time_remaining);
            }
            if (errorData.total_break_time_used !== undefined) {
              setTotalBreakTimeUsed(errorData.total_break_time_used);
            }
            
            backendResponse = {
              success: true,
              is_on_break: false,
              camera_verification_required: false,
            };
            
            if (!isAutoExpire) {
              showViolationPopup("Break already ended - resuming tracking", "info");
            }
          } else {
            console.error("[END BREAK] ❌ Resume API error:", resumeError);
            showViolationPopup(`Failed to end break: ${errorMessage}`, "error");
            return; // Exit on real error
          }
        }
      }

      // Check session validity
      if (isSessionTerminatedRef.current) {
        return;
      }

      // STEP 4: Re-enable camera if it was enabled before
      if (cameraWasEnabled) {
        console.log("[END BREAK] 📷 Re-enabling camera...");
        
        if (!onCameraToggle) {
          showViolationPopup("Cannot control camera - please enable manually", "warning");
        } else {
          if (isAutoExpire) {
            setCameraEnabled(true);
            cameraEnabledRef.current = true;
            await new Promise((resolve) => setTimeout(resolve, 250));
          }

          showViolationPopup("📷 Enabling camera...", "info");
          setCameraInitStatus("initializing");
          setCameraEnabled(true);
          cameraEnabledRef.current = true;

          await new Promise((resolve) => setTimeout(resolve, 150));

          try {
            onCameraToggle(true);
            console.log("[END BREAK] ✅ Camera toggle called");
          } catch (toggleError) {
            console.error("[END BREAK] Camera toggle error:", toggleError);
            showViolationPopup("Failed to enable camera - please enable manually", "warning");
          }

          // Wait for camera
          const waitTime = isAutoExpire ? 4000 : 2000;
          await new Promise((resolve) => setTimeout(resolve, waitTime));

          const cameraReady = await verifyCameraReady(isAutoExpire ? 20 : 5, isAutoExpire ? 1500 : 500);

          if (cameraReady) {
            setCameraInitStatus("ready");
            console.log("[END BREAK] ✅ Camera ready");
          } else {
            setCameraInitStatus("failed");
            showViolationPopup("⚠️ Camera may not be ready - check manually", "warning");
          }

          // Camera verification (non-blocking)
          if (backendResponse?.camera_verification_required && 
              cameraVerificationTokenRef.current && 
              !isAutoExpire) {
            try {
              await verifyWithBackend(cameraVerificationTokenRef.current);
            } catch (e) {
              console.warn("[END BREAK] Camera verification failed (non-blocking)");
            }
          }
        }
      }

      // STEP 5: Resume tracking
      if (mountedRef.current && isSessionActiveRef.current && !isSessionTerminatedRef.current) {
        console.log("[END BREAK] 🎯 Resuming tracking...");
        setIsTracking(true);
        isTrackingRef.current = true;

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        intervalRef.current = setInterval(() => {
          if (mountedRef.current && 
              !isSessionTerminatedRef.current && 
              !isOnBreakRef.current &&
              captureAndAnalyzeRef.current) {
            captureAndAnalyzeRef.current();
          }
        }, AttendanceConfig.DETECTION_INTERVAL);

        setTimeout(() => {
          if (mountedRef.current && 
              !isSessionTerminatedRef.current && 
              !isOnBreakRef.current &&
              captureAndAnalyzeRef.current) {
            captureAndAnalyzeRef.current();
          }
        }, 1000);
      }

      // Success message
      const endType = isAutoExpire ? "⏰ Auto-completed" : "✋ Manually ended";
      showViolationPopup(`✅ Break ${endType} - Tracking resumed!`, "success");

      console.log("[END BREAK] ✅ Complete!");
    } catch (error) {
      console.error("[END BREAK] ❌ Unexpected error:", error);
      showViolationPopup(`Error: ${error.message}`, "error");
      
      // Reset state
      setIsOnBreak(false);
      isOnBreakRef.current = false;
      setBreakTimeLeft(0);
    } finally {
      // ✅ FIXED: Always reset processing flags
      breakProcessingRef.current = false;
      autoResumeInProgressRef.current = false;
      setIsProcessingBreak(false);
    }
  }, [
    meetingId,
    userId,
    onCameraToggle,
    showViolationPopup,
    apiCall,
    verifyCameraReady,
    verifyWithBackend,
  ]);

  // ✅ FIXED: Update the ref whenever handleEndBreak changes
  useEffect(() => {
    handleEndBreakRef.current = handleEndBreak;
  }, [handleEndBreak]);

  // ==================== BREAK TIMER ====================
  const startBreakTimer = useCallback(
    (duration) => {
      // Clear any existing timer first
      if (breakTimerRef.current) {
        clearInterval(breakTimerRef.current);
        breakTimerRef.current = null;
      }

      setBreakStartedAt(Date.now());
      setBreakTimeLeft(duration);

      console.log(`[BREAK TIMER] Starting timer for ${duration} seconds`);

      breakTimerRef.current = setInterval(() => {
        setBreakTimeLeft((prevTime) => {
          const newTime = prevTime - 1;

          // Log every 30 seconds
          if (newTime > 0 && newTime % 30 === 0) {
            console.log(`[BREAK TIMER] ${newTime} seconds remaining`);
          }

          // Warning at 60 seconds
          if (newTime === 60) {
            showViolationPopup("⚠️ 1 minute remaining on your break", "warning");
          }

          // Warning at 30 seconds
          if (newTime === 30) {
            showViolationPopup("⚠️ 30 seconds remaining on your break", "warning");
          }

          // Warning at 10 seconds
          if (newTime === 10) {
            showViolationPopup("⚠️ 10 seconds remaining! Break will end soon.", "warning");
          }

          // Countdown from 5 to 1
          if (newTime >= 1 && newTime <= 5) {
            showViolationPopup(`⏱️ ${newTime}...`, "warning");
          }

          // AUTO-EXPIRE at 0
          if (newTime <= 0) {
            console.log("[BREAK TIMER] ⏰ Timer expired! Auto-ending break...");

            // Clear the timer immediately
            if (breakTimerRef.current) {
              clearInterval(breakTimerRef.current);
              breakTimerRef.current = null;
            }

            // ✅ FIXED: Use ref to get latest function and prevent stale closure
            if (
              mountedRef.current &&
              !isSessionTerminatedRef.current &&
              !breakProcessingRef.current &&
              !autoResumeInProgressRef.current
            ) {
              autoResumeInProgressRef.current = true;
              
              showViolationPopup("⏰ Break time expired! Resuming tracking...", "info");

              // Use setTimeout to avoid state update during render
              setTimeout(() => {
                if (handleEndBreakRef.current) {
                  handleEndBreakRef.current(true).finally(() => {
                    autoResumeInProgressRef.current = false;
                  });
                }
              }, 100);
            }

            return 0;
          }

          return newTime;
        });
      }, 1000);
    },
    [showViolationPopup]
  );

  // ==================== BACKEND SYNC ====================
  const syncWithBackend = useCallback(async () => {
    if (!meetingId || !userId || isSessionTerminatedRef.current) return;

    try {
      const response = await apiCall(
        `/status/?meeting_id=${meetingId}&user_id=${userId}`,
        "GET"
      );

      const backendOnBreak = response.is_on_break || false;
      const backendBreakTimeRemaining = response.break_time_remaining || 0;
      const backendTotalUsed = response.total_break_time_used || 0;
      const backendBreakCount = response.break_count || 0;

      if (backendBreakCount !== breakCount) {
        setBreakCount(backendBreakCount);
      }

      if (Math.abs(breakTimeRemaining - backendBreakTimeRemaining) > 5) {
        setBreakTimeRemaining(backendBreakTimeRemaining);
      }

      if (Math.abs(totalBreakTimeUsed - backendTotalUsed) > 2) {
        setTotalBreakTimeUsed(backendTotalUsed);
      }

      // Sync break state
      if (isOnBreakRef.current !== backendOnBreak) {
        setIsOnBreak(backendOnBreak);
        isOnBreakRef.current = backendOnBreak;

        if (!backendOnBreak && breakTimerRef.current) {
          clearInterval(breakTimerRef.current);
          breakTimerRef.current = null;
          setBreakTimeLeft(0);
          setBreakStartedAt(null);
          breakProcessingRef.current = false;
          autoResumeInProgressRef.current = false;
          setIsProcessingBreak(false);

          if (cameraWasEnabledBeforeBreakRef.current && onCameraToggle) {
            onCameraToggle(true);
            setCameraEnabled(true);
            cameraEnabledRef.current = true;
          }
        } else if (
          backendOnBreak &&
          !breakTimerRef.current &&
          !breakProcessingRef.current
        ) {
          const remainingTime = Math.max(0, backendBreakTimeRemaining);
          if (remainingTime > 0) {
            setBreakTimeLeft(remainingTime);
            startBreakTimer(remainingTime);
          }
        }
      }
    } catch (error) {
      console.warn("[SYNC] Backend sync failed:", error.message);
    }
  }, [
    meetingId,
    userId,
    breakTimeRemaining,
    totalBreakTimeUsed,
    breakCount,
    onCameraToggle,
    startBreakTimer,
    apiCall,
  ]);

  // ==================== TAKE BREAK ====================
  const handleTakeBreak = useCallback(async () => {
    if (currentTrackingModeRef.current !== "participant") {
      showViolationPopup("Break only available for participants", "warning");
      return;
    }

    if (
      breakProcessingRef.current ||
      isSessionTerminatedRef.current ||
      isOnBreakRef.current ||
      !canTakeBreak
    ) {
      console.log("[START BREAK] Cannot start break - invalid state");
      return;
    }

    breakProcessingRef.current = true;
    setIsProcessingBreak(true);

    console.log("[START BREAK] Starting break process...");
    console.log("[START BREAK] Break time remaining:", breakTimeRemaining);

    try {
      // Save camera state BEFORE disabling
      cameraWasEnabledBeforeBreakRef.current = cameraEnabledRef.current;
      console.log("[START BREAK] Camera was enabled before break:", cameraWasEnabledBeforeBreakRef.current);

      // Call backend to start break
      const response = await apiCall("/pause-resume/", "POST", {
        meeting_id: meetingId,
        user_id: userId,
        action: "pause",
      });

      console.log("[START BREAK] Backend response:", response);

      if (response.success) {
        // Update state from backend response
        setIsOnBreak(true);
        isOnBreakRef.current = true;
        setCurrentViolations([]);
        setTotalBreakTimeUsed(response.total_break_time_used || 0);
        setBreakTimeRemaining(response.break_time_remaining || 0);
        setBreakCount(response.break_count || 0);

        // Disable camera
        if (cameraEnabledRef.current && onCameraToggle) {
          try {
            onCameraToggle(false);
            setCameraEnabled(false);
            cameraEnabledRef.current = false;
            console.log("[START BREAK] Camera disabled");
          } catch (cameraError) {
            console.error("[START BREAK] Failed to disable camera:", cameraError);
          }
        }

        // Stop tracking interval
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        // Clear camera prompt
        setShowCameraEnablePrompt(false);
        setCameraPromptDismissed(false);
        if (cameraPromptTimerRef.current) {
          clearTimeout(cameraPromptTimerRef.current);
          cameraPromptTimerRef.current = null;
        }

        // Start break timer
        const breakDuration = response.break_duration || response.break_time_remaining || 300;
        setBreakTimeLeft(breakDuration);
        startBreakTimer(breakDuration);

        const displayMinutes = Math.floor(breakDuration / 60);
        const displaySeconds = breakDuration % 60;

        console.log(`[START BREAK] Break started. Duration: ${breakDuration}s`);
        showViolationPopup(
          `✅ Break #${response.break_count} started - camera disabled. ${displayMinutes}:${displaySeconds.toString().padStart(2, "0")} available.`,
          "success"
        );
      } else {
        // Handle specific errors
        if (response.error === "Already on break") {
          console.log("[START BREAK] Already on break according to backend");
          setIsOnBreak(true);
          isOnBreakRef.current = true;
          startBreakTimer(response.break_time_remaining || breakTimeRemaining);
          showViolationPopup("Break is already active", "info");
        } else if (response.break_time_exhausted || (response.error && response.error.includes("exceeded"))) {
          setBreakTimeRemaining(0);
          showViolationPopup("No break time remaining", "error");
        } else {
          throw new Error(response.error || "Failed to start break");
        }
      }
    } catch (error) {
      console.error("[START BREAK] Error:", error);
      showViolationPopup(`Break failed: ${error.message}`, "error");
      setIsOnBreak(false);
      isOnBreakRef.current = false;
    } finally {
      breakProcessingRef.current = false;
      setIsProcessingBreak(false);
    }
  }, [
    canTakeBreak,
    onCameraToggle,
    meetingId,
    userId,
    breakTimeRemaining,
    showViolationPopup,
    apiCall,
    startBreakTimer,
  ]);

  // ==================== RETRY CAMERA ====================
  const handleRetryCamera = useCallback(async () => {
    if (!onCameraToggle) {
      showViolationPopup("Camera control not available", "error");
      return;
    }

    setCameraInitStatus("initializing");
    showViolationPopup("Retrying camera initialization...", "info");

    try {
      onCameraToggle(true);
      setCameraEnabled(true);
      cameraEnabledRef.current = true;

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const cameraReady = await verifyCameraReady(5, 500);

      if (!cameraReady) {
        throw new Error("Camera verification failed after retry");
      }

      setCameraInitStatus("ready");
      showViolationPopup("Camera enabled successfully", "success");

      if (!isTrackingRef.current && 
          isSessionActiveRef.current && 
          !isSessionTerminatedRef.current && 
          !isOnBreakRef.current) {
        setIsTracking(true);
        isTrackingRef.current = true;

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }

        intervalRef.current = setInterval(() => {
          if (mountedRef.current && 
              !isSessionTerminatedRef.current && 
              !isOnBreakRef.current &&
              captureAndAnalyzeRef.current) {
            captureAndAnalyzeRef.current();
          }
        }, AttendanceConfig.DETECTION_INTERVAL);

        setTimeout(() => {
          if (mountedRef.current && 
              !isSessionTerminatedRef.current && 
              !isOnBreakRef.current &&
              captureAndAnalyzeRef.current) {
            captureAndAnalyzeRef.current();
          }
        }, 1000);
      }
    } catch (error) {
      setCameraInitStatus("failed");
      setCameraInitError(error.message);
      showViolationPopup(`Camera retry failed: ${error.message}`, "error");
    }
  }, [onCameraToggle, showViolationPopup, verifyCameraReady]);

  // ==================== HANDLE ENABLE CAMERA FROM PROMPT ====================
  const handleEnableCameraFromPrompt = useCallback(async () => {
    if (!onCameraToggle) {
      triggerToast("Camera control not available", "error");
      setShowCameraEnablePrompt(false);
      return;
    }

    try {
      setShowCameraEnablePrompt(false);
      setCameraPromptDismissed(false);
      
      triggerToast("Enabling camera...", "info");
      
      onCameraToggle(true);
      setCameraEnabled(true);
      cameraEnabledRef.current = true;

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const cameraReady = await verifyCameraReady(5, 500);

      if (!cameraReady) {
        throw new Error("Camera verification failed");
      }

      setCameraInitStatus("ready");
      triggerToast("Camera enabled - tracking resumed", "success");

      if (!isTrackingRef.current && 
          isSessionActiveRef.current && 
          !isSessionTerminatedRef.current && 
          !isOnBreakRef.current) {
        setIsTracking(true);
        isTrackingRef.current = true;

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }

        intervalRef.current = setInterval(() => {
          if (mountedRef.current && 
              !isSessionTerminatedRef.current && 
              !isOnBreakRef.current &&
              captureAndAnalyzeRef.current) {
            captureAndAnalyzeRef.current();
          }
        }, AttendanceConfig.DETECTION_INTERVAL);

        setTimeout(() => {
          if (mountedRef.current && 
              !isSessionTerminatedRef.current && 
              !isOnBreakRef.current &&
              captureAndAnalyzeRef.current) {
            captureAndAnalyzeRef.current();
          }
        }, 1000);
      }
    } catch (error) {
      setCameraInitStatus("failed");
      setCameraInitError(error.message);
      triggerToast(`Failed to enable camera: ${error.message}`, "error");
    }
  }, [onCameraToggle, triggerToast, verifyCameraReady]);

  // ==================== ROLE TRANSITION ====================
  const handleRoleTransition = useCallback(
    (newMode) => {
      if (newMode === currentTrackingMode) return;

      setRoleTransitionInProgress(true);

      const roleChange = {
        fromRole: currentTrackingMode,
        toRole: newMode,
        timestamp: Date.now(),
        attendanceAtTransition: attendanceData.attendancePercentage,
      };

      roleHistoryRef.current.push(roleChange);

      setAttendanceData((prev) => ({
        ...prev,
        roleHistory: [...roleHistoryRef.current],
      }));

      if (newMode !== "participant") {
        setCurrentViolations([]);
        setWarningsExhausted(false);
      }

      setCurrentTrackingMode(newMode);
      currentTrackingModeRef.current = newMode;
      setRoleTransitionInProgress(false);
    },
    [currentTrackingMode, attendanceData.attendancePercentage]
  );

  // ==================== START TRACKING ====================
  const startTracking = useCallback(async () => {
    if (!meetingId || !userId || !mountedRef.current) {
      console.warn("[START TRACKING] Missing meetingId or userId");
      return false;
    }

    if (isSessionTerminatedRef.current) {
      console.warn("[START TRACKING] Session already terminated");
      return false;
    }

    // Guard: Prevent duplicate calls
    if (startTrackingInProgressRef.current) {
      console.warn("[START TRACKING] Already in progress, skipping duplicate call");
      return false;
    }

    // Guard: Already tracking
    if (isTrackingRef.current && isSessionActiveRef.current) {
      console.warn("[START TRACKING] Already tracking, skipping");
      return true;
    }

    startTrackingInProgressRef.current = true;

    console.log(`[START TRACKING] Starting for meeting: ${meetingId}, user: ${userId}`);

    try {
      // Initialize camera if needed
      if (!videoReady && !isOnBreakRef.current) {
        console.log("[START TRACKING] Initializing camera...");
        const cameraReady = await initializeCamera();
        if (!cameraReady || !mountedRef.current || isSessionTerminatedRef.current) {
          showViolationPopup("Camera initialization failed", "error");
          return false;
        }
        console.log("[START TRACKING] Camera initialized successfully");
      }

      const requestData = {
        meeting_id: meetingId,
        user_id: userId,
        user_name: userName,
        user_role: effectiveRole,
        current_tracking_mode: currentTrackingModeRef.current,
        is_host: isHost,
        is_cohost: isCoHost,
        should_detect_violations: shouldDetectViolations,
      };

      console.log("[START TRACKING] Sending POST request to /start/");

      const response = await apiCall("/start/", "POST", requestData);

      console.log("[START TRACKING] Response received:", response);

      if (!mountedRef.current || isSessionTerminatedRef.current) {
        return false;
      }

      // Update state on success
      setSessionActive(true);
      isSessionActiveRef.current = true;
      setIsTracking(true);
      isTrackingRef.current = true;
      
      if (currentTrackingModeRef.current === "participant") {
        setWarningCount(0);
        setWarningsExhausted(false);
        setFaceAuthStatus("verified");
        setIsAuthBlocked(false);
        isAuthBlockedRef.current = false;
      }

      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Start the detection interval
      intervalRef.current = setInterval(() => {
        if (mountedRef.current && 
            !isSessionTerminatedRef.current && 
            !isOnBreakRef.current &&
            captureAndAnalyzeRef.current) {
          captureAndAnalyzeRef.current();
        }
      }, AttendanceConfig.DETECTION_INTERVAL);

      // Initial capture
      if (!isOnBreakRef.current) {
        setTimeout(() => {
          if (mountedRef.current && 
              !isOnBreakRef.current && 
              !isSessionTerminatedRef.current &&
              captureAndAnalyzeRef.current) {
            captureAndAnalyzeRef.current();
          }
        }, 500);
      }

      // Show success message
      if (showSuccessPopup) {
        const message =
          currentTrackingModeRef.current === "participant"
            ? "AI attendance monitoring started"
            : `Presence tracking started for ${currentTrackingModeRef.current}`;
        showViolationPopup(message, "success");
      }

      return true;
      
    } catch (error) {
      console.error("[START TRACKING] Failed:", error);
      
      let errorMessage = error.message;
      
      if (error.message.includes("405")) {
        errorMessage = "Server configuration error (HTTP 405). Check nginx config.";
      } else if (error.message.includes("404")) {
        errorMessage = "API endpoint not found (HTTP 404).";
      } else if (error.message.includes("500")) {
        errorMessage = "Server error (HTTP 500). Please try again later.";
      } else if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
        errorMessage = "Network error. Please check your connection.";
      }
      
      showViolationPopup(`Failed to start: ${errorMessage}`, "error");
      return false;
    } finally {
      // ✅ FIXED: Always reset the flag
      startTrackingInProgressRef.current = false;
    }
  }, [
    meetingId,
    userId,
    userName,
    videoReady,
    initializeCamera,
    showViolationPopup,
    showSuccessPopup,
    effectiveRole,
    isHost,
    isCoHost,
    shouldDetectViolations,
    apiCall,
  ]);

  // ==================== STOP TRACKING ====================
  const stopTracking = useCallback(async () => {
    try {
      setIsTracking(false);
      isTrackingRef.current = false;

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (breakTimerRef.current) {
        clearInterval(breakTimerRef.current);
        breakTimerRef.current = null;
      }

      if (cameraPromptTimerRef.current) {
        clearTimeout(cameraPromptTimerRef.current);
        cameraPromptTimerRef.current = null;
      }

      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }

      if (meetingId && userId && !isSessionTerminatedRef.current) {
        await apiCall("/stop/", "POST", {
          meeting_id: meetingId,
          user_id: userId,
          reason: "manual_stop",
        });
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        setVideoReady(false);
      }
    } catch (error) {
      console.error("[STOP TRACKING] Failed:", error);
    }
  }, [meetingId, userId, apiCall]);

  // ==================== EFFECTS ====================
  
  // Role transition effect
  useEffect(() => {
    const newMode = determineTrackingMode();
    if (newMode !== currentTrackingMode) {
      handleRoleTransition(newMode);
    }
  }, [determineTrackingMode, currentTrackingMode, handleRoleTransition]);

  // Camera enable prompt effect
  useEffect(() => {
    if (cameraPromptTimerRef.current) {
      clearTimeout(cameraPromptTimerRef.current);
      cameraPromptTimerRef.current = null;
    }

    if (
      isOnBreak ||
      isSessionTerminated ||
      isSessionPermanentlyEnded ||
      currentTrackingMode !== "participant" ||
      !sessionActive ||
      propCameraEnabled
    ) {
      setShowCameraEnablePrompt(false);
      setCameraPromptDismissed(false);
      return;
    }

    if (
      !propCameraEnabled &&
      currentTrackingMode === "participant" &&
      sessionActive &&
      !isSessionTerminated &&
      !isSessionPermanentlyEnded &&
      !isOnBreak &&
      !cameraPromptDismissed
    ) {
      cameraPromptTimerRef.current = setTimeout(() => {
        if (
          mountedRef.current &&
          !propCameraEnabled &&
          !isOnBreakRef.current &&
          !isSessionTerminatedRef.current &&
          !cameraPromptDismissed
        ) {
          setShowCameraEnablePrompt(true);
        }
      }, AttendanceConfig.CAMERA_PROMPT_DELAY);
    }

    return () => {
      if (cameraPromptTimerRef.current) {
        clearTimeout(cameraPromptTimerRef.current);
        cameraPromptTimerRef.current = null;
      }
    };
  }, [
    propCameraEnabled,
    isOnBreak,
    isSessionTerminated,
    isSessionPermanentlyEnded,
    currentTrackingMode,
    sessionActive,
    cameraPromptDismissed,
  ]);

  // Camera state sync effect
  useEffect(() => {
    const prevEnabled = cameraEnabledRef.current;

    setCameraEnabled(propCameraEnabled);
    cameraEnabledRef.current = propCameraEnabled;

    if (prevEnabled !== propCameraEnabled) {
      if (!propCameraEnabled) {
        setCurrentViolations([]);

        if (isTrackingRef.current && !isOnBreakRef.current && currentTrackingModeRef.current === "participant") {
          setIsTracking(false);
          isTrackingRef.current = false;
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          showViolationPopup("Tracking paused - camera disabled", "warning");
        }
      } else {
        setShowCameraEnablePrompt(false);
        setCameraPromptDismissed(false);
        
        if (
          !isTrackingRef.current &&
          !isOnBreakRef.current &&
          isSessionActiveRef.current &&
          !isSessionTerminatedRef.current
        ) {
          const message =
            currentTrackingModeRef.current === "participant"
              ? "Camera enabled - resuming detection"
              : "Camera enabled - presence tracking active";
          showViolationPopup(message, "info");

          setIsTracking(true);
          isTrackingRef.current = true;

          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          intervalRef.current = setInterval(() => {
            if (mountedRef.current && 
                !isSessionTerminatedRef.current &&
                captureAndAnalyzeRef.current) {
              captureAndAnalyzeRef.current();
            }
          }, AttendanceConfig.DETECTION_INTERVAL);

          setTimeout(() => {
            if (mountedRef.current && 
                !isSessionTerminatedRef.current && 
                !isOnBreakRef.current &&
                captureAndAnalyzeRef.current) {
              captureAndAnalyzeRef.current();
            }
          }, 1000);
        }
      }
    }
  }, [propCameraEnabled, showViolationPopup, currentTrackingMode]);

  // Backend sync interval effect
  useEffect(() => {
    if (!meetingId || !userId || isSessionTerminated) return;

    // Clear existing sync interval
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }

    const syncInterval = isOnBreak 
      ? AttendanceConfig.SYNC_INTERVAL_BREAK 
      : AttendanceConfig.SYNC_INTERVAL_NORMAL;

    syncIntervalRef.current = setInterval(syncWithBackend, syncInterval);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [meetingId, userId, isSessionTerminated, isOnBreak, syncWithBackend]);

  // ✅ FIXED: Initialization effect with proper cleanup
  useEffect(() => {
    mountedRef.current = true;

    if (isSessionTerminated || isSessionPermanentlyEnded) {
      return;
    }

    let initTimeoutId = null;

    if (meetingId && userId) {
      const initialize = async () => {
        if (!mountedRef.current || isSessionTerminatedRef.current) return;
        
        try {
          await syncWithBackend();
          
          if (!mountedRef.current || isSessionTerminatedRef.current) return;
          
          await startTracking();
        } catch (error) {
          console.error("[INIT] Error:", error);
        }
      };

      initTimeoutId = setTimeout(initialize, 500);
    }

    return () => {
      if (initTimeoutId) {
        clearTimeout(initTimeoutId);
      }
      // ✅ FIXED: Clean up interval on effect re-run
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [meetingId, userId, isSessionTerminated, isSessionPermanentlyEnded]);

  // ✅ FIXED: Cleanup effect on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (breakTimerRef.current) {
        clearInterval(breakTimerRef.current);
        breakTimerRef.current = null;
      }
      if (cameraPromptTimerRef.current) {
        clearTimeout(cameraPromptTimerRef.current);
        cameraPromptTimerRef.current = null;
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
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
      case "active":
        return <CheckCircle {...iconProps} sx={{ ...iconProps.sx, color: "#4caf50" }} />;
      case "warning":
        return <Warning {...iconProps} sx={{ ...iconProps.sx, color: "#ff9800" }} />;
      case "violation":
        return <ErrorIcon {...iconProps} sx={{ ...iconProps.sx, color: "#f44336" }} />;
      case "break":
        return <Coffee {...iconProps} sx={{ ...iconProps.sx, color: "#2196f3" }} />;
      case "initializing":
        return <CircularProgress size={16} sx={{ color: "#ffc107" }} />;
      case "host_tracking":
        return <CheckCircle {...iconProps} sx={{ ...iconProps.sx, color: "#4caf50" }} />;
      case "ended":
        return <ErrorIcon {...iconProps} sx={{ ...iconProps.sx, color: "#666" }} />;
      case "terminated":
        return <ErrorIcon {...iconProps} sx={{ ...iconProps.sx, color: "#f44336" }} />;
      case "unauthorized":
        return <PersonOff {...iconProps} sx={{ ...iconProps.sx, color: "#9c27b0" }} />;
      default:
        return <CheckCircle {...iconProps} sx={{ ...iconProps.sx, color: "#4caf50" }} />;
    }
  }, [getStatus]);

  // ==================== RENDER ====================
  if (!meetingId || !userId) return null;

  return (
    <>
      <AttendanceContainer>
        <AttendanceIndicator>
          <CardContent sx={{ p: 2 }}>
            {!minimized ? (
              <>
                {/* Header */}
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {currentTrackingMode === "host" ? (
                      <AdminPanelSettings sx={{ fontSize: 16, color: "#ff9800" }} />
                    ) : currentTrackingMode === "cohost" ? (
                      <SupervisorAccount sx={{ fontSize: 16, color: "#ff5722" }} />
                    ) : (
                      getStatusIcon()
                    )}
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: "0.85rem" }}>
                      {currentTrackingMode === "host" ? "Meeting Host" : currentTrackingMode === "cohost" ? "Meeting Co-Host" : "AI Monitor"}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    {!isSessionTerminated && (cameraEnabled ? (
                        <Tooltip title="Camera Active">
                          <Videocam sx={{ fontSize: 16, color: "#4caf50" }} />
                        </Tooltip>
                      ) : (
                        <Tooltip title="Camera Disabled">
                          <VideocamOff sx={{ fontSize: 16, color: "#f44336" }} />
                        </Tooltip>
                      ))}
                     {onToggleMinimized && (
                      <IconButton size="small" onClick={onToggleMinimized} sx={{ color: "white" }}>
                        <VisibilityOff sx={{ fontSize: 16 }} />
                      </IconButton>
                    )}
                  </Box>
                </Box>

                {currentTrackingMode === "host" || currentTrackingMode === "cohost" ? (
                  <>
                     <StatusChip label={currentTrackingMode === "host" ? "HOST PRIVILEGES" : "CO-HOST PRIVILEGES"} status="excluded" size="small" sx={{ mb: 1.5 }} />
                     <Alert severity="info" sx={{ mb: 1.5, fontSize: "0.75rem" }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, display: "block", color: "#2196f3" }}>
                           {currentTrackingMode === "host" ? "HOST PRIVILEGES:" : "CO-HOST PRIVILEGES:"}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: "0.7rem", color: "#90caf9", display: "block" }}>
                           Presence tracking active
                        </Typography>
                     </Alert>
                  </>
                ) : (
                  <>
                    {/* Status Chip */}
                     <StatusChip
                        label={
                        isOnBreak ? "ON BREAK" :
                        isSessionTerminated ? "TERMINATED" :
                        isAuthBlocked ? "BLOCKED" :
                        authWarningCount > 0 ? `AUTH WARN ${authWarningCount}/3` :
                        `Active • ${Math.round(attendanceData.attendancePercentage)}%`
                        }
                        status={getStatus()}
                        size="small"
                        sx={{ mb: 1.5 }}
                    />

                    {/* Warnings Progress Bars */}
                    {!isSessionTerminated && currentTrackingMode === "participant" && (
                      <>
                         {/* Behavioral */}
                         <Box sx={{ mb: 1 }}>
                            <Typography variant="caption" sx={{ color: "#ff9800", fontSize: "0.7rem" }}>
                               Behavioral: {warningCount}/{AttendanceConfig.MAX_WARNING_MESSAGES}
                            </Typography>
                            <LinearProgress variant="determinate" value={(warningCount/AttendanceConfig.MAX_WARNING_MESSAGES)*100} color="warning" sx={{height: 4}} />
                         </Box>
                         {/* Identity */}
                         <Box sx={{ mb: 1 }}>
                            <Typography variant="caption" sx={{ color: "#9c27b0", fontSize: "0.7rem" }}>
                               Identity: {authWarningCount}/3
                            </Typography>
                            <LinearProgress variant="determinate" value={(authWarningCount/3)*100} color="secondary" sx={{height: 4}} />
                         </Box>
                      </>
                    )}

                    {/* Violations Text List (Passive) */}
                    {currentViolations.length > 0 && (
                         <Alert severity="warning" sx={{ mt: 1, py: 0, fontSize: '0.75rem' }}>
                            {currentViolations[0]}
                         </Alert>
                    )}

                    <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center", mt: 1 }}>
                      {!isOnBreak && canTakeBreak && (
                        <Tooltip title={`Take break (${Math.floor(breakTimeRemaining)}s available)`}>
                          <span>
                            <IconButton
                              size="small"
                              onClick={handleTakeBreak}
                              disabled={isProcessingBreak}
                              sx={{
                                color: "#2196f3",
                                backgroundColor: "rgba(33,150,243,0.1)",
                                "&:hover": { backgroundColor: "rgba(33,150,243,0.2)" },
                                "&:disabled": { color: "#666", backgroundColor: "rgba(0,0,0,0.1)" },
                              }}
                            >
                              <Coffee sx={{ fontSize: 27 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                      {isOnBreak && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleEndBreak(false)}
                          disabled={isProcessingBreak || autoResumeInProgressRef.current}
                          startIcon={<Stop />}
                          sx={{
                            fontSize: "0.65rem",
                            color: "#f44336",
                            borderColor: "#f44336",
                            "&:hover": { backgroundColor: "rgba(244,67,54,0.1)" },
                          }}
                        >
                          End Break ({breakTimeLeft}s)
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

      {/* Hidden Video Elements */}
      {!isSessionTerminated && (
        <>
          <video ref={videoRef} autoPlay muted playsInline style={{ display: "none" }} />
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </>
      )}

      {/* TOAST NOTIFICATIONS (Snackbar) */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={5000}
        onClose={handleToastClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
            onClose={handleToastClose} 
            severity={toastSeverity === "violation" ? "warning" : toastSeverity} 
            variant={toastVariant}
            sx={{ width: '100%', boxShadow: 3, fontWeight: 600 }}
            icon={
                toastMessage.includes("Identity") ? <PersonOff /> : 
                toastSeverity === "error" ? <ErrorIcon /> :
                toastSeverity === "warning" ? <Warning /> : undefined
            }
        >
          {toastMessage}
        </Alert>
      </Snackbar>

      {/* CAMERA ENABLE PROMPT */}
      <CameraPromptDialog
        open={showCameraEnablePrompt}
        disableEscapeKeyDown={false}
        onClose={() => {
          setShowCameraEnablePrompt(false);
          setCameraPromptDismissed(true);
        }}
      >
        <DialogTitle sx={{ textAlign: 'center', pb: 1, pt: 3 }} component="div">
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            mb: 2
          }}>
            <IconButton
              aria-label="close"
              onClick={() => {
                setShowCameraEnablePrompt(false);
                setCameraPromptDismissed(true);
              }}
              sx={{
                position: 'absolute',
                right: 8,
                top: 8,
                color: '#888',
                '&:hover': { color: '#555' }
              }}
            >
              <Close />
            </IconButton>
            <Box sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 152, 0, 0.1)',
              border: '2px solid #FF9800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <VideocamOutlined sx={{ fontSize: 36, color: '#FF9800' }} />
            </Box>
          </Box>
          <Typography variant="h6" component="span" sx={{ fontWeight: 700, color: '#FF9800' }}>
            Camera Disabled
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', px: 4, pb: 2 }}>
          <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
            Attendance tracking is paused because your camera is disabled.
          </Alert>
          <Typography variant="body2" sx={{ color: '#555', mb: 2 }}>
            To resume AI-powered attendance monitoring and tracking, please enable your camera.
          </Typography>
          <Typography variant="caption" sx={{ color: '#999', display: 'block' }}>
            Your attendance percentage: <strong>{Math.round(attendanceData.attendancePercentage)}%</strong>
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3, px: 3, gap: 1 }}>
          <Button
            variant="contained"
            onClick={handleEnableCameraFromPrompt}
            startIcon={<Videocam />}
            sx={{ 
              backgroundColor: '#FF9800',
              color: 'white',
              fontWeight: 600,
              '&:hover': { backgroundColor: '#F57C00' }
            }}
          >
            Enable Camera
          </Button>
        </DialogActions>
      </CameraPromptDialog>

      {/* TERMINATION POPUP */}
      <AttendancePopup
        open={showTerminationPopup}
        message={terminationMessage}
        type="error"
        onClose={() => {}}
        hideCloseButton={true}
        attendanceData={attendanceData}
        faceAuthStatus={faceAuthStatus}
      />
    </>
  );
};

export default AttendanceTracker;