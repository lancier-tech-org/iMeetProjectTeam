// TranscriptViewer.jsx - Modal component to view transcript content
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
  Paper,
  Stack,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
  Description as DocumentIcon,
  Event as EventIcon,
  TextFields as WordCountIcon,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';

// Theme colors (matching your RecordingsPage)
const themeColors = {
  teal: "#1A8A8A",
  blue: "#2D7DD2",
  green: "#10B981",
};

const TranscriptViewer = ({ 
  open, 
  onClose, 
  recording, 
  onDownload,
  apiBaseUrl = '' // Pass your API_BASE_URL here
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [transcriptData, setTranscriptData] = useState(null);

  // Fetch transcript content when dialog opens
  useEffect(() => {
    if (open && recording) {
      fetchTranscriptContent();
    }
    
    // Cleanup when dialog closes
    return () => {
      if (!open) {
        setTranscriptData(null);
        setError(null);
      }
    };
  }, [open, recording]);

  const fetchTranscriptContent = async () => {
    try {
      setLoading(true);
      setError(null);

      const userEmail = localStorage.getItem('user_email') || '';
      const userId = localStorage.getItem('user_id') || '';
      
      const recordingId = recording?.id || recording?._id;
      
      if (!recordingId) {
        throw new Error('Recording ID not found');
      }

      // Call the transcript-content endpoint that returns JSON
      const url = `${apiBaseUrl}/api/videos/transcript-content/${recordingId}?email=${encodeURIComponent(userEmail)}&user_id=${encodeURIComponent(userId)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || localStorage.getItem('access_token') || ''}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch transcript (${response.status})`);
      }

      const data = await response.json();
      
      if (data.status === 'success' && data.data) {
        setTranscriptData(data.data);
      } else {
        throw new Error(data.error || 'Invalid response format');
      }
    } catch (err) {
      console.error('Failed to fetch transcript:', err);
      setError(err.message || 'Failed to load transcript');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (onDownload && recording) {
      onDownload(recording);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown date';
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '70vh',
          maxHeight: '90vh',
          borderRadius: 3,
        }
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          background: `linear-gradient(135deg, ${themeColors.teal} 0%, ${themeColors.blue} 100%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 2,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <DocumentIcon />
          <Box>
            <Typography variant="h6" fontWeight={600}>
              Transcript
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              {transcriptData?.meeting_name || recording?.meeting_name || 'Meeting Recording'}
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Loading State */}
        {loading && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 300,
              gap: 2,
            }}
          >
            <CircularProgress sx={{ color: themeColors.teal }} />
            <Typography color="text.secondary">Loading transcript...</Typography>
          </Box>
        )}

        {/* Error State */}
        {error && !loading && (
          <Box sx={{ p: 3 }}>
            <Alert 
              severity="error" 
              sx={{ mb: 2 }}
              action={
                <Button color="inherit" size="small" onClick={fetchTranscriptContent}>
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          </Box>
        )}

        {/* Transcript Content */}
        {transcriptData && !loading && !error && (
          <Box>
            {/* Metadata Bar */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mx: 3,
                mt: 2,
                borderRadius: 2,
                bgcolor: alpha(themeColors.blue, 0.05),
                border: `1px solid ${alpha(themeColors.blue, 0.1)}`,
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
              >
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  {transcriptData.date && (
                    <Chip
                      icon={<EventIcon />}
                      label={formatDate(transcriptData.date)}
                      size="small"
                      variant="outlined"
                      sx={{ borderColor: themeColors.teal, color: themeColors.teal }}
                    />
                  )}
                  {transcriptData.word_count && (
                    <Chip
                      icon={<WordCountIcon />}
                      label={`${transcriptData.word_count.toLocaleString()} words`}
                      size="small"
                      variant="outlined"
                      sx={{ borderColor: themeColors.blue, color: themeColors.blue }}
                    />
                  )}
                  {transcriptData.meeting_id && (
                    <Chip
                      label={`Meeting: ${transcriptData.meeting_id}`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Stack>
              </Stack>
            </Paper>

            <Divider sx={{ my: 2 }} />

            {/* Transcript Text */}
            <Box
              sx={{
                px: 3,
                pb: 3,
                maxHeight: 'calc(90vh - 280px)',
                overflowY: 'auto',
              }}
            >
              {transcriptData.paragraphs && transcriptData.paragraphs.length > 0 ? (
                transcriptData.paragraphs.map((para, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    {para.style === 'heading' ? (
                      <Typography
                        variant="h6"
                        fontWeight={600}
                        sx={{
                          color: themeColors.teal,
                          mt: index > 0 ? 3 : 0,
                          mb: 1,
                        }}
                      >
                        {para.text}
                      </Typography>
                    ) : (
                      <Typography
                        variant="body1"
                        sx={{
                          lineHeight: 1.8,
                          color: 'text.primary',
                          textAlign: 'justify',
                        }}
                      >
                        {para.text}
                      </Typography>
                    )}
                  </Box>
                ))
              ) : transcriptData.full_text ? (
                <Typography
                  variant="body1"
                  sx={{
                    lineHeight: 1.8,
                    whiteSpace: 'pre-wrap',
                    color: 'text.primary',
                  }}
                >
                  {transcriptData.full_text}
                </Typography>
              ) : (
                <Alert severity="info">No transcript content available</Alert>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      {/* Footer Actions */}
      <Divider />
      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Button onClick={onClose} color="inherit">
          Close
        </Button>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleDownload}
          disabled={!recording}
          sx={{
            bgcolor: themeColors.teal,
            '&:hover': { bgcolor: themeColors.blue },
          }}
        >
          Download PDF
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TranscriptViewer;