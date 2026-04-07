// src/components/dashboard/Dashboard.jsx - CLEAN LIGHT THEME VERSION
import React, { useState, useEffect,useCallback } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Avatar,
  Chip,
  LinearProgress,
  useTheme,
  Container,
  Fade,
  Slide,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemButton,
  Badge,
  Skeleton,
  Paper,
  Stack,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Grow,
} from "@mui/material";
import {
  VideoCall,
  Schedule,
  CalendarToday,
  History,
  Person,
  MoreVert,
  Add,
  PlayArrow,
  AccessTime,
  Group,
  TrendingUp,
  ArrowForward,
  Help,
  Close,
  EventAvailable,
  Timer,
  Today,
  Upcoming,
  PlayCircleOutline,
  Rocket,
  EmojiEvents,
  LocalFireDepartment,
  CalendarMonth,
  Groups,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useMeeting } from "../../hooks/useMeeting";
import { useAnalytics } from "../../hooks/useAnalytics";
import { useNotifications } from "../../hooks/useNotifications";
import MeetingOptions from "./MeetingOptions";
import MeetingHistory from "./MeetingHistory";
import { analyticsAPI } from '../../services/api';
// Professional Real-time Sun Component
const RealtimeSun = ({ size = 64 }) => {
  const [sunData, setSunData] = useState({
    coreColor: "#FFD700",
    outerColor: "#FFA500",
    glowColor: "rgba(255, 215, 0, 0.6)",
    bgGradient: "rgba(255, 215, 0, 0.08)",
    showMoon: false,
  });

  useEffect(() => {
    const updateSunStyle = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const totalMinutes = hour * 60 + minute;

      const dayStart = 5 * 60;
      const dayEnd = 19 * 60;
      const nightStart = 21 * 60;

      let coreColor,
        outerColor,
        glowColor,
        bgGradient,
        showMoon = false;

      if (totalMinutes < dayStart) {
        showMoon = true;
        coreColor = "#F5F5F5";
        outerColor = "#E8E8E8";
        glowColor = "rgba(200, 200, 200, 0.4)";
        bgGradient = "rgba(100, 100, 150, 0.08)";
      } else if (totalMinutes >= dayStart && totalMinutes < dayEnd) {
        if (totalMinutes < 7 * 60) {
          coreColor = "#FF7F32";
          outerColor = "#FF6B35";
          glowColor = "rgba(255, 127, 50, 0.5)";
          bgGradient = "rgba(255, 127, 50, 0.12)";
        } else if (totalMinutes < 9 * 60) {
          coreColor = "#FF8C42";
          outerColor = "#FF7F32";
          glowColor = "rgba(255, 140, 66, 0.5)";
          bgGradient = "rgba(255, 140, 66, 0.12)";
        } else if (totalMinutes < 11 * 60) {
          coreColor = "#FFA500";
          outerColor = "#FF9500";
          glowColor = "rgba(255, 165, 0, 0.55)";
          bgGradient = "rgba(255, 165, 0, 0.12)";
        } else if (totalMinutes < 13 * 60) {
          coreColor = "#FFD700";
          outerColor = "#FFC700";
          glowColor = "rgba(255, 215, 0, 0.6)";
          bgGradient = "rgba(255, 215, 0, 0.15)";
        } else if (totalMinutes < 15 * 60) {
          coreColor = "#FFED4E";
          outerColor = "#FFD700";
          glowColor = "rgba(255, 237, 78, 0.6)";
          bgGradient = "rgba(255, 237, 78, 0.15)";
        } else if (totalMinutes < 17 * 60) {
          coreColor = "#FFA500";
          outerColor = "#FF9500";
          glowColor = "rgba(255, 165, 0, 0.55)";
          bgGradient = "rgba(255, 165, 0, 0.12)";
        } else {
          coreColor = "#FF6B35";
          outerColor = "#FF5722";
          glowColor = "rgba(255, 107, 53, 0.55)";
          bgGradient = "rgba(255, 107, 53, 0.12)";
        }
      } else if (totalMinutes >= nightStart) {
        showMoon = true;
        coreColor = "#F5F5F5";
        outerColor = "#E8E8E8";
        glowColor = "rgba(200, 200, 200, 0.4)";
        bgGradient = "rgba(100, 100, 150, 0.08)";
      } else {
        const transitionProgress =
          (totalMinutes - dayEnd) / (nightStart - dayEnd);
        coreColor = `rgb(${Math.floor(
          255 - 110 * transitionProgress
        )}, ${Math.floor(107 + 93 * transitionProgress)}, ${Math.floor(
          53 + 147 * transitionProgress
        )})`;
        outerColor = `rgb(${Math.floor(
          255 - 150 * transitionProgress
        )}, ${Math.floor(87 + 113 * transitionProgress)}, ${Math.floor(
          34 + 166 * transitionProgress
        )})`;
        glowColor = `rgba(${Math.floor(
          255 - 110 * transitionProgress
        )}, ${Math.floor(107 + 93 * transitionProgress)}, ${Math.floor(
          53 + 147 * transitionProgress
        )}, 0.5)`;
        bgGradient = `rgba(${Math.floor(
          255 - 110 * transitionProgress
        )}, ${Math.floor(107 + 93 * transitionProgress)}, ${Math.floor(
          53 + 147 * transitionProgress
        )}, 0.12)`;
      }

      setSunData({ coreColor, outerColor, glowColor, bgGradient, showMoon });
    };

    updateSunStyle();
    const interval = setInterval(updateSunStyle, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box
      sx={{
        width: size,
        height: size,
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "wave 1s ease-in-out infinite",
        animationDelay: "2s",
        transformOrigin: "center",
        "@keyframes wave": {
          "0%": { transform: "rotate(0deg)" },
          "10%": { transform: "rotate(14deg)" },
          "20%": { transform: "rotate(-8deg)" },
          "30%": { transform: "rotate(14deg)" },
          "40%": { transform: "rotate(-4deg)" },
          "50%": { transform: "rotate(10deg)" },
          "60%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(0deg)" },
        },
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{
          display: "block",
          filter: `drop-shadow(0 0 16px ${sunData.glowColor})`,
        }}
      >
        <defs>
          <radialGradient id="sunGradient" cx="35%" cy="35%">
            <stop offset="0%" stopColor={sunData.coreColor} />
            <stop offset="60%" stopColor={sunData.outerColor} />
            <stop offset="100%" stopColor={sunData.coreColor} opacity="0.3" />
          </radialGradient>
          <filter id="glowFilter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle
          cx="50"
          cy="50"
          r="28"
          fill={sunData.bgGradient}
          opacity="0.5"
        />
        <circle
          cx="50"
          cy="50"
          r="24"
          fill={sunData.bgGradient}
          opacity="0.3"
        />

        {sunData.showMoon ? (
          <>
            <circle
              cx="50"
              cy="50"
              r="18"
              fill="url(#sunGradient)"
              filter="url(#glowFilter)"
            />
            <circle
              cx="50"
              cy="50"
              r="18"
              fill="none"
              stroke={sunData.outerColor}
              strokeWidth="0.8"
              opacity="0.3"
            />
            <circle
              cx="44"
              cy="46"
              r="1.5"
              fill={sunData.outerColor}
              opacity="0.4"
            />
            <circle
              cx="54"
              cy="52"
              r="1"
              fill={sunData.outerColor}
              opacity="0.3"
            />
            <circle
              cx="49"
              cy="58"
              r="1.2"
              fill={sunData.outerColor}
              opacity="0.35"
            />
          </>
        ) : (
          <>
            <circle
              cx="50"
              cy="50"
              r="12"
              fill={sunData.coreColor}
              opacity="0.9"
            />
            <circle
              cx="50"
              cy="50"
              r="18"
              fill="url(#sunGradient)"
              filter="url(#glowFilter)"
            />
            <g
              stroke={sunData.coreColor}
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.7"
            >
              <line x1="50" y1="24" x2="50" y2="14" />
              <line x1="61.24" y1="28.76" x2="68.36" y2="21.64" />
              <line x1="76" y1="50" x2="86" y2="50" />
              <line x1="61.24" y1="71.24" x2="68.36" y2="78.36" />
              <line x1="50" y1="76" x2="50" y2="86" />
              <line x1="38.76" y1="71.24" x2="31.64" y2="78.36" />
              <line x1="24" y1="50" x2="14" y2="50" />
              <line x1="38.76" y1="28.76" x2="31.64" y2="21.64" />
            </g>
            <ellipse
              cx="46"
              cy="44"
              rx="8"
              ry="8"
              fill="white"
              opacity="0.15"
              filter="url(#glowFilter)"
            />
          </>
        )}
      </svg>
    </Box>
  );
};

// Typing Animation Component
const TypingAnimation = ({ text, speed = 80, delay = 1500 }) => {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    setDisplayedText("");
    setCurrentIndex(0);
    setShowCursor(true);
    setAnimationKey((prev) => prev + 1);
  }, [text]);

  useEffect(() => {
    if (!text) return;

    if (currentIndex === 0 && animationKey > 0) {
      const startTimer = setTimeout(() => {
        setCurrentIndex(1);
        setDisplayedText(text.charAt(0));
      }, delay);
      return () => clearTimeout(startTimer);
    }

    if (currentIndex > 0 && currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.substring(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, speed);
      return () => clearTimeout(timer);
    }

    if (currentIndex >= text.length && text.length > 0) {
      const restartTimer = setTimeout(() => {
        setDisplayedText("");
        setCurrentIndex(0);
        setShowCursor(true);
        setAnimationKey((prev) => prev + 1);
      }, 3000);
      return () => clearTimeout(restartTimer);
    }
  }, [text, currentIndex, speed, delay, animationKey]);

  useEffect(() => {
    const cursorTimer = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(cursorTimer);
  }, []);

  return (
    <Box component="span" sx={{ position: "relative" }}>
      {displayedText}
      <Box
        component="span"
        sx={{
          display: "inline-block",
          width: "2px",
          height: "1.2em",
          backgroundColor: "currentColor",
          marginLeft: "2px",
          verticalAlign: "text-top",
          opacity: showCursor ? 1 : 0,
          animation: "blink 1.06s infinite",
          "@keyframes blink": {
            "0%, 50%": { opacity: 1 },
            "51%, 100%": { opacity: 0 },
          },
        }}
      />
    </Box>
  );
};

// Quick Stats Card Component
const QuickStatCard = ({ icon, title, value, subtitle, color, trend }) => {
  return (
    <Grow in timeout={800}>
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: 3,
          border: "1px solid #E5E7EB",
          backgroundColor: "white",
          transition: "all 0.3s ease",
          cursor: "pointer",
          "&:hover": {
            transform: "translateY(-4px)",
            boxShadow: `0 12px 24px ${color}20`,
            borderColor: color,
          },
        }}
      >
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              backgroundColor: `${color}15`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: color,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="caption"
              sx={{
                color: "#6B7280",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                fontSize: "0.7rem",
              }}
            >
              {title}
            </Typography>
            <Stack direction="row" alignItems="baseline" spacing={1}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  color: "#1F2937",
                  lineHeight: 1.2,
                }}
              >
                {value}
              </Typography>
              {trend && (
                <Chip
                  size="small"
                  icon={<TrendingUp sx={{ fontSize: 14 }} />}
                  label={trend}
                  sx={{
                    height: 20,
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    backgroundColor: "#10B98120",
                    color: "#10B981",
                    "& .MuiChip-icon": { color: "#10B981" },
                  }}
                />
              )}
            </Stack>
            <Typography
              variant="caption"
              sx={{
                color: "#9CA3AF",
                fontSize: "0.75rem",
              }}
            >
              {subtitle}
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Grow>
  );
};

// Upcoming Meeting Card Component
// Upcoming Meeting Card Component
const UpcomingMeetingCard = ({ meeting, onJoin }) => {
  const getTimeUntil = (dateString) => {
    const meetingTime = new Date(dateString);
    const now = new Date();
    const diff = meetingTime - now;

    if (diff < 0) return "Started";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `In ${days} day${days > 1 ? "s" : ""}`;
    }
    if (hours > 0) return `In ${hours}h ${minutes}m`;
    return `In ${minutes}m`;
  };

  const isStartingSoon = () => {
    const meetingTime = new Date(meeting.scheduled_time || meeting.start_time);
    const now = new Date();
    const diff = meetingTime - now;
    return diff > 0 && diff < 15 * 60 * 1000;
  };

  // Determine meeting type for icon/color
  const isCalendarMeeting = meeting.meeting_type === "CalendarMeeting";

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: isStartingSoon() ? "#10B981" : "#E5E7EB",
        backgroundColor: isStartingSoon()
          ? "rgba(16, 185, 129, 0.05)"
          : "white",
        transition: "all 0.2s ease",
        "&:hover": {
          borderColor: "#2D7DD2",
          transform: "translateX(4px)",
        },
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 1.5,
            backgroundColor: isStartingSoon()
              ? "#10B98120"
              : isCalendarMeeting
              ? "#8B5CF620"
              : "#2D7DD220",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: isStartingSoon()
              ? "#10B981"
              : isCalendarMeeting
              ? "#8B5CF6"
              : "#2D7DD2",
          }}
        >
          {isStartingSoon() ? (
            <PlayCircleOutline />
          ) : isCalendarMeeting ? (
            <CalendarMonth />
          ) : (
            <EventAvailable />
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                color: "#1F2937",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {meeting.title || "Untitled Meeting"}
            </Typography>
            {isCalendarMeeting && (
              <Chip
                label="Calendar"
                size="small"
                sx={{
                  height: 16,
                  fontSize: "0.6rem",
                  backgroundColor: "#8B5CF620",
                  color: "#8B5CF6",
                  "& .MuiChip-label": { px: 0.5 },
                }}
              />
            )}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <AccessTime sx={{ fontSize: 14, color: "#9CA3AF" }} />
            <Typography variant="caption" sx={{ color: "#6B7280" }}>
              {getTimeUntil(meeting.scheduled_time || meeting.start_time)}
            </Typography>
            {meeting.participants_count > 0 && (
              <>
                <Groups sx={{ fontSize: 14, color: "#9CA3AF", ml: 1 }} />
                <Typography variant="caption" sx={{ color: "#6B7280" }}>
                  {meeting.participants_count}
                </Typography>
              </>
            )}
          </Stack>
        </Box>
        {isStartingSoon() && (
          <Button
            size="small"
            variant="contained"
            onClick={() => onJoin(meeting.meeting_id)}
            sx={{
              backgroundColor: "#10B981",
              textTransform: "none",
              fontWeight: 600,
              px: 2,
              "&:hover": {
                backgroundColor: "#059669",
              },
            }}
          >
            Join
          </Button>
        )}
      </Stack>
    </Paper>
  );
};

// Help/Tutorial Dialog Component
const HelpTutorialDialog = ({ open, onClose }) => {
  const [activeStep, setActiveStep] = useState(0);

  const tutorialSteps = [
    {
      label: "Start an Instant Meeting",
      description:
        'Click "Start Now" to begin a meeting immediately. Share the link with participants to let them join.',
      icon: <VideoCall sx={{ fontSize: 40, color: "#1A8A8A" }} />,
    },
    {
      label: "Schedule a Meeting",
      description:
        'Plan meetings in advance by clicking "Schedule". Set date, time, and send invitations automatically.',
      icon: <Schedule sx={{ fontSize: 40, color: "#2D7DD2" }} />,
    },
    {
      label: "Calendar Integration",
      description:
        "Sync with your calendar to manage meetings seamlessly. Auto-invites and availability checking included.",
      icon: <CalendarMonth sx={{ fontSize: 40, color: "#1A8A8A" }} />,
    },
    {
      label: "Join a Meeting",
      description:
        "Enter a meeting ID or paste a meeting link in the Quick Actions section to join any meeting.",
      icon: <Group sx={{ fontSize: 40, color: "#2D7DD2" }} />,
    },
    {
      label: "View Recordings",
      description:
        "Access all your meeting recordings from the sidebar. Filter by meeting type for easy navigation.",
      icon: <PlayArrow sx={{ fontSize: 40, color: "#1A8A8A" }} />,
    },
  ];

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          backgroundColor: "white",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #E5E7EB",
          color: "#1F2937",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              background: "linear-gradient(135deg, #1A8A8A 0%, #2D7DD2 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Rocket sx={{ color: "white", fontSize: 22 }} />
          </Box>
          <Typography variant="h6" fontWeight={600}>
            Getting Started Guide
          </Typography>
        </Stack>
        <IconButton onClick={onClose} sx={{ color: "#6B7280" }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {tutorialSteps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel
                StepIconProps={{
                  sx: {
                    "&.Mui-active": { color: "#1A8A8A" },
                    "&.Mui-completed": { color: "#10B981" },
                  },
                }}
              >
                <Typography
                  variant="subtitle1"
                  fontWeight={600}
                  sx={{ color: "#1F2937" }}
                >
                  {step.label}
                </Typography>
              </StepLabel>
              <StepContent>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 2,
                    mb: 2,
                  }}
                >
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: "#F3F4F6",
                    }}
                  >
                    {step.icon}
                  </Box>
                  <Typography variant="body2" sx={{ color: "#6B7280", pt: 1 }}>
                    {step.description}
                  </Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    size="small"
                    sx={{
                      mr: 1,
                      textTransform: "none",
                      backgroundColor: "#1A8A8A",
                      "&:hover": { backgroundColor: "#157575" },
                    }}
                  >
                    {index === tutorialSteps.length - 1 ? "Finish" : "Continue"}
                  </Button>
                  <Button
                    disabled={index === 0}
                    onClick={handleBack}
                    size="small"
                    sx={{ textTransform: "none", color: "#6B7280" }}
                  >
                    Back
                  </Button>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
        {activeStep === tutorialSteps.length && (
          <Paper
            elevation={0}
            sx={{
              p: 3,
              textAlign: "center",
              backgroundColor: "rgba(16, 185, 129, 0.05)",
              borderRadius: 2,
              border: "1px solid rgba(16, 185, 129, 0.2)",
            }}
          >
            <EmojiEvents sx={{ fontSize: 48, color: "#10B981", mb: 1 }} />
            <Typography variant="h6" sx={{ color: "#1F2937", fontWeight: 600 }}>
              You're all set!
            </Typography>
            <Typography variant="body2" sx={{ color: "#6B7280", mb: 2 }}>
              Start your first meeting or explore more features.
            </Typography>
            <Button
              onClick={handleReset}
              size="small"
              sx={{ textTransform: "none", color: "#1A8A8A" }}
            >
              View Again
            </Button>
          </Paper>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: "1px solid #E5E7EB" }}>
        <Button
          onClick={onClose}
          sx={{ textTransform: "none", color: "#6B7280" }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Main Dashboard Component
const Dashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    recentMeetings,
    upcomingMeetings,
    joinMeeting,
    loading: meetingLoading,
    loadUpcomingMeetings,
  } = useMeeting();
  const { getDashboardQuickStats,getUserStats, loading: analyticsLoading } = useAnalytics();
  const { fetchNotifications } = useNotifications();

  // State
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [userStats, setUserStats] = useState({
  totalMeetings: 0,
  totalMinutes: 0,
  attendance: 0,
  upcomingCount: 0,
  meetingsThisWeek: 0,
  hoursThisWeek: 0,
  timeDisplay: '0m',
  hosted: 0,
  percentageChange: 0,
});

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Reload upcoming meetings when component mounts
  useEffect(() => {
    if (typeof loadUpcomingMeetings === "function") {
      console.log("📅 Dashboard: Loading upcoming meetings...");
      loadUpcomingMeetings();
    }
  }, []);

// ✅ FIXED: Load user stats with fallback to upcomingMeetings
const loadUserStats = useCallback(async () => {
  // Double-check user is available
  if (!user?.id) {
    console.log("📊 Dashboard: No user ID, skipping stats load");
    return;
  }

  try {
    console.log("📊 Dashboard: Loading quick stats for user:", user.id);
    
    const response = await getDashboardQuickStats();
    
    console.log("📊 Dashboard: Quick stats received:", response);

    // Only update if we got valid response
    if (response && typeof response === 'object') {
      // ✅ FIXED: Extract from nested quick_stats structure
      const quickStats = response.quick_stats || response;
      
      // Extract values from nested structure
      const meetingsThisWeek = quickStats.this_week?.meetings_attended ?? 
                               quickStats.meetingsThisWeek ?? 0;
      const hoursThisWeek = quickStats.hours?.total_hours ?? 
                           quickStats.hoursThisWeek ?? 0;
      const timeDisplay = quickStats.hours?.display ?? 
                         quickStats.timeDisplay ?? 
                         `${hoursThisWeek}h`;
      let upcomingCount = quickStats.upcoming?.count ?? 
                          quickStats.upcomingCount ?? 0;
      const hosted = quickStats.hosted?.count ?? 
                    quickStats.hosted ?? 0;
      const percentageChange = quickStats.this_week?.percentage_change ?? 
                              quickStats.percentageChange ?? 0;
      const totalMinutes = quickStats.hours?.total_minutes ?? 
                          quickStats.totalMinutes ?? 0;

      // ✅ CRITICAL FIX: If backend returns 0 but upcomingMeetings has data, use that
      if (upcomingCount === 0 && upcomingMeetings?.length > 0) {
        console.log("📊 Dashboard: Backend returned 0, using upcomingMeetings count:", upcomingMeetings.length);
        upcomingCount = upcomingMeetings.length;
      }

      console.log("📊 Dashboard: Final mapped stats:", {
        meetingsThisWeek,
        hoursThisWeek,
        timeDisplay,
        upcomingCount,
        hosted,
        percentageChange
      });

      setUserStats({
        meetingsThisWeek,
        hoursThisWeek,
        timeDisplay,
        upcomingCount,
        hosted,
        percentageChange,
        totalMeetings: meetingsThisWeek,
        totalMinutes,
        attendance: 0,
      });
    }
  } catch (error) {
    console.error("❌ Dashboard: Failed to load user stats:", error);
    
    // ✅ FALLBACK: If API fails, use upcomingMeetings data
    setUserStats({
      totalMeetings: 0,
      totalMinutes: 0,
      attendance: 0,
      upcomingCount: upcomingMeetings?.length || 0,
      meetingsThisWeek: 0,
      hoursThisWeek: 0,
      timeDisplay: '0m',
      hosted: 0,
      percentageChange: 0,
    });
  }
}, [user?.id, getDashboardQuickStats, upcomingMeetings]);

// ✅ FIXED: Trigger stats load when user becomes available
useEffect(() => {
  if (user?.id) {
    console.log("📊 Dashboard: User detected, triggering stats load for:", user.id);
    loadUserStats();
  }
}, [user?.id, loadUserStats]);

// ✅ NEW: Update stats when upcomingMeetings changes
useEffect(() => {
  if (upcomingMeetings?.length > 0 && userStats.upcomingCount === 0) {
    console.log("📊 Dashboard: Upcoming meetings loaded, updating count:", upcomingMeetings.length);
    setUserStats(prev => ({
      ...prev,
      upcomingCount: upcomingMeetings.length
    }));
  }
}, [upcomingMeetings, userStats.upcomingCount]);

  const handleJoinMeeting = async (meetingId) => {
    try {
      await joinMeeting(meetingId);
      navigate(`/meeting/${meetingId}`);
    } catch (error) {
      console.error("Failed to join meeting:", error);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const getUserName = () => {
    return user?.full_name?.split(" ")[0] || "User";
  };

  // Use real upcoming meetings data only
  // Use real upcoming meetings data only (Schedule + Calendar meetings)
  // Use real upcoming meetings data only (Schedule + Calendar meetings)
  const displayUpcomingMeetings =
    upcomingMeetings?.length > 0
      ? upcomingMeetings.map((meeting) => ({
          meeting_id:
            meeting.ID ||
            meeting.Meeting_ID ||
            meeting.id ||
            meeting.meeting_id,
          title:
            meeting.Meeting_Name ||
            meeting.Title ||
            meeting.title ||
            "Untitled Meeting",
          scheduled_time:
            meeting.Started_At || meeting.start_time || meeting.scheduled_time,
          participants_count:
            meeting.participants_count || meeting.participant_count || 0,
          meeting_type:
            meeting.Meeting_Type || meeting.meeting_type || "Meeting",
          source: meeting.source || "unknown",
        }))
      : [];

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #F0F9F9 0%, #EBF4FC 50%, #F5F7FA 100%)",
        pt: 3,
        pb: 6,
      }}
    >
      <Container maxWidth="xl">
        {/* Header Section */}
        <Fade in timeout={800}>
          <Box mb={4}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="flex-start"
            >
              <Box>
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
                >
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 600,
                      color: "#1F2937",
                      fontSize: { xs: "1.75rem", md: "2.125rem" },
                    }}
                  >
                    {getGreeting()},{" "}
                    <TypingAnimation
                      text={getUserName()}
                      speed={120}
                      delay={800}
                    />
                  </Typography>
                  <RealtimeSun size={56} />
                </Box>
                <Typography
                  variant="body1"
                  sx={{
                    color: "#6B7280",
                    fontSize: "1rem",
                    maxWidth: "600px",
                  }}
                >
                  Manage your meetings efficiently and stay connected with your
                  team.
                </Typography>
              </Box>

              {/* Help Button */}
              <Tooltip title="Getting Started Guide">
                <IconButton
                  onClick={() => setHelpDialogOpen(true)}
                  sx={{
                    backgroundColor: "white",
                    border: "1px solid #E5E7EB",
                    color: "#6B7280",
                    "&:hover": {
                      backgroundColor: "#F3F4F6",
                    },
                  }}
                >
                  <Help />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
        </Fade>

        {/* Quick Stats Section */}
        <Fade in timeout={1000}>
          <Box mb={4}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                color: "#1F2937",
                mb: 2,
                display: "flex",
                alignItems: "center",
                gap: 1,
                "&::before": {
                  content: '""',
                  width: "4px",
                  height: "20px",
                  background:
                    "linear-gradient(180deg, #1A8A8A 0%, #2D7DD2 100%)",
                  borderRadius: "2px",
                },
              }}
            >
              Quick Stats
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={6} md={3}>
                <QuickStatCard
                  icon={<Today sx={{ fontSize: 24 }} />}
                  title="This Week"
                  value={userStats.meetingsThisWeek}
                  subtitle="Meetings attended"
                  color="#1A8A8A"
                  trend={userStats.percentageChange !== 0 ? `${userStats.percentageChange > 0 ? '+' : ''}${userStats.percentageChange}%` : null}
                />
              </Grid>
             <Grid item xs={6} sm={6} md={3}>
  <QuickStatCard
    icon={<Timer sx={{ fontSize: 24 }} />}
    title="Time"
    value={userStats.timeDisplay}
    subtitle="Total this week"
    color="#2D7DD2"
  />
</Grid>
              <Grid item xs={6} sm={6} md={3}>
                <QuickStatCard
                  icon={<Upcoming sx={{ fontSize: 24 }} />}
                  title="Upcoming"
                  value={userStats.upcomingCount}
                  subtitle="Scheduled meetings"
                  color="#8B5CF6"
                />
              </Grid>
              <Grid item xs={6} sm={6} md={3}>
                <QuickStatCard
                  icon={<Person sx={{ fontSize: 24 }} />}
                  title="Hosted"
                  value={userStats.hosted}
                  subtitle="Meetings you hosted"
                  color="#F59E0B"
                />
              </Grid>
            </Grid>
          </Box>
        </Fade>

        <Grid container spacing={3}>
          {/* Main Meeting Actions */}
          <Grid item xs={12} lg={8}>
            <Slide direction="up" in timeout={1200}>
              <Paper
                elevation={0}
                sx={{
                  borderRadius: 3,
                  border: "1px solid #E5E7EB",
                  backgroundColor: "white",
                  overflow: "hidden",
                }}
              >
                <Box sx={{ p: 4 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 600,
                      color: "#1F2937",
                      mb: 3,
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      "&::before": {
                        content: '""',
                        width: "4px",
                        height: "24px",
                        background:
                          "linear-gradient(180deg, #1A8A8A 0%, #2D7DD2 100%)",
                        borderRadius: "2px",
                      },
                    }}
                  >
                    Meeting Actions
                  </Typography>

                  <MeetingOptions />
                </Box>
              </Paper>
            </Slide>
          </Grid>

          {/* Upcoming Meetings Sidebar */}
          <Grid item xs={12} lg={4}>
            <Slide direction="left" in timeout={1400}>
              <Paper
                elevation={0}
                sx={{
                  borderRadius: 3,
                  border: "1px solid #E5E7EB",
                  backgroundColor: "white",
                  overflow: "hidden",
                  height: "100%",
                }}
              >
                <Box sx={{ p: 3 }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={2}
                  >
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        color: "#1F2937",
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        "&::before": {
                          content: '""',
                          width: "4px",
                          height: "20px",
                          background:
                            "linear-gradient(180deg, #1A8A8A 0%, #2D7DD2 100%)",
                          borderRadius: "2px",
                        },
                      }}
                    >
                      Upcoming Meetings
                    </Typography>
                  </Stack>

                  <Stack spacing={1.5}>
                    {displayUpcomingMeetings
                      .slice(0, 4)
                      .map((meeting, index) => (
                        <UpcomingMeetingCard
                          key={meeting.meeting_id || index}
                          meeting={meeting}
                          onJoin={handleJoinMeeting}
                        />
                      ))}
                  </Stack>

                  {displayUpcomingMeetings.length === 0 && (
                    <Box sx={{ textAlign: "center", py: 4, color: "#6B7280" }}>
                      <EventAvailable
                        sx={{ fontSize: 48, opacity: 0.5, mb: 1 }}
                      />
                      <Typography variant="body2">
                        No upcoming meetings
                      </Typography>
                    
                    </Box>
                  )}
                </Box>
              </Paper>
            </Slide>
          </Grid>

          {/* Recent Meetings */}
          <Grid item xs={12}>
            <MeetingHistory
              meetings={recentMeetings}
              loading={meetingLoading}
              limit={5}
            />
          </Grid>
        </Grid>
      </Container>

      {/* Help Tutorial Dialog */}
      <HelpTutorialDialog
        open={helpDialogOpen}
        onClose={() => setHelpDialogOpen(false)}
      />
    </Box>
  );
};

export default Dashboard;