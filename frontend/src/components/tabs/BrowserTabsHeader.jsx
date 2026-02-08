// src/components/tabs/BrowserTabsHeader.jsx — REDESIGNED: Premium Responsive UI
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Box, IconButton, Typography, Tooltip, useMediaQuery } from '@mui/material';
import {
  Close,
  VideoCall,
  Gesture as WhiteboardIcon,
  MoreVert,
  Menu as MenuIcon,
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import AttendanceTracker from '../attendance/AttendanceTracker';

// ─── Animations ──────────────────────────────────────────────────────────────
const tabSlideIn = keyframes`
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const glowPulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
  50%      { box-shadow: 0 0 8px 2px rgba(99, 102, 241, 0.15); }
`;

const activeIndicatorSlide = keyframes`
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
`;

// ─── Styled Components ───────────────────────────────────────────────────────

const HeaderRoot = styled(Box)(() => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  height: 46,
  // Layered glass background
  background: 'linear-gradient(180deg, rgba(15,15,20,0.97) 0%, rgba(20,20,28,0.95) 100%)',
  backdropFilter: 'blur(16px) saturate(1.6)',
  WebkitBackdropFilter: 'blur(16px) saturate(1.6)',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  padding: '0 6px',
  // Subtle top highlight
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.2) 50%, transparent 100%)',
    pointerEvents: 'none',
  },
  fontFamily: "'DM Sans', 'Outfit', system-ui, sans-serif",

  // ── Responsive height ──
  '@media (max-width: 479px)': {
    height: 42,
    padding: '0 4px',
  },
}));

// Scrollable tab strip
const TabStrip = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  flex: 1,
  overflow: 'hidden',
  height: '100%',
  minWidth: 0,
  // Allow horizontal scroll on narrow without scrollbar
  overflowX: 'auto',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
}));

// Individual tab
const Tab = styled(Box, {
  shouldForwardProp: (p) => p !== 'active',
})(({ active }) => ({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  height: 34,
  padding: '0 14px',
  flexShrink: 0,
  cursor: 'pointer',
  userSelect: 'none',
  borderRadius: 8,
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  animation: `${tabSlideIn} 0.25s ease both`,
  // Color states
  background: active
    ? 'rgba(99,102,241,0.12)'
    : 'transparent',
  color: active ? '#e0e0ff' : 'rgba(255,255,255,0.45)',
  border: active
    ? '1px solid rgba(99,102,241,0.25)'
    : '1px solid transparent',

  ...(active && {
    animation: `${tabSlideIn} 0.25s ease both, ${glowPulse} 3s ease-in-out infinite`,
  }),

  '&:hover': {
    background: active
      ? 'rgba(99,102,241,0.16)'
      : 'rgba(255,255,255,0.06)',
    color: active ? '#e0e0ff' : 'rgba(255,255,255,0.75)',
  },

  // Active bottom indicator
  '&::after': active
    ? {
        content: '""',
        position: 'absolute',
        bottom: -1,
        left: '20%',
        right: '20%',
        height: 2,
        borderRadius: 2,
        background: 'linear-gradient(90deg, #6366f1, #818cf8)',
        animation: `${activeIndicatorSlide} 0.3s ease both`,
        transformOrigin: 'center',
      }
    : {},

  // ── Responsive ──
  '@media (max-width: 479px)': {
    height: 30,
    padding: '0 10px',
    gap: 6,
    borderRadius: 6,
  },
}));

// Tab icon wrapper
const TabIcon = styled(Box, {
  shouldForwardProp: (p) => p !== 'active',
})(({ active }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  borderRadius: 5,
  flexShrink: 0,
  background: active ? 'rgba(99,102,241,0.18)' : 'transparent',
  transition: 'background 0.2s',
  '& .MuiSvgIcon-root': {
    fontSize: 15,
    color: active ? '#818cf8' : 'rgba(255,255,255,0.45)',
    transition: 'color 0.2s',
  },
  '@media (max-width: 479px)': {
    width: 20,
    height: 20,
    '& .MuiSvgIcon-root': { fontSize: 14 },
  },
}));

// Tab label
const TabLabel = styled(Typography, {
  shouldForwardProp: (p) => p !== 'active',
})(({ active }) => ({
  fontSize: '0.78rem',
  fontWeight: active ? 600 : 400,
  letterSpacing: active ? 0.3 : 0.1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: 120,
  transition: 'all 0.2s',
  '@media (max-width: 599px)': {
    fontSize: '0.72rem',
    maxWidth: 80,
  },
  '@media (max-width: 479px)': {
    fontSize: '0.68rem',
    maxWidth: 64,
  },
}));

// Close button on tab
const CloseBtn = styled(IconButton)(() => ({
  width: 18,
  height: 18,
  padding: 0,
  marginLeft: 2,
  borderRadius: 4,
  color: 'rgba(255,255,255,0.3)',
  transition: 'all 0.15s',
  '&:hover': {
    color: '#f87171',
    background: 'rgba(248,113,113,0.12)',
  },
  '& .MuiSvgIcon-root': { fontSize: 13 },
}));

// Divider line between tabs area and attendance
const VerticalDivider = styled(Box)(() => ({
  width: 1,
  height: 20,
  background: 'rgba(255,255,255,0.08)',
  flexShrink: 0,
  margin: '0 6px',
  '@media (max-width: 479px)': {
    height: 16,
    margin: '0 4px',
  },
}));

// Attendance container
const AttendanceArea = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
  height: '100%',
  paddingRight: 4,
  '@media (max-width: 479px)': {
    paddingRight: 2,
  },
}));

// =============================================================================
// COMPONENT
// =============================================================================
const BrowserTabsHeader = ({
  availableTabs,
  activeTab,
  onTabChange,
  onTabClose,
  // ── Attendance props ──
  attendanceEnabled = false,
  attendanceData = null,
  meetingId,
  userId,
  userName,
  isActive,
  cameraEnabled,
  onViolation,
  onStatusChange,
  onSessionTerminated,
  onToggleMinimized,
  isHost,
  isCoHost,
  effectiveRole,
  onCameraToggle,
}) => {
  const isXs = useMediaQuery('(max-width:479px)');
  const isSm = useMediaQuery('(max-width:599px)');
  const tabStripRef = useRef(null);

  // Auto-scroll active tab into view on very narrow screens
  useEffect(() => {
    if (!tabStripRef.current) return;
    const activeEl = tabStripRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  const getTabIcon = (tab) => {
    switch (tab) {
      case 'meeting':
        return <VideoCall />;
      case 'whiteboard':
        return <WhiteboardIcon />;
      default:
        return null;
    }
  };

  const getTabTitle = (tab) => tab.charAt(0).toUpperCase() + tab.slice(1);

  const showAttendance = attendanceEnabled && meetingId && userId;

  return (
    <HeaderRoot>
      {/* ── Tab strip ── */}
      <TabStrip ref={tabStripRef}>
        {availableTabs.map((tab, idx) => {
          const isActive = activeTab === tab;
          return (
            <Tooltip
              key={tab}
              title={getTabTitle(tab)}
              placement="bottom"
              enterDelay={600}
              arrow
              disableHoverListener={!isSm}
            >
              <Tab
                active={isActive}
                data-active={isActive}
                onClick={() => onTabChange(tab)}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {/* Icon */}
                <TabIcon active={isActive}>
                  {getTabIcon(tab)}
                </TabIcon>

                {/* Label — hide on XS when there are 3+ tabs to save space */}
                {!(isXs && availableTabs.length >= 3) && (
                  <TabLabel active={isActive}>
                    {getTabTitle(tab)}
                  </TabLabel>
                )}

                {/* Close button (not on 'meeting' — it's the base tab) */}
                {tab !== 'meeting' && (
                  <CloseBtn
                    onClick={(e) => {
                      e.stopPropagation();
                      onTabClose(tab);
                    }}
                    size="small"
                  >
                    <Close />
                  </CloseBtn>
                )}
              </Tab>
            </Tooltip>
          );
        })}
      </TabStrip>

      {/* ── Divider ── */}
      {showAttendance && <VerticalDivider />}

      {/* ── Attendance Tracker (all props forwarded, nothing lost) ── */}
      {showAttendance && (
        <AttendanceArea>
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
            onToggleMinimized={onToggleMinimized}
            isHost={isHost}
            isCoHost={isCoHost}
            effectiveRole={effectiveRole}
            onCameraToggle={onCameraToggle}
            inline={true}
          />
        </AttendanceArea>
      )}
    </HeaderRoot>
  );
};

export default BrowserTabsHeader;