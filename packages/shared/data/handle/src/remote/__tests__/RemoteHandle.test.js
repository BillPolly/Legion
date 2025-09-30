/**
 * RemoteHandle.test.js
 *
 * Unit tests for RemoteHandle - self-referential DataSource implementation
 *
 * Phase 3, Steps 3.3-3.5: Test RemoteHandle construction and DataSource interface
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RemoteHandle } from '../RemoteHandle.js';
import { Handle } from '../../Handle.js';

describe('RemoteHandle - Phase 3', () => {
  let mockChannel;
  let metadata;

  beforeEach(() => {
    mockChannel = {
      send: () => {},
      _remoteActors: new Map()
    };

    metadata = {
      handleType: 'TestHandle',
      schema: {
        attributes: {
          name: { type: 'string', fullName: ':test/name' }
        }
      },
      capabilities: ['query', 'subscribe', 'update']
    };
  });

  describe('Construction', () => {
    it('should accept actorGuid, channel, and metadata', () => {
      const guid = 'remote-123';
      const remoteHandle = new RemoteHandle(guid, mockChannel, metadata);

      expect(remoteHandle).toBeDefined();
      expect(remoteHandle.actorGuid).toBe(guid);
      expect(remoteHandle._channel).toBe(mockChannel);
    });

    it('should extend Handle', () => {
      const remoteHandle = new RemoteHandle('guid', mockChannel, metadata);

      expect(remoteHandle).toBeInstanceOf(Handle);
    });

    it('should pass self as DataSource (super(this))', () => {
      const remoteHandle = new RemoteHandle('guid', mockChannel, metadata);

      // The Handle constructor sets this.dataSource
      // Since RemoteHandle passes 'this' to super(), dataSource should be itself
      expect(remoteHandle.dataSource).toBe(remoteHandle);
    });

    it('should store schema from metadata', () => {
      const remoteHandle = new RemoteHandle('guid', mockChannel, metadata);

      expect(remoteHandle._schema).toEqual(metadata.schema);
    });

    it('should store remote handleType from metadata', () => {
      const remoteHandle = new RemoteHandle('guid', mockChannel, metadata);

      // handleType getter returns 'RemoteHandle' (constructor name)
      expect(remoteHandle.handleType).toBe('RemoteHandle');

      // Original remote type stored separately
      expect(remoteHandle._remoteHandleType).toBe('TestHandle');
    });

    it('should store capabilities from metadata', () => {
      const remoteHandle = new RemoteHandle('guid', mockChannel, metadata);

      expect(remoteHandle.capabilities).toEqual(['query', 'subscribe', 'update']);
    });

    it('should pass DataSource validation (methods on prototype)', () => {
      // If construction succeeds, validation passed
      // Handle constructor validates DataSource interface
      expect(() => {
        new RemoteHandle('guid', mockChannel, metadata);
      }).not.toThrow();
    });
  });

  describe('DataSource Interface', () => {
    let remoteHandle;

    beforeEach(() => {
      remoteHandle = new RemoteHandle('test-guid', mockChannel, metadata);
    });

    it('should have query() method', () => {
      expect(typeof remoteHandle.query).toBe('function');
    });

    it('should have subscribe() method', () => {
      expect(typeof remoteHandle.subscribe).toBe('function');
    });

    it('should have getSchema() method', () => {
      expect(typeof remoteHandle.getSchema).toBe('function');
    });

    it('should have queryBuilder() method', () => {
      expect(typeof remoteHandle.queryBuilder).toBe('function');
    });

    describe('getSchema()', () => {
      it('should return cached schema', () => {
        const schema = remoteHandle.getSchema();

        expect(schema).toEqual(metadata.schema);
        expect(schema.attributes.name).toBeDefined();
      });

      it('should return null if no schema in metadata', () => {
        const noSchemaMetadata = {
          handleType: 'Test',
          schema: null,
          capabilities: []
        };
        const handle = new RemoteHandle('guid', mockChannel, noSchemaMetadata);

        expect(handle.getSchema()).toBeNull();
      });
    });

    describe('queryBuilder()', () => {
      it('should return a query builder', () => {
        const builder = remoteHandle.queryBuilder(remoteHandle);

        expect(builder).toBeDefined();
        expect(typeof builder.where).toBe('function');
        expect(typeof builder.select).toBe('function');
      });
    });

    describe('query() - stub for Phase 5', () => {
      it('should throw error (not yet implemented)', () => {
        expect(() => {
          remoteHandle.query({ find: ['?x'], where: [] });
        }).toThrow(/not yet implemented.*Phase 5/);
      });
    });

    describe('subscribe() - stub for Phase 7', () => {
      it('should throw error (not yet implemented)', () => {
        expect(() => {
          remoteHandle.subscribe({}, () => {});
        }).toThrow(/not yet implemented.*Phase 7/);
      });
    });

    describe('update() - stub for Phase 8', () => {
      it('should throw error if called (not yet implemented)', () => {
        expect(() => {
          remoteHandle.update({});
        }).toThrow(/not yet implemented.*Phase 8/);
      });
    });
  });

  describe('Self-Referential Property', () => {
    it('should verify dataSource === this', () => {
      const remoteHandle = new RemoteHandle('guid', mockChannel, metadata);

      // This is the key property of RemoteHandle
      expect(remoteHandle.dataSource).toBe(remoteHandle);
    });

    it('should allow calling DataSource methods on itself', () => {
      const remoteHandle = new RemoteHandle('guid', mockChannel, metadata);

      // Can call DataSource methods directly
      const schema = remoteHandle.dataSource.getSchema();
      expect(schema).toEqual(metadata.schema);

      // Or through inherited Handle methods that use this.dataSource
      const schema2 = remoteHandle.getSchema();
      expect(schema2).toEqual(metadata.schema);
    });
  });

  describe('RemoteHandle-Specific Methods', () => {
    let remoteHandle;

    beforeEach(() => {
      remoteHandle = new RemoteHandle('test-guid', mockChannel, metadata);
    });

    it('should have isRemote property returning true', () => {
      expect(remoteHandle.isRemote).toBe(true);
    });

    it('should provide getRemoteGuid()', () => {
      expect(remoteHandle.getRemoteGuid()).toBe('test-guid');
    });

    it('should provide getChannel()', () => {
      expect(remoteHandle.getChannel()).toBe(mockChannel);
    });

    it('should provide hasCapability()', () => {
      expect(remoteHandle.hasCapability('query')).toBe(true);
      expect(remoteHandle.hasCapability('update')).toBe(true);
      expect(remoteHandle.hasCapability('delete')).toBe(false);
    });
  });

  describe('Actor Integration', () => {
    it('should be an Actor (inherited from Handle)', () => {
      const remoteHandle = new RemoteHandle('guid', mockChannel, metadata);

      // Handle extends Actor, so RemoteHandle is also an Actor
      expect(remoteHandle.isActor).toBe(true);
    });
  });
});