const request = require('supertest');
const app = require('../index');

describe('MultiversX WebSocket DApp API', () => {
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('healthy');
    });
  });

  describe('API Documentation', () => {
    it('should return API documentation', async () => {
      const res = await request(app).get('/api');
      expect(res.statusCode).toBe(200);
      expect(res.body.name).toBe('MultiversX WebSocket Subscription API');
      expect(res.body.endpoints).toBeDefined();
    });
  });

  describe('Authentication', () => {
    it('should require authentication for protected routes', async () => {
      const res = await request(app).get('/api/subscriptions');
      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });
  });
});