// src/services/storageService.js - Firebase Storage operations

const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

const bucket = admin.storage().bucket();

/**
 * Download a file from a URL
 * @param {string} url - URL to download from
 * @returns {string} Local file path
 */
exports.downloadFileFromUrl = async (url) => {
  try {
    // Create a temporary filepath
    const tempFilePath = path.join(os.tmpdir(), `${uuidv4()}-${path.basename(url)}`);
    
    // Download the file
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'arraybuffer'
    });
    
    // Determine file extension from content-type
    let fileExtension = '.pdf'; // Default
    const contentType = response.headers['content-type'];
    if (contentType.includes('pdf')) {
      fileExtension = '.pdf';
    } else if (contentType.includes('document')) {
      fileExtension = '.docx';
    }
    
    // Ensure correct extension
    const finalPath = tempFilePath.endsWith(fileExtension) 
      ? tempFilePath 
      : `${tempFilePath}${fileExtension}`;
    
    // Save the downloaded file
    await fs.writeFile(finalPath, response.data);
    logger.info(`Downloaded file from ${url} to ${finalPath}`);
    
    return finalPath;
  } catch (error) {
    logger.error('Error downloading file:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
};

/**
 * Upload a file to Firebase Storage
 * @param {string} filePath - Local file path
 * @param {string} phoneNumber - User's phone number for organization
 * @returns {string} Storage path of the uploaded file
 */
exports.uploadFileToStorage = async (filePath, phoneNumber) => {
  try {
    // Sanitize phone number for use in path
    const sanitizedPhone = phoneNumber.replace(/[^\w]/g, '');
    
    // Generate a unique filename
    const filename = path.basename(filePath);
    const uniqueFilename = `${Date.now()}-${filename}`;
    
    // Define storage path
    const storagePath = `cv-uploads/${sanitizedPhone}/${uniqueFilename}`;
    
    // Upload file
    await bucket.upload(filePath, {
      destination: storagePath,
      metadata: {
        contentType: filePath.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        metadata: {
          phoneNumber: phoneNumber,
          uploadTime: Date.now(),
          original: filename
        }
      }
    });
    
    logger.info(`Uploaded ${filePath} to ${storagePath}`);
    
    // Delete the local temporary file
    await fs.unlink(filePath);
    logger.info(`Deleted temporary file ${filePath}`);
    
    return storagePath;
  } catch (error) {
    logger.error('Error uploading file to storage:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

/**
 * Get a download URL for a file in storage
 * @param {string} storagePath - Path to the file in storage
 * @returns {string} Download URL
 */
exports.getFileDownloadUrl = async (storagePath) => {
  try {
    const file = bucket.file(storagePath);
    
    // Get a signed URL that expires in 1 hour (3600 seconds)
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 3600 * 1000
    });
    
    return url;
  } catch (error) {
    logger.error(`Error getting download URL for ${storagePath}:`, error);
    throw error;
  }
};

/**
 * Download a file from storage to a local path
 * @param {string} storagePath - Path to the file in storage
 * @returns {string} Local file path
 */
exports.downloadFileFromStorage = async (storagePath) => {
  try {
    const tempFilePath = path.join(os.tmpdir(), path.basename(storagePath));
    const file = bucket.file(storagePath);
    
    await file.download({ destination: tempFilePath });
    logger.info(`Downloaded ${storagePath} to ${tempFilePath}`);
    
    return tempFilePath;
  } catch (error) {
    logger.error(`Error downloading file from storage ${storagePath}:`, error);
    throw error;
  }
};

/**
 * Delete a file from storage
 * @param {string} storagePath - Path to the file in storage
 * @returns {boolean} Success status
 */
exports.deleteFile = async (storagePath) => {
  try {
    await bucket.file(storagePath).delete();
    logger.info(`Deleted file ${storagePath} from storage`);
    return true;
  } catch (error) {
    logger.error(`Error deleting file ${storagePath}:`, error);
    return false;
  }
};

/**
 * Get file metadata from storage
 * @param {string} storagePath - Path to the file in storage
 * @returns {Object} File metadata
 */
exports.getFileMetadata = async (storagePath) => {
  try {
    const [metadata] = await bucket.file(storagePath).getMetadata();
    return metadata;
  } catch (error) {
    logger.error(`Error getting metadata for ${storagePath}:`, error);
    throw error;
  }
};