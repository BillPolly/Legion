import { jest } from '@jest/globals';
import request from 'supertest';
import { ChatServer } from '../src/server.js';

// Store mocked WebSocketHandler instance
let mockWsHandler;

// Mock dependencies
jest.mock('../src/websocket-handler.js', () => ({
  WebSocketHandler: jest.fn().mockImplementation(() => {
    mockWsHandler = {
      initialize: jest.fn(),
      getStats: jest.fn().mockReturnValue({
        activeConnections: 0,
        totalConnectionsCreated: 0,
        connections: []
      }),
      destroy: jest.fn()
    };
    return mockWsHandler;
  })
}));

jest.mock('@jsenvoy/module-loader', () => ({
  ResourceManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    register: jest.fn(),
    has: jest.fn().mockReturnValue(false),
    get: jest.fn()
  })),
  ModuleFactory: jest.fn().mockImplementation(() => ({}))
}));

describe('ChatServer', () => {
  let server;
  let app;

  beforeEach(async () => {
    // Reset mockWsHandler for each test
    mockWsHandler = null;
    
    server = new ChatServer();
    await server.initializeResources();
    server.setupMiddleware();
    server.setupRoutes();
    server.setupWebSocket();
    app = server.app;
  });

  afterEach(async () => {
    // Clear all timers to prevent open handles
    jest.clearAllTimers();
    
    if (server && server.server && server.server.listening) {
      await new Promise((resolve) => {
        server.server.close(() => resolve());
      });
    }
  });

  describe('Health Check Endpoint', () => {
    test('GET /health returns healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        websocket: {
          activeConnections: 0,
          totalConnectionsCreated: 0,
          connections: []
        }
      });
    });
  });

  describe('Stats API Endpoint', () => {
    test('GET /api/stats returns WebSocket statistics', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(response.body).toEqual({
        activeConnections: 0,
        totalConnectionsCreated: 0,
        connections: []
      });
    });
  });

  describe('CORS Headers', () => {
    test('should set CORS headers on responses', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toBe('GET, POST, PUT, DELETE, OPTIONS');
      expect(response.headers['access-control-allow-headers']).toBe('Origin, X-Requested-With, Content-Type, Accept');
    });
  });

  describe('404 Handling', () => {
    test('returns 404 for unknown API routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toEqual({ error: 'Not found' });
    });

    test('returns 404 for WebSocket paths via HTTP', async () => {
      const response = await request(app)
        .get('/ws')
        .expect(404);

      expect(response.body).toEqual({ error: 'Not found' });
    });
  });

  describe('Error Handling', () => {
    test('returns 400 for invalid JSON in POST requests', async () => {
      const response = await request(app)
        .post('/api/test')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      // Express returns a standard error for JSON parse errors
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/JSON/i);
    });

    test('handles malformed JSON with proper error', async () => {
      const response = await request(app)
        .post('/api/nonexistent')
        .set('Content-Type', 'application/json')
        .send('not json at all')
        .expect(400);

      // Express returns a standard error for JSON parse errors
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/JSON/i);
    });
  });

  describe('Server Initialization', () => {
    test('initializes resources correctly', async () => {
      const newServer = new ChatServer();
      await newServer.initializeResources();

      expect(newServer.resourceManager).toBeDefined();
      expect(newServer.moduleFactory).toBeDefined();
      expect(newServer.wsHandler).toBeDefined();
    });

    test('uses default port when env.PORT is not set', async () => {
      const newServer = new ChatServer();
      await newServer.initializeResources();

      expect(newServer.port).toBe(3000);
    });
  });

  describe('Server Start', () => {
    test('starts server successfully', async () => {
      const newServer = new ChatServer();
      await newServer.initializeResources();
      newServer.setupMiddleware();
      newServer.setupRoutes();
      newServer.setupWebSocket();

      await newServer.start();
      expect(newServer.server.listening).toBe(true);

      // Clean up
      await new Promise((resolve) => {
        newServer.server.close(() => resolve());
      });
    });

    test('rejects when port is already in use', async () => {
      const server1 = new ChatServer();
      await server1.initializeResources();
      server1.setupMiddleware();
      server1.setupRoutes();
      server1.setupWebSocket();
      server1.port = 0; // Use random port

      await server1.start();
      const port = server1.server.address().port;

      const server2 = new ChatServer();
      await server2.initializeResources();
      server2.setupMiddleware();
      server2.setupRoutes();
      server2.setupWebSocket();
      server2.port = port; // Use same port

      // Mock the error to avoid actual EADDRINUSE
      server2.server.listen = jest.fn((port, callback) => {
        callback(new Error('EADDRINUSE'));
      });

      await expect(server2.start()).rejects.toThrow('EADDRINUSE');

      // Clean up
      await new Promise((resolve) => {
        server1.server.close(() => resolve());
      });
    });
  });

  describe('Graceful Shutdown', () => {
    beforeEach(() => {
      // Use fake timers for these tests
      jest.useFakeTimers();
    });

    afterEach(() => {
      // Restore real timers
      jest.useRealTimers();
    });

    test('closes WebSocket connections and server on shutdown', () => {
      const closeMock = jest.fn((callback) => callback());
      server.server.close = closeMock;

      const exitMock = jest.spyOn(process, 'exit').mockImplementation(() => {});

      server.gracefulShutdown('test');

      expect(server.wsHandler.destroy).toHaveBeenCalled();
      expect(closeMock).toHaveBeenCalled();
      expect(exitMock).toHaveBeenCalledWith(0);

      exitMock.mockRestore();
    });

    test('exits with error code on shutdown failure', () => {
      const closeMock = jest.fn((callback) => callback(new Error('Close failed')));
      server.server.close = closeMock;

      const exitMock = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});

      server.gracefulShutdown('test');

      expect(exitMock).toHaveBeenCalledWith(1);
      expect(consoleErrorMock).toHaveBeenCalledWith('Error during server shutdown:', expect.any(Error));

      exitMock.mockRestore();
      consoleErrorMock.mockRestore();
    });

    test('forces exit after timeout', () => {
      const closeMock = jest.fn(); // Don't call callback - simulate hanging shutdown
      server.server.close = closeMock;

      const exitMock = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});

      server.gracefulShutdown('test');

      // Should not have exited yet
      expect(exitMock).not.toHaveBeenCalled();

      // Fast forward 10 seconds
      jest.advanceTimersByTime(10000);

      // Now should have force exited
      expect(exitMock).toHaveBeenCalledWith(1);
      expect(consoleErrorMock).toHaveBeenCalledWith('❌ Forced shutdown after timeout');

      exitMock.mockRestore();
      consoleErrorMock.mockRestore();
    });
  });
});