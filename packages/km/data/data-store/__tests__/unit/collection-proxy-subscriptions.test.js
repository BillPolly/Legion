/**
 * CollectionProxy Subscriptions Unit Tests
 * Phase 4, Step 4.2: CollectionProxy Subscriptions
 * 
 * Comprehensive tests for reactive functionality in CollectionProxy including:
 * - Subscription setup and cleanup
 * - Collection change notifications (add/remove/update items)
 * - Multiple subscriber management
 * - Error handling in subscriptions
 * - Memory management and resource cleanup
 * - Array-like mutation handling
 * 
 * Tests follow TDD approach - write tests first, implement after.
 * No mocks - use real DataStore instances for proper validation.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CollectionProxy } from '../../src/collection-proxy.js';
import { DataStore } from '../../src/store.js';

describe('CollectionProxy Subscriptions Unit Tests', () => {
  let store;
  let schema;
  
  beforeEach(() => {
    // Test schema
    schema = {
      ':user/id': { valueType: 'string', unique: 'identity' },
      ':user/name': { valueType: 'string' },
      ':user/age': { valueType: 'number' },
      ':user/score': { valueType: 'number' },
      ':user/active': { valueType: 'boolean' },
      ':user/tags': { valueType: 'string', card: 'many' }
    };
    
    store = new DataStore(schema);
    
    // Add test data
    store.createEntities([
      { ':user/id': 'u1', ':user/name': 'Alice', ':user/age': 30, ':user/score': 100, ':user/tags': ['dev', 'admin'] },
      { ':user/id': 'u2', ':user/name': 'Bob', ':user/age': 25, ':user/score': 85, ':user/tags': ['dev'] },
      { ':user/id': 'u3', ':user/name': 'Charlie', ':user/age': 35, ':user/score': 120, ':user/tags': ['admin', 'manager'] }
    ]);
  });
  
  afterEach(() => {
    // Clean up any subscriptions and stop listening
    if (store && store._reactiveEngine) {
      store._reactiveEngine.stopListening();
      store._reactiveEngine.cleanupSubscriptions();
    }
  });

  describe('Basic Subscription Functionality', () => {
    test('should accept callback function for subscription', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new CollectionProxy(store, ['Alice', 'Bob'], querySpec);
      
      const callback = jest.fn();
      const unsubscribe = proxy.subscribe(callback);
      
      expect(typeof unsubscribe).toBe('function');
      expect(callback).not.toHaveBeenCalled(); // Should not be called immediately
    });
    
    test('should throw error for invalid callback parameter', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new CollectionProxy(store, ['Alice', 'Bob'], querySpec);
      
      expect(() => proxy.subscribe(null)).toThrow('Callback function is required');
      expect(() => proxy.subscribe(undefined)).toThrow('Callback function is required');
      expect(() => proxy.subscribe('invalid')).toThrow('Callback must be a function');
      expect(() => proxy.subscribe(123)).toThrow('Callback must be a function');
    });
    
    test('should return unsubscribe function that removes callback', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new CollectionProxy(store, ['Alice', 'Bob'], querySpec);
      
      const callback = jest.fn();
      const unsubscribe = proxy.subscribe(callback);
      
      // Verify callback is registered
      expect(proxy._subscribers.has(callback)).toBe(true);
      
      // Unsubscribe
      unsubscribe();
      
      // Verify callback is removed
      expect(proxy._subscribers.has(callback)).toBe(false);
    });
  });

  describe('Multiple Subscribers Management', () => {
    test('should support multiple subscribers', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new CollectionProxy(store, ['Alice', 'Bob'], querySpec);
      
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();
      
      const unsub1 = proxy.subscribe(callback1);
      const unsub2 = proxy.subscribe(callback2);
      const unsub3 = proxy.subscribe(callback3);
      
      expect(proxy._subscribers.size).toBe(3);
      expect(proxy._subscribers.has(callback1)).toBe(true);
      expect(proxy._subscribers.has(callback2)).toBe(true);
      expect(proxy._subscribers.has(callback3)).toBe(true);
      
      // Should return different unsubscribe functions
      expect(unsub1).not.toBe(unsub2);
      expect(unsub2).not.toBe(unsub3);
    });
    
    test('should remove only specific subscriber when unsubscribed', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new CollectionProxy(store, ['Alice', 'Bob'], querySpec);
      
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();
      
      const unsub1 = proxy.subscribe(callback1);
      const unsub2 = proxy.subscribe(callback2);
      const unsub3 = proxy.subscribe(callback3);
      
      // Remove middle subscriber
      unsub2();
      
      expect(proxy._subscribers.size).toBe(2);
      expect(proxy._subscribers.has(callback1)).toBe(true);
      expect(proxy._subscribers.has(callback2)).toBe(false);
      expect(proxy._subscribers.has(callback3)).toBe(true);
    });
    
    test('should handle duplicate subscription of same callback', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new CollectionProxy(store, ['Alice', 'Bob'], querySpec);
      
      const callback = jest.fn();
      
      const unsub1 = proxy.subscribe(callback);
      const unsub2 = proxy.subscribe(callback); // Same callback again
      
      // Set should only contain one instance
      expect(proxy._subscribers.size).toBe(1);
      expect(proxy._subscribers.has(callback)).toBe(true);
      
      // Both unsubscribe functions should work
      unsub1();
      expect(proxy._subscribers.has(callback)).toBe(false);
      
      // Second unsubscribe should be safe (no-op)
      unsub2(); // Should not throw
    });
  });

  describe('Collection Change Notifications', () => {
    test('should notify subscribers when collection changes', async () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const initialItems = ['Alice', 'Bob'];
      const proxy = new CollectionProxy(store, initialItems, querySpec);
      
      const callback = jest.fn();
      proxy.subscribe(callback);
      
      // Simulate collection change (this would normally come from DataStore subscription system)
      const newItems = ['Alice', 'Bob', 'Charlie'];
      proxy._currentItems = newItems;
      proxy._notifySubscribers(newItems);
      
      expect(callback).toHaveBeenCalledWith(newItems);
      expect(callback).toHaveBeenCalledTimes(1);
    });
    
    test('should notify all subscribers when collection changes', async () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const initialItems = ['Alice', 'Bob'];
      const proxy = new CollectionProxy(store, initialItems, querySpec);
      
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();
      
      proxy.subscribe(callback1);
      proxy.subscribe(callback2);
      proxy.subscribe(callback3);
      
      // Simulate collection change
      const newItems = ['Alice', 'Bob', 'Charlie', 'Dave'];
      proxy._currentItems = newItems;
      proxy._notifySubscribers(newItems);
      
      expect(callback1).toHaveBeenCalledWith(newItems);
      expect(callback2).toHaveBeenCalledWith(newItems);
      expect(callback3).toHaveBeenCalledWith(newItems);
      
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });
    
    test('should handle subscriber callback errors gracefully', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const initialItems = ['Alice', 'Bob'];
      const proxy = new CollectionProxy(store, initialItems, querySpec);
      
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = jest.fn();
      
      proxy.subscribe(errorCallback);
      proxy.subscribe(normalCallback);
      
      // Mock console.error to verify error logging
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Simulate collection change
      const newItems = ['Alice', 'Bob', 'Charlie'];
      proxy._currentItems = newItems;
      proxy._notifySubscribers(newItems);
      
      // Both callbacks should have been attempted
      expect(errorCallback).toHaveBeenCalledWith(newItems);
      expect(normalCallback).toHaveBeenCalledWith(newItems);
      
      // Error should have been logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'CollectionProxy subscriber callback error:', 
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Collection Change Detection', () => {
    test('should detect item addition correctly', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new CollectionProxy(store, ['Alice', 'Bob'], querySpec);
      
      expect(proxy._hasCollectionChanged(['Alice', 'Bob'], ['Alice', 'Bob', 'Charlie'])).toBe(true);
      expect(proxy._hasCollectionChanged(['Alice', 'Bob'], ['Alice', 'Bob'])).toBe(false);
    });
    
    test('should detect item removal correctly', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new CollectionProxy(store, ['Alice', 'Bob', 'Charlie'], querySpec);
      
      expect(proxy._hasCollectionChanged(['Alice', 'Bob', 'Charlie'], ['Alice', 'Bob'])).toBe(true);
      expect(proxy._hasCollectionChanged(['Alice', 'Bob'], ['Alice', 'Bob'])).toBe(false);
    });
    
    test('should detect item reordering correctly', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new CollectionProxy(store, ['Alice', 'Bob'], querySpec);
      
      expect(proxy._hasCollectionChanged(['Alice', 'Bob'], ['Bob', 'Alice'])).toBe(true);
      expect(proxy._hasCollectionChanged(['Alice', 'Bob'], ['Alice', 'Bob'])).toBe(false);
    });
    
    test('should handle null/empty collections correctly', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new CollectionProxy(store, [], querySpec);
      
      expect(proxy._hasCollectionChanged(null, [])).toBe(true);
      expect(proxy._hasCollectionChanged([], null)).toBe(true);
      expect(proxy._hasCollectionChanged([], [])).toBe(false);
      expect(proxy._hasCollectionChanged(null, null)).toBe(false);
      expect(proxy._hasCollectionChanged(undefined, undefined)).toBe(false);
    });
    
    test('should detect complex object changes in collection items', () => {
      const querySpec = {
        find: ['?data'],
        where: [['?e', ':test/data', '?data']]
      };
      
      const proxy = new CollectionProxy(store, [{ a: 1 }, { b: 2 }], querySpec);
      
      expect(proxy._hasCollectionChanged([{ a: 1 }, { b: 2 }], [{ a: 1 }, { b: 2 }])).toBe(false);
      expect(proxy._hasCollectionChanged([{ a: 1 }, { b: 2 }], [{ a: 1 }, { b: 3 }])).toBe(true);
      expect(proxy._hasCollectionChanged([{ a: 1 }], [{ a: 1 }, { b: 2 }])).toBe(true);
    });
  });

  describe('Memory Management and Cleanup', () => {
    test('should clean up subscriptions on destroy', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new CollectionProxy(store, ['Alice', 'Bob'], querySpec);
      
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      proxy.subscribe(callback1);
      proxy.subscribe(callback2);
      
      expect(proxy._subscribers.size).toBe(2);
      
      // Destroy proxy
      proxy.destroy();
      
      // Subscribers should be cleared
      expect(proxy._subscribers.size).toBe(0);
    });
    
    test('should clean up DataStore subscription on destroy', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new CollectionProxy(store, ['Alice', 'Bob'], querySpec);
      
      // Mock store.subscribe to track cleanup
      const mockCleanup = jest.fn();
      proxy._subscriptionCleanup = mockCleanup;
      
      proxy.destroy();
      
      expect(mockCleanup).toHaveBeenCalled();
      expect(proxy._subscriptionCleanup).toBe(null);
    });
    
    test('should handle multiple destroy calls safely', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new CollectionProxy(store, ['Alice', 'Bob'], querySpec);
      
      const callback = jest.fn();
      proxy.subscribe(callback);
      
      // Multiple destroy calls should be safe
      proxy.destroy();
      proxy.destroy();
      proxy.destroy();
      
      expect(proxy._subscribers.size).toBe(0);
      expect(proxy._subscriptionCleanup).toBe(null);
    });
  });

  describe('Integration with DataStore Subscription System', () => {
    test('should attempt to set up DataStore subscription if available', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      // Create proxy (constructor calls _setupReactiveSubscription)
      const proxy = new CollectionProxy(store, ['Alice', 'Bob'], querySpec);
      
      // Since DataStore doesn't have subscribe method yet, should handle gracefully
      expect(proxy._subscriptionCleanup).toBe(null);
    });
    
    test('should handle DataStore without subscription support gracefully', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      // Should not throw even if DataStore doesn't support subscriptions
      expect(() => {
        const proxy = new CollectionProxy(store, ['Alice', 'Bob'], querySpec);
        expect(proxy).toBeInstanceOf(CollectionProxy);
      }).not.toThrow();
    });
    
    test('should validate DataStore availability during subscription', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      // Create a mock store that will fail db() call
      const fakeStore = {
        db: () => {
          throw new Error('Database not available');
        }
      };
      
      const proxy = new CollectionProxy(fakeStore, ['Alice', 'Bob'], querySpec);
      const callback = jest.fn();
      
      expect(() => proxy.subscribe(callback))
        .toThrow('Cannot subscribe: DataStore is not available');
    });
  });

  describe('Array-like Interface and Subscriptions', () => {
    test('should maintain subscriptions during array-like operations', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new CollectionProxy(store, ['Alice', 'Bob'], querySpec);
      
      const callback = jest.fn();
      proxy.subscribe(callback);
      
      // Array-like operations should not affect subscriptions
      const mapped = proxy.map(name => name.toLowerCase());
      const filtered = proxy.filter(name => name.startsWith('A'));
      
      expect(proxy._subscribers.size).toBe(1);
      expect(proxy._subscribers.has(callback)).toBe(true);
    });
    
    test('should handle length changes properly with subscriptions', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new CollectionProxy(store, ['Alice', 'Bob'], querySpec);
      
      const callback = jest.fn();
      proxy.subscribe(callback);
      
      // Initial length
      expect(proxy.length).toBe(2);
      
      // Simulate collection growing
      proxy._currentItems = ['Alice', 'Bob', 'Charlie'];
      expect(proxy.length).toBe(3);
      
      // Subscriptions should remain intact
      expect(proxy._subscribers.size).toBe(1);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    test('should handle subscription to proxy with empty collection', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new CollectionProxy(store, [], querySpec);
      
      const callback = jest.fn();
      const unsubscribe = proxy.subscribe(callback);
      
      expect(typeof unsubscribe).toBe('function');
      expect(proxy._subscribers.has(callback)).toBe(true);
    });
    
    test('should handle subscription to proxy with null collection', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new CollectionProxy(store, null, querySpec);
      
      const callback = jest.fn();
      const unsubscribe = proxy.subscribe(callback);
      
      expect(typeof unsubscribe).toBe('function');
      expect(proxy._subscribers.has(callback)).toBe(true);
    });
    
    test('should handle rapid subscribe/unsubscribe cycles', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new CollectionProxy(store, ['Alice', 'Bob'], querySpec);
      
      // Rapid subscribe/unsubscribe cycles
      for (let i = 0; i < 100; i++) {
        const callback = jest.fn();
        const unsubscribe = proxy.subscribe(callback);
        expect(proxy._subscribers.has(callback)).toBe(true);
        unsubscribe();
        expect(proxy._subscribers.has(callback)).toBe(false);
      }
      
      expect(proxy._subscribers.size).toBe(0);
    });
    
    test('should handle large collection changes efficiently', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      // Large initial collection
      const largeCollection = Array.from({ length: 1000 }, (_, i) => `User${i}`);
      const proxy = new CollectionProxy(store, largeCollection, querySpec);
      
      const callback = jest.fn();
      proxy.subscribe(callback);
      
      // Simulate large change
      const newLargeCollection = Array.from({ length: 1500 }, (_, i) => `User${i}`);
      proxy._currentItems = newLargeCollection;
      proxy._notifySubscribers(newLargeCollection);
      
      expect(callback).toHaveBeenCalledWith(newLargeCollection);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});