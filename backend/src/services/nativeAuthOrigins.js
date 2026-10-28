/**
 * Exact Native Auth origins. The SDK treats any entry containing `*` as a wildcard,
 * and a lone `*` matches every origin. This builder never emits a wildcard.
 */

const LOCAL_DEV_ORIGINS = ['http://localhost:3000', 'https://localhost:3000'];

function parseOrigin(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('*')) return null;
  let url;
  try {
    url = new URL(trimmed);
  } catch (_) {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== '/' && url.pathname !== '') return null;
  return url.origin;
}

function isLocalOrigin(origin) {
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
  } catch (_) {
    return false;
  }
}

function buildAcceptedOrigins(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const origins = [];
  const add = (origin) => {
    if (!origin || origins.includes(origin)) return;
    if (production && isLocalOrigin(origin)) return;
    origins.push(origin);
  };

  add(parseOrigin(env.FRONTEND_URL));
  String(env.NATIVE_AUTH_ACCEPTED_ORIGINS || '')
    .split(',')
    .forEach((part) => add(parseOrigin(part)));

  if (!production) {
    LOCAL_DEV_ORIGINS.forEach((origin) => add(parseOrigin(origin)));
  }

  return origins;
}

module.exports = {
  LOCAL_DEV_ORIGINS,
  parseOrigin,
  isLocalOrigin,
  buildAcceptedOrigins,
};
