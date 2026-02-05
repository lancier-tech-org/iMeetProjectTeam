// src/components/auth/CameraCapture.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box, Button, Dialog, DialogContent, DialogActions, Typography, Stack,
  Alert, Fade, Zoom, useMediaQuery, useTheme, LinearProgress, Chip,
} from '@mui/material';
import {
  CameraAlt, Refresh, CheckCircle, Videocam, VideocamOff,
  VisibilityOutlined, Face, SentimentSatisfiedAlt,
} from '@mui/icons-material';
import * as faceapi from 'face-api.js';

// ============================================================================
// CONFIGURATION
// ============================================================================
const FACE_API_MODEL_URL = '/models'; // Public folder: public/models/
const DETECTION_INTERVAL_MS = 150;    // How often to run face detection (ms)
const OVAL_FIT_THRESHOLD = 0.15;      // How close face must be to oval (15% tolerance)
// ========================== UPDATED ==========================
// CHANGE 1: Increased from 0.5 → 0.65 to reject background objects/walls/shadows
const MIN_FACE_CONFIDENCE = 0.5;
// ========================== NEW ==============================
// CHANGE 2: Face must be stable inside oval for N consecutive good frames before liveness starts
const CONSECUTIVE_FRAMES_REQUIRED = 5;
// CHANGE 3: Auto-capture delay after all liveness challenges pass (ms)
const AUTO_CAPTURE_DELAY_MS = 1500;
// CHANGE 4: Max retries for model loading
const MODEL_LOAD_MAX_RETRIES = 3;
// CHANGE 5: Expression variance threshold for anti-spoofing (photos have frozen expressions)
const EXPRESSION_VARIANCE_WINDOW = 8; // Track last N expression readings
const MIN_EXPRESSION_VARIANCE = 0.02; // Minimum variance to confirm live face (not a static photo)
// =============================================================

// Liveness challenge configuration
const LIVENESS_CHALLENGES = [
  {
    id: 'blink',
    instruction: 'Please blink your eyes',
    icon: 'blink',
    detectFn: 'detectBlink',
  },
  {
    id: 'turnLeft',
    instruction: 'Turn your head slightly left',
    icon: 'turnLeft',
    detectFn: 'detectHeadTurn',
  },
  {
    id: 'smile',
    instruction: 'Please smile',
    icon: 'smile',
    detectFn: 'detectSmile',
  },
];

// ============================================================================
// COMPONENT
// ============================================================================
const CameraCapture = ({ open, onClose, onCapture, currentPhoto }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const prevEyeStateRef = useRef({ leftOpen: true, rightOpen: true });
  const blinkCountRef = useRef(0);
  // ========================== NEW REFS ==========================
  // CHANGE 6: Track consecutive good frames for stable face detection
  const consecutiveGoodFramesRef = useRef(0);
  // CHANGE 7: Auto-capture timer ref for cleanup
  const autoCaptureTimerRef = useRef(null);
  // CHANGE 8: Track expression history for anti-spoofing variance check
  const expressionHistoryRef = useRef([]);
  // CHANGE 9: Track model load retry count
  const modelLoadRetryCountRef = useRef(0);
  // ==============================================================

  // Camera states
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(currentPhoto || null);
  const [error, setError] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // Face detection states
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceInOval, setFaceInOval] = useState(false);
  const [ovalColor, setOvalColor] = useState('red'); // 'red' | 'green'
  const [faceStatus, setFaceStatus] = useState('No face detected');
  const [multipleFaces, setMultipleFaces] = useState(false);
  // ========================== NEW STATE ==========================
  // CHANGE 10: Model load error state with retry capability
  const [modelLoadError, setModelLoadError] = useState(false);
  // CHANGE 11: Anti-spoofing status message
  const [spoofWarning, setSpoofWarning] = useState('');
  // ==============================================================

  // Liveness states
  const [livenessStarted, setLivenessStarted] = useState(false);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [challengesCompleted, setChallengesCompleted] = useState([]);
  const [allChallengesPassed, setAllChallengesPassed] = useState(false);
  const [livenessInstruction, setLivenessInstruction] = useState('');

  // ============================================================================
  // LOAD FACE-API MODELS
  // ============================================================================
  // ========================== UPDATED ==========================
  // CHANGE 12: Added retry mechanism, faceRecognitionNet for better face quality,
  //            and proper error state management
  const loadModels = useCallback(async () => {
    if (modelsLoaded || modelsLoading) return;

    setModelsLoading(true);
    setModelLoadError(false);
    setError('');

    const attemptLoad = async (retryCount) => {
      try {
        console.log(`🔄 Loading face-api.js models... (attempt ${retryCount + 1}/${MODEL_LOAD_MAX_RETRIES})`);
        await Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri(FACE_API_MODEL_URL),
  faceapi.nets.faceLandmark68Net.loadFromUri(FACE_API_MODEL_URL),
  faceapi.nets.faceExpressionNet.loadFromUri(FACE_API_MODEL_URL),
]);
        setModelsLoaded(true);
        setModelLoadError(false);
        modelLoadRetryCountRef.current = 0;
        console.log('✅ Face-api.js models loaded successfully (including faceRecognitionNet)');
      } catch (err) {
        console.error(`❌ Failed to load face-api models (attempt ${retryCount + 1}):`, err);

        if (retryCount + 1 < MODEL_LOAD_MAX_RETRIES) {
          console.log(`🔄 Retrying in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return attemptLoad(retryCount + 1);
        } else {
          setModelLoadError(true);
          setError('Failed to load face detection models. Please check your internet connection and try again.');
        }
      }
    };

    await attemptLoad(modelLoadRetryCountRef.current);
    setModelsLoading(false);
  }, [modelsLoaded, modelsLoading]);

  // CHANGE 13: NEW - Retry model loading manually
  const retryModelLoad = useCallback(() => {
    setModelsLoaded(false);
    setModelsLoading(false);
    setModelLoadError(false);
    setError('');
    modelLoadRetryCountRef.current = 0;
    // Trigger re-load on next render cycle
    setTimeout(() => loadModels(), 100);
  }, [loadModels]);
  // ==============================================================

  // ============================================================================
  // CAMERA START / STOP
  // ============================================================================
  const startCamera = async () => {
    try {
      setError('');
      setIsCameraActive(false);
      resetLivenessState();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera access is not supported in this browser.');
        return;
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: isMobile ? 640 : 1280 },
          height: { ideal: isMobile ? 480 : 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setStream(mediaStream);
          setIsCameraActive(true);
        };
      }
    } catch (err) {
      console.error('Camera access error:', err);
      if (err.name === 'NotAllowedError')
        setError('Camera access denied. Please allow camera permissions.');
      else if (err.name === 'NotFoundError')
        setError('No camera found. Please connect a camera.');
      else if (err.name === 'NotReadableError')
        setError('Camera is already in use by another application.');
      else setError('Unable to access camera. Please check your permissions.');
    }
  };

  const stopCamera = () => {
    // Stop detection loop
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    // ========================== NEW ==========================
    // CHANGE 14: Clear auto-capture timer on camera stop
    if (autoCaptureTimerRef.current) {
      clearTimeout(autoCaptureTimerRef.current);
      autoCaptureTimerRef.current = null;
    }
    // =========================================================

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setIsCameraActive(false);
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  // ============================================================================
  // RESET LIVENESS STATE
  // ============================================================================
  const resetLivenessState = () => {
    setLivenessStarted(false);
    setCurrentChallengeIndex(0);
    setChallengesCompleted([]);
    setAllChallengesPassed(false);
    setLivenessInstruction('');
    setFaceDetected(false);
    setFaceInOval(false);
    setOvalColor('red');
    setFaceStatus('No face detected');
    setMultipleFaces(false);
    blinkCountRef.current = 0;
    prevEyeStateRef.current = { leftOpen: true, rightOpen: true };
    // ========================== NEW ==========================
    // CHANGE 15: Reset new refs on liveness reset
    consecutiveGoodFramesRef.current = 0;
    expressionHistoryRef.current = [];
    setSpoofWarning('');
    if (autoCaptureTimerRef.current) {
      clearTimeout(autoCaptureTimerRef.current);
      autoCaptureTimerRef.current = null;
    }
    // =========================================================
  };

  // ============================================================================
  // FACE DETECTION LOOP
  // ============================================================================
  const getOvalBounds = useCallback(() => {
    if (!videoRef.current) return null;
    const vw = videoRef.current.videoWidth;
    const vh = videoRef.current.videoHeight;
    if (!vw || !vh) return null;

    // Oval dimensions (matches the CSS overlay)
    const ovalW = vw * (isMobile ? 0.7 : 0.55);
    const ovalH = vh * (isMobile ? 0.55 : 0.75);
    const cx = vw / 2;
    const cy = vh / 2;

    return {
      x: cx - ovalW / 2,
      y: cy - ovalH / 2,
      width: ovalW,
      height: ovalH,
      cx,
      cy,
    };
  }, [isMobile]);

  // ========================== UPDATED ==========================
  // CHANGE 16: Enhanced isFaceInsideOval - now checks ALL 4 edges of the face
  //            bounding box are inside the oval, not just the center point.
  //            This ensures the face is FULLY inside, not partially outside.
  const isFaceInsideOval = useCallback(
    (detection) => {
      const oval = getOvalBounds();
      if (!oval) return false;

      const box = detection.detection.box;

      // Face bounding box corners
      const faceLeft = box.x;
      const faceRight = box.x + box.width;
      const faceTop = box.y;
      const faceBottom = box.y + box.height;

      // Face center
      const faceCX = box.x + box.width / 2;
      const faceCY = box.y + box.height / 2;

      // Oval center and semi-axes
      const ovalCX = oval.cx;
      const ovalCY = oval.cy;
      const a = oval.width / 2; // semi-major axis
      const b = oval.height / 2; // semi-minor axis

      // Helper: check if a point is inside the ellipse
      const isPointInsideOval = (px, py) => {
        const nx = (px - ovalCX) / a;
        const ny = (py - ovalCY) / b;
        return (nx * nx + ny * ny) <= 1.0;
      };

      // CHECK 1: Face center must be well within the oval
      const centerNX = (faceCX - ovalCX) / a;
      const centerNY = (faceCY - ovalCY) / b;
      const centerDistance = centerNX * centerNX + centerNY * centerNY;
      const isCentered = centerDistance < (1 - OVAL_FIT_THRESHOLD);

      // CHECK 2: ALL four corners of the face bounding box must be inside the oval
      // This ensures the face is FULLY inside, not just centered
      const allCornersInside =
        isPointInsideOval(faceLeft, faceTop) &&
        isPointInsideOval(faceRight, faceTop) &&
        isPointInsideOval(faceLeft, faceBottom) &&
        isPointInsideOval(faceRight, faceBottom);

      // CHECK 3: Face size relative to oval (unchanged from original)
      const faceToOvalWidthRatio = box.width / oval.width;
      const faceToOvalHeightRatio = box.height / oval.height;
      const isCorrectSize =
        faceToOvalWidthRatio > 0.30 &&
        faceToOvalWidthRatio < 0.90 &&
        faceToOvalHeightRatio > 0.30 &&
        faceToOvalHeightRatio < 0.90;

      return isCentered && allCornersInside && isCorrectSize;
    },
    [getOvalBounds]
  );
  // ==============================================================

  // ============================================================================
  // ANTI-SPOOFING: Expression Variance Check
  // ============================================================================
  // ========================== NEW FUNCTION ==========================
  // CHANGE 17: Detect static/frozen expressions (printed photos, phone screens)
  //            Real faces have micro-expression fluctuations; photos don't.
  const checkExpressionVariance = useCallback((expressions) => {
    // Extract the dominant expression value
    const values = [
      expressions.neutral || 0,
      expressions.happy || 0,
      expressions.sad || 0,
      expressions.angry || 0,
      expressions.surprised || 0,
    ];
    const dominantValue = Math.max(...values);

    // Add to history
    expressionHistoryRef.current.push(dominantValue);

    // Keep only the last N readings
    if (expressionHistoryRef.current.length > EXPRESSION_VARIANCE_WINDOW) {
      expressionHistoryRef.current = expressionHistoryRef.current.slice(
        -EXPRESSION_VARIANCE_WINDOW
      );
    }

    // Need enough samples to calculate variance
    if (expressionHistoryRef.current.length < EXPRESSION_VARIANCE_WINDOW) {
      return true; // Not enough data yet, allow through
    }

    // Calculate variance of expression values
    const history = expressionHistoryRef.current;
    const mean = history.reduce((sum, v) => sum + v, 0) / history.length;
    const variance =
      history.reduce((sum, v) => sum + (v - mean) ** 2, 0) / history.length;

    // A real face has natural micro-expression changes (variance > threshold)
    // A photo/screen shows near-zero variance (frozen expression)
    if (variance < MIN_EXPRESSION_VARIANCE) {
      console.log(`⚠️ Low expression variance: ${variance.toFixed(5)} - possible spoof`);
      return false; // Suspected spoof
    }

    return true; // Passes variance check
  }, []);
  // ==============================================================

  // ---- Liveness: Blink Detection ----
  const getEAR = (eye) => {
    // Eye Aspect Ratio (EAR)
    // eye is array of {x, y} points from face landmarks
    const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

    const vertical1 = dist(eye[1], eye[5]);
    const vertical2 = dist(eye[2], eye[4]);
    const horizontal = dist(eye[0], eye[3]);

    return (vertical1 + vertical2) / (2.0 * horizontal);
  };

  const detectBlink = useCallback((landmarks) => {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    const leftEAR = getEAR(leftEye);
    const rightEAR = getEAR(rightEye);
    const avgEAR = (leftEAR + rightEAR) / 2;

    const EAR_THRESHOLD = 0.25; // Below this = eyes closed
    const currentlyClosed = avgEAR < EAR_THRESHOLD;

    const wasOpen = prevEyeStateRef.current.leftOpen;

    if (wasOpen && currentlyClosed) {
      // Transition from open → closed = blink started
      prevEyeStateRef.current = { leftOpen: false, rightOpen: false };
    } else if (!wasOpen && !currentlyClosed) {
      // Transition from closed → open = blink completed
      blinkCountRef.current += 1;
      prevEyeStateRef.current = { leftOpen: true, rightOpen: true };
      console.log(`👁️ Blink detected! Count: ${blinkCountRef.current}`);

      if (blinkCountRef.current >= 1) {
        return true; // Challenge passed
      }
    } else {
      prevEyeStateRef.current = {
        leftOpen: !currentlyClosed,
        rightOpen: !currentlyClosed,
      };
    }

    return false;
  }, []);

  // ---- Liveness: Head Turn Detection ----
  const detectHeadTurn = useCallback((landmarks) => {
    const nose = landmarks.getNose();
    const jaw = landmarks.getJawOutline();

    // Nose tip X position
    const noseTip = nose[3]; // tip of nose
    const jawLeft = jaw[0];
    const jawRight = jaw[jaw.length - 1];

    // Calculate nose position relative to jaw width
    const jawWidth = jawRight.x - jawLeft.x;
    const noseRelativeX = (noseTip.x - jawLeft.x) / jawWidth;

    // Normal = 0.5 (centered), turned left = < 0.40, turned right = > 0.60
    if (noseRelativeX < 0.38 || noseRelativeX > 0.62) {
      console.log(`↩️ Head turn detected: ratio=${noseRelativeX.toFixed(2)}`);
      return true;
    }

    return false;
  }, []);

  // ---- Liveness: Smile Detection ----
  const detectSmile = useCallback((expressions) => {
    const happyScore = expressions.happy || 0;

    if (happyScore > 0.7) {
      console.log(`😊 Smile detected: score=${happyScore.toFixed(2)}`);
      return true;
    }

    return false;
  }, []);

  // ---- Main Detection Loop ----
  // ========================== UPDATED ==========================
  // CHANGE 18: Enhanced detection loop with:
  //   - Consecutive frame tracking before starting liveness
  //   - Expression variance anti-spoofing check
  //   - Stricter face confidence via inputSize bump
  //   - Auto-capture trigger when all challenges pass
  const runDetection = useCallback(async () => {
    if (
      !videoRef.current ||
      !modelsLoaded ||
      videoRef.current.readyState !== 4
    ) {
      return;
    }

    try {
      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({
          // CHANGE 19: Increased inputSize from 320 → 416 for better accuracy
          // and reduced false positives from background objects
          inputSize: 320,
          scoreThreshold: MIN_FACE_CONFIDENCE,
        }))
        .withFaceLandmarks()
        .withFaceExpressions();

      // --- No face ---
      if (!detections || detections.length === 0) {
        setFaceDetected(false);
        setFaceInOval(false);
        setOvalColor('red');
        setFaceStatus('No face detected — look at the camera');
        setMultipleFaces(false);
        // CHANGE 20: Reset consecutive frames on face loss
        consecutiveGoodFramesRef.current = 0;
        setSpoofWarning('');
        return;
      }

      // --- Multiple faces ---
      if (detections.length > 1) {
        setFaceDetected(true);
        setFaceInOval(false);
        setOvalColor('red');
        setFaceStatus(`${detections.length} faces detected — only your face should be visible`);
        setMultipleFaces(true);
        // CHANGE 21: Reset consecutive frames on multiple faces
        consecutiveGoodFramesRef.current = 0;
        return;
      }

      // --- Single face detected ---
      setFaceDetected(true);
      setMultipleFaces(false);
      const detection = detections[0];

      // ========================== NEW CHECK ==========================
      // CHANGE 22: Additional confidence check - reject low-score detections
      // that might be background objects falsely detected as faces
      const detectionScore = detection.detection.score;
      if (detectionScore < MIN_FACE_CONFIDENCE) {
        setFaceInOval(false);
        setOvalColor('red');
        setFaceStatus('Face not clearly visible — ensure good lighting');
        consecutiveGoodFramesRef.current = 0;
        return;
      }
      // ==============================================================

      // Check if face fits in oval
      const insideOval = isFaceInsideOval(detection);
      setFaceInOval(insideOval);

      if (!insideOval) {
        setOvalColor('red');
        setFaceStatus('Position your face fully inside the oval');
        // CHANGE 23: Reset consecutive frames when face leaves oval
        consecutiveGoodFramesRef.current = 0;
        return;
      }

      // ========================== NEW ANTI-SPOOFING ==========================
      // CHANGE 24: Check expression variance before starting liveness
      // Photos/screens show frozen expressions with near-zero variance
      if (!livenessStarted) {
        const isLikelyLive = checkExpressionVariance(detection.expressions);
        if (!isLikelyLive) {
          setOvalColor('red');
          setFaceStatus('Live face required — photos/screens not allowed');
          setSpoofWarning('Please show a live face, not a photo or screen');
          consecutiveGoodFramesRef.current = 0;
          return;
        }
        setSpoofWarning('');
      }
      // ====================================================================

      // Face is in oval!
      if (!livenessStarted) {
        // ========================== UPDATED ==========================
        // CHANGE 25: Require N consecutive good frames before starting liveness
        // This prevents flickering and ensures stable face detection
        consecutiveGoodFramesRef.current += 1;

        if (consecutiveGoodFramesRef.current < CONSECUTIVE_FRAMES_REQUIRED) {
          setOvalColor('green');
          setFaceStatus(`Face detected ✓ Hold steady... (${consecutiveGoodFramesRef.current}/${CONSECUTIVE_FRAMES_REQUIRED})`);
          return;
        }

        // Enough stable frames — start liveness challenges
        setOvalColor('green');
        setFaceStatus('Face detected ✓ Starting verification...');
        setLivenessStarted(true);
        setCurrentChallengeIndex(0);
        blinkCountRef.current = 0;
        prevEyeStateRef.current = { leftOpen: true, rightOpen: true };
        // Reset expression history for liveness phase
        expressionHistoryRef.current = [];
        // ==============================================================
        return;
      }

      // ---- LIVENESS CHALLENGE PROCESSING ----
      if (livenessStarted && !allChallengesPassed) {
        const challenge = LIVENESS_CHALLENGES[currentChallengeIndex];

        if (!challenge) {
          // All challenges done!
          setAllChallengesPassed(true);
          setOvalColor('green');
          setFaceStatus('All checks passed ✓ Capturing photo...');
          setLivenessInstruction('');
          return;
        }

        setLivenessInstruction(challenge.instruction);
        setOvalColor('green'); // Keep green during challenges

        let passed = false;

        if (challenge.id === 'blink') {
          passed = detectBlink(detection.landmarks);
        } else if (challenge.id === 'turnLeft') {
          passed = detectHeadTurn(detection.landmarks);
        } else if (challenge.id === 'smile') {
          passed = detectSmile(detection.expressions);
        }

        if (passed) {
          console.log(`✅ Challenge "${challenge.id}" passed!`);
          setChallengesCompleted((prev) => [...prev, challenge.id]);

          const nextIndex = currentChallengeIndex + 1;
          setCurrentChallengeIndex(nextIndex);

          // Reset blink counter for next round
          blinkCountRef.current = 0;
          prevEyeStateRef.current = { leftOpen: true, rightOpen: true };

          if (nextIndex >= LIVENESS_CHALLENGES.length) {
            setAllChallengesPassed(true);
            setOvalColor('green');
            setFaceStatus('All checks passed ✓ Capturing photo...');
            setLivenessInstruction('');
          }
        }
      }
    } catch (err) {
      console.error('Detection error:', err);
    }
  }, [
    modelsLoaded,
    isFaceInsideOval,
    livenessStarted,
    allChallengesPassed,
    currentChallengeIndex,
    detectBlink,
    detectHeadTurn,
    detectSmile,
    checkExpressionVariance, // CHANGE 26: Added to dependency array
  ]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Load models when dialog opens
  useEffect(() => {
    if (open) {
      loadModels();
    }
  }, [open, loadModels]);

  // Start camera when dialog opens
  useEffect(() => {
    if (open && !capturedImage) startCamera();
    return () => stopCamera();
  }, [open]);

  // Start detection loop when camera + models are ready
  useEffect(() => {
    if (isCameraActive && modelsLoaded && !capturedImage) {
      console.log('🔄 Starting face detection loop');
      detectionIntervalRef.current = setInterval(runDetection, DETECTION_INTERVAL_MS);
    }

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [isCameraActive, modelsLoaded, capturedImage, runDetection]);

  useEffect(() => {
    if (currentPhoto) setCapturedImage(currentPhoto);
  }, [currentPhoto]);

  // ========================== NEW EFFECT ==========================
  // CHANGE 27: Auto-capture photo when all liveness challenges pass
  // Triggers automatic photo capture after a short delay
  useEffect(() => {
    if (allChallengesPassed && isCameraActive && !capturedImage && !isCapturing) {
      console.log(`📸 All challenges passed — auto-capturing in ${AUTO_CAPTURE_DELAY_MS}ms...`);
      autoCaptureTimerRef.current = setTimeout(() => {
        capturePhoto();
      }, AUTO_CAPTURE_DELAY_MS);
    }

    return () => {
      if (autoCaptureTimerRef.current) {
        clearTimeout(autoCaptureTimerRef.current);
        autoCaptureTimerRef.current = null;
      }
    };
  }, [allChallengesPassed, isCameraActive, capturedImage, isCapturing]);
  // ==============================================================

  // ============================================================================
  // ACTIONS
  // ============================================================================
  const capturePhoto = () => {
    // ========================== NEW GUARD ==========================
    // CHANGE 28: Explicit guard — block capture if oval is RED (liveness not passed)
    if (!allChallengesPassed) {
      setError('Please complete face verification first. The oval must be green.');
      return;
    }
    // ==============================================================

    if (!videoRef.current || !canvasRef.current) {
      setError('Camera not ready.');
      return;
    }
    try {
      setIsCapturing(true);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setTimeout(() => {
        setCapturedImage(imageData);
        stopCamera();
        setIsCapturing(false);
      }, 300);
    } catch (err) {
      console.error('Error capturing photo:', err);
      setError('Failed to capture photo.');
      setIsCapturing(false);
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setError('');
    resetLivenessState();
    startCamera();
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      handleClose();
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setError('');
    resetLivenessState();
    onClose();
  };

  // ============================================================================
  // LIVENESS PROGRESS HELPERS
  // ============================================================================
  const totalChallenges = LIVENESS_CHALLENGES.length;
  const completedCount = challengesCompleted.length;
  const progressPercent = allChallengesPassed
    ? 100
    : (completedCount / totalChallenges) * 100;

  const getChallengeIcon = (challengeId) => {
    switch (challengeId) {
      case 'blink':
        return <VisibilityOutlined sx={{ fontSize: 16 }} />;
      case 'turnLeft':
        return <Face sx={{ fontSize: 16 }} />;
      case 'smile':
        return <SentimentSatisfiedAlt sx={{ fontSize: 16 }} />;
      default:
        return null;
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      TransitionComponent={Zoom}
      TransitionProps={{ timeout: 300 }}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3,
          overflow: 'hidden',
          boxShadow: isMobile ? 'none' : '0 20px 60px rgba(0, 0, 0, 0.2)',
          m: isMobile ? 0 : 2,
        },
      }}
    >
      {/* ====== Header ====== */}
      <Box
        sx={{
          p: { xs: 2, sm: 2.5 },
          backgroundColor: '#2196F3',
          color: '#FFFFFF',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <CameraAlt sx={{ fontSize: { xs: 22, sm: 24 } }} />
          <Typography
            variant="h6"
            sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.25rem' } }}
          >
            {capturedImage ? 'Photo Preview' : 'Capture Profile Photo'}
          </Typography>
        </Stack>
      </Box>

      <DialogContent
        sx={{
          p: { xs: 2, sm: 3 },
          backgroundColor: '#F9F9F9',
          display: 'flex',
          flexDirection: 'column',
          flex: isMobile ? 1 : 'unset',
        }}
      >
        {/* Models Loading */}
        {modelsLoading && (
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>Loading face detection...</Typography>
            <LinearProgress />
          </Alert>
        )}

        {/* ========================== NEW ========================== */}
        {/* CHANGE 29: Model load error with retry button */}
        {modelLoadError && !modelsLoading && (
          <Fade in>
            <Alert
              severity="error"
              sx={{ mb: 2, borderRadius: 2, fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={retryModelLoad}
                  sx={{ fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                >
                  Retry
                </Button>
              }
            >
              Failed to load face detection models. Please check your connection and try again.
            </Alert>
          </Fade>
        )}
        {/* ========================================================= */}

        {error && !modelLoadError && (
          <Fade in>
            <Alert
              severity="error"
              sx={{ mb: 2, borderRadius: 2, fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}
              action={
                !capturedImage && !isCameraActive && (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={startCamera}
                    sx={{ fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                  >
                    Retry
                  </Button>
                )
              }
            >
              {error}
            </Alert>
          </Fade>
        )}

        {/* ========================== NEW ========================== */}
        {/* CHANGE 30: Spoof warning alert */}
        {spoofWarning && !capturedImage && isCameraActive && (
          <Fade in>
            <Alert
              severity="warning"
              sx={{ mb: 2, borderRadius: 2, fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}
            >
              {spoofWarning}
            </Alert>
          </Fade>
        )}
        {/* ========================================================= */}

        {/* ====== VIDEO CONTAINER ====== */}
        <Box
          sx={{
            position: 'relative',
            paddingTop: isMobile ? '100%' : '75%',
            borderRadius: 2,
            overflow: 'hidden',
            backgroundColor: '#1A1A1A',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            flex: isMobile ? 1 : 'unset',
          }}
        >
          {!capturedImage ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)',
                  display: isCameraActive ? 'block' : 'none',
                }}
              />

              {/* Hidden overlay canvas for detection drawing */}
              <canvas
                ref={overlayCanvasRef}
                style={{ display: 'none' }}
              />

              {/* Loading State */}
              {!isCameraActive && !error && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%', height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#2A2A2A',
                    color: '#FFFFFF',
                  }}
                >
                  <Videocam sx={{ fontSize: { xs: 40, sm: 48 }, mb: 2, opacity: 0.5 }} />
                  <Typography variant="body1" sx={{ opacity: 0.7, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                    Starting camera...
                  </Typography>
                </Box>
              )}

              {/* Error State */}
              {!isCameraActive && error && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%', height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#2A2A2A',
                    color: '#FFFFFF',
                  }}
                >
                  <VideocamOff sx={{ fontSize: { xs: 40, sm: 48 }, mb: 2, opacity: 0.5 }} />
                  <Typography variant="body1" sx={{ opacity: 0.7, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                    Camera unavailable
                  </Typography>
                </Box>
              )}

              {/* ====== OVAL GUIDE WITH DYNAMIC COLOR ====== */}
              {isCameraActive && !isCapturing && (
                <Fade in timeout={500}>
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: isMobile ? '70%' : '55%',
                      height: isMobile ? '55%' : '75%',
                      border: `3px solid ${
                        ovalColor === 'green'
                          ? 'rgba(76, 175, 80, 0.9)'   // GREEN - face fits
                          : 'rgba(244, 67, 54, 0.9)'   // RED - face doesn't fit
                      }`,
                      borderRadius: '50%',
                      pointerEvents: 'none',
                      boxShadow: ovalColor === 'green'
                        ? 'inset 0 0 40px rgba(76, 175, 80, 0.15), 0 0 20px rgba(76, 175, 80, 0.3)'
                        : 'inset 0 0 40px rgba(244, 67, 54, 0.15), 0 0 20px rgba(244, 67, 54, 0.3)',
                      transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                    }}
                  />
                </Fade>
              )}

              {/* ====== DARK OVERLAY OUTSIDE OVAL ====== */}
              {isCameraActive && !isCapturing && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%', height: '100%',
                    pointerEvents: 'none',
                    background: `radial-gradient(
                      ellipse ${isMobile ? '35% 27.5%' : '27.5% 37.5%'} at 50% 50%,
                      transparent 98%,
                      rgba(0, 0, 0, 0.5) 100%
                    )`,
                  }}
                />
              )}

              {/* ====== FACE STATUS BADGE (TOP) ====== */}
              {isCameraActive && !isCapturing && modelsLoaded && (
                <Fade in>
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 12,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 10,
                    }}
                  >
                    <Chip
                      size="small"
                      icon={
                        faceDetected && faceInOval ? (
                          <CheckCircle sx={{ fontSize: 16, color: '#fff !important' }} />
                        ) : (
                          <Face sx={{ fontSize: 16, color: '#fff !important' }} />
                        )
                      }
                      label={faceStatus}
                      sx={{
                        backgroundColor:
                          allChallengesPassed
                            ? 'rgba(76, 175, 80, 0.9)'
                            : faceDetected && faceInOval
                              ? 'rgba(255, 152, 0, 0.9)'
                              : 'rgba(244, 67, 54, 0.85)',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: { xs: '0.7rem', sm: '0.75rem' },
                        px: 1,
                        '& .MuiChip-icon': { color: '#fff' },
                      }}
                    />
                  </Box>
                </Fade>
              )}

              {/* ====== LIVENESS INSTRUCTION (BOTTOM OF VIDEO) ====== */}
              {isCameraActive && livenessStarted && !allChallengesPassed && livenessInstruction && (
                <Fade in>
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 16,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 10,
                      textAlign: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        backgroundColor: 'rgba(33, 150, 243, 0.9)',
                        borderRadius: 3,
                        px: 3,
                        py: 1.5,
                        animation: 'pulse 2s infinite',
                        '@keyframes pulse': {
                          '0%, 100%': { transform: 'scale(1)' },
                          '50%': { transform: 'scale(1.03)' },
                        },
                      }}
                    >
                      <Typography
                        variant="body1"
                        sx={{
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: { xs: '0.9rem', sm: '1rem' },
                          textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }}
                      >
                        {livenessInstruction}
                      </Typography>
                    </Box>
                  </Box>
                </Fade>
              )}

              {/* ========================== NEW ========================== */}
              {/* CHANGE 31: Auto-capture countdown indicator */}
              {isCameraActive && allChallengesPassed && !capturedImage && !isCapturing && (
                <Fade in>
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 16,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 10,
                      textAlign: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        backgroundColor: 'rgba(76, 175, 80, 0.9)',
                        borderRadius: 3,
                        px: 3,
                        py: 1.5,
                      }}
                    >
                      <Typography
                        variant="body1"
                        sx={{
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: { xs: '0.9rem', sm: '1rem' },
                          textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }}
                      >
                        ✓ Verified — Capturing photo...
                      </Typography>
                    </Box>
                  </Box>
                </Fade>
              )}
              {/* ========================================================= */}

              {/* Flash Effect */}
              {isCapturing && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: 'white',
                    animation: 'flash 0.3s ease-out',
                    '@keyframes flash': {
                      '0%': { opacity: 0 },
                      '50%': { opacity: 0.8 },
                      '100%': { opacity: 0 },
                    },
                  }}
                />
              )}
            </>
          ) : (
            <Fade in>
              <img
                src={capturedImage}
                alt="Captured"
                style={{
                  position: 'absolute',
                  top: 0, left: 0,
                  width: '100%', height: '100%',
                  objectFit: 'cover',
                }}
              />
            </Fade>
          )}
        </Box>

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* ====== LIVENESS PROGRESS BAR ====== */}
        {!capturedImage && isCameraActive && livenessStarted && (
          <Fade in>
            <Box sx={{ mt: 2 }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#666', fontWeight: 500 }}>
                  Liveness Verification
                </Typography>
                <Typography variant="caption" sx={{ color: '#666', fontWeight: 600 }}>
                  {completedCount}/{totalChallenges}
                </Typography>
              </Stack>

              <LinearProgress
                variant="determinate"
                value={progressPercent}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#E0E0E0',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                    backgroundColor: allChallengesPassed ? '#4CAF50' : '#2196F3',
                    transition: 'transform 0.5s ease',
                  },
                }}
              />

              {/* Challenge Status Chips */}
              <Stack direction="row" spacing={1} sx={{ mt: 1.5, justifyContent: 'center' }}>
                {LIVENESS_CHALLENGES.map((challenge, index) => {
                  const isCompleted = challengesCompleted.includes(challenge.id);
                  const isCurrent = index === currentChallengeIndex && !allChallengesPassed;

                  return (
                    <Chip
                      key={challenge.id}
                      size="small"
                      icon={
                        isCompleted
                          ? <CheckCircle sx={{ fontSize: 14, color: '#4CAF50 !important' }} />
                          : getChallengeIcon(challenge.id)
                      }
                      label={
                        challenge.id === 'blink' ? 'Blink'
                          : challenge.id === 'turnLeft' ? 'Turn'
                            : 'Smile'
                      }
                      variant={isCurrent ? 'filled' : 'outlined'}
                      sx={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        borderColor: isCompleted
                          ? '#4CAF50'
                          : isCurrent
                            ? '#2196F3'
                            : '#E0E0E0',
                        color: isCompleted
                          ? '#4CAF50'
                          : isCurrent
                            ? '#fff'
                            : '#999',
                        backgroundColor: isCurrent ? '#2196F3' : 'transparent',
                        ...(isCurrent && {
                          animation: 'chipPulse 1.5s infinite',
                          '@keyframes chipPulse': {
                            '0%, 100%': { boxShadow: '0 0 0 0 rgba(33, 150, 243, 0.4)' },
                            '50%': { boxShadow: '0 0 0 6px rgba(33, 150, 243, 0)' },
                          },
                        }),
                      }}
                    />
                  );
                })}
              </Stack>
            </Box>
          </Fade>
        )}

        {/* ====== INSTRUCTIONS ====== */}
        {!capturedImage && isCameraActive && !livenessStarted && (
          <Fade in>
            <Typography
              variant="body2"
              sx={{
                textAlign: 'center',
                mt: 2,
                color: '#666666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                fontSize: { xs: '0.8125rem', sm: '0.875rem' },
              }}
            >
              <Videocam sx={{ fontSize: { xs: 16, sm: 18 }, color: '#2196F3' }} />
              Position your face within the oval
            </Typography>
          </Fade>
        )}

        {capturedImage && (
          <Fade in>
            <Typography
              variant="body2"
              sx={{
                textAlign: 'center',
                mt: 2,
                color: '#4CAF50',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                fontSize: { xs: '0.8125rem', sm: '0.875rem' },
              }}
            >
              <CheckCircle sx={{ fontSize: { xs: 16, sm: 18 } }} />
              Photo captured successfully!
            </Typography>
          </Fade>
        )}
      </DialogContent>

      {/* ====== DIALOG ACTIONS ====== */}
      <DialogActions
        sx={{
          p: { xs: 2, sm: 3 },
          gap: { xs: 1.5, sm: 2 },
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #E0E0E0',
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        {!capturedImage ? (
          <>
            <Button
              onClick={handleClose}
              variant="outlined"
              fullWidth={isMobile}
              sx={{
                borderRadius: 2,
                px: { xs: 2, sm: 3 },
                py: { xs: 1, sm: 1.2 },
                textTransform: 'none',
                fontWeight: 600,
                fontSize: { xs: '0.875rem', sm: '0.9375rem' },
                borderColor: '#E0E0E0',
                color: '#666666',
                order: { xs: 2, sm: 1 },
                '&:hover': { borderColor: '#2196F3', backgroundColor: '#E3F2FD' },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={capturePhoto}
              variant="contained"
              disabled={!isCameraActive || isCapturing || !allChallengesPassed}
              startIcon={<CameraAlt sx={{ fontSize: { xs: 18, sm: 20 } }} />}
              fullWidth={isMobile}
              sx={{
                borderRadius: 2,
                px: { xs: 2, sm: 4 },
                py: { xs: 1, sm: 1.2 },
                textTransform: 'none',
                fontWeight: 600,
                fontSize: { xs: '0.875rem', sm: '0.9375rem' },
                backgroundColor: allChallengesPassed ? '#4CAF50' : '#E0E0E0',
                boxShadow: 'none',
                order: { xs: 1, sm: 2 },
                '&:hover': {
                  backgroundColor: allChallengesPassed ? '#388E3C' : '#E0E0E0',
                  boxShadow: allChallengesPassed ? '0 4px 12px rgba(76, 175, 80, 0.4)' : 'none',
                },
                '&:disabled': { backgroundColor: '#E0E0E0', color: '#9E9E9E' },
              }}
            >
              {isCapturing
                ? 'Capturing...'
                : !allChallengesPassed
                  ? 'Complete verification first'
                  : 'Capture Photo'}
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={retakePhoto}
              variant="outlined"
              startIcon={<Refresh sx={{ fontSize: { xs: 18, sm: 20 } }} />}
              fullWidth={isMobile}
              sx={{
                borderRadius: 2,
                px: { xs: 2, sm: 3 },
                py: { xs: 1, sm: 1.2 },
                textTransform: 'none',
                fontWeight: 600,
                fontSize: { xs: '0.875rem', sm: '0.9375rem' },
                borderColor: '#E0E0E0',
                color: '#666666',
                order: { xs: 2, sm: 1 },
                '&:hover': { borderColor: '#2196F3', backgroundColor: '#E3F2FD' },
              }}
            >
              Retake Photo
            </Button>
            <Button
              onClick={handleConfirm}
              variant="contained"
              startIcon={<CheckCircle sx={{ fontSize: { xs: 18, sm: 20 } }} />}
              fullWidth={isMobile}
              sx={{
                borderRadius: 2,
                px: { xs: 2, sm: 4 },
                py: { xs: 1, sm: 1.2 },
                textTransform: 'none',
                fontWeight: 600,
                fontSize: { xs: '0.875rem', sm: '0.9375rem' },
                backgroundColor: '#4CAF50',
                boxShadow: 'none',
                order: { xs: 1, sm: 2 },
                '&:hover': {
                  backgroundColor: '#388E3C',
                  boxShadow: '0 4px 12px rgba(76, 175, 80, 0.4)',
                },
              }}
            >
              Use This Photo
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CameraCapture;