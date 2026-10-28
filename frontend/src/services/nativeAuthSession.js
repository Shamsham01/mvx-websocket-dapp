/**
 * One Native Auth attempt shared by every component.
 * Module state survives React StrictMode remounts, so a failed token cannot
 * be posted again until the wallet session is reset or the user retries.
 */

export const MVX_AUTH_BUSY_MESSAGE =
  'MultiversX authentication services are temporarily busy. Please try again shortly.';

export const MVX_AUTH_UNAVAILABLE_MESSAGE =
  'MultiversX authentication services are temporarily unavailable. Please try again shortly.';

let generation = 0;
const inflight = new Map();
const outcomes = new Map();

export function clearNativeAuthSession() {
  generation += 1;
  inflight.clear();
  outcomes.clear();
}

export function parseRetryAfterSeconds(value, now = Date.now()) {
  if (value == null || value === '') return null;
  const raw = Array.isArray(value) ? value[0] : value;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric >= 0) return numeric;
  const when = Date.parse(String(raw));
  if (Number.isFinite(when)) return Math.max(0, (when - now) / 1000);
  return null;
}

export function normalizeAuthError(err) {
  const status = Number(err?.status || err?.response?.status || 0) || null;
  const code = err?.code || null;
  const retryRaw = err?.retryAfterSeconds ?? err?.retryAfter ?? err?.response?.headers?.['retry-after'];
  const retryAfterSeconds = parseRetryAfterSeconds(retryRaw);
  const retryAt = retryAfterSeconds != null ? Date.now() + retryAfterSeconds * 1000 : null;

  if (code === 'upstream_rate_limited' || status === 429) {
    return {
      message: MVX_AUTH_BUSY_MESSAGE,
      code: 'upstream_rate_limited',
      retryAt,
      status: status || 503,
    };
  }
  if (code === 'upstream_unavailable' || status === 503 || status === 502 || status === 504) {
    return {
      message: MVX_AUTH_UNAVAILABLE_MESSAGE,
      code: code || 'upstream_unavailable',
      retryAt,
      status: status || 503,
    };
  }
  if (
    !status &&
    (code === 'ECONNABORTED' ||
      code === 'ERR_NETWORK' ||
      code === 'network_error' ||
      err?.error === 'Network error')
  ) {
    return {
      message: MVX_AUTH_UNAVAILABLE_MESSAGE,
      code: 'network_error',
      retryAt: null,
      status: null,
    };
  }
  if (status === 403 || code === 'origin_not_accepted') {
    return {
      message: 'This site origin is not accepted for wallet login.',
      code: 'origin_not_accepted',
      retryAt: null,
      status: 403,
    };
  }
  if (status === 500 || code === 'internal_error') {
    return {
      message: 'Authentication is temporarily unavailable. Please try again shortly.',
      code: 'internal_error',
      retryAt: null,
      status: 500,
    };
  }
  return {
    message:
      'Wallet authentication was rejected. Disconnect and reconnect your wallet to generate a fresh login.',
    code: code || 'invalid_token',
    retryAt: null,
    status: status || 401,
  };
}

/**
 * @param {string} accessToken
 * @param {{ force?: boolean, request: (token: string) => Promise<any> }} options
 */
export async function runNativeAuthLogin(accessToken, { force = false, request } = {}) {
  if (!accessToken || typeof accessToken !== 'string') {
    throw Object.assign(new Error('Missing Native Auth token'), { code: 'missing_token' });
  }
  if (typeof request !== 'function') {
    throw new Error('Native Auth request handler is required');
  }

  if (!force) {
    const prior = outcomes.get(accessToken);
    if (prior) {
      if (prior.ok) return prior.result;
      throw prior.error;
    }
    const pending = inflight.get(accessToken);
    if (pending) return pending.promise;
  } else {
    outcomes.delete(accessToken);
    const pending = inflight.get(accessToken);
    if (pending) return pending.promise;
  }

  const gen = generation;
  const promise = (async () => {
    try {
      const result = await request(accessToken);
      if (generation === gen) {
        outcomes.set(accessToken, { ok: true, result });
      }
      return result;
    } catch (error) {
      if (generation === gen) {
        outcomes.set(accessToken, { ok: false, error });
      }
      throw error;
    } finally {
      const current = inflight.get(accessToken);
      if (current && current.gen === gen) inflight.delete(accessToken);
    }
  })();
  inflight.set(accessToken, { promise, gen });
  return promise;
}
