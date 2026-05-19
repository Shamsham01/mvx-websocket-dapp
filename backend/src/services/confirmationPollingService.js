const axios = require('axios');
const logger = require('../utils/logger');
const database = require('../config/database');
const webhookService = require('./webhookService');

// Polling is ON by default. The MultiversX WebSocket rarely sends "success"—we poll the API to deliver confirmed events.
// Set to 'true' or '1' to disable (e.g. high-volume deployments with API rate limits).
const DISABLED = process.env.DISABLE_TX_CONFIRMATION_POLL === 'true' || process.env.DISABLE_TX_CONFIRMATION_POLL === '1';
const ENABLED = !DISABLED;

const POLL_DELAY_MS = parseInt(process.env.CONFIRMATION_POLL_DELAY_MS, 10) || 5000;
const POLL_RETRIES = parseInt(process.env.CONFIRMATION_POLL_RETRIES, 10) || 6;
const POLL_INTERVAL_MS = parseInt(process.env.CONFIRMATION_POLL_INTERVAL_MS, 10) || 5000;

const apiEndpoints = {
  mainnet: process.env.MVX_API_MAINNET || 'https://api.multiversx.com',
  testnet: process.env.MVX_API_TESTNET || 'https://testnet-api.multiversx.com',
  devnet: process.env.MVX_API_DEVNET || 'https://devnet-api.multiversx.com'
};

/**
 * Schedules a confirmation poll for a pending transfer.
 * The MultiversX WebSocket rarely sends "success"—we poll the REST API to get the final status and deliver it.
 */
function scheduleConfirmationCheck(transfer, subscriptions, network = 'mainnet', wsService = null) {
  if (!ENABLED || subscriptions.length === 0 || !wsService) return;

  const txHash = transfer?.originalTxHash || transfer?.txHash || transfer?.hash;
  if (!txHash) {
    logger.warn('Confirmation poll: no txHash/originalTxHash in transfer, skipping');
    return;
  }

  const status = (transfer?.status || '').toLowerCase();
  if (status !== 'pending') {
    return;
  }

  logger.debug(`Scheduling confirmation poll for ${txHash} in ${POLL_DELAY_MS}ms`);

  setTimeout(async () => {
    await pollUntilConfirmed(txHash, transfer, subscriptions, network, wsService);
  }, POLL_DELAY_MS);
}

async function pollUntilConfirmed(txHash, originalTransfer, subscriptions, network, wsService) {
  const apiUrl = apiEndpoints[network];
  if (!apiUrl) {
    logger.error(`Confirmation poll: unknown network ${network}`);
    return;
  }

  let lastError = null;
  for (let attempt = 1; attempt <= POLL_RETRIES; attempt++) {
    try {
      const url = `${apiUrl}/transactions/${txHash}`;
      const response = await axios.get(url, { timeout: 10000 });

      if (!response.data) continue;

      const txStatus = (response.data.status || '').toLowerCase();
      if (txStatus === 'success' || txStatus === 'fail' || txStatus === 'invalid') {
        const deliveredTxHash = originalTransfer?.txHash || originalTransfer?.hash || txHash;
        const dedupeKey = `${deliveredTxHash}|${txStatus}`;
        const claimed = await database.tryClaimDelivered(dedupeKey);
        if (!claimed) {
          logger.debug(`Confirmation poll: tx ${txHash} status=${txStatus} already delivered (DB dedupe), skipping`);
          return;
        }

        logger.info(`[subscription] confirmation poll tx ${txHash} final status=${txStatus} (attempt ${attempt})`);
        wsService.recordDelivered(dedupeKey);

        const confirmedTransfer = {
          ...originalTransfer,
          status: txStatus,
          ...(response.data.gasUsed != null && { gasUsed: String(response.data.gasUsed) }),
          ...(response.data.timestamp != null && { timestamp: response.data.timestamp })
        };

        for (const sub of subscriptions) {
          await webhookService.deliverWebhook(sub, confirmedTransfer);
        }
        return;
      }

      logger.debug(`Confirmation poll: tx ${txHash} still ${txStatus}, retry ${attempt}/${POLL_RETRIES}`);
    } catch (err) {
      lastError = err;
      logger.warn(`Confirmation poll attempt ${attempt}/${POLL_RETRIES} for ${txHash}: ${err.message}`);
    }

    if (attempt < POLL_RETRIES) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  logger.warn(`Confirmation poll gave up for ${txHash} after ${POLL_RETRIES} attempts. Last error: ${lastError?.message || 'unknown'}`);
}

module.exports = {
  scheduleConfirmationCheck,
  ENABLED,
  POLL_DELAY_MS,
  POLL_RETRIES
};
