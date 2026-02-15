const express = require('express');
const router = express.Router();
const database = require('../config/database');
const websocketService = require('../services/websocketService');
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

// Get all subscriptions for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const subscriptions = await database.query(`
      SELECT * FROM subscriptions 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `, [req.user.id]);

    res.json({
      success: true,
      subscriptions: subscriptions.map(sub => ({
        ...sub,
        filters: JSON.parse(sub.filters)
      }))
    });
  } catch (error) {
    logger.error('Get subscriptions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single subscription
router.get('/:id', authenticate, async (req, res) => {
  try {
    const subscription = await database.get(`
      SELECT * FROM subscriptions 
      WHERE id = ? AND user_id = ?
    `, [req.params.id, req.user.id]);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({
      success: true,
      subscription: {
        ...subscription,
        filters: JSON.parse(subscription.filters)
      }
    });
  } catch (error) {
    logger.error('Get subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new subscription
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, webhook_url, filters, network = 'mainnet' } = req.body;

    // Validation
    if (!name || !webhook_url || !filters) {
      return res.status(400).json({ error: 'Name, webhook_url, and filters are required' });
    }

    // Validate webhook URL
    const webhookValidation = await webhookService.validateWebhookUrl(webhook_url);
    if (!webhookValidation.valid) {
      return res.status(400).json({ 
        error: 'Invalid webhook URL', 
        details: webhookValidation.error 
      });
    }

    // Validate filters
    const filterKeys = Object.keys(filters).filter(key => filters[key]);
    if (filterKeys.length === 0) {
      return res.status(400).json({ error: 'At least one filter must be provided' });
    }

    // Validate network
    const validNetworks = ['mainnet', 'testnet', 'devnet'];
    if (!validNetworks.includes(network)) {
      return res.status(400).json({ error: 'Invalid network. Must be one of: mainnet, testnet, devnet' });
    }

    // Create subscription in database
    const result = await database.run(`
      INSERT INTO subscriptions (user_id, name, webhook_url, filters, network, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `, [
      req.user.id,
      name,
      webhook_url,
      JSON.stringify(filters),
      network
    ]);

    const subscriptionId = result.id;

    // Create WebSocket subscription
    try {
      await websocketService.createSubscription(subscriptionId, filters, network);
      
      const subscription = await database.get('SELECT * FROM subscriptions WHERE id = ?', [subscriptionId]);
      
      res.status(201).json({
        success: true,
        message: 'Subscription created successfully',
        subscription: {
          ...subscription,
          filters: JSON.parse(subscription.filters)
        }
      });
    } catch (websocketError) {
      // If WebSocket fails, delete the database entry
      await database.run('DELETE FROM subscriptions WHERE id = ?', [subscriptionId]);
      throw websocketError;
    }
  } catch (error) {
    logger.error('Create subscription error:', error);
    res.status(500).json({ 
      error: 'Failed to create subscription',
      details: error.message 
    });
  }
});

// Update subscription
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, webhook_url, filters, network, is_active } = req.body;
    
    // Check if subscription exists and belongs to user
    const existing = await database.get(`
      SELECT * FROM subscriptions 
      WHERE id = ? AND user_id = ?
    `, [req.params.id, req.user.id]);

    if (!existing) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Prepare update data
    const updateData = {
      name: name !== undefined ? name : existing.name,
      webhook_url: webhook_url !== undefined ? webhook_url : existing.webhook_url,
      filters: filters !== undefined ? JSON.stringify(filters) : existing.filters,
      network: network !== undefined ? network : existing.network,
      is_active: is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      updated_at: new Date().toISOString()
    };

    // Validate webhook URL if provided
    if (webhook_url !== undefined) {
      const webhookValidation = await webhookService.validateWebhookUrl(webhook_url);
      if (!webhookValidation.valid) {
        return res.status(400).json({ 
          error: 'Invalid webhook URL', 
          details: webhookValidation.error 
        });
      }
    }

    // Validate filters if provided
    if (filters !== undefined) {
      const filterKeys = Object.keys(filters).filter(key => filters[key]);
      if (filterKeys.length === 0) {
        return res.status(400).json({ error: 'At least one filter must be provided' });
      }
    }

    // Update in database
    await database.run(`
      UPDATE subscriptions 
      SET name = ?, webhook_url = ?, filters = ?, network = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `, [
      updateData.name,
      updateData.webhook_url,
      updateData.filters,
      updateData.network,
      updateData.is_active,
      updateData.updated_at,
      req.params.id
    ]);

    // Update WebSocket subscription
    try {
      // Remove old subscription
      await websocketService.removeSubscription(req.params.id);
      
      // Create new subscription if active
      if (updateData.is_active) {
        const filtersToUse = filters !== undefined ? filters : JSON.parse(existing.filters);
        const networkToUse = network !== undefined ? network : existing.network;
        await websocketService.createSubscription(req.params.id, filtersToUse, networkToUse);
      }
    } catch (websocketError) {
      logger.error('WebSocket update error:', websocketError);
      // Don't fail the entire request, just log the error
    }

    const updated = await database.get('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    
    res.json({
      success: true,
      message: 'Subscription updated successfully',
      subscription: {
        ...updated,
        filters: JSON.parse(updated.filters)
      }
    });
  } catch (error) {
    logger.error('Update subscription error:', error);
    res.status(500).json({ 
      error: 'Failed to update subscription',
      details: error.message 
    });
  }
});

// Delete subscription
router.delete('/:id', authenticate, async (req, res) => {
  try {
    // Check if subscription exists and belongs to user
    const existing = await database.get(`
      SELECT * FROM subscriptions 
      WHERE id = ? AND user_id = ?
    `, [req.params.id, req.user.id]);

    if (!existing) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Remove WebSocket subscription
    await websocketService.removeSubscription(req.params.id);

    // Delete from database
    await database.run('DELETE FROM subscriptions WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      message: 'Subscription deleted successfully'
    });
  } catch (error) {
    logger.error('Delete subscription error:', error);
    res.status(500).json({ 
      error: 'Failed to delete subscription',
      details: error.message 
    });
  }
});

// Toggle subscription active/inactive
router.post('/:id/toggle', authenticate, async (req, res) => {
  try {
    const { is_active } = req.body;

    if (is_active === undefined) {
      return res.status(400).json({ error: 'is_active field is required' });
    }

    // Check if subscription exists and belongs to user
    const existing = await database.get(`
      SELECT * FROM subscriptions 
      WHERE id = ? AND user_id = ?
    `, [req.params.id, req.user.id]);

    if (!existing) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Update active status
    await database.run(
      'UPDATE subscriptions SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [is_active ? 1 : 0, req.params.id]
    );

    // Update WebSocket subscription
    if (is_active) {
      // Create subscription
      await websocketService.createSubscription(
        req.params.id,
        JSON.parse(existing.filters),
        existing.network
      );
    } else {
      // Remove subscription
      await websocketService.removeSubscription(req.params.id);
    }

    const updated = await database.get('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    
    res.json({
      success: true,
      message: `Subscription ${is_active ? 'activated' : 'deactivated'} successfully`,
      subscription: {
        ...updated,
        filters: JSON.parse(updated.filters)
      }
    });
  } catch (error) {
    logger.error('Toggle subscription error:', error);
    res.status(500).json({ 
      error: 'Failed to toggle subscription',
      details: error.message 
    });
  }
});

module.exports = router;