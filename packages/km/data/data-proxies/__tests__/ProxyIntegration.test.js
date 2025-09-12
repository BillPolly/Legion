/**
 * Proxy Creation and Type Detection Integration Tests
 * Testing the complete flow of proxy creation, type detection, and operation
 */

import { DataStoreProxy } from '../src/DataStoreProxy.js';
import { EntityProxy } from '../src/EntityProxy.js';
import { StreamProxy } from '../src/StreamProxy.js';
import { CollectionProxy } from '../src/CollectionProxy.js';
import { createTestStore, createSampleData } from './setup.js';

describe('Proxy Creation and Type Detection Integration', () => {
  let store;
  let sampleData;
  let proxy;
  
  beforeEach(() => {
    store = createTestStore();
    sampleData = createSampleData(store);
    proxy = new DataStoreProxy(store);
  });
  
  describe('Automatic Proxy Type Detection', () => {
    test('should detect and create EntityProxy for entity queries', () => {
      // Query with entity ID directly
      const entityQuery = {
        find: ['?attr', '?value'],
        where: [[sampleData.users.alice, '?attr', '?value']]
      };
      
      const result = proxy.query(entityQuery);
      expect(result).toBeInstanceOf(EntityProxy);
      
      // Verify proxy functionality
      const value = result.value();
      expect(value[':user/name']).toBe('Alice');
      expect(value[':user/age']).toBe(30);
    });
    
    test('should detect and create StreamProxy for scalar queries', () => {
      // Query returning multiple attributes
      const streamQuery = {
        find: ['?name', '?age'],
        where: [[sampleData.users.alice, ':user/name', '?name'], 
                [sampleData.users.alice, ':user/age', '?age']]
      };
      
      const result = proxy.query(streamQuery);
      expect(result).toBeInstanceOf(StreamProxy);
      
      // Verify proxy functionality
      const value = result.value();
      expect(value.length).toBe(1);
      expect(value[0]).toEqual(['Alice', 30]);
    });
    
    test('should detect and create CollectionProxy for entity collections', () => {
      // Query returning collection of entities
      const collectionQuery = {
        find: ['?e'],
        where: [['?e', ':user/active', true]]
      };
      
      const result = proxy.query(collectionQuery);
      expect(result).toBeInstanceOf(CollectionProxy);
      
      // Verify proxy functionality
      expect(result.length).toBe(2);
      const names = result.map(entity => entity[':user/name']);
      expect(names).toContain('Alice');
      expect(names).toContain('Bob');
    });
    
    test('should handle complex queries with multiple variables', () => {
      // Complex query with multiple find variables
      const complexQuery = {
        find: ['?e', '?name', '?age'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/age', '?age'],
          ['?e', ':user/active', true]
        ]
      };
      
      const result = proxy.query(complexQuery);
      expect(result).toBeInstanceOf(StreamProxy);
      
      const value = result.value();
      expect(value.length).toBe(2);
      // Each result should have [entityId, name, age]
      expect(value[0].length).toBe(3);
    });
  });
  
  describe('Entity Proxy Singleton Pattern', () => {
    test('should return same EntityProxy instance for same entity', () => {
      const proxy1 = proxy.entity(sampleData.users.alice);
      const proxy2 = proxy.entity(sampleData.users.alice);
      
      expect(proxy1).toBe(proxy2); // Same instance
    });
    
    test('should maintain singleton across different query methods', () => {
      // Get entity via direct method
      const directProxy = proxy.entity(sampleData.users.alice);
      
      // Get entity via query detection
      const queryProxy = proxy.query({
        find: ['?attr', '?value'],
        where: [[sampleData.users.alice, '?attr', '?value']]
      });
      
      expect(queryProxy).toBe(directProxy); // Same instance
    });
  });
  
  describe('Proxy Chaining and Composition', () => {
    test('should allow chaining from collection to entity proxies', () => {
      const collection = proxy.collection({
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        entityKey: '?e'
      });
      
      // Access individual entity proxy from collection
      const entityIds = collection._getEntityIds();
      const firstEntity = collection.get(entityIds[0]);
      expect(firstEntity).toBeInstanceOf(EntityProxy);
      
      // Entity proxy should be functional
      const name = firstEntity.value()[':user/name'];
      expect(['Alice', 'Bob']).toContain(name);
    });
    
    test('should support nested queries through proxies', () => {
      // Get an entity proxy
      const entityProxy = proxy.entity(sampleData.users.alice);
      
      // Query related data through the entity
      const relatedQuery = entityProxy.query({
        find: ['?age'],
        where: [[sampleData.users.alice, ':user/age', '?age']]
      });
      
      expect(Array.isArray(relatedQuery)).toBe(true);
      expect(relatedQuery).toEqual([[30]]);
    });
  });
  
  describe('Query-with-Update Integration', () => {
    test('should create appropriate proxy for update results', () => {
      // Update and query for collection
      const collectionResult = proxy.queryWithUpdate({
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        update: [
          { ':db/id': sampleData.users.charlie, ':user/active': true }
        ]
      });
      
      expect(collectionResult).toBeInstanceOf(CollectionProxy);
      expect(collectionResult.length).toBe(3);
    });
    
    test('should handle entity creation with proxy return', () => {
      // Create new entity and get as proxy
      const entityResult = proxy.queryWithUpdate({
        find: ['?e'],
        where: [['?e', ':user/name', 'NewUser']],
        update: [
          { ':db/id': '?new-user', ':user/name': 'NewUser', ':user/age': 25 }
        ]
      });
      
      expect(entityResult).toBeInstanceOf(EntityProxy);
      expect(entityResult.value()[':user/name']).toBe('NewUser');
    });
  });
  
  describe('Subscription Integration', () => {
    test('should support subscriptions through proxy factory', (done) => {
      const subscription = proxy.subscribe(
        {
          find: ['?e'],
          where: [['?e', ':user/active', true]]
        },
        (results) => {
          try {
            // Only expects initial callback (no reactive updates in mock system)
            expect(results.length).toBe(2);
            subscription.unsubscribe();
            done();
          } catch (error) {
            done(error);
          }
        }
      );
    });
    
    test('should cleanup subscriptions on proxy destroy', () => {
      const subscription = proxy.subscribe(
        {
          find: ['?e'],
          where: [['?e', ':user/active', true]]
        },
        () => {}
      );
      
      expect(proxy._subscriptions.has(subscription)).toBe(true);
      
      proxy.destroy();
      
      expect(proxy.isDestroyed()).toBe(true);
      expect(proxy._subscriptions.size).toBe(0);
    });
  });
  
  describe('Error Handling and Validation', () => {
    test('should validate query specifications', () => {
      expect(() => {
        proxy.query(null);
      }).toThrow('Query specification is required');
      
      expect(() => {
        proxy.query({ find: [] });
      }).toThrow('Query must have find clause');
      
      expect(() => {
        proxy.query({ find: ['?e'] });
      }).toThrow('Query must have where clause');
    });
    
    test('should validate entity IDs', () => {
      expect(() => {
        proxy.entity(null);
      }).toThrow('Entity ID is required');
      
      expect(() => {
        proxy.entity('not-a-number');
      }).toThrow('Entity ID must be a number');
    });
    
    test('should prevent operations on destroyed proxy', () => {
      proxy.destroy();
      
      expect(() => {
        proxy.query({ find: ['?e'], where: [['?e', ':type', 'user']] });
      }).toThrow('Handle has been destroyed');
      
      expect(() => {
        proxy.entity(1);
      }).toThrow('Handle has been destroyed');
    });
  });
  
  describe('Memory Management', () => {
    test('should cleanup entity proxy cache on destroy', () => {
      // Create multiple entity proxies
      const proxy1 = proxy.entity(sampleData.users.alice);
      const proxy2 = proxy.entity(sampleData.users.bob);
      const proxy3 = proxy.entity(sampleData.users.charlie);
      
      expect(proxy._entityProxies.size).toBe(3);
      
      // Destroy factory proxy
      proxy.destroy();
      
      // All entity proxies should be destroyed
      expect(proxy1.isDestroyed()).toBe(true);
      expect(proxy2.isDestroyed()).toBe(true);
      expect(proxy3.isDestroyed()).toBe(true);
      expect(proxy._entityProxies.size).toBe(0);
    });
    
    test('should handle circular reference cleanup', () => {
      // Create interconnected proxies
      const collection = proxy.collection({
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        entityKey: '?e'
      });
      
      const entityIds = collection._getEntityIds();
      const entity1 = collection.get(entityIds[0]);
      const entity2 = collection.get(entityIds[1]);
      
      // Create subscriptions with callback functions
      const querySpec1 = {
        find: ['?attr', '?value'],
        where: [[entityIds[0], '?attr', '?value']]
      };
      const querySpec2 = {
        find: ['?attr', '?value'],
        where: [[entityIds[1], '?attr', '?value']]
      };
      const sub1 = entity1.subscribe(querySpec1, (results) => {});
      const sub2 = entity2.subscribe(querySpec2, (results) => {});
      
      // Destroy collection
      collection.destroy();
      
      // All should be cleaned up
      expect(collection.isDestroyed()).toBe(true);
      expect(entity1.isDestroyed()).toBe(true);
      expect(entity2.isDestroyed()).toBe(true);
    });
  });
});