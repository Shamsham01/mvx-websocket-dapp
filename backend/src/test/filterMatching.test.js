const filterMatching = require('../services/filterMatching');

describe('subscription filter matching', () => {
  const marketplaceBuy = {
    txHash: 'da6cd7c7',
    type: 'normal',
    function: 'buy',
    sender: 'erd1user',
    receiver: 'erd1market',
    status: 'success',
    value: '350000000000000000',
    operations: [
      {
        type: 'nft',
        collection: 'EMP-897b49',
        identifier: 'EMP-897b49-3c',
        sender: 'erd1market',
        receiver: 'erd1user',
      },
    ],
    results: [{ function: 'ESDTNFTTransfer', sender: 'erd1market', receiver: 'erd1user' }],
    logs: { events: [{ identifier: 'ESDTNFTTransfer' }, { identifier: 'buy' }] },
  };

  const scrNftTransfer = {
    txHash: '6df3221f',
    type: 'SmartContractResult',
    function: 'ESDTNFTTransfer',
    sender: 'erd1market',
    receiver: 'erd1user',
    originalTxHash: 'da6cd7c7',
    status: 'success',
    value: '0',
    action: {
      arguments: {
        transfers: [{ identifier: 'EMP-897b49-3c', collection: 'EMP-897b49' }],
      },
    },
  };

  const ooxMarketplace = 'erd1qqqqqqqqqqqqqpgqwp73w2a9eyzs64eltupuz3y3hv798vlv899qrjnflg';
  const ooxListingParent = {
    txHash: 'f69e536e067dba31e0884abb38adbd58e90e2cbdaab287a8414bbb49560dc3c7',
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
    originalTxHash: 'f69e536e067dba31e0884abb38adbd58e90e2cbdaab287a8414bbb49560dc3c7',
    status: 'success',
  };

  const ooxListingFilters = {
    address: ooxMarketplace,
    function: 'auctionToken',
    onlyConfirmed: true,
    transactionType: 'SmartContractResult',
    matchTopLevelOnly: true,
    collectionIdentifier: 'EMP-897b49',
  };

  it('deep function match includes nested ESDTNFTTransfer on buy parent', () => {
    expect(
      filterMatching.matchesFilters(marketplaceBuy, {
        function: 'ESDTNFTTransfer',
        collectionIdentifier: 'EMP-897b49',
      })
    ).toBe(true);
  });

  it('matchTopLevelOnly excludes buy parent when function is ESDTNFTTransfer', () => {
    expect(
      filterMatching.matchesFilters(marketplaceBuy, {
        function: 'ESDTNFTTransfer',
        matchTopLevelOnly: true,
      })
    ).toBe(false);
  });

  it('matchTopLevelOnly matches SCR row for ESDTNFTTransfer', () => {
    expect(
      filterMatching.matchesFilters(scrNftTransfer, {
        function: 'ESDTNFTTransfer',
        matchTopLevelOnly: true,
        collectionIdentifier: 'EMP-897b49',
      })
    ).toBe(true);
  });

  it('transactionType SmartContractResult excludes normal buy', () => {
    expect(
      filterMatching.matchesFilters(marketplaceBuy, {
        transactionType: 'SmartContractResult',
      })
    ).toBe(false);
    expect(
      filterMatching.matchesFilters(scrNftTransfer, {
        transactionType: 'SmartContractResult',
      })
    ).toBe(true);
  });

  it('transactionType SmartContractResult matches MVX unsigned SCR rows', () => {
    const marketplace = 'erd1qqqqqqqqqqqqqpgqwp73w2a9eyzs64eltupuz3y3hv798vlv899qrjnflg';
    const unsignedScr = {
      type: 'unsigned',
      function: 'ESDTNFTTransfer',
      sender: marketplace,
      originalTxHash: '695a9f5e82f52d19fa7e7a0c155432d3d1e452dea39ea2731962513f89e8c81d',
      status: 'success',
      action: { arguments: { transfers: [] } },
      operations: [{ type: 'nft', collection: 'EMP-897b49', identifier: 'EMP-897b49-1e60' }],
    };
    expect(
      filterMatching.matchesFilters(unsignedScr, {
        sender: marketplace,
        function: 'ESDTNFTTransfer',
        transactionType: 'SmartContractResult',
        matchTopLevelOnly: true,
        collectionIdentifier: 'EMP-897b49',
      })
    ).toBe(true);
  });

  it('OOX auctionToken SCR without parent context fails collection filter', () => {
    expect(filterMatching.matchesFilters(ooxAuctionScr, ooxListingFilters)).toBe(false);
    expect(filterMatching.requiresParentAssetContext(ooxAuctionScr, ooxListingFilters)).toBe(true);
  });

  it('OOX auctionToken SCR matches collection from parent asset context', () => {
    expect(
      filterMatching.matchesFilters(ooxAuctionScr, ooxListingFilters, {
        parentTransaction: ooxListingParent,
      })
    ).toBe(true);
  });

  it('OOX auctionToken SCR rejects wrong collection even with parent context', () => {
    expect(
      filterMatching.matchesFilters(
        ooxAuctionScr,
        { ...ooxListingFilters, collectionIdentifier: 'OTHER-abcdef' },
        { parentTransaction: ooxListingParent }
      )
    ).toBe(false);
  });

  it('matchTopLevelOnly: parent auctionToken does not satisfy SCR function ESDTNFTTransfer', () => {
    const esdtNftScr = {
      ...ooxAuctionScr,
      function: 'ESDTNFTTransfer',
    };
    expect(
      filterMatching.matchesFilters(esdtNftScr, ooxListingFilters, {
        parentTransaction: ooxListingParent,
      })
    ).toBe(false);
  });

  it('normal transaction collection filtering still works without parent context', () => {
    expect(
      filterMatching.matchesFilters(marketplaceBuy, {
        function: 'buy',
        collectionIdentifier: 'EMP-897b49',
      })
    ).toBe(true);
  });

  it('SCR with collection already on row still matches without parent', () => {
    expect(
      filterMatching.matchesFilters(scrNftTransfer, {
        function: 'ESDTNFTTransfer',
        matchTopLevelOnly: true,
        collectionIdentifier: 'EMP-897b49',
      })
    ).toBe(true);
    expect(
      filterMatching.requiresParentAssetContext(scrNftTransfer, {
        collectionIdentifier: 'EMP-897b49',
        matchTopLevelOnly: true,
      })
    ).toBe(false);
  });

  it('tokenIdentifier can match from parent asset context on SCR', () => {
    const filters = {
      address: ooxMarketplace,
      function: 'auctionToken',
      transactionType: 'SmartContractResult',
      matchTopLevelOnly: true,
      tokenIdentifier: 'EMP-897b49-214a',
    };
    expect(filterMatching.matchesFilters(ooxAuctionScr, filters)).toBe(false);
    expect(
      filterMatching.matchesFilters(ooxAuctionScr, filters, {
        parentTransaction: ooxListingParent,
      })
    ).toBe(true);
  });

  it('parent asset context does not change current-row amount semantics', () => {
    const filters = {
      ...ooxListingFilters,
      amountMin: '1',
    };
    // SCR has no EGLD value worth 1 — amount stays on SCR row; parent NFT value must not satisfy.
    expect(
      filterMatching.matchesFilters(ooxAuctionScr, filters, {
        parentTransaction: ooxListingParent,
      })
    ).toBe(false);
  });

  it('resolveApiTokenFilter maps egldOnly, tokenIdentifier, and legacy token', () => {
    expect(filterMatching.resolveApiTokenFilter({})).toBeUndefined();
    expect(filterMatching.resolveApiTokenFilter({ egldOnly: true })).toBe('EGLD');
    expect(filterMatching.resolveApiTokenFilter({ tokenIdentifier: 'REWARD-cf6eac' })).toBe(
      'REWARD-cf6eac'
    );
    expect(filterMatching.resolveApiTokenFilter({ tokenIdentifier: '  REWARD-cf6eac  ' })).toBe(
      'REWARD-cf6eac'
    );
    expect(filterMatching.resolveApiTokenFilter({ token: 'EGLD' })).toBe('EGLD');
    expect(filterMatching.resolveApiTokenFilter({ token: 'egld-000000' })).toBe('EGLD');
    expect(filterMatching.resolveApiTokenFilter({ token: 'USDC-c76f1f' })).toBe('USDC-c76f1f');
    // egldOnly wins over tokenIdentifier
    expect(
      filterMatching.resolveApiTokenFilter({
        egldOnly: true,
        tokenIdentifier: 'REWARD-cf6eac',
      })
    ).toBe('EGLD');
    // tokenIdentifier wins over legacy token
    expect(
      filterMatching.resolveApiTokenFilter({
        tokenIdentifier: 'REWARD-cf6eac',
        token: 'USDC-c76f1f',
      })
    ).toBe('REWARD-cf6eac');
  });

  it('amount min/max uses EGLD value when no tokenIdentifier', () => {
    const tx = { value: '350000000000000000' }; // 0.35 EGLD
    expect(
      filterMatching.matchesFilters(tx, { amountMin: '0.35', amountMax: '0.35' })
    ).toBe(true);
    expect(filterMatching.matchesFilters(tx, { amountMin: '1' })).toBe(false);
  });

  it('parseAmount respects token decimals', () => {
    expect(filterMatching.parseAmount('1', 6)).toBe(BigInt(1_000_000));
    expect(filterMatching.parseAmount('100', 8)).toBe(BigInt(10_000_000_000));
    expect(filterMatching.parseAmount('0.5', 18)).toBe(BigInt('500000000000000000'));
  });

  it('REWARD-cf6eac: 100 human with 8 decimals matches atomic WebSocket value', () => {
    const tx = {
      operations: [
        {
          type: 'FungibleESDT',
          identifier: 'REWARD-cf6eac',
          value: '10000000000',
        },
      ],
    };
    expect(
      filterMatching.matchesFilters(tx, {
        tokenIdentifier: 'REWARD-cf6eac',
        tokenDecimals: 8,
        amountMin: '100',
        amountMax: '100',
      })
    ).toBe(true);
  });

  it('REWARD-cf6eac: wrong decimals (18) fails amount filter for same atomic value', () => {
    const tx = {
      operations: [
        {
          type: 'FungibleESDT',
          identifier: 'REWARD-cf6eac',
          value: '10000000000',
        },
      ],
    };
    expect(
      filterMatching.matchesFilters(tx, {
        tokenIdentifier: 'REWARD-cf6eac',
        tokenDecimals: 18,
        amountMin: '100',
      })
    ).toBe(false);
  });

  it('ESDT amount filter fails when tokenDecimals missing', () => {
    const tx = {
      operations: [{ type: 'FungibleESDT', identifier: 'REWARD-cf6eac', value: '10000000000' }],
    };
    expect(
      filterMatching.matchesFilters(tx, {
        tokenIdentifier: 'REWARD-cf6eac',
        amountMin: '100',
      })
    ).toBe(false);
  });

  it('amount min/max uses ESDT leg when tokenIdentifier is set', () => {
    const tx = {
      operations: [
        {
          type: 'FungibleESDT',
          identifier: 'REWARD-cf6eac',
          value: '200000000',
        },
      ],
    };
    expect(
      filterMatching.matchesFilters(tx, {
        tokenIdentifier: 'REWARD-cf6eac',
        tokenDecimals: 8,
        amountMin: '1',
        amountMax: '2',
      })
    ).toBe(true);
    expect(
      filterMatching.matchesFilters(tx, {
        tokenIdentifier: 'REWARD-cf6eac',
        tokenDecimals: 8,
        amountMin: '3',
      })
    ).toBe(false);
  });
});
