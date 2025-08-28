import { describe, it, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ConnectionManager } from '../../../src/server/connection-manager.js';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

describe('ConnectionManager', () => {
  let connectionManager;
  let mockSessionManager;

  beforeEach(() => {
    let sessionIdCounter = 0;
    mockSessionManager = {
      createSession: jest.fn().mockImplementation(() => `test-session-${String(++sessionIdCounter).padStart(3, '0')}`),
      disconnectSession: jest.fn(),
      updateActivity: jest.fn(),
      getSession: jest.fn().mockReturnValue({ id: 'test-session-001', connected: true })
    };
    
    connectionManager = new ConnectionManager({ sessionManager: mockSessionManager });
  });

  afterEach(() => {
    connectionManager.cleanup();
  });

  // Helper function to create mock WebSocket
  function createMockWebSocket(readyState = WebSocket.OPEN) {
    const mockWs = new EventEmitter();
    mockWs.readyState = readyState;
    mockWs.send = jest.fn();
    mockWs.close = jest.fn();
    mockWs.ping = jest.fn();
    mockWs.terminate = jest.fn();
    return mockWs;
  }

  describe('Connection State Tracking', () => {
    test('should track multiple concurrent connections', () => {
      const mockWs1 = createMockWebSocket();
      const mockWs2 = createMockWebSocket();
      
      const sessionId1 = connectionManager.addConnection(mockWs1, { remoteAddress: '127.0.0.1' });
      const sessionId2 = connectionManager.addConnection(mockWs2, { remoteAddress: '127.0.0.2' });
      
      expect(sessionId1).toBe('test-session-001');
      expect(sessionId2).toBe('test-session-002');
      expect(connectionManager.getConnectionCount()).toBe(2);
    });

    test('should get connection by session ID', () => {
      const mockWs = createMockWebSocket();
      
      const sessionId = connectionManager.addConnection(mockWs, { remoteAddress: '127.0.0.1' });
      const connection = connectionManager.getConnectionBySession(sessionId);
      
      expect(connection).toBeDefined();
      expect(connection.ws).toBe(mockWs);
      expect(connection.sessionId).toBe(sessionId);
      expect(connection.metadata.remoteAddress).toBe('127.0.0.1');
    });

    test('should track connection metadata', () => {
      const mockWs = createMockWebSocket();
      
      const metadata = {
        remoteAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        protocol: 'cerebrate-debug-v1'
      };
      
      const sessionId = connectionManager.addConnection(mockWs, metadata);
      const connection = connectionManager.getConnectionBySession(sessionId);
      
      expect(connection.metadata).toEqual(expect.objectContaining(metadata));
      expect(connection.metadata.connectedAt).toBeInstanceOf(Date);
    });

    test('should handle connection not found gracefully', () => {
      const connection = connectionManager.getConnectionBySession('non-existent-session');
      expect(connection).toBeNull();
    });
  });

  describe('Connection Removal and Cleanup', () => {
    test('should remove connection gracefully', () => {
      const mockWs = createMockWebSocket();
      
      const sessionId = connectionManager.addConnection(mockWs, { remoteAddress: '127.0.0.1' });
      expect(connectionManager.getConnectionCount()).toBe(1);
      
      connectionManager.removeConnection(sessionId);
      
      expect(connectionManager.getConnectionCount()).toBe(0);
      expect(connectionManager.getConnectionBySession(sessionId)).toBeNull();
      expect(mockSessionManager.disconnectSession).toHaveBeenCalledWith(sessionId);
    });

    test('should handle removal of non-existent connection', () => {
      expect(() => {
        connectionManager.removeConnection('non-existent-session');
      }).not.toThrow();
      
      expect(mockSessionManager.disconnectSession).toHaveBeenCalledWith('non-existent-session');
    });

    test('should cleanup all connections', () => {
      const mockWs1 = createMockWebSocket();
      const mockWs2 = createMockWebSocket();
      
      connectionManager.addConnection(mockWs1, { remoteAddress: '127.0.0.1' });
      connectionManager.addConnection(mockWs2, { remoteAddress: '127.0.0.2' });
      
      expect(connectionManager.getConnectionCount()).toBe(2);
      
      connectionManager.cleanup();
      
      expect(connectionManager.getConnectionCount()).toBe(0);
      expect(mockWs1.close).toHaveBeenCalled();
      expect(mockWs2.close).toHaveBeenCalled();
    });

    test('should emit connection events', () => {
      const mockWs = createMockWebSocket();
      
      const connectionAddedSpy = jest.fn();
      const connectionRemovedSpy = jest.fn();
      
      connectionManager.on('connection-added', connectionAddedSpy);
      connectionManager.on('connection-removed', connectionRemovedSpy);
      
      const sessionId = connectionManager.addConnection(mockWs, { remoteAddress: '127.0.0.1' });
      expect(connectionAddedSpy).toHaveBeenCalledWith(expect.objectContaining({ sessionId }));
      
      connectionManager.removeConnection(sessionId);
      expect(connectionRemovedSpy).toHaveBeenCalledWith(expect.objectContaining({ sessionId }));
    });
  });

  describe('Connection Limits and Policies', () => {
    test('should enforce maximum connection limit', () => {
      connectionManager = new ConnectionManager({ 
        sessionManager: mockSessionManager,
        maxConnections: 2
      });
      
      const mockWs1 = createMockWebSocket();
      const mockWs2 = createMockWebSocket();
      const mockWs3 = createMockWebSocket();
      
      connectionManager.addConnection(mockWs1, { remoteAddress: '127.0.0.1' });
      connectionManager.addConnection(mockWs2, { remoteAddress: '127.0.0.2' });
      
      // Third connection should be rejected
      const sessionId3 = connectionManager.addConnection(mockWs3, { remoteAddress: '127.0.0.3' });
      
      expect(sessionId3).toBeNull();
      expect(mockWs3.close).toHaveBeenCalledWith(1008, 'Connection limit exceeded');
      expect(connectionManager.getConnectionCount()).toBe(2);
    });

    test('should handle rate limiting', () => {
      connectionManager = new ConnectionManager({ 
        sessionManager: mockSessionManager,
        rateLimitWindowMs: 1000,
        rateLimitMaxConnections: 2
      });
      
      const mockWs1 = createMockWebSocket();
      const mockWs2 = createMockWebSocket();
      const mockWs3 = createMockWebSocket();
      
      // Add two connections quickly from same IP
      connectionManager.addConnection(mockWs1, { remoteAddress: '127.0.0.1' });
      connectionManager.addConnection(mockWs2, { remoteAddress: '127.0.0.1' }); // Same IP
      
      // Third connection from same IP should be rate limited
      const sessionId3 = connectionManager.addConnection(mockWs3, { remoteAddress: '127.0.0.1' });
      
      expect(sessionId3).toBeNull();
      expect(mockWs3.close).toHaveBeenCalledWith(1008, 'Rate limit exceeded');
    });
  });

  describe('Connection Statistics and Monitoring', () => {
    test('should provide connection statistics', () => {
      const mockWs1 = createMockWebSocket(WebSocket.OPEN);
      const mockWs2 = createMockWebSocket(WebSocket.CLOSING);
      
      connectionManager.addConnection(mockWs1, { remoteAddress: '127.0.0.1' });
      connectionManager.addConnection(mockWs2, { remoteAddress: '127.0.0.2' });
      
      const stats = connectionManager.getConnectionStatistics();
      
      expect(stats.total_connections).toBe(2);
      expect(stats.active_connections).toBe(1); // Only one is OPEN
      expect(stats.connections_by_state).toHaveProperty('1'); // OPEN state
      expect(stats.connections_by_state).toHaveProperty('2'); // CLOSING state
    });

    test('should track connection history', () => {
      const mockWs = createMockWebSocket();
      
      const sessionId = connectionManager.addConnection(mockWs, { remoteAddress: '127.0.0.1' });
      connectionManager.removeConnection(sessionId);
      
      const stats = connectionManager.getConnectionStatistics();
      
      expect(stats.total_connections_created).toBeGreaterThan(0);
      expect(stats.total_connections_closed).toBeGreaterThan(0);
    });

    test('should provide connection list', () => {
      const mockWs1 = createMockWebSocket();
      const mockWs2 = createMockWebSocket();
      
      const sessionId1 = connectionManager.addConnection(mockWs1, { remoteAddress: '127.0.0.1' });
      const sessionId2 = connectionManager.addConnection(mockWs2, { remoteAddress: '127.0.0.2' });
      
      const connections = connectionManager.getAllConnections();
      
      expect(connections).toHaveLength(2);
      expect(connections.map(c => c.sessionId)).toContain(sessionId1);
      expect(connections.map(c => c.sessionId)).toContain(sessionId2);
    });
  });

  describe('Message Broadcasting', () => {
    test('should broadcast message to all connections', () => {
      const mockWs1 = createMockWebSocket();
      const mockWs2 = createMockWebSocket();
      
      connectionManager.addConnection(mockWs1, { remoteAddress: '127.0.0.1' });
      connectionManager.addConnection(mockWs2, { remoteAddress: '127.0.0.2' });
      
      const testMessage = { type: 'broadcast', data: 'hello' };
      connectionManager.broadcast(testMessage);
      
      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(testMessage));
      expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify(testMessage));
    });

    test('should send message to specific session', () => {
      const mockWs1 = createMockWebSocket();
      const mockWs2 = createMockWebSocket();
      
      const sessionId1 = connectionManager.addConnection(mockWs1, { remoteAddress: '127.0.0.1' });
      connectionManager.addConnection(mockWs2, { remoteAddress: '127.0.0.2' });
      
      const testMessage = { type: 'direct', data: 'hello session 1' };
      connectionManager.sendToSession(sessionId1, testMessage);
      
      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(testMessage));
      expect(mockWs2.send).not.toHaveBeenCalled();
    });

    test('should skip closed connections when broadcasting', () => {
      const mockWs1 = createMockWebSocket(WebSocket.OPEN);
      const mockWs2 = createMockWebSocket(WebSocket.CLOSED);
      
      connectionManager.addConnection(mockWs1, { remoteAddress: '127.0.0.1' });
      connectionManager.addConnection(mockWs2, { remoteAddress: '127.0.0.2' });
      
      const testMessage = { type: 'broadcast', data: 'hello' };
      connectionManager.broadcast(testMessage);
      
      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(testMessage));
      expect(mockWs2.send).not.toHaveBeenCalled(); // Closed connection skipped
    });
  });
});