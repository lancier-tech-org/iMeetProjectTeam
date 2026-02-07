// src/components/participants/ParticipantControls.jsx - REDESIGNED WHITE THEME
import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Slider,
} from '@mui/material';
import {
  MoreVert,
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  SupervisedUserCircle,
  ExitToApp,
  VolumeUp,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

/* ═══════════════════════════════════════════════════════════════════════════
   STYLED COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const TriggerBtn = styled(IconButton)(() => ({
  width: 26,
  height: 26,
  borderRadius: 6,
  color: '#94a3b8',
  background: 'transparent',
  transition: 'all 0.15s ease',
  '& .MuiSvgIcon-root': { fontSize: 16 },

  '&:hover': {
    background: '#f1f5f9',
    color: '#3b82f6',
  },
}));

const StyledMenu = styled(Menu)(() => ({
  '& .MuiPaper-root': {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    boxShadow: '0 8px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
    minWidth: 210,
    maxWidth: 260,
    padding: '4px 0',
    marginTop: 4,
    overflow: 'visible',
  },
}));

const StyledMenuItem = styled(MenuItem)(() => ({
  padding: '8px 14px',
  margin: '1px 6px',
  borderRadius: 7,
  minHeight: 'auto',
  gap: 10,
  transition: 'background 0.12s ease',
  fontSize: 13,
  fontWeight: 500,
  color: '#334155',
  fontFamily: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif",

  '&:hover': {
    background: '#f8fafc',
  },

  '& .MuiListItemIcon-root': {
    minWidth: 'auto',
  },

  '& .MuiListItemText-root': {
    margin: 0,
  },

  '& .MuiListItemText-primary': {
    fontSize: 13,
    fontWeight: 500,
    color: 'inherit',
    lineHeight: 1.4,
  },

  '@media (max-width: 380px)': {
    padding: '7px 10px',
    fontSize: 12,
    '& .MuiListItemText-primary': { fontSize: 12 },
  },
}));

const DangerMenuItem = styled(StyledMenuItem)(() => ({
  color: '#dc2626',
  '&:hover': {
    background: '#fef2f2',
  },
}));

const MenuSection = styled(Typography)(() => ({
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#94a3b8',
  padding: '8px 20px 4px',
  lineHeight: 1,
}));

const MenuDivider = styled(Divider)(() => ({
  margin: '4px 14px',
  borderColor: '#f1f5f9',
}));

const IconWrap = styled(Box, {
  shouldForwardProp: (p) => p !== 'variant',
})(({ variant }) => ({
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
  flexShrink: 0,

  ...(variant === 'danger' && {
    background: '#fef2f2',
    color: '#dc2626',
  }),
  ...(variant === 'success' && {
    background: '#f0fdf4',
    color: '#16a34a',
  }),
  ...(variant === 'warning' && {
    background: '#fffbeb',
    color: '#d97706',
  }),
  ...(variant === 'info' && {
    background: '#eff6ff',
    color: '#2563eb',
  }),
  ...(variant === 'muted' && {
    background: '#f8fafc',
    color: '#64748b',
  }),

  '& .MuiSvgIcon-root': { fontSize: 15 },

  '@media (max-width: 380px)': {
    width: 26,
    height: 26,
    '& .MuiSvgIcon-root': { fontSize: 14 },
  },
}));

/* ── Confirm Dialog ───────────────────────────────────────────────────────── */
const StyledDialog = styled(Dialog)(() => ({
  '& .MuiDialog-paper': {
    borderRadius: 14,
    border: '1px solid #e2e8f0',
    boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
    maxWidth: 380,
    width: '90vw',
    padding: 0,
    overflow: 'hidden',
  },
}));

const DialogHead = styled(DialogTitle)(() => ({
  padding: '18px 20px 6px',
  fontSize: 15,
  fontWeight: 700,
  color: '#0f172a',
  lineHeight: 1.3,
  fontFamily: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif",
}));

const DialogBody = styled(DialogContent)(() => ({
  padding: '6px 20px 14px',
}));

const DialogFoot = styled(DialogActions)(() => ({
  padding: '10px 16px 14px',
  gap: 8,
}));

const CancelBtn = styled(Button)(() => ({
  textTransform: 'none',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 8,
  padding: '6px 16px',
  color: '#64748b',
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  fontFamily: 'inherit',

  '&:hover': {
    background: '#f8fafc',
    borderColor: '#cbd5e1',
  },
}));

const ConfirmBtn = styled(Button, {
  shouldForwardProp: (p) => p !== 'danger',
})(({ danger }) => ({
  textTransform: 'none',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 8,
  padding: '6px 18px',
  fontFamily: 'inherit',
  boxShadow: 'none',
  color: '#ffffff',
  background: danger ? '#dc2626' : '#3b82f6',

  '&:hover': {
    background: danger ? '#b91c1c' : '#2563eb',
    boxShadow: 'none',
  },
}));

/* ── Volume Dialog ────────────────────────────────────────────────────────── */
const VolumeSlider = styled(Slider)(() => ({
  color: '#3b82f6',
  height: 4,
  padding: '12px 0',

  '& .MuiSlider-thumb': {
    width: 16,
    height: 16,
    background: '#3b82f6',
    border: '2px solid #ffffff',
    boxShadow: '0 1px 4px rgba(59,130,246,0.3)',
    '&:hover, &.Mui-focusVisible': {
      boxShadow: '0 0 0 6px rgba(59,130,246,0.1)',
    },
  },
  '& .MuiSlider-track': {
    borderRadius: 2,
  },
  '& .MuiSlider-rail': {
    background: '#e2e8f0',
    opacity: 1,
  },
}));


/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

const ParticipantControls = ({
  participant,
  currentUserRole = 'participant',
  isCurrentUser = false,
  onMuteParticipant,
  onUnmuteParticipant,
  onMuteVideo,
  onUnmuteVideo,
  onRemoveParticipant,
  onPromoteToCoHost,
  onDemoteFromCoHost,
  onSetVolume,
  onSpotlight,
  onPin,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    action: null,
    title: '',
    content: '',
  });
  const [volumeDialog, setVolumeDialog] = useState(false);
  const [volume, setVolume] = useState(participant.volume || 100);

  // ── Role checks — UNCHANGED ────────────────────────────────────────────
  const isHost = currentUserRole === 'host';
  const isCoHost = currentUserRole === 'co-host';
  const hasHostPrivileges = isHost || isCoHost;
  const participantIsHost = participant.role === 'host';
  const participantIsCoHost = participant.role === 'co-host';

  // ── Handlers — UNCHANGED ───────────────────────────────────────────────
  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleConfirmAction = (action, title, content) => {
    setConfirmDialog({ open: true, action, title, content });
    handleMenuClose();
  };

  const closeConfirm = () => setConfirmDialog({ open: false, action: null, title: '', content: '' });

  const executeAction = async () => {
    const { action } = confirmDialog;
    try {
      const participantId = participant.id || participant.user_id || participant.User_ID;

      switch (action) {
        case 'mute_audio':
          if (onMuteParticipant) await onMuteParticipant(participantId);
          break;
        case 'unmute_audio':
          if (onUnmuteParticipant) await onUnmuteParticipant(participantId);
          break;
        case 'mute_video':
          if (onMuteVideo) await onMuteVideo(participantId);
          break;
        case 'unmute_video':
          if (onUnmuteVideo) await onUnmuteVideo(participantId);
          break;
        case 'spotlight':
          if (onSpotlight) await onSpotlight(participantId, !participant.spotlighted);
          break;
        case 'pin':
          if (onPin) await onPin(participantId, !participant.pinned);
          break;
        case 'promote':
          if (onPromoteToCoHost) await onPromoteToCoHost({ userId: participantId, participant });
          break;
        case 'demote':
          if (onDemoteFromCoHost) await onDemoteFromCoHost(participantId, participant.full_name || participant.name || `User ${participantId}`);
          break;
        case 'remove':
          if (onRemoveParticipant) await onRemoveParticipant({ userId: participantId, participant });
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('❌ Action execution failed:', error);
    }
    closeConfirm();
  };

  const handleVolumeChange = (event, newValue) => setVolume(newValue);

  const handleVolumeApply = async () => {
    try {
      const participantId = participant.id || participant.user_id || participant.User_ID;
      if (onSetVolume) await onSetVolume(participantId, volume);
      setVolumeDialog(false);
    } catch (error) {
      console.error('❌ Volume adjustment failed:', error);
    }
  };

  const handleDirectAction = async (action) => {
    handleMenuClose();
    const participantId = participant.id || participant.user_id || participant.User_ID;
    try {
      switch (action) {
        case 'spotlight':
          if (onSpotlight) await onSpotlight(participantId, !participant.spotlighted);
          break;
        case 'pin':
          if (onPin) await onPin(participantId, !participant.pinned);
          break;
        case 'volume':
          setVolumeDialog(true);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('❌ Direct action failed:', error);
    }
  };

  // Don't render for current user OR if viewer is a regular participant
  if (isCurrentUser || !hasHostPrivileges) return null;

  const getParticipantName = () => {
    return participant.full_name ||
      participant.Full_Name ||
      participant.name ||
      participant.displayName ||
      `User ${participant.id || participant.user_id}`;
  };

  const audioOn = participant.audio_enabled || participant.isAudioEnabled;
  const videoOn = participant.video_enabled || participant.isVideoEnabled;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <>
      {/* ── Trigger ── */}
      <Tooltip title="Manage" arrow placement="top">
        <TriggerBtn size="small" onClick={handleMenuOpen}>
          <MoreVert />
        </TriggerBtn>
      </Tooltip>

      {/* ── Menu ── */}
      <StyledMenu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {/* Audio / Video — Host & Co-Host */}
        {hasHostPrivileges && !isCurrentUser && (
          <Box>
            <MenuSection>Media</MenuSection>

            <StyledMenuItem
              onClick={() =>
                handleConfirmAction(
                  audioOn ? 'mute_audio' : 'unmute_audio',
                  audioOn ? 'Mute Microphone' : 'Allow Unmute',
                  audioOn
                    ? `Mute ${getParticipantName()}'s microphone?`
                    : `Allow ${getParticipantName()} to unmute their microphone?`,
                )
              }
            >
              <ListItemIcon>
                <IconWrap variant={audioOn ? 'danger' : 'success'}>
                  {audioOn ? <MicOff /> : <Mic />}
                </IconWrap>
              </ListItemIcon>
              <ListItemText>{audioOn ? 'Mute Mic' : 'Allow Unmute'}</ListItemText>
            </StyledMenuItem>

            <StyledMenuItem
              onClick={() =>
                handleConfirmAction(
                  videoOn ? 'mute_video' : 'unmute_video',
                  videoOn ? 'Turn Off Camera' : 'Allow Camera',
                  videoOn
                    ? `Turn off ${getParticipantName()}'s camera?`
                    : `Allow ${getParticipantName()} to turn on their camera?`,
                )
              }
            >
              <ListItemIcon>
                <IconWrap variant={videoOn ? 'danger' : 'success'}>
                  {videoOn ? <VideocamOff /> : <Videocam />}
                </IconWrap>
              </ListItemIcon>
              <ListItemText>{videoOn ? 'Turn Off Camera' : 'Allow Camera'}</ListItemText>
            </StyledMenuItem>
          </Box>
        )}

        {/* Role Management — Host only */}
        {isHost && !isCurrentUser && !participantIsHost && (
          <Box>
            <MenuDivider />
            <MenuSection>Role</MenuSection>

            <StyledMenuItem
              onClick={() =>
                handleConfirmAction(
                  participantIsCoHost ? 'demote' : 'promote',
                  participantIsCoHost ? 'Remove Co-Host' : 'Make Co-Host',
                  participantIsCoHost
                    ? `Remove co-host privileges from ${getParticipantName()}?`
                    : `Give co-host privileges to ${getParticipantName()}?`,
                )
              }
            >
              <ListItemIcon>
                <IconWrap variant="warning">
                  <SupervisedUserCircle />
                </IconWrap>
              </ListItemIcon>
              <ListItemText>{participantIsCoHost ? 'Remove Co-Host' : 'Make Co-Host'}</ListItemText>
            </StyledMenuItem>
          </Box>
        )}

        {/* Remove — Host & Co-Host, not for host participant */}
        {hasHostPrivileges && !isCurrentUser && !participantIsHost && (
          <Box>
            <MenuDivider />

            <DangerMenuItem
              onClick={() =>
                handleConfirmAction(
                  'remove',
                  'Remove Participant',
                  `Remove ${getParticipantName()} from the meeting? They will be disconnected immediately and cannot rejoin.`,
                )
              }
            >
              <ListItemIcon>
                <IconWrap variant="danger">
                  <ExitToApp />
                </IconWrap>
              </ListItemIcon>
              <ListItemText>Remove from Meeting</ListItemText>
            </DangerMenuItem>
          </Box>
        )}
      </StyledMenu>

      {/* ── Confirm Dialog ── */}
      <StyledDialog open={confirmDialog.open} onClose={closeConfirm}>
        <DialogHead>{confirmDialog.title}</DialogHead>
        <DialogBody>
          <Typography sx={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
            {confirmDialog.content}
          </Typography>
        </DialogBody>
        <DialogFoot>
          <CancelBtn variant="outlined" onClick={closeConfirm}>
            Cancel
          </CancelBtn>
          <ConfirmBtn
            variant="contained"
            danger={confirmDialog.action === 'remove'}
            onClick={executeAction}
          >
            Confirm
          </ConfirmBtn>
        </DialogFoot>
      </StyledDialog>

      {/* ── Volume Dialog ── */}
      <StyledDialog open={volumeDialog} onClose={() => setVolumeDialog(false)}>
        <DialogHead>Adjust Volume</DialogHead>
        <DialogBody>
          <Typography sx={{ fontSize: 13, color: '#64748b', mb: 2 }}>
            Set playback volume for {getParticipantName()}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1 }}>
            <VolumeUp sx={{ fontSize: 18, color: '#94a3b8' }} />
            <VolumeSlider
              value={volume}
              onChange={handleVolumeChange}
              min={0}
              max={200}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${v}%`}
            />
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#3b82f6', minWidth: 36, textAlign: 'right' }}>
              {volume}%
            </Typography>
          </Box>
        </DialogBody>
        <DialogFoot>
          <CancelBtn variant="outlined" onClick={() => setVolumeDialog(false)}>
            Cancel
          </CancelBtn>
          <ConfirmBtn variant="contained" onClick={handleVolumeApply}>
            Apply
          </ConfirmBtn>
        </DialogFoot>
      </StyledDialog>
    </>
  );
};

export default ParticipantControls;