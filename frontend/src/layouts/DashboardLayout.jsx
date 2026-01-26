import React, { useState } from "react";
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  useTheme,
  useMediaQuery,
  Collapse,
  Badge,
  Typography,
} from "@mui/material";
import {
  VideoCall,
  Schedule,
  CalendarMonth,
  VideoLibrary,
  Analytics,
  Person,
  Dashboard as DashboardIcon,
  Settings,
  ExpandLess,
  ExpandMore,
  AccessTime,
  Event,
  PlayCircle,
  Close,
} from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";
import MainLayout from "./MainLayout";

const drawerWidth = 280;
const HEADER_HEIGHT = 90; // Must match MainLayout header height

const DashboardLayout = ({ children, badges = {} }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [recordingsMenuOpen, setRecordingsMenuOpen] = useState(false);
  const [meetingMenuOpen, setMeetingMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Default badge values, can be overridden by props
  const defaultBadges = {
    schedule: 0,
    recordings: 0,
    notifications: 0,
    ...badges,
  };

  const menuItems = [
    {
      text: "Dashboard",
      icon: <DashboardIcon />,
      path: "/dashboard",
      badge: null,
    },
    {
      text: "New Meeting",
      icon: <VideoCall />,
      path: "/meeting/new",
      badge: null,
      subItems: [
        {
          text: "Instant Meeting",
          icon: <PlayCircle />,
          path: "/meeting/instant",
        },
        {
          text: "Schedule Meeting",
          icon: <AccessTime />,
          path: "/meeting/schedule",
        },
        {
          text: "Calendar Meeting",
          icon: <Event />,
          path: "/meeting/calendar",
        },
       
      ],
    },
    {
      text: "Schedule",
      icon: <Schedule />,
      path: "/schedule",
      badge: defaultBadges.schedule > 0 ? defaultBadges.schedule : null,
    },
    {
      text: "Calendar",
      icon: <CalendarMonth />,
      path: "/calendar",
      badge: null,
    },
    {
      text: "Recordings",
      icon: <VideoLibrary />,
      path: "/recordings",
      badge: defaultBadges.recordings > 0 ? defaultBadges.recordings : null,
      subItems: [
        {
          text: "All Recordings",
          icon: <VideoLibrary />,
          path: "/recordings?type=all",
        },
        {
          text: "Instant Meetings",
          icon: <PlayCircle />,
          path: "/recordings?type=instant",
        },
        {
          text: "Scheduled Meetings",
          icon: <AccessTime />,
          path: "/recordings?type=scheduled",
        },
        {
          text: "Calendar Meetings",
          icon: <Event />,
          path: "/recordings?type=calendar",
        },
      ],
    },
    {
      text: "Analytics",
      icon: <Analytics />,
      path: "/analytics",
      badge: null,
    },
  ];

  const bottomItems = [
    { text: "Profile", icon: <Person />, path: "/profile" },
    { text: "Settings", icon: <Settings />, path: "/settings" },
  ];

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDrawerClose = () => {
    setMobileOpen(false);
  };

  const handleMenuClick = (item) => {
    if (item.subItems) {
      if (item.text === "New Meeting") {
        setMeetingMenuOpen(!meetingMenuOpen);
      } else if (item.text === "Recordings") {
        setRecordingsMenuOpen(!recordingsMenuOpen);
      }
    } else {
      navigate(item.path);
      if (isMobile) {
        setMobileOpen(false);
      }
    }
  };

  const handleSubMenuClick = (subItem) => {
    console.log("🔘 Submenu clicked:", subItem.text, "path:", subItem.path);
    
    setMeetingMenuOpen(false);
    setRecordingsMenuOpen(false);
    
    if (isMobile) {
      setMobileOpen(false);
    }
    
    navigate(subItem.path);
  };

  const isSelected = (path) => location.pathname === path;

  const drawer = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        // REVERSED: Bottom color (purple/blue) now at top, top color (teal) now at bottom
        background: "linear-gradient(180deg, #3B5998 0%, #2D7DD2 50%, #1A8A8A 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle overlay for depth */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(10px)",
          zIndex: 0,
        }}
      />

      {/* Mobile Header with Close Button */}
      {isMobile && (
        <Box
          sx={{
            p: 2,
            position: "relative",
            zIndex: 1,
            flexShrink: 0,
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 60,
          }}
        >
          <Typography
            variant="h6"
            sx={{
              color: "#ffffff",
              fontWeight: 700,
              letterSpacing: "-0.025em",
              fontSize: "1.1rem",
              textShadow: "0 2px 4px rgba(0,0,0,0.2)",
            }}
          >
            Menu
          </Typography>
          <IconButton
            onClick={handleDrawerClose}
            sx={{
              color: "#ffffff",
              bgcolor: "rgba(255, 255, 255, 0.15)",
              width: 36,
              height: 36,
              "&:hover": {
                bgcolor: "rgba(255, 255, 255, 0.25)",
                color: "#ffffff",
                transform: "scale(1.05)",
              },
              transition: "all 0.2s ease-in-out",
            }}
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/* Scrollable Content Area */}
      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          zIndex: 1,
          pt: isMobile ? 0 : 2,
        }}
      >
        {/* Main Menu - Scrollable */}
        <Box
          sx={{
            flexGrow: 1,
            overflowY: "auto",
            overflowX: "hidden",
            px: 2,
            py: 1,
            "&::-webkit-scrollbar": {
              width: "4px",
            },
            "&::-webkit-scrollbar-track": {
              background: "transparent",
            },
            "&::-webkit-scrollbar-thumb": {
              background: "rgba(255, 255, 255, 0.3)",
              borderRadius: "2px",
              "&:hover": {
                background: "rgba(255, 255, 255, 0.5)",
              },
            },
          }}
        >
          <List sx={{ py: 0 }}>
            {menuItems.map((item) => (
              <Box key={item.text}>
                <ListItem
                  button
                  onClick={() => handleMenuClick(item)}
                  selected={isSelected(item.path)}
                  sx={{
                    borderRadius: "12px",
                    mb: 1,
                    minHeight: 48,
                    px: 2,
                    bgcolor: isSelected(item.path)
                      ? "rgba(255, 255, 255, 0.2)"
                      : "transparent",
                    color: "#ffffff",
                    border: isSelected(item.path)
                      ? "1px solid rgba(255, 255, 255, 0.3)"
                      : "1px solid transparent",
                    boxShadow: isSelected(item.path)
                      ? "0 2px 8px rgba(0, 0, 0, 0.15)"
                      : "none",
                    backdropFilter: isSelected(item.path) ? "blur(10px)" : "none",
                    position: "relative",
                    overflow: "hidden",
                    "&::before": isSelected(item.path)
                      ? {
                          content: '""',
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: "3px",
                          bgcolor: "#ffffff",
                          borderRadius: "0 2px 2px 0",
                        }
                      : {},
                    "&:hover": {
                      bgcolor: "rgba(255, 255, 255, 0.15)",
                      transform: "translateX(4px)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      backdropFilter: "blur(10px)",
                    },
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    "& .MuiListItemIcon-root": {
                      color: "#ffffff",
                      transition: "color 0.3s ease",
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                    }}
                  >
                    {item.badge ? (
                      <Badge
                        badgeContent={item.badge}
                        sx={{
                          "& .MuiBadge-badge": {
                            bgcolor: "#EF4444",
                            color: "#ffffff",
                            fontSize: "0.7rem",
                            minWidth: "18px",
                            height: "18px",
                            fontWeight: 600,
                            boxShadow: "0 2px 4px rgba(239, 68, 68, 0.3)",
                          },
                        }}
                      >
                        {item.icon}
                      </Badge>
                    ) : (
                      item.icon
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      fontWeight: isSelected(item.path) ? 600 : 500,
                      fontSize: "0.9rem",
                      letterSpacing: "-0.01em",
                    }}
                  />
                  {item.subItems && (
                    <Box
                      sx={{
                        bgcolor: "rgba(255, 255, 255, 0.15)",
                        borderRadius: "8px",
                        p: 0.5,
                        ml: 1,
                        transition: "all 0.2s ease",
                        "& svg": {
                          fontSize: "1rem",
                          color: "#ffffff",
                        },
                      }}
                    >
                      {item.text === "New Meeting" ? (
                        meetingMenuOpen ? (
                          <ExpandLess />
                        ) : (
                          <ExpandMore />
                        )
                      ) : item.text === "Recordings" ? (
                        recordingsMenuOpen ? (
                          <ExpandLess />
                        ) : (
                          <ExpandMore />
                        )
                      ) : null}
                    </Box>
                  )}
                </ListItem>

                {/* Submenu */}
                {item.subItems &&
                  (item.text === "New Meeting" ||
                    item.text === "Recordings") && (
                    <Collapse
                      in={
                        item.text === "New Meeting"
                          ? meetingMenuOpen
                          : recordingsMenuOpen
                      }
                      timeout="auto"
                      unmountOnExit
                    >
                      <List
                        component="div"
                        disablePadding
                        sx={{ ml: 1, position: "relative" }}
                      >
                        {/* Connecting line */}
                        <Box
                          sx={{
                            position: "absolute",
                            left: "20px",
                            top: 0,
                            bottom: 0,
                            width: "1px",
                            bgcolor: "rgba(255, 255, 255, 0.2)",
                          }}
                        />
                        {item.subItems.map((subItem, index) => (
                          <ListItem
                            key={subItem.text}
                            button
                            onClick={() => handleSubMenuClick(subItem)}
                            selected={isSelected(subItem.path)}
                            sx={{
                              pl: 3,
                              borderRadius: "10px",
                              mb: 0.5,
                              minHeight: 40,
                              bgcolor: isSelected(subItem.path)
                                ? "rgba(255, 255, 255, 0.15)"
                                : "transparent",
                              color: "#ffffff",
                              border: isSelected(subItem.path)
                                ? "1px solid rgba(255, 255, 255, 0.2)"
                                : "1px solid transparent",
                              position: "relative",
                              "&::before": {
                                content: '""',
                                position: "absolute",
                                left: "20px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                width: "8px",
                                height: "1px",
                                bgcolor: isSelected(subItem.path)
                                  ? "#ffffff"
                                  : "rgba(255, 255, 255, 0.4)",
                              },
                              "&:hover": {
                                bgcolor: "rgba(255, 255, 255, 0.12)",
                                transform: "translateX(4px)",
                                border: "1px solid rgba(255, 255, 255, 0.2)",
                              },
                              transition:
                                "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                              "& .MuiListItemIcon-root": {
                                color: "rgba(255, 255, 255, 0.9)",
                                transition: "color 0.2s ease",
                              },
                            }}
                          >
                            <ListItemIcon
                              sx={{
                                minWidth: 32,
                              }}
                            >
                              {subItem.icon}
                            </ListItemIcon>
                            <ListItemText
                              primary={subItem.text}
                              primaryTypographyProps={{
                                fontSize: "0.85rem",
                                fontWeight: isSelected(subItem.path)
                                  ? 600
                                  : 400,
                                letterSpacing: "-0.01em",
                              }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Collapse>
                  )}
              </Box>
            ))}
          </List>
        </Box>

        {/* Professional Divider */}
        <Box
          sx={{
            mx: 2,
            height: "1px",
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
            my: 2,
            flexShrink: 0,
          }}
        />

        {/* Bottom Menu - Fixed */}
        <Box
          sx={{
            px: 2,
            py: 1,
            flexShrink: 0,
            pb: 3,
          }}
        >
          <List sx={{ py: 0 }}>
            {bottomItems.map((item) => (
              <ListItem
                key={item.text}
                button
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                selected={isSelected(item.path)}
                sx={{
                  borderRadius: "12px",
                  mb: 1,
                  minHeight: 48,
                  px: 2,
                  bgcolor: isSelected(item.path)
                    ? "rgba(255, 255, 255, 0.2)"
                    : "transparent",
                  color: "#ffffff",
                  border: isSelected(item.path)
                    ? "1px solid rgba(255, 255, 255, 0.3)"
                    : "1px solid transparent",
                  boxShadow: isSelected(item.path)
                    ? "0 2px 8px rgba(0, 0, 0, 0.15)"
                    : "none",
                  backdropFilter: isSelected(item.path) ? "blur(10px)" : "none",
                  position: "relative",
                  "&::before": isSelected(item.path)
                    ? {
                        content: '""',
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: "3px",
                        bgcolor: "#ffffff",
                        borderRadius: "0 2px 2px 0",
                      }
                    : {},
                  "&:hover": {
                    bgcolor: "rgba(255, 255, 255, 0.15)",
                    transform: "translateX(4px)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    backdropFilter: "blur(10px)",
                  },
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  "& .MuiListItemIcon-root": {
                    color: "#ffffff",
                    transition: "color 0.3s ease",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: isSelected(item.path) ? 600 : 500,
                    fontSize: "0.9rem",
                    letterSpacing: "-0.01em",
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Box>
    </Box>
  );

  return (
    <MainLayout 
      onMobileMenuToggle={handleDrawerToggle}
      mobileMenuOpen={mobileOpen}
    >
      <Box sx={{ display: "flex", minHeight: `calc(100vh - ${HEADER_HEIGHT}px)` }}>
        {/* Desktop Drawer */}
        {!isMobile && (
          <Drawer
            variant="permanent"
            sx={{
              width: drawerWidth,
              flexShrink: 0,
              [`& .MuiDrawer-paper`]: {
                width: drawerWidth,
                boxSizing: "border-box",
                border: "none",
                boxShadow: "4px 0 24px rgba(0,0,0,0.15)",
                overflow: "hidden",
                top: HEADER_HEIGHT,
                height: `calc(100vh - ${HEADER_HEIGHT}px)`,
              },
            }}
          >
            {drawer}
          </Drawer>
        )}

        {/* Mobile Drawer */}
        {isMobile && (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              [`& .MuiDrawer-paper`]: {
                width: drawerWidth,
                boxSizing: "border-box",
                border: "none",
                boxShadow: "8px 0 32px rgba(0,0,0,0.2)",
                top: 0,
                height: "100vh",
              },
              zIndex: (theme) => theme.zIndex.drawer + 2,
            }}
          >
            {drawer}
          </Drawer>
        )}

        {/* Main Content - Removed top padding */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 0, // Removed all padding
            pt: 0, // Ensure no top padding
            bgcolor: "#F8FAFC",
            minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
            width: { xs: "100%", md: `calc(100% - ${drawerWidth}px)` },
          }}
        >
          {children}
        </Box>
      </Box>
    </MainLayout>
  );
};

export default DashboardLayout;