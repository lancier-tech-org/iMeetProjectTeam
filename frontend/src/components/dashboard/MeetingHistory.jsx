import React, { useState, useMemo, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Button,
  Grid,
  Divider,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Tooltip,
  useTheme,
  alpha,
  Skeleton,
  Alert,
  Paper,
  Stack,
  Fade,
  Slide,
  Grow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  useMediaQuery,
  Pagination,
} from "@mui/material";
import {
  Search,
  MoreVert,
  PlayArrow,
  Download,
  Share,
  Delete,
  VideoCall,
  Schedule,
  CalendarMonth,
  AccessTime,
  Groups,
  Star,
  StarBorder,
  Refresh,
  History,
  ExpandMore,
  Close,
  Person,
  TrendingUp,
  Timer,
  Videocam,
  ContentCopy,
  Info,
  CalendarToday,
  CheckCircle,
  Cancel,
  Pending,
} from "@mui/icons-material";
import {
  format,
  isToday,
  isTomorrow,
  isYesterday,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
} from "date-fns";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useMeeting } from "../../hooks/useMeeting";


// Meeting Type Badge Component
const MeetingTypeBadge = ({ type }) => {
  const getTypeConfig = () => {
    switch (type) {
      case "instant":
        return {
          icon: <Videocam sx={{ fontSize: 14 }} />,
          label: "Instant",
          color: "#1A8A8A",
          bgColor: "rgba(26, 138, 138, 0.1)",
        };
      case "schedule":
      case "scheduled":
        return {
          icon: <Schedule sx={{ fontSize: 14 }} />,
          label: "Scheduled",
          color: "#2D7DD2",
          bgColor: "rgba(45, 125, 210, 0.1)",
        };
      case "calendar":
        return {
          icon: <CalendarMonth sx={{ fontSize: 14 }} />,
          label: "Calendar",
          color: "#8B5CF6",
          bgColor: "rgba(139, 92, 246, 0.1)",
        };
      default:
        return {
          icon: <VideoCall sx={{ fontSize: 14 }} />,
          label: "Meeting",
          color: "#6B7280",
          bgColor: "rgba(107, 114, 128, 0.1)",
        };
    }
  };

  const config = getTypeConfig();

  return (
    <Chip
      icon={config.icon}
      label={config.label}
      size="small"
      sx={{
        backgroundColor: config.bgColor,
        color: config.color,
        fontSize: "0.7rem",
        fontWeight: 600,
        height: 24,
        border: `1px solid ${config.color}30`,
        "& .MuiChip-icon": {
          color: config.color,
        },
      }}
    />
  );
};

// Status Badge Component
const StatusBadge = ({ status }) => {
  const getStatusConfig = () => {
    switch (status) {
      case "completed":
      case "ended":
        return {
          icon: <CheckCircle sx={{ fontSize: 14 }} />,
          label: "Ended",
          color: "#10B981",
          bgColor: "rgba(16, 185, 129, 0.1)",
        };
      case "cancelled":
        return {
          icon: <Cancel sx={{ fontSize: 14 }} />,
          label: "Cancelled",
          color: "#EF4444",
          bgColor: "rgba(239, 68, 68, 0.1)",
        };
      case "ongoing":
      case "active":
        return {
          icon: <Pending sx={{ fontSize: 14 }} />,
          label: "Live",
          color: "#F59E0B",
          bgColor: "rgba(245, 158, 11, 0.1)",
        };
      default:
        return {
          icon: <AccessTime sx={{ fontSize: 14 }} />,
          label: status || "Unknown",
          color: "#6B7280",
          bgColor: "rgba(107, 114, 128, 0.1)",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Chip
      icon={config.icon}
      label={config.label}
      size="small"
      sx={{
        backgroundColor: config.bgColor,
        color: config.color,
        fontSize: "0.7rem",
        fontWeight: 600,
        height: 24,
        border: `1px solid ${config.color}30`,
        "& .MuiChip-icon": {
          color: config.color,
        },
      }}
    />
  );
};

// Meeting Details Dialog
const MeetingDetailsDialog = ({ open, meeting, onClose }) => {
  const navigate = useNavigate();

  if (!meeting) return null;

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
              width: 44,
              height: 44,
              borderRadius: 2,
              background: "linear-gradient(135deg, #1A8A8A 0%, #2D7DD2 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <VideoCall sx={{ color: "white", fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={600}>
              {meeting.title || "Meeting Details"}
            </Typography>
            <Typography variant="caption" sx={{ color: "#6B7280" }}>
              {meeting.meeting_id || meeting.id}
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} sx={{ color: "#6B7280" }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography
              variant="caption"
              sx={{ color: "#6B7280", fontWeight: 500 }}
            >
              Date & Time
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: "#1F2937", fontWeight: 500 }}
            >
              {meeting.date
                ? format(new Date(meeting.date), "MMM dd, yyyy 'at' HH:mm")
                : "N/A"}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography
              variant="caption"
              sx={{ color: "#6B7280", fontWeight: 500 }}
            >
              Duration
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: "#1F2937", fontWeight: 500 }}
            >
              {meeting.duration || meeting.meeting_duration || "N/A"}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography
              variant="caption"
              sx={{ color: "#6B7280", fontWeight: 500 }}
            >
              Participants
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: "#1F2937", fontWeight: 500 }}
            >
              {meeting.participants || 0} people
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography
              variant="caption"
              sx={{ color: "#6B7280", fontWeight: 500 }}
            >
              Host
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: "#1F2937", fontWeight: 500 }}
            >
              {meeting.is_host ? "You" : meeting.host || "Unknown"}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography
              variant="caption"
              sx={{ color: "#6B7280", fontWeight: 500 }}
            >
              Type
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <MeetingTypeBadge type={meeting.type || meeting.meeting_type} />
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Typography
              variant="caption"
              sx={{ color: "#6B7280", fontWeight: 500 }}
            >
              Status
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <StatusBadge status={meeting.status} />
            </Box>
          </Grid>
          {meeting.recording && (
            <Grid item xs={12}>
              <Alert
                severity="success"
                variant="outlined"
                icon={<PlayArrow />}
                sx={{
                  borderRadius: 2,
                  backgroundColor: "rgba(16, 185, 129, 0.05)",
                  borderColor: "rgba(16, 185, 129, 0.3)",
                  "& .MuiAlert-icon": { color: "#10B981" },
                }}
              >
                <Typography variant="body2" sx={{ color: "#10B981" }}>
                  Recording available for this meeting
                </Typography>
              </Alert>
            </Grid>
          )}
        </Grid>
      </DialogContent>

 
    </Dialog>
  );
};

// Main Component
const MeetingHistory = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const fullScreen = useMediaQuery(theme.breakpoints.down("md"));
  const { user } = useAuth();
  const {
    meetings,
    summary,
    loading,
    error,
    loadMeetingHistory,
    refresh,
    setError,
    updateMeeting,
    filterMeetings,
    getStatistics,
  } = useMeeting();

  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState(0);
  const [actionAnchor, setActionAnchor] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [viewMeeting, setViewMeeting] = useState(null);
  const meetingsPerPage = 10;

  const clearError = () => setError(null);

  useEffect(() => {
    if (user?.id && !loading && meetings.length === 0) {
      loadMeetingHistory();
    }
  }, [user?.id]);

  // Filter meetings
  const filteredMeetings = useMemo(() => {
    const criteria = {
      search: searchTerm,
    };

    switch (selectedFilter) {
      case "hosted":
        criteria.role = "host";
        break;
      case "participated":
        criteria.role = "participant";
        break;
      case "starred":
        criteria.starred = true;
        break;
      case "recorded":
        criteria.recorded = true;
        break;
      case "instant":
        criteria.type = "instant";
        break;
      case "schedule":
        criteria.type = "schedule";
        break;
      case "calendar":
        criteria.type = "calendar";
        break;
      default:
        break;
    }

    return filterMeetings(criteria);
  }, [meetings, searchTerm, selectedFilter, filterMeetings]);



  // Pagination
  const totalPages = Math.ceil(filteredMeetings.length / meetingsPerPage);
  const startIndex = (currentPage - 1) * meetingsPerPage;
  const endIndex = startIndex + meetingsPerPage;
  const currentMeetings = filteredMeetings.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFilter]);

  // Handlers
  const handleFilterClick = (filter) => {
    setSelectedFilter(filter);
    setFilterAnchor(null);
  };

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };

  const formatMeetingDate = (date) => {
    if (!date) return "Unknown time";

    const meetingDate = new Date(date);

    if (isToday(meetingDate)) {
      return `Today at ${format(meetingDate, "HH:mm")}`;
    } else if (isTomorrow(meetingDate)) {
      return `Tomorrow at ${format(meetingDate, "HH:mm")}`;
    } else if (isYesterday(meetingDate)) {
      return `Yesterday at ${format(meetingDate, "HH:mm")}`;
    } else {
      return format(meetingDate, "MMM dd") + ` at ${format(meetingDate, "HH:mm")}`;
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleStarToggle = (e, meetingId) => {
    e.stopPropagation();
    updateMeeting(meetingId, {
      starred: !meetings.find((m) => m.id === meetingId)?.starred,
    });
  };

  const handleMeetingClick = (meeting) => {
    setViewMeeting(meeting);
    setDetailsDialogOpen(true);
  };

  const handleActionMenuOpen = (e, meeting) => {
    e.stopPropagation();
    setSelectedMeeting(meeting);
    setActionAnchor(e.currentTarget);
  };

  const handleActionMenuClose = () => {
    setActionAnchor(null);
    setSelectedMeeting(null);
  };

  const formatDurationDisplay = (meeting) => {
    const isHost = meeting.is_host || meeting.user_role === "host";
    const meetingDuration = meeting.meeting_duration || meeting.duration || "00:00";
    const participationDuration = meeting.participation_duration || meeting.duration || "00:00";

    if (isHost) {
      return meetingDuration;
    }

    if (participationDuration !== meetingDuration && participationDuration !== "00:00") {
      return (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <span>{meetingDuration}</span>
          <Typography
            component="span"
            variant="caption"
            sx={{ color: "#9CA3AF" }}
          >
            (You: {participationDuration})
          </Typography>
        </Stack>
      );
    }

    return meetingDuration;
  };

  // Filter options
  const filterOptions = [
    { value: "all", label: "All Meetings", icon: <History /> },
    { value: "hosted", label: "Hosted by Me", icon: <Person /> },
    { value: "participated", label: "Participated In", icon: <Groups /> },
    { value: "starred", label: "Starred", icon: <Star /> },
    { value: "recorded", label: "Recorded", icon: <PlayArrow /> },
    { value: "instant", label: "Instant", icon: <Videocam /> },
    { value: "schedule", label: "Scheduled", icon: <Schedule /> },
    { value: "calendar", label: "Calendar", icon: <CalendarMonth /> },
  ];

  // Auth check
  if (!user) {
    return (
      <Box
        sx={{
          p: 4,
          background: "linear-gradient(135deg, #F0F9F9 0%, #EBF4FC 50%, #F5F7FA 100%)",
          minHeight: "100vh",
        }}
      >
        <Alert
          severity="warning"
          sx={{
            mb: 2,
            borderRadius: 3,
            border: "1px solid rgba(245, 158, 11, 0.3)",
            backgroundColor: "rgba(245, 158, 11, 0.08)",
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Authentication Required
          </Typography>
          <Typography>Please log in to view your meeting history</Typography>
        </Alert>
      </Box>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Box
        sx={{
          p: 4,
          background: "linear-gradient(135deg, #F0F9F9 0%, #EBF4FC 50%, #F5F7FA 100%)",
          minHeight: "100vh",
        }}
      >
        <Skeleton variant="text" sx={{ fontSize: "2rem", mb: 2 }} />
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={6} md={3} key={i}>
              <Skeleton variant="rounded" height={100} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
        <Skeleton
          variant="rectangular"
          width="100%"
          height={60}
          sx={{ mb: 3, borderRadius: 3 }}
        />
        {[...Array(5)].map((_, index) => (
          <Skeleton
            key={index}
            variant="rectangular"
            width="100%"
            height={80}
            sx={{ mb: 2, borderRadius: 3 }}
          />
        ))}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 3,
        background: "linear-gradient(135deg, #F0F9F9 0%, #EBF4FC 50%, #F5F7FA 100%)",
        minHeight: "100vh",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 4,
              height: 32,
              background: "linear-gradient(180deg, #1A8A8A 0%, #2D7DD2 100%)",
              borderRadius: 2,
            }}
          />
          <Typography variant="h4" sx={{ fontWeight: 600, color: "#1F2937" }}>
            Meeting History
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ color: "#6B7280" }}>
            {user.name || user.full_name || user.email}
          </Typography>
          <Tooltip title="Refresh">
            <IconButton
              onClick={handleRefresh}
              disabled={refreshing}
              sx={{
                backgroundColor: "white",
                border: "1px solid #E5E7EB",
                color: "#6B7280",
                "&:hover": {
                  backgroundColor: "#F3F4F6",
                },
              }}
            >
              <Refresh
                sx={{
                  animation: refreshing ? "spin 1s linear infinite" : "none",
                  "@keyframes spin": {
                    "0%": { transform: "rotate(0deg)" },
                    "100%": { transform: "rotate(360deg)" },
                  },
                }}
              />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            borderRadius: 3,
            border: "1px solid rgba(239, 68, 68, 0.3)",
            backgroundColor: "rgba(239, 68, 68, 0.05)",
          }}
          onClose={clearError}
        >
          {error}
        </Alert>
      )}

 

      {/* Search Bar with Filter */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 3,
          backgroundColor: "white",
          border: "1px solid #E5E7EB",
        }}
      >
        <Box
          sx={{
            display: "flex",
            gap: 2,
            alignItems: "center",
            flexWrap: { xs: "wrap", md: "nowrap" },
          }}
        >
          <TextField
            fullWidth
            placeholder="Search meetings by title, host, or participants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: "#9CA3AF" }} />
                </InputAdornment>
              ),
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 2,
                backgroundColor: "#F9FAFB",
                "& fieldset": {
                  borderColor: "#E5E7EB",
                },
                "&:hover fieldset": {
                  borderColor: "#2D7DD2",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "#2D7DD2",
                },
              },
            }}
          />

          <Button
            variant="outlined"
            onClick={(e) => setFilterAnchor(e.currentTarget)}
            endIcon={<ExpandMore />}
            sx={{
              minWidth: { xs: "100%", md: 200 },
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
              borderColor: "#E5E7EB",
              color: "#1F2937",
              backgroundColor: "white",
              "&:hover": {
                borderColor: "#2D7DD2",
                backgroundColor: "rgba(45, 125, 210, 0.05)",
              },
            }}
          >
            {filterOptions.find((f) => f.value === selectedFilter)?.label || "Filter"}
          </Button>
        </Box>
      </Paper>

      {/* Results Info */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="body2" sx={{ color: "#6B7280" }}>
          Showing {filteredMeetings.length > 0 ? startIndex + 1 : 0}-
          {Math.min(endIndex, filteredMeetings.length)} of {filteredMeetings.length} meetings
        </Typography>
        {selectedFilter !== "all" && (
          <Chip
            label={`Filter: ${filterOptions.find((f) => f.value === selectedFilter)?.label}`}
            onDelete={() => setSelectedFilter("all")}
            size="small"
            sx={{
              backgroundColor: "#2D7DD220",
              color: "#2D7DD2",
              fontWeight: 500,
              "& .MuiChip-deleteIcon": {
                color: "#2D7DD2",
                "&:hover": { color: "#1E6BB8" },
              },
            }}
          />
        )}
      </Box>

      {/* Meetings List */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          backgroundColor: "white",
          border: "1px solid #E5E7EB",
          overflow: "hidden",
        }}
      >
        {currentMeetings.length === 0 ? (
          <Box sx={{ p: 8, textAlign: "center" }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: 3,
                background: "linear-gradient(135deg, rgba(26, 138, 138, 0.1) 0%, rgba(45, 125, 210, 0.1) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto",
                mb: 2,
              }}
            >
              <VideoCall sx={{ fontSize: 40, color: "#2D7DD2" }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: "#1F2937", mb: 1 }}>
              No meetings found
            </Typography>
            <Typography variant="body2" sx={{ color: "#6B7280" }}>
              {searchTerm
                ? "Try adjusting your search terms"
                : "Your meeting history will appear here"}
            </Typography>
            <Button
              variant="contained"
              startIcon={<VideoCall />}
              onClick={() => navigate("/meeting/instant")}
              sx={{
                mt: 3,
                textTransform: "none",
                backgroundColor: "#1A8A8A",
                "&:hover": { backgroundColor: "#157575" },
              }}
            >
              Start a Meeting
            </Button>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {currentMeetings.map((meeting, index) => (
              <React.Fragment key={meeting.id}>
                <ListItem
                  onClick={() => handleMeetingClick(meeting)}
                  sx={{
                    px: 3,
                    py: 2.5,
                    cursor: "pointer",
                    transition: "all 0.2s ease-in-out",
                    "&:hover": {
                      backgroundColor: "rgba(45, 125, 210, 0.03)",
                      "& .meeting-title": {
                        color: "#2D7DD2",
                      },
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      width: "100%",
                      gap: 2,
                    }}
                  >
                    {/* Meeting Icon */}
                    <Avatar
                      sx={{
                        width: 48,
                        height: 48,
                        background: "linear-gradient(135deg, #1A8A8A 0%, #2D7DD2 100%)",
                        color: "white",
                        boxShadow: "0 4px 14px rgba(45, 125, 210, 0.3)",
                      }}
                    >
                      <VideoCall />
                    </Avatar>

                    {/* Meeting Info */}
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={1.5}
                        sx={{ mb: 0.5, flexWrap: "wrap" }}
                      >
                        <Typography
                          variant="subtitle1"
                          className="meeting-title"
                          sx={{
                            fontWeight: 600,
                            color: "#1F2937",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            transition: "color 0.2s ease",
                          }}
                        >
                          {meeting.title}
                        </Typography>

                        {meeting.is_host ? (
                          <Chip
                            icon={<Person sx={{ fontSize: 14 }} />}
                            label="Hosted"
                            size="small"
                            sx={{
                              backgroundColor: "rgba(26, 138, 138, 0.1)",
                              color: "#1A8A8A",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              height: 22,
                              border: "1px solid rgba(26, 138, 138, 0.2)",
                              "& .MuiChip-icon": {
                                color: "#1A8A8A",
                              },
                            }}
                          />
                        ) : (
                          <Chip
                            icon={<Groups sx={{ fontSize: 14 }} />}
                            label="Participated"
                            size="small"
                            sx={{
                              backgroundColor: "rgba(245, 158, 11, 0.1)",
                              color: "#F59E0B",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              height: 22,
                              border: "1px solid rgba(245, 158, 11, 0.2)",
                              "& .MuiChip-icon": {
                                color: "#F59E0B",
                              },
                            }}
                          />
                        )}

                        <MeetingTypeBadge type={meeting.type || meeting.meeting_type} />

                        {meeting.recording && (
                          <Tooltip title="Recording available">
                            <Chip
                              icon={<PlayArrow sx={{ fontSize: 14 }} />}
                              label="Recording"
                              size="small"
                              sx={{
                                backgroundColor: "rgba(16, 185, 129, 0.1)",
                                color: "#10B981",
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                height: 22,
                                border: "1px solid rgba(16, 185, 129, 0.2)",
                                "& .MuiChip-icon": {
                                  color: "#10B981",
                                },
                              }}
                            />
                          </Tooltip>
                        )}
                      </Stack>

                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={3}
                        sx={{ flexWrap: "wrap" }}
                      >
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <AccessTime sx={{ fontSize: 16, color: "#6B7280" }} />
                          <Typography variant="body2" sx={{ color: "#6B7280" }}>
                            {formatMeetingDate(meeting.date)}
                          </Typography>
                        </Stack>

                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Timer sx={{ fontSize: 16, color: "#6B7280" }} />
                          <Typography variant="body2" sx={{ color: "#6B7280" }}>
                            {formatDurationDisplay(meeting)}
                          </Typography>
                        </Stack>

                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Groups sx={{ fontSize: 16, color: "#6B7280" }} />
                          <Typography variant="body2" sx={{ color: "#6B7280" }}>
                            {meeting.participants} participant
                            {meeting.participants !== 1 ? "s" : ""}
                          </Typography>
                        </Stack>

                        {!meeting.is_host && (
                          <Typography variant="body2" sx={{ color: "#6B7280" }}>
                            Host: {meeting.host}
                          </Typography>
                        )}
                      </Stack>
                    </Box>

                    {/* Actions */}
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Tooltip title={meeting.starred ? "Unstar" : "Star"}>
                        <IconButton
                          size="small"
                          onClick={(e) => handleStarToggle(e, meeting.id)}
                          sx={{
                            color: meeting.starred ? "#F59E0B" : "#9CA3AF",
                            transition: "all 0.2s ease",
                            "&:hover": {
                              color: "#F59E0B",
                              backgroundColor: "rgba(245, 158, 11, 0.1)",
                            },
                          }}
                        >
                          {meeting.starred ? <Star /> : <StarBorder />}
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Box>
                </ListItem>
                {index < currentMeetings.length - 1 && (
                  <Divider sx={{ mx: 3, borderColor: "#E5E7EB" }} />
                )}
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            sx={{
              "& .MuiPaginationItem-root": {
                borderRadius: 2,
                fontWeight: 500,
                color: "#1F2937",
                borderColor: "#E5E7EB",
                "&.Mui-selected": {
                  backgroundColor: "#2D7DD2",
                  color: "white",
                  "&:hover": {
                    backgroundColor: "#2570C3",
                  },
                },
                "&:hover": {
                  backgroundColor: "rgba(45, 125, 210, 0.1)",
                },
              },
            }}
          />
        </Box>
      )}

      {/* Filter Menu */}
      <Menu
        anchorEl={filterAnchor}
        open={Boolean(filterAnchor)}
        onClose={() => setFilterAnchor(null)}
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
            mt: 1,
            border: "1px solid #E5E7EB",
            backgroundColor: "white",
            minWidth: 200,
          },
        }}
      >
        {filterOptions.map((filter) => (
          <MenuItem
            key={filter.value}
            onClick={() => handleFilterClick(filter.value)}
            selected={selectedFilter === filter.value}
            sx={{
              py: 1.5,
              px: 2,
              gap: 1.5,
              fontWeight: selectedFilter === filter.value ? 600 : 400,
              color: selectedFilter === filter.value ? "#2D7DD2" : "#1F2937",
              backgroundColor:
                selectedFilter === filter.value
                  ? "rgba(45, 125, 210, 0.08)"
                  : "transparent",
              "&:hover": {
                backgroundColor: "rgba(45, 125, 210, 0.08)",
              },
            }}
          >
            <Box
              sx={{
                color: selectedFilter === filter.value ? "#2D7DD2" : "#6B7280",
              }}
            >
              {filter.icon}
            </Box>
            {filter.label}
          </MenuItem>
        ))}
      </Menu>


      {/* Meeting Details Dialog */}
      <MeetingDetailsDialog
        open={detailsDialogOpen}
        meeting={viewMeeting}
        onClose={() => {
          setDetailsDialogOpen(false);
          setViewMeeting(null);
        }}
      />
    </Box>
  );
};

export default MeetingHistory;