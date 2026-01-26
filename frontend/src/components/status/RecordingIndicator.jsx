// src/components/status/RecordingIndicator.jsx
import React from 'react';
import { Chip, IconButton, Tooltip, Box } from '@mui/material';
import { RadioButtonChecked, Pause, PlayArrow } from '@mui/icons-material';

const RecordingIndicator = ({ 
  isRecording, 
  isPaused = false,
  recordingMethod, 
  duration,
  pausedDuration = 0,
  uploading,
  uploadProgress,
  onPauseResume = null,
  hasHostPrivileges = false
}) => {
  if (!isRecording) return null;

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return "0:00";

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getLabel = () => {
    if (uploading) {
      return `Uploading... ${uploadProgress}%`;
    }

    const formattedDuration = formatDuration(duration);
    const statusPrefix = isPaused ? "PAUSED" : "REC";

    if (recordingMethod === "client") {
      return `${statusPrefix} (Browser) ${formattedDuration}`;
    } else if (recordingMethod === "server") {
      return `${statusPrefix} (Server) ${formattedDuration}`;
    }

    return `${statusPrefix} ${formattedDuration}`;
  };

  const getBackgroundColor = () => {
    if (uploading) return '#2196f3';
    if (isPaused) return '#ff9800';
    return '#ef4444';
  };

  const getAnimation = () => {
    if (isPaused) {
      return 'blink 1s infinite';
    }
    return 'pulse 2s infinite';
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Chip
        icon={isPaused ? <Pause /> : <RadioButtonChecked />}
        label={getLabel()}
        sx={{
          height: 26,
          backgroundColor: getBackgroundColor(),
          color: 'white',
          fontWeight: 500,
          fontSize: '12px',
          animation: getAnimation(),
          transition: 'background-color 0.3s ease',
          '@keyframes pulse': {
            '0%': { opacity: 1 },
            '50%': { opacity: 0.8 },
            '100%': { opacity: 1 },
          },
          '@keyframes blink': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.4 },
          },
          '& .MuiChip-icon': {
            color: 'white',
            fontSize: 12,
          }
        }}
      />

      {hasHostPrivileges && onPauseResume && !uploading && (
        <Tooltip title={isPaused ? "Resume Recording" : "Pause Recording"}>
          <IconButton
            size="small"
            onClick={onPauseResume}
            sx={{
              color: 'white',
              backgroundColor: isPaused ? '#ff9800' : '#ef4444',
              padding: '4px',
              '&:hover': {
                backgroundColor: isPaused ? '#f57c00' : '#dc2626',
              },
            }}
          >
            {isPaused ? (
              <PlayArrow sx={{ fontSize: 16 }} />
            ) : (
              <Pause sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Tooltip>
      )}

      {pausedDuration > 0 && (
        <Tooltip title={`Total paused time: ${formatDuration(Math.floor(pausedDuration))}`}>
          <Chip
            label={`-${formatDuration(Math.floor(pausedDuration))}`}
            size="small"
            sx={{
              height: 20,
              fontSize: '10px',
              backgroundColor: 'rgba(0,0,0,0.3)',
              color: 'white',
            }}
          />
        </Tooltip>
      )}
    </Box>
  );
};

export default RecordingIndicator;