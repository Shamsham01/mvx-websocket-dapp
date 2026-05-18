const axios = require('axios');
const logger = require('../utils/logger');
const { parseJson } = require('../utils/parseJson');

const apiEndpoints = {
  mainnet: process.env.MVX_API_MAINNET || 'https://api.multiversx.com',
  testnet: process.env.MVX_API_TESTNET || 'https://testnet-api.multiversx.com',
  devnet: process.env.MVX_API_DEVNET || 'https://devnet-api.multiversx.com',
};

/** @type {Map<string, number>} `${network}:${tokenId}` → decimals */
const decimalsCache = new Map();

function cacheKey(network, tokenIdentifier) {
  return `${network}:${String(tokenIdentifier).trim().toLowerCase()}`;
}

function isValidDecimals(decimals) {
  return Number.isInteger(decimals) && decimals >= 0 && decimals <= 18;
}

/**
 * Fetch ESDT decimals from MultiversX REST (authoritative for amount filters).
 * @returns {Promise<number>}
 */
async function fetchTokenDecimals(tokenIdentifier, network = 'mainnet') {
  const apiUrl = apiEndpoints[network];
  const id = typeof tokenIdentifier === 'string' ? tokenIdentifier.trim() : '';
  if (!apiUrl || !id) return 18;

  const key = cacheKey(network, id);
  if (decimalsCache.has(key)) {
    return decimalsCache.get(key);
  }

  try {
    const response = await axios.get(`${apiUrl}/tokens/${encodeURIComponent(id)}`, {
      timeout: 10000,
    });
    const decimals = response.data?.decimals;
    if (isValidDecimals(decimals)) {
      decimalsCache.set(key, decimals);
      logger.info(`Token ${id} on ${network}: decimals=${decimals}`);
      return decimals;
    }
    logger.warn(`Token ${id}: unexpected decimals=${decimals}, defaulting to 18`);
  } catch (err) {
    logger.warn(`Token ${id} metadata fetch failed (${network}): ${err.message}; defaulting to 18`);
  }

  decimalsCache.set(key, 18);
  return 18;
}

/**
 * Resolve decimals for amount filters (sync when cached, else undefined).
 */
function getCachedTokenDecimals(tokenIdentifier, network = 'mainnet') {
  const key = cacheKey(network, tokenIdentifier);
  return decimalsCache.get(key);
}

/**
 * Persist tokenDecimals on filters whenever tokenIdentifier is set.
 */
async function enrichFiltersWithTokenDecimals(filters, network = 'mainnet') {
  if (!filters || typeof filters !== 'object') return filters;

  const tokenId =
    typeof filters.tokenIdentifier === 'string' ? filters.tokenIdentifier.trim() : '';
  if (!tokenId) {
    const next = { ...filters };
    delete next.tokenDecimals;
    return next;
  }

  const tokenDecimals = await fetchTokenDecimals(tokenId, network);
  return { ...filters, tokenDecimals };
}

/**
 * Ensure each subscription has chain-accurate tokenDecimals before amount matching.
 * Fetches from API when missing (e.g. legacy subs saved before decimals were stored).
 */
async function hydrateSubscriptionFilters(subscriptions, network = 'mainnet') {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return subscriptions;
  }

  return Promise.all(
    subscriptions.map(async (sub) => {
      const filters = parseJson(sub.filters);
      if (!filters || typeof filters !== 'object' || !filters.tokenIdentifier) {
        return sub;
      }

      const tokenId = String(filters.tokenIdentifier).trim();
      const stored = Number(filters.tokenDecimals);
      let tokenDecimals = isValidDecimals(stored) ? stored : undefined;

      if (tokenDecimals === undefined) {
        tokenDecimals = await fetchTokenDecimals(tokenId, network);
        logger.info(
          `Subscription ${sub.id}: resolved ${tokenId} decimals=${tokenDecimals} for amount filters`
        );
      } else {
        decimalsCache.set(cacheKey(network, tokenId), tokenDecimals);
      }

      return {
        ...sub,
        filters: { ...filters, tokenDecimals },
      };
    })
  );
}

function clearDecimalsCache() {
  decimalsCache.clear();
}

module.exports = {
  fetchTokenDecimals,
  getCachedTokenDecimals,
  enrichFiltersWithTokenDecimals,
  hydrateSubscriptionFilters,
  clearDecimalsCache,
  isValidDecimals,
};
