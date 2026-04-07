import React, { useState, useEffect } from "react";
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  Tooltip,
  useTheme,
  useMediaQuery,
  Divider,
  ListItemIcon,
  ListItemText,
  ClickAwayListener,
} from "@mui/material";
import {
  Notifications,
  Settings,
  VideoCall,
  ExitToApp,
  Person,
  Menu as MenuIcon,
} from "@mui/icons-material";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useNotificationContext } from "../context/NotificationContext";
import NotificationDropdown from "../components/common/NotificationDropdown";
import logoImage from '../assets/images/IMeetPro.png';

export const SIDEBAR_WIDTH = 280;
export const HEADER_HEIGHT = 90;

const MainLayout = ({ children, onMobileMenuToggle, mobileMenuOpen }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const { user, logout } = useAuth();
  const { unreadCount = 0 } = useNotificationContext();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  useEffect(() => {
    if (user) {
      console.log('🖼️ MainLayout: User data updated:', {
        userId: user.id || user.Id || user.ID,
        hasProfilePicture: !!user.profile_picture,
        picturePreview: user.profile_picture?.substring(0, 100),
      });
      const picture = user.profile_picture || user.profile_photo || null;
      setProfilePicture(picture);
    }
  }, [user, user?.profile_picture, user?.profile_photo]);

  useEffect(() => {
    const handleProfileUpdate = (event) => {
      console.log('🔄 MainLayout: Profile picture update event received');
      if (event.detail?.profile_picture) {
        setProfilePicture(event.detail.profile_picture);
      }
    };
    window.addEventListener('profilePictureUpdated', handleProfileUpdate);
    return () => window.removeEventListener('profilePictureUpdated', handleProfileUpdate);
  }, []);

  const handleMenu = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleNotificationToggle = () => setNotificationOpen(!notificationOpen);
  const handleNotificationClose = () => setNotificationOpen(false);

  const handleLogout = async () => {
    console.log('🚪 [MainLayout] Sign Out clicked');
    handleClose();
    try {
      await logout();
      console.log('✅ [MainLayout] Logout successful');
    } catch (error) {
      console.error('⚠️ [MainLayout] Logout error:', error);
    } finally {
      navigate("/auth");
    }
  };

  const getUserInitial = () => {
    const name = user?.full_name || user?.name || user?.email || "U";
    return name.charAt(0).toUpperCase();
  };

  return (
    <>
      <Box sx={{ flexGrow: 1, minHeight: "100vh", bgcolor: "background.default", position: "relative" }}>
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            background: "linear-gradient(135deg, #3B5998 0%, #2D7DD2 50%, #1A8A8A 100%)",
            color: "#ffffff",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 2px 12px rgba(26, 138, 138, 0.3)",
            height: HEADER_HEIGHT,
          }}
        >
          <Toolbar
            sx={{
              minHeight: `${HEADER_HEIGHT}px !important`,
              height: HEADER_HEIGHT,
              px: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* ✅ Left - Fixed SIDEBAR_WIDTH, logo centered */}
            <Box
              sx={{
                width: `${SIDEBAR_WIDTH}px`,
                minWidth: `${SIDEBAR_WIDTH}px`,
                maxWidth: `${SIDEBAR_WIDTH}px`,
                height: `${HEADER_HEIGHT}px`,
                flexShrink: 0,
                overflow: "visible",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",   // ✅ CENTER logo horizontally
                position: "relative",
              }}
            >
              {/* Mobile Hamburger */}
              {isMobile && (
                <IconButton
                  color="inherit"
                  onClick={onMobileMenuToggle}
                  sx={{
                    position: "absolute",
                    left: 8,
                    color: "#ffffff",
                    width: 44,
                    height: 44,
                    "&:hover": { bgcolor: "rgba(255, 255, 255, 0.15)" },
                    transition: "all 0.3s ease",
                  }}
                >
                  <MenuIcon sx={{ fontSize: 28 }} />
                </IconButton>
              )}

              {/* ✅ Logo - absolutely centered within sidebar width */}
              <Box
                onClick={() => navigate('/dashboard')}
                sx={{
                  position: "absolute",
                  left: "calc(50% - 30px)",
                  transform: "translateX(-50%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  height: `${HEADER_HEIGHT}px`,
                  transition: "opacity 0.3s ease",
                  "&:hover": { opacity: 0.85 },
                }}
              >
                <Box
                  component="img"
                  src={logoImage}
                  alt="IMeetPro Logo"
                  sx={{
                    width: "auto",
                    height: 88,
                    objectFit: "contain",
                    display: "block",
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                  }}
                />
              </Box>
            </Box>

            {/* Right Side - Notifications + Profile */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: { xs: 1.5, sm: 2.5 },
                pr: { xs: 2, sm: 3, md: 4 },
              }}
            >
              <ClickAwayListener onClickAway={handleNotificationClose}>
                <Box sx={{ position: "relative", zIndex: 1400 }}>
                  <Tooltip title="Notifications">
                    <IconButton
                      onClick={handleNotificationToggle}
                      sx={{
                        backgroundColor: "transparent",
                        color: "#ffffff",
                        padding: { xs: "6px", sm: "10px" },
                        transition: "all 0.3s ease",
                        "&:hover": {
                          backgroundColor: "rgba(255, 255, 255, 0.1)",
                          transform: "scale(1.1)",
                        },
                      }}
                    >
                      <Badge
                        badgeContent={unreadCount}
                        sx={{
                          "& .MuiBadge-badge": {
                            bgcolor: "#EF4444",
                            color: "#ffffff",
                            fontSize: "0.7rem",
                            minWidth: "18px",
                            height: "18px",
                            boxShadow: "0 2px 8px rgba(239, 68, 68, 0.4)",
                          },
                        }}
                      >
                        <Notifications sx={{ fontSize: { xs: 20, sm: 25 } }} />
                      </Badge>
                    </IconButton>
                  </Tooltip>
                  <NotificationDropdown
                    open={notificationOpen}
                    onClose={handleNotificationClose}
                    filterType="all"
                  />
                </Box>
              </ClickAwayListener>

              <Tooltip title="Profile Menu">
                <IconButton
                  onClick={handleMenu}
                  sx={{
                    p: 0,
                    transition: "all 0.3s ease",
                    "&:hover": { backgroundColor: "transparent", transform: "scale(1.05)" },
                  }}
                >
                  <Avatar
                    src={profilePicture}
                    sx={{
                      width: { xs: 35, sm: 40 },
                      height: { xs: 35, sm: 40 },
                      cursor: "pointer",
                      bgcolor: profilePicture ? 'transparent' : 'rgba(255, 255, 255, 0.3)',
                      color: '#ffffff',
                      fontSize: { xs: '1.2rem', sm: '1.5rem' },
                      fontWeight: 700,
                      border: '2px solid rgba(255, 255, 255, 0.5)',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {!profilePicture && getUserInitial()}
                  </Avatar>
                </IconButton>
              </Tooltip>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Profile Menu Dropdown */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleClose}
          PaperProps={{
            elevation: 0,
            sx: {
              mt: 1.5,
              minWidth: 280,
              borderRadius: 2,
              overflow: 'visible',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              border: '1px solid',
              borderColor: 'divider',
              '&:before': {
                content: '""',
                display: 'block',
                position: 'absolute',
                top: 0,
                right: 14,
                width: 10,
                height: 10,
                bgcolor: 'background.paper',
                transform: 'translateY(-50%) rotate(45deg)',
                zIndex: 0,
                borderLeft: '1px solid',
                borderTop: '1px solid',
                borderColor: 'divider',
              },
            },
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <Box sx={{ p: 3, pb: 2.5, background: "linear-gradient(135deg, rgba(26, 138, 138, 0.08) 0%, rgba(45, 125, 210, 0.08) 100%)" }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar
                src={profilePicture}
                sx={{
                  width: 56, height: 56,
                  border: '2px solid', borderColor: '#2D7DD2',
                  bgcolor: profilePicture ? 'transparent' : '#2D7DD2',
                  boxShadow: '0 2px 8px rgba(45, 125, 210, 0.3)',
                  fontSize: '1.5rem', fontWeight: 600, color: '#ffffff',
                }}
              >
                {!profilePicture && getUserInitial()}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.3, mb: 0.5, letterSpacing: '0.01em' }}>
                  {user?.full_name || user?.name || 'User'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.813rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email || 'user@example.com'}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Divider />

          <Box sx={{ py: 1 }}>
            <MenuItem
              onClick={() => { navigate('/profile'); handleClose(); }}
              sx={{ px: 3, py: 1.5, mx: 1, borderRadius: 1, transition: 'all 0.2s ease', '&:hover': { bgcolor: 'rgba(45, 125, 210, 0.08)', transform: 'translateX(4px)' } }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}><Person fontSize="small" sx={{ color: '#2D7DD2' }} /></ListItemIcon>
              <ListItemText
                primary={<Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>My Profile</Typography>}
                secondary={<Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>View and edit profile</Typography>}
              />
            </MenuItem>

            <MenuItem
              onClick={() => { navigate('/settings'); handleClose(); }}
              sx={{ px: 3, py: 1.5, mx: 1, borderRadius: 1, transition: 'all 0.2s ease', '&:hover': { bgcolor: 'rgba(45, 125, 210, 0.08)', transform: 'translateX(4px)' } }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}><Settings fontSize="small" sx={{ color: '#2D7DD2' }} /></ListItemIcon>
              <ListItemText
                primary={<Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>Settings</Typography>}
                secondary={<Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>App preferences</Typography>}
              />
            </MenuItem>
          </Box>

          <Divider sx={{ my: 1 }} />

          <Box sx={{ pb: 1 }}>
            <MenuItem
              onClick={handleLogout}
              sx={{ px: 3, py: 1.5, mx: 1, borderRadius: 1, transition: 'all 0.2s ease', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.08)', transform: 'translateX(4px)' } }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}><ExitToApp fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
              <ListItemText
                primary={<Typography variant="body2" sx={{ fontWeight: 500, color: 'error.main' }}>Sign Out</Typography>}
                secondary={<Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>End current session</Typography>}
              />
            </MenuItem>
          </Box>
        </Menu>

        <Box
          component="main"
          sx={{
            mt: `${HEADER_HEIGHT}px`,
            minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
            bgcolor: "background.default",
          }}
        >
          {children}
        </Box>
      </Box>
    </>
  );
};

export default MainLayout;