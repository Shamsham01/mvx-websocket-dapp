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

const websocketService = require('../services/websocketService');

describe('token-only subscribeCustomTransfers payload', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await websocketService.cleanup();
  });

  afterEach(async () => {
    await websocketService.cleanup();
  });

  it('maps tokenIdentifier-only filters to MultiversX token payload', async () => {
    const emit = jest.fn();
    const on = jest.fn();
    const disconnect = jest.fn();
    io.mockReturnValue({ emit, on, disconnect });

    await websocketService.createSubscription(42, { tokenIdentifier: 'REWARD-cf6eac' }, 'mainnet');

    expect(emit).toHaveBeenCalledWith('subscribeCustomTransfers', {
      token: 'REWARD-cf6eac',
    });

    const stored = websocketService.subscriptions.get(42);
    expect(stored.payload).toEqual({ token: 'REWARD-cf6eac' });
  });

  it('maps egldOnly to EGLD token payload', async () => {
    const emit = jest.fn();
    const on = jest.fn();
    const disconnect = jest.fn();
    io.mockReturnValue({ emit, on, disconnect });

    await websocketService.createSubscription(43, { egldOnly: true }, 'mainnet');

    expect(emit).toHaveBeenCalledWith('subscribeCustomTransfers', {
      token: 'EGLD',
    });
  });

  it('shares one MultiversX payload across duplicate tokenIdentifier subscriptions', async () => {
    const emit = jest.fn();
    const on = jest.fn();
    const disconnect = jest.fn();
    io.mockReturnValue({ emit, on, disconnect });

    await websocketService.createSubscription(50, { tokenIdentifier: 'REWARD-cf6eac' }, 'mainnet');
    await websocketService.createSubscription(51, { tokenIdentifier: 'REWARD-cf6eac' }, 'mainnet');

    const subscribeCalls = emit.mock.calls.filter(([event]) => event === 'subscribeCustomTransfers');
    expect(subscribeCalls).toHaveLength(1);
    expect(subscribeCalls[0][1]).toEqual({ token: 'REWARD-cf6eac' });
  });
});
