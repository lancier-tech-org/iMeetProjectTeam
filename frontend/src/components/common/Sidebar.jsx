// Enhanced Sidebar.jsx - WHITE/GREY THEME VERSION
import React, { useState } from "react";
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Box,
  Collapse,
  IconButton,
  Badge,
  Tooltip,
  useTheme,
  useMediaQuery,
  Avatar,
} from "@mui/material";
import {
  Dashboard,
  VideoCall,
  Schedule,
  CalendarMonth,
  VideoLibrary,
  Analytics,
  Settings,
  Person,
  ExpandLess,
  ExpandMore,
  Add,
  ChevronLeft,
  ChevronRight,
  AccessTime,
  Event,
  PlayCircle,
  Notifications,
} from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";

const Sidebar = ({ open, onClose, variant = "temporary" }) => {
  const [meetingSubmenuOpen, setMeetingSubmenuOpen] = useState(false);
  const [recordingsSubmenuOpen, setRecordingsSubmenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // FIXED: Recordings item with explicit submenu structure
  const recordingsMenuItem = {
    text: "Recordings",
    icon: <VideoLibrary />,
    path: "/recordings",
    badge: 5,
    hasSubmenu: true, // CRITICAL
    submenu: [
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
  };

  const mainMenuItems = [
    {
      text: "Dashboard",
      icon: <Dashboard />,
      path: "/dashboard",
      badge: null,
      hasSubmenu: false,
    },
    {
      text: "New Meeting",
      icon: <VideoCall />,
      path: "/meeting/new",
      badge: null,
      hasSubmenu: true,
      submenu: [
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
      badge: 3,
      hasSubmenu: false,
    },
    {
      text: "Calendar",
      icon: <CalendarMonth />,
      path: "/calendar",
      badge: null,
      hasSubmenu: false,
    },
    recordingsMenuItem, // Using the explicitly defined object
    {
      text: "Analytics",
      icon: <Analytics />,
      path: "/analytics",
      badge: null,
      hasSubmenu: false,
    },
  ];

  const bottomMenuItems = [
    { text: "Profile", icon: <Person />, path: "/profile" },
    { text: "Settings", icon: <Settings />, path: "/settings" },
  ];

  const handleItemClick = (item) => {
    console.log("🔘 CLICKED:", item.text);
    console.log("🔘 hasSubmenu:", item.hasSubmenu);
    console.log("🔘 submenu array:", item.submenu);
    
    if (item.hasSubmenu === true) {
      if (item.text === "New Meeting") {
        console.log("🔘 Toggling New Meeting submenu");
        setMeetingSubmenuOpen(!meetingSubmenuOpen);
      } else if (item.text === "Recordings") {
        console.log("🔘 Toggling Recordings submenu");
        setRecordingsSubmenuOpen(!recordingsSubmenuOpen);
      }
    } else {
      console.log("🔘 Navigating to:", item.path);
      navigate(item.path);
      if (isMobile && onClose) {
        onClose();
      }
    }
  };

  const handleSubmenuClick = (item) => {
    console.log("🔘 Submenu clicked:", item.text, "->", item.path);
    navigate(item.path);
    if (isMobile && onClose) {
      onClose();
    }
    setMeetingSubmenuOpen(false);
    setRecordingsSubmenuOpen(false);
  };

  const isSelected = (path) => location.pathname === path;

  const drawerWidth = collapsed ? 80 : 280;

  const drawerContent = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#FFFFFF",
        position: "relative",
        overflow: "hidden",
        borderRight: "1px solid #E5E7EB",
      }}
    >
      {/* Logo Section */}
      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          borderBottom: "1px solid #E5E7EB",
          minHeight: 64,
        }}
      >
        {!collapsed && (
          <>
            <Box
              component="img"
              src="/logo.png"
              alt="iMeetPro"
              sx={{
                width: 32,
                height: 32,
                mr: 1.5,
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: '1.25rem',
              }}
            >
              iMeetPro
            </Typography>
          </>
        )}
        {collapsed && (
          <VideoCall sx={{ color: '#4F46E5', fontSize: 28 }} />
        )}
      </Box>

      {/* Main Menu */}
      <List
        sx={{
          flexGrow: 1,
          px: collapsed ? 1.5 : 2,
          py: 1,
          position: "relative",
          zIndex: 1,
        }}
      >
        {mainMenuItems.map((item, index) => {
          // Debug log for each item
          if (item.text === "Recordings") {
            console.log("🔍 Rendering Recordings item:", {
              hasSubmenu: item.hasSubmenu,
              submenuLength: item.submenu?.length,
            });
          }

          return (
            <Box key={item.text}>
              <Tooltip title={collapsed ? item.text : ""} placement="right">
                <ListItem
                  button
                  onClick={() => handleItemClick(item)}
                  selected={isSelected(item.path)}
                  sx={{
                    borderRadius: "12px",
                    mb: 0.5,
                    minHeight: 48,
                    justifyContent: collapsed ? "center" : "flex-start",
                    px: collapsed ? 1 : 2,
                    bgcolor: isSelected(item.path)
                      ? "rgba(79, 70, 229, 0.08)"
                      : "transparent",
                    color: isSelected(item.path) ? "#4F46E5" : "#374151",
                    border: isSelected(item.path)
                      ? "1px solid rgba(79, 70, 229, 0.2)"
                      : "1px solid transparent",
                    "&:hover": {
                      bgcolor: "rgba(107, 114, 128, 0.08)",
                      transform: "translateX(4px)",
                    },
                    transition: "all 0.2s ease-in-out",
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: isSelected(item.path) ? "#4F46E5" : "#6B7280",
                      minWidth: collapsed ? "auto" : 40,
                      justifyContent: "center",
                    }}
                  >
                    {item.badge && !collapsed && !item.hasSubmenu ? (
                      <Badge
                        badgeContent={item.badge}
                        sx={{
                          "& .MuiBadge-badge": {
                            bgcolor: "#EF4444",
                            color: "white",
                            fontSize: "0.7rem",
                            minWidth: "18px",
                            height: "18px",
                          },
                        }}
                      >
                        {item.icon}
                      </Badge>
                    ) : (
                      item.icon
                    )}
                  </ListItemIcon>

                  {!collapsed && (
                    <>
                      <ListItemText
                        primary={item.text}
                        primaryTypographyProps={{
                          fontWeight: isSelected(item.path) ? 600 : 500,
                          fontSize: "0.9rem",
                          color: isSelected(item.path) ? "#4F46E5" : "#374151",
                        }}
                      />
                      
                      {/* Show badge only if no submenu */}
                      {item.badge && !item.hasSubmenu && (
                        <Badge
                          badgeContent={item.badge}
                          sx={{
                            "& .MuiBadge-badge": {
                              bgcolor: "#EF4444",
                              color: "white",
                              fontSize: "0.7rem",
                              minWidth: "18px",
                              height: "18px",
                            },
                          }}
                        />
                      )}
                      
                      {/* CRITICAL: Show dropdown arrow if hasSubmenu is true */}
                      {item.hasSubmenu === true && (
                        <Box
                          sx={{
                            bgcolor: "rgba(107, 114, 128, 0.1)",
                            borderRadius: "6px",
                            p: 0.5,
                            ml: 1,
                            display: "flex",
                            alignItems: "center",
                            color: "#6B7280",
                          }}
                        >
                          {(item.text === "New Meeting" && meetingSubmenuOpen) ||
                          (item.text === "Recordings" && recordingsSubmenuOpen) ? (
                            <ExpandLess fontSize="small" />
                          ) : (
                            <ExpandMore fontSize="small" />
                          )}
                        </Box>
                      )}
                    </>
                  )}
                </ListItem>
              </Tooltip>

              {/* Submenu - CRITICAL: Check hasSubmenu === true */}
              {item.hasSubmenu === true && !collapsed && item.submenu && (
                <Collapse
                  in={
                    item.text === "New Meeting"
                      ? meetingSubmenuOpen
                      : item.text === "Recordings"
                      ? recordingsSubmenuOpen
                      : false
                  }
                  timeout="auto"
                  unmountOnExit
                >
                  <List component="div" disablePadding sx={{ ml: 2 }}>
                    {item.submenu.map((subItem) => (
                      <Tooltip
                        key={subItem.text}
                        title={collapsed ? subItem.text : ""}
                        placement="right"
                      >
                        <ListItem
                          button
                          onClick={() => handleSubmenuClick(subItem)}
                          selected={isSelected(subItem.path)}
                          sx={{
                            pl: 3,
                            borderRadius: "10px",
                            mb: 0.5,
                            minHeight: 40,
                            bgcolor: isSelected(subItem.path)
                              ? "rgba(79, 70, 229, 0.08)"
                              : "transparent",
                            color: isSelected(subItem.path) ? "#4F46E5" : "#6B7280",
                            border: "1px solid transparent",
                            "&:hover": {
                              bgcolor: "rgba(107, 114, 128, 0.08)",
                              transform: "translateX(4px)",
                            },
                            transition: "all 0.2s ease-in-out",
                          }}
                        >
                          <ListItemIcon
                            sx={{
                              minWidth: 32,
                              color: isSelected(subItem.path) ? "#4F46E5" : "#9CA3AF",
                              "& svg": { fontSize: "1.1rem" },
                            }}
                          >
                            {subItem.icon}
                          </ListItemIcon>
                          <ListItemText
                            primary={subItem.text}
                            primaryTypographyProps={{
                              fontSize: "0.85rem",
                              fontWeight: isSelected(subItem.path) ? 500 : 400,
                              color: isSelected(subItem.path) ? "#4F46E5" : "#6B7280",
                            }}
                          />
                        </ListItem>
                      </Tooltip>
                    ))}
                  </List>
                </Collapse>
              )}
            </Box>
          );
        })}
      </List>

      {/* Divider */}
      <Box
        sx={{
          mx: collapsed ? 1.5 : 2,
          height: "1px",
          background: "#E5E7EB",
          my: 1,
        }}
      />

      {/* Bottom Menu */}
      <List
        sx={{
          px: collapsed ? 1.5 : 2,
          py: 1,
          position: "relative",
          zIndex: 1,
        }}
      >
        {bottomMenuItems.map((item) => (
          <Tooltip
            key={item.text}
            title={collapsed ? item.text : ""}
            placement="right"
          >
            <ListItem
              button
              onClick={() => {
                navigate(item.path);
                if (isMobile && onClose) onClose();
              }}
              selected={isSelected(item.path)}
              sx={{
                borderRadius: "12px",
                mb: 0.5,
                minHeight: 48,
                justifyContent: collapsed ? "center" : "flex-start",
                px: collapsed ? 1 : 2,
                color: isSelected(item.path) ? "#4F46E5" : "#374151",
                bgcolor: isSelected(item.path)
                  ? "rgba(79, 70, 229, 0.08)"
                  : "transparent",
                border: isSelected(item.path)
                  ? "1px solid rgba(79, 70, 229, 0.2)"
                  : "1px solid transparent",
                "&:hover": {
                  bgcolor: "rgba(107, 114, 128, 0.08)",
                  transform: "translateX(4px)",
                },
                transition: "all 0.2s ease-in-out",
              }}
            >
              <ListItemIcon
                sx={{
                  color: isSelected(item.path) ? "#4F46E5" : "#6B7280",
                  minWidth: collapsed ? "auto" : 40,
                  justifyContent: "center",
                }}
              >
                {item.icon}
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: isSelected(item.path) ? 600 : 500,
                    fontSize: "0.9rem",
                    color: isSelected(item.path) ? "#4F46E5" : "#374151",
                  }}
                />
              )}
            </ListItem>
          </Tooltip>
        ))}
      </List>
    </Box>
  );

  if (variant === "permanent") {
    return (
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            border: "none",
            boxShadow: "1px 0 3px rgba(0,0,0,0.05)",
            transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            overflow: "hidden",
          },
        }}
      >
        {drawerContent}
      </Drawer>
    );
  }

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      variant={variant}
      ModalProps={{ keepMounted: true }}
      sx={{
        [`& .MuiDrawer-paper`]: {
          width: 280,
          boxSizing: "border-box",
          border: "none",
          boxShadow: "4px 0 16px rgba(0,0,0,0.08)",
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

export default Sidebar;