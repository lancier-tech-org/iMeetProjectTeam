/**
 * Payment Service Module
 * Handles Razorpay payment integration and verification
 * 
 * Location: src/services/paymentService.js
 */

const API_BASE_URL = 'https://api.lancieretech.com';

/**
 * Load Razorpay script from CDN
 * @returns {Promise<void>}
 */
export const loadRazorpayScript = async () => {
  return new Promise((resolve, reject) => {
    // Check if script is already loaded
    if (window.Razorpay) {
      console.log('✅ Razorpay script already loaded');
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;

    script.onload = () => {
      console.log('✅ Razorpay script loaded successfully');
      resolve();
    };

    script.onerror = () => {
      console.error('❌ Failed to load Razorpay script');
      reject(new Error('Failed to load Razorpay'));
    };

    document.body.appendChild(script);
  });
};

/**
 * Open Razorpay payment checkout
 * @param {Object} orderData - Order data from createPaymentOrder response
 * @returns {Promise<Object>} Payment response
 */
export const openRazorpayCheckout = async (orderData) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('🔄 Opening Razorpay checkout');
      console.log('Order Data:', orderData);

      if (!window.Razorpay) {
        throw new Error('Razorpay script not loaded');
      }

      const options = {
        key: orderData.razorpayKeyId,
        order_id: orderData.razorpayOrderId,
        amount: orderData.amount,
        currency: orderData.currency,
        description: orderData.planDetails ? 
          `${orderData.planDetails.Plan_Name} - ${orderData.planDetails.Billing_Period}` : 
          'Subscription Payment',

        // Prefill customer data
        prefill: {
          name: orderData.prefillData.name,
          email: orderData.prefillData.email,
          contact: orderData.prefillData.mobile_number,
        },

        // Payment success callback
        handler: (response) => {
          console.log('✅ Payment completed. Response:', response);
          resolve({
            success: true,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
        },

        // Payment error callback
        modal: {
          ondismiss: () => {
            console.log('❌ User closed payment popup');
            resolve({
              success: false,
              dismissed: true,
              message: 'Payment cancelled by user'
            });
          },
        },
      };

      const razorpay = new window.Razorpay(options);

      // Handle payment errors
      razorpay.on('payment.failed', (response) => {
        console.error('❌ Payment failed:', response);
        resolve({
          success: false,
          razorpay_order_id: response.error.metadata.order_id,
          razorpay_payment_id: response.error.metadata.payment_id,
          error_code: response.error.code,
          error_reason: response.error.reason,
          error_description: response.error.description,
        });
      });

      razorpay.open();
    } catch (error) {
      console.error('❌ Error opening Razorpay:', error.message);
      reject(error);
    }
  });
};

/**
 * Verify payment signature with backend
 * @param {Object} paymentData - Payment response from Razorpay
 * @returns {Promise<Object>} Verification response from backend
 */
export const verifyPaymentSignature = async (paymentData) => {
  try {
    console.log('🔄 Verifying payment signature');
    console.log('Payment Data:', paymentData);

    // Validate required fields
    if (!paymentData.razorpay_order_id || !paymentData.razorpay_payment_id || !paymentData.razorpay_signature) {
      throw new Error('Missing payment data fields');
    }

    const requestBody = {
      razorpay_order_id: paymentData.razorpay_order_id,
      razorpay_payment_id: paymentData.razorpay_payment_id,
      razorpay_signature: paymentData.razorpay_signature,
    };

    console.log('📤 Sending verification request to backend');

    const response = await fetch(`${API_BASE_URL}/api/payment/transaction/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📥 Response status:', response.status);

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Verification failed:', data);
      return {
        success: false,
        error: data.Error || 'Payment verification failed'
      };
    }

    console.log('✅ Payment verified successfully:', data);
    return {
      success: true,
      ...data
    };
  } catch (error) {
    console.error('❌ Error in verifyPaymentSignature:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Record failed payment in backend
 * @param {Object} failedPaymentData - Failed payment data
 * @returns {Promise<Object>} Response from backend
 */
export const recordFailedPayment = async (failedPaymentData) => {
  try {
    console.log('🔄 Recording failed payment');
    console.log('Failed Payment Data:', failedPaymentData);

    const requestBody = {
      razorpay_order_id: failedPaymentData.razorpay_order_id,
      razorpay_payment_id: failedPaymentData.razorpay_payment_id,
      error_code: failedPaymentData.error_code || 'UNKNOWN',
      error_reason: failedPaymentData.error_reason || 'Payment failed',
      error_description: failedPaymentData.error_description || 'Payment was not processed',
    };

    console.log('📤 Sending failed payment record to backend');

    const response = await fetch(`${API_BASE_URL}/api/payment/transaction/failed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.warn('⚠️ Failed to record failed payment:', data);
      return null;
    }

    console.log('✅ Failed payment recorded:', data);
    return data;
  } catch (error) {
    console.error('⚠️ Error recording failed payment:', error.message);
    return null;
  }
};