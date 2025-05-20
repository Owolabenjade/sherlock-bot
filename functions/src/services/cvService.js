// src/services/cvService.js - Production-ready CV processing service

const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const logger = require('../utils/logger');
const { downloadFileFromStorage, uploadFileToStorage, getFileDownloadUrl, deleteFile } = require('./storageService');
const { saveReviewResult } = require('./firestoreService');

// Configure CV analysis API settings
const CV_ANALYSIS_API_URL = process.env.CV_ANALYSIS_API_URL || 'https://api.cvanalyzer.com/analyze';
const CV_ANALYSIS_API_KEY = process.env.CV_ANALYSIS_API_KEY;

/**
 * Process CV when uploaded to Firebase Storage
 * @param {Object} object - Storage object metadata
 */
exports.processUploadedCV = async (object) => {
  logger.info(`File ${object.name} uploaded to storage`);
};

/**
 * Process CV for basic review
 * @param {string} storagePath - Path to CV file in Firebase Storage
 * @returns {Object} Review results
 */
exports.processBasicReview = async (storagePath) => {
  try {
    // Download file from Firebase Storage to temp location
    const localFilePath = await downloadFileFromStorage(storagePath);
    
    // Extract structured text from CV
    const cvData = await extractTextFromCV(localFilePath);
    
    // Send to CV analysis API for professional review
    const reviewResult = await analyzeCV(cvData, 'basic');
    
    // Save review result to Firestore
    const phoneNumber = getPhoneNumberFromStoragePath(storagePath);
    
    reviewResult.cvFileName = path.basename(storagePath);
    reviewResult.reviewType = 'basic';
    
    // Save to Firestore
    const reviewId = await saveReviewResult(phoneNumber, reviewResult);
    reviewResult.id = reviewId;
    
    // Clean up the local temp file
    await fs.unlink(localFilePath);
    
    return reviewResult;
  } catch (error) {
    logger.error('Error in basic review processing:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Process CV for advanced review
 * @param {string} storagePath - Path to CV file in Firebase Storage
 * @returns {Object} Review results
 */
exports.processAdvancedReview = async (storagePath) => {
  try {
    // Download file from Firebase Storage to temp location
    const localFilePath = await downloadFileFromStorage(storagePath);
    
    // Extract structured text from CV
    const cvData = await extractTextFromCV(localFilePath);
    
    // Get phone number from storage path
    const phoneNumber = getPhoneNumberFromStoragePath(storagePath);
    
    // Get user's email if available
    const userEmail = await getUserEmail(phoneNumber);
    
    // Send to CV analysis API for professional review
    const reviewResult = await analyzeCV(cvData, 'advanced');
    
    // Generate a PDF report
    const reportPath = await generatePDFReport(reviewResult, localFilePath);
    
    // Upload report to Firebase Storage
    const reportStoragePath = await uploadFileToStorage(reportPath, phoneNumber);
    
    // Get a download URL for the report
    const downloadUrl = await getFileDownloadUrl(reportStoragePath);
    reviewResult.downloadLink = downloadUrl;
    
    // Add metadata
    reviewResult.cvFileName = path.basename(storagePath);
    reviewResult.reviewType = 'advanced';
    reviewResult.reportPath = reportStoragePath;
    
    // Save to Firestore
    const reviewId = await saveReviewResult(phoneNumber, reviewResult);
    reviewResult.id = reviewId;
    
    // Send email if we have user's email
    if (userEmail) {
      const { sendReviewEmail } = require('./emailService');
      const emailResult = await sendReviewEmail(userEmail, reviewResult, downloadUrl, reportPath);
      
      reviewResult.emailSent = emailResult.success;
      if (!emailResult.success) {
        logger.warn(`Failed to send email to ${userEmail}: ${emailResult.error}`);
      } else {
        logger.info(`Email sent successfully to ${userEmail}`);
      }
    }
    
    // Clean up the local temp files
    await fs.unlink(localFilePath);
    await fs.unlink(reportPath);
    
    return reviewResult;
  } catch (error) {
    logger.error('Error in advanced review processing:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get user's email address from phone number
 * @param {string} phoneNumber - User's phone number
 * @returns {Promise<string|null>} User's email or null
 */
async function getUserEmail(phoneNumber) {
  try {
    // In a real implementation, you would look up the user's email in your database
    // For example, from a user profile collection in Firestore
    
    const admin = require('firebase-admin');
    const db = admin.firestore();
    
    const userDoc = await db.collection('users').doc(phoneNumber).get();
    
    if (userDoc.exists) {
      return userDoc.data().email || null;
    }
    
    return null;
  } catch (error) {
    logger.error(`Error getting user email for ${phoneNumber}:`, error);
    return null;
  }
}

/**
 * Extract text from a CV file with structure recognition
 * @param {string} filePath - Path to the CV file
 * @returns {Object} Extracted text with identified sections
 */
async function extractTextFromCV(filePath) {
  try {
    const fileExt = path.extname(filePath).toLowerCase();
    
    let rawText, structuredContent;
    if (fileExt === '.pdf') {
      const result = await extractTextFromPDF(filePath);
      rawText = result.text;
      structuredContent = result.structured;
    } else if (fileExt === '.docx') {
      const result = await extractTextFromDOCX(filePath);
      rawText = result.text;
      structuredContent = result.structured;
    } else {
      throw new Error(`Unsupported file type: ${fileExt}`);
    }
    
    // Process the extracted text to identify sections
    return processExtractedText(rawText, structuredContent);
  } catch (error) {
    logger.error(`Error extracting text from ${filePath}:`, error);
    throw error;
  }
}

/**
 * Extract text from a PDF file with enhanced options
 * @param {string} filePath - Path to the PDF file
 * @returns {Object} Extracted text and structured content
 */
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    
    // Enhanced PDF parsing options
    const options = {
      pagerender: renderPage,
      normalizeWhitespace: true,
      disableCombineTextItems: false
    };
    
    const data = await pdf(dataBuffer, options);
    
    // Capture font information and structure
    const structured = {
      pageCount: data.numpages,
      metadata: data.metadata,
      info: data.info,
      version: data.pdfInfo ? data.pdfInfo.version : 'unknown'
    };
    
    return {
      text: data.text,
      structured: structured
    };
  } catch (error) {
    logger.error(`Error extracting text from PDF ${filePath}:`, error);
    throw error;
  }
}

/**
 * Custom page renderer for PDF.js
 */
function renderPage(pageData) {
  return pageData.getTextContent({
    normalizeWhitespace: true,
    disableCombineTextItems: false
  })
  .then(function(textContent) {
    let lastY, text = '';
    
    // Process each text item to maintain structure
    for (let item of textContent.items) {
      if (lastY == item.transform[5] || !lastY) {
        text += item.str;
      } else {
        text += '\n' + item.str;
      }
      lastY = item.transform[5];
    }
    
    return text;
  });
}

/**
 * Extract text from a DOCX file with enhanced options
 * @param {string} filePath - Path to the DOCX file
 * @returns {Object} Extracted text and structured content
 */
async function extractTextFromDOCX(filePath) {
  try {
    // Extract text with heading structure
    const textResult = await mammoth.extractRawText({
      path: filePath,
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Title'] => title:fresh",
        "b => strong",
        "i => em"
      ]
    });
    
    // Extract document structure for additional metadata
    const structureResult = await mammoth.extractRawDocumentContent({ path: filePath });
    
    // Create a structured representation
    const structured = {
      styles: [],
      paragraphs: []
    };
    
    if (structureResult && structureResult.value) {
      // Parse document XML content for structure (simplified)
      const content = structureResult.value;
      
      // Extract paragraph styles
      const paragraphMatches = content.match(/<w:p\b[^>]*>(.*?)<\/w:p>/gs) || [];
      structured.paragraphs = paragraphMatches.length;
      
      // Extract style definitions (simplified)
      const styleMatches = content.match(/<w:style\b[^>]*>(.*?)<\/w:style>/gs) || [];
      structured.styles = styleMatches.length;
    }
    
    return {
      text: textResult.value,
      structured: structured
    };
  } catch (error) {
    logger.error(`Error extracting text from DOCX ${filePath}:`, error);
    throw error;
  }
}

/**
 * Process text to identify CV sections
 * @param {string} text - Raw extracted text
 * @param {Object} structuredContent - Additional structured content
 * @returns {Object} Structured CV data with identified sections
 */
function processExtractedText(text, structuredContent) {
  // Normalize text
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  
  // Split text into lines for analysis
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Detect sections in the CV using regex patterns
  const sections = {
    summary: extractSection(text, /profile|summary|objective|about me/i),
    contact: extractSection(text, /contact|email|phone|address/i),
    experience: extractSection(text, /experience|employment|work history|professional background/i),
    education: extractSection(text, /education|qualification|academic|degree|university/i),
    skills: extractSection(text, /skills|expertise|competencies|proficiencies|technical/i),
    projects: extractSection(text, /projects|portfolio|works/i),
    certifications: extractSection(text, /certifications|certificates|credentials/i),
    languages: extractSection(text, /languages|language proficiency/i),
    interests: extractSection(text, /interests|hobbies|activities/i)
  };
  
  // Extract contact information
  const contactInfo = {
    email: extractEmail(text),
    phone: extractPhone(text),
    linkedin: extractLinkedIn(text),
    website: extractWebsite(text)
  };
  
  // Analyze skills section 
  const skillsText = sections.skills || '';
  const skills = skillsText.split(/[,;•\n]/).map(skill => skill.trim()).filter(skill => skill.length > 0);
  
  // Estimate CV length and quality metrics
  const metrics = {
    lineCount: lines.length,
    charCount: text.length,
    wordCount: text.split(/\s+/).length,
    estimatedPages: Math.ceil(text.length / 3000), // ~3000 chars per page
    hasContactInfo: Boolean(contactInfo.email || contactInfo.phone),
    sectionCount: Object.values(sections).filter(section => section.length > 0).length,
    skillCount: skills.length
  };
  
  return {
    fullText: text,
    sections: sections,
    contactInfo: contactInfo,
    skills: skills,
    metrics: metrics,
    structured: structuredContent || {}
  };
}

/**
 * Extract a specific section from CV text
 * @param {string} text - Full CV text
 * @param {RegExp} sectionRegex - Regex to match section heading
 * @returns {string} Extracted section text
 */
function extractSection(text, sectionRegex) {
  try {
    // Find the section heading
    const sectionMatch = text.match(new RegExp(`(^|\\n)\\s*(${sectionRegex.source})\\s*[:\\-]?\\s*(\\n|$)`, 'i'));
    
    if (!sectionMatch) return '';
    
    const sectionStart = sectionMatch.index + sectionMatch[0].length;
    
    // Find the next section heading (if any)
    const nextSectionMatch = text.slice(sectionStart).match(/(\n)\s*([A-Z][A-Za-z\s]+)[\:\-]?\s*(\n|$)/);
    
    const sectionEnd = nextSectionMatch 
      ? sectionStart + nextSectionMatch.index 
      : text.length;
    
    // Extract the section content
    return text.slice(sectionStart, sectionEnd).trim();
  } catch (error) {
    logger.error(`Error extracting section with regex ${sectionRegex}:`, error);
    return '';
  }
}

/**
 * Extract email address from text
 * @param {string} text - Text to search
 * @returns {string} Email address or empty string
 */
function extractEmail(text) {
  const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  const matches = text.match(emailRegex);
  return matches ? matches[0] : '';
}

/**
 * Extract phone number from text
 * @param {string} text - Text to search
 * @returns {string} Phone number or empty string
 */
function extractPhone(text) {
  const phoneRegex = /(?:\+\d{1,3}[\s-]?)?\(?\d{3,4}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
  const matches = text.match(phoneRegex);
  return matches ? matches[0] : '';
}

/**
 * Extract LinkedIn URL from text
 * @param {string} text - Text to search
 * @returns {string} LinkedIn URL or empty string
 */
function extractLinkedIn(text) {
  const linkedinRegex = /linkedin\.com\/in\/[a-zA-Z0-9_-]+/g;
  const matches = text.match(linkedinRegex);
  return matches ? matches[0] : '';
}

/**
 * Extract website URL from text
 * @param {string} text - Text to search
 * @returns {string} Website URL or empty string
 */
function extractWebsite(text) {
  const websiteRegex = /https?:\/\/(?!linkedin\.com)[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}/g;
  const matches = text.match(websiteRegex);
  return matches ? matches[0] : '';
}

/**
 * Analyze CV through external API
 * @param {Object} cvData - Structured CV data
 * @param {string} reviewType - Type of review (basic or advanced)
 * @returns {Object} Analysis results
 */
async function analyzeCV(cvData, reviewType) {
  try {
    logger.info(`Sending CV for ${reviewType} analysis`);
    
    // Check if API key is configured
    if (!CV_ANALYSIS_API_KEY) {
      logger.warn('CV_ANALYSIS_API_KEY not configured. Using fallback analysis.');
      return fallbackAnalysis(cvData, reviewType);
    }
    
    // Prepare data for API request
    const requestData = {
      cv_text: cvData.fullText,
      sections: cvData.sections,
      contact_info: cvData.contactInfo,
      metrics: cvData.metrics,
      review_type: reviewType
    };
    
    // Call the CV analysis API
    const response = await axios.post(CV_ANALYSIS_API_URL, requestData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CV_ANALYSIS_API_KEY}`
      },
      timeout: 30000 // 30 second timeout
    });
    
    if (response.status !== 200) {
      throw new Error(`API returned status ${response.status}`);
    }
    
    const result = response.data;
    
    // Validate API response
    if (!result.success) {
      throw new Error(result.error || 'Unknown API error');
    }
    
    logger.info(`CV analysis completed successfully. Score: ${result.improvementScore}`);
    
    return {
      success: true,
      timestamp: new Date().toISOString(),
      improvementScore: result.improvementScore,
      insights: result.insights,
      detectedSections: result.detectedSections || Object.keys(cvData.sections).filter(s => cvData.sections[s]),
      metrics: cvData.metrics,
      apiProvider: 'CV Analysis API'
    };
  } catch (error) {
    logger.error('Error calling CV analysis API:', error);
    logger.info('Falling back to local analysis');
    
    // Fallback to local analysis if API fails
    return fallbackAnalysis(cvData, reviewType);
  }
}

/**
 * Fallback analysis when API is unavailable
 * @param {Object} cvData - Structured CV data
 * @param {string} reviewType - Type of review (basic or advanced)
 * @returns {Object} Analysis results
 */
function fallbackAnalysis(cvData, reviewType) {
  // Initialize insights array
  const insights = [];
  
  // Calculate base score from metrics
  const metrics = cvData.metrics;
  let score = 50; // Base score
  
  // Adjust score based on metrics
  if (metrics.sectionCount >= 5) score += 10;
  if (metrics.hasContactInfo) score += 5;
  if (metrics.skillCount >= 10) score += 5;
  if (metrics.estimatedPages <= 2) score += 5;
  if (cvData.sections.summary && cvData.sections.summary.length > 100) score += 5;
  if (cvData.sections.experience && cvData.sections.experience.length > 300) score += 10;
  
  // Cap score between 40-90
  score = Math.max(40, Math.min(90, score));
  
  // Generate insights based on CV structure
  if (!cvData.sections.summary || cvData.sections.summary.length < 100) {
    insights.push("Your CV would benefit from a stronger professional summary. Add a concise overview of your experience and key achievements.");
  }
  
  if (!cvData.sections.experience || cvData.sections.experience.length < 200) {
    insights.push("Your experience section needs more detail. Add specific achievements and metrics to demonstrate your impact.");
  } else {
    insights.push("Consider adding more quantifiable achievements to your experience section.");
  }
  
  if (!cvData.sections.skills || cvData.skills.length < 8) {
    insights.push("Your skills section could be more detailed. Group skills by category to improve readability.");
  } else if (cvData.skills.length > 20) {
    insights.push("Your skills section is comprehensive, but consider focusing on the most relevant skills for your target role.");
  }
  
  if (!cvData.contactInfo.email || !cvData.contactInfo.phone) {
    insights.push("Make sure your contact information is prominently displayed at the top of your CV.");
  }
  
  if (metrics.estimatedPages > 2) {
    insights.push("Your CV appears to be longer than 2 pages. Consider condensing it for better readability.");
  }
  
  // Add more detailed insights for advanced reviews
  if (reviewType === 'advanced') {
    insights.push("STRUCTURE: The organization of your CV sections could be improved to highlight your most relevant qualifications first.");
    insights.push("LANGUAGE: Use more action verbs at the beginning of bullet points to create a stronger impression.");
    insights.push("FORMATTING: Maintain consistent formatting and use a clear hierarchy with no more than 3 font sizes.");
    insights.push("KEYWORDS: Add more industry-specific keywords to pass through applicant tracking systems.");
    
    if (cvData.sections.education) {
      insights.push("EDUCATION: Position your education section strategically based on its relevance to the target role.");
    }
  }
  
  // Ensure we have enough insights
  if (insights.length < 5) {
    insights.push("Use a clean, professional format with consistent spacing and alignment.");
    insights.push("Tailor your CV for each application to highlight the most relevant experience.");
  }
  
  return {
    success: true,
    timestamp: new Date().toISOString(),
    improvementScore: score,
    insights: insights,
    detectedSections: Object.keys(cvData.sections).filter(section => cvData.sections[section].length > 0),
    metrics: metrics,
    apiProvider: 'Local Analysis (Fallback)'
  };
}

/**
 * Generate a PDF report from review results
 * @param {Object} reviewResult - Review results
 * @param {string} cvPath - Path to the original CV
 * @returns {string} Path to the generated PDF report
 */
async function generatePDFReport(reviewResult, cvPath) {
  const PDFDocument = require('pdfkit');
  const fs = require('fs');
  
  const reportPath = path.join(os.tmpdir(), `report-${uuidv4()}.pdf`);
  const doc = new PDFDocument();
  const stream = fs.createWriteStream(reportPath);
  
  // Set up document
  doc.pipe(stream);
  
  // Add header with logo (if available)
  doc.fontSize(25).text('CV Review Report', {align: 'center'});
  doc.moveDown();
  
  // Add date
  doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString()}`, {align: 'right'});
  doc.moveDown();
  
  // Add improvement score with visual indicator
  doc.fontSize(16).text('CV Improvement Score');
  
  // Draw score background
  const scoreX = 72;
  const scoreY = doc.y + 10;
  const scoreWidth = 450;
  const scoreHeight = 25;
  
  // Background bar (gray)
  doc.rect(scoreX, scoreY, scoreWidth, scoreHeight).fill('#e0e0e0');
  
  // Score indicator (colored)
  const score = reviewResult.improvementScore || 0;
  const scoreColor = score < 50 ? '#ff4d4d' : score < 70 ? '#ffa64d' : '#4CAF50';
  const filledWidth = (score / 100) * scoreWidth;
  doc.rect(scoreX, scoreY, filledWidth, scoreHeight).fill(scoreColor);
  
  // Score text
  doc.fill('black').fontSize(14).text(
    `${score}/100`, 
    scoreX + (scoreWidth / 2) - 20, 
    scoreY + 6
  );
  
  doc.moveDown(2);
  
  // Add executive summary
  doc.fontSize(16).text('Executive Summary');
  doc.moveDown(0.5);
  
  doc.fontSize(11).text(
    'This report provides an analysis of your CV with specific recommendations for improvement. ' +
    'Below you\'ll find detailed insights to help make your CV more effective for job applications.'
  );
  doc.moveDown(2);
  
  // Add insights
  doc.fontSize(16).text('Detailed Insights');
  doc.moveDown();
  
  // Group insights by category for advanced reviews
  if (reviewResult.reviewType === 'advanced' && reviewResult.insights.some(i => i.includes(':'))) {
    const categories = {};
    
    // Group insights by category
    reviewResult.insights.forEach(insight => {
      const parts = insight.split(':');
      if (parts.length >= 2) {
        const category = parts[0].trim();
        const content = parts.slice(1).join(':').trim();
        
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push(content);
      } else {
        if (!categories['General']) {
          categories['General'] = [];
        }
        categories['General'].push(insight);
      }
    });
    
    // Add each category and its insights
    for (const [category, categoryInsights] of Object.entries(categories)) {
      doc.fontSize(14).text(category);
      doc.moveDown(0.5);
      
      categoryInsights.forEach(insight => {
        doc.fontSize(10).text(`• ${insight}`);
        doc.moveDown(0.5);
      });
      
      doc.moveDown(0.5);
    }
  } else {
    // Simple list of insights for basic reviews
    reviewResult.insights.forEach(insight => {
      doc.fontSize(11).text(`• ${insight}`);
      doc.moveDown(0.5);
    });
  }
  
  doc.moveDown();
  
  // Add recommendations section
  doc.fontSize(16).text('Next Steps');
  doc.moveDown(0.5);
  
  doc.fontSize(11).text(
    'To improve your CV based on these insights:\n\n' +
    '1. Focus on addressing the highest priority items first\n' +
    '2. Quantify your achievements wherever possible\n' +
    '3. Tailor your CV for each job application\n' +
    '4. Have someone else review your CV after making changes\n' +
    '5. Consider professional CV writing services for additional help'
  );
  
  // Add footer with contact info
  const bottomOfPage = doc.page.height - 50;
  doc.fontSize(8).text(
    'This report was generated by Sherlock Bot CV Review Service. ' +
    'For questions or feedback, contact support@sherlockbot.com',
    50, bottomOfPage, { align: 'center' }
  );
  
  // Finalize document
  doc.end();
  
  // Wait for the document to finish writing
  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(reportPath));
    stream.on('error', reject);
  });
}

/**
 * Extract phone number from storage path
 * @param {string} storagePath - Storage path
 * @returns {string} Phone number
 */
function getPhoneNumberFromStoragePath(storagePath) {
  // Path format: cv-uploads/{phoneNumber}/{filename}
  const parts = storagePath.split('/');
  if (parts.length >= 2) {
    return parts[1]; // Return the phoneNumber part
  }
  return null;
}