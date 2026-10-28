const crypto = require('crypto');
const { io } = require('socket.io-client');
const axios = require('axios');
const logger = require('../utils/logger');
const { parseJson } = require('../utils/parseJson');
const database = require('../config/database');
const webhookService = require('./webhookService');
const confirmationPollingService = require('./confirmationPollingService');
const filterMatching = require('./filterMatching');
const { hydrateSubscriptionFilters } = require('./tokenMetadata');
const { classifyTokenMovement, resolveRootTxHash } = require('./tokenMovementClassifier');

const DEDUPE_CACHE_MAX = 2000;
const ROOT_TRANSACTION_CACHE_TTL_MS = 10 * 60 * 1000;

/** Set LOG_LEVEL=debug or TRANSFER_LOG_VERBOSE=1 for per-transfer and no-match dumps. */
const FILTER_DEBUG =
  process.env.LOG_LEVEL === 'debug' ||
  process.env.WEBSOCKET_FILTER_DEBUG === 'true' ||
  process.env.WEBSOCKET_FILTER_DEBUG === '1';

const VERBOSE_TRANSFERS =
  FILTER_DEBUG ||
  process.env.TRANSFER_LOG_VERBOSE === 'true' ||
  process.env.TRANSFER_LOG_VERBOSE === '1';

/** When true, skip REST GET /transactions/:hash to enrich thin WS payloads (not recommended). */
const ENRICH_DISABLED =
  process.env.DISABLE_WS_TRANSFER_ENRICHMENT === 'true' ||
  process.env.DISABLE_WS_TRANSFER_ENRICHMENT === '1';

/** MultiversX caps subscribeCustomTransfers per WebSocket session (default 10). */
const MVX_WS_MAX_SUBSCRIPTIONS_PER_SOCKET = Math.min(
  50,
  Math.max(1, parseInt(process.env.MVX_WS_MAX_SUBSCRIPTIONS_PER_SOCKET, 10) || 10)
);

/**
 * Serialize API payload to a stable key for deduplication of API subscriptions.
 * Multiple subscriptions with the same payload share one WebSocket subscription.
 */
function payloadKey(payload) {
  return JSON.stringify(payload);
}

/** Same filter on two networks must not share one registration set. */
function payloadGroupKey(network, key) {
  return JSON.stringify([network, key]);
}

function payloadIdentifier(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 12);
}

function safeSubscriptionError(error) {
  if (typeof error === 'string') return error.slice(0, 300);
  if (error && typeof error.message === 'string') return error.message.slice(0, 300);
  try {
    const text = JSON.stringify(error);
    return text ? text.slice(0, 300) : 'unknown subscription error';
  } catch (_) {
    return 'unknown subscription error';
  }
}

/** Connected sockets can take a non-volatile emit. Disconnected emits fill sendBuffer. */
function socketIsConnected(socket) {
  return !!(socket && socket.connected === true);
}

class WebSocketService {
  constructor() {
    /** @type {Map<string, Array<{ socket: import('socket.io-client').Socket, payloadKeys: Set<string>, shardIndex: number }>>} */
    this.shardBuckets = new Map(); // network -> shards (each shard = one MVX WS connection)
    this.subscriptions = new Map(); // subscriptionId -> { shard, payload, network }
    this.payloadToSubscriptionIds = new Map(); // payloadKey -> Set<subscriptionId>
    this.deliveredKeys = new Set(); // txHash|status for deduplication (timestamp removed for stronger dedupe)
    this.rootTransactionCache = new Map();
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

  /** MVX shard that already owns this subscribe payload on this network. */
  findShardForPayload(network, payloadKeyStr) {
    const shards = this.shardBuckets.get(network) || [];
    return shards.find((s) => s.payloadKeys.has(payloadKeyStr)) || null;
  }

  /**
   * One MVX WebSocket session (~10 subscribeCustomTransfers max). Opens a new connection.
   */
  async createShard(network) {
    const wsUrl = await this.getWebSocketUrl(network);
    const shards = this.shardBuckets.get(network) || [];
    const shardIndex = shards.length;

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

    const shard = {
      network,
      shardIndex,
      socket,
      payloadKeys: new Set(),
      sessionId: 0,
      registrations: new Map(),
      loggedErrors: new Set()
    };

    socket.on('connect', () => {
      shard.sessionId += 1;
      shard.loggedErrors.clear();
      logger.info(
        `WebSocket shard ${shardIndex} connected to ${network} (session ${shard.sessionId})`
      );
      this.resubscribeShard(shard);
    });

    socket.on('disconnect', (reason) => {
      logger.warn(`WebSocket shard ${shardIndex} disconnected from ${network}: ${reason}`);
    });

    socket.on('connect_error', (error) => {
      const errMsg = error?.message ?? (typeof error === 'string' ? error : JSON.stringify(error));
      logger.error(`WebSocket shard ${shardIndex} connection error for ${network}: ${errMsg}`);
    });

    socket.on('error', (errorData) => {
      this.handleShardError(shard, errorData);
    });

    socket.on('customTransferUpdate', async (data) => {
      await this.handleTransferUpdate(network, data);
    });

    if (!this.shardBuckets.has(network)) {
      this.shardBuckets.set(network, []);
    }
    this.shardBuckets.get(network).push(shard);

    logger.info(
      `Opened WebSocket shard ${shardIndex} for ${network} (MVX limit ${MVX_WS_MAX_SUBSCRIPTIONS_PER_SOCKET} subscribe payloads per shard)`
    );

    return shard;
  }

  /** Pick a shard with capacity or open another connection (MVX max subscriptions per socket). */
  async acquireShardWithCapacity(network) {
    const shards = this.shardBuckets.get(network) || [];
    for (const shard of shards) {
      if (shard.payloadKeys.size < MVX_WS_MAX_SUBSCRIPTIONS_PER_SOCKET) {
        return shard;
      }
    }
    return this.createShard(network);
  }

  /**
   * Ask the server to register one filter for this connection session.
   * Nothing is emitted while disconnected: Socket.IO would buffer that packet
   * and flush it before the connect listener, duplicating resubscribeShard().
   * A connected socket always uses a normal emit. If the transport is not
   * writable, Socket.IO keeps the packet on the engine write buffer and
   * flushes it on drain. Volatile emits are not used; those are discarded.
   * The state stays "requested" only after that emit. A missing ack is left
   * as requested and is not resent on this session, because a second join
   * still counts toward the 10-subscription cap. NestJS returns
   * `{ status: 'success' }` as an ack when the room join works. Failures
   * arrive on the `error` event (`pattern`, `data`, `error`).
   */
  emitSubscribe(shard, payload, key) {
    if (!socketIsConnected(shard.socket)) return false;
    const current = shard.registrations.get(key);
    if (current && current.sessionId === shard.sessionId) return false;

    const sessionId = shard.sessionId;
    shard.registrations.set(key, { state: 'requested', sessionId });
    shard.socket.emit('subscribeCustomTransfers', payload, (response) => {
      const registration = shard.registrations.get(key);
      if (!registration || registration.sessionId !== sessionId) return;
      if (response && response.status === 'success') {
        registration.state = 'confirmed';
        logger.info(
          `WebSocket shard ${shard.shardIndex} subscription confirmed on ${shard.network} payloadId=${payloadIdentifier(key)}`
        );
        return;
      }
      if (response && (response.error || response.status === 'error')) {
        registration.state = 'rejected';
        this.logSubscriptionRejection(
          shard,
          'subscribeCustomTransfers',
          key,
          response.error || response
        );
      }
    });
    logger.info(
      `WebSocket shard ${shard.shardIndex} subscription requested on ${shard.network} payloadId=${payloadIdentifier(key)} session=${sessionId}`
    );
    return true;
  }

  emitUnsubscribe(shard, payload, key) {
    shard.registrations.delete(key);
    if (!socketIsConnected(shard.socket)) return false;
    shard.socket.emit('unsubscribeCustomTransfers', payload);
    return true;
  }

  logSubscriptionRejection(shard, pattern, key, error) {
    const payloadId = key ? payloadIdentifier(key) : 'unknown';
    const message = safeSubscriptionError(error);
    const dedupe = `${shard.sessionId}|${pattern}|${payloadId}|${message}`;
    if (shard.loggedErrors.has(dedupe)) return;
    shard.loggedErrors.add(dedupe);
    logger.error(
      `WebSocket shard ${shard.shardIndex} subscription rejected on ${shard.network} pattern=${pattern} payloadId=${payloadId}: ${message}`
    );
  }

  handleShardError(shard, errorData) {
    const pattern = errorData && typeof errorData === 'object' ? errorData.pattern : null;
    const data = errorData && typeof errorData === 'object' ? errorData.data : null;
    if (pattern && data && typeof data === 'object') {
      let key = null;
      try {
        key = payloadKey(data);
      } catch (_) {
        key = null;
      }
      if (key && shard.registrations.has(key)) {
        const registration = shard.registrations.get(key);
        if (registration && registration.sessionId === shard.sessionId) {
          registration.state = 'rejected';
        }
      }
      this.logSubscriptionRejection(
        shard,
        pattern,
        key,
        errorData.error != null ? errorData.error : errorData
      );
      return;
    }

    const errMsg = errorData?.message ?? (typeof errorData === 'string' ? errorData : safeSubscriptionError(errorData));
    logger.error(
      `WebSocket shard ${shard.shardIndex} server error for ${shard.network}: ${errMsg}`
    );
  }

  resubscribeShard(shard) {
    try {
      if (shard.payloadKeys.size === 0) return;
      let requested = 0;
      for (const key of shard.payloadKeys) {
        const payload = JSON.parse(key);
        if (this.emitSubscribe(shard, payload, key)) requested += 1;
      }
      logger.info(
        `Re-subscribed shard ${shard.shardIndex} on ${shard.network}: ${requested} requested, ${shard.payloadKeys.size} desired`
      );
    } catch (error) {
      logger.error(`Failed to re-subscribe shard ${shard.shardIndex} (${shard.network}):`, error.message);
    }
  }

  pruneEmptyShard(network, shard) {
    if (shard.payloadKeys.size > 0) return;
    try {
      shard.socket.disconnect();
    } catch (e) {
      logger.warn(`Shard ${shard.shardIndex} disconnect: ${e.message}`);
    }
    const shards = this.shardBuckets.get(network);
    if (!shards) return;
    const idx = shards.indexOf(shard);
    if (idx !== -1) shards.splice(idx, 1);
    logger.info(`Removed empty WebSocket shard ${shard.shardIndex} for ${network}`);
  }

  async createSubscription(subscriptionId, filters, network = 'mainnet') {
    try {
      
      // Validate at least one filter is provided
      const filterKeys = Object.keys(filters).filter(key => filters[key]);
      if (filterKeys.length === 0) {
        throw new Error('At least one filter must be provided');
      }

      // MultiversX API filters: sender, receiver, relayer, token, address (NOT function)
      // The API's function filter is unreliable when combined with address/sender/receiver
      // (e.g. DEX swaps often produce SCRs with function "exchange" not "swap").
      // We omit function from the API payload and filter by function client-side in matchesFilters().
      const apiToken = this.resolveApiTokenFilter(filters);
      const payload = {
        sender: filters.sender || undefined,
        receiver: filters.receiver || undefined,
        relayer: filters.relayer || undefined,
        token: apiToken,
        address: filters.address || undefined
      };

      // Remove undefined values
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

      // User→SC calls (e.g. marketplace `buy`) appear with the wallet as sender and the contract as receiver.
      // Subscribing with API `sender` = contract drops those rows server-side. Using `address` includes both legs.
      const loneSenderAnchor =
        payload.sender &&
        !payload.receiver &&
        !payload.relayer &&
        !payload.token &&
        !payload.address;
      if (loneSenderAnchor) {
        payload.address = payload.sender;
        delete payload.sender;
        logger.info(
          `Subscription ${subscriptionId}: API filter uses address=<sender> so inbound SC calls are not dropped by MVX`
        );
      }

      // API requires at least one filter; function / collection / amounts are client-side only
      if (Object.keys(payload).length === 0) {
        throw new Error(
          'At least one API filter is required: address, sender, receiver, relayer, or token'
        );
      }

      // Validate: address cannot be combined with sender/receiver/relayer
      if (payload.address && (payload.sender || payload.receiver || payload.relayer)) {
        throw new Error('Address filter cannot be combined with sender, receiver, or relayer filters');
      }

      const key = payloadKey(payload);
      const group = payloadGroupKey(network, key);
      const existing = this.payloadToSubscriptionIds.get(group);
      const isFirstForPayload = !existing || existing.size === 0;

      let shard;
      if (isFirstForPayload) {
        shard = await this.acquireShardWithCapacity(network);
        this.payloadToSubscriptionIds.set(group, new Set([subscriptionId]));
        shard.payloadKeys.add(key);
        this.emitSubscribe(shard, payload, key);
        logger.info(
          `Creating subscription ${subscriptionId} (first for payload, shard ${shard.shardIndex})`
        );
      } else {
        existing.add(subscriptionId);
        shard = this.findShardForPayload(network, key);
        if (!shard) {
          logger.error(`Missing shard for payload on ${network}; recovering with a new socket`);
          shard = await this.acquireShardWithCapacity(network);
          if (!shard.payloadKeys.has(key)) {
            shard.payloadKeys.add(key);
            this.emitSubscribe(shard, payload, key);
          }
        }
        logger.info(`Creating subscription ${subscriptionId} (merged with existing payload, ${existing.size} total)`);
      }

      this.subscriptions.set(subscriptionId, {
        shard,
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

      const { shard, payload, network } = subscription;
      const key = payloadKey(payload);
      const group = payloadGroupKey(network, key);
      const ids = this.payloadToSubscriptionIds.get(group);
      if (ids) {
        ids.delete(subscriptionId);
        if (ids.size === 0) {
          this.payloadToSubscriptionIds.delete(group);
          shard.payloadKeys.delete(key);
          this.emitUnsubscribe(shard, payload, key);
          this.pruneEmptyShard(network, shard);
          logger.info(`Removed subscription ${subscriptionId} (last for payload)`);
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

  subscriptionsNeedNestedMatching(subscriptions) {
    return subscriptions.some((s) => {
      const f = parseJson(s.filters);
      if (!f || typeof f !== 'object') return false;
      if (f.matchTopLevelOnly) {
        return !!(f.collectionIdentifier || f.tokenIdentifier);
      }
      return !!(f.function || f.collectionIdentifier || f.tokenIdentifier || f.token);
    });
  }

  isThinTransferPayload(transfer) {
    const ops = transfer?.operations;
    const res = transfer?.results;
    const hasOps = Array.isArray(ops) && ops.length > 0;
    const hasRes = Array.isArray(res) && res.length > 0;
    return !hasOps && !hasRes;
  }

  /** True when operations are missing — webhook consumers need these for NFT sales. */
  needsOperationsEnrichment(transfer) {
    const ops = transfer?.operations;
    return !Array.isArray(ops) || ops.length === 0;
  }

  mergeApiTxIntoTransfer(wsTransfer, apiTx) {
    if (!apiTx || typeof apiTx !== 'object') return wsTransfer;
    const merged = {
      ...wsTransfer,
      ...apiTx,
      txHash: wsTransfer?.txHash || apiTx.txHash,
      hash: wsTransfer?.hash || apiTx.hash || apiTx.txHash,
    };
    // REST often types SCR rows as "unsigned"; keep WebSocket SmartContractResult for filters.
    const wsType = this.normalizeValue(wsTransfer?.type);
    if (wsType === 'smartcontractresult') {
      merged.type = wsTransfer.type;
    }
    return merged;
  }

  async maybeEnrichTransfer(transfer, subscriptions, network) {
    if (ENRICH_DISABLED) return transfer;
    const txId = transfer?.txHash || transfer?.hash;
    if (!txId || txId === 'unknown') return transfer;
    const statusLower = (transfer?.status || '').toLowerCase();
    if (statusLower !== 'pending' && statusLower !== 'success') return transfer;
    if (!this.isThinTransferPayload(transfer)) return transfer;
    if (!this.subscriptionsNeedNestedMatching(subscriptions)) return transfer;

    const apiTx = await this.fetchTransactionDetails(network, txId);
    if (!apiTx) return transfer;

    const enriched = this.mergeApiTxIntoTransfer(transfer, apiTx);
    logger.debug(
      `Transfer ${txId}: pre-enriched for matching (operations=${enriched?.operations?.length || 0}, type=${enriched?.type})`
    );
    return enriched;
  }

  /**
   * Re-fetch the SCR/transfer by its own hash before webhook delivery.
   * Confirmation polling uses the parent hash for status, so the original WS SCR
   * row is often still thin (operations: []). By the time status is final the
   * indexer usually has ops/logs — retry briefly if not.
   */
  async enrichTransferForDelivery(transfer, network, options = {}) {
    if (ENRICH_DISABLED || !transfer) return transfer;
    if (!this.needsOperationsEnrichment(transfer)) return transfer;

    const retries = Number.isInteger(options.retries) ? options.retries : 2;
    const delayMs = Number.isInteger(options.delayMs) ? options.delayMs : 1500;
    const preserveStatus = transfer.status;
    let current = transfer;
    const txId = current?.txHash || current?.hash;

    if (!txId || txId === 'unknown') return transfer;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const apiTx = await this.fetchTransactionDetails(network, txId);
      if (apiTx) {
        current = this.mergeApiTxIntoTransfer(current, apiTx);
        if (preserveStatus) current.status = preserveStatus;
        if (!this.needsOperationsEnrichment(current)) {
          logger.debug(
            `Transfer ${txId}: enriched for delivery (operations=${current.operations.length}, attempt=${attempt + 1})`
          );
          return current;
        }
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    logger.warn(
      `Transfer ${txId}: delivery enrich still missing operations after ${retries + 1} attempt(s)`
    );
    return current;
  }

  async fetchTransactionDetails(network, txHash) {
    const apiUrl = this.apiEndpoints[network];
    if (!apiUrl || !txHash || txHash === 'unknown') return null;
    try {
      const response = await axios.get(`${apiUrl}/transactions/${txHash}`, { timeout: 15000 });
      return response.data || null;
    } catch (error) {
      logger.warn(`REST enrich failed for ${txHash}: ${error.message}`);
      return null;
    }
  }

  async fetchRootTransaction(network, rootTxHash) {
    const key = `${network}:${rootTxHash}`;
    const cached = this.rootTransactionCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const value = await this.fetchTransactionDetails(network, rootTxHash);
    if (value) this.rootTransactionCache.set(key, { value, expiresAt: Date.now() + ROOT_TRANSACTION_CACHE_TTL_MS });
    return value;
  }

  /**
   * Produces raw and classified webhook work once per transfer. Kept here so
   * confirmation polling uses exactly the same classification and filtering.
   */
  async buildDeliveryPlansForTransfer(transfer, subscriptions, network, options = {}) {
    const match = await this.matchSubscriptionsForTransfer(transfer, subscriptions, network, options);
    const raw = [];
    const classified = [];
    const status = (transfer?.status || '').toLowerCase();
    const classificationCache = new Map();
    const rootHash = resolveRootTxHash(transfer);
    let rootTransaction = options.rootTransaction || options.parentTransaction || null;

    for (const subscription of match.subscriptionsToDeliver) {
      const filters = parseJson(subscription.filters) || {};
      if (filters.movementMode !== 'classified') {
        raw.push({
          subscription,
          transfer,
          dedupeKey: filterMatching.buildRawDeliveryDedupeKey(subscription, transfer, filters),
        });
        continue;
      }
      // Classified movements are confirmed-only, even for malformed legacy rows.
      if (status !== 'success' || !rootHash) continue;
      if (!rootTransaction) rootTransaction = await this.fetchRootTransaction(network, rootHash);
      if (!rootTransaction) continue;
      const token = filters.tokenIdentifier;
      const cacheKey = `${rootHash}:${token}`;
      let movement = classificationCache.get(cacheKey);
      if (movement === undefined) {
        movement = await classifyTokenMovement({
          triggerTransfer: transfer, rootTransaction, targetTokenIdentifier: token,
          tokenDecimals: filters.tokenDecimals, network,
        }).catch((error) => {
          logger.debug(`Movement classification failed for ${rootHash}: ${error.message}`);
          return null;
        });
        classificationCache.set(cacheKey, movement);
      }
      if (!movement || !filters.movementTypes?.includes(movement.type)) continue;
      const amount = BigInt(movement.targetToken.atomicAmount);
      const decimals = Number(filters.tokenDecimals) || 0;
      const min = filters.movementAmountMin ? filterMatching.parseAmount(filters.movementAmountMin, decimals) : null;
      const max = filters.movementAmountMax ? filterMatching.parseAmount(filters.movementAmountMax, decimals) : null;
      if ((min != null && amount < min) || (max != null && amount > max)) continue;
      classified.push({ subscription, transfer, movement, dedupeKey: `movement|${subscription.id}|${rootHash}|${token}` });
    }
    return { ...match, raw, classified };
  }

  /**
   * Shared matching path for WebSocket handling and confirmation polling.
   * Row-level filters apply to the current transfer only. Asset filters may fall
   * back to the original parent transaction (originalTxHash) once per transfer.
   *
   * @param {object} [options]
   * @param {object|null} [options.parentTransaction] - Reuse an already-fetched parent
   * @returns {Promise<{ matchedSubs: any[], subscriptionsToDeliver: any[] }>}
   */
  async matchSubscriptionsForTransfer(transfer, subscriptions, network, options = {}) {
    const matchedSubs = [];
    const subscriptionsToDeliver = [];
    const txId = transfer?.txHash || transfer?.hash || 'unknown';

    const candidates = [];
    for (const subscription of subscriptions) {
      const filters = parseJson(subscription.filters);
      if (!filterMatching.matchesRowFilters(transfer, filters)) continue;
      candidates.push({ subscription, filters });
    }

    let parentTransaction = options.parentTransaction || null;
    const needsParent = candidates.some(({ filters }) =>
      filterMatching.requiresParentAssetContext(transfer, filters)
    );

    if (!parentTransaction && needsParent && transfer?.originalTxHash) {
      parentTransaction = await this.fetchTransactionDetails(network, transfer.originalTxHash);
      if (!parentTransaction) {
        logger.warn(
          `Parent transaction context unavailable for SCR ${txId}, originalTxHash=${transfer.originalTxHash}`
        );
      }
    }

    for (const { subscription, filters } of candidates) {
      const topLevelOnly = filters?.matchTopLevelOnly === true;
      const needsAssetParent = filterMatching.requiresParentAssetContext(transfer, filters);

      if (FILTER_DEBUG && needsAssetParent && filters?.collectionIdentifier) {
        logger.debug(
          `SCR ${txId}: collection ${filters.collectionIdentifier} not on current row; checking parent ${transfer.originalTxHash}`
        );
      }
      if (FILTER_DEBUG && needsAssetParent && filters?.tokenIdentifier) {
        logger.debug(
          `SCR ${txId}: tokenIdentifier ${filters.tokenIdentifier} not on current row; checking parent ${transfer.originalTxHash}`
        );
      }

      if (!filterMatching.matchesFilters(transfer, filters, { parentTransaction })) {
        continue;
      }

      if (
        FILTER_DEBUG &&
        parentTransaction &&
        filters?.collectionIdentifier &&
        !filterMatching.transferHasCollection(
          transfer,
          filters.collectionIdentifier,
          topLevelOnly
        ) &&
        filterMatching.transferHasCollection(
          parentTransaction,
          filters.collectionIdentifier,
          topLevelOnly
        )
      ) {
        logger.debug(
          `SCR ${txId}: collection ${filters.collectionIdentifier} matched from parent ${transfer.originalTxHash}`
        );
      }

      matchedSubs.push(subscription);
      const status = (transfer?.status || '').toLowerCase();
      if (filters.onlyConfirmed && status === 'pending') {
        logger.debug(
          `Transfer ${txId} matched subscription ${subscription.id} (${subscription.name}, onlyConfirmed: skip pending)`
        );
        continue;
      }

      logger.info(
        `[subscription] ${subscription.name} (id=${subscription.id}) ← tx ${txId} function=${this.transferFunctionName(transfer)} status=${status}`
      );
      subscriptionsToDeliver.push(subscription);
    }
    return { matchedSubs, subscriptionsToDeliver };
  }

  /**
   * Synchronous row+local-asset match only (no parent fetch).
   * Prefer matchSubscriptionsForTransfer when parent asset context may be required.
   * @returns {{ matchedSubs: any[], subscriptionsToDeliver: any[] }}
   */
  evaluateTransferAgainstSubscriptions(transfer, subscriptions) {
    const matchedSubs = [];
    const subscriptionsToDeliver = [];
    const txId = transfer?.txHash || transfer?.hash || 'unknown';

    for (const subscription of subscriptions) {
      const filters = parseJson(subscription.filters);
      if (!this.matchesFilters(transfer, filters)) continue;

      matchedSubs.push(subscription);
      const status = (transfer?.status || '').toLowerCase();
      if (filters.onlyConfirmed && status === 'pending') {
        logger.debug(
          `Transfer ${txId} matched subscription ${subscription.id} (${subscription.name}, onlyConfirmed: skip pending)`
        );
        continue;
      }

      logger.info(
        `[subscription] ${subscription.name} (id=${subscription.id}) ← tx ${txId} function=${this.transferFunctionName(transfer)} status=${status}`
      );
      subscriptionsToDeliver.push(subscription);
    }
    return { matchedSubs, subscriptionsToDeliver };
  }

  async handleTransferUpdate(network, data) {
    try {
      if (!data.transfers || !Array.isArray(data.transfers) || data.transfers.length === 0) {
        return;
      }

      const subscriptionsRaw = await database.query(`
        SELECT s.*, u.address as user_address 
        FROM subscriptions s
        JOIN users u ON s.user_id = u.id
        WHERE s.network = ? AND s.is_active = true
      `, [network]);

      const subscriptions = await hydrateSubscriptionFilters(subscriptionsRaw, network);

      logger.debug(
        `Received ${data.transfers.length} transfer(s) from ${network}, ${subscriptions.length} active subscription(s)`
      );

      if (subscriptions.length === 0) {
        return;
      }

      for (const transfer of data.transfers) {
        const txId = transfer?.txHash || transfer?.hash || 'unknown';
        const fn = this.transferFunctionName(transfer);
        if (VERBOSE_TRANSFERS) {
          logger.info(
            `Transfer: txHash=${txId} sender=${transfer?.sender} receiver=${transfer?.receiver} function=${fn} status=${transfer?.status} type=${transfer?.type}`
          );
        }

        if (!this.shouldProcessTransfer(transfer)) {
          logger.debug(
            `Skipping non-success transfer ${txId} (status=${transfer?.status || 'unknown'})`
          );
          continue;
        }

        const statusLower = (transfer?.status || '').toLowerCase();
        const processedTransfer = await this.maybeEnrichTransfer(transfer, subscriptions, network);
        const plans = await this.buildDeliveryPlansForTransfer(
          processedTransfer,
          subscriptions,
          network
        );
        const { matchedSubs, raw, classified } = plans;

        const schedulePoll = statusLower === 'pending' && matchedSubs.length > 0;
        const hasWork = raw.length > 0 || classified.length > 0 || schedulePoll;

        if (!hasWork) {
          if (VERBOSE_TRANSFERS && matchedSubs.length === 0 && subscriptions.length > 0) {
            const deepFns = [...this.transferFunctionNamesSet(processedTransfer)].join(',');
            logger.debug(
              `Transfer ${txId} did not match any subscription (receiver=${processedTransfer?.receiver}, topFunction=${fn}, deepFunctions=[${deepFns}])`
            );
            if (FILTER_DEBUG) {
              const senders = [...this.transferSenderAddressesSet(processedTransfer)].slice(0, 8).join(',');
              const receivers = [...this.transferReceiverAddressesSet(processedTransfer)].slice(0, 8).join(',');
              logger.debug(
                `Transfer ${txId} filter-debug senders(sample)=${senders} receivers(sample)=${receivers}`
              );
            }
            subscriptions.forEach((s) => {
              const f = parseJson(s.filters);
              logger.debug(
                `  Sub ${s.id} (${s.name}): receiver=${f?.receiver || '(any)'}, function=${f?.function || '(any)'}, transactionType=${f?.transactionType || '(any)'}, matchTopLevelOnly=${f?.matchTopLevelOnly ? 'yes' : 'no'}, tokenIdentifier=${f?.tokenIdentifier || '(any)'}, collectionIdentifier=${f?.collectionIdentifier || '(any)'}, sender=${f?.sender || '(any)'}, address=${f?.address || '(any)'}, amountMin=${f?.amountMin ?? '(any)'}, amountMax=${f?.amountMax ?? '(any)'}`
              );
            });
          }
          continue;
        }

        for (const plan of raw) {
          if (this.hasDelivered(plan.dedupeKey) || !(await database.tryClaimDelivered(plan.dedupeKey))) continue;
          const result = await webhookService.deliverWebhook(plan.subscription, plan.transfer);
          if (result?.success) this.recordDelivered(plan.dedupeKey);
          else await database.releaseDeliveredClaim(plan.dedupeKey);
        }
        for (const plan of classified) {
          if (this.hasDelivered(plan.dedupeKey) || !(await database.tryClaimDelivered(plan.dedupeKey))) continue;
          const result = await webhookService.deliverWebhook(plan.subscription, plan.transfer, { movement: plan.movement });
          if (result?.success) this.recordDelivered(plan.dedupeKey);
          else await database.releaseDeliveredClaim(plan.dedupeKey);
        }

        if (schedulePoll) {
          confirmationPollingService.scheduleConfirmationCheck(processedTransfer, matchedSubs, network, this);
        }
      }
    } catch (error) {
      logger.error('Error handling transfer update:', error);
    }
  }

  normalizeValue(value) {
    return filterMatching.normalizeValue(value);
  }

  resolveApiTokenFilter(filters) {
    return filterMatching.resolveApiTokenFilter(filters);
  }

  transferHasToken(transfer, targetToken, topLevelOnly = false) {
    return filterMatching.transferHasToken(transfer, targetToken, topLevelOnly);
  }

  transferHasCollection(transfer, targetCollection, topLevelOnly = false) {
    return filterMatching.transferHasCollection(transfer, targetCollection, topLevelOnly);
  }

  parseAmount(value) {
    return filterMatching.parseAmount(value);
  }

  transferValue(transfer) {
    return filterMatching.transferValue(transfer);
  }

  transferFunctionName(transfer) {
    return filterMatching.transferFunctionName(transfer);
  }

  transferFunctionNamesSet(transfer) {
    return filterMatching.transferFunctionNamesSet(transfer);
  }

  transferSenderAddressesSet(transfer) {
    return filterMatching.transferSenderAddressesSet(transfer);
  }

  transferReceiverAddressesSet(transfer) {
    return filterMatching.transferReceiverAddressesSet(transfer);
  }

  shouldProcessTransfer(transfer) {
    // MultiversX WebSocket sends transfers when they first appear (often pending from mempool).
    // The API typically sends each transfer once; we may never get a "success" update.
    // Accept both pending and success so webhooks fire. Failed/invalid are still skipped.
    const status = this.normalizeValue(transfer?.status);
    return status === 'success' || status === 'pending';
  }

  matchesFilters(transfer, filters, options) {
    return filterMatching.matchesFilters(transfer, filters, options);
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

  async cleanup() {
    const ids = [...this.subscriptions.keys()];
    for (const subscriptionId of ids) {
      await this.removeSubscription(subscriptionId);
    }

    for (const shards of this.shardBuckets.values()) {
      for (const shard of shards) {
        try {
          shard.socket.disconnect();
          logger.info(`Disconnected WebSocket shard ${shard.shardIndex} for ${shard.network}`);
        } catch (e) {
          logger.warn(`Shard disconnect: ${e.message}`);
        }
      }
    }

    this.shardBuckets.clear();
    this.subscriptions.clear();
    this.payloadToSubscriptionIds.clear();
    this.deliveredKeys.clear();
    this.rootTransactionCache.clear();
  }
}

module.exports = new WebSocketService();