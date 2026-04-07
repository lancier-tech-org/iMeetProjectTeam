import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Chip,
  Avatar,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  LinearProgress,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowBack,
  VideoCall as VideoIcon,
  People,
  Visibility,
  Download,
  Description,
  Close,
  Fullscreen,
  FullscreenExit,
} from '@mui/icons-material';
import { analyticsAPI } from '../services/api';

const MeetingDetailsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { meetingId } = useParams();
  
  // Get meeting data from navigation state or fetch it
  const [meeting, setMeeting] = useState(location.state?.meeting || null);
  const [participants, setParticipants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Report menu states
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // PDF Viewer states
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [viewingParticipantName, setViewingParticipantName] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Professional Color Palette
  const colors = {
    primary: '#1e3a5f',
    primaryLight: '#2d5a87',
    secondary: '#1565c0',
    success: '#2e7d32',
    warning: '#ed6c02',
    error: '#d32f2f',
    background: '#f8fafc',
    textPrimary: '#1e293b',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    gradients: {
      header: 'linear-gradient(135deg, #1e3a5f 0%, #1565c0 100%)',
      card: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
    }
  };

  // Fetch participants on mount
  useEffect(() => {
    const fetchParticipants = async () => {
      if (!meetingId) return;
      
      try {
        setIsLoading(true);
        console.log('📊 Fetching participants for meeting:', meetingId);
        // const response = await analyticsAPI.getMeetingParticipants(meetingId);
        // const occurrenceNumber = meeting?.occurrence_number || location.state?.meeting?.occurrence_number;
        const occurrenceNumber = meeting?.occurrence_number || meeting?.occurrenceNumber || location.state?.meeting?.occurrence_number || location.state?.meeting?.occurrenceNumber;
        console.log('📊 Fetching participants with occurrence_number:', occurrenceNumber);
        const response = await analyticsAPI.getMeetingParticipants(meetingId, occurrenceNumber);
        console.log('📊 Participants response:', response);
        
        // Handle different response formats
        let participantsList = [];
        if (response?.data) {
          participantsList = response.data;
        } else if (response?.success && response?.data) {
          participantsList = response.data;
        } else if (Array.isArray(response)) {
          participantsList = response;
        }
        
        setParticipants(Array.isArray(participantsList) ? participantsList : []);
        console.log('✅ Loaded', participantsList.length, 'participants');
        
        // If meeting data wasn't passed via navigation state, use API response
        if (!meeting && response) {
          setMeeting(prevMeeting => ({
            ...prevMeeting,
            meetingId: response.meeting_id || meetingId,
            meetingName: response.meeting_name || 'Meeting',
            meetingType: response.meeting_type || 'N/A',
            status: response.meeting_status || 'Completed',
            participants: response.total_participants || participantsList.length,
            ...(location.state?.meeting || {})
          }));
        }
      } catch (err) {
        console.error('❌ Error fetching participants:', err);
        setError('Failed to load participants');
      } finally {
        setIsLoading(false);
      }
    };

    fetchParticipants();
  }, [meetingId, meeting, location.state?.meeting]);

  // Cleanup PDF URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        window.URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // Get attendance color
  const getAttendanceColor = (attendance) => {
    if (attendance >= 80) return colors.success;
    if (attendance >= 60) return colors.warning;
    return colors.error;
  };

  // Back to analytics
  const handleBack = () => {
    navigate('/analytics');
  };

  // Handle menu open
  const handleMenuOpen = (event, participant) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedParticipant(participant);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedParticipant(null);
  };

  // Handle view report (open in modal on same page)
  const handleViewReport = async () => {
    if (!selectedParticipant) return;
    
    const participantName = selectedParticipant.participant_name || selectedParticipant.Full_Name || 'Participant';
    setViewingParticipantName(participantName);
    handleMenuClose();
    setPdfLoading(true);
    setPdfViewerOpen(true);
    
    try {
      const userId = selectedParticipant.user_id || selectedParticipant.User_ID;
      // const blob = await analyticsAPI.getParticipantReportPDFBlob(meetingId, userId);
      const occurrenceNumber = selectedParticipant.occurrence_number || null;
console.log('📊 View Report - occurrence_number:', occurrenceNumber);
const blob = await analyticsAPI.getParticipantReportPDFBlob(meetingId, userId, occurrenceNumber);
      
      // Revoke previous URL if exists
      if (pdfUrl) {
        window.URL.revokeObjectURL(pdfUrl);
      }
      
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      setPdfUrl(url);
      setSnackbar({ open: true, message: 'Report loaded successfully', severity: 'success' });
    } catch (error) {
      console.error('Failed to view report:', error);
      setSnackbar({ open: true, message: error.message || 'Failed to load report', severity: 'error' });
      setPdfViewerOpen(false);
    } finally {
      setPdfLoading(false);
    }
  };

  // Handle close PDF viewer
  const handleClosePdfViewer = () => {
    setPdfViewerOpen(false);
    if (pdfUrl) {
      window.URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    setViewingParticipantName('');
    setIsFullscreen(false);
  };

  // Handle download from viewer
  const handleDownloadFromViewer = () => {
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `participant_report_${viewingParticipantName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setSnackbar({ open: true, message: 'Report downloaded successfully', severity: 'success' });
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Handle download report directly
  const handleDownloadReport = async () => {
    if (!selectedParticipant) return;
    
    handleMenuClose();
    setReportLoading(true);
    
    try {
      const userId = selectedParticipant.user_id || selectedParticipant.User_ID;
      const name = selectedParticipant.participant_name || selectedParticipant.Full_Name || 'Participant';
      const occurrenceNumber = selectedParticipant.occurrence_number || null;
console.log('📊 Download Report - occurrence_number:', occurrenceNumber);
const blob = await analyticsAPI.getParticipantReportPDFBlob(meetingId, userId, occurrenceNumber);
           
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `participant_report_${name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSnackbar({ open: true, message: 'Report downloaded successfully', severity: 'success' });
    } catch (error) {
      console.error('Failed to download report:', error);
      setSnackbar({ open: true, message: error.message || 'Failed to download report', severity: 'error' });
    } finally {
      setReportLoading(false);
    }
  };

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // If no meeting data, show error
  if (!meeting && !isLoading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: colors.background, py: 4 }}>
        <Container maxWidth="lg">
          <Alert severity="error" sx={{ borderRadius: '12px' }}>
            Meeting data not found. Please go back and try again.
          </Alert>
          <Button 
            startIcon={<ArrowBack />} 
            onClick={handleBack}
            sx={{ mt: 2 }}
          >
            Back to Analytics
          </Button>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: colors.background }}>
      {/* Header */}
      <Box
        sx={{
          background: colors.gradients.header,
          color: '#fff',
          py: 3,
          px: 2,
          boxShadow: '0 4px 20px rgba(30, 58, 95, 0.3)'
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton 
              onClick={handleBack}
              sx={{ 
                color: '#fff',
                bgcolor: 'rgba(255,255,255,0.1)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
              }}
            >
              <ArrowBack />
            </IconButton>
            <VideoIcon sx={{ fontSize: 32 }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Meeting Details
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {meeting?.meetingId || meetingId}
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Participants List Section */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: '16px',
            border: `1px solid ${colors.border}`
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
              <People /> Participants List
            </Typography>
            <Chip 
              label={`${participants.length} participants`}
              sx={{ 
                bgcolor: alpha(colors.primary, 0.1),
                color: colors.primary,
                fontWeight: 600
              }}
            />
          </Box>

          {isLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
              <CircularProgress size={48} sx={{ color: colors.primary, mb: 2 }} />
              <Typography color="text.secondary">Loading participants...</Typography>
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ borderRadius: '12px' }}>
              {error}
            </Alert>
          ) : participants.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: '12px' }}>
              No participants found for this meeting.
            </Alert>
          ) : (
            <TableContainer 
              sx={{ 
                borderRadius: '12px', 
                border: `1px solid ${colors.border}`,
                maxHeight: 500
              }}
            >
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ 
                      fontWeight: 700, 
                      bgcolor: colors.background, 
                      color: colors.primary,
                      borderBottom: `2px solid ${colors.primary}`,
                      width: 60
                    }}>
                      #
                    </TableCell>
                    <TableCell sx={{ 
                      fontWeight: 700, 
                      bgcolor: colors.background, 
                      color: colors.primary,
                      borderBottom: `2px solid ${colors.primary}`
                    }}>
                      Participant Name
                    </TableCell>
                    <TableCell 
                      align="center"
                      sx={{ 
                        fontWeight: 700, 
                        bgcolor: colors.background, 
                        color: colors.primary,
                        borderBottom: `2px solid ${colors.primary}`,
                        width: 200
                      }}
                    >
                      Attendance %
                    </TableCell>
                    <TableCell 
                      align="center"
                      sx={{ 
                        fontWeight: 700, 
                        bgcolor: colors.background, 
                        color: colors.primary,
                        borderBottom: `2px solid ${colors.primary}`,
                        width: 120
                      }}
                    >
                      Status
                    </TableCell>
                    <TableCell 
                      align="center"
                      sx={{ 
                        fontWeight: 700, 
                        bgcolor: colors.background, 
                        color: colors.primary,
                        borderBottom: `2px solid ${colors.primary}`,
                        width: 100
                      }}
                    >
                      Report
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {participants.map((participant, index) => {
                    const name = participant.participant_name || participant.Full_Name || 'Unknown';
                    const attendance = parseFloat(participant.participant_attendance ?? participant.Participant_Attendance) || 0;
                    const duration = parseFloat(participant.total_duration_minutes) || 0;
                    const attendanceColor = getAttendanceColor(attendance);
                    const statusLabel = attendance >= 80 ? 'Excellent' : attendance >= 60 ? 'Good' : 'Needs Attention';
                    
                    return (
                      <TableRow 
                        key={participant.serial_no || index}
                        sx={{ 
                          '&:nth-of-type(odd)': { bgcolor: alpha(colors.background, 0.5) },
                          '&:hover': { bgcolor: alpha(colors.primary, 0.05) },
                          transition: 'background-color 0.2s'
                        }}
                      >
                        <TableCell sx={{ py: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: colors.textSecondary }}>
                            {participant.serial_no || index + 1}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar 
                              sx={{ 
                                width: 40, 
                                height: 40, 
                                bgcolor: alpha(colors.primary, 0.1),
                                color: colors.primary,
                                fontWeight: 700
                              }}
                            >
                              {name.charAt(0)?.toUpperCase() || 'U'}
                            </Avatar>
                            <Box>
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                {name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Duration: {duration.toFixed(1)} min
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell align="center" sx={{ py: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                            <Typography 
                              variant="body1" 
                              sx={{ 
                                fontWeight: 700, 
                                color: attendanceColor,
                                minWidth: 55
                              }}
                            >
                              {attendance.toFixed(1)}%
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(attendance, 100)}
                              sx={{
                                width: 100,
                                height: 10,
                                borderRadius: 5,
                                bgcolor: alpha(colors.primary, 0.1),
                                '& .MuiLinearProgress-bar': {
                                  bgcolor: attendanceColor,
                                  borderRadius: 5
                                }
                              }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell align="center" sx={{ py: 2 }}>
                          <Chip 
                            label={statusLabel}
                            size="small"
                            sx={{ 
                              bgcolor: alpha(attendanceColor, 0.1),
                              color: attendanceColor,
                              fontWeight: 600,
                              minWidth: 100
                            }}
                          />
                        </TableCell>
                        <TableCell align="center" sx={{ py: 2 }}>
                          <Tooltip title="View Report">
                            <IconButton
                              size="small"
                              onClick={(e) => handleMenuOpen(e, participant)}
                              disabled={reportLoading}
                              sx={{
                                color: colors.primary,
                                '&:hover': {
                                  bgcolor: alpha(colors.primary, 0.1)
                                }
                              }}
                            >
                              <Description fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Summary Stats */}
          {participants.length > 0 && !isLoading && (
            <Box sx={{ mt: 3, pt: 3, borderTop: `1px solid ${colors.border}` }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, bgcolor: alpha(colors.success, 0.05), borderRadius: '12px', textAlign: 'center' }}>
                    <Typography variant="subtitle2" color="text.secondary">Excellent (≥80%)</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: colors.success }}>
                      {participants.filter(p => parseFloat(p.participant_attendance ?? p.Participant_Attendance) >= 80).length}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, bgcolor: alpha(colors.warning, 0.05), borderRadius: '12px', textAlign: 'center' }}>
                    <Typography variant="subtitle2" color="text.secondary">Good (60-79%)</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: colors.warning }}>
                      {participants.filter(p => {
                        const att = parseFloat(p.participant_attendance ?? p.Participant_Attendance);
                        return att >= 60 && att < 80;
                      }).length}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, bgcolor: alpha(colors.error, 0.05), borderRadius: '12px', textAlign: 'center' }}>
                    <Typography variant="subtitle2" color="text.secondary">Needs Attention (&lt;60%)</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: colors.error }}>
                      {participants.filter(p => parseFloat(p.participant_attendance ?? p.Participant_Attendance) < 60).length}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
        </Paper>

        {/* Back Button */}
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={handleBack}
            sx={{
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 600,
              px: 4,
              py: 1.5,
              borderColor: colors.primary,
              color: colors.primary,
              '&:hover': {
                bgcolor: alpha(colors.primary, 0.05),
                borderColor: colors.primary
              }
            }}
          >
            Back to Analytics
          </Button>
        </Box>
      </Container>

      {/* Report Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            minWidth: 180
          }
        }}
      >
        <MenuItem onClick={handleViewReport} disabled={reportLoading}>
          <ListItemIcon>
            <Visibility fontSize="small" sx={{ color: colors.primary }} />
          </ListItemIcon>
          <ListItemText 
            primary="Full View" 
            secondary="View on this page"
            primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }}
            secondaryTypographyProps={{ fontSize: 11 }}
          />
        </MenuItem>
        <MenuItem onClick={handleDownloadReport} disabled={reportLoading}>
          <ListItemIcon>
            <Download fontSize="small" sx={{ color: colors.success }} />
          </ListItemIcon>
          <ListItemText 
            primary="Download" 
            secondary="Save as PDF"
            primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }}
            secondaryTypographyProps={{ fontSize: 11 }}
          />
        </MenuItem>
      </Menu>

      {/* PDF Viewer Dialog */}
      <Dialog
        open={pdfViewerOpen}
        onClose={handleClosePdfViewer}
        maxWidth={false}
        fullScreen={isFullscreen}
        PaperProps={{
          sx: {
            borderRadius: isFullscreen ? 0 : '16px',
            width: isFullscreen ? '100%' : '90vw',
            height: isFullscreen ? '100%' : '90vh',
            maxWidth: isFullscreen ? '100%' : '1200px',
            m: isFullscreen ? 0 : 2,
          }
        }}
      >
        {/* Dialog Header */}
        <DialogTitle
          sx={{
            background: colors.gradients.header,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            py: 1.5,
            px: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Description />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Participant Report
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                {viewingParticipantName}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="Download PDF">
              <IconButton 
                size="small" 
                onClick={handleDownloadFromViewer}
                disabled={!pdfUrl}
                sx={{ color: '#fff' }}
              >
                <Download fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
              <IconButton 
                size="small" 
                onClick={toggleFullscreen}
                sx={{ color: '#fff' }}
              >
                {isFullscreen ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Close">
              <IconButton 
                size="small" 
                onClick={handleClosePdfViewer}
                sx={{ color: '#fff' }}
              >
                <Close fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogTitle>

        {/* Dialog Content */}
        <DialogContent 
          sx={{ 
            p: 0, 
            bgcolor: '#525659',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
        >
          {pdfLoading ? (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: '100%',
              color: '#fff'
            }}>
              <CircularProgress size={60} sx={{ color: '#fff', mb: 2 }} />
              <Typography variant="h6">Loading Report...</Typography>
              <Typography variant="body2" sx={{ opacity: 0.7, mt: 1 }}>
                Please wait while the PDF is being generated
              </Typography>
            </Box>
          ) : pdfUrl ? (
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              title="Participant Report PDF"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
            />
          ) : (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: '100%',
              color: '#fff'
            }}>
              <Description sx={{ fontSize: 60, opacity: 0.5, mb: 2 }} />
              <Typography variant="h6">No PDF to display</Typography>
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                There was an error loading the report
              </Typography>
            </Box>
          )}
        </DialogContent>

        {/* Dialog Footer */}
        <DialogActions 
          sx={{ 
            bgcolor: colors.background, 
            borderTop: `1px solid ${colors.border}`,
            px: 2,
            py: 1.5,
            justifyContent: 'space-between'
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Meeting: {meeting?.meetingName || 'N/A'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Download />}
              onClick={handleDownloadFromViewer}
              disabled={!pdfUrl}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                borderColor: colors.primary,
                color: colors.primary,
              }}
            >
              Download
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleClosePdfViewer}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                bgcolor: colors.primary,
                '&:hover': {
                  bgcolor: colors.primaryLight
                }
              }}
            >
              Close
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbar.severity}
          sx={{ 
            borderRadius: '12px',
            fontWeight: 600
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MeetingDetailsPage;