import {
  clearNativeAuthSession,
  MVX_AUTH_BUSY_MESSAGE,
  normalizeAuthError,
  runNativeAuthLogin,
} from './nativeAuthSession';

describe('nativeAuthSession', () => {
  beforeEach(() => {
    clearNativeAuthSession();
  });

  it('sends one request for concurrent callers and does not repeat a success', async () => {
    let release;
    const request = jest.fn(() => new Promise((resolve) => {
      release = resolve;
    }));
    const first = runNativeAuthLogin('token-a', { request });
    const second = runNativeAuthLogin('token-a', { request });
    expect(request).toHaveBeenCalledTimes(1);
    release({ token: 'jwt', user: { id: 1 } });
    await expect(Promise.all([first, second])).resolves.toEqual([
      { token: 'jwt', user: { id: 1 } },
      { token: 'jwt', user: { id: 1 } },
    ]);
    await runNativeAuthLogin('token-a', { request });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not automatically retry a rejected token', async () => {
    const failure = { status: 401, code: 'invalid_token', error: 'Invalid or expired access token.' };
    const request = jest.fn().mockRejectedValue(failure);
    await expect(runNativeAuthLogin('token-a', { request })).rejects.toBe(failure);
    await expect(runNativeAuthLogin('token-a', { request })).rejects.toBe(failure);
    await expect(runNativeAuthLogin('token-a', { force: false, request })).rejects.toBe(failure);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not fan out upstream rate-limit failures', async () => {
    const failure = {
      status: 503,
      code: 'upstream_rate_limited',
      error: MVX_AUTH_BUSY_MESSAGE,
      retryAfter: '30',
    };
    const request = jest.fn().mockRejectedValue(failure);
    const attempts = Array.from({ length: 6 }, () => (
      runNativeAuthLogin('token-a', { request }).catch((error) => error)
    ));
    const results = await Promise.all(attempts);
    expect(request).toHaveBeenCalledTimes(1);
    results.forEach((result) => {
      expect(normalizeAuthError(result).message).toBe(MVX_AUTH_BUSY_MESSAGE);
    });
  });

  it('allows one fresh request after an explicit retry or wallet reset', async () => {
    const request = jest.fn()
      .mockRejectedValueOnce({ status: 401, code: 'invalid_token' })
      .mockResolvedValue({ token: 'jwt-2', user: { id: 2 } });
    await expect(runNativeAuthLogin('token-a', { request })).rejects.toMatchObject({ status: 401 });
    await expect(runNativeAuthLogin('token-a', { force: true, request })).resolves.toMatchObject({
      token: 'jwt-2',
    });
    expect(request).toHaveBeenCalledTimes(2);

    clearNativeAuthSession();
    await runNativeAuthLogin('token-a', { request });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('does not deduplicate different tokens', async () => {
    const request = jest.fn(async (token) => ({ token, user: { id: token } }));
    await Promise.all([
      runNativeAuthLogin('token-a', { request }),
      runNativeAuthLogin('token-b', { request }),
    ]);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
