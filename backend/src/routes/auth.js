const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const database = require('../config/database');
const logger = require('../utils/logger');
const { NativeAuthServer } = require('@multiversx/sdk-native-auth-server');

// Native Auth server for wallet signature verification
const getNativeAuthServer = () => {
  const apiUrl =
    process.env.MVX_NATIVE_AUTH_API ||
    process.env.MVX_API_MAINNET ||
    process.env.MVX_API_DEVNET ||
    'https://api.multiversx.com';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return new NativeAuthServer({
    apiUrl,
    acceptedOrigins: ['*', frontendUrl, 'http://localhost:3000', 'https://localhost:3000'],
    maxExpirySeconds: 86400, // 24 hours
  });
};

// Simple authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists
    const user = await database.get('SELECT * FROM users WHERE address = ?', [decoded.address]);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Login with MultiversX Native Auth (secure wallet signature)
router.post('/login/native', async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    const nativeAuthServer = getNativeAuthServer();
    const result = await nativeAuthServer.validate(accessToken);
    const address = result.address;

    // Create or update user
    let user = await database.get('SELECT * FROM users WHERE address = ?', [address]);

    if (!user) {
      const dbResult = await database.run(
        'INSERT INTO users (address) VALUES (?)',
        [address]
      );
      user = { id: dbResult.id, address };
      logger.info(`New user created (Native Auth): ${address}`);
    } else {
      await database.run(
        'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
      );
      logger.info(`User logged in (Native Auth): ${address}`);
    }

    const token = jwt.sign(
      { address: user.address, userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, address: user.address },
    });
  } catch (error) {
    logger.error('Native Auth login error:', error);
    const status = error.name === 'NativeAuthOriginNotAcceptedError' ? 403 : 401;
    res.status(status).json({
      error: error.message || 'Invalid or expired access token',
    });
  }
});

// Login with MultiversX wallet signature (legacy - NOT verified, for dev only)
router.post('/login', async (req, res) => {
  try {
    const { address, signature, message } = req.body;

    if (!address || !signature || !message) {
      return res.status(400).json({ error: 'Address, signature, and message are required' });
    }

    // TODO: In production, verify the signature against the message
    // For now, we'll trust the client and just create/update the user
    
    // Create or update user
    let user = await database.get('SELECT * FROM users WHERE address = ?', [address]);
    
    if (!user) {
      const result = await database.run(
        'INSERT INTO users (address) VALUES (?)',
        [address]
      );
      user = { id: result.id, address };
      logger.info(`New user created: ${address}`);
    } else {
      await database.run(
        'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
      );
      logger.info(`User logged in: ${address}`);
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        address: user.address,
        userId: user.id 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        address: user.address
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout (client-side token destruction)
router.post('/logout', authenticate, (req, res) => {
  // In a stateless JWT system, logout is client-side
  // We could implement token blacklisting if needed
  res.json({ success: true, message: 'Logged out successfully' });
});

// Get current user info
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = req.user;
    
    // Get user's subscription count
    const subscriptionStats = await database.get(`
      SELECT 
        COUNT(*) as total_subscriptions,
        COALESCE(SUM(CASE WHEN is_active THEN 1 ELSE 0 END), 0) as active_subscriptions
      FROM subscriptions 
      WHERE user_id = ?
    `, [user.id]);

    res.json({
      user: {
        id: user.id,
        address: user.address,
        created_at: user.created_at
      },
      stats: subscriptionStats || {
        total_subscriptions: 0,
        active_subscriptions: 0
      }
    });
  } catch (error) {
    logger.error('Get user info error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dashboard analytics for current user
router.get('/dashboard-analytics', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const subscriptionStats = await database.get(`
      SELECT
        COUNT(*)::int AS total_subscriptions,
        COALESCE(SUM(CASE WHEN is_active THEN 1 ELSE 0 END), 0)::int AS active_subscriptions
      FROM subscriptions
      WHERE user_id = ?
    `, [userId]);

    const webhookStats = await database.get(`
      SELECT
        COUNT(wl.id)::int AS total_webhook_calls,
        COALESCE(SUM(CASE WHEN wl.status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END), 0)::int AS successful_webhook_calls,
        COALESCE(SUM(CASE WHEN wl.status_code IS NULL OR wl.status_code < 200 OR wl.status_code >= 300 THEN 1 ELSE 0 END), 0)::int AS failed_webhook_calls
      FROM subscriptions s
      LEFT JOIN webhook_logs wl ON wl.subscription_id = s.id
      WHERE s.user_id = ?
    `, [userId]);

    const subscriptions = await database.query(`
      SELECT
        s.id,
        s.name,
        s.is_active,
        COUNT(wl.id)::int AS total_webhook_calls
      FROM subscriptions s
      LEFT JOIN webhook_logs wl ON wl.subscription_id = s.id
      WHERE s.user_id = ?
      GROUP BY s.id, s.name, s.is_active, s.created_at
      ORDER BY total_webhook_calls DESC, s.created_at DESC
    `, [userId]);

    const callsPerDay = await database.query(`
      SELECT
        wl.subscription_id,
        s.name AS subscription_name,
        DATE_TRUNC('day', wl.delivered_at)::date AS day,
        COUNT(wl.id)::int AS total_calls
      FROM webhook_logs wl
      JOIN subscriptions s ON s.id = wl.subscription_id
      WHERE s.user_id = ?
        AND wl.delivered_at >= NOW() - INTERVAL '45 days'
      GROUP BY wl.subscription_id, s.name, DATE_TRUNC('day', wl.delivered_at)
      ORDER BY day ASC
    `, [userId]);

    const totalWebhookCalls = webhookStats?.total_webhook_calls || 0;
    const successfulWebhookCalls = webhookStats?.successful_webhook_calls || 0;
    const failedWebhookCalls = webhookStats?.failed_webhook_calls || 0;
    const successRate = totalWebhookCalls
      ? Number(((successfulWebhookCalls / totalWebhookCalls) * 100).toFixed(1))
      : 0;

    res.json({
      success: true,
      stats: {
        total_subscriptions: subscriptionStats?.total_subscriptions || 0,
        active_subscriptions: subscriptionStats?.active_subscriptions || 0,
        total_webhook_calls: totalWebhookCalls,
        successful_webhook_calls: successfulWebhookCalls,
        failed_webhook_calls: failedWebhookCalls,
        success_rate: successRate
      },
      charts: {
        subscriptions,
        calls_per_day: callsPerDay
      }
    });
  } catch (error) {
    logger.error('Get dashboard analytics error:', error);
    res.status(500).json({ error: 'Failed to load dashboard analytics' });
  }
});

module.exports = router;