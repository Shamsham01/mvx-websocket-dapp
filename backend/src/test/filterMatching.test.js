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

  it('resolveApiTokenFilter maps egldOnly to EGLD and ignores ESDT legacy token', () => {
    expect(filterMatching.resolveApiTokenFilter({ egldOnly: true })).toBe('EGLD');
    expect(filterMatching.resolveApiTokenFilter({ token: 'EGLD' })).toBe('EGLD');
    expect(filterMatching.resolveApiTokenFilter({ token: 'USDC-c76f1f' })).toBeUndefined();
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
