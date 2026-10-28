const { io } = require('socket.io-client');

jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}));
jest.mock('../config/database', () => ({
  query: jest.fn(),
  tryClaimDelivered: jest.fn().mockResolvedValue(true),
  releaseDeliveredClaim: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/webhookService', () => ({
  deliverWebhook: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('../services/tokenMetadata', () => ({
  hydrateSubscriptionFilters: jest.fn(async (subs) => subs),
}));
jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({ data: { url: 'ws.example.com' } }),
}));

const logger = require('../utils/logger');
const websocketService = require('../services/websocketService');

function createFakeSocket() {
  const listeners = {};
  const rawEmit = jest.fn((event, _payload, ack) => {
    if (event === 'subscribeCustomTransfers' && socket.autoAck && typeof ack === 'function') {
      ack({ status: 'success' });
    }
  });
  const socket = {
    connected: false,
    autoAck: true,
    rawEmit,
    on: jest.fn((event, cb) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
      return socket;
    }),
    disconnect: jest.fn(),
    connect() {
      socket.connected = true;
      (listeners.connect || []).forEach((cb) => cb());
    },
    drop(reason = 'transport close') {
      socket.connected = false;
      (listeners.disconnect || []).forEach((cb) => cb(reason));
    },
    fail(errorData) {
      (listeners.error || []).forEach((cb) => cb(errorData));
    },
  };
  socket.emit = rawEmit;
  return socket;
}

function subscribeCalls(socket) {
  return socket.rawEmit.mock.calls.filter(([event]) => event === 'subscribeCustomTransfers');
}

function unsubscribeCalls(socket) {
  return socket.rawEmit.mock.calls.filter(([event]) => event === 'unsubscribeCustomTransfers');
}

describe('WebSocket subscription lifecycle', () => {
  const sockets = [];

  beforeEach(async () => {
    sockets.length = 0;
    jest.clearAllMocks();
    io.mockImplementation(() => {
      const socket = createFakeSocket();
      sockets.push(socket);
      return socket;
    });
    await websocketService.cleanup();
  });

  afterEach(async () => {
    await websocketService.cleanup();
  });

  it('emits 10 pre-connection subscriptions exactly once after connect', async () => {
    for (let i = 1; i <= 10; i += 1) {
      await websocketService.createSubscription(i, { address: `erd1filter${i}` }, 'mainnet');
    }

    expect(sockets).toHaveLength(1);
    expect(sockets[0].rawEmit).not.toHaveBeenCalled();

    sockets[0].connect();

    const calls = subscribeCalls(sockets[0]);
    expect(calls).toHaveLength(10);
    const payloads = calls.map((call) => call[1].address);
    expect(new Set(payloads).size).toBe(10);
    calls.forEach((call) => expect(typeof call[2]).toBe('function'));
  });

  it('does not emit duplicates on the initial connection', async () => {
    await websocketService.createSubscription(1, { address: 'erd1once' }, 'mainnet');
    // A disconnected emit must not enter Socket.IO's sendBuffer. The connect
    // handler is the only registration for this session.
    expect(sockets[0].rawEmit).not.toHaveBeenCalled();

    sockets[0].connect();

    expect(subscribeCalls(sockets[0])).toHaveLength(1);
    expect(subscribeCalls(sockets[0])[0][1]).toEqual({ address: 'erd1once' });

    await websocketService.createSubscription(2, { address: 'erd1once' }, 'mainnet');
    expect(subscribeCalls(sockets[0])).toHaveLength(1);
  });

  it('restores desired subscriptions exactly once on reconnect', async () => {
    for (let i = 1; i <= 10; i += 1) {
      await websocketService.createSubscription(i, { address: `erd1re${i}` }, 'mainnet');
    }
    sockets[0].connect();
    expect(subscribeCalls(sockets[0])).toHaveLength(10);

    sockets[0].rawEmit.mockClear();
    sockets[0].drop();
    sockets[0].connect();

    expect(subscribeCalls(sockets[0])).toHaveLength(10);
    expect(unsubscribeCalls(sockets[0])).toHaveLength(0);
  });

  it('registers a subscription created on an already connected socket once', async () => {
    await websocketService.createSubscription(1, { address: 'erd1first' }, 'mainnet');
    sockets[0].connect();
    sockets[0].rawEmit.mockClear();

    await websocketService.createSubscription(2, { address: 'erd1second' }, 'mainnet');

    const calls = subscribeCalls(sockets[0]);
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual({ address: 'erd1second' });
  });

  it('restores a subscription added while disconnected', async () => {
    await websocketService.createSubscription(1, { address: 'erd1already' }, 'mainnet');
    sockets[0].connect();
    sockets[0].drop();
    sockets[0].rawEmit.mockClear();

    await websocketService.createSubscription(2, { address: 'erd1added' }, 'mainnet');
    expect(sockets[0].rawEmit).not.toHaveBeenCalled();

    sockets[0].connect();
    const addresses = subscribeCalls(sockets[0]).map((call) => call[1].address).sort();
    expect(addresses).toEqual(['erd1added', 'erd1already']);
  });

  it('does not restore a subscription removed while disconnected', async () => {
    await websocketService.createSubscription(1, { address: 'erd1gone' }, 'mainnet');
    await websocketService.createSubscription(2, { address: 'erd1stay' }, 'mainnet');
    sockets[0].connect();
    sockets[0].drop();
    sockets[0].rawEmit.mockClear();

    await websocketService.removeSubscription(1);
    expect(sockets[0].rawEmit).not.toHaveBeenCalled();

    sockets[0].connect();
    const calls = subscribeCalls(sockets[0]);
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual({ address: 'erd1stay' });
  });

  it('shares one upstream registration for identical filters on the same network', async () => {
    await websocketService.createSubscription(1, { address: 'erd1shared' }, 'mainnet');
    await websocketService.createSubscription(2, { address: 'erd1shared' }, 'mainnet');
    sockets[0].connect();

    expect(sockets).toHaveLength(1);
    expect(subscribeCalls(sockets[0])).toHaveLength(1);
  });

  it('keeps identical filters on different networks independent', async () => {
    await websocketService.createSubscription(1, { address: 'erd1shared' }, 'mainnet');
    await websocketService.createSubscription(2, { address: 'erd1shared' }, 'testnet');
    expect(sockets).toHaveLength(2);

    sockets[0].connect();
    sockets[1].connect();
    expect(subscribeCalls(sockets[0])).toHaveLength(1);
    expect(subscribeCalls(sockets[1])).toHaveLength(1);

    sockets[0].rawEmit.mockClear();
    sockets[1].rawEmit.mockClear();
    await websocketService.removeSubscription(1);

    expect(unsubscribeCalls(sockets[0])).toHaveLength(1);
    expect(sockets[1].rawEmit).not.toHaveBeenCalled();
    expect(websocketService.subscriptions.has(2)).toBe(true);

    sockets[1].drop();
    sockets[1].connect();
    expect(subscribeCalls(sockets[1])).toHaveLength(1);
    expect(subscribeCalls(sockets[1])[0][1]).toEqual({ address: 'erd1shared' });
  });

  it('splits 11 distinct filters across two shards as 10 plus 1', async () => {
    for (let i = 1; i <= 11; i += 1) {
      await websocketService.createSubscription(i, { address: `erd1shard${i}` }, 'mainnet');
    }

    expect(sockets).toHaveLength(2);
    expect(sockets[0].rawEmit).not.toHaveBeenCalled();
    expect(sockets[1].rawEmit).not.toHaveBeenCalled();

    sockets[0].connect();
    sockets[1].connect();

    expect(subscribeCalls(sockets[0])).toHaveLength(10);
    expect(subscribeCalls(sockets[1])).toHaveLength(1);
    expect(websocketService.shardBuckets.get('mainnet')).toHaveLength(2);
  });

  it('logs a subscription limit error once and marks the registration rejected', async () => {
    const secret = 'erd1secretaddressshouldnotbelogged';
    await websocketService.createSubscription(1, { address: secret }, 'mainnet');
    sockets[0].connect();

    const shard = websocketService.subscriptions.get(1).shard;
    const key = [...shard.registrations.keys()][0];
    expect(shard.registrations.get(key).state).toBe('confirmed');

    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    const limitError = {
      pattern: 'subscribeCustomTransfers',
      data: { address: secret },
      error: 'Max client subscriptions (10) reached!',
    };
    sockets[0].fail(limitError);
    sockets[0].fail(limitError);

    expect(shard.registrations.get(key).state).toBe('rejected');
    const messages = errorSpy.mock.calls.map((call) => String(call[0]));
    const limitLogs = messages.filter((message) => message.includes('Max client subscriptions (10) reached!'));
    expect(limitLogs).toHaveLength(1);
    expect(limitLogs[0]).toContain('shard 0');
    expect(limitLogs[0]).toContain('pattern=subscribeCustomTransfers');
    expect(limitLogs[0]).toContain('payloadId=');
    expect(limitLogs[0]).not.toContain(secret);
    expect(subscribeCalls(sockets[0])).toHaveLength(1);
    errorSpy.mockRestore();
  });
});
