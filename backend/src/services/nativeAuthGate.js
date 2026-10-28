const crypto = require('crypto');
const { classifyNativeAuthError } = require('./nativeAuthErrors');

const SUCCESS_TTL_MS = 15 * 1000;
const INVALID_TTL_MS = 10 * 60 * 1000;
const MAX_DECISIONS = 5000;

const decisions = new Map();
const inflight = new Map();

function tokenKey(accessToken) {
  return crypto.createHash('sha256').update(String(accessToken)).digest('hex');
}

function remember(key, entry) {
  if (decisions.has(key)) decisions.delete(key);
  decisions.set(key, entry);
  while (decisions.size > MAX_DECISIONS) {
    const oldest = decisions.keys().next().value;
    decisions.delete(oldest);
  }
}

/**
 * Collapse repeated validation of the same Native Auth token.
 * Invalid tokens and upstream cooling periods are remembered so a looping
 * client cannot multiply calls to the public MultiversX API.
 * The raw token is not stored.
 */
function validateNativeAuth(accessToken, validateFn) {
  const key = tokenKey(accessToken);
  const cached = decisions.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.ok) return Promise.resolve(cached.result);
    return Promise.reject(cached.error);
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const result = await validateFn(accessToken);
      remember(key, { ok: true, result, expiresAt: Date.now() + SUCCESS_TTL_MS });
      return result;
    } catch (error) {
      const classified = classifyNativeAuthError(error);
      if (classified.status === 401 || classified.status === 403) {
        remember(key, { ok: false, error, expiresAt: Date.now() + INVALID_TTL_MS });
      } else if (classified.status === 503) {
        const seconds = classified.retryAfterSeconds ?? 5;
        const ttl = Math.min(Math.max(Number(seconds) || 5, 1), 60) * 1000;
        remember(key, { ok: false, error, expiresAt: Date.now() + ttl });
      }
      throw error;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

function resetNativeAuthGateForTests() {
  decisions.clear();
  inflight.clear();
}

module.exports = {
  validateNativeAuth,
  resetNativeAuthGateForTests,
};
