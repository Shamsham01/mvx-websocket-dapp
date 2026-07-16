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
const websocketService = require('../services/websocketService');

const xoxnoMarketplace = 'erd1qqqqqqqqqqqqqpgq6wegs2xkypfpync8mn2sa5cmpqjlvrhwz5nqgepyg8';
const lister = 'erd1h9hm0gnkgn888ly9zgnswsjajprk2fkszndwhm28xkcay66xnnesdyzcs6';
const rootTxHash = 'b383bf5a59adadd14c1b335ecebe6be53c0daec8ba24172fc06ddeb403448a6d';
const transferScrHash = 'b0723c15a85f888d84c3f66a2fcb73c288dbbee75218048f727407190e135e69';
const selfCallScrHash = '93c30caaec43fc3ce56274a966fe59497632d5a5d5ec1358e48b0ce6e22dc0e4';

const listingParent = {
  txHash: rootTxHash,
  sender: lister,
  receiver: lister,
  function: 'listing',
  type: 'normal',
  status: 'success',
  operations: [
    {
      action: 'transfer',
      type: 'nft',
      esdtType: 'NonFungibleESDT',
      collection: 'PITTZ-1a4c2d',
      identifier: 'PITTZ-1a4c2d-0dc6',
      sender: lister,
      receiver: xoxnoMarketplace,
      value: '1',
    },
  ],
};

const transferScr = {
  txHash: transferScrHash,
  hash: transferScrHash,
  type: 'SmartContractResult',
  function: 'listing',
  sender: lister,
  receiver: xoxnoMarketplace,
  originalTxHash: rootTxHash,
  status: 'success',
  action: { category: 'scCall', name: 'MultiESDTNFTTransfer' },
};

const selfCallScr = {
  txHash: selfCallScrHash,
  hash: selfCallScrHash,
  type: 'SmartContractResult',
  function: 'listing',
  sender: xoxnoMarketplace,
  receiver: xoxnoMarketplace,
  originalTxHash: rootTxHash,
  status: 'success',
  action: { category: 'scCall', name: 'listing' },
};

const listingFilters = {
  address: xoxnoMarketplace,
  function: 'listing',
  onlyConfirmed: true,
  transactionType: 'SmartContractResult',
  matchTopLevelOnly: true,
  collectionIdentifier: 'PITTZ-1a4c2d',
};

function sub(id, filters) {
  return {
    id,
    name: `sub-${id}`,
    filters: JSON.stringify(filters),
    webhook_url: 'https://example.com/hook',
    network: 'mainnet',
  };
}

describe('XOXNO collection listing SCR dedupe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database.tryClaimDelivered.mockResolvedValue(true);
    webhookService.deliverWebhook.mockResolvedValue({ success: true });
    websocketService.deliveredKeys.clear();
    websocketService.rootTransactionCache.clear();
  });

  test('plans only the user→marketplace transfer SCR, not the marketplace self-call', async () => {
    const listingSub = sub(31, listingFilters);

    const transferPlans = await websocketService.buildDeliveryPlansForTransfer(
      transferScr,
      [listingSub],
      'mainnet',
      { parentTransaction: listingParent }
    );
    const selfCallPlans = await websocketService.buildDeliveryPlansForTransfer(
      selfCallScr,
      [listingSub],
      'mainnet',
      { parentTransaction: listingParent }
    );

    expect(transferPlans.raw).toHaveLength(1);
    expect(transferPlans.raw[0].transfer.txHash).toBe(transferScrHash);
    expect(transferPlans.raw[0].dedupeKey).toBe(
      `raw|31|${rootTxHash}|collection|pittz-1a4c2d`
    );
    expect(selfCallPlans.raw).toHaveLength(0);
    expect(selfCallPlans.matchedSubs).toHaveLength(0);
  });

  test('second SCR with same root+collection does not deliver again after first claim', async () => {
    const listingSub = sub(31, listingFilters);
    const rootKey = `raw|31|${rootTxHash}|collection|pittz-1a4c2d`;

    // Another SCR in the same listing family (different hash) still shares the root key.
    const siblingScr = {
      ...transferScr,
      txHash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      hash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      sender: 'erd1anotherlisterxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    };

    database.tryClaimDelivered.mockImplementation(async (key) => {
      if (websocketService.hasDelivered(key)) return false;
      return true;
    });

    const firstPlans = await websocketService.buildDeliveryPlansForTransfer(
      transferScr,
      [listingSub],
      'mainnet',
      { parentTransaction: listingParent }
    );
    expect(firstPlans.raw[0].dedupeKey).toBe(rootKey);

    for (const plan of firstPlans.raw) {
      if (websocketService.hasDelivered(plan.dedupeKey) || !(await database.tryClaimDelivered(plan.dedupeKey))) continue;
      await webhookService.deliverWebhook(plan.subscription, plan.transfer);
      websocketService.recordDelivered(plan.dedupeKey);
    }

    expect(webhookService.deliverWebhook).toHaveBeenCalledTimes(1);

    const secondPlans = await websocketService.buildDeliveryPlansForTransfer(
      siblingScr,
      [listingSub],
      'mainnet',
      { parentTransaction: listingParent }
    );
    expect(secondPlans.raw[0].dedupeKey).toBe(rootKey);

    for (const plan of secondPlans.raw) {
      if (websocketService.hasDelivered(plan.dedupeKey) || !(await database.tryClaimDelivered(plan.dedupeKey))) continue;
      await webhookService.deliverWebhook(plan.subscription, plan.transfer);
      websocketService.recordDelivered(plan.dedupeKey);
    }

    expect(webhookService.deliverWebhook).toHaveBeenCalledTimes(1);
  });

  test('separate subscriptions still each receive one webhook for the same root listing', async () => {
    const subA = sub(31, listingFilters);
    const subB = sub(32, listingFilters);

    const plans = await websocketService.buildDeliveryPlansForTransfer(
      transferScr,
      [subA, subB],
      'mainnet',
      { parentTransaction: listingParent }
    );

    expect(plans.raw).toHaveLength(2);
    expect(plans.raw.map((p) => p.dedupeKey).sort()).toEqual([
      `raw|31|${rootTxHash}|collection|pittz-1a4c2d`,
      `raw|32|${rootTxHash}|collection|pittz-1a4c2d`,
    ]);
  });
});
