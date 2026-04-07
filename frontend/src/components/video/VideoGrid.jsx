// src/components/video/VideoGrid.jsx — REDESIGNED: 3×3 Pagination + Google Meet Pin + Premium UI
import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Chip,
  Avatar,
  useTheme,
  alpha,
  Button,
  Divider,
  useMediaQuery,
} from '@mui/material';
import {
  MoreVert,
  MicOff,
  VideocamOff,
  VolumeUp,
  Star,
  Monitor,
  Person,
  PushPin,
  PushPinOutlined,
  PersonOff,
  SupervisorAccount,
  ChevronLeft,
  ChevronRight,
  GridView,
  Close,
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import VideoPlayer from './VideoPlayer';
import { Track } from 'livekit-client';

// ─── PERFORMANCE CONFIG ──────────────────────────────────────────────────────
const PERFORMANCE_CONFIG = {
  THROTTLE_DELAY: 200,
  DEBOUNCE_DELAY: 100,
  STREAM_UPDATE_DELAY: 500,
};

// ─── RESPONSIVE GRID SIZES ──────────────────────────────────────────────────
// Returns { cols, rows, perPage } based on container/screen width
const getGridConfig = (width) => {
  if (width < 480) return { cols: 1, rows: 2, perPage: 2 };
  if (width < 640) return { cols: 2, rows: 2, perPage: 4 };
  if (width < 900) return { cols: 2, rows: 3, perPage: 6 };
  return { cols: 3, rows: 2, perPage: 6 }; // Default 3×2
};

// ─── ANIMATIONS ──────────────────────────────────────────────────────────────
const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
`;

const speakingPulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.5); }
  50%      { box-shadow: 0 0 0 6px rgba(76, 175, 80, 0); }
`;

const slideInRight = keyframes`
  from { opacity: 0; transform: translateX(24px); }
  to   { opacity: 1; transform: translateX(0); }
`;

const dotPulse = keyframes`
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
`;

// ─── STYLED COMPONENTS ───────────────────────────────────────────────────────

// Root container — absorbs 100 % of parent
const GridRoot = styled(Box)(() => ({
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#0c0c0f',
  position: 'relative',
  fontFamily: `'Outfit', 'Segoe UI', sans-serif`,
}));

// The actual CSS-Grid that holds participant tiles
const TileGrid = styled(Box, {
  shouldForwardProp: (p) => !['cols', 'rows', 'gapPx'].includes(p),
})(({ cols = 3, rows = 3, gapPx = 8 }) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${cols}, 1fr)`,
  gridTemplateRows: `repeat(${rows}, 1fr)`,
  gap: gapPx,
  width: '100%',
  flex: 1,
  minHeight: 0,
  padding: gapPx,
}));

// Single tile wrapper — holds video or avatar
const Tile = styled(Box, {
  shouldForwardProp: (p) =>
    !['isSpeaking', 'isPinned', 'isRemoving', 'animDelay'].includes(p),
})(({ theme, isSpeaking, isPinned, isRemoving, animDelay = 0 }) => ({
  position: 'relative',
  borderRadius: 14,
  overflow: 'hidden',
  backgroundColor: '#18181d',
  border: `2px solid ${
    isPinned
      ? '#f59e0b'
      : isSpeaking
      ? '#22c55e'
      : 'rgba(255,255,255,0.06)'
  }`,
  animation: `${fadeIn} 0.35s ease both`,
  animationDelay: `${animDelay}ms`,
  transition: 'border-color 0.3s ease, opacity 0.4s ease, filter 0.4s ease',
  opacity: isRemoving ? 0.4 : 1,
  filter: isRemoving ? 'grayscale(1) blur(1px)' : 'none',
  ...(isSpeaking && {
    animation: `${fadeIn} 0.35s ease both, ${speakingPulse} 1.8s ease-in-out infinite`,
  }),
  '&:hover .tile-overlay': { opacity: 1 },
  '&:hover .tile-pin-btn': { opacity: 1 },
}));

// Hover overlay (gradient at bottom for name)
const TileOverlay = styled(Box)(() => ({
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(0deg, rgba(0,0,0,0.72) 0%, transparent 40%)',
  opacity: 0.85,
  transition: 'opacity 0.25s ease',
  pointerEvents: 'none',
  zIndex: 5,
}));

// Pagination bar at the bottom
const PaginationBar = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '8px 12px',
  flexShrink: 0,
}));

const PageDot = styled('button', {
  shouldForwardProp: (p) => p !== 'active',
})(({ active }) => ({
  width: active ? 24 : 8,
  height: 8,
  borderRadius: 100,
  border: 'none',
  cursor: 'pointer',
  backgroundColor: active ? '#3b82f6' : 'rgba(255,255,255,0.2)',
  transition: 'all 0.3s ease',
  padding: 0,
  '&:hover': {
    backgroundColor: active ? '#3b82f6' : 'rgba(255,255,255,0.4)',
  },
}));

// ─── PIN LAYOUT STYLED ──────────────────────────────────────────────────────

// Wrapper for pinned layout: large area + sidebar
const PinLayout = styled(Box)(() => ({
  display: 'flex',
  width: '100%',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  gap: 6,
  padding: 6,
}));

// The large (spotlight) area
const PinSpotlight = styled(Box)(() => ({
  flex: 1,
  minWidth: 0,
  borderRadius: 14,
  overflow: 'hidden',
  position: 'relative',
  backgroundColor: '#18181d',
  border: '2px solid #f59e0b',
}));

// Sidebar strip holding the remaining tiles
const PinSidebar = styled(Box, {
  shouldForwardProp: (p) => p !== 'isHorizontal',
})(({ isHorizontal }) =>
  isHorizontal
    ? {
        display: 'flex',
        flexDirection: 'row',
        gap: 6,
        overflowX: 'auto',
        overflowY: 'hidden',
        width: '100%',
        height: 130,
        flexShrink: 0,
        '&::-webkit-scrollbar': { height: 4 },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: 4,
        },
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: 220,
        flexShrink: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: 4,
        },
      }
);

const SidebarTile = styled(Box, {
  shouldForwardProp: (p) => !['isSpeaking', 'isHorizontal', 'animIdx'].includes(p),
})(({ isSpeaking, isHorizontal, animIdx = 0 }) => ({
  position: 'relative',
  borderRadius: 10,
  overflow: 'hidden',
  backgroundColor: '#18181d',
  border: `2px solid ${isSpeaking ? '#22c55e' : 'rgba(255,255,255,0.06)'}`,
  flexShrink: 0,
  cursor: 'pointer',
  transition: 'border-color 0.3s, transform 0.2s',
  animation: `${slideInRight} 0.3s ease both`,
  animationDelay: `${animIdx * 60}ms`,
  ...(isHorizontal
    ? { width: 190, height: '100%' }
    : { width: '100%', aspectRatio: '16/10' }),
  '&:hover': {
    borderColor: '#f59e0b',
    transform: 'scale(1.03)',
  },
  '&:hover .tile-overlay': { opacity: 1 },
}));

// ─── SCREEN SHARE ────────────────────────────────────────────────────────────
const ScreenShareRoot = styled(Box)(() => ({
  width: '100%',
  height: '100%',
  backgroundColor: '#000',
  overflow: 'hidden',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

// ════════════════════════════════════════════════════════════════════════════
// HELPER — camera actually enabled
// ════════════════════════════════════════════════════════════════════════════
const isCameraActuallyEnabled = (participant) => {
  if (!participant) return false;
  if (participant.liveKitParticipant) {
    const lk = participant.liveKitParticipant;
    if (lk.isCameraEnabled === true) return true;
    if (lk.isCameraEnabled === false) return false;
    if (typeof lk.getTrackPublication === 'function') {
      try {
        const pub = lk.getTrackPublication(Track.Source.Camera);
        if (pub?.track) {
          if (pub.track.isMuted) return false;
          if (pub.track.mediaStreamTrack?.enabled) return true;
        }
      } catch (_) {}
    }
  }
  if (participant.isCameraEnabled === true) return true;
  if (participant.isVideoEnabled === true) return true;
  if (participant.video_enabled === true) return true;
  return false;
};

// ════════════════════════════════════════════════════════════════════════════
// HELPER — get stream for screen-share
// ════════════════════════════════════════════════════════════════════════════
const getParticipantStreamEnhanced = (participant, localStream, remoteStreams) => {
  if (!participant) return null;
  for (const src of [participant.stream, participant.videoStream]) {
    if (src instanceof MediaStream && src.getTracks().length > 0) return src;
  }
  if (participant.isLocal && localStream instanceof MediaStream && localStream.getTracks().length > 0)
    return localStream;
  const pid = participant.user_id || participant.participant_id;
  if (remoteStreams && remoteStreams.size > 0) {
    for (const key of [pid?.toString(), `user_${pid}`, participant.identity, participant.sid, 'local'].filter(Boolean)) {
      if (remoteStreams.has(key)) {
        const s = remoteStreams.get(key);
        if (s instanceof MediaStream && s.getTracks().length > 0) return s;
      }
    }
  }
  return null;
};

// ════════════════════════════════════════════════════════════════════════════
// ROLE BADGE — small coloured chip
// ════════════════════════════════════════════════════════════════════════════
const RoleBadge = ({ role }) => {
  if (!role) return null;
  const cfg =
    role === 'host'
      ? { bg: '#f59e0b', icon: <Star sx={{ fontSize: 11 }} />, label: 'Host' }
      : role === 'cohost'
      ? { bg: '#f97316', icon: <SupervisorAccount sx={{ fontSize: 11 }} />, label: 'Co-Host' }
      : null;
  if (!cfg) return null;
  return (
    <Chip
      icon={cfg.icon}
      label={cfg.label}
      size="small"
      sx={{
        height: 20,
        fontSize: '0.6rem',
        fontWeight: 700,
        letterSpacing: 0.4,
        backgroundColor: alpha(cfg.bg, 0.92),
        color: '#fff',
        '& .MuiChip-icon': { color: '#fff' },
        backdropFilter: 'blur(6px)',
      }}
    />
  );
};

// ════════════════════════════════════════════════════════════════════════════
// AVATAR COLOURS (deterministic from name)
// ════════════════════════════════════════════════════════════════════════════
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
  'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
];

const avatarGradient = (name) => {
  let hash = 0;
  const s = name || 'U';
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
};

// ════════════════════════════════════════════════════════════════════════════
// ParticipantRenderer — a single tile (used in grid, pin-spotlight, sidebar)
// ════════════════════════════════════════════════════════════════════════════
const ParticipantRenderer = memo(
  ({
    participant,
    localStream,
    remoteStreams,
    isSpeaking = false,
    isPinned = false,
    onPinParticipant,
    isHost = false,
    isRemoving = false,
    onParticipantMenu,
    animDelay = 0,
    compact = false, // sidebar mode
    showPinButton = true,
    // Wrapper can be overridden (Tile vs SidebarTile)
    WrapperComponent,
    wrapperProps = {},
  }) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const lastTrackIdRef = useRef(null);
    const videoAttachedRef = useRef(false);
    const [menuAnchor, setMenuAnchor] = useState(null);

    const cameraOn = useMemo(
      () => isCameraActuallyEnabled(participant),
      [
        participant.liveKitParticipant?.isCameraEnabled,
        participant.isCameraEnabled,
        participant.isVideoEnabled,
        participant.video_enabled,
      ]
    );

    // ── Stream resolution ──
    useEffect(() => {
      if (!cameraOn) {
        streamRef.current = null;
        lastTrackIdRef.current = null;
        return;
      }
      let newStream = null;
      let trackId = null;

      // Local
      if (participant.isLocal) {
        if (participant.liveKitParticipant) {
          try {
            const pub = participant.liveKitParticipant.getTrackPublication?.(Track.Source.Camera);
            if (pub?.track?.mediaStreamTrack) {
              const mt = pub.track.mediaStreamTrack;
              trackId = mt.id;
              if (trackId !== lastTrackIdRef.current) {
                if (mt.readyState === 'live' && !pub.track.isMuted) newStream = new MediaStream([mt]);
              } else newStream = streamRef.current;
            }
          } catch (_) {}
        }
        if (!newStream && participant.stream instanceof MediaStream) {
          const vt = participant.stream.getVideoTracks();
          if (vt.length > 0 && vt.some((t) => t.readyState === 'live')) {
            newStream = participant.stream;
            trackId = vt[0]?.id;
          }
        }
        if (!newStream && localStream instanceof MediaStream) {
          const vt = localStream.getVideoTracks();
          if (vt.length > 0 && vt.some((t) => t.readyState === 'live')) {
            newStream = localStream;
            trackId = vt[0]?.id;
          }
        }
      } else {
        // Remote
        if (participant.stream instanceof MediaStream) {
          const vt = participant.stream.getVideoTracks();
          if (vt.length > 0 && vt.some((t) => t.readyState === 'live')) {
            newStream = participant.stream;
            trackId = vt[0]?.id;
          }
        }
        if (!newStream && participant.liveKitParticipant) {
          try {
            const pub = participant.liveKitParticipant.getTrackPublication?.(Track.Source.Camera);
            if (pub?.track?.mediaStreamTrack) {
              const mt = pub.track.mediaStreamTrack;
              trackId = mt.id;
              if (trackId !== lastTrackIdRef.current) {
                if (mt.readyState === 'live') newStream = new MediaStream([mt]);
              } else newStream = streamRef.current;
            }
          } catch (_) {}
        }
        if (!newStream && remoteStreams && remoteStreams.size > 0) {
          const pid = participant.user_id || participant.participant_id;
          for (const key of [pid?.toString(), `user_${pid}`, participant.identity, participant.sid].filter(Boolean)) {
            if (remoteStreams.has(key)) {
              const s = remoteStreams.get(key);
              if (s instanceof MediaStream) {
                const vt = s.getVideoTracks();
                if (vt.length > 0 && vt.some((t) => t.readyState === 'live')) {
                  newStream = s;
                  trackId = vt[0]?.id;
                  break;
                }
              }
            }
          }
        }
      }

      if (newStream && trackId && trackId !== lastTrackIdRef.current) {
        streamRef.current = newStream;
        lastTrackIdRef.current = trackId;
        videoAttachedRef.current = false;
      } else if (!newStream) {
        streamRef.current = null;
        lastTrackIdRef.current = null;
      }
    }, [
      cameraOn,
      participant.isLocal,
      participant.liveKitParticipant,
      participant.stream,
      localStream,
      remoteStreams,
      participant.user_id,
      participant.participant_id,
      participant.identity,
      participant.sid,
    ]);

    // ── Attach stream to <video> ──
    useEffect(() => {
      const el = videoRef.current;
      const stream = streamRef.current;
      if (!el) return;
      if (stream && cameraOn && !videoAttachedRef.current) {
        try {
          el.srcObject = stream;
          const p = el.play();
          if (p !== undefined) p.then(() => (videoAttachedRef.current = true)).catch(() => { el.muted = true; el.play().catch(() => {}); });
        } catch (_) {}
      } else if (!stream || !cameraOn) {
        if (el.srcObject) { el.srcObject = null; videoAttachedRef.current = false; }
      }
    });

    const showVideo = cameraOn && streamRef.current !== null;
    const audioOn = participant.isAudioEnabled || participant.audio_enabled || participant.isMicrophoneEnabled;
    const name = participant.displayName || participant.name || 'User';
    const initial = name.charAt(0).toUpperCase();
    const role =
      participant.role === 'host' || participant.isHost
        ? 'host'
        : participant.isCoHost
        ? 'cohost'
        : null;

    const handleMenuOpen = useCallback(
      (e) => {
        e.stopPropagation();
        setMenuAnchor(e.currentTarget);
        if (onParticipantMenu) onParticipantMenu(e, participant);
      },
      [onParticipantMenu, participant]
    );

    const handlePin = useCallback(
      (e) => {
        e.stopPropagation();
        if (onPinParticipant) onPinParticipant(participant.user_id);
      },
      [onPinParticipant, participant.user_id]
    );

    const Wrapper = WrapperComponent || Tile;

    return (
      <Wrapper
        isSpeaking={isSpeaking}
        isPinned={isPinned}
        isRemoving={isRemoving}
        animDelay={animDelay}
        {...wrapperProps}
      >
        {/* ── Video ── */}
        {showVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={participant.isLocal}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: participant.isLocal ? 'scaleX(-1)' : 'none',
              display: 'block',
              borderRadius: 'inherit',
            }}
          />
        ) : (
          /* ── Avatar placeholder ── */
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#1e1e24',
              borderRadius: 'inherit',
            }}
          >
            <Avatar
              sx={{
                width: compact ? 48 : 80,
                height: compact ? 48 : 80,
                fontSize: compact ? '1.2rem' : '2rem',
                fontWeight: 700,
                background: avatarGradient(name),
                mb: compact ? 0.5 : 1,
                boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
              }}
            >
              {initial}
            </Avatar>
            {!compact && (
              <Typography
                variant="caption"
                sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 500, fontSize: '0.7rem' }}
              >
                {isRemoving ? 'Removing…' : 'Camera off'}
              </Typography>
            )}
          </Box>
        )}

        {/* ── Bottom gradient overlay ── */}
        <TileOverlay className="tile-overlay" />

        {/* ── Name + badges (bottom) ── */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: compact ? 0.75 : 1.25,
            py: compact ? 0.5 : 0.75,
            zIndex: 10,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            <Typography
              noWrap
              sx={{
                color: '#fff',
                fontSize: compact ? '0.65rem' : '0.78rem',
                fontWeight: 600,
                letterSpacing: 0.2,
                textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                maxWidth: compact ? 100 : 160,
              }}
            >
              {name}
              {participant.isLocal && (
                <Box component="span" sx={{ opacity: 0.6, fontWeight: 400, ml: 0.4 }}>
                  (You)
                </Box>
              )}
            </Typography>
            <RoleBadge role={role} />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            {!audioOn && (
              <Box
                sx={{
                  backgroundColor: 'rgba(239,68,68,0.85)',
                  borderRadius: '50%',
                  p: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <MicOff sx={{ fontSize: compact ? 11 : 13, color: '#fff' }} />
              </Box>
            )}
            {!cameraOn && !showVideo && (
              <Box
                sx={{
                  backgroundColor: 'rgba(239,68,68,0.85)',
                  borderRadius: '50%',
                  p: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <VideocamOff sx={{ fontSize: compact ? 11 : 13, color: '#fff' }} />
              </Box>
            )}
          </Box>
        </Box>

        {/* ── Speaking indicator (top-left) ── */}
        {isSpeaking && (
          <Box
            sx={{
              position: 'absolute',
              top: 6,
              left: showPinButton ? 36 : 6,
              backgroundColor: 'rgba(34,197,94,0.9)',
              borderRadius: '6px',
              px: 0.8,
              py: 0.25,
              display: 'flex',
              alignItems: 'center',
              gap: 0.4,
              zIndex: 15,
              backdropFilter: 'blur(4px)',
            }}
          >
            <VolumeUp sx={{ fontSize: 12, color: '#fff' }} />
            {!compact && (
              <Typography sx={{ color: '#fff', fontSize: '0.55rem', fontWeight: 600, letterSpacing: 0.3 }}>
                Speaking
              </Typography>
            )}
          </Box>
        )}

        {/* ── Pin button (top-left, on hover) ── */}
        {showPinButton && onPinParticipant && (
          <IconButton
            className="tile-pin-btn"
            size="small"
            onClick={handlePin}
            sx={{
              position: 'absolute',
              top: 6,
              left: 6,
              zIndex: 15,
              opacity: isPinned ? 1 : 0,
              transition: 'opacity 0.2s, background 0.2s',
              backgroundColor: isPinned ? 'rgba(245,158,11,0.85)' : 'rgba(0,0,0,0.55)',
              color: '#fff',
              '&:hover': { backgroundColor: isPinned ? '#d97706' : 'rgba(0,0,0,0.75)' },
              width: 28,
              height: 28,
            }}
          >
            {isPinned ? <PushPin sx={{ fontSize: 14 }} /> : <PushPinOutlined sx={{ fontSize: 14 }} />}
          </IconButton>
        )}

        {/* ── Host 3-dot menu (top-right, on hover) ── */}
        {isHost && !participant.isLocal && (
          <IconButton
            className="tile-pin-btn"
            size="small"
            onClick={handleMenuOpen}
            sx={{
              position: 'absolute',
              top: 6,
              right: 6,
              zIndex: 15,
              opacity: 0,
              transition: 'opacity 0.2s',
              backgroundColor: 'rgba(0,0,0,0.55)',
              color: '#fff',
              '&:hover': { backgroundColor: 'rgba(0,0,0,0.75)' },
              width: 28,
              height: 28,
            }}
          >
            <MoreVert sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Wrapper>
    );
  }
);

ParticipantRenderer.displayName = 'ParticipantRenderer';

// ════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ════════════════════════════════════════════════════════════════════════════
const EmptyState = ({ isHost }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      textAlign: 'center',
      px: 3,
    }}
  >
    <Box
      sx={{
        width: 100,
        height: 100,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mb: 2.5,
      }}
    >
      <Person sx={{ fontSize: 48, color: 'rgba(255,255,255,0.25)' }} />
    </Box>
    <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '1.05rem', mb: 0.5 }}>
      {isHost ? 'No participants yet' : 'Waiting for host…'}
    </Typography>
    <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem', maxWidth: 340, lineHeight: 1.6 }}>
      {isHost
        ? 'Students and co-hosts will appear here when they join'
        : "You'll see the host and co-hosts once they connect"}
    </Typography>

    {/* Animated dots */}
    <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.2)',
            animation: `${dotPulse} 1.4s ease-in-out ${i * 0.16}s infinite both`,
          }}
        />
      ))}
    </Box>
  </Box>
);

// ════════════════════════════════════════════════════════════════════════════
// MAIN VideoGrid COMPONENT
// ════════════════════════════════════════════════════════════════════════════
function VideoGrid({
  participants = [],
  localStream,
  remoteStreams = new Map(),
  screenShareStream,
  isScreenSharing = false,
  screenSharer,
  currentUser,
  onMuteParticipant,
  onRemoveParticipant,
  onPromoteToHost,
  onRemoveCoHost,
  onParticipantRemoved,
  viewMode = 'auto',
  containerHeight = '100%',
  containerWidth = '100%',
  isHost = false,
  coHosts = [],
}) {
  const theme = useTheme();
  const isXs = useMediaQuery('(max-width:479px)');
  const isSm = useMediaQuery('(min-width:480px) and (max-width:639px)');
  const isMd = useMediaQuery('(min-width:640px) and (max-width:899px)');
  // lg is everything >= 900

  const containerRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeSpeakers, setActiveSpeakers] = useState(new Set());
  const [pinnedId, setPinnedId] = useState(null); // single pinned participant
  const [locallyRemovedParticipants, setLocallyRemovedParticipants] = useState(new Set());

  // Menu state
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedParticipant, setSelectedParticipant] = useState(null);

  const isCurrentUserHost = isHost;

  // ── Grid config based on breakpoint ──
  const gridConfig = useMemo(() => {
    if (isXs) return { cols: 1, rows: 2, perPage: 2 };
    if (isSm) return { cols: 2, rows: 2, perPage: 4 };
    if (isMd) return { cols: 2, rows: 3, perPage: 6 };
    return { cols: 3, rows: 2, perPage: 6 };
  }, [isXs, isSm, isMd]);

  // ── Removal events (unchanged backend logic) ──
  useEffect(() => {
    const onRemoved = (e) => {
      const { removedUserId } = e.detail;
      setLocallyRemovedParticipants((prev) => new Set([...prev, removedUserId]));
      setTimeout(() => {
        setLocallyRemovedParticipants((prev) => {
          const s = new Set(prev);
          s.delete(removedUserId);
          return s;
        });
      }, 5000);
    };
    const onListChanged = (e) => {
      const { action, userId } = e.detail || {};
      if (action === 'remove' && userId)
        setLocallyRemovedParticipants((prev) => new Set([...prev, userId]));
      else if (action === 'backend_refresh') setLocallyRemovedParticipants(new Set());
    };
    window.addEventListener('participantRemoved', onRemoved);
    window.addEventListener('participantListChanged', onListChanged);
    return () => {
      window.removeEventListener('participantRemoved', onRemoved);
      window.removeEventListener('participantListChanged', onListChanged);
    };
  }, []);

  const handleImmediateRemoval = useCallback(
    (uid) => {
      setLocallyRemovedParticipants((prev) => new Set([...prev, uid]));
      if (onParticipantRemoved) onParticipantRemoved(uid);
    },
    [onParticipantRemoved]
  );

  // ── Filter participants (same logic as original) ──
  const filteredParticipants = useMemo(() => {
    const isActive = (p) => {
      if (locallyRemovedParticipants.has(p.user_id)) return false;
      const active = p.Is_Currently_Active === true || p.is_currently_active === true || p.isLocal === true;
      if (p.Leave_Time && !active) return false;
      if (['offline', 'removed', 'left'].includes(p.Status) && !active) return false;
      if (!p.user_id) return false;
      return true;
    };

    if (isCurrentUserHost) {
      return participants.filter((p) => {
        if (!isActive(p)) return false;
        if (p.isLocal || p.user_id === currentUser?.id) return false;
        return p.role !== 'host' && !p.isHost;
      });
    }
    const local = participants.find((p) => isActive(p) && (p.isLocal || p.user_id === currentUser?.id));
    const hostsCoHosts = participants.filter((p) => {
      if (!isActive(p)) return false;
      if (p.isLocal || p.user_id === currentUser?.id) return false;
      const isH = p.role === 'host' || p.isHost === true;
      const isCH = p.isCoHost === true;
      const connected = p.LiveKit_Connected || p.Has_Stream || p.Status === 'live' || p.Is_Currently_Active;
      return (isH || isCH) && connected;
    });
    return [...(local ? [local] : []), ...hostsCoHosts];
  }, [participants, isCurrentUserHost, currentUser?.id, coHosts, locallyRemovedParticipants]);

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(filteredParticipants.length / gridConfig.perPage));

  // Reset page when participants change
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  // Also reset page if pinned participant leaves
  useEffect(() => {
    if (pinnedId && !filteredParticipants.some((p) => p.user_id === pinnedId)) {
      setPinnedId(null);
    }
  }, [filteredParticipants, pinnedId]);

  const paginatedParticipants = useMemo(() => {
    if (pinnedId) return filteredParticipants; // pin mode shows all (spotlight + sidebar)
    const start = (currentPage - 1) * gridConfig.perPage;
    return filteredParticipants.slice(start, start + gridConfig.perPage);
  }, [filteredParticipants, currentPage, gridConfig.perPage, pinnedId]);

  // ── Pin / Unpin ──
  const handlePinParticipant = useCallback(
    (uid) => {
      setPinnedId((prev) => (prev === uid ? null : uid));
    },
    []
  );

  // ── Menu handlers ──
  const handleParticipantMenu = useCallback((e, p) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
    setSelectedParticipant(p);
  }, []);
  const handleCloseMenu = useCallback(() => {
    setAnchorEl(null);
    setSelectedParticipant(null);
  }, []);

  // ── Screen share renderer ──
  const renderScreenShare = useCallback(() => {
    const shareP =
      participants.find((p) => p.isScreenSharing) ||
      (screenSharer ? participants.find((p) => p.user_id === screenSharer.user_id) : null);
    const stream =
      screenShareStream || (shareP ? getParticipantStreamEnhanced(shareP, localStream, remoteStreams) : null);
    if (!stream && !screenShareStream) return null;

    return (
      <ScreenShareRoot>
        <VideoPlayer
          stream={stream}
          participant={
            shareP || {
              displayName: screenSharer?.name || 'Screen Share',
              isScreenSharing: true,
              user_id: screenSharer?.user_id || 'screen_share',
              isLocal: shareP?.isLocal || screenSharer?.isLocal || false,
              isAudioEnabled: true,
              isVideoEnabled: true,
            }
          }
          isLocal={shareP?.isLocal || screenSharer?.isLocal || false}
          isMuted={false}
          isVideoEnabled={true}
          participantName={shareP?.displayName || screenSharer?.name || 'Screen Share'}
          participantId={shareP?.user_id || screenSharer?.user_id || 'screen_share'}
          quality="good"
          volume={1.0}
          showControls={true}
          compact={false}
          isScreenShare={true}
        />
        {/* Floating label */}
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(59,130,246,0.92)',
            color: '#fff',
            px: 2,
            py: 0.5,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 0.8,
            fontSize: '0.78rem',
            fontWeight: 600,
            zIndex: 50,
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
          }}
        >
          <Monitor sx={{ fontSize: 16 }} />
          {shareP?.displayName || screenSharer?.name || 'Someone'} is sharing
        </Box>
      </ScreenShareRoot>
    );
  }, [participants, screenShareStream, screenSharer, localStream, remoteStreams]);

  // ═══════════════════════════════════════════════════════════════════════
  // SCREEN SHARE — full takeover
  // ═══════════════════════════════════════════════════════════════════════
  if (isScreenSharing || screenShareStream || participants.some((p) => p.isScreenSharing)) {
    return (
      <GridRoot ref={containerRef} sx={{ height: containerHeight, width: containerWidth }}>
        {renderScreenShare()}
      </GridRoot>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EMPTY
  // ═══════════════════════════════════════════════════════════════════════
  if (filteredParticipants.length === 0) {
    return (
      <GridRoot ref={containerRef} sx={{ height: containerHeight, width: containerWidth }}>
        <EmptyState isHost={isCurrentUserHost} />
      </GridRoot>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PINNED LAYOUT — Google-Meet style (spotlight + sidebar)
  // ═══════════════════════════════════════════════════════════════════════
  const pinnedParticipant = pinnedId ? filteredParticipants.find((p) => p.user_id === pinnedId) : null;

  if (pinnedParticipant) {
    const others = filteredParticipants.filter((p) => p.user_id !== pinnedId);
    const isNarrow = isXs || isSm;

    return (
      <GridRoot ref={containerRef} sx={{ height: containerHeight, width: containerWidth }}>
        {/* Unpin bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1.5,
            py: 0.6,
            flexShrink: 0,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PushPin sx={{ fontSize: 14, color: '#f59e0b' }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', fontWeight: 600 }}>
              {pinnedParticipant.displayName || pinnedParticipant.name} — pinned
            </Typography>
          </Box>
          <Tooltip title="Unpin and return to grid">
            <IconButton
              size="small"
              onClick={() => setPinnedId(null)}
              sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}
            >
              <GridView sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>

        <PinLayout sx={{ flexDirection: isNarrow ? 'column' : 'row' }}>
          {/* Spotlight */}
          <PinSpotlight>
            <ParticipantRenderer
              participant={pinnedParticipant}
              localStream={localStream}
              remoteStreams={remoteStreams}
              isSpeaking={activeSpeakers.has(pinnedParticipant.user_id)}
              isPinned={true}
              onPinParticipant={handlePinParticipant}
              isHost={isCurrentUserHost}
              onParticipantMenu={handleParticipantMenu}
              showPinButton={true}
              WrapperComponent={Box}
              wrapperProps={{
                sx: {
                  width: '100%',
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 'inherit',
                  '&:hover .tile-overlay': { opacity: 1 },
                  '&:hover .tile-pin-btn': { opacity: 1 },
                },
              }}
            />
          </PinSpotlight>

          {/* Sidebar */}
          {others.length > 0 && (
            <PinSidebar isHorizontal={isNarrow}>
              {others.map((p, idx) => (
                <SidebarTile
                  key={p.user_id || idx}
                  isSpeaking={activeSpeakers.has(p.user_id)}
                  isHorizontal={isNarrow}
                  animIdx={idx}
                  onClick={() => handlePinParticipant(p.user_id)}
                >
                  <ParticipantRenderer
                    participant={p}
                    localStream={localStream}
                    remoteStreams={remoteStreams}
                    isSpeaking={activeSpeakers.has(p.user_id)}
                    isPinned={false}
                    onPinParticipant={handlePinParticipant}
                    isHost={isCurrentUserHost}
                    onParticipantMenu={handleParticipantMenu}
                    compact
                    showPinButton={false}
                    WrapperComponent={Box}
                    wrapperProps={{
                      sx: {
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        overflow: 'hidden',
                        borderRadius: 'inherit',
                        '&:hover .tile-overlay': { opacity: 1 },
                        '&:hover .tile-pin-btn': { opacity: 1 },
                      },
                    }}
                  />
                </SidebarTile>
              ))}
            </PinSidebar>
          )}
        </PinLayout>

        {/* Host menu (shared) */}
        {renderHostMenu()}
      </GridRoot>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // NORMAL GRID + PAGINATION
  // ═══════════════════════════════════════════════════════════════════════

  // Determine effective grid dimensions for current page tile count
  const tileCount = paginatedParticipants.length;
  let effectiveCols = gridConfig.cols;
  let effectiveRows = gridConfig.rows;

  // Optimize grid when tiles < full grid (e.g., 2 tiles on a 3×3 should be 2×1)
  if (tileCount === 1) {
    effectiveCols = 1;
    effectiveRows = 1;
  } else if (tileCount === 2) {
    effectiveCols = 2;
    effectiveRows = 1;
  } else if (tileCount === 3) {
    effectiveCols = 3;
    effectiveRows = 1;
  } else if (tileCount === 4) {
    effectiveCols = 2;
    effectiveRows = 2;
  } else {
    // 5-6 tiles → 3×2 (max per page)
    effectiveCols = 3;
    effectiveRows = 2;
  }

  // On very small screens, further constrain
  if (isXs) {
    if (tileCount === 1) { effectiveCols = 1; effectiveRows = 1; }
    else { effectiveCols = 1; effectiveRows = Math.min(tileCount, 2); }
  } else if (isSm) {
    effectiveCols = Math.min(effectiveCols, 2);
    effectiveRows = Math.ceil(tileCount / effectiveCols);
  }

  const gapPx = tileCount === 1 ? 0 : isXs ? 4 : 8;

  // ── Render host menu as a function so it can be reused ──
  function renderHostMenu() {
    return (
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl) && Boolean(selectedParticipant)}
        onClose={handleCloseMenu}
        PaperProps={{
          sx: {
            backgroundColor: '#1e1e26',
            color: '#fff',
            minWidth: 200,
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {selectedParticipant && (
          <>
            {/* Header */}
            <Box sx={{ px: 2, py: 1.2, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                {selectedParticipant.displayName || selectedParticipant.name || 'Participant'}
              </Typography>
              <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', mt: 0.2 }}>
                Manage participant
              </Typography>
            </Box>

            {onMuteParticipant && (
              <MenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  const uid =
                    selectedParticipant.user_id || selectedParticipant.User_ID || selectedParticipant.id;
                  handleCloseMenu();
                  if (uid) onMuteParticipant(uid);
                }}
                sx={{
                  py: 1.2,
                  px: 2,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
                  gap: 1.5,
                }}
              >
                <MicOff sx={{ fontSize: 17, color: '#f59e0b' }} />
                <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                  Mute
                </Typography>
              </MenuItem>
            )}

            {onPromoteToHost && !selectedParticipant.isCoHost && (
              <MenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  const uid =
                    selectedParticipant.user_id || selectedParticipant.User_ID || selectedParticipant.id;
                  handleCloseMenu();
                  if (uid) onPromoteToHost({ userId: uid, participant: selectedParticipant });
                }}
                sx={{
                  py: 1.2,
                  px: 2,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
                  gap: 1.5,
                }}
              >
                <SupervisorAccount sx={{ fontSize: 17, color: '#22c55e' }} />
                <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                  Make Co-Host
                </Typography>
              </MenuItem>
            )}

            {onRemoveCoHost && selectedParticipant.isCoHost && (
              <MenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  const uid =
                    selectedParticipant.user_id || selectedParticipant.User_ID || selectedParticipant.id;
                  handleCloseMenu();
                  if (uid)
                    onRemoveCoHost(
                      uid,
                      selectedParticipant.displayName || selectedParticipant.name
                    );
                }}
                sx={{
                  py: 1.2,
                  px: 2,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
                  gap: 1.5,
                }}
              >
                <PersonOff sx={{ fontSize: 17, color: '#f59e0b' }} />
                <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                  Remove Co-Host
                </Typography>
              </MenuItem>
            )}

            {onRemoveParticipant && (
              <>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', my: 0.5 }} />
                <MenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    const uid =
                      selectedParticipant.user_id || selectedParticipant.User_ID || selectedParticipant.id;
                    handleCloseMenu();
                    if (uid)
                      onRemoveParticipant({
                        userId: uid,
                        user_id: uid,
                        participant: selectedParticipant,
                      });
                  }}
                  sx={{
                    py: 1.2,
                    px: 2,
                    color: '#ef4444',
                    '&:hover': { backgroundColor: 'rgba(239,68,68,0.08)' },
                    gap: 1.5,
                  }}
                >
                  <PersonOff sx={{ fontSize: 17 }} />
                  <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                    Remove from Meeting
                  </Typography>
                </MenuItem>
              </>
            )}
          </>
        )}
      </Menu>
    );
  }

  return (
    <GridRoot ref={containerRef} sx={{ height: containerHeight, width: containerWidth }}>
      {/* Page indicator (top) — only when multiple pages */}
      {totalPages > 1 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1.5,
            py: 0.6,
            flexShrink: 0,
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', fontWeight: 500 }}>
            {filteredParticipants.length} participant{filteredParticipants.length !== 1 ? 's' : ''}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', fontWeight: 500 }}>
            Page {currentPage} of {totalPages}
          </Typography>
        </Box>
      )}

      {/* Tile grid */}
      <TileGrid cols={effectiveCols} rows={effectiveRows} gapPx={gapPx}>
        {paginatedParticipants.map((participant, idx) => (
          <ParticipantRenderer
            key={participant.user_id || participant.participant_id || idx}
            participant={participant}
            localStream={localStream}
            remoteStreams={remoteStreams}
            isSpeaking={activeSpeakers.has(participant.user_id)}
            isPinned={false}
            onPinParticipant={handlePinParticipant}
            isHost={isCurrentUserHost}
            isRemoving={locallyRemovedParticipants.has(participant.user_id)}
            onParticipantMenu={handleParticipantMenu}
            animDelay={idx * 50}
          />
        ))}
      </TileGrid>

      {/* Pagination bar (bottom) */}
      {totalPages > 1 && (
        <PaginationBar>
          <IconButton
            size="small"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            sx={{
              color: currentPage === 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.7)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' },
              width: 32,
              height: 32,
            }}
          >
            <ChevronLeft sx={{ fontSize: 20 }} />
          </IconButton>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <PageDot key={page} active={page === currentPage} onClick={() => setCurrentPage(page)} />
          ))}

          <IconButton
            size="small"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            sx={{
              color: currentPage === totalPages ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.7)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' },
              width: 32,
              height: 32,
            }}
          >
            <ChevronRight sx={{ fontSize: 20 }} />
          </IconButton>
        </PaginationBar>
      )}

      {/* Host context menu */}
      {renderHostMenu()}
    </GridRoot>
  );
}

export default memo(VideoGrid);