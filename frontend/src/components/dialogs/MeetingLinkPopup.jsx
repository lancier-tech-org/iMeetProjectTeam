// src/components/dialogs/MeetingLinkPopup.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Typography,
  IconButton,
  Box,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import { styled, keyframes } from "@mui/material/styles";
import {
  Close,
  ContentCopy,
  CheckCircleOutline,
  LinkRounded,
  Shield,
  PersonOutline,
  MeetingRoom as MeetingRoomIcon,
  OpenInNew,
} from "@mui/icons-material";

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATIONS
// ─────────────────────────────────────────────────────────────────────────────
const slideInFromLeft = keyframes`
  0% {
    opacity: 0;
    transform: translateY(-50%) translateX(-32px) scale(0.92);
    filter: blur(8px);
  }
  60% {
    opacity: 1;
    transform: translateY(-50%) translateX(4px) scale(1.01);
    filter: blur(0px);
  }
  100% {
    opacity: 1;
    transform: translateY(-50%) translateX(0) scale(1);
    filter: blur(0px);
  }
`;

const slideOutToLeft = keyframes`
  0% {
    opacity: 1;
    transform: translateY(-50%) translateX(0) scale(1);
    filter: blur(0px);
  }
  100% {
    opacity: 0;
    transform: translateY(-50%) translateX(-40px) scale(0.88);
    filter: blur(6px);
  }
`;

const mobileSlideIn = keyframes`
  0% {
    opacity: 0;
    transform: translateY(100%) scale(0.95);
  }
  60% {
    opacity: 1;
    transform: translateY(-4px) scale(1.01);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const mobileSlideOut = keyframes`
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(100%) scale(0.92);
  }
`;

const progressShrink = keyframes`
  0% { width: 100%; }
  100% { width: 0%; }
`;

const shimmerGlow = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const breathe = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.15); }
  50% { box-shadow: 0 0 0 8px rgba(56, 189, 248, 0); }
`;

const iconPop = keyframes`
  0% { transform: scale(0) rotate(-45deg); opacity: 0; }
  60% { transform: scale(1.2) rotate(5deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
`;

const copyFlash = keyframes`
  0% { transform: scale(1); }
  30% { transform: scale(0.85); }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); }
`;

const fadeStagger = keyframes`
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
`;

const restorePulse = keyframes`
  0%, 100% {
    box-shadow: 0 4px 20px rgba(56, 189, 248, 0.25), 0 0 0 0 rgba(56, 189, 248, 0.2);
  }
  50% {
    box-shadow: 0 4px 20px rgba(56, 189, 248, 0.25), 0 0 0 10px rgba(56, 189, 248, 0);
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// STYLED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
const PopupRoot = styled(Box, {
  shouldForwardProp: (p) => p !== "isExiting" && p !== "isMobile",
})(({ isExiting, isMobile }) => ({
  position: "fixed",
  zIndex: 10001,

  // Desktop: left-centered
  ...(!isMobile && {
    top: "60%",
    left: 20,
    transform: "translateY(-50%)",
    animation: `${isExiting ? slideOutToLeft : slideInFromLeft} ${isExiting ? "0.35s" : "0.55s"} cubic-bezier(0.22, 1, 0.36, 1) forwards`,
  }),

  // Mobile: bottom sheet style
  ...(isMobile && {
    bottom: 16,
    left: 12,
    right: 12,
    animation: `${isExiting ? mobileSlideOut : mobileSlideIn} ${isExiting ? "0.3s" : "0.5s"} cubic-bezier(0.22, 1, 0.36, 1) forwards`,
  }),
}));

const GlassCard = styled(Box, {
  shouldForwardProp: (p) => p !== "isMobile",
})(({ isMobile }) => ({
  position: "relative",
  overflow: "hidden",
  borderRadius: isMobile ? 20 : 18,
  width: isMobile ? "100%" : 380,
  maxWidth: isMobile ? "100%" : "calc(100vw - 40px)",

  // Frosted glass
  background: "rgba(14, 20, 33, 0.88)",
  backdropFilter: "blur(40px) saturate(1.6)",
  WebkitBackdropFilter: "blur(40px) saturate(1.6)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  boxShadow: `
    0 24px 80px -12px rgba(0, 0, 0, 0.5),
    0 8px 24px -4px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.06)
  `,

  "@media (min-width: 600px) and (max-width: 959px)": {
    width: 360,
  },
  "@media (min-width: 960px) and (max-width: 1279px)": {
    width: 370,
  },
  "@media (min-width: 1280px)": {
    width: 390,
  },
}));


const AutoDismissBar = styled(Box, {
  shouldForwardProp: (p) => p !== "duration" && p !== "isPaused",
})(({ duration, isPaused }) => ({
  position: "absolute",
  bottom: 0,
  left: 0,
  height: 3,
  background: "linear-gradient(90deg, #38bdf8, #818cf8)",
  borderRadius: "0 2px 2px 0",
  animation: `${progressShrink} ${duration}ms linear forwards`,
  animationPlayState: isPaused ? "paused" : "running",
  opacity: 0.8,
}));

const HeaderRow = styled(Box)(() => ({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
}));

const IconBadge = styled(Box)(() => ({
  width: 40,
  height: 40,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(129, 140, 248, 0.12))",
  border: "1px solid rgba(56, 189, 248, 0.18)",
  flexShrink: 0,
  animation: `${iconPop} 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both`,
}));

const CloseBtn = styled(IconButton)(() => ({
  width: 32,
  height: 32,
  borderRadius: 10,
  color: "rgba(255, 255, 255, 0.4)",
  transition: "all 0.2s ease",
  "&:hover": {
    color: "rgba(255, 255, 255, 0.85)",
    background: "rgba(255, 255, 255, 0.08)",
  },
}));

const LinkBox = styled(Box, {
  shouldForwardProp: (p) => p !== "justCopied",
})(({ justCopied }) => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 12,
  background: justCopied
    ? "rgba(52, 211, 153, 0.08)"
    : "rgba(255, 255, 255, 0.04)",
  border: `1px solid ${justCopied ? "rgba(52, 211, 153, 0.2)" : "rgba(255, 255, 255, 0.06)"}`,
  transition: "all 0.3s ease",
  cursor: "pointer",
  "&:hover": {
    background: justCopied
      ? "rgba(52, 211, 153, 0.12)"
      : "rgba(255, 255, 255, 0.07)",
    border: `1px solid ${justCopied ? "rgba(52, 211, 153, 0.3)" : "rgba(255, 255, 255, 0.1)"}`,
  },
}));

const CopyButton = styled(IconButton, {
  shouldForwardProp: (p) => p !== "justCopied",
})(({ justCopied }) => ({
  width: 34,
  height: 34,
  borderRadius: 10,
  flexShrink: 0,
  color: justCopied ? "#34d399" : "rgba(255, 255, 255, 0.5)",
  background: justCopied
    ? "rgba(52, 211, 153, 0.12)"
    : "rgba(255, 255, 255, 0.05)",
  transition: "all 0.25s ease",
  animation: justCopied ? `${copyFlash} 0.4s ease` : "none",
  "&:hover": {
    background: justCopied
      ? "rgba(52, 211, 153, 0.18)"
      : "rgba(255, 255, 255, 0.1)",
    color: justCopied ? "#34d399" : "#38bdf8",
  },
}));

const SecurityChip = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 10,
  background: "rgba(56, 189, 248, 0.06)",
  border: "1px solid rgba(56, 189, 248, 0.1)",
}));

const UserRow = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 0",
}));

const RestoreButton = styled(IconButton)(() => ({
  position: "fixed",
  bottom: 24,
  left: 220,
  width: 40,
  height: 40,
  borderRadius: 16,
  background: "linear-gradient(135deg, rgba(14, 20, 33, 0.92), rgba(30, 41, 59, 0.92))",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(56, 189, 248, 0.2)",
  color: "#38bdf8",
  zIndex: 10001,
  animation: `${restorePulse} 2.5s ease-in-out infinite`,
  transition: "all 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
  boxShadow: "0 4px 20px rgba(56, 189, 248, 0.25)",
  "&:hover": {
    transform: "scale(1.08)",
    background: "linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(30, 41, 59, 0.95))",
    border: "1px solid rgba(56, 189, 248, 0.35)",
    boxShadow: "0 6px 28px rgba(56, 189, 248, 0.35)",
  },
  "@media (max-width: 600px)": {
    bottom: 80,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 14,
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const AUTO_DISMISS_MS = 7000;

const MeetingLinkPopup = ({
  open,
  minimized,
  meetingLink,
  currentUser,
  onClose,
  onCopy,
  onMinimize,
  onRestore,
  getParticipantDisplayName,
}) => {
  const isMobile = useMediaQuery("(max-width:600px)");
  const isTablet = useMediaQuery("(min-width:601px) and (max-width:959px)");

  const [isExiting, setIsExiting] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [visible, setVisible] = useState(false);

  const dismissTimerRef = useRef(null);
  const remainingRef = useRef(AUTO_DISMISS_MS);
  const startTimeRef = useRef(null);

  // ── Auto-dismiss helpers ──────────────────────────────────────────────────
  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const startDismissTimer = useCallback(
    (ms) => {
      clearDismissTimer();
      startTimeRef.current = Date.now();
      remainingRef.current = ms;
      dismissTimerRef.current = setTimeout(() => {
        // Animate out, then minimize
        setIsExiting(true);
        setTimeout(() => {
          setVisible(false);
          setIsExiting(false);
          if (onMinimize) onMinimize();
        }, 360);
      }, ms);
    },
    [clearDismissTimer, onMinimize]
  );

  const pauseTimer = useCallback(() => {
    if (!isPaused && dismissTimerRef.current) {
      clearDismissTimer();
      const elapsed = Date.now() - (startTimeRef.current || Date.now());
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
      setIsPaused(true);
    }
  }, [isPaused, clearDismissTimer]);

  const resumeTimer = useCallback(() => {
    if (isPaused && remainingRef.current > 0) {
      setIsPaused(false);
      startDismissTimer(remainingRef.current);
    }
  }, [isPaused, startDismissTimer]);

  // ── Open / close lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    if (open && !minimized) {
      setVisible(true);
      setIsExiting(false);
      remainingRef.current = AUTO_DISMISS_MS;
      startDismissTimer(AUTO_DISMISS_MS);
    } else if (!open || minimized) {
      clearDismissTimer();
      if (visible) {
        setIsExiting(true);
        const t = setTimeout(() => {
          setVisible(false);
          setIsExiting(false);
        }, 360);
        return () => clearTimeout(t);
      }
    }
    return () => clearDismissTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, minimized]);

  // ── Copy handler ──────────────────────────────────────────────────────────
  const handleCopy = useCallback(
    (e) => {
      e?.stopPropagation();
      if (onCopy) onCopy();
      setJustCopied(true);

      // Reset the auto-dismiss so user has time to see the "Copied!" state
      clearDismissTimer();
      remainingRef.current = AUTO_DISMISS_MS;
      startDismissTimer(AUTO_DISMISS_MS);

      setTimeout(() => setJustCopied(false), 2200);
    },
    [onCopy, clearDismissTimer, startDismissTimer]
  );

  // ── Manual close ──────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    clearDismissTimer();
    setIsExiting(true);
    setTimeout(() => {
      setVisible(false);
      setIsExiting(false);
      if (onClose) onClose();
    }, 360);
  }, [clearDismissTimer, onClose]);

  // ── Derived values ────────────────────────────────────────────────────────
  const displayName =
    currentUser?.email ||
    getParticipantDisplayName?.(currentUser) ||
    currentUser?.full_name ||
    currentUser?.name ||
    "Guest";

  const truncatedLink =
    meetingLink?.length > 52
      ? meetingLink.slice(0, 52) + "…"
      : meetingLink || "";

  // ── Minimized FAB ─────────────────────────────────────────────────────────
  if (minimized) {
    return (
      <Tooltip title="Show meeting link" placement="right" arrow>
        <RestoreButton onClick={onRestore} aria-label="Show meeting link">
          <LinkRounded sx={{ fontSize: 22 }} />
        </RestoreButton>
      </Tooltip>
    );
  }

  // ── Hidden ────────────────────────────────────────────────────────────────
  if (!visible) return null;

  // ── Full popup ────────────────────────────────────────────────────────────
  return (
    <PopupRoot
      isExiting={isExiting}
      isMobile={isMobile}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
      onTouchStart={pauseTimer}
      onTouchEnd={resumeTimer}
    >
      <GlassCard isMobile={isMobile}>
        {/* Accent bar top */}

        {/* Auto-dismiss progress bar at bottom */}
        <AutoDismissBar duration={AUTO_DISMISS_MS} isPaused={isPaused} />

        {/* ── Content ─────────────────────────────────────────────────── */}
        <Box sx={{ p: isMobile ? "18px 16px 20px" : "20px 22px 22px" }}>
          {/* Header */}
          <HeaderRow
            sx={{ animation: `${fadeStagger} 0.45s ease 0.1s both` }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <IconBadge>
                <LinkRounded
                  sx={{ fontSize: 20, color: "#38bdf8" }}
                />
              </IconBadge>
              <Box>
                <Typography
                  sx={{
                    color: "#f1f5f9",
                    fontWeight: 700,
                    fontSize: isMobile ? "0.95rem" : "1.05rem",
                    lineHeight: 1.3,
                    letterSpacing: "-0.01em",
                    fontFamily:
                      "'DM Sans', 'SF Pro Display', -apple-system, sans-serif",
                  }}
                >
                  Meeting is ready
                </Typography>
                <Typography
                  sx={{
                    color: "rgba(255,255,255,0.4)",
                    fontSize: "0.7rem",
                    fontWeight: 500,
                    mt: 0.15,
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                  }}
                >
                  Share to invite others
                </Typography>
              </Box>
            </Box>

            <CloseBtn size="small" onClick={handleClose} aria-label="Close">
              <Close sx={{ fontSize: 17 }} />
            </CloseBtn>
          </HeaderRow>

          {/* Link box */}
          <LinkBox
            justCopied={justCopied}
            onClick={handleCopy}
            sx={{
              mt: 2,
              animation: `${fadeStagger} 0.45s ease 0.2s both`,
            }}
          >
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              {justCopied ? (
                <CheckCircleOutline
                  sx={{ fontSize: 16, color: "#34d399", flexShrink: 0 }}
                />
              ) : (
                <OpenInNew
                  sx={{
                    fontSize: 14,
                    color: "rgba(255,255,255,0.25)",
                    flexShrink: 0,
                  }}
                />
              )}
              <Typography
                noWrap
                sx={{
                  color: justCopied ? "#34d399" : "rgba(255,255,255,0.65)",
                  fontSize: isMobile ? "0.75rem" : "0.8rem",
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  flex: 1,
                  minWidth: 0,
                  transition: "color 0.25s ease",
                }}
              >
                {justCopied ? "Link copied!" : truncatedLink}
              </Typography>
            </Box>

            <Tooltip title={justCopied ? "Copied!" : "Copy link"} arrow>
              <CopyButton
                justCopied={justCopied}
                size="small"
                onClick={handleCopy}
                aria-label="Copy meeting link"
              >
                {justCopied ? (
                  <CheckCircleOutline sx={{ fontSize: 16 }} />
                ) : (
                  <ContentCopy sx={{ fontSize: 15 }} />
                )}
              </CopyButton>
            </Tooltip>
          </LinkBox>

          {/* Security chip */}
          <SecurityChip
            sx={{
              mt: 1.5,
              animation: `${fadeStagger} 0.45s ease 0.3s both`,
            }}
          >
            <Shield
              sx={{
                fontSize: 15,
                color: "#38bdf8",
                flexShrink: 0,
              }}
            />
            <Typography
              sx={{
                color: "rgba(56, 189, 248, 0.85)",
                fontSize: "0.7rem",
                fontWeight: 500,
                lineHeight: 1.4,
                letterSpacing: "0.005em",
              }}
            >
              Guests need your permission to join
            </Typography>
          </SecurityChip>

          {/* User row */}
          <UserRow
            sx={{
              mt: 1.5,
              animation: `${fadeStagger} 0.45s ease 0.4s both`,
            }}
          >
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <PersonOutline
                sx={{ fontSize: 14, color: "rgba(255,255,255,0.35)" }}
              />
            </Box>
            <Typography
              noWrap
              sx={{
                color: "rgba(255,255,255,0.4)",
                fontSize: "0.72rem",
                fontWeight: 500,
                flex: 1,
                minWidth: 0,
              }}
            >
              Joined as{" "}
              <Box
                component="span"
                sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 600 }}
              >
                {displayName}
              </Box>
            </Typography>
          </UserRow>
        </Box>
      </GlassCard>
    </PopupRoot>
  );
};

export default MeetingLinkPopup;