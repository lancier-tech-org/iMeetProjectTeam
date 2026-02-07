// src/components/participants/ParticipantsList.jsx - WHITE THEME + CONTROLS FOR HOST/CO-HOST ONLY
import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  Tooltip,
  Collapse,
  Slide,
} from '@mui/material';
import {
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  Search,
  People,
  Person,
  AdminPanelSettings,
  SupervisedUserCircle,
  KeyboardArrowDown,
  ScreenShare,
  Close,
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import ParticipantControls from './ParticipantControls';

/* ═══════════════════════════════════════════════════════════════════════════
   ANIMATIONS
   ═══════════════════════════════════════════════════════════════════════════ */

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const livePulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
  50%      { box-shadow: 0 0 0 4px rgba(16, 185, 129, 0); }
`;

/* ═══════════════════════════════════════════════════════════════════════════
   STYLED COMPONENTS — White · Clean · Responsive
   ═══════════════════════════════════════════════════════════════════════════ */

const Panel = styled(Box)(() => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: '#ffffff',
  color: '#1e293b',
  overflow: 'hidden',
  fontFamily: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif",

  '& ::-webkit-scrollbar':      { width: 4 },
  '& ::-webkit-scrollbar-track': { background: 'transparent' },
  '& ::-webkit-scrollbar-thumb': {
    background: 'rgba(0,0,0,0.08)',
    borderRadius: 4,
    '&:hover': { background: 'rgba(0,0,0,0.15)' },
  },
}));

const Header = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 16px 10px',
  borderBottom: '1px solid #f1f5f9',
  flexShrink: 0,
}));

const SearchWrap = styled(Box)(() => ({
  padding: '6px 12px 10px',
  flexShrink: 0,
}));

const SearchBar = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderRadius: 8,
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
  '&:focus-within': {
    background: '#ffffff',
    borderColor: '#93c5fd',
    boxShadow: '0 0 0 3px rgba(59,130,246,0.08)',
  },
}));

const SearchInput = styled('input')(() => ({
  border: 'none',
  outline: 'none',
  background: 'transparent',
  color: '#1e293b',
  fontSize: 13,
  fontWeight: 500,
  width: '100%',
  fontFamily: 'inherit',
  '&::placeholder': { color: '#94a3b8' },
}));

const SectionRow = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 16px 6px',
  cursor: 'pointer',
  userSelect: 'none',
  '&:hover': { background: '#f8fafc' },
}));

const SectionTitle = styled(Typography)(() => ({
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#94a3b8',
}));

const Card = styled(Box, {
  shouldForwardProp: (p) => !['isMe', 'role', 'removing'].includes(p),
})(({ isMe, role, removing }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  margin: '2px 10px',
  borderRadius: 10,
  animation: `${fadeIn} 0.2s ease-out`,
  transition: 'background 0.15s, opacity 0.25s',
  opacity: removing ? 0.3 : 1,
  filter: removing ? 'grayscale(1)' : 'none',

  background:
    isMe            ? 'rgba(59,130,246,0.04)' :
    role === 'host' ? 'rgba(245,158,11,0.04)' :
    'transparent',

  borderLeft: isMe
    ? '3px solid rgba(59,130,246,0.45)'
    : role === 'host'
      ? '3px solid rgba(245,158,11,0.35)'
      : role === 'co-host'
        ? '3px solid rgba(234,88,12,0.3)'
        : '3px solid transparent',

  '&:hover': {
    background:
      isMe            ? 'rgba(59,130,246,0.06)' :
      role === 'host' ? 'rgba(245,158,11,0.06)' :
      '#f8fafc',
  },

  '@media (max-width: 380px)': {
    gap: 8,
    padding: '8px 8px',
    margin: '2px 6px',
  },
}));

const UserAvatar = styled(Avatar, {
  shouldForwardProp: (p) => p !== 'role',
})(({ role }) => ({
  width: 36,
  height: 36,
  fontSize: 14,
  fontWeight: 700,
  flexShrink: 0,
  background:
    role === 'host'    ? '#f59e0b' :
    role === 'co-host' ? '#ea580c' :
    '#3b82f6',
  color: '#fff',
  border: '2px solid #f1f5f9',

  '@media (max-width: 380px)': {
    width: 32,
    height: 32,
    fontSize: 13,
  },
}));

const StatusDot = styled(Box, {
  shouldForwardProp: (p) => p !== 'status',
})(({ status }) => ({
  width: 9,
  height: 9,
  borderRadius: '50%',
  position: 'absolute',
  bottom: -1,
  right: -1,
  border: '2px solid #ffffff',
  background:
    status === 'live'       ? '#10b981' :
    status === 'connecting' ? '#f59e0b' :
    status === 'online'     ? '#3b82f6' :
    '#cbd5e1',
  animation: status === 'live' ? `${livePulse} 2s ease-in-out infinite` : 'none',
}));

const RoleBadge = styled(Box, {
  shouldForwardProp: (p) => p !== 'role',
})(({ role }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 6px',
  borderRadius: 4,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  lineHeight: 1,
  flexShrink: 0,

  ...(role === 'host' && {
    background: '#fef3c7',
    color: '#b45309',
  }),
  ...(role === 'co-host' && {
    background: '#ffedd5',
    color: '#c2410c',
  }),
  ...(role === 'participant' && {
    background: '#eff6ff',
    color: '#2563eb',
  }),
}));

const MediaIcon = styled(Box, {
  shouldForwardProp: (p) => p !== 'active',
})(({ active }) => ({
  width: 26,
  height: 26,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
  flexShrink: 0,
  background: active ? 'rgba(16,185,129,0.08)' : '#f8fafc',
  color: active ? '#059669' : '#94a3b8',
  transition: 'all 0.15s',
  '& .MuiSvgIcon-root': { fontSize: 14 },

  '@media (max-width: 340px)': {
    width: 24,
    height: 24,
    '& .MuiSvgIcon-root': { fontSize: 13 },
  },
}));

const Empty = styled(Box)(() => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '52px 24px',
  gap: 6,
  textAlign: 'center',
}));


/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

const ParticipantsList = ({
  participants = [],
  currentUserId,
  isHost = false,
  isCoHost = false,
  hasHostPrivileges = false,
  coHosts = [],
  onMuteParticipant,
  onUnmuteParticipant,
  onMuteVideo,
  onUnmuteVideo,
  onRemoveParticipant,
  onPromoteToCoHost,
  onRemoveCoHost,
  onDemoteParticipant,
  onSetVolume,
  onSpotlight,
  onPin,
  onBlock,
  onParticipantsUpdated,
  onPanelClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    live: true,
    host: true,
    coHosts: true,
    participants: true,
    offline: false,
  });
  const [removedParticipants, setRemovedParticipants] = useState(new Set());
  const [nameResolutionCache, setNameResolutionCache] = useState(new Map());

  const safeParticipants = Array.isArray(participants) ? participants : [];

  // ══════════════════════════════════════════════════════════════════════════
  // BACKEND LOGIC — 100% UNCHANGED
  // ══════════════════════════════════════════════════════════════════════════

  const getParticipantDisplayName = useCallback((participant) => {
    if (!participant) return 'Unknown User';

    const participantId = participant.id || participant.user_id || participant.User_ID || participant.ID;

    if (nameResolutionCache.has(participantId)) {
      const cachedName = nameResolutionCache.get(participantId);
      if (cachedName && cachedName !== 'Unknown User') return cachedName;
    }

    const nameFields = [
      participant.full_name, participant.Full_Name, participant.name,
      participant.displayName, participant.user_name, participant.username,
      participant.participant_name, participant.userName, participant.display_name,
      participant.fullName,
    ];

    for (const nameField of nameFields) {
      if (
        nameField &&
        typeof nameField === 'string' &&
        nameField.trim() !== '' &&
        nameField !== 'Unknown' &&
        nameField !== 'Anonymous' &&
        nameField !== 'undefined' &&
        nameField !== 'null' &&
        !nameField.startsWith('User_') &&
        !nameField.startsWith('User ') &&
        !nameField.match(/^User\s*\d+$/) &&
        !nameField.match(/^participant_\d+$/)
      ) {
        const cleanName = nameField.trim();
        setNameResolutionCache((prev) => new Map(prev.set(participantId, cleanName)));
        return cleanName;
      }
    }

    return `User ${participantId || 'Unknown'}`;
  }, [nameResolutionCache]);

  const getParticipantRole = (participant) => {
    if (!participant) return 'participant';
    if (participant.role === 'host' || participant.Role === 'host' || participant.isHost === true) return 'host';

    const participantId = participant.user_id || participant.User_ID || participant.id;
    const isParticipantCoHost = coHosts.some((ch) => {
      const cid = ch.user_id || ch.User_ID;
      return cid?.toString() === participantId?.toString();
    });

    if (
      participant.role === 'co-host' || participant.Role === 'co-host' ||
      participant.isCoHost === true || isParticipantCoHost
    ) return 'co-host';

    return 'participant';
  };

  const getParticipantStatus = (participant) => {
    if (!participant) return 'offline';
    if (participant.Status) return participant.Status;
    if (participant.LiveKit_Connected === true) return 'live';
    if (!participant.Leave_Time && participant.Join_Time) return 'connecting';
    return 'offline';
  };

  const filteredParticipants = useMemo(() => {
    return safeParticipants.filter((participant) => {
      if (!participant) return false;

      const participantId = participant.user_id || participant.User_ID || participant.id;
      if (removedParticipants.has(participantId)) return false;

      const isCurrentlyActive =
        participant.Is_Currently_Active === true ||
        participant.is_currently_active === true ||
        participant.isLocal === true;

      if (participant.Leave_Time && !isCurrentlyActive) return false;

      const status = getParticipantStatus(participant);
      if ((status === 'removed' || status === 'disconnected' || status === 'left') && !isCurrentlyActive) return false;
      if (status === 'offline' && !isCurrentlyActive) return false;

      if (searchTerm && searchTerm.trim() !== '') {
        const name = getParticipantDisplayName(participant);
        const email = participant.email || participant.Email || '';
        const lo = searchTerm.toLowerCase();
        if (!name.toLowerCase().includes(lo) && !email.toLowerCase().includes(lo)) return false;
      }

      return true;
    });
  }, [safeParticipants, searchTerm, removedParticipants, getParticipantDisplayName]);

  const groupedParticipants = {
    host: filteredParticipants.filter((p) => getParticipantRole(p) === 'host'),
    coHosts: filteredParticipants.filter((p) => getParticipantRole(p) === 'co-host'),
    participants: filteredParticipants.filter((p) => getParticipantRole(p) === 'participant' && getParticipantStatus(p) !== 'offline'),
    offline: filteredParticipants.filter((p) => getParticipantStatus(p) === 'offline'),
  };

  const toggleSection = (key) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  const renderParticipant = (participant) => {
    if (!participant) return null;

    const pid       = participant.user_id || participant.User_ID || participant.id;
    const isMe      = pid && (pid == currentUserId || participant.isLocal === true);
    const role      = getParticipantRole(participant);
    const status    = getParticipantStatus(participant);
    const removing  = removedParticipants.has(pid);
    const name      = getParticipantDisplayName(participant);
    const audioOn   = participant.audio_enabled || participant.isAudioEnabled;
    const videoOn   = participant.video_enabled || participant.isVideoEnabled;
    const uniqueKey = participant.key || participant.participant_id || pid || participant.connection_id || `p-${Math.random()}`;

    // ✅ Show controls ONLY if current user is host or co-host, and target is not themselves
    const showControls = (isHost || isCoHost) && !isMe && !removing;

    return (
      <Slide direction="up" in={!removing} key={uniqueKey} timeout={200} mountOnEnter unmountOnExit>
        <Card isMe={isMe} role={role} removing={removing}>

          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <UserAvatar role={role} src={participant.profile_picture || participant.avatar}>
              {name.charAt(0).toUpperCase()}
            </UserAvatar>
            <StatusDot status={status} />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexWrap: 'wrap' }}>
              <Typography
                noWrap
                sx={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#1e293b',
                  lineHeight: 1.3,
                  maxWidth: { xs: 90, sm: 130, md: 170, lg: 200 },
                }}
              >
                {name}
              </Typography>

              {isMe && (
                <Typography
                  component="span"
                  sx={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#2563eb',
                    background: '#eff6ff',
                    padding: '1px 5px',
                    borderRadius: 3,
                    lineHeight: 1.5,
                    flexShrink: 0,
                  }}
                >
                  YOU
                </Typography>
              )}

              <RoleBadge role={role}>
                {role === 'co-host' ? 'Co-Host' : role.charAt(0).toUpperCase() + role.slice(1)}
              </RoleBadge>
            </Box>

            {(participant.email || participant.Email) && (
              <Typography
                noWrap
                sx={{
                  fontSize: 11,
                  color: '#94a3b8',
                  lineHeight: 1.3,
                  maxWidth: { xs: 110, sm: 150, md: 190, lg: 220 },
                }}
              >
                {participant.email || participant.Email}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <Tooltip title={audioOn ? 'Mic on' : 'Mic off'} arrow placement="top">
              <MediaIcon active={audioOn}>
                {audioOn ? <Mic /> : <MicOff />}
              </MediaIcon>
            </Tooltip>

            <Tooltip title={videoOn ? 'Camera on' : 'Camera off'} arrow placement="top">
              <MediaIcon active={videoOn}>
                {videoOn ? <Videocam /> : <VideocamOff />}
              </MediaIcon>
            </Tooltip>

            {participant.isScreenSharing && (
              <Tooltip title="Sharing screen" arrow placement="top">
                <MediaIcon active>
                  <ScreenShare />
                </MediaIcon>
              </Tooltip>
            )}

            {/* ✅ Controls visible ONLY for host / co-host */}
            {showControls && (
              <ParticipantControls
                participant={participant}
                currentUserRole={isHost ? 'host' : isCoHost ? 'co-host' : 'participant'}
                isCurrentUser={isMe}
                onMuteParticipant={onMuteParticipant}
                onUnmuteParticipant={onUnmuteParticipant}
                onMuteVideo={onMuteVideo}
                onUnmuteVideo={onUnmuteVideo}
                onRemoveParticipant={onRemoveParticipant}
                onPromoteToCoHost={onPromoteToCoHost}
                onDemoteFromCoHost={onRemoveCoHost}
                onSetVolume={onSetVolume}
                onSpotlight={onSpotlight}
                onPin={onPin}
                onBlock={onBlock}
              />
            )}
          </Box>
        </Card>
      </Slide>
    );
  };

  const renderSection = (title, list, key, icon) => {
    const safe = Array.isArray(list) ? list : [];
    if (safe.length === 0) return null;

    return (
      <Box key={key}>
        <SectionRow onClick={() => toggleSection(key)}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {icon}
            <SectionTitle>
              {title}
              <Typography
                component="span"
                sx={{ ml: 0.5, fontSize: 11, fontWeight: 600, color: '#cbd5e1' }}
              >
                {safe.length}
              </Typography>
            </SectionTitle>
          </Box>
          <KeyboardArrowDown
            sx={{
              fontSize: 16,
              color: '#cbd5e1',
              transition: 'transform 0.2s',
              transform: expandedSections[key] ? 'rotate(180deg)' : 'rotate(0)',
            }}
          />
        </SectionRow>

        <Collapse in={expandedSections[key]} timeout={200}>
          <Box sx={{ pb: 0.5 }}>{safe.map(renderParticipant)}</Box>
        </Collapse>
      </Box>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <Panel>
      <Header>
        <Box>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#0f172a', lineHeight: 1.25 }}>
            Participants
          </Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', lineHeight: 1.3, mt: '2px' }}>
            {filteredParticipants.length} active
          </Typography>
        </Box>

        {onPanelClose && (
          <IconButton
            onClick={onPanelClose}
            size="small"
            sx={{
              color: '#94a3b8',
              '&:hover': { color: '#1e293b', background: '#f1f5f9' },
            }}
          >
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        )}
      </Header>

      <SearchWrap>
        <SearchBar>
          <Search sx={{ fontSize: 16, color: '#94a3b8', flexShrink: 0 }} />
          <SearchInput
            placeholder="Search…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value || '')}
          />
          {searchTerm && (
            <IconButton
              size="small"
              onClick={() => setSearchTerm('')}
              sx={{ p: '2px', color: '#94a3b8', '&:hover': { color: '#1e293b' } }}
            >
              <Close sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </SearchBar>
      </SearchWrap>

      <Box sx={{ flex: 1, overflowY: 'auto', pt: 0.5, pb: 2 }}>
        {renderSection(
          'Host',
          groupedParticipants.host,
          'host',
          <AdminPanelSettings sx={{ fontSize: 14, color: '#f59e0b' }} />,
        )}
        {renderSection(
          'Co-Hosts',
          groupedParticipants.coHosts,
          'coHosts',
          <SupervisedUserCircle sx={{ fontSize: 14, color: '#ea580c' }} />,
        )}
        {renderSection(
          'Participants',
          groupedParticipants.participants,
          'participants',
          <Person sx={{ fontSize: 14, color: '#3b82f6' }} />,
        )}
        {renderSection(
          'Offline',
          groupedParticipants.offline,
          'offline',
          <Person sx={{ fontSize: 14, color: '#cbd5e1' }} />,
        )}

        {filteredParticipants.length === 0 && (
          <Empty>
            <People sx={{ fontSize: 36, color: '#e2e8f0' }} />
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>
              {searchTerm ? 'No matches found' : 'No participants yet'}
            </Typography>
            {!searchTerm && (
              <Typography sx={{ fontSize: 11, color: '#cbd5e1' }}>
                They'll appear here when they join
              </Typography>
            )}
          </Empty>
        )}
      </Box>
    </Panel>
  );
};

export default ParticipantsList;