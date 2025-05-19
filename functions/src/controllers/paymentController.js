// src/controllers/paymentController.js - Handles payment webhook requests

const stripe = require('stripe')(process.env.STRIPE_API_KEY);
const { updateUserSession, getUserSession } = require('../services/firestoreService');
const { sendWhatsAppMessage } = require('../services/twilioService');
const logger = require('../utils/logger');

/**
 * Handle Stripe payment webhook
 */
exports.paymentWebhook = async (req, res) => {
  const signature = req.headers['stripe-signature'];
  let event;

  try {
    // Verify webhook signature
    if (process.env.STRIPE_WEBHOOK_SECRET !== 'test_mode') {
      event = stripe.webhooks.constructEvent(
        req.rawBody, // Important: need to use raw body here, configure Express accordingly
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } else {
      // For development/testing
      event = req.body;
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleSuccessfulPayment(event.data.object);
        break;
      
      case 'payment_intent.succeeded':
        // Additional handling if needed
        logger.info('Payment intent succeeded');
        break;
      
      default:
        logger.info(`Unhandled event type: ${event.type}`);
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
async function handleSuccessfulPayment(session) {
  // Extract customer phone number from metadata
  const phoneNumber = session.metadata ? session.metadata.phone_number : null;
  
  if (!phoneNumber) {
    logger.error('No phone number found in payment session metadata');
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
        "Thank you for your payment! I'll now process your CV for an advanced review. This will take just a moment..."
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
    // Create a Stripe Checkout Session
    const priceId = process.env.STRIPE_PRICE_ID;
    
    const session = await stripe.checkout.Session.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: process.env.PAYMENT_SUCCESS_URL,
      cancel_url: process.env.PAYMENT_CANCEL_URL,
      metadata: {
        phone_number: phoneNumber,
        review_type: reviewType
      }
    });
    
    return session.url;
  } catch (error) {
    logger.error('Error creating payment link:', error);
    // Return fallback URL for development/MVP
    return 'https://example.com/payment-link';
  }
};