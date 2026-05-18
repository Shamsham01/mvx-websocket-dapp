const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { parseJson } = require('../utils/parseJson');
const websocketService = require('../services/websocketService');
const webhookService = require('../services/webhookService');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/authenticate');
const { MAX_SUBSCRIPTIONS_PER_USER } = require('../constants/subscriptionLimits');
const { enrichFiltersWithTokenDecimals } = require('../services/tokenMetadata');

const hasFilterValue = (value) => {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return true;
};

const DELIVERY_OPTION_KEYS = ['onlyConfirmed', 'matchTopLevelOnly', 'egldOnly', 'tokenDecimals'];

const validateFilters = (filters) => {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    return 'Filters must be a valid object';
  }

  const filterKeys = Object.keys(filters).filter(
    (key) => !DELIVERY_OPTION_KEYS.includes(key) && hasFilterValue(filters[key])
  );
  if (filterKeys.length === 0) {
    return 'At least one filter must be provided';
  }

  const apiFilterKeys = ['address', 'sender', 'receiver', 'token', 'relayer'];
  const hasApiFilter =
    apiFilterKeys.some((k) => hasFilterValue(filters[k])) || filters.egldOnly === true;
  const hasAmountFilter = hasFilterValue(filters.amountMin) || hasFilterValue(filters.amountMax);

  if (hasFilterValue(filters.function) && !hasApiFilter) {
    return 'Function filter must be combined with at least one of: address, sender, receiver, token';
  }
  if (hasFilterValue(filters.tokenIdentifier) && !hasApiFilter) {
    return 'Token identifier filter must be combined with at least one of: address, sender, receiver, token';
  }
  if (hasFilterValue(filters.collectionIdentifier) && !hasApiFilter) {
    return 'Collection identifier filter must be combined with at least one of: address, sender, receiver, token';
  }
  if (hasAmountFilter && !hasApiFilter) {
    return 'Amount filter must be combined with at least one of: address, sender, receiver, token';
  }
  if (
    hasAmountFilter &&
    hasFilterValue(filters.tokenIdentifier) &&
    hasFilterValue(filters.collectionIdentifier)
  ) {
    return 'Amount with token identifier applies to ESDT; remove collection identifier or use amount without token identifier for EGLD';
  }

  return null;
};

router.get('/', authenticate, async (req, res) => {
  try {
    const subscriptions = await database.query(
      'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({
      success: true,
      maxSubscriptionsPerUser: MAX_SUBSCRIPTIONS_PER_USER,
      subscriptions: subscriptions.map(sub => ({ ...sub, filters: parseJson(sub.filters) }))
    });
  } catch (error) {
    logger.error('Get subscriptions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const subscription = await database.get(
      'SELECT * FROM subscriptions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!subscription) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ success: true, subscription: { ...subscription, filters: parseJson(subscription.filters) } });
  } catch (error) {
    logger.error('Get subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { name, webhook_url, filters, network = 'mainnet' } = req.body;
    if (!name || !webhook_url || !filters) {
      return res.status(400).json({ error: 'Name, webhook_url, and filters are required' });
    }
    const webhookValidation = await webhookService.validateWebhookUrl(webhook_url);
    if (!webhookValidation.valid) {
      return res.status(400).json({ error: 'Invalid webhook URL', details: webhookValidation.error });
    }
    const filtersError = validateFilters(filters);
    if (filtersError) return res.status(400).json({ error: filtersError });
    const validNetworks = ['mainnet', 'testnet', 'devnet'];
    if (!validNetworks.includes(network)) {
      return res.status(400).json({ error: 'Invalid network. Must be one of: mainnet, testnet, devnet' });
    }

    const resolvedFilters = await enrichFiltersWithTokenDecimals(filters, network);

    const countRow = await database.get(
      'SELECT COUNT(*)::int AS cnt FROM subscriptions WHERE user_id = ?',
      [req.user.id]
    );
    const currentCount = Number(countRow?.cnt ?? 0);
    if (currentCount >= MAX_SUBSCRIPTIONS_PER_USER) {
      return res.status(403).json({
        error: `Maximum of ${MAX_SUBSCRIPTIONS_PER_USER} subscriptions per wallet reached.`,
        code: 'SUBSCRIPTION_LIMIT',
        limit: MAX_SUBSCRIPTIONS_PER_USER,
        currentCount
      });
    }

    const result = await database.run(
      'INSERT INTO subscriptions (user_id, name, webhook_url, filters, network, is_active) VALUES (?, ?, ?, ?, ?, true)',
      [req.user.id, name, webhook_url, JSON.stringify(resolvedFilters), network]
    );
    const subscriptionId = result.id;
    let websocketError = null;
    try {
      await websocketService.createSubscription(subscriptionId, resolvedFilters, network);
    } catch (err) {
      logger.error('WebSocket subscription failed (subscription saved as inactive):', err.message);
      websocketError = err;
      await database.run('UPDATE subscriptions SET is_active = false WHERE id = ?', [subscriptionId]);
    }
    const subscription = await database.get('SELECT * FROM subscriptions WHERE id = ?', [subscriptionId]);
    res.status(201).json({
      success: true,
      message: websocketError
        ? 'Subscription created but WebSocket connection failed. You can try activating it from the subscriptions list.'
        : 'Subscription created successfully',
      subscription: { ...subscription, filters: parseJson(subscription.filters) },
      ...(websocketError && { warning: websocketError.message })
    });
  } catch (error) {
    logger.error('Create subscription error:', error);
    res.status(500).json({ error: 'Failed to create subscription', details: error.message });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, webhook_url, filters, network, is_active } = req.body;
    const existing = await database.get(
      'SELECT * FROM subscriptions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!existing) return res.status(404).json({ error: 'Subscription not found' });
    const updateData = {
      name: name !== undefined ? name : existing.name,
      webhook_url: webhook_url !== undefined ? webhook_url : existing.webhook_url,
      filters: filters !== undefined ? JSON.stringify(filters) : existing.filters,
      network: network !== undefined ? network : existing.network,
      is_active: is_active !== undefined ? !!is_active : existing.is_active,
      updated_at: new Date().toISOString()
    };
    if (webhook_url !== undefined) {
      const webhookValidation = await webhookService.validateWebhookUrl(webhook_url);
      if (!webhookValidation.valid) {
        return res.status(400).json({ error: 'Invalid webhook URL', details: webhookValidation.error });
      }
    }
    let resolvedFilters = filters;
    if (filters !== undefined) {
      const filtersError = validateFilters(filters);
      if (filtersError) return res.status(400).json({ error: filtersError });
      resolvedFilters = await enrichFiltersWithTokenDecimals(filters, updateData.network);
      updateData.filters = JSON.stringify(resolvedFilters);
    }
    await database.run(
      'UPDATE subscriptions SET name = ?, webhook_url = ?, filters = ?, network = ?, is_active = ?, updated_at = ? WHERE id = ?',
      [updateData.name, updateData.webhook_url, updateData.filters, updateData.network, updateData.is_active, updateData.updated_at, req.params.id]
    );
    try {
      await websocketService.removeSubscription(req.params.id);
      if (updateData.is_active) {
        const filtersToUse =
          filters !== undefined ? resolvedFilters : parseJson(existing.filters);
        const networkToUse = network !== undefined ? network : existing.network;
        await websocketService.createSubscription(req.params.id, filtersToUse, networkToUse);
      }
    } catch (websocketError) {
      logger.error('WebSocket update error:', websocketError);
    }
    const updated = await database.get('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Subscription updated successfully', subscription: { ...updated, filters: parseJson(updated.filters) } });
  } catch (error) {
    logger.error('Update subscription error:', error);
    res.status(500).json({ error: 'Failed to update subscription', details: error.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const existing = await database.get(
      'SELECT * FROM subscriptions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!existing) return res.status(404).json({ error: 'Subscription not found' });
    await websocketService.removeSubscription(req.params.id);
    await database.run('DELETE FROM subscriptions WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Subscription deleted successfully' });
  } catch (error) {
    logger.error('Delete subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/toggle', authenticate, async (req, res) => {
  try {
    const { is_active } = req.body;
    if (is_active === undefined) return res.status(400).json({ error: 'is_active field is required' });
    const existing = await database.get(
      'SELECT * FROM subscriptions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!existing) return res.status(404).json({ error: 'Subscription not found' });
    await database.run('UPDATE subscriptions SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [!!is_active, req.params.id]);
    if (is_active) {
      await websocketService.createSubscription(req.params.id, parseJson(existing.filters), existing.network);
    } else {
      await websocketService.removeSubscription(req.params.id);
    }
    const updated = await database.get('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    res.json({
      success: true,
      message: `Subscription ${is_active ? 'activated' : 'deactivated'} successfully`,
      subscription: { ...updated, filters: parseJson(updated.filters) }
    });
  } catch (error) {
    logger.error('Toggle subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;