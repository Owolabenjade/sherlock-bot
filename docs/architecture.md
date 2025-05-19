# System Architecture Documentation

This document provides a detailed overview of the Sherlock Bot system architecture, explaining how the various components interact with each other.

## System Components

![Architecture Diagram](images/architecture-diagram.png)

### Core Components

1. **Firebase Cloud Functions**
   - Serverless functions that handle requests and business logic
   - Scales automatically based on demand
   - Main entry points for webhooks from Twilio and Stripe

2. **Firebase Firestore**
   - NoSQL database storing user sessions and review results
   - Real-time data synchronization
   - Document-based data structure

3. **Firebase Storage**
   - Object storage for CV files and generated reports
   - Temporary secure storage with automatic deletion
   - Access controlled via Firebase security rules

4. **Twilio WhatsApp API**
   - Messaging interface for user interaction
   - Handles sending and receiving messages and media
   - Forwards webhook events to Cloud Functions

5. **Stripe Payment Processing**
   - Handles payment for Advanced CV reviews
   - Checkout sessions for secure payment
   - Webhook notifications for payment events

## Data Flow

### User Session Flow

1. **Initialization**
   - User sends a message to WhatsApp number
   - Twilio forwards message to webhook endpoint
   - System creates or retrieves user session from Firestore

2. **State Management**
   - User session maintains current state (new, choose_review_type, upload_cv, etc.)
   - Each message transitions the session to a new state
   - State determines the appropriate response and next steps

3. **Data Storage**
   - User sessions stored in Firestore
   - Document ID based on phone number
   - Fields include state, reviewType, cvFile, paymentStatus

### CV Processing Flow

1. **File Upload**
   - User uploads CV via WhatsApp
   - Twilio sends file URL to webhook
   - System downloads file from Twilio
   - File is uploaded to Firebase Storage

2. **Text Extraction**
   - System downloads file from Storage to Cloud Function
   - Text extracted from PDF/DOCX using appropriate library
   - Extracted text used for review generation

3. **Review Generation**
   - Based on review type (basic or advanced)
   - Analysis performed on extracted text
   - Results stored in Firestore
   - For advanced reviews, PDF report generated

4. **Response Delivery**
   - Review insights formatted for WhatsApp
   - System sends response via Twilio API
   - For advanced reviews, download link included

### Payment Flow

1. **Payment Initiation**
   - User selects Advanced review
   - System creates Stripe Checkout session
   - Payment link sent to user via WhatsApp

2. **Payment Processing**
   - User completes payment on Stripe Checkout page
   - Stripe sends webhook notification to system
   - System updates payment status in user session

3. **Post-Payment**
   - If CV already uploaded, processing begins
   - If CV not yet uploaded, user prompted to upload

## Security Architecture

1. **Authentication & Authorization**
   - Twilio webhook validation using signature
   - Stripe webhook validation using signature
   - Firebase Admin SDK for backend operations
   - No end-user authentication needed (phone number is identifier)

2. **Data Security**
   - All communications over HTTPS
   - CV files stored temporarily (24-hour expiry)
   - Files deleted after processing via scheduled function
   - Firestore security rules restrict access
   - Storage security rules prevent unauthorized access

3. **API Key Management**
   - Secrets stored in environment variables
   - Not exposed to clients
   - Different keys for development and production

## Scalability Considerations

1. **Serverless Architecture**
   - Functions scale automatically with demand
   - No server management required
   - Pay-per-use pricing model

2. **Database Scaling**
   - Firestore designed for scaling
   - Automatic sharding and distribution
   - Efficient queries via proper indexing

3. **Storage Optimization**
   - Files deleted after 24 hours
   - Size limits enforced (5MB max)

## Monitoring and Logging

1. **Cloud Functions Logging**
   - Winston logger for structured logs
   - Error tracking for debugging
   - Performance monitoring

2. **Firestore Analytics**
   - Read/write operations tracking
   - Query performance monitoring

3. **Storage Metrics**
   - File upload/download statistics
   - Storage utilization tracking

## Failure Modes and Recovery

1. **Webhook Failures**
   - Retry mechanisms for failed API calls
   - Logging of failed webhook deliveries
   - Fallback responses for service unavailability

2. **Processing Errors**
   - Error handling for file processing issues
   - User notifications for failed operations
   - Graceful degradation to basic functionality

3. **Payment Issues**
   - Clear error messages for failed payments
   - Easy retry options
   - Manual confirmation fallback

## Development Environment

1. **Local Development**
   - Firebase emulators for local testing
   - ngrok for Twilio webhook testing
   - Environment variable management

2. **CI/CD Pipeline**
   - GitHub Actions for automated deployment
   - Environment-specific configurations
   - Linting and testing before deployment

## Future Architecture Extensions

1. **Machine Learning Integration**
   - CV analysis using ML models
   - Personalized recommendations
   - Competitor CV comparisons

2. **Multi-language Support**
   - Language detection
   - Translations via Cloud Translation API
   - Language-specific review engines

3. **Analytics Dashboard**
   - User engagement metrics
   - Conversion tracking
   - Revenue analytics

This architecture provides a robust foundation that can scale with user demand while maintaining security and reliability. The serverless approach minimizes operational overhead, allowing focus on feature development and user experience improvements.