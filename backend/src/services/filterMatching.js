function normalizeValue(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function transferFunctionName(transfer) {
  return (
    transfer.function ||
    transfer.action?.arguments?.functionName ||
    transfer.action?.name ||
    transfer.action?.arguments?.function ||
    null
  );
}

function transferFunctionNamesSet(transfer) {
  const names = new Set();
  const add = (v) => {
    const n = normalizeValue(v);
    if (n) names.add(n);
  };
  add(transferFunctionName(transfer));
  for (const r of transfer?.results || []) {
    add(r.function);
    add(r.action?.name);
    add(r.action?.arguments?.functionName);
    add(r.action?.arguments?.function);
    for (const ev of r?.logs?.events || []) {
      add(ev.identifier);
    }
  }
  for (const ev of transfer?.logs?.events || []) {
    add(ev.identifier);
  }
  return names;
}

function transferSenderAddressesSet(transfer) {
  const addrs = new Set();
  const add = (v) => {
    const n = normalizeValue(v);
    if (n) addrs.add(n);
  };
  add(transfer?.sender);
  for (const r of transfer?.results || []) {
    add(r.sender);
  }
  for (const op of transfer?.operations || []) {
    add(op.sender);
  }
  return addrs;
}

function transferReceiverAddressesSet(transfer) {
  const addrs = new Set();
  const add = (v) => {
    const n = normalizeValue(v);
    if (n) addrs.add(n);
  };
  add(transfer?.receiver);
  for (const r of transfer?.results || []) {
    add(r.receiver);
  }
  for (const op of transfer?.operations || []) {
    add(op.receiver);
  }
  return addrs;
}

function transferHasToken(transfer, targetToken, topLevelOnly = false) {
  const target = normalizeValue(targetToken);
  const fromTransfers = (transfer?.action?.arguments?.transfers || []).some(
    (t) => normalizeValue(t?.token || t?.identifier) === target
  );
  if (topLevelOnly) return fromTransfers;
  const fromOps = (transfer?.operations || []).some(
    (op) => normalizeValue(op?.identifier || op?.tokenIdentifier || op?.token) === target
  );
  return fromTransfers || fromOps;
}

function transferHasCollection(transfer, targetCollection, topLevelOnly = false) {
  const target = normalizeValue(targetCollection);
  const transfers = transfer?.action?.arguments?.transfers || [];
  for (const t of transfers) {
    const tok = normalizeValue(t?.token || t?.identifier);
    if (tok && (tok === target || tok.startsWith(target + '-'))) return true;
  }
  if (topLevelOnly) return false;

  const ops = transfer?.operations || [];
  for (const op of ops) {
    const col = normalizeValue(op?.collection);
    if (col && col === target) return true;
    const id = normalizeValue(op?.identifier || op?.tokenIdentifier);
    if (id && (id === target || id.startsWith(target + '-'))) return true;
  }
  return false;
}

/**
 * Parse human-readable amount to atomic units (wei-style).
 * @param {string|number} value - e.g. "100", "0.35"
 * @param {number} decimals - token decimals from chain (EGLD = 18)
 */
function parseAmount(value, decimals = 18) {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value).trim();
  if (!s) return null;

  let dec =
    typeof decimals === 'number' && Number.isFinite(decimals) ? Math.floor(decimals) : 18;
  if (dec < 0 || dec > 18) dec = 18;

  const factor = BigInt(10) ** BigInt(dec);
  if (s.includes('.')) {
    const [intPart, decPart] = s.split('.');
    const padded = (decPart || '').padEnd(dec, '0').slice(0, dec);
    return BigInt(intPart || '0') * factor + BigInt(padded || '0');
  }
  return BigInt(s) * factor;
}

function transferValue(transfer) {
  const v = transfer?.value ?? transfer?.amount;
  if (v === undefined || v === null) return BigInt(0);
  return BigInt(String(v));
}

function tokenIdMatches(candidate, targetToken) {
  const id = normalizeValue(candidate);
  if (!id || !targetToken) return false;
  return id === targetToken || id.startsWith(`${targetToken}-`);
}

/**
 * Largest matching ESDT leg amount (atomic units) for tokenIdentifier on this row.
 */
function transferEsdtAmount(transfer, targetToken, topLevelOnly = false) {
  let max = BigInt(0);
  const consider = (tokenRef, value) => {
    if (!tokenIdMatches(tokenRef, targetToken)) return;
    try {
      const amt = BigInt(String(value ?? 0));
      if (amt > max) max = amt;
    } catch {
      /* ignore malformed values */
    }
  };

  for (const t of transfer?.action?.arguments?.transfers || []) {
    consider(t?.token || t?.identifier, t?.value);
  }

  if (!topLevelOnly) {
    for (const op of transfer?.operations || []) {
      const type = normalizeValue(op?.type);
      if (type === 'egld' || type === 'nft') continue;
      consider(op?.identifier || op?.tokenIdentifier || op?.token, op?.value);
    }
  }

  return max;
}

/**
 * Amount used for min/max filters: EGLD native value, or ESDT leg when tokenIdentifier is set.
 */
function transferAmountForFilters(transfer, filters, topLevelOnly = false) {
  const tokenId = filters?.tokenIdentifier
    ? normalizeValue(filters.tokenIdentifier)
    : null;
  if (tokenId) {
    return transferEsdtAmount(transfer, tokenId, topLevelOnly);
  }
  return transferValue(transfer);
}

/**
 * Decimals for human-readable min/max → atomic comparison.
 * EGLD: always 18. ESDT: requires tokenDecimals from chain (never assume 18).
 */
function resolveAmountDecimals(filters) {
  if (!filters?.tokenIdentifier) {
    return 18;
  }
  const d = Number(filters.tokenDecimals);
  if (Number.isInteger(d) && d >= 0 && d <= 18) {
    return d;
  }
  return null;
}

function resolveApiTokenFilter(filters) {
  if (!filters) return undefined;
  if (filters.egldOnly === true) return 'EGLD';
  const legacy = filters.token;
  if (!legacy) return undefined;
  const norm = normalizeValue(legacy);
  if (norm === 'egld' || norm === 'egld-000000') return 'EGLD';
  return undefined;
}

function matchesFilters(transfer, filters) {
  const normalizedFilters = filters || {};
  const topLevelOnly = normalizedFilters.matchTopLevelOnly === true;
  const sender = normalizeValue(transfer.sender);
  const receiver = normalizeValue(transfer.receiver);
  const relayer = normalizeValue(transfer.relayer);

  if (normalizedFilters.transactionType) {
    const wantType = normalizeValue(normalizedFilters.transactionType);
    const rowType = normalizeValue(transfer?.type);
    if (rowType !== wantType) {
      return false;
    }
  }

  if (normalizedFilters.sender) {
    const want = normalizeValue(normalizedFilters.sender);
    const senders = topLevelOnly
      ? new Set(sender ? [sender] : [])
      : transferSenderAddressesSet(transfer);
    if (!senders.has(want)) {
      return false;
    }
  }

  if (normalizedFilters.receiver) {
    const want = normalizeValue(normalizedFilters.receiver);
    const receivers = topLevelOnly
      ? new Set(receiver ? [receiver] : [])
      : transferReceiverAddressesSet(transfer);
    if (!receivers.has(want)) {
      return false;
    }
  }

  if (normalizedFilters.function) {
    const want = normalizeValue(normalizedFilters.function);
    if (topLevelOnly) {
      const topFn = normalizeValue(transferFunctionName(transfer));
      if (topFn !== want) {
        return false;
      }
    } else if (!transferFunctionNamesSet(transfer).has(want)) {
      return false;
    }
  }

  if (normalizedFilters.token) {
    const targetToken = normalizeValue(normalizedFilters.token);
    if (!transferHasToken(transfer, targetToken, topLevelOnly)) {
      return false;
    }
  }

  if (normalizedFilters.tokenIdentifier) {
    const targetToken = normalizeValue(normalizedFilters.tokenIdentifier);
    if (!transferHasToken(transfer, targetToken, topLevelOnly)) {
      return false;
    }
  }

  if (normalizedFilters.address) {
    const normalizedAddress = normalizeValue(normalizedFilters.address);
    const matchesAddress =
      sender === normalizedAddress ||
      receiver === normalizedAddress ||
      relayer === normalizedAddress;

    if (!matchesAddress) {
      return false;
    }
  }

  if (normalizedFilters.relayer && relayer !== normalizeValue(normalizedFilters.relayer)) {
    return false;
  }

  if (normalizedFilters.collectionIdentifier) {
    const target = normalizeValue(normalizedFilters.collectionIdentifier);
    if (!transferHasCollection(transfer, target, topLevelOnly)) {
      return false;
    }
  }

  const hasAmountMin = normalizedFilters.amountMin != null && normalizedFilters.amountMin !== '';
  const hasAmountMax = normalizedFilters.amountMax != null && normalizedFilters.amountMax !== '';
  if (hasAmountMin || hasAmountMax) {
    const txValue = transferAmountForFilters(transfer, normalizedFilters, topLevelOnly);
    const decimals = resolveAmountDecimals(normalizedFilters);
    if (decimals == null) {
      return false;
    }

    if (hasAmountMin) {
      const minVal = parseAmount(normalizedFilters.amountMin, decimals);
      if (minVal != null && txValue < minVal) return false;
    }
    if (hasAmountMax) {
      const maxVal = parseAmount(normalizedFilters.amountMax, decimals);
      if (maxVal != null && txValue > maxVal) return false;
    }
  }

  return true;
}

module.exports = {
  normalizeValue,
  transferFunctionName,
  transferFunctionNamesSet,
  transferSenderAddressesSet,
  transferReceiverAddressesSet,
  transferHasToken,
  transferHasCollection,
  parseAmount,
  transferValue,
  transferEsdtAmount,
  transferAmountForFilters,
  resolveAmountDecimals,
  resolveApiTokenFilter,
  matchesFilters,
};
