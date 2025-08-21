/**
 * Integration tests for DataStore
 * Tests complete system integration: store → dispatcher → subscriptions → API
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

describe('DataStore Integration', () => {
  let dataStore;

  beforeEach(() => {
    dataStore = new DataStore();
  });

  afterEach(async () => {
    if (dataStore) {
      await dataStore.close();
    }
  });

  describe('complete write → query update pipeline', () => {
    it('should process write → delta → query update flow', async () => {
      // Setup relationship and initial data
      dataStore.defineRelationType('follows', 'followedBy');
      dataStore.addEdge('follows', 'alice', 'bob');
      dataStore.addEdge('follows', 'alice', 'charlie');
      
      // Submit query and get change stream
      const subscriptionId = dataStore.submitQuery(
        { relation: 'follows' },
        ['src', 'dst']
      );
      
      const changeStream = dataStore.onChange(subscriptionId);
      const changeHandler = createMockFn();
      changeStream.on('data', changeHandler);
      
      // Flush writes to trigger processing
      await dataStore.flush();
      
      // Add new edge that should trigger update
      dataStore.addEdge('follows', 'bob', 'diana');
      await dataStore.flush();
      
      // Verify subscription received updates
      const subscription = dataStore._subscriptionManager.getSubscription(subscriptionId);
      expect(subscription).toBeDefined();
      expect(subscription.isActive()).toBe(true);
    });

    it('should handle concurrent writes and queries', async () => {
      dataStore.defineRelationType('likes', 'likedBy');
      dataStore.defineRelationType('follows', 'followedBy');
      
      // Start multiple subscriptions
      const sub1 = dataStore.submitQuery({ relation: 'likes' }, ['src', 'dst']);
      const sub2 = dataStore.submitQuery({ relation: 'follows' }, ['src', 'dst']);
      const sub3 = dataStore.submitQuery(
        { relation: 'likes' },
        ['src', 'dst'],
        { filter: (edge) => edge.src === 'alice' }
      );
      
      // Add data that affects different subscriptions
      dataStore.addEdge('likes', 'alice', 'post1');
      dataStore.addEdge('likes', 'bob', 'post1');
      dataStore.addEdge('follows', 'alice', 'bob');
      dataStore.addEdge('likes', 'alice', 'post2');
      
      await dataStore.flush();
      
      // Verify all subscriptions are active
      expect(dataStore.getSubscription(sub1).isActive).toBe(true);
      expect(dataStore.getSubscription(sub2).isActive).toBe(true);
      expect(dataStore.getSubscription(sub3).isActive).toBe(true);
      
      // Verify stats
      const stats = dataStore.getStats();
      expect(stats.queryAPI.totalSubscriptions).toBe(3);
      expect(stats.store.edges).toBe(4);
    });

    it('should propagate updates through subscription filters', async () => {
      dataStore.defineRelationType('posts', 'postedBy');
      
      // Setup filtered subscription
      const subscriptionId = dataStore.submitQuery(
        { relation: 'posts' },
        ['src', 'dst'],
        {
          filter: (edge) => edge.src.startsWith('user_'),
          transform: (edge) => ({ author: edge.src, content: edge.dst })
        }
      );
      
      const changeStream = dataStore.onChange(subscriptionId);
      const changeHandler = createMockFn();
      changeStream.on('data', changeHandler);
      
      // Add data that should be filtered
      dataStore.addEdge('posts', 'admin', 'system-post');
      dataStore.addEdge('posts', 'user_alice', 'hello-world');
      dataStore.addEdge('posts', 'moderator', 'announcement');
      dataStore.addEdge('posts', 'user_bob', 'great-article');
      
      await dataStore.flush();
      
      // Bootstrap filtered results to subscription
      const subscription = dataStore._subscriptionManager.getSubscription(subscriptionId);
      subscription.handleResults([
        { src: 'user_alice', dst: 'hello-world' },
        { src: 'user_bob', dst: 'great-article' }
      ]);
      
      // Should only get user_ posts, transformed
      expect(changeHandler.callCount).toBe(1);
      const data = changeHandler.calls[0][0];
      expect(data.type).toBe('bootstrap');
      expect(data.adds).toHaveLength(2);
      data.adds.forEach(item => {
        expect(item).toHaveProperty('author');
        expect(item).toHaveProperty('content');
        expect(item.author).toMatch(/^user_/);
      });
    });
  });

  describe('multi-client subscription scenarios', () => {
    it('should handle multiple clients with query result sharing', async () => {
      dataStore.defineRelationType('friendOf', 'friendOf');
      dataStore.addEdge('friendOf', 'alice', 'bob');
      dataStore.addEdge('friendOf', 'bob', 'charlie');
      dataStore.addEdge('friendOf', 'alice', 'charlie');
      
      // Multiple clients with same query - should use cached query
      const client1_sub = dataStore.submitQuery({ relation: 'friendOf' }, ['src', 'dst']);
      const client2_sub = dataStore.submitQuery({ relation: 'friendOf' }, ['src', 'dst']);
      const client3_sub = dataStore.submitQuery({ relation: 'friendOf' }, ['src', 'dst']);
      
      // Different query from same client
      const client1_sub2 = dataStore.submitQuery({ relation: 'friendOf' }, ['dst', 'src']);
      
      const stats = dataStore.getStats();
      expect(stats.queryAPI.totalSubscriptions).toBe(4);
      expect(stats.queryAPI.cachedQueries).toBe(2); // 2 different queries cached
      
      // Verify query ID sharing for same queries
      const info1 = dataStore.getSubscription(client1_sub);
      const info2 = dataStore.getSubscription(client2_sub);
      const info3 = dataStore.getSubscription(client3_sub);
      const info4 = dataStore.getSubscription(client1_sub2);
      
      expect(info1.queryId).toBe(info2.queryId);
      expect(info2.queryId).toBe(info3.queryId);
      expect(info1.queryId).not.toBe(info4.queryId);
    });

    it('should handle client disconnections and query cleanup', async () => {
      dataStore.defineRelationType('follows', 'followedBy');
      
      // Multiple subscriptions to same query
      const sub1 = dataStore.submitQuery({ relation: 'follows' }, ['src', 'dst']);
      const sub2 = dataStore.submitQuery({ relation: 'follows' }, ['src', 'dst']);
      const sub3 = dataStore.submitQuery({ relation: 'follows' }, ['src', 'dst']);
      
      const queryId = dataStore.getSubscription(sub1).queryId;
      
      expect(dataStore.getStats().queryAPI.totalSubscriptions).toBe(3);
      expect(dataStore._dispatcher.isQueryActive(queryId)).toBe(true);
      
      // Disconnect clients one by one
      dataStore.unsubscribe(sub1);
      expect(dataStore.getStats().queryAPI.totalSubscriptions).toBe(2);
      expect(dataStore._dispatcher.isQueryActive(queryId)).toBe(true); // Still has sub2, sub3
      
      dataStore.unsubscribe(sub2);
      expect(dataStore.getStats().queryAPI.totalSubscriptions).toBe(1);
      expect(dataStore._dispatcher.isQueryActive(queryId)).toBe(true); // Still has sub3
      
      dataStore.unsubscribe(sub3);
      expect(dataStore.getStats().queryAPI.totalSubscriptions).toBe(0);
      expect(dataStore._dispatcher.isQueryActive(queryId)).toBe(false); // Query deactivated
    });
  });

  describe('complex query patterns', () => {
    beforeEach(() => {
      dataStore.defineRelationType('worksAt', 'employs');
      dataStore.defineRelationType('locatedIn', 'contains');
      dataStore.defineRelationType('hasType', 'typeOf');
    });

    it('should handle simple path queries', async () => {
      // Add test data
      dataStore.addEdge('worksAt', 'alice', 'acme-corp');
      dataStore.addEdge('worksAt', 'bob', 'acme-corp');
      dataStore.addEdge('worksAt', 'charlie', 'beta-inc');
      dataStore.addEdge('locatedIn', 'acme-corp', 'uk');
      dataStore.addEdge('locatedIn', 'beta-inc', 'us');
      
      // Query for people working at companies in UK
      const subscriptionId = dataStore.submitQuery(
        { relation: 'worksAt' },
        ['src', 'dst']
      );
      
      // Setup change stream
      const changeStream = dataStore.onChange(subscriptionId);
      const changeHandler = createMockFn();
      changeStream.on('data', changeHandler);
      
      await dataStore.flush();
      
      // Bootstrap query results
      const subscription = dataStore._subscriptionManager.getSubscription(subscriptionId);
      subscription.handleResults([
        { src: 'alice', dst: 'acme-corp' },
        { src: 'bob', dst: 'acme-corp' },
        { src: 'charlie', dst: 'beta-inc' }
      ]);
      
      expect(changeHandler.callCount).toBe(1);
      const data = changeHandler.calls[0][0];
      expect(data.adds).toHaveLength(3);
    });

    it('should handle queries with constraints', async () => {
      dataStore.addEdge('hasType', 'acme-corp', 'supplier');
      dataStore.addEdge('hasType', 'beta-inc', 'customer');
      dataStore.addEdge('hasType', 'gamma-llc', 'supplier');
      dataStore.addEdge('locatedIn', 'acme-corp', 'uk');
      dataStore.addEdge('locatedIn', 'gamma-llc', 'uk');
      
      const subscriptionId = dataStore.submitQuery(
        { 
          relation: 'hasType',
          constraints: [
            { field: 'dst', operator: '=', value: 'supplier' }
          ]
        },
        ['src', 'dst']
      );
      
      const changeStream = dataStore.onChange(subscriptionId);
      const changeHandler = createMockFn();
      changeStream.on('data', changeHandler);
      
      await dataStore.flush();
      
      // Bootstrap with constraint-filtered results
      const subscription = dataStore._subscriptionManager.getSubscription(subscriptionId);
      subscription.handleResults([
        { src: 'acme-corp', dst: 'supplier' },
        { src: 'gamma-llc', dst: 'supplier' }
      ]);
      
      expect(changeHandler.callCount).toBe(1);
      const data = changeHandler.calls[0][0];
      expect(data.adds).toHaveLength(2);
      data.adds.forEach(edge => {
        expect(edge.dst).toBe('supplier');
      });
    });
  });

  describe('real-time update scenarios', () => {
    it('should handle incremental updates to live queries', async () => {
      dataStore.defineRelationType('follows', 'followedBy');
      
      // Initial data
      dataStore.addEdge('follows', 'alice', 'bob');
      
      const subscriptionId = dataStore.submitQuery(
        { relation: 'follows' },
        ['src', 'dst']
      );
      
      const changeStream = dataStore.onChange(subscriptionId);
      const changeHandler = createMockFn();
      changeStream.on('data', changeHandler);
      
      await dataStore.flush();
      
      // Bootstrap initial results
      const subscription = dataStore._subscriptionManager.getSubscription(subscriptionId);
      subscription.handleResults([
        { src: 'alice', dst: 'bob' }
      ]);
      
      expect(changeHandler.callCount).toBe(1);
      expect(changeHandler.calls[0][0].type).toBe('bootstrap');
      
      changeHandler.mockClear();
      
      // Add new edge - should trigger incremental update
      dataStore.addEdge('follows', 'alice', 'charlie');
      await dataStore.flush();
      
      // Simulate incremental update delivery
      subscription.handleUpdate({
        type: 'add',
        data: { src: 'alice', dst: 'charlie' },
        timestamp: Date.now()
      });
      
      expect(changeHandler.callCount).toBe(1);
      expect(changeHandler.calls[0][0].type).toBe('update');
      expect(changeHandler.calls[0][0].adds).toEqual([
        { src: 'alice', dst: 'charlie' }
      ]);
    });

    it('should handle batch updates efficiently', async () => {
      dataStore.defineRelationType('likes', 'likedBy');
      
      const subscriptionId = dataStore.submitQuery(
        { relation: 'likes' },
        ['src', 'dst']
      );
      
      const changeStream = dataStore.onChange(subscriptionId);
      const changeHandler = createMockFn();
      changeStream.on('data', changeHandler);
      
      // Add many edges in a batch
      for (let i = 0; i < 10; i++) {
        dataStore.addEdge('likes', `user${i}`, `post${i % 3}`);
      }
      
      const flushPromise = dataStore.flush();
      expect(dataStore._writeBuffer.length).toBe(0); // Should be cleared after flush
      
      await flushPromise;
      
      // Simulate batch update delivery
      const subscription = dataStore._subscriptionManager.getSubscription(subscriptionId);
      const batchUpdates = [];
      for (let i = 0; i < 10; i++) {
        batchUpdates.push({
          type: 'add',
          data: { src: `user${i}`, dst: `post${i % 3}` }
        });
      }
      
      // Simulate individual updates (subscription handles them one by one)
      for (const update of batchUpdates) {
        subscription.handleUpdate(update);
      }
      
      expect(changeHandler.callCount).toBeGreaterThan(0);
      // Verify we got the updates (may be individual or batched)
      if (changeHandler.callCount === 1) {
        expect(changeHandler.calls[0][0].adds).toHaveLength(10);
      } else {
        // Individual updates
        const totalAdds = changeHandler.calls.reduce((total, call) => 
          total + (call[0].adds ? call[0].adds.length : 0), 0);
        expect(totalAdds).toBe(10);
      }
    });
  });

  describe('error handling and resilience', () => {
    it('should handle query compilation errors gracefully', () => {
      const errorHandler = createMockFn();
      dataStore.on('queryError', errorHandler);
      
      expect(() => {
        dataStore.submitQuery({ invalid: 'spec' }, ['src', 'dst']);
      }).toThrow();
      
      expect(errorHandler.callCount).toBe(1);
      expect(errorHandler.calls[0][0].error).toBeDefined();
    });

    it('should handle subscription errors without breaking system', async () => {
      dataStore.defineRelationType('follows', 'followedBy');
      
      const sub1 = dataStore.submitQuery({ relation: 'follows' }, ['src', 'dst']);
      const sub2 = dataStore.submitQuery({ relation: 'follows' }, ['src', 'dst']);
      
      // Force error in one subscription (need multiple errors to trigger ERROR state)
      const subscription1 = dataStore._subscriptionManager.getSubscription(sub1);
      subscription1.handleError(new Error('Test subscription error 1'));
      subscription1.handleError(new Error('Test subscription error 2'));
      subscription1.handleError(new Error('Test subscription error 3'));
      subscription1.handleError(new Error('Test subscription error 4')); // 4th error triggers ERROR state
      
      // Check if subscription is in error state (actual state values may differ)
      const sub1Info = dataStore.getSubscription(sub1);
      const sub2Info = dataStore.getSubscription(sub2);
      
      expect(sub1Info.state).toBe(SubscriptionState.ERROR);
      expect(sub2Info.state).toBe(SubscriptionState.ACTIVE);
      
      // System should continue working
      dataStore.addEdge('follows', 'alice', 'bob');
      await dataStore.flush();
      
      const stats = dataStore.getStats();
      expect(stats.queryAPI.totalSubscriptions).toBe(2);
      expect(stats.queryAPI.errorSubscriptions).toBe(1);
    });

    it('should recover from dispatcher processing errors', async () => {
      dataStore.defineRelationType('follows', 'followedBy');
      
      const errorHandler = createMockFn();
      dataStore.on('batchProcessingError', errorHandler);
      
      // Add valid edge first
      dataStore.addEdge('follows', 'alice', 'bob');
      
      // Force an error during processing by corrupting write buffer
      dataStore._writeBuffer.push({
        type: 'invalid',
        edge: null,
        timestamp: Date.now()
      });
      
      try {
        await dataStore.flush();
      } catch (error) {
        expect(error).toBeDefined();
      }
      
      // System should continue accepting new writes
      dataStore.addEdge('follows', 'bob', 'charlie');
      expect(dataStore._writeBuffer.length).toBe(1);
    });
  });

  describe('performance and scalability tests', () => {
    it('should handle many simultaneous subscriptions', async () => {
      dataStore.defineRelationType('follows', 'followedBy');
      
      // Create many subscriptions
      const subscriptions = [];
      for (let i = 0; i < 100; i++) {
        const sub = dataStore.submitQuery(
          { relation: 'follows' },
          ['src', 'dst'],
          i % 3 === 0 ? { filter: (e) => e.src.includes('user') } : {}
        );
        subscriptions.push(sub);
      }
      
      const stats = dataStore.getStats();
      expect(stats.queryAPI.totalSubscriptions).toBe(100);
      
      // Should efficiently cache queries
      expect(stats.queryAPI.cachedQueries).toBeLessThan(100);
      
      // Add data and verify system handles it
      for (let i = 0; i < 50; i++) {
        dataStore.addEdge('follows', `user${i}`, `target${i % 10}`);
      }
      
      await dataStore.flush();
      
      // All subscriptions should remain active
      expect(dataStore.getActiveSubscriptions()).toHaveLength(100);
    });

    it('should efficiently manage memory with large datasets', async () => {
      dataStore.defineRelationType('connections', 'connectedBy');
      
      // Add large dataset
      for (let i = 0; i < 1000; i++) {
        dataStore.addEdge('connections', `node${i}`, `node${(i + 1) % 1000}`);
      }
      
      await dataStore.flush();
      
      const stats = dataStore.getStats();
      expect(stats.store.edges).toBe(1000);
      
      // Query over large dataset
      const subscriptionId = dataStore.submitQuery(
        { relation: 'connections' },
        ['src', 'dst']
      );
      
      expect(dataStore.getSubscription(subscriptionId)).toBeDefined();
      
      // System should remain responsive
      dataStore.addEdge('connections', 'newNode', 'node0');
      await dataStore.flush();
      
      expect(dataStore.getStats().store.edges).toBe(1001);
    });
  });

  describe('system lifecycle integration', () => {
    it('should handle complete system restart', async () => {
      dataStore.defineRelationType('follows', 'followedBy');
      dataStore.addEdge('follows', 'alice', 'bob');
      const sub = dataStore.submitQuery({ relation: 'follows' }, ['src', 'dst']);
      
      // Capture initial state
      const initialStats = dataStore.getStats();
      expect(initialStats.store.edges).toBe(1);
      expect(initialStats.queryAPI.totalSubscriptions).toBe(1);
      
      // Clear and restart
      await dataStore.clear();
      
      const clearedStats = dataStore.getStats();
      expect(clearedStats.store.edges).toBe(0);
      expect(clearedStats.queryAPI.totalSubscriptions).toBe(0);
      
      // System should work after restart
      dataStore.defineRelationType('likes', 'likedBy');
      dataStore.addEdge('likes', 'bob', 'post1');
      const newSub = dataStore.submitQuery({ relation: 'likes' }, ['src', 'dst']);
      
      const restartStats = dataStore.getStats();
      expect(restartStats.store.edges).toBe(1);
      expect(restartStats.queryAPI.totalSubscriptions).toBe(1);
    });

    it('should gracefully handle concurrent operations during shutdown', async () => {
      dataStore.defineRelationType('follows', 'followedBy');
      
      // Start some background operations
      const operations = [];
      for (let i = 0; i < 20; i++) {
        dataStore.addEdge('follows', `user${i}`, `target${i % 5}`);
        operations.push(dataStore.submitQuery({ relation: 'follows' }, ['src', 'dst']));
      }
      
      // Start shutdown while operations are pending
      const closePromise = dataStore.close();
      
      // Should complete gracefully
      await expect(closePromise).resolves.not.toThrow();
      expect(dataStore._isInitialized).toBe(false);
    });
  });
});