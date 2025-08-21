/**
 * Basic integration tests for live query subscription
 * Tests core subscription → result delivery flow per design §4
 */

import { Store } from '../../../src/Store.js';
import { Edge } from '../../../src/Edge.js';
import { TrieManager } from '../../../src/trie/TrieManager.js';
import { Dispatcher } from '../../../src/kernel/Dispatcher.js';
import { SubscriptionManager } from '../../../src/subscription/SubscriptionManager.js';

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

describe('Live Query Basic Integration', () => {
  let store;
  let trieManager;
  let dispatcher;
  let subscriptionManager;

  beforeEach(() => {
    store = new Store();
    trieManager = new TrieManager();
    dispatcher = new Dispatcher(store, trieManager);
    subscriptionManager = new SubscriptionManager(dispatcher);
    
    // Define relationship types
    store.defineRelationType('follows', 'followedBy');
    store.defineRelationType('likes', 'likedBy');
  });

  describe('subscription bootstrap', () => {
    it('should deliver initial results on subscription', () => {
      // Setup initial data
      store.addEdge(new Edge('follows', 'alice', 'bob'));
      store.addEdge(new Edge('follows', 'alice', 'charlie'));
      store.addEdge(new Edge('follows', 'bob', 'charlie'));
      
      // Register query
      dispatcher.registerQuery('q1', {
        type: 'select',
        relation: 'follows'
      });
      
      // Create subscription
      const callback = createMockFn();
      const subscription = subscriptionManager.subscribe('q1', callback);
      
      // Should receive initial results
      expect(callback.callCount).toBe(1);
      expect(callback.calls[0][0].type).toBe('bootstrap');
      expect(callback.calls[0][0].results).toHaveLength(3);
      
      // Verify subscription state
      expect(subscription.isActive()).toBe(true);
      expect(subscriptionManager.getActiveSubscriptions()).toHaveLength(1);
    });

    it('should handle empty initial results', () => {
      // Register query with no matching data
      dispatcher.registerQuery('q1', {
        type: 'select',
        relation: 'follows'
      });
      
      // Create subscription
      const callback = createMockFn();
      subscriptionManager.subscribe('q1', callback);
      
      // Should receive empty bootstrap
      expect(callback.callCount).toBe(1);
      expect(callback.calls[0][0].type).toBe('bootstrap');
      expect(callback.calls[0][0].results).toHaveLength(0);
    });

    it('should apply filters during bootstrap', () => {
      // Setup data
      store.addEdge(new Edge('follows', 'alice', 'bob'));
      store.addEdge(new Edge('follows', 'alice', 'charlie'));
      store.addEdge(new Edge('follows', 'bob', 'charlie'));
      
      // Register query
      dispatcher.registerQuery('q1', {
        type: 'select',
        relation: 'follows'
      });
      
      // Create filtered subscription
      const callback = createMockFn();
      subscriptionManager.subscribe('q1', callback, {
        filter: (edge) => edge.src === 'alice'
      });
      
      // Should only receive alice's follows
      expect(callback.callCount).toBe(1);
      expect(callback.calls[0][0].results).toHaveLength(2);
      callback.calls[0][0].results.forEach(edge => {
        expect(edge.src).toBe('alice');
      });
    });

    it('should apply transforms during bootstrap', () => {
      // Setup data
      store.addEdge(new Edge('likes', 'alice', 'post1'));
      store.addEdge(new Edge('likes', 'bob', 'post1'));
      
      // Register query
      dispatcher.registerQuery('q1', {
        type: 'select',
        relation: 'likes'
      });
      
      // Create subscription with transform
      const callback = createMockFn();
      subscriptionManager.subscribe('q1', callback, {
        transform: (edge) => ({ user: edge.src, item: edge.dst })
      });
      
      // Should receive transformed results
      expect(callback.callCount).toBe(1);
      const results = callback.calls[0][0].results;
      expect(results[0]).toHaveProperty('user');
      expect(results[0]).toHaveProperty('item');
      expect(results[0]).not.toHaveProperty('src');
      expect(results[0]).not.toHaveProperty('dst');
    });
  });

  describe('subscription lifecycle', () => {
    it('should activate and deactivate subscriptions', () => {
      dispatcher.registerQuery('q1', {
        type: 'select',
        relation: 'follows'
      });
      
      // Create inactive subscription
      const callback = createMockFn();
      const subscription = subscriptionManager.subscribe('q1', callback, {
        autoActivate: false
      });
      
      expect(subscription.isActive()).toBe(false);
      expect(subscriptionManager.getStats().activeSubscriptions).toBe(0);
      
      // Activate subscription
      subscriptionManager.activateSubscription(subscription.subscriptionId);
      
      expect(subscription.isActive()).toBe(true);
      expect(subscriptionManager.getStats().activeSubscriptions).toBe(1);
      
      // Pause subscription
      subscriptionManager.pauseSubscription(subscription.subscriptionId);
      
      expect(subscription.isPaused()).toBe(true);
      expect(subscriptionManager.getStats().activeSubscriptions).toBe(0);
      
      // Resume subscription
      subscriptionManager.resumeSubscription(subscription.subscriptionId);
      
      expect(subscription.isActive()).toBe(true);
      expect(subscriptionManager.getStats().activeSubscriptions).toBe(1);
      
      // Cancel subscription
      subscriptionManager.unsubscribe(subscription.subscriptionId);
      
      expect(subscription.isCancelled()).toBe(true);
      expect(subscriptionManager.getStats().totalSubscriptions).toBe(0);
    });

    it('should handle multiple subscriptions', () => {
      dispatcher.registerQuery('q1', {
        type: 'select',
        relation: 'follows'
      });
      
      // Create multiple subscriptions
      const callbacks = [createMockFn(), createMockFn(), createMockFn()];
      const subscriptions = callbacks.map(cb => 
        subscriptionManager.subscribe('q1', cb)
      );
      
      expect(subscriptionManager.getStats().totalSubscriptions).toBe(3);
      expect(subscriptionManager.getStats().activeSubscriptions).toBe(3);
      expect(dispatcher.isQueryActive('q1')).toBe(true);
      
      // Remove one subscription
      subscriptionManager.unsubscribe(subscriptions[0].subscriptionId);
      
      expect(subscriptionManager.getStats().totalSubscriptions).toBe(2);
      expect(dispatcher.isQueryActive('q1')).toBe(true); // Still has active subs
      
      // Remove remaining subscriptions
      subscriptionManager.unsubscribe(subscriptions[1].subscriptionId);
      subscriptionManager.unsubscribe(subscriptions[2].subscriptionId);
      
      expect(subscriptionManager.getStats().totalSubscriptions).toBe(0);
      expect(dispatcher.isQueryActive('q1')).toBe(false); // No more active subs
    });
  });

  describe('query activation', () => {
    it('should activate query when first subscription created', () => {
      dispatcher.registerQuery('q1', {
        type: 'select',
        relation: 'follows'
      });
      
      expect(dispatcher.isQueryActive('q1')).toBe(false);
      
      // Create subscription should activate query
      subscriptionManager.subscribe('q1', createMockFn());
      
      expect(dispatcher.isQueryActive('q1')).toBe(true);
    });

    it('should deactivate query when last subscription removed', () => {
      dispatcher.registerQuery('q1', {
        type: 'select',
        relation: 'follows'
      });
      
      // Create subscription
      const subscription = subscriptionManager.subscribe('q1', createMockFn());
      expect(dispatcher.isQueryActive('q1')).toBe(true);
      
      // Remove subscription
      subscriptionManager.unsubscribe(subscription.subscriptionId);
      expect(dispatcher.isQueryActive('q1')).toBe(false);
    });

    it('should handle non-existent query gracefully', () => {
      // Subscribe to non-existent query
      const callback = createMockFn();
      const subscription = subscriptionManager.subscribe('non-existent', callback);
      
      // Subscription should exist but query won't be active
      expect(subscription).toBeDefined();
      expect(dispatcher.isQueryActive('non-existent')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle callback errors gracefully', () => {
      dispatcher.registerQuery('q1', {
        type: 'select',
        relation: 'follows'
      });
      
      // Create subscription with error-throwing callback
      const errorCallback = createMockFn();
      errorCallback.mockImplementation = () => {
        throw new Error('Callback error');
      };
      
      const normalCallback = createMockFn();
      
      const sub1 = subscriptionManager.subscribe('q1', errorCallback);
      const sub2 = subscriptionManager.subscribe('q1', normalCallback);
      
      // Add error handlers to prevent unhandled errors
      sub1.on('error', () => {});
      
      // Bootstrap should work for normal callback despite error in other
      expect(normalCallback.callCount).toBe(1);
      expect(errorCallback.callCount).toBe(1); // Still gets called despite error
    });

    it('should validate subscription parameters', () => {
      expect(() => subscriptionManager.subscribe())
        .toThrow('Query ID is required');
      
      expect(() => subscriptionManager.subscribe('q1'))
        .toThrow('Callback or handler is required');
      
      expect(() => subscriptionManager.unsubscribe())
        .toThrow('Subscription ID is required');
      
      expect(() => subscriptionManager.activateSubscription('non-existent'))
        .toThrow('Subscription non-existent not found');
    });
  });

  describe('statistics and monitoring', () => {
    it('should provide accurate statistics', () => {
      dispatcher.registerQuery('q1', {
        type: 'select',
        relation: 'follows'
      });
      dispatcher.registerQuery('q2', {
        type: 'select',
        relation: 'likes'
      });
      
      // Create subscriptions in different states
      const sub1 = subscriptionManager.subscribe('q1', createMockFn());
      const sub2 = subscriptionManager.subscribe('q1', createMockFn());
      const sub3 = subscriptionManager.subscribe('q2', createMockFn());
      
      subscriptionManager.pauseSubscription(sub3.subscriptionId);
      
      const stats = subscriptionManager.getStats();
      
      expect(stats.totalSubscriptions).toBe(3);
      expect(stats.activeSubscriptions).toBe(2);
      expect(stats.pausedSubscriptions).toBe(1);
      expect(stats.queriesWithSubscriptions).toBe(2);
    });

    it('should emit lifecycle events', () => {
      const events = {
        created: createMockFn(),
        removed: createMockFn()
      };
      
      subscriptionManager.on('subscriptionCreated', events.created);
      subscriptionManager.on('subscriptionRemoved', events.removed);
      
      dispatcher.registerQuery('q1', {
        type: 'select',
        relation: 'follows'
      });
      
      // Create subscription
      const subscription = subscriptionManager.subscribe('q1', createMockFn());
      expect(events.created.callCount).toBe(1);
      expect(events.created.calls[0][0].queryId).toBe('q1');
      
      // Remove subscription
      subscriptionManager.unsubscribe(subscription.subscriptionId);
      expect(events.removed.callCount).toBe(1);
      expect(events.removed.calls[0][0].queryId).toBe('q1');
    });
  });
});