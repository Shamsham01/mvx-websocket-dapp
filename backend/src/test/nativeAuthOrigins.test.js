const { buildAcceptedOrigins } = require('../services/nativeAuthOrigins');

describe('Native Auth origin allowlist', () => {
  it('accepts the configured production origin and rejects wildcards and localhost', () => {
    const origins = buildAcceptedOrigins({
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://makex-web3.com',
      NATIVE_AUTH_ACCEPTED_ORIGINS: '*, https://*.netlify.app, https://preview.makex-web3.com',
    });
    expect(origins).toEqual([
      'https://makex-web3.com',
      'https://preview.makex-web3.com',
    ]);
    expect(origins.join(' ')).not.toContain('*');
    expect(origins.some((origin) => origin.includes('localhost'))).toBe(false);
  });

  it('does not keep a localhost FRONTEND_URL in production', () => {
    expect(buildAcceptedOrigins({
      NODE_ENV: 'production',
      FRONTEND_URL: 'http://localhost:3000',
    })).toEqual([]);
  });

  it('adds localhost only outside production', () => {
    expect(buildAcceptedOrigins({
      NODE_ENV: 'development',
      FRONTEND_URL: 'https://makex-web3.com/',
    })).toEqual([
      'https://makex-web3.com',
      'http://localhost:3000',
      'https://localhost:3000',
    ]);
  });
});
