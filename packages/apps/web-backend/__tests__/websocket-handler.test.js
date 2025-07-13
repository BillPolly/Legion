import { jest } from '@jest/globals';
import { WebSocketHandler } from '../src/websocket-handler.js';
import { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';

// Mock WebSocket Server
jest.mock('ws', () => ({
  WebSocketServer: jest.fn().mockImplementation(() => {
    const wss = new EventEmitter();
    wss.clients = new Set();
    return wss;
  })
}));

// Mock AgentConnection
jest.mock('../src/agent-connection.js', () => ({
  AgentConnection: jest.fn().mockImplementation((id) => ({
    connectionId: id,
    processMessage: jest.fn().mockResolvedValue('Agent response'),
    getConversationSummary: jest.fn().mockReturnValue({
      connectionId: id,
      messageCount: 0,
      createdAt: new Date(),
      lastActivity: new Date()
    }),
    destroy: jest.fn()
  }))
}));

describe('WebSocketHandler', () => {
  let wsHandler;
  let mockServer;
  let mockResourceManager;
  let mockModuleFactory;
  let mockWss;
  let mockWs;

  beforeEach(() => {
    // Create mock HTTP server
    mockServer = new EventEmitter();
    
    // Create mock managers
    mockResourceManager = {
      get: jest.fn(),
      has: jest.fn(),
      register: jest.fn()
    };
    
    mockModuleFactory = {
      createModule: jest.fn()
    };
    
    // Create WebSocketHandler instance
    wsHandler = new WebSocketHandler(mockServer, mockResourceManager, mockModuleFactory);
    
    // Get the mocked WebSocketServer instance
    mockWss = wsHandler.wss;
    
    // Create mock WebSocket client
    mockWs = {
      id: 'test-connection-id',
      send: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn(),
      terminate: jest.fn(),
      readyState: 1, // OPEN
      _socket: {
        remoteAddress: '127.0.0.1'
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('creates WebSocketServer on initialization', () => {
      wsHandler.initialize();
      
      expect(WebSocketServer).toHaveBeenCalledWith({
        server: mockServer,
        path: '/ws'
      });
    });

    test('starts heartbeat interval on initialization', () => {
      jest.useFakeTimers();
      
      wsHandler.initialize();
      
      expect(wsHandler.heartbeatInterval).toBeDefined();
      
      jest.useRealTimers();
    });
  });

  describe('Connection Handling', () => {
    test('handles new WebSocket connection', () => {
      wsHandler.initialize();
      
      // Simulate connection event
      mockWss.emit('connection', mockWs, { headers: {} });
      
      expect(wsHandler.connections.has(mockWs.id)).toBe(true);
      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('pong', expect.any(Function));
    });

    test('sends welcome message on connection', () => {
      wsHandler.initialize();
      
      mockWss.emit('connection', mockWs, { headers: {} });
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"connection"')
      );
    });

    test('creates agent connection for new WebSocket', () => {
      wsHandler.initialize();
      
      mockWss.emit('connection', mockWs, { headers: {} });
      
      const connection = wsHandler.connections.get(mockWs.id);
      expect(connection).toBeDefined();
      expect(connection.agent).toBeDefined();
      expect(connection.agent.connectionId).toBe(mockWs.id);
    });
  });

  describe('Message Handling', () => {
    beforeEach(() => {
      wsHandler.initialize();
      mockWss.emit('connection', mockWs, { headers: {} });
    });

    test('processes chat messages', async () => {
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];
      const chatMessage = JSON.stringify({
        type: 'chat',
        message: 'Hello'
      });
      
      await messageHandler(chatMessage);
      
      const connection = wsHandler.connections.get(mockWs.id);
      expect(connection.agent.processMessage).toHaveBeenCalledWith('Hello');
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"message"')
      );
    });

    test('handles ping messages', async () => {
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];
      const pingMessage = JSON.stringify({
        type: 'ping'
      });
      
      await messageHandler(pingMessage);
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"pong"')
      );
    });

    test('sends error for unsupported message types', async () => {
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];
      const unknownMessage = JSON.stringify({
        type: 'unknown'
      });
      
      await messageHandler(unknownMessage);
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });

    test('handles invalid JSON messages', async () => {
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];
      
      await messageHandler('not valid json');
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });
  });

  describe('Disconnection Handling', () => {
    beforeEach(() => {
      wsHandler.initialize();
      mockWss.emit('connection', mockWs, { headers: {} });
    });

    test('cleans up on WebSocket close', () => {
      const closeHandler = mockWs.on.mock.calls.find(call => call[0] === 'close')[1];
      
      closeHandler(1000, 'Normal closure');
      
      expect(wsHandler.connections.has(mockWs.id)).toBe(false);
      const connection = wsHandler.connections.get(mockWs.id);
      expect(connection).toBeUndefined();
    });

    test('destroys agent connection on close', () => {
      const connection = wsHandler.connections.get(mockWs.id);
      const closeHandler = mockWs.on.mock.calls.find(call => call[0] === 'close')[1];
      
      closeHandler(1000, 'Normal closure');
      
      expect(connection.agent.destroy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      wsHandler.initialize();
      mockWss.emit('connection', mockWs, { headers: {} });
    });

    test('handles WebSocket errors', () => {
      const errorHandler = mockWs.on.mock.calls.find(call => call[0] === 'error')[1];
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      errorHandler(new Error('WebSocket error'));
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Statistics', () => {
    test('returns correct statistics', () => {
      wsHandler.initialize();
      
      // Add some connections
      mockWss.emit('connection', mockWs, { headers: {} });
      const mockWs2 = { ...mockWs, id: 'test-connection-2' };
      mockWss.emit('connection', mockWs2, { headers: {} });
      
      const stats = wsHandler.getStats();
      
      expect(stats).toMatchObject({
        activeConnections: 2,
        totalConnectionsCreated: 2,
        connections: expect.arrayContaining([
          expect.objectContaining({ connectionId: mockWs.id }),
          expect.objectContaining({ connectionId: mockWs2.id })
        ])
      });
    });
  });

  describe('Broadcasting', () => {
    test('broadcasts message to all connections', () => {
      wsHandler.initialize();
      
      // Add multiple connections
      const ws1 = { ...mockWs, id: 'conn1', readyState: 1 };
      const ws2 = { ...mockWs, id: 'conn2', readyState: 1 };
      const ws3 = { ...mockWs, id: 'conn3', readyState: 3 }; // CLOSED
      
      mockWss.emit('connection', ws1, { headers: {} });
      mockWss.emit('connection', ws2, { headers: {} });
      mockWss.emit('connection', ws3, { headers: {} });
      
      const message = { type: 'broadcast', content: 'Hello all' };
      const sent = wsHandler.broadcast(message);
      
      expect(sent).toBe(2); // Only 2 connections are open
      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
      expect(ws3.send).not.toHaveBeenCalled();
    });
  });

  describe('Heartbeat', () => {
    test('sends ping to all alive connections', () => {
      jest.useFakeTimers();
      wsHandler.initialize();
      
      // Add connections
      const ws1 = { ...mockWs, id: 'conn1', readyState: 1, isAlive: true, ping: jest.fn() };
      const ws2 = { ...mockWs, id: 'conn2', readyState: 1, isAlive: false, terminate: jest.fn() };
      
      mockWss.emit('connection', ws1, { headers: {} });
      mockWss.emit('connection', ws2, { headers: {} });
      
      // Trigger heartbeat
      jest.advanceTimersByTime(30000);
      
      expect(ws1.ping).toHaveBeenCalled();
      expect(ws2.terminate).toHaveBeenCalled();
      
      jest.useRealTimers();
    });

    test('handles pong messages', () => {
      wsHandler.initialize();
      mockWss.emit('connection', mockWs, { headers: {} });
      
      const pongHandler = mockWs.on.mock.calls.find(call => call[0] === 'pong')[1];
      
      mockWs.isAlive = false;
      pongHandler();
      
      expect(mockWs.isAlive).toBe(true);
    });
  });

  describe('Cleanup', () => {
    test('destroys all connections and clears interval', () => {
      jest.useFakeTimers();
      wsHandler.initialize();
      
      // Add connections
      mockWss.emit('connection', mockWs, { headers: {} });
      const mockWs2 = { ...mockWs, id: 'test-connection-2' };
      mockWss.emit('connection', mockWs2, { headers: {} });
      
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      wsHandler.destroy();
      
      expect(wsHandler.connections.size).toBe(0);
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(mockWs.removeAllListeners).toHaveBeenCalled();
      expect(mockWs.terminate).toHaveBeenCalled();
      expect(mockWs2.removeAllListeners).toHaveBeenCalled();
      expect(mockWs2.terminate).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
      jest.useRealTimers();
    });
  });
});