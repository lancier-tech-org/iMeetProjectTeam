import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  Stack,
  Avatar,
  Divider,
  useTheme,
  alpha,
  Paper,
  IconButton,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
  InputAdornment,
  OutlinedInput,
  Breadcrumbs,
  Link,
  Tooltip,
  Badge,
  LinearProgress,
  CardHeader,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Menu,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  Person as PersonIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  PhotoCamera as CameraIcon,
  Security as SecurityIcon,
  Notifications as NotificationIcon,
  Language as LanguageIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  Home as HomeIcon,
  NavigateNext as NavigateNextIcon,
  VerifiedUser as VerifiedIcon,
  Star as StarIcon,
  Settings as SettingsIcon,
  Visibility as VisibilityIcon,
  VolumeUp as AudioIcon,
  Videocam as VideoIcon,
  Shield as ShieldIcon,
  AccountCircle as AccountIcon,
  CloudUpload as UploadIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  ZoomIn as ZoomInIcon,
} from "@mui/icons-material";
import DashboardLayout from "../layouts/DashboardLayout";
import ImageUpload from "../components/common/ImageUpload";
import { useAuth } from "../hooks/useAuth";

// ✅ API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.lancieretech.com';

const ProfilePage = () => {
  const navigate = useNavigate();
  
  // —— Canonical normalizers ——
  const asArray = (v, fb = []) =>
    Array.isArray(v)
      ? v
      : v == null || v === ""
      ? fb
      : typeof v === "string"
      ? v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [v];

  const asBool = (v, fb = false) => (typeof v === "boolean" ? v : fb);

  const mapUserToForm = (u) => ({
    id: u?.id ?? u?.Id ?? u?.user_id ?? u?.ID ?? null,
    full_name: u?.full_name ?? u?.name ?? "",
    email: u?.email ?? "",
    phone_number: u?.phone_number ?? u?.phone ?? "",
    address: u?.address ?? "",
    country: u?.country ?? "",
    languages: asArray(u?.languages, ["English"]),
    // ✅ Photo fields with photo_code logic
    profile_picture: u?.profile_picture ?? u?.profile_photo ?? "",
    profile_photo_id: u?.profile_photo_id ?? null,  // Registration photo (PERMANENT)
    edited_photo_id: u?.edited_photo_id ?? null,    // Edited photo
    photo_code: u?.photo_code ?? 0,                 // 0 = registration, 1 = edited
    face_embedding_id: u?.face_embedding_id ?? null,
  
    email_notifications: asBool(u?.email_notifications, true),
    meeting_reminders: asBool(u?.meeting_reminders, true),
    recording_notifications: asBool(u?.recording_notifications, true),
    show_email: asBool(u?.show_email, true),
    show_phone: asBool(u?.show_phone, false),
    auto_join_audio: asBool(u?.auto_join_audio, true),
    auto_join_video: asBool(u?.auto_join_video, false),
  });

  const theme = useTheme();
  const { user, updateProfile } = useAuth();
  console.log("DEBUG ProfilePage user object:", user);
  
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState(() => mapUserToForm(user));
  const [originalData, setOriginalData] = useState(() => mapUserToForm(user));
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [initialPhotoLoaded, setInitialPhotoLoaded] = useState(false);
  // ✅ NEW: State for profile picture menu and dialogs
  const [anchorEl, setAnchorEl] = useState(null);
  const [viewProfileDialogOpen, setViewProfileDialogOpen] = useState(false);
  const [editPhotoDialogOpen, setEditPhotoDialogOpen] = useState(false);
  const menuOpen = Boolean(anchorEl);

  // Countries list
  const countries = [
    "United States",
    "Canada",
    "United Kingdom",
    "Germany",
    "France",
    "India",
    "Japan",
    "Australia",
    "Brazil",
    "Mexico",
    "China",
    "South Korea",
    "Italy",
    "Spain",
    "Netherlands",
    "Sweden",
    "Norway",
    "Denmark",
    "Switzerland",
  ];

  // Languages list
  const languages = [
    "English",
    "Spanish",
    "French",
    "German",
    "Italian",
    "Portuguese",
    "Chinese",
    "Japanese",
    "Korean",
    "Hindi",
    "Arabic",
    "Russian",
  ];

  const normalizeLanguages = (languageData) => asArray(languageData);

  console.log("formdata", formData);
// ✅ FIXED: Only sync non-photo fields from user context
// ✅ FIXED: Sync with user context but ALWAYS prefer localStorage for photo data
useEffect(() => {
  if (!user) return;
  
  // ✅ Always read photo data from localStorage (source of truth)
  let photoDataFromStorage = {
    profile_picture: '',
    profile_photo_id: null,
    edited_photo_id: null,
    photo_code: 0,
    face_embedding_id: null,
  };
  
  try {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    photoDataFromStorage = {
      profile_picture: storedUser.profile_picture || storedUser.profile_photo || '',
      profile_photo_id: storedUser.profile_photo_id ?? null,
      edited_photo_id: storedUser.edited_photo_id ?? null,
      photo_code: storedUser.photo_code ?? 0,
      face_embedding_id: storedUser.face_embedding_id ?? null,
    };
    console.log('📸 Photo data from localStorage:', {
      photo_code: photoDataFromStorage.photo_code,
      has_picture: !!photoDataFromStorage.profile_picture,
      picture_preview: photoDataFromStorage.profile_picture?.substring(0, 50)
    });
  } catch (e) {
    console.warn('Could not read photo from localStorage:', e);
  }
  
  // Map non-photo fields from user context
  const mapped = mapUserToForm(user);
  
  // ✅ Override photo fields with localStorage data (localStorage is always up-to-date)
  const finalData = {
    ...mapped,
    profile_picture: photoDataFromStorage.profile_picture || mapped.profile_picture,
    profile_photo_id: photoDataFromStorage.profile_photo_id ?? mapped.profile_photo_id,
    edited_photo_id: photoDataFromStorage.edited_photo_id ?? mapped.edited_photo_id,
    photo_code: photoDataFromStorage.photo_code ?? mapped.photo_code,
    face_embedding_id: photoDataFromStorage.face_embedding_id ?? mapped.face_embedding_id,
  };
  
  console.log('📸 Final data after localStorage merge:', {
    photo_code: finalData.photo_code,
    has_picture: !!finalData.profile_picture
  });
  
  setFormData(finalData);
  setOriginalData(finalData);
}, [user]);
// ✅ FETCH PHOTO FROM BACKEND ONLY IF MISSING
useEffect(() => {
  const fetchPhotoIfMissing = async () => {
    // Skip if already loaded or if we have a photo
    if (initialPhotoLoaded || formData.profile_picture) {
      return;
    }
    
    // Check if we have photo IDs to fetch
    const hasPhotoIds = formData.profile_photo_id || formData.edited_photo_id;
    if (!hasPhotoIds) {
      setInitialPhotoLoaded(true);
      return;
    }
    
    const userId = formData.id ?? user?.id ?? user?.Id ?? user?.ID;
    if (!userId) {
      setInitialPhotoLoaded(true);
      return;
    }
    
    try {
      console.log('📸 Fetching photo from backend for user:', userId);
      const photoResponse = await fetch(
        `${API_BASE_URL}/api/user-active-photo/${userId}/?base64=false`
      );
      
      if (photoResponse.ok) {
        const photoData = await photoResponse.json();
        const photoUrl = photoData.s3_url || '';
        const photoCode = photoData.photo_code ?? 0;
        
        if (photoUrl) {
          console.log('📸 Fetched photo from backend:', {
            url: photoUrl?.substring(0, 50),
            photo_code: photoCode
          });
          
          // Update state
          setFormData(prev => ({
            ...prev,
            profile_picture: photoUrl,
            photo_code: photoCode,
          }));
          setOriginalData(prev => ({
            ...prev,
            profile_picture: photoUrl,
            photo_code: photoCode,
          }));
          
          // Update localStorage
          const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
          const updatedUser = {
            ...storedUser,
            profile_picture: photoUrl,
            photo_code: photoCode,
          };
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
      }
    } catch (err) {
      console.warn('Could not fetch profile photo:', err);
    }
    
    setInitialPhotoLoaded(true);
  };
  
  fetchPhotoIfMissing();
}, [initialPhotoLoaded, formData.profile_picture, formData.profile_photo_id, formData.edited_photo_id, formData.id, user?.id]);
  // ✅ FETCH REAL PROFILE PHOTO FROM BACKEND (AWS S3 OR BASE64)
 
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLanguageChange = (event) => {
    setFormData((prev) => ({
      ...prev,
      languages: asArray(event.target.value),
    }));
  };

  // ✅ NEW: Handle avatar click - open menu instead of file picker
  const handleAvatarClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  // ✅ NEW: Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // ✅ NEW: Handle View Profile Photo
  const handleViewProfile = () => {
    handleMenuClose();
    setViewProfileDialogOpen(true);
  };

  // ✅ NEW: Handle Edit Profile Photo - opens dialog with ImageUpload
  const handleEditProfilePhoto = () => {
    handleMenuClose();
    setEditPhotoDialogOpen(true);
  };

  // ✅ NEW: Handle Remove Photo (only for edited photos)
  const handleRemovePhotoClick = () => {
    handleMenuClose();
    // Only allow removal if using edited photo (photo_code === 1)
    if (formData.photo_code !== 1) {
      setSnackbar({
        open: true,
        message: "Registration photo cannot be removed.",
        severity: "info",
      });
      return;
    }
    // Call the existing handler with null to trigger removal
    handleProfilePictureChange(null);
  };

  // ✅ Get user initials for avatar fallback
  const getUserInitials = () => {
    const name = formData.full_name || "User";
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // ✅ ORIGINAL: Handle profile picture change using dedicated photo endpoint
  // (This function is UNCHANGED from your original code)
  const handleProfilePictureChange = async (imageData) => {
    console.log('📸 Profile picture changed:', {
      hasData: !!imageData,
      dataLength: imageData?.length,
      currentPhotoCode: formData.photo_code
    });
    
    // Close the edit dialog if open
    setEditPhotoDialogOpen(false);
    
    if (imageData) {
      // ========================================
      // UPLOAD NEW EDITED PHOTO
      // ========================================
      handleInputChange("profile_picture", imageData);
      
      setLoading(true);
      try {
        const userId = formData.id ?? user?.id ?? user?.Id ?? user?.ID;
        
        if (!userId) {
          throw new Error('User ID not found');
        }
        
        console.log('💾 Calling photo update endpoint for user:', userId);
        
        // ✅ Use the update-photo endpoint
        const response = await fetch(`${API_BASE_URL}/api/update-photo/${userId}/`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            profile_photo: imageData
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.Error || 'Failed to update photo');
        }

        const data = await response.json();
        
        console.log('✅ Photo update response:', data);
        
        // ✅ Backend returns: { Edited_Photo_Id, Photo_URL, Photo_Code: 1 }
        const photoUrl = data.Photo_URL || data.s3_url || imageData;
        const editedPhotoId = data.Edited_Photo_Id || data.edited_photo_id;
        const newPhotoCode = data.Photo_Code ?? 1;
        
        // Update formData with new photo info
        setFormData(prev => ({ 
          ...prev, 
          profile_picture: photoUrl,
          edited_photo_id: editedPhotoId,
          photo_code: newPhotoCode
        }));
        setOriginalData(prev => ({ 
          ...prev, 
          profile_picture: photoUrl,
          edited_photo_id: editedPhotoId,
          photo_code: newPhotoCode
        }));
        
        // ✅ Update user in localStorage with new photo info
        const updatedUser = {
          ...user,
          profile_picture: photoUrl,
          profile_photo: photoUrl,
          edited_photo_id: editedPhotoId,
          photo_code: newPhotoCode,
          // Keep registration photo unchanged
          profile_photo_id: user?.profile_photo_id || formData.profile_photo_id,
          face_embedding_id: user?.face_embedding_id || formData.face_embedding_id,
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // Dispatch events to notify other components
        window.dispatchEvent(new CustomEvent('userUpdated', {
          detail: { user: updatedUser }
        }));
        
        window.dispatchEvent(new CustomEvent('profilePictureUpdated', {
          detail: { 
            profile_picture: photoUrl,
            photo_code: newPhotoCode,
            user: updatedUser
          }
        }));
        
        setSnackbar({
          open: true,
          message: "Profile picture updated successfully!",
          severity: "success",
        });
        
        console.log('✅ Profile picture saved, photo_code:', newPhotoCode);
        
      } catch (error) {
        console.error("❌ Profile picture save error:", error);
        setSnackbar({
          open: true,
          message: error.message || "Failed to update profile picture. Please try again.",
          severity: "error",
        });
        // Revert to original on error
        handleInputChange("profile_picture", originalData.profile_picture);
      } finally {
        setLoading(false);
      }
    } else {
      // ========================================
      // DELETE EDITED PHOTO - REVERT TO REGISTRATION PHOTO
      // ========================================
      setLoading(true);
      try {
        const userId = formData.id ?? user?.id ?? user?.Id ?? user?.ID;
        
        console.log('🗑️ Deleting edited photo, reverting to registration photo...');
        
        // ✅ Call delete photo endpoint
        const response = await fetch(`${API_BASE_URL}/api/delete-photo/${userId}/`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.Error || 'Failed to remove photo');
        }
        
        const data = await response.json();
        console.log('✅ Delete response:', data);
        
        // ✅ FIXED: Always fetch the active photo after deletion
        // The API will return registration photo since photo_code is now 0
        let registrationPhotoUrl = '';
        let registrationPhotoId = data.Registration_Photo_Id || data.registration_photo_id || data.Active_Photo_Id || formData.profile_photo_id;
        
        // ✅ ALWAYS try to fetch the photo - don't check registrationPhotoId first
        try {
          console.log('📸 Fetching registration photo for user:', userId);
          const photoResponse = await fetch(
            `${API_BASE_URL}/api/user-active-photo/${userId}/?base64=false`
          );
          
          if (photoResponse.ok) {
            const photoData = await photoResponse.json();
            registrationPhotoUrl = photoData.s3_url || photoData.photo || '';
            registrationPhotoId = photoData.registration_photo_id || photoData.active_photo_id || registrationPhotoId;
            console.log('✅ Fetched registration photo:', {
              url: registrationPhotoUrl?.substring(0, 80),
              photo_code: photoData.photo_code
            });
          } else {
            console.warn('⚠️ Photo response not OK:', photoResponse.status);
          }
        } catch (photoErr) {
          console.warn('⚠️ Could not fetch registration photo:', photoErr);
        }
        
        // ✅ FIXED: If still no URL, try the direct photo endpoint as fallback
        if (!registrationPhotoUrl) {
          try {
            console.log('📸 Trying fallback photo endpoint...');
            const fallbackResponse = await fetch(
              `${API_BASE_URL}/api/user-photo/${userId}/?base64=false`
            );
            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              registrationPhotoUrl = fallbackData.s3_url || fallbackData.photo || '';
              console.log('✅ Fallback photo fetched:', registrationPhotoUrl?.substring(0, 80));
            }
          } catch (fallbackErr) {
            console.warn('⚠️ Fallback also failed:', fallbackErr);
          }
        }

        console.log('📸 Final registration photo URL:', registrationPhotoUrl?.substring(0, 80) || 'EMPTY');
        
        // ✅ Update state with registration photo
        setFormData(prev => ({ 
          ...prev, 
          profile_picture: registrationPhotoUrl,
          edited_photo_id: null,
          photo_code: 0,
          profile_photo_id: registrationPhotoId || prev.profile_photo_id
        }));
        setOriginalData(prev => ({ 
          ...prev, 
          profile_picture: registrationPhotoUrl,
          edited_photo_id: null,
          photo_code: 0,
          profile_photo_id: registrationPhotoId || prev.profile_photo_id
        }));
        
        // ✅ Update localStorage - revert to registration photo
        const updatedUser = { 
          ...user, 
          profile_picture: registrationPhotoUrl, 
          profile_photo: registrationPhotoUrl,
          edited_photo_id: null,
          photo_code: 0,
          profile_photo_id: registrationPhotoId || user?.profile_photo_id || formData.profile_photo_id,
          face_embedding_id: user?.face_embedding_id || formData.face_embedding_id,
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // ✅ Dispatch events
        window.dispatchEvent(new CustomEvent('userUpdated', {
          detail: { user: updatedUser }
        }));
        
        window.dispatchEvent(new CustomEvent('profilePictureUpdated', {
          detail: { 
            profile_picture: registrationPhotoUrl, 
            photo_code: 0,
            user: updatedUser 
          }
        }));
        
        setSnackbar({
          open: true,
          message: "Edited photo removed. Now showing registration photo.",
          severity: "success",
        });
        
        console.log('✅ Reverted to registration photo, photo_code: 0');
        
      } catch (error) {
        console.error("❌ Profile picture removal error:", error);
        setSnackbar({
          open: true,
          message: error.message || "Failed to remove profile picture.",
          severity: "error",
        });
      } finally {
        setLoading(false);
      }
    }
  };

  // ✅ ORIGINAL: handleSave function (UNCHANGED)
 const handleSave = async () => {
  setLoading(true);
  try {
    // ✅ Validate required fields before sending
    if (!formData.full_name || formData.full_name.trim() === "") {
      setSnackbar({
        open: true,
        message: "Full name is required",
        severity: "error",
      });
      setLoading(false);
      return;
    }

    // ✅ Prepare clean update payload
    const userId = formData.id ?? user?.id ?? user?.Id ?? user?.ID;
    
    const updatePayload = {
      full_name: formData.full_name.trim(),
      email: formData.email || user?.email || "",
      phone_number: formData.phone_number || "",
      address: formData.address || "",
      country: formData.country || "",
      languages: Array.isArray(formData.languages) 
        ? formData.languages 
        : formData.languages ? [formData.languages] : ["English"],
      email_notifications: formData.email_notifications ?? true,
      meeting_reminders: formData.meeting_reminders ?? true,
      recording_notifications: formData.recording_notifications ?? true,
      show_email: formData.show_email ?? true,
      show_phone: formData.show_phone ?? false,
      auto_join_audio: formData.auto_join_audio ?? true,
      auto_join_video: formData.auto_join_video ?? false,
      
      // ✅ CRITICAL FIX: Include photo fields to preserve them during profile update
      profile_picture: formData.profile_picture,
      profile_photo_id: formData.profile_photo_id,
      edited_photo_id: formData.edited_photo_id,
      photo_code: formData.photo_code,
      face_embedding_id: formData.face_embedding_id,
    };

    console.log('💾 Saving profile with payload:', updatePayload);
    console.log('📸 Photo fields in payload:', {
      profile_picture: updatePayload.profile_picture?.substring(0, 50),
      photo_code: updatePayload.photo_code,
      edited_photo_id: updatePayload.edited_photo_id
    });

    await updateProfile(updatePayload);

    setOriginalData(formData);
    setEditing(false);
    setSnackbar({
      open: true,
      message: "Profile updated successfully!",
      severity: "success",
    });
  } catch (error) {
    console.error("Profile update error:", error);
    setSnackbar({
      open: true,
      message: error.message || "Failed to update profile. Please try again.",
      severity: "error",
    });
  } finally {
    setLoading(false);
  }
};

  // ✅ ORIGINAL: handleCancel function (UNCHANGED)
  const handleCancel = () => {
    setFormData(originalData);
    setEditing(false);
  };

  // ✅ ORIGINAL: renderLanguageChips function (UNCHANGED)
  const renderLanguageChips = () => {
    const languageArray = normalizeLanguages(formData.languages);

    if (languageArray.length === 0) {
      return (
        <Chip
          label="No languages set"
          size="small"
          variant="outlined"
          sx={{ opacity: 0.6 }}
        />
      );
    }

    return languageArray.map((lang, index) => (
      <Chip
        key={`${lang}-${index}`}
        label={lang}
        size="small"
        color="primary"
        variant="outlined"
        sx={{
          borderRadius: 1.5,
          fontWeight: 500,
          fontSize: '0.75rem',
        }}
      />
    ));
  };

  return (
    <DashboardLayout>
      <Box
        sx={{
          flexGrow: 1,
          backgroundColor: '#fafafa',
          minHeight: "100vh",
          pt: 2,
        }}
      >
        <Container maxWidth="xl" sx={{ py: 4 }}>
          {/* Professional Header with Breadcrumbs */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 4,
              backgroundColor: 'white',
              borderRadius: 2,
              border: '1px solid',
              borderColor: theme.palette.divider,
            }}
          >
            <Stack spacing={3}>
              <Breadcrumbs
                separator={<NavigateNextIcon fontSize="small" />}
                sx={{ color: 'text.secondary' }}
              >
                <Link
                  component="button"
                  variant="body2"
                  underline="hover"
                  color="inherit"
                  onClick={() => {
                    navigate('/dashboard');
                  }}
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 0.5,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    '&:hover': {
                      color: theme.palette.primary.main,
                    }
                  }}
                >
                  <HomeIcon fontSize="small" />
                  Dashboard
                </Link>
                <Typography
                  variant="body2"
                  color="text.primary"
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 0.5, 
                    fontWeight: 600,
                    color: theme.palette.primary.main,
                  }}
                >
                  <PersonIcon fontSize="small" />
                  Profile
                </Typography>
              </Breadcrumbs>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
                spacing={3}
              >
                <Box>
                  <Typography 
                    variant="h4" 
                    fontWeight={700} 
                    color="text.primary"
                    sx={{ mb: 1 }}
                  >
                    Profile Management
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Manage your personal information, preferences, and account settings
                  </Typography>
                </Box>

                {!editing ? (
                  <Button
                    variant="contained"
                    startIcon={<EditIcon />}
                    onClick={() => setEditing(true)}
                    size="large"
                    sx={{
                      borderRadius: 2,
                      textTransform: "none",
                      px: 4,
                      py: 1.5,
                      fontWeight: 600,
                      boxShadow: theme.shadows[3],
                      '&:hover': {
                        boxShadow: theme.shadows[6],
                      }
                    }}
                  >
                    Edit Profile
                  </Button>
                ) : (
                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="outlined"
                      startIcon={<CancelIcon />}
                      onClick={handleCancel}
                      size="large"
                      sx={{ 
                        textTransform: "none",
                        borderRadius: 2,
                        px: 3,
                        fontWeight: 600,
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={handleSave}
                      disabled={loading}
                      size="large"
                      sx={{ 
                        textTransform: "none",
                        borderRadius: 2,
                        px: 3,
                        fontWeight: 600,
                        boxShadow: theme.shadows[3],
                        '&:hover': {
                          boxShadow: theme.shadows[6],
                        }
                      }}
                    >
                      {loading ? "Saving..." : "Save Changes"}
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Stack>
          </Paper>

          {loading && (
            <LinearProgress 
              sx={{ 
                mb: 2,
                borderRadius: 1,
                height: 4,
              }} 
            />
          )}

          <Grid container spacing={4}>
            {/* Left Column - Profile Card */}
            <Grid item xs={12} lg={4}>
              <Stack spacing={3}>
                {/* Main Profile Card */}
                <Card 
                  elevation={0}
                  sx={{ 
                    border: '1px solid',
                    borderColor: theme.palette.divider,
                    borderRadius: 3,
                  }}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Stack alignItems="center" spacing={3}>
                      {/* ✅ UPDATED: Profile Picture Section with Menu */}
                      <Stack alignItems="center" spacing={2}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            fontSize: '0.75rem',
                            fontWeight: 500,
                          }}
                        >
                          <CameraIcon fontSize="small" />
                          Click photo for options
                        </Typography>

                        {/* ✅ Clickable Avatar - Opens Menu Instead of File Picker */}
                        <Box sx={{ position: 'relative' }}>
                          <Avatar
                            src={formData.profile_picture}
                            alt={formData.full_name || "User"}
                            onClick={handleAvatarClick}
                            sx={{
                              width: 150,
                              height: 150,
                              fontSize: '3rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              bgcolor: theme.palette.primary.main,
                              border: `4px solid ${theme.palette.primary.light}`,
                              transition: 'all 0.3s ease',
                              '&:hover': {
                                transform: 'scale(1.05)',
                                boxShadow: theme.shadows[8],
                                borderColor: theme.palette.primary.main,
                              }
                            }}
                          >
                            {!formData.profile_picture && getUserInitials()}
                          </Avatar>
                          
                          {/* Edit Badge on Avatar */}
                          <Box
                            sx={{
                              position: 'absolute',
                              bottom: 8,
                              right: 8,
                              backgroundColor: theme.palette.primary.main,
                              borderRadius: '50%',
                              width: 36,
                              height: 36,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: `2px solid white`,
                              cursor: 'pointer',
                              boxShadow: theme.shadows[2],
                            }}
                            onClick={handleAvatarClick}
                          >
                            <EditIcon sx={{ color: 'white', fontSize: 18 }} />
                          </Box>
                        </Box>

                        {/* Photo type indicator chip */}
                        <Chip
                          size="small"
                          label={formData.photo_code === 1 ? "Edited Photo" : "Registration Photo"}
                          color={formData.photo_code === 1 ? "primary" : "default"}
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />

                        {/* ✅ NEW: Menu for View/Edit/Remove options */}
                        <Menu
                          anchorEl={anchorEl}
                          open={menuOpen}
                          onClose={handleMenuClose}
                          anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'center',
                          }}
                          transformOrigin={{
                            vertical: 'top',
                            horizontal: 'center',
                          }}
                          PaperProps={{
                            elevation: 8,
                            sx: {
                              mt: 1,
                              minWidth: 220,
                              borderRadius: 2,
                              '& .MuiMenuItem-root': {
                                py: 1.5,
                                px: 2,
                              }
                            }
                          }}
                        >
                          {/* View Profile Photo Option */}
                          <MenuItem onClick={handleViewProfile}>
                            <ListItemIcon>
                              <ZoomInIcon fontSize="small" color="primary" />
                            </ListItemIcon>
                            <ListItemText 
                              primary="View Profile Photo"
                              primaryTypographyProps={{ fontWeight: 500 }}
                            />
                          </MenuItem>
                          
                          {/* Edit/Change Photo Option */}
                          <MenuItem onClick={handleEditProfilePhoto}>
                            <ListItemIcon>
                              <CameraIcon fontSize="small" color="primary" />
                            </ListItemIcon>
                            <ListItemText 
                              primary="Change Photo"
                              primaryTypographyProps={{ fontWeight: 500 }}
                            />
                          </MenuItem>
                          
                          {/* Remove Photo Option - Only for edited photos */}
                          {formData.photo_code === 1 && (
                            <MenuItem onClick={handleRemovePhotoClick}>
                              <ListItemIcon>
                                <DeleteIcon fontSize="small" color="error" />
                              </ListItemIcon>
                              <ListItemText 
                                primary="Remove Edited Photo"
                                secondary="Revert to registration photo"
                                primaryTypographyProps={{ fontWeight: 500, color: 'error.main' }}
                                secondaryTypographyProps={{ fontSize: '0.7rem' }}
                              />
                            </MenuItem>
                          )}
                        </Menu>
                      </Stack>

                      <Stack alignItems="center" spacing={1}>
                        <Typography variant="h5" fontWeight={700} textAlign="center">
                          {formData.full_name || "Your Name"}
                        </Typography>
                        <Typography variant="body1" color="text.secondary" textAlign="center">
                          {formData.email}
                        </Typography>
                        {formData.country && (
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <LocationIcon fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary">
                              {formData.country}
                            </Typography>
                          </Stack>
                        )}
                      </Stack>

                      <Divider sx={{ width: '100%' }} />

                      <Box sx={{ width: '100%' }}>
                        <Typography variant="subtitle2" fontWeight={600} mb={2} color="text.secondary">
                          LANGUAGES
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                          {renderLanguageChips()}
                        </Stack>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>

                {/* Account Status Card - UNCHANGED */}
                <Card 
                  elevation={0}
                  sx={{ 
                    border: '1px solid',
                    borderColor: theme.palette.divider,
                    borderRadius: 3,
                  }}
                >
                  <CardHeader
                    title="Account Overview"
                    titleTypographyProps={{ 
                      variant: 'h6', 
                      fontWeight: 600,
                      color: 'text.primary'
                    }}
                    avatar={
                      <AccountIcon color="primary" />
                    }
                  />
                  <CardContent sx={{ pt: 0 }}>
                    <List disablePadding>
                      <ListItem disableGutters>
                        <ListItemIcon>
                          <StarIcon color="primary" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Account Type"
                          primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                        />
                        <ListItemSecondaryAction>
                          <Chip 
                            label="Premium" 
                            color="primary" 
                            size="small"
                            sx={{ fontWeight: 600 }}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                      
                      <ListItem disableGutters>
                        <ListItemIcon>
                          <VerifiedIcon color="success" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Verification Status"
                          primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                        />
                        <ListItemSecondaryAction>
                          <Chip 
                            label="Verified" 
                            color="success" 
                            size="small"
                            sx={{ fontWeight: 600 }}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>

                      <ListItem disableGutters>
                        <ListItemIcon>
                          <PersonIcon color="action" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Member Since"
                          primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                        />
                        <ListItemSecondaryAction>
                          <Typography variant="body2" fontWeight={600}>
                            {user?.created_at
                              ? new Date(user.created_at).getFullYear()
                              : "2024"}
                          </Typography>
                        </ListItemSecondaryAction>
                      </ListItem>

                      <ListItem disableGutters>
                        <ListItemIcon>
                          <ShieldIcon 
                            color={user?.is_active !== false ? "success" : "error"} 
                            fontSize="small" 
                          />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Account Status"
                          primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                        />
                        <ListItemSecondaryAction>
                          <Chip
                            label={user?.is_active !== false ? "Active" : "Inactive"}
                            color={user?.is_active !== false ? "success" : "error"}
                            size="small"
                            sx={{ fontWeight: 600 }}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Stack>
            </Grid>

            {/* Right Column - Form Cards - ALL UNCHANGED */}
            <Grid item xs={12} lg={8}>
              <Stack spacing={4}>
                {/* Personal Information */}
                <Card 
                  elevation={0}
                  sx={{ 
                    border: '1px solid',
                    borderColor: theme.palette.divider,
                    borderRadius: 3,
                  }}
                >
                  <CardHeader
                    title="Personal Information"
                    subheader="Update your personal details and contact information"
                    titleTypographyProps={{ 
                      variant: 'h6', 
                      fontWeight: 600 
                    }}
                    subheaderTypographyProps={{ 
                      variant: 'body2',
                      color: 'text.secondary'
                    }}
                    avatar={
                      <PersonIcon color="primary" />
                    }
                  />
                  <CardContent>
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Full Name"
                          value={formData.full_name}
                          onChange={(e) => handleInputChange("full_name", e.target.value)}
                          disabled={!editing}
                          variant="outlined"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                            }
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Email Address"
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange("email", e.target.value)}
                          disabled={!editing}
                          variant="outlined"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <EmailIcon sx={{ color: "text.secondary" }} />
                              </InputAdornment>
                            ),
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                            }
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Phone Number"
                          value={formData.phone_number}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                            handleInputChange("phone_number", v);
                          }}
                          disabled={!editing}
                          variant="outlined"
                          inputProps={{
                            maxLength: 10,
                            inputMode: "numeric",
                            pattern: "[0-9]*",
                          }}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <PhoneIcon sx={{ color: "text.secondary" }} />
                              </InputAdornment>
                            ),
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                            }
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth disabled={!editing}>
                          <InputLabel>Country</InputLabel>
                          <Select
                            label="Country"
                            value={formData.country}
                            onChange={(e) => handleInputChange("country", e.target.value)}
                            input={
                              <OutlinedInput
                                label="Country"
                                startAdornment={
                                  <InputAdornment position="start">
                                    <LocationIcon sx={{ color: "text.secondary" }} />
                                  </InputAdornment>
                                }
                                sx={{ borderRadius: 2 }}
                              />
                            }
                            MenuProps={{
                              PaperProps: { 
                                style: { 
                                  maxHeight: 320,
                                  borderRadius: 12,
                                } 
                              },
                            }}
                          >
                            {countries.map((country) => (
                              <MenuItem key={country} value={country}>
                                {country}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Address"
                          value={formData.address}
                          onChange={(e) => handleInputChange("address", e.target.value)}
                          disabled={!editing}
                          variant="outlined"
                          multiline
                          rows={3}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <BusinessIcon sx={{ color: "text.secondary" }} />
                              </InputAdornment>
                            ),
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                            }
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <FormControl fullWidth disabled={!editing}>
                          <InputLabel>Languages</InputLabel>
                          <Select
                            multiple
                            label="Languages"
                            value={normalizeLanguages(formData.languages)}
                            onChange={handleLanguageChange}
                            input={
                              <OutlinedInput
                                label="Languages"
                                startAdornment={
                                  <InputAdornment position="start">
                                    <LanguageIcon sx={{ color: "text.secondary" }} />
                                  </InputAdornment>
                                }
                                sx={{ borderRadius: 2 }}
                              />
                            }
                            renderValue={(selected) => (
                              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                {normalizeLanguages(selected).map((value, index) => (
                                  <Chip
                                    key={`${value}-${index}`}
                                    label={value}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    sx={{ borderRadius: 1.5 }}
                                  />
                                ))}
                              </Box>
                            )}
                            MenuProps={{
                              PaperProps: { 
                                style: { 
                                  maxHeight: 320,
                                  borderRadius: 12,
                                } 
                              },
                            }}
                          >
                            {languages.map((language) => (
                              <MenuItem key={language} value={language}>
                                {language}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                {/* Notification Preferences - UNCHANGED */}
                <Card 
                  elevation={0}
                  sx={{ 
                    border: '1px solid',
                    borderColor: theme.palette.divider,
                    borderRadius: 3,
                  }}
                >
                  <CardHeader
                    title="Notification Preferences"
                    subheader="Manage how you receive updates and reminders"
                    titleTypographyProps={{ 
                      variant: 'h6', 
                      fontWeight: 600 
                    }}
                    subheaderTypographyProps={{ 
                      variant: 'body2',
                      color: 'text.secondary'
                    }}
                    avatar={
                      <NotificationIcon color="primary" />
                    }
                  />
                  <CardContent>
                    <List disablePadding>
                      <ListItem disableGutters>
                        <ListItemIcon>
                          <EmailIcon color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Email Notifications"
                          secondary="Receive important updates via email"
                          primaryTypographyProps={{ fontWeight: 500 }}
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            checked={formData.email_notifications}
                            onChange={(e) => handleInputChange("email_notifications", e.target.checked)}
                            disabled={!editing}
                            color="primary"
                          />
                        </ListItemSecondaryAction>
                      </ListItem>

                      <ListItem disableGutters>
                        <ListItemIcon>
                          <NotificationIcon color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Meeting Reminders"
                          secondary="Get notified before scheduled meetings"
                          primaryTypographyProps={{ fontWeight: 500 }}
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            checked={formData.meeting_reminders}
                            onChange={(e) => handleInputChange("meeting_reminders", e.target.checked)}
                            disabled={!editing}
                            color="primary"
                          />
                        </ListItemSecondaryAction>
                      </ListItem>

                      <ListItem disableGutters>
                        <ListItemIcon>
                          <VideoIcon color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Recording Notifications"
                          secondary="Alerts when recordings are available"
                          primaryTypographyProps={{ fontWeight: 500 }}
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            checked={formData.recording_notifications}
                            onChange={(e) => handleInputChange("recording_notifications", e.target.checked)}
                            disabled={!editing}
                            color="primary"
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>

                {/* Privacy & Meeting Settings - UNCHANGED */}
                <Card 
                  elevation={0}
                  sx={{ 
                    border: '1px solid',
                    borderColor: theme.palette.divider,
                    borderRadius: 3,
                  }}
                >
                  <CardHeader
                    title="Privacy & Meeting Settings"
                    subheader="Control your privacy and default meeting preferences"
                    titleTypographyProps={{ 
                      variant: 'h6', 
                      fontWeight: 600 
                    }}
                    subheaderTypographyProps={{ 
                      variant: 'body2',
                      color: 'text.secondary'
                    }}
                    avatar={
                      <SecurityIcon color="primary" />
                    }
                  />
                  <CardContent>
                    <List disablePadding>
                      <ListItem disableGutters>
                        <ListItemIcon>
                          <VisibilityIcon color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Show Email to Participants"
                          secondary="Display your email address to other meeting participants"
                          primaryTypographyProps={{ fontWeight: 500 }}
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            checked={formData.show_email}
                            onChange={(e) => handleInputChange("show_email", e.target.checked)}
                            disabled={!editing}
                            color="primary"
                          />
                        </ListItemSecondaryAction>
                      </ListItem>

                      <ListItem disableGutters>
                        <ListItemIcon>
                          <PhoneIcon color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Show Phone Number to Participants"
                          secondary="Display your phone number to other meeting participants"
                          primaryTypographyProps={{ fontWeight: 500 }}
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            checked={formData.show_phone}
                            onChange={(e) => handleInputChange("show_phone", e.target.checked)}
                            disabled={!editing}
                            color="primary"
                          />
                        </ListItemSecondaryAction>
                      </ListItem>

                      <Divider sx={{ my: 2 }} />

                      <ListItem disableGutters>
                        <ListItemIcon>
                          <AudioIcon color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Auto-join Audio in Meetings"
                          secondary="Automatically connect audio when joining meetings"
                          primaryTypographyProps={{ fontWeight: 500 }}
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            checked={formData.auto_join_audio}
                            onChange={(e) => handleInputChange("auto_join_audio", e.target.checked)}
                            disabled={!editing}
                            color="primary"
                          />
                        </ListItemSecondaryAction>
                      </ListItem>

                      <ListItem disableGutters>
                        <ListItemIcon>
                          <VideoIcon color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Auto-join Video in Meetings"
                          secondary="Automatically start video when joining meetings"
                          primaryTypographyProps={{ fontWeight: 500 }}
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            checked={formData.auto_join_video}
                            onChange={(e) => handleInputChange("auto_join_video", e.target.checked)}
                            disabled={!editing}
                            color="primary"
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Stack>
            </Grid>
          </Grid>
        </Container>

        {/* ✅ NEW: View Profile Photo Dialog */}
        <Dialog
          open={viewProfileDialogOpen}
          onClose={() => setViewProfileDialogOpen(false)}
          maxWidth="md"
          PaperProps={{
            sx: {
              borderRadius: 3,
              overflow: 'hidden',
            }
          }}
        >
          <DialogTitle sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            pb: 1
          }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <PersonIcon color="primary" />
              <Typography variant="h6" fontWeight={600}>
                Profile Photo
              </Typography>
            </Stack>
            <IconButton onClick={() => setViewProfileDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: 'grey.100', minHeight: 300 }}>
            {formData.profile_picture ? (
              <Box
                component="img"
                src={formData.profile_picture}
                alt={formData.full_name || "Profile Photo"}
                sx={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center', 
                py: 8,
                px: 4
              }}>
                <Avatar
                  sx={{
                    width: 200,
                    height: 200,
                    fontSize: '4rem',
                    bgcolor: theme.palette.primary.main,
                    mb: 2
                  }}
                >
                  {getUserInitials()}
                </Avatar>
                <Typography variant="body1" color="text.secondary">
                  No profile photo uploaded
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2, justifyContent: 'center' }}>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                onClick={() => setViewProfileDialogOpen(false)}
              >
                Close
              </Button>
              <Button
                variant="contained"
                startIcon={<CameraIcon />}
                onClick={() => {
                  setViewProfileDialogOpen(false);
                  setEditPhotoDialogOpen(true);
                }}
              >
                Change Photo
              </Button>
            </Stack>
          </DialogActions>
        </Dialog>

        {/* ✅ NEW: Edit Profile Photo Dialog with ImageUpload Component */}
        <Dialog
          open={editPhotoDialogOpen}
          onClose={() => setEditPhotoDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
            }
          }}
        >
          <DialogTitle sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
          }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <UploadIcon color="primary" />
              <Typography variant="h6" fontWeight={600}>
                Update Profile Photo
              </Typography>
            </Stack>
            <IconButton onClick={() => setEditPhotoDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ py: 2 }}>
              {/* ✅ Using your existing ImageUpload component */}
              <ImageUpload
                value={formData.profile_picture}
                onChange={handleProfilePictureChange}
                variant="avatar"
                size="large"
                maxSize={5 * 1024 * 1024} // 5MB
                acceptedFormats={['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']}
                disabled={loading}
                editable={true}
                userName={formData.full_name || "User"}
                helperText={formData.photo_code === 1 
                  ? "Click to change or remove edited photo" 
                  : "Click to upload a new photo (Registration photo cannot be removed)"}
                showProgress={true}
                allowDelete={formData.photo_code === 1}
              />
            </Box>
          </DialogContent>
        </Dialog>

        {/* Enhanced Snackbar - UNCHANGED */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            variant="filled"
            sx={{ 
              width: "100%",
              borderRadius: 2,
              boxShadow: theme.shadows[8],
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
};

export default ProfilePage;