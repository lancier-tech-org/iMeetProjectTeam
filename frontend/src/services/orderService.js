/**
 * Order Service Module - UPDATED WITH ADDRESS FIELDS
 * Handles payment order creation API calls to backend
 * Now includes address information for GST invoice generation
 * 
 * Location: src/services/orderService.js
 */

const API_BASE_URL = 'https://api.lancieretech.com';

// Valid Indian States for validation
const VALID_INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

/**
 * Create payment order with address information
 * @param {Object} orderPayload - Order details including address
 * @returns {Promise<Object>} Order creation response
 */
export const createPaymentOrder = async (orderPayload) => {
  try {
    console.log('🔄 Creating payment order with payload:', orderPayload);

    // ==================== VALIDATION ====================

    // Validate required customer fields
    const requiredCustomerFields = ['user_id', 'name', 'email', 'mobile_number', 'plan_id', 'purpose'];
    const missingCustomerFields = requiredCustomerFields.filter(field => !orderPayload[field]);

    if (missingCustomerFields.length > 0) {
      throw new Error(`Missing required customer fields: ${missingCustomerFields.join(', ')}`);
    }

    // Validate required address fields (NEW)
    const requiredAddressFields = ['address_line1', 'city', 'state', 'pincode'];
    const missingAddressFields = requiredAddressFields.filter(field => !orderPayload[field]);

    if (missingAddressFields.length > 0) {
      throw new Error(`Missing required address fields: ${missingAddressFields.join(', ')}`);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(orderPayload.email)) {
      throw new Error('Invalid email format');
    }

    // Validate mobile number (10 digits, India format)
    const mobileRegex = /^[6-9]\d{9}$/;
    const cleanMobile = orderPayload.mobile_number.replace(/\D/g, '');
    if (!mobileRegex.test(cleanMobile)) {
      throw new Error('Invalid mobile number. Must be 10 digits starting with 6-9');
    }

    // Validate plan_id is a number
    if (typeof orderPayload.plan_id !== 'number' || orderPayload.plan_id <= 0) {
      throw new Error('Invalid plan_id. Must be a positive number');
    }

    // Validate state (NEW)
    if (!VALID_INDIAN_STATES.includes(orderPayload.state)) {
      throw new Error(`Invalid state: ${orderPayload.state}. Must be a valid Indian state or UT`);
    }

    // Validate pincode (NEW)
    const pincodeRegex = /^\d{6}$/;
    if (!pincodeRegex.test(orderPayload.pincode)) {
      throw new Error('Invalid pincode. Must be exactly 6 digits');
    }

    // Validate field lengths
    if (orderPayload.name.length > 100) {
      throw new Error('Name must be max 100 characters');
    }

    if (orderPayload.email.length > 100) {
      throw new Error('Email must be max 100 characters');
    }

    if (orderPayload.address_line1.length > 200) {
      throw new Error('Address line 1 must be max 200 characters');
    }

    if (orderPayload.address_line2 && orderPayload.address_line2.length > 200) {
      throw new Error('Address line 2 must be max 200 characters');
    }

    if (orderPayload.city.length > 100) {
      throw new Error('City must be max 100 characters');
    }

    if (orderPayload.country && orderPayload.country.length > 50) {
      throw new Error('Country must be max 50 characters');
    }

    // ==================== PREPARE REQUEST ====================

    const requestBody = {
      // Customer information
      user_id: orderPayload.user_id,
      name: orderPayload.name.trim(),
      email: orderPayload.email.trim(),
      mobile_number: cleanMobile,
      plan_id: orderPayload.plan_id,
      purpose: orderPayload.purpose.trim(),
      currency: orderPayload.currency || 'INR',

      // NEW: Address information for GST invoice
      address_line1: orderPayload.address_line1.trim(),
      address_line2: orderPayload.address_line2 ? orderPayload.address_line2.trim() : null,
      city: orderPayload.city.trim(),
      state: orderPayload.state,
      pincode: orderPayload.pincode.trim(),
      country: orderPayload.country ? orderPayload.country.trim() : 'India',
    };

    console.log('📤 Sending request to:', `${API_BASE_URL}/api/payment/order/create`);
    console.log('📋 Request includes address:', {
      address_line1: requestBody.address_line1,
      city: requestBody.city,
      state: requestBody.state,
      pincode: requestBody.pincode,
    });

    // ==================== API CALL ====================

    const response = await fetch(`${API_BASE_URL}/api/payment/order/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📥 Response status:', response.status);

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Order creation failed:', data);
      throw new Error(data.Error || `Failed to create order: ${response.statusText}`);
    }

    console.log('✅ Order created successfully:', data);
    
    // Enhanced response logging
    if (data.Address) {
      console.log('📍 Billing address captured:', data.Address);
    }

    return {
      success: true,
      ...data
    };
  } catch (error) {
    console.error('❌ Error in createPaymentOrder:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get payment order details
 * @param {number} orderId - Internal order ID
 * @returns {Promise<Object>} Order details
 */
export const getPaymentOrder = async (orderId) => {
  try {
    console.log('🔄 Fetching order details for ID:', orderId);

    const response = await fetch(`${API_BASE_URL}/api/payment/order/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.Error || `Failed to fetch order`);
    }

    console.log('✅ Order details fetched:', data);
    
    // Log address information if available
    if (data.Address_Line1) {
      console.log('📍 Order includes address:', {
        address_line1: data.Address_Line1,
        city: data.City,
        state: data.State,
        pincode: data.Pincode,
      });
    }

    return {
      success: true,
      ...data
    };
  } catch (error) {
    console.error('❌ Error in getPaymentOrder:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get payment order by Razorpay order ID
 * @param {string} razorpayOrderId - Razorpay order ID
 * @returns {Promise<Object>} Order details
 */
export const getPaymentOrderByRazorpayId = async (razorpayOrderId) => {
  try {
    console.log('🔄 Fetching order details for Razorpay Order ID:', razorpayOrderId);

    const response = await fetch(`${API_BASE_URL}/api/payment/order/razorpay/${razorpayOrderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.Error || `Failed to fetch order`);
    }

    console.log('✅ Order details fetched:', data);
    return {
      success: true,
      ...data
    };
  } catch (error) {
    console.error('❌ Error in getPaymentOrderByRazorpayId:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * List user's payment orders
 * @param {number} userId - User ID
 * @returns {Promise<Object>} List of orders
 */
export const listUserOrders = async (userId) => {
  try {
    console.log('🔄 Fetching orders for user ID:', userId);

    const response = await fetch(`${API_BASE_URL}/api/payment/orders/user/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.Error || `Failed to fetch user orders`);
    }

    console.log('✅ User orders fetched:', data.length, 'orders');
    return {
      success: true,
      orders: data
    };
  } catch (error) {
    console.error('❌ Error in listUserOrders:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Validate address data before submission
 * @param {Object} addressData - Address fields
 * @returns {Object} Validation result
 */
export const validateAddress = (addressData) => {
  const errors = {};

  // Validate required fields
  if (!addressData.address_line1 || !addressData.address_line1.trim()) {
    errors.address_line1 = 'Address Line 1 is required';
  } else if (addressData.address_line1.length > 200) {
    errors.address_line1 = 'Address Line 1 must be max 200 characters';
  }

  if (addressData.address_line2 && addressData.address_line2.length > 200) {
    errors.address_line2 = 'Address Line 2 must be max 200 characters';
  }

  if (!addressData.city || !addressData.city.trim()) {
    errors.city = 'City is required';
  } else if (addressData.city.length > 100) {
    errors.city = 'City must be max 100 characters';
  }

  if (!addressData.state) {
    errors.state = 'State is required';
  } else if (!VALID_INDIAN_STATES.includes(addressData.state)) {
    errors.state = 'Invalid state selection';
  }

  if (!addressData.pincode || !addressData.pincode.trim()) {
    errors.pincode = 'Pincode is required';
  } else if (!/^\d{6}$/.test(addressData.pincode)) {
    errors.pincode = 'Pincode must be exactly 6 digits';
  }

  if (addressData.country && addressData.country.length > 50) {
    errors.country = 'Country must be max 50 characters';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Get list of valid Indian states
 * @returns {Array<string>} List of states
 */
export const getValidIndianStates = () => {
  return [...VALID_INDIAN_STATES];
};