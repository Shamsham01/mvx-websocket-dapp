# MultiversX WebSocket Subscription DApp - Usage Guide

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)
```bash
# Clone and navigate to project
cd mvx-websocket-dapp

# Set up environment (creates .env file)
cp backend/.env.example backend/.env

# Edit the .env file if needed
nano backend/.env

# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f
```

### Option 2: Manual Setup
```bash
# Install dependencies
./scripts/setup.sh

# Start backend (Terminal 1)
cd backend
npm start

# Start frontend (Terminal 2)
cd frontend
npm start
```

## 📡 Access Points
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api
- **Health Check**: http://localhost:3001/health

## 🔧 Configuration

### Backend Environment (.env)
```bash
# Server
PORT=3001
NODE_ENV=development

# Database
DB_PATH=./data/subscriptions.db

# Security - GENERATE A SECURE JWT SECRET!
JWT_SECRET=your-generated-jwt-secret-here  # See below for generation
JWT_EXPIRES_IN=7d

### Generating JWT Secret:
```bash
# Method 1: OpenSSL (recommended)
openssl rand -hex 32

# Method 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Method 3: Python
python3 -c "import secrets; print(secrets.token_hex(32))"

# Method 4: Use the provided script
./scripts/generate-env.sh
```

### Quick Setup with Auto-generated Secret:
```bash
cd mvx-websocket-dapp
./scripts/setup.sh  # Auto-generates JWT secret if openssl is available
```

# MultiversX API
MVX_API_MAINNET=https://api.multiversx.com
MVX_API_TESTNET=https://testnet-api.multiversx.com
MVX_API_DEVNET=https://devnet-api.multiversx.com

# Webhook Settings
WEBHOOK_TIMEOUT_MS=10000
WEBHOOK_MAX_RETRIES=3
```

### Frontend Environment
Create `.env` file in frontend directory:
```bash
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_ENV=development
```

## 🎯 API Endpoints

### Authentication
- `POST /api/auth/login` - Login with MultiversX wallet
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Subscriptions
- `GET /api/subscriptions` - List all subscriptions
- `POST /api/subscriptions` - Create new subscription
- `GET /api/subscriptions/:id` - Get subscription details
- `PUT /api/subscriptions/:id` - Update subscription
- `DELETE /api/subscriptions/:id` - Delete subscription
- `POST /api/subscriptions/:id/toggle` - Toggle active status

### Webhooks
- `POST /api/webhooks/validate` - Validate webhook URL
- `GET /api/webhooks/stats/:subscriptionId` - Get delivery stats
- `POST /api/webhooks/test/:subscriptionId` - Send test webhook
- `GET /api/webhooks/deliveries` - Get delivery history

## 📝 Subscription Filter Examples

### Filter by Token (USDC)
```json
{
  "name": "USDC Transfers",
  "webhook_url": "https://your-webhook.com/usdc",
  "filters": {
    "token": "USDC-c76f1f"
  },
  "network": "mainnet"
}
```

### Filter by Address (Any Activity)
```json
{
  "name": "My Wallet Activity",
  "webhook_url": "https://your-webhook.com/my-wallet",
  "filters": {
    "address": "erd1q...your_address"
  },
  "network": "mainnet"
}
```

### Filter by Sender and Function
```json
{
  "name": "My Contract Calls",
  "webhook_url": "https://your-webhook.com/contract",
  "filters": {
    "sender": "erd1q...sender_address",
    "function": "swap"
  },
  "network": "mainnet"
}
```

### Filter by Receiver and Token
```json
{
  "name": "Payments to My Business",
  "webhook_url": "https://your-webhook.com/payments",
  "filters": {
    "receiver": "erd1q...business_address",
    "token": "EGLD"
  },
  "network": "mainnet"
}
```

### Swaps on OneDEX (Receiver + Function + Token)
Use MultiversX API filters only. Example for swaps where user pays EGLD:

```json
{
  "name": "OneDEX Swaps (EGLD)",
  "webhook_url": "https://your-webhook.com/onedex-swaps",
  "filters": {
    "receiver": "erd1qqqqqqqqqqqqqpgqn7wy983tdh5katf5yn5nl2gcdflf4azh6jtsggjx9a",
    "function": "swap",
    "token": "EGLD"
  },
  "network": "mainnet"
}
```

- **receiver**: OneDEX Aggregator contract
- **function**: `swap` (top-level call)
- **token**: Payment/input token (MultiversX API filter)

## 📡 WebSocket Data Flow & Filtering

**How it works:**
1. **MultiversX WebSocket** sends `customTransferUpdate` events (raw blockchain transfers).
2. **App filters** each transfer:
   - **Status**: Only `status=success` transfers are processed (failed/pending are skipped).
   - **Per-subscription**: Each transfer is checked against each subscription's filters (function, receiver, sender, token, address).
3. **Webhook delivery**: Only transfers that match a subscription's filters are sent to that subscription's webhook URL.

**Function filter (client-side only):** The MultiversX API's `function` filter does not work reliably when combined with address/sender/receiver (e.g. returns no events for `{ address, function: "swap" }`). The app therefore:
- Sends only `address`, `sender`, `receiver`, `token`, `relayer` to the API
- Filters by `function` **client-side** in `matchesFilters()`
- **Requirement:** `function` must be combined with at least one of: `address`, `sender`, `receiver`, `token`

**Function name extraction:** The app reads the function from multiple transfer fields:
- `transfer.function` (top-level)
- `transfer.action.arguments.functionName` (SCRs, DEX swaps)
- `transfer.action.name` (fallback)

**Note:** Multiple subscriptions share one WebSocket connection per network. Client-side filtering ensures each subscription only receives events matching its filters.

## 🔐 Authentication Flow

1. **User connects wallet** using xPortal or MultiversX wallet
2. **Sign message** to prove ownership
3. **Backend verifies signature** and issues JWT token
4. **Token used for API calls** in Authorization header

## 🛠️ Development

### Database Schema
The SQLite database contains:
- `users` - User accounts (MultiversX addresses)
- `subscriptions` - User subscriptions with filters
- `webhook_logs` - Delivery history and stats

### Adding New Features
1. **New API endpoint**: Add route in `backend/src/routes/`
2. **New service**: Create in `backend/src/services/`
3. **Frontend component**: Add in `frontend/src/components/`
4. **Database changes**: Update `backend/src/config/database.js`

### Testing
```bash
# Backend tests
cd backend
npm test

# Manual API testing
curl -X GET http://localhost:3001/health
curl -X GET http://localhost:3001/api
```

## 🐳 Docker Commands

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Remove volumes (clears database)
docker-compose down -v

# Rebuild specific service
docker-compose build backend

# Check status
docker-compose ps
```

## 📊 Monitoring

### Logs
- Backend logs: `backend/logs/` directory
- Docker logs: `docker-compose logs -f`
- Webhook delivery logs: Database `webhook_logs` table

### Health Checks
- API: `GET /health`
- Database: Automatic connection testing
- WebSocket: Automatic reconnection

## 🔒 Security Considerations

1. **JWT Secret**: Change default in production
2. **Webhook URLs**: Validate before accepting
3. **Rate Limiting**: Implement if needed
4. **CORS**: Configure allowed origins
5. **Input Validation**: All user input validated
6. **Error Handling**: No sensitive data in errors

## 🚨 Troubleshooting

### WebSocket Not Triggering (No webhook, nothing in Supabase)

**1. Check backend logs (Render / PaaS dashboard)**

Look for these log lines:
- `Received X transfer(s) from mainnet, Y active subscription(s)` — WebSocket receiving; Y must be > 0
- `Found X active subscriptions to initialize` — On startup; X must be > 0
- `Transfer <txHash> matched subscription X` — Transfer passed filters, webhook sent
- `Transfer <txHash> did not match any subscription (receiver=..., function=...)` — Why it didn't match
- `Delivering webhook for subscription X` — Webhook delivery attempted
- `WebSocket connected to mainnet` — Connection is active

If `Y active subscription(s)` is 0, subscriptions were not loaded (check DB, is_active).

**2. Check webhook delivery history**

- **API**: `GET /api/webhooks/deliveries` (with `Authorization: Bearer <JWT>`)
- **Per-subscription stats**: `GET /api/webhooks/stats/:subscriptionId`
- **Test webhook**: `POST /api/webhooks/test/:subscriptionId` — sends a fake transfer to verify Make.com receives it

**3. Verify subscription is active**

- Subscriptions list: ensure "Buy REWARD" has the toggle ON
- After creating/editing, the backend re-subscribes to the WebSocket; a restart may be needed

**4. MultiversX WebSocket behavior**

Only MultiversX API filters are used: **sender**, **receiver**, **relayer**, **function**, **token**, **address**. Webhooks are delivered only for transfers with **status=success**.

**5. Test with manual webhook**

Use the test endpoint to confirm Make.com → Supabase works:
```bash
curl -X POST https://your-api.com/api/webhooks/test/YOUR_SUBSCRIPTION_ID \
  -H "Authorization: Bearer YOUR_JWT"
```

### WebSocket Connection Issues
1. Check MultiversX API status
2. Verify network (mainnet/testnet/devnet)
3. Check firewall/port settings
4. Review backend logs

### Webhook Delivery Failures
1. Validate webhook URL
2. Check webhook server logs
3. Review `webhook_logs` table via `GET /api/webhooks/deliveries`
4. Test with manual trigger: `POST /api/webhooks/test/:subscriptionId`

### Database Issues
1. Check file permissions for `data/` directory
2. Verify SQLite is working
3. Check disk space

## 📈 Scaling Considerations

For production deployment:
1. **Database**: Switch to PostgreSQL/MySQL
2. **Caching**: Add Redis for rate limiting
3. **Queue**: Use RabbitMQ/Kafka for webhook delivery
4. **Load Balancer**: Multiple backend instances
5. **Monitoring**: Add Prometheus/Grafana
6. **Alerting**: Set up for failed webhooks

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

## 📄 License

MIT License - See LICENSE file

## 🙏 Acknowledgments

- MultiversX team for the WebSocket API
- Socket.io for real-time communication
- Open source community for tools and libraries