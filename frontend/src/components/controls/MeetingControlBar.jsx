// src/components/controls/MeetingControlBar.jsx
// Google Meet–style responsive control bar
// Mobile: flat bar + ⋮ bottom-sheet drawer with host controls
// Desktop/Tablet: 3-section pill bar
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
  // ✅ Host action props
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

  /* ── Shared tile styles ── */
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

  /* close-then-fire helper */
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


        {/* ══════════════════════════════════════════════════════════════
           2×2 PRIMARY GRID
           ══════════════════════════════════════════════════════════ */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.1, mb: 1.2 }}>
          {/* Hand raise */}
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

          {/* Screen share */}
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

          {/* Chat */}
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

          {/* Participants */}
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

        {/* ══════════════════════════════════════════════════════════════
           HOST / CO-HOST CONTROLS SECTION
           ══════════════════════════════════════════════════════════ */}
        {hasHostPrivileges && (
          <>
            <Divider sx={{ borderColor: 'rgba(255,255,255,.06)', my: 1.2 }} />
            <Typography sx={{
              fontSize: '.62rem', fontWeight: 700, color: 'rgba(255,255,255,.25)',
              textTransform: 'uppercase', letterSpacing: 1.3, mb: .8, px: .5,
            }}>
              Host Controls
            </Typography>

            {/* ── Recording toggle ── */}
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

            {/* ── Pause / Resume (only when actively recording) ── */}
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

            {/* ── Whiteboard ── */}
            {meetingSettings?.whiteboardEnabled && (
              <Box sx={{ ...rowTile(false), mb: 1 }} onClick={fire(onToggleWhiteboard)}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: 'rgba(255,255,255,.06)', flexShrink: 0 }}>
                  <WhiteboardIcon sx={{ fontSize: 20, color: '#e8eaed' }} />
                </Box>
                <Typography sx={{ fontSize: '.82rem', color: '#e8eaed', fontWeight: 500 }}>Open Whiteboard</Typography>
              </Box>
            )}

            {/* ── End Meeting for All ── */}
            <Box sx={{ ...rowTile(false, true), mb: 1 }} onClick={fire(onEndMeeting)}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: 'rgba(234,67,53,.12)', flexShrink: 0 }}>
                <MeetingRoomIcon sx={{ fontSize: 20, color: '#f28b82' }} />
              </Box>
              <Typography sx={{ fontSize: '.82rem', color: '#f28b82', fontWeight: 600 }}>End Meeting for All</Typography>
            </Box>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════
           GENERAL SECTION
           ══════════════════════════════════════════════════════════ */}
        <Divider sx={{ borderColor: 'rgba(255,255,255,.06)', my: 1.2 }} />

        {/* Attendance */}
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


        {/* Meeting details row */}
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
  // ✅ NEW PROPS for mobile host controls
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
  const isXs      = useMediaQuery('(max-width:359px)');   // ultra-narrow (SE, fold)
  const isMobile  = useMediaQuery('(max-width:639px)');
  const isMd      = useMediaQuery('(min-width:640px) and (max-width:899px)');

  const displayCode = meetingCode || meetingId || 'meeting';
  const shortCode =
    typeof displayCode === 'string' && displayCode.length > 16
      ? displayCode.slice(0, 12) + '\u2026'
      : displayCode;

  /* ── screen-share helpers (backend logic unchanged) ── */
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
    /* button size adapts to ultra-narrow screens */
    const btnSize = isXs ? 42 : 48;
    const endSize = isXs ? 46 : 52;
    const iconSize = isXs ? 19 : 21;

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
    {/* ── TOP INFO STRIP: time + meeting ID + recording badge ── */}
<Box sx={{
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: { xs: 0.5, sm: 0.8, md: 1, lg: 1.2 },
  px: { xs: 0.8, sm: 1.2, md: 2, lg: 2.5 },
  py: { xs: 0.35, sm: 0.45, md: 0.5, lg: 0.55 },
  background: {
    xs: 'rgba(28,30,34,.92)',
    md: 'rgba(22,24,28,.88)',
  },
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  borderBottom: '1px solid rgba(255,255,255,.05)',
  minHeight: { xs: 24, sm: 28, md: 32, lg: 34 },
  overflow: 'hidden',
  transition: 'all .25s ease',
}}>

  {/* ── Time ── */}
  <Typography sx={{
    fontSize: { xs: '.62rem', sm: '.7rem', md: '.78rem', lg: '.84rem' },
    fontWeight: 600,
    color: { xs: 'rgba(255,255,255,.5)', md: 'rgba(255,255,255,.6)' },
    fontFeatureSettings: '"tnum"',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: { xs: 0.2, md: 0.4 },
    flexShrink: 0,
    lineHeight: 1,
    userSelect: 'none',
  }}>
    {currentTime}
  </Typography>

  {/* ── Divider ── */}
  <Box sx={{
    width: '1px',
    height: { xs: 8, sm: 9, md: 11, lg: 12 },
    background: 'rgba(255,255,255,.1)',
    flexShrink: 0,
    mx: { xs: 0.1, sm: 0.2, md: 0.3 },
  }} />

  {/* ── Meeting ID chip ── */}
  <Box sx={{
    display: 'flex',
    alignItems: 'center',
    gap: { xs: 0.3, sm: 0.4, md: 0.5, lg: 0.6 },
    minWidth: 0,
    flex: '0 1 auto',
    px: { xs: 0.5, sm: 0.6, md: 0.8, lg: 1 },
    py: { xs: 0.2, md: 0.3 },
    borderRadius: { xs: '5px', md: '7px' },
    background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(255,255,255,.03)',
    maxWidth: { xs: 100, sm: 140, md: 200, lg: 260 },
    cursor: 'default',
    transition: 'background .2s ease',
    '&:hover': {
      background: { md: 'rgba(255,255,255,.07)' },
    },
  }}>
    {/* Connection dot */}
    <Box sx={{
      width: { xs: 4, sm: 5, md: 5, lg: 6 },
      height: { xs: 4, sm: 5, md: 5, lg: 6 },
      borderRadius: '50%',
      flexShrink: 0,
      background: isConnected ? '#34d399' : '#fbbf24',
      boxShadow: isConnected
        ? '0 0 5px rgba(52,211,153,.45)'
        : '0 0 5px rgba(251,191,36,.4)',
      transition: 'background .3s ease, box-shadow .3s ease',
    }} />
    {/* Code text */}
    <Typography noWrap sx={{
      fontSize: { xs: '.55rem', sm: '.62rem', md: '.7rem', lg: '.75rem' },
      color: 'rgba(255,255,255,.4)',
      fontFamily: "'JetBrains Mono','DM Mono','Courier New',monospace",
      letterSpacing: { xs: 0.15, sm: 0.2, md: 0.3, lg: 0.4 },
      lineHeight: 1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }}>
      {shortCode}
    </Typography>
  </Box>

  {/* ── Recording indicator (only when recording) ── */}
  {recordingState?.isRecording && (
    <>
      {/* Divider before REC */}
      <Box sx={{
        width: '1px',
        height: { xs: 8, sm: 9, md: 11, lg: 12 },
        background: 'rgba(255,255,255,.08)',
        flexShrink: 0,
        mx: { xs: 0.1, sm: 0.15, md: 0.3 },
      }} />

      {/* REC badge */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 0.25, sm: 0.3, md: 0.4 },
        flexShrink: 0,
        px: { xs: 0.4, sm: 0.5, md: 0.7, lg: 0.8 },
        py: { xs: 0.15, sm: 0.2, md: 0.25 },
        borderRadius: { xs: '4px', md: '6px' },
        background: recordingState.isPaused
          ? 'rgba(251,191,36,.1)'
          : 'rgba(234,67,53,.1)',
        border: `1px solid ${recordingState.isPaused
          ? 'rgba(251,191,36,.15)'
          : 'rgba(234,67,53,.15)'}`,
        transition: 'background .3s ease, border-color .3s ease',
      }}>
        <FiberManualRecord sx={{
          fontSize: { xs: 5, sm: 6, md: 7, lg: 8 },
          color: recordingState.isPaused ? '#fbbf24' : '#ea4335',
          animation: recordingState.isPaused
            ? 'none'
            : `${recPulse} 1.4s ease-in-out infinite`,
        }} />
        <Typography sx={{
          fontSize: { xs: '.5rem', sm: '.55rem', md: '.62rem', lg: '.67rem' },
          fontWeight: 700,
          letterSpacing: { xs: 0.3, md: 0.5 },
          lineHeight: 1,
          color: recordingState.isPaused ? '#fbbf24' : '#ea4335',
        }}>
          {recordingState.isPaused ? 'PAUSED' : 'REC'}
        </Typography>

        {/* Duration timer — only on md+ screens */}
        {recordingState.duration > 0 && !recordingState.isPaused && (
          <Typography sx={{
            display: { xs: 'none', md: 'inline' },
            fontSize: { md: '.58rem', lg: '.62rem' },
            fontWeight: 500,
            fontFamily: "'JetBrains Mono','DM Mono',monospace",
            fontFeatureSettings: '"tnum"',
            fontVariantNumeric: 'tabular-nums',
            color: 'rgba(234,67,53,.7)',
            letterSpacing: 0.3,
            lineHeight: 1,
            ml: { md: 0.2, lg: 0.3 },
          }}>
            {Math.floor(recordingState.duration / 60).toString().padStart(2, '0')}
            :
            {(recordingState.duration % 60).toString().padStart(2, '0')}
          </Typography>
        )}
      </Box>
    </>
  )}
</Box>

        {/* ── BOTTOM CONTROL BAR ── */}
        <Box sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: isXs ? '6px' : '9px',
          px: 1,
          py: .8,
          minHeight: isXs ? 58 : 66,
          background: 'rgba(28,30,34,.96)',
          backdropFilter: 'blur(14px)',
        }}>
          {/* Camera */}
          <IconButton onClick={onToggleVideo} disabled={!isConnected} sx={mb(!videoEnabled)}>
            {videoEnabled ? <Videocam sx={{ fontSize: iconSize }} /> : <VideocamOff sx={{ fontSize: iconSize }} />}
          </IconButton>

          {/* Mic */}
          <IconButton onClick={onToggleAudio} disabled={!isConnected} sx={mb(!audioEnabled)}>
            {audioEnabled ? <Mic sx={{ fontSize: iconSize }} /> : <MicOff sx={{ fontSize: iconSize }} />}
          </IconButton>

          {/* Emoji / Reactions */}
          {meetingSettings?.reactionsEnabled && (
            <IconButton onClick={onToggleReactions} disabled={!isConnected} sx={mb(false)}>
              <EmojiEmotions sx={{ fontSize: iconSize }} />
            </IconButton>
          )}

          {/* ⋮ More → opens bottom sheet */}
          <IconButton onClick={() => setMobileSheetOpen(true)} sx={{ ...mb(false), position: 'relative' }}>
            <MoreVert sx={{ fontSize: iconSize }} />
            {/* dot badge when host has controls */}
            {hasHostPrivileges && (
              <Box sx={{
                position: 'absolute', top: isXs ? 6 : 7, right: isXs ? 6 : 7,
                width: 6, height: 6, borderRadius: '50%',
                background: '#8ab4f8', border: '1.5px solid #3c4043',
              }} />
            )}
          </IconButton>

          {/* End call */}
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
            <CallEnd sx={{ fontSize: isXs ? 20 : 22 }} />
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
     DESKTOP / TABLET  ─  3-section bar (time | pill | info icons)
     ════════════════════════════════════════════════════════════════════ */
  const avSz   = isMd ? 46 : 50;
  const secSz  = isMd ? 40 : 44;
  const infoSz = isMd ? 38 : 42;
  const iconFs = isMd ? 20 : 22;
  const smFs   = isMd ? 18 : 20;

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
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative',
        fontFamily: "'DM Sans','Manrope',system-ui,sans-serif",
        background: 'linear-gradient(180deg,rgba(22,22,28,.92),rgba(16,16,20,.96))',
        backdropFilter: 'blur(20px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
        borderTop: '1px solid rgba(255,255,255,.05)',
        px: { md: 2.5, lg: 3 }, minHeight: { md: 68, lg: 72 }, gap: .5,
        '&::before': {
          content: '""', position: 'absolute', top: 0, left: '10%', right: '10%',
          height: 1, background: 'linear-gradient(90deg,transparent,rgba(138,180,248,.12),transparent)',
          pointerEvents: 'none',
        },
      }}
    >
      {/* ── LEFT: time · meeting code · recording indicator ── */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minWidth: 160,
        flexShrink: 0,
      }}>
        {/* Time */}
        <Typography sx={{
          fontSize: { md: '.92rem', lg: '.95rem' },
          fontWeight: 600,
          color: '#e8eaed',
          fontFeatureSettings: '"tnum"',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: .5,
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}>
          {currentTime}
        </Typography>

        {/* Separator dot */}
        <Box sx={{
          width: 3,
          height: 3,
          borderRadius: '50%',
          background: 'rgba(255,255,255,.2)',
          flexShrink: 0,
        }} />

        {/* Meeting code chip */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 0.8,
          py: 0.3,
          borderRadius: '6px',
          background: 'rgba(255,255,255,.04)',
          border: '1px solid rgba(255,255,255,.04)',
          maxWidth: { md: 130, lg: 180 },
        }}>
          <Box sx={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            flexShrink: 0,
            background: isConnected ? '#34d399' : '#fbbf24',
            boxShadow: isConnected
              ? '0 0 5px rgba(52,211,153,.45)'
              : '0 0 5px rgba(251,191,36,.4)',
          }} />
          <Typography noWrap sx={{
            fontSize: { md: '.68rem', lg: '.72rem' },
            color: 'rgba(255,255,255,.4)',
            fontFamily: "'JetBrains Mono','DM Mono','Courier New',monospace",
            letterSpacing: 0.3,
            lineHeight: 1,
          }}>
            {shortCode}
          </Typography>
        </Box>

        {/* ── Recording indicator (inline, same style as mobile) ── */}
        {recordingState?.isRecording && (
          <>
         

            {/* REC badge */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              flexShrink: 0,
              px: { md: 0.8, lg: 1 },
              py: 0.3,
              borderRadius: '8px',
              background: recordingState.isPaused
                ? 'rgba(251,191,36,.1)'
                : 'rgba(234,67,53,.1)',
              border: `1px solid ${recordingState.isPaused
                ? 'rgba(251,191,36,.18)'
                : 'rgba(234,67,53,.18)'}`,
              transition: 'background .3s ease, border-color .3s ease',
              animation: `${slideUp} .3s ease both`,
            }}>
              {/* Pulsing dot */}
              <FiberManualRecord sx={{
                fontSize: { md: 8, lg: 9 },
                color: recordingState.isPaused ? '#fbbf24' : '#ea4335',
                animation: recordingState.isPaused
                  ? 'none'
                  : `${recPulse} 1.4s ease-in-out infinite`,
              }} />

              {/* REC / PAUSED label */}
              <Typography sx={{
                fontSize: { md: '.62rem', lg: '.68rem' },
                fontWeight: 700,
                letterSpacing: 0.6,
                lineHeight: 1,
                color: recordingState.isPaused ? '#fbbf24' : '#ea4335',
                userSelect: 'none',
              }}>
                {recordingState.isPaused ? 'PAUSED' : 'REC'}
              </Typography>

              {/* Duration timer */}
              {recordingState.duration > 0 && !recordingState.isPaused && (
                <Typography sx={{
                  fontSize: { md: '.6rem', lg: '.65rem' },
                  fontWeight: 500,
                  fontFamily: "'JetBrains Mono','DM Mono',monospace",
                  fontFeatureSettings: '"tnum"',
                  fontVariantNumeric: 'tabular-nums',
                  color: 'rgba(234,67,53,.7)',
                  letterSpacing: 0.3,
                  lineHeight: 1,
                  ml: 0.2,
                }}>
                  {Math.floor(recordingState.duration / 60).toString().padStart(2, '0')}
                  :
                  {(recordingState.duration % 60).toString().padStart(2, '0')}
                </Typography>
              )}

              {/* Paused duration info */}
              {recordingState.isPaused && recordingState.duration > 0 && (
                <Typography sx={{
                  fontSize: { md: '.58rem', lg: '.62rem' },
                  fontWeight: 500,
                  fontFamily: "'JetBrains Mono','DM Mono',monospace",
                  color: 'rgba(251,191,36,.6)',
                  lineHeight: 1,
                  ml: 0.2,
                }}>
                  {Math.floor(recordingState.duration / 60).toString().padStart(2, '0')}
                  :
                  {(recordingState.duration % 60).toString().padStart(2, '0')}
                </Typography>
              )}
            </Box>
          </>
        )}
      </Box>

      {/* ── CENTER: controls pill ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: isMd ? '6px' : '8px',
        background: 'rgba(40,42,48,.75)', border: '1px solid rgba(255,255,255,.06)',
        borderRadius: 9999, backdropFilter: 'blur(8px)',
        px: isMd ? '12px' : '16px', py: isMd ? '8px' : '10px',
        animation: `${slideUp} .4s ease both`,
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
            width: 58, height: 44, borderRadius: 24,
            background: '#ea4335', color: '#fff', border: 'none', flexShrink: 0,
            transition: 'all .22s ease',
            '&:hover': { background: '#f28b82', boxShadow: '0 6px 24px rgba(234,67,53,.4)', transform: 'scale(1.04)' },
            '&:active': { transform: 'scale(.96)' },
          }}>
            <CallEnd sx={{ fontSize: iconFs }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── RIGHT: info icons ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 160, justifyContent: 'flex-end', flexShrink: 0 }}>
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