// src/components/controls/MeetingActionsMenu.jsx
// ══════════════════════════════════════════════════════════════════════
//  REDESIGNED UI — DARK GOOGLE MEET STYLE — ALL BACKEND INTACT
// ══════════════════════════════════════════════════════════════════════
import React, { useRef, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  ClickAwayListener,
} from '@mui/material';
import {
  RadioButtonChecked,
  Gesture as WhiteboardIcon,
  Share,
  MeetingRoom as MeetingRoomIcon,
  Fullscreen,
  FullscreenExit,
} from '@mui/icons-material';
import { keyframes, alpha } from '@mui/system';

/* ──────────────────────────────────────────────────────────────────
   KEYFRAMES
   ────────────────────────────────────────────────────────────── */
const menuReveal = keyframes`
  0%   { opacity: 0; transform: translateY(12px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
`;

const itemSlideIn = keyframes`
  0%   { opacity: 0; transform: translateX(-8px); }
  100% { opacity: 1; transform: translateX(0); }
`;

const liveDot = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.4; transform: scale(1.3); }
`;

const shimmerEdge = keyframes`
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

/* ══════════════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════════════ */
const MeetingActionsMenu = ({
  open,
  onClose,
  chatOpen,
  participantsOpen,
  recordingState,
  hasHostPrivileges,
  meetingSettings,
  attendanceEnabled,
  currentAttendanceData,
  isFullscreen,
  toggleMenuItems,
  onItemClick,
}) => {
  const menuRef = useRef(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  // Reset hover when menu closes
  useEffect(() => {
    if (!open) setHoveredIdx(null);
  }, [open]);

  if (!open) return null;

  /* ── Visible items ─────────────────────────────────────────── */
  const visibleItems = (toggleMenuItems || []).filter((item) => item.show);

  /* ── Color mapping — identical logic to original ────────── */
  const getAccent = (label) => {
    if (label.includes('Recording'))  return { color: '#f87171', bg: 'rgba(248,113,113,0.10)', glow: 'rgba(248,113,113,0.06)' };
    if (label.includes('Whiteboard')) return { color: '#a78bfa', bg: 'rgba(167,139,250,0.10)', glow: 'rgba(167,139,250,0.06)' };
    if (label.includes('Attendance')) return { color: '#34d399', bg: 'rgba(52,211,153,0.10)',  glow: 'rgba(52,211,153,0.06)' };
    if (label.includes('Copy') || label.includes('Share')) return { color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', glow: 'rgba(96,165,250,0.06)' };
    if (label.includes('End Meeting')) return { color: '#f87171', bg: 'rgba(248,113,113,0.10)', glow: 'rgba(248,113,113,0.06)' };
    if (label.includes('Fullscreen')) return { color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', glow: 'rgba(148,163,184,0.06)' };
    return { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', glow: 'rgba(148,163,184,0.04)' };
  };

  /* ── Attendance dot color — identical logic ─────────────── */
  const getAttendanceDotColor = () => {
    const pct = currentAttendanceData?.attendancePercentage || 0;
    if (pct > 80) return '#22c55e';
    if (pct > 60) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <ClickAwayListener onClickAway={onClose}>
      <Box
        ref={menuRef}
        className="toggle-menu-container"
        sx={{
          position: 'fixed',
          bottom: { xs: 90, sm: 100, md: 110 },
          right: { xs: 12, sm: 20, md: chatOpen || participantsOpen ? 420 : 350 },
          zIndex: 10000,
          width: { xs: 'calc(100vw - 24px)', sm: 300, md: 320 },
          maxWidth: 340,
          maxHeight: { xs: '55vh', sm: '50vh' },
          display: 'flex',
          flexDirection: 'column',
          animation: `${menuReveal} 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
          transition: 'right 0.32s cubic-bezier(0.4, 0, 0.2, 1)',

          /* ── Card surface ────────────────────────────────── */
          background: 'rgba(30, 31, 35, 0.97)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderRadius: { xs: '14px', sm: '16px', md: '18px' },
          border: '1px solid rgba(255, 255, 255, 0.07)',
          boxShadow: `
            0 20px 64px rgba(0, 0, 0, 0.45),
            0 6px 20px rgba(0, 0, 0, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.04)
          `,
          overflow: 'hidden',

          /* Subtle shimmer on top edge */
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: '8%',
            right: '8%',
            height: '1px',
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.1) 30%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.1) 70%, transparent)',
            zIndex: 1,
          },
        }}
      >
        {/* ── Scrollable list ────────────────────────────────── */}
        <Box
          sx={{
            overflowY: 'auto',
            overflowX: 'hidden',
            py: { xs: 0.8, sm: 1 },
            px: { xs: 0.8, sm: 1 },

            '&::-webkit-scrollbar': {
              width: 4,
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 2,
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
          }}
        >
          {visibleItems.map((item, index) => {
            const accent = getAccent(item.label);
            const isHovered = hoveredIdx === index;
            const isDanger = item.label.includes('End Meeting');
            const isRecordingLive =
              item.label.includes('Recording') && recordingState?.isRecording;
            const isAttendance = item.label.includes('Attendance') && attendanceEnabled;

            return (
              <Box
                key={index}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onItemClick(item.action);
                  onClose();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onItemClick(item.action);
                    onClose();
                  }
                }}
                onMouseEnter={() => setHoveredIdx(index)}
                onMouseLeave={() => setHoveredIdx(null)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: { xs: 1.2, sm: 1.5 },
                  px: { xs: 1.4, sm: 1.8 },
                  py: { xs: 1.1, sm: 1.3 },
                  borderRadius: { xs: '10px', sm: '12px' },
                  cursor: 'pointer',
                  position: 'relative',
                  animation: `${itemSlideIn} 0.25s ease-out ${index * 0.04}s both`,
                  transition:
                    'background-color 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease',

                  /* Idle */
                  backgroundColor: 'transparent',

                  /* Hover */
                  ...(isHovered && {
                    backgroundColor: accent.bg,
                    boxShadow: `inset 0 0 0 1px ${alpha(accent.color, 0.08)}`,
                    transform: 'translateX(2px)',
                  }),

                  /* Active press */
                  '&:active': {
                    transform: 'scale(0.98)',
                    backgroundColor: alpha(accent.color, 0.14),
                  },

                  /* Focus visible for keyboard */
                  '&:focus-visible': {
                    outline: 'none',
                    boxShadow: `0 0 0 2px ${alpha(accent.color, 0.4)}`,
                  },

                  /* Danger row override */
                  ...(isDanger && {
                    mt: 0.5,
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: -4,
                      left: '10%',
                      right: '10%',
                      height: '1px',
                      background: 'rgba(255,255,255,0.05)',
                    },
                  }),
                }}
              >
                {/* ── Icon circle ──────────────────────────────── */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: { xs: 34, sm: 38, md: 40 },
                    height: { xs: 34, sm: 38, md: 40 },
                    borderRadius: '50%',
                    flexShrink: 0,
                    position: 'relative',
                    backgroundColor: isHovered
                      ? alpha(accent.color, 0.15)
                      : alpha(accent.color, 0.08),
                    color: accent.color,
                    transition: 'background-color 0.18s ease, box-shadow 0.18s ease',
                    boxShadow: isHovered
                      ? `0 0 12px ${alpha(accent.color, 0.15)}`
                      : 'none',

                    '& .MuiSvgIcon-root': {
                      fontSize: { xs: '1rem', sm: '1.1rem', md: '1.2rem' },
                    },
                  }}
                >
                  {item.icon}

                  {/* Recording live pulse dot */}
                  {isRecordingLive && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -1,
                        right: -1,
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        backgroundColor: '#ef4444',
                        border: '1.5px solid rgba(30, 31, 35, 0.97)',
                        animation: `${liveDot} 1.4s ease-in-out infinite`,
                      }}
                    />
                  )}
                </Box>

                {/* ── Label ────────────────────────────────────── */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: { xs: '0.82rem', sm: '0.86rem', md: '0.9rem' },
                      fontWeight: isHovered ? 600 : 500,
                      color: isDanger
                        ? (isHovered ? '#fca5a5' : '#f87171')
                        : (isHovered ? '#f0f0f0' : '#d1d5db'),
                      fontFamily: "'DM Sans', 'Google Sans', -apple-system, sans-serif",
                      lineHeight: 1.3,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      transition: 'color 0.15s ease, font-weight 0.15s ease',
                    }}
                  >
                    {item.label}
                  </Typography>
                </Box>

                {/* ── Right-side badges ─────────────────────────── */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.8,
                    flexShrink: 0,
                  }}
                >
                  {/* Recording LIVE chip */}
                  {isRecordingLive && (
                    <Chip
                      label="LIVE"
                      size="small"
                      sx={{
                        height: 20,
                        minWidth: 42,
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        color: '#f87171',
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        fontFamily: "'DM Sans', sans-serif",
                        letterSpacing: '0.06em',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '6px',
                        '& .MuiChip-label': {
                          px: 0.8,
                        },
                      }}
                    />
                  )}

                  {/* Attendance status dot */}
                  {isAttendance && (
                    <Box
                      sx={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        backgroundColor: getAttendanceDotColor(),
                        boxShadow: `0 0 6px ${alpha(getAttendanceDotColor(), 0.4)}`,
                        flexShrink: 0,
                        transition: 'background-color 0.3s ease',
                      }}
                    />
                  )}

                  {/* Hover chevron */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      color: 'rgba(255,255,255,0.2)',
                      transition: 'all 0.18s ease',
                      opacity: isHovered ? 1 : 0,
                      transform: isHovered ? 'translateX(0)' : 'translateX(-4px)',
                      fontSize: '0.85rem',
                      fontFamily: 'system-ui',
                    }}
                  >
                    ›
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </ClickAwayListener>
  );
};

export default MeetingActionsMenu;