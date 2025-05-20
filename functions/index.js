// index.js - Main entry point for Firebase Cloud Functions

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const { webhookHandler } = require('./src/controllers/webhookController');
const { paymentWebhook } = require('./src/controllers/paymentController');
const { cleanupOldFiles } = require('./src/controllers/cleanupController');
const { verifyPayment } = require('./src/services/paystackService');
const { updateUserSession } = require('./src/services/firestoreService');

// Initialize Firebase Admin
admin.initializeApp();

// Express app for the API
const app = express();
app.use(cors({ origin: true }));

// Middleware to authenticate admin requests
const authenticateAdmin = async (req, res, next) => {
  try {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
      return res.status(401).send({ error: 'Unauthorized: No token provided' });
    }
    
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Check if user has admin custom claim
    if (!decodedToken.admin) {
      return res.status(403).send({ error: 'Forbidden: Not an admin user' });
    }
    
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error authenticating admin:', error);
    res.status(401).send({ error: 'Unauthorized: Invalid token' });
  }
};

// Webhook endpoint for Twilio WhatsApp messages
app.post('/webhook', webhookHandler);

// Payment webhook for Paystack
app.post('/payment-webhook', paymentWebhook);

// Admin route to manually verify payments
app.post('/admin/verify-payment', authenticateAdmin, async (req, res) => {
  try {
    const { phoneNumber, reference } = req.body;
    
    if (!phoneNumber || !reference) {
      return res.status(400).send({ 
        success: false, 
        error: 'Phone number and payment reference are required' 
      });
    }
    
    // Verify with Paystack API directly
    const verification = await verifyPayment(reference);
    
    if (verification.success) {
      // Format phone number for consistency
      const formattedPhone = phoneNumber.startsWith('whatsapp:') 
        ? phoneNumber 
        : `whatsapp:${phoneNumber}`;
      
      // Update user session
      await updateUserSession(formattedPhone, {
        paymentStatus: 'completed',
        paymentReference: reference,
        paymentAmount: verification.amount,
        paymentCurrency: verification.currency,
        paymentDate: new Date().toISOString(),
        state: 'upload_cv',
        reviewType: 'advanced'
      });
      
      res.status(200).send({ 
        success: true, 
        message: 'Payment verified and user session updated' 
      });
    } else {
      res.status(400).send({ 
        success: false, 
        error: verification.error || 'Payment verification failed' 
      });
    }
  } catch (error) {
    console.error('Error in manual payment verification:', error);
    res.status(500).send({ 
      success: false, 
      error: 'Internal server error during payment verification' 
    });
  }
});

// Export the Express app as a Cloud Function
exports.api = functions.https.onRequest(app);

// Schedule file cleanup every 24 hours
exports.scheduledCleanup = functions.pubsub
  .schedule('every 24 hours')
  .onRun(cleanupOldFiles);

// Additional exports for specific functionalities if needed
exports.processCV = functions.storage
  .object()
  .onFinalize(async (object) => {
    // Process CV when uploaded to Firebase Storage
    const { processUploadedCV } = require('./src/services/cvService');
    await processUploadedCV(object);
  });