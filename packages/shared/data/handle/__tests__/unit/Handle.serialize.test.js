/**
 * Handle.serialize.test.js
 *
 * Tests for updated Handle.serialize() to return metadata without GUID
 *
 * Phase 2, Steps 2.2-2.3: Test Handle.serialize() updates
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Handle } from '../../src/Handle.js';

// Mock DataSource for testing
class MockDataSource {
  constructor(schema = null, hasUpdate = false) {
    this._schema = schema;

    // Only add update method if hasUpdate is true
    if (hasUpdate) {
      this.update = (updateSpec) => {
        return true;
      };
    }
  }

  query(querySpec) {
    return [];
  }

  subscribe(querySpec, callback) {
    return { id: 'test-sub', unsubscribe: () => {} };
  }

  getSchema() {
    return this._schema;
  }

  queryBuilder(sourceHandle) {
    return {
      where: () => this,
      select: () => this,
      toArray: () => []
    };
  }
}

// Test Handle implementation
class TestHandle extends Handle {
  constructor(dataSource) {
    super(dataSource);
  }

  value() {
    return null;
  }

  query(querySpec) {
    return this.dataSource.query(querySpec);
  }
}

describe('Handle.serialize() - Phase 2', () => {
  describe('serialize() metadata', () => {
    it('should return __type: RemoteHandle', () => {
      const dataSource = new MockDataSource();
      const handle = new TestHandle(dataSource);

      const serialized = handle.serialize();

      expect(serialized.__type).toBe('RemoteHandle');
    });

    it('should return handleType from constructor name', () => {
      const dataSource = new MockDataSource();
      const handle = new TestHandle(dataSource);

      const serialized = handle.serialize();

      expect(serialized.handleType).toBe('TestHandle');
    });

    it('should return schema from dataSource.getSchema()', () => {
      const schema = {
        attributes: {
          name: { type: 'string', fullName: ':user/name' },
          email: { type: 'string', fullName: ':user/email' }
        }
      };
      const dataSource = new MockDataSource(schema);
      const handle = new TestHandle(dataSource);

      const serialized = handle.serialize();

      expect(serialized.schema).toEqual(schema);
    });

    it('should return null schema if DataSource has no schema', () => {
      const dataSource = new MockDataSource(null);
      const handle = new TestHandle(dataSource);

      const serialized = handle.serialize();

      expect(serialized.schema).toBeNull();
    });

    it('should include base capabilities', () => {
      const dataSource = new MockDataSource();
      const handle = new TestHandle(dataSource);

      const serialized = handle.serialize();

      expect(serialized.capabilities).toContain('query');
      expect(serialized.capabilities).toContain('subscribe');
      expect(serialized.capabilities).toContain('getSchema');
      expect(serialized.capabilities).toContain('queryBuilder');
    });

    it('should include update capability if DataSource supports it', () => {
      const dataSource = new MockDataSource(null, true);
      const handle = new TestHandle(dataSource);

      const serialized = handle.serialize();

      expect(serialized.capabilities).toContain('update');
    });

    it('should NOT include update capability if DataSource does not support it', () => {
      const dataSource = new MockDataSource(null, false);
      const handle = new TestHandle(dataSource);

      const serialized = handle.serialize();

      expect(serialized.capabilities).not.toContain('update');
    });

    it('should NOT return GUID (ActorSerializer handles that)', () => {
      const dataSource = new MockDataSource();
      const handle = new TestHandle(dataSource);

      const serialized = handle.serialize();

      expect(serialized['#actorGuid']).toBeUndefined();
      expect(serialized.guid).toBeUndefined();
      expect(serialized.actorGuid).toBeUndefined();
    });

    it('should validate handle is not destroyed', () => {
      const dataSource = new MockDataSource();
      const handle = new TestHandle(dataSource);

      // Destroy the handle
      handle.destroy();

      // serialize() should throw
      expect(() => handle.serialize()).toThrow(/destroyed/);
    });
  });

  describe('serialize() with complex schema', () => {
    it('should serialize complex schema with nested structures', () => {
      const schema = {
        attributes: {
          user: {
            type: 'object',
            fullName: ':entity/user',
            nested: {
              name: 'string',
              age: 'number'
            }
          },
          tags: {
            type: 'array',
            fullName: ':entity/tags',
            items: 'string'
          }
        },
        relationships: {
          posts: {
            type: 'many',
            target: 'Post'
          }
        }
      };

      const dataSource = new MockDataSource(schema);
      const handle = new TestHandle(dataSource);

      const serialized = handle.serialize();

      expect(serialized.schema).toEqual(schema);
      expect(serialized.schema.attributes.user.nested).toBeDefined();
      expect(serialized.schema.relationships).toBeDefined();
    });
  });
});