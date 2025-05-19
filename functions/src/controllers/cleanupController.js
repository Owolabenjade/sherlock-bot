// src/controllers/cleanupController.js - Handles scheduled file cleanup

const admin = require('firebase-admin');
const logger = require('../utils/logger');
const { deleteFile } = require('../services/storageService');

// 24 hours in milliseconds
const FILE_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Clean up old files that have exceeded the retention period
 */
exports.cleanupOldFiles = async (context) => {
  try {
    logger.info('Starting scheduled cleanup of old files');
    
    const bucket = admin.storage().bucket();
    const cutoffTime = Date.now() - FILE_EXPIRY_MS;
    
    // List all files in the cv-uploads directory
    const [files] = await bucket.getFiles({ prefix: 'cv-uploads/' });
    
    let deletedCount = 0;
    let failedCount = 0;
    
    // Process each file
    for (const file of files) {
      try {
        const [metadata] = await file.getMetadata();
        const createdTime = new Date(metadata.timeCreated).getTime();
        
        // Check if file is older than the cutoff time
        if (createdTime < cutoffTime) {
          // Delete the file
          await file.delete();
          logger.info(`Deleted old file: ${file.name}`);
          deletedCount++;
        }
      } catch (fileError) {
        logger.error(`Error processing file ${file.name} during cleanup:`, fileError);
        failedCount++;
      }
    }
    
    logger.info(`Cleanup complete. Deleted ${deletedCount} files. Failed: ${failedCount}`);
    return { deletedCount, failedCount };
  } catch (error) {
    logger.error('Error during file cleanup:', error);
    throw error;
  }
};

/**
 * Clean up old review data from Firestore
 * Optionally called to purge old user data
 */
exports.cleanupOldReviewData = async (context) => {
  try {
    logger.info('Starting cleanup of old review data');
    
    const db = admin.firestore();
    const cutoffTime = admin.firestore.Timestamp.fromMillis(Date.now() - FILE_EXPIRY_MS);
    
    // Get old review results
    const oldReviewsSnapshot = await db.collection('reviewResults')
      .where('timestamp', '<', cutoffTime)
      .get();
    
    // Delete old review results
    const batch = db.batch();
    let count = 0;
    
    oldReviewsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
      count++;
    });
    
    if (count > 0) {
      await batch.commit();
    }
    
    logger.info(`Deleted ${count} old review records`);
    return { deletedCount: count };
  } catch (error) {
    logger.error('Error during review data cleanup:', error);
    throw error;
  }
};

/**
 * Manual cleanup function for testing
 * @param {number} ageHours - Age of files to delete in hours
 */
exports.manualCleanup = async (ageHours = 24) => {
  try {
    logger.info(`Starting manual cleanup of files older than ${ageHours} hours`);
    
    const bucket = admin.storage().bucket();
    const cutoffTime = Date.now() - (ageHours * 60 * 60 * 1000);
    
    // List all files in the cv-uploads directory
    const [files] = await bucket.getFiles({ prefix: 'cv-uploads/' });
    
    let deletedCount = 0;
    
    // Process each file
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const createdTime = new Date(metadata.timeCreated).getTime();
      
      // Check if file is older than the cutoff time
      if (createdTime < cutoffTime) {
        // Delete the file
        await file.delete();
        logger.info(`Deleted old file: ${file.name}`);
        deletedCount++;
      }
    }
    
    return { deletedCount };
  } catch (error) {
    logger.error('Error during manual cleanup:', error);
    throw error;
  }
};