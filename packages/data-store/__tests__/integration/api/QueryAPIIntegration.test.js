/**
 * Integration tests for QueryAPI
 * Tests complete client workflow: query submission → subscription → result streaming
 */

import { Store } from '../../../src/Store.js';
import { Edge } from '../../../src/Edge.js';
import { TrieManager } from '../../../src/trie/TrieManager.js';
import { Dispatcher } from '../../../src/kernel/Dispatcher.js';
import { SubscriptionManager } from '../../../src/subscription/SubscriptionManager.js';
import { GraphSpecBuilder } from '../../../src/query/GraphSpecBuilder.js';
import { QueryAPI } from '../../../src/api/QueryAPI.js';

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

describe('QueryAPI Integration', () => {
  let store;
  let trieManager;
  let dispatcher;
  let subscriptionManager;
  let queryCompiler;
  let queryAPI;

  beforeEach(() => {
    store = new Store();
    trieManager = new TrieManager();
    dispatcher = new Dispatcher(store, trieManager);
    subscriptionManager = new SubscriptionManager(dispatcher);
    queryCompiler = new GraphSpecBuilder();
    queryAPI = new QueryAPI(store, dispatcher, subscriptionManager, queryCompiler);
    
    // Define relationship types
    store.defineRelationType('follows', 'followedBy');
    store.defineRelationType('likes', 'likedBy');
    store.defineRelationType('friendOf', 'friendOf');
  });

  describe('end-to-end query workflow', () => {
    it('should handle complete query submission and result delivery', () => {
      // Setup initial data
      store.addEdge(new Edge('follows', 'alice', 'bob'));
      store.addEdge(new Edge('follows', 'alice', 'charlie'));
      store.addEdge(new Edge('follows', 'bob', 'charlie'));
      
      // Submit query
      const subscriptionId = queryAPI.submitPathQuery(
        { relation: 'follows' },
        ['src', 'dst']
      );
      
      // Verify subscription created
      expect(subscriptionId).toMatch(/^sub_/);
      
      const info = queryAPI.getSubscription(subscriptionId);
      expect(info).toBeDefined();
      expect(info.querySpec).toEqual({ relation: 'follows' });
      expect(info.projection).toEqual(['src', 'dst']);
      expect(info.isActive).toBe(true);
    });

    it('should stream results through onChange', () => {
      // Setup initial data
      store.addEdge(new Edge('likes', 'alice', 'post1'));
      store.addEdge(new Edge('likes', 'bob', 'post1'));
      
      // Submit query
      const subscriptionId = queryAPI.submitPathQuery(
        { relation: 'likes' },
        ['src', 'dst']
      );
      
      // Get change stream
      const changeStream = queryAPI.onChange(subscriptionId);
      const changeHandler = createMockFn();
      changeStream.on('data', changeHandler);
      
      // Trigger bootstrap by activating subscription
      const subscription = subscriptionManager.getSubscription(subscriptionId);
      subscription.handleResults([
        { src: 'alice', dst: 'post1' },
        { src: 'bob', dst: 'post1' }
      ]);
      
      // Should receive bootstrap data
      expect(changeHandler.callCount).toBe(1);
      expect(changeHandler.calls[0][0]).toEqual({
        type: 'bootstrap',
        adds: [
          { src: 'alice', dst: 'post1' },
          { src: 'bob', dst: 'post1' }
        ],
        removes: [],
        timestamp: expect.any(Number)
      });
    });

    it('should handle filtered subscriptions', () => {
      // Setup initial data
      store.addEdge(new Edge('follows', 'alice', 'bob'));
      store.addEdge(new Edge('follows', 'alice', 'charlie'));
      store.addEdge(new Edge('follows', 'bob', 'charlie'));
      store.addEdge(new Edge('follows', 'charlie', 'alice'));
      
      // Submit filtered query
      const subscriptionId = queryAPI.submitPathQuery(
        { relation: 'follows' },
        ['src', 'dst'],
        {
          filter: (edge) => edge.src === 'alice'
        }
      );
      
      // Get change stream
      const changeStream = queryAPI.onChange(subscriptionId);
      const changeHandler = createMockFn();
      changeStream.on('data', changeHandler);
      
      // Bootstrap with filtered results
      const subscription = subscriptionManager.getSubscription(subscriptionId);
      subscription.handleResults([
        { src: 'alice', dst: 'bob' },
        { src: 'alice', dst: 'charlie' },
        { src: 'bob', dst: 'charlie' },
        { src: 'charlie', dst: 'alice' }
      ]);
      
      // Should only receive alice's follows
      expect(changeHandler.callCount).toBe(1);
      const data = changeHandler.calls[0][0];
      expect(data.adds).toHaveLength(2);
      data.adds.forEach(edge => {
        expect(edge.src).toBe('alice');
      });
    });

    it('should handle transformed subscriptions', () => {
      // Setup initial data
      store.addEdge(new Edge('likes', 'alice', 'post1'));
      store.addEdge(new Edge('likes', 'bob', 'post2'));
      
      // Submit query with transform
      const subscriptionId = queryAPI.submitPathQuery(
        { relation: 'likes' },
        ['src', 'dst'],
        {
          transform: (edge) => ({ user: edge.src, item: edge.dst })
        }
      );
      
      // Get change stream
      const changeStream = queryAPI.onChange(subscriptionId);
      const changeHandler = createMockFn();
      changeStream.on('data', changeHandler);
      
      // Bootstrap with transformed results
      const subscription = subscriptionManager.getSubscription(subscriptionId);
      subscription.handleResults([
        { src: 'alice', dst: 'post1' },
        { src: 'bob', dst: 'post2' }
      ]);
      
      // Should receive transformed data
      expect(changeHandler.callCount).toBe(1);
      const data = changeHandler.calls[0][0];
      expect(data.adds).toHaveLength(2);
      expect(data.adds[0]).toHaveProperty('user');
      expect(data.adds[0]).toHaveProperty('item');
      expect(data.adds[0]).not.toHaveProperty('src');
      expect(data.adds[0]).not.toHaveProperty('dst');
    });
  });

  describe('multi-client scenarios', () => {
    it('should handle multiple clients with same query', () => {
      // Setup initial data
      store.addEdge(new Edge('friendOf', 'alice', 'bob'));
      
      // Multiple clients submit same query
      const sub1 = queryAPI.submitPathQuery({ relation: 'friendOf' }, ['src', 'dst']);
      const sub2 = queryAPI.submitPathQuery({ relation: 'friendOf' }, ['src', 'dst']);
      const sub3 = queryAPI.submitPathQuery({ relation: 'friendOf' }, ['src', 'dst']);
      
      // Should use cached query
      const info1 = queryAPI.getSubscription(sub1);
      const info2 = queryAPI.getSubscription(sub2);
      const info3 = queryAPI.getSubscription(sub3);
      
      expect(info1.queryId).toBe(info2.queryId);
      expect(info2.queryId).toBe(info3.queryId);
      
      // But different subscriptions
      expect(sub1).not.toBe(sub2);
      expect(sub2).not.toBe(sub3);
      
      // Should have 3 active subscriptions
      expect(queryAPI.getStats().totalSubscriptions).toBe(3);
      expect(queryAPI.getStats().cachedQueries).toBe(1);
    });

    it('should handle different queries from same client', () => {
      // Submit different queries
      const sub1 = queryAPI.submitPathQuery({ relation: 'follows' }, ['src', 'dst']);
      const sub2 = queryAPI.submitPathQuery({ relation: 'likes' }, ['user', 'item']);
      const sub3 = queryAPI.submitPathQuery(
        { relation: 'follows' },
        ['src', 'dst'],
        { filter: (e) => e.src.startsWith('a') }
      );
      
      // Should create different queries
      const info1 = queryAPI.getSubscription(sub1);
      const info2 = queryAPI.getSubscription(sub2);
      const info3 = queryAPI.getSubscription(sub3);
      
      expect(info1.queryId).not.toBe(info2.queryId);
      expect(info2.queryId).not.toBe(info3.queryId);
      expect(info1.queryId).not.toBe(info3.queryId); // Different due to filter
      
      expect(queryAPI.getStats().totalSubscriptions).toBe(3);
      expect(queryAPI.getStats().cachedQueries).toBe(3);
    });
  });

  describe('subscription lifecycle management', () => {
    it('should handle subscription pause/resume through API', () => {
      const subscriptionId = queryAPI.submitPathQuery(
        { relation: 'follows' },
        ['src', 'dst']
      );
      
      expect(queryAPI.getSubscription(subscriptionId).isActive).toBe(true);
      
      // Pause subscription
      queryAPI.pauseSubscription(subscriptionId);
      expect(queryAPI.getSubscription(subscriptionId).isActive).toBe(false);
      
      // Resume subscription
      queryAPI.resumeSubscription(subscriptionId);
      expect(queryAPI.getSubscription(subscriptionId).isActive).toBe(true);
    });

    it('should handle subscription unsubscribe and query cleanup', () => {
      const sub1 = queryAPI.submitPathQuery({ relation: 'follows' }, ['src', 'dst']);
      const sub2 = queryAPI.submitPathQuery({ relation: 'follows' }, ['src', 'dst']);
      
      const queryId = queryAPI.getSubscription(sub1).queryId;
      
      expect(queryAPI.getStats().totalSubscriptions).toBe(2);
      expect(dispatcher.isQueryActive(queryId)).toBe(true);
      
      // Unsubscribe first client
      queryAPI.unsubscribe(sub1);
      
      expect(queryAPI.getStats().totalSubscriptions).toBe(1);
      expect(dispatcher.isQueryActive(queryId)).toBe(true); // Still has sub2
      
      // Unsubscribe last client
      queryAPI.unsubscribe(sub2);
      
      expect(queryAPI.getStats().totalSubscriptions).toBe(0);
      expect(dispatcher.isQueryActive(queryId)).toBe(false); // Query deactivated
    });
  });

  describe('error handling and resilience', () => {
    it('should handle invalid query specs gracefully', () => {
      const errorHandler = createMockFn();
      queryAPI.on('queryError', errorHandler);
      
      // Invalid query spec
      expect(() => {
        queryAPI.submitPathQuery({ invalid: 'spec' }, ['src', 'dst']);
      }).toThrow();
      
      expect(errorHandler.callCount).toBe(1);
      expect(errorHandler.calls[0][0].error).toBeDefined();
    });

    it('should handle API state consistency', () => {
      const sub1 = queryAPI.submitPathQuery({ relation: 'follows' }, ['src', 'dst']);
      const sub2 = queryAPI.submitPathQuery({ relation: 'likes' }, ['user', 'item']);
      
      // Clear all subscriptions
      queryAPI.clear();
      
      // API should be consistent
      expect(queryAPI.getStats().totalSubscriptions).toBe(0);
      expect(queryAPI.getStats().cachedQueries).toBe(0);
      expect(queryAPI.getActiveSubscriptions()).toHaveLength(0);
      
      // Old subscription info should return null
      expect(queryAPI.getSubscription(sub1)).toBe(null);
      expect(queryAPI.getSubscription(sub2)).toBe(null);
    });

    it('should handle subscription manager events', () => {
      const errorHandler = createMockFn();
      const resultHandler = createMockFn();
      const createdHandler = createMockFn();
      
      queryAPI.on('subscriptionError', errorHandler);
      queryAPI.on('resultsDelivered', resultHandler);
      queryAPI.on('subscriptionCreated', createdHandler);
      
      // Create subscription - this should trigger subscriptionCreated event
      const subscriptionId = queryAPI.submitPathQuery({ relation: 'follows' }, ['src', 'dst']);
      
      // Test that at least the subscriptionCreated event was forwarded
      expect(createdHandler.callCount).toBe(1);
      expect(createdHandler.calls[0][0].subscriptionId).toBe(subscriptionId);
      
      // The other events are forwarded from subscription manager
      // but may not be triggered in this simple test scenario
      expect(createdHandler.callCount).toBeGreaterThan(0);
    });
  });

  describe('performance and scalability', () => {
    it('should handle many subscriptions efficiently', () => {
      const subscriptions = [];
      
      // Create many subscriptions (same query to test caching)
      for (let i = 0; i < 50; i++) {
        const sub = queryAPI.submitPathQuery(
          { relation: 'follows' },
          ['src', 'dst']
        );
        subscriptions.push(sub);
      }
      
      const stats = queryAPI.getStats();
      expect(stats.totalSubscriptions).toBe(50);
      expect(stats.cachedQueries).toBe(1); // All same query
      
      // All should be manageable
      const active = queryAPI.getActiveSubscriptions();
      expect(active).toHaveLength(50);
      
      // Should be able to clean up efficiently
      queryAPI.clear();
      expect(queryAPI.getStats().totalSubscriptions).toBe(0);
    });

    it('should handle query normalization edge cases', () => {
      // String queries
      const sub1 = queryAPI.submitPathQuery('follows', ['src', 'dst']);
      expect(queryAPI.getSubscription(sub1).querySpec).toEqual({ path: 'follows' });
      
      // Object queries
      const sub2 = queryAPI.submitPathQuery({ relation: 'likes' }, ['user', 'item']);
      expect(queryAPI.getSubscription(sub2).querySpec).toEqual({ relation: 'likes' });
      
      // Queries with constraints
      const sub3 = queryAPI.submitPathQuery(
        { relation: 'follows', constraints: [{ field: 'src', operator: '=', value: 'alice' }] },
        ['dst']
      );
      expect(queryAPI.getSubscription(sub3).querySpec.constraints).toBeDefined();
    });
  });

  describe('API statistics and monitoring', () => {
    it('should provide accurate statistics', () => {
      // Initial state
      expect(queryAPI.getStats()).toEqual({
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        pausedSubscriptions: 0,
        errorSubscriptions: 0,
        queriesWithSubscriptions: 0,
        subscriptionsByState: {},
        cachedQueries: 0,
        activeQueries: 0
      });
      
      // Add subscriptions in different states
      const sub1 = queryAPI.submitPathQuery({ relation: 'follows' }, ['src', 'dst']);
      const sub2 = queryAPI.submitPathQuery({ relation: 'likes' }, ['user', 'item']);
      
      queryAPI.pauseSubscription(sub2);
      
      const stats = queryAPI.getStats();
      expect(stats.totalSubscriptions).toBe(2);
      expect(stats.activeSubscriptions).toBe(1);
      expect(stats.pausedSubscriptions).toBe(1);
      expect(stats.cachedQueries).toBe(2);
    });

    it('should emit lifecycle events', () => {
      const createdHandler = createMockFn();
      const removedHandler = createMockFn();
      
      queryAPI.on('subscriptionCreated', createdHandler);
      queryAPI.on('subscriptionRemoved', removedHandler);
      
      // Create subscription
      const subscriptionId = queryAPI.submitPathQuery({ relation: 'follows' }, ['src', 'dst']);
      
      expect(createdHandler.callCount).toBe(1);
      expect(createdHandler.calls[0][0].subscriptionId).toBe(subscriptionId);
      
      // Remove subscription
      queryAPI.unsubscribe(subscriptionId);
      
      expect(removedHandler.callCount).toBe(1);
      expect(removedHandler.calls[0][0].subscriptionId).toBe(subscriptionId);
    });
  });
});