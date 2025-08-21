/**
 * Unit tests for SubscriptionManager class
 * Tests subscription management and routing per design §4
 */

import { SubscriptionManager } from '../../../src/subscription/SubscriptionManager.js';
import { Subscription, SubscriptionState } from '../../../src/subscription/Subscription.js';
import { Dispatcher } from '../../../src/kernel/Dispatcher.js';
import { Store } from '../../../src/Store.js';
import { TrieManager } from '../../../src/trie/TrieManager.js';

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

describe('SubscriptionManager', () => {
  let manager;
  let dispatcher;
  let store;
  let trieManager;

  beforeEach(() => {
    store = new Store();
    trieManager = new TrieManager();
    dispatcher = new Dispatcher(store, trieManager);
    manager = new SubscriptionManager(dispatcher);
  });

  describe('construction', () => {
    it('should create manager with dispatcher', () => {
      expect(manager).toBeDefined();
      expect(manager._dispatcher).toBe(dispatcher);
      expect(manager._subscriptions.size).toBe(0);
    });

    it('should validate dispatcher parameter', () => {
      expect(() => new SubscriptionManager())
        .toThrow('Dispatcher is required');
    });

    it('should setup dispatcher listeners', () => {
      // Register and activate a query
      dispatcher.registerQuery('q1', {
        type: 'select',
        relation: 'test'
      });
      dispatcher.activateQuery('q1');
      
      // Create subscription
      const callback = createMockFn();
      const subscription = manager.subscribe('q1', callback);
      
      // Trigger query execution
      dispatcher._executeQuery('q1');
      
      // Should receive results through manager
      expect(callback.callCount).toBeGreaterThan(0);
    });
  });

  describe('subscription creation', () => {
    beforeEach(() => {
      dispatcher.registerQuery('q1', {
        type: 'select',
        relation: 'test'
      });
    });

    it('should create new subscription', () => {
      const callback = createMockFn();
      const subscription = manager.subscribe('q1', callback);
      
      expect(subscription).toBeInstanceOf(Subscription);
      expect(subscription.queryId).toBe('q1');
      expect(subscription.subscriptionId).toMatch(/^sub_/);
      expect(manager._subscriptions.size).toBe(1);
    });

    it('should track subscriptions by query', () => {
      const callback = createMockFn();
      const sub1 = manager.subscribe('q1', callback);
      const sub2 = manager.subscribe('q1', callback);
      
      const querySubs = manager.getQuerySubscriptions('q1');
      expect(querySubs).toHaveLength(2);
      expect(querySubs).toContain(sub1);
      expect(querySubs).toContain(sub2);
    });

    it('should auto-activate subscription by default', () => {
      const callback = createMockFn();
      const subscription = manager.subscribe('q1', callback);
      
      expect(subscription.isActive()).toBe(true);
    });

    it('should respect autoActivate option', () => {
      const callback = createMockFn();
      const subscription = manager.subscribe('q1', callback, {
        autoActivate: false
      });
      
      expect(subscription.isActive()).toBe(false);
    });

    it('should validate required parameters', () => {
      expect(() => manager.subscribe())
        .toThrow('Query ID is required');
      
      expect(() => manager.subscribe('q1'))
        .toThrow('Callback or handler is required');
    });

    it('should prevent duplicate subscription IDs', () => {
      const callback = createMockFn();
      manager.subscribe('q1', callback, {
        subscriptionId: 'custom-id'
      });
      
      expect(() => manager.subscribe('q1', callback, {
        subscriptionId: 'custom-id'
      })).toThrow('Subscription custom-id already exists');
    });

    it('should pass options to subscription', () => {
      const filter = (item) => item.active;
      const transform = (item) => item.name;
      const metadata = { key: 'value' };
      
      const subscription = manager.subscribe('q1', createMockFn(), {
        filter,
        transform,
        metadata
      });
      
      expect(subscription.getMetadata()).toEqual(metadata);
    });
  });

  describe('subscription removal', () => {
    let subscription;

    beforeEach(() => {
      dispatcher.registerQuery('q1', {
        type: 'select',
        relation: 'test'
      });
      subscription = manager.subscribe('q1', createMockFn());
    });

    it('should unsubscribe existing subscription', () => {
      const result = manager.unsubscribe(subscription.subscriptionId);
      
      expect(result).toBe(true);
      expect(manager._subscriptions.size).toBe(0);
      expect(subscription.isCancelled()).toBe(true);
    });

    it('should remove from query tracking', () => {
      manager.unsubscribe(subscription.subscriptionId);
      
      const querySubs = manager.getQuerySubscriptions('q1');
      expect(querySubs).toHaveLength(0);
    });

    it('should handle non-existent subscription', () => {
      const result = manager.unsubscribe('non-existent');
      
      expect(result).toBe(false);
    });

    it('should validate subscription ID', () => {
      expect(() => manager.unsubscribe())
        .toThrow('Subscription ID is required');
    });

    it('should update active count', () => {
      expect(manager._activeCount).toBe(1);
      
      manager.unsubscribe(subscription.subscriptionId);
      
      expect(manager._activeCount).toBe(0);
    });

    it('should deactivate query when last subscription removed', () => {
      dispatcher.activateQuery('q1');
      expect(dispatcher.isQueryActive('q1')).toBe(true);
      
      manager.unsubscribe(subscription.subscriptionId);
      
      expect(dispatcher.isQueryActive('q1')).toBe(false);
    });
  });

  describe('subscription lifecycle', () => {
    let subscription;

    beforeEach(() => {
      dispatcher.registerQuery('q1', {
        type: 'select',
        relation: 'test'
      });
      subscription = manager.subscribe('q1', createMockFn(), {
        autoActivate: false
      });
    });

    it('should activate subscription', () => {
      manager.activateSubscription(subscription.subscriptionId);
      
      expect(subscription.isActive()).toBe(true);
      expect(manager._activeCount).toBe(1);
    });

    it('should pause subscription', () => {
      manager.activateSubscription(subscription.subscriptionId);
      manager.pauseSubscription(subscription.subscriptionId);
      
      expect(subscription.isPaused()).toBe(true);
      expect(manager._activeCount).toBe(0);
    });

    it('should resume subscription', () => {
      manager.activateSubscription(subscription.subscriptionId);
      manager.pauseSubscription(subscription.subscriptionId);
      manager.resumeSubscription(subscription.subscriptionId);
      
      expect(subscription.isActive()).toBe(true);
      expect(manager._activeCount).toBe(1);
    });

    it('should validate subscription exists', () => {
      expect(() => manager.activateSubscription('non-existent'))
        .toThrow('Subscription non-existent not found');
      
      expect(() => manager.pauseSubscription('non-existent'))
        .toThrow('Subscription non-existent not found');
      
      expect(() => manager.resumeSubscription('non-existent'))
        .toThrow('Subscription non-existent not found');
    });

    it('should activate query when activating subscription', () => {
      expect(dispatcher.isQueryActive('q1')).toBe(false);
      
      manager.activateSubscription(subscription.subscriptionId);
      
      expect(dispatcher.isQueryActive('q1')).toBe(true);
    });
  });

  describe('query-level operations', () => {
    beforeEach(() => {
      dispatcher.registerQuery('q1', {
        type: 'select',
        relation: 'test'
      });
      
      // Create multiple subscriptions
      manager.subscribe('q1', createMockFn());
      manager.subscribe('q1', createMockFn());
      manager.subscribe('q1', createMockFn());
    });

    it('should pause all subscriptions for query', () => {
      const count = manager.pauseQuery('q1');
      
      expect(count).toBe(3);
      expect(manager._activeCount).toBe(0);
      
      const subs = manager.getQuerySubscriptions('q1');
      subs.forEach(sub => {
        expect(sub.isPaused()).toBe(true);
      });
    });

    it('should resume all subscriptions for query', () => {
      manager.pauseQuery('q1');
      const count = manager.resumeQuery('q1');
      
      expect(count).toBe(3);
      expect(manager._activeCount).toBe(3);
      
      const subs = manager.getQuerySubscriptions('q1');
      subs.forEach(sub => {
        expect(sub.isActive()).toBe(true);
      });
    });

    it('should handle query with no subscriptions', () => {
      const count = manager.pauseQuery('unknown');
      expect(count).toBe(0);
    });
  });

  describe('result delivery', () => {
    let callbacks;
    let subscriptions;

    beforeEach(() => {
      dispatcher.registerQuery('q1', {
        type: 'select',
        relation: 'test'
      });
      
      callbacks = [createMockFn(), createMockFn(), createMockFn()];
      subscriptions = callbacks.map(cb => manager.subscribe('q1', cb));
    });

    it('should deliver results to all active subscriptions', () => {
      const results = [
        { id: 1, name: 'item1' },
        { id: 2, name: 'item2' }
      ];
      
      // Clear any callbacks from subscription activation
      callbacks.forEach(cb => cb.mockClear());
      
      manager.handleQueryResults('q1', results);
      
      callbacks.forEach(cb => {
        expect(cb.callCount).toBe(1);
        expect(cb.calls[0][0].type).toBe('bootstrap');
        expect(cb.calls[0][0].results).toEqual(results);
      });
    });

    it('should not deliver to paused subscriptions', () => {
      manager.pauseSubscription(subscriptions[1].subscriptionId);
      
      // Clear any callbacks from subscription activation
      callbacks.forEach(cb => cb.mockClear());
      
      manager.handleQueryResults('q1', [{ id: 1 }]);
      
      expect(callbacks[0].callCount).toBe(1);
      expect(callbacks[1].callCount).toBe(0);
      expect(callbacks[2].callCount).toBe(1);
    });

    it('should deliver updates to active subscriptions', () => {
      const update = {
        type: 'add',
        data: { id: 3, name: 'item3' }
      };
      
      // Clear any callbacks from subscription activation
      callbacks.forEach(cb => cb.mockClear());
      
      manager.handleQueryUpdate('q1', update);
      
      callbacks.forEach(cb => {
        expect(cb.callCount).toBe(1);
        expect(cb.calls[0][0].type).toBe('update');
      });
    });

    it('should handle subscription errors', () => {
      // Clear any callbacks from subscription activation
      callbacks.forEach(cb => cb.mockClear());
      
      // Make one callback throw
      callbacks[1].mockImplementation = () => {
        throw new Error('Callback error');
      };
      
      // Add error handler to prevent unhandled error
      subscriptions[1].on('error', () => {});
      
      manager.handleQueryResults('q1', [{ id: 1 }]);
      
      // Other callbacks should still be called
      expect(callbacks[0].callCount).toBe(1);
      expect(callbacks[2].callCount).toBe(1);
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      dispatcher.registerQuery('q1', {
        type: 'select',
        relation: 'test'
      });
      dispatcher.registerQuery('q2', {
        type: 'select',
        relation: 'test2'
      });
    });

    it('should provide manager statistics', () => {
      manager.subscribe('q1', createMockFn());
      manager.subscribe('q1', createMockFn());
      const sub3 = manager.subscribe('q2', createMockFn());
      manager.pauseSubscription(sub3.subscriptionId);
      
      const stats = manager.getStats();
      
      expect(stats.totalSubscriptions).toBe(3);
      expect(stats.activeSubscriptions).toBe(2);
      expect(stats.pausedSubscriptions).toBe(1);
      expect(stats.queriesWithSubscriptions).toBe(2);
    });

    it('should count subscriptions by state', () => {
      const sub1 = manager.subscribe('q1', createMockFn());
      const sub2 = manager.subscribe('q1', createMockFn());
      manager.pauseSubscription(sub2.subscriptionId);
      
      const stats = manager.getStats();
      
      expect(stats.subscriptionsByState[SubscriptionState.ACTIVE]).toBe(1);
      expect(stats.subscriptionsByState[SubscriptionState.PAUSED]).toBe(1);
    });
  });

  describe('utility methods', () => {
    let subscription;

    beforeEach(() => {
      dispatcher.registerQuery('q1', {
        type: 'select',
        relation: 'test'
      });
      subscription = manager.subscribe('q1', createMockFn());
    });

    it('should get subscription by ID', () => {
      const retrieved = manager.getSubscription(subscription.subscriptionId);
      
      expect(retrieved).toBe(subscription);
    });

    it('should get active subscriptions', () => {
      const sub2 = manager.subscribe('q1', createMockFn(), {
        autoActivate: false
      });
      
      const active = manager.getActiveSubscriptions();
      
      expect(active).toHaveLength(1);
      expect(active).toContain(subscription);
      expect(active).not.toContain(sub2);
    });

    it('should clear all subscriptions', () => {
      manager.subscribe('q1', createMockFn());
      manager.subscribe('q1', createMockFn());
      
      manager.clear();
      
      expect(manager._subscriptions.size).toBe(0);
      expect(manager._querySubscriptions.size).toBe(0);
      expect(manager._activeCount).toBe(0);
    });

    it('should provide string representation', () => {
      const str = manager.toString();
      
      expect(str).toContain('SubscriptionManager');
      expect(str).toContain('subscriptions=1');
      expect(str).toContain('active=1');
    });
  });

  describe('event handling', () => {
    let subscription;

    beforeEach(() => {
      dispatcher.registerQuery('q1', {
        type: 'select',
        relation: 'test'
      });
      subscription = manager.subscribe('q1', createMockFn());
    });

    it('should emit subscription created event', () => {
      const handler = createMockFn();
      manager.on('subscriptionCreated', handler);
      
      manager.subscribe('q1', createMockFn());
      
      expect(handler.callCount).toBe(1);
      expect(handler.calls[0][0].queryId).toBe('q1');
    });

    it('should emit subscription removed event', () => {
      const handler = createMockFn();
      manager.on('subscriptionRemoved', handler);
      
      manager.unsubscribe(subscription.subscriptionId);
      
      expect(handler.callCount).toBe(1);
    });

    it('should emit results delivered event', () => {
      const handler = createMockFn();
      manager.on('resultsDelivered', handler);
      
      manager.handleQueryResults('q1', [{ id: 1 }]);
      
      expect(handler.callCount).toBe(1);
      expect(handler.calls[0][0].queryId).toBe('q1');
      expect(handler.calls[0][0].resultCount).toBe(1);
    });

    it('should forward subscription error events', () => {
      const handler = createMockFn();
      manager.on('subscriptionError', handler);
      
      // Add error handler to subscription to prevent unhandled
      subscription.on('error', () => {});
      subscription.handleError(new Error('Test error'));
      
      expect(handler.callCount).toBe(1);
      expect(handler.calls[0][0].queryId).toBe('q1');
    });

    it('should auto-remove cancelled subscriptions', () => {
      expect(manager._subscriptions.size).toBe(1);
      
      subscription.cancel();
      
      expect(manager._subscriptions.size).toBe(0);
    });
  });
});