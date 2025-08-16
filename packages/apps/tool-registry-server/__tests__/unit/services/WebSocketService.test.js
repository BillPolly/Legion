/**
 * Unit tests for WebSocketService
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { WebSocketService } from '../../../src/services/WebSocketService.js';

describe('WebSocketService', () => {
  let service;
  let mockWss;
  let mockActorManager;
  let mockWs;
  let mockReq;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockWss = {};
    
    mockActorManager = {
      createActorSpace: jest.fn(),
      cleanupActorSpace: jest.fn(),
      getActorGuids: jest.fn(),
      setupRemoteActors: jest.fn()
    };
    
    mockWs = {
      on: jest.fn(),
      send: jest.fn(),
      readyState: 1
    };
    
    mockReq = {
      socket: {
        remoteAddress: '127.0.0.1'
      }
    };
    
    service = new WebSocketService(mockWss, mockActorManager);
  });
  
  describe('handleConnection', () => {
    it('should handle new WebSocket connection', () => {
      service.handleConnection(mockWs, mockReq);
      
      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"welcome"')
      );
      
      expect(service.connections.size).toBe(1);
    });
    
    it('should generate unique connection IDs', () => {
      service.handleConnection(mockWs, mockReq);
      const ws2 = { ...mockWs };
      service.handleConnection(ws2, mockReq);
      
      const connectionIds = Array.from(service.connections.keys());
      expect(connectionIds[0]).not.toBe(connectionIds[1]);
    });
  });
  
  describe('handleMessage', () => {
    it('should handle actor handshake message', async () => {
      const connectionId = 'test-conn';
      const mockActorSpace = {
        handleIncomingMessage: jest.fn(),
        addChannel: jest.fn().mockReturnValue({ makeRemote: jest.fn() })
      };
      
      service.connections.set(connectionId, {
        ws: mockWs,
        ip: '127.0.0.1',
        connectedAt: new Date(),
        actorSpace: null
      });
      
      mockActorManager.createActorSpace.mockResolvedValue(mockActorSpace);
      mockActorManager.getActorGuids.mockReturnValue({
        registry: 'server-registry',
        database: 'server-database'
      });
      
      const message = JSON.stringify({
        type: 'actor_handshake',
        clientActors: {
          registry: 'client-registry',
          database: 'client-database'
        }
      });
      
      await service.handleMessage(connectionId, message);
      
      expect(mockActorManager.createActorSpace).toHaveBeenCalledWith(connectionId);
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"actor_handshake_ack"')
      );
      expect(mockActorSpace.addChannel).toHaveBeenCalledWith(mockWs);
    });
    
    it('should route messages to actor space after handshake', async () => {
      const connectionId = 'test-conn';
      const mockActorSpace = {
        handleIncomingMessage: jest.fn()
      };
      
      service.connections.set(connectionId, {
        ws: mockWs,
        ip: '127.0.0.1',
        connectedAt: new Date(),
        actorSpace: mockActorSpace
      });
      
      const message = JSON.stringify({
        type: 'tool_execute',
        data: { tool: 'calculator' }
      });
      
      await service.handleMessage(connectionId, message);
      
      expect(mockActorSpace.handleIncomingMessage).toHaveBeenCalledWith({
        type: 'tool_execute',
        data: { tool: 'calculator' }
      });
    });
    
    it('should handle invalid JSON messages', async () => {
      const connectionId = 'test-conn';
      service.connections.set(connectionId, {
        ws: mockWs,
        ip: '127.0.0.1',
        connectedAt: new Date(),
        actorSpace: null
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await service.handleMessage(connectionId, 'invalid json {');
      
      expect(consoleSpy).toHaveBeenCalled();
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('handleClose', () => {
    it('should cleanup connection on close', async () => {
      const connectionId = 'test-conn';
      const mockActorSpace = {};
      
      service.connections.set(connectionId, {
        ws: mockWs,
        ip: '127.0.0.1',
        connectedAt: new Date(Date.now() - 5000),
        actorSpace: mockActorSpace
      });
      
      await service.handleClose(connectionId);
      
      expect(mockActorManager.cleanupActorSpace).toHaveBeenCalledWith(connectionId);
      expect(service.connections.has(connectionId)).toBe(false);
    });
    
    it('should handle close for unknown connection', async () => {
      await service.handleClose('unknown-conn');
      // Should not throw
    });
  });
  
  describe('handleError', () => {
    it('should handle WebSocket errors', () => {
      const connectionId = 'test-conn';
      service.connections.set(connectionId, {
        ws: mockWs,
        ip: '127.0.0.1',
        connectedAt: new Date(),
        actorSpace: null
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('WebSocket error');
      
      service.handleError(connectionId, error);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('WebSocket error'),
        error
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('broadcast', () => {
    it('should broadcast message to all connections', () => {
      const ws1 = { send: jest.fn(), readyState: 1 };
      const ws2 = { send: jest.fn(), readyState: 1 };
      const ws3 = { send: jest.fn(), readyState: 0 }; // Closed
      
      service.connections.set('conn1', { ws: ws1 });
      service.connections.set('conn2', { ws: ws2 });
      service.connections.set('conn3', { ws: ws3 });
      
      const message = { type: 'broadcast', data: 'test' };
      service.broadcast(message);
      
      expect(ws1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(ws2.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(ws3.send).not.toHaveBeenCalled();
    });
  });
  
  describe('getStats', () => {
    it('should return connection statistics', () => {
      const now = Date.now();
      service.connections.set('conn1', {
        ws: mockWs,
        ip: '192.168.1.1',
        connectedAt: new Date(now - 10000),
        actorSpace: {}
      });
      service.connections.set('conn2', {
        ws: mockWs,
        ip: '192.168.1.2',
        connectedAt: new Date(now - 5000),
        actorSpace: null
      });
      
      const stats = service.getStats();
      
      expect(stats.totalConnections).toBe(2);
      expect(stats.connections).toHaveLength(2);
      expect(stats.connections[0].ip).toBe('192.168.1.1');
      expect(stats.connections[0].hasActorSpace).toBe(true);
      expect(stats.connections[1].hasActorSpace).toBe(false);
    });
  });
  
  describe('cleanup', () => {
    it('should cleanup all connections', async () => {
      const ws1 = { close: jest.fn(), readyState: 1 };
      const ws2 = { close: jest.fn(), readyState: 1 };
      
      service.connections.set('conn1', {
        ws: ws1,
        actorSpace: {}
      });
      service.connections.set('conn2', {
        ws: ws2,
        actorSpace: {}
      });
      
      await service.cleanup();
      
      expect(ws1.close).toHaveBeenCalledWith(1000, 'Server shutting down');
      expect(ws2.close).toHaveBeenCalledWith(1000, 'Server shutting down');
      expect(mockActorManager.cleanupActorSpace).toHaveBeenCalledTimes(2);
      expect(service.connections.size).toBe(0);
    });
  });
});