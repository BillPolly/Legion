/**
 * StreamProxy Subscriptions Unit Tests
 * Phase 4, Step 4.1: StreamProxy Subscriptions
 * 
 * Comprehensive tests for reactive functionality in StreamProxy including:
 * - Subscription setup and cleanup
 * - Value change notifications
 * - Multiple subscriber management
 * - Error handling in subscriptions
 * - Memory management and resource cleanup
 * 
 * Tests follow TDD approach - write tests first, implement after.
 * No mocks - use real DataStore instances for proper validation.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { StreamProxy } from '../../src/stream-proxy.js';
import { DataStore } from '../../src/store.js';

describe('StreamProxy Subscriptions Unit Tests', () => {
  let store;
  let schema;
  
  beforeEach(() => {
    // Test schema
    schema = {
      ':user/id': { valueType: 'string', unique: 'identity' },
      ':user/name': { valueType: 'string' },
      ':user/age': { valueType: 'number' },
      ':user/score': { valueType: 'number' },
      ':user/active': { valueType: 'boolean' }
    };
    
    store = new DataStore(schema);
    
    // Add test data
    store.createEntities([
      { ':user/id': 'u1', ':user/name': 'Alice', ':user/age': 30, ':user/score': 100 },
      { ':user/id': 'u2', ':user/name': 'Bob', ':user/age': 25, ':user/score': 85 }
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
      
      const proxy = new StreamProxy(store, ['Alice'], querySpec);
      
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
      
      const proxy = new StreamProxy(store, ['Alice'], querySpec);
      
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
      
      const proxy = new StreamProxy(store, ['Alice'], querySpec);
      
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
      
      const proxy = new StreamProxy(store, ['Alice'], querySpec);
      
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
      
      const proxy = new StreamProxy(store, ['Alice'], querySpec);
      
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
      
      const proxy = new StreamProxy(store, ['Alice'], querySpec);
      
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

  describe('Value Change Notifications', () => {
    test('should notify subscribers when value changes', async () => {
      const querySpec = {
        find: ['?score'],
        where: [['?e', ':user/id', 'u1'], ['?e', ':user/score', '?score']]
      };
      
      const initialScore = store.query(querySpec)[0][0];
      const proxy = new StreamProxy(store, initialScore, querySpec);
      
      const callback = jest.fn();
      proxy.subscribe(callback);
      
      // Simulate value change (this would normally come from DataStore subscription system)
      const newValue = 150;
      proxy._currentValue = newValue;
      proxy._notifySubscribers(newValue);
      
      expect(callback).toHaveBeenCalledWith(newValue);
      expect(callback).toHaveBeenCalledTimes(1);
    });
    
    test('should notify all subscribers when value changes', async () => {
      const querySpec = {
        find: ['?score'],
        where: [['?e', ':user/id', 'u1'], ['?e', ':user/score', '?score']]
      };
      
      const initialScore = store.query(querySpec)[0][0];
      const proxy = new StreamProxy(store, initialScore, querySpec);
      
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();
      
      proxy.subscribe(callback1);
      proxy.subscribe(callback2);
      proxy.subscribe(callback3);
      
      // Simulate value change
      const newValue = 175;
      proxy._currentValue = newValue;
      proxy._notifySubscribers(newValue);
      
      expect(callback1).toHaveBeenCalledWith(newValue);
      expect(callback2).toHaveBeenCalledWith(newValue);
      expect(callback3).toHaveBeenCalledWith(newValue);
      
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });
    
    test('should handle subscriber callback errors gracefully', () => {
      const querySpec = {
        find: ['?score'],
        where: [['?e', ':user/id', 'u1'], ['?e', ':user/score', '?score']]
      };
      
      const initialScore = store.query(querySpec)[0][0];
      const proxy = new StreamProxy(store, initialScore, querySpec);
      
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = jest.fn();
      
      proxy.subscribe(errorCallback);
      proxy.subscribe(normalCallback);
      
      // Mock console.error to verify error logging
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Simulate value change
      const newValue = 200;
      proxy._currentValue = newValue;
      proxy._notifySubscribers(newValue);
      
      // Both callbacks should have been attempted
      expect(errorCallback).toHaveBeenCalledWith(newValue);
      expect(normalCallback).toHaveBeenCalledWith(newValue);
      
      // Error should have been logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'StreamProxy subscriber callback error:', 
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Value Change Detection', () => {
    test('should detect primitive value changes correctly', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new StreamProxy(store, 'Alice', querySpec);
      
      expect(proxy._hasValueChanged('Alice', 'Bob')).toBe(true);
      expect(proxy._hasValueChanged('Alice', 'Alice')).toBe(false);
      expect(proxy._hasValueChanged(100, 200)).toBe(true);
      expect(proxy._hasValueChanged(100, 100)).toBe(false);
    });
    
    test('should detect null/undefined changes correctly', () => {
      const querySpec = {
        find: ['?value'],
        where: [['?e', ':test/value', '?value']]
      };
      
      const proxy = new StreamProxy(store, null, querySpec);
      
      expect(proxy._hasValueChanged(null, null)).toBe(false);
      expect(proxy._hasValueChanged(undefined, undefined)).toBe(false);
      expect(proxy._hasValueChanged(null, undefined)).toBe(true);
      expect(proxy._hasValueChanged(undefined, null)).toBe(true);
      expect(proxy._hasValueChanged(null, 'value')).toBe(true);
      expect(proxy._hasValueChanged('value', null)).toBe(true);
    });
    
    test('should detect complex object changes correctly', () => {
      const querySpec = {
        find: ['?data'],
        where: [['?e', ':test/data', '?data']]
      };
      
      const proxy = new StreamProxy(store, { a: 1 }, querySpec);
      
      expect(proxy._hasValueChanged({ a: 1 }, { a: 1 })).toBe(false);
      expect(proxy._hasValueChanged({ a: 1 }, { a: 2 })).toBe(true);
      expect(proxy._hasValueChanged({ a: 1 }, { a: 1, b: 2 })).toBe(true);
      expect(proxy._hasValueChanged([1, 2], [1, 2])).toBe(false);
      expect(proxy._hasValueChanged([1, 2], [1, 3])).toBe(true);
    });
  });

  describe('Memory Management and Cleanup', () => {
    test('should clean up subscriptions on destroy', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new StreamProxy(store, ['Alice'], querySpec);
      
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
      
      const proxy = new StreamProxy(store, ['Alice'], querySpec);
      
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
      
      const proxy = new StreamProxy(store, ['Alice'], querySpec);
      
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
      const proxy = new StreamProxy(store, ['Alice'], querySpec);
      
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
        const proxy = new StreamProxy(store, ['Alice'], querySpec);
        expect(proxy).toBeInstanceOf(StreamProxy);
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
      
      const proxy = new StreamProxy(fakeStore, ['Alice'], querySpec);
      const callback = jest.fn();
      
      expect(() => proxy.subscribe(callback))
        .toThrow('Cannot subscribe: DataStore is not available');
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    test('should handle subscription to proxy with null current value', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new StreamProxy(store, null, querySpec);
      
      const callback = jest.fn();
      const unsubscribe = proxy.subscribe(callback);
      
      expect(typeof unsubscribe).toBe('function');
      expect(proxy._subscribers.has(callback)).toBe(true);
    });
    
    test('should handle subscription to proxy with undefined current value', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const proxy = new StreamProxy(store, undefined, querySpec);
      
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
      
      const proxy = new StreamProxy(store, ['Alice'], querySpec);
      
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
  });
});