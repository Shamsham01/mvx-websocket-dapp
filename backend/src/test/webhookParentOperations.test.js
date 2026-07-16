const axios = require('axios');

jest.mock('axios');
jest.mock('../config/database', () => ({
  run: jest.fn().mockResolvedValue(undefined),
  query: jest.fn(),
  get: jest.fn(),
}));

const webhookService = require('../services/webhookService');

const parentOperations = [
  {
    action: 'transfer',
    type: 'nft',
    collection: 'EMP-897b49',
    identifier: 'EMP-897b49-214a',
    value: '1',
  },
];

const scrTransfer = {
  hash: 'scr-hash',
  type: 'SmartContractResult',
  function: 'auctionToken',
  originalTxHash: 'parent-hash',
  status: 'success',
  operations: [],
};

function subscription(filters) {
  return {
    id: 13,
    name: 'OOX Empyreans Listings',
    webhook_url: 'https://example.com/hook',
    user_address: 'erd1user',
    network: 'mainnet',
    filters: JSON.stringify(filters),
  };
}

describe('raw SCR parent operations webhook enrichment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    webhookService.maxRetries = 1;
    webhookService.parentOperationsCache.clear();
    axios.post.mockResolvedValue({ status: 200, data: { ok: true } });
  });

  it('restores parent operations for raw collection-filtered SCR delivery', async () => {
    axios.get.mockResolvedValue({ data: { operations: parentOperations } });

    await webhookService.deliverWebhook(
      subscription({ collectionIdentifier: 'EMP-897b49' }),
      scrTransfer
    );

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.multiversx.com/transactions/parent-hash',
      { timeout: 15000 }
    );

    const payload = axios.post.mock.calls[0][1];
    expect(payload.transfer).toEqual(
      expect.objectContaining({
        hash: 'scr-hash',
        originalTxHash: 'parent-hash',
        function: 'auctionToken',
        operations: parentOperations,
      })
    );
  });

  it('does not touch classified global-token delivery', async () => {
    const movement = {
      type: 'BUY',
      targetToken: { identifier: 'REWARD-cf6eac', atomicAmount: '100000000' },
    };

    await webhookService.deliverWebhook(
      subscription({
        tokenIdentifier: 'REWARD-cf6eac',
        movementMode: 'classified',
        movementTypes: ['BUY'],
      }),
      scrTransfer,
      { movement }
    );

    expect(axios.get).not.toHaveBeenCalled();
    const payload = axios.post.mock.calls[0][1];
    expect(payload.transfer).toBe(scrTransfer);
    expect(payload.transfer.operations).toEqual([]);
    expect(payload.movement).toBe(movement);
  });

  it('preserves operations already present on the SCR', async () => {
    const existingOperations = [
      { type: 'nft', collection: 'EMP-897b49', identifier: 'EMP-897b49-0001' },
    ];

    await webhookService.deliverWebhook(
      subscription({ collectionIdentifier: 'EMP-897b49' }),
      { ...scrTransfer, operations: existingOperations }
    );

    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.post.mock.calls[0][1].transfer.operations).toEqual(existingOperations);
  });

  it('falls back to the original SCR when parent enrichment is unavailable', async () => {
    axios.get.mockRejectedValue(new Error('API unavailable'));

    await webhookService.deliverWebhook(
      subscription({ collectionIdentifier: 'EMP-897b49' }),
      scrTransfer
    );

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][1].transfer).toBe(scrTransfer);
    expect(axios.post.mock.calls[0][1].transfer.operations).toEqual([]);
  });

  it('caches parent operations across raw subscriptions for the same transaction', async () => {
    axios.get.mockResolvedValue({ data: { operations: parentOperations } });
    const sub = subscription({ collectionIdentifier: 'EMP-897b49' });

    await webhookService.deliverWebhook(sub, scrTransfer);
    await webhookService.deliverWebhook({ ...sub, id: 14 }, scrTransfer);

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledTimes(2);
  });
});
