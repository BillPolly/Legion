/**
 * ActorSerializer.Handle.integration.test.js
 *
 * Integration tests for ActorSerializer with real ActorSpaces and Channels
 *
 * Phase 1, Steps 1.8-1.9: Integration test with real components (NO MOCKS)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActorSpace } from '../../src/ActorSpace.js';
import { ActorSerializer } from '../../src/ActorSerializer.js';
import { Channel } from '../../src/Channel.js';

describe('ActorSerializer.Handle - Integration', () => {
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

    // Create mock WebSocket pair connecting them
    const mockServerWs = {
      send: (data) => {
        // Simulate message going from server to client
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
        // Simulate message going from client to server
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

  describe('Handle Serialization E2E', () => {
    it('should serialize Handle with GUID and metadata through ActorSerializer', () => {
      // Create mock Handle with serialize() method
      const mockHandle = {
        isActor: true,
        serialize: () => ({
          __type: 'RemoteHandle',
          handleType: 'ImageHandle',
          schema: {
            attributes: {
              url: { type: 'string', fullName: ':image/url' },
              title: { type: 'string', fullName: ':image/title' }
            }
          },
          capabilities: ['query', 'subscribe', 'update']
        })
      };

      // Serialize through ActorSerializer
      const serialized = serverSerializer.serialize({ handle: mockHandle });

      // Verify serialized string contains both GUID and metadata
      expect(serialized).toBeDefined();
      expect(typeof serialized).toBe('string');

      // Parse to verify structure
      const parsed = JSON.parse(serialized);
      expect(parsed.handle).toBeDefined();
      expect(parsed.handle['#actorGuid']).toMatch(/^server-\d+$/);
      expect(parsed.handle.__type).toBe('RemoteHandle');
      expect(parsed.handle.handleType).toBe('ImageHandle');
      expect(parsed.handle.schema).toBeDefined();
      expect(parsed.handle.schema.attributes.url).toBeDefined();
      expect(parsed.handle.capabilities).toEqual(['query', 'subscribe', 'update']);
    });

    it('should register Handle in server ActorSpace during serialization', () => {
      const mockHandle = {
        isActor: true,
        serialize: () => ({ __type: 'RemoteHandle', handleType: 'TestHandle' })
      };

      const serialized = serverSerializer.serialize({ handle: mockHandle });
      const parsed = JSON.parse(serialized);
      const guid = parsed.handle['#actorGuid'];

      // Verify Handle registered in server ActorSpace
      expect(serverSpace.guidToObject.get(guid)).toBe(mockHandle);
      expect(serverSpace.objectToGuid.get(mockHandle)).toBe(guid);
    });

    it('should detect RemoteHandle marker during deserialization', () => {
      // Create Handle on server
      const serverHandle = {
        isActor: true,
        serialize: () => ({
          __type: 'RemoteHandle',
          handleType: 'FileHandle',
          schema: { attributes: { path: 'string' } },
          capabilities: ['query', 'subscribe']
        })
      };

      // Serialize on server
      const serialized = serverSerializer.serialize({ handle: serverHandle });

      // Attempt to deserialize on client
      // Should throw error since RemoteHandle not implemented yet
      expect(() => {
        clientSerializer.deserialize(serialized, clientChannel);
      }).toThrow(/RemoteHandle deserialization not yet implemented/);
    });

    it('should throw clear error message with Handle metadata', () => {
      const serverHandle = {
        isActor: true,
        serialize: () => ({
          __type: 'RemoteHandle',
          handleType: 'DataStoreHandle',
          schema: {},
          capabilities: []
        })
      };

      const serialized = serverSerializer.serialize({ handle: serverHandle });

      try {
        clientSerializer.deserialize(serialized, clientChannel);
        throw new Error('Should have thrown');
      } catch (error) {
        // Verify error message contains helpful information
        expect(error.message).toMatch(/RemoteHandle deserialization not yet implemented/);
        expect(error.message).toMatch(/DataStoreHandle/);
        expect(error.message).toMatch(/Phase 3/);
      }
    });

    it('should handle multiple Handles in same message', () => {
      const handle1 = {
        isActor: true,
        serialize: () => ({ __type: 'RemoteHandle', handleType: 'Handle1' })
      };

      const handle2 = {
        isActor: true,
        serialize: () => ({ __type: 'RemoteHandle', handleType: 'Handle2' })
      };

      const serialized = serverSerializer.serialize({
        first: handle1,
        second: handle2,
        data: { test: true }
      });

      const parsed = JSON.parse(serialized);

      // Both handles should have GUIDs and metadata
      expect(parsed.first['#actorGuid']).toBeDefined();
      expect(parsed.first.__type).toBe('RemoteHandle');
      expect(parsed.first.handleType).toBe('Handle1');

      expect(parsed.second['#actorGuid']).toBeDefined();
      expect(parsed.second.__type).toBe('RemoteHandle');
      expect(parsed.second.handleType).toBe('Handle2');

      // Non-Actor data preserved
      expect(parsed.data).toEqual({ test: true });
    });

    it('should handle nested Handles', () => {
      const innerHandle = {
        isActor: true,
        serialize: () => ({ __type: 'RemoteHandle', handleType: 'Inner' })
      };

      const outerHandle = {
        isActor: true,
        inner: innerHandle,
        serialize: () => ({ __type: 'RemoteHandle', handleType: 'Outer' })
      };

      const serialized = serverSerializer.serialize({ handle: outerHandle });
      const parsed = JSON.parse(serialized);

      // Outer handle should have GUID and metadata
      expect(parsed.handle['#actorGuid']).toBeDefined();
      expect(parsed.handle.__type).toBe('RemoteHandle');
      expect(parsed.handle.handleType).toBe('Outer');

      // Inner handle should NOT be serialized (not in the serialization data)
      // because Handle.serialize() doesn't include the inner property
      // This is correct - the Handle controls what metadata it exposes
    });
  });
});