const logger = require('../utils/logger');
const database = require('../config/database');

const DEFAULT_RETENTION_HOURS = 48;
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const BATCH_SIZE = 5000;

class LogRetentionService {
  constructor() {
    const parsedHours = parseInt(process.env.WEBHOOK_LOG_RETENTION_HOURS, 10);
    this.retentionHours = Number.isNaN(parsedHours) ? DEFAULT_RETENTION_HOURS : parsedHours;
    this.intervalMs = parseInt(process.env.WEBHOOK_LOG_CLEANUP_INTERVAL_MS, 10) || DEFAULT_INTERVAL_MS;
    this.intervalId = null;
    this.isRunning = false;

    if (process.env.WEBHOOK_LOG_RETENTION_DAYS !== undefined && process.env.WEBHOOK_LOG_RETENTION_HOURS === undefined) {
      logger.warn(
        'WEBHOOK_LOG_RETENTION_DAYS is ignored. Retention is controlled by WEBHOOK_LOG_RETENTION_HOURS (default 48).'
      );
    }
  }

  isEnabled() {
    return this.retentionHours > 0;
  }

  getCutoffDate() {
    return new Date(Date.now() - this.retentionHours * 60 * 60 * 1000);
  }

  async deleteOlderThan(tableName, timestampColumn, cutoff) {
    let totalDeleted = 0;

    while (true) {
      const result = await database.run(`
        DELETE FROM ${tableName}
        WHERE ctid IN (
          SELECT ctid FROM ${tableName}
          WHERE ${timestampColumn} < ?
          LIMIT ?
        )
      `, [cutoff, BATCH_SIZE]);

      const deleted = result.changes || 0;
      totalDeleted += deleted;

      if (deleted < BATCH_SIZE) {
        break;
      }
    }

    return totalDeleted;
  }

  async runCleanup() {
    if (!this.isEnabled()) {
      return { webhookLogs: 0, deliveredTransfers: 0, disabled: true };
    }

    if (this.isRunning) {
      logger.debug('Data retention cleanup already in progress, skipping');
      return { webhookLogs: 0, deliveredTransfers: 0, skipped: true };
    }

    this.isRunning = true;
    const cutoff = this.getCutoffDate();

    try {
      const webhookLogs = await this.deleteOlderThan('webhook_logs', 'delivered_at', cutoff);
      const deliveredTransfers = await this.deleteOlderThan('delivered_transfers', 'delivered_at', cutoff);

      if (webhookLogs > 0 || deliveredTransfers > 0) {
        logger.info(
          `Data retention cleanup (${this.retentionHours} hours): deleted ${webhookLogs} webhook_logs, ${deliveredTransfers} delivered_transfers`
        );
      } else {
        logger.debug(`Data retention cleanup: no rows older than ${this.retentionHours} hours`);
      }

      return { webhookLogs, deliveredTransfers };
    } catch (error) {
      logger.error('Data retention cleanup failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  startScheduledCleanup() {
    if (!this.isEnabled()) {
      logger.info('Data retention disabled (WEBHOOK_LOG_RETENTION_HOURS <= 0)');
      return;
    }

    if (this.intervalId) {
      return;
    }

    setImmediate(() => {
      this.runCleanup().catch((error) => {
        logger.error('Initial data retention cleanup failed:', error);
      });
    });

    this.intervalId = setInterval(() => {
      this.runCleanup().catch((error) => {
        logger.error('Scheduled data retention cleanup failed:', error);
      });
    }, this.intervalMs);

    const everyMinutes = Math.max(1, Math.round(this.intervalMs / 60000));
    logger.info(
      `Data retention enabled: ${this.retentionHours}-hour retention for webhook_logs and delivered_transfers, cleanup every ${everyMinutes} min`
    );
  }

  stopScheduledCleanup() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

module.exports = new LogRetentionService();
