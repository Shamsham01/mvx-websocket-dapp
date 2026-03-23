const { io } = require('socket.io-client');
const axios = require('axios');
const logger = require('../utils/logger');
const { parseJson } = require('../utils/parseJson');
const database = require('../config/database');
const webhookService = require('./webhookService');
const confirmationPollingService = require('./confirmationPollingService');

const DEDUPE_CACHE_MAX = 2000;

/**
 * Serialize API payload to a stable key for deduplication of API subscriptions.
 * Multiple subscriptions with the same payload share one WebSocket subscription.
 */
function payloadKey(payload) {
  return JSON.stringify(payload);
}

class WebSocketService {
  constructor() {
    this.sockets = new Map(); // network -> socket instance
    this.subscriptions = new Map(); // subscriptionId -> {socket, payload, network}
    this.payloadToSubscriptionIds = new Map(); // payloadKey -> Set<subscriptionId>
    this.deliveredKeys = new Set(); // txHash|status for deduplication (timestamp removed for stronger dedupe)
    this.apiEndpoints = {
      mainnet: process.env.MVX_API_MAINNET || 'https://api.multiversx.com',
      testnet: process.env.MVX_API_TESTNET || 'https://testnet-api.multiversx.com',
      devnet: process.env.MVX_API_DEVNET || 'https://devnet-api.multiversx.com'
    };
  }

  async getWebSocketUrl(network = 'mainnet') {
    try {
      const apiUrl = this.apiEndpoints[network];
      if (!apiUrl) {
        throw new Error(`Unsupported network: ${network}`);
      }

      const configUrl = `${apiUrl}/websocket/config`;
      const response = await axios.get(configUrl);
      
      if (!response.data || !response.data.url) {
        throw new Error('Invalid WebSocket config response');
      }

      return `https://${response.data.url}`;
    } catch (error) {
      logger.error(`Failed to get WebSocket URL for ${network}:`, error.message);
      throw error;
    }
  }

  async getSocket(network = 'mainnet') {
    if (this.sockets.has(network)) {
      return this.sockets.get(network);
    }

    try {
      const wsUrl = await this.getWebSocketUrl(network);
      const socket = io(wsUrl, {
        path: '/ws/subscription',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 30000,
        randomizationFactor: 0.5,
        timeout: 30000,
        pingTimeout: 60000,
        pingInterval: 25000
      });

      // Set up event handlers
      socket.on('connect', () => {
        logger.info(`WebSocket connected to ${network}`);
        this.resubscribeNetwork(network, socket);
      });

      socket.on('disconnect', (reason) => {
        logger.warn(`WebSocket disconnected from ${network}: ${reason}`);
      });

      socket.on('connect_error', (error) => {
        const errMsg = error?.message ?? (typeof error === 'string' ? error : JSON.stringify(error));
        logger.error(`WebSocket connection error for ${network}: ${errMsg}`);
      });

      socket.on('error', (errorData) => {
        const errMsg = errorData?.message ?? (typeof errorData === 'string' ? errorData : JSON.stringify(errorData));
        logger.error(`WebSocket server error for ${network}: ${errMsg}`);
      });

      // Handle custom transfer updates
      socket.on('customTransferUpdate', async (data) => {
        await this.handleTransferUpdate(network, data);
      });

      this.sockets.set(network, socket);
      return socket;
    } catch (error) {
      logger.error(`Failed to create WebSocket for ${network}:`, error);
      throw error;
    }
  }

  async createSubscription(subscriptionId, filters, network = 'mainnet') {
    try {
      const socket = await this.getSocket(network);
      
      // Validate at least one filter is provided
      const filterKeys = Object.keys(filters).filter(key => filters[key]);
      if (filterKeys.length === 0) {
        throw new Error('At least one filter must be provided');
      }

      // MultiversX API filters: sender, receiver, relayer, token, address (NOT function)
      // The API's function filter is unreliable when combined with address/sender/receiver
      // (e.g. DEX swaps often produce SCRs with function "exchange" not "swap").
      // We omit function from the API payload and filter by function client-side in matchesFilters().
      const payload = {
        sender: filters.sender || undefined,
        receiver: filters.receiver || undefined,
        relayer: filters.relayer || undefined,
        token: filters.token || undefined,
        address: filters.address || undefined
      };

      // Remove undefined values
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

      // API requires at least one filter; we omit function (filtered client-side)
      if (Object.keys(payload).length === 0) {
        throw new Error(
          'Function filter must be combined with at least one of: address, sender, receiver, token'
        );
      }

      // Validate: address cannot be combined with sender/receiver/relayer
      if (payload.address && (payload.sender || payload.receiver || payload.relayer)) {
        throw new Error('Address filter cannot be combined with sender, receiver, or relayer filters');
      }

      const key = payloadKey(payload);
      const existing = this.payloadToSubscriptionIds.get(key);
      const isFirstForPayload = !existing || existing.size === 0;

      if (isFirstForPayload) {
        this.payloadToSubscriptionIds.set(key, new Set([subscriptionId]));
        socket.emit('subscribeCustomTransfers', payload);
        logger.info(`Creating subscription ${subscriptionId} (first for payload), emitting subscribeCustomTransfers`);
      } else {
        existing.add(subscriptionId);
        logger.info(`Creating subscription ${subscriptionId} (merged with existing payload, ${existing.size} total)`);
      }

      this.subscriptions.set(subscriptionId, {
        socket,
        payload,
        network
      });

      return { success: true, subscriptionId };
    } catch (error) {
      logger.error(`Failed to create subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  async removeSubscription(subscriptionId) {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        logger.warn(`Subscription ${subscriptionId} not found`);
        return { success: false, message: 'Subscription not found' };
      }

      const { socket, payload } = subscription;
      const key = payloadKey(payload);
      const ids = this.payloadToSubscriptionIds.get(key);
      if (ids) {
        ids.delete(subscriptionId);
        if (ids.size === 0) {
          this.payloadToSubscriptionIds.delete(key);
          socket.emit('unsubscribeCustomTransfers', payload);
          logger.info(`Removed subscription ${subscriptionId} (last for payload), emitting unsubscribeCustomTransfers`);
        } else {
          logger.info(`Removed subscription ${subscriptionId} (${ids.size} subscription(s) still using payload)`);
        }
      }

      this.subscriptions.delete(subscriptionId);

      return { success: true };
    } catch (error) {
      logger.error(`Failed to remove subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  async handleTransferUpdate(network, data) {
    try {
      if (!data.transfers || !Array.isArray(data.transfers) || data.transfers.length === 0) {
        return;
      }

      const subscriptions = await database.query(`
        SELECT s.*, u.address as user_address 
        FROM subscriptions s
        JOIN users u ON s.user_id = u.id
        WHERE s.network = ? AND s.is_active = true
      `, [network]);

      logger.info(`Received ${data.transfers.length} transfer(s) from ${network}, ${subscriptions.length} active subscription(s)`);

      if (subscriptions.length === 0) {
        return;
      }

      for (const transfer of data.transfers) {
        const txId = transfer?.txHash || transfer?.hash || 'unknown';
        const fn = this.transferFunctionName(transfer);
        logger.info(
          `Transfer: txHash=${txId} sender=${transfer?.sender} receiver=${transfer?.receiver} function=${fn} status=${transfer?.status} type=${transfer?.type}`
        );

        if (!this.shouldProcessTransfer(transfer)) {
          logger.info(
            `Skipping non-success transfer ${txId} (status=${transfer?.status || 'unknown'})`
          );
          continue;
        }

        const dedupeKey = `${txId}|${transfer?.status ?? ''}`;
        if (this.deliveredKeys.has(dedupeKey)) {
          logger.info(`Skipping duplicate transfer ${txId} status=${transfer?.status} (already delivered, in-memory)`);
          continue;
        }

        const claimed = await database.tryClaimDelivered(dedupeKey);
        if (!claimed) {
          logger.info(`Skipping duplicate transfer ${txId} status=${transfer?.status} (already delivered by another instance)`);
          this.deliveredKeys.add(dedupeKey);
          continue;
        }

        const deliveryTasks = [];
        const matchedSubs = [];

        for (const subscription of subscriptions) {
          const filters = parseJson(subscription.filters);
          if (!this.matchesFilters(transfer, filters)) continue;

          matchedSubs.push(subscription);
          const status = (transfer?.status || '').toLowerCase();
          if (filters.onlyConfirmed && status === 'pending') {
            logger.info(`Transfer ${txId} matched subscription ${subscription.id} (onlyConfirmed: skipping pending)`);
            continue;
          }

          logger.info(`Transfer ${txId} matched subscription ${subscription.id} (${subscription.name})`);
          deliveryTasks.push(webhookService.deliverWebhook(subscription, transfer));
        }

        if (deliveryTasks.length === 0 && subscriptions.length > 0) {
          logger.info(
            `Transfer ${txId} did not match any subscription (receiver=${transfer?.receiver}, function=${fn})`
          );
          subscriptions.forEach((s) => {
            const f = parseJson(s.filters);
            logger.info(
              `  Sub ${s.id} (${s.name}): receiver=${f?.receiver || '(any)'}, function=${f?.function || '(any)'}, token=${f?.token || '(any)'}, tokenIdentifier=${f?.tokenIdentifier || '(any)'}, collectionIdentifier=${f?.collectionIdentifier || '(any)'}, sender=${f?.sender || '(any)'}, address=${f?.address || '(any)'}, amountMin=${f?.amountMin ?? '(any)'}, amountMax=${f?.amountMax ?? '(any)'}`
            );
          });
        }

        if (deliveryTasks.length > 0) {
          this.deliveredKeys.add(dedupeKey);
          if (this.deliveredKeys.size > DEDUPE_CACHE_MAX) {
            const arr = [...this.deliveredKeys];
            this.deliveredKeys = new Set(arr.slice(-Math.floor(DEDUPE_CACHE_MAX / 2)));
          }
          await Promise.allSettled(deliveryTasks);
        }

        const status = (transfer?.status || '').toLowerCase();
        if (status === 'pending' && matchedSubs.length > 0) {
          confirmationPollingService.scheduleConfirmationCheck(transfer, matchedSubs, network, this);
        }
      }
    } catch (error) {
      logger.error('Error handling transfer update:', error);
    }
  }

  normalizeValue(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : value;
  }

  /**
   * Check if transfer contains the given token (ESDT identifier).
   * Looks in action.arguments.transfers[] and operations[].
   */
  transferHasToken(transfer, targetToken) {
    const target = this.normalizeValue(targetToken);
    const fromTransfers = (transfer?.action?.arguments?.transfers || []).some(
      (t) => this.normalizeValue(t?.token || t?.identifier) === target
    );
    const fromOps = (transfer?.operations || []).some(
      (op) => this.normalizeValue(op?.identifier || op?.tokenIdentifier || op?.token) === target
    );
    return fromTransfers || fromOps;
  }

  /**
   * Check if transfer involves NFTs from the given collection.
   * Collection identifier can be ASCII (e.g. MADC-d03f58) or base64.
   * Looks in operations[].collection and identifiers that start with collection-.
   */
  transferHasCollection(transfer, targetCollection) {
    const target = this.normalizeValue(targetCollection);
    const ops = transfer?.operations || [];
    for (const op of ops) {
      const col = this.normalizeValue(op?.collection);
      if (col && col === target) return true;
      const id = this.normalizeValue(op?.identifier || op?.tokenIdentifier);
      if (id && (id === target || id.startsWith(target + '-'))) return true;
    }
    const transfers = transfer?.action?.arguments?.transfers || [];
    for (const t of transfers) {
      const tok = this.normalizeValue(t?.token || t?.identifier);
      if (tok && (tok === target || tok.startsWith(target + '-'))) return true;
    }
    return false;
  }

  /**
   * Parse human-readable EGLD amount to BigInt (wei).
   * Always expects EGLD values: "1000", "0.5", "0.001".
   * 1 EGLD = 10^18 wei.
   */
  parseAmount(value) {
    if (value === undefined || value === null || value === '') return null;
    const s = String(value).trim();
    if (!s) return null;
    const E18 = BigInt('1000000000000000000');
    if (s.includes('.')) {
      const [intPart, decPart] = s.split('.');
      const padded = (decPart || '').padEnd(18, '0').slice(0, 18);
      return BigInt(intPart || '0') * E18 + BigInt(padded);
    }
    return BigInt(s) * E18;
  }

  /**
   * Get the main EGLD value of the transfer (wei).
   */
  transferValue(transfer) {
    const v = transfer?.value ?? transfer?.amount;
    if (v === undefined || v === null) return BigInt(0);
    return BigInt(String(v));
  }

  transferFunctionName(transfer) {
    // MultiversX API may expose function at different levels:
    // - transfer.function (top-level, main tx)
    // - transfer.action.name (e.g. "transfer", "swap")
    // - transfer.action.arguments.functionName (SCRs, DEX swaps)
    return (
      transfer.function ||
      transfer.action?.arguments?.functionName ||
      transfer.action?.name ||
      transfer.action?.arguments?.function ||
      null
    );
  }

  shouldProcessTransfer(transfer) {
    // MultiversX WebSocket sends transfers when they first appear (often pending from mempool).
    // The API typically sends each transfer once; we may never get a "success" update.
    // Accept both pending and success so webhooks fire. Failed/invalid are still skipped.
    const status = this.normalizeValue(transfer?.status);
    return status === 'success' || status === 'pending';
  }

  matchesFilters(transfer, filters) {
    const normalizedFilters = filters || {};
    const sender = this.normalizeValue(transfer.sender);
    const receiver = this.normalizeValue(transfer.receiver);
    const relayer = this.normalizeValue(transfer.relayer);
    const functionName = this.normalizeValue(this.transferFunctionName(transfer));

    // Check each filter condition
    if (normalizedFilters.sender && sender !== this.normalizeValue(normalizedFilters.sender)) {
      return false;
    }

    if (normalizedFilters.receiver && receiver !== this.normalizeValue(normalizedFilters.receiver)) {
      return false;
    }

    if (normalizedFilters.function && functionName !== this.normalizeValue(normalizedFilters.function)) {
      return false;
    }

    if (normalizedFilters.token) {
      const targetToken = this.normalizeValue(normalizedFilters.token);
      if (!this.transferHasToken(transfer, targetToken)) {
        return false;
      }
    }

    // tokenIdentifier: client-side only, filters by ESDT in action.arguments.transfers
    if (normalizedFilters.tokenIdentifier) {
      const targetToken = this.normalizeValue(normalizedFilters.tokenIdentifier);
      if (!this.transferHasToken(transfer, targetToken)) {
        return false;
      }
    }

    if (normalizedFilters.address) {
      // Check if address matches sender, receiver, or relayer
      const normalizedAddress = this.normalizeValue(normalizedFilters.address);
      const matchesAddress = 
        sender === normalizedAddress ||
        receiver === normalizedAddress ||
        relayer === normalizedAddress;
      
      if (!matchesAddress) {
        return false;
      }
    }

    if (normalizedFilters.relayer && relayer !== this.normalizeValue(normalizedFilters.relayer)) {
      return false;
    }

    // collectionIdentifier: client-side only, filters by NFT collection in operations
    if (normalizedFilters.collectionIdentifier) {
      const target = this.normalizeValue(normalizedFilters.collectionIdentifier);
      if (!this.transferHasCollection(transfer, target)) {
        return false;
      }
    }

    // amountMin / amountMax: filter by EGLD value (wei)
    const txValue = this.transferValue(transfer);
    if (normalizedFilters.amountMin != null) {
      const minVal = this.parseAmount(normalizedFilters.amountMin);
      if (minVal != null && txValue < minVal) return false;
    }
    if (normalizedFilters.amountMax != null) {
      const maxVal = this.parseAmount(normalizedFilters.amountMax);
      if (maxVal != null && txValue > maxVal) return false;
    }

    return true;
  }

  hasDelivered(dedupeKey) {
    return this.deliveredKeys.has(dedupeKey);
  }

  recordDelivered(dedupeKey) {
    this.deliveredKeys.add(dedupeKey);
    if (this.deliveredKeys.size > DEDUPE_CACHE_MAX) {
      const arr = [...this.deliveredKeys];
      this.deliveredKeys = new Set(arr.slice(-Math.floor(DEDUPE_CACHE_MAX / 2)));
    }
  }

  resubscribeNetwork(network, socket) {
    try {
      const payloadsForNetwork = new Set();
      for (const [, subscription] of this.subscriptions) {
        if (subscription.network !== network) continue;
        payloadsForNetwork.add(payloadKey(subscription.payload));
      }
      for (const key of payloadsForNetwork) {
        const payload = JSON.parse(key);
        socket.emit('subscribeCustomTransfers', payload);
      }
      if (payloadsForNetwork.size > 0) {
        logger.info(`Re-subscribed ${payloadsForNetwork.size} unique API payload(s) for ${network}`);
      }
    } catch (error) {
      logger.error(`Failed to re-subscribe subscriptions for ${network}:`, error.message);
    }
  }

  async cleanup() {
    // Unsubscribe all and close connections
    const ids = [...this.subscriptions.keys()];
    for (const subscriptionId of ids) {
      await this.removeSubscription(subscriptionId);
    }

    for (const [network, socket] of this.sockets) {
      socket.disconnect();
      logger.info(`Disconnected WebSocket for ${network}`);
    }

    this.sockets.clear();
    this.subscriptions.clear();
    this.payloadToSubscriptionIds.clear();
    this.deliveredKeys.clear();
  }
}

module.exports = new WebSocketService();