// src/components/tabs/AttendanceTabContent.jsx — Premium Attendance Dashboard Tab
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Typography, IconButton, Tooltip, useMediaQuery } from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Warning,
  CheckCircle,
  AccessTime,
  TrendingUp,
  Shield,
  Videocam,
  VideocamOff,
  FiberManualRecord,
  ExpandMore,
  ExpandLess,
  Refresh,
  Info,
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import AttendanceTracker from '../attendance/AttendanceTracker';

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATIONS
// ═══════════════════════════════════════════════════════════════════════════════
const fadeSlideUp = keyframes`
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const pulseRing = keyframes`
  0%   { transform: scale(1); opacity: 0.6; }
  50%  { transform: scale(1.15); opacity: 0.2; }
  100% { transform: scale(1); opacity: 0.6; }
`;

const breathe = keyframes`
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
`;

const glowPulse = keyframes`
  0%, 100% { box-shadow: 0 0 12px rgba(99, 102, 241, 0.15); }
  50%      { box-shadow: 0 0 28px rgba(99, 102, 241, 0.3); }
`;

const warningPulse = keyframes`
  0%, 100% { box-shadow: 0 0 12px rgba(239, 68, 68, 0.15); }
  50%      { box-shadow: 0 0 28px rgba(239, 68, 68, 0.35); }
`;

const counterTick = keyframes`
  0%   { transform: scale(1); }
  50%  { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

const gradientShift = keyframes`
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

// ═══════════════════════════════════════════════════════════════════════════════
// STYLED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const DashboardRoot = styled(Box)(() => ({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: `
    radial-gradient(ellipse 70% 50% at 30% 0%, rgba(99, 102, 241, 0.06) 0%, transparent 60%),
    radial-gradient(ellipse 60% 50% at 80% 100%, rgba(16, 185, 129, 0.04) 0%, transparent 50%),
    linear-gradient(180deg, #0c0e14 0%, #111318 40%, #0e1016 100%)
  `,
  fontFamily: "'DM Sans', 'Outfit', system-ui, sans-serif",
  color: '#e2e4ea',
}));

const ScrollArea = styled(Box)(() => ({
  flex: 1,
  overflow: 'auto',
  padding: '20px 24px 32px',
  scrollbarWidth: 'thin',
  scrollbarColor: 'rgba(255,255,255,0.08) transparent',
  '&::-webkit-scrollbar': { width: 5 },
  '&::-webkit-scrollbar-track': { background: 'transparent' },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    '&:hover': { background: 'rgba(255,255,255,0.14)' },
  },
  '@media (max-width: 639px)': {
    padding: '14px 12px 24px',
  },
  '@media (max-width: 479px)': {
    padding: '10px 8px 20px',
  },
}));

/* ── Hero status card ── */
const HeroCard = styled(Box, {
  shouldForwardProp: (p) => p !== 'hasViolations',
})(({ hasViolations }) => ({
  position: 'relative',
  borderRadius: 20,
  padding: '28px 28px 24px',
  overflow: 'hidden',
  background: hasViolations
    ? 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(30,30,42,0.95) 50%, rgba(239,68,68,0.04) 100%)'
    : 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(30,30,42,0.95) 50%, rgba(16,185,129,0.04) 100%)',
  border: `1px solid ${hasViolations ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.12)'}`,
  backdropFilter: 'blur(20px)',
  animation: `${fadeSlideUp} 0.45s ease both, ${hasViolations ? warningPulse : glowPulse} 4s ease-in-out infinite`,
  transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
  // Decorative corner accent
  '&::before': {
    content: '""',
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    height: 3,
    borderRadius: '20px 20px 0 0',
    background: hasViolations
      ? 'linear-gradient(90deg, #ef4444, #f97316, #ef4444)'
      : 'linear-gradient(90deg, #6366f1, #10b981, #6366f1)',
    backgroundSize: '200% 100%',
    animation: `${gradientShift} 4s ease infinite`,
  },
  // Glow orb
  '&::after': {
    content: '""',
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: '50%',
    background: hasViolations
      ? 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%)'
      : 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  '@media (max-width: 639px)': {
    padding: '20px 18px 18px',
    borderRadius: 16,
  },
  '@media (max-width: 479px)': {
    padding: '16px 14px 14px',
    borderRadius: 14,
  },
}));

/* ── Circular progress ring ── */
const ProgressRing = styled(Box, {
  shouldForwardProp: (p) => !['size', 'strokeWidth', 'percentage', 'color'].includes(p),
})(({ size = 110, strokeWidth = 7, percentage = 100, color = '#6366f1' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return {
    position: 'relative',
    width: size,
    height: size,
    flexShrink: 0,
    '& svg': {
      transform: 'rotate(-90deg)',
      width: size,
      height: size,
    },
    '& .track': {
      fill: 'none',
      stroke: 'rgba(255,255,255,0.05)',
      strokeWidth,
    },
    '& .progress': {
      fill: 'none',
      stroke: color,
      strokeWidth,
      strokeLinecap: 'round',
      strokeDasharray: circumference,
      strokeDashoffset: offset,
      transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.5s ease',
      filter: `drop-shadow(0 0 6px ${color}55)`,
    },
  };
});

/* ── Metric card (compact) ── */
const MetricCard = styled(Box, {
  shouldForwardProp: (p) => p !== 'accentColor',
})(({ accentColor = 'rgba(99,102,241,0.5)' }) => ({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '16px 18px',
  borderRadius: 14,
  background: 'rgba(255,255,255,0.025)',
  border: '1px solid rgba(255,255,255,0.05)',
  backdropFilter: 'blur(8px)',
  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  animation: `${fadeSlideUp} 0.45s ease both`,
  overflow: 'hidden',
  '&:hover': {
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${accentColor}`,
    transform: 'translateY(-2px)',
    boxShadow: `0 8px 32px rgba(0,0,0,0.2), 0 0 0 1px ${accentColor}`,
  },
  // Left accent bar
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 8,
    bottom: 8,
    left: 0,
    width: 3,
    borderRadius: '0 3px 3px 0',
    background: accentColor,
  },
  '@media (max-width: 479px)': {
    padding: '12px 14px',
    gap: 10,
    borderRadius: 12,
  },
}));

/* ── Metric icon wrapper ── */
const MetricIconBox = styled(Box, {
  shouldForwardProp: (p) => p !== 'bg',
})(({ bg = 'rgba(99,102,241,0.1)' }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 42,
  height: 42,
  borderRadius: 11,
  background: bg,
  flexShrink: 0,
  transition: 'transform 0.2s ease',
  '&:hover': { transform: 'scale(1.05)' },
  '@media (max-width: 479px)': {
    width: 36,
    height: 36,
    borderRadius: 9,
  },
}));

/* ── Violation row ── */
const ViolationRow = styled(Box, {
  shouldForwardProp: (p) => p !== 'severity',
})(({ severity = 'warning' }) => {
  const colors = {
    error: { bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.12)', dot: '#ef4444' },
    warning: { bg: 'rgba(251,191,36,0.05)', border: 'rgba(251,191,36,0.1)', dot: '#fbbf24' },
    info: { bg: 'rgba(99,102,241,0.05)', border: 'rgba(99,102,241,0.1)', dot: '#6366f1' },
  };
  const c = colors[severity] || colors.warning;

  return {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 12,
    background: c.bg,
    border: `1px solid ${c.border}`,
    animation: `${fadeSlideUp} 0.35s ease both`,
    transition: 'all 0.2s ease',
    '&:hover': { background: c.bg.replace('0.06', '0.1').replace('0.05', '0.08') },
    // Dot indicator
    '& .dot': {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: c.dot,
      flexShrink: 0,
      marginTop: 6,
      boxShadow: `0 0 8px ${c.dot}55`,
    },
    '@media (max-width: 479px)': {
      padding: '10px 12px',
      gap: 10,
    },
  };
});

/* ── Section header ── */
const SectionHeader = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
  '@media (max-width: 479px)': {
    marginBottom: 8,
  },
}));

const SectionTitle = styled(Typography)(() => ({
  fontSize: '0.72rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 1.4,
  color: 'rgba(255,255,255,0.3)',
}));

/* ── Camera status strip ── */
const CameraStrip = styled(Box, {
  shouldForwardProp: (p) => p !== 'enabled',
})(({ enabled }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 14px',
  borderRadius: 10,
  background: enabled ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
  border: `1px solid ${enabled ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)'}`,
  transition: 'all 0.3s ease',
  '@media (max-width: 479px)': {
    padding: '8px 12px',
    gap: 8,
  },
}));

/* ── Tracker embed wrapper ── */
const TrackerEmbed = styled(Box)(() => ({
  position: 'relative',
  borderRadius: 16,
  overflow: 'hidden',
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.05)',
  padding: 2,
  animation: `${fadeSlideUp} 0.5s ease 0.2s both`,
  '@media (max-width: 479px)': {
    borderRadius: 12,
  },
}));

/* ── Empty / idle state ── */
const EmptyState = styled(Box)(() => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: '60px 32px',
  gap: 16,
  animation: `${fadeSlideUp} 0.5s ease both`,
  '@media (max-width: 479px)': {
    padding: '40px 20px',
    gap: 12,
  },
}));

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const getScoreColor = (score) => {
  if (score >= 85) return '#10b981';
  if (score >= 70) return '#6366f1';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
};

const getScoreLabel = (score) => {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Needs Attention';
  return 'Critical';
};

const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const AttendanceTabContent = ({
  meetingId,
  userId,
  userName,
  isActive,
  cameraEnabled,
  attendanceData,
  onViolation,
  onStatusChange,
  onSessionTerminated,
  isHost,
  isCoHost,
  effectiveRole,
  onCameraToggle,
  onClose,
}) => {
  const isXs = useMediaQuery('(max-width:479px)');
  const isSm = useMediaQuery('(max-width:639px)');
  const isMd = useMediaQuery('(max-width:899px)');

  const [showViolations, setShowViolations] = useState(true);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const sessionStartRef = useRef(Date.now());

  // Session timer
  useEffect(() => {
    const id = setInterval(() => {
      setSessionElapsed(Math.floor((Date.now() - sessionStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Derived state
  const attendancePercentage = attendanceData?.attendancePercentage ?? 100;
  const engagementScore = attendanceData?.engagementScore ?? 100;
  const violations = attendanceData?.violations || [];
  const breakUsed = attendanceData?.breakUsed ?? false;
  const sessionActive = attendanceData?.sessionActive ?? true;
  const hasViolations = violations.length > 0;
  const scoreColor = getScoreColor(attendancePercentage);
  const engagementColor = getScoreColor(engagementScore);

  // Ring size responsive
  const ringSize = isXs ? 80 : isSm ? 92 : 110;
  const strokeWidth = isXs ? 5 : isSm ? 6 : 7;

  // If no meetingId or userId, show empty state
  if (!meetingId || !userId) {
    return (
      <DashboardRoot>
        <EmptyState>
          <Box sx={{
            width: 72, height: 72, borderRadius: 18,
            background: 'rgba(99,102,241,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Visibility sx={{ fontSize: 32, color: 'rgba(99,102,241,0.5)' }} />
          </Box>
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
            Attendance Tracking
          </Typography>
          <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.3)', maxWidth: 280, lineHeight: 1.6 }}>
            Attendance tracking will appear here once the session is active and configured.
          </Typography>
        </EmptyState>
      </DashboardRoot>
    );
  }

  return (
    <DashboardRoot>
      <ScrollArea>
        {/* ══════════════════════════════════════════════════════════════════
            HERO STATUS CARD
            ══════════════════════════════════════════════════════════════ */}
        <HeroCard hasViolations={hasViolations}>
          <Box sx={{
            display: 'flex',
            alignItems: { xs: 'flex-start', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 2, sm: 3 },
            position: 'relative',
            zIndex: 1,
          }}>
            {/* ── Progress Ring ── */}
            <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Ambient ring */}
              <Box sx={{
                position: 'absolute',
                width: ringSize + 16,
                height: ringSize + 16,
                borderRadius: '50%',
                border: `1px solid ${hasViolations ? 'rgba(239,68,68,0.08)' : 'rgba(99,102,241,0.08)'}`,
                animation: `${pulseRing} 3s ease-in-out infinite`,
              }} />

              <ProgressRing size={ringSize} strokeWidth={strokeWidth} percentage={attendancePercentage} color={scoreColor}>
                <svg>
                  <circle className="track" cx={ringSize / 2} cy={ringSize / 2} r={(ringSize - strokeWidth) / 2} />
                  <circle className="progress" cx={ringSize / 2} cy={ringSize / 2} r={(ringSize - strokeWidth) / 2} />
                </svg>
                {/* Center text */}
                <Box sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Typography sx={{
                    fontSize: isXs ? '1.3rem' : isSm ? '1.5rem' : '1.8rem',
                    fontWeight: 800,
                    color: scoreColor,
                    lineHeight: 1,
                    fontFeatureSettings: '"tnum"',
                    fontVariantNumeric: 'tabular-nums',
                    animation: `${counterTick} 0.3s ease`,
                  }}>
                    {Math.round(attendancePercentage)}
                    <Box component="span" sx={{ fontSize: '0.55em', opacity: 0.7, fontWeight: 600 }}>%</Box>
                  </Typography>
                  <Typography sx={{
                    fontSize: isXs ? '0.52rem' : '0.58rem',
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.35)',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    mt: 0.3,
                  }}>
                    Score
                  </Typography>
                </Box>
              </ProgressRing>
            </Box>

            {/* ── Status info ── */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
                {/* Live indicator */}
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  py: 0.3,
                  borderRadius: 6,
                  background: sessionActive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${sessionActive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.15)'}`,
                }}>
                  <FiberManualRecord sx={{
                    fontSize: 7,
                    color: sessionActive ? '#10b981' : '#ef4444',
                    animation: sessionActive ? `${breathe} 2s ease-in-out infinite` : 'none',
                  }} />
                  <Typography sx={{
                    fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.8,
                    color: sessionActive ? '#10b981' : '#ef4444',
                    textTransform: 'uppercase',
                  }}>
                    {sessionActive ? 'Active' : 'Inactive'}
                  </Typography>
                </Box>

                {/* Violation count badge */}
                {hasViolations && (
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 0.4,
                    px: 0.8, py: 0.2, borderRadius: 5,
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.18)',
                  }}>
                    <Warning sx={{ fontSize: 11, color: '#ef4444' }} />
                    <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: '#ef4444' }}>
                      {violations.length}
                    </Typography>
                  </Box>
                )}
              </Box>

              <Typography sx={{
                fontSize: isXs ? '1rem' : isSm ? '1.15rem' : '1.3rem',
                fontWeight: 700,
                color: '#e8eaed',
                lineHeight: 1.3,
                mb: 0.5,
              }}>
                {getScoreLabel(attendancePercentage)}
              </Typography>

              <Typography sx={{
                fontSize: isXs ? '0.72rem' : '0.78rem',
                color: 'rgba(255,255,255,0.4)',
                lineHeight: 1.5,
              }}>
                {hasViolations
                  ? `${violations.length} violation${violations.length > 1 ? 's' : ''} detected during this session.`
                  : 'No violations detected. Keep up the good work!'}
              </Typography>
            </Box>
          </Box>
        </HeroCard>

        {/* ══════════════════════════════════════════════════════════════════
            METRICS GRID
            ══════════════════════════════════════════════════════════════ */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: { xs: 1, sm: 1.2 },
          mt: { xs: 1.5, sm: 2 },
        }}>
          {/* Engagement Score */}
          <MetricCard accentColor={engagementColor} sx={{ animationDelay: '0.08s' }}>
            <MetricIconBox bg={`${engagementColor}18`}>
              <TrendingUp sx={{ fontSize: 20, color: engagementColor }} />
            </MetricIconBox>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Engagement
              </Typography>
              <Typography sx={{
                fontSize: '1.15rem', fontWeight: 800, color: engagementColor,
                fontFeatureSettings: '"tnum"', lineHeight: 1.3,
              }}>
                {Math.round(engagementScore)}%
              </Typography>
            </Box>
          </MetricCard>

          {/* Session Duration */}
          <MetricCard accentColor="rgba(138,180,248,0.5)" sx={{ animationDelay: '0.14s' }}>
            <MetricIconBox bg="rgba(138,180,248,0.1)">
              <AccessTime sx={{ fontSize: 20, color: '#8ab4f8' }} />
            </MetricIconBox>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Session Time
              </Typography>
              <Typography sx={{
                fontSize: '1.15rem', fontWeight: 800, color: '#8ab4f8',
                fontFamily: "'JetBrains Mono', 'DM Mono', monospace",
                fontFeatureSettings: '"tnum"', lineHeight: 1.3,
              }}>
                {formatDuration(sessionElapsed)}
              </Typography>
            </Box>
          </MetricCard>

          {/* Camera Status */}
          <MetricCard
            accentColor={cameraEnabled ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'}
            sx={{ animationDelay: '0.2s' }}
          >
            <MetricIconBox bg={cameraEnabled ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}>
              {cameraEnabled
                ? <Videocam sx={{ fontSize: 20, color: '#10b981' }} />
                : <VideocamOff sx={{ fontSize: 20, color: '#ef4444' }} />}
            </MetricIconBox>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Camera
              </Typography>
              <Typography sx={{
                fontSize: '0.92rem', fontWeight: 700, lineHeight: 1.3,
                color: cameraEnabled ? '#10b981' : '#ef4444',
              }}>
                {cameraEnabled ? 'Active' : 'Off'}
              </Typography>
            </Box>
          </MetricCard>

          {/* Break Status */}
          <MetricCard
            accentColor={breakUsed ? 'rgba(251,191,36,0.5)' : 'rgba(99,102,241,0.5)'}
            sx={{ animationDelay: '0.26s' }}
          >
            <MetricIconBox bg={breakUsed ? 'rgba(251,191,36,0.1)' : 'rgba(99,102,241,0.1)'}>
              <Shield sx={{ fontSize: 20, color: breakUsed ? '#fbbf24' : '#6366f1' }} />
            </MetricIconBox>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Break
              </Typography>
              <Typography sx={{
                fontSize: '0.92rem', fontWeight: 700, lineHeight: 1.3,
                color: breakUsed ? '#fbbf24' : '#6366f1',
              }}>
                {breakUsed ? 'Used' : 'Available'}
              </Typography>
            </Box>
          </MetricCard>
        </Box>

        {/* ══════════════════════════════════════════════════════════════════
            VIOLATIONS SECTION
            ══════════════════════════════════════════════════════════════ */}
        <Box sx={{ mt: { xs: 2, sm: 2.5 } }}>
          <SectionHeader>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SectionTitle>
                Violations {hasViolations && `(${violations.length})`}
              </SectionTitle>
              {!hasViolations && (
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 0.4,
                  px: 0.8, py: 0.2, borderRadius: 5,
                  background: 'rgba(16,185,129,0.08)',
                }}>
                  <CheckCircle sx={{ fontSize: 11, color: '#10b981' }} />
                  <Typography sx={{ fontSize: '0.56rem', fontWeight: 600, color: '#10b981' }}>Clear</Typography>
                </Box>
              )}
            </Box>
            {hasViolations && (
              <IconButton
                size="small"
                onClick={() => setShowViolations(!showViolations)}
                sx={{ color: 'rgba(255,255,255,0.3)', width: 28, height: 28 }}
              >
                {showViolations ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
              </IconButton>
            )}
          </SectionHeader>

          {hasViolations && showViolations && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
              {violations.map((v, i) => (
                <ViolationRow
                  key={i}
                  severity={v.type || 'warning'}
                  sx={{ animationDelay: `${i * 0.06}s` }}
                >
                  <Box className="dot" />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{
                      fontSize: '0.78rem', fontWeight: 600, color: '#e8eaed',
                      lineHeight: 1.4, mb: 0.2,
                    }}>
                      {v.message || v.reason || 'Violation detected'}
                    </Typography>
                    {v.timestamp && (
                      <Typography sx={{
                        fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)',
                        fontFamily: "'JetBrains Mono', 'DM Mono', monospace",
                      }}>
                        {new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </Typography>
                    )}
                  </Box>
                </ViolationRow>
              ))}
            </Box>
          )}

          {!hasViolations && (
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              py: 3, opacity: 0.5,
            }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.8 }}>
                <CheckCircle sx={{ fontSize: 28, color: '#10b981', opacity: 0.6 }} />
                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
                  No violations detected
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        {/* ══════════════════════════════════════════════════════════════════
            EMBEDDED ATTENDANCE TRACKER (hidden / core logic)
            ══════════════════════════════════════════════════════════════ */}
        <Box sx={{ mt: { xs: 2, sm: 2.5 } }}>
          <SectionHeader>
            <SectionTitle>Live Tracker</SectionTitle>
          </SectionHeader>

          <TrackerEmbed>
            <AttendanceTracker
              meetingId={meetingId}
              userId={userId}
              userName={userName}
              isActive={isActive}
              cameraEnabled={cameraEnabled}
              onViolation={onViolation}
              onStatusChange={onStatusChange}
              onSessionTerminated={onSessionTerminated}
              minimized={false}
              onToggleMinimized={() => {}}
              isHost={isHost}
              isCoHost={isCoHost}
              effectiveRole={effectiveRole}
              onCameraToggle={onCameraToggle}
              inline={false}
            />
          </TrackerEmbed>
        </Box>

        {/* ── Bottom spacer ── */}
        <Box sx={{ height: 20 }} />
      </ScrollArea>
    </DashboardRoot>
  );
};

export default AttendanceTabContent;