// index.js - Main entry point for Firebase Cloud Functions

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const { webhookHandler } = require('./src/controllers/webhookController');
const { paymentWebhook } = require('./src/controllers/paymentController');
const { cleanupOldFiles } = require('./src/controllers/cleanupController');

// Initialize Firebase Admin
admin.initializeApp();

// Express app for the API
const app = express();
app.use(cors({ origin: true }));

// Webhook endpoint for Twilio WhatsApp messages
app.post('/webhook', webhookHandler);

// Payment webhook for Stripe
app.post('/payment-webhook', paymentWebhook);

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