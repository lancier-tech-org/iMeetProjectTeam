// src/components/auth/CameraCapture.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Button, Dialog, DialogContent, DialogActions, Typography, Stack,
  Alert, Fade, Zoom, useMediaQuery, useTheme,
} from '@mui/material';
import { CameraAlt, Refresh, CheckCircle, Videocam, VideocamOff } from '@mui/icons-material';

const CameraCapture = ({ open, onClose, onCapture, currentPhoto }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(currentPhoto || null);
  const [error, setError] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (open && !capturedImage) startCamera();
    return () => stopCamera();
  }, [open]);

  useEffect(() => {
    if (currentPhoto) setCapturedImage(currentPhoto);
  }, [currentPhoto]);

  const startCamera = async () => {
    try {
      setError('');
      setIsCameraActive(false);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera access is not supported in this browser.');
        return;
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: isMobile ? 640 : 1280 },
          height: { ideal: isMobile ? 480 : 720 },
          facingMode: 'user'
        },
        audio: false
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
      if (err.name === 'NotAllowedError') setError('Camera access denied. Please allow camera permissions.');
      else if (err.name === 'NotFoundError') setError('No camera found. Please connect a camera.');
      else if (err.name === 'NotReadableError') setError('Camera is already in use by another application.');
      else setError('Unable to access camera. Please check your permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraActive(false);
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const capturePhoto = () => {
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
    onClose();
  };

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
        }
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: { xs: 2, sm: 2.5 },
          backgroundColor: '#2196F3',
          color: '#FFFFFF',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <CameraAlt sx={{ fontSize: { xs: 22, sm: 24 } }} />
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
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
        {error && (
          <Fade in>
            <Alert
              severity="error"
              sx={{ mb: 2, borderRadius: 2, fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}
              action={
                !capturedImage && !isCameraActive && (
                  <Button color="inherit" size="small" onClick={startCamera} sx={{ fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    Retry
                  </Button>
                )
              }
            >
              {error}
            </Alert>
          </Fade>
        )}

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
                  display: isCameraActive ? 'block' : 'none'
                }}
              />
              
              {/* Loading State */}
              {!isCameraActive && !error && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#2A2A2A',
                    color: '#FFFFFF'
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
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#2A2A2A',
                    color: '#FFFFFF'
                  }}
                >
                  <VideocamOff sx={{ fontSize: { xs: 40, sm: 48 }, mb: 2, opacity: 0.5 }} />
                  <Typography variant="body1" sx={{ opacity: 0.7, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                    Camera unavailable
                  </Typography>
                </Box>
              )}
              
              {/* Face Guide */}
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
                      border: '3px solid rgba(255, 255, 255, 0.6)',
                      borderRadius: '50%',
                      pointerEvents: 'none',
                      boxShadow: 'inset 0 0 40px rgba(0,0,0,0.4)',
                    }}
                  />
                </Fade>
              )}
              
              {/* Flash Effect */}
              {isCapturing && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'white',
                    animation: 'flash 0.3s ease-out',
                    '@keyframes flash': {
                      '0%': { opacity: 0 },
                      '50%': { opacity: 0.8 },
                      '100%': { opacity: 0 }
                    }
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
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </Fade>
          )}
        </Box>

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Instructions */}
        {!capturedImage && isCameraActive && (
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
                fontSize: { xs: '0.8125rem', sm: '0.875rem' }
              }}
            >
              <Videocam sx={{ fontSize: { xs: 16, sm: 18 }, color: '#2196F3' }} />
              Position your face within the circle
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
                fontSize: { xs: '0.8125rem', sm: '0.875rem' }
              }}
            >
              <CheckCircle sx={{ fontSize: { xs: 16, sm: 18 } }} />
              Photo captured successfully!
            </Typography>
          </Fade>
        )}
      </DialogContent>

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
                '&:hover': { borderColor: '#2196F3', backgroundColor: '#E3F2FD' }
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={capturePhoto}
              variant="contained"
              disabled={!isCameraActive || isCapturing}
              startIcon={<CameraAlt sx={{ fontSize: { xs: 18, sm: 20 } }} />}
              fullWidth={isMobile}
              sx={{
                borderRadius: 2,
                px: { xs: 2, sm: 4 },
                py: { xs: 1, sm: 1.2 },
                textTransform: 'none',
                fontWeight: 600,
                fontSize: { xs: '0.875rem', sm: '0.9375rem' },
                backgroundColor: '#2196F3',
                boxShadow: 'none',
                order: { xs: 1, sm: 2 },
                '&:hover': { backgroundColor: '#1976D2', boxShadow: '0 4px 12px rgba(33, 150, 243, 0.4)' },
                '&:disabled': { backgroundColor: '#E0E0E0', color: '#9E9E9E' }
              }}
            >
              {isCapturing ? 'Capturing...' : 'Capture Photo'}
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
                '&:hover': { borderColor: '#2196F3', backgroundColor: '#E3F2FD' }
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
                '&:hover': { backgroundColor: '#388E3C', boxShadow: '0 4px 12px rgba(76, 175, 80, 0.4)' }
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