// src/components/panels/HandRaisePanelWrapper.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
  Avatar,
  Button,
  Slide,
  Fade,
} from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import { PanTool, Close, KeyboardArrowDown } from '@mui/icons-material';

// ==================== ANIMATIONS ====================
const handWave = keyframes`
  0%, 100% { transform: rotate(0deg); }
  15% { transform: rotate(14deg); }
  30% { transform: rotate(-8deg); }
  45% { transform: rotate(10deg); }
  60% { transform: rotate(-4deg); }
  75% { transform: rotate(6deg); }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulseRing = keyframes`
  0% { transform: scale(0.95); opacity: 0.7; }
  50% { transform: scale(1.05); opacity: 0.3; }
  100% { transform: scale(0.95); opacity: 0.7; }
`;

const dotPulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
`;

// ==================== STYLED COMPONENTS ====================

const PanelBackdrop = styled(Box)(() => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.45)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  zIndex: 1400,
  transition: 'opacity 0.25s ease',
}));

const PanelContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  zIndex: 1500,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',

  // Mobile-first: full-width bottom sheet
  bottom: 0,
  left: 0,
  right: 0,
  maxHeight: '75vh',
  borderRadius: '20px 20px 0 0',
  background: 'linear-gradient(180deg, #1e2533 0%, #171d2b 100%)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderBottom: 'none',
  boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.5)',

  // Tablet (≥600px): floating panel, right side
  [theme.breakpoints.up('sm')]: {
    bottom: 'auto',
    left: 'auto',
    top: 80,
    right: 20,
    maxHeight: '70vh',
    width: 380,
    maxWidth: 'calc(100vw - 40px)',
    borderRadius: 16,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.04)',
  },

  // Desktop (≥960px): slightly wider
  [theme.breakpoints.up('md')]: {
    width: 400,
    right: 24,
  },

  // Large desktop (≥1280px)
  [theme.breakpoints.up('lg')]: {
    width: 420,
  },
}));

const PanelHeader = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px 14px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  flexShrink: 0,
}));

const HandCount = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 26,
  height: 26,
  borderRadius: 13,
  background: 'linear-gradient(135deg, #f59e0b 0%, #ef8c00 100%)',
  color: '#fff',
  fontSize: '0.78rem',
  fontWeight: 700,
  padding: '0 8px',
  letterSpacing: '0.02em',
  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)',
}));

const CloseBtn = styled(IconButton)(() => ({
  width: 34,
  height: 34,
  color: 'rgba(255, 255, 255, 0.5)',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(8px)',
  transition: 'all 0.2s ease',
  '&:hover': {
    color: '#fff',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    transform: 'scale(1.05)',
  },
}));

const ScrollArea = styled(Box)(() => ({
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '8px 12px',
  '&::-webkit-scrollbar': {
    width: 4,
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 4,
  },
  '&::-webkit-scrollbar-thumb:hover': {
    background: 'rgba(255, 255, 255, 0.2)',
  },
}));

const HandCard = styled(Box)(({ index = 0 }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  marginBottom: 6,
  borderRadius: 12,
  backgroundColor: 'rgba(255, 255, 255, 0.035)',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  transition: 'all 0.2s ease',
  animation: `${slideUp} 0.35s ease-out both`,
  animationDelay: `${Math.min(index * 60, 300)}ms`,
  cursor: 'default',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.09)',
  },
  '&:last-child': {
    marginBottom: 0,
  },
}));

const UserAvatar = styled(Avatar)(() => ({
  width: 38,
  height: 38,
  fontSize: '0.85rem',
  fontWeight: 600,
  flexShrink: 0,
  background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)',
  letterSpacing: '0.02em',
}));

const LowerHandBtn = styled(Button)(() => ({
  minWidth: 0,
  padding: '5px 14px',
  borderRadius: 20,
  fontSize: '0.72rem',
  fontWeight: 600,
  textTransform: 'none',
  letterSpacing: '0.01em',
  color: 'rgba(255, 255, 255, 0.7)',
  backgroundColor: 'rgba(255, 255, 255, 0.07)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  transition: 'all 0.2s ease',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.13)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: '#fff',
  },
}));

const ClearAllBtn = styled(Button)(() => ({
  minWidth: 0,
  padding: '4px 12px',
  borderRadius: 16,
  fontSize: '0.7rem',
  fontWeight: 600,
  textTransform: 'none',
  color: 'rgba(239, 68, 68, 0.8)',
  backgroundColor: 'transparent',
  border: '1px solid rgba(239, 68, 68, 0.15)',
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#ef4444',
  },
}));

const EmptyStateContainer = styled(Box)(() => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 32px',
  textAlign: 'center',
  userSelect: 'none',
}));

const EmptyHandIcon = styled(Box)(() => ({
  position: 'relative',
  width: 72,
  height: 72,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 20,
  '&::before': {
    content: '""',
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: 'rgba(245, 158, 11, 0.06)',
    animation: `${pulseRing} 3s ease-in-out infinite`,
  },
}));

const DragHandle = styled(Box)(() => ({
  width: 36,
  height: 4,
  borderRadius: 2,
  backgroundColor: 'rgba(255, 255, 255, 0.15)',
  margin: '8px auto 0',
  flexShrink: 0,
}));

const FooterBar = styled(Box)(() => ({
  padding: '10px 20px',
  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
  backgroundColor: 'rgba(0, 0, 0, 0.15)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0,
}));

const TimeBadge = styled(Typography)(() => ({
  fontSize: '0.68rem',
  fontWeight: 500,
  color: 'rgba(255, 255, 255, 0.35)',
  letterSpacing: '0.01em',
  lineHeight: 1,
}));

// ==================== HELPER ====================
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const getTimeSince = (dateStr) => {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 10) return 'Just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
};

const avatarColors = [
  'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
  'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
  'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
  'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
];

const getAvatarColor = (id) => {
  const hash = String(id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
};

// ==================== MAIN COMPONENT ====================
const HandRaisePanelWrapper = ({
  isOpen,
  onClose,
  hasHostPrivileges,
  raisedHands,
  totalHandsCount,
  pendingHandsCount,
  handRaiseLoading,
  handRaiseStats,
  onAcknowledgeHand,
  onDenyHand,
  onClearAllHands,
}) => {
  const [timeNow, setTimeNow] = useState(Date.now());
  const scrollRef = useRef(null);

  // Update relative times every 10s
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setTimeNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen || !hasHostPrivileges) return null;

  const handleLowerHand = (handId) => {
    // Google Meet style: single action to lower/acknowledge the hand
    if (onAcknowledgeHand) onAcknowledgeHand(handId);
  };

  const handleLowerAllHands = () => {
    if (onClearAllHands) onClearAllHands();
  };

  return (
    <>
      {/* Backdrop */}
      <PanelBackdrop onClick={onClose} />

      {/* Panel */}
      <PanelContainer className="hand-raise-panel-container">

        {/* Mobile drag handle */}
        <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
          <DragHandle />
        </Box>

        {/* Header */}
        <PanelHeader>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <PanTool
              sx={{
                fontSize: 20,
                color: '#f59e0b',
                animation: totalHandsCount > 0 ? `${handWave} 2s ease-in-out 1` : 'none',
              }}
            />
            <Typography
              sx={{
                color: '#fff',
                fontWeight: 600,
                fontSize: { xs: '0.95rem', sm: '1rem' },
                letterSpacing: '-0.01em',
              }}
            >
              Raised hands
            </Typography>
            {totalHandsCount > 0 && (
              <HandCount>{totalHandsCount}</HandCount>
            )}
          </Box>

          <CloseBtn onClick={onClose} size="small">
            <Close sx={{ fontSize: 18 }} />
          </CloseBtn>
        </PanelHeader>

        {/* Content */}
        <ScrollArea ref={scrollRef}>
          {handRaiseLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 1.5 }}>
              <CircularProgress
                size={28}
                thickness={3}
                sx={{ color: 'rgba(255, 255, 255, 0.3)' }}
              />
              <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>
                Loading…
              </Typography>
            </Box>
          ) : raisedHands.length > 0 ? (
            raisedHands.map((hand, index) => {
              const userName = hand.user?.full_name || hand.user?.name || `User ${hand.user_id}`;
              const initials = getInitials(userName);
              const timeSince = getTimeSince(hand.created_at);
              const avatarBg = getAvatarColor(hand.user_id || hand.id);

              return (
                <HandCard key={hand.id} index={index}>
                  {/* Avatar */}
                  <UserAvatar
                    sx={{ background: avatarBg }}
                    src={hand.user?.avatar || hand.user?.profile_image || undefined}
                  >
                    {initials}
                  </UserAvatar>

                  {/* Info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{
                        color: '#fff',
                        fontWeight: 550,
                        fontSize: '0.84rem',
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {userName}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.2 }}>
                      <Box
                        sx={{
                          width: 5,
                          height: 5,
                          borderRadius: '50%',
                          backgroundColor: '#f59e0b',
                          animation: `${dotPulse} 2s ease-in-out infinite`,
                          flexShrink: 0,
                        }}
                      />
                      <TimeBadge>
                        {timeSince || 'Just now'}
                      </TimeBadge>
                    </Box>
                  </Box>

                  {/* Single action: Lower hand (Google Meet style) */}
                  <Tooltip title="Lower hand" arrow placement="left">
                    <LowerHandBtn
                      onClick={() => handleLowerHand(hand.id)}
                      startIcon={<KeyboardArrowDown sx={{ fontSize: '15px !important' }} />}
                    >
                      Lower
                    </LowerHandBtn>
                  </Tooltip>
                </HandCard>
              );
            })
          ) : (
            <EmptyStateContainer>
              <EmptyHandIcon>
                <PanTool
                  sx={{
                    fontSize: 32,
                    color: 'rgba(245, 158, 11, 0.25)',
                    zIndex: 1,
                  }}
                />
              </EmptyHandIcon>
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.55)',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  mb: 0.8,
                  letterSpacing: '-0.01em',
                }}
              >
                No raised hands
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.3)',
                  fontSize: '0.78rem',
                  lineHeight: 1.5,
                  maxWidth: 220,
                }}
              >
                When participants raise their hand, they'll appear here
              </Typography>
            </EmptyStateContainer>
          )}
        </ScrollArea>

        {/* Footer */}
        {totalHandsCount > 0 && (
          <FooterBar>
            <Typography
              sx={{
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '0.72rem',
                fontWeight: 500,
              }}
            >
              {pendingHandsCount > 0
                ? `${pendingHandsCount} pending`
                : `${totalHandsCount} raised`}
              {handRaiseStats?.acknowledged_today
                ? ` · ${handRaiseStats.acknowledged_today} acknowledged`
                : ''}
            </Typography>

            <ClearAllBtn onClick={handleLowerAllHands}>
              Lower all
            </ClearAllBtn>
          </FooterBar>
        )}
      </PanelContainer>
    </>
  );
};

export default HandRaisePanelWrapper;