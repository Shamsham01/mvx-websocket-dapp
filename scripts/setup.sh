#!/bin/bash

set -e

echo "🚀 Setting up MultiversX WebSocket Subscription DApp..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo "🔧 Creating environment files..."
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env from example"
else
    echo "⚠️  backend/.env already exists, skipping..."
fi

echo "📁 Creating data directories..."
mkdir -p backend/data backend/logs

echo "✅ Setup complete!"
echo ""
echo "To run the application:"
echo "1. Start the backend:"
echo "   cd backend && npm start"
echo ""
echo "2. Start the frontend (in another terminal):"
echo "   cd frontend && npm start"
echo ""
echo "Or use Docker Compose:"
echo "   docker-compose up -d"
echo ""
echo "📡 Backend API: http://localhost:3001"
echo "🌐 Frontend: http://localhost:3000"
echo "📚 API Docs: http://localhost:3001/api"