// functions/src/services/paystackService.js

const paystack = require('paystack')(process.env.PAYSTACK_SECRET_KEY);
const logger = require('../utils/logger');
const { updateUserSession } = require('./firestoreService');

/**
 * Create a payment link for advanced CV review
 * @param {string} phoneNumber - User's WhatsApp phone number
 * @returns {string} Payment link URL
 */
exports.createPaymentLink = async (phoneNumber, reviewType = 'advanced') => {
  try {
    // Clean the phone number for use in metadata
    const cleanPhone = phoneNumber.replace('whatsapp:', '');
    
    // Get price from environment
    const amount = parseInt(process.env.ADVANCED_REVIEW_PRICE || '5000'); // Amount in kobo (e.g., 5000 kobo = ₦50.00)
    const currency = process.env.PAYMENT_CURRENCY || 'NGN';
    
    // Get the success and cancel URLs - replace placeholder with actual URLs
    const successUrl = process.env.PAYMENT_SUCCESS_URL || 'https://your-domain.com/success.html';
    const cancelUrl = process.env.PAYMENT_CANCEL_URL || 'https://your-domain.com/cancel.html';
    
    // Create a Paystack initialization
    const response = await paystack.transaction.initialize({
      amount: amount,
      email: `${cleanPhone.replace(/\+/g, '')}@temporary.email`, // Paystack requires an email
      currency: currency,
      reference: `cvreview_${Date.now()}_${cleanPhone.replace(/\+/g, '')}`,
      callback_url: successUrl,
      metadata: {
        phone_number: cleanPhone,
        service: 'cv_advanced_review'
      }
    });
    
    if (!response.status) {
      throw new Error(response.message || 'Failed to create payment link');
    }
    
    logger.info(`Created Paystack payment link for ${phoneNumber}: ${response.data.authorization_url}`);
    return response.data.authorization_url;
  } catch (error) {
    logger.error(`Error creating Paystack payment link for ${phoneNumber}:`, error);
    return fallbackPaymentLink();
  }
};

/**
 * Generate a fallback payment link for development/testing
 * @returns {string} Fallback payment link
 */
function fallbackPaymentLink() {
  // For development or when Paystack is not configured
  const successUrl = process.env.PAYMENT_SUCCESS_URL || 'https://your-domain.com/success.html';
  return 'https://example.com/payment-link?redirect=' + encodeURIComponent(successUrl);
}

/**
 * Verify a payment transaction with Paystack
 * @param {string} reference - Paystack transaction reference
 * @returns {Object} Verification result with success status
 */
exports.verifyPayment = async (reference) => {
  try {
    if (!reference) {
      return { success: false, error: 'No payment reference provided' };
    }
    
    logger.info(`Verifying Paystack payment with reference: ${reference}`);
    
    const response = await paystack.transaction.verify(reference);
    
    if (!response.status) {
      return { 
        success: false, 
        error: response.message || 'Payment verification failed' 
      };
    }
    
    const data = response.data;
    
    // Check if payment is successful
    if (data.status !== 'success') {
      return { 
        success: false, 
        error: `Payment status is ${data.status}`, 
        paymentStatus: data.status 
      };
    }
    
    // Extract payment details
    const metadata = data.metadata || {};
    const phoneNumber = metadata.phone_number;
    
    // Return verification result
    return {
      success: true,
      reference: data.reference,
      phoneNumber,
      amount: data.amount / 100, // Convert kobo to naira
      currency: data.currency,
      paymentDate: new Date(data.paid_at).toISOString(),
      channel: data.channel // Card, bank, ussd, etc.
    };
  } catch (error) {
    logger.error(`Error verifying Paystack payment ${reference}:`, error);
    return { 
      success: false, 
      error: error.message || 'Error during payment verification' 
    };
  }
};

/**
 * Handle a successful payment webhook event
 * @param {Object} event - Paystack webhook event
 * @returns {boolean} Success status
 */
exports.handleSuccessfulPayment = async (data) => {
  try {
    // Paystack webhook event data
    const metadata = data.metadata || {};
    const phoneNumber = metadata.phone_number;
    
    if (!phoneNumber) {
      logger.error('No phone number in payment metadata:', data.reference);
      return false;
    }
    
    // Format phone number for consistency
    const formattedPhone = phoneNumber.startsWith('whatsapp:')
      ? phoneNumber
      : `whatsapp:${phoneNumber}`;
    
    // Update user session in Firestore
    const updateResult = await updateUserSession(formattedPhone, {
      paymentStatus: 'completed',
      paymentReference: data.reference,
      paymentAmount: data.amount / 100, // Convert kobo to naira
      paymentCurrency: data.currency,
      paymentDate: new Date().toISOString(),
      state: 'upload_cv', // Set the next state for the user
      reviewType: 'advanced' // Ensure review type is set
    });
    
    logger.info(`Payment recorded for ${phoneNumber}: ${data.reference}`);
    return updateResult;
  } catch (error) {
    logger.error('Error recording payment:', error);
    return false;
  }
};

/**
 * Generate a fallback payment link for development/testing
 * @returns {string} Fallback payment link
 */
function fallbackPaymentLink() {
  // For development or when Paystack is not configured
  return 'https://example.com/payment-link';
}