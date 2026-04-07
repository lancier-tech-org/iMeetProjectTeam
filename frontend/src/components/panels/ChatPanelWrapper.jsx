// src/components/panels/ChatPanelWrapper.jsx
import React from "react";
import { Box } from "@mui/material";
import { styled, keyframes } from "@mui/material/styles";
import ChatPanel from "../chat/ChatPanel";

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATIONS
// ─────────────────────────────────────────────────────────────────────────────
const slideReveal = keyframes`
  0%   { opacity: 0; transform: translateX(18px); }
  100% { opacity: 1; transform: translateX(0); }
`;

const accentPulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 0.8; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// STYLED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/*
 *  ChatShell fills the PanelSlot from the parent MeetingRoom.
 *  On desktop (≥960px) PanelSlot is 360 / 320px inline.
 *  On mobile  (<960px) PanelSlot is an absolute overlay (up to 420px / 100%).
 *  ChatShell simply takes 100% of whatever PanelSlot gives it.
 */
const ChatShell = styled(Box)(({ theme }) => ({
  // ── Fill parent PanelSlot completely ──
  width: "100%",
  height: "100%",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  position: "relative",
  overflow: "hidden",
  flexShrink: 0,

  // ── Glassmorphic surface ──
  background: `
    linear-gradient(
      168deg,
      rgba(14, 19, 30, 0.97) 0%,
      rgba(18, 24, 38, 0.98) 40%,
      rgba(12, 16, 26, 0.99) 100%
    )
  `,
  backdropFilter: "blur(24px) saturate(1.3)",
  WebkitBackdropFilter: "blur(24px) saturate(1.3)",

  // ── Left accent border ──
  borderLeft: "1px solid rgba(255, 255, 255, 0.06)",

  // ── Entrance animation ──
  animation: `${slideReveal} 0.32s cubic-bezier(0.16, 1, 0.3, 1) both`,

  // ── Subtle inner glow at top ──
  "&::before": {
    content: '""',
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    background: `
      linear-gradient(
        180deg,
        rgba(56, 189, 248, 0.03) 0%,
        transparent 100%
      )
    `,
    pointerEvents: "none",
    zIndex: 0,
  },

  // ── Thin accent strip on the left edge ──
  "&::after": {
    content: '""',
    position: "absolute",
    top: 16,
    left: 0,
    bottom: 16,
    width: 2,
    borderRadius: 1,
    background: "linear-gradient(180deg, #38bdf8 0%, #818cf8 50%, transparent 100%)",
    opacity: 0.35,
    animation: `${accentPulse} 4s ease-in-out infinite`,
    pointerEvents: "none",
    zIndex: 1,
  },

  // ── Responsive tweaks ──

  // Large desktop: comfortable width
  [theme.breakpoints.up("xl")]: {
    borderRadius: "14px 0 0 14px",
  },

  // Standard desktop
  [theme.breakpoints.between("lg", "xl")]: {
    borderRadius: "12px 0 0 12px",
  },

  // Small desktop / large tablet
  [theme.breakpoints.between("md", "lg")]: {
    borderRadius: "12px 0 0 12px",
  },

  // Tablet / mobile overlay
  [theme.breakpoints.down("md")]: {
    borderLeft: "none",
    borderRadius: 0,
    // On overlay mode the PanelSlot adds its own glass bg; lighten ours
    background: `
      linear-gradient(
        168deg,
        rgba(14, 19, 30, 0.99) 0%,
        rgba(10, 14, 22, 1) 100%
      )
    `,
    // Remove accent strip on small screens — too tight
    "&::after": {
      display: "none",
    },
  },

  // Small phones
  [theme.breakpoints.down("sm")]: {
    borderRadius: 0,
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
  },
}));

/*
 *  Inner wrapper that holds ChatPanel with correct z-index
 *  above the decorative pseudo-elements.
 */
const ChatInner = styled(Box)(() => ({
  position: "relative",
  zIndex: 2,
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  overflow: "hidden",
  // Let ChatPanel fill this entirely
  "& > *": {
    flex: 1,
    minHeight: 0,
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const ChatPanelWrapper = ({
  isOpen,
  onClose,
  meetingId,
  currentUser,
  participants,
  hasHostPrivileges,
  chatPermissions,
  onUnreadCountChange,
  onTotalMessagesChange,
  onMessageReceived,
  onChatOpened,
}) => {
  if (!isOpen) return null;

  return (
    <ChatShell className="chat-panel-container">
      <ChatInner>
        <ChatPanel
          isOpen={isOpen}
          isChatOpen={isOpen}
          onClose={onClose}
          meetingId={meetingId}
          currentUser={currentUser}
          participants={participants}
          isHost={hasHostPrivileges}
          chatPermissions={chatPermissions}
          onUnreadCountChange={onUnreadCountChange}
          onTotalMessagesChange={onTotalMessagesChange}
          onMessageReceived={onMessageReceived}
          onChatOpened={onChatOpened}
        />
      </ChatInner>
    </ChatShell>
  );
};

export default ChatPanelWrapper;