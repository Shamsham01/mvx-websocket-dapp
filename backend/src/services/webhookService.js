const axios = require('axios');
const logger = require('../utils/logger');
const { parseJson } = require('../utils/parseJson');
const database = require('../config/database');

const PARENT_OPERATIONS_CACHE_TTL_MS = 10 * 60 * 1000;
const PARENT_OPERATIONS_CACHE_MAX = 1000;

class WebhookService {
  constructor() {
    this.timeout = parseInt(process.env.WEBHOOK_TIMEOUT_MS) || 10000;
    this.maxRetries = parseInt(process.env.WEBHOOK_MAX_RETRIES) || 3;
    this.parentOperationsCache = new Map();
    this.apiEndpoints = {
      mainnet: process.env.MVX_API_MAINNET || 'https://api.multiversx.com',
      testnet: process.env.MVX_API_TESTNET || 'https://testnet-api.multiversx.com',
      devnet: process.env.MVX_API_DEVNET || 'https://devnet-api.multiversx.com'
    };
  }

  hasOperations(transferData) {
    const operations = transferData?.operations;
    return Array.isArray(operations) && operations.length > 0;
  }

  shouldRestoreParentOperations(subscription, transferData, options = {}) {
    if (options.movement) return false;

    const filters = parseJson(subscription?.filters) || {};
    if (filters.movementMode === 'classified') return false;
    if (!filters.collectionIdentifier) return false;
    if (!transferData?.originalTxHash) return false;

    return !this.hasOperations(transferData);
  }

  cacheParentOperations(cacheKey, operations) {
    // Never cache empty results — indexer lag would pin thin payloads for the TTL.
    if (!Array.isArray(operations) || operations.length === 0) return;

    this.parentOperationsCache.set(cacheKey, {
      operations,
      expiresAt: Date.now() + PARENT_OPERATIONS_CACHE_TTL_MS
    });
    if (this.parentOperationsCache.size > PARENT_OPERATIONS_CACHE_MAX) {
      const oldestKey = this.parentOperationsCache.keys().next().value;
      this.parentOperationsCache.delete(oldestKey);
    }
  }

  async fetchParentOperations(network, originalTxHash) {
    const apiUrl = this.apiEndpoints[network];
    if (!apiUrl || !originalTxHash) return null;

    const cacheKey = `${network}:${originalTxHash}`;
    const cached = this.parentOperationsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.operations;
    }
    if (cached) this.parentOperationsCache.delete(cacheKey);

    try {
      const response = await axios.get(`${apiUrl}/transactions/${originalTxHash}`, {
        timeout: 15000
      });
      const operations = Array.isArray(response.data?.operations)
        ? response.data.operations
        : [];

      this.cacheParentOperations(cacheKey, operations);
      return operations;
    } catch (error) {
      logger.warn(
        `Parent operations enrich failed for ${originalTxHash}: ${error.message}`
      );
      return null;
    }
  }

  /**
   * Prefer SCR-level REST details (ops + logs + price) over parent-ops paste.
   * Used when confirmation/WS enrich left a thin payload.
   */
  async fetchScrDetails(network, scrHash) {
    const apiUrl = this.apiEndpoints[network];
    if (!apiUrl || !scrHash || scrHash === 'unknown') return null;

    try {
      const response = await axios.get(`${apiUrl}/transactions/${scrHash}`, {
        timeout: 15000
      });
      return response.data || null;
    } catch (error) {
      logger.warn(`SCR enrich for delivery failed for ${scrHash}: ${error.message}`);
      return null;
    }
  }

  async prepareTransferForDelivery(subscription, transferData, options = {}) {
    if (options.movement) return transferData;

    const network = subscription?.network || 'mainnet';
    let transfer = transferData;

    // Prefer enriching the SCR itself so payloads match GET /transactions/{scrHash}
    // (NFT name, writeLog, logs, gas*, price) — not just parent buy operations.
    if (!this.hasOperations(transfer)) {
      const scrHash = transfer?.txHash || transfer?.hash;
      const apiTx = await this.fetchScrDetails(network, scrHash);
      if (apiTx && this.hasOperations(apiTx)) {
        const preserveStatus = transfer.status;
        const preserveType = transfer.type;
        transfer = {
          ...transfer,
          ...apiTx,
          txHash: transfer.txHash || apiTx.txHash,
          hash: transfer.hash || apiTx.hash || apiTx.txHash,
        };
        if (preserveStatus) transfer.status = preserveStatus;
        // Keep WebSocket SmartContractResult typing when REST returns "unsigned".
        if (
          typeof preserveType === 'string' &&
          preserveType.toLowerCase() === 'smartcontractresult'
        ) {
          transfer.type = preserveType;
        }
        logger.debug(
          `Enriched SCR ${scrHash} for webhook delivery (operations=${transfer.operations.length})`
        );
      }
    }

    if (!this.shouldRestoreParentOperations(subscription, transfer, options)) {
      return transfer;
    }

    const operations = await this.fetchParentOperations(
      network,
      transfer.originalTxHash
    );
    if (!Array.isArray(operations) || operations.length === 0) {
      return transfer;
    }

    logger.debug(
      `Restored ${operations.length} parent operation(s) for SCR ${transfer?.txHash || transfer?.hash || 'unknown'} from ${transfer.originalTxHash}`
    );
    return {
      ...transfer,
      operations
    };
  }

  async deliverWebhook(subscription, transferData, options = {}) {
    const startTime = Date.now();
    const payloadTransfer = await this.prepareTransferForDelivery(
      subscription,
      transferData,
      options
    );
    let attempt = 0;
    let success = false;
    let statusCode = null;
    let responseText = null;
    let errorMessage = null;

    while (attempt < this.maxRetries && !success) {
      attempt++;
      
      try {
        logger.debug(`Delivering webhook for subscription ${subscription.id}, attempt ${attempt}`);

        const status = (payloadTransfer?.status || '').toLowerCase();
        const isConfirmed = status === 'success';

        const response = await axios.post(
          subscription.webhook_url,
          {
            subscription: {
              id: subscription.id,
              name: subscription.name,
              user_address: subscription.user_address
            },
            transfer: payloadTransfer,
            ...(options.movement && { movement: options.movement }),
            confirmed: isConfirmed,
            timestamp: new Date().toISOString()
          },
          {
            timeout: this.timeout,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'MultiversX-Webhook-Service/1.0'
            }
          }
        );

        statusCode = response.status;
        responseText = response.data ? JSON.stringify(response.data).substring(0, 500) : null;
        success = response.status >= 200 && response.status < 300;

        if (success) {
          logger.info(
            `[webhook] delivered → ${subscription.name} (id=${subscription.id}) HTTP ${statusCode} tx=${payloadTransfer?.txHash || payloadTransfer?.hash || 'n/a'}`
          );
        } else {
          logger.warn(`Webhook delivery failed for subscription ${subscription.id}, status: ${statusCode}`);
          errorMessage = `HTTP ${statusCode}`;
        }
      } catch (error) {
        logger.error(`Webhook delivery error for subscription ${subscription.id}, attempt ${attempt}:`, error.message);
        
        if (error.response) {
          statusCode = error.response.status;
          responseText = error.response.data ? JSON.stringify(error.response.data).substring(0, 500) : null;
          errorMessage = `HTTP ${statusCode}: ${error.message}`;
        } else if (error.request) {
          errorMessage = `No response: ${error.message}`;
        } else {
          errorMessage = error.message;
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Log the delivery attempt
    await this.logDelivery(
      subscription.id,
      payloadTransfer,
      statusCode,
      responseText,
      errorMessage,
      attempt - 1, // retry_count
      success,
      Date.now() - startTime
    );

    // If all attempts failed, maybe disable the subscription or alert
    if (!success && attempt >= this.maxRetries) {
      logger.error(`Webhook delivery failed after ${this.maxRetries} attempts for subscription ${subscription.id}`);
      // Optionally disable the subscription
      // await database.run('UPDATE subscriptions SET is_active = 0 WHERE id = ?', [subscription.id]);
    }

    return { success, attempts: attempt };
  }

  async logDelivery(subscriptionId, transferData, statusCode, responseText, errorMessage, retryCount, success, durationMs) {
    try {
      await database.run(`
        INSERT INTO webhook_logs 
        (subscription_id, transfer_data, status_code, response_text, error_message, retry_count, delivered_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        subscriptionId,
        JSON.stringify(transferData),
        statusCode,
        responseText,
        errorMessage,
        retryCount
      ]);

      logger.debug(`Logged webhook delivery for subscription ${subscriptionId}, duration: ${durationMs}ms`);
    } catch (error) {
      logger.error('Failed to log webhook delivery:', error);
    }
  }

  async getDeliveryStats(subscriptionId, limit = 100) {
    try {
      const logs = await database.query(`
        SELECT * FROM webhook_logs 
        WHERE subscription_id = ? 
        ORDER BY delivered_at DESC 
        LIMIT ?
      `, [subscriptionId, limit]);

      const stats = await database.get(`
        SELECT 
          COUNT(*) as total_deliveries,
          SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successful_deliveries,
          SUM(CASE WHEN status_code IS NULL OR status_code >= 400 THEN 1 ELSE 0 END) as failed_deliveries,
          AVG(retry_count) as avg_retry_count
        FROM webhook_logs 
        WHERE subscription_id = ?
      `, [subscriptionId]);

      return {
        logs,
        stats: stats || {
          total_deliveries: 0,
          successful_deliveries: 0,
          failed_deliveries: 0,
          avg_retry_count: 0
        }
      };
    } catch (error) {
      logger.error('Failed to get delivery stats:', error);
      throw error;
    }
  }

  async validateWebhookUrl(url) {
    try {
      // Basic URL validation
      const urlObj = new URL(url);
      
      // Only allow HTTP/HTTPS
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { valid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
      }

      // Optional: Test the webhook with a HEAD request
      try {
        const response = await axios.head(url, { timeout: 5000 });
        return { 
          valid: true, 
          status: response.status,
          headers: response.headers
        };
      } catch (testError) {
        // HEAD might fail, but POST could still work
        return { valid: true, warning: 'HEAD request failed, but URL appears valid' };
      }
    } catch (error) {
      return { valid: false, error: 'Invalid URL format' };
    }
  }
}

module.exports = new WebhookService();
