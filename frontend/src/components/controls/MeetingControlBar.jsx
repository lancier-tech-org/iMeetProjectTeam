// src/components/controls/MeetingControlBar.jsx - GOOGLE MEET STYLE LAYOUT
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Badge,
  Typography,
  Popover,
  Divider,
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
  Apps,
  Security,
  Close,
} from '@mui/icons-material';

// ─────────────────────────────────────────────────────────────────────
// LIVE CLOCK HOOK
// ─────────────────────────────────────────────────────────────────────
const useLiveClock = () => {
  const [time, setTime] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return time;
};

// ─────────────────────────────────────────────────────────────────────
// MEETING INFO POPOVER
// ─────────────────────────────────────────────────────────────────────
const MeetingInfoPopover = ({ anchorEl, open, onClose, meetingId, meetingLink }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const textToCopy = meetingLink || `${window.location.origin}/meeting/${meetingId}`;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

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
            maxWidth: '90vw',
            background: '#2d2e31',
            color: '#e8eaed',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            mb: 1,
          },
        },
      }}
    >
      {/* Header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2.5,
        py: 2,
      }}>
        <Typography sx={{
          fontSize: '1.1rem',
          fontWeight: 600,
          color: '#e8eaed',
          fontFamily: "'DM Sans', 'Google Sans', sans-serif",
        }}>
          Meeting details
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ color: '#9aa0a6', '&:hover': { background: 'rgba(255,255,255,0.08)' } }}
        >
          <Close fontSize="small" />
        </IconButton>
      </Box>

      {/* Joining Info */}
      <Box sx={{ px: 2.5, pb: 2 }}>
        <Typography sx={{
          fontSize: '0.8rem',
          fontWeight: 600,
          color: '#8ab4f8',
          mb: 0.5,
          fontFamily: "'DM Sans', 'Google Sans', sans-serif",
        }}>
          Joining info
        </Typography>
        <Typography sx={{
          fontSize: '0.82rem',
          color: '#bdc1c6',
          mb: 1.2,
          fontFamily: "'DM Sans', monospace",
          wordBreak: 'break-all',
        }}>
          {meetingLink || `${window.location.origin}/meeting/${meetingId}`}
        </Typography>

        {/* Copy button */}
        <Box
          onClick={handleCopy}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.8,
            cursor: 'pointer',
            color: '#8ab4f8',
            py: 0.5,
            borderRadius: '6px',
            transition: 'opacity 0.2s',
            '&:hover': { opacity: 0.8 },
          }}
        >
          <ContentCopy sx={{ fontSize: '1rem' }} />
          <Typography sx={{
            fontSize: '0.82rem',
            fontWeight: 500,
            fontFamily: "'DM Sans', 'Google Sans', sans-serif",
          }}>
            {copied ? 'Copied!' : 'Copy joining info'}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      {/* Additional info */}
      <Box sx={{ px: 2.5, py: 2 }}>
        <Typography sx={{
          fontSize: '0.8rem',
          color: '#9aa0a6',
          fontFamily: "'DM Sans', 'Google Sans', sans-serif",
        }}>
          Meeting ID: {meetingId || 'N/A'}
        </Typography>
      </Box>
    </Popover>
  );
};


// ─────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────
const MeetingControlBar = ({
  // Audio/Video states
  audioEnabled,
  videoEnabled,
  screenSharing,
  isScreenSharing,
  enhancedScreenShareData,
  currentUser,
  // Connection state
  isConnected,

  // Panel states
  chatOpen,
  participantsOpen,
  reactionsOpen,
  handRaiseOpen,
  showToggleMenu,
  attendanceMinimized,

  // Handlers
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

  // Settings
  meetingSettings,

  // Counts
  participantCount,
  chatUnreadCount,
  pendingHandsCount,

  // User state
  isHandRaised,
  hasHostPrivileges,
  attendanceEnabled,
  currentAttendanceData,

  // NEW PROPS for meeting info
  meetingId,
  meetingCode,
  meetingLink,
}) => {
  const currentTime = useLiveClock();
  const [infoAnchorEl, setInfoAnchorEl] = useState(null);
  const infoOpen = Boolean(infoAnchorEl);

  // Derive a short meeting code from meetingId
  const displayCode = meetingCode || meetingId || 'meeting';
  const shortCode = typeof displayCode === 'string' && displayCode.length > 16
    ? displayCode.slice(0, 12) + '…'
    : displayCode;

  // ── Shared button style generator ──────────────────────────────
  const ctrlBtnSx = (isActive, size = 'md', activeColor = '#8ab4f8', dangerMode = false) => ({
    width: size === 'lg'
      ? { xs: 44, sm: 48, md: 52 }
      : size === 'sm'
        ? { xs: 36, sm: 38, md: 42 }
        : { xs: 40, sm: 44, md: 48 },
    height: size === 'lg'
      ? { xs: 44, sm: 48, md: 52 }
      : size === 'sm'
        ? { xs: 36, sm: 38, md: 42 }
        : { xs: 40, sm: 44, md: 48 },
    background: dangerMode
      ? (isActive ? '#ea4335' : '#3c4043')
      : (isActive ? activeColor : '#3c4043'),
    color: dangerMode
      ? '#fff'
      : (isActive ? '#202124' : '#e8eaed'),
    borderRadius: '50%',
    transition: 'background-color 0.2s ease',
    border: 'none',
    flexShrink: 0,
    position: 'relative',
    zIndex: 1,
    '&:hover': {
      background: dangerMode
        ? (isActive ? '#f28b82' : '#4a4d51')
        : (isActive ? '#a8c7fa' : '#4a4d51'),
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    },
    '&:disabled': {
      opacity: 0.4,
      cursor: 'not-allowed',
    },
  });

  // ── Shared right-side icon style ───────────────────────────────
  const infoBtnSx = (isActive) => ({
    width: { xs: 36, sm: 40, md: 44 },
    height: { xs: 36, sm: 40, md: 44 },
    color: isActive ? '#8ab4f8' : '#e8eaed',
    borderRadius: '50%',
    transition: 'background-color 0.2s ease, color 0.2s ease',
    flexShrink: 0,
    '&:hover': {
      background: 'rgba(255,255,255,0.08)',
    },
  });

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: { xs: 1, sm: 2, md: 3 },
        py: 0,
        gap: { xs: 0.5, sm: 1 },
        minHeight: { xs: 56, sm: 64, md: 72 },
        position: 'relative',
      }}
    >

      {/* ═══════════════════════════════════════════════════════════════
          LEFT SECTION — Time + Meeting Code
          ═══════════════════════════════════════════════════════════ */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 0.8, sm: 1.2 },
          minWidth: { xs: 80, sm: 140, md: 180 },
          flexShrink: 0,
        }}
      >
        {/* Time */}
        <Typography
          sx={{
            fontSize: { xs: '0.8rem', sm: '0.88rem', md: '0.95rem' },
            fontWeight: 500,
            color: '#e8eaed',
            fontFamily: "'DM Sans', 'Google Sans', -apple-system, sans-serif",
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
        >
          {currentTime}
        </Typography>

        {/* Separator dot */}
        <Box
          sx={{
            width: '1px',
            height: 16,
            background: 'rgba(255,255,255,0.2)',
            flexShrink: 0,
            display: { xs: 'none', sm: 'block' },
          }}
        />

        {/* Meeting code */}
        <Tooltip title={`Meeting ID: ${displayCode}`} placement="top">
          <Typography
            sx={{
              fontSize: { xs: '0.72rem', sm: '0.8rem', md: '0.88rem' },
              fontWeight: 400,
              color: '#9aa0a6',
              fontFamily: "'DM Sans', 'Google Sans', monospace",
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: { xs: 60, sm: 100, md: 160 },
              cursor: 'default',
              display: { xs: 'none', sm: 'block' },
            }}
          >
            {shortCode}
          </Typography>
        </Tooltip>
      </Box>

      {/* ═══════════════════════════════════════════════════════════════
          CENTER SECTION — Main Controls
          ═══════════════════════════════════════════════════════════ */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: { xs: 0.5, sm: 0.8, md: 1 },
          background: 'rgba(32, 33, 36, 0.85)',
          backdropFilter: 'blur(12px)',
          borderRadius: '28px',
          padding: { xs: '8px 10px', sm: '10px 16px', md: '12px 20px' },
          border: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 1,
          minWidth: 0,
          overflow: 'visible',
        }}
      >
        {/* ── Mic ───────────────────────────────────────────── */}
        <Tooltip title={audioEnabled ? 'Mute' : 'Unmute'}>
          <IconButton
            onClick={onToggleAudio}
            disabled={!isConnected}
            sx={ctrlBtnSx(!audioEnabled, 'lg', '#ea4335', true)}
          >
            {audioEnabled ? <Mic /> : <MicOff />}
          </IconButton>
        </Tooltip>

        {/* ── Camera ────────────────────────────────────────── */}
        <Tooltip title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}>
          <IconButton
            onClick={onToggleVideo}
            disabled={!isConnected}
            sx={ctrlBtnSx(!videoEnabled, 'lg', '#ea4335', true)}
          >
            {videoEnabled ? <Videocam /> : <VideocamOff />}
          </IconButton>
        </Tooltip>

        {/* ── Screen Share ──────────────────────────────────── */}
        <Tooltip
          title={(() => {
            const { stream, sharer } = enhancedScreenShareData || {};
            if (stream && sharer) {
              const isMeSharing = sharer.isLocal || sharer.user_id?.toString() === currentUser?.id?.toString();
              if (isMeSharing) return 'Stop sharing';
              if (hasHostPrivileges) return `Stop ${sharer.name || 'participant'}'s share`;
              return `${sharer.name || 'Someone'} is sharing`;
            }
            return 'Share screen';
          })()}
        >
          <IconButton
            onClick={onToggleScreenShare}
            disabled={
              !isConnected || (() => {
                const { stream, sharer } = enhancedScreenShareData || {};
                if (stream && sharer) {
                  const isMeSharing = sharer.isLocal || sharer.user_id?.toString() === currentUser?.id?.toString();
                  return !isMeSharing && !hasHostPrivileges;
                }
                return false;
              })()
            }
            sx={{
              ...ctrlBtnSx(screenSharing || isScreenSharing, 'lg', '#8ab4f8'),
              // Override: when sharing, use light blue
              background: (screenSharing || isScreenSharing) ? '#8ab4f8' : '#3c4043',
              color: (screenSharing || isScreenSharing) ? '#202124' : '#fff',
              '&:hover': {
                background: (screenSharing || isScreenSharing) ? '#a8c7fa' : '#4a4d51',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              },
            }}
          >
            {screenSharing || isScreenSharing ? <StopScreenShare /> : <ScreenShare />}
          </IconButton>
        </Tooltip>

        {/* ── Reactions ─────────────────────────────────────── */}
        {meetingSettings?.reactionsEnabled && (
          <Tooltip title="Send reaction">
            <IconButton
              onClick={onToggleReactions}
              disabled={!isConnected}
              sx={ctrlBtnSx(reactionsOpen, 'md')}
            >
              <EmojiEmotions />
            </IconButton>
          </Tooltip>
        )}

        {/* ── Hand Raise ───────────────────────────────────── */}
        {meetingSettings?.handRaiseEnabled && (
          <Tooltip
            title={
              hasHostPrivileges
                ? `View raised hands${pendingHandsCount > 0 ? ` (${pendingHandsCount})` : ''}`
                : isHandRaised ? 'Lower hand' : 'Raise hand'
            }
          >
            <IconButton
              onClick={onToggleHandRaise}
              disabled={!isConnected}
              sx={ctrlBtnSx(isHandRaised || handRaiseOpen, 'md')}
            >
              <Badge
                badgeContent={
                  hasHostPrivileges
                    ? (pendingHandsCount > 0 ? pendingHandsCount : 0)
                    : (isHandRaised ? 1 : 0)
                }
                sx={{
                  '& .MuiBadge-badge': {
                    backgroundColor: hasHostPrivileges ? '#f59e0b' : '#8ab4f8',
                    color: '#fff',
                    fontSize: '0.6rem',
                    minWidth: 15,
                    height: 15,
                  },
                }}
              >
                <PanTool />
              </Badge>
              {hasHostPrivileges && pendingHandsCount > 0 && (
                <Box sx={{
                  position: 'absolute',
                  top: -1,
                  right: -1,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#f59e0b',
                  animation: 'pulse 2s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%': { opacity: 1, transform: 'scale(1)' },
                    '50%': { opacity: 0.5, transform: 'scale(1.3)' },
                    '100%': { opacity: 1, transform: 'scale(1)' },
                  },
                }} />
              )}
            </IconButton>
          </Tooltip>
        )}

        {/* ── More Options ─────────────────────────────────── */}
        <Tooltip title="More options">
          <IconButton
            onClick={onToggleMenu}
            sx={ctrlBtnSx(showToggleMenu, 'md')}
          >
            <MoreVert />
          </IconButton>
        </Tooltip>

        {/* ── Separator ────────────────────────────────────── */}
        <Box sx={{
          width: '1px',
          height: 28,
          background: 'rgba(255,255,255,0.15)',
          mx: { xs: 0.3, sm: 0.5 },
          flexShrink: 0,
          display: { xs: 'none', sm: 'block' },
        }} />

        {/* ── Leave ────────────────────────────────────────── */}
        <Tooltip title="Leave meeting">
          <IconButton
            onClick={onLeaveMeeting}
            sx={{
              width: { xs: 48, sm: 52, md: 56 },
              height: { xs: 38, sm: 42, md: 46 },
              background: '#ea4335',
              color: '#fff',
              borderRadius: '24px',
              transition: 'background-color 0.2s ease',
              border: 'none',
              flexShrink: 0,
              '&:hover': {
                background: '#f28b82',
                boxShadow: '0 4px 16px rgba(234,67,53,0.35)',
              },
            }}
          >
            <CallEnd />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ═══════════════════════════════════════════════════════════════
          RIGHT SECTION — Info icons (Meeting Info, Chat, Participants, etc.)
          ═══════════════════════════════════════════════════════════ */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 0, sm: 0.3, md: 0.5 },
          minWidth: { xs: 80, sm: 140, md: 180 },
          justifyContent: 'flex-end',
          flexShrink: 0,
        }}
      >
        {/* ── Meeting Info ─────────────────────────────────── */}
        <Tooltip title="Meeting details">
          <IconButton
            onClick={(e) => setInfoAnchorEl(e.currentTarget)}
            sx={infoBtnSx(infoOpen)}
          >
            <Info sx={{ fontSize: { xs: '1.2rem', md: '1.35rem' } }} />
          </IconButton>
        </Tooltip>

        {/* ── Chat (right side shortcut) ───────────────────── */}
        {meetingSettings?.chatEnabled && (
          <Tooltip title={`Chat${chatUnreadCount > 0 ? ` (${chatUnreadCount} unread)` : ''}`}>
            <IconButton
              onClick={onToggleChat}
              sx={infoBtnSx(chatOpen)}
            >
              <Badge
                badgeContent={chatOpen ? 0 : chatUnreadCount}
                sx={{
                  '& .MuiBadge-badge': {
                    backgroundColor: '#ea4335',
                    fontSize: '0.6rem',
                    minWidth: 14,
                    height: 14,
                    color: '#fff',
                  },
                }}
              >
                <Chat sx={{ fontSize: { xs: '1.2rem', md: '1.35rem' } }} />
              </Badge>
            </IconButton>
          </Tooltip>
        )}

        {/* ── Attendance ───────────────────────────────────── */}
        {attendanceEnabled && (
          <Tooltip title={attendanceMinimized ? 'Show attendance' : 'Hide attendance'}>
            <IconButton
              onClick={onToggleAttendance}
              sx={{
                ...infoBtnSx(!attendanceMinimized),
                position: 'relative',
              }}
            >
              {attendanceMinimized ? (
                <VisibilityOff sx={{ fontSize: { xs: '1.2rem', md: '1.35rem' } }} />
              ) : (
                <Visibility sx={{ fontSize: { xs: '1.2rem', md: '1.35rem' } }} />
              )}
              {/* status dot */}
              {attendanceEnabled && !attendanceMinimized && currentAttendanceData?.sessionActive && (
                <Box sx={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor:
                    currentAttendanceData.attendancePercentage > 80 ? '#22c55e' :
                    currentAttendanceData.attendancePercentage > 60 ? '#f59e0b' : '#ef4444',
                  border: '1.5px solid #2d2e31',
                }} />
              )}
            </IconButton>
          </Tooltip>
        )}

        {/* ── Participants (right side shortcut) ───────────── */}
        <Tooltip title={`Participants (${participantCount})`}>
          <IconButton
            onClick={onToggleParticipants}
            sx={infoBtnSx(participantsOpen)}
          >
            <Badge
              badgeContent={participantCount}
              sx={{
                '& .MuiBadge-badge': {
                  backgroundColor: participantsOpen ? '#8ab4f8' : 'transparent',
                  color: participantsOpen ? '#202124' : '#e8eaed',
                  fontSize: '0.6rem',
                  minWidth: 14,
                  height: 14,
                  fontWeight: 600,
                  border: participantsOpen ? 'none' : '1px solid rgba(255,255,255,0.15)',
                },
              }}
            >
              <People sx={{ fontSize: { xs: '1.2rem', md: '1.35rem' } }} />
            </Badge>
          </IconButton>
        </Tooltip>
      </Box>

      {/* ═══════════════════════════════════════════════════════════════
          MEETING INFO POPOVER
          ═══════════════════════════════════════════════════════════ */}
      <MeetingInfoPopover
        anchorEl={infoAnchorEl}
        open={infoOpen}
        onClose={() => setInfoAnchorEl(null)}
        meetingId={meetingId || displayCode}
        meetingLink={meetingLink}
      />
    </Box>
  );
};

export default MeetingControlBar;