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

      const minAmount = this.normalizeMinAmount(filters.min_amount);
      if (minAmount !== null && !filters.token) {
        throw new Error('Token filter is required when min_amount is provided');
      }

      const payload = {
        sender: filters.sender || undefined,
        receiver: filters.receiver || undefined,
        relayer: filters.relayer || undefined,
        function: filters.function || undefined,
        token: filters.token || undefined,
        address: filters.address || undefined
      };

      // Remove undefined values
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

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

      logger.info(`Received ${data.transfers.length} transfer(s) from ${network}`);

      // Get all active subscriptions for this network
      const subscriptions = await database.query(`
        SELECT s.*, u.address as user_address 
        FROM subscriptions s
        JOIN users u ON s.user_id = u.id
        WHERE s.network = ? AND s.is_active = true
      `, [network]);

      if (subscriptions.length === 0) {
        return;
      }

      // Process each transfer for each subscription
      for (const transfer of data.transfers) {
        if (!this.shouldProcessTransfer(transfer)) {
          logger.debug(
            `Skipping non-success transfer ${transfer?.txHash || 'unknown-tx'} with status ${transfer?.status || 'unknown'}`
          );
          continue;
        }

        const deliveryTasks = [];

        for (const subscription of subscriptions) {
          if (this.matchesFilters(transfer, parseJson(subscription.filters))) {
            deliveryTasks.push(webhookService.deliverWebhook(subscription, transfer));
          }
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
    return (
      transfer.function ||
      transfer.action?.name ||
      transfer.action?.arguments?.function ||
      null
    );
  }

  shouldProcessTransfer(transfer) {
    // Webhooks should only be delivered once transaction is finalized as success.
    return this.normalizeValue(transfer?.status) === 'success';
  }

  normalizeMinAmount(value) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = String(value).trim();
    if (!normalized) {
      return null;
    }

    if (!/^\d+(\.\d+)?$/.test(normalized)) {
      return null;
    }

    return normalized;
  }

  parseBigIntValue(value) {
    if (typeof value === 'bigint') {
      return value;
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
        return null;
      }
      return BigInt(value);
    }

    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^0x[0-9a-f]+$/i.test(trimmed)) {
      return BigInt(trimmed);
    }

    if (/^\d+$/.test(trimmed)) {
      return BigInt(trimmed);
    }

    return null;
  }

  parseAmountToRawUnits(amount, decimals) {
    const normalizedAmount = this.normalizeMinAmount(amount);
    const decimalsNumber = Number(decimals);

    if (normalizedAmount === null || !Number.isInteger(decimalsNumber) || decimalsNumber < 0) {
      return null;
    }

    const [wholePart, fractionalPart = ''] = normalizedAmount.split('.');
    if (fractionalPart.length > decimalsNumber) {
      return null;
    }

    const paddedFraction = fractionalPart.padEnd(decimalsNumber, '0');
    const rawString = `${wholePart}${paddedFraction}`.replace(/^0+(?=\d)/, '');
    return BigInt(rawString || '0');
  }

  decodeBase64ToString(base64Value) {
    if (!base64Value || typeof base64Value !== 'string') {
      return null;
    }

    try {
      const decoded = Buffer.from(base64Value, 'base64').toString('utf8').trim();
      return decoded || null;
    } catch (error) {
      return null;
    }
  }

  decodeBase64ToBigInt(base64Value) {
    if (!base64Value || typeof base64Value !== 'string') {
      return null;
    }

    try {
      const hex = Buffer.from(base64Value, 'base64').toString('hex');
      if (!hex) {
        return 0n;
      }
      return BigInt(`0x${hex}`);
    } catch (error) {
      return null;
    }
  }

  parseDecimals(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return null;
    }
    return parsed;
  }

  extractTokenTransfers(transfer) {
    const transfers = [];
    const decimalsByToken = new Map();

    const addTransfer = ({ token, valueRaw, decimals }) => {
      const normalizedToken = this.normalizeValue(token);
      if (!normalizedToken || valueRaw === null) {
        return;
      }

      const parsedDecimals = this.parseDecimals(decimals);
      if (parsedDecimals !== null && !decimalsByToken.has(normalizedToken)) {
        decimalsByToken.set(normalizedToken, parsedDecimals);
      }

      transfers.push({
        token: normalizedToken,
        valueRaw,
        decimals: parsedDecimals
      });
    };

    const actionTransfers = transfer?.action?.arguments?.transfers;
    if (Array.isArray(actionTransfers)) {
      for (const actionTransfer of actionTransfers) {
        addTransfer({
          token: actionTransfer?.token || actionTransfer?.identifier,
          valueRaw: this.parseBigIntValue(actionTransfer?.value ?? actionTransfer?.amount),
          decimals: actionTransfer?.decimals
        });
      }
    }

    if (Array.isArray(transfer?.operations)) {
      for (const operation of transfer.operations) {
        if (this.normalizeValue(operation?.type) !== 'esdt') {
          continue;
        }
        addTransfer({
          token: operation?.identifier,
          valueRaw: this.parseBigIntValue(operation?.value),
          decimals: operation?.decimals
        });
      }
    }

    const collectFromLogs = (events) => {
      if (!Array.isArray(events)) {
        return;
      }

      for (const event of events) {
        if (this.normalizeValue(event?.identifier) !== 'esdttransfer') {
          continue;
        }

        const topics = event?.topics || [];
        const token = this.decodeBase64ToString(topics[0]);
        const valueRaw = this.decodeBase64ToBigInt(topics[2]);

        addTransfer({
          token,
          valueRaw,
          decimals: token ? decimalsByToken.get(this.normalizeValue(token)) : null
        });
      }
    };

    collectFromLogs(transfer?.logs?.events);

    if (Array.isArray(transfer?.results)) {
      for (const result of transfer.results) {
        collectFromLogs(result?.logs?.events);
      }
    }

    return transfers;
  }

  meetsMinAmount(tokenTransfer, minAmount) {
    const decimals = tokenTransfer?.decimals;
    if (decimals === null || decimals === undefined) {
      return false;
    }

    const minAmountRaw = this.parseAmountToRawUnits(minAmount, decimals);
    if (minAmountRaw === null || tokenTransfer.valueRaw === null) {
      return false;
    }

    return tokenTransfer.valueRaw >= minAmountRaw;
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

    const normalizedToken = normalizedFilters.token
      ? this.normalizeValue(normalizedFilters.token)
      : null;
    const minAmount = this.normalizeMinAmount(normalizedFilters.min_amount);

    if (minAmount !== null && !normalizedToken) {
      return false;
    }

    if (normalizedToken || minAmount !== null) {
      const tokenTransfers = this.extractTokenTransfers(transfer);
      const relevantTransfers = normalizedToken
        ? tokenTransfers.filter((tokenTransfer) => tokenTransfer.token === normalizedToken)
        : tokenTransfers;

      if (normalizedToken && relevantTransfers.length === 0) {
        return false;
      }

      if (minAmount !== null) {
        const hasMatchingAmount = relevantTransfers.some((tokenTransfer) =>
          this.meetsMinAmount(tokenTransfer, minAmount)
        );

        if (!hasMatchingAmount) {
          return false;
        }
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