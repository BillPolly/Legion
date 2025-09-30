/**
 * ActorSerializer.RemoteHandle.integration.test.js
 *
 * Integration tests for ActorSerializer creating RemoteHandle on deserialization
 *
 * Phase 4, Steps 4.3-4.4: Integration test with real components (NO MOCKS)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Handle } from '../../Handle.js';
import { SimpleObjectHandle } from '../../SimpleObjectHandle.js';
import { SimpleObjectDataSource } from '../../SimpleObjectDataSource.js';
import { RemoteHandle } from '../RemoteHandle.js';
import { ActorSpace } from '../../../../../actors/src/ActorSpace.js';
import { ActorSerializer } from '../../../../../actors/src/ActorSerializer.js';
import { Channel } from '../../../../../actors/src/Channel.js';

// Register RemoteHandle class globally for ActorSerializer
ActorSerializer.registerRemoteHandle(RemoteHandle);

describe('ActorSerializer + RemoteHandle - Integration', () => {
  let serverSpace;
  let clientSpace;
  let serverSerializer;
  let clientSerializer;
  let serverChannel;
  let clientChannel;

  beforeEach(() => {
    // Create two ActorSpaces (server and client)
    serverSpace = new ActorSpace('server');
    clientSpace = new ActorSpace('client');

    serverSerializer = new ActorSerializer(serverSpace);
    clientSerializer = new ActorSerializer(clientSpace);

    // Create mock WebSocket pair
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

    // Create Channels
    serverChannel = new Channel(mockServerWs, serverSpace, 'server-to-client');
    clientChannel = new Channel(mockClientWs, clientSpace, 'client-to-server');

    // Set channels on ActorSpaces
    serverSpace._channel = serverChannel;
    clientSpace._channel = clientChannel;
  });

  describe('End-to-End Handle Transmission', () => {
    it('should create RemoteHandle on client when server sends Handle', () => {
      // Server: Create real Handle with data
      const data = [{ id: 1, name: 'Alice' }];
      const dataSource = new SimpleObjectDataSource(data);
      const serverHandle = new SimpleObjectHandle(dataSource);

      // Server: Serialize Handle
      const serialized = serverSerializer.serialize({ handle: serverHandle });

      // Client: Deserialize - should create RemoteHandle
      const deserialized = clientSerializer.deserialize(serialized, clientChannel);

      // Should receive RemoteHandle instance
      expect(deserialized.handle).toBeInstanceOf(RemoteHandle);
      expect(deserialized.handle).toBeInstanceOf(Handle); // RemoteHandle extends Handle
    });

    it('should preserve all Handle metadata in RemoteHandle', () => {
      const data = [{ id: 1, value: 'test' }];
      const dataSource = new SimpleObjectDataSource(data);
      const serverHandle = new SimpleObjectHandle(dataSource);

      const serialized = serverSerializer.serialize({ handle: serverHandle });
      const deserialized = clientSerializer.deserialize(serialized, clientChannel);

      const remoteHandle = deserialized.handle;

      // Should have metadata
      expect(remoteHandle._remoteHandleType).toBe('SimpleObjectHandle');
      expect(remoteHandle._schema).toBeDefined();
      expect(remoteHandle.capabilities).toContain('query');
      expect(remoteHandle.capabilities).toContain('update');
    });

    it('should verify RemoteHandle.dataSource === RemoteHandle (self-referential)', () => {
      const dataSource = new SimpleObjectDataSource([]);
      const serverHandle = new SimpleObjectHandle(dataSource);

      const serialized = serverSerializer.serialize({ handle: serverHandle });
      const deserialized = clientSerializer.deserialize(serialized, clientChannel);

      const remoteHandle = deserialized.handle;

      // Key property: RemoteHandle is its own DataSource
      expect(remoteHandle.dataSource).toBe(remoteHandle);
    });

    it('should register RemoteHandle in client ActorSpace', () => {
      const dataSource = new SimpleObjectDataSource([]);
      const serverHandle = new SimpleObjectHandle(dataSource);

      const serialized = serverSerializer.serialize({ handle: serverHandle });
      const parsed = JSON.parse(serialized);
      const guid = parsed.handle['#actorGuid'];

      const deserialized = clientSerializer.deserialize(serialized, clientChannel);
      const remoteHandle = deserialized.handle;

      // Should be registered in client ActorSpace
      expect(clientSpace.guidToObject.get(guid)).toBe(remoteHandle);
      expect(clientSpace.objectToGuid.get(remoteHandle)).toBe(guid);
    });

    it('should preserve Actor GUID from server', () => {
      const dataSource = new SimpleObjectDataSource([]);
      const serverHandle = new SimpleObjectHandle(dataSource);

      const serialized = serverSerializer.serialize({ handle: serverHandle });
      const parsed = JSON.parse(serialized);
      const serverGuid = parsed.handle['#actorGuid'];

      const deserialized = clientSerializer.deserialize(serialized, clientChannel);
      const remoteHandle = deserialized.handle;

      expect(remoteHandle.actorGuid).toBe(serverGuid);
    });

    it('should handle multiple Handles in same message', () => {
      const data1 = [{ id: 1 }];
      const data2 = [{ id: 2 }];
      const handle1 = new SimpleObjectHandle(new SimpleObjectDataSource(data1));
      const handle2 = new SimpleObjectHandle(new SimpleObjectDataSource(data2));

      const serialized = serverSerializer.serialize({
        first: handle1,
        second: handle2,
        data: { test: true }
      });

      const deserialized = clientSerializer.deserialize(serialized, clientChannel);

      // Both should be RemoteHandles
      expect(deserialized.first).toBeInstanceOf(RemoteHandle);
      expect(deserialized.second).toBeInstanceOf(RemoteHandle);

      // Both should be self-referential
      expect(deserialized.first.dataSource).toBe(deserialized.first);
      expect(deserialized.second.dataSource).toBe(deserialized.second);

      // Non-Handle data preserved
      expect(deserialized.data).toEqual({ test: true });
    });

    it('should return same RemoteHandle for repeated deserialization of same GUID', () => {
      const dataSource = new SimpleObjectDataSource([]);
      const serverHandle = new SimpleObjectHandle(dataSource);

      const serialized = serverSerializer.serialize({ handle: serverHandle });

      // First deserialization
      const deserialized1 = clientSerializer.deserialize(serialized, clientChannel);
      const remoteHandle1 = deserialized1.handle;

      // Second deserialization of same GUID
      const deserialized2 = clientSerializer.deserialize(serialized, clientChannel);
      const remoteHandle2 = deserialized2.handle;

      // Should return the SAME instance (cached in ActorSpace)
      expect(remoteHandle2).toBe(remoteHandle1);
    });
  });

  describe('RemoteHandle properties', () => {
    it('should have isRemote property', () => {
      const dataSource = new SimpleObjectDataSource([]);
      const serverHandle = new SimpleObjectHandle(dataSource);

      const serialized = serverSerializer.serialize({ handle: serverHandle });
      const deserialized = clientSerializer.deserialize(serialized, clientChannel);

      expect(deserialized.handle.isRemote).toBe(true);
    });

    it('should have access to channel', () => {
      const dataSource = new SimpleObjectDataSource([]);
      const serverHandle = new SimpleObjectHandle(dataSource);

      const serialized = serverSerializer.serialize({ handle: serverHandle });
      const deserialized = clientSerializer.deserialize(serialized, clientChannel);

      expect(deserialized.handle.getChannel()).toBe(clientChannel);
    });
  });
});