const axios = require('axios');
const {
  installMvxApiGuard,
  uninstallMvxApiGuard,
  planRetry,
  computeRetryDelayMs,
  cacheTtlMs,
  isManagedMvxUrl,
} = require('../services/mvxApiGuard');

function createClient(adapter, options = {}) {
  const client = axios.create();
  installMvxApiGuard(client, {
    maxRps: 1000,
    maxRetries: 2,
    maxRetryWaitMs: 50,
    maxQueueWaitMs: 80,
    maxConcurrency: 1,
    maxQueue: 5,
    random: () => 0,
    ...options,
  });
  client.defaults.adapter = adapter;
  return client;
}

function axiosError(config, status, headers = {}) {
  const error = new Error(`status ${status}`);
  error.isAxiosError = true;
  error.config = config;
  error.response = { status, headers, data: {} };
  return error;
}

describe('mvxApiGuard', () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  it('caps Retry-After and refuses to retry before a long cooling period', () => {
    expect(computeRetryDelayMs({
      retryAfterHeader: '30',
      attempt: 0,
      maxRetryWaitMs: 3000,
      random: () => 0,
    })).toBe(3000);
    expect(planRetry({
      status: 429,
      retryAfterHeader: '30',
      attempt: 0,
      maxRetries: 2,
      maxRetryWaitMs: 3000,
      random: () => 0,
    })).toBeNull();
    expect(planRetry({
      status: 404,
      attempt: 0,
      maxRetries: 2,
      maxRetryWaitMs: 3000,
    })).toBeNull();
    expect(planRetry({
      status: 400,
      attempt: 0,
      maxRetries: 2,
      maxRetryWaitMs: 3000,
    })).toBeNull();
    expect(planRetry({
      status: 429,
      retryAfterHeader: '0',
      attempt: 0,
      maxRetries: 2,
      maxRetryWaitMs: 3000,
      random: () => 0,
    })).toEqual({ delayMs: 0 });
  });

  it('retries a short 429 and does not retry permanent 404s', async () => {
    let calls = 0;
    const client = createClient(async (config) => {
      calls += 1;
      if (String(config.url).includes('/missing')) {
        throw axiosError(config, 404);
      }
      if (calls < 3) throw axiosError(config, 429, { 'retry-after': '0' });
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    });
    const ok = await client.get('https://api.multiversx.com/blocks/abc?extract=timestamp');
    expect(ok.data.ok).toBe(true);
    expect(calls).toBe(3);
    await expect(client.get('https://api.multiversx.com/blocks/missing')).rejects.toBeTruthy();
    expect(calls).toBe(4);
    uninstallMvxApiGuard(client);
  });

  it('does not retry a 429 whose Retry-After is longer than the caller budget', async () => {
    let calls = 0;
    const client = createClient(async (config) => {
      calls += 1;
      throw axiosError(config, 429, { 'retry-after': '30' });
    });
    await expect(client.get('https://api.multiversx.com/blocks/abc')).rejects.toMatchObject({
      response: { status: 429 },
    });
    expect(calls).toBe(1);
    uninstallMvxApiGuard(client);
  });

  it('caches immutable block reads and terminal transactions, not pending ones', async () => {
    const calls = [];
    const client = createClient(async (config) => {
      calls.push(config.url);
      if (String(config.url).includes('/blocks/')) {
        return { data: 1710000000, status: 200, statusText: 'OK', headers: {}, config };
      }
      if (String(config.url).includes('/pending')) {
        return { data: { status: 'pending' }, status: 200, statusText: 'OK', headers: {}, config };
      }
      return { data: { status: 'success', operations: [{ id: 1 }] }, status: 200, statusText: 'OK', headers: {}, config };
    });

    await client.get('https://api.multiversx.com/blocks/abc?extract=timestamp');
    await client.get('https://api.multiversx.com/blocks/abc?extract=timestamp');
    await client.get('https://api.multiversx.com/transactions/pending');
    await client.get('https://api.multiversx.com/transactions/pending');
    const firstTerminal = await client.get('https://api.multiversx.com/transactions/done');
    const secondTerminal = await client.get('https://api.multiversx.com/transactions/done');
    expect(calls.filter((url) => String(url).includes('/blocks/'))).toHaveLength(1);
    expect(calls.filter((url) => String(url).includes('/pending'))).toHaveLength(2);
    expect(calls.filter((url) => String(url).includes('/done'))).toHaveLength(1);
    expect(secondTerminal.data).toEqual(firstTerminal.data);
    expect(secondTerminal.data).not.toBe(firstTerminal.data);
    uninstallMvxApiGuard(client);
  });

  it('coalesces concurrent reads of the same block', async () => {
    let calls = 0;
    let finish;
    const client = createClient((config) => {
      calls += 1;
      return new Promise((resolve) => {
        finish = () => resolve({
          data: 42,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        });
      });
    });
    const first = client.get('https://api.multiversx.com/blocks/abc?extract=timestamp');
    const second = client.get('https://api.multiversx.com/blocks/abc?extract=timestamp');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toBe(1);
    finish();
    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ data: 42 }),
      expect.objectContaining({ data: 42 }),
    ]);
    uninstallMvxApiGuard(client);
  });

  it('fails queued callers quickly and still delivers a non-MultiversX webhook', async () => {
    let release;
    let posts = 0;
    const client = createClient((config) => {
      const url = String(config.url);
      if (url.includes('hooks.example')) {
        posts += 1;
        return Promise.resolve({
          data: { delivered: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        });
      }
      if (url.endsWith('/transactions/1')) {
        return new Promise((resolve) => {
          release = () => resolve({
            data: { status: 'pending' },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          });
        });
      }
      return Promise.reject(axiosError(config, 429, { 'retry-after': '30' }));
    }, { maxConcurrency: 1, maxQueueWaitMs: 60, maxRps: 1 });

    const leader = client.get('https://api.multiversx.com/transactions/1');
    const queued = client.get('https://api.multiversx.com/transactions/2');
    await expect(queued).rejects.toMatchObject({ code: 'MVX_QUEUE_TIMEOUT' });

    async function deliverDespiteRateLimit() {
      try {
        await client.get('https://api.multiversx.com/transactions/scr');
      } catch (_) {
        // Enrichment is optional. Delivery continues.
      }
      const response = await client.post('https://hooks.example/webhook', { transfer: { txHash: 'scr' } });
      return response.data;
    }

    await expect(deliverDespiteRateLimit()).resolves.toEqual({ delivered: true });
    expect(posts).toBe(1);
    expect(isManagedMvxUrl('https://hooks.example/webhook')).toBe(false);
    expect(cacheTtlMs('https://api.multiversx.com/transactions/scr', { status: 'pending' })).toBe(0);
    release();
    await leader;
    uninstallMvxApiGuard(client);
  });
});
