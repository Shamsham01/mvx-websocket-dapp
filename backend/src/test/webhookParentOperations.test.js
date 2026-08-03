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

const scrOperations = [
  {
    action: 'transfer',
    type: 'nft',
    collection: 'EMP-897b49',
    identifier: 'EMP-897b49-214a',
    name: 'Empyrean #123',
    value: '1',
  },
];

const scrTransfer = {
  hash: 'scr-hash',
  txHash: 'scr-hash',
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

  it('enriches thin SCR from GET /transactions/{scrHash} before delivery', async () => {
    axios.get.mockResolvedValue({
      data: {
        operations: scrOperations,
        logs: { events: [{ identifier: 'ESDTNFTTransfer' }] },
        price: 2.5,
        gasPrice: 1000000000,
      },
    });

    await webhookService.deliverWebhook(
      subscription({ collectionIdentifier: 'EMP-897b49' }),
      scrTransfer
    );

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.multiversx.com/transactions/scr-hash',
      { timeout: 15000 }
    );

    const payload = axios.post.mock.calls[0][1];
    expect(payload.transfer).toEqual(
      expect.objectContaining({
        hash: 'scr-hash',
        originalTxHash: 'parent-hash',
        type: 'SmartContractResult',
        function: 'auctionToken',
        operations: scrOperations,
        price: 2.5,
      })
    );
  });

  it('falls back to parent operations when SCR enrich returns empty ops', async () => {
    axios.get.mockImplementation((url) => {
      if (url.endsWith('/scr-hash')) {
        return Promise.resolve({ data: { operations: [] } });
      }
      if (url.endsWith('/parent-hash')) {
        return Promise.resolve({ data: { operations: parentOperations } });
      }
      return Promise.reject(new Error(`unexpected url ${url}`));
    });

    await webhookService.deliverWebhook(
      subscription({ collectionIdentifier: 'EMP-897b49' }),
      scrTransfer
    );

    expect(axios.get).toHaveBeenCalledWith(
      'https://api.multiversx.com/transactions/scr-hash',
      { timeout: 15000 }
    );
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

  it('falls back to the original SCR when enrichment is unavailable', async () => {
    axios.get.mockRejectedValue(new Error('API unavailable'));

    await webhookService.deliverWebhook(
      subscription({ collectionIdentifier: 'EMP-897b49' }),
      scrTransfer
    );

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][1].transfer.operations).toEqual([]);
  });

  it('does not cache empty parent operations', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { operations: [] } }) // SCR enrich
      .mockResolvedValueOnce({ data: { operations: [] } }) // parent (empty — not cached)
      .mockResolvedValueOnce({ data: { operations: [] } }) // SCR enrich (2nd delivery)
      .mockResolvedValueOnce({ data: { operations: parentOperations } }); // parent now ready

    const sub = subscription({ collectionIdentifier: 'EMP-897b49' });

    await webhookService.deliverWebhook(sub, scrTransfer);
    await webhookService.deliverWebhook({ ...sub, id: 14 }, scrTransfer);

    expect(axios.get).toHaveBeenCalledTimes(4);
    expect(axios.post.mock.calls[1][1].transfer.operations).toEqual(parentOperations);
  });

  it('caches non-empty parent operations across raw subscriptions', async () => {
    axios.get.mockImplementation((url) => {
      if (url.endsWith('/scr-hash')) {
        return Promise.resolve({ data: { operations: [] } });
      }
      if (url.endsWith('/parent-hash')) {
        return Promise.resolve({ data: { operations: parentOperations } });
      }
      return Promise.reject(new Error(`unexpected url ${url}`));
    });
    const sub = subscription({ collectionIdentifier: 'EMP-897b49' });

    await webhookService.deliverWebhook(sub, scrTransfer);
    await webhookService.deliverWebhook({ ...sub, id: 14 }, scrTransfer);

    // SCR enrich twice + parent once (cached on second delivery)
    expect(axios.get).toHaveBeenCalledTimes(3);
    expect(axios.post).toHaveBeenCalledTimes(2);
  });
});
