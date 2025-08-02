/**
 * Integration tests for Storage Actor Server
 */

import { jest } from '@jest/globals';
import WebSocket from 'ws';
import { StorageActorServer } from './storage-actor-server.js';

// Mock WebSocket for testing
jest.mock('ws', () => {
  const mockWs = {
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1, // OPEN
    OPEN: 1
  };

  return {
    WebSocketServer: jest.fn().mockImplementation(() => ({
      on: jest.fn((event, handler) => {
        if (event === 'connection') {
          // Simulate connection
          setTimeout(() => handler(mockWs, {}), 10);
        }
      }),
      close: jest.fn((cb) => cb && cb()),
      clients: new Set([mockWs])
    })),
    WebSocket: jest.fn().mockImplementation(() => mockWs)
  };
});

describe('Storage Actor Server Integration', () => {
  let server;
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (server) {
      await server.shutdown();
    }
    if (client) {
      client.close();
    }
  });

  describe('End-to-End WebSocket Communication', () => {
    test('should handle complete request/response cycle', async () => {
      server = new StorageActorServer({ port: 3701 });
      await server.start();

      // Simulate client connection
      client = new WebSocket('ws://localhost:3701/storage');
      
      await new Promise(resolve => setTimeout(resolve, 20));

      // Verify connection established
      expect(server.connections.size).toBe(1);
    });

    test('should process collection find request', async () => {
      server = new StorageActorServer({ port: 3702 });
      await server.start();

      const message = {
        type: 'request',
        id: 'req-001',
        actor: 'CollectionActor',
        method: 'find',
        params: { collection: 'users', query: {} }
      };

      // Get mock WebSocket from connection
      await new Promise(resolve => setTimeout(resolve, 20));
      const [[connectionId, connection]] = Array.from(server.connections.entries());
      
      // Simulate message
      await server.handleMessage(connectionId, message);

      // Verify response sent
      expect(connection.ws.send).toHaveBeenCalled();
      const response = JSON.parse(connection.ws.send.mock.calls[0][0]);
      expect(response.type).toBe('response');
      expect(response.id).toBe('req-001');
      expect(response.success).toBe(true);
    });

    test('should handle concurrent connections', async () => {
      server = new StorageActorServer({ port: 3703 });
      await server.start();

      // Simulate multiple connections
      const mockWs1 = { on: jest.fn(), send: jest.fn(), close: jest.fn(), readyState: 1, OPEN: 1 };
      const mockWs2 = { on: jest.fn(), send: jest.fn(), close: jest.fn(), readyState: 1, OPEN: 1 };
      
      server.handleConnection(mockWs1, {});
      server.handleConnection(mockWs2, {});

      expect(server.connections.size).toBe(2);
      
      // Each connection should receive welcome message
      expect(mockWs1.send).toHaveBeenCalled();
      expect(mockWs2.send).toHaveBeenCalled();
    });

    test('should handle connection recovery', async () => {
      server = new StorageActorServer({ port: 3704 });
      await server.start();

      const mockWs = { on: jest.fn(), send: jest.fn(), close: jest.fn(), readyState: 1, OPEN: 1 };
      
      // First connection
      server.handleConnection(mockWs, {});
      const firstConnectionId = Array.from(server.connections.keys())[0];
      
      // Simulate disconnect
      const closeHandler = mockWs.on.mock.calls.find(call => call[0] === 'close')[1];
      closeHandler();
      
      expect(server.connections.has(firstConnectionId)).toBe(false);
      
      // Reconnect
      server.handleConnection(mockWs, {});
      expect(server.connections.size).toBe(1);
    });
  });

  describe('Complete Request/Response Cycles', () => {
    test('should handle CRUD operations end-to-end', async () => {
      server = new StorageActorServer({ port: 3705 });
      await server.start();

      await new Promise(resolve => setTimeout(resolve, 20));
      const [[connectionId]] = Array.from(server.connections.entries());

      // Test INSERT
      const insertMsg = {
        type: 'request',
        id: 'insert-1',
        actor: 'CollectionActor',
        method: 'insert',
        params: {
          collection: 'users',
          documents: { name: 'John', age: 30 }
        }
      };
      
      await server.handleMessage(connectionId, insertMsg);
      
      const connection = server.connections.get(connectionId);
      const insertResponse = JSON.parse(connection.ws.send.mock.calls.pop()[0]);
      expect(insertResponse.success).toBe(true);
      expect(insertResponse.data.insertedCount).toBe(1);

      // Test FIND
      const findMsg = {
        type: 'request',
        id: 'find-1',
        actor: 'CollectionActor',
        method: 'find',
        params: {
          collection: 'users',
          query: { name: 'John' }
        }
      };
      
      await server.handleMessage(connectionId, findMsg);
      
      const findResponse = JSON.parse(connection.ws.send.mock.calls.pop()[0]);
      expect(findResponse.success).toBe(true);
      expect(Array.isArray(findResponse.data)).toBe(true);

      // Test UPDATE
      const updateMsg = {
        type: 'request',
        id: 'update-1',
        actor: 'CollectionActor',
        method: 'update',
        params: {
          collection: 'users',
          filter: { name: 'John' },
          update: { $set: { age: 31 } }
        }
      };
      
      await server.handleMessage(connectionId, updateMsg);
      
      const updateResponse = JSON.parse(connection.ws.send.mock.calls.pop()[0]);
      expect(updateResponse.success).toBe(true);
      expect(updateResponse.data.modifiedCount).toBe(1);

      // Test DELETE
      const deleteMsg = {
        type: 'request',
        id: 'delete-1',
        actor: 'CollectionActor',
        method: 'delete',
        params: {
          collection: 'users',
          filter: { name: 'John' }
        }
      };
      
      await server.handleMessage(connectionId, deleteMsg);
      
      const deleteResponse = JSON.parse(connection.ws.send.mock.calls.pop()[0]);
      expect(deleteResponse.success).toBe(true);
      expect(deleteResponse.data.deletedCount).toBe(1);
    });

    test('should handle query operations', async () => {
      server = new StorageActorServer({ port: 3706 });
      await server.start();

      await new Promise(resolve => setTimeout(resolve, 20));
      const [[connectionId]] = Array.from(server.connections.entries());

      const queryMsg = {
        type: 'request',
        id: 'query-1',
        actor: 'QueryActor',
        method: 'execute',
        params: {
          collection: 'products',
          query: { price: { $gte: 100 } },
          options: { limit: 10 }
        }
      };
      
      await server.handleMessage(connectionId, queryMsg);
      
      const connection = server.connections.get(connectionId);
      const response = JSON.parse(connection.ws.send.mock.calls.pop()[0]);
      expect(response.success).toBe(true);
      expect(response.data.documents).toBeDefined();
      expect(response.data.executionTime).toBeDefined();
    });

    test('should handle error scenarios', async () => {
      server = new StorageActorServer({ port: 3707 });
      await server.start();

      await new Promise(resolve => setTimeout(resolve, 20));
      const [[connectionId]] = Array.from(server.connections.entries());

      // Invalid actor
      const invalidActorMsg = {
        type: 'request',
        id: 'err-1',
        actor: 'NonExistentActor',
        method: 'find',
        params: {}
      };
      
      await server.handleMessage(connectionId, invalidActorMsg);
      
      const connection = server.connections.get(connectionId);
      const response = JSON.parse(connection.ws.send.mock.calls.pop()[0]);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('ACTOR_NOT_FOUND');

      // Invalid method
      const invalidMethodMsg = {
        type: 'request',
        id: 'err-2',
        actor: 'CollectionActor',
        method: 'invalidMethod',
        params: {}
      };
      
      await server.handleMessage(connectionId, invalidMethodMsg);
      
      const response2 = JSON.parse(connection.ws.send.mock.calls.pop()[0]);
      expect(response2.success).toBe(false);
      expect(response2.error.message).toContain('Unknown method');
    });
  });

  describe('Subscription and Notifications', () => {
    test('should handle subscription requests', async () => {
      server = new StorageActorServer({ port: 3708 });
      await server.start();

      await new Promise(resolve => setTimeout(resolve, 20));
      const [[connectionId]] = Array.from(server.connections.entries());

      const subscribeMsg = {
        type: 'subscribe',
        id: 'sub-1',
        actor: 'CollectionActor',
        event: 'change'
      };
      
      await server.handleMessage(connectionId, subscribeMsg);
      
      const connection = server.connections.get(connectionId);
      const response = JSON.parse(connection.ws.send.mock.calls.pop()[0]);
      expect(response.success).toBe(true);
      expect(response.data.subscribed).toBe(true);
    });

    test('should handle unsubscribe requests', async () => {
      server = new StorageActorServer({ port: 3709 });
      await server.start();

      await new Promise(resolve => setTimeout(resolve, 20));
      const [[connectionId]] = Array.from(server.connections.entries());

      const unsubscribeMsg = {
        type: 'unsubscribe',
        id: 'unsub-1',
        subscriptionId: 'sub-1'
      };
      
      await server.handleMessage(connectionId, unsubscribeMsg);
      
      const connection = server.connections.get(connectionId);
      const response = JSON.parse(connection.ws.send.mock.calls.pop()[0]);
      expect(response.success).toBe(true);
      expect(response.data.unsubscribed).toBe(true);
    });
  });

  describe('Server Lifecycle', () => {
    test('should start and stop cleanly', async () => {
      server = new StorageActorServer({ port: 3710 });
      
      await server.start();
      expect(server.isRunning).toBe(true);
      
      await server.shutdown();
      expect(server.isRunning).toBe(false);
    });

    test('should cleanup resources on shutdown', async () => {
      server = new StorageActorServer({ port: 3711 });
      await server.start();

      // Add connections
      const mockWs = { on: jest.fn(), send: jest.fn(), close: jest.fn(), readyState: 1, OPEN: 1 };
      server.handleConnection(mockWs, {});
      
      expect(server.connections.size).toBe(1);
      
      await server.shutdown();
      
      expect(server.connections.size).toBe(0);
      expect(mockWs.close).toHaveBeenCalled();
    });
  });
});