require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const logger = require('./utils/logger');
const database = require('./config/database');
const websocketService = require('./services/websocketService');
const webhookService = require('./services/webhookService');

// Import routes
const authRoutes = require('./routes/auth');
const subscriptionRoutes = require('./routes/subscriptions');
const webhookRoutes = require('./routes/webhooks');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(morgan('combined', { stream: logger.stream }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/webhooks', webhookRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'MultiversX WebSocket Subscription Service'
  });
});

// API documentation
app.get('/api', (req, res) => {
  res.json({
    name: 'MultiversX WebSocket Subscription API',
    version: '1.0.0',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        me: 'GET /api/auth/me'
      },
      subscriptions: {
        list: 'GET /api/subscriptions',
        create: 'POST /api/subscriptions',
        get: 'GET /api/subscriptions/:id',
        update: 'PUT /api/subscriptions/:id',
        delete: 'DELETE /api/subscriptions/:id',
        toggle: 'POST /api/subscriptions/:id/toggle'
      },
      webhooks: {
        validate: 'POST /api/webhooks/validate',
        stats: 'GET /api/webhooks/stats/:subscriptionId'
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
  logger.info('Received shutdown signal, starting graceful shutdown...');
  
  try {
    // Close WebSocket connections
    await websocketService.cleanup();
    
    // Close database connection
    await database.close();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Initialize and start server
async function startServer() {
  try {
    // Ensure database tables are created
    await database.ensureInitialized();
    // Test database connection
    await database.get('SELECT 1 as test');
    logger.info('Database connection established');

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API docs: http://localhost:${PORT}/api`);
    });

    // Initialize WebSocket connections for active subscriptions
    await initializeActiveSubscriptions();
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function initializeActiveSubscriptions() {
  try {
    const activeSubscriptions = await database.query(`
      SELECT s.*, u.address as user_address 
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      WHERE s.is_active = 1
    `);

    logger.info(`Found ${activeSubscriptions.length} active subscriptions to initialize`);

    for (const subscription of activeSubscriptions) {
      try {
        await websocketService.createSubscription(
          subscription.id,
          JSON.parse(subscription.filters),
          subscription.network
        );
        logger.info(`Initialized subscription ${subscription.id} for user ${subscription.user_address}`);
      } catch (error) {
        logger.error(`Failed to initialize subscription ${subscription.id}:`, error.message);
        // Optionally disable failed subscriptions
        // await database.run('UPDATE subscriptions SET is_active = 0 WHERE id = ?', [subscription.id]);
      }
    }
  } catch (error) {
    logger.error('Error initializing active subscriptions:', error);
  }
}

startServer();

module.exports = app; // For testing