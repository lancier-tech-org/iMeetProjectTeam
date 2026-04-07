import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Switch,
  Button,
  Divider,
  Avatar,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Tabs,
  Tab,
  Paper,
  IconButton,
  alpha,
  Stack,
  Badge,
  Tooltip,
  LinearProgress,
  FormControlLabel,
  InputAdornment,
  Breadcrumbs,
  Link,
  createTheme,
  ThemeProvider,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import {
  Person,
  VideoCall,
  Notifications,
  Security,
  Save,
  Shield,
  Home,
  PhotoCamera,
  CheckCircle,
  Cancel,
  Payment,
  Check,
  Close,
  AccessTime,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import BillingTab from './BillingTab';

// ============================================
// ✅ COLOR PALETTE & THEME
// ============================================
const colors = {
  teal: '#1A8A8A',
  blue: '#2D7DD2',
  deepBlue: '#3B5998',
  amber: '#F59E0B',
  green: '#10B981',
  red: '#EF4444',
  purple: '#8B5CF6',
  orange: '#F97316',
  pink: '#EC4899',
  grey: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
  text: {
    primary: '#1F2937',
    secondary: '#6B7280',
    disabled: '#9CA3AF',
  },
  gradients: {
    primary: 'linear-gradient(135deg, #1A8A8A 0%, #2D7DD2 100%)',
    tealBlue: 'linear-gradient(135deg, #1A8A8A 0%, #3B5998 100%)',
    success: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
    warning: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
    error: 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)',
    purple: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
    gold: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    platinum: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
  }
};

const cleanTheme = createTheme({
  palette: {
    primary: { main: colors.teal, contrastText: '#fff' },
    secondary: { main: colors.grey[500] },
    background: { default: colors.grey[50], paper: '#ffffff' },
    text: { primary: colors.text.primary, secondary: colors.text.secondary },
    divider: colors.grey[200],
    success: { main: colors.green },
    warning: { main: colors.amber },
    error: { main: colors.red },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h5: { fontWeight: 600, fontSize: '1.5rem' },
    h6: { fontWeight: 600, fontSize: '1.25rem' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          borderRadius: 12,
          border: '1px solid',
          borderColor: colors.grey[200],
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 500, borderRadius: 8 },
        contained: {
          background: colors.gradients.primary,
          boxShadow: 'none',
          '&:hover': { background: colors.gradients.tealBlue }
        },
      }
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          '&.Mui-selected': { fontWeight: 600, color: colors.teal }
        }
      }
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { backgroundColor: colors.teal, height: 3 }
      }
    }
  }
});

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

// ============================================
// ✅ PROFILE TAB COMPONENT
// ============================================
const ProfileTab = ({ 
  userProfile, 
  isDragging, 
  handleProfileUpdate, 
  handleDragOver, 
  handleDragLeave, 
  handleDrop, 
  triggerFileUpload, 
  fileInputRef, 
  handleProfilePictureChange 
}) => (
  <Card>
    <CardContent sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
        Profile Information
      </Typography>
      <Typography variant="body2" sx={{ color: colors.text.secondary, mb: 3 }}>
        Update your personal details and contact information
      </Typography>
      <Divider sx={{ mb: 3 }} />
      
      {/* Profile Picture */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
        <input 
          type="file" 
          accept="image/*" 
          style={{ display: 'none' }} 
          ref={fileInputRef}
          onChange={(e) => e.target.files?.[0] && handleProfilePictureChange(e.target.files[0])} 
        />
        <Badge 
          overlap="circular" 
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          badgeContent={
            <IconButton 
              size="small" 
              onClick={triggerFileUpload}
              sx={{ 
                background: colors.gradients.primary, 
                color: 'white', 
                width: 36, 
                height: 36,
                '&:hover': { background: colors.gradients.tealBlue }
              }}
            >
              <PhotoCamera fontSize="small" />
            </IconButton>
          }
        >
          <Avatar 
            src={userProfile.profilePicture} 
            onDragOver={handleDragOver} 
            onDragLeave={handleDragLeave}
            onDrop={handleDrop} 
            onClick={triggerFileUpload}
            sx={{ 
              width: 100, 
              height: 100, 
              background: colors.gradients.primary, 
              fontSize: '2rem', 
              cursor: 'pointer',
              border: `3px solid ${isDragging ? colors.teal : 'white'}`,
              boxShadow: `0 4px 12px ${alpha(colors.teal, 0.2)}`,
            }}
          >
            {!userProfile.profilePicture && 
              `${userProfile.firstName?.charAt(0) || 'U'}${userProfile.lastName?.charAt(0) || ''}`
            }
          </Avatar>
        </Badge>
        <Box>
          <Typography variant="body2" color="text.secondary">Click camera icon to upload</Typography>
          <Typography variant="caption" color="text.secondary">JPG, PNG or GIF. Max 5MB</Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Form Fields */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6}>
          <TextField 
            fullWidth 
            label="First Name" 
            size="small" 
            value={userProfile.firstName || ''}
            onChange={(e) => handleProfileUpdate('firstName', e.target.value)} 
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField 
            fullWidth 
            label="Last Name" 
            size="small" 
            value={userProfile.lastName || ''}
            onChange={(e) => handleProfileUpdate('lastName', e.target.value)} 
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField 
            fullWidth 
            label="Email" 
            size="small" 
            type="email" 
            value={userProfile.email || ''}
            onChange={(e) => handleProfileUpdate('email', e.target.value)} 
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField 
            fullWidth 
            label="Phone Number" 
            size="small" 
            value={userProfile.phoneNumber || ''}
            onChange={(e) => handleProfileUpdate('phoneNumber', e.target.value.replace(/[^\d\+\-\(\)\s]/g, ''))} 
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField 
            fullWidth 
            label="Job Title" 
            size="small" 
            value={userProfile.jobTitle || ''}
            onChange={(e) => handleProfileUpdate('jobTitle', e.target.value)} 
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField 
            fullWidth 
            label="Department" 
            size="small" 
            value={userProfile.department || ''}
            onChange={(e) => handleProfileUpdate('department', e.target.value)} 
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField 
            fullWidth 
            label="Organization" 
            size="small" 
            value={userProfile.organization || ''}
            onChange={(e) => handleProfileUpdate('organization', e.target.value)} 
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Timezone</InputLabel>
            <Select 
              value={userProfile.timezone || ''} 
              label="Timezone"
              onChange={(e) => handleProfileUpdate('timezone', e.target.value)}
            >
              <MenuItem value="UTC+5:30">India Standard Time (UTC+5:30)</MenuItem>
              <MenuItem value="UTC-8">Pacific Time (UTC-8)</MenuItem>
              <MenuItem value="UTC-5">Eastern Time (UTC-5)</MenuItem>
              <MenuItem value="UTC+0">GMT (UTC+0)</MenuItem>
              <MenuItem value="UTC+1">Central European Time (UTC+1)</MenuItem>
              <MenuItem value="UTC+8">China Standard Time (UTC+8)</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <TextField 
            fullWidth 
            label="Location" 
            size="small" 
            multiline 
            rows={2}
            value={userProfile.location || ''} 
            onChange={(e) => handleProfileUpdate('location', e.target.value)} 
            placeholder="City, State, Country"
          />
        </Grid>
      </Grid>
    </CardContent>
  </Card>
);

// ============================================
// ✅ MEETINGS TAB COMPONENT
// ============================================
const MeetingTab = ({ meetingSettings, handleMeetingSettingUpdate }) => (
  <Grid container spacing={2.5}>
    <Grid item xs={12} md={6}>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
            Default Settings
          </Typography>
          <Stack spacing={2}>
            {[
              { key: 'defaultCameraState', label: 'Camera On by Default', desc: 'Start with camera enabled' },
              { key: 'defaultMicrophoneState', label: 'Microphone On by Default', desc: 'Start with mic enabled' },
              { key: 'autoJoinAudio', label: 'Auto-join Audio', desc: 'Auto connect to audio when joining' },
            ].map(({ key, label, desc }) => (
              <FormControlLabel 
                key={key}
                control={
                  <Switch 
                    checked={meetingSettings[key]} 
                    onChange={(e) => handleMeetingSettingUpdate(key, e.target.checked)} 
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>{label}</Typography>
                    <Typography variant="caption" color="text.secondary">{desc}</Typography>
                  </Box>
                } 
              />
            ))}
          </Stack>
          <Divider sx={{ my: 2.5 }} />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Video Quality</InputLabel>
                <Select 
                  value={meetingSettings.videoQuality} 
                  label="Video Quality"
                  onChange={(e) => handleMeetingSettingUpdate('videoQuality', e.target.value)}
                >
                  <MenuItem value="SD">Standard (480p)</MenuItem>
                  <MenuItem value="HD">HD (720p)</MenuItem>
                  <MenuItem value="FHD">Full HD (1080p)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Audio Quality</InputLabel>
                <Select 
                  value={meetingSettings.audioQuality} 
                  label="Audio Quality"
                  onChange={(e) => handleMeetingSettingUpdate('audioQuality', e.target.value)}
                >
                  <MenuItem value="Low">Low</MenuItem>
                  <MenuItem value="Medium">Medium</MenuItem>
                  <MenuItem value="High">High</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={6}>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
            Security & Privacy
          </Typography>
          <Stack spacing={2}>
            {[
              { key: 'enableWaitingRoom', label: 'Waiting Room', desc: 'Require host approval to join' },
              { key: 'requireMeetingPassword', label: 'Meeting Password', desc: 'Require password to join' },
              { key: 'allowParticipantScreenShare', label: 'Allow Screen Sharing', desc: 'Participants can share screen' },
              { key: 'recordMeetingsByDefault', label: 'Auto-record Meetings', desc: 'Start recording automatically' },
            ].map(({ key, label, desc }) => (
              <FormControlLabel 
                key={key}
                control={
                  <Switch 
                    checked={meetingSettings[key]} 
                    onChange={(e) => handleMeetingSettingUpdate(key, e.target.checked)} 
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>{label}</Typography>
                    <Typography variant="caption" color="text.secondary">{desc}</Typography>
                  </Box>
                } 
              />
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  </Grid>
);

// ============================================
// ✅ NOTIFICATIONS TAB COMPONENT
// ============================================
const NotificationTab = ({ notificationSettings, handleNotificationUpdate }) => (
  <Grid container spacing={2.5}>
    <Grid item xs={12} md={6}>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
            Notification Preferences
          </Typography>
          <Stack spacing={2}>
            {[
              { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive notifications via email' },
              { key: 'meetingReminders', label: 'Meeting Reminders', desc: 'Get reminded before meetings' },
              { key: 'securityAlerts', label: 'Security Alerts', desc: 'Important security notifications' },
            ].map(({ key, label, desc }) => (
              <FormControlLabel 
                key={key}
                control={
                  <Switch 
                    checked={notificationSettings[key]} 
                    onChange={(e) => handleNotificationUpdate(key, e.target.checked)} 
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>{label}</Typography>
                    <Typography variant="caption" color="text.secondary">{desc}</Typography>
                  </Box>
                } 
              />
            ))}
          </Stack>
          <Divider sx={{ my: 2.5 }} />
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
            Meeting Reminder Timing
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Reminder Time</InputLabel>
            <Select 
              value={notificationSettings.reminderTiming} 
              label="Reminder Time"
              onChange={(e) => handleNotificationUpdate('reminderTiming', e.target.value)}
            >
              {[5, 10, 15, 30, 60].map(m => (
                <MenuItem key={m} value={m}>{m} minutes before</MenuItem>
              ))}
            </Select>
          </FormControl>
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={6}>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
            Quiet Hours
          </Typography>
          <FormControlLabel
            control={
              <Switch 
                checked={notificationSettings.quietHoursEnabled}
                onChange={(e) => handleNotificationUpdate('quietHoursEnabled', e.target.checked)} 
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={500}>Enable Quiet Hours</Typography>
                <Typography variant="caption" color="text.secondary">
                  Disable notifications during specified hours
                </Typography>
              </Box>
            } 
          />
          {notificationSettings.quietHoursEnabled && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <TextField 
                  fullWidth 
                  label="Start Time" 
                  type="time" 
                  size="small" 
                  InputLabelProps={{ shrink: true }}
                  value={notificationSettings.quietHoursStart} 
                  onChange={(e) => handleNotificationUpdate('quietHoursStart', e.target.value)} 
                />
              </Grid>
              <Grid item xs={6}>
                <TextField 
                  fullWidth 
                  label="End Time" 
                  type="time" 
                  size="small" 
                  InputLabelProps={{ shrink: true }}
                  value={notificationSettings.quietHoursEnd} 
                  onChange={(e) => handleNotificationUpdate('quietHoursEnd', e.target.value)} 
                />
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>
    </Grid>
  </Grid>
);

// ============================================
// ✅ SECURITY TAB COMPONENT
// ============================================
const SecurityTab = ({ securitySettings, handleSecurityUpdate, calculateSecurityScore }) => {
  const score = calculateSecurityScore();
  
  return (
    <Box>
      {/* Security Score Card */}
      <Card sx={{ 
        mb: 2.5, 
        background: `linear-gradient(135deg, ${alpha(colors.teal, 0.08)} 0%, ${alpha(colors.blue, 0.08)} 100%)`,
        border: `1px solid ${alpha(colors.teal, 0.2)}`,
      }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight={600}>Security Score</Typography>
              <Typography variant="body2" color="text.secondary">
                {score >= 80 ? 'Excellent security posture' : score >= 60 ? 'Good security settings' : 'Needs improvement'}
              </Typography>
            </Box>
            <Chip 
              label={`${score}%`} 
              sx={{
                fontWeight: 600, 
                fontSize: '1rem',
                px: 1.5, 
                color: 'white',
                background: score >= 80 ? colors.gradients.success : score >= 60 ? colors.gradients.warning : colors.gradients.error
              }} 
            />
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={score} 
            sx={{
              height: 8, 
              borderRadius: 4, 
              bgcolor: alpha(colors.grey[300], 0.3),
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                background: score >= 80 ? colors.gradients.success : score >= 60 ? colors.gradients.warning : colors.gradients.error
              }
            }} 
          />
        </CardContent>
      </Card>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight={600}>Authentication</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="body2" fontWeight={500}>Two-Factor Authentication</Typography>
                  <Typography variant="caption" color="text.secondary">Add extra security with 2FA</Typography>
                </Box>
                <Switch 
                  checked={securitySettings.twoFactorAuthentication}
                  onChange={(e) => handleSecurityUpdate('twoFactorAuthentication', e.target.checked)} 
                />
              </Box>
              {!securitySettings.twoFactorAuthentication && (
                <Chip label="Recommended" size="small" color="warning" variant="outlined" sx={{ mb: 2 }} />
              )}
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Session Timeout</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                Automatically sign out after inactivity
              </Typography>
              <FormControl fullWidth size="small">
                <InputLabel>Timeout Duration</InputLabel>
                <Select 
                  value={securitySettings.sessionTimeout} 
                  label="Timeout Duration"
                  onChange={(e) => handleSecurityUpdate('sessionTimeout', e.target.value)}
                >
                  <MenuItem value={60}>1 hour</MenuItem>
                  <MenuItem value={240}>4 hours</MenuItem>
                  <MenuItem value={480}>8 hours</MenuItem>
                  <MenuItem value={1440}>24 hours</MenuItem>
                  <MenuItem value={0}>Never</MenuItem>
                </Select>
              </FormControl>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight={600}>Security Monitoring</Typography>
              <Stack spacing={2}>
                {[
                  { key: 'loginNotifications', label: 'Login Notifications', desc: 'Get notified of new sign-ins' },
                  { key: 'suspiciousActivityAlerts', label: 'Suspicious Activity Alerts', desc: 'Alerts for unusual activity' },
                  { key: 'auditLogging', label: 'Audit Logging', desc: 'Log security events and access' },
                ].map(({ key, label, desc }) => (
                  <FormControlLabel 
                    key={key}
                    control={
                      <Switch 
                        checked={securitySettings[key]} 
                        onChange={(e) => handleSecurityUpdate(key, e.target.checked)} 
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight={500}>{label}</Typography>
                        <Typography variant="caption" color="text.secondary">{desc}</Typography>
                      </Box>
                    } 
                  />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

// ============================================
// ✅ MAIN COMPONENT
// ============================================
const ProfessionalSettingsPage = () => {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const getUserValue = (field, fallback = '') => user?.[field] ?? fallback;

  // Profile State
  const [userProfile, setUserProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    jobTitle: '',
    department: '',
    organization: '',
    location: '',
    timezone: '',
    profilePicture: '',
  });

  useEffect(() => {
    if (user) {
      const fullName = getUserValue('full_name') || getUserValue('name') || '';
      const [firstName = '', ...lastParts] = fullName.split(' ');
      setUserProfile({
        firstName,
        lastName: lastParts.join(' '),
        email: getUserValue('email'),
        phoneNumber: getUserValue('phone_number') || getUserValue('phoneNumber'),
        jobTitle: getUserValue('job_title') || getUserValue('jobTitle'),
        department: getUserValue('department'),
        organization: getUserValue('organization'),
        location: getUserValue('location') || getUserValue('address'),
        timezone: getUserValue('timezone') || 'UTC+5:30',
        profilePicture: getUserValue('profile_picture') || getUserValue('profilePicture'),
      });
    }
  }, [user]);

  // Meeting Settings State
  const [meetingSettings, setMeetingSettings] = useState({
    defaultCameraState: true,
    defaultMicrophoneState: false,
    autoJoinAudio: true,
    videoQuality: 'HD',
    audioQuality: 'High',
    enableWaitingRoom: true,
    requireMeetingPassword: false,
    allowParticipantScreenShare: true,
    recordMeetingsByDefault: false,
  });

  // Notification Settings State
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    meetingReminders: true,
    securityAlerts: true,
    reminderTiming: 15,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
  });

  // Security Settings State
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuthentication: false,
    sessionTimeout: 480,
    loginNotifications: true,
    suspiciousActivityAlerts: true,
    auditLogging: true,
  });

  // Billing Settings State
  const [billingSettings, setBillingSettings] = useState({
    currentPlan: 'basic',
    isTrialActive: true,
    trialEndDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    nextBillingDate: null,
    paymentMethods: [],
    invoices: [],
    usage: {
      meetings: 12,
      recordings: 3,
      storageUsed: '1.2 GB',
      totalMinutes: 485,
    },
  });

  // Handlers
  const handleProfileUpdate = useCallback((field, value) => {
    setUserProfile(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleMeetingSettingUpdate = useCallback((field, value) => {
    setMeetingSettings(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleNotificationUpdate = useCallback((field, value) => {
    setNotificationSettings(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSecurityUpdate = useCallback((field, value) => {
    setSecuritySettings(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleBillingUpdate = useCallback((field, value) => {
    setBillingSettings(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleProfilePictureChange = useCallback((file) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setSnackbar({ open: true, message: 'Invalid image format. Use JPG, PNG, GIF or WebP.', severity: 'error' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSnackbar({ open: true, message: 'Image size should be less than 5MB', severity: 'error' });
      return;
    }
    handleProfileUpdate('profilePicture', URL.createObjectURL(file));
    setSnackbar({ open: true, message: "Profile picture updated! Don't forget to save.", severity: 'success' });
  }, [handleProfileUpdate]);

  const triggerFileUpload = () => fileInputRef.current?.click();
  
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      handleProfilePictureChange(e.dataTransfer.files[0]);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const fullName = `${userProfile.firstName?.trim() || ''} ${userProfile.lastName?.trim() || ''}`.trim();
      if (!fullName) {
        setSnackbar({ open: true, message: 'Please enter at least a first name', severity: 'error' });
        setLoading(false);
        return;
      }

      const result = await updateProfile({
        full_name: fullName,
        email: userProfile.email,
        phone_number: userProfile.phoneNumber || null,
        address: userProfile.location || null,
        auto_join_video: meetingSettings.defaultCameraState,
        auto_join_audio: meetingSettings.autoJoinAudio,
        email_notifications: notificationSettings.emailNotifications,
        meeting_reminders: notificationSettings.meetingReminders,
      });

      if (result?.ok) {
        setSnackbar({ open: true, message: 'Settings saved successfully!', severity: 'success' });
      } else {
        throw new Error(result?.error || 'Update failed');
      }
    } catch (error) {
      setSnackbar({ open: true, message: error.message || 'Failed to save settings', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const calculateSecurityScore = () => {
    let score = 0;
    if (securitySettings.twoFactorAuthentication) score += 30;
    if (securitySettings.sessionTimeout <= 240) score += 20;
    if (securitySettings.loginNotifications) score += 15;
    if (securitySettings.suspiciousActivityAlerts) score += 15;
    if (securitySettings.auditLogging) score += 20;
    return Math.min(score, 100);
  };

  return (
    <ThemeProvider theme={cleanTheme}>
      <Box sx={{ minHeight: '100vh', bgcolor: colors.grey[50] }}>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          {/* Header */}
          <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: 'white', borderRadius: 2, border: `1px solid ${colors.grey[200]}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Tooltip title="Back to Dashboard">
                <IconButton 
                  onClick={() => navigate('/dashboard')}
                  sx={{ mr: 2, color: colors.teal, bgcolor: alpha(colors.teal, 0.08), '&:hover': { bgcolor: alpha(colors.teal, 0.12) } }}
                >
                  <ArrowBackIcon />
                </IconButton>
              </Tooltip>
              <Box>
                <Typography variant="h5" fontWeight={600} gutterBottom>Settings</Typography>
                <Breadcrumbs separator="›" sx={{ fontSize: '0.875rem' }}>
                  <Link 
                    onClick={() => navigate('/dashboard')} 
                    sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: colors.text.secondary, textDecoration: 'none', '&:hover': { color: colors.teal } }}
                  >
                    <Home sx={{ mr: 0.5, fontSize: 18 }} />Dashboard
                  </Link>
                  <Typography color={colors.teal} fontWeight={600}>Settings</Typography>
                </Breadcrumbs>
              </Box>
            </Box>
          </Paper>

          {/* Main Content */}
          <Paper elevation={0} sx={{ borderRadius: 2, border: `1px solid ${colors.grey[200]}`, bgcolor: 'white' }}>
            <Tabs
              value={tabValue}
              onChange={(e, v) => setTabValue(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ borderBottom: 1, borderColor: colors.grey[200], px: 2 }}
            >
              <Tab icon={<Person />} label="Profile" iconPosition="start" />
              <Tab icon={<VideoCall />} label="Meetings" iconPosition="start" />
              <Tab icon={<Notifications />} label="Notifications" iconPosition="start" />
              <Tab icon={<Security />} label="Security" iconPosition="start" />
              <Tab icon={<Payment />} label="Billing" iconPosition="start" />
            </Tabs>

            <Box sx={{ p: 3 }}>
              <TabPanel value={tabValue} index={0}>
                <ProfileTab 
                  userProfile={userProfile}
                  isDragging={isDragging}
                  handleProfileUpdate={handleProfileUpdate}
                  handleDragOver={handleDragOver}
                  handleDragLeave={handleDragLeave}
                  handleDrop={handleDrop}
                  triggerFileUpload={triggerFileUpload}
                  fileInputRef={fileInputRef}
                  handleProfilePictureChange={handleProfilePictureChange}
                />
              </TabPanel>
              <TabPanel value={tabValue} index={1}>
                <MeetingTab 
                  meetingSettings={meetingSettings}
                  handleMeetingSettingUpdate={handleMeetingSettingUpdate}
                />
              </TabPanel>
              <TabPanel value={tabValue} index={2}>
                <NotificationTab 
                  notificationSettings={notificationSettings}
                  handleNotificationUpdate={handleNotificationUpdate}
                />
              </TabPanel>
              <TabPanel value={tabValue} index={3}>
                <SecurityTab 
                  securitySettings={securitySettings}
                  handleSecurityUpdate={handleSecurityUpdate}
                  calculateSecurityScore={calculateSecurityScore}
                />
              </TabPanel>
              <TabPanel value={tabValue} index={4}>
                <BillingTab 
                  billingSettings={billingSettings}
                  handleBillingUpdate={handleBillingUpdate}
                  setSnackbar={setSnackbar}
                />
              </TabPanel>
            </Box>

            {/* Footer Actions */}
            <Box sx={{ p: 3, borderTop: 1, borderColor: colors.grey[200], bgcolor: colors.grey[50], display: 'flex', justifyContent: 'space-between' }}>
              <Button variant="outlined" color="inherit" startIcon={<Close />}>Reset</Button>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button variant="outlined" onClick={() => navigate('/dashboard')}>Cancel</Button>
                <Button 
                  variant="contained" 
                  startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Save />}
                  onClick={handleSaveSettings}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </Box>
            </Box>
          </Paper>

          {/* Snackbar */}
          <Snackbar
            open={snackbar.open}
            autoHideDuration={4000}
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            <Alert
              onClose={() => setSnackbar({ ...snackbar, open: false })}
              severity={snackbar.severity}
              variant="filled"
              sx={{ 
                background: snackbar.severity === 'success' ? colors.gradients.success : 
                           snackbar.severity === 'error' ? colors.gradients.error : colors.gradients.warning 
              }}
            >
              {snackbar.message}
            </Alert>
          </Snackbar>
        </Container>
      </Box>
    </ThemeProvider>
  );
};

export default ProfessionalSettingsPage;