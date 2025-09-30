/**
 * RemoteQuery.E2E.test.js
 *
 * End-to-end tests for remote query execution through RemoteHandle
 *
 * Phase 7: Complete remote query flow from client to server and back
 *
 * NO MOCKS - Uses real components:
 * - Real ActorSpaces (server and client)
 * - Real Channels with WebSocket mocks
 * - Real SimpleObjectHandle and SimpleObjectDataSource
 * - Real RemoteHandle
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleObjectHandle } from '../../SimpleObjectHandle.js';
import { SimpleObjectDataSource } from '../../SimpleObjectDataSource.js';
import { RemoteHandle } from '../RemoteHandle.js';
import { ActorSpace } from '../../../../../actors/src/ActorSpace.js';
import { ActorSerializer } from '../../../../../actors/src/ActorSerializer.js';
import { Channel } from '../../../../../actors/src/Channel.js';

// Register RemoteHandle for deserialization
ActorSerializer.registerRemoteHandle(RemoteHandle);

describe('RemoteQuery - End-to-End', () => {
  let serverSpace;
  let clientSpace;
  let serverSerializer;
  let clientSerializer;
  let serverChannel;
  let clientChannel;
  let serverHandle;
  let remoteHandle;

  beforeEach(() => {
    // Create two ActorSpaces (server and client)
    serverSpace = new ActorSpace('server');
    clientSpace = new ActorSpace('client');

    serverSerializer = new ActorSerializer(serverSpace);
    clientSerializer = new ActorSerializer(clientSpace);

    // Create bidirectional WebSocket mock
    const mockServerWs = {
      send: (data) => {
        setImmediate(() => {
          if (mockClientWs.onmessage) {
            mockClientWs.onmessage({ data });
          }
        });
      },
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    const mockClientWs = {
      send: (data) => {
        setImmediate(() => {
          if (mockServerWs.onmessage) {
            mockServerWs.onmessage({ data });
          }
        });
      },
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    // Create Channels (note: Channel constructor signature is (actorSpace, endpoint))
    serverChannel = new Channel(serverSpace, mockServerWs);
    clientChannel = new Channel(clientSpace, mockClientWs);
  });

  describe('Simple Query Execution', () => {
    it('should execute query on remote Handle and return results', async () => {
      // Server: Create Handle with real data
      const data = [
        { id: 1, name: 'Alice', age: 30 },
        { id: 2, name: 'Bob', age: 25 },
        { id: 3, name: 'Charlie', age: 35 }
      ];
      const dataSource = new SimpleObjectDataSource(data);
      serverHandle = new SimpleObjectHandle(dataSource);

      // Server: Serialize and send Handle to client
      const serialized = serverSerializer.serialize({ handle: serverHandle });
      const deserialized = clientSerializer.deserialize(serialized, clientChannel);

      remoteHandle = deserialized.handle;
      expect(remoteHandle).toBeInstanceOf(RemoteHandle);

      // Client: Execute query through RemoteHandle
      const querySpec = { find: ['?item'], where: [] };
      const resultPromise = remoteHandle.query(querySpec);

      // Result should be a promise
      expect(resultPromise).toBeInstanceOf(Promise);

      // Wait for result
      const result = await resultPromise;

      // Should get data from server
      expect(result).toEqual(data);
    });

    it('should handle query with where clause', async () => {
      // Server: Create Handle with test data
      const data = [
        { id: 1, name: 'Alice', status: 'active' },
        { id: 2, name: 'Bob', status: 'inactive' },
        { id: 3, name: 'Charlie', status: 'active' }
      ];
      const dataSource = new SimpleObjectDataSource(data);
      serverHandle = new SimpleObjectHandle(dataSource);

      // Transmit to client
      const serialized = serverSerializer.serialize({ handle: serverHandle });
      const deserialized = clientSerializer.deserialize(serialized, clientChannel);
      remoteHandle = deserialized.handle;

      // Client: Query with filter
      const querySpec = {
        find: ['?item'],
        where: [['?item', 'status', 'active']]
      };
      const result = await remoteHandle.query(querySpec);

      // Should only get active users
      expect(result).toEqual([
        { id: 1, name: 'Alice', status: 'active' },
        { id: 3, name: 'Charlie', status: 'active' }
      ]);
    });

    it('should handle empty query results', async () => {
      // Server: Empty data
      const dataSource = new SimpleObjectDataSource([]);
      serverHandle = new SimpleObjectHandle(dataSource);

      const serialized = serverSerializer.serialize({ handle: serverHandle });
      const deserialized = clientSerializer.deserialize(serialized, clientChannel);
      remoteHandle = deserialized.handle;

      // Client: Query empty data
      const result = await remoteHandle.query({ find: ['?item'] });

      expect(result).toEqual([]);
    });
  });

  describe('Multiple Concurrent Queries', () => {
    it('should handle multiple concurrent queries', async () => {
      // Server: Create Handle with data
      const data = [
        { id: 1, value: 10 },
        { id: 2, value: 20 },
        { id: 3, value: 30 }
      ];
      const dataSource = new SimpleObjectDataSource(data);
      serverHandle = new SimpleObjectHandle(dataSource);

      const serialized = serverSerializer.serialize({ handle: serverHandle });
      const deserialized = clientSerializer.deserialize(serialized, clientChannel);
      remoteHandle = deserialized.handle;

      // Client: Execute multiple queries concurrently
      const query1 = remoteHandle.query({ find: ['?item'] });
      const query2 = remoteHandle.query({ find: ['?item'], where: [['?item', 'id', 1]] });
      const query3 = remoteHandle.query({ find: ['?item'], where: [['?item', 'id', 2]] });

      const [result1, result2, result3] = await Promise.all([query1, query2, query3]);

      expect(result1).toEqual(data);
      expect(result2).toEqual([{ id: 1, value: 10 }]);
      expect(result3).toEqual([{ id: 2, value: 20 }]);
    });
  });

  describe('Error Handling', () => {
    it('should propagate query errors from server to client', async () => {
      // Server: Create Handle with DataSource that throws
      const dataSource = new SimpleObjectDataSource([]);
      dataSource.query = () => {
        throw new Error('Server query failed');
      };
      serverHandle = new SimpleObjectHandle(dataSource);

      const serialized = serverSerializer.serialize({ handle: serverHandle });
      const deserialized = clientSerializer.deserialize(serialized, clientChannel);
      remoteHandle = deserialized.handle;

      // Client: Query should reject with server error
      await expect(remoteHandle.query({ find: ['?item'] })).rejects.toThrow('Server query failed');
    });
  });

  describe('Multiple Handles', () => {
    it('should handle multiple different Handles independently', async () => {
      // Server: Create two different Handles
      const users = [{ id: 1, name: 'Alice' }];
      const orders = [{ id: 10, product: 'Widget' }];

      const userHandle = new SimpleObjectHandle(new SimpleObjectDataSource(users));
      const orderHandle = new SimpleObjectHandle(new SimpleObjectDataSource(orders));

      // Send both to client
      const serialized = serverSerializer.serialize({
        users: userHandle,
        orders: orderHandle
      });
      const deserialized = clientSerializer.deserialize(serialized, clientChannel);

      const remoteUsers = deserialized.users;
      const remoteOrders = deserialized.orders;

      // Query both independently
      const userResult = await remoteUsers.query({ find: ['?item'] });
      const orderResult = await remoteOrders.query({ find: ['?item'] });

      expect(userResult).toEqual(users);
      expect(orderResult).toEqual(orders);
    });
  });

  describe('Schema Access', () => {
    it('should access schema without remote call', () => {
      // Server: Create Handle with schema
      const dataSource = new SimpleObjectDataSource([{ name: 'test', age: 25 }]);
      serverHandle = new SimpleObjectHandle(dataSource);

      const serialized = serverSerializer.serialize({ handle: serverHandle });
      const deserialized = clientSerializer.deserialize(serialized, clientChannel);
      remoteHandle = deserialized.handle;

      // Client: getSchema() should work synchronously (cached from serialization)
      const schema = remoteHandle.getSchema();

      expect(schema).toBeDefined();
      expect(schema.attributes).toBeDefined();
      // Schema should have attribute information (exact structure may vary)
      expect(Object.keys(schema.attributes).length).toBeGreaterThan(0);
    });
  });
});