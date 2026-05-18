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
});
