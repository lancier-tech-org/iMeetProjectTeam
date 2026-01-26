// src/components/auth/EmailVerification.jsx
import React, { useState, useEffect } from 'react';
import {
  Box, Grid, TextField, Button, Typography, Alert, CircularProgress, Chip,
  Stack, Paper, styled, Zoom, LinearProgress, Container, useMediaQuery, useTheme,
} from '@mui/material';
import {
  CheckCircle, Refresh, ArrowForward, Timer, Security, Support,
  Dashboard, VideoCall, Shield, Speed,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    height: 70,
    fontSize: '1.8rem',
    fontWeight: 'bold',
    [theme.breakpoints.down('sm')]: {
      height: 56,
      fontSize: '1.4rem',
    },
    '& fieldset': { borderColor: '#E0E0E0', borderWidth: 2 },
    '&:hover fieldset': { borderColor: '#2196F3' },
    '&.Mui-focused fieldset': { borderColor: '#2196F3', borderWidth: 2 },
  },
  '& .MuiOutlinedInput-input': {
    textAlign: 'center',
    letterSpacing: '0.6rem',
    padding: '16px',
    [theme.breakpoints.down('sm')]: {
      letterSpacing: '0.4rem',
      padding: '12px',
    },
    '&::placeholder': { color: '#BDBDBD', opacity: 1, letterSpacing: '0.3rem' },
  },
}));

const EmailVerification = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyEmail, resendVerification, loading, user } = useAuth();
  
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [verificationCode, setVerificationCode] = useState('');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15 * 60);

  const emailFromParams = searchParams.get('email');
  const userEmail = user?.email || emailFromParams || '';

  useEffect(() => {
    const codeFromParams = searchParams.get('code');
    if (codeFromParams && userEmail) handleVerification(codeFromParams);
  }, [searchParams, userEmail]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (timeLeft > 0 && !isVerified) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, isVerified]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleChange = (e) => {
    const sanitizedValue = e.target.value.replace(/\D/g, '').slice(0, 6);
    setVerificationCode(sanitizedValue);
    if (errors.verificationCode) setErrors({});
    if (sanitizedValue.length === 6) handleVerification(sanitizedValue);
  };

  const validateCode = (code) => {
    const newErrors = {};
    if (!code) newErrors.verificationCode = 'Verification code is required';
    else if (code.length !== 6) newErrors.verificationCode = 'Verification code must be 6 digits';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleVerification = async (code = verificationCode) => {
    setApiError('');
    if (!validateCode(code)) return;
    try {
      await verifyEmail({ email: userEmail, verificationCode: code });
      setIsVerified(true);
      setSuccessMessage('Email verified successfully! Welcome to our platform.');
      setTimeout(() => navigate('/dashboard'), 3000);
    } catch (error) {
      setApiError(error.message || 'Invalid verification code. Please try again.');
      setVerificationCode('');
    }
  };

  const handleResendCode = async () => {
    setApiError('');
    try {
      await resendVerification({ email: userEmail });
      setSuccessMessage('New verification code sent to your email');
      setCountdown(60);
      setTimeLeft(15 * 60);
      setVerificationCode('');
    } catch (error) {
      setApiError(error.message || 'Failed to resend verification code');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleVerification();
  };

  // Success Screen
  if (isVerified) {
    return (
      <Box 
        sx={{ 
          minHeight: '100vh', 
          width: '100vw', 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'linear-gradient(135deg, #4CAF50 0%, #2196F3 100%)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          p: { xs: 2, sm: 3 } 
        }}
      >
        <Container maxWidth="sm">
          <Zoom in timeout={1000}>
            <Paper 
              elevation={0} 
              sx={{ 
                p: { xs: 4, sm: 6 }, 
                borderRadius: 3, 
                textAlign: 'center', 
                backgroundColor: '#FFFFFF', 
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)' 
              }}
            >
              <Zoom in timeout={1500}>
                <Box 
                  sx={{ 
                    width: { xs: 60, sm: 80 }, 
                    height: { xs: 60, sm: 80 }, 
                    borderRadius: '50%', 
                    backgroundColor: '#4CAF50', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    mx: 'auto', 
                    mb: 3 
                  }}
                >
                  <CheckCircle sx={{ fontSize: { xs: 36, sm: 48 }, color: '#FFFFFF' }} />
                </Box>
              </Zoom>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#1A1A1A', mb: 2, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                Email Verified!
              </Typography>
              <Typography variant="body1" sx={{ color: '#666666', mb: 3, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                Your email has been verified and your account is now active
              </Typography>
              <Alert severity="success" sx={{ mb: 4, borderRadius: 2, textAlign: 'left', fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}>
                {successMessage}
              </Alert>
              <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} mb={2}>
                <Dashboard sx={{ color: '#2196F3', fontSize: { xs: 20, sm: 24 } }} />
                <Typography variant="body2" sx={{ color: '#666666', fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}>
                  Redirecting to dashboard...
                </Typography>
              </Stack>
              <CircularProgress size={isMobile ? 28 : 32} sx={{ color: '#2196F3' }} />
            </Paper>
          </Zoom>
        </Container>
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        width: '100vw', 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        display: 'flex', 
        backgroundColor: '#FFFFFF', 
        overflow: 'auto' 
      }}
    >
      <Grid container sx={{ minHeight: '100%' }}>
        {/* Left Side - Form */}
        <Grid 
          item 
          xs={12} 
          md={6} 
          lg={5} 
          xl={4.5}
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: { xs: 'flex-start', md: 'center' },
            alignItems: 'center',
            px: { xs: 2.5, sm: 4, md: 6, lg: 8 }, 
            py: { xs: 3, sm: 4, md: 6 }, 
            backgroundColor: '#FFFFFF', 
            overflow: 'auto',
            minHeight: { xs: '100vh', md: 'auto' },
          }}
        >
          <Box sx={{ width: '100%', maxWidth: { xs: '100%', sm: 420, md: 400 } }}>
            {/* Logo */}
            <Box sx={{ mb: { xs: 3, sm: 4 }, display: 'flex', alignItems: 'center', gap: 1, justifyContent: { xs: 'center', md: 'flex-start' } }}>
              <VideoCall sx={{ fontSize: { xs: 28, sm: 32 }, color: '#2196F3' }} />
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#2196F3', fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                iMeet<span style={{ color: '#3DB4AC' }}>Pro</span>
              </Typography>
            </Box>

            {/* Header */}
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1A1A1A', mb: 1, fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' }, textAlign: { xs: 'center', md: 'left' } }}>
              Verify Your Email
            </Typography>
            <Typography variant="body1" sx={{ color: '#666666', mb: 2, fontSize: { xs: '0.875rem', sm: '0.95rem' }, textAlign: { xs: 'center', md: 'left' } }}>
              We've sent a 6-digit verification code to
            </Typography>
            
            {/* Email Chip */}
            <Box sx={{ display: 'flex', justifyContent: { xs: 'center', md: 'flex-start' }, mb: 3 }}>
              <Chip 
                label={userEmail} 
                sx={{ 
                  backgroundColor: '#E3F2FD', 
                  color: '#2196F3', 
                  fontWeight: 600, 
                  fontSize: { xs: '0.75rem', sm: '0.9rem' }, 
                  px: 1,
                  maxWidth: '100%',
                  '& .MuiChip-label': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }
                }} 
              />
            </Box>

            {/* Timer */}
            <Paper 
              elevation={0} 
              sx={{ 
                p: { xs: 1.5, sm: 2 }, 
                backgroundColor: '#FFF8E1', 
                borderRadius: 2, 
                border: '1px solid #FFE082', 
                mb: 3 
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Timer sx={{ color: '#F5A623', fontSize: { xs: 18, sm: 20 } }} />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#F5A623', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    Code expires in {formatTime(timeLeft)}
                  </Typography>
                </Stack>
              </Stack>
              <LinearProgress 
                variant="determinate" 
                value={(timeLeft / (15 * 60)) * 100} 
                sx={{ 
                  height: { xs: 3, sm: 4 }, 
                  borderRadius: 2, 
                  backgroundColor: '#FFE082', 
                  '& .MuiLinearProgress-bar': { backgroundColor: '#F5A623', borderRadius: 2 } 
                }} 
              />
            </Paper>

            {/* Alerts */}
            {successMessage && !isVerified && (
              <Alert severity="success" sx={{ mb: { xs: 2, sm: 3 }, borderRadius: 2, fontSize: { xs: '0.8125rem', sm: '0.875rem' } }} onClose={() => setSuccessMessage('')}>
                {successMessage}
              </Alert>
            )}
            {apiError && (
              <Alert severity="error" sx={{ mb: { xs: 2, sm: 3 }, borderRadius: 2, fontSize: { xs: '0.8125rem', sm: '0.875rem' } }} onClose={() => setApiError('')}>
                {apiError}
              </Alert>
            )}

            {/* Form */}
            <Box component="form" onSubmit={handleSubmit} sx={{ mb: { xs: 3, sm: 4 } }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1A1A1A', mb: 2, textAlign: 'center', fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                Enter Verification Code
              </Typography>
              
              <StyledTextField 
                fullWidth 
                placeholder="000000" 
                value={verificationCode} 
                onChange={handleChange} 
                error={!!errors.verificationCode} 
                helperText={errors.verificationCode || 'Code will be verified automatically when complete'} 
                inputProps={{ maxLength: 6 }} 
                sx={{ mb: 3 }} 
                autoFocus 
                autoComplete="one-time-code" 
              />

              <Button 
                type="submit" 
                fullWidth 
                variant="contained" 
                disabled={loading || verificationCode.length !== 6} 
                startIcon={loading ? null : <CheckCircle sx={{ fontSize: { xs: 18, sm: 20 } }} />} 
                sx={{ 
                  py: { xs: 1.25, sm: 1.5 }, 
                  borderRadius: 2, 
                  textTransform: 'none', 
                  fontSize: { xs: '0.9375rem', sm: '1rem' }, 
                  fontWeight: 600, 
                  backgroundColor: '#2196F3', 
                  boxShadow: 'none', 
                  '&:hover': { backgroundColor: '#1976D2', boxShadow: '0 4px 12px rgba(33, 150, 243, 0.4)' }, 
                  '&:disabled': { backgroundColor: '#BBDEFB' } 
                }}
              >
                {loading ? <CircularProgress size={22} sx={{ color: '#FFFFFF' }} /> : 'Verify Email Address'}
              </Button>
            </Box>

            {/* Resend Section */}
            <Paper 
              elevation={0} 
              sx={{ 
                p: { xs: 2, sm: 3 }, 
                backgroundColor: '#F5F5F5', 
                borderRadius: 2, 
                textAlign: 'center', 
                mb: 3 
              }}
            >
              <Typography variant="body2" sx={{ color: '#666666', mb: 2, fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}>
                Didn't receive the verification code?
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
                <Button 
                  variant="outlined" 
                  startIcon={<Refresh sx={{ fontSize: { xs: 18, sm: 20 } }} />} 
                  onClick={handleResendCode} 
                  disabled={countdown > 0 || loading}
                  fullWidth={isMobile}
                  sx={{ 
                    textTransform: 'none', 
                    borderRadius: 2, 
                    px: { xs: 2, sm: 3 }, 
                    py: 1, 
                    fontWeight: 600, 
                    fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                    borderColor: '#E0E0E0', 
                    color: '#666666', 
                    '&:hover': { borderColor: '#2196F3', backgroundColor: '#E3F2FD', color: '#2196F3' } 
                  }}
                >
                  {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
                </Button>
                <Button 
                  variant="text" 
                  endIcon={<ArrowForward sx={{ fontSize: { xs: 18, sm: 20 } }} />} 
                  onClick={() => navigate('/auth/login')}
                  fullWidth={isMobile}
                  sx={{ 
                    textTransform: 'none', 
                    px: { xs: 2, sm: 3 }, 
                    py: 1, 
                    fontWeight: 600, 
                    fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                    color: '#666666', 
                    '&:hover': { backgroundColor: '#F5F5F5', color: '#2196F3' } 
                  }}
                >
                  Back to Login
                </Button>
              </Stack>
            </Paper>

            {/* Help Section */}
            <Paper 
              elevation={0} 
              sx={{ 
                p: { xs: 1.5, sm: 2 }, 
                backgroundColor: '#E3F2FD', 
                borderRadius: 2, 
                border: '1px solid #BBDEFB' 
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} mb={1}>
                <Support sx={{ color: '#2196F3', fontSize: { xs: 18, sm: 20 } }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#2196F3', fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}>
                  Need Help?
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: '#666666', textAlign: 'center', lineHeight: 1.6, fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}>
                Check your spam folder or contact support if you don't receive the code.
              </Typography>
            </Paper>
          </Box>
        </Grid>

        {/* Right Side - Branding (Hidden on mobile/tablet) */}
        <Grid 
          item 
          xs={12} 
          md={6} 
          lg={7} 
          xl={7.5}
          sx={{ 
            display: { xs: 'none', md: 'flex' }, 
            position: 'relative', 
            background: 'linear-gradient(135deg, #2196F3 0%, #3DB4AC 100%)', 
            overflow: 'hidden' 
          }}
        >
          <Box 
            sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              backgroundImage: `url('https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80')`, 
              backgroundSize: 'cover', 
              backgroundPosition: 'center', 
              '&::before': { 
                content: '""', 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                bottom: 0, 
                background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.85) 0%, rgba(61, 180, 172, 0.9) 100%)' 
              } 
            }} 
          />
          <Box 
            sx={{ 
              position: 'relative', 
              zIndex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center', 
              px: { md: 4, lg: 6, xl: 10 }, 
              py: { md: 4, lg: 6 }, 
              color: '#FFFFFF' 
            }}
          >
            <Box 
              sx={{ 
                width: { md: 50, lg: 60 }, 
                height: { md: 50, lg: 60 }, 
                borderRadius: '50%', 
                backgroundColor: 'rgba(255, 255, 255, 0.15)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                mb: { md: 3, lg: 4 } 
              }}
            >
              <Security sx={{ fontSize: { md: 26, lg: 32 }, color: '#FFFFFF' }} />
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 400, mb: { md: 2, lg: 3 }, lineHeight: 1.3, fontSize: { md: '1.75rem', lg: '2rem', xl: '2.5rem' } }}>
              Almost There! <Box component="span" sx={{ fontWeight: 700 }}>Verify Your</Box><br /><Box component="span" sx={{ fontWeight: 700 }}>Email.</Box>
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9, maxWidth: { md: 350, lg: 500 }, lineHeight: 1.7, fontSize: { md: '0.875rem', lg: '1rem' }, mb: { md: 3, lg: 4 } }}>
              We've sent a secure verification code to your email. This extra step ensures your account remains safe.
            </Typography>
            <Grid container spacing={{ md: 3, lg: 4 }}>
              {[
                { value: '10M+', label: 'Verified Users', icon: <Security /> },
                { value: '<30s', label: 'Average Time', icon: <Speed /> },
                { value: '99.9%', label: 'Success Rate', icon: <Shield /> }
              ].map((stat, index) => (
                <Grid item xs={4} key={index}>
                  <Box 
                    sx={{ 
                      width: { md: 36, lg: 40 }, 
                      height: { md: 36, lg: 40 }, 
                      borderRadius: 2, 
                      backgroundColor: 'rgba(255, 255, 255, 0.15)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      mb: 1 
                    }}
                  >
                    {React.cloneElement(stat.icon, { sx: { color: '#FFFFFF', fontSize: { md: 18, lg: 20 } } })}
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { md: '1.25rem', lg: '1.5rem' } }}>{stat.value}</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8, fontSize: { md: '0.75rem', lg: '0.875rem' } }}>{stat.label}</Typography>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EmailVerification;