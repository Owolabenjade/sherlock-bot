// src/controllers/paymentController.js - Handles payment webhook requests

const crypto = require('crypto');
const { updateUserSession, getUserSession } = require('../services/firestoreService');
const { sendWhatsAppMessage } = require('../services/twilioService');
const logger = require('../utils/logger');

/**
 * Handle Paystack payment webhook
 */
exports.paymentWebhook = async (req, res) => {
  // Validate webhook signature
  const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  if (hash !== req.headers['x-paystack-signature']) {
    logger.error('Invalid Paystack webhook signature');
    return res.status(400).send('Invalid signature');
  }

  try {
    // Get event data
    const event = req.body;
    
    // Process different event types
    switch (event.event) {
      case 'charge.success':
        await handleSuccessfulPayment(event.data);
        break;
      
      case 'transfer.success':
        // Additional handling if needed
        logger.info('Transfer successful');
        break;
      
      default:
        logger.info(`Unhandled event type: ${event.event}`);
    }

    res.status(200).send({ received: true });
  } catch (err) {
    logger.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

/**
 * Handle successful payment completion
 */
async function handleSuccessfulPayment(data) {
  // Extract customer phone number from metadata
  const metadata = data.metadata || {};
  const phoneNumber = metadata.phone_number;
  
  if (!phoneNumber) {
    logger.error('No phone number found in payment metadata');
    return;
  }

  try {
    // Update user session in Firestore
    const userSession = await getUserSession(phoneNumber);
    userSession.paymentStatus = 'completed';
    
    // If they've already uploaded a CV in basic flow and now paid for advanced
    if (userSession.cvFile) {
      userSession.state = 'processing';
      userSession.reviewType = 'advanced';
      
      // Notify user that advanced processing will begin
      await sendWhatsAppMessage(
        phoneNumber,
        "Thank you for your payment! I will now process your CV for an advanced review. This will take just a moment..."
      );
    } else {
      userSession.state = 'upload_cv';
      userSession.reviewType = 'advanced';
      
      // Notify user that they can now upload their CV
      await sendWhatsAppMessage(
        phoneNumber,
        "Thank you for your payment! Please upload your CV (PDF or DOCX, max 5MB) to receive your advanced review."
      );
    }
    
    // Add payment details to user session
    userSession.paymentReference = data.reference;
    userSession.paymentAmount = data.amount / 100; // Convert kobo to naira
    userSession.paymentCurrency = data.currency;
    userSession.paymentDate = new Date().toISOString();
    
    await updateUserSession(phoneNumber, userSession);
    logger.info(`Payment completed and session updated for ${phoneNumber}`);
  } catch (error) {
    logger.error('Error updating session after payment:', error);
  }
}

/**
 * Create a payment link for a user
 */
exports.createPaymentLink = async (phoneNumber, reviewType = 'advanced') => {
  try {
    // Clean the phone number for use in metadata
    const cleanPhone = phoneNumber.replace('whatsapp:', '');
    
    // Get price from environment
    const amount = parseInt(process.env.ADVANCED_REVIEW_PRICE || '5000'); // Amount in kobo (e.g., 5000 kobo = ₦50.00)
    const currency = process.env.PAYMENT_CURRENCY || 'NGN';
    
    // Create a Paystack initialization
    const paystack = require('paystack')(process.env.PAYSTACK_SECRET_KEY);
    const response = await paystack.transaction.initialize({
      amount: amount,
      email: `${cleanPhone.replace(/\+/g, '')}@temporary.email`, // Paystack requires an email
      currency: currency,
      reference: `cvreview_${Date.now()}_${cleanPhone.replace(/\+/g, '')}`,
      callback_url: process.env.PAYMENT_SUCCESS_URL || 'https://example.com/success',
      metadata: {
        phone_number: cleanPhone,
        review_type: reviewType
      }
    });
    
    if (!response.status) {
      throw new Error(response.message || 'Failed to create payment link');
    }
    
    logger.info(`Created Paystack payment link for ${phoneNumber}: ${response.data.authorization_url}`);
    return response.data.authorization_url;
  } catch (error) {
    logger.error(`Error creating payment link for ${phoneNumber}:`, error);
    // Return fallback URL for development/MVP
    return 'https://example.com/payment-link';
  }
};