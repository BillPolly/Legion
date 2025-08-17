/**
 * Unit tests for ActorSpaceManager
 */

import { jest } from '@jest/globals';
import { ActorSpaceManager } from '../../ActorSpaceManager.js';
import { ActorSpace } from '@legion/actors';

describe('ActorSpaceManager', () => {
  let manager;
  let mockWs;
  let mockServices;
  let mockRoutes;

  beforeEach(() => {
    // Mock WebSocket
    mockWs = {
      send: jest.fn(),
      on: jest.fn(),
      close: jest.fn(),
      readyState: 1 // OPEN
    };

    // Mock services
    mockServices = new Map();
    mockServices.set('resourceManager', { name: 'ResourceManager' });
    
    // Mock routes
    mockRoutes = new Map();
    mockRoutes.set('/test', {
      factory: jest.fn(() => ({
        name: 'TestServerActor',
        setRemoteActor: jest.fn()
      })),
      clientFile: '/test/client.js',
      port: 8080
    });

    manager = new ActorSpaceManager(mockServices, mockRoutes);
  });

  describe('constructor', () => {
    it('should initialize with services and routes', () => {
      expect(manager.services).toBe(mockServices);
      expect(manager.routes).toBe(mockRoutes);
      expect(manager.connections).toBeInstanceOf(Map);
    });
  });

  describe('handleConnection', () => {
    it('should create ActorSpace for new connection', () => {
      const mockReq = { url: '/ws' };
      
      manager.handleConnection(mockWs, mockReq);
      
      expect(manager.connections.has(mockWs)).toBe(true);
      const connection = manager.connections.get(mockWs);
      expect(connection.actorSpace).toBeDefined();
    });

    it('should set up message handler', () => {
      const mockReq = { url: '/ws' };
      
      manager.handleConnection(mockWs, mockReq);
      
      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should set up close handler', () => {
      const mockReq = { url: '/ws' };
      
      manager.handleConnection(mockWs, mockReq);
      
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should set up error handler', () => {
      const mockReq = { url: '/ws' };
      
      manager.handleConnection(mockWs, mockReq);
      
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('handleHandshake', () => {
    beforeEach(() => {
      const mockReq = { url: '/ws' };
      manager.handleConnection(mockWs, mockReq);
    });

    it('should handle actor handshake message', () => {
      const handshakeMessage = {
        type: 'actor_handshake',
        clientRootActor: 'client-root',
        route: '/test'
      };
      
      manager.handleHandshake(mockWs, handshakeMessage);
      
      // Should send acknowledgment
      expect(mockWs.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('actor_handshake_ack');
      expect(sentMessage.serverRootActor).toBeDefined();
    });

    it('should create server actor from factory', () => {
      const handshakeMessage = {
        type: 'actor_handshake',
        clientRootActor: 'client-root',
        route: '/test'
      };
      
      const routeConfig = mockRoutes.get('/test');
      
      manager.handleHandshake(mockWs, handshakeMessage);
      
      expect(routeConfig.factory).toHaveBeenCalledWith(mockServices);
    });

    it('should register server actor in ActorSpace', () => {
      const handshakeMessage = {
        type: 'actor_handshake',
        clientRootActor: 'client-root',
        route: '/test'
      };
      
      manager.handleHandshake(mockWs, handshakeMessage);
      
      const connection = manager.connections.get(mockWs);
      expect(connection.serverActor).toBeDefined();
      expect(connection.serverActor.name).toBe('TestServerActor');
    });

    it('should handle unknown route', () => {
      const handshakeMessage = {
        type: 'actor_handshake',
        clientRootActor: 'client-root',
        route: '/unknown'
      };
      
      expect(() => {
        manager.handleHandshake(mockWs, handshakeMessage);
      }).not.toThrow();
      
      // Should send error response
      expect(mockWs.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('error');
    });
  });

  describe('createServerActor', () => {
    it('should create actor from factory', () => {
      const route = '/test';
      const actor = manager.createServerActor(route);
      
      expect(actor).toBeDefined();
      expect(actor.name).toBe('TestServerActor');
      
      const routeConfig = mockRoutes.get(route);
      expect(routeConfig.factory).toHaveBeenCalledWith(mockServices);
    });

    it('should return null for unknown route', () => {
      const actor = manager.createServerActor('/unknown');
      
      expect(actor).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should remove connection on cleanup', () => {
      const mockReq = { url: '/ws' };
      manager.handleConnection(mockWs, mockReq);
      
      expect(manager.connections.has(mockWs)).toBe(true);
      
      manager.cleanup(mockWs);
      
      expect(manager.connections.has(mockWs)).toBe(false);
    });

    it('should handle cleanup of non-existent connection', () => {
      expect(() => {
        manager.cleanup(mockWs);
      }).not.toThrow();
    });
  });

  describe('getConnectionCount', () => {
    it('should return number of active connections', () => {
      expect(manager.getConnectionCount()).toBe(0);
      
      const mockReq = { url: '/ws' };
      manager.handleConnection(mockWs, mockReq);
      
      expect(manager.getConnectionCount()).toBe(1);
      
      const mockWs2 = { ...mockWs };
      manager.handleConnection(mockWs2, mockReq);
      
      expect(manager.getConnectionCount()).toBe(2);
    });
  });
});