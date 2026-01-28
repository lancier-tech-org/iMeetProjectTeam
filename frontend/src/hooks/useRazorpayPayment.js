/**
 * useRazorpayPayment Hook - UPDATED
 * Custom hook for managing Razorpay payment integration
 * Handles payment processing, verification, and error states
 */

import { useState, useEffect, useCallback } from 'react';
import * as paymentService from '../services/paymentService';

/**
 * Hook for managing Razorpay payment flow
 * @param {Function} onSuccess - Callback when payment succeeds
 * @param {Function} onError - Callback when error occurs
 * @returns {Object} Hook state and methods
 */
export const useRazorpayPayment = (onSuccess = null, onError = null) => {
  const [processing, setProcessing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [dismissedByUser, setDismissedByUser] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [razorpayScriptLoaded, setRazorpayScriptLoaded] = useState(false);

  /**
   * Load Razorpay script on component mount
   */
  useEffect(() => {
    const loadScript = async () => {
      try {
        if (window.Razorpay) {
          console.log('✅ Razorpay already loaded');
          setRazorpayScriptLoaded(true);
          return;
        }

        console.log('🔄 Loading Razorpay script...');
        await paymentService.loadRazorpayScript();
        setRazorpayScriptLoaded(true);
        console.log('✅ Razorpay script loaded');
      } catch (err) {
        console.error('❌ Failed to load Razorpay:', err);
        setError('Failed to load payment gateway. Please refresh the page.');
        if (onError) {
          onError('Failed to load payment gateway');
        }
      }
    };

    loadScript();
  }, [onError]);

  /**
   * Open Razorpay payment checkout
   * @param {Object} options - Payment options
   * @returns {Promise<void>}
   */
  const openPayment = useCallback(async (options) => {
    try {
      // Reset previous state
      setError(null);
      setSuccess(false);
      setDismissedByUser(false);
      setProcessing(true);

      console.log('🔄 useRazorpayPayment: Opening payment...');
      console.log('💳 Payment options:', {
        orderId: options.razorpayOrderId,
        amount: options.amount,
        planName: options.planDetails?.Plan_Name
      });

      // Check if Razorpay script is loaded
      if (!razorpayScriptLoaded || !window.Razorpay) {
        throw new Error('Payment gateway not loaded. Please refresh the page.');
      }

      // Validate required options
      if (!options.razorpayOrderId) {
        throw new Error('Order ID is required');
      }
      if (!options.razorpayKeyId) {
        throw new Error('Razorpay Key ID is required');
      }
      if (!options.amount) {
        throw new Error('Amount is required');
      }

      // Open Razorpay checkout
      const paymentResponse = await paymentService.openRazorpayCheckout({
        razorpayKeyId: options.razorpayKeyId,
        razorpayOrderId: options.razorpayOrderId,
        amount: options.amount,
        currency: options.currency || 'INR',
        prefillData: options.prefillData || {},
        planDetails: options.planDetails || null,
      });

      console.log('📥 Payment response received:', paymentResponse);

      // Handle payment dismissal
      if (paymentResponse.dismissed) {
        console.log('⚠️ Payment dismissed by user');
        setDismissedByUser(true);
        setError('Payment cancelled');
        setProcessing(false);
        return;
      }

      // Handle payment failure
      if (!paymentResponse.success) {
        console.error('❌ Payment failed:', paymentResponse);
        
        // Record failed payment
        await paymentService.recordFailedPayment(paymentResponse);
        
        const errorMsg = paymentResponse.error_description || 
                        paymentResponse.error_reason || 
                        'Payment failed';
        setError(errorMsg);
        setProcessing(false);
        
        if (onError) {
          onError(errorMsg);
        }
        return;
      }

      // Payment successful - verify signature
      console.log('✅ Payment completed. Verifying...');
      setProcessing(false);
      setVerifying(true);

      const verificationResult = await paymentService.verifyPaymentSignature({
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature,
      });

      console.log('📥 Verification result:', verificationResult);

      if (!verificationResult.success) {
        const verifyError = verificationResult.error || 'Payment verification failed';
        console.error('❌ Verification failed:', verifyError);
        setError(verifyError);
        setVerifying(false);
        
        if (onError) {
          onError(verifyError);
        }
        return;
      }

      // Payment verified successfully
      console.log('✅ Payment verified successfully');
      setPaymentData(verificationResult);
      setSuccess(true);
      setVerifying(false);

      if (onSuccess) {
        onSuccess(verificationResult);
      }

    } catch (err) {
      const errorMessage = err.message || 'Payment processing error';
      console.error('❌ useRazorpayPayment: Error -', errorMessage);
      
      setError(errorMessage);
      setProcessing(false);
      setVerifying(false);
      
      if (onError) {
        onError(errorMessage);
      }
    }
  }, [razorpayScriptLoaded, onSuccess, onError]);

  /**
   * Retry payment with existing order
   * @param {Object} options - Payment options
   * @returns {Promise<void>}
   */
  const retryPayment = useCallback(async (options) => {
    console.log('🔁 useRazorpayPayment: Retrying payment...');
    
    // Reset error state
    setError(null);
    setDismissedByUser(false);
    
    return openPayment(options);
  }, [openPayment]);

  /**
   * Reset hook state
   */
  const resetPayment = useCallback(() => {
    setProcessing(false);
    setVerifying(false);
    setError(null);
    setSuccess(false);
    setDismissedByUser(false);
    setPaymentData(null);
  }, []);

  return {
    // State
    processing,
    verifying,
    error,
    success,
    dismissedByUser,
    paymentData,
    razorpayScriptLoaded,

    // Methods
    openPayment,
    retryPayment,
    resetPayment,
  };
};

export default useRazorpayPayment;