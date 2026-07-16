# MultiversX WebSocket Subscription DApp

A real-time WebSocket subscription service for MultiversX blockchain transfers with webhook forwarding.

## Features
- User authentication with MultiversX wallet (xPortal/sdk-dapp)
- Custom filter configuration (sender, receiver, function, token, address)
- Optional classified fungible-token movement delivery (BUY / SELL / OTHER) across the original root transaction
- Webhook URL management
- Real-time WebSocket subscriptions to MultiversX API
- Automatic forwarding of filtered transfers to user webhooks
- Subscription management (create/update/delete)

See `USAGE.md` for filter examples, including classified movement subscriptions.

## Architecture
- **Frontend**: React + TypeScript + sdk-dapp
- **Backend**: Node.js + Express + Socket.io client
- **Database**: SQLite (for simplicity) or PostgreSQL
- **Authentication**: MultiversX wallet login

## Project Structure
```
mvx-websocket-dapp/
├── frontend/          # React application
├── backend/           # Node.js API server
├── scripts/           # Deployment/utility scripts
├── docker-compose.yml # Container orchestration
└── README.md
```