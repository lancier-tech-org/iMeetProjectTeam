// src/components/video/VideoGrid.jsx - FIXED VERSION - FULL FILL + NO BLINKING
import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import {
  Box,
  Grid,
  Typography,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Chip,
  Avatar,
  useTheme,
  alpha,
  Pagination,
  Button,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider
} from '@mui/material';
import {
  MoreVert,
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  VolumeUp,
  Star,
  Monitor,
  PanTool,
  Person,
  ViewModule,
  ViewComfy,
  ViewStream,
  PushPin,
  PushPinOutlined,
  Fullscreen,
  FullscreenExit,
  PersonOff,
  VolumeOff,
  Warning,
  SupervisorAccount
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import VideoPlayer from './VideoPlayer';
import { throttle, debounce } from 'lodash';
import { Track } from 'livekit-client';

// Performance configuration
const PERFORMANCE_CONFIG = {
  MAX_VISIBLE_PARTICIPANTS: 25,
  MAX_PARTICIPANTS_PER_PAGE: 25,
  COMPACT_MODE_PARTICIPANTS: 49,
  COMFORTABLE_MODE_PARTICIPANTS: 25,
  FOCUS_MODE_PARTICIPANTS: 10,
  THROTTLE_DELAY: 200,
  DEBOUNCE_DELAY: 100,
  STREAM_UPDATE_DELAY: 500
};

// ✅ FIXED: GridContainer — zero padding so video fills 100%
const GridContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  height: '100%',
  padding: 0,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#0a0a0a',
  position: 'relative',
}));

// ✅ FIXED: RoleBasedGrid — fills 100%, single participant = full cover
const RoleBasedGrid = styled(Box, {
  shouldForwardProp: (prop) => !['isHost', 'participantCount'].includes(prop)
})(({ theme, isHost, participantCount }) => {
  const count = participantCount || 1;

  if (isHost) {
    // Host view: grid of students
    const cols = count === 1 ? 1 : Math.min(6, Math.ceil(Math.sqrt(count)));
    const rows = Math.ceil(count / cols);
    const gap = count === 1 ? 0 : theme.spacing(0.75);
    const pad = count === 1 ? 0 : theme.spacing(0.5);

    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gridTemplateRows: `repeat(${rows}, 1fr)`,
      gap,
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      minHeight: 0,
      padding: pad,

      // ✅ Single participant fills edge-to-edge
      ...(count === 1 && {
        '& > *': {
          borderRadius: 0,
        },
      }),
    };
  }

  // Participant (student) view
  let gridConfig;

  if (count === 1) {
    gridConfig = { columns: '1fr', rows: '1fr' };
  } else if (count === 2) {
    gridConfig = { columns: '1fr 1fr', rows: '1fr' };
  } else if (count === 3) {
    gridConfig = { columns: 'repeat(3, 1fr)', rows: '1fr' };
  } else if (count === 4) {
    gridConfig = { columns: 'repeat(2, 1fr)', rows: 'repeat(2, 1fr)' };
  } else if (count <= 6) {
    gridConfig = { columns: 'repeat(3, 1fr)', rows: 'repeat(2, 1fr)' };
  } else {
    gridConfig = {
      columns: 'repeat(auto-fit, minmax(280px, 1fr))',
      rows: 'repeat(auto-fit, minmax(210px, 1fr))',
    };
  }

  const gap = count === 1 ? 0 : theme.spacing(0.75);
  const pad = count === 1 ? 0 : theme.spacing(0.75);

  return {
    display: 'grid',
    gridTemplateColumns: gridConfig.columns,
    gridTemplateRows: gridConfig.rows,
    gap,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    minHeight: 0,
    padding: pad,
    alignItems: 'stretch',
    justifyItems: 'stretch',

    '& > *': {
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.3s ease',
      // ✅ Single participant = no border-radius (edge-to-edge)
      borderRadius: count === 1 ? 0 : theme.spacing(1),
      // ✅ REMOVED: minHeight, maxHeight, aspectRatio constraints
      // Let the grid cell dictate the size
    },

    '@media (max-width: 768px)': {
      gridTemplateColumns: count > 2 ? 'repeat(2, 1fr)' : gridConfig.columns,
      gap: count === 1 ? 0 : theme.spacing(0.5),
      padding: count === 1 ? 0 : theme.spacing(0.25),

      '& > *': {
        borderRadius: count === 1 ? 0 : theme.spacing(0.5),
      },
    },
  };
});

// ✅ FIXED: ParticipantContainer — single participant = no border-radius
const ParticipantContainer = styled(Box, {
  shouldForwardProp: (prop) => !['isScreenShare', 'isSpeaker', 'isLocal', 'isMinimized', 'isPinned', 'isHost', 'isCoHost', 'isRemoving'].includes(prop)
})(({ theme, isScreenShare, isSpeaker, isLocal, isMinimized, isPinned, isHost, isCoHost, isRemoving }) => ({
  position: 'relative',
  // ✅ borderRadius is inherited from the grid child rule (0 for single, 12px for multi)
  borderRadius: 'inherit',
  overflow: 'hidden',
  backgroundColor: '#1a1a1a',
  border: `2px solid ${
    isPinned ? theme.palette.warning.main :
    isScreenShare ? theme.palette.info.main : 
    isSpeaker ? theme.palette.success.main : 
    'transparent'
  }`,
  width: '100%',
  height: '100%',
  minHeight: 0,
  opacity: isRemoving ? 0.5 : 1,
  filter: isRemoving ? 'grayscale(100%)' : 'none',
  
  '&:hover': {
    '& .participant-controls': {
      opacity: 1,
    },
  },
  
  boxShadow: 'none',
}));

// Labels (unchanged)
const StudentVideoLabel = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  right: theme.spacing(1),
  backgroundColor: 'rgba(33, 150, 243, 0.9)',
  color: 'white',
  padding: theme.spacing(0.5, 1.5),
  borderRadius: theme.spacing(1.5),
  fontSize: '0.75rem',
  fontWeight: 600,
  zIndex: 20,
  backdropFilter: 'blur(8px)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
}));

const HostVideoLabel = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  right: theme.spacing(1),
  backgroundColor: 'rgba(255, 152, 0, 0.9)',
  color: 'white',
  padding: theme.spacing(0.5, 1.5),
  borderRadius: theme.spacing(1.5),
  fontSize: '0.75rem',
  fontWeight: 600,
  zIndex: 20,
  backdropFilter: 'blur(8px)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
}));

const CoHostVideoLabel = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  right: theme.spacing(1),
  backgroundColor: 'rgba(255, 87, 34, 0.9)',
  color: 'white',
  padding: theme.spacing(0.5, 1.5),
  borderRadius: theme.spacing(1.5),
  fontSize: '0.75rem',
  fontWeight: 600,
  zIndex: 20,
  backdropFilter: 'blur(8px)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
}));

const ParticipantInfo = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: theme.spacing(0.75),
  left: theme.spacing(0.75),
  right: theme.spacing(0.75),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderRadius: theme.spacing(1),
  padding: theme.spacing(0.5, 1),
  backdropFilter: 'blur(12px)',
  zIndex: 10,
}));

const ViewControls = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  right: theme.spacing(7),
  display: 'flex',
  gap: theme.spacing(0.5),
  zIndex: 20,
  backgroundColor: alpha(theme.palette.background.paper, 0.9),
  borderRadius: theme.spacing(1),
  padding: theme.spacing(0.75),
  backdropFilter: 'blur(10px)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
}));

// ✅ FIXED: ScreenShareContainer — fills 100% with no border-radius
const ScreenShareContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  height: '100%',
  backgroundColor: '#000',
  borderRadius: 0,           // ✅ Edge-to-edge
  overflow: 'hidden',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 0,
}));

const ParticipantMenuContainer = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(0.75),
  right: theme.spacing(0.75),
  opacity: 0,
  transition: 'opacity 0.2s',
  zIndex: 15,
  '&.visible': {
    opacity: 1
  }
}));

// ==========================================================================
// ✅ HELPER FUNCTION - Check if camera is actually enabled
// ==========================================================================
const isCameraActuallyEnabled = (participant) => {
  if (!participant) return false;

  if (participant.liveKitParticipant) {
    const lkParticipant = participant.liveKitParticipant;
    
    if (lkParticipant.isCameraEnabled === true) return true;
    if (lkParticipant.isCameraEnabled === false) return false;
    
    if (typeof lkParticipant.getTrackPublication === 'function') {
      try {
        const cameraPublication = lkParticipant.getTrackPublication(Track.Source.Camera);
        if (cameraPublication?.track) {
          if (cameraPublication.track.isMuted) return false;
          if (cameraPublication.track.mediaStreamTrack?.enabled) return true;
        }
      } catch (e) { /* ignore */ }
    }
  }

  if (participant.isCameraEnabled === true) return true;
  if (participant.isVideoEnabled === true) return true;
  if (participant.video_enabled === true) return true;

  return false;
};

// ==========================================================================
// ✅ PARTICIPANT RENDERER COMPONENT
// ==========================================================================
const ParticipantRenderer = memo(({
  participant,
  localStream,
  remoteStreams,
  isMinimized = false,
  onParticipantMenu,
  isSpeaking = false,
  isScreenShare = false,
  isPinned = false,
  onPinParticipant,
  isHost = false,
  currentUserId,
  showLabel = false,
  labelType = null,
  onRemoveParticipant,
  onPromoteToHost,
  onRemoveCoHost,
  onParticipantRemoved,
  isRemoving = false,
}) => {
  const theme = useTheme();
  const videoRef = useRef(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  
  const streamRef = useRef(null);
  const lastTrackIdRef = useRef(null);
  const videoAttachedRef = useRef(false);

  const cameraIsEnabled = useMemo(() => {
    return isCameraActuallyEnabled(participant);
  }, [
    participant.liveKitParticipant?.isCameraEnabled,
    participant.isCameraEnabled,
    participant.isVideoEnabled,
    participant.video_enabled,
  ]);

  useEffect(() => {
    if (!cameraIsEnabled) {
      streamRef.current = null;
      lastTrackIdRef.current = null;
      return;
    }

    let newStream = null;
    let trackId = null;

    if (participant.isLocal) {
      if (participant.liveKitParticipant) {
        try {
          const lkParticipant = participant.liveKitParticipant;
          const cameraPublication = lkParticipant.getTrackPublication?.(Track.Source.Camera);
          
          if (cameraPublication?.track?.mediaStreamTrack) {
            const mediaTrack = cameraPublication.track.mediaStreamTrack;
            trackId = mediaTrack.id;
            
            if (trackId !== lastTrackIdRef.current) {
              if (mediaTrack.readyState === 'live' && !cameraPublication.track.isMuted) {
                newStream = new MediaStream([mediaTrack]);
              }
            } else {
              newStream = streamRef.current;
            }
          }
        } catch (e) { /* ignore */ }
      }

      if (!newStream && participant.stream instanceof MediaStream) {
        const videoTracks = participant.stream.getVideoTracks();
        if (videoTracks.length > 0 && videoTracks.some(t => t.readyState === 'live')) {
          newStream = participant.stream;
          trackId = videoTracks[0]?.id;
        }
      }
      
      if (!newStream && localStream instanceof MediaStream) {
        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length > 0 && videoTracks.some(t => t.readyState === 'live')) {
          newStream = localStream;
          trackId = videoTracks[0]?.id;
        }
      }
    } else {
      if (participant.stream instanceof MediaStream) {
        const videoTracks = participant.stream.getVideoTracks();
        if (videoTracks.length > 0 && videoTracks.some(t => t.readyState === 'live')) {
          newStream = participant.stream;
          trackId = videoTracks[0]?.id;
        }
      }

      if (!newStream && participant.liveKitParticipant) {
        try {
          const cameraPublication = participant.liveKitParticipant.getTrackPublication?.(Track.Source.Camera);
          if (cameraPublication?.track?.mediaStreamTrack) {
            const mediaTrack = cameraPublication.track.mediaStreamTrack;
            trackId = mediaTrack.id;
            
            if (trackId !== lastTrackIdRef.current) {
              if (mediaTrack.readyState === 'live') {
                newStream = new MediaStream([mediaTrack]);
              }
            } else {
              newStream = streamRef.current;
            }
          }
        } catch (e) { /* ignore */ }
      }

      if (!newStream && remoteStreams && remoteStreams.size > 0) {
        const participantId = participant.user_id || participant.participant_id;
        const possibleKeys = [
          participantId?.toString(),
          `user_${participantId}`,
          participant.identity,
          participant.sid,
        ].filter(Boolean);

        for (const key of possibleKeys) {
          if (remoteStreams.has(key)) {
            const stream = remoteStreams.get(key);
            if (stream instanceof MediaStream) {
              const videoTracks = stream.getVideoTracks();
              if (videoTracks.length > 0 && videoTracks.some(t => t.readyState === 'live')) {
                newStream = stream;
                trackId = videoTracks[0]?.id;
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
    cameraIsEnabled, 
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

  useEffect(() => {
    const videoElement = videoRef.current;
    const stream = streamRef.current;

    if (!videoElement) return;

    if (stream && cameraIsEnabled && !videoAttachedRef.current) {
      try {
        videoElement.srcObject = stream;
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => { videoAttachedRef.current = true; })
            .catch(() => {
              videoElement.muted = true;
              videoElement.play().catch(() => {});
            });
        }
      } catch (error) {
        console.error("❌ Error attaching stream:", error);
      }
    } else if (!stream || !cameraIsEnabled) {
      if (videoElement.srcObject) {
        videoElement.srcObject = null;
        videoAttachedRef.current = false;
      }
    }
  });

  const shouldShowVideo = cameraIsEnabled && streamRef.current !== null;

  const handleMenuOpen = useCallback((event) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    if (onParticipantMenu) onParticipantMenu(event, participant);
  }, [onParticipantMenu, participant]);

  const handleMenuClose = useCallback(() => { setMenuAnchor(null); }, []);

  const handlePin = useCallback(() => {
    if (onPinParticipant) onPinParticipant(participant.user_id);
  }, [onPinParticipant, participant.user_id]);

  const displayVideoEnabled = shouldShowVideo || cameraIsEnabled;
  const displayAudioEnabled = participant.isAudioEnabled || participant.audio_enabled || participant.isMicrophoneEnabled;

  return (
    <ParticipantContainer
      isScreenShare={isScreenShare}
      isSpeaker={isSpeaking}
      isLocal={participant.isLocal}
      isMinimized={isMinimized}
      isPinned={isPinned}
      isHost={participant.isHost || participant.role === 'host'}
      isCoHost={participant.isCoHost}
      isRemoving={isRemoving}
    >
      {/* Role Label */}
      {showLabel && labelType === 'host' && <HostVideoLabel>HOST VIDEO</HostVideoLabel>}
      {showLabel && labelType === 'cohost' && <CoHostVideoLabel>CO-HOST</CoHostVideoLabel>}

      {/* Video display */}
      {shouldShowVideo ? (
        <>
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
              // ✅ Inherit border-radius from parent (0 for single, rounded for multi)
              borderRadius: 'inherit',
            }}
          />

          {/* Name overlay on video */}
          <ParticipantInfo>
            <Typography
              variant="caption"
              sx={{
                color: '#fff',
                backgroundColor: 'rgba(0,0,0,0.6)',
                padding: '2px 8px',
                borderRadius: 1,
                fontSize: '0.75rem',
                fontWeight: 500,
                maxWidth: '70%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {participant.displayName || participant.name}
              {participant.isLocal && ' (You)'}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {(participant.role === 'host' || participant.isHost) && (
                <Chip
                  icon={<Star sx={{ fontSize: 12 }} />}
                  label="Host"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    backgroundColor: 'rgba(255, 152, 0, 0.9)',
                    color: '#fff',
                    '& .MuiChip-icon': { color: '#fff' }
                  }}
                />
              )}
              {participant.isCoHost && (
                <Chip
                  icon={<SupervisorAccount sx={{ fontSize: 12 }} />}
                  label="Co-Host"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    backgroundColor: 'rgba(255, 87, 34, 0.9)',
                    color: '#fff',
                    '& .MuiChip-icon': { color: '#fff' }
                  }}
                />
              )}

              {!displayAudioEnabled && (
                <Box
                  sx={{
                    backgroundColor: 'rgba(244, 67, 54, 0.9)',
                    borderRadius: '50%',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MicOff sx={{ fontSize: 14, color: '#fff' }} />
                </Box>
              )}
            </Box>
          </ParticipantInfo>

          {/* Pin button */}
          {onPinParticipant && (
            <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 15 }}>
              <IconButton
                size="small"
                onClick={handlePin}
                sx={{
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  color: isPinned ? '#ff9800' : '#fff',
                  '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' },
                }}
              >
                {isPinned ? <PushPin sx={{ fontSize: 16 }} /> : <PushPinOutlined sx={{ fontSize: 16 }} />}
              </IconButton>
            </Box>
          )}

          {/* Speaking indicator */}
          {isSpeaking && (
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                left: onPinParticipant ? 40 : 8,
                backgroundColor: 'rgba(76, 175, 80, 0.9)',
                borderRadius: '4px',
                padding: '2px 6px',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                zIndex: 15,
              }}
            >
              <VolumeUp sx={{ fontSize: 14, color: '#fff' }} />
              <Typography variant="caption" sx={{ color: '#fff', fontSize: '0.6rem' }}>Speaking</Typography>
            </Box>
          )}
        </>
      ) : (
        /* Avatar/Placeholder when video is off */
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#2a2a2a',
            color: 'white',
            opacity: isRemoving ? 0.5 : 1,
            filter: isRemoving ? 'grayscale(100%)' : 'none',
            borderRadius: 'inherit',
          }}
        >
          <Avatar
            sx={{
              width: 80,
              height: 80,
              fontSize: '2rem',
              backgroundColor: participant.isLocal
                ? '#1976d2'
                : participant.role === 'host' || participant.isHost
                  ? '#ff9800'
                  : participant.isCoHost
                    ? '#ff5722'
                    : '#666',
              mb: 1,
              opacity: isRemoving ? 0.5 : 1,
            }}
          >
            {participant.displayName?.charAt(0)?.toUpperCase() || 'U'}
          </Avatar>
          
          <Typography variant="body2" sx={{ opacity: isRemoving ? 0.3 : 0.7, fontWeight: 500 }}>
            {isRemoving ? 'Removing...' : 'Camera off'}
          </Typography>

          {(participant.role === 'host' || participant.isHost) && (
            <Typography variant="caption" sx={{ opacity: isRemoving ? 0.3 : 0.8, mt: 0.5, fontWeight: 600, color: '#ff9800' }}>
              Host
            </Typography>
          )}

          {participant.isCoHost && (
            <Typography variant="caption" sx={{ opacity: isRemoving ? 0.3 : 0.8, mt: 0.5, fontWeight: 600, color: '#ff5722' }}>
              Co-Host
            </Typography>
          )}

          {/* Name at bottom */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              right: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: '#fff',
                backgroundColor: 'rgba(0,0,0,0.6)',
                padding: '2px 8px',
                borderRadius: 1,
                fontSize: '0.75rem',
                fontWeight: 500,
                opacity: 0.9,
              }}
            >
              {participant.displayName || participant.name}
              {participant.isLocal && ' (You)'}
            </Typography>

            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {!displayAudioEnabled && (
                <Box sx={{ backgroundColor: 'rgba(244, 67, 54, 0.9)', borderRadius: '50%', padding: '3px' }}>
                  <MicOff sx={{ fontSize: 14, color: '#fff' }} />
                </Box>
              )}
              {!displayVideoEnabled && (
                <Box sx={{ backgroundColor: 'rgba(244, 67, 54, 0.9)', borderRadius: '50%', padding: '3px' }}>
                  <VideocamOff sx={{ fontSize: 14, color: '#fff' }} />
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      )}

    

      {/* Host controls menu */}
      {isHost && !participant.isLocal && (
        <ParticipantMenuContainer className="participant-controls">
          <IconButton
            size="small"
            onClick={handleMenuOpen}
            sx={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: '#fff',
              '&:hover': { backgroundColor: 'rgba(0,0,0,0.8)' },
            }}
          >
            <MoreVert sx={{ fontSize: 18 }} />
          </IconButton>
        </ParticipantMenuContainer>
      )}
    </ParticipantContainer>
  );
});

ParticipantRenderer.displayName = 'ParticipantRenderer';


// ==========================================================================
// ✅ HELPER — get participant stream for screen share
// ==========================================================================
const getParticipantStreamEnhanced = (participant, localStream, remoteStreams) => {
  if (!participant) return null;

  if (participant.stream instanceof MediaStream) {
    const tracks = participant.stream.getTracks();
    if (tracks.length > 0) return participant.stream;
  }

  if (participant.videoStream instanceof MediaStream) {
    const tracks = participant.videoStream.getTracks();
    if (tracks.length > 0) return participant.videoStream;
  }

  if (participant.isLocal && localStream instanceof MediaStream) {
    const tracks = localStream.getTracks();
    if (tracks.length > 0) return localStream;
  }

  const participantId = participant.user_id || participant.participant_id;
  if (remoteStreams && remoteStreams.size > 0) {
    const possibleKeys = [
      participantId?.toString(),
      `user_${participantId}`,
      participant.identity,
      participant.sid,
      'local',
    ].filter(Boolean);

    for (const key of possibleKeys) {
      if (remoteStreams.has(key)) {
        const stream = remoteStreams.get(key);
        if (stream instanceof MediaStream && stream.getTracks().length > 0) {
          return stream;
        }
      }
    }
  }

  return null;
};


// ==========================================================================
// MAIN VideoGrid COMPONENT
// ==========================================================================
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
  const [currentPage, setCurrentPage] = useState(1);
  const [participantsPerPage, setParticipantsPerPage] = useState(PERFORMANCE_CONFIG.COMFORTABLE_MODE_PARTICIPANTS);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [activeSpeakers, setActiveSpeakers] = useState(new Set());
  const [pinnedParticipants, setPinnedParticipants] = useState(new Set());
  const [displayMode, setDisplayMode] = useState('comfortable');
  const [locallyRemovedParticipants, setLocallyRemovedParticipants] = useState(new Set());

  const isCurrentUserHost = isHost;

  // Event handling for participant removal
  useEffect(() => {
    const handleParticipantRemovedEvent = (event) => {
      const { removedUserId } = event.detail;
      setLocallyRemovedParticipants(prev => new Set([...prev, removedUserId]));
      setTimeout(() => {
        setLocallyRemovedParticipants(prev => {
          const newSet = new Set(prev);
          newSet.delete(removedUserId);
          return newSet;
        });
      }, 5000);
    };

    const handleParticipantListChanged = (event) => {
      const { action, userId } = event.detail || {};
      if (action === 'remove' && userId) {
        setLocallyRemovedParticipants(prev => new Set([...prev, userId]));
      } else if (action === 'backend_refresh') {
        setLocallyRemovedParticipants(new Set());
      }
    };

    window.addEventListener('participantRemoved', handleParticipantRemovedEvent);
    window.addEventListener('participantListChanged', handleParticipantListChanged);

    return () => {
      window.removeEventListener('participantRemoved', handleParticipantRemovedEvent);
      window.removeEventListener('participantListChanged', handleParticipantListChanged);
    };
  }, []);

  const handleImmediateParticipantRemoval = useCallback((removedUserId) => {
    setLocallyRemovedParticipants(prev => new Set([...prev, removedUserId]));
    if (onParticipantRemoved) onParticipantRemoved(removedUserId);
  }, [onParticipantRemoved]);

  const filteredParticipants = useMemo(() => {
    const isActiveParticipant = (p) => {
      if (locallyRemovedParticipants.has(p.user_id)) return false;
      
      const isCurrentlyActive = p.Is_Currently_Active === true || 
                                p.is_currently_active === true ||
                                p.isLocal === true;
      
      if (p.Leave_Time && !isCurrentlyActive) return false;
      if ((p.Status === 'offline' || p.Status === 'removed' || p.Status === 'left') && !isCurrentlyActive) return false;
      if (!p.user_id) return false;
      return true;
    };

    if (isCurrentUserHost) {
      return participants.filter(p => {
        if (!isActiveParticipant(p)) return false;
        if (p.isLocal || p.user_id === currentUser?.id) return false;
        return (p.role !== 'host' && !p.isHost);
      });
    } else {
      const localParticipant = participants.find(p => {
        if (!isActiveParticipant(p)) return false;
        return (p.isLocal || p.user_id === currentUser?.id);
      });
      
      const hostsAndCoHosts = participants.filter(p => {
        if (!isActiveParticipant(p)) return false;
        if (p.isLocal || p.user_id === currentUser?.id) return false;
        const isHostUser = (p.role === 'host' || p.isHost === true);
        const isCoHostUser = (p.isCoHost === true);
        const isConnected = p.LiveKit_Connected || p.Has_Stream || p.Status === 'live' || p.Is_Currently_Active;
        return (isHostUser || isCoHostUser) && isConnected;
      });
      
      return [
        ...(localParticipant ? [localParticipant] : []),
        ...hostsAndCoHosts
      ];
    }
  }, [participants, isCurrentUserHost, currentUser?.id, coHosts, locallyRemovedParticipants]);

  const handleParticipantMenu = useCallback((event, participant) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedParticipant(participant);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setAnchorEl(null);
    setSelectedParticipant(null);
  }, []);

  const handlePinParticipant = useCallback((participantId) => {
    setPinnedParticipants(prev => {
      const newSet = new Set(prev);
      if (newSet.has(participantId)) {
        newSet.delete(participantId);
      } else {
        if (newSet.size >= 4) {
          const firstPinned = newSet.values().next().value;
          newSet.delete(firstPinned);
        }
        newSet.add(participantId);
      }
      return newSet;
    });
  }, []);

  // ✅ FIXED: Screen share fills 100% of the tab
  const renderScreenShareView = useCallback(() => {
    const screenShareParticipant = participants.find(p => p.isScreenSharing) || 
                                   (screenSharer ? participants.find(p => p.user_id === screenSharer.user_id) : null);
    
    const activeScreenStream = screenShareStream || 
                              (screenShareParticipant ? getParticipantStreamEnhanced(screenShareParticipant, localStream, remoteStreams) : null);
    
    if (!activeScreenStream && !screenShareStream) return null;

    return (
      <Box sx={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        gap: 0,
        padding: 0,
        backgroundColor: '#000',
        position: 'relative',
      }}>
        <ScreenShareContainer>
          <VideoPlayer
            stream={activeScreenStream}
            participant={screenShareParticipant || { 
              displayName: screenSharer?.name || 'Screen Share', 
              isScreenSharing: true,
              user_id: screenSharer?.user_id || 'screen_share',
              isLocal: screenShareParticipant?.isLocal || screenSharer?.isLocal || false,
              isAudioEnabled: true,
              isVideoEnabled: true
            }}
            isLocal={screenShareParticipant?.isLocal || screenSharer?.isLocal || false}
            isMuted={false}
            isVideoEnabled={true}
            participantName={screenShareParticipant?.displayName || screenSharer?.name || 'Screen Share'}
            participantId={screenShareParticipant?.user_id || screenSharer?.user_id || 'screen_share'}
            quality="good"
            volume={1.0}
            showControls={true}
            compact={false}
            isScreenShare={true}
          />
          
          {/* Screen share label */}
          <Box
            sx={{
              position: 'absolute',
              top: theme.spacing(1),
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(33,150,243,0.9)',
              color: 'white',
              padding: theme.spacing(0.5, 1.5),
              borderRadius: theme.spacing(2),
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing(0.5),
              fontSize: '0.8rem',
              zIndex: 50,
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            }}
          >
            <Monitor sx={{ fontSize: 16 }} />
            <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
              {screenShareParticipant?.displayName || screenSharer?.name || 'Someone'} is sharing
            </Typography>
          </Box>
        </ScreenShareContainer>
      </Box>
    );
  }, [participants, screenShareStream, screenSharer, localStream, remoteStreams, theme]);

  // ✅ FIXED: Screen share fills entire container with zero padding
  if (isScreenSharing || screenShareStream || participants.some(p => p.isScreenSharing)) {
    return (
      <GridContainer sx={{ height: containerHeight, width: containerWidth, padding: 0 }}>
        {renderScreenShareView()}
      </GridContainer>
    );
  }

  return (
    <GridContainer sx={{ height: containerHeight, width: containerWidth, position: 'relative' }}>
      {/* Role-based participants grid */}
      <RoleBasedGrid isHost={isCurrentUserHost} participantCount={filteredParticipants.length}>
        {filteredParticipants.map((participant, index) => {
          const isHostInStudentView = !isCurrentUserHost && (participant.role === 'host' || participant.isHost) && !participant.isLocal;
          const isCoHostInStudentView = !isCurrentUserHost && participant.isCoHost && !participant.isLocal;
          
          let labelType = null;
          if (!isCurrentUserHost) {
            if (isHostInStudentView) labelType = 'host';
            else if (isCoHostInStudentView) labelType = 'cohost';
          }
          
          return (
            <ParticipantRenderer
              key={`${participant.user_id || participant.participant_id || index}`}
              participant={participant}
              localStream={localStream}
              remoteStreams={remoteStreams}
              isMinimized={false}
              onParticipantMenu={handleParticipantMenu}
              isSpeaking={activeSpeakers.has(participant.user_id)}
              isScreenShare={participant.isScreenSharing}
              isPinned={pinnedParticipants.has(participant.user_id)}
              onPinParticipant={handlePinParticipant}
              isHost={isCurrentUserHost}
              currentUserId={currentUser?.id}
              showLabel={!isCurrentUserHost}
              labelType={labelType}
              onRemoveParticipant={onRemoveParticipant}
              onPromoteToHost={onPromoteToHost}
              onRemoveCoHost={onRemoveCoHost}
              onParticipantRemoved={handleImmediateParticipantRemoval}
            />
          );
        })}
      </RoleBasedGrid>

      {/* Empty state */}
      {filteredParticipants.length === 0 && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'grey.400',
            textAlign: 'center'
          }}
        >
          <Avatar sx={{ width: 80, height: 80, mb: 2, backgroundColor: '#333', fontSize: '2rem' }}>
            <Person sx={{ fontSize: 40 }} />
          </Avatar>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
            {isCurrentUserHost ? 'No participants in meeting' : 'Waiting for participants...'}
          </Typography>
          <Typography variant="body2" sx={{ maxWidth: 400, lineHeight: 1.6 }}>
            {isCurrentUserHost 
              ? 'Students and co-hosts will appear here when they join the meeting'
              : 'You will see yourself and the hosts/co-hosts when connected'
            }
          </Typography>
        </Box>
      )}

      {/* Participant menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl) && Boolean(selectedParticipant)}
        onClose={handleCloseMenu}
        PaperProps={{
          sx: {
            backgroundColor: '#2a2a2a',
            color: '#fff',
            minWidth: 180,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {selectedParticipant && (
          <>
            <MenuItem disabled sx={{ opacity: 0.7, pointerEvents: 'none' }}>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {selectedParticipant.displayName || selectedParticipant.name || 'Participant'}
              </Typography>
            </MenuItem>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 0.5 }} />
            
            {onMuteParticipant && (
              <MenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  const userId = selectedParticipant.user_id || selectedParticipant.User_ID || selectedParticipant.id;
                  handleCloseMenu();
                  if (userId) onMuteParticipant(userId);
                }}
                sx={{ '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }, py: 1 }}
              >
                <MicOff sx={{ mr: 1.5, fontSize: 18, color: '#ff9800' }} />
                <Typography variant="body2">Mute Participant</Typography>
              </MenuItem>
            )}
            
            {onPromoteToHost && !selectedParticipant.isCoHost && (
              <MenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  const userId = selectedParticipant.user_id || selectedParticipant.User_ID || selectedParticipant.id;
                  const participantData = { userId, participant: selectedParticipant };
                  handleCloseMenu();
                  if (userId) onPromoteToHost(participantData);
                }}
                sx={{ '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }, py: 1 }}
              >
                <SupervisorAccount sx={{ mr: 1.5, fontSize: 18, color: '#4caf50' }} />
                <Typography variant="body2">Make Co-Host</Typography>
              </MenuItem>
            )}
            
            {onRemoveCoHost && selectedParticipant.isCoHost && (
              <MenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  const userId = selectedParticipant.user_id || selectedParticipant.User_ID || selectedParticipant.id;
                  const userName = selectedParticipant.displayName || selectedParticipant.name;
                  handleCloseMenu();
                  if (userId) onRemoveCoHost(userId, userName);
                }}
                sx={{ '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }, py: 1 }}
              >
                <PersonOff sx={{ mr: 1.5, fontSize: 18, color: '#ff9800' }} />
                <Typography variant="body2">Remove Co-Host</Typography>
              </MenuItem>
            )}
            
            {onRemoveParticipant && (
              <MenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  const userId = selectedParticipant.user_id || selectedParticipant.User_ID || selectedParticipant.id;
                  const participantData = { userId, user_id: userId, participant: selectedParticipant };
                  handleCloseMenu();
                  if (userId) onRemoveParticipant(participantData);
                }}
                sx={{ color: '#f44336', '&:hover': { backgroundColor: 'rgba(244, 67, 54, 0.1)' }, py: 1 }}
              >
                <PersonOff sx={{ mr: 1.5, fontSize: 18 }} />
                <Typography variant="body2">Remove from Meeting</Typography>
              </MenuItem>
            )}
          </>
        )}
      </Menu>
    </GridContainer>
  );
}

export default memo(VideoGrid);