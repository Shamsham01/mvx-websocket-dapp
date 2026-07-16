const { classifyTokenMovement } = require('../services/tokenMovementClassifier');

describe('classified BUY movement extraction', () => {
  const trader = 'erd1h9hm0gnkgn888ly9zgnswsjajprk2fkszndwhm28xkcay66xnnesdyzcs6';

  test('classifies xExchange composeTasks EGLD-to-REWARD swap from root value', async () => {
    const rootTxHash = '99632e8fb6d42afff79ab12c5a49fb9c807accb8aba7f798f2c9341135a0b3d8';
    const composer = 'erd1qqqqqqqqqqqqqpgqsytkvnexypp7argk02l0rasnj57sxa542jpshkl7df';

    const movement = await classifyTokenMovement({
      triggerTransfer: {
        txHash: '66261702a4c9caed1d9686b868fe8aacb66fc6385c266fa8696a2b24c9c6a650',
        originalTxHash: rootTxHash,
      },
      rootTransaction: {
        hash: rootTxHash,
        sender: trader,
        receiver: composer,
        function: 'composeTasks',
        value: '500000000000000000',
        fee: '613595980000000',
        status: 'success',
        operations: [
          {
            type: 'egld',
            sender: composer,
            receiver: 'erd1wegld',
            value: '500000000000000000',
          },
          {
            type: 'esdt',
            sender: composer,
            receiver: trader,
            identifier: 'REWARD-cf6eac',
            value: '2799794143110',
            decimals: 8,
          },
        ],
        results: [
          {
            function: 'transfer',
            status: 'success',
            sender: composer,
            receiver: trader,
            value: '49039020000000',
          },
          {
            function: 'swapTokensFixedInput',
            status: 'success',
            sender: composer,
            receiver: 'erd1pool',
            value: '0',
          },
          {
            function: 'depositSwapFees',
            status: 'success',
            sender: 'erd1pool',
            receiver: 'erd1fees',
            value: '0',
          },
        ],
      },
      targetTokenIdentifier: 'REWARD-cf6eac',
      tokenDecimals: 8,
      network: 'mainnet',
    });

    expect(movement.type).toBe('BUY');
    expect(movement.subtype).toBe('swap');
    expect(movement.confidence).toBe('HIGH');
    expect(movement.targetToken.amount).toBe('27997.9414311');
    expect(movement.targetToken.direction).toBe('RECEIVED');
    expect(movement.counterAssets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tokenIdentifier: 'EGLD',
          amount: '0.49995096098',
          atomicAmount: '499950960980000000',
          direction: 'SPENT',
        }),
      ])
    );
  });

  test('does not double count root EGLD value already represented in operations', async () => {
    const movement = await classifyTokenMovement({
      triggerTransfer: { txHash: 'dedupe-root' },
      rootTransaction: {
        hash: 'dedupe-root',
        sender: trader,
        receiver: 'erd1router',
        function: 'swapTokensFixedInput',
        value: '1000000000000000000',
        operations: [
          {
            type: 'egld',
            sender: trader,
            receiver: 'erd1router',
            value: '1000000000000000000',
          },
          {
            type: 'esdt',
            sender: 'erd1router',
            receiver: trader,
            identifier: 'REWARD-cf6eac',
            value: '100000000',
            decimals: 8,
          },
        ],
        results: [
          {
            function: 'transfer',
            status: 'success',
            sender: 'erd1router',
            receiver: trader,
            value: '100000000000000000',
          },
        ],
      },
      targetTokenIdentifier: 'REWARD-cf6eac',
      tokenDecimals: 8,
      network: 'mainnet',
    });

    expect(movement.type).toBe('BUY');
    expect(movement.counterAssets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tokenIdentifier: 'EGLD',
          amount: '0.9',
          atomicAmount: '900000000000000000',
          direction: 'SPENT',
        }),
      ])
    );
  });
});
