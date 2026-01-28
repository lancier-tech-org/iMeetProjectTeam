// src/components/auth/AuthWrapper.jsx
import React from 'react';
import {
  Box, Container, Typography, useMediaQuery, Stack, Paper, Grid, useTheme,
} from '@mui/material';
import { VideoCall, Security, Speed, Shield, Verified } from '@mui/icons-material';

const AuthWrapper = ({ children, showFeatures = true }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  // Mobile and tablet - simple centered layout
  if (!isDesktop || !showFeatures) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          width: '100vw',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          py: { xs: 3, sm: 4 },
          px: { xs: 2, sm: 4 },
        }}
      >
        <Container 
          maxWidth="sm" 
          sx={{ 
            position: 'relative', 
            zIndex: 1,
            width: '100%',
            maxWidth: { xs: '100%', sm: 480 },
          }}
        >
          {children}
        </Container>
      </Box>
    );
  }

  // Desktop layout with features
  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden'
      }}
    >
      <Grid container sx={{ height: '100%' }}>
        {/* Left Side - Auth Forms */}
        <Grid
          item
          xs={12}
          md={6}
          lg={5}
          xl={4.5}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: { md: 4, lg: 6 },
            py: 4,
            backgroundColor: '#FFFFFF',
          }}
        >
          <Box sx={{ width: '100%', maxWidth: 420 }}>
            {children}
          </Box>
        </Grid>

        {/* Right Side - Branding */}
        <Grid
          item
          xs={12}
          md={6}
          lg={7}
          xl={7.5}
          sx={{
            display: { xs: 'none', md: 'flex' },
            position: 'relative',
            background: 'linear-gradient(135deg, #2196F3 0%, #3DB4AC 100%)',
            overflow: 'hidden',
          }}
        >
          {/* Background Image with Overlay */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `url('https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.85) 0%, rgba(61, 180, 172, 0.9) 100%)',
              },
            }}
          />

          {/* Content */}
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              px: { md: 4, lg: 6, xl: 10 },
              py: { md: 4, lg: 6 },
              color: '#FFFFFF',
            }}
          >
            {/* Logo Icon */}
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: { md: 3, lg: 4 } }}>
              <Box
                sx={{
                  width: { md: 50, lg: 60 },
                  height: { md: 50, lg: 60 },
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <VideoCall sx={{ fontSize: { md: 26, lg: 32 }, color: '#FFFFFF' }} />
              </Box>
            </Stack>

            {/* Main Headline */}
            <Typography
              variant="h3"
              sx={{
                fontWeight: 400,
                mb: { md: 2, lg: 3 },
                lineHeight: 1.3,
                fontSize: { md: '1.75rem', lg: '2rem', xl: '2.5rem' },
              }}
            >
              We're About{' '}
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
                maxWidth: { md: 350, lg: 500 },
                lineHeight: 1.7,
                fontSize: { md: '0.875rem', lg: '1rem' },
                mb: { md: 3, lg: 4 },
              }}
            >
              iMeetPro is dedicated to building meaningful connections and lasting relationships 
              through secure, high-quality video conferencing for professionals worldwide.
            </Typography>

            {/* Key Features */}
            <Stack spacing={2} sx={{ mb: { md: 3, lg: 4 } }}>
              {[
                { icon: <Security />, text: 'Bank-grade security & encryption' },
                { icon: <Speed />, text: 'Lightning-fast global performance' },
                { icon: <Shield />, text: 'SOC 2 Type II certified' },
                { icon: <Verified />, text: 'Trusted by Fortune 500 companies' }
              ].map((feature, index) => (
                <Stack key={index} direction="row" alignItems="center" spacing={2}>
                  <Box
                    sx={{
                      width: { md: 36, lg: 40 },
                      height: { md: 36, lg: 40 },
                      borderRadius: 2,
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {React.cloneElement(feature.icon, { sx: { color: '#FFFFFF', fontSize: { md: 18, lg: 20 } } })}
                  </Box>
                  <Typography variant="body1" sx={{ fontWeight: 500, fontSize: { md: '0.875rem', lg: '1rem' } }}>
                    {feature.text}
                  </Typography>
                </Stack>
              ))}
            </Stack>

            {/* Trust Indicators */}
            <Paper
              elevation={0}
              sx={{
                p: { md: 2, lg: 3 },
                borderRadius: 3,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                maxWidth: { md: 350, lg: 400 },
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, textAlign: 'center', fontSize: { md: '0.875rem', lg: '1rem' } }}>
                Trusted Worldwide
              </Typography>
              
              <Stack direction="row" justifyContent="space-around" textAlign="center">
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { md: '1.25rem', lg: '1.5rem' } }}>
                    10M+
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8, fontSize: { md: '0.75rem', lg: '0.875rem' } }}>
                    Users
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { md: '1.25rem', lg: '1.5rem' } }}>
                    99.9%
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8, fontSize: { md: '0.75rem', lg: '0.875rem' } }}>
                    Uptime
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { md: '1.25rem', lg: '1.5rem' } }}>
                    150+
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8, fontSize: { md: '0.75rem', lg: '0.875rem' } }}>
                    Countries
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export const AuthWrapperWithTestimonials = ({ children }) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  
  if (!isDesktop) {
    return <AuthWrapper showFeatures={false}>{children}</AuthWrapper>;
  }
  
  return <AuthWrapper showFeatures={true}>{children}</AuthWrapper>;
};

export default AuthWrapper;