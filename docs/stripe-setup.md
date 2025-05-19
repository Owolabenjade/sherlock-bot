# Stripe Payment Integration Guide

This guide walks you through setting up Stripe payment processing for the Sherlock Bot project.

## Setting Up Stripe Account

1. **Create a Stripe Account**
   - Go to [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)
   - Sign up for a new account
   - Complete the verification process

2. **Get API Keys**
   - Go to Developers > API keys in the Stripe Dashboard
   - Note your Publishable Key and Secret Key
   - For development, use the test keys

## Creating a Product and Price

1. **Create a Product**
   - Go to Products > Add Product
   - Name: "CV Advanced Review"
   - Description: "In-depth CV analysis with detailed improvement recommendations"
   - Add any images if desired

2. **Set Pricing**
   - Set a price for your advanced review service
   - Choose the appropriate currency
   - Select One-time or Recurring (One-time is recommended for this service)
   - Note the Price ID (e.g., `price_1234abcd`) - you'll need this for your .env file

## Setting Up Webhook Endpoint

1. **Register Your Webhook**
   - Go to Developers > Webhooks > Add endpoint
   - URL: `https://us-central1-your-project-id.cloudfunctions.net/api/payment-webhook`
   - Events to send: `checkout.session.completed`
   - Click "Add endpoint"

2. **Get Webhook Secret**
   - After creating the webhook, click on it to view details
   - Reveal the Signing Secret
   - Add this to your .env file as `STRIPE_WEBHOOK_SECRET`

## Testing Payments

1. **Test Cards**
   - Use Stripe's test cards for development:
     - Success: `4242 4242 4242 4242`
     - Decline: `4000 0000 0000 0002`
     - More test cards in [Stripe documentation](https://stripe.com/docs/testing#cards)

2. **Test Checkout Flow**
   - Send an "Advanced" request to your WhatsApp bot
   - Follow the payment link
   - Complete payment using a test card
   - Verify webhook event is received

## Security Best Practices

1. **Validate Webhooks**
   - Always verify webhook signatures
   - Implement the signature verification code from the Stripe documentation

2. **Handle Payment Intents Properly**
   - Use `session.payment_status` to verify payment status
   - Don't rely solely on the webhook event type

3. **Idempotency**
   - Implement idempotency to prevent duplicate processing
   - Check if a payment has already been processed

## Production Considerations

1. **Switch to Live Mode**
   - After testing, switch to live mode in Stripe
   - Update API keys in your .env file
   - Test with a real payment

2. **Set Up Stripe Radar**
   - Configure fraud prevention rules
   - Set up risk thresholds

3. **Tax Considerations**
   - Set up tax rates if applicable
   - Consider using Stripe Tax for automatic tax calculation

## Handling Payment Failures

1. **Customer Communication**
   - Send clear messages when payments fail
   - Provide easy ways to retry

2. **Logging**
   - Log all payment attempts and outcomes
   - Include error messages for failed payments

## Additional Features to Consider

1. **Custom Checkout Pages**
   - Customize the checkout experience
   - Add your logo and branding

2. **Discounts and Promotions**
   - Set up coupon codes
   - Create limited-time offers

3. **Receipts and Invoices**
   - Configure automatic receipt emails
   - Set up custom invoice templates

## Monitoring and Analytics

1. **Dashboard Monitoring**
   - Monitor payments in the Stripe Dashboard
   - Set up alerts for failed payments

2. **Payment Analytics**
   - Track conversion rates
   - Analyze payment patterns

## Troubleshooting

1. **Common Issues**
   - Webhook not receiving events
   - Payment success not being recorded
   - Session expiration

2. **Debugging Tools**
   - Use Stripe CLI for local testing
   - Check webhook logs in Stripe Dashboard
   - Enable detailed logging in your application

For more information, refer to the [Stripe API Documentation](https://stripe.com/docs/api).