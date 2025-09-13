/**
 * DataStoreProxy Class Unit Tests
 * Testing factory proxy for creating appropriate proxy types based on query characteristics
 */

import { DataStoreProxy } from '../src/DataStoreProxy.js';
import { Handle } from '@legion/handle';
import { EntityProxy } from '../src/EntityProxy.js';
import { StreamProxy } from '../src/StreamProxy.js';
import { CollectionProxy } from '../src/CollectionProxy.js';
import { createTestStore, createSampleData, assertions, validators, errorHelpers } from './setup.js';

describe('DataStoreProxy', () => {
  let store;
  let sampleData;
  
  beforeEach(() => {
    store = createTestStore();
    sampleData = createSampleData(store);
  });
  
  describe('Constructor', () => {
    test('should require store parameter', () => {
      expect(() => new DataStoreProxy()).toThrow('DataStore is required');
      expect(() => new DataStoreProxy(null)).toThrow('DataStore is required');
    });
    
    test('should validate store has required methods', () => {
      const invalidStore = { query: 'not a function' };
      expect(() => new DataStoreProxy(invalidStore)).toThrow('DataStore is required');
    });
    
    test('should accept valid store parameter', () => {
      expect(() => new DataStoreProxy(store)).not.toThrow();
      const proxy = new DataStoreProxy(store);
      expect(proxy.store).toBe(store);
    });
    
    test('should inherit from Handle', () => {
      const proxy = new DataStoreProxy(store);
      expect(proxy).toBeInstanceOf(Handle);
      expect(typeof proxy.subscribe).toBe('function');
      expect(typeof proxy.destroy).toBe('function');
    });
  });
  
  describe('Entity Proxy Creation', () => {
    test('should create EntityProxy for entity ID parameter', () => {
      const proxy = new DataStoreProxy(store);
      
      const entityProxy = proxy.entity(sampleData.users.alice);
      
      expect(entityProxy).toBeInstanceOf(EntityProxy);
      expect(entityProxy.entityId).toBe(sampleData.users.alice);
      expect(entityProxy.store).toBe(store);
    });
    
    test('should validate entity ID parameter', () => {
      const proxy = new DataStoreProxy(store);
      
      expect(() => proxy.entity()).toThrow('Entity ID is required');
      expect(() => proxy.entity(null)).toThrow('Entity ID is required');
      expect(() => proxy.entity('invalid')).toThrow('Entity ID must be a number');
    });
    
    test('should cache entity proxies for same entity ID', () => {
      const proxy = new DataStoreProxy(store);
      
      const proxy1 = proxy.entity(sampleData.users.alice);
      const proxy2 = proxy.entity(sampleData.users.alice);
      
      expect(proxy1).toBe(proxy2); // Same instance
    });
    
    test('should create different proxies for different entity IDs', () => {
      const proxy = new DataStoreProxy(store);
      
      const aliceProxy = proxy.entity(sampleData.users.alice);
      const bobProxy = proxy.entity(sampleData.users.bob);
      
      expect(aliceProxy).not.toBe(bobProxy);
      expect(aliceProxy.entityId).toBe(sampleData.users.alice);
      expect(bobProxy.entityId).toBe(sampleData.users.bob);
    });
  });
  
  describe('Stream Proxy Creation', () => {
    test('should create StreamProxy for streaming queries', () => {
      const proxy = new DataStoreProxy(store);
      
      const querySpec = {
        find: ['?e', '?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const streamProxy = proxy.stream(querySpec);
      
      expect(streamProxy).toBeInstanceOf(StreamProxy);
      expect(streamProxy.querySpec).toEqual(querySpec);
      expect(streamProxy.store).toBe(store);
    });
    
    test('should validate stream query specification', () => {
      const proxy = new DataStoreProxy(store);
      
      expect(() => proxy.stream()).toThrow('Query specification is required');
      expect(() => proxy.stream(null)).toThrow('Query specification is required');
      expect(() => proxy.stream({})).toThrow('Query must have find clause');
      expect(() => proxy.stream({ find: ['?e'] })).toThrow('Query must have where clause');
    });
    
    test('should create multiple stream proxies for different queries', () => {
      const proxy = new DataStoreProxy(store);
      
      const query1 = {
        find: ['?e'],
        where: [['?e', ':user/active', true]]
      };
      
      const query2 = {
        find: ['?e', '?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const stream1 = proxy.stream(query1);
      const stream2 = proxy.stream(query2);
      
      expect(stream1).not.toBe(stream2);
      expect(stream1.querySpec).toEqual(query1);
      expect(stream2.querySpec).toEqual(query2);
    });
  });
  
  describe('Collection Proxy Creation', () => {
    test('should create CollectionProxy for collection queries', () => {
      const proxy = new DataStoreProxy(store);
      
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        entityKey: '?e'
      };
      
      const collectionProxy = proxy.collection(collectionSpec);
      
      expect(collectionProxy).toBeInstanceOf(CollectionProxy);
      expect(collectionProxy.collectionSpec).toEqual(collectionSpec);
      expect(collectionProxy.entityKey).toBe('?e');
      expect(collectionProxy.store).toBe(store);
    });
    
    test('should validate collection specification', () => {
      const proxy = new DataStoreProxy(store);
      
      expect(() => proxy.collection()).toThrow('Collection specification is required');
      expect(() => proxy.collection(null)).toThrow('Collection specification is required');
      expect(() => proxy.collection({})).toThrow('Collection specification must have find clause');
      expect(() => proxy.collection({ 
        find: ['?e'] 
      })).toThrow('Collection specification must have where clause');
      expect(() => proxy.collection({ 
        find: ['?e'], 
        where: [['?e', ':user/name', '?name']] 
      })).toThrow('Collection specification must have entityKey');
    });
    
    test('should create multiple collection proxies for different collections', () => {
      const proxy = new DataStoreProxy(store);
      
      const activeUsersSpec = {
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        entityKey: '?e'
      };
      
      const allUsersSpec = {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      };
      
      const activeCollection = proxy.collection(activeUsersSpec);
      const allCollection = proxy.collection(allUsersSpec);
      
      expect(activeCollection).not.toBe(allCollection);
      expect(activeCollection.collectionSpec).toEqual(activeUsersSpec);
      expect(allCollection.collectionSpec).toEqual(allUsersSpec);
    });
  });
  
  describe('Auto-Detection Proxy Creation', () => {
    test('should detect entity queries and create EntityProxy via query()', () => {
      const proxy = new DataStoreProxy(store);
      
      // Entity query (single entity ID in where clause)
      const entityQuery = {
        find: ['?attr', '?value'],
        where: [[sampleData.users.alice, '?attr', '?value']]
      };
      
      const result = proxy.query(entityQuery);
      expect(result).toBeInstanceOf(EntityProxy);
      expect(result.entityId).toBe(sampleData.users.alice);
    });
    
    test('should detect stream queries and create StreamProxy via query()', () => {
      const proxy = new DataStoreProxy(store);
      
      // Stream query (variables in entity position)
      const streamQuery = {
        find: ['?e', '?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const result = proxy.query(streamQuery);
      expect(result).toBeInstanceOf(StreamProxy);
      expect(result.querySpec).toEqual(streamQuery);
    });
    
    test('should detect collection queries and create CollectionProxy via query()', () => {
      const proxy = new DataStoreProxy(store);
      
      // Collection query (single entity variable, suitable for collection)
      const collectionQuery = {
        find: ['?e'],
        where: [['?e', ':user/active', true]]
      };
      
      const result = proxy.query(collectionQuery);
      expect(result).toBeInstanceOf(CollectionProxy);
      expect(result.collectionSpec).toEqual({
        ...collectionQuery,
        entityKey: '?e'
      });
    });
    
    test('should validate query specification for auto-detection', () => {
      const proxy = new DataStoreProxy(store);
      
      expect(() => proxy.query()).toThrow('Query specification is required');
      expect(() => proxy.query(null)).toThrow('Query specification is required');
      expect(() => proxy.query({})).toThrow('Query must have find clause');
      expect(() => proxy.query({ find: ['?e'] })).toThrow('Query must have where clause');
    });
    
    test('should handle ambiguous queries with default to StreamProxy', () => {
      const proxy = new DataStoreProxy(store);
      
      // Complex query that might be ambiguous
      const ambiguousQuery = {
        find: ['?e', '?name', '?age'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/age', '?age'],
          ['?other', ':relation/to', '?e']
        ]
      };
      
      const result = proxy.query(ambiguousQuery);
      expect(result).toBeInstanceOf(StreamProxy); // Default fallback
    });
  });
  
  describe('Direct Store Operations', () => {
    test('should provide direct access to store query method', () => {
      const proxy = new DataStoreProxy(store);
      
      const querySpec = {
        find: ['?e', '?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const results = proxy.queryStore(querySpec);
      const expectedResults = store.query(querySpec);
      
      expect(results).toEqual(expectedResults);
    });
    
    test('should provide direct access to store update method', () => {
      const proxy = new DataStoreProxy(store);
      
      const initialAge = store.query({
        find: ['?age'],
        where: [[sampleData.users.alice, ':user/age', '?age']]
      });
      
      expect(initialAge[0][0]).toBe(30);
      
      const updateResult = proxy.updateStore(sampleData.users.alice, { ':user/age': 32 });
      
      const newAge = store.query({
        find: ['?age'],
        where: [[sampleData.users.alice, ':user/age', '?age']]
      });
      
      expect(newAge[0][0]).toBe(32);
    });
    
    test('should validate parameters for direct store operations', () => {
      const proxy = new DataStoreProxy(store);
      
      expect(() => proxy.queryStore()).toThrow('Query specification is required');
      expect(() => proxy.updateStore()).toThrow('Entity ID is required');
      expect(() => proxy.updateStore(sampleData.users.alice)).toThrow('Update data is required');
    });
  });
  
  describe('Subscription Management', () => {
    test('should create global subscriptions via subscribe method', () => {
      const proxy = new DataStoreProxy(store);
      
      const querySpec = {
        find: ['?e'],
        where: [['?e', ':user/active', true]]
      };
      
      let callbackInvoked = false;
      const subscription = proxy.subscribe(querySpec, () => {
        callbackInvoked = true;
      });
      
      expect(subscription).toHaveProperty('id');
      expect(typeof subscription.unsubscribe).toBe('function');
      expect(proxy._subscriptions.has(subscription)).toBe(true);
    });
    
    test('should support multiple concurrent subscriptions', () => {
      const proxy = new DataStoreProxy(store);
      
      const query1 = { find: ['?e'], where: [['?e', ':user/active', true]] };
      const query2 = { find: ['?e'], where: [['?e', ':user/name', '?name']] };
      
      const sub1 = proxy.subscribe(query1, () => {});
      const sub2 = proxy.subscribe(query2, () => {});
      
      // DataStoreProxy has 2 explicit subscriptions (no cache invalidation in simplified implementation)
      expect(proxy._subscriptions.size).toBe(2);
      expect(sub1.id).not.toBe(sub2.id);
    });
    
    test('should clean up subscriptions properly', () => {
      const proxy = new DataStoreProxy(store);
      
      const subscription = proxy.subscribe(
        { find: ['?e'], where: [['?e', ':user/name', '?name']] },
        () => {}
      );
      
      // DataStoreProxy has 1 explicit subscription (no cache invalidation in simplified implementation)
      expect(proxy._subscriptions.size).toBe(1);
      
      subscription.unsubscribe();
      // No subscriptions remain after unsubscribe
      expect(proxy._subscriptions.size).toBe(0);
    });
  });
  
  describe('Error Handling', () => {
    test('should fail fast with clear error messages', () => {
      expect(() => new DataStoreProxy()).toThrow('DataStore is required');
      expect(() => new DataStoreProxy(store).entity()).toThrow('Entity ID is required');
      expect(() => new DataStoreProxy(store).stream()).toThrow('Query specification is required');
      expect(() => new DataStoreProxy(store).collection()).toThrow('Collection specification is required');
    });
    
    test('should not have fallback behavior', () => {
      errorHelpers.expectNoFallback(() => new DataStoreProxy());
      errorHelpers.expectNoFallback(() => new DataStoreProxy(null));
      
      const proxy = new DataStoreProxy(store);
      errorHelpers.expectNoFallback(() => proxy.entity(null));
      errorHelpers.expectNoFallback(() => proxy.stream(null));
      errorHelpers.expectNoFallback(() => proxy.collection(null));
    });
    
    test('should handle destroyed state consistently', () => {
      const proxy = new DataStoreProxy(store);
      proxy.destroy();
      
      expect(() => proxy.entity(sampleData.users.alice)).toThrow('Handle has been destroyed');
      expect(() => proxy.stream({ find: ['?e'], where: [] })).toThrow('Handle has been destroyed');
      expect(() => proxy.collection({ find: ['?e'], where: [], entityKey: '?e' })).toThrow('Handle has been destroyed');
      expect(() => proxy.queryStore({ find: ['?e'], where: [] })).toThrow('Handle has been destroyed');
    });
  });
  
  describe('Memory Management', () => {
    test('should cleanup all created proxies on destroy', () => {
      const proxy = new DataStoreProxy(store);
      
      // Create various proxy types
      const entityProxy = proxy.entity(sampleData.users.alice);
      const streamProxy = proxy.stream({ find: ['?e'], where: [['?e', ':user/name', '?name']] });
      const collectionProxy = proxy.collection({ 
        find: ['?e'], 
        where: [['?e', ':user/active', true]], 
        entityKey: '?e' 
      });
      
      // Add subscriptions
      const sub1 = proxy.subscribe({ find: ['?e'], where: [] }, () => {});
      const sub2 = proxy.subscribe({ find: ['?e'], where: [] }, () => {});
      
      expect(proxy._entityProxies.size).toBe(1);
      // DataStoreProxy has 2 explicit subscriptions (no cache invalidation in simplified implementation)
      expect(proxy._subscriptions.size).toBe(2);
      
      // Destroy proxy
      proxy.destroy();
      
      expect(proxy._entityProxies.size).toBe(0);
      expect(proxy._subscriptions.size).toBe(0);
      expect(proxy.isDestroyed()).toBe(true);
      
      // All created proxies should be destroyed
      expect(entityProxy.isDestroyed()).toBe(true);
    });
    
    test('should prevent creating new proxies after destroy', () => {
      const proxy = new DataStoreProxy(store);
      proxy.destroy();
      
      expect(() => proxy.entity(1)).toThrow('Handle has been destroyed');
      expect(() => proxy.stream({ find: ['?e'], where: [] })).toThrow('Handle has been destroyed');
      expect(() => proxy.collection({ find: ['?e'], where: [], entityKey: '?e' })).toThrow('Handle has been destroyed');
    });
  });
  
  describe('Integration with Store', () => {
    test('should work with real DataStore operations', () => {
      const proxy = new DataStoreProxy(store);
      
      // Test entity proxy integration
      const aliceProxy = proxy.entity(sampleData.users.alice);
      const aliceData = aliceProxy.value();
      expect(aliceData[':user/name']).toBe('Alice');
      
      // Test stream proxy integration
      const activeStream = proxy.stream({
        find: ['?e'],
        where: [['?e', ':user/active', true]]
      });
      const activeUsers = activeStream.value();
      expect(activeUsers.length).toBe(2);
      
      // Test collection proxy integration
      const userCollection = proxy.collection({
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      });
      expect(userCollection.length).toBe(3);
    });
    
    test('should maintain consistency across different proxy types', () => {
      const proxy = new DataStoreProxy(store);
      
      // Create different proxies for same data
      const aliceEntity = proxy.entity(sampleData.users.alice);
      const allUsers = proxy.collection({
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      });
      
      // Initial state
      expect(aliceEntity.value()[':user/age']).toBe(30);
      expect(allUsers.length).toBe(3);
      
      // Update through entity proxy
      aliceEntity.update({ ':user/age': 31 });
      
      // Should be consistent across proxies
      expect(aliceEntity.value()[':user/age']).toBe(31);
      expect(allUsers.get(sampleData.users.alice).value()[':user/age']).toBe(31);
    });
  });
});