/**
 * Integration tests for Actor Client
 */

describe('Actor Client Integration', () => {
  let client;
  let server;
  let mockWebSocket;

  beforeEach(() => {
    // Mock WebSocket globally
    mockWebSocket = {
      readyState: 1,
      OPEN: 1,
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    global.WebSocket = jest.fn(() => mockWebSocket);
  });

  afterEach(() => {
    if (client) {
      client.disconnect();
    }
    jest.clearAllMocks();
  });

  describe('Client-Server Communication', () => {
    test('should establish connection and receive welcome message', () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      client = new StorageActorClient('ws://localhost:3700');

      // Simulate connection open
      const openHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'open')[1];
      openHandler();

      // Simulate welcome message
      const messageHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'message')[1];
      
      messageHandler({
        data: JSON.stringify({
          type: 'connected',
          connectionId: 'conn-123',
          timestamp: Date.now()
        })
      });

      // Client should be connected
      expect(client.isConnected()).toBe(true);
    });

    test('should handle complete CRUD flow', async () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      
      let messageHandler;
      mockWebSocket.addEventListener.mockImplementation((event, handler) => {
        if (event === 'message') messageHandler = handler;
      });

      client = new StorageActorClient('ws://localhost:3700');

      // Simulate connection
      const openHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'open')[1];
      openHandler();

      // INSERT
      const insertPromise = client.insert('users', { name: 'John', age: 30 });
      const insertRequest = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      
      messageHandler({
        data: JSON.stringify({
          type: 'response',
          id: insertRequest.id,
          success: true,
          data: { acknowledged: true, insertedCount: 1, insertedId: 'user-1' }
        })
      });

      const insertResult = await insertPromise;
      expect(insertResult.insertedCount).toBe(1);

      // FIND
      const findPromise = client.find('users', { name: 'John' });
      const findRequest = JSON.parse(mockWebSocket.send.mock.calls[1][0]);
      
      messageHandler({
        data: JSON.stringify({
          type: 'response',
          id: findRequest.id,
          success: true,
          data: [{ _id: 'user-1', name: 'John', age: 30 }]
        })
      });

      const findResult = await findPromise;
      expect(findResult).toHaveLength(1);
      expect(findResult[0].name).toBe('John');

      // UPDATE
      const updatePromise = client.update('users', 
        { _id: 'user-1' }, 
        { $set: { age: 31 } }
      );
      const updateRequest = JSON.parse(mockWebSocket.send.mock.calls[2][0]);
      
      messageHandler({
        data: JSON.stringify({
          type: 'response',
          id: updateRequest.id,
          success: true,
          data: { acknowledged: true, modifiedCount: 1 }
        })
      });

      const updateResult = await updatePromise;
      expect(updateResult.modifiedCount).toBe(1);

      // DELETE
      const deletePromise = client.delete('users', { _id: 'user-1' });
      const deleteRequest = JSON.parse(mockWebSocket.send.mock.calls[3][0]);
      
      messageHandler({
        data: JSON.stringify({
          type: 'response',
          id: deleteRequest.id,
          success: true,
          data: { acknowledged: true, deletedCount: 1 }
        })
      });

      const deleteResult = await deletePromise;
      expect(deleteResult.deletedCount).toBe(1);
    });

    test('should handle real-time notifications', () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      
      let messageHandler;
      mockWebSocket.addEventListener.mockImplementation((event, handler) => {
        if (event === 'message') messageHandler = handler;
      });

      client = new StorageActorClient('ws://localhost:3700');

      const notificationHandler = jest.fn();
      client.on('notification', notificationHandler);

      // Simulate notifications
      messageHandler({
        data: JSON.stringify({
          type: 'notification',
          event: 'document.created',
          data: { collection: 'users', id: 'user-2' }
        })
      });

      expect(notificationHandler).toHaveBeenCalledWith({
        event: 'document.created',
        data: { collection: 'users', id: 'user-2' }
      });

      messageHandler({
        data: JSON.stringify({
          type: 'notification',
          event: 'document.updated',
          data: { collection: 'users', id: 'user-2', changes: { status: 'active' } }
        })
      });

      expect(notificationHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Recovery', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should handle connection loss and recovery', () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      
      let openHandler, closeHandler;
      mockWebSocket.addEventListener.mockImplementation((event, handler) => {
        if (event === 'open') openHandler = handler;
        if (event === 'close') closeHandler = handler;
      });

      client = new StorageActorClient('ws://localhost:3700', {
        autoReconnect: true,
        reconnectDelay: 1000
      });

      // Connect
      mockWebSocket.readyState = 1;
      openHandler();
      expect(client.isConnected()).toBe(true);

      // Disconnect
      mockWebSocket.readyState = 3;
      closeHandler({ code: 1006, reason: 'Abnormal closure' });
      expect(client.isConnected()).toBe(false);

      // Should attempt reconnection
      jest.advanceTimersByTime(1000);
      
      // Simulate successful reconnection
      global.WebSocket.mockImplementationOnce(() => {
        const newWs = { ...mockWebSocket, readyState: 1 };
        setTimeout(() => {
          mockWebSocket.readyState = 1;
          openHandler();
        }, 100);
        return newWs;
      });

      jest.advanceTimersByTime(100);
      expect(client.isConnected()).toBe(true);
    });

    test('should queue messages during disconnection', () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      
      let openHandler;
      mockWebSocket.addEventListener.mockImplementation((event, handler) => {
        if (event === 'open') openHandler = handler;
      });

      client = new StorageActorClient('ws://localhost:3700');

      // Start disconnected
      mockWebSocket.readyState = 0;
      
      // Try to send request while disconnected
      expect(() => {
        client.request('CollectionActor', 'find', {});
      }).toThrow('Not connected to server');

      // Connect
      mockWebSocket.readyState = 1;
      openHandler();

      // Now request should work
      expect(() => {
        client.request('CollectionActor', 'find', {});
      }).not.toThrow();
    });

    test('should handle request timeout and retry', async () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      
      let messageHandler;
      mockWebSocket.addEventListener.mockImplementation((event, handler) => {
        if (event === 'message') messageHandler = handler;
        if (event === 'open') handler();
      });

      mockWebSocket.readyState = 1;
      client = new StorageActorClient('ws://localhost:3700', {
        requestTimeout: 5000
      });

      // Send request
      const promise = client.find('users', {});
      
      // Let it timeout
      jest.advanceTimersByTime(5001);
      
      await expect(promise).rejects.toThrow('Request timeout');
    });
  });

  describe('Subscription Management', () => {
    test('should handle subscription lifecycle', async () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      
      let messageHandler;
      mockWebSocket.addEventListener.mockImplementation((event, handler) => {
        if (event === 'message') messageHandler = handler;
        if (event === 'open') handler();
      });

      mockWebSocket.readyState = 1;
      client = new StorageActorClient('ws://localhost:3700');

      const changeHandler = jest.fn();
      
      // Subscribe
      const subId = await client.subscribe('CollectionActor', 'change', changeHandler);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"subscribe"')
      );

      // Receive notification
      messageHandler({
        data: JSON.stringify({
          type: 'notification',
          event: 'CollectionActor.change',
          data: { collection: 'users', operation: 'insert' }
        })
      });

      expect(changeHandler).toHaveBeenCalledWith({
        collection: 'users',
        operation: 'insert'
      });

      // Unsubscribe
      await client.unsubscribe(subId);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"unsubscribe"')
      );
    });
  });

  describe('Complete Message Flow', () => {
    test('should handle complex query operations', async () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      
      let messageHandler;
      mockWebSocket.addEventListener.mockImplementation((event, handler) => {
        if (event === 'message') messageHandler = handler;
        if (event === 'open') handler();
      });

      mockWebSocket.readyState = 1;
      client = new StorageActorClient('ws://localhost:3700');

      // Execute complex query
      const queryPromise = client.executeQuery('products', {
        price: { $gte: 100, $lte: 500 },
        category: 'electronics',
        inStock: true
      }, {
        sort: { price: 1 },
        limit: 10
      });

      const request = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(request.actor).toBe('QueryActor');
      expect(request.method).toBe('execute');

      // Simulate response
      messageHandler({
        data: JSON.stringify({
          type: 'response',
          id: request.id,
          success: true,
          data: {
            documents: [
              { _id: '1', name: 'Laptop', price: 450 },
              { _id: '2', name: 'Monitor', price: 200 }
            ],
            total: 2,
            executionTime: 15
          }
        })
      });

      const result = await queryPromise;
      expect(result.documents).toHaveLength(2);
      expect(result.executionTime).toBe(15);
    });

    test('should handle collection management operations', async () => {
      const { StorageActorClient } = require('./StorageActorClient.js');
      
      let messageHandler;
      mockWebSocket.addEventListener.mockImplementation((event, handler) => {
        if (event === 'message') messageHandler = handler;
        if (event === 'open') handler();
      });

      mockWebSocket.readyState = 1;
      client = new StorageActorClient('ws://localhost:3700');

      // List collections
      const listPromise = client.listCollections();
      const listRequest = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      
      messageHandler({
        data: JSON.stringify({
          type: 'response',
          id: listRequest.id,
          success: true,
          data: ['users', 'products', 'orders']
        })
      });

      const collections = await listPromise;
      expect(collections).toEqual(['users', 'products', 'orders']);

      // Count documents
      const countPromise = client.count('users', { status: 'active' });
      const countRequest = JSON.parse(mockWebSocket.send.mock.calls[1][0]);
      
      messageHandler({
        data: JSON.stringify({
          type: 'response',
          id: countRequest.id,
          success: true,
          data: 42
        })
      });

      const count = await countPromise;
      expect(count).toBe(42);
    });
  });
});