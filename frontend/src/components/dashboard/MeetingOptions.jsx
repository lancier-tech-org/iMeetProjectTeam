import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  IconButton,
  Chip,
  Divider,
  useTheme,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  Alert,
  Paper,
  Stack
} from '@mui/material';
import {
  VideoCall,
  Schedule,
  CalendarMonth,
  Launch,
  ContentCopy,
  Settings,
  PersonAdd,
  AccessTime,
  Groups,
  Close,
  Link as LinkIcon,
  Tag,
  ArrowForward,
  CheckCircle
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const MeetingOptions = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  
  // Modal state
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [meetingInput, setMeetingInput] = useState('');
  const [inputError, setInputError] = useState('');

  // Updated with teal-blue color scheme
  const meetingTypes = [
    {
      id: 'instant',
      title: 'Instant Meeting',
      description: 'Start a meeting right now',
      icon: <VideoCall sx={{ fontSize: 28 }} />,
      color: '#1A8A8A', // Teal
      bgColor: 'rgba(26, 138, 138, 0.1)',
      borderColor: 'rgba(26, 138, 138, 0.2)',
      features: ['Start immediately', 'Share link', 'No scheduling'],
      action: 'Start Now',
      route: '/meeting/instant'
    },
    {
      id: 'schedule',
      title: 'Schedule Meeting',
      description: 'Plan a meeting for later',
      icon: <Schedule sx={{ fontSize: 28 }} />,
      color: '#2D7DD2', // Blue
      bgColor: 'rgba(45, 125, 210, 0.1)',
      borderColor: 'rgba(45, 125, 210, 0.2)',
      features: ['Set date & time', 'Send invitations', 'Email reminders'],
      action: 'Schedule',
      route: '/schedule'
    },
    {
      id: 'calendar',
      title: 'Calendar Meeting',
      description: 'Integrate with your calendar',
      icon: <CalendarMonth sx={{ fontSize: 28 }} />,
      color: '#F59E0B', // Amber
      bgColor: 'rgba(245, 158, 11, 0.1)',
      borderColor: 'rgba(245, 158, 11, 0.2)',
      features: ['Calendar sync', 'Auto-invites', 'Availability check'],
      action: 'Calendar',
      route: '/calendar'
    }
  ];

  // Updated quick actions with matching colors
  const quickActions = [
    {
      title: 'Join Meeting',
      description: 'Enter meeting ID or link',
      icon: <Launch />,
      color: '#2D7DD2', // Blue
      bgColor: 'rgba(45, 125, 210, 0.1)',
      action: () => setJoinModalOpen(true)
    },
    {
      title: 'Meeting Settings',
      description: 'Configure default settings',
      icon: <Settings />,
      color: '#6B7280', // Grey
      bgColor: 'rgba(107, 114, 128, 0.1)',
      action: () => navigate('/settings')
    }
  ];

  // Handle button click with event propagation stop
  const handleButtonClick = (route, event) => {
    event.stopPropagation();
    event.preventDefault();
    console.log('Button clicked, navigating to:', route);
    navigate(route);
  };

  // Handle join meeting modal
  const handleJoinMeeting = () => {
    if (!meetingInput.trim()) {
      setInputError('Please enter a meeting ID or link');
      return;
    }

    setInputError('');

    let meetingId = meetingInput.trim();
    
    if (meetingInput.includes('https') || meetingInput.includes('meeting/')) {
      const urlParts = meetingInput.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      meetingId = lastPart.split('?')[0];
    }

    if (meetingId.length < 3) {
      setInputError('Meeting ID must be at least 3 characters long');
      return;
    }

    setJoinModalOpen(false);
    setMeetingInput('');
    navigate(`/meeting/${meetingId}`);
  };

  const handleCloseModal = () => {
    setJoinModalOpen(false);
    setMeetingInput('');
    setInputError('');
  };

  const isUrl = meetingInput.includes('https') || meetingInput.includes('meeting/');

  return (
    <Box>
      {/* Primary Meeting Options */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {meetingTypes.map((type) => (
          <Grid item xs={12} md={4} key={type.id}>
            <Paper
              elevation={0}
              sx={{
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.3s ease-in-out',
                border: '1px solid',
                borderColor: type.borderColor,
                borderRadius: 3,
                backgroundColor: 'white',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  borderColor: type.color,
                  transform: 'translateY(-4px)',
                  boxShadow: `0 12px 30px ${type.color}20`,
                  '& .meeting-icon': {
                    transform: 'scale(1.1)',
                    boxShadow: `0 8px 20px ${type.color}30`,
                  },
                }
              }}
              onClick={() => {
                console.log('Card clicked, navigating to:', type.route);
                navigate(type.route);
              }}
            >
              <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Icon */}
                <Box
                  className="meeting-icon"
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2.5,
                    backgroundColor: type.bgColor,
                    color: type.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease-in-out',
                    mb: 2.5,
                    alignSelf: 'flex-start',
                    border: `1px solid ${type.borderColor}`,
                  }}
                >
                  {type.icon}
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1 }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 600, 
                      mb: 0.5,
                      color: '#1F2937',
                      fontSize: '1.1rem',
                    }}
                  >
                    {type.title}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      mb: 2.5, 
                      lineHeight: 1.5,
                      color: '#6B7280',
                      fontSize: '0.875rem',
                    }}
                  >
                    {type.description}
                  </Typography>

                  {/* Features */}
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 3, gap: 0.5 }}>
                    {type.features.map((feature, index) => (
                      <Chip
                        key={index}
                        label={feature}
                        size="small"
                        sx={{
                          backgroundColor: type.bgColor,
                          color: type.color,
                          fontWeight: 500,
                          fontSize: '0.7rem',
                          height: '24px',
                          border: `1px solid ${type.borderColor}`,
                          '& .MuiChip-label': {
                            px: 1,
                          },
                        }}
                      />
                    ))}
                  </Stack>
                </Box>

                {/* Action Button */}
                <Button
                  className="action-button"
                  variant="contained"
                  fullWidth
                  endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
                  onClick={(event) => handleButtonClick(type.route, event)}
                  sx={{
                    backgroundColor: type.color,
                    color: 'white',
                    fontWeight: 600,
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontSize: '0.9rem',
                    boxShadow: `0 4px 14px ${type.color}40`,
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      backgroundColor: type.color,
                      filter: 'brightness(0.9)',
                      boxShadow: `0 6px 20px ${type.color}50`,
                      transform: 'translateY(-1px)',
                    }
                  }}
                >
                  {type.action}
                </Button>
              </CardContent>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Quick Actions */}
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 600, 
            mb: 2,
            color: '#1F2937',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            '&::before': {
              content: '""',
              width: '4px',
              height: '20px',
              background: 'linear-gradient(180deg, #1A8A8A 0%, #2D7DD2 100%)',
              borderRadius: '2px',
            }
          }}
        >
          Quick Actions
        </Typography>
        <Grid container spacing={2}>
          {quickActions.map((action, index) => (
            <Grid item xs={12} sm={6} key={index}>
              <Paper
                elevation={0}
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.3s ease-in-out',
                  border: '1px solid #E5E7EB',
                  borderRadius: 2,
                  backgroundColor: 'white',
                  '&:hover': {
                    borderColor: action.color,
                    backgroundColor: action.bgColor,
                    transform: 'translateY(-2px)',
                    boxShadow: `0 8px 20px ${action.color}15`,
                  }
                }}
                onClick={action.action}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 2,
                        backgroundColor: action.bgColor,
                        color: action.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${action.color}20`,
                      }}
                    >
                      {action.icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography 
                        variant="subtitle1" 
                        sx={{ 
                          fontWeight: 600,
                          color: '#1F2937',
                          fontSize: '0.95rem',
                        }}
                      >
                        {action.title}
                      </Typography>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: '#6B7280',
                          fontSize: '0.8rem',
                        }}
                      >
                        {action.description}
                      </Typography>
                    </Box>
                    <ArrowForward sx={{ color: '#9CA3AF', fontSize: 20 }} />
                  </Stack>
                </CardContent>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Platform Stats - Updated with teal-blue theme */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          background: 'linear-gradient(135deg, rgba(26, 138, 138, 0.05) 0%, rgba(45, 125, 210, 0.05) 100%)',
          border: '1px solid',
          borderColor: 'rgba(45, 125, 210, 0.15)',
          borderRadius: 3,
        }}
      >
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={8}>
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 600, 
                mb: 1,
                color: '#1F2937',
              }}
            >
              Trusted Platform
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              Join millions of users who rely on our platform for seamless video meetings
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack direction="row" spacing={4} justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    fontWeight: 700,
                    color: '#1A8A8A', // Teal
                  }}
                >
                  99.9%
                </Typography>
                <Typography variant="caption" sx={{ color: '#6B7280' }}>
                  Uptime
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
                  <Groups sx={{ fontSize: 20, color: '#2D7DD2' }} />
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      fontWeight: 700,
                      color: '#2D7DD2', // Blue
                    }}
                  >
                    50+
                  </Typography>
                </Stack>
                <Typography variant="caption" sx={{ color: '#6B7280' }}>
                  Participants
                </Typography>
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Join Meeting Modal - Updated with teal-blue theme */}
      <Dialog 
        open={joinModalOpen} 
        onClose={handleCloseModal}
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
            onClick={handleCloseModal} 
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
          <Typography variant="body1" sx={{ mb: 3, color: '#6B7280' }}>
            Enter a meeting ID or paste a meeting link to join the conversation
          </Typography>

          <TextField
            fullWidth
            autoFocus
            label="Meeting ID or Link"
            placeholder="e.g., 123-456-789 or https://example.com/meeting/123-456-789"
            value={meetingInput}
            onChange={(e) => {
              setMeetingInput(e.target.value);
              if (inputError) setInputError('');
            }}
            error={!!inputError}
            helperText={inputError}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {isUrl ? <LinkIcon sx={{ color: '#2D7DD2' }} /> : <Tag sx={{ color: '#2D7DD2' }} />}
                </InputAdornment>
              ),
            }}
            sx={{ 
              mb: 2,
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

          {meetingInput && !inputError && (
            <Alert 
              severity="success" 
              variant="outlined"
              icon={<CheckCircle />}
              sx={{ 
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                borderColor: 'rgba(16, 185, 129, 0.3)',
                color: '#10B981',
                '& .MuiAlert-icon': {
                  color: '#10B981'
                },
                borderRadius: 2,
                mb: 1
              }}
            >
              {isUrl ? 'Meeting link detected - Ready to join!' : 'Meeting ID entered - Ready to join!'}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ 
          p: 3, 
          pt: 2, 
          gap: 1.5,
          borderTop: '1px solid #E5E7EB',
        }}>
          <Button 
            onClick={handleCloseModal}
            variant="outlined"
            sx={{ 
              textTransform: 'none',
              fontWeight: 500,
              px: 3,
              py: 1,
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
            disabled={!meetingInput.trim()}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              px: 4,
              py: 1,
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
    </Box>
  );
};

export default MeetingOptions;