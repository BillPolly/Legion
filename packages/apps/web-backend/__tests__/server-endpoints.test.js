import { jest } from '@jest/globals';
import request from 'supertest';
import { ChatServer } from '../src/server.js';

// Mock WebSocketHandler
jest.mock('../src/websocket-handler.js', () => ({
  WebSocketHandler: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    getStats: jest.fn().mockReturnValue({
      activeConnections: 0,
      totalConnectionsCreated: 0,
      connections: []
    }),
    destroy: jest.fn()
  }))
}));

// Mock module loader
jest.mock('@jsenvoy/module-loader', () => ({
  ResourceManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    register: jest.fn(),
    has: jest.fn().mockReturnValue(false),
    get: jest.fn()
  })),
  ModuleFactory: jest.fn().mockImplementation(() => ({}))
}));

describe('ChatServer Endpoints', () => {
  let server;
  let app;

  beforeEach(async () => {
    server = new ChatServer();
    await server.initializeResources();
    server.setupMiddleware();
    server.setupRoutes();
    app = server.app;
  });

  test('GET /health returns 200', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
  });

  test('GET /api/stats returns WebSocket stats', async () => {
    const response = await request(app)
      .get('/api/stats')
      .expect(200);

    expect(response.body).toHaveProperty('activeConnections', 0);
    expect(response.body).toHaveProperty('totalConnectionsCreated', 0);
    expect(response.body).toHaveProperty('connections');
  });

  test('GET /nonexistent returns 404', async () => {
    await request(app)
      .get('/nonexistent')
      .expect(200); // This returns index.html for SPA routing
  });

  test('GET /api/nonexistent returns 404', async () => {
    const response = await request(app)
      .get('/api/nonexistent')
      .expect(404);

    expect(response.body).toHaveProperty('error', 'Not found');
  });
});