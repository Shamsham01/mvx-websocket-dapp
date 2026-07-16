'use strict';

const { normalizeValue } = require('./filterMatching');

function resolveRootTxHash(transaction) {
  return transaction?.originalTxHash || transaction?.txHash || transaction?.hash || null;
}

function resolveInitiator(rootTransaction) {
  return rootTransaction?.sender || null;
}

function safeBigInt(value) {
  try {
    return BigInt(String(value ?? 0));
  } catch {
    return 0n;
  }
}

function isNonFungibleOperation(operation) {
  const type = normalizeValue(operation?.type);
  if (!type) return false;
  if (type === 'nft' || type === 'sft') return true;
  if (type.includes('nonfungible') || type.includes('semifungible')) return true;
  return false;
}

function assetFromOperation(operation) {
  const type = normalizeValue(operation?.type);
  const identifier = operation?.identifier || operation?.tokenIdentifier || operation?.token;
  if (type === 'egld' || normalizeValue(identifier) === 'egld') return 'EGLD';
  // NFTs and SFTs are never counter-assets for movement classification.
  if (isNonFungibleOperation(operation)) return null;
  return identifier || null;
}

/**
 * Canonical operation legs are authoritative. We deliberately do not add
 * results/logs when operations exist because API data frequently represents
 * the same movement in both places.
 */
function extractCanonicalAssetFlows(rootTransaction, initiator = resolveInitiator(rootTransaction)) {
  if (!initiator) return [];
  const operations = Array.isArray(rootTransaction?.operations) ? rootTransaction.operations : [];
  const source = operations.length
    ? operations
    : (rootTransaction?.action?.arguments?.transfers || []).map((transfer) => ({
        sender: rootTransaction.sender,
        receiver: rootTransaction.receiver,
        identifier: transfer.token || transfer.identifier,
        value: transfer.value,
        decimals: transfer.decimals,
        type: transfer.type,
      }));

  return source
    .map((operation) => {
      const asset = assetFromOperation(operation);
      if (!asset) return null;
      const from = operation.sender || operation.from || rootTransaction.sender;
      const to = operation.receiver || operation.to || rootTransaction.receiver;
      const amount = safeBigInt(operation.value ?? operation.amount);
      if (!amount || (from !== initiator && to !== initiator)) return null;
      const decimals =
        asset === 'EGLD'
          ? 18
          : Number.isInteger(Number(operation.decimals))
            ? Number(operation.decimals)
            : 0;
      return { asset, from, to, amount, decimals };
    })
    .filter(Boolean);
}

function calculateNetAssetDeltas(flows, initiator) {
  const deltas = new Map();
  for (const flow of flows) {
    const key = String(flow.asset);
    const current = deltas.get(key) || { delta: 0n, decimals: flow.decimals || 0 };
    const out = flow.from === initiator ? flow.amount : 0n;
    const incoming = flow.to === initiator ? flow.amount : 0n;
    deltas.set(key, {
      delta: current.delta + incoming - out,
      decimals: current.decimals || flow.decimals || 0,
    });
  }
  return deltas;
}

function collectTransactionFamilyFunctions(rootTransaction) {
  const values = new Set();
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    for (const value of [
      node.function,
      node.action?.name,
      node.action?.arguments?.functionName,
      node.action?.arguments?.function,
    ]) {
      if (value) values.add(String(value).toLowerCase());
    }
    for (const event of node?.logs?.events || []) {
      if (event?.identifier) values.add(String(event.identifier).toLowerCase());
    }
    for (const result of node.results || []) visit(result);
  };
  visit(rootTransaction);
  return values;
}

function detectTransactionIntent(rootTransaction) {
  const functions = collectTransactionFamilyFunctions(rootTransaction);
  const text = [...functions].join(' ');
  if (/(liquidity|stake|unstake|farm|deposit|withdraw|claim)/.test(text)) return 'NON_TRADE';
  if (/(swap|exchange|trade|route|aggregator)/.test(text)) return 'SWAP';
  return 'UNKNOWN';
}

function formatAtomicAmount(amount, decimals = 0) {
  const value = safeBigInt(amount);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const divisor = 10n ** BigInt(Math.max(0, Number(decimals) || 0));
  const whole = absolute / divisor;
  const fractional = String(absolute % divisor)
    .padStart(Number(decimals) || 0, '0')
    .replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fractional ? `.${fractional}` : ''}`;
}

function hasCounterDirection(counterAssets, direction) {
  return counterAssets.some((asset) => asset.direction === direction);
}

/**
 * Priority: net flows → root intent → family swap evidence.
 * BUY/SELL only when confidence is HIGH or MEDIUM.
 */
function classifyMovement({ targetDelta, counterAssets, intent }) {
  if (targetDelta === 0n) {
    return { type: 'IGNORE', subtype: 'internal', confidence: 'LOW' };
  }

  const buyShape = targetDelta > 0n && hasCounterDirection(counterAssets, 'SPENT');
  const sellShape = targetDelta < 0n && hasCounterDirection(counterAssets, 'RECEIVED');

  if (intent === 'NON_TRADE') {
    return { type: 'OTHER', subtype: 'non_trade', confidence: 'LOW' };
  }

  if (intent === 'SWAP' && (buyShape || sellShape)) {
    return {
      type: buyShape ? 'BUY' : 'SELL',
      subtype: 'swap',
      confidence: 'HIGH',
    };
  }

  // MEDIUM: clear opposing net flows without explicit swap/non-trade intent.
  if (intent === 'UNKNOWN' && (buyShape || sellShape)) {
    return {
      type: buyShape ? 'BUY' : 'SELL',
      subtype: 'swap_inferred',
      confidence: 'MEDIUM',
    };
  }

  return {
    type: 'OTHER',
    subtype: buyShape || sellShape ? 'ambiguous_trade' : 'transfer',
    confidence: 'LOW',
  };
}

async function classifyTokenMovement({
  triggerTransfer,
  rootTransaction,
  targetTokenIdentifier,
  tokenDecimals,
  network,
}) {
  const root = rootTransaction || triggerTransfer;
  const rootTxHash = resolveRootTxHash(root) || resolveRootTxHash(triggerTransfer);
  const initiator = resolveInitiator(root);
  if (!initiator || !targetTokenIdentifier) return null;

  const flows = extractCanonicalAssetFlows(root, initiator);
  const deltas = calculateNetAssetDeltas(flows, initiator);
  const targetKey = [...deltas.keys()].find(
    (key) => normalizeValue(key) === normalizeValue(targetTokenIdentifier)
  );
  const targetEntry = targetKey ? deltas.get(targetKey) : { delta: 0n, decimals: tokenDecimals || 0 };
  const targetDelta = targetEntry.delta;

  const counterAssets = [...deltas.entries()]
    .filter(
      ([asset, entry]) =>
        normalizeValue(asset) !== normalizeValue(targetTokenIdentifier) && entry.delta !== 0n
    )
    .map(([asset, entry]) => ({
      tokenIdentifier: asset,
      amount: formatAtomicAmount(entry.delta < 0n ? -entry.delta : entry.delta, entry.decimals),
      atomicAmount: (entry.delta < 0n ? -entry.delta : entry.delta).toString(),
      direction: entry.delta < 0n ? 'SPENT' : 'RECEIVED',
    }));

  const intent = detectTransactionIntent(root);
  const classification = classifyMovement({ targetDelta, counterAssets, intent });
  if (classification.type === 'IGNORE') return null;

  const absTarget = targetDelta < 0n ? -targetDelta : targetDelta;
  return {
    ...classification,
    trader: initiator,
    targetToken: {
      identifier: targetTokenIdentifier,
      amount: formatAtomicAmount(absTarget, tokenDecimals),
      atomicAmount: absTarget.toString(),
      direction: targetDelta > 0n ? 'RECEIVED' : 'SPENT',
    },
    counterAssets,
    networkFee:
      root?.fee != null
        ? { atomicAmount: String(root.fee), amount: formatAtomicAmount(root.fee, 18) }
        : null,
    rootTxHash,
    triggerTxHash: triggerTransfer?.txHash || triggerTransfer?.hash || null,
    evidence: {
      intent,
      functions: [...collectTransactionFamilyFunctions(root)],
      network,
    },
  };
}

module.exports = {
  resolveRootTxHash,
  resolveInitiator,
  extractCanonicalAssetFlows,
  calculateNetAssetDeltas,
  collectTransactionFamilyFunctions,
  detectTransactionIntent,
  classifyMovement,
  formatAtomicAmount,
  classifyTokenMovement,
};
