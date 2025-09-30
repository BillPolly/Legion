/**
 * Handle.serialize.integration.test.js
 *
 * Integration tests for Handle.serialize() with real DataSource and ActorSerializer
 *
 * Phase 2, Steps 2.5-2.6: Integration test with real components
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleObjectHandle } from '../../src/SimpleObjectHandle.js';
import { SimpleObjectDataSource } from '../../src/SimpleObjectDataSource.js';
import { ActorSpace } from '../../../../actors/src/ActorSpace.js';
import { ActorSerializer } from '../../../../actors/src/ActorSerializer.js';

describe('Handle.serialize() - Integration', () => {
  let actorSpace;
  let serializer;

  beforeEach(() => {
    actorSpace = new ActorSpace('test-space');
    serializer = new ActorSerializer(actorSpace);
  });

  describe('with real SimpleObjectHandle', () => {
    it('should serialize with schema from SimpleObjectDataSource', () => {
      // Create real data source with test data
      const data = [
        { id: 1, name: 'Alice', age: 30 },
        { id: 2, name: 'Bob', age: 25 }
      ];
      const dataSource = new SimpleObjectDataSource(data);

      // Create real Handle
      const handle = new SimpleObjectHandle(dataSource);

      // Call serialize directly
      const serialized = handle.serialize();

      // Should have all metadata
      expect(serialized.__type).toBe('RemoteHandle');
      expect(serialized.handleType).toBe('SimpleObjectHandle');
      expect(serialized.capabilities).toContain('query');
      expect(serialized.capabilities).toContain('subscribe');
      expect(serialized.capabilities).toContain('update');

      // SimpleObjectDataSource infers schema from data
      expect(serialized.schema).toBeDefined();
      expect(serialized.schema.attributes).toBeDefined();

      // Should NOT have GUID
      expect(serialized['#actorGuid']).toBeUndefined();
    });

    it('should work end-to-end through ActorSerializer', () => {
      const data = [{ id: 1, value: 'test' }];
      const dataSource = new SimpleObjectDataSource(data);
      const handle = new SimpleObjectHandle(dataSource);

      // Serialize through ActorSerializer
      const serializedString = serializer.serialize({ handle });
      const parsed = JSON.parse(serializedString);

      // Should have both GUID and metadata
      expect(parsed.handle['#actorGuid']).toBeDefined();
      expect(parsed.handle['#actorGuid']).toMatch(/^test-space-\d+$/);

      expect(parsed.handle.__type).toBe('RemoteHandle');
      expect(parsed.handle.handleType).toBe('SimpleObjectHandle');
      expect(parsed.handle.schema).toBeDefined();
      expect(parsed.handle.schema.attributes).toBeDefined();
      expect(parsed.handle.capabilities).toContain('query');
      expect(parsed.handle.capabilities).toContain('update');
    });

    it('should register Handle in ActorSpace during ActorSerializer serialization', () => {
      const dataSource = new SimpleObjectDataSource([]);
      const handle = new SimpleObjectHandle(dataSource);

      const serializedString = serializer.serialize({ handle });
      const parsed = JSON.parse(serializedString);
      const guid = parsed.handle['#actorGuid'];

      // Handle should be registered
      expect(actorSpace.guidToObject.get(guid)).toBe(handle);
      expect(actorSpace.objectToGuid.get(handle)).toBe(guid);
    });

    it('should serialize multiple Handles independently', () => {
      const data1 = [{ id: 1 }];
      const data2 = [{ id: 2 }];
      const handle1 = new SimpleObjectHandle(new SimpleObjectDataSource(data1));
      const handle2 = new SimpleObjectHandle(new SimpleObjectDataSource(data2));

      const serializedString = serializer.serialize({
        first: handle1,
        second: handle2
      });
      const parsed = JSON.parse(serializedString);

      // Both should have different GUIDs
      expect(parsed.first['#actorGuid']).toBeDefined();
      expect(parsed.second['#actorGuid']).toBeDefined();
      expect(parsed.first['#actorGuid']).not.toBe(parsed.second['#actorGuid']);

      // Both should have metadata
      expect(parsed.first.__type).toBe('RemoteHandle');
      expect(parsed.second.__type).toBe('RemoteHandle');
    });
  });

  describe('Handle with inferred schema', () => {
    it('should include schema inferred by SimpleObjectDataSource', () => {
      const dataSource = new SimpleObjectDataSource([{ id: 1, name: 'test' }]);
      const handle = new SimpleObjectHandle(dataSource);

      const serialized = handle.serialize();

      expect(serialized.schema).toBeDefined();
      expect(serialized.schema.attributes).toBeDefined();
      expect(serialized.__type).toBe('RemoteHandle');
      expect(serialized.capabilities).toBeDefined();
    });
  });

  describe('Handle capabilities detection', () => {
    it('should detect update capability from DataSource', () => {
      // SimpleObjectDataSource has update() method
      const dataSource = new SimpleObjectDataSource([{ id: 1 }]);
      const handle = new SimpleObjectHandle(dataSource);

      const serialized = handle.serialize();

      expect(serialized.capabilities).toContain('update');
    });

    it('should always include base capabilities', () => {
      const dataSource = new SimpleObjectDataSource([]);
      const handle = new SimpleObjectHandle(dataSource);

      const serialized = handle.serialize();

      expect(serialized.capabilities).toContain('query');
      expect(serialized.capabilities).toContain('subscribe');
      expect(serialized.capabilities).toContain('getSchema');
      expect(serialized.capabilities).toContain('queryBuilder');
    });
  });
});