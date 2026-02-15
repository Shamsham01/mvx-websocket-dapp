#!/bin/bash

echo "📡 MultiversX WebSocket DApp API Examples"
echo "=========================================="
echo ""

API_URL="http://localhost:3001/api"

# Health check
echo "1. Health Check:"
curl -s "$API_URL/../health" | jq .
echo ""

# API documentation
echo "2. API Documentation:"
curl -s "$API_URL" | jq .
echo ""

# Example login (simulated - in real app use wallet signature)
echo "3. Example Login Request (structure):"
cat << EOF
curl -X POST "$API_URL/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{
    "address": "erd1...",
    "signature": "signature_here",
    "message": "Login to MultiversX WebSocket DApp"
  }'
EOF
echo ""
echo "Response would include JWT token for authenticated requests."
echo ""

# Example subscription creation (with token)
echo "4. Example Subscription Creation:"
cat << EOF
curl -X POST "$API_URL/subscriptions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{
    "name": "USDC Transfers",
    "webhook_url": "https://your-webhook.example.com/usdc",
    "filters": {
      "token": "USDC-c76f1f"
    },
    "network": "mainnet"
  }'
EOF
echo ""

# Example webhook validation
echo "5. Example Webhook Validation:"
cat << EOF
curl -X POST "$API_URL/webhooks/validate" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{
    "url": "https://your-webhook.example.com/receive"
  }'
EOF
echo ""

echo "🎯 Real-time WebSocket Flow:"
echo "1. User creates subscription with filters"
echo "2. Backend connects to MultiversX WebSocket API"
echo "3. When matching transfer occurs, webhook is sent"
echo "4. Delivery logs stored in database"
echo ""

echo "🔧 To test the full flow:"
echo "1. Start the backend: cd backend && npm start"
echo "2. Use the frontend at http://localhost:3000"
echo "3. Or use API directly with the examples above"
echo "4. Monitor logs: tail -f backend/logs/combined.log"