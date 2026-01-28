/**
 * useOrderCreation Hook
 * Custom hook for managing payment order creation state
 * Handles loading, errors, and order data
 */

import { useState } from 'react';
import * as orderService from '../services/orderService';

/**
 * Hook for managing order creation
 * @param {Function} onError - Callback when error occurs (optional)
 * @returns {Object} Hook state and methods
 */
export const useOrderCreation = (onError = null) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  /**
   * Create payment order
   * @param {Object} orderPayload - Order details
   * @returns {Promise<Object>} Order creation result
   */
  const createOrder = async (orderPayload) => {
    try {
      // Reset previous error
      setError(null);
      setLoading(true);

      console.log('🚀 useOrderCreation: Creating order...');

      // Validate payload
      if (!orderPayload.user_id) {
        throw new Error('User ID is required');
      }
      if (!orderPayload.plan_id) {
        throw new Error('Plan ID is required');
      }
      if (!orderPayload.email) {
        throw new Error('Email is required');
      }

      // Call order service
      const result = await orderService.createPaymentOrder(orderPayload);

      if (!result.success) {
        throw new Error(result.error || 'Failed to create order');
      }

      // Store order data
      setOrderData(result);
      setRetryCount(0);

      console.log('✅ useOrderCreation: Order created successfully');

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Unknown error occurred';
      console.error('❌ useOrderCreation: Error -', errorMessage);

      setError(errorMessage);

      // Call error callback if provided
      if (onError) {
        onError(errorMessage);
      }

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Retry order creation
   * @param {Object} orderPayload - Order details
   * @returns {Promise<Object>} Order creation result
   */
  const retryOrder = async (orderPayload) => {
    console.log(`🔁 useOrderCreation: Retrying order (attempt ${retryCount + 1})...`);

    setRetryCount(prev => prev + 1);

    // Maximum 3 retries
    if (retryCount >= 2) {
      const limitError = 'Maximum retry attempts exceeded. Please try again later.';
      setError(limitError);
      return { success: false, error: limitError };
    }

    return createOrder(orderPayload);
  };

  /**
   * Reset hook state
   */
  const reset = () => {
    setLoading(false);
    setError(null);
    setOrderData(null);
    setRetryCount(0);
  };

  return {
    // State
    loading,
    error,
    orderData,
    retryCount,

    // Methods
    createOrder,
    retryOrder,
    reset,
  };
};

export default useOrderCreation;