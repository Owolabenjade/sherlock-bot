// functions/src/services/emailService.js
const sgMail = require('@sendgrid/mail');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Send CV review email with PDF report attachment
 * @param {string} email - Recipient email address
 * @param {Object} reviewResult - The review result data
 * @param {string} reportUrl - URL to the PDF report (optional)
 * @param {string} reportPath - Local path to the PDF report (optional)
 * @returns {Object} Email sending result
 */
exports.sendReviewEmail = async (email, reviewResult, reportUrl = null, reportPath = null) => {
  try {
    // Validate email
    if (!email || !validateEmail(email)) {
      return {
        success: false,
        error: 'Invalid email address'
      };
    }
    
    // Prepare email content
    const subject = 'Your Sherlock Bot CV Review Report';
    const fromEmail = process.env.EMAIL_FROM || 'reviews@sherlockbot.com';
    const fromName = process.env.EMAIL_FROM_NAME || 'Sherlock Bot CV Review';
    
    // Prepare attachments
    let attachments = [];
    let tempFilePath = null;
    
    // If we have a report path, use it for attachment
    if (reportPath) {
      try {
        const fileBuffer = await fs.readFile(reportPath);
        const fileContent = fileBuffer.toString('base64');
        
        attachments.push({
          content: fileContent,
          filename: 'cv-review-report.pdf',
          type: 'application/pdf',
          disposition: 'attachment'
        });
      } catch (fileError) {
        logger.error(`Error reading report file: ${fileError.message}`);
      }
    }
    // Otherwise, if we have a URL, download and attach
    else if (reportUrl) {
      try {
        tempFilePath = path.join(os.tmpdir(), `report-${uuidv4()}.pdf`);
        await downloadFile(reportUrl, tempFilePath);
        
        const fileBuffer = await fs.readFile(tempFilePath);
        const fileContent = fileBuffer.toString('base64');
        
        attachments.push({
          content: fileContent,
          filename: 'cv-review-report.pdf',
          type: 'application/pdf',
          disposition: 'attachment'
        });
      } catch (dlError) {
        logger.error(`Error downloading report: ${dlError.message}`);
        // Continue without attachment, include link in email instead
      }
    }
    
    // Generate the email HTML content
    const htmlContent = generateHtmlEmail(reviewResult, reportUrl);
    const textContent = generateTextEmail(reviewResult, reportUrl);
    
    // Prepare email message
    const msg = {
      to: email,
      from: {
        email: fromEmail,
        name: fromName
      },
      subject: subject,
      text: textContent,
      html: htmlContent,
      attachments: attachments,
      trackingSettings: {
        clickTracking: {
          enable: true
        },
        openTracking: {
          enable: true
        }
      }
    };
    
    // Send the email
    const response = await sgMail.send(msg);
    
    // Clean up any temporary files
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (unlinkError) {
        logger.warn(`Failed to delete temp file: ${unlinkError.message}`);
      }
    }
    
    // Return success response
    return {
      success: true,
      messageId: response[0].headers['x-message-id'],
      statusCode: response[0].statusCode
    };
  } catch (error) {
    logger.error('Error sending email:', error);
    
    // Clean up any temporary files on error
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (unlinkError) {
        logger.warn(`Failed to delete temp file: ${unlinkError.message}`);
      }
    }
    
    // Return error response
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Generate HTML email content
 * @param {Object} reviewResult - The review result data
 * @param {string} reportUrl - URL to the PDF report (optional)
 * @returns {string} HTML email content
 */
function generateHtmlEmail(reviewResult, reportUrl) {
  const score = reviewResult.improvementScore || 0;
  const insights = reviewResult.insights || [];
  
  // Determine score color
  const scoreColor = score < 50 ? '#ff4d4d' : score < 70 ? '#ffa64d' : '#4CAF50';
  
  // Format insights HTML
  let insightsHtml = '';
  if (insights.length > 0) {
    insightsHtml = '<h3 style="color: #444444; margin-top: 20px;">Key Insights:</h3><ul>';
    
    // Show only top 5 insights in email
    const limitedInsights = insights.slice(0, 5);
    
    limitedInsights.forEach(insight => {
      insightsHtml += `<li style="margin-bottom: 10px;">${insight}</li>`;
    });
    
    if (insights.length > 5) {
      insightsHtml += '<li style="margin-bottom: 10px;"><em>...and more insights in your full report!</em></li>';
    }
    
    insightsHtml += '</ul>';
  }
  
  // Format download button/link
  let downloadSection = '';
  if (reportUrl) {
    downloadSection = `
      <div style="margin: 30px 0; text-align: center;">
        <a href="${reportUrl}" style="background-color: #4a6baf; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
          Download Full Report
        </a>
        <p style="margin-top: 15px; font-size: 12px; color: #888888;">
          Link expires in 7 days. Please download your report before then.
        </p>
      </div>
    `;
  }
  
  // Construct the HTML email
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your CV Review Report</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="https://your-domain.com/images/logo.png" alt="Sherlock Bot Logo" style="max-width: 150px; height: auto;">
      </div>
      
      <div style="background-color: #f9f9f9; border-radius: 8px; padding: 25px; margin-bottom: 20px; border: 1px solid #e0e0e0;">
        <h1 style="color: #4a6baf; text-align: center; margin-top: 0;">Your CV Review Report</h1>
        
        <p style="font-size: 16px; text-align: center; margin-bottom: 25px;">
          Thank you for using our CV review service. Here is your personalized feedback.
        </p>
        
        <div style="background-color: white; border-radius: 4px; padding: 20px; margin-bottom: 20px; border: 1px solid #e0e0e0;">
          <h2 style="margin-top: 0; text-align: center; color: #444444;">Your CV Score</h2>
          
          <div style="text-align: center; margin: 20px 0;">
            <div style="position: relative; height: 150px; width: 150px; margin: 0 auto;">
              <div style="position: absolute; top: 0; left: 0; width: 150px; height: 150px; border-radius: 50%; background-color: #f0f0f0;"></div>
              <div style="position: relative; top: 15px; left: 15px; width: 120px; height: 120px; border-radius: 50%; background-color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                <div>
                  <div style="font-size: 36px; font-weight: bold; color: ${scoreColor};">${score}</div>
                  <div style="font-size: 14px; color: #888888;">/100</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        ${insightsHtml}
        
        ${downloadSection}
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <h3 style="color: #444444;">Next Steps:</h3>
          <ol style="padding-left: 25px;">
            <li>Review the insights in your detailed report</li>
            <li>Update your CV based on our recommendations</li>
            <li>Consider saving a copy of your report for future reference</li>
          </ol>
        </div>
      </div>
      
      <div style="text-align: center; font-size: 12px; color: #888888; margin-top: 30px;">
        <p>This email was sent to you because you requested a CV review from Sherlock Bot.</p>
        <p>© 2025 MastaSkillz - CV Review Service | <a href="https://your-domain.com/privacy" style="color: #4a6baf;">Privacy Policy</a></p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate plain text email content
 * @param {Object} reviewResult - The review result data
 * @param {string} reportUrl - URL to the PDF report (optional)
 * @returns {string} Plain text email content
 */
function generateTextEmail(reviewResult, reportUrl) {
  const score = reviewResult.improvementScore || 0;
  const insights = reviewResult.insights || [];
  
  let textContent = `
YOUR CV REVIEW REPORT
=====================

Thank you for using Sherlock Bot from MastaSkillz CV Review service.

Your CV Score: ${score}/100

Key Insights:
`;

  // Add top 5 insights
  const limitedInsights = insights.slice(0, 5);
  limitedInsights.forEach((insight, index) => {
    textContent += `${index + 1}. ${insight}\n`;
  });
  
  if (insights.length > 5) {
    textContent += `...and more insights in your full report!\n`;
  }
  
  // Add download link if available
  if (reportUrl) {
    textContent += `
Download your full report here:
${reportUrl}

Link expires in 7 days. Please download your report before then.
`;
  }
  
  textContent += `
Next Steps:
1. Review the insights in your detailed report
2. Update your CV based on our recommendations
3. Consider saving a copy of your report for future reference

--
This email was sent to you because you requested a CV review from Sherlock Bot.
© 2025 MastaSkillz - CV Review Service
`;

  return textContent;
}

/**
 * Download a file from URL to a local path
 * @param {string} url - URL to download from
 * @param {string} outputPath - Path to save the file to
 * @returns {Promise<void>}
 */
async function downloadFile(url, outputPath) {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'arraybuffer'
  });
  
  await fs.writeFile(outputPath, response.data);
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}