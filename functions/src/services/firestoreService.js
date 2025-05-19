// src/services/firestoreService.js - Firestore database operations

const admin = require('firebase-admin');
const logger = require('../utils/logger');
const db = admin.firestore();

// Collection references
const userSessionsCollection = db.collection('userSessions');
const reviewResultsCollection = db.collection('reviewResults');

/**
 * Get or create a user session from Firestore
 * @param {string} phoneNumber - The user's WhatsApp phone number
 * @returns {Object} The user session data
 */
exports.getUserSession = async (phoneNumber) => {
  try {
    const docRef = userSessionsCollection.doc(sanitizePhoneNumber(phoneNumber));
    const doc = await docRef.get();
    
    if (doc.exists) {
      return doc.data();
    } else {
      // Initialize a new session
      const newSession = {
        phoneNumber,
        state: 'new',
        reviewType: null,
        cvFile: null,
        paymentStatus: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await docRef.set(newSession);
      return newSession;
    }
  } catch (error) {
    logger.error(`Error getting user session for ${phoneNumber}:`, error);
    // Return a default session object if there's an error
    return {
      phoneNumber,
      state: 'new',
      reviewType: null,
      cvFile: null,
      paymentStatus: null
    };
  }
};

/**
 * Update a user session in Firestore
 * @param {string} phoneNumber - The user's WhatsApp phone number
 * @param {Object} sessionData - The updated session data
 * @returns {boolean} Success status
 */
exports.updateUserSession = async (phoneNumber, sessionData) => {
  try {
    const docRef = userSessionsCollection.doc(sanitizePhoneNumber(phoneNumber));
    
    // Add timestamp for update
    sessionData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    
    await docRef.update(sessionData);
    logger.info(`Updated session for ${phoneNumber}`);
    return true;
  } catch (error) {
    logger.error(`Error updating user session for ${phoneNumber}:`, error);
    return false;
  }
};

/**
 * Save review result to Firestore
 * @param {string} phoneNumber - The user's WhatsApp phone number
 * @param {Object} reviewData - The review data
 * @returns {string} The document ID of the saved review
 */
exports.saveReviewResult = async (phoneNumber, reviewData) => {
  try {
    // Add metadata
    const reviewToSave = {
      ...reviewData,
      phoneNumber,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await reviewResultsCollection.add(reviewToSave);
    logger.info(`Saved review result for ${phoneNumber} with ID: ${docRef.id}`);
    
    return docRef.id;
  } catch (error) {
    logger.error(`Error saving review result for ${phoneNumber}:`, error);
    throw error;
  }
};

/**
 * Get review result from Firestore
 * @param {string} reviewId - The review document ID
 * @returns {Object} The review data
 */
exports.getReviewResult = async (reviewId) => {
  try {
    const docRef = reviewResultsCollection.doc(reviewId);
    const doc = await docRef.get();
    
    if (doc.exists) {
      return doc.data();
    } else {
      logger.warn(`Review with ID ${reviewId} not found`);
      return null;
    }
  } catch (error) {
    logger.error(`Error getting review result ${reviewId}:`, error);
    throw error;
  }
};

/**
 * Get all reviews for a user
 * @param {string} phoneNumber - The user's WhatsApp phone number
 * @returns {Array} Array of review data objects
 */
exports.getUserReviews = async (phoneNumber) => {
  try {
    const sanitizedPhone = sanitizePhoneNumber(phoneNumber);
    const snapshot = await reviewResultsCollection
      .where('phoneNumber', '==', sanitizedPhone)
      .orderBy('timestamp', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    logger.error(`Error getting reviews for ${phoneNumber}:`, error);
    return [];
  }
};

/**
 * Sanitize phone number for use as document ID
 * @param {string} phoneNumber - The phone number to sanitize
 * @returns {string} Sanitized phone number
 */
function sanitizePhoneNumber(phoneNumber) {
  // Remove 'whatsapp:' prefix and any non-alphanumeric characters
  return phoneNumber.replace('whatsapp:', '').replace(/[^\w]/g, '');
}