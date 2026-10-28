jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

jest.mock('../config/database', () => ({
  tryClaimDelivered: jest.fn().mockResolvedValue(true),
  releaseDeliveredClaim: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/webhookService', () => ({
  deliverWebhook: jest.fn().mockResolvedValue({ success: true }),
}));

const axios = require('axios');
const webhookService = require('../services/webhookService');

const previousInterval = process.env.CONFIRMATION_POLL_INTERVAL_MS;
const previousRetries = process.env.CONFIRMATION_POLL_RETRIES;
process.env.CONFIRMATION_POLL_INTERVAL_MS = '5';
process.env.CONFIRMATION_POLL_RETRIES = '4';
const { pollUntilConfirmed } = require('../services/confirmationPollingService');
if (previousInterval == null) delete process.env.CONFIRMATION_POLL_INTERVAL_MS;
else process.env.CONFIRMATION_POLL_INTERVAL_MS = previousInterval;
if (previousRetries == null) delete process.env.CONFIRMATION_POLL_RETRIES;
else process.env.CONFIRMATION_POLL_RETRIES = previousRetries;

describe('confirmation polling under API queue pressure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retries queue timeouts and still delivers the webhook once', async () => {
    const timeout = new Error('MultiversX API queue timeout');
    timeout.code = 'MVX_QUEUE_TIMEOUT';
    axios.get
      .mockRejectedValueOnce(timeout)
      .mockRejectedValueOnce(timeout)
      .mockResolvedValue({
        data: { status: 'success', gasUsed: 10, timestamp: 1700000000 },
      });

    const transfer = {
      txHash: 'scr-hash',
      hash: 'scr-hash',
      originalTxHash: 'parent-hash',
      status: 'pending',
    };
    const subscription = { id: 1, name: 'listings', network: 'mainnet' };
    const wsService = {
      enrichTransferForDelivery: jest.fn(async (value) => value),
      buildDeliveryPlansForTransfer: jest.fn(async () => ({
        raw: [{ subscription, transfer: { ...transfer, status: 'success' }, dedupeKey: 'raw-1' }],
        classified: [],
      })),
      hasDelivered: jest.fn(() => false),
      recordDelivered: jest.fn(),
    };

    await pollUntilConfirmed('parent-hash', transfer, [subscription], 'mainnet', wsService);

    expect(axios.get).toHaveBeenCalledTimes(3);
    expect(webhookService.deliverWebhook).toHaveBeenCalledTimes(1);
    expect(wsService.recordDelivered).toHaveBeenCalledWith('raw-1');
  });
});
