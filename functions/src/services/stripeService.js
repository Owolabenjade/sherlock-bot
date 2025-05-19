// src/services/stripeService.js - Stripe payment integration

const stripe = require('stripe')(process.env.STRIPE_API_KEY);
const logger = require('../utils/logger');
const { updateUserSession } = require('./firestoreService');

/**
 * Create a payment link for advanced CV review
 * @param {string} phoneNumber - User's WhatsApp phone number
 * @returns {string} Payment link URL
 */
exports.createPaymentLink = async (phoneNumber) => {
  try {
    // Clean the phone number for use in metadata
    const cleanPhone = phoneNumber.replace('whatsapp:', '');
    
    // Get price ID from environment
    const priceId = process.env.STRIPE_PRICE_ID;
    
    if (!priceId) {
      logger.error('STRIPE_PRICE_ID not configured in environment');
      return fallbackPaymentLink();
    }
    
    // Create a Checkout Session
    const session = await stripe.checkout.Session.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        }
      ],
      mode: 'payment',
      success_url: process.env.PAYMENT_SUCCESS_URL || 'https://example.com/success',
      cancel_url: process.env.PAYMENT_CANCEL_URL || 'https://example.com/cancel',
      metadata: {
        phone_number: cleanPhone,
        service: 'cv_advanced_review'
      }
    });
    
    logger.info(`Created payment link for ${phoneNumber}: ${session.url}`);
    return session.url;
  } catch (error) {
    logger.error(`Error creating payment link for ${phoneNumber}:`, error);
    return fallbackPaymentLink();
  }
};

/**
 * Verify a payment was completed
 * @param {string} sessionId - Stripe Checkout Session ID
 * @returns {Object} Payment verification result
 */
exports.verifyPayment = async (sessionId) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    const paymentStatus = session.payment_status;
    const phoneNumber = session.metadata?.phone_number;
    
    logger.info(`Payment verification for ${sessionId}: ${paymentStatus}`);
    
    return {
      success: paymentStatus === 'paid',
      phoneNumber,
      status: paymentStatus,
      amount: session.amount_total / 100, // Convert cents to dollars/main currency unit
      currency: session.currency
    };
  } catch (error) {
    logger.error(`Error verifying payment ${sessionId}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Handle a successful payment webhook event
 * @param {Object} session - Stripe Checkout Session
 * @returns {boolean} Success status
 */
exports.handleSuccessfulPayment = async (session) => {
  try {
    // Get phone number from metadata
    const phoneNumber = session.metadata?.phone_number;
    
    if (!phoneNumber) {
      logger.error('No phone number in session metadata:', session.id);
      return false;
    }
    
    // Format phone number for consistency
    const formattedPhone = phoneNumber.startsWith('whatsapp:')
      ? phoneNumber
      : `whatsapp:${phoneNumber}`;
    
    // Update user session in Firestore
    const updateResult = await updateUserSession(formattedPhone, {
      paymentStatus: 'completed',
      paymentSessionId: session.id,
      paymentAmount: session.amount_total / 100,
      paymentCurrency: session.currency,
      paymentDate: new Date().toISOString()
    });
    
    logger.info(`Payment recorded for ${phoneNumber}: ${session.id}`);
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
  // For development or when Stripe is not configured
  return 'https://example.com/payment-link';
}