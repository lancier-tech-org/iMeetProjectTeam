// src/components/auth/Login.jsx
import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
  InputAdornment,
  IconButton,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  styled,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  CheckCircle,
  VideoCall,
  Email as EmailIcon,
} from "@mui/icons-material";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";

// Responsive styled components
const StyledTextField = styled(TextField)(({ theme }) => ({
  "& .MuiOutlinedInput-root": {
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    height: 48,
    [theme.breakpoints.down('sm')]: {
      height: 44,
    },
    "& fieldset": {
      borderColor: "#E0E0E0",
      borderWidth: 1,
    },
    "&:hover fieldset": {
      borderColor: "#2196F3",
    },
    "&.Mui-focused fieldset": {
      borderColor: "#2196F3",
      borderWidth: 2,
    },
  },
  "& .MuiOutlinedInput-input": {
    padding: "12px 14px",
    fontSize: "0.95rem",
    [theme.breakpoints.down('sm')]: {
      padding: "10px 12px",
      fontSize: "0.875rem",
    },
    "&::placeholder": {
      color: "#9E9E9E",
      opacity: 1,
    },
  },
}));

const InputLabel = styled(Typography)(({ theme }) => ({
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "#333333",
  marginBottom: 8,
  [theme.breakpoints.down('sm')]: {
    fontSize: "0.8125rem",
    marginBottom: 6,
  },
}));

const Login = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading } = useAuth();
  
  // Responsive breakpoints
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [emailValid, setEmailValid] = useState(false);

  useEffect(() => {
    if (location.state?.registrationSuccess) {
      setSuccessMessage("Registration successful! Please login to continue.");
      if (location.state?.email) {
        setFormData((prev) => ({ ...prev, email: location.state.email }));
        setEmailValid(true);
      }
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (name === "email") {
      const isValid = /\S+@\S+\.\S+/.test(value);
      setEmailValid(isValid && value.length > 0);
    }

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError("");

    if (!validateForm()) return;

    try {
      await login(formData);
      navigate("/dashboard");
    } catch (error) {
      setApiError(error.message || "Login failed. Please try again.");
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        backgroundColor: "#FFFFFF",
        overflow: "auto",
      }}
    >
      <Grid container sx={{ minHeight: "100%" }}>
        {/* Left Side - Login Form */}
        <Grid
          item
          xs={12}
          md={6}
          lg={5}
          xl={4.5}
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: { xs: "flex-start", sm: "center" },
            alignItems: "center",
            px: { xs: 2.5, sm: 4, md: 6, lg: 8 },
            py: { xs: 3, sm: 4, md: 6 },
            backgroundColor: "#FFFFFF",
            minHeight: { xs: "100vh", md: "auto" },
          }}
        >
          <Box
            sx={{
              width: "100%",
              maxWidth: { xs: "100%", sm: 420, md: 400 },
            }}
          >
            {/* Logo */}
            <Box 
              sx={{ 
                mb: { xs: 3, sm: 4, md: 5 },
                textAlign: { xs: "center", md: "left" },
              }}
            >
              <Box 
                sx={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 1,
                  justifyContent: { xs: "center", md: "flex-start" },
                }}
              >
                <VideoCall 
                  sx={{ 
                    fontSize: { xs: 28, sm: 32 }, 
                    color: "#2196F3" 
                  }} 
                />
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 700,
                    color: "#2196F3",
                    letterSpacing: "-0.5px",
                    fontSize: { xs: "1.25rem", sm: "1.5rem" },
                  }}
                >
                  iMeet
                  <span style={{ color: "#3DB4AC" }}>Pro</span>
                </Typography>
              </Box>
            </Box>

            {/* Welcome Text */}
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: "#1A1A1A",
                mb: 1,
                fontSize: { xs: "1.5rem", sm: "1.75rem", md: "2rem" },
                textAlign: { xs: "center", md: "left" },
              }}
            >
              Welcome Back
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: "#666666",
                mb: { xs: 3, sm: 4 },
                fontSize: { xs: "0.875rem", sm: "0.95rem" },
                textAlign: { xs: "center", md: "left" },
              }}
            >
              Enter your email and password to access your account
            </Typography>

            {/* Success Message */}
            {successMessage && (
              <Alert
                severity="success"
                sx={{ 
                  mb: { xs: 2, sm: 3 }, 
                  borderRadius: 2,
                  fontSize: { xs: "0.8125rem", sm: "0.875rem" },
                }}
                onClose={() => setSuccessMessage("")}
              >
                {successMessage}
              </Alert>
            )}

            {/* Error Alert */}
            {apiError && (
              <Alert
                severity="error"
                sx={{ 
                  mb: { xs: 2, sm: 3 }, 
                  borderRadius: 2,
                  fontSize: { xs: "0.8125rem", sm: "0.875rem" },
                }}
                onClose={() => setApiError("")}
              >
                {apiError}
              </Alert>
            )}

            {/* Login Form */}
            <Box component="form" onSubmit={handleSubmit}>
              {/* Email Field */}
              <Box sx={{ mb: { xs: 2, sm: 3 } }}>
                <InputLabel>Email</InputLabel>
                <StyledTextField
                  fullWidth
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  error={!!errors.email}
                  helperText={errors.email}
                  InputProps={{
                    endAdornment: emailValid && (
                      <InputAdornment position="end">
                        <CheckCircle sx={{ color: "#4CAF50", fontSize: { xs: 18, sm: 20 } }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              {/* Password Field */}
              <Box sx={{ mb: 2 }}>
                <InputLabel>Password</InputLabel>
                <StyledTextField
                  fullWidth
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  error={!!errors.password}
                  helperText={errors.password}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          size="small"
                        >
                          {showPassword ? (
                            <VisibilityOff sx={{ fontSize: { xs: 18, sm: 20 }, color: "#9E9E9E" }} />
                          ) : (
                            <Visibility sx={{ fontSize: { xs: 18, sm: 20 }, color: "#9E9E9E" }} />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              {/* Remember Me & Forgot Password */}
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", sm: "row" },
                  justifyContent: "space-between",
                  alignItems: { xs: "flex-start", sm: "center" },
                  gap: { xs: 1, sm: 0 },
                  mb: { xs: 2, sm: 3 },
                }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleChange}
                      size="small"
                      sx={{
                        color: "#E0E0E0",
                        "&.Mui-checked": {
                          color: "#2196F3",
                        },
                      }}
                    />
                  }
                  label={
                    <Typography
                      variant="body2"
                      sx={{ 
                        color: "#666666", 
                        fontSize: { xs: "0.8125rem", sm: "0.875rem" } 
                      }}
                    >
                      Remember Me
                    </Typography>
                  }
                />
                <Link
                  component="button"
                  type="button"
                  onClick={() => navigate("/auth/forgot-password")}
                  sx={{
                    textDecoration: "none",
                    fontWeight: 500,
                    fontSize: { xs: "0.8125rem", sm: "0.875rem" },
                    color: "#2196F3",
                    "&:hover": {
                      textDecoration: "underline",
                    },
                  }}
                >
                  Forgot password?
                </Link>
              </Box>

              {/* Sign In Button */}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{
                  py: { xs: 1.25, sm: 1.5 },
                  borderRadius: 2,
                  textTransform: "none",
                  fontSize: { xs: "0.9375rem", sm: "1rem" },
                  fontWeight: 600,
                  backgroundColor: "#2196F3",
                  boxShadow: "none",
                  "&:hover": {
                    backgroundColor: "#1976D2",
                    boxShadow: "0 4px 12px rgba(33, 150, 243, 0.4)",
                  },
                  "&:disabled": {
                    backgroundColor: "#BBDEFB",
                  },
                }}
              >
                {loading ? (
                  <CircularProgress size={22} sx={{ color: "#FFFFFF" }} />
                ) : (
                  "Sign In"
                )}
              </Button>

              {/* Sign Up Link */}
              <Box sx={{ textAlign: "center", mt: { xs: 2.5, sm: 3 } }}>
                <Typography
                  variant="body2"
                  sx={{ 
                    color: "#666666", 
                    fontSize: { xs: "0.8125rem", sm: "0.875rem" } 
                  }}
                >
                  Don't have an account?{" "}
                  <Link
                    component="button"
                    type="button"
                    onClick={() => navigate("/auth/register")}
                    sx={{
                      textDecoration: "none",
                      fontWeight: 600,
                      color: "#2196F3",
                      "&:hover": {
                        textDecoration: "underline",
                      },
                    }}
                  >
                    Sign up now
                  </Link>
                </Typography>
              </Box>
            </Box>
          </Box>
        </Grid>

        {/* Right Side - Branding Section (Hidden on mobile) */}
        <Grid
          item
          xs={12}
          md={6}
          lg={7}
          xl={7.5}
          sx={{
            display: { xs: "none", md: "flex" },
            position: "relative",
            background: "linear-gradient(135deg, #2196F3 0%, #3DB4AC 100%)",
            overflow: "hidden",
          }}
        >
          {/* Background Image with Overlay */}
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `url('https://images.unsplash.com/photo-15734963 59142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "linear-gradient(135deg, rgba(33, 150, 243, 0.85) 0%, rgba(61, 180, 172, 0.9) 100%)",
              },
            }}
          />

          {/* Content */}
          <Box
            sx={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              px: { md: 4, lg: 6, xl: 10 },
              py: { md: 4, lg: 6 },
              color: "#FFFFFF",
            }}
          >
            {/* Icon Badge */}
            <Box
              sx={{
                width: { md: 50, lg: 60 },
                height: { md: 50, lg: 60 },
                borderRadius: "50%",
                backgroundColor: "rgba(255, 255, 255, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: { md: 3, lg: 4 },
                backdropFilter: "blur(10px)",
              }}
            >
              <VideoCall sx={{ fontSize: { md: 26, lg: 32 }, color: "#FFFFFF" }} />
            </Box>

            {/* Main Headline */}
            <Typography
              variant="h3"
              sx={{
                fontWeight: 400,
                mb: { md: 2, lg: 3 },
                lineHeight: 1.3,
                fontSize: { md: "1.75rem", lg: "2rem", xl: "2.5rem" },
              }}
            >
              We're About{" "}
              <Box component="span" sx={{ fontWeight: 700 }}>
                Professional Video
              </Box>
              <br />
              <Box component="span" sx={{ fontWeight: 700 }}>
                Meetings.
              </Box>
            </Typography>

            {/* Description */}
            <Typography
              variant="body1"
              sx={{
                opacity: 0.9,
                maxWidth: { md: 400, lg: 500 },
                lineHeight: 1.7,
                fontSize: { md: "0.9rem", lg: "1rem" },
                mb: { md: 3, lg: 4 },
              }}
            >
              iMeetPro is dedicated to building meaningful connections and
              lasting relationships through secure, high-quality video
              conferencing for professionals worldwide.
            </Typography>

            {/* Decorative Element */}
            <Box
              sx={{
                position: "absolute",
                bottom: { md: 30, lg: 40 },
                right: { md: 30, lg: 40 },
                width: { md: 60, lg: 80 },
                height: { md: 60, lg: 80 },
                borderRadius: "50%",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <EmailIcon sx={{ fontSize: { md: 28, lg: 36 }, color: "rgba(255, 255, 255, 0.5)" }} />
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Login;