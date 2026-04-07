// src/components/feedback/FeedbackDialog.jsx
// FIXED VERSION - Properly passes rating to success screen

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Slide
} from '@mui/material';
import {
  Close as CloseIcon,
  ThumbUp as ThumbUpIcon
} from '@mui/icons-material';
import FeedbackForm from './FeedbackForm';
import FeedbackSuccess from './FeedbackSuccess';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const FeedbackDialog = ({ 
  open, 
  onClose, 
  meetingId, 
  userId,
  meetingTitle = "Recent Meeting" 
}) => {
  const [showSuccess, setShowSuccess] = useState(false);
  const [submittedFeedback, setSubmittedFeedback] = useState(null);

  // ✅ FIX: Receive full feedback data object from form (includes feedbackId and rating)
  const handleSubmitSuccess = (feedbackData) => {
    console.log('📬 Feedback submitted:', feedbackData);
    // Store submitted feedback data for success screen
    setSubmittedFeedback(feedbackData);
    setShowSuccess(true);
  };

  const handleClose = () => {
    // Reset state
    setShowSuccess(false);
    setSubmittedFeedback(null);
    onClose();
  };

  const handleSkip = () => {
    // Allow users to skip feedback
    handleClose();
  };

  return (
    <Dialog
      open={open}
      TransitionComponent={Transition}
      onClose={(event, reason) => {
        // Prevent closing when feedback form is active
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
          console.log('⛔ Prevented dialog close:', reason);
          return;
        }
        handleClose();
      }}
      disableEscapeKeyDown={true}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(10px)',
          },
          onClick: (e) => {
            e.stopPropagation();
            console.log('⛔ Backdrop click blocked');
          }
        }
      }}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          maxHeight: '90vh',
          zIndex: 26000,
        }
      }}
    >
      {!showSuccess && (
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <ThumbUpIcon color="primary" sx={{ fontSize: 28 }} />
              <Typography variant="h5" fontWeight={700}>
                Share Your Feedback
              </Typography>
            </Box>
            <IconButton onClick={handleSkip} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, ml: 5 }}>
            Help us improve meeting experiences
          </Typography>
        </DialogTitle>
      )}

      <DialogContent sx={{ px: 4, py: 3 }}>
        {showSuccess ? (
          // Success Screen - ✅ Now receives rating from submittedFeedback
          <FeedbackSuccess
            feedbackId={submittedFeedback?.feedbackId}
            rating={submittedFeedback?.rating}
            meetingTitle={meetingTitle}
            onClose={handleClose}
            autoCloseDelay={3000}
          />
        ) : (
          // Feedback Form - ✅ Now passes full object with feedbackId and rating
          <FeedbackForm
            meetingId={meetingId}
            userId={userId}
            meetingTitle={meetingTitle}
            onSubmitSuccess={handleSubmitSuccess}
            onCancel={handleSkip}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackDialog;