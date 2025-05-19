#!/bin/bash
# scripts/deploy.sh - Deployment script for Firebase

# Exit on error
set -e

echo "🚀 Starting deployment of Sherlock Bot..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found! Please install it using 'npm install -g firebase-tools'"
    exit 1
fi

# Check if user is logged in
if ! firebase projects:list &> /dev/null; then
    echo "❌ Not logged in to Firebase. Please run 'firebase login' first."
    exit 1
fi

# Check environment variables
if [ ! -f "functions/.env" ]; then
    echo "⚠️ No .env file found in functions directory."
    read -p "Do you want to copy .env.example to .env? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp functions/.env.example functions/.env
        echo "✅ Created .env file. Please edit it with your actual credentials."
        exit 1
    else
        echo "❌ Deployment aborted. Please create a .env file before deploying."
        exit 1
    fi
fi

# Install dependencies if needed
echo "📦 Installing dependencies..."
cd functions
npm install
cd ..

# Run linting
echo "🔍 Running linter..."
cd functions
npm run lint
cd ..

# Deploy to Firebase
echo "🔥 Deploying to Firebase..."
firebase deploy

echo "✅ Deployment complete!"