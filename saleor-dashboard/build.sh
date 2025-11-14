#!/bin/bash

# Build script for Saleor Dashboard
# This script builds the dashboard locally to avoid memory issues during Docker build

set -e

echo "🏗️  Building Saleor Dashboard locally..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    HUSKY=0 npm ci --legacy-peer-deps --ignore-scripts
    echo ""
fi

# Load environment variables from .env.production
if [ -f ".env.production" ]; then
    echo "📝 Loading environment variables from .env.production"
    export $(cat .env.production | grep -v '^#' | xargs)
    echo ""
fi

# Run the build
echo "🚀 Running build..."
npm run build

echo ""
echo "✅ Build completed successfully!"
echo "📁 Build output is in ./build/ directory"
echo ""
echo "Next steps:"
echo "1. Run: docker-compose build dashboard"
echo "2. Run: docker-compose up -d dashboard"
