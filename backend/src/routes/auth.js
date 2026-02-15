const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const database = require('../config/database');
const logger = require('../utils/logger');

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

// Login with MultiversX wallet signature
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
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_subscriptions
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

module.exports = router;