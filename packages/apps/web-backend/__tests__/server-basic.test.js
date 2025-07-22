import { jest } from '@jest/globals';
import { ChatServer } from '../src/server.js';

// Mock the WebSocketHandler to avoid complex setup
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

// Mock the module loader to avoid dependency issues
jest.mock('@legion/module-loader', () => ({
  ResourceManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    register: jest.fn(),
    has: jest.fn().mockReturnValue(false),
    get: jest.fn()
  })),
  ModuleFactory: jest.fn().mockImplementation(() => ({}))
}));

describe('ChatServer Basic Tests', () => {
  let server;

  beforeEach(() => {
    server = new ChatServer();
  });

  test('ChatServer can be instantiated', () => {
    expect(server).toBeDefined();
    expect(server.app).toBeDefined();
    expect(server.server).toBeDefined();
    expect(server.port).toBe(3000);
  });

  test('Server has default port 3000', () => {
    expect(server.port).toBe(3000);
  });

  test('Server can initialize resources', async () => {
    await server.initializeResources();
    
    expect(server.resourceManager).toBeDefined();
    expect(server.moduleFactory).toBeDefined();
    expect(server.wsHandler).toBeDefined();
  });
});