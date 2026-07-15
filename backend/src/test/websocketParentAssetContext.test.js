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

const ooxMarketplace = 'erd1qqqqqqqqqqqqqpgqwp73w2a9eyzs64eltupuz3y3hv798vlv899qrjnflg';
const originalTxHash = 'f69e536e067dba31e0884abb38adbd58e90e2cbdaab287a8414bbb49560dc3c7';

const ooxListingParent = {
  txHash: originalTxHash,
  type: 'normal',
  function: 'auctionToken',
  sender: 'erd15m2c8xcemvhhlfmztzlc7usaqnmz2l2rwdmpcjc96uh0nc96svtqwnzfmu',
  receiver: 'erd15m2c8xcemvhhlfmztzlc7usaqnmz2l2rwdmpcjc96uh0nc96svtqwnzfmu',
  status: 'success',
  action: {
    arguments: {
      transfers: [
        {
          type: 'NonFungibleESDT',
          collection: 'EMP-897b49',
          identifier: 'EMP-897b49-214a',
          value: '1',
        },
      ],
      receiver: ooxMarketplace,
      functionName: 'auctionToken',
    },
  },
  operations: [
    {
      action: 'transfer',
      type: 'nft',
      collection: 'EMP-897b49',
      identifier: 'EMP-897b49-214a',
      sender: 'erd15m2c8xcemvhhlfmztzlc7usaqnmz2l2rwdmpcjc96uh0nc96svtqwnzfmu',
      receiver: ooxMarketplace,
      value: '1',
    },
  ],
};

const ooxAuctionScr = {
  hash: '4d7b37910eb2bc011d8a34a1fcc797141bf4430668b1857a33a97d53d0412eae',
  type: 'unsigned',
  function: 'auctionToken',
  sender: 'erd15m2c8xcemvhhlfmztzlc7usaqnmz2l2rwdmpcjc96uh0nc96svtqwnzfmu',
  receiver: ooxMarketplace,
  originalTxHash,
  status: 'success',
};

function sub(id, filters, name = `sub-${id}`) {
  return {
    id,
    name,
    filters: JSON.stringify(filters),
    webhook_url: 'https://example.com/hook',
  };
}

describe('parent asset context matching (WebSocket path)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockReset();
    database.tryClaimDelivered.mockResolvedValue(true);
  });

  it('fetches parent once for multiple subscriptions needing the same originalTxHash', async () => {
    axios.get.mockResolvedValue({ data: ooxListingParent });

    const subscriptions = [
      sub(1, {
        address: ooxMarketplace,
        function: 'auctionToken',
        transactionType: 'SmartContractResult',
        matchTopLevelOnly: true,
        collectionIdentifier: 'EMP-897b49',
      }),
      sub(2, {
        address: ooxMarketplace,
        function: 'auctionToken',
        transactionType: 'SmartContractResult',
        matchTopLevelOnly: true,
        collectionIdentifier: 'EMP-897b49',
      }),
      sub(3, {
        address: ooxMarketplace,
        function: 'auctionToken',
        transactionType: 'SmartContractResult',
        matchTopLevelOnly: true,
        tokenIdentifier: 'EMP-897b49-214a',
      }),
    ];

    const { matchedSubs, subscriptionsToDeliver } =
      await websocketService.matchSubscriptionsForTransfer(
        ooxAuctionScr,
        subscriptions,
        'mainnet'
      );

    expect(matchedSubs).toHaveLength(3);
    expect(subscriptionsToDeliver).toHaveLength(3);
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining(`/transactions/${originalTxHash}`),
      expect.any(Object)
    );
  });

  it('does not deliver when parent fetch fails', async () => {
    axios.get.mockRejectedValue(new Error('network down'));

    const subscriptions = [
      sub(1, {
        address: ooxMarketplace,
        function: 'auctionToken',
        transactionType: 'SmartContractResult',
        matchTopLevelOnly: true,
        collectionIdentifier: 'EMP-897b49',
      }),
    ];

    const { matchedSubs, subscriptionsToDeliver } =
      await websocketService.matchSubscriptionsForTransfer(
        ooxAuctionScr,
        subscriptions,
        'mainnet'
      );

    expect(matchedSubs).toHaveLength(0);
    expect(subscriptionsToDeliver).toHaveLength(0);
  });

  it('does not fetch parent when no candidate requires asset context', async () => {
    const subscriptions = [
      sub(1, {
        address: ooxMarketplace,
        function: 'auctionToken',
        transactionType: 'SmartContractResult',
        matchTopLevelOnly: true,
      }),
    ];

    const { matchedSubs } = await websocketService.matchSubscriptionsForTransfer(
      ooxAuctionScr,
      subscriptions,
      'mainnet'
    );

    expect(matchedSubs).toHaveLength(1);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('webhook delivery target remains the SCR, not the parent', async () => {
    axios.get.mockResolvedValue({ data: ooxListingParent });

    const subscriptions = [
      sub(1, {
        address: ooxMarketplace,
        function: 'auctionToken',
        transactionType: 'SmartContractResult',
        matchTopLevelOnly: true,
        collectionIdentifier: 'EMP-897b49',
      }),
    ];

    const { subscriptionsToDeliver } = await websocketService.matchSubscriptionsForTransfer(
      ooxAuctionScr,
      subscriptions,
      'mainnet'
    );

    expect(subscriptionsToDeliver).toHaveLength(1);

    await webhookService.deliverWebhook(subscriptionsToDeliver[0], ooxAuctionScr);

    expect(webhookService.deliverWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({
        hash: ooxAuctionScr.hash,
        originalTxHash,
        function: 'auctionToken',
        receiver: ooxMarketplace,
      })
    );
    const delivered = webhookService.deliverWebhook.mock.calls[0][1];
    expect(delivered.hash).toBe(ooxAuctionScr.hash);
    expect(delivered.txHash).toBeUndefined();
  });
});

describe('confirmation polling parent-context rematch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockReset();
    database.tryClaimDelivered.mockResolvedValue(true);
  });

  it('rematches with parent context and delivers the SCR on confirmation', async () => {
    axios.get.mockImplementation(async (url) => {
      if (String(url).includes(`/transactions/${originalTxHash}`)) {
        // Parent asset context fetch during rematch
        return { data: ooxListingParent };
      }
      // Confirmation status poll uses originalTxHash as poll target for SCRs
      return { data: { status: 'success', gasUsed: 120000 } };
    });

    const matched = [
      sub(1, {
        address: ooxMarketplace,
        function: 'auctionToken',
        transactionType: 'SmartContractResult',
        matchTopLevelOnly: true,
        collectionIdentifier: 'EMP-897b49',
        onlyConfirmed: true,
      }),
    ];

    const pendingScr = { ...ooxAuctionScr, status: 'pending' };

    await confirmationPollingService.pollUntilConfirmed(
      originalTxHash,
      pendingScr,
      matched,
      'mainnet',
      websocketService
    );

    expect(webhookService.deliverWebhook).toHaveBeenCalledTimes(1);
    const delivered = webhookService.deliverWebhook.mock.calls[0][1];
    expect(delivered.hash).toBe(ooxAuctionScr.hash);
    expect(delivered.originalTxHash).toBe(originalTxHash);
    expect(delivered.status).toBe('success');
    expect(delivered.function).toBe('auctionToken');
  });

  it('does not deliver on confirmation when parent context is unavailable', async () => {
    axios.get.mockImplementation(async (url) => {
      if (String(url).includes(`/transactions/${originalTxHash}`)) {
        // First call in pollUntilConfirmed is status poll on originalTxHash.
        // Parent rematch uses the same hash — simulate success status once, then fail parent.
        // Both use same URL for SCR originalTxHash! Status poll and parent fetch collide.
        // Status: GET /transactions/{originalTxHash} returns parent tx with status success.
        // Rematch also GET /transactions/{originalTxHash} for parent asset — same resource.
        // For OOX SCR, originalTxHash IS the parent listing tx, which has EMP collection.
        // So a successful status poll already returns the parent body — rematch would reuse that
        // via a second fetch. To simulate "parent unavailable", reject after status.
        return { data: { status: 'success' } };
      }
      throw new Error('unexpected url');
    });

    // Force rematch parent fetch to fail by returning success status without collection fields,
    // then make a second call fail... Actually same hash. Override fetchTransactionDetails.
    const fetchSpy = jest
      .spyOn(websocketService, 'fetchTransactionDetails')
      .mockResolvedValue(null);

    axios.get.mockResolvedValue({ data: { status: 'success' } });

    const matched = [
      sub(1, {
        address: ooxMarketplace,
        function: 'auctionToken',
        transactionType: 'SmartContractResult',
        matchTopLevelOnly: true,
        collectionIdentifier: 'EMP-897b49',
        onlyConfirmed: true,
      }),
    ];

    await confirmationPollingService.pollUntilConfirmed(
      originalTxHash,
      { ...ooxAuctionScr, status: 'pending' },
      matched,
      'mainnet',
      websocketService
    );

    expect(webhookService.deliverWebhook).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
