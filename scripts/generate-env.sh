#!/bin/bash

set -e

echo "🔐 Generating JWT Secret and Environment Configuration..."
echo ""

# Check if openssl is available
if command -v openssl &> /dev/null; then
    JWT_SECRET=$(openssl rand -hex 32)
    echo "✅ Generated JWT secret using OpenSSL"
elif command -v node &> /dev/null; then
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    echo "✅ Generated JWT secret using Node.js"
elif command -v python3 &> /dev/null; then
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    echo "✅ Generated JWT secret using Python"
else
    echo "⚠️  Could not generate JWT secret automatically"
    echo "   Please install one of: openssl, node, or python3"
    echo "   Or generate manually with: openssl rand -hex 32"
    exit 1
fi

echo ""
echo "📝 Creating .env file..."

cat > ../backend/.env << EOF
# Server Configuration
PORT=3001
NODE_ENV=development

# Database
DB_PATH=./data/subscriptions.db

# JWT Authentication
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d

# MultiversX API
MVX_API_MAINNET=https://api.multiversx.com
MVX_API_TESTNET=https://testnet-api.multiversx.com
MVX_API_DEVNET=https://devnet-api.multiversx.com

# Webhook Settings
WEBHOOK_TIMEOUT_MS=10000
WEBHOOK_MAX_RETRIES=3

# Logging
LOG_LEVEL=info
EOF

echo "✅ .env file created successfully!"
echo ""
echo "🔑 Your JWT Secret (keep this safe!):"
echo "$JWT_SECRET"
echo ""
echo "📋 Next steps:"
echo "1. Review the .env file: cat ../backend/.env"
echo "2. Start the application: docker-compose up -d"
echo "3. Access at: http://localhost:3000"
echo ""
echo "⚠️  Important:"
echo "   - Keep JWT_SECRET secure in production"
echo "   - Change JWT_SECRET if compromised"
echo "   - Use different secrets for different environments"