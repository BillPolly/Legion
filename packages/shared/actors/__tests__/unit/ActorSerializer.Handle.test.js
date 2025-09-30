/**
 * ActorSerializer.Handle.test.js
 *
 * Tests for ActorSerializer properly serializing Handles with both Actor GUID and Handle metadata
 *
 * Phase 1, Step 1.3: Test ActorSerializer.serialize() with Handles
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActorSpace } from '../../src/ActorSpace.js';
import { ActorSerializer } from '../../src/ActorSerializer.js';

describe('ActorSerializer - Handle Serialization', () => {
  let actorSpace;
  let serializer;

  beforeEach(() => {
    actorSpace = new ActorSpace('test-space');
    serializer = new ActorSerializer(actorSpace);
  });

  describe('serialize() with Handle-like Actors', () => {
    it('should check isActor before serialize() method', () => {
      // Create mock Handle with both isActor and serialize()
      const mockHandle = {
        isActor: true,
        serialize: () => ({
          __type: 'RemoteHandle',
          handleType: 'TestHandle',
          schema: { test: true },
          capabilities: ['query']
        })
      };

      // Serialize the mock Handle
      const result = serializer.serialize({ handle: mockHandle });
      const parsed = JSON.parse(result);

      // Should have the Handle in the result
      expect(parsed.handle).toBeDefined();
      expect(parsed.handle['#actorGuid']).toBeDefined();
      expect(parsed.handle.__type).toBe('RemoteHandle');
    });

    it('should generate GUID for Handle', () => {
      const mockHandle = {
        isActor: true,
        serialize: () => ({
          __type: 'RemoteHandle',
          handleType: 'TestHandle',
          schema: {},
          capabilities: []
        })
      };

      const result = serializer.serialize({ handle: mockHandle });
      const parsed = JSON.parse(result);

      // Should have Actor GUID
      expect(parsed.handle['#actorGuid']).toMatch(/^test-space-\d+$/);
    });

    it('should register Handle in ActorSpace', () => {
      const mockHandle = {
        isActor: true,
        serialize: () => ({
          __type: 'RemoteHandle',
          handleType: 'TestHandle'
        })
      };

      const result = serializer.serialize({ handle: mockHandle });
      const parsed = JSON.parse(result);
      const guid = parsed.handle['#actorGuid'];

      // Should be registered in ActorSpace
      expect(actorSpace.guidToObject.get(guid)).toBe(mockHandle);
      expect(actorSpace.objectToGuid.get(mockHandle)).toBe(guid);
    });

    it('should call Handle.serialize() and merge with GUID', () => {
      const mockHandle = {
        isActor: true,
        serialize: () => ({
          __type: 'RemoteHandle',
          handleType: 'TestHandle',
          schema: { attributes: { name: 'string' } },
          capabilities: ['query', 'update']
        })
      };

      const result = serializer.serialize({ handle: mockHandle });
      const parsed = JSON.parse(result);

      // Should have both GUID and Handle metadata
      expect(parsed.handle['#actorGuid']).toBeDefined();
      expect(parsed.handle.__type).toBe('RemoteHandle');
      expect(parsed.handle.handleType).toBe('TestHandle');
      expect(parsed.handle.schema).toEqual({ attributes: { name: 'string' } });
      expect(parsed.handle.capabilities).toEqual(['query', 'update']);
    });

    it('should handle Handle without serialize() method (standard Actor)', () => {
      const standardActor = {
        isActor: true
        // No serialize() method
      };

      const result = serializer.serialize({ actor: standardActor });
      const parsed = JSON.parse(result);

      // Should have only GUID, no additional metadata
      expect(parsed.actor['#actorGuid']).toBeDefined();
      expect(parsed.actor.__type).toBeUndefined();
      expect(parsed.actor.handleType).toBeUndefined();
    });

    it('should reuse existing GUID for already registered Handle', () => {
      const mockHandle = {
        isActor: true,
        serialize: () => ({ __type: 'RemoteHandle' })
      };

      // First serialization
      const result1 = serializer.serialize({ handle: mockHandle });
      const parsed1 = JSON.parse(result1);
      const guid1 = parsed1.handle['#actorGuid'];

      // Second serialization
      const result2 = serializer.serialize({ handle: mockHandle });
      const parsed2 = JSON.parse(result2);
      const guid2 = parsed2.handle['#actorGuid'];

      // Should reuse same GUID
      expect(guid1).toBe(guid2);
    });
  });

  describe('deserialize() with RemoteHandle marker', () => {
    it('should detect __type: RemoteHandle', () => {
      const serialized = JSON.stringify({
        test: {
          '#actorGuid': 'server-123',
          __type: 'RemoteHandle',
          handleType: 'TestHandle',
          schema: {},
          capabilities: []
        }
      });

      // For now, this should throw an error since RemoteHandle doesn't exist yet
      expect(() => {
        serializer.deserialize(serialized, null);
      }).toThrow(/RemoteHandle/);
    });

    it('should extract all metadata from RemoteHandle marker', () => {
      const handleData = {
        '#actorGuid': 'server-123',
        __type: 'RemoteHandle',
        handleType: 'ImageHandle',
        schema: { attributes: { url: 'string' } },
        capabilities: ['query', 'subscribe']
      };

      const serialized = JSON.stringify({ handle: handleData });

      // Try to deserialize - should throw with clear error for now
      try {
        serializer.deserialize(serialized, null);
        throw new Error('Should have thrown');
      } catch (error) {
        // Error should mention RemoteHandle
        expect(error.message).toMatch(/RemoteHandle/);
      }
    });

    it('should handle standard Actor without RemoteHandle marker', () => {
      // Create a standard Actor first
      const actor = { isActor: true };
      const serialized = serializer.serialize({ actor });

      // Create new ActorSpace for deserialization
      const clientSpace = new ActorSpace('client-space');
      const clientSerializer = new ActorSerializer(clientSpace);

      // Mock channel with proper interface
      const mockChannel = {
        _remoteActors: new Map(),
        makeRemote: (guid) => {
          const remoteActor = {
            isActor: true,
            isRemote: true,
            guid,
            _channel: mockChannel
          };
          mockChannel._remoteActors.set(guid, remoteActor);
          return remoteActor;
        }
      };

      // Set channel on ActorSpace (required for makeRemote to work)
      clientSpace._channel = mockChannel;

      // Deserialize - should create RemoteActor
      const result = clientSerializer.deserialize(serialized, mockChannel);

      expect(result.actor).toBeDefined();
      expect(result.actor.isRemote).toBe(true);
      expect(result.actor.guid).toBeDefined();
    });
  });
});