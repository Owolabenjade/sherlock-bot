// src/controllers/webhookController.js - Handles Twilio webhook requests

const { MessagingResponse } = require('twilio').twiml;
const { getUserSession, updateUserSession } = require('../services/firestoreService');
const { processBasicReview, processAdvancedReview } = require('../services/cvService');
const { downloadFileFromUrl, uploadFileToStorage } = require('../services/storageService');
const { createPaymentLink } = require('../services/stripeService');
const { sendWhatsAppMessage } = require('../services/twilioService');
const logger = require('../utils/logger');

/**
 * Handles incoming WhatsApp webhook requests from Twilio
 */
exports.webhookHandler = async (req, res) => {
  try {
    // Get message data from Twilio
    const incomingMsg = req.body.Body ? req.body.Body.trim().toLowerCase() : '';
    const senderPhoneNumber = req.body.From || '';
    const mediaContentType = req.body.MediaContentType0 || '';
    const mediaUrl = req.body.MediaUrl0 || '';
    
    // Initialize TwiML response
    const twiml = new MessagingResponse();
    
    // Get or create user session
    const session = await getUserSession(senderPhoneNumber);
    let responseMessage = '';
    
    // Process message based on the current state
    if (isGreeting(incomingMsg)) {
      // Welcome message
      session.state = 'choose_review_type';
      responseMessage = "Would you like a Basic (free) or Advanced (paid) review?";
    } 
    else if (session.state === 'choose_review_type') {
      if (incomingMsg.includes('basic')) {
        session.reviewType = 'basic';
        session.state = 'upload_cv';
        responseMessage = "Please upload your CV (PDF or DOCX, max 5MB). Your CV will be temporarily stored for review and securely deleted within 24 hours.";
      } 
      else if (incomingMsg.includes('advanced')) {
        session.reviewType = 'advanced';
        session.state = 'payment';
        const paymentLink = await createPaymentLink(senderPhoneNumber);
        responseMessage = `To proceed with an Advanced review, please complete the payment via this link: ${paymentLink}`;
      } 
      else {
        responseMessage = "I didn't understand that. Please type 'Basic' for a free review or 'Advanced' for a paid review.";
      }
    } 
    else if (session.state === 'payment') {
      if (incomingMsg.includes('paid') || incomingMsg.includes('done') || incomingMsg.includes('completed')) {
        // In production, verify payment via webhook instead of relying on user confirmation
        session.paymentStatus = 'completed';
        session.state = 'upload_cv';
        responseMessage = "Thanks for your payment! Please upload your CV (PDF or DOCX, max 5MB). Your CV will be temporarily stored for review and securely deleted within 24 hours.";
      } 
      else {
        responseMessage = "Please complete the payment to proceed. Let me know when you've completed the payment.";
      }
    } 
    else if (session.state === 'upload_cv') {
      if (mediaUrl && (mediaContentType.includes('application/pdf') || mediaContentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document'))) {
        // Download the file from Twilio
        try {
          // Tell user we're processing their file
          await sendWhatsAppMessage(senderPhoneNumber, "Thanks! I've received your CV and will process it shortly.");
          
          // Download and upload to Firebase Storage
          const downloadedFilePath = await downloadFileFromUrl(mediaUrl);
          const storagePath = await uploadFileToStorage(downloadedFilePath, senderPhoneNumber);
          
          // Update session with file info
          session.cvFile = storagePath;
          session.state = 'processing';
          
          // Process based on review type
          if (session.reviewType === 'basic') {
            const reviewResult = await processBasicReview(storagePath);
            
            if (reviewResult.success) {
              const insights = reviewResult.insights.map(insight => `• ${insight}`).join("\n\n");
              responseMessage = `Here's your basic CV review:\n\n${insights}\n\nWould you like to unlock deeper insights? Reply 'Advanced' to proceed to payment.`;
              session.state = 'upsell';
            } else {
              responseMessage = "Sorry, there was an error processing your CV. Please try again later.";
              session.state = 'new';
            }
          } 
          else if (session.reviewType === 'advanced') {
            // Send interim message as advanced processing may take longer
            await sendWhatsAppMessage(senderPhoneNumber, "I'm generating your in-depth CV review. This might take a few moments...");
            
            const reviewResult = await processAdvancedReview(storagePath);
            
            if (reviewResult.success) {
              const insights = reviewResult.insights.map(insight => `• ${insight}`).join("\n\n");
              const score = reviewResult.improvementScore || 'N/A';
              const downloadLink = reviewResult.downloadLink || '';
              
              responseMessage = `Here's your advanced CV review (Score: ${score}/100):\n\n${insights}\n\n${downloadLink ? `Download full report: ${downloadLink}` : ''}`;
              session.state = 'completed';
            } else {
              responseMessage = "Sorry, there was an error processing your CV. Please try again later.";
              session.state = 'new';
            }
          }
        } catch (error) {
          logger.error('Error processing uploaded file:', error);
          responseMessage = "Sorry, there was an error processing your file. Please try uploading it again.";
        }
      } 
      else if (mediaUrl) {
        responseMessage = "Sorry, I can only accept PDF or DOCX files. Please upload your CV in one of these formats.";
      } 
      else {
        responseMessage = "I'm waiting for your CV. Please upload a PDF or DOCX file (max 5MB).";
      }
    } 
    else if (session.state === 'upsell') {
      if (incomingMsg.includes('advanced') || incomingMsg.includes('yes')) {
        session.reviewType = 'advanced';
        session.state = 'payment';
        const paymentLink = await createPaymentLink(senderPhoneNumber);
        responseMessage = `Great! To proceed with an Advanced review, please complete the payment via this link: ${paymentLink}`;
      } 
      else {
        responseMessage = "Thank you for using our CV review service. Feel free to contact us anytime for a new review.";
        session.state = 'new';
      }
    } 
    else {
      // Default response for any other state or message
      responseMessage = "Hello! I'm Sherlock, your CV review assistant. Send 'Review CV' to get started.";
      session.state = 'new';
    }
    
    // Update user session in Firestore
    await updateUserSession(senderPhoneNumber, session);
    
    // Send response
    twiml.message(responseMessage);
    res.writeHead(200, {'Content-Type': 'text/xml'});
    res.end(twiml.toString());
  } 
  catch (error) {
    logger.error('Error in webhook handler:', error);
    res.status(500).send('Server error');
  }
};

/**
 * Check if a message is a greeting to start the flow
 */
function isGreeting(message) {
  const greetings = ['hi', 'hello', 'cv review', 'review cv', 'hi sherlock'];
  return greetings.some(greeting => message.includes(greeting));
}