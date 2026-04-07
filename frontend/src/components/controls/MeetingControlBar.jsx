// src/components/controls/MeetingControlBar.jsx
// Google Meet–style responsive control bar
// Mobile: flat bar + ⋮ bottom-sheet drawer with host controls
// Desktop/Tablet: 3-section pill bar with inline recording indicator
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Badge,
  Typography,
  Popover,
  Divider,
  Drawer,
  useMediaQuery,
} from '@mui/material';
import {
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  ScreenShare,
  StopScreenShare,
  Chat,
  People,
  MoreVert,
  CallEnd,
  EmojiEmotions,
  PanTool,
  Visibility,
  VisibilityOff,
  Info,
  ContentCopy,
  Close,
  RadioButtonChecked,
  Stop,
  Gesture as WhiteboardIcon,
  MeetingRoom as MeetingRoomIcon,
  Fullscreen,
  FullscreenExit,
  Share,
  Pause,
  PlayArrow,
  FiberManualRecord,
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';

/* ═══════════════════════════════════════════════════════════════════════════
   ANIMATIONS
   ═══════════════════════════════════════════════════════════════════════ */
const breathe = keyframes`
  0%,100%{opacity:1;transform:scale(1)}
  50%{opacity:.55;transform:scale(1.25)}
`;
const slideUp = keyframes`
  from{opacity:0;transform:translateY(12px)}
  to{opacity:1;transform:translateY(0)}
`;
const recPulse = keyframes`
  0%,100%{opacity:1}
  50%{opacity:.3}
`;
const fadeIn = keyframes`
  from{opacity:0;transform:scale(0.92)}
  to{opacity:1;transform:scale(1)}
`;

/* ═══════════════════════════════════════════════════════════════════════════
   LIVE CLOCK
   ═══════════════════════════════════════════════════════════════════════ */
const useLiveClock = () => {
  const [t, setT] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  );
  useEffect(() => {
    const id = setInterval(
      () => setT(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })),
      1000
    );
    return () => clearInterval(id);
  }, []);
  return t;
};

/* ═══════════════════════════════════════════════════════════════════════════
   DESKTOP PILL DIVIDER
   ═══════════════════════════════════════════════════════════════════════ */
const PillDivider = styled(Box)(() => ({
  width: 1,
  background: 'rgba(255,255,255,.12)',
  flexShrink: 0,
  alignSelf: 'stretch',
  margin: '10px 0',
}));

/* ═══════════════════════════════════════════════════════════════════════════
   INLINE RECORDING BADGE (shared between mobile info strip & desktop left)
   ═══════════════════════════════════════════════════════════════════════ */
const InlineRecBadge = ({ recordingState, size = 'md', onPauseResume, hasHostPrivileges = false }) => {
  if (!recordingState?.isRecording) return null;

  const isPaused = recordingState.isPaused;
  const dur = recordingState.duration || 0;

  // Size tokens — controls every dimension so the badge scales cleanly
  const tokens = {
    xs: { dotFs: 5, labelFs: '.5rem', timerFs: '.48rem', btnSize: 18, btnIconFs: 12, px: .4, py: .15, gap: .25, radius: '6px' },
    sm: { dotFs: 6, labelFs: '.56rem', timerFs: '.52rem', btnSize: 22, btnIconFs: 14, px: .55, py: .2, gap: .3, radius: '7px' },
    md: { dotFs: 7, labelFs: '.64rem', timerFs: '.58rem', btnSize: 26, btnIconFs: 16, px: .7, py: .25, gap: .4, radius: '8px' },
    lg: { dotFs: 8, labelFs: '.7rem', timerFs: '.63rem', btnSize: 28, btnIconFs: 17, px: .85, py: .28, gap: .45, radius: '9px' },
  };
  const t = tokens[size] || tokens.md;

  const timerStr = dur > 0
    ? `${Math.floor(dur / 60).toString().padStart(2, '0')}:${(dur % 60).toString().padStart(2, '0')}`
    : null;

  const handleClick = (e) => {
    e.stopPropagation();
    if (onPauseResume && hasHostPrivileges) {
      onPauseResume();
    }
  };

  return (
    <Tooltip
      title={
        !hasHostPrivileges
          ? (isPaused ? 'Recording paused' : 'Recording in progress')
          : (isPaused ? 'Click to resume recording' : 'Click to pause recording')
      }
      placement="top"
      arrow
    >
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: `${t.gap * 8}px`,
        flexShrink: 0,
        px: t.px,
        py: t.py,
        borderRadius: t.radius,
        background: isPaused ? 'rgba(251,191,36,.1)' : 'rgba(234,67,53,.1)',
        border: `1px solid ${isPaused ? 'rgba(251,191,36,.16)' : 'rgba(234,67,53,.16)'}`,
        transition: 'background .3s ease, border-color .3s ease',
        animation: `${fadeIn} .35s ease both`,
        cursor: hasHostPrivileges ? 'pointer' : 'default',
        userSelect: 'none',
        '&:hover': hasHostPrivileges ? {
          background: isPaused ? 'rgba(251,191,36,.18)' : 'rgba(234,67,53,.18)',
          border: `1px solid ${isPaused ? 'rgba(251,191,36,.28)' : 'rgba(234,67,53,.28)'}`,
        } : {},
        '&:active': hasHostPrivileges ? { transform: 'scale(.97)' } : {},
      }}
        onClick={handleClick}
      >
        {/* Pulsing dot */}
        <FiberManualRecord sx={{
          fontSize: t.dotFs,
          color: isPaused ? '#fbbf24' : '#ea4335',
          animation: isPaused ? 'none' : `${recPulse} 1.4s ease-in-out infinite`,
          transition: 'color .3s ease',
        }} />

        {/* REC / PAUSED label */}
        <Typography sx={{
          fontSize: t.labelFs,
          fontWeight: 700,
          letterSpacing: .5,
          lineHeight: 1,
          color: isPaused ? '#fbbf24' : '#ea4335',
          userSelect: 'none',
        }}>
          {isPaused ? 'PAUSED' : 'REC'}
        </Typography>

        {/* Timer */}
        {timerStr && (
          <Typography sx={{
            fontSize: t.timerFs,
            fontWeight: 500,
            fontFamily: "'JetBrains Mono','DM Mono',monospace",
            fontFeatureSettings: '"tnum"',
            fontVariantNumeric: 'tabular-nums',
            color: isPaused ? 'rgba(251,191,36,.55)' : 'rgba(234,67,53,.7)',
            letterSpacing: .3,
            lineHeight: 1,
          }}>
            {timerStr}
          </Typography>
        )}

        {/* ── Pause / Play button (only for hosts/co-hosts) ── */}
        {hasHostPrivileges && onPauseResume && (
          <>
            {/* Tiny separator */}
            <Box sx={{
              width: '1px',
              height: t.btnSize * 0.6,
              background: isPaused ? 'rgba(251,191,36,.2)' : 'rgba(234,67,53,.2)',
              flexShrink: 0,
            }} />
            <Box
              component="button"
              onClick={(e) => {
                e.stopPropagation();
                onPauseResume();
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: t.btnSize,
                height: t.btnSize,
                minWidth: t.btnSize,
                borderRadius: '50%',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                flexShrink: 0,
                background: isPaused
                  ? 'rgba(52,211,153,.15)'
                  : 'rgba(251,191,36,.15)',
                color: isPaused ? '#34d399' : '#fbbf24',
                transition: 'all .2s ease',
                '&:hover': {
                  background: isPaused
                    ? 'rgba(52,211,153,.3)'
                    : 'rgba(251,191,36,.3)',
                  transform: 'scale(1.15)',
                },
                '&:active': {
                  transform: 'scale(.9)',
                },
              }}
            >
              {isPaused
                ? <PlayArrow sx={{ fontSize: t.btnIconFs }} />
                : <Pause sx={{ fontSize: t.btnIconFs }} />
              }
            </Box>
          </>
        )}
      </Box>
    </Tooltip>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MEETING INFO POPOVER  (desktop only)
   ═══════════════════════════════════════════════════════════════════════ */
const MeetingInfoPopover = ({ anchorEl, open, onClose, meetingId, meetingCode, meetingLink }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        meetingLink || `${window.location.origin}/meeting/${meetingId}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const displayId = meetingCode || meetingId || 'N/A';

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      slotProps={{
        paper: {
          sx: {
            width: 360,
            maxWidth: '92vw',
            background: 'linear-gradient(180deg,#2a2b30,#232428)',
            color: '#e8eaed',
            borderRadius: '14px',
            border: '1px solid rgba(255,255,255,.08)',
            boxShadow: '0 12px 48px rgba(0,0,0,.55)',
            overflow: 'hidden',
            mb: 1.5,
            animation: `${slideUp} .25s ease both`,
          },
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 2 }}>
        <Typography sx={{ fontSize: '1.05rem', fontWeight: 700 }}>Meeting details</Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: '#9aa0a6', '&:hover': { background: 'rgba(255,255,255,.08)' } }}>
          <Close fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ px: 2.5, pb: 2.5 }}>
        <Typography sx={{ fontSize: '.72rem', fontWeight: 700, color: '#8ab4f8', mb: .8, textTransform: 'uppercase', letterSpacing: 1 }}>
          Joining info
        </Typography>
        <Box sx={{ background: 'rgba(0,0,0,.25)', borderRadius: '8px', px: 1.5, py: 1, mb: 1.5, border: '1px solid rgba(255,255,255,.04)' }}>
          <Typography sx={{ fontSize: '.8rem', color: '#bdc1c6', fontFamily: "'JetBrains Mono','DM Mono',monospace", wordBreak: 'break-all', lineHeight: 1.6 }}>
            {meetingLink || `${window.location.origin}/meeting/${meetingId}`}
          </Typography>
        </Box>
        <Box onClick={copy} sx={{ display: 'inline-flex', alignItems: 'center', gap: .8, cursor: 'pointer', color: '#8ab4f8', py: .4, px: 1, borderRadius: '6px', '&:hover': { background: 'rgba(138,180,248,.08)' } }}>
          <ContentCopy sx={{ fontSize: 15 }} />
          <Typography sx={{ fontSize: '.8rem', fontWeight: 600 }}>{copied ? 'Copied!' : 'Copy joining info'}</Typography>
        </Box>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,.06)' }} />
      <Box sx={{ px: 2.5, py: 1.8 }}>
        <Typography sx={{ fontSize: '.75rem', color: '#6b7280' }}>
          Meeting ID: <Box component="span" sx={{ color: '#a6a29a', fontFamily: "'JetBrains Mono','DM Mono',monospace" }}>{displayId}</Box>
        </Typography>
      </Box>
    </Popover>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MOBILE BOTTOM-SHEET  (Google Meet "More" drawer)
   ═══════════════════════════════════════════════════════════════════════ */
const MobileMoreSheet = ({
  open,
  onClose,
  meetingSettings,
  isConnected,
  isActiveShare,
  screenShareDisabled,
  isHandRaised,
  hasHostPrivileges,
  pendingHandsCount,
  chatUnreadCount,
  participantCount,
  attendanceEnabled,
  attendanceMinimized,
  currentAttendanceData,
  onToggleScreenShare,
  onToggleHandRaise,
  onToggleChat,
  onToggleParticipants,
  onToggleAttendance,
  meetingId,
  meetingCode,
  meetingLink,
  recordingState,
  onToggleRecording,
  onPauseResumeRecording,
  onToggleWhiteboard,
  onEndMeeting,
  onFullscreen,
  isFullscreen,
}) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        meetingLink || `${window.location.origin}/meeting/${meetingId}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const displayCode = meetingCode || meetingId || 'N/A';

  const gridTile = (active = false, danger = false) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: .7,
    borderRadius: '16px',
    background: danger
      ? 'rgba(234,67,53,.1)'
      : active
        ? 'rgba(138,180,248,.15)'
        : 'rgba(255,255,255,.05)',
    border: `1px solid ${danger
      ? 'rgba(234,67,53,.18)'
      : active
        ? 'rgba(138,180,248,.2)'
        : 'rgba(255,255,255,.04)'}`,
    cursor: 'pointer',
    transition: 'all .2s ease',
    minHeight: 84,
    '&:active': { transform: 'scale(.96)', background: active ? 'rgba(138,180,248,.22)' : 'rgba(255,255,255,.09)' },
  });

  const rowTile = (active = false, danger = false) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 1.8,
    borderRadius: '14px',
    background: danger
      ? 'rgba(234,67,53,.07)'
      : active
        ? 'rgba(138,180,248,.12)'
        : 'rgba(255,255,255,.04)',
    border: `1px solid ${danger
      ? 'rgba(234,67,53,.14)'
      : active
        ? 'rgba(138,180,248,.18)'
        : 'rgba(255,255,255,.03)'}`,
    px: 2.2,
    py: 1.8,
    cursor: 'pointer',
    transition: 'all .2s ease',
    '&:active': { transform: 'scale(.98)' },
  });

  const fire = (fn) => () => { if (fn) fn(); onClose(); };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          background: '#1a1d21',
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          maxHeight: '82vh',
          overflow: 'auto',
          boxShadow: '0 -10px 50px rgba(0,0,0,.65)',
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,.1)', borderRadius: 4 },
        },
      }}
      slotProps={{ backdrop: { sx: { backgroundColor: 'rgba(0,0,0,.55)' } } }}
    >
      <Box sx={{ px: 2, pb: 3 }}>
        {/* 2×2 PRIMARY GRID */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.1, mb: 1.2, mt: 2 }}>
          {meetingSettings?.handRaiseEnabled && (
            <Box sx={gridTile(isHandRaised)} onClick={fire(onToggleHandRaise)}>
              <Box sx={{ position: 'relative' }}>
                <PanTool sx={{ fontSize: 24, color: isHandRaised ? '#8ab4f8' : '#e8eaed' }} />
                {hasHostPrivileges && pendingHandsCount > 0 && (
                  <Box sx={{
                    position: 'absolute', top: -5, right: -11,
                    backgroundColor: '#f59e0b', color: '#fff',
                    fontSize: '.58rem', fontWeight: 700, borderRadius: 10,
                    minWidth: 16, height: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {pendingHandsCount}
                  </Box>
                )}
              </Box>
              <Typography sx={{ fontSize: '.7rem', color: isHandRaised ? '#8ab4f8' : 'rgba(255,255,255,.65)', fontWeight: 500 }}>
                {isHandRaised ? 'Lower hand' : 'Raise hand'}
              </Typography>
            </Box>
          )}

          <Box
            sx={gridTile(isActiveShare)}
            onClick={() => { if (!screenShareDisabled) { onToggleScreenShare(); onClose(); } }}
            style={{ opacity: screenShareDisabled ? .35 : 1, pointerEvents: screenShareDisabled ? 'none' : 'auto' }}
          >
            {isActiveShare
              ? <StopScreenShare sx={{ fontSize: 24, color: '#8ab4f8' }} />
              : <ScreenShare sx={{ fontSize: 24, color: '#e8eaed' }} />
            }
            <Typography sx={{ fontSize: '.7rem', color: isActiveShare ? '#8ab4f8' : 'rgba(255,255,255,.65)', fontWeight: 500 }}>
              {isActiveShare ? 'Stop sharing' : 'Share screen'}
            </Typography>
          </Box>

          {meetingSettings?.chatEnabled && (
            <Box sx={gridTile(false)} onClick={fire(onToggleChat)}>
              <Badge badgeContent={chatUnreadCount || 0} sx={{
                '& .MuiBadge-badge': {
                  backgroundColor: '#ea4335', color: '#fff',
                  fontSize: '.52rem', minWidth: 14, height: 14, fontWeight: 700,
                },
              }}>
                <Chat sx={{ fontSize: 24, color: '#e8eaed' }} />
              </Badge>
              <Typography sx={{ fontSize: '.7rem', color: 'rgba(255,255,255,.65)', fontWeight: 500 }}>In-call messages</Typography>
            </Box>
          )}

          <Box sx={gridTile(false)} onClick={fire(onToggleParticipants)}>
            <Badge badgeContent={participantCount} sx={{
              '& .MuiBadge-badge': {
                backgroundColor: 'rgba(138,180,248,.75)', color: '#fff',
                fontSize: '.52rem', minWidth: 14, height: 14, fontWeight: 700,
              },
            }}>
              <People sx={{ fontSize: 24, color: '#e8eaed' }} />
            </Badge>
            <Typography sx={{ fontSize: '.7rem', color: 'rgba(255,255,255,.65)', fontWeight: 500 }}>Participants</Typography>
          </Box>
        </Box>

        {/* HOST / CO-HOST CONTROLS */}
        {hasHostPrivileges && (
          <>
            <Divider sx={{ borderColor: 'rgba(255,255,255,.06)', my: 1.2 }} />
            <Typography sx={{
              fontSize: '.62rem', fontWeight: 700, color: 'rgba(255,255,255,.25)',
              textTransform: 'uppercase', letterSpacing: 1.3, mb: .8, px: .5,
            }}>
              Host Controls
            </Typography>

            <Box sx={{ ...rowTile(recordingState?.isRecording), mb: 1 }} onClick={fire(onToggleRecording)}>
              <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: recordingState?.isRecording ? 'rgba(234,67,53,.15)' : 'rgba(255,255,255,.06)', flexShrink: 0 }}>
                {recordingState?.isRecording
                  ? <Stop sx={{ fontSize: 20, color: '#f28b82' }} />
                  : <RadioButtonChecked sx={{ fontSize: 20, color: '#e8eaed' }} />
                }
                {recordingState?.isRecording && !recordingState?.isPaused && (
                  <Box sx={{
                    position: 'absolute', top: 3, right: 3,
                    width: 7, height: 7, borderRadius: '50%',
                    backgroundColor: '#ea4335',
                    animation: `${recPulse} 1.4s ease-in-out infinite`,
                  }} />
                )}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '.82rem', color: '#e8eaed', fontWeight: 500 }}>
                  {recordingState?.isRecording ? 'Stop Recording' : 'Start Recording'}
                </Typography>
                {recordingState?.isRecording && (
                  <Typography sx={{
                    fontSize: '.65rem', mt: .15,
                    color: recordingState.isPaused ? '#fbbf24' : '#f28b82',
                    fontFamily: "'JetBrains Mono','DM Mono',monospace",
                  }}>
                    {recordingState.isPaused ? '⏸ Paused' : '● Recording'}
                    {recordingState.duration > 0 && !recordingState.isPaused && (
                      <Box component="span" sx={{ ml: .6, opacity: .7 }}>
                        {Math.floor(recordingState.duration / 60).toString().padStart(2, '0')}:
                        {(recordingState.duration % 60).toString().padStart(2, '0')}
                      </Box>
                    )}
                  </Typography>
                )}
              </Box>
            </Box>

            {recordingState?.isRecording && (
              <Box sx={{ ...rowTile(recordingState?.isPaused), mb: 1 }} onClick={fire(onPauseResumeRecording)}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: 'rgba(255,255,255,.06)', flexShrink: 0 }}>
                  {recordingState?.isPaused
                    ? <PlayArrow sx={{ fontSize: 20, color: '#34d399' }} />
                    : <Pause sx={{ fontSize: 20, color: '#fbbf24' }} />
                  }
                </Box>
                <Typography sx={{ fontSize: '.82rem', color: '#e8eaed', fontWeight: 500 }}>
                  {recordingState?.isPaused ? 'Resume Recording' : 'Pause Recording'}
                </Typography>
              </Box>
            )}

            {meetingSettings?.whiteboardEnabled && (
              <Box sx={{ ...rowTile(false), mb: 1 }} onClick={fire(onToggleWhiteboard)}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: 'rgba(255,255,255,.06)', flexShrink: 0 }}>
                  <WhiteboardIcon sx={{ fontSize: 20, color: '#e8eaed' }} />
                </Box>
                <Typography sx={{ fontSize: '.82rem', color: '#e8eaed', fontWeight: 500 }}>Open Whiteboard</Typography>
              </Box>
            )}

            <Box sx={{ ...rowTile(false, true), mb: 1 }} onClick={fire(onEndMeeting)}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: 'rgba(234,67,53,.12)', flexShrink: 0 }}>
                <MeetingRoomIcon sx={{ fontSize: 20, color: '#f28b82' }} />
              </Box>
              <Typography sx={{ fontSize: '.82rem', color: '#f28b82', fontWeight: 600 }}>End Meeting for All</Typography>
            </Box>
          </>
        )}

        {/* GENERAL SECTION */}
        <Divider sx={{ borderColor: 'rgba(255,255,255,.06)', my: 1.2 }} />

        {attendanceEnabled && (
          <Box sx={{ ...rowTile(!attendanceMinimized), mb: 1 }} onClick={fire(onToggleAttendance)}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: !attendanceMinimized ? 'rgba(138,180,248,.1)' : 'rgba(255,255,255,.06)', flexShrink: 0 }}>
              {attendanceMinimized
                ? <VisibilityOff sx={{ fontSize: 20, color: '#e8eaed' }} />
                : <Visibility sx={{ fontSize: 20, color: '#8ab4f8' }} />
              }
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '.82rem', color: '#e8eaed', fontWeight: 500 }}>Attendance</Typography>
              {!attendanceMinimized && currentAttendanceData?.sessionActive && (
                <Typography sx={{ fontSize: '.65rem', color: 'rgba(255,255,255,.4)', mt: .15 }}>
                  {currentAttendanceData.attendancePercentage}% tracked
                </Typography>
              )}
            </Box>
            {!attendanceMinimized && currentAttendanceData?.sessionActive && (
              <Box sx={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                backgroundColor: currentAttendanceData.attendancePercentage > 80 ? '#34d399'
                  : currentAttendanceData.attendancePercentage > 60 ? '#fbbf24' : '#f87171',
              }} />
            )}
          </Box>
        )}

        <Box sx={{ ...rowTile(false), mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: 'rgba(255,255,255,.06)', flexShrink: 0 }}>
            <Info sx={{ fontSize: 20, color: '#e8eaed' }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '.82rem', color: '#e8eaed', fontWeight: 500 }}>Meeting details</Typography>
            <Typography noWrap sx={{
              fontSize: '.65rem', color: 'rgba(255,255,255,.3)', mt: .15,
              fontFamily: "'JetBrains Mono','DM Mono',monospace", maxWidth: 180,
            }}>
              ID: {displayCode}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); copy(); }}
            sx={{ color: copied ? '#34d399' : '#8ab4f8', width: 32, height: 32 }}
          >
            <ContentCopy sx={{ fontSize: 15 }} />
          </IconButton>
        </Box>
      </Box>
    </Drawer>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */
const MeetingControlBar = ({
  audioEnabled,
  videoEnabled,
  screenSharing,
  isScreenSharing,
  enhancedScreenShareData,
  currentUser,
  isConnected,
  chatOpen,
  participantsOpen,
  reactionsOpen,
  handRaiseOpen,
  showToggleMenu,
  attendanceMinimized,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleChat,
  onToggleParticipants,
  onToggleReactions,
  onToggleHandRaise,
  onToggleMenu,
  onToggleAttendance,
  onLeaveMeeting,
  meetingSettings,
  participantCount,
  chatUnreadCount,
  pendingHandsCount,
  isHandRaised,
  hasHostPrivileges,
  attendanceEnabled,
  currentAttendanceData,
  meetingId,
  meetingCode,
  meetingLink,
  recordingState,
  onToggleRecording,
  onPauseResumeRecording,
  onToggleWhiteboard,
  onEndMeeting,
  onFullscreen,
  isFullscreen,
}) => {
  const currentTime = useLiveClock();
  const [infoAnchorEl, setInfoAnchorEl] = useState(null);
  const infoOpen = Boolean(infoAnchorEl);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  /* ── Responsive breakpoints ── */
  const isXs      = useMediaQuery('(max-width:359px)');
  const isMobile  = useMediaQuery('(max-width:639px)');
  const isSm      = useMediaQuery('(min-width:640px) and (max-width:767px)');
  const isMd      = useMediaQuery('(min-width:640px) and (max-width:899px)');
  const isLg      = useMediaQuery('(min-width:900px) and (max-width:1199px)');
  const isXl      = useMediaQuery('(min-width:1200px)');

  const displayCode = meetingCode || meetingId || 'meeting';
  const shortCode =
    typeof displayCode === 'string' && displayCode.length > 16
      ? displayCode.slice(0, 12) + '\u2026'
      : displayCode;

  /* ── screen-share helpers ── */
  const screenShareTooltip = (() => {
    const { stream, sharer } = enhancedScreenShareData || {};
    if (stream && sharer) {
      const isMeSharing = sharer.isLocal || sharer.user_id?.toString() === currentUser?.id?.toString();
      if (isMeSharing) return 'Stop sharing';
      if (hasHostPrivileges) return `Stop ${sharer.name || "participant"}'s share`;
      return `${sharer.name || 'Someone'} is sharing`;
    }
    return 'Share screen';
  })();

  const screenShareDisabled = !isConnected || (() => {
    const { stream, sharer } = enhancedScreenShareData || {};
    if (stream && sharer) {
      const isMeSharing = sharer.isLocal || sharer.user_id?.toString() === currentUser?.id?.toString();
      return !isMeSharing && !hasHostPrivileges;
    }
    return false;
  })();

  const isActiveShare = screenSharing || isScreenSharing;

  /* ════════════════════════════════════════════════════════════════════════
     MOBILE LAYOUT  ─  top info strip + bottom bar + ⋮ bottom-sheet
     ════════════════════════════════════════════════════════════════════ */
  if (isMobile) {
    const btnSize = isXs ? 40 : 46;
    const endSize = isXs ? 44 : 50;
    const iconSize = isXs ? 18 : 20;

    const mb = (off = false) => ({
      width: btnSize,
      height: btnSize,
      borderRadius: '50%',
      flexShrink: 0,
      border: 'none',
      transition: 'all .18s ease',
      background: off ? 'rgba(234,67,53,.16)' : '#3c4043',
      color: off ? '#f28b82' : '#e8eaed',
      '&:hover': { background: off ? 'rgba(234,67,53,.26)' : '#4a4d51' },
      '&:active': { transform: 'scale(.91)' },
      '&:disabled': { opacity: .3 },
    });

    return (
      <>
        {/* ── TOP INFO STRIP ── */}
        <Box sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: { xs: 0.5, sm: 0.8 },
          px: { xs: 0.6, sm: 1 },
          py: { xs: 0.3, sm: 0.4 },
          background: 'rgba(28,30,34,.92)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(255,255,255,.05)',
          minHeight: { xs: 22, sm: 26 },
          overflow: 'hidden',
          flexWrap: 'nowrap',
        }}>
          {/* Time */}
          <Typography sx={{
            fontSize: { xs: '.58rem', sm: '.66rem' },
            fontWeight: 600,
            color: 'rgba(255,255,255,.5)',
            fontFeatureSettings: '"tnum"',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: .2,
            flexShrink: 0,
            lineHeight: 1,
            userSelect: 'none',
          }}>
            {currentTime}
          </Typography>

          {/* Separator */}
          <Box sx={{
            width: '1px',
            height: { xs: 7, sm: 9 },
            background: 'rgba(255,255,255,.1)',
            flexShrink: 0,
          }} />

          {/* Meeting code chip */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 0.25, sm: 0.4 },
            px: { xs: 0.4, sm: 0.6 },
            py: { xs: 0.15, sm: 0.2 },
            borderRadius: '5px',
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.03)',
            maxWidth: { xs: 80, sm: 120 },
            minWidth: 0,
            flex: '0 1 auto',
          }}>
            <Box sx={{
              width: { xs: 4, sm: 5 },
              height: { xs: 4, sm: 5 },
              borderRadius: '50%',
              flexShrink: 0,
              background: isConnected ? '#34d399' : '#fbbf24',
              boxShadow: isConnected
                ? '0 0 4px rgba(52,211,153,.4)'
                : '0 0 4px rgba(251,191,36,.4)',
            }} />
            <Typography noWrap sx={{
              fontSize: { xs: '.5rem', sm: '.58rem' },
              color: 'rgba(255,255,255,.35)',
              fontFamily: "'JetBrains Mono','DM Mono','Courier New',monospace",
              letterSpacing: .15,
              lineHeight: 1,
            }}>
              {shortCode}
            </Typography>
          </Box>

          {/* Recording badge (mobile) */}
          {recordingState?.isRecording && (
            <>
              <Box sx={{
                width: '1px',
                height: { xs: 7, sm: 9 },
                background: 'rgba(255,255,255,.08)',
                flexShrink: 0,
              }} />
              <InlineRecBadge
                recordingState={recordingState}
                size={isXs ? 'xs' : 'sm'}
                onPauseResume={onPauseResumeRecording}
                hasHostPrivileges={hasHostPrivileges}
              />
            </>
          )}
        </Box>

        {/* ── BOTTOM CONTROL BAR ── */}
        <Box sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: isXs ? '5px' : '8px',
          px: { xs: 0.6, sm: 1 },
          py: { xs: 0.6, sm: 0.8 },
          minHeight: isXs ? 54 : 62,
          background: 'rgba(28,30,34,.96)',
          backdropFilter: 'blur(14px)',
        }}>
          <IconButton onClick={onToggleVideo} disabled={!isConnected} sx={mb(!videoEnabled)}>
            {videoEnabled ? <Videocam sx={{ fontSize: iconSize }} /> : <VideocamOff sx={{ fontSize: iconSize }} />}
          </IconButton>

          <IconButton onClick={onToggleAudio} disabled={!isConnected} sx={mb(!audioEnabled)}>
            {audioEnabled ? <Mic sx={{ fontSize: iconSize }} /> : <MicOff sx={{ fontSize: iconSize }} />}
          </IconButton>

          {meetingSettings?.reactionsEnabled && (
            <IconButton onClick={onToggleReactions} disabled={!isConnected} sx={mb(false)}>
              <EmojiEmotions sx={{ fontSize: iconSize }} />
            </IconButton>
          )}

          <IconButton onClick={() => setMobileSheetOpen(true)} sx={{ ...mb(false), position: 'relative' }}>
            <MoreVert sx={{ fontSize: iconSize }} />
            {hasHostPrivileges && (
              <Box sx={{
                position: 'absolute', top: isXs ? 5 : 6, right: isXs ? 5 : 6,
                width: 5, height: 5, borderRadius: '50%',
                background: '#8ab4f8', border: '1.5px solid #3c4043',
              }} />
            )}
          </IconButton>

          <IconButton
            onClick={onLeaveMeeting}
            sx={{
              width: endSize, height: endSize, borderRadius: '50%', flexShrink: 0,
              background: '#ea4335', color: '#fff', border: 'none',
              transition: 'all .18s ease',
              '&:hover': { background: '#f28b82' },
              '&:active': { transform: 'scale(.91)' },
            }}
          >
            <CallEnd sx={{ fontSize: isXs ? 19 : 21 }} />
          </IconButton>
        </Box>

        {/* ── Mobile bottom sheet ── */}
        <MobileMoreSheet
          open={mobileSheetOpen}
          onClose={() => setMobileSheetOpen(false)}
          meetingSettings={meetingSettings}
          isConnected={isConnected}
          isActiveShare={isActiveShare}
          screenShareDisabled={screenShareDisabled}
          isHandRaised={isHandRaised}
          hasHostPrivileges={hasHostPrivileges}
          pendingHandsCount={pendingHandsCount}
          chatUnreadCount={chatUnreadCount}
          participantCount={participantCount}
          attendanceEnabled={attendanceEnabled}
          attendanceMinimized={attendanceMinimized}
          currentAttendanceData={currentAttendanceData}
          onToggleScreenShare={onToggleScreenShare}
          onToggleHandRaise={onToggleHandRaise}
          onToggleChat={onToggleChat}
          onToggleParticipants={onToggleParticipants}
          onToggleAttendance={onToggleAttendance}
          meetingId={meetingId}
          meetingCode={meetingCode}
          meetingLink={meetingLink}
          recordingState={recordingState}
          onToggleRecording={onToggleRecording}
          onPauseResumeRecording={onPauseResumeRecording}
          onToggleWhiteboard={onToggleWhiteboard}
          onEndMeeting={onEndMeeting}
          onFullscreen={onFullscreen}
          isFullscreen={isFullscreen}
        />
      </>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════
     DESKTOP / TABLET  ─  3-section bar (left info | center pill | right icons)
     ════════════════════════════════════════════════════════════════════ */

  // Responsive size tokens based on breakpoint
  const avSz   = isMd ? 44 : isLg ? 48 : 50;
  const secSz  = isMd ? 38 : isLg ? 42 : 44;
  const infoSz = isMd ? 36 : isLg ? 40 : 42;
  const iconFs = isMd ? 19 : isLg ? 21 : 22;
  const smFs   = isMd ? 17 : isLg ? 19 : 20;
  const pillGap = isMd ? '5px' : isLg ? '6px' : '8px';
  const pillPx  = isMd ? '10px' : isLg ? '14px' : '16px';
  const pillPy  = isMd ? '7px' : isLg ? '9px' : '10px';
  const barMinH = isMd ? 62 : isLg ? 68 : 72;
  const barPx   = isMd ? 1.5 : isLg ? 2.5 : 3;

  // Rec badge size for desktop
  const recSize = isMd ? 'sm' : isLg ? 'md' : 'lg';

  const av = (off) => ({
    width: avSz, height: avSz, borderRadius: '50%', flexShrink: 0, border: 'none',
    transition: 'all .22s cubic-bezier(.4,0,.2,1)',
    background: off ? '#ea4335' : 'rgba(60,64,67,.85)', color: '#fff',
    '&:hover': { background: off ? '#f28b82' : 'rgba(74,77,81,.95)', transform: 'scale(1.08)', boxShadow: off ? '0 4px 20px rgba(234,67,53,.35)' : '0 4px 16px rgba(0,0,0,.35)' },
    '&:active': { transform: 'scale(.95)' },
    '&:disabled': { opacity: .35, transform: 'none' },
  });

  const sec = (on) => ({
    width: secSz, height: secSz, borderRadius: '50%', flexShrink: 0,
    transition: 'all .2s ease',
    background: on ? 'rgba(138,180,248,.18)' : 'transparent',
    color: on ? '#8ab4f8' : 'rgba(232,234,237,.8)',
    '&:hover': { background: on ? 'rgba(138,180,248,.25)' : 'rgba(255,255,255,.08)', transform: 'scale(1.06)' },
    '&:active': { transform: 'scale(.94)' },
    '&:disabled': { opacity: .35, transform: 'none' },
  });

  const inf = (on) => ({
    width: infoSz, height: infoSz, borderRadius: '50%', flexShrink: 0,
    transition: 'all .2s ease',
    color: on ? '#8ab4f8' : 'rgba(232,234,237,.75)',
    background: on ? 'rgba(138,180,248,.1)' : 'transparent',
    '&:hover': { background: 'rgba(255,255,255,.08)', color: '#e8eaed', transform: 'scale(1.06)' },
  });

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        fontFamily: "'DM Sans','Manrope',system-ui,sans-serif",
        background: 'linear-gradient(180deg,rgba(22,22,28,.92),rgba(16,16,20,.96))',
        backdropFilter: 'blur(20px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
        borderTop: '1px solid rgba(255,255,255,.05)',
        px: barPx,
        minHeight: barMinH,
        gap: .5,
        '&::before': {
          content: '""', position: 'absolute', top: 0, left: '10%', right: '10%',
          height: 1, background: 'linear-gradient(90deg,transparent,rgba(138,180,248,.12),transparent)',
          pointerEvents: 'none',
        },
      }}
    >
      {/* ══════════════════════════════════════════════════════════════════
          LEFT: time · meeting code · recording indicator
          ══════════════════════════════════════════════════════════════ */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { sm: 0.6, md: 0.8, lg: 1 },
        minWidth: { sm: 100, md: 140, lg: 160 },
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        {/* Time */}
        <Typography sx={{
          fontSize: { sm: '.8rem', md: '.88rem', lg: '.95rem' },
          fontWeight: 600,
          color: '#e8eaed',
          fontFeatureSettings: '"tnum"',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: .5,
          whiteSpace: 'nowrap',
          userSelect: 'none',
          flexShrink: 0,
        }}>
          {currentTime}
        </Typography>

        {/* Dot separator */}
        <Box sx={{
          width: { sm: 2.5, md: 3 },
          height: { sm: 2.5, md: 3 },
          borderRadius: '50%',
          background: 'rgba(255,255,255,.18)',
          flexShrink: 0,
        }} />

        {/* Meeting code chip */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { sm: 0.3, md: 0.4, lg: 0.5 },
          px: { sm: 0.5, md: 0.7, lg: 0.8 },
          py: { sm: 0.2, md: 0.25, lg: 0.3 },
          borderRadius: { sm: '5px', md: '6px' },
          background: 'rgba(255,255,255,.04)',
          border: '1px solid rgba(255,255,255,.04)',
          maxWidth: { sm: 90, md: 130, lg: 180 },
          minWidth: 0,
          flex: '0 1 auto',
          transition: 'background .2s ease',
          '&:hover': { background: 'rgba(255,255,255,.07)' },
        }}>
          <Box sx={{
            width: { sm: 4, md: 5, lg: 5 },
            height: { sm: 4, md: 5, lg: 5 },
            borderRadius: '50%',
            flexShrink: 0,
            background: isConnected ? '#34d399' : '#fbbf24',
            boxShadow: isConnected
              ? '0 0 5px rgba(52,211,153,.4)'
              : '0 0 5px rgba(251,191,36,.4)',
            transition: 'all .3s ease',
          }} />
          <Typography noWrap sx={{
            fontSize: { sm: '.58rem', md: '.65rem', lg: '.72rem' },
            color: 'rgba(255,255,255,.38)',
            fontFamily: "'JetBrains Mono','DM Mono','Courier New',monospace",
            letterSpacing: { sm: .15, md: .25, lg: .3 },
            lineHeight: 1,
          }}>
            {shortCode}
          </Typography>
        </Box>

        {/* ── INLINE RECORDING INDICATOR ── */}
        {recordingState?.isRecording && (
          <>
            <Box sx={{
              width: '1px',
              height: { sm: 10, md: 12, lg: 14 },
              background: 'rgba(255,255,255,.08)',
              flexShrink: 0,
              mx: { sm: 0.1, md: 0.2, lg: 0.3 },
            }} />
            <InlineRecBadge
              recordingState={recordingState}
              size={recSize}
              onPauseResume={onPauseResumeRecording}
              hasHostPrivileges={hasHostPrivileges}
            />
          </>
        )}
      </Box>

      {/* ══════════════════════════════════════════════════════════════════
          CENTER: controls pill
          ══════════════════════════════════════════════════════════════ */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: pillGap,
        background: 'rgba(40,42,48,.75)',
        border: '1px solid rgba(255,255,255,.06)',
        borderRadius: 9999,
        backdropFilter: 'blur(8px)',
        px: pillPx,
        py: pillPy,
        animation: `${slideUp} .4s ease both`,
        flexShrink: 1,
        minWidth: 0,
      }}>
        <Tooltip title={audioEnabled ? 'Mute' : 'Unmute'} placement="top" arrow>
          <IconButton onClick={onToggleAudio} disabled={!isConnected} sx={av(!audioEnabled)}>
            {audioEnabled ? <Mic sx={{ fontSize: iconFs }} /> : <MicOff sx={{ fontSize: iconFs }} />}
          </IconButton>
        </Tooltip>

        <Tooltip title={videoEnabled ? 'Turn off camera' : 'Turn on camera'} placement="top" arrow>
          <IconButton onClick={onToggleVideo} disabled={!isConnected} sx={av(!videoEnabled)}>
            {videoEnabled ? <Videocam sx={{ fontSize: iconFs }} /> : <VideocamOff sx={{ fontSize: iconFs }} />}
          </IconButton>
        </Tooltip>

        <Tooltip title={screenShareTooltip} placement="top" arrow>
          <IconButton onClick={onToggleScreenShare} disabled={screenShareDisabled}
            sx={{
              width: avSz, height: avSz, borderRadius: '50%', flexShrink: 0,
              transition: 'all .22s cubic-bezier(.4,0,.2,1)',
              background: isActiveShare ? '#8ab4f8' : 'rgba(60,64,67,.85)',
              color: isActiveShare ? '#1a1a2e' : '#fff',
              '&:hover': { background: isActiveShare ? '#a8c7fa' : 'rgba(74,77,81,.95)', transform: 'scale(1.08)' },
              '&:active': { transform: 'scale(.95)' },
              '&:disabled': { opacity: .35, transform: 'none' },
            }}
          >
            {isActiveShare ? <StopScreenShare sx={{ fontSize: iconFs }} /> : <ScreenShare sx={{ fontSize: iconFs }} />}
          </IconButton>
        </Tooltip>

        {meetingSettings?.reactionsEnabled && (
          <Tooltip title="Send reaction" placement="top" arrow>
            <IconButton onClick={onToggleReactions} disabled={!isConnected} sx={sec(reactionsOpen)}>
              <EmojiEmotions sx={{ fontSize: smFs }} />
            </IconButton>
          </Tooltip>
        )}

        {meetingSettings?.handRaiseEnabled && (
          <Tooltip
            title={
              hasHostPrivileges
                ? `Raised hands${pendingHandsCount > 0 ? ` (${pendingHandsCount})` : ''}`
                : isHandRaised ? 'Lower hand' : 'Raise hand'
            }
            placement="top" arrow
          >
            <IconButton onClick={onToggleHandRaise} disabled={!isConnected} sx={{ ...sec(isHandRaised || handRaiseOpen), position: 'relative' }}>
              <Badge
                badgeContent={hasHostPrivileges ? (pendingHandsCount > 0 ? pendingHandsCount : 0) : (isHandRaised ? 1 : 0)}
                sx={{
                  '& .MuiBadge-badge': {
                    backgroundColor: hasHostPrivileges ? '#f59e0b' : '#8ab4f8',
                    color: '#fff', fontSize: '.55rem', minWidth: 14, height: 14, fontWeight: 700,
                  },
                }}
              >
                <PanTool sx={{ fontSize: smFs }} />
              </Badge>
              {hasHostPrivileges && pendingHandsCount > 0 && (
                <Box sx={{
                  position: 'absolute', top: 2, right: 2,
                  width: 7, height: 7, borderRadius: '50%',
                  backgroundColor: '#f59e0b',
                  animation: `${breathe} 2s ease-in-out infinite`,
                }} />
              )}
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title="More options" placement="top" arrow>
          <IconButton onClick={onToggleMenu} sx={sec(showToggleMenu)}>
            <MoreVert sx={{ fontSize: smFs }} />
          </IconButton>
        </Tooltip>

        <PillDivider />

        <Tooltip title="Leave meeting" placement="top" arrow>
          <IconButton onClick={onLeaveMeeting} sx={{
            width: isMd ? 52 : 58,
            height: isMd ? 38 : 44,
            borderRadius: 24,
            background: '#ea4335', color: '#fff', border: 'none', flexShrink: 0,
            transition: 'all .22s ease',
            '&:hover': { background: '#f28b82', boxShadow: '0 6px 24px rgba(234,67,53,.4)', transform: 'scale(1.04)' },
            '&:active': { transform: 'scale(.96)' },
          }}>
            <CallEnd sx={{ fontSize: iconFs }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ══════════════════════════════════════════════════════════════════
          RIGHT: info icons
          ══════════════════════════════════════════════════════════════ */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { sm: '2px', md: '3px', lg: '4px' },
        minWidth: { sm: 100, md: 140, lg: 160 },
        justifyContent: 'flex-end',
        flexShrink: 0,
      }}>
        <Tooltip title="Meeting details" placement="top" arrow>
          <IconButton onClick={(e) => setInfoAnchorEl(e.currentTarget)} sx={inf(infoOpen)}>
            <Info sx={{ fontSize: smFs }} />
          </IconButton>
        </Tooltip>

        {meetingSettings?.chatEnabled && (
          <Tooltip title={`Chat${chatUnreadCount > 0 ? ` (${chatUnreadCount} unread)` : ''}`} placement="top" arrow>
            <IconButton onClick={onToggleChat} sx={inf(chatOpen)}>
              <Badge badgeContent={chatOpen ? 0 : chatUnreadCount} sx={{
                '& .MuiBadge-badge': {
                  backgroundColor: '#ea4335', fontSize: '.55rem', minWidth: 13, height: 13,
                  color: '#fff', fontWeight: 700,
                },
              }}>
                <Chat sx={{ fontSize: smFs }} />
              </Badge>
            </IconButton>
          </Tooltip>
        )}

        {attendanceEnabled && (
          <Tooltip title={attendanceMinimized ? 'Show attendance' : 'Hide attendance'} placement="top" arrow>
            <IconButton onClick={onToggleAttendance} sx={{ ...inf(!attendanceMinimized), position: 'relative' }}>
              {attendanceMinimized ? <VisibilityOff sx={{ fontSize: smFs }} /> : <Visibility sx={{ fontSize: smFs }} />}
              {!attendanceMinimized && currentAttendanceData?.sessionActive && (
                <Box sx={{
                  position: 'absolute', top: 3, right: 3,
                  width: 7, height: 7, borderRadius: '50%', border: '1.5px solid #16161c',
                  backgroundColor: currentAttendanceData.attendancePercentage > 80 ? '#34d399'
                    : currentAttendanceData.attendancePercentage > 60 ? '#fbbf24' : '#f87171',
                }} />
              )}
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title={`Participants (${participantCount})`} placement="top" arrow>
          <IconButton onClick={onToggleParticipants} sx={inf(participantsOpen)}>
            <Badge badgeContent={participantCount} sx={{
              '& .MuiBadge-badge': {
                backgroundColor: participantsOpen ? '#8ab4f8' : 'transparent',
                color: participantsOpen ? '#1a1a2e' : '#e8eaed',
                fontSize: '.55rem', minWidth: 14, height: 14, fontWeight: 700,
                border: participantsOpen ? 'none' : '1px solid rgba(255,255,255,.12)',
              },
            }}>
              <People sx={{ fontSize: smFs }} />
            </Badge>
          </IconButton>
        </Tooltip>
      </Box>

      {/* Desktop info popover */}
      <MeetingInfoPopover
        anchorEl={infoAnchorEl}
        open={infoOpen}
        onClose={() => setInfoAnchorEl(null)}
        meetingId={meetingId}
        meetingCode={meetingCode}
        meetingLink={meetingLink}
      />
    </Box>
  );
};

export default MeetingControlBar;