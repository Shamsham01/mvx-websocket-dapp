jest.mock('axios', () => ({
  get: jest.fn(),
}));
jest.mock('../config/database', () => ({
  query: jest.fn(),
  get: jest.fn(),
  run: jest.fn(),
}));
jest.mock('../services/webhookService', () => ({
  deliverWebhook: jest.fn(),
}));
jest.mock('../services/confirmationPollingService', () => ({
  scheduleConfirmationCheck: jest.fn(),
}));

const axios = require('axios');

// Require after mocks
const websocketService = require('../services/websocketService');

describe('enrichTransferForDelivery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('merges SCR REST details including operations and preserves WS type/status', async () => {
    axios.get.mockResolvedValue({
      data: {
        hash: 'scr-hash',
        type: 'unsigned',
        status: 'success',
        operations: [{ type: 'nft', collection: 'PITTZ-1a4c2d', name: 'CryptoPittz #1' }],
        logs: { events: [] },
        price: 2.63,
      },
    });

    const thin = {
      txHash: 'scr-hash',
      type: 'SmartContractResult',
      status: 'success',
      operations: [],
      originalTxHash: 'parent-hash',
    };

    const enriched = await websocketService.enrichTransferForDelivery(thin, 'mainnet', {
      retries: 0,
    });

    expect(axios.get).toHaveBeenCalledWith(
      'https://api.multiversx.com/transactions/scr-hash',
      { timeout: 15000 }
    );
    expect(enriched.type).toBe('SmartContractResult');
    expect(enriched.status).toBe('success');
    expect(enriched.operations[0].name).toBe('CryptoPittz #1');
    expect(enriched.price).toBe(2.63);
  });

  it('skips REST when operations are already present', async () => {
    const full = {
      txHash: 'scr-hash',
      operations: [{ type: 'nft' }],
    };

    const result = await websocketService.enrichTransferForDelivery(full, 'mainnet');
    expect(axios.get).not.toHaveBeenCalled();
    expect(result).toBe(full);
  });

  it('retries when first response still has empty operations', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { operations: [] } })
      .mockResolvedValueOnce({
        data: {
          operations: [{ type: 'nft', identifier: 'PITTZ-1a4c2d-1' }],
        },
      });

    const thin = {
      txHash: 'scr-hash',
      type: 'SmartContractResult',
      status: 'success',
      operations: [],
    };

    const enriched = await websocketService.enrichTransferForDelivery(thin, 'mainnet', {
      retries: 1,
      delayMs: 1,
    });

    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(enriched.operations).toHaveLength(1);
  });
});
