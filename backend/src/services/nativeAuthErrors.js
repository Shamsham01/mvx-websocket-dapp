const { parseRetryAfterSeconds } = require('../utils/retryAfter');

const INVALID_TOKEN_ERRORS = new Set([
  'NativeAuthInvalidTokenError',
  'NativeAuthInvalidTokenTtlError',
  'NativeAuthInvalidSignatureError',
  'NativeAuthInvalidBlockHashError',
  'NativeAuthTokenExpiredError',
  'NativeAuthInvalidImpersonateError',
]);

const ORIGIN_ERRORS = new Set([
  'NativeAuthOriginNotAcceptedError',
]);

const UPSTREAM_NETWORK_CODES = new Set([
  'ECONNABORTED',
  'ETIMEDOUT',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ERR_NETWORK',
  'MVX_QUEUE_TIMEOUT',
]);

const BUSY_MESSAGE =
  'MultiversX authentication services are temporarily busy. Please try again shortly.';
const UNAVAILABLE_MESSAGE =
  'MultiversX authentication services are temporarily unavailable. Please try again shortly.';

/**
 * SDK errors extend Error without setting `name`, so `error.name` stays "Error".
 * The class name is on `constructor.name` in this process.
 */
function nativeAuthErrorName(error) {
  const ctor = error?.constructor?.name || '';
  const named = typeof error?.name === 'string' ? error.name : '';
  if (ctor.startsWith('NativeAuth')) return ctor;
  if (named.startsWith('NativeAuth')) return named;
  return '';
}

function isUpstreamError(error) {
  if (!error || typeof error !== 'object') return false;
  if (error.isAxiosError) return true;
  if (error.response && typeof error.response.status === 'number') return true;
  if (UPSTREAM_NETWORK_CODES.has(error.code)) return true;
  return false;
}

function findUpstream(error) {
  const seen = new Set();
  const queue = [error];
  let depth = 0;
  while (queue.length && depth < 8) {
    const current = queue.shift();
    depth += 1;
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    if (nativeAuthErrorName(current)) continue;
    if (isUpstreamError(current)) return current;
    if (current.cause) queue.push(current.cause);
    if (current.originalError) queue.push(current.originalError);
    if (current.innerError) queue.push(current.innerError);
    if (Array.isArray(current.errors)) queue.push(...current.errors);
  }
  return null;
}

function retryAfterHeader(error) {
  const headers = error?.response?.headers;
  if (!headers) return null;
  return headers['retry-after'] || headers['Retry-After'] || null;
}

function invalidToken() {
  return {
    status: 401,
    retryAfter: null,
    retryAfterSeconds: null,
    body: {
      error: 'Invalid or expired access token.',
      code: 'invalid_token',
    },
  };
}

function classifyUpstream(error) {
  const status = error.response?.status;
  const header = retryAfterHeader(error);
  const retryAfterSeconds = parseRetryAfterSeconds(header);
  const retryAfter = retryAfterSeconds != null ? String(Math.ceil(retryAfterSeconds)) : null;

  if (status === 404) return invalidToken();

  const rateLimited = status === 429;
  const unavailable = rateLimited
    || status === 408
    || status === 502
    || status === 503
    || status === 504
    || error.code === 'MVX_QUEUE_TIMEOUT'
    || (!status && UPSTREAM_NETWORK_CODES.has(error.code))
    || (status >= 500);

  if (rateLimited || unavailable) {
    let seconds = retryAfterSeconds != null ? Math.ceil(retryAfterSeconds) : null;
    if (seconds == null && rateLimited) seconds = 30;
    const body = {
      error: rateLimited ? BUSY_MESSAGE : UNAVAILABLE_MESSAGE,
      code: rateLimited ? 'upstream_rate_limited' : 'upstream_unavailable',
    };
    if (seconds != null) body.retryAfterSeconds = seconds;
    return {
      status: 503,
      retryAfter: seconds != null ? String(seconds) : null,
      retryAfterSeconds: seconds,
      body,
    };
  }

  if (status >= 400 && status < 500) {
    return {
      status: 503,
      retryAfter: null,
      retryAfterSeconds: null,
      body: {
        error: UNAVAILABLE_MESSAGE,
        code: 'upstream_unavailable',
      },
    };
  }

  return {
    status: 500,
    retryAfter: null,
    retryAfterSeconds: null,
    body: {
      error: 'Internal server error',
      code: 'internal_error',
    },
  };
}

function classifyNativeAuthError(error) {
  const name = nativeAuthErrorName(error);
  if (ORIGIN_ERRORS.has(name)) {
    return {
      status: 403,
      retryAfter: null,
      retryAfterSeconds: null,
      body: {
        error: 'Wallet login origin is not accepted.',
        code: 'origin_not_accepted',
      },
    };
  }
  if (INVALID_TOKEN_ERRORS.has(name)) return invalidToken();

  const upstream = isUpstreamError(error) && !name ? error : findUpstream(error);
  if (upstream) return classifyUpstream(upstream);

  return {
    status: 500,
    retryAfter: null,
    retryAfterSeconds: null,
    body: {
      error: 'Internal server error',
      code: 'internal_error',
    },
  };
}

module.exports = {
  BUSY_MESSAGE,
  UNAVAILABLE_MESSAGE,
  classifyNativeAuthError,
  nativeAuthErrorName,
};
