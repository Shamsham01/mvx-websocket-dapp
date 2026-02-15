const axios = require('axios');
const logger = require('../utils/logger');
const database = require('../config/database');

class WebhookService {
  constructor() {
    this.timeout = parseInt(process.env.WEBHOOK_TIMEOUT_MS) || 10000;
    this.maxRetries = parseInt(process.env.WEBHOOK_MAX_RETRIES) || 3;
  }

  async deliverWebhook(subscription, transferData) {
    const startTime = Date.now();
    let attempt = 0;
    let success = false;
    let statusCode = null;
    let responseText = null;
    let errorMessage = null;

    while (attempt < this.maxRetries && !success) {
      attempt++;
      
      try {
        logger.info(`Delivering webhook for subscription ${subscription.id}, attempt ${attempt}`);

        const response = await axios.post(
          subscription.webhook_url,
          {
            subscription: {
              id: subscription.id,
              name: subscription.name,
              user_address: subscription.user_address
            },
            transfer: transferData,
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
          logger.info(`Webhook delivered successfully for subscription ${subscription.id}, status: ${statusCode}`);
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
      transferData,
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