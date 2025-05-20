# Paystack Payment Integration Guide

This guide walks you through setting up Paystack payment processing for the Sherlock Bot project.

## Setting Up Paystack Account

1. **Create a Paystack Account**
   - Go to [https://dashboard.paystack.com/signup](https://dashboard.paystack.com/signup)
   - Sign up for a new account
   - Complete the verification process and provide required business information

2. **Get API Keys**
   - Go to Settings > API Keys & Webhooks in the Paystack Dashboard
   - Note your Public Key and Secret Key
   - For development, use the test keys

## Creating a Payment Page

1. **Create a Product**
   - Go to Products > Add Product (or use Payment Pages in the dashboard)
   - Name: "CV Advanced Review"
   - Description: "In-depth CV analysis with detailed improvement recommendations"
   - Set the price in your local currency (e.g., NGN for Nigerian Naira)

2. **Configure Payment Options**
   - Set currencies (NGN, GHS, USD, etc.)
   - Enable payment channels you want to support (cards, bank transfers, USSD, etc.)
   - Customize the success and failure redirect URLs

## Setting Up Webhook Endpoint

1. **Register Your Webhook**
   - Go to Settings > API Keys & Webhooks > Add New Webhook
   - URL: `https://us-central1-your-project-id.cloudfunctions.net/api/payment-webhook`
   - Events to send: `charge.success`
   - Add a secret hash (note this for verification)
   - Click "Add Webhook"

2. **Configure Webhook Security**
   - Use the webhook secret in your environment variables as `PAYSTACK_SECRET_KEY`
   - Implement the crypto verification in your webhook handler

## Testing Payments

1. **Test Cards**
   - Use Paystack's test cards for development:
     - Success: `4084 0840 8408 4081`, CVV: `408`, Expiry: any future date
     - Failed: `4084 0840 8408 4040`, CVV: `404`, Expiry: any future date
     - More test cards in [Paystack documentation](https://paystack.com/docs/payments/test-payments/)

2. **Test Checkout Flow**
   - Send an "Advanced" request to your WhatsApp bot
   - Follow the payment link
   - Complete payment using a test card
   - Verify webhook event is received

## Security Best Practices

1. **Validate Webhooks**
   - Always verify webhook signatures using HMAC SHA-512
   - Use the code pattern provided in the implementation
   - Keep your webhook secret secure

2. **Handle Payment Verification Properly**
   - Use `transaction.verify` to confirm payment status
   - Don't rely solely on the webhook event

3. **Protect Customer Data**
   - Store only necessary payment information
   - Avoid storing card details

## Production Considerations

1. **Switch to Live Mode**
   - After testing, switch to live mode in Paystack
   - Update API keys in your environment variables
   - Test with a real payment

2. **Local Currency Processing**
   - Paystack processes payments in the local currency of your account
   - For NGN, amounts are in kobo (100 kobo = 1 NGN)
   - For GHS, amounts are in pesewas (100 pesewas = 1 GHS)

3. **Transaction References**
   - Always use unique transaction references
   - A good pattern is: `service_timestamp_phoneNumber`
   - References must be unique across your entire account

## Handling Payment Failures

1. **Customer Communication**
   - Send clear messages when payments fail
   - Provide easy ways to retry

2. **Logging**
   - Log all payment attempts and outcomes
   - Include error messages for failed payments

## Additional Features to Consider

1. **Email Receipts**
   - Paystack can send automatic receipts
   - Configure in your Paystack dashboard settings

2. **Multi-currency Support**
   - Set up multiple currencies if needed
   - Configure exchange rates in your pricing

3. **Split Payments**
   - Use Paystack's split payment feature if working with partners

## Localization Features

1. **Local Payment Methods**
   - Enable USSD payments for users without cards
   - Support bank transfers for Nigerian users
   - Enable mobile money for Ghanaian users

2. **Local Phone Number Format**
   - Format phone numbers correctly for your region
   - For Nigerian numbers, use format `+234xxxxxxxxxx`

## Monitoring and Analytics

1. **Dashboard Monitoring**
   - Monitor payments in the Paystack Dashboard
   - Use the Transactions section to view payment history

2. **Payment Analytics**
   - Track conversion rates
   - Analyze payment success rates by channel

## Troubleshooting

1. **Common Issues**
   - Webhook not receiving events: Check URL and firewall settings
   - Payment verification failing: Check API keys and references
   - Currency mismatches: Ensure frontend and backend use same currency

2. **Debugging Tools**
   - Use Paystack's test mode
   - Check webhook logs in Paystack Dashboard
   - Enable detailed logging in your application

For more information, refer to the [Paystack API Documentation](https://paystack.com/docs/api/).

## Regional Compliance

1. **KYC Requirements**
   - Be aware of regional Know Your Customer requirements
   - Collect necessary information from customers

2. **Tax Considerations**
   - Implement appropriate tax calculations
   - Issue proper receipts according to local regulations

3. **Data Protection**
   - Comply with data protection laws in your region
   - Implement appropriate privacy policies