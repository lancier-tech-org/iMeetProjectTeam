// src/pages/AnalyticsPage.jsx - Professional Analytics Dashboard
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Paper,
  Button,
  ButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ListSubheader,
  LinearProgress,
  useTheme,
  alpha,
  IconButton,
  Alert,
  CircularProgress,
  TextField,
  Stack,
  Chip,
  Avatar,
  Divider,
  Tooltip,
  Badge,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Collapse,
  Fade,
  Zoom,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Group as GroupIcon,
  AccessTime as AccessTimeIcon,
  VideoCall as VideoIcon,
  Assessment as AssessmentIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  SupervisorAccount as SupervisorAccountIcon,
  Refresh as RefreshIcon,
  Psychology,
  Visibility,
  VisibilityOff,
  Timeline,
  Speed,
  Settings,
  ExpandMore,
  ExpandLess,
  CheckCircle,
  Warning,
  Info,
  Lightbulb,
  RemoveRedEye,
  PersonPin,
  Print,
  TableChart as TableChartIcon,
  CalendarToday,
  Timer,
  People,
  Dashboard,
  FullscreenExit,
  Fullscreen,
  PictureAsPdf,
  GridOn,
  ViewModule,
  Analytics,
  Summarize,
  FileDownload,
  OpenInNew,
  MoreVert,
  ZoomIn,
  ZoomOut,
  Search,
  Close,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Description as DescriptionIcon
} from '@mui/icons-material';
import { useAnalytics } from '../hooks/useAnalytics';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { analyticsAPI } from "../services/api";

const AnalyticsPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    analyticsData,
    loading,
    error,
    fetchHostOverview,
    fetchHostMeetingReports,
    fetchHostEngagementDistribution,
    fetchHostTrends,
    fetchParticipantPersonalReport,
    fetchParticipantAttendance,
    fetchParticipantEngagement,
    getUserStats,
    generateParticipantReportPDF,
    generateHostReportPDF,
    clearError
  } = useAnalytics();

  // State Management
  const [timeFilter, setTimeFilter] = useState('today');
  const [meetingFilter, setMeetingFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [userRole, setUserRole] = useState('participant');
  const [personalStats, setPersonalStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [meetingTimeFilter, setMeetingTimeFilter] = useState('');
  const [availableMeetingTimes, setAvailableMeetingTimes] = useState([]);
  const [isLoadingMeetingTimes, setIsLoadingMeetingTimes] = useState(false);
  
  // Host Meetings State
  const [hostMeetingsData, setHostMeetingsData] = useState([]);
  const [isLoadingHostMeetings, setIsLoadingHostMeetings] = useState(false);
  
  // Participant Meetings State
  const [participantMeetingsData, setParticipantMeetingsData] = useState([]);
  const [isLoadingParticipantMeetings, setIsLoadingParticipantMeetings] = useState(false);
  
  // Report Modal State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedMeetingForReport, setSelectedMeetingForReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  
  // Table States
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [orderBy, setOrderBy] = useState('date');
  const [order, setOrder] = useState('desc');
  
  // UI States
  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    meetings: true,
    engagement: true,
    trends: true,
    summary: true
  });
  const [showFilters, setShowFilters] = useState(true);

  // Professional Color Palette - Dark Professional Theme
  const colors = {
    primary: '#1e3a5f',
    primaryLight: '#2d5a87',
    primaryDark: '#0f2744',
    secondary: '#1565c0',
    secondaryLight: '#1976d2',
    accent: '#0288d1',
    success: '#00897b',
    warning: '#f57c00',
    error: '#d32f2f',
    info: '#0277bd',
    background: '#f8fafc',
    surface: '#ffffff',
    textPrimary: '#1e293b',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    gradients: {
      primary: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)',
      secondary: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
      success: 'linear-gradient(135deg, #00897b 0%, #26a69a 100%)',
      dark: 'linear-gradient(135deg, #37474f 0%, #546e7a 100%)',
      purple: 'linear-gradient(135deg, #5e35b1 0%, #7e57c2 100%)',
      cyan: 'linear-gradient(135deg, #00838f 0%, #00acc1 100%)',
      mixed: 'linear-gradient(135deg, #1e3a5f 0%, #1565c0 100%)',
      card1: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)',
      card2: 'linear-gradient(135deg, #1565c0 0%, #1e88e5 100%)',
      card3: 'linear-gradient(135deg, #00897b 0%, #26a69a 100%)',
      card4: 'linear-gradient(135deg, #37474f 0%, #546e7a 100%)'
    }
  };

  // Auto-populate dates when time period changes
  useEffect(() => {
    const calculateDateRange = () => {
      const today = new Date();
      let startDate = new Date();
      
      switch (timeFilter) {
        case 'today': 
          startDate = new Date(today); // Same day
          break;
        case '7days': startDate.setDate(today.getDate() - 7); break;
        case '30days': startDate.setDate(today.getDate() - 30); break;
        case '90days': startDate.setDate(today.getDate() - 90); break;
        case '1year': startDate.setDate(today.getDate() - 365); break;
        default: startDate = new Date(today); // Default to today
      }
      
      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      setDateRange({ start: formatDate(startDate), end: formatDate(today) });
      setMeetingTimeFilter('');
    };
    
    calculateDateRange();
  }, [timeFilter]);
// ✅ ADD THIS NEW USEEFFECT - Fetch available meeting times
useEffect(() => {
  console.log('📅 useEffect triggered: Fetching available meeting times');
  console.log('📅 Current state:', { dateRange, userRole, userId: user?.id });
  
  if (userRole === 'participant' && user?.id && dateRange.start && dateRange.end) {
    fetchAvailableMeetingTimes('participant');
  } else if (userRole === 'host' && user?.id && dateRange.start && dateRange.end) {
    fetchAvailableMeetingTimes('host');
  }
}, [dateRange.start, dateRange.end, userRole, user?.id]);
  // Fetch Host Meetings from API
  const fetchHostMeetings = useCallback(async () => {
    if (!user?.id) return;
    try {
      setIsLoadingHostMeetings(true);
      console.log('📊 Fetching host meetings for user:', user.id);
      const response = await analyticsAPI.getHostMeetings(user.id);
      console.log('📊 Host meetings API response:', response);
      
      // Handle different response formats
      let data = [];
      if (response?.data) {
        data = response.data;
      } else if (response?.success && response?.data) {
        data = response.data;
      } else if (Array.isArray(response)) {
        data = response;
      }
      
      console.log('📊 Extracted meetings data:', data);
      setHostMeetingsData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('❌ Error fetching host meetings:', error);
      setHostMeetingsData([]);
    } finally {
      setIsLoadingHostMeetings(false);
    }
  }, [user?.id]);

  // Fetch Participant Meetings from API
  const fetchParticipantMeetings = useCallback(async () => {
    if (!user?.id) return;
    try {
      setIsLoadingParticipantMeetings(true);
      console.log('📊 Fetching participant meetings for user:', user.id);
      
      const params = {};
      if (dateRange.start) params.start_date = dateRange.start;
      if (dateRange.end) params.end_date = dateRange.end;
      
      const response = await analyticsAPI.getParticipantMeetings(user.id, params);
    console.log('📊 PARTICIPANT MEETINGS RESPONSE:', response);  // ← ADD THIS
       if (response?.data && response.data[0]) {
      console.log('📊 First participant meeting keys:', Object.keys(response.data[0]));
      console.log('📊 Check for problematic fields:', {
        hasJoinTimes: 'Join_Times' in response.data[0],
        hasLeaveTimes: 'Leave_Times' in response.data[0],
        hasJoinTime: 'join_time' in response.data[0],
        hasLeaveTime: 'leave_time' in response.data[0]
      });
    }
      // Handle different response formats
      let data = [];
      if (response?.data) {
        data = response.data;
      } else if (response?.success && response?.data) {
        data = response.data;
      } else if (Array.isArray(response)) {
        data = response;
      }
      
      console.log('📊 Extracted participant meetings data:', data);
      setParticipantMeetingsData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('❌ Error fetching participant meetings:', error);
      setParticipantMeetingsData([]);
    } finally {
      setIsLoadingParticipantMeetings(false);
    }
  }, [user?.id, dateRange.start, dateRange.end]);

  // Fetch host meetings when user or role changes
  useEffect(() => {
    if (userRole === 'host' && user?.id) {
      fetchHostMeetings();
    }
  }, [userRole, user?.id, fetchHostMeetings]);

  // Fetch participant meetings when user or role changes
  useEffect(() => {
    if (userRole === 'participant' && user?.id) {
      fetchParticipantMeetings();
    }
  }, [userRole, user?.id, fetchParticipantMeetings, dateRange]);

  // Also fetch when component mounts for host users
  useEffect(() => {
    if (user?.id) {
      // Try to fetch host meetings to check if user is a host
      fetchHostMeetings();
    }
  }, [user?.id, fetchHostMeetings]);

  // Determine user role based on host meetings
  useEffect(() => {
    const determineUserRole = async () => {
      if (!user?.id) return;
      try {
        setIsLoadingStats(true);
        console.log('📊 Determining user role for user:', user.id);
        
        // Use the working host meetings API to check if user is a host
        const response = await analyticsAPI.getHostMeetings(user.id);
        console.log('📊 Host meetings response for role check:', response);
        
        let hostMeetings = [];
        if (response?.data) {
          hostMeetings = response.data;
        } else if (Array.isArray(response)) {
          hostMeetings = response;
        }
        
        const meetingCount = Array.isArray(hostMeetings) ? hostMeetings.length : 0;
        console.log('📊 User has hosted', meetingCount, 'meetings');
        
        // Calculate stats from host meetings
        const totalMinutes = hostMeetings.reduce((sum, m) => sum + (parseFloat(m.total_duration_minutes) || 0), 0);
        const totalParticipants = hostMeetings.reduce((sum, m) => sum + (parseInt(m.total_participants) || 0), 0);
        
        const calculatedStats = {
          totalMeetings: meetingCount,
          totalHostedMeetings: meetingCount,
          totalMinutes: Math.round(totalMinutes),
          totalParticipants: totalParticipants,
          averageAttendance: meetingCount > 0 ? 85 : 0, // Default value since we don't have this data
          upcomingCount: 0
        };
        
        if (meetingCount > 0) {
          setUserRole('host');
          console.log('✅ User role set to HOST');
        } else {
          setUserRole('participant');
          console.log('✅ User role set to PARTICIPANT');
        }
        
        setPersonalStats(calculatedStats);
        setHostMeetingsData(hostMeetings);
      } catch (error) {
        console.error('❌ Error determining user role:', error);
        setUserRole('participant');
        setPersonalStats({
          totalMeetings: 0,
          totalHostedMeetings: 0,
          totalMinutes: 0,
          averageAttendance: 0,
          upcomingCount: 0
        });
      } finally {
        setIsLoadingStats(false);
      }
    };
    
    if (user) determineUserRole();
  }, [user]);
 
  // Fetch analytics data - Only use working APIs
  useEffect(() => {
    const fetchAnalyticsData = async () => {
      if (!user?.id || isLoadingStats) return;
      
      console.log('📊 Fetching analytics data for role:', userRole);
      
      // For host role, data is already loaded via fetchHostMeetings
      // For participant role, we now use fetchParticipantMeetings
      if (userRole === 'host') {
        // Host data is already loaded in hostMeetingsData
        console.log('📊 Host data already available:', hostMeetingsData.length, 'meetings');
      } else {
        // Participant data is loaded via fetchParticipantMeetings
        console.log('📊 Participant data available:', participantMeetingsData.length, 'meetings');
      }
    };
    
    if (user && !isLoadingStats) fetchAnalyticsData();
  }, [timeFilter, meetingFilter, dateRange, userRole, user, isLoadingStats, hostMeetingsData.length, participantMeetingsData.length]);

  // Handlers
  const handleBackToDashboard = () => navigate('/dashboard');
// ============================================================================
// 🎯 FIXED fetchAvailableMeetingTimes FUNCTION FOR FRONTEND
// Replace this function in your AnalyticsPage.jsx (around line 423)
// ============================================================================

const fetchAvailableMeetingTimes = async (role) => {
  try {
    setIsLoadingMeetingTimes(true);
    console.log('📅 Fetching available meeting times for role:', role);
    console.log('📅 Params:', { 
      user_id: user?.id, 
      start_date: dateRange.start, 
      end_date: dateRange.end,
      role_type: role 
    });
    
    const params = {
      user_id: user?.id,
      userId: user?.id,
      start_date: dateRange.start,
      end_date: dateRange.end,
      role_type: role,
      meeting_type: 'all',           // Include all meeting types
  include_instant: true,          // Explicitly include instant meetings
  include_scheduled: true,        // Explicitly include scheduled meetings  
  include_calendar: true          // Explicitly include calendar meetings
    };
    
    const response = await analyticsAPI.getAvailableMeetingTimes(params);
    
    console.log('📅 Full API response:', response);
    
    // ============================================
    // 🎯 HANDLE RESPONSE AND VALIDATE TIME FIELDS
    // ============================================
    let meetingTimes = [];
    
    if (response?.data && Array.isArray(response.data)) {
      console.log('✅ Found meetings in response.data');
      meetingTimes = response.data;
    } else if (Array.isArray(response?.data?.data)) {
      console.log('✅ Found meetings in response.data.data');
      meetingTimes = response.data.data;
    } else if (Array.isArray(response)) {
      console.log('✅ Found meetings - response is direct array');
      meetingTimes = response;
    } else {
      console.warn('⚠️ Unexpected response format:', response);
      meetingTimes = [];
    }
    
    // ============================================
    // 🔍 VALIDATE AND LOG TIME SOURCES
    // ============================================
    console.log('🔍 VALIDATING MEETING TIMES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const validatedMeetings = meetingTimes.map((meeting, index) => {
      console.log(`\n📋 Meeting ${index + 1}: ${meeting.meeting_name}`);
      console.log(`  ├─ Meeting ID: ${meeting.meeting_id}`);
      console.log(`  ├─ Display Time: ${meeting.display_time}`);
      console.log(`  ├─ Full DateTime: ${meeting.full_datetime}`);
      console.log(`  ├─ Meeting Start Time: ${meeting.meeting_start_time || 'NULL'}`);
      console.log(`  ├─ Join Time: ${meeting.join_time || 'NULL'}`);
      console.log(`  └─ Time Source: ${meeting.time_source || 'unknown'}`);
      
      // Validate that display_time exists
      if (!meeting.display_time) {
        console.error(`  ❌ ERROR: No display_time for meeting ${meeting.meeting_id}`);
      }
      
      // Check if time source is from join_time (fallback)
      if (meeting.time_source === 'join_times[0]') {
        console.warn(`  ⚠️ WARNING: Using join_time fallback (meeting_start_time was NULL)`);
      }
      
      return meeting;
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📅 Total validated meetings: ${validatedMeetings.length}`);
    
    setAvailableMeetingTimes(validatedMeetings);
    
  } catch (error) {
    console.error('❌ Error fetching meeting times:', error);
    console.error('❌ Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    setAvailableMeetingTimes([]);
  } finally {
    setIsLoadingMeetingTimes(false);
  }
};

// ============================================================================
// 📝 USAGE INSTRUCTIONS:
// ============================================================================
// 1. Open your AnalyticsPage.jsx file
// 2. Find the fetchAvailableMeetingTimes function (around line 423)
// 3. Replace the entire function with this code above
// 4. Save the file
// 5. Check browser console - you'll see detailed logs showing:
//    - Which meetings are found
//    - What display_time is being used
//    - Whether it's using meeting_start_time or join_time fallback
//    - Any errors or warnings
// ============================================================================
  const handleRoleSwitch = (role) => {
    setUserRole(role);
    setPage(0);
  };

  // View Meeting Handler - Navigate to meeting details page
 const handleViewMeeting = (meeting) => {
  console.log('📊 Navigating to meeting details:', meeting.meetingId);
  console.log('📊 Full meeting object:', meeting);
  console.log('📊 occurrence_number:', meeting.occurrence_number, 'occurrenceNumber:', meeting.occurrenceNumber);
  navigate(`/analytics/meeting/${meeting.meetingId}`, { 
    state: { 
      meeting: {
        ...meeting,
        occurrence_number: meeting.occurrence_number || meeting.occurrenceNumber || null
      }
    } 
  });
};

// ============================================
// REPLACE handleViewReport function (around line 340-390)
// ============================================

// Handle View Report - Open Modal
const handleViewReport = async (meeting) => {
  console.log('📊 Opening report for meeting:', meeting);
  console.log('🔍 DEBUG - occurrenceNumber:', meeting.occurrenceNumber);
  setSelectedMeetingForReport(meeting);
  setReportModalOpen(true);
  setIsLoadingReport(true);
  setReportError(null);
  setReportData(null);
  
  try {
    // FIXED: Pass occurrence_number for ScheduleMeeting
    const response = await analyticsAPI.getParticipantReportData(
      meeting.meetingId, 
      user?.id,
      meeting.occurrenceNumber  // NEW: Pass occurrence_number
    );
    
    // ... rest of the code stays same
    console.log("========== FULL API RESPONSE ==========");
    console.log("Top level keys:", Object.keys(response));
    console.log("Full response:", JSON.stringify(response, null, 2));
    
    if (response.violations_data) {
      console.log("✅ FOUND violations_data:", response.violations_data);
    }
    if (response.report_data?.violations_data) {
      console.log("✅ FOUND report_data.violations_data:", response.report_data.violations_data);
    }
    console.log("=========================================");
    
    let data = response;
    if (response?.data) {
      data = response.data;
      console.log('📊 Using response.data');
    }
    
    setReportData(data);
  } catch (error) {
    console.error('❌ Error fetching report:', error);
    setReportError(error.message || 'Failed to load report data');
  } finally {
    setIsLoadingReport(false);
  }
};

  // Handle Download Report PDF
  const handleDownloadReportPDF = async () => {
  if (!selectedMeetingForReport || !user?.id) return;
  
  setIsDownloadingPDF(true);
  try {
    console.log('📊 Downloading PDF for meeting:', selectedMeetingForReport.meetingId);
    console.log('📊 Occurrence number:', selectedMeetingForReport.occurrenceNumber);
    
    // FIXED: Pass occurrence_number for ScheduleMeeting
    await analyticsAPI.downloadParticipantReportPDF(
      selectedMeetingForReport.meetingId, 
      user.id,
      user.name || user.email || 'participant',
      selectedMeetingForReport.occurrenceNumber  // NEW: Pass occurrence_number
    );
    
    console.log('✅ PDF download completed');
  } catch (error) {
    console.error('❌ Error downloading PDF:', error);
    setReportError(error.message || 'Failed to download PDF');
  } finally {
    setIsDownloadingPDF(false);
  }
};

  // Close Report Modal
  const handleCloseReportModal = () => {
    setReportModalOpen(false);
    setSelectedMeetingForReport(null);
    setReportData(null);
    setReportError(null);
  };

  const handleExportReport = async () => {
    try {
      if (userRole === 'host') {
        await generateHostReportPDF({
          host_id: user?.id,
          start_date: dateRange.start,
          end_date: dateRange.end,
          meeting_time: meetingTimeFilter || undefined
        });
      } else {
        await generateParticipantReportPDF({
          user_id: user?.id,
          start_date: dateRange.start,
          end_date: dateRange.end,
          meeting_time: meetingTimeFilter || undefined
        });
      }
    } catch (error) {
      console.error('Error exporting report:', error);
    }
  };

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (event, newPage) => setPage(newPage);
  
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleDownloadSection = (sectionName, data) => {
    const csvContent = convertToCSV(data);
    downloadFile(csvContent, `${sectionName}_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
  };

  const convertToCSV = (data) => {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(header => JSON.stringify(row[header] || '')).join(','));
    return [headers.join(','), ...rows].join('\n');
  };

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Safe data access with default values
  const safeAnalyticsData = useMemo(() => {
    const comprehensiveData = analyticsData.comprehensiveData || {};
    const overallSummary = comprehensiveData.overall_summary || {};
    
    let hostMeetings = [];
    if (Array.isArray(analyticsData.hostMeetings) && analyticsData.hostMeetings.length > 0) {
      hostMeetings = analyticsData.hostMeetings;
    } else if (Array.isArray(comprehensiveData.meeting_analytics) && comprehensiveData.meeting_analytics.length > 0) {
      hostMeetings = comprehensiveData.meeting_analytics;
    } else if (Array.isArray(comprehensiveData.participant_details) && comprehensiveData.participant_details.length > 0) {
      const meetingsMap = {};
      comprehensiveData.participant_details.forEach(item => {
        const meetingId = item.meeting_id;
        if (!meetingsMap[meetingId]) {
          meetingsMap[meetingId] = {
            meeting_id: meetingId,
            meeting_name: item.meeting_info?.meeting_name || item.meeting_name || 'Meeting',
            meeting_type: item.meeting_type,
            participants: [],
            total_duration: 0
          };
        }
        meetingsMap[meetingId].participants.push(item);
        meetingsMap[meetingId].total_duration += parseFloat(item.duration_analysis?.total_duration_minutes || 0);
      });
      
      hostMeetings = Object.values(meetingsMap).map(meeting => ({
        meeting_id: meeting.meeting_id,
        meeting_name: meeting.meeting_name,
        meeting_type: meeting.meeting_type,
        participant_analytics: {
          total_participants: meeting.participants.length,
          avg_participant_duration_minutes: meeting.total_duration / meeting.participants.length
        },
        duration_analytics: {
          total_duration_minutes: meeting.total_duration,
          average_duration_minutes: meeting.total_duration / meeting.participants.length
        }
      }));
    }

    return {
      hostOverview: analyticsData.hostOverview || overallSummary || {},
      hostMeetings: hostMeetings,
      hostEngagement: analyticsData.hostEngagement || { distribution: comprehensiveData.host_analytics || [] },
      hostTrends: analyticsData.hostTrends || { trends: [] },
      participantReport: analyticsData.participantReport || {},
      participantAttendance: analyticsData.participantAttendance || [],
      participantEngagement: analyticsData.participantEngagement || { engagementRecords: [], summary: {} }
    };
  }, [analyticsData]);

  // Process table data
  const attendanceTableData = useMemo(() => {
    const attendance = safeAnalyticsData.participantAttendance || [];
    if (!Array.isArray(attendance)) return [];
    return attendance.map((item, index) => ({
      id: index + 1,
      meetingName: item.meeting_name || item.meeting_info?.meeting_name || 'Meeting',
      meetingType: item.meeting_type || 'N/A',
      date: item.meeting_info?.started_at || item.started_at || 'N/A',
      attendance: Math.round(item.participant_attendance_metrics?.overall_attendance || 0),
      engagement: Math.round(item.attendance_session?.engagement_score || 0),
      focus: Math.round(item.attendance_session?.focus_score || 0),
      duration: Math.round(item.duration_analysis?.total_duration_minutes || 0),
      status: item.status || 'Completed'
    }));
  }, [safeAnalyticsData.participantAttendance]);

  const engagementTableData = useMemo(() => {
    const engagement = safeAnalyticsData.participantEngagement?.engagementRecords || [];
    if (!Array.isArray(engagement) || engagement.length === 0) return [];
    return engagement.map((record, index) => {
      const durationAnalysis = record.duration_analysis || {};
      const attendanceSession = record.attendance_session || {};
      return {
        id: index + 1,
        meetingName: record.meeting_info?.meeting_name || record.meeting_name || 'Meeting',
        totalDuration: Math.round(durationAnalysis.total_duration_minutes || 0),
        engagementScore: Math.round(attendanceSession.engagement_score || 0),
        focusScore: Math.round(attendanceSession.focus_score || 0),
        breakTime: Math.round((attendanceSession.total_break_time_used || 0) / 60),
        participationRate: Math.round(durationAnalysis.participation_rate || 0),
        status: attendanceSession.status || 'N/A'
      };
    });
  }, [safeAnalyticsData.participantEngagement]);

  // Host Meetings Table Data - Using API data with filtering
const hostMeetingsTableData = useMemo(() => {
  console.log('📊 Processing hostMeetingsData:', hostMeetingsData);
  console.log('📊 Current filters:', { dateRange, meetingFilter, meetingTimeFilter });
  
  let meetings = hostMeetingsData || [];
  
  if (!Array.isArray(meetings) || meetings.length === 0) {
    console.log('⚠️ No meetings data available');
    return [];
  }

  console.log('📊 Total meetings before filtering:', meetings.length);

  // Filter by date range
  let filteredMeetings = meetings.filter(meeting => {
    const meetingDate = meeting.start_date || meeting.date || meeting.started_at;
    if (!meetingDate) return true;
    
    try {
      const meetingDateObj = new Date(meetingDate);
      const startDateObj = dateRange.start ? new Date(dateRange.start + 'T00:00:00') : null;
      const endDateObj = dateRange.end ? new Date(dateRange.end + 'T23:59:59') : null;
      
      if (startDateObj && meetingDateObj < startDateObj) return false;
      if (endDateObj && meetingDateObj > endDateObj) return false;
      return true;
    } catch (e) {
      return true;
    }
  });

  console.log('📊 After date filter:', filteredMeetings.length);

  // Filter by meeting type
  if (meetingFilter && meetingFilter !== 'all') {
    filteredMeetings = filteredMeetings.filter(meeting => {
      const type = (meeting.meeting_type || '').toLowerCase();
      const filter = meetingFilter.toLowerCase();
      return type.includes(filter.replace('meeting', '').trim());
    });
    console.log('📊 After type filter:', filteredMeetings.length);
  }

  // ✅ NEW: Filter by specific meeting time (meetingTimeFilter)
  if (meetingTimeFilter && meetingTimeFilter !== '') {
    console.log('📊 Applying meetingTimeFilter:', meetingTimeFilter);
    filteredMeetings = filteredMeetings.filter(meeting => {
      const meetingDateTime = meeting.start_date || meeting.date || meeting.started_at || meeting.meeting_start_time;
      
      if (!meetingDateTime) return false;
      
      try {
        // Normalize both dates for comparison
        const filterDate = new Date(meetingTimeFilter);
        const meetingDate = new Date(meetingDateTime);
        
        // Compare by matching the date and approximate time (within 2 minute tolerance)
        const timeDiff = Math.abs(filterDate.getTime() - meetingDate.getTime());
        const twoMinutes = 2 * 60 * 1000;
        
        const matchesByTime = timeDiff < twoMinutes;
        
        // Also try matching by meeting_id if embedded in filter string
        const matchesByMeetingId = meeting.meeting_id && 
          (meetingTimeFilter.includes(meeting.meeting_id) || 
           meeting.meeting_id === meetingTimeFilter);
        
        return matchesByTime || matchesByMeetingId;
      } catch (e) {
        console.warn('⚠️ Error comparing meeting times:', e);
        return false;
      }
    });
    console.log('📊 After specific meeting filter:', filteredMeetings.length);
  }

  // Map to table format
  const tableData = filteredMeetings.map((item, index) => ({
    id: index + 1,
    meetingId: item.meeting_id,
    meetingName: item.meeting_name || 'Meeting',
    meetingType: item.meeting_type || 'N/A',
    date: item.start_date || 'N/A',
    hostName: item.host_name || 'Unknown Host',
    totalDuration: Math.round(parseFloat(item.total_duration_minutes) || 0),
    participants: parseInt(item.total_participants) || 0,
    participantAttendance: Math.round(parseFloat(item.participant_attendance) || 0),
    status: 'Completed',
    occurrenceNumber: item.occurrence_number || null,
    occurrence_number: item.occurrence_number || null,
    originalData: item
  }));

  console.log('📊 Final host table data:', tableData);
  return tableData;
}, [hostMeetingsData, dateRange, meetingFilter, meetingTimeFilter, user]);
  // Participant Meetings Table Data - Using API data with filtering
  // Participant Meetings Table Data - Using API data with filtering

const participantMeetingsTableData = useMemo(() => {
  console.log('📊 Processing participantMeetingsData:', participantMeetingsData);
  console.log('📊 Current filters:', { dateRange, meetingFilter, meetingTimeFilter });
  
  let meetings = participantMeetingsData || [];
  
  if (!Array.isArray(meetings) || meetings.length === 0) {
    return [];
  }

  // Filter by date range
  let filteredMeetings = meetings.filter(meeting => {
    const meetingDate = meeting.start_date || meeting.date || meeting.started_at;
    if (!meetingDate) return true;
    
    try {
      const meetingDateObj = new Date(meetingDate);
      const startDateObj = dateRange.start ? new Date(dateRange.start + 'T00:00:00') : null;
      const endDateObj = dateRange.end ? new Date(dateRange.end + 'T23:59:59') : null;
      
      if (startDateObj && meetingDateObj < startDateObj) return false;
      if (endDateObj && meetingDateObj > endDateObj) return false;
      return true;
    } catch (e) {
      return true;
    }
  });

  console.log('📊 After date filter:', filteredMeetings.length);

  // Filter by meeting type
  if (meetingFilter && meetingFilter !== 'all') {
    filteredMeetings = filteredMeetings.filter(meeting => {
      const type = (meeting.meeting_type || '').toLowerCase();
      const filter = meetingFilter.toLowerCase();
      return type.includes(filter.replace('meeting', '').trim());
    });
    console.log('📊 After type filter:', filteredMeetings.length);
  }

  // ✅ NEW: Filter by specific meeting time (meetingTimeFilter)
  if (meetingTimeFilter && meetingTimeFilter !== '') {
    console.log('📊 Applying meetingTimeFilter for participant:', meetingTimeFilter);
    filteredMeetings = filteredMeetings.filter(meeting => {
      const meetingDateTime = meeting.start_date || meeting.date || meeting.started_at || meeting.meeting_start_time;
      
      if (!meetingDateTime) return false;
      
      try {
        const filterDate = new Date(meetingTimeFilter);
        const meetingDate = new Date(meetingDateTime);
        
        const timeDiff = Math.abs(filterDate.getTime() - meetingDate.getTime());
        const twoMinutes = 2 * 60 * 1000;
        
        const matchesByTime = timeDiff < twoMinutes;
        const matchesByMeetingId = meeting.meeting_id && 
          (meetingTimeFilter.includes(meeting.meeting_id) || 
           meeting.meeting_id === meetingTimeFilter);
        
        return matchesByTime || matchesByMeetingId;
      } catch (e) {
        console.warn('⚠️ Error comparing meeting times:', e);
        return false;
      }
    });
    console.log('📊 After specific meeting filter:', filteredMeetings.length);
  }

  const tableData = filteredMeetings.map((item, index) => {
    return {
      id: index + 1,
      meetingId: item.meeting_id,
      meetingName: item.meeting_name || 'Meeting',
      meetingType: item.meeting_type || 'N/A',
      date: item.start_date || 'N/A',
      hostName: item.host_name || 'Unknown Host',
      totalDuration: Math.round(parseFloat(item.total_duration_minutes) || 0),
      participantAttendance: Math.round(parseFloat(item.participant_attendance) || 0),
      status: 'Completed',
      occurrenceNumber: item.occurrence_number || null,
      originalData: item
    };
  });

  console.log('📊 Final participant table data:', tableData);
  return tableData;
}, [participantMeetingsData, dateRange, meetingFilter, meetingTimeFilter]);
  const hostTrendsTableData = useMemo(() => {
    const trends = safeAnalyticsData.hostTrends?.trends || [];
    if (!Array.isArray(trends)) return [];
    return trends.map((item, index) => ({
      id: index + 1,
      meetingType: item.meeting_type || 'N/A',
      totalMeetings: item.meeting_counts?.total_meetings_hosted || 0,
      totalParticipants: item.meeting_counts?.total_participants || 0,
      avgDuration: Math.round(item.meeting_counts?.avg_duration_minutes || 0),
      period: item.period || 'N/A'
    }));
  }, [safeAnalyticsData.hostTrends]);

  // Helper Functions
  const sortData = (data, orderBy, order) => {
    return [...data].sort((a, b) => {
      let aValue = a[orderBy];
      let bValue = b[orderBy];
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      if (order === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString === 'N/A') return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getMeetingTypeColor = (type) => {
    const typeStr = (type || '').toLowerCase();
    if (typeStr.includes('instant')) return 'primary';
    if (typeStr.includes('schedule')) return 'secondary';
    if (typeStr.includes('calendar')) return 'success';
    return 'default';
  };

  const getStatusColor = (status) => {
    const statusStr = (status || '').toLowerCase();
    if (statusStr === 'completed' || statusStr === 'active') return 'success';
    if (statusStr === 'scheduled') return 'info';
    if (statusStr === 'cancelled') return 'error';
    return 'default';
  };

  const getScoreColor = (score) => {
    if (score >= 80) return colors.success;
    if (score >= 60) return colors.warning;
    return colors.error;
  };

  // ============================================
  // PROFESSIONAL UI COMPONENTS
  // ============================================

  // Section Header Component with View, Overview, Download buttons
 // Section Header Component with Accordion Toggle
const SectionHeader = ({ title, icon: Icon, section, data, subtitle, badge }) => (
  <Box 
    onClick={() => toggleSection(section)}
    sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      mb: expandedSections[section] ? 2.5 : 0,
      pb: 1.5,
      borderBottom: `2px solid ${colors.border}`,
      cursor: 'pointer',
      borderRadius: '8px',
      px: 1,
      py: 0.5,
      mx: -1,
      transition: 'all 0.2s ease',
      '&:hover': {
        bgcolor: alpha(colors.primary, 0.04)
      }
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{
        p: 1,
        borderRadius: '10px',
        background: colors.gradients.mixed,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon sx={{ fontSize: 22, color: '#fff' }} />
      </Box>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.textPrimary }}>
            {title}
          </Typography>
          {badge && (
            <Chip 
              label={badge} 
              size="small" 
              sx={{ 
                background: colors.gradients.cyan,
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.65rem',
                height: 20
              }} 
            />
          )}
        </Box>
        {subtitle && (
          <Typography variant="caption" sx={{ color: colors.textSecondary }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
    
    {/* Accordion Toggle Icon */}
    <IconButton
      size="small"
      onClick={(e) => {
        e.stopPropagation();
        toggleSection(section);
      }}
      sx={{
        bgcolor: alpha(colors.primary, 0.1),
        '&:hover': { bgcolor: alpha(colors.primary, 0.2) },
        transition: 'transform 0.3s ease',
        transform: expandedSections[section] ? 'rotate(180deg)' : 'rotate(0deg)'
      }}
    >
      <ExpandMore sx={{ color: colors.primary }} />
    </IconButton>
  </Box>
);

  // Compact Stat Card with Gradient
  const StatCard = ({ icon: Icon, value, label, trend, color, gradient }) => (
    <Card sx={{
      height: '100%',
      background: gradient || colors.surface,
      borderRadius: '14px',
      boxShadow: '0 4px 16px rgba(30, 58, 95, 0.15)',
      border: gradient ? 'none' : `1px solid ${colors.border}`,
      transition: 'all 0.3s ease',
      '&:hover': {
        transform: 'translateY(-3px)',
        boxShadow: '0 8px 25px rgba(30, 58, 95, 0.25)'
      }
    }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{
            p: 1,
            borderRadius: '10px',
            bgcolor: gradient ? 'rgba(255,255,255,0.2)' : alpha(color || colors.primary, 0.1)
          }}>
            <Icon sx={{ fontSize: 22, color: gradient ? '#fff' : (color || colors.primary) }} />
          </Box>
          {trend && (
            <Chip
              label={trend}
              size="small"
              sx={{
                bgcolor: gradient ? 'rgba(255,255,255,0.25)' : alpha(colors.success, 0.1),
                color: gradient ? '#fff' : colors.success,
                fontWeight: 600,
                fontSize: '0.65rem',
                height: '20px',
                '& .MuiChip-label': { px: 1 }
              }}
            />
          )}
        </Box>
        <Typography sx={{ 
          fontWeight: 800, 
          color: gradient ? '#fff' : colors.textPrimary,
          mb: 0.25,
          fontSize: '1.75rem',
          lineHeight: 1.2
        }}>
          {value}
        </Typography>
        <Typography variant="caption" sx={{ 
          color: gradient ? 'rgba(255,255,255,0.9)' : colors.textSecondary,
          fontWeight: 500,
          fontSize: '0.75rem'
        }}>
          {label}
        </Typography>
      </CardContent>
    </Card>
  );

  // Professional Table Header Cell
  const StyledTableCell = ({ children, sortKey, align = 'left' }) => (
    <TableCell
      align={align}
      sx={{
        fontWeight: 700,
        backgroundColor: colors.background,
        color: colors.primary,
        borderBottom: `2px solid ${colors.primary}`,
        py: 2,
        whiteSpace: 'nowrap'
      }}
    >
      {sortKey ? (
        <TableSortLabel
          active={orderBy === sortKey}
          direction={orderBy === sortKey ? order : 'asc'}
          onClick={() => handleRequestSort(sortKey)}
          sx={{
            '&.Mui-active': { color: colors.primary },
            '& .MuiTableSortLabel-icon': { color: `${colors.primary} !important` },
          }}
        >
          {children}
        </TableSortLabel>
      ) : children}
    </TableCell>
  );

  // Score Indicator Component
  const ScoreIndicator = ({ score, label }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: 700, color: getScoreColor(score), minWidth: 40 }}>
        {score}%
      </Typography>
      <LinearProgress
        variant="determinate"
        value={score}
        sx={{
          width: 60,
          height: 8,
          borderRadius: 4,
          backgroundColor: alpha(colors.primary, 0.1),
          '& .MuiLinearProgress-bar': {
            backgroundColor: getScoreColor(score),
            borderRadius: 4
          }
        }}
      />
    </Box>
  );

  // Professional Data Table Component
  const DataTable = ({ columns, data, emptyMessage }) => {
    const sortedData = sortData(data, orderBy, order);
    const paginatedData = sortedData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    
    return (
      <>
        {data.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: '12px' }}>
            {emptyMessage || 'No data available for the selected filters.'}
          </Alert>
        ) : (
          <>
            <TableContainer component={Paper} sx={{ 
              borderRadius: '12px', 
              boxShadow: 'none', 
              border: `1px solid ${colors.border}`,
              overflow: 'hidden'
            }}>
              <Table>
                <TableHead>
                  <TableRow>
                    {columns.map((col, idx) => (
                      <StyledTableCell key={idx} sortKey={col.sortKey} align={col.align}>
                        {col.label}
                      </StyledTableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedData.map((row, rowIdx) => (
                    <TableRow
                      key={row.id || rowIdx}
                      sx={{
                        '&:nth-of-type(odd)': { backgroundColor: alpha(colors.background, 0.5) },
                        '&:hover': { backgroundColor: alpha(colors.primary, 0.05) },
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      {columns.map((col, colIdx) => (
                        <TableCell key={colIdx} align={col.align} sx={{ py: 2 }}>
                          {col.render ? col.render(row) : row[col.field]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={data.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={{ 
                mt: 2,
                '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                  fontWeight: 500
                }
              }}
            />
          </>
        )}
      </>
    );
  };

// ============================================
// COMPLETE FULL REPORT MODAL COMPONENT
// File: src/pages/AnalyticsPage.jsx
// Component: Inside AnalyticsPage, find handleViewReport function
// Replace the ReportModal component with this COMPLETE code
// ============================================

const ReportModal = () => {
  // ===== FORMAT DATETIME FOR DISPLAY =====
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

// ✅ CORRECTED - Handles ARRAY of join_times from backend
const getJoinTime = () => {
  if (!reportData) return null;
  
  // PRIMARY: join_times is an ARRAY like ["2025-12-17 06:46:30"]
  const join_times_array = reportData?.report_data?.participation_details?.join_times;
  if (join_times_array && Array.isArray(join_times_array) && join_times_array.length > 0) {
    return join_times_array[0]; // Return FIRST element
  }
  
  // SECONDARY: Check for singular join_time field
  if (reportData?.report_data?.participation_details?.join_time) {
    return reportData.report_data.participation_details.join_time;
  }
  
  // FALLBACK checks
  if (reportData?.participation_details?.join_times?.length > 0) {
    return reportData.participation_details.join_times[0];
  }
  if (reportData?.join_time) return reportData.join_time;
  
  return null;
};

// ✅ CORRECTED - Handles ARRAY of leave_times from backend
const getLeaveTime = () => {
  if (!reportData) return null;
  
  // PRIMARY: leave_times is an ARRAY like ["2025-12-17 07:15:45"]
  const leave_times_array = reportData?.report_data?.participation_details?.leave_times;
  if (leave_times_array && Array.isArray(leave_times_array) && leave_times_array.length > 0) {
    return leave_times_array[leave_times_array.length - 1]; // Return LAST element
  }
  
  // SECONDARY: Check for singular leave_time field
  if (reportData?.report_data?.participation_details?.leave_time) {
    return reportData.report_data.participation_details.leave_time;
  }
  
  // FALLBACK checks
  if (reportData?.participation_details?.leave_times?.length > 0) {
    return reportData.participation_details.leave_times[reportData.participation_details.leave_times.length - 1];
  }
  if (reportData?.leave_time) return reportData.leave_time;
  
  return null;
};


  // ===== GET DURATION - Data is in report_data.participation_details =====
  const getDuration = () => {
    if (!reportData) return 0;
    
    let value = null;
    
    // PRIMARY: Check nested report_data.participation_details
    if (reportData?.report_data?.participation_details?.duration_minutes !== undefined) {
      value = reportData.report_data.participation_details.duration_minutes;
    } else if (reportData?.report_data?.participation_details?.total_duration) {
      value = reportData.report_data.participation_details.total_duration;
    }
    
    // Fallback: Check direct participation_details
    if (value === null && reportData?.participation_details?.duration_minutes !== undefined) {
      value = reportData.participation_details.duration_minutes;
    }
    
    // Fallback: Check direct fields
    if (value === null) {
      if (reportData?.duration_minutes !== undefined) value = reportData.duration_minutes;
      else if (reportData?.duration !== undefined) value = reportData.duration;
      else if (reportData?.['Duration'] !== undefined) value = reportData['Duration'];
    }
    
    if (value === null || value === undefined) return 0;
    
    // Handle string like "0.47 minutes"
    if (typeof value === 'string') {
      const cleanValue = value.replace(/\s*minutes?\s*/gi, '').trim();
      const num = parseFloat(cleanValue);
      return isNaN(num) ? 0 : num;
    }
    
    return typeof value === 'number' ? value : parseFloat(value) || 0;
  };

  // ===== GET ATTENDANCE - Multiple sources =====
  const getAttendance = () => {
    if (!reportData) return 0;
    
    let value = null;
    
    // PRIMARY: Check top-level participant_attendance (number: 68.08)
    if (reportData?.participant_attendance !== undefined) {
      value = reportData.participant_attendance;
    }
    
    // Check nested report_data.participation_details
    if (value === null && reportData?.report_data?.participation_details?.participant_attendance !== undefined) {
      value = reportData.report_data.participation_details.participant_attendance;
    }
    
    // Check nested report_data.attendance_monitoring
    if (value === null && reportData?.report_data?.attendance_monitoring?.attendance_percentage !== undefined) {
      value = reportData.report_data.attendance_monitoring.attendance_percentage;
    }
    
    // Fallback
    if (value === null) {
      if (reportData?.attendance_percentage !== undefined) value = reportData.attendance_percentage;
      else if (reportData?.['Attendance Percentage'] !== undefined) value = reportData['Attendance Percentage'];
    }
    
    if (value === null || value === undefined) return 0;
    
    // Handle string like "68.08%" or "100.0%"
    if (typeof value === 'string') {
      const num = parseFloat(value.replace('%', '').trim());
      return isNaN(num) ? 0 : num;
    }
    
    return typeof value === 'number' ? value : parseFloat(value) || 0;
  };

  // ===== GET ENGAGEMENT SCORE - Data is in report_data.attendance_monitoring =====
  const getEngagementScore = () => {
    if (!reportData) return 0;
    
    let value = null;
    
    // PRIMARY: Check nested report_data.attendance_monitoring.engagement_score
    if (reportData?.report_data?.attendance_monitoring?.engagement_score !== undefined) {
      value = reportData.report_data.attendance_monitoring.engagement_score;
    }
    
    // Fallback: Check direct attendance_monitoring
    if (value === null && reportData?.attendance_monitoring?.engagement_score !== undefined) {
      value = reportData.attendance_monitoring.engagement_score;
    }
    
    // Fallback: Direct fields
    if (value === null) {
      if (reportData?.engagement_score !== undefined) value = reportData.engagement_score;
      else if (reportData?.['Engagement Score'] !== undefined) value = reportData['Engagement Score'];
    }
    
    if (value === null || value === undefined) return 0;
    
    // Handle "100 / 100" format
    if (typeof value === 'string' && value.includes('/')) {
      const parts = value.split('/');
      const score = parseFloat(parts[0].trim());
      const max = parseFloat(parts[1].trim());
      return max > 0 ? Math.round((score / max) * 100) : 0;
    }
    
    return typeof value === 'number' ? value : parseFloat(value) || 0;
  };

  // ===== GET FOCUS SCORE =====
  const getFocusScore = () => {
    if (!reportData) return 0;
    
    if (reportData?.report_data?.attendance_monitoring?.focus_score !== undefined) {
      return parseFloat(reportData.report_data.attendance_monitoring.focus_score) || 0;
    }
    if (reportData?.focus_score !== undefined) return parseFloat(reportData.focus_score) || 0;
    if (reportData?.['Focus Score'] !== undefined) return parseFloat(reportData['Focus Score']) || 0;
    
    return 0;
  };

  // ===== GET PARTICIPANT NAME =====
  const getParticipantName = () => {
    if (reportData?.participant_name) return reportData.participant_name;
    if (reportData?.['Participant']) return reportData['Participant'];
    if (reportData?.participant_info?.name) return reportData.participant_info.name;
    if (reportData?.user_name) return reportData.user_name;
    return user?.name || 'N/A';
  };

  // ===== GET MEETING NAME =====
  const getMeetingName = () => {
    if (reportData?.meeting_name) return reportData.meeting_name;
    if (reportData?.['Meeting']) return reportData['Meeting'];
    if (reportData?.meeting_info?.meeting_name) return reportData.meeting_info.meeting_name;
    return selectedMeetingForReport?.meetingName || 'N/A';
  };

  // ===== GET MEETING TYPE =====
  const getMeetingType = () => {
    if (reportData?.meeting_type) return reportData.meeting_type;
    if (reportData?.['Type']) return reportData['Type'];
    if (reportData?.meeting_info?.meeting_type) return reportData.meeting_info.meeting_type;
    return selectedMeetingForReport?.meetingType || 'N/A';
  };

  // ===== GET MEETING DATE =====
  const getMeetingDate = () => {
    if (reportData?.meeting_date) return reportData.meeting_date;
    if (reportData?.['Date']) return reportData['Date'];
    if (reportData?.start_date) return reportData.start_date;
    if (reportData?.meeting_info?.start_time) return reportData.meeting_info.start_time;
    return selectedMeetingForReport?.date || 'N/A';
  };

  // ===== GET CAMERA VERIFIED AT - Data is in report_data.detection_counts =====
  const getCameraVerifiedAt = () => {
    if (reportData?.report_data?.detection_counts?.camera_verified_at) {
      return reportData.report_data.detection_counts.camera_verified_at;
    }
    if (reportData?.detection_counts?.camera_verified_at) {
      return reportData.detection_counts.camera_verified_at;
    }
    if (reportData?.camera_verified_at) return reportData.camera_verified_at;
    return null;
  };

  // ===== GET RAW ENGAGEMENT SCORE STRING (for display as "100 / 100") =====
  const getEngagementScoreRaw = () => {
    if (reportData?.report_data?.attendance_monitoring?.engagement_score) {
      return reportData.report_data.attendance_monitoring.engagement_score;
    }
    if (reportData?.attendance_monitoring?.engagement_score) {
      return reportData.attendance_monitoring.engagement_score;
    }
    return `${getEngagementScore()} / 100`;
  };

  // ===== GET RAW ATTENDANCE PERCENTAGE STRING (for display as "68.08%") =====
  const getAttendancePercentageRaw = () => {
    if (reportData?.report_data?.attendance_monitoring?.attendance_percentage) {
      return reportData.report_data.attendance_monitoring.attendance_percentage;
    }
    if (reportData?.report_data?.participation_details?.participant_attendance) {
      return reportData.report_data.participation_details.participant_attendance;
    }
    return `${getAttendance().toFixed(2)}%`;
  };

  // ===== GET BREAK SESSIONS - ENHANCED SEARCH =====
  const getBreakSessions = () => {
    if (!reportData) return [];
    
    console.log("🔍 DEBUG: Searching for break_sessions in reportData:", {
      hasReportData: !!reportData?.report_data,
      hasBreakSessions: !!reportData?.report_data?.break_sessions,
      directBreakSessions: !!reportData?.break_sessions,
      hasAttendanceMonitoring: !!reportData?.report_data?.attendance_monitoring,
      breakSessionsCount: reportData?.report_data?.break_sessions?.length || 0,
      allKeys: Object.keys(reportData || {})
    });
    
    // PRIMARY: Check nested report_data.break_sessions
    if (Array.isArray(reportData?.report_data?.break_sessions)) {
      console.log("✅ Found break_sessions in report_data.break_sessions");
      return reportData.report_data.break_sessions;
    }
    
    // SECONDARY: Check direct break_sessions
    if (Array.isArray(reportData?.break_sessions)) {
      console.log("✅ Found break_sessions in direct break_sessions");
      return reportData.break_sessions;
    }
    
    // TERTIARY: Check attendance_monitoring.break_sessions
    if (Array.isArray(reportData?.report_data?.attendance_monitoring?.break_sessions)) {
      console.log("✅ Found break_sessions in attendance_monitoring");
      return reportData.report_data.attendance_monitoring.break_sessions;
    }
    
    // QUATERNARY: Check all keys to see if there's a similar field
    if (reportData?.report_data) {
      const allKeys = Object.keys(reportData.report_data);
      console.log("📋 All keys in report_data:", allKeys);
      
      // Look for any field containing "break"
      const breakKey = allKeys.find(key => key.toLowerCase().includes('break'));
      if (breakKey && Array.isArray(reportData.report_data[breakKey])) {
        console.log(`✅ Found break data at: report_data.${breakKey}`);
        return reportData.report_data[breakKey];
      }
    }
    
    console.log("⚠️ No break_sessions found in any location");
    return [];
  };

  // ===== GET IDENTITY WARNINGS - ENHANCED SEARCH =====
// ===== GET IDENTITY WARNINGS - FIXED VERSION =====
const getIdentityWarnings = () => {
  if (!reportData) return [];
  
  console.log("🔍 DEBUG: Searching for identity_warnings:", {
    hasReportData: !!reportData,
    allKeys: Object.keys(reportData || {}),
  });
  
  // ✅ PRIMARY: Check detection_counts.identity_warnings (your current location)
  if (Array.isArray(reportData?.report_data?.detection_counts?.identity_warnings)) {
    console.log("✅ FOUND! identity_warnings in detection_counts");
    return reportData.report_data.detection_counts.identity_warnings;
  }
  
  // ✅ NEW: Check inside violations_data (from PDF structure)
  const violationsData = reportData?.violations_data || reportData?.report_data?.violations_data;
  if (violationsData && Array.isArray(violationsData.identity_warnings)) {
    console.log("✅ FOUND! identity_warnings in violations_data (PDF FORMAT)");
    return violationsData.identity_warnings;
  }
  
  // ... rest of your existing fallback checks ...
  console.log("⚠️ No identity_warnings found");
  return [];
};
  // ===== GET VIOLATIONS DATA - NEW FUNCTION =====
 // ===== GET VIOLATIONS DATA - FIXED VERSION =====
const getViolations = () => {
  if (!reportData) return [];
  
  console.log("🔍 DEBUG: Searching for violations in reportData:", {
    hasReportData: !!reportData,
    allKeys: Object.keys(reportData || {}),
    violationsRaw: reportData?.violations,
    reportDataRaw: reportData?.report_data,
  });
  
  // ✅ PRIMARY: Check if violations exist at top level
  if (Array.isArray(reportData?.violations)) {
    console.log("✅ FOUND! violations at top level - Type: Warnings");
    // Map to standard format
    return (reportData.violations || []).map((v, idx) => ({
      id: idx + 1,
      type: v.violation_type || v.type || 'Warning',
      timestamp: v.timestamp || v.detected_at || 'N/A',
      details: v.message || v.details || 'N/A',
      severity: v.severity || 'medium',
      duration: v.duration || 'N/A',
      penalty: v.penalty || '0%'
    }));
  }
  
  // ✅ SECONDARY: Check inside report_data object
  if (Array.isArray(reportData?.report_data?.violations)) {
    console.log("✅ FOUND! violations in report_data.violations");
    return (reportData.report_data.violations || []).map((v, idx) => ({
      id: idx + 1,
      type: v.violation_type || v.type || 'Warning',
      timestamp: v.timestamp || v.detected_at || 'N/A',
      details: v.message || v.details || 'N/A',
      severity: v.severity || 'medium',
      duration: v.duration || 'N/A',
      penalty: v.penalty || '0%'
    }));
  }
  
  // ✅ TERTIARY: Check inside violations_data object (from PDF structure)
  const violationsData = reportData?.violations_data || reportData?.report_data?.violations_data;
  if (violationsData && typeof violationsData === 'object') {
    const warnings = violationsData.warnings || [];
    if (Array.isArray(warnings) && warnings.length > 0) {
      console.log("✅ FOUND! violations in violations_data.warnings (PDF FORMAT)");
      return warnings.map((w, idx) => ({
        id: idx + 1,
        type: w.violation_type || w.type || 'Warning',
        timestamp: w.timestamp || w.detected_at || 'N/A',
        details: w.message || w.details || 'N/A',
        severity: w.severity || 'medium',
        duration: w.duration || 'N/A',
        penalty: w.penalty || '0%'
      }));
    }
  }
  
  console.log("⚠️ No violations found in any location");
  return [];
};

  // ===== GET DETECTION EVENTS - NEW FUNCTION =====
 // ===== GET DETECTION EVENTS - FIXED VERSION =====
const getDetectionEvents = () => {
  if (!reportData) return [];
  
  console.log("🔍 DEBUG: Searching for detection events in reportData:", {
    hasReportData: !!reportData,
    allKeys: Object.keys(reportData || {}),
  });
  
  // ✅ PRIMARY: Check detection_counts array directly
  if (Array.isArray(reportData?.report_data?.detection_counts)) {
    const data = reportData.report_data.detection_counts;
    // Check if it's an array of detection events
    if (data.length > 0 && data[0].violation_type) {
      console.log("✅ FOUND! detection_counts is detection events array");
      return data.map((d, idx) => ({
        id: idx + 1,
        timestamp: d.timestamp || d.detected_at || 'N/A',
        violation_type: d.violation_type || d.type || 'N/A',
        duration: d.duration || 'N/A',
        penalty: d.penalty_applied || d.penalty || '0%',
        message: d.message || d.details || 'N/A'
      }));
    }
  }
  
  // ✅ SECONDARY: Check violations_data.detections (from PDF structure)
  const violationsData = reportData?.violations_data || reportData?.report_data?.violations_data;
  if (violationsData && typeof violationsData === 'object') {
    const detections = violationsData.detections || violationsData.detection_events || [];
    if (Array.isArray(detections) && detections.length > 0) {
      console.log("✅ FOUND! detection events in violations_data.detections (PDF FORMAT)");
      return detections.map((d, idx) => ({
        id: idx + 1,
        timestamp: d.timestamp || d.detected_at || 'N/A',
        violation_type: d.violation_type || d.type || 'N/A',
        duration: d.duration || 'N/A',
        penalty: d.penalty_applied || d.penalty || '0%',
        message: d.message || d.details || 'N/A'
      }));
    }
  }
  
  // ✅ TERTIARY: Check for direct detection_events field
  if (Array.isArray(reportData?.detection_events)) {
    console.log("✅ FOUND! detection_events at top level");
    return reportData.detection_events.map((d, idx) => ({
      id: idx + 1,
      timestamp: d.timestamp || d.detected_at || 'N/A',
      violation_type: d.violation_type || d.type || 'N/A',
      duration: d.duration || 'N/A',
      penalty: d.penalty_applied || d.penalty || '0%',
      message: d.message || d.details || 'N/A'
    }));
  }
  
  console.log("⚠️ No detection events found in any location");
  return [];
};

  // ===== GET WARNINGS TABLE DATA - NEW FUNCTION =====
  const getWarningsTableData = () => {
    if (!reportData) return [];
    
    console.log("🔍 DEBUG: Searching for warnings table data in reportData:", {
      hasReportData: !!reportData?.report_data,
      hasWarnings: !!reportData?.report_data?.warnings,
      allReportDataKeys: Object.keys(reportData?.report_data || {}),
    });
    
    // PRIMARY: Check warnings field
    if (Array.isArray(reportData?.report_data?.warnings)) {
      console.log("✅ FOUND! warnings in report_data.warnings");
      console.log("📊 Count:", reportData.report_data.warnings.length);
      return reportData.report_data.warnings;
    }
    
    // SECONDARY: Check direct warnings
    if (Array.isArray(reportData?.warnings)) {
      console.log("✅ FOUND! warnings at top level");
      console.log("📊 Count:", reportData.warnings.length);
      return reportData.warnings;
    }
    
    // TERTIARY: Check for warning_data
    if (Array.isArray(reportData?.report_data?.warning_data)) {
      console.log("✅ FOUND! warning_data in report_data");
      console.log("📊 Count:", reportData.report_data.warning_data.length);
      return reportData.report_data.warning_data;
    }
    
    console.log("⚠️ No warnings table data found");
    return [];
  };

  // ============================================
  // RETURN DIALOG - COMPLETE JSX
  // ============================================

  return (
    <Dialog 
      open={reportModalOpen} 
      onClose={handleCloseReportModal}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        background: colors.gradients.mixed, 
        color: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        py: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
            <DescriptionIcon />
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Participant Report
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {selectedMeetingForReport?.meetingName || 'Meeting Report'}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={handleCloseReportModal} sx={{ color: '#fff' }}>
          <Close />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        {isLoadingReport ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
            <CircularProgress size={48} sx={{ color: colors.primary, mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              Loading report data...
            </Typography>
          </Box>
        ) : reportError ? (
          <Alert severity="error" sx={{ borderRadius: '12px' }}>
            {reportError}
          </Alert>
        ) : reportData ? (
          <Box>
            {/* ========== Participant Info Section ========== */}
            <Card sx={{ mb: 3, borderRadius: '12px', border: `1px solid ${colors.border}` }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.primary, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon sx={{ fontSize: 20 }} />
                  Participant Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Name</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {getParticipantName()}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Email</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {reportData.participant_email || reportData.user_email || user?.email || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Role</Typography>
                    <Chip 
                      label={reportData.role || 'Participant'} 
                      size="small" 
                      color="primary"
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Status</Typography>
                    <Chip 
                      label={reportData.status || 'Completed'} 
                      size="small" 
                      color={getStatusColor(reportData.status || 'completed')}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* ========== Meeting Info Section ========== */}
            <Card sx={{ mb: 3, borderRadius: '12px', border: `1px solid ${colors.border}` }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.primary, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <VideoIcon sx={{ fontSize: 20 }} />
                  Meeting Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Meeting Name</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {getMeetingName()}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Host</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {reportData.host_name || selectedMeetingForReport?.hostName || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Meeting Date</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {formatDate(getMeetingDate())}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Meeting Type</Typography>
                    <Chip 
                      label={getMeetingType()} 
                      size="small" 
                      color={getMeetingTypeColor(getMeetingType())}
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Meeting Duration</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {getDuration().toFixed(2)} minutes
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Meeting ID</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {reportData.meeting_id || selectedMeetingForReport?.meetingId || 'N/A'}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* ========== Attendance Metrics Section ========== */}
            <Card sx={{ mb: 3, borderRadius: '12px', border: `1px solid ${colors.border}` }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.primary, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingUpIcon sx={{ fontSize: 20 }} />
                  Attendance Metrics
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: alpha(colors.primary, 0.05), borderRadius: '12px' }}>
                      <Typography variant="h4" sx={{ fontWeight: 800, color: colors.primary }}>
                        {getAttendance().toFixed(1)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Attendance</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: alpha(colors.success, 0.05), borderRadius: '12px' }}>
                      <Typography variant="h4" sx={{ fontWeight: 800, color: colors.success }}>
                        {getDuration().toFixed(2)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Duration (min)</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: alpha(colors.info, 0.05), borderRadius: '12px' }}>
                      <Typography variant="h4" sx={{ fontWeight: 800, color: colors.info }}>
                        {getEngagementScore()}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Engagement</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: alpha(colors.warning, 0.05), borderRadius: '12px' }}>
                      <Typography variant="h4" sx={{ fontWeight: 800, color: colors.warning }}>
                        {getFocusScore()}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Focus Score</Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* ========== Participation Details Section ========== */}
            <Card sx={{ mb: 3, borderRadius: '12px', border: `1px solid ${colors.border}` }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.primary, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Timer sx={{ fontSize: 20 }} />
                  Participation Details
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, borderBottom: `1px solid ${colors.border}`, width: '50%' }}>Duration</TableCell>
                        <TableCell sx={{ borderBottom: `1px solid ${colors.border}` }}>
                          {getDuration().toFixed(2)} minutes
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, borderBottom: `1px solid ${colors.border}` }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CheckCircle sx={{ fontSize: 16, color: colors.success }} />
                            Join Times
                          </Box>
                        </TableCell>
                        <TableCell sx={{ borderBottom: `1px solid ${colors.border}` }}>
                          {getJoinTime() || 'N/A'}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, borderBottom: `1px solid ${colors.border}` }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Warning sx={{ fontSize: 16, color: colors.warning }} />
                            Leave Times
                          </Box>
                        </TableCell>
                        <TableCell sx={{ borderBottom: `1px solid ${colors.border}` }}>
                          {getLeaveTime() || 'N/A'}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Participant Attendance</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ fontWeight: 600, color: getScoreColor(getAttendance()) }}>
                              {getAttendance().toFixed(2)}%
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(getAttendance(), 100)}
                              sx={{
                                width: 80,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: alpha(colors.primary, 0.1),
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: getScoreColor(getAttendance()),
                                  borderRadius: 4
                                }
                              }}
                            />
                          </Box>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            {/* ========== Attendance Monitoring & Behavior Section ========== */}
            <Card sx={{ mb: 3, borderRadius: '12px', border: `1px solid ${colors.border}` }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.primary, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Psychology sx={{ fontSize: 20 }} />
                  Attendance Monitoring & Behavior
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, borderBottom: `1px solid ${colors.border}`, width: '50%' }}>Engagement Score</TableCell>
                        <TableCell sx={{ borderBottom: `1px solid ${colors.border}` }}>
                          <Typography sx={{ fontWeight: 600, color: getScoreColor(getEngagementScore()) }}>
                            {getEngagementScoreRaw()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Attendance Percentage</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ fontWeight: 600, color: getScoreColor(getAttendance()) }}>
                              {getAttendancePercentageRaw()}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(getAttendance(), 100)}
                              sx={{
                                width: 80,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: alpha(colors.primary, 0.1),
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: getScoreColor(getAttendance()),
                                  borderRadius: 4
                                }
                              }}
                            />
                          </Box>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            {/* ========== Detection Counts Section ========== */}
            {getCameraVerifiedAt() && (
              <Card sx={{ mb: 3, borderRadius: '12px', border: `1px solid ${colors.border}` }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.primary, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Visibility sx={{ fontSize: 20 }} />
                    Detection Counts
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, width: '50%' }}>camera_verified_at</TableCell>
                          <TableCell>
                            {getCameraVerifiedAt()}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            )}

            {/* ========== Break Sessions Section ========== */}
            {getBreakSessions().length > 0 && (
              <Card sx={{ mb: 3, borderRadius: '12px', border: `1px solid ${colors.success}`, bgcolor: alpha(colors.success, 0.02) }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.success, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Timer sx={{ fontSize: 20 }} />
                    Break Sessions ({getBreakSessions().length})
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha(colors.success, 0.1), color: colors.success }}>Break #</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha(colors.success, 0.1), color: colors.success }}>Start Time</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha(colors.success, 0.1), color: colors.success }}>End Time</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha(colors.success, 0.1), color: colors.success }}>Duration (sec)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {getBreakSessions().map((breakSession, idx) => (
                          <TableRow key={idx} sx={{ '&:hover': { bgcolor: alpha(colors.success, 0.03) } }}>
                            <TableCell sx={{ fontWeight: 600 }}>{idx + 1}</TableCell>
                            <TableCell>{formatDateTime(breakSession.start_time || breakSession.startTime || breakSession.break_start)}</TableCell>
                            <TableCell>{formatDateTime(breakSession.end_time || breakSession.endTime || breakSession.break_end)}</TableCell>
                            <TableCell>
                              <Chip 
                                label={`${breakSession.duration || breakSession.duration_seconds || breakSession.duration_sec || 0} sec`}
                                size="small"
                                color="success"
                                variant="outlined"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            )}

            {/* ========== Identity Warnings Section ========== */}
            {getIdentityWarnings().length > 0 && (
              <Card sx={{ mb: 3, borderRadius: '12px', border: `1px solid #9c27b0`, bgcolor: alpha('#9c27b0', 0.02) }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#9c27b0', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Warning sx={{ fontSize: 20 }} />
                    Identity Warnings ({getIdentityWarnings().length})
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha('#9c27b0', 0.1), color: '#9c27b0' }}>#</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha('#9c27b0', 0.1), color: '#9c27b0' }}>Timestamp</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha('#9c27b0', 0.1), color: '#9c27b0' }}>Cycle #</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha('#9c27b0', 0.1), color: '#9c27b0' }}>Total #</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha('#9c27b0', 0.1), color: '#9c27b0' }}>Consec Sec</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha('#9c27b0', 0.1), color: '#9c27b0' }}>Similarity</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha('#9c27b0', 0.1), color: '#9c27b0' }}>Unknown Sec</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha('#9c27b0', 0.1), color: '#9c27b0' }}>Cycle</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha('#9c27b0', 0.1), color: '#9c27b0' }}>ID Rem</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha('#9c27b0', 0.1), color: '#9c27b0' }}>Beh Rem</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {getIdentityWarnings().map((warning, idx) => (
                          <TableRow key={idx} sx={{ '&:nth-of-type(odd)': { bgcolor: alpha('#9c27b0', 0.03) } }}>
                            <TableCell sx={{ fontWeight: 600 }}>{idx + 1}</TableCell>
                            <TableCell sx={{ fontSize: '0.8rem' }}>{formatDateTime(warning.timestamp || warning.detected_at || warning.time)}</TableCell>
                            <TableCell>{warning.cycle_number || warning.cycle_num || warning.cycleNumber || 'N/A'}</TableCell>
                            <TableCell>{warning.total_number || warning.total_num || warning.totalNumber || 'N/A'}</TableCell>
                            <TableCell>{warning.consecutive_seconds || warning.consec_sec || warning.consecutiveSec || 'N/A'}</TableCell>
                            <TableCell>{warning.similarity || warning.similarity_score || 'N/A'}</TableCell>
                            <TableCell>{warning.unknown_seconds || warning.unknown_sec || warning.unknownSec || 'N/A'}</TableCell>
                            <TableCell>{warning.cycle || 'N/A'}</TableCell>
                            <TableCell>{warning.id_reminder || warning.id_rem || warning.idRem || 0}</TableCell>
                            <TableCell>{warning.behavior_reminder || warning.beh_rem || warning.behRem || 0}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            )}

            {/* ========== Violations Section ========== */}
            {getViolations().length > 0 ? (
              <Card sx={{ mb: 3, borderRadius: '12px', border: `1px solid ${colors.error}`, bgcolor: alpha(colors.error, 0.02) }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.error, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Warning sx={{ fontSize: 20 }} />
                    Violations ({getViolations().length})
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha(colors.error, 0.05) }}>#</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha(colors.error, 0.05) }}>Type</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha(colors.error, 0.05) }}>Time</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha(colors.error, 0.05) }}>Details</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha(colors.error, 0.05) }}>Severity</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {getViolations().map((violation, idx) => (
                          <TableRow key={idx} sx={{ '&:hover': { bgcolor: alpha(colors.error, 0.03) } }}>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell>
                              <Chip 
                                label={violation.type || violation.violation_type} 
                                size="small" 
                                color="error" 
                                variant="outlined" 
                              />
                            </TableCell>
                            <TableCell>{formatDate(violation.timestamp || violation.detected_at)}</TableCell>
                            <TableCell>{violation.details || violation.description || 'N/A'}</TableCell>
                            <TableCell>
                              <Chip 
                                label={violation.severity || 'Medium'} 
                                size="small" 
                                color={violation.severity === 'high' ? 'error' : violation.severity === 'low' ? 'success' : 'warning'}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            ) : (
              <Alert 
                severity="success" 
                sx={{ borderRadius: '12px', mb: 3 }}
                icon={<CheckCircle />}
              >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  No violations recorded during this meeting session. Excellent participation!
                </Typography>
              </Alert>
            )}

            {/* ========== Detection Events Section ========== */}
            {getDetectionEvents().length > 0 && (
              <Card sx={{ mb: 3, borderRadius: '12px', border: `1px solid ${colors.info}`, bgcolor: alpha(colors.info, 0.02) }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.info, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Timeline sx={{ fontSize: 20 }} />
                    Detection Events ({getDetectionEvents().length})
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha(colors.info, 0.1), color: colors.info }}>#</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha(colors.info, 0.1), color: colors.info }}>Timestamp</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha(colors.info, 0.1), color: colors.info }}>Violation Type</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha(colors.info, 0.1), color: colors.info }}>Duration</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha(colors.info, 0.1), color: colors.info }}>Penalty</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: alpha(colors.info, 0.1), color: colors.info }}>Message</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {getDetectionEvents().map((event, idx) => (
                          <TableRow key={idx} sx={{ '&:nth-of-type(odd)': { bgcolor: alpha(colors.info, 0.03) } }}>
                            <TableCell sx={{ fontWeight: 600 }}>{idx + 1}</TableCell>
                            <TableCell sx={{ fontSize: '0.8rem' }}>{formatDateTime(event.timestamp || event.detected_at || event.time)}</TableCell>
                            <TableCell>
                              <Chip 
                                label={event.violation_type || event.type || 'N/A'}
                                size="small"
                                color="info"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>{event.duration || event.duration_seconds || 'N/A'}</TableCell>
                            <TableCell>
                              <Typography sx={{ fontWeight: 600, color: colors.warning }}>
                                {typeof event.penalty === 'number' ? `${(event.penalty * 100).toFixed(2)}%` : event.penalty || '0%'}
                              </Typography>
                            </TableCell>
                            <TableCell>{event.message || event.details || 'N/A'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            )}
          </Box>
        ) : (
          <Alert severity="info" sx={{ borderRadius: '12px' }}>
            No report data available for this meeting.
          </Alert>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 3, pt: 0, gap: 1, borderTop: `1px solid ${colors.border}` }}>
        <Button 
          onClick={handleCloseReportModal}
          variant="outlined"
          sx={{ 
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 600
          }}
        >
          Close
        </Button>
        <Button 
          onClick={handleDownloadReportPDF}
          variant="contained"
          disabled={isDownloadingPDF || isLoadingReport || !selectedMeetingForReport}
          startIcon={isDownloadingPDF ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdf />}
          sx={{ 
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 600,
            background: colors.gradients.primary,
            '&:hover': { background: colors.gradients.primary, opacity: 0.9 }
          }}
        >
          {isDownloadingPDF ? 'Downloading...' : 'Download PDF'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================
// END OF COMPLETE REPORT MODAL COMPONENT
// ============================================

  // Complete Overview Section
  
const CompleteOverview = () => {
  // ✅ Calculate stats from FILTERED data (hostMeetingsTableData/participantMeetingsTableData)
  // These already have all filters applied including meetingTimeFilter
  
  // Host stats - calculated from filtered hostMeetingsTableData
  const filteredHostMeetings = hostMeetingsTableData;
  const hostTotalMeetings = filteredHostMeetings.length;
  const hostTotalParticipants = filteredHostMeetings.reduce((sum, m) => sum + (m.participants || 0), 0);
  const hostTotalDuration = filteredHostMeetings.reduce((sum, m) => sum + (m.totalDuration || 0), 0);
  const hostAvgDuration = hostTotalMeetings > 0 ? Math.round(hostTotalDuration / hostTotalMeetings) : 0;
  
  console.log('📊 CompleteOverview - Host Stats from filtered data:', {
    totalMeetings: hostTotalMeetings,
    totalParticipants: hostTotalParticipants,
    avgDuration: hostAvgDuration,
    filterActive: Boolean(meetingTimeFilter)
  });

  const hostStats = [
    { 
      icon: VideoIcon, 
      value: hostTotalMeetings, 
      label: meetingTimeFilter ? 'Filtered Meeting(s)' : 'Total Meetings', 
      trend: 'Host', 
      gradient: colors.gradients.card1 
    },
    { 
      icon: People, 
      value: hostTotalParticipants, 
      label: 'Total Participants', 
      trend: 'Growing', 
      gradient: colors.gradients.card2 
    },
    { 
      icon: Timer, 
      value: `${hostAvgDuration}m`, 
      label: 'Avg Duration', 
      trend: 'Optimal', 
      gradient: colors.gradients.card3 
    }
  ];

  // Participant stats - calculated from filtered participantMeetingsTableData
  const filteredParticipantMeetings = participantMeetingsTableData;
  const participantMeetingsCount = filteredParticipantMeetings.length;
  const totalParticipantMinutes = filteredParticipantMeetings.reduce((sum, m) => sum + (m.totalDuration || 0), 0);
  const avgParticipantAttendance = participantMeetingsCount > 0 
    ? filteredParticipantMeetings.reduce((sum, m) => sum + (m.participantAttendance || 0), 0) / participantMeetingsCount 
    : 0;

  console.log('📊 CompleteOverview - Participant Stats from filtered data:', {
    totalMeetings: participantMeetingsCount,
    totalMinutes: totalParticipantMinutes,
    avgAttendance: avgParticipantAttendance,
    filterActive: Boolean(meetingTimeFilter)
  });

  const participantStats = [
    { 
      icon: VideoIcon, 
      value: participantMeetingsCount, 
      label: meetingTimeFilter ? 'Filtered Meeting(s)' : 'Meetings Attended', 
      trend: participantMeetingsCount > 10 ? 'Active' : 'Building', 
      gradient: colors.gradients.card1 
    },
    { 
      icon: Timer, 
      value: `${Math.floor(totalParticipantMinutes / 60)}h ${Math.round(totalParticipantMinutes % 60)}m`, 
      label: 'Total Time', 
      trend: 'Engaged', 
      gradient: colors.gradients.card2 
    },
    { 
      icon: TrendingUpIcon, 
      value: `${Math.round(avgParticipantAttendance)}%`, 
      label: 'Avg Attendance', 
      trend: avgParticipantAttendance > 90 ? 'Excellent' : 'Good', 
      gradient: colors.gradients.card3 
    },
    { 
      icon: CalendarToday, 
      value: personalStats?.upcomingCount || 0, 
      label: 'Upcoming', 
      trend: 'Scheduled', 
      gradient: colors.gradients.card4 
    }
  ];

  const currentStats = userRole === 'host' ? hostStats : participantStats;

  return (
    <Card sx={{ 
      borderRadius: '16px', 
      boxShadow: '0 4px 24px rgba(30, 58, 95, 0.12)',
      overflow: 'hidden',
      mb: 3
    }}>
      {/* Header Banner */}
      <Box sx={{
        background: colors.gradients.mixed,
        p: 3,
        color: '#fff'
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ 
              width: 50, 
              height: 50, 
              bgcolor: 'rgba(255,255,255,0.2)',
              border: '2px solid rgba(255,255,255,0.3)'
            }}>
              {userRole === 'host' ? <SupervisorAccountIcon sx={{ fontSize: 28 }} /> : <PersonIcon sx={{ fontSize: 28 }} />}
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {userRole === 'host' ? 'Host Analytics Dashboard' : 'Participant Analytics Dashboard'}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.25 }}>
                {meetingTimeFilter 
                  ? `Showing filtered results for selected meeting`
                  : userRole === 'host' 
                    ? 'Complete analytics for all meetings you\'ve hosted' 
                    : 'Your comprehensive meeting participation overview'}
              </Typography>
            </Box>
          </Box>
          
          {/* Filter indicator badge */}
          {(meetingFilter !== 'all' || meetingTimeFilter) && (
            <Chip 
              label={`Filters Active`}
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                color: '#fff',
                fontWeight: 600
              }}
            />
          )}
        </Box>
      </Box>

      {/* Stats Grid - Compact */}
      <CardContent sx={{ p: 2.5 }}>
        <Grid container spacing={2}>
          {currentStats.map((stat, index) => (
            <Grid item xs={6} sm={6} md={userRole === 'host' ? 4 : 3} key={index}>
              <StatCard {...stat} />
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};


  // Meetings Table Section
  const MeetingsSection = () => {
    // Host columns
    const hostColumns = [
      { label: '#', field: 'id', sortKey: 'id', render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.id}</Typography> },
      { 
        label: 'Meeting ID', 
        field: 'meetingId', 
        sortKey: 'meetingId',
        render: (row) => (
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: 600, 
              color: colors.primary,
              fontFamily: 'monospace',
              bgcolor: alpha(colors.primary, 0.08),
              px: 1,
              py: 0.5,
              borderRadius: '6px',
              display: 'inline-block'
            }}
          >
            {row.meetingId}
          </Typography>
        )
      },
      { 
        label: 'Meeting Name', 
        field: 'meetingName', 
        sortKey: 'meetingName',
        render: (row) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: alpha(colors.primary, 0.1) }}>
              <VideoIcon sx={{ fontSize: 20, color: colors.primary }} />
            </Avatar>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {row.meetingName.length > 20 ? row.meetingName.substring(0, 20) + '...' : row.meetingName}
            </Typography>
          </Box>
        )
      },
      { 
        label: 'Type', 
        field: 'meetingType', 
        sortKey: 'meetingType',
        render: (row) => <Chip label={row.meetingType} size="small" color={getMeetingTypeColor(row.meetingType)} variant="outlined" />
      },
      { 
        label: 'Date', 
        field: 'date', 
        sortKey: 'date',
        render: (row) => <Typography variant="body2" color="text.secondary">{formatDate(row.date)}</Typography>
      },
      { 
        label: 'Participants', 
        field: 'participants', 
        sortKey: 'participants',
        align: 'center',
        render: (row) => (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
            <People sx={{ fontSize: 18, color: colors.secondary }} />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{row.participants}</Typography>
          </Box>
        )
      },
      { label: 'Duration', field: 'totalDuration', sortKey: 'totalDuration', align: 'center', render: (row) => <Typography sx={{ fontWeight: 600, color: colors.primary }}>{row.totalDuration} min</Typography> },
      { label: 'Status', align: 'center', render: (row) => <Chip label={row.status} size="small" color={getStatusColor(row.status)} /> },
      { 
        label: 'Action', 
        align: 'center',
        render: (row) => (
          <Tooltip title="View Meeting Details">
            <Button
              size="small"
              variant="outlined"
              startIcon={<Visibility sx={{ fontSize: 16 }} />}
              onClick={() => handleViewMeeting(row)}
              sx={{ 
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.75rem',
                py: 0.5,
                borderColor: colors.primary,
                color: colors.primary,
                '&:hover': { 
                  bgcolor: alpha(colors.primary, 0.1),
                  borderColor: colors.primary 
                }
              }}
            >
              View
            </Button>
          </Tooltip>
        )
      }
    ];

    // Participant columns - Updated with Host Name and Report button
    const participantColumns = [
      { label: '#', field: 'id', sortKey: 'id', render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.id}</Typography> },
      { 
        label: 'Meeting Name', 
        field: 'meetingName', 
        sortKey: 'meetingName',
        render: (row) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: alpha(colors.primary, 0.1) }}>
              <VideoIcon sx={{ fontSize: 20, color: colors.primary }} />
            </Avatar>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {row.meetingName.length > 20 ? row.meetingName.substring(0, 20) + '...' : row.meetingName}
            </Typography>
          </Box>
        )
      },
      { 
        label: 'Host', 
        field: 'hostName', 
        sortKey: 'hostName',
        render: (row) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ width: 28, height: 28, bgcolor: alpha(colors.secondary, 0.1) }}>
              <PersonIcon sx={{ fontSize: 16, color: colors.secondary }} />
            </Avatar>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {row.hostName}
            </Typography>
          </Box>
        )
      },
      { 
        label: 'Type', 
        field: 'meetingType', 
        sortKey: 'meetingType', 
        render: (row) => <Chip label={row.meetingType} size="small" color={getMeetingTypeColor(row.meetingType)} variant="outlined" /> 
      },
      { 
        label: 'Date', 
        field: 'date', 
        sortKey: 'date', 
        render: (row) => <Typography variant="body2" color="text.secondary">{formatDate(row.date)}</Typography> 
      },
      { 
        label: 'Duration', 
        field: 'totalDuration', 
        sortKey: 'totalDuration', 
        align: 'center', 
        render: (row) => <Typography sx={{ fontWeight: 600, color: colors.primary }}>{row.totalDuration} min</Typography> 
      },
      { 
        label: 'Attendance', 
        field: 'participantAttendance', 
        sortKey: 'participantAttendance', 
        align: 'center', 
        render: (row) => <ScoreIndicator score={row.participantAttendance} /> 
      },
      { 
        label: 'Status', 
        align: 'center', 
        render: (row) => <Chip label={row.status} size="small" color={getStatusColor(row.status)} /> 
      },
      { 
        label: 'Report', 
        align: 'center',
        render: (row) => (
          <Tooltip title="View Report">
            <Button
              size="small"
              variant="contained"
              startIcon={<DescriptionIcon sx={{ fontSize: 16 }} />}
              onClick={() => handleViewReport(row)}
              sx={{ 
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.75rem',
                py: 0.5,
                background: colors.gradients.secondary,
                '&:hover': { 
                  background: colors.gradients.secondary,
                  opacity: 0.9
                }
              }}
            >
              Report
            </Button>
          </Tooltip>
        )
      }
    ];

    const columns = userRole === 'host' ? hostColumns : participantColumns;
    const data = userRole === 'host' ? hostMeetingsTableData : participantMeetingsTableData;

    return (
      <Card sx={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(30, 58, 95, 0.1)', mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <SectionHeader 
            title={userRole === 'host' ? 'Meeting Analytics' : 'Attendance Records'}
            icon={TableChartIcon}
            section="meetings"
            data={data}
            subtitle={`${data.length} ${userRole === 'host' ? 'meetings' : 'records'} found`}
            badge={data.length > 0 ? `${data.length} items` : null}
          />
          <Collapse in={expandedSections.meetings}>
            {(userRole === 'participant' && isLoadingParticipantMeetings) || (userRole === 'host' && isLoadingHostMeetings) ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={40} sx={{ color: colors.primary }} />
              </Box>
            ) : (
              <DataTable 
                columns={columns} 
                data={data} 
                emptyMessage={`No ${userRole === 'host' ? 'meeting' : 'attendance'} data available for the selected filters.`}
              />
            )}
          </Collapse>
        </CardContent>
      </Card>
    );
  };

  // Engagement Section (for participants)
  const EngagementSection = () => {
    if (userRole !== 'participant' || engagementTableData.length === 0) return null;

    const columns = [
      { label: '#', field: 'id', sortKey: 'id', render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.id}</Typography> },
      { 
        label: 'Meeting', 
        field: 'meetingName', 
        sortKey: 'meetingName',
        render: (row) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: alpha(colors.accent, 0.1) }}>
              <Psychology sx={{ fontSize: 20, color: colors.accent }} />
            </Avatar>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {row.meetingName.length > 25 ? row.meetingName.substring(0, 25) + '...' : row.meetingName}
            </Typography>
          </Box>
        )
      },
      { label: 'Duration', field: 'totalDuration', sortKey: 'totalDuration', align: 'center', render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.totalDuration} min</Typography> },
      { label: 'Engagement', field: 'engagementScore', sortKey: 'engagementScore', align: 'center', render: (row) => <ScoreIndicator score={row.engagementScore} /> },
      { label: 'Focus', field: 'focusScore', sortKey: 'focusScore', align: 'center', render: (row) => <ScoreIndicator score={row.focusScore} /> },
      { label: 'Break Time', field: 'breakTime', sortKey: 'breakTime', align: 'center', render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.breakTime} min</Typography> },
      { label: 'Participation', field: 'participationRate', sortKey: 'participationRate', align: 'center', render: (row) => <ScoreIndicator score={row.participationRate} /> },
      { label: 'Status', align: 'center', render: (row) => <Chip label={row.status} size="small" color={getStatusColor(row.status)} /> }
    ];

    return (
      <Card sx={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(30, 58, 95, 0.1)', mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <SectionHeader 
            title="Engagement Metrics"
            icon={Psychology}
            section="engagement"
            data={engagementTableData}
            subtitle="Detailed engagement analysis per session"
            badge={`${engagementTableData.length} sessions`}
          />
          <Collapse in={expandedSections.engagement}>
            <DataTable columns={columns} data={engagementTableData} emptyMessage="No engagement data available." />
          </Collapse>
        </CardContent>
      </Card>
    );
  };

  // Trends Section (for hosts)
  const TrendsSection = () => {
    if (userRole !== 'host' || hostTrendsTableData.length === 0) return null;

    const columns = [
      { label: '#', render: (row, idx) => <Typography sx={{ fontWeight: 600 }}>{row.id}</Typography> },
      { label: 'Meeting Type', field: 'meetingType', render: (row) => <Chip label={row.meetingType} size="small" color={getMeetingTypeColor(row.meetingType)} /> },
      { label: 'Total Meetings', field: 'totalMeetings', align: 'center', render: (row) => <Typography sx={{ fontWeight: 700, color: colors.primary, fontSize: '1.1rem' }}>{row.totalMeetings}</Typography> },
      { label: 'Total Participants', field: 'totalParticipants', align: 'center', render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
          <People sx={{ fontSize: 18, color: colors.secondary }} />
          <Typography sx={{ fontWeight: 600 }}>{row.totalParticipants}</Typography>
        </Box>
      )},
      { label: 'Avg Duration', field: 'avgDuration', align: 'center', render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.avgDuration} min</Typography> }
    ];

    return (
      <Card sx={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(30, 58, 95, 0.1)', mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <SectionHeader 
            title="Meeting Trends by Type"
            icon={Timeline}
            section="trends"
            data={hostTrendsTableData}
            subtitle="Aggregated analytics by meeting type"
          />
          <Collapse in={expandedSections.trends}>
            <DataTable columns={columns} data={hostTrendsTableData} emptyMessage="No trends data available." />
          </Collapse>
        </CardContent>
      </Card>
    );
  };

  // Quick Summary Table
const QuickSummarySection = () => {
  // ✅ Calculate from filtered data
  const filteredHostMeetings = hostMeetingsTableData;
  const hostTotalMeetings = filteredHostMeetings.length;
  const hostTotalParticipants = filteredHostMeetings.reduce((sum, m) => sum + (m.participants || 0), 0);
  const hostTotalDuration = filteredHostMeetings.reduce((sum, m) => sum + (m.totalDuration || 0), 0);
  const hostAvgDuration = hostTotalMeetings > 0 ? Math.round(hostTotalDuration / hostTotalMeetings) : 0;

  const filteredParticipantMeetings = participantMeetingsTableData;
  const participantMeetingsCount = filteredParticipantMeetings.length;
  const totalParticipantMinutes = filteredParticipantMeetings.reduce((sum, m) => sum + (m.totalDuration || 0), 0);
  const avgParticipantAttendance = participantMeetingsCount > 0 
    ? filteredParticipantMeetings.reduce((sum, m) => sum + (m.participantAttendance || 0), 0) / participantMeetingsCount 
    : 0;

  // Host summary data
  const summaryData = userRole === 'host' ? [
    { 
      metric: meetingTimeFilter ? 'Filtered Meetings' : 'Total Meetings Hosted', 
      value: hostTotalMeetings, 
      icon: VideoIcon, 
      status: 'Host', 
      statusColor: 'primary' 
    },
    { 
      metric: 'Total Participants', 
      value: hostTotalParticipants, 
      icon: People, 
      status: 'Growing', 
      statusColor: 'success' 
    },
    { 
      metric: 'Average Duration', 
      value: `${hostAvgDuration} min`, 
      icon: Timer, 
      status: 'Optimal', 
      statusColor: 'info' 
    }
  ] : [
    { 
      metric: meetingTimeFilter ? 'Filtered Sessions' : 'Sessions Attended', 
      value: participantMeetingsCount, 
      icon: VideoIcon, 
      status: participantMeetingsCount > 10 ? 'Active' : 'Building', 
      statusColor: 'primary' 
    },
    { 
      metric: 'Total Meeting Time', 
      value: `${Math.floor(totalParticipantMinutes / 60)}h ${Math.round(totalParticipantMinutes % 60)}m`, 
      icon: Timer, 
      status: 'Engaged', 
      statusColor: 'success' 
    },
    { 
      metric: 'Average Attendance', 
      value: `${Math.round(avgParticipantAttendance)}%`, 
      icon: TrendingUpIcon, 
      status: avgParticipantAttendance > 80 ? 'Excellent' : 'Good', 
      statusColor: avgParticipantAttendance > 80 ? 'success' : 'warning' 
    },
    { 
      metric: 'Upcoming Meetings', 
      value: personalStats?.upcomingCount || 0, 
      icon: CalendarToday, 
      status: 'Scheduled', 
      statusColor: 'info' 
    }
  ];

  return (
    <Card sx={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(30, 58, 95, 0.1)', mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <SectionHeader 
          title="Quick Statistics Summary"
          icon={AssessmentIcon}
          section="summary"
          data={summaryData.map(s => ({ Metric: s.metric, Value: s.value, Status: s.status }))}
          subtitle={meetingTimeFilter ? "Filtered results" : "Key performance indicators at a glance"}
        />
        <Collapse in={expandedSections.summary}>
          <TableContainer component={Paper} sx={{ borderRadius: '10px', boxShadow: 'none', border: `1px solid ${colors.border}` }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: colors.background, color: colors.primary, borderBottom: `2px solid ${colors.primary}`, py: 1.5 }}>Metric</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, bgcolor: colors.background, color: colors.primary, borderBottom: `2px solid ${colors.primary}`, py: 1.5 }}>Value</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, bgcolor: colors.background, color: colors.primary, borderBottom: `2px solid ${colors.primary}`, py: 1.5 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summaryData.map((item, index) => (
                  <TableRow 
                    key={index}
                    sx={{ 
                      '&:nth-of-type(odd)': { backgroundColor: alpha(colors.background, 0.5) },
                      '&:hover': { backgroundColor: alpha(colors.primary, 0.05) }
                    }}
                  >
                    <TableCell sx={{ py: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: alpha(colors.primary, 0.1) }}>
                          <item.icon sx={{ color: colors.primary, fontSize: 18 }} />
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.metric}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center" sx={{ py: 1.5 }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: colors.primary }}>{item.value}</Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ py: 1.5 }}>
                      <Chip label={item.status} color={item.statusColor} size="small" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </CardContent>
    </Card>
  );
};

  // ============================================
  // LOADING STATE
  // ============================================
  if (isLoadingStats) {
    return (
      <Box sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.gradients.primary
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={64} sx={{ color: '#fff', mb: 3 }} />
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>
            Loading Analytics Dashboard
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.8)', mt: 1 }}>
            Preparing your insights...
          </Typography>
        </Box>
      </Box>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: colors.background }}>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {/* Professional Header */}
        <Paper sx={{ 
          p: 2.5, 
          mb: 3, 
          borderRadius: '16px', 
          boxShadow: '0 4px 20px rgba(30, 58, 95, 0.1)',
          background: colors.surface
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <IconButton
                size="small"
                onClick={handleBackToDashboard}
                sx={{
                  bgcolor: alpha(colors.primary, 0.1),
                  '&:hover': { bgcolor: alpha(colors.primary, 0.2) }
                }}
              >
                <ArrowBackIcon sx={{ color: colors.primary, fontSize: 20 }} />
              </IconButton>
              <Box>
                <Typography variant="h5" sx={{ 
                  fontWeight: 800, 
                  background: colors.gradients.mixed,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  Analytics Intelligence Center
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  Comprehensive meeting performance analytics and insights
                </Typography>
              </Box>
            </Box>

            {/* Role Selector & Actions */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <ButtonGroup variant="outlined" sx={{ borderRadius: '10px', overflow: 'hidden' }}>
                <Button
                  size="small"
                  onClick={() => handleRoleSwitch('participant')}
                  variant={userRole === 'participant' ? 'contained' : 'outlined'}
                  startIcon={<PersonIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 2,
                    py: 0.75,
                    ...(userRole === 'participant' && { background: colors.gradients.mixed })
                  }}
                >
                  Participant
                </Button>
                {personalStats && personalStats.totalHostedMeetings > 0 && (
                  <Button
                    size="small"
                    onClick={() => handleRoleSwitch('host')}
                    variant={userRole === 'host' ? 'contained' : 'outlined'}
                    startIcon={<SupervisorAccountIcon sx={{ fontSize: 18 }} />}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      px: 2,
                      py: 0.75,
                      ...(userRole === 'host' && { background: colors.gradients.mixed })
                    }}
                  >
                    Host
                  </Button>
                )}
              </ButtonGroup>
              
            </Box>
          </Box>
        </Paper>

        {/* Advanced Filters */}
        <Card sx={{ mb: 3, borderRadius: '16px', boxShadow: '0 4px 20px rgba(30, 58, 95, 0.1)' }}>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <FilterIcon sx={{ color: colors.primary, fontSize: 20 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.textPrimary }}>
                  Advanced Filters
                </Typography>
              </Box>
              <IconButton onClick={() => setShowFilters(!showFilters)} size="small">
                {showFilters ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>
            
            <Collapse in={showFilters}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Time Period</InputLabel>
                    <Select value={timeFilter} label="Time Period" onChange={(e) => setTimeFilter(e.target.value)}>
                      <MenuItem value="today">Today</MenuItem>
                      <MenuItem value="7days">Last 7 Days</MenuItem>
                      <MenuItem value="30days">Last 30 Days</MenuItem>
                      <MenuItem value="90days">Last 3 Months</MenuItem>
                      <MenuItem value="1year">Last Year</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Meeting Type</InputLabel>
                    <Select value={meetingFilter} label="Meeting Type" onChange={(e) => setMeetingFilter(e.target.value)}>
                      <MenuItem value="all">All Meetings</MenuItem>
                      <MenuItem value="InstantMeeting">Instant</MenuItem>
                      <MenuItem value="ScheduleMeeting">Scheduled</MenuItem>
                      <MenuItem value="CalendarMeeting">Calendar</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="Start Date"
                    value={dateRange.start}
                    onChange={(e) => { setDateRange(prev => ({ ...prev, start: e.target.value })); setMeetingTimeFilter(''); }}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="End Date"
                    value={dateRange.end}
                    onChange={(e) => { setDateRange(prev => ({ ...prev, end: e.target.value })); setMeetingTimeFilter(''); }}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth size="small" disabled={isLoadingMeetingTimes}>
                    <InputLabel>Specific Meeting</InputLabel>
                    <Select
                      value={meetingTimeFilter}
                      onChange={(e) => setMeetingTimeFilter(e.target.value)}
                      label="Specific Meeting"
                      MenuProps={{ PaperProps: { style: { maxHeight: 400, width: 420 } } }}
                    >
                      <MenuItem value=""><em>All Meetings</em></MenuItem>
                      {availableMeetingTimes.length > 0 ? (
                        (() => {
                          const groupedByDate = {};
                          availableMeetingTimes.forEach(meeting => {
                            const dateKey = meeting.date || 'Unknown';
                            if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
                            groupedByDate[dateKey].push(meeting);
                          });
                          const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));
                          return sortedDates.map((dateKey) => {
                            const meetings = groupedByDate[dateKey];
                            let fullDateDisplay = dateKey;
                            try {
                              const dateObj = new Date(dateKey + 'T00:00:00');
                              fullDateDisplay = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                            } catch (e) { fullDateDisplay = dateKey; }
                            return [
                              <ListSubheader key={`header-${dateKey}`} sx={{ backgroundColor: '#f5f5f5', color: colors.primary, fontWeight: 'bold', fontSize: '0.85rem' }}>
                                📅 {fullDateDisplay} ({meetings.length})
                              </ListSubheader>,
                              ...meetings.map((meeting, idx) => (
                                <MenuItem key={meeting.meeting_id || `${dateKey}-${idx}`} value={meeting.datetime_for_filter} sx={{ fontSize: '0.85rem', py: 1.5, pl: 3 }}>
                                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{meeting.display_time}</Typography>
                                    <Typography variant="caption" color="text.secondary">{meeting.meeting_name}</Typography>
                                  </Box>
                                </MenuItem>
                              ))
                            ];
                          }).flat();
                        })()
                      ) : (
                        <MenuItem disabled><em>{isLoadingMeetingTimes ? 'Loading...' : 'No meetings found'}</em></MenuItem>
                      )}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={2}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<RefreshIcon />}
                    onClick={() => { setTimeFilter('today'); setMeetingFilter('all'); setMeetingTimeFilter(''); }}
                    sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, height: '40px' }}
                  >
                    Reset Filters
                  </Button>
                </Grid>
              </Grid>

              {meetingTimeFilter && (
                <Alert severity="info" sx={{ mt: 2, borderRadius: '12px' }} onClose={() => setMeetingTimeFilter('')}>
                  <Typography variant="body2">
                    <strong>Filtered:</strong> {availableMeetingTimes.find(m => m.datetime_for_filter === meetingTimeFilter)?.label || meetingTimeFilter}
                  </Typography>
                </Alert>
              )}
            </Collapse>
          </CardContent>
        </Card>

        {/* Loading Indicator */}
        {(loading || isLoadingHostMeetings || isLoadingParticipantMeetings) && (
          <LinearProgress sx={{ mb: 2, borderRadius: 2, height: 6, background: alpha(colors.primary, 0.1), '& .MuiLinearProgress-bar': { background: colors.gradients.primary } }} />
        )}

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 4, borderRadius: '12px' }} onClose={clearError}>
            {error}
          </Alert>
        )}

        {/* Main Content Sections */}
        <CompleteOverview />
        <MeetingsSection />
        <EngagementSection />
        <TrendsSection />
        <QuickSummarySection />
        
        {/* Report Modal */}
        <ReportModal />
      </Container>
    </Box>
  );
};

export default AnalyticsPage;