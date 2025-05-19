# Sherlock Bot - WhatsApp CV Review Service

A serverless WhatsApp-based CV review bot using Firebase Cloud Functions, Twilio's WhatsApp API, and Stripe for payments.

![Sherlock Bot Logo](docs/images/sherlock-bot-logo.png)

## Overview

Sherlock Bot allows users to:
- Upload their CV (PDF/DOCX) via WhatsApp
- Choose between Basic (free) or Advanced (paid) reviews
- Receive insights directly on WhatsApp
- Process payments seamlessly with Stripe
- Get detailed CV improvement recommendations

## Architecture

The project uses a serverless architecture built on Firebase:
- **Firebase Cloud Functions**: Handles webhooks, processing, and business logic
- **Firebase Firestore**: Stores user sessions and review results
- **Firebase Storage**: Securely stores CV files temporarily
- **Twilio WhatsApp API**: Provides the messaging interface
- **Stripe**: Handles payment processing

## Repository Structure

```
sherlock-bot/
│
├── functions/                      # Firebase Cloud Functions
│   ├── index.js                    # Main entry point
│   ├── src/
│   │   ├── config/                 # Configuration files
│   │   ├── controllers/            # Request handlers
│   │   ├── services/               # Business logic
│   │   ├── utils/                  # Utility functions
│   │   └── models/                 # Data models
│   │
│   ├── package.json                # Node.js dependencies
│   └── .env.example                # Environment variables template
│
├── firebase.json                   # Firebase configuration
├── firestore.rules                 # Security rules for Firestore
├── firestore.indexes.json          # Indexes for Firestore queries
├── storage.rules                   # Security rules for Firebase Storage
│
├── scripts/                        # Deployment scripts
│
├── .github/                        # GitHub Actions workflows
│   └── workflows/
│       └── deploy.yml              # CI/CD pipeline
│
├── docs/                           # Documentation
│
└── README.md                       # Project overview
```

## Setup Guide

### Prerequisites

- [Firebase account](https://firebase.google.com/) with Blaze (pay-as-you-go) plan
- [Twilio account](https://www.twilio.com/) with WhatsApp API access
- [Stripe account](https://stripe.com/) for payment processing
- [Node.js](https://nodejs.org/) (v16 or higher)
- [Firebase CLI](https://firebase.google.com/docs/cli)

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/sherlock-bot.git
   cd sherlock-bot
   ```

2. **Create a Firebase project**
   ```bash
   firebase login
   firebase projects:create sherlock-bot-xyz
   firebase use sherlock-bot-xyz
   ```

3. **Install dependencies**
   ```bash
   cd functions
   npm install
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

5. **Deploy to Firebase**
   ```bash
   cd ..
   ./scripts/deploy.sh
   ```

6. **Configure Twilio webhook**
   - In your Twilio console, set up the WhatsApp Sandbox
   - Configure the webhook URL to point to your Cloud Function
   ```
   https://us-central1-sherlock-bot-xyz.cloudfunctions.net/api/webhook
   ```

7. **Configure Stripe webhook**
   - In your Stripe dashboard, set up a webhook
   - Configure the endpoint to point to your Cloud Function
   ```
   https://us-central1-sherlock-bot-xyz.cloudfunctions.net/api/payment-webhook
   ```
   - Select the `checkout.session.completed` event

## Usage

Once set up, users can interact with the bot by:
1. Sending "Hi" or "Review CV" to your Twilio WhatsApp number
2. Choosing between Basic or Advanced review
3. Uploading their CV document
4. Receiving review feedback directly in WhatsApp

## Development

### Local Development

1. Start the Firebase emulators:
   ```bash
   firebase emulators:start
   ```

2. Set up Twilio to work with your local environment:
   - Use [ngrok](https://ngrok.com/) to expose your local server
   ```bash
   ngrok http 5001
   ```
   - Update your Twilio webhook URL to point to the ngrok URL

### Adding New Features

- Create new service files in `functions/src/services/`
- Extend controllers in `functions/src/controllers/`
- Update security rules as needed in `firestore.rules` and `storage.rules`

## Maintenance

### File Cleanup

Files are automatically deleted after 24 hours using a scheduled Cloud Function. This ensures data privacy and compliance.

### Monitoring

Use Firebase Console to monitor:
- Function invocations and errors
- Storage usage
- Firestore operations

## License

MIT License - See [LICENSE](LICENSE) for details.

## Contact

For questions or support, please contact [your-email@example.com](mailto:your-email@example.com)