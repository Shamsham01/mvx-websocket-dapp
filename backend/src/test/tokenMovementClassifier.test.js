const {
  calculateNetAssetDeltas,
  classifyTokenMovement,
  formatAtomicAmount,
} = require('../services/tokenMovementClassifier');

describe('token movement classifier', () => {
  const trader = 'erd1trader';

  test('calculates a routed net buy from root operations, not trigger SCR amount', async () => {
    const root = {
      hash: 'root-hash',
      sender: trader,
      function: 'swapTokensFixedInput',
      fee: '290350580000',
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
    const movement = await classifyTokenMovement({
      triggerTransfer: { txHash: 'scr-hash', originalTxHash: 'root-hash', value: '13856' },
      rootTransaction: root,
      targetTokenIdentifier: 'REWARD-cf6eac',
      tokenDecimals: 8,
      network: 'mainnet',
    });
    expect(movement.type).toBe('BUY');
    expect(movement.confidence).toBe('HIGH');
    expect(movement.targetToken.amount).toBe('56156.62092047');
    expect(movement.counterAssets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tokenIdentifier: 'EGLD',
          direction: 'SPENT',
          amount: '0.99970964942',
        }),
      ])
    );
  });

  test('classifies medium-confidence sell from opposing net flows without swap function', async () => {
    const movement = await classifyTokenMovement({
      triggerTransfer: { txHash: 'root' },
      rootTransaction: {
        hash: 'root',
        sender: trader,
        function: 'transfer',
        operations: [
          {
            type: 'esdt',
            sender: trader,
            receiver: 'erd1dex',
            identifier: 'TOKEN-aa',
            value: '500',
            decimals: 0,
          },
          { type: 'egld', sender: 'erd1dex', receiver: trader, value: '1000000000000000000' },
        ],
      },
      targetTokenIdentifier: 'TOKEN-aa',
      tokenDecimals: 0,
      network: 'mainnet',
    });
    expect(movement.type).toBe('SELL');
    expect(movement.confidence).toBe('MEDIUM');
  });

  test('does not classify buy when target is received without a spent counter', async () => {
    const movement = await classifyTokenMovement({
      rootTransaction: {
        hash: 'h',
        sender: trader,
        function: 'exchange',
        fee: '10',
        operations: [
          {
            type: 'esdt',
            sender: 'erd1dex',
            receiver: trader,
            identifier: 'TOKEN-aa',
            value: '100',
          },
        ],
      },
      triggerTransfer: { txHash: 'h' },
      targetTokenIdentifier: 'TOKEN-aa',
      tokenDecimals: 0,
    });
    expect(movement.type).toBe('OTHER');
    expect(movement.networkFee.atomicAmount).toBe('10');
  });

  test('marks non-trade intents as OTHER', async () => {
    const movement = await classifyTokenMovement({
      rootTransaction: {
        hash: 'h',
        sender: trader,
        function: 'claimRewards',
        operations: [
          { type: 'egld', sender: trader, receiver: 'erd1farm', value: '1' },
          {
            type: 'esdt',
            sender: 'erd1farm',
            receiver: trader,
            identifier: 'TOKEN-aa',
            value: '100',
          },
        ],
      },
      triggerTransfer: { txHash: 'h' },
      targetTokenIdentifier: 'TOKEN-aa',
      tokenDecimals: 0,
    });
    expect(movement.type).toBe('OTHER');
    expect(movement.subtype).toBe('non_trade');
  });

  test('formats atomics and aggregates deltas exactly with BigInt', () => {
    expect(formatAtomicAmount('100000000', 8)).toBe('1');
    const deltas = calculateNetAssetDeltas(
      [{ asset: 'A', from: trader, to: 'x', amount: 7n, decimals: 0 }],
      trader
    );
    expect(deltas.get('A').delta).toBe(-7n);
  });
});
