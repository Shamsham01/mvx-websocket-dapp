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

const axios = require('axios');
const { pollUntilConfirmed } = require('../services/confirmationPollingService');
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

describe('OOX bulk purchase collection webhooks', () => {
  const marketplace = 'erd1qqqqqqqqqqqqqpgqwp73w2a9eyzs64eltupuz3y3hv798vlv899qrjnflg';
  const buyer = 'erd1x048mkeu4h4a5g8xzr7ap0jaau0k8grvd7wqukca90mrgd8pxs8qqundyh';
  const bulkBuyHash = 'c958d985a16b043b038033d35952b859516e8c19fd3b0dc32ee8db87db2ef666';
  const subscription = sub(42, {
    sender: marketplace,
    function: 'ESDTNFTTransfer',
    onlyConfirmed: true,
    transactionType: 'SmartContractResult',
    matchTopLevelOnly: true,
    collectionIdentifier: 'EMP-897b49',
  });
  const transfers = [
    ['07050c24f6c3fbf081460b6f1515ba5ae90ea876095f2caffa0fcaf4f279fc84', 'EMP-897b49-1d3d'],
    ['49ee956b18292508b33ca7b4650297f99ea7fbe2e4274401c0f0f5a789e19032', 'EMP-897b49-1280'],
    ['1a2658414737a46cfdfa9ec21be82c9621afc2ca9069c7d9ca07e421f5bc25a6', 'EMP-897b49-1df8'],
  ].map(([txHash, identifier]) => ({
    txHash,
    originalTxHash: bulkBuyHash,
    type: 'SmartContractResult',
    sender: marketplace,
    receiver: buyer,
    function: 'ESDTNFTTransfer',
    status: 'success',
    action: { arguments: { transfers: [{ identifier }] } },
    operations: [{ type: 'nft', identifier }],
  }));

  beforeEach(() => {
    jest.clearAllMocks();
    websocketService.deliveredKeys.clear();
    database.query.mockResolvedValue([subscription]);
    const claims = new Set();
    database.tryClaimDelivered.mockImplementation(async (key) => {
      if (claims.has(key)) return false;
      claims.add(key);
      return true;
    });
  });

  it('delivers each SCR once across WebSocket updates, confirmation polls and replays', async () => {
    axios.get.mockResolvedValue({ data: { status: 'success' } });
    // One confirmation arrives by WebSocket first, another by poll first.
    await websocketService.handleTransferUpdate('mainnet', { transfers: transfers.slice(0, 1) });
    for (const transfer of transfers) {
      await pollUntilConfirmed(bulkBuyHash, { ...transfer, status: 'pending' }, [subscription], 'mainnet', websocketService);
    }
    websocketService.deliveredKeys.clear(); // Restart: only persisted claims remain.
    await websocketService.handleTransferUpdate('mainnet', { transfers });
    expect(webhookService.deliverWebhook.mock.calls.map(([, event]) => event.txHash))
      .toEqual(transfers.map((transfer) => transfer.txHash));
  });

  it('resolves thin SCRs from the same child hash or unambiguous parent operations', async () => {
    const [transfer] = transfers;
    const thin = { ...transfer, action: undefined, operations: [] };
    const emp = { ...transfer.operations[0], sender: marketplace, receiver: buyer };
    const other = { ...emp, identifier: 'OTHER-abcdef-01' };
    const data = Buffer.from('ESDTNFTTransfer@454d502d383937623439@1d3d@01').toString('base64');
    const parent = {
      operations: [emp, other],
      results: [{ hash: transfer.txHash, data }],
    };
    const plansFor = (row, parentTransaction) => websocketService.buildDeliveryPlansForTransfer(
      row, [subscription], 'mainnet', { parentTransaction }
    );
    expect((await plansFor(thin, parent)).raw).toHaveLength(1);
    expect((await plansFor({ ...thin, txHash: 'different-scr' }, parent)).raw).toHaveLength(0);
    expect((await plansFor(thin, { operations: [emp] })).raw).toHaveLength(1);
  });

  it('excludes another collection in the same purchase even when the parent contains EMP', async () => {
    const unrelated = {
      ...transfers[0],
      txHash: 'other-collection-scr',
      action: { arguments: { transfers: [{ identifier: 'OTHER-abcdef-01' }] } },
      operations: [{ type: 'nft', identifier: 'OTHER-abcdef-01' }],
    };
    axios.get.mockResolvedValue({ data: { operations: [...transfers[0].operations, ...unrelated.operations] } });
    await websocketService.handleTransferUpdate('mainnet', { transfers: [unrelated] });
    expect(webhookService.deliverWebhook).not.toHaveBeenCalled();
  });
});
