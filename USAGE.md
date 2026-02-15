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

### WebSocket Connection Issues
1. Check MultiversX API status
2. Verify network (mainnet/testnet/devnet)
3. Check firewall/port settings
4. Review backend logs

### Webhook Delivery Failures
1. Validate webhook URL
2. Check webhook server logs
3. Review `webhook_logs` table
4. Test with manual trigger

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