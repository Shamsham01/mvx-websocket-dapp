jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));
jest.mock('../config/database', () => ({
  tryClaimDelivered: jest.fn().mockResolvedValue(true),
  releaseDeliveredClaim: jest.fn().mockResolvedValue(undefined),
  run: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/webhookService', () => ({
  deliverWebhook: jest.fn().mockResolvedValue({ success: true }),
}));

const axios = require('axios');
const database = require('../config/database');
const webhookService = require('../services/webhookService');
const { pollUntilConfirmed } = require('../services/confirmationPollingService');

const thinScr = {
  txHash: 'scr-hash',
  hash: 'scr-hash',
  type: 'SmartContractResult',
  function: 'ESDTNFTTransfer',
  originalTxHash: 'parent-hash',
  status: 'pending',
  operations: [],
};

const enrichedScrApi = {
  txHash: 'scr-hash',
  hash: 'scr-hash',
  type: 'unsigned',
  function: 'ESDTNFTTransfer',
  originalTxHash: 'parent-hash',
  status: 'success',
  operations: [
    {
      action: 'transfer',
      type: 'nft',
      collection: 'PITTZ-1a4c2d',
      identifier: 'PITTZ-1a4c2d-114c',
      name: 'CryptoPittz #1',
      value: '1',
    },
  ],
  logs: { events: [{ identifier: 'ESDTNFTTransfer' }] },
  price: 2.63,
  gasPrice: 1000000000,
};

const subscription = {
  id: 23,
  name: 'OOX PITTZ Sales',
  filters: JSON.stringify({ collectionIdentifier: 'PITTZ-1a4c2d', onlyConfirmed: true }),
  network: 'mainnet',
};

describe('confirmation poll SCR enrichment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('re-fetches the SCR before webhook delivery so operations are present', async () => {
    axios.get.mockResolvedValue({
      data: { status: 'success', gasUsed: 5000000, timestamp: 1785689910 },
    });

    const enrichTransferForDelivery = jest.fn().mockResolvedValue({
      ...thinScr,
      ...enrichedScrApi,
      type: 'SmartContractResult',
      status: 'success',
    });

    const buildDeliveryPlansForTransfer = jest.fn().mockResolvedValue({
      raw: [
        {
          subscription,
          transfer: {
            ...thinScr,
            ...enrichedScrApi,
            type: 'SmartContractResult',
            status: 'success',
          },
          dedupeKey: 'raw|23|parent-hash|collection|PITTZ-1a4c2d',
        },
      ],
      classified: [],
    });

    const wsService = {
      enrichTransferForDelivery,
      buildDeliveryPlansForTransfer,
      hasDelivered: jest.fn().mockReturnValue(false),
      recordDelivered: jest.fn(),
    };

    await pollUntilConfirmed('parent-hash', thinScr, [subscription], 'mainnet', wsService);

    expect(enrichTransferForDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        txHash: 'scr-hash',
        status: 'success',
        operations: [],
      }),
      'mainnet'
    );

    const deliveredTransfer = buildDeliveryPlansForTransfer.mock.calls[0][0];
    expect(deliveredTransfer.operations).toHaveLength(1);
    expect(deliveredTransfer.operations[0].name).toBe('CryptoPittz #1');
    expect(deliveredTransfer.type).toBe('SmartContractResult');

    expect(webhookService.deliverWebhook).toHaveBeenCalledTimes(1);
    expect(database.tryClaimDelivered).toHaveBeenCalled();
  });

  it('still delivers when enrich leaves operations empty', async () => {
    axios.get.mockResolvedValue({ data: { status: 'success' } });

    const enrichTransferForDelivery = jest.fn().mockResolvedValue({
      ...thinScr,
      status: 'success',
    });

    const wsService = {
      enrichTransferForDelivery,
      buildDeliveryPlansForTransfer: jest.fn().mockResolvedValue({
        raw: [
          {
            subscription,
            transfer: { ...thinScr, status: 'success' },
            dedupeKey: 'raw|23|parent-hash|collection|PITTZ-1a4c2d',
          },
        ],
        classified: [],
      }),
      hasDelivered: jest.fn().mockReturnValue(false),
      recordDelivered: jest.fn(),
    };

    await pollUntilConfirmed('parent-hash', thinScr, [subscription], 'mainnet', wsService);

    expect(enrichTransferForDelivery).toHaveBeenCalled();
    expect(webhookService.deliverWebhook).toHaveBeenCalledTimes(1);
  });
});
