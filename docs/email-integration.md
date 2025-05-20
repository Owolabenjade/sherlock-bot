# Email Integration Guide

This document explains how to set up and use the email delivery service for CV reviews.

## Overview

The email delivery service uses SendGrid to send CV review results to users who have completed an advanced review. The emails include:

- CV improvement score
- Key insights (top 5)
- A link to download the full PDF report
- The full PDF report as an attachment

## Setup

1. **Create a SendGrid Account**
   - Sign up at [SendGrid](https://sendgrid.com/)
   - Create an API key with "Mail Send" permissions

2. **Configure Environment Variables**
   - Add your SendGrid API key to `.env` and Firebase Config:
     ```
     SENDGRID_API_KEY=your_sendgrid_api_key
     EMAIL_FROM=reviews@yourdomain.com
     EMAIL_FROM_NAME=Sherlock Bot CV Review
     ```

3. **Verify Your Sender Identity**
   - In SendGrid, verify the email address you'll use as the sender
   - For production, verify your domain for better deliverability

## Usage

The email service is integrated with the CV processing flow. When a user completes an advanced review, they'll be asked if they want to receive the review by email.

### Workflow

1. User completes payment for advanced review
2. Bot asks if they want to receive the review by email
3. If yes, user provides their email address
4. User uploads their CV
5. System processes the CV and generates the review
6. Review is sent to the user's WhatsApp and email (if provided)

### Testing

To test the email service:

```bash
cd functions
node src/test/testEmailService.js your-test-email@example.com