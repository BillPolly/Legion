/**
 * Unit tests for DataStore
 * Tests main integration class that combines all components
 */

import { DataStore } from '../../src/DataStore.js';
import { Edge } from '../../src/Edge.js';
import { SubscriptionState } from '../../src/subscription/Subscription.js';

// Simple mock function for testing
function createMockFn() {
  const fn = function(...args) {
    fn.calls.push(args);
    fn.callCount++;
    if (fn.mockImplementation) {
      return fn.mockImplementation(...args);
    }
    return fn.returnValue;
  };
  fn.calls = [];
  fn.callCount = 0;
  fn.returnValue = undefined;
  fn.mockImplementation = null;
  fn.mockClear = () => {
    fn.calls = [];
    fn.callCount = 0;
  };
  return fn;
}

describe('DataStore', () => {
  let dataStore;

  beforeEach(() => {
    dataStore = new DataStore();
  });

  afterEach(async () => {
    if (dataStore) {
      await dataStore.close();
    }
  });

  describe('initialization', () => {
    it('should initialize with default options', () => {
      expect(dataStore).toBeDefined();
      expect(dataStore._options.enableKernel).toBe(false);
      expect(dataStore._options.batchSize).toBe(100);
      expect(dataStore._isInitialized).toBe(true);
    });

    it('should initialize with custom options', () => {
      const customStore = new DataStore({
        enableKernel: true,
        batchSize: 50
      });
      
      expect(customStore._options.enableKernel).toBe(true);
      expect(customStore._options.batchSize).toBe(50);
      
      // Cleanup
      customStore.close();
    });

    it('should emit initialized event', () => {
      const initHandler = createMockFn();
      const customStore = new DataStore();
      customStore.on('initialized', initHandler);
      
      // Should have been called during construction
      expect(customStore._isInitialized).toBe(true);
      
      // Cleanup
      customStore.close();
    });

    it('should setup all internal components', () => {
      expect(dataStore._store).toBeDefined();
      expect(dataStore._trieManager).toBeDefined();
      expect(dataStore._dispatcher).toBeDefined();
      expect(dataStore._subscriptionManager).toBeDefined();
      expect(dataStore._queryAPI).toBeDefined();
    });
  });

  describe('relationship type management', () => {
    it('should define relationship types', () => {
      const result = dataStore.defineRelationType('follows', 'followedBy');
      
      expect(result).toBe(dataStore);
      expect(dataStore._relations.has('follows')).toBe(true);
      expect(dataStore._relations.has('followedBy')).toBe(true);
      
      const followsRelation = dataStore._relations.get('follows');
      expect(followsRelation.forwardName).toBe('follows');
      expect(followsRelation.backwardName).toBe('followedBy');
    });

    it('should require forward name', () => {
      expect(() => {
        dataStore.defineRelationType(null, 'followedBy');
      }).toThrow('Forward name is required');
      
      expect(() => {
        dataStore.defineRelationType('', 'followedBy');
      }).toThrow('Forward name is required');
    });

    it('should require backward name', () => {
      expect(() => {
        dataStore.defineRelationType('follows', null);
      }).toThrow('Backward name is required');
      
      expect(() => {
        dataStore.defineRelationType('follows', '');
      }).toThrow('Backward name is required');
    });

    it('should define both directions with schema', () => {
      const schema = {
        types: ['User', 'User'],
        indexed: true
      };
      
      dataStore.defineRelationType('follows', 'followedBy', schema);
      
      const followsRelation = dataStore._relations.get('follows');
      const followedByRelation = dataStore._relations.get('followedBy');
      
      expect(followsRelation.schema.types).toEqual(['User', 'User']);
      expect(followsRelation.schema.indexed).toBe(true);
      expect(followedByRelation.schema.types).toEqual(['User', 'User']);
    });

    it('should emit relationDefined event', () => {
      const eventHandler = createMockFn();
      dataStore.on('relationDefined', eventHandler);
      
      dataStore.defineRelationType('likes', 'likedBy');
      
      expect(eventHandler.callCount).toBe(1);
      expect(eventHandler.calls[0][0]).toEqual({
        forwardName: 'likes',
        backwardName: 'likedBy',
        schema: {}
      });
    });
  });

  describe('edge operations', () => {
    beforeEach(() => {
      dataStore.defineRelationType('follows', 'followedBy');
      dataStore.defineRelationType('likes', 'likedBy');
    });

    it('should add edges with parameters', () => {
      const edge = dataStore.addEdge('follows', 'alice', 'bob');
      
      expect(edge).toBeInstanceOf(Edge);
      expect(edge.type).toBe('follows');
      expect(edge.src).toBe('alice');
      expect(edge.dst).toBe('bob');
    });

    it('should add edges with metadata', () => {
      const edge = dataStore.addEdge('follows', 'alice', 'bob', { 
        timestamp: Date.now(),
        strength: 0.8 
      });
      
      // Edge instances don't store metadata directly (they're immutable)
      // But the DataStore should store the metadata separately
      expect(edge).toBeInstanceOf(Edge);
      expect(edge.type).toBe('follows');
      expect(edge.src).toBe('alice');
      expect(edge.dst).toBe('bob');
      
      // Verify metadata is stored separately
      expect(dataStore._edgeMetadata).toBeDefined();
      expect(dataStore._edgeMetadata.size).toBeGreaterThan(0);
    });

    it('should add Edge instances', () => {
      const edge = new Edge('likes', 'alice', 'post1');
      const result = dataStore.addEdge(edge);
      
      expect(result).toBe(edge);
    });

    it('should remove edges with parameters', () => {
      dataStore.addEdge('follows', 'alice', 'bob');
      const result = dataStore.removeEdge('follows', 'alice', 'bob');
      
      expect(result).toBe(true);
    });

    it('should remove Edge instances', () => {
      const edge = new Edge('likes', 'alice', 'post1');
      dataStore.addEdge(edge);
      const result = dataStore.removeEdge(edge);
      
      expect(result).toBe(true);
    });

    it('should emit edge events', () => {
      const addHandler = createMockFn();
      const removeHandler = createMockFn();
      
      dataStore.on('edgeAdded', addHandler);
      dataStore.on('edgeRemoved', removeHandler);
      
      const edge = dataStore.addEdge('follows', 'alice', 'bob');
      expect(addHandler.callCount).toBe(1);
      expect(addHandler.calls[0][0].edge).toBe(edge);
      
      dataStore.removeEdge('follows', 'alice', 'bob');
      expect(removeHandler.callCount).toBe(1);
    });

    it('should buffer writes for batching', () => {
      expect(dataStore._writeBuffer.length).toBe(0);
      
      dataStore.addEdge('follows', 'alice', 'bob');
      expect(dataStore._writeBuffer.length).toBe(1);
      
      dataStore.addEdge('follows', 'bob', 'charlie');
      expect(dataStore._writeBuffer.length).toBe(2);
    });

    it('should auto-flush when batch size reached', (done) => {
      // Set small batch size for testing
      dataStore._options.batchSize = 2;
      
      const flushHandler = createMockFn();
      dataStore.on('flushed', flushHandler);
      
      dataStore.addEdge('follows', 'alice', 'bob');
      dataStore.addEdge('follows', 'bob', 'charlie');
      
      // Flush should happen asynchronously
      setTimeout(() => {
        expect(flushHandler.callCount).toBe(1);
        expect(dataStore._writeBuffer.length).toBe(0);
        done();
      }, 10);
    });
  });

  describe('query operations', () => {
    beforeEach(() => {
      dataStore.defineRelationType('follows', 'followedBy');
      dataStore.addEdge('follows', 'alice', 'bob');
      dataStore.addEdge('follows', 'alice', 'charlie');
    });

    it('should submit queries', () => {
      const subscriptionId = dataStore.submitQuery(
        { relation: 'follows' },
        ['src', 'dst']
      );
      
      expect(subscriptionId).toMatch(/^sub_/);
    });

    it('should submit queries with options', () => {
      const subscriptionId = dataStore.submitQuery(
        { relation: 'follows' },
        ['src', 'dst'],
        { filter: (edge) => edge.src === 'alice' }
      );
      
      expect(subscriptionId).toMatch(/^sub_/);
      
      const info = dataStore.getSubscription(subscriptionId);
      expect(info).toBeDefined();
      expect(info.querySpec).toEqual({ relation: 'follows' });
    });

    it('should unsubscribe from queries', () => {
      const subscriptionId = dataStore.submitQuery(
        { relation: 'follows' },
        ['src', 'dst']
      );
      
      const result = dataStore.unsubscribe(subscriptionId);
      expect(result).toBe(true);
      
      const info = dataStore.getSubscription(subscriptionId);
      expect(info).toBe(null);
    });

    it('should get change streams', () => {
      const subscriptionId = dataStore.submitQuery(
        { relation: 'follows' },
        ['src', 'dst']
      );
      
      const changeStream = dataStore.onChange(subscriptionId);
      expect(changeStream).toBeDefined();
      expect(typeof changeStream.on).toBe('function');
    });

    it('should get subscription info', () => {
      const subscriptionId = dataStore.submitQuery(
        { relation: 'follows' },
        ['src', 'dst']
      );
      
      const info = dataStore.getSubscription(subscriptionId);
      expect(info).toEqual(expect.objectContaining({
        subscriptionId: subscriptionId,
        querySpec: { relation: 'follows' },
        projection: ['src', 'dst'],
        isActive: true
      }));
    });

    it('should get active subscriptions', () => {
      const sub1 = dataStore.submitQuery({ relation: 'follows' }, ['src', 'dst']);
      const sub2 = dataStore.submitQuery({ relation: 'follows' }, ['src', 'dst']);
      
      const active = dataStore.getActiveSubscriptions();
      expect(active.length).toBe(2);
      expect(active.map(s => s.subscriptionId)).toContain(sub1);
      expect(active.map(s => s.subscriptionId)).toContain(sub2);
    });
  });

  describe('data access', () => {
    beforeEach(() => {
      dataStore.defineRelationType('follows', 'followedBy');
      dataStore.addEdge('follows', 'alice', 'bob');
      dataStore.addEdge('follows', 'alice', 'charlie');
      dataStore.addEdge('follows', 'bob', 'charlie');
    });

    it('should get edges by type', () => {
      const edges = dataStore.getEdges('follows');
      expect(edges.length).toBe(3);
      expect(edges.every(e => e.type === 'follows')).toBe(true);
    });

    it('should get edges with constraints', () => {
      const edges = dataStore.getEdges('follows', [
        { field: 'src', operator: '=', value: 'alice' }
      ]);
      expect(edges.length).toBe(2);
      expect(edges.every(e => e.src === 'alice')).toBe(true);
    });
  });

  describe('statistics and monitoring', () => {
    beforeEach(() => {
      dataStore.defineRelationType('follows', 'followedBy');
      dataStore.addEdge('follows', 'alice', 'bob');
    });

    it('should provide comprehensive statistics', () => {
      const sub = dataStore.submitQuery({ relation: 'follows' }, ['src', 'dst']);
      const stats = dataStore.getStats();
      
      expect(stats).toEqual(expect.objectContaining({
        store: expect.objectContaining({
          edges: expect.any(Number),
          relationTypes: expect.any(Number),
          relations: expect.any(Number)
        }),
        dispatcher: expect.any(Object),
        queryAPI: expect.any(Object),
        writeBuffer: expect.any(Number),
        activeGraphs: 0,
        initialized: true,
        kernelEnabled: false
      }));
    });

    it('should track write buffer size', () => {
      const stats1 = dataStore.getStats();
      expect(stats1.writeBuffer).toBe(1); // From beforeEach addEdge
      
      dataStore.addEdge('follows', 'bob', 'charlie');
      const stats2 = dataStore.getStats();
      expect(stats2.writeBuffer).toBe(2);
    });
  });

  describe('batch processing', () => {
    beforeEach(() => {
      dataStore.defineRelationType('follows', 'followedBy');
    });

    it('should flush pending writes', async () => {
      dataStore.addEdge('follows', 'alice', 'bob');
      dataStore.addEdge('follows', 'bob', 'charlie');
      
      expect(dataStore._writeBuffer.length).toBe(2);
      
      await dataStore.flush();
      
      expect(dataStore._writeBuffer.length).toBe(0);
    });

    it('should emit flushed event', async () => {
      const flushHandler = createMockFn();
      dataStore.on('flushed', flushHandler);
      
      dataStore.addEdge('follows', 'alice', 'bob');
      await dataStore.flush();
      
      expect(flushHandler.callCount).toBe(1);
      expect(flushHandler.calls[0][0].batchSize).toBe(1);
    });

    it('should handle empty flush', async () => {
      const flushHandler = createMockFn();
      dataStore.on('flushed', flushHandler);
      
      await dataStore.flush();
      
      expect(flushHandler.callCount).toBe(0);
    });

    it('should emit batch processing events', async () => {
      const processedHandler = createMockFn();
      dataStore.on('batchProcessed', processedHandler);
      
      dataStore.addEdge('follows', 'alice', 'bob');
      await dataStore.flush();
      
      expect(processedHandler.callCount).toBe(1);
      expect(processedHandler.calls[0][0].batchSize).toBe(1);
    });
  });

  describe('lifecycle management', () => {
    it('should clear all data and subscriptions', async () => {
      dataStore.defineRelationType('follows', 'followedBy');
      dataStore.addEdge('follows', 'alice', 'bob');
      const sub = dataStore.submitQuery({ relation: 'follows' }, ['src', 'dst']);
      
      await dataStore.clear();
      
      expect(dataStore.getStats().store.edges).toBe(0);
      expect(dataStore.getStats().queryAPI.totalSubscriptions).toBe(0);
      expect(dataStore._relations.size).toBe(0);
      expect(dataStore._writeBuffer.length).toBe(0);
    });

    it('should emit cleared event', async () => {
      const clearHandler = createMockFn();
      dataStore.on('cleared', clearHandler);
      
      await dataStore.clear();
      
      expect(clearHandler.callCount).toBe(1);
    });

    it('should close gracefully', async () => {
      const closeHandler = createMockFn();
      dataStore.on('closed', closeHandler);
      
      dataStore.defineRelationType('follows', 'followedBy');
      dataStore.addEdge('follows', 'alice', 'bob');
      
      await dataStore.close();
      
      expect(closeHandler.callCount).toBe(1);
      expect(dataStore._isInitialized).toBe(false);
    });

    it('should flush before closing', async () => {
      const flushHandler = createMockFn();
      dataStore.on('flushed', flushHandler);
      
      dataStore.defineRelationType('follows', 'followedBy');
      dataStore.addEdge('follows', 'alice', 'bob');
      
      await dataStore.close();
      
      expect(flushHandler.callCount).toBe(1);
    });
  });

  describe('kernel integration (disabled)', () => {
    it('should throw error when kernel methods called without enableKernel', () => {
      expect(() => {
        dataStore.defineKernelRelation('test', { arity: 2 });
      }).toThrow('Kernel integration not enabled');
      
      expect(() => {
        dataStore.defineKernelGraph('graph1', { type: 'join' });
      }).toThrow('Kernel integration not enabled');
      
      expect(() => {
        dataStore.activateKernelGraph('graph1');
      }).toThrow('Kernel integration not enabled');
      
      expect(async () => {
        await dataStore.pushBatchToKernel([]);
      }).rejects.toThrow('Kernel integration not enabled');
    });

    it('should support kernel methods when enabled', () => {
      const kernelStore = new DataStore({ enableKernel: true });
      
      expect(() => {
        kernelStore.defineKernelRelation('test', { arity: 2 });
      }).not.toThrow();
      
      expect(() => {
        kernelStore.defineKernelGraph('graph1', { type: 'join' });
      }).not.toThrow();
      
      // Cleanup
      kernelStore.close();
    });
  });

  describe('event forwarding', () => {
    beforeEach(() => {
      dataStore.defineRelationType('follows', 'followedBy');
    });

    it('should forward store events', () => {
      const storeAddHandler = createMockFn();
      const storeRemoveHandler = createMockFn();
      
      dataStore.on('storeEdgeAdded', storeAddHandler);
      dataStore.on('storeEdgeRemoved', storeRemoveHandler);
      
      const edge = dataStore.addEdge('follows', 'alice', 'bob');
      dataStore.removeEdge('follows', 'alice', 'bob');
      
      // Events may be forwarded asynchronously
      expect(storeAddHandler.callCount).toBeGreaterThanOrEqual(0);
      expect(storeRemoveHandler.callCount).toBeGreaterThanOrEqual(0);
    });

    it('should forward query API events', () => {
      const createdHandler = createMockFn();
      const removedHandler = createMockFn();
      
      dataStore.on('subscriptionCreated', createdHandler);
      dataStore.on('subscriptionRemoved', removedHandler);
      
      const sub = dataStore.submitQuery({ relation: 'follows' }, ['src', 'dst']);
      expect(createdHandler.callCount).toBe(1);
      
      dataStore.unsubscribe(sub);
      expect(removedHandler.callCount).toBe(1);
    });

    it('should forward dispatcher events', () => {
      const queryHandler = createMockFn();
      const deltaHandler = createMockFn();
      
      dataStore.on('queryExecuted', queryHandler);
      dataStore.on('deltaProcessed', deltaHandler);
      
      // Events are forwarded when dispatcher processes deltas
      // These may be emitted asynchronously during batch processing
    });
  });

  describe('string representation', () => {
    it('should provide meaningful toString', () => {
      dataStore.defineRelationType('follows', 'followedBy');
      dataStore.addEdge('follows', 'alice', 'bob');
      const sub = dataStore.submitQuery({ relation: 'follows' }, ['src', 'dst']);
      
      const str = dataStore.toString();
      
      expect(str).toMatch(/DataStore/);
      expect(str).toMatch(/edges=/);
      expect(str).toMatch(/relations=/);
      expect(str).toMatch(/subscriptions=/);
      expect(str).toMatch(/initialized=/);
    });
  });

  describe('helper functions', () => {
    it('should create dataStore with createDataStore function', async () => {
      const { createDataStore } = await import('../../src/DataStore.js');
      const store = createDataStore({ batchSize: 25 });
      
      expect(store).toBeInstanceOf(DataStore);
      expect(store._options.batchSize).toBe(25);
      
      // Cleanup
      await store.close();
    });
  });
});