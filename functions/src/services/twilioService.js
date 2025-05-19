// src/services/twilioService.js - Twilio API integration

const twilio = require('twilio');
const logger = require('../utils/logger');

// Initialize Twilio client
const twilioClient = new twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Send a WhatsApp message via Twilio
 * @param {string} to - Recipient's phone number
 * @param {string} body - Message body
 * @returns {Object} Message SID and status
 */
exports.sendWhatsAppMessage = async (to, body) => {
  try {
    // Ensure phone number is in the right format
    const recipient = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    
    // Send message via Twilio
    const message = await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
      body: body,
      to: recipient
    });
    
    logger.info(`Sent WhatsApp message to ${to} with SID: ${message.sid}`);
    
    return {
      success: true,
      sid: message.sid,
      status: message.status
    };
  } catch (error) {
    logger.error(`Error sending WhatsApp message to ${to}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send a WhatsApp message with a file attachment
 * @param {string} to - Recipient's phone number
 * @param {string} body - Message body
 * @param {string} mediaUrl - URL of media to send
 * @returns {Object} Message SID and status
 */
exports.sendWhatsAppMessageWithMedia = async (to, body, mediaUrl) => {
  try {
    // Ensure phone number is in the right format
    const recipient = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    
    // Send message with media via Twilio
    const message = await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
      body: body,
      mediaUrl: [mediaUrl],
      to: recipient
    });
    
    logger.info(`Sent WhatsApp message with media to ${to} with SID: ${message.sid}`);
    
    return {
      success: true,
      sid: message.sid,
      status: message.status
    };
  } catch (error) {
    logger.error(`Error sending WhatsApp message with media to ${to}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Validate that a webhook request is from Twilio
 * @param {Object} req - Express request object
 * @returns {boolean} Validation result
 */
exports.validateTwilioRequest = (req) => {
  // Skip validation in development/test mode
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return true;
  }
  
  try {
    const twilioSignature = req.headers['x-twilio-signature'];
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    
    // Validate the request is from Twilio
    const requestIsValid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN,
      twilioSignature,
      url,
      req.body
    );
    
    if (!requestIsValid) {
      logger.warn('Invalid Twilio request signature');
    }
    
    return requestIsValid;
  } catch (error) {
    logger.error('Error validating Twilio request:', error);
    return false;
  }
};

/**
 * Get message history for a phone number
 * @param {string} phoneNumber - Phone number to get history for
 * @param {number} limit - Maximum number of messages to return
 * @returns {Array} Message history
 */
exports.getMessageHistory = async (phoneNumber, limit = 10) => {
  try {
    // Format the phone number for Twilio
    const formattedNumber = phoneNumber.startsWith('whatsapp:') 
      ? phoneNumber 
      : `whatsapp:${phoneNumber}`;
    
    // Get messages
    const messages = await twilioClient.messages.list({
      to: formattedNumber,
      limit: limit
    });
    
    return messages.map(message => ({
      sid: message.sid,
      body: message.body,
      direction: message.direction,
      status: message.status,
      date: message.dateCreated
    }));
  } catch (error) {
    logger.error(`Error getting message history for ${phoneNumber}:`, error);
    return [];
  }
};