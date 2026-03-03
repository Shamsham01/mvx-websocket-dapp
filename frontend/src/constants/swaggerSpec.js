const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'MakeX WebSocket API',
    description:
      'API reference for MakeX subscription management, webhook analytics, and account operations.',
    version: '1.0.0',
    contact: {
      name: 'MakeX'
    }
  },
  servers: [
    {
      url: API_BASE,
      description: 'Active API Base URL'
    }
  ],
  tags: [
    { name: 'Auth', description: 'Wallet authentication and account access.' },
    { name: 'Subscriptions', description: 'Subscribe, edit filters, pause, and unsubscribe.' },
    { name: 'Webhooks', description: 'Webhook validation, deliveries, and tests.' },
    { name: 'Analytics', description: 'Dashboard analytics and performance data.' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Invalid token' }
        }
      },
      SubscriptionFilters: {
        type: 'object',
        additionalProperties: true,
        example: {
          sender: 'erd1...',
          receiver: 'erd1...',
          token: 'EGLD',
          tokenIdentifier: 'REWARD-cf6eac',
          function: 'swap'
        }
      },
      Subscription: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 12 },
          user_id: { type: 'integer', example: 5 },
          name: { type: 'string', example: 'Treasury Incoming Transfers' },
          webhook_url: { type: 'string', format: 'uri', example: 'https://example.com/webhook' },
          filters: { $ref: '#/components/schemas/SubscriptionFilters' },
          network: { type: 'string', example: 'mainnet' },
          is_active: { type: 'boolean', example: true },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      }
    }
  },
  paths: {
    '/auth/login/native': {
      post: {
        tags: ['Auth'],
        summary: 'Login with MultiversX Native Auth token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['accessToken'],
                properties: {
                  accessToken: { type: 'string', description: 'Native Auth access token from wallet login.' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Authenticated successfully.' },
          401: { description: 'Invalid or expired access token.' }
        }
      }
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user and high-level stats',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Current user profile and summary stats.' },
          401: { description: 'Unauthorized.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
        }
      }
    },
    '/auth/dashboard-analytics': {
      get: {
        tags: ['Analytics'],
        summary: 'Get dashboard metrics and chart datasets',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Returns stat cards and chart data for the authenticated user.' },
          401: { description: 'Unauthorized.' }
        }
      }
    },
    '/subscriptions': {
      get: {
        tags: ['Subscriptions'],
        summary: 'List all subscriptions for current user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Subscription list.' },
          401: { description: 'Unauthorized.' }
        }
      },
      post: {
        tags: ['Subscriptions'],
        summary: 'Create a new subscription',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'webhook_url', 'filters'],
                properties: {
                  name: { type: 'string', example: 'USDC Monitor' },
                  webhook_url: { type: 'string', format: 'uri', example: 'https://example.com/hooks/makex' },
                  filters: { $ref: '#/components/schemas/SubscriptionFilters' },
                  network: { type: 'string', enum: ['mainnet', 'testnet', 'devnet'], example: 'mainnet' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Subscription created.' },
          400: { description: 'Validation error.' },
          401: { description: 'Unauthorized.' }
        }
      }
    },
    '/subscriptions/{id}': {
      get: {
        tags: ['Subscriptions'],
        summary: 'Get one subscription by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          200: { description: 'Subscription record.' },
          404: { description: 'Subscription not found.' }
        }
      },
      put: {
        tags: ['Subscriptions'],
        summary: 'Edit a subscription (filters/events/webhook/network/state)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  webhook_url: { type: 'string', format: 'uri' },
                  filters: { $ref: '#/components/schemas/SubscriptionFilters' },
                  network: { type: 'string', enum: ['mainnet', 'testnet', 'devnet'] },
                  is_active: { type: 'boolean' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Subscription updated.' },
          404: { description: 'Subscription not found.' }
        }
      },
      delete: {
        tags: ['Subscriptions'],
        summary: 'Delete a subscription (unsubscribe)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          200: { description: 'Subscription deleted.' },
          404: { description: 'Subscription not found.' }
        }
      }
    },
    '/subscriptions/{id}/toggle': {
      post: {
        tags: ['Subscriptions'],
        summary: 'Pause or resume a subscription',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['is_active'],
                properties: {
                  is_active: { type: 'boolean', example: false }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Subscription activation state updated.' },
          400: { description: 'Invalid body payload.' }
        }
      }
    },
    '/webhooks/validate': {
      post: {
        tags: ['Webhooks'],
        summary: 'Validate webhook URL before saving',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['url'],
                properties: {
                  url: { type: 'string', format: 'uri' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Validation result.' },
          400: { description: 'URL missing/invalid.' }
        }
      }
    },
    '/webhooks/stats/{subscriptionId}': {
      get: {
        tags: ['Webhooks'],
        summary: 'Get webhook delivery statistics for a subscription',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'subscriptionId',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          200: { description: 'Webhook stats returned.' },
          404: { description: 'Subscription not found.' }
        }
      }
    },
    '/webhooks/test/{subscriptionId}': {
      post: {
        tags: ['Webhooks'],
        summary: 'Send a manual test webhook',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'subscriptionId',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          200: { description: 'Test delivery sent.' },
          404: { description: 'Subscription not found.' }
        }
      }
    },
    '/webhooks/deliveries': {
      get: {
        tags: ['Webhooks'],
        summary: 'Get recent webhook deliveries for current user',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50 }
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', default: 0 }
          }
        ],
        responses: {
          200: { description: 'Delivery logs returned.' }
        }
      }
    }
  }
};

export default swaggerSpec;
