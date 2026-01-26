// src/components/auth/Register.jsx
import React, { useState, useRef } from 'react';
import {
  Box, Grid, TextField, Button, Typography, Link, Alert, InputAdornment,
  IconButton, MenuItem, FormControl, Select, Checkbox, FormControlLabel,
  CircularProgress, Stepper, Step, StepLabel, StepConnector, Chip, Stack,
  styled, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Visibility, VisibilityOff, Person, Phone, LocationOn, Language,
  ArrowBack, ArrowForward, Check, VideoCall, CameraAlt, Image, CheckCircle,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import CameraCapture from './CameraCapture';

const countries = [
  { code: '+1', name: 'United States', flag: '🇺🇸' },
  { code: '+91', name: 'India', flag: '🇮🇳' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+86', name: 'China', flag: '🇨🇳' },
  { code: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: '+33', name: 'France', flag: '🇫🇷' },
  { code: '+81', name: 'Japan', flag: '🇯🇵' },
  { code: '+7', name: 'Russia', flag: '🇷🇺' },
  { code: '+39', name: 'Italy', flag: '🇮🇹' },
  { code: '+34', name: 'Spain', flag: '🇪🇸' }
];

const languages = [
  'English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese',
  'Korean', 'Portuguese', 'Russian', 'Arabic', 'Hindi', 'Italian'
];

const steps = ['Personal Info', 'Contact Details', 'Account Setup'];

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
    width: 28,
    height: 28,
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

const StyledSelect = styled(Select)(({ theme }) => ({
  borderRadius: 8,
  backgroundColor: '#FFFFFF',
  height: 48,
  [theme.breakpoints.down('sm')]: {
    height: 44,
  },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E0E0E0' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#2196F3' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2196F3', borderWidth: 2 },
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

const Register = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { register, loading } = useAuth();
  
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    full_name: '', email: '', phone_number: '', country_code: '+91',
    address: '', country: '', languages: [], password: '', confirmPassword: '', agreeToTerms: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const profilePhotoRef = useRef(null);

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleLanguageChange = (event) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, languages: typeof value === 'string' ? value.split(',') : value }));
  };

  const handlePhotoCapture = (photoData) => {
    console.log('📸 Photo captured in Register.jsx');
    setProfilePhoto(photoData);
    profilePhotoRef.current = photoData;
    if (errors.profilePhoto) setErrors(prev => ({ ...prev, profilePhoto: '' }));
  };

  const validateStep = (step) => {
    const newErrors = {};
    switch (step) {
      case 0:
        if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required';
        else if (formData.full_name.trim().length < 2) newErrors.full_name = 'Full name must be at least 2 characters';
        if (!formData.email) newErrors.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Please enter a valid email address';
        if (!(profilePhoto || profilePhotoRef.current)) newErrors.profilePhoto = 'Profile photo is required';
        break;
      case 1:
        if (!formData.phone_number) newErrors.phone_number = 'Phone number is required';
        else if (!/^\d{10,15}$/.test(formData.phone_number.replace(/\s|-/g, ''))) newErrors.phone_number = 'Please enter a valid phone number';
        if (!formData.address.trim()) newErrors.address = 'Address is required';
        if (!formData.country) newErrors.country = 'Country is required';
        if (formData.languages.length === 0) newErrors.languages = 'Please select at least one language';
        break;
      case 2:
        if (!formData.password) newErrors.password = 'Password is required';
        else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
        else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) newErrors.password = 'Password must contain uppercase, lowercase, and number';
        if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
        if (!formData.agreeToTerms) newErrors.agreeToTerms = 'You must agree to the terms and conditions';
        break;
      default: break;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => { if (validateStep(activeStep)) setActiveStep(prev => prev + 1); };
  const handleBack = () => { setActiveStep(prev => prev - 1); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!validateStep(2)) return;
    const photo = profilePhoto || profilePhotoRef.current;
    if (!photo) { setApiError('Please capture a profile photo'); setActiveStep(0); return; }
    if (!photo.startsWith('data:image')) { setApiError('Invalid photo format'); setActiveStep(0); return; }
    try {
      const registrationData = {
        full_name: formData.full_name, email: formData.email, phone_number: formData.phone_number,
        password: formData.password, address: formData.address, country: formData.country,
        country_code: formData.country_code, languages: formData.languages.join(','),
        profile_photo: photo, agreeToTerms: formData.agreeToTerms
      };
      await register(registrationData);
      navigate('/auth/login', { state: { registrationSuccess: true, email: formData.email } });
    } catch (error) {
      setApiError(error.message || 'Registration failed. Please try again.');
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Stack spacing={{ xs: 2, sm: 3 }}>
            <Box>
              <InputLabel>Full Name</InputLabel>
              <StyledTextField 
                fullWidth 
                name="full_name" 
                placeholder="Enter your full name" 
                value={formData.full_name} 
                onChange={handleChange} 
                error={!!errors.full_name} 
                helperText={errors.full_name}
                InputProps={{ 
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person sx={{ color: '#9E9E9E', fontSize: { xs: 18, sm: 20 } }} />
                    </InputAdornment>
                  ) 
                }} 
              />
            </Box>
            <Box>
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
                InputProps={{ 
                  endAdornment: formData.email && /\S+@\S+\.\S+/.test(formData.email) && (
                    <InputAdornment position="end">
                      <CheckCircle sx={{ color: '#4CAF50', fontSize: { xs: 18, sm: 20 } }} />
                    </InputAdornment>
                  ) 
                }} 
              />
            </Box>
            <Box sx={{ textAlign: 'center', py: { xs: 1.5, sm: 2 } }}>
              <InputLabel sx={{ textAlign: 'center', mb: { xs: 1.5, sm: 2 } }}>Profile Photo *</InputLabel>
              <Box 
                onClick={() => setCameraOpen(true)} 
                sx={{ 
                  width: { xs: 100, sm: 120 }, 
                  height: { xs: 100, sm: 120 }, 
                  mx: 'auto', 
                  mb: 2, 
                  borderRadius: '50%', 
                  border: `2px dashed ${errors.profilePhoto ? '#F44336' : '#E0E0E0'}`, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  overflow: 'hidden', 
                  backgroundColor: '#F5F5F5', 
                  cursor: 'pointer', 
                  '&:hover': { borderColor: '#2196F3', backgroundColor: '#E3F2FD' } 
                }}
              >
                {(profilePhoto || profilePhotoRef.current) ? (
                  <img src={profilePhoto || profilePhotoRef.current} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Stack alignItems="center" spacing={0.5}>
                    <CameraAlt sx={{ fontSize: { xs: 28, sm: 32 }, color: '#9E9E9E' }} />
                    <Typography variant="caption" sx={{ color: '#9E9E9E', fontSize: { xs: '0.625rem', sm: '0.7rem' } }}>Add Photo</Typography>
                  </Stack>
                )}
              </Box>
              <Button 
                variant="outlined" 
                size="small" 
                startIcon={(profilePhoto || profilePhotoRef.current) ? <Image /> : <CameraAlt />} 
                onClick={() => setCameraOpen(true)} 
                sx={{ 
                  borderRadius: 2, 
                  textTransform: 'none', 
                  px: { xs: 2, sm: 3 }, 
                  py: { xs: 0.75, sm: 1 }, 
                  fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                  borderColor: errors.profilePhoto ? '#F44336' : '#E0E0E0', 
                  color: errors.profilePhoto ? '#F44336' : '#666666', 
                  '&:hover': { borderColor: '#2196F3', backgroundColor: '#E3F2FD' } 
                }}
              >
                {(profilePhoto || profilePhotoRef.current) ? 'Change Photo' : 'Capture Photo'}
              </Button>
              {errors.profilePhoto && <Typography variant="caption" color="error" display="block" sx={{ mt: 1, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>{errors.profilePhoto}</Typography>}
              {(profilePhoto || profilePhotoRef.current) && !errors.profilePhoto && <Typography variant="caption" sx={{ color: '#4CAF50', display: 'block', mt: 1, fontWeight: 500, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>✓ Photo captured successfully</Typography>}
            </Box>
          </Stack>
        );
      case 1:
        return (
          <Stack spacing={{ xs: 2, sm: 3 }}>
            <Box>
              <InputLabel>Phone Number</InputLabel>
              <Grid container spacing={1}>
                <Grid item xs={4} sm={3.5}>
                  <FormControl fullWidth>
                    <StyledSelect name="country_code" value={formData.country_code} onChange={handleChange}>
                      {countries.map((c) => (
                        <MenuItem key={c.code} value={c.code}>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <span style={{ fontSize: isMobile ? '0.875rem' : '1rem' }}>{c.flag}</span>
                            <span style={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{c.code}</span>
                          </Box>
                        </MenuItem>
                      ))}
                    </StyledSelect>
                  </FormControl>
                </Grid>
                <Grid item xs={8} sm={8.5}>
                  <StyledTextField 
                    fullWidth 
                    name="phone_number" 
                    placeholder="Enter phone number" 
                    value={formData.phone_number} 
                    onChange={handleChange} 
                    error={!!errors.phone_number} 
                    helperText={errors.phone_number}
                    InputProps={{ 
                      startAdornment: (
                        <InputAdornment position="start">
                          <Phone sx={{ color: '#9E9E9E', fontSize: { xs: 18, sm: 20 } }} />
                        </InputAdornment>
                      ) 
                    }} 
                  />
                </Grid>
              </Grid>
            </Box>
            <Box>
              <InputLabel>Address</InputLabel>
              <TextField 
                fullWidth 
                name="address" 
                placeholder="Enter your address" 
                multiline 
                rows={isMobile ? 2 : 2} 
                value={formData.address} 
                onChange={handleChange} 
                error={!!errors.address} 
                helperText={errors.address}
                InputProps={{ 
                  startAdornment: (
                    <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                      <LocationOn sx={{ color: '#9E9E9E', fontSize: { xs: 18, sm: 20 } }} />
                    </InputAdornment>
                  ) 
                }}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    borderRadius: 2, 
                    fontSize: { xs: '0.875rem', sm: '0.95rem' },
                    '& fieldset': { borderColor: '#E0E0E0' }, 
                    '&:hover fieldset': { borderColor: '#2196F3' }, 
                    '&.Mui-focused fieldset': { borderColor: '#2196F3', borderWidth: 2 } 
                  } 
                }} 
              />
            </Box>
            <Box>
              <InputLabel>Country</InputLabel>
              <StyledTextField fullWidth name="country" placeholder="Enter your country" value={formData.country} onChange={handleChange} error={!!errors.country} helperText={errors.country} />
            </Box>
            <Box>
              <InputLabel>Languages</InputLabel>
              <FormControl fullWidth error={!!errors.languages}>
                <StyledSelect 
                  multiple 
                  name="languages" 
                  value={formData.languages} 
                  onChange={handleLanguageChange} 
                  onClose={() => setLanguageMenuOpen(false)} 
                  onOpen={() => setLanguageMenuOpen(true)} 
                  open={languageMenuOpen} 
                  displayEmpty
                  startAdornment={
                    <InputAdornment position="start">
                      <Language sx={{ color: '#9E9E9E', fontSize: { xs: 18, sm: 20 } }} />
                    </InputAdornment>
                  }
                  renderValue={(selected) => 
                    selected.length === 0 ? (
                      <Typography sx={{ color: '#9E9E9E', fontSize: { xs: '0.875rem', sm: '0.95rem' } }}>Select languages</Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.slice(0, isMobile ? 2 : 3).map((v) => (
                          <Chip key={v} label={v} size="small" sx={{ backgroundColor: '#E3F2FD', color: '#2196F3', fontWeight: 500, fontSize: { xs: '0.7rem', sm: '0.75rem' } }} />
                        ))}
                        {selected.length > (isMobile ? 2 : 3) && (
                          <Chip label={`+${selected.length - (isMobile ? 2 : 3)}`} size="small" sx={{ backgroundColor: '#E0E0E0', fontSize: { xs: '0.7rem', sm: '0.75rem' } }} />
                        )}
                      </Box>
                    )
                  }
                  sx={{ height: 'auto', minHeight: { xs: 44, sm: 48 }, py: 0.5 }}
                >
                  {languages.map((lang) => (
                    <MenuItem key={lang} value={lang} onClick={() => setTimeout(() => setLanguageMenuOpen(false), 100)}>
                      <Checkbox checked={formData.languages.indexOf(lang) > -1} sx={{ color: '#E0E0E0', '&.Mui-checked': { color: '#2196F3' } }} />
                      <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>{lang}</Typography>
                    </MenuItem>
                  ))}
                </StyledSelect>
                {errors.languages && <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>{errors.languages}</Typography>}
              </FormControl>
            </Box>
          </Stack>
        );
      case 2:
        return (
          <Stack spacing={{ xs: 2, sm: 3 }}>
            <Box>
              <InputLabel>Password</InputLabel>
              <StyledTextField 
                fullWidth 
                name="password" 
                type={showPassword ? 'text' : 'password'} 
                placeholder="Create a password" 
                value={formData.password} 
                onChange={handleChange} 
                error={!!errors.password} 
                helperText={errors.password || 'Must contain uppercase, lowercase, and number'}
                InputProps={{ 
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                        {showPassword ? <VisibilityOff sx={{ fontSize: { xs: 18, sm: 20 }, color: '#9E9E9E' }} /> : <Visibility sx={{ fontSize: { xs: 18, sm: 20 }, color: '#9E9E9E' }} />}
                      </IconButton>
                    </InputAdornment>
                  ) 
                }} 
              />
            </Box>
            <Box>
              <InputLabel>Confirm Password</InputLabel>
              <StyledTextField 
                fullWidth 
                name="confirmPassword" 
                type={showConfirmPassword ? 'text' : 'password'} 
                placeholder="Confirm your password" 
                value={formData.confirmPassword} 
                onChange={handleChange} 
                error={!!errors.confirmPassword} 
                helperText={errors.confirmPassword}
                InputProps={{ 
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" size="small">
                        {showConfirmPassword ? <VisibilityOff sx={{ fontSize: { xs: 18, sm: 20 }, color: '#9E9E9E' }} /> : <Visibility sx={{ fontSize: { xs: 18, sm: 20 }, color: '#9E9E9E' }} />}
                      </IconButton>
                    </InputAdornment>
                  ) 
                }} 
              />
            </Box>
            <Box sx={{ p: { xs: 1.5, sm: 2 }, backgroundColor: '#F9F9F9', borderRadius: 2, border: errors.agreeToTerms ? '1px solid #F44336' : '1px solid #E0E0E0' }}>
              <FormControlLabel 
                control={<Checkbox name="agreeToTerms" checked={formData.agreeToTerms} onChange={handleChange} sx={{ color: '#E0E0E0', '&.Mui-checked': { color: '#2196F3' } }} />}
                label={
                  <Typography variant="body2" sx={{ color: '#666666', lineHeight: 1.6, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    I agree to the <Link href="#" sx={{ color: '#2196F3', fontWeight: 600 }}>Terms of Service</Link> and <Link href="#" sx={{ color: '#2196F3', fontWeight: 600 }}>Privacy Policy</Link>
                  </Typography>
                } 
              />
            </Box>
            {errors.agreeToTerms && <Typography variant="caption" color="error" sx={{ ml: 1, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>{errors.agreeToTerms}</Typography>}
          </Stack>
        );
      default: return null;
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
            px: { xs: 2.5, sm: 4, md: 5, lg: 6 }, 
            py: { xs: 2, sm: 3, md: 4 }, 
            backgroundColor: '#FFFFFF', 
            overflow: 'auto',
            minHeight: { xs: '100vh', md: 'auto' },
          }}
        >
          <Box sx={{ width: '100%', maxWidth: { xs: '100%', sm: 420, md: 400 } }}>
            {/* Logo */}
            <Box sx={{ mb: { xs: 2, sm: 3 }, display: 'flex', alignItems: 'center', gap: 1, justifyContent: { xs: 'center', md: 'flex-start' } }}>
              <VideoCall sx={{ fontSize: { xs: 28, sm: 32 }, color: '#2196F3' }} />
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#2196F3', fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                iMeet<span style={{ color: '#3DB4AC' }}>Pro</span>
              </Typography>
            </Box>
            
            {/* Header */}
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1A1A1A', mb: 0.5, fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' }, textAlign: { xs: 'center', md: 'left' } }}>
              Create Account
            </Typography>
            <Typography variant="body2" sx={{ color: '#666666', mb: { xs: 2, sm: 3 }, fontSize: { xs: '0.8125rem', sm: '0.875rem' }, textAlign: { xs: 'center', md: 'left' } }}>
              Join our platform and start your professional journey
            </Typography>
            
            {/* Stepper */}
            <Box sx={{ mb: { xs: 2, sm: 3 } }}>
              <Stepper activeStep={activeStep} connector={<CustomStepConnector />} sx={{ mb: 2 }}>
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
                          fontSize: { xs: '0.625rem', sm: '0.75rem' }, 
                          fontWeight: 500, 
                          mt: 0.5, 
                          color: '#666666',
                          display: { xs: index === activeStep ? 'block' : 'none', sm: 'block' },
                        } 
                      }}
                    >
                      {label}
                    </StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Box>
            
            {/* Error */}
            {apiError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2, fontSize: { xs: '0.75rem', sm: '0.875rem' } }} onClose={() => setApiError('')}>
                {apiError}
              </Alert>
            )}
            
            {/* Form */}
            <Box component="form" onSubmit={handleSubmit}>
              <Box sx={{ minHeight: { xs: 260, sm: 280 }, mb: { xs: 2, sm: 3 } }}>
                {renderStepContent(activeStep)}
              </Box>
              
              {/* Navigation */}
              <Stack 
                direction={{ xs: 'column', sm: 'row' }} 
                justifyContent="space-between" 
                spacing={{ xs: 1.5, sm: 2 }} 
                sx={{ mb: 2 }}
              >
                <Button 
                  variant="outlined" 
                  startIcon={<ArrowBack sx={{ fontSize: { xs: 18, sm: 20 } }} />} 
                  onClick={activeStep === 0 ? () => navigate('/auth/login') : handleBack} 
                  fullWidth={isMobile}
                  sx={{ 
                    textTransform: 'none', 
                    borderRadius: 2, 
                    px: { xs: 2, sm: 3 }, 
                    py: { xs: 1, sm: 1.2 }, 
                    fontSize: { xs: '0.875rem', sm: '0.9375rem' },
                    borderColor: '#E0E0E0', 
                    color: '#666666',
                    order: { xs: 2, sm: 1 },
                    '&:hover': { borderColor: '#2196F3', backgroundColor: '#E3F2FD' } 
                  }}
                >
                  {activeStep === 0 ? 'Back to Login' : 'Previous'}
                </Button>
                
                {activeStep === steps.length - 1 ? (
                  <Button 
                    type="submit" 
                    variant="contained" 
                    disabled={loading}
                    fullWidth={isMobile}
                    sx={{ 
                      textTransform: 'none', 
                      px: { xs: 2, sm: 4 }, 
                      py: { xs: 1, sm: 1.2 }, 
                      borderRadius: 2, 
                      backgroundColor: '#2196F3', 
                      fontWeight: 600, 
                      fontSize: { xs: '0.875rem', sm: '0.9375rem' },
                      boxShadow: 'none',
                      order: { xs: 1, sm: 2 },
                      '&:hover': { backgroundColor: '#1976D2', boxShadow: '0 4px 12px rgba(33, 150, 243, 0.4)' }, 
                      '&:disabled': { backgroundColor: '#BBDEFB' } 
                    }}
                  >
                    {loading ? <CircularProgress size={22} sx={{ color: '#FFFFFF' }} /> : 'Create Account'}
                  </Button>
                ) : (
                  <Button 
                    variant="contained" 
                    endIcon={<ArrowForward sx={{ fontSize: { xs: 18, sm: 20 } }} />} 
                    onClick={handleNext}
                    fullWidth={isMobile}
                    sx={{ 
                      textTransform: 'none', 
                      px: { xs: 2, sm: 4 }, 
                      py: { xs: 1, sm: 1.2 }, 
                      borderRadius: 2, 
                      backgroundColor: '#2196F3', 
                      fontWeight: 600,
                      fontSize: { xs: '0.875rem', sm: '0.9375rem' },
                      boxShadow: 'none',
                      order: { xs: 1, sm: 2 },
                      '&:hover': { backgroundColor: '#1976D2', boxShadow: '0 4px 12px rgba(33, 150, 243, 0.4)' } 
                    }}
                  >
                    Continue
                  </Button>
                )}
              </Stack>
              
              {/* Sign In Link */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: '#666666', fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}>
                  Already have an account?{' '}
                  <Link component="button" type="button" onClick={() => navigate('/auth/login')} sx={{ textDecoration: 'none', fontWeight: 600, color: '#2196F3', '&:hover': { textDecoration: 'underline' } }}>
                    Sign in here
                  </Link>
                </Typography>
              </Box>
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
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `url('https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80')`, backgroundSize: 'cover', backgroundPosition: 'center', '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.85) 0%, rgba(61, 180, 172, 0.9) 100%)' } }} />
          <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', px: { md: 4, lg: 6, xl: 10 }, py: { md: 4, lg: 6 }, color: '#FFFFFF' }}>
            <Box sx={{ width: { md: 50, lg: 60 }, height: { md: 50, lg: 60 }, borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: { md: 3, lg: 4 } }}>
              <VideoCall sx={{ fontSize: { md: 26, lg: 32 }, color: '#FFFFFF' }} />
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 400, mb: { md: 2, lg: 3 }, lineHeight: 1.3, fontSize: { md: '1.75rem', lg: '2rem', xl: '2.5rem' } }}>
              Join the Future of <Box component="span" sx={{ fontWeight: 700 }}>Professional</Box><br /><Box component="span" sx={{ fontWeight: 700 }}>Communication.</Box>
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9, maxWidth: { md: 350, lg: 500 }, lineHeight: 1.7, fontSize: { md: '0.875rem', lg: '1rem' } }}>
              Create your account and unlock enterprise-grade video conferencing with advanced collaboration features trusted by millions of professionals worldwide.
            </Typography>
          </Box>
        </Grid>
      </Grid>
      
      <CameraCapture open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={handlePhotoCapture} currentPhoto={profilePhoto || profilePhotoRef.current} />
    </Box>
  );
};

export default Register;