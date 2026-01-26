import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Grid,
  Tooltip,
  useTheme,
  alpha,
  Snackbar,
  Alert,
  Stack,
  Paper,
  Divider,
  InputAdornment
} from '@mui/material';
import {
  VideoCall,
  Launch,
  ContentCopy,
  Schedule,
  CalendarMonth,
  Link,
  QrCode,
  Share,
  Close,
  CheckCircle,
  ArrowForward
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const QuickActions = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [joinDialog, setJoinDialog] = useState(false);
  const [shareDialog, setShareDialog] = useState(false);
  const [meetingId, setMeetingId] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // FIXED: Direct navigation to instant meeting like "Start Now" button
  const handleInstantMeeting = () => {
    console.log('🚀 Quick Actions: Navigating to instant meeting...');
    navigate('/meeting/instant');
  };

  // Updated with teal-blue color scheme
  const quickActions = [
    {
      id: 'instant',
      title: 'Start Meeting',
      description: 'Create and start immediately',
      icon: <VideoCall />,
      color: '#1A8A8A', // Teal
      bgColor: 'rgba(26, 138, 138, 0.1)',
      borderColor: 'rgba(26, 138, 138, 0.3)',
      action: handleInstantMeeting,
      primary: true
    },
    {
      id: 'join',
      title: 'Join Meeting',
      description: 'Enter meeting ID or link',
      icon: <Launch />,
      color: '#2D7DD2', // Blue
      bgColor: 'rgba(45, 125, 210, 0.1)',
      borderColor: 'rgba(45, 125, 210, 0.3)',
      action: () => setJoinDialog(true)
    },
    {
      id: 'schedule',
      title: 'Schedule',
      description: 'Plan for later',
      icon: <Schedule />,
      color: '#F59E0B', // Amber
      bgColor: 'rgba(245, 158, 11, 0.1)',
      borderColor: 'rgba(245, 158, 11, 0.3)',
      action: () => navigate('/schedule')
    },
    {
      id: 'calendar',
      title: 'Calendar',
      description: 'View appointments',
      icon: <CalendarMonth />,
      color: '#8B5CF6', // Purple
      bgColor: 'rgba(139, 92, 246, 0.1)',
      borderColor: 'rgba(139, 92, 246, 0.3)',
      action: () => navigate('/calendar')
    }
  ];

  const handleJoinMeeting = () => {
    if (!meetingId.trim()) {
      setSnackbar({
        open: true,
        message: 'Please enter a meeting ID or link',
        severity: 'error'
      });
      return;
    }

    // Extract meeting ID from URL if full link is provided
    let id = meetingId;
    if (meetingId.includes('/meeting/')) {
      id = meetingId.split('/meeting/')[1];
    }

    navigate(`/meeting/${id}`);
    setJoinDialog(false);
    setMeetingId('');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setSnackbar({
      open: true,
      message: 'Meeting link copied to clipboard!',
      severity: 'success'
    });
  };

  const handleShareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join my meeting',
        text: 'Click the link to join my video meeting',
        url: generatedLink
      });
    } else {
      handleCopyLink();
    }
  };

  return (
    <Box>
      {/* Primary Actions */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {/* Start Meeting - Primary Action */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: '2px solid',
              borderColor: '#1A8A8A',
              backgroundColor: 'rgba(26, 138, 138, 0.05)',
              borderRadius: 3,
              cursor: 'pointer',
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                backgroundColor: 'rgba(26, 138, 138, 0.1)',
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 25px rgba(26, 138, 138, 0.2)'
              }
            }}
            onClick={handleInstantMeeting}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: 2,
                  backgroundColor: '#1A8A8A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  boxShadow: '0 4px 14px rgba(26, 138, 138, 0.4)',
                }}
              >
                <VideoCall sx={{ fontSize: 26 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight={600} sx={{ color: '#1F2937' }}>
                  Start Meeting
                </Typography>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>
                  Create and start immediately
                </Typography>
              </Box>
              <ArrowForward sx={{ color: '#1A8A8A' }} />
            </Stack>
          </Paper>
        </Grid>

        {/* Join Meeting - Secondary Action */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: '1px solid',
              borderColor: 'rgba(45, 125, 210, 0.2)',
              borderRadius: 3,
              cursor: 'pointer',
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                borderColor: '#2D7DD2',
                backgroundColor: 'rgba(45, 125, 210, 0.05)',
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 25px rgba(45, 125, 210, 0.15)'
              }
            }}
            onClick={() => setJoinDialog(true)}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: 2,
                  backgroundColor: 'rgba(45, 125, 210, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2D7DD2',
                  border: '1px solid rgba(45, 125, 210, 0.2)',
                }}
              >
                <Launch sx={{ fontSize: 26 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight={600} sx={{ color: '#1F2937' }}>
                  Join Meeting
                </Typography>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>
                  Enter meeting ID or link
                </Typography>
              </Box>
              <ArrowForward sx={{ color: '#9CA3AF' }} />
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Secondary Actions */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Button
            fullWidth
            variant="outlined"
            size="large"
            startIcon={<Schedule />}
            onClick={() => navigate('/schedule')}
            sx={{
              py: 2,
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 2,
              borderColor: 'rgba(245, 158, 11, 0.3)',
              color: '#F59E0B',
              backgroundColor: 'rgba(245, 158, 11, 0.05)',
              '&:hover': {
                borderColor: '#F59E0B',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
              }
            }}
          >
            Schedule Meeting
          </Button>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Button
            fullWidth
            variant="outlined"
            size="large"
            startIcon={<CalendarMonth />}
            onClick={() => navigate('/calendar')}
            sx={{
              py: 2,
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 2,
              borderColor: 'rgba(139, 92, 246, 0.3)',
              color: '#8B5CF6',
              backgroundColor: 'rgba(139, 92, 246, 0.05)',
              '&:hover': {
                borderColor: '#8B5CF6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
              }
            }}
          >
            View Calendar
          </Button>
        </Grid>
      </Grid>


      {/* Join Meeting Dialog - Updated with teal-blue theme */}
      <Dialog 
        open={joinDialog} 
        onClose={() => setJoinDialog(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
          }
        }}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          pb: 1,
          borderBottom: '1px solid #E5E7EB',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                background: 'linear-gradient(135deg, rgba(26, 138, 138, 0.15) 0%, rgba(45, 125, 210, 0.15) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(45, 125, 210, 0.2)',
              }}
            >
              <Launch sx={{ color: '#2D7DD2', fontSize: 22 }} />
            </Box>
            <Typography variant="h6" fontWeight={600} sx={{ color: '#1F2937' }}>
              Join Meeting
            </Typography>
          </Box>
          <IconButton 
            onClick={() => setJoinDialog(false)} 
            size="small"
            sx={{ 
              color: '#6B7280',
              '&:hover': { backgroundColor: 'rgba(107, 114, 128, 0.1)' }
            }}
          >
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          <TextField
            autoFocus
            fullWidth
            label="Meeting ID or Link"
            placeholder="Enter meeting ID or paste meeting link"
            value={meetingId}
            onChange={(e) => setMeetingId(e.target.value)}
            variant="outlined"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Link sx={{ color: '#2D7DD2' }} />
                </InputAdornment>
              )
            }}
            sx={{ 
              mb: 2, 
              mt: 3,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                '&:hover fieldset': {
                  borderColor: '#2D7DD2',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#2D7DD2',
                }
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: '#2D7DD2',
              }
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleJoinMeeting();
              }
            }}
          />
          <Typography variant="body2" sx={{ color: '#6B7280' }}>
            Enter a meeting ID (e.g., 123-456-789) or paste a complete meeting link
          </Typography>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 2, gap: 1.5, borderTop: '1px solid #E5E7EB' }}>
          <Button 
            onClick={() => setJoinDialog(false)}
            variant="outlined"
            sx={{ 
              textTransform: 'none',
              fontWeight: 500,
              px: 3,
              borderRadius: 2,
              borderColor: '#E5E7EB',
              color: '#6B7280',
              '&:hover': {
                backgroundColor: 'rgba(107, 114, 128, 0.08)',
                borderColor: '#D1D5DB',
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleJoinMeeting}
            disabled={!meetingId.trim()}
            sx={{ 
              textTransform: 'none',
              fontWeight: 600,
              px: 4,
              borderRadius: 2,
              backgroundColor: '#2D7DD2',
              boxShadow: '0 4px 14px rgba(45, 125, 210, 0.4)',
              '&:hover': {
                backgroundColor: '#2570C3',
                boxShadow: '0 6px 20px rgba(45, 125, 210, 0.5)',
              },
              '&:disabled': {
                backgroundColor: '#E5E7EB',
                color: '#9CA3AF',
              }
            }}
          >
            Join Meeting
          </Button>
        </DialogActions>
      </Dialog>

      {/* Share Meeting Dialog - Updated with teal-blue theme */}
      <Dialog 
        open={shareDialog} 
        onClose={() => setShareDialog(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
          }
        }}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          pb: 1,
          borderBottom: '1px solid #E5E7EB',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                backgroundColor: 'rgba(26, 138, 138, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(26, 138, 138, 0.2)',
              }}
            >
              <VideoCall sx={{ color: '#1A8A8A', fontSize: 22 }} />
            </Box>
            <Typography variant="h6" fontWeight={600} sx={{ color: '#1F2937' }}>
              Meeting Created
            </Typography>
          </Box>
          <IconButton 
            onClick={() => setShareDialog(false)} 
            size="small"
            sx={{ 
              color: '#6B7280',
              '&:hover': { backgroundColor: 'rgba(107, 114, 128, 0.1)' }
            }}
          >
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1" sx={{ mb: 3, fontWeight: 500, color: '#1F2937' }}>
            Your meeting is ready. Share this link with participants:
          </Typography>
          
          <TextField
            fullWidth
            value={generatedLink}
            variant="outlined"
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Copy Link">
                    <IconButton onClick={handleCopyLink} edge="end" sx={{ color: '#2D7DD2' }}>
                      <ContentCopy />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              )
            }}
            sx={{ 
              mb: 3,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              }
            }}
          />

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip
              icon={<ContentCopy />}
              label="Copy Link"
              onClick={handleCopyLink}
              clickable
              variant="outlined"
              sx={{ 
                borderColor: '#2D7DD2',
                color: '#2D7DD2',
                fontWeight: 500,
                '&:hover': { backgroundColor: 'rgba(45, 125, 210, 0.08)' }
              }}
            />
            <Chip
              icon={<Share />}
              label="Share"
              onClick={handleShareLink}
              clickable
              variant="outlined"
              sx={{ 
                borderColor: '#1A8A8A',
                color: '#1A8A8A',
                fontWeight: 500,
                '&:hover': { backgroundColor: 'rgba(26, 138, 138, 0.08)' }
              }}
            />
            <Chip
              icon={<QrCode />}
              label="QR Code"
              clickable
              variant="outlined"
              sx={{ 
                borderColor: '#F59E0B',
                color: '#F59E0B',
                fontWeight: 500,
                '&:hover': { backgroundColor: 'rgba(245, 158, 11, 0.08)' }
              }}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 2, gap: 1.5, borderTop: '1px solid #E5E7EB' }}>
          <Button 
            onClick={() => setShareDialog(false)}
            variant="outlined"
            sx={{ 
              textTransform: 'none',
              fontWeight: 500,
              borderRadius: 2,
              borderColor: '#E5E7EB',
              color: '#6B7280',
              '&:hover': {
                backgroundColor: 'rgba(107, 114, 128, 0.08)',
                borderColor: '#D1D5DB',
              }
            }}
          >
            Close
          </Button>
          <Button 
            variant="contained" 
            onClick={() => {
              navigate(`/meeting/${generatedLink.split('/meeting/')[1]}`);
              setShareDialog(false);
            }}
            sx={{ 
              textTransform: 'none',
              fontWeight: 600,
              px: 4,
              borderRadius: 2,
              backgroundColor: '#1A8A8A',
              boxShadow: '0 4px 14px rgba(26, 138, 138, 0.4)',
              '&:hover': {
                backgroundColor: '#158080',
                boxShadow: '0 6px 20px rgba(26, 138, 138, 0.5)',
              },
            }}
          >
            Start Meeting
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          severity={snackbar.severity} 
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{ 
            borderRadius: 2,
            fontWeight: 500
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default QuickActions;