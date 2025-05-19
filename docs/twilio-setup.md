# Twilio WhatsApp API Setup Guide

This guide walks you through setting up Twilio's WhatsApp API for the Sherlock Bot project.

## Setting Up Twilio Account

1. **Create a Twilio Account**
   - Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
   - Sign up for a new account or log in to an existing one
   - Verify your email and phone number

2. **Get Your Account SID and Auth Token**
   - Go to the Twilio Console Dashboard
   - Note your Account SID and Auth Token (you'll need these for your .env file)

## Setting Up WhatsApp Sandbox

1. **Activate the WhatsApp Sandbox**
   - From the Twilio Console, navigate to "Messaging" > "Try it out" > "Send a WhatsApp message"
   - Follow the instructions to set up the WhatsApp Sandbox

2. **Connect Your Phone to the Sandbox**
   - Send a WhatsApp message to the Twilio WhatsApp number with the code provided
   - You should receive a confirmation message

## Configuring Webhook for Incoming Messages

1. **Set Up Webhook URL**
   - In the WhatsApp Sandbox settings, find the "When a message comes in" field
   - Enter your Firebase Cloud Function webhook URL:
     ```
     https://us-central1-your-project-id.cloudfunctions.net/api/webhook
     ```
   - Set the HTTP method to **POST**

2. **Test Webhook Configuration**
   - Send a message to your Twilio WhatsApp number
   - Check Firebase Function logs to verify the webhook is being triggered

## Handling Media in WhatsApp

1. **Configure Media Handling**
   - WhatsApp can send and receive various media types including documents
   - Ensure your Firebase storage is configured to handle these files

2. **Media Size Limits**
   - WhatsApp media size limits:
     - Documents (including PDFs): up to 100MB
     - However, for this application, we're limiting to 5MB

## Message Templates for Production

When moving beyond the sandbox to a production WhatsApp Business API:

1. **Create Message Templates**
   - WhatsApp requires pre-approved templates for initiating conversations
   - Templates can include:
     - Welcome messages
     - Payment confirmation
     - Review delivery notifications

2. **Submit Templates for Approval**
   - Create templates in the Twilio Console
   - Submit for WhatsApp approval
   - This process can take 1-5 business days

## Testing Your WhatsApp Integration

1. **Basic Flow Testing**
   - Send "Hi" to your WhatsApp number
   - Choose a review type
   - Upload a CV file
   - Verify the response

2. **Common Issues**
   - **24-hour Session Window**: You can only send messages to users who messaged you in the last 24 hours
   - **Media Handling**: Ensure your application correctly processes media messages
   - **Webhook Timeouts**: Webhook responses must be sent within 10 seconds

## Moving to Production

1. **Apply for WhatsApp Business API**
   - Request access through Twilio
   - Complete the WhatsApp Business Profile
   - Provide business information and verification

2. **Configure Production Number**
   - Set up your permanent WhatsApp Business number
   - Update webhook URLs
   - Configure message templates

3. **Update Environment Variables**
   - Update your .env file with production credentials
   - Deploy the updated configuration

## WhatsApp API Best Practices

1. **Respect Rate Limits**
   - The sandbox has lower rate limits than production
   - Implement exponential backoff for retries

2. **Handle Errors Gracefully**
   - Implement error handling for all API calls
   - Log errors for troubleshooting

3. **Keep Sessions Active**
   - Send session refresh messages before the 24-hour window expires
   - Use templates for re-engaging users after the window closes

4. **Message Format Guidelines**
   - Keep messages concise
   - Use line breaks for readability
   - Emojis are supported for better engagement

## Monitoring and Troubleshooting

1. **Twilio Console Logs**
   - Monitor message delivery status
   - Check for errors in the Twilio Console

2. **Debug Mode**
   - Enable debug mode in your Twilio client for detailed logging
   - Use this during development and testing

3. **Common Error Codes**
   - 20003: Authentication error
   - 63016: Outside the 24-hour window
   - 63054: Template not approved

For more information, refer to the [Twilio WhatsApp API Documentation](https://www.twilio.com/docs/whatsapp/api).