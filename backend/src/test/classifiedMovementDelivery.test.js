const axios = require('axios');

jest.mock('axios');
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

const database = require('../config/database');
const webhookService = require('../services/webhookService');
const confirmationPollingService = require('../services/confirmationPollingService');
const websocketService = require('../services/websocketService');

const trader = 'erd1traderxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const rootTxHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const scrHash = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

const rootTx = {
  hash: rootTxHash,
  sender: trader,
  function: 'swapTokensFixedInput',
  fee: '290350580000',
  status: 'success',
  operations: [
    { type: 'egld', sender: trader, receiver: 'erd1router', value: '999709649420000000' },
    {
      type: 'esdt',
      sender: 'erd1router',
      receiver: trader,
      identifier: 'REWARD-cf6eac',
      value: '5615662092047',
      decimals: 8,
    },
  ],
};

const triggerScr = {
  txHash: scrHash,
  originalTxHash: rootTxHash,
  status: 'success',
  sender: 'erd1router',
  receiver: trader,
  function: 'ESDTTransfer',
  operations: [
    {
      type: 'esdt',
      sender: 'erd1router',
      receiver: trader,
      identifier: 'REWARD-cf6eac',
      value: '13856',
    },
  ],
};

function sub(id, filters) {
  return {
    id,
    name: `sub-${id}`,
    filters: JSON.stringify(filters),
    webhook_url: 'https://example.com/hook',
  };
}

describe('classified movement delivery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockReset();
    websocketService.deliveredKeys.clear();
    websocketService.rootTransactionCache.clear();
  });

  test('partitions classified plans without raw delivery for classified subs', async () => {
    axios.get.mockResolvedValue({ data: rootTx });
    const classifiedSub = sub(1, {
      tokenIdentifier: 'REWARD-cf6eac',
      movementMode: 'classified',
      movementTypes: ['BUY', 'SELL'],
      onlyConfirmed: true,
      tokenDecimals: 8,
    });
    const rawSub = sub(2, {
      tokenIdentifier: 'REWARD-cf6eac',
      onlyConfirmed: true,
      tokenDecimals: 8,
    });

    const plans = await websocketService.buildDeliveryPlansForTransfer(
      triggerScr,
      [classifiedSub, rawSub],
      'mainnet'
    );

    expect(plans.raw).toHaveLength(1);
    expect(plans.raw[0].subscription.id).toBe(2);
    expect(plans.classified).toHaveLength(1);
    expect(plans.classified[0].movement.type).toBe('BUY');
    expect(plans.classified[0].dedupeKey).toBe(
      `movement|1|${rootTxHash}|REWARD-cf6eac`
    );
  });

  test('skips pending classified delivery until confirmation', async () => {
    const classifiedSub = sub(1, {
      tokenIdentifier: 'REWARD-cf6eac',
      movementMode: 'classified',
      movementTypes: ['BUY'],
      onlyConfirmed: true,
      tokenDecimals: 8,
    });
    const plans = await websocketService.buildDeliveryPlansForTransfer(
      { ...triggerScr, status: 'pending' },
      [classifiedSub],
      'mainnet',
      { rootTransaction: rootTx }
    );
    expect(plans.classified).toHaveLength(0);
  });

  test('filters classified amount ranges on absolute net target movement', async () => {
    const classifiedSub = sub(1, {
      tokenIdentifier: 'REWARD-cf6eac',
      movementMode: 'classified',
      movementTypes: ['BUY'],
      movementAmountMin: '100000',
      onlyConfirmed: true,
      tokenDecimals: 8,
    });
    const plans = await websocketService.buildDeliveryPlansForTransfer(
      triggerScr,
      [classifiedSub],
      'mainnet',
      { rootTransaction: rootTx }
    );
    expect(plans.classified).toHaveLength(0);
  });

  test('confirmation poll delivers classified movement once', async () => {
    axios.get.mockResolvedValue({ data: { ...rootTx, status: 'success' } });
    database.tryClaimDelivered.mockResolvedValue(true);
    const classifiedSub = sub(1, {
      tokenIdentifier: 'REWARD-cf6eac',
      movementMode: 'classified',
      movementTypes: ['BUY'],
      onlyConfirmed: true,
      tokenDecimals: 8,
    });

    await confirmationPollingService.pollUntilConfirmed(
      rootTxHash,
      { ...triggerScr, status: 'pending' },
      [classifiedSub],
      'mainnet',
      websocketService
    );

    expect(webhookService.deliverWebhook).toHaveBeenCalledTimes(1);
    const [, , options] = webhookService.deliverWebhook.mock.calls[0];
    expect(options.movement.type).toBe('BUY');
    expect(options.movement.targetToken.amount).toBe('56156.62092047');
  });
});
