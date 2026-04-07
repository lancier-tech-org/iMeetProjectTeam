import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  Box,
  Typography,
  IconButton,
  TextField,
  Avatar,
  Chip,
  Paper,
  InputAdornment,
  CircularProgress,
  Alert,
  Collapse,
  Badge,
  Popover,
  Tooltip,
  Divider,
  Button,
  List,
  ListItem,
} from "@mui/material";
import {
  Close,
  Send,
  EmojiEmotions,
  AttachFile,
  People,
  Public,
  Lock,
  Chat as ChatIcon,
  InsertDriveFile,
  Image,
  VideoFile,
  AudioFile,
  GetApp,
  FiberManualRecord,
  CheckCircle,
  Search,
  ExpandLess,
  ExpandMore,
} from "@mui/icons-material";
import { styled, keyframes } from "@mui/material/styles";
import { useMeeting } from "../../hooks/useMeeting";
import { MESSAGE_TYPES, STORAGE_KEYS } from "../../utils/constants";
import cacheChatService from "../../services/cache-chat";

// ═══════════════════════════════════════════════════════════════════════════
// EMOJI DATA — UNCHANGED
// ═══════════════════════════════════════════════════════════════════════════
const EMOJI_CATEGORIES = {
  "Smileys": { icon: "😀", emojis: ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗"] },
  "Animals": { icon: "🐶", emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐽","🐸","🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜"] },
  "Food": { icon: "🍔", emojis: ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🍔","🍟","🍕","🌭","🥪","🌮","🌯","🥙","🧆","🥚","🍳","🥘","🍲","🥣","🥗","🍿","🧈","🧂","🥫","🍱"] },
  "Activity": { icon: "⚽", emojis: ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🏑","🥍","🏏","🪃","🥅","⛳","🎯","🏹","🎣","🤿","🥊","🥋","🎽","🛹","🛼","🛷","⛸️","🥌","🎿","⛷️","🏂","🪂","🏋️","🤼","🤸","🤺"] },
  "Objects": { icon: "💡", emojis: ["⌚","📱","📲","💻","⌨️","🖥️","🖨️","🖱️","🖲️","🕹️","🗜️","💽","💾","💿","📀","📼","📷","📸","📹","🎥","💡","🔦","🏮","🪔","📔","📕","📖","📗","📘","📙","📚","📓","📒","📃","📜","📄","📰","🗞️","📑","🔖"] },
  "Symbols": { icon: "❤️", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","☦️","🛐","⛎","♈","♉","♊","♋","♌","♍","♎","♏","♐"] },
};

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATIONS + TOKENS
// ═══════════════════════════════════════════════════════════════════════════
const fadeUp = keyframes`from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}`;
const typingBounce = keyframes`0%,60%{transform:translateY(0)}30%{transform:translateY(-3px)}`;
const ff = "'Nunito Sans','Segoe UI',system-ui,sans-serif";

// ═══════════════════════════════════════════════════════════════════════════
// STYLED — White · Balanced · Responsive
// ═══════════════════════════════════════════════════════════════════════════
const Root = styled(Box)(({theme})=>({
  position:"fixed",top:0,right:0,bottom:0,width:380,height:"90vh",
  background:"#ffffff",display:"flex",flexDirection:"column",zIndex:1300,
  borderLeft:"1px solid #edf0f4",overflow:"hidden",fontFamily:ff,
  [theme.breakpoints.down("sm")]:{width:"100vw",borderLeft:"none"},
}));
const Head = styled(Box)(()=>({
  display:"flex",alignItems:"center",justifyContent:"space-between",
  padding:"10px 14px",borderBottom:"1px solid #f1f5f9",flexShrink:0,background:"#fff",
}));
const MsgArea = styled(Box)(()=>({
  flex:1,overflowY:"auto",padding:"8px 12px",background:"#fafbfc",
  "&::-webkit-scrollbar":{width:4},"&::-webkit-scrollbar-track":{background:"transparent"},
  "&::-webkit-scrollbar-thumb":{background:"rgba(0,0,0,0.08)",borderRadius:4,"&:hover":{background:"rgba(0,0,0,0.14)"}},
}));
const InputWrap = styled(Box)(()=>({
  padding:"6px 10px 10px",borderTop:"1px solid #f1f5f9",background:"#fff",flexShrink:0,
}));
const Compose = styled(Box)(()=>({
  display:"flex",alignItems:"flex-end",gap:5,background:"#f8fafc",borderRadius:12,
  border:"1px solid #e2e8f0",padding:"4px 6px",transition:"border-color .2s,box-shadow .2s",
  "&:focus-within":{borderColor:"#93c5fd",boxShadow:"0 0 0 2px rgba(59,130,246,.06)"},
}));
const SndBtn = styled(IconButton,{shouldForwardProp:p=>p!=="active"})(({active})=>({
  width:32,height:32,borderRadius:8,background:active?"#3b82f6":"#e2e8f0",
  color:active?"#fff":"#94a3b8",transition:"all .15s",
  "&:hover":{background:active?"#2563eb":"#e2e8f0"},
  "&:disabled":{background:"#e2e8f0",color:"#94a3b8"},
  "& .MuiSvgIcon-root":{fontSize:15},
}));
const TBtn = styled(IconButton)(()=>({
  width:30,height:30,color:"#94a3b8",
  "&:hover":{color:"#3b82f6",background:"rgba(59,130,246,.06)"},
  "& .MuiSvgIcon-root":{fontSize:17},
}));
const Bub = styled(Paper,{shouldForwardProp:p=>!["own","priv"].includes(p)})(({own,priv})=>({
  padding:"8px 12px",maxWidth:"100%",wordBreak:"break-word",boxShadow:"none",
  border:priv?"1.5px solid #fbbf24":"none",
  background:own?"#3b82f6":"#f1f5f9",color:own?"#fff":"#1e293b",
  borderRadius:own?"14px 14px 3px 14px":"14px 14px 14px 3px",fontSize:12.5,lineHeight:1.55,fontFamily:ff,
}));
const Tag = styled(Chip)(()=>({
  height:21,fontSize:10.5,fontWeight:700,fontFamily:ff,
  "& .MuiChip-icon":{fontSize:11,marginLeft:3},"& .MuiChip-label":{paddingLeft:3,paddingRight:6},
}));

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
const ChatPanel = ({
  isOpen, isChatOpen, onClose, className = "", meetingId, participants = [],
  currentUser, isHost = false,
  chatPermissions = { canSendMessages: true, canUploadFiles: true },
  meetingSettings = {},
}) => {
  const actuallyOpen = isOpen || isChatOpen;

  // ── State — UNCHANGED ──────────────────────────────────────────────────
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState("Smileys");
  const [emojiSearchTerm, setEmojiSearchTerm] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [cacheMessages, setCacheMessages] = useState([]);
  const [showParticipants, setShowParticipants] = useState(true);
  const [messageType, setMessageType] = useState("public");
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredMessages, setFilteredMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chatStats, setChatStats] = useState({ totalMessages: 0, storageType: "cache_only" });
  const [isChatInitialized, setIsChatInitialized] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [lastMessageTimestamp, setLastMessageTimestamp] = useState(null);
  const [syncStatus, setSyncStatus] = useState("connected");
  const [messagesSyncing, setMessagesSyncing] = useState(false);
  const [lastSeenMessageId, setLastSeenMessageId] = useState(null);
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState(null);
  const [chatVisible, setChatVisible] = useState(false);
  const [showPrivateChatToggle, setShowPrivateChatToggle] = useState(true);
  const [privateChatEnabled, setPrivateChatEnabled] = useState(meetingSettings.privateChatEnabled ?? true);
  const [messageRecipient, setMessageRecipient] = useState("everyone");
  const [showRecipientSelector, setShowRecipientSelector] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [recipientSearchTerm, setRecipientSearchTerm] = useState("");

  // ── Refs — UNCHANGED ───────────────────────────────────────────────────
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messagePollingRef = useRef(null);
  const lastPollRef = useRef(Date.now());
  const messagesSentRef = useRef(new Set());
  const intersectionObserverRef = useRef(null);
  const eventListenerRef = useRef(null);

  // ══════════════════════════════════════════════════════════════════════════
  // ALL BACKEND LOGIC — 100% UNCHANGED
  // ══════════════════════════════════════════════════════════════════════════
  const handleRecipientToggle = useCallback(() => { setShowRecipientSelector(p => !p); }, []);
  const handleEveryone = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setMessageRecipient("everyone"); setSelectedParticipants([]); setShowRecipientSelector(false); }, []);
  const handleSelectParticipant = useCallback((pid) => { setSelectedParticipants(p => p.includes(pid) ? p.filter(i => i !== pid) : [...p, pid]); }, []);
  const handleApplySelection = useCallback(() => { setMessageRecipient(selectedParticipants); setShowRecipientSelector(false); setRecipientSearchTerm(""); }, [selectedParticipants]);
  const handleCancelSelection = useCallback(() => { setSelectedParticipants([]); setShowRecipientSelector(false); setRecipientSearchTerm(""); }, []);
  const scrollToBottom = useCallback(() => { if (messagesEndRef.current && isAtBottom) messagesEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [isAtBottom]);

  useEffect(() => { setChatVisible(actuallyOpen); if (actuallyOpen) setTimeout(() => markMessagesAsRead(), 500); }, [actuallyOpen]);

  const markMessagesAsRead = useCallback(() => {
    if (!chatVisible || filteredMessages.length === 0) return;
    const last = filteredMessages[filteredMessages.length - 1];
    if (last && (last.id || last.timestamp)) {
      const mid = last.id || last.timestamp; const ts = last.timestamp;
      if (lastSeenMessageId !== mid || lastSeenTimestamp !== ts) {
        setLastSeenMessageId(mid); setLastSeenTimestamp(ts); setUnreadCount(0);
        if (meetingId) localStorage.setItem(`chat_last_seen_${meetingId}`, JSON.stringify({ messageId: mid, timestamp: ts, userId: currentUser?.id }));
      }
    }
  }, [chatVisible, filteredMessages, lastSeenMessageId, lastSeenTimestamp, meetingId, currentUser?.id]);

  useEffect(() => {
    if (meetingId && currentUser?.id) {
      const stored = localStorage.getItem(`chat_last_seen_${meetingId}`);
      if (stored) { try { const { messageId, timestamp, userId } = JSON.parse(stored); if (userId === currentUser.id) { setLastSeenMessageId(messageId); setLastSeenTimestamp(timestamp); } } catch (e) { console.warn("Failed to parse stored last seen:", e); } }
    }
  }, [meetingId, currentUser?.id]);

  const calculateUnreadCount = useCallback(() => {
    if (!lastSeenMessageId && !lastSeenTimestamp) return filteredMessages.filter(m => m.userId !== currentUser?.id).length;
    const idx = filteredMessages.findIndex(m => (m.id && m.id === lastSeenMessageId) || m.timestamp === lastSeenTimestamp);
    if (idx === -1) return filteredMessages.filter(m => m.userId !== currentUser?.id).length;
    return filteredMessages.slice(idx + 1).filter(m => m.userId !== currentUser?.id).length;
  }, [filteredMessages, lastSeenMessageId, lastSeenTimestamp, currentUser?.id]);

  useEffect(() => { if (!chatVisible) setUnreadCount(calculateUnreadCount()); else setTimeout(() => markMessagesAsRead(), 1000); }, [filteredMessages, chatVisible, calculateUnreadCount, markMessagesAsRead]);

  useEffect(() => {
    if (!messagesEndRef.current || !chatContainerRef.current) return;
    const obs = new IntersectionObserver((entries) => { const [e] = entries; setIsAtBottom(e.isIntersecting); if (e.isIntersecting && chatVisible) setTimeout(markMessagesAsRead, 100); }, { root: chatContainerRef.current, threshold: 0.1 });
    obs.observe(messagesEndRef.current); intersectionObserverRef.current = obs;
    return () => { if (intersectionObserverRef.current) intersectionObserverRef.current.disconnect(); };
  }, [chatVisible, markMessagesAsRead]);

  const safeParseFileData = useCallback((fd) => { if (!fd) return null; if (typeof fd === "object") return fd; if (typeof fd === "string") { try { return JSON.parse(fd); } catch { return null; } } return null; }, []);

  const extractFileInfoFromMessage = useCallback((msg) => {
    if (!msg || typeof msg !== "string") return null;
    const pats = [/📎\s*Shared a file:\s*(.+?)\s*\(([0-9.]+)\s*(KB|MB|GB)\)/i, /📷\s*Shared an image:\s*(.+?)\s*\(([0-9.]+)\s*(KB|MB|GB)\)/i, /📎\s*(.+?)\s*\(([0-9.]+)\s*(KB|MB|GB)\)/i, /Shared a file:\s*(.+?)(?:\s*\(([0-9.]+)\s*(KB|MB|GB)\))?/i, /Shared an image:\s*(.+?)(?:\s*\(([0-9.]+)\s*(KB|MB|GB)\))?/i];
    for (const p of pats) { const m = msg.match(p); if (m) { const [, fn, sz, u] = m; let b = 0; if (sz && u) { const n = parseFloat(sz); const ul = u.toLowerCase(); b = ul === "kb" ? n * 1024 : ul === "mb" ? n * 1048576 : ul === "gb" ? n * 1073741824 : n; } return { name: fn.trim(), size: b, type: getFileTypeFromName(fn), url: null, isFromPreviousSession: false }; } }
    return null;
  }, []);

  useEffect(() => { if (meetingId && actuallyOpen && !isChatInitialized) initializeCacheChat(); return () => { if (messagePollingRef.current) clearInterval(messagePollingRef.current); if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); if (intersectionObserverRef.current) intersectionObserverRef.current.disconnect(); }; }, [meetingId, actuallyOpen, isChatInitialized]);

  const initializeCacheChat = async () => {
    try { setIsLoading(true); const r = await cacheChatService.startMeetingChat(meetingId, currentUser?.id, isHost); if (r.success) { setIsChatInitialized(true); setSyncStatus("connected"); await loadCacheMessages(); } else throw new Error(r.error || "Failed to initialize chat"); }
    catch (e) { setSyncStatus("error"); setError({ type: "error", message: "Failed to initialize chat: " + e.message }); } finally { setIsLoading(false); }
  };

  const loadCacheMessages = async (force = false) => {
    if (!meetingId) return;
    try {
      setMessagesSyncing(true);
      const result = await cacheChatService.getChatHistory(meetingId, 100, 0, currentUser?.id, isHost);
      if (result.success) {
        const msgs = (result.messages || []).map(msg => {
          const fmt = cacheChatService.formatMessage(msg); let fi = null;
          if (fmt.messageType === "file" || fmt.fileData) { const pd = safeParseFileData(fmt.fileData); if (pd) fi = { ...pd, url: pd.file_id ? cacheChatService.createFileDownloadUrl(pd.file_id) : pd.originalUrl || pd.url }; }
          if (!fi && fmt.message) { const ex = extractFileInfoFromMessage(fmt.message); if (ex) { const fid = msg.file_id || fmt.file_id; if (fid) { ex.url = cacheChatService.createFileDownloadUrl(fid); ex.file_id = fid; ex.isFromPreviousSession = false; } else ex.isFromPreviousSession = true; fi = ex; fmt.messageType = "file"; } }
          if (fi) { fmt.fileData = fi; fmt.fileUrl = fi.url || null; fmt.fileType = fi.type || null; fmt.fileSize = fi.size || 0; fmt.messageType = "file"; }
          return fmt;
        });
        setCacheMessages(prev => { if (prev.length === msgs.length) { const chg = msgs.some((n, i) => n.id !== prev[i]?.id || n.message !== prev[i]?.message || n.timestamp !== prev[i]?.timestamp); if (!chg) return prev; } return msgs; });
        setChatStats({ totalMessages: result.totalCount, currentMessages: result.count, storageType: "cache_only" });
        if (msgs.length > 0) setLastMessageTimestamp(msgs[msgs.length - 1]?.timestamp);
        setSyncStatus("connected");
      } else setSyncStatus("warning");
    } catch { setSyncStatus("error"); } finally { setMessagesSyncing(false); }
  };

  useEffect(() => {
    if (meetingId && actuallyOpen && isChatInitialized) {
      if (eventListenerRef.current) window.removeEventListener("cacheMessagesUpdated", eventListenerRef.current);
      const handler = (ev) => { const { meetingId: eid, messages } = ev.detail; if (eid === meetingId) { const proc = messages.map(m => { if (m.messageType === "file" && m.fileData) { const fi = safeParseFileData(m.fileData); if (fi?.file_id) { fi.url = cacheChatService.createFileDownloadUrl(fi.file_id); m.fileData = fi; m.fileUrl = fi.url; } } return m; }); setCacheMessages(prev => { if (prev.length === proc.length) { const chg = proc.some((n, i) => n.id !== prev[i]?.id || n.message !== prev[i]?.message || n.timestamp !== prev[i]?.timestamp); if (!chg) return prev; } setTimeout(scrollToBottom, 50); return proc; }); } };
      eventListenerRef.current = handler; window.addEventListener("cacheMessagesUpdated", handler);
      return () => { if (eventListenerRef.current) { window.removeEventListener("cacheMessagesUpdated", eventListenerRef.current); eventListenerRef.current = null; } };
    }
  }, [meetingId, actuallyOpen, isChatInitialized, scrollToBottom]);

  useEffect(() => { if (!searchTerm.trim()) setFilteredMessages(cacheMessages); else setFilteredMessages(cacheMessages.filter(m => m.message?.toLowerCase().includes(searchTerm.toLowerCase()) || m.userName?.toLowerCase().includes(searchTerm.toLowerCase()))); }, [cacheMessages, searchTerm]);
  useEffect(() => { scrollToBottom(); }, [filteredMessages, scrollToBottom]);

  const handleEmojiSelect = useCallback((e) => { setNewMessage(p => p + e); setShowEmojiPicker(false); setEmojiAnchorEl(null); inputRef.current?.focus(); }, []);
  const handleEmojiToggle = useCallback((e) => { if (showEmojiPicker) { setShowEmojiPicker(false); setEmojiAnchorEl(null); } else { setShowEmojiPicker(true); setEmojiAnchorEl(e.currentTarget); } }, [showEmojiPicker]);

  const handleFileSelect = useCallback(async (event) => {
    const files = Array.from(event.target.files); if (!files.length) return;
    for (const file of files) {
      const uid = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      try {
        setUploadingFiles(p => [...p, { file, progress: 0, id: uid }]);
        let priv = false, recs = [];
        if (messageRecipient === "host") { priv = true; const hp = participants.find(p => p.isHost || p.role === "host"); if (hp) recs = [String(hp.user_id || hp.id)]; }
        else if (Array.isArray(messageRecipient) && messageRecipient.length > 0) { priv = true; recs = messageRecipient.map(id => String(id)); }
        const r = await cacheChatService.uploadFile(meetingId, file, currentUser?.id || "anonymous", currentUser?.name || currentUser?.full_name || "You", (prog) => { setUploadingFiles(p => p.map(u => u.id === uid ? { ...u, progress: prog } : u)); }, priv, recs);
        if (r.success) { setUploadingFiles(p => p.map(u => u.id === uid ? { ...u, progress: 100 } : u)); setTimeout(() => { setUploadingFiles(p => p.filter(u => u.id !== uid)); setTimeout(scrollToBottom, 100); }, 1000); }
        else throw new Error(r.error || "Upload failed");
      } catch (e) { setError({ type: "error", message: `Failed: ${file.name}: ${e.message}` }); setUploadingFiles(p => p.filter(u => u.id !== uid)); }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [meetingId, currentUser, messageRecipient, participants, scrollToBottom]);

  const handleFileUpload = useCallback(() => { if (!chatPermissions.canUploadFiles) { setError({ type: "warning", message: "File uploads not allowed" }); return; } fileInputRef.current?.click(); }, [chatPermissions.canUploadFiles]);

  const handleSendMessage = useCallback(async (e) => {
    e.preventDefault(); if (!newMessage.trim() || !isChatInitialized) return;
    const txt = newMessage.trim(); setNewMessage("");
    try {
      let recs = [], priv = false;
      if (messageRecipient === "host") { const hp = participants.find(p => p.isHost || p.role === "host"); if (hp) { recs = [hp.user_id || hp.id]; priv = true; } }
      else if (Array.isArray(messageRecipient) && messageRecipient.length > 0) { recs = messageRecipient; priv = true; }
      const r = await cacheChatService.sendMessage({ meetingId, userId: currentUser?.id || "anonymous", userName: currentUser?.name || currentUser?.full_name || "You", message: txt, messageType: priv ? "private" : "text", isPrivate: priv, recipients: recs, senderIsHost: isHost });
      if (r.success) { setTimeout(scrollToBottom, 100); if (!isHost) setMessageRecipient(privateChatEnabled ? "everyone" : "everyone"); }
      else throw new Error(r.error || "Send failed");
    } catch (e) { setError({ type: "error", message: "Send failed: " + e.message }); setNewMessage(txt); }
  }, [newMessage, meetingId, currentUser, messageRecipient, isHost, privateChatEnabled, isChatInitialized, scrollToBottom, participants]);

  const handleTypingStart = useCallback(async () => {
    if (!isTyping && isChatInitialized) { setIsTyping(true); try { await cacheChatService.updateTypingStatus(meetingId, currentUser?.id || "anonymous", currentUser?.name || currentUser?.full_name || "You", true); } catch {} }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(async () => { if (isTyping) { setIsTyping(false); try { await cacheChatService.updateTypingStatus(meetingId, currentUser?.id || "anonymous", currentUser?.name || currentUser?.full_name || "You", false); } catch {} } }, 3000);
  }, [isTyping, isChatInitialized, meetingId, currentUser]);

  const handleKeyPress = useCallback((e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } else handleTypingStart(); }, [handleSendMessage, handleTypingStart]);
  const handleManualRefresh = useCallback(async () => { setMessagesSyncing(true); try { await cacheChatService.forceRefresh(meetingId); await loadCacheMessages(true); setSyncStatus("connected"); } catch { setSyncStatus("error"); } finally { setMessagesSyncing(false); } }, [meetingId]);

  // ── Helpers — UNCHANGED ────────────────────────────────────────────────
  const formatMessageTime = useCallback((ts) => { try { return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }); } catch { return ""; } }, []);
  const getMessageSender = useCallback((m) => m?.userId === currentUser?.id ? "You" : m?.userName || m?.user_name || "Anonymous", [currentUser?.id]);
  const handleClose = useCallback(() => { if (typeof onClose === "function") onClose(); }, [onClose]);
  const getInitials = useCallback((n) => n ? n.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "?", []);
  const getParticipantColor = useCallback((uid) => { const c = ["#e91e63","#2196f3","#4caf50","#9c27b0","#ff9800","#f44336","#3f51b5","#009688"]; return c[parseInt(uid?.toString() || "0") % c.length]; }, []);
  const getFileIcon = useCallback((t) => { if (t?.startsWith("image/")) return <Image sx={{ color: "#4caf50", fontSize: 16 }} />; if (t?.startsWith("video/")) return <VideoFile sx={{ color: "#f44336", fontSize: 16 }} />; if (t?.startsWith("audio/")) return <AudioFile sx={{ color: "#ff9800", fontSize: 16 }} />; if (t?.includes("pdf")) return <InsertDriveFile sx={{ color: "#f44336", fontSize: 16 }} />; return <InsertDriveFile sx={{ color: "#94a3b8", fontSize: 16 }} />; }, []);
  const getFileTypeFromName = useCallback((fn) => { if (!fn) return "application/octet-stream"; const x = fn.split(".").pop()?.toLowerCase(); const m = { jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",gif:"image/gif",pdf:"application/pdf",doc:"application/msword",txt:"text/plain",mp3:"audio/mpeg",wav:"audio/wav",mp4:"video/mp4",avi:"video/x-msvideo",zip:"application/zip",json:"application/json",csv:"text/csv" }; return m[x] || "application/octet-stream"; }, []);
  const getFileExtension = useCallback((fn) => fn ? fn.split(".").pop()?.toUpperCase() || "" : "", []);
  const formatFileSize = useCallback((b) => { if (b === 0) return "0 B"; const k = 1024; const s = ["B","KB","MB","GB"]; const i = Math.floor(Math.log(b) / Math.log(k)); return parseFloat((b / Math.pow(k, i)).toFixed(1)) + " " + s[i]; }, []);
  const handleFileClick = useCallback((fd, msg) => {
    if (!fd) { setError({ type: "warning", message: "File not available" }); return; }
    if (fd.url && !fd.isFromPreviousSession) { if (fd.type?.startsWith("image/")) { const w = window.open(fd.url, "_blank"); if (!w) window.location.href = fd.url; } else { const l = document.createElement("a"); l.href = fd.url; l.download = fd.name || "download"; l.target = "_blank"; document.body.appendChild(l); l.click(); document.body.removeChild(l); } }
    else if (fd.isFromPreviousSession) setError({ type: "info", message: `"${fd.name || "File"}" from previous session — unavailable.` });
    else { const fid = fd.file_id || msg?.file_id; if (fid) { const u = cacheChatService.createFileDownloadUrl(fid); const l = document.createElement("a"); l.href = u; l.download = fd.name || "download"; l.target = "_blank"; document.body.appendChild(l); l.click(); document.body.removeChild(l); } else setError({ type: "warning", message: "File not available" }); }
  }, []);

  const syncDot = syncStatus === "connected" ? "#10b981" : syncStatus === "warning" ? "#f59e0b" : syncStatus === "error" ? "#ef4444" : "#94a3b8";
  const activeParticipants = participants.filter(p => p.isActive !== false);
  const availableParticipants = useMemo(() => activeParticipants.filter(p => !p.isHost && p.user_id !== currentUser?.id), [activeParticipants, currentUser?.id]);
  const filteredParticipantsForSelector = useMemo(() => availableParticipants.filter(p => { const dn = p.displayName || p.name || p.full_name || ""; return dn.toLowerCase().includes(recipientSearchTerm.toLowerCase()); }), [availableParticipants, recipientSearchTerm]);
  const filteredEmojis = useMemo(() => {
    const cur = EMOJI_CATEGORIES[selectedEmojiCategory]?.emojis || [];
    if (!emojiSearchTerm.trim()) return cur;
    const sl = emojiSearchTerm.toLowerCase().trim();
    const en = {"😀":"grinning smile happy","😃":"smiley smile happy","😄":"smile happy laugh","😁":"grin beam happy","😆":"laughing happy lol","😅":"sweat smile nervous","😂":"joy laugh crying tears lol","🤣":"rofl rolling laughing","😊":"blush smile happy shy","😇":"angel innocent halo","🙂":"slight smile","🙃":"upside down silly","😉":"wink flirt","😌":"relieved peaceful","😍":"heart eyes love","🥰":"love hearts adore","😘":"kiss blowing love","😗":"kissing","😙":"kissing smiling","😚":"kissing closed eyes","😋":"yummy delicious tongue","😛":"tongue out playful","😝":"tongue squinting","😜":"wink tongue crazy","🤪":"zany crazy wild","🤨":"raised eyebrow suspicious","🧐":"monocle curious","🤓":"nerd glasses geek","😎":"cool sunglasses","🤩":"star struck excited","🥳":"party celebration","😏":"smirk sly","😒":"unamused annoyed","😞":"disappointed sad","😔":"pensive sad","😟":"worried concerned","😕":"confused unsure","🙁":"frown sad","☹️":"frowning sad","😣":"persevere stress","😖":"confounded frustrated","😫":"tired weary","😩":"weary sad frustrated","🥺":"pleading puppy eyes","😢":"crying sad tear","😭":"sobbing crying","😤":"angry huffing","😠":"angry mad","😡":"rage angry furious","🤬":"cursing swearing","🤯":"exploding mind blown","😳":"flushed embarrassed","🥵":"hot sweating","🥶":"cold freezing","😱":"scream fear shock","😨":"fearful scared","😰":"anxious sweat worried","😥":"sad disappointed","😓":"downcast sweat","🤗":"hugging hug warm","❤️":"red heart love","💙":"blue heart love","💚":"green heart love","💛":"yellow heart love","💜":"purple heart love","🖤":"black heart","👍":"thumbs up good","👎":"thumbs down bad","👏":"clap applause","🙏":"pray please thanks","🔥":"fire hot lit","💯":"hundred perfect","✅":"check yes done","❌":"cross no wrong","⭐":"star favorite","🎉":"party tada celebration"};
    const all = Object.values(EMOJI_CATEGORIES).flatMap(c => c.emojis); const matched = [];
    all.forEach(e => { if ((en[e] || "").toLowerCase().includes(sl) && !matched.includes(e)) matched.push(e); });
    return matched;
  }, [emojiSearchTerm, selectedEmojiCategory]);

  if (!actuallyOpen) return null;

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <>
      <input ref={fileInputRef} type="file" multiple accept="*/*" style={{ display: "none" }} onChange={handleFileSelect} />

      <Root>
        {/* ── Header ── */}
        <Head>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
            <Badge badgeContent={unreadCount} color="error" max={99} sx={{ "& .MuiBadge-badge": { fontSize: 9, minWidth: 16, height: 16, borderRadius: 8, fontWeight: 700 } }}>
              <Box sx={{ width: 34, height: 34, borderRadius: 1.5, background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChatIcon sx={{ color: "#fff", fontSize: 17 }} />
              </Box>
            </Badge>
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#0f172a", lineHeight: 1.2, fontFamily: ff }}>Chat</Typography>
                {unreadCount > 0 && <Typography component="span" sx={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "#ef4444", borderRadius: 3, px: 0.6, lineHeight: 1.6, fontFamily: ff }}>{unreadCount} new</Typography>}
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: "2px" }}>
                <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: syncDot, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, fontFamily: ff }}>{participants.length} online</Typography>
              </Box>
            </Box>
          </Box>
          <IconButton onClick={handleClose} size="small" sx={{ width: 28, height: 28, color: "#94a3b8", "&:hover": { background: "#f1f5f9", color: "#1e293b" } }}>
            <Close sx={{ fontSize: 16 }} />
          </IconButton>
        </Head>

        {/* ── Error ── */}
        {error && <Box sx={{ px: 1.5, pt: 0.8 }}><Alert severity={error.type || "error"} onClose={() => setError(null)} sx={{ borderRadius: 2, py: 0.2, "& .MuiAlert-message": { fontSize: 11.5, fontFamily: ff }, "& .MuiAlert-icon": { fontSize: 16, py: 0.4 } }}>{error.message}</Alert></Box>}

        {/* ── Messages ── */}
        <MsgArea ref={chatContainerRef}>
          {isLoading ? (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 1.2, py: 4 }}>
              <CircularProgress size={24} sx={{ color: "#3b82f6" }} />
              <Typography sx={{ fontSize: 12, color: "#94a3b8", fontFamily: ff }}>Connecting…</Typography>
            </Box>
          ) : filteredMessages.length === 0 ? (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", py: 4 }}>
              <ChatIcon sx={{ fontSize: 40, color: "#e2e8f0", mb: 1 }} />
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", fontFamily: ff }}>No messages yet</Typography>
              <Typography sx={{ fontSize: 11, color: "#cbd5e1", mt: 0.3, fontFamily: ff }}>Start the conversation!</Typography>
            </Box>
          ) : (
            <Box sx={{ py: 0.5 }}>
              {filteredMessages.map((message) => {
                if (!message || (!message.id && !message.timestamp)) return null;
                const mk = message.id || `${message.timestamp}_${message.message?.slice(0, 10)}`;
                const mu = String(message.userId || message.user_id || "");
                const cu = String(currentUser?.id || "");
                const own = mu === cu && cu !== "";
                const sender = getMessageSender(message);
                const priv = message.isPrivate === true || message.messageType === "private";
                const isFile = message.messageType === "file" || message.fileData || (message.message && (message.message.includes("📎") || message.message.includes("📷") || message.message.toLowerCase().includes("shared a file") || message.message.toLowerCase().includes("shared an image")));

                return (
                  <Box key={mk} sx={{ mb: 1.2, display: "flex", flexDirection: own ? "row-reverse" : "row", alignItems: "flex-end", gap: 0.8, animation: `${fadeUp} .2s ease-out` }}>
                    {!own && <Avatar sx={{ width: 28, height: 28, fontSize: 10.5, fontWeight: 700, background: getParticipantColor(message.userId), flexShrink: 0 }}>{getInitials(message.userName)}</Avatar>}
                    <Box sx={{ display: "flex", flexDirection: "column", maxWidth: own ? "76%" : "calc(100% - 38px)", alignItems: own ? "flex-end" : "flex-start" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: "2px", flexDirection: own ? "row-reverse" : "row" }}>
                        {!own && <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#475569", fontFamily: ff }}>{sender}</Typography>}
                        {priv && (() => {
                          const recs = message.recipients || []; const sid = String(message.userId || message.user_id || ""); const sn = message.userName || message.user_name || "Someone"; const isSnd = cu !== "" && sid === cu;
                          const lbl = isSnd ? recs.length === 0 ? "Private" : recs.length === 1 ? `To ${(participants.find(p => String(p.user_id || p.id) === String(recs[0])))?.displayName || participants.find(p => String(p.user_id || p.id) === String(recs[0]))?.name || "Participant"}` : `To ${recs.length}` : `From ${sn}`;
                          return <Tag icon={<Lock />} label={lbl} size="small" sx={{ background: isSnd ? (recs.length > 1 ? "#8b5cf6" : "#f59e0b") : "#10b981", color: "#fff" }} />;
                        })()}
                        <Typography sx={{ fontSize: 10, color: "#94a3b8", fontFamily: ff }}>{formatMessageTime(message.timestamp)}</Typography>
                      </Box>
                      <Bub own={own} priv={priv}
                        onClick={isFile ? () => { let fi = message.fileData; if (!fi) fi = extractFileInfoFromMessage(message.message); if (fi) handleFileClick(fi, message); } : undefined}
                        sx={{ cursor: isFile ? "pointer" : "default", "&:hover": isFile ? { transform: "translateY(-1px)", boxShadow: "0 2px 6px rgba(0,0,0,.05)" } : {} }}
                      >
                        {isFile ? (() => {
                          let fi = message.fileData || extractFileInfoFromMessage(message.message);
                          if (!fi) return <Typography sx={{ fontSize: 12.5, lineHeight: 1.55, fontFamily: ff }}>{message.message || ""}</Typography>;
                          return (
                            <Box>
                              {fi.type?.startsWith("image/") && fi.url && !fi.isFromPreviousSession && <Box sx={{ mb: 0.8 }}><img src={fi.url} alt={fi.name} style={{ maxWidth: "100%", maxHeight: 140, borderRadius: 8, display: "block", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} /></Box>}
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <Box sx={{ width: 34, height: 34, borderRadius: 1.5, background: own ? "rgba(255,255,255,.15)" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{fi.isFromPreviousSession ? <InsertDriveFile sx={{ fontSize: 15, color: own ? "rgba(255,255,255,.6)" : "#94a3b8" }} /> : getFileIcon(fi.type)}</Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography noWrap sx={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.3, fontFamily: ff }}>{fi.name}</Typography>
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                    <Typography sx={{ fontSize: 10, color: own ? "rgba(255,255,255,.7)" : "#94a3b8", fontFamily: ff }}>{formatFileSize(fi.size)}</Typography>
                                    <Typography sx={{ fontSize: 9, fontWeight: 700, color: own ? "rgba(255,255,255,.5)" : "#94a3b8", background: own ? "rgba(255,255,255,.1)" : "#f1f5f9", borderRadius: .5, px: 0.5, fontFamily: ff }}>{getFileExtension(fi.name)}</Typography>
                                  </Box>
                                  <Typography sx={{ fontSize: 10, color: fi.isFromPreviousSession ? "#f59e0b" : own ? "rgba(255,255,255,.5)" : "#94a3b8", fontStyle: "italic", fontFamily: ff }}>{fi.isFromPreviousSession ? "Previous session" : "Tap to download"}</Typography>
                                </Box>
                                <GetApp sx={{ fontSize: 15, color: own ? "rgba(255,255,255,.5)" : "#94a3b8" }} />
                              </Box>
                            </Box>
                          );
                        })() : <Typography sx={{ fontSize: 12.5, lineHeight: 1.55, fontFamily: ff }}>{message.message || ""}</Typography>}
                      </Bub>
                    </Box>
                  </Box>
                );
              })}

              {uploadingFiles.map((u, i) => (
                <Box key={u.id || i} sx={{ mb: 1.2, display: "flex", flexDirection: "row-reverse", alignItems: "flex-end", gap: 0.8 }}>
                  <Box sx={{ maxWidth: "76%", background: "rgba(59,130,246,.05)", borderRadius: "14px 14px 3px 14px", border: "1px solid rgba(59,130,246,.1)", p: "8px 10px" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.6 }}>
                      <Box sx={{ width: 30, height: 30, borderRadius: 1.2, background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>{getFileIcon(u.file.type)}</Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}><Typography noWrap sx={{ fontSize: 11.5, fontWeight: 600, color: "#1e293b", fontFamily: ff }}>{u.file.name}</Typography><Typography sx={{ fontSize: 10, color: "#94a3b8", fontFamily: ff }}>{formatFileSize(u.file.size)}</Typography></Box>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ flex: 1, height: 3, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}><Box sx={{ height: "100%", background: "#3b82f6", width: `${u.progress}%`, transition: "width .3s", borderRadius: 2 }} /></Box>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: "#3b82f6", minWidth: 28, textAlign: "right", fontFamily: ff }}>{u.progress}%</Typography>
                    </Box>
                  </Box>
                </Box>
              ))}

              {typingUsers.size > 0 && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mt: 0.5, mb: 1 }}>
                  <Avatar sx={{ width: 22, height: 22, background: "#e2e8f0", fontSize: 10 }}>…</Avatar>
                  <Typography sx={{ fontSize: 11, color: "#94a3b8", fontFamily: ff }}>
                    {Array.from(typingUsers).join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing
                    <Box component="span" sx={{ display: "inline-flex", gap: "2px", ml: 0.5, verticalAlign: "middle" }}>
                      {[0, 1, 2].map(i => <Box key={i} sx={{ width: 3, height: 3, borderRadius: "50%", background: "#94a3b8", animation: `${typingBounce} 1.4s infinite`, animationDelay: `${i * .2}s` }} />)}
                    </Box>
                  </Typography>
                </Box>
              )}
              <div ref={messagesEndRef} />
            </Box>
          )}
        </MsgArea>

        {/* ── Input ── */}
        <InputWrap>
          {!isHost && privateChatEnabled && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.8, px: 0.4 }}>
              <Typography sx={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, fontFamily: ff }}>To:</Typography>
              <Chip icon={<Public sx={{ fontSize: 11 }} />} label="Everyone" size="small" clickable onClick={e => { e.preventDefault(); e.stopPropagation(); setMessageRecipient("everyone"); }}
                sx={{ height: 24, fontSize: 11, fontWeight: 600, fontFamily: ff, background: messageRecipient === "everyone" ? "#10b981" : "#f1f5f9", color: messageRecipient === "everyone" ? "#fff" : "#64748b", "& .MuiChip-icon": { fontSize: 11 }, "&:hover": { background: messageRecipient === "everyone" ? "#059669" : "#e2e8f0" } }} />
              <Chip icon={<Lock sx={{ fontSize: 11 }} />} label="Host" size="small" clickable onClick={e => { e.preventDefault(); e.stopPropagation(); setMessageRecipient("host"); }}
                sx={{ height: 24, fontSize: 11, fontWeight: 600, fontFamily: ff, background: messageRecipient === "host" ? "#f59e0b" : "#f1f5f9", color: messageRecipient === "host" ? "#fff" : "#64748b", "& .MuiChip-icon": { fontSize: 11 }, "&:hover": { background: messageRecipient === "host" ? "#d97706" : "#e2e8f0" } }} />
            </Box>
          )}

          {isHost && (
            <Box sx={{ px: 0.4, mb: 0.8 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                <Typography sx={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, fontFamily: ff }}>To:</Typography>
                <Chip icon={<Public sx={{ fontSize: 11 }} />} label="Everyone" size="small" clickable onClick={handleEveryone}
                  sx={{ height: 24, fontSize: 11, fontWeight: 600, fontFamily: ff, background: messageRecipient === "everyone" ? "#10b981" : "#f1f5f9", color: messageRecipient === "everyone" ? "#fff" : "#64748b", "& .MuiChip-icon": { fontSize: 11 }, "&:hover": { background: messageRecipient === "everyone" ? "#059669" : "#e2e8f0" } }} />
                <Chip icon={showRecipientSelector ? <ExpandLess sx={{ fontSize: 11 }} /> : <People sx={{ fontSize: 11 }} />}
                  label={Array.isArray(messageRecipient) && messageRecipient.length > 0 ? `${messageRecipient.length} sel` : "Select"}
                  size="small" clickable onClick={handleRecipientToggle}
                  sx={{ height: 24, fontSize: 11, fontWeight: 600, fontFamily: ff, background: Array.isArray(messageRecipient) && messageRecipient.length > 0 ? "#8b5cf6" : "#f1f5f9", color: Array.isArray(messageRecipient) && messageRecipient.length > 0 ? "#fff" : "#64748b", "& .MuiChip-icon": { fontSize: 11 }, "&:hover": { background: Array.isArray(messageRecipient) && messageRecipient.length > 0 ? "#7c3aed" : "#e2e8f0" } }} />
              </Box>
              <Collapse in={showRecipientSelector} timeout="auto" unmountOnExit>
                <Box sx={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 2, p: 1.2, mb: 1 }}>
                  <TextField fullWidth size="small" placeholder="Search…" value={recipientSearchTerm} onChange={e => setRecipientSearchTerm(e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 15, color: "#94a3b8" }} /></InputAdornment> }}
                    sx={{ mb: 1, "& .MuiOutlinedInput-root": { borderRadius: 1.5, background: "#fff", fontSize: 11.5, height: 32, fontFamily: ff } }} />
                  <Box sx={{ maxHeight: 130, overflowY: "auto", "&::-webkit-scrollbar": { width: 3 }, "&::-webkit-scrollbar-thumb": { background: "rgba(0,0,0,.08)", borderRadius: 3 } }}>
                    {filteredParticipantsForSelector.length === 0 ? <Typography sx={{ fontSize: 11, color: "#94a3b8", textAlign: "center", py: 1.5, fontFamily: ff }}>No participants</Typography> : (
                      <List dense sx={{ p: 0 }}>
                        {filteredParticipantsForSelector.map(p => { const pid = p.user_id || p.id; const sel = selectedParticipants.includes(pid);
                          return (<ListItem key={pid} button onClick={() => handleSelectParticipant(pid)} sx={{ borderRadius: 1.5, mb: 0.3, py: 0.4, px: 1, background: sel ? "#ede9fe" : "transparent", "&:hover": { background: sel ? "#ddd6fe" : "#f1f5f9" } }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                              <Avatar sx={{ width: 24, height: 24, fontSize: 10, fontWeight: 700, background: getParticipantColor(pid), flexShrink: 0 }}>{getInitials(p.displayName || p.name || p.full_name)}</Avatar>
                              <Typography noWrap sx={{ flex: 1, fontSize: 11.5, fontWeight: 500, color: "#334155", fontFamily: ff }}>{p.displayName || p.name || p.full_name}</Typography>
                              {sel && <CheckCircle sx={{ fontSize: 15, color: "#8b5cf6", flexShrink: 0 }} />}
                            </Box>
                          </ListItem>);
                        })}
                      </List>
                    )}
                  </Box>
                  <Divider sx={{ my: 1, borderColor: "#e2e8f0" }} />
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <Button fullWidth size="small" variant="outlined" onClick={handleCancelSelection} sx={{ textTransform: "none", fontSize: 11, fontWeight: 600, borderColor: "#e2e8f0", color: "#64748b", borderRadius: 1.5, py: 0.3, fontFamily: ff }}>Cancel</Button>
                    <Button fullWidth size="small" variant="contained" onClick={handleApplySelection} disabled={selectedParticipants.length === 0}
                      sx={{ textTransform: "none", fontSize: 11, fontWeight: 600, background: "#8b5cf6", borderRadius: 1.5, py: 0.3, boxShadow: "none", fontFamily: ff, "&:hover": { background: "#7c3aed" }, "&:disabled": { background: "#e2e8f0", color: "#94a3b8" } }}>Apply</Button>
                  </Box>
                </Box>
              </Collapse>
            </Box>
          )}

          {messageRecipient !== "everyone" && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.4, mb: 0.4, px: 0.3 }}>
              <Tag icon={messageRecipient === "host" ? <Lock /> : <People />}
                label={messageRecipient === "host" ? "Host Only" : `${Array.isArray(messageRecipient) ? messageRecipient.length : 0} selected`}
                size="small" sx={{ background: messageRecipient === "host" ? "#f59e0b" : "#8b5cf6", color: "#fff" }} />
            </Box>
          )}

          <Compose>
            <TBtn onClick={handleEmojiToggle}><EmojiEmotions /></TBtn>
            <TBtn onClick={handleFileUpload} disabled={!chatPermissions.canUploadFiles}><AttachFile /></TBtn>
            <TextField ref={inputRef} fullWidth multiline maxRows={3} value={newMessage}
              onChange={e => setNewMessage(e.target.value)} onKeyPress={handleKeyPress}
              placeholder="Type a message…" disabled={!chatPermissions.canSendMessages || !isChatInitialized}
              variant="standard"
              InputProps={{ disableUnderline: true, sx: { fontSize: 12.5, lineHeight: 1.5, color: "#1e293b", fontFamily: ff, "& input, & textarea": { padding: "4px 0" } } }} />
            <SndBtn active={newMessage.trim()} onClick={handleSendMessage} disabled={!newMessage.trim() || !chatPermissions.canSendMessages || !isChatInitialized}>
              {isChatInitialized ? <Send /> : <CircularProgress size={10} />}
            </SndBtn>
          </Compose>
        </InputWrap>

        {/* ── Emoji Picker ── */}
        <Popover open={showEmojiPicker} anchorEl={emojiAnchorEl}
          onClose={() => { setShowEmojiPicker(false); setEmojiAnchorEl(null); setEmojiSearchTerm(""); }}
          anchorOrigin={{ vertical: "top", horizontal: "left" }} transformOrigin={{ vertical: "bottom", horizontal: "left" }}
          disableAutoFocus disableEnforceFocus
          PaperProps={{ sx: { background: "#fff", borderRadius: 2.5, width: 310, height: 340, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,.1)", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column" } }}>
          <Box sx={{ p: 1, borderBottom: "1px solid #f1f5f9" }}>
            <TextField fullWidth size="small" placeholder="Search emoji…" value={emojiSearchTerm} onChange={e => setEmojiSearchTerm(e.target.value)} autoComplete="off"
              InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 15, color: "#94a3b8" }} /></InputAdornment>, endAdornment: emojiSearchTerm && <InputAdornment position="end"><IconButton size="small" onClick={() => setEmojiSearchTerm("")} sx={{ p: 0.3 }}><Close sx={{ fontSize: 13, color: "#94a3b8" }} /></IconButton></InputAdornment> }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, background: "#f8fafc", fontSize: 11.5, height: 32, fontFamily: ff, "& fieldset": { border: "1px solid #e2e8f0" }, "&.Mui-focused fieldset": { borderColor: "#93c5fd" } } }} />
          </Box>
          <Box sx={{ display: "flex", borderBottom: "1px solid #f1f5f9", px: 0.5 }}>
            {Object.entries(EMOJI_CATEGORIES).map(([cat, data]) => (
              <Box key={cat} onClick={() => setSelectedEmojiCategory(cat)} sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", py: 0.6, cursor: "pointer", borderBottom: selectedEmojiCategory === cat ? "2px solid #3b82f6" : "2px solid transparent", "&:hover": { background: "#f8fafc" } }}>
                <Typography sx={{ fontSize: 17, opacity: selectedEmojiCategory === cat ? 1 : .45, transition: "opacity .15s" }}>{data.icon}</Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ flex: 1, overflowY: "auto", p: 0.8 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 0.3 }}>
              {filteredEmojis.length === 0 ? (
                <Box sx={{ gridColumn: "1/-1", display: "flex", flexDirection: "column", alignItems: "center", py: 3 }}>
                  <Typography sx={{ fontSize: 24, mb: 0.5, opacity: .4 }}>🔍</Typography>
                  <Typography sx={{ fontSize: 11, color: "#94a3b8", fontFamily: ff }}>No emoji found</Typography>
                </Box>
              ) : filteredEmojis.map((emoji, i) => (
                <Box key={`${emoji}-${i}`} onClick={() => handleEmojiSelect(emoji)} sx={{ width: 33, height: 33, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, cursor: "pointer", borderRadius: 1.5, transition: "all .1s", "&:hover": { background: "#f1f5f9", transform: "scale(1.15)" }, "&:active": { transform: "scale(.92)" } }}>{emoji}</Box>
              ))}
            </Box>
          </Box>
        </Popover>
      </Root>
    </>
  );
};

export default ChatPanel;