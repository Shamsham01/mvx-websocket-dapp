const express = require('express');
const request = require('supertest');

jest.mock('../config/database', () => ({
  get: jest.fn(),
  run: jest.fn(),
  query: jest.fn(),
}));

jest.mock('@multiversx/sdk-native-auth-server', () => {
  const actual = jest.requireActual('@multiversx/sdk-native-auth-server');
  return {
    ...actual,
    NativeAuthServer: jest.fn().mockImplementation(() => ({
      validate: (...args) => global.__nativeValidate(...args),
    })),
  };
});

const {
  NativeAuthInvalidSignatureError,
  NativeAuthTokenExpiredError,
  NativeAuthOriginNotAcceptedError,
  NativeAuthInvalidBlockHashError,
} = require('@multiversx/sdk-native-auth-server');
const database = require('../config/database');
const authRoutes = require('../routes/auth');
const { resetNativeAuthGateForTests } = require('../services/nativeAuthGate');
const { BUSY_MESSAGE, UNAVAILABLE_MESSAGE } = require('../services/nativeAuthErrors');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
}

const ACCESS_TOKEN = 'erd1example.native-body.signature';

describe('POST /api/auth/login/native', () => {
  let app;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  beforeEach(() => {
    resetNativeAuthGateForTests();
    database.get.mockReset();
    database.run.mockReset();
    global.__nativeValidate = jest.fn();
    app = buildApp();
  });

  it('classifies an invalid signature as 401 without leaking the token', async () => {
    global.__nativeValidate.mockRejectedValue(new NativeAuthInvalidSignatureError());
    const res = await request(app).post('/api/auth/login/native').send({ accessToken: ACCESS_TOKEN });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: 'Invalid or expired access token.',
      code: 'invalid_token',
    });
    expect(JSON.stringify(res.body)).not.toContain(ACCESS_TOKEN);
    expect(res.body.stack).toBeUndefined();
    expect(database.run).not.toHaveBeenCalled();
    expect(global.__nativeValidate).toHaveBeenCalledTimes(1);
  });

  it('keeps expired tokens and bad block hashes rejected', async () => {
    global.__nativeValidate.mockRejectedValueOnce(new NativeAuthTokenExpiredError());
    const expired = await request(app).post('/api/auth/login/native').send({ accessToken: 'expired-token' });
    expect(expired.status).toBe(401);
    expect(expired.body.code).toBe('invalid_token');

    resetNativeAuthGateForTests();
    global.__nativeValidate.mockRejectedValueOnce(new NativeAuthInvalidBlockHashError());
    const block = await request(app).post('/api/auth/login/native').send({ accessToken: 'bad-block-token' });
    expect(block.status).toBe(401);
    expect(block.body.error).toBe('Invalid or expired access token.');
  });

  it('classifies a rejected origin as 403', async () => {
    global.__nativeValidate.mockRejectedValue(new NativeAuthOriginNotAcceptedError());
    const res = await request(app).post('/api/auth/login/native').send({ accessToken: ACCESS_TOKEN });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('origin_not_accepted');
    expect(JSON.stringify(res.body)).not.toContain(ACCESS_TOKEN);
  });

  it('classifies upstream HTTP 429 as 503 and does not call MultiversX again for the same token', async () => {
    const axiosError = new Error('Request failed with status code 429');
    axiosError.isAxiosError = true;
    axiosError.response = {
      status: 429,
      headers: { 'retry-after': '30' },
      data: '<html>error code: 1015</html>',
    };
    const wrapped = new Error('validation failed');
    wrapped.cause = axiosError;
    global.__nativeValidate.mockRejectedValue(wrapped);

    const first = await request(app).post('/api/auth/login/native').send({ accessToken: ACCESS_TOKEN });
    const second = await request(app).post('/api/auth/login/native').send({ accessToken: ACCESS_TOKEN });

    expect(first.status).toBe(503);
    expect(first.headers['retry-after']).toBe('30');
    expect(first.body).toMatchObject({
      error: BUSY_MESSAGE,
      code: 'upstream_rate_limited',
      retryAfterSeconds: 30,
    });
    expect(JSON.stringify(first.body)).not.toMatch(/1015|stack|signature/i);
    expect(JSON.stringify(first.body)).not.toContain(ACCESS_TOKEN);
    expect(second.status).toBe(503);
    expect(global.__nativeValidate).toHaveBeenCalledTimes(1);
  });

  it('classifies upstream timeouts as 503', async () => {
    const axiosError = new Error('timeout');
    axiosError.isAxiosError = true;
    axiosError.code = 'ECONNABORTED';
    global.__nativeValidate.mockRejectedValue(axiosError);
    const res = await request(app).post('/api/auth/login/native').send({ accessToken: ACCESS_TOKEN });
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      error: UNAVAILABLE_MESSAGE,
      code: 'upstream_unavailable',
    });
    expect(res.body.stack).toBeUndefined();
  });

  it('classifies unexpected failures as 500 and still rejects duplicate invalid attempts', async () => {
    global.__nativeValidate.mockRejectedValue(new Error('disk failed SECRET'));
    const res = await request(app).post('/api/auth/login/native').send({ accessToken: ACCESS_TOKEN });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error', code: 'internal_error' });
    expect(JSON.stringify(res.body)).not.toContain('SECRET');

    global.__nativeValidate.mockResolvedValue({ address: 'erd1user' });
    database.get.mockRejectedValue(new Error('db down SECRET'));
    resetNativeAuthGateForTests();
    const session = await request(app).post('/api/auth/login/native').send({ accessToken: 'other-token' });
    expect(session.status).toBe(500);
    expect(JSON.stringify(session.body)).not.toContain('SECRET');
  });

  it('shares one validation across concurrent posts of the same failed token', async () => {
    let release;
    global.__nativeValidate.mockImplementation(() => new Promise((_resolve, reject) => {
      release = () => reject(new NativeAuthInvalidSignatureError());
    }));
    const pending = Promise.all(
      Array.from({ length: 5 }, () => (
        request(app).post('/api/auth/login/native').send({ accessToken: ACCESS_TOKEN })
      ))
    );
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(global.__nativeValidate).toHaveBeenCalledTimes(1);
    release();
    const responses = await pending;
    responses.forEach((res) => {
      expect(res.status).toBe(401);
      expect(JSON.stringify(res.body)).not.toContain(ACCESS_TOKEN);
    });
    expect(global.__nativeValidate).toHaveBeenCalledTimes(1);
  });

  it('issues a session after a valid token and collapses a second validation', async () => {
    global.__nativeValidate.mockResolvedValue({ address: 'erd1user' });
    database.get.mockResolvedValue(null);
    database.run.mockResolvedValue({ id: 9 });
    const first = await request(app).post('/api/auth/login/native').send({ accessToken: ACCESS_TOKEN });
    const second = await request(app).post('/api/auth/login/native').send({ accessToken: ACCESS_TOKEN });
    expect(first.status).toBe(200);
    expect(first.body.user).toEqual({ id: 9, address: 'erd1user' });
    expect(first.body.token).toEqual(expect.any(String));
    expect(second.status).toBe(200);
    expect(global.__nativeValidate).toHaveBeenCalledTimes(1);
  });

  it('disables legacy login in production and leaves it unavailable as an auth bypass', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await request(app).post('/api/auth/login').send({
        address: 'erd1user',
        signature: 'abcd',
        message: 'login',
      });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('legacy_login_disabled');
      expect(database.run).not.toHaveBeenCalled();
      expect(global.__nativeValidate).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
