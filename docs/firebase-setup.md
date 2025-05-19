# Firebase Setup Guide for Sherlock Bot

This guide walks you through setting up the Firebase project for Sherlock Bot.

## Creating a Firebase Project

1. **Sign in to Firebase Console**
   - Go to [https://console.firebase.google.com/](https://console.firebase.google.com/)
   - Sign in with your Google account

2. **Create a new project**
   - Click "Add project"
   - Enter a project name (e.g., "Sherlock Bot")
   - Enable Google Analytics if desired
   - Click "Create project"

3. **Upgrade to Blaze Plan**
   - Navigate to the Upgrade button in the left sidebar
   - Select the Blaze (pay-as-you-go) plan
   - Follow the prompts to add a payment method
   - The Blaze plan is required for:
     - External API calls (Twilio, Stripe)
     - Scheduled Cloud Functions
     - Higher Storage and Firestore quotas

## Setting Up Firebase Services

### Firestore Database

1. **Create a Firestore database**
   - Go to "Firestore Database" in the left sidebar
   - Click "Create database"
   - Start in Production mode
   - Choose a location closest to your users

2. **Import security rules**
   - Go to the "Rules" tab
   - Copy and paste the rules from `firestore.rules` in this repository
   - Click "Publish"

### Storage

1. **Set up Firebase Storage**
   - Go to "Storage" in the left sidebar
   - Click "Get started"
   - Start in Production mode
   - Choose the same location as your Firestore database

2. **Import security rules**
   - Go to the "Rules" tab
   - Copy and paste the rules from `storage.rules` in this repository
   - Click "Publish"

### Cloud Functions

1. **Enable the Cloud Functions API**
   - Go to "Functions" in the left sidebar
   - Click "Get started" or "Upgrade project" if prompted
   - Follow the prompts to enable the API

## Setting Up Firebase CLI

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**
   ```bash
   firebase login
   ```

3. **Initialize the project**
   ```bash
   firebase init
   ```
   - Select "Firestore", "Functions", and "Storage"
   - Select the project you created
   - Use JavaScript for Functions
   - Say yes to ESLint
   - Say yes to installing dependencies

## Environment Configuration

1. **Create a .env file**
   ```bash
   cd functions
   cp .env.example .env
   ```

2. **Add your API keys and configuration**
   - Add your Twilio credentials
   - Add your Stripe credentials
   - Configure other settings as needed

## Deploying to Firebase

1. **Deploy everything**
   ```bash
   firebase deploy
   ```

2. **Or deploy specific services**
   ```bash
   firebase deploy --only functions
   firebase deploy --only firestore:rules
   firebase deploy --only storage:rules
   ```

## Testing Your Deployment

1. **Get your function URL**
   - After deployment, you'll see a URL for your Cloud Functions
   - The webhook URL will be something like:
     ```
     https://us-central1-your-project-id.cloudfunctions.net/api/webhook
     ```

2. **Configure Twilio with this URL**
   - Use this URL as your Twilio webhook endpoint

## Monitoring and Maintenance

1. **View logs**
   ```bash
   firebase functions:log
   ```

2. **Monitor usage in Firebase Console**
   - Check function invocations
   - Monitor storage usage
   - Track Firestore operations

3. **Set up Alerts**
   - Go to "Project settings" > "Integrations" > "Google Cloud Alerting"
   - Create alerts for high usage or errors

## Troubleshooting

- **Function deployment errors**
  - Check your Node.js version (should be 16+)
  - Check for syntax errors in your code
  - Verify environment variables are set correctly

- **Webhook not working**
  - Verify the URL is correct in Twilio
  - Check Cloud Function logs for errors
  - Test the webhook endpoint using a tool like Postman

- **Storage permission issues**
  - Check storage rules
  - Verify file paths match your rules
  - Check for typos in collection/document names

## Setting Up CI/CD with GitHub Actions

1. **Add Firebase secrets to GitHub**
   - Go to your GitHub repository > Settings > Secrets
   - Add the following secrets:
     - `FIREBASE_SERVICE_ACCOUNT`: Your Firebase service account JSON (base64 encoded)
     - `FIREBASE_PROJECT_ID`: Your Firebase project ID
     - All environment variables from your .env file

2. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial setup"
   git push
   ```

3. **Watch the GitHub Actions workflow**
   - Go to the "Actions" tab in your GitHub repository
   - Monitor the deployment workflow