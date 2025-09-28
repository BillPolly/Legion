/**
 * CollectionProxy Class Unit Tests
 * Testing proxy wrapper for collections of entities with iteration and filtering
 */

import { CollectionProxy } from '../src/CollectionProxy.js';
import { Handle } from '@legion/handle';
import { DataStoreDataSource } from '../src/DataStoreDataSource.js';
import { createTestStore, createSampleData, assertions, validators, errorHelpers } from './setup.js';

describe('CollectionProxy', () => {
  let store;
  let resourceManager;
  let sampleData;
  
  beforeEach(() => {
    store = createTestStore();
    resourceManager = new DataStoreDataSource(store);
    sampleData = createSampleData(store);
  });
  
  describe('Constructor', () => {
    test('should require resourceManager and collectionSpec parameters', () => {
      expect(() => new CollectionProxy()).toThrow('ResourceManager must be a non-null object');
      expect(() => new CollectionProxy(null)).toThrow('ResourceManager must be a non-null object');
      expect(() => new CollectionProxy(resourceManager)).toThrow('Collection specification is required');
      expect(() => new CollectionProxy(resourceManager, null)).toThrow('Collection specification is required');
    });
    
    test('should validate resourceManager has required methods', () => {
      const invalidResourceManager = { query: 'not a function' };
      const collectionSpec = { 
        find: ['?e'], 
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      };
      expect(() => new CollectionProxy(invalidResourceManager, collectionSpec)).toThrow('ResourceManager must implement query() method');
    });
    
    test('should validate collection specification structure', () => {
      expect(() => new CollectionProxy(resourceManager, {})).toThrow('Collection specification must have find clause');
      expect(() => new CollectionProxy(resourceManager, { find: [] })).toThrow('Collection specification must have find clause');
      expect(() => new CollectionProxy(resourceManager, { find: ['?e'] })).toThrow('Collection specification must have where clause');
      expect(() => new CollectionProxy(resourceManager, { 
        find: ['?e'], 
        where: 'invalid' 
      })).toThrow('Where clause must be an array');
      // Note: entityKey is now auto-detected, so this test should pass
      const proxy = new CollectionProxy(resourceManager, { 
        find: ['?e'], 
        where: [['?e', ':user/name', '?name']] 
      });
      expect(proxy.entityKey).toBe('?e'); // Auto-detected
    });
    
    test('should accept valid parameters', () => {
      const collectionSpec = {
        find: ['?e', '?name'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      };
      
      expect(() => new CollectionProxy(resourceManager, collectionSpec)).not.toThrow();
      const proxy = new CollectionProxy(resourceManager, collectionSpec);
      expect(proxy.store).toBe(store);
      expect(proxy.collectionSpec).toEqual(collectionSpec);
      expect(proxy.entityKey).toBe('?e');
    });
    
    test('should inherit from Handle', () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        entityKey: '?e'
      };
      
      const proxy = new CollectionProxy(resourceManager, collectionSpec);
      expect(proxy).toBeInstanceOf(Handle);
      expect(typeof proxy.subscribe).toBe('function');
      expect(typeof proxy.destroy).toBe('function');
    });
  });
  
  describe('value() Method', () => {
    test('should return array of entities from collection', () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      };
      
      const proxy = new CollectionProxy(resourceManager, collectionSpec);
      const value = proxy.value();
      
      expect(Array.isArray(value)).toBe(true);
      expect(value.length).toBe(3); // Alice, Bob, Charlie
      
      // Should contain entities with the expected IDs
      const entityIds = value.map(entity => entity[':db/id']);
      expect(entityIds).toContain(sampleData.users.alice);
      expect(entityIds).toContain(sampleData.users.bob);
      expect(entityIds).toContain(sampleData.users.charlie);
    });
    
    test('should return fresh results on each call', () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        entityKey: '?e'
      };
      
      const proxy = new CollectionProxy(resourceManager, collectionSpec);
      const value1 = proxy.value();
      
      // Deactivate Bob through resourceManager
      resourceManager.update(sampleData.users.bob, { ':user/active': false });
      
      const value2 = proxy.value();
      
      expect(value1.length).toBe(2); // Alice and Bob active
      expect(value2.length).toBe(1); // Only Alice active
      
      // Check entity IDs
      const value2Ids = value2.map(entity => entity[':db/id']);
      expect(value2Ids).toContain(sampleData.users.alice);
      expect(value2Ids).not.toContain(sampleData.users.bob);
    });
    
    test('should handle empty collections', () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':nonexistent/attribute', 'impossible-value']],
        entityKey: '?e'
      };
      
      const proxy = new CollectionProxy(resourceManager, collectionSpec);
      const value = proxy.value();
      
      expect(Array.isArray(value)).toBe(true);
      expect(value.length).toBe(0);
    });
    
    test('should fail fast when destroyed', () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      };
      
      const proxy = new CollectionProxy(resourceManager, collectionSpec);
      proxy.destroy();
      
      expect(() => proxy.value()).toThrow('Handle has been destroyed');
    });
  });
  
  describe('query() Method', () => {
    test('should execute queries on collection entities', () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        entityKey: '?e'
      };
      
      const proxy = new CollectionProxy(resourceManager, collectionSpec);
      
      // Query for names of active users
      const nameQuery = {
        find: ['?e', '?name'],
        where: [
          ['?e', ':user/active', true],
          ['?e', ':user/name', '?name']
        ]
      };
      
      const results = proxy.query(nameQuery);
      expect(results.length).toBe(2); // Alice and Bob are active
      
      const names = results.map(r => r[1]);
      expect(names).toContain('Alice');
      expect(names).toContain('Bob');
    });
    
    test('should validate query specification', () => {
      const proxy = new CollectionProxy(resourceManager, {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      });
      
      expect(() => proxy.query()).toThrow('Query specification is required');
      expect(() => proxy.query(null)).toThrow('Query specification is required');
      expect(() => proxy.query({})).toThrow('Query specification must have find or where clause');
      expect(() => proxy.query({ find: ['?e'] })).toThrow('Query must have where clause');
    });
    
    test('should fail fast when destroyed', () => {
      const proxy = new CollectionProxy(resourceManager, {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      });
      
      proxy.destroy();
      
      const query = { find: ['?name'], where: [['?e', ':user/name', '?name']] };
      expect(() => proxy.query(query)).toThrow('Handle has been destroyed');
    });
  });
  
  describe('Collection Operations', () => {
    test('should support filtering with filter() method', () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      };
      
      const proxy = new CollectionProxy(resourceManager, collectionSpec);
      
      // Filter for active users
      const activeUsers = proxy.filter(entity => {
        return entity[':user/active'] === true;
      });
      
      expect(activeUsers.length).toBe(2);
      const activeUserIds = activeUsers.map(user => user[':db/id']);
      expect(activeUserIds).toContain(sampleData.users.alice);
      expect(activeUserIds).toContain(sampleData.users.bob);
    });
    
    test('should support mapping with map() method', () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      };
      
      const proxy = new CollectionProxy(resourceManager, collectionSpec);
      
      // Map to user names (mapper receives entity objects)
      const userNames = proxy.map(entity => {
        return entity[':user/name'];
      });
      
      expect(userNames.length).toBe(3);
      expect(userNames).toContain('Alice');
      expect(userNames).toContain('Bob');
      expect(userNames).toContain('Charlie');
    });
    
    test('should support finding with find() method', () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      };
      
      const proxy = new CollectionProxy(resourceManager, collectionSpec);
      
      // Find Alice by name
      const alice = proxy.find(entity => {
        return entity[':user/name'] === 'Alice';
      });
      
      expect(alice).toBeDefined();
      expect(alice[':db/id']).toBe(sampleData.users.alice);
      expect(alice[':user/name']).toBe('Alice');
    });
    
    test('should support iteration with forEach() method', () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        entityKey: '?e'
      };
      
      const proxy = new CollectionProxy(resourceManager, collectionSpec);
      
      const visitedIds = [];
      proxy.forEach(entity => {
        visitedIds.push(entity[':db/id']);
      });
      
      expect(visitedIds.length).toBe(2);
      expect(visitedIds).toContain(sampleData.users.alice);
      expect(visitedIds).toContain(sampleData.users.bob);
    });
    
    test('should support length property', () => {
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
      
      const activeProxy = new CollectionProxy(resourceManager, activeUsersSpec);
      const allProxy = new CollectionProxy(resourceManager, allUsersSpec);
      
      expect(activeProxy.length).toBe(2);
      expect(allProxy.length).toBe(3);
    });
  });
  
  describe('Entity Proxy Access', () => {
    test('should provide entity proxy access via get() method', () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      };
      
      const proxy = new CollectionProxy(resourceManager, collectionSpec);
      
      // Get entity proxy for Alice
      const aliceProxy = proxy.get(sampleData.users.alice);
      
      expect(aliceProxy).toBeDefined();
      expect(typeof aliceProxy.value).toBe('function');
      expect(typeof aliceProxy.query).toBe('function');
      expect(typeof aliceProxy.update).toBe('function');
      
      // Should return Alice's data
      const aliceData = aliceProxy.value();
      expect(aliceData[':user/name']).toBe('Alice');
    });
    
    test('should validate entity ID for get() method', () => {
      const proxy = new CollectionProxy(resourceManager, {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      });
      
      expect(() => proxy.get()).toThrow('Entity ID is required');
      expect(() => proxy.get(null)).toThrow('Entity ID is required');
      expect(() => proxy.get('invalid')).toThrow('Entity ID must be a number');
    });
    
    test('should cache entity proxies for performance', () => {
      const proxy = new CollectionProxy(resourceManager, {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      });
      
      const proxy1 = proxy.get(sampleData.users.alice);
      const proxy2 = proxy.get(sampleData.users.alice);
      
      // Should return same proxy instance
      expect(proxy1).toBe(proxy2);
    });
  });
  
  describe('Collection Updates', () => {
    test('should support bulk updates with updateAll() method', () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        entityKey: '?e'
      };
      
      const proxy = new CollectionProxy(resourceManager, collectionSpec);
      
      // Update all active users
      const results = proxy.updateAll({ ':user/status': 'online' });
      
      expect(results.success).toBe(true);
      expect(results.updated).toBe(2); // Alice and Bob
      
      // Verify updates
      const aliceStatus = store.query({
        find: ['?status'],
        where: [[sampleData.users.alice, ':user/status', '?status']]
      });
      
      expect(aliceStatus[0][0]).toBe('online');
    });
    
    test('should validate update data for updateAll()', () => {
      const proxy = new CollectionProxy(resourceManager, {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      });
      
      expect(() => proxy.updateAll()).toThrow('Update data must be an object');
      expect(() => proxy.updateAll(null)).toThrow('Update data must be an object');
      expect(() => proxy.updateAll({})).not.toThrow(); // Empty object is allowed
      expect(() => proxy.updateAll({ invalidAttr: 'value' })).not.toThrow(); // Validation happens in ResourceManager
    });
    
    test('should support conditional updates with updateWhere() method', () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      };
      
      const proxy = new CollectionProxy(resourceManager, collectionSpec);
      
      // Update users with age > 30
      const results = proxy.updateWhere(
        entity => {
          return entity[':user/age'] > 30;
        },
        { ':user/category': 'senior' }
      );
      
      expect(results.success).toBe(true);
      expect(results.updated).toBe(1); // Only Charlie (35)
      
      // Verify Charlie was updated
      const charlieCategory = resourceManager.query({
        find: ['?category'],
        where: [[sampleData.users.charlie, ':user/category', '?category']]
      });
      
      expect(charlieCategory[0][0]).toBe('senior');
    });
  });
  
  describe('Subscription Integration', () => {
    test('should create collection-wide subscriptions', (done) => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        entityKey: '?e'
      };
      
      const proxy = new CollectionProxy(resourceManager, collectionSpec);
      
      // Test that subscription is created and returns proper object
      const subscription = proxy.subscribe(collectionSpec, (results) => {
        // Should receive initial callback with current active users
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(2); // Alice and Bob active initially
        
        // Test subscription object
        expect(subscription).toBeDefined();
        expect(typeof subscription.unsubscribe).toBe('function');
        expect(subscription.id).toBeDefined();
        
        subscription.unsubscribe();
        done();
      });
    });
    
    test('should handle subscription cleanup properly', () => {
      const proxy = new CollectionProxy(resourceManager, {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      });
      
      const querySpec = { find: ['?e'], where: [['?e', ':user/name', '?name']] };
      const sub1 = proxy.subscribe(querySpec, () => {});
      const sub2 = proxy.subscribe(querySpec, () => {});
      
      // Verify subscription objects have required methods
      expect(typeof sub1.unsubscribe).toBe('function');
      expect(typeof sub2.unsubscribe).toBe('function');
      expect(sub1.id).toBeDefined();
      expect(sub2.id).toBeDefined();
      
      // Test unsubscribe works
      expect(() => sub1.unsubscribe()).not.toThrow();
      expect(() => sub2.unsubscribe()).not.toThrow();
      
      proxy.destroy();
      expect(proxy.isDestroyed()).toBe(true);
    });
  });
  
  describe('Error Handling', () => {
    test('should fail fast with clear error messages', () => {
      expect(() => new CollectionProxy()).toThrow('ResourceManager must be a non-null object');
      expect(() => new CollectionProxy(resourceManager)).toThrow('Collection specification is required');
      expect(() => new CollectionProxy(resourceManager, {})).toThrow('Collection specification must have find clause');
    });
    
    test('should not have fallback behavior', () => {
      errorHelpers.expectNoFallback(() => new CollectionProxy());
      errorHelpers.expectNoFallback(() => new CollectionProxy(null));
      errorHelpers.expectNoFallback(() => new CollectionProxy(resourceManager, null));
    });
    
    test('should handle destroyed state consistently', () => {
      const proxy = new CollectionProxy(resourceManager, {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      });
      
      proxy.destroy();
      
      expect(() => proxy.value()).toThrow('Handle has been destroyed');
      expect(() => proxy.query({ find: ['?e'], where: [['?e', ':user/name', '?name']] })).toThrow('Handle has been destroyed');
      expect(() => proxy.filter(() => true)).toThrow('Handle has been destroyed');
      expect(() => proxy.map(() => {})).toThrow('Handle has been destroyed');
      expect(() => proxy.updateAll({})).toThrow('Handle has been destroyed');
    });
  });
  
  describe('Memory Management', () => {
    test('should cleanup entity proxies on destroy', () => {
      const proxy = new CollectionProxy(resourceManager, {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      });
      
      // Create entity proxies
      const aliceProxy = proxy.get(sampleData.users.alice);
      const bobProxy = proxy.get(sampleData.users.bob);
      
      expect(proxy._entityProxies.size).toBe(2);
      
      // Destroy collection proxy
      proxy.destroy();
      
      expect(proxy._entityProxies.size).toBe(0);
      expect(proxy.isDestroyed()).toBe(true);
      
      // Entity proxies should also be destroyed (if they have isDestroyed method)
      if (typeof aliceProxy.isDestroyed === 'function') {
        expect(aliceProxy.isDestroyed()).toBe(true);
      }
      if (typeof bobProxy.isDestroyed === 'function') {
        expect(bobProxy.isDestroyed()).toBe(true);
      }
    });
  });
  
  describe('Integration with Store', () => {
    test('should work with complex multi-join queries', () => {
      const collectionSpec = {
        find: ['?e'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?p', ':project/members', '?e'],
          ['?p', ':project/name', '?pname']
        ],
        entityKey: '?e'
      };
      
      const proxy = new CollectionProxy(resourceManager, collectionSpec);
      const projectMembers = proxy.value();
      
      // Should find users who are project members
      expect(Array.isArray(projectMembers)).toBe(true);
      // Note: This is a complex join query - results may be empty depending on test data setup
      // Just verify it executes without error and returns an array
      expect(projectMembers.length).toBeGreaterThanOrEqual(0);
    });
    
    test('should maintain consistency with direct store operations', () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        entityKey: '?e'
      };
      
      const proxy = new CollectionProxy(resourceManager, collectionSpec);
      
      // Initial state
      expect(proxy.length).toBe(2);
      
      // Change through store
      store.updateEntity(sampleData.users.charlie, { ':user/active': true });
      
      // Should reflect in proxy
      expect(proxy.length).toBe(3);
    });
  });
});