const axios = require('axios');
const logger = require('../utils/logger');
const { parseRetryAfterSeconds } = require('../utils/retryAfter');

const DEFAULT_HOSTS = new Set([
  'api.multiversx.com',
  'testnet-api.multiversx.com',
  'devnet-api.multiversx.com',
]);

const ENV_URL_KEYS = [
  'MVX_API_MAINNET',
  'MVX_API_TESTNET',
  'MVX_API_DEVNET',
  'MVX_NATIVE_AUTH_API',
];

const PERMANENT_STATUS = new Set([400, 401, 403, 404, 405, 409, 410, 422]);
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_NETWORK = new Set([
  'ECONNABORTED',
  'ETIMEDOUT',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ERR_NETWORK',
]);

function clamp(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function managedHosts() {
  const hosts = new Set(DEFAULT_HOSTS);
  ENV_URL_KEYS.forEach((key) => {
    const raw = process.env[key];
    if (!raw) return;
    try {
      hosts.add(new URL(raw).hostname);
    } catch (_) {
      // Ignore malformed operator config.
    }
  });
  return hosts;
}

function resolveUrl(config) {
  const raw = config?.url == null ? '' : String(config.url);
  try {
    return new URL(raw, config?.baseURL || 'http://localhost').toString();
  } catch (_) {
    return raw;
  }
}

function isManagedMvxUrl(url) {
  try {
    return managedHosts().has(new URL(url).hostname);
  } catch (_) {
    return false;
  }
}

function pathOf(url) {
  try {
    return new URL(url).pathname;
  } catch (_) {
    return 'unknown';
  }
}

function priorityFor(url) {
  try {
    const path = new URL(url).pathname;
    if (path === '/blocks' || path.startsWith('/blocks/')) return 'high';
  } catch (_) {
    // Fall through to normal priority.
  }
  return 'normal';
}

function cacheTtlMs(url, data) {
  let path = '';
  try {
    path = new URL(url).pathname;
  } catch (_) {
    return 0;
  }
  if (/^\/blocks\/[^/]+$/.test(path)) return 60 * 60 * 1000;
  if (path === '/blocks') return 6000;
  if (path.startsWith('/tokens/')) return 60 * 60 * 1000;
  if (path === '/websocket/config') return data?.url ? 5 * 60 * 1000 : 0;
  if (/^\/transactions\/[^/]+$/.test(path)) {
    const status = String(data?.status || '').toLowerCase();
    if (status === 'success' || status === 'fail' || status === 'invalid' || status === 'failed') {
      return 10 * 60 * 1000;
    }
  }
  return 0;
}

function cloneData(data) {
  if (data == null || typeof data !== 'object') return data;
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (_) {
    return data;
  }
}

function computeRetryDelayMs({
  retryAfterHeader,
  attempt,
  maxRetryWaitMs,
  random = Math.random,
}) {
  let ms = null;
  const seconds = parseRetryAfterSeconds(retryAfterHeader);
  if (seconds != null) ms = seconds * 1000;
  if (ms == null) ms = 200 * (2 ** attempt);
  const jitter = Math.floor(random() * 100);
  return Math.min(Math.max(0, ms) + jitter, maxRetryWaitMs);
}

function planRetry({
  status,
  code,
  retryAfterHeader,
  attempt,
  maxRetries,
  maxRetryWaitMs,
  random = Math.random,
}) {
  if (code === 'MVX_QUEUE_TIMEOUT') return null;
  if (status && PERMANENT_STATUS.has(status)) return null;
  const retryableStatus = Boolean(status && RETRYABLE_STATUS.has(status));
  const retryableNetwork = Boolean(!status && RETRYABLE_NETWORK.has(code));
  if (!retryableStatus && !retryableNetwork) return null;
  if (attempt >= maxRetries) return null;

  const headerSeconds = parseRetryAfterSeconds(retryAfterHeader);
  if (headerSeconds != null && headerSeconds * 1000 > maxRetryWaitMs) {
    return null;
  }
  return {
    delayMs: computeRetryDelayMs({
      retryAfterHeader,
      attempt,
      maxRetryWaitMs,
      random,
    }),
  };
}

function readRetryAfterHeader(error) {
  const headers = error?.response?.headers;
  if (!headers) return null;
  return headers['retry-after'] || headers['Retry-After'] || null;
}

class Scheduler {
  constructor({ spacingMs, maxConcurrency, maxQueueWaitMs, maxQueue }) {
    this.spacingMs = spacingMs;
    this.maxConcurrency = maxConcurrency;
    this.maxQueueWaitMs = maxQueueWaitMs;
    this.maxQueue = maxQueue;
    this.active = 0;
    this.high = [];
    this.normal = [];
    this.nextSlot = 0;
    this.timer = null;
  }

  acquire(priority) {
    const queue = priority === 'high' ? this.high : this.normal;
    if (queue.length >= this.maxQueue) {
      const error = new Error('MultiversX API queue is full');
      error.code = 'MVX_QUEUE_TIMEOUT';
      return Promise.reject(error);
    }
    return new Promise((resolve, reject) => {
      const entry = { priority, resolve, reject, timer: null };
      queue.push(entry);
      entry.timer = setTimeout(() => {
        const currentQueue = entry.priority === 'high' ? this.high : this.normal;
        const index = currentQueue.indexOf(entry);
        if (index >= 0) {
          currentQueue.splice(index, 1);
          const error = new Error('MultiversX API queue timeout');
          error.code = 'MVX_QUEUE_TIMEOUT';
          reject(error);
        }
      }, this.maxQueueWaitMs);
      this.drain();
    });
  }

  popNext() {
    if (this.high.length) return this.high.shift();
    if (this.normal.length) return this.normal.shift();
    return null;
  }

  schedule(delay) {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.drain();
    }, Math.max(0, delay));
  }

  drain() {
    while (this.active < this.maxConcurrency) {
      const peek = this.high[0] || this.normal[0];
      if (!peek) return;
      const now = Date.now();
      if (now < this.nextSlot) {
        this.schedule(this.nextSlot - now);
        return;
      }
      const entry = this.popNext();
      clearTimeout(entry.timer);
      this.active += 1;
      this.nextSlot = now + this.spacingMs;
      entry.resolve(() => this.release());
    }
  }

  release() {
    this.active = Math.max(0, this.active - 1);
    this.drain();
  }
}

function createInflight() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject, settled: false };
}

function toResponse(snapshot, config) {
  return {
    data: cloneData(snapshot.data),
    status: snapshot.status,
    statusText: snapshot.status >= 200 && snapshot.status < 300 ? 'OK' : 'ERR',
    headers: snapshot.headers || {},
    config,
  };
}

function asSharedError(error, config) {
  const wrapped = new Error(error?.message || 'MultiversX API request failed');
  wrapped.isAxiosError = true;
  wrapped.response = error?.response;
  wrapped.code = error?.code;
  wrapped.config = config;
  config.__mvxShared = true;
  return wrapped;
}

function installMvxApiGuard(instance = axios, options = {}) {
  if (instance.__mvxGuard && !options.force) return instance.__mvxGuard;
  if (instance.__mvxGuard) uninstallMvxApiGuard(instance);

  const maxRps = clamp(
    options.maxRps ?? process.env.MVX_API_MAX_RPS,
    0.2,
    50,
    1
  );
  const maxConcurrency = clamp(
    options.maxConcurrency ?? process.env.MVX_API_MAX_CONCURRENCY,
    1,
    8,
    1
  );
  const maxRetries = clamp(
    options.maxRetries ?? process.env.MVX_API_MAX_RETRIES,
    0,
    4,
    2
  );
  const maxRetryWaitMs = clamp(
    options.maxRetryWaitMs ?? process.env.MVX_API_MAX_RETRY_WAIT_MS,
    0,
    8000,
    3000
  );
  const maxQueueWaitMs = clamp(
    options.maxQueueWaitMs ?? process.env.MVX_API_MAX_QUEUE_WAIT_MS,
    50,
    8000,
    4000
  );
  const maxQueue = clamp(options.maxQueue ?? process.env.MVX_API_MAX_QUEUE, 1, 200, 40);
  const maxCacheEntries = clamp(options.maxCacheEntries, 10, 5000, 400);
  const random = options.random || Math.random;

  const scheduler = new Scheduler({
    spacingMs: 1000 / maxRps,
    maxConcurrency,
    maxQueueWaitMs,
    maxQueue,
  });
  const cache = new Map();
  const inflight = new Map();

  function readCache(url) {
    const row = cache.get(url);
    if (!row) return null;
    if (row.expiresAt <= Date.now()) {
      cache.delete(url);
      return null;
    }
    cache.delete(url);
    cache.set(url, row);
    return row.snapshot;
  }

  function writeCache(url, snapshot) {
    const ttl = cacheTtlMs(url, snapshot.data);
    if (!ttl) return;
    if (cache.has(url)) cache.delete(url);
    cache.set(url, { snapshot, expiresAt: Date.now() + ttl });
    while (cache.size > maxCacheEntries) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
  }

  function releaseSlot(config) {
    if (typeof config?.__mvxRelease === 'function') {
      const release = config.__mvxRelease;
      config.__mvxRelease = null;
      release();
    }
  }

  function settleInflight(config, error, snapshot) {
    const entry = config?.__mvxInflight;
    if (!entry || entry.settled) return;
    entry.settled = true;
    inflight.delete(entry.key);
    if (error) entry.reject(error);
    else entry.resolve(snapshot);
  }

  const onRequest = async (config) => {
    const method = String(config.method || 'get').toLowerCase();
    const url = resolveUrl(config);
    config.__mvxUrl = url;
    if (!isManagedMvxUrl(url)) return config;

    if (method === 'get' && !config.__mvxLeader) {
      const cached = readCache(url);
      if (cached) {
        config.__mvxShared = true;
        config.adapter = async () => toResponse(cached, config);
        return config;
      }
      const pending = inflight.get(url);
      if (pending) {
        config.adapter = () => pending.then(
          (snapshot) => toResponse(snapshot, config),
          (error) => {
            throw asSharedError(error, config);
          }
        );
        return config;
      }

      const created = createInflight();
      // A leader with no concurrent waiter must not surface an unhandled rejection.
      created.promise.catch(() => {});
      inflight.set(url, created.promise);
      config.__mvxLeader = true;
      config.__mvxInflight = { key: url, ...created };
    }

    try {
      const release = await scheduler.acquire(priorityFor(url));
      config.__mvxRelease = release;
    } catch (error) {
      if (error?.code === 'MVX_QUEUE_TIMEOUT') {
        logger.warn(`MVX API queue timeout ${pathOf(url)}: ${error.message}`);
      }
      settleInflight(config, error);
      throw error;
    }
    return config;
  };

  const onResponse = (response) => {
    const config = response?.config || {};
    releaseSlot(config);
    if (!config.__mvxShared && config.__mvxUrl) {
      const snapshot = {
        data: cloneData(response.data),
        status: response.status,
        headers: response.headers || {},
      };
      settleInflight(config, null, snapshot);
      writeCache(config.__mvxUrl, snapshot);
    }
    return response;
  };

  const onError = async (error) => {
    const config = error?.config || {};
    releaseSlot(config);
    const url = config.__mvxUrl || resolveUrl(config);
    if (!isManagedMvxUrl(url) || config.__mvxShared) {
      return Promise.reject(error);
    }

    const attempt = config.__mvxAttempt || 0;
    const decision = planRetry({
      status: error.response?.status,
      code: error.code,
      retryAfterHeader: readRetryAfterHeader(error),
      attempt,
      maxRetries,
      maxRetryWaitMs,
      random,
    });
    if (!decision) {
      settleInflight(config, error);
      return Promise.reject(error);
    }

    config.__mvxAttempt = attempt + 1;
    logger.debug(`MVX API retry ${config.__mvxAttempt} in ${decision.delayMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, decision.delayMs));
    return instance.request(config);
  };

  const requestId = instance.interceptors.request.use(onRequest);
  const responseId = instance.interceptors.response.use(onResponse, onError);
  const guard = {
    requestId,
    responseId,
    cache,
    inflight,
    scheduler,
  };
  instance.__mvxGuard = guard;
  logger.info(
    `MVX API guard installed (maxRps=${maxRps}, concurrency=${maxConcurrency}, maxRetries=${maxRetries}, queueWaitMs=${maxQueueWaitMs}, maxQueue=${maxQueue})`
  );
  return guard;
}

function uninstallMvxApiGuard(instance = axios) {
  const guard = instance.__mvxGuard;
  if (!guard) return;
  instance.interceptors.request.eject(guard.requestId);
  instance.interceptors.response.eject(guard.responseId);
  guard.cache?.clear();
  guard.inflight?.clear();
  if (guard.scheduler?.timer) clearTimeout(guard.scheduler.timer);
  delete instance.__mvxGuard;
}

module.exports = {
  installMvxApiGuard,
  uninstallMvxApiGuard,
  isManagedMvxUrl,
  planRetry,
  computeRetryDelayMs,
  cacheTtlMs,
};
