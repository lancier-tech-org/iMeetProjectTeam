// ENHANCED: CalendarPage.jsx - Teal-Blue Theme Version

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Button,
  IconButton,
  Stack,
  useTheme,
  alpha,
  Dialog,
  Alert,
  Card,
  CardContent,
  Chip,
  Avatar,
  useMediaQuery,
  Tabs,
  Tab,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Paper,
} from "@mui/material";
import {
  CalendarToday as CalendarIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Group as GroupIcon,
  Warning as WarningIcon,
  EventAvailable as EventAvailableIcon,
  AddCircleOutline as AddCircleOutlineIcon,
  ViewList as ViewListIcon,
  AccessTime as AccessTimeIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import {
  format,
  addMonths,
  subMonths,
  addDays,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameDay,
  isSameMonth,
  isToday,
  isAfter,
  startOfDay,
} from "date-fns";
import DashboardLayout from "../layouts/DashboardLayout";
import CalendarMeeting from "../components/meeting/CalendarMeeting";
import MonthWeekDayView from "../components/calendar/MonthWeekDayView";
import { useCalendar } from "../hooks/useCalendar";
import { useAuth } from "../hooks/useAuth";
import BackButton from "../components/common/BackButton";
import { useNotifications } from "../hooks/useNotifications";

// Teal-Blue Theme Colors
const themeColors = {
  teal: '#1A8A8A',
  blue: '#2D7DD2',
  deepBlue: '#3B5998',
  amber: '#F59E0B',
  green: '#10B981',
  red: '#EF4444',
  purple: '#8B5CF6',
  grey: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
  text: {
    primary: '#1F2937',
    secondary: '#6B7280',
    disabled: '#9CA3AF',
  }
};

const CalendarPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isTablet = useMediaQuery(theme.breakpoints.down("lg"));
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month");
  const [selectedDate, setSelectedDate] = useState(null);
  const [createMeetingOpen, setCreateMeetingOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [clickedCalendarDate, setClickedCalendarDate] = useState(null);
  const [sideCardTab, setSideCardTab] = useState(0);
  const [dateActionDialog, setDateActionDialog] = useState({
    open: false,
    date: null,
    meetings: [],
  });

  const isOperatingRef = useRef(false);
  const lastUpdateTimeRef = useRef(Date.now());
  const isUpdatingRef = useRef(false);

  const {
    events: meetings,
    loading,
    error,
    createEvent,
    updateEvent,
    loadCalendarData,
    clearError,
  } = useCalendar();

  const { notifications, fetchCalendarNotifications } = useNotifications();

  const debouncedLoadData = useCallback(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;

    if (timeSinceLastUpdate < 1000) {
      console.log("⚠️ Skipping load - too frequent");
      return;
    }

    lastUpdateTimeRef.current = now;

    if (!isOperatingRef.current && user?.id) {
      loadCalendarData();
    }
  }, [loadCalendarData, user?.id]);

  useEffect(() => {
    let mounted = true;
    let timeoutId;

    const loadData = () => {
      if (mounted && user?.id && !isOperatingRef.current) {
        timeoutId = setTimeout(() => {
          if (mounted) {
            debouncedLoadData();
          }
        }, 100);
      }
    };

    loadData();

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [currentDate, view, user?.id, debouncedLoadData]);

  useEffect(() => {
    if (error) {
      clearError();
    }
  }, [error, clearError]);

  useEffect(() => {
    console.log("📆 Calendar Page: Fetching CALENDAR notifications only");
    fetchCalendarNotifications();
  }, [fetchCalendarNotifications]);

  const transformMeetingsForView = useMemo(() => {
    if (!meetings || !Array.isArray(meetings)) {
      console.log("No meetings array available");
      return [];
    }

    console.log("Raw meetings from useCalendar:", meetings.length);

    const uniqueById = [];
    const seenIds = new Set();
    meetings.forEach((meeting) => {
      const meetingId = String(
        meeting.ID ||
          meeting.id ||
          meeting.Meeting_ID ||
          meeting.meeting_id ||
          ""
      ).trim();

      if (!meetingId) return;

      if (seenIds.has(meetingId)) {
        console.log(
          "♻️ Replacing duplicate meeting ID with latest:",
          meetingId
        );
        const index = uniqueById.findIndex(
          (m) =>
            String(m.ID || m.id || m.Meeting_ID || m.meeting_id) === meetingId
        );
        if (index !== -1) uniqueById[index] = meeting;
      } else {
        seenIds.add(meetingId);
        uniqueById.push(meeting);
      }
    });

    const uniqueByTitleDate = [];
    const seenTitleDates = new Set();

    uniqueById.forEach((meeting) => {
      const meetingId = String(
        meeting.ID ||
          meeting.id ||
          meeting.Meeting_ID ||
          meeting.meeting_id ||
          ""
      ).trim();

      if (!meetingId) return;

      if (seenTitleDates.has(meetingId)) {
        const index = uniqueByTitleDate.findIndex(
          (m) =>
            String(m.ID || m.id || m.Meeting_ID || m.meeting_id).trim() ===
            meetingId
        );
        if (index !== -1) uniqueByTitleDate[index] = meeting;
      } else {
        seenTitleDates.add(meetingId);
        uniqueByTitleDate.push(meeting);
      }
    });

    console.log(
      `✅ Deduplication: ${meetings.length} → ${uniqueById.length} → ${uniqueByTitleDate.length}`
    );

    const transformedMeetings = uniqueByTitleDate.map((meeting) => {
      let participantEmails =
        meeting.participantEmails ||
        meeting.guest_emails ||
        meeting.guestEmails ||
        meeting.attendee_emails ||
        meeting.attendees ||
        [];

      if (typeof participantEmails === "string") {
        try {
          participantEmails = JSON.parse(participantEmails);
        } catch (e) {
          participantEmails = participantEmails.split(",").map((e) => e.trim());
        }
      }

      if (!Array.isArray(participantEmails)) {
        participantEmails = [];
      }

      return {
        id: meeting.ID || meeting.id || meeting.Meeting_ID,
        title: meeting.title || meeting.Meeting_Name || "Untitled Meeting",
        startTime: meeting.start_time || meeting.startTime,
        endTime: meeting.end_time || meeting.endTime,
        organizer:
          meeting.host || meeting.Host_ID || meeting.email || "Unknown",
        meetingUrl:
          meeting.meeting_url || meeting.meetingUrl || meeting.Meeting_Link,
        location: meeting.location || "",
        participantEmails,
        participants: Array.isArray(participantEmails)
          ? participantEmails.length
          : 0,
        color: themeColors.blue,
        type: meeting.type || "calendar",
        status: meeting.status || meeting.Status || "scheduled",
        description: meeting.description || "",
        ...meeting,
      };
    });

    console.log("✅ Final transformed meetings:", transformedMeetings.length);
    return transformedMeetings;
  }, [meetings]);

  const todaysMeetings = useMemo(() => {
    const today = new Date();
    return transformMeetingsForView
      .filter((meeting) => {
        if (!meeting.startTime) return false;
        const meetingDate = new Date(meeting.startTime);
        return isSameDay(meetingDate, today);
      })
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  }, [transformMeetingsForView]);

  const upcomingMeetings = useMemo(() => {
    const today = startOfDay(new Date());
    return transformMeetingsForView
      .filter((meeting) => {
        if (!meeting.startTime) return false;
        const meetingDate = new Date(meeting.startTime);
        const meetingDayStart = startOfDay(meetingDate);
        return isAfter(meetingDayStart, today);
      })
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
      .slice(0, 10);
  }, [transformMeetingsForView]);

  const getMeetingsForDate = useCallback(
    (date) => {
      return transformMeetingsForView.filter((meeting) => {
        if (!meeting.startTime) return false;
        const meetingDate = new Date(meeting.startTime);
        return isSameDay(meetingDate, date);
      });
    },
    [transformMeetingsForView]
  );

  const handlePrevious = useCallback(() => {
    if (view === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (view === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, -1));
    }
  }, [currentDate, view]);

  const handleNext = useCallback(() => {
    if (view === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (view === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, 1));
    }
  }, [currentDate, view]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const handleDateClick = useCallback((date) => {
    console.log("Calendar date clicked:", date);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateOnly = new Date(date);
    selectedDateOnly.setHours(0, 0, 0, 0);

    if (selectedDateOnly < today) {
      console.log("Cannot select past dates");
      return;
    }

    const dateMeetings = transformMeetingsForView.filter((meeting) => {
      if (!meeting.startTime) return false;
      const meetingDate = new Date(meeting.startTime);
      return isSameDay(meetingDate, date);
    });

    setDateActionDialog({
      open: true,
      date: date,
      meetings: dateMeetings,
    });
  }, [transformMeetingsForView]);

  const handleCloseDateActionDialog = useCallback(() => {
    setDateActionDialog({
      open: false,
      date: null,
      meetings: [],
    });
  }, []);

  const handleCreateMeetingFromDialog = useCallback(() => {
    const date = dateActionDialog.date;
    setClickedCalendarDate(date);
    setSelectedDate(date);
    setEditingMeeting(null);
    setCreateMeetingOpen(true);
    handleCloseDateActionDialog();
  }, [dateActionDialog.date, handleCloseDateActionDialog]);

  const handleEditMeeting = useCallback((meeting) => {
    console.log("Editing meeting:", meeting);
    setEditingMeeting(meeting);
    setSelectedDate(
      meeting.start_time ? new Date(meeting.start_time) : new Date()
    );
    setSelectedMeeting(null);
    setClickedCalendarDate(null);
    setCreateMeetingOpen(true);
  }, []);

  const handleMeetingClick = useCallback((meeting) => {
    setSelectedMeeting(meeting);
  }, []);

  const handleJoinMeeting = useCallback(
    (meeting) => {
      console.log("Navigating to meeting:", meeting);
      const meetingId = meeting.meeting_id || meeting.id || meeting.Meeting_ID;
      if (!meetingId) {
        alert("Invalid meeting - no meeting ID found");
        return;
      }
      navigate(`/meeting/${meetingId}`);
    },
    [navigate]
  );

  const handleMeetingCreated = useCallback(
    async (meetingData) => {
      if (isOperatingRef.current) {
        console.log("⚠️ Operation already in progress, skipping...");
        return;
      }

      try {
        isOperatingRef.current = true;
        isUpdatingRef.current = true;
        console.log(
          "Creating/updating calendar meeting with data:",
          meetingData
        );

        let result;
        if (editingMeeting) {
          const meetingId =
            editingMeeting.ID || editingMeeting.id || editingMeeting.meeting_id;

          const preservedData = {
            ...meetingData,
            start_time:
              meetingData.start_time ||
              editingMeeting.start_time ||
              editingMeeting.Started_At,
            end_time:
              meetingData.end_time ||
              editingMeeting.end_time ||
              editingMeeting.Ended_At,
          };

          result = await updateEvent(meetingId, preservedData);
          console.log("Meeting updated:", result);
        } else {
          result = await createEvent(meetingData);
          console.log("Meeting created:", result);
        }

        if (result && result.success === true) {
          console.log(
            "✅ Operation successful, scheduling calendar refresh..."
          );

          const refreshDelay = 2000;

          setTimeout(() => {
            loadCalendarData();

            if (editingMeeting) {
              const meetingId =
                editingMeeting.ID ||
                editingMeeting.id ||
                editingMeeting.meeting_id;
              const updatedMeeting =
                meetings &&
                meetings.find(
                  (e) =>
                    String(
                      e.ID || e.id || e.Meeting_ID || e.meeting_id
                    ).trim() === String(meetingId).trim()
                );

              if (
                updatedMeeting &&
                (updatedMeeting.start_time || updatedMeeting.startTime)
              ) {
                const meetingDate = new Date(
                  updatedMeeting.start_time || updatedMeeting.startTime
                );
                console.log(
                  "🗓️ Auto-navigating to updated meeting date:",
                  meetingDate
                );
                setCurrentDate(meetingDate);
              }
            }

            isUpdatingRef.current = false;
            isOperatingRef.current = false;

            console.log("✅ Closing modal and cleaning up state");
            setCreateMeetingOpen(false);
            setSelectedDate(null);
            setEditingMeeting(null);
            setClickedCalendarDate(null);
          }, refreshDelay);
        } else {
          console.error(
            "❌ Meeting operation failed:",
            result?.message || result?.error
          );
          isUpdatingRef.current = false;
          isOperatingRef.current = false;
        }
      } catch (error) {
        console.error("❌ Unexpected error in handleMeetingCreated:", error);
        isUpdatingRef.current = false;
        isOperatingRef.current = false;
        console.error(
          "This error should have been caught by CalendarMeeting.jsx"
        );
      }
    },
    [editingMeeting, createEvent, updateEvent, loadCalendarData, meetings]
  );

  const handleNewMeetingClick = useCallback(() => {
    console.log("New Meeting button clicked");
    setSelectedDate(null);
    setEditingMeeting(null);
    setClickedCalendarDate(null);
    setCreateMeetingOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    console.log("🛑 Modal close requested");
    setCreateMeetingOpen(false);
    setSelectedDate(null);
    setEditingMeeting(null);
    setClickedCalendarDate(null);
  }, []);

  const getViewTitle = useCallback(() => {
    switch (view) {
      case "month":
        return format(currentDate, "MMMM yyyy");
      case "week":
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${format(weekStart, "MMM dd")} - ${format(
          weekEnd,
          "MMM dd, yyyy"
        )}`;
      case "day":
        return format(currentDate, "EEEE, MMMM dd, yyyy");
      default:
        return "";
    }
  }, [view, currentDate]);

  const renderMonthCalendar = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const currentDay = day;
        const dayMeetings = getMeetingsForDate(currentDay);
        const isCurrentMonth = isSameMonth(currentDay, monthStart);
        const isTodayDate = isToday(currentDay);

        days.push(
          <Box
            key={currentDay}
            onClick={() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const dayToCheck = new Date(currentDay);
              dayToCheck.setHours(0, 0, 0, 0);

              if (dayToCheck >= today) {
                handleDateClick(currentDay);
              }
            }}
            sx={{
              aspectRatio: "1",
              p: { xs: 0.5, sm: 1 },
              cursor: (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dayToCheck = new Date(currentDay);
                dayToCheck.setHours(0, 0, 0, 0);
                return dayToCheck >= today ? "pointer" : "not-allowed";
              })(),
              borderRadius: { xs: 1, sm: 2 },
              bgcolor: isTodayDate 
                ? `linear-gradient(135deg, ${themeColors.teal} 0%, ${themeColors.blue} 100%)`
                : "transparent",
              background: isTodayDate 
                ? `linear-gradient(135deg, ${themeColors.teal} 0%, ${themeColors.blue} 100%)`
                : "transparent",
              color: isTodayDate
                ? "white"
                : !isCurrentMonth
                ? themeColors.grey[400]
                : themeColors.text.primary,
              opacity: (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dayToCheck = new Date(currentDay);
                dayToCheck.setHours(0, 0, 0, 0);
                return dayToCheck < today ? 0.4 : 1;
              })(),
              transition: "all 0.2s",
              "&:hover": {
                bgcolor: (() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const dayToCheck = new Date(currentDay);
                  dayToCheck.setHours(0, 0, 0, 0);
                  return dayToCheck >= today
                    ? isTodayDate
                      ? themeColors.teal
                      : `${themeColors.blue}15`
                    : "transparent";
                })(),
                transform: (() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const dayToCheck = new Date(currentDay);
                  dayToCheck.setHours(0, 0, 0, 0);
                  return dayToCheck >= today ? "scale(1.05)" : "none";
                })(),
              },
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography
              variant="body1"
              fontWeight={isTodayDate ? 700 : 600}
              sx={{
                fontSize: { xs: "0.75rem", sm: "0.875rem", md: "1rem" },
              }}
            >
              {format(currentDay, "d")}
            </Typography>
            {dayMeetings.length > 0 && (
              <Box
                sx={{
                  display: "flex",
                  gap: 0.5,
                  mt: 0.5,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                {dayMeetings.slice(0, isMobile ? 2 : 3).map((meeting, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      width: { xs: 4, sm: 6 },
                      height: { xs: 4, sm: 6 },
                      borderRadius: "50%",
                      bgcolor: isTodayDate ? "white" : themeColors.blue,
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <Box
          key={day}
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: { xs: 0.5, sm: 1 },
          }}
        >
          {days}
        </Box>
      );
      days = [];
    }

    return (
      <Box>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: { xs: 0.5, sm: 1 },
            mb: 2,
          }}
        >
          {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
            <Box key={idx} sx={{ textAlign: "center" }}>
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{
                  color: themeColors.blue,
                  fontSize: { xs: "0.75rem", sm: "0.875rem" },
                }}
              >
                {day}
              </Typography>
            </Box>
          ))}
        </Box>
        <Stack spacing={{ xs: 0.5, sm: 1 }}>{rows}</Stack>
      </Box>
    );
  };

  const renderMeetingCard = (meeting, isUpcoming = false) => {
    const meetingTime = format(new Date(meeting.startTime), "HH:mm");
    const now = new Date();
    const meetingStart = new Date(meeting.startTime);
    const meetingEnd = new Date(meeting.endTime);
    const isOngoing = now >= meetingStart && now <= meetingEnd;
    const isPast = now > meetingEnd;

    return (
      <Card
        key={meeting.id}
        onClick={() => handleMeetingClick(meeting)}
        sx={{
          bgcolor: "rgba(255, 255, 255, 0.15)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: 2,
          p: { xs: 1.5, sm: 2 },
          cursor: "pointer",
          transition: "all 0.2s",
          "&:hover": {
            bgcolor: "rgba(255, 255, 255, 0.25)",
            transform: "translateY(-2px)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1.5,
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: isUpcoming
                ? themeColors.blue
                : isOngoing
                ? themeColors.green
                : isPast
                ? "rgba(255, 255, 255, 0.4)"
                : themeColors.blue,
              mt: 0.5,
              flexShrink: 0,
            }}
          />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                color: "rgba(255, 255, 255, 0.8)",
                mb: 0.5,
                fontSize: { xs: "0.7rem", sm: "0.75rem" },
              }}
            >
              {isUpcoming
                ? format(new Date(meeting.startTime), "MMM dd, yyyy • HH:mm")
                : meetingTime}
            </Typography>
            <Typography
              variant="body1"
              fontWeight={600}
              sx={{
                color: "white",
                mb: 0.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: { xs: "0.875rem", sm: "1rem" },
              }}
            >
              {meeting.title}
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
              }}
            >
              <GroupIcon
                sx={{
                  fontSize: { xs: 12, sm: 14 },
                  color: "rgba(255, 255, 255, 0.7)",
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  color: "rgba(255, 255, 255, 0.7)",
                  fontSize: { xs: "0.7rem", sm: "0.75rem" },
                }}
              >
                {meeting.participants || 0}
              </Typography>
            </Box>
          </Box>

          {!isUpcoming && (
            <>
              {isOngoing ? (
                <WarningIcon
                  sx={{
                    color: themeColors.amber,
                    fontSize: { xs: 18, sm: 20 },
                  }}
                />
              ) : isPast ? (
                <CheckCircleIcon
                  sx={{
                    color: "rgba(255, 255, 255, 0.5)",
                    fontSize: { xs: 18, sm: 20 },
                  }}
                />
              ) : null}
            </>
          )}
        </Box>
      </Card>
    );
  };

  const renderTodayPanel = () => {
    const displayMeetings = sideCardTab === 0 ? todaysMeetings : upcomingMeetings;
    const emptyIcon = sideCardTab === 0 ? ScheduleIcon : EventAvailableIcon;
    const emptyMessage =
      sideCardTab === 0
        ? "No meetings scheduled today"
        : "No upcoming meetings";

    return (
      <Card
        sx={{
          height: "100%",
          background: `linear-gradient(135deg, ${themeColors.teal} 0%, ${themeColors.blue} 100%)`,
          color: "white",
          borderRadius: { xs: 2, sm: 3 },
          overflow: "hidden",
          boxShadow: `0 10px 30px ${themeColors.blue}40`,
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Typography
              variant="h5"
              fontWeight={700}
              sx={{
                fontSize: { xs: "1.25rem", sm: "1.5rem" },
              }}
            >
              Meetings
            </Typography>
            <Chip
              label={`${displayMeetings.length} ${
                displayMeetings.length === 1 ? "Event" : "Events"
              }`}
              size="small"
              sx={{
                bgcolor: "rgba(255, 255, 255, 0.2)",
                color: "white",
                fontWeight: 600,
                fontSize: { xs: "0.75rem", sm: "0.875rem" },
              }}
            />
          </Box>

          <Tabs
            value={sideCardTab}
            onChange={(e, newValue) => setSideCardTab(newValue)}
            sx={{
              mb: 2,
              minHeight: "auto",
              "& .MuiTabs-indicator": {
                backgroundColor: "white",
              },
              "& .MuiTab-root": {
                color: "rgba(255, 255, 255, 0.7)",
                minHeight: "auto",
                py: 1,
                px: 2,
                fontSize: { xs: "0.75rem", sm: "0.875rem" },
                textTransform: "none",
                fontWeight: 600,
                "&.Mui-selected": {
                  color: "white",
                },
              },
            }}
          >
            <Tab label="Today" />
            <Tab label="Upcoming" />
          </Tabs>

          <Stack spacing={2} sx={{ maxHeight: "calc(100vh - 400px)", overflowY: "auto" }}>
            {displayMeetings.length === 0 ? (
              <Box
                sx={{
                  textAlign: "center",
                  py: 4,
                  color: alpha("#ffffff", 0.8),
                }}
              >
                {React.createElement(emptyIcon, {
                  sx: {
                    fontSize: { xs: 40, sm: 48 },
                    mb: 2,
                    opacity: 0.5,
                  },
                })}
                <Typography
                  variant="body1"
                  sx={{
                    fontSize: { xs: "0.875rem", sm: "1rem" },
                  }}
                >
                  {emptyMessage}
                </Typography>
              </Box>
            ) : (
              displayMeetings.map((meeting) =>
                renderMeetingCard(meeting, sideCardTab === 1)
              )
            )}
          </Stack>
        </CardContent>
      </Card>
    );
  };

  const renderDateActionDialog = () => {
    const { open, date, meetings: dateMeetings } = dateActionDialog;

    if (!open || !date) return null;

    return (
      <Dialog
        open={open}
        onClose={handleCloseDateActionDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            m: { xs: 1, sm: 2 },
          },
        }}
      >
        <DialogTitle
          sx={{
            background: `linear-gradient(135deg, ${themeColors.teal} 0%, ${themeColors.blue} 100%)`,
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            py: 2,
          }}
        >
          <Box>
            <Typography
              variant="h6"
              fontWeight={700}
              sx={{ fontSize: { xs: "1.125rem", sm: "1.25rem" } }}
            >
              {format(date, "EEEE, MMMM dd, yyyy")}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                opacity: 0.9,
                fontSize: { xs: "0.75rem", sm: "0.875rem" },
              }}
            >
              {dateMeetings.length === 0
                ? "No meetings scheduled"
                : `${dateMeetings.length} ${
                    dateMeetings.length === 1 ? "meeting" : "meetings"
                  } scheduled`}
            </Typography>
          </Box>
          <IconButton
            onClick={handleCloseDateActionDialog}
            sx={{
              color: "white",
              "&:hover": {
                bgcolor: "rgba(255, 255, 255, 0.1)",
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          <List sx={{ py: 0 }}>
            <ListItem
              button
              onClick={handleCreateMeetingFromDialog}
              sx={{
                py: 2.5,
                px: 3,
                borderBottom: `1px solid ${themeColors.blue}15`,
                "&:hover": {
                  bgcolor: `${themeColors.blue}08`,
                },
              }}
            >
              <ListItemIcon>
                <AddCircleOutlineIcon
                  sx={{ color: themeColors.teal, fontSize: 28 }}
                />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography
                    variant="body1"
                    fontWeight={600}
                    sx={{ fontSize: { xs: "0.875rem", sm: "1rem" }, color: themeColors.text.primary }}
                  >
                    Create Meeting
                  </Typography>
                }
                secondary={
                  <Typography
                    variant="body2"
                    sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" }, color: themeColors.text.secondary }}
                  >
                    Schedule a new meeting for this date
                  </Typography>
                }
              />
            </ListItem>

            <Divider />

            {dateMeetings.length > 0 && (
              <Box sx={{ bgcolor: `${themeColors.blue}05` }}>
                <Box
                  sx={{
                    px: 3,
                    py: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <ViewListIcon sx={{ color: themeColors.blue, fontSize: 20 }} />
                  <Typography
                    variant="subtitle2"
                    fontWeight={600}
                    sx={{ color: themeColors.blue, fontSize: { xs: "0.875rem", sm: "1rem" } }}
                  >
                    Scheduled Meetings
                  </Typography>
                </Box>

                <Stack spacing={0}>
                  {dateMeetings.map((meeting, index) => (
                    <React.Fragment key={meeting.id}>
                      <ListItem
                        button
                        onClick={() => {
                          handleMeetingClick(meeting);
                          handleCloseDateActionDialog();
                        }}
                        sx={{
                          py: 2,
                          px: 3,
                          "&:hover": {
                            bgcolor: `${themeColors.blue}08`,
                          },
                        }}
                      >
                        <ListItemIcon>
                          <AccessTimeIcon
                            sx={{ color: themeColors.blue, fontSize: 24 }}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography
                              variant="body1"
                              fontWeight={600}
                              sx={{
                                fontSize: { xs: "0.875rem", sm: "1rem" },
                                mb: 0.5,
                                color: themeColors.text.primary,
                              }}
                            >
                              {meeting.title}
                            </Typography>
                          }
                          secondary={
                            <Box>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontSize: { xs: "0.75rem", sm: "0.875rem" },
                                  color: themeColors.text.secondary,
                                }}
                              >
                                {format(
                                  new Date(meeting.startTime),
                                  "h:mm a"
                                )}{" "}
                                -{" "}
                                {format(new Date(meeting.endTime), "h:mm a")}
                              </Typography>
                              {meeting.participants > 0 && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    mt: 0.5,
                                    fontSize: {
                                      xs: "0.7rem",
                                      sm: "0.75rem",
                                    },
                                    color: themeColors.text.secondary,
                                  }}
                                >
                                  <GroupIcon sx={{ fontSize: 14 }} />
                                  {meeting.participants} participants
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        <Chip
                          label={meeting.status || "Scheduled"}
                          size="small"
                          sx={{
                            bgcolor: `${themeColors.blue}15`,
                            color: themeColors.blue,
                            fontWeight: 600,
                            fontSize: { xs: "0.7rem", sm: "0.75rem" },
                          }}
                        />
                      </ListItem>
                      {index < dateMeetings.length - 1 && (
                        <Divider sx={{ mx: 3 }} />
                      )}
                    </React.Fragment>
                  ))}
                </Stack>
              </Box>
            )}
          </List>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            py: 2,
            bgcolor: themeColors.grey[50],
            borderTop: `1px solid ${themeColors.blue}15`,
          }}
        >
          <Button
            onClick={handleCloseDateActionDialog}
            sx={{
              textTransform: "none",
              color: themeColors.text.secondary,
              fontWeight: 600,
              fontSize: { xs: "0.875rem", sm: "1rem" },
              "&:hover": {
                bgcolor: `${themeColors.grey[500]}10`,
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <DashboardLayout>
      <Box
        sx={{
          flexGrow: 1,
          background: 'linear-gradient(135deg, #F0F9F9 0%, #EBF4FC 50%, #F5F7FA 100%)',
          minHeight: "100vh",
          pt: { xs: 1, sm: 2 },
        }}
      >
        <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3 } }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            mb={{ xs: 2, sm: 4 }}
            spacing={{ xs: 2, sm: 0 }}
          >
            <Stack
              direction="row"
              alignItems="center"
              spacing={{ xs: 1, sm: 2 }}
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${themeColors.teal} 0%, ${themeColors.blue} 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 4px 14px ${themeColors.blue}40`,
                }}
              >
                <CalendarIcon sx={{ fontSize: 28, color: '#ffffff' }} />
              </Box>
              <Box>
                <Typography
                  variant="h4"
                  fontWeight={700}
                  sx={{
                    color: themeColors.text.primary,
                    fontSize: { xs: "1.5rem", sm: "2rem", md: "2.125rem" },
                  }}
                >
                  Calendar
                </Typography>
              </Box>
              <BackButton />

              {loading && (
                <Typography
                  variant="body2"
                  sx={{
                    color: themeColors.text.secondary,
                    fontSize: { xs: "0.75rem", sm: "0.875rem" },
                  }}
                >
                  Loading...
                </Typography>
              )}
            </Stack>

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleNewMeetingClick}
              disabled={isOperatingRef.current || loading}
              sx={{
                borderRadius: 2,
                textTransform: "none",
                px: { xs: 2, sm: 3 },
                py: { xs: 1, sm: 1.5 },
                fontWeight: 600,
                background: `linear-gradient(135deg, ${themeColors.teal} 0%, ${themeColors.blue} 100%)`,
                fontSize: { xs: "0.875rem", sm: "1rem" },
                width: { xs: "100%", sm: "auto" },
                boxShadow: `0 4px 14px ${themeColors.blue}40`,
                "&:hover": {
                  background: `linear-gradient(135deg, ${themeColors.teal} 0%, ${themeColors.blue} 100%)`,
                  boxShadow: `0 6px 20px ${themeColors.blue}50`,
                },
                "&.Mui-disabled": {
                  background: themeColors.grey[300],
                  color: themeColors.grey[500],
                },
              }}
            >
              New Meeting
            </Button>
          </Stack>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 2,
                borderRadius: 3,
                fontSize: { xs: "0.875rem", sm: "1rem" },
                border: `1px solid ${themeColors.red}30`,
              }}
            >
              Error: {error}
            </Alert>
          )}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: isTablet ? "1fr" : "2fr 1fr",
              },
              gap: { xs: 2, sm: 3 },
            }}
          >
            <Paper
              elevation={0}
              sx={{
                borderRadius: { xs: 2, sm: 3 },
                background: "white",
                color: themeColors.text.primary,
                p: { xs: 2, sm: 3 },
                border: '1px solid #E5E7EB',
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ xs: "flex-start", sm: "center" }}
                justifyContent="space-between"
                mb={{ xs: 2, sm: 3 }}
                spacing={{ xs: 2, sm: 0 }}
              >
                <Typography
                  variant="h5"
                  fontWeight={700}
                  sx={{
                    color: themeColors.blue,
                    fontSize: { xs: "1.125rem", sm: "1.25rem", md: "1.5rem" },
                  }}
                >
                  {getViewTitle()}
                </Typography>

                <Stack direction="row" spacing={1}>
                  <IconButton
                    onClick={handlePrevious}
                    disabled={loading || isOperatingRef.current}
                    sx={{
                      color: themeColors.blue,
                      bgcolor: `${themeColors.blue}10`,
                      "&:hover": {
                        bgcolor: `${themeColors.blue}20`,
                      },
                      "&.Mui-disabled": {
                        color: themeColors.grey[400],
                        bgcolor: `${themeColors.grey[300]}30`,
                      },
                    }}
                    size={isMobile ? "small" : "medium"}
                  >
                    <PrevIcon />
                  </IconButton>
                  <IconButton
                    onClick={handleNext}
                    disabled={loading || isOperatingRef.current}
                    sx={{
                      color: themeColors.blue,
                      bgcolor: `${themeColors.blue}10`,
                      "&:hover": {
                        bgcolor: `${themeColors.blue}20`,
                      },
                      "&.Mui-disabled": {
                        color: themeColors.grey[400],
                        bgcolor: `${themeColors.grey[300]}30`,
                      },
                    }}
                    size={isMobile ? "small" : "medium"}
                  >
                    <NextIcon />
                  </IconButton>
                </Stack>
              </Stack>

              <Stack
                direction="row"
                spacing={1}
                mb={{ xs: 2, sm: 3 }}
                sx={{
                  bgcolor: `${themeColors.blue}08`,
                  p: 0.5,
                  borderRadius: 2,
                  width: "fit-content",
                }}
              >
                {['month', 'week', 'day'].map((viewType) => (
                  <Button
                    key={viewType}
                    size="small"
                    onClick={() => setView(viewType)}
                    sx={{
                      textTransform: "none",
                      color: view === viewType ? "white" : themeColors.blue,
                      bgcolor: view === viewType 
                        ? `linear-gradient(135deg, ${themeColors.teal} 0%, ${themeColors.blue} 100%)`
                        : "transparent",
                      background: view === viewType 
                        ? `linear-gradient(135deg, ${themeColors.teal} 0%, ${themeColors.blue} 100%)`
                        : "transparent",
                      "&:hover": {
                        bgcolor: view === viewType 
                          ? themeColors.teal 
                          : `${themeColors.blue}15`,
                      },
                      borderRadius: 1.5,
                      fontWeight: 600,
                      fontSize: { xs: "0.75rem", sm: "0.875rem" },
                      px: { xs: 1.5, sm: 2 },
                    }}
                  >
                    {viewType.charAt(0).toUpperCase() + viewType.slice(1)}
                  </Button>
                ))}
              </Stack>

              {view === "month" ? (
                renderMonthCalendar()
              ) : (
                <MonthWeekDayView
                  viewMode={view}
                  currentDate={currentDate}
                  meetings={transformMeetingsForView}
                  onDateClick={handleDateClick}
                  onMeetingClick={handleMeetingClick}
                />
              )}
            </Paper>

            {renderTodayPanel()}
          </Box>

          {selectedMeeting && (
            <Dialog
              open={Boolean(selectedMeeting)}
              onClose={() => setSelectedMeeting(null)}
              maxWidth="sm"
              fullWidth
              PaperProps={{
                sx: {
                  borderRadius: 3,
                  m: { xs: 1, sm: 2 },
                },
              }}
            >
              <Box sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{
                    fontSize: { xs: "1.125rem", sm: "1.25rem" },
                    fontWeight: 700,
                    color: themeColors.text.primary,
                  }}
                >
                  {selectedMeeting.title}
                </Typography>
                <Typography
                  variant="body2"
                  gutterBottom
                  sx={{
                    fontSize: { xs: "0.875rem", sm: "1rem" },
                    color: themeColors.text.secondary,
                  }}
                >
                  {selectedMeeting.startTime
                    ? format(
                        new Date(selectedMeeting.startTime),
                        "EEEE, MMMM dd, yyyy HH:mm"
                      )
                    : "Time TBD"}
                </Typography>
                {selectedMeeting.participants > 0 && (
                  <Typography
                    variant="body2"
                    gutterBottom
                    sx={{
                      fontSize: { xs: "0.875rem", sm: "1rem" },
                      color: themeColors.text.secondary,
                    }}
                  >
                    {selectedMeeting.participants} participant(s)
                  </Typography>
                )}
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  sx={{ mt: 3 }}
                >
                  <Button
                    variant="contained"
                    onClick={() => {
                      if (selectedMeeting.id) {
                        handleJoinMeeting(selectedMeeting);
                      }
                      setSelectedMeeting(null);
                    }}
                    disabled={!selectedMeeting.id}
                    fullWidth
                    sx={{
                      background: `linear-gradient(135deg, ${themeColors.teal} 0%, ${themeColors.blue} 100%)`,
                      textTransform: "none",
                      fontWeight: 600,
                      fontSize: { xs: "0.875rem", sm: "1rem" },
                      py: { xs: 1, sm: 1.5 },
                      boxShadow: `0 4px 14px ${themeColors.blue}40`,
                      "&:hover": {
                        background: `linear-gradient(135deg, ${themeColors.teal} 0%, ${themeColors.blue} 100%)`,
                        boxShadow: `0 6px 20px ${themeColors.blue}50`,
                      },
                    }}
                  >
                    Join Meeting
                  </Button>

                  <Button
                    variant="contained"
                    onClick={() => {
                      console.log(
                        "📝 Opening edit dialog for meeting:",
                        selectedMeeting
                      );
                      handleEditMeeting(selectedMeeting);
                      setSelectedMeeting(null);
                    }}
                    fullWidth
                    sx={{
                      background: `linear-gradient(135deg, ${themeColors.blue} 0%, ${themeColors.deepBlue} 100%)`,
                      textTransform: "none",
                      fontWeight: 600,
                      fontSize: { xs: "0.875rem", sm: "1rem" },
                      py: { xs: 1, sm: 1.5 },
                      boxShadow: `0 4px 14px ${themeColors.deepBlue}40`,
                      "&:hover": {
                        background: `linear-gradient(135deg, ${themeColors.blue} 0%, ${themeColors.deepBlue} 100%)`,
                        boxShadow: `0 6px 20px ${themeColors.deepBlue}50`,
                      },
                    }}
                  >
                    Edit
                  </Button>

                  <Button
                    onClick={() => setSelectedMeeting(null)}
                    fullWidth
                    sx={{
                      textTransform: "none",
                      fontWeight: 600,
                      fontSize: { xs: "0.875rem", sm: "1rem" },
                      py: { xs: 1, sm: 1.5 },
                      color: themeColors.text.secondary,
                      border: `1px solid ${themeColors.grey[300]}`,
                      "&:hover": {
                        bgcolor: `${themeColors.grey[500]}10`,
                        borderColor: themeColors.grey[400],
                      },
                    }}
                  >
                    Close
                  </Button>
                </Stack>
              </Box>
            </Dialog>
          )}

          {renderDateActionDialog()}

          <Dialog
            open={createMeetingOpen}
            onClose={handleModalClose}
            maxWidth="md"
            fullWidth
            fullScreen={isMobile}
            PaperProps={{
              sx: {
                borderRadius: { xs: 0, sm: 3 },
                m: { xs: 0, sm: 2 },
              },
            }}
          >
            <CalendarMeeting
              selectedDate={selectedDate}
              clickedCalendarDate={clickedCalendarDate}
              existingMeeting={editingMeeting}
              isEditing={Boolean(editingMeeting)}
              onClose={handleModalClose}
              onSave={handleMeetingCreated}
            />
          </Dialog>
        </Container>
      </Box>
    </DashboardLayout>
  );
};

export default CalendarPage;