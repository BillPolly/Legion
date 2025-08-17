/**
 * Integration tests for ActorSpaceManager with real actors
 * NO MOCKS - uses real ActorSpace and components
 */

import { ActorSpaceManager } from '../../ActorSpaceManager.js';
import { ActorSpace, Actor } from '@legion/actors';
import { ResourceManager } from '@legion/resource-manager';
import EventEmitter from 'events';

// Create a mock WebSocket that extends EventEmitter
class MockWebSocket extends EventEmitter {
  constructor() {
    super();
    this.readyState = 1; // OPEN
    this.messages = [];
  }
  
  send(data) {
    this.messages.push(data);
  }
  
  close() {
    this.readyState = 3; // CLOSED
    this.emit('close');
  }
}

// Real test actor
class TestServerActor extends Actor {
  constructor(services) {
    super();
    this.services = services;
    this.name = 'TestServerActor';
    this.remoteActor = null;
  }
  
  setRemoteActor(remote) {
    this.remoteActor = remote;
  }
  
  async handleMessage(message) {
    if (message.type === 'test') {
      return { type: 'test-response', data: 'Hello from server' };
    }
    return null;
  }
}

describe('ActorSpaceManager Integration Tests', () => {
  let manager;
  let services;
  let routes;

  beforeEach(async () => {
    // Real services with ResourceManager
    const rm = ResourceManager.getInstance();
    await rm.initialize();
    
    services = new Map();
    services.set('resourceManager', rm);
    
    // Real route configuration
    routes = new Map();
    routes.set('/test', {
      factory: (services) => new TestServerActor(services),
      clientFile: '/test/client.js',
      port: 8080
    });
    
    manager = new ActorSpaceManager(services, routes);
  });

  describe('Real actor creation and management', () => {
    it('should create real server actor instance', () => {
      const ws = new MockWebSocket();
      const req = { url: '/ws' };
      
      manager.handleConnection(ws, req);
      
      // Handshake
      manager.handleHandshake(ws, {
        type: 'actor_handshake',
        clientRootActor: 'client-root',
        route: '/test'
      });
      
      const connection = manager.connections.get(ws);
      expect(connection.serverActor).toBeInstanceOf(TestServerActor);
      expect(connection.serverActor.services).toBe(services);
    });

    it('should register actor in real ActorSpace', () => {
      const ws = new MockWebSocket();
      const req = { url: '/ws' };
      
      manager.handleConnection(ws, req);
      
      const connection = manager.connections.get(ws);
      expect(connection.actorSpace).toBeInstanceOf(ActorSpace);
      
      // Handshake creates and registers actor
      manager.handleHandshake(ws, {
        type: 'actor_handshake',
        clientRootActor: 'client-root',
        route: '/test'
      });
      
      // Actor should be registered
      expect(connection.serverActor).toBeDefined();
    });

    it('should handle multiple connections with separate ActorSpaces', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();
      const req = { url: '/ws' };
      
      manager.handleConnection(ws1, req);
      manager.handleConnection(ws2, req);
      
      const conn1 = manager.connections.get(ws1);
      const conn2 = manager.connections.get(ws2);
      
      // Different ActorSpace instances
      expect(conn1.actorSpace).not.toBe(conn2.actorSpace);
      
      // Handshake both
      manager.handleHandshake(ws1, {
        type: 'actor_handshake',
        clientRootActor: 'client-root-1',
        route: '/test'
      });
      
      manager.handleHandshake(ws2, {
        type: 'actor_handshake',
        clientRootActor: 'client-root-2',
        route: '/test'
      });
      
      // Different actor instances
      expect(conn1.serverActor).not.toBe(conn2.serverActor);
      expect(conn1.serverActor).toBeInstanceOf(TestServerActor);
      expect(conn2.serverActor).toBeInstanceOf(TestServerActor);
    });
  });

  describe('Connection lifecycle with real components', () => {
    it('should clean up ActorSpace on disconnect', () => {
      const ws = new MockWebSocket();
      const req = { url: '/ws' };
      
      manager.handleConnection(ws, req);
      
      // Handshake
      manager.handleHandshake(ws, {
        type: 'actor_handshake',
        clientRootActor: 'client-root',
        route: '/test'
      });
      
      expect(manager.connections.has(ws)).toBe(true);
      
      // Trigger close
      ws.close();
      
      // Should be cleaned up
      expect(manager.connections.has(ws)).toBe(false);
    });

    it('should handle error without crashing', () => {
      const ws = new MockWebSocket();
      const req = { url: '/ws' };
      
      manager.handleConnection(ws, req);
      
      // Trigger error
      ws.emit('error', new Error('Test error'));
      
      // Should not crash
      expect(manager.connections.has(ws)).toBe(true);
    });
  });

  describe('Handshake protocol with real actors', () => {
    it('should send correct handshake acknowledgment', () => {
      const ws = new MockWebSocket();
      const req = { url: '/ws' };
      
      manager.handleConnection(ws, req);
      
      manager.handleHandshake(ws, {
        type: 'actor_handshake',
        clientRootActor: 'client-root-123',
        route: '/test'
      });
      
      // Check sent message
      expect(ws.messages.length).toBe(1);
      const response = JSON.parse(ws.messages[0]);
      expect(response.type).toBe('actor_handshake_ack');
      expect(response.serverRootActor).toMatch(/^server-root-/);
    });

    it('should handle invalid route gracefully', () => {
      const ws = new MockWebSocket();
      const req = { url: '/ws' };
      
      manager.handleConnection(ws, req);
      
      manager.handleHandshake(ws, {
        type: 'actor_handshake',
        clientRootActor: 'client-root',
        route: '/invalid'
      });
      
      // Should send error
      expect(ws.messages.length).toBe(1);
      const response = JSON.parse(ws.messages[0]);
      expect(response.type).toBe('error');
      expect(response.message).toContain('Unknown route');
    });

    it('should handle malformed handshake', () => {
      const ws = new MockWebSocket();
      const req = { url: '/ws' };
      
      manager.handleConnection(ws, req);
      
      // Missing required fields
      manager.handleHandshake(ws, {
        type: 'actor_handshake'
        // Missing clientRootActor and route
      });
      
      // Should send error
      expect(ws.messages.length).toBe(1);
      const response = JSON.parse(ws.messages[0]);
      expect(response.type).toBe('error');
    });
  });

  describe('Multiple route support', () => {
    beforeEach(() => {
      // Add more routes
      routes.set('/app', {
        factory: (services) => new TestServerActor(services),
        clientFile: '/app/client.js',
        port: 8080
      });
      
      routes.set('/dashboard', {
        factory: (services) => {
          const actor = new TestServerActor(services);
          actor.name = 'DashboardActor';
          return actor;
        },
        clientFile: '/dashboard/client.js',
        port: 8090
      });
    });

    it('should create different actors for different routes', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();
      const req = { url: '/ws' };
      
      manager.handleConnection(ws1, req);
      manager.handleConnection(ws2, req);
      
      // Different routes
      manager.handleHandshake(ws1, {
        type: 'actor_handshake',
        clientRootActor: 'client-root',
        route: '/test'
      });
      
      manager.handleHandshake(ws2, {
        type: 'actor_handshake',
        clientRootActor: 'client-root',
        route: '/dashboard'
      });
      
      const conn1 = manager.connections.get(ws1);
      const conn2 = manager.connections.get(ws2);
      
      expect(conn1.serverActor.name).toBe('TestServerActor');
      expect(conn2.serverActor.name).toBe('DashboardActor');
    });
  });
});