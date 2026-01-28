/**
 * BillingTab Component - UPDATED WITH ADDRESS FIELDS
 * Main component for billing, plan selection, and payment integration
 * Now includes customer address collection for GST invoice generation
 */

import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  MenuItem,
  Divider,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PaymentIcon from '@mui/icons-material/Payment';
import ReceiptIcon from '@mui/icons-material/Receipt';
import { useOrderCreation } from '../hooks/useOrderCreation';
import { useRazorpayPayment } from '../hooks/useRazorpayPayment';
import { useAuth } from '../context/AuthContext';

/**
 * Valid Indian States and Union Territories
 */
const INDIAN_STATES = [
  // States
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

/**
 * Plan card component
 */
const PlanCard = ({ plan, isCurrentPlan, onUpgradeClick }) => {
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        border: isCurrentPlan ? '2px solid #4CAF50' : '1px solid #e0e0e0',
        background: isCurrentPlan
          ? 'linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%)'
          : '#ffffff',
      }}
    >
      {isCurrentPlan && (
        <Box
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            backgroundColor: '#4CAF50',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <CheckCircleIcon sx={{ fontSize: '16px' }} />
          Current Plan
        </Box>
      )}

      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" component="div" gutterBottom sx={{ fontWeight: 'bold' }}>
          {plan.plan_name}
        </Typography>

        <Box sx={{ margin: '16px 0' }}>
          <Typography variant="body2" sx={{ color: '#999', textDecoration: 'line-through' }}>
            Base Price: ₹{parseFloat(plan.base_price).toFixed(2)}
          </Typography>
          <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 1 }}>
            + GST {parseFloat(plan.gst_rate).toFixed(0)}% (₹{parseFloat(plan.gst_amount).toFixed(2)})
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#3498db' }}>
            ₹{parseFloat(plan.total_price).toFixed(2)}
            <Typography
              component="span"
              variant="body2"
              sx={{ color: '#666', fontWeight: 'normal' }}
            >
              {' '}
              / {plan.billing_period}
            </Typography>
          </Typography>
        </Box>

        {plan.features && (
          <Box>
            <Typography variant="body2" sx={{ color: '#666', marginBottom: '8px' }}>
              {typeof plan.features === 'string' ? plan.features : JSON.stringify(plan.features)}
            </Typography>
          </Box>
        )}
      </CardContent>

      <CardActions>
        <Button
          fullWidth
          variant="contained"
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            '&:hover': {
              background: 'linear-gradient(135deg, #5a67d8 0%, #6b3fa0 100%)',
            },
          }}
          onClick={() => onUpgradeClick(plan)}
          disabled={isCurrentPlan}
        >
          {isCurrentPlan ? 'Current Plan' : 'Upgrade'}
        </Button>
      </CardActions>
    </Card>
  );
};

/**
 * Main BillingTab Component
 */
export default function BillingTab() {
  // ==================== AUTH CONTEXT ====================
  const { user } = useAuth();

  // ==================== STATE MANAGEMENT ====================

  // User authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState(null);
  const [currentUserPlan, setCurrentUserPlan] = useState('basic');
  
  // Plans data
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Dialog and form state
  const [openPaymentDialog, setOpenPaymentDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [activeStep, setActiveStep] = useState(0);

  // Form field state - UPDATED WITH ADDRESS FIELDS
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile_number: '',
    // NEW ADDRESS FIELDS
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
  });

  // Form validation errors
  const [formErrors, setFormErrors] = useState({});

  // Snackbar for notifications
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info',
  });

  // Custom hooks for order and payment
  const orderCreation = useOrderCreation(
    (error) => showSnackbar(error, 'error')
  );

  const razorpayPayment = useRazorpayPayment(
    (paymentData) => {
      showSnackbar('✅ Payment successful! Your invoice will be emailed shortly...', 'success');
      handlePaymentSuccess(paymentData);
    },
    (error) => {
      showSnackbar(`❌ ${error}`, 'error');
    }
  );

  // ==================== EFFECTS ====================

  /**
   * Load user data and plans on component mount
   */
  useEffect(() => {
    const initializeComponent = async () => {
      try {
        console.log('🔄 Initializing BillingTab...');

        if (!user || !user.id || !user.email) {
          console.warn('⚠️ User not authenticated from AuthContext');
          setIsAuthenticated(false);
          setLoadingPlans(false);
          showSnackbar('⚠️ Please log in to access billing and plans', 'warning');
          return;
        }

        console.log('✅ User found in AuthContext:', user);

        setIsAuthenticated(true);
        setUserId(user.id);

        // Pre-fill form with user data from AuthContext
        setFormData({
          name: user.full_name || user.name || '',
          email: user.email || '',
          mobile_number: user.phone_number || '',
          // Address fields - empty by default (user must fill)
          address_line1: '',
          address_line2: '',
          city: '',
          state: '',
          pincode: '',
          country: 'India',
        });

        console.log('📋 User Data from AuthContext:', {
          userId: user.id,
          name: user.full_name || user.name,
          email: user.email,
          mobile: user.phone_number
        });

        await fetchPlans();

        const currentPlan = user.current_plan || localStorage.getItem('userCurrentPlan') || 'basic';
        setCurrentUserPlan(currentPlan);

        setLoadingPlans(false);
        console.log('✅ BillingTab initialized successfully');

      } catch (error) {
        console.error('❌ Failed to initialize billing tab:', error);
        setLoadingPlans(false);
        showSnackbar('Failed to load billing information', 'error');
      }
    };

    initializeComponent();
  }, [user]);

  // ==================== HANDLERS ====================

  /**
   * Fetch all plans from backend
   */
  const fetchPlans = async () => {
    try {
      console.log('📥 Fetching plans from backend...');

      const response = await fetch(
        'https://api.lancieretech.com/api/plan/filter?billing_period=monthly',
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.Error || 'Failed to fetch plans');
      }

      const data = await response.json();
      console.log('✅ Plans fetched:', data);

      setPlans(data);
    } catch (error) {
      console.error('❌ Error fetching plans:', error);
      showSnackbar(`Failed to load plans: ${error.message}`, 'error');
    }
  };

  /**
   * Show snackbar notification
   */
  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  };

  /**
   * Close snackbar
   */
  const closeSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  /**
   * Handle upgrade button click
   */
  const handleUpgradeClick = (plan) => {
    console.log('📋 Opening payment dialog for plan:', plan.plan_name);

    if (!isAuthenticated || !userId) {
      showSnackbar('⚠️ Please log in to upgrade your plan', 'warning');
      return;
    }

    setSelectedPlan(plan);
    setActiveStep(0);
    setFormErrors({});
    setOpenPaymentDialog(true);
  };

  /**
   * Handle form field changes
   */
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  /**
   * Validate customer information (Step 1)
   */
  const validateCustomerInfo = () => {
    const errors = {};

    // Name validation
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.trim().length > 100) {
      errors.name = 'Name must be max 100 characters';
    }

    // Email validation
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        errors.email = 'Invalid email format';
      } else if (formData.email.length > 100) {
        errors.email = 'Email must be max 100 characters';
      }
    }

    // Mobile validation
    if (!formData.mobile_number.trim()) {
      errors.mobile_number = 'Mobile number is required';
    } else {
      const mobileClean = formData.mobile_number.replace(/\D/g, '');
      if (!/^[6-9]\d{9}$/.test(mobileClean)) {
        errors.mobile_number = 'Mobile must be 10 digits starting with 6-9';
      }
    }

    return errors;
  };

  /**
   * Validate address information (Step 2)
   */
  const validateAddressInfo = () => {
    const errors = {};

    // Address Line 1 validation
    if (!formData.address_line1.trim()) {
      errors.address_line1 = 'Address Line 1 is required';
    } else if (formData.address_line1.length > 200) {
      errors.address_line1 = 'Address Line 1 must be max 200 characters';
    }

    // Address Line 2 (optional but validate length if provided)
    if (formData.address_line2 && formData.address_line2.length > 200) {
      errors.address_line2 = 'Address Line 2 must be max 200 characters';
    }

    // City validation
    if (!formData.city.trim()) {
      errors.city = 'City is required';
    } else if (formData.city.length > 100) {
      errors.city = 'City must be max 100 characters';
    }

    // State validation
    if (!formData.state) {
      errors.state = 'State is required';
    } else if (!INDIAN_STATES.includes(formData.state)) {
      errors.state = 'Invalid state selection';
    }

    // Pincode validation
    if (!formData.pincode.trim()) {
      errors.pincode = 'Pincode is required';
    } else if (!/^\d{6}$/.test(formData.pincode)) {
      errors.pincode = 'Pincode must be exactly 6 digits';
    }

    // Country validation (optional but validate if provided)
    if (formData.country && formData.country.length > 50) {
      errors.country = 'Country must be max 50 characters';
    }

    return errors;
  };

  /**
   * Handle Next button in stepper
   */
  const handleNext = () => {
    let errors = {};

    if (activeStep === 0) {
      errors = validateCustomerInfo();
    } else if (activeStep === 1) {
      errors = validateAddressInfo();
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showSnackbar('Please fix the errors before proceeding', 'warning');
      return;
    }

    setActiveStep(prev => prev + 1);
  };

  /**
   * Handle Back button in stepper
   */
  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  /**
   * Handle payment button click (Final step)
   */
  const handlePaymentClick = async () => {
    console.log('💳 Payment button clicked');

    // Final validation
    const customerErrors = validateCustomerInfo();
    const addressErrors = validateAddressInfo();
    const allErrors = { ...customerErrors, ...addressErrors };

    if (Object.keys(allErrors).length > 0) {
      setFormErrors(allErrors);
      showSnackbar('Please complete all required fields', 'error');
      return;
    }

    if (!selectedPlan) {
      showSnackbar('Plan not selected', 'error');
      return;
    }

    if (!userId) {
      showSnackbar('⚠️ User ID not found. Please log in again.', 'error');
      return;
    }

    try {
      console.log('📦 Step 1: Creating payment order...');

      // UPDATED ORDER PAYLOAD WITH ADDRESS FIELDS
      const orderPayload = {
        user_id: userId,
        name: formData.name.trim(),
        email: formData.email.trim(),
        mobile_number: formData.mobile_number.trim(),
        plan_id: selectedPlan.id,
        purpose: 'subscription',
        currency: 'INR',
        // NEW: ADDRESS FIELDS
        address_line1: formData.address_line1.trim(),
        address_line2: formData.address_line2.trim() || null,
        city: formData.city.trim(),
        state: formData.state,
        pincode: formData.pincode.trim(),
        country: formData.country.trim(),
      };

      console.log('📤 Order Payload (with address):', orderPayload);

      const orderResult = await orderCreation.createOrder(orderPayload);

      if (!orderResult.success) {
        showSnackbar(`Failed to create order: ${orderResult.error}`, 'error');
        return;
      }

      console.log('✅ Order created successfully');

      console.log('🛒 Step 2: Opening Razorpay checkout...');

      await razorpayPayment.openPayment({
        razorpayOrderId: orderResult.Razorpay_Order_ID,
        razorpayKeyId: orderResult.Razorpay_Key_ID,
        amount: orderResult.Amount_Paise,
        currency: orderResult.Currency,
        prefillData: {
          name: formData.name,
          email: formData.email,
          contact: formData.mobile_number,
        },
        planDetails: orderResult.Plan_Details,
      });

    } catch (error) {
      console.error('💥 Payment flow error:', error);
      showSnackbar(`Payment error: ${error.message}`, 'error');
    }
  };

  /**
   * Handle payment success
   */
  const handlePaymentSuccess = (paymentData) => {
    console.log('🎉 Payment successful:', paymentData);

    if (selectedPlan) {
      setCurrentUserPlan(selectedPlan.plan_type);
      localStorage.setItem('userCurrentPlan', selectedPlan.plan_type);
    }

    setTimeout(() => {
      handleClosePaymentDialog();
    }, 2000);
  };

  /**
   * Handle retry payment
   */
  const handleRetryPayment = async () => {
    console.log('🔁 Retrying payment...');

    if (orderCreation.orderData && orderCreation.orderData.Razorpay_Order_ID) {
      await razorpayPayment.retryPayment({
        razorpayOrderId: orderCreation.orderData.Razorpay_Order_ID,
        razorpayKeyId: orderCreation.orderData.Razorpay_Key_ID,
        amount: orderCreation.orderData.Amount_Paise,
        currency: orderCreation.orderData.Currency,
        prefillData: {
          name: formData.name,
          email: formData.email,
          contact: formData.mobile_number,
        },
        planDetails: orderCreation.orderData.Plan_Details,
      });
    }
  };

  /**
   * Close payment dialog
   */
  const handleClosePaymentDialog = () => {
    console.log('🚪 Closing payment dialog');

    setOpenPaymentDialog(false);
    setSelectedPlan(null);
    setActiveStep(0);
    setFormErrors({});

    // Reset form to original user data
    setFormData({
      name: user?.full_name || user?.name || '',
      email: user?.email || '',
      mobile_number: user?.phone_number || '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
    });

    orderCreation.reset();
    razorpayPayment.resetPayment();
  };

  // ==================== RENDER ====================

  if (loadingPlans) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '500px' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!isAuthenticated) {
    return (
      <Container maxWidth="lg" sx={{ paddingTop: '24px', paddingBottom: '24px' }}>
        <Alert severity="warning" sx={{ marginBottom: '24px' }}>
          Please log in to access billing and subscription plans.
        </Alert>
        <Box sx={{ textAlign: 'center', padding: '48px' }}>
          <Typography variant="h5" sx={{ marginBottom: '16px', color: '#666' }}>
            Authentication Required
          </Typography>
          <Typography variant="body1" sx={{ color: '#999' }}>
            You need to be logged in to view and manage your billing information.
          </Typography>
        </Box>
      </Container>
    );
  }

  // Stepper steps
  const steps = ['Customer Info', 'Billing Address', 'Payment'];

  return (
    <Container maxWidth="lg" sx={{ paddingTop: '24px', paddingBottom: '24px' }}>
      {/* Header */}
      <Box sx={{ marginBottom: '32px' }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', marginBottom: '8px' }}>
          Billing & Plans
        </Typography>
        <Typography variant="body2" sx={{ color: '#666' }}>
          Choose the perfect plan for your needs
        </Typography>
        <Typography variant="caption" sx={{ color: '#999', display: 'block', marginTop: '8px' }}>
          Logged in as: {formData.name} ({formData.email})
        </Typography>
      </Box>

      {/* Plans Grid */}
      <Grid container spacing={3} sx={{ marginBottom: '32px' }}>
        {plans.map(plan => (
          <Grid item xs={12} sm={6} md={4} key={plan.id}>
            <PlanCard
              plan={plan}
              isCurrentPlan={plan.plan_type === currentUserPlan}
              onUpgradeClick={handleUpgradeClick}
            />
          </Grid>
        ))}
      </Grid>

      {/* Payment Methods Section */}
      <Box sx={{ marginBottom: '32px' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', marginBottom: '16px' }}>
          Payment Methods
        </Typography>
        <Card>
          <CardContent>
            <Typography variant="body2" sx={{ color: '#666' }}>
              Secure payment powered by Razorpay. We accept UPI, Cards, Net Banking, and Wallets.
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Billing History Section */}
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 'bold', marginBottom: '16px' }}>
          Billing History
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell>Date</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Invoice</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} sx={{ textAlign: 'center', padding: '24px' }}>
                  <Typography variant="body2" sx={{ color: '#999' }}>
                    No billing history yet. Make your first purchase to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* ==================== PAYMENT DIALOG WITH STEPPER ==================== */}
      <Dialog
        open={openPaymentDialog}
        onClose={handleClosePaymentDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 'bold', paddingBottom: '8px' }}>
          Complete Your Payment
          {selectedPlan && (
            <Typography variant="body2" sx={{ color: '#666', fontWeight: 'normal' }}>
              Upgrade to {selectedPlan.plan_name} - ₹{parseFloat(selectedPlan.total_price).toFixed(2)}
            </Typography>
          )}
        </DialogTitle>

        <DialogContent sx={{ paddingTop: '24px' }}>
          {/* Stepper */}
          <Stepper activeStep={activeStep} sx={{ marginBottom: '32px' }}>
            {steps.map((label, index) => (
              <Step key={label}>
                <StepLabel
                  icon={
                    index === 0 ? <CheckCircleIcon /> :
                    index === 1 ? <LocationOnIcon /> :
                    <PaymentIcon />
                  }
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* Order Creation Loading */}
          {orderCreation.loading && (
            <Box sx={{ textAlign: 'center', padding: '32px' }}>
              <CircularProgress size={50} />
              <Typography variant="body1" sx={{ marginTop: '16px', color: '#666' }}>
                Preparing your order...
              </Typography>
            </Box>
          )}

          {/* Order Error */}
          {orderCreation.error && !orderCreation.loading && (
            <Alert
              severity="error"
              sx={{ marginBottom: '24px' }}
              onClose={() => orderCreation.reset()}
            >
              {orderCreation.error}
              <Button
                size="small"
                sx={{ marginTop: '8px', display: 'block' }}
                onClick={() => handlePaymentClick()}
              >
                Retry
              </Button>
            </Alert>
          )}

          {/* Payment Verification Loading */}
          {razorpayPayment.verifying && (
            <Box sx={{ textAlign: 'center', padding: '32px' }}>
              <CircularProgress size={50} />
              <Typography variant="body1" sx={{ marginTop: '16px', color: '#666' }}>
                Verifying your payment...
              </Typography>
            </Box>
          )}

          {/* Payment Error */}
          {razorpayPayment.error && !razorpayPayment.verifying && !razorpayPayment.processing && (
            <Alert
              severity="error"
              sx={{ marginBottom: '24px' }}
              onClose={() => razorpayPayment.resetPayment()}
            >
              {razorpayPayment.error}
              {razorpayPayment.dismissedByUser && (
                <Button
                  size="small"
                  sx={{ marginTop: '8px', display: 'block' }}
                  onClick={handleRetryPayment}
                >
                  Try Again
                </Button>
              )}
            </Alert>
          )}

          {/* Payment Success */}
          {razorpayPayment.success && (
            <Alert severity="success" sx={{ marginBottom: '24px' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon />
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    Payment Successful!
                  </Typography>
                  <Typography variant="body2">
                    Your GST invoice will be emailed to {formData.email}
                  </Typography>
                </Box>
              </Box>
            </Alert>
          )}

          {/* STEP 1: Customer Information */}
          {activeStep === 0 && !orderCreation.loading && !razorpayPayment.verifying && !razorpayPayment.processing && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CheckCircleIcon color="primary" />
                Customer Information
              </Typography>

              <TextField
                label="Full Name"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                fullWidth
                required
                error={!!formErrors.name}
                helperText={formErrors.name || 'As per official documents'}
                placeholder="John Doe"
              />

              <TextField
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleFormChange}
                fullWidth
                required
                error={!!formErrors.email}
                helperText={formErrors.email || 'Invoice will be sent to this email'}
                placeholder="john@example.com"
              />

              <TextField
                label="Mobile Number"
                name="mobile_number"
                value={formData.mobile_number}
                onChange={handleFormChange}
                fullWidth
                required
                error={!!formErrors.mobile_number}
                helperText={formErrors.mobile_number || '10 digits starting with 6-9'}
                placeholder="9876543210"
              />
            </Box>
          )}

          {/* STEP 2: Billing Address */}
          {activeStep === 1 && !orderCreation.loading && !razorpayPayment.verifying && !razorpayPayment.processing && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <LocationOnIcon color="primary" />
                Billing Address (For GST Invoice)
              </Typography>

              <Alert severity="info" sx={{ mb: 2 }}>
                This address will appear on your GST-compliant invoice
              </Alert>

              <TextField
                label="Address Line 1"
                name="address_line1"
                value={formData.address_line1}
                onChange={handleFormChange}
                fullWidth
                required
                error={!!formErrors.address_line1}
                helperText={formErrors.address_line1 || 'House/Flat No., Building Name, Street'}
                placeholder="123, MG Road"
              />

              <TextField
                label="Address Line 2"
                name="address_line2"
                value={formData.address_line2}
                onChange={handleFormChange}
                fullWidth
                error={!!formErrors.address_line2}
                helperText={formErrors.address_line2 || 'Landmark, Area (Optional)'}
                placeholder="Near City Mall"
              />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="City"
                    name="city"
                    value={formData.city}
                    onChange={handleFormChange}
                    fullWidth
                    required
                    error={!!formErrors.city}
                    helperText={formErrors.city}
                    placeholder="Bangalore"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Pincode"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleFormChange}
                    fullWidth
                    required
                    error={!!formErrors.pincode}
                    helperText={formErrors.pincode || '6 digits'}
                    placeholder="560001"
                    inputProps={{ maxLength: 6 }}
                  />
                </Grid>
              </Grid>

              <TextField
                label="State"
                name="state"
                value={formData.state}
                onChange={handleFormChange}
                fullWidth
                required
                select
                error={!!formErrors.state}
                helperText={formErrors.state || 'Select your state for GST calculation'}
              >
                <MenuItem value="">
                  <em>Select State</em>
                </MenuItem>
                {INDIAN_STATES.map(state => (
                  <MenuItem key={state} value={state}>
                    {state}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Country"
                name="country"
                value={formData.country}
                onChange={handleFormChange}
                fullWidth
                disabled
                helperText="Currently available in India only"
              />
            </Box>
          )}

          {/* STEP 3: Payment Review */}
          {activeStep === 2 && !orderCreation.loading && !razorpayPayment.verifying && !razorpayPayment.processing && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ReceiptIcon color="primary" />
                Review & Pay
              </Typography>

              {/* Selected Plan Summary */}
              {selectedPlan && (
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
                      Plan Summary
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Plan:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {selectedPlan.plan_name}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Base Price:</Typography>
                      <Typography variant="body2">
                        ₹{parseFloat(selectedPlan.base_price).toFixed(2)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        GST @ {parseFloat(selectedPlan.gst_rate).toFixed(0)}%:
                      </Typography>
                      <Typography variant="body2">
                        ₹{parseFloat(selectedPlan.gst_amount).toFixed(2)}
                      </Typography>
                    </Box>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        Total Amount:
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#3498db' }}>
                        ₹{parseFloat(selectedPlan.total_price).toFixed(2)}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              )}

              {/* Customer Info Summary */}
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
                    Customer Details
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    <strong>Name:</strong> {formData.name}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    <strong>Email:</strong> {formData.email}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Mobile:</strong> {formData.mobile_number}
                  </Typography>
                </CardContent>
              </Card>

              {/* Billing Address Summary */}
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
                    Billing Address
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    {formData.address_line1}
                  </Typography>
                  {formData.address_line2 && (
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      {formData.address_line2}
                    </Typography>
                  )}
                  <Typography variant="body2">
                    {formData.city}, {formData.state} - {formData.pincode}
                  </Typography>
                  <Typography variant="body2">
                    {formData.country}
                  </Typography>
                </CardContent>
              </Card>

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Next Step:</strong> You will be redirected to Razorpay for secure payment. Your GST-compliant invoice will be emailed to you after successful payment.
                </Typography>
              </Alert>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ padding: '16px 24px', gap: 1 }}>
          {activeStep > 0 && (
            <Button
              onClick={handleBack}
              disabled={razorpayPayment.verifying || razorpayPayment.processing || orderCreation.loading}
            >
              Back
            </Button>
          )}

          <Button
            onClick={handleClosePaymentDialog}
            disabled={razorpayPayment.verifying || razorpayPayment.processing || orderCreation.loading}
          >
            Cancel
          </Button>

          {activeStep < steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={razorpayPayment.verifying || razorpayPayment.processing || orderCreation.loading}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                minWidth: '150px',
              }}
              onClick={handlePaymentClick}
              disabled={
                razorpayPayment.verifying ||
                razorpayPayment.processing ||
                orderCreation.loading ||
                razorpayPayment.success
              }
            >
              {orderCreation.loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                `Pay ₹${selectedPlan ? parseFloat(selectedPlan.total_price).toFixed(2) : '0'}`
              )}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Snackbar Notification */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          onClose={closeSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}