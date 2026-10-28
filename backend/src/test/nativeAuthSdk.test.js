const axios = require('axios');
const { Address } = require('@multiversx/sdk-core');
const {
  NativeAuthServer,
  NativeAuthInvalidBlockHashError,
  NativeAuthOriginNotAcceptedError,
} = require('@multiversx/sdk-native-auth-server');
const { MemoryNativeAuthCache } = require('../services/nativeAuthCache');
const { classifyNativeAuthError, BUSY_MESSAGE } = require('../services/nativeAuthErrors');
const { buildAcceptedOrigins } = require('../services/nativeAuthOrigins');

const ADDRESS = 'erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th';
const BLOCK_TIME = 1700000000;
const MAKEX_ORIGIN = 'https://makex-web3.com';

function encode(value) {
  return Buffer.from(String(value), 'utf8').toString('base64').replace(/=+$/g, '');
}

function nativeToken({ origin, blockHash, address = ADDRESS, ttl = 86400 }) {
  const parsedBody = `${encode(origin)}.${blockHash}.${ttl}.${encode('{}')}`;
  return `${encode(address)}.${encode(parsedBody)}.${'ab'.repeat(32)}`;
}

function axiosResponse(data) {
  return Promise.resolve({ data, status: 200, headers: {} });
}

function httpError(status, headers = {}) {
  return new axios.AxiosError(
    `Request failed with status code ${status}`,
    axios.AxiosError.ERR_BAD_REQUEST,
    undefined,
    undefined,
    {
      status,
      statusText: String(status),
      headers,
      data: status === 429 ? 'error code: 1015' : '',
      config: {},
    }
  );
}

function serverFor(origins, cache = new MemoryNativeAuthCache()) {
  return new NativeAuthServer({
    apiUrl: 'https://api.multiversx.com',
    acceptedOrigins: origins,
    maxExpirySeconds: 86400,
    cache,
    verifySignature: async () => true,
  });
}

describe('installed NativeAuthServer error and cache contract', () => {
  beforeEach(() => {
    jest.spyOn(axios, 'get').mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects an unrelated origin before calling MultiversX and accepts https://makex-web3.com', async () => {
    expect(new Address(ADDRESS).toBech32()).toBe(ADDRESS);
    const origins = buildAcceptedOrigins({
      NODE_ENV: 'production',
      FRONTEND_URL: MAKEX_ORIGIN,
    });
    expect(origins).toEqual([MAKEX_ORIGIN]);
    const cache = new MemoryNativeAuthCache();
    const server = serverFor(origins, cache);
    axios.get.mockImplementation((url) => {
      if (String(url).includes('/blocks?')) return axiosResponse([{ timestamp: BLOCK_TIME }]);
      return axiosResponse(BLOCK_TIME);
    });

    const evil = nativeToken({
      origin: 'https://evil.example',
      blockHash: 'aa'.repeat(32),
    });
    await expect(server.validate(evil)).rejects.toBeInstanceOf(NativeAuthOriginNotAcceptedError);
    expect(axios.get).not.toHaveBeenCalled();
    expect(classifyNativeAuthError(
      await server.validate(evil).catch((error) => error)
    ).status).toBe(403);

    const accepted = nativeToken({
      origin: MAKEX_ORIGIN,
      blockHash: 'bb'.repeat(32),
    });
    const first = await server.validate(accepted);
    expect(first.origin).toBe(MAKEX_ORIGIN);
    expect(first.address).toBe(ADDRESS);
    expect(axios.get).toHaveBeenCalledTimes(2);

    const second = await server.validate(accepted);
    expect(second.origin).toBe(MAKEX_ORIGIN);
    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(await cache.getValue(`block:timestamp:${'bb'.repeat(32)}`)).toBe(BLOCK_TIME);
    expect(await cache.getValue('block:timestamp:latest')).toBe(BLOCK_TIME);
  });

  it('rethrows a real HTTP 429 from NativeAuthServer.validate instead of an invalid block hash', async () => {
    const server = serverFor([MAKEX_ORIGIN]);
    axios.get.mockImplementation((url) => {
      if (String(url).includes('/blocks/')) {
        return Promise.reject(httpError(429, { 'retry-after': '30' }));
      }
      return axiosResponse([{ timestamp: BLOCK_TIME }]);
    });

    const token = nativeToken({ origin: MAKEX_ORIGIN, blockHash: 'cc'.repeat(32) });
    const error = await server.validate(token).catch((caught) => caught);

    expect(axios.isAxiosError(error)).toBe(true);
    expect(error.response.status).toBe(429);
    expect(error.response.headers['retry-after']).toBe('30');
    expect(error).not.toBeInstanceOf(NativeAuthInvalidBlockHashError);
    expect(axios.get).toHaveBeenCalledTimes(1);

    const classified = classifyNativeAuthError(error);
    expect(classified.status).toBe(503);
    expect(classified.retryAfter).toBe('30');
    expect(classified.body).toMatchObject({
      error: BUSY_MESSAGE,
      code: 'upstream_rate_limited',
      retryAfterSeconds: 30,
    });
    expect(JSON.stringify(classified.body)).not.toContain('1015');
  });

  it('still maps an upstream block 404 to an invalid block hash', async () => {
    const server = serverFor([MAKEX_ORIGIN]);
    axios.get.mockImplementation((url) => {
      if (String(url).includes('/blocks/')) return Promise.reject(httpError(404));
      return axiosResponse([{ timestamp: BLOCK_TIME }]);
    });
    const error = await server.validate(nativeToken({
      origin: MAKEX_ORIGIN,
      blockHash: 'dd'.repeat(32),
    })).catch((caught) => caught);

    expect(error).toBeInstanceOf(NativeAuthInvalidBlockHashError);
    expect(classifyNativeAuthError(error).status).toBe(401);
  });

  it('expires cache entries using the TTL the SDK passes to setValue', async () => {
    const cache = new MemoryNativeAuthCache();
    await cache.setValue('block:timestamp:latest', BLOCK_TIME, 0);
    expect(await cache.getValue('block:timestamp:latest')).toBeUndefined();
    await cache.setValue('block:timestamp:abc', BLOCK_TIME, 0.02);
    expect(await cache.getValue('block:timestamp:abc')).toBe(BLOCK_TIME);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(await cache.getValue('block:timestamp:abc')).toBeUndefined();
  });
});
