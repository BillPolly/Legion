/**
 * Tests for Storage Actor Client
 */

describe('StorageActorClient', () => {
  let client;
  let mockChannel;

  beforeEach(() => {
    // Mock WebSocketChannel
    mockChannel = {
      send: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
      disconnect: jest.fn()
    };

    // Mock WebSocketChannel constructor
    jest.mock('./WebSocketChannel.js', () => ({
      WebSocketChannel: jest.fn(() => mockChannel)
    }));
  });

  afterEach(() => {
    if (client) {
      client.disconnect();
    }
    jest.clearAllMocks();
  });

  describe('Actor Protocol Implementation', () => {
    test('should create client with WebSocket URL', () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      client = new StorageActorClient('ws://localhost:3700');
      
      expect(client.url).toBe('ws://localhost:3700');
      expect(client.channel).toBeDefined();
    });

    test('should send request messages with correct format', async () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      client = new StorageActorClient('ws://localhost:3700');
      
      const promise = client.request('CollectionActor', 'find', {
        collection: 'users',
        query: {}
      });

      expect(mockChannel.send).toHaveBeenCalled();
      const sentMessage = mockChannel.send.mock.calls[0][0];
      
      expect(sentMessage.type).toBe('request');
      expect(sentMessage.actor).toBe('CollectionActor');
      expect(sentMessage.method).toBe('find');
      expect(sentMessage.params).toEqual({
        collection: 'users',
        query: {}
      });
      expect(sentMessage.id).toBeDefined();
      expect(sentMessage.timestamp).toBeDefined();
    });

    test('should handle response messages', async () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      client = new StorageActorClient('ws://localhost:3700');
      
      // Setup message handler
      let messageHandler;
      mockChannel.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });
      
      // Reinitialize to capture handler
      client = new StorageActorClient('ws://localhost:3700');
      
      // Send request
      const promise = client.request('CollectionActor', 'find', {});
      const requestId = mockChannel.send.mock.calls[0][0].id;
      
      // Simulate response
      messageHandler({
        type: 'response',
        id: requestId,
        success: true,
        data: [{ id: 1, name: 'Test' }]
      });
      
      const result = await promise;
      expect(result).toEqual([{ id: 1, name: 'Test' }]);
    });

    test('should handle error responses', async () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      
      let messageHandler;
      mockChannel.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });
      
      client = new StorageActorClient('ws://localhost:3700');
      
      const promise = client.request('CollectionActor', 'find', {});
      const requestId = mockChannel.send.mock.calls[0][0].id;
      
      // Simulate error response
      messageHandler({
        type: 'response',
        id: requestId,
        success: false,
        error: {
          message: 'Database error',
          code: 'DB_ERROR'
        }
      });
      
      await expect(promise).rejects.toThrow('Database error');
    });

    test('should handle notification messages', () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      
      let messageHandler;
      mockChannel.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });
      
      client = new StorageActorClient('ws://localhost:3700');
      
      const notificationHandler = jest.fn();
      client.on('notification', notificationHandler);
      
      // Simulate notification
      messageHandler({
        type: 'notification',
        event: 'document.updated',
        data: { id: '123', changes: {} }
      });
      
      expect(notificationHandler).toHaveBeenCalledWith({
        event: 'document.updated',
        data: { id: '123', changes: {} }
      });
    });
  });

  describe('Request/Response Correlation', () => {
    test('should correlate responses with requests', async () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      
      let messageHandler;
      mockChannel.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });
      
      client = new StorageActorClient('ws://localhost:3700');
      
      // Send multiple requests
      const promise1 = client.request('CollectionActor', 'find', { collection: 'users' });
      const promise2 = client.request('CollectionActor', 'find', { collection: 'products' });
      
      const requestId1 = mockChannel.send.mock.calls[0][0].id;
      const requestId2 = mockChannel.send.mock.calls[1][0].id;
      
      // Respond out of order
      messageHandler({
        type: 'response',
        id: requestId2,
        success: true,
        data: 'products-result'
      });
      
      messageHandler({
        type: 'response',
        id: requestId1,
        success: true,
        data: 'users-result'
      });
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe('users-result');
      expect(result2).toBe('products-result');
    });

    test('should generate unique request IDs', () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      client = new StorageActorClient('ws://localhost:3700');
      
      client.request('CollectionActor', 'find', {});
      client.request('CollectionActor', 'find', {});
      client.request('CollectionActor', 'find', {});
      
      const ids = mockChannel.send.mock.calls.map(call => call[0].id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('Timeout Handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should timeout requests after specified duration', async () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      client = new StorageActorClient('ws://localhost:3700', {
        requestTimeout: 5000
      });
      
      const promise = client.request('CollectionActor', 'find', {});
      
      // Fast-forward time
      jest.advanceTimersByTime(5001);
      
      await expect(promise).rejects.toThrow('Request timeout');
    });

    test('should clear timeout on response', async () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      
      let messageHandler;
      mockChannel.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });
      
      client = new StorageActorClient('ws://localhost:3700', {
        requestTimeout: 5000
      });
      
      const promise = client.request('CollectionActor', 'find', {});
      const requestId = mockChannel.send.mock.calls[0][0].id;
      
      // Respond before timeout
      jest.advanceTimersByTime(2000);
      
      messageHandler({
        type: 'response',
        id: requestId,
        success: true,
        data: 'result'
      });
      
      const result = await promise;
      expect(result).toBe('result');
      
      // Verify no timeout error after response
      jest.advanceTimersByTime(5000);
    });

    test('should allow custom timeout per request', async () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      client = new StorageActorClient('ws://localhost:3700', {
        requestTimeout: 5000
      });
      
      const promise = client.request('CollectionActor', 'find', {}, {
        timeout: 1000
      });
      
      jest.advanceTimersByTime(1001);
      
      await expect(promise).rejects.toThrow('Request timeout');
    });
  });

  describe('Subscription Management', () => {
    test('should subscribe to actor events', async () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      client = new StorageActorClient('ws://localhost:3700');
      
      const handler = jest.fn();
      const subscriptionId = await client.subscribe('CollectionActor', 'change', handler);
      
      expect(subscriptionId).toBeDefined();
      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'subscribe',
          actor: 'CollectionActor',
          event: 'change'
        })
      );
    });

    test('should unsubscribe from actor events', async () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      client = new StorageActorClient('ws://localhost:3700');
      
      const handler = jest.fn();
      const subscriptionId = await client.subscribe('CollectionActor', 'change', handler);
      
      await client.unsubscribe(subscriptionId);
      
      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'unsubscribe',
          subscriptionId
        })
      );
    });

    test('should route notifications to subscribers', () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      
      let messageHandler;
      mockChannel.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });
      
      client = new StorageActorClient('ws://localhost:3700');
      
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      client.subscribe('CollectionActor', 'change', handler1);
      client.subscribe('CollectionActor', 'delete', handler2);
      
      // Simulate notifications
      messageHandler({
        type: 'notification',
        event: 'CollectionActor.change',
        data: { id: '123' }
      });
      
      expect(handler1).toHaveBeenCalledWith({ id: '123' });
      expect(handler2).not.toHaveBeenCalled();
    });

    test('should handle multiple subscribers for same event', () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      
      let messageHandler;
      mockChannel.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });
      
      client = new StorageActorClient('ws://localhost:3700');
      
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      client.subscribe('CollectionActor', 'change', handler1);
      client.subscribe('CollectionActor', 'change', handler2);
      
      messageHandler({
        type: 'notification',
        event: 'CollectionActor.change',
        data: { id: '123' }
      });
      
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('Error Recovery', () => {
    test('should handle connection failures', () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      
      mockChannel.isConnected.mockReturnValue(false);
      client = new StorageActorClient('ws://localhost:3700');
      
      expect(() => {
        client.request('CollectionActor', 'find', {});
      }).toThrow('Not connected to server');
    });

    test('should clean up pending requests on disconnect', () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      
      let disconnectHandler;
      mockChannel.on.mockImplementation((event, handler) => {
        if (event === 'disconnect') {
          disconnectHandler = handler;
        }
      });
      
      client = new StorageActorClient('ws://localhost:3700');
      
      const promise = client.request('CollectionActor', 'find', {});
      
      // Simulate disconnect
      disconnectHandler();
      
      expect(promise).rejects.toThrow('Connection lost');
    });

    test('should reconnect and resume operations', () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      
      let connectHandler, disconnectHandler;
      mockChannel.on.mockImplementation((event, handler) => {
        if (event === 'connect') connectHandler = handler;
        if (event === 'disconnect') disconnectHandler = handler;
      });
      
      client = new StorageActorClient('ws://localhost:3700');
      
      // Simulate disconnect and reconnect
      mockChannel.isConnected.mockReturnValue(false);
      disconnectHandler();
      
      mockChannel.isConnected.mockReturnValue(true);
      connectHandler();
      
      // Should be able to send requests again
      expect(() => {
        client.request('CollectionActor', 'find', {});
      }).not.toThrow();
    });
  });
});