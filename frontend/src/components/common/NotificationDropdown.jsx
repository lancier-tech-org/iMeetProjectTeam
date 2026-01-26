// src/components/common/NotificationDropdown.jsx - UPDATED WITH CLICK NAVIGATION TO RECORDINGS
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Badge,
  Divider,
  Button,
  CircularProgress,
  Fade,
  Skeleton,
  Tooltip
} from '@mui/material';
import {
  VideoCall,
  RecordVoiceOver,
  Person,
  Event,
  Close,
  MarkEmailRead,
  Delete,
  Refresh
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { formatRelativeTime } from '../../utils/helpers';
import { useNotificationContext } from '../../context/NotificationContext';

const NotificationDropdown = ({ open, onClose, anchorEl, filterType = 'all' }) => {
  // ✅ ADD: useNavigate hook for navigation
  const navigate = useNavigate();
  
  const {
    notifications = [],
    unreadCount = 0,
    loading = false,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    fetchNotifications,
    fetchScheduleNotifications,
    fetchCalendarNotifications,
    fetchRecordingNotifications
  } = useNotificationContext();

  const [localLoading, setLocalLoading] = useState(false);
  
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const filteredNotifications = notifications;

  const filteredUnreadCount = React.useMemo(() => {
    return filteredNotifications.filter(n => !n.is_read).length;
  }, [filteredNotifications]);

  const getNotificationIcon = (type) => {
    const iconProps = { 
      sx: { 
        fontSize: 20, 
        color: '#0891b2'
      } 
    };

    switch (type) {
      case 'meeting_reminder':
      case 'meeting_started':
      case 'meeting_ended':
      case 'meeting_invitation':
      case 'meeting_created':
        return <VideoCall {...iconProps} />;
      
      case 'recording_ready':
      case 'recording_started':
      case 'recording_stopped':
      case 'recording_completed':
      case 'recording_completed_host':
      case 'recording_processed':
      case 'recording_available':
        return <RecordVoiceOver {...iconProps} />;
      
      case 'participant_joined':
      case 'participant_left':
      case 'new_participant':
        return <Person {...iconProps} />;
      
      case 'meeting_scheduled':
      case 'meeting_updated':
      case 'calendar_meeting':
      case 'calendar_meeting_invitation':
      case 'calendar_meeting_created':
      case 'scheduled_meeting_invitation':
      case 'scheduled_meeting_created':
        return <Event {...iconProps} />;
      
      default:
        return <VideoCall {...iconProps} />;
    }
  };

  // ✅ UPDATED: handleNotificationClick with navigation logic
  const handleNotificationClick = async (notification) => {
    console.log('Notification clicked:', notification);
    
    // Mark as read first
    if (!notification.is_read) {
      try {
        await markAsRead(notification.id);
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    // Get notification type (handle both field names)
    const notificationType = notification.type || notification.notification_type;

    // Handle different notification types with navigation
    switch (notificationType) {
      // ✅ Recording notifications - Navigate to recordings page
      case 'recording_completed':
      case 'recording_completed_host':
      case 'recording_ready':
      case 'recording_processed':
      case 'recording_available':
        console.log('📹 Navigating to recordings page...');
        onClose(); // Close dropdown first
        
        // Navigate to recordings page (with optional meeting_id filter)
        if (notification.meeting_id) {
          navigate(`/recordings?meeting_id=${notification.meeting_id}`);
        } else {
          navigate('/recordings');
        }
        break;

      // Meeting reminder/started - Open meeting URL in new tab
      case 'meeting_reminder':
      case 'meeting_started':
        if (notification.meeting_url) {
          window.open(notification.meeting_url, '_blank');
        } else if (notification.meeting_id) {
          onClose();
          navigate(`/meeting/${notification.meeting_id}`);
        }
        break;

      // Calendar/Schedule notifications - Navigate to calendar
      case 'meeting_scheduled':
      case 'meeting_invitation':
      case 'calendar_meeting':
      case 'calendar_meeting_invitation':
      case 'scheduled_meeting_invitation':
      case 'meeting_created':
        console.log('📅 Navigating to calendar page...');
        onClose();
        navigate('/calendar');
        break;

      // Analytics notifications
      case 'meeting_ended':
        if (notification.meeting_id) {
          onClose();
          navigate(`/analytics/meeting/${notification.meeting_id}`);
        }
        break;

      // Default behavior
      default:
        console.log('Default notification click handler');
        if (notification.meeting_url) {
          // Check if it's an internal route or external URL
          if (notification.meeting_url.startsWith('/')) {
            onClose();
            navigate(notification.meeting_url);
          } else if (notification.meeting_url.startsWith('http')) {
            window.open(notification.meeting_url, '_blank');
          }
        }
        break;
    }
  };

  const handleDeleteNotification = async (notificationId, event) => {
    event.stopPropagation();
    
    try {
      setLocalLoading(true);
      await deleteNotification(notificationId);
    } catch (error) {
      console.error('Error deleting notification:', error);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (filteredUnreadCount === 0) return;
    
    try {
      setLocalLoading(true);
      await markAllAsRead();
    } catch (error) {
      console.error('Error marking all as read:', error);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setLocalLoading(true);
      await fetchNotifications();
    } catch (error) {
      console.error('Error refreshing notifications:', error);
    } finally {
      setLocalLoading(false);
    }
  };

  const renderSkeleton = () => (
    <Box sx={{ p: 2 }}>
      {[...Array(3)].map((_, index) => (
        <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="80%" height={20} />
            <Skeleton variant="text" width="60%" height={16} />
            <Skeleton variant="text" width="40%" height={14} />
          </Box>
        </Box>
      ))}
    </Box>
  );

  if (!open) return null;

  return (
    <Fade in={open}>
      <Box
        sx={{
          position: 'fixed',
          top: 88,
          right: 16,
          width: 420,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 120px)',
          bgcolor: 'background.paper',
          borderRadius: 3,
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          border: '1px solid rgba(0,0,0,0.08)',
          overflow: 'hidden',
          zIndex: 9999,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              All Notifications
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {filteredUnreadCount} unread notification{filteredUnreadCount !== 1 ? 's' : ''}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh">
              <IconButton 
                size="small" 
                sx={{ color: 'white' }}
                onClick={handleRefresh}
                disabled={localLoading}
              >
                <Refresh sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Close">
              <IconButton 
                size="small" 
                sx={{ color: 'white' }}
                onClick={onClose}
              >
                <Close sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Actions Bar */}
        {filteredUnreadCount > 0 && (
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <Button
              size="small"
              startIcon={<MarkEmailRead />}
              onClick={handleMarkAllAsRead}
              disabled={localLoading}
              sx={{ fontSize: '0.75rem', color: '#0891b2' }}
            >
              Mark all as read
            </Button>
          </Box>
        )}

        {/* Notifications List */}
        <Box sx={{ maxHeight: 450, overflow: 'auto' }}>
          {loading ? (
            renderSkeleton()
          ) : filteredNotifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No notifications yet
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {filteredNotifications.map((notification, index) => (
                <React.Fragment key={notification.id}>
                  <ListItem
                    sx={{
                      cursor: 'pointer',
                      bgcolor: notification.is_read ? 'transparent' : 'rgba(8, 145, 178, 0.04)',
                      '&:hover': {
                        bgcolor: 'rgba(8, 145, 178, 0.08)'
                      },
                      py: 2,
                      px: 2,
                      position: 'relative',
                      alignItems: 'flex-start',
                      transition: 'background-color 0.2s ease'
                    }}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <ListItemAvatar sx={{ mt: 0.5 }}>
                      <Avatar
                        sx={{
                          bgcolor: notification.is_read ? 'grey.100' : '#0891b2',
                          width: 44,
                          height: 44
                        }}
                      >
                        {React.cloneElement(
                          getNotificationIcon(notification.type || notification.notification_type),
                          {
                            sx: {
                              fontSize: 22,
                              color: notification.is_read ? '#0891b2' : 'white'
                            }
                          }
                        )}
                      </Avatar>
                    </ListItemAvatar>
                    
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Typography
                            component="span"
                            variant="subtitle2"
                            sx={{
                              fontWeight: notification.is_read ? 500 : 700,
                              color: notification.is_read ? 'text.primary' : '#0891b2',
                              flex: 1,
                              mr: 1,
                              fontSize: '0.95rem'
                            }}
                          >
                            {notification.title}
                          </Typography>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {!notification.is_read && (
                              <Box
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  bgcolor: '#0891b2',
                                  flexShrink: 0
                                }}
                              />
                            )}
                            
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                onClick={(e) => handleDeleteNotification(notification.id, e)}
                                sx={{
                                  opacity: 0,
                                  '.MuiListItem-root:hover &': {
                                    opacity: 1
                                  },
                                  color: 'error.main'
                                }}
                              >
                                <Delete sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                      }
                      secondary={
                        <Box component="span">
                          {/* ✅ HTML rendering for bold text and formatting */}
                          <Typography
                            component="div"
                            variant="body2"
                            sx={{ 
                              mb: 1, 
                              display: 'block',
                              color: 'text.secondary',
                              '& b': { 
                                fontWeight: 600, 
                                color: 'text.primary' 
                              },
                              '& i': { 
                                fontStyle: 'italic', 
                                color: '#0891b2',
                                fontSize: '0.9em',
                                cursor: 'pointer',
                                '&:hover': {
                                  textDecoration: 'underline'
                                }
                              },
                              whiteSpace: 'pre-line',
                              lineHeight: 1.7,
                              fontSize: '0.875rem'
                            }}
                            dangerouslySetInnerHTML={{ 
                              __html: notification.message 
                            }}
                          />
                          
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{ 
                              fontSize: '0.75rem',
                              color: 'text.disabled',
                              fontWeight: 500
                            }}
                          >
                            {notification.time_ago || formatRelativeTime(notification.created_at)}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  
                  {index < filteredNotifications.length - 1 && (
                    <Divider variant="inset" />
                  )}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>

        {/* Loading overlay */}
        {localLoading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: 'rgba(255,255,255,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1
            }}
          >
            <CircularProgress size={24} sx={{ color: '#0891b2' }} />
          </Box>
        )}
      </Box>
    </Fade>
  );
};

export default NotificationDropdown;