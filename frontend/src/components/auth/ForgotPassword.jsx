// src/components/auth/ForgotPassword.jsx
import React, { useState } from 'react';
import {
  Box, Grid, TextField, Button, Typography, Alert, InputAdornment,
  CircularProgress, Stepper, Step, StepLabel, IconButton, Stack, styled,
  StepConnector, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Lock, LockReset, ArrowBack, Send, Visibility, VisibilityOff,
  Security, Check, VideoCall, Shield, Timer,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const steps = ['Enter Email', 'Reset Password'];

const CustomStepConnector = styled(StepConnector)(({ theme }) => ({
  '&.Mui-active, &.Mui-completed': {
    '& .MuiStepConnector-line': { backgroundColor: '#2196F3' },
  },
  '& .MuiStepConnector-line': {
    height: 3,
    border: 0,
    backgroundColor: '#E0E0E0',
    borderRadius: 1,
    [theme.breakpoints.down('sm')]: {
      height: 2,
    },
  },
}));

const CustomStepIcon = styled('div')(({ theme, ownerState }) => ({
  backgroundColor: ownerState.completed || ownerState.active ? '#2196F3' : '#E0E0E0',
  color: '#FFFFFF',
  width: 36,
  height: 36,
  display: 'flex',
  borderRadius: '50%',
  justifyContent: 'center',
  alignItems: 'center',
  fontSize: '0.875rem',
  fontWeight: 600,
  [theme.breakpoints.down('sm')]: {
    width: 30,
    height: 30,
    fontSize: '0.75rem',
  },
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    height: 48,
    [theme.breakpoints.down('sm')]: {
      height: 44,
    },
    '& fieldset': { borderColor: '#E0E0E0' },
    '&:hover fieldset': { borderColor: '#2196F3' },
    '&.Mui-focused fieldset': { borderColor: '#2196F3', borderWidth: 2 },
  },
  '& .MuiOutlinedInput-input': {
    padding: '12px 14px',
    fontSize: '0.95rem',
    [theme.breakpoints.down('sm')]: {
      padding: '10px 12px',
      fontSize: '0.875rem',
    },
    '&::placeholder': { color: '#9E9E9E', opacity: 1 },
  },
}));

const InputLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#333333',
  marginBottom: 8,
  [theme.breakpoints.down('sm')]: {
    fontSize: '0.8125rem',
    marginBottom: 6,
  },
}));

const ForgotPassword = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { forgotPassword, resetPassword, loading } = useAuth();
  
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateEmail = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Please enter a valid email address';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateResetForm = () => {
    const newErrors = {};
    if (!formData.otp) newErrors.otp = 'OTP is required';
    else if (formData.otp.length !== 6) newErrors.otp = 'OTP must be 6 digits';
    if (!formData.newPassword) newErrors.newPassword = 'New password is required';
    else if (formData.newPassword.length < 8) newErrors.newPassword = 'Password must be at least 8 characters';
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.newPassword)) newErrors.newPassword = 'Password must contain uppercase, lowercase, and number';
    if (formData.newPassword !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendResetEmail = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!validateEmail()) return;
    try {
      await forgotPassword(formData.email);
      setSuccessMessage('Reset code sent to your email address');
      setActiveStep(1);
    } catch (error) {
      setApiError(error.message || 'Failed to send reset email. Please try again.');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!validateResetForm()) return;
    try {
      await resetPassword({ otp: formData.otp, password: formData.newPassword, email: formData.email });
      setSuccessMessage('Password reset successfully!');
      setTimeout(() => navigate('/auth/login'), 3000);
    } catch (error) {
      setApiError(error.message || 'Failed to reset password. Please try again.');
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box component="form" onSubmit={handleSendResetEmail}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1A1A1A', mb: 1, textAlign: 'center', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
              Reset Your Password
            </Typography>
            <Typography variant="body2" sx={{ color: '#666666', mb: { xs: 3, sm: 4 }, textAlign: 'center', fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}>
              Enter your email address and we'll send you a secure 6-digit code.
            </Typography>
            
            <Box sx={{ mb: { xs: 3, sm: 4 } }}>
              <InputLabel>Email Address</InputLabel>
              <StyledTextField
                fullWidth
                name="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                error={!!errors.email}
                helperText={errors.email}
                autoFocus
              />
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              startIcon={loading ? null : <Send sx={{ fontSize: { xs: 18, sm: 20 } }} />}
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
              {loading ? <CircularProgress size={22} sx={{ color: '#FFFFFF' }} /> : 'Send Reset Code'}
            </Button>
          </Box>
        );
        
      case 1:
        return (
          <Box component="form" onSubmit={handleResetPassword}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1A1A1A', mb: 1, textAlign: 'center', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
              Create New Password
            </Typography>
            <Typography variant="body2" sx={{ color: '#666666', mb: { xs: 3, sm: 4 }, textAlign: 'center', fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}>
              Enter the 6-digit code and create your new password.
            </Typography>
            
            <Stack spacing={{ xs: 2, sm: 3 }}>
              <Box>
                <InputLabel>6-digit Security Code</InputLabel>
                <StyledTextField
                  fullWidth
                  name="otp"
                  placeholder="000000"
                  value={formData.otp}
                  onChange={handleChange}
                  error={!!errors.otp}
                  helperText={errors.otp}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Security sx={{ color: '#9E9E9E', fontSize: { xs: 18, sm: 20 } }} />
                      </InputAdornment>
                    )
                  }}
                  inputProps={{
                    maxLength: 6,
                    style: { 
                      textAlign: 'center', 
                      fontSize: isMobile ? '1rem' : '1.2rem', 
                      letterSpacing: isMobile ? '0.2rem' : '0.3rem',
                      fontWeight: 'bold'
                    }
                  }}
                  autoFocus
                />
              </Box>
              
              <Box>
                <InputLabel>New Password</InputLabel>
                <StyledTextField
                  fullWidth
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a new password"
                  value={formData.newPassword}
                  onChange={handleChange}
                  error={!!errors.newPassword}
                  helperText={errors.newPassword || 'Must contain uppercase, lowercase, and number'}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock sx={{ color: '#9E9E9E', fontSize: { xs: 18, sm: 20 } }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                          {showPassword ? (
                            <VisibilityOff sx={{ fontSize: { xs: 18, sm: 20 }, color: '#9E9E9E' }} />
                          ) : (
                            <Visibility sx={{ fontSize: { xs: 18, sm: 20 }, color: '#9E9E9E' }} />
                          )}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Box>
              
              <Box>
                <InputLabel>Confirm New Password</InputLabel>
                <StyledTextField
                  fullWidth
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your new password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  error={!!errors.confirmPassword}
                  helperText={errors.confirmPassword}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock sx={{ color: '#9E9E9E', fontSize: { xs: 18, sm: 20 } }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" size="small">
                          {showConfirmPassword ? (
                            <VisibilityOff sx={{ fontSize: { xs: 18, sm: 20 }, color: '#9E9E9E' }} />
                          ) : (
                            <Visibility sx={{ fontSize: { xs: 18, sm: 20 }, color: '#9E9E9E' }} />
                          )}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Box>
            </Stack>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              startIcon={loading ? null : <LockReset sx={{ fontSize: { xs: 18, sm: 20 } }} />}
              sx={{
                py: { xs: 1.25, sm: 1.5 },
                borderRadius: 2,
                textTransform: 'none',
                fontSize: { xs: '0.9375rem', sm: '1rem' },
                fontWeight: 600,
                backgroundColor: '#2196F3',
                boxShadow: 'none',
                mt: { xs: 3, sm: 4 },
                mb: 2,
                '&:hover': { backgroundColor: '#1976D2', boxShadow: '0 4px 12px rgba(33, 150, 243, 0.4)' },
                '&:disabled': { backgroundColor: '#BBDEFB' }
              }}
            >
              {loading ? <CircularProgress size={22} sx={{ color: '#FFFFFF' }} /> : 'Update Password'}
            </Button>

            <Button
              fullWidth
              variant="text"
              onClick={() => setActiveStep(0)}
              sx={{ 
                textTransform: 'none', 
                fontWeight: 500, 
                color: '#666666',
                fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                '&:hover': { backgroundColor: '#F5F5F5', color: '#2196F3' } 
              }}
            >
              Didn't receive the code? Try again
            </Button>
          </Box>
        );
        
      default:
        return null;
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', width: '100vw', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', backgroundColor: '#FFFFFF', overflow: 'auto' }}>
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
              Password Recovery
            </Typography>
            <Typography variant="body1" sx={{ color: '#666666', mb: { xs: 3, sm: 4 }, fontSize: { xs: '0.875rem', sm: '0.95rem' }, textAlign: { xs: 'center', md: 'left' } }}>
              Secure and easy password reset process
            </Typography>

            {/* Stepper */}
            <Box sx={{ mb: { xs: 3, sm: 4 } }}>
              <Stepper activeStep={activeStep} connector={<CustomStepConnector />}>
                {steps.map((label, index) => (
                  <Step key={label}>
                    <StepLabel
                      StepIconComponent={({ active, completed }) => (
                        <CustomStepIcon ownerState={{ active, completed }}>
                          {completed ? <Check sx={{ fontSize: { xs: 14, sm: 16 } }} /> : index + 1}
                        </CustomStepIcon>
                      )}
                      sx={{
                        '& .MuiStepLabel-label': {
                          fontSize: { xs: '0.6875rem', sm: '0.875rem' },
                          fontWeight: 500,
                          mt: 0.5,
                          color: '#666666'
                        }
                      }}
                    >
                      {label}
                    </StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Box>

            {/* Alerts */}
            {successMessage && (
              <Alert severity="success" sx={{ mb: { xs: 2, sm: 3 }, borderRadius: 2, fontSize: { xs: '0.8125rem', sm: '0.875rem' } }} onClose={() => setSuccessMessage('')}>
                {successMessage}
              </Alert>
            )}
            {apiError && (
              <Alert severity="error" sx={{ mb: { xs: 2, sm: 3 }, borderRadius: 2, fontSize: { xs: '0.8125rem', sm: '0.875rem' } }} onClose={() => setApiError('')}>
                {apiError}
              </Alert>
            )}

            {/* Step Content */}
            <Box sx={{ mb: { xs: 3, sm: 4 } }}>
              {renderStepContent(activeStep)}
            </Box>

            {/* Back to Login */}
            <Box sx={{ textAlign: 'center' }}>
              <Button
                variant="text"
                startIcon={<ArrowBack sx={{ fontSize: { xs: 18, sm: 20 } }} />}
                onClick={() => navigate('/auth/login')}
                sx={{
                  textTransform: 'none',
                  color: '#666666',
                  fontWeight: 500,
                  fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                  '&:hover': { backgroundColor: '#F5F5F5', color: '#2196F3' }
                }}
              >
                Back to Sign In
              </Button>
            </Box>
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
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `url('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80')`, backgroundSize: 'cover', backgroundPosition: 'center', '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.85) 0%, rgba(61, 180, 172, 0.9) 100%)' } }} />
          <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', px: { md: 4, lg: 6, xl: 10 }, py: { md: 4, lg: 6 }, color: '#FFFFFF' }}>
            <Box sx={{ width: { md: 50, lg: 60 }, height: { md: 50, lg: 60 }, borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: { md: 3, lg: 4 } }}>
              <Shield sx={{ fontSize: { md: 26, lg: 32 }, color: '#FFFFFF' }} />
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 400, mb: { md: 2, lg: 3 }, lineHeight: 1.3, fontSize: { md: '1.75rem', lg: '2rem', xl: '2.5rem' } }}>
              Secure <Box component="span" sx={{ fontWeight: 700 }}>Password Recovery</Box><br /><Box component="span" sx={{ fontWeight: 700 }}>Process.</Box>
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9, maxWidth: { md: 350, lg: 500 }, lineHeight: 1.7, fontSize: { md: '0.875rem', lg: '1rem' }, mb: { md: 3, lg: 4 } }}>
              Your account security is our priority. We use advanced encryption and secure verification processes.
            </Typography>
            <Stack spacing={2}>
              {[
                { icon: <Shield />, text: 'Military-Grade Encryption' },
                { icon: <Timer />, text: 'Time-Limited Codes (15 min)' },
                { icon: <Security />, text: 'Multi-Factor Verification' }
              ].map((f, i) => (
                <Stack key={i} direction="row" alignItems="center" spacing={2}>
                  <Box sx={{ width: { md: 36, lg: 40 }, height: { md: 36, lg: 40 }, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {React.cloneElement(f.icon, { sx: { color: '#FFFFFF', fontSize: { md: 18, lg: 20 } } })}
                  </Box>
                  <Typography variant="body1" sx={{ fontWeight: 500, fontSize: { md: '0.875rem', lg: '1rem' } }}>{f.text}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ForgotPassword;