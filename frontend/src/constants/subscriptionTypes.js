/**
 * Subscription watch types and presets for the create/edit UX.
 * Backend filter shape is unchanged — these map UI intent → filters.
 */

export const SUBSCRIPTION_TYPE_IDS = {
  EGLD: 'egld',
  TOKEN: 'token',
  NFT: 'nft',
  WALLET: 'wallet',
  CUSTOM: 'custom',
};

export const SUBSCRIPTION_TYPES = [
  {
    id: SUBSCRIPTION_TYPE_IDS.EGLD,
    label: 'EGLD',
    shortLabel: 'EGLD',
    description: 'Native EGLD payments and transfers.',
  },
  {
    id: SUBSCRIPTION_TYPE_IDS.TOKEN,
    label: 'Token',
    shortLabel: 'Token',
    description: 'Fungible ESDT activity (transfers, buys, sells).',
  },
  {
    id: SUBSCRIPTION_TYPE_IDS.NFT,
    label: 'NFT',
    shortLabel: 'NFT',
    description: 'Collection sales, listings, or transfers.',
  },
  {
    id: SUBSCRIPTION_TYPE_IDS.WALLET,
    label: 'Wallet / contract',
    shortLabel: 'Wallet',
    description: 'Any activity involving an address or smart contract.',
  },
  {
    id: SUBSCRIPTION_TYPE_IDS.CUSTOM,
    label: 'Custom',
    shortLabel: 'Custom',
    description: 'Full filter control for advanced setups.',
  },
];

/** NFT goal presets — fill SCR-oriented defaults beginners usually need. */
export const NFT_GOALS = [
  {
    id: 'sales',
    label: 'Sales',
    description: 'NFT delivered after a marketplace purchase (SCR + ESDTNFTTransfer).',
    filters: {
      function: 'ESDTNFTTransfer',
      transactionType: 'SmartContractResult',
      matchTopLevelOnly: true,
      onlyConfirmed: true,
    },
  },
  {
    id: 'listings',
    label: 'Listings',
    description: 'Items listed/auctioned (SCR + auctionToken; adjust function for other marketplaces).',
    filters: {
      function: 'auctionToken',
      transactionType: 'SmartContractResult',
      matchTopLevelOnly: true,
      onlyConfirmed: true,
    },
  },
  {
    id: 'transfers',
    label: 'All transfers',
    description: 'Any collection activity matching the NFT id (broader net).',
    filters: {
      function: '',
      transactionType: '',
      matchTopLevelOnly: false,
      onlyConfirmed: true,
    },
  },
];

/** OOX marketplace contract — common MultiversX NFT sales address. */
export const OOX_MARKETPLACE_ADDRESS =
  'erd1qqqqqqqqqqqqqpgqwp73w2a9eyzs64eltupuz3y3hv798vlv899qrjnflg';

export const emptyFilters = () => ({
  sender: '',
  receiver: '',
  address: '',
  egldOnly: false,
  function: '',
  matchTopLevelOnly: false,
  transactionType: '',
  tokenIdentifier: '',
  collectionIdentifier: '',
  amountMin: '',
  amountMax: '',
  onlyConfirmed: false,
  movementMode: '',
  movementTypes: [],
  movementAmountMin: '',
  movementAmountMax: '',
  /** UI-only: nft sales | listings | transfers */
  nftGoal: 'sales',
});

/**
 * One-click starters. Applied on top of current name/webhook/network.
 */
export const SUBSCRIPTION_PRESETS = [
  {
    id: 'oox-nft-sales',
    label: 'OOX NFT sales',
    type: SUBSCRIPTION_TYPE_IDS.NFT,
    hint: 'Marketplace sales for a collection',
    suggestedName: 'OOX NFT Sales',
    filters: {
      ...emptyFilters(),
      address: OOX_MARKETPLACE_ADDRESS,
      collectionIdentifier: '',
      nftGoal: 'sales',
      ...NFT_GOALS.find((g) => g.id === 'sales').filters,
    },
  },
  {
    id: 'wallet-egld',
    label: 'Wallet EGLD',
    type: SUBSCRIPTION_TYPE_IDS.EGLD,
    hint: 'Native EGLD for one address',
    suggestedName: 'Wallet EGLD',
    filters: {
      ...emptyFilters(),
      egldOnly: true,
      onlyConfirmed: true,
      address: '',
    },
  },
  {
    id: 'token-buys',
    label: 'Token buys',
    type: SUBSCRIPTION_TYPE_IDS.TOKEN,
    hint: 'Classified BUY movements for an ESDT',
    suggestedName: 'Token Buys',
    filters: {
      ...emptyFilters(),
      tokenIdentifier: '',
      movementMode: 'classified',
      movementTypes: ['BUY'],
      onlyConfirmed: true,
    },
  },
];

export function getSubscriptionTypeMeta(typeId) {
  return SUBSCRIPTION_TYPES.find((t) => t.id === typeId) || SUBSCRIPTION_TYPES[SUBSCRIPTION_TYPES.length - 1];
}

/**
 * Infer watch type from stored filters (edit / list).
 */
export function inferSubscriptionType(filters = {}) {
  const f = filters || {};
  const hasToken = !!(f.tokenIdentifier && String(f.tokenIdentifier).trim());
  const hasCollection = !!(f.collectionIdentifier && String(f.collectionIdentifier).trim());
  const hasEgld = !!(f.egldOnly || f.token === 'EGLD' || f.token === 'EGLD-000000');
  const hasAddress = !!(f.address || f.sender || f.receiver);
  const hasAdvanced =
    !!(f.function || f.transactionType || f.matchTopLevelOnly) &&
    !hasCollection; // NFT goals intentionally set advanced fields

  if (hasToken && hasCollection) return SUBSCRIPTION_TYPE_IDS.CUSTOM;
  if (hasToken) return SUBSCRIPTION_TYPE_IDS.TOKEN;
  if (hasCollection) return SUBSCRIPTION_TYPE_IDS.NFT;
  if (hasEgld && !hasToken && !hasCollection) return SUBSCRIPTION_TYPE_IDS.EGLD;
  if (hasAddress && !hasAdvanced) return SUBSCRIPTION_TYPE_IDS.WALLET;
  if (hasAddress || hasAdvanced || f.function || f.transactionType) return SUBSCRIPTION_TYPE_IDS.CUSTOM;
  return SUBSCRIPTION_TYPE_IDS.CUSTOM;
}

export function inferNftGoal(filters = {}) {
  const f = filters || {};
  const fn = (f.function || '').trim();
  const txType = f.transactionType || '';
  if (fn === 'ESDTNFTTransfer' && txType === 'SmartContractResult') return 'sales';
  if (fn === 'auctionToken' || fn === 'listing') return 'listings';
  if (!fn && !txType) return 'transfers';
  return 'sales';
}

/**
 * When switching watch type, keep shared basics and reset type-specific filters.
 */
export function filtersForWatchType(typeId, previous = emptyFilters()) {
  const base = emptyFilters();
  const keepAmounts = {
    amountMin: previous.amountMin || '',
    amountMax: previous.amountMax || '',
  };

  switch (typeId) {
    case SUBSCRIPTION_TYPE_IDS.EGLD:
      return {
        ...base,
        ...keepAmounts,
        egldOnly: true,
        onlyConfirmed: true,
        address: previous.address || '',
        sender: previous.sender || '',
        receiver: previous.receiver || '',
      };
    case SUBSCRIPTION_TYPE_IDS.TOKEN:
      return {
        ...base,
        tokenIdentifier: previous.tokenIdentifier || '',
        movementMode: previous.movementMode === 'classified' ? 'classified' : '',
        movementTypes:
          previous.movementMode === 'classified' && previous.movementTypes?.length
            ? previous.movementTypes
            : [],
        movementAmountMin: previous.movementAmountMin || previous.amountMin || '',
        movementAmountMax: previous.movementAmountMax || previous.amountMax || '',
        amountMin: previous.amountMin || '',
        amountMax: previous.amountMax || '',
        onlyConfirmed: previous.movementMode === 'classified' ? true : previous.onlyConfirmed || true,
        address: previous.address || '',
      };
    case SUBSCRIPTION_TYPE_IDS.NFT: {
      const goalId = previous.nftGoal || inferNftGoal(previous) || 'sales';
      const goal = NFT_GOALS.find((g) => g.id === goalId) || NFT_GOALS[0];
      return {
        ...base,
        collectionIdentifier: previous.collectionIdentifier || '',
        address: previous.address || '',
        nftGoal: goal.id,
        ...goal.filters,
      };
    }
    case SUBSCRIPTION_TYPE_IDS.WALLET:
      return {
        ...base,
        address: previous.address || previous.sender || previous.receiver || '',
        onlyConfirmed: true,
      };
    case SUBSCRIPTION_TYPE_IDS.CUSTOM:
    default:
      return {
        ...previous,
        nftGoal: previous.nftGoal || inferNftGoal(previous),
      };
  }
}

export function applyNftGoal(filters, goalId) {
  const goal = NFT_GOALS.find((g) => g.id === goalId) || NFT_GOALS[0];
  return {
    ...filters,
    nftGoal: goal.id,
    ...goal.filters,
  };
}

/**
 * Strip UI-only keys and build API filters object.
 */
export function buildApiFilters(filters, watchType) {
  const f = {};
  const classified = filters.movementMode === 'classified';

  if (filters.sender) f.sender = filters.sender;
  if (filters.receiver) f.receiver = filters.receiver;
  if (filters.address) f.address = filters.address;
  if (filters.egldOnly || watchType === SUBSCRIPTION_TYPE_IDS.EGLD) f.egldOnly = true;
  if (filters.function) f.function = filters.function;
  if (filters.matchTopLevelOnly) f.matchTopLevelOnly = true;
  if (filters.transactionType) f.transactionType = filters.transactionType;
  if (filters.tokenIdentifier) f.tokenIdentifier = filters.tokenIdentifier.trim();
  if (filters.collectionIdentifier) f.collectionIdentifier = filters.collectionIdentifier.trim();

  if (classified) {
    f.movementMode = 'classified';
    f.movementTypes = Array.isArray(filters.movementTypes) ? filters.movementTypes : [];
    if (filters.movementAmountMin !== '') f.movementAmountMin = filters.movementAmountMin;
    if (filters.movementAmountMax !== '') f.movementAmountMax = filters.movementAmountMax;
    f.onlyConfirmed = true;
  } else {
    if (filters.amountMin !== '') f.amountMin = filters.amountMin;
    if (filters.amountMax !== '') f.amountMax = filters.amountMax;
    if (filters.onlyConfirmed) f.onlyConfirmed = true;
  }

  return f;
}

export function validateFiltersForType(watchType, filters) {
  const api = buildApiFilters(filters, watchType);

  if (watchType === SUBSCRIPTION_TYPE_IDS.EGLD) {
    if (!api.egldOnly && !api.address && !api.sender && !api.receiver) {
      return 'Add an address to watch, or keep EGLD-only enabled.';
    }
  }
  if (watchType === SUBSCRIPTION_TYPE_IDS.TOKEN) {
    if (!api.tokenIdentifier) return 'Enter a token identifier (e.g. REWARD-cf6eac).';
    if (api.movementMode === 'classified' && (!api.movementTypes || api.movementTypes.length === 0)) {
      return 'Select at least one movement type (BUY, SELL, or OTHER).';
    }
  }
  if (watchType === SUBSCRIPTION_TYPE_IDS.NFT) {
    if (!api.collectionIdentifier) return 'Enter an NFT collection identifier (e.g. PITTZ-1a4c2d).';
  }
  if (watchType === SUBSCRIPTION_TYPE_IDS.WALLET) {
    if (!api.address && !api.sender && !api.receiver) {
      return 'Enter a wallet or contract address to watch.';
    }
  }
  if (Object.keys(api).length === 0) {
    return 'At least one filter is required.';
  }
  return '';
}

/**
 * Human-readable summary for the live preview panel.
 */
export function buildSubscriptionSummary({ watchType, filters, network }) {
  const lines = [];
  const net = network || 'mainnet';
  lines.push(`Network: ${net}`);

  switch (watchType) {
    case SUBSCRIPTION_TYPE_IDS.EGLD: {
      const who = filters.address || filters.sender || filters.receiver;
      lines.push(who ? `Watch EGLD activity for ${truncateAddr(who)}` : 'Watch native EGLD transfers');
      if (filters.amountMin || filters.amountMax) {
        lines.push(
          `Amount: ${filters.amountMin || '0'} – ${filters.amountMax || '∞'} EGLD`
        );
      }
      break;
    }
    case SUBSCRIPTION_TYPE_IDS.TOKEN: {
      const token = filters.tokenIdentifier || '(token)';
      if (filters.movementMode === 'classified') {
        const types = (filters.movementTypes || []).join(', ') || '—';
        lines.push(`Classified ${types} for ${token}`);
      } else {
        lines.push(`Raw token activity for ${token}`);
      }
      if (filters.address) lines.push(`Related to ${truncateAddr(filters.address)}`);
      break;
    }
    case SUBSCRIPTION_TYPE_IDS.NFT: {
      const col = filters.collectionIdentifier || '(collection)';
      const goal = NFT_GOALS.find((g) => g.id === filters.nftGoal) || NFT_GOALS[0];
      lines.push(`NFT ${goal.label.toLowerCase()} for ${col}`);
      if (filters.address) lines.push(`Marketplace / contract: ${truncateAddr(filters.address)}`);
      if (filters.function) lines.push(`Function: ${filters.function}`);
      break;
    }
    case SUBSCRIPTION_TYPE_IDS.WALLET: {
      const who = filters.address || filters.sender || filters.receiver || '(address)';
      lines.push(`Any activity involving ${truncateAddr(who)}`);
      break;
    }
    default: {
      const parts = [];
      if (filters.address) parts.push(`address ${truncateAddr(filters.address)}`);
      if (filters.sender) parts.push(`sender ${truncateAddr(filters.sender)}`);
      if (filters.receiver) parts.push(`receiver ${truncateAddr(filters.receiver)}`);
      if (filters.tokenIdentifier) parts.push(`token ${filters.tokenIdentifier}`);
      if (filters.collectionIdentifier) parts.push(`collection ${filters.collectionIdentifier}`);
      if (filters.function) parts.push(`function ${filters.function}`);
      if (filters.egldOnly) parts.push('EGLD only');
      lines.push(parts.length ? `Custom: ${parts.join(', ')}` : 'Custom filters (incomplete)');
    }
  }

  const confirmed =
    filters.movementMode === 'classified' || filters.onlyConfirmed
      ? 'Confirmed only (recommended)'
      : 'Pending + confirmed';
  lines.push(`Delivery: ${confirmed}`);
  return lines;
}

function truncateAddr(addr) {
  const s = String(addr);
  if (s.length <= 16) return s;
  return `${s.slice(0, 8)}…${s.slice(-6)}`;
}

export function parseFiltersFromSubscription(raw) {
  const f = typeof raw === 'object' && raw ? raw : {};
  const filters = {
    ...emptyFilters(),
    sender: f.sender || '',
    receiver: f.receiver || '',
    address: f.address || '',
    egldOnly: !!(f.egldOnly || f.token === 'EGLD' || f.token === 'EGLD-000000'),
    function: f.function || '',
    matchTopLevelOnly: !!f.matchTopLevelOnly,
    transactionType: f.transactionType || '',
    tokenIdentifier: f.tokenIdentifier || '',
    collectionIdentifier: f.collectionIdentifier || '',
    amountMin: f.amountMin ?? '',
    amountMax: f.amountMax ?? '',
    onlyConfirmed: !!f.onlyConfirmed,
    movementMode: f.movementMode === 'classified' ? 'classified' : '',
    movementTypes: Array.isArray(f.movementTypes) ? f.movementTypes : [],
    movementAmountMin: f.movementAmountMin ?? '',
    movementAmountMax: f.movementAmountMax ?? '',
  };
  filters.nftGoal = inferNftGoal(filters);
  return filters;
}
