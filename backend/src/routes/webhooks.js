const express = require('express');
const router = express.Router();
const database = require('../config/database');
const webhookService = require('../services/webhookService');
const logger = require('../utils/logger');

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
    
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

// Validate webhook URL
router.post('/validate', authenticate, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const validation = await webhookService.validateWebhookUrl(url);
    
    res.json({
      success: true,
      validation
    });
  } catch (error) {
    logger.error('Validate webhook error:', error);
    res.status(500).json({ 
      error: 'Failed to validate webhook URL',
      details: error.message 
    });
  }
});

// Get webhook delivery stats for a subscription
router.get('/stats/:subscriptionId', authenticate, async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    // Verify subscription belongs to user
    const subscription = await database.get(`
      SELECT s.* FROM subscriptions s
      WHERE s.id = ? AND s.user_id = ?
    `, [subscriptionId, req.user.id]);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const stats = await webhookService.getDeliveryStats(subscriptionId);
    
    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        name: subscription.name,
        webhook_url: subscription.webhook_url
      },
      ...stats
    });
  } catch (error) {
    logger.error('Get webhook stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get webhook stats',
      details: error.message 
    });
  }
});

// Test webhook delivery (manual trigger)
router.post('/test/:subscriptionId', authenticate, async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { testData } = req.body;

    // Verify subscription belongs to user
    const subscription = await database.get(`
      SELECT s.* FROM subscriptions s
      WHERE s.id = ? AND s.user_id = ?
    `, [subscriptionId, req.user.id]);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Create test transfer data
    const testTransfer = testData || {
      txHash: 'test-' + Date.now(),
      sender: 'erd1test...',
      receiver: 'erd1test...',
      status: 'success',
      timestamp: Math.floor(Date.now() / 1000),
      value: '1000000000000000000', // 1 EGLD
      function: 'transfer',
      action: {
        category: 'transfer',
        name: 'transfer',
        description: 'Test transfer',
        arguments: {
          transfers: [
            {
              type: 'FungibleESDT',
              ticker: 'TEST',
              token: 'TEST-123456',
              decimals: 18,
              value: '1000000000000000000'
            }
          ]
        }
      }
    };

    // Deliver test webhook
    const result = await webhookService.deliverWebhook(subscription, testTransfer);
    
    res.json({
      success: true,
      message: 'Test webhook sent',
      testTransfer,
      deliveryResult: result
    });
  } catch (error) {
    logger.error('Test webhook error:', error);
    res.status(500).json({ 
      error: 'Failed to send test webhook',
      details: error.message 
    });
  }
});

// Get recent webhook deliveries for user
router.get('/deliveries', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const deliveries = await database.query(`
      SELECT 
        wl.*,
        s.name as subscription_name,
        s.webhook_url
      FROM webhook_logs wl
      JOIN subscriptions s ON wl.subscription_id = s.id
      WHERE s.user_id = ?
      ORDER BY wl.delivered_at DESC
      LIMIT ? OFFSET ?
    `, [req.user.id, limit, offset]);

    const total = await database.get(`
      SELECT COUNT(*) as count
      FROM webhook_logs wl
      JOIN subscriptions s ON wl.subscription_id = s.id
      WHERE s.user_id = ?
    `, [req.user.id]);

    res.json({
      success: true,
      deliveries: deliveries.map(d => ({
        ...d,
        transfer_data: JSON.parse(d.transfer_data)
      })),
      pagination: {
        total: total?.count || 0,
        limit,
        offset,
        hasMore: offset + deliveries.length < (total?.count || 0)
      }
    });
  } catch (error) {
    logger.error('Get deliveries error:', error);
    res.status(500).json({ 
      error: 'Failed to get webhook deliveries',
      details: error.message 
    });
  }
});

module.exports = router;