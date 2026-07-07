const logger = require('../utils/logger');
const database = require('../config/database');

const DEFAULT_RETENTION_DAYS = 7;
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 5000;

class LogRetentionService {
  constructor() {
    this.retentionDays = parseInt(process.env.WEBHOOK_LOG_RETENTION_DAYS, 10);
    if (Number.isNaN(this.retentionDays)) {
      this.retentionDays = DEFAULT_RETENTION_DAYS;
    }
    this.intervalMs = parseInt(process.env.WEBHOOK_LOG_CLEANUP_INTERVAL_MS, 10) || DEFAULT_INTERVAL_MS;
    this.intervalId = null;
    this.isRunning = false;
  }

  isEnabled() {
    return this.retentionDays > 0;
  }

  getCutoffDate() {
    return new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);
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
          `Data retention cleanup (${this.retentionDays} days): deleted ${webhookLogs} webhook_logs, ${deliveredTransfers} delivered_transfers`
        );
      } else {
        logger.debug(`Data retention cleanup: no rows older than ${this.retentionDays} days`);
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
      logger.info('Data retention disabled (WEBHOOK_LOG_RETENTION_DAYS <= 0)');
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

    logger.info(
      `Data retention enabled: ${this.retentionDays}-day retention for webhook_logs and delivered_transfers, cleanup every ${Math.round(this.intervalMs / 3600000)}h`
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
