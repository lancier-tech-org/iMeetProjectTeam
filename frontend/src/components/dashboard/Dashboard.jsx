// src/components/dashboard/Dashboard.jsx - TEAL-BLUE THEME VERSION WITH REAL-TIME ANIMATED SUN
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Avatar, 
  Chip,
  LinearProgress,
  useTheme,
  Container,
  Fade,
  Slide,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemButton,
  Badge,
  Skeleton,
  Paper,
  Stack,
  Tooltip
} from '@mui/material';
import {
  VideoCall,
  Schedule,
  CalendarToday,
  History,
  Person,
  MoreVert,
  Add,
  CallMerge,
  PlayArrow,
  AccessTime,
  Group,
  TrendingUp,
  RecordVoiceOver,
  CloudDownload,
  Star,
  Analytics,
  ArrowForward
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useMeeting } from '../../hooks/useMeeting';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useNotifications } from '../../hooks/useNotifications';
import MeetingOptions from './MeetingOptions';
import MeetingHistory from './MeetingHistory';

// Professional Real-time Sun Component with premium design
const RealtimeSun = ({ size = 64 }) => {
  const [sunData, setSunData] = useState({
    coreColor: '#FFD700',
    outerColor: '#FFA500',
    glowColor: 'rgba(255, 215, 0, 0.6)',
    bgGradient: 'rgba(255, 215, 0, 0.08)',
    showMoon: false,
    phasePercentage: 0
  });

  useEffect(() => {
    const updateSunStyle = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const totalMinutes = hour * 60 + minute;

      const dayStart = 5 * 60; // 5:00 AM
      const dayEnd = 19 * 60; // 7:00 PM
      const nightStart = 21 * 60; // 9:00 PM

      let coreColor, outerColor, glowColor, bgGradient, showMoon = false, phasePercentage = 0;

      if (totalMinutes < dayStart) {
        // Night: Moon phase
        showMoon = true;
        coreColor = '#F5F5F5';
        outerColor = '#E8E8E8';
        glowColor = 'rgba(200, 200, 200, 0.4)';
        bgGradient = 'rgba(100, 100, 150, 0.08)';
        phasePercentage = 0;
      } else if (totalMinutes >= dayStart && totalMinutes < dayEnd) {
        // Day: Sun phases
        const progress = (totalMinutes - dayStart) / (dayEnd - dayStart);
        phasePercentage = progress * 100;

        if (totalMinutes < 7 * 60) {
          // 5-7 AM: Deep orange sunrise
          coreColor = '#FF7F32';
          outerColor = '#FF6B35';
          glowColor = 'rgba(255, 127, 50, 0.5)';
          bgGradient = 'rgba(255, 127, 50, 0.12)';
        } else if (totalMinutes < 9 * 60) {
          // 7-9 AM: Orange
          coreColor = '#FF8C42';
          outerColor = '#FF7F32';
          glowColor = 'rgba(255, 140, 66, 0.5)';
          bgGradient = 'rgba(255, 140, 66, 0.12)';
        } else if (totalMinutes < 11 * 60) {
          // 9-11 AM: Yellow-orange
          coreColor = '#FFA500';
          outerColor = '#FF9500';
          glowColor = 'rgba(255, 165, 0, 0.55)';
          bgGradient = 'rgba(255, 165, 0, 0.12)';
        } else if (totalMinutes < 13 * 60) {
          // 11 AM - 1 PM: Bright yellow
          coreColor = '#FFD700';
          outerColor = '#FFC700';
          glowColor = 'rgba(255, 215, 0, 0.6)';
          bgGradient = 'rgba(255, 215, 0, 0.15)';
        } else if (totalMinutes < 15 * 60) {
          // 1-3 PM: Peak bright yellow
          coreColor = '#FFED4E';
          outerColor = '#FFD700';
          glowColor = 'rgba(255, 237, 78, 0.6)';
          bgGradient = 'rgba(255, 237, 78, 0.15)';
        } else if (totalMinutes < 17 * 60) {
          // 3-5 PM: Yellow-orange
          coreColor = '#FFA500';
          outerColor = '#FF9500';
          glowColor = 'rgba(255, 165, 0, 0.55)';
          bgGradient = 'rgba(255, 165, 0, 0.12)';
        } else {
          // 5-7 PM: Sunset red-orange
          coreColor = '#FF6B35';
          outerColor = '#FF5722';
          glowColor = 'rgba(255, 107, 53, 0.55)';
          bgGradient = 'rgba(255, 107, 53, 0.12)';
        }
      } else if (totalMinutes >= nightStart) {
        // Late Night: Moon
        showMoon = true;
        coreColor = '#F5F5F5';
        outerColor = '#E8E8E8';
        glowColor = 'rgba(200, 200, 200, 0.4)';
        bgGradient = 'rgba(100, 100, 150, 0.08)';
        phasePercentage = 100;
      } else {
        // Evening transition: 7-9 PM - Twilight to moon
        const transitionProgress = (totalMinutes - dayEnd) / (nightStart - dayEnd);
        coreColor = `rgb(${Math.floor(255 - 110 * transitionProgress)}, ${Math.floor(107 + 93 * transitionProgress)}, ${Math.floor(53 + 147 * transitionProgress)})`;
        outerColor = `rgb(${Math.floor(255 - 150 * transitionProgress)}, ${Math.floor(87 + 113 * transitionProgress)}, ${Math.floor(34 + 166 * transitionProgress)})`;
        glowColor = `rgba(${Math.floor(255 - 110 * transitionProgress)}, ${Math.floor(107 + 93 * transitionProgress)}, ${Math.floor(53 + 147 * transitionProgress)}, 0.5)`;
        bgGradient = `rgba(${Math.floor(255 - 110 * transitionProgress)}, ${Math.floor(107 + 93 * transitionProgress)}, ${Math.floor(53 + 147 * transitionProgress)}, 0.12)`;
        phasePercentage = transitionProgress * 100;
      }

      setSunData({ coreColor, outerColor, glowColor, bgGradient, showMoon, phasePercentage });
    };

    updateSunStyle();
    const interval = setInterval(updateSunStyle, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box
      sx={{
        width: size,
        height: size,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'wave 1s ease-in-out infinite',
        animationDelay: '2s',
        transformOrigin: 'center',
        '@keyframes wave': {
          '0%': { transform: 'rotate(0deg)' },
          '10%': { transform: 'rotate(14deg)' },
          '20%': { transform: 'rotate(-8deg)' },
          '30%': { transform: 'rotate(14deg)' },
          '40%': { transform: 'rotate(-4deg)' },
          '50%': { transform: 'rotate(10deg)' },
          '60%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(0deg)' }
        }
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{
          display: 'block',
          filter: `drop-shadow(0 0 16px ${sunData.glowColor})`
        }}
      >
        <defs>
          {/* Premium gradient for sun */}
          <radialGradient id="sunGradient" cx="35%" cy="35%">
            <stop offset="0%" stopColor={sunData.coreColor} />
            <stop offset="60%" stopColor={sunData.outerColor} />
            <stop offset="100%" stopColor={sunData.coreColor} opacity="0.3" />
          </radialGradient>

          {/* Glow filter */}
          <filter id="glowFilter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Background gradient */}
          <radialGradient id="bgGradient" cx="50%" cy="50%">
            <stop offset="0%" stopColor={sunData.bgGradient} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        {/* Outer glow circle */}
        <circle cx="50" cy="50" r="28" fill={sunData.bgGradient} opacity="0.5" />

        {/* Middle glow circle */}
        <circle cx="50" cy="50" r="24" fill={sunData.bgGradient} opacity="0.3" />

        {sunData.showMoon ? (
          // Professional Moon
          <>
            {/* Moon body */}
            <circle cx="50" cy="50" r="18" fill="url(#sunGradient)" filter="url(#glowFilter)" />
            {/* Moon shadow for depth */}
            <circle cx="50" cy="50" r="18" fill="none" stroke={sunData.outerColor} strokeWidth="0.8" opacity="0.3" />
            {/* Craters for detail */}
            <circle cx="44" cy="46" r="1.5" fill={sunData.outerColor} opacity="0.4" />
            <circle cx="54" cy="52" r="1" fill={sunData.outerColor} opacity="0.3" />
            <circle cx="49" cy="58" r="1.2" fill={sunData.outerColor} opacity="0.35" />
          </>
        ) : (
          // Professional Sun
          <>
            {/* Inner bright core */}
            <circle cx="50" cy="50" r="12" fill={sunData.coreColor} opacity="0.9" />

            {/* Main sun body with gradient */}
            <circle cx="50" cy="50" r="18" fill="url(#sunGradient)" filter="url(#glowFilter)" />

            {/* Sun rays - Professional design */}
            <g stroke={sunData.coreColor} strokeWidth="2" strokeLinecap="round" opacity="0.7">
              {/* Top ray */}
              <line x1="50" y1="24" x2="50" y2="14" />
              {/* Top-right ray */}
              <line x1="61.24" y1="28.76" x2="68.36" y2="21.64" />
              {/* Right ray */}
              <line x1="76" y1="50" x2="86" y2="50" />
              {/* Bottom-right ray */}
              <line x1="61.24" y1="71.24" x2="68.36" y2="78.36" />
              {/* Bottom ray */}
              <line x1="50" y1="76" x2="50" y2="86" />
              {/* Bottom-left ray */}
              <line x1="38.76" y1="71.24" x2="31.64" y2="78.36" />
              {/* Left ray */}
              <line x1="24" y1="50" x2="14" y2="50" />
              {/* Top-left ray */}
              <line x1="38.76" y1="28.76" x2="31.64" y2="21.64" />
            </g>

            {/* Highlight for 3D effect */}
            <ellipse cx="46" cy="44" rx="8" ry="8" fill="white" opacity="0.15" filter="url(#glowFilter)" />
          </>
        )}
      </svg>
    </Box>
  );
};

const TypingAnimation = ({ text, speed = 80, delay = 1500 }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
    setIsTyping(false);
    setShowCursor(true);
    setAnimationKey(prev => prev + 1);
  }, [text]);

  useEffect(() => {
    if (!text) return;

    if (currentIndex === 0 && animationKey > 0) {
      const startTimer = setTimeout(() => {
        setIsTyping(true);
        setCurrentIndex(1);
        setDisplayedText(text.charAt(0));
      }, delay);
      return () => clearTimeout(startTimer);
    }

    if (currentIndex > 0 && currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.substring(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, speed);
      return () => clearTimeout(timer);
    }

    if (currentIndex >= text.length && text.length > 0) {
      setIsTyping(false);
      const restartTimer = setTimeout(() => {
        setDisplayedText('');
        setCurrentIndex(0);
        setShowCursor(true);
        setAnimationKey(prev => prev + 1);
      }, 3000);
      return () => clearTimeout(restartTimer);
    }
  }, [text, currentIndex, speed, delay, animationKey]);

  useEffect(() => {
    const cursorTimer = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => clearInterval(cursorTimer);
  }, []);

  return (
    <Box 
      component="span" 
      sx={{ 
        position: 'relative',
        '@keyframes blink': {
          '0%, 50%': { opacity: 1 },
          '51%, 100%': { opacity: 0 }
        }
      }}
    >
      {displayedText}
      <Box
        component="span"
        sx={{
          display: 'inline-block',
          width: '2px',
          height: '1.2em',
          backgroundColor: 'currentColor',
          marginLeft: '2px',
          verticalAlign: 'text-top',
          opacity: showCursor ? 1 : 0,
          animation: 'blink 1.06s infinite',
        }}
      />
    </Box>
  );
};

const Dashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    recentMeetings, 
    upcomingMeetings, 
    joinMeeting, 
    loading: meetingLoading 
  } = useMeeting();
  const { 
    getUserStats, 
    loading: analyticsLoading 
  } = useAnalytics();
  const { fetchNotifications } = useNotifications();

  const [anchorEl, setAnchorEl] = useState(null);
  const [userStats, setUserStats] = useState({
  totalMeetings: 0,
  totalMinutes: 0,
  attendance: 0,
  upcomingCount: 0
});
  const [quickJoinCode, setQuickJoinCode] = useState('');

  useEffect(() => {
    console.log('🏠 Dashboard: Fetching ALL notifications');
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    loadUserStats();
  }, []);

  const loadUserStats = async () => {
    try {
      const stats = await getUserStats();
      setUserStats(stats);
    } catch (error) {
      console.error('Failed to load user stats:', error);
    }
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleQuickJoin = async () => {
    if (quickJoinCode.trim()) {
      try {
        await joinMeeting(quickJoinCode.trim());
        navigate(`/meeting/${quickJoinCode.trim()}`);
      } catch (error) {
        console.error('Failed to join meeting:', error);
      }
    }
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const truncateText = (text, maxLength = 10) => {
    if (!text) return text;
    const str = text.toString();
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getUserName = () => {
    return user?.full_name?.split(' ')[0] || 'User';
  };


  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F0F9F9 0%, #EBF4FC 50%, #F5F7FA 100%)',
      pt: 3,
      pb: 6
    }}>
      <Container maxWidth="xl">
        {/* Header Section */}
        <Fade in timeout={800}>
          <Box mb={5}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 600,
                  color: '#1F2937',
                  fontSize: { xs: '1.75rem', md: '2.125rem' }
                }}
              >
                {getGreeting()}, <TypingAnimation text={getUserName()} speed={120} delay={800} />
              </Typography>
              <RealtimeSun size={56} />
            </Box>
            <Typography 
              variant="body1" 
              sx={{ 
                color: '#6B7280',
                fontSize: '1rem',
                maxWidth: '600px'
              }}
            >
              Manage your meetings efficiently and stay connected with your team.
            </Typography>
          </Box>
        </Fade>

        <Grid container spacing={3}>
        

          {/* Main Meeting Actions */}
          <Grid item xs={12}>
            <Slide direction="up" in timeout={1200}>
              <Paper
                elevation={0}
                sx={{
                  borderRadius: 3,
                  border: '1px solid #E5E7EB',
                  backgroundColor: 'white',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ p: 4 }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 600,
                      color: '#1F2937',
                      mb: 3,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      '&::before': {
                        content: '""',
                        width: '4px',
                        height: '24px',
                        background: 'linear-gradient(180deg, #1A8A8A 0%, #2D7DD2 100%)',
                        borderRadius: '2px',
                      }
                    }}
                  >
                    Meeting Actions
                  </Typography>
                  
                  <MeetingOptions />
                </Box>
              </Paper>
            </Slide>
          </Grid>

          {/* Recent Meetings */}
          <Grid item xs={12}>
            <MeetingHistory 
              meetings={recentMeetings} 
              loading={meetingLoading}
              limit={5}
            />
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Dashboard;