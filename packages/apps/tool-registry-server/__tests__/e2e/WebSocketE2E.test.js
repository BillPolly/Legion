/**
 * End-to-end tests for WebSocket communication protocol
 * Tests the WebSocket layer with mocked dependencies
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { WebSocketService } from '../../src/services/WebSocketService.js';
import { 
  MockWebSocket, 
  MockWebSocketServer, 
  createMockServerSetup 
} from '../helpers/mockHelpers.js';

describe('WebSocket Protocol E2E Tests', () => {
  let mockSetup;
  let wsService;
  let mockWss;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock server setup
    mockSetup = createMockServerSetup();
    mockWss = mockSetup.mockWss;
    
    // Create WebSocketService with mocks
    wsService = new WebSocketService(mockWss, mockSetup.mockActorManager);
  });
  
  afterEach(() => {
    jest.clearAllTimers();
  });
  
  describe('WebSocket Connection', () => {
    it('should establish WebSocket connection and send welcome message', async () => {
      // Simulate a client connecting
      const mockWs = mockWss.simulateConnection({}, wsService);
      
      expect(mockWs.readyState).toBe(MockWebSocket.OPEN);
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"welcome"')
      );
      
      // Verify welcome message format
      const welcomeCall = mockWs.send.mock.calls.find(call => 
        call[0].includes('"type":"welcome"')
      );
      const welcomeMessage = JSON.parse(welcomeCall[0]);
      
      expect(welcomeMessage.type).toBe('welcome');
      expect(welcomeMessage.connectionId).toBeDefined();
      expect(welcomeMessage.timestamp).toBeDefined();
    });
    
    it('should handle WebSocket connection with proper event listeners', async () => {
      const mockWs = mockWss.simulateConnection({}, wsService);
      
      // Verify that the WebSocketService set up event listeners
      expect(wsService.connections.size).toBe(1);
      
      const connectionId = Array.from(wsService.connections.keys())[0];
      const connection = wsService.connections.get(connectionId);
      
      expect(connection.ws).toBe(mockWs);
      expect(connection.ip).toBe('127.0.0.1');
      expect(connection.connectedAt).toBeInstanceOf(Date);
    });
  });
  
  describe('Actor Handshake', () => {
    it('should perform complete actor handshake flow', async () => {
      const mockWs = mockWss.simulateConnection({}, wsService);
      
      // Clear the welcome message call
      mockWs.send.mockClear();
      
      // Send handshake message
      const handshakeMessage = {
        type: 'actor_handshake',
        clientActors: {
          registry: 'client-registry-123',
          database: 'client-database-456',
          search: 'client-search-789'
        }
      };
      
      // Simulate client sending handshake
      const connectionId = Array.from(wsService.connections.keys())[0];
      await wsService.handleMessage(connectionId, JSON.stringify(handshakeMessage));
      
      // Verify handshake acknowledgment was sent
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"actor_handshake_ack"')
      );
      
      // Parse the handshake ack message
      const ackCall = mockWs.send.mock.calls.find(call => 
        call[0].includes('"type":"actor_handshake_ack"')
      );
      const ackMessage = JSON.parse(ackCall[0]);
      
      expect(ackMessage.type).toBe('actor_handshake_ack');
      expect(ackMessage.serverActors).toBeDefined();
      expect(ackMessage.serverActors.registry).toBe('server-registry-123');
      expect(ackMessage.serverActors.database).toBe('server-database-456');
      expect(ackMessage.serverActors.search).toBe('server-search-789');
      
      // Verify actor manager was called correctly
      expect(mockSetup.mockActorManager.createActorSpace).toHaveBeenCalledWith(connectionId);
      expect(mockSetup.mockActorManager.getActorGuids).toHaveBeenCalledWith(connectionId);
      expect(mockSetup.mockActorManager.setupRemoteActors).toHaveBeenCalledWith(
        connectionId,
        expect.anything(),
        handshakeMessage.clientActors
      );
    });
    
    it('should handle handshake with empty client actors', async () => {
      const mockWs = mockWss.simulateConnection({}, wsService);
      
      mockWs.send.mockClear();
      
      const handshakeMessage = {
        type: 'actor_handshake',
        clientActors: {}
      };
      
      const connectionId = Array.from(wsService.connections.keys())[0];
      await wsService.handleMessage(connectionId, JSON.stringify(handshakeMessage));
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"actor_handshake_ack"')
      );
      
      // Verify setup was still called with empty actors
      expect(mockSetup.mockActorManager.setupRemoteActors).toHaveBeenCalledWith(
        connectionId,
        expect.anything(),
        {}
      );
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid JSON messages gracefully', async () => {
      const mockWs = mockWss.simulateConnection({}, wsService);
      
      const connectionId = Array.from(wsService.connections.keys())[0];
      mockWs.send.mockClear();
      
      // Send invalid JSON
      await wsService.handleMessage(connectionId, 'invalid json {');
      
      // Should send error response
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
      
      const errorCall = mockWs.send.mock.calls.find(call => 
        call[0].includes('"type":"error"')
      );
      const errorMessage = JSON.parse(errorCall[0]);
      
      expect(errorMessage.type).toBe('error');
      expect(errorMessage.error).toBeDefined();
      expect(errorMessage.error.message).toContain('Unexpected token');
    });
    
    it('should handle messages before handshake', async () => {
      const mockWs = mockWss.simulateConnection({}, wsService);
      
      const connectionId = Array.from(wsService.connections.keys())[0];
      mockWs.send.mockClear();
      
      // Send a non-handshake message first
      await wsService.handleMessage(connectionId, JSON.stringify({
        type: 'tool_execute',
        data: { tool: 'calculator' }
      }));
      
      // Should not send any response (just logs warning)
      expect(mockWs.send).not.toHaveBeenCalled();
      
      // Now send proper handshake
      await wsService.handleMessage(connectionId, JSON.stringify({
        type: 'actor_handshake',
        clientActors: {}
      }));
      
      // Should receive handshake ack
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"actor_handshake_ack"')
      );
    });
    
    it('should handle WebSocket errors', async () => {
      const mockWs = mockWss.simulateConnection({}, wsService);
      
      const connectionId = Array.from(wsService.connections.keys())[0];
      mockWs.send.mockClear();
      
      // Simulate WebSocket error  
      const testError = new Error('WebSocket connection failed');
      wsService.handleError(connectionId, testError);
      
      // Should send error message if connection is still open (readyState === 1)
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });
  });
  
  describe('Multiple Connections', () => {
    it('should handle multiple concurrent connections', async () => {
      const numConnections = 5;
      const mockConnections = [];
      
      // Create multiple connections
      for (let i = 0; i < numConnections; i++) {
        const mockWs = mockWss.simulateConnection({ ip: `127.0.0.${i + 1}` }, wsService);
        mockConnections.push(mockWs);
      }
      
      // All should be tracked by the service
      expect(wsService.connections.size).toBe(numConnections);
      
      // Each should receive a unique welcome message
      const connectionIds = new Set();
      
      mockConnections.forEach(mockWs => {
        expect(mockWs.readyState).toBe(MockWebSocket.OPEN);
        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining('"type":"welcome"')
        );
        
        // Extract connection ID from welcome message
        const welcomeCall = mockWs.send.mock.calls.find(call => 
          call[0].includes('"type":"welcome"')
        );
        const welcomeMessage = JSON.parse(welcomeCall[0]);
        connectionIds.add(welcomeMessage.connectionId);
      });
      
      // All connection IDs should be unique
      expect(connectionIds.size).toBe(numConnections);
    });
    
    it('should track connections with different IPs', async () => {
      const mockWs1 = mockWss.simulateConnection({ ip: '192.168.1.1' }, wsService);
      const mockWs2 = mockWss.simulateConnection({ ip: '10.0.0.1' }, wsService);
      
      expect(wsService.connections.size).toBe(2);
      
      const connections = Array.from(wsService.connections.values());
      const ips = connections.map(conn => conn.ip);
      
      expect(ips).toContain('192.168.1.1');
      expect(ips).toContain('10.0.0.1');
    });
  });
  
  describe('Connection Lifecycle', () => {
    it('should handle connection close gracefully', async () => {
      const mockWs = mockWss.simulateConnection({}, wsService);
      
      const connectionId = Array.from(wsService.connections.keys())[0];
      expect(wsService.connections.size).toBe(1);
      
      // Perform handshake
      await wsService.handleMessage(connectionId, JSON.stringify({
        type: 'actor_handshake',
        clientActors: {}
      }));
      
      // Verify connection is tracked
      expect(wsService.connections.get(connectionId).actorSpace).toBeDefined();
      
      // Close connection
      await wsService.handleClose(connectionId);
      
      // Verify connection is removed
      expect(wsService.connections.has(connectionId)).toBe(false);
      expect(mockSetup.mockActorManager.cleanupActorSpace).toHaveBeenCalledWith(connectionId);
    });
    
    it('should cleanup resources on disconnect and allow reconnection', async () => {
      // First connection
      const mockWs1 = mockWss.simulateConnection({}, wsService);
      
      const connectionId1 = Array.from(wsService.connections.keys())[0];
      
      // Perform handshake
      await wsService.handleMessage(connectionId1, JSON.stringify({
        type: 'actor_handshake',
        clientActors: { registry: 'client-1' }
      }));
      
      expect(wsService.connections.size).toBe(1);
      
      // Close first connection
      await wsService.handleClose(connectionId1);
      expect(wsService.connections.size).toBe(0);
      
      // Create new connection with same client actors
      const mockWs2 = mockWss.simulateConnection({}, wsService);
      
      const connectionId2 = Array.from(wsService.connections.keys())[0];
      
      // Should be able to handshake again
      await wsService.handleMessage(connectionId2, JSON.stringify({
        type: 'actor_handshake',
        clientActors: { registry: 'client-1' }
      }));
      
      expect(mockWs2.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"actor_handshake_ack"')
      );
      
      // Verify cleanup was called for first connection
      expect(mockSetup.mockActorManager.cleanupActorSpace).toHaveBeenCalledWith(connectionId1);
      // Verify new actor space was created for second connection
      expect(mockSetup.mockActorManager.createActorSpace).toHaveBeenCalledWith(connectionId2);
    });
    
    it('should handle server cleanup properly', async () => {
      // Create multiple connections
      const mockWs1 = mockWss.simulateConnection({}, wsService);
      const mockWs2 = mockWss.simulateConnection({}, wsService);
      expect(wsService.connections.size).toBe(2);
      
      // Cleanup all connections
      await wsService.cleanup();
      
      // Verify all connections are cleaned up
      expect(wsService.connections.size).toBe(0);
      expect(mockWs1.close).toHaveBeenCalled();
      expect(mockWs2.close).toHaveBeenCalled();
    });
    
    it('should handle connection statistics', async () => {
      const mockWs1 = mockWss.simulateConnection({ ip: '127.0.0.1' }, wsService);
      const mockWs2 = mockWss.simulateConnection({ ip: '192.168.1.1' }, wsService);
      
      // Add a small delay to ensure duration > 0
      await new Promise(resolve => setTimeout(resolve, 5));
      
      const stats = wsService.getStats();
      
      expect(stats.totalConnections).toBe(2);
      expect(stats.connections).toHaveLength(2);
      expect(stats.connections[0].ip).toBeDefined();
      expect(stats.connections[0].connectedAt).toBeInstanceOf(Date);
      expect(stats.connections[0].duration).toBeGreaterThanOrEqual(0);
    });
  });
});