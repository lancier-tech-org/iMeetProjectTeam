// src/utils/phoneValidation.js
// Phone validation utility - MATCHES BACKEND LOGIC EXACTLY

/**
 * Phone validation rules - SAME AS BACKEND
 * Each country has specific rules for mobile numbers
 */
export const PHONE_VALIDATION_RULES = {
  '+1': {
    name: 'United States',
    length: [10],
    regex: /^[2-9]\d{2}[2-9]\d{6}$/,
    startsWith: '2-9',
    error: 'US number must be 10 digits. Area code cannot start with 0 or 1.',
    example: '2025551234',
    placeholder: 'Enter 10 digits (e.g., 2025551234)'
  },
  '+91': {
    name: 'India',
    length: [10],
    regex: /^[6-9]\d{9}$/,
    startsWith: '6, 7, 8, 9',
    error: 'Indian mobile must be 10 digits starting with 6, 7, 8, or 9.',
    example: '9876543210',
    placeholder: 'Enter 10 digits (e.g., 9876543210)'
  },
  '+44': {
    name: 'United Kingdom',
    length: [10],
    regex: /^7\d{9}$/,
    startsWith: '7',
    error: 'UK mobile must be 10 digits starting with 7.',
    example: '7911123456',
    placeholder: 'Enter 10 digits (e.g., 7911123456)'
  },
  '+86': {
    name: 'China',
    length: [11],
    regex: /^1[3-9]\d{9}$/,
    startsWith: '13-19',
    error: 'Chinese mobile must be 11 digits starting with 13-19.',
    example: '13812345678',
    placeholder: 'Enter 11 digits (e.g., 13812345678)'
  },
  '+49': {
    name: 'Germany',
    length: [10, 11],
    regex: /^1[567]\d{8,9}$/,
    startsWith: '15, 16, 17',
    error: 'German mobile must be 10-11 digits starting with 15, 16, or 17.',
    example: '15112345678',
    placeholder: 'Enter 10-11 digits (e.g., 15112345678)'
  },
  '+33': {
    name: 'France',
    length: [9],
    regex: /^[67]\d{8}$/,
    startsWith: '6, 7',
    error: 'French mobile must be 9 digits starting with 6 or 7.',
    example: '612345678',
    placeholder: 'Enter 9 digits (e.g., 612345678)'
  },
  '+81': {
    name: 'Japan',
    length: [10],
    regex: /^[789]0\d{8}$/,
    startsWith: '70, 80, 90',
    error: 'Japanese mobile must be 10 digits starting with 70, 80, or 90.',
    example: '9012345678',
    placeholder: 'Enter 10 digits (e.g., 9012345678)'
  },
  '+7': {
    name: 'Russia',
    length: [10],
    regex: /^9\d{9}$/,
    startsWith: '9',
    error: 'Russian mobile must be 10 digits starting with 9.',
    example: '9123456789',
    placeholder: 'Enter 10 digits (e.g., 9123456789)'
  },
  '+39': {
    name: 'Italy',
    length: [10],
    regex: /^3\d{9}$/,
    startsWith: '3',
    error: 'Italian mobile must be 10 digits starting with 3.',
    example: '3123456789',
    placeholder: 'Enter 10 digits (e.g., 3123456789)'
  },
  '+34': {
    name: 'Spain',
    length: [9],
    regex: /^[67]\d{8}$/,
    startsWith: '6, 7',
    error: 'Spanish mobile must be 9 digits starting with 6 or 7.',
    example: '612345678',
    placeholder: 'Enter 9 digits (e.g., 612345678)'
  }
};

/**
 * Get validation rules for a country
 */
export const getCountryRules = (countryCode) => {
  return PHONE_VALIDATION_RULES[countryCode] || null;
};

/**
 * Get placeholder text for phone input
 */
export const getPhonePlaceholder = (countryCode) => {
  const rules = PHONE_VALIDATION_RULES[countryCode];
  return rules ? rules.placeholder : 'Enter phone number';
};

/**
 * Get expected length string for display
 */
export const getExpectedLength = (countryCode) => {
  const rules = PHONE_VALIDATION_RULES[countryCode];
  if (!rules) return '8-15 digits';
  
  const lengths = rules.length;
  return lengths.length > 1 ? `${Math.min(...lengths)}-${Math.max(...lengths)}` : `${lengths[0]}`;
};

/**
 * Validate phone number - FINAL VALIDATION (matches backend exactly)
 * Use this for form submission
 * 
 * @param {string} phoneNumber - Phone number input
 * @param {string} countryCode - Country code (e.g., '+91')
 * @returns {object} - { isValid, error, sanitized }
 */
export const validatePhoneNumber = (phoneNumber, countryCode) => {
  // Empty is valid (phone is optional)
  if (!phoneNumber || !phoneNumber.trim()) {
    return { isValid: true, error: '', sanitized: '' };
  }
  
  // Remove all non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  
  // Get rules for country
  const rules = PHONE_VALIDATION_RULES[countryCode];
  
  // Fallback for unknown country
  if (!rules) {
    if (digitsOnly.length < 8) {
      return { isValid: false, error: 'Phone number must be at least 8 digits', sanitized: digitsOnly };
    }
    if (digitsOnly.length > 15) {
      return { isValid: false, error: 'Phone number must not exceed 15 digits', sanitized: digitsOnly };
    }
    return { isValid: true, error: '', sanitized: digitsOnly };
  }
  
  const minLength = Math.min(...rules.length);
  const maxLength = Math.max(...rules.length);
  
  // Check length
  if (digitsOnly.length < minLength) {
    return { 
      isValid: false, 
      error: `Too short. Need ${minLength} digits. ${rules.error}`, 
      sanitized: digitsOnly 
    };
  }
  
  if (digitsOnly.length > maxLength) {
    return { 
      isValid: false, 
      error: `Too long. Maximum ${maxLength} digits. ${rules.error}`, 
      sanitized: digitsOnly 
    };
  }
  
  // Check format with regex
  if (!rules.regex.test(digitsOnly)) {
    return { 
      isValid: false, 
      error: `Invalid format. ${rules.error}`, 
      sanitized: digitsOnly 
    };
  }
  
  return { isValid: true, error: '', sanitized: digitsOnly };
};

/**
 * REAL-TIME VALIDATION - Use this while user is typing
 * Shows helpful hints and warnings immediately
 * 
 * @param {string} phoneNumber - Current input value
 * @param {string} countryCode - Country code
 * @returns {object} - { status, message, color }
 *   status: 'empty' | 'typing' | 'warning' | 'error' | 'valid'
 */
export const validatePhoneRealTime = (phoneNumber, countryCode) => {
  // Empty input
  if (!phoneNumber || !phoneNumber.trim()) {
    return { 
      status: 'empty', 
      message: '', 
      color: 'default' 
    };
  }
  
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  const rules = PHONE_VALIDATION_RULES[countryCode];
  
  // Unknown country - basic validation
  if (!rules) {
    if (digitsOnly.length < 8) {
      return { 
        status: 'typing', 
        message: `Enter at least 8 digits (${digitsOnly.length}/8)`, 
        color: 'info' 
      };
    }
    if (digitsOnly.length > 15) {
      return { 
        status: 'error', 
        message: 'Maximum 15 digits allowed', 
        color: 'error' 
      };
    }
    return { 
      status: 'valid', 
      message: '✓ Valid phone number', 
      color: 'success' 
    };
  }
  
  const minLength = Math.min(...rules.length);
  const maxLength = Math.max(...rules.length);
  const expectedLength = rules.length.length > 1 
    ? `${minLength}-${maxLength}` 
    : `${minLength}`;
  
  // Check if first digit(s) are wrong - IMMEDIATE WARNING
  if (digitsOnly.length >= 1) {
    const firstDigitValid = checkFirstDigit(digitsOnly, countryCode);
    if (!firstDigitValid.isValid) {
      return {
        status: 'error',
        message: `⚠ ${firstDigitValid.message}`,
        color: 'error'
      };
    }
  }
  
  // Still typing - show progress
  if (digitsOnly.length < minLength) {
    return {
      status: 'typing',
      message: `Enter ${expectedLength} digits (${digitsOnly.length}/${minLength})`,
      color: 'info'
    };
  }
  
  // Too many digits
  if (digitsOnly.length > maxLength) {
    return {
      status: 'error',
      message: `⚠ Too many digits. Maximum ${maxLength} for ${rules.name}`,
      color: 'error'
    };
  }
  
  // Correct length - do final validation
  if (!rules.regex.test(digitsOnly)) {
    return {
      status: 'error',
      message: `⚠ Invalid format. ${rules.error}`,
      color: 'error'
    };
  }
  
  // All valid!
  return {
    status: 'valid',
    message: `✓ Valid ${rules.name} number`,
    color: 'success'
  };
};

/**
 * Check if first digit(s) are valid for the country
 * This gives IMMEDIATE feedback when user starts typing wrong digit
 */
const checkFirstDigit = (digits, countryCode) => {
  if (!digits || digits.length === 0) {
    return { isValid: true, message: '' };
  }
  
  const firstDigit = digits[0];
  const firstTwo = digits.substring(0, 2);
  
  switch (countryCode) {
    case '+91': // India: must start with 6, 7, 8, 9
      if (!['6', '7', '8', '9'].includes(firstDigit)) {
        return { 
          isValid: false, 
          message: `Indian numbers must start with 6, 7, 8, or 9 (not ${firstDigit})` 
        };
      }
      break;
      
    case '+1': // USA: area code can't start with 0 or 1
      if (['0', '1'].includes(firstDigit)) {
        return { 
          isValid: false, 
          message: `US area code cannot start with 0 or 1` 
        };
      }
      break;
      
    case '+44': // UK: mobile must start with 7
      if (firstDigit !== '7') {
        return { 
          isValid: false, 
          message: `UK mobile numbers must start with 7 (not ${firstDigit})` 
        };
      }
      break;
      
    case '+86': // China: must start with 1, second digit 3-9
      if (firstDigit !== '1') {
        return { 
          isValid: false, 
          message: `Chinese numbers must start with 1 (not ${firstDigit})` 
        };
      }
      if (digits.length >= 2 && !['3','4','5','6','7','8','9'].includes(digits[1])) {
        return { 
          isValid: false, 
          message: `Chinese numbers must start with 13-19 (not ${firstTwo})` 
        };
      }
      break;
      
    case '+49': // Germany: must start with 15, 16, or 17
      if (firstDigit !== '1') {
        return { 
          isValid: false, 
          message: `German mobile must start with 15, 16, or 17` 
        };
      }
      if (digits.length >= 2 && !['5', '6', '7'].includes(digits[1])) {
        return { 
          isValid: false, 
          message: `German mobile must start with 15, 16, or 17 (not ${firstTwo})` 
        };
      }
      break;
      
    case '+33': // France: must start with 6 or 7
      if (!['6', '7'].includes(firstDigit)) {
        return { 
          isValid: false, 
          message: `French mobile must start with 6 or 7 (not ${firstDigit})` 
        };
      }
      break;
      
    case '+81': // Japan: must start with 70, 80, or 90
      if (!['7', '8', '9'].includes(firstDigit)) {
        return { 
          isValid: false, 
          message: `Japanese mobile must start with 70, 80, or 90` 
        };
      }
      if (digits.length >= 2 && digits[1] !== '0') {
        return { 
          isValid: false, 
          message: `Japanese mobile must start with 70, 80, or 90 (not ${firstTwo})` 
        };
      }
      break;
      
    case '+7': // Russia: must start with 9
      if (firstDigit !== '9') {
        return { 
          isValid: false, 
          message: `Russian mobile must start with 9 (not ${firstDigit})` 
        };
      }
      break;
      
    case '+39': // Italy: must start with 3
      if (firstDigit !== '3') {
        return { 
          isValid: false, 
          message: `Italian mobile must start with 3 (not ${firstDigit})` 
        };
      }
      break;
      
    case '+34': // Spain: must start with 6 or 7
      if (!['6', '7'].includes(firstDigit)) {
        return { 
          isValid: false, 
          message: `Spanish mobile must start with 6 or 7 (not ${firstDigit})` 
        };
      }
      break;
  }
  
  return { isValid: true, message: '' };
};

/**
 * Format phone number for display
 */
export const formatPhoneDisplay = (digits, countryCode) => {
  if (!digits) return '';
  
  switch (countryCode) {
    case '+1': // USA: (XXX) XXX-XXXX
      if (digits.length >= 10) {
        return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,10)}`;
      }
      break;
    case '+91': // India: XXXXX XXXXX
      if (digits.length >= 10) {
        return `${digits.slice(0,5)} ${digits.slice(5,10)}`;
      }
      break;
    case '+44': // UK: XXXX XXXXXX
      if (digits.length >= 10) {
        return `${digits.slice(0,4)} ${digits.slice(4,10)}`;
      }
      break;
    case '+86': // China: XXX XXXX XXXX
      if (digits.length >= 11) {
        return `${digits.slice(0,3)} ${digits.slice(3,7)} ${digits.slice(7,11)}`;
      }
      break;
    default:
      return digits;
  }
  
  return digits;
};

export default {
  PHONE_VALIDATION_RULES,
  validatePhoneNumber,
  validatePhoneRealTime,
  getPhonePlaceholder,
  getExpectedLength,
  getCountryRules,
  formatPhoneDisplay
};