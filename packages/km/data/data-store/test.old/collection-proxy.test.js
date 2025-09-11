/**
 * CollectionProxy Unit Tests
 * Phase 1, Step 1.2: Create CollectionProxy Class
 * 
 * TDD approach: Tests written first, then implementation
 * No mocks - using real DataStore and DataScript instances for integration
 * 
 * CollectionProxy handles query results with multiple items and provides:
 * - Array-like interface (iteration, length, indexing)
 * - Proxy methods (value(), query(), subscribe())
 * - Functional array methods (map, filter, forEach, etc.)
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { CollectionProxy } from '../src/collection-proxy.js';
import { DataStore } from '../src/store.js';

describe('CollectionProxy Unit Tests', () => {
  let store;
  let schema;
  
  beforeEach(() => {
    // Real DataStore instance as per project rules (no mocks)
    schema = {
      ':user/id': { valueType: 'string', unique: 'identity' },
      ':user/name': { valueType: 'string' },
      ':user/age': { valueType: 'number' },
      ':user/verified': { valueType: 'boolean' },
      ':user/friends': { valueType: 'ref', card: 'many' },
      ':post/id': { valueType: 'string', unique: 'identity' },
      ':post/title': { valueType: 'string' },
      ':post/author': { valueType: 'ref' }
    };
    
    store = new DataStore(schema);
    
    // Add test data
    const usersResult = store.createEntities([
      { ':user/id': 'user-1', ':user/name': 'Alice', ':user/age': 30, ':user/verified': true },
      { ':user/id': 'user-2', ':user/name': 'Bob', ':user/age': 25, ':user/verified': false },
      { ':user/id': 'user-3', ':user/name': 'Charlie', ':user/age': 35, ':user/verified': true }
    ]);
    
    const postResult = store.createEntity({ 
      ':post/id': 'post-1', 
      ':post/title': 'Hello World', 
      ':post/author': usersResult.entityIds[0]
    });
  });
  
  afterEach(() => {
    store = null;
  });

  describe('Constructor and Basic Methods', () => {
    test('should create CollectionProxy with array of values and querySpec', () => {
      const items = ['Alice', 'Bob', 'Charlie'];
      const querySpec = { 
        find: ['?name'], 
        where: [['?e', ':user/name', '?name']] 
      };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      expect(collectionProxy).toBeInstanceOf(CollectionProxy);
      expect(collectionProxy.store).toBe(store);
      expect(collectionProxy._currentItems).toEqual(items);
      expect(collectionProxy._querySpec).toEqual(querySpec);
      expect(collectionProxy.length).toBe(3);
    });
    
    test('should create CollectionProxy with empty array', () => {
      const items = [];
      const querySpec = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      expect(collectionProxy.length).toBe(0);
      expect(collectionProxy._currentItems).toEqual([]);
    });
    
    test('should create CollectionProxy with single item (converted to array)', () => {
      const item = 'Alice';
      const querySpec = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, item, querySpec);
      
      expect(collectionProxy.length).toBe(1);
      expect(collectionProxy._currentItems).toEqual(['Alice']);
    });
    
    test('should create CollectionProxy with array of entity IDs', () => {
      const entityIds = [1, 2, 3];
      const querySpec = { find: ['?e'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, entityIds, querySpec);
      
      expect(collectionProxy.length).toBe(3);
      expect(collectionProxy._currentItems).toEqual([1, 2, 3]);
    });
    
    test('should throw error for invalid constructor parameters', () => {
      expect(() => new CollectionProxy()).toThrow('CollectionProxy requires store parameter');
      expect(() => new CollectionProxy(store)).toThrow('CollectionProxy requires currentItems parameter');
      expect(() => new CollectionProxy(store, [])).toThrow('CollectionProxy requires querySpec parameter');
      
      // Invalid store
      expect(() => new CollectionProxy({}, [], {})).toThrow('CollectionProxy requires valid DataStore instance');
    });
  });

  describe('Array-like Interface', () => {
    test('should provide length property', () => {
      const items = ['Alice', 'Bob', 'Charlie'];
      const querySpec = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      expect(collectionProxy.length).toBe(3);
    });
    
    test('should support array indexing', () => {
      const items = ['Alice', 'Bob', 'Charlie'];
      const querySpec = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      expect(collectionProxy[0]).toBe('Alice');
      expect(collectionProxy[1]).toBe('Bob');
      expect(collectionProxy[2]).toBe('Charlie');
      expect(collectionProxy[3]).toBeUndefined();
    });
    
    test('should support negative indexing', () => {
      const items = ['Alice', 'Bob', 'Charlie'];
      const querySpec = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      expect(collectionProxy[-1]).toBeUndefined(); // JavaScript arrays don't support negative indexing
    });
    
    test('should be iterable with for...of', () => {
      const items = ['Alice', 'Bob', 'Charlie'];
      const querySpec = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      const result = [];
      for (const item of collectionProxy) {
        result.push(item);
      }
      
      expect(result).toEqual(['Alice', 'Bob', 'Charlie']);
    });
    
    test('should support spread operator', () => {
      const items = ['Alice', 'Bob', 'Charlie'];
      const querySpec = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      const result = [...collectionProxy];
      
      expect(result).toEqual(['Alice', 'Bob', 'Charlie']);
    });
  });

  describe('value() Method', () => {
    test('should return JavaScript array for primitive values', () => {
      const items = ['Alice', 'Bob', 'Charlie'];
      const querySpec = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      const result = collectionProxy.value();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(['Alice', 'Bob', 'Charlie']);
      expect(result).not.toBe(items); // Should be a copy
    });
    
    test('should return empty array for empty collection', () => {
      const collectionProxy = new CollectionProxy(store, [], { find: ['?e'], where: [] });
      
      const result = collectionProxy.value();
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });
    
    test('should return immutable copy of complex values', () => {
      const items = [{ name: 'Alice' }, { name: 'Bob' }];
      const querySpec = { find: ['?e'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      const result = collectionProxy.value();
      expect(result).toEqual([{ name: 'Alice' }, { name: 'Bob' }]);
      expect(result).not.toBe(items); // Should be a copy
      expect(result[0]).not.toBe(items[0]); // Deep copy
      
      // Modifying result should not affect original
      result[0].name = 'Modified';
      expect(items[0].name).toBe('Alice');
    });
    
    test('should handle mixed value types', () => {
      const items = ['Alice', 42, true, null, { complex: 'value' }];
      const querySpec = { find: ['?v'], where: [['?e', ':some/attr', '?v']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      const result = collectionProxy.value();
      expect(result).toEqual(['Alice', 42, true, null, { complex: 'value' }]);
      expect(typeof result[4]).toBe('object');
      expect(result[4]).not.toBe(items[4]); // Complex object should be copied
    });
  });

  describe('Functional Array Methods', () => {
    test('should support forEach method', () => {
      const items = ['Alice', 'Bob', 'Charlie'];
      const querySpec = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      const result = [];
      collectionProxy.forEach((item, index) => {
        result.push(`${index}: ${item}`);
      });
      
      expect(result).toEqual(['0: Alice', '1: Bob', '2: Charlie']);
    });
    
    test('should support map method returning new CollectionProxy', () => {
      const items = ['Alice', 'Bob', 'Charlie'];
      const querySpec = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      const mapped = collectionProxy.map(item => item.toUpperCase());
      
      expect(mapped).toBeInstanceOf(CollectionProxy);
      expect(mapped.value()).toEqual(['ALICE', 'BOB', 'CHARLIE']);
      expect(mapped.length).toBe(3);
    });
    
    test('should support filter method returning new CollectionProxy', () => {
      const items = ['Alice', 'Bob', 'Charlie', 'Anna'];
      const querySpec = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      const filtered = collectionProxy.filter(item => item.startsWith('A'));
      
      expect(filtered).toBeInstanceOf(CollectionProxy);
      expect(filtered.value()).toEqual(['Alice', 'Anna']);
      expect(filtered.length).toBe(2);
    });
    
    test('should support reduce method', () => {
      const items = [1, 2, 3, 4, 5];
      const querySpec = { find: ['?n'], where: [['?e', ':number/value', '?n']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      const sum = collectionProxy.reduce((acc, item) => acc + item, 0);
      
      expect(sum).toBe(15);
    });
    
    test('should support find method', () => {
      const items = ['Alice', 'Bob', 'Charlie'];
      const querySpec = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      const found = collectionProxy.find(item => item.includes('ob'));
      
      expect(found).toBe('Bob');
    });
    
    test('should support some method', () => {
      const items = ['Alice', 'Bob', 'Charlie'];
      const querySpec = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      expect(collectionProxy.some(item => item.startsWith('A'))).toBe(true);
      expect(collectionProxy.some(item => item.startsWith('Z'))).toBe(false);
    });
    
    test('should support every method', () => {
      const items = ['Alice', 'Bob', 'Charlie'];
      const querySpec = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      expect(collectionProxy.every(item => typeof item === 'string')).toBe(true);
      expect(collectionProxy.every(item => item.startsWith('A'))).toBe(false);
    });
    
    test('should support includes method', () => {
      const items = ['Alice', 'Bob', 'Charlie'];
      const querySpec = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      expect(collectionProxy.includes('Bob')).toBe(true);
      expect(collectionProxy.includes('David')).toBe(false);
    });
  });

  describe('query() Method', () => {
    test('should accept valid querySpec and return appropriate proxy type', () => {
      const items = ['Alice', 'Bob', 'Charlie'];
      const querySpec = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      // Query for ages of users (should return CollectionProxy)
      const ageQuery = {
        find: ['?age'],
        where: [['?e', ':user/name', '?current-value'], ['?e', ':user/age', '?age']]
      };
      
      const result = collectionProxy.query(ageQuery);
      expect(result).toBeDefined();
      // Type will be determined by query result detection logic
    });
    
    test('should bind collection context in querySpec', () => {
      const items = ['Alice', 'Bob'];
      const querySpec = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      // Query using collection items as context
      const contextQuery = {
        find: ['?age'],
        where: [['?e', ':user/name', '?collection-item'], ['?e', ':user/age', '?age']]
      };
      
      const result = collectionProxy.query(contextQuery);
      expect(result).toBeDefined();
    });
    
    test('should handle aggregate queries over collection', () => {
      const items = [30, 25, 35]; // Ages
      const querySpec = { find: ['?age'], where: [['?e', ':user/age', '?age']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      // Aggregate operations on collection
      const avgQuery = {
        find: [['(avg ?collection-item)']],
        where: []
      };
      
      const result = collectionProxy.query(avgQuery);
      expect(result).toBeDefined();
    });
    
    test('should throw error for invalid querySpec', () => {
      const collectionProxy = new CollectionProxy(store, ['Alice'], { find: ['?name'], where: [] });
      
      expect(() => collectionProxy.query()).toThrow('Query spec is required');
      expect(() => collectionProxy.query({})).toThrow('Query spec must have find clause');
      expect(() => collectionProxy.query({ find: [] })).toThrow('Query spec find clause cannot be empty');
    });
  });

  describe('subscribe() Method', () => {
    test('should accept callback function and return unsubscribe function', () => {
      const items = ['Alice', 'Bob', 'Charlie'];
      const querySpec = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      let callbackCalled = false;
      const callback = () => { callbackCalled = true; };
      const unsubscribe = collectionProxy.subscribe(callback);
      
      expect(typeof unsubscribe).toBe('function');
      expect(callbackCalled).toBe(false); // Should not call immediately
    });
    
    test('should call callback when collection changes', () => {
      const items = ['Alice', 'Bob'];
      const querySpec = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      
      const collectionProxy = new CollectionProxy(store, items, querySpec);
      
      let callbackCalled = false;
      let callbackValue = null;
      const callback = (newCollection) => {
        callbackCalled = true;
        callbackValue = newCollection;
      };
      
      collectionProxy.subscribe(callback);
      
      // Should not call immediately
      expect(callbackCalled).toBe(false);
      
      // Test manual notification (simulating what the reactive system would do)
      collectionProxy._notifySubscribers(['Alice', 'Bob', 'Charlie']);
      expect(callbackCalled).toBe(true);
      expect(callbackValue).toEqual(['Alice', 'Bob', 'Charlie']);
    });
    
    test('should support multiple subscribers', () => {
      const collectionProxy = new CollectionProxy(store, [1, 2, 3], { find: ['?n'], where: [] });
      
      let callback1Called = false;
      let callback2Called = false;
      let callback1Value = null;
      let callback2Value = null;
      
      const callback1 = (value) => {
        callback1Called = true;
        callback1Value = value;
      };
      
      const callback2 = (value) => {
        callback2Called = true;
        callback2Value = value;
      };
      
      collectionProxy.subscribe(callback1);
      collectionProxy.subscribe(callback2);
      
      // Test manual notification
      collectionProxy._notifySubscribers([1, 2, 3, 4]);
      
      expect(callback1Called).toBe(true);
      expect(callback1Value).toEqual([1, 2, 3, 4]);
      expect(callback2Called).toBe(true);
      expect(callback2Value).toEqual([1, 2, 3, 4]);
    });
    
    test('should unsubscribe correctly', () => {
      const collectionProxy = new CollectionProxy(store, ['A', 'B'], { find: ['?v'], where: [] });
      
      let callbackCalled = false;
      const callback = () => { callbackCalled = true; };
      const unsubscribe = collectionProxy.subscribe(callback);
      
      // Unsubscribe immediately
      unsubscribe();
      
      // Test that unsubscribed callback is not called
      collectionProxy._notifySubscribers(['A', 'B', 'C']);
      
      expect(callbackCalled).toBe(false);
    });
    
    test('should throw error for invalid callback', () => {
      const collectionProxy = new CollectionProxy(store, [], { find: ['?v'], where: [] });
      
      expect(() => collectionProxy.subscribe()).toThrow('Callback function is required');
      expect(() => collectionProxy.subscribe('not-a-function')).toThrow('Callback must be a function');
      expect(() => collectionProxy.subscribe({})).toThrow('Callback must be a function');
    });
  });

  describe('Collection-specific Operations', () => {
    test('should provide first() method', () => {
      const items = ['Alice', 'Bob', 'Charlie'];
      const collectionProxy = new CollectionProxy(store, items, { find: ['?name'], where: [] });
      
      expect(collectionProxy.first()).toBe('Alice');
    });
    
    test('should provide last() method', () => {
      const items = ['Alice', 'Bob', 'Charlie'];
      const collectionProxy = new CollectionProxy(store, items, { find: ['?name'], where: [] });
      
      expect(collectionProxy.last()).toBe('Charlie');
    });
    
    test('should provide isEmpty() method', () => {
      const emptyProxy = new CollectionProxy(store, [], { find: ['?v'], where: [] });
      const fullProxy = new CollectionProxy(store, ['Alice'], { find: ['?v'], where: [] });
      
      expect(emptyProxy.isEmpty()).toBe(true);
      expect(fullProxy.isEmpty()).toBe(false);
    });
    
    test('should provide slice method returning new CollectionProxy', () => {
      const items = ['Alice', 'Bob', 'Charlie', 'David'];
      const collectionProxy = new CollectionProxy(store, items, { find: ['?name'], where: [] });
      
      const sliced = collectionProxy.slice(1, 3);
      
      expect(sliced).toBeInstanceOf(CollectionProxy);
      expect(sliced.value()).toEqual(['Bob', 'Charlie']);
      expect(sliced.length).toBe(2);
    });
    
    test('should handle type consistency across operations', () => {
      const items = [30, 25, 35];
      const collectionProxy = new CollectionProxy(store, items, { find: ['?age'], where: [] });
      
      const doubled = collectionProxy.map(age => age * 2);
      const adults = collectionProxy.filter(age => age >= 30);
      
      expect(doubled.value()).toEqual([60, 50, 70]);
      expect(adults.value()).toEqual([30, 35]);
      
      // All should maintain consistent type
      expect(typeof doubled.value()[0]).toBe('number');
      expect(typeof adults.value()[0]).toBe('number');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid store gracefully', () => {
      const invalidStore = { /* missing db method */ };
      
      expect(() => {
        new CollectionProxy(invalidStore, ['Alice'], { find: ['?name'], where: [] });
      }).toThrow('CollectionProxy requires valid DataStore instance');
    });
    
    test('should handle null and undefined items', () => {
      const items = ['Alice', null, undefined, 'Bob'];
      const collectionProxy = new CollectionProxy(store, items, { find: ['?v'], where: [] });
      
      expect(collectionProxy.length).toBe(4);
      expect(collectionProxy[1]).toBe(null);
      expect(collectionProxy[2]).toBe(undefined);
      
      const result = collectionProxy.value();
      expect(result).toEqual(['Alice', null, undefined, 'Bob']);
    });
    
    test('should handle empty query results', () => {
      const collectionProxy = new CollectionProxy(store, [], { find: ['?name'], where: [] });
      
      expect(collectionProxy.length).toBe(0);
      expect(collectionProxy.value()).toEqual([]);
      expect(collectionProxy.isEmpty()).toBe(true);
      expect(collectionProxy.first()).toBeUndefined();
      expect(collectionProxy.last()).toBeUndefined();
    });
    
    test('should preserve original query spec', () => {
      const querySpec = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      const collectionProxy = new CollectionProxy(store, ['Alice'], querySpec);
      
      // Original query spec should be preserved and not modified
      expect(collectionProxy._querySpec).toEqual(querySpec);
      expect(collectionProxy._querySpec).not.toBe(querySpec); // Should be a copy
    });
    
    test('should handle concurrent modifications safely', () => {
      const items = ['Alice', 'Bob', 'Charlie'];
      const collectionProxy = new CollectionProxy(store, items, { find: ['?name'], where: [] });
      
      // Multiple operations should not interfere
      const mapped1 = collectionProxy.map(item => item.toUpperCase());
      const filtered1 = collectionProxy.filter(item => item.length > 3);
      const mapped2 = collectionProxy.map(item => item.toLowerCase());
      
      expect(mapped1.value()).toEqual(['ALICE', 'BOB', 'CHARLIE']);
      expect(filtered1.value()).toEqual(['Alice', 'Charlie']);
      expect(mapped2.value()).toEqual(['alice', 'bob', 'charlie']);
      expect(collectionProxy.value()).toEqual(['Alice', 'Bob', 'Charlie']); // Original unchanged
    });
  });
});