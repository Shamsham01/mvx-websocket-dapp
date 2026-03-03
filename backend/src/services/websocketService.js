const { io } = require('socket.io-client');
const axios = require('axios');
const logger = require('../utils/logger');
const { parseJson } = require('../utils/parseJson');
const database = require('../config/database');
const webhookService = require('./webhookService');

class WebSocketService {
  constructor() {
    this.sockets = new Map(); // network -> socket instance
    this.subscriptions = new Map(); // subscriptionId -> {socket, payload}
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
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
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
        logger.error(`WebSocket connection error for ${network}:`, error.message);
      });

      socket.on('error', (errorData) => {
        logger.error(`WebSocket server error for ${network}:`, errorData);
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

      logger.info(`Creating subscription ${subscriptionId} with filters:`, payload);

      socket.emit('subscribeCustomTransfers', payload);
      
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
      socket.emit('unsubscribeCustomTransfers', payload);
      
      this.subscriptions.delete(subscriptionId);
      logger.info(`Removed subscription ${subscriptionId}`);

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

        const deliveryTasks = [];

        for (const subscription of subscriptions) {
          const filters = parseJson(subscription.filters);
          if (this.matchesFilters(transfer, filters)) {
            logger.info(`Transfer ${txId} matched subscription ${subscription.id} (${subscription.name})`);
            deliveryTasks.push(webhookService.deliverWebhook(subscription, transfer));
          }
        }

        if (deliveryTasks.length === 0 && subscriptions.length > 0) {
          logger.info(
            `Transfer ${txId} did not match any subscription (receiver=${transfer?.receiver}, function=${fn})`
          );
          subscriptions.forEach((s) => {
            const f = parseJson(s.filters);
            logger.info(
              `  Sub ${s.id} (${s.name}): receiver=${f?.receiver || '(any)'}, function=${f?.function || '(any)'}, sender=${f?.sender || '(any)'}, address=${f?.address || '(any)'}`
            );
          });
        }

        if (deliveryTasks.length > 0) {
          await Promise.allSettled(deliveryTasks);
        }
      }
    } catch (error) {
      logger.error('Error handling transfer update:', error);
    }
  }

  normalizeValue(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : value;
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
    // Webhooks should only be delivered once transaction is finalized as success.
    return this.normalizeValue(transfer?.status) === 'success';
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
      const fromTransfers = (transfer?.action?.arguments?.transfers || []).some(
        (t) => this.normalizeValue(t?.token || t?.identifier) === targetToken
      );
      const fromOps = (transfer?.operations || []).some(
        (op) => this.normalizeValue(op?.identifier || op?.tokenIdentifier || op?.token) === targetToken
      );
      if (!fromTransfers && !fromOps) {
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

    return true;
  }

  resubscribeNetwork(network, socket) {
    try {
      let count = 0;
      for (const [, subscription] of this.subscriptions) {
        if (subscription.network !== network) {
          continue;
        }
        socket.emit('subscribeCustomTransfers', subscription.payload);
        count++;
      }
      if (count > 0) {
        logger.info(`Re-subscribed ${count} active in-memory subscription(s) for ${network}`);
      }
    } catch (error) {
      logger.error(`Failed to re-subscribe subscriptions for ${network}:`, error.message);
    }
  }

  async cleanup() {
    // Unsubscribe all and close connections
    for (const [subscriptionId] of this.subscriptions) {
      await this.removeSubscription(subscriptionId);
    }

    for (const [network, socket] of this.sockets) {
      socket.disconnect();
      logger.info(`Disconnected WebSocket for ${network}`);
    }

    this.sockets.clear();
    this.subscriptions.clear();
  }
}

module.exports = new WebSocketService();