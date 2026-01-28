// src/components/feedback/FeedbackForm.jsx
// FIXED VERSION - Resolves typing issue in comments field

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Rating,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  CircularProgress,
  LinearProgress,
  Chip,
  Stack,
  Paper,
  Divider
} from '@mui/material';
import {
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Send as SendIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useFeedback } from '../../hooks/useFeedback';

const FEEDBACK_TYPES = [
  { value: 'General', label: 'General Feedback', icon: '💬' },
  { value: 'Technical', label: 'Technical Issues', icon: '🔧' },
  { value: 'Content', label: 'Content Quality', icon: '📚' },
  { value: 'Other', label: 'Other', icon: '📝' }
];

const RATING_LABELS = {
  1: { text: 'Poor', color: 'error', emoji: '😞' },
  2: { text: 'Fair', color: 'warning', emoji: '😕' },
  3: { text: 'Good', color: 'info', emoji: '🙂' },
  4: { text: 'Very Good', color: 'primary', emoji: '😊' },
  5: { text: 'Excellent', color: 'success', emoji: '🤩' }
};

const FeedbackForm = ({ 
  meetingId, 
  userId, 
  meetingTitle,
  onSubmitSuccess,
  onCancel 
}) => {
  const { 
    submitFeedback, 
    validateFeedbackData,
    loading, 
    error, 
    validationErrors 
  } = useFeedback();

  // ✅ FIX 1: Separate state for each field to prevent unnecessary re-renders
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [feedbackType, setFeedbackType] = useState('General');

  const [touched, setTouched] = useState({
    rating: false,
    comments: false,
    feedbackType: false
  });

  const [localError, setLocalError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  // ✅ FIX 2: Use ref to store current comments for validation without triggering re-renders
  const commentsRef = useRef(comments);
  
  // Keep ref in sync with state
  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  // ✅ FIX 3: Only validate on rating/type changes, NOT on comment changes
  useEffect(() => {
    // Only validate when rating changes and has been touched
    if (rating > 0 && touched.rating) {
      const timer = setTimeout(async () => {
        setIsValidating(true);
        
        await validateFeedbackData({
          meetingId,
          userId,
          rating,
          comments: commentsRef.current, // Use ref to get current value
          feedbackType
        });
        
        setIsValidating(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [rating, feedbackType, meetingId, userId, validateFeedbackData, touched.rating]);
  // ✅ Note: 'comments' is NOT in dependency array - this is intentional!

  // ✅ FIX 4: Memoized handlers to prevent re-renders
  const handleRatingChange = useCallback((event, newValue) => {
    console.log('📊 Rating changed:', newValue);
    setRating(newValue || 0);
    setTouched(prev => ({ ...prev, rating: true }));
    setLocalError('');
  }, []);

  // ✅ FIX 5: Simple direct handler for comments - no complex state merging
  const handleCommentsChange = useCallback((event) => {
    const value = event.target.value;
    
    // Limit to 4000 characters as per backend validation
    if (value.length <= 4000) {
      setComments(value);
      setTouched(prev => ({ ...prev, comments: true }));
      setLocalError('');
    }
  }, []);

  const handleTypeChange = useCallback((event) => {
    console.log('🏷️ Type changed:', event.target.value);
    setFeedbackType(event.target.value);
    setTouched(prev => ({ ...prev, feedbackType: true }));
  }, []);

  const handleBlur = useCallback((field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  const validateForm = useCallback(() => {
    if (rating === 0) {
      setLocalError('Please select a rating before submitting');
      return false;
    }
    if (!feedbackType) {
      setLocalError('Please select a feedback category');
      return false;
    }
    return true;
  }, [rating, feedbackType]);

  const handleSubmit = useCallback(async () => {
    console.log('🚀 Submitting feedback:', { rating, comments, feedbackType });
    
    // Mark all fields as touched
    setTouched({
      rating: true,
      comments: true,
      feedbackType: true
    });

    // Validate
    if (!validateForm()) {
      return;
    }

    // Submit feedback
    const result = await submitFeedback({
      meetingId,
      userId,
      rating,
      comments,
      feedbackType
    });

    if (result.success) {
      console.log('✅ Feedback submitted successfully:', result.feedbackId);
      // Trigger success callback with rating for success screen
      onSubmitSuccess?.({
        feedbackId: result.feedbackId,
        rating
      });
    } else {
      console.error('❌ Feedback submission failed:', result.error);
      setLocalError(result.error || 'Failed to submit feedback');
    }
  }, [rating, comments, feedbackType, meetingId, userId, submitFeedback, validateForm, onSubmitSuccess]);

  // Computed values
  const isFormValid = rating > 0 && feedbackType;
  const currentRatingLabel = RATING_LABELS[rating];
  const charCount = comments.length;
  const charLimit = 4000;
  const charPercentage = (charCount / charLimit) * 100;

  return (
    <Box sx={{ width: '100%' }}>
      {/* Meeting Title */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 2, 
          mb: 3, 
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          borderRadius: 2
        }}
      >
        <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5 }}>
          Feedback for:
        </Typography>
        <Typography variant="h6" fontWeight={600}>
          {meetingTitle}
        </Typography>
      </Paper>

      {/* Rating Section */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography 
          variant="h6" 
          gutterBottom 
          fontWeight={600}
          color="text.primary"
        >
          How would you rate this meeting?
        </Typography>
        
        <Box sx={{ my: 3 }}>
          <Rating
            name="meeting-rating"
            value={rating}
            onChange={handleRatingChange}
            onBlur={() => handleBlur('rating')}
            size="large"
            icon={<StarIcon fontSize="inherit" />}
            emptyIcon={<StarBorderIcon fontSize="inherit" />}
            sx={{ 
              fontSize: '3.5rem',
              '& .MuiRating-iconFilled': {
                color: currentRatingLabel?.color 
                  ? `${currentRatingLabel.color}.main` 
                  : 'warning.main'
              }
            }}
          />
        </Box>

        {/* Rating Label */}
        {rating > 0 && currentRatingLabel && (
          <Box sx={{ mt: 2 }}>
            <Chip
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  <span style={{ fontSize: '1.2rem' }}>
                    {currentRatingLabel.emoji}
                  </span>
                  <Typography variant="body1" fontWeight={600}>
                    {currentRatingLabel.text}
                  </Typography>
                </Box>
              }
              color={currentRatingLabel.color}
              size="medium"
              sx={{ px: 2, py: 2.5, borderRadius: 3 }}
            />
          </Box>
        )}

        {/* Rating Error */}
        {touched.rating && rating === 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Please select a rating to continue
            </Typography>
          </Alert>
        )}
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Feedback Type */}
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel id="feedback-type-label">
          Feedback Category *
        </InputLabel>
        <Select
          labelId="feedback-type-label"
          id="feedback-type"
          value={feedbackType}
          onChange={handleTypeChange}
          onBlur={() => handleBlur('feedbackType')}
          label="Feedback Category *"
          disabled={loading}
        >
          {FEEDBACK_TYPES.map(type => (
            <MenuItem key={type.value} value={type.value}>
              <Box display="flex" alignItems="center" gap={1}>
                <span style={{ fontSize: '1.2rem' }}>{type.icon}</span>
                <Typography>{type.label}</Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* ✅ FIX 6: Comments TextField - direct binding, no object state */}
      <TextField
        fullWidth
        multiline
        rows={5}
        label="Share your thoughts (Optional)"
        placeholder="What went well? What could be improved? Any suggestions?"
        value={comments}
        onChange={handleCommentsChange}
        onBlur={() => handleBlur('comments')}
        variant="outlined"
        disabled={loading}
        sx={{ mb: 1 }}
        inputProps={{
          maxLength: 4000
        }}
      />

      {/* Character Count */}
      <Box sx={{ mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
          <Typography 
            variant="caption" 
            color={charCount > 3800 ? 'error.main' : 'text.secondary'}
          >
            {charCount.toLocaleString()} / {charLimit.toLocaleString()} characters
          </Typography>
          {charCount > 3800 && (
            <Chip 
              label="Almost at limit!" 
              size="small" 
              color="warning"
              sx={{ height: 20 }}
            />
          )}
        </Box>
        <LinearProgress 
          variant="determinate" 
          value={Math.min(charPercentage, 100)}
          color={charCount > 3800 ? 'error' : 'primary'}
          sx={{ height: 4, borderRadius: 2 }}
        />
      </Box>

      {/* Info Box */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 2, 
          mb: 3, 
          bgcolor: 'info.lighter', 
          border: 1,
          borderColor: 'info.light'
        }}
      >
        <Box display="flex" gap={1}>
          <InfoIcon color="info" fontSize="small" />
          <Typography variant="caption" color="text.secondary">
            Your feedback helps us improve meeting quality and create better experiences.
            All responses are confidential.
          </Typography>
        </Box>
      </Paper>

      {/* Validation Progress */}
      {isValidating && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            Validating your feedback...
          </Typography>
        </Box>
      )}

      {/* Error Messages */}
      {(localError || error) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {localError || error}
        </Alert>
      )}

      {/* Validation Errors */}
      {Object.keys(validationErrors).length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            Please fix the following issues:
          </Typography>
          <Stack spacing={0.5}>
            {Object.entries(validationErrors).map(([field, message]) => (
              <Typography key={field} variant="caption">
                • {field}: {message}
              </Typography>
            ))}
          </Stack>
        </Alert>
      )}

      {/* Action Buttons */}
      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button
          variant="outlined"
          onClick={onCancel}
          disabled={loading}
          size="large"
        >
          Skip
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!isFormValid || loading || isValidating}
          startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
          size="large"
          sx={{ minWidth: 140 }}
        >
          {loading ? 'Submitting...' : 'Submit Feedback'}
        </Button>
      </Stack>
    </Box>
  );
};

export default FeedbackForm;