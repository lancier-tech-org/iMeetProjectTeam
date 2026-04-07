// src/components/reactions/ReactionsManager.jsx - UPDATED FOR GOOGLE MEET STYLE
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, Typography, Snackbar, Alert, IconButton, Tooltip } from '@mui/material';
import { VolumeUp, VolumeOff } from '@mui/icons-material';
import { useReactions } from '../../hooks/useReactions';
import ProfessionalReactionsPanel from './ProfessionalReactionsPanel';
import FloatingReactionsOverlay from './FloatingReactionsOverlay';
import { DataPacket_Kind } from 'livekit-client';

/**
 * Complete Reactions Management System
 * Handles all reaction logic, display, synchronization, and backend connections
 */
const ReactionsManager = ({
  // ===== Required Props =====
  meetingId,
  currentUser,
  room,

  // ===== Participant Data =====
  allParticipants = [],

  // ===== UI State =====
  reactionsOpen,
  onReactionsToggle,

  // ===== Meeting Settings =====
  reactionsEnabled = true,
  isConnected = false,
  isHost = false,
  isCoHost = false,

  // ===== Callbacks =====
  onNotification,
  onError,

  // ===== Optional Customization =====
  soundEnabled: propSoundEnabled,
  onSoundToggle,
  showSoundControl = true,
  showDebugInfo = false,
  autoHideReactions = true,
  reactionDisplayDuration = 5000,
  maxVisibleReactions = 10,
  enableReactionHistory = true,
  enableReactionStats = true,
}) => {
  // ===== Hooks =====
  const {
    sendReactionToMeeting,
    activeReactions,
    reactionCounts,
    participantReactions,
    getParticipantReaction,
    initializeMeetingReactions,
    endMeetingReactions,
    clearAllReactions,
    soundEnabled: hookSoundEnabled,
    toggleSound: hookToggleSound,
    loadReactionCounts,
    loadActiveReactions,
  } = useReactions(meetingId, room);

  // ===== Local State =====
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);
  const [reactionHistory, setReactionHistory] = useState([]);
  const [localReactionCounts, setLocalReactionCounts] = useState({});
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationSeverity, setNotificationSeverity] = useState('info');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastReactionTime, setLastReactionTime] = useState(0);

  // ===== Refs =====
  const initializationAttempted = useRef(false);
  const cleanupTriggered = useRef(false);
  const reactionQueueRef = useRef([]);
  const processingQueueRef = useRef(false);
  const statsUpdateTimerRef = useRef(null);
  const historyCleanupTimerRef = useRef(null);
  const recentReactionKeysRef = useRef(new Set());

  // ===== Computed Values =====
  const soundEnabled = useMemo(() => {
    return propSoundEnabled !== undefined ? propSoundEnabled : hookSoundEnabled;
  }, [propSoundEnabled, hookSoundEnabled]);

  const toggleSound = useMemo(() => {
    return onSoundToggle || hookToggleSound;
  }, [onSoundToggle, hookToggleSound]);

  const hasHostPrivileges = useMemo(() => {
    return isHost || isCoHost;
  }, [isHost, isCoHost]);

  const reactionStats = useMemo(() => {
    if (!enableReactionStats) return null;

    const stats = {
      total: 0,
      byType: {},
      topReaction: null,
      recentCount: 0,
    };

    Object.entries(reactionCounts).forEach(([emoji, data]) => {
      const count = data?.count || 0;
      stats.total += count;
      stats.byType[emoji] = count;
      if (!stats.topReaction || count > stats.byType[stats.topReaction]) {
        stats.topReaction = emoji;
      }
    });

    const now = Date.now();
    stats.recentCount = reactionHistory.filter(
      (r) => now - r.timestamp < 30000
    ).length;

    return stats;
  }, [reactionCounts, reactionHistory, enableReactionStats]);

  // ===== Notification Helper =====
  const showMessage = useCallback(
    (message, severity = 'info') => {
      setNotificationMessage(message);
      setNotificationSeverity(severity);
      setShowNotification(true);
      if (onNotification) {
        onNotification(message, severity);
      }
    },
    [onNotification]
  );

  // ===== Error Handler =====
  const handleError = useCallback(
    (error, context = '') => {
      console.error(`❌ ReactionsManager Error [${context}]:`, error);
      const errorMessage = error?.message || 'An error occurred';
      setError(errorMessage);
      if (onError) {
        onError(error, context);
      }
      showMessage(`Reaction error: ${errorMessage}`, 'error');
    },
    [onError, showMessage]
  );

  // ===== Initialization =====
  useEffect(() => {
    if (!meetingId || !room || !isConnected) return;
    if (initializationAttempted.current) return;

    initializationAttempted.current = true;

    const initializeSystem = async () => {
      try {
        console.log('🎭 ReactionsManager: Initializing...');

        if (typeof initializeMeetingReactions === 'function') {
          const success = await initializeMeetingReactions();

          if (success) {
            setInitialized(true);
            console.log('✅ ReactionsManager: Initialized');

            if (typeof loadReactionCounts === 'function') {
              await loadReactionCounts();
            }
            if (typeof loadActiveReactions === 'function') {
              await loadActiveReactions();
            }
          } else {
            console.warn('⚠️ ReactionsManager: Init returned false, continuing');
            setInitialized(true);
          }
        } else {
          setInitialized(true);
        }
      } catch (error) {
        console.error('❌ ReactionsManager init error:', error);
        handleError(error, 'initialization');
        setInitialized(true);
      }
    };

    initializeSystem();
  }, [
    meetingId,
    room,
    isConnected,
    currentUser,
    initializeMeetingReactions,
    loadReactionCounts,
    loadActiveReactions,
    handleError,
    showMessage,
  ]);

  // ===== Cleanup on Unmount =====
  useEffect(() => {
    return () => {
      if (cleanupTriggered.current) return;
      cleanupTriggered.current = true;

      if (statsUpdateTimerRef.current) clearInterval(statsUpdateTimerRef.current);
      if (historyCleanupTimerRef.current) clearInterval(historyCleanupTimerRef.current);

      if (typeof endMeetingReactions === 'function' && meetingId) {
        endMeetingReactions().catch((err) => console.warn('Cleanup error:', err));
      }
    };
  }, [meetingId, endMeetingReactions]);

  // ===== Reaction History =====
  useEffect(() => {
    if (!enableReactionHistory) return;

    activeReactions.forEach((reaction) => {
      setReactionHistory((prev) => {
        const exists = prev.some(
          (r) =>
            r.id === reaction.id ||
            (r.userId === reaction.userId && r.timestamp === reaction.timestamp)
        );
        if (exists) return prev;

        return [
          {
            id: reaction.id || Date.now(),
            emoji: reaction.emoji,
            userId: reaction.userId,
            userName: reaction.userName || reaction.user_name,
            timestamp: reaction.timestamp || Date.now(),
          },
          ...prev,
        ].slice(0, 100);
      });
    });
  }, [activeReactions, enableReactionHistory]);

  // ===== History Cleanup =====
  useEffect(() => {
    if (!enableReactionHistory) return;

    historyCleanupTimerRef.current = setInterval(() => {
      const cutoff = Date.now() - 300000;
      setReactionHistory((prev) => prev.filter((r) => r.timestamp > cutoff));
    }, 60000);

    return () => {
      if (historyCleanupTimerRef.current) clearInterval(historyCleanupTimerRef.current);
    };
  }, [enableReactionHistory]);

  // ===== Stats Sync =====
  useEffect(() => {
    if (!enableReactionStats) return;

    setLocalReactionCounts(reactionCounts);

    statsUpdateTimerRef.current = setInterval(() => {
      if (typeof loadReactionCounts === 'function') {
        loadReactionCounts().catch((err) => console.warn('Stats sync error:', err));
      }
    }, 30000);

    return () => {
      if (statsUpdateTimerRef.current) clearInterval(statsUpdateTimerRef.current);
    };
  }, [reactionCounts, enableReactionStats, loadReactionCounts]);

  // ===== Send Reaction =====
  const handleSendReaction = useCallback(
    async (emojiOrData) => {
      if (!isConnected) {
        showMessage('Not connected to meeting', 'warning');
        return false;
      }
      if (!reactionsEnabled) {
        showMessage('Reactions are disabled', 'warning');
        return false;
      }
      if (!meetingId || !currentUser?.id) {
        showMessage('User information not available', 'error');
        return false;
      }
      if (isProcessing) {
        showMessage('Please wait...', 'info');
        return false;
      }

      const now = Date.now();
      if (now - lastReactionTime < 500) {
        showMessage('Too fast — slow down!', 'warning');
        return false;
      }

      try {
        setIsProcessing(true);
        setLastReactionTime(now);

        const emoji =
          typeof emojiOrData === 'string'
            ? emojiOrData
            : emojiOrData?.emoji || emojiOrData;

        console.log('📤 Sending reaction:', emoji);

        const reactionData = {
          emoji,
          meetingId,
          user: {
            id: currentUser.id,
            full_name: currentUser.full_name || currentUser.name,
            name: currentUser.name || currentUser.full_name,
            username: currentUser.username,
            participant_identity: `user_${currentUser.id}`,
          },
        };

        const success = await sendReactionToMeeting(reactionData);

        if (success) {
          console.log('✅ Reaction sent');

          setReactionHistory((prev) =>
            [
              {
                id: Date.now(),
                emoji,
                userId: currentUser.id,
                userName: currentUser.full_name || currentUser.name,
                timestamp: Date.now(),
              },
              ...prev,
            ].slice(0, 100)
          );

          // Close panel after sending
          if (onReactionsToggle) {
            setTimeout(() => onReactionsToggle(false), 200);
          }

          return true;
        } else {
          throw new Error('Send reaction returned false');
        }
      } catch (error) {
        handleError(error, 'send_reaction');
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [
      isConnected,
      reactionsEnabled,
      meetingId,
      currentUser,
      isProcessing,
      lastReactionTime,
      sendReactionToMeeting,
      onReactionsToggle,
      showMessage,
      handleError,
    ]
  );

  // ===== Clear All (Host) =====
  const handleClearAllReactions = useCallback(async () => {
    if (!hasHostPrivileges) {
      showMessage('Only hosts can clear reactions', 'warning');
      return false;
    }
    if (!meetingId || !currentUser?.id) return false;

    try {
      if (typeof clearAllReactions === 'function') {
        const success = await clearAllReactions(currentUser.id);
        if (success) {
          setReactionHistory([]);
          setLocalReactionCounts({});
          showMessage('All reactions cleared', 'success');
          return true;
        }
      }
      throw new Error('Clear failed');
    } catch (error) {
      handleError(error, 'clear_all');
      return false;
    }
  }, [hasHostPrivileges, meetingId, currentUser, clearAllReactions, showMessage, handleError]);

  // ===== LiveKit Incoming Reactions =====
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload, participant) => {
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));

        if (data.type === 'reaction_notification') {
          if (data.user_id?.toString() === currentUser?.id?.toString()) return;

          const reactionKey = `${data.user_id}-${data.emoji}-${data.timestamp}`;
          if (recentReactionKeysRef.current.has(reactionKey)) return;

          recentReactionKeysRef.current.add(reactionKey);
          setTimeout(() => recentReactionKeysRef.current.delete(reactionKey), 5000);

          if (enableReactionHistory) {
            setReactionHistory((prev) =>
              [
                {
                  id: `remote_${Date.now()}`,
                  emoji: data.emoji,
                  userId: data.user_id,
                  userName: data.user_name,
                  timestamp: data.timestamp || Date.now(),
                },
                ...prev,
              ].slice(0, 100)
            );
          }
        }
      } catch (err) {
        console.warn('ReactionsManager: Data parse error:', err);
      }
    };

    room.on('dataReceived', handleDataReceived);
    return () => room.off('dataReceived', handleDataReceived);
  }, [room, currentUser, enableReactionHistory]);

  // ===== Bail if disabled =====
  if (!reactionsEnabled) return null;

  // ===== Render =====
  return (
    <>
      {/* ── Floating Reactions Overlay (bubbles on video grid) ───── */}
      <FloatingReactionsOverlay
        participantReactions={participantReactions}
        allParticipants={allParticipants}
        currentUser={currentUser}
      />

      {/* ── Reactions Picker (horizontal emoji bar above controls) ─ */}
      <ProfessionalReactionsPanel
        isOpen={reactionsOpen && reactionsEnabled && isConnected}
        onClose={() => onReactionsToggle?.(false)}
        onReaction={handleSendReaction}
        disabled={!isConnected || !reactionsEnabled || isProcessing}
      />

      {/* ── Error Display ────────────────────────────────────────── */}
      {error && (
        <Box
          sx={{
            position: 'fixed',
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(244, 67, 54, 0.95)',
            color: 'white',
            p: 2,
            borderRadius: 2,
            zIndex: 10001,
            maxWidth: 400,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Typography variant="body2" sx={{ flex: 1 }}>
            {error}
          </Typography>
          <IconButton
            size="small"
            onClick={() => setError(null)}
            sx={{ color: 'white', flexShrink: 0 }}
          >
            ×
          </IconButton>
        </Box>
      )}

      {/* ── Snackbar ─────────────────────────────────────────────── */}
      <Snackbar
        open={showNotification}
        autoHideDuration={2500}
        onClose={() => setShowNotification(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowNotification(false)}
          severity={notificationSeverity}
          sx={{
            background: 'rgba(40, 44, 52, 0.97)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            color: '#e8eaed',
            fontFamily: "'DM Sans', sans-serif",
            '& .MuiAlert-icon': { color: '#8ab4f8' },
          }}
        >
          {notificationMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

ReactionsManager.displayName = 'ReactionsManager';
export default React.memo(ReactionsManager);
export { ReactionsManager };