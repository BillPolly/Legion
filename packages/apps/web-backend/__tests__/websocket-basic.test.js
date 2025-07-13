import { jest } from '@jest/globals';
import { WebSocketHandler } from '../src/websocket-handler.js';
import { EventEmitter } from 'events';

// Mock the WebSocket Server
jest.mock('ws', () => ({
  WebSocketServer: jest.fn().mockImplementation(() => {
    const wss = new EventEmitter();
    wss.clients = new Set();
    return wss;
  })
}));

// Mock AgentConnection to avoid complex dependency setup
jest.mock('../src/agent-connection.js', () => ({
  AgentConnection: jest.fn().mockImplementation((id) => ({
    connectionId: id,
    processMessage: jest.fn().mockResolvedValue('Test response'),
    getConversationSummary: jest.fn().mockReturnValue({
      connectionId: id,
      messageCount: 0,
      createdAt: new Date(),
      lastActivity: new Date()
    }),
    destroy: jest.fn()
  }))
}));

describe('WebSocketHandler Basic Tests', () => {
  let wsHandler;
  let mockServer;
  let mockResourceManager;
  let mockModuleFactory;

  beforeEach(() => {
    mockServer = new EventEmitter();
    
    mockResourceManager = {
      get: jest.fn(),
      has: jest.fn(),
      register: jest.fn()
    };
    
    mockModuleFactory = {
      createModule: jest.fn()
    };
    
    wsHandler = new WebSocketHandler(mockServer, mockResourceManager, mockModuleFactory);
  });

  test('WebSocketHandler can be instantiated', () => {
    expect(wsHandler).toBeDefined();
    expect(wsHandler.server).toBe(mockServer);
    expect(wsHandler.resourceManager).toBe(mockResourceManager);
    expect(wsHandler.moduleFactory).toBe(mockModuleFactory);
    expect(wsHandler.connections).toBeInstanceOf(Map);
    expect(wsHandler.connectionCounter).toBe(0);
  });

  test('generateConnectionId creates unique IDs', () => {
    const id1 = wsHandler.generateConnectionId();
    const id2 = wsHandler.generateConnectionId();
    
    expect(id1).toMatch(/^conn_\d+_1$/);
    expect(id2).toMatch(/^conn_\d+_2$/);
    expect(id1).not.toBe(id2);
  });

  test('getStats returns correct initial stats', () => {
    const stats = wsHandler.getStats();
    
    expect(stats).toEqual({
      activeConnections: 0,
      totalConnectionsCreated: 0,
      connections: []
    });
  });

  test('broadcast returns 0 when no connections', () => {
    const sent = wsHandler.broadcast({ type: 'test', message: 'hello' });
    expect(sent).toBe(0);
  });
});